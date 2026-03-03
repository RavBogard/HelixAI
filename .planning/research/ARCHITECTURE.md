# Architecture Research

**Domain:** Persistent chat, authentication, and file storage — v2.0 additions to existing stateless Next.js App Router guitar preset generator
**Researched:** 2026-03-03
**Confidence:** HIGH — all integration patterns verified against official Supabase, Auth.js, and Next.js documentation; existing codebase fully inspected

---

## Context: What This Document Covers

This document covers the v2.0 Persistent Chat Platform milestone only. It answers:
- How auth, database, and file storage integrate with the existing Next.js App Router + Vercel serverless architecture
- What new routes, components, and providers are needed
- How data flows change relative to v1.3
- What build order is required given dependencies
- How the chat sidebar interacts with the existing single-page chat flow

The existing validated stack (Next.js App Router, TypeScript, Tailwind CSS, Claude Sonnet 4.6, Gemini chat, Vercel) is NOT re-researched here.

---

## System Overview

### Current Architecture (v1.3 — Stateless)

```
+--------------------------------------------------------------------+
|                     BROWSER (page.tsx)                             |
|                                                                    |
|  +------------------+  +------------------+  +----------------+   |
|  | Chat Interview   |  | Device Selector  |  | Image Upload   |   |
|  | (React useState) |  | (React useState) |  | (React useState|   |
|  +--------+---------+  +--------+---------+  +--------+-------+   |
|           |                     |                     |           |
+-----------+---------------------+---------------------+-----------+
            |
            v POST body: { messages[], device, rigIntent, rigText }
+--------------------------------------------------------------------+
|                   VERCEL SERVERLESS FUNCTIONS                      |
|                                                                    |
|  /api/chat      /api/generate      /api/vision      /api/map      |
|  (Gemini SSE)   (Claude Planner    (Claude Vision)  (mapping)     |
|                  + Knowledge Layer)                                |
|                                                                    |
|  NO database. NO user identity. NO persistent state.              |
+--------------------------------------------------------------------+
```

### Target Architecture (v2.0 — Persistent)

```
+--------------------------------------------------------------------+
|                     BROWSER                                        |
|                                                                    |
|  +---------------+  +----------------------------------+           |
|  | Chat Sidebar  |  | Chat Area (existing page.tsx)   |           |
|  | (NEW — server |  |                                  |           |
|  |  component    |  |  +----------------------------+  |           |
|  |  + client     |  |  | Chat Interview / Generate  |  |           |
|  |  toggle)      |  |  | (modified — saves to DB)   |  |           |
|  |               |  |  +----------------------------+  |           |
|  | [past chats]  |  |                                  |           |
|  | [new chat +]  |  +----------------------------------+           |
|  +-------+-------+                    |                            |
|          |                            |                            |
+----------+----------------------------+----------------------------+
           |                            |
           v                            v
+--------------------------------------------------------------------+
|                   VERCEL SERVERLESS FUNCTIONS                      |
|                                                                    |
|  EXISTING (unchanged):    NEW:                                     |
|  /api/chat (Gemini)       /api/auth/[...nextauth]  (Auth.js v5)   |
|  /api/generate (Claude)   /api/conversations       (CRUD)          |
|  /api/vision (Claude)     /api/conversations/[id]  (read/update)   |
|  /api/map (mapping)       /api/preset-upload       (signed URL)    |
|                                                                    |
+--------------------------------------------------------------------+
           |                            |
           v                            v
+--------------------------------------------------------------------+
|                      SUPABASE                                      |
|                                                                    |
|  Auth (native Supabase Auth with Google OAuth + anonymous sign-in) |
|                                                                    |
|  PostgreSQL:                                                       |
|  +-------------------+  +------------------+  +-----------------+ |
|  | users             |  | conversations    |  | messages        | |
|  | (id, email, name, |  | (id, user_id,    |  | (id,            | |
|  |  avatar_url,      |  |  title, device,  |  |  conversation_  | |
|  |  created_at,      |  |  created_at,     |  |  id, role,      | |
|  |  is_anonymous)    |  |  updated_at,     |  |  content,       | |
|  +-------------------+  |  preset_url)     |  |  created_at)    | |
|                         +------------------+  +-----------------+ |
|                                                                    |
|  Storage:                                                          |
|  +---------------------------------------------------+            |
|  | presets bucket (private)                          |            |
|  | path: {user_id}/{conversation_id}/preset.hlx      |            |
|  | path: {user_id}/{conversation_id}/preset.pgp      |            |
|  +---------------------------------------------------+            |
+--------------------------------------------------------------------+
```

