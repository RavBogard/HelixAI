// src/lib/planner.ts
// Gemini Planner module — generates ToneIntents via structured output.
// The Planner makes creative choices only (amp, cab, effects, snapshots).
// All numeric parameters are handled by the Knowledge Layer (Phase 2).

import { createGeminiClient, getModelId } from "@/lib/gemini";
import {
  getToneIntentSchema,
  getModelListForPrompt,
  VARIAX_MODEL_NAMES,
  getCapabilities,
  STOMP_CONFIG,
  HELIX_AMP_NAMES,
  HELIX_CAB_NAMES,
  HELIX_EFFECT_NAMES,
  STOMP_AMP_NAMES,
  STOMP_CAB_NAMES,
  STOMP_EFFECT_NAMES,
  PODGO_AMP_NAMES,
  PODGO_CAB_NAMES,
  PODGO_EFFECT_NAMES,
  STADIUM_AMP_NAMES,
  STADIUM_CAB_NAMES,
  STADIUM_EFFECT_NAMES,
} from "@/lib/helix";
import type { ToneIntent, DeviceTarget, DeviceFamily } from "@/lib/helix";
import { logUsage, estimateGeminiCost } from "@/lib/usage-logger";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";

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
      variaxModel: { type: "string", enum: [...VARIAX_MODEL_NAMES] },
      tempoHint: { type: "integer" },
      delaySubdivision: { type: "string", enum: ["quarter", "dotted_eighth", "eighth", "triplet"] },
      presetName: { type: "string" },
      description: { type: "string" },
      guitarNotes: { type: "string" },
    },
    required: ["ampName", "cabName", "guitarType", "effects", "snapshots"],
  };
}

/**
 * Call Gemini Planner to generate a ToneIntent from conversation history.
 *
 * Uses Gemini structured output (responseJsonSchema) so constrained decoding
 * guarantees valid JSON matching the family-specific ToneIntent schema.
 * Belt-and-suspenders: Zod validates the response after parsing to catch
 * any constraints that JSON Schema cannot express (min/max/minItems).
 *
 * @param device - Optional device target for device-specific model filtering (PGMOD-04)
 * @param toneContext - Optional rig emulation context string appended to user message only.
 */
export async function callGeminiPlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
  family?: DeviceFamily,
  toneContext?: string,
): Promise<ToneIntent> {
  const ai = createGeminiClient();
  const effectiveDevice = device ?? "helix_lt";
  const caps = getCapabilities(effectiveDevice);
  const modelList = getModelListForPrompt(caps);
  const systemPrompt = getFamilyPlannerPrompt(effectiveDevice, modelList);

  // Window conversation to bound input tokens on long sessions.
  // Always preserve messages[0] (initial user request) for tone context.
  const MAX_PLANNER_MESSAGES = 10;
  const windowed =
    messages.length > MAX_PLANNER_MESSAGES
      ? [messages[0], ...messages.slice(-(MAX_PLANNER_MESSAGES - 1))]
      : messages;

  // Concatenate conversation history into a single user message
  const conversationText = windowed
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Append rig context to user message content only — NOT the system prompt.
  const userContent = toneContext
    ? `${conversationText}\n\n---\n\n${toneContext}`
    : conversationText;

  // Stomp cache unification: device-specific restriction goes in user message
  // so helix_stomp and helix_stomp_xl share a single system prompt cache entry.
  const resolvedFamily = family ?? "helix";
  let stompRestriction = "";
  if (resolvedFamily === "stomp") {
    const isXL = effectiveDevice === "helix_stomp_xl";
    const deviceLabel = isXL ? "HX Stomp XL" : "HX Stomp";
    const blocks = isXL ? STOMP_CONFIG.STOMP_XL_MAX_BLOCKS : STOMP_CONFIG.STOMP_MAX_BLOCKS;
    const snaps = isXL ? 4 : 3;
    const maxFx = 4; // Both Stomp and Stomp XL share same DSP, same 4 user-effect budget
    stompRestriction = `\n\nDEVICE RESTRICTION: This is an ${deviceLabel} preset. ${deviceLabel} is a single-DSP, series-only device. Do NOT populate secondAmpName or secondCabName. Generate exactly ${snaps} snapshots (not ${snaps === 3 ? "4" : "3"}, not 8). Keep effects to ${maxFx} maximum — ${deviceLabel} has ${blocks} block slots total (including amp + cab).`;
  }
  const finalUserContent = userContent + stompRestriction;

  const modelId = getModelId(false); // standard tier for planner
  const jsonSchema = buildGeminiJsonSchema(resolvedFamily);

  const response = await ai.models.generateContent({
    model: modelId,
    contents: finalUserContent,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema as Record<string, unknown>,
      maxOutputTokens: 2048, // ToneIntent JSON ~300-500 tokens; 2048 gives 4x safety margin
    },
  });

  // Token usage logging
  const usage = response.usageMetadata;
  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const cachedTokens = usage?.cachedContentTokenCount ?? 0;
  const totalTokens = usage?.totalTokenCount ?? (inputTokens + outputTokens);
  const costUsd = estimateGeminiCost(usage ?? {}, modelId);
  const cacheHit = cachedTokens > 0;

  // Always log to console — Vercel captures this in function logs
  console.log(
    `[planner] model=${modelId} tokens=${inputTokens}in/${outputTokens}out` +
    ` cache=${cacheHit ? "HIT" : "MISS"}(cached=${cachedTokens})` +
    ` cost=$${costUsd.toFixed(4)} device=${effectiveDevice}`
  );

  logUsage({
    timestamp: new Date().toISOString(),
    endpoint: "generate",
    model: modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_creation_input_tokens: null,
    cache_read_input_tokens: cachedTokens || null,
    total_tokens: totalTokens,
    cost_usd: costUsd,
    cache_hit: cacheHit,
    device: effectiveDevice,
  });

  // Extract text from response
  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned no text content");
  }

  // Sanitize before Zod validation.
  // Structured output may not enforce string length limits. We truncate
  // snapshot names here to avoid Zod rejecting valid-intent-but-too-long names.
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (parseError) {
    const errObj = parseError instanceof Error ? parseError : new Error(String(parseError));
    console.error("Gemini JSON Parse Error! Raw output was:", text);
    throw new Error(`JSON synthesis failed: ${errObj.message}. Raw text length: ${text.length}`);
  }

  if (Array.isArray(raw.snapshots)) {
    raw.snapshots = raw.snapshots.map((s: { name?: string; toneRole?: string }) => ({
      ...s,
      name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
    }));
  }

  // Strip invalid variaxModel before Zod validation — model occasionally
  // hallucinates model names (e.g., "Strat" instead of "Spank")
  if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
    delete raw.variaxModel;
  }

  // Belt-and-suspenders: Zod validates all remaining constraints
  return getToneIntentSchema(family ?? "helix").parse(raw);
}
