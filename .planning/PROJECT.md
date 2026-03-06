# HelixAI

## What This Is

An AI-powered tone consultant that interviews guitarists about the sound they're after — an artist, a song, a genre, a vibe, or their existing physical rig — then generates a downloadable preset file for Line 6 Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, and HX Stomp XL. Presets must be world-class: mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

## Core Value

Generated presets must sound professional enough to compete with custom presets that people pay experts for — not "decent starting points" but genuinely great tones that sit in a mix immediately.

## Requirements

### Validated

- ✓ Chat-based tone interview flow — v1.0
- ✓ .hlx file generation that loads on Helix LT/Floor — v1.0
- ✓ Warm Analog Studio frontend design — v1.0
- ✓ Vercel deployment pipeline — existing
- ✓ Google Search grounding for artist/rig research — existing
- ✓ World-class preset tone quality (mix-ready, category-specific params) — v1.0
- ✓ Dynamic responsiveness (volume knob cleanup, natural breakup via SAG/Bias) — v1.0
- ✓ Professional signal chain engineering (deterministic chain rules) — v1.0
- ✓ Correct cab filtering and EQ (LowCut 80-100Hz, HighCut 5-8kHz) — v1.0
- ✓ Pro-grade amp parameter settings by category (clean/crunch/high-gain) — v1.0
- ✓ Always-on utility blocks (Minotaur/Scream 808 boost, post-cab EQ, noise gate) — v1.0
- ✓ Snapshot design with volume-balanced scenes (Clean/Rhythm/Lead/Ambient) — v1.0
- ✓ Helix LT + Helix Floor support — v1.0
- ✓ Claude Sonnet 4.6 as single AI provider with structured output — v1.0
- ✓ Rebuilt preset engine (planner-executor architecture) — v1.0
- ✓ Refined frontend (device selector, single-preset UX) — v1.0
- ✓ Stomp @fs_enabled fix + @pedalstate bitmask computation — v1.1
- ✓ Prompt caching for ~50% API cost reduction — v1.1
- ✓ Genre-aware effect parameter defaults — v1.1
- ✓ Smarter snapshot effect toggling via intentRole — v1.1
- ✓ Signal chain visualization + tone description card — v1.1
- ✓ Daniel Bogard branding footer — v1.1
- ✓ Pod Go preset generation (.pgp format, device 2162695) — v1.2
- ✓ Pod Go device selector in UI + .pgp download — v1.2
- ✓ Pod Go-specific signal chain rules (single DSP, 4-effect limit) — v1.2
- ✓ Pod Go model catalog with Mono/Stereo suffix convention — v1.2
- ✓ Device-filtered planner prompt (Pod Go only sees Pod Go models) — v1.2
- ✓ Rig emulation: text description + pedal photo upload in tone interview — v1.3
- ✓ Claude Vision pedal extraction with confidence tiers — v1.3
- ✓ Pedal mapping engine (53-entry curated table, 3-tier match logic) — v1.3
- ✓ Substitution card UI with transparent mapping rationale — v1.3
- ✓ Knob zone translation (physical knobs → Helix parameter values) — v1.3
- ✓ Rig emulation for Helix LT, Helix Floor, and Pod Go — v1.3

- ✓ Google authentication with anonymous-first flow (login unlocks persistence) — v2.0
- ✓ Chat persistence — full conversation history stored per user in Supabase — v2.0
- ✓ Last-preset storage — most recent .hlx/.pgp saved per conversation in storage — v2.0
- ✓ Chat sidebar UI — pull-out panel listing past chats, like ChatGPT/Claude — v2.0
- ✓ Resume conversations — re-open a chat, continue refining, regenerate with tweaks — v2.0
- ✓ Anonymous usage remains fully functional without login — v2.0
- ✓ Dual-amp preset generation (AB topology, split/join blocks) — v2.0
- ✓ Chat auto-save on first AI response — v2.0
- ✓ Helix Stadium preset generation (.hsp format, device 2162696) — v3.0
- ✓ Helix Stadium device selector in UI + .hsp download — v3.0
- ✓ Helix Stadium model catalog (Agoura amps, 7-band Parametric EQ) — v3.0
- ✓ Helix Stadium-specific chain rules (dual DSP, extended block limits) — v3.0
- ✓ Rig emulation support for Helix Stadium — v3.0
- ✓ HX Stomp & HX Stomp XL support (.hlx format, 6-block budget) — v3.1
- ✓ HelixTones rebrand (HelixAI → HelixTones) — v3.1
- ✓ Chat UX polish (device picker timing, conversational arc) — v3.1
- ✓ Token usage logging with cost estimation (usage-logger.ts) — v3.2
- ✓ 36-preset deterministic baseline generator — v3.2
- ✓ Cache hit rate report for prompt caching analysis — v3.2
- ✓ Fixed footer pinned to viewport bottom — v3.2
- ✓ Variax guitar support (reactive chat, ToneIntent, .hlx injection, device guard) — v3.2
- ✓ Post-download donation card with PayPal/Venmo/CashApp — v3.2
- ✓ Bug fixes: dual-DSP key collision, fire-and-forget DB errors, Stadium amp lookup — v3.2

