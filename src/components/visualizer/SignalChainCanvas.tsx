"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  useVisualizerStore,
  generateBlockId,
  getEffectiveBlockState,
  getBlocksByDsp,
} from "@/lib/visualizer/store";
import { getDeviceLayout } from "@/lib/visualizer/device-layout";
import {
  validateMove,
  validateDspTransfer,
  canAddBlock,
  getAvailableSlots,
} from "@/lib/visualizer/dnd-constraints";
import type { BlockSpec } from "@/lib/helix/types";
import type { VisualizerStoreState } from "@/lib/visualizer/store";
import type { DeviceLayout, PodGoSlotConfig } from "@/lib/visualizer/device-layout";
import { BlockTile } from "./BlockTile";

// ---------------------------------------------------------------------------
// SortableBlockTile — wraps BlockTile with @dnd-kit useSortable
// ---------------------------------------------------------------------------

function SortableBlockTile({
  blockId,
  ...tileProps
}: {
  blockId: string;
} & Omit<React.ComponentProps<typeof BlockTile>, "blockId" | "isDragging">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <BlockTile {...tileProps} blockId={blockId} isDragging={isDragging} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: DspRow — renders a labeled row of sortable BlockTiles
// ---------------------------------------------------------------------------

function DspRow({
  label,
  blocks,
  state,
  selectedBlockId,
  onSelect,
  onRemove,
  showAddButton,
  onAddClick,
}: {
  label: string;
  blocks: BlockSpec[];
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  showAddButton?: boolean;
  onAddClick?: () => void;
}) {
  const blockIds = blocks.map((b) => generateBlockId(b));

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-gray-400 font-mono uppercase">{label}</span>
      <div
        className="flex gap-2 items-center flex-wrap"
        data-testid={`dsp-row-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        <SortableContext items={blockIds} strategy={horizontalListSortingStrategy}>
          {blocks.map((block) => {
            const blockId = generateBlockId(block);
            const effective = getEffectiveBlockState(state, blockId);
            return (
              <SortableBlockTile
                key={blockId}
                blockId={blockId}
                block={block}
                enabled={effective?.enabled ?? block.enabled}
                isSelected={selectedBlockId === blockId}
                onSelect={onSelect}
                onRemove={onRemove}
              />
            );
          })}
        </SortableContext>
        {showAddButton && (
          <button
            type="button"
            className="w-10 h-16 rounded-lg border border-dashed border-gray-600 flex items-center justify-center text-gray-500 hover:border-gray-400 hover:text-gray-300 transition-colors"
            data-testid="add-block-btn"
            onClick={onAddClick}
            aria-label="Add block"
          >
            <span className="text-xl">+</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal: EmptySlot — Pod Go placeholder for unoccupied slot positions
// ---------------------------------------------------------------------------

function EmptySlot({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={[
        "w-20 h-16 rounded-lg border border-dashed border-gray-600 flex items-center justify-center",
        onClick ? "cursor-pointer hover:border-gray-400 hover:text-gray-300" : "",
      ].filter(Boolean).join(" ")}
      data-testid={`empty-slot-${label.toLowerCase()}`}
      onClick={onClick}
    >
      <span className="text-xs text-gray-500">{onClick ? `+ ${label}` : label}</span>
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
  onRemove,
  showAddButton,
  onAddClick,
}: {
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  showAddButton: boolean;
  onAddClick: (dsp: 0 | 1) => void;
}) {
  const { dsp0, dsp1 } = getBlocksByDsp(state);
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-dual-dsp">
      <DspRow
        label="DSP 0"
        blocks={dsp0}
        state={state}
        selectedBlockId={selectedBlockId}
        onSelect={onSelect}
        onRemove={onRemove}
        showAddButton={showAddButton}
        onAddClick={() => onAddClick(0)}
      />
      <DspRow
        label="DSP 1"
        blocks={dsp1}
        state={state}
        selectedBlockId={selectedBlockId}
        onSelect={onSelect}
        onRemove={onRemove}
        showAddButton={showAddButton}
        onAddClick={() => onAddClick(1)}
      />
    </div>
  );
}

function SingleDspLayout({
  state,
  selectedBlockId,
  onSelect,
  onRemove,
  showAddButton,
  onAddClick,
}: {
  state: VisualizerStoreState;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  showAddButton: boolean;
  onAddClick: () => void;
}) {
  const sorted = [...state.baseBlocks].sort((a, b) => a.position - b.position);
  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-single-dsp">
      <DspRow
        label="Signal Chain"
        blocks={sorted}
        state={state}
        selectedBlockId={selectedBlockId}
        onSelect={onSelect}
        onRemove={onRemove}
        showAddButton={showAddButton}
        onAddClick={onAddClick}
      />
    </div>
  );
}

function PodGoFixedLayout({
  state,
  slots,
  selectedBlockId,
  onSelect,
  onRemove,
  onEmptySlotClick,
}: {
  state: VisualizerStoreState;
  slots: PodGoSlotConfig[];
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
  onRemove: (blockId: string) => void;
  onEmptySlotClick?: (slotIndex: number) => void;
}) {
  // Flexible (non-locked) block IDs for sortable context
  const flexibleBlockIds = slots
    .filter((s) => !s.locked)
    .map((s) => findBlockForSlot(state.baseBlocks, s.slotIndex))
    .filter(Boolean)
    .map((b) => generateBlockId(b!));

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="layout-pod-go-fixed">
      <span className="text-xs text-gray-400 font-mono uppercase">Pod Go Signal Chain</span>
      <div className="flex gap-2 items-center">
        <SortableContext items={flexibleBlockIds} strategy={horizontalListSortingStrategy}>
          {slots.map((slot) => {
            const block = findBlockForSlot(state.baseBlocks, slot.slotIndex);
            if (block) {
              const blockId = generateBlockId(block);
              const effective = getEffectiveBlockState(state, blockId);
              if (slot.locked) {
                // Fixed blocks: not sortable, not removable
                return (
                  <BlockTile
                    key={blockId}
                    block={block}
                    blockId={blockId}
                    enabled={effective?.enabled ?? block.enabled}
                    isSelected={selectedBlockId === blockId}
                    onSelect={onSelect}
                    isLocked={true}
                  />
                );
              }
              // Flexible blocks: sortable and removable
              return (
                <SortableBlockTile
                  key={blockId}
                  blockId={blockId}
                  block={block}
                  enabled={effective?.enabled ?? block.enabled}
                  isSelected={selectedBlockId === blockId}
                  onSelect={onSelect}
                  onRemove={onRemove}
                />
              );
            }
            // Empty slot — only clickable for flexible slots
            return (
              <EmptySlot
                key={`empty-${slot.slotIndex}`}
                label={slot.label}
                onClick={!slot.locked && onEmptySlotClick ? () => onEmptySlotClick(slot.slotIndex) : undefined}
              />
            );
          })}
        </SortableContext>
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
 * Phase 79: Wraps layouts in @dnd-kit DndContext for drag-and-drop reordering.
 */
export function SignalChainCanvas() {
  const device = useVisualizerStore((s) => s.device);
  const baseBlocks = useVisualizerStore((s) => s.baseBlocks);
  const selectedBlockId = useVisualizerStore((s) => s.selectedBlockId);
  const selectBlock = useVisualizerStore((s) => s.selectBlock);
  const reorderBlock = useVisualizerStore((s) => s.reorderBlock);
  const moveBlock = useVisualizerStore((s) => s.moveBlock);
  const removeBlock = useVisualizerStore((s) => s.removeBlock);

  // Error message state — shown for 3 seconds on constraint violations
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Adding block state — tracks which DSP/position the model browser targets
  const [addingAtSlot, setAddingAtSlot] = useState<{ dsp: 0 | 1; position: number } | null>(null);

  // Clear error message after 3 seconds
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // DnD sensors — use pointer sensor with a small activation distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Get full state for computed selectors
  const state = useVisualizerStore.getState();

  // --- DnD event handlers ---

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const blockId = event.active.id as string;
      const block = state.baseBlocks.find((b) => generateBlockId(b) === blockId);
      if (!block) return;

      const moveCheck = validateMove(block, state.device);
      if (!moveCheck.valid) {
        setErrorMessage(moveCheck.error ?? "Cannot move this block");
        // Cancel drag by not doing anything — @dnd-kit will handle it
      }
    },
    [state.baseBlocks, state.device],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeBlockId = active.id as string;
      const overBlockId = over.id as string;

      const activeBlock = state.baseBlocks.find(
        (b) => generateBlockId(b) === activeBlockId,
      );
      const overBlock = state.baseBlocks.find(
        (b) => generateBlockId(b) === overBlockId,
      );

      if (!activeBlock || !overBlock) return;

      // Validate move
      const moveCheck = validateMove(activeBlock, state.device);
      if (!moveCheck.valid) {
        setErrorMessage(moveCheck.error ?? "Cannot move this block");
        return;
      }

      if (activeBlock.dsp === overBlock.dsp) {
        // Same-DSP reorder
        const result = reorderBlock(activeBlockId, overBlock.position);
        if (!result.success) {
          setErrorMessage(result.error ?? "Failed to reorder block");
        }
      } else {
        // Cross-DSP transfer
        const transferCheck = validateDspTransfer(
          activeBlock,
          overBlock.dsp as 0 | 1,
          state.baseBlocks,
          state.device,
        );
        if (!transferCheck.valid) {
          setErrorMessage(transferCheck.error ?? "Cannot move to target DSP");
          return;
        }

        const result = moveBlock(activeBlockId, {
          dsp: overBlock.dsp as 0 | 1,
          position: overBlock.position,
          path: 0,
        });
        if (!result.success) {
          setErrorMessage(result.error ?? "Failed to move block");
        }
      }
    },
    [state.baseBlocks, state.device, reorderBlock, moveBlock],
  );

  // --- Remove handler ---
  const handleRemove = useCallback(
    (blockId: string) => {
      const result = removeBlock(blockId);
      if (!result.success) {
        setErrorMessage(result.error ?? "Failed to remove block");
      }
    },
    [removeBlock],
  );

  // --- Add block handlers ---
  const addCheck = canAddBlock(baseBlocks, device);
  const availableSlots = getAvailableSlots(baseBlocks, device);

  const handleAddClick = useCallback(
    (dsp: 0 | 1) => {
      const slot = availableSlots.find((s) => s.dsp === dsp);
      if (slot) {
        setAddingAtSlot(slot);
      }
    },
    [availableSlots],
  );

  const handleEmptySlotClick = useCallback(
    (slotIndex: number) => {
      setAddingAtSlot({ dsp: 0, position: slotIndex });
    },
    [],
  );

  // Empty state
  if (baseBlocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500" data-testid="empty-state">
        No preset loaded — generate a tone from the chat to see your signal chain here.
      </div>
    );
  }

  const layout: DeviceLayout = getDeviceLayout(device);

  const renderLayout = () => {
    switch (layout.mode) {
      case "dual-dsp":
        return (
          <DualDspLayout
            state={state}
            selectedBlockId={selectedBlockId}
            onSelect={selectBlock}
            onRemove={handleRemove}
            showAddButton={addCheck.canAdd}
            onAddClick={handleAddClick}
          />
        );
      case "single-dsp":
        return (
          <SingleDspLayout
            state={state}
            selectedBlockId={selectedBlockId}
            onSelect={selectBlock}
            onRemove={handleRemove}
            showAddButton={addCheck.canAdd}
            onAddClick={() => handleAddClick(0)}
          />
        );
      case "pod-go-fixed":
        return (
          <PodGoFixedLayout
            state={state}
            slots={layout.slots}
            selectedBlockId={selectedBlockId}
            onSelect={selectBlock}
            onRemove={handleRemove}
            onEmptySlotClick={addCheck.canAdd ? handleEmptySlotClick : undefined}
          />
        );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {renderLayout()}
      {/* Error message area — always present in DOM for testability */}
      <div
        data-testid="dnd-error-area"
        className={[
          "px-3 py-1.5 rounded text-sm transition-opacity",
          errorMessage
            ? "bg-red-900/80 text-red-200 opacity-100"
            : "opacity-0 h-0 overflow-hidden",
        ].join(" ")}
        role="alert"
      >
        {errorMessage ?? ""}
      </div>
    </DndContext>
  );
}
