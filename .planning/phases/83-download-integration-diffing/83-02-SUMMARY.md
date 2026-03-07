---
phase: 83-download-integration-diffing
plan: 02
subsystem: ui
tags: [download-button, state-diff, fetch-api, blob-download, zustand]

# Dependency graph
requires:
  - phase: 83-download-integration-diffing
    provides: "calculateStateDiff, dehydrateToPresetSpec, POST /api/download endpoint"
provides:
  - "DownloadButton component with diff-gated download flow"
  - "Visualizer page with download capability in header"
  - "Store metadata fields (presetName, description, tempo) and diff baseline (originalBaseBlocks, originalSnapshots)"
affects: [visualizer-page, download-flow, preset-editing]

# Tech tracking
tech-stack:
  added: []
  patterns: [diff-gated-api-call, blob-url-download, non-reactive-getState-read]

key-files:
  created:
    - src/components/visualizer/DownloadButton.tsx
    - src/components/visualizer/DownloadButton.test.tsx
  modified:
    - src/lib/visualizer/store.ts
    - src/app/visualizer/page.tsx

key-decisions:
  - "calculateStateDiff gates download: no-changes = no API round-trip, only show info message"
  - "Download payload is minimal builder-required set: device, baseBlocks, snapshots, presetName, description, tempo — never UI-only fields"
  - "Store captures originalBaseBlocks/originalSnapshots at hydration via deep clone for diff baseline"
  - "DownloadButton uses getState() at click time (non-reactive) to avoid unnecessary re-renders"

patterns-established:
  - "Diff-gated API call pattern: run calculateStateDiff before fetch, skip round-trip when hasChanges=false"
  - "Blob URL download: create objectURL from response blob, programmatic anchor click, revoke URL"

requirements-completed: [API-04]

# Metrics
duration: 3min
completed: 2026-03-07
---

# Phase 83 Plan 02: Download Button & Visualizer Integration Summary

**DownloadButton component with calculateStateDiff-gated download flow, diff-optimized payload (never UI state), and visualizer page header wiring**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-07T22:05:42Z
- **Completed:** 2026-03-07T22:08:40Z
- **Tasks:** 2
- **Files created:** 2
- **Files modified:** 2

## Accomplishments
- DownloadButton component correctly gates downloads via calculateStateDiff: no-changes shows info message without API call, changes triggers diff-optimized POST to /api/download
- Download payload contains only builder-required fields (device, baseBlocks, snapshots, presetName, description, tempo) — never UI-only state (activeSnapshotIndex, selectedBlockId, controllerAssignments, footswitchAssignments)
- Store extended with preset metadata (presetName, description, tempo) and diff baseline (originalBaseBlocks, originalSnapshots deep-cloned at hydration)
- Visualizer page header wired with DownloadButton in flex layout (title left, button right)

## Task Commits

Each task was committed atomically:

1. **Task 1: DownloadButton component with diff-optimized download (TDD)**
   - `9ff328a` (test) — failing tests for DownloadButton component (RED)
   - `f00cd61` (feat) — implement DownloadButton + store metadata fields (GREEN) — 8 tests
2. **Task 2: Wire DownloadButton into visualizer page**
   - `b19d964` (feat) — DownloadButton in visualizer page header

## Files Created/Modified
- `src/components/visualizer/DownloadButton.tsx` — Download button with loading/error/no-changes states, diff-gated API call, blob URL download
- `src/components/visualizer/DownloadButton.test.tsx` — 8 component tests covering render, disable, diff gating, payload shape, loading, error
- `src/lib/visualizer/store.ts` — Added presetName/description/tempo metadata + originalBaseBlocks/originalSnapshots diff baseline to VisualizerStoreState
- `src/app/visualizer/page.tsx` — Import and render DownloadButton in header flex row

## Decisions Made
- **Diff gates the API call, not the payload:** calculateStateDiff determines whether to call /api/download at all. When called, the full current state (baseBlocks + snapshots) is sent — not a minimal diff — because the builder needs the complete state to construct the binary file.
- **Non-reactive state read at click time:** DownloadButton subscribes to baseBlocks only (for disable state). The click handler reads full state via getState() to avoid subscribing to every store field and causing unnecessary re-renders.
- **Deep-clone for diff baseline:** originalBaseBlocks and originalSnapshots are JSON.parse(JSON.stringify()) cloned during hydration to ensure subsequent store mutations don't affect the baseline comparison.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in `src/lib/helix/stadium-deep-compare.test.ts` (untracked file, not related to Phase 83 changes). Already documented in 83-01 summary. Logged but not fixed per scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 83 (Download Integration + Diffing) is fully complete
- v7.0 milestone complete: all 7 phases (77-83) delivered
- Full download flow operational: /api/preview -> visualizer editing -> /api/download
- 8 new tests, 1152 total passing (1 pre-existing unrelated failure)

## Self-Check: PASSED

- All 4 files verified on disk (2 created, 2 modified)
- All 3 task commits verified in git log (9ff328a, f00cd61, b19d964)

---
*Phase: 83-download-integration-diffing*
*Completed: 2026-03-07*
