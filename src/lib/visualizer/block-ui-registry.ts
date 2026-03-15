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
  amp: { colorHex: "#C36952", iconName: "amp", widthMode: "wide" }, // Earthy Orange-Red
  cab: { colorHex: "#b5b5b5", iconName: "cab", widthMode: "wide" }, // Grey/Silver for Cabs
  distortion: { colorHex: "#E2CD0D", iconName: "distortion", widthMode: "standard" }, // Yellow
  delay: { colorHex: "#71A657", iconName: "delay", widthMode: "standard" }, // Green
  reverb: { colorHex: "#D56637", iconName: "reverb", widthMode: "standard" }, // burnt orange
  modulation: { colorHex: "#2A6EE5", iconName: "modulation", widthMode: "standard" }, // Blue
  dynamics: { colorHex: "#D14436", iconName: "dynamics", widthMode: "standard" }, // Red
  eq: { colorHex: "#5D6FD2", iconName: "eq", widthMode: "standard" }, // Purple/Blue
  wah: { colorHex: "#CE458C", iconName: "wah", widthMode: "standard" }, // Pink/Magenta
  pitch: { colorHex: "#4FBBC2", iconName: "pitch", widthMode: "standard" }, // Cyan/Teal
  volume: { colorHex: "#6B7280", iconName: "volume", widthMode: "narrow" }, // Grey
  send_return: { colorHex: "#9CA3AF", iconName: "send_return", widthMode: "narrow" },
  empty: { colorHex: "#222222", iconName: "empty", widthMode: "standard" },
  looper: { colorHex: "#2e2e2e", iconName: "looper", widthMode: "standard" },
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
