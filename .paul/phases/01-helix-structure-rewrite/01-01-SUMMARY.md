---
phase: 01-helix-structure-rewrite
plan: 01
subsystem: helix-builder
tags: [hlx, dsp, preset-structure, routing, split-join, dt, powercab, variax]

requires:
  - phase: v3.0-preset-format-correctness
    provides: DSP routing fix, block @type, stomp assignments
provides:
  - Structurally complete DSP objects matching real HX Edit exports
  - inputB/outputB/split/join on both DSPs always present
  - dt0/dt1/dtdual, powercab0/1/dual, variax metadata sections
  - Correct inputA model on both DSPs (HD2_AppDSPFlow1Input)
affects: [01-plan-02-footswitch-tempo-volume, phase-2-validation-layer]

tech-stack:
  added: []
  patterns: [golden-preset-methodology]

key-files:
  created:
    - .paul/phases/01-helix-structure-rewrite/01-01-PLAN.md
  modified:
    - src/lib/helix/preset-builder.ts
    - src/lib/helix/types.ts

key-decisions:
  - "Golden preset methodology: reverse-engineer from real HX Edit exports, match exactly"
  - "split/join always present on both DSPs regardless of dual-amp detection"
  - "inputA uses HD2_AppDSPFlow1Input on BOTH DSPs (not Flow2Input on DSP1)"

patterns-established:
  - "All DSP structural keys always emitted (no conditional omission)"
  - "Reference .hlx files are ground truth for structure"

duration: ~2h
started: 2026-03-08
completed: 2026-03-08
---

# Phase 1 Plan 01: Helix Structure Rewrite Summary

**Rewrote DSP structure in preset-builder.ts to emit structurally complete .hlx files matching real HX Edit exports — inputB, outputB, split, join on both DSPs plus dt/powercab/variax metadata.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~2h |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 4 completed (3 auto + 1 checkpoint) |
| Files modified | 2 source + 2 planning |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Both DSPs have complete I/O structure | Pass | inputA/inputB/outputA/outputB/split/join on both dsp0 and dsp1 |
| AC-2: DSP0-to-DSP1 routing correct | Pass | dsp0.outputA.@output=2, dsp1.inputA.@input=0, dsp1.outputA.@output=1 |
| AC-3: Split/join use correct models | Pass | HD2_AppDSPFlowSplitY + HD2_AppDSPFlowJoin with @enabled/@position |
| AC-4: Metadata sections present | Pass | dt0/dt1/dtdual, powercab0/1/dual, variax all present |
| AC-5: Snapshot blocks include split | Pass | Split state in snapshot block entries |
| AC-6: Existing tests pass | Pass | All 1201 tests pass |

## Accomplishments

- Both DSPs always emit inputB (HD2_AppDSPFlow2Input) + outputB (@output=0)
- Split (HD2_AppDSPFlowSplitY) + join (HD2_AppDSPFlowJoin) on both DSPs unconditionally
- inputA fixed to HD2_AppDSPFlow1Input on BOTH DSPs (was wrong on DSP1)
- dt0/dt1/dtdual, powercab0/1/dual, variax sections added to all presets
- Split state included in snapshot block entries for dual-amp presets

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Tasks 1-3 | `1fc2ba7` | feat | Complete DSP structure rewrite |
| Task 4 (checkpoint) | — | verify | User loaded Sultans_of_Strat_LT.hlx in HX Edit — structure passes |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/preset-builder.ts` | Modified | Rewrote buildDsp() to emit complete DSP structure |
| `src/lib/helix/types.ts` | Modified | Made inputB/outputB/split/join required on HlxDsp |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Golden preset methodology | Real HX Edit exports are the only reliable reference | All future structure work copies from reference files |
| Unconditional split/join | Real presets always have these regardless of signal chain | Simpler code, matches ground truth |

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None during structural work.

## HX Edit Verification (Task 4 Checkpoint)

User tested `Sultans_of_Strat_LT.hlx` — structure verified. Three **quality issues** noted (all out of scope for Plan 01, scoped to Plan 02):

| Issue | Root Cause | Plan 02 Scope |
|-------|-----------|---------------|
| CLEAN snapshot too crunchy | Amp Drive=0.55 too high; overdrives bypassed correctly but amp breaks up | Snapshot param quality |
| AMBIENT not pad-like | Only enables delays/reverbs with modest mix — no shimmer/swell design | Snapshot role intelligence |
| Delays not dotted 1/8th | Hardcoded Time=0.152s (~16th note) instead of tempo-synced dotted 8th | TempoSync1/SyncSelect1 |

## Skill Audit

/ui-ux-pro-max: Not required (no UI work in this plan) ✓

## Next Phase Readiness

**Ready:**
- Structural foundation complete — all presets now match real HX Edit export format
- Plan 02 can focus purely on quality: footswitch assignments, tempo sync, volume compensation, snapshot param tuning

**Concerns:**
- User feedback confirms quality issues are real and noticeable — Plan 02 needs to address amp drive for clean snapshots, ambient sound design, and delay tempo sync

**Blockers:**
- None

---
*Phase: 01-helix-structure-rewrite, Plan: 01*
*Completed: 2026-03-08*
