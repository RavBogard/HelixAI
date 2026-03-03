# Feature Research

**Domain:** Persistent chat platform — auth, chat history, file storage, chat sidebar UI
**Researched:** 2026-03-03
**Confidence:** HIGH (based on direct analysis of ChatGPT, Claude.ai, Gemini UX patterns; Supabase and Firebase official docs; LibreChat and assistant-ui open-source implementations; multiple corroborating sources per finding)

---

## Context: What Already Exists vs. What This Milestone Adds

HelixAI v1.3 is a **stateless** app. Every page load is a fresh session — no user identity, no saved chats, no memory of previous conversations. The existing flow is:

```
Page load (anonymous) → chat interview → preset generated → download .hlx/.pgp → session ends
```

v2.0 adds a persistence layer **on top of** the existing flow. The anonymous generate-and-download experience must remain fully intact. Login unlocks history only — it does not gate the core product.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of any chat persistence platform expect. Missing these = product feels broken or incomplete. These are established norms set by ChatGPT, Claude.ai, and Gemini.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Conversation list sidebar** | Every major chat AI (ChatGPT, Claude, Gemini) shows a left sidebar with past conversations. Users arriving from those products will immediately look for it. | MEDIUM | Pull-out or persistent left panel. Shows conversation title + timestamp. Must collapse on mobile. |
| **Auto-generated conversation title** | ChatGPT, Claude, and Gemini all auto-title conversations from the first message. Users expect this — manually naming every chat is a friction point. | LOW | Generate title from first user message or first AI response. A short summary (5-8 words) is sufficient. No second AI call needed — derive from the first message text client-side. |
| **New chat button** | Users expect a clear "New Chat" affordance in the sidebar or header. Without it, there's no way to start fresh without knowing to reload the page. | LOW | Button in sidebar header or top of nav. Clears current session, optionally saves current chat if authenticated. |
| **Conversation resumption** | Returning to a past chat and continuing the interview is the core user value of persistence. Without it, history is read-only — useful but limited. | HIGH | Must reload the full message history into the chat state, restore the device selection, and allow continued conversation with context intact. The API must re-establish conversation context for the AI. |
| **Delete conversation** | All major chat platforms offer delete. Users expect to manage their history. Missing it feels like the app is keeping data without giving control. | LOW | Confirm dialog + optimistic removal from sidebar. Soft-delete with a brief undo window is best practice, but immediate delete is acceptable for v2.0. |
| **Google sign-in** | Google auth is the path of least resistance for a tool aimed at guitarists who likely have Google accounts. Password-based auth adds signup friction with no benefit for this use case. | LOW | NextAuth.js or Supabase Auth both support Google OAuth natively. Auth should be a single "Sign in with Google" button. |
| **Anonymous-first flow** | The existing anonymous generate-and-download experience must be preserved. Requiring login before the app does anything is a conversion killer. Users who just want a preset should never be forced to log in. | LOW (UX logic) / MEDIUM (data model) | Anonymous users get full functionality. Login prompt appears contextually — e.g., after first preset download, with copy like "Save this chat to your account." Must not break on logout or session expiry. |
| **Session persistence across refreshes** | Once logged in, users expect to still be logged in after closing and reopening the browser. Cookie-based or token-based session that doesn't expire frequently. | LOW | Standard OAuth token refresh. Supabase and NextAuth both handle this. Not a custom implementation concern. |
| **Last-preset re-download** | If a user returns to a past chat, they expect to be able to re-download the preset they generated. Without this, history is purely conversational — the actual product deliverable is lost. | MEDIUM | Store the most recent .hlx/.pgp file per conversation in cloud storage (Supabase Storage or Vercel Blob). A "Download Preset" button in the resumed chat view re-fetches from storage. |

---

### Differentiators (Competitive Advantage)

