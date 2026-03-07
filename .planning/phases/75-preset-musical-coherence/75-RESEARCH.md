# Phase 75: Preset Musical Coherence - Research

**Researched:** 2026-03-06
**Domain:** Signal chain coherence, snapshot-engine semantics, quality validation
**Confidence:** HIGH

## Summary

This phase addresses 6 systemic musical coherence issues identified during "Blackbird Arena" analysis where AI-described tonal qualities did not match the actual .hsp output. The root causes span across chain-rules.ts (effect palette balance, reverb insertion), snapshot-engine.ts (boost disambiguation, dynamics type conflation), quality-validate.ts (description cross-validation), and the frontend page.tsx (block label accuracy).

The codebase is well-structured for these changes. Each requirement maps to a specific module with clear boundaries. The most architecturally significant change is COHERE-03 (boost disambiguation) which requires adding a `slot` field to `BlockSpec` -- currently `slot` is only an internal property of `PendingBlock` in chain-rules.ts and is lost before reaching snapshot-engine.ts. The snapshot engine identifies boosts solely by model ID (`BOOST_MODEL_IDS` set), which means user-selected Minotaur/Scream 808 effects are indistinguishable from mandatory boosts.

**Primary recommendation:** Add an optional `slot?: "boost"` field to `BlockSpec` so snapshot-engine can distinguish chain-rules-inserted boosts from AI-selected drives. Split `dynamics` block type handling into compressor vs gate using the existing `category` field on `HelixModel`. All changes are backward-compatible additions to existing modules.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COHERE-01 | Chain-rules enforce effect palette balance -- max 2 user drives; at least 1 time-based effect when clean/ambient snapshots present | chain-rules.ts lines 436-484: add validation after user effect resolution, before truncation. Use intent.snapshots to detect clean/ambient roles |
| COHERE-02 | Reverb soft-mandatory insertion -- auto-insert Plate when ToneIntent has clean/ambient snapshots but no reverb | chain-rules.ts lines 493-554: add after mandatory block insertion (5a-5d), before dedup (step 6). Check maxEffectsPerDsp budget before inserting |
| COHERE-03 | Boost model disambiguation -- snapshot-engine distinguishes mandatory boost (slot="boost") from AI-selected drive | chain-rules.ts line 231: add `slot?: "boost"` to BlockSpec. snapshot-engine.ts line 62: use slot field instead of BOOST_MODEL_IDS for identification |
| COHERE-04 | Dynamics type split -- separate compressor and gate handling in snapshot-engine | snapshot-engine.ts lines 97-99: split `dynamics` check using model category. DYNAMICS_MODELS already has `category: "compressor"` vs `category: "gate"` |
| COHERE-05 | Frontend block label accuracy -- BLOCK_LABEL distinguishes Comp from Gate | page.tsx line 45: change from single `dynamics: "Gate"` to context-aware label using block model category |
| COHERE-06 | ToneIntent-description cross-validation -- warn when description mentions effects not in ToneIntent.effects | quality-validate.ts: add new check function. ToneIntent has `description: z.string().optional()` field available |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type-safe implementation | Project standard |
| Vitest | latest | Test framework | All existing tests use vitest |
| Zod | 3.x | Schema validation | ToneIntent schema validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | - | No new libraries needed | All changes use existing modules |

**Installation:**
```bash
# No new packages needed -- all changes use existing project dependencies
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helix/
  chain-rules.ts       # COHERE-01 (palette balance), COHERE-02 (reverb insertion)
  snapshot-engine.ts    # COHERE-03 (boost disambiguation), COHERE-04 (dynamics split)
  types.ts             # COHERE-03 (add slot? to BlockSpec)
  quality-validate.ts  # COHERE-06 (description cross-validation)
  models.ts            # Reference only (DYNAMICS_MODELS category field)
src/app/
  page.tsx             # COHERE-05 (BLOCK_LABEL update)
```

