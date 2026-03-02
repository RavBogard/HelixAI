---
phase: 03-ai-integration
plan: 02
subsystem: api
tags: [route-refactor, planner-pipeline, knowledge-layer, dead-code-removal, gemini-chat]

# Dependency graph
requires:
  - phase: 03-ai-integration
    provides: "callClaudePlanner() from planner.ts, enum-constrained ToneIntentSchema"
  - phase: 02-knowledge-layer
    provides: "assembleSignalChain, resolveParameters, buildSnapshots, buildHlxFile, summarizePreset"
provides:
  - "Refactored generate/route.ts: Planner -> Knowledge Layer -> .hlx pipeline"
  - "Flat API response shape: { preset, summary, spec, toneIntent }"
  - "Clean gemini.ts: chat-only functions (no generation prompt)"
  - "Clean providers.ts: config/availability only (no generation functions)"
affects: [05-frontend-polish, api-generate-route, api-providers-route]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Single-pipeline generation (Planner -> chain-rules -> param-engine -> snapshot-engine -> preset-builder)", "Flat JSON response instead of multi-provider results array"]

key-files:
  created: []
  modified: ["src/app/api/generate/route.ts", "src/lib/gemini.ts", "src/lib/providers.ts"]

key-decisions:
  - "Flat { preset, summary, spec, toneIntent } response shape -- frontend update deferred to Phase 5"
  - "Keep PROVIDERS config and getAvailableProviders() in providers.ts for /api/providers route used by frontend"
  - "Remove validateAndFixPresetSpec from generate route -- Knowledge Layer produces valid specs deterministically"

patterns-established:
  - "Generate route is a thin orchestrator: callClaudePlanner() -> Knowledge Layer pipeline -> buildHlxFile()"
  - "No AI-generated numeric parameters in generate pipeline -- all parameters from Knowledge Layer lookup tables"

requirements-completed: [AI-04, AI-05]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 3 Plan 02: Generate Route Refactor + Provider Cleanup Summary

**Generate route rewired to callClaudePlanner() -> Knowledge Layer pipeline with flat JSON response; generation dead code removed from gemini.ts and providers.ts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T01:33:57Z
- **Completed:** 2026-03-02T01:37:13Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Generate route now calls callClaudePlanner() then pipes ToneIntent through assembleSignalChain -> resolveParameters -> buildSnapshots -> buildHlxFile -- single deterministic pipeline replaces multi-provider parallel generation
- Removed 150+ lines of getPresetGenerationPrompt() from gemini.ts (massive prompt with hardcoded parameter ranges, now replaced by Knowledge Layer lookup tables)
- Removed 110+ lines of generation functions from providers.ts (generateWithProvider, generateGemini, generateClaude, generateOpenAI) -- all dead code since generation now goes through planner.ts
- Gemini chat endpoint completely untouched (AI-04 compliance verified via git diff)

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor generate route to Planner -> Knowledge Layer pipeline** - `391d63e` (feat)
2. **Task 2: Clean up gemini.ts and providers.ts -- remove generation-phase code** - `9f15daa` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `src/app/api/generate/route.ts` - Rewired from multi-provider parallel generation to callClaudePlanner() -> Knowledge Layer pipeline with flat { preset, summary, spec, toneIntent } response
- `src/lib/gemini.ts` - Removed getPresetGenerationPrompt() and getModelListForPrompt import; kept all 4 chat functions unchanged
- `src/lib/providers.ts` - Removed all generation functions; kept PROVIDERS config and getAvailableProviders() for /api/providers route

## Decisions Made
- Kept PROVIDERS config and getAvailableProviders() in providers.ts because the frontend (page.tsx) still calls /api/providers on mount to display provider badges -- removing it would break the UI before Phase 5
- Removed validateAndFixPresetSpec from the generate route because the Knowledge Layer produces valid specs deterministically (z.enum prevents invalid model IDs at the schema level)
- Flat response shape { preset, summary, spec, toneIntent } chosen over backwards-compatible wrapper -- frontend will be updated in Phase 5

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. CLAUDE_API_KEY environment variable (required by callClaudePlanner) was already documented in Plan 03-01.

## Next Phase Readiness
- Phase 3 (AI Integration) is now complete: ToneIntent schema, Claude Planner, and generate route pipeline all wired up
- The full generation flow is: Chat (Gemini) -> [READY_TO_GENERATE] -> Generate (Claude Planner -> Knowledge Layer -> .hlx)
- Frontend (page.tsx) will need updating in Phase 5 to handle the new flat response shape (currently expects { results: ProviderResult[] })
- All 50 Knowledge Layer tests continue to pass -- no regressions
- No blockers for Phase 4 (Pipeline Testing / Validation)

## Self-Check: PASSED

- All 3 modified source files exist
- SUMMARY.md exists at expected path
- Commit 391d63e (Task 1) found in git log
- Commit 9f15daa (Task 2) found in git log
- TypeScript compiles with zero errors
- All 50 tests pass
- Chat route (src/app/api/chat/route.ts) untouched (empty git diff)

---
*Phase: 03-ai-integration*
*Completed: 2026-03-02*
