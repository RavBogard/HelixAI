# Phase 34 Summary — Stadium Chain Rules + Validation

**Phase:** 34
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-04: Stadium chain rules + validation — correct block limits, mandatory blocks, and model availability

## Changes Made

### src/lib/helix/models.ts

- Updated `getAllModels()` to spread `STADIUM_AMPS` and `STADIUM_EQ_MODELS` — ensures Agoura_ and Stadium EQ model IDs are included in validate.ts VALID_IDS set

### src/lib/helix/chain-rules.ts

1. Added imports: `isStadium` from types, `STADIUM_CONFIG` from config, `STADIUM_AMPS` and `STADIUM_EQ_MODELS` from models
2. Added `STADIUM_MAX_BLOCKS_PER_PATH` and `STADIUM_PARAMETRIC_EQ` constants
3. Updated `resolveEffectModel()` to accept device parameter — searches `STADIUM_EQ_MODELS` in addition to standard catalogs when device is Stadium
4. Updated `assembleSignalChain()`:
   - Detects `stadium` flag
   - Amp resolution: checks `STADIUM_AMPS` first, falls back to `AMP_MODELS`
   - Dual-amp: disabled for Stadium v3.0 (single-path only)
   - Effect limit: max 4 user effects for Stadium (conservative to stay under 12-block limit)
   - Mandatory EQ: uses `STADIUM_EQ_MODELS["Stadium Parametric EQ"]` (HD2_EQParametric7Band) instead of standard 5-band
   - Block limit validation: Stadium path checks against `STADIUM_MAX_BLOCKS_PER_PATH` (12), not per-DSP Helix limit

### src/lib/helix/validate.ts

1. Added imports: `isStadium` from types, `STADIUM_CONFIG` from config
2. Added Stadium system model IDs to valid set: `P35_AppDSPFlowInput`, `P35_AppDSPFlowOutput`
3. Added Stadium branch in `validatePresetSpec()`:
   - Enforces all blocks on dsp0 (single-path)
   - Enforces max 12 blocks total
   - Enforces max 8 snapshots

## Verification

- `npx vitest run`: 108/108 passing
- `npm run build`: Clean (TypeScript strict mode, Turbopack)

## Design Decisions

- **getAllModels() spread**: Simplest way to make validate.ts VALID_IDS include Agoura_ IDs — no changes to validate.ts validation logic needed, just the ID set
- **Stadium effect limit = 4**: Conservative limit ensures total block count (amp+cab+boost+gate+eq+gain = up to 6 mandatory + 4 user = 10) stays safely under 12-block path limit
- **Single-path Stadium v3.0**: isDualAmp forced false for Stadium — multi-path support deferred to future phases
- **resolveEffectModel() device parameter**: Allows Stadium to look up STADIUM_EQ_MODELS entries (like "Stadium Parametric EQ") when users request them by name
