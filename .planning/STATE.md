---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-04T03:51:18.363Z"
progress:
  total_phases: 21
  completed_phases: 18
  total_plans: 37
  completed_plans: 36
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-04T03:47:19.577Z"
progress:
  total_phases: 21
  completed_phases: 18
  total_plans: 37
  completed_plans: 36
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: in_progress
last_updated: "2026-03-03T23:30:00.000Z"
progress:
  total_phases: 20
  completed_phases: 16
  total_plans: 33
  completed_plans: 32
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-03T23:09:54.186Z"
progress:
  total_phases: 20
  completed_phases: 15
  total_plans: 33
  completed_plans: 30
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-03T23:03:27.764Z"
progress:
  total_phases: 19
  completed_phases: 15
  total_plans: 33
  completed_plans: 29
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-03T22:59:38.905Z"
progress:
  total_phases: 19
  completed_phases: 15
  total_plans: 33
  completed_plans: 29
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: unknown
last_updated: "2026-03-03T22:54:31.115Z"
progress:
  total_phases: 19
  completed_phases: 14
  total_plans: 33
  completed_plans: 28
---

---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: in_progress
last_updated: "2026-03-03T22:47:00Z"
progress:
  total_phases: 19
  completed_phases: 14
  total_plans: 33
  completed_plans: 27
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v2.0 — Persistent Chat Platform (Phase 26 complete, Phase 27 next)

## Current Position

Phase: Phase 35 — Stadium Builder (next)
Plan: —
Status: Phase 34 complete (108/108 tests, clean build, committed). Phase 35 next.
Last activity: 2026-03-04 — Phase 34 complete: Stadium chain rules (Agoura amp lookup, Stadium 7-band EQ mandatory, 12-block limit), validate.ts Stadium branch, getAllModels() includes Stadium catalogs

## Performance Metrics

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | 3 | Complete |
| 2. Knowledge Layer | 3 | Complete |
| 3. AI Integration | 2 | Complete |
| 4. Orchestration | 2 | Complete |
| 5. Frontend Polish | 2 | Complete |
| 6. Hardening | 2 | Complete |

**By Phase (v1.1):**

| Phase | Plans | Status |
|-------|-------|--------|
| 7. Hardware Bug Fixes | 2 | Complete |
| 8. Prompt Caching | 1 | Complete |
| 9. Genre-Aware Defaults | 1 | Complete |
| 10. Snapshot Toggling | 1 | Complete |
| 11. Frontend Transparency | 2 | Complete |

**By Phase (v1.2):**

| Phase | Plans | Status |
|-------|-------|--------|
| 12. Format Foundation and Types | 1 | Complete |
| 13. Pod Go Model Catalog | 1 | Complete |
| 14. Chain Rules, Validation, Planner | 1 | Complete |
| 15. Pod Go Preset Builder | 1 | Complete |
| 16. Integration, UI, Testing | 1 | Complete |

**By Phase (v1.3):**

| Phase | Plans | Status |
|-------|-------|--------|
| 17. Schemas & Types Foundation | 1 | Complete |
| 18. Pedal Mapping Engine | 1 | Complete |
| 19. Vision Extraction API | 1 | Complete |
| 20. Planner Integration & Orchestration | 1 | Complete |
| 21. Substitution Card & End-to-End Polish | 1 | Complete |

