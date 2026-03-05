---
phase: 56-per-model-amp-overrides
plan: 02
subsystem: param-engine / models
tags: [amp-overrides, models, param-engine, non-master-volume, tdd]
dependency_graph:
  requires: [56-01]
  provides: [AMP-01, AMP-03, AMP-04, AMP-05]
  affects: [param-engine.ts, models.ts, param-engine.test.ts]
tech_stack:
  added: []
  patterns: [Layer 4 paramOverrides, ampFamily classification, non-MV amp strategy]
key_files:
  created: []
  modified:
    - src/lib/helix/models.ts
    - src/lib/helix/param-engine.test.ts
decisions:
  - "18 amp entries updated: 11 non-MV amps (Fender, Vox, Matchless, Hiwatt, Marshall) get Drive:0.55-0.60, Master:1.0; 5 high-gain amps (Mesa, Friedman, Diezel, Soldano) get Drive:0.35-0.50 with Presence anti-correlation"
  - "US Deluxe Nrm canary Drive:0.99 replaced with Drive:0.60, Master:1.0 real values"
  - "AMP-05 verified by count and spot check: all 18 overridden amps have non-empty cabAffinity (pre-existing from prior phases)"
metrics:
  duration_minutes: 5
  completed_date: "2026-03-05"
  tasks_completed: 2
  files_modified: 2
---

# Phase 56 Plan 02: Per-Model Amp Override Values Summary

18 amp model entries enriched with ampFamily and paramOverrides in models.ts; per-model override tests added; canary value replaced; full 200-test suite green with zero failures.

## What Was Built

Populated `ampFamily` and `paramOverrides` on 18 amp model entries in `AMP_MODELS`, replacing the Plan 01 canary value (Drive:0.99) with historically-accurate per-model parameter values. Each amp now produces correct Drive/Master/Presence values that override category defaults via the Layer 4 mechanism established in Plan 01.

### Amp Coverage by Family

**Fender (7 amps) — non-master-volume, Drive IS the volume knob:**
- US Deluxe Nrm: Drive:0.60, Master:1.0 (canary replaced)
- US Deluxe Vib: Drive:0.60, Master:1.0
- US Double Nrm: Drive:0.55, Master:1.0 (Twin has more headroom)
- US Double Vib: Drive:0.55, Master:1.0
- US Princess: Drive:0.60, Master:1.0
- US Small Tweed: Drive:0.60, Master:1.0 (single-ended Champ)
- Fullerton Nrm: Drive:0.55, Master:1.0 (Bassman more headroom)

**Vox (2 amps) — non-master-volume AC30/AC15:**
- Essex A30: Drive:0.60, Master:1.0
- Essex A15: Drive:0.60, Master:1.0

**Matchless (1 amp) — Class A non-master-volume:**
- Matchstick Ch1: Drive:0.55, Master:1.0

**Hiwatt (1 amp) — extreme headroom non-MV:**
- WhoWatt 100: Drive:0.40, Master:1.0

**Marshall (2 amps) — early Plexi non-master-volume:**
- Brit Plexi Nrm: Drive:0.55, Master:1.0
- Brit Plexi Brt: Drive:0.60, Master:1.0

**Mesa (2 amps) — high-gain Drive/Presence anti-correlation:**
- Cali Rectifire: Drive:0.40, Presence:0.30
- Cali IV Lead: Drive:0.50, Presence:0.35

**Friedman (1 amp) — high-gain tight:**
- Placater Dirty: Drive:0.35, Presence:0.50

**Diezel (1 amp) — high-gain:**
- Das Benzin Mega: Drive:0.45, Presence:0.45

**Soldano (1 amp) — high-gain SLO:**
- Solo Lead OD: Drive:0.50, Presence:0.30

### Test Changes

- Updated Layer 4 canary test: Drive:0.99 → Drive:0.60 + Master:1.0 assertion added
- Added: US Deluxe Nrm per-model test (AMP-03)
- Added: Essex A30 per-model test (AMP-03)
- Added: Cali Rectifire per-model test (AMP-03)
- Test count: 18 → 21 tests in param-engine.test.ts

## Decisions Made

1. 18 amp entries selected for override coverage: 11 non-MV amps with Master:1.0 strategy, 5 high-gain amps with Drive/Presence anti-correlation, 2 high-gain amps with Drive-only override.

2. US Deluxe Nrm canary Drive:0.99 replaced with Drive:0.60, Master:1.0 — the canary test also updated to assert both values.

3. AMP-05 verified by grep count (18 cabAffinity entries among the 18 overridden amps) and spot check (US Deluxe Nrm, Essex A30, Cali Rectifire all have non-empty cabAffinity). No new cabAffinity data needed — already complete from prior phases.

4. Source comment block added above AMP_MODELS declaration citing HelixHelp, Tonevault, and Line 6 community with MEDIUM confidence caveat.

## Deviations from Plan

None — plan executed exactly as written. TDD flow honored: tests committed in RED state first, then model data added to achieve GREEN.

## Verification Results

- `npx vitest run src/lib/helix/param-engine.test.ts`: 21/21 passed
- `npx vitest run`: 200/200 passed (10 test files)
- `npx tsc --noEmit`: zero errors
- AMP-05 spot check: US Deluxe Nrm, Essex A30, Cali Rectifire all have non-empty cabAffinity
- ampFamily count: 18 (grep confirmed)
- paramOverrides count: 18 (grep confirmed)

## Self-Check: PASSED

All 18 amp entries updated in `src/lib/helix/models.ts`, all tests passing, TypeScript clean.
