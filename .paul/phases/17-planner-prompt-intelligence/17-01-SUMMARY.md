---
phase: 17-planner-prompt-intelligence
plan: 01
subsystem: ai-prompts
tags: [gemini, planner, prompt-engineering, effect-intelligence, snapshot-roles]

requires:
  - phase: 16-ui-overhaul
    provides: stable UI, ready for backend prompt improvements
provides:
  - Effect combination rules and anti-patterns in all 4 family prompts
  - Effect role assignment guide (always_on/toggleable/ambient) in all 4 family prompts
  - Snapshot role behavior table in all 4 family prompts
  - Amp gain level categorization in all 4 family prompts
affects: [18-builder-logic-enhancement]

tech-stack:
  added: []
  patterns: [per-family prompt enrichment via shared + family-specific sections]

key-files:
  modified:
    - src/lib/families/shared/effect-model-intelligence.ts
    - src/lib/families/helix/prompt.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/stadium/prompt.ts

key-decisions:
  - "Effect combination rules are advisory prompt text, not code-enforced"
  - "Snapshot role table is identical across families (Knowledge Layer behavior is shared)"
  - "Stadium amp gain categorization uses Agoura model names (not HD2)"

patterns-established:
  - "Effect Combination Rules section in each family's effect intelligence output"
  - "Effect Role Assignment Guide section in each family's effect intelligence output"
  - "Snapshot Role Behavior table in Creative Guidelines section of each family prompt"
  - "Amp Gain Level Guide before amp-cab pairing tables"

duration: 5min
completed: 2026-03-09T23:24:00Z
---

# Phase 17 Plan 01: Planner Prompt Intelligence Summary

**Enriched all 4 device family planner prompts with effect combination rules, role assignment guidance, snapshot role behavior, and amp gain categorization.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~5 min |
| Completed | 2026-03-09 |
| Tasks | 3 completed |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Effect Combination Intelligence | Pass | All 4 families have combination rules + anti-patterns |
| AC-2: Snapshot Role Guidance | Pass | Behavior table in all 4 family prompts |
| AC-3: Amp Selection Intelligence | Pass | Gain-level categorization in all 4 families |
| AC-4: Effect Role Assignment Intelligence | Pass | Role guide with anti-patterns in all 4 families |
| AC-5: All Existing Tests Pass | Pass | 1446/1446 tests, 54 files |

## Accomplishments

- Added effect combination rules (good pairings + anti-patterns) tailored per family: Helix dual-DSP layering, Stomp/PodGo budget-conscious combos, Stadium arena-clarity focus
- Added effect role assignment guide (always_on/toggleable/ambient) with common mistakes to avoid — prevents drive-as-always_on and reverb-as-toggleable errors
- Added snapshot role behavior table showing what clean/crunch/lead/ambient actually do to effect bypass states
- Added amp gain level categorization (clean/medium/high-gain) so the planner matches amp to user's described tone

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/families/shared/effect-model-intelligence.ts` | Modified | Added Effect Combination Rules + Effect Role Assignment Guide to all 4 family sections |
| `src/lib/families/helix/prompt.ts` | Modified | Added Snapshot Role Behavior table + Amp Gain Level Guide (HD2 amp names) |
| `src/lib/families/stomp/prompt.ts` | Modified | Added Snapshot Role Behavior table + Amp Gain Level Guide (HD2 amp names) |
| `src/lib/families/podgo/prompt.ts` | Modified | Added Snapshot Role Behavior table + Amp Gain Level Guide (HD2 amp names) |
| `src/lib/families/stadium/prompt.ts` | Modified | Added Snapshot Role Behavior table + Amp Gain Level Guide (Agoura amp names) |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Planner prompts now have richer creative intelligence for Phase 18 (Builder Logic Enhancement)
- All tests passing, no regressions

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 17-planner-prompt-intelligence, Plan: 01*
*Completed: 2026-03-09*