### Pattern 1: BlockSpec.slot for Boost Disambiguation (COHERE-03)

**What:** Add optional `slot?: "boost"` field to `BlockSpec` so downstream modules can distinguish chain-rules-inserted boost pedals from user-selected drives that happen to be Minotaur/Scream 808.

**When to use:** Any time the snapshot engine needs to know if a distortion block is a mandatory boost vs. a user effect choice.

**Current behavior (broken):**
```typescript
// snapshot-engine.ts line 62 -- identifies boost by model ID alone
const BOOST_MODEL_IDS = new Set([
  "HD2_DistMinotaur",
  "HD2_DistScream808",
]);

// Problem: If user chose Minotaur as an effect (not a boost),
// snapshot-engine still treats it as always-on boost
```

**Fix:**
```typescript
// types.ts -- add to BlockSpec interface
export interface BlockSpec {
  // ... existing fields ...
  slot?: "boost"; // Set by chain-rules for mandatory boost blocks only
}

// chain-rules.ts -- set slot on mandatory boost blocks in buildBlockSpec
// Only mandatory blocks inserted at step 5a get slot="boost"
// User-provided Minotaur/Scream 808 do NOT get slot="boost"

// snapshot-engine.ts -- use slot for identification
const isBoost = entry.block.slot === "boost";
// Fallback for backward compat: also check BOOST_MODEL_IDS when slot is undefined
```

### Pattern 2: Dynamics Category Split (COHERE-04)

**What:** The DYNAMICS_MODELS catalog already distinguishes compressors (`category: "compressor"`) from gates (`category: "gate"`). Snapshot-engine currently treats ALL dynamics blocks identically (always ON). Split into compressor-specific and gate-specific behavior.

**Current behavior (broken):**
```typescript
// snapshot-engine.ts line 97-99
if (block.type === "dynamics") {
  return true; // Always ON for ALL dynamics -- compressors too
}
```

**Fix:**
```typescript
// snapshot-engine.ts -- need to know if dynamics block is compressor or gate
// Option A: Look up model in DYNAMICS_MODELS by modelName to check category
// Option B: Add blockCategory field to BlockSpec (heavier)
// Recommended: Option A -- lightweight lookup, no type changes needed

if (block.type === "dynamics") {
  const model = DYNAMICS_MODELS[block.modelName];
  if (model?.category === "compressor") {
    // Compressor: OFF for high-gain lead/rhythm, ON otherwise
    if (ampCategory === "high_gain" && (role === "lead" || role === "crunch")) {
      return false;
    }
    return true;
  }
  // Gate: always ON (existing behavior)
  return true;
}
```

### Pattern 3: Reverb Soft-Mandatory Insertion (COHERE-02)

**What:** Auto-insert a Plate reverb when the ToneIntent has clean or ambient snapshot roles but no reverb effect was specified by the AI.

**When to use:** After mandatory block insertion (step 5) in chain-rules.ts.

**Key constraint:** Must respect `maxEffectsPerDsp`. If inserting reverb would exceed the budget, log a warning but still insert (reverb is more important than the lowest-priority user effect). The existing COMBO-03 truncation already handles over-budget effects by dropping lowest priority -- reverb should score highly enough to survive.

```typescript
// chain-rules.ts -- after step 5d, before step 6
const hasCleanOrAmbient = intent.snapshots.some(
  s => s.toneRole === "clean" || s.toneRole === "ambient"
);
const hasReverb = userEffects.some(e => e.blockType === "reverb");

if (hasCleanOrAmbient && !hasReverb) {
  const plateModel = REVERB_MODELS["Plate"]!;
  userEffects.push({
    model: plateModel,
    blockType: "reverb",
    slot: "reverb",
    dsp: getDspForSlot("reverb", caps),
    intentRole: "toggleable", // Not always_on -- snapshot engine controls per-role
  });
  console.warn("[chain-rules] COHERE-02: Auto-inserted Plate reverb for clean/ambient snapshots");
}
```

