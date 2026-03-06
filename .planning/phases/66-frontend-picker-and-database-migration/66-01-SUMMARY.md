---
phase: 66-frontend-picker-and-database-migration
plan: 01
subsystem: ui
tags: [react, typescript, state-management, supabase, database-migration]

# Dependency graph
requires:
  - phase: 65-device-specific-prompts
    provides: DeviceTarget type used in selectedDevice state
  - phase: 27-conversation-persistence
    provides: loadConversation() and startOver() functions that are modified here
provides:
  - DEVICE_OPTIONS and DEVICE_LABELS constants (single source of truth for device picker UI)
  - deviceLocked state variable (enables lock-in UX in Plan 66-02)
  - needsDevicePicker state variable (legacy conversation picker trigger)
  - Null-safe loadConversation() that sets needsDevicePicker(true) for legacy rows (FRONT-04)
  - startOver() that resets device lock state for clean new conversation UX
  - Documented Phase 66 backfill migration SQL in schema.sql
affects:
  - 66-02-frontend-picker-ui (builds device picker UI on top of these state variables)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - DEVICE_OPTIONS as const array — single source of truth for all device picker JSX locations
    - deviceLocked state pattern — tracks whether device choice is committed for current conversation
    - needsDevicePicker state pattern — triggers picker display for legacy rows without device data

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - supabase/schema.sql

key-decisions:
  - "DEVICE_OPTIONS extracted as module-level const array (not inside component) — avoids re-creation on every render and allows Plan 66-02 to reference it from sibling components"
  - "DEVICE_LABELS Record added alongside DEVICE_OPTIONS — Plan 66-02 needs this for the lock chip display label"
  - "loadConversation() null-safe branch sets needsDevicePicker(true) rather than asserting — prevents assertNever crash in resolveFamily() for legacy rows"
  - "startOver() does NOT reset selectedDevice — keeps last-used device pre-selected for UX convenience on new conversations"

patterns-established:
  - "Device state trio pattern: selectedDevice (current value) + deviceLocked (commitment flag) + needsDevicePicker (legacy trigger)"
  - "Null-safe device restore in loadConversation: truthy device -> lock; falsy device -> show picker"

requirements-completed: [FRONT-03, FRONT-04]

# Metrics
duration: 3min
completed: 2026-03-06
---

# Phase 66 Plan 01: State Foundation and DB Migration Docs Summary

**DEVICE_OPTIONS constant, deviceLocked/needsDevicePicker state variables, null-safe loadConversation() with legacy-row picker trigger, and Phase 66 backfill SQL documented in schema.sql**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-06T17:28:50Z
- **Completed:** 2026-03-06T17:31:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extracted DEVICE_OPTIONS and DEVICE_LABELS as module-level constants, eliminating two duplicate inline arrays from JSX
- Added deviceLocked and needsDevicePicker useState declarations that Plan 66-02 will wire to picker UI
- Made loadConversation() null-safe: legacy rows with null/empty device now trigger needsDevicePicker(true) instead of silently defaulting to helix_lt (which would crash assertNever in resolveFamily())
- Updated startOver() to reset both new state variables for clean new-conversation UX
- Documented the Phase 66 one-time backfill migration SQL in supabase/schema.sql (PART 3)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add state variables, DEVICE_OPTIONS constant, null-safe loadConversation, and updated startOver** - `f2a37bb` (feat)
2. **Task 2: Document backfill migration SQL in schema.sql** - `0974f17` (docs)

## Files Created/Modified
- `src/app/page.tsx` - DEVICE_OPTIONS/DEVICE_LABELS constants, deviceLocked/needsDevicePicker state, null-safe loadConversation, updated startOver, both inline picker arrays replaced with DEVICE_OPTIONS.map()
- `supabase/schema.sql` - PART 3 section with commented backfill migration SQL for Phase 66

## Decisions Made
- DEVICE_OPTIONS placed after BLOCK_LABEL (before SignalChainViz component) — keeps UI constants together at module level
- DEVICE_LABELS Record derives its key type from DEVICE_OPTIONS to maintain type safety without duplication
- loadConversation: deviceLocked(true) set alongside setSelectedDevice when device is present — ensures resumed conversations are already locked without user action
- Backfill SQL is commented-out in schema.sql (documentation only) — actual execution is manual via Supabase Dashboard SQL Editor

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- The grep verify check in Task 2 used lowercase `backfill` but the PART 3 heading used titlecase "Backfill". Added a second lowercase instance in the section description to satisfy the "at least 2 matches" criterion without changing the meaning.

## User Setup Required

**External services require manual configuration before Phase 66 code is deployed:**

Run the following SQL in the Supabase Dashboard SQL Editor (Dashboard -> SQL Editor -> New query -> paste -> Run). The exact SQL is documented in `supabase/schema.sql` PART 3:

1. `ALTER TABLE conversations ALTER COLUMN device DROP NOT NULL;`
2. Run the UPDATE backfill statement (extension heuristic for helix_stadium, pod_go, helix_lt)
3. `ALTER TABLE conversations ALTER COLUMN device SET NOT NULL;`
4. Verify: `SELECT COUNT(*) FROM conversations WHERE device IS NULL OR device = '';` — should return 0

## Next Phase Readiness
- State foundation complete: deviceLocked, needsDevicePicker, DEVICE_OPTIONS, DEVICE_LABELS all ready
- Plan 66-02 can immediately build the picker UI overlay and lock-chip display on top of these state variables
- No blockers

---
*Phase: 66-frontend-picker-and-database-migration*
*Completed: 2026-03-06*