---

## Component Responsibilities

| Component | Responsibility | Existing or New |
|-----------|----------------|-----------------|
| `src/app/layout.tsx` | Root layout — add Supabase session provider, sidebar shell | MODIFIED |
| `src/app/page.tsx` | Main chat flow — add conversation ID state, auto-save on generate | MODIFIED |
| `src/components/sidebar/ChatSidebar.tsx` | Pull-out panel — list past conversations, new chat button | NEW |
| `src/components/sidebar/ChatHistoryList.tsx` | Server component — fetches conversation list from Supabase | NEW |
| `src/components/sidebar/SidebarToggle.tsx` | Client component — toggle open/closed state | NEW |
| `src/components/auth/AuthButton.tsx` | Login / avatar / logout — reflects current session | NEW |
| `src/lib/supabase/server.ts` | `createServerClient()` — Supabase client for server components, route handlers | NEW |
| `src/lib/supabase/client.ts` | `createBrowserClient()` — Supabase client for client components | NEW |
| `src/lib/supabase/middleware.ts` | Session refresh via `updateSession()` | NEW |
| `middleware.ts` (project root) | Next.js middleware — calls `updateSession`, routes session cookies | NEW |
| `src/app/auth/callback/route.ts` | PKCE callback for Google OAuth + anonymous link flow | NEW |
| `/api/conversations` route | Create new conversation, list user conversations | NEW |
| `/api/conversations/[id]` route | Fetch full message history, update title | NEW |
| `/api/preset-upload` route | Create Supabase Storage signed upload URL, return to client | NEW |
| `src/app/api/generate/route.ts` | Existing generation — extended to accept `conversationId?`, save preset | MODIFIED |
| `src/app/api/chat/route.ts` | Existing Gemini chat — extended to persist messages when `conversationId` provided | MODIFIED |

---

## Recommended Project Structure (additions only)

```
src/
├── app/
│   ├── api/
│   │   ├── chat/route.ts              # MODIFIED — persist messages when conversationId provided
│   │   ├── generate/route.ts          # MODIFIED — persist preset URL when conversationId provided
│   │   ├── conversations/
│   │   │   ├── route.ts               # NEW — POST create, GET list
│   │   │   └── [id]/
│   │   │       └── route.ts           # NEW — GET history, PATCH title
│   │   ├── preset-upload/
│   │   │   └── route.ts               # NEW — signed upload URL for Supabase Storage
│   │   └── auth/
│   │       └── callback/
│   │           └── route.ts           # NEW — OAuth PKCE callback handler
│   ├── layout.tsx                     # MODIFIED — add sidebar shell, session context
│   └── page.tsx                       # MODIFIED — conversation ID state, save triggers
│
├── components/
│   ├── sidebar/
│   │   ├── ChatSidebar.tsx            # NEW — outer sidebar shell (client, handles toggle)
│   │   ├── ChatHistoryList.tsx        # NEW — server component, fetches from Supabase
│   │   └── SidebarToggle.tsx          # NEW — hamburger / close button, client only
│   └── auth/
│       └── AuthButton.tsx             # NEW — login with Google / avatar / logout
│
├── lib/
│   └── supabase/
│       ├── server.ts                  # NEW — createServerClient() using @supabase/ssr
│       ├── client.ts                  # NEW — createBrowserClient() using @supabase/ssr
│       └── middleware.ts              # NEW — updateSession() helper
│
└── middleware.ts                      # NEW — project root, session refresh on every request
```

