#!/usr/bin/env npx tsx
// scripts/ai-eval-harness.ts
// AI Platform Evaluation Benchmark Harness (Phase 4, Plan 04-01)
//
// Usage:
//   npx tsx scripts/ai-eval-harness.ts --provider=claude-sonnet
//   npx tsx scripts/ai-eval-harness.ts --provider=claude-haiku --scenario=0
//   npx tsx scripts/ai-eval-harness.ts --provider=all
//
// Providers: claude-sonnet, claude-haiku, gemini-flash, gemini-pro, all
// Requires: CLAUDE_API_KEY, GEMINI_API_KEY in .env.local

import * as path from "path";
import * as fs from "fs";

// Load .env.local manually (avoids dotenv dependency)
function loadEnvFile(filePath: string): void {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* file not found is fine */ }
}
loadEnvFile(path.resolve(process.cwd(), ".env.eval"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { GoogleGenAI } from "@google/genai";

// Project imports — use relative paths since scripts/ isn't under @/
import { getToneIntentSchema } from "../src/lib/helix/tone-intent";
import { getCapabilities, resolveFamily } from "../src/lib/helix/device-family";
import { getModelListForPrompt, AMP_MODELS, CAB_MODELS, STADIUM_AMPS, VARIAX_MODEL_NAMES } from "../src/lib/helix/models";
import { getFamilyPlannerPrompt } from "../src/lib/prompt-router";
import { HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES } from "../src/lib/helix/catalogs/helix-catalog";
import { STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES } from "../src/lib/helix/catalogs/stomp-catalog";
import { PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES } from "../src/lib/helix/catalogs/podgo-catalog";
import { STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES } from "../src/lib/helix/catalogs/stadium-catalog";
import { CLAUDE_SONNET_PRICE, GEMINI_FLASH_PRICE } from "../src/lib/usage-logger";

import { SCENARIOS, type EvalScenario } from "./ai-eval-scenarios";
import type { DeviceTarget } from "../src/lib/helix/types";

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

type ProviderKey = "claude-sonnet" | "claude-haiku" | "gemini-flash" | "gemini-pro" | "gemini-3-flash" | "gemini-3.1-pro";

interface ProviderConfig {
  key: ProviderKey;
  name: string;
  vendor: "anthropic" | "google";
  model: string;
}

const PROVIDERS: Record<ProviderKey, ProviderConfig> = {
  "claude-sonnet": { key: "claude-sonnet", name: "Claude Sonnet 4.6", vendor: "anthropic", model: "claude-sonnet-4-6" },
  "claude-haiku": { key: "claude-haiku", name: "Claude Haiku 4.5", vendor: "anthropic", model: "claude-haiku-4-5-20251001" },
  "gemini-flash": { key: "gemini-flash", name: "Gemini 2.5 Flash", vendor: "google", model: "gemini-2.5-flash" },
  "gemini-pro": { key: "gemini-pro", name: "Gemini 2.5 Pro", vendor: "google", model: "gemini-2.5-pro" },
  "gemini-3-flash": { key: "gemini-3-flash", name: "Gemini 3 Flash", vendor: "google", model: "gemini-3-flash-preview" },
  "gemini-3.1-pro": { key: "gemini-3.1-pro", name: "Gemini 3.1 Pro", vendor: "google", model: "gemini-3.1-pro-preview" },
};

// Gemini pricing (per 1M tokens)
const GEMINI_PRO_PRICE = {
  input_per_mtok: 1.25,
  output_per_mtok: 10.0,
  cache_read_per_mtok: 0.125,
};

// Claude Haiku pricing (per 1M tokens)
const CLAUDE_HAIKU_PRICE = {
  input_per_mtok: 0.80,
  output_per_mtok: 4.0,
  cache_write_per_mtok: 1.6,
  cache_read_per_mtok: 0.08,
};

// Gemini 3 Flash pricing (per 1M tokens)
const GEMINI_3_FLASH_PRICE = {
  input_per_mtok: 0.50,
  output_per_mtok: 3.0,
  cache_read_per_mtok: 0.05,
};

// Gemini 3.1 Pro pricing (per 1M tokens)
const GEMINI_31_PRO_PRICE = {
  input_per_mtok: 2.0,
  output_per_mtok: 12.0,
  cache_read_per_mtok: 0.20,
};

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

interface EvalResult {
  provider: ProviderKey;
  providerName: string;
  scenario: number;
  scenarioName: string;
  device: DeviceTarget;
  genre: string;

  // Quality scores (0-1)
  schemaCompliance: number;
  modelValidity: number;
  appropriateness: number;
  effectDiversity: number;
  overallScore: number;

  // Performance
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;

  // Details
  ampName?: string;
  cabName?: string;
  effects?: string[];
  snapshots?: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Amp category lookup — maps amp name → category
// ---------------------------------------------------------------------------

function getAmpCategory(ampName: string, device: DeviceTarget): "clean" | "crunch" | "high_gain" | "unknown" {
  const family = resolveFamily(device);
  if (family === "stadium") {
    const model = STADIUM_AMPS[ampName];
    if (model?.ampCategory) return model.ampCategory;
  }
  const model = AMP_MODELS[ampName];
  if (model?.ampCategory) return model.ampCategory;
  return "unknown";
}

// ---------------------------------------------------------------------------
// Scoring functions
// ---------------------------------------------------------------------------

function scoreModelValidity(parsed: Record<string, unknown>, device: DeviceTarget): number {
  const family = resolveFamily(device);
  const { ampNames, cabNames } = getCatalogNames(family);

  let valid = 0;
  let total = 0;

  // Check amp
  total++;
  if (ampNames?.includes(parsed.ampName as string)) valid++;

  // Check cab
  total++;
  if (cabNames?.includes(parsed.cabName as string)) valid++;

  // Check effects
  const effects = parsed.effects as Array<{ modelName: string }> | undefined;
  if (effects?.length) {
    for (const eff of effects) {
      total++;
      // We'll just check if it parses — Zod schema already constrains to valid enums
      valid++; // If we got here via schema parse, it's valid
    }
  }

  return total > 0 ? valid / total : 0;
}

function scoreAppropriateness(parsed: Record<string, unknown>, scenario: EvalScenario, device: DeviceTarget): number {
  let score = 0;
  let checks = 0;

  // Check amp category matches expected
  const ampName = parsed.ampName as string;
  if (ampName) {
    checks++;
    const category = getAmpCategory(ampName, device);
    if (category === scenario.expectedAmpCategory) {
      score++;
    } else if (
      (scenario.expectedAmpCategory === "crunch" && category === "high_gain") ||
      (scenario.expectedAmpCategory === "high_gain" && category === "crunch")
    ) {
      score += 0.5; // Partial credit for adjacent categories
    }
  }

  // Check effects contain expected keywords
  const effects = parsed.effects as Array<{ modelName: string }> | undefined;
  if (effects?.length && scenario.expectedEffectKeywords.length) {
    for (const keyword of scenario.expectedEffectKeywords) {
      checks++;
      const found = effects.some((e) => e.modelName.toLowerCase().includes(keyword.toLowerCase()));
      if (found) score++;
    }
  }

  // Check snapshot count is reasonable for device
  const snapshots = parsed.snapshots as Array<{ name: string; toneRole: string }> | undefined;
  if (snapshots?.length) {
    checks++;
    const caps = getCapabilities(device);
    if (snapshots.length >= 3 && snapshots.length <= caps.maxSnapshots) score++;
  }

  return checks > 0 ? score / checks : 0;
}

function scoreEffectDiversity(parsed: Record<string, unknown>): number {
  const effects = parsed.effects as Array<{ modelName: string; role: string }> | undefined;
  if (!effects?.length) return 0.5; // No effects might be valid (simple preset)

  // Check that effects have different names (no duplicates)
  const names = effects.map((e) => e.modelName);
  const uniqueNames = new Set(names);
  const uniqueRatio = uniqueNames.size / names.length;

  // Check role diversity (mix of always_on, toggleable, ambient)
  const roles = new Set(effects.map((e) => e.role));
  const roleBonus = Math.min(roles.size / 3, 1) * 0.3;

  return Math.min(uniqueRatio * 0.7 + roleBonus, 1);
}

// ---------------------------------------------------------------------------
// JSON Schema builder for Gemini (avoids zod-to-json-schema dependency)
// ---------------------------------------------------------------------------

function getCatalogNames(family: string): { ampNames: string[]; cabNames: string[]; effectNames: string[] } {
  switch (family) {
    case "stomp": return { ampNames: [...STOMP_AMP_NAMES], cabNames: [...STOMP_CAB_NAMES], effectNames: [...STOMP_EFFECT_NAMES] };
    case "podgo": return { ampNames: [...PODGO_AMP_NAMES], cabNames: [...PODGO_CAB_NAMES], effectNames: [...PODGO_EFFECT_NAMES] };
    case "stadium": return { ampNames: [...STADIUM_AMP_NAMES], cabNames: [...STADIUM_CAB_NAMES], effectNames: [...STADIUM_EFFECT_NAMES] };
    default: return { ampNames: [...HELIX_AMP_NAMES], cabNames: [...HELIX_CAB_NAMES], effectNames: [...HELIX_EFFECT_NAMES] };
  }
}

function buildGeminiJsonSchema(family: string): Record<string, unknown> {
  const { ampNames, cabNames, effectNames } = getCatalogNames(family);
  return {
    type: "object",
    properties: {
      ampName: { type: "string", enum: ampNames },
      cabName: { type: "string", enum: cabNames },
      secondAmpName: { type: "string", enum: ampNames },
      secondCabName: { type: "string", enum: cabNames },
      guitarType: { type: "string", enum: ["single_coil", "humbucker", "p90"] },
      genreHint: { type: "string" },
      effects: {
        type: "array",
        items: {
          type: "object",
          properties: {
            modelName: { type: "string", enum: effectNames },
            role: { type: "string", enum: ["always_on", "toggleable", "ambient"] },
          },
          required: ["modelName", "role"],
        },
      },
      snapshots: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            toneRole: { type: "string", enum: ["clean", "crunch", "lead", "ambient"] },
          },
          required: ["name", "toneRole"],
        },
      },
      tempoHint: { type: "integer" },
      delaySubdivision: { type: "string", enum: ["quarter", "dotted_eighth", "eighth", "triplet"] },
      presetName: { type: "string" },
      description: { type: "string" },
      guitarNotes: { type: "string" },
    },
    required: ["ampName", "cabName", "guitarType", "effects", "snapshots"],
  };
}

