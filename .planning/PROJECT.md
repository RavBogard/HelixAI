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

- ✓ Device-first conversation architecture — device picker at conversation start, per-family routing — v5.0
- ✓ Device-specific model catalogs — per-family catalog isolation, no Agoura→HD2 cross-contamination — v5.0
- ✓ Device-specific planner prompts — each family gets own prompt with its model catalog and constraints — v5.0
- ✓ Stadium firmware parameter completeness — all 27+ params per amp, param bleed eliminated — v5.0
- ✓ Family Router architecture — zero-guard device routing through per-family modules — v5.0
- ✓ Stadium integration quality — WAH/VOLUME catalog gap, dual-amp, schema/prompt integration tests — v5.0
- ✓ Token control and prompt caching optimization — per-device cache reporting, cost correction — v5.0

- ✓ Expression pedal assignments — wah→EXP1, volume→EXP2, per-device capability, snapshot conflict guard — v6.0
- ✓ Genre-informed effect model selection — per-genre delay/reverb/wah AI recommendations in planner prompt — v6.0
- ✓ Effect combination intelligence — wah+comp threshold, high-gain comp removal, genre-priority truncation, delay+reverb balance — v6.0
- ✓ Per-device craft optimization — Stomp 6-block, Pod Go 4-effect, Helix dual-DSP maximization, prompt alignment — v6.0
- ✓ Quality validation pipeline — non-throwing quality checks, per-preset warning logs, baseline comparison — v6.0
- ✓ Preset musical coherence — drive palette balance, reverb auto-insert, boost disambiguation, dynamics split — v6.0
- ✓ Device block budget calibration — correct maxEffectsPerDsp for all families, prompt alignment, truncation logging — v6.0

### Active

- [ ] Interactive signal chain visualization with device-specific layouts (dual DSP, single DSP, Pod Go fixed) — v7.0
- [ ] Drag-and-drop block reordering with hardware constraint validation — v7.0
- [ ] Block parameter editing with snapshot context (4 snapshots, base vs overlay) — v7.0
- [ ] Model swapping with deterministic default parameter hydration — v7.0
- [ ] Two-step API flow (/api/preview + /api/download) — v7.0
- [ ] UI parameter schema registry (151+ parameter-to-control mappings) — v7.0
- [ ] Controller assignment visualization and editing (EXP pedals, footswitches) — v7.0
- [ ] Parameter dependency engine (conditional show/hide based on parameter state) — v7.0
- [ ] Preset diffing for optimized download payloads — v7.0

### Out of Scope

- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison UI — going single provider for quality focus
- Full pedalboard OCR (auto-detect all pedals from a single board photo) — too unreliable, per-pedal photos are the baseline
- Parallel wet/dry routing (split/join paths) — deferred
- AI re-prompting on model swap — deterministic parameter hydration, no token consumption for edits
- Real-time audio preview — would require WebAudio integration; out of v7.0 scope
- Effect combination logic (interaction params, genre substitution) — deferred from v4.0
- Cost-aware model routing (Haiku chat vs Sonnet generation) — deferred from v4.0

## Current Milestone: v7.0 — Interactive Signal Chain Visualizer

**Goal:** Build an interactive, drag-and-drop signal chain visualizer and parameter editor between AI ToneIntent generation and .hlx download. Users visualize the exact block order, reorder blocks, swap models, edit deep parameters across 4 snapshots, and download the modified preset.

**Target features:**
- Interactive signal chain canvas with device-specific layouts (dual DSP rows, single DSP, Pod Go fixed architecture)
- Drag-and-drop block reordering with hardware constraint validation
- Click-to-edit parameter side panel with 151+ parameter type mappings
- Snapshot switcher (4 snapshots) with per-snapshot parameter overlays and bypass states
- Model swapping with deterministic default parameter hydration (no AI tokens consumed)
- Two-step API: /api/preview (generate visualizer state) and /api/download (compile modified state to .hlx/.pgp/.hsp)
- Controller assignment visualization (EXP pedals, footswitches with min/max and LED colors)
- Parameter dependency engine (Sync hides Time, Link disables Right params)
- Preset diffing for optimized download API payloads

## Current State

All 6 devices fully supported with world-class preset quality. HelixTones supports: Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, and HX Stomp XL. v5.0 delivered device-first architecture (per-family catalogs, prompts, chain rules — zero cross-device contamination). v6.0 delivered preset craft mastery (expression pedals, genre-informed effects, effect combinations, quality validation, musical coherence, block budget calibration — 32/32 requirements verified, 842 tests). Post-v6.0 bugsweep fixed Pod Go cab bypass bug, Autoswell misclassification, and quality-validate robustness issues.

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
- v5.0: Device-First Architecture — family router, per-family catalogs/prompts, Stadium firmware params, token control
- v6.0: Preset Craft Mastery — expression pedals, genre effects, effect combos, quality validation, musical coherence, block budgets

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

v5.0 (2026-03-06) delivered device-first architecture: family router pattern eliminated 17+ guard sites; per-family catalogs (src/lib/helix/catalogs/{family}-catalog.ts) completely isolated HD2 and Agoura model spaces; device-specific planner prompts ensured each device sees only its models; Stadium firmware parameter completeness extracted all 27+ amp params from real .hsp corpus. 9 phases (61-69), 17 plans, all verified.

v6.0 (2026-03-07) delivered preset craft mastery: expression pedal wiring (wah→EXP1, vol→EXP2 across all 4 builders), genre-informed effect model selection, effect combination intelligence (4 rules), per-device craft optimization, quality validation pipeline (11 checks), preset musical coherence (6 systemic issues resolved), and device block budget calibration. 7 phases (70-76), 15 plans, 32/32 requirements verified, 842 tests. Post-v6.0 bugsweep fixed 3 bugs: Pod Go cab bypass (snapshot key map), Autoswell misclassification, quality-validate robustness.

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
| **[v5.0] Family Router architecture** | Per-family module routing eliminates 17+ guard sites; each device follows its own code path from conversation start | ✓ Good |
| **[v5.0] Per-family catalog isolation** | HD2 and Agoura model spaces completely isolated; impossible for planner to pick wrong-era amps | ✓ Good |
| **[v6.0] Expression pedal wiring** | Deterministic wah→EXP1, volume→EXP2 mapping covers 95% of cases; per-device capability respected | ✓ Good |
| **[v6.0] Effect combination intelligence** | 4 interaction rules (wah+comp, high-gain dynamics, genre truncation, delay+reverb) as post-processing step | ✓ Good |
| **[v6.0] Quality validation pipeline** | Non-throwing quality checks with server-side warnings; enables baseline comparison without blocking generation | ✓ Good |
| **[v7.0] Deterministic parameter hydration over AI re-prompting** | Model swaps use Knowledge Layer defaults directly — no AI tokens consumed for parameter lookups | — Pending |
| **[v7.0] Two-step API (preview + download)** | Separates AI generation from user editing; only the download step compiles the final .hlx/.pgp/.hsp | — Pending |
| **[v7.0] Snapshot editing writes to overlay, not base** | Parameter changes in snapshot context write to parameterOverrides, preserving base state integrity | — Pending |

---
*Last updated: 2026-03-07 after v7.0 milestone start*
