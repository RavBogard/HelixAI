# Phase 72: Effect Combination Logic - Research

**Researched:** 2026-03-06
**Domain:** Deterministic effect interaction rules for Helix signal chain assembly and parameter resolution
**Confidence:** HIGH

## Summary

The HelixTones signal chain pipeline processes effects in three deterministic stages: `assembleSignalChain()` (chain-rules.ts) builds an ordered BlockSpec[] with slot-based ordering and DSP assignment, `resolveParameters()` (param-engine.ts) fills parameters using a layered resolution strategy (model defaults -> paramOverrides -> genre overrides -> tempo override), and `buildSnapshots()` (snapshot-engine.ts) produces role-aware snapshot states. Currently, these stages operate on each effect independently -- there is no inter-effect awareness. Phase 72 adds a fourth conceptual layer: **combination adjustments** that modify parameters or chain structure based on which other effects coexist in the same chain.

The architecture is well-suited for this enhancement. Chain-rules.ts already has the concept of `ChainSlot` ordering and mandatory block insertion/deduplication. Param-engine.ts already has a layered resolution pipeline with clear precedence. The key insight is that combination logic naturally splits into two domains: **structural rules** (which effects to include/exclude, where to place them -- belongs in chain-rules.ts) and **parametric rules** (how to adjust values when effects interact -- belongs in param-engine.ts).

**Primary recommendation:** Add combination rules as a new resolution layer in param-engine.ts (`applyCombinationAdjustments()`) that runs AFTER the existing 4-layer pipeline but BEFORE returning, plus add priority-based truncation logic in chain-rules.ts that replaces the current naive slice-from-end truncation.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMBO-01 | Wah + compressor threshold reduction | Compressors with `Threshold` param are: Deluxe Comp (Threshold: 0.5). When wah detected in chain, reduce Threshold by 0.08-0.10. Implemented in param-engine.ts combination layer. |
| COMBO-02 | High-gain gate before amp, compressor omitted | Gate placement already works (SLOT_ORDER puts horizon_gate at 6, after cab). COMBO-02 requires: (a) add a new "pre_gate" slot at position 2.5 (between extra_drive and boost) for high-gain, (b) omit compressor from high-gain chains. Implemented in chain-rules.ts. |
| COMBO-03 | Priority ordering for budget truncation | Current truncation is `userEffects.length = caps.maxEffectsPerDsp` (naive tail-chop). Replace with priority-aware truncation using effect role + type priority. Implemented in chain-rules.ts. |
| COMBO-04 | Reverb + delay mix balancing | When both delay and reverb present, reduce reverb Mix by 0.05. Delay time does NOT need to account for reverb pre-delay (pre-delay is already set independently by genre). Implemented in param-engine.ts combination layer. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (existing) | Test framework | Already used for all 751 tests |
| zod | (existing) | Schema validation | ToneIntent validation |
| TypeScript | (existing) | Type safety | Existing strict mode |

### Supporting
No new libraries needed. All combination logic is pure TypeScript deterministic code in existing files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Code-based combination rules | Prompt-based AI guidance | Code is deterministic, testable, doesn't bloat system prompt; prompt guidance is fragile and non-verifiable |
| Layered param-engine adjustment | Standalone combiner module | Separate module would duplicate chain inspection logic; param-engine already has the context |

## Architecture Patterns

### Recommended Approach: Two-Domain Split

Effect combination logic naturally divides into two domains that map to existing modules:

```
chain-rules.ts (STRUCTURAL)           param-engine.ts (PARAMETRIC)
--------------------------------       --------------------------------
- Gate placement (before amp)          - Wah+comp threshold reduction
- Compressor omission for high-gain    - Reverb+delay mix balancing
- Priority-based truncation            - Future: drive+amp gain interaction
- Effect inclusion/exclusion
```

### Pattern 1: Priority-Based Effect Truncation (COMBO-03)

