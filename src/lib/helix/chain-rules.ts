// chain-rules.ts — Signal chain assembly module
// Transforms a ToneIntent into an ordered, DSP-assigned BlockSpec[]
// with all mandatory blocks inserted. Parameters are left empty ({})
// for param-engine.ts to fill.
//
// Public API: assembleSignalChain(intent: ToneIntent): BlockSpec[]

import type { ToneIntent } from "./tone-intent";
import type { BlockSpec } from "./types";
import type { DeviceCapabilities } from "./device-family";
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
  STADIUM_AMPS,
  STADIUM_EQ_MODELS,
} from "./models";
import type { HelixModel } from "./models";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


// Model name constants for mandatory blocks
const MINOTAUR = "Minotaur";
const SCREAM_808 = "Scream 808";
const PARAMETRIC_EQ = "Parametric EQ";
// Stadium uses the 7-band Parametric EQ (HD2_EQParametric7Band) instead of 5-band
const STADIUM_PARAMETRIC_EQ = "Stadium Parametric EQ";
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
function resolveEffectModel(name: string, caps: DeviceCapabilities): ResolvedEffect {
  const isAgouraEra = caps.ampCatalogEra === "agoura";

  // For Agoura-era devices, also search STADIUM_EQ_MODELS (7-band Parametric EQ etc.)
  const catalogs: Array<[Record<string, HelixModel>, string]> = [
    [DISTORTION_MODELS, "DISTORTION_MODELS"],
    [DELAY_MODELS, "DELAY_MODELS"],
    [REVERB_MODELS, "REVERB_MODELS"],
    [MODULATION_MODELS, "MODULATION_MODELS"],
    [DYNAMICS_MODELS, "DYNAMICS_MODELS"],
    [EQ_MODELS, "EQ_MODELS"],
    [WAH_MODELS, "WAH_MODELS"],
    [VOLUME_MODELS, "VOLUME_MODELS"],
    ...(isAgouraEra ? [[STADIUM_EQ_MODELS, "EQ_MODELS"] as [Record<string, HelixModel>, string]] : []),
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

function getDspForSlot(slot: ChainSlot, caps: DeviceCapabilities): 0 | 1 {
  // Single-DSP devices: all blocks on dsp0
  if (caps.dspCount === 1) return 0;

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
  pathOverride?: number,
): BlockSpec {
  const isDelayOrReverb =
    pending.blockType === "delay" || pending.blockType === "reverb";

  return {
    type: pending.blockType,
    modelId: pending.model.id,
    modelName: pending.model.name,
    dsp,
    position,
    path: pathOverride ?? 0,
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
 * For Pod Go: all blocks forced to dsp0, no Parametric EQ or Gain Block
 * insertion, and maximum 4 user-assignable effect blocks enforced.
 *
 * Parameters are left empty ({}) -- param-engine.ts fills them.
 *
 * @throws Error if amp, cab, or any effect model name is not found in the database.
 * @throws Error if either DSP would exceed the block limit.
 */
export function assembleSignalChain(intent: ToneIntent, caps: DeviceCapabilities): BlockSpec[] {
  const isAgouraEra = caps.ampCatalogEra === "agoura";

  // 1. Resolve amp model
  // Agoura-era devices use STADIUM_AMPS (Agoura_* IDs), all others use AMP_MODELS (HD2_* IDs).
  // Fallback: if the planner returns an HD2 amp name for an Agoura request, find the
  // closest Agoura equivalent by matching basedOn or ampCategory. This handles LLM
  // hallucinations where the planner picks from training data rather than the provided list.
  let ampModel: HelixModel | undefined = isAgouraEra
    ? STADIUM_AMPS[intent.ampName]
    : AMP_MODELS[intent.ampName];

  if (!ampModel && isAgouraEra) {
    // Planner returned an HD2 name for an Agoura-era device — attempt cross-catalog fallback.
    // The Zod schema allows all amp names (HD2 + Agoura) so constrained decoding
    // can't prevent this. Map to closest Agoura equivalent instead of crashing.
    const hd2Model = AMP_MODELS[intent.ampName];
    if (hd2Model) {
      // Strategy 1: Name word overlap — "Brit Plexi Jump" → "Agoura Brit Plexi" (2 word match)
      const hd2Words = intent.ampName.toLowerCase().split(/\s+/);
      let bestNameMatch: [string, HelixModel] | undefined;
      let bestNameScore = 0;
      for (const entry of Object.entries(STADIUM_AMPS)) {
        const agWords = entry[0].toLowerCase().replace("agoura ", "").split(/\s+/);
        const score = hd2Words.filter(w => agWords.includes(w)).length;
        if (score > bestNameScore) {
          bestNameScore = score;
          bestNameMatch = entry;
        }
      }
      if (bestNameMatch && bestNameScore >= 1) {
        ampModel = bestNameMatch[1];
        console.warn(`[chain-rules] Stadium fallback: "${intent.ampName}" → "${bestNameMatch[0]}" (name match, score=${bestNameScore})`);
      } else {
        // Strategy 2: Match by ampCategory (clean/crunch/high_gain)
        const byCat = Object.entries(STADIUM_AMPS).find(([, m]) =>
          m.ampCategory === hd2Model.ampCategory
        );
        if (byCat) {
          ampModel = byCat[1];
          console.warn(`[chain-rules] Stadium fallback: "${intent.ampName}" → "${byCat[0]}" (category match: ${hd2Model.ampCategory})`);
        }
      }
    }
  }

  if (!ampModel && !isAgouraEra) {
    // Reverse fallback: planner returned an Agoura name for an HD2-era device.
    // The Zod schema allows all amp names (HD2 + Agoura) so constrained decoding
    // can pick Agoura amps for Helix/Stomp/PodGo. Map back to closest HD2 equivalent.
    const agModel = STADIUM_AMPS[intent.ampName];
    if (agModel) {
      // Strategy 1: Name word overlap — "Agoura Brit Plexi" → "Brit Plexi Brt" (2 word match)
      const agWords = intent.ampName.toLowerCase().replace("agoura ", "").split(/\s+/);
      let bestNameMatch: [string, HelixModel] | undefined;
      let bestNameScore = 0;
      for (const entry of Object.entries(AMP_MODELS)) {
        const hd2Words = entry[0].toLowerCase().split(/\s+/);
        const score = agWords.filter(w => hd2Words.includes(w)).length;
        if (score > bestNameScore) {
          bestNameScore = score;
          bestNameMatch = entry;
        }
      }
      if (bestNameMatch && bestNameScore >= 1) {
        ampModel = bestNameMatch[1];
        console.warn(`[chain-rules] Agoura→HD2 fallback: "${intent.ampName}" → "${bestNameMatch[0]}" (name match, score=${bestNameScore})`);
      } else {
        // Strategy 2: Match by ampCategory (clean/crunch/high_gain)
        const byCat = Object.entries(AMP_MODELS).find(([, m]) =>
          m.ampCategory === agModel.ampCategory
        );
        if (byCat) {
          ampModel = byCat[1];
          console.warn(`[chain-rules] Agoura→HD2 fallback: "${intent.ampName}" → "${byCat[0]}" (category match: ${agModel.ampCategory})`);
        }
      }
    }
  }

  if (!ampModel) {
    throw new Error(
      `Unknown amp model: "${intent.ampName}". Model name must exactly match a key in ${isAgouraEra ? "STADIUM_AMPS" : "AMP_MODELS"}.`
    );
  }

  // 2. Resolve cab model
  const cabModel = CAB_MODELS[intent.cabName];
  if (!cabModel) {
    throw new Error(
      `Unknown cab model: "${intent.cabName}". Model name must exactly match a key in CAB_MODELS.`
    );
  }

  // 2b. Detect dual-amp intent (DUAL-03)
  // Only supported on devices with dualAmpSupported capability
  const isDualAmp = !!(intent.secondAmpName && intent.secondCabName && caps.dualAmpSupported);

  let secondAmpModel: HelixModel | undefined;
  let secondCabModel: HelixModel | undefined;
  if (isDualAmp) {
    // Dual-amp is only for Helix LT/Floor (isDualAmp guard excludes Stadium/Stomp/PodGo)
    secondAmpModel = AMP_MODELS[intent.secondAmpName!];
    if (!secondAmpModel) {
      throw new Error(
        `Unknown second amp model: "${intent.secondAmpName}". Model name must exactly match a key in AMP_MODELS.`
      );
    }
    secondCabModel = CAB_MODELS[intent.secondCabName!];
    if (!secondCabModel) {
      throw new Error(
        `Unknown second cab model: "${intent.secondCabName}". Model name must exactly match a key in CAB_MODELS.`
      );
    }
  }

  // 3. Determine amp category
  const ampCategory = ampModel.ampCategory ?? "clean";

  // 4. Resolve user-provided effects
  const userEffects: PendingBlock[] = [];
  const userEffectNames = new Set<string>();

  for (const effect of intent.effects) {
    const resolved = resolveEffectModel(effect.modelName, caps);
    const slot = classifyEffectSlot(resolved, effect.modelName);
    userEffectNames.add(effect.modelName);
    userEffects.push({
      model: resolved.model,
      blockType: resolved.blockType,
      slot,
      dsp: getDspForSlot(slot, caps),
      intentRole: effect.role,
    });
  }

  // Enforce per-device user effect limit (caps.maxEffectsPerDsp)
  // Infinity for Helix (no explicit cap), 4 for Pod Go/Stadium, 2-5 for Stomp/Stomp XL
  if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
    userEffects.length = caps.maxEffectsPerDsp;
  }

  // Dual-amp: enforce tighter pre-amp effect limit (DUAL-03)
  // split+amp1+cab1+amp2+cab2+join = 6 slots, leaves 4 for boost+gate+2 effects
  if (isDualAmp && userEffects.length > 2) {
    userEffects.length = 2;
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

  // 5c. Post-cab Parametric EQ — only for devices with 'eq' in mandatoryBlockTypes
  //     Agoura-era devices use 7-band Parametric EQ, HD2-era use 5-band
  if (caps.mandatoryBlockTypes.includes("eq")) {
    const eqModel = isAgouraEra
      ? STADIUM_EQ_MODELS[STADIUM_PARAMETRIC_EQ]!
      : EQ_MODELS[PARAMETRIC_EQ]!;
    mandatoryBlocks.push({
      model: eqModel,
      blockType: "eq",
      slot: "eq",
      dsp: getDspForSlot("eq", caps),
    });
  }

  // 5d. Gain Block as last block — only for devices with 'volume' in mandatoryBlockTypes
  if (caps.mandatoryBlockTypes.includes("volume")) {
    const gainModel = VOLUME_MODELS[GAIN_BLOCK]!;
    mandatoryBlocks.push({
      model: gainModel,
      blockType: "volume",
      slot: "gain_block",
      dsp: getDspForSlot("gain_block", caps),
    });
  }

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

  // Add amp block (primary, path 0)
  allBlocks.push({
    model: ampModel,
    blockType: "amp",
    slot: "amp",
    dsp: 0,
  });

  // Add cab block (primary, path 0)
  allBlocks.push({
    model: cabModel,
    blockType: "cab",
    slot: "cab",
    dsp: 0,
  });

  // Dual-amp: add second amp+cab on path 1 (Path B) (DUAL-03)
  // Track these specific PendingBlock instances for path assignment (handles same-model-twice case)
  let secondAmpPending: PendingBlock | undefined;
  let secondCabPending: PendingBlock | undefined;
  if (isDualAmp && secondAmpModel && secondCabModel) {
    secondAmpPending = {
      model: secondAmpModel,
      blockType: "amp",
      slot: "amp" as ChainSlot,
      dsp: 0,
    };
    secondCabPending = {
      model: secondCabModel,
      blockType: "cab",
      slot: "cab" as ChainSlot,
      dsp: 0,
    };
    allBlocks.push(secondAmpPending);
    allBlocks.push(secondCabPending);
  }

  // 7. Sort all blocks by signal chain order
  allBlocks.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

  // 8. Validate DSP block limits
  if (caps.dspCount === 1) {
    // Single-DSP devices: check total block count against caps.maxBlocksTotal
    const totalBlocks = allBlocks.length;
    if (totalBlocks > caps.maxBlocksTotal) {
      throw new Error(
        `Block limit exceeded: ${totalBlocks} blocks (max ${caps.maxBlocksTotal} for ${caps.family}). ` +
          `Reduce the number of effects.`
      );
    }
  } else {
    // Dual-DSP devices: max non-cab blocks per DSP
    const dsp0NonCab = allBlocks.filter(
      (b) => b.dsp === 0 && b.blockType !== "cab"
    );
    const dsp1NonCab = allBlocks.filter(
      (b) => b.dsp === 1 && b.blockType !== "cab"
    );

    if (dsp0NonCab.length > caps.maxBlocksPerDsp) {
      throw new Error(
        `DSP0 block limit exceeded: ${dsp0NonCab.length} non-cab blocks (max ${caps.maxBlocksPerDsp}). ` +
          `Reduce the number of pre-amp effects.`
      );
    }
    if (dsp1NonCab.length > caps.maxBlocksPerDsp) {
      throw new Error(
        `DSP1 block limit exceeded: ${dsp1NonCab.length} non-cab blocks (max ${caps.maxBlocksPerDsp}). ` +
          `Reduce the number of post-cab effects.`
      );
    }
  }

  // 9. Assign sequential positions per-DSP, excluding cab from position count
  let dsp0Pos = 0;
  let dsp1Pos = 0;

  const result: BlockSpec[] = [];

  for (const pending of allBlocks) {
    // Determine if this block belongs to the secondary amp path (DUAL-03)
    // Uses object identity (===) so same-model-twice works correctly
    const isSecondaryPath = isDualAmp && (
      pending === secondAmpPending || pending === secondCabPending
    );
    const pathValue = isSecondaryPath ? 1 : 0;

    if (pending.blockType === "cab") {
      // Cab block gets a special position (not counted in sequential numbering)
      // Use -1 as a sentinel; preset-builder handles cab separately via cab0 key
      result.push(buildBlockSpec(pending, pending.dsp, -1, pathValue));
    } else if (pending.dsp === 0) {
      result.push(buildBlockSpec(pending, 0, dsp0Pos, pathValue));
      dsp0Pos++;
    } else {
      result.push(buildBlockSpec(pending, 1, dsp1Pos, pathValue));
      dsp1Pos++;
    }
  }

  return result;
}
