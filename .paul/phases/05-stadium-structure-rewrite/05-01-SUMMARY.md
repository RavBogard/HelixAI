---
phase: 05-stadium-structure-rewrite
plan: 01
subsystem: preset-builder
tags: [stadium, hsp, cab-slots, footswitch, bypass, golden-preset]

requires:
  - phase: 04-stomp-xl-structure-rewrite
    provides: golden preset methodology, shared builder patterns
provides:
  - Stadium dual cab slots matching real .hsp references
  - Sources bypass field on all footswitch entries
  - Effect block footswitch controller assignments (targetbypass)
  - Updated device_version to match latest firmware references
affects: [06-validation-layer]

tech-stack:
  added: []
  patterns: [dual-cab-slot, source-bypass-field, fx-controller-assignment]

key-files:
  created: []
  modified:
    - src/lib/helix/stadium-builder.ts
    - src/lib/helix/config.ts

key-decisions:
  - "Footswitch controller source ID = 0x01010100 + flowPosition (matches reference pattern)"
  - "NoCab second slot uses minimal params: IrData, Level, LowCut, HighCut"
  - "device_version updated 301990015 → 302056738 (newer firmware references)"

patterns-established:
  - "Stadium cab blocks always have 2 slots: actual cab + HD2_CabMicIr_NoCab"
  - "All source entries include bypass: false field"
  - "Effect blocks get @enabled.controller with type targetbypass; amp/cab blocks do not"

duration: ~10min
completed: 2026-03-08T22:20:00Z
---

# Phase 5 Plan 01: Stadium Structure Rewrite Summary

**Fixed Stadium builder structural gaps: dual cab slots, sources bypass field, effect block footswitch controllers, and device_version — matching 4 real .hsp reference presets.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-03-08 |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Cab Blocks Have Dual Slots | Pass | Second slot = HD2_CabMicIr_NoCab with IrData/Level/LowCut/HighCut |
| AC-2: Sources Have Bypass Field | Pass | All 24 source entries (12 per flow) now include bypass: false |
| AC-3: Effect Blocks Have Footswitch Controller | Pass | @enabled.controller with type "targetbypass", source = 0x01010100 + position |
| AC-4: Existing Tests Pass | Pass | 1201/1201 tests pass, tsc clean |

## Accomplishments

- Cab blocks now have 2 slot entries matching all 4 reference .hsp files (actual cab + NoCab placeholder)
- All 24 footswitch source entries include bypass: false field
- Effect blocks have @enabled.controller with targetbypass type and position-based source IDs
- device_version updated to 302056738 matching latest NH reference presets

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| All tasks | `dfa1bdd` | feat | Dual cab slots, sources bypass, fx controllers, device_version |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/stadium-builder.ts` | Modified | Dual cab slots in buildFlowBlock, bypass field in buildStadiumSources, controller in buildBlockEnabled |
| `src/lib/helix/config.ts` | Modified | STADIUM_DEVICE_VERSION 301990015 → 302056738 |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Source ID = 0x01010100 + flowPosition | Matches pattern in all 4 reference .hsp files | Correct footswitch-to-block mapping |
| NoCab slot with minimal params | All references show same 4 params (IrData, Level, LowCut, HighCut) | Cab blocks load correctly in Stadium Edit |
| device_version → 302056738 | NH references show newer firmware version than Agoura references | Better compatibility with current Stadium firmware |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- All 5 device builders (Helix, Pod Go, Stomp, Stomp XL, Stadium) now match golden preset structure
- Foundation set for Phase 6 (Validation Layer) to verify all device formats

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 05-stadium-structure-rewrite, Plan: 01*
*Completed: 2026-03-08*
