# HelixAI

## What This Is

An AI-powered tone consultant that interviews guitarists about the sound they're after — an artist, a song, a genre, a vibe, or their existing physical rig — then generates a downloadable preset file for Line 6 Helix LT, Helix Floor, and Pod Go. Presets must be world-class: mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

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

### Active

- [ ] Flexible rig input: text description, image upload, or both — in the existing tone interview chat
- [ ] Claude Vision analysis of pedal photos: extract model name and knob positions
- [ ] Rig-to-Helix/Pod Go model mapping with closest-match substitution logic
- [ ] Substitution summary card: each physical pedal → Helix block with reasoning
- [ ] Physical knob position → Helix parameter value translation
- [ ] Rig emulation mode works for Helix LT, Helix Floor, and Pod Go

### Out of Scope

- HX Stomp support — different hardware constraints, defer to future
- User accounts / preset saving — keep it simple, generate and download
- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison UI — going single provider for quality focus
- Full pedalboard OCR (auto-detect all pedals from a single board photo) — too unreliable at launch, per-pedal photos are the baseline

## Current Milestone: v1.3 Rig Emulation

**Goal:** Extend the tone interview to accept physical rig descriptions — text, pedal photos, or both — and generate a Helix/Pod Go preset that emulates the user's actual gear, with transparent substitution mapping.

**Target features:**
- Image upload in the chat UI (one or more pedal photos with visible knob positions)
- Claude Vision extracts pedal model name + knob positions from each photo
- Rig description parser handles text input (e.g., "TS9 → Blues Breaker → Fender Twin Reverb")
- Rig-to-Helix mapping layer: physical pedal names → closest Helix/Pod Go models
- Knob position translator: physical knob percentages → Helix parameter values
- Substitution card in the results UI: "TS9 Tube Screamer → Teemah! — closest gain structure and mid-hump EQ"
- Works for Helix LT, Helix Floor, and Pod Go (same device selector)

## Context

v1.0 rebuilt the entire preset engine from scratch: type contracts, Knowledge Layer (chain rules, param engine, snapshot engine), AI integration with Claude Sonnet 4.6 structured output, end-to-end orchestration, frontend polish, and hardening. The system generates .hlx files that load on Helix LT/Floor with category-specific amp parameters, cab filtering, always-on utility blocks, and 4 volume-balanced snapshots.

v1.1 fixed hardware-facing bugs (stomp footswitches, pedalstate bitmask), added prompt caching, genre-aware effect defaults, smarter snapshot toggling via intentRole, and signal chain visualization.

v1.2 added full Pod Go support: new device type, Mono/Stereo suffixed model catalog, device-aware chain rules and validator, podgo-builder.ts for .pgp generation, and Pod Go in the device selector.

Key architecture: Planner-Executor pattern where Claude selects creative model choices (~15 fields in ToneIntent) and the deterministic Knowledge Layer generates all parameter values. This separation ensures tone quality is encoded in code, not dependent on AI accuracy.

For rig emulation, the Planner layer will be extended to accept vision input (base64 encoded images) alongside the conversation, and a new RigIntent schema will carry the extracted/mapped rig data into ToneIntent.

## Constraints

- **Hardware**: Line 6 Helix LT, Helix Floor, Pod Go — specific file formats (.hlx, .pgp)
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
| Rig emulation as part of the tone interview | No new mode — the chat detects rig descriptions and switches into emulation mode naturally | — Pending |
| Per-pedal photos over full pedalboard OCR | Per-pedal is reliable; whole-board OCR too error-prone for v1.3 | — Pending |

---
*Last updated: 2026-03-02 after v1.3 milestone start*
