---
phase: 12-full-audit-run
plan: 01
subsystem: testing
tags: [audit-orchestrator, report-formatter, compliance-pipeline, gold-standard]

requires:
  - phase: 08-mock-chat-harness
    provides: runAllScenarios(), HarnessResult, MockScenario
  - phase: 09-structural-diff-engine
    provides: diffPresets(), DiffReport, Deviation types
  - phase: 10-intent-musical-validation
    provides: IntentAudit, MusicalAudit (already embedded in HarnessResult)
  - phase: 11-reference-corpus-extraction
    provides: loadCorpus(), extractFamilySchema(), FamilySchema
provides:
  - Full audit orchestrator (runAudit) connecting all Phase 8-11 infrastructure
  - Structured markdown report formatter (formatAuditReport)
  - JSON report formatter (formatAuditJson)
  - Schema compliance checker (checkSchemaCompliance)
  - Top issues extractor (getTopIssues)
affects: [13-fix-deviations, 14-regression-suite-integration]

tech-stack:
  added: []
  patterns: [orchestrator pattern connecting independent modules, per-family aggregation]

key-files:
  created:
    - src/lib/helix/audit-runner.ts
    - src/lib/helix/audit-runner.test.ts
    - src/lib/helix/audit-report.ts
    - src/lib/helix/audit-report.test.ts

key-decisions:
  - "Diff against first reference preset per family (not all — avoids combinatorial explosion)"
  - "Intent pass = amp matched AND cab matched AND snapshots matched (no error)"
  - "overallPassed = zero critical deviations AND zero intent failures AND zero musical failures"

patterns-established:
  - "Audit orchestrator is sync (all underlying modules are sync)"
  - "Report formatters separate from orchestrator for testability"
  - "TopIssue deduplication by path+category key"

duration: ~8min
completed: 2026-03-09
---

# Phase 12 Plan 01: Full Audit Run & Reports Summary

**Audit orchestrator and report formatter — connects mock harness, structural diff, intent/musical validation, and reference corpus into a single runAudit() pipeline producing per-family compliance reports.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~8min |
| Completed | 2026-03-09 |
| Tasks | 2 completed |
| Files created | 4 |
| Tests added | 15 (8 runner + 7 report) |
| Total tests | 1421 passing |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Audit Orchestrator Runs Full Pipeline | Pass | runAudit() generates presets, loads corpus, diffs, validates, aggregates per family |
| AC-2: Per-Family Results Include All Validation Layers | Pass | ScenarioAuditResult contains diffReport, schemaCompliance, intentAudit, musicalAudit |
| AC-3: Structured Report Generation | Pass | formatAuditReport() produces markdown with deviation summary, intent, musical, top issues sections |
| AC-4: Graceful Handling of Missing References | Pass | Missing corpus files don't error; families without references skip diff/schema checks |

## Accomplishments

- runAudit() orchestrates the complete pipeline: 25 scenarios → grouped by 4 families → per-scenario diff + schema compliance + intent/musical audit → aggregated FamilyAuditResult
- formatAuditReport() produces structured markdown with category deviation tables, intent/musical summaries, and deduplicated top issues
- formatAuditJson() produces serializable JSON for programmatic consumption
- checkSchemaCompliance() compares generated preset top-level keys against FamilySchema required/common keys

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/audit-runner.ts` | Created | Orchestrator: runAudit(), groupByFamily(), checkSchemaCompliance() |
| `src/lib/helix/audit-runner.test.ts` | Created | 8 tests: grouping, schema compliance, full pipeline, missing corpus |
| `src/lib/helix/audit-report.ts` | Created | Report formatters: formatAuditReport(), formatAuditJson(), getTopIssues() |
| `src/lib/helix/audit-report.test.ts` | Created | 7 tests: top issues dedup/sort, markdown sections, JSON serialization |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Diff against first reference per family | Avoids N×M comparison explosion; single reference is representative enough for structural validation | Phase 13 can expand to multi-reference comparison if needed |
| Intent pass criteria: amp + cab + snapshots matched | These are the core "did we build what was asked" checks; effects/tempo are secondary | Aligns with existing IntentAudit fields |
| overallPassed aggregation logic | Critical deviations OR intent failures OR musical failures = FAIL | Conservative — any structural issue fails the family |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- runAudit() can be called with real corpus config paths to produce complete audit reports
- Reports structure directly feeds Phase 13 (Fix Deviations) — top issues identify what to fix first
- Phase 14 can wrap runAudit() + assertions into vitest for regression suite

**Concerns:**
- Diff against single reference preset may miss family-wide structural variations
- HX Stomp has only 2 reference presets (limited schema consensus)

**Blockers:**
- None

---
*Phase: 12-full-audit-run, Plan: 01*
*Completed: 2026-03-09*
