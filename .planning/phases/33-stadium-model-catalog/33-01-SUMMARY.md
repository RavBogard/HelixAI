# Phase 33 Summary — Stadium Model Catalog

**Phase:** 33
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-03: Stadium model catalog with `Agoura_*` amp entries and Stadium-specific EQ

## Changes Made

### src/lib/helix/models.ts

1. Added `isStadium` to imports from `./types`
2. Added `stadiumOnly?: boolean` field to `HelixModel` interface
3. Added `STADIUM_AMPS` constant — 12 Agoura amp entries (all `stadiumOnly: true`):
   - 2 confirmed from real .hsp file (Phase 31): `Agoura_AmpGermanXtraRed`, `Agoura_AmpBrit2203MV`
   - 1 from ARCHITECTURE.md: `Agoura_AmpWhoWatt103`
   - 9 derived from confirmed naming convention: GermanClean, GermanCrunch, GermanLead, Brit800, BritPlexi, USClean, USTrem, TreadPlateRed, TreadPlateOrange
4. Added `STADIUM_EQ_MODELS` constant — Stadium-specific EQ:
   - `HD2_EQParametric7Band` — Stadium 7-Band Parametric EQ (replaces 5-band)
   - `HD2_EQGraphic10Band` — 10-Band Graphic (retained for Stadium)
5. Updated `getModelListForPrompt()` — added Stadium-specific path returning STADIUM_AMPS, CAB_MODELS, HD2_ effects, and STADIUM_EQ_MODELS (excludes Simple EQ / Low+High Cut)
6. Updated `isModelAvailableForDevice()` — Stadium: Agoura + HD2_ effects available, Simple EQ / Low+High Cut / Tilt EQ excluded; Non-Stadium: models with `stadiumOnly: true` are excluded

### src/lib/helix/index.ts

- Added `export { STADIUM_AMPS, STADIUM_EQ_MODELS } from "./models";` under Stadium model catalog comment

## Verification

- `npx vitest run`: 108/108 passing
- `npm run build`: Clean (TypeScript strict mode, Turbopack)

## Design Decisions

- **12 entries in STADIUM_AMPS**: REQUIREMENTS.md acceptance criterion is "at least one `Agoura_*` amp"; ROADMAP goal was "at least 10". Chose 12 using naming convention derivation from 3 confirmed/documented IDs.
- **STADIUM_EQ_MODELS includes 10-Band Graphic**: This model exists in the base Helix catalog and is backward-compatible with Stadium — retained for Stadium completeness.
- **Stadium-specific getModelListForPrompt path**: Clean separation instead of extending the existing filterModels() — Stadium needs a fundamentally different catalog structure (no Helix amps, different EQ set).
- **stadiumOnly flag on all STADIUM_AMPS entries**: Prevents Agoura models from appearing in Helix LT/Floor/Pod Go planner prompts. isModelAvailableForDevice() also blocks them for non-Stadium devices.
