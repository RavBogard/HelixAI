// Dehydrate tests — Phase 83, Plan 01, Task 2
// TDD RED: Tests for dehydrateToPresetSpec() and /api/download

import { describe, it, expect } from "vitest";
import { dehydrateToPresetSpec } from "./dehydrate";
import { hydrateVisualizerState } from "./hydrate";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "@/lib/helix/types";

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
    parameters: { Drive: 0.5, Tone: 0.6 },
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SnapshotSpec> = {}): SnapshotSpec {
  return {
    name: "Snapshot 1",
    description: "",
    ledColor: 0,
    blockStates: {},
    parameterOverrides: {},
    ...overrides,
  };
}

function makePresetSpec(overrides: Partial<PresetSpec> = {}): PresetSpec {
  return {
    name: "Test Preset",
    description: "A test preset",
    tempo: 120,
    signalChain: [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", modelName: "Brit 2204", position: 0 }),
      makeBlock({ type: "cab", modelId: "HD2_Cab4x12", modelName: "4x12 XXL", position: 1 }),
      makeBlock({ type: "distortion", position: 2 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", modelName: "Simple Delay", position: 3 }),
    ],
    snapshots: [
      makeSnapshot({ name: "Clean" }),
      makeSnapshot({ name: "Drive", blockStates: { distortion2: false } }),
      makeSnapshot({ name: "Lead" }),
      makeSnapshot({ name: "Ambient" }),
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// dehydrateToPresetSpec tests
// ---------------------------------------------------------------------------

describe("dehydrateToPresetSpec", () => {
  it("converts baseBlocks + snapshots + meta into a valid PresetSpec", () => {
    const baseBlocks = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1 }),
    ];
    const snapshots = [
      makeSnapshot({ name: "Snapshot 1" }),
      makeSnapshot({ name: "Snapshot 2" }),
      makeSnapshot({ name: "Snapshot 3" }),
      makeSnapshot({ name: "Snapshot 4" }),
    ];

    const result = dehydrateToPresetSpec(baseBlocks, snapshots, {
      presetName: "My Preset",
      description: "A great preset",
      tempo: 130,
    });

    expect(result.name).toBe("My Preset");
    expect(result.description).toBe("A great preset");
    expect(result.tempo).toBe(130);
    expect(result.signalChain).toEqual(baseBlocks);
    expect(result.snapshots).toEqual(snapshots);
  });

  it("preserves all BlockSpec fields", () => {
    const block: BlockSpec = {
      type: "delay",
      modelId: "HD2_DelaySimple",
      modelName: "Simple Delay",
      dsp: 1,
      position: 3,
      path: 1,
      enabled: false,
      stereo: true,
      trails: true,
      parameters: { Mix: 0.4, Time: 500, Feedback: 0.3 },
      intentRole: "ambient",
      slot: "delay_main",
    };
    const snapshots = [makeSnapshot()];

    const result = dehydrateToPresetSpec([block], snapshots, {
      presetName: "Test",
      description: "",
      tempo: 120,
    });

    const out = result.signalChain[0];
    expect(out.type).toBe("delay");
    expect(out.modelId).toBe("HD2_DelaySimple");
    expect(out.modelName).toBe("Simple Delay");
    expect(out.dsp).toBe(1);
    expect(out.position).toBe(3);
    expect(out.path).toBe(1);
    expect(out.enabled).toBe(false);
    expect(out.stereo).toBe(true);
    expect(out.trails).toBe(true);
    expect(out.parameters).toEqual({ Mix: 0.4, Time: 500, Feedback: 0.3 });
    expect(out.intentRole).toBe("ambient");
    expect(out.slot).toBe("delay_main");
  });

  it("round-trips: hydrateVisualizerState(dehydrateToPresetSpec(...)) produces equivalent structure", () => {
    const spec = makePresetSpec();
    const device = "helix_lt" as const;

    // Hydrate to visualizer state
    const hydrated = hydrateVisualizerState(spec, device);

    // Dehydrate back to PresetSpec
    const dehydrated = dehydrateToPresetSpec(
      hydrated.baseBlocks,
      hydrated.snapshots,
      {
        presetName: hydrated.presetName,
        description: hydrated.description,
        tempo: hydrated.tempo,
      },
    );

    // Verify structural equivalence
    expect(dehydrated.name).toBe(spec.name);
    expect(dehydrated.description).toBe(spec.description);
    expect(dehydrated.tempo).toBe(spec.tempo);
    expect(dehydrated.signalChain).toEqual(spec.signalChain);
    // Snapshots should match (hydrate pads to 4, original has 4)
    expect(dehydrated.snapshots.length).toBe(4);
    expect(dehydrated.snapshots[0].name).toBe(spec.snapshots[0].name);
    expect(dehydrated.snapshots[1].blockStates).toEqual(spec.snapshots[1].blockStates);
  });

  it("handles empty signal chain", () => {
    const result = dehydrateToPresetSpec([], [makeSnapshot()], {
      presetName: "Empty",
      description: "",
      tempo: 120,
    });

    expect(result.signalChain).toEqual([]);
    expect(result.name).toBe("Empty");
  });

  it("passes through snapshot parameter overrides unchanged", () => {
    const blocks = [makeBlock({ type: "amp", position: 0 })];
    const snapshots = [
      makeSnapshot({
        parameterOverrides: { amp0: { Drive: 0.9, Bass: 0.7 } },
        blockStates: { amp0: true },
      }),
    ];

    const result = dehydrateToPresetSpec(blocks, snapshots, {
      presetName: "Test",
      description: "",
      tempo: 120,
    });

    expect(result.snapshots[0].parameterOverrides).toEqual({ amp0: { Drive: 0.9, Bass: 0.7 } });
    expect(result.snapshots[0].blockStates).toEqual({ amp0: true });
  });
});
