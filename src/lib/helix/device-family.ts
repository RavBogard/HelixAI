// device-family.ts — DeviceFamily discriminated union, DeviceCapabilities interface,
// resolveFamily(), and getCapabilities().
// Phase 61: Type-system foundation for all v5.0 downstream phases.

import type { DeviceTarget, BlockSpec } from "./types";
import { STOMP_CONFIG, STADIUM_CONFIG } from "./config";
import { POD_GO_MAX_USER_EFFECTS } from "./types";

// ---------------------------------------------------------------------------
// DeviceFamily — discriminated union for the 4 device families
// ---------------------------------------------------------------------------

/** The four device families that HelixAI supports. */
export type DeviceFamily = "helix" | "stomp" | "podgo" | "stadium";

// ---------------------------------------------------------------------------
// DeviceCapabilities — per-device hardware capability descriptor
// ---------------------------------------------------------------------------

/** Hardware capability descriptor for a specific DeviceTarget. */
export interface DeviceCapabilities {
  /** Which family this device belongs to */
  family: DeviceFamily;
  /** Number of DSP chips (helix: 2, others: 1) */
  dspCount: number;
  /** Max effect blocks per DSP chip */
  maxBlocksPerDsp: number;
  /** Total blocks across all DSPs */
  maxBlocksTotal: number;
  /** Snapshot count limit per preset */
  maxSnapshots: number;
  /** Can the device run two amp blocks simultaneously? */
  dualAmpSupported: boolean;
  /** Number of stereo signal paths */
  pathCount: number;
  /** VDI input present (Variax support) */
  variaxSupported: boolean;
  /** Hardware FX loop count */
  sendReturnCount: number;
  /** Built-in + external expression pedal inputs */
  expressionPedalCount: number;
  /** Preset file extension */
  fileFormat: "hlx" | "pgp" | "hsp";
  /** Which amp model era this family uses */
  ampCatalogEra: "hd2" | "agoura";
  /** Block types valid for this device */
  availableBlockTypes: ReadonlyArray<BlockSpec["type"]>;
}

// ---------------------------------------------------------------------------
// assertNever — compile-time exhaustiveness guard
// ---------------------------------------------------------------------------

function assertNever(x: never): never {
  throw new Error(`Unhandled DeviceTarget: ${String(x)}`);
}

// ---------------------------------------------------------------------------
// Block type lists (private to module)
// ---------------------------------------------------------------------------

const ALL_BLOCK_TYPES: ReadonlyArray<BlockSpec["type"]> = [
  "amp",
  "cab",
  "distortion",
  "delay",
  "reverb",
  "modulation",
  "dynamics",
  "eq",
  "wah",
  "pitch",
  "volume",
  "send_return",
] as const;

// Pod Go FX loop is fixed (not user-assignable), and pitch not available
const POD_GO_BLOCK_TYPES: ReadonlyArray<BlockSpec["type"]> = [
  "amp",
  "cab",
  "distortion",
  "delay",
  "reverb",
  "modulation",
  "dynamics",
  "eq",
  "wah",
  "volume",
] as const;

// ---------------------------------------------------------------------------
// Capability constants (private to module)
// ---------------------------------------------------------------------------

const HELIX_CAPABILITIES: DeviceCapabilities = {
  family: "helix",
  dspCount: 2,
  maxBlocksPerDsp: 8,
  maxBlocksTotal: 32,
  maxSnapshots: 8,
  dualAmpSupported: true,
  pathCount: 4,
  variaxSupported: true,
  sendReturnCount: 4,
  expressionPedalCount: 3,
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
} as const;

const STOMP_CAPABILITIES: DeviceCapabilities = {
  family: "stomp",
  dspCount: 1,
  maxBlocksPerDsp: STOMP_CONFIG.STOMP_MAX_BLOCKS,
  maxBlocksTotal: STOMP_CONFIG.STOMP_MAX_BLOCKS,
  maxSnapshots: STOMP_CONFIG.STOMP_MAX_SNAPSHOTS,
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: true,
  sendReturnCount: 1,
  expressionPedalCount: 2,
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
} as const;

