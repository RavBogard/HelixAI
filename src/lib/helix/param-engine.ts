// src/lib/helix/param-engine.ts
// Parameter resolution module — fills every block's parameters with expert-consensus
// values based on amp category, topology, and model defaults.
//
// All numeric parameter values come from deterministic lookup tables derived from
// expert analysis of 250+ professional presets. No AI-generated numbers.
//
// Usage: resolveParameters(chain, intent) -> BlockSpec[] with all parameters filled.

import type { AmpCategory, BlockSpec, DeviceTarget, TopologyTag } from "./types";
import { isStadium } from "./types";
import type { ToneIntent } from "./tone-intent";
import {
  AMP_MODELS,
  STADIUM_AMPS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
  CAB_MODELS,
} from "./models";
import type { HelixModel } from "./models";

// ============================================================
// CATEGORY DEFAULT LOOKUP TABLES
// ============================================================

// Amp parameter overrides per category — applied on top of model defaults.
// Values are midpoints of expert-consensus ranges from Tonevault 250-preset analysis.
const AMP_DEFAULTS: Record<AmpCategory, Record<string, number>> = {
  clean: {
    Drive: 0.25, Master: 0.95, ChVol: 0.70, Sag: 0.60,
    Bias: 0.55, Bass: 0.55, Mid: 0.50, Treble: 0.55,
    Presence: 0.35, Hum: 0.10, Ripple: 0.10, BiasX: 0.50,
  },
  crunch: {
    Drive: 0.50, Master: 0.60, ChVol: 0.70, Sag: 0.45,
    Bias: 0.65, Bass: 0.28, Mid: 0.60, Treble: 0.60,
    Presence: 0.45, Hum: 0.15, Ripple: 0.12, BiasX: 0.50,
  },
  high_gain: {
    Drive: 0.40, Master: 0.45, ChVol: 0.70, Sag: 0.25,
    Bias: 0.75, Bass: 0.33, Mid: 0.53, Treble: 0.55,
    Presence: 0.50, Hum: 0.08, Ripple: 0.05, BiasX: 0.48,
  },
};

// Topology-aware mid adjustment for high-gain amps only (TONE-06).
// cathode_follower tone stack scoops mids cleanly at high gain.
// plate_fed tone stack preserves mids even at high drive.
const TOPOLOGY_MID: Record<string, number> = {
  cathode_follower: 0.45,
  plate_fed: 0.60,
  solid_state: 0.50,
};

// ============================================================
// CAB PARAMETER TABLES (TONE-02, TONE-04)
// ============================================================

// LowCut/HighCut are RAW Hz values (not normalized 0-1).
// Mic is an integer index (0=57 Dynamic, 6=121 Ribbon, 2=67 Condenser).
const CAB_PARAMS: Record<AmpCategory, { LowCut: number; HighCut: number; Mic: number; Distance: number; Angle: number }> = {
  clean:     { LowCut: 80.0,  HighCut: 7000.0, Mic: 6, Distance: 1.0, Angle: 0.0 },
  crunch:    { LowCut: 80.0,  HighCut: 7500.0, Mic: 0, Distance: 1.0, Angle: 0.0 },
  high_gain: { LowCut: 100.0, HighCut: 5500.0, Mic: 0, Distance: 1.0, Angle: 0.0 },
};

// ============================================================
// POST-CAB PARAMETRIC EQ TABLES (TONE-03)
// ============================================================

// LowGain < 0.50 = cut (anti-mud). HighGain > 0.50 = boost (presence recovery).
const EQ_PARAMS: Record<AmpCategory, Record<string, number>> = {
  clean: {
    LowFreq: 0.18, LowGain: 0.50, MidFreq: 0.40, MidGain: 0.48,
    Q: 0.50, HighFreq: 0.75, HighGain: 0.55, Level: 0.0,
  },
  crunch: {
    LowFreq: 0.20, LowGain: 0.45, MidFreq: 0.38, MidGain: 0.45,
    Q: 0.50, HighFreq: 0.75, HighGain: 0.56, Level: 0.0,
  },
  high_gain: {
    LowFreq: 0.22, LowGain: 0.42, MidFreq: 0.35, MidGain: 0.40,
    Q: 0.55, HighFreq: 0.72, HighGain: 0.54, Level: 0.0,
  },
};

// ============================================================
// BOOST PARAMETER TABLES (DYN-03)
// ============================================================

