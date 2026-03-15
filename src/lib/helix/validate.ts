import { z } from "zod";
import { getAllModels, STADIUM_AMPS } from "./models";
import type { PresetSpec } from "./types";
import type { DeviceCapabilities } from "./device-family";
import { STADIUM_CONFIG, STOMP_CONFIG, HELIX_SYSTEM_MODELS, POD_GO_SYSTEM_MODELS } from "./config";

// Build a set of all valid model IDs from our database
function getValidModelIds(): Set<string> {
  const models = getAllModels();
  const ids = new Set<string>();
  for (const model of Object.values(models)) {
    ids.add(model.id);
  }
  // Also add system models that are always valid
  // Helix Floor/Rack/LT system models
  ids.add(HELIX_SYSTEM_MODELS.FLOW1_INPUT);
  ids.add(HELIX_SYSTEM_MODELS.FLOW2_INPUT);
  ids.add(HELIX_SYSTEM_MODELS.FLOW_OUTPUT);
  ids.add(HELIX_SYSTEM_MODELS.SPLIT_AB);
  ids.add(HELIX_SYSTEM_MODELS.MERGER_MIXER);
  // Pod Go system models
  ids.add(POD_GO_SYSTEM_MODELS.INPUT);
  ids.add(POD_GO_SYSTEM_MODELS.OUTPUT);
  // Stadium system models (P35_* prefix — verified from real .hsp files)
  ids.add(STADIUM_CONFIG.STADIUM_INPUT_MODEL);
  ids.add(STADIUM_CONFIG.STADIUM_INPUT_NONE_MODEL);
  ids.add(STADIUM_CONFIG.STADIUM_OUTPUT_MODEL);
  // Stomp system models (HelixStomp_* prefix — confirmed from Swell_Delay.hlx, 2026-03-04)
  ids.add(STOMP_CONFIG.STOMP_INPUT_MODEL);
  ids.add(STOMP_CONFIG.STOMP_OUTPUT_MAIN_MODEL);
  ids.add(STOMP_CONFIG.STOMP_OUTPUT_SEND_MODEL);
  // Stadium effect models (HX2_* prefix — Stadium-specific effect IDs confirmed from real .hsp files, 2026-03-05)
  ids.add("HX2_CompressorDeluxeCompMono");
  ids.add("HX2_CompressorLAStudioCompStereo");
  ids.add("HX2_EQParametricStereo");
  ids.add("HX2_GateHorizonGateMono");
  ids.add("HX2_GateNoiseGateStereo");
  // Stadium reverb/dynamics models (VIC_* prefix — confirmed from real .hsp files, 2026-03-05)
  ids.add("VIC_DynPlateStereo");
  ids.add("VIC_ReverbDynAmbienceStereo");
  ids.add("VIC_ReverbDynRoomStereo");
  ids.add("VIC_ReverbRotatingStereo");
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
 * @param caps - Device capabilities for device-specific validation rules
 */
export function validatePresetSpec(spec: PresetSpec, caps: DeviceCapabilities): void {
  const validIds = caps.fileFormat === "pgp" ? VALID_IDS_WITH_SUFFIXES : VALID_IDS;

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

      // Delay Taps: integer parameter (e.g., Multi Pass uses 1-4 taps)
      if (block.type === "delay" && key === "Taps") {
        if (value < 1 || value > 16 || !Number.isInteger(value)) {
          throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected integer 1-16)`);
        }
        continue;
      }

      // Stadium amp blocks: firmware params use raw Hz/dB/integer values — skip 0-1 check
      // (corpus-verified tables contain AmpCabPeak2Fc: 1000, Level: -10, Channel: 1, etc.)
      if (block.type === "amp" && STADIUM_AMPS[block.modelName]) {
        continue;
      }

      // Stadium Parametric EQ (HX2_EQParametric): uses real Hz/dB/Q/slope values — skip 0-1 check
      if (block.type === "eq" && block.modelId.startsWith("HX2_EQParametric")) {
        continue;
      }

      // Modulation/dynamics blocks with firmware-verified Level > 1.0 or integer params
      // (e.g., Script Mod Phase Level: 2.0 dB, SyncSelect1: 6, Horizon Gate Mode: 1)
      if (key === "Level" && (block.type === "modulation" || block.type === "dynamics")) {
        if (value >= -20.0 && value <= 20.0) continue;
      }
      if (key === "Mode" || key === "SyncSelect1" || key === "SyncSelect2") {
        if (Number.isInteger(value) && value >= 0 && value <= 16) continue;
      }

      // All other params: 0.0-1.0 normalized
      if (value < 0.0 || value > 1.0) {
        throw new Error(`Parameter '${key}' value ${value} out of range for block '${block.modelName}' (expected 0.0-1.0)`);
      }
    }
  }

  // 7. DSP block limits — caps-driven (KLAYER-03)
  if (caps.dspCount === 1) {
    // Single-DSP devices (Pod Go, Stadium, Stomp): all blocks on dsp0
    const nonDsp0 = spec.signalChain.filter(b => b.dsp !== 0);
    if (nonDsp0.length > 0) {
      throw new Error(`Preset has blocks on dsp1 — all blocks must be on dsp0 for this device`);
    }
    const totalBlocks = spec.signalChain.length;
    if (totalBlocks > caps.maxBlocksTotal) {
      throw new Error(`Block limit exceeded (${totalBlocks} blocks, max ${caps.maxBlocksTotal})`);
    }
    // Snapshot validation
    if (caps.fileFormat === "pgp") {
      // Pod Go .pgp requires exactly maxSnapshots (PGSNAP-01)
      if (spec.snapshots.length !== caps.maxSnapshots) {
        throw new Error(`Pod Go requires exactly ${caps.maxSnapshots} snapshots (got ${spec.snapshots.length})`);
      }
    } else if (spec.snapshots.length > caps.maxSnapshots) {
      throw new Error(`Snapshot limit exceeded (${spec.snapshots.length}, max ${caps.maxSnapshots})`);
    }
  } else {
    // Dual-DSP devices (Helix Floor/LT/Rack): max blocks per DSP (non-cab)
    const dsp0Count = spec.signalChain.filter(b => b.dsp === 0 && b.type !== "cab").length;
    const dsp1Count = spec.signalChain.filter(b => b.dsp === 1 && b.type !== "cab").length;
    if (dsp0Count > caps.maxBlocksPerDsp) {
      throw new Error(`DSP0 exceeds ${caps.maxBlocksPerDsp}-block limit (${dsp0Count} blocks)`);
    }
    if (dsp1Count > caps.maxBlocksPerDsp) {
      throw new Error(`DSP1 exceeds ${caps.maxBlocksPerDsp}-block limit (${dsp1Count} blocks)`);
    }
  }

  // 8. DSP ordering advisory check (MED-02)
  validateDspOrdering(spec, caps);
}

// ---------------------------------------------------------------------------
// DSP ordering validation (MED-02)
// Advisory check: warns if blocks within a DSP are out of expected order.
// Uses block type to infer expected position — not a hard error since
// chain-rules.ts may have valid reasons for non-standard ordering.
// ---------------------------------------------------------------------------

const BLOCK_TYPE_ORDER: Record<string, number> = {
  distortion: 2,  // wah/comp/drive/boost all before amp
  dynamics: 1,    // compressor before distortion
  amp: 4,
  cab: 5,
  eq: 7,
  modulation: 8,
  delay: 9,
  reverb: 10,
  volume: 11,     // gain block at end
};

function validateDspOrdering(spec: PresetSpec, caps: DeviceCapabilities): void {
  function checkOrdering(blocks: PresetSpec["signalChain"], dspLabel: string): void {
    let prevOrder = -1;
    let prevName = "";
    for (const block of blocks) {
      const order = BLOCK_TYPE_ORDER[block.type] ?? 6;
      if (order < prevOrder) {
        console.warn(
          `[validate] DSP ordering: ${block.modelName} (${block.type}) appears after ${prevName} on ${dspLabel} — expected earlier in chain`
        );
      }
      prevOrder = order;
      prevName = block.modelName;
    }
  }

  if (caps.dspCount === 1) {
    checkOrdering(spec.signalChain, "dsp0");
  } else {
    checkOrdering(spec.signalChain.filter(b => b.dsp === 0), "dsp0");
    checkOrdering(spec.signalChain.filter(b => b.dsp === 1), "dsp1");
  }
}

// ---------------------------------------------------------------------------
// Strict Zod Schemas for PresetSpec Sanitization
// ---------------------------------------------------------------------------

const baseBlockSchema = z.object({
  type: z.enum(["amp", "cab", "distortion", "delay", "reverb", "modulation", "dynamics", "eq", "wah", "pitch", "volume", "send_return"]),
  modelId: z.string(),
  modelName: z.string(),
  dsp: z.union([z.literal(0), z.literal(1)]),
  position: z.number().int().min(0),
  path: z.number().int().min(0),
  enabled: z.boolean(),
  stereo: z.boolean(),
  trails: z.boolean().optional(),
  intentRole: z.enum(["always_on", "toggleable", "ambient"]).optional(),
  slot: z.string().optional(),
  parameters: z.record(z.string(), z.union([z.number(), z.boolean()])),
}).superRefine((block, ctx) => {
  // Strip hallucinated parameters not found in models.ts
  const models = getAllModels();
  
  // Try to find the exact model, or base model if suffixed
  let modelObj = Object.values(models).find(m => m.id === block.modelId);
  if (!modelObj) {
    // Check if it's a model with 'Mono' or 'Stereo' suffix
    const baseId = block.modelId.replace(/(Mono|Stereo)$/, "");
    modelObj = Object.values(models).find(m => m.id === baseId);
  }

  if (modelObj && modelObj.defaultParams) {
    const validKeys = new Set(Object.keys(modelObj.defaultParams));
    for (const key of Object.keys(block.parameters)) {
      if (!validKeys.has(key)) {
        // Hallucinated parameter — delete it
        delete block.parameters[key];
      }
    }
  }
});

const snapshotSchema = z.object({
  name: z.string(),
  description: z.string(),
  ledColor: z.number().int(),
  blockStates: z.record(z.string(), z.boolean()),
  parameterOverrides: z.record(z.string(), z.record(z.string(), z.union([z.number(), z.boolean()]))),
});

export const presetSpecSchema = z.object({
  name: z.string(),
  description: z.string(),
  tempo: z.number().min(20).max(300),
  guitarNotes: z.string().optional(),
  variaxModel: z.string().optional(),
  signalChain: z.array(baseBlockSchema),
  snapshots: z.array(snapshotSchema),
});

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

  // 0. Zod Schema Sanitization
  // Deep clone so we don't mutate the original directly until validation passes
  let fixedSpec: PresetSpec;
  try {
    fixedSpec = presetSpecSchema.parse(JSON.parse(JSON.stringify(spec)));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`Zod Schema Validation Failed: ${message}`);
    return { valid: false, errors, fixed: false };
  }

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
    const newParamOverrides: Record<string, Record<string, number | boolean>> = {};

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

      // Stadium amp blocks: firmware params use raw Hz/dB/integer values — skip clamping
      if (block.type === "amp" && STADIUM_AMPS[block.modelName]) {
        continue;
      }

      // Stadium Parametric EQ: uses real Hz/dB/Q/slope values — skip clamping
      if (block.type === "eq" && block.modelId?.startsWith("HX2_EQParametric")) {
        continue;
      }

      // Modulation/dynamics blocks with firmware-verified Level > 1.0 or integer params
      if (key === "Level" && (block.type === "modulation" || block.type === "dynamics")) {
        if (typeof value === "number" && value >= -20.0 && value <= 20.0) continue;
      }
      if (key === "Mode" || key === "SyncSelect1" || key === "SyncSelect2") {
        if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 16) continue;
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
