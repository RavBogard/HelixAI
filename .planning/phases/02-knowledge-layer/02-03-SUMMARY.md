---
phase: 02-knowledge-layer
plan: 03
subsystem: helix-knowledge
tags: [snapshot-engine, volume-balancing, led-colors, block-states, gain-boost, chvol, tdd, vitest]

# Dependency graph
requires:
  - phase: 02-knowledge-layer
    provides: "assembleSignalChain (Plan 01), resolveParameters (Plan 02), BlockSpec/SnapshotSpec types, AMP_MODELS, LED_COLORS"
provides:
  - "buildSnapshots(chain: BlockSpec[], intents: SnapshotIntent[]): SnapshotSpec[] -- 4 volume-balanced snapshots"
  - "Per-role LED color mapping: clean=blue(6), crunch=orange(2), lead=red(1), ambient=turquoise(5)"
  - "ChVol volume balancing: clean=0.68, crunch=0.72, lead=0.80, ambient=0.65"
  - "Lead boost: +2.5 dB via Gain Block parameterOverride"
  - "Deterministic block state table: per-role enable/bypass for all block types"
  - "Complete Knowledge Layer pipeline: ToneIntent -> assembleSignalChain -> resolveParameters -> buildSnapshots"
affects: [03-orchestration, preset-pipeline, preset-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-snapshot-generation, volume-balancing-chvol, global-block-keys, block-state-table]

key-files:
  created:
    - src/lib/helix/snapshot-engine.ts
    - src/lib/helix/snapshot-engine.test.ts
  modified:
    - src/lib/helix/index.ts

key-decisions:
  - "Global sequential block keys (block0..blockN) instead of per-DSP keys -- avoids collision in flat Record, preset-builder maps both formats"
  - "Boost OFF in clean snapshot only for clean amps -- crunch/high-gain amps keep boost ON even in clean snapshot for tonal consistency"
  - "Block state table as function with type/role lookup -- extensible for future block types without table modifications"

patterns-established:
  - "Global block key generation: sequential across both DSPs, excluding cabs, mapped by preset-builder's buildBlockKeyMap"
  - "Volume balancing via snapshot parameter overrides: ChVol for relative levels, Gain Block for lead presence boost"
  - "Deterministic block state resolution: block type + tone role + amp category = enabled boolean"

requirements-completed: [SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05]

# Metrics
duration: 4min
completed: 2026-03-02
---

# Phase 2 Plan 03: Snapshot Engine Summary

**Volume-balanced 4-snapshot generation with deterministic block states, ChVol overrides, and +2.5 dB lead boost via Gain Block**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-02T00:46:57Z
- **Completed:** 2026-03-02T00:50:54Z
- **Tasks:** 2 (Task 1: TDD RED+GREEN, Task 2: barrel exports)
- **Files modified:** 3

## Accomplishments

- `buildSnapshots()` generates 4 deterministic SnapshotSpec objects with per-role LED colors, block states, and parameter overrides
- Volume balancing via ChVol: clean=0.68, crunch=0.72, lead=0.80, ambient=0.65 -- perceptually equal loudness across snapshots
- Lead snapshot gets +2.5 dB via Gain Block override for audible presence boost above other snapshots
- Block state table encodes expert knowledge: delay OFF in clean/rhythm, modulation only in ambient, boost OFF for clean amps in clean snapshot
- Knowledge Layer pipeline complete: all 3 modules (chain-rules, param-engine, snapshot-engine) exported from barrel index
- 50 tests passing across all 3 Knowledge Layer modules (20 + 16 + 14)

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Failing tests** - `be254f2` (test)
2. **Task 1 (TDD GREEN): Implementation + test fix** - `22898e0` (feat)
3. **Task 2: Barrel export update** - `c223f9a` (chore)

_TDD task: RED commit has 14 failing tests (module not found), GREEN commit has implementation + global block key fix in test helper_

## Files Created/Modified

- `src/lib/helix/snapshot-engine.ts` - Snapshot generation module with buildSnapshots() public API (181 lines)
- `src/lib/helix/snapshot-engine.test.ts` - 14 tests covering all 14 specified behaviors
- `src/lib/helix/index.ts` - Added buildSnapshots to barrel exports (Knowledge Layer complete)

## Decisions Made

- **Global block keys:** Used global sequential numbering (`block0`, `block1`, ...) across both DSPs instead of per-DSP keys. Per-DSP keys (`block0` on DSP0, `block0` on DSP1) collide in the flat `Record<string, boolean>` of SnapshotSpec.blockStates. The preset-builder's `buildBlockKeyMap()` already maps global keys to per-DSP keys, so this is safe.
- **Boost behavior in clean snapshot:** For clean amps, the boost (Minotaur) is OFF in the clean snapshot -- clean amps don't need the boost for their clean tone. For crunch/high-gain amps, the boost stays ON even in the clean snapshot because the amp depends on the boost for its character.
- **Block state as function:** Used a function (`getBlockEnabled`) with type/role/context dispatch rather than a static 2D table. This is more extensible and handles edge cases (boost depends on amp category) cleanly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed per-DSP block key collision in flat Record**
- **Found during:** Task 1 (TDD GREEN)
- **Issue:** Per-DSP block keys (`block0` on DSP0, `block0` on DSP1) collided in the flat `Record<string, boolean>` of SnapshotSpec.blockStates, producing only 2 entries instead of 4
- **Fix:** Switched to global sequential block keys (`block0`, `block1`, `block2`, `block3`) which produce unique keys in the flat record. Updated test helper to match.
- **Files modified:** src/lib/helix/snapshot-engine.ts, src/lib/helix/snapshot-engine.test.ts
- **Verification:** All 14 tests pass, block state count matches non-cab block count
- **Committed in:** `22898e0` (part of GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correctness. The plan's block key guidance was ambiguous and suggested per-DSP keys, but flat Record storage requires unique keys. No scope creep.

## Issues Encountered

None beyond the auto-fixed block key collision.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Knowledge Layer is complete: all 3 modules exported from `@/lib/helix` barrel
- Full pipeline type-checks end-to-end: `ToneIntent -> assembleSignalChain -> resolveParameters -> buildSnapshots -> SnapshotSpec[]`
- PresetSpec can now be fully composed from the Knowledge Layer outputs + ToneIntent metadata
- Ready for Phase 3 (Orchestration) to wire AI prompt generation and pipeline invocation

## Self-Check: PASSED

- [x] src/lib/helix/snapshot-engine.ts EXISTS
- [x] src/lib/helix/snapshot-engine.test.ts EXISTS
- [x] .planning/phases/02-knowledge-layer/02-03-SUMMARY.md EXISTS
- [x] Commit be254f2 (test RED) EXISTS
- [x] Commit 22898e0 (feat GREEN) EXISTS
- [x] Commit c223f9a (chore barrel) EXISTS
- [x] 50/50 tests passing (14 snapshot-engine + 16 param-engine + 20 chain-rules)

---
*Phase: 02-knowledge-layer*
*Completed: 2026-03-02*
