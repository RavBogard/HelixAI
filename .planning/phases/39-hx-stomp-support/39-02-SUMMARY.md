---
phase: 39
plan: 02
subsystem: api-generate
tags: [helix, stomp, api, routing, device-target]
one_liner: "Wired helix_stomp and helix_stomp_xl device routing into /api/generate with .hlx output and latest.hlx Supabase path"

dependency_graph:
  requires:
    - "39-01: buildStompFile, summarizeStompPreset, isStomp — all from stomp-builder.ts and types.ts"
    - "src/app/api/generate/route.ts (Stadium/Pod Go routing pattern to mirror)"
  provides:
    - "/api/generate accepts helix_stomp and helix_stomp_xl device strings"
    - "Stomp branch calls buildStompFile(), returns fileExtension: .hlx"
    - "Supabase storage path: latest.hlx (same as LT/Floor)"
  affects:
    - "39-03: UI can now send helix_stomp/helix_stomp_xl to /api/generate"

tech_stack:
  added: []
  patterns:
    - "isStomp() branch placed before isStadium() in Step 5 (returns early)"
    - "Fire-and-forget Supabase upload pattern (identical to LT/Floor branch)"

key_files:
  created: []
  modified:
    - "src/app/api/generate/route.ts — device string parsing + isStomp() routing branch"

key_decisions:
  - "isStomp branch placed FIRST in Step 5 (before isStadium) so early return prevents fall-through"
  - "rig-mapping.ts requires no changes — mapRigToSubstitutions works for Stomp via HD2_* catalog"
  - "STOMP-06/08/10 tests were already added in Plan 01 test block — no new test file changes needed"

metrics:
  duration_seconds: 120
  task_count: 2
  files_created: 0
  files_modified: 1
  tests_before: 140
  tests_after: 140
  completed_date: "2026-03-04"
---

# Phase 39 Plan 02: API Routing for Stomp Devices Summary

Wired helix_stomp and helix_stomp_xl device routing into /api/generate with .hlx output and latest.hlx Supabase path.

## What Was Built

### Task 1: route.ts Stomp routing (Commit: a97404a)

Updated `src/app/api/generate/route.ts` with three changes:

1. **Imports:** Added `buildStompFile`, `summarizeStompPreset`, `isStomp` to the `@/lib/helix` import
2. **Device string parsing:** Added two else-if branches before the final else-default:
   - `"helix_stomp"` → `deviceTarget = "helix_stomp"`
   - `"helix_stomp_xl"` → `deviceTarget = "helix_stomp_xl"`
3. **Step 5 branch:** Added `if (isStomp(deviceTarget))` block before the `if (isStadium(deviceTarget))` block (critical: returns early so Stomp never falls through to the Helix LT/Floor else branch):
   - Calls `buildStompFile(presetSpec, deviceTarget as "helix_stomp" | "helix_stomp_xl")`
   - Fire-and-forget Supabase upload to `${user.id}/${conversationId}/latest.hlx`
   - Returns `fileExtension: ".hlx"` (Stomp uses same extension as LT/Floor)

Updated comment on device resolution line to include helix_stomp and helix_stomp_xl.

### Task 2: rig-mapping.ts verification + tests

No changes required to `rig-mapping.ts`. The `mapRigToSubstitutions(rigIntent, device)` function:
- Accepts `DeviceTarget` (already extended in Plan 01)
- `lookupPedal()` uses `isModelAvailableForDevice()` which returns `true` for Stomp (not isPodGo, not isStadium → falls through to return true)
- `getModelIdForDevice()` returns `model.id` as-is for non-Pod Go devices (correct for Stomp HD2_* models)

End-to-end pipeline tests (STOMP-06, STOMP-08, STOMP-10) were added in Plan 01's test commit (ed15f8e). They cover:
- Full pipeline chain → params → snapshots → validate → buildStompFile
- mapRigToSubstitutions does not throw for helix_stomp or helix_stomp_xl
- Helix LT regression test

## Deviations from Plan

None. Plan executed exactly as written.

- `rig-mapping.ts` required no changes (as anticipated in plan's Change 4 note)
- Tests already existed from Plan 01 test block

## Build Result

```
npm run build: PASSED (zero TypeScript errors)
npx vitest run: 140/140 tests passed (unchanged from Plan 01)
```

## Self-Check: PASSED

- FOUND: src/app/api/generate/route.ts (modified — isStomp branch present)
- FOUND: commit a97404a (Task 1)
- Build: PASSED
- Tests: 140/140 PASSED
