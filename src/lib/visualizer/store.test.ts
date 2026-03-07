// store.test.ts — Unit tests for the Visualizer Zustand store (Phase 77-01)
// Tests all actions and selectors per plan specification.

import { describe, it, expect, beforeEach } from "vitest";
import type { BlockSpec, SnapshotSpec, DeviceTarget } from "../helix/types";
import {
  useVisualizerStore,
  getEffectiveBlockState,
  getBlocksByDsp,
  generateBlockId,
} from "./store";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTestBlocks(): BlockSpec[] {
  return [
    {
      type: "amp",
      modelId: "US Double Nrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Drive: 0.5, Bass: 0.6, Mid: 0.5, Treble: 0.7, ChVol: 0.8 },
    },
    {
      type: "delay",
      modelId: "Simple Delay",
      modelName: "Simple Delay",
      dsp: 0,
      position: 2,
      path: 0,
      enabled: true,
      stereo: true,
      parameters: { Time: 0.5, Feedback: 0.4, Mix: 0.3 },
    },
    {
      type: "reverb",
      modelId: "Glitz",
      modelName: "Glitz",
      dsp: 1,
      position: 0,
      path: 0,
      enabled: true,
      stereo: true,
      parameters: { Decay: 0.6, Mix: 0.35, PreDelay: 0.1 },
    },
  ];
}

function makeTestSnapshots(): SnapshotSpec[] {
  return [
    {
      name: "Clean",
      description: "Clean tone",
      ledColor: 1,
      blockStates: { amp0: true, delay2: false, reverb0: true },
      parameterOverrides: {
        amp0: { Drive: 0.3 },
      },
    },
    {
      name: "Crunch",
      description: "Medium gain",
      ledColor: 2,
      blockStates: { amp0: true, delay2: true, reverb0: true },
      parameterOverrides: {
        amp0: { Drive: 0.7 },
        delay2: { Mix: 0.5 },
      },
    },
    {
      name: "Lead",
      description: "High gain lead",
      ledColor: 3,
      blockStates: { amp0: true, delay2: true, reverb0: true },
      parameterOverrides: {
        amp0: { Drive: 0.9, Mid: 0.7 },
      },
    },
    {
      name: "Ambient",
      description: "Ambient wash",
      ledColor: 4,
      blockStates: { amp0: true, delay2: true, reverb0: true },
      parameterOverrides: {
        reverb0: { Decay: 0.9, Mix: 0.6 },
      },
    },
  ];
}

const INITIAL_STATE = {
  device: "helix_lt" as DeviceTarget,
  baseBlocks: [] as BlockSpec[],
  snapshots: [
    { name: "Snapshot 1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
  ] as SnapshotSpec[],
  activeSnapshotIndex: 0,
  selectedBlockId: null as string | null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateBlockId", () => {
  it("generates id from type and position", () => {
    const block = makeTestBlocks()[0]; // amp at position 0
    expect(generateBlockId(block)).toBe("amp0");
  });

  it("generates unique ids for different positions", () => {
    const blocks = makeTestBlocks();
    expect(generateBlockId(blocks[1])).toBe("delay2");
    expect(generateBlockId(blocks[2])).toBe("reverb0");
  });
});

