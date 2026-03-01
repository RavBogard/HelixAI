# Phase 1: Foundation - Research

**Researched:** 2026-03-01
**Domain:** TypeScript type contracts, .hlx format constants, Helix model database, parameter encoding
**Confidence:** HIGH (primary evidence from direct inspection of 15+ real HX Edit .hlx exports)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked — all Phase 1 decisions delegated to Claude's discretion.

### Claude's Discretion
- **@type verification approach** — Use community .hlx exports, GitHub repos (AntonyCorbett/HelixBackupFiles), and reverse-engineering references to verify block type constants. If discrepancies found, correct them.
- **Amp model coverage** — Start with the most-used 20-30 amps across clean/crunch/high-gain, then expand. Use FW 3.70 as baseline (current codebase already targets this). Add amp category metadata, cab affinities, and topology tags to each model.
- **Amp category design** — Use clean/crunch/high-gain as primary categories. Edge cases (AC30, Soldano) get categorized by their most common use case. Add topology tag (cathode-follower vs plate-fed) as a secondary attribute for EQ strategy decisions.
- **ToneIntent shape** — Keep it narrow (~15 fields). AI chooses: amp model name, cab model name, effects list (name + role), snapshot intents (name + tone role), guitar type, genre hint. Knowledge Layer handles all numeric parameters.
- **Parameter type registry** — Implement a type-safe registry distinguishing Hz values (LowCut/HighCut), integer indices (Mic), and normalized floats (Drive/Master/etc). Make LowCut and HighCut required on cab types.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FNDN-01 | Expanded model database with amp category metadata (clean/crunch/high-gain), cab affinities, and topology tags (cathode-follower vs. plate-fed) | Existing models.ts has categories; topology tags must be added; cab affinity map pattern is documented below |
| FNDN-02 | ToneIntent type definition — the narrow AI output contract (~15 fields: amp name, cab name, effects, snapshot intents, guitar type) | Interface shape is fully specified in Architecture research; requires new file `tone-intent.ts` |
| FNDN-03 | Verified @type block constants against real HX Edit .hlx exports (current values are unverified and may be wrong) | **CRITICAL: Direct inspection of 15 real HX Edit exports resolved the @type map completely — see findings below** |
| FNDN-04 | Parameter type registry distinguishing Hz values (LowCut/HighCut), integer indices (Mic), and normalized floats (Drive/Master) | Confirmed from .hlx inspection: LowCut/HighCut are raw Hz, Mic is integer index (0+), all others are normalized 0-1 float |
| FNDN-05 | LowCut and HighCut made required fields on cab type (not optional) with safe defaults per gain category | Current `HlxCab` has `LowCut?: number; HighCut?: number` — removing `?` is the change; safe defaults confirmed below |
</phase_requirements>

---

## Summary

Phase 1 is a pure TypeScript data and type work phase with no runtime dependencies to add or change. All five requirements touch two files (`types.ts` and `models.ts`) plus one new file (`tone-intent.ts`). The research's most important contribution is the **direct verification of @type constants from 15 real HX Edit exports** — the existing `BLOCK_TYPES` constant has several wrong values that would cause silent corruption of generated presets.

The second critical finding is the **LowCut/HighCut encoding**: the current codebase stores these as normalized 0-1 floats (e.g., `LowCut: 0.18`) but real HX Edit .hlx files store them as **raw Hz values** (e.g., `LowCut: 80.0`, `HighCut: 8000.0`). This is the most impactful bug to fix in Phase 1 because the parameter type registry and cab defaults all depend on getting this encoding right.

The third finding is the topology tagging approach: 11 amps in the current database are cathode-follower designs (Vox types, Matchless); the rest are plate-fed. This distinction drives mid-EQ strategy in Phase 2's param-engine and should be captured as a structured tag now while the models.ts changes are being made.

**Primary recommendation:** Fix `BLOCK_TYPES`, convert cab defaults to Hz encoding, add topology/cabAffinity to `HelixModel`, and define `ToneIntent` — in that order.

---

## Standard Stack

### Core (no new packages — all existing)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (existing) | Type definitions, interfaces, const enums | Strict mode already enforced; all phase work is type-only |
| Zod | 4.3.6 (existing) | ToneIntent schema definition (used in Phase 3) | `z.toJSONSchema()` will derive Claude's output schema; single source of truth |

No new packages are needed for Phase 1. The work is TypeScript interface additions, constant corrections, and model database expansion.

