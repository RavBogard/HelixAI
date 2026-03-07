// Visualizer state types for the v7.0 interactive signal chain editor.
// Re-exports core types from helix — no duplication.

import type { BlockSpec, SnapshotSpec, DeviceTarget } from "@/lib/helix/types";

export type { BlockSpec, SnapshotSpec, DeviceTarget };

/** Position descriptor for a block within the signal chain. */
export type BlockPosition = {
  dsp: 0 | 1;
  position: number;
  path: 0 | 1;
};

/**
 * Stable identifier for a block within the visualizer.
 * Generated from chain position: `${type}${position}` e.g. "amp0", "delay2".
 * Used by the UI for selection, parameter editing, and drag-and-drop.
 */
export type BlockId = string;
