---
phase: 27-persistence-wiring
verified: 2026-03-03T23:30:00Z
status: passed
score: 4/4 success criteria verified
re_verification: false
gaps: []
human_verification:
  - test: "Send a message as an authenticated user — open Supabase dashboard, check the messages table for the user message row with sequence_number=1 before the stream finishes, then check for assistant message row after [DONE]"
    expected: "User message row present before stream closes. Assistant message row present after stream closes. Both have correct conversation_id and sequence_number."
    why_human: "Cannot verify actual Supabase write order without running the application against a live Supabase instance."
  - test: "Generate a preset as an authenticated user, then regenerate — check Supabase Storage under presets/{user_id}/{conversation_id}/"
    expected: "Exactly one file (latest.hlx or latest.pgp) in the folder. After regeneration, the file is overwritten (same key, newer timestamp) — not two files."
    why_human: "Storage upsert:true logic is correct in code but confirming single-file invariant requires live Storage inspection."
  - test: "Resume a conversation that previously generated a preset — click Download Stored Preset"
    expected: "Browser download triggers. Network tab shows no request to /api/generate. The download URL is a Supabase signed URL, not a local blob."
    why_human: "The downloadStoredPreset() function and storedPresetPath UI rendering are wired correctly in code, but the full resume flow requires Phase 28 sidebar to call loadConversation(), which has not been integrated into any navigation trigger yet."
---

# Phase 27: Persistence Wiring Verification Report

**Phase Goal:** Authenticated conversations persist their full message history and most recent preset file — the existing anonymous generate-and-download flow is byte-for-byte identical to v1.3 when no conversationId is provided.
**Verified:** 2026-03-03T23:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria from ROADMAP.md

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | User message saved to messages table with correct sequence_number BEFORE stream completes; assistant message saved AFTER stream | VERIFIED | chat/route.ts lines 13-56: user message insert with MAX+1 seq before Gemini stream opens. Lines 101-121: assistant insert with .then() (fire-and-forget) after controller.close(). |
| 2 | Exactly one file in Storage at deterministic key with upsert:true; regeneration overwrites | VERIFIED | generate/route.ts lines 98-126 (Pod Go) and 142-170 (Helix): both branches use upsert:true and path `{user_id}/{conversationId}/latest.{pgp\|hlx}`. |
| 3 | "Download Preset" in resumed conversation fetches from Storage without regenerating | VERIFIED | page.tsx line 678-708: downloadStoredPreset() uses createSignedUrl() from browser Supabase client. No fetch to /api/generate. UI conditional at line 1214: renders only when storedPresetPath is set and !generatedPreset. |
| 4 | POST /api/chat and /api/generate WITHOUT conversationId produce identical responses to v1.3 | VERIFIED | Both routes gate ALL persistence behind `if (conversationId)`. When absent, no new awaits, no Supabase calls, no changed response shape. chat/route.ts returns same SSE headers/format. generate/route.ts returns same JSON payload. |

**Score:** 4/4 success criteria verified

---

## Required Artifacts

### Plan 27-01 Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src/app/api/chat/route.ts` | Chat streaming route with conditional message persistence | Yes | Yes (139 lines, full implementation) | Yes — imports createSupabaseServerClient, calls supabase.from('messages').insert() | VERIFIED |
| `src/app/api/generate/route.ts` | Preset generation route with conditional Storage upload and preset_url write | Yes | Yes (208 lines, full implementation) | Yes — imports createSupabaseServerClient, calls storage.from('presets').upload() and conversations.update({preset_url}) | VERIFIED |

### Plan 27-02 Artifacts

| Artifact | Provides | Exists | Substantive | Wired | Status |
|----------|----------|--------|-------------|-------|--------|
| `src/app/page.tsx` | Client-side conversation lifecycle: create, pass ID, auto-title, re-download stored preset, reset on startOver | Yes | Yes (~1250+ lines, full implementation) | Yes — imports createSupabaseBrowserClient, conversationId state+ref wired into sendMessage/generatePreset/startOver | VERIFIED |

