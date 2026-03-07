// controller-assignments.test.ts — TDD tests for controller & footswitch extraction
// Phase 82-01, Task 1: RED phase

import { describe, it, expect } from "vitest";
import {
  extractControllerAssignments,
  extractFootswitchAssignments,
  getControllerForParam,
  getFootswitchForBlock,
  buildBlockIdMap,
} from "./controller-assignments";
import type {
  ControllerAssignment,
  FootswitchAssignment,
} from "./controller-assignments";
import type { BlockSpec } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBaseBlocks(): BlockSpec[] {
  return [
    {
      type: "wah",
      modelId: "Teardrop 310",
      modelName: "Teardrop 310",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Position: 0.5 },
    },
    {
      type: "amp",
      modelId: "US Double Nrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 1,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Drive: 0.5 },
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
      type: "volume",
      modelId: "Volume Pedal",
      modelName: "Volume Pedal",
      dsp: 1,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Position: 0.5 },
    },
    {
      type: "reverb",
      modelId: "Glitz",
      modelName: "Glitz",
      dsp: 1,
      position: 1,
      path: 0,
      enabled: true,
      stereo: true,
      parameters: { Decay: 0.6, Mix: 0.35 },
    },
  ];
}

// ---------------------------------------------------------------------------
// buildBlockIdMap tests
// ---------------------------------------------------------------------------

describe("buildBlockIdMap", () => {
  it("maps dsp:block keys to visualizer blockIds", () => {
    const blocks = makeBaseBlocks();
    const map = buildBlockIdMap(blocks);
    // dsp0 has wah0, amp1, delay2 (positions 0, 1, 2)
    expect(map.get("dsp0:block0")).toBe("wah0");
    expect(map.get("dsp0:block1")).toBe("amp1");
    expect(map.get("dsp0:block2")).toBe("delay2");
    // dsp1 has volume0, reverb1 (positions 0, 1)
    expect(map.get("dsp1:block0")).toBe("volume0");
    expect(map.get("dsp1:block1")).toBe("reverb1");
  });

  it("handles empty block list", () => {
    const map = buildBlockIdMap([]);
    expect(map.size).toBe(0);
  });

  it("skips cab blocks in the index", () => {
    const blocks: BlockSpec[] = [
      {
        type: "amp",
        modelId: "US Double Nrm",
        modelName: "US Double Nrm",
        dsp: 0,
        position: 0,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: {},
      },
      {
        type: "cab",
        modelId: "4x12 Cali V30",
        modelName: "4x12 Cali V30",
        dsp: 0,
        position: 1,
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
    const map = buildBlockIdMap(blocks);
    // Cab is skipped, so the block index should be: block0=amp, block1=delay (cab excluded)
    expect(map.get("dsp0:block0")).toBe("amp0");
    expect(map.get("dsp0:block1")).toBe("delay2");
    expect(map.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// extractControllerAssignments tests
// ---------------------------------------------------------------------------

describe("extractControllerAssignments", () => {
  it("extracts EXP_PEDAL_1 wah controller assignment", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp0: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 1, // EXP_PEDAL_1
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      blockId: "wah0",
      paramKey: "Position",
      controller: "EXP1",
      min: 0,
      max: 1,
    });
  });

  it("extracts EXP_PEDAL_2 volume controller assignment", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp1: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 2, // EXP_PEDAL_2
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      blockId: "volume0",
      paramKey: "Position",
      controller: "EXP2",
      min: 0,
      max: 1,
    });
  });

  it("extracts both EXP1 and EXP2 from cross-DSP assignments", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp0: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 1, // EXP1
          },
        },
      },
      dsp1: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 2, // EXP2
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.controller === "EXP1")?.blockId).toBe("wah0");
    expect(result.find((a) => a.controller === "EXP2")?.blockId).toBe(
      "volume0",
    );
  });

  it("filters out SNAPSHOT controllers (controller 19)", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp0: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 19, // SNAPSHOT - should be filtered
          },
        },
        block1: {
          Drive: {
            "@min": 0.2,
            "@max": 0.8,
            "@controller": 19, // SNAPSHOT - should be filtered
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(0);
  });

  it("filters out MIDI_CC controllers (controller 18)", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp0: {
        block0: {
          Position: {
            "@min": 0,
            "@max": 1,
            "@controller": 18, // MIDI_CC - should be filtered
            "@cc": 42,
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(0);
  });

  it("handles empty controller section gracefully", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const result = extractControllerAssignments({}, blockIdMap);
    expect(result).toEqual([]);
  });

  it("handles undefined controller section gracefully", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const result = extractControllerAssignments(
      undefined as unknown as Record<string, unknown>,
      blockIdMap,
    );
    expect(result).toEqual([]);
  });

  it("extracts EXP_PEDAL_3 for Stadium devices", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const controllerSection = {
      dsp0: {
        block2: {
          Time: {
            "@min": 0.1,
            "@max": 0.9,
            "@controller": 3, // EXP_PEDAL_3 (Stadium)
          },
        },
      },
    };

    const result = extractControllerAssignments(controllerSection, blockIdMap);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      blockId: "delay2",
      paramKey: "Time",
      controller: "EXP3",
      min: 0.1,
      max: 0.9,
    });
  });
});

// ---------------------------------------------------------------------------
// extractFootswitchAssignments tests
// ---------------------------------------------------------------------------

