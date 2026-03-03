# Project Research Summary

**Project:** HelixAI v2.0 Persistent Chat Platform
**Domain:** Adding auth, chat persistence, and file storage to an existing stateless Next.js guitar preset generator
**Researched:** 2026-03-03
**Confidence:** HIGH — all four research areas verified against official documentation with multiple corroborating sources

## Executive Summary

HelixAI v2.0 transforms a stateless, anonymous guitar preset generator into a persistent chat platform. The core challenge is additive: every new capability (Google auth, conversation history, file storage, sidebar UI) must layer on top of a fully functional anonymous flow that must not regress. The research is unambiguous on the technology choice — Supabase (Auth + PostgreSQL + Storage) is the single correct vendor for this project. It provides all three required backend capabilities through one isomorphic SDK, is truly free for early-stage usage without requiring a credit card, and its anonymous sign-in with identity linking (`signInAnonymously()` + `linkIdentity()`) is the only clean implementation path for the anonymous-first auth requirement. Firebase is disqualified primarily by its split client/admin SDK architecture, which creates compounding friction throughout Next.js App Router, and by its Cloud Storage free tier now requiring a credit card as of February 2026.

The recommended architecture is a five-phase layered build: Supabase project setup and auth infrastructure first, then the anonymous-to-Google OAuth flow, then conversation CRUD API routes, then persistence wiring into the existing chat and generate routes, and finally the sidebar UI on top. This strict dependency order is enforced by the data model — auth user IDs are the root foreign key, conversation rows must exist before messages can be written, and the sidebar is the outermost display layer that consumes all lower layers. Skipping or reordering phases risks building on unstable foundations that require rework.

The most critical risks are security and regression, not complexity. Supabase Row Level Security must be enabled at table creation time — not retrofitted — because AI-generated code without RLS is a confirmed CVE class (CVE-2025-48757). The anonymous flow performance must be explicitly verified at the end of every phase, because auth infrastructure has documented patterns for silently adding latency to routes that never required auth before. The middleware-only auth bypass (CVE-2025-29927) means every API route handler that accesses user data must independently verify the session in addition to relying on middleware.

---

## Key Findings

### Recommended Stack

Supabase provides Auth, PostgreSQL, and Storage through a single isomorphic SDK (`@supabase/supabase-js` 2.80.0 + `@supabase/ssr` 0.8.0). The same `createClient()` utility pattern works in Server Components, Client Components, Server Actions, and Route Handlers without splitting into client and admin variants. This uniformity eliminates an entire category of friction that disqualifies Firebase for Next.js App Router projects. The `@supabase/ssr` package is the current standard for cookie-based session handling in App Router — the previously common `@supabase/auth-helpers-nextjs` is officially deprecated. Two client factories are needed: a browser client for Client Components and a server client (using the `cookies()` API from `next/headers`) for Server Components and Route Handlers. Middleware at the project root calling `updateSession()` on every request is non-negotiable — without it, JWT tokens expire mid-session and users are silently logged out.

**Core technologies (new additions only):**
- `@supabase/supabase-js@2.80.0` — Auth, database queries, and storage uploads; isomorphic SDK with identical API on server and client
- `@supabase/ssr@0.8.0` — SSR-safe client factory for Next.js App Router; replaces the deprecated `auth-helpers-nextjs`
- No additional packages — no NextAuth, no Clerk, no Prisma, no Firebase; Supabase handles all three concerns natively

**Existing stack (unchanged):** Next.js 14+, TypeScript, Tailwind CSS, Claude Sonnet 4.6 via `@anthropic-ai/sdk`, Zod, Vercel, `browser-image-compression`

### Expected Features

The feature research is grounded in direct analysis of ChatGPT, Claude.ai, and Gemini UX patterns, plus LibreChat and assistant-ui open-source implementations. The v2.0 MVP feature set is well-defined with clear P1/P2/defer boundaries.

