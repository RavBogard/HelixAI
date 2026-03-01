# HelixAI

## What This Is

An AI-powered tone consultant that interviews guitarists about the sound they're after — an artist, a song, a genre, or a vibe — then generates a downloadable .hlx preset file for Line 6 Helix LT and Helix Floor. The presets must be world-class: mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

## Core Value

Generated presets must sound professional enough to compete with custom presets that people pay experts for — not "decent starting points" but genuinely great tones that sit in a mix immediately.

## Requirements

### Validated

- ✓ Chat-based tone interview flow — existing
- ✓ .hlx file generation that loads on Helix LT — existing (structure works, tone doesn't)
- ✓ Warm Analog Studio frontend design — existing
- ✓ Vercel deployment pipeline — existing
- ✓ Google Search grounding for artist/rig research — existing

### Active

- [ ] World-class preset tone quality (mix-ready, not muddy/thin/lifeless)
- [ ] Dynamic responsiveness (cleans up with volume knob, natural breakup)
- [ ] Professional signal chain engineering (right blocks, right order, smart settings)
- [ ] Correct cab filtering and EQ to eliminate muddiness and add sparkle
- [ ] Pro-grade amp parameter settings by category (clean/crunch/high-gain)
- [ ] Always-on utility blocks (Klon boost, post-cab EQ, noise gate)
- [ ] Snapshot design with volume-balanced scenes (clean/crunch/lead/ambient)
- [ ] Helix LT + Helix Floor support (same .hlx format)
- [ ] Single best AI provider (research which produces best preset specs)
- [ ] Rebuilt preset engine from scratch
- [ ] Refined frontend (keep Warm Analog Studio aesthetic, polish further)

### Out of Scope

- HX Stomp / POD Go support — different hardware constraints, different .hlx structure
- User accounts / preset saving — keep it simple, generate and download
- MIDI configuration — focus on tone, not hardware routing
- IR (impulse response) loading — stick with stock Helix cabs
- Multi-provider comparison UI — going single provider for quality focus

## Context

The current app generates .hlx files that load correctly on the Helix LT but sound mediocre. The tones are muddy, lack sparkle, and the overall preset engineering (pedal choices, default settings, parameter values, signal chain design) is mid-tier at best. Two test presets confirmed the issue.

The previous approach relied heavily on AI prompt engineering to guide parameter values, but the fundamental problem is that the preset builder logic, model defaults database, and generation prompt all need to be rebuilt with deep knowledge of what makes Helix presets actually sound good.

Key insight: professional Helix preset makers succeed because they understand cab filtering, EQ sculpting, gain staging, and snapshot design at a deep level — not just "pick an amp and set some knobs." The rebuild must encode this expertise into the system.

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
| Full rebuild over incremental fixes | Current preset engine is fundamentally mid — patching won't get to world-class | — Pending |
| Single AI provider over multi-provider | Focus produces better results than spreading across 3 providers | — Pending |
| Helix LT + Floor over LT-only | Same .hlx format, no extra work, bigger audience | — Pending |
| Keep Warm Analog Studio frontend | Design is strong, just needs polish — no reason to throw it away | — Pending |
| Template-hybrid approach for .hlx building | TBD during research — likely templates for structure, AI for creative choices | — Pending |

---
*Last updated: 2026-03-01 after initialization*
