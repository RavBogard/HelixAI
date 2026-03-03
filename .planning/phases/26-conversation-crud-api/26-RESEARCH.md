# Phase 26: Conversation CRUD API - Research

**Researched:** 2026-03-03
**Domain:** Next.js App Router Route Handlers + Supabase PostgreSQL CRUD with RLS + server-side sequence number assignment
**Confidence:** HIGH — all patterns verified against Context7 (supabase-js v2.58.0, @supabase/ssr) and cross-referenced against Phase 24 plan artifacts which define the exact schema this phase reads/writes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CONV-01 | User can create a new conversation record with id, user_id, device, and auto-generated title | POST /api/conversations — createSupabaseServerClient + supabase.from('conversations').insert() with session verification; title defaults to 'New Chat' on creation |
| CONV-02 | Auto-generated conversation title derived from first user message — client-side text extraction, no second AI call | PATCH /api/conversations/[id]/title — separate lightweight endpoint; client sends 5-8 word extract; server updates title column; no AI involvement |
| CONV-03 | Full message history saved per conversation with server-assigned sequence numbers for correct ordering | POST message save in /api/conversations/[id]/messages — sequence_number assigned server-side via MAX(sequence_number)+1 query per conversation; never client timestamps |
| CONV-04 | Device target stored as conversation metadata — restored when resuming | device column set on INSERT at conversation creation; GET /api/conversations/[id] returns device field |
| CONV-05 | User can list all their conversations ordered by most recent activity | GET /api/conversations — .order('updated_at', { ascending: false }); RLS enforces user_id = auth.uid() so no additional where clause needed |
| CONV-06 | User can delete a conversation — messages and preset file removed | DELETE /api/conversations/[id] — CASCADE delete on messages via FK; preset file deletion via supabase.storage.from('presets').remove([path]); preset_url stored in conversation row gives the path |
</phase_requirements>

---

## Summary

Phase 26 builds the data API layer for conversation persistence: five route files under `src/app/api/conversations/` that cover create, list, read, title-update, and delete operations. The schema is already defined in `supabase/schema.sql` (Phase 24 artifact) — this phase only writes application code that reads and writes those tables. All routes use `createSupabaseServerClient()` from `src/lib/supabase/server.ts` (Phase 24 artifact) and independently verify the user session with `supabase.auth.getUser()` as defense-in-depth against CVE-2025-29927 middleware bypass.

The single non-obvious implementation decision is how to assign `sequence_number` server-side. The schema has no auto-increment trigger — sequence numbers must be computed in the route handler using `SELECT MAX(sequence_number) FROM messages WHERE conversation_id = $1` and incrementing by 1. This is safe under Supabase's anon key because RLS on the messages table already enforces per-user isolation. The composite index `(conversation_id, sequence_number)` is already defined in the Phase 24 schema and will make this query fast.

Delete is the most complex operation: it must remove the preset file from Supabase Storage (if one exists) before (or concurrently with) deleting the conversation row. The cascade delete on `messages` handles message removal automatically — no explicit message deletion needed. The `preset_url` column on the conversation row stores the storage path, which the delete handler reads before issuing the DB delete.

**Primary recommendation:** Build the five routes in dependency order — create first, list second, get-with-messages third, title-update fourth, delete last (most complex). Each route is independently testable with curl before the next is started.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | already installed (Phase 24) | DB queries, Storage delete | The only Supabase client needed in route handlers |
| `@supabase/ssr` | already installed (Phase 24) | `createServerClient` factory used via `createSupabaseServerClient()` | Cookie-based session reading in Next.js Route Handlers |
| `next/server` | bundled with Next.js | `NextRequest`, `NextResponse` | Standard for App Router route handlers |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | — | — | Phase 26 requires zero new npm installs — all dependencies are Phase 24 artifacts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server-side sequence assignment via MAX query | DB trigger / SERIAL column | Triggers require DB migration changes; SERIAL doesn't scope per conversation — MAX+1 per conversation_id is the correct pattern here |
| Deleting preset via route handler | Background job | Route handler delete is simpler and synchronous — preset files are tiny and Supabase Storage delete is fast |

