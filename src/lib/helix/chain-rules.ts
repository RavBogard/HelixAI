// chain-rules.ts — Signal chain assembly module
// Transforms a ToneIntent into an ordered, DSP-assigned BlockSpec[]
// with all mandatory blocks inserted. Parameters are left empty ({})
// for param-engine.ts to fill.
//
// Public API: assembleSignalChain(intent: ToneIntent): BlockSpec[]

import type { ToneIntent } from "./tone-intent";
import type { BlockSpec } from "./types";
import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
} from "./models";
import type { HelixModel } from "./models";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BLOCKS_PER_DSP = 8;

// Model name constants for mandatory blocks
const MINOTAUR = "Minotaur";
const SCREAM_808 = "Scream 808";
const PARAMETRIC_EQ = "Parametric EQ";
const HORIZON_GATE = "Horizon Gate";
const GAIN_BLOCK = "Gain Block";

// ---------------------------------------------------------------------------
// Block type mapping: determines BlockSpec.type from the source model catalog
// ---------------------------------------------------------------------------

type BlockType = BlockSpec["type"];

interface ResolvedEffect {
  model: HelixModel;
  blockType: BlockType;
  sourceCatalog: string; // which model catalog it came from
}

/** Maps a model catalog name to the corresponding BlockSpec.type */
const CATALOG_TO_BLOCK_TYPE: Record<string, BlockType> = {
  AMP_MODELS: "amp",
  CAB_MODELS: "cab",
  DISTORTION_MODELS: "distortion",
  DELAY_MODELS: "delay",
  REVERB_MODELS: "reverb",
  MODULATION_MODELS: "modulation",
  DYNAMICS_MODELS: "dynamics",
  EQ_MODELS: "eq",
  WAH_MODELS: "wah",
  VOLUME_MODELS: "volume",
};

// ---------------------------------------------------------------------------
// Model resolution
// ---------------------------------------------------------------------------

/** Look up an effect model name across all effect catalogs. Throws if not found. */
function resolveEffectModel(name: string): ResolvedEffect {
  const catalogs: Array<[Record<string, HelixModel>, string]> = [
    [DISTORTION_MODELS, "DISTORTION_MODELS"],
    [DELAY_MODELS, "DELAY_MODELS"],
    [REVERB_MODELS, "REVERB_MODELS"],
    [MODULATION_MODELS, "MODULATION_MODELS"],
    [DYNAMICS_MODELS, "DYNAMICS_MODELS"],
    [EQ_MODELS, "EQ_MODELS"],
    [WAH_MODELS, "WAH_MODELS"],
    [VOLUME_MODELS, "VOLUME_MODELS"],
  ];

  for (const [catalog, catalogName] of catalogs) {
    const model = catalog[name];
    if (model) {
      return {
        model,
        blockType: CATALOG_TO_BLOCK_TYPE[catalogName],
        sourceCatalog: catalogName,
      };
    }
  }

  throw new Error(`Unknown effect model: "${name}". Model name must exactly match a key in the model database.`);
}

// ---------------------------------------------------------------------------
// Signal chain ordering slots
// ---------------------------------------------------------------------------

// DSP0 ordering: wah > compressor > extra drives > boost > amp > [cab separate] > horizon gate
// DSP1 ordering: parametric EQ > modulation > delay > reverb > gain block

/** Categorize a resolved effect into its signal chain slot */
type ChainSlot =
  | "wah"
  | "compressor"
  | "extra_drive"
  | "boost"
  | "amp"
  | "cab"
  | "horizon_gate"
  | "eq"
  | "modulation"
  | "delay"
  | "reverb"
  | "gain_block";

function classifyEffectSlot(resolved: ResolvedEffect, modelName: string): ChainSlot {
  const { blockType, sourceCatalog } = resolved;
  const model = resolved.model;

  // Specific mandatory blocks
  if (modelName === HORIZON_GATE) return "horizon_gate";
  if (modelName === PARAMETRIC_EQ) return "eq";
  if (modelName === GAIN_BLOCK) return "gain_block";

  // Boost detection: Minotaur or Scream 808 in the boost position
  if (modelName === MINOTAUR || modelName === SCREAM_808) return "boost";

  // Categorize by catalog / type
  switch (blockType) {
    case "wah":
      return "wah";
    case "dynamics":
      // Compressors go to DSP0 compressor slot, gates go differently
      if (model.category === "gate") return "horizon_gate"; // Other gates treated like horizon gate
      return "compressor";
    case "distortion":
      return "extra_drive";
    case "eq":
      return "eq";
    case "modulation":
      return "modulation";
    case "delay":
      return "delay";
    case "reverb":
      return "reverb";
    case "volume":
      return "gain_block";
    default:
      return "extra_drive"; // Default: treat as pre-amp drive
  }
}

