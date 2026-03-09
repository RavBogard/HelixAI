# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-08)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v4.0 — Preset Quality & Reliability

## Current Position

Milestone: v4.0 — Preset Quality & Reliability
Phase: 1 of 4 (Helix Structure Rewrite) — Planning
Plan: 01-01 created, awaiting approval
Status: PLAN created, ready for APPLY
Last activity: 2026-03-08 — Created .paul/phases/01-helix-structure-rewrite/01-01-PLAN.md

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [░░░░░░░░░░] 0%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ○        ○     [Plan created, awaiting approval]
```

## Accumulated Context

### Decisions
- Helix Native device ID 2162690 UNVERIFIED — estimated from Line 6 sequence.
- Manual JSON schema for Gemini planner (buildGeminiJsonSchema) — v1.1 Phase 1
- Removed @anthropic-ai/sdk entirely; vision migrated to Gemini — v2.0 Phase 1
- MODEL_STANDARD upgraded to gemini-3-flash-preview globally — v2.0 Phase 1
- Per-family effect intelligence via DeviceFamily switch — v2.0 Phase 2
- Keep two-context chat→planner architecture (decided, not a debt) — v2.0 Phase 3
- "Golden preset" methodology: reverse-engineer from real exports, match exactly — v4.0

### Known Issues (v4.0 scope)
- DSP0→DSP1 routing fix from v3.0 not landing in production output
- Missing inputB/outputB/split/join on both DSPs
- Footswitch assignments incomplete (3-4 blocks instead of all toggleable effects)
- Delay uses hardcoded ms instead of TempoSync1/SyncSelect1
- Ambient snapshots lack gain compensation for wet signal loss
- Stadium presets losing cabs/effects
- Pod Go presets missing cab for amp

### Reference Files
- `C:\Users\dsbog\OneDrive\Desktop\Strab ORNG RV SC.hlx` — dual-path DSP0 with IRs
- `C:\Users\dsbog\OneDrive\Desktop\TONEAGE 185.hlx` — standard dual-DSP
- `C:\Users\dsbog\OneDrive\Desktop\Vox Liverpool.hlx` — effects DSP0, amp+cab DSP1
- `C:\Users\dsbog\Downloads\Alchemy Sultan 2.hlx` — user-fixed reference
- `C:\Users\dsbog\Downloads\Alchemy_Sultans_Pad_LT (2).hlx` — broken output for comparison

### Blockers/Concerns
- None

### Git State
Last commit: 717a9c5
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-08
Stopped at: Plan 01-01 created
Next action: Review and approve plan, then run /paul:apply
Resume file: .paul/phases/01-helix-structure-rewrite/01-01-PLAN.md

---
*STATE.md — Updated after every significant action*