**What:** Replace naive `userEffects.length = N` with priority-sorted truncation.
**When to use:** When `userEffects.length > caps.maxEffectsPerDsp`.
**Current code (chain-rules.ts:389-397):**
```typescript
// CURRENT: Naive tail-chop — drops last effects regardless of importance
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
  const dropped = userEffects.length - caps.maxEffectsPerDsp;
  console.warn(
    `[chain-rules] Effect budget exceeded: ${userEffects.length} effects requested, ` +
    `max ${caps.maxEffectsPerDsp} for ${caps.family}. Dropping ${dropped} effect(s): ` +
    userEffects.slice(caps.maxEffectsPerDsp).map(e => e.model.name).join(', ')
  );
  userEffects.length = caps.maxEffectsPerDsp;
}
```

**New approach:** Assign priority scores based on intentRole + block type, sort by priority descending before truncation.

```typescript
// Priority scoring for effect truncation
// Higher score = more likely to survive truncation
const EFFECT_PRIORITY: Record<string, number> = {
  // By intentRole (highest priority)
  always_on: 100,
  toggleable: 50,
  ambient: 30,
};

const TYPE_PRIORITY: Record<string, number> = {
  // By block type — core tone-shaping effects survive
  dynamics: 20, // compressor/gate — essential for signal integrity
  wah: 18,      // expression pedal bound — user expects it
  distortion: 15, // tone coloring
  delay: 12,    // time-based — important for genre
  reverb: 10,   // space — important but reducible
  modulation: 5, // color — least essential, first to go
};
```

### Pattern 2: Combination Parameter Adjustments (COMBO-01, COMBO-04)

**What:** A new function `applyCombinationAdjustments()` that runs after per-block parameter resolution.
**When to use:** Always, as the final step of `resolveParameters()`.
**Where it goes:** In param-engine.ts, called at the end of `resolveParameters()`.

```typescript
// New function in param-engine.ts
function applyCombinationAdjustments(
  chain: BlockSpec[],
  ampCategory: AmpCategory,
): BlockSpec[] {
  // Detect which effect types are present
  const hasWah = chain.some(b => b.type === "wah");
  const hasDelay = chain.some(b => b.type === "delay");
  const hasReverb = chain.some(b => b.type === "reverb");
  const hasCompressor = chain.some(b => b.type === "dynamics" && /* is compressor */);

  return chain.map(block => {
    const params = { ...block.parameters };

    // COMBO-01: Wah + compressor → reduce compressor threshold
    if (hasWah && isCompressor(block)) {
      if ("Threshold" in params && typeof params.Threshold === "number") {
        params.Threshold = Math.max(0.0, params.Threshold - 0.10);
      }
    }

    // COMBO-04: Delay + reverb → reduce reverb mix
    if (hasDelay && block.type === "reverb") {
      if ("Mix" in params && typeof params.Mix === "number") {
        params.Mix = Math.max(0.0, params.Mix - 0.05);
      }
    }

    return { ...block, parameters: params };
  });
}
```

### Pattern 3: High-Gain Gate Positioning (COMBO-02)

**What:** For high-gain amps, the noise gate should be placed BEFORE the amp (pre-amp position), not after the cab (post-cab position as currently implemented).
**Current behavior:** `SLOT_ORDER.horizon_gate = 6` places gate AFTER cab (position 5). This is the existing Horizon Gate behavior for all amps.
**COMBO-02 requirement:** "noise gate is placed before amp" for high-gain tones.

**Critical finding:** The current code places the mandatory Horizon Gate at slot position 6 (after cab). For COMBO-02, we need a NEW gate slot that is before the amp. Two approaches:

**Approach A (Recommended):** Add a `"pre_gate"` ChainSlot with SLOT_ORDER 2.5 (between extra_drive at 2 and boost at 3). When the amp is high_gain, reassign the horizon_gate slot to the pre_gate position.

