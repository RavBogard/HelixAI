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
