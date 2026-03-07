---
phase: 75-preset-musical-coherence
plan: 02
subsystem: audio-engine
tags: [snapshot-engine, chain-rules, boost-disambiguation, dynamics-split, tdd]

# Dependency graph
requires:
  - phase: 75-preset-musical-coherence (plan 01)
    provides: "COHERE-01 drive palette balance, COHERE-02 reverb auto-insert, PendingBlock slot propagation infrastructure"
provides:
  - "BlockSpec.slot field for boost disambiguation (mandatory boost vs user drive)"
  - "snapshot-engine slot-based boost detection with backward-compat fallback"
  - "COHERE-04 dynamics type split: compressor OFF for high-gain lead/crunch, gate always-ON"
affects: [75-03-quality-validation, preset-builder, future-snapshot-engine-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Slot propagation: chain-rules PendingBlock.slot -> BlockSpec.slot for metadata tagging"
    - "Model category lookup: DYNAMICS_MODELS[modelName].category for compressor vs gate distinction"
    - "Backward compat: fallback to BOOST_MODEL_IDS when slot field absent (old presets)"

key-files:
  created: []
  modified:
    - "src/lib/helix/types.ts"
    - "src/lib/helix/chain-rules.ts"
    - "src/lib/helix/snapshot-engine.ts"
    - "src/lib/helix/snapshot-engine.test.ts"
    - "src/lib/helix/chain-rules.test.ts"

key-decisions:
  - "BlockSpec.slot typed as optional string (not narrow 'boost' literal) to allow all chain slots to propagate, enabling disambiguation between user drives and mandatory boosts"
  - "classifyEffectSlot no longer returns 'boost' for Minotaur/Scream 808 user effects -- returns 'extra_drive' instead. Only mandatory step 5a blocks get slot='boost'"
  - "Backward compat fallback uses !block.slot && BOOST_MODEL_IDS.has() -- old presets without slot field still work as before"
  - "Compressor toggle OFF only for high-gain + lead/crunch combinations. Clean amps and ambient/clean snapshots keep compressor ON"

patterns-established:
  - "Slot-based block identity: chain-rules tags mandatory infrastructure blocks with slot='boost', snapshot-engine uses slot for behavior decisions"
  - "Category-based dynamics split: DYNAMICS_MODELS category field drives per-type behavior in snapshot-engine"

requirements-completed: [COHERE-03, COHERE-04]

# Metrics
duration: 6min
completed: 2026-03-07
---

# Phase 75 Plan 02: Snapshot Engine Boost Disambiguation + Dynamics Split Summary

**Slot-based boost detection distinguishing mandatory Minotaur from user drives, plus compressor-vs-gate dynamics split for high-gain snapshots**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-07T03:04:48Z
- **Completed:** 2026-03-07T03:10:22Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 5

## Accomplishments
- COHERE-03: BlockSpec.slot field propagated from chain-rules, enabling snapshot-engine to distinguish mandatory boosts (slot="boost") from user-selected Minotaur/Scream 808 (slot="extra_drive")
- COHERE-04: Dynamics type split -- compressor blocks toggle OFF in high-gain lead/crunch snapshots (tube compression sufficient), gate and Autoswell remain always-ON
- Backward compatibility preserved: old presets without slot field still use BOOST_MODEL_IDS fallback
- 10 new tests (7 snapshot-engine + 3 chain-rules), all passing. 825 total tests, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: TDD tests for COHERE-03 and COHERE-04** - `5c65548` (test)
2. **Task 2: Implement COHERE-03 + COHERE-04** - `d1c60ab` (feat)

_TDD: tests written first (RED, 5 failing), then implementation (GREEN, all 87 passing)_

## Files Created/Modified
- `src/lib/helix/types.ts` - Added BlockSpec.slot optional string field
- `src/lib/helix/chain-rules.ts` - Propagate slot from PendingBlock to BlockSpec; classifyEffectSlot returns "extra_drive" for user Minotaur/Scream 808 instead of "boost"
- `src/lib/helix/snapshot-engine.ts` - Slot-based boost detection with BOOST_MODEL_IDS fallback; DYNAMICS_MODELS category split for compressor vs gate
- `src/lib/helix/snapshot-engine.test.ts` - 7 new tests: COHERE-03 boost disambiguation (3) + COHERE-04 dynamics split (4+3 gate/autoswell)
- `src/lib/helix/chain-rules.test.ts` - 3 new tests: COHERE-03 slot propagation (mandatory Minotaur, Scream 808, user Minotaur)

## Decisions Made
- BlockSpec.slot typed as `string` (not narrow `"boost"` literal) -- all chain slots propagate through buildBlockSpec, enabling the snapshot-engine to check `block.slot === "boost"` while user drives get `slot = "extra_drive"`. This is the simplest approach that distinguishes mandatory boosts from user-selected Minotaur without adding a separate `_mandatory` flag.
- classifyEffectSlot was modified to NOT return "boost" for Minotaur/Scream 808 (previously line 134). User-selected instances now classify as "extra_drive" like any other distortion pedal. Only mandatory blocks from step 5a retain slot "boost". This changes user Minotaur's chain position from SLOT_ORDER[boost]=3 to SLOT_ORDER[extra_drive]=2, which is more correct (user drive, not mandatory boost).
- Compressor toggle logic placed INSIDE the existing `block.type === "dynamics"` guard, using DYNAMICS_MODELS category lookup. Only "compressor" category gets toggle-off behavior. Gate, Autoswell, and unknown dynamics retain always-ON.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] BlockSpec.slot type broadened from "boost" to string**
- **Found during:** Task 2 (implementation)
- **Issue:** Plan specified `slot?: "boost"` and propagation only for `pending.slot === "boost"`. This would leave user-selected Minotaur without any slot value, causing the backward-compat fallback to treat it as boost (defeating COHERE-03's purpose).
- **Fix:** Typed as `slot?: string`, propagated all PendingBlock.slot values. User Minotaur gets `slot: "extra_drive"`, which exists but isn't "boost", so the fallback check `!block.slot && BOOST_MODEL_IDS.has(...)` correctly skips it.
- **Files modified:** src/lib/helix/types.ts, src/lib/helix/chain-rules.ts
- **Verification:** All 10 new tests pass including user Minotaur disambiguation and backward compat
- **Committed in:** d1c60ab (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan spec)
**Impact on plan:** Auto-fix necessary for correctness. The plan's narrow type would have prevented COHERE-03 from working as intended. No scope creep.

## Issues Encountered
- Pre-existing failure in untracked `stadium-deep-compare.test.ts` -- out of scope, not related to this plan's changes. Logged as pre-existing.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COHERE-03 (boost disambiguation) and COHERE-04 (dynamics split) complete
- Ready for Plan 03 (quality validation updates) which may reference the new slot field and dynamics behavior
- 825 tests passing, zero regressions

---
*Phase: 75-preset-musical-coherence*
*Completed: 2026-03-07*