**Installation:**

```bash
# No new packages needed — Phase 24 already installed @supabase/supabase-js and @supabase/ssr
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
└── app/
    └── api/
        └── conversations/
            ├── route.ts               # POST (create), GET (list)
            └── [id]/
                ├── route.ts           # GET (full history), DELETE
                └── title/
                    └── route.ts       # PATCH (update title)
```

This matches the structure documented in ARCHITECTURE.md. The `[id]` dynamic segment is Next.js App Router convention for dynamic route segments. The title endpoint is a sub-resource at `[id]/title` rather than a PATCH on `[id]` directly to keep the route handler contracts clean — the base `[id]` route handles read and delete, the sub-resource handles title updates.

### Pattern 1: Session Verification First in Every Route Handler

**What:** Every route handler calls `supabase.auth.getUser()` as its first substantive action. If the user is not authenticated, return 401 immediately. Never proceed to database operations without a verified user ID.

**When to use:** Every route in this phase — no exceptions.

**Why:** CVE-2025-29927 (March 2025) demonstrated that Next.js middleware can be bypassed by crafted `x-middleware-subrequest` headers. Middleware-only auth is not sufficient. The STATE.md decision log explicitly records: "Every API route handler independently verifies session — defense-in-depth against CVE-2025-29927 middleware bypass."

**Example:**
```typescript
// Source: Context7 @supabase/ssr + supabase-js + Phase 24 pattern
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // All subsequent DB queries are scoped to user.id
  // RLS provides a second enforcement layer at the DB level
}
```

### Pattern 2: POST /api/conversations — Create Conversation

**What:** Insert a new row into `conversations` with `user_id`, `device`, and `title` defaulting to `'New Chat'`. Return the created row including its generated `id`.

**When to use:** Client calls this when the user sends their first message in a new chat session.

**Example:**
```typescript
// Source: Context7 supabase-js v2.58.0
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { device } = await request.json()
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 })

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, device, title: 'New Chat' })
    .select('id, user_id, device, title, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

### Pattern 3: GET /api/conversations — List Conversations

**What:** Return all conversations for the authenticated user ordered by `updated_at DESC`. RLS enforces the per-user filter — no explicit `.eq('user_id', user.id)` is strictly needed, but adding it makes the intent explicit and provides defense-in-depth if RLS is ever misconfigured.

**Example:**
```typescript
// Source: Context7 supabase-js v2.58.0
const { data, error } = await supabase
  .from('conversations')
  .select('id, title, device, updated_at, created_at')
  .eq('user_id', user.id)          // explicit — defense-in-depth on top of RLS
  .order('updated_at', { ascending: false })
  .limit(50)
```

### Pattern 4: GET /api/conversations/[id] — Read with Messages

**What:** Return the conversation row plus all messages ordered by `sequence_number ASC`. Verify the conversation belongs to the authenticated user (ownership check) before returning data.

**When to use:** Called when user resumes a past conversation from the sidebar.

**Example:**
```typescript
// Source: Context7 supabase-js v2.58.0 — joined select
const { data: conversation, error } = await supabase
  .from('conversations')
  .select(`
    id, title, device, preset_url, created_at, updated_at,
    messages(id, role, content, sequence_number, created_at)
  `)
  .eq('id', id)
  .eq('user_id', user.id)          // ownership check — not just relying on RLS
  .order('sequence_number', { referencedTable: 'messages', ascending: true })
  .single()
