# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v2.0 — Persistent Chat Platform

**Shipped:** 2026-03-04
**Phases:** 7 (24-30) | **Plans:** 16 | **Timeline:** 2-day sprint (2026-03-03 → 2026-03-04)

### What Was Built

- **Supabase SSR infrastructure** — browser/server client factories, RLS-enabled DB schema (conversations + messages), Storage bucket, session-refreshing middleware, Vercel keep-alive cron
- **Anonymous-first Google OAuth** — `linkIdentity()` preserves UUID across redirect, PKCE callback route, sessionStorage state preservation with TTL
- **Conversation CRUD API** — 6 endpoints with defense-in-depth auth, RLS, server-side sequence numbers, 404-not-403 ownership isolation
- **Persistence wiring** — messages + presets to DB/Storage non-blocking in `/api/chat` and `/api/generate`; full conversation lifecycle in page.tsx via `conversationIdRef` pattern
- **Chat sidebar** — CSS translateX toggle, conversation resume, optimistic delete with rollback, sign-in banner (UXP-01), loading state, continuation chips
- **Dual-amp preset generation** — split/join AB topology, independent param resolution, per-snapshot bypass toggle, Zod schema-level enforcement
- **Chat auto-save** — first AI response triggers auto-creation, auto-title from first 7 user words, deferred sidebar refresh after PATCH resolves

### What Worked

- **Planner-Executor architecture paid off for persistence layer** — adding a persistence layer orthogonally to the existing engine required zero changes to the Knowledge Layer; clean separation meant zero preset quality regression
- **Defense-in-depth is correct** — independently verifying auth in each route handler (against CVE-2025-29927 middleware bypass) was the right call; auditor confirmed all 7 API routes are protected
- **`useRef` for async state sync** — `conversationIdRef` pattern completely eliminated race conditions on first message send; a non-obvious but essential pattern for React async state in SSE contexts
- **CSS translateX sidebar** — no remount, no re-fetch on every toggle; correct for a sidebar that fetches conversations once; would have been expensive with `display: none`
- **Custom window events for cross-component comms** — `helixtones:before-signin` / `helixtones:conversation-created` / `helixtones:new-chat` decoupled Server Component layout.tsx from Client Component page.tsx cleanly
- **GSD audit caught real functional bug** — MISS-01 (UXP-01 sign-in banner OAuth CTA) was a silent non-functional CTA that would have shipped broken; integration checker found it by tracing event dispatch chains

### What Was Inefficient

- **REQUIREMENTS.md deleted before archival** — the original v2.0 REQUIREMENTS.md was replaced by v3.0 REQUIREMENTS.md before v2.0 audit could trace it; forced 3-source reconstruction from VERIFICATION.md + SUMMARY.md + ROADMAP.md
- **SAVE-01 through SAVE-04 not in REQUIREMENTS.md** — Phase 30 requirements were never registered in the requirements file, creating a documentation gap discovered only during audit; plan phase should include requirement registration as a gate
- **Phases 29-30 weren't in v2.0 milestone at original planning time** — dual-amp and auto-save were added mid-milestone, explaining the gap between phases 28 and 29/30 in the milestone definition; milestone boundaries should be set more conservatively

### Patterns Established

- **Defense-in-depth auth pattern** — every route handler calls `supabase.auth.getUser()` independently; middleware is not the security boundary
- **Fire-and-forget `.then().catch()` for non-blocking async** — saves to DB/Storage happen after response without blocking the user; error goes to `.catch()` and is swallowed (acceptable for prestorage)
- **`useRef` for synchronous access to async-updated state** — when closures need the latest value in callbacks, `useRef` is the correct tool over `useState`
- **404 not 403 for non-owned resources** — consistent policy across all CRUD routes prevents existence leakage
- **RLS + application-level check = defense-in-depth** — Supabase RLS is a safety net; explicit `eq('user_id', user.id)` filters in application code are the primary check

### Key Lessons

1. **Audit milestone before declaring done** — the GSD integration checker found MISS-01 that would have shipped as a silent broken CTA; milestone audit is not optional
2. **Archive REQUIREMENTS.md before starting next milestone** — losing the v2.0 requirements file before archival created avoidable reconstruction work
3. **Register requirements in REQUIREMENTS.md when phases are added mid-milestone** — Phase 30's SAVE-01 through SAVE-04 were never registered; add requirement IDs to REQUIREMENTS.md when phase is planned, not just when executed
4. **`linkIdentity()` vs `signInWithOAuth()` matters** — for anonymous users, `linkIdentity()` preserves the UUID; `signInWithOAuth()` creates a new user; the distinction is critical for data continuity
5. **UXP bugs are functionally silent** — the sign-in banner dispatched the state event (so sessionStorage worked) but never triggered OAuth; UI testing can't catch this; requires integration tracing of the full event → auth flow

### Cost Observations

- Model: 100% Claude Sonnet 4.6 (GSD balanced profile)
- Notable: 7 phases completed in 2 days with parallel plan execution; persistence layer is always the most session-expensive milestone due to cross-system wiring complexity

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | Established Planner-Executor architecture and Knowledge Layer |
| v1.1-v1.3 | 15 | Incremental device extension; rig emulation proved Planner adapts cleanly to new inputs |
| v2.0 | 7 | First GSD milestone audit; integration checker caught functional bug; persistence orthogonal to Knowledge Layer |

### Cumulative Quality

| Milestone | Tests | Notable |
|-----------|-------|---------|
| v1.0 | 50 | Established test suite for Knowledge Layer |
| v2.0 | 100+ | Persistence layer tested via API integration; audit confirmed 44/45 → 45/45 after fix |

### Top Lessons (Verified Across Milestones)

1. **Planner-Executor separation** — AI selects model choices, Knowledge Layer generates all parameter values; this keeps AI errors from degrading preset quality; confirmed correct across 4 milestones
2. **Device extension is additive** — each new device (Pod Go, Stadium, Stomp) requires only Knowledge Layer extension + new builder; the AI integration, chat flow, and persistence layer require zero changes
3. **GSD milestone audit is worth the overhead** — caught a real functional gap (UXP-01) in v2.0 that would have shipped as a broken CTA

---

*Created: 2026-03-04 after v2.0 milestone completion*
