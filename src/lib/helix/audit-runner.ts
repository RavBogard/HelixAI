// audit-runner.ts — Full audit orchestrator for v5.0 gold standard compliance.
// Ties together mock harness (Phase 8), structural diff (Phase 9),
// intent/musical validation (Phase 10), and reference corpus/schema (Phase 11).
// Produces per-family audit results with deviation summaries.

import { runAllScenarios } from "./mock-harness";
import { diffPresets } from "./structural-diff";
import { loadCorpus } from "./reference-corpus";
import { extractFamilySchema, collectKeys } from "./schema-extractor";
import { resolveFamily } from "./device-family";
import type { DeviceFamily } from "./device-family";
import type { HarnessResult } from "./mock-harness";
import type { MockScenario } from "./mock-scenarios";
import type { DiffReport } from "./structural-diff";
import type { CorpusConfig, ReferencePreset } from "./reference-corpus";
import type { FamilySchema } from "./schema-extractor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditConfig {
  scenarios: MockScenario[];
  corpusConfig?: CorpusConfig;
}

export interface SchemaComplianceResult {
  missingRequiredKeys: string[];
  missingCommonKeys: string[];
  extraKeys: string[];
}

export interface ScenarioAuditResult {
  scenarioId: string;
  device: string;
  toneStyle: string;
  harnessResult: HarnessResult;
  diffReport?: DiffReport;
  schemaCompliance?: SchemaComplianceResult;
}

export interface FamilyAuditResult {
  family: DeviceFamily;
  scenarios: ScenarioAuditResult[];
  diffSummary: { critical: number; warning: number; info: number };
  intentSummary: { passed: number; failed: number };
  musicalSummary: { passed: number; failed: number };
  schemaCompliance: { totalMissing: number; details: SchemaComplianceResult[] };
  overallPassed: boolean;
}

