---
phase: 60-tech-debt-cleanup
plan: 01
subsystem: param-engine, planner
tags: [helix, reverb, spring, predelay, cab-affinity, amp-family, planner-prompt, tdd]

# Dependency graph
requires:
  - phase: 57-fx-intelligence
    provides: "resolveDefaultParams() with if(key in params) guard; GENRE_EFFECT_DEFAULTS with PreDelay values per genre"
  - phase: 56-per-model-amp-overrides
    provides: "AmpFamily type and ampFamily field on HelixModel; cabAffinity field on AMP_MODELS entries"
  - phase: 55-planner-prompt-enrichment
    provides: "buildPlannerPrompt() with static enrichment sections (Gain-Staging, Amp-to-Cab, Effect Discipline)"
provides:
  - "'63 Spring, Double Tank, Spring reverb models include PreDelay: 0 in defaultParams — genre PreDelay now applied"
  - "buildPlannerPrompt() generates dynamic Per-Model Cab Affinity section grouped by ampFamily"
  - "INT-01 closed: cabAffinity and ampFamily are runtime-consumed, not orphaned"
  - "INT-02 closed: spring reverb genre PreDelay gap fixed"
  - "8 new TDD tests proving both gap closures"
affects: [planner, param-engine, preset-generation, prompt-caching]

# Tech tracking
tech-stack:
  added: []
  patterns: [tdd-red-green, if-key-in-params guard, static-prompt-section-generation, ampfamily-grouping]

key-files:
  created: []
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/param-engine.test.ts
    - src/lib/planner.ts
    - src/lib/planner.test.ts

key-decisions:
  - "PreDelay: 0 added as the default (not omitted) — spring tanks have no physical pre-delay but the key must exist for the if(key in params) guard to allow genre override"
  - "Per-Model Cab Affinity section generated at build time from AMP_MODELS — static text, no device interpolations, cache-safe"
  - "Section placed after static family-level table (quick reference) and before Effect Discipline by Genre — both levels of guidance coexist"
  - "ampFamily 'Other' group sorted last; remaining families sorted alphabetically for readability"

patterns-established:
  - "if(key in params) guard pattern: model defaultParams must include the key (even at 0) for genre/intent overrides to apply"
  - "Dynamic prompt section generation: iterate AMP_MODELS at build time, produce static string — same pattern could extend to effect or cab metadata"

requirements-completed: [FX-02, AMP-01, AMP-05]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 60 Plan 01: Tech Debt Cleanup — Spring Reverb PreDelay + Cab Affinity Summary

**Closed INT-01 and INT-02: spring reverb models now receive genre-based PreDelay (via PreDelay: 0 in defaultParams), and buildPlannerPrompt() now generates a dynamic Per-Model Cab Affinity section from AMP_MODELS grouped by ampFamily**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-05T20:47:24Z
- **Completed:** 2026-03-05T20:52:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Fixed INT-02: three spring reverb models ('63 Spring, Double Tank, Spring) silently dropped genre PreDelay because their defaultParams lacked the PreDelay key — added `PreDelay: 0` to each
- Fixed INT-01: cabAffinity and ampFamily fields on AMP_MODELS were populated but never consumed at runtime — now read by buildPlannerPrompt() to generate a grouped Per-Model Cab Affinity section
- 8 new TDD tests verify both fixes: 4 in param-engine.test.ts (INT-02-1 through INT-02-4), 4 in planner.test.ts (Tests 11-14)
- All 223 tests pass — 215 pre-existing + 8 new, zero regressions

## Task Commits

Each task was committed atomically using TDD (RED then GREEN):

1. **Task 1 RED: Spring reverb PreDelay failing tests** - `8e30ad6` (test)
2. **Task 1 GREEN: Add PreDelay: 0 to spring reverb models** - `bfdae4c` (feat)
3. **Task 2 RED: Planner cab affinity failing tests** - `0bee018` (test)
4. **Task 2 GREEN: Wire cabAffinity and ampFamily into buildPlannerPrompt** - `09dde02` (feat)

_Note: TDD tasks have separate RED (test) and GREEN (feat) commits as required._

## Files Created/Modified

- `src/lib/helix/models.ts` - Added `PreDelay: 0` to '63 Spring, Double Tank, Spring defaultParams
- `src/lib/helix/param-engine.test.ts` - Added 4 INT-02 tests proving spring reverb genre PreDelay
- `src/lib/planner.ts` - Added AMP_MODELS import and cabAffinitySection generation logic; inserted section into prompt
- `src/lib/planner.test.ts` - Added 4 INT-01 tests proving Per-Model Cab Affinity section in prompt

## Decisions Made

- PreDelay: 0 as default value (not absent) — spring tanks have no physical pre-delay but the key must exist for the `if (key in params)` guard in resolveDefaultParams() to allow genre-based override
- Cab affinity section is generated at prompt build time as static text — no device-conditional interpolations that would fragment the prompt cache into per-device buckets
- Section placed after the static family-level table (quick reference retained) and before Effect Discipline by Genre — both levels of guidance coexist for AI consumption
- ampFamily "Other" group sorted last; remaining families sorted alphabetically

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- INT-01 and INT-02 from v4.0 milestone audit are closed
- All 3 spring reverb models now accept genre PreDelay from GENRE_EFFECT_DEFAULTS
- buildPlannerPrompt() now surfaces 86 amp entries with manufacturer-matched cab pairings
- Phase 60 Plan 02 (Stadium I/O constants) was already executed on this branch — all tech debt items addressed

---
*Phase: 60-tech-debt-cleanup*
*Completed: 2026-03-05*

## Self-Check: PASSED