const STOMP_XL_CAPABILITIES: DeviceCapabilities = {
  family: "stomp",
  dspCount: 1,
  maxBlocksPerDsp: STOMP_CONFIG.STOMP_XL_MAX_BLOCKS,
  maxBlocksTotal: STOMP_CONFIG.STOMP_XL_MAX_BLOCKS,
  maxSnapshots: STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS,
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: true,
  sendReturnCount: 1,
  expressionPedalCount: 2,
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
} as const;

const POD_GO_CAPABILITIES: DeviceCapabilities = {
  family: "podgo",
  dspCount: 1,
  maxBlocksPerDsp: POD_GO_MAX_USER_EFFECTS,
  maxBlocksTotal: 10, // fixed: wah+vol+amp+cab+eq+fxloop=6, flexible: 4
  maxSnapshots: 4,
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: false,
  sendReturnCount: 1,
  expressionPedalCount: 1,
  fileFormat: "pgp",
  ampCatalogEra: "hd2",
  availableBlockTypes: POD_GO_BLOCK_TYPES,
} as const;

// Stadium and Stadium XL share capabilities.
// XL has 4 FX loops and 1 built-in EXP vs Stadium's 2 FX loops and 0 EXP.
// Using conservative shared values. Split into STADIUM_XL_CAPABILITIES if per-device precision needed.
const STADIUM_CAPABILITIES: DeviceCapabilities = {
  family: "stadium",
  dspCount: 1,
  maxBlocksPerDsp: 48,
  maxBlocksTotal: 48,
  maxSnapshots: STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS,
  dualAmpSupported: true,
  pathCount: 4,
  variaxSupported: false,
  sendReturnCount: 2,
  expressionPedalCount: 0,
  fileFormat: "hsp",
  ampCatalogEra: "agoura",
  availableBlockTypes: ALL_BLOCK_TYPES,
} as const;

// ---------------------------------------------------------------------------
// resolveFamily — maps DeviceTarget to DeviceFamily (exhaustive)
// ---------------------------------------------------------------------------

/**
 * Resolve the device family for a given DeviceTarget.
 * This is the single source of truth for device-to-family mapping.
 * The exhaustive switch + assertNever guard ensures compile errors when
 * a new DeviceTarget variant is added without updating this function.
 */
export function resolveFamily(device: DeviceTarget): DeviceFamily {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return "helix";

    case "helix_stomp":
    case "helix_stomp_xl":
      return "stomp";

    case "pod_go":
    case "pod_go_xl":
      return "podgo";

    case "helix_stadium":
    case "helix_stadium_xl":
      return "stadium";

    default:
      return assertNever(device);
  }
}

// ---------------------------------------------------------------------------
// getCapabilities — maps DeviceTarget to DeviceCapabilities (exhaustive)
// ---------------------------------------------------------------------------

/**
 * Get the hardware capabilities for a given DeviceTarget.
 * Returns a DeviceCapabilities object with correct block limits, DSP count,
 * dual-amp support, file format, and available block types.
 * The exhaustive switch + assertNever guard ensures compile errors when
 * a new DeviceTarget variant is added without updating this function.
 */
export function getCapabilities(device: DeviceTarget): DeviceCapabilities {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return HELIX_CAPABILITIES;

    case "helix_stomp":
      return STOMP_CAPABILITIES;

    case "helix_stomp_xl":
      return STOMP_XL_CAPABILITIES;

    case "pod_go":
    case "pod_go_xl":
      return POD_GO_CAPABILITIES;

    case "helix_stadium":
    case "helix_stadium_xl":
      return STADIUM_CAPABILITIES;

    default:
      return assertNever(device);
  }
}
