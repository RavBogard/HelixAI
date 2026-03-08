# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-08)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v3.0 — Preset Format Correctness & Quality

## Current Position

Milestone: v3.0 — Preset Format Correctness & Quality — COMPLETE
Phase: 1 of 1 (Preset Format Correctness Audit & Fix) — Complete
Plan: 06-01 complete
Status: Milestone complete — all phases done
Last activity: 2026-03-08 — UNIFY complete, phase and milestone closed

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — milestone complete]
```

## Accumulated Context

### Decisions
- Helix Native device ID 2162690 UNVERIFIED — estimated from Line 6 sequence.
- Manual JSON schema for Gemini planner (buildGeminiJsonSchema) — v1.1 Phase 1
- Removed @anthropic-ai/sdk entirely; vision migrated to Gemini — v2.0 Phase 1
- MODEL_STANDARD upgraded to gemini-3-flash-preview globally — v2.0 Phase 1
- Per-family effect intelligence via DeviceFamily switch — v2.0 Phase 2
- Keep two-context chat→planner architecture (decided, not a debt) — v2.0 Phase 3

### Known Issues (v3.0 scope)
- DSP0→DSP1 routing broken: dsp0.outputA.@output=1 routes to physical out, not DSP1
- Stomp assignments limited to 4 footswitches on Helix (should be 8+ per device)
- Stomp builder has ZERO footswitch assignments (empty object)
- Block @type for modulation=4 same as cab — needs verification
- No device-aware footswitch index configuration

### Deferred Issues
All remaining audit issues tracked in `.paul/phases/01-audit-preset-quality/01-01-AUDIT-REPORT.md`.

### Blockers/Concerns
- Need user to verify correct @output value for DSP0→DSP1 routing (or provide factory preset reference)

### Git State
Last commit: 756cf7b
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-08
Stopped at: UNIFY complete — v3.0 milestone closed
Next action: /paul:discuss-milestone (plan v4.0)
Resume file: .paul/phases/06-preset-format-correctness/06-01-SUMMARY.md

### Completed in this session:
- Task 1: Research — confirmed correct .hlx format values from real presets
- Task 2: Fixed preset-builder.ts:
  - dsp0.outputA.@output = 2 (routes to DSP1) when DSP1 has blocks
  - dsp1.inputA.@input = 0 (receives from DSP0)
  - @type for modulation fixed: 0 (was 4, same as cab)
  - @type for send_return fixed: 0 (was 9)
  - Stomp assignments expanded: 8 footswitches (was 4)
  - Primary [7,8,9,10] + secondary [2,3,4,5] indices
- All 1201 tests pass, type check clean

### Completed this session (resumed):
- Task 3: Fixed stomp-builder.ts:
  - getBlockType corrected: modulation 4→0, send_return 9→0 (match preset-builder.ts)
  - Added footswitch assignment logic (was empty `{ dsp0: {}, dsp1: {} }`)
  - HX Stomp: 3 footswitches (FS1-FS3, indices 0-2)
  - HX Stomp XL: 5 footswitches (FS1-FS5, indices 0-4)
  - Added pedalstate computation from stomp assignments
  - podgo-builder.ts: verified correct (already has footswitch assignments)
  - stadium-builder.ts: verified correct (uses .hsp format with sources/per-block bypass)
- All 1201 tests pass, type check clean

### Remaining:
- Task 4: Final checkpoint — user tests in HX Edit
- /paul:unify to close loop

---
*STATE.md — Updated after every significant action*
