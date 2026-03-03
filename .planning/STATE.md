---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Rig Emulation
status: complete
last_updated: "2026-03-02T13:52:00Z"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v1.3 — Rig Emulation (COMPLETE)

## Current Position

Phase: 21 — Substitution Card & End-to-End Polish
Plan: 01 (complete)
Status: Phase 21 complete — v1.3 Rig Emulation milestone COMPLETE
Last activity: 2026-03-02 — Phase 21 Plan 01 complete (SubstitutionCard UI, /api/map route, progressive loading, device re-map effect)

Progress: [██████████] 100% (v1.3)

## Performance Metrics

**By Phase (v1.0):**

| Phase | Plans | Status |
|-------|-------|--------|
| 1. Foundation | 3 | Complete |
| 2. Knowledge Layer | 3 | Complete |
| 3. AI Integration | 2 | Complete |
| 4. Orchestration | 2 | Complete |
| 5. Frontend Polish | 2 | Complete |
| 6. Hardening | 2 | Complete |

**By Phase (v1.1):**

| Phase | Plans | Status |
|-------|-------|--------|
| 7. Hardware Bug Fixes | 2 | Complete |
| 8. Prompt Caching | 1 | Complete |
| 9. Genre-Aware Defaults | 1 | Complete |
| 10. Snapshot Toggling | 1 | Complete |
| 11. Frontend Transparency | 2 | Complete |

**By Phase (v1.2):**

| Phase | Plans | Status |
|-------|-------|--------|
| 12. Format Foundation and Types | 1 | Complete |
| 13. Pod Go Model Catalog | 1 | Complete |
| 14. Chain Rules, Validation, Planner | 1 | Complete |
| 15. Pod Go Preset Builder | 1 | Complete |
| 16. Integration, UI, Testing | 1 | Complete |

**By Phase (v1.3):**

| Phase | Plans | Status |
|-------|-------|--------|
| 17. Schemas & Types Foundation | 1 | Complete |
| 18. Pedal Mapping Engine | 1 | Complete |
| 19. Vision Extraction API | 1 | Complete |
| 20. Planner Integration & Orchestration | 1 | Complete |
| 21. Substitution Card & End-to-End Polish | 1 | Complete |

## Accumulated Context

### Decisions

- [v1.0]: Planner-Executor architecture — AI generates ToneIntent (~15 fields), deterministic Knowledge Layer generates all parameter values
- [v1.0]: 3-layer amp param resolution: model defaults -> category overrides -> topology adjustment
- [v1.1]: @pedalstate computed from block states per snapshot using bitmask
- [v1.1]: Genre defaults applied as outermost resolution layer
- [v1.1]: intentRole flows from EffectIntent through chain-rules into BlockSpec
- [v1.2]: Pod Go is additive v1.2, not a v2.0 rewrite — build on existing architecture
- [v1.2]: podgo-builder.ts lives in src/lib/helix/ (not a separate directory) — devices share the same HD2 engine
- [v1.2]: chain-rules.ts accepts deviceTarget parameter; builder and validator are separate functions per device
- [v1.2]: Pod Go effect model IDs use Mono/Stereo suffix convention derived from 18 real .pgp files
- [v1.2]: Planner prompt filtered by device — Pod Go only sees Pod Go-available models
- [v1.3]: Rig emulation lives in the tone interview — chat detects rig descriptions, no separate mode
- [v1.3]: Per-pedal photos over full pedalboard OCR — more reliable for v1.3
- [v1.3]: blockType in PedalMapEntry is a lowercase string ("distortion", "dynamics", etc.), not a BLOCK_TYPES number — getModelIdForDevice uses it as a key in POD_GO_EFFECT_SUFFIX
- [v1.3]: detectCategory() uses word-boundary regex, not includes() — prevents "od" matching "module"
- [v1.3]: Vision route uses manual JSON extraction (extractJson) not output_config — incompatible with image content block arrays in Anthropic SDK
- [v1.3]: browser-image-compression dynamically imported inside callVision() — prevents SSR failure on Next.js build
- [v1.3]: toneContext appended to user message only (not system prompt) — preserves prompt caching hash on callClaudePlanner
- [v1.3]: parseRigText not exported from @/lib/helix barrel — server-only utility, accessed via @/lib/rig-mapping
- [v1.3]: buildToneContext is private (not exported) in generate/route.ts — formats SubstitutionMap as planner-readable bullet list

### Roadmap Evolution

- Phase 22 added: UI Overhaul — complete visual redesign of homepage, chat flow, and rig upload panel
- Phase 23 added: Fix incompatible target device type error (-8309)

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-02
Stopped at: Phase 21 Plan 01 complete — v1.3 Rig Emulation milestone COMPLETE
Resume file: None
