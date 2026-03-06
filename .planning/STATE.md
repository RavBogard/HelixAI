---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Device-First Architecture
status: in_progress
last_updated: "2026-03-06"
progress:
  total_phases: 8
  completed_phases: 7
  total_plans: 15
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v5.0 Phases 61-67 complete. Phase 68 (Token Control and Prompt Caching) in progress — Plan 02 complete, Plan 01 remaining.

## Current Position

Phase: Phase 68 in progress — 1 of 2 plans complete (68-02 done, 68-01 remaining)
Plan: 68-02 complete — Stomp cache unification (byte-identical system prompt for both variants)
Status: Phase 68 in progress — Stomp family cache unification shipped
Last activity: 2026-03-06 — Completed 68-02 (unified stomp planner prompt, stompVariantRestriction in planner.ts)

Progress: [███████████████████████████████░] 93% (14/15 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 10 (this milestone)
- Prior milestone avg: ~1 plan/session

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 61-family-router-and-capabilities | 1 | ~3min | 3min |
| 62-catalog-isolation | 2 | ~20min | 10min |
| 63-stadium-firmware-parameter-completeness | 2 | ~30min | 15min |
| 64-knowledge-layer-guard-removal | 2 | ~25min | 12min |
| 65 (Device-Specific Prompts) | 2 | ~22 min | ~11 min |
| 67-01 (Stadium Catalog Quality) | 1 | ~2 min | ~2 min |
| 67-02 (Stadium Prompt + Integration Test) | 1 | ~3 min | ~3 min |
| 66 (Frontend Picker + DB Migration) | 2 | ~18 min | ~9 min |
| 68-02 (Stomp Cache Unification) | 1 | ~4 min | ~4 min |

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
- [62-01]: EQ, WAH, VOLUME block types excluded from all EFFECT_NAMES tuples — handled silently by Knowledge Layer chain-rules (Stadium overrides WAH/VOLUME exclusion per [67-01])
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
- [v5.0/P65]: Helix Floor/LT produce byte-identical prompts (single cache entry) — device name variation goes in user message only
- [v5.0/P65]: Stadium amp-cab pairing TODO(Phase62) placeholder replaced by generated pairing table from STADIUM_AMPS cabAffinity (Phase 67-02)
- [v5.0/P65]: Inline resolveFamily() in prompt-router until Phase 61 ships canonical version
- [67-01]: WAH_MODELS and VOLUME_MODELS spread into STADIUM_EFFECT_NAMES — Stadium overrides [62-01] exclusion because dualAmpSupported: false blocks the AMP_MODELS crash path; other families unchanged
- [67-01]: STADIUM_CAPABILITIES.dualAmpSupported set to false — Stadium prompt uses includeSecondAmp: false and the dual-amp path uses HD2-only AMP_MODELS which cannot handle Agoura amp names
- [67-02]: buildAmpCabPairingTable() generates the amp-cab pairing section from STADIUM_AMPS cabAffinity at prompt build time — no hardcoded text, content stays in sync with catalog automatically
- [67-02]: STADIUM_AMPS cabAffinity bugs fixed: "4x12 Greenback 25" -> "4x12 Greenback25" (4 entries) and "4x12 Brit T75" -> "4x12 Brit V30" (2 entries) — T75 variant not in CAB_MODELS
- [66-01]: DEVICE_OPTIONS extracted as module-level const array — avoids re-creation on every render and allows Plan 66-02 to reference it from sibling components without prop drilling
- [66-01]: loadConversation() sets needsDevicePicker(true) for null/empty device rows instead of defaulting to helix_lt — prevents assertNever crash in resolveFamily() for legacy rows (FRONT-04)
- [66-01]: startOver() does NOT reset selectedDevice — keeps last-used device pre-selected for UX convenience on new conversations
- [66-02]: helix_lt pre-selected as welcome screen default — reduces friction for most common device; selectedDevice never empty on first send (satisfies FRONT-01 spirit)
- [66-02]: Generate Preset is a separate button from the locked device badge — decouples device confirmation from generation trigger, gives user explicit confirmation moment
- [66-02]: device: selectedDevice added to /api/chat POST body — closes Phase 61 deferral, activates Phase 65 per-family chat prompts end-to-end
- [68-02]: Stomp planner prompt unified to byte-identical text for helix_stomp and helix_stomp_xl — device restriction moved to user message via stompRestriction in planner.ts, matching Helix LT/Floor cache unification pattern
- [68-02]: Conservative system prompt values (6 blocks, 3 snapshots) used as unified reference; stompRestriction in user message overrides with exact per-device values
- [68-02]: _device parameter prefix in buildPlannerPrompt signals intentionally unused while preserving type-contract with prompt-router.ts

### Roadmap Evolution

- Phase 67 added: Stadium Integration Quality — fix WAH/VOLUME catalog gap, dual-amp mismatch, TODO(Phase62) placeholder, schema/prompt integration tests (discovered by post-merge audit)
- Phase 68 added: Token Control and Prompt Caching — reduce API costs without degrading quality (token budgets, prompt caching hit rates, system prompt audit, structural cost optimizations)

### Blockers/Concerns

- ~~**Phase 63 pre-work:** Firmware param extraction script must run against corpus before Phase 63 implementation begins~~ (RESOLVED: Phase 63 complete, all 18 amps have full firmware param tables)
- **Phase 65 cache economics:** Measure per-device request volume via usage-logger.ts before splitting planner prompts. Low-volume devices (Stadium, Pod Go) may need shared "constrained-device" prompt bucket to sustain cache hits.
- **HX Edit Stadium verification:** Stadium presets unblocked but HX Edit import not verified across varied tone goals — required as success criterion for Phase 63.

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 68-02-PLAN.md (stomp cache unification, device restriction moved to user message — Phase 68 Plan 02 COMPLETE)
Resume file: None
Next command: `/gsd:execute-phase 68` (Phase 68 Plan 01 — token budget controls remaining)
