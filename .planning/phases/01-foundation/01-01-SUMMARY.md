---
phase: 01-foundation
plan: 01
subsystem: types
tags: [typescript, zod, helix, types, schema]

requires:
  - phase: none
    provides: first plan in foundation
provides:
  - HlxCab with required LowCut/HighCut fields (Hz encoding)
  - AmpCategory, TopologyTag, CabSize union type exports
  - ToneIntentSchema Zod schema for narrow AI output contract
  - ToneIntent, EffectIntent, SnapshotIntent inferred types
affects: [01-02, 01-03, phase-2, phase-3]

tech-stack:
  added: [zod (already present, now used for ToneIntent)]
  patterns: [zod-inferred-types, required-field-enforcement]

key-files:
  created:
    - src/lib/helix/tone-intent.ts
  modified:
    - src/lib/helix/types.ts

key-decisions:
  - "LowCut/HighCut promoted to required on HlxCab — compiler enforces cab blocks always specify Hz values"
  - "ToneIntentSchema has exactly 7 fields — no numeric parameters allowed in AI output"
  - "Zod 4.x z.toJSONSchema() confirmed working for Phase 3 Claude output_config integration"

patterns-established:
  - "Hz encoding comment convention: // REQUIRED — raw Hz (e.g., 80.0). NOT normalized 0-1."
  - "AI contract separation: creative choices in ToneIntent, numeric params in Knowledge Layer"

requirements-completed: [FNDN-02, FNDN-05]

duration: 5min
completed: 2026-03-01
---

# Phase 1 Plan 01: Type Contracts Summary

**HlxCab LowCut/HighCut promoted to required with Hz encoding; ToneIntentSchema Zod contract constraining AI to 7 creative fields with zero numeric parameters**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- HlxCab.LowCut and HlxCab.HighCut are now required fields (TypeScript compiler rejects cab blocks missing them)
- AmpCategory, TopologyTag, CabSize union types exported from types.ts for Phase 2 model metadata
- ToneIntentSchema enforces exactly 4 snapshots (min/max 4), max 6 effects, no numeric parameter fields
- z.toJSONSchema(ToneIntentSchema) confirmed working — Phase 3 can use this for Claude output_config

## Task Commits

1. **Task 1: Promote LowCut/HighCut + add topology types** - `9c26a96` (feat)
2. **Task 2: Create tone-intent.ts Zod schema** - `86c4100` (feat)

## Files Created/Modified
- `src/lib/helix/types.ts` - HlxCab required LowCut/HighCut; AmpCategory, TopologyTag, CabSize exports
- `src/lib/helix/tone-intent.ts` - NEW: ToneIntentSchema Zod schema + 6 type exports

## ToneIntent Fields
- ampName (string) — must match AMP_MODELS key
- cabName (string) — must match CAB_MODELS key
- guitarType (enum: single_coil, humbucker, p90)
- genreHint (optional string)
- effects (array of EffectIntent, max 6)
- snapshots (array of SnapshotIntent, exactly 4)
- tempoHint (optional integer 60-200)

## Decisions Made
- Used Zod 4.x API (z.toJSONSchema) instead of zod-to-json-schema package — native support confirmed
- Added Angle and Position optional fields to HlxCab (observed in real HX Edit exports)

## Deviations from Plan

None - plan executed exactly as written.

## TypeScript Errors in Other Files
- `src/lib/helix/preset-builder.ts(126)` — creates HlxCab without LowCut/HighCut. This is expected and will be resolved in Plan 02 when cab defaults are updated to Hz values.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- types.ts contracts ready for Plan 02 (models.ts will import AmpCategory, TopologyTag)
- tone-intent.ts ready for Phase 3 AI integration
- preset-builder.ts HlxCab error noted for Plan 02 resolution

---
*Phase: 01-foundation*
*Completed: 2026-03-01*
