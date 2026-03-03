---
phase: 27-persistence-wiring
plan: "01"
subsystem: api-routes
tags: [persistence, supabase, chat, generate, storage, messages, sse]
dependency_graph:
  requires:
    - src/lib/supabase/server.ts (Phase 24-01 — createSupabaseServerClient factory)
    - supabase messages table (Phase 24-02 — schema with sequence_number)
    - supabase conversations table (Phase 24-02 — schema with preset_url)
    - supabase presets storage bucket (Phase 24-02 — private bucket)
  provides:
    - /api/chat with conditional message persistence (user + assistant messages)
    - /api/generate with conditional preset storage upload and preset_url write
  affects:
    - Plan 27-02 (page.tsx client integration — passes conversationId to these routes)
    - Plan 28 (Chat Sidebar UI — renders messages persisted here)
tech_stack:
  added: []
  patterns:
    - fire-and-forget .then().catch() for non-blocking async after response
    - MAX+1 server-side sequence_number assignment (no client clocks)
    - defense-in-depth ownership verification (RLS + application-level check)
    - fullContent string accumulation (single DB write after stream closes, not per-chunk)
key_files:
  created: []
  modified:
    - src/app/api/chat/route.ts
    - src/app/api/generate/route.ts
decisions:
  - "User message saved before Gemini stream starts (not after) — persists even if stream is interrupted"
  - "Assistant message saved as fire-and-forget after controller.close() — no latency added to SSE UX"
  - "Preset upload uses .then().catch() (not await) before return NextResponse.json() — STORE-03 compliant"
  - "preset_url stores Supabase Storage object path, not full HTTPS URL — matches Phase 26 DELETE remove() contract"
  - "Ownership verified server-side before every message insert — defense-in-depth per STATE.md locked decision"
metrics:
  duration: "112s (~2 min)"
  completed_date: "2026-03-03"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 27 Plan 01: Persistence Wiring — Server Routes Summary

**One-liner:** Conditional message and preset persistence in /api/chat and /api/generate, gated behind conversationId with zero anonymous-flow change.

## What Was Built

Both stateless API routes now conditionally persist data to Supabase when a `conversationId` is present in the request body. When absent, the routes execute the exact v1.3 code path — no new awaits, no new Supabase client instantiation, no changed response shapes.

### /api/chat — Message Persistence

**Before streaming:**
1. Extract `conversationId` from body (optional — `undefined` = anonymous)
2. If present, `createSupabaseServerClient()` and `auth.getUser()`
3. Verify conversation ownership via `.eq("user_id", userId)` select
4. Query `MAX(sequence_number)` and insert user message with `nextSeq = max + 1`
5. Update `conversations.updated_at` for sidebar ordering

**After stream closes (`controller.close()`):**
6. Query `MAX(sequence_number)` again (user msg is now N)
7. Fire-and-forget `.then()` insert of assistant message with `sequence_number = N + 1`
8. No `await` — client already received `[DONE]`; this never blocks the SSE UX

**Key invariants:**
- `fullContent` accumulated as string during SSE loop — one DB write after stream, never per-chunk
- All persistence inside `if (conversationId)` — anonymous path is identical to v1.3
- SSE headers and response shape unchanged

### /api/generate — Preset Storage Upload

**After building hlxFile / pgpFile (both branches):**
1. If `conversationId` present, `createSupabaseServerClient()` and `auth.getUser()`
2. Compute `storagePath = {user_id}/{conversationId}/latest.{hlx|pgp}`
3. `Buffer.from(JSON.stringify(file))` → `storage.from("presets").upload(path, buf, { upsert: true })`
4. On upload success: `.update({ preset_url: storagePath })` on conversations row
5. `return NextResponse.json(...)` executes IMMEDIATELY — upload is non-blocking
6. Upload failure is non-fatal: logged via `console.error`, never returned to client

**Key invariants:**
- `storagePath` is the object path, NOT a full HTTPS URL (matches Phase 26 DELETE `remove()` contract)
- `.then().catch()` pattern — NOT `await` before return (STORE-03)
- Response payload is identical to v1.3 — no new fields, no `conversationId` echo
- `messages` array passed to `callClaudePlanner` is unchanged (prompt caching preserved)

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Add conditional message persistence to /api/chat | 63420e8 | src/app/api/chat/route.ts |
| 2 | Add conditional preset storage upload to /api/generate | 2f3007c | src/app/api/generate/route.ts |

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS — zero errors |
| chat imports createSupabaseServerClient | PASS |
| chat saves user message before stream starts | PASS |
| chat saves assistant message after controller.close() fire-and-forget | PASS |
| fullContent accumulated as string (not per-chunk) | PASS |
| generate imports createSupabaseServerClient | PASS |
| generate uploads with upsert: true | PASS |
| generate stores object path not full URL in preset_url | PASS |
| generate uses .then().catch() not await before return | PASS |
| both routes produce identical responses without conversationId | PASS |

## Deviations from Plan

None — plan executed exactly as written. Both route modifications match the PLAN.md action steps precisely.

## Requirements Satisfied

| Req ID | Description | Status |
|--------|-------------|--------|
| STORE-01 | Preset uploaded to storage with deterministic key, upsert on regeneration | Complete |
| STORE-03 | Storage upload non-blocking — response returns before upload completes | Complete |
| UXP-04 | Anonymous flow identical to v1.3 — gated behind if (conversationId) | Complete |