```

**Key decision:** Use Supabase's embedded select with `referencedTable` ordering rather than two separate queries. This is one round trip instead of two.

### Pattern 5: Server-Side Sequence Number Assignment

**What:** When saving a new message, compute `sequence_number` as `MAX(sequence_number) + 1` for the given conversation, within the route handler. This is the only safe approach given the schema has no trigger.

**Why not client timestamps:** STATE.md explicitly records: "sequence_number column assigned server-side for message ordering — never client-generated timestamps." PITFALLS.md Pitfall 9 documents this failure mode in detail.

**Example:**
```typescript
// Assign server-side sequence number before insert
const { data: maxSeq } = await supabase
  .from('messages')
  .select('sequence_number')
  .eq('conversation_id', conversationId)
  .order('sequence_number', { ascending: false })
  .limit(1)
  .single()

const nextSeq = (maxSeq?.sequence_number ?? 0) + 1

const { data: message, error } = await supabase
  .from('messages')
  .insert({
    conversation_id: conversationId,
    role,
    content,
    sequence_number: nextSeq,
  })
  .select()
  .single()
```

**Concurrency note:** If two messages are saved simultaneously (rare in this single-user sequential tool), both might read the same MAX and get the same sequence number. For this project's use case (one user, sequential chat), this is acceptable. A DB-level serial or trigger would prevent it entirely but requires schema changes.

### Pattern 6: PATCH /api/conversations/[id]/title — Update Title

**What:** Accept a `title` string in the request body. Update the `title` column on the conversation. Also update `updated_at` to reflect activity. Verify ownership before updating.

**Example:**
```typescript
// Source: Context7 supabase-js v2.58.0
const { data, error } = await supabase
  .from('conversations')
  .update({ title: title.slice(0, 60), updated_at: new Date().toISOString() })
  .eq('id', id)
  .eq('user_id', user.id)          // ownership check
  .select('id, title, updated_at')
  .single()
```

**Title constraint:** Truncate to 60 characters server-side to match the schema design intent (CONV-02: "5-8 words"). The client sends the extracted title; the server truncates as a safety measure.

### Pattern 7: DELETE /api/conversations/[id] — Delete with Storage Cleanup

**What:** Delete the preset file from Supabase Storage (if `preset_url` is set), then delete the conversation row. The FK cascade on `messages` removes all messages automatically — no explicit message deletion needed.

**Critical ordering:** Read the `preset_url` from the conversation row BEFORE deleting the row. Once the row is deleted, the URL is gone.

**Example:**
```typescript
// Step 1: Fetch conversation to get preset_url (and verify ownership)
const { data: conversation, error: fetchError } = await supabase
  .from('conversations')
  .select('id, preset_url')
  .eq('id', id)
  .eq('user_id', user.id)
  .single()

if (fetchError || !conversation) {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

// Step 2: Delete preset file from Storage if it exists
if (conversation.preset_url) {
  // preset_url stores the storage path, not a full URL
  // Path format: {user_id}/{conversation_id}/latest.hlx (or .pgp)
  await supabase.storage.from('presets').remove([conversation.preset_url])
  // Storage delete errors are non-fatal — DB delete proceeds regardless
}

// Step 3: Delete conversation row (cascades to messages)
const { error: deleteError } = await supabase
  .from('conversations')
  .delete()
  .eq('id', id)
  .eq('user_id', user.id)

if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })
return NextResponse.json({ ok: true })
```

**Storage error handling:** If Storage delete fails (file already gone, path mismatch), do NOT block the conversation delete. The DB row must be deleted regardless. Log the storage error but return success.

### Pattern 8: updated_at Maintenance

**What:** The `updated_at` column on `conversations` must be updated whenever a message is saved to that conversation. This keeps the list ordering correct (most recently active conversation appears first).

**When to use:** Any route that saves a message to a conversation must also update `conversations.updated_at`.

**Example:**
```typescript
// After saving message, update conversation's updated_at
await supabase
  .from('conversations')
  .update({ updated_at: new Date().toISOString() })
  .eq('id', conversationId)
  .eq('user_id', user.id)