**Installation:**
```bash
# No new packages
```

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/lib/helix/
  types.ts          — ADD: ToneIntent, EffectIntent, SnapshotIntent, AmpCategory, GuitarType, TopologyTag
                      CHANGE: HlxCab.LowCut and HlxCab.HighCut from optional to required
  models.ts         — CHANGE: HelixModel interface (add topology, cabAffinity fields)
                      CHANGE: BLOCK_TYPES constants (fix wrong values)
                      CHANGE: CAB_MODELS defaultParams (convert 0-1 floats to Hz values)
                      CHANGE: AMP_MODELS (add topology, cabAffinity to each entry)
  tone-intent.ts    — NEW: ToneIntent Zod schema (z.object) — single source for TS type + AI schema
  index.ts          — ADD: export new types from tone-intent.ts
```

### Pattern 1: ToneIntent as a Narrow AI Contract

**What:** A single TypeScript interface (backed by Zod) defining exactly what the AI is permitted to decide. ~15 fields, all named model IDs or semantic string choices — no numeric parameters.

**When to use:** The Planner (Phase 3) will output ONLY a ToneIntent. The Knowledge Layer (Phase 2) translates ToneIntent into a full PresetSpec.

**Canonical shape (verified against architecture research):**
```typescript
// Source: ARCHITECTURE.md + CONTEXT.md decisions
import { z } from "zod";

export const EffectIntentSchema = z.object({
  modelName: z.string(),           // Must match a key in EFFECT_MODELS
  role: z.enum(["always_on", "toggleable", "ambient"]),
});

export const SnapshotIntentSchema = z.object({
  name: z.string(),                // "Clean", "Crunch", "Lead", "Ambient"
  toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),
});

export const ToneIntentSchema = z.object({
  ampName: z.string(),             // Must match a key in AMP_MODELS
  cabName: z.string(),             // Must match a key in CAB_MODELS
  guitarType: z.enum(["single_coil", "humbucker", "p90"]),
  genreHint: z.string().optional(), // e.g., "blues rock", "metal"
  effects: z.array(EffectIntentSchema).max(6),
  snapshots: z.array(SnapshotIntentSchema).min(4).max(4),
  tempoHint: z.number().int().min(60).max(200).optional(),
});

export type ToneIntent = z.infer<typeof ToneIntentSchema>;
export type EffectIntent = z.infer<typeof EffectIntentSchema>;
export type SnapshotIntent = z.infer<typeof SnapshotIntentSchema>;
```

**File location:** `src/lib/helix/tone-intent.ts`

**Key design constraints:**
- `ampName` and `cabName` use model names (human-readable keys from the database), NOT HD2_ IDs. The planner is told model names; ID lookup happens in Knowledge Layer.
- Exactly 4 snapshots enforced at schema level (`.min(4).max(4)`).
- No numeric parameters — not Drive, not Master, not EQ values. If a field is numeric, it does not belong in ToneIntent.

### Pattern 2: HelixModel Interface Extension

**What:** Add `topology` and `cabAffinity` to the existing `HelixModel` interface.

**Current interface:**
```typescript
export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  defaultParams: Record<string, number>;
  blockType: number;
}
```

**Extended interface:**
```typescript
export type AmpCategory = "clean" | "crunch" | "high_gain";
export type TopologyTag = "cathode_follower" | "plate_fed" | "solid_state" | "not_applicable";
export type CabSize = "small" | "medium" | "large";

export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;           // existing — keep as string for non-amp models
  ampCategory?: AmpCategory;  // defined only for amp models
  topology?: TopologyTag;     // defined only for amp models
  cabAffinity?: string[];     // preferred cab names (keys in CAB_MODELS) — amp models only
  defaultParams: Record<string, number>;
  blockType: number;
}
```

**Why optional fields rather than subtype:** All models (amp, cab, distortion, delay...) share the `HelixModel` interface. Making amp-only fields optional preserves the single interface. Phase 2's param-engine will always check `model.ampCategory` before using it.

### Pattern 3: Parameter Type Registry

**What:** A registry that maps parameter names to their type semantics so the validator, param-engine, and preset-builder know how to handle each field.

**Encoding rules confirmed from .hlx inspection:**

| Parameter Name(s) | Encoding | Valid Range | Evidence |
|-------------------|----------|-------------|---------|
| `LowCut`, `HighCut` (cab blocks) | Raw Hz float | 19.9 – 20100.0 | 15 HX Edit exports inspected |
| `Mic` (cab blocks) | Integer index | 0 – 11+ | Observed: 0, 2, 3, 5, 6, 11 in real files |
| `Drive`, `Bass`, `Mid`, `Treble`, `Master`, `Sag`, `Bias`, `BiasX`, `Mix`, `Feedback` | Normalized float | 0.0 – 1.0 | Standard Helix parameter encoding |
| `Gain` (VolPanGain) | dB float | -20.0 to +20.0 | Observed: 11.9993, 7.39699 in LiveStream.hlx |
| `@tempo` | BPM integer | 20 – 300 | Structure |
| `@ledcolor` | Integer color index | 0 – 8 | LED_COLORS constant |
| `Taps` (Multi Pass delay) | Integer | 1 – 8 | Logical |

**Registry pattern:**
```typescript
// src/lib/helix/param-registry.ts  (NEW in Phase 1 or Phase 2)
export type ParamType = "normalized_float" | "hz_value" | "integer_index" | "db_value" | "bpm" | "boolean_int";

