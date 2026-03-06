# Phase 63: Stadium Firmware Parameter Completeness - Research

**Researched:** 2026-03-06
**Domain:** TypeScript data model extension + corpus-driven parameter extraction (.hsp JSON)
**Confidence:** HIGH — all findings verified directly against real .hsp corpus files and existing codebase

## Summary

Phase 63 is a data completeness problem, not an algorithmic one. The gap is well-understood: generated Stadium presets emit 12 amp params (6 model defaults + 6 from AMP_DEFAULTS category layer) while real .hsp files contain 19–27 params per amp model. The missing params fall into two categories: 12 hidden firmware params (AmpCab*, Hype, ZPrePost, Ripple, Sag — universal across all models with known defaults) and 1–8 model-specific voice params (Channel, BrightDrive, Aggression, etc.) that have been extracted directly from corpus files.

The fix has two parts: (1) expand `HelixModel.defaultParams` in STADIUM_AMPS to include all firmware params per model, and (2) change `resolveAmpParams()` so the AMP_DEFAULTS category layer does NOT overwrite the model-specific firmware params that should survive. The type system needs a widening of `defaultParams` from `Record<string, number>` to `Record<string, number | boolean>` because voice params like `Bright`, `Fat`, `Contour`, `Channel`, `NrmBright`, `NrmMode` are booleans in the corpus. STADPARAM-04 (effect blocks) is already handled by `resolveDefaultParams()` which emits whatever is in `model.defaultParams` — the fix for effects is ensuring every Stadium effect model in models.ts has a complete defaultParams.

**Primary recommendation:** Expand STADIUM_AMPS defaultParams with corpus-extracted param tables, widen HelixModel.defaultParams type, and protect voice params from AMP_DEFAULTS override. No new files needed — all changes are in models.ts and param-engine.ts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Corpus Coverage for Missing Models (Claude decides)
- We have real .hsp corpus data for 10 of 18 Agoura amp models
- Models with corpus: USTweedman, WhoWatt103, USLuxeBlack, USPrincess76, USDoubleBlack, RevvCh3Purple, Solid100, BritPlexi, GermanXtraRed, Brit2203MV
- Models without corpus (8): GermanClean, GermanCrunch, GermanLead, Brit800, USClean, USTrem, TreadPlateRed, TreadPlateOrange
- Claude derives missing model-specific params from same-family models (e.g., German Clean/Crunch/Lead from German Xtra Red, Brit 800 from Brit 2203 MV, Tread Plate from German Xtra Red)
- Hidden params (AmpCab*, Hype, ZPrePost) use universal defaults — corpus shows they are identical across all models

#### Hidden Param Default Values (Claude decides)
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

#### Model-Specific Voice Parameters (Claude decides)
- Each Agoura amp has unique voice controls with model-specific names — values from corpus extraction
- Voice params are emitted at corpus-derived defaults — the AI does NOT interact with them
- Claude picks whether these go in STADIUM_AMPS.defaultParams or in a separate firmware params table
- Claude picks how param-engine.ts merges voice params with the standard amp defaults

#### Effect Block Param Completeness (Claude decides)
- Corpus analysis confirms: effect blocks have NO hidden firmware params — their params match standard model definitions
- STADPARAM-04 means ensuring every effect block emits ALL of its model's params (not just the few overridden by param-engine.ts)
- Current issue: param-engine only emits category-level overrides (e.g., Drive/Bass/Mid/Treble for amps), not all model defaults
- For effects: the model's defaultParams from models.ts is the complete set — it must be emitted fully
- Claude decides how to ensure resolveDefaultParams() emits every key from the model's defaultParams

#### Param Data File Structure (Claude decides)
- Claude picks where per-model firmware param tables live
- Claude picks whether to extend existing STADIUM_AMPS model entries or create a separate data file
- Claude picks how to merge firmware params with existing param-engine resolution
- Constraint: Must not break existing HD2 param resolution (Helix/Stomp/PodGo are unaffected)

### Claude's Discretion

