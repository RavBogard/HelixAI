# HelixAI

## What This Is

An AI-powered tone consultant that interviews guitarists about the sound they're after — an artist, a song, a genre, a vibe, or their existing physical rig — then generates a downloadable preset file for Line 6 Helix LT, Helix Floor, Pod Go, and Helix Stadium. Presets must be world-class: mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

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

### Active

- [ ] Helix Stadium preset generation (file format and device constraints TBD via research)
- [ ] Helix Stadium device selector in UI + Stadium-specific download
- [ ] Helix Stadium model catalog (Stadium-available models only)
- [ ] Helix Stadium-specific chain rules (DSP limits, block constraints TBD)
- [ ] Rig emulation support for Helix Stadium
- [ ] Fix Helix Floor device ID regression (test expects 2162691 but types.ts has 2162692)

### Out of Scope

- HX Stomp support — different hardware constraints, defer to future
- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison UI — going single provider for quality focus
- Full pedalboard OCR (auto-detect all pedals from a single board photo) — too unreliable at launch, per-pedal photos are the baseline

## Current Milestone: v3.0 Helix Stadium Support

**Goal:** Extend HelixAI to generate presets for Line 6 Helix Stadium — a new device users are actively requesting. Stadium presets must match the professional tone quality standard of existing devices. Includes fixing the Helix Floor device ID regression.

**Target features:**
- Helix Stadium preset generation (format and constraints discovered via research)
- Helix Stadium model catalog (Stadium-available models only)
- Helix Stadium-specific chain rules (DSP limits, block constraints)
- Helix Stadium in the device selector with correct download
- Rig emulation support for Stadium (extends existing rig emulation)
- Fix Helix Floor device ID regression (types.ts 2162692 vs test expecting 2162691)

## Context

v1.0 rebuilt the entire preset engine from scratch: type contracts, Knowledge Layer (chain rules, param engine, snapshot engine), AI integration with Claude Sonnet 4.6 structured output, end-to-end orchestration, frontend polish, and hardening.

v1.1 fixed hardware-facing bugs, added prompt caching, genre-aware effect defaults, smarter snapshot toggling, and signal chain visualization.

v1.2 added full Pod Go support: .pgp format, Mono/Stereo model catalog, device-aware chain rules, and Pod Go in the device selector.

v1.3 added rig emulation: Claude Vision pedal extraction, 53-entry curated mapping table, text rig parsing, substitution card UI, and progressive loading states. Works for all three devices.

Key architecture: Planner-Executor pattern where Claude selects creative model choices (~15 fields in ToneIntent) and the deterministic Knowledge Layer generates all parameter values. This separation ensures tone quality is encoded in code, not dependent on AI accuracy.

v2.0 added the full persistence layer: Google auth (anonymous-first), Supabase database (conversations + messages), preset file storage, chat sidebar UI (resume/continue), dual-amp preset generation, and chat auto-save. The app is now a persistent platform.

v3.0 targets Helix Stadium — a new Line 6 device users are actively requesting. The Planner-Executor architecture is well-suited for device extension: research will determine the file format and constraints, then the Knowledge Layer is extended to cover Stadium.

## Constraints

- **Hardware**: Line 6 Helix LT, Helix Floor, Pod Go, Helix Stadium — specific file formats (.hlx, .pgp, Stadium format TBD)
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
| Helix Stadium as v3.0 | Users actively requesting it; clean device-extension pattern established by Pod Go v1.2 | — Pending |

---
*Last updated: 2026-03-04 after v3.0 milestone start*
