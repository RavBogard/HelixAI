import { describe, it, expect } from "vitest";
import {
  formatAuditReport,
  formatAuditJson,
  getTopIssues,
} from "./audit-report";
import type {
  AuditResult,
  FamilyAuditResult,
  ScenarioAuditResult,
} from "./audit-runner";
import type { DiffReport, Deviation } from "./structural-diff";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeviation(
  path: string,
  category: Deviation["category"],
  severity: Deviation["severity"],
  message: string,
): Deviation {
  return { path, category, severity, expected: "a", actual: "b", message };
}

function makeScenarioResult(
  id: string,
  opts: {
    intentPassed?: boolean;
    musicalPassed?: boolean;
    deviations?: Deviation[];
  } = {},
): ScenarioAuditResult {
  const { intentPassed = true, musicalPassed = true, deviations = [] } = opts;

  const diffReport: DiffReport | undefined =
    deviations.length > 0
      ? {
          deviceFamily: "helix",
          deviationCount: {
            critical: deviations.filter((d) => d.severity === "critical").length,
            warning: deviations.filter((d) => d.severity === "warning").length,
            info: deviations.filter((d) => d.severity === "info").length,
          },
          categoryCount: {
            structure: 0,
            parameter: 0,
            metadata: 0,
            snapshot: 0,
            controller: 0,
            footswitch: 0,
            block: 0,
          },
          passed: deviations.filter((d) => d.severity === "critical").length === 0,
          deviations,
        }
      : undefined;

  return {
    scenarioId: id,
    device: "helix_floor",
    toneStyle: "clean",
    harnessResult: {
      scenarioId: id,
      device: "helix_floor",
      toneStyle: "clean",
      preset: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spec: {} as any,
      fileExtension: ".hlx",
      qualityWarnings: [],
      intentAudit: {
        amp: { requested: "US Deluxe Nrm", matched: intentPassed },
        cab: { requested: "1x12 US Deluxe", matched: intentPassed },
        effects: [],
        tempo: { requested: 120, actual: 120, matched: true },
        delaySubdivision: { requested: null, applied: false },
        snapshots: { requested: 4, actual: 4, matched: intentPassed },
        instrument: { requested: undefined, matched: true },
        warnings: [],
      },
      musicalAudit: {
        warnings: musicalPassed
          ? []
          : [
              {
                code: "GENRE_EFFECT_MISMATCH",
                severity: "warn" as const,
                message: "Metal with chorus",
                rule: "genre-effect",
              },
            ],
        passed: musicalPassed,
      },
    },
    diffReport,
  };
}

function makeFamilyResult(
  family: FamilyAuditResult["family"],
  scenarios: ScenarioAuditResult[],
): FamilyAuditResult {
  const diffSummary = { critical: 0, warning: 0, info: 0 };
  const intentSummary = { passed: 0, failed: 0 };
  const musicalSummary = { passed: 0, failed: 0 };

  for (const s of scenarios) {
    if (s.diffReport) {
      diffSummary.critical += s.diffReport.deviationCount.critical;
      diffSummary.warning += s.diffReport.deviationCount.warning;
      diffSummary.info += s.diffReport.deviationCount.info;
    }
    const hr = s.harnessResult;
    const intentPassed =
      hr.intentAudit.amp.matched &&
      hr.intentAudit.cab.matched &&
      hr.intentAudit.snapshots.matched;
    if (intentPassed) intentSummary.passed++;
    else intentSummary.failed++;

    if (hr.musicalAudit.passed) musicalSummary.passed++;
    else musicalSummary.failed++;
  }

  return {
    family,
    scenarios,
    diffSummary,
    intentSummary,
    musicalSummary,
    schemaCompliance: { totalMissing: 0, details: [] },
    overallPassed:
      diffSummary.critical === 0 &&
      intentSummary.failed === 0 &&
      musicalSummary.failed === 0,
  };
}

