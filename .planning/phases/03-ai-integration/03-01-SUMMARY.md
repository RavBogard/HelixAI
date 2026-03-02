---
phase: 03-ai-integration
plan: 01
subsystem: ai
tags: [claude, zod, enum, structured-output, planner, anthropic-sdk]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "ToneIntentSchema, models.ts with AMP_MODELS/CAB_MODELS/effect databases, barrel exports"
  - phase: 02-knowledge-layer
    provides: "chain-rules, param-engine, snapshot-engine consuming ToneIntent type"
provides:
  - "AMP_NAMES, CAB_NAMES, EFFECT_NAMES tuple exports from models.ts"
  - "Enum-constrained ToneIntentSchema (z.enum for model IDs, not z.string)"
  - "callClaudePlanner() for Claude structured output generation"
  - "buildPlannerPrompt() for narrow creative-only system prompt"
affects: [03-02, 04-pipeline, api-generate-route]

# Tech tracking
tech-stack:
  added: []
  patterns: ["zodOutputFormat for Claude structured output", "z.enum model ID constraint", "narrow planner prompt (zero numeric params)"]

key-files:
  created: ["src/lib/planner.ts"]
  modified: ["src/lib/helix/models.ts", "src/lib/helix/tone-intent.ts", "src/lib/helix/index.ts"]

key-decisions:
  - "z.enum() for ampName/cabName/modelName enforces valid model IDs at schema level"
  - "EFFECT_NAMES combines Distortion+Delay+Reverb+Modulation+Dynamics (excludes EQ/WAH/VOLUME handled by Knowledge Layer)"
  - "Three optional ToneIntent fields added: presetName, description, guitarNotes for richer AI output"
  - "Planner prompt under 60 lines with zero numeric parameter values"

patterns-established:
  - "zodOutputFormat(ToneIntentSchema) pattern for Claude output_config"
  - "Belt-and-suspenders: JSON.parse + ToneIntentSchema.parse for Zod validation after structured output"
  - "Conversation history concatenated into single user message for Claude"

requirements-completed: [AI-01, AI-02, AI-03, AI-05]

# Metrics
duration: 7min
completed: 2026-03-02
---

# Phase 3 Plan 01: Enum-Constrained ToneIntent + Claude Planner Summary

**z.enum() model ID constraints on ToneIntentSchema + Claude Planner module with zodOutputFormat structured output and zero-numeric-param prompt**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-02T01:24:36Z
- **Completed:** 2026-03-02T01:31:08Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ToneIntentSchema now uses z.enum(AMP_NAMES), z.enum(CAB_NAMES), z.enum(EFFECT_NAMES) instead of z.string() -- Claude's constrained decoding physically cannot output invalid model IDs
- Claude Planner module (planner.ts) ready with callClaudePlanner() using zodOutputFormat for structured output and buildPlannerPrompt() with a narrow creative-only prompt
- Three optional fields added to ToneIntentSchema (presetName, description, guitarNotes) for richer AI-generated metadata
- All 50 existing Knowledge Layer tests pass without modification -- enum narrowing is backward-compatible via z.infer

## Task Commits

Each task was committed atomically:

1. **Task 1: Add model name array exports and constrain ToneIntentSchema with z.enum()** - `2c7f71d` (feat)
2. **Task 2: Create planner.ts -- Claude Planner module with structured output** - `7367acd` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `src/lib/helix/models.ts` - Added AMP_NAMES, CAB_NAMES, EFFECT_NAMES tuple exports for z.enum() constraints
- `src/lib/helix/tone-intent.ts` - Changed ampName/cabName/modelName to z.enum(), added presetName/description/guitarNotes optional fields
- `src/lib/helix/index.ts` - Updated barrel exports to include AMP_NAMES, CAB_NAMES, EFFECT_NAMES
- `src/lib/planner.ts` - New Claude Planner module with callClaudePlanner() and buildPlannerPrompt()

## Decisions Made
- z.enum() for all model name fields enforces valid IDs at the schema level -- invalid IDs cause schema rejection, not auto-correction
- EFFECT_NAMES combines Distortion, Delay, Reverb, Modulation, and Dynamics model keys but excludes EQ, WAH, and VOLUME (Knowledge Layer handles those automatically)
- Three optional fields (presetName, description, guitarNotes) added per RESEARCH.md open questions -- Claude generates creative names and guitar tips, with deterministic fallbacks available
- Planner prompt is under 60 lines with zero numeric parameter values -- all "Do NOT generate" exclusions are explicit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. CLAUDE_API_KEY environment variable is checked at runtime by callClaudePlanner().

## Next Phase Readiness
- ToneIntentSchema is the single source of truth: z.enum() for model IDs, z.infer for TypeScript types, zodOutputFormat for Claude schema
- callClaudePlanner() is ready for the generate route to call in Plan 03-02
- Knowledge Layer (chain-rules, param-engine, snapshot-engine) already consumes ToneIntent type and gets narrowed enum types automatically
- No blockers for Plan 03-02 (route refactoring)

## Self-Check: PASSED

- All 4 source files exist (planner.ts, models.ts, tone-intent.ts, index.ts)
- SUMMARY.md exists at expected path
- Commit 2c7f71d (Task 1) found in git log
- Commit 7367acd (Task 2) found in git log
- TypeScript compiles with zero errors
- All 50 tests pass

---
*Phase: 03-ai-integration*
*Completed: 2026-03-02*
