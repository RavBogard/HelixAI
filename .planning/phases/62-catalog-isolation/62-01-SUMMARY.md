---
phase: 62-catalog-isolation
plan: 01
subsystem: api
tags: [zod, constrained-decoding, device-family, catalog]

requires:
  - phase: 61-family-router-and-capabilities
    provides: DeviceFamily type, resolveFamily()
provides:
  - HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES tuples
  - STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES tuples
  - PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES, PODGO_EFFECT_SUFFIX
  - STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES tuples
affects: [62-catalog-isolation, tone-intent, planner]

tech-stack:
  added: []
  patterns: [per-family-catalog-module, relative-import-from-models]

key-files:
  created:
    - src/lib/helix/catalogs/helix-catalog.ts
    - src/lib/helix/catalogs/helix-catalog.test.ts
    - src/lib/helix/catalogs/stomp-catalog.ts
    - src/lib/helix/catalogs/stomp-catalog.test.ts
    - src/lib/helix/catalogs/podgo-catalog.ts
    - src/lib/helix/catalogs/podgo-catalog.test.ts
    - src/lib/helix/catalogs/stadium-catalog.ts
    - src/lib/helix/catalogs/stadium-catalog.test.ts
  modified: []

key-decisions:
  - "Catalog files import from ../models (relative) not @/lib/helix (barrel) to avoid circular deps"
  - "PODGO_EFFECT_SUFFIX duplicated into podgo-catalog.ts as canonical source (models.ts copy to be removed in Plan 02)"
  - "Stomp catalog exports same values as Helix — independence future-proofs for stomp-specific additions"

patterns-established:
  - "per-family-catalog: each device family gets its own catalog module under src/lib/helix/catalogs/"
  - "co-located-tests: test file lives next to source file in catalogs/ directory"

requirements-completed: [CAT-01, CAT-02, CAT-05]

duration: 5min
completed: 2026-03-05
---

# Plan 62-01: Per-Family Catalog Modules Summary

**Four per-family catalog modules (helix, stomp, podgo, stadium) exporting isolated AMP_NAMES, CAB_NAMES, and EFFECT_NAMES tuples for family-specific constrained decoding**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files created:** 8

## Accomplishments
- Created 4 catalog files under src/lib/helix/catalogs/ with correct per-family exports
- Stadium catalog uses only Agoura amps; helix/stomp/podgo use only HD2 amps
- Pod Go catalog excludes 3 models (Tone Sovereign, Clawthorn Drive, Cosmos Echo) and contains Mono/Stereo suffix mapping
- Stadium EFFECT_NAMES includes STADIUM_EQ_MODELS; no other catalog includes EQ/WAH/VOLUME keys
- 37 new tests across 4 test files; full suite (308 tests) green

## Task Commits

1. **Task 1: helix-catalog.ts and stomp-catalog.ts** - `055409c` (feat)
2. **Task 2: podgo-catalog.ts and stadium-catalog.ts** - `fe1ee8d` (feat)

## Files Created
- `src/lib/helix/catalogs/helix-catalog.ts` - HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES
- `src/lib/helix/catalogs/helix-catalog.test.ts` - Isolation tests for helix catalog
- `src/lib/helix/catalogs/stomp-catalog.ts` - STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES
- `src/lib/helix/catalogs/stomp-catalog.test.ts` - Isolation tests for stomp catalog
- `src/lib/helix/catalogs/podgo-catalog.ts` - PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES, PODGO_EFFECT_SUFFIX
- `src/lib/helix/catalogs/podgo-catalog.test.ts` - Isolation + exclusion tests for podgo catalog
- `src/lib/helix/catalogs/stadium-catalog.ts` - STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES
- `src/lib/helix/catalogs/stadium-catalog.test.ts` - Isolation tests for stadium catalog

## Decisions Made
- Catalog files use relative imports from ../models to avoid circular dependency through the @/lib/helix barrel
- PODGO_EFFECT_SUFFIX is duplicated from models.ts into podgo-catalog.ts as the new canonical source; models.ts copy will be removed in Plan 62-02
- Stomp catalog intentionally exports same values as Helix for future-proofing

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 per-family catalogs ready for consumption by getToneIntentSchema() factory in Plan 62-02
- No existing code modified — purely additive

---
*Phase: 62-catalog-isolation*
*Completed: 2026-03-05*
