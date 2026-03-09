// structural-diff.ts — Deterministic deep JSON comparison for preset files.
// Compares generated presets against reference presets, producing categorized
// deviation reports. Device-family aware (HLX, PGP, HSP formats).

import type { DeviceFamily } from "./device-family";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeviationCategory =
  | "structure"
  | "parameter"
  | "metadata"
  | "snapshot"
  | "controller"
  | "footswitch"
  | "block";

export type DeviationSeverity = "critical" | "warning" | "info";

export interface Deviation {
  path: string;
  category: DeviationCategory;
  severity: DeviationSeverity;
  expected: unknown;
  actual: unknown;
  message: string;
}

export interface DiffReport {
  deviceFamily: DeviceFamily;
  deviationCount: { critical: number; warning: number; info: number };
  categoryCount: Record<DeviationCategory, number>;
  passed: boolean;
  deviations: Deviation[];
}

// ---------------------------------------------------------------------------
// Path classification
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

const BLOCK_PATTERNS = [
  /\.@model$/,
  /\.@type$/,
  /\.@position$/,
  /\.@enabled$/,
  /\.@stereo$/,
  /\.@path$/,
  /\.@no_snapshot_bypass$/,
  /\.@bypassvolume$/,
  /\.@cab$/,
  /\.@trails$/,
];

const SNAPSHOT_PATTERNS = [/\.snapshot\d/, /\.snapshots/];
const CONTROLLER_PATTERNS = [/\.controller\./, /\.@controller$/];
const FOOTSWITCH_PATTERNS = [/\.footswitch\./, /\.sources\./];

function classifyCategory(path: string): DeviationCategory {
  if (SNAPSHOT_PATTERNS.some((p) => p.test(path))) return "snapshot";
  if (CONTROLLER_PATTERNS.some((p) => p.test(path))) return "controller";
  if (FOOTSWITCH_PATTERNS.some((p) => p.test(path))) return "footswitch";
  if (METADATA_PATTERNS.some((p) => p.test(path))) return "metadata";
  if (BLOCK_PATTERNS.some((p) => p.test(path))) return "block";

  // Parameter: numeric leaf on a block-like path (dsp/block/flow)
  if (
    /\.(dsp\d|block\d|b\d\d)\./.test(path) &&
    !/@/.test(path.split(".").pop() ?? "")
  ) {
    return "parameter";
  }

  return "structure";
}

// ---------------------------------------------------------------------------
// Severity classification
// ---------------------------------------------------------------------------

