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

// ---------------------------------------------------------------------------
// Phase 81-01 Task 1: Snapshot system — toggleBlockBypass + isolation tests
// ---------------------------------------------------------------------------

describe("snapshot system", () => {
  beforeEach(() => {
    useVisualizerStore.setState({ ...INITIAL_STATE, snapshots: [...INITIAL_STATE.snapshots.map(s => ({ ...s }))] });
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  describe("toggleBlockBypass()", () => {
    it("flips block from enabled to disabled in active snapshot", () => {
      // amp0 is enabled=true in base, blockStates.amp0=true in snapshot 0
      useVisualizerStore.getState().toggleBlockBypass("amp0");
      const state = useVisualizerStore.getState();
      expect(state.snapshots[0].blockStates["amp0"]).toBe(false);
    });

    it("flips block from disabled to enabled in active snapshot", () => {
      // delay2 is bypassed (false) in snapshot 0
      useVisualizerStore.getState().toggleBlockBypass("delay2");
      const state = useVisualizerStore.getState();
      expect(state.snapshots[0].blockStates["delay2"]).toBe(true);
    });

    it("does not modify other snapshots", () => {
      // Switch to snapshot 1 and toggle amp0
      useVisualizerStore.getState().setActiveSnapshot(1);
      const beforeSnap0 = { ...useVisualizerStore.getState().snapshots[0].blockStates };
      const beforeSnap2 = { ...useVisualizerStore.getState().snapshots[2].blockStates };
      const beforeSnap3 = { ...useVisualizerStore.getState().snapshots[3].blockStates };

      useVisualizerStore.getState().toggleBlockBypass("amp0");

      const state = useVisualizerStore.getState();
      expect(state.snapshots[0].blockStates).toEqual(beforeSnap0);
      expect(state.snapshots[2].blockStates).toEqual(beforeSnap2);
      expect(state.snapshots[3].blockStates).toEqual(beforeSnap3);
    });

    it("does not modify baseBlock.enabled", () => {
      // amp0 base enabled=true
      useVisualizerStore.getState().toggleBlockBypass("amp0");
      const state = useVisualizerStore.getState();
      expect(state.baseBlocks[0].enabled).toBe(true);
    });

    it("defaults to base enabled value when no blockStates entry exists", () => {
      // Use fresh snapshots with empty blockStates
      const emptySnapshots: SnapshotSpec[] = [
        { name: "S1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      ];
      useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), emptySnapshots);

      // amp0 base enabled=true, no blockStates entry -> first toggle should set to false
      useVisualizerStore.getState().toggleBlockBypass("amp0");
      const state = useVisualizerStore.getState();
      expect(state.snapshots[0].blockStates["amp0"]).toBe(false);
    });
  });

  describe("setParameterValue isolation", () => {
    it("writes only to active snapshot overlay — other snapshots untouched", () => {
      useVisualizerStore.getState().setActiveSnapshot(1);
      useVisualizerStore.getState().setParameterValue("amp0", "Drive", 0.9);

      const state = useVisualizerStore.getState();
      expect(state.snapshots[1].parameterOverrides.amp0.Drive).toBe(0.9);
      // Snap 0 had amp0.Drive = 0.3 from test data - should be untouched
      expect(state.snapshots[0].parameterOverrides.amp0.Drive).toBe(0.3);
      // Snap 2 had amp0.Drive = 0.9 from test data — should be untouched
      expect(state.snapshots[2].parameterOverrides.amp0.Drive).toBe(0.9);
      // Snap 3 had no amp0 overrides
      expect(state.snapshots[3].parameterOverrides.amp0).toBeUndefined();
    });

    it("does not modify baseBlock parameters", () => {
      useVisualizerStore.getState().setActiveSnapshot(1);
      useVisualizerStore.getState().setParameterValue("amp0", "Drive", 0.9);

      const state = useVisualizerStore.getState();
      // Base Drive was 0.5
      expect(state.baseBlocks[0].parameters.Drive).toBe(0.5);
    });
  });

  describe("getEffectiveBlockState snapshot integration", () => {
    it("returns bypassed state from active snapshot", () => {
      // Snapshot 0: delay2 blockStates = false (bypassed)
      const state = useVisualizerStore.getState();
      const effective = getEffectiveBlockState(state, "delay2");
      expect(effective).not.toBeNull();
      expect(effective!.enabled).toBe(false);
    });

    it("returns base enabled when snapshot has no override", () => {
      // Use fresh snapshots with empty blockStates
      const emptySnapshots: SnapshotSpec[] = [
        { name: "S1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
        { name: "S4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      ];
      useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), emptySnapshots);

      const state = useVisualizerStore.getState();
      // amp0 base enabled=true, no blockStates entry
      const effective = getEffectiveBlockState(state, "amp0");
      expect(effective).not.toBeNull();
      expect(effective!.enabled).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 79-01 Task 2: addBlock, removeBlock, reorderBlock store actions
// ---------------------------------------------------------------------------

describe("addBlock()", () => {
  beforeEach(() => {
    useVisualizerStore.setState({ ...INITIAL_STATE, snapshots: [...INITIAL_STATE.snapshots.map(s => ({ ...s }))] });
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  it("inserts a block at the specified position on the target DSP", () => {
    const result = useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      1,
    );
    expect(result.success).toBe(true);

    const state = useVisualizerStore.getState();
    const dsp0Blocks = state.baseBlocks
      .filter((b) => b.dsp === 0)
      .sort((a, b) => a.position - b.position);
    // Should have 3 blocks on DSP 0 now (amp at 0, distortion at 1, delay shifted to 3)
    expect(dsp0Blocks).toHaveLength(3);
    expect(dsp0Blocks[1].type).toBe("distortion");
    expect(dsp0Blocks[1].position).toBe(1);
  });

  it("returns error when canAddBlock rejects (at device limit)", () => {
    // Fill up to maxBlocksTotal (32 for Helix)
    const fullBlocks: BlockSpec[] = Array.from({ length: 32 }, (_, i) => ({
      type: "delay" as const,
      modelId: `delay-${i}`,
      modelName: `Delay ${i}`,
      dsp: (i < 16 ? 0 : 1) as 0 | 1,
      position: i % 16,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: {},
    }));
    useVisualizerStore.getState().hydrate("helix_lt", fullBlocks, makeTestSnapshots());

    const result = useVisualizerStore.getState().addBlock(
      { type: "reverb", modelId: "Glitz", modelName: "Glitz" },
      0,
      0,
    );
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("shifts subsequent block positions when inserting", () => {
    // Add a block at position 0 on DSP 0, amp (currently at 0) should shift to 1
    useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      0,
    );

    const state = useVisualizerStore.getState();
    const dsp0Blocks = state.baseBlocks
      .filter((b) => b.dsp === 0)
      .sort((a, b) => a.position - b.position);
    expect(dsp0Blocks[0].type).toBe("distortion");
    expect(dsp0Blocks[0].position).toBe(0);
    expect(dsp0Blocks[1].type).toBe("amp");
    expect(dsp0Blocks[1].position).toBe(1);
  });

  it("sets default values for new block (enabled, stereo, path, parameters)", () => {
    useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      5,
    );

    const state = useVisualizerStore.getState();
    const newBlock = state.baseBlocks.find((b) => b.modelId === "Scream 808");
    expect(newBlock).toBeDefined();
    expect(newBlock!.enabled).toBe(true);
    expect(newBlock!.stereo).toBe(false);
    expect(newBlock!.path).toBe(0);
    expect(newBlock!.parameters).toEqual({});
  });
});

describe("removeBlock()", () => {
  beforeEach(() => {
    useVisualizerStore.setState({ ...INITIAL_STATE, snapshots: [...INITIAL_STATE.snapshots.map(s => ({ ...s }))] });
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  it("removes block from baseBlocks", () => {
    const result = useVisualizerStore.getState().removeBlock("delay2");
    expect(result.success).toBe(true);

    const state = useVisualizerStore.getState();
    expect(state.baseBlocks).toHaveLength(2); // was 3, now 2
    expect(state.baseBlocks.find((b) => b.modelId === "Simple Delay")).toBeUndefined();
  });

  it("returns error for non-existent block", () => {
    const result = useVisualizerStore.getState().removeBlock("nonexistent99");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("clears selectedBlockId when removed block was selected", () => {
    useVisualizerStore.getState().selectBlock("delay2");
    expect(useVisualizerStore.getState().selectedBlockId).toBe("delay2");

    useVisualizerStore.getState().removeBlock("delay2");
    expect(useVisualizerStore.getState().selectedBlockId).toBeNull();
  });

  it("does not clear selectedBlockId when a different block is removed", () => {
    useVisualizerStore.getState().selectBlock("amp0");

    useVisualizerStore.getState().removeBlock("delay2");
    expect(useVisualizerStore.getState().selectedBlockId).toBe("amp0");
  });

  it("renumbers positions on the same DSP after removal", () => {
    // Add another block to DSP 0 to have 3 blocks there
    useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      1,
    );

    // Remove the middle one (position 1 = distortion)
    useVisualizerStore.getState().removeBlock("distortion1");

    const state = useVisualizerStore.getState();
    const dsp0Blocks = state.baseBlocks
      .filter((b) => b.dsp === 0)
      .sort((a, b) => a.position - b.position);
    // Positions should be sequential: 0, 1 (renumbered from 0, 2)
    expect(dsp0Blocks[0].position).toBe(0);
    expect(dsp0Blocks[1].position).toBe(1);
  });
});

describe("reorderBlock()", () => {
  beforeEach(() => {
    useVisualizerStore.setState({ ...INITIAL_STATE, snapshots: [...INITIAL_STATE.snapshots.map(s => ({ ...s }))] });
    useVisualizerStore.getState().hydrate("helix_lt", makeTestBlocks(), makeTestSnapshots());
  });

  it("reorders a block within the same DSP", () => {
    // Add more blocks to DSP 0 so we can reorder
    useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      1,
    );
    // DSP 0 now: amp(0), distortion(1), delay(3→shifted to 2 probably)

    const result = useVisualizerStore.getState().reorderBlock("amp0", 2);
    expect(result.success).toBe(true);

    const state = useVisualizerStore.getState();
    const dsp0Blocks = state.baseBlocks
      .filter((b) => b.dsp === 0)
      .sort((a, b) => a.position - b.position);
    // amp should now be at position 2
    const amp = dsp0Blocks.find((b) => b.type === "amp");
    expect(amp!.position).toBe(2);
  });

  it("validates via validateMove for Pod Go fixed blocks", () => {
    // Hydrate with Pod Go and a fixed amp block
    const podGoBlocks: BlockSpec[] = [
      {
        type: "amp",
        modelId: "US Double Nrm",
        modelName: "US Double Nrm",
        dsp: 0,
        position: 3,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {},
      },
      {
        type: "delay",
        modelId: "Simple Delay",
        modelName: "Simple Delay",
        dsp: 0,
        position: 2,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {},
      },
    ];
    useVisualizerStore.getState().hydrate("pod_go", podGoBlocks, makeTestSnapshots());

    const result = useVisualizerStore.getState().reorderBlock("amp3", 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Pod Go");
  });

  it("returns error for non-existent block", () => {
    const result = useVisualizerStore.getState().reorderBlock("nonexistent99", 0);
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("renumbers all positions sequentially after reorder", () => {
    // Add blocks to have 3 on DSP 0
    useVisualizerStore.getState().addBlock(
      { type: "distortion", modelId: "Scream 808", modelName: "Scream 808" },
      0,
      1,
    );
    // Move amp (pos 0) to end (pos 2)
    useVisualizerStore.getState().reorderBlock("amp0", 2);

    const state = useVisualizerStore.getState();
    const dsp0Blocks = state.baseBlocks
      .filter((b) => b.dsp === 0)
      .sort((a, b) => a.position - b.position);
    // All positions should be sequential 0, 1, 2
    dsp0Blocks.forEach((b, i) => {
      expect(b.position).toBe(i);
    });
  });
});
