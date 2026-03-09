---
phase: 01-helix-structure-rewrite
plan: 02
subsystem: preset-engine
tags: [helix, delay, tempo-sync, snapshots, amp-drive, ambient]

# Dependency graph
requires:
  - phase: 01-helix-structure-rewrite/01-01
    provides: DSP structure rewrite, split/join, routing, footswitch assignments
provides:
  - Tempo-synced delays with TempoSync1/SyncSelect1 parameters
  - Per-snapshot amp Drive control (clean=0.30, crunch=0.50, lead=0.60, ambient=0.35)
  - Atmospheric ambient snapshots with boosted delay/reverb mix and longer decay
  - Correct delay Time formula (60/BPM, was broken at 30/BPM)
affects: [validation-layer, stadium-fixes, podgo-fixes]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-snapshot parameter overrides via controller section, hardware tempo sync params]

key-files:
  created: []
  modified:
    - src/lib/helix/param-engine.ts
    - src/lib/helix/snapshot-engine.ts
    - src/lib/helix/param-engine.test.ts

key-decisions:
  - "TempoSync1=true when BPM present, false otherwise (fallback to Time in seconds)"
  - "SyncSelect1 mapping: quarter=4, triplet=5, eighth=6, dotted_eighth=8"
  - "Amp Drive as snapshot controller (@controller=19) with min/max from role table"
  - "Ambient mix boosts: delay +0.25, reverb +0.20, decay x1.5"

patterns-established:
  - "ROLE_DRIVE table pattern: per-snapshot amp parameter control alongside ROLE_CHVOL"
  - "Hardware tempo sync: always emit TempoSync1+SyncSelect1, keep Time as fallback"

# Metrics
duration: ~45min
started: 2026-03-08
completed: 2026-03-08
---

# Phase 1 Plan 02: Delay Tempo Sync, Per-Snapshot Drive, Ambient Sound Design — Summary

**Fixed delay tempo sync (TempoSync1/SyncSelect1), per-snapshot amp Drive control for clean/crunch/lead/ambient differentiation, and atmospheric ambient snapshot sound design with boosted mix and decay values.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45min |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 2 auto + 1 checkpoint |
| Files modified | 3 source + 1 test |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Delays Use Tempo Sync Parameters | Pass | TempoSync1 + SyncSelect1 emitted on all delay blocks |
| AC-2: Clean Snapshot Sounds Clean | Pass | Drive=0.30 for clean, controller section includes Drive min/max |
| AC-3: Ambient Snapshot Sounds Atmospheric | Pass | Delay mix +0.25, reverb mix +0.20, decay x1.5 |
| AC-4: Time Formula Correct Values | Pass | 60/148*0.75=0.304s (was 0.152s with broken 30/BPM) |
| AC-5: Existing Tests Pass | Pass | All 1201 tests pass, tsc clean |

## Accomplishments

- Fixed delay Time formula from 30/BPM to 60/BPM — dotted 8th at 148 BPM now correctly calculates to ~0.304s
- Added TempoSync1 (boolean) and SyncSelect1 (integer subdivision) to all delay blocks, matching real HX Edit export patterns
- Introduced per-snapshot amp Drive control via ROLE_DRIVE table and controller section, making CLEAN actually sound clean (0.30) vs LEAD (0.60)
- Boosted ambient snapshot delay mix (+0.25), reverb mix (+0.20), and reverb decay (x1.5) for noticeably atmospheric sound

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Tasks 1-2 | `4232c92` | feat | Fix delay tempo sync, per-snapshot amp Drive, ambient sound design |
| Task 3 | checkpoint | verify | HX Edit verification (user-confirmed) |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/param-engine.ts` | Modified | Fixed Time formula (60/BPM), added TempoSync1/SyncSelect1 emission |
| `src/lib/helix/snapshot-engine.ts` | Modified | ROLE_DRIVE table, per-snapshot Drive overrides, ambient mix/decay boosts |
| `src/lib/helix/param-engine.test.ts` | Modified | Updated test expectations for new tempo sync params and corrected Time values |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| TempoSync1=true only when BPM present | Matches real preset behavior — no tempo hint means free-running delay | Future presets without BPM still work correctly |
| Drive as controller 19 | Follows HX Edit convention for snapshot-controlled parameters | HX Edit displays Drive as snapshot-switchable |
| Ambient delay mix +0.25 (not +0.15) | Original +0.15 barely audible over dry signal | More dramatic ambient/non-ambient contrast |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | - |
| Scope additions | 0 | - |
| Deferred | 0 | - |

**Total impact:** Plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Helix/LT/Rack/Native preset structure now matches real HX Edit exports (Plan 01 + 02)
- Phase 1 complete — all structural and quality issues from golden preset analysis resolved
- Foundation ready for Phase 2 (Validation Layer) to build deterministic checks against

**Concerns:**
- Known issues list in STATE.md (footswitch completeness, stadium/Pod Go) are Phase 2-3 scope
- Helix Native device ID 2162690 still unverified

**Blockers:**
- None

---
*Phase: 01-helix-structure-rewrite, Plan: 02*
*Completed: 2026-03-08*