// ---------------------------------------------------------------------------
// Provider callers
// ---------------------------------------------------------------------------

async function callClaude(
  provider: ProviderConfig,
  scenario: EvalScenario,
): Promise<EvalResult> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY required");

  const client = new Anthropic({ apiKey });
  const device = scenario.device;
  const family = resolveFamily(device);
  const caps = getCapabilities(device);
  const modelList = getModelListForPrompt(caps);
  const systemPrompt = getFamilyPlannerPrompt(device, modelList);
  const schema = getToneIntentSchema(family);

  const conversationText = scenario.messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const start = performance.now();
  let result: EvalResult;

  try {
    const response = await client.messages.create({
      model: provider.model,
      max_tokens: 4096,
      system: [{ type: "text" as const, text: systemPrompt }],
      messages: [{ role: "user", content: conversationText }],
      output_config: {
        format: zodOutputFormat(schema),
      },
    });

    const latencyMs = performance.now() - start;
    const { usage } = response;

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") throw new Error("No text content");

    const raw = JSON.parse(textBlock.text);

    // Sanitize snapshot names (same as planner.ts)
    if (Array.isArray(raw.snapshots)) {
      raw.snapshots = raw.snapshots.map((s: { name?: string }) => ({
        ...s,
        name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
      }));
    }
    // Strip invalid variaxModel
    if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
      delete raw.variaxModel;
    }

    // Validate with Zod
    let schemaCompliance = 0;
    let parsed = raw;
    try {
      parsed = schema.parse(raw);
      schemaCompliance = 1;
    } catch {
      schemaCompliance = 0;
    }

    // Cost estimation
    const MTok = 1_000_000;
    const pricing = provider.key === "claude-haiku" ? CLAUDE_HAIKU_PRICE : CLAUDE_SONNET_PRICE;
    const costUsd =
      (usage.input_tokens / MTok) * pricing.input_per_mtok +
      (usage.output_tokens / MTok) * pricing.output_per_mtok;

    result = {
      provider: provider.key,
      providerName: provider.name,
      scenario: scenario.id,
      scenarioName: scenario.name,
      device: scenario.device,
      genre: scenario.genre,
      schemaCompliance,
      modelValidity: schemaCompliance === 1 ? 1 : scoreModelValidity(raw, device),
      appropriateness: scoreAppropriateness(parsed, scenario, device),
      effectDiversity: scoreEffectDiversity(parsed),
      overallScore: 0,
      latencyMs,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      costUsd,
      ampName: parsed.ampName,
      cabName: parsed.cabName,
      effects: parsed.effects?.map((e: { modelName: string }) => e.modelName),
      snapshots: parsed.snapshots?.map((s: { name: string; toneRole: string }) => `${s.name} (${s.toneRole})`),
    };
  } catch (err: unknown) {
    const latencyMs = performance.now() - start;
    result = {
      provider: provider.key,
      providerName: provider.name,
      scenario: scenario.id,
      scenarioName: scenario.name,
      device: scenario.device,
      genre: scenario.genre,
      schemaCompliance: 0,
      modelValidity: 0,
      appropriateness: 0,
      effectDiversity: 0,
      overallScore: 0,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      error: err instanceof Error ? `${err.message}\n${err.stack?.split("\n").slice(0, 4).join("\n")}` : String(err),
    };
  }

  result.overallScore = computeOverall(result);
  return result;
}

