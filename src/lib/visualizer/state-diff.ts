// State diff engine — Phase 83, Plan 01
// Pure function: compares original vs current visualizer state and returns
// a structured diff describing what changed. Used by the frontend to gate
// the download API call: hasChanges=false means no API call needed.

import type { BlockSpec, SnapshotSpec } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StateDiff {
  hasChanges: boolean;
  chainChanges: ChainChange[];
  modelSwaps: ModelSwap[];
  snapshotChanges: SnapshotChange[];
}

export type ChainChange =
  | {
      type: "moved";
      blockId: string;
      from: { dsp: number; position: number; path: number };
      to: { dsp: number; position: number; path: number };
    }
  | { type: "added"; block: BlockSpec }
  | { type: "removed"; blockId: string };

export interface ModelSwap {
  blockId: string;
  fromModelId: string;
  toModelId: string;
}

export interface SnapshotChange {
  index: number;
  blockStates: Record<string, boolean>;
  parameterOverrides: Record<string, Record<string, number | boolean>>;
}

// ---------------------------------------------------------------------------
// Block identity
// ---------------------------------------------------------------------------

function blockId(block: BlockSpec): string {
  return `${block.type}${block.position}`;
}

// ---------------------------------------------------------------------------
// Block matching key — type+modelId uniquely identifies "the same block"
// ---------------------------------------------------------------------------

function matchKey(block: BlockSpec): string {
  return `${block.type}::${block.modelId}`;
}

// ---------------------------------------------------------------------------
// calculateStateDiff
// ---------------------------------------------------------------------------

/**
 * Compare original and current visualizer state. Returns a structured diff.
 *
 * Block matching strategy:
 * 1. Match blocks by type+modelId (identity of the block).
 *    When multiple blocks share the same type+modelId, match by occurrence
 *    order (first original occurrence pairs with first current occurrence).
 * 2. Matched pair with same position/dsp/path => no change.
 * 3. Matched pair with different position/dsp/path => "moved".
 * 4. Matched pair with different modelId at same blockId => "model swap"
 *    (detected separately via blockId matching for same-type same-position).
 * 5. Unmatched originals => "removed".
 * 6. Unmatched current => "added".
 */
