---
phase: 56-per-model-amp-overrides
plan: 01
subsystem: audio-engine
tags: [typescript, param-engine, amp-models, tdd, vitest]

# Dependency graph
requires:
  - phase: 55-planner-prompt-enrichment
    provides: enriched planner prompt with gain-staging intelligence
provides:
  - AmpFamily type literal union (16 families) exported from types.ts
  - HelixModel interface with ampFamily and paramOverrides fields
  - Layer 4 override loop in resolveAmpParams() applying model?.paramOverrides after Layer 3
  - Unit test proving Drive:0.99 canary survives AMP_DEFAULTS.clean.Drive:0.25
  - Regression test confirming amps without paramOverrides still use category defaults
affects:
  - 56-02 (Plan 02 fills paramOverrides values for 15+ amps — depends on this pipe)
  - param-engine.ts consumers (all 6 device paths use resolveAmpParams())

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Layer 4 paramOverrides loop in resolveAmpParams() — placed after Layer 3 (topology mid), uses model?.paramOverrides optional chaining for null-safety"
    - "Canary value pattern — paramOverrides: { Drive: 0.99 } on US Deluxe Nrm proves mechanism without real values; Plan 02 replaces with Drive: 0.60, Master: 1.0"

key-files:
  created: []
  modified:
    - src/lib/helix/types.ts
    - src/lib/helix/models.ts
    - src/lib/helix/param-engine.ts
    - src/lib/helix/param-engine.test.ts

key-decisions:
  - "Canary value Drive:0.99 on US Deluxe Nrm chosen as proof-of-concept — obviously not a real setting, makes Layer 4 survival test unambiguous; Plan 02 replaces with real values"
  - "Test 1 updated to use Solo Lead Clean (Soldano SLO-100 clean) instead of US Deluxe Nrm — Solo Lead Clean has no planned paramOverrides so it cleanly demonstrates category-default behavior"
  - "AmpFamily type added to types.ts (not inline in models.ts) to follow existing AmpCategory/TopologyTag convention for shared type exports"

patterns-established:
  - "Layer 4 paramOverrides: After topology mid override, apply model?.paramOverrides loop — identical structure to Layer 2 but unconditional and model-specific"

requirements-completed: [AMP-02]

# Metrics
duration: 15min
completed: 2026-03-05
---

# Phase 56 Plan 01: Per-Model Amp Overrides Foundation Summary

**Layer 4 paramOverrides mechanism established in resolveAmpParams() with AmpFamily type, extended HelixModel interface, and unit-tested via Drive:0.99 canary surviving clean category default 0.25**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-05T19:13:00Z
- **Completed:** 2026-03-05T19:16:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `AmpFamily` type literal union (16 families: Fender, Marshall, Vox, Mesa, Matchless, Hiwatt, Soldano, Friedman, Diezel, Bogner, EVH, PRS, ENGL, Revv, Grammatico, Line6) to `types.ts`
- Extended `HelixModel` interface with `ampFamily?: AmpFamily` and `paramOverrides?: Record<string, number>` fields
- Added Layer 4 override loop to `resolveAmpParams()` using null-safe `model?.paramOverrides` access — runs after Layer 3 (topology mid) so per-model values win unconditionally
- Proved the mechanism works via canary: US Deluxe Nrm `paramOverrides: { Drive: 0.99 }` produces `Drive: 0.99` in output, NOT the clean category default of 0.25
- Updated Test 1 to use Solo Lead Clean (Soldano SLO-100 clean — no planned overrides) to avoid conflict with US Deluxe Nrm canary
- All 197 tests pass (18 param-engine + 179 rest of suite)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add AmpFamily type and extend HelixModel interface** - `6be40c8` (feat)
2. **Task 2: Add Layer 4 override loop and write survival unit test** - `eaddb4e` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks — Task 2 followed RED (tests written, failing) then GREEN (implementation, all pass) pattern_

## Files Created/Modified

- `src/lib/helix/types.ts` - Added `AmpFamily` type literal union after `TopologyTag`
- `src/lib/helix/models.ts` - Added `AmpFamily` to import; added `ampFamily?` and `paramOverrides?` fields to `HelixModel` interface; added canary `paramOverrides: { Drive: 0.99 }` to US Deluxe Nrm
- `src/lib/helix/param-engine.ts` - Added Layer 4 loop after Layer 3 in `resolveAmpParams()` using `model?.paramOverrides`
- `src/lib/helix/param-engine.test.ts` - Updated Test 1 to Solo Lead Clean; added Layer 4 survival test and no-regression test

## Decisions Made

- **Canary value 0.99:** Used `paramOverrides: { Drive: 0.99 }` on US Deluxe Nrm as a deliberately obvious canary value — 0.99 is not a real clean amp Drive setting, making the test assertion unambiguous. Plan 02 will replace with `Drive: 0.60, Master: 1.0`.
- **Test 1 replacement:** Switched from US Deluxe Nrm to Solo Lead Clean for the generic clean category test. Solo Lead Clean (Soldano SLO-100 clean channel) is not in the 18-amp override list in RESEARCH.md, so it will continue demonstrating pure category-default behavior after Plan 02.
- **AmpFamily in types.ts:** Added alongside `AmpCategory` and `TopologyTag` per project convention. Not placed inline in `models.ts` because type exports belong in `types.ts` for shared access.

## Deviations from Plan

None — plan executed exactly as written. All steps followed TDD RED/GREEN sequence as specified. Test 1 update was explicitly called out in the plan action as required before adding canary.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Layer 4 mechanism is established and unit-tested — Plan 02 (56-02) can now safely add `paramOverrides` values to 15+ amp model entries without risk of them being silently discarded
- US Deluxe Nrm canary value `Drive: 0.99` must be replaced with real value `Drive: 0.60, Master: 1.0` in Plan 02
- `ampFamily` field is defined in the interface — Plan 02 populates it on overridden amps
- Full suite at 197 tests (was 195 after Phase 55) — 2 new Layer 4 tests added

---
*Phase: 56-per-model-amp-overrides*
*Completed: 2026-03-05*
