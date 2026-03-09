# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-08)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v4.0 — Preset Quality & Reliability

## Current Position

Milestone: v4.0 — Preset Quality & Reliability
Phase: 1 of 4 (Helix Structure Rewrite) — In Progress
Plan: 01-02 APPLY in progress (Tasks 1-2 complete, Task 3 checkpoint pending)
Status: Awaiting HX Edit verification checkpoint, then UNIFY
Last activity: 2026-03-08 — Tasks 1-2 applied, Pod Go phase added to roadmap

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [█░░░░░░░░░] 10%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ◐        ○     [APPLY tasks 1-2 done, checkpoint 3 pending]
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
- Split/join always present on both DSPs regardless of dual-amp — v4.0 Plan 01

### Known Issues (v4.0 scope — Plan 02)
- CLEAN snapshot too crunchy: amp Drive=0.55 too high for clean Fender Twin tone
- AMBIENT snapshot not pad-like: just enables delays/reverbs, no shimmer/swell design
- Delays use hardcoded ms instead of TempoSync1/SyncSelect1 (dotted 8th not working)
- Footswitch assignments incomplete (3-4 blocks instead of all toggleable effects)
- Ambient snapshots lack gain compensation for wet signal loss
- Stadium presets losing cabs/effects (Phase 3)
- Pod Go presets missing cab for amp (Phase 3)

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
Last commit: 1fc2ba7
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-08
Stopped at: APPLY tasks 1-2 complete, Task 3 HX Edit checkpoint pending
Next action: Test preset in HX Edit, then /paul:unify. After unify, Phase 1 complete — transition to Phase 2.
Resume file: .paul/phases/01-helix-structure-rewrite/01-02-PLAN.md
Git: 1fc2ba7 on main (changes not yet committed)

### What was built (Plan 02):
- Fixed delay Time formula: 60/BPM (was broken 30/BPM giving half the correct value)
- Added TempoSync1 + SyncSelect1 to all delay blocks (hardware tempo sync)
- Per-snapshot amp Drive control: clean=0.30, crunch=0.50, lead=0.60, ambient=0.35
- Ambient delay mix boost increased +0.15 → +0.25
- Ambient reverb mix boost increased +0.15 → +0.20
- Ambient reverb DecayTime multiplied by 1.5x
- Added Phase 4 (Pod Go Structure Rewrite) to ROADMAP with 5 reference .pgp presets
- All 1201 tests pass

---
*STATE.md — Updated after every significant action*
