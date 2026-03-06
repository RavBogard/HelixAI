---
phase: 67-stadium-integration-quality
plan: 01
subsystem: helix-catalog-and-capabilities
tags: [stadium, catalog, capabilities, tdd, bug-fix]
dependency-graph:
  requires: []
  provides: [STADQ-01, STADQ-02]
  affects: [tone-intent-schema, chain-rules-dual-amp-gate]
tech-stack:
  added: []
  patterns: [tdd-red-green, capability-driven-gating]
key-files:
  created: []
  modified:
    - src/lib/helix/catalogs/stadium-catalog.ts
    - src/lib/helix/catalogs/stadium-catalog.test.ts
    - src/lib/helix/device-family.ts
    - src/lib/helix/device-family.test.ts
    - src/lib/helix/chain-rules.ts
decisions:
  - "[67-01]: WAH_MODELS and VOLUME_MODELS spread into STADIUM_EFFECT_NAMES — Stadium overrides the [62-01] exclusion because dualAmpSupported: false blocks the AMP_MODELS crash path; Helix/Stomp/PodGo remain unchanged"
  - "[67-01]: STADIUM_CAPABILITIES.dualAmpSupported set to false — Stadium prompt uses includeSecondAmp: false and the dual-amp path uses HD2-only AMP_MODELS which cannot handle Agoura amp names"
metrics:
  duration: ~2 minutes
  completed: 2026-03-06
  tasks-completed: 2
  files-modified: 5
  tests-added: 6
  tests-total-passing: 401
---

# Phase 67 Plan 01: Stadium Catalog and Capabilities Quality Fixes Summary

Two data-correctness bugs fixed via TDD: WAH/VOLUME model names spread into STADIUM_EFFECT_NAMES so the Zod schema accepts them, and dualAmpSupported set to false to block the HD2-only AMP_MODELS crash path for Agoura devices.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Add WAH/VOLUME to STADIUM_EFFECT_NAMES and update catalog tests | 8d48e69 (RED), eca6182 (GREEN) | Complete |
| 2 | Fix dualAmpSupported to false and update capability tests | c50fe46 (RED), c0830c2 (GREEN) | Complete |

## What Was Built

### Task 1: WAH/VOLUME in STADIUM_EFFECT_NAMES (STADQ-01)

**Problem:** `STADIUM_EFFECT_NAMES` omitted `WAH_MODELS` and `VOLUME_MODELS` keys. The Stadium-specific `getToneIntentSchema("stadium")` built a Zod enum from those names, meaning wah and volume model names would be rejected by the schema — Claude could not generate Stadium presets with wah pedals or volume blocks.

**Fix in `src/lib/helix/catalogs/stadium-catalog.ts`:**
- Added `WAH_MODELS` and `VOLUME_MODELS` to the import from `"../models"`
- Spread `...Object.keys(WAH_MODELS)` and `...Object.keys(VOLUME_MODELS)` into `STADIUM_EFFECT_NAMES` after the existing `STADIUM_EQ_MODELS` spread
- Updated JSDoc to document the override of [62-01] for Stadium and explain the safety rationale

**Tests updated in `src/lib/helix/catalogs/stadium-catalog.test.ts`:**
- Replaced `"has no overlap with WAH_MODELS keys"` with `"contains all WAH_MODELS keys"` (containment loop)
- Replaced `"has no overlap with VOLUME_MODELS keys"` with `"contains all VOLUME_MODELS keys"` (containment loop)
- Added `getToneIntentSchema("stadium").safeParse()` acceptance tests for one WAH key and one VOLUME key

### Task 2: dualAmpSupported: false for Stadium (STADQ-02)

**Problem:** `STADIUM_CAPABILITIES.dualAmpSupported` was `true`. When `chain-rules.ts` evaluates `isDualAmp = !!(intent.secondAmpName && intent.secondCabName && caps.dualAmpSupported)`, a `true` value would allow entry into the dual-amp path which calls `AMP_MODELS[intent.secondAmpName]`. `AMP_MODELS` is an HD2 catalog — it has no Agoura amp names — causing a hard crash/undefined block.

**Fix in `src/lib/helix/device-family.ts`:**
- Changed `dualAmpSupported: true` to `dualAmpSupported: false` in `STADIUM_CAPABILITIES`
- Added inline comment explaining both reasons: Stadium prompt uses `includeSecondAmp: false`, and the chain-rules dual-amp path uses HD2-only `AMP_MODELS`

**Fix in `src/lib/helix/chain-rules.ts`:**
- Updated comment at `isDualAmp` guard (line ~352) from "Dual-amp is only for Helix LT/Floor" to "Dual-amp is capability-driven — only devices with dualAmpSupported: true (Helix Floor/LT/Rack) enter this path"
- No logic change — the comment now accurately reflects the capability-driven pattern

**Tests updated in `src/lib/helix/device-family.test.ts`:**
- Changed `helix_stadium` `dualAmpSupported` assertion from `true` to `false`
- Added `helix_stadium_xl` `dualAmpSupported === false` test in the XL describe block

## Success Criteria Check

1. STADIUM_EFFECT_NAMES includes all WAH_MODELS and VOLUME_MODELS keys — CONFIRMED (containment tests pass)
2. getToneIntentSchema("stadium") accepts wah and volume model names — CONFIRMED (safeParse tests pass)
3. STADIUM_CAPABILITIES.dualAmpSupported === false — CONFIRMED (capability tests pass)
4. chain-rules.ts comment accurately describes the capability-driven isDualAmp gate — CONFIRMED (updated)
5. All tests pass including updated tests and existing regression tests — CONFIRMED (401/401 pass)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `src/lib/helix/catalogs/stadium-catalog.ts` — contains `WAH_MODELS` and `VOLUME_MODELS`
- `src/lib/helix/device-family.ts` — contains `dualAmpSupported: false`
- `src/lib/helix/catalogs/stadium-catalog.test.ts` — contains updated containment tests
- `src/lib/helix/device-family.test.ts` — contains `dualAmpSupported === false` tests
- `src/lib/helix/chain-rules.ts` — contains updated comment

Commits verified:
- 8d48e69, eca6182 — Task 1 (RED then GREEN)
- c50fe46, c0830c2 — Task 2 (RED then GREEN)

All 401 tests pass with no regressions.