describe("useVisualizerStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useVisualizerStore.setState({ ...INITIAL_STATE, snapshots: [...INITIAL_STATE.snapshots.map(s => ({ ...s }))] });
  });

  describe("hydrate()", () => {
    it("populates device, baseBlocks, snapshots, resets activeSnapshotIndex and selectedBlockId", () => {
      const blocks = makeTestBlocks();
      const snapshots = makeTestSnapshots();

      useVisualizerStore.getState().hydrate("helix_floor", blocks, snapshots);

      const state = useVisualizerStore.getState();
      expect(state.device).toBe("helix_floor");
      expect(state.baseBlocks).toHaveLength(3);
      expect(state.snapshots).toHaveLength(4);
      expect(state.activeSnapshotIndex).toBe(0);
      expect(state.selectedBlockId).toBeNull();
    });

    it("called twice replaces all state — no stale data from first call", () => {
      const blocks1 = makeTestBlocks();
      const snapshots1 = makeTestSnapshots();

      // First hydration
      useVisualizerStore.getState().hydrate("helix_floor", blocks1, snapshots1);

      // Second hydration with different data
      const blocks2: BlockSpec[] = [
        {
          type: "distortion",
          modelId: "Scream 808",
          modelName: "Scream 808",
          dsp: 0,
          position: 0,
          path: 0,
          enabled: true,
          stereo: false,
          parameters: { Gain: 0.6 },
        },
      ];
      const snapshots2: SnapshotSpec[] = [
        { name: "S1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      ];

      useVisualizerStore.getState().hydrate("pod_go", blocks2, snapshots2);

      const state = useVisualizerStore.getState();
      expect(state.device).toBe("pod_go");
      expect(state.baseBlocks).toHaveLength(1);
      expect(state.baseBlocks[0].modelId).toBe("Scream 808");
      expect(state.snapshots[0].name).toBe("S1");
      // Verify first hydration's data is completely gone
      expect(state.baseBlocks.find((b) => b.modelId === "US Double Nrm")).toBeUndefined();
      expect(state.snapshots.find((s) => s.name === "Clean")).toBeUndefined();
    });
  });

  describe("setActiveSnapshot()", () => {
    it("changes activeSnapshotIndex", () => {
      useVisualizerStore.getState().setActiveSnapshot(2);
      expect(useVisualizerStore.getState().activeSnapshotIndex).toBe(2);
    });

    it("clamps out-of-range high index to 3", () => {
      useVisualizerStore.getState().setActiveSnapshot(5);
      expect(useVisualizerStore.getState().activeSnapshotIndex).toBe(3);
    });

    it("clamps negative index to 0", () => {
      useVisualizerStore.getState().setActiveSnapshot(-1);
      expect(useVisualizerStore.getState().activeSnapshotIndex).toBe(0);
    });
  });

  describe("selectBlock()", () => {
    it("sets selectedBlockId to a block id", () => {
      useVisualizerStore.getState().selectBlock("block0");
      expect(useVisualizerStore.getState().selectedBlockId).toBe("block0");
    });

    it("clears selectedBlockId when passed null", () => {
      useVisualizerStore.getState().selectBlock("block0");
      useVisualizerStore.getState().selectBlock(null);
      expect(useVisualizerStore.getState().selectedBlockId).toBeNull();
    });
  });

  describe("setParameterValue()", () => {
    beforeEach(() => {
      useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
    });

    it("writes to active snapshot parameterOverrides, not baseBlocks", () => {
      // activeSnapshotIndex is 0 after hydrate
      useVisualizerStore.getState().setParameterValue("amp0", "Drive", 0.8);

      const state = useVisualizerStore.getState();
      // Snapshot 0 should have the override
      expect(state.snapshots[0].parameterOverrides.amp0.Drive).toBe(0.8);
      // Base block should be untouched (original value was 0.5)
      expect(state.baseBlocks[0].parameters.Drive).toBe(0.5);
    });

    it("only writes to the active snapshot, not others", () => {
      useVisualizerStore.getState().setActiveSnapshot(1);
      useVisualizerStore.getState().setParameterValue("amp0", "Drive", 0.95);

      const state = useVisualizerStore.getState();
      // Snapshot 1 should have the new value
      expect(state.snapshots[1].parameterOverrides.amp0.Drive).toBe(0.95);
      // Snapshot 0 should retain its original override (0.3 from test data)
      expect(state.snapshots[0].parameterOverrides.amp0.Drive).toBe(0.3);
      // Snapshot 2 and 3 should be untouched
      expect(state.snapshots[2].parameterOverrides.amp0?.Drive).toBe(0.9);
      expect(state.snapshots[3].parameterOverrides.amp0).toBeUndefined();
    });

    it("creates nested override objects if they do not exist", () => {
      useVisualizerStore.getState().setParameterValue("reverb0", "NewParam", 0.42);

      const state = useVisualizerStore.getState();
      expect(state.snapshots[0].parameterOverrides.reverb0.NewParam).toBe(0.42);
    });
  });

  describe("moveBlock()", () => {
    beforeEach(() => {
      useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
    });

    it("changes a block's dsp and position fields", () => {
      const result = useVisualizerStore.getState().moveBlock("delay2", { dsp: 1, position: 1, path: 0 });

      expect(result.success).toBe(true);
      const state = useVisualizerStore.getState();
      const moved = state.baseBlocks.find((b) => b.modelId === "Simple Delay");
      expect(moved?.dsp).toBe(1);
      expect(moved?.position).toBe(1);
    });

    it("returns error for non-existent block", () => {
      const result = useVisualizerStore.getState().moveBlock("nonexistent99", { dsp: 0, position: 0, path: 0 });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("swapBlockModel()", () => {
    beforeEach(() => {
      useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
    });

    it("changes modelId, modelName and resets parameters to empty", () => {
      useVisualizerStore.getState().swapBlockModel("amp0", "Minotaur");

      const state = useVisualizerStore.getState();
      const swapped = state.baseBlocks.find((b) => generateBlockId(b) === "amp0");
      expect(swapped?.modelId).toBe("Minotaur");
      expect(swapped?.modelName).toBe("Minotaur");
      expect(swapped?.parameters).toEqual({});
    });

    it("preserves other block fields (position, dsp, type)", () => {
      useVisualizerStore.getState().swapBlockModel("amp0", "Minotaur");

      const state = useVisualizerStore.getState();
      const swapped = state.baseBlocks.find((b) => generateBlockId(b) === "amp0");
      expect(swapped?.dsp).toBe(0);
      expect(swapped?.position).toBe(0);
      expect(swapped?.type).toBe("amp");
    });
  });
});

describe("getEffectiveBlockState()", () => {
  beforeEach(() => {
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  it("merges base parameters with active snapshot overrides — snapshot wins", () => {
    const state = useVisualizerStore.getState();
    // Snapshot 0 has amp0.Drive override = 0.3, base has 0.5
    const effective = getEffectiveBlockState(state, "amp0");
    expect(effective).not.toBeNull();
    expect(effective!.parameters.Drive).toBe(0.3);
    // Non-overridden params remain at base values
    expect(effective!.parameters.Bass).toBe(0.6);
  });

  it("returns base parameters unchanged when no overrides exist", () => {
    const state = useVisualizerStore.getState();
    // Snapshot 0 has no overrides for delay2 parameters (only blockStates)
    // But test data does have amp0 overrides; check reverb0 which has no override in snap 0
    // Actually snap 0 has no param overrides for reverb0
    const effective = getEffectiveBlockState(state, "reverb0");
    expect(effective).not.toBeNull();
    expect(effective!.parameters.Decay).toBe(0.6);
    expect(effective!.parameters.Mix).toBe(0.35);
  });

  it("includes bypass state from active snapshot blockStates", () => {
    const state = useVisualizerStore.getState();
    // Snapshot 0: delay2 is false (bypassed)
    const effective = getEffectiveBlockState(state, "delay2");
    expect(effective).not.toBeNull();
    expect(effective!.enabled).toBe(false);
  });

  it("returns null for non-existent blockId", () => {
    const state = useVisualizerStore.getState();
    expect(getEffectiveBlockState(state, "nonexistent99")).toBeNull();
  });

  it("uses different snapshot overrides when activeSnapshotIndex changes", () => {
    useVisualizerStore.getState().setActiveSnapshot(1);
    const state = useVisualizerStore.getState();
    // Snapshot 1 has amp0.Drive = 0.7
    const effective = getEffectiveBlockState(state, "amp0");
    expect(effective!.parameters.Drive).toBe(0.7);
  });
});

describe("getBlocksByDsp()", () => {
  beforeEach(() => {
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  it("groups blocks by DSP index", () => {
    const state = useVisualizerStore.getState();
    const { dsp0, dsp1 } = getBlocksByDsp(state);

    expect(dsp0).toHaveLength(2); // amp and delay are on dsp 0
    expect(dsp1).toHaveLength(1); // reverb is on dsp 1
  });

  it("sorts blocks by position within each DSP group", () => {
    const state = useVisualizerStore.getState();
    const { dsp0 } = getBlocksByDsp(state);

    // amp at position 0 should come before delay at position 2
    expect(dsp0[0].type).toBe("amp");
    expect(dsp0[0].position).toBe(0);
    expect(dsp0[1].type).toBe("delay");
    expect(dsp0[1].position).toBe(2);
  });

  it("returns empty arrays when no blocks on a DSP", () => {
    const blocksAllDsp0: BlockSpec[] = [
      {
        type: "amp",
        modelId: "Test",
        modelName: "Test",
        dsp: 0,
        position: 0,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {},
      },
    ];
    useVisualizerStore.getState().hydrate("helix_lt", blocksAllDsp0, makeTestSnapshots());

    const state = useVisualizerStore.getState();
    const { dsp0, dsp1 } = getBlocksByDsp(state);
    expect(dsp0).toHaveLength(1);
    expect(dsp1).toHaveLength(0);
  });
});
