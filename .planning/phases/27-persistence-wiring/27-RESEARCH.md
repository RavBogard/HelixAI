# Phase 27: Persistence Wiring - Research

**Researched:** 2026-03-03
**Domain:** Route modification for conditional message and preset persistence — wiring existing stateless API routes (/api/chat, /api/generate) to the Phase 26 CRUD layer and Supabase Storage, with zero behavioral change for anonymous flows
**Confidence:** HIGH — all three source files have been read in full; Phase 26 plan documents specify the exact endpoints and contracts this phase calls into; ARCHITECTURE.md provides the authoritative data-flow design; no external library research required (all patterns already resolved in Phase 26 research)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STORE-01 | Most recent generated preset stored in Supabase Storage per conversation — deterministic key with upsert overwrites on regeneration (one file per chat, not version history) | `/api/generate` route modification: after building preset file, if `conversationId` is present, upload to `presets/{user_id}/{conversation_id}/latest.hlx` (or `.pgp`) via Supabase Storage `upload()` with `upsert: true`; store the object path (not full URL) in `conversations.preset_url` |
| STORE-02 | User can re-download the stored preset from a resumed conversation without regenerating — "Download Preset" button fetches from storage | Client-side: after resuming a conversation via GET /api/conversations/[id], if `preset_url` is present, expose a "Download Preset" action in page.tsx that fetches a signed download URL from Supabase Storage and triggers browser download — NO regeneration |
| STORE-03 | Preset storage is a background operation — download completes immediately from the builder output; storage upload happens asynchronously and never blocks the user | In `/api/generate`: the route returns the preset JSON to the client first (same as v1.3), then performs the storage upload and `preset_url` DB write asynchronously AFTER streaming the response — or the upload is delegated to the client post-response |
| UXP-04 | Existing text-only generation flow (no auth, no persistence) produces identical output and performance to v1.3 — no new API calls, no changed loading states, no response shape changes for anonymous users | Both routes gate all persistence logic behind `if (conversationId)` — no `conversationId` means the v1.3 code path executes unchanged; the response shape for anonymous requests is byte-for-bit identical |
</phase_requirements>

---

## Summary

Phase 27 modifies two existing API routes — `/api/chat/route.ts` and `/api/generate/route.ts` — to optionally persist data when a `conversationId` is present in the request body. It is a "thin wiring" phase: all the persistence infrastructure (Supabase client utilities, database schema, CRUD routes) was built in Phases 24–26. Phase 27 only adds conditional branches to the existing routes that call that infrastructure.

The core design invariant is backward compatibility: both routes MUST behave identically to v1.3 when no `conversationId` is provided. Every persistence action is gated behind `if (conversationId && userId)`. The anonymous flow — which is the majority of all requests — goes through the exact same code path as before, with no new awaits, no new API calls, and no changed response shapes.

The technically interesting decisions are: (1) HOW the preset file reaches Supabase Storage (from the server-side route handler vs. client-side upload), (2) HOW to make the storage upload truly non-blocking (STORE-03), and (3) exactly WHERE in the `/api/chat` streaming flow to insert the message-save calls (before streaming starts for the user message; after the stream closes for the assistant message).

**Primary recommendation:** Upload the preset file from the server-side route handler using the Supabase service role client, not via signed URLs. Preset files are 10–50KB — well within serverless payload limits. Server-side upload is simpler (one code path, no client round-trip), uses the service role key that is already server-only, and avoids the two-step signed URL dance. Use `waitUntil()` (Vercel Fluid Compute) or a fire-and-forget `Promise` to make the upload non-blocking so the response returns immediately to the client.

---

## Standard Stack

### Core (no new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/ssr` | Already installed (Phase 24) | Server client via `createSupabaseServerClient()` | All Phase 26 routes use it; same pattern here |
| `@supabase/supabase-js` | Already installed (Phase 24) | Storage API (`supabase.storage.from(...).upload(...)`) | Same client, storage is a sub-API |
| `next/server` | Already in use | `NextRequest`, `NextResponse` | Existing import in both routes |

**No new npm installs required for this phase.** All dependencies are already present from Phase 24.

