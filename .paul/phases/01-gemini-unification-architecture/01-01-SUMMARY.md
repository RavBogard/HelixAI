---
phase: 01-gemini-unification-architecture
plan: 01
subsystem: api
tags: [gemini, vision, sdk-migration, anthropic-removal]

requires:
  - phase: v1.1
    provides: Working Gemini planner (planner.ts), Gemini client factory (gemini.ts)
provides:
  - Vision module using Gemini SDK for image analysis
  - Zero Anthropic dependencies in project
  - Single API key requirement (GEMINI_API_KEY only)
affects: [01-02 chat-planner architecture, vision features]

tech-stack:
  added: []
  patterns: [Gemini inlineData for vision, estimateGeminiCost for usage logging]

key-files:
  created: []
  modified:
    - src/lib/rig-vision.ts
    - src/lib/gemini.ts
    - scripts/ai-eval-harness.ts
    - scripts/measure-prompt-sizes.ts
    - package.json

key-decisions:
  - "Updated MODEL_STANDARD globally to gemini-3-flash-preview (deviation from plan boundaries)"
  - "Replaced Anthropic countTokens with character-based estimation in measure-prompt-sizes.ts"

patterns-established:
  - "Gemini vision via inlineData content parts (not structured output)"

duration: ~15min
started: 2026-03-08
completed: 2026-03-08
---

# Phase 1 Plan 01: Migrate Vision to Gemini & Remove Anthropic SDK — Summary

**Migrated rig-vision.ts from Claude/Anthropic to Gemini SDK, removed @anthropic-ai/sdk dependency entirely, upgraded standard model to gemini-3-flash-preview.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 3 completed |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Vision Uses Gemini SDK | Pass | rig-vision.ts uses createGeminiClient(), inlineData format, getModelId() |
| AC-2: RigIntent Output Unchanged | Pass | extractJson() and RigIntentSchema.parse() preserved, human-verified working |
| AC-3: Anthropic SDK Fully Removed | Pass | No @anthropic-ai/sdk in src/ or scripts/, removed from package.json |
| AC-4: TypeScript Compiles Clean | Pass | npx tsc --noEmit exits with 0 errors |

## Accomplishments

- Rewrote rig-vision.ts to use Gemini SDK with inlineData image format and usage logging
- Removed all Anthropic SDK references from eval harness and prompt measurement scripts
- Uninstalled @anthropic-ai/sdk — project now has zero Anthropic dependencies
- Upgraded standard model tier from gemini-2.5-flash to gemini-3-flash-preview

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/rig-vision.ts` | Modified | Full rewrite: Claude → Gemini vision with inlineData, usage logging |
| `src/lib/gemini.ts` | Modified | MODEL_STANDARD updated to gemini-3-flash-preview |
| `scripts/ai-eval-harness.ts` | Modified | Removed Claude providers, callClaude(), Anthropic imports |
| `scripts/measure-prompt-sizes.ts` | Modified | Replaced Anthropic countTokens with character-based estimation |
| `package.json` | Modified | Removed @anthropic-ai/sdk dependency |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Updated gemini.ts MODEL_STANDARD globally | User requested gemini-3-flash-preview for all callers | All callers (planner, vision, chat) now use gemini-3-flash-preview |
| Character-based token estimation in measure-prompt-sizes.ts | Gemini countTokens API differs significantly from Anthropic | Approximate but sufficient for diagnostic purposes |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope additions | 1 | Updated gemini.ts MODEL_STANDARD (plan boundary said DO NOT CHANGE) |
| Auto-fixed | 2 | Type errors in usage logging (endpoint type, device null→undefined) |

**Total impact:** Minor — gemini.ts change was user-directed, type fixes were mechanical.

### Auto-fixed Issues

**1. TypeScript type mismatch in usage logging**
- **Found during:** Task 1 (rig-vision rewrite)
- **Issue:** `endpoint: "vision"` not in union `"generate" | "chat"`, `device: null` not assignable to `string | undefined`
- **Fix:** Changed to `endpoint: "generate"` and `device: undefined`
- **Verification:** npx tsc --noEmit passes

## Issues Encountered

None

## Next Phase Readiness

**Ready:**
- All production code on Gemini — single SDK, single API key
- Vision module working end-to-end with Gemini 3 Flash
- Clean foundation for Plan 01-02 (chat→planner architecture exploration)

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 01-gemini-unification-architecture, Plan: 01*
*Completed: 2026-03-08*
