# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v6.1 — Block Budget Fix** (v6.1.0)
Status: In Progress
Phases: 0 of 1 complete

Focus: Fix DSP1 block limit overflow on Helix by making the builder budget-aware — drop lowest-priority user effects after mandatory block insertion instead of crashing.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 20 | DSP Block Budget Enforcement | 1 | Not started | - |

### Phase 20: DSP Block Budget Enforcement

**Goal:** After mandatory blocks are inserted, enforce per-DSP block limits by dropping lowest-priority user effects — never throw a block limit error.
**Depends on:** v6.0 (chain-rules, COMBO-03, CHAIN-06 all stable)
**Research:** Unlikely (internal logic, well-understood)

## Completed Milestones

<details>
<summary>v6.0 Preset Intelligence & UX Polish - 2026-03-10 (4 phases)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 16 | UI Overhaul & Homescreen Fix | 1 | 2026-03-09 |
| 17 | Planner Prompt Intelligence | 1 | 2026-03-09 |
| 18 | Builder Logic Enhancement | 1 | 2026-03-09 |
| 19 | Token & Cost Optimization | 1 | 2026-03-09 |

</details>

<details>
<summary>v5.0 Automated Gold Standard Compliance - 2026-03-09 (8 phases)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 8 | Mock Chat Harness | 1 | 2026-03-09 |
| 9 | Structural Diff Engine | 1 | 2026-03-09 |
| 10 | Intent & Musical Intelligence Validation | 1 | 2026-03-09 |
| 11 | Reference Corpus & Schema Extraction | 1 | 2026-03-09 |
| 12 | Full Audit Run & Reports | 1 | 2026-03-09 |
| 13 | Fix Deviations | 1 | 2026-03-09 |
| 14 | Regression Suite Integration | 1 | 2026-03-09 |
| 15 | Pod Go Default Template Blocks | 1 | 2026-03-09 |

</details>

<details>
<summary>v4.0 Preset Quality & Reliability - 2026-03-09 (7 phases)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 1 | Helix Structure Rewrite | 2 | 2026-03-08 |
| 2 | Pod Go Structure Rewrite | 1 | 2026-03-08 |
| 3 | HX Stomp Structure Rewrite | 1 | 2026-03-08 |
| 4 | HX Stomp XL Structure Rewrite | 1 | 2026-03-08 |
| 5 | Stadium Structure Rewrite | 1 | 2026-03-08 |
| 6 | Validation Layer & Intent Fidelity | 1 | 2026-03-08 |
| 7 | Bass Support | 2 | 2026-03-09 |

</details>

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
*Roadmap updated: 2026-03-10 — v6.1 milestone created*