- ✓ Stadium .hsp builder rebuilt from 11 real preset corpus (5 format bugs fixed) — v4.0
- ✓ Stadium device selection unblocked in UI — v4.0
- ✓ Planner prompt enrichment (gain-staging, cab pairing, effect discipline) — v4.0
- ✓ Per-model amp parameter overrides (18 amps, AmpFamily, cabAffinity, Layer 4) — v4.0
- ✓ Effect parameter intelligence (guitar-type EQ, reverb PreDelay, tempo-scaled delay) — v4.0
- ✓ Architecture review: device/model abstraction (6 devices, refactor deferred) — v4.0
- ✓ Helix Floor device ID fix (error 8309 corrected) — v4.0
- ✓ Tech debt: spring reverb PreDelay, cabAffinity in planner prompt, system model constants — v4.0

- ✓ Device-first conversation architecture — device picker at start, per-device prompt/model/chain paths — v5.0
- ✓ Stadium firmware parameter completeness — all 27+ params from real .hsp corpus, no param bleed — v5.0
- ✓ Device-specific planner prompts — each device has own prompt with only its model catalog — v5.0
- ✓ Device-specific model catalogs — Stadium sees only Agoura, HD2 sees only HD2, zero cross-contamination — v5.0
- ✓ Per-family catalog isolation — src/lib/helix/catalogs/{family}-catalog.ts with typed tuples — v5.0
- ✓ Frontend device picker + DB migration — device column, picker UI, end-to-end device wiring — v5.0
- ✓ Stomp prompt cache unification — helix_stomp and helix_stomp_xl share byte-identical system prompt — v5.0
- ✓ Token control and prompt caching analysis — cost correction, per-device cache reporting, prompt size tooling — v5.0
- ✓ Stadium Mono/Stereo effect suffix fix — firmware requires suffixed model IDs on all effect blocks — v5.0

### Active

- [ ] Expression pedal controller assignment — wah and volume blocks non-functional, EXP_PEDAL constants unused — v6.0
- [ ] Per-model effect selection intelligence — AI prompts guide model choice within categories, not just category selection — v6.0
- [ ] Per-device preset craft optimization — device-specific tone goals, constraints, and best practices in prompts — v6.0
- [ ] Effect combination logic — interaction params, genre-appropriate combinations, comp→drive→mod→delay→reverb craft — v6.0
- [ ] Preset quality validation — per-device baseline comparison, parameter audit, end-to-end tone verification — v6.0
- [ ] Cost-aware model routing (evidence-based Haiku chat vs. Sonnet generation) — deferred from v4.0

### Out of Scope

- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison UI — going single provider for quality focus
- Full pedalboard OCR (auto-detect all pedals from a single board photo) — too unreliable, per-pedal photos are the baseline
- Parallel wet/dry routing (split/join paths) — deferred

## Current Milestone: v6.0 — Preset Craft Mastery

**Goal:** Comprehensive audit and improvement of preset quality across all device families — fix broken expression pedal controllers (wah/volume non-functional), add per-model effect intelligence to AI prompts, optimize per-device preset craft, implement effect combination logic, and deliver significantly better out-of-box tones that compete with paid professional presets.

**Target features:**
- Expression pedal controller assignment for wah and volume blocks (currently completely non-functional)
- Per-model effect selection intelligence — AI guided to pick the RIGHT model within each category, not just any model
- Per-device preset craft optimization — device-specific tone goals, signal chain best practices, constraint handling
- Effect combination logic — how effects interact (comp→drive gain staging, delay→reverb order, genre-appropriate choices)
- Preset quality validation framework — per-device baseline comparison and parameter audit

## Current State

All 6 devices fully supported with device-first architecture. The app is **HelixTones** and supports: Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, and HX Stomp XL. v5.0 completed the device-first architecture — per-device prompts, catalogs, chain rules, frontend picker, DB migration, and Stadium Mono/Stereo suffix fix. Preset generation works end-to-end for all devices, but deep quality analysis reveals: (1) expression pedal controllers never assigned (wah/volume non-functional), (2) AI treats all effects in a category as interchangeable (no per-model guidance), (3) no effect combination intelligence, (4) no per-device craft optimization in prompts.

