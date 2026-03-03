# Phase 28: Chat Sidebar UI + UX Polish - Research

**Researched:** 2026-03-03
**Domain:** React sidebar layout, Next.js App Router layout-level component mounting, optimistic UI with Supabase, URL search params for single-page conversation routing, continuation suggestion chips
**Confidence:** HIGH — all findings based on direct inspection of the codebase (layout.tsx, page.tsx, globals.css, all prior phase plans); no new external libraries required; patterns verified against ARCHITECTURE.md decisions

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIDE-01 | Pull-out sidebar panel on the left side showing past conversations — collapsible on mobile, mounted in layout.tsx so it persists without re-mounting | Architecture decision in STATE.md: "Sidebar mounted in layout.tsx not page.tsx — persists across navigations, avoids re-fetch on every render"; ChatSidebar.tsx is a client component with CSS transform toggle; ChatHistoryList.tsx is a server component that fetches from Supabase |
| SIDE-02 | Sidebar shows conversation title, device type, and relative timestamp for each chat — sorted by most recent activity | GET /api/conversations returns `{ id, title, device, updated_at }` per Phase 26-01; device badge rendered using same LT/FLOOR/POD GO label pattern from page.tsx |
| SIDE-03 | "New Chat" button in sidebar header clears the current session and starts a fresh conversation | Dispatches a custom DOM event (`helixai:new-chat`) — page.tsx listens and calls startOver() + clears conversationId; same event-bridge pattern used for pre-signin in Phase 25 |
| SIDE-04 | Clicking a conversation resumes it — full message history loaded, device selector restored, "Download Preset" available if preset was previously generated | Uses `loadConversation(convId)` defined in Phase 27 Plan 02; sidebar navigation via URL search param (`?conversation=<id>`) that page.tsx reads on mount and on popstate |
| SIDE-05 | Sidebar visible only when authenticated — anonymous users see standard full-width chat interface with no sidebar | Session check in layout.tsx via `createSupabaseServerClient()`; `user?.is_anonymous === true` → sidebar shell not rendered at all; layout stays full-width |
| SIDE-06 | Sidebar interactions (create, delete) use optimistic UI updates — sidebar responds instantly, rolls back on server error | Client-side state array of conversations in ChatSidebar; delete: remove immediately from array, call DELETE /api/conversations/[id], rollback on error; new-chat: no optimistic needed (sidebar doesn't change until first message is sent) |
| UXP-01 | Contextual sign-in prompt appears as a non-blocking banner after an anonymous user's first successful preset download — "Sign in to save this chat and come back to refine it later" | Trigger added in page.tsx downloadPreset(): if user is anonymous, set `showSignInBanner = true`; banner renders above or below preset card, dismissible, contains "Sign in" link that dispatches `helixai:before-signin` + calls AuthButton sign-in logic |
| UXP-02 | Loading states during conversation resume show distinct phases — "Loading conversation..." with smooth transition to populated chat | In page.tsx `loadConversation()` (Phase 27): set `isLoadingConversation = true` before fetch, clear after; chat area shows a skeleton or "Loading conversation..." indicator during the fetch |
| UXP-03 | Continuation suggestion chips shown when resuming a past conversation — "Refine this tone", "Try a different amp", "Generate for [other device]" — static suggestions, no AI call | Three chip buttons rendered immediately after `loadConversation()` succeeds (when `conversationId` is set and `messages.length > 0` and `isResumingConversation` flag is true); chips call `setInput()` with their text or trigger `generatePreset()` with the other device; static suggestions, no AI call needed |
</phase_requirements>

---

## Summary

Phase 28 is the final phase of the v2.0 Persistent Chat Platform milestone. It surfaces the persistence infrastructure built in Phases 24–27 through a polished sidebar UI and three UX improvements. No new dependencies are required. All new code is UI-only: new React components, modifications to page.tsx and layout.tsx, and CSS additions to globals.css.

The core architectural constraint is that the sidebar lives in `layout.tsx`, not `page.tsx`. This is a locked decision from STATE.md. It means communication between the sidebar (in layout) and the chat area (in page.tsx) must use the same event-bridge pattern established in Phase 25 for AuthButton — custom DOM events dispatched from the sidebar and listened to in page.tsx. The sidebar cannot receive React props from page.tsx because layout and page are in different component trees.

Phase 27 already wired `loadConversation()` into page.tsx as a function stub. Phase 28 calls it via URL search params: when the user clicks a conversation in the sidebar, it sets `?conversation=<id>` in the URL, page.tsx reads this param on mount and on URL change, and calls `loadConversation()`. This pattern was chosen in STATE.md over dynamic routes to avoid a major page.tsx refactor.

**Primary recommendation:** Build in this order: (1) ChatSidebar + ChatHistoryList components (display only), (2) wire conversation resume via URL params, (3) add New Chat button event bridge, (4) add optimistic delete, (5) add UXP-01 sign-in banner, (6) add UXP-02 resume loading state, (7) add UXP-03 continuation chips. Each step is independently testable and each adds visible behavior.

---

## Standard Stack

### Core (no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | Already installed (Phase 24) | Server client in ChatHistoryList server component | Same pattern as all prior server components |
| `@supabase/supabase-js` | Already installed (Phase 24) | Browser client for optimistic delete in ChatSidebar | Same as AuthButton, page.tsx |
| `next/navigation` | Bundled with Next.js | `useRouter`, `useSearchParams` for conversation URL param | Already used in AuthButton |
| React (useState, useEffect, useCallback) | Bundled | Sidebar toggle state, conversation list state, optimistic updates | Already used throughout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | — | — | Phase 28 requires zero new npm installs |

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
src/
├── app/
│   ├── layout.tsx                     # MODIFIED — add sidebar shell, flex layout, session check
│   └── page.tsx                       # MODIFIED — URL param handling, loadConversation trigger,
│                                      #   sign-in banner state, resume loading state,
│                                      #   continuation chips, New Chat event listener
│
└── components/
    └── sidebar/
        ├── ChatSidebar.tsx            # NEW — outer shell: client component, manages open/close
        │                             #   state, holds conversation list array for optimistic updates,
        │                             #   handles delete, listens for router.refresh() signals
        └── ConversationList.tsx       # NEW — renders list of conversation items; receives
                                      #   conversations[] as props from ChatSidebar
```

Note: the ARCHITECTURE.md described `ChatHistoryList.tsx` as a server component. After inspecting the actual codebase and constraints, a hybrid approach works better: `ChatSidebar.tsx` is a client component that fetches conversations from `/api/conversations` (an API route, not direct DB query). This avoids the complexity of mixing server and client component islands at the layout level and enables the optimistic update pattern required by SIDE-06. Server component direct-DB access works in simple cases but complicates the optimistic delete rollback because server components cannot hold mutation state.

### Pattern 1: Layout-Level Sidebar with CSS Transform Toggle

**What:** The sidebar shell (`<aside>`) is always in the DOM — mounted in `layout.tsx`. It uses `translateX(-100%)` when closed and `translateX(0)` when open. This prevents the conversation list from re-fetching every time the sidebar is opened and keeps scroll position across open/close cycles.

**When to use:** Sidebar toggle. Do NOT use conditional rendering (`{isOpen && <ChatSidebar />}`) — that unmounts and remounts the component on every toggle.

**Layout structure in layout.tsx:**
```tsx
// src/app/layout.tsx — after Phase 28
export default async function RootLayout({ children }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = user && !user.is_anonymous

  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        <div className="hlx-grain" aria-hidden="true" />
        <div className="hlx-ambient" aria-hidden="true" />
        <header className="fixed top-0 right-0 z-50 p-3">
          <AuthButton />
        </header>
        <div className="flex h-screen">
          {isAuthenticated && <ChatSidebar />}
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
```

Key note: `layout.tsx` is an async server component so it can call `createSupabaseServerClient()` and check auth. `ChatSidebar` (client component) fetches its own data — it is not passed conversations as props from the server.

**Mobile behavior:** On screens narrower than 768px, the sidebar becomes an overlay — it uses `position: fixed` with `z-index: 40` and covers the main content area. A backdrop overlay (semi-transparent div) is shown behind it. On desktop (>= 768px), the sidebar is `position: relative` and pushes the main content.

### Pattern 2: Conversation Resume via URL Search Params

**What:** This is the communication mechanism between the sidebar (in layout) and the chat area (in page.tsx). When the user clicks a conversation in the sidebar, the sidebar navigates to `/?conversation=<id>`. page.tsx reads this param with `useSearchParams()` and calls `loadConversation()` when it changes.

**Why URL params over DOM events:** DOM events work for fire-and-forget notifications (New Chat, before-signin). Resume requires round-tripping data (the conversation ID) and must survive a potential `router.refresh()`. URL params persist through refreshes and are bookmarkable — they are the right mechanism for "which conversation am I looking at".

**page.tsx additions:**
```typescript
// Read conversation ID from URL on mount and on URL change
const searchParams = useSearchParams()
const conversationParam = searchParams.get('conversation')

useEffect(() => {
  if (conversationParam && conversationParam !== conversationId) {
    loadConversation(conversationParam)
  }
}, [conversationParam])
```

**Sidebar navigation:**
```typescript
// In ChatSidebar conversation item click handler
router.push(`/?conversation=${conv.id}`)
```

After `loadConversation()` completes, page.tsx should clear the URL param to prevent re-loading on refresh:
```typescript
// After successful loadConversation()
router.replace('/', { scroll: false })
```

This is the pattern recommended in STATE.md: "URL search params for deep-linking."

### Pattern 3: New Chat Event Bridge

**What:** The sidebar's "New Chat" button cannot call page.tsx's `startOver()` directly because they are in different component trees. Use the custom DOM event pattern established in Phase 25.

**Sidebar dispatches:**
```typescript
// In ChatSidebar "New Chat" button handler
window.dispatchEvent(new Event('helixai:new-chat'))
router.push('/') // Navigate to root URL (clear conversation param)
```

**page.tsx listens:**
```typescript
useEffect(() => {
  const handler = () => {
    startOver()
    // conversationId is cleared by startOver() (Phase 27 Plan 02)
  }
  window.addEventListener('helixai:new-chat', handler)
  return () => window.removeEventListener('helixai:new-chat', handler)
}, []) // startOver is stable — no deps needed
```

### Pattern 4: Optimistic Delete

**What:** When the user clicks delete on a conversation, remove it from the local array immediately, then call DELETE `/api/conversations/[id]`. If the API call fails, add it back.

**Implementation:**
```typescript
// In ChatSidebar
const [conversations, setConversations] = useState<Conversation[]>([])

async function handleDelete(id: string) {
  const prev = conversations
  setConversations(c => c.filter(conv => conv.id !== id)) // Optimistic remove

  const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    setConversations(prev) // Rollback
    // Show error state briefly
  }
}
```

This is exactly the pattern FEATURES.md describes: "Use optimistic updates with rollback on error."

No TanStack Query or `useOptimistic` needed — a simple `useState` array with manual optimistic update covers this use case.

### Pattern 5: Sign-In Banner (UXP-01)

**What:** A dismissible banner that appears below the preset card after an anonymous user downloads a preset. It should be non-blocking — the download still works, the user can dismiss the banner and continue.

**Where it lives:** In `page.tsx` — a new `showSignInBanner` state. Set to `true` in `downloadPreset()` when `user?.is_anonymous` is true. Render the banner in the JSX near the preset card.

**Trigger:**
```typescript
function downloadPreset() {
  // ... existing download logic ...

  // UXP-01: show sign-in prompt after first anonymous download
  if (!conversationId) { // anonymous users never have a conversationId
    setShowSignInBanner(true)
  }
}
```

**Banner JSX (inside the preset card area or just below):**
```tsx
{showSignInBanner && (
  <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-[var(--hlx-border-warm)] bg-[var(--hlx-elevated)] text-[0.8125rem]">
    <span className="text-[var(--hlx-text-sub)]">
      Sign in to save this chat and come back to refine it later
    </span>
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        onClick={() => {
          window.dispatchEvent(new Event('helixai:before-signin'))
          // AuthButton handles the OAuth redirect
        }}
        className="text-[var(--hlx-amber)] hover:text-[var(--hlx-text)] font-medium transition-colors text-[0.8125rem]"
      >
        Sign in
      </button>
      <button
        onClick={() => setShowSignInBanner(false)}
        className="text-[var(--hlx-text-muted)] hover:text-[var(--hlx-text-sub)] transition-colors"
        aria-label="Dismiss"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
)}
```

The "Sign in" text inside this banner dispatches `helixai:before-signin` (same event AuthButton already handles) to trigger the OAuth flow. No new auth logic needed.

### Pattern 6: Resume Loading State (UXP-02)

**What:** When `loadConversation()` is called, the chat area shows "Loading conversation..." instead of the empty chat or previous messages. Distinct transition when messages populate.

**New state in page.tsx:**
```typescript
const [isLoadingConversation, setIsLoadingConversation] = useState(false)
```

**Modified loadConversation() (Phase 27 Plan 02 stub):**
```typescript
async function loadConversation(convId: string) {
  setIsLoadingConversation(true) // UXP-02
  setMessages([])                // Clear old messages immediately
  try {
    // ... existing fetch logic from Phase 27 Plan 02 ...
    // ... setMessages(data.messages) ...
  } finally {
    setIsLoadingConversation(false)
  }
}
```

**Loading indicator in JSX (replaces the messages area when loading):**
```tsx
{isLoadingConversation ? (
  <div className="flex flex-col items-center justify-center h-full gap-3">
    <svg className="hlx-spin h-5 w-5 text-[var(--hlx-amber)]" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <p className="text-[0.8125rem] text-[var(--hlx-text-muted)]">Loading conversation&hellip;</p>
  </div>
) : /* existing messages rendering */ }
```

### Pattern 7: Continuation Suggestion Chips (UXP-03)

**What:** After a conversation is resumed (messages loaded, not generating), show three quick-action chips above the input:
- "Refine this tone" → sets input to "Refine this tone" and focuses the textarea
- "Try a different amp" → sets input to "Try a different amp, keeping the same style"
- "Generate for [other device]" → calls generatePreset() with the device that was NOT used in this conversation

**When to show:** `isResumingConversation` flag set by `loadConversation()` after data loads. Hidden once the user sends a new message or generates a preset.

**New state:**
```typescript
const [isResumingConversation, setIsResumingConversation] = useState(false)
```

**Set in loadConversation() after data loads:**
```typescript
setIsResumingConversation(true)
```

**Clear on first new action:**
```typescript
// In sendMessage(): setIsResumingConversation(false)
// In generatePreset(): setIsResumingConversation(false)
// In startOver(): setIsResumingConversation(false)
```

**JSX (rendered between the message history and the input bar):**
```tsx
{isResumingConversation && !isStreaming && !isGenerating && messages.length > 0 && (
  <div className="flex gap-2 flex-wrap px-6 pb-2">
    <button
      onClick={() => { setInput("Refine this tone"); inputRef.current?.focus(); setIsResumingConversation(false) }}
      className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      Refine this tone
    </button>
    <button
      onClick={() => { setInput("Try a different amp, keeping the same style"); inputRef.current?.focus(); setIsResumingConversation(false) }}
      className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      Try a different amp
    </button>
    {/* "Generate for [other device]" — shows the device NOT used in this conversation */}
    <button
      onClick={() => {
        const otherDevice = selectedDevice === "helix_lt" ? "helix_floor" : "helix_lt"
        setSelectedDevice(otherDevice)
        generatePreset(undefined, otherDevice)
        setIsResumingConversation(false)
      }}
      className="px-3 py-1.5 rounded-full border border-[var(--hlx-border)] bg-[var(--hlx-surface)] text-[11px] text-[var(--hlx-text-sub)] hover:border-[var(--hlx-border-warm)] hover:bg-[var(--hlx-elevated)] transition-all"
      style={{ fontFamily: "var(--font-mono), monospace" }}
    >
      Generate for {selectedDevice === "pod_go" ? "Helix LT" : selectedDevice === "helix_lt" ? "Helix Floor" : "Helix LT"}
    </button>
  </div>
)}
```

### Anti-Patterns to Avoid

- **Conditional rendering for sidebar toggle:** `{isOpen && <ChatSidebar />}` unmounts and remounts the component, triggering a refetch of the conversation list on every toggle. Use CSS transform instead.
- **Fetching conversation list in page.tsx:** page.tsx re-renders more frequently than layout.tsx. The list should live in ChatSidebar (mounted in layout) and only refresh on router.refresh() signals.
- **Passing conversations as props from layout to ChatSidebar:** Server props cannot be updated without a full server re-render. ChatSidebar must manage its own conversation array in useState and fetch from the API on mount.
- **Using dynamic route `/chat/[id]` for conversation resume:** STATE.md explicitly decided against this: "Keep page.tsx as single-page interface (not dynamic routes) — conversationId lives in React state." This would require a major refactor of page.tsx's state machine.
- **Storing conversationId in the URL permanently:** URL params are used to signal a resume action, not as the permanent identifier. After `loadConversation()` succeeds, call `router.replace('/')` to clean the URL. If the user refreshes with `?conversation=<id>` in the URL, `loadConversation()` will fire again (acceptable — it just reloads the same conversation).
- **Skipping the `router.refresh()` call after conversation operations:** After optimistic delete, the server still has the data until the DB delete completes. If `router.refresh()` is called after confirmation, the sidebar would temporarily flicker back. Optimistic delete should NOT call `router.refresh()` — it should trust the local state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sidebar toggle animation | Custom animation library | CSS `transform: translateX()` + `transition` | Already a global CSS pattern in this app; simpler, no dependency |
| Optimistic delete rollback | Complex state machine | Simple `useState` array + backup variable | The list is small (< 50 items); no need for TanStack Query |
| Conversation resume routing | Dynamic routes | URL search params | STATE.md locked decision; avoids page.tsx refactor |
| Time-relative timestamps ("2 days ago") | Custom formatter | `Intl.RelativeTimeFormat` browser API | Built into modern browsers, no library needed |

**Key insight:** This phase adds no new libraries. Every pattern builds on existing project conventions — the event bridge, CSS variables, Supabase client utilities, and the page.tsx state machine are all already established.

---

## Common Pitfalls

### Pitfall 1: Sidebar Shows for Anonymous Users After OAuth Redirect
**What goes wrong:** After signing in, `router.refresh()` in AuthButton triggers a layout re-render. If the layout's session check is stale or cached, the sidebar may not appear.
**Why it happens:** Next.js App Router layouts are re-rendered on `router.refresh()` by default, but if the layout has `export const revalidate = ...` set, it might cache. The Phase 25 pattern with `router.refresh()` after sign-in should handle this correctly since `createSupabaseServerClient()` reads fresh cookies on every request.
**How to avoid:** Do NOT add `export const revalidate` to layout.tsx. Keep it as a pure dynamic server component that reads cookies fresh on every request.

### Pitfall 2: Conversation List Out of Sync After New Conversation
**What goes wrong:** User generates a preset in a new conversation (created by Phase 27), but the sidebar does not show the new conversation until page refresh.
**Why it happens:** The sidebar fetches conversations on ChatSidebar mount. New conversations created by page.tsx (via `POST /api/conversations`) don't automatically notify the sidebar.
**How to avoid:** In page.tsx, after `ensureConversation()` creates a new conversation, dispatch `window.dispatchEvent(new Event('helixai:conversation-created'))`. ChatSidebar listens for this event and re-fetches the conversation list.

### Pitfall 3: Double Resume on Hard Refresh
**What goes wrong:** User closes browser with `?conversation=<id>` in the URL. On hard refresh, `loadConversation()` fires, loading the old conversation. User expects a clean new chat.
**Why it happens:** The URL param persists across browser sessions.
**How to avoid:** After `loadConversation()` succeeds, call `router.replace('/')` to strip the param. This is already in Pattern 2 above. On hard refresh, the param is gone and a clean state is shown.

### Pitfall 4: Delete Fails Silently on Optimistic Remove
**What goes wrong:** User clicks delete, conversation disappears from sidebar (optimistic), but the API call fails. The conversation is gone from the UI but still in the database. User is confused.
**Why it happens:** No error feedback on rollback.
**How to avoid:** On DELETE failure, rollback the array AND set a brief error state: `setDeleteError('Failed to delete conversation. Please try again.')`. Show this as a small error message in the sidebar for 3 seconds.

### Pitfall 5: Sign-In Banner Shown After Non-Anonymous Download
**What goes wrong:** `showSignInBanner` is set in `downloadPreset()` without checking auth state — even authenticated users see the banner.
**Why it happens:** The auth state check is omitted from the `downloadPreset()` function.
**How to avoid:** The `downloadPreset()` function in page.tsx has access to the `user` state (added in Phase 25). Only set `showSignInBanner = true` when `user?.is_anonymous !== false` (i.e., when the user is definitely anonymous or the user state is not yet loaded).

### Pitfall 6: page.tsx Width Changes Break the Welcome Screen Layout
**What goes wrong:** Adding the sidebar (which pushes page content via flex layout) makes the welcome screen too narrow, breaking the centered logo and 2×3 suggestion card grid.
**Why it happens:** The sidebar takes ~260px of width. page.tsx's welcome screen uses `max-w-5xl mx-auto` which was designed for full-viewport width.
**How to avoid:** The main content area retains `max-w-5xl mx-auto` — the `min-w-0` on the flex child prevents overflow, and `max-w-5xl` will be the constraining factor only on very wide screens. On typical laptop screens (1280-1440px wide), with a 260px sidebar, the chat area is 1020-1180px wide — well within max-w-5xl (1024px). This is fine. On mobile, the sidebar is an overlay and does not affect content width.

### Pitfall 7: hydration mismatch from server-rendered sidebar auth check
**What goes wrong:** layout.tsx is a server component that checks auth. If the client-side Supabase session differs from the server-side check (e.g., session expired between server render and client hydration), the sidebar's presence/absence flickers.
**Why it happens:** Server renders with stale session state.
**How to avoid:** The middleware.ts (Phase 24) refreshes sessions on every request before layout.tsx renders. This guarantees the server-side check in layout.tsx reflects the current session. No special hydration fix needed — the middleware handles it.

---

## Code Examples

### ChatSidebar.tsx Structure
```typescript
// Source: Project pattern (event bridge from Phase 25, optimistic update from FEATURES.md)
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

interface Conversation {
  id: string
  title: string | null
  device: string
  updated_at: string
}

export function ChatSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  // Fetch conversations on mount
  const fetchConversations = useCallback(async () => {
    const res = await fetch('/api/conversations')
    if (res.ok) {
      const data = await res.json()
      setConversations(data)
    }
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  // Listen for new conversation creation from page.tsx
  useEffect(() => {
    const handler = () => fetchConversations()
    window.addEventListener('helixai:conversation-created', handler)
    return () => window.removeEventListener('helixai:conversation-created', handler)
  }, [fetchConversations])

  async function handleDelete(id: string) {
    const prev = conversations
    setConversations(c => c.filter(conv => conv.id !== id)) // Optimistic remove
    const res = await fetch(`/api/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      setConversations(prev) // Rollback
      setDeleteError('Failed to delete. Please try again.')
      setTimeout(() => setDeleteError(null), 3000)
    }
  }

  function handleNewChat() {
    window.dispatchEvent(new Event('helixai:new-chat'))
    router.push('/')
    setIsOpen(false)
  }

  function handleSelect(id: string) {
    router.push(`/?conversation=${id}`)
    setIsOpen(false)
  }

  return (
    <>
      {/* Toggle button */}
      <button onClick={() => setIsOpen(o => !o)} /* ... */ />

      {/* Sidebar panel */}
      <aside
        className="/* ... positioning, transform, transition ... */"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {/* Header with New Chat button */}
        {/* Conversation list */}
        {/* Error display */}
      </aside>

      {/* Mobile backdrop */}
      {isOpen && <div className="fixed inset-0 z-30 md:hidden" onClick={() => setIsOpen(false)} />}
    </>
  )
}
```

### Relative Timestamp Helper (no library)
```typescript
// Source: MDN Web Docs — Intl.RelativeTimeFormat
function relativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (diffMins < 60) return rtf.format(-diffMins, 'minute')
  if (diffHours < 24) return rtf.format(-diffHours, 'hour')
  if (diffDays < 30) return rtf.format(-diffDays, 'day')
  return date.toLocaleDateString()
}
```

### Device Label Helper (matches page.tsx pattern)
```typescript
// Source: Matches existing device label pattern in page.tsx lines 1062-1064
function deviceLabel(device: string): string {
  return device === 'helix_lt' ? 'LT'
    : device === 'helix_floor' ? 'FLOOR'
    : device === 'pod_go' ? 'POD GO'
    : device.toUpperCase()
}
```

### layout.tsx After Phase 28
```tsx
// src/app/layout.tsx — final state after Phase 28
import { ChatSidebar } from '@/components/sidebar/ChatSidebar'
import { AuthButton } from '@/components/auth/AuthButton'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function RootLayout({ children }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthenticated = user && !user.is_anonymous

  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased`}>
        <div className="hlx-grain" aria-hidden="true" />
        <div className="hlx-ambient" aria-hidden="true" />
        <header className="fixed top-0 right-0 z-50 p-3">
          <AuthButton />
        </header>
        <div className="flex min-h-screen">
          {isAuthenticated && <ChatSidebar />}
          <main className="flex-1 min-w-0 overflow-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `{isOpen && <Sidebar />}` conditional render | `translateX()` CSS transform always-mounted sidebar | ChatGPT/Claude pattern circa 2023 | List data preserved across open/close; no re-fetch |
| TanStack Query for sidebar mutations | `useState` array + manual optimistic update | Appropriate for simple lists | No new dependency; same outcome for < 50 items |
| Dynamic routes for chat history | URL search params + single-page architecture | STATE.md decision 2026-03-03 | Avoids page.tsx refactor; keeps existing state machine |
| `useOptimistic` React 19 hook | Manual useState backup pattern | Available in React 19 but adds complexity | `useOptimistic` is fine but not required for this use case |

---

## Open Questions

1. **When does the sidebar appear for a first-time authenticated user?**
   - What we know: layout.tsx checks `!user.is_anonymous` to render `<ChatSidebar />`. On first sign-in via Phase 25, `router.refresh()` is called in AuthButton's `onAuthStateChange` handler.
   - What's unclear: Does `router.refresh()` cause layout.tsx to re-render and pick up the new authenticated state?
   - Recommendation: Yes — `router.refresh()` invalidates the router cache and triggers a server re-render of the layout. This is exactly how AuthButton was designed in Phase 25. The sidebar should appear immediately after sign-in without page reload. Confirm in manual testing.

2. **Should the sidebar be open by default for authenticated users?**
   - What we know: No explicit requirement. Major chat apps (ChatGPT, Claude) default to open sidebar on desktop.
   - What's unclear: Whether this conflicts with the existing full-width welcome screen aesthetic.
   - Recommendation: Default to closed. The sidebar is accessed via a hamburger/toggle button in the top-left area. This preserves the welcome screen's centered layout and avoids layout shift surprise. Users can learn to open it.

3. **Does the `helixai:conversation-created` event need a conversationId payload?**
   - What we know: ChatSidebar re-fetches the full list on this event. A re-fetch gives the full up-to-date list from the server.
   - What's unclear: Whether passing the new conversation data as an event payload (to avoid a re-fetch) is worth the complexity.
   - Recommendation: Use a plain Event with no payload. Re-fetch the full list. The list is typically < 20 items and the round-trip is fast. Premature optimization to avoid a single 100ms API call.

4. **Does the sidebar need an SidebarToggle in the main content area (page.tsx header)?**
   - What we know: The current page.tsx header has just a logo + "New Session" button. The sidebar toggle button needs to be accessible when the sidebar is closed.
   - What's unclear: Where exactly to place the toggle — in the layout header (top-left) vs. the page.tsx header.
   - Recommendation: Place a sidebar toggle button in the layout level, not in page.tsx. A fixed-position hamburger button (top-left, z-50) in layout.tsx — always visible regardless of chat state. This keeps the toggle accessible from both the welcome screen and the chat flow without modifying page.tsx's header logic.

---

## Validation Architecture

> nyquist_validation not present in .planning/config.json — skip this section.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/app/layout.tsx` — confirmed current structure (no sidebar yet, no AuthButton yet, no flex layout)
- Direct codebase inspection: `src/app/page.tsx` — confirmed loadConversation() is a Phase 27 stub, startOver() exists, messages state, header structure, CSS variable patterns
- Direct codebase inspection: `src/app/globals.css` — confirmed all CSS variables (--hlx-void, --hlx-surface, --hlx-elevated, --hlx-border, --hlx-border-warm, --hlx-amber, --hlx-text, --hlx-text-sub, --hlx-text-muted), utility classes (hlx-rack, hlx-spin, hlx-input, hlx-send, hlx-download, hlx-msg, hlx-msg-user, hlx-msg-ai, hlx-preset-card, etc.)
- `.planning/STATE.md` — confirmed locked decisions: sidebar in layout.tsx, URL search params for conversation ID, CSS transform (not conditional render) for sidebar toggle, single-page architecture
- `.planning/research/ARCHITECTURE.md` — confirmed component map, data flow for resume, sidebar interaction pattern
- `.planning/research/FEATURES.md` — confirmed optimistic updates are required (SIDE-06), contextual sign-in prompt timing (UXP-01), continuation chips are static (UXP-03)
- `.planning/phases/27-persistence-wiring/27-02-PLAN.md` — confirmed `loadConversation()` API contract, `storedPresetPath` state, `startOver()` reset pattern
- `.planning/phases/25-auth-flow/25-02-PLAN.md` — confirmed event bridge pattern (`helixai:before-signin`), AuthButton placement in layout.tsx fixed header, `user` state in page.tsx
- `.planning/REQUIREMENTS.md` lines 229-243 — exact text of SIDE-01 through SIDE-06 and UXP-01 through UXP-03

### Secondary (MEDIUM confidence)

- ARCHITECTURE.md Pattern 3 — "Server Component Sidebar with Client Island Toggle" — research suggests a pure server component approach but the optimistic delete requirement (SIDE-06) makes a fully-client ChatSidebar more appropriate. Hybrid approach documented.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns directly observed in codebase
- Architecture: HIGH — all patterns either locked decisions (STATE.md) or derived from Phase 25/27 plan documents
- Pitfalls: HIGH — most identified by direct inspection of the codebase constraints and prior phase decisions; one (hydration mismatch) verified against Phase 24 middleware setup

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable — no fast-moving libraries; all patterns are project-internal)