```typescript
// Modified SLOT_ORDER to include pre-amp gate position
const SLOT_ORDER: Record<ChainSlot, number> = {
  wah: 0,
  compressor: 1,
  extra_drive: 2,
  pre_gate: 2.5,  // NEW: gate before boost/amp for high-gain
  boost: 3,
  amp: 4,
  cab: 5,
  horizon_gate: 6, // Kept for backwards compat but unused when pre_gate active
  eq: 7,
  modulation: 8,
  delay: 9,
  reverb: 10,
  gain_block: 11,
};
```

**Approach B (Simpler):** Just change the horizon_gate slot to position 2.5 (always before amp). This is simpler but changes the gate position for ALL amps, not just high-gain. Since the gate is currently only auto-inserted for high_gain amps anyway (chain-rules.ts:433), this is actually safe.

**Recommendation:** Use Approach B. The Horizon Gate is ONLY auto-inserted when `ampCategory === "high_gain"` (line 433). No clean/crunch chains ever have a mandatory gate. If a user manually adds a gate effect to a clean chain, the `classifyEffectSlot()` function at line 142 routes `category === "gate"` to the `"horizon_gate"` slot regardless. Changing `SLOT_ORDER.horizon_gate` from 6 to a pre-amp position simply moves ALL gates before the amp, which is musically correct for any scenario (gates always make more sense before the amp than after the cab).

**WAIT -- reconsidering.** The current position (after cab, slot 6) is actually the standard post-cab gate position used in Helix. Moving it before the amp would change the sonic character. Let me think about this more carefully.

In real-world Helix usage, noise gates can go:
- **Before the amp** (input gate): Catches noise before amplification. Used in metal/high-gain to prevent amplified noise floor.
- **After the cab** (output gate): Catches any post-amplification noise. Less common but used in some setups.

The COMBO-02 requirement explicitly says "noise gate is placed before amp." This means the requirement is asking for the pre-amp position specifically for high-gain tones. The solution:

**Final recommendation:** Change the slot assignment for the mandatory Horizon Gate specifically in the high-gain insertion code. Instead of assigning slot `"horizon_gate"` (position 6), assign it to a new slot or modify SLOT_ORDER conditionally. The cleanest approach is to change the `slot` in the mandatory block push to `"extra_drive"` (position 2) so it goes before the boost, OR introduce `"pre_gate"` as a new slot specifically for COMBO-02.

Actually, the SIMPLEST approach: just change `SLOT_ORDER.horizon_gate` from 6 to 2.5 (between extra_drive and boost). Since the Horizon Gate is ONLY auto-inserted for high_gain amps, this change only affects high-gain chains. For user-added gates (`classifyEffectSlot` line 142 routes `category === "gate"` to `horizon_gate` slot), they would also move before the amp -- which is the correct position for gates in general.

### Pattern 4: High-Gain Compressor Omission (COMBO-02)

**What:** For high-gain/metal tones, compressor blocks should be omitted or have minimal effect.
**Current behavior:** If the AI includes a compressor in a high-gain chain, it passes through chain-rules untouched.
**Implementation:** In `assembleSignalChain()`, filter out compressor effects when `ampCategory === "high_gain"`:

```typescript
// After resolving user effects, before truncation
if (ampCategory === "high_gain") {
  // COMBO-02: Remove compressor from high-gain chains
  const compressorIdx = userEffects.findIndex(
    e => e.slot === "compressor"
  );
  if (compressorIdx >= 0) {
    console.warn(
      `[chain-rules] COMBO-02: Removing compressor "${userEffects[compressorIdx].model.name}" ` +
      `from high-gain chain — prevents squeezed dynamics`
    );
    userEffects.splice(compressorIdx, 1);
  }
}
```

### Anti-Patterns to Avoid

