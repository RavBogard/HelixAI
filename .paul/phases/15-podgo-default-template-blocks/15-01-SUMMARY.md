---
phase: 15-podgo-default-template-blocks
plan: 01
subsystem: preset-builder
tags: [podgo, template-blocks, volume-pedal, wah, fxloop, output-gain]

requires:
  - phase: 14-regression-suite
    provides: audit regression suite for validation
provides:
  - Pod Go template blocks (Volume Pedal, Wah, FX Loop) at fixed positions
  - Output gain snapshot controller (@controller:11)
  - Reference-matching block layout
affects: []

tech-stack:
  added: []
  patterns: [template block injection at builder level, user blocks fill non-reserved positions]

key-files:
  created: [src/lib/helix/podgo-builder.test.ts]
  modified: [src/lib/helix/podgo-builder.ts, src/lib/helix/types.ts, src/lib/helix/exp-controller-podgo.test.ts]

key-decisions:
  - "Template blocks are builder-level only — chain-rules.ts unchanged"
  - "User blocks fill positions [2,3,5,6,7,8,9] around template positions [0,1,4]"
  - "Output gain controller uses @controller:11 with range -60 to 24 dB"

patterns-established:
  - "POD_GO_TEMPLATE_POSITIONS set for fixed-position block reservation"

duration: ~10min
completed: 2026-03-09
---

# Phase 15 Plan 01: Pod Go Default Template Blocks Summary

**Pod Go presets now include always-present Volume Pedal (block0), Wah (block1), and FX Loop (block4) matching real Pod Go Edit defaults, plus output gain snapshot controller.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-03-09 |
| Tasks | 2 completed |
| Files modified | 4 |
| Tests | 1446 passing (7 new) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Template Blocks Present | Pass | Volume(block0), Wah(block1), FXLoop(block4) confirmed in output |
| AC-2: Output Gain Controller | Pass | controller.dsp0.output.gain with @controller:11 |
| AC-3: Block Count Preserved | Pass | Exactly 10 blocks (block0-block9) in all presets |
| AC-4: Regression Suite Passes | Pass | 1446 tests pass (1439 existing + 7 new) |

## Accomplishments

- Template blocks injected at fixed positions matching Pod Go Edit defaults
- User effect blocks correctly shifted to positions [2,3,5,6,7,8,9]
- Output gain snapshot controller with @controller:11 and -60/+24 dB range
- Snapshot bypass states include template blocks (VolumePedal=on, Wah=off, FXLoop=off)
- Block key map, footswitch, and stomp assignment functions updated for new positions

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/types.ts` | Modified | Added POD_GO_TEMPLATE_BLOCKS and POD_GO_TEMPLATE_POSITIONS constants |
| `src/lib/helix/podgo-builder.ts` | Modified | Template block injection, user block positioning, output gain controller |
| `src/lib/helix/podgo-builder.test.ts` | Created | 7 tests for template blocks and output gain controller |
| `src/lib/helix/exp-controller-podgo.test.ts` | Modified | Updated 4 tests for new block positions |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Template blocks at builder level only | Chain rules handles signal chain assembly; template blocks are Pod Go Edit defaults, not part of tone intent | chain-rules.ts untouched |
| User slots = [2,3,5,6,7,8,9] | Positions 0,1,4 reserved for Vol/Wah/FXLoop; 7 slots available for user content | Sufficient for amp+cab+4 effects+padding |
| Output gain range -60 to +24 | Matches Pod Go Edit gain range for output block | Full range available via snapshots |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Essential — existing tests referenced old block positions |

**Total impact:** Essential fix, no scope creep.

### Auto-fixed Issues

**1. EXP controller tests used old block positions**
- **Found during:** Task 2 (test verification)
- **Issue:** 4 tests in exp-controller-podgo.test.ts expected wah at block0, volume at block3 — now block2 and block6
- **Fix:** Updated block key references in assertions
- **Verification:** All 1446 tests pass

## Next Phase Readiness

**Ready:**
- v5.0 milestone Phase 15 complete — all 8 phases done
- Pod Go presets now structurally match reference presets for template blocks

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 15-podgo-default-template-blocks, Plan: 01*
*Completed: 2026-03-09*
