// audit-report.ts — Structured report formatter for audit results.
// Produces markdown and JSON reports from AuditResult objects.
// Designed for Phase 13 (Fix Deviations) consumption.

import type {
  AuditResult,
  FamilyAuditResult,
  ScenarioAuditResult,
} from "./audit-runner";
import type { DeviationCategory, DeviationSeverity } from "./structural-diff";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopIssue {
  path: string;
  category: string;
  severity: string;
  count: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Top issues extraction
// ---------------------------------------------------------------------------

/**
 * Extract the most frequent/severe deviations across all scenarios in a family.
 * Groups identical deviations (same path + category), counts occurrences,
 * sorts by severity desc then count desc.
 */
export function getTopIssues(
  family: FamilyAuditResult,
  limit = 10,
): TopIssue[] {
  const issueMap = new Map<string, TopIssue>();

  for (const scenario of family.scenarios) {
    if (!scenario.diffReport) continue;

    for (const dev of scenario.diffReport.deviations) {
      const key = `${dev.path}::${dev.category}`;
      if (issueMap.has(key)) {
        issueMap.get(key)!.count++;
      } else {
        issueMap.set(key, {
          path: dev.path,
          category: dev.category,
          severity: dev.severity,
          count: 1,
          message: dev.message,
        });
      }
    }
  }

  const severityOrder: Record<string, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };

  const sorted = [...issueMap.values()].sort(
    (a, b) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3) ||
      b.count - a.count,
  );

  return sorted.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Markdown report formatter
// ---------------------------------------------------------------------------

/**
 * Produce a structured markdown report from audit results.
 */
export function formatAuditReport(result: AuditResult): string {
  const lines: string[] = [];

  lines.push("# Preset Audit Report");
  lines.push(`Generated: ${result.timestamp}`);
  lines.push(
    `Total: ${result.totalScenarios} scenarios | ${result.totalPassed} families passed | ${result.totalFailed} families failed`,
  );
  lines.push("");

  for (const family of result.families) {
    const status = family.overallPassed ? "PASS" : "FAIL";
    lines.push(
      `## ${family.family} (${family.scenarios.length} scenarios) -- ${status}`,
    );
    lines.push("");

    // Deviation summary
    if (family.scenarios.some((s) => s.diffReport)) {
      lines.push("### Deviation Summary");
      lines.push("");
      lines.push("| Category | Critical | Warning | Info |");
      lines.push("|----------|----------|---------|------|");

      // Aggregate by category across all scenarios
      const catCounts: Record<string, { critical: number; warning: number; info: number }> = {};
      for (const s of family.scenarios) {
        if (!s.diffReport) continue;
        for (const dev of s.diffReport.deviations) {
          if (!catCounts[dev.category]) {
            catCounts[dev.category] = { critical: 0, warning: 0, info: 0 };
          }
          catCounts[dev.category][dev.severity]++;
        }
      }

      for (const [cat, counts] of Object.entries(catCounts)) {
        lines.push(
          `| ${cat} | ${counts.critical} | ${counts.warning} | ${counts.info} |`,
        );
      }
      lines.push("");
    }

    // Schema compliance
    if (family.schemaCompliance.details.length > 0) {
      lines.push("### Schema Compliance");
      lines.push(`Missing required keys: ${family.schemaCompliance.totalMissing}`);
      if (family.schemaCompliance.totalMissing > 0) {
        const allMissing = new Set<string>();
        for (const detail of family.schemaCompliance.details) {
          for (const k of detail.missingRequiredKeys) allMissing.add(k);
        }
        for (const k of allMissing) {
          lines.push(`- ${k}`);
        }
      }
      lines.push("");
    }

    // Intent fidelity
    const { intentSummary } = family;
    const intentTotal = intentSummary.passed + intentSummary.failed;
    lines.push(
      `### Intent Fidelity: ${intentSummary.passed}/${intentTotal} passed`,
    );
    if (intentSummary.failed > 0) {
      for (const s of family.scenarios) {
        const hr = s.harnessResult;
        const intentPassed =
          !hr.error &&
          hr.intentAudit.amp.matched &&
          hr.intentAudit.cab.matched &&
          hr.intentAudit.snapshots.matched;
        if (!intentPassed) {
          const reasons: string[] = [];
          if (hr.error) reasons.push(`error: ${hr.error}`);
          if (!hr.intentAudit.amp.matched) reasons.push("amp mismatch");
          if (!hr.intentAudit.cab.matched) reasons.push("cab mismatch");
          if (!hr.intentAudit.snapshots.matched) reasons.push("snapshot count mismatch");
          lines.push(`- ${s.scenarioId}: ${reasons.join(", ")}`);
        }
      }
    }
    lines.push("");

    // Musical intelligence
    const { musicalSummary } = family;
    const musicalTotal = musicalSummary.passed + musicalSummary.failed;
    lines.push(
      `### Musical Intelligence: ${musicalSummary.passed}/${musicalTotal} passed`,
    );
    if (musicalSummary.failed > 0) {
      for (const s of family.scenarios) {
        if (!s.harnessResult.musicalAudit.passed) {
          const warnings = s.harnessResult.musicalAudit.warnings
            .filter((w) => w.severity === "warn")
            .map((w) => w.message)
            .join("; ");
          lines.push(`- ${s.scenarioId}: ${warnings}`);
        }
      }
    }
    lines.push("");

    // Top issues
    const topIssues = getTopIssues(family);
    if (topIssues.length > 0) {
      lines.push("### Top Issues");
      for (let i = 0; i < topIssues.length; i++) {
        const issue = topIssues[i];
        lines.push(
          `${i + 1}. [${issue.severity}] ${issue.path} (${issue.category}, ${issue.count}x): ${issue.message}`,
        );
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Overall
  const overallStatus =
    result.totalFailed === 0 ? "PASS" : "FAIL";
  lines.push(`## Overall: ${overallStatus}`);

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// JSON report formatter
// ---------------------------------------------------------------------------

/**
 * Return a JSON-serializable summary of audit results.
 */
export function formatAuditJson(result: AuditResult): object {
  return {
    timestamp: result.timestamp,
    totalScenarios: result.totalScenarios,
    totalFamiliesPassed: result.totalPassed,
    totalFamiliesFailed: result.totalFailed,
    overallPassed: result.totalFailed === 0,
    families: result.families.map((f) => ({
      family: f.family,
      scenarioCount: f.scenarios.length,
      overallPassed: f.overallPassed,
      diffSummary: f.diffSummary,
      intentSummary: f.intentSummary,
      musicalSummary: f.musicalSummary,
      schemaCompliance: {
        totalMissing: f.schemaCompliance.totalMissing,
      },
      topIssues: getTopIssues(f, 10),
    })),
  };
}