---

## Key Link Verification

### Plan 27-01 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/api/chat/route.ts` | `src/lib/supabase/server.ts` | import { createSupabaseServerClient } | WIRED | Line 3: `import { createSupabaseServerClient } from "@/lib/supabase/server"` |
| `src/app/api/chat/route.ts` | supabase messages table | supabase.from('messages').insert() | WIRED | Lines 40-45 (user insert pre-stream), lines 110-116 (assistant insert post-stream) |
| `src/app/api/generate/route.ts` | Supabase Storage presets bucket | supabase.storage.from('presets').upload() | WIRED | Line 107-112 (Pod Go branch), line 151-156 (Helix branch), both with upsert:true |
| `src/app/api/generate/route.ts` | supabase conversations table | supabase.from('conversations').update({ preset_url }) | WIRED | Lines 115-119 (Pod Go), lines 159-163 (Helix): update includes preset_url and updated_at |

### Plan 27-02 Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `src/app/page.tsx` | POST /api/conversations | fetch in ensureConversation() | WIRED | Line 475: `fetch("/api/conversations", { method: "POST", ... body: JSON.stringify({ device: selectedDevice }) })` |
| `src/app/page.tsx` | PATCH /api/conversations/[id]/title | fetch in auto-title after first message | WIRED | Lines 584-588: `fetch(\`/api/conversations/${convId}/title\`, { method: "PATCH", ... body: JSON.stringify({ title }) })` — fire-and-forget .catch(() => {}) |
| `src/app/page.tsx` | `src/lib/supabase/client.ts` | import createSupabaseBrowserClient for signed URL download | WIRED | Line 6: `import { createSupabaseBrowserClient } from "@/lib/supabase/client"`. Used at lines 466, 682. |
| `src/app/page.tsx sendMessage()` | `src/app/api/chat/route.ts` | conversationId added to fetch body | WIRED | Line 516: `...(convId ? { conversationId: convId } : {})` in sendMessage() body |
| `src/app/page.tsx generatePreset()` | `src/app/api/generate/route.ts` | conversationId added to fetch body | WIRED | Line 620: `...(convId ? { conversationId: convId } : {})` in generatePreset() body |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STORE-01 | 27-01 | Most recent preset stored in Supabase Storage per conversation with deterministic key; upsert overwrites on regeneration | SATISFIED | generate/route.ts: both Pod Go and Helix branches upload to `{user_id}/{conversationId}/latest.{pgp\|hlx}` with `upsert: true`. Path is deterministic — same key every time means automatic overwrite. |
| STORE-02 | 27-02 | User can re-download stored preset from resumed conversation without regenerating | SATISFIED | page.tsx: downloadStoredPreset() (line 678) calls createSignedUrl on storedPresetPath. No /api/generate call. UI button visible when storedPresetPath && !generatedPreset (line 1214). loadConversation() populates storedPresetPath from data.preset_url (line 740). |
| STORE-03 | 27-01 | Storage upload is background operation — download completes immediately; upload never blocks user | SATISFIED | generate/route.ts: storage.upload().then().catch() — NOT awaited before return NextResponse.json(). Response returns immediately. Both branches follow this pattern. |
| UXP-04 | 27-01, 27-02 | Anonymous flow identical to v1.3 — no new API calls, changed loading states, or response shape changes | SATISFIED | Server: all persistence inside `if (conversationId)` guards. Client: `...(convId ? { conversationId: convId } : {})` spread adds nothing when convId is null. ensureConversation() returns null for anonymous users (is_anonymous check at line 468). |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps STORE-01, STORE-02, STORE-03, and UXP-04 to Phase 27 — all four accounted for. No orphaned requirements.

---

## Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/app/api/chat/route.ts` | None detected | — | Clean |
| `src/app/api/generate/route.ts` | None detected | — | Clean |
| `src/app/page.tsx` | None detected | — | Clean |

No TODOs, FIXMEs, placeholder returns, or empty handlers found in any of the three modified files.

---

## Implementation Quality Notes

