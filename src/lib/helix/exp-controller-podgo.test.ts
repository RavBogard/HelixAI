// src/lib/helix/exp-controller-podgo.test.ts
// TDD RED phase: Failing tests for Pod Go EXP pedal controller assignment,
// Stadium zero-EXP verification, and cross-device EXP compliance.
//
// Pod Go has 1 expression pedal (EXP1 only). Wah must get EXP1 assignment;
// Volume Pedal must NOT get EXP2 (pedal doesn't exist).
// Stadium has 0 expression pedals — zero EXP entries.

import { describe, it, expect } from "vitest";
import { buildPgpFile } from "./podgo-builder";
import { buildHlxFile } from "./preset-builder";
import { buildStompFile } from "./stomp-builder";
import { buildHspFile } from "./stadium-builder";
import { CONTROLLERS } from "./models";
import { POD_GO_SNAPSHOT_CONTROLLER } from "./types";
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
// Pod Go EXP controller tests
// ---------------------------------------------------------------------------

describe("EXP Controller Assignment — Pod Go", () => {
  it("assigns EXP_PEDAL_1 to wah Position in dsp0 controller", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Pod Go template blocks at 0,1,4 — user blocks start at block2: wah=block2, amp=block3, cab=block5
    expect(controller.dsp0["block2"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });
  });

  it("assigns EXP1 to wah but NO EXP2 to Volume Pedal (Pod Go has 1 pedal only)", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
      makeVolumePedalBlock({ dsp: 0, position: 3 }),
    ];
    const spec = makePresetSpec(chain);
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Template blocks at 0,1,4 — user: wah=block2, amp=block3, cab=block5, vol=block6
    expect(controller.dsp0["block2"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });

    // Volume Pedal (block6) must NOT have EXP2 — Pod Go has only 1 expression pedal
    const volBlock = controller.dsp0["block6"];
    if (volBlock && volBlock["Position"]) {
      const posEntry = volBlock["Position"] as Record<string, unknown>;
      expect(posEntry["@controller"]).not.toBe(CONTROLLERS.EXP_PEDAL_2);
    }
  });

  it("emits no EXP entries when no wah or volume blocks", () => {
    const chain: BlockSpec[] = [
      makeBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Scan all entries for EXP controllers
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

  it("does NOT assign EXP to Gain Block (uses Gain param, not Position)", () => {
    const chain: BlockSpec[] = [
      makeAmpBlock({ dsp: 0, position: 0 }),
      makeCabBlock({ dsp: 0, position: 1 }),
      makeGainBlock({ dsp: 0, position: 2 }),
    ];
    const spec = makePresetSpec(chain);
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Gain Block (block2) should not have any EXP entries
    const block2 = controller.dsp0["block2"];
    if (block2) {
      for (const paramEntry of Object.values(block2)) {
        if (typeof paramEntry === "object" && paramEntry !== null && "@controller" in paramEntry) {
          const ctrl = (paramEntry as Record<string, unknown>)["@controller"];
          expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_1);
          expect(ctrl).not.toBe(CONTROLLERS.EXP_PEDAL_2);
        }
      }
    }
  });

  it("does NOT overwrite snapshot controller on wah Position (defensive guard)", () => {
    // If wah Position varies across snapshots, snapshot loop writes @controller:4
    // EXP assignment must NOT overwrite that with @controller:1
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
    ];
    const snaps: Partial<SnapshotSpec>[] = [
      { parameterOverrides: { block0: { Position: 0.3 } } },
      { parameterOverrides: { block0: { Position: 0.8 } } },
      { parameterOverrides: { block0: { Position: 0.5 } } },
      { parameterOverrides: { block0: { Position: 1.0 } } },
    ];
    const spec = makePresetSpec(chain, snaps);
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Template blocks at 0,1,4 — user: wah=block2 — Position should have snapshot controller, NOT EXP
    const posEntry = controller.dsp0["block2"]["Position"] as Record<string, unknown>;
    expect(posEntry["@controller"]).toBe(POD_GO_SNAPSHOT_CONTROLLER); // 4
    expect(posEntry["@controller"]).not.toBe(CONTROLLERS.EXP_PEDAL_1); // NOT 1
  });
});