### Pattern 4: Effect Palette Balance (COHERE-01)

**What:** Enforce max 2 user-selected drives in the chain. If more than 2, truncate by priority. Also ensure at least 1 time-based effect (delay or reverb) when clean/ambient snapshots are present (overlaps with COHERE-02 for reverb).

```typescript
// chain-rules.ts -- after step 4 (user effect resolution), before COMBO-02
const userDrives = userEffects.filter(e => e.slot === "extra_drive");
if (userDrives.length > 2) {
  // Keep highest-priority 2 drives, remove the rest
  const sorted = [...userDrives].sort(
    (a, b) => getEffectPriority(b, intent.genreHint) - getEffectPriority(a, intent.genreHint)
  );
  const toDrop = new Set(sorted.slice(2));
  for (let i = userEffects.length - 1; i >= 0; i--) {
    if (toDrop.has(userEffects[i])) {
      console.warn(`[chain-rules] COHERE-01: Dropping excess drive "${userEffects[i].model.name}"`);
      userEffects.splice(i, 1);
    }
  }
}
```

### Pattern 5: Description Cross-Validation (COHERE-06)

**What:** Post-planner quality check that warns when ToneIntent.description mentions effects (reverb, delay, modulation) not present in ToneIntent.effects.

**Where:** quality-validate.ts -- add as a new preset-level structural check.

