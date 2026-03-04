---
phase: 29-dual-amp-preset-generation-fix
plan: 02
subsystem: knowledge-layer
tags: [chain-rules, param-engine, snapshot-engine, dual-amp, signal-chain]

requires:
  - phase: 29-dual-amp-preset-generation-fix
    provides: "ToneIntentSchema with optional secondAmpName/secondCabName (Plan 01)"
provides:
  - "Dual-amp chain assembly with two amp+cab pairs on separate paths"
  - "Independent parameter resolution per amp using own model category"
  - "Per-snapshot amp bypass toggle with independent ChVol overrides"
affects: [preset-builder]

tech-stack:
  added: []
  patterns: ["Object identity tracking for same-model-twice edge case in chain assembly"]

key-files:
  created: []
  modified:
    - "src/lib/helix/chain-rules.ts"
    - "src/lib/helix/param-engine.ts"
    - "src/lib/helix/snapshot-engine.ts"

key-decisions:
  - "Used object identity (===) for secondary block detection to handle same-model-twice"
  - "Cab bypass not toggled in snapshot engine — amp bypass on same path is sufficient"
  - "detectAmpCategory() now explicitly finds path-0 amp first for dual-amp correctness"

patterns-established:
  - "path=0 is primary amp, path=1 is secondary amp — consistent across all engines"
  - "Dual-amp detected by counting amp blocks rather than type flag"

requirements-completed: [DUAL-03, DUAL-04, DUAL-05]

duration: 8min
completed: 2026-03-03
---

# Plan 29-02: Knowledge Layer Summary

**Dual-amp chain assembly with split/join topology, independent parameter resolution, and per-snapshot amp bypass toggle**

## Performance

- **Duration:** 8 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- chain-rules.ts builds two amp+cab BlockSpec entries on path 0 and path 1 for Helix dual-amp presets
- param-engine.ts resolves each amp's parameters using its own model category (e.g., clean primary + high-gain secondary)
- snapshot-engine.ts toggles amp bypass per snapshot role with independent ChVol overrides on both amps
- Pod Go silently falls back to single-amp with no errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Dual-amp chain assembly in chain-rules.ts** - `2817314` (feat)
2. **Task 2: Param resolution + snapshot toggle** - `d43c37c` (feat)

## Files Created/Modified
- `src/lib/helix/chain-rules.ts` - Dual-amp detection, second amp/cab insertion, effect limit, path assignment
- `src/lib/helix/param-engine.ts` - Secondary amp category/topology resolution for path-1 blocks
- `src/lib/helix/snapshot-engine.ts` - Dual-amp bypass toggle, independent ChVol, path-0 amp category detection

## Decisions Made
- Used object identity rather than model.id comparison for secondary block tracking (handles same amp model twice)
- Removed cab bypass from snapshot toggle since cabs aren't in block key system; amp bypass is sufficient for path-level signal routing
- detectAmpCategory explicitly searches path-0 first to avoid order-dependent results with dual-amp

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Same-model-twice edge case**
- **Found during:** Task 1 (chain assembly)
- **Issue:** Plan used model.id comparison which would incorrectly match both amps when same model used twice
- **Fix:** Used object identity (===) comparison against tracked PendingBlock references
- **Files modified:** src/lib/helix/chain-rules.ts
- **Verification:** TypeScript compiles, logic verified by code inspection
- **Committed in:** 2817314 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Cab toggle impossible in snapshot engine**
- **Found during:** Task 2 (snapshot bypass toggle)
- **Issue:** Plan specified cab toggling in snapshot blockStates, but cabs are excluded from buildBlockKeys
- **Fix:** Removed cab toggle code; amp bypass on same path is sufficient for signal routing
- **Files modified:** src/lib/helix/snapshot-engine.ts
- **Verification:** TypeScript compiles, logic verified
- **Committed in:** d43c37c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Chain produces valid dual-amp BlockSpec array ready for preset builder in Plan 03
- Preset builder needs to detect dual-amp, set AB topology, write split/join blocks

---
*Phase: 29-dual-amp-preset-generation-fix*
*Completed: 2026-03-03*
