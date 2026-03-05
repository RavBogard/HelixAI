---
phase: 42-token-cost-audit-quality-baseline
plan: "02"
subsystem: quality-baseline-and-cache-audit
tags: [audit, baseline, deterministic, cache-analysis, quality-regression]
dependency_graph:
  requires: [42-01]
  provides: [AUDIT-02, AUDIT-03, 36-preset-baseline, cache-hit-report]
  affects: [scripts/]
tech_stack:
  added: [baseline-generator, cache-report]
  patterns: [TDD red-green, deterministic-pipeline, pure-functions, device-adaptive-fixtures]
key_files:
  created:
    - scripts/generate-baseline.ts
    - scripts/generate-baseline.test.ts
    - scripts/cache-hit-report.ts
    - scripts/cache-hit-report.test.ts
  modified:
    - .gitignore
decisions:
  - "Stadium dual-amp uses single-amp Agoura US Clean fallback (dual-amp unsupported on Stadium)"
  - "Single-DSP devices (pod_go/stomp/stomp_xl) use crunch scenario as dual_amp fallback"
  - "Stomp gets 3 snapshots, Stomp XL gets 4, all others get 4 (within device limits)"
  - "Cache report filters to generate-only records (Claude planner calls, not Gemini chat)"
metrics:
  duration: "4 minutes"
  completed: "2026-03-05"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 16
  files_created: 4
  files_modified: 1
---

# Phase 42 Plan 02: 36-Preset Baseline Generator + Cache Hit Report Summary

36-preset deterministic baseline driving the full Knowledge Layer pipeline (assembleSignalChain, resolveParameters, buildSnapshots, validatePresetSpec) with hardcoded ToneIntent fixtures for 6 tone scenarios across 6 devices, plus a cache hit rate analysis script for usage.jsonl data.

## What Was Built

### Task 1: 36-Preset Deterministic Baseline Generator

**`scripts/generate-baseline.ts`** (270 lines)

A fully deterministic baseline generator that produces 36 JSON preset files (6 tones x 6 devices) without any AI or API calls. This baseline becomes the regression reference for all subsequent v4.0 prompt and Knowledge Layer changes.

**Tone scenarios:** clean, crunch, high_gain, ambient, edge_of_breakup, dual_amp

**Devices:** helix_lt, helix_floor, pod_go, helix_stadium, helix_stomp, helix_stomp_xl

**Key design decisions:**
- Stadium devices use Agoura_* amp names from STADIUM_AMPS (e.g., "Agoura US Clean", "Agoura German Xtra Red")
- Dual-amp scenario skipped for pod_go, helix_stomp, helix_stomp_xl, and helix_stadium (single-amp crunch fallback used)
- Snapshot count adapted per device: helix_stomp=3, helix_stomp_xl=4, pod_go=4, others=4
- All amp/cab/effect names verified against AMP_NAMES, CAB_NAMES, EFFECT_NAMES enum values
- Each output file contains: scenario, toneIntent, presetSpec, generatedAt

**Pipeline per fixture:**
```
ToneIntent -> assembleSignalChain(intent, device)
           -> resolveParameters(chain, intent, device)
           -> buildSnapshots(parameterized, intent.snapshots)
           -> validatePresetSpec(presetSpec, device)
```

**`scripts/generate-baseline.test.ts`** (115 lines) - 7 integration tests:
1. Produces exactly 36 JSON files
2. Each file has valid JSON with toneIntent, presetSpec, scenario, generatedAt
3. Each presetSpec has non-empty signalChain and 3-8 snapshots
4. validatePresetSpec passes for all 36 presets
5. Stadium scenarios use Agoura_* amp names
6. Dual-amp for single-DSP devices has no secondAmpName
7. Deterministic: running twice produces identical output

### Task 2: Cache Hit Rate Report

**`scripts/cache-hit-report.ts`** (160 lines)

Pure-function cache analysis script that reads usage.jsonl and computes:
- Cache hit/miss counts and hit rate percentage
- Average input tokens for cold vs cached calls
- Average cost per call for cold vs cached
- Total savings estimate (all-cold baseline minus actual cost)
- Threshold-based recommendation (above/below 50%)

**Key features:**
- `parseCacheReport()` - pure function, no I/O, filters to generate-only records
- `getRecommendation()` - threshold text (>= 50% = OK, < 50% = investigate)
- `formatReport()` - human-readable console output
- CLI entry point with graceful handling of missing file or < 20 records

**`scripts/cache-hit-report.test.ts`** (170 lines) - 9 unit tests:
1. Hit rate computation (14/20 = 70%)
2. Average input tokens for cold/cached separately
3. Average cost for cold/cached separately
4. Total savings calculation
5. Recommendation text above threshold
5b. Recommendation text below threshold
6. Empty records returns zeros
7. Exactly-50% threshold
8. Filters to generate-only records

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx vitest run scripts/generate-baseline.test.ts` -- 7/7 pass
- `npx vitest run scripts/cache-hit-report.test.ts` -- 9/9 pass
- `npx vitest run` -- 170/170 pass (zero regressions)
- `npm run build` -- succeeds
- `ls scripts/baseline/*.json | wc -l` -- 36
- Stadium files all contain Agoura amps (6/6)
- dual_amp-pod_go.json has no secondAmpName

## Commits

| Hash | Message |
|------|---------|
| 6357074 | feat(42-02): add 36-preset deterministic baseline generator |
| 6a9e9e7 | feat(42-02): add cache hit rate report script |

## Self-Check: PASSED

- All 5 files FOUND
- Both commit hashes FOUND (6357074, 6a9e9e7)
