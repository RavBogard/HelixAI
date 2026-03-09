# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v5.0 — Automated Gold Standard Compliance** (v5.0.0)
Status: In Progress
Phases: 3 of 7 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 8 | Mock Chat Harness | 1 | Complete | 2026-03-09 |
| 9 | Structural Diff Engine | 1 | Complete | 2026-03-09 |
| 10 | Intent & Musical Intelligence Validation | 1 | Complete | 2026-03-09 |
| 11 | Reference Corpus & Schema Extraction | TBD | Not started | - |
| 12 | Full Audit Run & Reports | TBD | Not started | - |
| 13 | Fix Deviations | TBD | Not started | - |
| 14 | Regression Suite Integration | TBD | Not started | - |

## Phase Details

### Phase 8: Mock Chat Harness

Focus: Fully automated preset generation via mock conversations exercising the full chat → planner → builder pipeline. Multiple tone scenarios per device family (clean, high-gain, blues/crunch, ambient, bass). Produces real preset output for comparison without manual intervention. No reference presets needed — this builds the generation infrastructure.

Features: Mock chat flows, multi-scenario generation, full pipeline exercise

### Phase 9: Structural Diff Engine

Focus: Deep JSON comparison framework covering structure, parameter values, snapshot behavior, footswitch assignments, controller mappings, metadata fields, and block configuration. Deterministic (no AI cost). Produces structured deviation reports identifying every difference between generated and reference presets. Can be built and tested with synthetic examples before real references arrive.

Features: Deep structural comparison, deviation detection, diff reporting

### Phase 10: Intent & Musical Intelligence Validation

Focus: Verify generated presets match what was requested (intent fidelity) and make musical sense (intelligence validation). Intent: snapshot count, requested effects present, BPM/tempo sync, instrument type. Musical: no chorus on metal by default, compression on bass, appropriate gain staging per style, effect choices match genre. Rule-based — no reference presets needed.

Features: Intent fidelity checks, musical sensibility validation

### Phase 11: Reference Corpus & Schema Extraction ⚠️ REQUIRES NEW REFERENCE PRESETS

Focus: Parse all reference presets (5-8 per device family) into normalized "gold standard" schemas. Extract consistent structural patterns, parameter defaults, metadata fields, controller assignments, and block configurations. Build a per-family reference model that defines "what correct looks like."

Features: Reference corpus ingestion, schema normalization, per-family gold standard models

### Phase 12: Full Audit Run & Reports

Focus: Execute the complete automated pipeline across all 5 device families. Generate presets via mock harness, compare against reference corpus, validate intent and musical intelligence. Produce structured markdown/JSON reports summarizing every deviation found per family.

Features: Full audit execution, structured deviation reports, per-family summaries

### Phase 13: Fix Deviations

Focus: Remediate every structural/parameter issue identified by the audit. Scoped per device family or issue class — exact scope determined by Phase 12 audit results. May split into sub-phases if audit reveals distinct issue categories.

Features: Issue remediation across all device families

### Phase 14: Regression Suite Integration

Focus: Bake the automated comparison pipeline into `npm test` so structural deviations are caught permanently going forward. Mock generation + diff + validation runs as part of CI. Any future builder change that introduces a deviation from gold standard triggers a test failure.

Features: Test suite integration, CI regression prevention

## Constraints

- Must not break existing 1248 tests
- Reference presets are ground truth — match structure exactly
- Mock chat harness must exercise full pipeline (chat → planner → builder), not shortcuts
- Diff engine must be deterministic (no AI cost for comparisons)
- Helix Native uses identical presets to Floor/Rack/LT — no separate treatment needed
- Fix phases scoped by audit findings — cannot pre-plan until audit completes
- Preserve preset file format compatibility (.hlx/.pgp/.hsp container structure)

## Completed Milestones

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
*Roadmap updated: 2026-03-09 — Phase 10 complete*