Features that go beyond what's expected. These are where HelixAI can do better than a generic chat UI by leveraging its guitar/preset domain.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Device context preserved in chat history** | When a user resumes a conversation, the device selector (Helix LT / Helix Floor / Pod Go) should restore to what it was during that chat. Generic chat platforms don't have device context — HelixAI does. | LOW | Store `deviceTarget` as metadata per conversation. Restore it when resuming. Prevents the jarring experience of returning to a "Helix LT" chat and accidentally downloading a Pod Go preset. |
| **Preset metadata in sidebar** | Show the device type and maybe the tone style alongside the conversation title in the sidebar (e.g., "Edge Delay Tone · Helix LT"). Generic chat sidebars show only titles. This makes a guitar preset tool's history immediately more useful. | LOW | Store `deviceTarget` and first-message-derived title. Optionally extract genre/style from ToneIntent for richer labels. |
| **Contextual sign-in prompt after preset download** | Rather than front-loading login, prompt after the user's first successful preset download: "Save this chat to your account so you can come back and refine it." This is the highest-value moment to request auth. | LOW | Trigger after `downloadFile()` fires. Show a non-blocking banner or tooltip. Users have already received value — they're most receptive to an account pitch here. |
| **Continuation prompts in resumed chats** | When a user returns to a saved chat, show a suggested action: "Refine this tone," "Try a different amp," "Generate for Pod Go instead." Helps users know what to do with the resumed context. Gemini does this with Gems. | MEDIUM | Rendered as pre-filled suggestion chips below the chat input on resume. No AI call needed — static suggestions based on chat state. |
| **Conversation search** | ChatGPT Plus has it; free tiers don't surface it prominently. For a user who has 20+ saved chats ("Stevie Ray Vaughan tone," "post-rock reverb," "clean Nashville"), search is genuinely useful. | MEDIUM | Full-text search on conversation titles and first messages. Supabase provides Postgres full-text search natively. Not essential for MVP but high value at 10+ chats. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time sync / live updates across tabs** | Power users may have the app open in multiple tabs | Adds Supabase Realtime subscription complexity for minimal benefit. HelixAI is a single-user, sequential interaction tool — not a collaborative platform. The complexity is not justified at this scale. | Simple refresh-on-focus or reload conversation list on tab visibility change. No WebSocket subscription needed. |
| **Conversation folders / project grouping** | Claude has "Projects," ChatGPT has project-level memory | Significant UX and data model complexity. Users of a specialized guitar preset tool are unlikely to have enough chats to need folder organization before simpler search is sufficient. Premature organizational features add clutter. | Auto-chronological grouping (Today, This Week, Earlier) in the sidebar is sufficient. Add search before folders. |
| **Version history / all preset versions per chat** | Users want to download the preset from "three turns ago" | Storage cost grows unbounded. The most recent preset is what matters — users iterate toward it. Storing every intermediate generation creates storage bills and a confusing download UX ("which version is the good one?"). | Store only the most recent .hlx/.pgp per conversation. This is explicitly scoped in PROJECT.md. |
| **Email/password auth** | Some users may prefer not to use Google | Adds password reset flows, email verification, security surface area. For a v2.0 launch with a single dev, Google OAuth is the right call — one auth provider, battle-tested flow, zero password management. | Google OAuth only. Add additional providers only if there's explicit user demand and bandwidth to implement. |
| **Cross-conversation memory ("remember I play a Les Paul")** | ChatGPT has cross-conversation memory; users expect parity | Memory that persists across all chats is a different product — it changes the AI interaction model, adds a separate management UI, and creates privacy expectations. HelixAI's value is in per-conversation expertise, not a persistent user profile. | Per-conversation context is sufficient. If a user wants the AI to remember their guitar, they mention it in the chat. |
| **Chat sharing / permalink** | Users want to share a preset conversation link | Shared conversations require public access controls, potentially exposing the AI prompt engineering, and creating moderation concerns. The preset file download is the shareable artifact. | Share the .hlx/.pgp file directly. No conversation sharing in v2.0. |
| **Offline mode / local-first storage** | Users in low-connectivity environments | Service worker + IndexedDB complexity for a server-dependent AI app. The AI calls require internet anyway — offline mode is false comfort. LibreChat's own issue tracker documents how sidebar sync breaks offline. | Clear "you're offline" state. Don't fake offline capability. |
| **Bulk delete / conversation export** | Power users want to clean up or backup history | Data export is a GDPR concern, not a feature. Bulk delete is a UX edge case. Both are v3+ concerns if user demand materializes. | Single-conversation delete with confirm is sufficient at v2.0 scale. |

---

## Feature Dependencies

