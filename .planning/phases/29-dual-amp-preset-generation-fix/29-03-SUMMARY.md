---
phase: 29-dual-amp-preset-generation-fix
plan: 03
subsystem: preset-builder
tags: [preset-builder, hlx-format, dual-amp, topology, split-join]

requires:
  - phase: 29-dual-amp-preset-generation-fix
    provides: "Dual-amp chain assembly with path 0/1 blocks (Plan 02)"
provides:
  - "Preset builder with AB topology support for dual-amp"
  - "Split/join block writing (HD2_SplitAB, HD2_MergerMixer)"
  - "Path-aware amp-cab association (cab0 for primary, cab1 for secondary)"
  - "Structural validation for dual-amp .hlx files"
affects: []

tech-stack:
  added: []
  patterns: ["Runtime structural validation as safety net for complex .hlx generation"]

key-files:
  created: []
  modified:
    - "src/lib/helix/preset-builder.ts"

key-decisions:
  - "Split positioned before first amp block; join positioned after last non-cab block"
  - "Validation uses typed interface access rather than Record<string, unknown> casts"
  - "Dual-amp detection computed independently in buildHlxFile for validation"

patterns-established:
  - "buildDsp accepts isDualAmp parameter for conditional split/join writing"
  - "Structural validation in buildHlxFile catches regression before user gets broken .hlx"

requirements-completed: [DUAL-06, DUAL-09]

duration: 5min
completed: 2026-03-03
---

# Plan 29-03: Preset Builder Summary

**Dual-amp .hlx output with AB topology, HD2_SplitAB/HD2_MergerMixer blocks, path-aware cab references, and structural validation**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Preset builder detects dual-amp chains and sets @topology0 to "AB" (single-amp stays "A")
- Split block (HD2_SplitAB) and join block (HD2_MergerMixer) written to dsp0 for dual-amp
- Path-aware amp-cab association: primary amp -> cab0, secondary amp -> cab1
- Runtime structural validation catches malformed dual-amp .hlx files before user download

## Task Commits

Each task was committed atomically:

1. **Task 1: AB topology, split/join, path-aware cab refs** - `33ae479` (feat)
2. **Task 2: Structural validation** - `19297a2` (feat)

## Files Created/Modified
- `src/lib/helix/preset-builder.ts` - Dual-amp topology, split/join writing, cab association, validation

## Decisions Made
- Split position computed from first amp block position; join from last non-cab position + 1
- Used typed interface property access for validation instead of Record casts (TypeScript complained about missing index signature)
- Dual-amp detection in buildHlxFile is independent from buildTone (computed from spec directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript type cast error**
- **Found during:** Task 2 (structural validation)
- **Issue:** Plan suggested `(dsp0.split as Record<string, unknown>)["@model"]` but HlxSplit doesn't have string index signature
- **Fix:** Used direct property access `dsp0.split["@model"]` since HlxSplit has the typed `@model` field
- **Files modified:** src/lib/helix/preset-builder.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 19297a2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix necessary for TypeScript compilation. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Complete dual-amp pipeline operational: schema -> planner -> chain -> params -> snapshots -> builder
- Dual-amp .hlx files structurally valid for HX Edit loading

---
*Phase: 29-dual-amp-preset-generation-fix*
*Completed: 2026-03-03*