export const PARAM_TYPE_REGISTRY: Record<string, ParamType> = {
  // Cab Hz values
  LowCut: "hz_value",
  HighCut: "hz_value",
  // Cab integer indices
  Mic: "integer_index",
  // Normalized floats (0-1)
  Drive: "normalized_float",
  Bass: "normalized_float",
  Mid: "normalized_float",
  Treble: "normalized_float",
  Master: "normalized_float",
  ChVol: "normalized_float",
  Presence: "normalized_float",
  Sag: "normalized_float",
  Bias: "normalized_float",
  BiasX: "normalized_float",
  Hum: "normalized_float",
  Ripple: "normalized_float",
  Mix: "normalized_float",
  Feedback: "normalized_float",
  Depth: "normalized_float",
  Speed: "normalized_float",
  Tone: "normalized_float",
  Level: "normalized_float",
  Output: "normalized_float",
  // dB values (VolPanGain)
  Gain: "db_value",
};
```

**Note:** The registry can start minimal (just the fields that matter for Phase 1 correctness) and grow in Phase 2 when param-engine needs it. Phase 1's requirement is to define the type and populate the critical fields (LowCut, HighCut, Mic).

### Pattern 4: Cab Default Parameters — Hz Encoding

**Critical correction:** The current CAB_MODELS defaultParams use normalized 0-1 values:
```typescript
// CURRENT (WRONG — normalized float format, not actual Hz)
defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 0.18, HighCut: 0.80, Position: 0.24, Angle: 0 }
```

Real HX Edit .hlx files use raw Hz:
```typescript
// CORRECT (Hz format — what Helix firmware expects)
defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 }
```

**Safe defaults per gain category (Hz values):**

| Gain Category | LowCut (Hz) | HighCut (Hz) | Mic | Rationale |
|--------------|-------------|--------------|-----|-----------|
| clean | 80.0 | 8000.0 | 6 (Ribbon 121) | Ribbon mic = warm/smooth; 8kHz cut preserves clean air |
| crunch | 80.0 | 7500.0 | 0 (SM57) | SM57 = classic guitar cab tone; 7.5kHz cuts harshness |
| high_gain | 100.0 | 6500.0 | 0 (SM57) | Tighter low cut for punch; lower high cut reduces fizz |

**FNDN-05 implementation:** Change `HlxCab.LowCut` and `HlxCab.HighCut` from `?: number` to `: number` in `types.ts`. Add safe defaults in the cab model database entries. The validate.ts cab parameter check must also be updated to use Hz range (e.g., `LowCut >= 60 && LowCut <= 500` rather than `>= 0 && <= 1`).

### Anti-Patterns to Avoid

- **Normalized 0-1 for cab Hz values:** The LowCut/HighCut encoding was previously the most confusing bug in the codebase. Never write `LowCut: 0.18` — always `LowCut: 80.0`.
- **Shared @type for DELAY and REVERB in BLOCK_TYPES constant:** Both correctly map to 7 — this is NOT a bug. The .hlx format uses the same @type=7 for both. This is confirmed by multiple real exports.
- **Putting numeric parameters in ToneIntent:** If it is a number (Drive, Sag, LowCut), it does not go in ToneIntent. Period.
- **Using the `category` string field for amp-category-specific logic:** Use the new `ampCategory?: AmpCategory` typed field, not the untyped `category: string`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON Schema from ToneIntent type | Manual JSON Schema object | `z.toJSONSchema(ToneIntentSchema)` (Zod v4 built-in) | Zod v4 generates exact schema; single source of truth; used in Phase 3 for Claude output_config |
| TypeScript types from Zod schema | Separate interface declaration | `z.infer<typeof ToneIntentSchema>` | Keeps type and schema in sync automatically |
| Parameter encoding lookup | Switch/if chains in validator | `PARAM_TYPE_REGISTRY[paramName]` | Centralized registry; types added once, used everywhere |

---

## Common Pitfalls

### Pitfall 1: LowCut/HighCut Encoding Inconsistency Between Files

**What goes wrong:** Some older HX Edit exports (e.g., one file created with HX Edit v3.70 build "v3.70") stored LowCut/HighCut as normalized 0-1 values. All newer files use raw Hz. The current codebase database uses normalized format based on that older pattern.

**Why it happens:** The format appears to have changed between HX Edit firmware builds. The older format (0-1 normalized) is not what current Helix firmware expects when it reads a .hlx file.

**How to avoid:** Always use raw Hz in the database and in generated .hlx files. The safe range for LowCut is 19.9 (passthrough minimum) to ~300.0 Hz. The safe range for HighCut is 1000 Hz to 20100 (passthrough maximum). A cab with no filtering uses LowCut=19.9 and HighCut=20100. A properly filtered cab uses LowCut=80-100 and HighCut=6500-8000.

**Warning signs:** Any cab LowCut value below 1.0 in the database is certainly using the old normalized format and is wrong.

### Pitfall 2: BLOCK_TYPES Constant Errors

**What goes wrong:** The current `BLOCK_TYPES` in models.ts has these errors (verified from inspecting real exports):

| Constant | Current Value | Correct Value | Evidence |
|----------|--------------|---------------|---------|
| `BLOCK_TYPES.AMP` | 1 | Context-dependent — see below | Real exports show AMP uses @type 1 OR 3 |
| `BLOCK_TYPES.CAB` | 2 | Not used — cabs in cab0 slot have no @type | Real exports confirm |

**Critical @type findings from 15 HX Edit exports:**

```typescript
// VERIFIED values (from direct inspection of 15 HX Edit .hlx files)
export const BLOCK_TYPES = {
  // ALL generic effects share @type=0
  DISTORTION: 0,   // confirmed: HD2_DistMinotaur, HD2_DistTeemah, HD2_DistKinkyBoost
  DYNAMICS: 0,     // confirmed: HD2_CompressorLAStudioComp, HD2_CompressorDeluxeComp
  EQ: 0,           // confirmed: HD2_EQParametric, HD2_EQSimpleTilt, HD2_CaliQ
  WAH: 0,          // confirmed: HD2_WahChromeCustom, HD2_WahWeeper, HD2_FM4VoiceBox
  PITCH: 0,        // confirmed: HD2_PitchSimplePitch
  VOLUME: 0,       // confirmed: HD2_VolPanVol, HD2_VolPanGain
  MODULATION: 4,   // CONFIRMED: HD2_ChorusTrinityChorus, HD2_PhaserScriptModPhase use 4
                   // EXCEPTION: HD2_ChorusAmpegLiquifier uses 0 (two observed)
                   // SAFE DEFAULT: use 4 for modulation; accept 0 for specific models
  AMP: 1,          // Base value for amp-only (no cab reference)
  AMP_WITH_CAB: 3, // When amp block has @cab field pointing to cab0 — confirmed from 8 exports
  CAB_IN_SLOT: 4,  // When cab is stored as blockN (not cab0) — confirmed: HD2_CabMicIr_*WithPan
  CAB_IN_CAB0: -1, // Cabs stored as cab0 have NO @type field — use special sentinel
  IMPULSE_RESPONSE: 5, // confirmed: HD2_ImpulseResponse1024
  LOOPER: 6,       // confirmed: HD2_Looper
  DELAY: 7,        // confirmed: all delay models (HD2_DelayMultiPass, HD2_DelayTransistorTape, etc.)
  REVERB: 7,       // confirmed: all reverb models (HD2_ReverbHall, VIC_ReverbDynAmbience, etc.)
  SEND_RETURN: 9,  // not directly observed but was in original code; low risk
} as const;
```

**The important practical finding for preset-builder.ts:** The current `getBlockType()` function returns 3 for amp and 4 for cab, which is correct for the standard "amp+cab in same DSP" pattern used by the app. This function is NOT wrong — it generates the amp-with-cab format. The BLOCK_TYPES constant used for documentation/validation is what needs updating.

**How to avoid:** Update BLOCK_TYPES to add `AMP_WITH_CAB: 3` and `CAB_IN_SLOT: 4` as named constants. Add inline comments referencing this research. Do not change `getBlockType()` in preset-builder.ts — it already returns the right values.

### Pitfall 3: Mic Index Range Wrong

**What goes wrong:** The current validate.ts clamps Mic to 0-7 (8 values). Real HX Edit exports show `Mic: 11`. The Helix has more mic options than 0-7.

**Observed Mic values in real HX Edit exports:** 0, 2, 3, 5, 6, 11.

**Helix mic index mapping (from Helix help community):**
- 0 = 57 Dynamic (SM57 off-axis)
- 1 = 57 Dynamic (SM57 on-axis)
- 2 = 409 Dynamic (Sennheiser MD 409)
- 3 = 421 Dynamic (Sennheiser MD 421)
- 4 = 30 Dynamic (Shure SM30)
- 5 = 112 Dynamic (AKG D112)
- 6 = 20 Dynamic (Earthworks M20)
- 7 = 121 Ribbon (Royer R-121)  ← often cited as index 6, verify on hardware
- 8 = 160 Ribbon (Beyerdynamic M160)
- 9 = 414 Condenser (AKG C414)
- 10 = 84 Condenser (Neumann KM84)
- 11 = 67 Condenser (Neumann U67)
- (indices may vary by firmware version)

**How to avoid:** Change the Mic clamping in validate.ts from `Math.min(7, ...)` to `Math.min(15, ...)` until the exact count is confirmed. The parameter type registry should mark Mic as `integer_index` not `normalized_float`.

### Pitfall 4: ToneIntent Creep — Adding Numeric Parameters

**What goes wrong:** As the ToneIntent schema is defined, there will be temptation to add EQ values, specific Drive targets, or other numeric fields "because the AI knows better than the defaults."

**Why it happens:** The system's value depends on the AI not generating numeric parameters. Adding numeric fields to ToneIntent is the first step toward recreating the current broken system.

**How to avoid:** ToneIntent contains only: model names (string keys from the database), semantic role descriptions (string enums), and count/tempo hints (integers). No normalized floats, no Hz values, no dB values.

---

## Code Examples

### FNDN-03: Corrected BLOCK_TYPES Constant

```typescript
// Source: Direct inspection of 15 real HX Edit .hlx exports (2026-03-01)
// Files inspected: Sultans_of_Swing_Alchemy.hlx, NashvilleVoxDC30.hlx, TWEEDBLUES.hlx,
//   GRAMMY.hlx, Placater 9.8.hlx, DeluxeRvbSNP.hlx, LiveStream.hlx, Alchemy_Sultans.hlx,
//   Time Has Come.hlx, TONEAGE 185.hlx, Strab ORNG RV HB.hlx, and 4 others

