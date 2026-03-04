# Phase 38 Summary — Rig Emulation for Stadium

**Phase:** 38
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-08: Rig emulation works with `device: "helix_stadium"` — `mapRigToSubstitutions` does not throw, returns correct HD2_ IDs, and the existing `/api/map` route routes correctly

## Implementation Note

No new source code was required. The implementation was already complete:

- **Phase 32**: `/api/map` route already accepts `"helix_stadium"` and resolves it to the correct DeviceTarget
- **Phase 32-34**: `mapRigToSubstitutions` and `lookupPedal` already handle Stadium through the existing non-Pod-Go code path in `getModelIdForDevice` (returns model ID as-is) and `isModelAvailableForDevice` (Stadium branch)
- **Phase 33**: `isModelAvailableForDevice` Stadium branch correctly allows all HD2_ effect models on Stadium

## Changes Made

### src/lib/rig-mapping.test.ts

Added `"mapRigToSubstitutions — helix_stadium (STAD-08)"` describe block with 7 tests:

1. `does not throw for a known pedal` — verifies Stadium path is stable
2. `returns standard HD2_ IDs (no Mono/Stereo suffix)` — Stadium uses non-Pod-Go path
3. `returns confidence 'direct' for known pedal` — same tier as helix_lt
4. `effect substitutions use HD2_ IDs, not Agoura_ IDs` — Agoura amps only appear in generate path, not rig mapping
5. `returns a flat array with the correct length` — SubstitutionMap shape correct
6. `helix_lt result is unaffected by Stadium path` — Stadium and LT produce identical IDs for effects (no regression)
7. `pod_go result is unaffected by Stadium path` — Pod Go Mono suffix still applied (no regression)

## Verification

- `npx vitest run`: 115/115 passing (108 original + 7 new STAD-08 tests)
- `npm run build`: Clean
- Helix LT, Helix Floor, and Pod Go paths: unaffected (verified by regression tests 6 and 7)
