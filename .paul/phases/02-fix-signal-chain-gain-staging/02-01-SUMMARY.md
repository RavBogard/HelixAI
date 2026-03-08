---
phase: 02-fix-signal-chain-gain-staging
plan: 01
subsystem: audio-engine
tags: [chain-rules, gain-staging, parameters, signal-chain, dsp-routing]

requires:
  - phase: 01-audit-preset-quality
    provides: Audit report identifying 38 quality issues
provides:
  - Fixed Horizon Gate post-cab positioning with correct DSP routing
  - Corrected Scream 808, Matchstick Ch1, WhoWatt 100 default parameters
  - Fixed high_gain Drive default and COMBO-04 reverb floor
  - Fixed ambient ChVol for proper volume balancing
affects: [snapshot-stomp-correctness, end-to-end-validation]

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/lib/helix/chain-rules.ts
    - src/lib/helix/models.ts
    - src/lib/helix/param-engine.ts
    - src/lib/helix/snapshot-engine.ts
    - src/lib/helix/param-engine.test.ts

key-decisions:
  - "getDspForSlot bug: pre-cab slots (wah/comp/drive/boost/amp/cab) must return DSP0, not fall through to DSP1"
  - "COMBO-01 compressor keys verified correct — no change needed"
  - "Ambient mix boost is correct design (param-engine base + snapshot-engine boost) — no change needed"

patterns-established: []

duration: ~15min
started: 2026-03-08T13:00:00Z
completed: 2026-03-08T13:15:00Z
---

# Phase 2 Plan 01: Fix Signal Chain / Gain Staging Summary

**Fixed 6 signal chain and gain staging issues plus verified 2 as correct — Horizon Gate post-cab routing, Scream 808 defaults, non-MV amp Masters, high-gain Drive, reverb floor, and ambient ChVol.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-03-08T13:00:00Z |
| Completed | 2026-03-08T13:15:00Z |
| Tasks | 3 completed |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Horizon Gate Post-Cab Position | Pass | SLOT_ORDER 5.5, DSP1 for dual-DSP |
| AC-2: Scream 808 Defaults Correct | Pass | Gain=0.50, Tone=0.50, Level=0.0 |
| AC-3: Non-MV Amps Have Master=1.0 | Pass | Matchstick Ch1 and WhoWatt 100 |
| AC-4: High-Gain Drive >= Crunch Drive | Pass | 0.55 > 0.50 |
| AC-5: Ambient ChVol Raised | Pass | 0.70 |
| AC-6: COMBO-01 Compressor Key Fix | Pass | Verified correct, no change needed |
| AC-7: Ambient Mix Single Source of Truth | Pass | Verified correct design, no change needed |
| AC-8: COMBO-04 Reverb Floor Raised | Pass | 0.15 |

## Accomplishments

- Fixed critical getDspForSlot bug where all pre-cab slots (wah, compressor, extra_drive, boost, amp, cab) were falling through to DSP1 instead of returning DSP0
- Corrected 5 parameter values across models.ts, param-engine.ts, and snapshot-engine.ts
- Verified 2 flagged issues (COMBO-01 keys, ambient mix boost) are actually correct design

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/chain-rules.ts` | Modified | Fixed getDspForSlot: pre-cab slots return DSP0, horizon_gate returns DSP1 |
| `src/lib/helix/models.ts` | Modified | Fixed Scream 808 defaults, Matchstick Ch1 Master, WhoWatt 100 Master |
| `src/lib/helix/param-engine.ts` | Modified | Fixed high_gain Drive 0.40→0.55, COMBO-04 reverb floor 0.08→0.15 |
| `src/lib/helix/snapshot-engine.ts` | Modified | Fixed ambient ChVol 0.65→0.70 |
| `src/lib/helix/param-engine.test.ts` | Modified | Updated COMBO-04-2 test for new 0.15 floor |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Pre-cab slots explicitly return DSP0 | Previous code used case fallthrough causing all slots to return DSP1 | Ensures wah/comp/drive/boost/amp/cab stay on DSP0 for dual-DSP devices |
| COMBO-01 keys no change | Threshold, Sensitivity, PeakReduction all match actual compressor models | No impact — verified correct |
| Ambient mix boost no change | param-engine sets base Mix, snapshot-engine boosts for ambient only — correct layered design | No impact — verified correct |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Critical DSP routing bug |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Essential bug fix (getDspForSlot fallthrough), no scope creep.

### Auto-fixed Issues

**1. getDspForSlot case fallthrough bug**
- **Found during:** Task 1 (chain-rules.ts)
- **Issue:** The switch statement had wah/comp/drive/boost/amp/cab cases falling through to `return 1` (DSP1) instead of having their own `return 0`
- **Fix:** Added explicit `return 0` after the pre-cab slot cases
- **Files:** src/lib/helix/chain-rules.ts
- **Verification:** All 124 chain-rules tests pass

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| 2 test failures from prior session (wah/Teemah! missing from DSP0) | Root cause: getDspForSlot case fallthrough putting everything on DSP1. Fixed by adding explicit `return 0` for pre-cab slots. |

## Next Phase Readiness

**Ready:**
- Signal chain ordering and gain staging are now correct
- All parameter defaults verified or fixed
- 833+ tests passing with no regressions

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 02-fix-signal-chain-gain-staging, Plan: 01*
*Completed: 2026-03-08*
