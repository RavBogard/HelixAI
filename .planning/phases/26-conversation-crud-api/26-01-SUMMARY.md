---
phase: 26-conversation-crud-api
plan: "01"
subsystem: api
tags: [conversations, crud, supabase, rls, authentication]
dependency_graph:
  requires: [24-01, 24-02]
  provides: [CONV-01, CONV-02, CONV-04, CONV-05]
  affects: [27-persistence-wiring, 28-chat-sidebar-ui]
tech_stack:
  added: []
  patterns: [supabase-server-client, defense-in-depth-auth, rls-plus-explicit-filter, nextjs15-promise-params]
key_files:
  created:
    - src/app/api/conversations/route.ts
    - src/app/api/conversations/[id]/route.ts
    - src/app/api/conversations/[id]/title/route.ts
  modified: []
decisions:
  - "Every route independently calls supabase.auth.getUser() — defense-in-depth against CVE-2025-29927 middleware bypass"
  - "Ownership failures return 404 not 403 — no existence leakage for resources the user does not own"
  - "POST returns 201 Created (not 200) — correct HTTP semantics for resource creation"
  - "GET list limited to 50 rows — prevents unbounded queries on large conversation sets"
  - "Title truncated server-side to 60 chars — client cannot bypass length constraint"
  - "Next.js 15+ Promise<{ id: string }> params pattern used — avoids runtime 'params is a promise' error"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 26 Plan 01: Conversation CRUD API Summary

**One-liner:** Four conversation HTTP operations (POST create, GET list, GET read-with-messages, PATCH title) across three Next.js App Router route files with per-route session verification and RLS + explicit ownership defense-in-depth.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | POST create + GET list conversation routes | 8fafc36 | src/app/api/conversations/route.ts |
| 2 | GET read-with-messages + PATCH title routes | 4b4fe01 | src/app/api/conversations/[id]/route.ts, src/app/api/conversations/[id]/title/route.ts |

## What Was Built

Three route files implementing four HTTP operations for the conversation persistence API:

**`src/app/api/conversations/route.ts`**
- `POST /api/conversations` — accepts `{ device }`, inserts row with `user_id`, `device`, `title: 'New Chat'`, returns 201 with `{ id, title, device, created_at, updated_at }`
- `GET /api/conversations` — returns authenticated user's conversations ordered by `updated_at` descending, limited to 50 rows

**`src/app/api/conversations/[id]/route.ts`**
- `GET /api/conversations/[id]` — returns conversation with messages in a single Supabase embedded select query; messages ordered by `sequence_number` ascending via `referencedTable`

**`src/app/api/conversations/[id]/title/route.ts`**
- `PATCH /api/conversations/[id]/title` — updates title (trimmed, truncated to 60 chars server-side) and `updated_at`; returns updated row

## Security Patterns Applied

Every route handler:
1. Calls `supabase.auth.getUser()` independently (not relying on middleware) — CVE-2025-29927 defense
2. Returns 401 before any DB operation if auth fails
3. Includes `.eq('user_id', user.id)` on all queries — defense-in-depth on top of RLS
4. Returns 404 (not 403) for non-owned or non-existent resources — no existence leakage

## Decisions Made

- Every route independently calls `supabase.auth.getUser()` — defense-in-depth against CVE-2025-29927 middleware bypass
- Ownership failures return 404 not 403 — no existence leakage for resources the user does not own
- POST returns 201 Created (not 200) — correct HTTP semantics for resource creation
- GET list limited to 50 rows — prevents unbounded queries on large conversation sets
- Title truncated server-side to 60 chars — client cannot bypass length constraint
- Next.js 15+ `Promise<{ id: string }>` params pattern used — avoids runtime "params is a promise" error

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/api/conversations/route.ts
- FOUND: src/app/api/conversations/[id]/route.ts
- FOUND: src/app/api/conversations/[id]/title/route.ts

Commits exist:
- 8fafc36 — feat(26-01): add POST create and GET list conversation routes
- 4b4fe01 — feat(26-01): add GET read-with-messages and PATCH title routes

TypeScript: zero errors (verified with placeholder env vars)
Security patterns: getUser() present in all 3 files, .eq('user_id') in all 3 files, no 403 responses
