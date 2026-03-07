---
phase: 77-api-preview-state-foundation
plan: 02
subsystem: api
tags: [nextjs, api-route, hydration, preview, knowledge-layer]

requires:
  - phase: 77-api-preview-state-foundation
    plan: 01
    provides: VisualizerState types and Zustand store for state hydration
provides:
  - POST /api/preview endpoint returning VisualizerState-shaped JSON
  - hydrateVisualizerState() transformer from PresetSpec to PreviewResult
  - PreviewResult interface (device, baseBlocks, snapshots[4], presetName, description, tempo)
affects: [78-signal-chain-canvas, 83-download-integration]

tech-stack:
  added: []
  patterns: [two-step-api-flow, pipeline-reuse-not-duplication]

key-files:
  created:
    - src/app/api/preview/route.ts
    - src/lib/visualizer/hydrate.ts
    - src/lib/visualizer/hydrate.test.ts
  modified: []

key-decisions:
  - "/api/preview reuses exact same pipeline functions as /api/generate — no code duplication"
  - "hydrateVisualizerState is a pure function, no side effects — easy to test and reuse"
  - "Always returns exactly 4 snapshots (truncate from 8, pad if fewer) for consistent UI"
  - "baseBlocks = signalChain identity — no transformation needed, Knowledge Layer already parameterized"
  - "Persistence not implemented in preview route — deferred to download endpoint (Phase 83)"

patterns-established:
  - "Two-step API pattern: /api/preview for structured state, /api/download for device files"
  - "Preview response shape: { success, device, baseBlocks, snapshots, presetName, description, tempo, toneIntent }"

requirements-completed: [API-01, API-03]

duration: 5min
completed: 2026-03-07
---

# Plan 77-02: /api/preview Endpoint + Hydration Transformer Summary

**/api/preview POST endpoint returning structured VisualizerState JSON via the full Knowledge Layer pipeline — zero AI tokens for parameter resolution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T09:03:00Z
- **Completed:** 2026-03-07T09:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- POST /api/preview endpoint runs full pipeline (Planner -> chain-rules -> param-engine -> snapshot-engine -> validate) and returns structured JSON
- hydrateVisualizerState() pure transformer with 9 unit tests — always returns exactly 4 snapshots
- Zero duplication of pipeline logic — imports from @/lib/helix and @/lib/planner
- Existing /api/generate route completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Create hydrateVisualizerState transformer** - `8f85678` (feat)
2. **Task 2: Create /api/preview POST endpoint** - `6a99fca` (feat)

## Files Created/Modified
- `src/lib/visualizer/hydrate.ts` - Pure transformer: PresetSpec -> PreviewResult (truncate/pad to 4 snapshots)
- `src/lib/visualizer/hydrate.test.ts` - 9 unit tests for hydration transformation
- `src/app/api/preview/route.ts` - POST endpoint with full pipeline, error handling, rig emulation support

## Decisions Made
- No persistence in preview route — the preview is transient state for the UI; persistence happens at download (Phase 83)
- buildToneContext helper duplicated as private function (same as /api/generate) rather than extracting to shared module — keeps routes self-contained, function is small

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- /api/preview returns the structured state that Phase 78 will render as a visual signal chain
- Zustand store (77-01) + hydration transformer (77-02) form complete state foundation

---
*Phase: 77-api-preview-state-foundation*
*Completed: 2026-03-07*
