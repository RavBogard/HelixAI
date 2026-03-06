# Phase 63: Stadium Firmware Parameter Completeness - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Every Stadium preset emits all 27+ firmware parameters per amp block, sourced from real .hsp corpus extraction. Param bleed from previously loaded presets on hardware is eliminated. Each Agoura amp model has its complete firmware param table including hidden params (AmpCabPeak*, AmpCabShelf*, AmpCabZFir, Hype, ZPrePost) and model-specific voice controls (Channel, Boost, Bright, Fat, etc.). Stadium effect blocks also emit complete model param sets.

</domain>

<decisions>
## Implementation Decisions

### Corpus Coverage for Missing Models (Claude decides)
- We have real .hsp corpus data for 10 of 18 Agoura amp models
- Models with corpus: USTweedman, WhoWatt103, USLuxeBlack, USPrincess76, USDoubleBlack, RevvCh3Purple, Solid100, BritPlexi, GermanXtraRed, Brit2203MV
- Models without corpus (8): GermanClean, GermanCrunch, GermanLead, Brit800, USClean, USTrem, TreadPlateRed, TreadPlateOrange
- Claude derives missing model-specific params from same-family models (e.g., German Clean/Crunch/Lead from German Xtra Red, Brit 800 from Brit 2203 MV, Tread Plate from German Xtra Red)
- Hidden params (AmpCab*, Hype, ZPrePost) use universal defaults — corpus shows they are identical across all models

