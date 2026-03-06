---
phase: 63-stadium-firmware-parameter-completeness
plan: 02
subsystem: helix-engine
tags: [stadium, firmware-params, pipeline-guard, tests]

requires:
  - phase: 63
    plan: 01
    provides: Full 19-28 key firmware param tables in all 18 STADIUM_AMPS entries
provides:
  - Stadium guard in resolveAmpParams() preventing AMP_DEFAULTS corruption
  - STADIUM_EQ_MODELS merged into MODEL_LOOKUPS for findModel() discovery
  - 10 new STADPARAM-03/04 tests in stadium-builder.test.ts
  - Stadium amp range exemption in validate.ts for raw Hz/dB/integer values
affects: [param-engine, stadium-builder.test, validate]

tech-stack:
  added: []
  patterns: [stadium-guard, corpus-verified-range-exemption]

key-files:
  created: []
  modified:
    - src/lib/helix/param-engine.ts
    - src/lib/helix/stadium-builder.test.ts
    - src/lib/helix/validate.ts

key-decisions:
  - "Stadium guard wraps AMP_DEFAULTS layers 2-3 in if (!stadiumModel) conditional"
  - "STADIUM_EQ_MODELS spread into MODEL_LOOKUPS.eq for findModel() discovery"
  - "validate.ts exempts Stadium amp blocks from 0-1 range check (raw Hz/dB/integer values)"
  - "validateAndFixPresetSpec() also exempts Stadium amps from param clamping"
  - "US Double Black has 28 params (not 27 as plan estimated) — 14 universal + 6 standard + 8 voice"

patterns-established:
  - "stadium-guard: Check STADIUM_AMPS[modelName] to bifurcate Stadium vs HD2 param resolution"
  - "corpus-verified-range-exemption: Skip normalized 0-1 range validation for corpus-verified firmware param tables"

requirements-completed: [STADPARAM-03, STADPARAM-04]

duration: 15min
completed: 2026-03-06
---

# Plan 63-02: Stadium Guard + Pipeline Wiring + Tests Summary

**Added Stadium guard in resolveAmpParams() to prevent AMP_DEFAULTS corruption; 10 new tests verify param completeness; validate.ts exempts Stadium amp firmware params from 0-1 range check**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 3, **Files created:** 0

## Accomplishments
- Stadium guard in resolveAmpParams() skips AMP_DEFAULTS layers 2-3 for Agoura amps
- STADIUM_EQ_MODELS merged into MODEL_LOOKUPS.eq for findModel() discovery
- 10 new tests covering STADPARAM-03 (param counts, hidden params, no ChVol, boolean preservation, range) and STADPARAM-04 (effect block params)
- HD2 regression tests confirm AMP_DEFAULTS still applied for non-Stadium amps (ChVol, Sag present)
- validate.ts exempts Stadium amp blocks from 0-1 range check in both strict and auto-fix validators
- Full test suite: 327 tests pass, zero failures

## Task Commits

1. **Task 1: Stadium guard in resolveAmpParams() + MODEL_LOOKUPS fix** - `cd4d734` (feat)
2. **Task 2: STADPARAM-03/04 tests + validate.ts Stadium exemption** - `056dbe0` (feat)

## Files Modified
- `src/lib/helix/param-engine.ts` - Stadium guard in resolveAmpParams(), STADIUM_EQ_MODELS merged into MODEL_LOOKUPS
- `src/lib/helix/stadium-builder.test.ts` - 10 new tests: 6 STADPARAM-03 + 1 STADPARAM-04 + 2 HD2 regression + helpers
- `src/lib/helix/validate.ts` - Import STADIUM_AMPS; exempt Stadium amp blocks from 0-1 range check and param clamping

## Decisions Made
- Stadium guard pattern: `if (!stadiumModel)` wraps layers 2-3, keeping Layer 4 (paramOverrides) universal
- US Double Black actual count is 28 params (plan estimated 27) — adjusted test expectations accordingly
- validate.ts exemption applies to entire amp block when STADIUM_AMPS[modelName] exists, not per-param

## Deviations from Plan
- US Double Black param count: plan said 27, actual is 28 (14 universal + 6 standard + 8 voice, Presence absent)
- validate.ts modification not in original plan — discovered during integration testing when generate-baseline.test.ts failed on AmpCabPeak2Fc: 1000

## Issues Encountered
- generate-baseline.test.ts failed because validate.ts line 134 rejected AmpCabPeak2Fc: 1000 (exceeds 0-1 range). Fixed by adding Stadium amp exemption.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 63 complete: all 4 requirements (STADPARAM-01 through STADPARAM-04) satisfied
- All 18 Stadium amps have full firmware param tables flowing through the pipeline
- Zero TypeScript errors, 327 tests pass

---
*Phase: 63-stadium-firmware-parameter-completeness*
*Completed: 2026-03-06*