### Supabase Storage API Pattern

The Supabase JS client `storage` API is already available on the `SupabaseClient` returned by `createSupabaseServerClient()`. The upload call:

```typescript
// Source: Supabase official docs — storage-from-upload
const { error } = await supabase.storage
  .from('presets')
  .upload(path, fileBuffer, {
    contentType: 'application/json',
    upsert: true,          // overwrites if path already exists (STORE-01)
  })
```

For signed download URLs (STORE-02, for client-side re-download on resume):

```typescript
// Source: Supabase official docs — storage-from-createsignedurl
const { data } = await supabase.storage
  .from('presets')
  .createSignedUrl(path, 3600) // 1-hour expiry
```

---

## Architecture Patterns

### Current Route Signatures (what Phase 27 modifies)

**`src/app/api/chat/route.ts` — current state (v1.3):**
```typescript
export async function POST(req: NextRequest) {
  const { messages, premiumKey } = await req.json();
  // ... Gemini SSE streaming, no persistence
  return new Response(readable, { headers: { "Content-Type": "text/event-stream", ... } });
}
```

**`src/app/api/generate/route.ts` — current state (v1.3):**
```typescript
export async function POST(req: NextRequest) {
  const { messages, device, rigIntent, rigText } = await req.json();
  // ... builds preset, returns JSON
  return NextResponse.json({ preset, summary, spec, toneIntent, device, fileExtension, ... });
}
```

### Target Route Signatures (after Phase 27)

```typescript
// /api/chat — new body shape (fully backward-compatible)
const { messages, premiumKey, conversationId } = await req.json();
// conversationId is optional — undefined means anonymous flow, all persistence skipped

// /api/generate — new body shape (fully backward-compatible)
const { messages, device, rigIntent, rigText, conversationId } = await req.json();
// conversationId is optional — same guard
```

### Pattern 1: User Message Save — Before Streaming Starts

The `/api/chat` route saves the user message (the last element of `messages`) BEFORE opening the Gemini stream. This ensures the user message is persisted even if the stream fails partway through.

```typescript
// In /api/chat — after auth verification, before starting Gemini stream
if (conversationId) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Save user message — fire POST to the Phase 26 message endpoint
    // OR call Supabase directly (avoid HTTP loop)
    const lastUserMsg = messages[messages.length - 1]
    // Compute sequence number and insert
    const { data: maxSeq } = await supabase
      .from('messages')
      .select('sequence_number')
      .eq('conversation_id', conversationId)
      .order('sequence_number', { ascending: false })
      .limit(1)
      .single()
    const nextSeq = (maxSeq?.sequence_number ?? 0) + 1
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: lastUserMsg.content,
      sequence_number: nextSeq,
    })
    // Update conversations.updated_at
    await supabase.from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', user.id)
  }
}
// ... then start Gemini stream
```

**Key decision:** Call Supabase directly from the route handler rather than calling the Phase 26 HTTP endpoint (`POST /api/conversations/[id]/messages`). Calling an HTTP route from another route on Vercel adds latency (cold start for the nested call) and is an anti-pattern. The Phase 26 endpoint is for external callers; internal route handlers should use the DB client directly.

### Pattern 2: Assistant Message Save — After Stream Closes

The assistant message is saved AFTER the SSE stream closes (after `controller.close()`), using the fully accumulated `fullContent` string. This is the correct pattern per ARCHITECTURE.md Anti-Pattern 4: "Never write per-chunk to DB inside the streaming loop."

```typescript
// In /api/chat — inside the ReadableStream's start() function
const readable = new ReadableStream({
  async start(controller) {
    let fullContent = ""
    try {
      for await (const chunk of stream) {
        const text = chunk.text
        if (text) {
          fullContent += text
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()

      // Save assistant message AFTER stream closes — full content available
      if (conversationId && userId) {
        // Compute sequence number (user msg was seq N, assistant is N+1)
        // Insert assistant message (fire-and-forget — don't await in the stream closure)
        saveAssistantMessage(supabase, conversationId, fullContent).catch(console.error)
      }
    } catch (error) { ... }
  }
})
```

