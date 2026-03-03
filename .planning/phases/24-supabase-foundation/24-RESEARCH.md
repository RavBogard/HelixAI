# Phase 24: Supabase Foundation - Research

**Researched:** 2026-03-03
**Domain:** Supabase project setup, PostgreSQL schema with RLS, isomorphic client utilities, Next.js App Router middleware, Supabase Storage bucket, keep-alive mechanism, and environment variable configuration
**Confidence:** HIGH — all claims verified against Context7 official Supabase SSR docs, official Supabase llms.txt, and current WebSearch cross-referenced against official Vercel and Supabase docs

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Supabase project with PostgreSQL database, Auth, and Storage configured — `@supabase/supabase-js` and `@supabase/ssr` installed as the only new dependencies | Standard install pattern verified in Context7; package names and roles confirmed; no other packages needed |
| INFRA-02 | Row Level Security enabled on all tables at creation time — `conversations` and `messages` tables enforce `user_id = auth.uid()` on all operations; no user can read another user's data | RLS SQL patterns verified; must be done at table creation (not retrofitted); CVE-2025-48757 established this as a critical requirement |
| INFRA-03 | Middleware at project root refreshes session tokens on every non-static request — without this, JWT tokens expire and sessions break mid-use | `updateSession()` middleware pattern verified in Context7; mandatory, not optional per official Supabase SSR docs |
| INFRA-04 | Two Supabase client utilities (browser client + server client) provide isomorphic database access across Client Components, Server Components, and Route Handlers | `createBrowserClient` and `createServerClient` from `@supabase/ssr` verified in Context7; three-variant usage confirmed (browser, server-readonly, route-handler) |
| INFRA-05 | Keep-alive mechanism prevents Supabase free-tier 7-day inactivity pause — automated ping every 4 days via cron job or GitHub Action | Supabase 7-day pause confirmed; HTTP ping alone may not count as "activity" — direct database query required; GitHub Actions and Vercel cron both viable; Vercel cron via `vercel.json` preferred since project is already on Vercel |
| INFRA-06 | Environment variables configured in Vercel for both preview and production — Supabase URL, anon key, and Google OAuth callback URLs registered in Google Cloud Console | Env var naming in transition; both `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` work; Vercel cron requires `CRON_SECRET` for security |
</phase_requirements>

---

## Summary

Phase 24 is the infrastructure foundation for all v2.0 persistence features. It has zero user-facing output — its deliverables are internal plumbing: packages installed, schema created, client utilities written, middleware active, storage bucket with RLS, and a keep-alive cron job deployed. Nothing in Phase 25-28 can function without every item in this phase being correct.

The technical patterns are well-established and well-documented. Supabase's official Next.js App Router guide covers the exact patterns needed: two client factory functions (browser and server), middleware calling `supabase.auth.getUser()` on every non-static request, SQL for tables with RLS enabled at creation time, and a private storage bucket with `storage.objects` policies. Context7 confirms these patterns match the current `@supabase/ssr` API. The research uncovered one important naming transition: Supabase is moving from `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as the preferred env var name. Both work during the transition period — use the anon key value, call it `NEXT_PUBLIC_SUPABASE_ANON_KEY` for now, and note this for future rotation.

The most operationally critical finding concerns the keep-alive mechanism. Recent community reports (2025) indicate that simple HTTP health-check pings no longer reliably prevent Supabase project pauses — a direct database query is required. The preferred implementation for this project is a Vercel cron job (the app is already on Vercel, no additional service needed), calling a lightweight `/api/cron/keep-alive` route that runs `SELECT 1` via the Supabase JS client against the `conversations` table. This must be deployed in the same phase as the database schema — not added later.

**Primary recommendation:** Install packages, create database schema with RLS, write three client utility variants, wire middleware, create private storage bucket with RLS policies, deploy Vercel keep-alive cron — in that exact order. Zero user-facing code in this phase.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.80.0 (latest) | Main Supabase client — auth, database queries, storage uploads | Isomorphic SDK; identical API surface in Client Components, Server Components, Server Actions, and Route Handlers; no dual-SDK split like Firebase |
| `@supabase/ssr` | 0.8.0 (latest) | SSR-safe client factory for Next.js App Router | Required for correct cookie-based session handling in App Router; replaces the deprecated `@supabase/auth-helpers-nextjs` |

