# HelixAI

## What This Is

An AI-powered tone consultant that interviews guitarists about the sound they're after — an artist, a song, a genre, or a vibe — then generates a downloadable .hlx preset file for Line 6 Helix LT and Helix Floor. The presets must be world-class: mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

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

### Active

- [ ] Fix stomp footswitch `@fs_enabled` — hardware responds on first press
- [ ] Fix snapshot `@pedalstate` computation — pedal LEDs reflect active stomps per snapshot
- [ ] Prompt caching for API cost reduction (~50% savings)
- [ ] Genre-aware effect parameter defaults (delay times, reverb mixes, modulation rates)
- [ ] Smarter snapshot effect toggling (ambient enables reverb+delay, clean disables drive)
- [ ] Broader .hlx format audit against HX Edit expectations
- [ ] Signal chain visualization in UI (show what's in the preset before download)
- [ ] Tone description card (human-readable preset summary)

### Out of Scope

- HX Stomp / POD Go support — different hardware constraints, different .hlx structure
- User accounts / preset saving — keep it simple, generate and download
- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock Helix cabs
- Multi-provider comparison UI — going single provider for quality focus

## Current Milestone: v1.1 Polish & Precision

**Goal:** Fix hardware-facing bugs, deepen preset intelligence, and give users a window into what they're downloading.

**Target features:**
- Fix stomp `@fs_enabled` and snapshot `@pedalstate` hardware bugs
- Prompt caching for 50% API cost reduction
- Genre-aware effect parameters and smarter snapshot toggling
- .hlx format audit for hardware correctness
- Signal chain visualization and tone description card in UI

## Context

v1.0 rebuilt the entire preset engine from scratch: type contracts, Knowledge Layer (chain rules, param engine, snapshot engine), AI integration with Claude Sonnet 4.6 structured output, end-to-end orchestration, frontend polish, and hardening. The system generates .hlx files that load on Helix LT/Floor with category-specific amp parameters, cab filtering, always-on utility blocks, and 4 volume-balanced snapshots.

Hardware testing revealed two bugs: stomp footswitches are hardcoded `@fs_enabled: false` (requiring multiple presses), and `@pedalstate` is hardcoded to `2` in all snapshots (pedal LEDs don't reflect active stomps per snapshot). Both are preset-builder fixes.

Key architecture: Planner-Executor pattern where Claude selects creative model choices (~15 fields in ToneIntent) and the deterministic Knowledge Layer generates all parameter values. This separation ensures tone quality is encoded in code, not dependent on AI accuracy.

Existing codebase map available at `.planning/codebase/` with architecture, stack, conventions, and concerns documentation.

## Constraints

- **Hardware**: Line 6 Helix LT and Helix Floor — dual DSP, 8 snapshots, specific .hlx JSON format
- **Deployment**: Vercel (free tier), serverless functions for AI calls
- **Frontend**: Next.js + TypeScript + Tailwind CSS, keep Warm Analog Studio design
- **AI Provider**: Single provider — research and pick the best one for structured .hlx spec generation
- **File Format**: .hlx JSON must match HX Edit export format exactly (block types, parameter names, routing)
- **No Reference Preset**: No gold standard .hlx file available — quality judged by ear on real hardware

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full rebuild over incremental fixes | Current preset engine is fundamentally mid — patching won't get to world-class | ✓ Good |
| Single AI provider (Claude Sonnet 4.6) | Focus produces better results than spreading across 3 providers | ✓ Good |
| Helix LT + Floor over LT-only | Same .hlx format, no extra work, bigger audience | ✓ Good |
| Keep Warm Analog Studio frontend | Design is strong, just needs polish — no reason to throw it away | ✓ Good |
| Planner-Executor architecture | AI selects models (~15 fields), Knowledge Layer generates all params deterministically | ✓ Good |

---
*Last updated: 2026-03-02 after v1.1 milestone start*
