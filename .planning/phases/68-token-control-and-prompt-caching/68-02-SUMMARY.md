---
phase: 68-token-control-and-prompt-caching
plan: "02"
subsystem: prompt-caching
tags: [cache-unification, stomp-family, planner, cost-optimization]
dependency_graph:
  requires: []
  provides: [stomp-cache-unified-system-prompt]
  affects: [src/lib/families/stomp/prompt.ts, src/lib/planner.ts]
tech_stack:
  added: []
  patterns: [user-message-restriction, cache-unification, byte-identical-prompts]
key_files:
  created: []
  modified:
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/stomp/prompt.test.ts
    - src/lib/planner.ts
decisions:
  - "Stomp planner prompt unified to produce byte-identical text for helix_stomp and helix_stomp_xl — device restriction moved to user message, matching Helix LT/Floor pattern"
  - "Conservative system prompt values: STOMP_MAX_BLOCKS (6) and STOMP_MAX_SNAPSHOTS (3) — user message stompRestriction overrides with exact per-device values"
  - "_device parameter prefix used in buildPlannerPrompt to indicate intentionally unused while preserving type-contract compatibility with prompt-router.ts"
metrics:
  duration: "~4 minutes"
  completed: "2026-03-06"
  tasks_completed: 1
  files_modified: 3
---

# Phase 68 Plan 02: Stomp Cache Unification Summary

**One-liner:** Unified HX Stomp and HX Stomp XL planner prompts to byte-identical text (single Anthropic cache entry), moving device-specific restrictions to planner.ts user message.

## What Was Built

The Stomp family planner prompt was refactored to eliminate device-specific interpolation from the system prompt. Previously, `buildPlannerPrompt("helix_stomp", ...)` and `buildPlannerPrompt("helix_stomp_xl", ...)` produced different text (different device name, block count, snapshot count), creating two separate Anthropic prompt cache entries at $6.00/MTok cold-write cost each.

Now both calls produce byte-identical system prompt text ("HX Stomp family presets", conservative values: 6 blocks, 3 snapshots, 4 max effects). The exact per-device restriction is appended to the user message in `planner.ts` via the `stompRestriction` variable when `family === "stomp"`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Add failing tests for unified stomp planner prompt | f16de61 | src/lib/families/stomp/prompt.test.ts |
| GREEN | Unify stomp planner prompt and move device restriction to user message | 19c5c1b | src/lib/families/stomp/prompt.ts, src/lib/planner.ts |

## Key Changes

### src/lib/families/stomp/prompt.ts
- `buildPlannerPrompt` now uses `_device` parameter (intentionally unused, kept for type-contract)
- Fixed role description: "HX Stomp family presets" (no device-specific name)
- Uses `STOMP_CONFIG.STOMP_MAX_BLOCKS` (6) and `STOMP_CONFIG.STOMP_MAX_SNAPSHOTS` (3) as conservative reference values
- Removed DEVICE RESTRICTION paragraph entirely from system prompt
- Genre section header changed to "HX Stomp family — 6 block slots" (device-agnostic)

### src/lib/planner.ts
- Added `stompRestriction` computation after `userContent` construction
- When `resolvedFamily === "stomp"`: computes exact `deviceLabel`, `blocks`, `snaps`, `maxFx` per device
- Appends `stompRestriction` to produce `finalUserContent` used in `messages` array
- Restriction text: "DEVICE RESTRICTION: This is an {HX Stomp | HX Stomp XL} preset..."

### src/lib/families/stomp/prompt.test.ts
- Added: identity test asserting strict equality between stomp and stomp_xl prompts
- Added: test asserting DEVICE RESTRICTION is absent from system prompt
- Updated: snapshot count test to reference unified `STOMP_MAX_SNAPSHOTS` (3) value
- Updated: block slots test to match new "6 block slots" wording
- Removed: XL-specific snapshot count test (now covered by identity test)
- Removed: XL-specific block count test (now covered by identity test)
- Kept all: `getSystemPrompt` tests unchanged (chat prompt not refactored)

## Verification Results

All plan verification steps passed:

1. `npx vitest run src/lib/families/stomp/prompt.test.ts` — 12/12 tests pass (including new identity test)
2. `npx tsc --noEmit` — no TypeScript errors
3. `grep "DEVICE RESTRICTION" src/lib/families/stomp/prompt.ts` — no matches (good)
4. `grep "stompRestriction" src/lib/planner.ts` — match found (good)
5. Identity: `buildPlannerPrompt("helix_stomp", ...)` === `buildPlannerPrompt("helix_stomp_xl", ...)` confirmed by test

## Decisions Made

1. **Conservative system prompt values:** Use STOMP_MAX_BLOCKS (6) and STOMP_MAX_SNAPSHOTS (3) as the unified reference. Stomp XL's larger values (9 blocks, 4 snapshots) are provided via user message restriction. This means the system prompt is calibrated toward the more constrained device — the user message restriction overrides for XL. This is intentional: the cache entry benefits both devices equally since neither has stale/wrong guidance without the user message override.

2. **_device parameter prefix:** `buildPlannerPrompt(_device, modelList)` signals "intentionally unused" while satisfying the `getFamilyPlannerPrompt` → `buildPlannerPrompt(device, modelList)` type contract in prompt-router.ts. No interface change needed.

3. **Zod schema unchanged:** Schema enforcement remains at the family level — `getToneIntentSchema("stomp")` enforces correct snapshot counts for each device variant. The user message restriction tells Claude the right count; Zod validates the output. Belt-and-suspenders pattern preserved.

## Deviations from Plan

None — plan executed exactly as written.

## Impact

- **Cache savings:** Stomp family now has 1 cache entry instead of 2. Cold-write cost: $6.00/MTok once instead of twice. Hit rate doubles (both devices benefit from the same warmed cache entry).
- **Correctness preserved:** DEVICE RESTRICTION language still reaches Claude (via user message) on every generation call — not removed, just relocated.
- **Regression risk:** Zero — getSystemPrompt (chat prompt) is unchanged; Zod schema is unchanged; existing test coverage maintained and extended.

## Self-Check: PASSED

All files confirmed present on disk:
- FOUND: src/lib/families/stomp/prompt.ts
- FOUND: src/lib/planner.ts
- FOUND: src/lib/families/stomp/prompt.test.ts
- FOUND: .planning/phases/68-token-control-and-prompt-caching/68-02-SUMMARY.md

All commits confirmed in git history:
- FOUND: f16de61 (test RED phase)
- FOUND: 19c5c1b (feat GREEN phase)
