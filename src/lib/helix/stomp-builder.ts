/**
 * stomp-builder.ts — HX Stomp and HX Stomp XL preset builder
 *
 * Builds a standard .hlx JSON file (HlxFile) for HX Stomp and HX Stomp XL devices.
 * Structural differences from LT/Floor (preset-builder.ts):
 *   - dsp0.inputA["@model"]  = "HelixStomp_AppDSPFlowInput"  (not HD2_AppDSPFlow1Input)
 *   - dsp0.outputA["@model"] = "HelixStomp_AppDSPFlowOutputMain" (not HD2_AppDSPFlowOutput)
 *   - dsp1 = {} always (single DSP — Stomp hardware has no second DSP)
 *   - Snapshot slots: 0..(maxSnapshots-1) with @valid:true, rest @valid:false
 *   - data.device = DEVICE_IDS[device]  (2162694 for Stomp, 2162699 for XL)
 *
 * This file is intentionally self-contained — it does NOT import buildDsp() from
 * preset-builder.ts to avoid coupling and risk of regressions in the LT/Floor path.
 *
 * Source: stomp-device-ids.md (confirmed from real .hlx hardware exports, 2026-03-04)
 */

import type { HlxFile, HlxDsp, HlxSnapshot, PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { DEVICE_IDS, STOMP_SNAPSHOT_CONTROLLER, isVariaxSupported } from "./types";
import { FIRMWARE_CONFIG, STOMP_CONFIG } from "./config";
import { CONTROLLERS, getBlockTypeForDevice } from "./models";
import { getCapabilities } from "./device-family";

// ---------------------------------------------------------------------------
// Footswitch indices for HX Stomp family (1-based, confirmed from real exports)
// HX Stomp: 3 footswitches (FS1-FS3), indices 1-3
// HX Stomp XL: 5 footswitches (FS1-FS5), indices 1-5
// Source: Bass Rig.hlx (1,2,4,5), SOLAR E1.6FBB.hlx (1,5), Moving Pictures.hlx (1)
// ---------------------------------------------------------------------------
const STOMP_FS_INDICES = [1, 2, 3];
const STOMP_XL_FS_INDICES = [1, 2, 3, 4, 5];

// Block types that should be assigned to stomp switches (user-toggleable effects)
const STOMP_BLOCK_TYPES = new Set([
  "distortion", "delay", "reverb", "modulation",
  "dynamics", "wah", "pitch", "volume",
]);

// Footswitch LED colors (color_index * 65536)
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

// A stomp assignment: which block key is assigned to which footswitch index
interface StompAssignment {
  blockKey: string;
  fsIndex: number;
}

// ---------------------------------------------------------------------------
// DSP builder (dsp0 only for Stomp — uses HelixStomp_* I/O models)
// ---------------------------------------------------------------------------
function buildStompDsp(blocks: BlockSpec[], device: "helix_stomp" | "helix_stomp_xl", useVariaxInput?: boolean): HlxDsp {
  const caps = getCapabilities(device);
  const dsp: HlxDsp = {
    inputA: {
      "@input": useVariaxInput ? 3 : 1, // 1 = Guitar In, 3 = Multi (Guitar + VDI for Variax)
      "@model": STOMP_CONFIG.STOMP_INPUT_MODEL,
      noiseGate: true,
      decay: 0.5,
      threshold: -48.0,
    },
    inputB: {
      "@input": 0,
      "@model": STOMP_CONFIG.STOMP_INPUT_MODEL,
      noiseGate: false,
      decay: 0.5,
      threshold: -48.0,
    },
    outputA: {
      "@model": STOMP_CONFIG.STOMP_OUTPUT_MAIN_MODEL,
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
    outputB: {
      "@model": STOMP_CONFIG.STOMP_OUTPUT_SEND_MODEL,
      "@output": 0,
      pan: 0.5,
      gain: 0.0,
    },
  };

  // Pre-compute cab indices so amp blocks can reference the correct cab key
  const cabIndexMap = new Map<BlockSpec, number>();
  let preCabIdx = 0;
  for (const block of blocks) {
    if (block.type === "cab") {
      cabIndexMap.set(block, preCabIdx++);
    }
  }

  let blockIndex = 0;
  let cabIndex = 0;

  for (const block of blocks) {
    if (block.type === "cab") {
      const cabKey = `cab${cabIndex}`;
      const mic = Number(block.parameters["Mic"] ?? 0);
      const cabParams = { ...block.parameters };
      delete cabParams["Mic"];
      dsp[cabKey] = {
        "@model": block.modelId,
        "@enabled": block.enabled,
        "@mic": mic,
        LowCut: Number(cabParams.LowCut ?? 80.0),
        HighCut: Number(cabParams.HighCut ?? 8000.0),
        ...cabParams,
      };
      cabIndex++;
    } else {
      const blockKey = `block${blockIndex}`;
      const hlxBlock: Record<string, unknown> = {
        "@model": block.modelId,
        "@position": block.position,
        "@enabled": block.enabled,
        "@path": block.path,
        "@type": getBlockTypeForDevice(block.type, block.modelId, caps),
        "@stereo": block.stereo,
        "@no_snapshot_bypass": false,
      };

      if (block.trails) {
        hlxBlock["@trails"] = true;
      }

      if (block.type === "amp") {
        hlxBlock["@bypassvolume"] = 1;
        // Find associated cab (first cab after this amp in the chain)
        const ampIdx = blocks.indexOf(block);
        const associatedCab = blocks.slice(ampIdx + 1).find(b => b.type === "cab")
          || blocks.find(b => b.type === "cab");
        if (associatedCab) {
          hlxBlock["@cab"] = `cab${cabIndexMap.get(associatedCab) ?? 0}`;
        }
      }

      for (const [key, value] of Object.entries(block.parameters)) {
        hlxBlock[key] = value;
      }

      dsp[blockKey] = hlxBlock as unknown as HlxDsp[string];
      blockIndex++;
    }
  }

  // Split and join — always present on HX Stomp (confirmed from all 5 reference presets)
  dsp.split = {
    "@model": "HD2_AppDSPFlowSplitY",
    "@enabled": true,
    "@position": 0,
    "@no_snapshot_bypass": false,
    BalanceA: 0.5,
    BalanceB: 0.5,
  };
  dsp.join = {
    "@model": "HD2_AppDSPFlowJoin",
    "@enabled": true,
    "@position": 8,
    "@no_snapshot_bypass": false,
    Level: 0,
    "A Level": 0,
    "B Level": 0,
    "A Pan": 0.5,
    "B Pan": 0.5,
    "B Polarity": false,
  };

  return dsp;
}

// ---------------------------------------------------------------------------
// Block key map — needed for snapshot building (mirrors preset-builder pattern)
// ---------------------------------------------------------------------------
function buildBlockKeyMap(allBlocks: BlockSpec[]): Map<string, { dsp: number; perDspKey: string }> {
  const map = new Map<string, { dsp: number; perDspKey: string }>();
  let dsp0Idx = 0;
  let globalIdx = 0;

  // Stomp: all blocks are on dsp0, so dsp1Idx is unused
  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const perDspKey = `block${dsp0Idx}`;

    map.set(perDspKey, { dsp: 0, perDspKey });
    map.set(`block${globalIdx}`, { dsp: 0, perDspKey });

    dsp0Idx++;
    globalIdx++;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Snapshot building
// ---------------------------------------------------------------------------
function buildStompSnapshot(
  spec: SnapshotSpec,
  allBlocks: BlockSpec[],
  tempo: number,
  stompAssignments: StompAssignment[] = [],
): HlxSnapshot {
  const blocks: { dsp0?: Record<string, boolean> } = { dsp0: {} };
  const controllers: {
    dsp0?: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>>;
  } = { dsp0: {} };

  const blockKeyMap = buildBlockKeyMap(allBlocks);

  // Set block bypass states
  for (const [blockKey, enabled] of Object.entries(spec.blockStates)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      blocks.dsp0![mapping.perDspKey] = enabled;
    }
  }

  // Ensure ALL non-cab blocks have a bypass state
  let dsp0Idx = 0;
  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const key = `block${dsp0Idx}`;
    dsp0Idx++;
    if (!(key in blocks.dsp0!)) {
      blocks.dsp0![key] = block.enabled;
    }
  }

  // Set parameter overrides
  for (const [blockKey, params] of Object.entries(spec.parameterOverrides)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      if (!controllers.dsp0![mapping.perDspKey]) {
        controllers.dsp0![mapping.perDspKey] = {};
      }
      for (const [paramName, value] of Object.entries(params)) {
        controllers.dsp0![mapping.perDspKey][paramName] = {
          "@fs_enabled": false,
          "@value": value as number,
        };
      }
    }
  }

  // Compute @pedalstate from stomp assignments + block states
  const pedalstate = computeStompPedalState(spec.blockStates, stompAssignments, blockKeyMap);

  return {
    "@name": spec.name.substring(0, 10).toUpperCase(),
    "@tempo": tempo,
    "@valid": true,
    "@pedalstate": pedalstate,
    "@ledcolor": spec.ledColor,
    "@custom_name": false,
    blocks,
    controllers,
  };
}

