import { getAllModels } from "./models";
import type { PresetSpec, DeviceTarget } from "./types";
import { isPodGo, isStadium } from "./types";
import { STADIUM_CONFIG } from "./config";

// Build a set of all valid model IDs from our database
function getValidModelIds(): Set<string> {
  const models = getAllModels();
  const ids = new Set<string>();
  for (const model of Object.values(models)) {
    ids.add(model.id);
  }
  // Also add system models that are always valid
  ids.add("HD2_AppDSPFlow1Input");
  ids.add("HD2_AppDSPFlow2Input");
  ids.add("HD2_AppDSPFlowOutput");
  ids.add("HD2_SplitAB");
  ids.add("HD2_MergerMixer");
  // Pod Go system models
  ids.add("P34_AppDSPFlowInput");
  ids.add("P34_AppDSPFlowOutput");
  // Stadium system models (P35_* prefix, Phase 35 will add more) (STAD-04)
  ids.add("P35_AppDSPFlowInput");
  ids.add("P35_AppDSPFlowOutput");
  return ids;
}

const VALID_IDS = getValidModelIds();

// Build extended set that includes Pod Go suffixed model IDs
function getValidModelIdsWithSuffixes(): Set<string> {
  const ids = new Set(VALID_IDS);
  const models = getAllModels();
  for (const model of Object.values(models)) {
    // Add Mono/Stereo suffixed variants for Pod Go effect models
    if (!model.id.startsWith("HD2_Amp") && !model.id.startsWith("HD2_Cab")) {
      ids.add(model.id + "Mono");
      ids.add(model.id + "Stereo");
    }
  }
  return ids;
}

const VALID_IDS_WITH_SUFFIXES = getValidModelIdsWithSuffixes();

/**
 * Strict validation that throws on structural errors instead of auto-correcting.
 * The Knowledge Layer should produce valid specs, so any failure here indicates a bug.
 * Call this before buildHlxFile/buildPgpFile in the generate pipeline.
 *
 * @param device - Optional device target for device-specific validation rules
 */
export function validatePresetSpec(spec: PresetSpec, device?: DeviceTarget): void {
  const podGo = device ? isPodGo(device) : false;
  const stadium = device ? isStadium(device) : false;
  const validIds = podGo ? VALID_IDS_WITH_SUFFIXES : VALID_IDS;

  // 1. Signal chain not empty
  if (!spec.signalChain || spec.signalChain.length === 0) {
    throw new Error("PresetSpec has empty signal chain");
  }

  // 2. At least one amp block
  if (!spec.signalChain.some(b => b.type === "amp")) {
    throw new Error("PresetSpec missing amp block");
  }

  // 3. At least one cab block
  if (!spec.signalChain.some(b => b.type === "cab")) {
    throw new Error("PresetSpec missing cab block");
  }

  // 4. All model IDs valid
  for (const block of spec.signalChain) {
    if (!validIds.has(block.modelId)) {
      throw new Error(`Invalid model ID '${block.modelId}' for block '${block.modelName}'`);
    }
  }

  // 5. Snapshots present
  if (!spec.snapshots || spec.snapshots.length === 0) {
    throw new Error("PresetSpec has no snapshots");
  }

  // 6. Parameter ranges (type-aware)
  for (const block of spec.signalChain) {
    for (const [key, value] of Object.entries(block.parameters)) {
      if (typeof value !== "number") continue;

      // Cab Mic: integer 0-15
      if (block.type === "cab" && key === "Mic") {
        if (value < 0 || value > 15 || !Number.isInteger(value)) {
          throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected integer 0-15)`);
        }
        continue;
      }

      // LowCut: Hz-encoded for cab, reverb, and delay blocks (19.9-500.0 Hz)
      if ((block.type === "cab" || block.type === "reverb" || block.type === "delay") && key === "LowCut") {
        if (value < 19.9 || value > 500.0) {
          throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected 19.9-500.0 Hz)`);
        }
        continue;
      }

      // HighCut: Hz-encoded for cab, reverb, and delay blocks (1000.0-20100.0 Hz)
      if ((block.type === "cab" || block.type === "reverb" || block.type === "delay") && key === "HighCut") {
        if (value < 1000.0 || value > 20100.0) {
          throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected 1000.0-20100.0 Hz)`);
        }
        continue;
      }

      // All other params: 0.0-1.0 normalized
      if (value < 0.0 || value > 1.0) {
        throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected 0.0-1.0)`);
      }
    }
  }

  // 7. DSP block limits
  if (podGo) {
    // Pod Go: single DSP, all blocks on dsp0 (PGP-05, PGCHAIN-01)
    const nonDsp0 = spec.signalChain.filter(b => b.dsp !== 0);
    if (nonDsp0.length > 0) {
      throw new Error(`Pod Go preset has blocks on dsp1 — all blocks must be on dsp0`);
    }
    const totalBlocks = spec.signalChain.length;
    if (totalBlocks > 10) {
      throw new Error(`Pod Go exceeds 10-block limit (${totalBlocks} blocks)`);
    }
    // Validate exactly 4 snapshots (PGSNAP-01)
    if (spec.snapshots.length !== 4) {
      throw new Error(`Pod Go requires exactly 4 snapshots (got ${spec.snapshots.length})`);
    }
  } else if (stadium) {
    // Stadium: single path (dsp0), max 12 blocks (STAD-04)
    const nonDsp0 = spec.signalChain.filter(b => b.dsp !== 0);
    if (nonDsp0.length > 0) {
      throw new Error(`Stadium preset has blocks on dsp1 — Stadium v3.0 is single-path only (all blocks must be on dsp0)`);
    }
    const totalBlocks = spec.signalChain.length;
    if (totalBlocks > STADIUM_CONFIG.STADIUM_MAX_BLOCKS_PER_PATH) {
      throw new Error(`Stadium exceeds ${STADIUM_CONFIG.STADIUM_MAX_BLOCKS_PER_PATH}-block limit (${totalBlocks} blocks)`);
    }
    // Stadium supports up to 8 snapshots (STAD-04)
    if (spec.snapshots.length > STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS) {
      throw new Error(`Stadium supports at most ${STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS} snapshots (got ${spec.snapshots.length})`);
    }
  } else {
    // Helix: dual DSP, max 8 non-cab blocks per DSP
    const dsp0Count = spec.signalChain.filter(b => b.dsp === 0 && b.type !== "cab").length;
    const dsp1Count = spec.signalChain.filter(b => b.dsp === 1 && b.type !== "cab").length;
    if (dsp0Count > 8) {
      throw new Error(`DSP0 exceeds 8-block limit (${dsp0Count} blocks)`);
    }
    if (dsp1Count > 8) {
      throw new Error(`DSP1 exceeds 8-block limit (${dsp1Count} blocks)`);
    }
  }
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  fixed: boolean;
  fixedSpec?: PresetSpec;
}

