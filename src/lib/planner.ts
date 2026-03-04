// src/lib/planner.ts
// Claude Planner module — generates ToneIntents via structured output.
// The Planner makes creative choices only (amp, cab, effects, snapshots).
// All numeric parameters are handled by the Knowledge Layer (Phase 2).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ToneIntentSchema, getModelListForPrompt, isPodGo, isStadium } from "@/lib/helix";
import type { ToneIntent, DeviceTarget } from "@/lib/helix";

/**
 * Build the Planner system prompt.
 *
 * The prompt is narrow: creative model choices only, zero numeric parameter values.
 * The modelList parameter comes from getModelListForPrompt() and contains
 * all valid amp, cab, and effect model names (filtered by device target).
 */
export function buildPlannerPrompt(modelList: string, device?: DeviceTarget): string {
  const podGo = device ? isPodGo(device) : false;
  const stadium = device ? isStadium(device) : false;
  const deviceName = podGo ? "Pod Go" : stadium ? "Helix Stadium" : device === "helix_floor" ? "Helix Floor" : "Helix LT";
  const maxEffects = podGo ? 4 : 6;
  const effectNote = podGo
    ? "- Keep effects to 2-4 maximum — Pod Go has a 4 user-effect limit and limited DSP"
    : "- Keep effects minimal: 2-4 is typical, 6 is the maximum";

  return `You are HelixAI's Planner. You choose creative model selections for ${deviceName} presets.

## Your Role

You translate a tone interview conversation into a ToneIntent — a structured set of creative choices. You select WHICH amp, cab, and effects to use. You do NOT set any numeric parameter values. The Knowledge Layer handles all parameters using expert-validated lookup tables.

## Valid Model Names

Use ONLY these exact model names. Any name not in this list will be rejected by schema validation.

${modelList}

## ToneIntent Fields

Generate a JSON object with these fields:

- **ampName**: Exact name from the AMPS list above
- **cabName**: Exact name from the CABS list above
- **secondAmpName** (OPTIONAL): A second amp from the AMPS list above. Use ONLY when the user explicitly requests two different amps (e.g., "clean Fender and heavy Mesa" or "switch between Vox and Marshall"). Leave empty for single-amp presets (the default). Convention: ampName = the amp for clean/crunch snapshots, secondAmpName = the amp for lead/ambient snapshots.
- **secondCabName** (OPTIONAL): Cab for the second amp. REQUIRED if secondAmpName is set. Choose a cab that complements the second amp.
- **guitarType**: "single_coil", "humbucker", or "p90" — based on what the user described
- **genreHint**: Optional genre or style description (e.g., "blues rock", "modern metal")
- **effects**: Array of up to ${maxEffects} effects, each with:
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
${effectNote}
- Name snapshots clearly following the CLEAN / RHYTHM / LEAD / AMBIENT pattern
- Set each snapshot's toneRole to match its purpose
- Generate a creative preset name that captures the tone character
- If relevant, suggest guitar setup tips (bridge vs. neck pickup, tone knob position)

## Dual-Amp Rules

- Dual-amp uses split/join topology — consumes 4 extra DSP0 slots (split + amp2 + cab2 + join)
- For dual-amp presets, limit pre-amp effects to 2 maximum (DSP budget is tighter)
- ampName handles clean/crunch snapshots; secondAmpName handles lead/ambient snapshots
- NEVER use secondAmpName for Pod Go — Pod Go is single-DSP, series-only hardware
${podGo ? "\n**DEVICE RESTRICTION: This is a Pod Go preset. Pod Go does NOT support dual-amp. Do NOT populate secondAmpName or secondCabName.**\n" : ""}${stadium ? "\n**DEVICE RESTRICTION: This is a Helix Stadium preset. Use only Stadium-compatible model names (Agoura_* amps, P35_* I/O). Stadium preset generation is in preview — keep the signal chain simple (single amp, 4 effects maximum).**\n" : ""}
Based on the conversation below, generate a ToneIntent:`;
}

/**
 * Call Claude Planner to generate a ToneIntent from conversation history.
 *
 * Uses structured output (output_config with zodOutputFormat) so Claude's
 * constrained decoding guarantees valid JSON matching ToneIntentSchema.
 * Belt-and-suspenders: Zod validates the response after parsing to catch
 * any constraints that JSON Schema cannot express (min/max/minItems).
 *
 * @param device - Optional device target for device-specific model filtering (PGMOD-04)
 * @param toneContext - Optional rig emulation context string appended to user message only.
 *   Appended to the USER message (not the system prompt) to preserve prompt caching.
 *   The system prompt hash is unchanged; cache_control: ephemeral remains effective.
 */
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
  toneContext?: string,
): Promise<ToneIntent> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY environment variable is required");

  const client = new Anthropic({ apiKey });
  const modelList = getModelListForPrompt(device);
  const systemPrompt = buildPlannerPrompt(modelList, device);

  // Concatenate conversation history into a single user message
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Append rig context to user message content only — NOT the system prompt.
  // This preserves prompt caching: the system prompt hash is unchanged because
  // buildPlannerPrompt() is called with the same arguments regardless of toneContext.
  const userContent = toneContext
    ? `${conversationText}\n\n---\n\n${toneContext}`
    : conversationText;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: zodOutputFormat(ToneIntentSchema),
    },
  });

  // Extract text from response content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // Sanitize before Zod validation.
  // zodOutputFormat strips min/max constraints from JSON Schema, so Claude's
  // constrained decoding does NOT enforce string length limits. We truncate
  // snapshot names here to avoid Zod rejecting valid-intent-but-too-long names
  // (e.g., "CLEAN CHIME" → "CLEAN CHIM", "AMBIENT PAD" → "AMBIENT PA").
  const raw = JSON.parse(textBlock.text);
  if (Array.isArray(raw.snapshots)) {
    raw.snapshots = raw.snapshots.map((s: { name?: string; toneRole?: string }) => ({
      ...s,
      name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
    }));
  }

  // Belt-and-suspenders: Zod validates all remaining constraints
  return ToneIntentSchema.parse(raw);
}
