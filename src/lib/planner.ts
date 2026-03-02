// src/lib/planner.ts
// Claude Planner module — generates ToneIntents via structured output.
// The Planner makes creative choices only (amp, cab, effects, snapshots).
// All numeric parameters are handled by the Knowledge Layer (Phase 2).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ToneIntentSchema, getModelListForPrompt } from "@/lib/helix";
import type { ToneIntent } from "@/lib/helix";

/**
 * Build the Planner system prompt.
 *
 * The prompt is narrow: creative model choices only, zero numeric parameter values.
 * The modelList parameter comes from getModelListForPrompt() and contains
 * all valid amp, cab, and effect model names.
 */
export function buildPlannerPrompt(modelList: string): string {
  return `You are HelixAI's Planner. You choose creative model selections for Helix LT presets.

## Your Role

You translate a tone interview conversation into a ToneIntent — a structured set of creative choices. You select WHICH amp, cab, and effects to use. You do NOT set any numeric parameter values. The Knowledge Layer handles all parameters using expert-validated lookup tables.

## Valid Model Names

Use ONLY these exact model names. Any name not in this list will be rejected by schema validation.

${modelList}

## ToneIntent Fields

Generate a JSON object with these fields:

- **ampName**: Exact name from the AMPS list above
- **cabName**: Exact name from the CABS list above
- **guitarType**: "single_coil", "humbucker", or "p90" — based on what the user described
- **genreHint**: Optional genre or style description (e.g., "blues rock", "modern metal")
- **effects**: Array of up to 6 effects, each with:
  - modelName: exact name from DISTORTION, DELAY, REVERB, MODULATION, or DYNAMICS lists
  - role: "always_on" (core tone), "toggleable" (switched per snapshot), or "ambient" (pads/textures)
- **snapshots**: Exactly 4 snapshots, each with:
  - name: display name (max 10 characters, e.g., "CLEAN", "RHYTHM", "LEAD", "AMBIENT")
  - toneRole: "clean", "crunch", "lead", or "ambient"
- **tempoHint**: Optional BPM for delay sync (integer, useful if the user mentioned tempo or song)
- **presetName**: A creative, descriptive preset name (max 32 characters)
- **description**: Brief tone description summarizing the preset character
- **guitarNotes**: Tips for the user — pickup position, tone knob, volume knob suggestions

## What You Do NOT Generate

Do NOT generate Drive, Master, Bass, Mid, Treble, Presence, Sag, ChVol, LowCut, HighCut, Mic, Distance, Angle, EQ gains, delay Mix, reverb Mix, or ANY numeric parameter values. The Knowledge Layer sets all of these automatically based on your model selections.

## Creative Guidelines

- Match the amp and cab to the genre, artist, or tone the user described
- Choose a cab that pairs naturally with the amp (similar era and voicing)
- Pick effects that serve the described tone goal — do not add effects for the sake of filling slots
- Keep effects minimal: 2-4 is typical, 6 is the maximum
- Name snapshots clearly following the CLEAN / RHYTHM / LEAD / AMBIENT pattern
- Set each snapshot's toneRole to match its purpose
- Generate a creative preset name that captures the tone character
- If relevant, suggest guitar setup tips (bridge vs. neck pickup, tone knob position)

Based on the conversation below, generate a ToneIntent:`;
}

/**
 * Call Claude Planner to generate a ToneIntent from conversation history.
 *
 * Uses structured output (output_config with zodOutputFormat) so Claude's
 * constrained decoding guarantees valid JSON matching ToneIntentSchema.
 * Belt-and-suspenders: Zod validates the response after parsing to catch
 * any constraints that JSON Schema cannot express (min/max/minItems).
 */
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>
): Promise<ToneIntent> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY environment variable is required");

  const client = new Anthropic({ apiKey });
  const modelList = getModelListForPrompt();
  const systemPrompt = buildPlannerPrompt(modelList);

  // Concatenate conversation history into a single user message
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: conversationText }],
    output_config: {
      format: zodOutputFormat(ToneIntentSchema),
    },
  });

  // Extract text from response content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // Belt-and-suspenders: parse with Zod to validate all constraints
  // (zodOutputFormat strips min/max from JSON Schema; Zod validates them after)
  return ToneIntentSchema.parse(JSON.parse(textBlock.text));
}
