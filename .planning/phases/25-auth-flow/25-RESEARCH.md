# Phase 25: Auth Flow - Research

**Researched:** 2026-03-03
**Domain:** Supabase anonymous sign-in, Google OAuth identity linking, PKCE callback handling, sessionStorage state serialization for anonymous-to-authenticated transition in Next.js App Router
**Confidence:** HIGH — all core API patterns verified against official Supabase Context7 docs and official guide documentation; anonymous-first auth flow verified against official Supabase anonymous auth docs; sessionStorage pattern is MEDIUM confidence (community-established, no single canonical source)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with Google via a "Sign in with Google" button — single OAuth provider, no email/password | `supabase.auth.linkIdentity({ provider: 'google' })` from client component; requires "Enable Manual Linking" in Supabase dashboard |
| AUTH-02 | User session persists across browser refreshes and tab closes — cookie-based token refresh handles expiry transparently | Phase 24 middleware handles this already via `updateSession()` on every request; `getUser()` in middleware verifies and refreshes JWT |
| AUTH-03 | Anonymous users can generate and download presets without logging in — the existing anonymous flow is fully functional with zero auth gates | No blocking logic in middleware; `/api/generate` and `/api/chat` never require auth; existing behavior unchanged when `conversationId` is absent |
| AUTH-04 | Anonymous-to-authenticated transition preserves in-progress chat state — OAuth redirect does not destroy the current conversation; state is serialized to sessionStorage before redirect and restored after callback | `sessionStorage.setItem()` before `linkIdentity()` call; restoration in `useEffect` on mount after callback redirect |
| AUTH-05 | User can sign out — session is cleared, UI returns to anonymous state, sidebar (when it exists) is hidden | `supabase.auth.signOut()` then `signInAnonymously()` to restore anonymous session immediately; `router.refresh()` to update server components |
</phase_requirements>

---

## Summary

Phase 25 implements the anonymous-first authentication flow on top of the Supabase infrastructure delivered by Phase 24. Every visitor gets an anonymous Supabase session on page load (`signInAnonymously()` called on mount if no session exists). Authenticated users sign in with Google via `linkIdentity({ provider: 'google' })`, which upgrades the anonymous session without changing the user UUID — all pre-login data is preserved automatically. The OAuth redirect is handled by a PKCE callback route at `src/app/auth/callback/route.ts` that exchanges the code for a session and redirects back to the app.

The highest-risk requirement in this phase is AUTH-04: preserving in-progress React state across the OAuth redirect. Because OAuth redirects destroy the browser's JavaScript context, any in-progress chat in `useState` is lost. The mitigation is to serialize the chat state to `sessionStorage` before triggering `linkIdentity()` and restore it from `sessionStorage` on mount after the callback redirect returns. This pattern is community-established but has no single canonical Next.js + Supabase reference — it requires careful implementation and testing against real OAuth redirect behavior including browser back button edge cases.

The anonymous flow (AUTH-03) must not regress. Phase 24 middleware already runs `updateSession()` on every request without blocking — anonymous requests pass through with a null session and negligible overhead. This phase adds no logic to the existing `/api/generate` or `/api/chat` routes; those routes continue to work without any auth context.

**Primary recommendation:** Use `signInAnonymously()` on mount, `linkIdentity({ provider: 'google' })` for the upgrade, `exchangeCodeForSession(code)` in the callback route, and `sessionStorage` for cross-redirect state preservation. The Supabase Auth dashboard must have "Enable Manual Linking" turned on before any code is tested.

---

## Standard Stack

### Core (Phase 24 delivers these — Phase 25 consumes them)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.80.0 | `signInAnonymously()`, `linkIdentity()`, `signOut()`, `getSession()`, `onAuthStateChange()` | Official Supabase JS client; the only supported path for anonymous auth with identity linking |
| `@supabase/ssr` | 0.8.0 | `createBrowserClient()` for client components; session cookie handling | Official SSR package; replaces deprecated `auth-helpers-nextjs` |
| `next/navigation` | (Next.js built-in) | `useRouter()` for `router.refresh()` after auth state changes | Forces server component re-render to reflect new auth state in layout |

### No New Dependencies

Phase 25 installs zero new npm packages. All auth operations use the Supabase client already installed in Phase 24. No NextAuth, no Clerk, no `passport`, no `jose`.

---

## Architecture Patterns

### Recommended File Structure (additions only)

