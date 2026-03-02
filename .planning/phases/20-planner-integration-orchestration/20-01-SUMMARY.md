---
phase: 20
plan: 01
subsystem: planner-integration
tags: [planner, orchestration, rig-emulation, toneContext]
key_files:
  modified:
    - src/lib/planner.ts
    - src/lib/rig-mapping.ts
    - src/app/api/generate/route.ts
    - src/app/page.tsx
decisions:
  - Added setSubstitutionMap(null) at top of generatePreset() try block per plan-checker instruction to prevent stale substitution state on re-generate
metrics:
  duration: "~15 minutes"
  completed: "2026-03-02"
  tasks: 4
  files: 4
---

# Phase 20 Plan 01: Planner Integration & Route Orchestration Summary

## What Was Built

Four surgical modifications wire the three Phase 17-19 systems (schemas, pedal mapping, vision) into a single end-to-end pipeline. The generate route now accepts optional `rigIntent` (from vision extraction) or `rigText` (plain-text rig description), builds a `SubstitutionMap`, converts it to a `toneContext` string, and passes that string as a third argument to `callClaudePlanner`. The planner appends this context to the user message only — preserving prompt caching on the system prompt — so Claude prioritizes rig-matched Helix models when building the ToneIntent.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/planner.ts` | Added optional `toneContext?: string` third parameter to `callClaudePlanner`; appends to user message, not system prompt |
| `src/lib/rig-mapping.ts` | Appended `parseRigText(text: string): RigIntent` — splits text on conjunctions/commas/newlines to build synthetic RigIntent |
| `src/app/api/generate/route.ts` | Added rigIntent/rigText orchestration path, `buildToneContext()` private helper, `substitutionMap` in both response shapes |
| `src/app/page.tsx` | Added `substitutionMap` state (4-A), extended `generatedPreset` type (4-B), updated `generatePreset()` (4-C), updated `startOver()` (4-D) |

## Verification Results

- TypeScript: 0 errors (`npx tsc --noEmit`)
- Tests: 108 passing, 0 failures (`npx vitest run`)
- Production build: clean (`npm run build`) — routes: `/api/chat`, `/api/generate`, `/api/vision`
- Invariants confirmed: `src/lib/rig-vision.ts` and `src/app/api/vision/route.ts` unchanged

## Notes for Downstream Phases

- Phase 21 can read `substitutionMap` from generate response `data.substitutionMap` to render SubstitutionCard UI
- `toneContext` format: header line + blank line + bullet list of `physicalPedal → helixModelDisplayName (confidence): reason`
- `parseRigText` is available in `@/lib/rig-mapping` for any server-side text rig input (not exported from `@/lib/helix` barrel — server-only utility)
- `callClaudePlanner` is fully backward-compatible: existing 2-arg call sites are unaffected

## Deviations from Plan

Added `setSubstitutionMap(null)` at the top of the `generatePreset()` try block (alongside `setError(null)`) to prevent stale substitution state from a previous rig-assisted generate from persisting on re-generate. This was specified by the plan checker as a required fix before Phase 21.

## Self-Check: PASSED

- `src/lib/planner.ts` — exists, `callClaudePlanner` accepts 3 args, `buildPlannerPrompt` signature unchanged
- `src/lib/rig-mapping.ts` — exists, `parseRigText` exported, `mapRigToSubstitutions` signature unchanged
- `src/app/api/generate/route.ts` — exists, imports `SubstitutionMap` and `RigIntent`, `buildToneContext` private helper present
- `src/app/page.tsx` — exists, `substitutionMap` state declared, `startOver()` calls `setSubstitutionMap(null)`, `generatePreset()` passes rigIntent conditionally
- Commit 961ed0e — verified in git log
- `src/lib/rig-vision.ts` — not in `git diff --name-only` output (unchanged)
- `src/app/api/vision/route.ts` — not in `git diff --name-only` output (unchanged)
