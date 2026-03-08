# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v2.0 — Device Intelligence & UX Overhaul** (v2.0.0)
Status: ✅ Complete
Phases: 5 of 5 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Gemini Unification & Architecture | 1/1 | ✅ Complete | 2026-03-08 |
| 2 | Device-Specific Preset Intelligence | 1/1 | ✅ Complete | 2026-03-08 |
| 3 | AI Conciseness Overhaul | 1/1 | ✅ Complete | 2026-03-08 |
| 4 | UI/UX Redesign — Layout & Chat | 3/3 | ✅ Complete | 2026-03-08 |
| 5 | Polish & Integration Testing | 1/1 | ✅ Complete | 2026-03-08 |

## Phase Details

### Phase 1: Gemini Unification & Architecture

Focus: Migrate rig-vision from Claude to Gemini. Remove @anthropic-ai/sdk entirely. Research whether chat→planner two-context handoff should become a unified single context now that everything is Gemini — prototype both approaches, benchmark quality, and make the architectural call with evidence.

### Phase 2: Device-Specific Preset Intelligence

Focus: Audit each device family's presets against real-world best practices. Tune prompts per device to exploit unique hardware capabilities — dual-DSP routing (Helix), Agoura amp models (Stadium), DSP budgets (Stomp/Stomp XL), effect slot limits (Pod Go), snapshot counts per device.

### Phase 3: AI Conciseness Overhaul

Focus: Rewrite all 4 family chat prompts for brevity and scannability. Users complain the AI is too wordy and they miss the important parts. Key info (amp names, effect choices, snapshot plans) should be bold/highlighted. Shorter responses overall. Apply architecture decision from Phase 1 to prompt structure.

### Phase 4: UI/UX Redesign — Layout & Chat

Focus: Full page restructure + chat redesign. Dark theme, typography, responsive, accessibility. Device picker, chat flow, header/sidebar modernization. Chat bubbles redesigned for scannability. ToneCard/preset summary redesign. Visualizer improvements. Make important info impossible to miss. /ui-ux-pro-max design guidelines applied.

### Phase 5: Polish & Integration Testing

Focus: Cross-device E2E testing of new prompts + UI. Accessibility audit. Performance pass. Mobile QA at 375px, 768px, 1024px, 1440px breakpoints.

## Constraints

- Fully Gemini — remove ALL Anthropic/Claude dependencies
- Architecture decision (unified vs two-context) made in Phase 1 with evidence
- Preserve preset file format compatibility (.hlx/.pgp/.hsp)
- Keep Next.js 16 + Tailwind 4 stack

## Completed Milestones

<details>
<summary>v1.1 Post-Release Stabilization - 2026-03-08 (1 phase)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Build & Type Safety Sweep | 3 | 2026-03-08 |

</details>

<details>
<summary>v1.0 Production Release - 2026-03-08 (6 phases)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Audit Current Preset Quality | 1 | 2026-03-08 |
| 2 | Fix Signal Chain / Gain Staging | 1 | 2026-03-08 |
| 3 | Snapshot / Stomp Correctness | 1 | 2026-03-08 |
| 4 | AI Platform Evaluation | 1 | 2026-03-08 |
| 5 | Helix Native Support | 1 | 2026-03-08 |
| 6 | End-to-End Validation | 1 | 2026-03-08 |

</details>

---
*Roadmap updated: 2026-03-08 — v2.0 milestone complete (all 5 phases)*
