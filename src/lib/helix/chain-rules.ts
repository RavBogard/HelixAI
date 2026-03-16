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
const LA_STUDIO_COMP = "LA Studio Comp";
const LOW_HIGH_CUT = "Low and High Cut";

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
  | "pre_amp_eq"
  | "amp"
  | "cab"
  | "horizon_gate"
  | "eq"
  | "modulation"
  | "delay"
  | "reverb"
  | "mastering_comp"
  | "gain_block";

function classifyEffectSlot(resolved: ResolvedEffect, modelName: string): ChainSlot {
  const { blockType, sourceCatalog } = resolved;
  const model = resolved.model;

  // Specific mandatory blocks
  if (modelName === HORIZON_GATE) return "horizon_gate";
  if (modelName === PARAMETRIC_EQ) return "eq";
  if (modelName === GAIN_BLOCK) return "gain_block";

  // COHERE-03: User-selected Minotaur/Scream 808 classified as extra_drive (regular drive).
  // Only mandatory blocks inserted in step 5a get slot="boost" — see buildBlockSpec propagation.
  // Previously this returned "boost" for these models regardless of source.

  // Categorize by catalog / type
  switch (blockType) {
    case "wah":
      return "wah";
    case "dynamics":
      // Compressors go to DSP0 compressor slot, gates go differently
      if (model.category === "gate") return "horizon_gate";
      if (model.category === "compressor") return "compressor";
      // Autoswell and other non-compressor/non-gate dynamics (category: "dynamics")
      // are pre-amp effects, not compressors — don't remove in high-gain chains
      return "extra_drive";
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
    case "pre_amp_eq":
    case "amp":
    case "cab":
      return 0;
    case "horizon_gate":  // post-cab: DSP1 for dual-DSP devices
    case "eq":
    case "modulation":
    case "delay":
    case "reverb":
    case "mastering_comp":
    case "gain_block":
      return 1;
  }
}

// Ordering priority within the chain (lower = earlier in signal chain)
const SLOT_ORDER: Record<ChainSlot, number> = {
  wah: 0,
  compressor: 1,
  extra_drive: 2,
  horizon_gate: 5.5, // CHAIN-06: post-cab gate to properly suppress amp noise/hiss
  boost: 3,
  pre_amp_eq: 3.5, // Phase 4.3: Berklee Pre-Amp EQ for tightness
  amp: 4,
  cab: 5,
  eq: 7,
  modulation: 8,
  delay: 9,
  reverb: 10,
  mastering_comp: 10.5, // Phase 4.3: Berklee Post-Reverb glue
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
  nodeId?: string;
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
    ...(pending.slot ? { slot: pending.slot } : {}), // COHERE-03: propagate chain slot for boost disambiguation
    nodeId: pending.nodeId || `${pending.blockType}_${position}`,
  };
}

// ---------------------------------------------------------------------------
// Effect priority scoring (COMBO-03) + Genre-aware scoring (CRAFT-04)
// ---------------------------------------------------------------------------

/** Per-genre slot priority scores for CRAFT-04 genre-aware truncation.
 * Higher score = effect slot is more important for that genre.
 * When genreHint matches a key, these scores replace the generic slot scores. */
const GENRE_SLOT_PRIORITY: Record<string, Partial<Record<ChainSlot, number>>> = {
  metal:   { pre_amp_eq: 20, extra_drive: 18, delay: 12, wah: 10, mastering_comp: 8, compressor: 5, reverb: 3, modulation: 2 },
  ambient: { mastering_comp: 20, reverb: 18, delay: 15, modulation: 15, compressor: 8, extra_drive: 5, wah: 3 },
  worship: { mastering_comp: 20, reverb: 18, delay: 15, modulation: 15, compressor: 8, extra_drive: 5, wah: 3 },
  blues:   { delay: 18, reverb: 15, mastering_comp: 14, extra_drive: 12, compressor: 10, modulation: 5, wah: 8 },
  rock:    { extra_drive: 18, delay: 15, mastering_comp: 14, reverb: 12, compressor: 8, modulation: 5, wah: 10 },
  jazz:    { reverb: 18, mastering_comp: 16, compressor: 15, modulation: 10, delay: 5, extra_drive: 3, wah: 3 },
  country: { delay: 18, compressor: 16, reverb: 15, mastering_comp: 12, modulation: 8, extra_drive: 5, wah: 5 },
  funk:    { compressor: 18, modulation: 15, mastering_comp: 14, delay: 12, reverb: 10, extra_drive: 8, wah: 10 },
  pop:     { mastering_comp: 16, delay: 15, reverb: 12, modulation: 15, compressor: 10, extra_drive: 5, wah: 5 },
};