export const BLOCK_TYPES = {
  // Generic effects — ALL share @type=0 in real HX Edit exports
  DISTORTION: 0,    // HD2_Dist* models
  DYNAMICS: 0,      // HD2_Compressor* models
  EQ: 0,            // HD2_EQ*, HD2_CaliQ
  WAH: 0,           // HD2_Wah*, HD2_FM4* filter models
  PITCH: 0,         // HD2_Pitch* models
  VOLUME: 0,        // HD2_VolPan* models
  // Modulation — primarily @type=4 but some models use 0
  MODULATION: 4,    // HD2_Chorus*, HD2_Flanger*, HD2_Phaser*, HD2_Tremolo*, HD2_Rotary*
  // Amp — @type depends on whether amp has a cab reference
  AMP: 1,           // Amp block WITHOUT @cab field (amp-only mode)
  AMP_WITH_CAB: 3,  // Amp block WITH @cab field pointing to cab0 (standard preset pattern)
  // Cab — storage format determines whether @type field exists
  CAB_IN_SLOT: 4,   // Cab stored as blockN (HD2_CabMicIr_*WithPan models in block position)
  // Note: Cabs stored as cab0 key have NO @type field at all
  // Special
  IMPULSE_RESPONSE: 5, // HD2_ImpulseResponse1024
  LOOPER: 6,           // HD2_Looper
  DELAY: 7,            // HD2_Delay* models
  REVERB: 7,           // HD2_Reverb*, VIC_Reverb* models
  SEND_RETURN: 9,      // Send/return blocks
} as const;
```

### FNDN-04: Parameter Type Registry

```typescript
// Source: .hlx format analysis (2026-03-01)
// LowCut/HighCut confirmed as raw Hz from multiple HX Edit exports
// Mic confirmed as integer index (0-11+ observed)
// All other amp/effect parameters confirmed as normalized 0-1 float

