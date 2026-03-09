---
phase: 02-podgo-structure-rewrite
plan: 01
subsystem: preset-builder
tags: [pod-go, pgp, snapshot, footswitch, controller, dsp]

requires:
  - phase: 01-helix-structure-rewrite
    provides: golden preset methodology, delay sync, snapshot Drive
provides:
  - Pod Go builder matching real .pgp export structure
  - Correct snapshot controller ID (11)
  - Correct footswitch indices (1-6)
  - Always 10 blocks with padding
  - Snapshots including all blocks (cabs included)
affects: [03-stomp-structure-rewrite, 06-validation-suite]

tech-stack:
  added: []
  patterns:
    - "Pod Go DSP always padded to 10 blocks (block0-block9)"
    - "Pod Go @pedalstate is always 2 (snapshot mode indicator)"
    - "Invalid snapshots still have full blocks/controllers structure"

key-files:
  modified:
    - src/lib/helix/types.ts
    - src/lib/helix/podgo-builder.ts

key-decisions:
  - "pedalstate always 2: confirmed from all 5 reference presets, no per-block bitfield needed"
  - "empty block model HD2_AppDSPFlowBlock for padding slots"
  - "invalid snapshots default all blocks to true (matches A7X.pgp reference)"

patterns-established:
  - "Pod Go snapshot controller = 11 (not 4, not 19)"
  - "Pod Go FS indices 1-6 (not 0-5)"
  - "Cab blocks included in Pod Go snapshot bypass states"

duration: ~15min
started: 2026-03-08T21:46:00Z
completed: 2026-03-08T21:50:00Z
---

# Phase 2 Plan 01: Pod Go Structure Rewrite Summary

**Pod Go builder rewritten to match real .pgp exports: correct controller (11), FS indices (1-6), 10-block padding, and full snapshot structure including cabs.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files modified | 2 |
| Tests | 1201/1201 passing |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Snapshot Controller Uses ID 11 | Pass | POD_GO_SNAPSHOT_CONTROLLER = 11 in types.ts, all controller entries use @controller: 11 |
| AC-2: Footswitch Indices Are 1-6 | Pass | POD_GO_STOMP_FS_INDICES = [1,2,3,4,5,6], @fs_index values 1-6 in output |
| AC-3: DSP Always Has Exactly 10 Blocks | Pass | Padding loop fills block{N} to block9 with disabled HD2_AppDSPFlowBlock |
| AC-4: Snapshots Include All Blocks Including Cabs | Pass | All 10 blocks in snapshot blocks.dsp0, cabs default to true |
| AC-5: Existing Tests Pass | Pass | 1201/1201 tests, tsc clean |

## Accomplishments

- Fixed 3 critical Pod Go constants (controller 4→11, FS [0-5]→[1-6])
- DSP always emits exactly 10 blocks with padding for unused slots
- Snapshots now include all blocks including cabs (matching real .pgp exports)
- Empty/invalid snapshots have full blocks/controllers structure
- Pedalstate simplified to always return 2 (matches all reference presets)

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1+2 | `af367f6` | feat | Fix constants, DSP padding, snapshot structure, pedalstate |
| Task 3 | — | checkpoint | Human verification approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/types.ts` | Modified | POD_GO_SNAPSHOT_CONTROLLER 4→11, POD_GO_STOMP_FS_INDICES [0-5]→[1-6] |
| `src/lib/helix/podgo-builder.ts` | Modified | 10-block padding, snapshot includes cabs, empty snapshot structure, pedalstate=2 |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| @pedalstate always 2 | All 5 reference presets use 2 regardless of block states | Simplified pedalstate computation, removed bitfield logic |
| HD2_AppDSPFlowBlock for padding | Plan recommendation; real presets always have 10 real models | May need adjustment if Pod Go Edit rejects this model name |
| Invalid snapshots: all blocks true | Matches A7X.pgp where invalid snapshots set all blocks to true | Consistent with real preset behavior |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Pod Go builder now structurally matches real .pgp exports
- Foundation for Phase 3 (HX Stomp Structure Rewrite) established

**Concerns:**
- HD2_AppDSPFlowBlock model name for padding blocks is unverified against Pod Go Edit — may need updating if it rejects the model

**Blockers:**
- None

---
*Phase: 02-podgo-structure-rewrite, Plan: 01*
*Completed: 2026-03-08*