```
Google Auth
    └──required by──> Conversation Persistence
                          └──required by──> Conversation List Sidebar
                                                └──required by──> New Chat Button (sidebar)
                                                └──required by──> Delete Conversation (sidebar)
                                                └──required by──> Resume Conversation

Resume Conversation
    ├──requires──> Conversation history stored in database (messages + device target)
    └──requires──> Chat state restoration logic (load messages into existing UI)

Last-Preset Re-download
    ├──requires──> Cloud file storage (Supabase Storage or Vercel Blob)
    ├──requires──> Preset stored on generation (not just at download time)
    └──requires──> Signed URL or storage URL returned on conversation resume

Anonymous-First Flow
    ├──compatible with──> Full existing generate-and-download experience
    └──transition to──> Authenticated flow when user signs in
       └──requires──> Anonymous session data optionally migrated on first login

Auto-Generated Title
    ├──requires──> First user message (already available in message array)
    └──enhances──> Conversation List Sidebar (display quality)

Device Context in Chat History
    ├──requires──> `deviceTarget` stored per conversation (database field)
    └──enhances──> Resume Conversation (restores correct device selector state)

Contextual Sign-In Prompt
    ├──requires──> Post-download event hook in existing download flow
    └──enhances──> Auth conversion rate (not required for auth to work)
```

### Dependency Notes

- **Auth is the root dependency.** Without Google sign-in, nothing else in this milestone is buildable. Auth must land first, in isolation, before any persistence features are attempted.
- **Conversation persistence requires auth but is independent of file storage.** Message history (text) and file storage (binary .hlx/.pgp) are separate concerns. Message history should be implemented before file storage — text is simpler, lower cost, and validates the database schema.
- **Resume conversation is the highest-complexity feature.** It requires loading messages into existing chat state, restoring device context, re-establishing AI conversation context (the AI must know what was said before), and potentially re-rendering substitution cards and signal chain visualization. Plan dedicated implementation time.
- **Sidebar can render before resume is complete.** The conversation list (read-only titles + dates) is useful even if clicking a conversation doesn't resume it yet. Consider phasing: list first, resume second.
- **Anonymous flow must not regress.** Every change to the auth layer must be tested against the anonymous path. The existing generate-and-download experience is the product's core — persistence is additive, not a replacement.

---

## MVP Definition

This milestone's MVP is the minimum set of features that transforms HelixAI from stateless to persistent while keeping the anonymous flow intact.

### Launch With (v2.0)

- [ ] **Google sign-in** — Single "Sign in with Google" button. Session persists across refreshes. Required before all other persistence features.
- [ ] **Anonymous flow unchanged** — Existing generate-and-download works without login. No auth gate on any existing functionality.
- [ ] **Conversation list sidebar** — Pull-out panel showing saved chats (title + timestamp + device). Visible only when authenticated. Collapsible.
- [ ] **New chat button** — In sidebar header. Creates a fresh session, saves current in-progress chat if authenticated.
- [ ] **Auto-generated conversation title** — Derived from first user message. No extra AI call.
- [ ] **Conversation persistence (messages)** — Full message history saved per conversation in database. Authenticated users' chats are saved automatically.
- [ ] **Device target stored per conversation** — `deviceTarget` (helixLT / helixFloor / podGo) saved as conversation metadata.
- [ ] **Resume conversation** — Click a sidebar item to reload its messages and device context into the chat UI.
- [ ] **Last-preset re-download** — Most recent .hlx/.pgp stored in cloud storage. "Download Preset" button in resumed chat re-fetches the file.
- [ ] **Delete conversation** — Confirm dialog, remove from sidebar, delete messages and stored preset from storage.
- [ ] **Contextual sign-in prompt** — Non-blocking prompt after first preset download for anonymous users: "Sign in to save this chat."

### Add After Validation (v2.x)

- [ ] **Conversation search** — Add once users have enough history that scrolling the sidebar becomes unwieldy (10+ chats).
- [ ] **Continuation suggestions on resume** — Suggestion chips ("Refine this tone," "Try a different amp") shown when loading a past conversation.
- [ ] **Preset metadata in sidebar** — Show device type alongside conversation title once device storage is confirmed working.

### Future Consideration (v3+)

