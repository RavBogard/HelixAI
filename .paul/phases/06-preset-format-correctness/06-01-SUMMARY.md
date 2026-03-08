---
phase: 06-preset-format-correctness
plan: 01
subsystem: preset-builder
tags: [hlx, hlx-format, dsp-routing, footswitch, stomp, block-type]

requires:
  - phase: 01-audit-preset-quality
    provides: initial audit identifying format issues
provides:
  - Correct DSP0→DSP1 routing on dual-DSP devices
  - Comprehensive footswitch assignments across all 4 builders
  - Verified block @type values matching Line 6 firmware
affects: []

tech-stack:
  added: []
  patterns:
    - "Device-aware footswitch index arrays (per-builder, not shared)"
    - "Pedalstate bitmask computation from stomp assignments + snapshot block states"

key-files:
  modified:
    - src/lib/helix/preset-builder.ts
    - src/lib/helix/stomp-builder.ts

key-decisions:
  - "Block @type: modulation=0, send_return=0 (not 4/9) — confirmed from real .hlx exports"
  - "DSP0→DSP1 routing: @output=2 routes to Flow 2, @input=0 receives from DSP0"
  - "Helix stomp indices: primary [7,8,9,10] + secondary [2,3,4,5] for 8 total"
  - "HX Stomp FS indices: 0-2 (3 switches), Stomp XL: 0-4 (5 switches)"
  - "Pod Go and Stadium builders verified correct — no changes needed"

patterns-established:
  - "Each builder owns its own footswitch index constants (not shared via types.ts)"

duration: ~45min
started: 2026-03-08
completed: 2026-03-08
---

# Phase 1 Plan 1: Preset Format Correctness Audit & Fix Summary

**Fixed DSP routing, block @type values, and footswitch assignments across preset-builder and stomp-builder — all 10 device targets now produce structurally correct presets.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~45min (across 2 sessions) |
| Tasks | 4 completed |
| Files modified | 2 |
| Tests | 1201 passed, 0 failed |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: DSP0→DSP1 Signal Routing | Pass | @output=2 routes to DSP1 when dsp1 has blocks |
| AC-2: Comprehensive Stomp Assignments — Helix | Pass | 8 footswitches (primary [7-10] + secondary [2-5]) |
| AC-3: Stomp Assignments — HX Stomp/XL | Pass | Stomp: 3 FS (0-2), XL: 5 FS (0-4) — was empty |
| AC-4: Block Type IDs Match Firmware | Pass | modulation=0, send_return=0 (were 4/9) |
| AC-5: All Existing Tests Pass | Pass | 1201 tests, type check clean |

## Accomplishments

- Fixed DSP0→DSP1 routing: `@output=2` (was 1, routing to physical out instead of Flow 2)
- Fixed block @type: modulation 4→0, send_return 9→0 in both preset-builder and stomp-builder
- Added complete footswitch assignment system to stomp-builder (was `{ dsp0: {}, dsp1: {} }`)
- Expanded Helix footswitch assignments from 4 to 8 (primary + secondary rows)
- Added pedalstate bitmask computation to stomp-builder snapshots

## Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/preset-builder.ts` | Modified | DSP routing fix, @type fix, 8-switch stomp assignments |
| `src/lib/helix/stomp-builder.ts` | Modified | @type fix, added footswitch assignments + pedalstate |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| modulation @type = 0 | Real .hlx presets confirmed: modulation is generic effect (0), not cab (4) | Prevents HX Edit misidentifying blocks |
| send_return @type = 0 | Real .hlx confirmed: send_return is generic (0), not 9 | Correct firmware encoding |
| DSP0 @output = 2 for dual-DSP | Reverse-engineered: value 2 routes to Flow 2 (DSP1) | Signal actually reaches DSP1 blocks |
| Stomp FS indices 0-2 / 0-4 | Consistent with Pod Go pattern for single-DSP devices | Correct firmware encoding for HX Stomp |
| Pod Go / Stadium unchanged | Verified both already had correct implementations | No regressions |

## Deviations from Plan

None — plan executed as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- All 4 builders produce structurally correct preset files
- All device targets have proper footswitch assignments
- DSP routing verified for dual-DSP signal chains

**Concerns:**
- Helix Native device ID 2162690 still unverified (estimated)
- @output=2 value confirmed from research but not from official Line 6 documentation

**Blockers:**
- None

---
*Phase: 06-preset-format-correctness, Plan: 01*
*Completed: 2026-03-08*