**Important:** The `saveAssistantMessage` call is fire-and-forget (`.catch()` only, not `await`). The stream has already closed — the client has received `[DONE]`. There is no response to delay. Making it fire-and-forget ensures no latency addition to the streaming UX.

### Pattern 3: Preset Upload — Server-Side, Non-Blocking

In `/api/generate`, after building the preset file, upload to Supabase Storage from the server handler. The preset data is already in memory as a JavaScript object (the `hlxFile` or `pgpFile` from the Knowledge Layer). Convert to a `Buffer` and upload.

```typescript
// In /api/generate — after building hlxFile / pgpFile, before returning
const responsePayload = { preset, summary, spec, toneIntent, device, fileExtension, ... }

if (conversationId) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    // Fire-and-forget — return response to client immediately
    const ext = isPodGo(deviceTarget) ? '.pgp' : '.hlx'
    const storagePath = `${user.id}/${conversationId}/latest${ext}`
    const fileBuffer = Buffer.from(JSON.stringify(preset))

    // Non-blocking: start upload, don't await it before returning
    supabase.storage
      .from('presets')
      .upload(storagePath, fileBuffer, { contentType: 'application/json', upsert: true })
      .then(({ error }) => {
        if (!error) {
          // Update preset_url in conversations table after successful upload
          return supabase.from('conversations')
            .update({ preset_url: storagePath })
            .eq('id', conversationId)
            .eq('user_id', user.id)
        }
      })
      .catch(console.error) // Non-fatal — generation already succeeded
  }
}

return NextResponse.json(responsePayload) // Returns immediately, upload happens in background
```

**Storage path contract (matches Phase 26-02):** The `preset_url` column stores the Supabase Storage object path (`{user_id}/{conversation_id}/latest.hlx`), NOT a full HTTPS URL. The Phase 26 DELETE handler calls `supabase.storage.from('presets').remove([conversation.preset_url])` which takes the object path. This contract must be maintained exactly.

### Pattern 4: Re-Download Without Regenerating (STORE-02)

When a user resumes a conversation and it has a `preset_url`, a "Download Preset" button should appear. Clicking it generates a signed download URL and triggers the browser download — no regeneration.

This logic lives in `page.tsx` (the client), not in a new API route. The client calls Supabase Storage directly using the browser client:

```typescript
// In page.tsx — when loading a resumed conversation with preset_url
const downloadStoredPreset = async (presetPath: string, filename: string) => {
  const supabase = createBrowserClient(...)
  const { data } = await supabase.storage
    .from('presets')
    .createSignedUrl(presetPath, 3600) // 1-hour signed URL
  if (data?.signedUrl) {
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = filename
    a.click()
  }
}
```

This requires the `createBrowserClient` from `src/lib/supabase/client.ts` (Phase 24 artifact) to be imported in `page.tsx`. The browser client uses the anon key and RLS controls access — users can only create signed URLs for files under their own `user_id` prefix.

### Pattern 5: Conversation Creation Trigger

Phase 27 modifies `/api/chat`, but conversations are CREATED by `POST /api/conversations` (Phase 26-01). The question is: who calls `POST /api/conversations` and when?

Per STATE.md decision: "Keep page.tsx as single-page interface — conversationId lives in React state." The trigger is in `page.tsx`:

- On first message send in an authenticated session (when `conversationId` is null and user is authenticated), `page.tsx` calls `POST /api/conversations` with `{ device: selectedDevice }` to create the conversation and obtain a `conversationId`.
- The returned `conversationId` is stored in React state and passed with all subsequent `/api/chat` and `/api/generate` requests.
- Anonymous users never get a `conversationId` — the `POST /api/conversations` route returns 401 for unauthenticated requests.

Phase 27's `/api/chat` modification assumes the conversation already exists when it receives a `conversationId`. It does NOT create conversations — that is `page.tsx`'s responsibility.

### Pattern 6: Auto-Title on First Message (CONV-02)

After the first user message is saved to a conversation, the conversation title should be auto-generated from that message content (client-side, 5-8 words, no AI call).

