---
phase: 26-conversation-crud-api
plan: "02"
subsystem: api
tags: [supabase, next.js, rest-api, messages, storage]

# Dependency graph
requires:
  - phase: 26-01
    provides: GET /api/conversations/[id] route file that this plan extends with DELETE
  - phase: 24-02
    provides: messages table schema with sequence_number, conversations.preset_url column, presets storage bucket
  - phase: 24-01
    provides: createSupabaseServerClient factory used by both handlers

provides:
  - POST /api/conversations/[id]/messages — saves message with server-side sequence_number
  - DELETE /api/conversations/[id] — deletes conversation with Supabase Storage preset cleanup

affects: [27-persistence-wiring, 28-chat-sidebar-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-side sequence number computation via MAX+1 query before insert"
    - "Read-then-delete ordering for storage cleanup (preset_url read before row deletion)"
    - "Non-fatal storage delete — DB operation proceeds regardless of storage errors"
    - "fire-and-forget updated_at refresh after message insert"

key-files:
  created:
    - src/app/api/conversations/[id]/messages/route.ts
  modified:
    - src/app/api/conversations/[id]/route.ts

key-decisions:
  - "preset_url stores storage object path (not full HTTPS URL) — supabase.storage.remove() takes object path"
  - "Storage delete failure is non-fatal — conversation row delete proceeds regardless"
  - "Conversation ownership verified before message save via explicit .eq('user_id') check (not relying solely on RLS)"
  - "updated_at refresh after message insert is fire-and-forget — 201 response not blocked on it"

patterns-established:
  - "Read-delete ordering: always read preset_url before deleting the conversation row"
  - "Non-fatal storage: wrap storage.remove() without awaiting its error result for the DB path"

requirements-completed: [CONV-03, CONV-06]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 26 Plan 02: Message Save + Conversation Delete Summary

**POST /api/conversations/[id]/messages with server-side MAX+1 sequence numbers, and DELETE with read-before-delete storage cleanup coordinating DB and Supabase Storage**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T22:45:12Z
- **Completed:** 2026-03-03T22:47:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Message save endpoint assigns sequence_number server-side as MAX+1 per conversation — never client-generated, consistent with STATE.md locked decision
- Conversation ownership verified before any message insert (defense-in-depth, not relying solely on RLS)
- DELETE handler follows strict three-step ordering: read preset_url, delete storage file (non-fatal), delete DB row (FK cascade removes messages automatically)
- Storage delete failure does not orphan a conversation row — non-fatal pattern properly implemented

## Task Commits

Each task was committed atomically:

1. **Task 1: Create POST message-save endpoint with server-side sequence numbers** - `f7380b5` (feat)
2. **Task 2: Add DELETE handler to conversation [id] route with storage cleanup** - `b78b5af` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/api/conversations/[id]/messages/route.ts` — POST handler: ownership check, sequence_number MAX+1 computation, insert, updated_at refresh, returns 201
- `src/app/api/conversations/[id]/route.ts` — Added DELETE export alongside existing GET; three-step delete ordering with non-fatal storage cleanup

## Decisions Made

- preset_url stores the Supabase Storage object path, NOT a full HTTPS URL. `supabase.storage.from('presets').remove()` takes the object path directly. Phase 27 must write the path (not URL) when uploading presets.
- Storage delete is fire-and-forget for the delete path — if storage is unavailable, the conversation row is still removed and the user is not blocked.
- Conversation ownership check uses explicit `.eq('user_id', user.id)` before message insert — defense-in-depth per the CVE-2025-29927 pattern established in Phase 26-01.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Both endpoints use the existing Supabase client and schema from Phase 24.

## Next Phase Readiness

- Phase 27 (Persistence Wiring) can now call `POST /api/conversations/[id]/messages` from the modified `/api/chat` route to persist user and assistant messages
- Phase 27 preset upload code must write the storage object path (not full URL) to `conversations.preset_url` to match the DELETE handler's `storage.remove()` contract
- All 6 Conversation CRUD operations are now implemented: POST create, GET list, GET read-with-messages, PATCH title (Plan 01) + POST message, DELETE conversation (Plan 02)

---
*Phase: 26-conversation-crud-api*
*Completed: 2026-03-03*
