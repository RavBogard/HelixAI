---
phase: 74-quality-validation
plan: 02
subsystem: quality-validation
tags: [quality, pipeline, baseline, integration, scripts]
dependency_graph:
  requires: [quality-validate.ts, quality-logger.ts, chain-rules.ts, param-engine.ts, snapshot-engine.ts, device-family.ts]
  provides: [pipeline-integration, baseline-generator, baseline-compare]
  affects: [generate/route.ts]
tech_stack:
  added: []
  patterns: [advisory-validation-pipeline, deterministic-baseline, regression-detection]
key_files:
  created:
    - scripts/baseline-generator.ts
    - scripts/baseline-compare.ts
  modified:
    - src/app/api/generate/route.ts
    - src/lib/helix/index.ts
decisions:
  - "Quality warnings are server-side only -- never included in API response JSON"
  - "logQualityWarnings imported directly from quality-logger.ts, not through barrel (lean barrel)"
  - "validatePresetQuality imported through barrel for consistency with other pipeline functions"
  - "Baseline generator uses Brit Plexi Nrm instead of plan's invalid Brit 2204 amp name"
metrics:
  duration: "~5 min"
  completed: "2026-03-07"
  tests_added: 0
  tests_total: 811
  files_created: 2
  files_modified: 2
  lines_added: 652
requirements: [QUAL-02, QUAL-03]
---

# Phase 74 Plan 02: Pipeline Integration + Baseline Generator Summary

Quality validation wired into generate pipeline at Step 4.5 (advisory, never blocks) with 36-preset deterministic baseline generator and regression comparison script

## What Was Built

### Pipeline Integration (route.ts + index.ts)
- Added `validatePresetQuality` and `logQualityWarnings` barrel exports to `src/lib/helix/index.ts`
- Added `QualityWarning` and `QualityLogRecord` type exports for downstream consumers
- Inserted Step 4.5 in `src/app/api/generate/route.ts` between structural validation (Step 4) and file build (Step 5)
- Quality warnings logged via `logQualityWarnings()` when `warnings.length > 0`
- Warnings are **server-side only** -- never included in NextResponse.json() payload
- No try/catch needed -- `validatePresetQuality()` is already non-throwing by design (Plan 01)

### baseline-generator.ts (310 lines)
- Deterministic 36-preset quality baseline: 6 devices x 6 genres
- Devices: helix_lt, helix_floor, helix_stomp, helix_stomp_xl, pod_go, helix_stadium
- Genres: blues, rock, metal, jazz, ambient, country
- Fixed ToneIntent fixtures per genre with correct amp/cab/effect model names
- Stadium devices use Agoura amp names via `ampCatalogEra` guard (`buildGenreIntent()` helper)
- Per-combo try/catch ensures partial failures don't block the full run
- Output format: `BaselineOutput` with results array + summary (byDevice, byGenre, byCode)
- Run with: `npx tsx scripts/baseline-generator.ts [output-path.json]`

### baseline-compare.ts (150 lines)
- Compares two baseline JSON files and reports regression status
- Reports: total delta, per-device delta, per-genre delta, new/removed warning codes, changed combinations
- Exit code 0 if warnings decreased or stayed same (improvement or no change)
- Exit code 1 if warnings increased (regression detected)
- Run with: `npx tsx scripts/baseline-compare.ts before.json after.json`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid amp name "Brit 2204" in rock genre fixture**
- **Found during:** Task 2 initial run
- **Issue:** Plan specified `ampName: "Brit 2204"` but no such amp exists in the HD2 catalog. Zod schema validation rejected it.
- **Fix:** Changed to `"Brit Plexi Nrm"` (valid Marshall Plexi model from AMP_MODELS)
- **Files modified:** scripts/baseline-generator.ts
- **Commit:** 59fc324

## Verification Results

1. `npx tsc --noEmit` -- no type errors (clean compile)
2. `npx vitest run src/lib/helix/quality-validate.test.ts` -- 23/23 tests pass (Plan 01 tests unaffected)
3. `npx vitest run` -- 811 pass, 1 pre-existing failure (stadium-deep-compare.test.ts, unrelated)
4. `npx tsx scripts/baseline-generator.ts` -- produces baseline.json with 36 results (0 warnings for expert-consensus defaults)
5. `npx tsx scripts/baseline-compare.ts` -- correctly detects regressions (exit 1) and improvements (exit 0)
6. Grep route.ts for `validatePresetQuality` -- confirmed at line 116 (Step 4.5)
7. Grep route.ts for `qualityWarnings` NOT in response JSON -- confirmed server-side only

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| 2f18cb7 | feat | Wire quality validation into generate pipeline at Step 4.5 |
| 59fc324 | feat | Add quality baseline generator and comparison scripts |

## Self-Check: PASSED

- [x] scripts/baseline-generator.ts -- FOUND
- [x] scripts/baseline-compare.ts -- FOUND
- [x] src/app/api/generate/route.ts -- FOUND (modified)
- [x] src/lib/helix/index.ts -- FOUND (modified)
- [x] Commit 2f18cb7 -- FOUND
- [x] Commit 59fc324 -- FOUND