This is a `page.tsx` concern, not a route concern. After `page.tsx` sends the first message and receives the SSE response, it calls `PATCH /api/conversations/[id]/title` with a truncated version of the first user message content.

```typescript
// In page.tsx — after first message send when conversationId was just created
if (isFirstMessage && conversationId) {
  const title = userMessageContent.split(' ').slice(0, 7).join(' ')
  fetch(`/api/conversations/${conversationId}/title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  }).catch(console.error) // Fire-and-forget
}
```

---

## Files Modified in Phase 27

| File | Change | Notes |
|------|--------|-------|
| `src/app/api/chat/route.ts` | Extract `conversationId` from body; save user message before stream; save assistant message after stream closes | All persistence gated behind `if (conversationId && userId)` |
| `src/app/api/generate/route.ts` | Extract `conversationId` from body; fire-and-forget upload to Supabase Storage + `preset_url` write | Returns same response payload as v1.3; upload is non-blocking |
| `src/app/page.tsx` | Add `conversationId` state; call `POST /api/conversations` on first message send; pass `conversationId` to `/api/chat` and `/api/generate`; add "Download Preset" button in resume flow; auto-title after first message | Heavy modification but all additive — existing anonymous flow unchanged |

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sequence number assignment | Client-generated timestamps or UUIDs for ordering | MAX(sequence_number)+1 server-side query (Phase 26 pattern) | Timestamps have millisecond collisions; client clocks drift; server-assigned integers are the locked decision in STATE.md |
| Storage upload retry logic | Custom retry loop with exponential backoff | Accept that upload is fire-and-forget; log errors | Preset files are 10–50KB; Supabase Storage is highly reliable; upload failure means the stored preset is stale (not missing) — acceptable per STORE-03 |
| Separate API route for preset download | New `/api/preset-download` route | `createSignedUrl()` called from client with browser Supabase client | Files are private; signed URLs are the correct pattern; no server round-trip needed |
| Message buffering for DB write | Custom streaming accumulator class | Simple `let fullContent = ""` string accumulation | The stream is already accumulated in the existing route for `[READY_TO_GENERATE]` detection |

---

## Common Pitfalls

### Pitfall 1: Writing Assistant Message Inside the SSE Loop

**What goes wrong:** The assistant message content arrives in chunks via the Gemini stream. A natural mistake is to save each chunk to the database as it arrives, building up the message incrementally. This holds a DB connection open for the entire stream duration (3–20 seconds), creates 20–200 tiny INSERT/UPDATE operations, and leaves partial messages in the DB if the stream is interrupted.

**Why it happens:** The streaming loop is the most visible place to intercept content. It feels natural to save there.

**How to avoid:** Accumulate the full response in a local `let fullContent = ""` string (this already happens in the current route for `[READY_TO_GENERATE]` detection). After `controller.close()`, call `saveAssistantMessage()` once with the complete string.

**Warning signs:** DB `messages` table has rows with truncated content. Connection count spikes during active chat sessions.

### Pitfall 2: Awaiting Storage Upload Before Returning the Response (STORE-03 Violation)

**What goes wrong:** The upload to Supabase Storage is `await`-ed before `return NextResponse.json(...)`. The user sees a 3–8 second delay between clicking "Generate" and receiving the preset download — the upload latency is added directly to the UX.

**Why it happens:** `await` is the default. Developers add it reflexively without considering that the client doesn't need to wait for the upload.

**How to avoid:** The upload Promise must be started but NOT awaited before returning the response. Use fire-and-forget:
```typescript
supabase.storage.from('presets').upload(...).then(...).catch(console.error)
return NextResponse.json(responsePayload) // Immediately
```

**Warning signs:** Generate button spinner stays active significantly longer than before Phase 27.

### Pitfall 3: Calling Phase 26 HTTP Endpoints from Phase 27 Route Handlers

**What goes wrong:** Instead of calling Supabase directly, the `/api/chat` route calls `fetch('http://localhost:3000/api/conversations/[id]/messages', ...)` to save messages. On Vercel, this creates a nested serverless function invocation — a cold-started function calling another cold-started function — adding 100–500ms latency plus the risk of hitting Vercel's recursive function call detection.

**Why it happens:** The Phase 26 endpoints are clean, well-tested abstractions. Using them feels correct.

**How to avoid:** Route handlers call Supabase directly. The Phase 26 HTTP routes are for external callers (the browser). Internal route handlers share the same `createSupabaseServerClient()` factory and call the DB client directly. This is the "Data Access Layer" pattern from ARCHITECTURE.md.

**Warning signs:** Chat responses take noticeably longer after Phase 27. Vercel function logs show nested invocations.

### Pitfall 4: Missing `conversationId` Ownership Verification in Route Handlers

**What goes wrong:** The `/api/chat` handler receives a `conversationId` in the body and immediately inserts a message row for that conversation without verifying that the authenticated user owns it. A user who knows another user's `conversationId` can insert messages into their conversation.

**Why it happens:** RLS on the `messages` table only filters on `conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())`. The developer trusts RLS and skips the application-level ownership check.

**How to avoid:** Before inserting a message, verify ownership: `.eq('conversation_id', conversationId).eq('user_id', user.id)` on the conversations table (same pattern as Phase 26-02's message save endpoint). This is the defense-in-depth pattern — both RLS and application-level checks.

**Warning signs:** In testing, a message inserted with a forged `conversationId` succeeds instead of returning 404.

### Pitfall 5: Storage Path Mismatch with Phase 26 DELETE Handler

**What goes wrong:** Phase 27 stores `preset_url` in `conversations` as a full HTTPS URL (`https://xyz.supabase.co/storage/v1/object/...`). Phase 26's DELETE handler calls `supabase.storage.from('presets').remove([conversation.preset_url])` which takes an object PATH, not a URL. The `remove()` call silently fails (returns error, which is ignored), leaving orphaned files in storage.