```
src/
├── app/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts           # NEW — PKCE code exchange for Google OAuth
│   ├── layout.tsx                 # MODIFIED — render <AuthButton> in header
│   └── page.tsx                   # MODIFIED — signInAnonymously on mount, sessionStorage save/restore, pass user to AuthButton
│
└── components/
    └── auth/
        └── AuthButton.tsx         # NEW — "Sign in with Google" / avatar / sign out
```

### Pattern 1: Anonymous Session on Mount

**What:** On first page load, call `signInAnonymously()` if no session exists. Every visitor gets a real Supabase user ID with `is_anonymous: true`. The session is cookie-based — it persists across refreshes automatically via the Phase 24 middleware.

**When to use:** In `page.tsx` `useEffect` on mount. Check for existing session first to avoid creating duplicate anonymous users.

**Critical:** Only call `signInAnonymously()` if `getSession()` returns null. Calling it when a session already exists creates an orphaned anonymous user.

```typescript
// Source: /supabase/supabase-js + official anonymous auth docs
// In page.tsx — top-level Client Component
useEffect(() => {
  const initSession = async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) console.error('Anonymous sign-in failed:', error.message)
    }
    // Also subscribe to auth state changes to keep UI in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null)
      }
    )
    return () => subscription.unsubscribe()
  }
  initSession()
}, [])
```

### Pattern 2: Google OAuth via Identity Linking (not signInWithOAuth)

**What:** When an anonymous user clicks "Sign in with Google," call `linkIdentity({ provider: 'google' })` — NOT `signInWithOAuth()`. `linkIdentity()` upgrades the existing anonymous session rather than creating a new one. The user UUID does not change, so any data written while anonymous is now owned by the authenticated user.

**Critical dashboard prerequisite:** "Enable Manual Linking" MUST be turned on in Supabase Dashboard > Authentication > Configuration before `linkIdentity()` will work. Without it, the call fails silently with an error.

**When to use:** When the current user has `is_anonymous: true` and clicks the sign-in button. If the user somehow arrives with no session (edge case), fall back to `signInWithOAuth({ provider: 'google' })`.

```typescript
// Source: /llmstxt/supabase_llms_txt — Link OAuth Identity to Anonymous User
// In AuthButton.tsx (client component)
const handleSignIn = async () => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.is_anonymous) {
    // Serialize state before redirect (see Pattern 4)
    serializeChatStateToSessionStorage()
    // Link Google identity to existing anonymous session — UUID does not change
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) console.error('Identity link failed:', error.message)
    // Browser redirects to Google — no code runs after this line
  } else {
    // No session at all — use standard OAuth
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` }
    })
  }
}
```

### Pattern 3: PKCE Callback Route

**What:** Google OAuth uses PKCE flow. After Google authenticates, it redirects to `/auth/callback?code=...`. The callback route exchanges the code for a session via `exchangeCodeForSession(code)`.

**When to use:** This route handles the return from ALL OAuth providers. For identity linking (`linkIdentity()`), Supabase merges the Google identity onto the existing anonymous user's record during the code exchange — no special handling needed.

**Production note:** The `x-forwarded-host` header handling is required on Vercel because Vercel uses a load balancer. Without it, the redirect URL after login is incorrectly constructed and users end up at the wrong URL.

```typescript
// Source: /llmstxt/supabase_llms_txt — Next.js OAuth Callback Handler for Supabase
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // Code missing or exchange failed — redirect to error state
  return NextResponse.redirect(`${origin}/?auth_error=true`)
}
```

### Pattern 4: sessionStorage State Serialization for Cross-Redirect Preservation (AUTH-04)

**What:** Before calling `linkIdentity()` (which triggers an OAuth redirect and destroys React state), serialize the current chat state to `sessionStorage`. After the callback redirect returns the user to the app, restore state from `sessionStorage` on mount.

**Confidence: MEDIUM** — This is an established community pattern but has no single canonical Next.js + Supabase reference. The key risk is that `sessionStorage` is tab-scoped — if the OAuth redirect opens a new tab (which it doesn't by default), state is lost. Test specifically against browser back button behavior.

**What to serialize:** The minimum viable set is `messages[]` and `device`. Do NOT serialize `rigIntent`, `subst`, or `vizBlocks` — these are derived data that can be reconstructed if needed and add complexity to the restore path.

```typescript
// Before linkIdentity() redirect — in the sign-in handler
const serializeChatState = () => {
  const stateToPreserve = {
    messages,        // Message[] — full chat history
    device,          // DeviceTarget — helix_lt | helix_floor | pod_go
  }
  sessionStorage.setItem('helixai_pre_oauth_state', JSON.stringify(stateToPreserve))
}

