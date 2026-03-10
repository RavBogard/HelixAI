# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-10)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v6.1 — Block Budget Fix

## Current Position

Milestone: v6.1 — Block Budget Fix
Phase: 20 of 20 (DSP Block Budget Enforcement) — Complete
Plan: 20-01 complete
Status: Phase 20 complete — ready to commit
Last activity: 2026-03-10 — Phase 20 applied, 1458 tests passing

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [██████████] 100% ✓
- v5.0 Automated Gold Standard Compliance: [██████████] 100% ✓
- v6.0 Preset Intelligence & UX Polish: [██████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ○     [Applied — ready to unify]
```

## Accumulated Context

### Decisions
- Helix Native device ID 2162690 UNVERIFIED — estimated from Line 6 sequence.
- Manual JSON schema for Gemini planner (buildGeminiJsonSchema) — v1.1 Phase 1
- Removed @anthropic-ai/sdk entirely; vision migrated to Gemini — v2.0 Phase 1
- MODEL_STANDARD upgraded to gemini-3-flash-preview globally — v2.0 Phase 1
- Per-family effect intelligence via DeviceFamily switch — v2.0 Phase 2
- Keep two-context chat→planner architecture (decided, not a debt) — v2.0 Phase 3
- "Golden preset" methodology: reverse-engineer from real exports, match exactly — v4.0 Phase 1
- Split/join always present on both DSPs regardless of dual-amp — v4.0 Phase 1
- TempoSync1=true when BPM present, false otherwise — v4.0 Phase 1
- Amp Drive as snapshot controller (@controller=19) with ROLE_DRIVE table — v4.0 Phase 1
- Pod Go snapshot controller = 11 (not 4), FS indices 1-6 (not 0-5) — v4.0 Phase 2
- HX Stomp snapshot controller = 9 (distinct from Helix 19, Pod Go 11) — v4.0 Phase 3
- Stomp XL structurally identical to Stomp — no XL-specific code paths — v4.0 Phase 4
- Stadium cab blocks always 2 slots (cab + NoCab) — v4.0 Phase 5
- ToneIntent instrument .optional() not .default("guitar") — v4.0 Phase 7
- Compression non-negotiable for bass across all families — v4.0 Phase 7
- Helix Native identical to Floor/Rack/LT — no separate treatment — v5.0
- DeviceFamily is lowercase only: "helix" | "stomp" | "podgo" | "stadium" — v5.0 Phase 9
- Bass amp detection via AMP_MODELS.instrument field, not name heuristics — v5.0 Phase 10
- Pod Go template blocks at builder level only (not chain-rules) — v5.0 Phase 15
- Effect combination rules are advisory prompt text, not code-enforced — v6.0 Phase 17
- Role delta tables replace hardcoded AMBIENT_* constants — v6.0 Phase 18
- COMBO-05 excludes mandatory boost slot — v6.0 Phase 18
- MAX_PLANNER_MESSAGES=10, first message preserved for tone context — v6.0 Phase 19
- maxOutputTokens 4096→2048 — v6.0 Phase 19

### Known Issues
- Bass amp HD2 model IDs UNVERIFIED — need confirmation from real .hlx bass preset exports
- **CRITICAL:** Helix Native device ID is 2162944 (confirmed from JS-EVPanRed.hlx + JS-GermXRed.hlx) — NOT 2162690 as estimated in v1.0 Phase 5
- Stadium device_version varies across presets (285213946, 301991188, 302056726) — we hardcoded 302056738

### Blockers/Concerns
- None active

### Git State
Last commit: 76e1dca
Branch: main

## Session Continuity

Last session: 2026-03-10
Stopped at: v6.1 plan written
Next action: /paul:apply Phase 20 Plan 01
Resume file: .paul/phases/20-dsp-block-budget-enforcement/20-01-PLAN.md

---
*STATE.md — Updated after every significant action*
