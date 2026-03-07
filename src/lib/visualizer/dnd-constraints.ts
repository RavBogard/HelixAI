// dnd-constraints.ts — Drag-and-drop constraint validation engine (Phase 79-01).
// Pure-logic layer that validates all DnD operations against real device hardware
// constraints before allowing state mutations.

import type { BlockSpec, DeviceTarget } from "@/lib/helix/types";
import { getCapabilities, resolveFamily } from "@/lib/helix/device-family";
import { POD_GO_FIXED_SLOTS } from "./device-layout";

// ---------------------------------------------------------------------------
// Pod Go fixed block detection
// ---------------------------------------------------------------------------

/** Set of block types that are fixed (non-movable) in Pod Go architecture. */
const POD_GO_FIXED_TYPES = new Set<string>(["amp", "cab", "wah", "volume", "eq"]);

/**
 * Returns true if the given block type occupies a fixed position in Pod Go.
 * Fixed blocks cannot be moved, removed, or reordered.
 */
export function isPodGoFixedBlock(blockType: string): boolean {
  return POD_GO_FIXED_TYPES.has(blockType);
}

// ---------------------------------------------------------------------------
// Move validation
// ---------------------------------------------------------------------------

export interface MoveValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates whether a block can be moved/reordered on the given device.
 * Pod Go fixed blocks (amp, cab, wah, volume, eq) are rejected with descriptive errors.
 * All blocks on non-Pod Go devices are always valid to move.
 */
export function validateMove(
  block: BlockSpec,
  device: DeviceTarget,
): MoveValidation {
  const family = resolveFamily(device);

  if (family === "podgo" && isPodGoFixedBlock(block.type)) {
    return {
      valid: false,
      error: `Cannot move ${block.type}: fixed position in Pod Go architecture`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Cross-DSP transfer validation
// ---------------------------------------------------------------------------

/**
 * Validates whether a block can be transferred from one DSP to another.
 * Rejects on single-DSP devices (no cross-DSP possible).
 * Rejects when target DSP is at maxBlocksPerDsp (excluding the moving block itself).
 */
export function validateDspTransfer(
  block: BlockSpec,
  targetDsp: 0 | 1,
  currentBlocks: BlockSpec[],
  device: DeviceTarget,
): MoveValidation {
  const caps = getCapabilities(device);

  // Single-DSP devices cannot do cross-DSP transfers
  if (caps.dspCount === 1) {
    return {
      valid: false,
      error: "Single-DSP device does not support cross-DSP moves",
    };
  }

  // Count blocks on the target DSP, excluding the block being moved
  const blockId = `${block.type}${block.position}`;
  const targetDspBlockCount = currentBlocks.filter(
    (b) => b.dsp === targetDsp && `${b.type}${b.position}` !== blockId,
  ).length;

  if (targetDspBlockCount >= caps.maxBlocksPerDsp) {
    return {
      valid: false,
      error: `DSP ${targetDsp} is full (${targetDspBlockCount}/${caps.maxBlocksPerDsp} blocks)`,
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Add block validation
// ---------------------------------------------------------------------------

export interface AddValidation {
  canAdd: boolean;
  reason?: string;
}

/** Pod Go flexible slot positions (FX1=2, FX2=6, FX3=7, FX4=8). */
const POD_GO_FLEXIBLE_POSITIONS = new Set(
  POD_GO_FIXED_SLOTS.filter((s) => !s.locked).map((s) => s.slotIndex),
);

/**
 * Validates whether a new block can be added to the chain on the given device.
 * Checks total block limit, and for Pod Go, also checks flexible slot availability.
 */
export function canAddBlock(
  currentBlocks: BlockSpec[],
  device: DeviceTarget,
): AddValidation {
  const caps = getCapabilities(device);
  const family = resolveFamily(device);

  // Check total block limit
  if (currentBlocks.length >= caps.maxBlocksTotal) {
    return {
      canAdd: false,
      reason: `Block limit reached (${currentBlocks.length}/${caps.maxBlocksTotal})`,
    };
  }

  // Pod Go: check flexible slot limit (FX1-FX4 = 4 slots)
  if (family === "podgo") {
    const flexibleBlockCount = currentBlocks.filter((b) =>
      POD_GO_FLEXIBLE_POSITIONS.has(b.position),
    ).length;
    if (flexibleBlockCount >= caps.maxEffectsPerDsp) {
      return {
        canAdd: false,
        reason: `All ${caps.maxEffectsPerDsp} effect slots are in use`,
      };
    }
  }

  return { canAdd: true };
}

// ---------------------------------------------------------------------------
// Available slot calculation
// ---------------------------------------------------------------------------

export interface SlotPosition {
  dsp: 0 | 1;
  position: number;
}

/**
 * Returns an array of available slot positions where a new block can be placed.
 * For dual-DSP: returns next available position per DSP where count < maxBlocksPerDsp.
 * For Pod Go: returns unoccupied flexible slot positions only.
 * For single-DSP: returns next position if under limit.
 */
export function getAvailableSlots(
  currentBlocks: BlockSpec[],
  device: DeviceTarget,
): SlotPosition[] {
  const caps = getCapabilities(device);
  const family = resolveFamily(device);

  // Early exit if at total limit
  if (currentBlocks.length >= caps.maxBlocksTotal) {
    return [];
  }

  // Pod Go: return unoccupied flexible slot positions
  if (family === "podgo") {
    const occupiedPositions = new Set(currentBlocks.map((b) => b.position));
    return Array.from(POD_GO_FLEXIBLE_POSITIONS)
      .filter((pos) => !occupiedPositions.has(pos))
      .map((pos) => ({ dsp: 0 as const, position: pos }));
  }

  const slots: SlotPosition[] = [];

  if (caps.dspCount === 2) {
    // Dual-DSP: check each DSP
    for (const dsp of [0, 1] as const) {
      const dspBlocks = currentBlocks.filter((b) => b.dsp === dsp);
      if (dspBlocks.length < caps.maxBlocksPerDsp) {
        // Next position is one past the highest occupied position, or 0 if empty
        const maxPos =
          dspBlocks.length > 0
            ? Math.max(...dspBlocks.map((b) => b.position))
            : -1;
        slots.push({ dsp, position: maxPos + 1 });
      }
    }
  } else {
    // Single-DSP: one slot at next position
    const dspBlocks = currentBlocks.filter((b) => b.dsp === 0);
    if (dspBlocks.length < caps.maxBlocksPerDsp) {
      const maxPos =
        dspBlocks.length > 0
          ? Math.max(...dspBlocks.map((b) => b.position))
          : -1;
      slots.push({ dsp: 0, position: maxPos + 1 });
    }
  }

  return slots;
}
