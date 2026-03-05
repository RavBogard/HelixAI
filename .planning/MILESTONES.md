# Milestones: HelixAI

## v1.0 — Full Rebuild (Complete)

**Goal:** Rebuild the preset engine from scratch to produce world-class, mix-ready tones.

**Shipped:**
- Foundation types, verified @type constants, expanded model database
- Knowledge Layer: chain rules, param engine, snapshot engine (50 tests)
- AI Integration: Claude Sonnet 4.6 with constrained ToneIntent structured output
- Orchestration: end-to-end .hlx generation with strict validation
- Frontend Polish: device selector (LT/Floor), single-preset UX, Warm Analog Studio design
- Hardening: firmware config parameterization, DSP limit enforcement, openai removal

**Phases:** 1-6 (14 plans total)
**Completed:** 2026-03-02

## v1.1 — Polish & Precision (Complete)

**Goal:** Fix hardware-facing bugs, deepen preset intelligence, and give users a window into what they're downloading.

**Shipped:**
- Hardware bug fixes: @fs_enabled, @pedalstate bitmask, .hlx format audit
- Prompt caching for ~50% API input cost reduction
- Genre-aware effect parameter defaults (delay time, reverb mix, modulation rate)
- Smarter snapshot effect toggling via intentRole
- Signal chain visualization + tone description card
- Daniel Bogard branding footer

**Phases:** 7-11 (7 plans total)
**Completed:** 2026-03-02

## v1.2 — Pod Go Support (Complete)

**Goal:** Extend HelixAI to generate presets for Line 6 Pod Go — a single-DSP device with different block limits, file format, and model catalog. Pod Go presets must match the same professional tone quality standard as Helix presets.

**Shipped:**
- Pod Go file format (.pgp) with correct device ID, block types, and I/O structure
- Pod Go model catalog with Mono/Stereo suffixed effect IDs and device-filtered model list
- Device-aware chain rules (single DSP, 4-effect limit, no auto-inserted EQ/Gain blocks)
- Pod Go preset builder with 4 volume-balanced snapshots and shared param-engine quality
- Pod Go in device selector UI with .pgp download and 4-snapshot display

**Phases:** 12-16
**Completed:** 2026-03-02

## v1.3 — Rig Emulation (Complete)

**Goal:** Extend the tone interview to accept physical rig descriptions — text, pedal photos, or both — and generate a Helix/Pod Go preset that emulates the user's actual gear with transparent substitution mapping.

**Shipped:**
- Zod schemas for rig intent, physical pedal, substitution entry/map
- Pedal mapping engine with 53-entry curated table and 3-tier match logic
- Vision extraction API via Claude Sonnet 4.6 with client-side image compression
- Planner integration with toneContext injection and text rig parsing
- Substitution card UI with progressive loading states
- Works for Helix LT, Helix Floor, and Pod Go

**Phases:** 17-21 (5 plans total)
**Completed:** 2026-03-02

## v2.0 — Persistent Chat Platform (Complete)

**Goal:** Transform HelixAI from a stateless generate-and-download tool into a persistent platform where users log in with Google, maintain a sidebar of past conversations, pick up where they left off, and re-download their most recent preset per chat. Anonymous usage remains fully functional; login unlocks history.

**Shipped:**
- Supabase SSR infrastructure: browser/server client factories, RLS-enabled DB schema (conversations + messages), Storage bucket, session-refreshing middleware, Vercel keep-alive cron
- Anonymous-first Google OAuth via `linkIdentity()` — preserves UUID across redirect; PKCE callback; sessionStorage state preservation
- Conversation CRUD API: 6 endpoints with defense-in-depth auth, RLS, server-side sequence numbers, storage cleanup
- Persistence wiring: messages + presets saved to DB/Storage in `/api/chat` and `/api/generate`; full conversation lifecycle in page.tsx
- Chat sidebar: CSS translateX toggle, conversation resume, optimistic delete, sign-in banner, loading state, continuation chips
- Dual-amp preset generation: split/join AB topology, independent param resolution, per-snapshot bypass toggle, structural validation
- Chat auto-save: first AI response triggers conversation creation and sidebar refresh with auto-title

**Phases:** 24-30 (7 phases, 16 plans)
**Files changed:** 61 files, +6,983 / -506 lines
**Completed:** 2026-03-04

**Archives:**
- `.planning/milestones/v2.0-ROADMAP.md`
- `.planning/milestones/v2.0-REQUIREMENTS.md`
- `.planning/milestones/v2.0-MILESTONE-AUDIT.md`

## v3.0 — Helix Stadium Support (Complete)

**Goal:** Add full Helix Stadium preset generation — .hsp format, Stadium-specific model catalog (Agoura amps, 7-band Parametric EQ), chain rules, preset builder, and rig emulation.

**Shipped:**
- Stadium .hsp file format (JSON-encoded, device 2162696)
- Agoura amp catalog and 7-band Parametric EQ models
- Stadium-specific chain rules (dual DSP, extended block limits)
- Stadium preset builder with correct file structure
- Rig emulation support for Stadium
- HX Stomp & HX Stomp XL support (.hlx format, 6-block budget)
- HelixTones rebrand (HelixAI -> HelixTones)
- Chat UX polish (device picker timing, conversational arc)

**Phases:** 31-41 (11 phases)
**Completed:** 2026-03-04

## v3.2 — Infrastructure, Features & Audit Tooling (Complete)

**Goal:** Token usage audit tooling, Variax guitar support, donation integration, fixed footer, and bug fixes. Originally scoped as part of v4.0 Preset Quality Leap — quality improvement phases deferred to the real v4.0.

**Shipped:**
- Token usage logging with env-flag guard and cost estimation (usage-logger.ts)
- 36-preset deterministic baseline generator across all 6 devices
- Cache hit rate report script for prompt caching analysis
- Fixed footer component pinned to viewport bottom on all screens
- Variax guitar support: reactive chat detection, ToneIntent schema, .hlx block injection, device guard
- Post-download donation card with PayPal/Venmo/CashApp buttons
- Footer "Support" link for donation card re-display
- Bug fixes: dual-DSP key collision, fire-and-forget DB errors, Stadium amp lookup

**Phases:** 42, 48-51 (5 phases, 8 plans)
**Files changed:** 48 files, +5,858 / -1,968 lines
**Completed:** 2026-03-05

**Archives:**
- `.planning/milestones/v3.2-ROADMAP.md`
- `.planning/milestones/v3.2-REQUIREMENTS.md`
- `.planning/milestones/v3.2-MILESTONE-AUDIT.md`

---
*Last updated: 2026-03-05*