**Must have (table stakes — v2.0):**
- Google sign-in — gateway feature; session persists across browser refreshes
- Anonymous flow unchanged — full generate-and-download without login; the most important regression guard
- Conversation list sidebar — pull-out panel showing title + timestamp + device; collapsible on mobile
- New chat button — creates fresh session, auto-saves current chat if authenticated
- Auto-generated conversation title — derived from first user message text; no second AI call needed
- Conversation persistence (messages) — full message history saved per conversation in PostgreSQL
- Device target stored per conversation — `deviceTarget` saved as conversation metadata; critical for correctness on resume
- Resume conversation — reload messages and device context into chat UI; restores AI context via full message history
- Last-preset re-download — most recent `.hlx`/`.pgp` stored in Supabase Storage; "Download Preset" button in resumed chat
- Delete conversation — confirm dialog, optimistic removal from sidebar
- Contextual sign-in prompt — non-blocking prompt after first anonymous preset download

**Should have (competitive differentiators — v2.x):**
- Continuation suggestions on resume — static suggestion chips ("Refine this tone," "Try a different amp") shown on conversation load
- Preset metadata in sidebar — show device type alongside title once device storage is confirmed working
- Conversation search — Postgres full-text search on titles; valuable once users have 10+ chats

**Defer (v3+):**
- Conversation export (JSON/PDF) — GDPR-relevant but not urgent at this scale
- Additional auth providers (GitHub, Apple, email/password) — only if Google proves to be a meaningful barrier
- Cross-conversation memory — different product; changes the AI interaction model entirely

**Explicitly ruled out for this milestone:**
- Real-time cross-tab sync — WebSocket complexity not justified for a single-user sequential tool
- Conversation folders/projects — premature before search is needed
- All preset versions per chat — storage costs accumulate unboundedly; store only the most recent
- Email/password auth — adds reset flows and security surface for no v2.0 benefit
- Chat sharing/permalinks — exposes prompt engineering; the preset file is the shareable artifact

### Architecture Approach

The v2.0 architecture is strictly additive. All existing routes (`/api/chat`, `/api/generate`, `/api/vision`, `/api/map`) are modified with backward-compatible optional parameters — when `conversationId` is absent, they behave identically to v1.3. The critical architectural decision is keeping `page.tsx` as a single-page interface rather than migrating to dynamic routes (`app/chat/[conversationId]/page.tsx`) — that migration would require refactoring the entire state machine and is a rewrite, not an addition. Instead, `conversationId` lives in React state, and URL search params (`?conversation=abc123`) enable deep-linking without route restructuring. The sidebar is mounted in `layout.tsx` (not `page.tsx`) so it persists across navigations without re-mounting and its server-fetched conversation list is not re-fetched on every page render.

The anonymous-first auth uses Supabase's `signInAnonymously()` on mount to assign every visitor a real user ID with `is_anonymous: true`. When the user clicks "Sign in with Google," `linkIdentity()` upgrades the same session — the user ID does not change, so any pre-login data migrates automatically. This requires "Enable Manual Linking" to be turned on in the Supabase Auth dashboard before any code is written.

**Major components:**
1. `middleware.ts` (project root) — session refresh on every request via `updateSession()`; without this, sessions expire mid-session
2. `src/lib/supabase/{server,client}.ts` — two client factory utilities; server client uses `cookies()` from `next/headers`
3. `src/app/auth/callback/route.ts` — PKCE code exchange for Google OAuth and anonymous identity linking
4. `/api/conversations` and `/api/conversations/[id]` — conversation CRUD; list, create, fetch history, update title
5. `src/components/sidebar/ChatSidebar.tsx` + `ChatHistoryList.tsx` — sidebar shell (client) and server component that fetches conversation list directly from Supabase
6. `src/components/auth/AuthButton.tsx` — Google sign-in / avatar / logout reflecting current session
7. Modified `/api/chat` and `/api/generate` — accept optional `conversationId`; persist messages and preset URL when present
8. Supabase Storage — private `presets` bucket, deterministic key `{user_id}/{conversation_id}/latest.hlx` with `upsert: true` to overwrite on regeneration

