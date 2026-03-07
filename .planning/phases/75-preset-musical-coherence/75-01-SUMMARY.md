---
phase: 75-preset-musical-coherence
plan: 01
subsystem: signal-chain
tags: [chain-rules, drive-limit, reverb-auto-insert, effect-palette, musical-coherence]

# Dependency graph
requires:
  - phase: 73-genre-aware-effect-priority
    provides: getEffectPriority with genre-aware slot scoring for drive truncation
  - phase: 72-effect-combination-rules
    provides: COMBO-02/COMBO-03 truncation framework in chain-rules.ts
provides:
  - COHERE-01 drive palette balance (max 2 user drives, boost excluded)
  - COHERE-02 Plate reverb auto-insertion for clean/ambient snapshots
affects: [75-02, 75-03, snapshot-engine, preset-quality-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: [effect-palette-balance, reverb-soft-mandatory, pre-truncation-insertion]

key-files:
  created: []
  modified:
    - src/lib/helix/chain-rules.ts
    - src/lib/helix/chain-rules.test.ts

key-decisions:
  - "COHERE-01 placed before COMBO-02 compressor removal — drives capped before compressor logic runs"
  - "COHERE-02 placed before COMBO-03 truncation — auto-inserted Plate competes fairly with other effects"
  - "Used Stupor OD instead of plan's 'Dhyana' (not in model catalog) for 3-drive test scenario"
  - "Updated 3 existing tests to reflect Plate auto-insertion in default clean/high-gain intents"

patterns-established:
  - "COHERE-01: Drive palette balance runs on userEffects before any combination rules"
  - "COHERE-02: Reverb soft-mandatory inserts into userEffects (not mandatoryBlocks) so COMBO-03 truncation applies"

requirements-completed: [COHERE-01, COHERE-02]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 75 Plan 01: Chain Rules - Drive Palette Balance + Reverb Auto-Insert Summary

**Max 2 user drives via COHERE-01 priority-based truncation + Plate reverb auto-insertion for clean/ambient presets via COHERE-02**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-07T02:56:02Z
- **Completed:** 2026-03-07T03:01:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- COHERE-01: Max 2 user-selected drives enforced (slot=extra_drive), lowest-priority excess dropped via getEffectPriority
- COHERE-02: Plate reverb auto-inserted when clean/ambient snapshots exist and no user reverb present
- Mandatory boost (Minotaur/Scream 808, slot=boost) excluded from COHERE-01 drive count
- Auto-inserted Plate participates in COMBO-03 priority truncation naturally (not a special bypass)
- 9 new tests (4 COHERE-01 + 5 COHERE-02), 820 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD tests for COHERE-01 and COHERE-02** - `7f6dcae` (test)
2. **Task 2: Implement COHERE-01 and COHERE-02** - `b075367` (feat)

## Files Created/Modified
- `src/lib/helix/chain-rules.ts` - Added COHERE-01 drive palette balance and COHERE-02 reverb auto-insertion logic
- `src/lib/helix/chain-rules.test.ts` - Added 9 new tests for both rules, updated 3 existing tests for Plate auto-insertion

## Decisions Made
- COHERE-01 uses `slot === "extra_drive"` filter to exclude mandatory boost from drive count (boost slot is "boost", not "extra_drive")
- COHERE-02 checks `blockType === "reverb"` on userEffects to detect existing reverb (covers all reverb models regardless of slot naming)
- Auto-inserted Plate gets `intentRole: "toggleable"` so it can be toggled per snapshot
- Both rules placed after step 4 (user effect resolution) and before COMBO-02 (compressor removal) to ensure correct processing order

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] "Dhyana" model name doesn't exist in catalog**
- **Found during:** Task 1 (TDD test creation)
- **Issue:** Plan specified "Dhyana" as one of 3 test drives, but this model name doesn't exist in DISTORTION_MODELS
- **Fix:** Used "Stupor OD" (Boss SD-1, exists in catalog) as the third drive instead
- **Files modified:** src/lib/helix/chain-rules.test.ts
- **Verification:** All model names resolve correctly in tests
- **Committed in:** 7f6dcae (Task 1 commit)

**2. [Rule 1 - Bug] 3 existing tests broken by COHERE-02 Plate auto-insertion**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Default cleanIntent() and highGainIntent() helpers include clean/ambient snapshots, so COHERE-02 now auto-inserts Plate reverb in chains that previously had none. 3 existing tests had exact block-list assertions that didn't include Plate.
- **Fix:** Updated test assertions to include Plate in expected block lists. Updated DSP0 overflow test to verify COHERE-01 prevents overflow instead (8 drives now capped to 2). Updated Stadium 8-effect test to use max 2 drives.
- **Files modified:** src/lib/helix/chain-rules.test.ts
- **Verification:** All 59 chain-rules tests pass, all 820 full suite tests pass
- **Committed in:** b075367 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing `stadium-deep-compare.test.ts` failure (untracked test file comparing generated vs reference .hsp) -- confirmed failing before this plan's changes. Out of scope, logged here for awareness.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COHERE-01 and COHERE-02 are active in chain-rules.ts, ready for downstream integration
- Phase 75 Plan 02 (snapshot-engine updates) can consume these rules
- Phase 75 Plan 03 (quality validation updates) can verify these constraints

---
*Phase: 75-preset-musical-coherence*
*Completed: 2026-03-07*