**Why it happens:** It is not obvious that Supabase Storage methods take different formats in different contexts. `createSignedUrl()` takes a path. `getPublicUrl()` returns a full URL. `remove()` takes a path.

**How to avoid:** `preset_url` MUST store the object path only (`{user_id}/{conversation_id}/latest.hlx`), not the full HTTPS URL. This is explicitly documented in Phase 26-02 plan: "preset_url stores the storage object path, NOT a full HTTPS URL." Verify this in the insert:

```typescript
const storagePath = `${user.id}/${conversationId}/latest${ext}`
// Store storagePath, not a constructed URL
await supabase.from('conversations')
  .update({ preset_url: storagePath })
```

**Warning signs:** Deleting a conversation does not remove the file from Supabase Storage. Storage bucket grows unboundedly.

### Pitfall 6: `conversationId` State Race Condition on First Message

**What goes wrong:** The user sends their first message in an authenticated session. `page.tsx` calls `POST /api/conversations` to create the conversation and get a `conversationId`. But `sendMessage()` calls `/api/chat` immediately without waiting for the conversation creation to complete. The `/api/chat` call arrives without a `conversationId` and the message is not persisted.

**Why it happens:** React state updates are asynchronous. Even if `POST /api/conversations` returns a `conversationId` and `setConversationId(id)` is called, the next `sendMessage` call may use the stale `null` value from the previous render.

**How to avoid:** Store the `conversationId` in a `useRef` in addition to `useState`. Pass the ref value directly to the API call, not the state value:

```typescript
const conversationIdRef = useRef<string | null>(null)
// When creating conversation:
const id = await createConversation()
conversationIdRef.current = id
setConversationId(id) // For UI display

// When calling /api/chat:
body: JSON.stringify({ messages, conversationId: conversationIdRef.current })
```

Alternatively, design `sendMessage()` to receive the `conversationId` as a parameter when calling on the first message, rather than reading from state.

### Pitfall 7: Breaking the Prompt Caching Invariant

**What goes wrong:** To support persistence, the body of the POST to `/api/generate` is restructured, moving `messages` to a different position or wrapping it in a new object. The `callClaudePlanner()` function uses the `messages` array to build the Anthropic API request. If the messages are restructured, the system prompt cache_control block may no longer align with the stable prefix of the request, causing `cache_read_input_tokens = 0` on every request.

