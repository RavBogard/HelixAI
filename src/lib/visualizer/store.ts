// Zustand store for the v7.0 interactive signal chain visualizer.
// Central state management for Phases 77-83: every component reads from
// and writes to this store.

import { create } from "zustand";
import type { BlockSpec, SnapshotSpec, DeviceTarget } from "./types";

// ---------------------------------------------------------------------------
// Block ID generation
// ---------------------------------------------------------------------------

/** Generate a stable block identifier from a BlockSpec. */
export function generateBlockId(block: BlockSpec): string {
  return `${block.type}${block.position}`;
}

// ---------------------------------------------------------------------------
// Store state & actions
// ---------------------------------------------------------------------------

function makeEmptySnapshot(index: number): SnapshotSpec {
  return {
    name: `Snapshot ${index + 1}`,
    description: "",
    ledColor: 0,
    blockStates: {},
    parameterOverrides: {},
  };
}

const INITIAL_SNAPSHOTS: SnapshotSpec[] = [
  makeEmptySnapshot(0),
  makeEmptySnapshot(1),
  makeEmptySnapshot(2),
  makeEmptySnapshot(3),
];

export interface VisualizerStoreState {
  // State fields
  device: DeviceTarget;
  baseBlocks: BlockSpec[];
  snapshots: SnapshotSpec[];
  activeSnapshotIndex: number;
  selectedBlockId: string | null;

  // Mutation actions
  hydrate: (
    device: DeviceTarget,
    baseBlocks: BlockSpec[],
    snapshots: SnapshotSpec[],
  ) => void;
  setActiveSnapshot: (index: number) => void;
  selectBlock: (blockId: string | null) => void;
  setParameterValue: (
    blockId: string,
    paramKey: string,
    value: number | boolean,
  ) => void;
  moveBlock: (
    blockId: string,
    newPosition: { dsp: 0 | 1; position: number; path: number },
  ) => { success: boolean; error?: string };
  swapBlockModel: (blockId: string, newModelId: string) => void;
}

export const useVisualizerStore = create<VisualizerStoreState>((set, get) => ({
  // Default state
  device: "helix_lt" as DeviceTarget,
  baseBlocks: [],
  snapshots: [...INITIAL_SNAPSHOTS],
  activeSnapshotIndex: 0,
  selectedBlockId: null,

  // --- Actions ---

  hydrate(device, baseBlocks, snapshots) {
    set({
      device,
      baseBlocks,
      snapshots,
      activeSnapshotIndex: 0,
      selectedBlockId: null,
    });
  },

  setActiveSnapshot(index) {
    const clamped = Math.max(0, Math.min(3, index));
    set({ activeSnapshotIndex: clamped });
  },

  selectBlock(blockId) {
    set({ selectedBlockId: blockId });
  },

  setParameterValue(blockId, paramKey, value) {
    const state = get();
    const idx = state.activeSnapshotIndex;
    const snapshots = [...state.snapshots];
    const snapshot = { ...snapshots[idx] };

    // Ensure the nested override structure exists
    const overrides = { ...snapshot.parameterOverrides };
    const blockOverrides = { ...(overrides[blockId] ?? {}) };
    blockOverrides[paramKey] = value;
    overrides[blockId] = blockOverrides;
    snapshot.parameterOverrides = overrides;
    snapshots[idx] = snapshot;

    set({ snapshots });
  },

  moveBlock(blockId, newPosition) {
    const state = get();
    const blockIndex = state.baseBlocks.findIndex(
      (b) => generateBlockId(b) === blockId,
    );

    if (blockIndex === -1) {
      return { success: false, error: `Block ${blockId} not found` };
    }

    const updatedBlocks = [...state.baseBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      dsp: newPosition.dsp,
      position: newPosition.position,
      path: newPosition.path,
    };

    set({ baseBlocks: updatedBlocks });
    return { success: true };
  },

  swapBlockModel(blockId, newModelId) {
    const state = get();
    const blockIndex = state.baseBlocks.findIndex(
      (b) => generateBlockId(b) === blockId,
    );

    if (blockIndex === -1) return;

    const updatedBlocks = [...state.baseBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      modelId: newModelId,
      modelName: newModelId, // Downstream phases resolve display name
      parameters: {},
    };

    set({ baseBlocks: updatedBlocks });
  },
}));

// ---------------------------------------------------------------------------
// Computed selectors (standalone — Zustand pattern)
// ---------------------------------------------------------------------------

/**
 * Returns the effective state for a block: base parameters merged with the
 * active snapshot's overrides. Snapshot values always win.
 */
export function getEffectiveBlockState(
  state: VisualizerStoreState,
  blockId: string,
): (BlockSpec & { enabled: boolean }) | null {
  const block = state.baseBlocks.find(
    (b) => generateBlockId(b) === blockId,
  );
  if (!block) return null;

  const snapshot = state.snapshots[state.activeSnapshotIndex];
  const overrides = snapshot?.parameterOverrides?.[blockId] ?? {};
  const bypassed = snapshot?.blockStates?.[blockId] ?? block.enabled;

  return {
    ...block,
    parameters: { ...block.parameters, ...overrides },
    enabled: bypassed,
  };
}

/**
 * Returns blocks grouped by DSP index, sorted by position within each group.
 */
export function getBlocksByDsp(state: VisualizerStoreState): {
  dsp0: BlockSpec[];
  dsp1: BlockSpec[];
} {
  const dsp0 = state.baseBlocks
    .filter((b) => b.dsp === 0)
    .sort((a, b) => a.position - b.position);
  const dsp1 = state.baseBlocks
    .filter((b) => b.dsp === 1)
    .sort((a, b) => a.position - b.position);
  return { dsp0, dsp1 };
}
