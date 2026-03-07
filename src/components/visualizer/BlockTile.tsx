"use client";

import { getBlockUIConfig } from "@/lib/visualizer/block-ui-registry";
import type { BlockSpec } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BlockTileProps {
  /** The block data to render */
  block: BlockSpec;
  /** Stable block identifier (from generateBlockId) */
  blockId: string;
  /** Snapshot-aware enabled state (from getEffectiveBlockState) */
  enabled: boolean;
  /** Whether this block is the currently selected block */
  isSelected: boolean;
  /** Callback when the tile is clicked */
  onSelect: (blockId: string) => void;
  /** Pod Go fixed blocks — visual lock indicator */
  isLocked?: boolean;
  /** Callback for the X remove button — hidden when not provided or when isLocked */
  onRemove?: (blockId: string) => void;
  /** Visual state when being dragged (from @dnd-kit useSortable) */
  isDragging?: boolean;
}

// ---------------------------------------------------------------------------
// Width classes by mode
// ---------------------------------------------------------------------------

const WIDTH_CLASSES: Record<string, string> = {
  wide: "w-28",
  standard: "w-20",
  narrow: "w-16",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * BlockTile renders a single block in the signal chain canvas.
 * Color-coded by block category, with bypass dimming and selection highlight.
 */
export function BlockTile({
  block,
  blockId,
  enabled,
  isSelected,
  onSelect,
  isLocked,
  onRemove,
  isDragging,
}: BlockTileProps) {
  const config = getBlockUIConfig(block.type);
  const widthClass = WIDTH_CLASSES[config.widthMode] ?? WIDTH_CLASSES.standard;

  return (
    <button
      type="button"
      className={[
        widthClass,
        "h-16 rounded-lg relative flex flex-col items-center justify-center gap-0.5 px-1 group",
        enabled && !isDragging ? "" : "",
        !enabled ? "opacity-40" : "",
        isDragging ? "opacity-50 scale-105" : "",
        isSelected ? "ring-2 ring-white" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ backgroundColor: config.colorHex }}
      onClick={() => onSelect(blockId)}
      aria-label={`${block.modelName} (${block.type})`}
      data-testid={`block-tile-${blockId}`}
    >
      <span className="text-[10px] text-white/70 font-mono uppercase">
        {config.iconName}
      </span>
      <span className="text-xs text-white font-medium truncate w-full text-center">
        {block.modelName}
      </span>
      {isLocked && (
        <span className="absolute top-0.5 right-0.5 text-[8px] text-white/50">
          🔒
        </span>
      )}
      {onRemove && !isLocked && (
        <span
          role="button"
          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-opacity cursor-pointer"
          data-testid={`remove-btn-${blockId}`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(blockId);
          }}
        >
          x
        </span>
      )}
    </button>
  );
}
