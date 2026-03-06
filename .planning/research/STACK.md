# Stack Research

**Domain:** HelixTones — Preset Quality Deep Dive (Expression Pedal, Per-Model Effect Intelligence, Effect Combination Logic, Per-Device Craft Optimization, Preset Quality Validation)
**Researched:** 2026-03-06
**Confidence:** HIGH — all findings derived from direct codebase inspection, binary format analysis from types.ts/preset-builder.ts comments, and pattern extrapolation from v4.0's validated AmpFamily + paramOverrides mechanism

---

## Scope

This file covers ONLY what is new for the expression pedal controller assignment, per-model effect intelligence, effect combination logic, per-device preset craft optimization, and preset quality validation milestone. It does NOT re-research the validated base stack:

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | ^5 |
| UI | Tailwind CSS | ^4 |
| AI (generation) | Claude Sonnet 4.6 via `@anthropic-ai/sdk` | ^0.78.0 |
| Schema validation | Zod | ^4.3.6 |
| Testing | Vitest | ^4.0.18 |
| Auth + DB + Storage | Supabase | ^2.98.0 |

---

## The Single Most Important Finding

**No new npm packages are needed for this milestone.**

All five feature areas are TypeScript data + logic changes in the existing Knowledge Layer:

1. **Expression pedal controller assignment** — extend `HlxControllerAssignment` type and `buildControllerSection()` in `preset-builder.ts` with new EXP_PEDAL_1/EXP_PEDAL_2 entries. The data structure is already defined (`@controller: 2` for EXP Pedal 2). No new npm packages.

2. **Per-model effect intelligence** — add optional `effectOverrides` and `compatibleWith` fields to `HelixModel` in `models.ts`. Parallel to the existing `paramOverrides` mechanism on amp models (Phase 56 / Layer 4). No new npm packages.

3. **Effect combination logic** — add a `COMBINATION_RULES` lookup table in `param-engine.ts` or a new `combination-rules.ts` module. Context flows from chain assembly into param resolution. No new npm packages.

4. **Per-device preset craft optimization** — extend the `DeviceCapabilities` interface in `device-family.ts` with craft-guidance fields. Already uses the `DeviceCapabilities` pattern — additive extension only. No new npm packages.

5. **Preset quality validation** — add new assertions to `validatePresetSpec()` in `validate.ts` and expand `model-defaults-validation.test.ts` with quality-gate tests. The Vitest test runner already handles this. No new npm packages.

---

## Feature Area 1: Expression Pedal Controller Assignment in .hlx / .pgp / .hsp

### What the File Format Requires

**From direct codebase inspection of `types.ts` lines 129-140:**

```typescript
// EXISTING — already typed but unused for EXP assignment
export interface HlxControllerAssignment {
  "@min": number;
  "@max": number;
  "@controller": number; // 19 = Snapshot, 2 = EXP Pedal 2, 18 = MIDI CC
  "@snapshot_disable"?: boolean;
  "@cc"?: number;
}

export const CONTROLLERS = {
  EXP_PEDAL_1: 1,   // already defined in models.ts line 53
  EXP_PEDAL_2: 2,   // already defined in models.ts line 54
  MIDI_CC: 18,
  SNAPSHOT: 19,
};
```

The controller section in .hlx is:
```json
{
  "controller": {
    "dsp0": {
      "block2": {
        "Mix": {
          "@min": 0.0,
          "@max": 1.0,
          "@controller": 2,
          "@snapshot_disable": false
        }
      }
    }
  }
}
```

`@controller: 2` = EXP Pedal 2 (wah/volume default). `@controller: 1` = EXP Pedal 1.
`@min` and `@max` define the parameter sweep range (both 0-1 normalized for standard effects; raw Hz for cab LowCut/HighCut).

**Critical: A single parameter cannot have BOTH `@controller: 19` (snapshot) AND `@controller: 2` (EXP) simultaneously.** The controller section maps each `(block, paramName)` pair to exactly one controller. Snapshot-controlled parameters (varying across snapshots) and EXP-assigned parameters are mutually exclusive.

### .pgp Format

Pod Go uses the same JSON structure but with `@controller: 4` for snapshot recall (not 19). EXP Pedal controller IDs are the same (`1` and `2`). The `buildControllerSection()` in `podgo-builder.ts` follows the same pattern as `preset-builder.ts` for snapshot params; EXP params use the same `"@controller": 1` or `"@controller": 2` encoding.

