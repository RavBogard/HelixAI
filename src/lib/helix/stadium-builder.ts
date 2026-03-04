// src/lib/helix/stadium-builder.ts
// Helix Stadium preset builder — generates .hsp files for Line 6 Helix Stadium.
//
// Key differences from Helix (.hlx) builder:
// - 8-byte magic header "rpshnosj" prepended to JSON
// - Top-level structure: { meta: {...}, preset: {...} } — NOT { data: {...} }
// - meta.device_id: 2490368 (not data.device)
// - preset.flow: array of path objects (not dsp0/dsp1 keys)
// - Block keys: b00, b01, ... (not block0, block1, ...)
// - 8 snapshot slots (not keyed by name — array format)
// - I/O model prefix: P35_* (not P34_* like Pod Go, not HD2_AppDSPFlow* like Helix)
// - Single path (Path 1A) in v3.0 — multi-path deferred to future phases
//
// Source: FluidSolo Stadium_Metal_Rhythm.hsp (inspected 2026-03-04, Phase 31)
// Public API: buildHspFile(spec) -> { magic, json, serialized }
//             summarizeStadiumPreset(spec) -> string

import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { DEVICE_IDS } from "./types";
import { STADIUM_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Stadium I/O model IDs (P35_* prefix — confirmed from real .hsp inspection)
const STADIUM_INPUT_MODEL = "P35_InputInst1";
const STADIUM_OUTPUT_MODEL = "P35_OutputMatrix";

// Block @type mapping (same integer encoding as Helix .hlx format)
const STADIUM_BLOCK_TYPE_MAP: Record<string, number> = {
  amp: 1,
  cab: 2,
  distortion: 6,
  dynamics: 7,
  eq: 8,
  modulation: 9,
  delay: 10,
  reverb: 11,
  wah: 12,
  volume: 15,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StadiumMeta {
  color: string;
  device_id: number;
  device_version: number;
  info: string;
  name: string;
}

interface StadiumSnapshotEntry {
  color: string;
  expsw: number;
  name: string;
  source: number;
  tempo: number;
  valid: boolean;
}

interface StadiumPreset {
  clip: Record<string, unknown>;
  cursor: Record<string, unknown>;
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

interface HspJson {
  meta: StadiumMeta;
  preset: StadiumPreset;
}

export interface HspFile {
  /** The 8-byte ASCII magic header ("rpshnosj") */
  magic: string;
  /** The JSON-serializable content object */
  json: HspJson;
  /** Full serialized .hsp content: magic + JSON.stringify(json) */
  serialized: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Helix Stadium .hsp preset file from a PresetSpec.
 *
 * The PresetSpec must have all blocks on dsp0 (single-path).
 * The chain should have been assembled with device="helix_stadium".
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
  const flow = buildStadiumFlow(spec);
  const snapshots = buildStadiumSnapshots(spec);

  return {
    clip: {},
    cursor: { block: "b00", path: 0 },
    flow,
    params: {
      activeexpsw: 1,
      activesnapshot: 0,
      inst1Z: "FirstEnabled",
      inst2Z: "FirstEnabled",
      tempo: spec.tempo,
    },
    snapshots,
    sources: {},
    xyctrl: {},
  };
}

// ---------------------------------------------------------------------------
// Flow / path builder
// ---------------------------------------------------------------------------

/**
 * Build preset.flow — array of path objects.
 * v3.0: single path (Path 1A) at index 0.
 * Each path is a Record<string, unknown> with:
 *   - input block ("P35_InputInst1")
 *   - all non-cab blocks keyed as b00, b01, ...
 *   - cab block (if present)
 *   - output block ("P35_OutputMatrix")
 */
function buildStadiumFlow(spec: PresetSpec): Array<Record<string, unknown>> {
  const path: Record<string, unknown> = {};

  // Input block
  path["input"] = {
    "@model": STADIUM_INPUT_MODEL,
    "@position": 0,
    "@enabled": true,
  };

  // Non-cab blocks: b00, b01, b02, ...
  const nonCabBlocks = spec.signalChain
    .filter(b => b.type !== "cab")
    .sort((a, b) => a.position - b.position);

  for (let i = 0; i < nonCabBlocks.length; i++) {
    const block = nonCabBlocks[i];
    const blockKey = `b${String(i).padStart(2, "0")}`;
    path[blockKey] = buildStadiumBlock(block, i);
  }

  // Cab block (separate entry, after all non-cab blocks)
  const cabBlocks = spec.signalChain.filter(b => b.type === "cab");
  for (let i = 0; i < cabBlocks.length; i++) {
    const cab = cabBlocks[i];
    const cabKey = `cab${i}`;
    path[cabKey] = buildStadiumCabBlock(cab);
  }

  // Output block
  path["output"] = {
    "@model": STADIUM_OUTPUT_MODEL,
    "@position": 0,
    "@enabled": true,
  };

  // v3.0: single path (Path 1A), array with one entry
  return [path];
}

// ---------------------------------------------------------------------------
// Block serializers
// ---------------------------------------------------------------------------

function buildStadiumBlock(block: BlockSpec, indexInPath: number): Record<string, unknown> {
  const blockType = STADIUM_BLOCK_TYPE_MAP[block.type] ?? 6;

  const obj: Record<string, unknown> = {
    "@model": block.modelId,
    "@position": indexInPath,
    "@enabled": block.enabled,
    "@type": blockType,
    "@no_snapshot_bypass": false,
  };

  // Trails for delay/reverb
  if (block.trails) {
    obj["@trails"] = true;
  }

  // Amp-specific
  if (block.type === "amp") {
    obj["@bypassvolume"] = 1;
    obj["@stereo"] = false;
  }

  // Add parameters
  for (const [key, value] of Object.entries(block.parameters)) {
    obj[key] = value;
  }

  return obj;
}

function buildStadiumCabBlock(block: BlockSpec): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    "@model": block.modelId,
    "@enabled": true,
    "@type": STADIUM_BLOCK_TYPE_MAP["cab"],
  };

  // Cab parameters
  for (const [key, value] of Object.entries(block.parameters)) {
    obj[key] = value;
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

/**
 * Build preset.snapshots — array of 8 snapshot entries.
 * Stadium format differs from .hlx format:
 *   - Array (not keyed object)
 *   - Each entry: { color, expsw, name, source, tempo, valid }
 *   - No block bypass state in snapshot array — bypasses tracked per-block in flow
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
      // Unfilled slots match the real .hsp format (expsw: -1, valid: false)
      snapshots.push({
        color: "auto",
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