**Shipped milestones:**
- v1.0: Full Rebuild — planner-executor engine, LT/Floor support
- v1.1: Polish & Precision — bugs, prompt caching, genre defaults, visualization
- v1.2: Pod Go Support — .pgp format, device catalog, chain rules
- v1.3: Rig Emulation — pedal vision extraction, mapping engine, substitution card
- v2.0: Persistent Chat Platform — Supabase auth/DB/storage, chat sidebar, dual-amp, auto-save
- v3.0: Helix Stadium Support — .hsp format, Stadium builder, model catalog, chain rules, rig emulation
- v3.1: HX Stomp/XL, HelixTones rebrand, Chat UX polish (Phases 39-41)
- v3.2: Infrastructure, Features & Audit Tooling — token logging, Variax, donation, footer, bug fixes
- v4.0: Stadium Rebuild + Preset Quality Leap — Stadium .hsp rebuild, planner enrichment, amp overrides, effect intelligence, architecture audit
- v5.0: Device-First Architecture — per-device prompts/catalogs/chain-rules, frontend picker, DB migration, Stadium firmware params, Mono/Stereo suffix fix

## Context

v1.0 rebuilt the entire preset engine from scratch: type contracts, Knowledge Layer (chain rules, param engine, snapshot engine), AI integration with Claude Sonnet 4.6 structured output, end-to-end orchestration, frontend polish, and hardening.

v1.1 fixed hardware-facing bugs, added prompt caching, genre-aware effect defaults, smarter snapshot toggling, and signal chain visualization.

v1.2 added full Pod Go support: .pgp format, Mono/Stereo model catalog, device-aware chain rules, and Pod Go in the device selector.

v1.3 added rig emulation: Claude Vision pedal extraction, 53-entry curated mapping table, text rig parsing, substitution card UI, and progressive loading states. Works for all three devices.

Key architecture: Planner-Executor pattern where Claude selects creative model choices (~15 fields in ToneIntent) and the deterministic Knowledge Layer generates all parameter values. This separation ensures tone quality is encoded in code, not dependent on AI accuracy.

v2.0 added the full persistence layer: Google auth (anonymous-first), Supabase database (conversations + messages), preset file storage, chat sidebar UI (resume/continue), dual-amp preset generation, and chat auto-save. The app is now a persistent platform.

v3.0 added Helix Stadium support: .hsp format (JSON-encoded same as .hlx), Stadium-specific model catalog (Agoura amps, 7-band Parametric EQ), chain rules, preset builder, planner integration, UI device picker, and rig emulation. Stadium uses the same Planner-Executor pattern — research confirmed the file format, then the Knowledge Layer was extended.

Phases 39-41 (v3.1) added HX Stomp and HX Stomp XL support, rebranded the product to HelixTones, and improved the chat UX (device picker only appears after AI signals readiness).

v3.2 added token usage audit tooling (usage-logger.ts, baseline generator, cache report), Variax guitar support (reactive detection, ToneIntent schema, .hlx block injection with device guard), post-download donation card (PayPal/Venmo/CashApp), fixed footer positioning, and critical bug fixes (dual-DSP key collision, fire-and-forget DB errors, Stadium amp lookup). Stadium device selection was temporarily blocked pending a builder rebuild from real .hsp files.

v4.0 rebuilt the Stadium .hsp builder from real preset corpus (11 reference presets), fixing 5 structural format bugs (param encoding, slot-grid allocation, fx types, cab params, device version). Also delivered a major preset quality improvement: planner prompt enriched with gain-staging intelligence, amp-to-cab pairing, and genre effect discipline; per-model amp parameter overrides with AmpFamily classification and Layer 4 mechanism; effect intelligence with genre PreDelay, tempo-synced delay, and guitar-type EQ shaping. Architecture audit confirmed device abstraction is functional at 6 devices. Helix Floor error 8309 fixed (device ID corrected). Tech debt cleanup closed remaining integration gaps.

Post-v4.0 bug triage (2026-03-05) revealed three architectural issues: (1) Stadium presets only include 12 of 27 firmware params per amp — missing hidden params like AmpCabPeak*, AmpCabShelf*, Aggression, Bright, Contour, Depth, Fat, Hype cause param state to bleed from previously loaded presets; (2) AMP_NAMES includes both HD2 and Agoura names globally, letting the planner pick Agoura amps for non-Stadium devices; (3) the late device-selection pattern means all prompts, models, and chain rules must handle every device with guard-based branching. v5.0 addresses all three by moving device selection to the start of the flow and creating fully device-specific paths.