- [ ] **Conversation export** — Export full message history as JSON or PDF. GDPR-relevant but not urgent.
- [ ] **Additional auth providers** — GitHub, Apple, email/password — only if Google OAuth proves to be a meaningful barrier.
- [ ] **Conversation search with full text** — Postgres full-text search on message content, not just titles.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Google sign-in | HIGH (gateway feature) | LOW | P1 |
| Anonymous flow preserved | HIGH (must not regress) | LOW (guard, not build) | P1 |
| Conversation persistence (messages) | HIGH (core value) | MEDIUM | P1 |
| Conversation list sidebar | HIGH (discoverability) | MEDIUM | P1 |
| New chat button | HIGH (navigation) | LOW | P1 |
| Auto-generated title | MEDIUM (polish) | LOW | P1 |
| Resume conversation | HIGH (core value) | HIGH | P1 |
| Device target stored per conversation | HIGH (correctness) | LOW | P1 |
| Last-preset re-download | HIGH (core value) | MEDIUM | P1 |
| Delete conversation | MEDIUM (expected by users) | LOW | P1 |
| Contextual sign-in prompt | MEDIUM (conversion) | LOW | P1 |
| Continuation suggestions on resume | MEDIUM (UX) | MEDIUM | P2 |
| Preset metadata in sidebar | LOW (polish) | LOW | P2 |
| Conversation search | MEDIUM (utility at scale) | MEDIUM | P2 |

**Priority key:**
- P1: Must have for v2.0 launch — without these, the milestone is incomplete
- P2: Should have — add after P1 features are working and tested
- P3: Nice to have — defer to v2.x or v3+

---

## Competitor Feature Analysis

How ChatGPT, Claude.ai, and Gemini handle the patterns relevant to this milestone:

| Feature | ChatGPT | Claude.ai | Gemini | HelixAI v2.0 Approach |
|---------|---------|-----------|--------|----------------------|
| Sidebar layout | Persistent left panel, collapsible | Persistent left panel, collapsible | Collapsible left panel | Pull-out sidebar panel; collapse on mobile |
| Conversation list grouping | Chronological (Today / Yesterday / Previous 7 Days / etc.) | Chronological with Projects grouping | Chronological | Chronological grouping only — Today / This Week / Earlier |
| Auto-naming | AI-generated title from first exchange | AI-generated title | AI-generated title | Derived from first user message text (no second AI call) |
| Manual rename | Yes (inline edit on hover) | Yes | Yes | Defer to v2.x — auto-title is sufficient for v2.0 |
| Delete | Immediate with 30-day recovery window | Immediate | Immediate | Immediate with confirm dialog; no recovery window in v2.0 |
| Archive | Yes (distinct from delete) | No | No | Not in v2.0 — delete is sufficient |
| Anonymous access | No (login required) | No (login required) | No (login required) | YES — full functionality without login |
| Auth providers | Google, Microsoft, Apple, email | Google, Apple, email | Google only (tied to Google account) | Google only for v2.0 |
| File storage | Files in Projects, 30-day retention | Files per conversation, limited retention | Files in conversations | One .hlx/.pgp stored per conversation in Supabase Storage |
| Resume conversation | Yes — full message history restored | Yes — full message history restored | Yes | Yes — restore messages + device context |
| Cross-conversation memory | Yes (opt-in) | Yes (via Projects) | Yes | No — per-conversation context only |
| Search | Yes (ChatGPT Plus) | No | Limited | v2.x — after user feedback |
| Mobile sidebar | Collapsible overlay | Collapsible overlay | Collapsible overlay | Collapsible overlay |
| Offline state | Error banner, retry | Error banner, retry | Error banner | Error banner; no offline capability |

---

## Critical UX Findings from Research

### 1. Anonymous-first is the right call

All three major chat platforms (ChatGPT, Claude, Gemini) require login before any usage. HelixAI's anonymous-first approach is a genuine differentiator — users can generate and download a preset before ever creating an account. This is the correct strategy for a specialized tool where the value is proven first, account is created second. Research confirms: "The app should provide basic functionality to let the user explore and use features that do not require any additional data or access."

### 2. Conversation deletion is the most common platform failure point

Multiple platforms (Claude.ai, Gemini, GitHub Copilot, Cursor) have documented conversation history loss bugs. The #1 user complaint across all platforms is: "My conversations disappeared and I didn't do it." The implication for HelixAI: never silently delete conversations. Deletion must be explicit (confirm dialog), and sidebar state must accurately reflect database state. Don't implement cold storage tiering — at HelixAI's scale, all conversations should be immediately accessible.