### .hsp Format

Helix Stadium uses a slot-based format (not flat-style). Expression pedal controller assignment is **not yet confirmed from real .hsp files** in the corpus. The Stadium controller section may use a different structure under `preset.controllers` or within each slot's `params` entry. This requires corpus extraction before Stadium EXP assignment is implemented.

**Confidence: MEDIUM for Stadium EXP format. HIGH for .hlx/.pgp.**

### Standard Assignment Rules (Industry Practice, MEDIUM confidence)

For professional Helix presets, EXP Pedal 2 is conventionally assigned to wah/volume:

| Effect Type | Parameter | @controller | @min | @max | Why |
|-------------|-----------|-------------|------|------|-----|
| Wah (any model) | `Position` | 2 (EXP2) | 0.0 | 1.0 | Industry standard: EXP2 = toe switch wah |
| Volume Pedal | `Volume` | 2 (EXP2) | 0.0 | 1.0 | Volume swells via expression |
| Reverb | `Mix` | 1 (EXP1) | 0.15 | 0.80 | Ambient swell when no wah present |
| Delay | `Mix` | 1 (EXP1) | 0.10 | 0.60 | Delay wetness control |
| Pitch (Whammy) | `Pitch` | 2 (EXP2) | 0.0 | 1.0 | Whammy heel-to-toe = unison-to-octave |

Priority: If wah is in the chain, EXP2 → wah Position. If no wah, EXP2 → Volume. EXP1 → ambient effect Mix if present. If no ambient effects, EXP1 is unassigned (leave controller section for that parameter absent).

### Data Structure for EXP Assignment

The EXP controller assignment is deterministic (not AI-decided). It belongs in the Knowledge Layer, not ToneIntent. The correct location is `buildControllerSection()` in `preset-builder.ts`.

No new type is needed — `HlxControllerAssignment` with `"@controller": CONTROLLERS.EXP_PEDAL_2` is already the correct encoding.

**Required logic addition to `buildControllerSection()`:**

```typescript
// After snapshot-controlled params are registered:
// Register EXP pedal assignments based on block type priority
function buildExpPedalAssignments(
  chain: BlockSpec[],
  controller: Record<string, ...>
): void {
  const blockKeyMap = buildBlockKeyMap(chain);

  // Priority 1: EXP2 → wah Position
  const wahBlock = chain.find(b => b.type === "wah");
  if (wahBlock) {
    const mapping = blockKeyMap.get(/* wahBlock key */);
    // Register: "@controller": CONTROLLERS.EXP_PEDAL_2, "@min": 0, "@max": 1
  }

  // Priority 2: EXP2 → volume Volume (if no wah)
  // Priority 3: EXP1 → reverb Mix or delay Mix (if ambient in chain)
}
```

The block key map (`buildBlockKeyMap`) already exists in `preset-builder.ts`. This is a targeted addition to an existing function.

---

## Feature Area 2: Per-Model Effect Intelligence

### What "Per-Model" Means in the Existing Architecture

The existing `HelixModel` interface already has:

```typescript
export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  ampCategory?: AmpCategory;       // amp-only
  topology?: TopologyTag;          // amp-only
  cabAffinity?: string[];          // amp-only
  ampFamily?: AmpFamily;           // amp-only
  paramOverrides?: Record<string, number | boolean>;  // Layer 4: per-model param overrides
  defaultParams: Record<string, number | boolean>;
  blockType: number;
  stadiumOnly?: boolean;
}
```

The `paramOverrides` mechanism (Phase 56 / Layer 4) applies per-model parameter tuning after category defaults. It was implemented for amps. The same pattern extends naturally to effects.

### Per-Model Effect Intelligence Schema

Add optional guidance fields to `HelixModel` entries for effect models:

```typescript
export interface HelixModel {
  // ... existing fields ...

  // NEW: Per-model effect parameter overrides (parallel to amp paramOverrides)
  // Applied in param-engine.ts after defaultParams + genre defaults
  effectParamOverrides?: Record<string, number | boolean>;

  // NEW: Effect combination guidance — which effect types pair well with this model
  // Used by combination-rules.ts to set context-aware params
  bestWith?: Array<"clean" | "crunch" | "high_gain">;  // amp categories this effect suits

  // NEW: Expressive parameter — which param benefits most from EXP pedal
  // Used by buildControllerSection() to assign EXP target automatically
  expParam?: string;  // e.g., "Position" for wahs, "Mix" for reverb/delay, "Pitch" for whammy
}
```

