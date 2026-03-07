---
phase: 82-controllers-dependencies
plan: 01
subsystem: visualizer
tags: [controller, footswitch, expression-pedal, dependency-rules, tdd]

requires:
  - phase: 81-snapshot-system
    provides: hydrateVisualizerState, PreviewResult type, snapshot parameter overlays
provides:
  - extractControllerAssignments — EXP pedal extraction from preset controller section
  - extractFootswitchAssignments — FS badge data with LED color mapping
  - buildBlockIdMap — preset-builder block key to visualizer blockId mapping
  - evaluateDependencies — reactive parameter visibility/enabled/dimmed evaluator
  - GLOBAL_PARAMETER_DEPENDENCIES — Sync/Link/ModDepth rule definitions
  - PreviewResult extended with controllerAssignments and footswitchAssignments
affects: [82-02-controllers-ui, 83-download-integration]

tech-stack:
  added: []
  patterns: [pure-function dependency evaluation, LED color constant mapping]

key-files:
  created:
    - src/lib/visualizer/controller-assignments.ts
    - src/lib/visualizer/controller-assignments.test.ts
    - src/lib/visualizer/param-dependencies.ts
    - src/lib/visualizer/param-dependencies.test.ts
  modified:
    - src/lib/visualizer/hydrate.ts
    - src/lib/visualizer/hydrate.test.ts

key-decisions:
  - "EXP_CONTROLLER_MAP uses numeric IDs 1/2/3 mapped to EXP1/EXP2/EXP3 strings"
  - "LED_COLORS lookup maps 7 numeric values to hex strings with white as default fallback"
  - "Footswitch index mapping: @fs_index - 2 = user-facing FS number (7->5, 8->6, etc.)"
  - "evaluateDependencies is pure function: no side effects, no store dependency"
  - "Multiple rules can fire simultaneously; effects merge with last-write-wins per property"

patterns-established:
  - "Pure dependency evaluation: evaluateDependencies takes params, returns visibility map — no store coupling"
  - "Block ID map bridge: buildBlockIdMap maps preset-builder keys to visualizer blockIds"

requirements-completed: [CTRL-01, CTRL-02, CTRL-03, CTRL-04, DEP-01, DEP-02, DEP-03, DEP-04]

duration: 8min
completed: 2026-03-07
---

# Plan 82-01: Controller + Dependency Engines Summary

**EXP pedal/footswitch extraction + Sync/Link/ModDepth dependency rules with 48 new TDD tests (270 total)**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-07T11:00:00Z
- **Completed:** 2026-03-07T11:08:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- extractControllerAssignments parses EXP pedal assignments from HlxControllerSection with min/max ranges
- extractFootswitchAssignments parses FS badge data with LED color hex conversion and index mapping
- evaluateDependencies evaluates Sync->Time/Speed/Interval, Link->Right params, ModDepth->ModSpeed rules
- PreviewResult extended with controllerAssignments/footswitchAssignments (backwards compatible)
- 48 new tests across 3 files, 270 total passing, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Controller assignment extraction engine** - `6d2bd21` (feat — 23 tests)
2. **Task 2: Parameter dependency rules engine** - `813dc24` (feat — 21 tests)
3. **Task 3: Update hydration pipeline** - `2d82b22` (feat — 4 tests)

## Files Created/Modified
- `src/lib/visualizer/controller-assignments.ts` - EXP pedal + footswitch extraction with lookup helpers
- `src/lib/visualizer/controller-assignments.test.ts` - 23 tests covering extraction, filtering, cross-DSP, lookups
- `src/lib/visualizer/param-dependencies.ts` - Global dependency rules and evaluateDependencies function
- `src/lib/visualizer/param-dependencies.test.ts` - 21 tests covering Sync/Link/ModDepth rules and edge cases
- `src/lib/visualizer/hydrate.ts` - Extended PreviewResult with controller/footswitch arrays
- `src/lib/visualizer/hydrate.test.ts` - 4 new tests for passthrough and defaults

## Decisions Made
- EXP controller numbers (1, 2, 3) mapped to string names ("EXP1", "EXP2", "EXP3") for UI display
- LED color mapping uses lookup table with white (#FFFFFF) fallback for unknown values
- Footswitch @fs_index offset is -2 for all devices (7->FS5, 8->FS6, etc.)
- evaluateDependencies is fully decoupled from store — pure function taking param map

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 82-02 can now consume controller-assignments.ts and param-dependencies.ts for UI wiring
- Store, BlockTile, and ParameterEditorPane ready for controller/footswitch integration

---
*Phase: 82-controllers-dependencies*
*Completed: 2026-03-07*
