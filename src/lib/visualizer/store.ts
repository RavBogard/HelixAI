// Zustand store for the v7.0 interactive signal chain visualizer.
// Central state management for Phases 77-83: every component reads from
// and writes to this store.

import { create } from "zustand";
import type { BlockSpec, SnapshotSpec, DeviceTarget } from "./types";
import type { ControllerAssignment, FootswitchAssignment } from "./controller-assignments";
import { validateMove, canAddBlock } from "./dnd-constraints";
import { lookupModelByModelId } from "./parameter-schema";

// ---------------------------------------------------------------------------
// Block ID generation
// ---------------------------------------------------------------------------

/** Generate a stable block identifier utilizing a stable ID if present, or fallback. */
export function generateBlockId(block: BlockSpec & { _id?: string }): string {
  // We attach a hidden _id during hydration for dnd-kit stability
  return block._id ?? `${block.type}_${block.modelId}_${block.path}_${block.position}`;
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
  controllerAssignments: ControllerAssignment[];
  footswitchAssignments: FootswitchAssignment[];

  // Preset metadata (set during hydration, used by download flow)
  presetName: string;
  description: string;
  tempo: number;

  // Diff baseline — original state captured at hydration time, never mutated.
  // Used by DownloadButton to detect whether changes have been made.
  originalBaseBlocks: BlockSpec[];
  originalSnapshots: SnapshotSpec[];

  // Mutation actions
  hydrate: (
    device: DeviceTarget,
    baseBlocks: BlockSpec[],
    snapshots: SnapshotSpec[],
    controllerAssignments?: ControllerAssignment[],
    footswitchAssignments?: FootswitchAssignment[],
    presetName?: string,
    description?: string,
    tempo?: number,
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
  toggleBlockBypass: (blockId: string) => void;
  swapBlockModel: (blockId: string, newModelId: string) => void;
  addBlock: (
    blockSpec: Partial<BlockSpec> & {
      type: BlockSpec["type"];
      modelId: string;
      modelName: string;
    },
    targetDsp: 0 | 1,
    targetPosition: number,
  ) => { success: boolean; error?: string };
  removeBlock: (blockId: string) => { success: boolean; error?: string };
  reorderBlock: (
    blockId: string,
    newPosition: number,
  ) => { success: boolean; error?: string };
}

export const useVisualizerStore = create<VisualizerStoreState>((set, get) => ({
  // Default state
  device: "helix_lt" as DeviceTarget,
  baseBlocks: [],
  snapshots: [...INITIAL_SNAPSHOTS],
  activeSnapshotIndex: 0,
  selectedBlockId: null,
  controllerAssignments: [],
  footswitchAssignments: [],
  presetName: "",
  description: "",
  tempo: 120,
  originalBaseBlocks: [],
  originalSnapshots: [],

  // --- Actions ---

  hydrate(device, baseBlocks, snapshots, controllerAssignments, footswitchAssignments, presetName, description, tempo) {
    // Deep-clone baseline state so mutations to baseBlocks/snapshots don't
    // affect the diff comparison. Attach stable _id for dnd-kit.
    const safeBlocks = JSON.parse(JSON.stringify(baseBlocks)).map(
      (b: BlockSpec & { _id?: string }) => ({
        ...b,
        _id: b._id || Math.random().toString(36).substring(2, 9),
      })
    );

    set({
      device,
      baseBlocks: safeBlocks,
      snapshots,
      activeSnapshotIndex: 0,
      selectedBlockId: null,
      controllerAssignments: controllerAssignments ?? [],
      footswitchAssignments: footswitchAssignments ?? [],
      presetName: presetName ?? "",
      description: description ?? "",
      tempo: tempo ?? 120,
      originalBaseBlocks: safeBlocks,
      originalSnapshots: JSON.parse(JSON.stringify(snapshots)),
    });
  },

  setActiveSnapshot(index) {
    const state = get();
    const clamped = Math.max(0, Math.min(state.snapshots.length - 1, index));
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

  toggleBlockBypass(blockId) {
    const state = get();
    const idx = state.activeSnapshotIndex;
    const snapshots = [...state.snapshots];
    const snapshot = { ...snapshots[idx] };
    const blockStates = { ...snapshot.blockStates };

    // Determine current effective state: snapshot override or base block
    const baseBlock = state.baseBlocks.find(
      (b) => generateBlockId(b) === blockId,
    );
    const currentEnabled = blockStates[blockId] ?? baseBlock?.enabled ?? true;
    blockStates[blockId] = !currentEnabled;

    snapshot.blockStates = blockStates;
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

    // Resolve the new model's defaults from the Knowledge Layer
    const resolved = lookupModelByModelId(newModelId);
    const updatedBlocks = [...state.baseBlocks];
    updatedBlocks[blockIndex] = {
      ...updatedBlocks[blockIndex],
      modelId: newModelId,
      modelName: resolved?.name ?? newModelId,
      parameters: resolved?.defaultParams ?? {},
    };

    set({ baseBlocks: updatedBlocks });
  },

  addBlock(blockSpec, targetDsp, targetPosition) {
    const state = get();

    // Validate via constraint engine
    const addCheck = canAddBlock(state.baseBlocks, state.device);
    if (!addCheck.canAdd) {
      return { success: false, error: addCheck.reason };
    }

    // Construct full BlockSpec with defaults
    const newBlock: BlockSpec = {
      type: blockSpec.type,
      modelId: blockSpec.modelId,
      modelName: blockSpec.modelName,
      dsp: targetDsp,
      position: targetPosition,
      path: blockSpec.path ?? 0,
      enabled: blockSpec.enabled ?? true,
      stereo: blockSpec.stereo ?? false,
      parameters: blockSpec.parameters ?? {},
    };

    // Shift blocks at or after targetPosition on the same DSP
    const updatedBlocks = Object.assign([], state.baseBlocks).map((b: BlockSpec) => {
      if (b.dsp === targetDsp && b.position >= targetPosition) {
        return { ...b, position: b.position + 1 };
      }
      return b;
    });

    const newBlockWithId = {
      ...newBlock,
      _id: Math.random().toString(36).substring(2, 9),
    };
    updatedBlocks.push(newBlockWithId);
    set({ baseBlocks: updatedBlocks });
    return { success: true };
  },

  removeBlock(blockId) {
    const state = get();
    const blockIndex = state.baseBlocks.findIndex(
      (b) => generateBlockId(b) === blockId,
    );

    if (blockIndex === -1) {
      return { success: false, error: `Block ${blockId} not found` };
    }

    const removedBlock = state.baseBlocks[blockIndex];
    const remaining = state.baseBlocks.filter((_, i) => i !== blockIndex);

    // Renumber positions sequentially on the removed block's DSP
    const dspBlocks = remaining
      .filter((b) => b.dsp === removedBlock.dsp)
      .sort((a, b) => a.position - b.position);

    const renumbered = remaining.map((b) => {
      if (b.dsp === removedBlock.dsp) {
        const sortedIdx = dspBlocks.indexOf(b);
        return { ...b, position: sortedIdx };
      }
      return b;
    });

    // Clear selectedBlockId if the removed block was selected
    const newSelectedBlockId =
      state.selectedBlockId === blockId ? null : state.selectedBlockId;

    set({ baseBlocks: renumbered, selectedBlockId: newSelectedBlockId });
    return { success: true };
  },

  reorderBlock(blockId, newPosition) {
    const state = get();
    const blockIndex = state.baseBlocks.findIndex(
      (b) => generateBlockId(b) === blockId,
    );

    if (blockIndex === -1) {
      return { success: false, error: `Block ${blockId} not found` };
    }

    const block = state.baseBlocks[blockIndex];

    // Validate move (Pod Go fixed blocks cannot be reordered)
    const moveCheck = validateMove(block, state.device);
    if (!moveCheck.valid) {
      return { success: false, error: moveCheck.error };
    }

    // Get all blocks on the same DSP, sorted by position
    const dspBlocks = state.baseBlocks
      .filter((b) => b.dsp === block.dsp)
      .sort((a, b) => a.position - b.position);

    // Remove the block from its current position in the sorted array
    const withoutBlock = dspBlocks.filter(
      (b) => generateBlockId(b) !== blockId,
    );

    // Clamp newPosition to valid range
    const clampedPos = Math.max(0, Math.min(withoutBlock.length, newPosition));

    // Insert at new position
    withoutBlock.splice(clampedPos, 0, block);

    // Renumber all positions sequentially
    const renumberedDsp = withoutBlock.map((b, i) => ({ ...b, position: i }));

    // Reconstruct the full baseBlocks array preserving non-DSP blocks
    const otherDspBlocks = state.baseBlocks.filter(
      (b) => b.dsp !== block.dsp,
    );
    
    // Final state must maintain the original order except for the reordered DSP subset
    set({ baseBlocks: [...otherDspBlocks, ...renumberedDsp] });
    return { success: true };
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
  const enabledState = snapshot?.blockStates?.[blockId] ?? block.enabled;

  return {
    ...block,
    parameters: { ...block.parameters, ...overrides },
    enabled: enabledState,
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
