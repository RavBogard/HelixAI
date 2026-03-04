---
phase: 30-chat-auto-save-on-first-ai-response
plan: 01
subsystem: ui
tags: [react, supabase, sidebar, conversation, persistence, sse]

# Dependency graph
requires:
  - phase: 27-persistence-wiring
    provides: ensureConversation(), isFirstMessageRef, conversationIdRef, /api/conversations/[id]/title PATCH, /api/conversations/[id]/messages POST
  - phase: 28-chat-sidebar-ui-ux-polish
    provides: ChatSidebar helixai:conversation-created event listener, helixai:new-chat event
provides:
  - Deferred sidebar refresh — fires after auto-title PATCH resolves, not on bare conversation creation
  - Generate-only message persistence — user message + assistant summary saved to DB after successful /api/generate
  - Correct sidebar title — first 7 words of user message shown instead of "New Chat"
affects: [future-conversation-loading, sidebar-refresh-timing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Fire-and-forget .then()/.catch() chain for deferred side effects after async operations
    - isFirstMessageRef guard pattern to prevent duplicate event dispatch across chat + generate flows

key-files:
  created: []
  modified:
    - src/app/page.tsx

key-decisions:
  - "Phase 30: helixai:conversation-created dispatch moved from ensureConversation() to sendMessage() and generatePreset() success paths — fires after auto-title PATCH resolves, not on bare creation"
  - "Phase 30: generate-only flow persists last user message + data.summary as assistant message fire-and-forget after /api/generate success"
  - "Phase 30: isFirstMessageRef guard reused in generatePreset() to prevent duplicate sidebar notifications when chat + generate are both used in same conversation"

patterns-established:
  - "Deferred sidebar notification: dispatch event AFTER meaningful content exists (title set), not on resource creation"
  - "Generate persistence: save lastUserMsg + data.summary as messages after /api/generate succeeds — all fire-and-forget, non-blocking"

requirements-completed: [SAVE-01, SAVE-02, SAVE-03, SAVE-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 30 Plan 01: Chat Auto-Save on First AI Response Summary

**Sidebar refresh deferred to after auto-title PATCH resolves, and generate-only flow now persists user + assistant messages so conversations appear in sidebar with real titles**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-04T03:44:00Z
- **Completed:** 2026-03-04T03:46:30Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Removed premature `helixai:conversation-created` dispatch from `ensureConversation()` — sidebar no longer shows "New Chat" immediately on conversation creation
- `sendMessage()` now dispatches `helixai:conversation-created` AFTER the title PATCH resolves (success or failure), so sidebar always shows the real first-7-words title
- `generatePreset()` now saves the last user message and `data.summary` as an assistant message to `/api/conversations/[id]/messages` after successful generation
- `generatePreset()` auto-titles and dispatches `helixai:conversation-created` for generate-only flows guarded by `isFirstMessageRef.current`
- Anonymous users completely unaffected — `convId` is null for them, all persistence blocks are skipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Move sidebar refresh to after auto-title and remove premature creation event** - `7c1a40c` (feat)
2. **Task 2: Persist messages in generate-only flow and notify sidebar** - `ce611db` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/app/page.tsx` - Removed premature sidebar event dispatch from ensureConversation(); updated sendMessage() to fire event after auto-title PATCH; added message persistence + auto-title + sidebar notification to generatePreset()

## Decisions Made
- `helixai:conversation-created` now dispatched in sendMessage() and generatePreset() success paths instead of ensureConversation() — this ensures the sidebar always shows meaningful content (real title + at least one message) before the conversation appears in the list
- `isFirstMessageRef.current` guard reused in generatePreset() to prevent duplicate sidebar notifications when both sendMessage() and generatePreset() are called in the same conversation session
- All generate-flow message saves are fire-and-forget (.catch(() => {})) — no latency added to generate UX

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — TypeScript compiled cleanly after both changes with zero errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Conversation auto-save complete — authenticated users' chats appear in sidebar with real titles after first AI response (chat or generate path)
- Returning users will find their complete conversation history in the sidebar
- No blockers for next phases

---
*Phase: 30-chat-auto-save-on-first-ai-response*
*Completed: 2026-03-04*
