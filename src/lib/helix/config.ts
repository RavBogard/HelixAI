/**
 * Helix firmware version configuration.
 * To support a new firmware version, update these values — no other code changes needed.
 * Values correspond to HX Edit .hlx file format fields.
 */
export const FIRMWARE_CONFIG = {
  /** Schema version number in .hlx JSON */
  HLX_VERSION: 6,
  /** Application version integer — encodes firmware version (e.g., 57671680 = FW 3.70) */
  HLX_APP_VERSION: 57671680,
  /** Build SHA string shown in .hlx meta (e.g., "v3.70") */
  HLX_BUILD_SHA: "v3.70",
} as const;