describe("extractFootswitchAssignments", () => {
  it("extracts FS5 assignment with correct label and color", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const footswitchSection = {
      dsp0: {
        block2: {
          "@fs_enabled": true,
          "@fs_index": 7, // maps to FS5
          "@fs_label": "Simple DLY",
          "@fs_ledcolor": 196608, // green
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
    };

    const result = extractFootswitchAssignments(footswitchSection, blockIdMap);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      blockId: "delay2",
      fsIndex: 5,
      label: "Simple DLY",
      ledColor: "#00FF00",
    });
  });

  it("maps @fs_index values: 7->FS5, 8->FS6, 9->FS7, 10->FS8", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const footswitchSection = {
      dsp0: {
        block0: {
          "@fs_enabled": true,
          "@fs_index": 7,
          "@fs_label": "Wah",
          "@fs_ledcolor": 65536,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
        block1: {
          "@fs_enabled": true,
          "@fs_index": 8,
          "@fs_label": "Amp",
          "@fs_ledcolor": 131072,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
        block2: {
          "@fs_enabled": true,
          "@fs_index": 9,
          "@fs_label": "Delay",
          "@fs_ledcolor": 262144,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
      dsp1: {
        block0: {
          "@fs_enabled": true,
          "@fs_index": 10,
          "@fs_label": "Volume",
          "@fs_ledcolor": 458752,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
    };

    const result = extractFootswitchAssignments(footswitchSection, blockIdMap);
    expect(result).toHaveLength(4);
    expect(result.find((a) => a.blockId === "wah0")?.fsIndex).toBe(5);
    expect(result.find((a) => a.blockId === "amp1")?.fsIndex).toBe(6);
    expect(result.find((a) => a.blockId === "delay2")?.fsIndex).toBe(7);
    expect(result.find((a) => a.blockId === "volume0")?.fsIndex).toBe(8);
  });

  it("returns empty array when no footswitch data exists", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const result = extractFootswitchAssignments({}, blockIdMap);
    expect(result).toEqual([]);
  });

  it("skips blocks with @fs_enabled: false", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const footswitchSection = {
      dsp0: {
        block0: {
          "@fs_enabled": false,
          "@fs_index": 7,
          "@fs_label": "Wah",
          "@fs_ledcolor": 65536,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
    };

    const result = extractFootswitchAssignments(footswitchSection, blockIdMap);
    expect(result).toHaveLength(0);
  });

  it("handles multiple blocks on different DSPs", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const footswitchSection = {
      dsp0: {
        block0: {
          "@fs_enabled": true,
          "@fs_index": 7,
          "@fs_label": "Wah",
          "@fs_ledcolor": 65536,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
      dsp1: {
        block1: {
          "@fs_enabled": true,
          "@fs_index": 8,
          "@fs_label": "Reverb",
          "@fs_ledcolor": 327680,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
    };

    const result = extractFootswitchAssignments(footswitchSection, blockIdMap);
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.blockId === "wah0")).toBeDefined();
    expect(result.find((a) => a.blockId === "reverb1")).toBeDefined();
  });

  it("maps LED color values to hex strings", () => {
    const blocks = makeBaseBlocks();
    const blockIdMap = buildBlockIdMap(blocks);
    const footswitchSection = {
      dsp0: {
        block0: {
          "@fs_enabled": true,
          "@fs_index": 7,
          "@fs_label": "Red",
          "@fs_ledcolor": 131072,
          "@fs_momentary": false,
          "@fs_customlabel": false,
        },
      },
    };

    const result = extractFootswitchAssignments(footswitchSection, blockIdMap);
    expect(result[0].ledColor).toBe("#FF0000");
  });
});

// ---------------------------------------------------------------------------
// Lookup helper tests
// ---------------------------------------------------------------------------

describe("getControllerForParam", () => {
  it("returns matching controller assignment", () => {
    const assignments: ControllerAssignment[] = [
      {
        blockId: "wah0",
        paramKey: "Position",
        controller: "EXP1",
        min: 0,
        max: 1,
      },
      {
        blockId: "volume0",
        paramKey: "Position",
        controller: "EXP2",
        min: 0,
        max: 1,
      },
    ];

    const result = getControllerForParam(assignments, "wah0", "Position");
    expect(result).toEqual(assignments[0]);
  });

  it("returns null when no matching assignment", () => {
    const assignments: ControllerAssignment[] = [
      {
        blockId: "wah0",
        paramKey: "Position",
        controller: "EXP1",
        min: 0,
        max: 1,
      },
    ];

    expect(getControllerForParam(assignments, "amp0", "Drive")).toBeNull();
  });

  it("returns null for empty assignments array", () => {
    expect(getControllerForParam([], "wah0", "Position")).toBeNull();
  });
});

describe("getFootswitchForBlock", () => {
  it("returns matching footswitch assignment", () => {
    const assignments: FootswitchAssignment[] = [
      { blockId: "delay2", fsIndex: 5, label: "Simple DLY", ledColor: "#00FF00" },
      { blockId: "reverb1", fsIndex: 6, label: "Glitz", ledColor: "#0000FF" },
    ];

    const result = getFootswitchForBlock(assignments, "delay2");
    expect(result).toEqual(assignments[0]);
  });

  it("returns null when no matching assignment", () => {
    const assignments: FootswitchAssignment[] = [
      { blockId: "delay2", fsIndex: 5, label: "Simple DLY", ledColor: "#00FF00" },
    ];

    expect(getFootswitchForBlock(assignments, "amp0")).toBeNull();
  });

  it("returns null for empty assignments array", () => {
    expect(getFootswitchForBlock([], "delay2")).toBeNull();
  });
});