**Database schema:**
- `conversations` — `id`, `user_id`, `title`, `device`, `preset_url`, `created_at`, `updated_at`
- `messages` — `id`, `conversation_id`, `role`, `content`, `sequence_number`, `created_at`
- RLS enabled on all tables at creation time; storage bucket with RLS on `storage.objects`

### Critical Pitfalls

1. **Auth state hydration mismatch causes UI flicker or crashes** — server renders logged-out UI, client discovers session cookie, React throws hydration error or displays a visible flash. Prevention: fetch session server-side in `layout.tsx` and pass to the client-side session provider as a prop; sidebar must always be present in DOM but conditionally show content, not conditionally mount or unmount.

2. **RLS disabled on tables exposes all user data** — any request with the public anon key can read all conversations and messages via the auto-generated REST API. Prevention: `ALTER TABLE conversations ENABLE ROW LEVEL SECURITY` immediately when creating the table, before any application code; never use `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` — the service role key must never appear in public env vars.

3. **Middleware-only auth allows security bypass** — CVE-2025-29927 (March 2025) demonstrated that Next.js middleware can be bypassed with a crafted header. Prevention: every API route handler that reads or writes user data must independently verify the session; RLS provides a second layer at the database; upgrade to Next.js 15.2.3+.

4. **Anonymous-to-authenticated migration silently loses the current session** — React `useState` is destroyed on OAuth redirect, so an anonymous user's in-progress chat disappears after signing in. Prevention: serialize current chat state to `sessionStorage` before triggering OAuth; restore from `sessionStorage` after the callback completes.

5. **Google OAuth callback URL mismatch breaks production login** — `redirect_uri_mismatch` from Google when the production URL is not registered in Google Cloud Console. Prevention: register both `http://localhost:3000/auth/callback` and the production Vercel URL in Google Cloud Console before writing any auth code; set the production URL as a Vercel environment variable scoped to production.

6. **File storage cost spiral from storing every preset version** — naive implementation saves every generation as a new file, accumulating unbounded storage above Supabase's 1 GB free tier. Prevention: deterministic key `presets/{user_id}/{conversation_id}/latest.hlx` with `upsert: true` overwrites on every generation.

7. **Chat message ordering corruption** — rapid follow-up messages create race conditions when using client-generated `created_at` timestamps for ordering. Prevention: `sequence_number` integer column assigned server-side, never client-side; indexed on `(conversation_id, sequence_number)`.

8. **Performance regression for anonymous users** — auth infrastructure silently adds latency to routes that never required auth before. Prevention: gate every database call on `if (session?.user?.id)`; keep `/api/generate` and `/api/chat` outside the auth middleware matcher; verify anonymous preset generation time is within 5% of v1.3 baseline after every phase.

9. **Supabase free tier pauses after 7 days of inactivity** — project pauses when there is no database activity for 7 days, causing all database-dependent features to fail. Prevention: set up a keep-alive ping (GitHub Actions or Vercel cron job, every 4 days) at project creation time, before any other work.

---

## Implications for Roadmap

The research enforces a strict phase dependency order driven by the data model. Each phase produces independently testable artifacts before the next phase begins.

### Phase 1: Supabase Foundation

**Rationale:** Auth user IDs are the root foreign key for all data. The database schema must exist, RLS must be enabled, and the two client utilities must be built before any user-facing feature can be implemented. Middleware session refresh must be in place before any session-dependent component is rendered. This phase has no prerequisites and can be built on a clean branch of v1.3 with zero impact on existing functionality.

**Delivers:** Supabase project created; PostgreSQL tables (`conversations`, `messages`) with RLS; Storage bucket (`presets`) with RLS on `storage.objects`; `@supabase/supabase-js` and `@supabase/ssr` installed; `src/lib/supabase/{server,client,middleware}.ts`; `middleware.ts` at project root; env vars configured in Vercel; keep-alive cron job deployed.

**Addresses:** RLS pitfall (Pitfall 2) prevented at table creation; connection pooling handled by `supabase-js` REST-based client; Supabase inactivity pause mitigated with keep-alive (Pitfall 9).