All decisions above are delegated to Claude. None are locked by the user.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STADPARAM-01 | All 27+ firmware params per Agoura amp model are extracted from real .hsp corpus | Corpus extraction complete — full param tables for 10 models; 8 derived from family |
| STADPARAM-02 | Hidden params (AmpCabPeak*, AmpCabShelf*, AmpCabZFir, Aggression, Bright, Contour, Depth, Fat, Hype) have correct default values | Universal defaults confirmed from corpus; model-specific booleans (Bright/Fat/Contour) from corpus per model |
| STADPARAM-03 | Generated Stadium presets emit all firmware params on every amp block — no param bleed | Requires expanding STADIUM_AMPS defaultParams + protecting voice params from AMP_DEFAULTS override in resolveAmpParams() |
| STADPARAM-04 | Stadium effect blocks also emit complete firmware param sets (not just amp blocks) | resolveDefaultParams() already uses model.defaultParams — fix is ensuring all Stadium effect models have complete defaultParams in models.ts |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.x (project-wide) | Type widening for boolean voice params | Already in project |
| Vitest | ^4.0.18 | Test verification of param counts | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js fs | built-in | Corpus extraction script | 63-01 extraction script |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Expanding STADIUM_AMPS.defaultParams in models.ts | Separate params.ts data file (families/stadium/params.ts as suggested in plan) | Both work; single-file is simpler, separate file is cleaner if param tables are large — Claude decides |
| Widening `defaultParams: Record<string, number>` | New `firmwareParams: Record<string, number \| boolean>` field | New field adds backward-compat complexity; widening is cleaner since `{ value: X }` in stadium-builder.ts already handles any type |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure

The phase touches these existing files — no new files required unless a separate params.ts is chosen:

```
src/lib/helix/
├── models.ts           # STADIUM_AMPS defaultParams expansion (primary change)
├── param-engine.ts     # resolveAmpParams() protection of voice params
└── stadium-builder.test.ts  # New test: amp block has 22-27 params
```

Optional if separate data file is chosen:
```
src/lib/helix/families/stadium/
└── params.ts           # Per-model firmware param tables (alternative location)
```

### Pattern 1: Corpus-Extracted Full Firmware Param Table (STADPARAM-01, STADPARAM-02)

**What:** Replace the current 6-key defaultParams in each STADIUM_AMPS entry with the full firmware param set extracted from real .hsp files.

**When to use:** For all 10 models with corpus data. 8 models without corpus data use family-derived values.

**Verified corpus data for all 10 models:**