function getDspForSlot(slot: ChainSlot): 0 | 1 {
  switch (slot) {
    case "wah":
    case "compressor":
    case "extra_drive":
    case "boost":
    case "amp":
    case "cab":
    case "horizon_gate":
      return 0;
    case "eq":
    case "modulation":
    case "delay":
    case "reverb":
    case "gain_block":
      return 1;
  }
}

// Ordering priority within the chain (lower = earlier in signal chain)
const SLOT_ORDER: Record<ChainSlot, number> = {
  wah: 0,
  compressor: 1,
  extra_drive: 2,
  boost: 3,
  amp: 4,
  cab: 5,
  horizon_gate: 6,
  eq: 7,
  modulation: 8,
  delay: 9,
  reverb: 10,
  gain_block: 11,
};

// ---------------------------------------------------------------------------
// BlockSpec construction helper
// ---------------------------------------------------------------------------

interface PendingBlock {
  model: HelixModel;
  blockType: BlockType;
  slot: ChainSlot;
  dsp: 0 | 1;
  intentRole?: "always_on" | "toggleable" | "ambient";
}

function buildBlockSpec(
  pending: PendingBlock,
  dsp: 0 | 1,
  position: number,
): BlockSpec {
  const isDelayOrReverb =
    pending.blockType === "delay" || pending.blockType === "reverb";

  return {
    type: pending.blockType,
    modelId: pending.model.id,
    modelName: pending.model.name,
    dsp,
    position,
    path: 0,
    enabled: true,
    stereo: false,
    ...(isDelayOrReverb ? { trails: true } : {}),
    parameters: {},
    ...(pending.intentRole ? { intentRole: pending.intentRole } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Transforms a ToneIntent into an ordered BlockSpec[] with all mandatory
 * blocks inserted, correct signal chain ordering, and DSP0/DSP1 assignments.
 *
 * Parameters are left empty ({}) -- param-engine.ts fills them.
 *
 * @throws Error if amp, cab, or any effect model name is not found in the database.
 * @throws Error if either DSP would exceed the 8-block-per-DSP limit (non-cab).
 */
export function assembleSignalChain(intent: ToneIntent): BlockSpec[] {
  // 1. Resolve amp model
  const ampModel = AMP_MODELS[intent.ampName];
  if (!ampModel) {
    throw new Error(
      `Unknown amp model: "${intent.ampName}". Model name must exactly match a key in AMP_MODELS.`
    );
  }

  // 2. Resolve cab model
  const cabModel = CAB_MODELS[intent.cabName];
  if (!cabModel) {
    throw new Error(
      `Unknown cab model: "${intent.cabName}". Model name must exactly match a key in CAB_MODELS.`
    );
  }

  // 3. Determine amp category
  const ampCategory = ampModel.ampCategory ?? "clean";

  // 4. Resolve user-provided effects
  const userEffects: PendingBlock[] = [];
  const userEffectNames = new Set<string>();

  for (const effect of intent.effects) {
    const resolved = resolveEffectModel(effect.modelName);
    const slot = classifyEffectSlot(resolved, effect.modelName);
    userEffectNames.add(effect.modelName);
    userEffects.push({
      model: resolved.model,
      blockType: resolved.blockType,
      slot,
      dsp: getDspForSlot(slot),
      intentRole: effect.role,
    });
  }

  // 5. Mandatory block insertion (CHAIN-06)
  const mandatoryBlocks: PendingBlock[] = [];

  // 5a. Always-on boost: Minotaur for clean/crunch, Scream 808 for high_gain
  //     Skip if user already included the appropriate boost
  if (ampCategory === "clean" || ampCategory === "crunch") {
    if (!userEffectNames.has(MINOTAUR)) {
      const boostModel = DISTORTION_MODELS[MINOTAUR]!;
      mandatoryBlocks.push({
        model: boostModel,
        blockType: "distortion",
        slot: "boost",
        dsp: 0,
      });
    }
  } else if (ampCategory === "high_gain") {
    if (!userEffectNames.has(SCREAM_808)) {
      const boostModel = DISTORTION_MODELS[SCREAM_808]!;
      mandatoryBlocks.push({
        model: boostModel,
        blockType: "distortion",
        slot: "boost",
        dsp: 0,
      });
    }
  }

  // 5b. Horizon Gate for high_gain only (after cab, before EQ)
  if (ampCategory === "high_gain") {
    const gateModel = DYNAMICS_MODELS[HORIZON_GATE]!;
    mandatoryBlocks.push({
      model: gateModel,
      blockType: "dynamics",
      slot: "horizon_gate",
      dsp: 0,
    });
  }

  // 5c. Post-cab Parametric EQ (always)
  const eqModel = EQ_MODELS[PARAMETRIC_EQ]!;
  mandatoryBlocks.push({
    model: eqModel,
    blockType: "eq",
    slot: "eq",
    dsp: 1,
  });

  // 5d. Gain Block as last block on DSP1 (always)
  const gainModel = VOLUME_MODELS[GAIN_BLOCK]!;
  mandatoryBlocks.push({
    model: gainModel,
    blockType: "volume",
    slot: "gain_block",
    dsp: 1,
  });

  // 6. Build the complete pending block list
  //    Combine user effects + mandatory blocks, deduplicating by slot where
  //    user-provided effects take priority (e.g., user Minotaur replaces
  //    mandatory Minotaur).
  const allBlocks: PendingBlock[] = [];

  // Add user effects first
  allBlocks.push(...userEffects);

  // Add mandatory blocks only if no user effect occupies the same named slot
  for (const mandatory of mandatoryBlocks) {
    // Check if a user effect already fills this exact model
    const isDuplicate = userEffects.some(
      (ue) => ue.model.id === mandatory.model.id
    );
    if (!isDuplicate) {
      allBlocks.push(mandatory);
    }
  }

  // Add amp block
  allBlocks.push({
    model: ampModel,
    blockType: "amp",
    slot: "amp",
    dsp: 0,
  });

  // Add cab block
  allBlocks.push({
    model: cabModel,
    blockType: "cab",
    slot: "cab",
    dsp: 0,
  });

  // 7. Sort all blocks by signal chain order
  allBlocks.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  // 8. Validate DSP block limits (non-cab blocks)
  const dsp0NonCab = allBlocks.filter(
    (b) => b.dsp === 0 && b.blockType !== "cab"
  );
  const dsp1NonCab = allBlocks.filter(
    (b) => b.dsp === 1 && b.blockType !== "cab"
  );

  if (dsp0NonCab.length > MAX_BLOCKS_PER_DSP) {
    throw new Error(
      `DSP0 block limit exceeded: ${dsp0NonCab.length} non-cab blocks (max ${MAX_BLOCKS_PER_DSP}). ` +
        `Reduce the number of pre-amp effects.`
    );
  }
  if (dsp1NonCab.length > MAX_BLOCKS_PER_DSP) {
    throw new Error(
      `DSP1 block limit exceeded: ${dsp1NonCab.length} non-cab blocks (max ${MAX_BLOCKS_PER_DSP}). ` +
        `Reduce the number of post-cab effects.`
    );
  }

  // 9. Assign sequential positions per-DSP, excluding cab from position count
  let dsp0Pos = 0;
  let dsp1Pos = 0;

  const result: BlockSpec[] = [];

  for (const pending of allBlocks) {
    if (pending.blockType === "cab") {
      // Cab block gets a special position (not counted in sequential numbering)
      // Use -1 as a sentinel; preset-builder handles cab separately via cab0 key
      result.push(buildBlockSpec(pending, pending.dsp, -1));
    } else if (pending.dsp === 0) {
      result.push(buildBlockSpec(pending, 0, dsp0Pos));
      dsp0Pos++;
    } else {
      result.push(buildBlockSpec(pending, 1, dsp1Pos));
      dsp1Pos++;
    }
  }

  return result;
}