// Minotaur (Klon) — uses Gain/Treble/Output (NOT Drive/Tone/Output)
const MINOTAUR_PARAMS: Record<AmpCategory, Record<string, number>> = {
  clean:     { Gain: 0.00, Treble: 0.50, Output: 0.70 },
  crunch:    { Gain: 0.25, Treble: 0.50, Output: 0.60 },
  high_gain: { Gain: 0.25, Treble: 0.50, Output: 0.60 }, // fallback, typically Scream 808 used for high-gain
};

// Scream 808 (TS808) — uses Drive/Tone/Level
const SCREAM_808_PARAMS: Record<string, number> = {
  Drive: 0.15, Tone: 0.50, Level: 0.60,
};

// ============================================================
// GATE PARAMETER TABLE
// ============================================================

const HORIZON_GATE_PARAMS: Record<string, number> = {
  Threshold: 0.50, Decay: 0.40,
};

// ============================================================
// GAIN BLOCK (VOLUME) TABLE
// ============================================================

// Gain is in dB (NOT normalized). 0.0 dB = unity gain.
const GAIN_BLOCK_PARAMS: Record<string, number> = {
  Gain: 0.0,
};

// ============================================================
// GENRE-AWARE EFFECT DEFAULTS (INTL-01)
// ============================================================
// Outermost resolution layer: applied AFTER model defaults.
// All values use normalized floats matching the model database encoding:
//   - Delay Time: 0.0-1.0 (0.375 ≈ 375ms)
//   - Mix: 0.0-1.0 (0.30 = 30%)
//   - Modulation Speed: 0.0-1.0

interface GenreEffectProfile {
  delay?: Record<string, number>;
  reverb?: Record<string, number>;
  modulation?: Record<string, number>;
}

const GENRE_EFFECT_DEFAULTS: Record<string, GenreEffectProfile> = {
  blues: {
    delay: { Time: 0.15, Feedback: 0.20, Mix: 0.20 },
    reverb: { Mix: 0.20, DecayTime: 0.4 },
    modulation: { Speed: 0.3, Depth: 0.4 },
  },
  rock: {
    delay: { Time: 0.30, Feedback: 0.25, Mix: 0.20 },
    reverb: { Mix: 0.20, DecayTime: 0.45 },
    modulation: { Speed: 0.35, Depth: 0.45 },
  },
  metal: {
    delay: { Time: 0.375, Feedback: 0.20, Mix: 0.12 },
    reverb: { Mix: 0.12, DecayTime: 0.35 },
    modulation: { Speed: 0.3, Depth: 0.3 },
  },
  jazz: {
    delay: { Time: 0.30, Feedback: 0.20, Mix: 0.15 },
    reverb: { Mix: 0.22, DecayTime: 0.5 },
    modulation: { Speed: 0.35, Depth: 0.45 },
  },
  country: {
    delay: { Time: 0.15, Feedback: 0.25, Mix: 0.25 },
    reverb: { Mix: 0.20, DecayTime: 0.4 },
    modulation: { Speed: 0.3, Depth: 0.4 },
  },
  ambient: {
    delay: { Time: 0.50, Feedback: 0.50, Mix: 0.40 },
    reverb: { Mix: 0.50, DecayTime: 0.8 },
    modulation: { Speed: 0.25, Depth: 0.6 },
  },
  worship: {
    delay: { Time: 0.45, Feedback: 0.40, Mix: 0.35 },
    reverb: { Mix: 0.40, DecayTime: 0.7 },
    modulation: { Speed: 0.25, Depth: 0.5 },
  },
  funk: {
    delay: { Time: 0.20, Feedback: 0.15, Mix: 0.15 },
    reverb: { Mix: 0.15, DecayTime: 0.3 },
    modulation: { Speed: 0.5, Depth: 0.5 },
  },
  pop: {
    delay: { Time: 0.375, Feedback: 0.30, Mix: 0.25 },
    reverb: { Mix: 0.25, DecayTime: 0.5 },
    modulation: { Speed: 0.4, Depth: 0.5 },
  },
};

/**
 * Match a genreHint string to a GENRE_EFFECT_DEFAULTS key using substring lookup.
 * Returns undefined if no match — callers fall back to model defaults.
 */
function matchGenre(genreHint: string | undefined): GenreEffectProfile | undefined {
  if (!genreHint) return undefined;
  const hint = genreHint.toLowerCase();
  if (GENRE_EFFECT_DEFAULTS[hint]) return GENRE_EFFECT_DEFAULTS[hint];
  for (const [genre, profile] of Object.entries(GENRE_EFFECT_DEFAULTS)) {
    if (hint.includes(genre)) return profile;
  }
  return undefined;
}

