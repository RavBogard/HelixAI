// src/lib/families/shared/tone-intent-fields.ts
// Shared ToneIntent field description prompt section.
// Pure function returning prompt text with device-varying values interpolated.

/**
 * Options for generating the ToneIntent fields section.
 * Each family passes its own device-specific values.
 */
export interface ToneIntentFieldsOptions {
  /** Maximum number of effects (4 for PodGo/Stomp/StompXL, 8 for Helix/Stadium) */
  maxEffects: number;
  /** Number of snapshots (3/4/8 per device) */
  snapshots: number;
  /** Whether to include secondAmpName/secondCabName fields (true for Helix only) */
  includeSecondAmp: boolean;
  /** Maximum snapshot name length (default 10) */
  maxSnapNameLength?: number;
}

/**
 * Returns the ToneIntent field descriptions section for planner prompts.
 * Device-varying values (maxEffects, snapshots, includeSecondAmp) are interpolated
 * from the options parameter — no device-specific model names appear here.
 */
export function toneIntentFieldsSection(opts: ToneIntentFieldsOptions): string {
  const maxSnapLen = opts.maxSnapNameLength ?? 10;

  const secondAmpFields = opts.includeSecondAmp
    ? `- **secondAmpName** (OPTIONAL): A second amp from the AMPS list above. Use ONLY when the user explicitly requests two different amps (e.g., "clean Fender and heavy Mesa" or "switch between Vox and Marshall"). Leave empty for single-amp presets (the default). Convention: ampName = the amp for clean/crunch snapshots, secondAmpName = the amp for lead/ambient snapshots.
- **secondCabName** (OPTIONAL): Cab for the second amp. REQUIRED if secondAmpName is set. Choose a cab that complements the second amp.
`
    : "";

  return `## ToneIntent Fields

Generate a JSON object with these fields:

- **instrument**: "guitar" or "bass" — based on what instrument the user plays. Defaults to "guitar" if not specified. For bass, choose ONLY from bass amp/cab models (e.g., SV Beast, Agua, Cali Bass, Tuck n' Go).
- **ampName**: Exact name from the AMPS list above
- **cabName**: Exact name from the CABS list above
${secondAmpFields}- **guitarType**: "single_coil", "humbucker", or "p90" — based on what the user described (for bass: "single_coil" = J-style pickups, "humbucker" = P-style/soapbar pickups)
- **genreHint**: Optional genre or style description (e.g., "blues rock", "modern metal")
- **feelHint**: (OPTIONAL) The psychoacoustic "feel" or string tracking of the tubes. Choose "modern_metal" (tight/fast/cold), "texas_blues" (spongy/warm/vintage), "classic_rock" (slight crunch/complex), "ambient" (smooth/warm/lush), or "studio" (clear/articulate).
- **effects**: Array of up to ${opts.maxEffects} effects, each with:
  - modelName: exact name from DISTORTION, DELAY, REVERB, MODULATION, or DYNAMICS lists
  - role: "always_on" (core tone), "toggleable" (switched per snapshot), or "ambient" (pads/textures)
- **snapshots**: Exactly ${opts.snapshots} snapshots, each with:
  - name: display name (max ${maxSnapLen} characters, e.g., "CLEAN", "RHYTHM", "LEAD", "AMBIENT")
  - toneRole: "clean", "crunch", "lead", or "ambient"
- **snapshotTweaks**: (OPTIONAL) A map of snapshot names to relative parameter adjustments. Use this to turn static presets into dynamic, living rigs.
  - Outer keys MUST exactly match the names defined in the \`snapshots\` array.
  - Inner keys MUST be semantic parameters in the format \`[type]_[param]\`. Supported keys: \`amp_drive\`, \`amp_chvol\`, \`amp_master\`, \`amp_bass\`, \`amp_mid\`, \`amp_treble\`, \`amp_presence\`, \`delay_mix\`, \`delay_feedback\`, \`reverb_mix\`, \`reverb_decay\`.
  - Values MUST be integers between -100 and 100 representing percentage deltas relative to the base tone (e.g., 20 = +20%, -15 = -15%). Example: \`{ "LEAD": { "amp_drive": 25, "delay_mix": 15 }, "CLEAN": { "amp_drive": -20 } }\`.
- **tempoHint**: Optional BPM for delay sync (integer 60-200, useful if the user mentioned tempo or song)
- **delaySubdivision**: Optional note value for delay timing — "quarter", "dotted_eighth", "eighth", or "triplet". Use when the user requests a specific rhythmic delay (e.g., "dotted eighth delay" → "dotted_eighth"). Defaults to "quarter" if omitted. Requires tempoHint to take effect.
- **presetName**: A creative, descriptive preset name (max 32 characters)
- **description**: Brief tone description summarizing the preset character
- **guitarNotes**: Tips for the user — pickup position, tone knob, volume knob suggestions`;
}
