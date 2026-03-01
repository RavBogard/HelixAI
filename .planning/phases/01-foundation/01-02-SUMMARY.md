---
phase: 01-foundation
plan: 02
subsystem: models
tags: [typescript, helix, models, param-registry, topology]

requires:
  - phase: 01-foundation plan 01
    provides: AmpCategory, TopologyTag, CabSize types from types.ts
provides:
  - PARAM_TYPE_REGISTRY distinguishing Hz/index/float/dB/bpm/boolean parameter types
  - BLOCK_TYPES with verified AMP_WITH_CAB: 3 and CAB_IN_SLOT: 4
  - All CAB_MODELS with raw Hz LowCut/HighCut defaults
  - All AMP_MODELS with ampCategory, topology, cabAffinity metadata
affects: [01-03, phase-2, phase-4]

tech-stack:
  added: []
  patterns: [param-type-classification, amp-topology-tagging, cab-affinity-mapping]

key-files:
  created:
    - src/lib/helix/param-registry.ts
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/preset-builder.ts

key-decisions:
  - "EQ LowCut/HighCut left as normalized — only cab block LowCut/HighCut are Hz-encoded"
  - "All non-Vox/Matchless/JC-120 amps default to plate_fed topology"

patterns-established:
  - "Cab Hz defaults: small/clean 80/8000, crunch 80/7500, high-gain 100/6500"
  - "Topology tagging: cathode_follower for Vox/Matchless, solid_state for JC-120, plate_fed for all others"

requirements-completed: [FNDN-01, FNDN-03, FNDN-04]

duration: 8min
completed: 2026-03-01
---

# Phase 1 Plan 02: Parameter Registry + Model Database Summary

**PARAM_TYPE_REGISTRY classifying Hz/float/index parameters; BLOCK_TYPES corrected (AMP_WITH_CAB:3); 22 cabs converted to Hz defaults; 68 amps tagged with topology/category/cabAffinity**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- param-registry.ts created with PARAM_TYPE_REGISTRY classifying LowCut/HighCut as hz_value, Mic as integer_index, Drive/Master as normalized_float
- BLOCK_TYPES corrected: removed CAB: 2 (never in real exports), added AMP_WITH_CAB: 3, CAB_IN_SLOT: 4
- All 22 CAB_MODELS entries converted from normalized 0-1 to raw Hz (LowCut: 80-100, HighCut: 6500-8000)
- All 68 AMP_MODELS entries annotated with ampCategory, topology, cabAffinity metadata
- TypeScript compiles with zero errors

## Task Commits

1. **Task 1: Create param-registry.ts** - `1412f67` (feat)
2. **Task 2: Update models.ts with BLOCK_TYPES, Hz defaults, amp metadata** - `e190599` (feat)

## Files Created/Modified
- `src/lib/helix/param-registry.ts` - NEW: ParamType union + PARAM_TYPE_REGISTRY constant
- `src/lib/helix/models.ts` - Extended HelixModel interface, fixed BLOCK_TYPES, Hz cab defaults, amp topology tags
- `src/lib/helix/preset-builder.ts` - Added LowCut/HighCut Hz defaults for cab block creation

## Decisions Made
- EQ "Low and High Cut" block LowCut: 0.10 left as-is — EQ parameters may have different encoding from cab parameters
- All non-Vox/Matchless/JC-120 amps tagged as plate_fed topology (conservative default)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] preset-builder.ts HlxCab type error**
- **Found during:** Task 2 (models.ts update)
- **Issue:** preset-builder.ts creates HlxCab objects without required LowCut/HighCut
- **Fix:** Added LowCut: 80.0 and HighCut: 8000.0 Hz defaults with nullish coalescing
- **Files modified:** src/lib/helix/preset-builder.ts
- **Verification:** npx tsc --noEmit passes with zero errors
- **Committed in:** e190599 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix to unblock TypeScript compilation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- param-registry.ts ready for Plan 03 barrel exports
- models.ts topology metadata ready for Phase 2 param-engine
- All cab defaults in Hz encoding for Phase 2 chain rules

---
*Phase: 01-foundation*
*Completed: 2026-03-01*
