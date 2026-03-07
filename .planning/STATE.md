---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Preset Craft Mastery
status: active
last_updated: "2026-03-07"
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 8
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v6.0 Preset Craft Mastery — Phase 72 in progress (1/2 plans complete)

## Current Position

Phase: Phase 72 — Effect Combination Logic (IN PROGRESS)
Plan: 1/2 complete
Status: Phase 72 Plan 01 complete -- structural combination rules (COMBO-02, COMBO-03) implemented
Last activity: 2026-03-07 — Phase 72 Plan 01 complete (gate placement, compressor omission, priority truncation, 760 tests)

Progress: [██████████████░░░░░░░░░░░░░░░░░░] 43% (3/7 phases complete, 72 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (this milestone)
- Phase 72: Plan 01 in ~3 min (structural combination rules, TDD)
- Phase 71: 2 plans in ~7 min total (avg 3.5 min/plan — data layer + prompt integration)
- Phase 76: 2 plans in ~7 min total (avg 3.5 min/plan)
- Phase 70: 2 plans in ~5 min total (avg 2.5 min/plan)
- Prior milestone avg: ~5 min/plan (v5.0)

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v4.0]: Architecture refactor deferred — guard sites functional at 6 devices; superseded by v5.0 device-first approach
- [v5.0]: Family Router ships first (Phase 61) — zero regression risk, pure addition, unlocks all downstream phases
- [v5.0]: Catalog isolation (Phase 62) is highest-risk phase — AMP_MODELS imported by chain-rules, param-engine, validate; all import sites must update atomically
- [v5.0]: Frontend picker + DB migration ship atomically (Phase 66) — deploying picker without migration causes legacy conversation crashes
- [v5.0]: Per-family catalogs live in src/lib/helix/catalogs/{family}-catalog.ts — each exports typed tuples
- [v5.0]: EQ, WAH, VOLUME block types excluded from most EFFECT_NAMES tuples — Stadium overrides WAH/VOLUME exclusion
- [v5.0]: Helix Floor/LT produce byte-identical prompts (single cache entry) — Stomp variants unified similarly
- [v5.0]: Stadium Mono/Stereo suffix fix — firmware requires suffixed model IDs on all effect blocks
- [v6.0-pre]: Expression pedal controllers (EXP_PEDAL_1=1, EXP_PEDAL_2=2) exist as constants but are NEVER assigned in any builder — wah and volume completely non-functional
- [v6.0-pre]: Delay subdivision fully working (added in v4.0) — "quarter", "dotted_eighth", "eighth", "triplet" options resolved in param-engine.ts
- [v6.0-pre]: 126+ effects across all families with 100% parameter coverage, but AI treats all effects in a category as interchangeable — no per-model guidance
- [v6.0-pre]: No effect combination intelligence exists — comp→drive, mod→reverb interactions not modeled
- [v6.0]: STOMP_MAX_BLOCKS=8 for both Stomp and StompXL (FW 3.0+ hardware limit, same DSP chip)
- [v6.0]: maxEffectsPerDsp calibrated to real hardware: Stomp=4, StompXL=4, Stadium=8, Helix=Infinity, PodGo=4
- [v6.0]: Zod schema .max(10) for effects array — provides headroom above Stadium's 8-effect capacity
- [v6.0]: chain-rules now logs console.warn before effect truncation for observability
- [v6.0]: Effect paramOverrides applied BEFORE genre overrides in resolveDefaultParams (genre intent wins as outermost layer)
- [v6.0]: 7 effect models get paramOverrides: Ganymede/Glitz/Octo/Plateaux (Mix), Heliosphere/Cosmos Echo/Adriatic Swell (Feedback)
- [v6.0]: genreEffectModelSection placed after amp-cab pairing, before Effect Discipline — planner-only (not chat prompt)
- [v6.0]: Genre-effect guidance is in static system prompt for cache stability — identical across all devices in a family
- [v6.0]: SLOT_ORDER uses fractional value 2.5 for horizon_gate — inserts between extra_drive(2) and boost(3) without renumbering
- [v6.0]: getEffectPriority scores intentRole (always_on=100, toggleable=50, ambient=30) + slot (wah=18, comp=15, delay=10, reverb=8, mod=5)
- [v6.0]: COMBO-02 compressor omission runs BEFORE COMBO-03 truncation — reduces effect count before budget check

### Roadmap Evolution

- v5.0 Phase 67 added: Stadium Integration Quality — fix WAH/VOLUME catalog gap, dual-amp mismatch, schema/prompt integration tests
- v5.0 Phase 68 added: Token Control and Prompt Caching — cost correction, per-device cache reporting
- v5.0 complete: 9 phases (61-69), 17 plans, all verified
- v6.0 Phase 75 added: Preset Musical Coherence — Blackbird Arena analysis revealed 6 systemic issues (missing reverb, boost always-on, comp/gate conflation, effect balance blindness, description-ToneIntent disconnect, snapshot range collapse)
- v6.0 Phase 76 added: Device Block Budget Calibration — user-reported artificially conservative effect limits (Stadium maxEffectsPerDsp=4 vs real 8+, Helix prompt caps at 6 effects but LT supports 8+, Stomp mislabeled at 2 vs real 4, silent truncation in chain-rules)

### Blockers/Concerns

- **HX Edit Stadium verification:** Stadium presets unblocked but HX Edit import not verified across varied tone goals — required as success criterion for Phase 63.
- **Expression pedal wiring:** RESOLVED in Phase 70 — EXP_PEDAL_1/2 now assigned in all 4 builders (Helix, Stomp, Pod Go, Stadium=0). 19 TDD tests cover all scenarios.
- **Artificially conservative block budgets:** RESOLVED in Phase 76 — Stadium maxEffectsPerDsp corrected 4->8, Stomp 2->4, StompXL 5->4, STOMP_MAX_BLOCKS 6->8. Zod .max(10), prompt maxEffects aligned, chain-rules logs truncation warnings. 716 tests pass.

## Session Continuity

Last session: 2026-03-07
Stopped at: Completed 72-01-PLAN.md — structural combination rules (COMBO-02 gate+compressor, COMBO-03 priority truncation)
Resume file: None
Next command: /gsd:execute-phase 72 (Plan 02 remaining)