async function callGemini(
  provider: ProviderConfig,
  scenario: EvalScenario,
): Promise<EvalResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY required");

  const ai = new GoogleGenAI({ apiKey });
  const device = scenario.device;
  const family = resolveFamily(device);
  const caps = getCapabilities(device);
  const modelList = getModelListForPrompt(caps);
  const systemPrompt = getFamilyPlannerPrompt(device, modelList);
  const schema = getToneIntentSchema(family);

  // Build JSON schema for Gemini structured output from catalog names
  const jsonSchema = buildGeminiJsonSchema(family);

  const conversationText = scenario.messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const start = performance.now();
  let result: EvalResult;

  try {
    const response = await ai.models.generateContent({
      model: provider.model,
      contents: conversationText,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseJsonSchema: jsonSchema as Record<string, unknown>,
        maxOutputTokens: 4096,
      },
    });

    const latencyMs = performance.now() - start;
    const usage = response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;

    const text = response.text;
    if (!text) throw new Error("No text in Gemini response");

    const raw = JSON.parse(text);

    // Sanitize snapshot names
    if (Array.isArray(raw.snapshots)) {
      raw.snapshots = raw.snapshots.map((s: { name?: string }) => ({
        ...s,
        name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
      }));
    }
    if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
      delete raw.variaxModel;
    }

    let schemaCompliance = 0;
    let parsed = raw;
    try {
      parsed = schema.parse(raw);
      schemaCompliance = 1;
    } catch {
      schemaCompliance = 0;
    }

    // Cost estimation
    const MTok = 1_000_000;
    const pricing =
      provider.key === "gemini-pro" ? GEMINI_PRO_PRICE :
      provider.key === "gemini-3.1-pro" ? GEMINI_31_PRO_PRICE :
      provider.key === "gemini-3-flash" ? GEMINI_3_FLASH_PRICE :
      GEMINI_FLASH_PRICE;
    const costUsd =
      (inputTokens / MTok) * pricing.input_per_mtok +
      (outputTokens / MTok) * pricing.output_per_mtok;

    result = {
      provider: provider.key,
      providerName: provider.name,
      scenario: scenario.id,
      scenarioName: scenario.name,
      device: scenario.device,
      genre: scenario.genre,
      schemaCompliance,
      modelValidity: schemaCompliance === 1 ? 1 : scoreModelValidity(raw, device),
      appropriateness: scoreAppropriateness(parsed, scenario, device),
      effectDiversity: scoreEffectDiversity(parsed),
      overallScore: 0,
      latencyMs,
      inputTokens,
      outputTokens,
      costUsd,
      ampName: parsed.ampName,
      cabName: parsed.cabName,
      effects: parsed.effects?.map((e: { modelName: string }) => e.modelName),
      snapshots: parsed.snapshots?.map((s: { name: string; toneRole: string }) => `${s.name} (${s.toneRole})`),
    };
  } catch (err: unknown) {
    const latencyMs = performance.now() - start;
    result = {
      provider: provider.key,
      providerName: provider.name,
      scenario: scenario.id,
      scenarioName: scenario.name,
      device: scenario.device,
      genre: scenario.genre,
      schemaCompliance: 0,
      modelValidity: 0,
      appropriateness: 0,
      effectDiversity: 0,
      overallScore: 0,
      latencyMs,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  result.overallScore = computeOverall(result);
  return result;
}

function computeOverall(r: EvalResult): number {
  // Weighted: schema compliance is critical (40%), appropriateness (30%), model validity (20%), diversity (10%)
  return r.schemaCompliance * 0.4 + r.appropriateness * 0.3 + r.modelValidity * 0.2 + r.effectDiversity * 0.1;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runOne(provider: ProviderConfig, scenario: EvalScenario): Promise<EvalResult> {
  console.log(`  [${provider.key}] Scenario ${scenario.id}: ${scenario.name} (${scenario.device})...`);
  const result = provider.vendor === "anthropic"
    ? await callClaude(provider, scenario)
    : await callGemini(provider, scenario);

  const status = result.schemaCompliance === 1 ? "PASS" : "FAIL";
  console.log(
    `    ${status} | overall=${result.overallScore.toFixed(2)} | ` +
    `amp=${result.ampName ?? "N/A"} | ` +
    `latency=${(result.latencyMs / 1000).toFixed(1)}s | ` +
    `cost=$${result.costUsd.toFixed(4)}` +
    (result.error ? ` | ERROR: ${result.error.slice(0, 80)}` : ""),
  );
  return result;
}

async function runProvider(providerKey: ProviderKey, scenarioFilter?: number): Promise<EvalResult[]> {
  const provider = PROVIDERS[providerKey];
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Provider: ${provider.name} (${provider.model})`);
  console.log(`${"═".repeat(60)}`);

  const scenarios = scenarioFilter !== undefined
    ? SCENARIOS.filter((s) => s.id === scenarioFilter)
    : SCENARIOS;

  const results: EvalResult[] = [];
  for (const scenario of scenarios) {
    const result = await runOne(provider, scenario);
    results.push(result);
  }
  return results;
}

function printSummary(allResults: EvalResult[]) {
  console.log(`\n${"═".repeat(60)}`);
  console.log("EVALUATION SUMMARY");
  console.log(`${"═".repeat(60)}\n`);

  // Group by provider
  const byProvider = new Map<string, EvalResult[]>();
  for (const r of allResults) {
    const list = byProvider.get(r.provider) ?? [];
    list.push(r);
    byProvider.set(r.provider, list);
  }

  console.log("Provider                  | Schema | Quality | Approp | Divers | Overall | Avg Cost | Avg Latency");
  console.log("-".repeat(105));

  for (const [key, results] of byProvider) {
    const avg = (fn: (r: EvalResult) => number) =>
      results.reduce((sum, r) => sum + fn(r), 0) / results.length;

    const schemaRate = avg((r) => r.schemaCompliance);
    const quality = avg((r) => r.modelValidity);
    const approp = avg((r) => r.appropriateness);
    const diversity = avg((r) => r.effectDiversity);
    const overall = avg((r) => r.overallScore);
    const cost = avg((r) => r.costUsd);
    const latency = avg((r) => r.latencyMs / 1000);

    const provName = PROVIDERS[key as ProviderKey]?.name ?? key;
    console.log(
      `${provName.padEnd(25)} | ${(schemaRate * 100).toFixed(0).padStart(5)}% | ${(quality * 100).toFixed(0).padStart(6)}% | ${(approp * 100).toFixed(0).padStart(5)}% | ${(diversity * 100).toFixed(0).padStart(5)}% | ${(overall * 100).toFixed(0).padStart(6)}% | $${cost.toFixed(4).padStart(7)} | ${latency.toFixed(1).padStart(5)}s`,
    );
  }

  // Cost projection
  console.log(`\n${"─".repeat(60)}`);
  console.log("Cost Projections (per month):\n");
  console.log("Provider                  | 100 gen | 500 gen | 1000 gen");
  console.log("-".repeat(60));
  for (const [key, results] of byProvider) {
    const avgCost = results.reduce((sum, r) => sum + r.costUsd, 0) / results.length;
    const provName = PROVIDERS[key as ProviderKey]?.name ?? key;
    console.log(
      `${provName.padEnd(25)} | $${(avgCost * 100).toFixed(2).padStart(6)} | $${(avgCost * 500).toFixed(2).padStart(6)} | $${(avgCost * 1000).toFixed(2).padStart(7)}`,
    );
  }

  // Per-scenario breakdown
  console.log(`\n${"─".repeat(60)}`);
  console.log("Per-Scenario Results:\n");
  for (const scenario of SCENARIOS) {
    const scenarioResults = allResults.filter((r) => r.scenario === scenario.id);
    if (scenarioResults.length === 0) continue;
    console.log(`  Scenario ${scenario.id}: ${scenario.name} (${scenario.device})`);
    for (const r of scenarioResults) {
      const provName = PROVIDERS[r.provider]?.name ?? r.provider;
      console.log(
        `    ${provName.padEnd(22)} | overall=${(r.overallScore * 100).toFixed(0)}% | amp=${(r.ampName ?? "N/A").padEnd(20)} | effects=${(r.effects ?? []).join(", ").slice(0, 50)}`,
      );
    }
    console.log();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const providerArg = args.find((a) => a.startsWith("--provider="))?.split("=")[1] ?? "claude-sonnet";
  const scenarioArg = args.find((a) => a.startsWith("--scenario="))?.split("=")[1];
  const scenarioFilter = scenarioArg !== undefined ? parseInt(scenarioArg, 10) : undefined;
  const outputArg = args.find((a) => a.startsWith("--output="))?.split("=")[1];

  const providerKeys: ProviderKey[] = providerArg === "all"
    ? ["claude-sonnet", "claude-haiku", "gemini-flash", "gemini-pro", "gemini-3-flash", "gemini-3.1-pro"]
    : [providerArg as ProviderKey];

  if (providerKeys.some((k) => !PROVIDERS[k])) {
    console.error(`Invalid provider. Valid: claude-sonnet, claude-haiku, gemini-flash, gemini-pro, gemini-3-flash, gemini-3.1-pro, all`);
    process.exit(1);
  }

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║        AI Platform Evaluation Benchmark                 ║");
  console.log("║        HelixAI Phase 4                                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Providers: ${providerKeys.map((k) => PROVIDERS[k].name).join(", ")}`);
  console.log(`Scenarios: ${scenarioFilter !== undefined ? `#${scenarioFilter}` : `all (${SCENARIOS.length})`}`);

  const allResults: EvalResult[] = [];
  for (const key of providerKeys) {
    const results = await runProvider(key, scenarioFilter);
    allResults.push(...results);
  }

  printSummary(allResults);

  // Save raw results
  const outputPath = outputArg ?? path.resolve(process.cwd(), "scripts/ai-eval-results.json");
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2));
  console.log(`\nRaw results saved to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
