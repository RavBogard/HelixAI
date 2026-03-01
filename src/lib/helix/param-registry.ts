// src/lib/helix/param-registry.ts
// Single source of truth for Helix parameter encoding types.
// Derived from direct inspection of 15 real HX Edit .hlx exports (2026-03-01).
//
// Key findings:
//   LowCut/HighCut on cab blocks = raw Hz (19.9-20100.0). NOT normalized 0-1.
//   Mic on cab blocks = integer index (0-15, observed up to 11 in real files).
//   All amp/effect controls (Drive, Master, Sag, Mix, etc.) = normalized 0.0-1.0.
//   Gain on VolPanGain block = dB value (-20.0 to +20.0). Different from normalized gain on effects.

export type ParamType =
  | "normalized_float"  // 0.0 to 1.0 — the default for amp/effect controls
  | "hz_value"          // raw Hz — ONLY LowCut and HighCut on cab blocks
  | "integer_index"     // integer starting at 0 — mic selections, mode switches
  | "db_value"          // dB float — Gain parameter on VolPanGain blocks
  | "bpm"               // beats per minute integer — tempo fields
  | "boolean_int";      // 0 or 1 stored as number

export const PARAM_TYPE_REGISTRY: Readonly<Record<string, ParamType>> = {
  // Cab Hz values — NOT normalized 0-1 (this is the most impactful encoding difference)
  LowCut: "hz_value",
  HighCut: "hz_value",

  // Cab integer indices
  Mic: "integer_index",

  // Amp normalized floats (0.0 to 1.0)
  Drive: "normalized_float",
  Bass: "normalized_float",
  Mid: "normalized_float",
  Treble: "normalized_float",
  Master: "normalized_float",
  ChVol: "normalized_float",
  Presence: "normalized_float",
  Resonance: "normalized_float",
  Sag: "normalized_float",
  Hum: "normalized_float",
  Ripple: "normalized_float",
  Bias: "normalized_float",
  BiasX: "normalized_float",
  Cut: "normalized_float",       // Vox-style tone cut control
  BrightSwitch: "boolean_int",   // JC-120 bright switch (0 or 1)
  Deep: "normalized_float",      // Diezel depth control

  // Effect normalized floats
  Mix: "normalized_float",
  Feedback: "normalized_float",
  Depth: "normalized_float",
  Speed: "normalized_float",
  Intensity: "normalized_float",
  Tone: "normalized_float",
  Level: "normalized_float",
  Output: "normalized_float",
  Volume: "normalized_float",

  // VolPanGain dB — NOT the same as normalized gain on effects
  Gain: "db_value",

  // Tempo
  "@tempo": "bpm",
} as const;
