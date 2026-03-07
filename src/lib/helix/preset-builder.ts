import type { HlxFile, HlxDsp, HlxSnapshot, HlxTone, PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { DEVICE_IDS, isVariaxSupported, type DeviceTarget } from "./types";
import { CONTROLLERS } from "./models";
import { FIRMWARE_CONFIG } from "./config";
import { getCapabilities } from "./device-family";

export function buildHlxFile(spec: PresetSpec, device: DeviceTarget = "helix_lt"): HlxFile {
  const tone = buildTone(spec, device);

  // Detect dual-amp from spec (DUAL-09)
  const isDualAmp = spec.signalChain.filter(b => b.type === "amp" && b.dsp === 0).length > 1;

  const result: HlxFile = {
    version: FIRMWARE_CONFIG.HLX_VERSION,
    data: {
      device: DEVICE_IDS[device],
      device_version: FIRMWARE_CONFIG.HLX_APP_VERSION,
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

  // Structural validation for dual-amp presets (DUAL-09)
  if (isDualAmp) {
    if (tone.global["@topology0"] !== "AB") {
      throw new Error("Dual-amp preset validation failed: @topology0 must be 'AB'");
    }

    const dsp0 = tone.dsp0;
    if (!dsp0.split || dsp0.split["@model"] !== "HD2_SplitAB") {
      throw new Error("Dual-amp preset validation failed: dsp0 must have split block with HD2_SplitAB");
    }
    if (!dsp0.join || dsp0.join["@model"] !== "HD2_MergerMixer") {
      throw new Error("Dual-amp preset validation failed: dsp0 must have join block with HD2_MergerMixer");
    }

    // Verify two amp blocks exist with different paths
    const ampBlockPaths: number[] = [];
    for (const [key, value] of Object.entries(dsp0)) {
      if (key.startsWith("block") && value && typeof value === "object" && "@type" in value) {
        const blockObj = value as Record<string, unknown>;
        if (blockObj["@type"] === getBlockType("amp")) {
          ampBlockPaths.push(blockObj["@path"] as number);
        }
      }
    }
    if (ampBlockPaths.length < 2) {
      throw new Error(`Dual-amp preset validation failed: expected 2 amp blocks in dsp0, found ${ampBlockPaths.length}`);
    }
    if (!ampBlockPaths.includes(0) || !ampBlockPaths.includes(1)) {
      throw new Error("Dual-amp preset validation failed: amp blocks must be on different paths (0 and 1)");
    }
  }

  return result;
}

function buildTone(spec: PresetSpec, device: DeviceTarget = "helix_lt"): HlxTone {
  const dsp0Blocks = spec.signalChain.filter(b => b.dsp === 0);
  const dsp1Blocks = spec.signalChain.filter(b => b.dsp === 1);

  // Detect dual-amp: two amp blocks on different paths in DSP0 (DUAL-06)
  const dsp0Amps = dsp0Blocks.filter(b => b.type === "amp");
  const isDualAmp = dsp0Amps.length > 1 && dsp0Amps.some(a => a.path === 1);

  // Variax: use Multi input (@input=3) when variaxModel is set on a supported device (VARIAX-04)
  const useVariaxInput = !!(spec.variaxModel && isVariaxSupported(device));

  const dsp0 = buildDsp(dsp0Blocks, 0, isDualAmp, useVariaxInput);
  const dsp1 = buildDsp(dsp1Blocks, 1);

  // Build footswitch section FIRST — we need stomp assignments for @pedalstate
  const footswitch = buildFootswitchSection(spec.signalChain);
  const stompAssignments = getStompAssignments(spec.signalChain);

  // Build snapshots (with @pedalstate computed from stomp assignments + block states)
  const snapshots: Record<string, HlxSnapshot> = {};
  for (let i = 0; i < 8; i++) {
    const snapshotSpec = spec.snapshots[i];
    if (snapshotSpec) {
      snapshots[`snapshot${i}`] = buildSnapshot(snapshotSpec, spec.signalChain, spec.tempo, i, stompAssignments);
    } else {
      snapshots[`snapshot${i}`] = buildEmptySnapshot(i);
    }
  }

  // Build controller section for snapshot-controlled parameters + EXP pedal assignments
  const controller = buildControllerSection(spec, device);

  const tone: HlxTone = {
    dsp0,
    dsp1,
    snapshot0: snapshots["snapshot0"],
    snapshot1: snapshots["snapshot1"],
    snapshot2: snapshots["snapshot2"],
    snapshot3: snapshots["snapshot3"],
    snapshot4: snapshots["snapshot4"],
    snapshot5: snapshots["snapshot5"],
    snapshot6: snapshots["snapshot6"],
    snapshot7: snapshots["snapshot7"],
    controller,
    footswitch,
    global: {
      "@model": "@global_params",
      "@topology0": isDualAmp ? "AB" : "A",
      "@topology1": "A",  // DSP1 is always series
      "@cursor_dsp": 0,
      "@cursor_path": 0,
      "@cursor_position": 0,
      "@cursor_group": "block0",
      "@tempo": spec.tempo,
      "@current_snapshot": 0,
      "@pedalstate": 2,
      "@guitarpad": 0,
      "@guitarinputZ": 0,
    },
  };
  return tone;
}

function buildDsp(blocks: BlockSpec[], dspIndex: number, isDualAmp?: boolean, useVariaxInput?: boolean): HlxDsp {
  const dsp: HlxDsp = {
    inputA: {
      "@input": (dspIndex === 0 && useVariaxInput) ? 3 : 1, // 1 = Guitar In, 3 = Multi (Guitar + VDI for Variax)
      "@model": dspIndex === 0 ? "HD2_AppDSPFlow1Input" : "HD2_AppDSPFlow2Input",
      noiseGate: dspIndex === 0,
      decay: dspIndex === 0 ? 0.5 : 0.1,
      threshold: dspIndex === 0 ? -48.0 : -48.0,
    },
    outputA: {
      "@model": "HD2_AppDSPFlowOutput",
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
  };

  // Pre-compute cab indices so amp blocks can reference the correct cab
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
      // Determine mic from parameters or use smart default (0=SM57, 6=Ribbon121)
      const mic = Number(block.parameters["Mic"] ?? 0);
      const cabParams = { ...block.parameters };
      delete cabParams["Mic"]; // Mic is a top-level @mic, not a parameter
      dsp[cabKey] = {
        "@model": block.modelId,
        "@enabled": block.enabled,
        "@mic": mic,
        LowCut: Number(cabParams.LowCut ?? 80.0),   // Hz default — required field
        HighCut: Number(cabParams.HighCut ?? 8000.0), // Hz default — required field
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
        "@type": getBlockType(block.type),
        "@stereo": block.stereo,
        "@no_snapshot_bypass": false,
      };

      if (block.trails) {
        hlxBlock["@trails"] = true;
      }

      // Add amp-specific fields and cab reference
      if (block.type === "amp") {
        hlxBlock["@bypassvolume"] = 1;

        // Path-aware cab association for dual-amp (DUAL-06)
        let associatedCab: BlockSpec | undefined;
        if (isDualAmp) {
          // Find the cab on the same path as this amp
          associatedCab = blocks.find(b => b.type === "cab" && b.path === block.path);
        }
        // Fallback: original logic (first cab after amp, or any cab)
        if (!associatedCab) {
          const ampIdx = blocks.indexOf(block);
          associatedCab = blocks.slice(ampIdx + 1).find(b => b.type === "cab")
            || blocks.find(b => b.type === "cab");
        }
        if (associatedCab) {
          hlxBlock["@cab"] = `cab${cabIndexMap.get(associatedCab) ?? 0}`;
        }
      }

      // Add all parameters
      for (const [key, value] of Object.entries(block.parameters)) {
        hlxBlock[key] = value;
      }

      dsp[blockKey] = hlxBlock as unknown as HlxDsp[string];
      blockIndex++;
    }
  }

  // Dual-amp: write split and join blocks to dsp0 (DUAL-06)
  if (isDualAmp && dspIndex === 0) {
    // Split block: placed before the first amp
    const firstAmpPos = blocks
      .filter(b => b.type === "amp")
      .reduce((min, b) => Math.min(min, b.position), Infinity);
    const splitPosition = Math.max(0, firstAmpPos);

    dsp.split = {
      "@model": "HD2_SplitAB",
      "@enabled": true,
      "@position": splitPosition,
    };

    // Join block: placed after the last non-cab block position
    const maxBlockPos = blocks
      .filter(b => b.type !== "cab")
      .reduce((max, b) => Math.max(max, b.position), 0);
    const joinPosition = maxBlockPos + 1;

    dsp.join = {
      "@model": "HD2_MergerMixer",
      "@position": joinPosition,
      "A Level": 1.0,
      "B Level": 1.0,
      "A Pan": 0.5,
      "B Pan": 0.5,
    };
  }

  return dsp;
}

// A stomp assignment: which block key on which DSP is assigned to which footswitch index
interface StompAssignment {
  dspKey: string;   // "dsp0" or "dsp1"
  blockKey: string; // "block0", "block1", etc. (per-DSP key)
  fsIndex: number;  // Footswitch index (7-10 for FS5-FS8)
}

/**
 * Compute @pedalstate bitmask from snapshot block states and stomp assignments.
 * Each bit corresponds to a footswitch index. The bit is SET when the stomp
 * block assigned to that footswitch is ENABLED in this snapshot.
 *
 * @pedalstate encoding (empirically derived):
 * - Bit 0 (value 1) = FS1, Bit 1 (value 2) = FS2, ... Bit N (value 2^N) = FS(N+1)
 * - For stomp footswitches FS5-FS8 (indices 7-10): bits 7-10
 * - Default value 2 (bit 1 = FS2) represents "snapshot mode active" base state
 */
function computePedalState(
  blockStates: Record<string, boolean>,
  stompAssignments: StompAssignment[],
  blockKeyMap: Map<string, { dsp: number; perDspKey: string }>,
): number {
  // Base value: bit 1 (FS2) = snapshot mode indicator
  let pedalstate = 2;

  for (const assignment of stompAssignments) {
    // Find which global block key maps to this per-DSP key
    let blockEnabled = false;
    for (const [globalKey, mapping] of Array.from(blockKeyMap.entries())) {
      if (mapping.perDspKey === assignment.blockKey &&
          (mapping.dsp === 0 ? "dsp0" : "dsp1") === assignment.dspKey) {
        // Check if this block is enabled in this snapshot's block states
        blockEnabled = blockStates[globalKey] ?? false;
        break;
      }
    }

    if (blockEnabled) {
      pedalstate |= (1 << assignment.fsIndex);
    }
  }

  return pedalstate;
}

function buildSnapshot(
  spec: SnapshotSpec,
  allBlocks: BlockSpec[],
  tempo: number,
  _index: number,
  stompAssignments: StompAssignment[] = [],
): HlxSnapshot {
  const blocks: { dsp0?: Record<string, boolean>; dsp1?: Record<string, boolean> } = {
    dsp0: {},
    dsp1: {},
  };

  const controllers: {
    dsp0?: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>>;
    dsp1?: Record<string, Record<string, { "@fs_enabled": boolean; "@value": number }>>;
  } = { dsp0: {}, dsp1: {} };

  // Build a map from blockKey -> { dsp, perDspKey } using the actual signal chain
  // This ensures correct per-DSP block numbering regardless of what the AI provided
  const blockKeyMap = buildBlockKeyMap(allBlocks);

  // Set block bypass states — resolve AI's block keys to correct per-DSP keys
  for (const [blockKey, enabled] of Object.entries(spec.blockStates)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      const dspKey = mapping.dsp === 1 ? "dsp1" : "dsp0";
      blocks[dspKey]![mapping.perDspKey] = enabled;
    }
  }

  // Ensure ALL non-cab blocks have a bypass state (use default if not specified)
  let dsp0Idx = 0;
  let dsp1Idx = 0;
  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const dspKey = block.dsp === 1 ? "dsp1" : "dsp0";
    const idx = block.dsp === 1 ? dsp1Idx : dsp0Idx;
    const key = `block${idx}`;
    if (block.dsp === 0) dsp0Idx++;
    else dsp1Idx++;

    if (!(key in blocks[dspKey]!)) {
      blocks[dspKey]![key] = block.enabled;
    }
  }

  // Set parameter overrides
  for (const [blockKey, params] of Object.entries(spec.parameterOverrides)) {
    const mapping = blockKeyMap.get(blockKey);
    if (mapping) {
      const dspKey = mapping.dsp === 1 ? "dsp1" : "dsp0";
      if (!controllers[dspKey]![mapping.perDspKey]) {
        controllers[dspKey]![mapping.perDspKey] = {};
      }
      for (const [paramName, value] of Object.entries(params)) {
        controllers[dspKey]![mapping.perDspKey][paramName] = { "@fs_enabled": false, "@value": value as number };
      }
    }
  }

  // Compute @pedalstate from stomp assignments and this snapshot's block states
  const pedalstate = computePedalState(spec.blockStates, stompAssignments, blockKeyMap);

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

// Build a mapping from any block key the AI might use to the correct per-DSP key
function buildBlockKeyMap(allBlocks: BlockSpec[]): Map<string, { dsp: number; perDspKey: string }> {
  const map = new Map<string, { dsp: number; perDspKey: string }>();
  let dsp0Idx = 0;
  let dsp1Idx = 0;
  let globalIdx = 0;

  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const dsp = block.dsp;
    const perDspIdx = dsp === 0 ? dsp0Idx : dsp1Idx;
    const perDspKey = `block${perDspIdx}`;

    // Map the per-DSP key — only set if not already claimed by dsp0 (prevents dsp1
    // block0 from overwriting dsp0 block0 in dual-DSP presets)
    if (!map.has(perDspKey)) {
      map.set(perDspKey, { dsp, perDspKey });
    }

    // Also map global-index keys (block0, block1, block2... across both DSPs) to per-DSP keys
    // This handles the common AI mistake of using sequential numbering across DSPs
    map.set(`block${globalIdx}`, { dsp, perDspKey });

    if (dsp === 0) dsp0Idx++;
    else dsp1Idx++;
    globalIdx++;
  }

  return map;
}

