# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v4.0 — Preset Quality & Reliability** (v4.0.0)
Status: 🚧 In Progress
Phases: 0 of 4 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Helix Structure Rewrite | 1/2 | Planning | - |
| 2 | Validation Layer & Intent Fidelity | TBD | Not started | - |
| 3 | Stadium & Pod Go Fixes | TBD | Not started | - |
| 4 | Bass Support | TBD | Not started | - |

## Phase Details

### Phase 1: Helix Structure Rewrite

Focus: Rewrite Helix/LT/Rack/Native preset builder to match exact structural patterns from real HX Edit exports. Includes inputB/outputB/split/join on both DSPs, correct routing models, footswitch assignment overhaul (all toggleable effects), ambient volume compensation, and tempo sync (TempoSync1/SyncSelect1 instead of hardcoded ms). Reference presets are ground truth.

Features: #1 (structure), #2 (footswitches), #3 (volume compensation), #8 (tempo sync)

### Phase 2: Validation Layer & Intent Fidelity

Focus: Deterministic post-build validation layer that checks every generated preset before serving. Structural checks (inputB/outputB/split/join, routing, cab-per-amp, @type), footswitch completeness, intent fidelity (delay subdivision, snapshot count, BPM), and volume compensation. Zero AI cost. Also includes intent audit and echo to surface applied parameters to user.

Features: #4 (post-build validation), #9 (intent audit + echo)

### Phase 3: Stadium & Pod Go Fixes

Focus: Deep audit of stadium-builder.ts and podgo-builder.ts against real exports. Fix stadium preset reliability (missing cabs, dropped effects, mono/stereo suffixes, amp-cab wiring). Add Pod Go cab enforcement (every amp must have a cab). Validate before serving.

Features: #5 (stadium reliability), #6 (Pod Go cab enforcement)

### Phase 4: Bass Support

Focus: Add bass instrument support across the full stack. Bass amp and cab catalogs, bass-specific EQ curves, gain staging (less drive, more low-end clarity), bass-appropriate effect defaults, and chat interview flow ("guitar or bass?" early question).

Features: #7 (bass amps, cabs, EQ, effects, chat flow)

## Constraints

- Must not break existing test suite (1201 tests)
- Reference presets (user's real .hlx files) are ground truth — match structure exactly
- No additional AI API costs for validation (deterministic only)
- Helix/LT/Rack/Native share the same builder (fix once, works for all 4)
- Preserve preset file format compatibility (.hlx/.pgp/.hsp container structure)

## Completed Milestones

<details>
<summary>v3.0 Preset Format Correctness & Quality - 2026-03-08 (1 phase)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Preset Format Correctness Audit & Fix | 1 | 2026-03-08 |

</details>

<details>
<summary>v2.0 Device Intelligence & UX Overhaul - 2026-03-08 (5 phases)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Gemini Unification & Architecture | 1 | 2026-03-08 |
| 2 | Device-Specific Preset Intelligence | 1 | 2026-03-08 |
| 3 | AI Conciseness Overhaul | 1 | 2026-03-08 |
| 4 | UI/UX Redesign — Layout & Chat | 3 | 2026-03-08 |
| 5 | Polish & Integration Testing | 1 | 2026-03-08 |

</details>

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
*Roadmap updated: 2026-03-08 — v4.0 milestone created (preset quality & reliability)*
