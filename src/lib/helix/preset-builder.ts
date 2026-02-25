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
      meta: {
        name: spec.name.substring(0, 32),
        application: "HelixAI",
        build_sha: HLX_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: HLX_APP_VERSION,
      },
      tone,
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
      "@topology0": "A",
      "@topology1": "A",
      "@cursor_dsp": 0,
      "@cursor_path": 0,
      "@cursor_position": 0,
      "@cursor_group": "block0",
      "@tempo": spec.tempo,
      "@current_snapshot": 0,
      "@pedalstate": 2,
    },
  };
  return tone;
}

function buildDsp(blocks: BlockSpec[], dspIndex: number): HlxDsp {
  const dsp: HlxDsp = {
    inputA: {
      "@input": 0,
      "@model": dspIndex === 0 ? "HD2_AppDSPFlow1Input" : "HD2_AppDSPFlow2Input",
      noiseGate: dspIndex === 0,
      decay: 0.5,
      threshold: -48.0,
    },
    outputA: {
      "@model": "HD2_AppDSPFlowOutput",
      "@output": dspIndex === 0 ? 1 : 2, // 1 = series (dsp0 feeds dsp1), 2 = independent
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
      };

      if (block.trails) {
        hlxBlock["@trails"] = true;
      }

      // Add cab reference for amp blocks
      if (block.type === "amp") {
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
  index: number,
): HlxSnapshot {
  const blocks: { dsp0?: Record<string, boolean>; dsp1?: Record<string, boolean> } = {
    dsp0: {},
    dsp1: {},
  };

  const controllers: {
    dsp0?: Record<string, Record<string, { "@value": number }>>;
    dsp1?: Record<string, Record<string, { "@value": number }>>;
  } = { dsp0: {}, dsp1: {} };

  // Set block bypass states from the snapshot spec
  for (const [blockKey, enabled] of Object.entries(spec.blockStates)) {
    // Determine which DSP this block is on
    const block = allBlocks.find((_, i) => {
      const bKey = getBlockKeyForIndex(allBlocks, i);
      return bKey === blockKey;
    });
    const dspKey = block?.dsp === 1 ? "dsp1" : "dsp0";
    blocks[dspKey]![blockKey] = enabled;
  }

  // Set parameter overrides
  for (const [blockKey, params] of Object.entries(spec.parameterOverrides)) {
    const block = allBlocks.find((_, i) => {
      const bKey = getBlockKeyForIndex(allBlocks, i);
      return bKey === blockKey;
    });
    const dspKey = block?.dsp === 1 ? "dsp1" : "dsp0";
    if (!controllers[dspKey]![blockKey]) {
      controllers[dspKey]![blockKey] = {};
    }
    for (const [paramName, value] of Object.entries(params)) {
      controllers[dspKey]![blockKey][paramName] = { "@value": value };
    }
  }

  return {
    "@name": spec.name.substring(0, 10).toUpperCase(),
    "@tempo": tempo,
    "@valid": true,
    "@pedalstate": 2,
    "@ledcolor": spec.ledColor,
    blocks,
    controllers,
  };
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

  // Collect all parameters that vary across snapshots and register them as snapshot-controlled
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
        paramVariations.get(blockKey)!.get(paramName)!.add(value);
      }
    }
  }

  // Only register parameters that actually vary across snapshots
  for (const [blockKey, params] of paramVariations.entries()) {
    const block = spec.signalChain.find((_, i) => {
      const bKey = getBlockKeyForIndex(spec.signalChain, i);
      return bKey === blockKey;
    });
    const dspKey = block?.dsp === 1 ? "dsp1" : "dsp0";

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
        };
      }
    }
  }

  return controller;
}

function getBlockType(type: string): number {
  switch (type) {
    case "amp": return 1;
    case "cab": return 2;
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

function getBlockKeyForIndex(blocks: BlockSpec[], index: number): string {
  // Filter out cabs since they use a separate numbering
  let blockCount = 0;
  for (let i = 0; i <= index && i < blocks.length; i++) {
    if (blocks[i].type !== "cab") {
      if (i === index) return `block${blockCount}`;
      blockCount++;
    } else {
      // Cabs don't get block keys in the same way, but we still need to handle them
      if (i === index) return `block${blockCount}`;
    }
  }
  return `block${index}`;
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
