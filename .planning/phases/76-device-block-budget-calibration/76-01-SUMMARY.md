---
phase: 76-device-block-budget-calibration
plan: 01
subsystem: api
tags: [helix, device-capabilities, chain-rules, zod, tdd]

# Dependency graph
requires:
  - phase: 67-stadium-integration-quality
    provides: Stadium DeviceCapabilities and chain-rules integration
provides:
  - Corrected maxEffectsPerDsp for Stomp (4), StompXL (4), Stadium (8)
  - Corrected STOMP_MAX_BLOCKS (8), STOMP_XL_MAX_BLOCKS (8) in config
  - Raised Zod schema .max(10) for ToneIntent effects array
  - console.warn on chain-rules effect truncation
  - Unified planner.ts maxFx=4 for both Stomp variants
affects: [prompt-text, preset-generation, chain-rules, planner]

# Tech tracking
tech-stack:
  added: []
  patterns: [console.warn truncation logging]

key-files:
  created: []
  modified:
    - src/lib/helix/config.ts
    - src/lib/helix/device-family.ts
    - src/lib/helix/tone-intent.ts
    - src/lib/helix/chain-rules.ts
    - src/lib/planner.ts
    - src/lib/helix/device-family.test.ts
    - src/lib/helix/chain-rules.test.ts
    - src/lib/helix/orchestration.test.ts

key-decisions:
  - "STOMP_MAX_BLOCKS=8 for both Stomp and StompXL (FW 3.0+ hardware limit, same DSP chip)"
  - "maxEffectsPerDsp=4 accounts for amp+cab+boost+gate overhead, leaving 4 user effects within 8-block limit"
  - "Stadium maxEffectsPerDsp=8 based on 12 slots minus amp+cab+EQ+volume mandatory blocks"
  - "Zod .max(10) provides headroom above Stadium's 8-effect capacity"

patterns-established:
  - "console.warn before silent truncation in chain-rules for observability"
  - "planner.ts uses STOMP_CONFIG constants instead of hardcoded block counts"

requirements-completed: [BUDGET-01, BUDGET-03, BUDGET-05]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 76 Plan 01: Core Value Corrections Summary

**Corrected hardware block budgets for all 5 device families with TDD tests and chain-rules truncation warning**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T00:45:56Z
- **Completed:** 2026-03-07T00:50:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 8

## Accomplishments
- Corrected STOMP_MAX_BLOCKS (6->8) and STOMP_XL_MAX_BLOCKS (9->8) to match FW 3.0+ hardware
- Fixed maxEffectsPerDsp: Stomp 2->4, StompXL 5->4, Stadium 4->8
- Raised Zod schema .max(6) to .max(10) preventing false validation rejections
- Added console.warn before chain-rules effect truncation for observability
- Unified planner.ts maxFx=4 for both Stomp variants (were 2 and 5)
- 10 new TDD tests covering all corrections

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests (RED)** - `02b5892` (test)
2. **Task 2: Correct all values (GREEN)** - `aedc643` (fix)

## Files Created/Modified
- `src/lib/helix/config.ts` - STOMP_MAX_BLOCKS: 6->8, STOMP_XL_MAX_BLOCKS: 9->8
- `src/lib/helix/device-family.ts` - maxEffectsPerDsp corrections for Stomp(4), StompXL(4), Stadium(8)
- `src/lib/helix/tone-intent.ts` - Zod effects array .max(6) -> .max(10)
- `src/lib/helix/chain-rules.ts` - console.warn before effect truncation
- `src/lib/planner.ts` - maxFx=4 unified, blocks uses STOMP_CONFIG constants
- `src/lib/helix/device-family.test.ts` - maxEffectsPerDsp + maxBlocksTotal assertion updates
- `src/lib/helix/chain-rules.test.ts` - Truncation warning + Zod max boundary tests
- `src/lib/helix/orchestration.test.ts` - Updated STOMP_CONFIG assertion (6->8, 9->8)

## Decisions Made
- STOMP_MAX_BLOCKS=8 for both Stomp and StompXL based on FW 3.0+ release notes and same DSP chip
- maxEffectsPerDsp=4 for Stomp/StompXL: conservative safe value accounting for mandatory boost+gate
- Stadium maxEffectsPerDsp=8: 12 block slots minus amp(1)+cab(1)+EQ(1)+volume(1) = 8 user effects
- Zod .max(10) provides 2-effect headroom above Stadium's 8

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated orchestration.test.ts STOMP_CONFIG assertions**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** orchestration.test.ts had hardcoded assertions `STOMP_MAX_BLOCKS === 6` and `STOMP_XL_MAX_BLOCKS === 9`
- **Fix:** Updated to `=== 8` for both
- **Files modified:** src/lib/helix/orchestration.test.ts
- **Verification:** Full test suite passes (716 tests)
- **Committed in:** aedc643 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Stadium 8-effect test filter to exclude Horizon Gate**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** "Agoura German Xtra Red" is a high_gain amp, causing Horizon Gate auto-insertion. Test filter didn't exclude it.
- **Fix:** Added Horizon Gate to mandatory block exclusion set in test
- **Files modified:** src/lib/helix/chain-rules.test.ts
- **Verification:** Test correctly counts 8 user effects
- **Committed in:** aedc643 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All hardware budget values corrected
- Plan 76-02 (prompt text corrections) can proceed immediately
- Chain-rules now supports full hardware effect capacity

---
*Phase: 76-device-block-budget-calibration*
*Completed: 2026-03-07*