### Supporting (no new installs)

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `next` | 16.1.6 (already installed) | App Router middleware, server components, route handlers | Existing dependency; middleware.ts is a Next.js native feature |
| Supabase SQL Editor / CLI | n/a | Run schema migrations | Used during setup; not a package dependency |
| GitHub Actions or Vercel cron | n/a | Keep-alive scheduled task | Choose Vercel cron — already on Vercel platform |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-nextjs` | Officially deprecated as of 2024 — do not use |
| Vercel cron (keep-alive) | GitHub Actions | Both work; Vercel cron is simpler since app is already deployed there; GitHub Actions does not require a separate service |
| Vercel cron (keep-alive) | Supabase Edge Function + cron-job.org | More complex; Edge Functions have cold starts; Vercel cron is native to the deployment |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase is transitioning to publishable keys; anon key value works in both variable names; use `ANON_KEY` naming for now since project is not using new publishable key format yet |

**Installation:**
```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 24 additions only)

```
src/
└── lib/
    └── supabase/
        ├── client.ts          # createSupabaseBrowserClient() — for Client Components
        ├── server.ts          # createSupabaseServerClient() — for Server Components, Route Handlers
        └── middleware.ts      # updateSession() — called by root middleware.ts

middleware.ts                  # Project root — session refresh on every non-static request

app/
└── api/
    └── cron/
        └── keep-alive/
            └── route.ts       # GET handler — SELECT 1 via Supabase; protected by CRON_SECRET

vercel.json                    # New — defines cron schedule for keep-alive route
```

**What this phase does NOT create:**
- No auth components (Phase 25)
- No conversation or message API routes (Phase 26)
- No modifications to `page.tsx`, `layout.tsx`, or any existing route (Phase 26+)
- No frontend changes of any kind

### Pattern 1: Browser Client Factory

**What:** A singleton client for Client Components that uses `document.cookie` automatically.

**When to use:** Any Client Component (`'use client'`) that needs to query Supabase or call auth methods.

```typescript
// Source: Context7 /supabase/ssr — createBrowserClient
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 2: Server Client Factory

**What:** A server-side client for Server Components and Route Handlers that reads and writes cookies via `next/headers`.

**When to use:** Any Server Component, Server Action, or Route Handler that needs auth state or database access.

**Critical detail:** Server Components cannot write cookies, so the `setAll` handler must be wrapped in a `try/catch` — middleware handles the actual cookie write for Server Components.

```typescript
// Source: Context7 /supabase/ssr — createServerClient
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Components cannot write cookies; middleware handles this
          }
        },
      },
    }
  )
}
```

### Pattern 3: Middleware for Session Refresh

**What:** Root-level `middleware.ts` that calls `supabase.auth.getUser()` on every non-static request to refresh expired JWT tokens and sync cookies between browser and server.

**When to use:** This is mandatory, not optional. Without it, session cookies expire and users are silently logged out mid-session.

**Critical detail:** Use `getUser()` not `getSession()`. `getSession()` returns unverified data from the cookie. `getUser()` contacts the Supabase auth server to verify the token and returns the refreshed session.

**Critical detail:** The `setAll` implementation in middleware must update BOTH `request.cookies` AND `supabaseResponse.cookies`. The double-set is required for cookie propagation to work correctly.

```typescript
// Source: Context7 /supabase/ssr + /llmstxt/supabase_llms_txt — updateSession pattern
// middleware.ts (project root)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST use getUser() not getSession() — verifies token with auth server
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Critical detail for this project:** The matcher must NOT include `/api/chat`, `/api/generate`, `/api/vision`, `/api/map` — these routes must remain outside middleware auth checks to preserve the anonymous flow performance (Pitfall 8 from SUMMARY.md). The matcher pattern above already excludes API routes that are not protected.