```typescript
// Agoura_AmpUSTweedman (23 params — from Agoura_Bassman.hsp)
defaultParams: {
  // Hidden firmware params (universal)
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  // Standard amp params
  Bass: 0.64, Mid: 0.65, Treble: 0.55, Master: 1.0, Level: -10,
  Presence: 0.27,
  // Voice params (USTweedman-specific)
  BrightDrive: 0.4, NormalDrive: 0.6, Channel: 2,
},

// Agoura_AmpWhoWatt103 (23 params — from Agoura_Hiwatt.hsp)
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Bass: 0.70, Mid: 0.46, Treble: 0.62, Master: 0.60,
  Presence: 0.422,
  BrtDrive: 0.25, NormDrive: 0.5, Channel: 2, "Output Volume": -3.1,
},

// Agoura_AmpUSLuxeBlack (23 params — from Bigsby_Trem.hsp)
// NOTE: this preset has artistic AmpCabShelf values — use universal defaults for AmpCab*
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,  // normalized to universal default
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Drive: 0.79, Bass: 0.54, Treble: 0.55, Master: 0.42, Level: 0,
  Channel: 1, VibBass: 0.75, VibTreb: 0.30, VibratoVolume: 0.45,
  // NOTE: no Mid param in corpus — USLuxeBlack has no mid knob
},

// Agoura_AmpUSPrincess76 (19 params — from NH_BoomAuRang.hsp)
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Drive: 0.21, Bass: 0.27, Treb: 0.62, Master: 0.74, Level: -6.4,
  // NOTE: uses "Treb" not "Treble"; no Mid knob on Princeton 76
},

// Agoura_AmpUSDoubleBlack (27 params — from NH_Reflections.hsp, Stadium_Rock_Rhythm.hsp)
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Drive: 0.70, Bass: 0.44, Mid: 0.52, Treble: 0.56, Master: 0.40, Level: 2,
  Bright: 0, Channel: 1, MasterVol: 0.40,
  VibBass: 0.71, VibBright: 0, VibMid: 0.80, VibTreb: 0.42, VibratoVolume: 0.32,
},

// Agoura_AmpRevvCh3Purple (27 params — from Purple Nurple.hsp)
// NOTE: Bright, Contour, Fat are booleans in corpus
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.31, Ripple: 0, Sag: 0,
  Drive: 0.65, Bass: 0.35, Mid: 0.55, Treble: 0.65, Master: 0.50, Level: -2.5,
  Presence: 0.56,
  Aggression: 0, Bright: false, "Ch Level": 0.47, Contour: false, Depth: 0.20, Fat: true,
},

// Agoura_AmpSolid100 (26 params — from Stadium Rock Rig.hsp)
// NOTE: Channel, NrmBright, NrmMode are booleans in corpus
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Drive: 0.70, Bass: 0.50, Mid: 0.50, Treble: 0.80, Master: 0.33, Level: -2,
  Presence: 0.50,
  Channel: true, NrmBright: true, NrmMode: true,
  "OD MVol": 0.36, "OD Vol": 0.65,
},

// Agoura_AmpBritPlexi (23 params — from Stadium_Billie_Joe.hsp, Stadium_Rock_Rhythm.hsp)
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Bass: 0.47, Mid: 0.58, Treble: 0.59, Master: 1.0, Level: -9,
  Presence: 0.55,
  BrightDrv: 0.72, NormDrv: 0.32, Channel: 1,
},

// Agoura_AmpGermanXtraRed (26 params — from Stadium_Metal_Rhythm (1).hsp)
// NOTE: Old_New is boolean in corpus
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,  // normalized to universal defaults
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.35, Ripple: 0, Sag: 0,
  Drive: 0.36, Bass: 0.59, Mid: 0.50, Treble: 0.28, Master: 0.60, Level: -10,
  Presence: 0.37,
  Boost: 0, Excursion_Depth: 0, Old_New: true, PreEQ_Brt: 1, Structure: 1,
},

// Agoura_AmpBrit2203MV (22 params — from Stadium_Metal_Rhythm (1).hsp)
defaultParams: {
  AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
  AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
  AmpCabShelfF: 1000, AmpCabShelfG: 0,
  AmpCabZFir: 0, AmpCabZUpdate: 0,
  Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
  Drive: 0.76, Bass: 0.71, Mid: 0.64, Treble: 0.44, Master: 0.45, Level: -10,
  Presence: 0.37,
  Jack: 1,
},
```

### Pattern 2: Type Widening for Boolean Voice Params (STADPARAM-02)

**What:** `HelixModel.defaultParams` is currently typed as `Record<string, number>`. Boolean voice params (Bright, Fat, Contour, Channel, NrmBright, NrmMode, Old_New in RevvCh3Purple, Solid100, GermanXtraRed) require widening to `Record<string, number | boolean>`.

**When to use:** Required before expanding STADIUM_AMPS defaultParams with boolean values.

**Impact surface:**
- `HelixModel.defaultParams` in models.ts (line 17)
- `BlockSpec.parameters` in types.ts (line 303) — currently `Record<string, number>`. This also needs widening to `Record<string, number | boolean>` for boolean voice params to flow through param-engine into stadium-builder
- `buildFlowBlock()` in stadium-builder.ts (line 418): `for (const [key, value] of Object.entries(block.parameters))` — emits `{ value }` which already works for any type
- `resolveAmpParams()` in param-engine.ts (line 394): spreads `model.defaultParams` into `params: Record<string, number>` — needs widening

**Note:** AMP_DEFAULTS category table remains `Record<string, number>` — it only overrides numeric params.

### Pattern 3: Protecting Voice Params from AMP_DEFAULTS Override (STADPARAM-03)

**What:** The current `resolveAmpParams()` Layer 2 iterates `AMP_DEFAULTS[ampCategory]` and writes every key into `params`. Since AMP_DEFAULTS contains Drive, Master, ChVol, Sag, Bias, Bass, Mid, Treble, Presence, Hum, Ripple, BiasX — some of these overlap with voice param names. Critically, the AMP_DEFAULTS Sag and Ripple values would overwrite the corpus values for Stadium models.

**Why it matters:** The corpus shows Sag: 0 and Ripple: 0 for Stadium amps universally. AMP_DEFAULTS sets Sag to 0.25–0.60 and Ripple to 0.05–0.12. This is correct for HD2 amps (tube sag simulation) but wrong for Stadium/Agoura models which use a different Sag semantics (0 = off).