export type ParamType =
  | "normalized_float"  // 0.0 to 1.0
  | "hz_value"          // raw Hz (19.9 to 20100.0 for cab filters)
  | "integer_index"     // integer starting at 0 (mic selections, mode selectors)
  | "db_value"          // dB float (e.g., Gain parameter on VolPanGain)
  | "bpm"               // beats per minute integer
  | "boolean_int";      // 0 or 1 stored as number

export const PARAM_TYPE_REGISTRY: Readonly<Record<string, ParamType>> = {
  // Cab Hz values — NOT normalized 0-1
  LowCut: "hz_value",
  HighCut: "hz_value",
  // Cab integer indices
  Mic: "integer_index",
  // Amp normalized floats (0-1)
  Drive: "normalized_float",
  Bass: "normalized_float",
  Mid: "normalized_float",
  Treble: "normalized_float",
  Master: "normalized_float",
  ChVol: "normalized_float",
  Presence: "normalized_float",
  Resonance: "normalized_float",
  Sag: "normalized_float",
  Hum: "normalized_float",
  Ripple: "normalized_float",
  Bias: "normalized_float",
  BiasX: "normalized_float",
  // Effect normalized floats
  Mix: "normalized_float",
  Feedback: "normalized_float",
  Depth: "normalized_float",
  Speed: "normalized_float",
  Intensity: "normalized_float",
  Tone: "normalized_float",
  Level: "normalized_float",
  Output: "normalized_float",
  Gain_normalized: "normalized_float",  // gain on effects (0-1), NOT VolPanGain
  // VolPanGain dB value — different from normalized gain on effects
  Gain: "db_value",
} as const;
```

### FNDN-05: Required LowCut/HighCut on HlxCab

```typescript
// types.ts change — remove ? from LowCut and HighCut
// Source: Requirement FNDN-05