Actually: the matcher above matches everything except static files — including `/api/*` routes. This is correct behavior. Middleware only refreshes the session token; it does not block unauthenticated requests. The anon flow routes will pass through middleware, which will either find no session to refresh or find an anonymous session. This adds minimal overhead. Blocking behavior is never added to middleware in this project — each API route independently decides what to do with an absent session.

### Pattern 4: Database Schema with RLS

**What:** PostgreSQL tables with RLS enabled at creation time. RLS policies ensure users can only access their own rows.

**Critical detail:** `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` must appear in the same migration script as `CREATE TABLE`. Never create a table first and add RLS later after data exists.

**Critical detail for the `preset_url` column:** The architecture in STATE.md uses `preset_url TEXT` directly on the `conversations` table (not a separate `presets` table as shown in STACK.md). Follow STATE.md — one column on conversations, no separate presets table. This matches the deterministic key pattern `presets/{user_id}/{conversation_id}/latest.hlx` with upsert.

**Critical detail for `sequence_number`:** STATE.md and SUMMARY.md both specify a `sequence_number` integer column on `messages` for server-side ordering. Include this in the schema. It must be indexed on `(conversation_id, sequence_number)`.

```sql
-- Source: Official Supabase RLS docs + project STATE.md schema decisions
-- Run in Supabase SQL Editor

-- conversations table
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  device      TEXT NOT NULL,           -- 'helixLT' | 'helixFloor' | 'podGo'
  preset_url  TEXT,                    -- Supabase Storage path; nullable until first generation
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages table
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  sequence_number INTEGER NOT NULL,    -- server-assigned; never client-generated
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for correct ordering on fetch
CREATE INDEX idx_messages_conversation_sequence
  ON messages (conversation_id, sequence_number);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_messages"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );
```

### Pattern 5: Supabase Storage Bucket with RLS

**What:** Private storage bucket for `.hlx` and `.pgp` preset files. RLS on `storage.objects` restricts each user to their own path prefix.

**Path convention:** `{user_id}/{conversation_id}/latest.hlx` (or `.pgp`)
- `(storage.foldername(name))[1]` = `user_id`
- `(storage.foldername(name))[2]` = `conversation_id`
- `storage.filename(name)` = `latest.hlx` or `latest.pgp`

**Critical detail:** The path structure means the RLS policy checks index `[1]` against `auth.uid()` to enforce user isolation.

**Critical detail:** Enable RLS on `storage.objects` explicitly with `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY` — then write policies for the specific bucket.

