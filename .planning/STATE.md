---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Device-First Architecture
status: in_progress
last_updated: "2026-03-06"
progress:
  total_phases: 6
  completed_phases: 2
  total_plans: 11
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** v5.0 Phase 62 complete — Catalog Isolation; ready for Phase 63

## Current Position

Phase: 62 of 66 (Catalog Isolation)
Plan: 2 of 2 in current phase (COMPLETE)
Status: Phase 62 complete — ready for Phase 63
Last activity: 2026-03-06 — Phase 62 complete: per-family catalogs, getToneIntentSchema factory, global AMP_NAMES eliminated

Progress: [#####░░░░░░░░░░░░░░░░░░░░░░░░░] 27% (3/11 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 3 (this milestone)
- Prior milestone avg: ~1 plan/session

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 61-family-router-and-capabilities | 1 | ~3min | 3min |
| 62-catalog-isolation | 2 | ~20min | 10min |

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

### Blockers/Concerns

- **Phase 63 pre-work:** Firmware param extraction script must run against `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` corpus before Phase 63 implementation begins. Use `npx tsx scripts/extract-stadium-params.ts`.
- **Phase 65 cache economics:** Measure per-device request volume via usage-logger.ts before splitting planner prompts. Low-volume devices (Stadium, Pod Go) may need shared "constrained-device" prompt bucket to sustain cache hits.
- **HX Edit Stadium verification:** Stadium presets unblocked but HX Edit import not verified across varied tone goals — required as success criterion for Phase 63.

## Session Continuity

Last session: 2026-03-06
Stopped at: Phase 62 complete — per-family catalogs, getToneIntentSchema factory, global AMP_NAMES eliminated
Resume file: None
Next command: `/gsd:plan-phase 63`
