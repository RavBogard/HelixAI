---
phase: 53-stadium-builder-rebuild
plan: 01
subsystem: stadium-builder
tags: [stadium, hsp-format, tdd, param-encoding, slot-grid, fx-types, cab-params, cursor]
dependency_graph:
  requires: []
  provides: [fixed-hsp-serializer, stadium-cab-10-params, slot-grid-allocation]
  affects: [stadium-builder.ts, param-engine.ts]
tech_stack:
  added: []
  patterns: [slot-grid-allocation, device-aware-param-resolution, getStadiumBlockType-switch]
key_files:
  created:
    - src/lib/helix/stadium-builder.test.ts
  modified:
    - src/lib/helix/stadium-builder.ts
    - src/lib/helix/param-engine.ts
decisions:
  - "Stadium-specific cab params (Delay, IrData, Level, Pan, Position) added conditionally via device guard in resolveCabParams() — non-Stadium devices unaffected"
  - "Slot-grid allocation uses STADIUM_SLOT_ALLOCATION constant — amp always at b05/pos:5, cab at b06/pos:6, matching Agoura_Bassman.hsp reference"
  - "All effect blocks map to type:'fx' via getStadiumBlockType() exhaustive switch — distortion/dynamics/delay/reverb/modulation/wah/pitch/volume/send_return all return 'fx'"
  - "Cursor field added at preset level as { flow:0, path:0, position:0 } — safe default that matches format requirement"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-05"
  tasks_completed: 2
  files_modified: 3
---

# Phase 53 Plan 01: Stadium Builder Format Bug Fixes Summary

**One-liner:** Fixed all 5 confirmed .hsp format bugs — param encoding (no `access` field), slot-grid allocation (amp at b05, cab at b06), effect type mapping (`type: "fx"`), cab param completeness (10 params), and cursor field — via TDD with 6 new test cases against real .hsp reference files.

## What Was Built

Applied fixes to two files to bring Stadium .hsp output into conformance with real Line 6 .hsp files:

**`stadium-builder.ts` changes:**
1. Added `STADIUM_SLOT_ALLOCATION` constant — canonical slot positions replacing sequential `flowPos` counter
2. Added `makeBlockKey()` helper — generates bNN keys from slot position
3. Added `getStadiumBlockType()` — exhaustive switch mapping all effect types to `"fx"`
4. Updated `StadiumPreset` interface — added `cursor: { flow: number; path: number; position: number }`
5. Rewrote `buildStadiumFlow()` — uses slot allocation instead of sequential counter
6. Fixed `buildFlowBlock()` — removed `access: "enabled"` from slot params, uses `getStadiumBlockType()`
7. Fixed `buildHarness()` — removed `access: "enabled"` from amp and cab harness params
8. Fixed `buildInputBlock()`, `buildOutputBlock()`, `buildEmptyInputBlock()` — removed `access: "enabled"` from all slot params
9. Added `cursor` field to `buildStadiumPreset()` return object

**`param-engine.ts` changes:**
1. Updated `resolveCabParams(ampCategory, device?)` — Stadium-conditional extension adds Delay, IrData, Level, Pan, Position with defaults from Agoura_Bassman.hsp
2. Threaded `device` parameter through `resolveParameters()` → `resolveBlockParams()` → `resolveCabParams()`

## Test Results

| Test suite | Before | After |
|-----------|--------|-------|
| stadium-builder.test.ts (new) | 0/6 pass (RED) | 6/6 pass (GREEN) |
| Full suite | 170/170 pass | 176/176 pass |
| Regressions | — | 0 |

## Decisions Made

1. **Device guard for cab params:** Added 5 Stadium-only cab params conditionally via `isStadium(device)` check. Research noted `.hlx` cab format not re-inspected — device guard is safest approach to prevent non-Stadium regression (Pitfall 5 from research).

2. **Slot-grid amp position:** Amp always placed at canonical position 5 (b05) regardless of how many pre-amp effects precede it. Matches `Agoura_Bassman.hsp` reference. Resolves the STAD-04 bug where `gate+boost+amp` would yield amp at b03 using the old sequential counter.

3. **FX type mapping scope:** `getStadiumBlockType()` exhaustive switch includes all current BlockSpec effect types. `input`, `output`, `split`, `join`, `looper` are not in `BlockSpec["type"]` union but structural blocks are handled separately via dedicated build functions.

4. **Cursor default:** Using `{ flow: 0, path: 0, position: 0 }` as safe default. Real files show varying position values (2, 9) depending on user's last cursor position in HX Edit — but `0` is a valid default that satisfies the format requirement.

## Deviations from Plan

None — plan executed exactly as written. All 5 bug fixes applied in the order specified. TDD cycle: RED (6 failing tests committed at `0b6d9e6`) → GREEN (all fixes applied, 176 tests pass at `cc0150e`).

## Self-Check

Files created/modified:
- `src/lib/helix/stadium-builder.test.ts` — CREATED (359 lines, 6 test cases)
- `src/lib/helix/stadium-builder.ts` — MODIFIED (slot-grid, no access, fx types, cursor)
- `src/lib/helix/param-engine.ts` — MODIFIED (resolveCabParams device-conditional)
- `.planning/phases/53-stadium-builder-rebuild/53-01-SUMMARY.md` — CREATED

Commits:
- `0b6d9e6` — test(53-01): add failing tests for all 5 Stadium .hsp format bugs
- `cc0150e` — feat(53-01): fix all 5 Stadium .hsp format bugs (RED -> GREEN)

Verification:
- `grep -c 'access:' src/lib/helix/stadium-builder.ts` → 0 (no functional access field usage)
- `npx vitest run src/lib/helix/stadium-builder.test.ts` → 6/6 pass
- `npx vitest run` → 176/176 pass
- `npx tsc --noEmit` → zero errors