// On mount after redirect — in page.tsx useEffect
useEffect(() => {
  const preserved = sessionStorage.getItem('helixai_pre_oauth_state')
  if (preserved) {
    try {
      const state = JSON.parse(preserved)
      if (state.messages?.length > 0) {
        setMessages(state.messages)
        if (state.device) setDevice(state.device)
      }
    } catch {
      // Corrupt state — ignore, start fresh
    }
    // Always clear after restore attempt
    sessionStorage.removeItem('helixai_pre_oauth_state')
  }
}, [])
```

**Edge case:** If the user navigates away during OAuth (does not complete Google login), the preserved state remains in `sessionStorage`. Add a timestamp to the serialized state and discard it if it is more than 10 minutes old.

### Pattern 5: Sign Out and Anonymous Reset (AUTH-05)

**What:** On sign-out, call `supabase.auth.signOut()` to clear the session cookie, then immediately call `signInAnonymously()` to restore an anonymous session. Without the immediate re-sign-in, the app sits in a "no session" state that is not the same as the anonymous state and can cause errors in components that expect a user ID.

**Important:** After sign-out, call `router.refresh()` to force server components (including the sidebar that will be added in Phase 28) to re-render with the new session state.

```typescript
// In AuthButton.tsx — sign out handler
const handleSignOut = async () => {
  const supabase = createSupabaseBrowserClient()
  await supabase.auth.signOut()
  // Immediately restore anonymous session so app has a user ID
  await supabase.auth.signInAnonymously()
  // Force server components to re-render with new auth state
  router.refresh()
}
```

### Pattern 6: AuthButton Component — Hydration-Safe Rendering

**What:** The `AuthButton` must not cause hydration errors. The server renders the layout without knowing the user's session state; the client discovers the session from cookies. If the button renders differently on server vs client (e.g., showing "Sign in" on server, avatar on client), React throws a hydration error.

**Solution:** Render the button client-side only, using a `mounted` flag that is `false` on first render and `true` after `useEffect` fires. Show a neutral placeholder (same dimensions) until mounted.

```typescript
// In AuthButton.tsx
'use client'
import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      router.refresh() // Update server components on auth change
    })
    return () => subscription.unsubscribe()
  }, [router])

  // Render placeholder until mounted to avoid hydration mismatch
  if (!mounted) return <div className="w-8 h-8" aria-hidden />

  const isAnonymous = user?.is_anonymous ?? true
  if (isAnonymous) {
    return <button onClick={handleSignIn}>Sign in with Google</button>
  }
  return (
    <div>
      {/* Avatar from user.user_metadata.avatar_url */}
      <button onClick={handleSignOut}>Sign out</button>
    </div>
  )
}
```

### Anti-Patterns to Avoid

- **Using `signInWithOAuth()` instead of `linkIdentity()` for sign-in:** `signInWithOAuth()` creates a NEW user record with a different UUID, destroying the link between pre-login anonymous data and the authenticated user. AUTH-04 cannot be satisfied with this approach.
- **Calling `signInAnonymously()` unconditionally on mount:** Creates a new orphaned anonymous user on every page load, even when a valid session exists. Always check for an existing session first.
- **Relying on middleware to block anonymous users from any route:** Phase 25 must not add any blocking logic to middleware. The middleware's only job is session refresh. Anonymous users must pass through all routes freely.
- **Using `getSession()` for authorization checks:** `getSession()` reads the unverified cookie; `getUser()` contacts the Supabase auth server to verify and refresh the JWT. Use `getUser()` for any security decision.
- **Setting PKCE callback URL without registering it in Supabase dashboard:** The OAuth redirect URL must be registered in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs, not in Google Cloud Console directly. Supabase manages the Google OAuth application and its allowed redirect URIs.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT token refresh | Custom refresh timer | Phase 24 middleware `updateSession()` | Already in place; handles all edge cases including clock skew |
| Session storage | Custom cookie management | `@supabase/ssr` `createBrowserClient()` | Handles cookie chunking for large JWTs, Base64-URL encoding, singleton pattern |
| PKCE code verifier | Manual code_verifier generation | Supabase client handles PKCE automatically | PKCE is built into `linkIdentity()` and `exchangeCodeForSession()`; the client generates and stores the verifier |
| OAuth state parameter | Custom state/nonce generation | Supabase client handles automatically | Part of PKCE flow managed by supabase-js |
| User metadata (avatar, name) | Manual profile fetch | `user.user_metadata.avatar_url`, `user.user_metadata.full_name` | Google profile data flows into `user_metadata` after linking |

**Key insight:** The entire PKCE OAuth flow — code verifier, state parameter, code exchange — is managed by the Supabase client library. The only application code needed is `linkIdentity()` on the client and `exchangeCodeForSession()` in the callback route.

---

## Common Pitfalls

### Pitfall 1: "Enable Manual Linking" Not Set — `linkIdentity()` Fails Silently

**What goes wrong:** `linkIdentity()` is called, a redirect happens, but the identity is not linked — the user still has `is_anonymous: true` after returning from Google. No visible error in the UI.

**Why it happens:** Supabase requires "Enable Manual Linking" to be explicitly enabled in the Auth settings dashboard. It is off by default. Without it, the identity link fails at the Supabase server side during code exchange, but the user is still redirected back to the app.

**How to avoid:** Enable manual linking in Supabase Dashboard > Authentication > Configuration BEFORE writing any auth code. Verify by checking `user.is_anonymous` in the Supabase Auth dashboard after a test sign-in.

**Warning signs:** User returns from Google OAuth, `is_anonymous` is still `true` in the dashboard. No error logged to console from `linkIdentity()` itself.

### Pitfall 2: User Metadata Not Populated Immediately After Linking

**What goes wrong:** After OAuth redirect returns, `user.user_metadata.avatar_url` and `user.user_metadata.full_name` are null or empty even though the user successfully signed in with Google.

**Why it happens:** Known Supabase behavior — user metadata (avatar_url, email, full_name from Google) may not populate immediately after `linkIdentity()`. It populates on the next sign-in or session refresh.

**How to avoid:** In `AuthButton`, fall back gracefully: use initials from `user.email` as the avatar when `user_metadata.avatar_url` is null. Do not block the UI waiting for metadata. The data will appear on the next page load once the session refreshes.

**Warning signs:** Avatar shows placeholder on first sign-in, then correct Google photo on next page load.

### Pitfall 3: sessionStorage State Restoration Runs Before Supabase Session Is Confirmed

**What goes wrong:** The `useEffect` for sessionStorage restoration fires and populates messages state, but the `signInAnonymously` effect fires at the same time and wipes the user state. Race condition leaves the UI in an inconsistent state.

**Why it happens:** Multiple `useEffect` calls without explicit ordering. The `initSession` effect and the `restoreState` effect both fire on mount and can interleave.

**How to avoid:** Combine the session initialization and state restoration into a single `useEffect`. First verify/create the session, then check for preserved state.

```typescript
useEffect(() => {
  const init = async () => {
    const supabase = createSupabaseBrowserClient()
    // 1. Ensure session exists
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await supabase.auth.signInAnonymously()
    }
    // 2. AFTER session is confirmed, restore any preserved state
    const preserved = sessionStorage.getItem('helixai_pre_oauth_state')
    if (preserved) {
      try {
        const state = JSON.parse(preserved)
        if (state.messages?.length > 0) setMessages(state.messages)
        if (state.device) setDevice(state.device)
      } catch { /* ignore corrupt state */ }
      sessionStorage.removeItem('helixai_pre_oauth_state')
    }
  }
  init()
}, [])
```

### Pitfall 4: Hydration Mismatch from Auth-Dependent UI

**What goes wrong:** `layout.tsx` renders `<AuthButton>` as a server component. Server renders "Sign in" state; client discovers a valid session cookie; React hydration fails because the DOM doesn't match.

**Why it happens:** Auth state is only knowable from cookies on the client side (the session cookie is `HttpOnly` and available server-side, but the server rendering of layout doesn't block on session fetch without explicit async loading).

**How to avoid:** `AuthButton` is a Client Component with the `mounted` flag pattern (Pattern 6 above). It renders a neutral placeholder on the first render and updates after `useEffect` fires with the actual session state. The placeholder must be the same dimensions as the eventual button to prevent layout shift.

### Pitfall 5: OAuth Callback URL Mismatch Breaks Production

**What goes wrong:** OAuth works on localhost but `redirect_uri_mismatch` error appears in production Vercel deployment.

**Why it happens:** The production Vercel URL is not registered in Supabase Dashboard > Authentication > URL Configuration > Redirect URLs. Supabase (not Google Cloud Console directly) validates callback URLs for OAuth flows it manages.

**How to avoid:** Before deploying, add both `http://localhost:3000/auth/callback` and the production Vercel URL (e.g., `https://helixai.vercel.app/auth/callback`) to Supabase's Redirect URLs list. If the Vercel preview URL varies per deployment, add a wildcard: `https://*.vercel.app/auth/callback`.

