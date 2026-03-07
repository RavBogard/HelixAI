---
phase: 71-per-model-effect-intelligence
plan: 01
subsystem: effect-intelligence
tags: [prompt-engineering, param-overrides, genre-selection, effect-models]
dependency_graph:
  requires: []
  provides: [genreEffectModelSection, effect-paramOverrides, paramOverrides-resolution-step]
  affects: [param-engine, models, prompt-integration]
tech_stack:
  added: []
  patterns: [shared-prompt-module, paramOverrides-before-genre]
key_files:
  created:
    - src/lib/families/shared/effect-model-intelligence.ts
    - src/lib/families/shared/effect-model-intelligence.test.ts
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/param-engine.ts
    - src/lib/helix/param-engine.test.ts
decisions:
  - paramOverrides applied BEFORE genre overrides so genre intent wins as outermost layer
  - Shared module follows exact gainStagingSection() pattern for consistency
  - 7 models get paramOverrides: 4 reverb (Ganymede, Glitz, Octo, Plateaux) + 3 delay (Heliosphere, Cosmos Echo, Adriatic Swell)
metrics:
  duration: 5m
  completed: "2026-03-07"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 18
  tests_total: 734
---

# Phase 71 Plan 01: Core Effect Intelligence Data Layer Summary

Genre-informed effect model selection prompt module with delay/reverb/wah genre tables, paramOverrides on 7 effect models with bad defaults, and paramOverrides application step in resolveDefaultParams before genre overrides.

## Tasks Completed

### Task 1: Create shared effect-model-intelligence module and paramOverrides on models
**Commits:** `b8a3a9d` (RED), `0a64d14` (GREEN)

- Created `src/lib/families/shared/effect-model-intelligence.ts` exporting `genreEffectModelSection()` pure function
- Prompt section contains three markdown genre tables: Delay (10 genres), Reverb (10 genres), Wah (5 genres)
- Each table includes Primary Recommendation, Alternative, and Avoid/Why columns
- Added `paramOverrides` to 7 models in `models.ts`:
  - Reverb: Ganymede (Mix: 0.25), Glitz (Mix: 0.22), Octo (Mix: 0.22), Plateaux (Mix: 0.22)
  - Delay: Heliosphere (Feedback: 0.28), Cosmos Echo (Feedback: 0.28), Adriatic Swell (Feedback: 0.28)
- 12 tests: 5 prompt content + 7 paramOverrides data validation

### Task 2: Add paramOverrides step in resolveDefaultParams and test resolution order
**Commits:** `2825f74` (RED), `a2c742a` (GREEN)

- Inserted paramOverrides application step in `resolveDefaultParams()` after defaultParams copy, before genre overrides
- Resolution order: `model defaults -> paramOverrides -> genre overrides -> tempo override`
- Updated JSDoc to document new resolution order
- 6 tests verifying:
  - Without genre hint: Ganymede Mix=0.25 (not default 0.35), Heliosphere Feedback=0.28 (not default 0.35)
  - With genre hint: genre overrides win (blues Mix=0.20 over Ganymede's 0.25, ambient Feedback=0.50 over Cosmos Echo's 0.28)
  - Regression guards: Simple Delay (no paramOverrides) unaffected, Plate (no paramOverrides) unaffected

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **paramOverrides before genre overrides:** Applied BEFORE genre overrides (not after, like amp paramOverrides). Rationale: effect paramOverrides fix model-inherent issues (Ganymede Mix too wet), while genre represents user intent and should win as outermost layer. This differs from amp paramOverrides (Layer 4, wins over everything) because effects have a different resolution pipeline.

2. **Shared module pattern:** Followed exact `gainStagingSection()` pattern: pure function, no side effects, no device-specific content, returns template literal string.

3. **Override values from research:** Used exact values from 71-RESEARCH.md -- Ganymede Mix 0.25, Glitz/Octo/Plateaux Mix 0.22, all three delay models Feedback 0.28.

## Verification

- Full test suite: 734 tests passing (716 existing + 18 new)
- Zero regressions across all 28 test files
- All success criteria met

## Self-Check: PASSED

All 5 files verified present. All 4 commit hashes verified in git log.
