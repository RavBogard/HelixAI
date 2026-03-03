---
phase: 24-supabase-foundation
plan: 01
subsystem: infra
tags: [supabase, ssr, nextjs, middleware, cookies, auth, typescript]

# Dependency graph
requires: []
provides:
  - createSupabaseBrowserClient() factory for Client Components (src/lib/supabase/client.ts)
  - createSupabaseServerClient() async factory for Server Components and Route Handlers (src/lib/supabase/server.ts)
  - updateSession() middleware helper with double-write cookie pattern (src/lib/supabase/middleware.ts)
  - Root middleware.ts that refreshes Supabase sessions on all non-static routes
affects:
  - 25-auth-flow
  - 26-conversation-crud-api
  - 27-persistence-wiring
  - 28-chat-sidebar-ui

# Tech tracking
tech-stack:
  added:
    - "@supabase/supabase-js@2.98.0"
    - "@supabase/ssr@0.9.0"
  patterns:
    - Browser client uses createBrowserClient from @supabase/ssr (reads document.cookie automatically)
    - Server client uses createServerClient with async cookies() from next/headers; try/catch on setAll for Server Component read-only constraint
    - Middleware double-write pattern: setAll updates both request.cookies AND supabaseResponse.cookies for correct token propagation
    - getUser() (not getSession()) in middleware — contacts auth server to verify and refresh JWT

key-files:
  created:
    - src/lib/supabase/client.ts
    - src/lib/supabase/server.ts
    - src/lib/supabase/middleware.ts
    - middleware.ts
  modified:
    - package.json
    - package-lock.json

key-decisions:
  - "@supabase/ssr (not deprecated auth-helpers-nextjs) for cookie-based session handling in App Router"
  - "middleware.ts at project root; matcher excludes static assets only — API routes pass through for session refresh without blocking"
  - "No redirect or blocking logic in middleware — each API route independently decides auth requirements"

patterns-established:
  - "Supabase browser client: import createSupabaseBrowserClient from @/lib/supabase/client in Client Components"
  - "Supabase server client: const supabase = await createSupabaseServerClient() in Server Components and Route Handlers"
  - "Double-write setAll in middleware: update request.cookies then recreate NextResponse then update supabaseResponse.cookies"

requirements-completed: [INFRA-01, INFRA-03, INFRA-04]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 24 Plan 01: Supabase Foundation Summary

**@supabase/ssr isomorphic client utilities (browser + server factories) and JWT-refreshing root middleware using double-write cookie pattern**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T19:22:05Z
- **Completed:** 2026-03-03T19:30:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Installed @supabase/supabase-js and @supabase/ssr as the only two new dependencies
- Created browser client factory (createSupabaseBrowserClient) using createBrowserClient from @supabase/ssr
- Created async server client factory (createSupabaseServerClient) with try/catch setAll for Server Component read-only constraint
- Created updateSession middleware helper with the critical double-write cookie pattern
- Created root middleware.ts that delegates to updateSession on all non-static routes with zero blocking logic
- TypeScript compiles cleanly with zero errors across all new files

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Supabase packages and create browser + server client utilities** - `47579f9` (feat)
2. **Task 2: Create middleware updateSession helper and root middleware.ts** - `acb5db9` (feat)

## Files Created/Modified
- `src/lib/supabase/client.ts` - Browser client factory (createSupabaseBrowserClient) for Client Components
- `src/lib/supabase/server.ts` - Async server client factory (createSupabaseServerClient) for Server Components and Route Handlers
- `src/lib/supabase/middleware.ts` - updateSession() with double-write cookie pattern and getUser() for JWT verification
- `middleware.ts` - Project root middleware delegating to updateSession on all non-static routes
- `package.json` - Added @supabase/supabase-js and @supabase/ssr dependencies
- `package-lock.json` - Updated lock file

## Decisions Made
- Used @supabase/ssr (not deprecated @supabase/auth-helpers-nextjs) for all client factories
- Middleware matcher includes all routes except static files (including /api/*) — middleware only refreshes tokens, never blocks
- try/catch on setAll in server client — Server Components cannot write cookies; Route Handlers can; same utility works for both

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

External services require manual configuration before Phase 25 auth flows can function:

1. Create a Supabase project at https://supabase.com/dashboard (free tier, no credit card)
2. Add environment variables to .env.local and Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Dashboard -> Project Settings -> API -> Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Dashboard -> Project Settings -> API -> Project API keys -> anon/public
3. Run database schema migration (Phase 24 Plan 02 covers schema with RLS)

## Next Phase Readiness
- All three Supabase client utilities are ready for use in Phase 25 (Auth Flow) and Phase 26+ (API routes)
- Middleware is active and will refresh sessions on every non-static request once env vars are configured
- Phase 25 can implement signInAnonymously() and Google OAuth using createSupabaseBrowserClient()
- Phase 26 Route Handlers can use createSupabaseServerClient() for auth-gated database operations

## Self-Check: PASSED

- FOUND: src/lib/supabase/client.ts
- FOUND: src/lib/supabase/server.ts
- FOUND: src/lib/supabase/middleware.ts
- FOUND: middleware.ts
- FOUND: .planning/phases/24-supabase-foundation/24-01-SUMMARY.md
- FOUND commit: 47579f9 (Task 1)
- FOUND commit: acb5db9 (Task 2)
- TypeScript: npx tsc --noEmit passes with zero errors

---
*Phase: 24-supabase-foundation*
*Completed: 2026-03-03*
