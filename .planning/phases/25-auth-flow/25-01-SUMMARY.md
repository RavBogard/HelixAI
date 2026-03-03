---
phase: 25-auth-flow
plan: 01
subsystem: auth
tags: [supabase, oauth, google, pkce, anonymous-auth, session-storage, next-app-router]

# Dependency graph
requires:
  - phase: 24-supabase-foundation
    provides: "createSupabaseBrowserClient and createSupabaseServerClient factory functions, @supabase/ssr installed"
provides:
  - "PKCE OAuth callback route at /auth/callback — exchanges authorization code for Supabase session"
  - "Anonymous session initialization on page mount via signInAnonymously()"
  - "sessionStorage-based chat state preservation/restoration across OAuth redirects"
  - "auth_error URL param handling for failed OAuth callbacks"
affects: [25-02, 26-conversation-crud-api, 27-persistence-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PKCE code exchange via supabase.auth.exchangeCodeForSession(code) in App Router route handler"
    - "x-forwarded-host header pattern for Vercel production URL construction"
    - "Single combined useEffect for session init + state restoration — prevents race conditions"
    - "sessionStorage serialization with timestamp-based staleness check (10-minute TTL)"
    - "Conditional signInAnonymously() — only called when getSession() returns null"

key-files:
  created:
    - src/app/auth/callback/route.ts
  modified:
    - src/app/page.tsx

key-decisions:
  - "x-forwarded-host checked for production URL construction — handles Vercel load balancer correctly without hardcoding domain"
  - "Single useEffect for session init + state restoration — sequential ordering prevents race condition between getUser() and setMessages()"
  - "serializeChatState() defined in page.tsx with useCallback — wired by Plan 02 AuthButton; not called in JSX yet"
  - "user state uses minimal inline type — avoids pulling in full Supabase User type tree"

patterns-established:
  - "OAuth callback route: exchange code -> check x-forwarded-host -> redirect or error"
  - "Anonymous-first: getSession() check before signInAnonymously() prevents duplicate sessions"
  - "sessionStorage key: helixai_pre_oauth_state — consistent across preserve/restore/cleanup"

requirements-completed: [AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 25 Plan 01: Auth Flow — Callback Route + Anonymous Session Init Summary

**PKCE OAuth callback route for Google sign-in, anonymous session init on page load, and sessionStorage chat-state preservation/restoration across OAuth redirects**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T22:26:05Z
- **Completed:** 2026-03-03T22:28:31Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Created `src/app/auth/callback/route.ts` with PKCE code exchange, x-forwarded-host Vercel handling, and error redirect
- Added anonymous session init to page.tsx — signInAnonymously() called only when no existing session
- Implemented sessionStorage preservation/restoration with 10-minute staleness check using key `helixai_pre_oauth_state`
- Added auth_error URL param handler that shows error state and cleans the URL
- Zero changes to existing UI, API calls, anonymous generate/download flow

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PKCE OAuth callback route** - `0a836a9` (feat)
2. **Task 2: Add anonymous session init and sessionStorage state preservation** - `202323f` (feat)

**Plan metadata:** (docs commit — see final commit below)

## Files Created/Modified
- `src/app/auth/callback/route.ts` - GET handler for PKCE code exchange; redirects to app root on success or /?auth_error=true on failure
- `src/app/page.tsx` - Added createSupabaseBrowserClient import, user state, combined session init useEffect, serializeChatState useCallback, auth_error useEffect

## Decisions Made
- x-forwarded-host checked for production base URL to handle Vercel load balancer correctly
- Combined single useEffect for session init + state restoration prevents race condition (documented in 25-RESEARCH.md as Pitfall 3)
- user state uses minimal inline type instead of importing full Supabase User type
- serializeChatState() is defined but not yet wired to JSX — Plan 02 AuthButton will call it

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

The plan's `user_setup` field documents required Supabase Dashboard configuration that must be done before OAuth works:

1. **Enable Manual Linking** — Supabase Dashboard > Authentication > Configuration > Manual Linking > toggle ON
2. **Enable Google OAuth provider** — Supabase Dashboard > Authentication > Providers > Google (requires Client ID + Secret from Google Cloud Console)
3. **Add redirect URLs** — `http://localhost:3000/auth/callback` AND production Vercel URL
4. **Set Site URL** — `http://localhost:3000` for development

These are external service configurations not automated by code.

## Next Phase Readiness
- Callback route is live and ready to receive Google OAuth redirects
- Anonymous session init runs on page mount — every visitor gets a Supabase user_id
- serializeChatState() ready for Plan 02 AuthButton to call before triggering linkIdentity()
- Plan 02 (AuthButton component) can proceed immediately

## Self-Check: PASSED

- `src/app/auth/callback/route.ts` — FOUND
- `src/app/page.tsx` — FOUND
- `.planning/phases/25-auth-flow/25-01-SUMMARY.md` — FOUND
- Commit `0a836a9` — FOUND
- Commit `202323f` — FOUND

---
*Phase: 25-auth-flow*
*Completed: 2026-03-03*