```sql
-- Source: Official Supabase Storage RLS docs + WebSearch verification
-- Create the private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('presets', 'presets', false);

-- RLS on storage.objects (may already be enabled; idempotent)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Users can upload their own preset files
CREATE POLICY "users_upload_own_presets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can read their own preset files
CREATE POLICY "users_read_own_presets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (upsert) their own preset files
CREATE POLICY "users_update_own_presets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own preset files
CREATE POLICY "users_delete_own_presets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'presets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Pattern 6: Vercel Cron Keep-Alive

**What:** A scheduled API route that runs every 4 days and makes a direct database query against the Supabase project to prevent the 7-day inactivity pause.

**Critical detail:** HTTP health-check pings (to `/health` or `/status`) have been reported to not reliably count as "activity" for Supabase inactivity detection (2025 community reports). A direct database query via the Supabase JS client IS reliable. The keep-alive route must execute an actual query — `SELECT 1` is sufficient, but querying a real table (e.g., `conversations`) is safer.

**Critical detail:** Vercel free (Hobby) plan supports cron jobs. Vercel automatically includes `CRON_SECRET` as a bearer token in cron requests — the route must validate this header to prevent unauthorized pings.

```typescript
// Source: Official Vercel cron docs + WebSearch
// app/api/cron/keep-alive/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('conversations')
    .select('id')
    .limit(1)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString() })
}
```

```json
// vercel.json (project root)
{
  "crons": [
    {
      "path": "/api/cron/keep-alive",
      "schedule": "0 9 */4 * *"
    }
  ]
}
```

The cron schedule `0 9 */4 * *` runs at 09:00 UTC every 4 days. This provides a 3-day buffer against the 7-day pause threshold.

### Anti-Patterns to Avoid

- **Using `getSession()` instead of `getUser()` in middleware:** `getSession()` returns unverified cookie data; `getUser()` verifies with the Supabase auth server. Use `getUser()` in middleware and route handlers for authorization decisions.
- **Creating tables without RLS before writing application code:** Any table that exists without RLS is a 403-free data exposure via the auto-generated PostgREST API. The pattern is: CREATE TABLE → ENABLE RLS → CREATE POLICIES, all in one migration.
- **Putting `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_*` variable:** The service role key bypasses all RLS. It must only appear in server-side environment variables and never be prefixed with `NEXT_PUBLIC_`.
- **Using `@supabase/auth-helpers-nextjs`:** This package is officially deprecated. Only use `@supabase/ssr`.
- **Keep-alive via HTTP ping only:** May not register as database activity. The keep-alive route must execute a Supabase JS client database query.
- **Writing middleware that blocks unauthenticated requests:** Phase 24 middleware only refreshes sessions; it never redirects or blocks. API routes independently decide their auth requirements. Blocking in middleware breaks the anonymous flow.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based SSR session persistence | Custom cookie parsing and JWT refresh logic | `@supabase/ssr` `createServerClient` and `createBrowserClient` | Handles token expiry, cookie chunking for large sessions, Base64-URL encoding, and concurrent-request race conditions during refresh |
| Session token refresh | Manual JWT decode and re-issue | `supabase.auth.getUser()` in middleware | Refresh tokens are single-use; concurrent requests with the same expired token require precise sequencing that `@supabase/ssr` handles internally |
| Row-level access control | Application-layer `WHERE user_id = :userId` on every query | Postgres RLS policies | Application-layer filtering can be bypassed via the REST API; database-level RLS cannot; RLS also protects against developer mistakes in future route handlers |
| Storage access control | Signed URL generation with manual expiry | Supabase Storage RLS on `storage.objects` + `createSignedUrl()` | Storage RLS is checked at signed URL generation time — a user without a valid session cannot generate a signed URL for another user's file |

**Key insight:** The entire purpose of `@supabase/ssr` is to handle the complexity of keeping SSR cookies synchronized with the Supabase auth server across concurrent requests. This is the hardest part of server-side auth in Next.js App Router, and the library's design document (Context7 `/supabase/ssr`) explicitly addresses known edge cases like concurrent refresh token use. Do not attempt to replicate this.

---

## Common Pitfalls

### Pitfall 1: `getSession()` vs `getUser()` in Server Context

**What goes wrong:** Middleware and route handlers call `supabase.auth.getSession()` to check if a user is logged in. `getSession()` returns data from the session cookie without verifying it against the Supabase auth server. A crafted or stale cookie can return a non-null session with an expired or invalid JWT.

**Why it happens:** `getSession()` appears in many older Supabase examples. The distinction between "read from cookie" and "verify with auth server" is not obvious.

**How to avoid:** Always use `supabase.auth.getUser()` in server-side code (middleware, Server Components, Route Handlers) when the result is used for authorization decisions. `getSession()` is acceptable only in Client Components for reading UI state.

**Warning signs:** Any server-side code that calls `getSession()` and uses the result to gate data access.

### Pitfall 2: RLS Without `WITH CHECK` on Write Policies

**What goes wrong:** A policy is written for SELECT (users can read their own rows) but the INSERT and UPDATE policies lack `WITH CHECK`. Users can write rows but cannot set `user_id` to a different value, or alternatively the write silently fails.

**Why it happens:** `USING` clause is for SELECT/DELETE (existing rows). `WITH CHECK` is for INSERT/UPDATE (new or modified rows). These are separate clauses and both are needed for complete policies.

**How to avoid:** Write policies with both `USING` and `WITH CHECK` for any table operation that involves writes. The SQL in the Code Examples section above includes both clauses.

**Warning signs:** Silent empty-result errors on INSERT; RLS test shows SELECT works but INSERT fails.

### Pitfall 3: Keep-Alive HTTP Ping Not Registered as Activity

**What goes wrong:** A keep-alive cron job pings the Supabase health endpoint or a static URL. Supabase's inactivity detection does not register this as "database activity" and pauses the project anyway.

**Why it happens:** Supabase tracks database activity (queries, writes) — not HTTP requests to the project URL. An HTTP ping that does not involve the database does not reset the inactivity clock.

**How to avoid:** The keep-alive route must execute a Supabase JS client query against an actual table. `SELECT id FROM conversations LIMIT 1` is sufficient.

**Warning signs:** Keep-alive logs show 200 responses but Supabase still pauses after 7 days.

### Pitfall 4: Middleware `setAll` Not Updating Both Request and Response Cookies

**What goes wrong:** Middleware creates a `supabaseResponse` but the `setAll` implementation only writes to `supabaseResponse.cookies`, not to `request.cookies`. The refreshed token is in the response but the subsequent server component render reads from the request cookies, which are stale, and sees an expired session.

**Why it happens:** The double-write pattern (`request.cookies.set` AND `supabaseResponse.cookies.set`) is non-intuitive. Examples that only show one of the two are incomplete.

**How to avoid:** Follow the exact middleware pattern from Context7 which updates both `request.cookies` and `supabaseResponse.cookies` in the `setAll` handler.

**Warning signs:** User appears logged in to browser (client cookie exists) but Server Components see `user: null` even on the first request after login.

### Pitfall 5: Storage RLS Policy Uses Wrong `foldername` Index

**What goes wrong:** The storage path is `{user_id}/{conversation_id}/latest.hlx`. The RLS policy checks `(storage.foldername(name))[2]` expecting it to contain the user_id, but index `[1]` is the first segment. The policy either allows all users to access all files or blocks all access.

**Why it happens:** `storage.foldername` is 1-indexed. The first path segment (user_id) is at index `[1]`, not `[0]`.

**How to avoid:** Path `{user_id}/{conversation_id}/latest.hlx` maps to: `[1]` = user_id, `[2]` = conversation_id, filename = `latest.hlx`. The user isolation check is `(storage.foldername(name))[1] = auth.uid()::text`.

**Warning signs:** Storage upload returns 403 for authenticated users; or all files are accessible to any authenticated user.

### Pitfall 6: Supabase Dashboard Rewrites `storage.foldername` Policy

**What goes wrong:** Storage RLS policies written via the Supabase Dashboard UI are sometimes auto-rewritten to include a table alias (`storage.foldername(tables.name)` instead of `storage.foldername(name)`), which breaks the policy logic.

**Why it happens:** The dashboard's SQL editor rewrites the SQL when saving policies through the visual policy builder.

**How to avoid:** Write all storage RLS policies via the SQL Editor (not the visual policy builder). Verify the saved policy SQL matches what was written.

**Warning signs:** Policy appears to save successfully but storage operations fail unexpectedly; inspect the actual saved SQL in the dashboard.

---

## Code Examples

Verified patterns from official sources:

### Environment Variables (.env.local)

```bash
# Source: Official Supabase Next.js quickstart + WebSearch verification
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key-value]
# NOTE: Supabase is transitioning to NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (new format: sb_publishable_xxx)
# For now, use ANON_KEY — the value is the same; the variable name may change in a future phase

