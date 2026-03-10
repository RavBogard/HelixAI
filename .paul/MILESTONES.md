# Milestones

Completed milestone log for this project.

| Milestone | Completed | Duration | Stats |
|-----------|-----------|----------|-------|
| v6.1 Block Budget Fix | 2026-03-10 | 1 day | 1 phase, 1 plan |
| v6.0 Preset Intelligence & UX Polish | 2026-03-10 | 1 day | 4 phases, 4 plans |
| v5.0 Automated Gold Standard Compliance | 2026-03-09 | 1 day | 8 phases, 8 plans |
| v4.0 Preset Quality & Reliability | 2026-03-09 | 2 days | 7 phases, 9 plans |
| v3.0 Preset Format Correctness & Quality | 2026-03-08 | 1 day | 1 phase, 1 plan |
| v2.0 Device Intelligence & UX Overhaul | 2026-03-08 | 1 day | 5 phases, 7 plans |
| v1.1 Post-Release Stabilization | 2026-03-08 | 1 day | 1 phase, 3 plans |
| v1.0 Production Release | 2026-03-08 | 1 day | 6 phases, 6 plans |

---

## v6.1 Block Budget Fix

**Completed:** 2026-03-10
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 1 |
| Plans | 1 |
| Files modified | 2 |
| Tests at completion | 1458 |

### Key Accomplishments

- Replaced throwing DSP block limit validation with graceful budget enforcement that drops lowest-priority user effects
- Builder now never crashes on DSP overflow — gracefully degrades by removing least important effects
- Added USER_EFFECT_SLOTS set to distinguish droppable effects from mandatory/amp/cab blocks

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Graceful drop instead of throw | 20 | Presets should always build; dropping an effect is better than crashing |
| USER_EFFECT_SLOTS set for droppable identification | 20 | Mandatory blocks (EQ, Gain Block, Gate) must never be dropped |

---

## v6.0 Preset Intelligence & UX Polish

**Completed:** 2026-03-10
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 4 |
| Plans | 4 |
| Files created | 1 |
| Files modified | 17 |
| Tests at completion | 1455 |

### Key Accomplishments

- Homescreen layout fix: logo sizing, centering, footer clearance — no more crop or wasted space
- Device picker visual polish: amber selected state, hover shadows, transition animations
- Planner prompt intelligence: effect combination rules, role assignment guide, snapshot role behavior, amp gain categorization — all 4 device families
- Per-role snapshot effect overrides: reverb Mix/DecayTime and delay Mix distinct per clean/crunch/lead/ambient
- Genre-modulated snapshot tuning: metal=tight, ambient/worship=lush, blues/jazz=warm
- COMBO-05 drive+reverb combination adjustment: reduces reverb Mix when user drive present
- Chat history windowing: planner bounded to 10 messages (first preserved), chat route to 20
- maxOutputTokens halved (4096 to 2048) — ToneIntent JSON never exceeds ~600 tokens
- Cost analysis tooling: scripts/analyze-usage.ts reads usage.jsonl with per-endpoint/device/cache breakdowns

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Container max-w-5xl to max-w-4xl | 16 | Eliminates right-column gap on wide screens |
| Effect combination rules are advisory prompt text | 17 | Prompt guidance steers planner; builder doesn't validate |
| Role delta tables replace hardcoded AMBIENT_* constants | 18 | Unified per-role overrides; ambient values preserved |
| COMBO-05 excludes mandatory boost slot | 18 | Only user-selected drives trigger reverb reduction |
| MAX_PLANNER_MESSAGES=10, first message preserved | 19 | Initial request captures tone intent |
| maxOutputTokens 4096 to 2048 | 19 | 4x safety margin on actual output size |

---

## v5.0 Automated Gold Standard Compliance

**Completed:** 2026-03-09
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 8 |
| Plans | 8 |
| Files created | 17 |
| Files modified | 13 |
| Tests at completion | 1446 |

### Key Accomplishments

- Mock chat harness: 25 scenarios (5 families x 5 styles) exercising full pipeline without AI calls
- Deterministic structural diff engine comparing generated vs reference presets across all 4 device families
- Musical intelligence validation: 5 genre/instrument-aware rules (genre-effect, bass compression, gain staging, snapshot roles, effect count)
- Reference corpus loader and per-family gold standard schema extractor with key frequency consensus
- Full audit orchestrator connecting harness → diff → validation → per-family compliance reports
- Fixed structural deviations: Stomp snapshot padding, Helix empty snapshot validity, non-MV amp Drive false positives, Stadium diff wrapper
- Regression suite: full audit pipeline baked into npm test — structural deviations caught permanently
- Pod Go template blocks (Volume Pedal, Wah, FX Loop) matching real Pod Go Edit defaults

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| DeviceFamily lowercase only ("helix", "stomp", "podgo", "stadium") | 9 | Consistent with existing type definitions |
| Bass amp detection via AMP_MODELS.instrument field | 10 | Authoritative source, not name heuristics |
| Key frequency consensus: required=100%, common=>50%, rare=<=50% | 11 | Standard consensus for gold standard schemas |
| Diff against first reference per family | 12 | Avoids combinatorial explosion |
| Stomp emits device-max snapshots only (3 or 4) | 13 | Matches real HX Edit exports |
| Pod Go template blocks at builder level only | 15 | Not part of tone intent, Pod Go Edit defaults |

---

## v4.0 Preset Quality & Reliability

**Completed:** 2026-03-09
**Duration:** 2 days

### Stats

| Metric | Value |
|--------|-------|
| Phases | 7 |
| Plans | 9 |

### Key Accomplishments

- Golden preset methodology: reverse-engineered real HX Edit/Pod Go Edit/Stadium exports for structural accuracy
- Helix, Pod Go, HX Stomp, Stomp XL, and Stadium builders fully rewritten to match real export structures
- Per-device snapshot controllers (Helix=19, Pod Go=11, Stomp=9), footswitch indices, and pedalstate values
- Validation layer with intent fidelity checking (amp/cab/snapshot matching)
- Full bass support: 19 bass amps, 8 bass cabs, instrument-aware chat/planner prompts, compression rules

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Golden preset methodology | 1 | Match real exports exactly |
| Split/join always present on both DSPs | 1 | Real exports always include them |
| Pod Go @pedalstate always 2 | 2 | All reference presets confirm |
| Stomp XL identical to Stomp | 4 | No XL-specific code paths needed |
| Stadium cab blocks always 2 slots | 5 | All reference presets confirm |
| Compression non-negotiable for bass | 7 | Priority 1 across all families |

---

## v3.0 Preset Format Correctness & Quality

**Completed:** 2026-03-08
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 1 |
| Plans | 1 |

### Key Accomplishments

- Comprehensive preset format audit and fix across all device families

---

## v2.0 Device Intelligence & UX Overhaul

**Completed:** 2026-03-08
**Duration:** 1 day

### Stats

| Metric | Value |
|--------|-------|
| Phases | 5 |
| Plans | 7 |

### Key Accomplishments

- Removed all Anthropic SDK dependencies — fully migrated to Gemini
- Per-family effect intelligence (Helix dual-DSP, Stomp priority-based, Pod Go templates, Stadium arena/FOH)
- AI chat conciseness overhaul with structured summaries
- UI/UX redesign: component extraction, responsive layout, PresetCard polish
- WCAG 2.1 AA accessibility compliance

### Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Remove @anthropic-ai/sdk entirely | 1 | Single SDK, single API key |
| Per-family effect prompt parameterization | 2 | Hardware constraints differ per family |
| Keep two-context chat→planner architecture | 3 | Separation of concerns, no lossy handoff |

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