### 3. Optimistic updates are expected for sidebar interactions

Users expect the sidebar to update instantly when they delete, rename, or create a conversation. Waiting for a server round-trip before updating the UI (e.g., removing a deleted conversation from the list) feels broken. Use optimistic updates with rollback on error. TanStack Query or React's `useOptimistic` hook are the implementation patterns used by real chat apps.

### 4. Resume conversation is architecturally harder than it looks

The chat input, message history, device selector state, substitution card state, and signal chain visualization all need to be restored from stored data. The AI conversation context also needs to be reconstructed — the AI doesn't remember previous conversations, so resuming requires either sending the full message history as context or accepting that the AI response quality degrades on resume. Sending full history is the correct approach.

### 5. Store only the last preset per conversation

ChatGPT's approach of storing file attachments for 30 days and providing recovery windows is appropriate for a general-purpose platform. For HelixAI, the simpler model — one .hlx/.pgp per conversation, always the most recent — matches user mental models ("what's the preset for this chat?"). The research validates PROJECT.md's decision: balance between utility and storage cost.

---

## Sources

- [Comparing Conversational AI Tool User Interfaces 2025 — IntuitionLabs](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025) — MEDIUM confidence (editorial analysis of ChatGPT, Claude, Gemini sidebar UX patterns)
- [Claude.ai Conversation History Loss Issue — GitHub](https://github.com/anthropics/claude-code/issues/14225) — HIGH confidence (official issue tracker, firsthand UX failure documentation)
- [ChatGPT Chat and File Retention Policies — OpenAI Help Center](https://help.openai.com/en/articles/8983778-chat-and-file-retention-policies-in-chatgpt) — HIGH confidence (official OpenAI documentation)
- [Google OAuth Best Practices — Google Developers](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) — HIGH confidence (official Google documentation on incremental authorization, anonymous-first patterns)
- [Login & Signup UX 2025 Guide — Authgear](https://www.authgear.com/post/login-signup-ux-guide) — MEDIUM confidence (industry guide, multiple corroborating sources)
- [Supabase Anonymous Sign-Ins — Supabase Docs](https://supabase.com/docs/guides/auth/auth-anonymous) — HIGH confidence (official Supabase documentation)
- [Use Supabase Auth with Next.js — Supabase Docs](https://supabase.com/docs/guides/auth/quickstarts/nextjs) — HIGH confidence (official Supabase documentation)
- [Supabase Storage — Supabase Docs](https://supabase.com/docs/guides/storage) — HIGH confidence (official Supabase documentation)
- [Firebase vs Supabase 2025 — DEV Community](https://dev.to/dev_tips/firebase-vs-supabase-in-2025-which-one-actually-scales-with-you-2374) — MEDIUM confidence (community analysis, multiple sources agree on Firebase anonymous auth maturity)
- [Supabase vs Firebase Auth for Next.js — GetSabo](https://getsabo.com/blog/supabase-vs-firebase-auth) — MEDIUM confidence (comparison article, corroborated by official docs)
- [Optimistic Updates for Conversation Deletion — OpenHands PR #6745](https://github.com/All-Hands-AI/OpenHands/pull/6745) — HIGH confidence (production implementation, real open-source chat app)
- [Optimistic Updates and Error Handling — Scira](https://zread.ai/zaidmukaddam/scira/22-optimistic-updates-and-error-handling) — MEDIUM confidence (open-source AI chat app implementation reference)
- [Chat Persistence — Chainlit Docs](https://docs.chainlit.io/data-persistence/history) — HIGH confidence (official Chainlit documentation confirming auth + persistence co-dependency)
- [Supabase + Next.js AI Chatbot — supabase-community GitHub](https://github.com/supabase-community/vercel-ai-chatbot) — HIGH confidence (official community reference implementation)
- [Gemini Conversation Deletion Bug — Google Support Forum](https://support.google.com/gemini/thread/410679684/) — HIGH confidence (official Google support forum, documents deletion sync failures)
- [ChatGPT Memory Controls — OpenAI](https://openai.com/index/memory-and-new-controls-for-chatgpt/) — HIGH confidence (official OpenAI blog, memory architecture details)

---

*Feature research for: HelixAI v2.0 Persistent Chat Platform Milestone*
*Researched: 2026-03-03*