function buildEmptySnapshot(index: number): HlxSnapshot {
  return {
    "@name": `SNAPSHOT ${index + 1}`,
    "@tempo": 120,
    "@valid": false,
    "@pedalstate": 2,
    "@ledcolor": 0,
  };
}

function buildControllerSection(spec: PresetSpec, device: DeviceTarget) {
  const controller: Record<string, Record<string, Record<string, unknown>>> = {
    dsp0: {},
    dsp1: {},
  };

  const blockKeyMap = buildBlockKeyMap(spec.signalChain);

  // Collect all parameters that vary across snapshots and register them as snapshot-controlled.
  // Key by ORIGINAL blockKey (not resolved) so blockKeyMap lookup works correctly later.
  const paramVariations = new Map<string, Map<string, Set<number>>>();

  for (const snapshot of spec.snapshots) {
    for (const [blockKey, params] of Object.entries(snapshot.parameterOverrides)) {
      if (!paramVariations.has(blockKey)) {
        paramVariations.set(blockKey, new Map());
      }
      for (const [paramName, value] of Object.entries(params)) {
        if (!paramVariations.get(blockKey)!.has(paramName)) {
          paramVariations.get(blockKey)!.set(paramName, new Set());
        }
        paramVariations.get(blockKey)!.get(paramName)!.add(value as number);
      }
    }
  }

  // Only register parameters that actually vary across snapshots.
  // Use mapping.perDspKey for the output key (matching per-snapshot controller pattern).
  for (const [blockKey, params] of paramVariations.entries()) {
    const mapping = blockKeyMap.get(blockKey);
    if (!mapping) continue;
    const dspKey = mapping.dsp === 1 ? "dsp1" : "dsp0";
    const resolvedKey = mapping.perDspKey;

    for (const [paramName, values] of params.entries()) {
      if (values.size > 1) {
        if (!controller[dspKey][resolvedKey]) {
          controller[dspKey][resolvedKey] = {};
        }
        const allValues = Array.from(values);
        controller[dspKey][resolvedKey][paramName] = {
          "@min": Math.min(...allValues),
          "@max": Math.max(...allValues),
          "@controller": CONTROLLERS.SNAPSHOT,
          "@snapshot_disable": false,
        };
      }
    }
  }

  // --- EXP Pedal Assignments ---
  // Compute the global non-cab index for a block in the signal chain.
  // buildBlockKeyMap uses globalIdx which counts non-cab blocks sequentially.
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
    // EXP1 -> wah Position (industry convention: EXP Pedal 1 controls wah sweep)
    const wahBlock = spec.signalChain.find(b => b.type === "wah");
    if (wahBlock) {
      const wahGlobalIdx = getGlobalIdx(wahBlock);
      const wahMapping = blockKeyMap.get(`block${wahGlobalIdx}`);
      if (wahMapping) {
        const dspKey = wahMapping.dsp === 1 ? "dsp1" : "dsp0";
        if (!controller[dspKey][wahMapping.perDspKey]) {
          controller[dspKey][wahMapping.perDspKey] = {};
        }
        // Defensive: skip if Position already has a controller (e.g., snapshot)
        if (!controller[dspKey][wahMapping.perDspKey]["Position"]) {
          controller[dspKey][wahMapping.perDspKey]["Position"] = {
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
          const dspKey = volMapping.dsp === 1 ? "dsp1" : "dsp0";
          if (!controller[dspKey][volMapping.perDspKey]) {
            controller[dspKey][volMapping.perDspKey] = {};
          }
          if (!controller[dspKey][volMapping.perDspKey]["Position"]) {
            controller[dspKey][volMapping.perDspKey]["Position"] = {
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

// Helix LT footswitch indices: FS5-FS8 = indices 7-10 (top row, used for stomps)
const STOMP_FS_INDICES = [7, 8, 9, 10];

// Block types that should be assigned to stomp switches (user-toggleable effects)
const STOMP_BLOCK_TYPES = new Set([
  "distortion", "delay", "reverb", "modulation",
  "dynamics", "wah", "pitch", "volume",
]);

/**
 * Get stomp assignments (which blocks are assigned to which footswitches).
 * Used by buildFootswitchSection for the .hlx and by buildSnapshot for @pedalstate.
 */
function getStompAssignments(allBlocks: BlockSpec[]): StompAssignment[] {
  const assignments: StompAssignment[] = [];
  let dsp0Idx = 0;
  let dsp1Idx = 0;

  const candidates: { block: BlockSpec; dspKey: string; blockKey: string }[] = [];
  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const dspKey = block.dsp === 0 ? "dsp0" : "dsp1";
    const idx = block.dsp === 0 ? dsp0Idx : dsp1Idx;
    const blockKey = `block${idx}`;
    if (block.dsp === 0) dsp0Idx++;
    else dsp1Idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      candidates.push({ block, dspKey, blockKey });
    }
  }

  const toAssign = candidates.slice(0, STOMP_FS_INDICES.length);
  for (let i = 0; i < toAssign.length; i++) {
    assignments.push({
      dspKey: toAssign[i].dspKey,
      blockKey: toAssign[i].blockKey,
      fsIndex: STOMP_FS_INDICES[i],
    });
  }

  return assignments;
}

/**
 * Auto-assign effect blocks to stomp footswitches (FS5-FS8).
 * Amps, cabs, and EQ are typically "always on" so they're skipped.
 * This gives the user a Snap/Stomp layout:
 *   Bottom row: Snapshots 1-4
 *   Top row: Stomp switches for individual effects
 */
function buildFootswitchSection(allBlocks: BlockSpec[]): Record<string, unknown> {
  const footswitch: Record<string, Record<string, unknown>> = {
    dsp0: {},
    dsp1: {},
  };

  // Collect toggleable blocks across both DSPs
  const stompCandidates: { block: BlockSpec; dspKey: string; blockKey: string }[] = [];
  let dsp0Idx = 0;
  let dsp1Idx = 0;

  for (const block of allBlocks) {
    if (block.type === "cab") continue;
    const dspKey = block.dsp === 0 ? "dsp0" : "dsp1";
    const idx = block.dsp === 0 ? dsp0Idx : dsp1Idx;
    const blockKey = `block${idx}`;
    if (block.dsp === 0) dsp0Idx++;
    else dsp1Idx++;

    if (STOMP_BLOCK_TYPES.has(block.type)) {
      stompCandidates.push({ block, dspKey, blockKey });
    }
  }

  // Assign up to 4 blocks to FS5-FS8 (indices 7-10)
  const toAssign = stompCandidates.slice(0, STOMP_FS_INDICES.length);

  for (let i = 0; i < toAssign.length; i++) {
    const { block, dspKey, blockKey } = toAssign[i];
    footswitch[dspKey][blockKey] = {
      "@fs_enabled": true,
      "@fs_index": STOMP_FS_INDICES[i],
      "@fs_label": block.modelName.substring(0, 16),
      "@fs_ledcolor": FS_LED_COLORS[block.type] || 65536,
      "@fs_momentary": false,
      "@fs_primary": true,
    };
  }

  return footswitch;
}

function getBlockType(type: string): number {
  switch (type) {
    case "amp": return 3;
    case "cab": return 4;
    case "distortion": return 0;
    case "delay": return 7;
    case "reverb": return 7;
    case "modulation": return 4;
    case "dynamics": return 0;
    case "eq": return 0;
    case "wah": return 0;
    case "pitch": return 0;
    case "volume": return 0;
    case "send_return": return 9;
    default: return 0;
  }
}

// Generate a human-readable summary of a preset spec
export function summarizePreset(spec: PresetSpec): string {
  const lines: string[] = [];
  lines.push(`## ${spec.name}`);
  lines.push(spec.description);
  lines.push("");

  if (spec.guitarNotes) {
    lines.push(`**Guitar Notes:** ${spec.guitarNotes}`);
    lines.push("");
  }

  lines.push(`**Tempo:** ${spec.tempo} BPM`);
  lines.push("");

  lines.push("### Signal Chain");
  const dsp0 = spec.signalChain.filter(b => b.dsp === 0);
  const dsp1 = spec.signalChain.filter(b => b.dsp === 1);

  if (dsp0.length > 0) {
    lines.push("**Path 1 (DSP 1):**");
    for (const block of dsp0.sort((a, b) => a.position - b.position)) {
      const status = block.enabled ? "ON" : "OFF";
      lines.push(`  ${block.position + 1}. ${block.modelName} [${status}]`);
    }
  }

  if (dsp1.length > 0) {
    lines.push("**Path 2 (DSP 2):**");
    for (const block of dsp1.sort((a, b) => a.position - b.position)) {
      const status = block.enabled ? "ON" : "OFF";
      lines.push(`  ${block.position + 1}. ${block.modelName} [${status}]`);
    }
  }

  lines.push("");
  lines.push("### Snapshots");
  for (let i = 0; i < spec.snapshots.length; i++) {
    const snap = spec.snapshots[i];
    lines.push(`**${i + 1}. ${snap.name}** — ${snap.description}`);
  }

  // Show stomp switch assignments
  const stompBlocks = spec.signalChain.filter(b => b.type !== "amp" && b.type !== "cab" && b.type !== "eq" && STOMP_BLOCK_TYPES.has(b.type));
  if (stompBlocks.length > 0) {
    lines.push("");
    lines.push("### Stomp Switches (FS5-FS8)");
    const assigned = stompBlocks.slice(0, 4);
    for (let i = 0; i < assigned.length; i++) {
      lines.push(`**FS${i + 5}:** ${assigned[i].modelName}`);
    }
  }

  return lines.join("\n");
}
