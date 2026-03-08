# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v3.0 — Preset Format Correctness & Quality** (v3.0.0)
Status: Complete
Phases: 1 of 1 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Preset Format Correctness Audit & Fix | 1/1 | ✅ Complete | 2026-03-08 |

## Phase Details

### Phase 1: Preset Format Correctness Audit & Fix

Focus: Deep audit and fix of all preset file format issues across every device builder. Reverse-engineer correct .hlx format values, fix DSP0→DSP1 routing, overhaul footswitch/stomp assignment system to be device-aware and comprehensive, and verify block @type IDs against real firmware. Not a bandaid — systematic validation of every serialization value.

Key issues driving this phase:
- DSP0 output routes to physical out instead of DSP1 (broken signal chain)
- Stomp assignments limited to 4 footswitches (should assign all toggleable effects)
- HX Stomp builder has zero footswitch assignments
- Block @type values need firmware verification

## Constraints

- Preserve preset file format compatibility (.hlx/.pgp/.hsp container structure)
- Do not change signal chain ordering logic (chain-rules.ts)
- Do not change parameter values (param-engine.ts)
- Do not change snapshot roles or gain staging

## Completed Milestones

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
*Roadmap updated: 2026-03-08 — v3.0 milestone started (preset format correctness)*
