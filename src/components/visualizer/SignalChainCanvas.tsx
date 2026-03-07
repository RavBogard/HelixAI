"use client";

import {
  useVisualizerStore,
  generateBlockId,
  getEffectiveBlockState,
  getBlocksByDsp,
} from "@/lib/visualizer/store";
import { getDeviceLayout } from "@/lib/visualizer/device-layout";
import type { BlockSpec } from "@/lib/helix/types";
import type { VisualizerStoreState } from "@/lib/visualizer/store";
import type { DeviceLayout, PodGoSlotConfig } from "@/lib/visualizer/device-layout";
import { BlockTile } from "./BlockTile";

// ---------------------------------------------------------------------------
// Internal: DspRow — renders a labeled row of BlockTiles
// ---------------------------------------------------------------------------

function DspRow({
  label,
  blocks,
  state,
  selectedBlockId,
  onSelect,
}: {
  label: string;
  blocks: BlockSpec[];
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-gray-400 font-mono uppercase">{label}</span>
      <div className="flex gap-2 items-center flex-wrap" data-testid={`dsp-row-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {blocks.map((block) => {
          const blockId = generateBlockId(block);
          const effective = getEffectiveBlockState(state, blockId);
          return (
            <BlockTile
              key={blockId}
              block={block}
              blockId={blockId}
              enabled={effective?.enabled ?? block.enabled}
              isSelected={selectedBlockId === blockId}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: EmptySlot — Pod Go placeholder for unoccupied slot positions
// ---------------------------------------------------------------------------

function EmptySlot({ label }: { label: string }) {
  return (
    <div
      className="w-20 h-16 rounded-lg border border-dashed border-gray-600 flex items-center justify-center"
      data-testid={`empty-slot-${label.toLowerCase()}`}
    >
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: Pod Go slot matching
// ---------------------------------------------------------------------------

function findBlockForSlot(blocks: BlockSpec[], slotIndex: number): BlockSpec | null {
  return blocks.find((b) => b.position === slotIndex) ?? null;
}

// ---------------------------------------------------------------------------
// Internal: Layout renderers
// ---------------------------------------------------------------------------

function DualDspLayout({
  state,
  selectedBlockId,
  onSelect,
}: {
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  const { dsp0, dsp1 } = getBlocksByDsp(state);
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-dual-dsp">
      <DspRow label="DSP 0" blocks={dsp0} state={state} selectedBlockId={selectedBlockId} onSelect={onSelect} />
      <DspRow label="DSP 1" blocks={dsp1} state={state} selectedBlockId={selectedBlockId} onSelect={onSelect} />
    </div>
  );
}

function SingleDspLayout({
  state,
  selectedBlockId,
  onSelect,
}: {
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  const sorted = [...state.baseBlocks].sort((a, b) => a.position - b.position);
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-single-dsp">
      <DspRow label="Signal Chain" blocks={sorted} state={state} selectedBlockId={selectedBlockId} onSelect={onSelect} />
    </div>
  );
}

function PodGoFixedLayout({
  state,
  slots,
  selectedBlockId,
  onSelect,
}: {
  state: VisualizerStoreState;
  slots: PodGoSlotConfig[];
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-pod-go-fixed">
      <span className="text-xs text-gray-400 font-mono uppercase">Pod Go Signal Chain</span>
      <div className="flex gap-2 items-center">
        {slots.map((slot) => {
          const block = findBlockForSlot(state.baseBlocks, slot.slotIndex);
          if (block) {
            const blockId = generateBlockId(block);
            const effective = getEffectiveBlockState(state, blockId);
            return (
              <BlockTile
                key={blockId}
                block={block}
                blockId={blockId}
                enabled={effective?.enabled ?? block.enabled}
                isSelected={selectedBlockId === blockId}
                onSelect={onSelect}
                isLocked={slot.locked}
              />
            );
          }
          return <EmptySlot key={`empty-${slot.slotIndex}`} label={slot.label} />;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SignalChainCanvas renders the signal chain as device-appropriate block arrangements.
 * Reads from the Zustand store and routes to dual-DSP, single-DSP, or Pod Go layout.
 */
export function SignalChainCanvas() {
  const device = useVisualizerStore((s) => s.device);
  const baseBlocks = useVisualizerStore((s) => s.baseBlocks);
  const selectedBlockId = useVisualizerStore((s) => s.selectedBlockId);
  const selectBlock = useVisualizerStore((s) => s.selectBlock);

  // Get full state for computed selectors
  const state = useVisualizerStore.getState();

  // Empty state
  if (baseBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500" data-testid="empty-state">
        No preset loaded — generate a tone from the chat to see your signal chain here.
      </div>
    );
  }

  const layout: DeviceLayout = getDeviceLayout(device);

  switch (layout.mode) {
    case "dual-dsp":
      return <DualDspLayout state={state} selectedBlockId={selectedBlockId} onSelect={selectBlock} />;
    case "single-dsp":
      return <SingleDspLayout state={state} selectedBlockId={selectedBlockId} onSelect={selectBlock} />;
    case "pod-go-fixed":
      return <PodGoFixedLayout state={state} slots={layout.slots} selectedBlockId={selectedBlockId} onSelect={selectBlock} />;
  }
}