**By Phase (v2.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 24. Supabase Foundation | 3 | Complete — client utils + middleware, schema SQL + keep-alive, env vars verified + build clean |
| 25. Auth Flow | 2 plans | Complete — AuthButton + Google OAuth linkIdentity() + human verification passed |
| 26. Conversation CRUD API | 2 plans | Complete — POST create, GET list, GET read-with-messages, PATCH title, POST message, DELETE conversation |
| 27. Persistence Wiring | 2 plans | Complete — /api/chat + /api/generate server persistence + page.tsx client lifecycle wiring |
| 28. Chat Sidebar UI + UX Polish | 3 plans | Complete — sidebar shell, conversation navigation, UX polish (sign-in banner, loading state, continuation chips) |
| 29. Dual-Amp Preset Generation Fix | 3 plans | Complete — dual-amp structural validation, DSP budget logic, correct chain generation |
| 30. Chat Auto-Save on First AI Response | 1 plan | Complete — deferred sidebar refresh to after auto-title PATCH; generate flow now persists messages |
| Phase 27 P01 | 112s | 2 tasks | 2 files |
| Phase 27-persistence-wiring P02 | 145 | 2 tasks | 1 files |
| Phase 28 P01 | 2 | 2 tasks | 3 files |
| Phase 28 P02 | 4 | 2 tasks | 1 files |
| Phase 28-chat-sidebar-ui-ux-polish P03 | continuation | 3 tasks | 1 files |
| Phase 30 P01 | 5 | 2 tasks | 1 files |

## Accumulated Context

### Decisions

- [v1.0]: Planner-Executor architecture — AI generates ToneIntent (~15 fields), deterministic Knowledge Layer generates all parameter values
- [v1.0]: 3-layer amp param resolution: model defaults -> category overrides -> topology adjustment
- [v1.1]: @pedalstate computed from block states per snapshot using bitmask
- [v1.1]: Genre defaults applied as outermost resolution layer
- [v1.1]: intentRole flows from EffectIntent through chain-rules into BlockSpec
- [v1.2]: Pod Go is additive v1.2, not a v2.0 rewrite — build on existing architecture
- [v1.2]: podgo-builder.ts lives in src/lib/helix/ (not a separate directory) — devices share the same HD2 engine
- [v1.2]: chain-rules.ts accepts deviceTarget parameter; builder and validator are separate functions per device
- [v1.2]: Pod Go effect model IDs use Mono/Stereo suffix convention derived from 18 real .pgp files
- [v1.2]: Planner prompt filtered by device — Pod Go only sees Pod Go-available models
- [v1.3]: Rig emulation lives in the tone interview — chat detects rig descriptions, no separate mode
- [v1.3]: Per-pedal photos over full pedalboard OCR — more reliable for v1.3
- [v1.3]: blockType in PedalMapEntry is a lowercase string, not a BLOCK_TYPES number
- [v1.3]: Vision route uses manual JSON extraction (extractJson) not output_config
- [v1.3]: browser-image-compression dynamically imported inside callVision()
- [v1.3]: toneContext appended to user message only (not system prompt) — preserves prompt caching
- [v2.0]: Supabase chosen as auth/database/storage provider — single isomorphic SDK, anonymous sign-in with identity linking, no credit card required for free tier
- [v2.0]: @supabase/ssr (not deprecated auth-helpers-nextjs) for cookie-based session handling in App Router
- [v2.0]: Anonymous-first auth model — signInAnonymously() on mount; linkIdentity() upgrades same UUID when user signs in with Google (user ID does not change, pre-login data migrates automatically)
- [v2.0]: Keep page.tsx as single-page interface (not dynamic routes) — conversationId lives in React state; URL search params for deep-linking
- [v2.0]: Sidebar mounted in layout.tsx not page.tsx — persists across navigations, avoids re-fetch on every render
- [v2.0]: Deterministic storage key presets/{user_id}/{conversation_id}/latest.hlx with upsert:true — one file per chat, overwrites on regeneration
- [v2.0]: sequence_number column assigned server-side for message ordering — never client-generated timestamps
- [v2.0]: RLS enabled at table creation time (not retrofitted) — CVE-2025-48757 prevention
- [v2.0]: Every API route handler independently verifies session — defense-in-depth against CVE-2025-29927 middleware bypass
- [v2.0]: Chat state serialized to sessionStorage before OAuth redirect, restored after callback — prevents anonymous session loss during identity linking
- [v2.0]: Phases 22-23 (UI Overhaul, UX Polish) dropped — user completed a UI redo externally
- [v2.0 24-01]: @supabase/ssr used (not deprecated auth-helpers-nextjs) for browser + server client factories
- [v2.0 24-01]: Middleware double-write pattern (setAll updates both request.cookies and supabaseResponse.cookies) — required for correct JWT propagation
- [v2.0 24-01]: Middleware uses getUser() not getSession() — contacts auth server to verify and refresh JWT
- [v2.0 24-01]: Root middleware has no blocking/redirect logic — each API route independently decides auth requirements
- [v2.0 24-02]: RLS enabled immediately after CREATE TABLE in same script — prevents any window of unprotected PostgREST API access
- [v2.0 24-02]: messages table has no user_id column — ownership enforced via conversation_id subquery to conversations
- [v2.0 24-02]: device column uses TEXT without CHECK constraint — flexibility for future device types
- [v2.0 24-02]: presets storage bucket is private — files accessible only via signed URLs; storage.foldername[1] = user_id
- [v2.0 24-02]: keep-alive route queries conversations table — HTTP-only pings do not reliably prevent Supabase 7-day pause
- [v2.0 24-03]: Vercel-only deployment — no local .env.local; verification uses npm run build not local dev server
- [v2.0 24-03]: Temporary test-session route deleted after verification — not deployed to production long-term
- [Phase 25-auth-flow]: x-forwarded-host checked for production URL construction — handles Vercel load balancer correctly
- [Phase 25-auth-flow]: Single useEffect for session init + state restoration — prevents race condition between getUser() and setMessages()
- [Phase 25-auth-flow]: serializeChatState() defined in page.tsx with useCallback — wired by Plan 02 AuthButton
- [Phase 25]: Event dispatch pattern ('helixai:before-signin') used instead of prop/context for AuthButton-to-page.tsx decoupling
- [v2.0 26-01]: Ownership failures return 404 not 403 — no existence leakage for resources the user does not own
- [v2.0 26-01]: POST /api/conversations returns 201 Created (not 200) — correct HTTP semantics for resource creation
- [v2.0 26-01]: GET list limited to 50 rows — prevents unbounded queries on large conversation sets
- [v2.0 26-01]: Title truncated server-side to 60 chars — client cannot bypass length constraint
- [v2.0 26-01]: Next.js 15+ Promise<{ id: string }> params pattern — avoids runtime "params is a promise" error
- [Phase 26-02]: preset_url stores storage object path (not full HTTPS URL) — DELETE handler uses supabase.storage.remove() with path; Phase 27 must write path not URL
- [Phase 26-02]: Storage delete failure is non-fatal — conversation row delete proceeds regardless of storage errors
- [Phase 27]: User message saved before Gemini stream starts (not after) — persists even if stream is interrupted
- [Phase 27]: Assistant message saved fire-and-forget after controller.close() — no latency added to SSE UX
- [Phase 27]: preset_url stores Supabase Storage object path not full HTTPS URL — matches Phase 26 DELETE remove() contract (enforced in 27-01)
- [Phase 27]: Preset upload fire-and-forget via .then().catch() before return NextResponse.json() — STORE-03 compliant non-blocking response
- [Phase 27-02]: conversationIdRef (useRef) used alongside conversationId (useState) — ref provides synchronous access in sendMessage/generatePreset closures, state provides React re-render trigger
- [Phase 27-02]: ensureConversation() returns null for anonymous users (is_anonymous: true) — preserves UXP-04, anonymous flow sends no conversationId
- [Phase 28-01]: ChatSidebar mounted in layout.tsx — persists without remount across navigations; CSS translateX toggle keeps conversation list in memory when sidebar closes
- [Phase 28-01]: Server-side isAuthenticated check in async layout.tsx — anonymous users see no sidebar, no client-side auth check needed
- [Phase 28]: useSearchParams used to read conversation URL param in page.tsx — URL param watcher triggers loadConversation, router.replace cleans URL after load
- [Phase 28 → Phase 30 override]: helixai:conversation-created dispatch MOVED from ensureConversation() to sendMessage()/generatePreset() success paths (Phase 30) — deferred to after auto-title PATCH for real title display
- [Phase 28]: isResumingConversation cleared on sendMessage/generatePreset — once user acts in resumed conversation, continuation chips (Plan 03) disappear
- [Phase 28-03]: showSignInBanner triggered when conversationId is null post-download — null conversationId is the anonymous user signal from Phase 27-02 contract
- [Phase 28-03]: isLoadingConversation cleared in finally block — ensures spinner always clears even if early-return branch fires
- [Phase 28-03]: Continuation chips rendered outside the form div at same nesting level — appears above input bar without being inside form element
- [Phase 28-03]: Generate-for-other-device chip avoids pod_go as alternate — always maps to helix_lt or helix_floor
- [Phase 30]: Phase 30: helixai:conversation-created dispatch moved from ensureConversation() to sendMessage() and generatePreset() success paths — fires after auto-title PATCH resolves, not on bare creation
- [Phase 30]: Phase 30: generate-only flow persists last user message + data.summary as assistant message fire-and-forget after /api/generate success

### Roadmap Evolution

- Phases 22-23 (UI Overhaul, UX Polish) dropped — user did a UI redo, skipping these
- v2.0 Persistent Chat Platform milestone started; roadmap phases 24-28 created 2026-03-03
- Phase 29 (Dual-Amp Preset Generation Fix) added — user reports presets requesting two different amps generate with only one; bug fix phase appended to v2.0
- Phase 39 added: HX Stomp Support

### Pending Todos

1. **Investigate Helix Floor device compatibility bug** (ui) — Users report "incompatible device type" when selecting Floor; LT works fine

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-04
Stopped at: v3.0 planning complete — REQUIREMENTS.md, ROADMAP.md (Phases 31-38), SUMMARY.md all written
Resume file: None
Next command: /gsd:plan-phase 31 (Device ID Research + Helix Floor Regression Fix)
