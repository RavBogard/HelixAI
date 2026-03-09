# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-08)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v4.0 — Preset Quality & Reliability

## Current Position

Milestone: v4.0 — Preset Quality & Reliability
Phase: 2 of 5 (Validation Layer & Intent Fidelity) — Not Started
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-08 — Phase 1 complete, transitioned to Phase 2

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [██░░░░░░░░] 20%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Phase 1 loop complete — ready for Phase 2 PLAN]
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

### Known Issues (v4.0 scope — remaining phases)
- Stadium presets losing cabs/effects (Phase 3)
- Pod Go presets missing cab for amp (Phase 3)

### Resolved Issues (Phase 1)
- ~~CLEAN snapshot too crunchy~~ — per-snapshot Drive control (Plan 02)
- ~~AMBIENT snapshot not pad-like~~ — boosted mix/decay values (Plan 02)
- ~~Delays use hardcoded ms~~ — TempoSync1/SyncSelect1 (Plan 02)
- ~~Footswitch assignments incomplete~~ — all toggleable effects assigned (Plan 01)
- ~~Ambient snapshots lack gain compensation~~ — mix boost values tuned (Plan 02)

### Reference Files
- `C:\Users\dsbog\OneDrive\Desktop\Strab ORNG RV SC.hlx` — dual-path DSP0 with IRs
- `C:\Users\dsbog\OneDrive\Desktop\TONEAGE 185.hlx` — standard dual-DSP
- `C:\Users\dsbog\OneDrive\Desktop\Vox Liverpool.hlx` — effects DSP0, amp+cab DSP1
- `C:\Users\dsbog\Downloads\Alchemy Sultan 2.hlx` — user-fixed reference
- `C:\Users\dsbog\Downloads\Alchemy_Sultans_Pad_LT (2).hlx` — broken output for comparison
- `C:\Users\dsbog\Downloads\Sultans_of_Strat_LT.hlx` — Plan 01-01 verification output

### Blockers/Concerns
- None

### Git State
Last commit: 4232c92
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 1 complete, ready to plan Phase 2
Next action: /paul:plan for Phase 2 (Validation Layer & Intent Fidelity)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