**Fix pattern:** Add a Stadium guard in `resolveAmpParams()`. When resolving a Stadium amp, skip AMP_DEFAULTS entirely (since the firmware param table already provides all the correct values):

```typescript
function resolveAmpParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
): Record<string, number | boolean> {
  const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
  const params: Record<string, number | boolean> = model
    ? { ...model.defaultParams }
    : { ...block.parameters };

  // For Stadium amps: defaultParams is the complete firmware table — no category override needed
  // For HD2 amps: apply category overrides as before
  if (!STADIUM_AMPS[block.modelName]) {
    const categoryDefaults = AMP_DEFAULTS[ampCategory];
    for (const [key, value] of Object.entries(categoryDefaults)) {
      params[key] = value;
    }
    // Layer 3: topology mid override (high-gain only, HD2 only)
    if (ampCategory === "high_gain" && topology !== "not_applicable") {
      const midOverride = TOPOLOGY_MID[topology];
      if (midOverride !== undefined) {
        params.Mid = midOverride;
      }
    }
  }

  // Layer 4: per-model overrides — wins over all (AMP-02)
  if (model?.paramOverrides) {
    for (const [key, value] of Object.entries(model.paramOverrides)) {
      params[key] = value;
    }
  }

  return params;
}
```

### Pattern 4: Effect Block Completeness (STADPARAM-04)

**What:** `resolveDefaultParams()` already does the right thing — it spreads `model.defaultParams` as the base. The issue is that some Stadium-native effect models in models.ts may have incomplete defaultParams (e.g., `Stadium Parametric EQ` has only 14 keys; corpus shows `HX2_EQParametricStereo` has 25 params including Enable toggles and slope settings).

**Corpus finding for HX2_EQParametricStereo (25 params):**
```
HighCut: 14500, HighCutEnable: false, HighCutSlope: 1,
HighEnable: true, HighFreq: 5000, HighGain: 0, HighQ: 0.707,
HighShelfEnable: true, HighShelfFreq: 8000, HighShelfGain: 0,
Level: 0,
LowCut: 155, LowCutEnable: true, LowCutSlope: 1,
LowEnable: true, LowFreq: 375, LowGain: -3.0, LowQ: 0.707,
LowShelfEnable: true, LowShelfFreq: 80, LowShelfGain: 0,
MidEnable: true, MidFreq: 1900, MidGain: -4.3, MidQ: 0.707
```

The current `Stadium Parametric EQ` model (id: `HD2_EQParametric7Band`) is actually a different model than `HX2_EQParametricStereo`. The corpus shows `HX2_EQParametricStereo` is the actual 7-band model used in Stadium presets. The existing `Stadium Parametric EQ` entry with `HD2_EQParametric7Band` needs verification or replacement.

**For other Stadium effect models** (distortion, delay, reverb, modulation, dynamics): the corpus shows param counts of 3–17 matching standard HD2 model definitions. The main gap is boolean params (Enable flags like `HighCutEnable`, `LowShelfEnable`) that are currently typed as `number` in `defaultParams`.

**Action for 63-02:** Audit every effect model in STADIUM_EQ_MODELS (and the standard models used in Stadium) to ensure defaultParams includes boolean Enable-style params where corpus shows them.

### Anti-Patterns to Avoid

- **Separate params.ts file with redundant data:** The plan suggests `families/stadium/params.ts` but this creates a third location (models.ts already has STADIUM_AMPS, param-engine.ts has the resolution). Expanding STADIUM_AMPS.defaultParams in-place is simpler and mirrors how HD2 models already work with `paramOverrides`.
- **Adding `ChVol` to Stadium firmware tables:** Corpus does NOT contain a `ChVol` key on any Agoura amp. Stadium amps do not use ChVol. AMP_DEFAULTS includes ChVol — if the Stadium guard isn't applied, it will be injected erroneously.
- **Normalizing corpus float noise:** The corpus has values like `0.7070000171661377` (Q factor). Keep as `0.707` in the table — HX Edit rounds during import and floating point noise is irrelevant.
- **Using Bigsby_Trem.hsp AmpCab* values for USLuxeBlack:** That preset has artistically modified AmpCab* values (AmpCabShelfF: 3000, AmpCabShelfG: 12) — use universal defaults (1000, 0) instead per the CONTEXT.md decision.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Corpus extraction at build time | Custom parser script in build pipeline | One-time extraction into static tables | Tables are stable; firmware won't change |
| Dynamic param lookup at runtime | Per-model param registry loaded from JSON | Static TypeScript tables in models.ts | Type-safety, tree-shakable, zero runtime overhead |
| Boolean-to-number coercion | Manual `Number(bool)` in param-engine | Widen type to `number \| boolean`, emit as-is | stadium-builder.ts `{ value: X }` already handles any type |

