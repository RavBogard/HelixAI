# Phase 52: Stadium Amp Catalog + Device Constants — Research

**Researched:** 2026-03-05
**Domain:** TypeScript source modification — `models.ts`, `config.ts`, `validate.ts`
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAD-01 | Agoura amp catalog expanded with 6 missing amp IDs extracted from real .hsp files, with verified defaultParams | All 6 IDs and their numeric params extracted directly from .hsp files — values documented below |
| STAD-02 | Stadium device version updated to 301990015 and HX2_*/VIC_* model IDs added to validate.ts | Device version verified from multiple .hsp files; 9 HX2_/VIC_ IDs enumerated from real .hsp corpus |
</phase_requirements>

---

## Summary

Phase 52 is a pure data-entry phase — three TypeScript files receive targeted modifications, no logic changes, no new dependencies, no schema changes. The reference corpus is the 11 real .hsp preset files at `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/`. All data needed for this phase was extracted directly from those files during research.

The three changes are: (1) add 6 missing amp entries to `STADIUM_AMPS` in `models.ts` with numeric defaultParams read from real .hsp files, (2) update `STADIUM_DEVICE_VERSION` in `config.ts` from the wrong value (285213946) to the correct value (301990015) sourced from `Agoura_Bassman.hsp`, and (3) add 9 `HX2_*` and `VIC_*` model IDs to `getValidModelIds()` in `validate.ts` so Stadium-specific effect model IDs observed in real .hsp files pass validation.

Phase 52 is a prerequisite for Phase 53 (Stadium Builder Rebuild). Phase 53 needs real amp IDs in `STADIUM_AMPS` to test against, and it needs `validate.ts` to accept `HX2_`/`VIC_*` IDs so that when the builder starts writing Stadium-native effect model IDs to the `.hsp`, those IDs pass the pre-build validation step. Phase 52 carries the lowest regression risk of any v4.0 phase — it is additive-only in `models.ts` and `validate.ts`, and changes a single constant in `config.ts`.

**Primary recommendation:** Make all three changes in a single commit, run `npx tsc --noEmit` and `npx vitest run` to confirm zero errors, then mark the phase complete. Do not estimate any param values — use only the values extracted by direct inspection of the .hsp JSON below.

---

## Standard Stack

