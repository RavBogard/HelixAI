---
phase: 73-per-device-craft-optimization
plan: 02
subsystem: ai-prompts
tags: [prompt-engineering, planner, stomp, podgo, helix, effect-discipline, dual-dsp]

# Dependency graph
requires:
  - phase: 73-per-device-craft-optimization/01
    provides: "Genre-aware effect priority truncation with GENRE_SLOT_PRIORITY table"
provides:
  - "CRAFT-01: Stomp prompt encourages 3-4 effects per genre (was 1-2)"
  - "CRAFT-02: Pod Go prompt specifies exact 4-effect templates per genre with fill-all-slots guidance"
  - "CRAFT-03: Helix prompt encourages 4-6 effects typical with dual-DSP routing guidance per genre"
  - "CRAFT-04: Prompt-side craft guidance complementing code-side truncation from Plan 01"
affects: [planner-behavior, preset-quality, effect-count-optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-genre effect templates with exact slot counts in prompts"
    - "Dual-DSP routing guidance (DSP0 vs DSP1) in Helix effect discipline"

key-files:
  created: []
  modified:
    - "src/lib/families/stomp/prompt.ts"
    - "src/lib/families/stomp/prompt.test.ts"
    - "src/lib/families/podgo/prompt.ts"
    - "src/lib/families/podgo/prompt.test.ts"
    - "src/lib/families/helix/prompt.ts"
    - "src/lib/families/helix/prompt.test.ts"
    - "src/lib/planner.test.ts"

key-decisions:
  - "Pod Go section renamed from 'Effect Discipline by Genre' to 'Effect Slot Planning by Genre' to emphasize fill-all-slots philosophy"
  - "Stomp metal over-budget priority changed from drive > delay > mod to drive > delay > gate to match new gate inclusion"
  - "Helix effect discipline includes per-genre DSP0/DSP1 placement guidance for dual-DSP awareness"

patterns-established:
  - "Effect discipline sections specify exact effect counts and types per genre, not vague ranges"
  - "Device prompts include underuse warnings to prevent conservatively sparse presets"

requirements-completed: [CRAFT-01, CRAFT-02, CRAFT-03, CRAFT-04]

# Metrics
duration: 4min
completed: 2026-03-07
---

# Phase 73 Plan 02: Device-Specific Prompt Optimization Summary

**Updated all three device family planner prompts with genre-specific effect count guidance: Stomp 3-4 effects (was 1-2), Pod Go exact 4-effect templates, Helix 4-6 typical with dual-DSP routing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T02:11:53Z
- **Completed:** 2026-03-07T02:16:04Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Stomp prompt now encourages 3-4 effects for most genres (was "Maximum 2" for metal, "1 effect" for jazz) with underuse warning
- Pod Go prompt specifies exact 4-effect templates per genre (drive + gate + delay + compressor/wah for metal, etc.) with "unused slot is a wasted slot" emphasis
- Helix prompt raised to 4-6 effects typical (was 2-4), with per-genre DSP0/DSP1 placement guidance and "MORE effects than Stomp or Pod Go" closing
- 9 new CRAFT tests added (3 per device family), all 780 tests pass with zero regressions
- Cache identity preserved: Stomp/StompXL identical, Helix LT/Floor identical

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Stomp prompt with CRAFT-01 effect discipline** - `753b403` (feat)
2. **Task 2: Update Pod Go and Helix prompts with CRAFT-02/03 guidance** - `fd9fb30` (feat)

## Files Created/Modified
- `src/lib/families/stomp/prompt.ts` - Updated Effect Discipline section with higher effect counts and underuse warning
- `src/lib/families/stomp/prompt.test.ts` - Added 3 CRAFT-01 tests, updated metal priority assertion
- `src/lib/families/podgo/prompt.ts` - Replaced Effect Discipline with Effect Slot Planning (exact 4-effect templates per genre)
- `src/lib/families/podgo/prompt.test.ts` - Added 3 CRAFT-02 tests
- `src/lib/families/helix/prompt.ts` - Updated Creative Guidelines (4-6 typical) and Effect Discipline (dual-DSP routing per genre)
- `src/lib/families/helix/prompt.test.ts` - Added 3 CRAFT-03 tests
- `src/lib/planner.test.ts` - Updated section name assertion to match Pod Go renamed heading

## Decisions Made
- Pod Go section renamed from "Effect Discipline by Genre" to "Effect Slot Planning by Genre" to emphasize the fill-all-slots philosophy (templates, not discipline)
- Stomp metal over-budget priority changed from `drive > delay > mod` to `drive > delay > gate` to match new gate inclusion in metal genre
- Helix effect discipline includes per-genre DSP0/DSP1 placement (e.g., "Drive + gate on DSP0; delay + modulation on DSP1") for dual-DSP awareness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated planner.test.ts section name assertion**
- **Found during:** Task 2 (Pod Go prompt update)
- **Issue:** planner.test.ts asserted `"## Effect Discipline by Genre"` in Pod Go prompt, but section was renamed to `"## Effect Slot Planning by Genre"`
- **Fix:** Updated assertion to match new section heading
- **Files modified:** src/lib/planner.test.ts
- **Verification:** All 10 planner tests pass
- **Committed in:** fd9fb30 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary test update for renamed section heading. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 73 complete (both plans done) - all CRAFT requirements fulfilled
- Code-side (Plan 01: genre-aware truncation) and prompt-side (Plan 02: effect count guidance) work together
- 780 tests passing, cache identity preserved across all device families

## Self-Check: PASSED

All 7 modified files exist on disk. Both task commits (753b403, fd9fb30) verified in git log. Summary file exists. 780 tests pass (26 test files).

---
*Phase: 73-per-device-craft-optimization*
*Completed: 2026-03-07*