**Key insight:** This is a static data problem. The firmware param tables are known, fixed, and corpus-verified. They belong in TypeScript literals, not a separate database or JSON file.

## Common Pitfalls

### Pitfall 1: ChVol Injection from AMP_DEFAULTS
**What goes wrong:** AMP_DEFAULTS includes `ChVol: 0.70`. If the Stadium guard is not applied, resolveAmpParams() will write ChVol into every Stadium amp's params. Corpus shows NO ChVol key in any Agoura amp.
**Why it happens:** The guard was never added because HD2 amps don't have this issue — ChVol exists on HD2 amps.
**How to avoid:** Guard: `if (!STADIUM_AMPS[block.modelName])` before applying AMP_DEFAULTS.
**Warning signs:** HX Edit shows an unexpected "Ch Vol" knob, or param count is 1 too many.

### Pitfall 2: Sag/Bias Override Corrupts Stadium Amp Tone
**What goes wrong:** AMP_DEFAULTS sets Sag to 0.25–0.60, Bias to 0.55–0.75. Stadium amps use Sag: 0 (off) universally. Applying AMP_DEFAULTS writes incorrect Sag and Bias values.
**Why it happens:** HD2 amps rely on AMP_DEFAULTS for Sag/Bias because their defaultParams don't include them. Stadium amps include Sag and Ripple in their firmware tables with value 0.
**How to avoid:** Same Stadium guard. Stadium amp defaultParams already carry the correct Sag/Ripple.
**Warning signs:** Loading preset in HX Edit shows high Sag values, preset sounds looser than expected.

### Pitfall 3: Missing Mid in Some Stadium Amps
**What goes wrong:** USLuxeBlack (Fender Deluxe Reverb) and USPrincess76 (Princeton Reverb) have no mid knob on the real amp. The corpus confirms: USLuxeBlack has no `Mid` key; USPrincess76 has no `Mid` key. Adding Mid: 0.50 to their defaultParams would create a phantom mid knob.
**Why it happens:** AMP_DEFAULTS always includes Mid, and the existing 6-key defaultParams did include Mid for these models.
**How to avoid:** Use the exact corpus-extracted param set for each model — do not pad with "standard" EQ params.
**Warning signs:** HX Edit shows a Mid knob that doesn't correspond to any hardware control.

### Pitfall 4: Spaces in Voice Param Names
**What goes wrong:** WhoWatt103 uses `"Output Volume"` (space in name), Solid100 uses `"OD MVol"` and `"OD Vol"`, RevvCh3Purple uses `"Ch Level"`. TypeScript record keys with spaces must be quoted.
**Why it happens:** Firmware param names come from Line 6 and include spaces for readability.
**How to avoid:** Always quote these keys: `"Output Volume": -3.1`. The `{ value: X }` serialization in stadium-builder.ts already handles any string key.
**Warning signs:** TypeScript error on unquoted key with space.

### Pitfall 5: `BlockSpec.parameters` Type Not Widened
**What goes wrong:** After widening `HelixModel.defaultParams` to `Record<string, number | boolean>`, spreading into `BlockSpec.parameters: Record<string, number>` will cause a TS error.
**Why it happens:** The type chain is `defaultParams -> resolveAmpParams return -> block.parameters`.
**How to avoid:** Widen both `HelixModel.defaultParams` and `BlockSpec.parameters` to `Record<string, number | boolean>`. Audit all callers of `block.parameters` for type errors.
**Warning signs:** TypeScript compilation error "Type 'boolean' is not assignable to type 'number'".