function classifySeverity(
  path: string,
  category: DeviationCategory,
  expected: unknown,
  actual: unknown,
): DeviationSeverity {
  // Critical: device ID mismatch
  if (/\.device$|^data\.device$/.test(path) && category === "metadata") {
    return "critical";
  }

  // Critical: missing/changed amp or cab model
  if (path.endsWith(".@model")) {
    const expStr = String(expected ?? "");
    const actStr = String(actual ?? "");
    if (
      /Amp|Cab/i.test(expStr) ||
      /Amp|Cab/i.test(actStr) ||
      expected === undefined ||
      actual === undefined
    ) {
      return "critical";
    }
    return "warning";
  }

  // Critical: entire section missing
  if (
    (expected !== undefined && actual === undefined) ||
    (expected === undefined && actual !== undefined)
  ) {
    if (/^data\.tone\.dsp\d$/.test(path)) return "critical";
    if (/^json\.preset\.flow\[\d\]$/.test(path)) return "critical";
    if (/\.snapshot\d$/.test(path) && category === "snapshot") return "critical";
  }

  // Snapshot count mismatch
  if (category === "snapshot" && path.endsWith(".@valid")) {
    if (expected === true && actual === false) return "critical";
  }

  // Info: cosmetic metadata
  if (category === "metadata") return "info";

  // Warning: everything else in block/parameter/controller/footswitch/snapshot
  if (
    category === "block" ||
    category === "parameter" ||
    category === "controller" ||
    category === "footswitch" ||
    category === "snapshot"
  ) {
    return "warning";
  }

  return "warning";
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------

function formatValue(val: unknown): string {
  if (val === undefined) return "<missing>";
  if (val === null) return "null";
  if (typeof val === "string") {
    return val.length > 100 ? val.slice(0, 100) + "..." : val;
  }
  if (typeof val === "object") {
    const s = JSON.stringify(val);
    return s.length > 100 ? s.slice(0, 100) + "..." : s;
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Deep diff (generic recursive)
// ---------------------------------------------------------------------------

const FLOAT_TOLERANCE = 0.001;

function deepDiff(
  reference: unknown,
  generated: unknown,
  path: string,
  deviations: Deviation[],
): void {
  // Both null/undefined
  if (reference === undefined && generated === undefined) return;
  if (reference === null && generated === null) return;

  // One is missing
  if (reference === undefined || reference === null) {
    if (generated !== undefined && generated !== null) {
      const category = classifyCategory(path);
      const severity = classifySeverity(path, category, reference, generated);
      deviations.push({
        path,
        category,
        severity,
        expected: reference,
        actual: generated,
        message: `Extra key: ${path} = ${formatValue(generated)}`,
      });
    }
    return;
  }
  if (generated === undefined || generated === null) {
    const category = classifyCategory(path);
    const severity = classifySeverity(path, category, reference, generated);
    deviations.push({
      path,
      category,
      severity,
      expected: reference,
      actual: generated,
      message: `Missing key: ${path} (expected ${formatValue(reference)})`,
    });
    return;
  }

  // Type mismatch
  if (typeof reference !== typeof generated) {
    const category = classifyCategory(path);
    const severity = classifySeverity(path, category, reference, generated);
    deviations.push({
      path,
      category,
      severity,
      expected: reference,
      actual: generated,
      message: `Type mismatch at ${path}: expected ${typeof reference}, got ${typeof generated}`,
    });
    return;
  }

  // Numeric comparison with tolerance
  if (typeof reference === "number" && typeof generated === "number") {
    if (Math.abs(reference - generated) > FLOAT_TOLERANCE) {
      const category = classifyCategory(path);
      const severity = classifySeverity(path, category, reference, generated);
      deviations.push({
        path,
        category,
        severity,
        expected: reference,
        actual: generated,
        message: `Value differs at ${path}: expected ${reference}, got ${generated}`,
      });
    }
    return;
  }

  // String/boolean comparison
  if (typeof reference === "string" || typeof reference === "boolean") {
    if (reference !== generated) {
      const category = classifyCategory(path);
      const severity = classifySeverity(path, category, reference, generated);
      deviations.push({
        path,
        category,
        severity,
        expected: reference,
        actual: generated,
        message: `Value differs at ${path}: expected ${formatValue(reference)}, got ${formatValue(generated)}`,
      });
    }
    return;
  }

  // Array comparison
  if (Array.isArray(reference)) {
    if (!Array.isArray(generated)) {
      const category = classifyCategory(path);
      const severity = classifySeverity(path, category, reference, generated);
      deviations.push({
        path,
        category,
        severity,
        expected: reference,
        actual: generated,
        message: `Expected array at ${path}, got ${typeof generated}`,
      });
      return;
    }
    const maxLen = Math.max(reference.length, generated.length);
    for (let i = 0; i < maxLen; i++) {
      deepDiff(
        reference[i],
        generated[i],
        `${path}[${i}]`,
        deviations,
      );
    }
    return;
  }

  // Object comparison
  if (typeof reference === "object") {
    if (typeof generated !== "object" || Array.isArray(generated)) {
      const category = classifyCategory(path);
      const severity = classifySeverity(path, category, reference, generated);
      deviations.push({
        path,
        category,
        severity,
        expected: reference,
        actual: generated,
        message: `Expected object at ${path}, got ${Array.isArray(generated) ? "array" : typeof generated}`,
      });
      return;
    }

    const refObj = reference as Record<string, unknown>;
    const genObj = generated as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(refObj), ...Object.keys(genObj)]);

    for (const key of allKeys) {
      const childPath = path ? `${path}.${key}` : key;
      deepDiff(refObj[key], genObj[key], childPath, deviations);
    }
  }
}

// ---------------------------------------------------------------------------
// Family-specific diff entry points
// ---------------------------------------------------------------------------

function diffHlxPresets(
  reference: unknown,
  generated: unknown,
): Deviation[] {
  const deviations: Deviation[] = [];
  deepDiff(reference, generated, "", deviations);
  return deviations;
}

function diffPgpPresets(
  reference: unknown,
  generated: unknown,
): Deviation[] {
  const deviations: Deviation[] = [];
  deepDiff(reference, generated, "", deviations);
  return deviations;
}

function diffHspPresets(
  reference: unknown,
  generated: unknown,
): Deviation[] {
  const deviations: Deviation[] = [];
  // For HSP, skip the serialized field (it's a derived string)
  const refObj = reference as Record<string, unknown>;
  const genObj = generated as Record<string, unknown>;

  // Compare magic
  deepDiff(refObj.magic, genObj.magic, "magic", deviations);
  // Compare json subtree (the meaningful content)
  deepDiff(refObj.json, genObj.json, "json", deviations);
  // Skip serialized — it's reconstructed from json

  return deviations;
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReport(
  family: DeviceFamily,
  deviations: Deviation[],
): DiffReport {
  const deviationCount = { critical: 0, warning: 0, info: 0 };
  const categoryCount: Record<DeviationCategory, number> = {
    structure: 0,
    parameter: 0,
    metadata: 0,
    snapshot: 0,
    controller: 0,
    footswitch: 0,
    block: 0,
  };

  for (const d of deviations) {
    deviationCount[d.severity]++;
    categoryCount[d.category]++;
  }

  // Sort by severity (critical first) then path
  const severityOrder: Record<DeviationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  deviations.sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      a.path.localeCompare(b.path),
  );

  return {
    deviceFamily: family,
    deviationCount,
    categoryCount,
    passed: deviationCount.critical === 0,
    deviations,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function diffPresets(
  reference: unknown,
  generated: unknown,
  family: DeviceFamily,
): DiffReport {
  let deviations: Deviation[];

  switch (family) {
    case "stadium":
      deviations = diffHspPresets(reference, generated);
      break;
    case "podgo":
      deviations = diffPgpPresets(reference, generated);
      break;
    case "helix":
    case "stomp":
      deviations = diffHlxPresets(reference, generated);
      break;
    default:
      deviations = diffHlxPresets(reference, generated);
  }

  return buildReport(family, deviations);
}