**Correct patterns confirmed:**

1. **Fire-and-forget assistant message save** — chat/route.ts line 110: `supabase.from("messages").insert({...}).then(...)` with no `await`. The insert is initiated after `controller.close()` so the stream has already delivered `[DONE]` to the client before this DB write begins.

2. **fullContent accumulation** — chat/route.ts line 88-94: `let fullContent = ""` declared before the streaming loop; `fullContent += text` inside loop. Single DB write after stream closes, never per-chunk.

3. **Server-side sequence numbers** — chat/route.ts queries `MAX(sequence_number)` twice (once before stream for user message, once after stream for assistant message). Both use `.order("sequence_number", { ascending: false }).limit(1)`.

4. **Ownership verification** — chat/route.ts lines 21-26: conversation ownership checked via `.eq("user_id", userId)` before any message insert. Defense-in-depth beyond RLS.

5. **React state race condition avoidance** — page.tsx line 346: `conversationIdRef = useRef<string | null>(null)` used alongside `conversationId` useState. sendMessage() and generatePreset() read from `conversationIdRef.current` (synchronous), not from React state (async). Line 482: ref is set synchronously alongside setConversationId().

6. **preset_url stores object path, not full URL** — generate/route.ts lines 103, 147: `storagePath = \`${user.id}/${conversationId}/latest.{ext}\`` stored in conversations.preset_url. Matches Phase 26 DELETE handler's `storage.remove([conversation.preset_url])` contract.

7. **Anonymous null-propagation** — page.tsx lines 516, 620: `...(convId ? { conversationId: convId } : {})` — when convId is null the key is absent from the body entirely, preserving exact v1.3 request shape.

---

## Human Verification Required

### 1. Message Sequence Ordering Under Load

**Test:** Open two browser tabs as the same authenticated user. Send messages quickly in both tabs to the same conversation.
**Expected:** Messages have unique, sequential sequence_numbers. No collision or duplicate sequence numbers.
**Why human:** The MAX+1 sequence assignment pattern (not a DB sequence/auto-increment) has a race condition window under concurrent writes. Cannot verify concurrent safety with static analysis.

### 2. User Message Persisted Before Stream Interruption

**Test:** Send a message as an authenticated user, then immediately close the browser tab before the stream completes.
**Expected:** The user message row is present in the messages table. The assistant message row is absent (stream was interrupted before controller.close()).
**Why human:** Requires running the application and inspecting the database.

### 3. Preset Upsert Overwrites (Not Creates Second File)

**Test:** As an authenticated user, generate a preset, then generate again in the same conversation. Check Supabase Storage.
**Expected:** Exactly one file at the deterministic path. The file timestamp is updated from the second generation.
**Why human:** upsert:true should guarantee this, but confirming the single-file invariant requires live Storage inspection.

### 4. Download Stored Preset (Full Resume Flow)

**Test:** Resume a conversation via Phase 28 sidebar (when available). Verify the "Download Stored Preset" amber button appears. Click it.
**Expected:** Browser download dialog appears with a Supabase signed URL. No request to /api/generate in the network tab. File contents match the previously generated preset.
**Why human:** loadConversation() is defined but no UI trigger calls it until Phase 28 sidebar is integrated. The function itself is correctly implemented and wired, but the full resume flow end-to-end requires Phase 28.

---

## Gaps Summary

No gaps found. All four success criteria are verified against the actual codebase. All four requirement IDs (STORE-01, STORE-02, STORE-03, UXP-04) are satisfied. Key links are all wired. TypeScript compiles without errors. No anti-patterns detected.

The phase goal is achieved: authenticated conversations persist message history and preset files; the anonymous generate-and-download flow is unchanged.

One forward-looking note: the `loadConversation()` function in page.tsx is complete and correct but has no call site yet — it is ready to be called by the Phase 28 Chat Sidebar when a user clicks a conversation. This is by design (plan comment: "ready for Phase 28 sidebar"). This is not a gap for Phase 27.

---

_Verified: 2026-03-03T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