### Structuring Per-Model Effect Guidance for 126+ Effects

The challenge with 126+ effects is maintenance. The strategy is to populate `effectParamOverrides` and `bestWith` only where the model default is known to be wrong or suboptimal — not exhaustively on every model.

**Priority targets for per-model effect overrides (HIGH value, LOW risk):**

| Category | Models | Key Override | Why |
|----------|--------|--------------|-----|
| Wah | Fassel Wah, Weeper Wah, Mutron III+ | `Heel Freq`, `Toe Freq` | Each wah has a distinct sweep range. Fassel = vintage narrow, Mutron = funky high-filter |
| Reverb | Ganymede (shimmer), Particle Verb (glitch) | `Mix: 0.30`, `Lag: 0.15` | Shimmer/glitch reverbs produce excessive wetness at standard settings |
| Distortion | Scream 808 (used as boost) | `Drive: 0.15, Tone: 0.50, Level: 0.60` | Already in `SCREAM_808_PARAMS` in param-engine.ts — should migrate to effectParamOverrides |
| Modulation | Retro Reel (tape echo-style) | `Wow: 0.30, Flutter: 0.25` | High Wow/Flutter causes motion sickness at defaults |
| Delay | Cosmos Echo | `Repeat: 0.35` | High repeat counts cause runaway feedback |

**Structure approach:** Add `effectParamOverrides` as a sparse map — only models needing override get the field. The param-engine lookup remains: `model.effectParamOverrides ?? {}` merged on top of defaults.

**What NOT to add:** Do not add a `genre` dimension to `effectParamOverrides`. Genre-specific tuning already exists in `GENRE_EFFECT_DEFAULTS` in `param-engine.ts`. Per-model overrides should only correct model-specific quirks (e.g., Ganymede shimmer reverb is excessively wet at defaults regardless of genre), not duplicate genre logic.

### Resolution Order in param-engine.ts

The final resolution order for effect parameters:

```
Layer 1: model.defaultParams (from HelixModel)
Layer 2: GENRE_EFFECT_DEFAULTS[genre][blockType] (existing)
Layer 3: model.effectParamOverrides (NEW — per-model correction)
Layer 4: Tempo override for delay (existing)
```

Layer 3 is placed after genre to allow per-model corrections to override genre defaults when the model has specific behavior that trumps genre convention (e.g., shimmer reverb should always be at reduced Mix regardless of ambient genre).

---

## Feature Area 3: Effect Combination Logic

### What Combination Logic Means

Effect combination logic answers "given this amp + these effects, what parameter adjustments are needed because of interactions between them?" Examples:

- Compressor before high-gain amp → reduce compressor `Attack` to avoid squash
- Octave fuzz → set `Dry` parameter high to retain note definition
- Chorus + delay → reduce delay `Mix` to avoid washy buildup
- Hall reverb + long delay → reduce reverb `DecayTime` to prevent pile-up

### Where It Lives

A new `src/lib/helix/combination-rules.ts` module containing a lookup table of interaction rules. This module is called from `resolveParameters()` after all individual block parameters are resolved, with full chain context available.

```typescript
// src/lib/helix/combination-rules.ts

export interface CombinationRule {
  /** Block type that triggers this rule */
  triggerType: BlockSpec["type"];
  /** Block type that is modified when the trigger is present */
  targetType: BlockSpec["type"];
  /** Condition for this rule to fire */
  condition: {
    triggerCategory?: AmpCategory;  // only apply when amp is this category
    triggerModelId?: string;        // only apply for specific trigger model
  };
  /** Parameter adjustments to apply to the target block */
  targetAdjustments: Record<string, number>;
  /** Human-readable reason (for prompt engineering and debugging) */
  reason: string;
}

export const COMBINATION_RULES: CombinationRule[] = [
  {
    triggerType: "dynamics",           // Compressor present
    targetType: "amp",                 // adjusts amp
    condition: { triggerCategory: "high_gain" },
    targetAdjustments: { Drive: -0.05 }, // back off drive slightly
    reason: "Compressor feeding high-gain amp: reduce drive to avoid clipping",
  },
  {
    triggerType: "reverb",
    targetType: "delay",
    condition: {},  // applies whenever both are present
    targetAdjustments: { Mix: -0.05 },  // reduce delay wetness
    reason: "Reverb + delay: tighten delay mix to prevent washy buildup",
  },
  // ... additional rules
];
```