```

**Note:** Phase 26 defines the conversation CRUD routes. Message saving (CONV-03) is triggered by modifications to `/api/chat` in Phase 27 (Persistence Wiring). However, Phase 26 should expose a message-save sub-route if the planner decides to separate concerns cleanly. See Open Questions.

### Anti-Patterns to Avoid

- **Relying solely on RLS for ownership checks:** Always include `.eq('user_id', user.id)` in route handler queries even though RLS enforces the same rule. Defense-in-depth per STATE.md decision.
- **Client-generated sequence numbers:** Never let the client determine message order. Sequence number must be computed server-side from the existing MAX.
- **Deleting row before reading preset_url:** Fetch the conversation first, capture the preset_url, then delete. The cascade wipes the row immediately.
- **Storage delete blocking conversation delete:** Storage errors must not prevent the DB delete. The file may already be gone (e.g., storage was cleaned separately). Always proceed to DB delete.
- **Returning 500 on not-found:** When the authenticated user requests a conversation that doesn't exist or belongs to another user, return 404 (not 500 or a leaky "access denied" that reveals existence).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row-level security | Custom user_id filter logic in every query | Supabase RLS policies (already defined in schema.sql) | SQL policy enforces at DB level even if app code has a bug; automatic for all operations |
| Session cookie parsing | Manual JWT decode | `supabase.auth.getUser()` via `createSupabaseServerClient()` | Verifies token with Supabase Auth server, not just decodes; handles expiry and refresh |
| Storage path construction | Custom URL builder | Use the stored `preset_url` string directly as the storage path | Phase 27 stores path deterministically as `{user_id}/{conversation_id}/latest.hlx` — just use it |
| Message ordering | Client-side sort | `sequence_number` column + `.order('sequence_number', { ascending: true })` | Server-assigned integers cannot be corrupted by client clock drift |

**Key insight:** The schema (Phase 24) and client utilities (Phase 24) already provide all the hard pieces. Phase 26 is application logic wiring those pieces into route handlers — not infrastructure work.

---

## Common Pitfalls

### Pitfall 1: Missing Ownership Check (Defense-in-Depth)

**What goes wrong:** Route handler calls `supabase.auth.getUser()`, gets a valid user, then queries without scoping to `user.id`. RLS prevents data leakage, but a crafted request from a valid authenticated user who guesses another user's conversation UUID could receive a 404 "not found" from RLS, or — if RLS has any gap — the other user's data.

**Why it happens:** Developer trusts RLS implicitly and forgets the explicit filter.

**How to avoid:** Every query that touches a specific resource by ID must include `.eq('user_id', user.id)` OR a subquery join that enforces ownership. Use `.single()` with the ownership filter — if no row matches, `.single()` returns an error which maps to a 404.

**Warning signs:** Query uses `.eq('id', id)` without `.eq('user_id', user.id)`.

---

### Pitfall 2: preset_url Stores Full URL vs. Storage Path

**What goes wrong:** Phase 27 will store either the full Supabase Storage public URL or just the object path in `preset_url`. If it stores the full URL (e.g., `https://[ref].supabase.co/storage/v1/object/public/presets/...`), the delete route cannot use it directly with `supabase.storage.from('presets').remove([url])` — that method takes the object path (e.g., `{user_id}/{conv_id}/latest.hlx`), not the full URL.

**Why it happens:** Phase 26 and Phase 27 are separate phases and may make inconsistent assumptions about what `preset_url` contains.

**How to avoid:** Phase 26's delete handler must document its assumption clearly. The recommended approach: store only the storage object path (not the full URL) in `preset_url`. Document this in the Phase 26 plan so Phase 27 stores the path correctly. The Phase 24 architecture doc uses: `presets/{user_id}/{conversation_id}/latest.hlx` as the path — match this in Phase 27's upload and Phase 26's delete.

**Warning signs:** `preset_url` in the database starts with `https://` — it should be a path string only.

---

