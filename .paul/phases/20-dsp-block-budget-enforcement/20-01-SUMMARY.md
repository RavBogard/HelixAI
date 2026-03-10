---
phase: 20-dsp-block-budget-enforcement
plan: 01
subsystem: builder
tags: [chain-rules, dsp-budget, block-limit, graceful-degradation]

requires: []
provides:
  - Graceful per-DSP block budget enforcement — drops lowest-priority user effects instead of throwing
affects: []

tech-stack:
  added: []
  patterns: [budget-enforcement-loop, user-effect-slot-set]

key-files:
  modified:
    - src/lib/helix/chain-rules.ts
    - src/lib/helix/chain-rules.test.ts

key-decisions:
  - "USER_EFFECT_SLOTS set distinguishes droppable user effects from mandatory/amp/cab blocks"
  - "Budget enforcement runs after mandatory insertion + sort, replacing the throwing validation"
  - "Single-DSP and dual-DSP paths both use graceful drop instead of throw"

duration: ~10min
completed: 2026-03-10
---

# Phase 20 Plan 01: DSP Block Budget Enforcement Summary

**Replaced throwing DSP block limit validation with graceful budget enforcement that drops lowest-priority user effects after mandatory block insertion.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-03-10 |
| Tasks | 2 completed |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: High-gain with 6+ post-cab effects builds | Pass | Drops Courtesan Flange (ambient, lowest priority) |
| AC-2: Dropped effects are lowest-priority | Pass | getEffectPriority scoring used for drop order |
| AC-3: Warning logged for each drop | Pass | Console warns with effect name, role, and DSP limit |
| AC-4: Within-budget presets unchanged | Pass | 3 user effects + 3 mandatory = 6, all survive |
| AC-5: No regression | Pass | 1458/1458 tests pass |

## Accomplishments

- Replaced throwing `DSP1 block limit exceeded` error with a while-loop that drops the lowest-priority user effect until within budget
- Created `USER_EFFECT_SLOTS` set to distinguish droppable user effects from mandatory blocks (boost, horizon_gate, eq, gain_block) and amp/cab
- Both single-DSP and dual-DSP code paths now use graceful degradation
- Added 3 new tests covering high-gain overflow, clean overflow, and within-budget no-op

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/chain-rules.ts` | Modified | Replaced step 8 throwing validation with budget enforcement loop |
| `src/lib/helix/chain-rules.test.ts` | Modified | 3 new tests for DSP block budget enforcement |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

---
*Phase: 20-dsp-block-budget-enforcement, Plan: 01*
*Completed: 2026-03-10*
