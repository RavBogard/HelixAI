// src/lib/planner.ts
// Claude Planner module — generates ToneIntents via structured output.
// The Planner makes creative choices only (amp, cab, effects, snapshots).
// All numeric parameters are handled by the Knowledge Layer (Phase 2).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getToneIntentSchema, getModelListForPrompt, isPodGo, isStadium, isStomp, AMP_MODELS, VARIAX_MODEL_NAMES } from "@/lib/helix";
import { STOMP_CONFIG } from "@/lib/helix/config";
import type { ToneIntent, DeviceTarget, DeviceFamily } from "@/lib/helix";
import { logUsage, estimateClaudeCost } from "@/lib/usage-logger";

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
  const stomp = device ? isStomp(device) : false;
  const isStompXL = device === "helix_stomp_xl";
  const deviceName = podGo ? "Pod Go"
    : stadium ? "Helix Stadium"
    : device === "helix_floor" ? "Helix Floor"
    : stomp ? (isStompXL ? "HX Stomp XL" : "HX Stomp")
    : "Helix LT";
  const maxEffects = podGo ? 4 : stomp ? (isStompXL ? 6 : 4) : 6;
  const snapshotCount = stomp
    ? (isStompXL ? STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS : STOMP_CONFIG.STOMP_MAX_SNAPSHOTS)
    : 4;
  const effectNote = podGo
    ? "- Keep effects to 2-4 maximum — Pod Go has a 4 user-effect limit and limited DSP"
    : "- Keep effects minimal: 2-4 is typical, 6 is the maximum";

  // Build per-model cab affinity section grouped by ampFamily (INT-01)
  // Only include amps with cabAffinity defined; group by ampFamily for readability.
  // Generated at prompt build time — static text, no device interpolations, cache-safe.
  const cabAffinityByFamily = new Map<string, string[]>();
  for (const [ampName, model] of Object.entries(AMP_MODELS)) {
    if (!model.cabAffinity || model.cabAffinity.length === 0) continue;
    const family = model.ampFamily ?? "Other";
    if (!cabAffinityByFamily.has(family)) {
      cabAffinityByFamily.set(family, []);
    }
    cabAffinityByFamily.get(family)!.push(`- ${ampName} → ${model.cabAffinity.join(", ")}`);
  }
  // Sort families alphabetically, keep "Other" last
  const sortedFamilies = Array.from(cabAffinityByFamily.keys()).sort((a, b) => {
    if (a === "Other") return 1;
    if (b === "Other") return -1;
    return a.localeCompare(b);
  });
  const cabAffinitySection = [
    "\n## Per-Model Cab Affinity",
    "",
    "When choosing a cab, prefer the model-specific recommendations below over the family-level table above.",
    "These are the manufacturer-matched cab pairings verified for each amp:",
    "",
    ...sortedFamilies.flatMap(family => [
      `**${family}**`,
      ...cabAffinityByFamily.get(family)!,
      "",
    ]),
  ].join("\n");

  return `You are HelixTones' Planner. You choose creative model selections for ${deviceName} presets.

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
- **snapshots**: Exactly ${snapshotCount} snapshots, each with:
  - name: display name (max 10 characters, e.g., "CLEAN", "RHYTHM", "LEAD", "AMBIENT")
  - toneRole: "clean", "crunch", "lead", or "ambient"
- **tempoHint**: Optional BPM for delay sync (integer, useful if the user mentioned tempo or song)
- **presetName**: A creative, descriptive preset name (max 32 characters)
- **description**: Brief tone description summarizing the preset character
- **guitarNotes**: Tips for the user — pickup position, tone knob, volume knob suggestions
- **variaxModel** (OPTIONAL): If and ONLY if the user mentioned a Variax guitar (JTV-69, JTV-89, Standard, Shuriken, etc.) in conversation, set this to their preferred Variax tone model. Valid values: ${VARIAX_MODEL_NAMES.map(n => `"${n}"`).join(", ")}. Choose the model that best matches the described tone goal. Leave EMPTY if no Variax was mentioned — NEVER ask about Variax unprompted.

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
- NEVER use secondAmpName for HX Stomp or HX Stomp XL — they are single-DSP, series-only devices

## Gain-Staging Intelligence

Three parameters serve different roles — do not confuse them:

- **Drive**: On non-master-volume amps (Fender Deluxe, Vox AC30, Hiwatt), Drive IS the volume
  knob — it controls output level and breakup character simultaneously. On master-volume amps
  (Marshall JCM, Mesa Rectifier), Drive controls preamp saturation only.
- **Boost pedal selection**: Use Minotaur (transparent, Klon-style) for clean and crunch tones.
  Use Scream 808 (TS-style mid-hump) for high-gain tones. Do not pair Minotaur with high-gain
  amps or Scream 808 with clean amps — the character clash undermines the tone goal.
- **Channel Volume**: Pure output level — no tonal effect. The Knowledge Layer handles this.

## Amp-to-Cab Pairing

Pair amps with historically correct cabs. Match the amp's era and speaker voicing:

| Amp Family | Recommended Cabs |
|------------|-----------------|
| Fender Deluxe / Vibrolux / Twin | 1x12 US Deluxe, 2x12 Double C12N |
| Fender Bassman / Tweed | 4x10 Tweed P10R, 1x12 Fullerton |
| Vox AC30 / AC15 | 2x12 Blue Bell, 1x12 Blue Bell |
| Marshall Plexi | 4x12 Greenback25, 4x12 Greenback20 |
| Marshall JCM800 / JVM | 4x12 Brit V30, 4x12 Greenback25 |
| Mesa Boogie Mark / Rectifier | 4x12 Cali V30, 4x12 XXL V30 |
| Bogner / Friedman / Diezel / 5150 | 4x12 XXL V30, 4x12 Uber V30 |
| Matchless DC-30 | 2x12 Match H30 |

If the requested tone doesn't fit a row above, choose a cab with matching era and speaker voicing.
${cabAffinitySection}
## Effect Discipline by Genre

Choose effects that serve the tone goal — do not fill slots for the sake of variety:

- **Metal / hard rock**: Maximum 3 effects. Optional delay at low mix. Do NOT include reverb
  or modulation on metal tones.
- **Blues / classic rock / country**: 2-3 effects. Delay and reverb are typical; optional
  vibrato or light chorus.
- **Jazz / fusion**: 1-2 effects maximum. Light reverb only; no delay unless requested.
- **Ambient / worship**: 4-5 effects expected. MUST include at least one reverb AND one delay.
  Modulation (shimmer, chorus, vibrato) is appropriate. Avoid heavy drive/distortion.
- **Pop / funk**: 2-3 effects. Chorus or phaser is appropriate; keep delay mix low.

For ambient and worship tones: if no reverb or delay is in the effects list, the preset will
fail its tone goal — always include time-based effects for these genres.

${podGo ? "\n**DEVICE RESTRICTION: This is a Pod Go preset. Pod Go does NOT support dual-amp. Do NOT populate secondAmpName or secondCabName.**\n" : ""}${stadium ? "\n**DEVICE RESTRICTION: This is a Helix Stadium preset. Use only Stadium-compatible model names (Agoura_* amps, P35_* I/O). Stadium preset generation is in preview — keep the signal chain simple (single amp, 4 effects maximum).**\n" : ""}${stomp ? `\n**DEVICE RESTRICTION: This is an ${deviceName} preset. ${deviceName} is a single-DSP, series-only device. Do NOT populate secondAmpName or secondCabName. Generate exactly ${snapshotCount} snapshots (not 4).${!isStompXL ? " Keep effects to 2-4 maximum — HX Stomp has limited DSP and only 6 block slots total (including amp + cab)." : " Keep effects to 4-6 maximum — HX Stomp XL has 9 block slots total."}\n` : ""}
Based on the conversation below, generate a ToneIntent:`;
}