// ---------------------------------------------------------------------------
// Stadium zero-EXP test
// ---------------------------------------------------------------------------

describe("EXP Controller Assignment — Stadium", () => {
  it("emits zero EXP controller entries (0 physical pedals)", () => {
    const chain: BlockSpec[] = [
      makeWahBlock({ dsp: 0, position: 0 }),
      makeAmpBlock({ dsp: 0, position: 1 }),
      makeCabBlock({ dsp: 0, position: 2 }),
      makeVolumePedalBlock({ dsp: 0, position: 3 }),
    ];
    const spec = makePresetSpec(chain);
    const hsp = buildHspFile(spec);

    // Stadium output is in hsp.json.preset — deep scan for @controller:1 or @controller:2
    const serialized = JSON.stringify(hsp.json);
    // Neither EXP_PEDAL_1 (1) nor EXP_PEDAL_2 (2) should appear as @controller values
    // Use a regex to find any @controller entries and verify none are EXP values
    const controllerMatches = serialized.match(/"@controller"\s*:\s*(\d+)/g);
    if (controllerMatches) {
      for (const match of controllerMatches) {
        const value = parseInt(match.replace(/"@controller"\s*:\s*/, ""));
        expect(value).not.toBe(CONTROLLERS.EXP_PEDAL_1);
        expect(value).not.toBe(CONTROLLERS.EXP_PEDAL_2);
      }
    }
    // Also verify there is no "controller" key in the stadium preset at all
    expect(hsp.json.preset).not.toHaveProperty("controller");
  });
});

// ---------------------------------------------------------------------------
// Cross-device EXP compliance
// ---------------------------------------------------------------------------

describe("Cross-device EXP pedal count compliance", () => {
  // Shared chain with both wah and volume pedal
  const chain: BlockSpec[] = [
    makeWahBlock({ dsp: 0, position: 0 }),
    makeAmpBlock({ dsp: 0, position: 1 }),
    makeCabBlock({ dsp: 0, position: 2 }),
    makeVolumePedalBlock({ dsp: 0, position: 3 }),
  ];
  const spec = makePresetSpec(chain);

  it("Helix LT: EXP1 on wah + EXP2 on volume (3 pedals, 2 used)", () => {
    const hlx = buildHlxFile(spec, "helix_lt");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Helix skips cabs: wah=block0, amp=block1, volume=block2
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

  it("HX Stomp: EXP1 on wah + EXP2 on volume (2 pedals, 2 used)", () => {
    const hlx = buildStompFile(spec, "helix_stomp");
    const controller = hlx.data.tone.controller as ControllerSection;

    // Stomp skips cabs: wah=block0, amp=block1, volume=block2
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

  it("Pod Go: EXP1 on wah only, NO EXP2 on volume (1 pedal)", () => {
    const pgp = buildPgpFile(spec);
    const controller = pgp.data.tone.controller as ControllerSection;

    // Template blocks at 0,1,4 — user: wah=block2, amp=block3, cab=block5, vol=block6
    expect(controller.dsp0["block2"]["Position"]).toEqual({
      "@min": 0.0,
      "@max": 1.0,
      "@controller": CONTROLLERS.EXP_PEDAL_1,
    });

    // Volume Pedal (block6) must NOT have EXP2
    const volBlock = controller.dsp0["block6"];
    if (volBlock && volBlock["Position"]) {
      expect((volBlock["Position"] as Record<string, unknown>)["@controller"]).not.toBe(CONTROLLERS.EXP_PEDAL_2);
    }
  });

  it("Stadium: zero EXP entries (0 pedals)", () => {
    const hsp = buildHspFile(spec);
    const serialized = JSON.stringify(hsp.json);

    // No EXP controller values in the entire output
    const controllerMatches = serialized.match(/"@controller"\s*:\s*(\d+)/g);
    if (controllerMatches) {
      for (const match of controllerMatches) {
        const value = parseInt(match.replace(/"@controller"\s*:\s*/, ""));
        expect(value).not.toBe(CONTROLLERS.EXP_PEDAL_1);
        expect(value).not.toBe(CONTROLLERS.EXP_PEDAL_2);
      }
    }
  });
});
