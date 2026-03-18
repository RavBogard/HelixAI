// src/lib/helix/stadium-builder.ts
// Helix Stadium preset builder — generates .hsp files for Line 6 Helix Stadium.
//
// Format verified against real .hsp files from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/
//   Reference: Agoura_Bassman.hsp — field-by-field comparison used for format verification.
//
//   Reference: Agoura_Bassman.hsp — field-by-field comparison used for format verification.
//
// .hsp format: 8-byte magic header "rpshnosj" + JSON.stringify({ meta, preset })
// Block format: slot-based ({ slot: [{ model, params: { K: { value: X, access: "enabled" } } }] })
//
// Public API: buildHspFile(spec) -> { magic, json, serialized }
//             summarizeStadiumPreset(spec) -> string

import type { PresetSpec, BlockSpec, SnapshotSpec, AmpCategory } from "./types";
import { DEVICE_IDS } from "./types";
import { STADIUM_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Position 0 = input, position 13 = output (fixed by firmware) */
const INPUT_POSITION = 0;
const OUTPUT_POSITION = 13;

// Block types that need amp-style harness params
const AMP_TYPES = new Set(["amp"]);
const CAB_TYPES = new Set(["cab"]);

// ---------------------------------------------------------------------------
// STAD-07: Stadium effect model ID suffix mapping
//
// Stadium firmware requires Mono/Stereo suffixes on ALL effect model IDs.
// Pre-amp effects (before amp in signal chain) → "Mono" suffix
// Post-amp effects (after cab in signal chain) → "Stereo" suffix
// Amps, cabs, inputs, outputs, splits, joins → NO suffix
//
// Additionally, some models use different prefixes in Stadium firmware
// (e.g., HD2_GateHorizonGate → HX2_GateHorizonGate). These are mapped
// in STADIUM_MODEL_BASE_OVERRIDES.
//
// Verified against professional .hsp files:
//   Agoura_Bassman.hsp, NH_BoomAuRang.hsp, Stadium_Rock_Rhythm.hsp
// ---------------------------------------------------------------------------

/**
 * Models whose base ID differs between Helix and Stadium firmware.
 * Key: our catalog's model ID (HD2_ prefix)
 * Value: correct Stadium base model ID (before Mono/Stereo suffix)
 *
 * Only effects that changed prefixes need to be listed here.
 * Most HD2_ effects work as-is with just the Mono/Stereo suffix appended.
 */
const STADIUM_MODEL_BASE_OVERRIDES: Record<string, string> = {
  // Horizon Gate uses HX2_ prefix in all professional Stadium presets
  "HD2_GateHorizonGate": "HX2_GateHorizonGate",
  // Stadium Parametric EQ uses HX2_ prefix; regular HD2_EQParametric also maps to HX2_
  "HD2_EQParametric": "HX2_EQParametric",
};

/**
 * Maps block type to the mandatory Mono/Stereo suffix for Stadium effect models.
 * Replicates the proven Pod Go compatibility matrix.
 */
/**
 * Models that must NOT receive a Mono/Stereo suffix.
 * These are non-HD2/HX2 models that use their own naming convention.
 * Verified against Badonkulous.hsp factory preset (e.g., TapeEater at b09).
 */
const NO_SUFFIX_MODELS = new Set([
  "TapeEater",
]);

const STADIUM_EFFECT_SUFFIX: Record<string, "Mono" | "Stereo"> = {
  distortion: "Mono",
  dynamics: "Mono",
  eq: "Mono",
  pitch: "Mono",
  delay: "Stereo",
  reverb: "Stereo",
  modulation: "Stereo",
  wah: "Stereo",
  volume: "Stereo",
  send_return: "Mono",
};

// ---------------------------------------------------------------------------
// STAD-04: Slot-grid block key allocation
// Key formula: key = 'b' + String(position).padStart(2, '0')
// Invariant: key bNN implies "position": NN inside the block JSON
// ---------------------------------------------------------------------------

/** Returns the bNN key for a slot position. */
function makeBlockKey(slotPosition: number): string {
  return `b${String(slotPosition).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// STAD-05: FX block type mapping
// All effect blocks use type "fx" in real .hsp files.
// Only structural blocks (amp, cab, input, output, split, join, looper) retain named types.
// ---------------------------------------------------------------------------

function getStadiumBlockType(blockSpecType: BlockSpec["type"]): string {
  switch (blockSpecType) {
    case "amp":         return "amp";
    case "cab":         return "cab";
    // All effect categories map to "fx"
    case "distortion":
    case "dynamics":
    case "eq":
    case "delay":
    case "reverb":
    case "modulation":
    case "wah":
    case "pitch":
    case "volume":
    case "send_return":
    default:
      return "fx";
  }
}

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface HspFile {
  /** The 8-byte ASCII magic header ("rpshnosj") */
  magic: string;
  /** The JSON-serializable content object */
  json: HspJson;
  /** Full serialized .hsp content: magic + JSON.stringify(json) */
  serialized: string;
}

interface HspJson {
  meta: StadiumMeta;
  preset: StadiumPreset;
}

interface StadiumMeta {
  color: string;
  device_id: number;
  device_version: number;
  info: string;
  name: string;
}

interface StadiumSnapshotEntry {
  color?: string;
  expsw: number;
  name: string;
  source: number;
  tempo: number;
  valid: boolean;
}

interface StadiumPreset {
  clip: Record<string, unknown>;
  /** STAD-05 cursor fix: present in every real .hsp file at the preset level */
  cursor: { flow: number; path: number; position: number };
  flow: Array<Record<string, unknown>>;
  params: {
    activeexpsw: number;
    activesnapshot: number;
    inst1Z: string;
    inst2Z: string;
    tempo: number;
  };
  snapshots: StadiumSnapshotEntry[];
  sources: Record<string, unknown>;
  xyctrl: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Helix Stadium .hsp preset file from a PresetSpec.
 *
 * Returns an HspFile with:
 *   - magic: "rpshnosj" (the 8-byte header)
 *   - json: the parsed JSON content
 *   - serialized: magic + JSON.stringify(json) — write this to disk as the .hsp file
 */
export function buildHspFile(spec: PresetSpec): HspFile {
  const meta = buildStadiumMeta(spec);
  const preset = buildStadiumPreset(spec);

  const json: HspJson = { meta, preset };
  const serialized = STADIUM_CONFIG.STADIUM_MAGIC_HEADER + JSON.stringify(json);

  return {
    magic: STADIUM_CONFIG.STADIUM_MAGIC_HEADER,
    json,
    serialized,
  };
}

/**
 * Return a human-readable summary of a Stadium preset for display in the UI.
 */
export function summarizeStadiumPreset(spec: PresetSpec): string {
  const lines: string[] = [];
  lines.push(`## ${spec.name} (Helix Stadium)`);
  lines.push(spec.description);
  lines.push("");

  if (spec.guitarNotes) {
    lines.push(`**Guitar Notes:** ${spec.guitarNotes}`);
    lines.push("");
  }

  lines.push(`**Tempo:** ${spec.tempo} BPM`);
  lines.push("");

  lines.push("### Signal Chain");
  const allBlocks = spec.signalChain.filter(b => b.type !== "cab");
  const cabBlocks = spec.signalChain.filter(b => b.type === "cab");

  if (allBlocks.length > 0) {
    lines.push("**Path 1A:**");
    for (const block of allBlocks.sort((a, b) => a.position - b.position)) {
      const status = block.enabled ? "ON" : "OFF";
      lines.push(`  ${block.position + 1}. ${block.modelName} [${status}]`);
    }
  }

  if (cabBlocks.length > 0) {
    lines.push("**Cabinet:**");
    for (const cab of cabBlocks) {
      lines.push(`  - ${cab.modelName}`);
    }
  }

  lines.push("");
  lines.push("### Snapshots");
  for (let i = 0; i < spec.snapshots.length; i++) {
    const snap = spec.snapshots[i];
    if (snap) {
      lines.push(`  ${i + 1}. ${snap.name}`);
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Meta builder
// ---------------------------------------------------------------------------

function buildStadiumMeta(spec: PresetSpec): StadiumMeta {
  return {
    color: "auto",
    device_id: DEVICE_IDS.helix_stadium,
    device_version: STADIUM_CONFIG.STADIUM_DEVICE_VERSION,
    info: "",
    name: spec.name.substring(0, 32),
  };
}

// ---------------------------------------------------------------------------
// Preset builder
// ---------------------------------------------------------------------------

function buildStadiumPreset(spec: PresetSpec): StadiumPreset {
  const ampCategory = spec.ampCategory ?? "clean";
  const flow = buildStadiumFlow(spec, ampCategory);
  const snapshots = buildStadiumSnapshots(spec);
  const sources = buildStadiumSources();

  return {
    clip: {
      end: 10.0,
      filename: "<EMPTY>",
      path: "USER CLIPS",
      start: 0.0,
    },
    // Fix: cursor field required in every real .hsp file (Phase 53, STAD-05/cursor)
    cursor: { flow: 0, path: 0, position: 0 },
    flow,
    params: {
      activeexpsw: 1,
      activesnapshot: 0,
      inst1Z: "FirstEnabled",
      inst2Z: "FirstEnabled",  // STAD-07: required by firmware — present in ALL professional .hsp files
      tempo: spec.tempo,
    },
    snapshots,
    sources,
    xyctrl: {
      rbtime: 0.5,
      rubberband: 1,
      x: 0,
      y: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Flow / path builder
// ---------------------------------------------------------------------------

/**
 * Build preset.flow — array of flow (path) objects.
 *
 * Flow 0: Active path with input, effect blocks, cab, and output.
 * Flow 1: Empty path (InputNone → OutputMatrix) — required by firmware.
 *
 * Block layout (Phase 53 fix, STAD-04 — slot-grid allocation):
 *   b00 = input (P35_InputInst1), position 0  — always fixed
 *   b01..b04 = pre-amp effects (gate, boost, etc.)
 *   b05 = amp  — always canonical slot 5
 *   b06 = cab  — always canonical slot 6 (amp + 1)
 *   b07..b12 = post-amp effects (delay, reverb, modulation, eq, etc.)
 *   b13 = output (P35_OutputMatrix), position 13 — always fixed
 *
 * Invariant: key bNN implies "position": NN inside the block JSON.
 * Amp and cab blocks are linked via `linkedblock`.
 * Per-snapshot bypass states are stored in each block's @enabled.snapshots array.
 */
function buildStadiumFlow(spec: PresetSpec, ampCategory: AmpCategory): Array<Record<string, unknown>> {
  // Sort signal chain blocks by their logical position
  const sortedChain = [...spec.signalChain].sort((a, b) => a.position - b.position);

  // Classify blocks into pre-amp, amp(s), cab, and post-amp
  // Dual-amp support: factory presets can have 2 amps (b05 + b06) with cab at b07
  const ampBlocks = sortedChain.filter(b => b.type === "amp");
  const firstAmpIndex = sortedChain.findIndex(b => b.type === "amp");
  const lastAmpIndex = ampBlocks.length > 1
    ? sortedChain.lastIndexOf(ampBlocks[ampBlocks.length - 1]!)
    : firstAmpIndex;

  // Pre-amp effect blocks: everything before first amp that isn't a cab
  const preAmpBlocks = sortedChain
    .filter((_, i) => i < firstAmpIndex && sortedChain[i]!.type !== "cab")
    .map((block, i) => ({ block, originalIndex: spec.signalChain.indexOf(block), slotName: i === 0 ? "pre_gate" : i === 1 ? "pre_boost" : i === 2 ? "pre_effect_1" : "pre_effect_2" }));

  const ampBlock = firstAmpIndex >= 0 ? sortedChain[firstAmpIndex] : undefined;
  const ampOriginalIndex = ampBlock ? spec.signalChain.indexOf(ampBlock) : -1;
  const amp2Block = ampBlocks.length > 1 ? ampBlocks[1] : undefined;
  const amp2OriginalIndex = amp2Block ? spec.signalChain.indexOf(amp2Block) : -1;

  // Cab block: follows amp(s)
  const cabBlock = sortedChain.find(b => b.type === "cab");
  const cabOriginalIndex = cabBlock ? spec.signalChain.indexOf(cabBlock) : -1;

  // Post-amp effect blocks: everything after the last amp/cab that is not amp/cab
  const postAmpStartIndex = lastAmpIndex >= 0 ? lastAmpIndex : firstAmpIndex;
  const postAmpBlocks = sortedChain
    .filter((_, i) => i > postAmpStartIndex && sortedChain[i]!.type !== "cab" && sortedChain[i]!.type !== "amp")
    .map((block, i) => ({
      block,
      originalIndex: spec.signalChain.indexOf(block),
      slotName: i === 0 ? "post_gate" : i === 1 ? "post_eq" : i === 2 ? "post_effect_1" : i === 3 ? "post_effect_2" : i === 4 ? "post_effect_3" : "post_gain",
    }));

  const isDualAmp = ampBlocks.length >= 2;

  // Build Flow 0 (active path)
  const flow0: Record<string, unknown> = {};
  flow0["@enabled"] = { value: true };

  // Track block keys for linkedblock wiring
  const blockKeyMap: Map<number, string> = new Map();

  // Input block at b00 (fixed)
  flow0["b00"] = buildInputBlock(ampCategory);
  // Note: input block doesn't go in blockKeyMap since it's not in signalChain

  const currentSlot = 1;

  // Pre-amp effect blocks — STAD-07: mono channel mode
  let fxCounter = 0; // Tracks the sequential footswitch index (0 to 11) for Flow 0

  let preAmpSlot = 1; // b01 to b04
  for (const { block, originalIndex } of preAmpBlocks) {
    if (preAmpSlot > 4) break; // Hardware enforces max 4 pre-amp slots
    const slotPos = preAmpSlot++;
    const blockKey = makeBlockKey(slotPos);
    blockKeyMap.set(originalIndex, blockKey);
    const usesController = getStadiumBlockType(block.type) === "fx";
    flow0[blockKey] = buildFlowBlock(block, slotPos, spec, originalIndex, "mono", usesController ? fxCounter++ : undefined);
  }

  // Amp 1 — always canonical slot 5 (b05)
  let ampBlockKey: string | null = null;
  if (ampBlock && ampOriginalIndex >= 0) {
    const ampSlotPos = 5;
    ampBlockKey = makeBlockKey(ampSlotPos);
    blockKeyMap.set(ampOriginalIndex, ampBlockKey);
    flow0[ampBlockKey] = buildFlowBlock(ampBlock, ampSlotPos, spec, ampOriginalIndex, "none", undefined);
  }

  // Amp 2 (dual-amp topology) — slot 6 (b06)
  let amp2BlockKey: string | null = null;
  if (isDualAmp && amp2Block && amp2OriginalIndex >= 0) {
    const amp2SlotPos = 6;
    amp2BlockKey = makeBlockKey(amp2SlotPos);
    blockKeyMap.set(amp2OriginalIndex, amp2BlockKey);
    flow0[amp2BlockKey] = buildFlowBlock(amp2Block, amp2SlotPos, spec, amp2OriginalIndex, "none", undefined);
  }

  // Cab — slot 6 (single-amp) or slot 7 (dual-amp)
  let cabBlockKey: string | null = null;
  if (cabBlock && cabOriginalIndex >= 0) {
    const cabSlotPos = isDualAmp ? 7 : 6;
    cabBlockKey = makeBlockKey(cabSlotPos);
    blockKeyMap.set(cabOriginalIndex, cabBlockKey);
    flow0[cabBlockKey] = buildFlowBlock(cabBlock, cabSlotPos, spec, cabOriginalIndex, "none", undefined);
  }

  // Post-amp effect blocks — STAD-07: stereo channel mode
  let postAmpSlot = isDualAmp ? 8 : 7; // Starts after cab
  for (const { block, originalIndex } of postAmpBlocks) {
    if (postAmpSlot > 12) break; // Hardware enforces max 6 post-amp slots
    const slotPos = postAmpSlot++;
    const blockKey = makeBlockKey(slotPos);
    blockKeyMap.set(originalIndex, blockKey);
    const usesController = getStadiumBlockType(block.type) === "fx";
    flow0[blockKey] = buildFlowBlock(block, slotPos, spec, originalIndex, "stereo", usesController ? fxCounter++ : undefined);
  }

  // Wire up amp ↔ cab linked blocks
  // Dual-amp: only amp2 links to cab (factory verified: amp1 has no linkedblock)
  if (isDualAmp && amp2BlockKey && cabBlockKey) {
    const amp2BlockObj = flow0[amp2BlockKey] as Record<string, unknown>;
    const cabBlockObj = flow0[cabBlockKey] as Record<string, unknown>;
    amp2BlockObj["linkedblock"] = { block: cabBlockKey, flow: 0 };
    cabBlockObj["linkedblock"] = { block: amp2BlockKey, flow: 0 };
  } else if (ampBlockKey && cabBlockKey) {
    const ampBlockObj = flow0[ampBlockKey] as Record<string, unknown>;
    const cabBlockObj = flow0[cabBlockKey] as Record<string, unknown>;
    ampBlockObj["linkedblock"] = { block: cabBlockKey, flow: 0 };
    cabBlockObj["linkedblock"] = { block: ampBlockKey, flow: 0 };
  }

  // Output block at b13 (fixed)
  flow0["b13"] = buildOutputBlock(0);

  // Build Flow 1 (empty path — required by firmware)
  // Factory verified: Flow 1 has InputNone at b00, Looper at b12, OutputMatrix at b13
  const flow1: Record<string, unknown> = {};
  flow1["@enabled"] = { value: true };
  flow1["b00"] = buildEmptyInputBlock(ampCategory);
  flow1["b12"] = buildLooperBlock();
  flow1["b13"] = buildOutputBlock(1);

  return [flow0, flow1];
}

// ---------------------------------------------------------------------------
// STAD-07: Stadium model ID resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the correct Stadium firmware model ID for a block.
 *
 * Rules (verified against professional .hsp files):
 *   1. Cab models: append "WithPan" suffix (existing rule)
 *   2. Effect models (type "fx"): append "Mono" (pre-amp) or "Stereo" (post-amp)
 *   3. Some effect models have different base IDs in Stadium (STADIUM_MODEL_BASE_OVERRIDES)
 *   4. Amp models (Agoura_Amp*): no suffix
 *   5. Input/Output models (P35_*): no suffix
 *
 * @param block The block spec from the signal chain
 * @param channelMode "mono" for pre-amp effects, "stereo" for post-amp, "none" for amp/cab/io
 */
function resolveStadiumModelId(
  block: BlockSpec,
  channelMode: "mono" | "stereo" | "none",
): string {
  let baseId = block.modelId;

  // Cab: append "WithPan" (existing behavior)
  if (block.type === "cab" && baseId.startsWith("HD2_CabMicIr_") && !baseId.endsWith("WithPan")) {
    return baseId + "WithPan";
  }

  // Amp, input, output: no suffix
  if (block.type === "amp" || channelMode === "none") {
    return baseId;
  }

  // Effect blocks: apply STAD-07 overrides and Mono/Stereo suffix

  // Step 0: Some models must NOT receive any suffix (non-HD2/HX2 naming convention)
  if (NO_SUFFIX_MODELS.has(baseId)) {
    return baseId;
  }

  // Step 1: Check if this model has a Stadium-specific base ID override
  if (STADIUM_MODEL_BASE_OVERRIDES[baseId]) {
    baseId = STADIUM_MODEL_BASE_OVERRIDES[baseId];
  }

  // Step 2: Safely strip any existing Mono/Stereo suffix the AI might have hallucinated
  if (baseId.endsWith("Mono")) {
    baseId = baseId.slice(0, -4);
  } else if (baseId.endsWith("Stereo")) {
    baseId = baseId.slice(0, -6);
  }

  // Step 3: Append suffix based on effect TYPE (not position).
  // Factory .hsp files show EQ is always Mono even when post-amp.
  // The suffix follows the model's inherent channel mode from STADIUM_EFFECT_SUFFIX.
  const suffix = STADIUM_EFFECT_SUFFIX[block.type] || "Mono";
  baseId = baseId + suffix;

  return baseId;
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

/**
 * Build a slot-based flow block matching the real .hsp format.
 *
 * Real format (Phase 53 fixes applied):
 * {
 *   "@enabled": { "value": true, "snapshots": [true, null, ...] },
 *   "favorite": 0,
 *   "harness": { "@enabled": { "value": true }, "params": { ... } },
 *   "path": 0,
 *   "position": N,  ← slot-grid position (invariant: key bNN implies position: NN)
 *   "slot": [{ "@enabled": { "value": true }, "model": "...", "params": { "Bass": { "value": 0.5 } }, "version": 0 }],
 *   "type": "amp"   ← or "fx" for all effect blocks (STAD-05)
 * }
 */
function buildFlowBlock(
  block: BlockSpec,
  flowPosition: number,
  spec: PresetSpec,
  originalIndex: number,
  /** STAD-07: "mono" for pre-amp effects, "stereo" for post-amp effects, "none" for amp/cab/io */
  channelMode: "mono" | "stereo" | "none" = "none",
  /** The assigned valid sequential Footswitch source index for this effect block. */
  fxIndex?: number,
): Record<string, unknown> {
  // Build @enabled with optional per-snapshot bypass states and footswitch controller
  const blockType = getStadiumBlockType(block.type);
  const enabledObj = buildBlockEnabled(block, spec, originalIndex, blockType, fxIndex);

  // STAD-03 fix: Build slot params using { value: X } format — NO access field
  // Real .hsp files use only { "value": X } — zero occurrences of "access" anywhere
  //
  // Per-snapshot parameter overrides: real .hsp files store snapshot values inline
  // on each param, e.g. "Drive": { "value": 0.5, "snapshots": [0.6, 0.6, 0.18, null, ...] }
  // The snapshot-engine generates these as parameterOverrides[blockKey][paramName] = value
  const nonCabBlocks = spec.signalChain
    .filter(b => b.type !== "cab")
    .sort((a, b) => a.position - b.position);
  const blockIndex = nonCabBlocks.findIndex(b => b === block);
  const blockStateKey = block.type === "cab" ? null : (blockIndex >= 0 ? `block${blockIndex}` : null);

  const slotParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block.parameters)) {
    // Check if any snapshot overrides this parameter
    if (blockStateKey && spec.snapshots.length > 0) {
      const snapValues: (number | boolean | null)[] = [];
      let hasOverride = false;
      for (let i = 0; i < STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS; i++) {
        // Factory .hsp files: ALL 8 snapshots can have param overrides.
        const snap: SnapshotSpec | undefined = spec.snapshots[i];
        if (snap?.parameterOverrides?.[blockStateKey]?.[key] !== undefined) {
          snapValues.push(snap.parameterOverrides[blockStateKey][key]);
          hasOverride = true;
        } else {
          snapValues.push(null);
        }
      }
      if (hasOverride) {
        slotParams[key] = { value, snapshots: snapValues };
      } else {
        slotParams[key] = { value };
      }
    } else {
      slotParams[key] = { value };
    }
  }

  // STAD-07: Resolve the correct Stadium model ID with appropriate suffix
  const modelId = resolveStadiumModelId(block, channelMode);

  // Build slot array — cabs require dual slots (dual-mic), everything else has 1 slot
  const primarySlot = {
    "@enabled": { value: true },
    model: modelId,
    params: slotParams,
    version: 0,
  };
  const slots = block.type === "cab"
    ? [primarySlot, { ...primarySlot, params: { ...slotParams } }]  // Dual-slot cab (dual mic)
    : [primarySlot];

  const obj: Record<string, unknown> = {
    "@enabled": enabledObj,
    favorite: 0,
    harness: buildHarness(block),
    path: 0,
    position: flowPosition,  // Must match bNN key (invariant: key bNN implies position: NN)
    slot: slots,
    // STAD-05 fix: Map all effect types to "fx" — only amp/cab/input/output/split/join/looper retain named types
    type: getStadiumBlockType(block.type),
  };

  return obj;
}

/**
 * Build the @enabled object for a block, including per-snapshot bypass states.
 *
 * Real format: { "value": true, "snapshots": [true, null, null, ...] }
 * - snapshots[i] = true/false for valid snapshots, null for invalid ones
 */
function buildBlockEnabled(
  block: BlockSpec,
  spec: PresetSpec,
  originalIndex: number,
  /** Stadium block type: "fx", "amp", "cab", etc. */
  stadiumBlockType: string = "fx",
  /** The assigned valid sequential Footswitch source index for this effect block. */
  fxIndex?: number,
): Record<string, unknown> {
  const enabledObj: Record<string, unknown> = {
    value: block.enabled,
  };

  // Build per-snapshot bypass states from spec.snapshots[].blockStates
  // The blockStates key format is "blockN" where N is the index among non-cab blocks
  const nonCabBlocks = spec.signalChain
    .filter(b => b.type !== "cab")
    .sort((a, b) => a.position - b.position);

  // Find this block's index among non-cab blocks (for blockStates key lookup)
  const blockIndex = nonCabBlocks.findIndex(b => b === block);
  // For cab blocks, use the cab's own index in signalChain
  const blockStateKey = block.type === "cab" ? null : (blockIndex >= 0 ? `block${blockIndex}` : null);

  if (blockStateKey && spec.snapshots.length > 0) {
    const snapshotStates: (boolean | null)[] = [];
    let hasAnyState = false;

    for (let i = 0; i < STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS; i++) {
      // Factory .hsp files: ALL 8 snapshots have bypass states on every block.
      const snap: SnapshotSpec | undefined = spec.snapshots[i];
      if (snap && snap.blockStates && blockStateKey in snap.blockStates) {
        snapshotStates.push(snap.blockStates[blockStateKey]);
        hasAnyState = true;
      } else if (snap) {
        // Valid snapshot but no explicit state — use the block's base enabled state
        snapshotStates.push(block.enabled);
        hasAnyState = true;
      } else {
        // No snapshot defined for this slot — use base enabled state for consistency
        snapshotStates.push(block.enabled);
        hasAnyState = true;
      }
    }

    if (hasAnyState) {
      enabledObj.snapshots = snapshotStates;
    }
  }

  // Add footswitch controller for effect blocks only (not amp/cab)
  // Source ID = 0x01010100 + fxIndex (sequentially mapped Flow 0 footswitch source)
  if (stadiumBlockType === "fx" && fxIndex !== undefined && fxIndex < 12) {
    enabledObj.controller = {
      type: "targetbypass",
      source: 0x01010100 + fxIndex,
      behavior: "latching",
      min: false,
      max: true,
      curve: "linear",
      delay: 0,
      threshold: 0.0,
      bypassed: false,
      midisource: 0,
      goid: 0,
    };
  }

  return enabledObj;
}

/**
 * Build the harness object for a block.
 * Amp blocks get additional params (EvtIdx, bypass, upper).
 * Cab blocks get params (EvtIdx, bypass, dual, upper).
 * Other blocks get a minimal harness.
 */
function buildHarness(block: BlockSpec): Record<string, unknown> {
  if (AMP_TYPES.has(block.type)) {
    // Factory .hsp files: amp harness has ONLY EvtIdx (no bypass/upper)
    return {
      "@enabled": { value: true },
      params: {
        EvtIdx: { value: -1 },
      },
    };
  }

  if (CAB_TYPES.has(block.type)) {
    // Factory .hsp files: cab harness has EvtIdx, bypass, upper (no "dual")
    return {
      "@enabled": { value: true },
      params: {
        EvtIdx: { value: -1 },
        bypass: { value: false },
        upper: { value: true },
      },
    };
  }

  // All effect blocks require EvtIdx + bypass + upper in harness
  const isDelayOrReverb = block.type === "delay" || block.type === "reverb";
  return {
    "@enabled": { value: true },
    params: {
      EvtIdx: { value: -1 },
      ...(isDelayOrReverb ? { Trails: { value: true } } : {}),
      bypass: { value: false },
      upper: { value: true },
    },
  };
}

/**
 * Build the input block at position b00.
 * STAD-03 fix: all slot params use { value: X } format — no access field.
 */
function buildInputBlock(ampCategory: AmpCategory): Record<string, unknown> {
  return {
    "@enabled": { value: true },
    endpoint: "b13",
    favorite: 0,
    harness: { "@enabled": { value: true } },
    path: 0,
    position: INPUT_POSITION,
    slot: [
      {
        "@enabled": { value: true },
        model: STADIUM_CONFIG.STADIUM_INPUT_MODEL,
        params: {
          Pad: { value: 1 },
          Trim: { value: 0.0 },
          decay: { value: 0.1 },
          noiseGate: { value: false },
          threshold: { value: ampCategory === "high_gain" ? -36.0 : -48.0 },
        },
        version: 0,
      },
    ],
    type: "input",
  };
}

/**
 * Build the output block at position b13.
 * STAD-03 fix: all slot params use { value: X } format — no access field.
 */
function buildOutputBlock(flow: 0 | 1 = 0): Record<string, unknown> {
  // Factory .hsp verified: Flow 0 uses P35_OutputPath2A (gain: 6), Flow 1 uses P35_OutputMatrix (gain: 0)
  const isFlow0 = flow === 0;
  return {
    "@enabled": { value: true },
    endpoint: "b00",
    favorite: 0,
    harness: { "@enabled": { value: true } },
    path: 0,
    position: OUTPUT_POSITION,
    slot: [
      {
        "@enabled": { value: true },
        model: isFlow0 ? STADIUM_CONFIG.STADIUM_OUTPUT_MODEL : STADIUM_CONFIG.STADIUM_OUTPUT_MATRIX_MODEL,
        params: {
          gain: { value: isFlow0 ? 6 : 0.0 },
          pan: { value: 0.5 },
        },
        version: 0,
      },
    ],
    type: "output",
  };
}

/**
 * Build the empty input block for Flow 1 (InputNone).
 * STAD-03 fix: all slot params use { value: X } format — no access field.
 */
function buildEmptyInputBlock(ampCategory: AmpCategory): Record<string, unknown> {
  return {
    "@enabled": { value: true },
    endpoint: "b13",
    favorite: 0,
    harness: { "@enabled": { value: true } },
    path: 0,
    position: INPUT_POSITION,
    slot: [
      {
        "@enabled": { value: true },
        model: STADIUM_CONFIG.STADIUM_INPUT_NONE_MODEL,
        params: {
          Trim: { value: 0.0 },
          decay: { value: 0.1 },
          noiseGate: { value: false },
          threshold: { value: ampCategory === "high_gain" ? -36.0 : -48.0 },
        },
        version: 0,
      },
    ],
    type: "input",
  };
}

/**
 * Build the looper block at position b12 in Flow 1.
 * Factory verified: Badonkulous.hsp has P35_LooperHelixStereo at flow1.b12
 * with controller, bypass snapshots, and cab-style harness (EvtIdx/bypass/upper).
 */
function buildLooperBlock(): Record<string, unknown> {
  // All 8 snapshots show looper enabled
  const snapshotStates = Array(STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS).fill(true);

  return {
    "@enabled": {
      controller: {
        behavior: "latching",
        bypassed: false,
        curve: "linear",
        delay: 0,
        goid: 0,
        max: true,
        midisource: 0,
        min: false,
        source: 0x0101020A,  // Flow 1 footswitch source 10
        threshold: 0,
        type: "targetbypass",
      },
      snapshots: snapshotStates,
      value: true,
    },
    favorite: 0,
    harness: {
      "@enabled": { value: true },
      params: {
        EvtIdx: { value: -1 },
        bypass: { value: false },
        upper: { value: true },
      },
    },
    path: 0,
    position: 12,
    slot: [
      {
        "@enabled": { value: true },
        model: "P35_LooperHelixStereo",
        params: {
          Clear: { value: 0 },
          ForwardReverse: { value: 0 },
          FullHalfSpeed: { value: 0 },
          Overdub: { value: 0 },
          PlayStop: { value: 0 },
          UndoRedo: { value: 0 },
        },
        version: 0,
      },
    ],
    type: "looper",
  };
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

/**
 * Build preset.snapshots — array of 8 snapshot entries.
 *
 * Real .hsp format:
 *   Valid:   { "color": "auto", "expsw": 1, "name": "...", "source": 0, "tempo": 120.0, "valid": true }
 *   Invalid: { "expsw": -1, "name": "SNAPSHOT N", "source": 0, "tempo": 120.0, "valid": false }
 *
 * Note: invalid snapshots do NOT have the "color" field (verified from real files).
 * Per-snapshot block bypass states are stored on each block's @enabled.snapshots, NOT here.
 */
function buildStadiumSnapshots(spec: PresetSpec): StadiumSnapshotEntry[] {
  const snapshots: StadiumSnapshotEntry[] = [];

  for (let i = 0; i < STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS; i++) {
    // Factory .hsp files: ALL 8 snapshots are valid with color: "auto".
    // Populated snapshots get their name from spec; unused slots get default names.
    const specSnapshot: SnapshotSpec | undefined = spec.snapshots[i];
    if (specSnapshot) {
      snapshots.push({
        color: "auto",
        expsw: i === 0 ? 1 : -1,
        name: specSnapshot.name.substring(0, 24),
        source: 0,
        tempo: spec.tempo,
        valid: true,
      });
    } else {
      snapshots.push({
        color: "auto",
        expsw: -1,
        name: `SNAPSHOT ${i + 1}`,
        source: 0,
        tempo: spec.tempo,
        valid: true,
      });
    }
  }

  return snapshots;
}

// ---------------------------------------------------------------------------
// Sources builder (footswitch defaults)
// ---------------------------------------------------------------------------

/**
 * Build preset.sources — footswitch label/color defaults.
 *
 * Real .hsp format has 24 entries (12 per flow):
 *   Flow 0: keys 16843008..16843019 (0x01010100..0x0101010B)
 *   Flow 1: keys 16843264..16843275 (0x01010200..0x0101020B)
 *
 * Each entry: { "fs_color": "auto", "fs_label": "", "fs_topidx": 0 }
 */
function buildStadiumSources(): Record<string, unknown> {
  const sources: Record<string, unknown> = {};

  // Flow 0: 12 footswitch sources (0x01010100-0x0101010B)
  const flow0Base = 0x01010100; // 16843008
  for (let i = 0; i < 12; i++) {
    sources[String(flow0Base + i)] = {
      bypass: false,
      fs_color: "auto",
      fs_label: "",
      fs_topidx: 0,
    };
  }

  // Flow 1: 12 footswitch sources (0x01010200-0x0101020B)
  const flow1Base = 0x01010200; // 16843264
  for (let i = 0; i < 12; i++) {
    sources[String(flow1Base + i)] = {
      fs_color: "auto",
      fs_label: "",
      fs_topidx: 0,
    };
  }

  // Additional controller sources required by firmware (verified from factory .hsp files):
  // Block controller sources (0x01010400-0x01010409) — amp/cab/effect bypass controllers
  for (let i = 0; i <= 9; i++) {
    sources[String(0x01010400 + i)] = { bypass: false };
  }
  // Path controller source (0x01010500)
  sources[String(0x01010500)] = { bypass: false };
  // Cross-flow controller sources (0x01020100-0x01020101)
  sources[String(0x01020100)] = { bypass: false };
  sources[String(0x01020101)] = { bypass: false };

  return sources;
}
