---
phase: 21
plan: 01
subsystem: substitution-card-ui
tags: [substitution-card, api-map, progressive-loading, rig-emulation]
key_files:
  created:
    - src/app/api/map/route.ts
  modified:
    - src/app/page.tsx
decisions:
  - None
metrics:
  duration: "~8 minutes"
  completed: "2026-03-02"
  tasks: 3
  files: 2
---

# Phase 21 Plan 01: Substitution Card & End-to-End Polish Summary

## What Was Built

A lightweight `/api/map` POST route runs `mapRigToSubstitutions()` deterministically (no AI calls, <100ms) immediately after vision extraction, returning `{ substitutionMap }` to the client. A new `SubstitutionCard` React component renders each pedal-to-Helix substitution with confidence-tiered badges (green Exact match, yellow Best match, orange Approximate) and an escape-hatch panel for unknown pedals. Progressive loading in `callVision()` chains into `callMap()` after vision completes, showing a "Mapping to Helix models..." spinner as a distinct second phase, with a device re-map `useEffect` that re-runs `/api/map` whenever the user changes the target device.

## Files Modified

| File | Change |
|------|--------|
| `src/app/api/map/route.ts` | Created — deterministic POST route wrapping `mapRigToSubstitutions()` |
| `src/app/page.tsx` | Added SubstitutionCard component, isMappingLoading state, callMap() helper, updated callVision() chain, device re-map useEffect, replaced raw JSON details block, updated generate button label |

## Verification Results

- `npx tsc --noEmit`: PASSED — zero errors
- `npx vitest run`: 108 passing, 0 failures (5 test files)
- `npm run build`: PASSED — clean build, /api/map route compiled as Dynamic (ƒ)
- Invariant files unchanged: `src/lib/rig-mapping.ts`, `src/lib/planner.ts`, `src/app/api/generate/route.ts`, `src/app/api/vision/route.ts`

## Notes for Phase 21 Completion

- v1.3 Rig Emulation milestone is now COMPLETE
- SubstitutionCard shows pre-generate mapping results to user with confidence-tiered badges
- All three devices (helix_lt, helix_floor, pod_go) work end-to-end via device re-map useEffect
- Text-only generation path unchanged from v1.2 — callMap() is gated on `rigIntent !== null` (SC-7)
- HD2_ internal IDs are guarded against display in SubstitutionCard (invariant SC-2)
- /api/map has no maxDuration or dynamic exports as required (invariant SC-3)

## Deviations from Plan

None — plan executed exactly as written. All 6 sub-modifications (3-A through 3-F, with 3-G handled in 3-B per plan) applied in order.

## Self-Check: PASSED

- src/app/api/map/route.ts: FOUND
- src/app/page.tsx: MODIFIED
- npx tsc --noEmit: PASSED (zero errors)
- npx vitest run: 108 passing
- npm run build: PASSED (clean, /api/map shows as Dynamic route)
- git push: PUSHED to origin/main (commit 1ef6126)