### Hidden Param Default Values (Claude decides)
- All 12 hidden firmware params have consistent defaults across the entire corpus (only exception: one preset that tweaked AmpCab* for tone shaping)
- Universal defaults (from corpus median):
  - AmpCabPeak2Fc: 1000.0, AmpCabPeak2G: 0.0, AmpCabPeak2Q: 0.707
  - AmpCabPeakFc: 100.0, AmpCabPeakG: 0.0, AmpCabPeakQ: 0.707
  - AmpCabShelfF: 1000.0, AmpCabShelfG: 0.0
  - AmpCabZFir: 0, AmpCabZUpdate: 0
  - Hype: 0.0 (neutral — not auto-applied, it's a creative choice)
  - ZPrePost: 0.3
- These defaults represent "transparent/bypass" state — they don't alter tone when present
- Rationale: 0.0 Hype means no EQ enhancement. Non-zero Hype (seen in 4/11 corpus presets at 0.3-0.53) is an artistic choice, not a default

### Model-Specific Voice Parameters (Claude decides)
- Each Agoura amp has unique voice controls with model-specific names:
  - USTweedman: BrightDrive, NormalDrive, Channel
  - WhoWatt103: BrtDrive, NormDrive, Channel, Output Volume
  - USLuxeBlack: Channel, VibBass, VibTreb, VibratoVolume
  - USPrincess76: Treb (not "Treble"!)
  - USDoubleBlack: Bright, Channel, MasterVol, VibBass, VibBright, VibMid, VibTreb, VibratoVolume
  - RevvCh3Purple: Aggression, Bright, Ch Level, Contour, Depth, Fat
  - Solid100: Channel, NrmBright, NrmMode, OD MVol, OD Vol
  - BritPlexi: BrightDrv, NormDrv, Channel
  - GermanXtraRed: Boost, Excursion_Depth, Old_New, PreEQ_Brt, Structure
  - Brit2203MV: Jack
- Voice params are emitted at corpus-derived defaults — the AI does NOT interact with them
- Claude picks whether these go in STADIUM_AMPS.defaultParams or in a separate firmware params table
- Claude picks how param-engine.ts merges voice params with the standard amp defaults

### Effect Block Param Completeness (Claude decides)
- Corpus analysis confirms: effect blocks have NO hidden firmware params — their params match standard model definitions
- STADPARAM-04 means ensuring every effect block emits ALL of its model's params (not just the few overridden by param-engine.ts)
- Current issue: param-engine only emits category-level overrides (e.g., Drive/Bass/Mid/Treble for amps), not all model defaults
- For effects: the model's defaultParams from models.ts is the complete set — it must be emitted fully
- Claude decides how to ensure resolveDefaultParams() emits every key from the model's defaultParams

### Param Data File Structure (Claude decides)
- Claude picks where per-model firmware param tables live
- Claude picks whether to extend existing STADIUM_AMPS model entries or create a separate data file
- Claude picks how to merge firmware params with existing param-engine resolution
- Constraint: Must not break existing HD2 param resolution (Helix/Stomp/PodGo are unaffected)

</decisions>

<specifics>
## Specific Ideas

- Some models use non-standard names for standard knobs: USPrincess76 uses "Treb" instead of "Treble", USDoubleBlack uses "MasterVol" instead of "Master". The firmware param table must use exact firmware names, not aliases
- The param-engine.ts AMP_DEFAULTS table (Drive/Master/ChVol/Sag/Bias/etc.) currently overrides model defaults with category-level values — firmware voice params must survive this override
- Some voice params are booleans (Bright: false, Fat: true, Contour: false) while most are numeric — the param table must handle mixed types
- USDoubleBlack has the most voice params (8 unique controls including full Vibrato channel) — if the model-specific table is wrong, this is the first model that will show issues
- The current `defaultParams` in STADIUM_AMPS only has 6 keys (Drive, Bass, Mid, Treble, Master, ChVol) — real firmware has 22-27 keys per model
- HX2_* prefixed effects (Horizon Gate, Parametric EQ, Noise Gate, etc.) are Stadium-native models already using correct param names

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `STADIUM_AMPS` (models.ts lines 1085-1306): 18 Agoura amp entries with 6-key defaultParams — these need expansion to full firmware param sets
- `resolveAmpParams()` (param-engine.ts): 4-layer resolution (model defaults → category → topology → paramOverrides) — needs firmware param layer
- `buildFlowBlock()` (stadium-builder.ts line 396): Reads block.parameters and emits { key: { value: X } } — already handles whatever params are provided
- `resolveCabParams()` (param-engine.ts line 440): Already has Stadium-specific conditional for 10 cab params — pattern to follow
- `.hsp corpus`: 11 real .hsp files in `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` + 3 in `tmp-stadium-research/`

### Corpus Files (source of truth for param extraction)
- `Agoura_Bassman.hsp` → Agoura_AmpUSTweedman (23 params)
- `Agoura_Hiwatt.hsp` → Agoura_AmpWhoWatt103 (23 params)
- `Bigsby_Trem.hsp` → Agoura_AmpUSLuxeBlack (23 params)
- `NH_BoomAuRang.hsp` → Agoura_AmpUSPrincess76 (19 params)
- `NH_Reflections.hsp` → Agoura_AmpUSDoubleBlack (27 params)
- `Purple Nurple.hsp` → Agoura_AmpRevvCh3Purple (27 params)
- `Stadium Rock Rig.hsp` → Agoura_AmpSolid100 (26 params)
- `Stadium_Billie_Joe.hsp` → Agoura_AmpBritPlexi (23 params)
- `Stadium_Metal_Rhythm (1).hsp` → Agoura_AmpGermanXtraRed (26 params) + Agoura_AmpBrit2203MV (22 params)
- `Stadium_Rock_Rhythm.hsp` → Agoura_AmpUSDoubleBlack (27 params) + Agoura_AmpBritPlexi (23 params)
- `real-cranked-2203.hsp` (tmp-stadium-research) → Agoura_AmpBrit2203MV (22 params)
- `real-recto.hsp` (tmp-stadium-research) → Agoura_AmpRevvCh3Purple (27 params)

### Established Patterns
- `Record<string, number>` for param values in `HelixModel.defaultParams` — needs extension to `Record<string, number | boolean | string>` for voice params
- `isStadium(device)` conditional branches in param-engine.ts — current pattern for Stadium-specific behavior
- `{ value: X }` wrapping in stadium-builder.ts — handles any param value, already works with mixed types

### Integration Points
- `src/lib/helix/models.ts` (STADIUM_AMPS): defaultParams must expand from 6 to 22-27 keys per model
- `src/lib/helix/param-engine.ts` (resolveAmpParams): Must emit firmware params without letting AMP_DEFAULTS override model-specific voice params
- `src/lib/helix/stadium-builder.ts` (buildFlowBlock): No changes needed — already emits whatever parameters are provided
- `src/lib/helix/stadium-builder.test.ts`: Tests must verify all 27+ params appear in generated amp blocks

### Current Param Count Problem
- Generated Stadium presets emit 6 amp params: Drive, Bass, Mid, Treble, Master, ChVol
- After AMP_DEFAULTS override in param-engine: 12 params (adds Sag, Bias, Presence, Hum, Ripple, BiasX)
- Real .hsp files have 22-27 amp params per model
- Missing: 12 hidden firmware params + 1-8 model-specific voice params

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 63-stadium-firmware-parameter-completeness*
*Context gathered: 2026-03-06*
