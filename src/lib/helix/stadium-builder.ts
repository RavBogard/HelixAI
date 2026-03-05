// src/lib/helix/stadium-builder.ts
// Helix Stadium preset builder — generates .hsp files for Line 6 Helix Stadium.
//
// Format verified against real .hsp files downloaded from The Gear Forum:
//   - Cranked_2203.hsp (15.7 KB, uploaded by EOengineer, Dec 2025)
//   - Rev_120_Purple_Recto.hsp (17 KB, uploaded by EOengineer, Dec 2025)
//
// .hsp format: 8-byte magic header "rpshnosj" + JSON.stringify({ meta, preset })
// Block format: slot-based ({ slot: [{ model, params: { K: { access, value } } }] })
//   NOT flat-style ({ @model, ParamKey: value }) like .hlx
//
// Public API: buildHspFile(spec) -> { magic, json, serialized }
//             summarizeStadiumPreset(spec) -> string

import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { DEVICE_IDS } from "./types";
import { STADIUM_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STADIUM_INPUT_MODEL = "P35_InputInst1";
const STADIUM_INPUT_NONE_MODEL = "P35_InputNone";
const STADIUM_OUTPUT_MODEL = "P35_OutputMatrix";

/** Position 0 = input, position 13 = output (fixed by firmware) */
const INPUT_POSITION = 0;
const OUTPUT_POSITION = 13;

// Block types that need amp-style harness params
const AMP_TYPES = new Set(["amp"]);
const CAB_TYPES = new Set(["cab"]);

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
  flow: Array<Record<string, unknown>>;
  params: {
    activeexpsw: number;
    activesnapshot: number;
    inst1Z: string;
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
  const flow = buildStadiumFlow(spec);
  const snapshots = buildStadiumSnapshots(spec);
  const sources = buildStadiumSources();

  return {
    clip: {
      end: 10.0,
      filename: "<EMPTY>",
      path: "USER CLIPS",
      start: 0.0,
    },
    flow,
    params: {
      activeexpsw: 1,
      activesnapshot: 0,
      inst1Z: "FirstEnabled",
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
 * Block layout:
 *   b00 = input (P35_InputInst1), position 0
 *   b01..b12 = effect/amp/cab blocks, positions 1-12
 *   b13 = output (P35_OutputMatrix), position 13
 *
 * Amp and cab blocks are linked via `linkedblock`.
 * Per-snapshot bypass states are stored in each block's @enabled.snapshots array.
 */
function buildStadiumFlow(spec: PresetSpec): Array<Record<string, unknown>> {
  // Order blocks: non-cab sorted by position, cab inserted after its amp
  const orderedBlocks = orderBlocksForFlow(spec.signalChain);

  // Build Flow 0 (active path)
  const flow0: Record<string, unknown> = {};
  flow0["@enabled"] = { value: true };

  // Input block at b00
  flow0["b00"] = buildInputBlock();

  // Track amp → cab linking
  let ampFlowPosition: number | null = null;
  let ampBlockKey: string | null = null;
  let cabFlowPosition: number | null = null;
  let cabBlockKey: string | null = null;

  // Place effect blocks starting at position 1
  let flowPos = 1;
  const blockKeyMap: Map<number, string> = new Map(); // signalChain index → flow block key

  for (const { block, originalIndex } of orderedBlocks) {
    const blockKey = `b${String(flowPos).padStart(2, "0")}`;
    blockKeyMap.set(originalIndex, blockKey);

    if (AMP_TYPES.has(block.type)) {
      ampFlowPosition = flowPos;
      ampBlockKey = blockKey;
    }
    if (CAB_TYPES.has(block.type)) {
      cabFlowPosition = flowPos;
      cabBlockKey = blockKey;
    }

    flow0[blockKey] = buildFlowBlock(block, flowPos, spec, originalIndex, blockKeyMap);
    flowPos++;
  }

  // Wire up amp ↔ cab linked blocks after all blocks are placed
  if (ampBlockKey && cabBlockKey) {
    const ampBlock = flow0[ampBlockKey] as Record<string, unknown>;
    const cabBlock = flow0[cabBlockKey] as Record<string, unknown>;
    ampBlock["linkedblock"] = { block: cabBlockKey, flow: 0 };
    cabBlock["linkedblock"] = { block: ampBlockKey, flow: 0 };
  }

  // Output block at b13
  flow0["b13"] = buildOutputBlock();

  // Build Flow 1 (empty path — required by firmware)
  const flow1: Record<string, unknown> = {};
  flow1["@enabled"] = { value: true };
  flow1["b00"] = buildEmptyInputBlock();
  flow1["b13"] = buildOutputBlock();

  return [flow0, flow1];
}

/**
 * Order blocks for the flow: non-cab blocks sorted by position, cab inserted after amp.
 */
function orderBlocksForFlow(signalChain: BlockSpec[]): Array<{ block: BlockSpec; originalIndex: number }> {
  const nonCabBlocks = signalChain
    .map((block, i) => ({ block, originalIndex: i }))
    .filter(({ block }) => block.type !== "cab")
    .sort((a, b) => a.block.position - b.block.position);

  const cabBlocks = signalChain
    .map((block, i) => ({ block, originalIndex: i }))
    .filter(({ block }) => block.type === "cab");

  // Find the amp position in the sorted list, insert cab right after
  const result: Array<{ block: BlockSpec; originalIndex: number }> = [];
  for (const entry of nonCabBlocks) {
    result.push(entry);
    if (entry.block.type === "amp" && cabBlocks.length > 0) {
      result.push(cabBlocks[0]);
    }
  }

  // If no amp was found but we have cabs, append them at the end
  if (!nonCabBlocks.some(e => e.block.type === "amp")) {
    for (const cab of cabBlocks) {
      result.push(cab);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

/**
 * Build a slot-based flow block matching the real .hsp format.
 *
 * Real format example:
 * {
 *   "@enabled": { "value": true, "snapshots": [true, null, ...] },
 *   "favorite": 0,
 *   "harness": { "@enabled": { "value": true }, "params": { ... } },
 *   "path": 0,
 *   "position": N,
 *   "slot": [{ "@enabled": { "value": true }, "model": "...", "params": { "Bass": { "access": "enabled", "value": 0.5 } }, "version": 0 }],
 *   "type": "amp"
 * }
 */
function buildFlowBlock(
  block: BlockSpec,
  flowPosition: number,
  spec: PresetSpec,
  originalIndex: number,
  blockKeyMap: Map<number, string>,
): Record<string, unknown> {
  // Build @enabled with optional per-snapshot bypass states
  const enabledObj = buildBlockEnabled(block, spec, originalIndex);

  // Build slot params in { ParamName: { access: "enabled", value: X } } format
  const slotParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(block.parameters)) {
    slotParams[key] = { access: "enabled", value };
  }

  const obj: Record<string, unknown> = {
    "@enabled": enabledObj,
    favorite: 0,
    harness: buildHarness(block),
    path: 0,
    position: flowPosition,
    slot: [
      {
        "@enabled": { value: true },
        model: block.modelId,
        params: slotParams,
        version: 0,
      },
    ],
    type: block.type,
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
      const snap: SnapshotSpec | undefined = spec.snapshots[i];
      if (snap && snap.blockStates && blockStateKey in snap.blockStates) {
        snapshotStates.push(snap.blockStates[blockStateKey]);
        hasAnyState = true;
      } else {
        snapshotStates.push(null);
      }
    }

    if (hasAnyState) {
      enabledObj.snapshots = snapshotStates;
    }
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
    return {
      "@enabled": { value: true },
      params: {
        EvtIdx: { access: "enabled", value: -1 },
        bypass: { access: "enabled", value: false },
        upper: { access: "enabled", value: true },
      },
    };
  }

  if (CAB_TYPES.has(block.type)) {
    return {
      "@enabled": { value: true },
      params: {
        EvtIdx: { access: "enabled", value: -1 },
        bypass: { access: "enabled", value: false },
        dual: { access: "enabled", value: true },
        upper: { access: "enabled", value: true },
      },
    };
  }

  return { "@enabled": { value: true } };
}

/**
 * Build the input block at position b00.
 */
function buildInputBlock(): Record<string, unknown> {
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
        model: STADIUM_INPUT_MODEL,
        params: {
          Pad: { access: "enabled", value: 1 },
          Trim: { access: "enabled", value: 0.0 },
          decay: { access: "enabled", value: 0.1 },
          noiseGate: { access: "enabled", value: false },
          threshold: { access: "enabled", value: -48.0 },
        },
        version: 0,
      },
    ],
    type: "input",
  };
}

/**
 * Build the output block at position b13.
 */
function buildOutputBlock(): Record<string, unknown> {
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
        model: STADIUM_OUTPUT_MODEL,
        params: {
          gain: { access: "enabled", value: 0.0 },
          pan: { access: "enabled", value: 0.5 },
        },
        version: 0,
      },
    ],
    type: "output",
  };
}

