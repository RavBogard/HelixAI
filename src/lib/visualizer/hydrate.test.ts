// hydrate.test.ts — Unit tests for hydrateVisualizerState (Phase 77-02)
// Tests the transformation from PresetSpec to PreviewResult shape.

import { describe, it, expect } from "vitest";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "../helix/types";
import { hydrateVisualizerState } from "./hydrate";
import type { ControllerAssignment, FootswitchAssignment } from "./controller-assignments";

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
      parameters: { Drive: 0.5, Bass: 0.6 },
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
      parameters: { Time: 0.5, Feedback: 0.4 },
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
      parameters: { Decay: 0.6, Mix: 0.35 },
    },
  ];
}

function makeTestSnapshots(count: number): SnapshotSpec[] {
  const snapshots: SnapshotSpec[] = [];
  for (let i = 0; i < count; i++) {
    snapshots.push({
      name: `Snap ${i + 1}`,
      description: `Snapshot ${i + 1} desc`,
      ledColor: i + 1,
      blockStates: { amp0: i % 2 === 0 },
      parameterOverrides: i === 0 ? { amp0: { Drive: 0.3 } } : {},
    });
  }
  return snapshots;
}

function makePresetSpec(snapshotCount: number): PresetSpec {
  return {
    name: "Test Preset",
    description: "A test preset",
    tempo: 120,
    signalChain: makeTestBlocks(),
    snapshots: makeTestSnapshots(snapshotCount),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("hydrateVisualizerState", () => {
  it("returns baseBlocks preserving all BlockSpec fields", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.baseBlocks).toHaveLength(3);
    expect(result.baseBlocks[0].modelId).toBe("US Double Nrm");
    expect(result.baseBlocks[0].parameters.Drive).toBe(0.5);
    expect(result.baseBlocks[0].dsp).toBe(0);
    expect(result.baseBlocks[0].position).toBe(0);
    expect(result.baseBlocks[0].enabled).toBe(true);
    expect(result.baseBlocks[0].stereo).toBe(false);
  });

  it("returns exactly 4 snapshots when PresetSpec has 8 (truncates)", () => {
    const presetSpec = makePresetSpec(8);
    const result = hydrateVisualizerState(presetSpec, "helix_floor");

    expect(result.snapshots).toHaveLength(4);
    // First 4 should be from source
    expect(result.snapshots[0].name).toBe("Snap 1");
    expect(result.snapshots[3].name).toBe("Snap 4");
  });

  it("pads with empty snapshots when PresetSpec has fewer than 4", () => {
    const presetSpec = makePresetSpec(2);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.snapshots).toHaveLength(4);
    // First 2 are from source
    expect(result.snapshots[0].name).toBe("Snap 1");
    expect(result.snapshots[1].name).toBe("Snap 2");
    // Last 2 are padded
    expect(result.snapshots[2].name).toBe("Snapshot 3");
    expect(result.snapshots[2].blockStates).toEqual({});
    expect(result.snapshots[2].parameterOverrides).toEqual({});
    expect(result.snapshots[3].name).toBe("Snapshot 4");
  });

  it("preserves blockStates and parameterOverrides from source snapshots", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    // Snapshot 0 has blockStates and parameterOverrides in test data
    expect(result.snapshots[0].blockStates.amp0).toBe(true);
    expect(result.snapshots[0].parameterOverrides.amp0?.Drive).toBe(0.3);
  });

  it("returns device field matching the input device", () => {
    const presetSpec = makePresetSpec(4);

    const result1 = hydrateVisualizerState(presetSpec, "pod_go");
    expect(result1.device).toBe("pod_go");

    const result2 = hydrateVisualizerState(presetSpec, "helix_stadium");
    expect(result2.device).toBe("helix_stadium");
  });

  it("returns baseBlocks as identity of signalChain (no transformation)", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    // baseBlocks should be the exact same array reference as signalChain
    expect(result.baseBlocks).toBe(presetSpec.signalChain);
  });

  it("returns presetName, description, and tempo from PresetSpec", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.presetName).toBe("Test Preset");
    expect(result.description).toBe("A test preset");
    expect(result.tempo).toBe(120);
  });

  it("handles empty signalChain", () => {
    const presetSpec: PresetSpec = {
      name: "Empty",
      description: "Empty preset",
      tempo: 100,
      signalChain: [],
      snapshots: [],
    };
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.baseBlocks).toHaveLength(0);
    expect(result.snapshots).toHaveLength(4);
    expect(result.snapshots[0].name).toBe("Snapshot 1");
  });

  it("handles exactly 4 snapshots without truncation or padding", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.snapshots).toHaveLength(4);
    expect(result.snapshots[0].name).toBe("Snap 1");
    expect(result.snapshots[3].name).toBe("Snap 4");
  });

  // --- Phase 82 additions: controller/footswitch passthrough ---

  it("defaults controllerAssignments to [] when not provided", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.controllerAssignments).toEqual([]);
  });

  it("defaults footswitchAssignments to [] when not provided", () => {
    const presetSpec = makePresetSpec(4);
    const result = hydrateVisualizerState(presetSpec, "helix_lt");

    expect(result.footswitchAssignments).toEqual([]);
  });

  it("passes through controllerAssignments when provided", () => {
    const presetSpec = makePresetSpec(4);
    const controllers: ControllerAssignment[] = [
      { blockId: "wah0", paramKey: "Position", controller: "EXP1", min: 0, max: 1 },
    ];
    const result = hydrateVisualizerState(presetSpec, "helix_lt", controllers);

    expect(result.controllerAssignments).toEqual(controllers);
  });

  it("passes through footswitchAssignments when provided", () => {
    const presetSpec = makePresetSpec(4);
    const footswitches: FootswitchAssignment[] = [
      { blockId: "delay2", fsIndex: 5, label: "Simple DLY", ledColor: "#00FF00" },
    ];
    const result = hydrateVisualizerState(presetSpec, "helix_lt", undefined, footswitches);

    expect(result.footswitchAssignments).toEqual(footswitches);
  });
});
