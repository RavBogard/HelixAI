---
phase: 71-per-model-effect-intelligence
plan: 02
subsystem: prompt-integration
tags: [prompt-engineering, genre-selection, effect-models, system-prompt]
dependency_graph:
  requires: [genreEffectModelSection]
  provides: [genre-effect-guidance-in-all-prompts]
  affects: [helix-prompt, stomp-prompt, stadium-prompt, podgo-prompt]
tech_stack:
  added: []
  patterns: [shared-prompt-section-import, static-cache-placement]
key_files:
  created: []
  modified:
    - src/lib/families/helix/prompt.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/stadium/prompt.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/helix/prompt.test.ts
    - src/lib/families/stomp/prompt.test.ts
    - src/lib/families/stadium/prompt.test.ts
    - src/lib/families/podgo/prompt.test.ts
decisions:
  - genreEffectModelSection placed after amp-cab pairing, before Effect Discipline by Genre
  - Stadium insertion after buildAmpCabPairingTable block, before Stadium-Specific Features
  - Only in buildPlannerPrompt (planner makes model selections), not in getSystemPrompt (chat personality)
metrics:
  duration: 2m
  completed: "2026-03-07"
  tasks_completed: 1
  tasks_total: 1
  tests_added: 17
  tests_total: 751
---

# Phase 71 Plan 02: Prompt Integration Summary

Genre-informed effect model selection section wired into all 4 family planner prompts (helix, stomp, stadium, podgo) with 17 alignment tests verifying section presence, content tables, and cache identity preservation.

## Tasks Completed

### Task 1: Add genreEffectModelSection() to all 4 family prompts with alignment tests
**Commits:** `8429f39` (RED), `174dc35` (GREEN)

- Added import of `genreEffectModelSection` from `../shared/effect-model-intelligence` in all 4 prompt files
- Inserted `${genreEffectModelSection()}` into `buildPlannerPrompt()` in all 4 families:
  - **Helix:** After `ampCabPairingSection(HELIX_AMP_CAB_PAIRINGS)`, before `## Effect Discipline by Genre`
  - **Stomp:** After `ampCabPairingSection(STOMP_AMP_CAB_PAIRINGS)`, before `## Effect Discipline by Genre`
  - **Stadium:** After `buildAmpCabPairingTable()` block, before `## Stadium-Specific Features`
  - **Pod Go:** After `ampCabPairingSection(PODGO_AMP_CAB_PAIRINGS)`, before `## Effect Discipline by Genre`
- NOT added to `getSystemPrompt()` (chat personality does not make model selections)
- 17 new tests across all 4 test files:
  - Helix: 5 tests (section presence, cache position, delay/reverb/wah table content)
  - Stomp: 4 tests (section presence, delay/reverb/wah table content)
  - Stadium: 4 tests (section presence, delay/reverb/wah table content)
  - Pod Go: 4 tests (section presence, delay/reverb/wah table content)
- Cache identity verified: helix_lt === helix_floor, helix_stomp === helix_stomp_xl

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Insertion point consistency:** All HD2 families (helix, stomp, podgo) place the section after `ampCabPairingSection()` and before `## Effect Discipline by Genre`. Stadium places it after its custom `buildAmpCabPairingTable()` block and before `## Stadium-Specific Features`, matching the plan's guidance.

2. **Planner-only placement:** The section is only in `buildPlannerPrompt()` because the planner is the agent that selects effect models. The chat prompt (`getSystemPrompt()`) is the interview personality and does not make model selections.

3. **Static cache placement:** The section is in the static system prompt (before "Based on the conversation") to preserve cache hit rates. No dynamic content is added.

## Verification

- Full test suite: 751 tests passing (734 existing + 17 new)
- Zero regressions across all 28 test files
- genreEffectModelSection appears in exactly 4 prompt.ts files (helix, stomp, stadium, podgo)
- No occurrences in getSystemPrompt functions
- All success criteria met:
  - INTEL-01 (delay genre tables): present in all 4 prompts
  - INTEL-02 (reverb genre tables): present in all 4 prompts
  - INTEL-03 (wah genre tables): present in all 4 prompts
  - INTEL-04 (static system prompt placement): verified by cache position test

## Self-Check: PASSED

All 8 modified files verified present. Both commit hashes (8429f39, 174dc35) verified in git log.
