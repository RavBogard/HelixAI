---
phase: 65-device-specific-prompts
plan: 01
subsystem: prompt-engine
tags: [prompts, per-family, device-isolation, dual-dsp]
dependency_graph:
  requires: []
  provides: [per-family-prompts, prompt-router, shared-prompt-sections]
  affects: [planner.ts, gemini.ts, chat-route, generate-route]
tech_stack:
  added: []
  patterns: [composable-prompt-sections, exhaustive-switch-dispatch, cache-safe-prefix]
key_files:
  created:
    - src/lib/families/shared/gain-staging.ts
    - src/lib/families/shared/tone-intent-fields.ts
    - src/lib/families/shared/amp-cab-pairing.ts
    - src/lib/families/helix/prompt.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/stadium/prompt.ts
    - src/lib/prompt-router.ts
  modified: []
decisions:
  - Helix Floor and LT produce identical prompt text for single cache entry
  - Stadium amp-cab pairing uses TODO(Phase62) placeholder
  - Inline resolveFamily() in router until Phase 61 ships
metrics:
  duration: ~12 minutes
  completed: 2026-03-06
---

# Phase 65 Plan 01: Per-Family Prompt Modules Summary

Per-family prompt modules with shared composable sections and exhaustive-switch prompt router replacing monolithic buildPlannerPrompt/getSystemPrompt.

## What Was Built

### Shared Composable Sections (3 files)
- **gain-staging.ts**: Pure function returning gain-staging intelligence text (Drive vs Master vs boost pedal selection). Same for all families.
- **tone-intent-fields.ts**: Parameterized ToneIntent field descriptions with `ToneIntentFieldsOptions` interface (maxEffects, snapshots, includeSecondAmp). Device-varying values injected at call site.
- **amp-cab-pairing.ts**: Generic amp-to-cab pairing table builder accepting `AmpCabPairing[]`. Each family provides its own pairings data.

### Per-Family Prompt Modules (4 files)
- **helix/prompt.ts**: Dual-DSP routing with explicit numbered block-ordering steps (the #1 priority fix). Standard single-amp layout and dual-amp layout documented step by step. Dual-amp only when user explicitly requests. 8 snapshots, includeSecondAmp=true.
- **stomp/prompt.ts**: Dream-then-trim flow with explicit trade-off questions. Uses STOMP_CONFIG constants for block/snapshot limits. Genre-based priority hierarchy for over-budget. Stomp=6 blocks/3 snaps, StompXL=9 blocks/4 snaps.
- **podgo/prompt.ts**: Hard 4-effect limit with empowering framing. "4 slots is plenty for a killer tone." No stretch configurations. 4 snapshots.
- **stadium/prompt.ts**: Arena-grade personality with FOH/live-sound vocabulary. Agoura-native model naming. TODO(Phase62) placeholder for amp-cab pairing table. 8 snapshots.

### Prompt Router (1 file)
- **prompt-router.ts**: Exhaustive switch dispatch via inline `resolveFamily()`. Exports `getFamilyPlannerPrompt(device, modelList)` and `getFamilyChatPrompt(device)`. TypeScript compiler enforces all four families are covered. TODO(Phase61) to replace inline resolveFamily.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b45e3f7 | Shared composable prompt sections (3 files) |
| 2 | 7145502 | Per-family prompt modules and prompt router (5 files) |

## Verification Results

- Full project `tsc --noEmit`: PASSED (zero errors)
- Cross-family isolation (Agoura_ in non-Stadium): PASSED (0 results in code)
- Cross-family isolation (HD2 names in Stadium): PASSED (0 results in code)
- Helix prompt contains DSP0/DSP1/split block/join/numbered steps: PASSED (17 occurrences)
- Stomp prompt contains trade-off language: PASSED (7 occurrences)
- PodGo prompt contains 4-slot framing: PASSED (11 occurrences)
- Stadium prompt contains FOH/arena/live-sound vocabulary: PASSED (24 occurrences)

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Helix Floor/LT identical prompts**: Both produce byte-identical prompt text to share a single Anthropic cache entry. Device name variation goes in the user message only.
2. **Stadium amp-cab pairing placeholder**: Used `// TODO(Phase62)` instead of hardcoding Agoura amp names, per research pitfall guidance.
3. **Inline resolveFamily()**: Implemented directly in prompt-router.ts with `// TODO(Phase61)` comment for future replacement.
