# Phase 2: Knowledge Layer - Research

**Researched:** 2026-03-01
**Domain:** Deterministic Helix preset engineering -- signal chain rules, parameter resolution, snapshot generation
**Confidence:** HIGH

## Summary

Phase 2 encodes expert Helix knowledge into three pure TypeScript modules that transform a narrow `ToneIntent` (model names + creative choices) into a complete `PresetSpec` (every parameter value, block position, snapshot state, and DSP assignment). The existing codebase from Phase 1 provides all necessary types (`BlockSpec`, `SnapshotSpec`, `PresetSpec`, `AmpCategory`, `TopologyTag`), a comprehensive model database (68 amp models with `ampCategory` and `topology` metadata, 22 cab models with Hz-encoded LowCut/HighCut, and full distortion/delay/reverb/dynamics/EQ/volume model catalogs), and a working `buildHlxFile()` function that converts `PresetSpec` to `.hlx` JSON.

The three modules have clear boundaries: `chain-rules.ts` resolves ToneIntent model names to model IDs, enforces signal chain ordering, inserts mandatory blocks (boost, post-cab EQ, noise gate, volume block), and assigns DSP/position; `param-engine.ts` applies category-specific expert parameter values to every block in the chain; `snapshot-engine.ts` generates 4 volume-balanced snapshots with per-snapshot block states and ChVol/parameter overrides. Each module is a pure function with no AI calls and no side effects.

