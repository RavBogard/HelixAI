# Phase 30: Chat Auto-Save on First AI Response — Research

**Researched:** 2026-03-03
**Status:** Complete

## Problem Statement

User reports: "when I use the AI to generate a tone, it's not automatically saving as a chat / thread on the left. I had a chat, and then when I went to open another session, it wasn't there and it was gone. it needs to autosave on use like any AI. it should start autosaving after the first entry that is made in the chatbot, but only once a tone is generated."

## Architecture Analysis

### Current Conversation Lifecycle

1. **`ensureConversation()` (page.tsx L495-528)** — creates conversation via `POST /api/conversations` when:
   - `conversationIdRef.current` is null (no active conversation)
   - User is authenticated (not anonymous)
   - Returns `null` for anonymous users

2. **Called from two paths:**
   - `sendMessage()` (L543) — chat messages to `/api/chat`
   - `generatePreset()` (L648) — preset generation via `/api/generate`

3. **Message persistence (api/chat/route.ts):**
   - User message saved BEFORE streaming (L18-46) — only if `conversationId` is passed
   - Assistant message saved AFTER stream closes (L101-121) — fire-and-forget

4. **Auto-title (page.tsx L621-628):**
   - Fires after first message stream completes
   - Uses first 7 words of user's message
   - Fire-and-forget PATCH to `/api/conversations/[id]/title`
   - No sidebar refresh event after title is set

5. **Sidebar refresh:**
   - `helixai:conversation-created` dispatched after `ensureConversation()` success (L522)
   - ChatSidebar listens and calls `fetchConversations()` (ChatSidebar.tsx L41-44)
   - Only fires ONCE — when conversation is created
   - Does NOT fire again after title update

### Root Cause Analysis

**Bug 1: Sidebar shows "New Chat" title on creation, never updates to real title**

`ensureConversation()` creates the conversation with title "New Chat" (api/conversations/route.ts L26). The `helixai:conversation-created` event fires immediately, causing the sidebar to fetch and display "New Chat". The auto-title PATCH fires later (after the first AI response stream completes), but no event tells the sidebar to re-fetch. Result: sidebar shows "New Chat" which looks broken/empty to the user.

**Bug 2: Generate-only flow doesn't persist messages**

`handleRigGenerate()` creates a synthetic user message and calls `generatePreset()`. The `/api/generate` route does NOT save messages — it only saves the preset file. So a generate-only conversation has a row in `conversations` table but zero messages in `messages` table. When the user returns and loads this conversation, it appears empty.

**Bug 3: Timing — sidebar refresh fires before the conversation has meaningful content**

The `helixai:conversation-created` event fires right after `POST /api/conversations` returns, before any message is sent or any AI response is received. The user specified "it should start autosaving after the first entry that is made in the chatbot, but only once a tone is generated." This means the conversation should feel saved AFTER the AI responds, not before.

### Solution Design

**Fix 1: Dispatch sidebar refresh after auto-title completes**

After the fire-and-forget title PATCH in `sendMessage()`, dispatch a second `helixai:conversation-created` event so the sidebar re-fetches and shows the real title. This makes the sidebar show the actual conversation title instead of "New Chat".

**Fix 2: Save user message in generate-only flow**

When `generatePreset()` is called and has a `convId`, POST the user message to `/api/conversations/[id]/messages` so the conversation has content. This is the same endpoint already built in Phase 26. The generate API response summary can also be saved as an assistant message.

**Fix 3: Defer conversation creation to after first AI response**

Instead of creating the conversation at the START of `sendMessage()` (before the API call), consider creating it after the first successful AI response. However, this conflicts with the current architecture where `conversationId` is passed to `/api/chat` for message persistence.

**Better approach for Fix 3:** Keep creation timing as-is, but only dispatch `helixai:conversation-created` AFTER the auto-title succeeds. This way the conversation appears in the sidebar with a real title, not "New Chat", giving the impression of "saving after the first AI response."

### Files to Modify

| File | Changes |
|------|---------|
| `src/app/page.tsx` | Add sidebar refresh after auto-title; save messages in generate-only flow; improve auto-title quality |
| No API changes needed | All endpoints already exist (Phase 26-27) |
| No sidebar changes needed | ChatSidebar already listens for the right event |

### Constraints

- Anonymous users must NOT get conversations (existing `ensureConversation()` guard is correct)
- Must not break existing chat flow persistence (messages via `/api/chat` route)
- Must not add latency to the streaming UX
- Sidebar must show meaningful titles, not "New Chat"
- `helixai:conversation-created` event pattern already established — reuse it

## Key Findings

1. The conversation creation + persistence pipeline is wired correctly for the chat path (`sendMessage` -> `/api/chat`). The bug is primarily about **sidebar visibility** (title timing) and the **generate-only flow** (missing message persistence).

2. All API endpoints needed already exist — this is a **client-side wiring fix** only.

3. Single plan, single wave — all changes are in `page.tsx` with no external dependencies.

---

*Phase: 30-chat-auto-save-on-first-ai-response*
*Research completed: 2026-03-03*