This module does NOT require AI. It is a deterministic table of expert-sourced combination adjustments applied after individual block resolution.

### Integration Point

Called in `resolveParameters()` as a final post-processing pass:

```typescript
// In resolveParameters() — at the end, after all blocks are resolved
import { applyCombinationRules } from "./combination-rules";
const withCombinations = applyCombinationRules(resolvedChain, intent);
return withCombinations;
```

### What NOT to Build

Do not build a full DSP interaction simulator. The combination rules are small, curated adjustments (±0.05 on 1-2 parameters). Do not attempt to model:

- Frequency masking between effects (too complex, requires audio analysis)
- Phase interactions (microphone-level concern, not preset-level)
- Non-linear saturation cascades (amp models are black boxes at this level)

Keep rules to 10-20 combinations covering the highest-impact interactions.

---

## Feature Area 4: Per-Device Preset Craft Optimization

### What "Per-Device Craft" Means

Each device has hardware-level characteristics that should inform preset construction beyond just block limits:

| Device | Key Craft Consideration | Optimization |
|--------|------------------------|--------------|
| Helix Floor/LT | 8-block DSP limit, but dual DSP — chain can sprawl | Prefer DSP0 for pre-amp, DSP1 for post-cab effects |
| HX Stomp | 6-block max, no room for mandatory inserts | No auto-insert EQ/Gain; maximize effect slots |
| Pod Go | Fixed block layout (wah+vol+amp+cab+EQ+FX loop) | Only 4 user slots; prioritize unique effects |
| Helix Stadium | Slot-grid, 12 blocks per path, dual DSP | Use Agoura-specific tone stack quirks; wider headroom |

### Where It Lives

Extend `DeviceCapabilities` in `device-family.ts` with craft guidance fields:

```typescript
export interface DeviceCapabilities {
  // ... existing fields ...

  // NEW: Craft-level optimization hints for Knowledge Layer
  /** Whether this device auto-inserts mandatory blocks (Parametric EQ + Gain Block) */
  insertsMandatoryBlocks: boolean;        // helix/stadium: true; stomp/podgo: false
  /** Preferred DSP for post-cab effects on dual-DSP devices (0 = none) */
  preferredPostCabDsp: 0 | 1;            // helix/stadium: 1; others: 0
  /** Whether this device benefits from boost-before-amp (tight DSP budget = skip) */
  includePreAmpBoost: boolean;            // stomp: false when at block limit
  /** Max "ambient" effects that contribute to mix quality vs. slot waste */
  recommendedAmbientEffectCount: number;  // stomp: 1, podgo: 1, helix: 2, stadium: 3
}
```

These fields are consumed in `chain-rules.ts` and `param-engine.ts` for per-device decisions that are currently hardcoded as individual guard sites.

### What This Replaces

Currently `assembleSignalChain()` checks `caps.family === "stomp"` and `caps.maxEffectsPerDsp` to make craft decisions inline. Moving these to `DeviceCapabilities` fields makes the decisions data-driven and documented at the capability definition site rather than scattered through chain-rule logic.

---

## Feature Area 5: Preset Quality Validation

### Current State of Validation

`validatePresetSpec()` in `validate.ts` checks:
1. Non-empty signal chain
2. At least one amp block
3. At least one cab block
4. All model IDs valid
5. Snapshots present
6. Parameter ranges (0-1 normalized, Hz for cab/reverb/delay, integer for Mic)
7. DSP block limits per device

`model-defaults-validation.test.ts` checks that all 126+ model `defaultParams` pass through `validatePresetSpec` without throwing — a regression guard.

### What Quality Validation Adds

Quality validation goes beyond structural validity to ask "does this preset sound good?" It is deterministic (not AI) and tests auditory/craft properties derivable from the data:

