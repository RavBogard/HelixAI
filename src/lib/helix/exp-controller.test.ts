// src/lib/helix/exp-controller.test.ts
// TDD RED phase: Failing tests for EXP pedal controller assignment
// on Helix LT/Floor and HX Stomp/Stomp XL builders.
//
// EXP_PEDAL_1 (wah Position) and EXP_PEDAL_2 (volume Position)
// must appear in the controller section of built presets.

import { describe, it, expect } from "vitest";
import { buildHlxFile } from "./preset-builder";
import { buildStompFile } from "./stomp-builder";
import { CONTROLLERS } from "./models";
import type { PresetSpec, BlockSpec, SnapshotSpec, DeviceTarget } from "./types";

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

function makeWahBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return makeBlock({
    type: "wah",
    modelId: "HD2_WahTeardrop310",
    modelName: "Teardrop 310",
    parameters: { Position: 0.5, Mix: 1.0, Level: 0.0 },
    ...overrides,
  });
}

function makeVolumePedalBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return makeBlock({
    type: "volume",
    modelId: "HD2_VolPanVol",
    modelName: "Volume Pedal",
    parameters: { Position: 1.0 },
    ...overrides,
  });
}

function makeGainBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return makeBlock({
    type: "volume",
    modelId: "HD2_VolPanGain",
    modelName: "Gain Block",
    parameters: { Gain: 0.0 },
    ...overrides,
  });
}

function makeAmpBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return makeBlock({
    type: "amp",
    modelId: "HD2_AmpUSDelNrm",
    modelName: "US Deluxe Nrm",
    parameters: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5 },
    ...overrides,
  });
}

function makeCabBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return makeBlock({
    type: "cab",
    modelId: "HD2_Cab1x12USDeluxe",
    modelName: "1x12 US Deluxe",
    parameters: {},
    ...overrides,
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

function makePresetSpec(signalChain: BlockSpec[], snapshotOverrides: Partial<SnapshotSpec>[] = []): PresetSpec {
  const snapshots = snapshotOverrides.length > 0
    ? snapshotOverrides.map((o, i) => makeSnapshot(`Snap ${i + 1}`, o))
    : [makeSnapshot("Clean"), makeSnapshot("Crunch"), makeSnapshot("Lead"), makeSnapshot("Ambient")];

  return {
    name: "Test EXP Preset",
    description: "Testing EXP pedal controller assignment",
    tempo: 120,
    signalChain,
    snapshots,
  };
}

// Type helper for controller section
type ControllerSection = Record<string, Record<string, Record<string, unknown>>>;

// ---------------------------------------------------------------------------
// Helix LT/Floor tests
// ---------------------------------------------------------------------------

describe("EXP Controller Assignment — Helix LT/Floor", () => {
  it("assigns EXP_PEDAL_1 to wah Position on dsp0", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Wah is block0 on dsp0 (cabs are skipped in blockKeyMap)
    expect(controller.dsp0["block0"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });
  });

  it("assigns EXP_PEDAL_2 to Volume Pedal Position on dsp0", () => {
    const chain: BlockSpec[] = [
      makeAmpBlock({ dsp: 0, position: 0 }),
      makeCabBlock({ dsp: 0, position: 1 }),
      makeVolumePedalBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Amp is block0, Volume Pedal is block1 (cab skipped)
    expect(controller.dsp0["block1"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_2,
    });
  });

  it("assigns EXP_PEDAL_1 to wah on dsp1", () => {
    const chain: BlockSpec[] = [
      makeAmpBlock({ dsp: 0, position: 0 }),
      makeCabBlock({ dsp: 0, position: 1 }),
      makeWahBlock({ dsp: 1, position: 0 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_floor");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Wah is block0 on dsp1
    expect(controller.dsp1["block0"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });
  });

  it("assigns both EXP1 (wah) and EXP2 (volume) when both present", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
      makeVolumePedalBlock({ dsp: 0, position: 3 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Wah=block0, Amp=block1, Volume=block2 (cab skipped)
    expect(controller.dsp0["block0"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });
    expect(controller.dsp0["block2"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_2,
    });
  });

  it("emits no EXP entries when no wah or volume blocks", () => {
    const chain: BlockSpec[] = [
      makeBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Scan all entries for EXP controllers
    for (const dspKey of ["dsp0", "dsp1"]) {
      for (const blockEntries of Object.values(controller[dspKey] || {})) {
        for (const paramEntry of Object.values(blockEntries as Record<string, unknown>)) {
          if (typeof paramEntry === "object" && paramEntry !== null && "@controller" in paramEntry) {
            const ctrl = (paramEntry as Record<string, unknown>)["@controller"];
            expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_1);
            expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_2);
          }
        }
      }
    }
  });

  it("does NOT assign EXP to Gain Block (uses Gain param, not Position)", () => {
    const chain: BlockSpec[] = [
      makeAmpBlock({ dsp: 0, position: 0 }),
      makeCabBlock({ dsp: 0, position: 1 }),
      makeGainBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Gain Block should not have any EXP entries
    const block1 = controller.dsp0["block1"];
    if (block1) {
      for (const paramEntry of Object.values(block1)) {
        if (typeof paramEntry === "object" && paramEntry !== null && "@controller" in paramEntry) {
          const ctrl = (paramEntry as Record<string, unknown>)["@controller"];
          expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_2);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// HX Stomp / Stomp XL tests
// ---------------------------------------------------------------------------

describe("EXP Controller Assignment — HX Stomp/Stomp XL", () => {
  it("assigns EXP_PEDAL_1 to wah Position in dsp0 controller", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildStompFile(spec, "helix_stomp");
    const controller = hlx.data.tone.controller as ControllerSection;

    expect(controller.dsp0["block0"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });
  });

  it("assigns EXP_PEDAL_2 to Volume Pedal Position in dsp0 controller", () => {
    const chain: BlockSpec[] = [
      makeAmpBlock({ dsp: 0, position: 0 }),
      makeCabBlock({ dsp: 0, position: 1 }),
      makeVolumePedalBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildStompFile(spec, "helix_stomp_xl");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Amp=block0, Volume=block1 (cab skipped)
    expect(controller.dsp0["block1"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_2,
    });
  });

  it("emits no EXP entries when no wah or volume blocks (Stomp)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const hlx = buildStompFile(spec, "helix_stomp");
    const controller = hlx.data.tone.controller as ControllerSection;

    for (const blockEntries of Object.values(controller.dsp0 || {})) {
      for (const paramEntry of Object.values(blockEntries as Record<string, unknown>)) {
        if (typeof paramEntry === "object" && paramEntry !== null && "@controller" in paramEntry) {
          const ctrl = (paramEntry as Record<string, unknown>)["@controller"];
          expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_1);
          expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_2);
        }
      }
    }
  });
});