**Why it happens:** Adding `conversationId` to the destructured body is safe, but if a developer wraps messages or changes their structure, the cache key changes.

**How to avoid:** `callClaudePlanner(messages, deviceTarget, toneContext)` receives the same `messages` array as before. Only ADD `conversationId` to the destructured body — do NOT modify `messages`. The `messages` array that flows to `callClaudePlanner` must be identical to the v1.3 path. Verify with an Anthropic API response check: `cache_read_input_tokens > 0` after the first generate request with the same conversation (STATE.md locked decision: PLAN-02).

---

## Code Examples

### /api/chat Modification Pattern

```typescript
// src/app/api/chat/route.ts — full modified version
import { NextRequest } from "next/server";
import { createGeminiClient, getSystemPrompt, getModelId, isPremiumKey } from "@/lib/gemini";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { messages, premiumKey, conversationId } = await req.json();
  const premium = isPremiumKey(premiumKey);

  // --- Persistence: save user message BEFORE streaming ---
  let userId: string | null = null
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null

  if (conversationId) {
    supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      userId = user.id
      const lastMsg = messages[messages.length - 1]
      if (lastMsg?.role === 'user') {
        // Verify ownership and get next sequence number
        const { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('id', conversationId)
          .eq('user_id', userId)
          .single()

        if (conv) {
          const { data: maxSeq } = await supabase
            .from('messages')
            .select('sequence_number')
            .eq('conversation_id', conversationId)
            .order('sequence_number', { ascending: false })
            .limit(1)
            .single()

          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'user',
            content: lastMsg.content,
            sequence_number: (maxSeq?.sequence_number ?? 0) + 1,
          })

          await supabase.from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId)
            .eq('user_id', userId)
        }
      }
    }
  }
  // --- End persistence pre-stream ---

  // UNCHANGED: Gemini client setup
  const ai = createGeminiClient();
  const modelId = getModelId(premium);
  const history = messages.slice(0, -1).map(/* ... unchanged ... */);
  const lastMessage = messages[messages.length - 1];
  const chat = ai.chats.create({ /* ... unchanged ... */ });
  const stream = await chat.sendMessageStream({ message: lastMessage.content });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      let fullContent = ""
      try {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullContent += text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        // --- Persistence: save assistant message AFTER stream closes ---
        if (conversationId && userId && supabase && fullContent) {
          const { data: maxSeq } = await supabase
            .from('messages')
            .select('sequence_number')
            .eq('conversation_id', conversationId)
            .order('sequence_number', { ascending: false })
            .limit(1)
            .single()

          supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullContent,
            sequence_number: (maxSeq?.sequence_number ?? 0) + 1,
          }).catch(console.error) // fire-and-forget
        }
        // --- End persistence post-stream ---

      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

### /api/generate Persistence Addition

```typescript
// In /api/generate — after building hlxFile/pgpFile, before return
// The entire existing generation pipeline is UNCHANGED above this point

const responsePayload = {
  preset: hlxFile,   // or pgpFile
  summary,
  spec: presetSpec,
  toneIntent,
  device: deviceTarget,
  fileExtension: ".hlx",  // or ".pgp"
  ...(substitutionMap !== undefined ? { substitutionMap } : {}),
}

// --- Persistence: fire-and-forget upload + preset_url update ---
if (conversationId) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const ext = isPodGo(deviceTarget) ? '.pgp' : '.hlx'
    const storagePath = `${user.id}/${conversationId}/latest${ext}`
    const fileBuffer = Buffer.from(JSON.stringify(hlxFile ?? pgpFile))

    // Non-blocking — do NOT await
    supabase.storage
      .from('presets')
      .upload(storagePath, fileBuffer, {
        contentType: 'application/json',
        upsert: true,
      })
      .then(({ error: uploadError }) => {
        if (!uploadError) {
          return supabase.from('conversations')
            .update({ preset_url: storagePath, updated_at: new Date().toISOString() })
            .eq('id', conversationId)
            .eq('user_id', user.id)
        }
        console.error('Preset storage upload failed (non-fatal):', uploadError.message)
      })
      .catch(console.error)
  }
}
// --- End persistence ---