/**
 * Build the empty input block for Flow 1 (InputNone).
 */
function buildEmptyInputBlock(): Record<string, unknown> {
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
        model: STADIUM_INPUT_NONE_MODEL,
        params: {
          Trim: { access: "enabled", value: 0.0 },
          decay: { access: "enabled", value: 0.1 },
          noiseGate: { access: "enabled", value: false },
          threshold: { access: "enabled", value: -48.0 },
        },
        version: 0,
      },
    ],
    type: "input",
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
    const specSnapshot: SnapshotSpec | undefined = spec.snapshots[i];
    if (specSnapshot) {
      snapshots.push({
        color: "auto",
        expsw: 1,
        name: specSnapshot.name.substring(0, 24),
        source: 0,
        tempo: spec.tempo,
        valid: true,
      });
    } else {
      snapshots.push({
        expsw: -1,
        name: `SNAPSHOT ${i + 1}`,
        source: 0,
        tempo: spec.tempo,
        valid: false,
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

  // Flow 0: 12 footswitch sources
  const flow0Base = 0x01010100; // 16843008
  for (let i = 0; i < 12; i++) {
    sources[String(flow0Base + i)] = {
      fs_color: "auto",
      fs_label: "",
      fs_topidx: 0,
    };
  }

  // Flow 1: 12 footswitch sources
  const flow1Base = 0x01010200; // 16843264
  for (let i = 0; i < 12; i++) {
    sources[String(flow1Base + i)] = {
      fs_color: "auto",
      fs_label: "",
      fs_topidx: 0,
    };
  }

  return sources;
}
