---
phase: 70-expression-pedal-controller-assignment
plan: 01
subsystem: preset-builder
tags: [expression-pedal, controller, wah, volume, helix, stomp, tdd]

requires:
  - phase: 61-family-router
    provides: "getCapabilities() with expressionPedalCount per device"
provides:
  - "EXP_PEDAL_1 controller assignment for wah Position in Helix and Stomp builders"
  - "EXP_PEDAL_2 controller assignment for Volume Pedal Position in Helix and Stomp builders"
  - "Defensive snapshot-exclusion guard preventing EXP/snapshot controller collision"
affects: [podgo-builder, stadium-builder, exp-controller-tests]

tech-stack:
  added: []
  patterns:
    - "getCapabilities(device).expressionPedalCount gates EXP assignment"
    - "getGlobalIdx() computes non-cab block index for blockKeyMap lookup"

key-files:
  created:
    - src/lib/helix/exp-controller.test.ts
  modified:
    - src/lib/helix/preset-builder.ts
    - src/lib/helix/stomp-builder.ts

key-decisions:
  - "EXP assignment runs AFTER snapshot loop — defensive guard skips Position if already claimed by snapshot controller"
  - "getGlobalIdx helper counts non-cab blocks to compute correct blockKeyMap lookup key"

patterns-established:
  - "EXP controller pattern: find wah/volume block -> compute globalIdx -> lookup in blockKeyMap -> write @controller entry"

requirements-completed: [EXP-01, EXP-02, EXP-03, EXP-05]

duration: 3min
completed: 2026-03-07
---

# Phase 70 Plan 01: Helix/Stomp EXP Pedal Controller Assignment Summary

**EXP_PEDAL_1 wah sweep and EXP_PEDAL_2 volume control wired into Helix LT/Floor and HX Stomp/Stomp XL builders via TDD**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T00:02:39Z
- **Completed:** 2026-03-07T00:06:00Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Helix LT/Floor .hlx files now contain @controller:1 (EXP_PEDAL_1) on wah Position and @controller:2 (EXP_PEDAL_2) on Volume Pedal Position
- HX Stomp/Stomp XL .hlx files now contain same EXP controller entries in dsp0
- Defensive guard prevents EXP from overwriting snapshot controller assignments
- Gain Block correctly excluded from EXP assignment (uses Gain param, not Position)
- 9 new TDD tests cover all EXP assignment scenarios

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for EXP controller assignment** - `7039b20` (test)
2. **Task 2: Implement EXP pedal assignment in preset-builder.ts and stomp-builder.ts** - `b11078c` (feat)

## Files Created/Modified
- `src/lib/helix/exp-controller.test.ts` - 9 TDD tests for Helix and Stomp EXP controller assignment
- `src/lib/helix/preset-builder.ts` - Added EXP pedal assignment in buildControllerSection() with device-aware gating
- `src/lib/helix/stomp-builder.ts` - Added EXP pedal assignment in buildControllerSection() for single-DSP Stomp devices

## Decisions Made
- EXP assignment runs AFTER the snapshot loop so the defensive guard (skip if Position already has controller) naturally prevents collision
- Used getGlobalIdx() helper to count non-cab blocks for correct blockKeyMap key computation rather than using signalChain.indexOf() which would include cabs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- EXP wiring for Helix and Stomp complete, ready for Plan 70-02 (Pod Go + cross-device verification)
- Pattern established can be reused in podgo-builder.ts

## Self-Check: PASSED

---
*Phase: 70-expression-pedal-controller-assignment*
*Completed: 2026-03-07*
