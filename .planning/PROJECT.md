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

### Active

- [ ] Stadium preset rebuild from real .hsp files (reverse-engineer 11 real presets)
- [ ] Planner prompt enrichment (gain-staging, cab pairing, effect discipline)
- [ ] Per-model amp parameter overrides (family classification, master volume, cab affinity)
- [ ] Effect parameter intelligence (guitar-type EQ, reverb PreDelay, tempo-scaled delay)
- [ ] Effect combination logic (interaction params, genre substitution, cross-device validation)
- [ ] Cost-aware model routing (evidence-based Haiku chat vs. Sonnet generation)
- [x] Architecture review: device/model abstraction layer (6 devices, builders, catalogs, chain rules) — v4.0

### Out of Scope

- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison UI — going single provider for quality focus
- Full pedalboard OCR (auto-detect all pedals from a single board photo) — too unreliable, per-pedal photos are the baseline
- Parallel wet/dry routing (split/join paths) — deferred

## Current Milestone: v4.0 Stadium Rebuild + Preset Quality Leap

**Goal:** Rebuild Stadium preset generation from real .hsp files and deliver a major quality improvement across all devices through enriched planner prompts, per-model amp parameters, intelligent effect combinations, and an architecture review of the device/model abstraction layer.

**Target features:**
- Reverse-engineer 11 real Stadium .hsp presets to rebuild the builder from ground truth
- Unblock Stadium device selection in UI after builder is verified
- Planner prompt enrichment (gain-staging intelligence, cab pairing guidance, effect discipline)
- Per-model amp parameter overrides (family classification, master volume strategy, cab affinity)
- Effect parameter intelligence (guitar-type EQ, reverb PreDelay, tempo-scaled delay)
- Effect combination logic (interaction params, genre block substitution, cross-device validation)
- Cost-aware model routing (evidence-based model split: Haiku chat vs. Sonnet generation)
- Architecture review: evaluate device/model abstraction layer across all 6 devices and model catalogs

## Current State

All device support complete except Stadium (temporarily blocked). The app is rebranded to **HelixTones** and supports 6 devices: Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, and HX Stomp XL.

**Shipped milestones:**
- v1.0: Full Rebuild — planner-executor engine, LT/Floor support
- v1.1: Polish & Precision — bugs, prompt caching, genre defaults, visualization
- v1.2: Pod Go Support — .pgp format, device catalog, chain rules
- v1.3: Rig Emulation — pedal vision extraction, mapping engine, substitution card
- v2.0: Persistent Chat Platform — Supabase auth/DB/storage, chat sidebar, dual-amp, auto-save
- v3.0: Helix Stadium Support — .hsp format, Stadium builder, model catalog, chain rules, rig emulation
- v3.1: HX Stomp/XL, HelixTones rebrand, Chat UX polish (Phases 39-41)
- v3.2: Infrastructure, Features & Audit Tooling — token logging, Variax, donation, footer, bug fixes

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
| **[v4.0] Architecture refactor: DEFERRED** | v4.0 architecture audit (Phase 58) found device/model abstraction layer is functional and maintainable at 6 devices. Guard-based branching in chain-rules.ts, param-engine.ts, and validate.ts has no compiler-enforced exhaustiveness (~17 guard sites), but sites are searchable and well-tested. Low-effort improvements (Stadium I/O model ID constants, hardcoded model ID cleanup) recommended for a future maintenance phase. Full capability registry refactor deferred until a 7th device is planned. See: `.planning/architecture-audit-v4.md` | ✓ Recorded |

---
*Last updated: 2026-03-05 after Phase 58 architecture audit*