function makeAuditResult(families: FamilyAuditResult[]): AuditResult {
  const totalScenarios = families.reduce(
    (sum, f) => sum + f.scenarios.length,
    0,
  );
  return {
    families,
    totalScenarios,
    totalPassed: families.filter((f) => f.overallPassed).length,
    totalFailed: families.filter((f) => !f.overallPassed).length,
    timestamp: "2026-03-09T14:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// getTopIssues
// ---------------------------------------------------------------------------

describe("getTopIssues", () => {
  it("deduplicates and sorts by severity then count", () => {
    const deviations = [
      makeDeviation("data.tone.dsp0.block0.@model", "block", "critical", "Missing amp model"),
      makeDeviation("data.tone.dsp0.block0.@model", "block", "critical", "Missing amp model"),
      makeDeviation("data.tone.dsp0.block1.Gain", "parameter", "warning", "Gain too high"),
      makeDeviation("data.device_version", "metadata", "info", "Version differs"),
      makeDeviation("data.device_version", "metadata", "info", "Version differs"),
      makeDeviation("data.device_version", "metadata", "info", "Version differs"),
    ];

    const s1 = makeScenarioResult("s1", { deviations: deviations.slice(0, 3) });
    const s2 = makeScenarioResult("s2", { deviations: deviations.slice(3) });
    const family = makeFamilyResult("helix", [s1, s2]);

    const issues = getTopIssues(family);

    // Critical first, then warning, then info
    expect(issues[0].severity).toBe("critical");
    expect(issues[0].count).toBe(2);
    expect(issues[1].severity).toBe("warning");
    expect(issues[2].severity).toBe("info");
    expect(issues[2].count).toBe(3);
  });

  it("respects limit parameter", () => {
    const deviations = Array.from({ length: 20 }, (_, i) =>
      makeDeviation(`path.${i}`, "parameter", "warning", `Issue ${i}`),
    );
    const s = makeScenarioResult("s1", { deviations });
    const family = makeFamilyResult("helix", [s]);

    const issues = getTopIssues(family, 5);
    expect(issues.length).toBe(5);
  });

  it("returns empty for family with no diff reports", () => {
    const s = makeScenarioResult("s1");
    const family = makeFamilyResult("helix", [s]);
    expect(getTopIssues(family)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// formatAuditReport
// ---------------------------------------------------------------------------

describe("formatAuditReport", () => {
  it("produces report with all sections for mixed results", () => {
    const s1 = makeScenarioResult("helix-clean", {
      intentPassed: true,
      musicalPassed: true,
      deviations: [
        makeDeviation("data.device_version", "metadata", "info", "Version differs"),
      ],
    });
    const s2 = makeScenarioResult("helix-highgain", {
      intentPassed: false,
      musicalPassed: false,
      deviations: [
        makeDeviation("data.tone.dsp0.block0.@model", "block", "critical", "Amp model mismatch"),
      ],
    });
    const family = makeFamilyResult("helix", [s1, s2]);
    const result = makeAuditResult([family]);

    const report = formatAuditReport(result);

    expect(report).toContain("# Preset Audit Report");
    expect(report).toContain("Generated: 2026-03-09T14:00:00Z");
    expect(report).toContain("helix (2 scenarios) -- FAIL");
    expect(report).toContain("### Deviation Summary");
    expect(report).toContain("### Intent Fidelity: 1/2 passed");
    expect(report).toContain("### Musical Intelligence: 1/2 passed");
    expect(report).toContain("### Top Issues");
    expect(report).toContain("## Overall: FAIL");
  });

  it("produces clean report when all pass", () => {
    const s1 = makeScenarioResult("helix-clean");
    const s2 = makeScenarioResult("helix-blues");
    const family = makeFamilyResult("helix", [s1, s2]);
    const result = makeAuditResult([family]);

    const report = formatAuditReport(result);

    expect(report).toContain("helix (2 scenarios) -- PASS");
    expect(report).toContain("Intent Fidelity: 2/2 passed");
    expect(report).toContain("Musical Intelligence: 2/2 passed");
    expect(report).toContain("## Overall: PASS");
    // No top issues when no diff reports
    expect(report).not.toContain("### Top Issues");
  });
});

// ---------------------------------------------------------------------------
// formatAuditJson
// ---------------------------------------------------------------------------

describe("formatAuditJson", () => {
  it("returns valid serializable object", () => {
    const s = makeScenarioResult("helix-clean");
    const family = makeFamilyResult("helix", [s]);
    const result = makeAuditResult([family]);

    const json = formatAuditJson(result);

    // Should be serializable without errors
    const serialized = JSON.stringify(json);
    expect(serialized).toBeTruthy();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(serialized) as any;
    expect(parsed.timestamp).toBe("2026-03-09T14:00:00Z");
    expect(parsed.totalScenarios).toBe(1);
    expect(parsed.overallPassed).toBe(true);
    expect(parsed.families).toHaveLength(1);
    expect(parsed.families[0].family).toBe("helix");
    expect(parsed.families[0].overallPassed).toBe(true);
  });

  it("includes top issues in JSON output", () => {
    const deviations = [
      makeDeviation("data.tone.dsp0.block0.@model", "block", "critical", "Amp mismatch"),
    ];
    const s = makeScenarioResult("s1", { deviations });
    const family = makeFamilyResult("helix", [s]);
    const result = makeAuditResult([family]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json = formatAuditJson(result) as any;
    expect(json.families[0].topIssues.length).toBeGreaterThan(0);
    expect(json.families[0].topIssues[0].severity).toBe("critical");
  });
});
