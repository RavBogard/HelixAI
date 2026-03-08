# Roadmap: helixtones.com

## Overview
Build an AI-powered preset builder that interviews users about their rig and tone preferences, then generates professional-quality Line 6 presets across all supported device families.

## Current Milestone
**v1.1 Post-Release Stabilization** (v1.1.0)
Status: ✅ Complete
Phases: 1 of 1 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Build & Type Safety Sweep | 3 | ✅ Complete | 2026-03-08 |

## Phase Details

### Phase 1: Build & Type Safety Sweep

Focus: Comprehensive sweep for build errors, type mismatches, missing exports, stale imports, and residual bugs introduced during v1.0 (especially from Helix Native additions and Gemini 3 Flash decision). Fix all Vercel build failures and ensure clean `tsc --noEmit`. Clean up dead code, stale worktrees, and missing dependencies.

Known issues to investigate:
- Planner still uses Claude Sonnet — Phase 4 decided Gemini 3 Flash but migration never executed
- Missing local dependencies: zustand, @dnd-kit/*, jsdom (visualizer module broken)
- Stale worktree `.claude/worktrees/condescending-khorana/` causing duplicate test runs
- 12 critical invalid AI prompt amp names flagged in Phase 1 audit — verify all fixed
- Helix Native device ID 2162690 still UNVERIFIED
- Any remaining hardcoded device type unions that missed helix_native
- Import/export hygiene across barrel files

## Completed Milestones

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
*Roadmap updated: 2026-03-08 — v1.1 milestone complete*