- **Prompt-based combination rules:** Do NOT add effect interaction guidance to the AI system prompt. The system prompt is already ~5000 tokens per family. Combination logic MUST be deterministic code.
- **Mutating input arrays:** Both chain-rules and param-engine return NEW arrays. Combination adjustments must follow this pattern.
- **Hardcoded model names in combination logic:** Use `block.type`, `model.category`, or `block.slot` for classification -- NOT specific model names like "Deluxe Comp". Model names are brittle.
- **Adjusting params that don't exist on the model:** Not all compressors have a `Threshold` param (Red Squeeze uses `Sensitivity`). Guard with `if ("Threshold" in params)`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Effect type detection | Custom model name matching | `block.type` and `model.category` fields | Already classified in models.ts |
| Chain ordering | Custom sort logic | Existing `SLOT_ORDER` mechanism | Already proven across 751 tests |
| Parameter clamping | Manual min/max | `Math.max(0, Math.min(1, value))` | Standard clamping pattern already used in param-engine |

## Common Pitfalls

### Pitfall 1: Compressor Parameter Heterogeneity
**What goes wrong:** Assuming all compressors have a `Threshold` parameter. They don't.
**Why it happens:** DYNAMICS_MODELS has 7 compressors with DIFFERENT parameter names:
- Deluxe Comp: `Threshold`, Ratio, Attack, Release, Level, Mix
- Red Squeeze: `Sensitivity`, Level (NO Threshold)
- Kinky Comp: `Sensitivity`, Level, Mix (NO Threshold)
- LA Studio Comp: `PeakReduction`, Gain, Mix (NO Threshold)
- 3-Band Comp: `LowThresh`, MidThresh, HighThresh, Level (NO single Threshold)
- Rochester Comp: `Sensitivity`, Level (NO Threshold)
- Opto Comp: `Sensitivity`, Level (NO Threshold)

**How to avoid:** COMBO-01 wah+compressor adjustment must handle multiple parameter names:
- If `Threshold` exists: reduce by 0.10
- If `Sensitivity` exists: reduce by 0.10
- If `PeakReduction` exists: reduce by 0.10
- If `LowThresh`/`MidThresh`/`HighThresh` exist: reduce each by 0.08
**Warning signs:** Tests only use Deluxe Comp and miss Red Squeeze/Kinky Comp.

### Pitfall 2: Breaking Existing Gate Placement Tests
**What goes wrong:** Changing `SLOT_ORDER.horizon_gate` from 6 breaks the existing test: "Horizon Gate is placed after cab and before EQ for high-gain amps" (chain-rules.test.ts:323).
**Why it happens:** The test explicitly asserts `gateIndex > cabIndex`.
**How to avoid:** Update the test assertion to match the new COMBO-02 behavior: gate should be BEFORE amp (and therefore before cab) for high-gain. The test should change to `gateIndex < ampIndex`.
**Warning signs:** Test suite has 751 tests; changing gate position will fail at least 2 tests (gate position test + the block order assertion).

### Pitfall 3: Truncation Order vs. Array Position
**What goes wrong:** Priority-based sorting changes the truncation order but the remaining effects still need to be re-sorted by SLOT_ORDER for correct signal chain positioning.
**Why it happens:** Priority sort and signal chain sort serve different purposes.
**How to avoid:** Sort by priority for truncation (drop lowest priority first), then re-sort by SLOT_ORDER for chain position. Two separate sorts.

### Pitfall 4: Combination Adjustments Interacting with Snapshot Overrides
**What goes wrong:** Param-engine reduces reverb Mix to 0.20, then snapshot-engine's ambient snapshot adds +0.15 AMBIENT_MIX_BOOST. The net effect (0.35) may be too high.
**Why it happens:** Snapshot-engine reads `block.parameters.Mix` as its base value. If combination rules reduce this, the snapshot boost is applied on the reduced base.
**How to avoid:** This is actually correct behavior -- snapshot boost operates on the combination-adjusted base. The AMBIENT_MIX_BOOST of 0.15 on a reduced 0.20 gives 0.35, which is reasonable for an ambient wash.