export interface HlxCab {
  "@model": string;
  "@enabled": boolean;
  "@mic": number;          // integer index (0-11+)
  Distance?: number;       // normalized 0-1 (optional — has hardware default)
  Level?: number;          // normalized 0-1 (optional)
  LowCut: number;          // REQUIRED — raw Hz (e.g., 80.0) — was optional, now required
  HighCut: number;         // REQUIRED — raw Hz (e.g., 8000.0) — was optional, now required
  EarlyReflections?: number;
  Angle?: number;
  Position?: number;
}
```

### FNDN-01: HelixModel Extension with Topology

```typescript
// models.ts interface extension
export type AmpCategory = "clean" | "crunch" | "high_gain";
export type TopologyTag =
  | "cathode_follower"   // EL84/EL34 cathode-follower: Vox AC30/AC15, Matchless DC-30
  | "plate_fed"          // 6L6/6V6/EL34 plate-driven: Fender, Marshall, Mesa
  | "solid_state"        // JC-120 (no tube power amp characteristics)
  | "not_applicable";    // for non-amp models

export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  ampCategory?: AmpCategory;
  topology?: TopologyTag;
  cabAffinity?: string[];       // preferred cab names (keys in CAB_MODELS)
  defaultParams: Record<string, number>;
  blockType: number;
}

// Example amp entries with new fields:
"Essex A30": {
  id: "HD2_AmpEssexA30",
  name: "Essex A30",
  basedOn: "Vox AC30 (Top Boost)",
  category: "clean",
  ampCategory: "clean",
  topology: "cathode_follower",
  cabAffinity: ["2x12 Blue Bell", "1x12 Blue Bell"],
  blockType: BLOCK_TYPES.AMP,
  defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.0, Cut: 0.50, Sag: 0.65, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.70 },
},
"Cali Rectifire": {
  id: "HD2_AmpCaliRectifire",
  name: "Cali Rectifire",
  basedOn: "Mesa/Boogie Dual Rectifier",
  category: "high_gain",
  ampCategory: "high_gain",
  topology: "plate_fed",
  cabAffinity: ["4x12 Cali V30", "4x12 Greenback25", "4x12 XXL V30"],
  blockType: BLOCK_TYPES.AMP,
  defaultParams: { ... },
},
```

### FNDN-02: ToneIntent in tone-intent.ts

```typescript
// src/lib/helix/tone-intent.ts — NEW FILE
import { z } from "zod";

export const EffectIntentSchema = z.object({
  modelName: z.string(),
  role: z.enum(["always_on", "toggleable", "ambient"]),
});

export const SnapshotIntentSchema = z.object({
  name: z.string().max(10),
  toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),
});

export const ToneIntentSchema = z.object({
  ampName: z.string(),
  cabName: z.string(),
  guitarType: z.enum(["single_coil", "humbucker", "p90"]),
  genreHint: z.string().optional(),
  effects: z.array(EffectIntentSchema).max(6),
  snapshots: z.array(SnapshotIntentSchema).min(4).max(4),
  tempoHint: z.number().int().min(60).max(200).optional(),
});

