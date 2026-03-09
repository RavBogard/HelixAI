# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v4.0 — Preset Quality & Reliability** (v4.0.0)
Status: 🚧 In Progress
Phases: 3 of 7 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Helix Structure Rewrite | 2/2 | ✅ Complete | 2026-03-08 |
| 2 | Pod Go Structure Rewrite | 1/1 | ✅ Complete | 2026-03-08 |
| 3 | HX Stomp Structure Rewrite | 1/1 | ✅ Complete | 2026-03-08 |
| 4 | HX Stomp XL Structure Rewrite | TBD | Not started | - |
| 5 | Stadium Structure Rewrite | TBD | Not started | - |
| 6 | Validation Layer & Intent Fidelity | TBD | Not started | - |
| 7 | Bass Support | TBD | Not started | - |

## Phase Details

### Phase 1: Helix Structure Rewrite

Focus: Rewrite Helix/LT/Rack/Native preset builder to match exact structural patterns from real HX Edit exports. Includes inputB/outputB/split/join on both DSPs, correct routing models, footswitch assignment overhaul (all toggleable effects), ambient volume compensation, and tempo sync (TempoSync1/SyncSelect1 instead of hardcoded ms). Reference presets are ground truth.

Features: #1 (structure), #2 (footswitches), #3 (volume compensation), #8 (tempo sync)

### Phase 2: Pod Go Structure Rewrite

Focus: Reverse-engineer Pod Go preset structure from real .pgp exports using the same "golden preset" methodology as Phase 1 (Helix). Rewrite podgo-builder.ts to match exact patterns from reference presets. Covers I/O structure, routing, block layout, snapshot format, footswitch assignments, and any Pod Go-specific metadata.

Reference presets (ground truth):
- `C:\Users\dsbog\Downloads\Praise You Anywhere.pgp`
- `C:\Users\dsbog\Downloads\Schism bass.pgp`
- `C:\Users\dsbog\Downloads\ROCK CRUNCH.pgp`
- `C:\Users\dsbog\Downloads\Poundcake.pgp`
- `C:\Users\dsbog\Downloads\A7X.pgp`

Features: #10 (Pod Go golden preset structure)

### Phase 3: HX Stomp Structure Rewrite

Focus: Reverse-engineer HX Stomp preset structure from real .hlx exports using the golden preset methodology. Rewrite stomp-builder.ts to match exact patterns from reference presets. Covers I/O structure, routing, block layout (single DSP constraints), snapshot format, footswitch assignments, and Stomp-specific metadata. HX Stomp has fundamentally different constraints than Helix (1 DSP, 6 blocks, 3 footswitches).

Reference presets (ground truth):
- `C:\Users\dsbog\Downloads\Bass Rig.hlx`
- `C:\Users\dsbog\Downloads\Stringer Distort.hlx`
- `C:\Users\dsbog\Downloads\CATS NO OTO4.hlx`
- `C:\Users\dsbog\Downloads\SOLAR E1.6FBB.hlx`
- `C:\Users\dsbog\Downloads\Moving Pictures .hlx`

Features: #11 (HX Stomp golden preset structure)

### Phase 4: HX Stomp XL Structure Rewrite

Focus: Reverse-engineer HX Stomp XL preset structure from real .hlx exports using the golden preset methodology. The Stomp XL shares the single-DSP architecture with the Stomp but has 8 blocks (vs 6) and 6 footswitches (vs 3), which affects block layout, footswitch assignments, and signal chain capacity. Rewrite or extend stomp-builder.ts to match exact patterns from Stomp XL reference presets.

Reference presets (ground truth):
- `C:\Users\dsbog\Downloads\Swamp Ritual.hlx`
- `C:\Users\dsbog\Downloads\Nolly Clean.hlx`
- `C:\Users\dsbog\Downloads\Nolly Crunch.hlx`

Features: #12 (HX Stomp XL golden preset structure)

### Phase 5: Stadium Structure Rewrite

Focus: Reverse-engineer Helix Stadium/Stadium XL preset structure from real .hsp exports using the golden preset methodology. Rewrite stadium-builder.ts to match exact patterns from reference presets. Stadium has unique characteristics: arena/FOH-oriented signal chains, potentially different I/O routing, mono/stereo suffix handling, and amp-cab wiring patterns distinct from Helix Floor.

Reference presets (ground truth):
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\NH_BoomAuRang.hsp`
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\NH_Reflections.hsp`
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\Purple Nurple.hsp`
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\Stadium Rock Rig.hsp`

Features: #13 (Stadium golden preset structure)

### Phase 6: Validation Layer & Intent Fidelity

Focus: Deterministic post-build validation layer that checks every generated preset before serving. Structural checks (inputB/outputB/split/join, routing, cab-per-amp, @type), footswitch completeness, intent fidelity (delay subdivision, snapshot count, BPM), and volume compensation. Zero AI cost. Also includes intent audit and echo to surface applied parameters to user. Now covers ALL device families (Helix, Pod Go, Stomp, Stomp XL, Stadium) after structural rewrites are complete.

Features: #4 (post-build validation), #9 (intent audit + echo)

### Phase 7: Bass Support

Focus: Add bass instrument support across the full stack. Bass amp and cab catalogs, bass-specific EQ curves, gain staging (less drive, more low-end clarity), bass-appropriate effect defaults, and chat interview flow ("guitar or bass?" early question).

Features: #7 (bass amps, cabs, EQ, effects, chat flow)

## Constraints

- Must not break existing test suite (1201 tests)
- Reference presets (user's real .hlx/.pgp/.hsp files) are ground truth — match structure exactly
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
*Roadmap updated: 2026-03-08 — Phase 3 (HX Stomp Structure Rewrite) complete*
