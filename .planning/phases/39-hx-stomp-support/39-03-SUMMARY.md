---
phase: 39
plan: 03
subsystem: ui-page
tags: [helix, stomp, ui, device-picker, page.tsx]
one_liner: "Added STOMP and STOMP XL to both device pickers (grid-cols-3 2x3 layout), download suffixes, badge, and otherDevice chip"

dependency_graph:
  requires:
    - "39-01: DeviceTarget union, isStomp() — UI type safety depends on backend type"
    - "39-02: /api/generate accepts helix_stomp/helix_stomp_xl — UI sends these strings"
  provides:
    - "Both device pickers show 6 devices (LT/FLOOR/STADIUM + POD GO/STOMP/STOMP XL) in grid-cols-3"
    - "Download produces _Stomp.hlx and _StompXL.hlx filenames"
    - "Badge shows STOMP / STOMP XL for respective devices"
    - "Generate for other device chip handles all 6 devices correctly"
    - "loadConversation can restore helix_stomp and helix_stomp_xl device state"
  affects:
    - "User can now select and generate presets for HX Stomp and HX Stomp XL"

tech_stack:
  added: []
  patterns:
    - "grid-cols-3 with 6 entries (2 rows of 3) for device pickers"
    - "Inline type union expansion pattern (matching existing page.tsx conventions)"

key_files:
  created: []
  modified:
    - "src/app/page.tsx — 8 locations updated (state type, 2 function signatures, 2 download switches, loadConversation cast, badge, 2 device picker arrays, otherDevice chip)"

key_decisions:
  - "grid-cols-3 (not grid-cols-6) for better readability — two rows group form factors visually"
  - "Row 1: LT | FLOOR | STADIUM; Row 2: POD GO | STOMP | STOMP XL (compact/pedalboard row)"
  - "otherDevice chip: LT->Floor, Floor->LT, everything else->LT (simplest correct mapping)"
  - "generatePreset() and handleRigGenerate() function signatures updated (deviation Rule 1 fix)"

metrics:
  duration_seconds: 180
  task_count: 2
  files_created: 0
  files_modified: 1
  tests_before: 140
  tests_after: 140
  completed_date: "2026-03-04"
---

# Phase 39 Plan 03: UI Device Picker Update Summary

Added STOMP and STOMP XL to both device pickers (grid-cols-3 2x3 layout), download suffixes, badge, and otherDevice chip.

## What Was Built

### Task 1: Type union, download suffixes, badge, loadConversation (Commit: d06429b)

Updated 5 locations in `src/app/page.tsx`:

1. **selectedDevice useState type** (line 309): Added `"helix_stomp" | "helix_stomp_xl"` to the 4-member union → now 6-member union
2. **downloadPreset() device suffix** (line 763): Added `_Stomp` and `_StompXL` cases before the empty-string fallback
3. **downloadStoredPreset() device suffix** (line 800): Same pattern — Stomp and Stomp XL cases added
4. **loadConversation() setSelectedDevice cast** (line 846): Extended type cast to include Stomp variants (so session restore works)
5. **Device badge** (line 1431): Added `STOMP` and `STOMP XL` label cases before `POD GO` fallback

Also fixed TypeScript cast errors in `orchestration.test.ts` — `HlxTone` cannot be directly cast to `Record<string, unknown>`, changed to `as unknown as Record<string, unknown>` (vitest passes but strict TS rejects it). This is a [Rule 1 - Bug] fix discovered during TypeScript compilation.

### Task 2: Device picker arrays and otherDevice chip (Commit: 69fea68)

Updated 3 more locations:

1. **Rig device picker** (line 1277): `grid-cols-4 → grid-cols-3`, added STOMP and STOMP XL entries, reordered to: LT | FLOOR | STADIUM / POD GO | STOMP | STOMP XL
2. **Chat device picker** (line 1368): Same changes as rig picker — same 6 devices, grid-cols-3, same row grouping
3. **otherDevice chip** (lines 1545-1556): Updated logic:
   - LT → helix_floor ("Generate for Helix Floor")
   - Floor → helix_lt ("Generate for Helix LT")
   - Everything else (pod_go, stadium, stomp, stomp_xl) → helix_lt ("Generate for Helix LT")

Also fixed (deviation Rule 1): `generatePreset()` and `handleRigGenerate()` function signatures had hardcoded `"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium"` parameter types. Updated to include `"helix_stomp" | "helix_stomp_xl"` — required for TypeScript to accept the new picker's `id` values being passed as arguments.

## Deviations from Plan

**1. [Rule 1 - Bug] HlxTone cast in orchestration.test.ts needed `as unknown as`**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `file.data.tone as Record<string, unknown>` fails strict TS because HlxTone interface doesn't have an index signature. Tests run fine (vitest doesn't do strict TS checking by default), but `tsc --noEmit` and `npm run build` fail.
- **Fix:** Changed to `file.data.tone as unknown as Record<string, unknown>` (double cast via unknown — standard TypeScript pattern for intentional type narrowing)
- **Files modified:** `src/lib/helix/orchestration.test.ts`
- **Commit:** d06429b

**2. [Rule 1 - Bug] generatePreset() and handleRigGenerate() parameter types too narrow**
- **Found during:** Task 2 build verification
- **Issue:** Both functions used inline type unions `"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium"`. Adding Stomp entries to the picker arrays passes the new `id` type to these functions — TypeScript rejects the call.
- **Fix:** Extended both function parameter types to include `"helix_stomp" | "helix_stomp_xl"`
- **Files modified:** `src/app/page.tsx`
- **Commit:** 69fea68

## Build Result

```
npm run build: PASSED (zero TypeScript errors)
npx vitest run: 140/140 tests passed (page.tsx changes don't affect unit tests)
```

## Self-Check: PASSED

- FOUND: src/app/page.tsx (modified — both pickers, badge, download, otherDevice)
- FOUND: commit d06429b (Task 1)
- FOUND: commit 69fea68 (Task 2)
- Build: PASSED
- Tests: 140/140 PASSED

## Note on STOMP-09

Manual HX Edit import verification is required for full STOMP-09 validation (hardware import test). This cannot be automated — requires physical HX Stomp/XL hardware and HX Edit software to import a generated .hlx file. The file format is structurally correct based on:
- Device IDs confirmed from real hardware exports (2162694, 2162699)
- HelixStomp_* I/O models confirmed from real hardware exports
- Standard HlxFile JSON structure identical to LT/Floor (schema: L6Preset, version: 6)
