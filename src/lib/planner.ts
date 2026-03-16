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
import type { ToneIntent, DeviceTarget, DeviceFamily, GearBlueprint } from "@/lib/helix";
import { logUsage, estimateGeminiCost } from "@/lib/usage-logger";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";
import { HISTORIAN_SYSTEM_PROMPT } from "@/lib/families/shared/historian-prompt";

/**
 * Repairs broken JSON where Gemini outputs unescaped literal newlines inside a string value.
 */
function escapeLiteralNewlinesInJson(str: string): string {
  let insideString = false;
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    // Toggle state when we see an unescaped double quote
    if (char === '"' && (i === 0 || str[i - 1] !== '\\')) {
      insideString = !insideString;
    }
    
    if (insideString && char === '\n') {
      result += '\\n';
    } else if (insideString && char === '\r') {
      // Just drop carriage returns inside strings to avoid weird formatting
    } else {
      result += char;
    }
  }
  return result;
}

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
  requiredSchemas?: string[]
): Promise<ToneIntent> {
  const ai = createGeminiClient();
  const effectiveDevice = device ?? "helix_lt";
  const caps = getCapabilities(effectiveDevice);
  const modelList = getModelListForPrompt(caps, requiredSchemas);
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

  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: finalUserContent,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: jsonSchema,
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
      const finishReason = response.candidates?.[0]?.finishReason || "UNKNOWN";

      // Always log to console — Vercel captures this in function logs
      console.log(
        `[planner] attempt=${attempt} model=${modelId} finish=${finishReason} tokens=${inputTokens}in/${outputTokens}out` +
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

      const text = response.text;
      if (!text) {
        throw new Error("Gemini returned no text content");
      }
      
      let raw;
      try {
        const sanitized = escapeLiteralNewlinesInJson(text);
        raw = JSON.parse(sanitized);
      } catch (parseError) {
        console.error("JSON PARSE FAILED. RAW TEXT:", text);
        // Fallback: attempted regex extraction for unescaped gemini markdown wrappers
        const match = text.match(/```(?:json)?\r?\n([\s\S]*?)\r?\n```/);
        if (match) {
          try {
            raw = JSON.parse(match[1]);
          } catch {
             throw parseError; // throw original
          }
        } else {
          throw parseError; // throw original
        }
      }

      if (Array.isArray(raw.snapshots)) {
        raw.snapshots = raw.snapshots.map((s: { name?: string; toneRole?: string }) => ({
          ...s,
          name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
        }));
      }

      if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
        delete raw.variaxModel;
      }

      return getToneIntentSchema(family ?? "helix").parse(raw);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Gemini generation failed on attempt ${attempt}/${MAX_RETRIES}:`, lastError.message);
      if (attempt === MAX_RETRIES) {
        console.warn(`Planner failed all ${MAX_RETRIES} attempts. Delivering fallback generic preset to prevent 500 crash.`);
        return {
          ampName: "US Double Nrm",
          cabName: "1x12 US Deluxe",
          guitarType: "humbucker",
          genreHint: "Generic Clean",
          effects: [],
          snapshots: [
            { name: "CLEAN", toneRole: "clean" },
            { name: "RHYTHM", toneRole: "crunch" },
            { name: "LEAD", toneRole: "lead" }
          ],
        } as ToneIntent;
      }
      // Brief backoff before next attempt
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }

  // TypeScript requires a return here although the fallback above conceptually handles it
  throw lastError;
}

export async function callGeminiHistorian(
  messages: Array<{ role: string; content: string }>
): Promise<GearBlueprint> {
  const ai = createGeminiClient();
  const modelId = "gemini-3-flash-preview"; // Reverting to 3-flash-preview per user request

  // Window conversation: take the last 4 messages to keep token usage lean for the Historian
  const MAX_HISTORIAN_MESSAGES = 4;
  const windowed = messages.length > MAX_HISTORIAN_MESSAGES
    ? messages.slice(-MAX_HISTORIAN_MESSAGES)
    : messages;

  const conversationText = windowed
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const jsonSchema = {
    type: "object",
    properties: {
      songTarget: { type: "string" },
      ampEra: { type: "string" },
      recommendedAmp: { type: "string" },
      recommendedCab: { type: "string" },
      mandatoryCoreEffects: { type: "array", items: { type: "string" } },
      optionalSweeteners: { type: "array", items: { type: "string" } },
      requiredSchemas: { 
        type: "array", 
        items: { type: "string", enum: ["distortion", "dynamics", "eq", "modulation", "delay", "reverb", "pitch", "filter", "wah", "volume_pan"] } 
      },
      bpm: { type: "integer" },
      delaySubdivision: { type: "string", enum: ["quarter", "eighth", "dotted_eighth", "triplet", "none"] },
      historianNotes: { type: "string" },
    },
    required: ["songTarget", "ampEra", "mandatoryCoreEffects", "optionalSweeteners", "requiredSchemas", "bpm", "delaySubdivision", "historianNotes"],
  };

  const response = await ai.models.generateContent({
    model: modelId,
    contents: conversationText,
    config: {
      systemInstruction: HISTORIAN_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseSchema: jsonSchema,
    },
  });

  const usage = response.usageMetadata;
  const costUsd = estimateGeminiCost(usage ?? {}, modelId);
  console.log(
    `[historian] model=${modelId} finish=${response.candidates?.[0]?.finishReason} tokens=${usage?.promptTokenCount ?? 0}in/${usage?.candidatesTokenCount ?? 0}out` +
    ` cost=$${costUsd.toFixed(4)}`
  );

  const text = response.text;
  if (!text) throw new Error("Historian returned no text content");
  
  console.log("=== STRINGIFIED HISTORIAN TEXT ===");
  console.log(JSON.stringify(text));
  console.log("==================================");

  let raw;
  try {
    const sanitized = escapeLiteralNewlinesInJson(text);
    raw = JSON.parse(sanitized);
  } catch (parseError) {
    console.warn("Historian JSON parse failed, attempting regex extraction...");
    const match = text.match(/```(?:json)?\r?\n([\s\S]*?)\r?\n```/);
    if (match) {
      try {
        raw = JSON.parse(match[1]);
      } catch (e) {
        console.error("Regex extracted text also failed to parse:", match[1]);
        throw e;
      }
    } else {
      throw parseError; // Rethrow if regex fails
    }
  }

  return raw as GearBlueprint;
}