### Pitfall 3: Sequence Number Race Condition on Rapid Messages

**What goes wrong:** User sends two messages in rapid succession. Two concurrent requests both read `MAX(sequence_number) = 5`, both compute `nextSeq = 6`, and both insert a message with `sequence_number = 6`. The composite unique constraint (if one were added) would reject one; without a constraint, both succeed and the ordering is ambiguous.

**Why it happens:** The MAX+1 pattern is not atomic — it's a read-then-write with a gap.

**How to avoid:** For this project (single-user sequential chat), rapid concurrent message saves are extremely unlikely. The risk is acceptable. If this becomes a real issue (evidence: duplicate sequence_numbers appearing in messages), the fix is a DB-level trigger or a PostgreSQL advisory lock per conversation_id. Do NOT pre-solve this in Phase 26.

**Warning signs:** Duplicate `sequence_number` values appearing for the same `conversation_id` in the messages table.

---

### Pitfall 4: Leaking Conversation Existence to Non-Owners

**What goes wrong:** `GET /api/conversations/[id]` returns 403 "Forbidden" when the user doesn't own the conversation. This leaks information: the caller can distinguish "exists but not yours" from "doesn't exist," enabling enumeration of conversation UUIDs across users.

**Why it happens:** Checking session first, then ownership separately, with different error codes for each check.

**How to avoid:** Always return 404 (not 403) when a resource is not found OR when the authenticated user does not own it. The `.eq('id', id).eq('user_id', user.id).single()` pattern naturally returns an error when either condition is unmet — use 404 for that error regardless of which condition caused it.

---

### Pitfall 5: Not Returning 201 on Create

**What goes wrong:** `POST /api/conversations` returns 200 instead of 201 Created. Not a functional bug, but REST semantics are violated and clients that check status codes may behave inconsistently.

**How to avoid:** Use `NextResponse.json(data, { status: 201 })` on the create route. All other successful responses return 200.

---

## Code Examples

Verified patterns from official sources:

### POST — Create Conversation
```typescript
// Source: Context7 supabase-js v2.58.0 + @supabase/ssr
// src/app/api/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { device } = body
  if (!device) return NextResponse.json({ error: 'device required' }, { status: 400 })

  const { data, error } = await supabase
    .from('conversations')
    .insert({ user_id: user.id, device, title: 'New Chat' })
    .select('id, title, device, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
```

### GET — List Conversations
```typescript
// Source: Context7 supabase-js v2.58.0
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, device, updated_at, created_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
```