// Validate and fix a preset spec before building the .hlx file
export function validateAndFixPresetSpec(spec: PresetSpec): ValidationResult {
  const errors: string[] = [];
  let fixed = false;

  // Deep clone so we don't mutate the original
  const fixedSpec: PresetSpec = JSON.parse(JSON.stringify(spec));

  // 1. Validate all model IDs exist in our database
  for (const block of fixedSpec.signalChain) {
    if (!VALID_IDS.has(block.modelId)) {
      const suggestion = findClosestModelId(block.modelId);
      if (suggestion) {
        errors.push(`Invalid model ID "${block.modelId}" for ${block.modelName} — auto-corrected to "${suggestion}"`);
        block.modelId = suggestion;
        fixed = true;
      } else {
        errors.push(`Invalid model ID "${block.modelId}" for ${block.modelName} — no close match found, removing block`);
      }
    }
  }

  // Remove blocks with still-invalid IDs
  fixedSpec.signalChain = fixedSpec.signalChain.filter(b => VALID_IDS.has(b.modelId));

  // 2. Fix block positions to be sequential within each DSP
  const dsp0Blocks = fixedSpec.signalChain.filter(b => b.dsp === 0 && b.type !== "cab");
  const dsp1Blocks = fixedSpec.signalChain.filter(b => b.dsp === 1 && b.type !== "cab");

  dsp0Blocks.forEach((b, i) => {
    if (b.position !== i) {
      b.position = i;
      fixed = true;
    }
  });
  dsp1Blocks.forEach((b, i) => {
    if (b.position !== i) {
      b.position = i;
      fixed = true;
    }
  });

  // 3. Fix snapshot block references to use correct per-DSP block keys
  for (const snapshot of fixedSpec.snapshots) {
    const newBlockStates: Record<string, boolean> = {};
    const newParamOverrides: Record<string, Record<string, number>> = {};

    // Map block keys correctly for each DSP
    for (const [blockKey, enabled] of Object.entries(snapshot.blockStates)) {
      // Try to match the blockKey to an actual block
      const correctedKey = resolveBlockKey(blockKey, fixedSpec.signalChain);
      if (correctedKey) {
        newBlockStates[correctedKey] = enabled;
        if (correctedKey !== blockKey) fixed = true;
      }
    }

    for (const [blockKey, params] of Object.entries(snapshot.parameterOverrides)) {
      const correctedKey = resolveBlockKey(blockKey, fixedSpec.signalChain);
      if (correctedKey) {
        newParamOverrides[correctedKey] = params;
        if (correctedKey !== blockKey) fixed = true;
      }
    }

    snapshot.blockStates = newBlockStates;
    snapshot.parameterOverrides = newParamOverrides;
  }

  // 4. Ensure all snapshots reference ALL non-cab blocks with a bypass state
  for (const snapshot of fixedSpec.snapshots) {
    let dsp0Index = 0;
    let dsp1Index = 0;
    for (const block of fixedSpec.signalChain) {
      if (block.type === "cab") continue;
      const key = block.dsp === 0 ? `block${dsp0Index}` : `block${dsp1Index}`;
      if (block.dsp === 0) dsp0Index++;
      else dsp1Index++;

      // If this block isn't in the snapshot's blockStates, add it with its default
      if (!(key in snapshot.blockStates)) {
        snapshot.blockStates[key] = block.enabled;
        fixed = true;
      }
    }
  }

  // 5. Clamp parameter values (type-aware: Hz for cab LowCut/HighCut, integer index for Mic, normalized 0-1 for everything else)
  for (const block of fixedSpec.signalChain) {
    for (const [key, value] of Object.entries(block.parameters)) {
      // Cab Mic is an integer mic index (0-15), not normalized 0-1
      if (block.type === "cab" && key === "Mic") {
        if (typeof value === "number") {
          block.parameters[key] = Math.max(0, Math.min(15, Math.round(value)));
        }
        continue;
      }

      // Cab LowCut is Hz-encoded (valid: 19.9–500.0). Values < 19.9 are likely normalized-float bugs.
      if (block.type === "cab" && key === "LowCut") {
        if (typeof value === "number" && value < 19.9) {
          console.warn(`[validate] Cab block has LowCut=${value} — looks like normalized float, should be Hz (e.g., 80.0). Correcting to 80.0`);
          block.parameters[key] = 80.0;
          fixed = true;
        }
        continue;
      }

      // Cab HighCut is Hz-encoded (valid: 1000.0–20100.0). Values < 100.0 are likely normalized-float bugs.
      if (block.type === "cab" && key === "HighCut") {
        if (typeof value === "number" && value < 100.0) {
          console.warn(`[validate] Cab block has HighCut=${value} — looks like normalized float, should be Hz (e.g., 8000.0). Correcting to 8000.0`);
          block.parameters[key] = 8000.0;
          fixed = true;
        }
        continue;
      }

      if (typeof value === "number" && (value < 0 || value > 1)) {
        block.parameters[key] = Math.max(0, Math.min(1, value));
        fixed = true;
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    fixed,
    fixedSpec,
  };
}

// Find the closest matching model ID using string similarity
function findClosestModelId(badId: string): string | null {
  const normalized = badId.toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const validId of VALID_IDS) {
    const score = similarity(normalized, validId.toLowerCase());
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = validId;
    }
  }

  return bestMatch;
}

