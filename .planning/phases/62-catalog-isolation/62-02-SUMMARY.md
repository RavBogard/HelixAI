---
phase: 62-catalog-isolation
plan: 02
subsystem: api
tags: [zod, constrained-decoding, device-family, planner, route]

requires:
  - phase: 62-catalog-isolation
    plan: 01
    provides: Per-family catalog tuples (HELIX_*, STOMP_*, PODGO_*, STADIUM_*)
provides:
  - getToneIntentSchema(family) factory in tone-intent.ts
  - Family-aware callClaudePlanner with DeviceFamily param
  - Global AMP_NAMES/CAB_NAMES/EFFECT_NAMES eliminated from models.ts
affects: [tone-intent, planner, route, index, models]

tech-stack:
  added: []
  patterns: [per-family-schema-factory, family-param-threading]

key-files:
  created:
    - src/lib/helix/tone-intent.test.ts
  modified:
    - src/lib/helix/tone-intent.ts
    - src/lib/planner.ts
    - src/app/api/generate/route.ts
    - src/lib/helix/index.ts
    - src/lib/helix/models.ts
    - scripts/generate-baseline.ts

key-decisions:
  - "getToneIntentSchema(family) uses switch on DeviceFamily to return per-family Zod schema"
  - "ToneIntentSchema kept as @deprecated backwards-compat shim using helix catalog"
  - "POD_GO_EFFECT_SUFFIX kept as private copy in models.ts to avoid circular import (models <-> podgo-catalog)"
  - "callClaudePlanner accepts optional family param defaulting to 'helix' for backwards compat"
  - "generate-baseline.ts uses cached HelixSchema/StadiumSchema instances at module level"

patterns-established:
  - "per-family-schema-factory: getToneIntentSchema(family) is the single source of per-family Zod schemas"
  - "family-param-threading: DeviceFamily flows from route.ts -> planner.ts -> tone-intent.ts"

requirements-completed: [CAT-03, CAT-04]

duration: 10min
completed: 2026-03-05
---

# Plan 62-02: Wire Factory, Eliminate Globals Summary

**getToneIntentSchema(family) factory wired into planner.ts and route.ts; global AMP_NAMES/CAB_NAMES/EFFECT_NAMES eliminated from models.ts and index.ts barrel**

## Performance

- **Duration:** 10 min
- **Tasks:** 2
- **Files modified:** 6, **Files created:** 1

## Accomplishments
- Created getToneIntentSchema(family) factory with 4-family switch (helix/stomp/podgo/stadium)
- Created tone-intent.test.ts with 10 cross-family schema rejection tests
- Updated planner.ts to accept DeviceFamily param and use family-specific schema for constrained decoding
- Updated route.ts to pass deviceFamily to callClaudePlanner
- Removed global AMP_NAMES, CAB_NAMES, EFFECT_NAMES exports from models.ts
- Updated index.ts to export getToneIntentSchema and per-family catalog names
- Updated generate-baseline.ts to use family-specific schemas (HelixSchema/StadiumSchema)
- POD_GO_EFFECT_SUFFIX kept as private copy in models.ts (circular import avoidance)
- Full suite: 318 tests green, zero regressions

## Task Commits

1. **Task 1: getToneIntentSchema factory + tests + generate-baseline fix** - `b5f12a5` (feat)
2. **Task 2: Wire planner/route, eliminate globals** - `ddee78c` (feat)

## Files Created
- `src/lib/helix/tone-intent.test.ts` - Cross-family schema rejection and acceptance tests

## Files Modified
- `src/lib/helix/tone-intent.ts` - Added getToneIntentSchema(family) factory, buildToneIntentSchema helper
- `src/lib/planner.ts` - Added DeviceFamily param, uses getToneIntentSchema(family) for zodOutputFormat and parse
- `src/app/api/generate/route.ts` - Passes deviceFamily to callClaudePlanner
- `src/lib/helix/index.ts` - Exports getToneIntentSchema, per-family catalog names; removed AMP_NAMES/CAB_NAMES/EFFECT_NAMES
- `src/lib/helix/models.ts` - Deleted global AMP_NAMES/CAB_NAMES/EFFECT_NAMES exports
- `scripts/generate-baseline.ts` - Uses getToneIntentSchema("helix")/("stadium") instead of deprecated ToneIntentSchema

## Decisions Made
- getToneIntentSchema(family) is the single factory for per-family Zod schemas (constrained decoding)
- POD_GO_EFFECT_SUFFIX cannot be imported from podgo-catalog.ts into models.ts due to circular dependency; kept as private copy with cross-reference comment
- ToneIntentSchema kept as deprecated shim for backwards compatibility; no internal consumers remain
- callClaudePlanner's family param defaults to "helix" when unset (backwards compat)

## Deviations from Plan
- POD_GO_EFFECT_SUFFIX not eliminated from models.ts (circular import between models.ts and podgo-catalog.ts prevents direct import). Kept as private copy with comment pointing to canonical source in podgo-catalog.ts.

## Issues Encountered
- Circular import: models.ts -> podgo-catalog.ts -> models.ts caused runtime TypeError when trying to import PODGO_EFFECT_SUFFIX from podgo-catalog into models.ts. Resolved by keeping private copy.
- generate-baseline.ts used deprecated ToneIntentSchema.parse() with Agoura amp names for STADIUM_FIXTURES, which broke after ToneIntentSchema was constrained to helix-only. Fixed by using family-specific cached schemas.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 62 complete: all catalog isolation requirements satisfied
- getToneIntentSchema(family) ready for consumption by downstream phases (63-65)
- Per-family constrained decoding structurally prevents cross-family model name hallucination

---
*Phase: 62-catalog-isolation*
*Completed: 2026-03-05*
