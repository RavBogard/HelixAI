---
phase: 01-build-type-safety-sweep
plan: 03
subsystem: api
tags: [gemini, planner, migration, structured-output]

requires:
  - phase: 01-build-type-safety-sweep/01-02
    provides: amp name data integrity, passing build
provides:
  - Planner module migrated from Claude Sonnet to Gemini 3 Flash
  - All API routes updated to use callGeminiPlanner
  - Gemini cost logging for planner calls
affects: []

tech-stack:
  added: []
  patterns: [gemini-structured-output-with-manual-json-schema]

key-files:
  created: []
  modified:
    - src/lib/planner.ts
    - src/app/api/generate/route.ts
    - src/app/api/preview/route.ts

key-decisions:
  - "Used manual JSON schema builder (from eval harness pattern) instead of zod-to-json-schema — avoids new dependency and potential Gemini $ref incompatibility"
  - "Added variaxModel enum to JSON schema (eval harness omitted it) — enables constrained decoding for Variax model names"

patterns-established:
  - "Gemini structured output pattern: buildGeminiJsonSchema() + responseJsonSchema config"

duration: ~10min
started: 2026-03-08
completed: 2026-03-08
---

# Phase 1 Plan 3: Migrate Planner to Gemini 3 Flash Summary

**Planner module fully migrated from Claude Sonnet to Gemini 3 Flash with structured JSON output, completing the Phase 4 decision.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-03-08 |
| Tasks | 3 completed (including human verification) |
| Files modified | 3 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Planner Uses Gemini SDK | Pass | Uses @google/genai via createGeminiClient(), ai.models.generateContent with responseJsonSchema |
| AC-2: ToneIntent Output Unchanged | Pass | Human-verified: preset generation works end-to-end, same Zod validation preserved |
| AC-3: Cost Logging Uses Gemini Pricing | Pass | model field shows Gemini ID, uses estimateGeminiCost |
| AC-4: TypeScript Compiles Clean | Pass | npx tsc --noEmit exits 0 |

## Accomplishments

- Rewrote planner.ts: removed Anthropic SDK, uses createGeminiClient() + ai.models.generateContent with structured JSON output
- Built getCatalogNames() and buildGeminiJsonSchema() helper functions for Gemini-compatible JSON schema (replicating eval harness pattern)
- Updated both API routes (generate, preview) from callClaudePlanner to callGeminiPlanner
- Cost logging updated to use estimateGeminiCost with Gemini usageMetadata fields

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/planner.ts` | Rewritten | Full migration: Claude SDK -> Gemini SDK with structured output |
| `src/app/api/generate/route.ts` | Modified | Import + call updated to callGeminiPlanner |
| `src/app/api/preview/route.ts` | Modified | Import + call updated to callGeminiPlanner |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Manual JSON schema instead of zod-to-json-schema | Avoids new dependency; Gemini may not support $ref/$defs from zod conversion; eval harness pattern proven | Schema must be updated manually if ToneIntent Zod schema changes |
| Added variaxModel to JSON schema | Eval harness omitted it; including it enables Gemini constrained decoding for model names | Better output quality for Variax-enabled presets |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | N/A |
| Scope additions | 0 | N/A |
| Deferred | 0 | N/A |

**Total impact:** None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 1 (Build & Type Safety Sweep) is now complete — all 3 plans executed
- Planner fully on Gemini, chat already on Gemini — Claude dependency reduced to rig-vision only
- v1.1 milestone goals achieved: build stability, data integrity, Gemini migration

**Concerns:**
- Manual JSON schema in planner.ts must be kept in sync with ToneIntent Zod schema if it changes
- @anthropic-ai/sdk still in package.json (needed by rig-vision.ts) — cannot remove yet

**Blockers:**
- None

---
*Phase: 01-build-type-safety-sweep, Plan: 03*
*Completed: 2026-03-08*