---

## Architectural Patterns

### Pattern 1: Native Supabase Auth (not Auth.js adapter)

**What:** Use Supabase Auth directly via `@supabase/ssr` for all auth operations, including Google OAuth and anonymous sign-in. Do NOT use the `@auth/supabase-adapter` with Auth.js.

**When to use:** Any time user identity is needed in server components, route handlers, or client components.

**Why not Auth.js Supabase adapter:** The `@auth/supabase-adapter` stores sessions in a separate `next_auth` schema and does not interface with Supabase Auth. This means Supabase's native `signInAnonymously()` and `linkIdentity()` for anonymous-to-authenticated upgrade are unavailable — which is the core mechanic of the anonymous-first requirement. Native Supabase Auth is the only supported path for this use case.

**Trade-offs:**
- No need for Auth.js `next-auth` package — one fewer dependency
- Supabase Auth handles Google OAuth natively with fewer configuration steps
- Supabase Auth handles PKCE flow natively for App Router compatibility
- Locked to Supabase as auth provider (acceptable given Supabase is also the database)

**Example:**
```typescript
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
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Pattern 2: Anonymous-First with Identity Linking

**What:** On first page load, call `supabase.auth.signInAnonymously()` if no session exists. The user gets a real Supabase user ID immediately, but with `is_anonymous: true` in their JWT. When they click "Login with Google," call `supabase.auth.linkIdentity({ provider: 'google' })` to upgrade that existing session — all data (conversations, presets) migrated automatically because the user ID does not change.

**When to use:** Anonymous-first auth is the core UX requirement: non-logged-in users get full functionality, login unlocks persistence history.

**Critical requirement:** The Supabase project must have "Enable Manual Linking" turned on in the Auth settings dashboard. Without this, `linkIdentity()` fails silently.

**Trade-offs:**
- Anonymous sessions persist only in the current browser — clearing cookies loses the history, which is acceptable per the requirements (logging in is what creates durable persistence)
- Known issue: user metadata (avatar_url, email, full_name) may not populate immediately after linking; it appears on the next sign-in. Plan for a re-fetch on the post-link callback.
- RLS policies must distinguish between anonymous users (read own data only) and authenticated users (read own data only) using the `is_anonymous` claim

**Example:**
```typescript
// In a client component — initialize session on mount
useEffect(() => {
  const initSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      await supabase.auth.signInAnonymously()
    }
  }
  initSession()
}, [])

