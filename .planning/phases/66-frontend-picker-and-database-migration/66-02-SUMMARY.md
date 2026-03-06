---
phase: 66-frontend-picker-and-database-migration
plan: 02
subsystem: ui
tags: [react, typescript, nextjs, state-management, device-picker, ux]

# Dependency graph
requires:
  - phase: 66-01-state-foundation
    provides: DEVICE_OPTIONS/DEVICE_LABELS constants, deviceLocked/needsDevicePicker state, null-safe loadConversation
  - phase: 65-device-specific-prompts
    provides: Per-family chat prompts that /api/chat now activates via device param
affects:
  - 68-token-control-and-prompt-caching (full device pipeline now active — token measurement can begin)

provides:
  - Welcome screen device picker gate (FRONT-01): user sees picker before any chat input
  - Device lock on first message (FRONT-02): setDeviceLocked(true) in sendMessage()
  - device: selectedDevice in every /api/chat POST body (FRONT-02: closes Phase 61 deferral)
  - readyToGenerate refactor: locked badge + Generate button instead of device-click-generates
  - Resume picker for legacy conversations with null device (inline needsDevicePicker branch)
  - MAINTENANCE_MODE = false (app renders HomeContent, not maintenance page)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Welcome screen picker gate pattern: device picker rendered above chat form, helix_lt pre-selected as default, amber border highlights selection
    - Device lock on send pattern: sendMessage() calls setDeviceLocked(true) on first message — prevents mid-conversation device change
    - Locked badge + Generate button pattern: replaces device-click-generates at readyToGenerate, shows DEVICE_LABELS label + separate button

key-files:
  created: []
  modified:
    - src/app/page.tsx

key-decisions:
  - "helix_lt pre-selected as default on welcome screen — reduces friction for most common device, satisfies FRONT-01 spirit (selectedDevice always has a value on first send)"
  - "Generate Preset button is separate from device badge — decouples device selection from generation trigger, giving user explicit confirmation moment"
  - "Legacy resume picker (needsDevicePicker=true) retains click-to-generate atomically — acceptable because device is unknown and selecting IS confirming intent"
  - "device: selectedDevice added to /api/chat POST body — closes the Phase 61 deferral, activates Phase 65 per-family chat prompts end-to-end"

patterns-established:
  - "Device-first gate pattern: DEVICE_OPTIONS.map() picker on welcome screen above chat form, selectedDevice pre-seeded to helix_lt"
  - "Lock-on-send pattern: sendMessage() gates on !deviceLocked before calling setDeviceLocked(true) — idempotent, safe to call on every message"

requirements-completed: [FRONT-01, FRONT-02]

# Metrics
duration: ~15min
completed: 2026-03-06
---

# Phase 66 Plan 02: Frontend Picker UI Summary

**Welcome screen device picker gate, device lock on first message, device in /api/chat POST body, and Generate Preset button replacing device-click-generates — Phase 61 deferral resolved, Phase 65 per-family prompts now fully active end-to-end**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-06T17:35:00Z
- **Completed:** 2026-03-06T17:50:00Z
- **Tasks:** 2 (1 auto, 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments
- Added device picker to welcome screen above chat form — helix_lt pre-selected, clicking any device highlights it with amber border; satisfies FRONT-01
- sendMessage() now calls setDeviceLocked(true) on first message and sends `device: selectedDevice` in the /api/chat POST body — resolves Phase 61 deferral and activates Phase 65 per-family chat prompts (FRONT-02)
- readyToGenerate section refactored from device-click-generates to locked device badge ("Generating for {device}") + separate "Generate Preset" button — cleaner UX separation of concerns
- Inline resume picker preserved for needsDevicePicker (legacy null-device conversations) — click-to-generate retained for that case only
- MAINTENANCE_MODE set to false — HomeContent renders, maintenance page no longer shown

## Task Commits

Each task was committed atomically:

1. **Task 1: Welcome screen device picker, device lock, device in chat POST, Generate button** - `556eaa5` (feat)
2. **Task 2: Human verification checkpoint** - Approved (TypeScript 0 errors, all 8 verification criteria confirmed)

## Files Created/Modified
- `src/app/page.tsx` - Welcome screen device picker grid, device lock in sendMessage(), `device: selectedDevice` in fetch body, readyToGenerate refactor to badge+button, MAINTENANCE_MODE=false

## Decisions Made
- helix_lt pre-selected as the welcome screen default — the most common device, reduces friction, and means `selectedDevice` is never empty when user sends their first message
- Generate Preset is a separate button (not triggered by clicking the locked device badge) — gives users a clear confirmation moment before generation begins
- Legacy resume picker retains click-to-generate because selecting a device for a null-device conversation IS the intent confirmation; no separate button needed there
- Rig upload picker unchanged (handleRigGenerate on device click) — that flow is select-and-generate by design, not a mid-conversation lock scenario

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Runtime Supabase env var error noted during verification — pre-existing issue (no .env.local in the worktree), not caused by Phase 66 changes. TypeScript compiled clean with 0 errors.

## User Setup Required
None from this plan. The Supabase column migration SQL documented in 66-01 (schema.sql PART 3) is still required before deployment.

## Next Phase Readiness
- Phase 66 complete: device picker gate, device lock, device in chat POST, and database migration SQL all delivered
- Phase 65 per-family prompts are now end-to-end active — /api/chat receives `device` and routes to the correct per-family system prompt
- Phase 68 (Token Control and Prompt Caching) can begin — full device pipeline is wired, token measurement is unblocked
- No blockers

---
*Phase: 66-frontend-picker-and-database-migration*
*Completed: 2026-03-06*