// ============================================================
// MODEL LOOKUP HELPERS
// ============================================================

// All model dictionaries by block type for defaultParams lookup
const MODEL_LOOKUPS: Record<string, Record<string, HelixModel>> = {
  delay: DELAY_MODELS,
  reverb: REVERB_MODELS,
  modulation: MODULATION_MODELS,
  dynamics: DYNAMICS_MODELS,
  eq: EQ_MODELS,
  wah: WAH_MODELS,
  pitch: {} as Record<string, HelixModel>, // no PITCH_MODELS export yet
  send_return: {} as Record<string, HelixModel>,
  distortion: DISTORTION_MODELS,
  volume: VOLUME_MODELS,
  amp: AMP_MODELS,
  cab: CAB_MODELS,
};

/**
 * Look up a model by name across all model dictionaries for a given block type.
 */
function findModel(modelName: string, blockType: string): HelixModel | undefined {
  const dict = MODEL_LOOKUPS[blockType];
  if (dict && dict[modelName]) {
    return dict[modelName];
  }
  // Fallback: search all dictionaries
  for (const models of Object.values(MODEL_LOOKUPS)) {
    if (models[modelName]) {
      return models[modelName];
    }
  }
  return undefined;
}

// ============================================================
// PARAMETER RESOLUTION
// ============================================================

/**
 * Resolve parameters for every block in the signal chain based on amp category,
 * topology, and expert-consensus lookup tables.
 *
 * Does NOT mutate the input chain — returns a new BlockSpec array.
 *
 * @param chain - Signal chain from assembleSignalChain() with empty parameters
 * @param intent - Original ToneIntent for context (ampName determines category)
 * @returns New BlockSpec[] with all parameter values filled
 */
export function resolveParameters(
  chain: BlockSpec[],
  intent: ToneIntent,
  device?: DeviceTarget,
): BlockSpec[] {
  // Strict device-aware amp lookup — no cross-device fallback.
  const stadium = device ? isStadium(device) : false;
  const ampModel = stadium
    ? STADIUM_AMPS[intent.ampName]
    : AMP_MODELS[intent.ampName];
  if (!ampModel) {
    throw new Error(`Unknown amp model: "${intent.ampName}" — not found in ${stadium ? "STADIUM_AMPS" : "AMP_MODELS"}`);
  }

  const ampCategory: AmpCategory = ampModel.ampCategory ?? "clean";
  const topology: TopologyTag = ampModel.topology ?? "not_applicable";
  const genreProfile = matchGenre(intent.genreHint);

  // Dual-amp: resolve second amp's category and topology independently (DUAL-04)
  // Dual-amp is only for Helix LT/Floor — Stadium/Stomp/PodGo are excluded upstream
  const secondAmpModel = intent.secondAmpName
    ? AMP_MODELS[intent.secondAmpName]
    : undefined;
  const secondAmpCategory: AmpCategory = secondAmpModel?.ampCategory ?? "clean";
  const secondTopology: TopologyTag = secondAmpModel?.topology ?? "not_applicable";

  // Build new array — never mutate input
  return chain.map((block) => {
    // For dual-amp: blocks on path 1 use second amp's category/topology (DUAL-04)
    const isSecondaryPath = block.path === 1;
    const effectiveCategory = isSecondaryPath ? secondAmpCategory : ampCategory;
    const effectiveTopology = isSecondaryPath ? secondTopology : topology;

    const resolved: BlockSpec = {
      ...block,
      parameters: resolveBlockParams(block, effectiveCategory, effectiveTopology, genreProfile),
    };
    return resolved;
  });
}

/**
 * Resolve parameters for a single block based on its type and the amp context.
 */
function resolveBlockParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
  genreProfile?: GenreEffectProfile,
): Record<string, number> {
  switch (block.type) {
    case "amp":
      return resolveAmpParams(block, ampCategory, topology);
    case "cab":
      return resolveCabParams(ampCategory);
    case "distortion":
      return resolveDistortionParams(block, ampCategory);
    case "eq":
      return resolveEqParams(block, ampCategory);
    case "dynamics":
      return resolveDynamicsParams(block);
    case "volume":
      return resolveVolumeParams(block);
    default:
      // delay, reverb, modulation, wah, pitch, send_return:
      // Use model defaults, then apply genre overrides as outermost layer
      return resolveDefaultParams(block, genreProfile);
  }
}

