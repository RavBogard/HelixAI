# Pitfalls Research

**Domain:** Adding auth, chat persistence, and file storage to existing stateless Next.js app (HelixAI v2.0)
**Researched:** 2026-03-03
**Confidence:** HIGH for auth hydration/SSR issues (official Next.js docs + nextauth GitHub); HIGH for Vercel connection pooling (official Vercel docs + Vercel KB); HIGH for Supabase RLS risks (Supabase official docs + confirmed CVE-2025-48757); HIGH for OAuth redirect pitfalls (official NextAuth GitHub issues + Next.js deployment guides); MEDIUM for anonymous-to-authenticated migration (derived from Better Auth/NextAuth docs and community patterns, no single canonical source); MEDIUM for chat ordering (derived from architectural analysis + Ably/CockroachDB engineering blog posts)

> This document supersedes the v1.3 pitfalls document (vision/rig emulation). The focus here is the risks of adding Google authentication, Supabase database persistence, Supabase Storage for .hlx/.pgp files, and a chat sidebar UI to an app that is currently fully stateless. The v1.3 document covered vision upload and mapping risks; those remain valid and are not repeated here.

---

## Critical Pitfalls

These cause broken features, security exposures, data loss, or silent regressions.

---

### Pitfall 1: Auth State Hydration Mismatch Causes UI Flicker or Crashes

**What goes wrong:** The server renders the page without auth state (because it does not know if the user is logged in at render time), sending HTML with the logged-out UI (no sidebar, no user avatar, anonymous-flow controls). React then hydrates on the client, discovers the session cookie, and renders the logged-in UI. The mismatch either produces a React hydration error that crashes the page, or produces a visible flash where the logged-out state is displayed for 0.5–2 seconds before the logged-in state appears. On every page load, authenticated users see the anonymous UI before the authenticated UI.

**Why it happens:** When using the Next.js App Router, Server Components render at request time. If the session is not read server-side (from the cookie) and passed into `SessionProvider`, the server-rendered HTML reflects the logged-out state. The client then has a different opinion because `useSession()` returns an active session from the cookie. React flags the mismatch. The fix — reading the session server-side and passing it to `SessionProvider` — is non-obvious and is absent from many tutorials.

The specific failure pattern for this project: the sidebar is conditionally rendered based on `session !== null`. If the server renders no sidebar and the client then renders a sidebar, the DOM structure differs and React errors. If the sidebar is always rendered (but in a "loading" state) on the server, the flash is visual-only rather than a crash — but still unacceptable as the primary login flow for the app.

**How to avoid:** In `layout.tsx`, fetch the session server-side using `auth()` (for NextAuth v5/Auth.js) or Supabase's `createServerClient()` (for Supabase Auth) and pass it directly to the client-side session provider as a prop. This means the server and client render the same initial state. The sidebar should not conditionally mount/unmount based on auth state — instead, it should always be present in the DOM but conditionally show content based on session data that is pre-loaded. Any component that needs to show user-specific content (avatar, chat list) should use `useEffect` or be wrapped in a Suspense boundary with a skeleton state rather than rendering differently on server vs. client.

```typescript
// layout.tsx — server component
const session = await auth(); // read server-side
return (
  <SessionProvider session={session}>  // pre-hydrate client
    {children}
  </SessionProvider>
);
```

**Warning signs:**
- React console error: "Hydration failed because the initial UI does not match what was rendered on the server"
- Sidebar flickers into existence on every page load for logged-in users
- The logged-out UI is briefly visible before the logged-in UI after a page refresh

**Phase to address:** Auth Phase — first phase of v2.0. Session provider setup is the first thing built. Getting hydration right from day one prevents cascading UI bugs in all subsequent phases.

---

### Pitfall 2: Vercel Serverless Cold Starts Exhaust or Leak Database Connections

**What goes wrong:** Each Vercel serverless function invocation that touches the database opens a new connection. On the free Hobby plan with default settings, functions spin down after a period of inactivity and spin up fresh on the next request. Each cold start opens a new database connection. On Supabase's free plan, the maximum concurrent connections to the connection pooler is 200. After a traffic spike (or after a Vercel deployment where old function instances are suspended), open connections are held as "phantom" connections — the function is suspended but the connection is not cleanly closed. Supabase sees the connection as still open. If 50+ phantom connections accumulate, new requests fail with "too many connections" errors that look like database outages.