### GET [id] — Read with Messages (Joined Select)
```typescript
// Source: Context7 supabase-js v2.58.0 — embedded relationships
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, title, device, preset_url, created_at, updated_at,
      messages(id, role, content, sequence_number, created_at)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .order('sequence_number', { referencedTable: 'messages', ascending: true })
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

### DELETE [id] — Delete with Preset Cleanup
```typescript
// Source: Context7 supabase-js v2.58.0 storage.remove
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params

  // Read first to get preset_url and verify ownership
  const { data: conv, error: fetchErr } = await supabase
    .from('conversations')
    .select('id, preset_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete preset file from Storage (non-fatal if missing)
  if (conv.preset_url) {
    await supabase.storage.from('presets').remove([conv.preset_url])
    // Intentionally not checking storage error — DB delete proceeds regardless
  }

  // Delete conversation — cascades to messages via FK
  const { error: deleteErr } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

### PATCH title — Update Conversation Title
```typescript
// Source: Context7 supabase-js v2.58.0
// src/app/api/conversations/[id]/title/route.ts
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = params
  const { title } = await request.json()
  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('conversations')
    .update({ title: title.slice(0, 60), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select('id, title, updated_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | auth-helpers-nextjs deprecated; @supabase/ssr is the current package for App Router |
| Manual session check via JWT decode | `supabase.auth.getUser()` | Ongoing | getUser() validates with Supabase server; getSession() reads unverified cookie — always use getUser() for authorization |
| Separate queries for conversation + messages | Embedded select with `referencedTable` ordering | supabase-js v2 | Single round-trip; Supabase joins via FK relationships |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not install.
- `supabase.auth.getSession()` for authorization decisions: Reads unverified cookie. Use `supabase.auth.getUser()` instead.

---

## Open Questions

1. **Does Phase 26 own the message-save endpoint or does Phase 27?**
   - What we know: CONV-03 ("Full message history saved per conversation with server-assigned sequence numbers") is a Phase 26 requirement. But ARCHITECTURE.md Phase 4 (Persistence Wiring) says it is `/api/chat` that saves messages.
   - What's unclear: Should Phase 26 create a standalone `/api/conversations/[id]/messages` POST endpoint, or should message saving live entirely in the modified `/api/chat` route (Phase 27)?
   - Recommendation: Phase 26 builds the route infrastructure and exposes a `/api/conversations/[id]/messages` POST endpoint (covers CONV-03). Phase 27 wires the `/api/chat` route to call that endpoint (or duplicate its logic inline). This keeps Phase 26 independently testable via curl without needing the full chat flow.

2. **What does `preset_url` store — full URL or storage path?**
   - What we know: Phase 26 delete reads `preset_url` and passes it to `supabase.storage.from('presets').remove([path])`. The `remove()` method takes the storage object path, not a full HTTPS URL.
   - What's unclear: Phase 27 (which writes `preset_url`) hasn't been planned yet. It could store either.
   - Recommendation: Phase 26 plan must document the contract: `preset_url` MUST store the storage object path (e.g., `abc123-user-id/def456-conv-id/latest.hlx`), not a full URL. Phase 27 must follow this contract when writing the column.

3. **RLS cross-user isolation test — how to execute?**
   - What we know: Success Criterion 6 says "All route handlers independently verify the session (defense-in-depth)." The phase description says "RLS is verified by cross-user isolation tests."
   - What's unclear: Cross-user isolation requires two authenticated users. The project has no automated test infrastructure (nyquist_validation: false in config.json).
   - Recommendation: Manual test using two different browser sessions (or curl with two different JWTs). Plan should document this as a manual verification step with specific curl commands showing how to obtain two different auth tokens and test cross-user access.

---

## Sources

### Primary (HIGH confidence)
- Context7 `/supabase/supabase-js` (v2.58.0) — insert, select with embedded relationships, update, delete, auth.getUser patterns
- Context7 `/supabase/ssr` — createServerClient for Next.js Route Handlers, cookie handling, getUser() vs getSession() distinction
- `.planning/phases/24-supabase-foundation/24-02-PLAN.md` — exact schema SQL (conversations table, messages table, sequence_number column, composite index, RLS policies, preset_url column)
- `.planning/phases/24-supabase-foundation/24-01-PLAN.md` — createSupabaseServerClient() signature and export name
- `.planning/research/ARCHITECTURE.md` — Phase 3 build spec (route list, must-have patterns, defense-in-depth requirement)
- `.planning/STATE.md` — Locked decisions: sequence_number server-side, defense-in-depth per-route session verification, preset_url stores the path

### Secondary (MEDIUM confidence)
- `.planning/research/PITFALLS.md` — Pitfall 7 (middleware bypass / CVE-2025-29927), Pitfall 9 (sequence number ordering), Pitfall 3 (RLS misconfiguration)
- `.planning/REQUIREMENTS.md` — CONV-01 through CONV-06 full text

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages are Phase 24 artifacts already installed; no new dependencies
- Architecture: HIGH — route structure matches ARCHITECTURE.md Phase 3 spec; patterns verified against Context7
- Pitfalls: HIGH (security/RLS/ordering) / MEDIUM (sequence number race condition — acceptable for this use case per analysis)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (supabase-js is stable; patterns unlikely to change within 30 days)