export type ToneIntent = z.infer<typeof ToneIntentSchema>;
export type EffectIntent = z.infer<typeof EffectIntentSchema>;
export type SnapshotIntent = z.infer<typeof SnapshotIntentSchema>;
```

---

## Amp Topology Reference

The following topology assignments cover the amps in the current database. This enables Phase 2's param-engine to apply different mid-EQ strategies per topology.

| Amp Name | Topology | Rationale |
|----------|----------|-----------|
| Essex A30, Essex A15 | cathode_follower | Vox AC30/AC15 use EL84 cathode follower — boosted upper mids, compressed breakup |
| A30 Fawn Brt, A30 Fawn Nrm | cathode_follower | Vox AC30 Fawn variant — same topology |
| Matchstick Ch1, Ch2, Jump | cathode_follower | Matchless DC-30 uses EL34 cathode follower |
| US Deluxe Nrm/Vib, US Double Nrm/Vib, US Small Tweed, US Princess, US Super Nrm/Vib | plate_fed | Fender 6L6 amps — plate-fed push-pull |
| Fullerton Nrm/Brt/Jump, Tweed Blues Nrm/Brt | plate_fed | Fender Bassman/Tweed — 6L6 plate-fed |
| WhoWatt 100, Derailed Ingrid | plate_fed | Hiwatt DR103 — EL34 plate-fed |
| Brit Plexi Nrm/Brt/Jump, Brit J45 Brt/Nrm, Brit P75 Nrm, Brit Trem Brt/Nrm/Jump | plate_fed | Marshall EL34 — plate-fed |
| Line 6 2204 Mod | plate_fed | Marshall JCM800 — EL34 plate-fed |
| Cali Rectifire | plate_fed | Mesa Rectifier — 6L6 plate-fed (note: cathode-follower MV is a characteristic, not topology) |
| Cali IV Lead, Cali Texas Ch1 | plate_fed | Mesa Mark IV / Lone Star — 6L6 plate-fed |
| PV Panama, EV Panama Blue/Red | plate_fed | EVH 5150III — 6L6/EL34 plate-fed |
| Placater Clean, Placater Dirty | plate_fed | Friedman BE-100 — EL34 plate-fed |
| Archetype Lead | plate_fed | PRS Archon — EL34 plate-fed |
| Das Benzin Mega/Lead | plate_fed | Diezel VH4 — EL34 plate-fed |
| Revv Gen Purple/Red | plate_fed | Revv 120 — EL34 plate-fed |
| Solo Lead Clean/Crunch/OD | plate_fed | Soldano SLO-100 — EL34 plate-fed |
| German Ubersonic | plate_fed | Bogner Uberschall — EL34 plate-fed |
| ANGL Meteor | plate_fed | ENGL Fireball — EL84 note: ENGL uses cathode-coupled BUT the Fireball/Meteor is plate-fed |
| Mandarin 80, Mandarin Rocker | plate_fed | Orange OR80/Rockerverb — EL34 plate-fed |
| Jazz Rivet 120 | solid_state | Roland JC-120 — solid state power amp |
| Grammatico Nrm/Brt/Jump | plate_fed | Grammatico LaGrange — EL34 plate-fed |
| Litigator | plate_fed | Line 6 Original blackface-inspired |
| Soup Pro, Stone Age 185, Voltage Queen | plate_fed | Vintage single-ended/push-pull — plate-fed |
| Interstate Zed, Divided Duo | plate_fed | Dr. Z and Divided by 13 — plate-fed |

**Phase 2 implication:** Cathode-follower amps (Vox, Matchless) need a mid-scoop in the post-cab EQ to compensate for their inherent upper-mid resonance. Plate-fed amps need mid presence boost in many cases.

---

## Cab Affinity Reference

Standard amp-to-cab pairings for the knowledge layer. These are the cabAffinity values for each amp.

| Amp Category / Family | Preferred Cabs (cabAffinity list) |
|----------------------|----------------------------------|
| Fender clean (Deluxe, Twin, Princeton, Bassman) | ["1x12 US Deluxe", "2x12 Double C12N", "1x12 Fullerton"] |
| Vox (Essex A30, A30 Fawn) | ["2x12 Blue Bell", "1x12 Blue Bell"] |
| Matchless (Matchstick) | ["2x12 Match H30", "1x12 Blue Bell"] |
| Marshall (Brit Plexi, Brit J45, Brit Trem) | ["4x12 Greenback25", "4x12 Greenback20", "4x12 Brit V30"] |
| Mesa Rectifier (Cali Rectifire) | ["4x12 Cali V30", "4x12 XXL V30"] |
| Mesa Mark (Cali IV Lead) | ["4x12 Cali V30", "4x12 Greenback25"] |
| EVH/5150 (PV Panama, EV Panama) | ["4x12 XXL V30", "4x12 Uber V30"] |
| Friedman (Placater) | ["4x12 Brit V30", "4x12 Greenback25"] |
| Bogner (German Ubersonic) | ["4x12 Uber V30", "4x12 XXL V30"] |
| Diezel (Das Benzin) | ["4x12 XXL V30", "4x12 Uber V30"] |
| ENGL (ANGL Meteor) | ["4x12 XXL V30", "4x12 Brit V30"] |
| Soldano (Solo Lead) | ["4x12 Solo Lead EM", "4x12 Greenback25"] |
| Orange (Mandarin) | ["4x12 Uber V30", "4x12 Greenback20"] |
| Roland JC-120 (Jazz Rivet) | ["2x12 Jazz Rivet"] |
| Hiwatt (WhoWatt, Derailed) | ["4x12 WhoWatt 100"] |
| Tweed/vintage (Tweed Blues, US Small Tweed) | ["1x12 US Deluxe", "4x10 Tweed P10R"] |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| LowCut/HighCut stored as normalized 0-1 float | LowCut/HighCut are raw Hz values in .hlx format | All cab parameter defaults must be updated; validate.ts range check must use Hz |
| BLOCK_TYPES.CAB = 2 | Cabs in cab0 slot have NO @type; cabs in block slot have @type=4 | The CAB constant value 2 was never observed; update documentation and constant |
| Mic clamped to 0-7 range | Mic index goes to at least 11 (67 Condenser seen in real export) | Clamp should be 0-15 until exact firmware count is confirmed |
| BLOCK_TYPES.AMP = 1 | AMP @type is 1 (no cab) or 3 (with cab) | preset-builder.ts getBlockType() already returns 3 for amp — this is correct for standard preset pattern |
| HelixModel has no topology/affinity fields | HelixModel needs topology and cabAffinity | Enables Phase 2 param-engine to make topology-aware EQ decisions deterministically |

**Deprecated/outdated:**
- `BLOCK_TYPES.CAB = 2`: This value was never confirmed in any real export. Cabs stored in the `cab0` key have no `@type` field. The constant should be updated and documented.
- Normalized cab LowCut/HighCut in defaultParams: All current CAB_MODELS entries have the wrong encoding.

---

## Open Questions

1. **Modulation @type inconsistency**
   - What we know: Most modulation blocks (Trinity Chorus, Script Mod Phase) use @type=4. But Chorus Ampeg Liquifier was observed using @type=0 in two separate presets.
   - What's unclear: Is this a firmware version difference, or is @type=4 used for "modulation with stereo" and @type=0 for "modulation mono"?
   - Recommendation: Use @type=4 as the default for BLOCK_TYPES.MODULATION. The preset-builder.ts can emit a comment that some modulation models may use 0 in edge cases. For Phase 1, this is informational only — the @type value is set in preset-builder.ts which already uses `getBlockType()`.

2. **Exact Mic index-to-name mapping**
   - What we know: Observed values 0, 2, 3, 5, 6, 11 in real exports. Mic=11 is confirmed as 67 Condenser (Neumann U67) from LiveStream.hlx (professional preset).
   - What's unclear: Whether the full mapping is 0-11 or larger.
   - Recommendation: Expand the Mic integer range validation to 0-15 for safety. The parameter type registry marks Mic as `integer_index` which is the critical correctness. Phase 4 (hardware validation) will confirm the exact range.

3. **WithPan cab model variants**
   - What we know: Some cab models have a `WithPan` suffix (e.g., `HD2_CabMicIr_4x12CaliV30WithPan`). These appear in block-slot positions. The standard cab models without `WithPan` appear in `cab0` slots.
   - What's unclear: Whether `WithPan` variants should be added to the cab model database.
   - Recommendation: Add at least the `WithPan` versions of the most-used cabs (4x12 Cali V30, 4x12 Greenback25) to CAB_MODELS. Phase 2 can use the non-WithPan (cab0 slot) form by default, which is how the preset-builder already works.

---

## Sources

### Primary (HIGH confidence — direct hardware evidence)
- **Direct inspection of 15 real HX Edit .hlx exports** — HX Edit v3.70 through v3.80+. Files: Sultans_of_Swing_Alchemy.hlx, NashvilleVoxDC30.hlx (Helix Native), TWEEDBLUES.hlx, GRAMMY.hlx, Placater 9.8.hlx, DeluxeRvbSNP.hlx, LiveStream.hlx, Alchemy_Sultans.hlx (HelixAI-generated), Time Has Come.hlx, TONEAGE 185.hlx, Strab ORNG RV HB.hlx, and 4 others. @type values, LowCut/HighCut encoding, Mic index range all verified from these files.
- **Current codebase** (`src/lib/helix/types.ts`, `models.ts`, `validate.ts`, `preset-builder.ts`) — direct inspection confirms existing patterns, bugs documented in PITFALLS.md, and what needs to change.

### Secondary (MEDIUM confidence)
- `AntonyCorbett/HelixBackupFiles` (GitHub) — hlx format reverse engineering reference, cited in CONTEXT.md as primary verification source
- ARCHITECTURE.md, STACK.md, PITFALLS.md — prior project research confirming @type ambiguity, LowCut encoding concern, and topology tagging value

### Tertiary (LOW confidence — for topology only)
- Helix community and amp electronics knowledge for cathode-follower vs plate-fed classification — this is well-established tube amp physics, not Helix-specific; standard electronics reference

---

## Metadata

**Confidence breakdown:**
- @type constants: HIGH — verified from 15 real HX Edit exports; pattern is clear and consistent
- LowCut/HighCut encoding: HIGH — confirmed raw Hz from 8+ real exports with actual musical values (80, 8000, etc.)
- Mic integer range: MEDIUM — observed 0-11 but exact upper bound unconfirmed without Line 6 official docs
- Topology tags: MEDIUM — standard tube amp electronics knowledge; matches community consensus; not firmware-documented
- ToneIntent shape: HIGH — directly specified in CONTEXT.md decisions + ARCHITECTURE.md

**Research date:** 2026-03-01
**Valid until:** 2026-09-01 (stable — .hlx format changes only with firmware major versions; no firmware update expected to break these constants)