**Why it happens:** Traditional database drivers (`pg`, Prisma's default `client`) hold a persistent TCP connection. In a long-running server process this is correct. In a serverless function, the process is ephemeral — but the TCP connection on the database side remains open until it times out, which can take minutes. If your function is called 100 times in a burst, 100 connections are opened. Even if each closes after the function returns, there is a window where all 100 are simultaneously open. Supabase's free plan cannot handle this without a connection pooler configured for transaction-mode pooling.

**How to avoid:** Use Supabase's built-in connection pooler in **transaction mode** (port 6543, not 5432). Transaction-mode pooling returns the connection to the pool after each statement completes, making it compatible with serverless. With Supabase, the connection string for serverless is the pooler URL (`db.[ref].pooler.supabase.com:6543/postgres?pgbouncer=true`), not the direct database URL. The Supabase JS client (`@supabase/supabase-js`) uses the REST API (PostgREST) by default, which is HTTP-based and sidesteps the connection issue entirely — use this for all application queries. Only use the direct database connection for migrations, which run in long-lived CI environments, not serverless functions.

Enable Vercel Fluid Compute to allow multiple concurrent requests to share a single warm function instance. When Fluid Compute reuses an instance, the database client initialized at module scope is also reused — removing the per-invocation connection cost entirely. This is a significant reduction in connection overhead.

**Warning signs:**
- Supabase dashboard shows connection count approaching 200 (the free plan limit)
- Database queries fail with `FATAL: remaining connection slots are reserved` errors
- Errors occur in bursts immediately after deploying a new version (old function instances suspend without closing connections)

**Phase to address:** Auth Phase / Database Phase — whichever introduces the first Supabase database query. The connection strategy must be decided before any database calls are written. Switching from direct connection to pooler URL after launch requires updating all connection strings and testing migration behavior.

---

### Pitfall 3: Supabase RLS Disabled or Misconfigured Exposes All User Chats Publicly

**What goes wrong:** Row Level Security (RLS) is disabled by default on all new Supabase tables. If the `chats` and `messages` tables are created without enabling RLS, any user (or unauthenticated request with the public anon key) can read all chats from all users via the auto-generated REST API. A `GET /rest/v1/chats` request with no user filter returns every chat in the database. The data exposure happens silently — no error, just data that should be private being returned to anyone who makes the request.

The second failure mode: RLS is enabled but policies are incomplete. A common gap is creating a SELECT policy (so users can read their own chats) but forgetting an INSERT policy (so writing fails with an opaque empty-result error) or forgetting WITH CHECK on the UPDATE policy (so users can read their own chats, write to their own chats, but could potentially update a chat to assign it to a different user_id).

The third failure mode: a developer accidentally uses the `service_role` key in client-side code. The service role key bypasses all RLS. Any client that has the service role key has god-mode access to all data.

**Why it happens:** Supabase makes RLS opt-in, not opt-in-by-default. The table creation SQL does not include RLS unless explicitly added. When prototyping, developers often skip RLS to avoid the configuration overhead and forget to add it before launch. In 2025, a CVE (CVE-2025-48757) affecting 170+ Lovable-generated applications was disclosed because AI code generators were creating tables without RLS. The Supabase dashboard shows a warning for tables without RLS, but the SQL Editor does not.

**How to avoid:** Enable RLS immediately when creating any table that holds user data, before writing any application code:

```sql
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_files ENABLE ROW LEVEL SECURITY;

-- Example policy pattern — scope every policy by auth.uid()
CREATE POLICY "Users can only see their own chats"
  ON chats FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can only insert their own chats"
  ON chats FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
```

Only the public anon key should ever appear in client-side environment variables (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). The service role key must only appear in server-side environment variables and never in any `NEXT_PUBLIC_*` variable. Use Supabase's Security Advisor (dashboard → Database → Security Advisor) after creating tables to verify no tables are exposed.

**Warning signs:**
- Supabase dashboard Security Advisor shows red warnings for any table
- A test request with `curl -H "apikey: [anon key]" [supabase-url]/rest/v1/chats` returns data without a user filter
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` appears in any environment variable name (the key should never be NEXT_PUBLIC)

**Phase to address:** Database Phase — the first phase that creates tables. RLS policies must be written as part of the same migration that creates the table. Adding RLS after table creation and after data is present is higher risk because existing rows must be audited.

---

### Pitfall 4: Anonymous-to-Authenticated Migration Silently Loses the Current Session

**What goes wrong:** A user completes a tone interview anonymously, generates a preset, then decides to log in to save it. The login flow redirects through Google OAuth, the callback URL creates/restores the authenticated session, and the user lands back on the app. The in-progress chat conversation and the generated preset that were in React state are gone. State was held in component state (`useState`) with no persistence — the OAuth redirect wiped it. The user has to start over. They are unlikely to try logging in again during a session after experiencing this.

The secondary failure: the app does implement anonymous-to-authenticated migration, but the user's anonymous chat history is not linked to their new authenticated account. The sidebar shows an empty history even though they completed a chat before logging in.

**Why it happens:** React component state is ephemeral — a full-page navigation (which OAuth redirects require) destroys it. The standard OAuth redirect flow for Google (`/api/auth/signin/google`) always does a full redirect. Preserving in-progress state across this redirect requires explicit persistence (localStorage, sessionStorage, or a URL parameter) before the redirect and restoration after the callback.

The anonymous session identity (a temporary ID for tracking the pre-login chat) must be explicitly passed to the auth callback so the backend can associate the pre-login data with the newly authenticated user. Without this, the anonymous session and the authenticated user are unlinked.

**How to avoid:** Before triggering the Google OAuth sign-in, serialize the current chat state to `sessionStorage`. After the OAuth callback completes and the user is authenticated, read `sessionStorage` in the root layout's `useEffect` and restore the pending chat state. This must happen before the sidebar and chat list render to prevent a flash of empty state.

For linking pre-login chats to authenticated users: use a stable anonymous session ID (stored in a cookie with a long expiry). When the user authenticates, include the anonymous session ID in the sign-in callback. In the `signIn` callback (NextAuth) or equivalent Supabase hook, migrate any chats associated with that anonymous ID to the authenticated user's ID.

Design the database schema to support this: a `chats` table with a nullable `user_id` and a separate `anon_session_id` field. After login, run an `UPDATE chats SET user_id = [authenticated_id] WHERE anon_session_id = [pre-login session id]`.

**Warning signs:**
- In-progress chat disappears when the user clicks "Sign In"
- After login, the sidebar shows empty history even for users who had active sessions
- `sessionStorage` is never written before the OAuth redirect
- The `signIn` callback does not receive or handle an anonymous session ID

**Phase to address:** Auth Phase — the sign-in flow must include the migration design from the start. Adding anonymous session migration after the auth flow is live requires a database migration to add the `anon_session_id` field and re-testing the entire login flow.

---

### Pitfall 5: Google OAuth Callback URL Mismatch Breaks Production Login

**What goes wrong:** Login works perfectly in local development (`http://localhost:3000/api/auth/callback/google`). After deploying to Vercel, the first login attempt fails with a `redirect_uri_mismatch` error from Google. No users can log in. The error is cryptic to end users — it shows a Google error page, not the app's error page. The Vercel deployment URL (`https://helixai.vercel.app`) was never added to Google Cloud Console's Authorized Redirect URIs. Or it was added, but with a trailing slash or wrong path segment, which Google rejects as an exact mismatch.

The secondary failure: Vercel preview deployments each get a unique URL (`https://helixai-git-branch-user.vercel.app`). Google Cloud Console does not support wildcard redirect URIs. Every preview deployment URL must be manually added to the Google console, or preview deployments cannot test the auth flow at all.

**Why it happens:** Google OAuth is strict about redirect URIs — it performs an exact string match including protocol, domain, port, path, and trailing slash. Developers test locally, get the localhost URI working, then forget to add the production URI to the Google console before deploying. The environment variable `NEXTAUTH_URL` (or its equivalent in the chosen auth library) must also match the production domain exactly, or the session cookie domain will mismatch and the cookie will not be set.

**How to avoid:** Before deploying to production for the first time, add all target URLs to Google Cloud Console:
- `https://helixai.vercel.app/api/auth/callback/google` (production)
- `http://localhost:3000/api/auth/callback/google` (development)

Set `NEXTAUTH_URL=https://helixai.vercel.app` (or the custom domain) in Vercel's environment variables, under the Production environment scope only. For preview deployments, add `NEXTAUTH_URL_INTERNAL` or use the Vercel system variable `VERCEL_URL` to construct the callback URL dynamically. Do not use `http://` in production — Google requires HTTPS for all non-localhost redirect URIs.

Verify the callback path matches the auth library version: NextAuth v4 uses `/api/auth/callback/google`, Auth.js v5 / Better Auth may use different paths. Check the library documentation before registering with Google.

**Warning signs:**
- Google shows `Error 400: redirect_uri_mismatch` on login
- Login works on localhost but fails on the deployed URL
- The URL shown in the Google error message does not exactly match what is registered in the Google console
- `NEXTAUTH_URL` is not set as a Vercel environment variable

**Phase to address:** Auth Phase — before any production deployment of the auth flow. The Google Cloud Console setup and the Vercel environment variable must be configured as the first action in the auth phase, before writing any code.

---

### Pitfall 6: Supabase Free Tier Pauses After 7 Days of Inactivity, Breaking Production

**What goes wrong:** The app launches. Usage is light initially (as expected for a v2.0 launch). After a week with fewer than 7 days of user activity, Supabase pauses the project. The next user who tries to sign in or load their chat history gets a database connection error. The app appears broken. Reactivating the project from the dashboard takes 30–60 seconds, during which all database operations fail. Supabase sends warning emails, but if the developer is not monitoring email, the downtime is discovered when users report errors.

**Why it happens:** Supabase's free plan pauses projects after 7 days of no database activity to reclaim resources. This is documented but often missed because the free plan is used for early-stage products that may have irregular usage. A product that is "live" but has infrequent users (e.g., launched but not yet marketed widely) can hit this limit even after the first week.

**How to avoid:** Set up a keep-alive mechanism before launching, not after the first pause happens. Options:
- A GitHub Actions scheduled workflow that runs every 4 days and makes a simple Supabase REST API call (e.g., `SELECT 1` via the REST endpoint)
- A Vercel cron job (`/api/cron/ping-db`) configured in `vercel.json` to run every 4 days
- An Upstash or cron-job.org scheduled task that hits the Supabase health endpoint

The keep-alive does not need to write data — any authenticated read request keeps the project active. Set the interval to every 4 days to provide buffer against the 7-day limit.

For the longer term, plan the $25/month Supabase Pro upgrade before significant user adoption. The Pro plan does not pause projects, includes daily backups, and raises connection limits significantly.

**Warning signs:**
- Supabase dashboard shows project status as "Paused"
- All database-dependent features fail simultaneously with connection errors
- Supabase sends emails with subject "Your project is about to be paused" — these are the early warning

**Phase to address:** Database Phase — the keep-alive mechanism must be set up immediately when the Supabase project is created, before any other work. It takes 10 minutes to configure and prevents the most embarrassing possible production failure.

---

### Pitfall 7: Middleware-Only Auth Allows Security Bypass

**What goes wrong:** The auth protection is implemented only in `middleware.ts`: routes that require authentication (e.g., `/api/chats`, `/api/messages`) check for a valid session in the middleware and redirect unauthenticated requests. This feels complete — all protected routes are listed in the middleware config. However, CVE-2025-29927 (disclosed March 2025) demonstrated that Next.js middleware can be bypassed by sending a crafted `x-middleware-subrequest` header. Any attacker can access the protected API routes directly, bypassing the middleware check entirely, and read or write any user's chat data if the database queries do not also enforce ownership.

More practically for this project: even without the CVE, middleware runs on the edge and the database is accessed in serverless functions. The middleware can be tricked, load-balanced around, or misconfigured. If the API route handler itself does not verify the session, a request that bypasses middleware goes through.

**Why it happens:** Developers treat middleware as a complete auth gate because it is the most visible layer. The Next.js docs present middleware as the primary auth mechanism for route protection, which leads developers to stop there. The Data Access Layer pattern — verifying auth at the point of database access — is less visible in tutorials but is the only reliable protection.

**How to avoid:** Every API route handler that reads or writes user data must independently verify the session:

```typescript
// /api/chats/route.ts
export async function GET(request: Request) {
  const session = await auth(); // verify session here, not only in middleware
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Database query scoped to session.user.id
  const chats = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', session.user.id); // always filter by authenticated user
}
```

Middleware can still be used for redirect UX (bouncing unauthenticated users to the login page), but it must not be the only security layer. RLS policies in Supabase provide a second layer at the database level. API route session checks provide a third layer. Defense in depth: at least two of these three layers must be active at all times.

Also: upgrade to Next.js 15.2.3+ which patches CVE-2025-29927. Vercel's edge network already strips the malicious header for hosted deployments, but the patch is still required for correctness.

**Warning signs:**
- API routes return data without checking `session.user.id` in the handler itself
- A test request with no auth cookie reaches an API handler and gets a 200 response instead of 401
- Middleware config is the only place user authorization is checked

**Phase to address:** Auth Phase — security architecture must be designed before any API routes are written. Adding auth checks to API routes after writing them without auth requires auditing every route individually, which is error-prone.

---

### Pitfall 8: File Storage Costs Spiral from Storing Every Preset Version

**What goes wrong:** Every time a user regenerates a preset (tweaking the tone, adding effects, changing the amp), a new `.hlx` or `.pgp` file is generated. If the implementation stores every generated file in Supabase Storage (or any cloud storage), each conversation accumulates multiple versions. A user who iterates 10 times on a preset stores 10 files. At 50–200KB per file, this is manageable. But if 500 users each have 10 conversations with 5 regenerations each, that is 25,000 files — 1.25–5GB of storage, well above Supabase's free plan 1GB storage limit, and incurring bandwidth egress costs each time files are downloaded.

The secondary problem: the PROJECT.md decision already establishes "Save last preset per chat (not all versions)." If the implementation violates this by naively appending every generated file, storage costs accumulate without corresponding user value.

**Why it happens:** The natural implementation path is: generate preset → save to storage → return download URL. Each generation triggers a save. Without explicit "overwrite the previous version" logic, each generation creates a new file object in storage. Object storage does not automatically deduplicate or overwrite unless you use a deterministic key.

**How to avoid:** Use a deterministic storage key per conversation that overwrites on each generation:

```
preset_files/{user_id}/{chat_id}/latest.hlx
preset_files/{user_id}/{chat_id}/latest.pgp
```

Using this key scheme, `supabase.storage.from('presets').upload(key, file, { upsert: true })` overwrites the previous file on every generation. Only the most recent preset per chat is ever stored, regardless of how many times the user regenerates. This matches the intended behavior and prevents storage accumulation.

Apply Supabase Storage RLS policies so only the owning user can read their preset files:
```sql
CREATE POLICY "Users can access their own preset files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'presets' AND auth.uid()::text = (storage.foldername(name))[1]);
```

**Warning signs:**
- Storage bucket contains multiple files per chat ID (e.g., `chat123/v1.hlx`, `chat123/v2.hlx`, `chat123/v3.hlx`)
- Total storage usage grows faster than the number of active users
- No `upsert: true` flag in the storage upload call

**Phase to address:** File Storage Phase — the storage key scheme and upsert strategy must be defined in the initial implementation. Retrofitting it requires deleting orphaned files (requires a migration job) and changing the upload logic.

---

### Pitfall 9: Chat Message Ordering Breaks When Messages Are Saved Asynchronously

**What goes wrong:** The streaming AI response arrives in chunks. The implementation saves each message to Supabase as a complete message only after the full response is received. However, if the user sends two rapid follow-up messages while the first response is still streaming, the message ordering in the database can become: `user_msg_2 → user_msg_1 → assistant_response_1 → user_msg_3`. When the chat is reloaded from the database later, the conversation makes no sense because the messages appear out of order.

The secondary failure: if messages are assigned `created_at` timestamps using `Date.now()` on the client, clock drift between the user's device and the server can cause messages to appear out of order when sorted by timestamp.

**Why it happens:** Serverless functions handling streaming responses are asynchronous. If the user does not wait for a response before sending another message, multiple concurrent write operations race to the database. `created_at` timestamps have millisecond resolution, and two rapid messages can get the same or reversed timestamps if the client clock is not synchronized.

**How to avoid:** Use an explicit `sequence_number` integer column on the `messages` table, not `created_at`, as the primary sort field. The sequence number is assigned server-side (as an auto-incrementing value or a counter maintained per conversation) and is never determined by the client. This guarantees ordering is determined by insertion order on the server, not by client timestamps.

For the specific case of streaming responses: save the user's message to the database immediately when received (before beginning the AI response). Save the assistant's message after the stream completes. This ensures the user message always has a lower sequence number than the subsequent assistant response, regardless of timing.

The chat sidebar resume feature reads messages sorted by `sequence_number ASC` — this field must be indexed: `CREATE INDEX messages_sequence_idx ON messages(chat_id, sequence_number)`.

**Warning signs:**
- Resumed conversations show messages in wrong chronological order
- The chat history makes logical sense when read live but is jumbled when reopened
- Messages table has no `sequence_number` column and relies only on `created_at` for ordering

**Phase to address:** Database Phase — the schema must include `sequence_number` from day one. Adding an ordering column to an existing table with data requires backfilling sequence numbers, which is error-prone.

---

### Pitfall 10: Performance Regression for Anonymous (Non-Logged-In) Users

**What goes wrong:** Adding auth infrastructure causes measurable regressions for users who never log in. The most common ways this happens:

1. Every page load now calls a session check (even when the user has no session), adding 50–200ms database latency to every request.
2. The `SessionProvider` wraps the entire app and triggers a client-side session fetch on every mount, even for anonymous users where it always returns null.
3. The chat API route now queries the database to check "does this user have an existing chat to append to?" on every message, even for anonymous users who have no chat in the database.
4. The new Supabase client import adds bundle size that is loaded for all users, including those who never authenticate.

The existing v1.0–v1.3 product has no database dependency. Adding auth infrastructure must not add latency to the anonymous flow, which is the primary user experience for first-time visitors.

**Why it happens:** Auth libraries (NextAuth, Supabase Auth) run session checks on every request by default. If middleware is configured to run globally (`matcher: ['/:path*']`), the session check runs for all requests including anonymous page loads and API calls. Database queries that check for existing user context run even when there is provably no user context.

**How to avoid:** Gate every database call on the presence of an authenticated session. The anonymous flow must touch zero database infrastructure:

```typescript
// API route pattern — no db calls for anonymous users
const session = await auth();
if (session?.user?.id) {
  // Database operations for authenticated users only
  await saveChatMessage(session.user.id, chatId, message);
}
// Anonymous path — no database interaction
```

Configure middleware to run only on routes that require auth, not on the anonymous generate/chat flow. The existing `/api/generate` and `/api/chat` routes must not be added to the middleware matcher. Middleware should only protect `/api/chats`, `/api/messages`, and any user-profile routes.

Use code splitting: the Supabase client should be imported only in modules that are actually used in the authenticated path, not in the shared layout or in anonymous-facing components.

**Warning signs:**
- The anonymous preset generation flow takes longer after v2.0 than it did in v1.3
- Network tab shows a session check request firing on every page load, including anonymous ones
- The middleware matcher includes `/api/generate` or `/api/chat`

**Phase to address:** All phases of v2.0 — every phase must include explicit verification that the anonymous flow is unaffected. The end of each phase should have a regression test: "generate a preset without logging in and confirm the time-to-preset is within 5% of v1.3 baseline."

---

## Technical Debt Patterns

Shortcuts that could be introduced while adding auth and persistence to the existing system.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Store messages as a JSON blob in a single `chat` column | No separate `messages` table needed | Cannot query individual messages; cannot paginate; cannot sort; resume feature requires loading the entire chat | Never — separate messages table from day one |
| Use `service_role` key in Next.js API routes | Bypasses RLS complexity during development | If the key ever leaks (client bundle, git commit, etc.), the entire database is exposed to anyone | Never in client-facing code; only in migration scripts |
| Skip sequence numbers, rely on `created_at` for message ordering | Simpler schema | Client clock drift and concurrent writes cause ordering bugs; cannot be fixed without data migration | Never for chat ordering |
| Enable RLS later, after prototyping | Faster initial development | All tables are publicly accessible while RLS is disabled; security hole in production if pushed prematurely | Never — enable RLS at table creation |
| Store every preset version instead of overwriting | No "latest" tracking logic needed | Storage costs accumulate per regeneration; violates the "last preset per chat" design decision | Never — use deterministic key + upsert |
| Implement auth protection only in middleware | One place to maintain | CVE-2025-29927 bypass; any middleware misconfiguration exposes all data | Never for data-access security; middleware is fine for redirect UX only |
| Poll the database for chat list updates instead of real-time subscription | Simpler than Supabase Realtime | Polling adds constant database load; real-time is supported for free by Supabase and is the correct approach for sidebar updates | Acceptable as MVP-phase approach if real-time is deferred, but plan to replace |
| Save the full AI streaming response as one message after completion | Simpler message storage logic | If the user navigates away mid-stream, the message is lost; progressive save during streaming is more resilient | Acceptable for MVP — losing a partial response is recoverable since the user can regenerate |

---

## Integration Gotchas

Common mistakes when connecting auth, database, and storage to the existing system.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| NextAuth / Supabase Auth + App Router `SessionProvider` | Wrapping the layout without passing server-fetched session | `await auth()` in the server layout component and pass as prop to `SessionProvider` to prevent hydration mismatch |
| Supabase client in API routes | Creating a new `createClient()` instance on every request | Use a singleton pattern or the `createServerClient` helper with request-scoped cookies; do not re-create the client per request |
| Google OAuth callback URL | Registering localhost URL but not production URL in Google Cloud Console | Register both URLs before writing any code; the Google console setup is a prerequisite, not an afterthought |
| Supabase Storage RLS | Creating storage bucket without a RLS policy | Storage objects are also subject to RLS; create `storage.objects` policies scoped to `auth.uid()` |
| Chat message foreign keys | `messages.chat_id` references `chats.id` but `chats.user_id` is not validated in the messages table | RLS policy on `messages` must join through `chats` to verify the authenticated user owns the parent chat — not just that the chat exists |
| Anonymous session ID | Generating the anonymous session ID client-side with `Math.random()` | Use a cryptographically random UUID (`crypto.randomUUID()`) stored in a cookie with a long expiry; client-side randomness is predictable |
| Supabase connection in migration scripts | Using the Supabase JS client (REST API) for migrations | Migrations must use the direct database connection string (port 5432), not the pooler URL; Prisma/`pg` connect directly for DDL operations |
| File storage download | Generating a long-lived public URL for preset files | Use signed URLs with short expiry (1 hour) generated server-side after session verification; public URLs bypass RLS |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Session check on every anonymous API call | Anonymous generation takes 50–200ms longer after v2.0 | Gate all db calls on `if (session?.user?.id)` — skip entirely for anonymous | From day one if middleware or API routes run auth checks unconditionally |
| Loading the entire chat message history to resume a conversation | Long chats (50+ messages) take 2–3 seconds to load on resume | Paginate: load the last 20 messages on resume, with "load more" for older history; index `messages` by `(chat_id, sequence_number)` | Any chat with 30+ messages |
| Fetching the full chat list for the sidebar on every page navigation | Sidebar reload adds 300–500ms to every page change | Cache the chat list in React state after the first load; update optimistically on new chat creation; use Supabase Realtime for additions | Any user with 10+ chats |
| Storing base64 preset data in the database instead of file storage | Message payload too large for database row | Preset files (.hlx/.pgp at 50–200KB) must go to Supabase Storage, not database columns; store only the Storage URL in the database | First time a preset is generated and stored as a DB column |
| N+1 queries in the chat list: fetching messages count per chat individually | Sidebar takes 500ms–3s to populate for users with many chats | Use a single JOIN query: `SELECT chats.*, COUNT(messages.id) as message_count FROM chats LEFT JOIN messages ON messages.chat_id = chats.id GROUP BY chats.id` | Any user with 5+ chats |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting `user_metadata` from JWT in RLS policies | Users can modify their own `user_metadata` claims; a policy using these values can be exploited to access other users' data | Use only `auth.uid()` in RLS policies — never `user_metadata` claims for ownership checks |
| Exposing `service_role` key as a `NEXT_PUBLIC_` variable | Any user can read `NEXT_PUBLIC_` env variables from the browser; service role bypasses all RLS | `SUPABASE_SERVICE_ROLE_KEY` must never have the `NEXT_PUBLIC_` prefix; only `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_URL` belong in public vars |
| Using shared chat IDs that are predictable (sequential integers) | A user who knows one chat ID can guess adjacent chat IDs and attempt to read other users' chats | Use UUIDs (`gen_random_uuid()`) for all `chat_id` and `message_id` values — not sequential integers |
| Allowing unauthenticated access to signed storage URLs by caching them | A signed URL cached in the browser is valid for its full expiry window; if shared or leaked it provides access to the user's preset file | Set signed URL expiry to 1 hour maximum; do not store signed URLs in the database — generate them on-demand per request |
| Not validating chat ownership in resume flow | A user who intercepts another user's `chat_id` (e.g., from a leaked URL) can resume their conversation | Every API route that accepts a `chat_id` must verify `WHERE chats.user_id = auth.uid() AND chats.id = [chat_id]` — not just `WHERE chats.id = [chat_id]` |
| Middleware-only auth on API routes (see Pitfall 7) | CVE-2025-29927 allows bypassing middleware; unprotected API route handlers expose all data | Verify session in every API route handler that accesses user data; run on Next.js 15.2.3+ |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing login prompt immediately on first visit | Blocks anonymous users from the core value; contradicts the "anonymous-first" design | Never prompt for login until the user attempts an action that requires it (e.g., clicking "Save chat" or the sidebar) |
| Clearing the chat on login without warning | User loses the in-progress conversation when they sign in mid-session | Persist the anonymous chat to `sessionStorage` before the OAuth redirect; restore it after the callback |
| Empty sidebar state with no guidance | Logged-in user with no chat history sees a blank sidebar with no explanation | Show a "No chats yet — start generating your first preset" state with a direct CTA |
| No visual distinction between anonymous and authenticated mode | Users do not know that login would save their chats | Subtle persistent indicator: "Generating anonymously — sign in to save" visible below the chat, without blocking the flow |
| Auto-loading the sidebar on mobile for authenticated users | Sidebar overlay obscures the chat on small screens | Sidebar is collapsed by default on mobile; authenticated users see a hamburger menu, not an open panel |
| Resume conversation with no indication of where the conversation left off | Long chats open at the top (oldest message); user has to scroll to find the last exchange | Scroll to the bottom on resume; highlight the last user action with a subtle "Last session" marker |

---

## "Looks Done But Isn't" Checklist

- [ ] **Auth hydration:** Log in, then hard-refresh the page. The logged-in UI (sidebar, user avatar) must appear immediately without any flash of the logged-out state.
- [ ] **RLS enforcement:** With a logged-in session, make a direct REST API call to `/rest/v1/chats` without a user filter. Confirm it returns only that user's chats, not all chats.
- [ ] **Anonymous flow unaffected:** Generate a preset without logging in. Confirm the time from first message to downloadable file is within 5% of the v1.3 baseline. Confirm no database calls appear in Supabase logs for this session.
- [ ] **Anonymous-to-authenticated migration:** Start a chat anonymously, generate a preset, then sign in. Confirm the pre-login chat appears in the sidebar and the pre-login preset download still works.
- [ ] **Preset file overwrite:** Generate a preset, then generate a second preset in the same chat. Confirm Supabase Storage shows exactly one file per chat, not two.
- [ ] **Chat ordering after resume:** Open a resumed chat. Confirm messages appear in the correct chronological order. Do this for a chat where the user sent rapid follow-up messages.
- [ ] **Connection count:** Under moderate load (10 concurrent users each generating a preset), check Supabase dashboard connection count. Confirm it does not spike above 50 connections.
- [ ] **Google OAuth production:** Deploy to Vercel and attempt a Google login from the production URL. Confirm no `redirect_uri_mismatch` error. Confirm `NEXTAUTH_URL` is set to the production URL in Vercel's environment variables.
- [ ] **Supabase keep-alive:** Wait 5 days without touching the project. Confirm the project is still active (not paused). This requires the keep-alive mechanism to be live.
- [ ] **Signed URL access control:** Generate a signed preset download URL. Log out. Attempt to access the signed URL. After expiry (1 hour), confirm the URL returns 403.
- [ ] **Service role key location:** Search the codebase for `SUPABASE_SERVICE_ROLE_KEY`. Confirm it only appears in server-side files, never in files that import from `"next/headers"` or are used in `"use client"` components.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Auth hydration mismatch causing UI flicker | LOW | Add server-side session fetch to layout; pass session prop to SessionProvider; redeploy |
| Supabase connection exhaustion | MEDIUM | Switch connection string to pooler URL (port 6543); enable Vercel Fluid Compute; existing in-flight connections drain within minutes of redeploy |
| RLS not enabled on tables with existing data | HIGH | Audit existing data for unauthorized access; enable RLS; create policies; test all existing queries still return correct data — some may return empty results if policies are incomplete |
| Google OAuth callback URL mismatch on deploy | LOW | Add production URL to Google Cloud Console; add `NEXTAUTH_URL` to Vercel env variables; redeploy is not required — Google console changes take effect immediately |
| Supabase project paused | LOW | Restore from Supabase dashboard (30–60 second resume); set up keep-alive mechanism immediately after restore |
| Anonymous session lost on login redirect | MEDIUM | Add `sessionStorage` persistence before OAuth redirect; add session restore after callback; add anonymous ID to sign-in callback for chat migration |
| Multiple preset files per chat in storage | LOW | Write a one-time migration script to delete non-latest files; switch to deterministic key + upsert going forward |
| Chat messages out of order in resume | HIGH | Backfill `sequence_number` column based on `created_at` order; switch sorting to `sequence_number`; risk of incorrect ordering for concurrent-write messages in history |
| Performance regression in anonymous flow | LOW-MEDIUM | Add `if (session?.user?.id)` guard to every API route; remove auth routes from middleware matcher; measure before/after latency with Vercel function logs |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: Auth hydration mismatch | Auth Phase | Hard-refresh while logged in; no flash of logged-out UI |
| Pitfall 2: Database connection exhaustion | Database Phase (any first db query) | Check Supabase connection count under 10 concurrent users; confirm pooler URL in connection string |
| Pitfall 3: RLS disabled/misconfigured | Database Phase (table creation) | Direct REST API call returns only own data; Security Advisor shows green |
| Pitfall 4: Anonymous session lost on login | Auth Phase (sign-in flow) | Start anonymous chat → sign in → chat appears in sidebar |
| Pitfall 5: Google OAuth callback mismatch | Auth Phase (before first deploy) | Successful login from production Vercel URL |
| Pitfall 6: Supabase free tier pause | Database Phase (project creation) | Keep-alive configured; project active after 5-day wait |
| Pitfall 7: Middleware-only auth | Auth Phase (API route design) | Direct API request without session returns 401 |
| Pitfall 8: Storage cost from multiple versions | File Storage Phase | Supabase Storage bucket shows exactly 1 file per chat after multiple generations |
| Pitfall 9: Message ordering bugs | Database Phase (schema) | Resumed chat shows messages in correct logical order |
| Pitfall 10: Anonymous flow regression | All phases | Time-to-preset for anonymous users within 5% of v1.3 baseline |

---

## Sources

**Official Documentation (HIGH confidence):**
- [Next.js Hydration Error Docs](https://nextjs.org/docs/messages/react-hydration-error) — Official explanation of hydration mismatch causes and fixes
- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) — RSC boundary rules; React context not supported in Server Components
- [Vercel: Connection Pooling with Serverless Functions](https://vercel.com/kb/guide/connection-pooling-with-functions) — Official Vercel guide on the connection problem and Fluid Compute solution
- [Vercel: Efficiently Manage Database Connection Pools with Fluid Compute](https://vercel.com/kb/guide/efficiently-manage-database-connection-pools-with-fluid-compute) — Fluid Compute connection reuse details
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — Hobby plan: 60s max duration; Fluid Compute changes duration limits
- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — RLS opt-in model, policy syntax, common mistakes
- [Supabase RLS Performance and Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — Index columns used in RLS policies; performance impact
- [Supabase Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control) — Storage object RLS policies
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — Official pre-launch checklist
- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google) — Callback URL format requirements

**Community/Engineering Analysis (MEDIUM confidence):**
- [Fixing RLS Misconfigurations in Supabase — ProsperaSoft](https://prosperasoft.com/blog/database/supabase/supabase-rls-issues/) — Documented common RLS mistakes including missing WITH CHECK and INSERT/SELECT policy gaps
- [Supabase Security Flaw: 170+ Apps Exposed by Missing RLS](https://byteiota.com/supabase-security-flaw-170-apps-exposed-by-missing-rls/) — CVE-2025-48757 analysis confirming RLS misconfiguration is systemic
- [Next.js Session Management: Solving NextAuth Persistence Issues — Clerk](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues) — SessionProvider hydration pattern
- [NextAuth.js to Better Auth: Why I Switched — DEV](https://dev.to/pipipi-dev/nextauthjs-to-better-auth-why-i-switched-auth-libraries-31h3) — Auth library landscape in 2025; Better Auth anonymous plugin
- [Designing Chat Architecture for Reliable Message Ordering — Ably](https://ably.com/blog/chat-architecture-reliable-message-ordering) — Sequence number vs. timestamp ordering for chat systems
- [CVE-2025-29927: Next.js Middleware Bypass — Clerk Article](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues) — Middleware-only auth insufficient; data access layer pattern
- [Prevent Supabase Free Tier Pausing — Medium](https://shadhujan.medium.com/how-to-keep-supabase-free-tier-projects-active-d60fd4a17263) — Keep-alive strategies for free plan
- [Complete Guide: Deploying Next.js + Google OAuth to Vercel — Medium](https://medium.com/@bhuvan.thota3/complete-guide-deploying-next-js-prisma-google-oauth-to-vercel-real-issues-solutions-2213505505b9) — Redirect URI mismatch patterns in production deployments
- [Incorrect redirect URI in NextAuth Google docs — GitHub Issue #10713](https://github.com/nextauthjs/next-auth/issues/10713) — Confirmed App Router vs Pages Router callback path difference

---

*Pitfalls research for: Adding auth, chat persistence, and file storage to HelixAI (v2.0)*
*Researched: 2026-03-03*
