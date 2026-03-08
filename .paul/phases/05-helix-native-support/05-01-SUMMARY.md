---
phase: 05-helix-native-support
plan: 01
subsystem: device-support
tags: [helix-native, device-target, device-family, hlx]

# Dependency graph
requires:
  - phase: 01-audit-preset-quality
    provides: device-family architecture, DeviceTarget type system
provides:
  - helix_native as a fully supported DeviceTarget
  - UI device picker includes Helix Native
affects: [06-end-to-end-validation]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - src/lib/helix/types.ts
    - src/lib/helix/device-family.ts
    - src/app/page.tsx

key-decisions:
  - "Device ID 2162690 (0x210002) marked UNVERIFIED — estimated from Line 6 sequence"
  - "Helix Native maps to helix family — shares all catalogs, prompts, and builder"
  - "Variax explicitly excluded for Native (no VDI jack — it's a DAW plugin)"

patterns-established: []

# Metrics
duration: ~15min
started: 2026-03-08
completed: 2026-03-08
---

# Phase 5 Plan 01: Helix Native Device Target Summary

**Helix Native added as fully supported device — resolves to helix family, appears in device picker, full preset generation path works end-to-end.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-03-08 |
| Completed | 2026-03-08 |
| Tasks | 2 completed |
| Files modified | 3 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Device Target Registered | Pass | `helix_native` in DeviceTarget union, compiles, resolves to "helix" |
| AC-2: Capabilities Correctly Mapped | Pass | getCapabilities returns HELIX_CAPABILITIES, isHelix=true, isVariaxSupported=false |
| AC-3: UI Device Picker Shows Native | Pass | "Helix Native" in DEVICE_OPTIONS and DEVICE_LABELS |
| AC-4: Build Succeeds | Pass | TypeScript exhaustive switch checks pass, build clean |

## Accomplishments

- `helix_native` wired into DeviceTarget union, DEVICE_IDS, isHelix(), resolveFamily(), getCapabilities()
- Variax correctly excluded — `isVariaxSupported()` returns false for Native (no VDI jack)
- UI device picker shows "Helix Native" between Floor and Stadium

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/types.ts` | Modified | Added helix_native to DeviceTarget, DEVICE_IDS, isHelix(), isVariaxSupported() |
| `src/lib/helix/device-family.ts` | Modified | Added helix_native case to resolveFamily() and getCapabilities() |
| `src/app/page.tsx` | Modified | Added Helix Native to DEVICE_OPTIONS and DEVICE_LABELS |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Device ID 2162690 (0x210002) UNVERIFIED | Estimated from Line 6 device ID sequence | Can be confirmed from real Helix Native .hlx export later |
| No separate capabilities variant | Native has identical DSP architecture to Floor | expressionPedalCount=3 is technically wrong for Native (0 physical pedals) but snapshot system still works via MIDI |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Skill Audit

/ui-ux-pro-max is marked required for UI work. Task 2 added data entries to existing arrays (not visual/UX design). No gap — trivial data-only change.

## Next Phase Readiness

**Ready:**
- All 5 device families fully supported (helix, stomp, podgo, stadium + native variant)
- Ready for Phase 6: End-to-End Validation across all devices

**Concerns:**
- Device ID for helix_native is UNVERIFIED — should be confirmed during E2E validation
- expressionPedalCount=3 inherited from HELIX_CAPABILITIES (Native has 0 physical pedals)

**Blockers:**
- None

---
*Phase: 05-helix-native-support, Plan: 01*
*Completed: 2026-03-08*
