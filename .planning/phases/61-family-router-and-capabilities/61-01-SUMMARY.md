---
phase: 61-family-router-and-capabilities
plan: 01
subsystem: api
tags: [typescript, device-family, capabilities, routing, tdd, vitest]

# Dependency graph
requires: []
provides:
  - DeviceFamily discriminated union (helix | stomp | podgo | stadium)
  - DeviceCapabilities interface with hardware specs per device
  - resolveFamily() exhaustive switch over 9 DeviceTarget values
  - getCapabilities() exhaustive switch returning capability constants
  - DeviceTarget extended to 9 values (adds helix_rack, pod_go_xl, helix_stadium_xl)
  - resolveFamily called at generate pipeline entry point
affects:
  - Phase 62 (catalog isolation — consumes DeviceFamily for catalog routing)
  - Phase 63 (Stadium firmware params — consumes getCapabilities for param extraction)
  - Phase 64 (guard removal — replaces isHelix/isPodGo/isStadium/isStomp with family checks)
  - Phase 65 (device-specific prompts — consumes DeviceFamily to select prompt template)
  - Phase 66 (frontend picker — consumes DeviceFamily for UI rendering)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Exhaustive switch + assertNever guard for compile-time DeviceTarget coverage"
    - "Capability constants (private to module) returned by exhaustive switch"
    - "TDD: RED (failing test) → GREEN (minimal implementation) → commit"

key-files:
  created:
    - src/lib/helix/device-family.ts
    - src/lib/helix/device-family.test.ts
  modified:
    - src/lib/helix/types.ts
    - src/lib/helix/index.ts
    - src/app/api/generate/route.ts

key-decisions:
  - "assertNever guard in resolveFamily() and getCapabilities() enforces compile-time exhaustiveness — adding a DeviceTarget without updating these functions causes a TS error"
  - "Stadium and Stadium XL share STADIUM_CAPABILITIES using conservative shared values — split into STADIUM_XL_CAPABILITIES if per-device precision needed in a future phase"
  - "pod_go_xl uses pod_go capabilities as placeholder — Pod Go XL not yet a real product"
  - "helix_rack assumes same device ID as helix_floor (0x210001) — marked UNVERIFIED pending real .hlx export confirmation"
  - "Chat route (/api/chat) does NOT receive device parameter — wiring deferred to Phase 66 when frontend device picker ships; ROUTE-04 satisfied by generate route wiring"
  - "deviceFamily variable exists at pipeline entry but is not yet consumed by downstream code — downstream phases 62-65 will thread it through"

patterns-established:
  - "Exhaustive switch pattern: all new device-level routing must use switch + assertNever, never if-else chains"
  - "Capability constants are private module constants, not exported — only getCapabilities() is public API"

requirements-completed: [ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 61 Plan 01: Family Router and Capabilities Summary

**DeviceFamily discriminated union with resolveFamily() and getCapabilities() covering 9 DeviceTarget values, wired at the generate pipeline entry point with compile-time exhaustiveness enforced by assertNever**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-06T03:08:16Z
- **Completed:** 2026-03-06T03:11:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- DeviceTarget extended from 6 to 9 values: helix_rack, pod_go_xl, helix_stadium_xl added to type union and DEVICE_IDS Record
- device-family.ts created with DeviceFamily union, DeviceCapabilities interface, resolveFamily(), getCapabilities(), and assertNever exhaustiveness guard
- 40 tests written and passing covering all 9 devices: family mapping, capability spot-checks, consistency between resolveFamily and caps.family
- resolveFamily() called at generate pipeline entry point — single resolution point for all downstream phases
- index.ts re-exports all 4 symbols: DeviceFamily, DeviceCapabilities, resolveFamily, getCapabilities
- TypeScript compiles with zero errors project-wide

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend DeviceTarget, create device-family.ts, write tests** - `7018892` (feat - TDD GREEN)
2. **Task 2: Wire resolveFamily at pipeline entry and export from index.ts** - `d489517` (feat)

**Plan metadata:** (docs commit — see below)

_Note: TDD task had RED (test file written, confirmed failing) then GREEN (implementation, all 40 pass)._

## Files Created/Modified

- `src/lib/helix/device-family.ts` - DeviceFamily union, DeviceCapabilities interface, resolveFamily(), getCapabilities(), assertNever guard, private capability constants
- `src/lib/helix/device-family.test.ts` - 40 tests covering all 9 DeviceTargets: family resolution, capability spot-checks, consistency validation
- `src/lib/helix/types.ts` - DeviceTarget extended to 9 values; DEVICE_IDS updated with 3 new entries; isHelix/isPodGo/isStadium updated for new variants
- `src/lib/helix/index.ts` - Re-exports resolveFamily, getCapabilities, DeviceFamily, DeviceCapabilities from device-family
- `src/app/api/generate/route.ts` - Imports resolveFamily + DeviceFamily; calls resolveFamily(deviceTarget) at pipeline entry

## Decisions Made

- **Chat route deferral:** /api/chat does not receive a device parameter — wiring deferred to Phase 66 when frontend picker ships. ROUTE-04 is satisfied by the generate route wiring (only pipeline entry with current device context).
- **Shared Stadium capabilities:** Stadium and Stadium XL share STADIUM_CAPABILITIES using conservative values. XL has more FX loops and an expression pedal, but these are documented in a comment for future splitting if needed.
- **assertNever pattern:** Both resolveFamily and getCapabilities use exhaustive switch + assertNever. This ensures TypeScript rejects any code that handles DeviceTarget without covering all variants.
- **Device ID placeholders:** helix_rack uses helix_floor's ID (UNVERIFIED); pod_go_xl uses pod_go's ID (PLACEHOLDER — not a real product); helix_stadium_xl uses 0 (UNVERIFIED — no corpus data).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 4 exported symbols (DeviceFamily, DeviceCapabilities, resolveFamily, getCapabilities) are available from @/lib/helix
- Phase 62 (catalog isolation) can import resolveFamily and DeviceFamily to route catalog lookups by family
- Phase 64 (guard removal) can replace isHelix/isPodGo/isStadium/isStomp with family === "helix" etc.
- Phase 65 (device-specific prompts) can use getCapabilities().ampCatalogEra and .family to select prompt template
- Phase 66 (frontend picker) can add device param to /api/chat when picker UI ships

## Self-Check: PASSED

- FOUND: src/lib/helix/device-family.ts
- FOUND: src/lib/helix/device-family.test.ts
- FOUND: .planning/phases/61-family-router-and-capabilities/61-01-SUMMARY.md
- FOUND commit: 7018892 (Task 1)
- FOUND commit: d489517 (Task 2)

---
*Phase: 61-family-router-and-capabilities*
*Completed: 2026-03-06*
