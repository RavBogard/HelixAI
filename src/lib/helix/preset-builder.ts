import type { HlxFile, HlxDsp, HlxSnapshot, HlxTone, PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import { CONTROLLERS } from "./models";

const HELIX_LT_DEVICE_ID = 2162692;
const HLX_VERSION = 6;
const HLX_APP_VERSION = 57671680; // FW 3.70+
const HLX_BUILD_SHA = "v3.70";

export function buildHlxFile(spec: PresetSpec): HlxFile {
  const tone = buildTone(spec);

  return {
    version: HLX_VERSION,
    data: {
      device: HELIX_LT_DEVICE_ID,
      device_version: HLX_APP_VERSION,
      meta: {
        name: spec.name.substring(0, 32),
        application: "HX Edit",
        build_sha: HLX_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: HLX_APP_VERSION,
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

function buildTone(spec: PresetSpec): HlxTone {
  const dsp0Blocks = spec.signalChain.filter(b => b.dsp === 0);
  const dsp1Blocks = spec.signalChain.filter(b => b.dsp === 1);

  const dsp0 = buildDsp(dsp0Blocks, 0);
  const dsp1 = buildDsp(dsp1Blocks, 1);

  // Build snapshots
  const snapshots: Record<string, HlxSnapshot> = {};
  for (let i = 0; i < 8; i++) {
    const snapshotSpec = spec.snapshots[i];
    if (snapshotSpec) {
      snapshots[`snapshot${i}`] = buildSnapshot(snapshotSpec, spec.signalChain, spec.tempo, i);
    } else {
      snapshots[`snapshot${i}`] = buildEmptySnapshot(i);
    }
  }

  // Build controller section for snapshot-controlled parameters
  const controller = buildControllerSection(spec);

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
    footswitch: {},
    global: {
      "@model": "@global_params",
      "@topology0": "A",
      "@topology1": "A",
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

function buildDsp(blocks: BlockSpec[], dspIndex: number): HlxDsp {
  const dsp: HlxDsp = {
    inputA: {
      "@input": 1, // 1 = Guitar In
      "@model": dspIndex === 0 ? "HD2_AppDSPFlow1Input" : "HD2_AppDSPFlow2Input",
      noiseGate: dspIndex === 0,
      decay: 0.1,
      threshold: -48.0,
    },
    outputA: {
      "@model": "HD2_AppDSPFlowOutput",
      "@output": 1,
      pan: 0.5,
      gain: 0.0,
    },
  };

  let blockIndex = 0;
  let cabIndex = 0;

  for (const block of blocks) {
    if (block.type === "cab") {
      const cabKey = `cab${cabIndex}`;
      dsp[cabKey] = {
        "@model": block.modelId,
        "@enabled": block.enabled,
        "@mic": 0,
        ...block.parameters,
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
        const associatedCab = blocks.find(b => b.type === "cab");
        if (associatedCab) {
          hlxBlock["@cab"] = `cab${cabIndex}`;
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

  return dsp;
}

function buildSnapshot(
  spec: SnapshotSpec,
  allBlocks: BlockSpec[],
  tempo: number,
  _index: number,
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
        controllers[dspKey]![mapping.perDspKey][paramName] = { "@fs_enabled": false, "@value": value };
      }
    }
  }

  return {
    "@name": spec.name.substring(0, 10).toUpperCase(),
    "@tempo": tempo,
    "@valid": true,
    "@pedalstate": 2,
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

    // Map the per-DSP key to itself
    map.set(perDspKey, { dsp, perDspKey });

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

function buildControllerSection(spec: PresetSpec) {
  const controller: Record<string, Record<string, Record<string, unknown>>> = {
    dsp0: {},
    dsp1: {},
  };

  const blockKeyMap = buildBlockKeyMap(spec.signalChain);

  // Collect all parameters that vary across snapshots and register them as snapshot-controlled
  const paramVariations = new Map<string, Map<string, Set<number>>>();

  for (const snapshot of spec.snapshots) {
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
        paramVariations.get(resolvedKey)!.get(paramName)!.add(value);
      }
    }
  }

  // Only register parameters that actually vary across snapshots
  for (const [blockKey, params] of paramVariations.entries()) {
    const mapping = blockKeyMap.get(blockKey);
    const dspKey = mapping?.dsp === 1 ? "dsp1" : "dsp0";

    for (const [paramName, values] of params.entries()) {
      if (values.size > 1) {
        if (!controller[dspKey][blockKey]) {
          controller[dspKey][blockKey] = {};
        }
        const allValues = Array.from(values);
        controller[dspKey][blockKey][paramName] = {
          "@min": Math.min(...allValues),
          "@max": Math.max(...allValues),
          "@controller": CONTROLLERS.SNAPSHOT,
          "@snapshot_disable": false,
        };
      }
    }
  }

  return controller;
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

  return lines.join("\n");
}