### Pitfall 6: Sign-Out Leaves App in "No Session" State

**What goes wrong:** After sign-out, components that call `supabase.auth.getUser()` receive null. Code that assumed a user always exists (after the anonymous sign-in on mount) throws errors.

**Why it happens:** `signOut()` clears the session cookie. If no `signInAnonymously()` is called immediately after, the app sits in a state with no user — which is different from the anonymous state the app was designed around.

**How to avoid:** Always call `signInAnonymously()` immediately after `signOut()` in the sign-out handler (Pattern 5). This restores the anonymous state synchronously, giving the app a valid user ID within the same event handler.

---

## Code Examples

### Complete init flow in page.tsx

```typescript
// Source: Official Supabase anonymous auth docs + Context7 /supabase/supabase-js
// Condensed — place inside page.tsx top-level Client Component
useEffect(() => {
  const supabase = createSupabaseBrowserClient()
  let unsubscribe: (() => void) | undefined

  const init = async () => {
    // 1. Get or create session
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await supabase.auth.signInAnonymously()
    }

    // 2. Restore pre-OAuth chat state (if redirected back from Google)
    const preserved = sessionStorage.getItem('helixai_pre_oauth_state')
    if (preserved) {
      try {
        const { messages: m, device: d, timestamp } = JSON.parse(preserved)
        // Discard stale state (>10 min)
        if (Date.now() - timestamp < 10 * 60 * 1000) {
          if (m?.length > 0) setMessages(m)
          if (d) setDevice(d)
        }
      } catch { /* ignore */ }
      sessionStorage.removeItem('helixai_pre_oauth_state')
    }

    // 3. Subscribe to auth changes to keep UI in sync
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
    })
    unsubscribe = () => subscription.unsubscribe()
  }

  init()
  return () => unsubscribe?.()
}, [])
```

