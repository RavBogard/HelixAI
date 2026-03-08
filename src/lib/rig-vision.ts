// src/lib/rig-vision.ts
// Server-side module: Gemini vision call + JSON extraction for pedal identification.
// Imported ONLY by src/app/api/vision/route.ts — NOT by any client component.
//
// Architecture: The route receives base64 images from the client, calls this module,
// and returns { rigIntent: RigIntent }. The client (page.tsx) handles compression
// and the fetch call; this module handles the Gemini SDK interaction.

import { createGeminiClient, getModelId } from "@/lib/gemini";
import { RigIntentSchema } from "@/lib/helix";
import type { RigIntent } from "@/lib/helix";
import { logUsage, estimateGeminiCost } from "@/lib/usage-logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One image ready to send to the Gemini vision API. */
export interface VisionImage {
  /** Raw base64 string — NO "data:image/...;base64," prefix. */
  data: string;
  /** MIME type — validated by the route before reaching this module. */
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const VISION_SYSTEM_PROMPT = `You are a guitar pedal identification assistant.

Your job is to analyze photos of guitar effect pedals and return structured JSON describing each pedal's make, model, and knob positions.

## Rules

1. Return ONLY a valid JSON object — no prose, no markdown, no explanation before or after.
2. If you cannot clearly identify a pedal's make and model from the image (text is not legible, image is too blurry, object is not a guitar pedal), set brand to "", model to "", fullName to "", and confidence to "low".
3. Use coarse zone labels for knob positions: "low" (roughly 7-9 o'clock), "medium-low" (roughly 9-11 o'clock), "medium-high" (roughly 1-3 o'clock), "high" (roughly 3-5 o'clock). Use 12 o'clock as the boundary between medium-low and medium-high.
4. Do not guess a specific model name if the label text is not clearly legible. It is better to return confidence "low" with an honest note than to guess a wrong model name.
5. If the photo does not appear to show a guitar pedal at all, return an empty pedals array.

## JSON Schema to return

{
  "pedals": [
    {
      "brand": "string — e.g. 'Boss', 'Ibanez', 'Electro-Harmonix'. Empty string if not legible.",
      "model": "string — e.g. 'TS9', 'SD-1', 'Big Muff Pi'. Empty string if not legible.",
      "fullName": "string — brand + model combined, e.g. 'Ibanez TS9 Tube Screamer'. Empty string if not legible.",
      "knobPositions": {
        "<knob label as printed on pedal>": "<low|medium-low|medium-high|high>"
      },
      "imageIndex": "number — 0-indexed, which image this pedal came from",
      "confidence": "high|medium|low"
    }
  ],
  "extractionNotes": "string — optional, describe any ambiguities, multiple pedals in one photo, or identification challenges"
}

## Confidence Guidelines

- high: brand and model text is clearly legible; knob positions are visible and unambiguous
- medium: brand or model is partially legible; knob positions are estimable but not certain
- low: cannot read brand/model text, or image quality/angle prevents reliable identification`;

// ---------------------------------------------------------------------------
// JSON Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the first valid JSON object from a Gemini text response.
 *
 * Strategy 1: Direct parse — optimal path when Gemini follows the system prompt
 *             and returns raw JSON with no surrounding text.
 * Strategy 2: JSON code fence — extracts content from ```json ... ``` blocks.
 * Strategy 3: Bare object — finds first { to last } and parses that substring.
 *
 * Throws if all three strategies fail.
 */
export function extractJson(text: string): unknown {
  // Strategy 1: direct parse (no prose)
  try {
    return JSON.parse(text.trim());
  } catch {
    // continue to strategy 2
  }

  // Strategy 2: JSON code fence
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // continue to strategy 3
    }
  }

  // Strategy 3: bare object — first { to last }
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch {
      // continue to throw
    }
  }

  throw new Error("Could not extract JSON from vision response");
}

// ---------------------------------------------------------------------------
// Main Export
// ---------------------------------------------------------------------------

/**
 * Call Gemini with vision to extract pedal information from images.
 *
 * Sends base64 images via Gemini's inlineData content format and extracts
 * structured JSON from the text response. JSON is validated with
 * RigIntentSchema.parse().
 *
 * @param images - Array of compressed, base64-encoded images (max 3)
 * @returns Parsed and validated RigIntent
 */
export async function callRigVisionPlanner(
  images: VisionImage[]
): Promise<RigIntent> {
  const ai = createGeminiClient();
  const modelId = getModelId(false); // standard tier — gemini-2.5-flash

  const response = await ai.models.generateContent({
    model: modelId,
    contents: [
      {
        role: "user",
        parts: [
          ...images.flatMap((img, i) => [
            { text: `Pedal photo ${i + 1}:` },
            { inlineData: { mimeType: img.mediaType, data: img.data } },
          ]),
          {
            text: `Analyze the ${images.length} pedal photo(s) above. For each pedal you can identify, return one entry in the pedals array. If multiple pedals appear in a single photo, return one entry per pedal with the same imageIndex. Return only the JSON object — no other text.`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: VISION_SYSTEM_PROMPT,
      maxOutputTokens: 1024,
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

  console.log(
    `[vision] model=${modelId} tokens=${inputTokens}in/${outputTokens}out` +
    ` cache=${cacheHit ? "HIT" : "MISS"}(cached=${cachedTokens})` +
    ` cost=$${costUsd.toFixed(4)}`
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
    device: undefined,
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini vision returned no text content");
  }

  const raw = extractJson(text);
  return RigIntentSchema.parse(raw);
}
