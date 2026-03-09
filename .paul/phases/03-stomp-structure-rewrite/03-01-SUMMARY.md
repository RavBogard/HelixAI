---
phase: 03-stomp-structure-rewrite
plan: 01
subsystem: preset-builder
tags: [hlx, hx-stomp, stomp-xl, dsp, snapshot, footswitch, split-join]

requires:
  - phase: 02-podgo-structure-rewrite
    provides: golden-preset methodology, Pod Go builder patterns
provides:
  - HX Stomp builder matching real .hlx exports
  - Correct I/O structure (inputB/outputB, split/join)
  - Correct snapshot controller (9), FS indices (1-based), pedalstate (0)
  - Complete global fields
affects: [04-helix-lt-structure-rewrite, 06-cross-device-validation]

tech-stack:
  added: []
  patterns: [shared getBlockTypeForDevice for block type resolution]

key-files:
  created: []
  modified:
    - src/lib/helix/stomp-builder.ts
    - src/lib/helix/types.ts

key-decisions:
  - "STOMP_SNAPSHOT_CONTROLLER = 9 (distinct from Helix 19 and Pod Go 11)"
  - "@pedalstate always 0 for HX Stomp (not bitmask like originally assumed)"
  - "Empty snapshots include blocks/controllers structure (Moving Pictures pattern)"
  - "Use shared getBlockTypeForDevice instead of local getBlockType"

patterns-established:
  - "Device-specific snapshot controller constants in types.ts"
  - "Empty snapshot includes blocks structure for all device builders"

duration: 15min
started: 2026-03-08T22:00:00Z
completed: 2026-03-08T22:15:00Z
---

# Phase 3 Plan 01: HX Stomp Structure Rewrite Summary

**HX Stomp builder rewritten to match real .hlx exports — inputB/outputB, split/join, controller ID 9, 1-based FS indices, pedalstate 0, complete global fields.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: DSP has inputB, outputB, split, join | Pass | inputB (@input:0), outputB (@output:0), split (@position:0), join (@position:8) |
| AC-2: Snapshot controller uses ID 9 | Pass | STOMP_SNAPSHOT_CONTROLLER = 9, replaces CONTROLLERS.SNAPSHOT (19) |
| AC-3: Footswitch indices 1-based | Pass | STOMP_FS_INDICES = [1,2,3], STOMP_XL_FS_INDICES = [1,2,3,4,5] |
| AC-4: Pedalstate always 0 | Pass | computeStompPedalState returns 0, global @pedalstate = 0, empty snapshot = 0 |
| AC-5: Global has complete fields | Pass | @DtSelect, @PowercabMode, @PowercabSelect, @PowercabVoicing added |
| AC-6: Existing tests pass | Pass | 1201/1201 tests pass, TypeScript clean |

## Accomplishments

- Added inputB/outputB and split/join to dsp0, matching all 5 reference presets
- Fixed snapshot controller from 19 → 9 (CATS NO OTO4.hlx confirmed)
- Fixed footswitch indices from 0-based to 1-based (Bass Rig, SOLAR confirmed)
- Replaced local getBlockType with shared getBlockTypeForDevice (fixes modulation @type: 0→4)
- Empty snapshots now include blocks/controllers structure (Moving Pictures pattern)

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1-2 | `e1eb204` | feat | All structural changes in single commit |
| Task 3 | — | checkpoint | Human verification approved |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/stomp-builder.ts` | Modified | Added inputB/outputB, split/join, fixed controller/FS/pedalstate, device-specific block types |
| `src/lib/helix/types.ts` | Modified | Added STOMP_SNAPSHOT_CONTROLLER = 9 |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| STOMP_SNAPSHOT_CONTROLLER = 9 | Confirmed from CATS NO OTO4.hlx reference | Distinct from Helix (19) and Pod Go (11) |
| @pedalstate always 0 | All 5 reference presets show 0 for every snapshot | Simplified computeStompPedalState |
| Use getBlockTypeForDevice | Shared logic, fixes modulation @type (was 0, should be 4) | Consistent block type resolution across builders |
| Empty snapshots have blocks/controllers | Moving Pictures.hlx invalid snapshots have full structure | Matches real firmware behavior |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- HX Stomp structure matches real exports
- Pattern established for remaining device rewrites (Phase 4: LT, Phase 5: Stadium)

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 03-stomp-structure-rewrite, Plan: 01*
*Completed: 2026-03-08*