### Pitfall 5: Pod Go Combination Rules Conflicting with 4-Effect Budget
**What goes wrong:** Combination rules add/remove effects, changing the count. If a rule removes a compressor, the Pod Go gains a slot. If a rule would add a gate, it might exceed the budget.
**Why it happens:** Rules run before or during budget enforcement.
**How to avoid:** Run structural combination rules (compressor omission, gate insertion) BEFORE budget truncation. The truncation is the last step that enforces hard limits.

### Pitfall 6: Reverb Mix Reduction Double-Dipping with Genre Defaults
**What goes wrong:** Metal genre already has reverb Mix: 0.12. Subtracting 0.05 more gives 0.07, which is barely audible.
**Why it happens:** COMBO-04 applies uniformly regardless of genre baseline.
**How to avoid:** Use a floor: `Math.max(0.08, mix - 0.05)`. Or only apply COMBO-04 when `mix > 0.15` (skip reduction for already-low mixes). The success criterion says "at least 0.05 lower" -- so the floor approach works as long as we track which value was the "reverb-only" baseline.

## Code Examples

### Example 1: Detecting Effect Coexistence in Chain

```typescript
// In param-engine.ts — detect what's in the chain
function detectChainContext(chain: BlockSpec[]): ChainContext {
  return {
    hasWah: chain.some(b => b.type === "wah"),
    hasCompressor: chain.some(b =>
      b.type === "dynamics" && isCompressorModel(b.modelId)
    ),
    hasDelay: chain.some(b => b.type === "delay"),
    hasReverb: chain.some(b => b.type === "reverb"),
    hasGate: chain.some(b =>
      b.type === "dynamics" && isGateModel(b.modelId)
    ),
    ampCategory: detectAmpCategoryFromChain(chain),
  };
}

function isCompressorModel(modelId: string): boolean {
  return modelId.startsWith("HD2_Compressor");
}

function isGateModel(modelId: string): boolean {
  return modelId.startsWith("HD2_Gate");
}
```

### Example 2: Compressor Threshold/Sensitivity Reduction (COMBO-01)

```typescript
// COMBO-01: Reduce compressor sensitivity when wah is present
function adjustCompressorForWah(
  params: Record<string, number | boolean>
): Record<string, number | boolean> {
  const adjusted = { ...params };
  const THRESHOLD_KEYS = ["Threshold", "Sensitivity", "PeakReduction"];
  const MULTI_THRESHOLD_KEYS = ["LowThresh", "MidThresh", "HighThresh"];

  for (const key of THRESHOLD_KEYS) {
    if (key in adjusted && typeof adjusted[key] === "number") {
      adjusted[key] = Math.max(0.0, (adjusted[key] as number) - 0.10);
    }
  }
  for (const key of MULTI_THRESHOLD_KEYS) {
    if (key in adjusted && typeof adjusted[key] === "number") {
      adjusted[key] = Math.max(0.0, (adjusted[key] as number) - 0.08);
    }
  }
  return adjusted;
}
```

### Example 3: Priority-Based Truncation (COMBO-03)