| Quality Check | What It Detects | Location |
|---------------|----------------|----------|
| Signal level sanity | ChVol outside 0.60-0.85 range = too quiet or clipping | `validatePresetSpec()` |
| EQ anti-mud | Cab LowCut below 60Hz = bass buildup in a mix context | `validatePresetSpec()` |
| Reverb over-wet | Reverb Mix above 0.65 = washed out in all snapshots | `validatePresetSpec()` |
| Snapshot balance | Lead ChVol not above Clean ChVol = level imbalance | `validatePresetSpec()` |
| Effect ordering | Distortion after reverb = incorrect signal path | `validatePresetSpec()` |
| Device-specific | EXP param assigned on a device with 0 expression pedals | `validatePresetSpec()` |

### Testing Approach for Quality Validation

**Vitest test pattern — mirrors existing `model-defaults-validation.test.ts`:**

```typescript
// src/lib/helix/quality-validation.test.ts
import { describe, it, expect } from "vitest";
import { validatePresetSpec } from "./validate";

describe("preset quality validation", () => {
  it("rejects reverb Mix above 0.65 (over-wet)", () => {
    const spec = buildSpecWithReverb({ Mix: 0.80 });
    expect(() => validatePresetSpec(spec, helixCaps))
      .toThrow(/reverb Mix.*over-wet/i);
  });

  it("rejects cab LowCut below 60Hz (bass buildup)", () => {
    const spec = buildSpecWithCab({ LowCut: 40.0 });
    expect(() => validatePresetSpec(spec, helixCaps))
      .toThrow(/LowCut.*below 60Hz/i);
  });

  it("rejects EXP pedal assignment on Stadium with 0 expression pedals", () => {
    // Stadium expressionPedalCount: 0 (per device-family.ts line 193)
    const spec = buildSpecWithExpAssignment();
    expect(() => validatePresetSpec(spec, stadiumCaps))
      .toThrow(/expression pedal.*not supported/i);
  });
});
```

**Warning-vs-throw distinction:**

Not all quality issues should throw. Structural bugs (wrong model IDs, invalid ranges) should throw — they produce unloadable presets. Quality issues (reverb too wet) should warn but not throw — the preset loads fine, it just may not sound ideal. Use a separate `validatePresetQuality(spec, caps): QualityWarning[]` function that returns warnings without throwing.

```typescript
// New function signature — does NOT throw
export interface QualityWarning {
  severity: "warn" | "info";
  code: string;
  message: string;
  blockName?: string;
}

export function validatePresetQuality(
  spec: PresetSpec,
  caps: DeviceCapabilities
): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  // Check reverb Mix (warn, don't throw)
  for (const block of spec.signalChain) {
    if (block.type === "reverb" && typeof block.parameters.Mix === "number") {
      if (block.parameters.Mix > 0.65) {
        warnings.push({
          severity: "warn",
          code: "REVERB_OVERWET",
          message: `Reverb '${block.modelName}' Mix=${block.parameters.Mix.toFixed(2)} — may sound washed out`,
          blockName: block.modelName,
        });
      }
    }
  }

  // ... additional quality checks
  return warnings;
}
```

This function is called in the `/api/generate` orchestration pipeline after `validatePresetSpec()`, and its warnings can be returned to the frontend as advisory notes.

### Test Organization Pattern

Following the established pattern (`model-defaults-validation.test.ts`):
- Co-located test file: `src/lib/helix/quality-validation.test.ts`
- Uses `vitest` `describe` / `it` / `expect` directly (no mocking)
- Factory functions for building test specs: `buildSpecWithReverb()`, `buildSpecWithCab()`, etc.
- Full suite run command: `npx vitest run`
- Per-file command: `npx vitest run src/lib/helix/quality-validation.test.ts`

---

## Recommended Stack (No New Packages)

### Core Technologies — Unchanged

| Technology | Version | Purpose | Impact for This Milestone |
|------------|---------|---------|--------------------------|
| TypeScript | ^5 | Type safety | New `expParam`, `effectParamOverrides`, `bestWith` fields on `HelixModel`; new `QualityWarning` type; new `CombinationRule` interface |
| Vitest | ^4.0.18 | Testing | New `quality-validation.test.ts`; extend `model-defaults-validation.test.ts` with EXP coverage |
| Zod | ^4.3.6 | Schema validation | No changes — EXP assignment is deterministic, not AI-selected |
| `@anthropic-ai/sdk` | ^0.78.0 | Claude planner | Planner prompt enriched with combination logic guidance (plain text addition, no API change) |

