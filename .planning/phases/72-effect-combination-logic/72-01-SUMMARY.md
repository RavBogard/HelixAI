---
phase: 72-effect-combination-logic
plan: 01
subsystem: signal-chain
tags: [chain-rules, combo, gate-placement, compressor-omission, priority-truncation, tdd]

# Dependency graph
requires:
  - phase: 76-device-block-budget-calibration
    provides: maxEffectsPerDsp calibrated per device, naive truncation with console.warn
provides:
  - "COMBO-02: high-gain gate pre-amp placement and compressor omission"
  - "COMBO-03: priority-based effect truncation (getEffectPriority scoring)"
  - "SLOT_ORDER.horizon_gate = 2.5 (between extra_drive and boost)"
affects: [72-02-PLAN, param-engine, prompt-builders]

# Tech tracking
tech-stack:
  added: []
  patterns: [priority-scoring-for-truncation, slot-order-fractional-values, combo-rule-prefixed-warnings]

key-files:
  created: []
  modified:
    - src/lib/helix/chain-rules.ts
    - src/lib/helix/chain-rules.test.ts

key-decisions:
  - "SLOT_ORDER uses fractional value 2.5 for horizon_gate to insert between extra_drive(2) and boost(3) without renumbering"
  - "getEffectPriority scores intentRole (always_on=100, toggleable=50, ambient=30) + slot (wah=18, compressor=15, delay=10, reverb=8, modulation=5)"
  - "COMBO-02 compressor omission runs BEFORE COMBO-03 truncation to reduce effect count before budget check"

patterns-established:
  - "COMBO-XX prefix in console.warn messages for observability and test filtering"
  - "Priority scoring: intentRole weight (100/50/30) dominates slot weight (5-18) — always_on never dropped"

requirements-completed: [COMBO-02, COMBO-03]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 72 Plan 01: Structural Combination Rules Summary

**Horizon Gate pre-amp placement for high-gain, compressor omission for high-gain, and priority-based effect truncation replacing naive tail-chop**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T01:42:17Z
- **Completed:** 2026-03-07T01:45:25Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 2

## Accomplishments
- COMBO-02: High-gain chains place Horizon Gate before amp (slot order 2.5), omit toggleable/ambient compressors
- COMBO-03: Priority-based truncation drops lowest-priority effects first (modulation before wah/delay/reverb)
- After truncation, remaining effects re-sorted by SLOT_ORDER for correct signal chain position
- 10 new COMBO test cases, 2 existing tests updated, 42 chain-rules tests pass, 760 total tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- failing tests for COMBO-02 and COMBO-03** - `2fdf7eb` (test)
2. **Task 2: GREEN -- implement structural combination rules** - `10e3d52` (feat)

_TDD: RED phase wrote 10 new tests + updated 2 existing, GREEN phase implemented all 3 rules_

## Files Created/Modified
- `src/lib/helix/chain-rules.ts` - SLOT_ORDER.horizon_gate=2.5, getEffectPriority(), COMBO-02 compressor omission, COMBO-03 priority truncation
- `src/lib/helix/chain-rules.test.ts` - 10 new COMBO-02/COMBO-03 tests, 2 existing tests updated for gate position, 1 BUDGET-05 test adapted for COMBO-02 interaction

## Decisions Made
- Used fractional slot order value (2.5) instead of renumbering all slots -- minimal impact, no downstream changes needed
- Priority scoring uses intentRole as dominant factor (100/50/30) over slot type (5-18) so always_on effects are never truncated by budget
- COMBO-02 runs before COMBO-03 to reduce effect count before budget truncation check
- Existing BUDGET-05 Stadium test updated to replace Deluxe Comp with UK Wah 846 to avoid COMBO-02 interaction (high-gain amp + toggleable compressor)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated BUDGET-05 Stadium test for COMBO-02 interaction**
- **Found during:** Task 2 (GREEN implementation)
- **Issue:** Existing "Stadium with 8 user effects" test used Deluxe Comp (toggleable compressor) with high-gain amp -- COMBO-02 removes it, reducing count from 8 to 7
- **Fix:** Replaced "Deluxe Comp" with "UK Wah 846" in the test to keep 8 user effects without triggering compressor omission
- **Files modified:** src/lib/helix/chain-rules.test.ts
- **Verification:** All 42 chain-rules tests pass
- **Committed in:** 10e3d52 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix in existing test)
**Impact on plan:** Minimal -- single test fixture updated to account for new COMBO-02 behavior. No scope creep.

## Issues Encountered
None -- plan executed cleanly. One pre-existing untracked test file (stadium-deep-compare.test.ts) fails independently but is not related to this plan's changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- COMBO-02 and COMBO-03 structural rules are in place -- effects are correctly filtered and positioned
- Wave 2 (72-02-PLAN.md) can proceed with parametric combination adjustments (comp-drive, mod-reverb interactions)
- getEffectPriority() scoring function is available for future priority-related logic

## Self-Check: PASSED

- [x] src/lib/helix/chain-rules.ts exists
- [x] src/lib/helix/chain-rules.test.ts exists
- [x] .planning/phases/72-effect-combination-logic/72-01-SUMMARY.md exists
- [x] Commit 2fdf7eb (RED tests) verified
- [x] Commit 10e3d52 (GREEN implementation) verified

---
*Phase: 72-effect-combination-logic*
*Completed: 2026-03-07*
