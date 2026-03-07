// UI parameter schema registry for the v7.0 visualizer parameter editor.
// Maps parameter keys to their control types with human-readable display transforms.
// Consumed by ParameterEditorPane (Plan 80-02) to render schema-driven controls.

import { getAllModels, type HelixModel } from "@/lib/helix/models";

// ---------------------------------------------------------------------------
// Schema Types
// ---------------------------------------------------------------------------

export type SchemaType =
  | "percentage"
  | "eq_gain"
  | "db_level"
  | "time_ms"
  | "hz_freq"
  | "boolean"
  | "discrete";

export interface ParameterSchemaDef {
  type: SchemaType;
  min: number;
  max: number;
  step: number;
  unit: string;
  displayMultiplier: number;
  displayOffset: number;
  options?: string[];
}

// ---------------------------------------------------------------------------
// Schema Presets (reusable definitions for common types)
// ---------------------------------------------------------------------------

const PERCENTAGE: ParameterSchemaDef = {
  type: "percentage",
  min: 0,
  max: 100,
  step: 1,
  unit: "%",
  displayMultiplier: 100,
  displayOffset: 0,
};

const EQ_GAIN: ParameterSchemaDef = {
  type: "eq_gain",
  min: -12,
  max: 12,
  step: 0.1,
  unit: "dB",
  displayMultiplier: 24,
  displayOffset: -12,
};

const DB_LEVEL: ParameterSchemaDef = {
  type: "db_level",
  min: -60,
  max: 12,
  step: 0.1,
  unit: "dB",
  displayMultiplier: 1,
  displayOffset: 0,
};

const TIME_MS: ParameterSchemaDef = {
  type: "time_ms",
  min: 0,
  max: 2000,
  step: 1,
  unit: "ms",
  displayMultiplier: 2000,
  displayOffset: 0,
};

const HZ_FREQ: ParameterSchemaDef = {
  type: "hz_freq",
  min: 20,
  max: 20000,
  step: 1,
  unit: "Hz",
  displayMultiplier: 19980,
  displayOffset: 20,
};

const BOOLEAN_SCHEMA: ParameterSchemaDef = {
  type: "boolean",
  min: 0,
  max: 1,
  step: 1,
  unit: "",
  displayMultiplier: 1,
  displayOffset: 0,
};

const MIC_OPTIONS = [
  "SM57",
  "SM57 Dynamic",
  "MD 421",
  "Sennheiser 421",
  "RE-20",
  "Electro-Voice RE-20",
  "Ribbon 121",
  "Royer R-121",
  "Cond 67",
  "Neumann U67",
  "Cond 87",
  "Neumann U87",
  "Cond 414",
  "AKG C414",
  "Cond 47",
  "Neumann U47",
  "4038 Ribbon",
];

const MIC_DISCRETE: ParameterSchemaDef = {
  type: "discrete",
  min: 0,
  max: MIC_OPTIONS.length - 1,
  step: 1,
  unit: "",
  displayMultiplier: 1,
  displayOffset: 0,
  options: MIC_OPTIONS,
};

// ---------------------------------------------------------------------------
// PARAMETER_SCHEMA Registry
// ---------------------------------------------------------------------------
// Maps known parameter keys from defaultParams across all model catalogs
// to their appropriate schema definitions.

