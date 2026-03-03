---
phase: 25-auth-flow
plan: "02"
subsystem: auth-ui
tags: [auth, google-oauth, anonymous-session, hydration, sessionStorage]
dependency_graph:
  requires: [25-01]
  provides: [AUTH-01, AUTH-04, AUTH-05]
  affects: [src/app/layout.tsx, src/app/page.tsx]
tech_stack:
  added: []
  patterns:
    - event-based decoupling (custom window events vs React Context)
    - mounted-flag hydration guard
    - linkIdentity() for anonymous-to-authenticated UUID preservation
key_files:
  created:
    - src/components/auth/AuthButton.tsx
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx
decisions:
  - "Event dispatch pattern ('helixai:before-signin') used instead of prop/context — AuthButton lives in Server Component layout.tsx, serializeChatState lives in Client Component page.tsx"
  - "mounted flag guards against hydration mismatch — neutral 32x32 placeholder until client mount"
  - "linkIdentity() used for anonymous users (not signInWithOAuth) to preserve UUID"
  - "Sign-out always calls signInAnonymously() after signOut() — app always has a user ID"
  - "Avatar falls back to email initial in a styled circle when avatar_url is null"
metrics:
  duration: "1m 31s"
  completed: "2026-03-03T22:32:10Z"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 3
---

# Phase 25 Plan 02: AuthButton Component and Layout Integration Summary

**One-liner:** Google OAuth sign-in button using linkIdentity() to preserve anonymous UUID, with event-based chat state serialization and hydration-safe mounting pattern.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Create AuthButton component | beea819 | Done |
| 2 | Integrate into layout.tsx + wire page.tsx event | d35d073 | Done |
| 3 | Human verification checkpoint | — | Awaiting user |

## What Was Built

### AuthButton.tsx (`src/components/auth/AuthButton.tsx`)

Client Component implementing the full sign-in/sign-out auth UI:

- **Hydration guard:** `mounted` state starts `false`; renders a `w-8 h-8` neutral placeholder until `useEffect` fires on client, preventing SSR/client HTML mismatch.
- **Anonymous users:** Shows "Sign in" button. On click, dispatches `helixai:before-signin` event first (triggers chat state serialization in page.tsx), then calls `supabase.auth.linkIdentity({ provider: 'google' })`. Falls back to `signInWithOAuth` if no anonymous session exists.
- **Authenticated users:** Shows Google avatar (or email initial fallback in a styled circle) + "Sign out" button side-by-side.
- **Sign-out:** Calls `signOut()` then immediately `signInAnonymously()` to restore a user session, then `router.refresh()` to sync server components.
- **Auth state sync:** `onAuthStateChange` subscriber keeps local user state in sync and calls `router.refresh()` on any auth event.

### layout.tsx changes

Added import of `AuthButton` and a fixed header:

```tsx
<header className="fixed top-0 right-0 z-50 p-3">
  <AuthButton />
</header>
```

No other changes to fonts, metadata, grain overlay, or ambient overlay.

### page.tsx changes

Added one `useEffect` after `serializeChatState` definition:

```typescript
useEffect(() => {
  const handler = () => serializeChatState()
  window.addEventListener('helixai:before-signin', handler)
  return () => window.removeEventListener('helixai:before-signin', handler)
}, [serializeChatState])
```

This event-based pattern avoids React Context or prop drilling — `AuthButton` (mounted in `layout.tsx`, a Server Component) cannot receive props from `page.tsx` state. Instead, `AuthButton` dispatches a window event and `page.tsx` owns the serialization logic.

## Deviations from Plan

None — plan executed exactly as written.

The plan's Task 1 specified an `onBeforeSignIn` prop, then Task 2 immediately removed it in favor of the event pattern. This was anticipated by the plan itself; executed in the same commit sequence.

## Verification Results

- `npx tsc --noEmit` passes with zero errors
- `AuthButton.tsx` exists with `'use client'` directive
- `linkIdentity()` used for anonymous users (not `signInWithOAuth`)
- `signOut()` + `signInAnonymously()` pattern in sign-out handler
- `'helixai:before-signin'` event dispatched in `AuthButton`, listened in `page.tsx`
- No new npm packages installed
- No modifications to any API routes

## Self-Check: PASSED

- FOUND: src/components/auth/AuthButton.tsx
- FOUND: src/app/layout.tsx
- FOUND: src/app/page.tsx
- FOUND commit: beea819 (feat(25-02): add AuthButton component)
- FOUND commit: d35d073 (feat(25-02): integrate AuthButton into layout)
