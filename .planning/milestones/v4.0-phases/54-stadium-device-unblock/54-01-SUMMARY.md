---
phase: 54-stadium-device-unblock
plan: "01"
subsystem: stadium-unblock
tags: [stadium, api-guard, ui, device-picker, helix_stadium]
dependency_graph:
  requires: [53-stadium-builder-rebuild]
  provides: [stadium-fully-unblocked]
  affects: [src/app/api/generate/route.ts, src/app/page.tsx]
tech_stack:
  added: []
  patterns: [guard-removal, ui-device-picker-addition]
key_files:
  created: []
  modified:
    - src/app/api/generate/route.ts
    - src/app/page.tsx
    - src/lib/helix/stadium-builder.test.ts
decisions:
  - "Stadium format bugs (device version, slot params, grid positions) were already fixed by Phases 52 and 53 — no re-work needed"
  - "Pre-existing tsc cast errors in stadium-builder.test.ts fixed inline (double-cast via unknown) to satisfy TypeScript strict mode"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-05"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 54 Plan 01: Stadium Device Unblock Summary

**One-liner:** Removed helix_stadium 400 API guard and added STADIUM to both device picker arrays, fully unblocking Stadium preset generation in UI and API.

## What Was Built

Stadium device is now fully unblocked end-to-end:

1. **API guard removed** — `src/app/api/generate/route.ts` no longer returns HTTP 400 for `helix_stadium` requests. The guard is replaced with `deviceTarget = "helix_stadium"`, which falls through to the existing `isStadium(deviceTarget)` branch that calls `buildHspFile()`, handles Supabase persistence, and returns the `.hsp` file.

2. **STADIUM added to both device pickers** — Added `{ id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" }` after the FLOOR entry in both the rig-emulation flow picker (line ~1311) and the chat flow picker (line ~1405) in `src/app/page.tsx`.

3. **"Temporarily unavailable" messages removed** — Both `<div className="col-span-3 text-center">` blocks containing the Stadium unavailable spans were deleted from `page.tsx`.

## Pre-Flight Verification Results

All three format bugs from STAD-02/03/04 were confirmed already fixed by Phases 52 and 53:

| Check | Expected | Found | Status |
|-------|----------|-------|--------|
| STADIUM_DEVICE_VERSION in config.ts | 301990015 | 301990015 | PASS |
| access field in stadium-builder.ts slot params | 0 instances | 0 instances | PASS |
| Amp/cab fixed grid positions | amp=b05, cab=b06 via STADIUM_SLOT_ALLOCATION | STADIUM_SLOT_ALLOCATION["amp"]=5, ["cab"]=6 | PASS |

Task 1 (Fix Stadium format bugs) required no code changes — all three bugs were pre-resolved.

## Tasks Completed

| Task | Name | Commit | Files Modified |
|------|------|--------|----------------|
| 1 | Verify Stadium format bugs already fixed | (no code changes) | — |
| 2 | Remove API guard + add STADIUM to UI device pickers | 07ba9d8 | route.ts, page.tsx, stadium-builder.test.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript cast errors in stadium-builder.test.ts**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** Two `as` casts in stadium-builder.test.ts were too narrow — `StadiumSnapshotEntry[]` cast to `Array<Record<string, unknown>>` and `StadiumMeta` cast to `Record<string, unknown>` both lack index signatures causing TS2352 errors
- **Fix:** Added `as unknown as` double-cast at both locations (lines 447, 545) — standard TypeScript pattern for cross-type assertions in test code
- **Files modified:** `src/lib/helix/stadium-builder.test.ts`
- **Commit:** 07ba9d8

## Success Criteria Verification

- [x] Stadium device version constant is 301990015 — confirmed in config.ts
- [x] All Stadium slot params use { value: X } format (no access field) — grep returns 0
- [x] Amp blocks land at fixed b05, cab blocks at fixed b06 — STADIUM_SLOT_ALLOCATION confirmed
- [x] /api/generate accepts helix_stadium without error — deviceTarget = "helix_stadium" assigned
- [x] STADIUM button appears in both device pickers — confirmed in both arrays
- [x] All existing tests pass (185/185) — vitest run clean
- [x] TypeScript compiles cleanly — tsc --noEmit returns no errors

## Self-Check: PASSED

Files exist:
- src/app/api/generate/route.ts: FOUND
- src/app/page.tsx: FOUND
- src/lib/helix/stadium-builder.test.ts: FOUND

Commits exist:
- 07ba9d8: FOUND (feat(54-01): remove Stadium API guard and add STADIUM to device pickers)