export const PARAMETER_SCHEMA: Record<string, ParameterSchemaDef> = {
  // --- Percentage (0-100%) ---
  Drive: PERCENTAGE,
  Bass: PERCENTAGE,
  Mid: PERCENTAGE,
  Treble: PERCENTAGE,
  Tone: PERCENTAGE,
  Mix: PERCENTAGE,
  Feedback: PERCENTAGE,
  Depth: PERCENTAGE,
  Speed: PERCENTAGE,
  Sensitivity: PERCENTAGE,
  Ratio: PERCENTAGE,
  Attack: PERCENTAGE,
  Release: PERCENTAGE,
  Threshold: PERCENTAGE,
  Output: PERCENTAGE,
  Gain: PERCENTAGE,
  Position: PERCENTAGE,
  ChVol: PERCENTAGE,
  Master: PERCENTAGE,
  Presence: PERCENTAGE,
  Sag: PERCENTAGE,
  Hum: PERCENTAGE,
  Ripple: PERCENTAGE,
  Bias: PERCENTAGE,
  BiasX: PERCENTAGE,
  Cut: PERCENTAGE,
  Resonance: PERCENTAGE,
  Deep: PERCENTAGE,
  ModSpeed: PERCENTAGE,
  ModDepth: PERCENTAGE,
  Q: PERCENTAGE,
  Volume: PERCENTAGE,
  Sustain: PERCENTAGE,
  Fuzz: PERCENTAGE,
  Distortion: PERCENTAGE,
  Boost: PERCENTAGE,
  Filter: PERCENTAGE,
  Comp: PERCENTAGE,
  Stab: PERCENTAGE,
  Gate: PERCENTAGE,
  Intensity: PERCENTAGE,
  Dwell: PERCENTAGE,
  Spread: PERCENTAGE,
  SpreadLR: PERCENTAGE,
  Wow: PERCENTAGE,
  Flutter: PERCENTAGE,
  Rise: PERCENTAGE,
  Manual: PERCENTAGE,
  Tilt: PERCENTAGE,
  Spectrum: PERCENTAGE,
  BitDepth: PERCENTAGE,
  SampleRate: PERCENTAGE,
  Voice: PERCENTAGE,
  Angle: PERCENTAGE,
  Distance: PERCENTAGE,
  BrightLvl: PERCENTAGE,
  BrightSwitch: PERCENTAGE,
  DuckThreshold: PERCENTAGE,
  PeakReduction: PERCENTAGE,
  HornLevel: PERCENTAGE,
  DrumLevel: PERCENTAGE,
  Decay: PERCENTAGE,
  Range: PERCENTAGE,
  SweepSpeed: PERCENTAGE,
  SweepDepth: PERCENTAGE,
  RiseTime: PERCENTAGE,

  // --- EQ Gain (-12dB to +12dB) ---
  LowGain: EQ_GAIN,
  MidGain: EQ_GAIN,
  HighGain: EQ_GAIN,

  // --- db_level (pass-through for params already stored in dB) ---
  Level: DB_LEVEL,

  // --- Time (0-2000ms) ---
  Time: TIME_MS,
  DecayTime: TIME_MS,
  PreDelay: TIME_MS,
  "Left Time": TIME_MS,
  "Right Time": TIME_MS,
  "Hold Time": TIME_MS,

  // --- Frequency (20-20000Hz) ---
  LowCut: HZ_FREQ,
  HighCut: HZ_FREQ,
  LowFreq: HZ_FREQ,
  MidFreq: HZ_FREQ,
  HighFreq: HZ_FREQ,
  CenterFreq: HZ_FREQ,

  // --- Discrete (dropdown with named options) ---
  Mic: MIC_DISCRETE,

  // --- Threshold params stored as percentage ---
  LowThresh: PERCENTAGE,
  MidThresh: PERCENTAGE,
  HighThresh: PERCENTAGE,
  "Open Threshold": PERCENTAGE,
  "Close Threshold": PERCENTAGE,

  // --- Delay-specific integer params mapped to percentage ---
  Taps: PERCENTAGE,
  Interval: PERCENTAGE,
  Key: PERCENTAGE,
  PitchInterval: PERCENTAGE,

  // --- EQ band frequencies (Cali Q graphic) mapped to percentage ---
  "80Hz": PERCENTAGE,
  "240Hz": PERCENTAGE,
  "750Hz": PERCENTAGE,
  "2200Hz": PERCENTAGE,
  "6600Hz": PERCENTAGE,
};

// ---------------------------------------------------------------------------
// Internal Parameters (hidden from UI)
// ---------------------------------------------------------------------------
// These parameter keys exist in amp defaultParams but are internal cab IR
// parameters that users should NOT see in the editor.

export const INTERNAL_PARAMETERS = new Set<string>([
  "AmpCabZFir",
  "AmpCabZUpdate",
  "AmpCabPeakFc",
  "AmpCabPeakG",
  "AmpCabPeakQ",
  "AmpCabPeak2Fc",
  "AmpCabPeak2G",
  "AmpCabPeak2Q",
  "AmpCabShelfF",
  "AmpCabShelfG",
  "ZPrePost",
  "Hype",
]);

// ---------------------------------------------------------------------------
// Display Transform Functions
// ---------------------------------------------------------------------------

/**
 * Convert a raw parameter value (typically 0.0-1.0) to a human-readable
 * display value using the schema's multiplier and offset.
 *
 * Formula: display = raw * displayMultiplier + displayOffset
 */
export function toDisplayValue(
  rawValue: number,
  schema: ParameterSchemaDef,
): number {
  return rawValue * schema.displayMultiplier + schema.displayOffset;
}

/**
 * Convert a human-readable display value back to the raw value
 * for store writes.
 *
 * Formula: raw = (display - displayOffset) / displayMultiplier
 */
export function fromDisplayValue(
  displayValue: number,
  schema: ParameterSchemaDef,
): number {
  return (displayValue - schema.displayOffset) / schema.displayMultiplier;
}

// ---------------------------------------------------------------------------
// Model Lookup
// ---------------------------------------------------------------------------

/**
 * Search all model catalogs for a model by its HD2_* identifier (HelixModel.id).
 * Returns the HelixModel if found, or null.
 */
export function lookupModelByModelId(modelId: string): HelixModel | null {
  const allModels = getAllModels();
  for (const model of Object.values(allModels)) {
    if (model.id === modelId) {
      return model;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Visible Parameter Filter
// ---------------------------------------------------------------------------

/**
 * Filter parameters to exclude internal cab IR params and return sorted entries.
 * Returns [key, value] pairs sorted alphabetically by key.
 */
export function getVisibleParameters(
  parameters: Record<string, number | boolean>,
): [string, number | boolean][] {
  return Object.entries(parameters)
    .filter(([key]) => !INTERNAL_PARAMETERS.has(key))
    .sort(([a], [b]) => a.localeCompare(b));
}