**Test gate:** `createSupabaseServerClient()` runs without error; a REST call to `/rest/v1/conversations` with the anon key returns an empty array (not a 403 and not all rows from other users).

**Research flag:** Standard patterns — no deeper research needed. Official Supabase Next.js SSR docs and the Vercel starter template are definitive.

### Phase 2: Auth Flow (Anonymous Sign-In + Google OAuth)

**Rationale:** The auth user ID is the foreign key for all subsequent data writes. No conversation can be saved until a user ID exists. The anonymous-first pattern requires "Enable Manual Linking" in the Supabase dashboard and Google Cloud Console callback URL registration to be completed before any code is tested.

**Delivers:** `src/app/auth/callback/route.ts`; `src/components/auth/AuthButton.tsx`; `page.tsx` modified to call `signInAnonymously()` on mount when no session exists; `layout.tsx` modified to render `AuthButton` and handle hydration-safe session provider setup.

**Addresses:** Anonymous flow preserved with no auth gate on existing functionality; hydration mismatch pitfall resolved at the provider level (Pitfall 1); OAuth callback URL registered before any deployment test (Pitfall 5); defense-in-depth session verification pattern established for all subsequent API routes (Pitfall 3).

**Test gate:** New user gets anonymous session (visible in Supabase Auth dashboard). Google OAuth completes successfully — user record shows email populated, user ID is unchanged from the pre-login anonymous UUID. Hard-refresh the page — logged-in UI appears without any flash of the logged-out state.

**Research flag:** Standard patterns — official Supabase anonymous auth and identity linking docs cover the exact pattern needed.

### Phase 3: Conversation CRUD API Routes

**Rationale:** The sidebar and chat persistence features require a stable data API before any UI or persistence wiring is built. Building the data layer first allows it to be tested independently via a REST client before any frontend depends on it.

**Delivers:** `POST /api/conversations` (create, return `conversationId`); `GET /api/conversations` (list by user, ordered by `updated_at` desc); `GET /api/conversations/[id]` (fetch conversation with all messages, ordered by `sequence_number`); `PATCH /api/conversations/[id]` (update title).

**Addresses:** Conversation list data for sidebar; resume conversation data fetch; auto-title update endpoint.

**Pitfalls to avoid:** Every route handler verifies session independently (Pitfall 3); all queries filtered by `user_id = auth.uid()` as defense in depth beyond RLS; `sequence_number` in messages schema enforced here (Pitfall 7).

**Test gate:** Using curl or Postman: POST a conversation, GET the list, GET the conversation by ID. Verify a request authenticated as a different user gets zero rows, confirming RLS is working.

**Research flag:** Standard patterns — CRUD routes against Supabase are well-documented with official examples.

### Phase 4: Persistence Wiring (Chat + Generate Routes)

**Rationale:** The existing `/api/chat` and `/api/generate` routes are the production core of the app. Modifications must be backward-compatible — anonymous users must receive identical responses to v1.3. Database writes are gated on `conversationId` being present in the request body.

**Delivers:** `/api/chat/route.ts` modified to persist messages when `conversationId` is provided (user message saved before AI call, assistant message saved after stream completes); `/api/generate/route.ts` modified to create signed upload URL and store `preset_url` when `conversationId` is provided; client-side preset upload to Supabase Storage via signed URL.

**Addresses:** Full conversation persistence; last-preset re-download capability; device target stored per conversation.

**Pitfalls to avoid:** Anonymous flow performance regression — gate all DB calls on `if (conversationId)` and verify anonymous generation time baseline (Pitfall 8); file storage cost spiral — use deterministic upsert key (Pitfall 6); message ordering — save user message first with `sequence_number`, assistant message after stream completes (Pitfall 7).

**Test gate:** POST `/api/chat` WITHOUT `conversationId` — response identical to v1.3 with no regression. POST WITH `conversationId` — message appears in Supabase messages table with correct `sequence_number`. POST `/api/generate` WITH `conversationId` — exactly one file in Supabase Storage at the deterministic key, `preset_url` written to conversations row. Anonymous preset generation time within 5% of v1.3 baseline.

