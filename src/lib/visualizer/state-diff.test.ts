// State diff engine tests — Phase 83, Plan 01, Task 1
// TDD RED: These tests define expected behavior for calculateStateDiff()

import { describe, it, expect } from "vitest";
import { calculateStateDiff } from "./state-diff";
import type { BlockSpec, SnapshotSpec } from "@/lib/helix/types";

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

function fourSnapshots(overrides: Partial<SnapshotSpec>[] = []): SnapshotSpec[] {
  return [
    makeSnapshot(overrides[0]),
    makeSnapshot({ name: "Snapshot 2", ...overrides[1] }),
    makeSnapshot({ name: "Snapshot 3", ...overrides[2] }),
    makeSnapshot({ name: "Snapshot 4", ...overrides[3] }),
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("calculateStateDiff", () => {
  it("returns empty diff when state is unchanged", () => {
    const blocks = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
      makeBlock({ type: "distortion", modelId: "HD2_DistScream808", position: 1 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(blocks, snapshots, blocks, snapshots);

    expect(diff.hasChanges).toBe(false);
    expect(diff.chainChanges).toEqual([]);
    expect(diff.modelSwaps).toEqual([]);
    expect(diff.snapshotChanges).toEqual([]);
  });

  it("detects block position change on same DSP", () => {
    const original = [
      makeBlock({ type: "distortion", position: 0, dsp: 0, path: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1, dsp: 0, path: 0 }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 2, dsp: 0, path: 0 }),
    ];
    // Reverb moved from position 2 to position 0
    const current = [
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 0, dsp: 0, path: 0 }),
      makeBlock({ type: "distortion", position: 1, dsp: 0, path: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 2, dsp: 0, path: 0 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    expect(diff.chainChanges.length).toBeGreaterThanOrEqual(1);
    // At least one block should be marked as "moved"
    const moved = diff.chainChanges.filter((c) => c.type === "moved");
    expect(moved.length).toBeGreaterThanOrEqual(1);
  });

  it("detects block moved cross-DSP", () => {
    const original = [
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 0, dsp: 0, path: 0 }),
    ];
    // Same block, now on DSP 1
    const current = [
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 0, dsp: 1, path: 0 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    const moved = diff.chainChanges.filter((c) => c.type === "moved");
    expect(moved.length).toBe(1);
    expect(moved[0]).toMatchObject({
      type: "moved",
      from: { dsp: 0, position: 0, path: 0 },
      to: { dsp: 1, position: 0, path: 0 },
    });
  });

  it("detects model swap (same position, different modelId)", () => {
    const original = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", modelName: "Brit 2204", position: 0 }),
    ];
    const current = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR2", modelName: "Brit Plexi", position: 0 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    expect(diff.modelSwaps).toEqual([
      { blockId: "amp0", fromModelId: "HD2_AmpBR1", toModelId: "HD2_AmpBR2" },
    ]);
  });

  it("detects block added", () => {
    const original = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
    ];
    const addedBlock = makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1 });
    const current = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
      addedBlock,
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    const added = diff.chainChanges.filter((c) => c.type === "added");
    expect(added.length).toBe(1);
    expect(added[0].type).toBe("added");
    if (added[0].type === "added") {
      expect(added[0].block.modelId).toBe("HD2_DelaySimple");
    }
  });

  it("detects block removed", () => {
    const original = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1 }),
    ];
    const current = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    const removed = diff.chainChanges.filter((c) => c.type === "removed");
    expect(removed.length).toBe(1);
    expect(removed[0].type).toBe("removed");
    if (removed[0].type === "removed") {
      expect(removed[0].blockId).toBe("delay1");
    }
  });

  it("detects snapshot parameter override change", () => {
    const blocks = [
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1 }),
    ];
    const originalSnaps = fourSnapshots([
      {},
      { parameterOverrides: { delay1: { Mix: 0.3 } } },
    ]);
    const currentSnaps = fourSnapshots([
      {},
      { parameterOverrides: { delay1: { Mix: 0.8 } } },
    ]);

    const diff = calculateStateDiff(blocks, originalSnaps, blocks, currentSnaps);

    expect(diff.hasChanges).toBe(true);
    expect(diff.snapshotChanges.length).toBeGreaterThanOrEqual(1);
    const snap1Change = diff.snapshotChanges.find((s) => s.index === 1);
    expect(snap1Change).toBeDefined();
    expect(snap1Change!.parameterOverrides).toEqual({ delay1: { Mix: 0.8 } });
  });

  it("detects snapshot bypass state change", () => {
    const blocks = [
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 0 }),
    ];
    const originalSnaps = fourSnapshots([
      { blockStates: { reverb0: true } },
    ]);
    const currentSnaps = fourSnapshots([
      { blockStates: { reverb0: false } },
    ]);

    const diff = calculateStateDiff(blocks, originalSnaps, blocks, currentSnaps);

    expect(diff.hasChanges).toBe(true);
    expect(diff.snapshotChanges.length).toBeGreaterThanOrEqual(1);
    const snap0Change = diff.snapshotChanges.find((s) => s.index === 0);
    expect(snap0Change).toBeDefined();
    expect(snap0Change!.blockStates).toEqual({ reverb0: false });
  });

  it("captures mixed changes correctly", () => {
    const original = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0, dsp: 0 }),
      makeBlock({ type: "distortion", position: 1, dsp: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 2, dsp: 0 }),
    ];
    // Amp model swapped, distortion removed, delay moved, new reverb added
    const current = [
      makeBlock({ type: "amp", modelId: "HD2_AmpFender", position: 0, dsp: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimple", position: 1, dsp: 1 }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 2, dsp: 0 }),
    ];
    const originalSnaps = fourSnapshots([{ blockStates: { amp0: true } }]);
    const currentSnaps = fourSnapshots([{ blockStates: { amp0: false } }]);

    const diff = calculateStateDiff(original, originalSnaps, current, currentSnaps);

    expect(diff.hasChanges).toBe(true);
    // Model swap
    expect(diff.modelSwaps.length).toBe(1);
    expect(diff.modelSwaps[0].fromModelId).toBe("HD2_AmpBR1");
    expect(diff.modelSwaps[0].toModelId).toBe("HD2_AmpFender");
    // Chain changes: distortion removed + delay moved + reverb added
    expect(diff.chainChanges.length).toBeGreaterThanOrEqual(2);
    // Snapshot changes
    expect(diff.snapshotChanges.length).toBeGreaterThanOrEqual(1);
  });

  it("hasChanges is false only when all change arrays are empty", () => {
    const blocks = [makeBlock({ type: "amp", position: 0 })];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(blocks, snapshots, blocks, snapshots);

    expect(diff.hasChanges).toBe(false);
    expect(diff.chainChanges).toHaveLength(0);
    expect(diff.modelSwaps).toHaveLength(0);
    expect(diff.snapshotChanges).toHaveLength(0);
  });

  it("detects new snapshot parameter override where none existed", () => {
    const blocks = [
      makeBlock({ type: "amp", modelId: "HD2_AmpBR1", position: 0 }),
    ];
    const originalSnaps = fourSnapshots();
    const currentSnaps = fourSnapshots([
      { parameterOverrides: { amp0: { Drive: 0.9 } } },
    ]);

    const diff = calculateStateDiff(blocks, originalSnaps, blocks, currentSnaps);

    expect(diff.hasChanges).toBe(true);
    const snap0 = diff.snapshotChanges.find((s) => s.index === 0);
    expect(snap0).toBeDefined();
    expect(snap0!.parameterOverrides).toEqual({ amp0: { Drive: 0.9 } });
  });

  it("detects path change within same DSP and position", () => {
    const original = [
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 0, dsp: 0, path: 0 }),
    ];
    const current = [
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", position: 0, dsp: 0, path: 1 }),
    ];
    const snapshots = fourSnapshots();

    const diff = calculateStateDiff(original, snapshots, current, snapshots);

    expect(diff.hasChanges).toBe(true);
    const moved = diff.chainChanges.filter((c) => c.type === "moved");
    expect(moved.length).toBe(1);
    expect(moved[0]).toMatchObject({
      type: "moved",
      from: { dsp: 0, position: 0, path: 0 },
      to: { dsp: 0, position: 0, path: 1 },
    });
  });
});
