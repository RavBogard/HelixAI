---
phase: 83-download-integration-diffing
plan: 01
subsystem: api
tags: [state-diff, dehydrate, download, preset-builder, binary-response]

# Dependency graph
requires:
  - phase: 77-api-preview-state-foundation
    provides: "hydrateVisualizerState, PreviewResult, /api/preview endpoint"
provides:
  - "calculateStateDiff pure function for detecting visualizer state changes"
  - "dehydrateToPresetSpec transformer (reverse of hydrateVisualizerState)"
  - "POST /api/download endpoint returning device-correct binary files"
affects: [83-02-download-integration-diffing, visualizer-ui, frontend-download-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [two-pass-block-matching, identity-transform-dehydration, stateless-binary-api]

key-files:
  created:
    - src/lib/visualizer/state-diff.ts
    - src/lib/visualizer/state-diff.test.ts
    - src/lib/visualizer/dehydrate.ts
    - src/lib/visualizer/dehydrate.test.ts
    - src/app/api/download/route.ts
  modified: []

key-decisions:
  - "Two-pass block matching: blockId (type+position) match for model swaps, type+modelId match for position/add/remove detection"
  - "Dehydrate is identity transform: signalChain = baseBlocks, snapshots pass-through — builders handle the format"
  - "Download endpoint is stateless: frontend sends state, backend compiles file, returns binary"
  - "Validation errors from validatePresetSpec return 400, build errors return 500"

patterns-established:
  - "State diff uses type+modelId as block identity for reorder detection across DSPs"
  - "Stateless download API pattern: receive state, validate, build, return binary"

requirements-completed: [STATE-03, API-02]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 83 Plan 01: State Diffing, Dehydration, and Download Endpoint Summary

**calculateStateDiff engine detecting block moves/swaps/adds/removes/snapshot changes, dehydrateToPresetSpec identity transformer, POST /api/download returning device-correct .hlx/.pgp/.hsp binary files**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T21:57:44Z
- **Completed:** 2026-03-07T22:02:49Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- calculateStateDiff correctly detects all change types: no changes, block position moves (same DSP and cross-DSP), model swaps, block additions/removals, snapshot parameter overrides, snapshot bypass state changes
- dehydrateToPresetSpec cleanly reverse-maps visualizer state back to PresetSpec, verified with round-trip test through hydrateVisualizerState
- POST /api/download endpoint with device-branching logic (Stomp -> .hlx, Stadium -> .hsp, Pod Go -> .pgp, Helix -> .hlx), correct Content-Disposition headers, input validation, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: calculateStateDiff — state diffing engine**
   - `a1a9990` (test) — failing tests for calculateStateDiff (RED)
   - `0360c7e` (feat) — implement calculateStateDiff (GREEN) — 12 tests
2. **Task 2: dehydrateToPresetSpec + /api/download endpoint**
   - `825d8c9` (test) — failing tests for dehydrateToPresetSpec (RED)
   - `a0f4a76` (feat) — implement dehydrateToPresetSpec and /api/download (GREEN) — 5 tests

## Files Created/Modified
- `src/lib/visualizer/state-diff.ts` — calculateStateDiff pure function with StateDiff/ChainChange/ModelSwap/SnapshotChange types
- `src/lib/visualizer/state-diff.test.ts` — 12 tests covering all diff scenarios
- `src/lib/visualizer/dehydrate.ts` — dehydrateToPresetSpec identity transformer
- `src/lib/visualizer/dehydrate.test.ts` — 5 tests including round-trip verification
- `src/app/api/download/route.ts` — POST endpoint with device-branching, validation, binary response

## Decisions Made
- **Two-pass block matching for state diff:** First pass matches by blockId (type+position) to detect model swaps at the same position. Second pass matches by type+modelId to detect blocks that moved positions (reordering). This correctly handles both scenarios without conflating them.
- **Dehydrate is a trivial identity transform:** Since hydrateVisualizerState is already identity (signalChain = baseBlocks), dehydrate is equally trivial — no parameter merging or snapshot rewriting needed. Builders receive data in exactly the format they expect.
- **Stateless download endpoint:** No persistence or Supabase interaction — that's handled by /api/generate. The download route is pure: receive state, build file, return binary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed block matching strategy for reorder detection**
- **Found during:** Task 1 (calculateStateDiff)
- **Issue:** Initial index-based block matching confused block reordering with model swaps. When blocks were reordered, comparing by array index saw different types at each position and misidentified them as swaps.
- **Fix:** Implemented two-pass matching: Pass 1 matches by blockId (type+position) for model swap detection. Pass 2 matches by type+modelId identity for position change detection (moves, adds, removes).
- **Files modified:** src/lib/visualizer/state-diff.ts
- **Verification:** All 12 tests pass including reorder and mixed-change scenarios
- **Committed in:** 0360c7e (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Algorithm refinement necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing test failure in `src/lib/helix/stadium-deep-compare.test.ts` (untracked file, not related to Phase 83 changes). Logged but not fixed per scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- State diff engine ready for frontend integration (Phase 83 Plan 02)
- Dehydrate function ready for download flow wiring
- /api/download endpoint ready for frontend POST calls
- All 17 new tests pass, no regressions in existing 286+ tests

## Self-Check: PASSED

- All 5 created files exist on disk
- All 4 task commits verified in git log

---
*Phase: 83-download-integration-diffing*
*Completed: 2026-03-07*
