/**
 * Helix firmware version configuration.
 * To support a new firmware version, update these values — no other code changes needed.
 * Values correspond to HX Edit .hlx file format fields.
 */
export const FIRMWARE_CONFIG = {
  /** Schema version number in .hlx JSON */
  HLX_VERSION: 6,
  /** Application version integer — encodes firmware version (e.g., 58720256 = FW 3.80) */
  HLX_APP_VERSION: 58720256,
  /** Build SHA string shown in .hlx meta (e.g., "v3.80") */
  HLX_BUILD_SHA: "v3.80",
} as const;

/**
 * Pod Go firmware version configuration.
 * Values correspond to POD Go Edit .pgp file format fields.
 * Source: Direct inspection of 18 real .pgp files (firmware v2.00)
 */
export const POD_GO_FIRMWARE_CONFIG = {
  /** Schema version number in .pgp JSON (same as Helix) */
  PGP_VERSION: 6,
  /** Application version integer — encodes Pod Go Edit version (33554432 = v2.00) */
  PGP_APP_VERSION: 33554432,
  /** Device version integer — encodes firmware version (33619968 = FW 2.00) */
  PGP_DEVICE_VERSION: 33619968,
  /** Build SHA string shown in .pgp meta */
  PGP_BUILD_SHA: "v2.00-5-g665e64e",
  /** Application name shown in .pgp meta */
  PGP_APPLICATION: "POD Go Edit",
} as const;

/**
 * Helix Stadium file format constants.
 * Source: Real .hsp files from The Gear Forum (Dec 2025):
 *   - Cranked_2203.hsp (by EOengineer)
 *   - Rev_120_Purple_Recto.hsp (by EOengineer)
 * File format: 8-byte ASCII magic header ("rpshnosj") + UTF-8 JSON content.
 * Top-level: { "meta": { "device_id": 2490368, ... }, "preset": { "flow": [...], ... } }
 * Block format: slot-based — { "slot": [{ "model": "...", "params": { "K": { "access": "enabled", "value": N } } }] }
 */
export const STADIUM_CONFIG = {
  /** Magic header prepended to all .hsp files — 8 ASCII bytes before JSON content */
  STADIUM_MAGIC_HEADER: "rpshnosj",
  /** Maximum user-assignable effect blocks per path (b01-b12) */
  STADIUM_MAX_BLOCKS_PER_PATH: 12,
  /** Maximum snapshot slots per preset (confirmed from real .hsp snapshots array length) */
  STADIUM_MAX_SNAPSHOTS: 8,
  /** Maximum signal paths (1A, 1B, 2A, 2B — 2 flows × 2 paths each) */
  STADIUM_MAX_PATHS: 4,
  /** Device version integer — updated to match NH reference .hsp files (2026-03-08) */
  STADIUM_DEVICE_VERSION: 302056738,
  /** Input model for path 1A (instrument input) */
  STADIUM_INPUT_MODEL: "P35_InputInst1",
  /** Input model for unused paths (no input) */
  STADIUM_INPUT_NONE_MODEL: "P35_InputNone",
  /** Output model (matrix output) */
  STADIUM_OUTPUT_MODEL: "P35_OutputMatrix",
} as const;

/**
 * HX Stomp and HX Stomp XL file format constants.
 * Source: Direct inspection of real .hlx files (2026-03-04)
 *   - Swell_Delay.hlx: HX Stomp hardware export
 *   - The_Kids_Are_D.hlx: HX Stomp XL hardware export
 */
export const STOMP_CONFIG = {
  /** HX Stomp: max user-assignable effect blocks (FW 3.0+ increased from 6 to 8) */
  STOMP_MAX_BLOCKS: 8,
  /** HX Stomp XL: max user-assignable effect blocks (same DSP chip as Stomp -- same 8-block limit) */
  STOMP_XL_MAX_BLOCKS: 8,
  /** HX Stomp: max snapshot count */
  STOMP_MAX_SNAPSHOTS: 3,
  /** HX Stomp XL: max snapshot count (confirmed from The_Kids_Are_D.hlx) */
  STOMP_XL_MAX_SNAPSHOTS: 4,
  /** I/O input model for both Stomp variants — HelixStomp_ prefix, NOT HD2_App* */
  STOMP_INPUT_MODEL: "HelixStomp_AppDSPFlowInput",
  /** I/O main output model */
  STOMP_OUTPUT_MAIN_MODEL: "HelixStomp_AppDSPFlowOutputMain",
  /** I/O send output model */
  STOMP_OUTPUT_SEND_MODEL: "HelixStomp_AppDSPFlowOutputSend",
  /** Device version — same as LT/Floor (FIRMWARE_CONFIG.HLX_APP_VERSION) */
  STOMP_DEVICE_VERSION: 58720256,
} as const;

/**
 * Helix Floor/Rack/LT system model IDs.
 * These are I/O and routing models used in .hlx file format.
 * Source: Direct inspection of real .hlx files (HD2_* prefix).
 */
export const HELIX_SYSTEM_MODELS = {
  /** DSP Flow 1 input */
  FLOW1_INPUT: "HD2_AppDSPFlow1Input",
  /** DSP Flow 2 input */
  FLOW2_INPUT: "HD2_AppDSPFlow2Input",
  /** DSP output (shared) */
  FLOW_OUTPUT: "HD2_AppDSPFlowOutput",
  /** Split A/B routing block */
  SPLIT_AB: "HD2_SplitAB",
  /** Merger/mixer routing block */
  MERGER_MIXER: "HD2_MergerMixer",
} as const;

/**
 * Pod Go system model IDs.
 * Source: Direct inspection of real Pod Go .pgp files (P34_* prefix).
 */
export const POD_GO_SYSTEM_MODELS = {
  /** Input model */
  INPUT: "P34_AppDSPFlowInput",
  /** Output model */
  OUTPUT: "P34_AppDSPFlowOutput",
} as const;
