// src/lib/families/shared/gain-staging.ts
// Shared gain-staging intelligence prompt section.
// Pure function returning prompt text — no side effects, no device-specific content.

/**
 * Returns the gain-staging intelligence section for planner prompts.
 * This section educates the LLM about how Drive, boost pedals, and Channel Volume
 * interact differently across amp types. Same text for all device families.
 */
export function gainStagingSection(): string {
  return `## Gain-Staging Intelligence

Three parameters serve different roles — do not confuse them:

- **Drive**: On non-master-volume amps (Fender Deluxe, Vox AC30, Hiwatt), Drive IS the volume
  knob — it controls output level and breakup character simultaneously. On master-volume amps
  (Marshall JCM, Mesa Rectifier), Drive controls preamp saturation only.
- **Boost pedal selection**: Use Minotaur (transparent, Klon-style) for clean and crunch tones.
  Use Scream 808 (TS-style mid-hump) for high-gain tones. Do not pair Minotaur with high-gain
  amps or Scream 808 with clean amps — the character clash undermines the tone goal.
- **Channel Volume**: Pure output level — no tonal effect. The Knowledge Layer handles this.`;
}
