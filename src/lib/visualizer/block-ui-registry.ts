// block-ui-registry.ts — Visual metadata for each block type in the signal chain canvas.
// Maps all 14 block types (12 BlockSpec.type values + "empty" + "looper")
// to color, icon, and width information for rendering BlockTile components.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Visual configuration for a single block type. */
export interface BlockUIConfig {
  /** Hex color code for the block tile background */
  colorHex: string;
  /** Icon identifier (used as text label until SVG icons are added) */
  iconName: string;
  /** Width mode controlling CSS width of the tile */
  widthMode: "standard" | "wide" | "narrow";
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Maps all 14 block types to their visual metadata.
 * Colors are chosen for high contrast on dark backgrounds.
 */
export const BLOCK_UI_REGISTRY: Record<string, BlockUIConfig> = {
  amp: { colorHex: "#F59E0B", iconName: "amp", widthMode: "wide" },
  cab: { colorHex: "#D97706", iconName: "cab", widthMode: "wide" },
  distortion: { colorHex: "#EF4444", iconName: "distortion", widthMode: "standard" },
  delay: { colorHex: "#10B981", iconName: "delay", widthMode: "standard" },
  reverb: { colorHex: "#F97316", iconName: "reverb", widthMode: "standard" },
  modulation: { colorHex: "#8B5CF6", iconName: "modulation", widthMode: "standard" },
  dynamics: { colorHex: "#06B6D4", iconName: "dynamics", widthMode: "standard" },
  eq: { colorHex: "#3B82F6", iconName: "eq", widthMode: "standard" },
  wah: { colorHex: "#EC4899", iconName: "wah", widthMode: "standard" },
  pitch: { colorHex: "#14B8A6", iconName: "pitch", widthMode: "standard" },
  volume: { colorHex: "#6B7280", iconName: "volume", widthMode: "narrow" },
  send_return: { colorHex: "#9CA3AF", iconName: "send_return", widthMode: "narrow" },
  empty: { colorHex: "#374151", iconName: "empty", widthMode: "standard" },
  looper: { colorHex: "#A78BFA", iconName: "looper", widthMode: "standard" },
};

/** Fallback config for unknown block types. */
export const FALLBACK_CONFIG: BlockUIConfig = {
  colorHex: "#4B5563",
  iconName: "block",
  widthMode: "standard",
};

/** All 14 registered block type strings. */
export const BLOCK_TYPES: readonly string[] = Object.keys(BLOCK_UI_REGISTRY);

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Get the visual configuration for a block type.
 * Returns FALLBACK_CONFIG for unrecognized types.
 */
export function getBlockUIConfig(type: string): BlockUIConfig {
  return BLOCK_UI_REGISTRY[type] ?? FALLBACK_CONFIG;
}
