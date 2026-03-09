// schema-extractor.ts — Extract per-family "gold standard" schemas from reference presets.
// Analyzes multiple presets within a device family to find structural patterns:
// required keys (present in ALL), common keys (>50%), rare keys (<=50%).
// Used by the audit pipeline to define "what correct looks like" per family.

import type { DeviceFamily } from "./device-family";
import type { ReferencePreset } from "./reference-corpus";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyFrequency {
  key: string;
  count: number;
  total: number;
  status: "required" | "common" | "rare";
}

export interface BlockPattern {
  /** Generalized block key (e.g., "data.tone.dsp0.block0") */
  blockKeyPattern: string;
  /** Fields present in ALL presets for this block pattern */
  requiredFields: string[];
  /** All fields with frequency info */
  allFields: KeyFrequency[];
}

export interface StructureSection {
  requiredKeys: string[];
  commonKeys: KeyFrequency[];
}

export interface FamilySchema {
  family: DeviceFamily;
  presetCount: number;
  /** Keys present at the top level of ALL presets */
  requiredTopLevelKeys: string[];
  /** Block structural patterns extracted from presets */
  blockStructure: BlockPattern[];
  /** Snapshot key patterns */
  snapshotStructure: StructureSection;
  /** Controller key patterns */
  controllerStructure: StructureSection;
  /** Footswitch key patterns */
  footswitchStructure: StructureSection;
  /** Metadata field frequencies */
  metadataFields: KeyFrequency[];
}

// ---------------------------------------------------------------------------
// Path classification (aligned with structural-diff.ts patterns)
// ---------------------------------------------------------------------------

const METADATA_PATTERNS = [
  /\.meta\./,
  /^data\.device$/,
  /^data\.device_version$/,
  /^json\.meta\./,
  /^version$/,
  /^schema$/,
  /^meta\./,
  /^magic$/,
  /^serialized$/,
];

const SNAPSHOT_PATTERNS = [/\.snapshot\d/, /\.snapshots/];
const CONTROLLER_PATTERNS = [/\.controller\./, /\.@controller$/];
const FOOTSWITCH_PATTERNS = [/\.footswitch\./, /\.sources\./];

// Block-related: paths containing dsp/block/flow with specific structural fields
const BLOCK_PATH_PATTERNS = [
  /\.dsp\d\.block/,
  /\.flow\[/,
  /\.@model$/,
  /\.@type$/,
  /\.@position$/,
  /\.@enabled$/,
];

type PathCategory =
  | "metadata"
  | "snapshot"
  | "controller"
  | "footswitch"
  | "block"
  | "other";

function classifyPath(path: string): PathCategory {
  if (SNAPSHOT_PATTERNS.some((p) => p.test(path))) return "snapshot";
  if (CONTROLLER_PATTERNS.some((p) => p.test(path))) return "controller";
  if (FOOTSWITCH_PATTERNS.some((p) => p.test(path))) return "footswitch";
  if (METADATA_PATTERNS.some((p) => p.test(path))) return "metadata";
  if (BLOCK_PATH_PATTERNS.some((p) => p.test(path))) return "block";
  return "other";
}

// ---------------------------------------------------------------------------
// Key collection
// ---------------------------------------------------------------------------

/**
 * Recursively enumerate all JSON paths in an object.
 * Arrays are indexed: "foo[0].bar", "foo[1].bar"
 * Stops at leaf values (string, number, boolean, null).
 */
export function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || obj === undefined) return prefix ? [prefix] : [];

  if (Array.isArray(obj)) {
    const keys: string[] = [];
    for (let i = 0; i < obj.length; i++) {
      const childPrefix = prefix ? `${prefix}[${i}]` : `[${i}]`;
      keys.push(...collectKeys(obj[i], childPrefix));
    }
    return keys;
  }

  if (typeof obj === "object") {
    const keys: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      const childPrefix = prefix ? `${prefix}.${k}` : k;
      keys.push(...collectKeys(v, childPrefix));
    }
    return keys;
  }

  // Leaf value
  return prefix ? [prefix] : [];
}

/**
 * Collect top-level keys (depth 1 only) from an object.
 */
export function collectTopLevelKeys(obj: unknown): string[] {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [];
  return Object.keys(obj);
}

// ---------------------------------------------------------------------------
// Key frequency computation
// ---------------------------------------------------------------------------

/**
 * Compute how often each key appears across multiple presets.
 * Classifies as required (all), common (>50%), or rare (<=50%).
 */
export function computeKeyFrequencies(
  allKeysets: string[][],
  total: number,
): KeyFrequency[] {
  const counts = new Map<string, number>();

  for (const keyset of allKeysets) {
    // Use a Set to count each key once per preset
    const unique = new Set(keyset);
    for (const key of unique) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const frequencies: KeyFrequency[] = [];
  for (const [key, count] of counts) {
    let status: KeyFrequency["status"];
    if (count === total) {
      status = "required";
    } else if (count > total / 2) {
      status = "common";
    } else {
      status = "rare";
    }
    frequencies.push({ key, count, total, status });
  }

  // Sort: required first, then common, then rare; within each group alphabetical
  const statusOrder = { required: 0, common: 1, rare: 2 };
  frequencies.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      a.key.localeCompare(b.key),
  );

  return frequencies;
}

// ---------------------------------------------------------------------------
// Block pattern extraction
// ---------------------------------------------------------------------------

/**
 * Generalize a block-related key path by replacing specific block indices
 * with wildcards. E.g., "data.tone.dsp0.block3.@model" → "data.tone.dsp*.block*.@model"
 */
