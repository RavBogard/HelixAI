// dnd-constraints.test.ts — TDD tests for drag-and-drop constraint engine (Phase 79-01)
// RED phase: all tests written before implementation exists.

import { describe, it, expect } from "vitest";
import type { BlockSpec } from "../helix/types";
import {
  isPodGoFixedBlock,
  validateMove,
  validateDspTransfer,
  canAddBlock,
  getAvailableSlots,
} from "./dnd-constraints";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    type: "delay",
    modelId: "Simple Delay",
    modelName: "Simple Delay",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isPodGoFixedBlock
// ---------------------------------------------------------------------------

describe("isPodGoFixedBlock", () => {
  it("returns true for amp", () => {
    expect(isPodGoFixedBlock("amp")).toBe(true);
  });

  it("returns true for cab", () => {
    expect(isPodGoFixedBlock("cab")).toBe(true);
  });

  it("returns true for wah", () => {
    expect(isPodGoFixedBlock("wah")).toBe(true);
  });

  it("returns true for volume", () => {
    expect(isPodGoFixedBlock("volume")).toBe(true);
  });

  it("returns true for eq", () => {
    expect(isPodGoFixedBlock("eq")).toBe(true);
  });

  it("returns false for delay", () => {
    expect(isPodGoFixedBlock("delay")).toBe(false);
  });

  it("returns false for reverb", () => {
    expect(isPodGoFixedBlock("reverb")).toBe(false);
  });

  it("returns false for distortion", () => {
    expect(isPodGoFixedBlock("distortion")).toBe(false);
  });

  it("returns false for modulation", () => {
    expect(isPodGoFixedBlock("modulation")).toBe(false);
  });

  it("returns false for dynamics", () => {
    expect(isPodGoFixedBlock("dynamics")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateMove
// ---------------------------------------------------------------------------

describe("validateMove", () => {
  it("rejects fixed Pod Go block (amp) with descriptive error", () => {
    const block = makeBlock({ type: "amp" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("amp");
    expect(result.error).toContain("Pod Go");
  });

  it("rejects fixed Pod Go block (cab)", () => {
    const block = makeBlock({ type: "cab" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("cab");
  });

  it("rejects fixed Pod Go block (wah)", () => {
    const block = makeBlock({ type: "wah" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(false);
  });

  it("rejects fixed Pod Go block (volume)", () => {
    const block = makeBlock({ type: "volume" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(false);
  });

  it("rejects fixed Pod Go block (eq)", () => {
    const block = makeBlock({ type: "eq" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(false);
  });

  it("allows flexible Pod Go block (delay)", () => {
    const block = makeBlock({ type: "delay" });
    const result = validateMove(block, "pod_go");
    expect(result.valid).toBe(true);
  });

  it("allows any block on non-Pod Go device (Helix)", () => {
    const block = makeBlock({ type: "amp" });
    const result = validateMove(block, "helix_floor");
    expect(result.valid).toBe(true);
  });

  it("allows any block on Stomp", () => {
    const block = makeBlock({ type: "amp" });
    const result = validateMove(block, "helix_stomp");
    expect(result.valid).toBe(true);
  });

  it("allows any block on Stadium", () => {
    const block = makeBlock({ type: "amp" });
    const result = validateMove(block, "helix_stadium");
    expect(result.valid).toBe(true);
  });

  it("also rejects fixed blocks on Pod Go XL", () => {
    const block = makeBlock({ type: "amp" });
    const result = validateMove(block, "pod_go_xl");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDspTransfer
// ---------------------------------------------------------------------------

describe("validateDspTransfer", () => {
  it("rejects cross-DSP move on single-DSP device (Stomp)", () => {
    const block = makeBlock({ type: "delay", dsp: 0 });
    const result = validateDspTransfer(block, 1, [], "helix_stomp");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Single-DSP");
  });

  it("rejects cross-DSP move on Stadium (single-DSP)", () => {
    const block = makeBlock({ type: "delay", dsp: 0 });
    const result = validateDspTransfer(block, 1, [], "helix_stadium");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Single-DSP");
  });

  it("rejects cross-DSP move on Pod Go (single-DSP)", () => {
    const block = makeBlock({ type: "delay", dsp: 0 });
    const result = validateDspTransfer(block, 1, [], "pod_go");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Single-DSP");
  });

  it("rejects when target DSP is at maxBlocksPerDsp (Helix)", () => {
    // Helix maxBlocksPerDsp = 8. Fill DSP 1 with 8 blocks.
    const blocksOnDsp1: BlockSpec[] = Array.from({ length: 8 }, (_, i) =>
      makeBlock({ type: "delay", dsp: 1, position: i }),
    );
    const block = makeBlock({ type: "reverb", dsp: 0, position: 0 });

    const result = validateDspTransfer(block, 1, blocksOnDsp1, "helix_floor");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("full");
    expect(result.error).toContain("8");
  });

  it("allows cross-DSP move when target DSP has room", () => {
    const blocksOnDsp1: BlockSpec[] = [
      makeBlock({ type: "delay", dsp: 1, position: 0 }),
    ];
    const block = makeBlock({ type: "reverb", dsp: 0, position: 0 });

    const result = validateDspTransfer(block, 1, blocksOnDsp1, "helix_floor");
    expect(result.valid).toBe(true);
  });

  it("excludes the moving block from target DSP count", () => {
    // 8 blocks on DSP 1, but one of them IS the block being moved
    // So effective count on target is 7 — should allow
    const blocks: BlockSpec[] = Array.from({ length: 8 }, (_, i) =>
      makeBlock({ type: "delay", dsp: 1, position: i, modelId: `delay-${i}` }),
    );
    // The block we're moving is already on DSP 1
    const movingBlock = blocks[0];

    const result = validateDspTransfer(movingBlock, 1, blocks, "helix_floor");
    // Since block is already on DSP 1 and we're "moving" to DSP 1,
    // effectively it's a reorder. Should be valid since count excluding self = 7 < 8.
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// canAddBlock
// ---------------------------------------------------------------------------

describe("canAddBlock", () => {
  it("returns canAdd false when at maxBlocksTotal (Helix)", () => {
    // Helix maxBlocksTotal = 32
    const blocks: BlockSpec[] = Array.from({ length: 32 }, (_, i) =>
      makeBlock({ dsp: i < 16 ? 0 : 1, position: i % 16 }),
    );
    const result = canAddBlock(blocks, "helix_floor");
    expect(result.canAdd).toBe(false);
    expect(result.reason).toContain("limit");
  });

  it("returns canAdd true when under maxBlocksTotal", () => {
    const blocks: BlockSpec[] = [makeBlock()];
    const result = canAddBlock(blocks, "helix_floor");
    expect(result.canAdd).toBe(true);
  });

  it("returns canAdd false for Pod Go when all 4 flexible slots filled", () => {
    // Pod Go flexible slots: positions 2, 6, 7, 8 (FX1-FX4)
    const blocks: BlockSpec[] = [
      makeBlock({ type: "wah", position: 0 }),
      makeBlock({ type: "volume", position: 1 }),
      makeBlock({ type: "distortion", position: 2 }),   // FX1
      makeBlock({ type: "amp", position: 3 }),
      makeBlock({ type: "cab", position: 4 }),
      makeBlock({ type: "eq", position: 5 }),
      makeBlock({ type: "delay", position: 6 }),         // FX2
      makeBlock({ type: "reverb", position: 7 }),         // FX3
      makeBlock({ type: "modulation", position: 8 }),     // FX4
    ];
    const result = canAddBlock(blocks, "pod_go");
    expect(result.canAdd).toBe(false);
    expect(result.reason).toContain("effect slot");
  });

  it("returns canAdd true for Pod Go when flexible slots are available", () => {
    // Only 2 of 4 flexible slots filled
    const blocks: BlockSpec[] = [
      makeBlock({ type: "wah", position: 0 }),
      makeBlock({ type: "volume", position: 1 }),
      makeBlock({ type: "distortion", position: 2 }),   // FX1
      makeBlock({ type: "amp", position: 3 }),
      makeBlock({ type: "cab", position: 4 }),
      makeBlock({ type: "eq", position: 5 }),
      makeBlock({ type: "delay", position: 6 }),         // FX2
    ];
    const result = canAddBlock(blocks, "pod_go");
    expect(result.canAdd).toBe(true);
  });

  it("returns canAdd false when Stomp at maxBlocksTotal", () => {
    // Stomp maxBlocksTotal = 6 (from STOMP_CONFIG)
    const blocks: BlockSpec[] = Array.from({ length: 6 }, (_, i) =>
      makeBlock({ position: i }),
    );
    const result = canAddBlock(blocks, "helix_stomp");
    expect(result.canAdd).toBe(false);
  });

  it("returns canAdd true for empty chain", () => {
    const result = canAddBlock([], "helix_floor");
    expect(result.canAdd).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getAvailableSlots
// ---------------------------------------------------------------------------

describe("getAvailableSlots", () => {
  it("returns open slots on both DSPs for dual-DSP device", () => {
    const blocks: BlockSpec[] = [
      makeBlock({ dsp: 0, position: 0 }),
      makeBlock({ dsp: 0, position: 1 }),
    ];
    const slots = getAvailableSlots(blocks, "helix_floor");
    // Should have slots on both DSPs
    const dsp0Slots = slots.filter((s) => s.dsp === 0);
    const dsp1Slots = slots.filter((s) => s.dsp === 1);
    expect(dsp0Slots.length).toBeGreaterThan(0);
    expect(dsp1Slots.length).toBeGreaterThan(0);
  });

  it("returns only unoccupied flexible slot positions for Pod Go", () => {
    // Fixed slots filled, FX1 and FX2 occupied, FX3 and FX4 open
    const blocks: BlockSpec[] = [
      makeBlock({ type: "wah", position: 0 }),
      makeBlock({ type: "volume", position: 1 }),
      makeBlock({ type: "distortion", position: 2 }),  // FX1 occupied
      makeBlock({ type: "amp", position: 3 }),
      makeBlock({ type: "cab", position: 4 }),
      makeBlock({ type: "eq", position: 5 }),
      makeBlock({ type: "delay", position: 6 }),        // FX2 occupied
    ];
    const slots = getAvailableSlots(blocks, "pod_go");
    // FX3 (position 7) and FX4 (position 8) should be available
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.position)).toContain(7);
    expect(slots.map((s) => s.position)).toContain(8);
  });

  it("returns empty array when Pod Go flexible slots are all full", () => {
    const blocks: BlockSpec[] = [
      makeBlock({ type: "wah", position: 0 }),
      makeBlock({ type: "volume", position: 1 }),
      makeBlock({ type: "distortion", position: 2 }),
      makeBlock({ type: "amp", position: 3 }),
      makeBlock({ type: "cab", position: 4 }),
      makeBlock({ type: "eq", position: 5 }),
      makeBlock({ type: "delay", position: 6 }),
      makeBlock({ type: "reverb", position: 7 }),
      makeBlock({ type: "modulation", position: 8 }),
    ];
    const slots = getAvailableSlots(blocks, "pod_go");
    expect(slots).toHaveLength(0);
  });

  it("returns next position for single-DSP device", () => {
    const blocks: BlockSpec[] = [
      makeBlock({ dsp: 0, position: 0 }),
      makeBlock({ dsp: 0, position: 1 }),
    ];
    const slots = getAvailableSlots(blocks, "helix_stomp");
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].dsp).toBe(0);
    expect(slots[0].position).toBe(2); // next after last
  });

  it("returns empty array when device is at maxBlocksTotal", () => {
    const blocks: BlockSpec[] = Array.from({ length: 32 }, (_, i) =>
      makeBlock({ dsp: i < 16 ? 0 : 1, position: i % 16 }),
    );
    const slots = getAvailableSlots(blocks, "helix_floor");
    expect(slots).toHaveLength(0);
  });

  it("returns no slots on a full DSP but slots on empty DSP", () => {
    // Fill DSP 0 to max (8 blocks for Helix), DSP 1 empty
    const blocks: BlockSpec[] = Array.from({ length: 8 }, (_, i) =>
      makeBlock({ dsp: 0, position: i }),
    );
    const slots = getAvailableSlots(blocks, "helix_floor");
    const dsp0Slots = slots.filter((s) => s.dsp === 0);
    const dsp1Slots = slots.filter((s) => s.dsp === 1);
    expect(dsp0Slots).toHaveLength(0);
    expect(dsp1Slots.length).toBeGreaterThan(0);
  });
});