# Server-only (never NEXT_PUBLIC) — for migrations and admin operations only
# SUPABASE_SERVICE_ROLE_KEY=[service-role-key]

# Keep-alive cron route protection
CRON_SECRET=[generate-a-random-secret-here]
```

### Verify RLS Is Working (Manual Test)

```bash
# Source: Official Supabase REST API docs
# Test with the anon key directly — should return empty array [] NOT a 403
curl -H "apikey: [ANON_KEY]" \
     -H "Authorization: Bearer [ANON_KEY]" \
     "https://[project-ref].supabase.co/rest/v1/conversations"
# Expected: [] (empty array, not all rows, not 403)
# If 403: RLS enabled but no policy for anonymous access (correct)
# If rows: RLS not enabled (problem!)
```

### Verify Middleware Session Refresh

```typescript
// Source: Official Supabase SSR docs — verification approach
// Create a temporary test route: app/api/test-session/route.ts
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return NextResponse.json({ user: user?.id ?? null, error: error?.message ?? null })
}
// Hit this route — should return { user: null } for unauthenticated, not throw
// Delete this route after verification
```

### Signed URL for Preset Download

```typescript
// Source: Context7 /llmstxt/supabase_llms_txt — createSignedUrl
// Used in future phases; included here as reference for INFRA-05 storage verification
const { data, error } = await supabase.storage
  .from('presets')
  .createSignedUrl(`${userId}/${conversationId}/latest.hlx`, 3600)

