import { getAllModels } from "./models";
import type { PresetSpec } from "./types";

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
  return ids;
}

const VALID_IDS = getValidModelIds();

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

  // 5. Clamp parameter values to 0-1 range (except cab Mic which is an integer index)
  for (const block of fixedSpec.signalChain) {
    for (const [key, value] of Object.entries(block.parameters)) {
      // Cab Mic is an integer mic index (0-7), not normalized 0-1
      if (block.type === "cab" && key === "Mic") {
        if (typeof value === "number") {
          block.parameters[key] = Math.max(0, Math.min(7, Math.round(value)));
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