export interface AuditResult {
  families: FamilyAuditResult[];
  totalScenarios: number;
  totalPassed: number;
  totalFailed: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group harness results by device family using resolveFamily().
 */
export function groupByFamily(
  results: HarnessResult[],
): Map<DeviceFamily, HarnessResult[]> {
  const map = new Map<DeviceFamily, HarnessResult[]>();
  for (const r of results) {
    const family = resolveFamily(r.device);
    if (!map.has(family)) map.set(family, []);
    map.get(family)!.push(r);
  }
  return map;
}

/**
 * Check a generated preset's top-level keys against a family schema.
 * Reports missing required keys, missing common keys, and extra keys
 * not seen in any reference preset.
 */
export function checkSchemaCompliance(
  preset: unknown,
  schema: FamilySchema,
): SchemaComplianceResult {
  if (preset === null || typeof preset !== "object") {
    return {
      missingRequiredKeys: [...schema.requiredTopLevelKeys],
      missingCommonKeys: [],
      extraKeys: [],
    };
  }

  const presetKeys = new Set(Object.keys(preset as Record<string, unknown>));
  const requiredSet = new Set(schema.requiredTopLevelKeys);

  // All keys seen in reference schemas (required + common from metadata)
  const allReferenceKeys = new Set<string>();
  for (const k of schema.requiredTopLevelKeys) allReferenceKeys.add(k);
  for (const kf of schema.metadataFields) {
    // Top-level metadata keys (no dots = top-level)
    if (!kf.key.includes(".")) allReferenceKeys.add(kf.key);
  }

  const missingRequiredKeys: string[] = [];
  for (const req of requiredSet) {
    if (!presetKeys.has(req)) missingRequiredKeys.push(req);
  }

  const missingCommonKeys: string[] = [];
  for (const kf of schema.metadataFields) {
    if (!kf.key.includes(".") && kf.status === "common" && !presetKeys.has(kf.key)) {
      missingCommonKeys.push(kf.key);
    }
  }

  const extraKeys: string[] = [];
  for (const pk of presetKeys) {
    if (!allReferenceKeys.has(pk)) extraKeys.push(pk);
  }

  return { missingRequiredKeys, missingCommonKeys, extraKeys };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the full audit pipeline:
 * 1. Generate presets via mock harness
 * 2. Load reference corpus (if config provided)
 * 3. Compare each generated preset against references + schema
 * 4. Aggregate results per family
 */
export function runAudit(config: AuditConfig): AuditResult {
  const { scenarios, corpusConfig } = config;

  // Step 1: Generate all presets
  const harnessResults = runAllScenarios(scenarios);

  // Step 2: Load reference corpus (if available)
  let referencesByFamily = new Map<DeviceFamily, ReferencePreset[]>();
  let schemasByFamily = new Map<DeviceFamily, FamilySchema>();

  if (corpusConfig) {
    const corpus = loadCorpus(corpusConfig);

    // Group references by family
    for (const preset of corpus.presets) {
      if (!referencesByFamily.has(preset.family)) {
        referencesByFamily.set(preset.family, []);
      }
      referencesByFamily.get(preset.family)!.push(preset);
    }

    // Extract schemas per family
    for (const [family, presets] of referencesByFamily) {
      if (presets.length > 0) {
        schemasByFamily.set(family, extractFamilySchema(presets));
      }
    }
  }

  // Step 3: Group results by family and audit each
  const grouped = groupByFamily(harnessResults);
  const families: FamilyAuditResult[] = [];

  for (const [family, results] of grouped) {
    const references = referencesByFamily.get(family) ?? [];
    const schema = schemasByFamily.get(family);

    const scenarioResults: ScenarioAuditResult[] = [];
    const diffSummary = { critical: 0, warning: 0, info: 0 };
    const intentSummary = { passed: 0, failed: 0 };
    const musicalSummary = { passed: 0, failed: 0 };
    const complianceDetails: SchemaComplianceResult[] = [];
    let totalMissing = 0;

    for (const hr of results) {
      const scenarioResult: ScenarioAuditResult = {
        scenarioId: hr.scenarioId,
        device: hr.device,
        toneStyle: hr.toneStyle,
        harnessResult: hr,
      };

      // Structural diff against first reference (if available)
      if (references.length > 0 && hr.preset !== null) {
        const diffReport = diffPresets(references[0].content, hr.preset, family);
        scenarioResult.diffReport = diffReport;
        diffSummary.critical += diffReport.deviationCount.critical;
        diffSummary.warning += diffReport.deviationCount.warning;
        diffSummary.info += diffReport.deviationCount.info;
      }

      // Schema compliance (if schema available)
      if (schema && hr.preset !== null) {
        const compliance = checkSchemaCompliance(hr.preset, schema);
        scenarioResult.schemaCompliance = compliance;
        complianceDetails.push(compliance);
        totalMissing += compliance.missingRequiredKeys.length;
      }

      // Intent summary
      const intentPassed =
        !hr.error &&
        hr.intentAudit.amp.matched &&
        hr.intentAudit.cab.matched &&
        hr.intentAudit.snapshots.matched;
      if (intentPassed) {
        intentSummary.passed++;
      } else {
        intentSummary.failed++;
      }

      // Musical summary
      if (hr.musicalAudit.passed) {
        musicalSummary.passed++;
      } else {
        musicalSummary.failed++;
      }

      scenarioResults.push(scenarioResult);
    }

    const overallPassed =
      diffSummary.critical === 0 &&
      intentSummary.failed === 0 &&
      musicalSummary.failed === 0;

    families.push({
      family,
      scenarios: scenarioResults,
      diffSummary,
      intentSummary,
      musicalSummary,
      schemaCompliance: { totalMissing, details: complianceDetails },
      overallPassed,
    });
  }

  const totalScenarios = harnessResults.length;
  const totalPassed = families.filter((f) => f.overallPassed).length;
  const totalFailed = families.length - totalPassed;

  return {
    families,
    totalScenarios,
    totalPassed,
    totalFailed,
    timestamp: new Date().toISOString(),
  };
}
