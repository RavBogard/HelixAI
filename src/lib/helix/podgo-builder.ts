// src/lib/helix/podgo-builder.ts
// Pod Go preset builder — generates .pgp files for Line 6 Pod Go.
//
// Key differences from Helix builder:
// - Single DSP (dsp0 only, dsp1 always empty)
// - 4 snapshots (not 8)
// - @controller: 4 for snapshot recall (Helix uses 19)
// - input/output keys (not inputA/outputA)
// - P34_AppDSPFlowInput/Output models
// - Cab is a numbered block (not separate cab0 key)
// - No @path, @stereo on blocks
// - No @topology in global
// - device_version field in data section
// - Footswitch indices 0-5 (not 7-10)
//
// Public API: buildPgpFile(spec) -> object (JSON-serializable .pgp file)

import type { HlxFile, PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { DEVICE_IDS, POD_GO_IO, POD_GO_SNAPSHOT_CONTROLLER, POD_GO_STOMP_FS_INDICES } from "./types";
import { getModelIdForDevice, getBlockTypeForDevice, CONTROLLERS } from "./models";
import { getAllModels } from "./models";
import { getCapabilities } from "./device-family";
import { POD_GO_FIRMWARE_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Pod Go file uses the same top-level structure as HlxFile but with differences
// in the data section. We return a plain object for JSON serialization.
type PgpFile = HlxFile & { data: HlxFile["data"] & { device_version: number } };

// Footswitch LED colors (same as Helix — color_index * 65536)
const FS_LED_COLORS: Record<string, number> = {
  distortion: 131072,   // red
  dynamics: 65536,       // white
  delay: 327680,         // green
  reverb: 458752,        // blue
  modulation: 393216,    // turquoise
  eq: 262144,            // yellow
  wah: 196608,           // orange
  pitch: 524288,         // purple
  volume: 65536,         // white
};

// Block types that should be assigned to stomp switches
const STOMP_BLOCK_TYPES = new Set([
  "distortion", "delay", "reverb", "modulation",
  "dynamics", "wah", "pitch", "volume",
]);

// ---------------------------------------------------------------------------
// Stomp assignment tracking
// ---------------------------------------------------------------------------

interface StompAssignment {
  blockKey: string;
  fsIndex: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a Pod Go .pgp preset file from a PresetSpec.
 *
 * The PresetSpec must have all blocks on dsp0 and exactly 4 snapshots.
 * The chain should have been assembled with device="pod_go" to ensure
 * correct DSP assignment and block limits.
 */
export function buildPgpFile(spec: PresetSpec): PgpFile {
  const tone = buildPgpTone(spec);

  return {
    version: POD_GO_FIRMWARE_CONFIG.PGP_VERSION,
    data: {
      device: DEVICE_IDS.pod_go,
      device_version: POD_GO_FIRMWARE_CONFIG.PGP_DEVICE_VERSION,
      meta: {
        name: spec.name.substring(0, 32),
        application: POD_GO_FIRMWARE_CONFIG.PGP_APPLICATION,
        build_sha: POD_GO_FIRMWARE_CONFIG.PGP_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: POD_GO_FIRMWARE_CONFIG.PGP_APP_VERSION,
      },
      tone,
    },
    meta: {
      original: 0,
      pbn: 0,
      premium: 0,
    },
    schema: "L6Preset",
  } as unknown as PgpFile;
}

// ---------------------------------------------------------------------------
// Tone builder
// ---------------------------------------------------------------------------

function buildPgpTone(spec: PresetSpec): Record<string, unknown> {
  // All blocks on dsp0 for Pod Go
  const dsp0 = buildPgpDsp(spec.signalChain);

  // Build footswitch section FIRST — need stomp assignments for @pedalstate
  const footswitch = buildPgpFootswitchSection(spec.signalChain);
  const stompAssignments = getPgpStompAssignments(spec.signalChain);

  // Build exactly 4 snapshots
  const snapshots: Record<string, unknown> = {};
  for (let i = 0; i < 4; i++) {
    const snapshotSpec = spec.snapshots[i];
    if (snapshotSpec) {
      snapshots[`snapshot${i}`] = buildPgpSnapshot(snapshotSpec, spec.signalChain, spec.tempo, stompAssignments);
    } else {
      snapshots[`snapshot${i}`] = buildEmptyPgpSnapshot(i);
    }
  }

  // Build controller section with @controller: 4 for snapshot recall
  const controller = buildPgpControllerSection(spec);

  return {
    dsp0,
    dsp1: {}, // Always empty on Pod Go (PGP-05)
    snapshot0: snapshots["snapshot0"],
    snapshot1: snapshots["snapshot1"],
    snapshot2: snapshots["snapshot2"],
    snapshot3: snapshots["snapshot3"],
    controller,
    footswitch,
    global: {
      "@model": "@global_params",
      "@cursor_group": "block0",
      "@tempo": spec.tempo,
      "@current_snapshot": 0,
      "@pedalstate": 2,
    },
  };
}

// ---------------------------------------------------------------------------
// DSP builder (single DSP, Pod Go format)
// ---------------------------------------------------------------------------

function buildPgpDsp(blocks: BlockSpec[]): Record<string, unknown> {
  const dsp: Record<string, unknown> = {
    // Pod Go uses "input"/"output" keys (not "inputA"/"outputA") (PGP-03)
    [POD_GO_IO.INPUT_KEY]: {
      "@input": 1,
      "@model": POD_GO_IO.INPUT_MODEL,
      noiseGate: true,
      decay: 0.5,
      threshold: -48.0,
    },
    [POD_GO_IO.OUTPUT_KEY]: {
      "@model": POD_GO_IO.OUTPUT_MODEL,
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
  };

  // All models lookup for device-specific ID resolution
  const allModels = getAllModels();

  let blockIndex = 0;

  for (const block of blocks) {
    const blockKey = `block${blockIndex}`;
    const model = allModels[block.modelName];

    // Get Pod Go-specific model ID and @type
    const podGoCaps = getCapabilities("pod_go");
    const pgModelId = model
      ? getModelIdForDevice(model, block.type, podGoCaps)
      : block.modelId;
    const pgBlockType = getBlockTypeForDevice(block.type, pgModelId, podGoCaps);

    // Pod Go blocks: no @path, no @stereo (PGP-03)
    const pgBlock: Record<string, unknown> = {
      "@model": pgModelId,
      "@position": block.position >= 0 ? block.position : blockIndex,
      "@enabled": block.enabled,
      "@type": pgBlockType,
      "@no_snapshot_bypass": false,
    };

    // Trails for delay/reverb
    if (block.trails) {
      pgBlock["@trails"] = true;
    }

    // Amp-specific field
    if (block.type === "amp") {
      pgBlock["@bypassvolume"] = 1;
    }

    // Cab-specific fields: Pod Go puts cab as a numbered block (PGP-04)
    if (block.type === "cab") {
      const mic = block.parameters["Mic"] ?? 0;
      pgBlock["@mic"] = mic;
      pgBlock["LowCut"] = block.parameters["LowCut"] ?? 80.0;
      pgBlock["HighCut"] = block.parameters["HighCut"] ?? 8000.0;
      // Add remaining cab params (but skip Mic, LowCut, HighCut which are already handled)
      for (const [key, value] of Object.entries(block.parameters)) {
        if (key !== "Mic" && key !== "LowCut" && key !== "HighCut") {
          pgBlock[key] = value;
        }
      }
    } else {
      // Add all parameters for non-cab blocks
      for (const [key, value] of Object.entries(block.parameters)) {
        pgBlock[key] = value;
      }
    }

    dsp[blockKey] = pgBlock;
    blockIndex++;
  }

  return dsp;
}

// ---------------------------------------------------------------------------
// Snapshot builder (Pod Go: 4 snapshots, @controller: 4)
// ---------------------------------------------------------------------------

function buildPgpSnapshot(
  spec: SnapshotSpec,
  allBlocks: BlockSpec[],
  tempo: number,
  stompAssignments: StompAssignment[],
): Record<string, unknown> {
  const blocks: Record<string, boolean> = {};
  const controllers: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>> = {};

  // Build block key map (all blocks on dsp0, sequential numbering)
  const blockKeyMap = buildPgpBlockKeyMap(allBlocks);

  // Set block bypass states
  for (const [blockKey, enabled] of Object.entries(spec.blockStates)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      blocks[mapping] = enabled;
    }
  }

  // Ensure ALL non-cab blocks have a bypass state (cab blocks don't appear in snapshot bypass table)
  for (let i = 0; i < allBlocks.length; i++) {
    if (allBlocks[i].type === "cab") continue;
    const key = `block${i}`;
    if (!(key in blocks)) {
      blocks[key] = allBlocks[i].enabled;
    }
  }

  // Set parameter overrides
  for (const [blockKey, params] of Object.entries(spec.parameterOverrides)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      if (!controllers[mapping]) {
        controllers[mapping] = {};
      }
      for (const [paramName, value] of Object.entries(params)) {
        controllers[mapping][paramName] = { "@fs_enabled": false, "@value": value as number };
      }
    }
  }

  // Compute @pedalstate from stomp assignments
  const pedalstate = computePgpPedalState(spec.blockStates, stompAssignments, blockKeyMap);

  return {
    "@name": spec.name.substring(0, 10).toUpperCase(),
    "@tempo": tempo,
    "@valid": true,
    "@pedalstate": pedalstate,
    "@ledcolor": spec.ledColor,
    "@custom_name": false,
    blocks: { dsp0: blocks },
    controllers: { dsp0: controllers },
  };
}

function buildEmptyPgpSnapshot(index: number): Record<string, unknown> {
  return {
    "@name": `SNAPSHOT ${index + 1}`,
    "@tempo": 120,
    "@valid": false,
    "@pedalstate": 2,
    "@ledcolor": 0,
  };
}

// ---------------------------------------------------------------------------
// Block key mapping (Pod Go: all on dsp0, sequential)
// ---------------------------------------------------------------------------

function buildPgpBlockKeyMap(allBlocks: BlockSpec[]): Map<string, string> {
  const map = new Map<string, string>();
  let snapshotIdx = 0; // counts only non-cab blocks (matches snapshot engine's buildBlockKeys)
  let dspIdx = 0;      // counts all blocks including cabs (matches DSP slot numbering)

  for (const block of allBlocks) {
    const dspKey = `block${dspIdx}`;
    dspIdx++;
    if (block.type === "cab") continue; // skip cabs — snapshot engine skips them too
    // Map snapshot key (non-cab index) → DSP slot key (all-blocks index)
    map.set(`block${snapshotIdx}`, dspKey);
    snapshotIdx++;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Pedalstate computation
// ---------------------------------------------------------------------------

function computePgpPedalState(
  blockStates: Record<string, boolean>,
  stompAssignments: StompAssignment[],
  blockKeyMap: Map<string, string>,
): number {
  let pedalstate = 2; // Base value: snapshot mode indicator

  for (const assignment of stompAssignments) {
    const mapping = blockKeyMap.get(assignment.blockKey);
    const stateKey = mapping || assignment.blockKey;
    const blockEnabled = blockStates[stateKey] ?? false;

    if (blockEnabled) {
      pedalstate |= (1 << assignment.fsIndex);
    }
  }

  return pedalstate;
}

// ---------------------------------------------------------------------------
// Controller section (Pod Go: @controller: 4 for snapshot recall)
// ---------------------------------------------------------------------------

function buildPgpControllerSection(spec: PresetSpec): Record<string, unknown> {
  const controller: Record<string, Record<string, Record<string, unknown>>> = {
    dsp0: {},
  };

  const blockKeyMap = buildPgpBlockKeyMap(spec.signalChain);

  // Collect parameters that vary across snapshots
  const paramVariations = new Map<string, Map<string, Set<number>>>();

  for (const snapshot of spec.snapshots) {
    for (const [blockKey, params] of Object.entries(snapshot.parameterOverrides)) {
      const resolvedKey = blockKeyMap.get(blockKey) || blockKey;

      if (!paramVariations.has(resolvedKey)) {
        paramVariations.set(resolvedKey, new Map());
      }
      for (const [paramName, value] of Object.entries(params)) {
        if (!paramVariations.get(resolvedKey)!.has(paramName)) {
          paramVariations.get(resolvedKey)!.set(paramName, new Set());
        }
        paramVariations.get(resolvedKey)!.get(paramName)!.add(value as number);
      }
    }
  }

  // Register parameters that vary across snapshots with @controller: 4
  for (const [blockKey, params] of paramVariations.entries()) {
    for (const [paramName, values] of params.entries()) {
      if (values.size > 1) {
        if (!controller.dsp0[blockKey]) {
          controller.dsp0[blockKey] = {};
        }
        const allValues = Array.from(values);
        controller.dsp0[blockKey][paramName] = {
          "@min": Math.min(...allValues),
          "@max": Math.max(...allValues),
          "@controller": POD_GO_SNAPSHOT_CONTROLLER, // 4, not 19
          "@snapshot_disable": false,
        };
      }
    }
  }

  // --- EXP Pedal Assignments ---
  // Pod Go has 1 expression pedal (EXP1 only). Wah gets EXP1; Volume Pedal
  // does NOT get EXP2 because Pod Go has no second pedal.
  const caps = getCapabilities("pod_go");
  if (caps.expressionPedalCount > 0) {
    // EXP1 -> wah Position
    const wahBlock = spec.signalChain.find(b => b.type === "wah");
    if (wahBlock) {
      // Count non-cab blocks before the wah to get the correct snapshot index
      let wahNonCabIdx = 0;
      for (const b of spec.signalChain) {
        if (b === wahBlock) break;
        if (b.type !== "cab") wahNonCabIdx++;
      }
      const wahKey = blockKeyMap.get(`block${wahNonCabIdx}`);
      if (wahKey) {
        if (!controller.dsp0[wahKey]) {
          controller.dsp0[wahKey] = {};
        }
        // Defensive guard (EXP-04): skip if Position already has a controller (snapshot)
        if (!controller.dsp0[wahKey]["Position"]) {
          controller.dsp0[wahKey]["Position"] = {
            "@min": 0.0,
            "@max": 1.0,
            "@controller": CONTROLLERS.EXP_PEDAL_1,
          };
        }
      }
    }

    // EXP2 -> volume Position (only if 2+ pedals — Pod Go has 1, so this is skipped)
    if (caps.expressionPedalCount >= 2) {
      const volBlock = spec.signalChain.find(
        b => b.type === "volume" && b.modelName !== "Gain Block"
      );
      if (volBlock) {
        // Count non-cab blocks before the volume pedal to get the correct snapshot index
        let volNonCabIdx = 0;
        for (const b of spec.signalChain) {
          if (b === volBlock) break;
          if (b.type !== "cab") volNonCabIdx++;
        }
        const volKey = blockKeyMap.get(`block${volNonCabIdx}`);
        if (volKey) {
          if (!controller.dsp0[volKey]) {
            controller.dsp0[volKey] = {};
          }
          if (!controller.dsp0[volKey]["Position"]) {
            controller.dsp0[volKey]["Position"] = {
              "@min": 0.0,
              "@max": 1.0,
              "@controller": CONTROLLERS.EXP_PEDAL_2,
            };
          }
        }
      }
    }
  }

  return controller;
}

// ---------------------------------------------------------------------------
// Footswitch section (Pod Go: indices 0-5)
// ---------------------------------------------------------------------------

function getPgpStompAssignments(allBlocks: BlockSpec[]): StompAssignment[] {
  const assignments: StompAssignment[] = [];
  const candidates: { block: BlockSpec; blockKey: string }[] = [];
  let idx = 0;

  for (const block of allBlocks) {
    const blockKey = `block${idx}`;
    idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      candidates.push({ block, blockKey });
    }
  }

  // Assign up to 6 blocks to FS A-F (indices 0-5)
  const toAssign = candidates.slice(0, POD_GO_STOMP_FS_INDICES.length);
  for (let i = 0; i < toAssign.length; i++) {
    assignments.push({
      blockKey: toAssign[i].blockKey,
      fsIndex: POD_GO_STOMP_FS_INDICES[i],
    });
  }

  return assignments;
}

function buildPgpFootswitchSection(allBlocks: BlockSpec[]): Record<string, unknown> {
  const footswitch: Record<string, Record<string, unknown>> = {
    dsp0: {},
  };

  const candidates: { block: BlockSpec; blockKey: string }[] = [];
  let idx = 0;

  for (const block of allBlocks) {
    const blockKey = `block${idx}`;
    idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      candidates.push({ block, blockKey });
    }
  }

  // Assign up to 6 blocks to footswitches (indices 0-5)
  const toAssign = candidates.slice(0, POD_GO_STOMP_FS_INDICES.length);

  for (let i = 0; i < toAssign.length; i++) {
    const { block, blockKey } = toAssign[i];
    footswitch.dsp0[blockKey] = {
      "@fs_enabled": true,
      "@fs_index": POD_GO_STOMP_FS_INDICES[i],
      "@fs_label": block.modelName.substring(0, 16),
      "@fs_ledcolor": FS_LED_COLORS[block.type] || 65536,
      "@fs_momentary": false,
      "@fs_primary": true,
    };
  }

  return footswitch;
}

// ---------------------------------------------------------------------------
// Preset summary (Pod Go variant)
// ---------------------------------------------------------------------------

/**
 * Generate a human-readable summary for a Pod Go preset.
 * Shows single DSP path and 4 snapshots.
 */
export function summarizePodGoPreset(spec: PresetSpec): string {
  const lines: string[] = [];
  lines.push(`## ${spec.name}`);
  lines.push(spec.description);
  lines.push("");

  if (spec.guitarNotes) {
    lines.push(`**Guitar Notes:** ${spec.guitarNotes}`);
    lines.push("");
  }

  lines.push(`**Tempo:** ${spec.tempo} BPM`);
  lines.push(`**Device:** Pod Go`);
  lines.push("");

  lines.push("### Signal Chain");
  const sorted = [...spec.signalChain].sort((a, b) => {
    // Cab blocks with position -1 go after amp
    const posA = a.position >= 0 ? a.position : 999;
    const posB = b.position >= 0 ? b.position : 999;
    return posA - posB;
  });

  let displayIdx = 1;
  for (const block of sorted) {
    const status = block.enabled ? "ON" : "OFF";
    lines.push(`  ${displayIdx}. ${block.modelName} [${status}]`);
    displayIdx++;
  }

  lines.push("");
  lines.push("### Snapshots");
  for (let i = 0; i < Math.min(spec.snapshots.length, 4); i++) {
    const snap = spec.snapshots[i];
    lines.push(`**${i + 1}. ${snap.name}** — ${snap.description}`);
  }

  // Show stomp switch assignments
  const stompBlocks = spec.signalChain.filter(b =>
    STOMP_BLOCK_TYPES.has(b.type)
  );
  if (stompBlocks.length > 0) {
    lines.push("");
    lines.push("### Stomp Switches (FS A-F)");
    const fsLabels = ["FS A", "FS B", "FS C", "FS D", "FS Up", "FS Down"];
    const assigned = stompBlocks.slice(0, 6);
    for (let i = 0; i < assigned.length; i++) {
      lines.push(`**${fsLabels[i]}:** ${assigned[i].modelName}`);
    }
  }

  return lines.join("\n");
}