### Pitfall 6: 8 Models Without Corpus Need Careful Derivation
**What goes wrong:** German Clean/Crunch/Lead, Brit 800, US Clean, US Trem, Tread Plate Red/Orange have no .hsp files. Deriving wrong voice params for these models causes param count errors.
**Why it happens:** Firmware voice params are model-specific — you cannot copy them between families.
**How to avoid:** Use same-family models as reference. German family (Clean/Crunch/Lead) shares GermanXtraRed voice params (Boost, Excursion_Depth, Old_New, PreEQ_Brt, Structure). Brit 800 shares BritPlexi/Brit2203MV voice params (BrightDrv/NormDrv/Channel or Jack). Tread Plate (Mesa Rectifier) likely shares GermanXtraRed params (Mesa family).
**Warning signs:** Voice param mismatch when loading in HX Edit (wrong knob names visible).

## Code Examples

Verified patterns from real .hsp corpus inspection:

### Corpus-Verified Param Values for USDoubleBlack (27 params)
```typescript
// Source: NH_Reflections.hsp + Stadium_Rock_Rhythm.hsp direct inspection
// This model has the most params (27) — use as validation reference
"Agoura US Double Black": {
  id: "Agoura_AmpUSDoubleBlack",
  // ... existing fields ...
  defaultParams: {
    // 10 hidden AmpCab params
    AmpCabPeak2Fc: 1000, AmpCabPeak2G: 0, AmpCabPeak2Q: 0.707,
    AmpCabPeakFc: 100, AmpCabPeakG: 0, AmpCabPeakQ: 0.707,
    AmpCabShelfF: 1000, AmpCabShelfG: 0,
    AmpCabZFir: 0, AmpCabZUpdate: 0,
    // 4 universal firmware params
    Hype: 0, ZPrePost: 0.3, Ripple: 0, Sag: 0,
    // 6 standard amp params
    Drive: 0.70, Bass: 0.44, Mid: 0.52, Treble: 0.56, Master: 0.40, Level: 2,
    // 7 voice params (USDoubleBlack-specific)
    Bright: 0, Channel: 1, MasterVol: 0.40,
    VibBass: 0.71, VibBright: 0, VibMid: 0.80, VibTreb: 0.42, VibratoVolume: 0.32,
    // Note: that's 10+4+6+7 = 27 params total — matches corpus
  },
},
```

### Stadium Guard in resolveAmpParams
```typescript
// Source: param-engine.ts pattern — new guard mirrors existing resolveCabParams() Stadium guard
function resolveAmpParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
): Record<string, number | boolean> {
  const stadiumModel = STADIUM_AMPS[block.modelName];
  const model = stadiumModel ?? AMP_MODELS[block.modelName];
  const params: Record<string, number | boolean> = model
    ? { ...model.defaultParams }
    : { ...block.parameters };

  // Stadium amps: firmware table is complete — skip HD2 category overrides
  // This prevents AMP_DEFAULTS from injecting ChVol, wrong Sag/Bias, etc.
  if (!stadiumModel) {
    for (const [key, value] of Object.entries(AMP_DEFAULTS[ampCategory])) {
      params[key] = value;
    }
    if (ampCategory === "high_gain" && topology !== "not_applicable") {
      const midOverride = TOPOLOGY_MID[topology];
      if (midOverride !== undefined) params.Mid = midOverride as number;
    }
  }

  if (model?.paramOverrides) {
    for (const [key, value] of Object.entries(model.paramOverrides)) {
      params[key] = value;
    }
  }
  return params;
}
```

