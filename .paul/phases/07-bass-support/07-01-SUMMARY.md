---
phase: 07-bass-support
plan: 01
subsystem: api
tags: [bass, amp-models, cab-models, tone-intent, catalog]

requires:
  - phase: 06-validation-intent-fidelity
    provides: All device builders structurally correct + intent validation
provides:
  - 19 bass amp models in AMP_MODELS with instrument: "bass"
  - 8 bass cab models in CAB_MODELS with instrument: "bass"
  - instrument field on ToneIntent schema ("guitar" | "bass")
  - All 4 family catalogs auto-include bass models
affects: [07-02-bass-prompt-intelligence, planner-prompts, chat-prompts]

tech-stack:
  added: []
  patterns: [instrument-tagged-models, optional-instrument-field]

key-files:
  created: []
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/types.ts
    - src/lib/helix/tone-intent.ts
    - src/lib/families/shared/tone-intent-fields.ts

key-decisions:
  - "ToneIntent instrument field uses .optional() not .default() — Zod .default() output type is required, breaking 5 test files"
  - "Bass amp HD2 model IDs follow naming convention — UNVERIFIED against real exports"
  - "Catalogs auto-include bass models via Object.keys() — no catalog file changes needed"
  - "Added Ampeg and Other to AmpFamily type union"

patterns-established:
  - "instrument tag pattern: HelixModel.instrument optional field, undefined = guitar"

duration: ~10min
started: 2026-03-08T22:48:00Z
completed: 2026-03-08T22:58:00Z
---

# Phase 7 Plan 01: Bass Data & Schema Layer Summary

**19 bass amp models + 8 bass cab models added to model database with instrument tagging, ToneIntent schema extended with optional instrument field, all family catalogs auto-include bass models.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Started | 2026-03-08T22:48:00Z |
| Completed | 2026-03-08T22:58:00Z |
| Tasks | 3 completed |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Bass Amp Models in Database | Pass | 19 bass amps with instrument: "bass", bass-appropriate defaultParams |
| AC-2: Bass Cab Models in Database | Pass | 8 bass cabs with instrument: "bass", lower LowCut (40Hz) for sub content |
| AC-3: ToneIntent Instrument Field | Pass | .optional() field, undefined defaults to guitar in consuming code |
| AC-4: Family Catalogs Include Bass Models | Pass | Dynamic Object.keys() auto-includes — no catalog changes needed |
| AC-5: Existing Tests Pass | Pass | 1248/1248 tests, tsc clean |

## Accomplishments

- Added 19 bass amp models covering Ampeg SVT family, Mesa Bass, Aguilar, GK, Acoustic, Sunn, Pearce, and Fender Bassman
- Added 8 bass cab models (1x15, 2x15, 4x10, 6x10, 8x10 configurations)
- Extended ToneIntent schema with backward-compatible instrument field
- Zero test regressions — all 1248 tests pass

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/models.ts` | Modified | 19 bass amps + 8 bass cabs with instrument tag |
| `src/lib/helix/types.ts` | Modified | Added "Ampeg" and "Other" to AmpFamily union |
| `src/lib/helix/tone-intent.ts` | Modified | Added optional instrument field to schema |
| `src/lib/families/shared/tone-intent-fields.ts` | Modified | Added instrument field to planner prompt text |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| .optional() not .default("guitar") | Zod .default() makes output type required, breaking test fixtures | Consuming code must treat undefined as "guitar" |
| No catalog file changes | All catalogs use Object.keys(AMP_MODELS/CAB_MODELS) dynamically | Bass models auto-included; Stadium amps unaffected (uses STADIUM_AMPS) |
| Bass cab Distance: 1.0 | Validation test enforces 0-1 normalized range on Distance param | Consistent with guitar cab Distance values |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 2 | Minor — type system alignment |

**Total impact:** Essential fixes, no scope creep

### Auto-fixed Issues

**1. AmpFamily type missing "Ampeg" and "Other"**
- **Found during:** Task 1
- **Issue:** Bass amps needed ampFamily values not in AmpFamily union
- **Fix:** Added "Ampeg" | "Other" to AmpFamily type in types.ts
- **Verification:** tsc clean

**2. Bass cab Distance: 2.0 out of validation range**
- **Found during:** Task 1 verification
- **Issue:** model-defaults-validation.test.ts enforces 0-1 range on Distance param
- **Fix:** Changed Distance to 1.0 (consistent with guitar cabs)
- **Verification:** All 1248 tests pass

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Bass amp/cab data available for all device families (except Stadium amps which use Agoura-era catalog)
- ToneIntent can express instrument type for planner consumption
- Plan 02 can focus purely on prompt intelligence (chat + planner + gain staging)

**Concerns:**
- Bass amp HD2 model IDs are UNVERIFIED — may need correction from real .hlx bass preset exports
- Stadium bass support limited to cabs only (no bass amps in STADIUM_AMPS Agoura catalog)

**Blockers:**
- None

---
*Phase: 07-bass-support, Plan: 01*
*Completed: 2026-03-08*
