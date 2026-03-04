---
plan: 31-01
phase: 31-device-id-research-floor-fix
status: complete
completed: "2026-03-04"
---

# 31-01 Summary: Restore helix_floor Device ID

## What Changed

**File:** `src/lib/helix/types.ts`

Single-line fix in `DEVICE_IDS` constant:
- Before: `helix_floor: 2162692, // Floor and LT share the same preset format and device ID`
- After: `helix_floor: 2162691, // 0x210003 — confirmed from real Helix Floor .hlx export (Phase 23, commit 3ba0768); regression in commit 68ad895 set this back to 2162692 — now restored`

Also added:
- Block comment above constant citing Phase 23 research and commit 3ba0768
- Inline hex + source comments for `helix_lt` (0x210004) and `pod_go` (0x210007)

## Regression Root Cause

Commit `68ad895` ("docs: start milestone v2.0") reset `DEVICE_IDS.helix_floor` from `2162691` to `2162692`. This made Floor and LT share the same device ID, causing Helix Floor users to receive presets the hardware rejects with `-8309 Incompatible target device type`.

## Confirmed Correct Value

`2162691` (0x210003) — confirmed from real Helix Floor hardware in Phase 23, commit `3ba0768` (fix(phase-23): correct Helix Floor device ID).

## Test Result

**108/108 passed** across all 5 test files.

The previously-failing test at `orchestration.test.ts` line 87–94 is now green:
- `expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor)` — passes (2162691 === 2162691)
- `expect(hlx.data.device).toBe(2162691)` — passes (literal also confirmed)

`orchestration.test.ts` was not modified — it was already correct.

## Files Modified

- `src/lib/helix/types.ts` — DEVICE_IDS constant corrected

## Commits

- `68de815` — fix(31-01): restore helix_floor device ID to 2162691 (was 2162692)

## Self-Check

- [x] `DEVICE_IDS.helix_floor === 2162691` (not 2162692)
- [x] `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt` (structurally distinct values)
- [x] Source comment cites Phase 23 and commit 3ba0768
- [x] Test at orchestration.test.ts:93 passes
- [x] Full suite: 108/108 green
- [x] `orchestration.test.ts` has zero diff (unchanged)
- [x] Live -8309 error for Floor users is eliminated
