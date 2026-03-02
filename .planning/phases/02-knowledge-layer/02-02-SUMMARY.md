---
phase: 02-knowledge-layer
plan: 02
subsystem: knowledge-layer
tags: [helix, param-engine, amp-defaults, cab-filtering, topology, eq, boost, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: HelixModel database with ampCategory, topology, defaultParams; BlockSpec/ToneIntent types; param-registry
provides:
  - resolveParameters() function for deterministic parameter resolution
  - Expert-consensus lookup tables for all 3 amp categories
  - Topology-aware mid adjustment for high-gain amps
  - Category-specific cab filtering (Hz LowCut/HighCut, Mic index)
  - Post-cab Parametric EQ with anti-mud cut and presence recovery
  - Boost parameter tables (Minotaur with correct Gain/Treble/Output names, Scream 808)
  - Horizon Gate and Gain Block parameter resolution
affects: [02-knowledge-layer, 03-preset-pipeline, snapshot-engine]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [deterministic-lookup-tables, 3-layer-param-resolution, immutable-transforms, tdd]

key-files:
  created:
    - src/lib/helix/param-engine.ts
    - src/lib/helix/param-engine.test.ts
  modified:
    - src/lib/helix/index.ts

key-decisions:
  - "Clean EQ LowGain at unity (0.50) not cut -- clean amps need no mud removal; crunch/high-gain get actual cuts"
  - "No cathode_follower high-gain amps exist in database -- topology mid override tested via plate_fed path and verified clean cathode_follower is not overridden"
  - "Installed vitest as test framework for TDD workflow (first test infrastructure in project)"

patterns-established:
  - "3-layer amp parameter resolution: model defaults -> category overrides -> topology adjustment"
  - "Immutable transform pattern: resolveParameters returns new BlockSpec array, never mutates input"
  - "Model-specific parameter tables as module-level const objects (not exported)"

requirements-completed: [TONE-01, TONE-02, TONE-03, TONE-04, TONE-05, TONE-06, DYN-01, DYN-02, DYN-03]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 2 Plan 02: Param Engine Summary

**Deterministic parameter resolution with expert-consensus lookup tables for all amp categories, cab filtering, post-cab EQ, and boost architecture**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T00:39:20Z
- **Completed:** 2026-03-02T00:43:42Z
- **Tasks:** 1 (TDD: RED -> GREEN)
- **Files modified:** 3

## Accomplishments
- Built `resolveParameters()` with 3-layer amp parameter strategy: model defaults, category overrides, topology-specific mid adjustment
- All 3 amp categories have distinct expert-backed defaults (clean: high Master/low Drive for cleanup; high-gain: tight SAG for palm-mute clarity)
- Cab blocks get Hz-encoded LowCut/HighCut (not normalized) with correct Mic index per category (121 Ribbon for clean, 57 Dynamic for high-gain)
- Post-cab Parametric EQ tables implement anti-mud cut (LowGain < 0.50) and presence recovery (HighGain > 0.50) per category
- Minotaur boost uses correct Gain/Treble/Output parameter names (avoiding the Drive/Tone naming trap)
- AI-added effects (delay, reverb, modulation) fall through to model defaultParams from the database
- 16/16 tests pass, TypeScript compiles with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests for resolveParameters** - `5a0aa95` (test)
2. **Task 1 (TDD GREEN): Implement param-engine + pass all tests** - `ca14195` (feat)

_TDD task: RED commit has 15 failing tests, GREEN commit has implementation + updated test + barrel export_

## Files Created/Modified
- `src/lib/helix/param-engine.ts` - Parameter resolution module with expert lookup tables and resolveParameters() function (249 lines)
- `src/lib/helix/param-engine.test.ts` - 16 tests covering all categories, topology, cab Hz encoding, EQ, boost names, gate, gain block, immutability
- `src/lib/helix/index.ts` - Added barrel export for resolveParameters

## Decisions Made
- Clean EQ LowGain set to exactly 0.50 (unity) per RESEARCH.md: clean amps produce no mud, so no cut needed. Only crunch (0.45) and high-gain (0.42) get actual mud cuts.
- No cathode_follower high-gain amps exist in the real Helix model database (all cathode_follower amps are Vox/Matchless clean/crunch). The topology mid override code is implemented and will apply correctly when/if such a model is added. Test coverage verifies plate_fed high-gain path and confirms clean cathode_follower amps are NOT affected.
- Installed vitest (v4.0.18) as the project's test framework for TDD, since no test runner existed previously.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest test framework**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** No test framework installed in project; TDD requires a test runner
- **Fix:** `npm install --save-dev vitest`
- **Files modified:** package.json, package-lock.json (not committed as task file -- vitest is a dev dependency)
- **Verification:** `npx vitest run` works correctly
- **Committed in:** Part of test commit

**2. [Rule 1 - Bug] Fixed Test 4 amp model assumption**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Test assumed ANGL Meteor is cathode_follower high-gain, but it is actually plate_fed in the database. No cathode_follower high-gain amps exist.
- **Fix:** Rewrote Test 4 to verify plate_fed high-gain mid (0.55-0.65) with two real amps, added Test 4b verifying clean cathode_follower amps are NOT overridden
- **Files modified:** src/lib/helix/param-engine.test.ts
- **Verification:** Both test 4 and 4b pass

**3. [Rule 1 - Bug] Fixed Test 7 clean EQ assertion**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test expected clean EQ LowGain < 0.50, but RESEARCH.md specifies 0.50 (unity, no cut) for clean
- **Fix:** Updated test to use `toBeLessThanOrEqual(0.50)` for clean, kept strict `toBeLessThan(0.50)` for crunch/high-gain
- **Files modified:** src/lib/helix/param-engine.test.ts
- **Verification:** All 16 tests pass

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Tests now accurately reflect RESEARCH.md data.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- param-engine.ts is complete and ready for integration into the preset pipeline
- resolveParameters() takes BlockSpec[] from assembleSignalChain() and fills all parameters
- Next: snapshot-engine.ts (Plan 02-03) will consume the parameterized chain to generate volume-balanced snapshots

---
*Phase: 02-knowledge-layer*
*Completed: 2026-03-02*