/** Match a genreHint string to a GENRE_SLOT_PRIORITY key.
 * Returns undefined if no genreHint or no match found.
 * Checks specific genres first, "rock" last as a catch-all for "hard rock", "classic rock", etc. */
function matchGenreKey(genreHint?: string): string | undefined {
  if (!genreHint) return undefined;
  const hint = genreHint.toLowerCase();
  // Check specific genres first (order matters — "rock" last as catch-all)
  const genres = ["metal", "ambient", "worship", "blues", "jazz", "country", "funk", "pop", "rock"];
  for (const genre of genres) {
    if (hint.includes(genre)) return genre;
  }
  return undefined;
}

/** Score an effect for truncation priority (COMBO-03 + CRAFT-04).
 * Higher score = more likely to survive budget truncation.
 * When genreHint is provided, genre-specific slot scores replace generic ones. */
function getEffectPriority(pending: PendingBlock, genreHint?: string): number {
  let score = 0;
  // intentRole scoring (unchanged)
  switch (pending.intentRole) {
    case "always_on": score += 100; break;
    case "toggleable": score += 50; break;
    case "ambient": score += 30; break;
    default: score += 40; break;
  }
  // Genre-aware slot scoring (CRAFT-04)
  const genreKey = matchGenreKey(genreHint);
  const genreScores = genreKey ? GENRE_SLOT_PRIORITY[genreKey] : undefined;
  if (genreScores && pending.slot in genreScores) {
    score += genreScores[pending.slot]!;
  } else {
    // Generic slot-based scoring — fallback when no genre or slot not in genre table
    switch (pending.slot) {
      case "pre_amp_eq": score += 20; break;
      case "wah": score += 18; break;
      case "mastering_comp": score += 16; break;
      case "compressor": score += 15; break;
      case "extra_drive": score += 12; break;
      case "delay": score += 10; break;
      case "reverb": score += 8; break;
      case "modulation": score += 5; break;
      default: score += 5; break;
    }
  }
  return score;
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
  if (!intent.ampName) throw new Error("ToneIntent missing required ampName.");
  if (!intent.cabName) throw new Error("ToneIntent missing required cabName.");

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
    // Dual-amp is capability-driven — only devices with dualAmpSupported: true (Helix Floor/LT/Rack) enter this path
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

    // Track 22C: Explicit Hardware Routing
    // If the planner specifically requests DSP1 or DSP2, override the default slot DSP
    let targetDsp = getDspForSlot(slot, caps);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((effect as any).assignedDSP === "DSP1") targetDsp = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((effect as any).assignedDSP === "DSP2") targetDsp = 1;

    userEffects.push({
      model: resolved.model,
      blockType: resolved.blockType,
      slot,
      dsp: targetDsp,
      intentRole: effect.role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeId: (effect as any).nodeId,
    });
  }

  // COHERE-01: Effect palette balance — max 2 user-selected drives
  // Only count extra_drive slot, NOT boost slot (mandatory boost is infrastructure, not user choice)
  const userDrives = userEffects.filter(e => e.slot === "extra_drive");
  if (userDrives.length > 2) {
    const sorted = [...userDrives].sort(
      (a, b) => getEffectPriority(b, intent.genreHint) - getEffectPriority(a, intent.genreHint)
    );
    const toDrop = new Set(sorted.slice(2));
    for (let i = userEffects.length - 1; i >= 0; i--) {
      if (toDrop.has(userEffects[i])) {
        console.warn(`[chain-rules] COHERE-01: Dropping excess drive "${userEffects[i].model.name}"`);
        userEffects.splice(i, 1);
      }
    }
  }

  // COHERE-02: Reverb soft-mandatory insertion
  // Auto-insert Plate reverb when clean/ambient snapshots present but no reverb in user effects.
  // Inserted into userEffects BEFORE COMBO-03 truncation so priority-based truncation handles budget overflow.
  const hasCleanOrAmbient = intent.snapshots.some(
    s => s.toneRole === "clean" || s.toneRole === "ambient"
  );
  const hasUserReverb = userEffects.some(e => e.blockType === "reverb");

  if (hasCleanOrAmbient && !hasUserReverb) {
    const plateModel = REVERB_MODELS["Plate"]!;
    userEffects.push({
      model: plateModel,
      blockType: "reverb",
      slot: "reverb",
      dsp: getDspForSlot("reverb", caps),
      intentRole: "toggleable",
    });
    console.warn("[chain-rules] COHERE-02: Auto-inserted Plate reverb for clean/ambient snapshots");
  }

  // COMBO-02: Remove compressor from high-gain chains (unless always_on)
  // High-gain amps produce compressed dynamics naturally; adding a compressor
  // squeezes dynamics and reduces pick responsiveness.
  if (ampCategory === "high_gain") {
    const compressorIdx = userEffects.findIndex(
      (e) => e.slot === "compressor" && e.intentRole !== "always_on"
    );
    if (compressorIdx >= 0) {
      console.warn(
        `[chain-rules] COMBO-02: Removing compressor "${userEffects[compressorIdx].model.name}" ` +
        `from high-gain chain — prevents squeezed dynamics`
      );
      userEffects.splice(compressorIdx, 1);
    }
  }

  // PHASE 4.3: Berklee Pre-Amp EQ. Surgically inserted BEFORE amp to cut mud in high gain
  if (ampCategory === "high_gain" && !userEffectNames.has(LOW_HIGH_CUT) && !userEffectNames.has(PARAMETRIC_EQ)) {
    // Prefer Low/High Cut if available, fallback to Parametric
    const preEqModel = isAgouraEra 
      ? (STADIUM_EQ_MODELS[LOW_HIGH_CUT] ?? STADIUM_EQ_MODELS[STADIUM_PARAMETRIC_EQ])
      : (EQ_MODELS[LOW_HIGH_CUT] ?? EQ_MODELS[PARAMETRIC_EQ]);
      
    if (preEqModel) {
      userEffects.push({
        model: preEqModel,
        blockType: "eq",
        slot: "pre_amp_eq",
        dsp: 0,
        intentRole: "toggleable",
      });
      console.warn("[chain-rules] Phase 4.3 (Berklee): Injecting Pre-Amp EQ for high_gain tone tightening");
    }
  }

  // PHASE 4.3: Berklee Post-Reverb Mastering Compressor for 3D depth
  if (!userEffectNames.has(LA_STUDIO_COMP)) {
    const masteringCompModel = DYNAMICS_MODELS[LA_STUDIO_COMP];
    if (masteringCompModel) {
      userEffects.push({
        model: masteringCompModel,
        blockType: "dynamics",
        slot: "mastering_comp",
        dsp: getDspForSlot("mastering_comp", caps),
        intentRole: "toggleable",
      });
      console.warn("[chain-rules] Phase 4.3 (Berklee): Injecting LA Studio Comp for mastering glue");
    }
  }

  // COMBO-03 & Knapsack DSP Solver: Priority-based effect truncation
  // Helix: Infinity (no explicit cap)
  // Pod Go: Max 4 blocks, Max 7 DSP points
  // Stomp: Max 8 blocks, Max 12 DSP points
  if (caps.maxEffectsPerDsp < Infinity && userEffects.length > 0) {
    // Sort by priority descending (highest priority survives)
    // CRAFT-04: pass genreHint for genre-aware slot scoring
    userEffects.sort((a, b) => getEffectPriority(b, intent.genreHint) - getEffectPriority(a, intent.genreHint));

    // Calculate hard limits
    const maxBlocks = caps.maxEffectsPerDsp;
    // Stadium runs in software -> no DSP limit, just block limit
    const isStadium = caps.ampCatalogEra === "agoura";
    const maxDspPoints = isStadium ? Infinity : (maxBlocks === 4 ? 7 : 12);
    const useKnapsack = maxDspPoints < Infinity;

    const keptEffects: PendingBlock[] = [];
    const droppedEffects: PendingBlock[] = [];
    let currentDspPts = 0;

    for (const effect of userEffects) {
      if (keptEffects.length >= maxBlocks) {
        droppedEffects.push(effect);
        continue;
      }
      
      if (useKnapsack) {
        let cost = 1; // drive, eq, comp, etc.
        if (effect.blockType === "pitch") cost = 5;
        else if (effect.blockType === "reverb" || effect.blockType === "delay") cost = 4;
        else if (effect.blockType === "modulation" || effect.blockType === "wah") cost = 2;
        
        if (currentDspPts + cost > maxDspPoints) {
          droppedEffects.push(effect);
          continue; // skip this heavy effect, try the next cheaper one down the priority list
        }
        currentDspPts += cost;
      }
      keptEffects.push(effect);
    }

    if (droppedEffects.length > 0) {
      console.warn(
        `[chain-rules] COMBO-03/Knapsack: Budget exceeded (Blocks: ${keptEffects.length}/${maxBlocks}, DSP: ${currentDspPts}/${maxDspPoints}). ` +
        `Dropped ${droppedEffects.length} item(s): ` +
        droppedEffects.map(e => `${e.model.name}`).join(', ')
      );
    }
    
    // Replace array contents without losing reference
    userEffects.length = 0;
    userEffects.push(...keptEffects);

    // Re-sort remaining by SLOT_ORDER for correct signal chain position
    userEffects.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
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

  // 5b. Horizon Gate for high_gain only (post-cab, before EQ — gates amp noise/hiss)
  if (ampCategory === "high_gain") {
    const gateModel = DYNAMICS_MODELS[HORIZON_GATE]!;
    mandatoryBlocks.push({
      model: gateModel,
      blockType: "dynamics",
      slot: "horizon_gate",
      dsp: getDspForSlot("horizon_gate", caps),
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

  // 8. Enforce DSP block limits — gracefully drop lowest-priority user effects
  //    instead of throwing. Mandatory blocks (boost, horizon_gate, eq, gain_block)
  //    and amp blocks are never dropped.
  const USER_EFFECT_SLOTS: ReadonlySet<ChainSlot> = new Set([
    "wah", "compressor", "extra_drive", "modulation", "delay", "reverb",
  ]);

  if (caps.dspCount === 1) {
    // Single-DSP devices: enforce total block count
    while (allBlocks.length > caps.maxBlocksTotal) {
      // Find droppable user effects, sorted by priority ascending (lowest first)
      const droppable = allBlocks
        .filter((b) => USER_EFFECT_SLOTS.has(b.slot))
        .sort((a, b) => getEffectPriority(a, intent.genreHint) - getEffectPriority(b, intent.genreHint));
      if (droppable.length === 0) break; // safety: nothing left to drop
      const victim = droppable[0];
      console.warn(
        `[chain-rules] Block budget exceeded: dropping "${victim.model.name}" (${victim.intentRole ?? "none"}) to fit ${caps.maxBlocksTotal}-block limit`
      );
      allBlocks.splice(allBlocks.indexOf(victim), 1);
    }
  } else {
    // Dual-DSP devices: enforce per-DSP non-cab block limits
    for (const dspIdx of [0, 1] as const) {
      const label = `DSP${dspIdx}`;
      let nonCab = allBlocks.filter((b) => b.dsp === dspIdx && b.blockType !== "cab");
      while (nonCab.length > caps.maxBlocksPerDsp) {
        const droppable = nonCab
          .filter((b) => USER_EFFECT_SLOTS.has(b.slot))
          .sort((a, b) => getEffectPriority(a, intent.genreHint) - getEffectPriority(b, intent.genreHint));
        if (droppable.length === 0) break; // safety: nothing left to drop
        const victim = droppable[0];
        console.warn(
          `[chain-rules] ${label} budget exceeded: dropping "${victim.model.name}" (${victim.intentRole ?? "none"}) to fit ${caps.maxBlocksPerDsp}-block limit`
        );
        allBlocks.splice(allBlocks.indexOf(victim), 1);
        nonCab = allBlocks.filter((b) => b.dsp === dspIdx && b.blockType !== "cab");
      }
    }
  }

  // Re-sort after any drops
  allBlocks.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

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
