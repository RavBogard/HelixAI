// src/lib/helix/podgo-builder.test.ts
// Tests for Pod Go template blocks, output gain controller, and block positioning.

import { describe, it, expect } from "vitest";
import { buildPgpFile } from "./podgo-builder";
import { POD_GO_TEMPLATE_BLOCKS, POD_GO_SNAPSHOT_CONTROLLER } from "./types";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    type: "distortion",
    modelId: "HD2_DistScream808",
    modelName: "Scream 808",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: { Drive: 0.5, Tone: 0.5, Level: 0.5 },
    ...overrides,
  };
}

function makeAmpBlock(): BlockSpec {
  return makeBlock({
    type: "amp",
    modelId: "HD2_AmpUSDelNrm",
    modelName: "US Deluxe Nrm",
    parameters: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5 },
  });
}

function makeCabBlock(): BlockSpec {
  return makeBlock({
    type: "cab",
    modelId: "HD2_Cab1x12USDeluxe",
    modelName: "1x12 US Deluxe",
    parameters: {},
  });
}

function makeSnapshot(name: string, overrides: Partial<SnapshotSpec> = {}): SnapshotSpec {
  return {
    name,
    description: `Snapshot: ${name}`,
    ledColor: 0,
    blockStates: {},
    parameterOverrides: {},
    ...overrides,
  };
}

function makeMinimalPreset(extraBlocks: BlockSpec[] = []): PresetSpec {
  return {
    name: "Test Preset",
    description: "Testing template blocks",
    tempo: 120,
    signalChain: [makeAmpBlock(), makeCabBlock(), ...extraBlocks],
    snapshots: [
      makeSnapshot("Clean"),
      makeSnapshot("Crunch"),
      makeSnapshot("Lead"),
      makeSnapshot("Ambient"),
    ],
  };
}

type Dsp = Record<string, Record<string, unknown>>;
type ControllerSection = Record<string, Record<string, Record<string, unknown>>>;

// ---------------------------------------------------------------------------
// Template Block Tests
// ---------------------------------------------------------------------------

describe("Pod Go Template Blocks", () => {
  it("contains Volume Pedal at block0", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const dsp0 = pgp.data.tone.dsp0 as Dsp;

    expect(dsp0["block0"]["@model"]).toBe(POD_GO_TEMPLATE_BLOCKS.VOLUME_PEDAL.model);
    expect(dsp0["block0"]["@enabled"]).toBe(true);
    expect(dsp0["block0"]["@position"]).toBe(0);
    expect(dsp0["block0"]["Position"]).toBe(1.0);
  });

  it("contains Wah at block1 (disabled)", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const dsp0 = pgp.data.tone.dsp0 as Dsp;

    expect(dsp0["block1"]["@model"]).toBe(POD_GO_TEMPLATE_BLOCKS.WAH.model);
    expect(dsp0["block1"]["@enabled"]).toBe(false);
    expect(dsp0["block1"]["@position"]).toBe(1);
  });

  it("contains FX Loop at block4 (disabled)", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const dsp0 = pgp.data.tone.dsp0 as Dsp;

    expect(dsp0["block4"]["@model"]).toBe(POD_GO_TEMPLATE_BLOCKS.FX_LOOP.model);
    expect(dsp0["block4"]["@enabled"]).toBe(false);
    expect(dsp0["block4"]["@position"]).toBe(4);
    expect(dsp0["block4"]["@type"]).toBe(7);
  });

  it("places user blocks around template positions (2, 3, 5, 6, 7, 8, 9)", () => {
    const delayBlock = makeBlock({
      type: "delay",
      modelId: "HD2_DelaySimpleDelay",
      modelName: "Simple Delay",
      parameters: { Time: 0.5 },
      trails: true,
    });
    const reverbBlock = makeBlock({
      type: "reverb",
      modelId: "HD2_ReverbPlate",
      modelName: "Plate",
      parameters: { Decay: 0.5, Mix: 0.3 },
      trails: true,
    });

    const pgp = buildPgpFile(makeMinimalPreset([delayBlock, reverbBlock]));
    const dsp0 = pgp.data.tone.dsp0 as Dsp;

    // User blocks: amp=block2, cab=block3, delay=block5, reverb=block6
    // Model IDs may be resolved to device-specific variants, so check @type instead
    expect(dsp0["block2"]["@type"]).toBe(1); // amp @type
    expect(dsp0["block2"]["@bypassvolume"]).toBe(1); // amp marker
    expect(dsp0["block3"]["@mic"]).toBeDefined(); // cab marker
    expect(dsp0["block5"]["@trails"]).toBe(true); // delay has trails
    expect(dsp0["block6"]["@trails"]).toBe(true); // reverb has trails

    // Remaining slots are padding
    expect(dsp0["block7"]["@model"]).toBe("HD2_AppDSPFlowBlock");
    expect(dsp0["block8"]["@model"]).toBe("HD2_AppDSPFlowBlock");
    expect(dsp0["block9"]["@model"]).toBe("HD2_AppDSPFlowBlock");
  });

  it("preserves exactly 10 total blocks", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const dsp0 = pgp.data.tone.dsp0 as Dsp;

    for (let i = 0; i < 10; i++) {
      expect(dsp0[`block${i}`]).toBeDefined();
      expect(dsp0[`block${i}`]["@model"]).toBeDefined();
    }
  });

  it("snapshots include template block bypass states", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const snap0 = pgp.data.tone.snapshot0 as Record<string, unknown>;
    const snapBlocks = (snap0["blocks"] as Record<string, Record<string, boolean>>).dsp0;

    // Template blocks
    expect(snapBlocks["block0"]).toBe(true);   // Volume Pedal always on
    expect(snapBlocks["block1"]).toBe(false);  // Wah disabled
    expect(snapBlocks["block4"]).toBe(false);  // FX Loop disabled

    // All 10 blocks present
    for (let i = 0; i < 10; i++) {
      expect(snapBlocks[`block${i}`]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Output Gain Controller Tests
// ---------------------------------------------------------------------------

describe("Pod Go Output Gain Controller", () => {
  it("has @controller:11 for output gain in controller section", () => {
    const pgp = buildPgpFile(makeMinimalPreset());
    const controller = pgp.data.tone.controller as ControllerSection;

    expect(controller.dsp0["output"]).toBeDefined();
    expect(controller.dsp0["output"]["gain"]).toEqual({
      "@min": -60.0,
      "@max": 24.0,
      "@controller": POD_GO_SNAPSHOT_CONTROLLER,
      "@snapshot_disable": false,
    });
  });
});