/**
 * Call Claude Planner to generate a ToneIntent from conversation history.
 *
 * Uses structured output (output_config with zodOutputFormat) so Claude's
 * constrained decoding guarantees valid JSON matching the family-specific ToneIntent schema.
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
  family?: DeviceFamily,
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
        cache_control: { type: "ephemeral" as const, ttl: "1h" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: zodOutputFormat(getToneIntentSchema(family ?? "helix")),
    },
  });

  // Token usage logging (AUDIT-01)
  const { usage } = response;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd = estimateClaudeCost(usage);
  const cacheHit = cacheRead > 0;

  // Always log to console — Vercel captures this in function logs
  console.log(
    `[planner] tokens=${usage.input_tokens}in/${usage.output_tokens}out` +
    ` cache=${cacheHit ? "HIT" : "MISS"}(read=${cacheRead},write=${cacheWrite})` +
    ` cost=$${costUsd.toFixed(4)} device=${device ?? "helix_floor"}`
  );

  logUsage({
    timestamp: new Date().toISOString(),
    endpoint: "generate",
    model: "claude-sonnet-4-6",
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: cacheWrite || null,
    cache_read_input_tokens: cacheRead || null,
    total_tokens: usage.input_tokens + usage.output_tokens,
    cost_usd: costUsd,
    cache_hit: cacheHit,
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

  // Strip invalid variaxModel before Zod validation — Claude occasionally
  // hallucinates model names (e.g., "Strat" instead of "Spank")
  if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
    delete raw.variaxModel;
  }

  // Belt-and-suspenders: Zod validates all remaining constraints
  return getToneIntentSchema(family ?? "helix").parse(raw);
}