return NextResponse.json(responsePayload)  // Returns immediately
```

### page.tsx: conversationId State and Creation

```typescript
// New state in page.tsx
const [conversationId, setConversationId] = useState<string | null>(null)
const conversationIdRef = useRef<string | null>(null) // Ref for synchronous access

// On authenticated first message send:
const ensureConversation = async (): Promise<string | null> => {
  if (conversationIdRef.current) return conversationIdRef.current
  // Check if user is authenticated (requires Supabase browser client from Phase 25)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous) return null
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device: selectedDevice }),
  })
  if (!res.ok) return null
  const conv = await res.json()
  conversationIdRef.current = conv.id
  setConversationId(conv.id)
  return conv.id
}

// Modified sendMessage:
async function sendMessage(e?: React.FormEvent) {
  // ... existing validation ...
  const convId = await ensureConversation()  // null for anonymous users
  // ... existing Gemini fetch, with conversationId added to body:
  body: JSON.stringify({ messages: newMessages, premiumKey, conversationId: convId }),
}
```

### page.tsx: Re-Download Stored Preset (STORE-02)

```typescript
// When resuming a conversation that has preset_url
const downloadStoredPreset = async (presetPath: string, presetName: string, ext: string) => {
  const { data, error } = await supabase.storage
    .from('presets')
    .createSignedUrl(presetPath, 3600)
  if (error || !data?.signedUrl) {
    setError('Could not retrieve stored preset')
    return
  }
  const a = document.createElement('a')
  a.href = data.signedUrl
  a.download = `${presetName}${ext}`
  a.click()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All persistence in a single "save" step at route exit | User message saved before stream, assistant message saved after stream closes | Established pattern for SSE + DB (not new) | Prevents partial message loss if stream is interrupted |
| Signed upload URL (client uploads binary) | Direct server-side upload for small files | Simplification for Phase 27 given preset file size | Removes two-step complexity; service role key stays server-side |
| Dynamic route segments with synchronous params | `params: Promise<{ id: string }>` with `await params` | Next.js 15 | Breaking change — must `await params` in all dynamic route handlers |

---

## Open Questions

1. **Should page.tsx use a Supabase browser client directly for signed URL downloads, or should a new `/api/preset-download` route be created?**
   - What we know: ARCHITECTURE.md (Pattern 4) specifies the signed URL approach from the client using the browser client. The browser client with RLS can only create signed URLs for files under the user's own `user_id` prefix.
   - What's unclear: Whether the Phase 25 auth implementation made a `createBrowserClient()` utility available in `page.tsx` and how auth state is exposed to `page.tsx`.
   - Recommendation: Use the browser Supabase client directly in page.tsx for signed URL creation. This requires confirming Phase 25 artifacts before implementing.

2. **Does Vercel support fire-and-forget Promises in serverless function handlers?**
   - What we know: Standard Vercel serverless functions terminate after the response is sent — any pending Promises may be killed. The storage upload is fire-and-forget after `return NextResponse.json(...)`.
   - What's unclear: Whether Vercel Fluid Compute (enabled for this project per the vision route setup in Phase 19: `export const maxDuration = 60`) changes this behavior, allowing background work to continue after response.
   - Recommendation: Add `export const maxDuration = 60` to `/api/generate` if not already present, and note in the plan that upload may be dropped on cold-start function termination. The consequence is a stale (missing) stored preset — not a crash. This is acceptable per STORE-03 ("background operation").
   - Alternatively: Move the upload to a `setTimeout(() => upload(), 0)` pattern which some runtimes handle, but this is fragile. The cleanest solution is to accept occasional upload failures as non-fatal.

3. **Conversation creation: who is responsible when the user starts the generate flow from the welcome screen (the `handleRigGenerate` path)?**
   - What we know: `handleRigGenerate()` in page.tsx creates a synthetic message and calls `generatePreset()` directly without going through `sendMessage()`. The `ensureConversation()` logic proposed above is only called from `sendMessage()`.
   - What's unclear: Should `generatePreset()` also call `ensureConversation()` to handle the rig-generate path?
   - Recommendation: Yes — `generatePreset()` should also call `ensureConversation()` at the start, before the `/api/generate` fetch. The conversation creation is idempotent (won't create a duplicate if `conversationIdRef.current` is already set).

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` (the key is not in the config file), so this section is included with manual-only test guidance.

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | How to Verify |
|--------|----------|-----------|---------------|
| STORE-01 | Preset uploaded to `presets/{user_id}/{conv_id}/latest.hlx` with `upsert:true` on generation | Manual | After generating, check Supabase Storage bucket in dashboard — file should exist at the correct path; generate again, confirm same path, check file is overwritten (not duplicated) |
| STORE-02 | Re-download from resumed conversation fetches stored file without regenerating | Manual | Resume a past conversation; click "Download Preset" — no `/api/generate` call should appear in network tab; file should download |
| STORE-03 | Storage upload does not block generation response | Manual + timing | Time the generate request with and without a `conversationId`; response time should be within 200ms of v1.3 baseline; upload completes in the background |
| UXP-04 | Anonymous flow is byte-for-bit identical to v1.3 | Manual regression | POST to `/api/chat` and `/api/generate` without `conversationId`; compare response shape to v1.3 exactly; check no new headers, no new fields in response body |
| CONV-03 | Messages saved with correct sequence numbers | Manual | Send 3 chat messages; check Supabase `messages` table — 3 rows for the conversation, `sequence_number` values 1, 2, 3 in order |

### Regression Tests

The most important regression check for this phase:

```bash
# Verify anonymous flow unchanged — compare response shape
curl -s -X POST https://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"clean blues"}],"device":"helix_lt"}' \
  | jq 'keys | sort'
# Must return: ["device","fileExtension","preset","spec","summary","toneIntent"]
# Must NOT return any new keys (no presetUploadToken, no conversationId echo, etc.)
```

---

## Sources

### Primary (HIGH confidence)

- Read directly: `src/app/api/chat/route.ts` — complete current implementation, 61 lines
- Read directly: `src/app/api/generate/route.ts` — complete current implementation, 147 lines
- Read directly: `src/app/page.tsx` — complete current client state management (state variables and all functions through sendMessage, generatePreset, handleRigGenerate, downloadPreset, startOver)
- Read directly: `.planning/phases/26-conversation-crud-api/26-01-PLAN.md` — Phase 26 message route contract and schema definition
- Read directly: `.planning/phases/26-conversation-crud-api/26-02-PLAN.md` — message save endpoint with sequence_number pattern; DELETE handler with `preset_url` path contract
- Read directly: `.planning/research/ARCHITECTURE.md` — Pattern 4 (Signed Upload URLs), Anti-Pattern 4 (No per-chunk DB writes), Anti-Pattern 3 (keep single page.tsx), data flow diagrams, Phase 4 build order description
- Read directly: `.planning/research/PITFALLS.md` — Pitfall 4 (anonymous-to-auth migration), Pitfall 7 (middleware-only auth), connection pooling patterns
- Read directly: `.planning/STATE.md` — locked decisions: deterministic storage key, sequence_number server-side, defense-in-depth per route, anonymous-first model

### Secondary (MEDIUM confidence)

- Supabase Storage `upload()` with `upsert: true`: https://supabase.com/docs/reference/javascript/storage-from-upload — behavior of upsert flag
- Supabase Storage `createSignedUrl()`: https://supabase.com/docs/reference/javascript/storage-from-createsignedurl — for re-download flow
- Vercel Fluid Compute behavior with background Promises: https://vercel.com/docs/functions/fluid-compute — whether background work survives after response

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns already resolved in Phase 26 research
- Architecture: HIGH — source files read directly; Phase 26 contract documents read directly; data flow fully mapped
- Pitfalls: HIGH — several are sourced directly from ARCHITECTURE.md Anti-Patterns and PITFALLS.md; two are specific to the fire-and-forget pattern with known Vercel behavior caveats (MEDIUM)

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable patterns; only risk is Vercel Fluid Compute behavior change)