## Constraints

- **Hardware**: Line 6 Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, HX Stomp XL — file formats: .hlx (LT/Floor/Stomp/StompXL), .pgp (Pod Go), .hsp (Stadium)
- **Deployment**: Vercel (free tier), serverless functions for AI calls — image payload size matters
- **Frontend**: Next.js + TypeScript + Tailwind CSS, keep Warm Analog Studio design
- **AI Provider**: Claude Sonnet 4.6 — supports vision input natively (base64 images in messages API)
- **Image limits**: Vercel serverless body limit ~4.5MB — must validate/compress uploads client-side
- **Mapping quality**: Physical pedal → Helix model mapping must be curated, not guessed — encyclopedic knowledge of guitar gear required

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full rebuild over incremental fixes | Current preset engine is fundamentally mid — patching won't get to world-class | ✓ Good |
| Single AI provider (Claude Sonnet 4.6) | Focus produces better results than spreading across 3 providers | ✓ Good |
| Helix LT + Floor over LT-only | Same .hlx format, no extra work, bigger audience | ✓ Good |
| Keep Warm Analog Studio frontend | Design is strong, just needs polish — no reason to throw it away | ✓ Good |
| Planner-Executor architecture | AI selects models (~15 fields), Knowledge Layer generates all params deterministically | ✓ Good |
| Pod Go as v1.2 (not v2.0) | Building on existing architecture, not replacing — new device is additive | ✓ Good |
| Rig emulation as part of the tone interview | No new mode — the chat detects rig descriptions and switches into emulation mode naturally | ✓ Good |
| Per-pedal photos over full pedalboard OCR | Per-pedal is reliable; whole-board OCR too error-prone for v1.3 | ✓ Good |
| Reverse "no user accounts" for v2.0 | Product matured enough that persistence adds clear user value — users want to iterate on presets | ✓ Good |
| Anonymous-first auth model | Non-logged-in users get full functionality; login unlocks persistence only | ✓ Good |
| Save last preset per chat (not all versions) | Balance between utility and storage cost — one .hlx/.pgp per conversation | ✓ Good |
| Supabase for auth/database/storage | Single isomorphic SDK, anonymous sign-in with identity linking, generous free tier | ✓ Good |
| Helix Stadium as v3.0 | Users actively requesting it; clean device-extension pattern established by Pod Go v1.2 | ✓ Good |
| HX Stomp/StompXL as Phase 39 | Same .hlx format as LT/Floor — additive extension, no milestone boundary needed | ✓ Good |
| Rebrand to HelixTones | Brand name better reflects scope beyond just "Helix AI" — also covers Pod Go, Stadium, Stomp | ✓ Good |
| Device picker after AI readiness signal | AI asks at least one follow-up before [READY_TO_GENERATE] — richer conversation before preset | ✓ Good |
| Variax as input config, not signal chain block | Variax is @input:3 (Multi), not a separate block — matches real hardware behavior | ✓ Good |
| Reactive-only Variax detection | Chat AI never asks about Variax unprompted — only responds when user mentions it | ✓ Good |
| Rename shipped v4.0 to v3.2 | Core quality phases (43-47) weren't started; reserve v4.0 for the real quality leap + Stadium rebuild | ✓ Good |
| **[v4.0] Architecture refactor: DEFERRED → v5.0** | v4.0 audit found 17+ guard sites functional at 6 devices. Now superseded by v5.0 device-first architecture which eliminates guards by routing to device-specific modules from conversation start | ✓ Superseded |
| **[v4.0] Stadium builder: rebuild from corpus** | Real .hsp files revealed 5 format bugs in original builder (wrong param encoding, sequential block keys, missing cab params). Corpus-driven development > implementation-by-analogy | ✓ Good |
| **[v4.0] Per-model amp overrides: Layer 4 mechanism** | paramOverrides on HelixModel entries apply after category defaults — per-model values win unconditionally. 18 amps populated with verified values | ✓ Good |
| **[v4.0] Effect combination logic: DEFERRED to v4.1** | Requires context-passing architectural decision (comp→drive, mod→reverb interactions). Core quality levers shipped first | — Pending |
| **[v4.0] Cost-aware model routing: DEFERRED to v4.1** | Requires 30-day baseline and A/B quality comparison with 20+ diverse tone goals before switching any model | — Pending |
| **[v4.0] Stadium I/O model constants: COMPLETED** | Phase 60 moved Stadium I/O model IDs from string literals to STADIUM_CONFIG constants and centralized Helix/PodGo system model IDs | ✓ Good |

---
*Last updated: 2026-03-06 after v6.0 milestone start*
