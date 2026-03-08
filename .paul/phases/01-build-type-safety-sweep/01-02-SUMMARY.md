---
phase: 01-build-type-safety-sweep
plan: 02
subsystem: api
tags: [prompt-engineering, data-integrity, amp-models, validation, vitest]

requires:
  - phase: 01-build-type-safety-sweep/01-01
    provides: Clean tsc build (npm install restored module types)
provides:
  - All prompt amp names validated against canonical AMP_MODELS catalog
  - Data integrity tests preventing future amp name drift
affects: [planner output quality, ToneIntent validation success rate]

tech-stack:
  added: []
  patterns: [data integrity test pattern for prompt amp-cab pairings]

key-files:
  created: []
  modified:
    - src/lib/families/helix/prompt.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/helix/prompt.test.ts
    - src/lib/families/podgo/prompt.test.ts
    - src/lib/families/stomp/prompt.test.ts

key-decisions:
  - "Audit overcounted: 7 invalid names, not 12 — A30 Fawn Nrm/Brt are valid catalog entries"
  - "PV 5150 replaced with PV Panama (closest valid high-gain 5150-style model)"
  - "Cali IV Rhythm 1/2 removed entirely (no Mesa Rhythm models in catalog)"
  - "Data integrity tests use AMP_MODELS keys, not getAllModels() filter — category field stores amp type (clean/crunch/high_gain), not literal 'amp'"

patterns-established:
  - "Prompt amp-cab pairing constants exported for testability"
  - "Data integrity test pattern: validate pairing arrays against AMP_MODELS keys"

duration: 8min
started: 2026-03-08T00:00:00Z
completed: 2026-03-08T00:08:00Z
---

# Phase 1 Plan 02: Fix Invalid Amp Names in Prompts Summary

**Fixed 7 invalid amp names across 3 device family prompt files and added data integrity tests to prevent future drift.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~8 min |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 2 completed |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: All Prompt Amp Names Exist in Catalog | Pass | grep for invalid names returns 0 matches |
| AC-2: Data Integrity Tests Pass | Pass | 69/69 tests pass (66 existing + 3 new) |
| AC-3: No Functional Regressions | Pass | tsc --noEmit exits 0, all tests pass |

## Accomplishments

- Fixed 7 invalid amp names: "Brit 2204" → "Line 6 2204 Mod", "Brit J-45" → "Brit J45" (no hyphen), "Cali IV Rhythm 1/2" removed, "PV 5150" → "PV Panama"
- Corrected audit: only 7 of 12 reported issues were actual bugs (A30 Fawn Nrm/Brt and Derailed Ingrid are valid)
- Exported AMP_CAB_PAIRINGS constants from all 3 prompt files for testability
- Added data integrity tests to helix, podgo, and stomp prompt test files

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/families/helix/prompt.ts` | Modified | Fixed 5 amp names, exported HELIX_AMP_CAB_PAIRINGS |
| `src/lib/families/podgo/prompt.ts` | Modified | Fixed 2 amp names, exported PODGO_AMP_CAB_PAIRINGS |
| `src/lib/families/stomp/prompt.ts` | Modified | Fixed 2 amp names, exported STOMP_AMP_CAB_PAIRINGS |
| `src/lib/families/helix/prompt.test.ts` | Modified | Added data integrity test |
| `src/lib/families/podgo/prompt.test.ts` | Modified | Added data integrity test |
| `src/lib/families/stomp/prompt.test.ts` | Modified | Added data integrity test |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Use AMP_MODELS keys for validation, not getAllModels() filter | `category` field stores amp type (clean/crunch/high_gain), not literal "amp" | Tests correctly validate against canonical amp catalog |
| PV 5150 → PV Panama | Only PV-prefixed amp in catalog; PV Panama is the 5150-style model | Correct Peavey 5150 recommendation for high-gain contexts |
| Remove Cali IV Rhythm 1/2 (don't substitute) | No Mesa Rhythm models exist; Cali Rectifire and Cali IV Lead cover the Mesa category | Smaller but accurate recommendation set |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Test approach corrected during execution |

**Total impact:** Minor test implementation fix, no scope change.

### Auto-fixed Issues

**1. Data integrity test filter logic**
- **Found during:** Task 2 (initial test run)
- **Issue:** Plan specified `getAllModels().filter(m => m.category === "amp")` but `category` stores amp tone type (clean/crunch/high_gain), not model type
- **Fix:** Used `Object.keys(AMP_MODELS)` directly instead
- **Verification:** All 69 tests pass

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- All prompt amp names now validated against catalog
- Data integrity tests will catch future drift
- Build still clean (tsc passes)

**Remaining in Phase 1:**
- Plan 03 needed: Migrate planner from Claude Sonnet to Gemini 3 Flash

**Blockers:**
- None

---
*Phase: 01-build-type-safety-sweep, Plan: 02*
*Completed: 2026-03-08*