export function calculateStateDiff(
  originalBlocks: BlockSpec[],
  originalSnapshots: SnapshotSpec[],
  currentBlocks: BlockSpec[],
  currentSnapshots: SnapshotSpec[],
): StateDiff {
  const chainChanges: ChainChange[] = [];
  const modelSwaps: ModelSwap[] = [];
  const snapshotChanges: SnapshotChange[] = [];

  // -------------------------------------------------------------------------
  // Chain comparison — two-pass matching
  // -------------------------------------------------------------------------

  // Pass 1: Match by blockId (type+position) for model swap detection.
  // A model swap is when the same blockId exists in both original and current
  // but the modelId changed.
  const origByBlockId = new Map<string, BlockSpec>();
  for (const block of originalBlocks) {
    origByBlockId.set(blockId(block), block);
  }
  const currByBlockId = new Map<string, BlockSpec>();
  for (const block of currentBlocks) {
    currByBlockId.set(blockId(block), block);
  }

  for (const [bId, origBlock] of origByBlockId) {
    const currBlock = currByBlockId.get(bId);
    if (currBlock && origBlock.modelId !== currBlock.modelId) {
      modelSwaps.push({
        blockId: bId,
        fromModelId: origBlock.modelId,
        toModelId: currBlock.modelId,
      });
    }
  }

  // Pass 2: Match by type+modelId for position/add/remove detection.
  // Group original and current blocks by matchKey, then pair by occurrence.
  const origGroups = new Map<string, BlockSpec[]>();
  for (const block of originalBlocks) {
    const key = matchKey(block);
    const group = origGroups.get(key) ?? [];
    group.push(block);
    origGroups.set(key, group);
  }

  const currGroups = new Map<string, BlockSpec[]>();
  for (const block of currentBlocks) {
    const key = matchKey(block);
    const group = currGroups.get(key) ?? [];
    group.push(block);
    currGroups.set(key, group);
  }

  const allKeys = new Set([...origGroups.keys(), ...currGroups.keys()]);

  for (const key of allKeys) {
    const origList = origGroups.get(key) ?? [];
    const currList = currGroups.get(key) ?? [];
    const paired = Math.min(origList.length, currList.length);

    // Paired blocks — check for position changes
    for (let i = 0; i < paired; i++) {
      const orig = origList[i];
      const curr = currList[i];
      if (
        orig.dsp !== curr.dsp ||
        orig.position !== curr.position ||
        orig.path !== curr.path
      ) {
        chainChanges.push({
          type: "moved",
          blockId: blockId(orig),
          from: { dsp: orig.dsp, position: orig.position, path: orig.path },
          to: { dsp: curr.dsp, position: curr.position, path: curr.path },
        });
      }
    }

    // Unmatched originals => removed
    for (let i = paired; i < origList.length; i++) {
      chainChanges.push({ type: "removed", blockId: blockId(origList[i]) });
    }

    // Unmatched current => added
    for (let i = paired; i < currList.length; i++) {
      chainChanges.push({ type: "added", block: currList[i] });
    }
  }

  // -------------------------------------------------------------------------
  // Snapshot comparison
  // -------------------------------------------------------------------------

  const snapshotCount = Math.max(
    originalSnapshots.length,
    currentSnapshots.length,
  );

  for (let i = 0; i < snapshotCount; i++) {
    const origSnap = i < originalSnapshots.length ? originalSnapshots[i] : undefined;
    const currSnap = i < currentSnapshots.length ? currentSnapshots[i] : undefined;

    // Detect added or removed snapshots as changes
    if (!origSnap && currSnap) {
      snapshotChanges.push({ index: i, blockStates: { ...currSnap.blockStates }, parameterOverrides: { ...currSnap.parameterOverrides } });
      continue;
    }
    if (origSnap && !currSnap) {
      snapshotChanges.push({ index: i, blockStates: {}, parameterOverrides: {} });
      continue;
    }
    if (!origSnap || !currSnap) continue;

    const changedBlockStates: Record<string, boolean> = {};
    const changedOverrides: Record<string, Record<string, number | boolean>> = {};

    // Compare blockStates
    const allBlockStateKeys = new Set([
      ...Object.keys(origSnap.blockStates),
      ...Object.keys(currSnap.blockStates),
    ]);
    for (const key of allBlockStateKeys) {
      const origVal = origSnap.blockStates[key];
      const currVal = currSnap.blockStates[key];
      if (origVal !== currVal && currVal !== undefined) {
        changedBlockStates[key] = currVal;
      }
    }

    // Compare parameterOverrides
    const allOverrideBlockKeys = new Set([
      ...Object.keys(origSnap.parameterOverrides),
      ...Object.keys(currSnap.parameterOverrides),
    ]);
    for (const blockKey of allOverrideBlockKeys) {
      const origParams = origSnap.parameterOverrides[blockKey] ?? {};
      const currParams = currSnap.parameterOverrides[blockKey] ?? {};
      const allParamKeys = new Set([
        ...Object.keys(origParams),
        ...Object.keys(currParams),
      ]);

      const changedParams: Record<string, number | boolean> = {};
      for (const paramKey of allParamKeys) {
        if (origParams[paramKey] !== currParams[paramKey] && currParams[paramKey] !== undefined) {
          changedParams[paramKey] = currParams[paramKey];
        }
      }

      if (Object.keys(changedParams).length > 0) {
        changedOverrides[blockKey] = changedParams;
      }
    }

    // Only add a SnapshotChange if something actually changed
    if (
      Object.keys(changedBlockStates).length > 0 ||
      Object.keys(changedOverrides).length > 0
    ) {
      snapshotChanges.push({
        index: i,
        blockStates: changedBlockStates,
        parameterOverrides: changedOverrides,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Aggregate
  // -------------------------------------------------------------------------

  const hasChanges =
    chainChanges.length > 0 ||
    modelSwaps.length > 0 ||
    snapshotChanges.length > 0;

  return { hasChanges, chainChanges, modelSwaps, snapshotChanges };
}