function buildEmptySnapshot(index: number, allBlocks: BlockSpec[]): HlxSnapshot {
  // Invalid snapshots still have blocks structure (confirmed from Moving Pictures.hlx)
  const blocksBypass: Record<string, boolean> = {};
  let dsp0Idx = 0;
  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    blocksBypass[`block${dsp0Idx}`] = true;
    dsp0Idx++;
  }

  return {
    "@name": `SNAPSHOT ${index + 1}`,
    "@tempo": 120,
    "@valid": false,
    "@pedalstate": 0,
    "@ledcolor": 0,
    blocks: { dsp0: blocksBypass },
    controllers: { dsp0: {} },
  };
}

// ---------------------------------------------------------------------------
// Controller section (snapshot-controlled parameters)
// ---------------------------------------------------------------------------
function buildControllerSection(spec: PresetSpec, maxSnapshots: number, device: "helix_stomp" | "helix_stomp_xl") {
  const controller: Record<string, Record<string, Record<string, unknown>>> = {
    dsp0: {},
    dsp1: {},
  };

  const blockKeyMap = buildBlockKeyMap(spec.signalChain);
  const snapshots = spec.snapshots.slice(0, maxSnapshots);

  const paramVariations = new Map<string, Map<string, Set<number>>>();

  for (const snapshot of snapshots) {
    for (const [blockKey, params] of Object.entries(snapshot.parameterOverrides)) {
      const mapping = blockKeyMap.get(blockKey);
      const resolvedKey = mapping ? mapping.perDspKey : blockKey;

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

  for (const [blockKey, params] of paramVariations.entries()) {
    for (const [paramName, values] of params.entries()) {
      if (values.size > 1) {
        if (!controller["dsp0"][blockKey]) {
          controller["dsp0"][blockKey] = {};
        }
        const allValues = Array.from(values);
        controller["dsp0"][blockKey][paramName] = {
          "@min": Math.min(...allValues),
          "@max": Math.max(...allValues),
          "@controller": STOMP_SNAPSHOT_CONTROLLER,
          "@snapshot_disable": false,
        };
      }
    }
  }

  // --- EXP Pedal Assignments ---
  // Compute the global non-cab index for a block in the signal chain.
  // Stomp buildBlockKeyMap uses globalIdx which counts non-cab blocks sequentially (all dsp0).
  const getGlobalIdx = (block: BlockSpec): number => {
    let idx = 0;
    for (const b of spec.signalChain) {
      if (b === block) return idx;
      if (b.type !== "cab") idx++;
    }
    return -1;
  };

  const caps = getCapabilities(device);
  if (caps.expressionPedalCount > 0) {
    // EXP1 -> wah Position
    const wahBlock = spec.signalChain.find(b => b.type === "wah");
    if (wahBlock) {
      const wahGlobalIdx = getGlobalIdx(wahBlock);
      const wahMapping = blockKeyMap.get(`block${wahGlobalIdx}`);
      if (wahMapping) {
        if (!controller["dsp0"][wahMapping.perDspKey]) {
          controller["dsp0"][wahMapping.perDspKey] = {};
        }
        // Defensive: skip if Position already has a controller (e.g., snapshot)
        if (!controller["dsp0"][wahMapping.perDspKey]["Position"]) {
          controller["dsp0"][wahMapping.perDspKey]["Position"] = {
            "@min": 0.0,
            "@max": 1.0,
            "@controller": CONTROLLERS.EXP_PEDAL_1,
          };
        }
      }
    }

    // EXP2 -> Volume Pedal Position (only if device has 2+ expression pedals)
    if (caps.expressionPedalCount >= 2) {
      const volBlock = spec.signalChain.find(
        b => b.type === "volume" && b.modelName !== "Gain Block"
      );
      if (volBlock) {
        const volGlobalIdx = getGlobalIdx(volBlock);
        const volMapping = blockKeyMap.get(`block${volGlobalIdx}`);
        if (volMapping) {
          if (!controller["dsp0"][volMapping.perDspKey]) {
            controller["dsp0"][volMapping.perDspKey] = {};
          }
          if (!controller["dsp0"][volMapping.perDspKey]["Position"]) {
            controller["dsp0"][volMapping.perDspKey]["Position"] = {
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
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a .hlx preset file for HX Stomp or HX Stomp XL.
 *
 * Key differences from buildHlxFile (LT/Floor):
 *   - Uses HelixStomp_* I/O models (not HD2_App*)
 *   - dsp1 is always {} (single DSP hardware)
 *   - Snapshot slots capped per device (3 for Stomp, 4 for XL)
 *   - data.device = 2162694 (Stomp) or 2162699 (Stomp XL)
 */
export function buildStompFile(
  spec: PresetSpec,
  device: "helix_stomp" | "helix_stomp_xl",
): HlxFile {
  const isXL = device === "helix_stomp_xl";
  const maxSnapshots = isXL
    ? STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS
    : STOMP_CONFIG.STOMP_MAX_SNAPSHOTS;

  // Truncate snapshots to device limit (safety net — validate.ts should have already caught this)
  const snapshots = spec.snapshots.slice(0, maxSnapshots);

  // Variax: use Multi input (@input=3) when variaxModel is set (VARIAX-06)
  const useVariaxInput = !!(spec.variaxModel && isVariaxSupported(device));

  // Build dsp0 with all blocks (chain-rules ensures all on dsp0 for Stomp)
  const dsp0 = buildStompDsp(spec.signalChain, device, useVariaxInput);

  // Get stomp assignments early — needed for @pedalstate in snapshots
  const stompAssignmentsForSnapshots = getStompFsAssignments(spec.signalChain, device);

  // Build snapshot slots (8 total: fill first maxSnapshots, rest are empty)
  const snapshotEntries: Record<string, HlxSnapshot> = {};
  for (let i = 0; i < 8; i++) {
    const snapshotSpec = snapshots[i];
    if (snapshotSpec) {
      snapshotEntries[`snapshot${i}`] = buildStompSnapshot(snapshotSpec, spec.signalChain, spec.tempo, stompAssignmentsForSnapshots);
    } else {
      snapshotEntries[`snapshot${i}`] = buildEmptySnapshot(i, spec.signalChain);
    }
  }

  const controller = buildControllerSection(spec, maxSnapshots, device);

  // Build footswitch section with actual stomp assignments
  const footswitch = buildStompFootswitchSection(spec.signalChain, device);
  const stompAssignments = getStompFsAssignments(spec.signalChain, device);

  const tone = {
    dsp0,
    dsp1: {} as HlxDsp,
    snapshot0: snapshotEntries["snapshot0"],
    snapshot1: snapshotEntries["snapshot1"],
    snapshot2: snapshotEntries["snapshot2"],
    snapshot3: snapshotEntries["snapshot3"],
    snapshot4: snapshotEntries["snapshot4"],
    snapshot5: snapshotEntries["snapshot5"],
    snapshot6: snapshotEntries["snapshot6"],
    snapshot7: snapshotEntries["snapshot7"],
    controller,
    footswitch,
    global: {
      "@model": "@global_params",
      "@topology0": "A" as const,
      "@topology1": "A" as const,
      "@cursor_dsp": 0,
      "@cursor_path": 0,
      "@cursor_position": 0,
      "@cursor_group": "block0",
      "@tempo": spec.tempo,
      "@current_snapshot": 0,
      "@pedalstate": 0,
      "@guitarpad": 0,
      "@guitarinputZ": 0,
      "@DtSelect": 0,
      "@PowercabMode": 0,
      "@PowercabSelect": 0,
      "@PowercabVoicing": 0,
    },
  };

  return {
    version: FIRMWARE_CONFIG.HLX_VERSION,
    data: {
      device: DEVICE_IDS[device],
      device_version: STOMP_CONFIG.STOMP_DEVICE_VERSION,
      meta: {
        name: spec.name.substring(0, 32),
        application: "HX Edit",
        build_sha: FIRMWARE_CONFIG.HLX_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: FIRMWARE_CONFIG.HLX_APP_VERSION,
      },
      tone,
    },
    meta: {
      original: 0,
      pbn: 0,
      premium: 0,
    },
    schema: "L6Preset",
  };
}

// ---------------------------------------------------------------------------
// Stomp footswitch assignment
// ---------------------------------------------------------------------------

/**
 * Get stomp footswitch assignments for HX Stomp / Stomp XL.
 * Assigns toggleable effects to available footswitches (3 for Stomp, 5 for XL).
 */
function getStompFsAssignments(
  allBlocks: BlockSpec[],
  device: "helix_stomp" | "helix_stomp_xl",
): StompAssignment[] {
  const fsIndices = device === "helix_stomp_xl" ? STOMP_XL_FS_INDICES : STOMP_FS_INDICES;
  const assignments: StompAssignment[] = [];
  const candidates: { block: BlockSpec; blockKey: string }[] = [];
  let idx = 0;

  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const blockKey = `block${idx}`;
    idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      candidates.push({ block, blockKey });
    }
  }

  const toAssign = candidates.slice(0, fsIndices.length);
  for (let i = 0; i < toAssign.length; i++) {
    assignments.push({
      blockKey: toAssign[i].blockKey,
      fsIndex: fsIndices[i],
    });
  }

  return assignments;
}

/**
 * Build the footswitch section for HX Stomp / Stomp XL.
 */
function buildStompFootswitchSection(
  allBlocks: BlockSpec[],
  device: "helix_stomp" | "helix_stomp_xl",
): Record<string, unknown> {
  const footswitch: Record<string, Record<string, unknown>> = {
    dsp0: {},
    dsp1: {},
  };

  const fsIndices = device === "helix_stomp_xl" ? STOMP_XL_FS_INDICES : STOMP_FS_INDICES;
  const candidates: { block: BlockSpec; blockKey: string }[] = [];
  let idx = 0;

  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const blockKey = `block${idx}`;
    idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      candidates.push({ block, blockKey });
    }
  }

  const toAssign = candidates.slice(0, fsIndices.length);
  for (let i = 0; i < toAssign.length; i++) {
    const { block, blockKey } = toAssign[i];
    footswitch.dsp0[blockKey] = {
      "@fs_enabled": true,
      "@fs_index": fsIndices[i],
      "@fs_label": block.modelName.substring(0, 16),
      "@fs_ledcolor": FS_LED_COLORS[block.type] || 65536,
      "@fs_momentary": false,
      "@fs_primary": true,
    };
  }

  return footswitch;
}

/**
 * Compute @pedalstate for HX Stomp snapshots.
 * All 5 reference presets show @pedalstate: 0 for every snapshot.
 */
function computeStompPedalState(
  _blockStates: Record<string, boolean>,
  _stompAssignments: StompAssignment[],
  _blockKeyMap: Map<string, { dsp: number; perDspKey: string }>,
): number {
  return 0;
}

/**
 * Generate a human-readable summary of a Stomp preset.
 */
export function summarizeStompPreset(
  spec: PresetSpec,
  device: "helix_stomp" | "helix_stomp_xl",
): string {
  const isXL = device === "helix_stomp_xl";
  const deviceName = isXL ? "HX Stomp XL" : "HX Stomp";
  const maxBlocks = isXL
    ? STOMP_CONFIG.STOMP_XL_MAX_BLOCKS
    : STOMP_CONFIG.STOMP_MAX_BLOCKS;
  const maxSnapshots = isXL
    ? STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS
    : STOMP_CONFIG.STOMP_MAX_SNAPSHOTS;

  const lines: string[] = [];
  lines.push(`## ${spec.name}`);
  lines.push(`**Device:** ${deviceName}`);
  lines.push(spec.description);
  lines.push("");

  if (spec.guitarNotes) {
    lines.push(`**Guitar Notes:** ${spec.guitarNotes}`);
    lines.push("");
  }

  lines.push(`**Tempo:** ${spec.tempo} BPM`);
  lines.push(`**Blocks:** ${spec.signalChain.length} / ${maxBlocks} max`);
  lines.push(`**Snapshots:** ${Math.min(spec.snapshots.length, maxSnapshots)} / ${maxSnapshots}`);
  lines.push("");

  lines.push("### Signal Chain (dsp0 — single path)");
  for (const block of [...spec.signalChain].sort((a, b) => a.position - b.position)) {
    if (block.type === "cab") continue; // cabs are listed after amps
    const status = block.enabled ? "ON" : "OFF";
    lines.push(`  ${block.position + 1}. ${block.modelName} [${status}]`);
  }
  const cabs = spec.signalChain.filter(b => b.type === "cab");
  if (cabs.length > 0) {
    lines.push("### Cabs");
    for (const cab of cabs) {
      lines.push(`  - ${cab.modelName}`);
    }
  }

  lines.push("");
  lines.push("### Snapshots");
  const activeSnapshots = spec.snapshots.slice(0, maxSnapshots);
  for (let i = 0; i < activeSnapshots.length; i++) {
    const snap = activeSnapshots[i];
    lines.push(`**${i + 1}. ${snap.name}** — ${snap.description}`);
  }

  return lines.join("\n");
}