### Supporting Patterns — No New Tools

| Pattern | File | Purpose |
|---------|------|---------|
| Layer 4 override mechanism | `models.ts` + `param-engine.ts` | Reuse existing `paramOverrides` pattern for `effectParamOverrides` |
| `CONTROLLERS` constants | `models.ts` lines 52-57 | EXP_PEDAL_1=1, EXP_PEDAL_2=2 already defined — extend `buildControllerSection()` to use them |
| `DeviceCapabilities` interface | `device-family.ts` | Add craft-guidance fields — existing pattern for per-device decisions |
| `validatePresetSpec()` | `validate.ts` | Add device-aware EXP validation; add quality-warning function alongside |
| `CombinationRule[]` table | `combination-rules.ts` (NEW) | New module, same pattern as `GENRE_EFFECT_DEFAULTS` in `param-engine.ts` |

---

## Installation

```bash
# No new packages for this milestone.
# All changes are in existing TypeScript source files:

# Modified files:
#   src/lib/helix/models.ts         — add effectParamOverrides, expParam, bestWith to HelixModel
#   src/lib/helix/param-engine.ts   — resolve effectParamOverrides as Layer 3 after genre
#   src/lib/helix/preset-builder.ts — extend buildControllerSection() with EXP pedal logic
#   src/lib/helix/validate.ts       — add validatePresetQuality() with QualityWarning
#   src/lib/helix/device-family.ts  — add craft-guidance fields to DeviceCapabilities
#   src/app/api/generate/route.ts   — call validatePresetQuality() and surface warnings

# New files:
#   src/lib/helix/combination-rules.ts      — COMBINATION_RULES table + applyCombinationRules()
#   src/lib/helix/quality-validation.test.ts — Vitest tests for quality warnings
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `effectParamOverrides` as sparse optional field on `HelixModel` | Separate `EFFECT_OVERRIDES` lookup table in `param-engine.ts` | Use separate table if effect overrides need to vary by device family (they don't — the overrides are model-specific, not device-specific) |
| `CombinationRule[]` as flat array | Nested map by `(triggerType, targetType)` | Use nested map if there are 50+ rules needing fast lookup. Under 20 rules, a flat `Array.find()` is readable and fast enough |
| `validatePresetQuality()` returns `QualityWarning[]` (non-throwing) | Add quality checks to `validatePresetSpec()` (throwing) | Use throwing only for structural bugs that make the preset unloadable. Quality issues never make a preset unloadable — warn, don't throw |
| EXP assignment in `buildControllerSection()` (Knowledge Layer) | Add EXP assignment to ToneIntent (AI-decided) | Never — EXP assignment is deterministic based on block type, not creative. AI deciding "EXP2 → wah" adds no value and costs tokens |
| Extend `DeviceCapabilities` with craft fields | Hardcode craft decisions in `chain-rules.ts` guards | Use capabilities object when a decision applies uniformly to a whole device family. Use inline guards only for one-off edge cases |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm package for this milestone | All five feature areas are TypeScript data + logic changes. No audio processing, binary parsing, or new schema validation is needed | The existing TypeScript + Vitest + Zod stack covers everything |
| EXP pedal assignment in ToneIntent (AI-selected) | Expression pedal assignment is deterministic by convention (EXP2 = wah/volume). AI deciding this adds no value and can produce wrong assignments (e.g., EXP2 → reverb Mix on a wah preset) | `buildControllerSection()` in `preset-builder.ts` — deterministic by block type |
| AI-generated combination rules | Combination logic is expert knowledge encoded as a table. AI-generated rules would be inconsistent and hard to validate | `COMBINATION_RULES` static table in `combination-rules.ts` |
| Throwing errors for quality warnings | Quality issues (reverb too wet) produce presets that load and sound workable. Throwing prevents the user from downloading the preset at all | `validatePresetQuality()` returning `QualityWarning[]` — warn in the UI, don't block |
| Per-model AI prompt text for all 126+ effects | 126 effect descriptions in the planner prompt would exceed reasonable context lengths and violate prompt caching. The Knowledge Layer handles per-model intelligence deterministically | `effectParamOverrides` field on `HelixModel` — deterministic, cacheable |
| Exhaustive `effectParamOverrides` on every effect model | Most effect models have well-calibrated defaults. Per-model overrides should target only models with known quirks (shimmer reverb, runaway delay models, etc.) | Sparse optional field — only populate where the default is demonstrably wrong |

---

## Stack Patterns by Variant

**If EXP pedal assignment needs per-snapshot variation:**
- Use `"@controller": CONTROLLERS.SNAPSHOT` for snapshot-controlled Mix + a separate EXP assignment entry for the overall pedal range
- Real Helix presets sometimes have both: snapshot controls the Mix "target" and EXP controls sweep within that range
- This requires a new `@snapshot_disable: true` on the EXP entry (existing field in `HlxControllerAssignment`)

**If a new device is added with unique EXP hardware:**
- Add `expressionPedalCount: N` to the new device's `getCapabilities()` entry (already exists)
- Add `expPedalControllerIds: number[]` if the device uses non-standard controller IDs
- Stadium EXP controller ID needs corpus verification before Stadium EXP assignment is implemented

**If effect combination rules grow beyond 20 entries:**
- Move `COMBINATION_RULES` from flat array to `Map<string, CombinationRule[]>` keyed by `triggerType`
- Lookup becomes `O(1)` per block type instead of `O(n)` full scan
- Not needed at 10-20 rules

**If quality validation warnings need severity thresholds by device:**
- Add `qualityThresholds?: Record<string, number>` to `DeviceCapabilities`
- e.g., Stomp might tolerate higher reverb Mix because its block budget forces fewer effects
- This is a v2 enhancement — start with universal thresholds

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `vitest` | ^4.0.18 | No changes needed — `quality-validation.test.ts` uses same `describe/it/expect` pattern |
| `typescript` | ^5 | Optional fields on interfaces (`expParam?: string`) are standard TS — no version concern |
| `zod` | ^4.3.6 | No changes to schemas for this milestone — EXP assignment is not AI-selected |
| `@anthropic-ai/sdk` | ^0.78.0 | Planner prompt text additions are plain string concatenation — no API change |
| `next` | 16.1.6 | No new routes — `validatePresetQuality()` called in existing `/api/generate` orchestration |

---

## Sources

- Direct codebase inspection: `src/lib/helix/types.ts` lines 129-140 — `HlxControllerAssignment`, `@controller` values (19=snapshot, 2=EXP2, 18=MIDI CC) — HIGH confidence
- Direct codebase inspection: `src/lib/helix/models.ts` lines 52-57 — `CONTROLLERS` constant with `EXP_PEDAL_1: 1`, `EXP_PEDAL_2: 2` — HIGH confidence
- Direct codebase inspection: `src/lib/helix/preset-builder.ts` `buildControllerSection()` — existing snapshot controller registration pattern — HIGH confidence
- Direct codebase inspection: `src/lib/helix/validate.ts` — existing `validatePresetSpec()` structure, `validateAndFixPresetSpec()` — HIGH confidence
- Direct codebase inspection: `src/lib/helix/model-defaults-validation.test.ts` — test pattern for mass model validation — HIGH confidence
- Direct codebase inspection: `src/lib/helix/param-engine.ts` — `GENRE_EFFECT_DEFAULTS`, `resolveDefaultParams()`, Layer 4 override mechanism — HIGH confidence
- Direct codebase inspection: `src/lib/helix/device-family.ts` lines 40-41, 193 — `expressionPedalCount` (Stadium=0), `DeviceCapabilities` interface — HIGH confidence
- Direct codebase inspection: `.planning/milestones/v4.0-phases/56-per-model-amp-overrides/` — `paramOverrides` Layer 4 mechanism, validated pattern for per-model overrides — HIGH confidence
- Direct codebase inspection: `.planning/milestones/v4.0-phases/57-effect-parameter-intelligence/57-RESEARCH.md` — existing effect intelligence patterns, resolution order — HIGH confidence
- `.planning/codebase/TESTING.md` — confirmed Vitest patterns: `describe/it/expect`, factory functions, co-located `.test.ts` files — HIGH confidence

---

*Stack research for: HelixTones — Preset Quality Deep Dive (expression pedal, per-model effect intelligence, effect combination logic, per-device craft, quality validation)*
*Researched: 2026-03-06*
