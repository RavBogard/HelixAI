---
phase: 27-persistence-wiring
plan: 02
subsystem: ui
tags: [react, supabase, conversation, storage, signed-url]

# Dependency graph
requires:
  - phase: 27-01
    provides: /api/chat and /api/generate wired to persist messages and presets when conversationId present
  - phase: 26-01
    provides: POST /api/conversations, PATCH /api/conversations/[id]/title, GET /api/conversations/[id]
  - phase: 24-01
    provides: createSupabaseBrowserClient — browser Supabase client with RLS-enforced storage access
provides:
  - "conversationId lifecycle management in page.tsx — create on first authenticated message, pass to all API calls, reset on startOver"
  - "ensureConversation() helper — atomic conversation creation for authenticated users, null-safe for anonymous"
  - "loadConversation() — full conversation resume: messages, device, preset path restoration"
  - "downloadStoredPreset() — re-download previously generated preset via signed URL without regenerating"
affects: [28-chat-sidebar-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef for synchronous access to async-updated state (conversationIdRef avoids React state race condition on first message)"
    - "Fire-and-forget async with .catch(() => {}) for cosmetic operations (auto-title PATCH)"
    - "ref ?? await ensureConversation() pattern for optional conversation creation in generatePreset()"

key-files:
  created: []
  modified:
    - src/app/page.tsx

key-decisions:
  - "conversationIdRef (useRef) used alongside conversationId (useState) — ref provides synchronous access in sendMessage/generatePreset closures, state provides React re-render trigger for Phase 28 sidebar"
  - "ensureConversation() returns null for anonymous users (is_anonymous: true) — anonymous flow sends no conversationId, preserving UXP-04"
  - "Auto-title uses first 7 words of user message, fire-and-forget PATCH — title is cosmetic, failure is non-blocking"
  - "downloadStoredPreset() uses browser client createSignedUrl(path, 3600) — 1-hour expiry, RLS enforced at storage layer"
  - "loadConversation() defined here (called by Phase 28 sidebar) — persistence wiring complete; UI integration deferred"

patterns-established:
  - "useRef shadow of useState for synchronous read in async callbacks — avoids React state batching race condition"
  - "Null-propagation pattern: ...(convId ? { conversationId: convId } : {}) — absent key means anonymous, present key means persistence active"

requirements-completed: [STORE-02, UXP-04]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 27 Plan 02: Persistence Wiring (page.tsx) Summary

**Client-side conversation lifecycle in page.tsx: create on first authenticated message via useRef-guarded ensureConversation(), pass conversationId to /api/chat and /api/generate, auto-title after first message, and signed-URL re-download of stored presets for resumed conversations**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T22:56:13Z
- **Completed:** 2026-03-03T22:58:38Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- conversationId useState + conversationIdRef declared; ensureConversation() creates conversations for authenticated users and returns null for anonymous (UXP-04 preserved)
- sendMessage() passes conversationId to /api/chat; auto-title fires after first message as fire-and-forget PATCH
- generatePreset() uses conversationIdRef.current ?? ensureConversation() pattern for both chat-flow and handleRigGenerate() paths; passes convId to /api/generate
- downloadStoredPreset() fetches signed URL from Supabase Storage and triggers browser download without calling /api/generate (STORE-02)
- loadConversation() restores messages, device, conversationId, and storedPresetPath from GET /api/conversations/[id] — ready for Phase 28 sidebar
- startOver() clears conversationId state, ref, isFirstMessageRef, and storedPresetPath — next session starts fully clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add conversationId state management and pass to API calls** - `b134e33` (feat)
2. **Task 2: Add stored preset re-download for resumed conversations** - `c028cc7` (feat)

## Files Created/Modified
- `src/app/page.tsx` - Added conversationId lifecycle (state + ref + ensureConversation), auto-title, generatePreset convId wiring, downloadStoredPreset, loadConversation, "Download Stored Preset" button, startOver cleanup

## Decisions Made
- `conversationIdRef` (useRef) used in parallel with `conversationId` (useState) — the ref provides synchronous access needed inside async callbacks to avoid the React state batching race condition documented in Research Pitfall 6; the state variable exists for future Phase 28 sidebar reactivity
- `ensureConversation()` memoized with `useCallback([selectedDevice])` — the device is captured at conversation creation time so the server stores the correct device for the conversation
- Auto-title truncates at 7 words (plan spec says 5-8) — implementation uses `slice(0, 7)` which is within spec
- `downloadStoredPreset()` determines extension from path suffix (`.pgp` vs `.hlx`) — matches Phase 26-02 storage contract
- `loadConversation()` sets `isFirstMessageRef.current = false` on resume — prevents auto-title from firing on subsequent messages in resumed conversations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 28 (Chat Sidebar UI) can now call `loadConversation(convId)` to resume any conversation — the function is exported-ready in page.tsx
- `conversationId` state is available for sidebar to display "current conversation" indicator
- All persistence wiring is complete: Phase 27-01 handles server-side persistence; Phase 27-02 handles client-side conversation lifecycle

---
*Phase: 27-persistence-wiring*
*Completed: 2026-03-03*
