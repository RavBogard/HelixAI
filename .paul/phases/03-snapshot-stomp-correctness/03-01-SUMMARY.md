---
phase: 03-snapshot-stomp-correctness
plan: 01
subsystem: audio-engine
tags: [snapshots, gain-block, validation, dsp-ordering, dual-amp, pod-go]

requires:
  - phase: 01-audit-preset-quality
    provides: Audit report identifying snapshot/stomp issues
  - phase: 02-fix-signal-chain-gain-staging
    provides: Fixed signal chain ordering and gain staging
provides:
  - Reduced lead snapshot gain boost to safe level (2.0 dB)
  - DSP ordering validation with advisory warnings
  - Documented dual-amp convention and gain block dB encoding
  - Verified Pod Go block key mapping correct
affects: [ai-platform-evaluation, end-to-end-validation]

tech-stack:
  added: []
  patterns:
    - "Advisory validation warnings (console.warn, not throw) for non-critical checks"

key-files:
  created:
    - src/lib/helix/validate.test.ts
  modified:
    - src/lib/helix/snapshot-engine.ts
    - src/lib/helix/snapshot-engine.test.ts
    - src/lib/helix/validate.ts

key-decisions:
  - "CRIT-15 verified correct: Pod Go buildPgpBlockKeyMap intentionally maps cab offset between snapshot and DSP indices"
  - "MED-01 verified correct: Pod Go snapshot count check already works"
  - "MED-12 verified correct: Stomp dsp=0 check already works"
  - "Lead gain reduced 2.5→2.0 dB to prevent clipping with ChVol 0.80"

patterns-established:
  - "DSP ordering validation uses advisory warnings, not errors"

duration: ~10min
started: 2026-03-08T13:12:00Z
completed: 2026-03-08T13:16:00Z
---

# Phase 3 Plan 01: Snapshot / Stomp Correctness Summary

**Reduced lead snapshot gain boost to safe level, added DSP ordering validation, documented dual-amp convention — verified 3 audit items as already correct.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Started | 2026-03-08T13:12:00Z |
| Completed | 2026-03-08T13:16:00Z |
| Tasks | 3 completed |
| Files modified | 4 (+ 1 created) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Pod Go Block Keys Match Snapshot Engine | Pass | Verified correct — no bug, mapping intentionally handles cab offset |
| AC-2: Lead Snapshot Volume Within Safe Range | Pass | Reduced from 2.5→2.0 dB |
| AC-3: Dual-Amp Convention Documented | Pass | Full documentation block added |
| AC-4: DSP Ordering Validation | Pass | Advisory warnings added with 3 tests |
| AC-5: Verified-Correct Issues | Pass | MED-01 and MED-12 confirmed correct |

## Accomplishments

- Verified CRIT-15 (Pod Go block key mismatch) is NOT a bug — the mapping correctly handles cab offset between snapshot engine's cab-excluded indices and Pod Go's cab-included DSP indices
- Reduced lead snapshot gain from 2.5→2.0 dB to prevent clipping when combined with ChVol 0.80
- Added comprehensive dual-amp convention and gain block dB encoding documentation
- Added DSP ordering validation that warns on out-of-order blocks without blocking

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/snapshot-engine.ts` | Modified | Lead gain 2.5→2.0, gain block encoding docs, dual-amp convention docs |
| `src/lib/helix/snapshot-engine.test.ts` | Modified | Updated test to expect 2.0 dB instead of 2.5 |
| `src/lib/helix/validate.ts` | Modified | Added validateDspOrdering() with BLOCK_TYPE_ORDER mapping |
| `src/lib/helix/validate.test.ts` | Created | 3 tests for DSP ordering validation |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| CRIT-15 is correct, not a bug | Pod Go .pgp format includes cabs in block numbering; snapshot engine excludes them. The mapping resolves this offset correctly. | No code change needed |
| Lead gain 2.5→2.0 dB | Combined with ChVol 0.80 (+1.4dB), total ~3.4dB was too aggressive. 2.0+1.4=3.4 reduced to 2.0+1.4=3.4... but 0.5dB less gain headroom | Safer for hot pickups |
| Advisory warnings for ordering | Chain-rules may have valid non-standard ordering; hard errors would be too strict | Validation informs without blocking |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Verified-correct | 3 | CRIT-15, MED-01, MED-12 — no changes needed |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** 3 of 7 audit items verified correct (no bug), reducing scope. No scope creep.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| None | Clean execution |

## Next Phase Readiness

**Ready:**
- Snapshot volume balancing is now safe
- DSP ordering validation catches future regressions
- Dual-amp convention is documented for future development

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 03-snapshot-stomp-correctness, Plan: 01*
*Completed: 2026-03-08*
