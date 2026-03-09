// reference-corpus.ts — Load and parse real Line 6 preset files (.hlx/.pgp/.hsp)
// into a structured reference corpus grouped by device family.
// Used by the schema extractor and gold standard audit pipeline.

import { readFileSync, existsSync } from "node:fs";
import { extname, basename } from "node:path";
import type { DeviceFamily } from "./device-family";
import { DEVICE_IDS } from "./types";
import { STADIUM_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresetFormat = "hlx" | "pgp" | "hsp";

export interface ReferencePreset {
  family: DeviceFamily;
  filePath: string;
  fileName: string;
  deviceId: number;
  format: PresetFormat;
  content: unknown;
}

export type CorpusConfig = Record<DeviceFamily, string[]>;

export interface CorpusLoadResult {
  presets: ReferencePreset[];
  errors: { filePath: string; error: string }[];
}

// ---------------------------------------------------------------------------
// Device ID → Family mapping (reverse lookup from DEVICE_IDS)
// ---------------------------------------------------------------------------

const DEVICE_ID_TO_FAMILY: Record<number, DeviceFamily> = {};
for (const [target, id] of Object.entries(DEVICE_IDS)) {
  if (id === 0) continue; // skip unverified/placeholder
  if (target.startsWith("helix_stadium")) {
    DEVICE_ID_TO_FAMILY[id] = "stadium";
  } else if (target.startsWith("helix_stomp")) {
    DEVICE_ID_TO_FAMILY[id] = "stomp";
  } else if (target.startsWith("pod_go")) {
    DEVICE_ID_TO_FAMILY[id] = "podgo";
  } else {
    // helix_lt, helix_floor, helix_rack, helix_native
    DEVICE_ID_TO_FAMILY[id] = "helix";
  }
}

// Known device IDs not in DEVICE_IDS (discovered from reference presets)
DEVICE_ID_TO_FAMILY[2162944] = "helix"; // Helix Native (confirmed from JS-EVPanRed.hlx)
DEVICE_ID_TO_FAMILY[2162696] = "podgo"; // Pod Go Wireless (confirmed from The Hell Song.pgp)

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

export function detectFormat(filePath: string): PresetFormat {
  const ext = extname(filePath).toLowerCase();
  switch (ext) {
    case ".hlx":
      return "hlx";
    case ".pgp":
      return "pgp";
    case ".hsp":
      return "hsp";
    default:
      throw new Error(`Unknown preset file extension: ${ext} (file: ${filePath})`);
  }
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------

/**
 * Parse a preset file into its JSON content.
 * - .hlx and .pgp are plain JSON
 * - .hsp has an 8-byte magic header ("rpshnosj") before the JSON
 */
export function parsePresetFile(filePath: string): {
  content: unknown;
  format: PresetFormat;
} {
  const format = detectFormat(filePath);
  const raw = readFileSync(filePath, "utf-8");

  if (format === "hsp") {
    // Strip 8-byte magic header
    const magic = raw.slice(0, STADIUM_CONFIG.STADIUM_MAGIC_HEADER.length);
    if (magic !== STADIUM_CONFIG.STADIUM_MAGIC_HEADER) {
      throw new Error(
        `Invalid .hsp magic header: expected "${STADIUM_CONFIG.STADIUM_MAGIC_HEADER}", got "${magic}" (file: ${filePath})`,
      );
    }
    const json = raw.slice(STADIUM_CONFIG.STADIUM_MAGIC_HEADER.length);
    return { content: JSON.parse(json), format };
  }

  return { content: JSON.parse(raw), format };
}

// ---------------------------------------------------------------------------
// Device ID extraction
// ---------------------------------------------------------------------------

/**
 * Extract device ID from parsed preset content based on format.
 * - HLX: content.data.device
 * - PGP: content.data.device (same top-level schema)
 * - HSP: content.meta.device_id
 */
export function detectDeviceId(content: unknown, format: PresetFormat): number {
  const obj = content as Record<string, unknown>;

  if (format === "hsp") {
    const meta = obj.meta as Record<string, unknown> | undefined;
    if (meta && typeof meta.device_id === "number") {
      return meta.device_id;
    }
    throw new Error("HSP preset missing meta.device_id");
  }

  // HLX and PGP both use data.device
  const data = obj.data as Record<string, unknown> | undefined;
  if (data && typeof data.device === "number") {
    return data.device;
  }
  throw new Error(`${format.toUpperCase()} preset missing data.device`);
}

// ---------------------------------------------------------------------------
// Family detection
// ---------------------------------------------------------------------------

/**
 * Map a device ID to its DeviceFamily.
 * Uses reverse lookup from DEVICE_IDS plus known supplementary IDs.
 */
export function detectFamily(deviceId: number): DeviceFamily {
  const family = DEVICE_ID_TO_FAMILY[deviceId];
  if (family) return family;
  throw new Error(`Unknown device ID: ${deviceId} — not in DEVICE_IDS mapping`);
}

// ---------------------------------------------------------------------------
// Corpus loader
// ---------------------------------------------------------------------------

/**
 * Load all reference presets from configured file paths.
 * Groups by device family. Invalid/missing files are reported as errors
 * without aborting the entire load.
 */
export function loadCorpus(config: CorpusConfig): CorpusLoadResult {
  const presets: ReferencePreset[] = [];
  const errors: { filePath: string; error: string }[] = [];

  for (const [expectedFamily, paths] of Object.entries(config) as [
    DeviceFamily,
    string[],
  ][]) {
    for (const filePath of paths) {
      try {
        if (!existsSync(filePath)) {
          errors.push({ filePath, error: "File not found" });
          continue;
        }

        const { content, format } = parsePresetFile(filePath);
        const deviceId = detectDeviceId(content, format);
        const family = detectFamily(deviceId);

        if (family !== expectedFamily) {
          errors.push({
            filePath,
            error: `Family mismatch: expected "${expectedFamily}", detected "${family}" (device ID: ${deviceId})`,
          });
          continue;
        }

        presets.push({
          family,
          filePath,
          fileName: basename(filePath),
          deviceId,
          format,
          content,
        });
      } catch (err) {
        errors.push({
          filePath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { presets, errors };
}
