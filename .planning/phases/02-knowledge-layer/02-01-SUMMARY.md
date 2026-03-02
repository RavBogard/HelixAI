---
phase: 02-knowledge-layer
plan: 01
subsystem: helix-knowledge
tags: [signal-chain, dsp-assignment, block-ordering, tone-intent, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "BlockSpec, ToneIntent, AMP_MODELS, CAB_MODELS, DISTORTION_MODELS, DYNAMICS_MODELS, EQ_MODELS, WAH_MODELS, VOLUME_MODELS, HelixModel types"
provides:
  - "assembleSignalChain(intent: ToneIntent): BlockSpec[] -- ordered signal chain with mandatory blocks, DSP assignment, position numbering"
  - "resolveEffectModel() internal helper for looking up effect models across all catalogs"
  - "Signal chain ordering enforcement: Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb"
  - "Mandatory block insertion: boost (Minotaur/Scream 808), Parametric EQ, Horizon Gate (high-gain), Gain Block"
affects: [02-knowledge-layer, 03-orchestration, param-engine, snapshot-engine]

# Tech tracking
tech-stack:
  added: [vitest]
  patterns: [tdd-red-green, linear-pipeline, mandatory-block-insertion, dsp-split-rules]

key-files:
  created:
    - src/lib/helix/chain-rules.ts
    - src/lib/helix/chain-rules.test.ts
  modified:
    - src/lib/helix/index.ts

key-decisions:
  - "Horizon Gate placed on DSP0 (after cab, before DSP1 effects) -- keeps gate physically near amp for immediate noise suppression"
  - "Cab block position set to -1 sentinel value -- excluded from position counting per preset-builder cab0 slot pattern"
  - "Effects classified by catalog source (not model category string) for reliable BlockSpec.type mapping"
  - "vitest installed as test framework -- lightweight, fast, native ESM support for Next.js project"

patterns-established:
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) -> REFACTOR for all knowledge layer modules"
  - "resolveEffectModel() pattern: cascade lookup across all model catalogs, throw on miss"
  - "PendingBlock intermediate type for building signal chain before final BlockSpec construction"
  - "Slot-based ordering: classify blocks into named slots, sort by slot priority"

requirements-completed: [CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, CHAIN-05, CHAIN-06]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 2 Plan 01: Chain Rules Summary

**Deterministic signal chain assembly with mandatory block insertion, DSP0/DSP1 split, and 8-block-per-DSP limit enforcement**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T00:38:36Z
- **Completed:** 2026-03-02T00:42:32Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- `assembleSignalChain()` transforms ToneIntent into an ordered, DSP-assigned BlockSpec[] with all mandatory blocks inserted
- Clean/crunch amps get Minotaur boost; high-gain amps get Scream 808 boost + Horizon Gate
- Every preset gets post-cab Parametric EQ and Gain Block (volume) for lead snapshot boost
- DSP0 handles pre-amp chain (wah > compressor > drives > boost > amp > cab > gate); DSP1 handles post-cab (EQ > modulation > delay > reverb > volume)
- 20 tests covering all 14 specified behaviors plus 6 additional edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests** - `0e58345` (test)
2. **Task 1 GREEN: Implementation** - `3f21713` (feat)
3. **Barrel export update** - `c719307` (chore)

## Files Created/Modified

- `src/lib/helix/chain-rules.ts` - Signal chain assembly module with assembleSignalChain() public API
- `src/lib/helix/chain-rules.test.ts` - 20 tests covering ordering, DSP assignment, mandatory blocks, error handling
- `src/lib/helix/index.ts` - Added assembleSignalChain to barrel exports

## Decisions Made

- **Horizon Gate on DSP0:** Placed after cab but still on DSP0, keeping the gate physically close to the amp in the signal chain. This matches the RESEARCH.md pattern where the gate is the last block before DSP1 effects.
- **Cab position = -1:** Used -1 as a sentinel for cab block position since cab blocks use separate `cab0` slots in the .hlx file and are excluded from position counting. This avoids position conflicts with real DSP0 blocks.
- **vitest for testing:** Installed vitest as the test framework. It is lightweight, fast, has native ESM support, and works well with the Next.js/TypeScript project stack.
- **Slot-based classification:** Effects are classified into named slots (wah, compressor, extra_drive, boost, etc.) based on their source catalog and model category, then sorted by slot priority. This is extensible and readable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest test framework**
- **Found during:** Task 1 (TDD setup)
- **Issue:** No test framework was installed in the project (package.json had no test runner)
- **Fix:** Ran `npm install -D vitest`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npx vitest run` works, all tests execute
- **Committed in:** Part of project dev dependencies (not separately committed -- standard dev tooling)

**2. [Rule 1 - Bug] Fixed crunch amp test helper using non-existent model name**
- **Found during:** Task 1 (test writing)
- **Issue:** Initial test used "Brit 2204" which does not exist in AMP_MODELS
- **Fix:** Changed to "Grammatico Nrm" (a verified crunch amp in the database)
- **Files modified:** src/lib/helix/chain-rules.test.ts
- **Verification:** Test passes with correct model lookup

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for execution. No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `param-engine.test.ts` (module not yet created) and zod locale `.d.cts` files. These are not caused by our changes and will resolve when param-engine is implemented (Plan 02-02) and the zod version is compatible.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `assembleSignalChain()` is ready for `param-engine.ts` (Plan 02-02) to consume its output and fill in parameter values
- All BlockSpec objects have empty `parameters: {}` as expected by the pipeline design
- The `trails: true` flag is correctly set on delay/reverb blocks for snapshot-engine (Plan 02-03)
- Gain Block is present at end of DSP1 for lead volume boost in snapshot-engine

## Self-Check: PASSED

- [x] src/lib/helix/chain-rules.ts EXISTS
- [x] src/lib/helix/chain-rules.test.ts EXISTS
- [x] .planning/phases/02-knowledge-layer/02-01-SUMMARY.md EXISTS
- [x] Commit 0e58345 (test RED) EXISTS
- [x] Commit 3f21713 (feat GREEN) EXISTS
- [x] Commit c719307 (chore barrel) EXISTS
- [x] 20/20 tests passing

---
*Phase: 02-knowledge-layer*
*Completed: 2026-03-02*
