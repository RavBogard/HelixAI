---
phase: 63-stadium-firmware-parameter-completeness
plan: 01
subsystem: helix-engine
tags: [stadium, firmware-params, type-widening, corpus-data]

requires:
  - phase: 62-catalog-isolation
    plan: 02
    provides: Per-family catalog isolation and schema factory
provides:
  - Full 19-27 key firmware param tables in all 18 STADIUM_AMPS entries
  - Record<string, number | boolean> type support across BlockSpec, HelixModel, SnapshotSpec
affects: [models, types, param-engine, preset-builder, stomp-builder, podgo-builder, snapshot-engine, validate]

tech-stack:
  added: []
  patterns: [corpus-verified-firmware-tables, boolean-voice-params]

key-files:
  created: []
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/types.ts
    - src/lib/helix/param-engine.ts
    - src/lib/helix/preset-builder.ts
    - src/lib/helix/stomp-builder.ts
    - src/lib/helix/podgo-builder.ts
    - src/lib/helix/snapshot-engine.ts
    - src/lib/helix/validate.ts
    - src/lib/helix/param-engine.test.ts
    - src/lib/helix/snapshot-engine.test.ts

key-decisions:
  - "BlockSpec.parameters widened to Record<string, number | boolean> to support boolean voice params"
  - "HelixModel.defaultParams and paramOverrides widened to Record<string, number | boolean>"
  - "SnapshotSpec.parameterOverrides widened to Record<string, Record<string, number | boolean>>"
  - "All resolveXxxParams return types widened to Record<string, number | boolean>"
  - "Cab params (LowCut, HighCut, Mic) wrapped in Number() since they are structurally numeric"
  - "Snapshot controller @value fields cast as number since they are always numeric at runtime"
  - "ChVol removed from ALL 18 STADIUM_AMPS entries (corpus shows no ChVol on Agoura amps)"
  - "USLuxeBlack, USPrincess76, USTrem have no Mid param (real hardware has no mid knob)"
  - "USPrincess76 uses 'Treb' not 'Treble' per corpus"
  - "8 non-corpus models derived from same-family models with neutral defaults"

patterns-established:
  - "corpus-verified-firmware-tables: Stadium amp params sourced from real .hsp exports, not estimated"
  - "boolean-voice-params: Boolean voice controls (Bright, Fat, Contour, NrmBright, NrmMode, Old_New) stored as true/false"

requirements-completed: [STADPARAM-01, STADPARAM-02]

duration: 15min
completed: 2026-03-06
---

# Plan 63-01: Stadium Firmware Param Tables + Type Widening Summary

**Expanded all 18 STADIUM_AMPS from 6-key stubs to full 19-27 key corpus-extracted firmware param tables; widened core types to support boolean voice params**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 10, **Files created:** 0

## Accomplishments
- Widened BlockSpec.parameters, HelixModel.defaultParams, HelixModel.paramOverrides, SnapshotSpec.parameterOverrides to Record<string, number | boolean>
- Fixed 21 downstream TypeScript errors across 8 files caused by type widening
- Replaced all 18 STADIUM_AMPS entries with full firmware param tables (19-27 keys each)
- 10 corpus-verified models with exact values from .hsp files
- 8 derived models from same-family models with neutral defaults
- 14 universal hidden params (AmpCab*, Hype, ZPrePost, Ripple, Sag) present in every Stadium amp
- Boolean voice params (Bright, Fat, Contour, NrmBright, NrmMode, Old_New) typed as boolean
- ChVol removed from all 18 Stadium amp entries (absent in real firmware)
- Zero TypeScript compilation errors

## Task Commits

1. **Task 1: Widen param types to Record<string, number | boolean>** - `ef8a3f7` (feat)
2. **Task 2: Expand 18 STADIUM_AMPS to full firmware param tables** - `9a196b3` (feat)

## Files Modified
- `src/lib/helix/types.ts` - Widened BlockSpec.parameters and SnapshotSpec.parameterOverrides
- `src/lib/helix/models.ts` - Widened HelixModel types; replaced all 18 STADIUM_AMPS with full firmware tables
- `src/lib/helix/param-engine.ts` - Widened return types for 7 resolve functions
- `src/lib/helix/preset-builder.ts` - Added Number() casts for cab params, as number for snapshot values
- `src/lib/helix/stomp-builder.ts` - Added Number() casts for cab params, as number for controller values
- `src/lib/helix/podgo-builder.ts` - Added as number casts for controller values
- `src/lib/helix/snapshot-engine.ts` - Added typeof guard for Mix parameter arithmetic
- `src/lib/helix/validate.ts` - Widened newParamOverrides type
- `src/lib/helix/param-engine.test.ts` - Added as number casts for comparison assertions
- `src/lib/helix/snapshot-engine.test.ts` - Added as number casts for ChVol comparison assertions

## Decisions Made
- Type widening applied broadly to avoid unsafe narrows; Number() and as number used at known-numeric boundaries
- ChVol definitively absent from Stadium amps per corpus evidence (not a Helix vs Stadium difference, but a firmware architecture difference)
- Models without corpus data (8 derived) use same-family voice params with conservative neutral defaults

## Deviations from Plan
None - plan executed as specified.

## Issues Encountered
- 21 TypeScript errors after type widening required fixes across 8 files. All were straightforward Number()/as number casts at boundaries where values are structurally known to be numeric.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 63-02 ready: full firmware param tables available in STADIUM_AMPS for pipeline wiring
- Stadium guard in resolveAmpParams() is the next step to prevent AMP_DEFAULTS corruption

---
*Phase: 63-stadium-firmware-parameter-completeness*
*Completed: 2026-03-06*
