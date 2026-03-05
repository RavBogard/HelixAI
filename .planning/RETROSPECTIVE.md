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

## Milestone: v4.0 — Stadium Rebuild + Preset Quality Leap

**Shipped:** 2026-03-05
**Phases:** 9 (52-60) | **Plans:** 13 | **Timeline:** 1-day sprint (2026-03-05)

### What Was Built

- **Stadium .hsp builder rebuilt** — reverse-engineered 11 real .hsp presets, fixed 5 structural format bugs (param `{ value: X }` encoding, slot-grid allocation, fx type field, cab params, device version)
- **Planner prompt enrichment** — gain-staging intelligence (Drive/Master/ChVol relationships), amp-to-cab pairing table (8 families × canonical cabs), genre effect discipline (metal max 3, ambient MUST include reverb+delay)
- **Per-model amp parameter overrides** — AmpFamily classification (16 families), Layer 4 `paramOverrides` mechanism in resolveAmpParams(), 18 amps populated with verified values, non-MV amps get Master:1.0
- **Effect intelligence** — genre PreDelay (0.010-0.045 range), tempo-synced delay (30/BPM formula), guitar-type EQ shaping (additive deltas per guitarType), snapshot ChVol regression lock
- **Architecture audit** — 269-line audit of device/model abstraction across 12 source files; refactor deferred (guard-based branching functional at 6 devices)
- **Helix Floor fix** — device ID corrected from 2162691 to 2162689, fixing error 8309 for two users (Paul Morgan, Tal Solomon Vardy)
- **Tech debt closure** — spring reverb PreDelay: 0 key, cabAffinity wired into planner prompt, Stadium I/O + system model ID constants

### What Worked

- **Corpus-driven development** — rebuilding the Stadium builder from 11 real .hsp files caught 5 format bugs that implementation-by-analogy missed in v3.0; always start from ground truth
- **TDD across all quality phases** — 55→56→57→60 all followed strict RED→GREEN; every fix proved by a failing test first; caught edge cases (spring reverb missing PreDelay key) that manual testing would miss
- **Static prompt enrichment preserves cache** — gain-staging, cab pairing, and effect discipline sections are static text in shared prefix; zero cache fragmentation across 6 device variants
- **Milestone audit found real integration gaps** — INT-01 (orphaned cabAffinity data) and INT-02 (spring reverb PreDelay silently dropped) were non-obvious bugs that only the cross-phase audit detected
- **Phase 60 gap closure pattern** — running `audit-milestone` → `plan-milestone-gaps` created a clean Phase 60 that specifically addressed audit findings; process worked exactly as designed

### What Was Inefficient

- **Phase 59 lacks SUMMARY.md** — Helix Floor fix was done manually outside the GSD executor; work is committed but not documented in phase summary format, creating audit gaps
- **Missing VERIFICATION.md across phases 53-58** — formal verification documents were skipped for all v4.0 phases; the work was verified via tests but the paper trail is incomplete
- **Roadmap analyze counts all phases globally** — the CLI returned 31/45 phases instead of 9/13 for v4.0; milestone scoping in the CLI tool needs improvement

### Patterns Established

- **Layer 4 override mechanism** — per-model paramOverrides on HelixModel apply after category defaults; clean extension point for future model-specific tuning without touching resolveAmpParams logic
- **`if (key in params)` guard for genre defaults** — models must have a parameter key (even if value is 0) for genre defaults to apply; missing keys cause silent drops
- **Corpus-driven development** — when building format-specific code (builders, parsers), always start from real reference files, not documentation or analogy
- **Static enrichment in shared prompt prefix** — any prompt intelligence that doesn't vary per-device should be static text before conditional device sections to preserve prompt cache

### Key Lessons

1. **implementation-by-analogy creates format bugs** — v3.0 Stadium builder was built by analogy with Helix builder, producing 5 wrong assumptions; v4.0 proved that corpus inspection is the only reliable method
2. **GSD milestone audit catches cross-phase integration bugs** — neither INT-01 nor INT-02 was visible within any single phase; the audit's cross-phase tracing is essential
3. **PreDelay: 0 is different from missing PreDelay** — JavaScript `key in object` guard means default value must exist as a key for genre overrides to apply; this is a general principle for any optional-default parameter system
4. **Per-model quality requires per-model data** — 18 amps with individual paramOverrides produce meaningfully different presets; the effort to populate per-model data is worth it for tone quality
5. **Architecture refactor should be evidence-gated** — the v4.0 audit showed guard-based branching works at 6 devices with ~17 guard sites; deferring refactor until a 7th device is planned avoids premature abstraction

### Cost Observations

- Model: 100% Claude Sonnet 4.6 (GSD balanced profile)
- Notable: 9 phases completed in 1 day; Stadium rebuild + quality phases parallelized well; architecture audit was lightweight (documentation only, no code changes)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Key Change |
|-----------|--------|------------|
| v1.0 | 6 | Established Planner-Executor architecture and Knowledge Layer |
| v1.1-v1.3 | 15 | Incremental device extension; rig emulation proved Planner adapts cleanly to new inputs |
| v2.0 | 7 | First GSD milestone audit; integration checker caught functional bug; persistence orthogonal to Knowledge Layer |
| v3.0-v3.2 | 16 | Stadium support, HX Stomp, rebrand, Variax; device extension pattern confirmed across 6 devices |
| v4.0 | 9 | Corpus-driven rebuild; per-model quality data; milestone audit → gap closure pipeline proven |

### Cumulative Quality

| Milestone | Tests | Notable |
|-----------|-------|---------|
| v1.0 | 50 | Established test suite for Knowledge Layer |
| v2.0 | 100+ | Persistence layer tested via API integration; audit confirmed 44/45 → 45/45 after fix |
| v4.0 | 223 | TDD across all quality phases; 8 new tests closed INT-01/INT-02; spring reverb edge case caught |

### Top Lessons (Verified Across Milestones)

1. **Planner-Executor separation** — AI selects model choices, Knowledge Layer generates all parameter values; this keeps AI errors from degrading preset quality; confirmed correct across 8 milestones
2. **Device extension is additive** — each new device (Pod Go, Stadium, Stomp) requires only Knowledge Layer extension + new builder; the AI integration, chat flow, and persistence layer require zero changes
3. **GSD milestone audit is worth the overhead** — caught functional gaps in v2.0 (UXP-01 broken CTA) and v4.0 (INT-01 orphaned data, INT-02 spring reverb PreDelay); audit → gap closure pipeline is validated
4. **Corpus-driven development over analogy** — confirmed in v4.0: real reference files catch format assumptions that analogy-based implementation misses; applies to any format-specific code

---

*Created: 2026-03-04 after v2.0 milestone completion*
*Updated: 2026-03-05 after v4.0 milestone completion*