// Simple Jaccard-ish similarity on character trigrams
function similarity(a: string, b: string): number {
  const trigramsA = new Set<string>();
  const trigramsB = new Set<string>();
  for (let i = 0; i <= a.length - 3; i++) trigramsA.add(a.slice(i, i + 3));
  for (let i = 0; i <= b.length - 3; i++) trigramsB.add(b.slice(i, i + 3));

  let intersection = 0;
  for (const t of trigramsA) {
    if (trigramsB.has(t)) intersection++;
  }
  const union = trigramsA.size + trigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Resolve a possibly-wrong block key to the correct per-DSP block key
function resolveBlockKey(key: string, signalChain: PresetSpec["signalChain"]): string | null {
  // If the key is already in a valid format (block0-block15), check if it maps to an actual block
  const match = key.match(/^block(\d+)$/);
  if (!match) return null;

  const index = parseInt(match[1]);

  // Count non-cab blocks per DSP to see if this index is valid
  const dsp0NonCab = signalChain.filter(b => b.dsp === 0 && b.type !== "cab");
  const dsp1NonCab = signalChain.filter(b => b.dsp === 1 && b.type !== "cab");
  const totalDsp0 = dsp0NonCab.length;
  const totalDsp1 = dsp1NonCab.length;

  // If index is within dsp0 range, it's a dsp0 block
  if (index < totalDsp0) {
    return `block${index}`;
  }

  // If the AI used global numbering (dsp0 blocks 0-N, then dsp1 starting at N+1),
  // remap to per-DSP numbering
  if (index >= totalDsp0 && index < totalDsp0 + totalDsp1) {
    return `block${index - totalDsp0}`;
  }

  // Index is out of range entirely — try to keep it if small enough
  if (index < Math.max(totalDsp0, totalDsp1)) {
    return key;
  }

  return null;
}