### Complete callback route

```typescript
// Source: /llmstxt/supabase_llms_txt — Next.js OAuth Callback Handler for Supabase
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocal = process.env.NODE_ENV === 'development'
      if (isLocal) return NextResponse.redirect(`${origin}/`)
      if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}/`)
      return NextResponse.redirect(`${origin}/`)
    }
  }
  return NextResponse.redirect(`${origin}/?auth_error=true`)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023-2024 | `auth-helpers-nextjs` is deprecated; `@supabase/ssr` is the only supported path for App Router |
| `signInWithOAuth()` for all sign-in | `linkIdentity()` for anonymous upgrade | Supabase v2.x | `linkIdentity()` preserves the anonymous user UUID; `signInWithOAuth()` creates a new user |
| Manual JWT refresh timers | Middleware `updateSession()` | `@supabase/ssr` launch | Automatic JWT refresh on every non-static request; no manual timer needed |
| Auth.js `@auth/supabase-adapter` | Native Supabase Auth | Ongoing | The adapter doesn't support `signInAnonymously()` or `linkIdentity()` — unusable for this pattern |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Officially deprecated; use `@supabase/ssr` instead
- `supabase.auth.session()`: Removed in supabase-js v2; use `getSession()` or `getUser()`

---

## Open Questions

1. **User metadata population timing after `linkIdentity()`**
   - What we know: Known Supabase behavior — avatar_url, full_name may be null on the first session after linking and populate on the next session refresh.
   - What's unclear: Does calling `supabase.auth.getUser()` immediately after the callback complete return populated metadata, or is a second request to Supabase needed?
   - Recommendation: Build `AuthButton` to degrade gracefully (show initials from email) and display the Google avatar only if `user_metadata.avatar_url` is non-null. Do not block the UI on metadata availability.

