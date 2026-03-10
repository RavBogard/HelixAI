# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v7.0 — Intelligent Dual-DSP Architecture** (v7.0.0)
Status: In Progress
Phases: 0 of 3 complete

Focus: Replace the hardcoded pre-cab/post-cab DSP split with an intelligent allocation engine that thinks like an experienced preset designer — considering load balancing, signal routing, stereo width, DSP resource weight, and real-world design patterns.

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 21 | Research & Pattern Extraction | TBD | Not started | - |
| 22 | DSP Allocation Engine | TBD | Not started | - |
| 23 | Validation & Regression | TBD | Not started | - |

### Phase 21: Research & Pattern Extraction

**Goal:** Analyze all reference presets for DSP allocation patterns, study Line 6 DSP architecture and community best practices, produce a documented allocation ruleset.
**Depends on:** v6.1 (block budget safety net in place)
**Research:** Likely (core purpose of this phase)

**Scope:**
- Analyze reference preset DSP assignments across all Helix variants
- Research Line 6 DSP architecture constraints (routing, stereo, resource weight)
- Document how professional preset designers distribute blocks across DSPs
- Produce a formal allocation ruleset for Phase 22 implementation

### Phase 22: DSP Allocation Engine

**Goal:** Build the intelligent DSP allocator — replace `getDspForSlot` with a budget-aware, routing-aware, stereo-aware engine.
**Depends on:** Phase 21 (documented ruleset)
**Research:** Unlikely (implementing researched rules)

**Scope:**
- Replace static `getDspForSlot` switch with intelligent allocation
- Load balancing: spill to less-loaded DSP when one is full
- Routing-aware placement: same-DSP vs cross-DSP signal implications
- Stereo/mono-aware: stereo effects on DSP that maintains stereo width
- DSP resource estimation: heavier blocks (reverbs) weighted in placement decisions

### Phase 23: Validation & Regression

**Goal:** Verify the new allocator produces better presets across all Helix variants, update audit baselines, ensure no regressions.
**Depends on:** Phase 22 (engine built)
**Research:** Unlikely (testing and validation)

**Scope:**
- Compare old vs new DSP assignments across all mock harness scenarios
- Verify signal chain correctness preserved
- Update structural diff baselines for new DSP layout
- Full regression suite pass

## Constraints

- Helix-only (dual-DSP) — Stomp, Pod Go, Stadium are single-DSP and unaffected
- Must preserve signal chain correctness (amp before cab, gate position, etc.)
- Regression suite must pass throughout
- Research phase produces documented ruleset BEFORE any code changes
- No changes to preset file format — only internal DSP assignment logic

## Completed Milestones

<details>
<summary>v6.1 Block Budget Fix - 2026-03-10 (1 phase)</summary>

| Phase | Name | Plans | Completed |
|-------|------|-------|-----------|
| 20 | DSP Block Budget Enforcement | 1 | 2026-03-10 |

</details>

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
*Roadmap updated: 2026-03-10 — v7.0 milestone created*