```typescript
// Score an effect for truncation priority
function getEffectPriority(pending: PendingBlock): number {
  let score = 0;

  // intentRole scoring
  switch (pending.intentRole) {
    case "always_on": score += 100; break;
    case "toggleable": score += 50; break;
    case "ambient": score += 30; break;
    default: score += 40; break; // no role = moderate priority
  }

  // Block type scoring
  switch (pending.slot) {
    case "wah": score += 18; break;        // EXP-bound, user expects it
    case "compressor": score += 15; break;  // dynamics integrity
    case "extra_drive": score += 12; break; // tone coloring
    case "delay": score += 10; break;       // time-based essential
    case "reverb": score += 8; break;       // space
    case "modulation": score += 5; break;   // first to drop
    default: score += 5; break;
  }

  return score;
}

// In assembleSignalChain, replace naive truncation:
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
  // Sort by priority descending (highest priority = survives)
  userEffects.sort((a, b) => getEffectPriority(b) - getEffectPriority(a));

  const dropped = userEffects.length - caps.maxEffectsPerDsp;
  const droppedEffects = userEffects.slice(caps.maxEffectsPerDsp);
  console.warn(
    `[chain-rules] Effect budget exceeded: dropping ${dropped} lowest-priority effect(s): ` +
    droppedEffects.map(e => `${e.model.name}(${e.intentRole ?? 'none'})`).join(', ')
  );
  userEffects.length = caps.maxEffectsPerDsp;

  // IMPORTANT: Re-sort remaining by SLOT_ORDER for correct signal chain position
  userEffects.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Independent effects | Independent effects (current) | Phase 2 | Each effect has its own params, no interaction |
| No truncation priority | Naive tail-chop (current) | Phase 61 | Last effects in array dropped regardless of importance |
| Gate after cab | Gate after cab (current, slot 6) | Phase 2 | Horizon Gate placed post-cab for all high-gain amps |

**What changes in Phase 72:**
- Independent effects -> Combination-aware parameter adjustments
- Naive tail-chop -> Priority-based truncation
- Gate after cab -> Gate before amp (for high-gain)
- Compressor always included -> Compressor omitted for high-gain

## Resolution Order After Phase 72

The parameter resolution pipeline becomes:

```
1. Model defaultParams (from models.ts)
2. Per-model paramOverrides (INTEL-05)
3. Genre overrides (INTL-01)
4. Tempo override for delay (FX-03)
5. **NEW: Combination adjustments (COMBO-01, COMBO-04)** ← Phase 72
```

The chain assembly pipeline becomes:

```
1. Resolve user effects from ToneIntent
2. **NEW: Omit compressor for high-gain (COMBO-02)** ← Phase 72
3. **NEW: Priority-sort for truncation (COMBO-03)** ← Phase 72
4. Enforce per-device effect limit (truncate lowest priority)
5. Insert mandatory blocks (boost, gate, EQ, gain block)
6. **MODIFIED: Gate placed before amp for high-gain (COMBO-02)** ← Phase 72
7. Sort by SLOT_ORDER
8. Validate DSP limits
9. Assign positions
```

## Implementation Order

The four requirements should be implemented in this order due to dependencies:

1. **COMBO-02 (gate + compressor):** Changes chain structure. Do first because COMBO-01 and COMBO-03 depend on which effects are in the chain.
2. **COMBO-03 (priority truncation):** Changes truncation logic. Do second because it defines which effects survive for COMBO-01/COMBO-04 to adjust.
3. **COMBO-01 (wah + compressor):** Parameter adjustment. Can be done after structure is settled.
4. **COMBO-04 (reverb + delay):** Parameter adjustment. Independent of others, do last.

## Open Questions

1. **Gate position: before boost or before amp?**
   - What we know: COMBO-02 says "before amp." The current signal chain has extra_drive and boost before amp.
   - What's unclear: Should the gate go before ALL pre-amp effects (position 0.5, before wah) or just before the amp specifically (position 3.5, between boost and amp)?
   - Recommendation: Place gate at position 2.5 (after extra drives, before boost). This is the standard metal pedalboard position -- gate goes after the overdrive/distortion but before the amp input. This prevents the gate from cutting off the sustain of the drive pedals.

2. **Should COMBO-02 compressor omission apply to user-specified always_on compressors?**
   - What we know: COMBO-02 says "compressor is omitted or minimal." The user may have deliberately included a compressor with role "always_on."
   - What's unclear: Does "omitted" override user intent?
   - Recommendation: If `intentRole === "always_on"`, keep the compressor but set it to minimal settings (very low Threshold/Sensitivity). If `intentRole === "toggleable"` or `"ambient"`, remove it entirely.

3. **How to verify "at least 0.08 lower" for success criterion 1?**
   - What we know: The success criterion compares "same preset with wah" vs "same preset without wah."
   - What's unclear: Is this a test assertion or a runtime check?
   - Recommendation: Write test cases that generate the same chain with/without wah and compare the Threshold values. The delta should be >= 0.08.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/helix/chain-rules.test.ts src/lib/helix/param-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMBO-01 | Wah+comp threshold reduced | unit | `npx vitest run src/lib/helix/param-engine.test.ts -t "COMBO-01"` | Wave 0 |
| COMBO-02a | Gate before amp for high-gain | unit | `npx vitest run src/lib/helix/chain-rules.test.ts -t "COMBO-02"` | Wave 0 |
| COMBO-02b | Compressor omitted for high-gain | unit | `npx vitest run src/lib/helix/chain-rules.test.ts -t "COMBO-02"` | Wave 0 |
| COMBO-03 | Priority truncation | unit | `npx vitest run src/lib/helix/chain-rules.test.ts -t "COMBO-03"` | Wave 0 |
| COMBO-04 | Reverb mix reduced with delay | unit | `npx vitest run src/lib/helix/param-engine.test.ts -t "COMBO-04"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/helix/chain-rules.test.ts src/lib/helix/param-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green (751+ tests) before verification