2. **sessionStorage behavior across OAuth redirect on mobile browsers**
   - What we know: `sessionStorage` is tab-scoped and survives same-tab redirects on desktop browsers. OAuth redirect via `linkIdentity()` is a same-tab redirect.
   - What's unclear: Some mobile browsers (Safari on iOS) may clear sessionStorage on cross-origin redirect depending on privacy settings.
   - Recommendation: Test specifically on iOS Safari. If sessionStorage is unreliable, fall back to a URL parameter (`?restore=1`) that signals the callback route to include the auth token but not state — state loss on mobile would be an acceptable degradation versus a broken desktop flow.

3. **`auth_error` handling in page.tsx**
   - What we know: The callback route redirects to `/?auth_error=true` when code exchange fails.
   - What's unclear: Should the app show a toast/banner for this error state, or silently ignore it? The requirements do not specify.
   - Recommendation: Show a brief, dismissable error toast ("Sign in failed — please try again") when `auth_error=true` is present in URL params. Clear the param from the URL after showing.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set to true in `.planning/config.json` — this section is skipped.

---

## Phase 24 Dependency Check

Phase 25 builds on Phase 24's artifacts. Before starting Phase 25 implementation:

| Phase 24 Artifact | Required By Phase 25 | Status |
|-------------------|---------------------|--------|
| `src/lib/supabase/client.ts` (exports `createSupabaseBrowserClient`) | `AuthButton.tsx`, `page.tsx` sign-in/out handlers | Must exist |
| `src/lib/supabase/server.ts` (exports `createSupabaseServerClient`) | `src/app/auth/callback/route.ts` | Must exist |
| `middleware.ts` at project root (calls `updateSession`) | Session refresh on every request (AUTH-02) | Must exist |
| `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars | All Supabase client calls | Must be configured |
| Supabase project Google Auth provider configured | Google OAuth redirect works | Must be configured |

**If Phase 24 is not yet executed:** Phase 25 cannot be implemented. The planner must note this dependency in the plan and the plan executor must verify Phase 24 artifacts exist before starting Phase 25 tasks.

---

## Pre-Implementation Dashboard Checklist

These must be completed by the user in Supabase Dashboard BEFORE any Phase 25 code is tested:

1. **Enable Manual Linking:** Supabase Dashboard > Authentication > Configuration > scroll to "Manual Linking" > toggle ON. Without this, `linkIdentity()` fails.
2. **Google OAuth provider:** Supabase Dashboard > Authentication > Providers > Google > enable and configure Client ID + Client Secret from Google Cloud Console. (Phase 24 may have done this — verify.)
3. **Redirect URLs:** Supabase Dashboard > Authentication > URL Configuration > Redirect URLs > add `http://localhost:3000/auth/callback` and production URL.
4. **Site URL:** Set to `http://localhost:3000` for development.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/supabase-js` — `signInAnonymously`, `linkIdentity`, `onAuthStateChange`, `getSession`, `getUser`, `signOut` APIs verified
- Context7 `/supabase/ssr` — `createBrowserClient`, `createServerClient` patterns verified; middleware pattern confirmed
- Context7 `/llmstxt/supabase_llms_txt` — anonymous sign-in API docs, identity linking guide, PKCE callback route pattern, `exchangeCodeForSession` usage verified
- Official Supabase Anonymous Sign-Ins: https://supabase.com/docs/guides/auth/auth-anonymous
- Official Supabase Identity Linking: https://supabase.com/docs/guides/auth/auth-identity-linking
- Official Supabase Auth with Next.js App Router: https://supabase.com/docs/guides/auth/server-side/nextjs

### Secondary (MEDIUM confidence)
- `.planning/research/SUMMARY.md` — v2.0 pre-research with verified architecture decisions (anonymous-first model, `linkIdentity()` over `signInWithOAuth()`, sessionStorage pattern, user metadata timing behavior)
- `.planning/research/ARCHITECTURE.md` — component responsibilities, data flow, anti-patterns verified against official docs

### Tertiary (LOW confidence)
- sessionStorage cross-redirect preservation pattern — community-established, no single canonical source; mobile browser behavior is unverified

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via Context7 and official docs; no new packages needed
- Architecture: HIGH — all patterns verified against official Supabase anonymous auth and identity linking docs
- Auth-04 (sessionStorage preservation): MEDIUM — established community pattern, no canonical source; mobile browser behavior unverified
- Pitfalls: HIGH (manual linking requirement, callback URL, hydration mismatch verified against official sources); MEDIUM (user metadata timing, sessionStorage mobile behavior)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable Supabase APIs; @supabase/ssr 0.8.x API is unlikely to change)