**Key insight:** This requires the ToneIntent (not just PresetSpec) to be available. Current `validatePresetQuality()` takes `(spec: PresetSpec, caps: DeviceCapabilities)`. Options:
1. Add ToneIntent as optional 3rd parameter to `validatePresetQuality()`
2. Create a separate `validateToneCoherence(intent: ToneIntent)` function
3. Embed description in PresetSpec (it's already there as `spec.description`)

**Recommended: Option 3** -- PresetSpec.description already receives `toneIntent.description` in route.ts line 104. And PresetSpec.signalChain contains all the effects. So we can cross-validate description keywords against signalChain block types without needing ToneIntent at all.

```typescript
// quality-validate.ts
function checkDescriptionEffectCoherence(
  spec: PresetSpec,
  warnings: QualityWarning[],
): void {
  if (!spec.description) return;
  const desc = spec.description.toLowerCase();

  const effectKeywords: Array<[string, BlockSpec["type"]]> = [
    ["reverb", "reverb"],
    ["delay", "delay"],
    ["chorus", "modulation"],
    ["tremolo", "modulation"],
    ["flanger", "modulation"],
    ["phaser", "modulation"],
    ["modulation", "modulation"],
  ];

  for (const [keyword, blockType] of effectKeywords) {
    if (desc.includes(keyword)) {
      const hasEffect = spec.signalChain.some(b => b.type === blockType);
      if (!hasEffect) {
        warnings.push({
          code: "DESC_EFFECT_MISSING",
          severity: "warn",
          message: `Description mentions "${keyword}" but no ${blockType} block in signal chain`,
        });
      }
    }
  }
}
```

### Pattern 6: Frontend Block Label Fix (COHERE-05)

**What:** BLOCK_LABEL map currently shows "Gate" for ALL dynamics blocks. Need to show "Comp" for compressors, "Gate" for gates.

**Current (broken):**
```typescript
// page.tsx line 44-45
const BLOCK_LABEL: Record<string, string> = {
  dynamics: "Gate",  // Wrong for compressors!
  // ...
};
```

**Fix:** Cannot use a simple Record lookup since both compressors and gates have `type: "dynamics"`. Need to check the model name or ID.

```typescript
// page.tsx -- replace static lookup with function
function getBlockLabel(block: BlockSpec): string {
  if (block.type === "dynamics") {
    // Compressor model IDs all start with "HD2_Compressor"
    return block.modelId.startsWith("HD2_Compressor") ? "Comp" : "Gate";
  }
  return BLOCK_LABEL[block.type] || block.type;
}
```

### Anti-Patterns to Avoid

- **Adding new block types for compressor/gate:** The `BlockSpec.type` union (`"dynamics"`) is used throughout preset-builder, validate.ts, and .hlx file generation. Splitting into `"compressor" | "gate"` would be a massive refactor touching 10+ files. Use the existing `category` field on HelixModel or `modelId` prefix instead.

- **Making reverb insertion unconditional:** Only insert reverb when clean/ambient snapshots exist AND no reverb was already specified. Presets with only crunch/lead snapshots (e.g., a metal preset) should not auto-insert reverb.

- **Blocking on COHERE-06 warnings:** Description cross-validation is advisory (logged as QualityWarning). It must NEVER throw or prevent preset generation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Model category lookup | Custom mapping table of model names to categories | `DYNAMICS_MODELS[modelName].category` | Already exists in models.ts, maintained as single source of truth |
| Effect keyword NLP | Regex parsing of description text | Simple `.includes()` substring check | COHERE-06 is advisory -- false positives are acceptable, false negatives are not. Simple keyword match catches the important cases |
| Boost model identification | New BOOST_MODELS constant | `slot?: "boost"` on BlockSpec | Adding slot field is cleaner than maintaining a parallel model ID set |

**Key insight:** The DYNAMICS_MODELS catalog already has perfect `category` annotations ("compressor" vs "gate" vs "dynamics"). Use this existing data rather than building new classification logic.

## Common Pitfalls

### Pitfall 1: Breaking BOOST_MODEL_IDS backward compatibility
**What goes wrong:** Removing `BOOST_MODEL_IDS` check from snapshot-engine breaks presets generated before the `slot` field existed.
**Why it happens:** Existing PresetSpec objects serialized without `slot` field.
**How to avoid:** Keep BOOST_MODEL_IDS as fallback: `const isBoost = entry.block.slot === "boost" || (!entry.block.slot && BOOST_MODEL_IDS.has(entry.block.modelId))`. This handles both old and new presets.
**Warning signs:** Snapshot tests fail with "boost not enabled" for clean amps.

### Pitfall 2: Reverb auto-insertion exceeding DSP block limit
**What goes wrong:** Auto-inserting reverb pushes total effects past maxEffectsPerDsp, causing either a DSP block limit error or unexpected truncation of user effects.
**Why it happens:** COHERE-02 insertion happens after user effects are counted but before COMBO-03 truncation.
**How to avoid:** Insert the reverb into userEffects BEFORE the COMBO-03 truncation step. The priority-based truncation will handle budget overflow naturally -- reverb scores highly for ambient/worship genres (score=20), so it survives truncation in the genres where it matters most.
**Warning signs:** Pod Go/Stomp presets crash with "block limit exceeded" when auto-reverb is inserted.

### Pitfall 3: Minotaur/Scream 808 as user effect getting always-on behavior
**What goes wrong:** User explicitly chooses Minotaur as a drive effect (not boost), but snapshot-engine treats it as always-on boost because of BOOST_MODEL_IDS match.
**Why it happens:** Current code identifies boost by model ID, not by insertion source.
**How to avoid:** The `slot` field on BlockSpec solves this. Mandatory boosts get `slot: "boost"`, user-selected Minotaur/Scream 808 do not.
**Warning signs:** Clean snapshot has Minotaur ON when user wanted it as a toggleable drive.

### Pitfall 4: Compressor toggle breaking non-high-gain presets
**What goes wrong:** COHERE-04 compressor toggle logic accidentally affects clean/crunch presets where compressor should stay ON.
**Why it happens:** Implementing "compressor OFF for high-gain lead" but conditioning on wrong variables.
**How to avoid:** The toggle rule is: compressor OFF only when `ampCategory === "high_gain" AND (role === "lead" || role === "crunch")`. Clean amps with compressors should keep them ON in all snapshots.
**Warning signs:** Blues preset loses sustain in rhythm snapshot because compressor toggles off.

### Pitfall 5: Frontend label function not receiving full block data
**What goes wrong:** The `getBlockLabel()` function needs `modelId` but the rendering context only passes `block.type`.
**Why it happens:** BLOCK_LABEL was designed as a simple type-to-string map.
**How to avoid:** Check the page.tsx rendering context -- the block object with `modelId` is available at lines 88-95 where BLOCK_LABEL is used. Pass the full block object to the label function.
**Warning signs:** All dynamics blocks still show "Gate" after the fix.

### Pitfall 6: COHERE-01 drive limit conflicting with boost insertion
**What goes wrong:** User has 2 drives + chain-rules inserts mandatory Minotaur boost = 3 distortion blocks, triggering the 2-drive limit.
**Why it happens:** COHERE-01 counts "user-selected drives" but mandatory boost is also blockType "distortion".
**How to avoid:** COHERE-01 drive limit must only count `slot === "extra_drive"` blocks, NOT `slot === "boost"` blocks. The boost is mandatory infrastructure, not a user drive choice.
**Warning signs:** Mandatory Minotaur boost gets dropped as "excess drive".

## Code Examples

### Example 1: Current boost identification in snapshot-engine (line 229)
```typescript
// Source: snapshot-engine.ts line 229
const isBoost = BOOST_MODEL_IDS.has(entry.block.modelId);
```

### Example 2: Current dynamics handling (always ON for all dynamics)
```typescript
// Source: snapshot-engine.ts lines 97-99
if (block.type === "dynamics") {
  return true; // BUG: compressors should toggle off in high-gain snapshots
}
```

### Example 3: DYNAMICS_MODELS category annotations (already exist)
```typescript
// Source: models.ts lines 1031-1043
"Deluxe Comp":  { ..., category: "compressor", ... },
"LA Studio Comp": { ..., category: "compressor", ... },
"Noise Gate":   { ..., category: "gate", ... },
"Hard Gate":    { ..., category: "gate", ... },
"Horizon Gate": { ..., category: "gate", ... },
"Autoswell":    { ..., category: "dynamics", ... }, // Neither comp nor gate
```

### Example 4: BLOCK_LABEL map (current, needs update)
```typescript
// Source: page.tsx line 44-45
const BLOCK_LABEL: Record<string, string> = {
  dynamics: "Gate",  // Shows "Gate" for compressors too!
  distortion: "Drive",
  amp: "Amp",
  // ...
};
```

### Example 5: ToneIntent.description field (available for COHERE-06)
```typescript
// Source: tone-intent.ts line 47
description: z.string().optional(),

// Source: route.ts line 104
description: toneIntent.description || `${toneIntent.genreHint || ""} preset using ${toneIntent.ampName}`.trim(),
```

### Example 6: Mandatory boost insertion (current, no slot tagging)
```typescript
// Source: chain-rules.ts lines 498-518
if (ampCategory === "clean" || ampCategory === "crunch") {
  if (!userEffectNames.has(MINOTAUR)) {
    mandatoryBlocks.push({
      model: boostModel,
      blockType: "distortion",
      slot: "boost",  // Internal PendingBlock field -- NOT propagated to BlockSpec
      dsp: 0,
    });
  }
}
```

### Example 7: buildBlockSpec loses slot info
```typescript
// Source: chain-rules.ts lines 211-233
function buildBlockSpec(pending: PendingBlock, ...): BlockSpec {
  return {
    type: pending.blockType,
    modelId: pending.model.id,
    // ... other fields ...
    // NOTE: pending.slot is NOT copied to BlockSpec
    // NOTE: pending.intentRole IS copied (line 232)
    ...(pending.intentRole ? { intentRole: pending.intentRole } : {}),
    // MISSING: ...(pending.slot === "boost" ? { slot: "boost" } : {}),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All dynamics always ON | Should split compressor/gate behavior | Phase 75 | COHERE-04: compressors toggle off for high-gain lead/rhythm |
| Boost = model ID match | Should use slot field on BlockSpec | Phase 75 | COHERE-03: user-selected Minotaur follows drive toggle rules |
| No reverb safety net | Should auto-insert Plate for clean/ambient | Phase 75 | COHERE-02: prevents "described reverb, no reverb in chain" |
| BLOCK_LABEL blanket "Gate" | Should distinguish Comp vs Gate | Phase 75 | COHERE-05: accurate frontend labels |

**Deprecated/outdated:**
- `BOOST_MODEL_IDS` in snapshot-engine.ts: Will become a fallback mechanism. Primary identification should use `slot === "boost"`.

## Open Questions

1. **Autoswell handling in COHERE-04**
   - What we know: Autoswell has `category: "dynamics"` (neither "compressor" nor "gate")
   - What's unclear: Should Autoswell follow compressor toggle rules, gate rules, or its own rules?
   - Recommendation: Treat Autoswell as a special case -- always ON (like current behavior). It's a volume swell effect, not a dynamics processor.

2. **COHERE-02 reverb model selection based on genre**
   - What we know: Phase description says "Plate default". Genre-specific reverb could be better (Spring for blues, Hall for ambient).
   - What's unclear: Whether to use genreHint to pick the reverb model or always default to Plate.
   - Recommendation: Use Plate as the default since the phase requirement specifies "Plate default". This is a simple rule that handles 90% of cases. Genre-specific reverb selection can be a future enhancement.

3. **COHERE-01 interaction with dual-amp preset limits**
   - What we know: Dual-amp already limits user effects to 2 (chain-rules.ts line 489). COHERE-01 max 2 drives is a different constraint (max 2 of type drive, not max 2 total).
   - What's unclear: Whether COHERE-01 should apply before or after dual-amp truncation.
   - Recommendation: Apply COHERE-01 before dual-amp truncation, since it's about effect palette balance, not DSP budget.

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/chain-rules.ts` -- Complete read, 678 lines. Slot system, boost insertion, effect truncation logic.
- `src/lib/helix/snapshot-engine.ts` -- Complete read, 303 lines. Block state table, BOOST_MODEL_IDS, dynamics handling.
- `src/lib/helix/types.ts` -- Complete read, 314 lines. BlockSpec interface, no slot field currently.
- `src/lib/helix/param-engine.ts` -- Complete read, 672 lines. Parameter resolution, genre defaults, combination adjustments.
- `src/lib/helix/quality-validate.ts` -- Complete read, 272 lines. QualityWarning pattern, non-throwing guarantee.
- `src/lib/helix/models.ts` -- Partial read (DYNAMICS_MODELS, REVERB_MODELS, HelixModel interface). Category field confirmed on all dynamics models.
- `src/lib/helix/tone-intent.ts` -- Complete read, 116 lines. ToneIntent schema, description field, SnapshotIntent toneRole.
- `src/app/page.tsx` -- Partial read (BLOCK_LABEL map, rendering context). Block object available at label render site.
- `src/lib/helix/device-family.ts` -- Partial read. maxEffectsPerDsp values per device.
- `src/app/api/generate/route.ts` -- Partial read (lines 1-130). Pipeline flow, quality validation integration point.

### Test Files (HIGH confidence)
- `src/lib/helix/chain-rules.test.ts` -- Complete read, 1119 lines. Test patterns, helper functions.
- `src/lib/helix/snapshot-engine.test.ts` -- Complete read, 362 lines. Test patterns, findBlockKey helper.
- `src/lib/helix/quality-validate.test.ts` -- Complete read, 437 lines. makeBlock/makePreset helpers, warning assertion patterns.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All code examined directly, no external dependencies needed
- Architecture: HIGH -- Clear module boundaries, existing patterns to follow
- Pitfalls: HIGH -- Derived from direct code analysis of interaction points
- Code examples: HIGH -- All examples are direct source code excerpts with line numbers

**Research date:** 2026-03-06
**Valid until:** Indefinite (internal codebase research, not external library versions)