### Wave 0 Gaps
- All COMBO-* tests need to be written as new test blocks in existing test files
- No new test files needed -- extend `chain-rules.test.ts` and `param-engine.test.ts`
- No framework changes needed -- vitest already configured

## Key Existing Code Analysis

### Current Truncation Logic (chain-rules.ts:389-397)
The current truncation is positionally naive -- it just chops the array at `maxEffectsPerDsp`. This means if the AI puts reverb first and modulation last, modulation gets dropped even if it has `role: "always_on"`. COMBO-03 fixes this.

### Current Gate Position (chain-rules.ts:184-197)
`SLOT_ORDER.horizon_gate = 6` places gate AFTER cab (5). This is POST-cab gating. COMBO-02 requires PRE-amp gating for high-gain. The change affects only the slot order constant or the slot assignment in the mandatory block insertion.

### Compressor Detection (models.ts:1031-1043)
All 7 compressor models have `category: "compressor"`. All 3 gate models have `category: "gate"`. The Autoswell has `category: "dynamics"`. Model IDs provide a reliable secondary check: compressors start with `HD2_Compressor*`, gates start with `HD2_Gate*`.

### Current Resolution Pipeline (param-engine.ts:331-343)
`resolveParameters()` iterates `chain.map()` calling `resolveBlockParams()` per block. The combination adjustment layer should be applied AFTER this map, as a second pass over the resolved chain. This keeps the existing per-block logic untouched and adds combination awareness as a post-processing step.

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/chain-rules.ts` - Full signal chain assembly logic, slot ordering, truncation, mandatory blocks
- `src/lib/helix/param-engine.ts` - Full parameter resolution pipeline, genre defaults, topology adjustments
- `src/lib/helix/models.ts` - DYNAMICS_MODELS (7 compressors, 3 gates, 1 autoswell) with all parameter names
- `src/lib/helix/types.ts` - BlockSpec type with intentRole field
- `src/lib/helix/device-family.ts` - DeviceCapabilities including maxEffectsPerDsp per family
- `src/lib/helix/snapshot-engine.ts` - AMBIENT_MIX_BOOST interaction with combination adjustments

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` - COMBO-01 through COMBO-04 requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, all existing code
- Architecture: HIGH - Clear two-domain split maps to existing modules
- Pitfalls: HIGH - Thorough analysis of compressor param heterogeneity, test breakage, snapshot interaction
- Implementation order: HIGH - Dependencies between requirements are clear

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable codebase, no external dependency changes expected)
