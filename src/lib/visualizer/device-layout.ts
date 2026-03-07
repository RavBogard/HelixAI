// device-layout.ts — Device-specific signal chain layout logic for the visualizer.
// Determines whether to render dual-DSP rows, single-DSP row, or Pod Go fixed architecture.

import type { DeviceTarget, BlockSpec } from "@/lib/helix/types";
import { resolveFamily } from "@/lib/helix/device-family";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Layout rendering mode for the signal chain canvas. */
export type DeviceLayoutMode = "dual-dsp" | "single-dsp" | "pod-go-fixed";

/** Configuration for a single Pod Go fixed slot. */
export interface PodGoSlotConfig {
  /** Display label for the slot (e.g., "Wah", "FX1", "Amp") */
  label: string;
  /**
   * Slot category hint for identifying which slot a block belongs to.
   * NOT used for color rendering — always use block.type with getBlockUIConfig().
   */
  blockType: string;
  /** Whether this slot is fixed (non-flexible) in Pod Go architecture */
  locked: boolean;
  /** Position index (0-8) in the fixed chain */
  slotIndex: number;
}

/** Discriminated union for device layout configurations. */
export type DeviceLayout =
  | { mode: "dual-dsp"; dspCount: 2 }
  | { mode: "single-dsp"; dspCount: 1 }
  | { mode: "pod-go-fixed"; dspCount: 1; slots: PodGoSlotConfig[] };

// ---------------------------------------------------------------------------
// Pod Go fixed slot configuration
// ---------------------------------------------------------------------------

/** Pod Go's 9-slot fixed architecture: Wah-Vol-FX1-Amp-Cab-EQ-FX2-FX3-FX4 */
export const POD_GO_FIXED_SLOTS: PodGoSlotConfig[] = [
  { label: "Wah", blockType: "wah", locked: true, slotIndex: 0 },
  { label: "Vol", blockType: "volume", locked: true, slotIndex: 1 },
  { label: "FX1", blockType: "fx", locked: false, slotIndex: 2 },
  { label: "Amp", blockType: "amp", locked: true, slotIndex: 3 },
  { label: "Cab", blockType: "cab", locked: true, slotIndex: 4 },
  { label: "EQ", blockType: "eq", locked: true, slotIndex: 5 },
  { label: "FX2", blockType: "fx", locked: false, slotIndex: 6 },
  { label: "FX3", blockType: "fx", locked: false, slotIndex: 7 },
  { label: "FX4", blockType: "fx", locked: false, slotIndex: 8 },
];

// ---------------------------------------------------------------------------
// Layout resolution
// ---------------------------------------------------------------------------

/**
 * Get the layout configuration for a given device target.
 * Uses resolveFamily() to map device to family, then returns the appropriate layout.
 *
 * Note: Stadium has dspCount=1 in DeviceCapabilities and chain-rules assigns all blocks
 * to dsp=0, so it renders as single-dsp in the visualizer.
 */
export function getDeviceLayout(device: DeviceTarget): DeviceLayout {
  const family = resolveFamily(device);

  switch (family) {
    case "helix":
      return { mode: "dual-dsp", dspCount: 2 };
    case "stadium":
      // Stadium blocks are all dsp=0 (chain-rules getDspForSlot returns 0 for dspCount=1).
      // Render as single-dsp to match actual block assignment.
      return { mode: "single-dsp", dspCount: 1 };
    case "stomp":
      return { mode: "single-dsp", dspCount: 1 };
    case "podgo":
      return { mode: "pod-go-fixed", dspCount: 1, slots: POD_GO_FIXED_SLOTS };
  }
}

// ---------------------------------------------------------------------------
// Pod Go slot matching
// ---------------------------------------------------------------------------

/**
 * Get the Pod Go slot config at a given slot index.
 * Returns null if the index is out of range.
 */
export function getPodGoSlotForBlock(
  _block: BlockSpec,
  slotIndex: number,
): PodGoSlotConfig | null {
  if (slotIndex < 0 || slotIndex >= POD_GO_FIXED_SLOTS.length) {
    return null;
  }
  return POD_GO_FIXED_SLOTS[slotIndex];
}
