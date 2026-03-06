---
phase: 65-device-specific-prompts
plan: 02
subsystem: prompt-engine
tags: [api-wiring, deletion, tests, usage-logging]
dependency_graph:
  requires: [per-family-prompts, prompt-router]
  provides: [api-route-wiring, prompt-tests, usage-device-field]
  affects: [chat-route, generate-route, planner, gemini, usage-logger]
tech_stack:
  added: []
  patterns: [prompt-router-dispatch, per-family-test-isolation]
key_files:
  created:
    - src/lib/families/helix/prompt.test.ts
    - src/lib/families/stomp/prompt.test.ts
    - src/lib/families/podgo/prompt.test.ts
    - src/lib/families/stadium/prompt.test.ts
    - src/lib/prompt-router.test.ts
  modified:
    - src/app/api/chat/route.ts
    - src/lib/planner.ts
    - src/lib/gemini.ts
    - src/lib/usage-logger.ts
    - src/lib/planner.test.ts
    - scripts/verify-prompt-enrichment.ts
decisions:
  - Deleted buildPlannerPrompt entirely from planner.ts (not deprecated)
  - Deleted getSystemPrompt entirely from gemini.ts (not deprecated)
  - Device field in PlannerUsageRecord uses optional string type (dependency-free)
  - Updated existing planner.test.ts to use getFamilyPlannerPrompt
metrics:
  duration: ~10 minutes
  completed: 2026-03-06
---

# Phase 65 Plan 02: Wire API Routes and Tests Summary

API routes wired to per-family prompt router, monolithic prompt functions deleted, device tracking added to usage logger, 75 new test assertions across 5 test files.

## What Was Built

### API Route Wiring
- **chat/route.ts**: Removed `getSystemPrompt` import from gemini.ts. Added `getFamilyChatPrompt` from prompt-router. Extracts `device` from request body with `helix_lt` fallback. Passes device to logUsage.
- **generate/route.ts**: No changes needed -- `callClaudePlanner()` internal change handles the routing.

### Monolithic Function Deletion
- **planner.ts**: Deleted `buildPlannerPrompt()` entirely (~155 lines). `callClaudePlanner()` now uses `getFamilyPlannerPrompt(effectiveDevice, modelList)` from prompt-router. Removed unused imports (isPodGo, isStadium, isStomp, AMP_MODELS, STOMP_CONFIG). Added device to logUsage call.
- **gemini.ts**: Deleted `getSystemPrompt()` entirely (~115 lines). Only `getModelId()`, `isPremiumKey()`, and `createGeminiClient()` remain.

### Usage Logger Enhancement
- **usage-logger.ts**: Added optional `device?: string` field to `PlannerUsageRecord`. Both chat and generate routes now pass the device field for per-family cache economics analysis.

### Test Suite (5 new files, 75 assertions)
- **helix/prompt.test.ts**: 16 tests -- dual-DSP routing, split/join blocks, cross-family isolation, cache identity (LT=Floor)
- **stomp/prompt.test.ts**: 13 tests -- trade-off language, STOMP_CONFIG limits, genre priority hierarchy, snapshot counts
- **podgo/prompt.test.ts**: 14 tests -- 4-slot empowering framing, hard limit enforcement, no stretch configs
- **stadium/prompt.test.ts**: 16 tests -- FOH/arena vocabulary, no HD2 names, TODO(Phase62) placeholder
- **prompt-router.test.ts**: 16 tests -- all 6 devices dispatch, families differ, LT=Floor identity

### Existing Test Updates
- **planner.test.ts**: Updated to use `getFamilyPlannerPrompt()` instead of deleted `buildPlannerPrompt()`. All 10 existing tests pass.
- **scripts/verify-prompt-enrichment.ts**: Updated to use `getFamilyPlannerPrompt()`.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 3bef6ec | Wire API routes, delete monolithic functions, add device field |
| 2 | 9cfec95 | Per-family prompt tests and prompt router tests (75 assertions) |

## Verification Results

- Full project `tsc --noEmit`: PASSED (zero errors)
- `npx vitest run` all 6 test files (85 total tests): PASSED
- `buildPlannerPrompt` grep in planner.ts: 0 results (deleted)
- `getSystemPrompt` grep in gemini.ts: 0 results (deleted)
- `getFamilyChatPrompt` grep in chat/route.ts: present and wired
- `device` field in PlannerUsageRecord: present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated scripts/verify-prompt-enrichment.ts**
- **Found during:** Task 1
- **Issue:** The verification script imported the deleted `buildPlannerPrompt` from planner.ts
- **Fix:** Updated import to use `getFamilyPlannerPrompt` from prompt-router
- **Files modified:** scripts/verify-prompt-enrichment.ts
- **Commit:** 3bef6ec

**2. [Rule 1 - Bug] Fixed test assertions for cross-section content**
- **Found during:** Task 2 (initial test run)
- **Issue:** Three test assertions were too strict: "split block" case mismatch (prompt uses "Split block"), secondAmpName appears in DEVICE RESTRICTION section, "stretch" appears in "no stretch" context
- **Fix:** Made split/join case-insensitive, scoped secondAmpName check to ToneIntent Fields section only, replaced stretch check with non-negotiable limit assertion
- **Files modified:** prompt.test.ts files for helix, stomp, podgo
- **Commit:** 9cfec95

## Decisions Made

1. **Complete deletion over deprecation**: Both `buildPlannerPrompt()` and `getSystemPrompt()` were deleted entirely (not deprecated) to prevent silent fallback to monolithic behavior.
2. **Device field as optional string**: Used `device?: string` instead of `DeviceTarget` in PlannerUsageRecord to keep the usage logger dependency-free.
3. **Chat route device fallback**: Default device is `helix_lt` when not provided in request body, consistent with generate route behavior.