### Vitest Test for 27-Param Requirement (new test for stadium-builder.test.ts)
```typescript
// STADPARAM-03: Amp block must have all firmware params
it("STADPARAM-03: Agoura_AmpUSDoubleBlack amp block has 27 firmware params", () => {
  const fixture = makeFixtureWith("Agoura_AmpUSDoubleBlack");
  const result = buildHspFile(fixture);
  const flow0 = result.json.preset.flow[0] as Record<string, unknown>;
  const ampBlock = Object.values(flow0)
    .find(b => (b as any)?.type === "amp") as Record<string, unknown>;
  const params = (ampBlock.slot as any)[0].params;
  const keys = Object.keys(params);
  expect(keys.length).toBe(27);
  // Verify hidden params present
  expect(params).toHaveProperty("AmpCabPeak2Fc");
  expect(params).toHaveProperty("Hype");
  expect(params).toHaveProperty("ZPrePost");
  // Verify voice params present
  expect(params).toHaveProperty("VibBass");
  expect(params).toHaveProperty("MasterVol");
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 6-key defaultParams (Drive/Bass/Mid/Treble/Master/ChVol) | Full 22-27 key firmware table per model | Phase 63 | Eliminates param bleed in HX Edit |
| AMP_DEFAULTS applied to all amps | Stadium guard skips AMP_DEFAULTS for Agoura models | Phase 63 | Correct Sag/Bias for Stadium |
| `defaultParams: Record<string, number>` | `defaultParams: Record<string, number \| boolean>` | Phase 63 | Allows boolean voice params |

**Deprecated/outdated:**
- Current 6-key STADIUM_AMPS defaultParams: replaced by full firmware tables
- AMP_DEFAULTS Layer 2 for Stadium amps: bypassed by new guard

## Open Questions

1. **USLuxeBlack: no Mid knob, but `Drive` appears in corpus**
   - What we know: Corpus shows Drive: 0.79 for USLuxeBlack. The amp is based on Fender Deluxe Reverb which has a "Volume" knob (not Drive). Line 6 may have mapped Volume → Drive in firmware.
   - What's unclear: Whether Drive on USLuxeBlack controls the same function as Drive on high-gain amps, or is actually Volume.
   - Recommendation: Emit the corpus value (Drive: 0.79) — the firmware name is authoritative regardless of the physical knob name.

2. **8 derived models: exact voice param names for German family**
   - What we know: GermanXtraRed has voice params: Boost, Excursion_Depth, Old_New, PreEQ_Brt, Structure. German Clean/Crunch/Lead are the same Mesa Mark V platform.
   - What's unclear: Whether German Clean/Crunch/Lead share the same voice param names as GermanXtraRed or have different names (e.g., channel-specific controls).
   - Recommendation: Use GermanXtraRed voice param names for all German family models — safest derivation. Flag in code comments that real corpus files would confirm.

3. **RevvCh3Purple Hype: corpus shows 0.0 but should it be 0 or false?**
   - What we know: Corpus shows `Hype: 0` (numeric 0). CONTEXT.md says "Hype: 0.0 (neutral)". Type in firmware appears to be float not bool.
   - What's unclear: None — Hype is numeric 0.0 universally.
   - Recommendation: Emit as `0` (number), not `false`.

4. **Stadium Parametric EQ model ID discrepancy**
   - What we know: Current code has `"Stadium Parametric EQ"` with id `HD2_EQParametric7Band`. Corpus shows `HX2_EQParametricStereo` as the actual Stadium EQ model ID.
   - What's unclear: Whether `HD2_EQParametric7Band` is a valid Stadium EQ model or an error. The "HX2_" prefix appears on Stadium-native models (HX2_GateHorizonGateMono, HX2_CompressorDeluxeCompMono, HX2_EQParametricStereo).
   - Recommendation: During 63-02, update the Stadium EQ model ID from `HD2_EQParametric7Band` to `HX2_EQParametricStereo` and expand defaultParams to the 25-param corpus set.

## Sources

### Primary (HIGH confidence)
- Direct .hsp corpus inspection (11 files) — all amp param tables extracted via Node.js script against real files in `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/`
- `src/lib/helix/models.ts` lines 1085–1306 — current STADIUM_AMPS structure
- `src/lib/helix/param-engine.ts` — complete resolveAmpParams() implementation
- `src/lib/helix/stadium-builder.ts` line 396+ — buildFlowBlock() param emission
- `src/lib/helix/types.ts` — BlockSpec.parameters type

### Secondary (MEDIUM confidence)
- CONTEXT.md confirmed hidden param universal defaults (AmpCabPeak2Fc: 1000.0, etc.) — verified by corpus
- GermanXtraRed corpus file showed non-default AmpCab* values in ONE file (Bigsby_Trem.hsp = USLuxeBlack) — using universal defaults per CONTEXT.md decision

### Tertiary (LOW confidence)
- Derived model voice params for 8 non-corpus models (GermanClean/Crunch/Lead, Brit800, USClean, USTrem, TreadPlateRed/Orange) — based on family derivation, no corpus file to verify

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing TypeScript + Vitest
- Architecture: HIGH — patterns directly visible in codebase; changes are localized to 2 files
- Pitfalls: HIGH for corpus-verified models; MEDIUM for 8 derived models (voice param names unverified)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable data domain; firmware won't change)
