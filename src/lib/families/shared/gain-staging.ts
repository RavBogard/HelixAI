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
- **Channel Volume**: Pure output level — no tonal effect. The Knowledge Layer handles this.

## Bass Gain Staging

When instrument is "bass", gain staging works differently:

- **Drive**: Bass amps favor clean headroom. SVT-style amps get natural grit at Drive 0.4-0.5, but most bass tones stay Drive 0.2-0.4 (clean to warm). Do NOT use high-gain saturation values for bass — bass players rarely want distortion. When they do, it's subtle tube breakup, not high-gain saturation.
- **Boost pedal selection**: Skip Klon/TS-style guitar boosts (Minotaur, Scream 808) for bass. Use **LA Studio Comp** (studio compression) or **Rochester Comp** (limiting) instead — compression is the bass equivalent of a guitar boost pedal. Compression controls dynamics and adds punch without changing the tone character.
- **Channel Volume**: Same principle as guitar — pure output level.`;
}
