---
phase: 17
plan: 01
subsystem: rig-emulation
tags: [zod, schemas, types, rig-emulation, data-contracts]
dependency_graph:
  requires: []
  provides: [PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema]
  affects: [phase-18-vision-extraction, phase-19-substitution-engine, phase-21-substitution-card-ui]
tech_stack:
  added: []
  patterns: [zod-v4-two-arg-record, barrel-exports, inferred-types]
key_files:
  created:
    - src/lib/helix/rig-intent.ts
  modified:
    - src/lib/helix/index.ts
decisions:
  - "Used z.record(z.string(), valueSchema) two-argument form — required by Zod 4.3.6 (one-arg form throws TypeError)"
  - "knobPositions uses enum zones (low/medium-low/medium-high/high) not floats — matches vision model output format"
  - "parameterMapping marked optional on SubstitutionEntrySchema — absent when no knob translation available"
  - "helixModelDisplayName field added for human-readable UI display separate from internal model ID"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-02"
  tasks: 2
  files: 2
---

# Phase 17 Plan 01: Rig Emulation Zod Schemas Summary

Zod 4.3.6-compatible data contract schemas for the v1.3 Rig Emulation feature, covering the full pipeline from pedal extraction to Helix substitution output.

## What Was Built

Four Zod schemas with inferred TypeScript types in `src/lib/helix/rig-intent.ts`:

1. **PhysicalPedalSchema** — One physical pedal extracted from a user's photo or text description. Fields: brand, model, fullName (primary lookup key), knobPositions (enum zones), imageIndex (0-indexed), confidence (high/medium/low).

2. **RigIntentSchema** — Full extracted rig, output of the `/api/vision` route. Contains an array of PhysicalPedals plus optional rigDescription and extractionNotes.

3. **SubstitutionEntrySchema** — One pedal substitution entry for the substitution card UI (Phase 21). Maps a physical pedal name to a Helix model ID, display name, substitution reason, optional parameterMapping, and confidence level (direct/close/approximate).

4. **SubstitutionMapSchema** — Full substitution result: a flat array of SubstitutionEntry objects for an entire rig.

All four schemas export both the Zod schema object and the inferred TypeScript type.

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/lib/helix/rig-intent.ts` | Created | All 4 schemas + 4 inferred types |
| `src/lib/helix/index.ts` | Appended | Barrel re-exports for all Phase 17 schemas and types |

## Verification Results

```
$ npx tsc --noEmit
(no output — zero TypeScript errors)
```

TypeScript check passed with zero errors. All schemas are compatible with the existing Zod version in the project.

## Notes for Downstream Phases

- **Phase 18 (Vision Extraction):** Use `RigIntentSchema.parse()` to validate Claude's vision API response. The `fullName` field is the primary key for PEDAL_HELIX_MAP lookups.
- **Phase 19 (Substitution Engine):** Use `SubstitutionEntrySchema` and `SubstitutionMapSchema` to type the engine's output. The `confidence` enum (direct/close/approximate) drives the UI badge color in Phase 21.
- **Phase 21 (Substitution Card UI):** `helixModelDisplayName` is the human-readable display name for the card. `parameterMapping` is optional — render knob values only when present.
- **Zod version:** Project uses Zod 4.3.6. The two-argument `z.record(z.string(), valueSchema)` form is required. Do not use the one-argument form in any new schemas.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/lib/helix/rig-intent.ts`: FOUND
- `src/lib/helix/index.ts`: FOUND (Phase 17 exports appended at lines 21-22)
- `npx tsc --noEmit`: zero errors
