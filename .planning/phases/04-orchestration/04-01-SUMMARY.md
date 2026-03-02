---
phase: 04-orchestration
plan: 01
subsystem: api
tags: [helix, hlx, device-target, validation, preset-builder]

# Dependency graph
requires:
  - phase: 02-knowledge-layer
    provides: "Knowledge Layer modules (chain-rules, param-engine, snapshot-engine)"
  - phase: 03-ai-integration
    provides: "Generate route with Planner -> Knowledge Layer pipeline"
provides:
  - "DeviceTarget type and DEVICE_IDS constant for Helix LT/Floor"
  - "Device-aware buildHlxFile with correct device ID embedding"
  - "Strict validatePresetSpec that throws on structural errors"
  - "Generate route with fail-fast validation and device target support"
affects: [05-testing, 06-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fail-fast validation (throw instead of auto-correct)", "device target parameterization"]

key-files:
  created: []
  modified:
    - src/lib/helix/types.ts
    - src/lib/helix/preset-builder.ts
    - src/lib/helix/validate.ts
    - src/lib/helix/index.ts
    - src/app/api/generate/route.ts

key-decisions:
  - "Strict validatePresetSpec throws instead of auto-correcting -- Knowledge Layer should produce valid specs"
  - "DeviceTarget defaults to helix_lt for backward compatibility"
  - "Unknown device values in request body default to helix_lt (not rejected)"

patterns-established:
  - "Fail-fast validation: validate before build, throw on structural errors"
  - "Device target parameterization: all device-specific values resolved via DEVICE_IDS lookup"

requirements-completed: [HLX-01, HLX-02, HLX-03]

# Metrics
duration: 2min
completed: 2026-03-02
---

# Phase 4 Plan 01: Device Target + Strict Validation Summary

**Device-aware buildHlxFile for Helix LT/Floor with strict fail-fast validatePresetSpec replacing silent auto-correction**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-02T01:52:59Z
- **Completed:** 2026-03-02T01:55:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- DeviceTarget type with DEVICE_IDS constant mapping Helix LT (2162692) and Helix Floor (2162688)
- buildHlxFile accepts optional DeviceTarget parameter, defaulting to helix_lt for backward compatibility
- Strict validatePresetSpec that throws on: empty signal chain, missing amp/cab, invalid model IDs, out-of-range parameters, missing snapshots, DSP block limit exceeded
- Generate route wired with validation before build and device target flowing from request body to .hlx output

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DeviceTarget type and device-aware buildHlxFile** - `453c63a` (feat)
2. **Task 2: Create strict validatePresetSpec and wire into generate route** - `d16ecf2` (feat)

## Files Created/Modified
- `src/lib/helix/types.ts` - Added DeviceTarget type and DEVICE_IDS constant
- `src/lib/helix/preset-builder.ts` - Parameterized buildHlxFile with DeviceTarget (removed hardcoded device ID)
- `src/lib/helix/validate.ts` - Added strict validatePresetSpec function (7 validation checks)
- `src/lib/helix/index.ts` - Exported validatePresetSpec, DeviceTarget, DEVICE_IDS
- `src/app/api/generate/route.ts` - Added validation step, device extraction, device-aware buildHlxFile call

## Decisions Made
- **Strict validatePresetSpec throws instead of auto-correcting** -- The Knowledge Layer should produce valid specs deterministically, so any validation failure indicates a bug in the pipeline, not normal operation. This makes bugs visible immediately instead of silently producing wrong presets.
- **DeviceTarget defaults to helix_lt** -- Maintains backward compatibility for all existing callers (both buildHlxFile and the generate route).
- **Unknown device values default to helix_lt** -- Rather than rejecting unknown device strings, we default to LT. This prevents API errors from minor frontend issues while still supporting explicit Floor selection.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Device target support ready for frontend integration (Phase 5/6)
- Strict validation ensures pipeline bugs surface immediately
- Ready for Plan 04-02 (next orchestration tasks)

## Self-Check: PASSED

All 5 modified files verified on disk. Both task commits (453c63a, d16ecf2) confirmed in git history. 50/50 tests pass. Zero TypeScript errors.

---
*Phase: 04-orchestration*
*Completed: 2026-03-02*
