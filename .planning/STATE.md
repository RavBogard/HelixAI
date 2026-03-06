---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Device-First Architecture
status: in_progress
last_updated: "2026-03-06"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 11
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v5.0 Phase 64 complete — Knowledge Layer Guard Removal; ready for Phase 65

## Current Position

Phase: 64 of 66 (Knowledge Layer Guard Removal)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase 64 complete — ready for Phase 65
Last activity: 2026-03-06 — Phase 64 complete: all Knowledge Layer guards replaced with DeviceCapabilities, 327 tests pass

Progress: [###############░░░░░░░░░░░░░░░] 64% (7/11 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (this milestone)
- Prior milestone avg: ~1 plan/session

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 61-family-router-and-capabilities | 1 | ~3min | 3min |
| 62-catalog-isolation | 2 | ~20min | 10min |
| 63-stadium-firmware-parameter-completeness | 2 | ~30min | 15min |
| 64-knowledge-layer-guard-removal | 2 | ~25min | 12min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

- [v4.0]: Architecture refactor deferred — guard sites functional at 6 devices; superseded by v5.0 device-first approach
- [v5.0]: Family Router ships first (Phase 61) — zero regression risk, pure addition, unlocks all downstream phases
- [v5.0]: Catalog isolation (Phase 62) is highest-risk phase — AMP_MODELS imported by chain-rules, param-engine, validate; all import sites must update atomically
- [v5.0]: Stadium firmware params (Phase 63) runs parallel after Phase 62 — independent track, param extraction from real .hsp corpus required before coding
- [v5.0]: Frontend picker + DB migration ship atomically (Phase 66) — deploying picker without migration causes legacy conversation crashes
- [61-01]: assertNever guard in resolveFamily() and getCapabilities() enforces compile-time exhaustiveness — adding a DeviceTarget without updating these functions causes a TS error
- [61-01]: Chat route (/api/chat) defers device wiring to Phase 66 — chat does not currently receive device param; ROUTE-04 satisfied by generate route wiring
- [61-01]: Stadium and Stadium XL share STADIUM_CAPABILITIES using conservative values — split if per-device precision needed
- [61-01]: helix_rack/pod_go_xl/helix_stadium_xl device IDs are placeholders — UNVERIFIED pending real hardware exports
- [62-01]: Per-family catalogs live in src/lib/helix/catalogs/{family}-catalog.ts — each exports {FAMILY}_AMP_NAMES, {FAMILY}_CAB_NAMES, {FAMILY}_EFFECT_NAMES as const tuples
- [62-01]: EQ, WAH, VOLUME block types excluded from all EFFECT_NAMES tuples — handled silently by Knowledge Layer chain-rules
- [62-02]: getToneIntentSchema(family) is the single factory for per-family Zod schemas — all constrained decoding goes through this
- [62-02]: POD_GO_EFFECT_SUFFIX kept as private copy in models.ts due to circular import (models.ts <-> podgo-catalog.ts); canonical source is PODGO_EFFECT_SUFFIX in podgo-catalog.ts
- [62-02]: ToneIntentSchema kept as @deprecated backwards-compat shim using helix catalog; no internal consumers remain
- [63-01]: BlockSpec.parameters, HelixModel.defaultParams/paramOverrides, SnapshotSpec.parameterOverrides widened to Record<string, number | boolean> for boolean voice params
- [63-01]: ChVol removed from all 18 STADIUM_AMPS entries — corpus confirms no ChVol in Agoura amp firmware
- [63-01]: 8 non-corpus models derived from same-family models with neutral defaults; 10 corpus-verified models with exact .hsp values
- [63-02]: Stadium guard in resolveAmpParams() wraps AMP_DEFAULTS layers 2-3 in if (!stadiumModel) conditional — prevents param corruption
- [63-02]: validate.ts exempts Stadium amp blocks from 0-1 range check since firmware params use raw Hz/dB/integer values
- [64-01]: DeviceCapabilities extended with maxEffectsPerDsp, mandatoryBlockTypes, modelSuffix — enables chain-rules.ts and models.ts to dispatch on caps instead of boolean guards
- [64-02]: STADIUM_AMPS[block.modelName] lookups in param-engine.ts and validate.ts are MODEL-based (not device-based) — preserved as-is since they answer "is this block an Agoura amp?" not "is the device a Stadium"
- [64-02]: isPodGo/isStadium/isStomp helpers kept in route.ts for builder routing and planner.ts for prompt construction — these are outside Knowledge Layer scope and remain valid for builder dispatch

### Blockers/Concerns

- ~~**Phase 63 pre-work:** Firmware param extraction script must run against corpus before Phase 63 implementation begins~~ (RESOLVED: Phase 63 complete, all 18 amps have full firmware param tables)
- **Phase 65 cache economics:** Measure per-device request volume via usage-logger.ts before splitting planner prompts. Low-volume devices (Stadium, Pod Go) may need shared "constrained-device" prompt bucket to sustain cache hits.
- **HX Edit Stadium verification:** Stadium presets unblocked but HX Edit import not verified across varied tone goals — required as success criterion for Phase 63.

## Session Continuity

Last session: 2026-03-06
Stopped at: Phase 64 complete — all Knowledge Layer guards replaced with DeviceCapabilities, 327 tests pass
Resume file: None
Next command: `/gsd:plan-phase 65`