**Primary recommendation:** Implement as three independent modules with clear input/output contracts. The data flows linearly: `ToneIntent -> assembleSignalChain() -> resolveParameters() -> buildSnapshots() -> PresetSpec`. All parameter values come from lookup tables and deterministic rules derived from the Tonevault 250-preset analysis and community-verified expert consensus.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(None -- all decisions delegated to Claude's Discretion)

### Claude's Discretion

All Phase 2 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Signal chain order** -- Enforce: Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb. DSP0 gets pre-amp blocks (gate, boost/drive, amp, cab). DSP1 gets post-cab blocks (EQ, mod, delay, reverb, volume). chain-rules.ts inserts mandatory blocks (boost, post-cab EQ, noise gate) without AI involvement.
- **Always-on boost implementation** -- Minotaur (Klon) for clean/crunch, Scream 808 for high-gain. Inserted by chain-rules.ts if not already in ToneIntent effects list. Parameters set by param-engine.ts per amp category.
- **Amp parameter defaults** -- Category-specific expert defaults from FEATURES.md research (Tonevault 250 presets analysis): clean (Master 0.9-1.0, Drive 0.2-0.3, SAG 0.5-0.7), crunch (Master 0.5-0.7, Drive 0.4-0.6, SAG 0.4-0.5), high-gain (Master 0.3-0.6, Drive 0.3-0.5, SAG 0.2-0.3). Topology-aware mid EQ.
- **Cab filtering** -- Every cab gets LowCut 80-100 Hz, HighCut 5000-8000 Hz. Mic selection by category: 121 Ribbon for clean, 57 Dynamic for high-gain, blend rules for crunch.
- **Post-cab EQ** -- Parametric EQ after cab on every preset. Anti-mud cut at 300-500 Hz, presence recovery high shelf +0.5-1.5 dB at 6-8 kHz.
- **Snapshot design** -- 4 snapshots (Clean, Rhythm, Lead, Ambient). Volume-balanced via ChVol overrides only (never Master). Lead gets +2-3 dB via Volume block. LED colors: Clean=blue(6), Rhythm=orange(2), Lead=red(1), Ambient=turquoise(5). Delay/reverb trails enabled.
- **Dynamic responsiveness** -- Low Drive + high Master ratio for volume-knob cleanup. SAG set appropriately per category. Boost architecture enables dynamic response.
- **DSP split rules** -- Max 8 non-cab blocks per DSP. Amp+cab always on DSP0. Post-cab effects on DSP1.

### Deferred Ideas (OUT OF SCOPE)

- Pickup-aware tone calibration (v2 -- TONE-V2-01)
- Dual cab / dual mic blending (v2 -- TONE-V2-02)
- Genre-specific signal chain templates (v2 -- TONE-V2-03)
- Snapshots 5-8 extended scenes (v2 -- SNAP-V2-01)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAIN-01 | Deterministic signal chain assembly (Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb) | Block ordering constants and DSP assignment rules documented in Architecture Patterns section; model type-to-position mapping table provided |
| CHAIN-02 | Always-on transparent boost (Minotaur for clean/crunch, Scream 808 for high-gain) | Exact model IDs, parameter names, and per-category boost values documented in Critical Model IDs and Boost Parameter Values sections |
| CHAIN-03 | Post-cab EQ block on every preset | Parametric EQ model ID, parameter names (LowFreq/LowGain/MidFreq/MidGain/Q/HighFreq/HighGain/Level), and per-category EQ values documented |
| CHAIN-04 | Noise gate -- input block gate + Horizon Gate post-amp for high-gain | Horizon Gate model ID and parameter names documented; input gate config from HlxInput interface documented |
| CHAIN-05 | DSP path split rules (8-block-per-DSP limit, amp+cab on DSP0) | DSP split strategy documented in Architecture Patterns with block-to-DSP assignment rules |
| CHAIN-06 | Mandatory block insertion without AI involvement | List of mandatory blocks and insertion conditions documented; function signature specified |
| TONE-01 | Amp-category-specific parameter defaults | Full normalized 0.0-1.0 parameter tables for clean/crunch/high-gain documented in Amp Category Parameter Defaults section |
| TONE-02 | Cab block filtering (LowCut 80-100 Hz, HighCut 5-8 kHz) | Cab parameters are Hz-encoded (not normalized); per-category Hz values and mic indices documented |
| TONE-03 | Post-cab presence recovery (+0.5-1.5 dB high shelf at 6-8 kHz) | Parametric EQ HighFreq/HighGain values for presence recovery documented per amp category |
| TONE-04 | Mic selection by tone category | Mic integer indices documented: 0=57 Dynamic, 6=121 Ribbon, 2=67 Condenser; per-category mic rules provided |
| TONE-05 | Correct amp+cab pairing | cabAffinity arrays on every AMP_MODELS entry provide the pairing data; resolution logic documented |
| TONE-06 | Amp topology awareness for mid EQ treatment | topology field on AMP_MODELS (cathode_follower vs plate_fed) and mid adjustment rules documented |
| SNAP-01 | 4-snapshot minimum (Clean, Rhythm, Lead, Ambient) | Snapshot roles, LED colors, and per-role block state tables documented in Snapshot Engine section |
| SNAP-02 | Volume-balanced snapshots via ChVol overrides | ChVol normalized values per role documented; ChVol is normalized_float per param-registry |
| SNAP-03 | Lead snapshot volume boost (+2-3 dB via Volume block) | Gain Block model ID (HD2_VolPanGain) and Gain parameter (db_value, +2.5 dB) documented |
| SNAP-04 | Delay/reverb trails enabled | trails boolean field on BlockSpec documented; set to true for all delay/reverb blocks |
| SNAP-05 | Programmatic block state generation from final signal chain | Block state generation algorithm documented with per-role enable/disable tables |
| DYN-01 | Volume-knob cleanup (low Drive + high Master ratio) | Encoded in amp category defaults: clean Master 0.9-1.0/Drive 0.2-0.3; high-gain Master 0.3-0.6/Drive 0.3-0.5 |
| DYN-02 | SAG parameter per category | SAG values per category documented: clean 0.5-0.7, crunch 0.4-0.5, high-gain 0.2-0.3 |
| DYN-03 | Boost architecture enables dynamic response | Always-on boost with low gain before amp creates dynamic pickup-responsive behavior; boost insertion rules documented |
</phase_requirements>

## Standard Stack

### Core

No new libraries are needed for Phase 2. All three modules are pure TypeScript functions operating on existing types.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (project existing) | Type-safe deterministic logic | Already in project; strong typing prevents parameter encoding bugs |
| Zod | 3.x (project existing) | ToneIntent schema validation | Already used in tone-intent.ts; input validation at module boundary |

### Supporting

None required. Phase 2 modules are pure functions with zero external dependencies beyond project types.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded lookup tables | JSON config files | Config files add I/O and parsing; lookup tables are faster, type-checked, and sufficient for ~68 amps and fixed rules |
| Switch/case for categories | Strategy pattern with class hierarchy | Over-engineering for 3 categories; simple if/switch is clearer and more maintainable |
| Runtime parameter validation | Compile-time branded types | Branded types add complexity; validate at module boundary with Zod, trust internal flow |

## Architecture Patterns

### Recommended Project Structure

```
src/lib/helix/
  chain-rules.ts        # Signal chain assembly + mandatory block insertion
  param-engine.ts       # Category-specific parameter resolution
  snapshot-engine.ts    # Volume-balanced snapshot generation
  models.ts             # Existing model database (read-only for Phase 2)
  types.ts              # Existing types (read-only for Phase 2)
  tone-intent.ts        # Existing ToneIntent schema (read-only for Phase 2)
  param-registry.ts     # Existing parameter type registry (read-only for Phase 2)
  preset-builder.ts     # Existing .hlx builder (read-only for Phase 2)
  validate.ts           # Existing validator (read-only for Phase 2)
  index.ts              # Barrel exports (add new module exports)
```

### Pattern 1: Linear Pipeline with Typed Boundaries

**What:** Three modules form a linear pipeline where each function takes the output of the previous one and enriches it. Data flows one direction: ToneIntent -> BlockSpec[] -> BlockSpec[] (with params) -> SnapshotSpec[].

**When to use:** Always -- this is the only data flow pattern for Phase 2.

**Function signatures:**

```typescript
// chain-rules.ts
export function assembleSignalChain(intent: ToneIntent): BlockSpec[]
// Takes: ToneIntent (amp name, cab name, effects[], guitar type)
// Returns: Complete signal chain with all mandatory blocks inserted,
//          correct ordering, DSP assignments, and positions.
//          Parameters are EMPTY (filled by param-engine).

// param-engine.ts
export function resolveParameters(
  chain: BlockSpec[],
  intent: ToneIntent
): BlockSpec[]
// Takes: Signal chain from assembleSignalChain + original intent for context
// Returns: Same chain with all parameter values filled in.
//          Each block's `parameters` record is complete.

// snapshot-engine.ts
export function buildSnapshots(
  chain: BlockSpec[],
  intents: SnapshotIntent[]
): SnapshotSpec[]
// Takes: Fully parameterized chain + snapshot intents from ToneIntent
// Returns: 4 SnapshotSpec objects with block states, ChVol overrides,
//          and parameter overrides for volume balancing.
```

### Pattern 2: Mandatory Block Insertion

**What:** `chain-rules.ts` always inserts certain blocks regardless of ToneIntent contents. The AI cannot prevent these blocks from appearing.

**Mandatory blocks:**

| Block | Model ID | Condition | Position |
|-------|----------|-----------|----------|
| Always-on boost (clean/crunch) | `HD2_DistMinotaur` | ampCategory is "clean" or "crunch" AND no Minotaur in effects | Before amp on DSP0 |
| Always-on boost (high-gain) | `HD2_DistScream808` | ampCategory is "high_gain" AND no Scream 808 in effects | Before amp on DSP0 |
| Post-cab Parametric EQ | `HD2_EQParametric` | Always | First block on DSP1 |
| Horizon Gate | `HD2_GateHorizonGate` | ampCategory is "high_gain" | After cab, before EQ (last block on DSP0 or first on DSP1) |
| Gain Block (volume) | `HD2_VolPanGain` | Always (for lead snapshot boost) | Last block on DSP1 |

**Implementation note:** Check if the ToneIntent effects list already includes a matching effect (by modelName). If yes, use the AI's choice and set it as always_on. If no, insert the mandatory block.

### Pattern 3: DSP Assignment Strategy

**What:** Blocks are split across DSP0 and DSP1 to stay within the 8-block-per-DSP limit (excluding cab blocks which use separate `cab0` slots).

**DSP0 (pre-amp + amp + cab):**
```
Position 0: Input Noise Gate (built into inputA, not a block)
Position 0: Wah (if present)
Position 1: Compressor (if present)
Position N: Additional drive/distortion effects (if present, before boost)
Position N+1: Always-on Boost (Minotaur or Scream 808)
Position N+2: Amp
cab0: Cab (separate slot, not counted in block positions)
Position N+3: Horizon Gate (high-gain only)
```

**DSP1 (post-cab effects):**
```
Position 0: Parametric EQ (always present)
Position 1: Modulation (if present)
Position 2+: Additional modulation effects
Position N: Delay (if present)
Position N+1: Reverb (if present)
Position last: Gain Block / Volume (always present, for lead boost)
```

**Block counting rule:** Non-cab blocks on each DSP must not exceed 8. Cab blocks use `cab0` keys, not `block` keys. The `position` field on each BlockSpec is the sequential index within that DSP's block list.

**Topology note:** The HlxGlobal `@topology0` and `@topology1` fields should remain `"A"` (serial single-path). This is set by `preset-builder.ts` already.

### Pattern 4: Category-Aware Parameter Resolution

**What:** `param-engine.ts` applies parameters in layers: model defaults (from `AMP_MODELS[name].defaultParams`) are the base, then category overrides are applied on top, then topology-specific adjustments.

**Layer order:**
1. Start with `AMP_MODELS[ampName].defaultParams` (already per-model tuned in Phase 1)
2. Apply category-level overrides (if the model's defaults deviate from category consensus)
3. Apply topology-aware mid adjustment
4. The final values are what go into `BlockSpec.parameters`

**Implementation note:** Since Phase 1 already populated per-model `defaultParams` with category-appropriate values, `param-engine.ts` may primarily pass through these values and apply only the overrides that differ (e.g., topology-specific mid treatment, category-level clamping to ensure values stay within research-backed ranges).

### Anti-Patterns to Avoid

- **Anti-pattern: AI-generated parameters.** Never accept numeric parameter values from the AI. The Knowledge Layer owns all numbers.
- **Anti-pattern: Shared mutable state between modules.** Each function returns a new array/object. No module mutates its inputs.
- **Anti-pattern: Validation-as-correction in the knowledge layer.** If a model name from ToneIntent is not found in the database, throw an error. Do not fuzzy-match or guess. The validator in validate.ts handles this for AI output; the knowledge layer assumes valid input from the planner.
- **Anti-pattern: Mixing creative and engineering decisions.** chain-rules.ts does NOT decide which amp to use. It receives the amp name and handles everything else.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model name to ID resolution | Custom fuzzy-matching | Direct lookup in `AMP_MODELS`, `CAB_MODELS`, `DISTORTION_MODELS` etc. | Keys in these Records are the exact model names the AI generates |
| Parameter value ranges | Custom range calculation | Hardcoded lookup tables per category | Only 3 categories (clean/crunch/high_gain); ranges are fixed research consensus |
| Block type resolution | String parsing of model IDs | `blockType` field on each model in the database | Already stored per-model in Phase 1 |
| DSP cost calculation | Custom DSP budget tracker | Simple block count (max 8 per DSP) | Real DSP cost varies by model, but 8-block limit is a safe conservative bound |
| Cab affinity resolution | Genre-based cab recommendation engine | `cabAffinity` array on each amp model | First entry is the default match; already curated per-model in Phase 1 |

**Key insight:** Phase 1 did the heavy lifting of populating model metadata. Phase 2 reads this data and applies rules. Do not re-derive what is already stored.

## Critical Model IDs and Parameter Names

These are the exact model IDs and parameter names from the codebase. Using incorrect names will produce silent failures in the .hlx file.

### Boost Pedals

| Model | ID | Parameter Names | Notes |
|-------|----|----------------|-------|
| Minotaur (Klon) | `HD2_DistMinotaur` | `Gain`, `Treble`, `Output` | FEATURES.md says "Drive/Tone/Output" but code uses Gain/Treble/Output |
| Scream 808 (TS808) | `HD2_DistScream808` | `Drive`, `Tone`, `Level` | Matches FEATURES.md naming |

**Critical note:** The Minotaur's parameter names in code (`Gain`, `Treble`, `Output`) differ from the human-readable names in FEATURES.md (`Drive`, `Tone`, `Output`). The code parameter names are the ones that must appear in the .hlx file.

### Utility Blocks

| Model | ID | Parameter Names | Notes |
|-------|----|----------------|-------|
| Parametric EQ | `HD2_EQParametric` | `LowFreq`, `LowGain`, `MidFreq`, `MidGain`, `Q`, `HighFreq`, `HighGain`, `Level` | All normalized 0.0-1.0 |
| Horizon Gate | `HD2_GateHorizonGate` | `Threshold`, `Decay` | Both normalized 0.0-1.0 |
| Noise Gate | `HD2_GateNoiseGate` | `Threshold`, `Decay` | Both normalized 0.0-1.0 |
| Gain Block | `HD2_VolPanGain` | `Gain` | dB value (-20.0 to +20.0), NOT normalized |
| Volume Pedal | `HD2_VolPanVol` | `Position` | Normalized 0.0-1.0 |

### Block Type Constants

| Block Purpose | `@type` value | Constant |
|---------------|---------------|----------|
| Distortion/Overdrive/EQ/Dynamics/Volume/Wah | 0 | `BLOCK_TYPES.DISTORTION` (all share 0) |
| Amp (with cab reference) | 3 | `BLOCK_TYPES.AMP_WITH_CAB` |
| Modulation | 4 | `BLOCK_TYPES.MODULATION` |
| Delay | 7 | `BLOCK_TYPES.DELAY` |
| Reverb | 7 | `BLOCK_TYPES.REVERB` (same as DELAY) |

### Mic Indices

| Index | Mic Name | Best For |
|-------|----------|----------|
| 0 | 57 Dynamic (SM57) | High-gain, crunch -- cuts through distortion |
| 2 | 67 Condenser (U67) | Clean, acoustic-like tones |
| 6 | 121 Ribbon | Clean, jazz -- warm, smooth, body-forward |

## Amp Category Parameter Defaults

These are the expert-consensus normalized (0.0-1.0) parameter values that `param-engine.ts` must enforce. Values derived from Tonevault 250-preset analysis and FEATURES.md research.

### Category Override Tables

**CRITICAL: Mapping convention.** FEATURES.md describes parameters on a 0-10 human scale. The Helix uses normalized 0.0-1.0. The mapping is: `human_value / 10 = normalized_value`. For example, "Drive 2-3" = 0.20-0.30 normalized, "Master 9-10" = 0.90-1.0 normalized.

#### Clean Amps

| Parameter | Normalized Range | Human Equivalent | Rationale |
|-----------|-----------------|------------------|-----------|
| Drive | 0.20-0.30 | 2-3 | Keep amp clean; boost provides saturation |
| Master | 0.90-1.00 | 9-10 | 94% of Jazz Rivet presets max master; engages power amp warmth |
| ChVol | 0.70 | 7.0 | Reference volume level |
| Sag | 0.50-0.70 | 5-7 | Moderate sag for dynamic bloom |
| Bias | 0.50-0.60 | 5-6 | Warm Class AB character |
| Bass | 0.50-0.60 | 5-6 | Neutral starting point |
| Mid | 0.50 | 5 | Neutral |
| Treble | 0.50-0.60 | 5-6 | Neutral to slightly bright |
| Presence | 0.35 | 3.5 | Moderate; let cab EQ handle sparkle |
| Hum | 0.05-0.15 | 0.5-1.5 | Low; adds subtle warmth |
| Ripple | 0.05-0.15 | 0.5-1.5 | Low |
| BiasX | 0.50 | 5 | Neutral crossover |

#### Crunch Amps

| Parameter | Normalized Range | Human Equivalent | Rationale |
|-----------|-----------------|------------------|-----------|
| Drive | 0.40-0.60 | 4-6 | Moderate preamp; boost provides on-demand saturation |
| Master | 0.50-0.70 | 5-7 | Mid-range power amp engagement |
| ChVol | 0.70 | 7.0 | Reference volume level |
| Sag | 0.40-0.50 | 4-5 | Moderate; not as tight as metal, not as spongy as clean |
| Bias | 0.60-0.70 | 6-7 | Hotter bias for harmonic saturation |
| Bass | 0.20-0.35 | 2-3.5 | Lean low-end to avoid mud with gain |
| Mid | 0.55-0.65 | 5.5-6.5 | Slight mid push for presence |
| Treble | 0.55-0.65 | 5.5-6.5 | Slight brightness |
| Presence | 0.40-0.50 | 4-5 | Moderate presence |
| Hum | 0.10-0.20 | 1-2 | Slight hum for character |
| Ripple | 0.10-0.15 | 1-1.5 | Low |
| BiasX | 0.50 | 5 | Neutral |

#### High-Gain Amps

| Parameter | Normalized Range | Human Equivalent | Rationale |
|-----------|-----------------|------------------|-----------|
| Drive | 0.30-0.50 | 3-5 | NOT 8-10; overdrive pedal provides the push |
| Master | 0.30-0.60 | 3-6 | Tight, focused power amp; high master over-saturates |
| ChVol | 0.70 | 7.0 | Reference volume level |
| Sag | 0.20-0.30 | 2-3 | Tight, punchy; essential for palm-mute clarity |
| Bias | 0.70-0.80 | 7-8 | Hot bias for full saturation; mitigates crossover distortion |
| Bass | 0.25-0.40 | 2.5-4 | Tight low-end to prevent mud |
| Mid | 0.40-0.65 | 4-6.5 | Varies by topology (see TONE-06 below) |
| Treble | 0.50-0.60 | 5-6 | Moderate; cab high-cut handles fizz |
| Presence | 0.45-0.55 | 4.5-5.5 | Moderate to slightly forward |
| Hum | 0.05-0.10 | 0.5-1 | Minimal; high-gain amps have enough harmonics |
| Ripple | 0.05 | 0.5 | Minimal |
| BiasX | 0.45-0.50 | 4.5-5 | Slightly cool crossover for tightness |

### Topology-Aware Mid Adjustment (TONE-06)

For high-gain amps, the amp topology determines mid treatment:

| Topology | Mid Range | Rationale |
|----------|-----------|-----------|
| `cathode_follower` | 0.40-0.50 (lower) | Cathode-follower tone stack scoops mids cleanly at high gain; let the topology do the work |
| `plate_fed` | 0.55-0.65 (higher) | Plate-fed tone stack preserves mids even at high drive; keep mids present |
| `solid_state` | 0.50 (neutral) | No tube power amp characteristics to account for |

**Implementation:** After applying category defaults, check if `ampCategory === "high_gain"` and override Mid based on `topology`.

### Boost Parameter Values

#### Minotaur (Clean/Crunch) -- `HD2_DistMinotaur`

| Amp Category | Gain | Treble | Output | Rationale |
|-------------|------|--------|--------|-----------|
| clean | 0.00 | 0.50 | 0.70 | Clean boost; subtle compression only |
| crunch | 0.20-0.30 | 0.50 | 0.60 | Mid push + slight saturation |

#### Scream 808 (High-Gain) -- `HD2_DistScream808`

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Drive | 0.10-0.20 | Minimal drive; tightens low-end |
| Tone | 0.50 | Neutral tone; mid push from circuit character |
| Level | 0.50-0.70 | Unity to slight boost into amp input |

### Cab Parameters by Category

Cab parameters use Hz values for LowCut/HighCut (not normalized 0-1) and integer indices for Mic.

| Amp Category | LowCut (Hz) | HighCut (Hz) | Mic Index | Mic Name | Distance | Angle |
|-------------|-------------|-------------|-----------|----------|----------|-------|
| clean | 80.0 | 7000.0 | 6 | 121 Ribbon | 1.0 | 0.0 |
| crunch | 80.0 | 7500.0 | 0 | 57 Dynamic | 1.0 | 0.0 |
| high_gain | 100.0 | 5500.0 | 0 | 57 Dynamic | 1.0 | 0.0 |

**Note on cab affinity:** Use the first entry in `AMP_MODELS[ampName].cabAffinity` as the default cab. If the ToneIntent specifies a cab name, honor it. If it specifies a cab not in the affinity list, use it anyway (the user/AI made a deliberate choice). If the cab name is not found in `CAB_MODELS`, throw an error.

**Note on cab model overrides:** Cab models in `CAB_MODELS` already have per-model `defaultParams` with LowCut/HighCut values. For high-gain 4x12 V30-type cabs, these defaults already use LowCut=100 and HighCut=6500. The param-engine should use the category-specific values from the table above as overrides, ensuring consistency across all cabs regardless of their per-model defaults.

### Post-Cab Parametric EQ Values -- `HD2_EQParametric`

The Parametric EQ has parameters on a normalized 0.0-1.0 scale. The `LowFreq`, `MidFreq`, `HighFreq` control frequency centers; `LowGain`, `MidGain`, `HighGain` control boost/cut; `Q` controls mid band width; `Level` is output level.

| Amp Category | LowFreq | LowGain | MidFreq | MidGain | Q | HighFreq | HighGain | Level | Notes |
|-------------|---------|---------|---------|---------|---|----------|----------|-------|-------|
| clean | 0.18 | 0.50 | 0.40 | 0.48 | 0.50 | 0.75 | 0.55 | 0.0 | Gentle: slight mid scoop, +1 dB presence recovery |
| crunch | 0.20 | 0.45 | 0.38 | 0.45 | 0.50 | 0.75 | 0.56 | 0.0 | Moderate: -1 dB mud cut at ~350 Hz, +1.2 dB presence |
| high_gain | 0.22 | 0.42 | 0.35 | 0.40 | 0.55 | 0.72 | 0.54 | 0.0 | Aggressive: -2 dB mud cut, narrower Q, +0.8 dB presence |

**Implementation note:** These are starting-point values. The `LowGain` values below 0.50 represent cuts (0.50 = unity, 0.0 = max cut, 1.0 = max boost). The `HighGain` values above 0.50 represent the presence recovery boost.

### Horizon Gate Parameters (High-Gain Only) -- `HD2_GateHorizonGate`

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Threshold | 0.50 | Moderate threshold; catches amp hiss without choking sustain |
| Decay | 0.40 | Moderate decay; natural note fade without abrupt cutoff |

### Input Block Noise Gate Configuration

The input block (`HlxInput`) has built-in noise gate fields. These are NOT a separate block:

```typescript
// From types.ts HlxInput interface:
{
  noiseGate: true,     // Always enabled on DSP0
  decay: 0.5,          // Moderate decay
  threshold: -48.0,    // dB threshold (already set in preset-builder.ts)
}
```

This is already handled by `buildDsp()` in `preset-builder.ts` (line 96-97). The `chain-rules.ts` module does NOT need to create a separate noise gate block for the input. The Horizon Gate is a separate block for post-amp gating on high-gain presets only.

## Snapshot Engine Details

### Snapshot Roles and Block States

Each snapshot controls: which blocks are on/off, ChVol on the amp block, and Gain on the Volume block.

**Block state table by snapshot role:**

| Block Type | Clean | Rhythm | Lead | Ambient |
|------------|-------|--------|------|---------|
| Boost (Minotaur/808) | OFF (clean) / ON (crunch/hg) | ON | ON | ON |
| Amp | ON | ON | ON | ON |
| Cab | (not in block states) | (not in block states) | (not in block states) | (not in block states) |
| Post-cab EQ | ON | ON | ON | ON |
| Horizon Gate | ON | ON | ON | ON |
| Delay | OFF | OFF | ON | ON |
| Reverb | ON (low mix) | ON (low mix) | ON (medium mix) | ON (high mix) |
| Modulation | OFF | OFF | OFF | ON |
| Gain Block | ON | ON | ON | ON |
| AI-added distortion/drive | OFF | ON | ON | OFF |

**Boost behavior by amp category for Clean snapshot:**
- If ampCategory is "clean": boost is OFF in Clean snapshot (pure clean tone)
- If ampCategory is "crunch": boost is ON in Clean snapshot (the crunch amp's clean is achieved by lower ChVol, not by removing the boost -- but this is a judgment call; alternatively OFF for true clean)
- If ampCategory is "high_gain": boost stays ON (high-gain amps need the boost for tightness even on "clean" snapshot which is really a lower-gain rhythm)

### Volume Balancing

**ChVol overrides by snapshot role (normalized 0.0-1.0):**

| Role | ChVol | Rationale |
|------|-------|-----------|
| clean | 0.68 | Reference level; clean tones need slightly lower volume because they lack compression |
| rhythm (crunch) | 0.72 | Slightly above clean to compensate for perceived loudness of distortion |
| lead | 0.80 | Lead gets volume boost via both ChVol AND Gain Block |
| ambient | 0.65 | Slightly below clean; high reverb/delay mix adds perceived volume |

**Gain Block (Volume block) overrides by snapshot role:**

The Gain Block (`HD2_VolPanGain`) `Gain` parameter is in dB (not normalized). Per param-registry: `Gain: "db_value"` with range -20.0 to +20.0.

| Role | Gain (dB) | Rationale |
|------|-----------|-----------|
| clean | 0.0 | Unity gain |
| rhythm | 0.0 | Unity gain |
| lead | +2.5 | +2-3 dB boost for solo presence |
| ambient | 0.0 | Unity gain |

### LED Colors

From `LED_COLORS` constant in models.ts:

| Role | Color | Value |
|------|-------|-------|
| clean | Blue | 6 |
| rhythm | Orange | 2 |
| lead | Red | 1 |
| ambient | Turquoise | 5 |

### Trails Configuration

All delay and reverb blocks must have `trails: true` set on their `BlockSpec`. This is a field on BlockSpec (line 188 of types.ts). The `preset-builder.ts` already handles writing `@trails: true` to the .hlx output when this field is set (line 147-149).

### Snapshot Parameter Overrides Structure

The `SnapshotSpec.parameterOverrides` uses block keys (e.g., "block0", "block1") mapped to parameter name/value pairs. The existing `buildSnapshot()` in `preset-builder.ts` and `buildControllerSection()` already handle registering snapshot-varying parameters as controllers (controller 19 = SNAPSHOT).

**For ChVol overrides:** The amp block's ChVol must vary across snapshots. This means:
- Each snapshot's `parameterOverrides` includes the amp block key with `{ ChVol: <value> }`
- The controller section automatically registers ChVol as snapshot-controlled (min/max from the range of values across snapshots)

**For Gain Block overrides:** The volume block's Gain must vary across snapshots for lead boost. Same pattern: each snapshot specifies the Gain value, controller section auto-registers it.

### Block Key Mapping

The `snapshot-engine.ts` must produce block keys that match the per-DSP numbering used by `preset-builder.ts`:

- DSP0 blocks are numbered `block0`, `block1`, ... (excluding cab blocks)
- DSP1 blocks are numbered `block0`, `block1`, ... (separate count, excluding cab blocks)
- The snapshot `blockStates` uses `{ dsp0: { block0: true, ... }, dsp1: { block0: true, ... } }` format

The `buildSnapshot()` function in `preset-builder.ts` handles this remapping via `buildBlockKeyMap()`. The snapshot engine should use the same sequential numbering per DSP.

## Integration with Existing Code

### Data Flow End-to-End

```
ToneIntent (from AI planner in Phase 3)
    |
    v
chain-rules.assembleSignalChain(intent)
    |  - Resolves ampName -> AMP_MODELS[ampName]
    |  - Resolves cabName -> CAB_MODELS[cabName]
    |  - Resolves each effect -> DISTORTION_MODELS / DELAY_MODELS / etc.
    |  - Inserts mandatory blocks (boost, EQ, gate, volume)
    |  - Assigns dsp: 0|1, position: N, path: 0
    |  - Sets enabled, stereo, trails
    |  - Parameters left EMPTY ({})
    |
    v
BlockSpec[] (ordered, DSP-assigned, no parameters)
    |
    v
param-engine.resolveParameters(chain, intent)
    |  - For amp: applies category defaults (from tables above)
    |  - For cab: applies Hz LowCut/HighCut + Mic index
    |  - For boost: applies per-category boost values
    |  - For EQ: applies per-category EQ values
    |  - For gate: applies threshold/decay values
    |  - For delay/reverb: uses model defaultParams
    |  - For volume: sets Gain to 0.0 dB (default)
    |  - For AI effects: uses model defaultParams from database
    |
    v
BlockSpec[] (ordered, DSP-assigned, ALL parameters filled)
    |
    v
snapshot-engine.buildSnapshots(chain, intent.snapshots)
    |  - For each SnapshotIntent, determines block states
    |  - Computes ChVol overrides per role
    |  - Computes Gain Block overrides per role
    |  - Sets LED colors per role
    |
    v
SnapshotSpec[] (4 snapshots, volume-balanced)
    |
    v
PresetSpec assembly (in orchestration layer, Phase 4)
    {
      name: <from AI>,
      description: <from AI>,
      tempo: intent.tempoHint ?? 120,
      signalChain: chain,     // from param-engine output
      snapshots: snapshots,    // from snapshot-engine output
    }
    |
    v
buildHlxFile(presetSpec)  // existing, Phase 1
    |
    v
HlxFile JSON (.hlx download)
```

### Model Name Resolution Strategy

The ToneIntent uses human-readable model names as keys (e.g., `"Placater Dirty"`, `"4x12 Cali V30"`, `"Scream 808"`). These are the exact keys in the `AMP_MODELS`, `CAB_MODELS`, and other model record objects.

Resolution in `chain-rules.ts`:

```typescript
const ampModel = AMP_MODELS[intent.ampName];
if (!ampModel) throw new Error(`Unknown amp model: ${intent.ampName}`);

const cabModel = CAB_MODELS[intent.cabName];
if (!cabModel) throw new Error(`Unknown cab model: ${intent.cabName}`);

// For effects, check all model categories
function resolveEffectModel(name: string): HelixModel {
  return DISTORTION_MODELS[name]
    ?? DELAY_MODELS[name]
    ?? REVERB_MODELS[name]
    ?? MODULATION_MODELS[name]
    ?? DYNAMICS_MODELS[name]
    ?? EQ_MODELS[name]
    ?? WAH_MODELS[name]
    ?? VOLUME_MODELS[name]
    ?? (() => { throw new Error(`Unknown effect model: ${name}`); })();
}
```

### BlockSpec Construction

When creating a BlockSpec, these fields must be set:

```typescript
const block: BlockSpec = {
  type: "distortion",           // matches the model category
  modelId: "HD2_DistMinotaur",  // from model.id
  modelName: "Minotaur",        // from model.name
  dsp: 0,                       // 0 or 1
  position: 2,                  // sequential within this DSP's non-cab blocks
  path: 0,                      // always 0 for serial single-path
  enabled: true,                // default enabled state
  stereo: false,                // false for most blocks; true for some delays/reverbs
  trails: false,                // true only for delay and reverb blocks
  parameters: {},               // filled by param-engine
};
```

**Type mapping for BlockSpec.type:** The `type` field determines how `preset-builder.ts` handles the block. Map model categories to BlockSpec types:

| Model Source | BlockSpec.type |
|-------------|---------------|
| `AMP_MODELS` | `"amp"` |
| `CAB_MODELS` | `"cab"` |
| `DISTORTION_MODELS` | `"distortion"` |
| `DELAY_MODELS` | `"delay"` |
| `REVERB_MODELS` | `"reverb"` |
| `MODULATION_MODELS` | `"modulation"` |
| `DYNAMICS_MODELS` | `"dynamics"` |
| `EQ_MODELS` | `"eq"` |
| `WAH_MODELS` | `"wah"` |
| `VOLUME_MODELS` | `"volume"` |

### Stereo Configuration

Most blocks should be `stereo: false`. Delay and reverb blocks that benefit from stereo spread can be `stereo: true`, but this doubles their DSP cost. For safety, start with `stereo: false` for all blocks.

## Common Pitfalls

### Pitfall 1: Minotaur Parameter Name Mismatch

**What goes wrong:** Using "Drive" instead of "Gain" or "Tone" instead of "Treble" for the Minotaur's parameters. The FEATURES.md uses human-readable names, but the .hlx file uses different parameter names.
**Why it happens:** FEATURES.md describes Minotaur with "Drive at 0, Tone at 5, Output at 7" but the actual model uses `Gain`, `Treble`, `Output`.
**How to avoid:** Always use parameter names from `DISTORTION_MODELS["Minotaur"].defaultParams` keys: `Gain`, `Treble`, `Output`.
**Warning signs:** Minotaur boost has no effect on tone in exported preset.

### Pitfall 2: Cab LowCut/HighCut Encoding

**What goes wrong:** Writing normalized 0.0-1.0 values for cab LowCut/HighCut instead of raw Hz values.
**Why it happens:** Every other parameter uses normalized 0-1, so it is natural to assume cab parameters do too.
**How to avoid:** Cab LowCut and HighCut are Hz values (80.0, 8000.0) per `PARAM_TYPE_REGISTRY`. The validator in `validate.ts` catches values < 19.9 for LowCut and < 100.0 for HighCut and corrects them, but the knowledge layer should get this right.
**Warning signs:** Cab block sounds like it has no filtering (all frequencies pass through).

### Pitfall 3: Gain Block dB vs Normalized

**What goes wrong:** Writing 0.0-1.0 for the Gain Block's `Gain` parameter instead of dB values.
**Why it happens:** Most parameters are normalized; the Gain Block is an exception.
**How to avoid:** Per `PARAM_TYPE_REGISTRY`, `Gain` is `"db_value"` with range -20.0 to +20.0. For lead boost: `Gain: 2.5` (dB), not `Gain: 0.625` (normalized).
**Warning signs:** Lead snapshot has barely perceptible or wildly excessive volume change.

### Pitfall 4: Block Position Numbering Across DSPs

**What goes wrong:** Using global sequential numbering instead of per-DSP numbering for block positions.
**Why it happens:** Natural to think block0=first, block1=second across entire chain. But DSP0 and DSP1 each start at position 0.
**How to avoid:** Reset position counter to 0 for each DSP. DSP0 blocks: position 0, 1, 2... DSP1 blocks: position 0, 1, 2...
**Warning signs:** Blocks appear in wrong order or at wrong positions in HX Edit.

### Pitfall 5: Cab Blocks Not Counted in Block Positions

**What goes wrong:** Including cab blocks in the position count or block key numbering.
**Why it happens:** Cabs are in the signal chain array but use separate `cab0` keys in the .hlx file.
**How to avoid:** When calculating positions and block keys, skip cab blocks entirely. They use `cab0`, `cab1` keys and have no `@position` field.
**Warning signs:** All blocks after the cab are shifted one position too high.

### Pitfall 6: Snapshot Block Key Scope

**What goes wrong:** Snapshot blockStates uses keys from the wrong DSP or global numbering.
**Why it happens:** The snapshot needs `{ dsp0: { block0: true }, dsp1: { block0: true } }` but code might produce `{ dsp0: { block5: true } }` using global numbering.
**How to avoid:** The `SnapshotSpec.blockStates` uses flat keys (`block0`, `block1`...) which the `buildSnapshot()` function in preset-builder.ts maps to per-DSP keys using `buildBlockKeyMap()`. The snapshot engine should produce keys that align with this mapping.
**Warning signs:** Snapshot switching has no effect on some blocks.

### Pitfall 7: Forgetting to Add Gain Block for Lead Boost

**What goes wrong:** Lead snapshot volume boost relies on a Gain Block that was never added to the signal chain.
**Why it happens:** Gain Block is not in the ToneIntent effects list; it must be inserted by chain-rules.ts as a mandatory block.
**How to avoid:** chain-rules.ts must always insert a Gain Block at the end of DSP1, just like it always inserts a Parametric EQ.
**Warning signs:** Lead snapshot has same volume as rhythm despite ChVol override.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI generates all parameters | AI selects models only; knowledge layer generates params | This rebuild | Eliminates the #1 cause of mediocre presets |
| Single DSP path | DSP0 + DSP1 split | Already in types.ts | More blocks possible; better DSP utilization |
| No mandatory blocks | Deterministic insertion of boost, EQ, gate | This phase | Every preset gets pro-quality signal chain |
| AI-decided cab settings | Deterministic cab filtering by category | This phase | Eliminates muddy/fizzy presets |
| No snapshots or AI-generated snapshots | Deterministic 4-snapshot generation | This phase | Volume-balanced, performance-ready presets |

## Open Questions

1. **Parametric EQ frequency mapping**
   - What we know: The Parametric EQ uses normalized 0-1 for frequency controls (LowFreq, MidFreq, HighFreq). The default values are LowFreq=0.18, MidFreq=0.40, HighFreq=0.75.
   - What is unclear: The exact Hz-to-normalized mapping for these frequency knobs. Is 0.18 = 80 Hz? Is 0.40 = 400 Hz? The mapping is likely logarithmic, not linear.
   - Recommendation: Use the default values from `EQ_MODELS["Parametric EQ"].defaultParams` as the base and adjust relatively (slightly higher/lower from defaults). This avoids needing the exact Hz mapping. The proposed values in the EQ table above are relative to defaults and should produce the correct tonal effect.

2. **Reverb/Delay Mix overrides in Ambient snapshot**
   - What we know: Ambient snapshot should have higher reverb mix (40-60%) and longer delay feedback. These are per-block parameters that vary by snapshot.
   - What is unclear: Whether Mix and Feedback should be snapshot-overridden or if separate "ambient" model choices handle this.
   - Recommendation: Use snapshot parameter overrides to increase reverb Mix and delay Feedback for the Ambient snapshot. The infrastructure for per-snapshot parameter overrides already exists in `SnapshotSpec.parameterOverrides`.

3. **Effect stereo configuration**
   - What we know: Some delays and reverbs sound better in stereo, but stereo blocks use more DSP.
   - What is unclear: Which specific delay/reverb models benefit most from stereo and what the DSP cost impact is.
   - Recommendation: Default all blocks to `stereo: false` for Phase 2. Stereo optimization can be a v2 enhancement.

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/models.ts` -- Direct inspection of all model IDs, parameter names, and defaultParams
- `src/lib/helix/types.ts` -- BlockSpec, SnapshotSpec, PresetSpec, HlxInput, HlxCab type definitions
- `src/lib/helix/preset-builder.ts` -- buildHlxFile, buildSnapshot, buildDsp implementation details
- `src/lib/helix/param-registry.ts` -- PARAM_TYPE_REGISTRY confirming Hz/dB/normalized encoding
- `src/lib/helix/tone-intent.ts` -- ToneIntentSchema confirming input contract
- `.planning/research/FEATURES.md` -- Expert parameter values, signal chain order, snapshot design rules
- `.planning/research/ARCHITECTURE.md` -- Component boundaries, data flow, anti-patterns

### Secondary (MEDIUM confidence)
- Tonevault.io 250-preset analysis (via FEATURES.md) -- Empirical amp parameter ranges
- Community consensus on cab filtering, post-cab EQ, boost architecture (via FEATURES.md sources)

### Tertiary (LOW confidence)
- Parametric EQ frequency-to-normalized mapping -- Inferred from defaults, not officially documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies; pure TypeScript modules
- Architecture: HIGH -- Linear pipeline with typed boundaries; well-defined function signatures
- Model IDs and parameters: HIGH -- Directly verified from codebase models.ts
- Category parameter values: HIGH -- Research-backed from FEATURES.md (Tonevault analysis, community consensus)
- Parametric EQ normalized-to-Hz mapping: LOW -- Inferred, not officially documented
- Pitfalls: HIGH -- Identified from direct codebase inspection (encoding differences, naming mismatches)

**Research date:** 2026-03-01
**Valid until:** 2026-04-01 (30 days -- stable domain, no external dependency changes expected)