**Research flag:** Standard patterns. Signed upload URL pattern for Supabase Storage is documented in official references.

### Phase 5: Chat Sidebar UI

**Rationale:** The sidebar is the outermost display layer. It has no function unless all underlying data layers (Phases 1–4) are stable and tested. Sidebar complexity is primarily state coordination — opening and closing, new chat, resume flow, delete — all of which depend on reliable API routes and auth.

**Delivers:** `src/components/sidebar/ChatSidebar.tsx` (client shell with open/close toggle using CSS transform); `src/components/sidebar/ChatHistoryList.tsx` (server component fetching conversation list directly from Supabase); `src/components/sidebar/SidebarToggle.tsx` (hamburger button client component); `layout.tsx` modified with flex layout and sidebar shell mounted at layout level; `page.tsx` modified with `conversationId` state, auto-creates conversation on first message send, handles resume flow, handles new chat reset; contextual sign-in prompt shown after anonymous preset download.

**Addresses:** All table-stakes features — conversation list, new chat button, delete conversation, resume conversation, auto-generated title display, contextual sign-in prompt.

**Pitfalls to avoid:** Anonymous-to-authenticated state loss — `sessionStorage` serialization before OAuth redirect, restoration after callback (Pitfall 4); sidebar fetched in `layout.tsx` not `page.tsx` to prevent re-fetch on every navigation; `conversationId` stored in React state not URL path to avoid a full page.tsx rewrite.

**Test gate:** Open sidebar — past conversations appear correctly. Click a conversation — chat area repopulates with saved messages and correct device selector. Generate a preset from a resumed conversation — new preset overwrites the previous file in Supabase Storage (one file per conversation confirmed). Click "New Chat" — chat clears, new `conversationId` is assigned on first message send. Start anonymous chat, generate preset, click "Sign in" — pre-login chat state is preserved after OAuth redirect.

**Research flag:** The resume conversation flow is the highest-complexity single feature in this milestone. Before coding this phase, plan explicitly which pieces of state need to be stored (messages, device selector, AI context reconstruction) vs. re-derived, and verify that sending full message history as context to Claude on resume produces acceptable response quality and token cost. Everything else in Phase 5 follows standard sidebar patterns.

### Phase Ordering Rationale

- Dependencies are strict and linear: auth user ID must exist before any conversation row; conversation row must exist before messages can be inserted; data API must be stable before UI is built on top of it.
- Backward compatibility is non-negotiable: Phases 2 through 5 each modify existing routes or components; the anonymous generate-and-download experience must be regression-tested at the end of every phase.
- Security is built in at table creation: RLS in Phase 1 means all subsequent phases benefit from database-level access control without retroactive additions.
- UI is last: all five phases deliver working, testable artifacts before any sidebar pixel is rendered; a broken sidebar cannot compromise the core product because it is layered on top, not woven through it.

### Research Flags

**Needs focused planning before implementation:**
- **Phase 5 — Resume conversation UX:** Restoring full chat state (messages, device selector, substitution cards, signal chain) plus reconstructing AI context for continued conversation is the highest-complexity single feature. Plan which state fields are stored, which are re-derived, and how the AI context window is reconstructed before writing any code.