// Login with Google — links to existing anonymous session
const handleLogin = async () => {
  await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` }
  })
}
```

### Pattern 3: Server Component Sidebar with Client Island Toggle

**What:** The sidebar shell and chat history list are server components — they fetch conversation data from Supabase at render time and ship zero client JavaScript for the data layer. The toggle button (open/close) is a small client component island imported inside the server component shell.

**When to use:** Chat history list with server-side data fetching. Layout-level component that persists across navigation.

**Trade-offs:**
- Server component fetches are faster (no client-side data fetch waterfall) and more secure (no exposure of Supabase client credentials in browser)
- The sidebar mounts in `layout.tsx` so it persists across child page navigations without re-mounting — the layout non-unmounting behavior handles sidebar state preservation automatically
- Client toggle state (open/closed) does not survive page reload — acceptable for a sidebar

**Example:**
```typescript
// src/components/sidebar/ChatHistoryList.tsx (Server Component)
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function ChatHistoryList() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title, updated_at, device')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  return (
    <ul>
      {conversations?.map(c => (
        <li key={c.id}>{c.title}</li>
      ))}
    </ul>
  )
}
```

### Pattern 4: Signed Upload URLs for Preset Files

**What:** When generating a preset, the `/api/generate` route creates a Supabase Storage signed upload URL via `supabase.storage.from('presets').createSignedUploadUrl(path)`, returns it to the client alongside the preset binary. The client uploads the preset file directly to Supabase Storage using `supabase.storage.from('presets').uploadToSignedUrl(path, token, file)`. The `/api/generate` route then stores the public download URL in the `conversations` table.

**Why not upload from the serverless function:** The preset file is generated in memory inside the serverless function. Uploading from the function is possible but requires the service role key in server code. The signed URL pattern keeps the service role key away from clients while still routing the binary directly to Supabase Storage (bypassing serverless size limits). Given preset files are small (.hlx is typically 10–50KB), either approach works — the signed URL pattern is used here for consistency and security clarity.

**Trade-offs:**
- Two-step: generate URL on server, upload from client — slightly more complex orchestration
- Signed URLs expire after 2 hours — not a concern for the immediate post-generate upload
- Preset files are very small (~10–50KB) — no file size concerns

**Example:**
```typescript
// In /api/generate/route.ts — after building the preset file
if (conversationId && userId) {
  const supabase = await createSupabaseServerClient()
  const path = `${userId}/${conversationId}/preset${fileExtension}`
  const { data } = await supabase.storage
    .from('presets')
    .createSignedUploadUrl(path)

  // Return signed URL to client alongside preset data
  return NextResponse.json({
    preset: hlxFile,
    presetUploadToken: data?.token,
    presetUploadPath: path,
    // ... other existing fields
  })
}
```

---

## Data Flow

### Request Flow: New Chat (Anonymous User)

```
User opens app (no session)
    |
    v
layout.tsx loads — Supabase middleware refreshes/creates anonymous session
    |
    v
page.tsx mounts — anonymous user ID available from session
    |
    v
User chats with Gemini (/api/chat) — messages stored in React useState only
    |
    v
User clicks "Generate" — POST /api/generate { messages, device }
    |
    v
/api/generate builds preset (existing pipeline, unchanged)
    |
    v (NO conversationId provided — anonymous flow)
Returns preset data to client (no DB write, no Storage upload)
    |
    v
Client downloads preset file (existing behavior, unchanged)
```

### Request Flow: Save Conversation (Authenticated User)

```
User clicks "Login with Google"
    |
    v
supabase.auth.linkIdentity({ provider: 'google' }) — redirects to Google
    |
    v
/auth/callback route handles PKCE exchange, merges identity to anonymous user
    |
    v
router.refresh() — sidebar re-renders with user's Google name/avatar
    |
    v
User chats with Gemini (/api/chat) — POST includes conversationId
    |
    v (first message in this session)
/api/chat creates conversation row if conversationId is new, saves message
    |
    v
User clicks "Generate" — POST /api/generate { messages, device, conversationId }
    |
    v
/api/generate runs existing pipeline (unchanged)
    |
    v
/api/generate creates signed upload URL, saves preset_url to conversations row
    |
    v
Returns preset + presetUploadToken + presetUploadPath to client
    |
    v
Client uploads preset binary to Supabase Storage via signed URL
    |
    v
Client downloads same preset file (existing behavior)
    |
    v
Sidebar updates (next navigation or router.refresh() call) — new conversation appears
```

### Request Flow: Resume Conversation

```
User clicks a past conversation in sidebar
    |
    v
Client fetches GET /api/conversations/{id} — returns messages[], preset_url, device
    |
    v
page.tsx repopulates messages state from response
    |
    v
User continues chatting (sends more messages, generates new preset)
    |
    v
/api/chat appends new messages to existing conversation
    |
    v
/api/generate overwrites preset_url in conversations row with new file
```

### State Management

```
Supabase Auth (source of truth for user identity)
    |
    v (session cookie on every request)
Server Components (read session via createServerClient)
    |
    v (props to client components)
Client Components (supabase.auth.onAuthStateChange for reactive updates)

Conversation List (server-fetched in ChatHistoryList)
    |
    v (re-fetched on router.refresh() or navigation)
Sidebar updates — layout non-unmounting preserves scroll position

Active Chat State (React useState in page.tsx — unchanged from v1.3)
    conversationId: string | null
    messages: Message[]
    device: DeviceTarget
    rigIntent: RigIntent | null
```

---

## Database Schema

### conversations

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` DEFAULT `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` NOT NULL | References `auth.users(id)` |
| `title` | `text` | Auto-generated from first user message (truncated to 60 chars) |
| `device` | `text` | `'helix_lt' | 'helix_floor' | 'pod_go'` — device used in last generation |
| `preset_url` | `text` | Supabase Storage URL of most recent preset file, nullable |
| `created_at` | `timestamptz` DEFAULT `now()` | |
| `updated_at` | `timestamptz` DEFAULT `now()` | Updated on each message insert |

### messages

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` DEFAULT `gen_random_uuid()` | Primary key |
| `conversation_id` | `uuid` NOT NULL | References `conversations(id)` |
| `role` | `text` NOT NULL | `'user' | 'assistant'` |
| `content` | `text` NOT NULL | Full message text |
| `created_at` | `timestamptz` DEFAULT `now()` | |

### Row Level Security Policies

All tables require RLS enabled. Core policies:

```sql
-- conversations: users see only their own rows
CREATE POLICY "users_own_conversations" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- messages: users see messages in their own conversations
CREATE POLICY "users_own_messages" ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

-- Storage: users read/write only their own prefix
CREATE POLICY "users_own_presets" ON storage.objects
  FOR ALL USING (
    bucket_id = 'presets' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## Integration Points

### New vs. Modified

| File | Status | Change |
|------|--------|--------|
| `src/app/layout.tsx` | MODIFIED | Add sidebar shell div, Supabase session context, `<ChatSidebar>` |
| `src/app/page.tsx` | MODIFIED | Add `conversationId` state, pass to API calls, handle `presetUploadToken` response |
| `src/app/api/chat/route.ts` | MODIFIED | Accept optional `conversationId`, persist messages to Supabase when present |
| `src/app/api/generate/route.ts` | MODIFIED | Accept optional `conversationId`, create signed upload URL, save `preset_url` |
| `src/lib/helix/*` | UNCHANGED | All Knowledge Layer files untouched |
| `src/lib/planner.ts` | UNCHANGED | Claude planner untouched |
| `src/lib/gemini.ts` | UNCHANGED | Gemini chat untouched |
| `src/lib/rig-*.ts` | UNCHANGED | Rig mapping and vision untouched |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Auth | Native `@supabase/ssr` — cookie-based, SSR-compatible | Google OAuth via Supabase dashboard config (no Auth.js needed) |
| Supabase PostgreSQL | `supabase-js` client in route handlers, server components | RLS enforces per-user isolation at DB level |
| Supabase Storage | Signed upload URL — server creates URL, client uploads binary | Private bucket, RLS on `storage.objects` |
| Google OAuth 2.0 | Configured in Supabase dashboard (not Google Cloud Console directly) | Supabase handles callback URL, token exchange |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `page.tsx` ↔ `/api/chat` | HTTP POST — existing + optional `conversationId` field | Backward compatible: no `conversationId` = existing stateless behavior |
| `page.tsx` ↔ `/api/generate` | HTTP POST — existing + optional `conversationId`; response + optional `presetUploadToken` | Backward compatible: anonymous users get same response as before |
| `ChatHistoryList` ↔ Supabase | Direct server component query via `createServerClient()` | No API route needed; server component reads DB directly |
| `layout.tsx` ↔ Supabase | Session check in `layout.tsx` to conditionally render sidebar | Uses `createServerClient()` in async server component |
| `middleware.ts` ↔ Supabase | `updateSession()` on every request to refresh session cookie | Required — without this, session expires unexpectedly |

---

## Build Order

Dependencies determine build order strictly. Each phase must be independently testable before the next begins.

### Phase 1: Supabase Project Setup + Auth Infrastructure

**What:** Create Supabase project, configure database schema, install packages, create server/client utilities, set up middleware.

**Why first:** Every other phase depends on being able to create a Supabase client. The schema must exist before any data can be written. The middleware must be in place before any session-dependent component works.

**Delivers:**
- Supabase project created, PostgreSQL tables `conversations` and `messages` created with RLS
- Storage bucket `presets` created with RLS policy
- `npm install @supabase/supabase-js @supabase/ssr` installed
- `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- `middleware.ts` at project root calling `updateSession`
- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Supabase Google OAuth provider configured in dashboard

**Does NOT touch:** Any existing routes, page.tsx, layout.tsx, or any existing lib code.

**Test gate:** `createSupabaseServerClient()` runs without error in a test route handler. An anonymous user can be created via `supabase.auth.signInAnonymously()` in a client component.

---

### Phase 2: Anonymous Sign-In + Google OAuth Link Flow

**What:** Implement the anonymous-first auth UX. On mount, sign in anonymously if no session. Add Login/Logout button component. Implement Google OAuth link flow with PKCE callback route.

**Why before persistence:** The auth user ID is the foreign key for all conversations and messages. The user ID must exist before any data can be written to the database.

**Delivers:**
- `src/app/auth/callback/route.ts` — PKCE code exchange, redirect back to app
- `src/components/auth/AuthButton.tsx` — "Login with Google" when anonymous, avatar + logout when authenticated
- `page.tsx` MODIFIED — `useEffect` to call `signInAnonymously()` on mount if no session
- `layout.tsx` MODIFIED — render `<AuthButton>` in header area
- "Enable Manual Linking" confirmed enabled in Supabase dashboard

**Does NOT touch:** Conversation list, message persistence, file storage.

**Test gate:** Open app as new user — anonymous session created (confirm in Supabase dashboard Auth > Users). Click Login with Google — Google OAuth flow completes, user record in Supabase shows `email` populated and `is_anonymous: false`. Check that user ID is unchanged between anonymous and authenticated state (same UUID in Supabase dashboard before and after linking).

---

### Phase 3: Conversation CRUD Routes

**What:** Build API routes that create, list, and fetch conversations and messages. These are the persistence layer that the frontend will call.

**Why before sidebar:** The sidebar needs real data to display. Build the data layer before the display layer.

**Delivers:**
- `POST /api/conversations` — create new conversation row, return `conversationId`
- `GET /api/conversations` — list all conversations for current user (ordered by `updated_at` desc)
- `GET /api/conversations/[id]` — fetch conversation + all messages, return for resume flow
- `PATCH /api/conversations/[id]` — update title (auto-titled from first message)

**Note:** All routes must use `createSupabaseServerClient()` and verify `user.id` matches the resource's `user_id` — do not rely solely on RLS (defense in depth).

**Does NOT touch:** page.tsx chat flow, sidebar UI, file storage.

**Test gate:** Use a REST client (curl or Postman) to POST a new conversation and GET the list. Verify RLS blocks access from a different user ID.

---

### Phase 4: Chat and Generate Route Persistence

**What:** Modify `/api/chat` and `/api/generate` to optionally persist messages and preset URLs when a `conversationId` is provided. Anonymous users (no `conversationId`) continue to work exactly as before.

**Why after routes:** The conversation must exist in the database before messages can be inserted into it. Phase 3's routes handle conversation creation; these routes handle message and preset insertion.

**Delivers:**
- `src/app/api/chat/route.ts` MODIFIED — if `conversationId` in body, insert each message to `messages` table; update `conversations.updated_at`
- `src/app/api/generate/route.ts` MODIFIED — if `conversationId` in body, create signed upload URL via Supabase Storage, store `preset_url` in `conversations` row, return `presetUploadToken` + `presetUploadPath` to client

**Backward compatibility:** Both routes must remain fully functional when no `conversationId` is provided. Existing anonymous generate flow must not change.

**Test gate:**
- POST `/api/chat` WITHOUT `conversationId` — identical response to v1.3 (no regression)
- POST `/api/chat` WITH `conversationId` — message appears in Supabase messages table
- POST `/api/generate` WITH `conversationId` — `preset_url` written to conversations table, `presetUploadToken` returned in response
- Verify Anthropic API response still shows `cache_read_input_tokens > 0` (prompt caching not broken by persistence logic)

---

### Phase 5: Chat Sidebar UI

**What:** Add the pull-out sidebar panel with conversation history list. Wire the sidebar to the Phase 3 API routes. Add "new chat" button. Implement conversation resume by loading messages from `/api/conversations/[id]`.

**Why last:** Requires stable API routes (Phase 3) and stable conversation creation flow (Phase 4). UI is the outermost layer.

**Delivers:**
- `src/components/sidebar/ChatSidebar.tsx` — outer shell, handles open/close toggle state (client component)
- `src/components/sidebar/ChatHistoryList.tsx` — server component that fetches and renders conversation list
- `src/components/sidebar/SidebarToggle.tsx` — hamburger button, client component
- `src/app/layout.tsx` MODIFIED — sidebar mounted in layout (persists across navigation), flex layout with sidebar + main content
- `src/app/page.tsx` MODIFIED — `conversationId` state, auto-creates conversation on first message send, handles resume flow from sidebar click (load messages from API)
- "New chat" button creates new conversation, resets `messages` state, clears `conversationId`

**Sidebar interaction with existing page flow:**
- The sidebar lives in `layout.tsx`, not in `page.tsx`. This is critical — `page.tsx` remains the single-page chat interface it has always been.
- When user clicks a past conversation: page.tsx receives the `conversationId` (via URL param or event), fetches messages from `/api/conversations/[id]`, populates `messages` state.
- When user starts a new chat: `conversationId` set to `null`, `messages` reset to `[]`. Sidebar reflects this once a new conversation is created on first message send.
- The sidebar toggle uses CSS transform (`translateX`) not conditional rendering — keeps the server-fetched list mounted and avoids re-fetch on every open.

**Test gate:**
- Open sidebar — past conversations appear
- Click a conversation — chat area repopulates with saved messages
- Generate a preset from resumed conversation — new preset overwrites old `preset_url` in Supabase
- Click "New Chat" — sidebar closes (or stays open), chat area clears, new conversationId assigned on first message send

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users | Current plan works. Supabase free tier (50k MAU). No optimizations needed. |
| 1k–10k users | Add Supabase connection pooling (PgBouncer, already included in Supabase). Cache conversation list with `revalidate` in server components. Consider rate-limiting auth routes. |
| 10k+ users | Supabase Pro tier for higher connection limits and larger storage. Add pagination to conversation list (currently capped at 50). Consider caching conversation lists in Redis (Upstash) to reduce DB load on sidebar renders. |

**First bottleneck:** Supabase free tier pauses projects after 1 week of inactivity. This is a hobbyist-tier concern; upgrade to Pro ($25/month) removes it. Not an architecture problem.

**Second bottleneck:** The conversation list is re-fetched on every navigation that causes a layout re-render. Add `revalidate: 60` to the server component fetch to cache for 60 seconds. For most users, slightly stale sidebar data is acceptable.

---

## Anti-Patterns

### Anti-Pattern 1: Using Auth.js `@auth/supabase-adapter` with Supabase

**What people do:** Install both `next-auth` and `@supabase/supabase-js`, use the community Supabase adapter to store Auth.js sessions in Supabase tables.

**Why it's wrong:** The adapter stores sessions in a separate `next_auth` schema that does not interface with Supabase Auth. This means `signInAnonymously()` and `linkIdentity()` — the core mechanics of the anonymous-first auth requirement — are unavailable. You end up with two separate auth systems. The adapter is not maintained by Supabase.

**Do this instead:** Use native Supabase Auth with `@supabase/ssr`. One package, one auth system, all Supabase features available.

---

### Anti-Pattern 2: Skipping `middleware.ts` Session Refresh

**What people do:** Install Supabase, create server/client utilities, build components — but skip the middleware step because "it's optional."

**Why it's wrong:** Without `middleware.ts` calling `updateSession()` on every request, session cookies expire and are not refreshed. Users randomly get logged out mid-session. The auth state becomes inconsistent between server and client.

**Do this instead:** Add `middleware.ts` at the project root that calls `updateSession()` on every request. This is non-negotiable for cookie-based sessions in Next.js App Router.

---

### Anti-Pattern 3: Storing `conversationId` in the URL Path Instead of State

**What people do:** Change the app from `app/page.tsx` to `app/chat/[conversationId]/page.tsx` to mirror patterns like ChatGPT.

**Why it's wrong for this app:** The existing architecture has a single `page.tsx` with a complex state machine (chat flow → generation → download). Migrating to dynamic routes requires refactoring `page.tsx` into a layout + page hierarchy, re-architecting how state is passed, and changing how the sidebar navigates. This is a major rewrite, not an addition.

**Do this instead:** Keep the single `page.tsx`. Store `conversationId` in React state. Load a conversation when the user clicks it in the sidebar — either via URL search params (`?conversation=abc123`) that `page.tsx` reads on mount, or via a context/event that the sidebar emits. URL search params are simpler and preserve the single-page architecture.

---

### Anti-Pattern 4: Writing Messages to DB Inside the Streaming SSE Loop

**What people do:** Inside the streaming response loop in `/api/chat/route.ts`, write each chunk to the database as it arrives.

**Why it's wrong:** Serverless functions on Vercel should not hold DB connections open for the duration of a stream. Writing per-chunk creates many tiny writes and holds the connection. The stream can be interrupted, leaving a partial message in the database.

**Do this instead:** Accumulate the full streamed response, then write the complete message to the database after the stream closes. The client already handles partial rendering via SSE — the DB write is a completion action, not a streaming action. In `/api/chat/route.ts`, buffer the text and insert one complete row after `controller.close()`.

---

### Anti-Pattern 5: Fetching Conversation List in `page.tsx`

**What people do:** Move the conversation list fetch into `page.tsx` as a `useEffect` that calls `/api/conversations`.

**Why it's wrong:** `page.tsx` re-renders on every navigation. The conversation list would re-fetch on every page visit, even when the user is just continuing an existing chat. The sidebar would flicker on every route change.

**Do this instead:** Fetch the conversation list in `ChatHistoryList.tsx` as a server component mounted in `layout.tsx`. Layouts persist across child navigations — the list is fetched once per layout mount, not per page render. Use `router.refresh()` only when the list actually changes (new conversation created, conversation renamed).

---

## Sources

- Supabase Anonymous Sign-Ins (official): https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Identity Linking (official): https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase `linkIdentity()` JS reference (official): https://supabase.com/docs/reference/javascript/auth-linkidentity
- Supabase Auth with Next.js App Router (official): https://supabase.com/docs/guides/auth/auth-helpers/nextjs
- Setting Up Server-Side Auth for Next.js (official): https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Storage signed upload URLs (official): https://supabase.com/docs/reference/javascript/storage-from-createsigneduploadurl
- Supabase Storage `uploadToSignedUrl` (official): https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl
- Vercel + Supabase Next.js App Router Starter Template: https://vercel.com/templates/next.js/supabase
- Auth.js Supabase adapter limitations (official authjs.dev): https://authjs.dev/getting-started/adapters/supabase
- Auth.js v5 migration guide (official): https://authjs.dev/getting-started/migrating-to-v5
- Next.js App Router authentication guide (official): https://nextjs.org/docs/app/guides/authentication
- Next.js layouts and partial rendering (official): https://nextjs.org/docs/app
- Supabase + Next.js quickstart (official): https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Signed URL uploads with Next.js + Supabase (community, Feb 2025): https://medium.com/@olliedoesdev/signed-url-file-uploads-with-nextjs-and-supabase-74ba91b65fe0
- WorkOS Next.js auth guide 2026 (MEDIUM confidence): https://workos.com/blog/nextjs-app-router-authentication-guide-2026
- Next.js 15 App Router sidebar layout pattern (community, multiple sources, MEDIUM confidence): https://medium.com/@vigneshuthra/how-i-structure-real-world-next-js-apps-using-the-app-router-2025-edition-58a5c8f447fb

---

*Architecture research for: HelixAI v2.0 Persistent Chat Platform — auth, database, file storage integration*
*Researched: 2026-03-03*
