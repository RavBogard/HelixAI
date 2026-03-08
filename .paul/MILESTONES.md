# Milestones

Completed milestone log for this project.

| Milestone | Completed | Duration | Stats |
|-----------|-----------|----------|-------|
| v1.1 Post-Release Stabilization | 2026-03-08 | 1 day | 1 phase, 3 plans |
| v1.0 Production Release | 2026-03-08 | 1 day | 6 phases, 6 plans |

---

## v1.1 Post-Release Stabilization

**Completed:** 2026-03-08
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 1 |
| Plans | 3 |
| Files changed | 12 |

### Key Accomplishments

- Fixed 3 consecutive Vercel build failures (missing exports, duplicate functions, missing type unions)
- Restored missing local dependencies (zustand, @dnd-kit/*, @testing-library/react, jsdom)
- Cleaned stale worktrees causing duplicate test runs
- Audited and fixed 7 invalid AI prompt amp names + added data integrity tests
- Migrated planner from Claude Sonnet to Gemini 3 Flash (completing v1.0 Phase 4 decision)

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Manual JSON schema for Gemini planner | 1 | buildGeminiJsonSchema() avoids zod-to-json-schema dependency and Gemini $ref incompatibility |

---

## v1.0 Production Release

**Completed:** 2026-03-08
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 6 |
| Plans | 6 |
| Files changed | 13+ |

### Key Accomplishments

- Comprehensive quality audit identified 38 issues (16 critical) across all 4 device families
- Fixed signal chain ordering (Horizon Gate post-cab), gain staging defaults, and volume balancing
- Reduced lead snapshot gain to safe 2.0 dB to prevent clipping
- Benchmarked 6 AI providers — switched planner from Claude Sonnet to Gemini 3 Flash (100% schema, 86% quality, 8x cheaper)
- Added Helix Native as fully supported device target
- Full pipeline E2E test coverage for all 10 device targets with quality validation
- Established v1.0 quality gate: 97/97 orchestration tests, 1041+ total tests passing

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Pre-cab blocks on DSP0, post-cab on DSP1 | 2 | Proper dual-DSP routing for Helix devices |
| Lead gain 2.5→2.0 dB | 3 | Prevent clipping with ChVol 0.80 |
| Switch planner to Gemini 3 Flash | 4 | 100% schema, 86% quality, $0.006/gen vs $0.046/gen |
| Helix Native maps to helix family, no Variax | 5 | Same DSP/catalog as Floor; DAW plugin has no VDI jack |
| v1.0 quality gate: all 10 targets pipeline-tested | 6 | Full pipeline coverage for every selectable device |

---
