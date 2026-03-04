# Phase 32 Summary — Type System Foundation for Helix Stadium

**Status:** COMPLETE
**Date:** 2026-03-04
**Tests:** 108/108 passing
**Build:** Clean (TypeScript strict, no errors)

## What Was Done

Phase 32 laid the type system and constant foundations required by all subsequent Stadium phases (33-38). No preset generation was implemented — the /api/generate route returns HTTP 501 for Stadium until Phase 35 wires buildHspFile().

### Files Modified

#### src/lib/helix/types.ts
- Added `"helix_stadium"` to the `DeviceTarget` union type
- Added `DEVICE_IDS.helix_stadium = 2490368` (source: FluidSolo Stadium_Metal_Rhythm.hsp, meta.device_id, 2026-03-04)
- Added `isStadium(device: DeviceTarget): boolean` guard function

#### src/lib/helix/config.ts
- Added `STADIUM_CONFIG` constant block:
  - `STADIUM_MAGIC_HEADER: "rpshnosj"` — 8-byte ASCII magic prepended before JSON
  - `STADIUM_MAX_BLOCKS_PER_PATH: 12` — user-assignable effect blocks per path
  - `STADIUM_MAX_SNAPSHOTS: 8` — snapshot slots per preset
  - `STADIUM_MAX_PATHS: 4` — signal paths (1A, 1B, 2A, 2B)
  - `STADIUM_DEVICE_VERSION: 301990022` — from real .hsp file inspection

#### src/lib/helix/index.ts
- Exported `STADIUM_CONFIG` from `./config`
- Exported `isStadium` from `./types`

#### src/app/api/generate/route.ts
- Added `"helix_stadium"` branch to device resolution if/else chain
- Imported `isStadium` from `@/lib/helix`
- Added HTTP 501 stub for Stadium (TODO Phase 35: replace with buildHspFile() call)

#### src/app/api/map/route.ts
- Added `"helix_stadium"` branch to device resolution if/else chain
- Stadium rig mapping now works (mapRigToSubstitutions falls through to Helix path — STAD-08 partial)

#### src/lib/planner.ts
- Imported `isStadium` alongside `isPodGo`
- Added `const stadium = device ? isStadium(device) : false`
- Updated `deviceName` ternary to include "Helix Stadium" case
- Added Stadium device restriction note in prompt (single amp, 4 effects max, Stadium-compatible model names)

### Files Not Modified (Verified Correct)
- `models.ts` — uses `isPodGo()` guards only; Stadium falls through to Helix path correctly
- `chain-rules.ts` — uses `isPodGo()` guards only; Stadium falls through to Helix path correctly
- `validate.ts` — uses `isPodGo()` guards only; Stadium falls through to Helix path correctly
- `snapshot-engine.ts` — no DeviceTarget usage; no changes needed
- `param-engine.ts` — no DeviceTarget usage; no changes needed
- `preset-builder.ts` — uses `DEVICE_IDS[device]` Record lookup; auto-handles Stadium (NOT modified per constraint)
- `podgo-builder.ts` — NOT modified per constraint

## Key Design Decisions

1. **TypeScript exhaustiveness as integration checklist**: Adding "helix_stadium" to DeviceTarget surfaces all unimplemented handlers as compiler errors — this confirms Phase 32 is complete when `npm run build` passes.

2. **Stadium falls through to Helix path**: For Phase 32, Stadium uses the same Helix LT/Floor chain/validate/model paths. Phases 33-34 will add Stadium-specific filtering and validation.

3. **HTTP 501 stub**: The generate route immediately returns 501 for Stadium so the UI can show a graceful error rather than producing a malformed preset. Phase 35 wires the real builder.

4. **Device ID source**: 2490368 from `meta.device_id` in real Helix Stadium .hsp file (not `data.device` like .hlx — Stadium uses a different top-level structure). This is the authoritative value from Phase 31 research.

## Requirements Satisfied

- STAD-01: `DeviceTarget` includes `"helix_stadium"` ✓
- STAD-01: `DEVICE_IDS.helix_stadium = 2490368` ✓
- STAD-01: `isStadium()` guard function exported ✓
- STAD-01: `STADIUM_CONFIG` with all format constants exported ✓
- STAD-08 (partial): `/api/map` accepts `device: "helix_stadium"` ✓
- NFR-01: TypeScript strict — build clean ✓
- NFR-02: All 108 existing tests pass ✓