function generalizeBlockPath(path: string): string {
  return path
    .replace(/dsp\d+/g, "dsp*")
    .replace(/block\d+/g, "block*")
    .replace(/\[\d+\]/g, "[*]");
}

/**
 * Extract the block key prefix from a path.
 * E.g., "data.tone.dsp0.block3.@model" → "data.tone.dsp0.block3"
 */
function extractBlockPrefix(path: string): string | null {
  // Match patterns like dsp0.block3 or flow[0]
  const dspBlockMatch = path.match(/^(.+?\.dsp\d+\.block\d+)/);
  if (dspBlockMatch) return dspBlockMatch[1];

  const flowMatch = path.match(/^(.+?\.flow\[\d+\])/);
  if (flowMatch) return flowMatch[1];

  return null;
}

/**
 * Extract block patterns from block-category key frequencies.
 * Groups keys by their block prefix, then computes per-block field frequencies.
 */
export function extractBlockPatterns(
  blockKeys: string[][],
  total: number,
): BlockPattern[] {
  // Collect all unique generalized block prefixes
  const blockGroups = new Map<string, string[][]>();

  for (const keyset of blockKeys) {
    const grouped = new Map<string, string[]>();
    for (const key of keyset) {
      const prefix = extractBlockPrefix(key);
      if (!prefix) continue;
      const generalizedPrefix = generalizeBlockPath(prefix);
      if (!grouped.has(generalizedPrefix)) {
        grouped.set(generalizedPrefix, []);
      }
      // Store the field portion (after the block prefix)
      const field = key.slice(prefix.length + 1); // +1 for the dot
      if (field) {
        grouped.get(generalizedPrefix)!.push(field);
      }
    }

    for (const [genPrefix, fields] of grouped) {
      if (!blockGroups.has(genPrefix)) {
        blockGroups.set(genPrefix, []);
      }
      blockGroups.get(genPrefix)!.push(fields);
    }
  }

  const patterns: BlockPattern[] = [];
  for (const [blockKeyPattern, fieldSets] of blockGroups) {
    const fieldFreqs = computeKeyFrequencies(fieldSets, total);
    patterns.push({
      blockKeyPattern,
      requiredFields: fieldFreqs
        .filter((f) => f.status === "required")
        .map((f) => f.key),
      allFields: fieldFreqs,
    });
  }

  // Sort by block key pattern
  patterns.sort((a, b) => a.blockKeyPattern.localeCompare(b.blockKeyPattern));
  return patterns;
}

// ---------------------------------------------------------------------------
// Main schema extraction
// ---------------------------------------------------------------------------

/**
 * Extract a FamilySchema from multiple reference presets of the SAME family.
 * Analyzes structural patterns to determine what keys are required vs optional.
 *
 * @param presets - Must all be from the same DeviceFamily
 * @throws If presets array is empty or contains mixed families
 */
export function extractFamilySchema(presets: ReferencePreset[]): FamilySchema {
  if (presets.length === 0) {
    throw new Error("Cannot extract schema from empty preset array");
  }

  const family = presets[0].family;
  if (presets.some((p) => p.family !== family)) {
    throw new Error(
      "All presets must be from the same device family for schema extraction",
    );
  }

  const total = presets.length;

  // Collect all keys from each preset
  const allKeysets = presets.map((p) => collectKeys(p.content));
  const allTopLevelKeys = presets.map((p) => collectTopLevelKeys(p.content));

  // Top-level key frequencies
  const topLevelFreqs = computeKeyFrequencies(allTopLevelKeys, total);
  const requiredTopLevelKeys = topLevelFreqs
    .filter((f) => f.status === "required")
    .map((f) => f.key);

  // Partition keys by category
  const categoryKeysets: Record<PathCategory, string[][]> = {
    metadata: [],
    snapshot: [],
    controller: [],
    footswitch: [],
    block: [],
    other: [],
  };

  for (const keyset of allKeysets) {
    const partitioned: Record<PathCategory, string[]> = {
      metadata: [],
      snapshot: [],
      controller: [],
      footswitch: [],
      block: [],
      other: [],
    };

    for (const key of keyset) {
      const cat = classifyPath(key);
      partitioned[cat].push(key);
    }

    for (const cat of Object.keys(partitioned) as PathCategory[]) {
      categoryKeysets[cat].push(partitioned[cat]);
    }
  }

  // Build section structures
  const buildSection = (keysets: string[][]): StructureSection => {
    // Generalize paths for comparison (replace indices with wildcards)
    const generalizedKeysets = keysets.map((ks) =>
      ks.map((k) => generalizeBlockPath(k)),
    );
    const freqs = computeKeyFrequencies(generalizedKeysets, total);
    return {
      requiredKeys: freqs
        .filter((f) => f.status === "required")
        .map((f) => f.key),
      commonKeys: freqs.filter((f) => f.status !== "rare"),
    };
  };

  return {
    family,
    presetCount: total,
    requiredTopLevelKeys,
    blockStructure: extractBlockPatterns(categoryKeysets.block, total),
    snapshotStructure: buildSection(categoryKeysets.snapshot),
    controllerStructure: buildSection(categoryKeysets.controller),
    footswitchStructure: buildSection(categoryKeysets.footswitch),
    metadataFields: computeKeyFrequencies(
      categoryKeysets.metadata.map((ks) =>
        ks.map((k) => generalizeBlockPath(k)),
      ),
      total,
    ),
  };
}