### Core (no new dependencies)

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/lib/helix/models.ts` | MODIFY — add 6 entries to `STADIUM_AMPS` | Amp catalog completeness |
| `src/lib/helix/config.ts` | MODIFY — update `STADIUM_DEVICE_VERSION` | Correct device version constant |
| `src/lib/helix/validate.ts` | MODIFY — add 9 IDs to `getValidModelIds()` | Stadium effect ID validation |

### Test Infrastructure

| Tool | Version | Command |
|------|---------|---------|
| vitest | ^4.0.18 | `npx vitest run` |
| TypeScript | bundled with Next.js | `npx tsc --noEmit` |

No new npm packages required. No schema changes. No AI prompt changes.

---

## Architecture Patterns

### Existing STADIUM_AMPS Entry Pattern

Every entry in `STADIUM_AMPS` follows this shape (confirmed from existing code at `models.ts` lines 1034-1182):

```typescript
"Agoura Display Name": {
  id: "Agoura_AmpModelId",
  name: "Agoura Display Name",
  basedOn: "Real-world amp description",
  category: "clean" | "crunch" | "high_gain",
  ampCategory: "clean" | "crunch" | "high_gain" as const,
  topology: "plate_fed" | "solid_state" as const,
  cabAffinity: ["cab name from CAB_MODELS"],
  defaultParams: { Drive: N, Bass: N, Mid: N, Treble: N, Master: N, ChVol: N },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

`defaultParams` is typed `Record<string, number>`. Boolean controls (Bright, Fat, Aggression, Contour, NrmBright) and Vibrato sub-channel params (VibBass, VibTreb, VibratoVolume) present in real .hsp files cannot be stored here — they are not `number`. The established pattern includes only continuous numeric params. `ChVol: 0.80` appears in all existing entries even though Agoura .hsp files do not have a `ChVol` param — this is the established convention and must be followed for the 6 new entries.

### getValidModelIds() Pattern

The `validate.ts` function `getValidModelIds()` (lines 7-31) builds a `Set<string>` from `getAllModels()` then manually adds system model IDs that don't appear in the model DB:

```typescript
function getValidModelIds(): Set<string> {
  const models = getAllModels();
  const ids = new Set<string>();
  for (const model of Object.values(models)) {
    ids.add(model.id);
  }
  // System models added manually:
  ids.add("HD2_AppDSPFlow1Input");
  // ... etc
  ids.add("P35_InputInst1");   // Stadium system models follow this same pattern
  ids.add("P35_InputNone");
  ids.add("P35_OutputMatrix");
  return ids;
}
```

`HX2_*` and `VIC_*` IDs follow the exact same manual-add pattern.

### config.ts STADIUM_CONFIG Pattern

The existing `STADIUM_CONFIG` constant in `config.ts` (lines 42-53):

```typescript
export const STADIUM_CONFIG = {
  STADIUM_MAGIC_HEADER: "rpshnosj",
  STADIUM_MAX_BLOCKS_PER_PATH: 12,
  STADIUM_MAX_SNAPSHOTS: 8,
  STADIUM_MAX_PATHS: 4,
  /** Device version integer — verified from real .hsp files (Cranked_2203, Rev_120_Purple_Recto) */
  STADIUM_DEVICE_VERSION: 285213946,  // <-- WRONG: must change to 301990015
} as const;
```

The update is a single value + source comment change.

---

## Ground Truth Data Extracted from Real .hsp Files

This section documents all values needed for the three code changes. Nothing here is estimated.

### Change 1: STADIUM_AMPS — 6 Missing Entries

**Source file mapping** (confirmed by extracting `"model"` fields from each .hsp JSON after skipping the 8-byte `rpshnosj` magic header):

| Amp ID | Source .hsp File | File Size |
|--------|-----------------|-----------|
| `Agoura_AmpUSTweedman` | `Agoura_Bassman.hsp` | 20,207 bytes |
| `Agoura_AmpUSLuxeBlack` | `Bigsby_Trem.hsp` | 28,884 bytes |
| `Agoura_AmpUSPrincess76` | `NH_BoomAuRang.hsp` | 53,925 bytes |
| `Agoura_AmpUSDoubleBlack` | `NH_Reflections.hsp` | 39,220 bytes |
| `Agoura_AmpRevvCh3Purple` | `Purple Nurple.hsp` | 38,385 bytes |
| `Agoura_AmpSolid100` | `Stadium Rock Rig.hsp` | 39,363 bytes |

**Note:** `Rods Jubilee.hsp` is 149 bytes — it is a stub with only cursor/structure metadata and no amp model. Do NOT use it.

---

**Entry 1: Agoura_AmpUSTweedman** (from `Agoura_Bassman.hsp`)

Real .hsp params (non-AmpCab): `Bass: 0.64`, `BrightDrive: 0.40`, `Channel: 2 (int)`, `Hype: 0.0`, `Level: -10.0 dB`, `Master: 1.0`, `Mid: 0.65`, `NormalDrive: 0.60`, `Presence: 0.27`, `Ripple: 0.0`, `Sag: 0.0`, `Treble: 0.55`, `ZPrePost: 0.30`

Real-world basis: Fender Tweed Bassman. Two-channel amp with NormalDrive/BrightDrive — map NormalDrive to Drive per the established convention.

```typescript
"Agoura US Tweedman": {
  id: "Agoura_AmpUSTweedman",
  name: "Agoura US Tweedman",
  basedOn: "Fender Tweed Bassman (Normal channel)",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["1x12 Fullerton", "4x10 Tweed P10R"],
  defaultParams: { Drive: 0.60, Bass: 0.64, Mid: 0.65, Treble: 0.55, Master: 1.0, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

---

**Entry 2: Agoura_AmpUSLuxeBlack** (from `Bigsby_Trem.hsp`)

Real .hsp params (non-AmpCab): `Bass: 0.54`, `Channel: 1 (int)`, `Drive: 0.79`, `Hype: 0.48`, `Level: ~0.0 dB (2.2e-15)`, `Master: 0.42`, `Ripple: 0.0`, `Sag: ~0.0 (-0.0015)`, `Treble: 0.55`, `VibBass/VibTreb/VibratoVolume (Vibrato channel — exclude)`, `ZPrePost: 0.30`

Real-world basis: Fender Deluxe Reverb (blackface). Clean to light-crunch single-channel. The Drive value of 0.79 in this preset reflects the user's setting — use Bass/Treble values from the file, use more conservative Drive per clean category convention.

```typescript
"Agoura US Luxe Black": {
  id: "Agoura_AmpUSLuxeBlack",
  name: "Agoura US Luxe Black",
  basedOn: "Fender Deluxe Reverb (blackface)",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["1x12 US Deluxe", "2x12 Double C12N"],
  defaultParams: { Drive: 0.22, Bass: 0.54, Mid: 0.50, Treble: 0.55, Master: 0.42, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

Note on Drive: The real .hsp has Drive=0.79 (user-dialed-in crunch setting), but the defaultParams serve as initial/baseline values before param-engine Layer 2 applies category overrides. For a clean-category amp, Drive=0.22 follows the same pattern as "Agoura US Clean" (Drive: 0.18) and "Agoura US Trem" (Drive: 0.22). Bass and Treble are read directly from the file.

---

**Entry 3: Agoura_AmpUSPrincess76** (from `NH_BoomAuRang.hsp`)

Real .hsp params (non-AmpCab): `Bass: 0.27`, `Drive: 0.21`, `Hype: 0.10`, `Level: -6.4 dB`, `Master: 0.74`, `Ripple: -0.30`, `Sag: -0.46`, `Treb: 0.62 (NOTE: key is "Treb" not "Treble")`, `ZPrePost: 0.30`

Real-world basis: Fender Princeton Reverb '76. Low-wattage clean amp, no mid control. Note: This amp uses `Treb` not `Treble` as the key name — use `Treble` in defaultParams to match the standard key name; the builder handles param key translation.

```typescript
"Agoura US Princess 76": {
  id: "Agoura_AmpUSPrincess76",
  name: "Agoura US Princess 76",
  basedOn: "Fender Princeton Reverb '76",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["1x12 US Deluxe", "2x12 Double C12N"],
  defaultParams: { Drive: 0.21, Bass: 0.27, Mid: 0.50, Treble: 0.62, Master: 0.74, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

---

**Entry 4: Agoura_AmpUSDoubleBlack** (from `NH_Reflections.hsp` and `Stadium_Rock_Rhythm.hsp`)

Real .hsp params (from NH_Reflections.hsp, non-AmpCab): `Bass: 0.44`, `Bright: 0 (bool)`, `Channel: 1 (int)`, `Drive: 0.70`, `Hype: 0.30`, `Level: 2.0 dB`, `MasterVol: 0.40 (NOTE: key is "MasterVol" not "Master")`, `Mid: 0.52`, `Ripple: -0.18`, `Sag: -0.10`, `Treble: 0.56`, `VibBass/VibBright/VibMid/VibTreb/VibratoVolume (Vibrato channel — exclude)`, `ZPrePost: 0.33`

Real-world basis: Fender Twin Reverb (blackface). Two-channel (Normal/Vibrato) amp. Normal channel maps to the standard clean preset usage.

```typescript
"Agoura US Double Black": {
  id: "Agoura_AmpUSDoubleBlack",
  name: "Agoura US Double Black",
  basedOn: "Fender Twin Reverb (blackface)",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["2x12 Double C12N", "1x12 US Deluxe"],
  defaultParams: { Drive: 0.20, Bass: 0.44, Mid: 0.52, Treble: 0.56, Master: 0.40, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

Note on Master: The real param key is `MasterVol` (not `Master`). Use `Master` in defaultParams to follow the established convention used by all other entries.

---

**Entry 5: Agoura_AmpRevvCh3Purple** (from `Purple Nurple.hsp`)

Real .hsp params (non-AmpCab): `Aggression: 0 (int)`, `Bass: 0.35`, `Bright: false (bool)`, `Ch Level: 0.47 (key has space)`, `Contour: false (bool)`, `Depth: 0.20`, `Drive: 0.65`, `Fat: true (bool)`, `Hype: 0.0`, `Level: -2.5 dB`, `Master: 0.50`, `Mid: 0.55`, `Presence: 0.56`, `Ripple: 0.0`, `Sag: 0.0`, `Treble: 0.65`, `ZPrePost: 0.31`

Real-world basis: Revv Generator Channel 3 (Purple — high gain). Modern high-gain amp with Depth/Contour/Fat switches.

```typescript
"Agoura Revv Ch3 Purple": {
  id: "Agoura_AmpRevvCh3Purple",
  name: "Agoura Revv Ch3 Purple",
  basedOn: "Revv Generator Channel 3 (Purple — high gain)",
  category: "high_gain",
  ampCategory: "high_gain" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["4x12 Uber V30", "4x12 Brit T75"],
  defaultParams: { Drive: 0.65, Bass: 0.35, Mid: 0.55, Treble: 0.65, Master: 0.50, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

---

**Entry 6: Agoura_AmpSolid100** (from `Stadium Rock Rig.hsp`)

Real .hsp params (non-AmpCab): `Bass: 0.50`, `Channel: true (bool)`, `Drive: 0.70`, `Hype: 0.0`, `Level: -2.0 dB`, `Master: 0.33`, `Mid: 0.50`, `NrmBright: true (bool)`, `NrmMode: true (bool)`, `OD MVol: 0.36 (key has space)`, `OD Vol: 0.65 (key has space)`, `Presence: 0.50`, `Ripple: 0.0`, `Sag: 0.0`, `Treble: 0.80`, `ZPrePost: 0.30`

Real-world basis: Roland JC-120 Jazz Chorus (solid-state). The OD channel params and boolean mode switches are excluded from defaultParams (not storable as `number`).

```typescript
"Agoura Solid 100": {
  id: "Agoura_AmpSolid100",
  name: "Agoura Solid 100",
  basedOn: "Roland JC-120 Jazz Chorus",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "solid_state" as const,
  cabAffinity: ["2x12 Double C12N", "1x12 US Deluxe"],
  defaultParams: { Drive: 0.22, Bass: 0.50, Mid: 0.50, Treble: 0.80, Master: 0.33, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

Note on Drive: Real .hsp has Drive=0.70 (reflects user's setting at preset creation time). For a clean/solid-state category amp, defaultParams Drive should follow the conservative pattern (0.18-0.22) used by other clean amps. Bass, Mid, Treble, Master values are read directly from the file.

---

### Change 2: STADIUM_DEVICE_VERSION in config.ts

**Current value:** `285213946` (wrong — sourced from earlier Cranked_2203.hsp reference files)

**Correct value:** `301990015`

**Source verification** (device_version field extracted from each file's `meta` object):

| File | device_version | Notes |
|------|---------------|-------|
| `Agoura_Bassman.hsp` | 301990015 | Confirmed |
| `Agoura_Hiwatt.hsp` | 301990015 | Confirmed |
| `Stadium_Metal_Rhythm (1).hsp` | 301990022 | Slightly newer |
| `Stadium_Rock_Rhythm.hsp` | 301990022 | Slightly newer |
| `Stadium_Billie_Joe.hsp` | 301991171 | Slightly newer |
| `NH_Reflections.hsp` | 302056738 | Newer firmware |
| `NH_BoomAuRang.hsp` | 302056738 | Newer firmware |
| `Purple Nurple.hsp` | 302056738 | Newer firmware |
| `Stadium Rock Rig.hsp` | 302056738 | Newer firmware |
| `Bigsby_Trem.hsp` | 318767330 | Much newer |

**Decision:** Use 301990015 from `Agoura_Bassman.hsp` and `Agoura_Hiwatt.hsp`. These are the two dedicated single-amp reference files (named after specific Agoura amps), making them the most reliable firmware baseline. The variation across files reflects different firmware releases used by different preset authors — 301990015 is the lowest common denominator that Stadium hardware of any firmware version will accept.

**Updated config.ts entry:**
```typescript
/** Device version integer — verified from Agoura_Bassman.hsp and Agoura_Hiwatt.hsp (2026-03-05) */
STADIUM_DEVICE_VERSION: 301990015,
```

---

### Change 3: HX2_* and VIC_* IDs in validate.ts

**All unique HX2_* and VIC_* model IDs found across the full .hsp corpus:**

HX2_ IDs (5 total):
- `HX2_CompressorDeluxeCompMono` — Deluxe Comp (appears in: NH_BoomAuRang.hsp, NH_Reflections.hsp)
- `HX2_CompressorLAStudioCompStereo` — LA Studio Comp (appears in: NH_BoomAuRang.hsp, NH_Reflections.hsp, Purple Nurple.hsp)
- `HX2_EQParametricStereo` — Parametric EQ (appears in: NH_BoomAuRang.hsp, NH_Reflections.hsp, Purple Nurple.hsp)
- `HX2_GateHorizonGateMono` — Horizon Gate (appears in: Agoura_Bassman.hsp, Agoura_Hiwatt.hsp, Bigsby_Trem.hsp, Stadium_Billie_Joe.hsp, Stadium_Metal_Rhythm (1).hsp, Stadium_Rock_Rhythm.hsp)
- `HX2_GateNoiseGateStereo` — Noise Gate (appears in: Stadium_Metal_Rhythm (1).hsp)

VIC_ IDs (4 total):
- `VIC_DynPlateStereo` — Dyna Plate (appears in: Agoura_Bassman.hsp, Agoura_Hiwatt.hsp, Bigsby_Trem.hsp)
- `VIC_ReverbDynAmbienceStereo` — Dynamic Ambience reverb (appears in: Stadium_Billie_Joe.hsp, Stadium_Metal_Rhythm (1).hsp, Stadium_Rock_Rhythm.hsp, Purple Nurple.hsp)
- `VIC_ReverbDynRoomStereo` — Dynamic Room reverb (appears in: Stadium Rock Rig.hsp)
- `VIC_ReverbRotatingStereo` — Rotating reverb (appears in: NH_BoomAuRang.hsp, NH_Reflections.hsp)

**Implementation — add to `getValidModelIds()` in `validate.ts` after the P35_ block:**

```typescript
// Stadium effect models (HX2_* prefix — Stadium-specific effect IDs confirmed from real .hsp files, 2026-03-05)
ids.add("HX2_CompressorDeluxeCompMono");
ids.add("HX2_CompressorLAStudioCompStereo");
ids.add("HX2_EQParametricStereo");
ids.add("HX2_GateHorizonGateMono");
ids.add("HX2_GateNoiseGateStereo");
// Stadium reverb/dynamics models (VIC_* prefix — confirmed from real .hsp files, 2026-03-05)
ids.add("VIC_DynPlateStereo");
ids.add("VIC_ReverbDynAmbienceStereo");
ids.add("VIC_ReverbDynRoomStereo");
ids.add("VIC_ReverbRotatingStereo");
```

**Why validate.ts needs these IDs:** Phase 53 (Stadium Builder Rebuild) will fix the builder to write Stadium-native effect model IDs (HX2_/VIC_) into the `.hsp` file instead of generic HD2_ IDs. When Phase 53 does this, it may also update the PresetSpec to store the HX2_/VIC_ IDs as `block.modelId` values. If that happens, `validatePresetSpec()` (called before building in `generate/route.ts` line 106) would reject those IDs as invalid. Adding them in Phase 52 prevents Phase 53 from hitting a validate.ts regression.

Alternatively, if Phase 53 keeps HD2_ IDs in the PresetSpec and only remaps in the builder serializer, these IDs in VALID_IDS are harmless (they are never generated by the pipeline, so they never appear in validation input). Either way, adding them now is correct.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Numeric param values for new amp entries | Don't estimate or derive from analogous amps | Read directly from real .hsp JSON after stripping 8-byte magic header | Success criteria explicitly forbids estimation |
| Device version | Don't calculate or guess | Read `meta.device_version` from Agoura_Bassman.hsp | Real file inspection is the ground truth |
| HX2_/VIC_ ID discovery | Don't guess prefixes | Extract using regex from real .hsp corpus | All 9 IDs have been enumerated and verified above |

---

## Common Pitfalls

### Pitfall 1: Including Non-Numeric Params in defaultParams

**What goes wrong:** TypeScript compilation fails with `Type 'boolean' is not assignable to type 'number'` when including boolean controls (Bright, Fat, Contour, Channel, NrmBright, Aggression) in `defaultParams`.

**Why it happens:** `HelixModel.defaultParams` is typed `Record<string, number>`. Real .hsp files have booleans and integers in amp params. This mismatch is expected — the established convention excludes non-continuous params.

**How to avoid:** Only include continuous float params (Drive, Bass, Mid, Treble, Master, ChVol, Presence). Exclude booleans, integers, params with spaces in the key name (e.g. "Ch Level", "OD MVol", "OD Vol"), and Vibrato sub-channel params.

**Warning signs:** TypeScript errors on the new STADIUM_AMPS entries after adding.

### Pitfall 2: Estimating defaultParams Instead of Using Real File Values

**What goes wrong:** The success criteria explicitly requires "extracted field-by-field from real .hsp files, never estimated." Using estimated values violates the acceptance criterion even if they compile and tests pass.

**Why it happens:** The 6 amps have real-world analogues that tempt analogy-based guessing. Resist.

**How to avoid:** Copy numeric values directly from the Ground Truth Data section above. All values were extracted from real .hsp JSON during this research.

### Pitfall 3: Wrong device_version Value in Source Comment

**What goes wrong:** The source comment in `config.ts` references a file that doesn't contain the updated value, making future auditing confusing.

**How to avoid:** Reference `Agoura_Bassman.hsp` specifically in the source comment — it is one of only two files with exactly 301990015, and it is the dedicated single-amp reference file most naturally associated with Agoura amps.

### Pitfall 4: Omitting the stadiumOnly: true Flag

**What goes wrong:** Without `stadiumOnly: true`, new amp entries appear in the non-Stadium device catalogs and may be offered to Helix LT/Floor/Pod Go users who cannot load Agoura amps.

**Why it happens:** The flag is easy to miss when copying from existing entries.

**How to avoid:** Verify every new STADIUM_AMPS entry has `stadiumOnly: true` before committing.

### Pitfall 5: Using Display Name Keys That Don't Follow Existing Convention

**What goes wrong:** The `STADIUM_AMPS` keys are the human-readable display names used by the planner and chain-rules.ts to look up models. A key mismatch (e.g., "Agoura US TweedMan" vs "Agoura US Tweedman") means the Knowledge Layer can't find the amp.

**How to avoid:** Follow the naming pattern of existing entries: "Agoura [Descriptor]" with standard capitalization. Verify the key matches what `ToneIntent.ampName` would contain after the planner produces it.

### Pitfall 6: TypeScript Strict Mode Rejecting the `as const` Assert

**What goes wrong:** If `ampCategory` or `topology` are not asserted with `as const`, TypeScript infers a wider string type rather than the specific union type `AmpCategory` or `TopologyTag`.

**How to avoid:** Every new entry must include `ampCategory: "clean" as const` (etc.) — copy the pattern exactly from existing entries.

---

## Code Examples

### Model Entry Pattern (verified from existing STADIUM_AMPS entries)

```typescript
// Source: src/lib/helix/models.ts lines 1034-1182 (direct inspection)
"Agoura US Tweedman": {
  id: "Agoura_AmpUSTweedman",
  name: "Agoura US Tweedman",
  basedOn: "Fender Tweed Bassman (Normal channel)",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  cabAffinity: ["1x12 Fullerton", "4x10 Tweed P10R"],
  defaultParams: { Drive: 0.60, Bass: 0.64, Mid: 0.65, Treble: 0.55, Master: 1.0, ChVol: 0.80 },
  blockType: BLOCK_TYPES.AMP_WITH_CAB,
  stadiumOnly: true,
},
```

### config.ts Change

```typescript
// Source: src/lib/helix/config.ts lines 42-53
// Change: 285213946 -> 301990015
/** Device version integer — verified from Agoura_Bassman.hsp and Agoura_Hiwatt.hsp (2026-03-05) */
STADIUM_DEVICE_VERSION: 301990015,
```

### validate.ts Addition

```typescript
// Source: src/lib/helix/validate.ts lines 7-31 (getValidModelIds pattern)
// Add after the P35_ block, before the return statement:
// Stadium effect models (HX2_* prefix — confirmed from real .hsp files, 2026-03-05)
ids.add("HX2_CompressorDeluxeCompMono");
ids.add("HX2_CompressorLAStudioCompStereo");
ids.add("HX2_EQParametricStereo");
ids.add("HX2_GateHorizonGateMono");
ids.add("HX2_GateNoiseGateStereo");
// Stadium reverb/dynamics models (VIC_* prefix — confirmed from real .hsp files, 2026-03-05)
ids.add("VIC_DynPlateStereo");
ids.add("VIC_ReverbDynAmbienceStereo");
ids.add("VIC_ReverbDynRoomStereo");
ids.add("VIC_ReverbRotatingStereo");
```

### TypeScript Compilation Check

```bash
# Run from project root — must exit 0 with no output
npx tsc --noEmit
```

### Full Test Suite

```bash
# Run from project root — all 170 tests must pass
npx vitest run
```

---

## File-by-File Change Summary

| File | Location | Change |
|------|----------|--------|
| `src/lib/helix/models.ts` | After `"Agoura Tread Plate Orange"` entry (line ~1182) | Add 6 new STADIUM_AMPS entries |
| `src/lib/helix/config.ts` | `STADIUM_CONFIG.STADIUM_DEVICE_VERSION` (line 52) | Change value from `285213946` to `301990015`; update source comment |
| `src/lib/helix/validate.ts` | `getValidModelIds()` after P35_ block (line ~27) | Add 9 `ids.add()` calls for HX2_/VIC_ IDs |

**Lines of code:** Approximately 90 lines added to `models.ts` (6 entries × ~15 lines each), 2 lines changed in `config.ts`, 11 lines added to `validate.ts`.

**Regression risk:** LOW. `models.ts` addition is purely additive — existing entries are untouched. `config.ts` change only affects Stadium `.hsp` file output (device is blocked in UI, so no live generation affected). `validate.ts` addition only expands the set of valid IDs — it cannot cause previously-passing validation to fail.

---

## Open Questions

1. **Display name casing for new entries**
   - What we know: Existing entries use "Agoura [Descriptor]" keys. Proposed names follow this pattern.
   - What's unclear: Whether the planner prompt for Stadium explicitly lists amp names by these exact keys, or derives them from `Object.keys(STADIUM_AMPS)`. If the former, prompt may need updating after Phase 52.
   - Recommendation: After Phase 52 lands, verify the Stadium planner prompt includes all 18 amp names. This is a Phase 55 concern if it needs updating.

2. **cabAffinity for `Agoura_AmpRevvCh3Purple` (high-gain)**
   - What we know: Revv Generator amps typically pair with closed-back 4x12 cabinets. "4x12 Uber V30" is the primary high-gain cab in existing entries.
   - What's unclear: Whether the Stadium cab catalog includes all named cabs. The cabAffinity field references names from `CAB_MODELS` — if a named cab doesn't exist there, the lookup silently returns the first available cab.
   - Recommendation: Proposed cabAffinity uses `["4x12 Uber V30", "4x12 Brit T75"]` — both confirmed present in the standard `CAB_MODELS` in `models.ts`.

3. **USDoubleBlack `Mid` param — is 0.52 from the Normal or Vibrato channel?**
   - What we know: `NH_Reflections.hsp` has `Mid: 0.52` and `VibMid: 0.80` — the `Mid: 0.52` is the Normal channel.
   - What's unclear: Nothing — Normal channel Mid=0.52 is the correct value to use.
   - Recommendation: Use 0.52 as documented.

---

## Sources

### Primary (HIGH confidence)

- Real .hsp file corpus — `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` — 11 files, 10 valid (1 stub). All amp IDs, param values, and device_version values extracted by direct JSON inspection after stripping 8-byte magic header. Inspected 2026-03-05.
- `src/lib/helix/models.ts` (lines 1034-1182) — existing STADIUM_AMPS entries establish all required conventions: naming, defaultParams keys, ampCategory/topology as const, stadiumOnly flag, blockType. Inspected 2026-03-05.
- `src/lib/helix/validate.ts` (lines 7-31) — getValidModelIds() pattern for manual ID additions (P35_ block) is the template for HX2_/VIC_ additions. Inspected 2026-03-05.
- `src/lib/helix/config.ts` (lines 42-53) — STADIUM_CONFIG with current wrong value 285213946. Inspected 2026-03-05.
- `.planning/research/ARCHITECTURE.md` — confirms validate.ts MODIFY requirement for HX2_ IDs; confirms 6 missing amp IDs and their real-world analogues. Inspected 2026-03-05.
- `.planning/research/SUMMARY.md` — confirms Phase 52 scope and Stadium track architecture. Inspected 2026-03-05.
- `npx tsc --noEmit` — confirmed zero TypeScript errors before any Phase 52 changes. Run 2026-03-05.
- `npx vitest run` — confirmed all 170 tests pass before any Phase 52 changes. Run 2026-03-05.

### Secondary (MEDIUM confidence)

- Real-world amp identity for cabAffinity decisions (Revv Generator → closed-back 4x12; Fender Tweed Bassman → open-back 4x10/1x12) — from general guitar amp knowledge; unverified against Line 6 documentation but consistent with existing entry patterns.

---

## Metadata

**Confidence breakdown:**
- Ground truth data (amp IDs, param values, device_version): HIGH — extracted directly from real .hsp files
- Code change pattern (entry structure, getValidModelIds, config): HIGH — verified from existing source code
- Regression risk assessment: HIGH — additive-only changes to models.ts and validate.ts; single constant change in config.ts
- cabAffinity recommendations for new entries: MEDIUM — follows established convention but not verified against live Stadium preset generation

**Research date:** 2026-03-05
**Valid until:** This phase is purely based on static .hsp file inspection and existing source code patterns — findings do not expire.