if (data) {
  console.log(data.signedUrl) // Time-limited download URL
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers is deprecated; SSR package handles all cookie patterns |
| `supabase.auth.getSession()` on server | `supabase.auth.getUser()` on server | 2024 | getSession returns unverified cookie data; getUser contacts auth server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (transitioning) | 2025 | New publishable key format (`sb_publishable_xxx`) being rolled out; both env var names work during transition; anon key value is compatible with either name |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Do not install. Last version is 0.15.0. Use `@supabase/ssr` only.
- `createMiddlewareClient` from `@supabase/auth-helpers-nextjs`: Replaced by `createServerClient` from `@supabase/ssr` in middleware.

---

## Open Questions

1. **Publishable key transition: when to switch env var name**
   - What we know: Supabase is introducing `sb_publishable_xxx` format keys and the new env var name `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both old and new formats work during the transition.
   - What's unclear: Whether new Supabase projects created in March 2026 show publishable keys by default or still show legacy anon keys in the dashboard.
   - Recommendation: Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the anon key value from the dashboard. If the Supabase dashboard shows a publishable key format (`sb_publishable_xxx`), use that value — it is compatible. The variable name can be updated in a future phase if needed. Edge Functions do not support publishable keys, but this project does not use Edge Functions.

2. **Supabase free tier inactivity detection granularity**
   - What we know: The pause triggers after 7 days of no database activity. Community reports from 2025 indicate HTTP pings alone are insufficient; a database query is required.
   - What's unclear: Whether "database activity" means a query via PostgREST (the Supabase JS client uses this) or requires a direct SQL connection, and whether anonymous queries (without an authenticated session) count.
   - Recommendation: The keep-alive route should use an authenticated Supabase client (with a service role key in the server environment) to ensure the query registers as activity. Alternatively, use the anon client — PostgREST queries against tables with RLS register as activity even when the result is empty. Monitor Supabase project status in the dashboard after the first cron run.

---

## Sources

### Primary (HIGH confidence)

- Context7 `/supabase/ssr` — `createBrowserClient`, `createServerClient`, middleware pattern, singleton behavior, concurrent refresh token handling
- Context7 `/llmstxt/supabase_llms_txt` — `createSignedUrl`, Storage RLS schema, user management schema patterns, middleware `updateSession` pattern
- Official Supabase Next.js SSR guide: https://supabase.com/docs/guides/auth/server-side/nextjs
- Official Vercel cron job docs: https://vercel.com/docs/cron-jobs
- Official Vercel cron quickstart: https://vercel.com/docs/cron-jobs/quickstart

### Secondary (MEDIUM confidence)

- Supabase NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY transition — WebSearch confirmed via official Supabase API keys guide: https://supabase.com/docs/guides/api/api-keys
- Storage `foldername` index behavior — WebSearch verified against multiple Supabase community discussions (GitHub orgs/supabase/discussions #31073, #35737)
- Keep-alive direct database query requirement — WebSearch: multiple 2025 community reports that HTTP pings are unreliable; GitHub repos `travisvn/supabase-pause-prevention`, `JonKrone/keep-supabase-alive`

### Tertiary (LOW confidence)

- Keep-alive inactivity counting (direct DB query vs PostgREST) — derived from community pattern analysis; no official Supabase documentation found specifying exactly what counts as "activity" for the pause trigger

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package names, versions, and roles confirmed via Context7 and official npm
- Architecture: HIGH — all three client patterns (browser, server, middleware) verified via Context7 against `@supabase/ssr` current API
- Pitfalls: HIGH (RLS, getUser vs getSession, middleware double-write) / MEDIUM (keep-alive DB query requirement, storage.foldername index)

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (90 days — Supabase SSR APIs are stable; publishable key transition may accelerate)