/**
 * Amp parameter resolution — 3-layer strategy:
 * 1. Start with model's own defaultParams
 * 2. Apply category-level overrides
 * 3. Apply topology-specific mid override (high-gain only)
 */
function resolveAmpParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
): Record<string, number> {
  // Layer 1: Start with the model's own defaults
  const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
  const params: Record<string, number> = model
    ? { ...model.defaultParams }
    : { ...block.parameters };

  // Layer 2: Apply category overrides (ensures consistency within category)
  const categoryDefaults = AMP_DEFAULTS[ampCategory];
  for (const [key, value] of Object.entries(categoryDefaults)) {
    // Only override keys that exist in category defaults
    // This preserves model-specific params like Cut, Deep, Resonance, BrightSwitch
    params[key] = value;
  }

  // Layer 3: Apply topology-specific mid override if high-gain
  if (ampCategory === "high_gain" && topology !== "not_applicable") {
    const midOverride = TOPOLOGY_MID[topology];
    if (midOverride !== undefined) {
      params.Mid = midOverride;
    }
  }

  return params;
}

/**
 * Cab parameter resolution — Hz-encoded LowCut/HighCut, integer Mic index.
 */
function resolveCabParams(ampCategory: AmpCategory): Record<string, number> {
  const cabDefaults = CAB_PARAMS[ampCategory];
  return {
    LowCut: cabDefaults.LowCut,
    HighCut: cabDefaults.HighCut,
    Mic: cabDefaults.Mic,
    Distance: cabDefaults.Distance,
    Angle: cabDefaults.Angle,
  };
}

/**
 * Distortion/boost parameter resolution — model-specific tables.
 */
function resolveDistortionParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
): Record<string, number> {
  // Minotaur (Klon) — category-specific boost values
  if (block.modelId === "HD2_DistMinotaur") {
    return { ...MINOTAUR_PARAMS[ampCategory] };
  }

  // Scream 808 (TS808) — fixed boost values
  if (block.modelId === "HD2_DistScream808") {
    return { ...SCREAM_808_PARAMS };
  }

  // Other distortion models: use model defaultParams
  return resolveDefaultParams(block);
}

/**
 * EQ parameter resolution — category-specific mud cut and presence recovery.
 */
function resolveEqParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
): Record<string, number> {
  // Parametric EQ: use category-specific expert values
  if (block.modelId === "HD2_EQParametric") {
    return { ...EQ_PARAMS[ampCategory] };
  }

  // Other EQ models: use model defaultParams
  return resolveDefaultParams(block);
}

/**
 * Dynamics parameter resolution — gate-specific tables.
 */
function resolveDynamicsParams(block: BlockSpec): Record<string, number> {
  // Horizon Gate: expert-tuned gate values
  if (block.modelId === "HD2_GateHorizonGate") {
    return { ...HORIZON_GATE_PARAMS };
  }

  // Other dynamics models: use model defaultParams
  return resolveDefaultParams(block);
}

/**
 * Volume block parameter resolution — Gain Block uses dB value.
 */
function resolveVolumeParams(block: BlockSpec): Record<string, number> {
  // Gain Block: 0.0 dB (unity gain)
  if (block.modelId === "HD2_VolPanGain") {
    return { ...GAIN_BLOCK_PARAMS };
  }

  // Other volume models: use model defaultParams
  return resolveDefaultParams(block);
}

/**
 * Default parameter resolution — look up model's defaultParams from the database,
 * then apply genre-specific overrides as outermost layer (INTL-01).
 *
 * Resolution order: model defaults -> genre overrides
 * Genre overrides only apply to matching block types (delay/reverb/modulation).
 */
function resolveDefaultParams(block: BlockSpec, genreProfile?: GenreEffectProfile): Record<string, number> {
  const model = findModel(block.modelName, block.type);
  const params = model ? { ...model.defaultParams } : { ...block.parameters };

  // Apply genre overrides as outermost layer (only for effect types with genre profiles)
  if (genreProfile) {
    const genreOverrides = genreProfile[block.type as keyof GenreEffectProfile];
    if (genreOverrides) {
      for (const [key, value] of Object.entries(genreOverrides)) {
        // Only override params that exist on the model (don't add foreign params)
        if (key in params) {
          params[key] = value;
        }
      }
    }
  }

  return params;
}