**Standard patterns — no additional research needed:**
- Phase 1 (Supabase Foundation) — official Next.js App Router + Supabase SSR docs are definitive; official Vercel starter template exists
- Phase 2 (Auth Flow) — official Supabase anonymous auth and identity linking docs cover the exact pattern
- Phase 3 (Conversation CRUD Routes) — standard REST API construction against Supabase
- Phase 4 (Persistence Wiring) — backward-compatible optional parameter pattern and signed upload URL pattern are documented

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Supabase recommendation verified against official docs; Firebase pricing changes confirmed on official Firebase page (Feb 2026); package versions confirmed on npm; Firebase admin SDK bundle size documented from multiple sources |
| Features | HIGH | Based on direct analysis of ChatGPT, Claude.ai, and Gemini UX patterns; official Supabase auth docs; multiple open-source chat implementations (LibreChat, assistant-ui, supabase-community/vercel-ai-chatbot); MVP feature set is clearly defined with explicit P1/P2/defer boundaries |
| Architecture | HIGH | All integration patterns verified against official Supabase and Next.js docs; build order derived from hard data-model dependencies; anti-patterns documented with specific official source citations; existing codebase fully inspected |
| Pitfalls | HIGH (critical), MEDIUM (some) | Critical pitfalls (RLS, hydration mismatch, CVE-2025-29927, connection pooling, Supabase inactivity pause) verified against official sources and confirmed CVEs; anonymous-to-authenticated session preservation is MEDIUM confidence derived from community patterns with no single canonical source; chat ordering recommendations are MEDIUM confidence from architectural analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **Anonymous-to-authenticated state preservation during OAuth redirect:** The `sessionStorage` serialization and restoration pattern is established community practice, but there is no single canonical Next.js + Supabase implementation to reference. Prototype and test against real OAuth redirect behavior — including browser back button edge cases — before Phase 5 is considered complete.

- **Sequence number backfilling:** If the schema is created without `sequence_number` and data accumulates before it is added, backfilling requires an ordered migration job. This gap is avoided entirely by building the schema correctly in Phase 1 — treat it as a hard schema review checkpoint before Phase 3 routes are written.

- **Supabase free tier keep-alive timing:** The 7-day pause window with a 4-day ping interval provides buffer, but the keep-alive behavior should be confirmed against Supabase's actual inactivity detection (calendar days vs. days without any REST activity). Set up and verify in Phase 1 before any other work.

- **Resume conversation AI context quality and cost:** Sending full message history as context on resume is the correct approach, but long conversations (20+ turns) push toward the Claude context window limit and affect token costs. Track `input_tokens` per resumed conversation after launch and establish a pagination or truncation strategy if costs become significant.

---

## Sources

### Primary (HIGH confidence)

- Supabase SSR official docs — two client types, middleware pattern: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Google OAuth guide — provider setup, Server Action, callback route: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Anonymous Sign-Ins (official): https://supabase.com/docs/guides/auth/auth-anonymous
- Supabase Identity Linking (official): https://supabase.com/docs/guides/auth/auth-identity-linking
- Supabase Storage JS reference — upload, upsert, signed URLs: https://supabase.com/docs/reference/javascript/storage-from-upload
- Supabase pricing page (verified 2026-03-03): https://supabase.com/pricing
- Firebase Cloud Storage pricing change — Blaze plan required Feb 3, 2026: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Next.js App Router authentication guide (official): https://nextjs.org/docs/app/guides/authentication
- ChatGPT chat and file retention policies: https://help.openai.com/en/articles/8983778-chat-and-file-retention-policies-in-chatgpt
- CVE-2025-48757 — Supabase RLS missing in AI-generated code; 170+ affected applications
- CVE-2025-29927 — Next.js middleware bypass via crafted header; patched in Next.js 15.2.3+

### Secondary (MEDIUM confidence)

- Firebase vs Supabase 2026 comparison — MakerKit: https://makerkit.dev/blog/saas/supabase-vs-firebase
- Optimistic Updates for Conversation Deletion — OpenHands production implementation: https://github.com/All-Hands-AI/OpenHands/pull/6745
- Supabase + Next.js AI Chatbot reference implementation: https://github.com/supabase-community/vercel-ai-chatbot
- Comparing Conversational AI Tool UIs 2025 — IntuitionLabs (editorial): https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025
- Chainlit Chat Persistence docs — auth and persistence co-dependency: https://docs.chainlit.io/data-persistence/history
- WorkOS Next.js App Router auth guide 2026: https://workos.com/blog/nextjs-app-router-authentication-guide-2026

---

*Research completed: 2026-03-03*
*Ready for roadmap: yes*
