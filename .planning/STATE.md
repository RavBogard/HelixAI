---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Persistent Chat Platform
status: roadmap_complete
last_updated: "2026-03-03T00:00:00Z"
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-03)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v2.0 — Persistent Chat Platform (Phase 24 next)

## Current Position

Phase: 24 (not started)
Plan: —
Status: Roadmap complete — ready for /gsd:plan-phase 24
Last activity: 2026-03-03 — v2.0 roadmap created (phases 24-28)

Progress: [----------] 0/5 phases complete

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
| 24. Supabase Foundation | TBD | Not started |
| 25. Auth Flow | TBD | Not started |
| 26. Conversation CRUD API | TBD | Not started |
| 27. Persistence Wiring | TBD | Not started |
| 28. Chat Sidebar UI + UX Polish | TBD | Not started |

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

### Roadmap Evolution

- Phases 22-23 (UI Overhaul, UX Polish) dropped — user did a UI redo, skipping these
- v2.0 Persistent Chat Platform milestone started; roadmap phases 24-28 created 2026-03-03

### Pending Todos

1. **Investigate Helix Floor device compatibility bug** (ui) — Users report "incompatible device type" when selecting Floor; LT works fine

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-03
Stopped at: v2.0 roadmap created — 5 phases defined, ready to plan Phase 24
Resume file: None
Next command: /gsd:plan-phase 24
