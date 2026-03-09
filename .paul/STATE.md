# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-08)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v4.0 — Preset Quality & Reliability

## Current Position

Milestone: v4.0 — Preset Quality & Reliability
Phase: 4 of 7 (HX Stomp XL Structure Rewrite) — Not started
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-08 — Phase 3 complete, transitioned to Phase 4

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [████░░░░░░] 43%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete - ready for next PLAN]
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
- Reordered v4.0: golden-preset rewrites (2-5) before validation (6), dropped "Stadium & Pod Go Fixes" (superseded by full rewrites) — v4.0
- Pod Go snapshot controller = 11 (not 4), FS indices 1-6 (not 0-5) — v4.0 Phase 2
- Pod Go @pedalstate always 2 (snapshot mode indicator) — v4.0 Phase 2
- Pod Go invalid snapshots have full blocks/controllers structure — v4.0 Phase 2
- HX Stomp snapshot controller = 9 (distinct from Helix 19, Pod Go 11) — v4.0 Phase 3
- HX Stomp @pedalstate always 0 (not bitmask) — v4.0 Phase 3
- HX Stomp empty snapshots have blocks/controllers structure — v4.0 Phase 3
- HX Stomp uses shared getBlockTypeForDevice (fixes modulation @type 0→4) — v4.0 Phase 3

### Known Issues (v4.0 scope — resolved by structural rewrites)
- Stadium presets losing cabs/effects (Phase 5 — Stadium Structure Rewrite)
- ~~Pod Go presets missing cab for amp~~ (Phase 2 — resolved: snapshots now include all blocks)

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
- `C:\Users\dsbog\Downloads\ROCK CRUNCH.pgp` — Pod Go reference (10 blocks, @controller:11)
- `C:\Users\dsbog\Downloads\A7X.pgp` — Pod Go reference (preamp model, minimal controllers)
- `C:\Users\dsbog\Downloads\CATS NO OTO4.hlx` — HX Stomp reference (@controller:9, custom snapshot names)
- `C:\Users\dsbog\Downloads\Bass Rig.hlx` — HX Stomp reference (8 blocks, split/join, variax)

### Blockers/Concerns
- HD2_AppDSPFlowBlock padding model name unverified against Pod Go Edit (minor)

### Git State
Last commit: e1eb204
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-08
Stopped at: Phase 3 complete, ready to plan Phase 4
Next action: /paul:plan for Phase 4 (HX Stomp XL Structure Rewrite)
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
