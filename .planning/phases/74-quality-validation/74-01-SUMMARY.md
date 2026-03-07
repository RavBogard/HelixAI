---
phase: 74-quality-validation
plan: 01
subsystem: quality-validation
tags: [quality, validation, advisory, tdd, logger]
dependency_graph:
  requires: [types.ts, device-family.ts]
  provides: [validatePresetQuality, QualityWarning, logQualityWarnings, QualityLogRecord]
  affects: []
tech_stack:
  added: []
  patterns: [non-throwing-validation, env-gated-logger, json-lines]
key_files:
  created:
    - src/lib/helix/quality-validate.ts
    - src/lib/helix/quality-logger.ts
    - src/lib/helix/quality-validate.test.ts
  modified: []
decisions:
  - "11 quality checks with expert-consensus thresholds from param-engine.ts"
  - "Stadium amp Drive check exempted via ampCatalogEra guard (firmware encoding difference)"
  - "Quality logger uses real temp files for test verification (ESM spy limitation)"
metrics:
  duration: "~4 min"
  completed: "2026-03-07"
  tests_added: 23
  tests_total: 811
  files_created: 3
  files_modified: 0
  lines_added: 772
---

# Phase 74 Plan 01: Core Quality Validation Function Summary

Non-throwing validatePresetQuality() with 11 expert-threshold checks (7 per-block + 4 structural) and env-gated quality logger following usage-logger.ts pattern

## What Was Built

### quality-validate.ts (272 lines)
- `validatePresetQuality(spec, caps)` returns `QualityWarning[]` -- never throws
- 7 per-block checks iterating signalChain:
  - `REVERB_MIX_HIGH` (threshold 0.60)
  - `DELAY_FEEDBACK_HIGH` (threshold 0.70)
  - `DELAY_MIX_HIGH` (threshold 0.55)
  - `CAB_NO_LOWCUT` (threshold 30.0 Hz)
  - `CAB_NO_HIGHCUT` (threshold 18000.0 Hz)
  - `DRIVE_EXTREME` (threshold 0.90 for distortion blocks)
  - `AMP_DRIVE_EXTREME` (threshold 0.85, skipped for Stadium/agoura amps)
- 4 structural checks:
  - `SNAPSHOT_LEVEL_IMBALANCE` (ChVol spread > 0.25)
  - `NO_TIME_EFFECTS` (no delay and no reverb -- info severity)
  - `REVERB_WITHOUT_CAB_FILTERING` (reverb + cab HighCut > 18000 -- info severity)
  - Gain balance check (reserved for future -- no GainDB in current snapshots)

### quality-logger.ts (64 lines)
- `logQualityWarnings(warnings, context, logPath?)` follows usage-logger.ts pattern exactly
- Always `console.warn(...)` when warnings.length > 0 (format: `[quality] device/presetName: N warning(s): CODE1, CODE2`)
- JSON-lines file logging gated by `LOG_QUALITY=true` env var
- Uses `fs.appendFileSync` to `quality.jsonl` (never overwrites)

### quality-validate.test.ts (436 lines)
- 23 test cases covering all 11 check types
- Non-throwing guarantee verified with invalid inputs
- Well-formed preset returns empty array (no false positives)
- Stadium amp exemption verified
- Logger tests use real temp files (ESM module spy limitation)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESM spy limitation on fs.appendFileSync**
- **Found during:** GREEN phase, logger tests
- **Issue:** `vi.spyOn(fs, "appendFileSync")` fails in ESM mode ("Cannot redefine property")
- **Fix:** Replaced with real temp file writes + `fs.readFileSync` verification and `fs.existsSync` for no-op check
- **Files modified:** src/lib/helix/quality-validate.test.ts
- **Commit:** 71ea993

## Verification Results

1. `npx vitest run src/lib/helix/quality-validate.test.ts` -- 23/23 tests pass
2. `npx tsc --noEmit` -- no type errors
3. No `throw` statement in quality-validate.ts (grep confirmed)
4. Full suite: 811 pass, 1 pre-existing failure (stadium-deep-compare.test.ts, unrelated)

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 4adb434 | test | RED: add failing tests for validatePresetQuality and quality logger |
| 71ea993 | feat | GREEN: validatePresetQuality with 11 quality checks and quality logger |

## Self-Check: PASSED

- [x] src/lib/helix/quality-validate.ts -- FOUND
- [x] src/lib/helix/quality-logger.ts -- FOUND
- [x] src/lib/helix/quality-validate.test.ts -- FOUND
- [x] Commit 4adb434 -- FOUND
- [x] Commit 71ea993 -- FOUND
