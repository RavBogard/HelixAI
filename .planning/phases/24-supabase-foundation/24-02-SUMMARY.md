---
phase: 24-supabase-foundation
plan: "02"
subsystem: database
tags: [supabase, postgresql, rls, storage, vercel-cron, schema]

# Dependency graph
requires:
  - phase: 24-01
    provides: createSupabaseServerClient from src/lib/supabase/server.ts

provides:
  - supabase/schema.sql — complete database schema with RLS policies and storage bucket
  - src/app/api/cron/keep-alive/route.ts — keep-alive cron route executing real DB query
  - vercel.json — cron schedule firing every 4 days to prevent Supabase pause

affects:
  - 25-auth-flow
  - 26-conversation-crud-api
  - 27-persistence-wiring
  - 28-chat-sidebar-ui

# Tech tracking
tech-stack:
  added: []
  patterns:
    - RLS enabled at table creation time (not retrofitted) — CVE-2025-48757 prevention
    - Messages owned through parent conversation via subquery (no separate user_id on messages)
    - Storage RLS with storage.foldername 1-indexed path convention
    - Vercel cron with CRON_SECRET Bearer token validation
    - force-dynamic export on cron route to prevent response caching

key-files:
  created:
    - supabase/schema.sql
    - src/app/api/cron/keep-alive/route.ts
    - vercel.json
  modified: []

key-decisions:
  - "RLS enabled immediately after CREATE TABLE in same script — no window of unprotected data access"
  - "messages table has no user_id column — ownership enforced via conversation_id subquery to conversations"
  - "device column uses TEXT without CHECK constraint — flexibility for future device types"
  - "presets storage bucket is private (public: false) — files accessible only via signed URLs"
  - "keep-alive route queries conversations table — HTTP-only pings do not reliably prevent Supabase pause"
  - "vercel.json cron schedule 0 9 */4 * * — every 4 days provides 3-day buffer before 7-day pause threshold"

patterns-established:
  - "Pattern: Storage path convention is {user_id}/{conversation_id}/latest.hlx — (storage.foldername(name))[1] = user_id"
  - "Pattern: Cron route returns NextResponse.json({ok, timestamp}) on success, {ok: false, error} on failure"

requirements-completed: [INFRA-02, INFRA-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 24 Plan 02: Database Schema with RLS + Vercel Keep-Alive Summary

**PostgreSQL schema with RLS-at-creation-time on conversations/messages tables, private presets storage bucket with per-user path policies, and Vercel cron keep-alive executing a real database query every 4 days**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T19:25:43Z
- **Completed:** 2026-03-03T19:27:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Database schema SQL with conversations and messages tables, RLS enabled immediately after each CREATE TABLE (no gap — CVE-2025-48757 prevention)
- presets storage bucket (private) with 4 RLS policies using correct 1-indexed storage.foldername path convention
- Vercel cron keep-alive route that executes a real DB query (not HTTP ping) to prevent Supabase 7-day inactivity pause

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database schema SQL with RLS policies and storage bucket** - `4b5af6a` (feat)
2. **Task 2: Create Vercel cron keep-alive route and vercel.json** - `c00967c` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `supabase/schema.sql` - Complete schema: conversations, messages, RLS policies, composite index, presets storage bucket with 4 per-user policies
- `src/app/api/cron/keep-alive/route.ts` - GET handler with CRON_SECRET auth, queries conversations table, returns {ok, timestamp}
- `vercel.json` - Cron schedule: /api/cron/keep-alive every 4 days at 09:00 UTC

## Decisions Made

- RLS enabled at table creation time in same script — prevents any window of unprotected PostgREST API access
- messages table has no user_id column — ownership is enforced via conversation_id subquery (cleaner schema, all joins go through conversations)
- device column uses TEXT without CHECK constraint — chosen for flexibility to add new device types without schema migration
- keep-alive route uses createSupabaseServerClient() to query conversations (PostgREST queries register as database activity)
- CRON_SECRET validation uses strict equality (not startsWith) — prevents partial-match bypass

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** Two manual steps:

1. **Run schema.sql in Supabase SQL Editor**
   - Supabase Dashboard -> SQL Editor -> New query
   - Paste contents of `supabase/schema.sql`
   - Click Run
   - This creates: conversations table, messages table, RLS policies, composite index, presets bucket

2. **Set CRON_SECRET environment variable in Vercel**
   - Generate: `openssl rand -hex 16`
   - Vercel Dashboard -> Project -> Settings -> Environment Variables
   - Add: `CRON_SECRET` = [generated value] for Production + Preview environments

## Next Phase Readiness

- Database schema is ready to receive data once schema.sql is run in Supabase
- Keep-alive cron is deployed as part of vercel.json — will activate after next Vercel deployment
- Phase 25 (Auth Flow) can proceed: anonymous sign-in and identity linking patterns are unblocked
- Phase 26 (Conversation CRUD API) has the table definitions it needs

---
*Phase: 24-supabase-foundation*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: supabase/schema.sql
- FOUND: src/app/api/cron/keep-alive/route.ts
- FOUND: vercel.json
- FOUND: .planning/phases/24-supabase-foundation/24-02-SUMMARY.md
- FOUND: commit 4b5af6a (feat: database schema SQL)
- FOUND: commit c00967c (feat: keep-alive route and vercel.json)
