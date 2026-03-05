# Phase 56: Per-Model Amp Parameter Overrides - Research

**Researched:** 2026-03-05
**Domain:** TypeScript Knowledge Layer — `param-engine.ts` / `models.ts` — Layer 4 override mechanism and amp model metadata enrichment
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AMP-01 | Amps classified by family (Fender, Marshall, Vox, Mesa, etc.) in model metadata | Add `ampFamily` field to `HelixModel` interface in `models.ts`; populate for all 15+ overridden amps |
| AMP-02 | Layer 4 `paramOverrides` mechanism established in `resolveAmpParams()` — applied after category defaults | Add `paramOverrides?: Record<string, number>` to `HelixModel`; apply as 4th step in `resolveAmpParams()` |
| AMP-03 | Per-model parameter overrides for 15+ amps with verified values | Populate `paramOverrides` on target amp entries in `AMP_MODELS`; values confirmed from PITFALLS.md and SUMMARY.md research |
| AMP-04 | Non-master-volume amps get correct Drive=Volume, Master=1.0 strategy | US Deluxe (Fender), Essex A30 (Vox), Matchstick Ch1 (Matchless), WhoWatt 100 (Hiwatt) — non-MV topology uses Drive as volume knob; Master must be 1.0 |
| AMP-05 | Cab affinity data enriched on amp model metadata | `cabAffinity` already fully populated (80/80 amps) — requires verification that 15+ overridden amps have non-empty values |
</phase_requirements>

---

## Summary

Phase 56 is a purely additive modification to `src/lib/helix/models.ts` and `src/lib/helix/param-engine.ts`. No new dependencies, no schema changes, no builder changes. The entire phase is two TypeScript files and one test file.

The core problem is well-understood and documented: `resolveAmpParams()` applies `AMP_DEFAULTS[category]` as Layer 2, which unconditionally overwrites any model-level value for shared keys (Drive, Master, Presence, etc.). Any per-model Drive or Master value placed in `defaultParams` is silently discarded. The fix is to introduce `paramOverrides` as a new optional field on `HelixModel` and apply it as Layer 4 — after all shared layers — so it wins unconditionally.

The most important sequencing constraint for this phase is: **Layer 4 mechanism must be established and unit-tested before any individual override values are added.** This is the documented blocker in STATE.md. The unit test must explicitly confirm that a model with `paramOverrides: { Drive: 0.99 }` produces `Drive: 0.99` in resolved output — not the category default value.

One constraint to watch: the existing `param-engine.test.ts` Test 1 asserts that "US Deluxe Nrm" produces Drive in the range `0.20-0.30`. After this phase, US Deluxe Nrm will have `paramOverrides: { Drive: 0.60, Master: 1.0 }`, making Test 1 fail. That test must be updated to use an amp that does NOT have paramOverrides (e.g., "US Double Nrm" or "Grammatico Nrm") to test category-default behavior.

**Primary recommendation:** Wave 1 = add `paramOverrides` field to `HelixModel` + add Layer 4 to `resolveAmpParams()` + write unit test confirming override survives. Wave 2 = add `ampFamily` field + populate both fields on 15+ amps + update conflicting existing test.

---

## Standard Stack

### Core

No new packages required. All work is TypeScript modifications to existing files.

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/lib/helix/models.ts` | MODIFY | Add `ampFamily` and `paramOverrides` fields to `HelixModel` interface; populate values on 15+ amps |
| `src/lib/helix/param-engine.ts` | MODIFY | Add Layer 4 override application in `resolveAmpParams()` |
| `src/lib/helix/param-engine.test.ts` | MODIFY | Add Layer 4 unit test; update Test 1 to use non-overridden amp |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| vitest | ^4.0.18 | Test runner | Per-task verification: `npx vitest run src/lib/helix/param-engine.test.ts` |

**Installation:** None required — vitest already in devDependencies.

**Test commands:**
```bash
# Quick run (per-task)
npx vitest run src/lib/helix/param-engine.test.ts

# Full suite (per-wave)
npx vitest run
```

---

## Architecture Patterns

### Recommended File Structure (no changes)

```
src/lib/helix/
├── models.ts          # MODIFY: add ampFamily, paramOverrides fields + values on 15+ amps
├── param-engine.ts    # MODIFY: Layer 4 override in resolveAmpParams()
├── param-engine.test.ts  # MODIFY: new test + update conflicting Test 1
└── types.ts           # MODIFY: add AmpFamily type literal union (if needed)
```

### Pattern 1: Layer 4 Override in resolveAmpParams()

**What:** After the existing 3 layers in `resolveAmpParams()`, apply `model.paramOverrides` as an unconditional final pass.

**When to use:** Any time a model needs values that override category defaults for specific keys.

**Current code (3-layer):**
```typescript
// src/lib/helix/param-engine.ts — current resolveAmpParams()
function resolveAmpParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
): Record<string, number> {
  // Layer 1: model defaults
  const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
  const params: Record<string, number> = model
    ? { ...model.defaultParams }
    : { ...block.parameters };

  // Layer 2: category overrides
  const categoryDefaults = AMP_DEFAULTS[ampCategory];
  for (const [key, value] of Object.entries(categoryDefaults)) {
    params[key] = value;
  }

  // Layer 3: topology mid override (high-gain only)
  if (ampCategory === "high_gain" && topology !== "not_applicable") {
    const midOverride = TOPOLOGY_MID[topology];
    if (midOverride !== undefined) {
      params.Mid = midOverride;
    }
  }

  return params;
}
```

**Target code (4-layer):**
```typescript
// src/lib/helix/param-engine.ts — resolveAmpParams() with Layer 4 added
function resolveAmpParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  topology: TopologyTag,
): Record<string, number> {
  // Layer 1: model defaults
  const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
  const params: Record<string, number> = model
    ? { ...model.defaultParams }
    : { ...block.parameters };

  // Layer 2: category overrides
  const categoryDefaults = AMP_DEFAULTS[ampCategory];
  for (const [key, value] of Object.entries(categoryDefaults)) {
    params[key] = value;
  }

  // Layer 3: topology mid override (high-gain only)
  if (ampCategory === "high_gain" && topology !== "not_applicable") {
    const midOverride = TOPOLOGY_MID[topology];
    if (midOverride !== undefined) {
      params.Mid = midOverride;
    }
  }

  // Layer 4: per-model overrides — wins over all shared layers
  // Use null-safe access: model may be undefined for unknown amps
  if (model?.paramOverrides) {
    for (const [key, value] of Object.entries(model.paramOverrides)) {
      params[key] = value;
    }
  }

  return params;
}
```

### Pattern 2: HelixModel Interface Extension

**What:** Add two optional fields to `HelixModel` in `models.ts`.

**Target interface:**
```typescript
// src/lib/helix/models.ts — HelixModel with Phase 56 additions
export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  ampCategory?: AmpCategory;
  topology?: TopologyTag;
  ampFamily?: AmpFamily;        // NEW: AMP-01 — "Fender" | "Marshall" | "Vox" | "Mesa" | ...
  cabAffinity?: string[];
  paramOverrides?: Record<string, number>; // NEW: AMP-02 — Layer 4 overrides applied after category defaults
  defaultParams: Record<string, number>;
  blockType: number;
  stadiumOnly?: boolean;
}
```

**AmpFamily type (in types.ts or inline):**
```typescript
// Add to src/lib/helix/types.ts
export type AmpFamily =
  | "Fender"
  | "Marshall"
  | "Vox"
  | "Mesa"
  | "Matchless"
  | "Hiwatt"
  | "Soldano"
  | "Friedman"
  | "Diezel"
  | "Bogner"
  | "EVH"
  | "PRS"
  | "ENGL"
  | "Revv"
  | "Grammatico"
  | "Line6";
```

### Pattern 3: Unit Test for Layer 4 Survival

**What:** A test that explicitly proves an override value is NOT discarded by category defaults.

**The critical test:**
```typescript
// In param-engine.test.ts — new test confirming Layer 4 mechanism
it("paramOverrides survive category defaults (Layer 4 wins over Layer 2)", () => {
  // US Deluxe Nrm is a clean amp
  // AMP_DEFAULTS.clean.Drive = 0.25 — would win if there were no Layer 4
  // paramOverrides.Drive = 0.60 — must win in Layer 4
  const chain: BlockSpec[] = [
    makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
  ];
  const intent = makeIntent({ ampName: "US Deluxe Nrm" });
  const result = resolveParameters(chain, intent);

  // Layer 4 override must win over AMP_DEFAULTS.clean.Drive (0.25)
  expect(result[0].parameters.Drive).toBe(0.60);
  // Master override also wins over AMP_DEFAULTS.clean.Master (0.95)
  expect(result[0].parameters.Master).toBe(1.0);
});

it("AC30 paramOverrides: Drive 0.60, Master 1.0 survive category defaults", () => {
  const chain: BlockSpec[] = [
    makeBlock({ type: "amp", modelId: "HD2_AmpEssexA30", modelName: "Essex A30" }),
  ];
  const intent = makeIntent({ ampName: "Essex A30" });
  const result = resolveParameters(chain, intent);
  expect(result[0].parameters.Drive).toBe(0.60);
  expect(result[0].parameters.Master).toBe(1.0);
});

it("Cali Rectifire paramOverrides: Drive 0.40, Presence 0.30 survive category defaults", () => {
  const chain: BlockSpec[] = [
    makeBlock({ type: "amp", modelId: "HD2_AmpCaliRectifire", modelName: "Cali Rectifire" }),
  ];
  const intent = makeIntent({ ampName: "Cali Rectifire" });
  const result = resolveParameters(chain, intent);
  expect(result[0].parameters.Drive).toBe(0.40);
  expect(result[0].parameters.Presence).toBe(0.30);
});

it("amps without paramOverrides still use category defaults (no regression)", () => {
  // Grammatico Nrm is crunch, has no paramOverrides
  const chain: BlockSpec[] = [
    makeBlock({ type: "amp", modelId: "HD2_AmpGrammaticoNrm", modelName: "Grammatico Nrm" }),
  ];
  const intent = makeIntent({ ampName: "Grammatico Nrm" });
  const result = resolveParameters(chain, intent);
  // AMP_DEFAULTS.crunch.Drive = 0.50 — no override, category wins
  expect(result[0].parameters.Drive).toBe(0.50);
});
```

### Pattern 4: Existing Test 1 Must Be Updated

**The problem:** Test 1 in `param-engine.test.ts` uses "US Deluxe Nrm" as the generic clean amp example and asserts `Drive` in range `0.20-0.30`. After Phase 56, US Deluxe Nrm will have `paramOverrides: { Drive: 0.60 }`, making Test 1 fail.

**Fix:** Replace US Deluxe Nrm in Test 1 with an amp that will NOT receive paramOverrides — one that should continue demonstrating pure category-default behavior. Good candidates: "US Double Nrm" (Fender Twin), "US Princess" (Fender Princeton), or any amp in the clean category that is not in the 15+ override list. If "US Double Nrm" is also getting overrides, pick one that is not.

**Suggested replacement for Test 1 clean amp:** Use "US Double Nrm" (Fender Twin Reverb) — similar family but not one of the non-master-volume target amps (Twin has a Master volume control). Update the test description to reflect the amp change.

### Anti-Patterns to Avoid

- **Adding overrides to `defaultParams`:** Any Drive/Master added to `defaultParams` is still overwritten by Layer 2. Must use `paramOverrides` for values that need to survive category defaults.
- **Skipping the unit test:** If the unit test is not written BEFORE overrides are added to model entries, there is no guarantee Layer 4 is correctly wired. The test is the only safety net.
- **Adding Agoura-specific keys to paramOverrides on non-Stadium amps:** `paramOverrides` shares the same key namespace as `defaultParams`. Adding Stadium-specific param keys (Jack, ZPrePost, Level) to non-Stadium amp overrides would corrupt non-Stadium presets.
- **Using a bare `model.paramOverrides` access without null check:** If a model is resolved from `block.parameters` (the fallback path), `model` is `undefined` and `model.paramOverrides` throws. Must use `model?.paramOverrides`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-key override priority | Custom priority queue, deep merge strategy | Simple `for...of` loop applying `paramOverrides` after existing layers | The existing pattern in `resolveAmpParams()` is already a flat loop; Layer 4 is one more loop |
| Family classification lookup | Separate `FAMILY_LOOKUP` function | Inline `ampFamily` field on each `HelixModel` entry | Simpler, collocated with model data, no lookup required |
| Override validation | Schema validator for paramOverrides values | Nothing — values are normalized floats, same as defaultParams | Over-engineering; incorrect values produce bad sound, not crashes |

**Key insight:** The override mechanism is architecturally simple — one extra loop at the end of `resolveAmpParams()`. The complexity is entirely in identifying the correct override values per amp model, not in the mechanism itself.

---

## Common Pitfalls

### Pitfall 1: Override Discarded — Wrong Field Name

**What goes wrong:** Developer adds `paramOverrides` to `models.ts` entries but forgets to add the Layer 4 loop in `param-engine.ts`, or adds the loop but accesses `model.paramOverrides` before the model is fetched (accessing `block.modelName` directly before the model lookup).

**Why it happens:** The model is fetched at the top of `resolveAmpParams()` — but the current implementation has two branches: `model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName]`. If `model` is undefined (unknown amp), Layer 4 must not throw.

**How to avoid:** Always use `model?.paramOverrides` (optional chaining). Write and run the Layer 4 unit test before adding any override values.

**Warning signs:** Unit test passes in isolation (the test directly constructs model with paramOverrides) but integration output shows category default value.

---

### Pitfall 2: Existing Test 1 Breaks After Override Values Are Added

**What goes wrong:** Test 1 in `param-engine.test.ts` asserts US Deluxe Nrm Drive range `0.20-0.30`. Once US Deluxe Nrm gets `paramOverrides: { Drive: 0.60 }`, Test 1 fails with "received 0.60, expected >= 0.20 and <= 0.30."

**Why it happens:** Test 1 was written as a category-default range test using US Deluxe Nrm as the representative clean amp. It was not written to test override behavior.

**How to avoid:** Update Test 1 BEFORE adding override values to the model entries. Replace "US Deluxe Nrm" in Test 1 with an amp that is not in the override list. Run full test suite after Test 1 update to confirm it still passes with category defaults, then add the model overrides.

**Warning signs:** `npx vitest run src/lib/helix/param-engine.test.ts` fails after adding paramOverrides to US Deluxe Nrm model entry.

---

### Pitfall 3: Non-Master-Volume Amp Master Value Set Below 1.0

**What goes wrong:** Non-master-volume amps (Fender Deluxe, Vox AC30, Matchless DC-30) have no Master volume knob on the real hardware — the Drive knob IS the volume. Setting Master below 1.0 in the Helix model silently reduces output level and makes the amp sound like it's not fully open. The category default `AMP_DEFAULTS.clean.Master = 0.95` is close but slightly wrong for these amps.

**Why it happens:** The category default was set for the "average clean amp" including amps that DO have Master volume controls. Non-MV amps need Master = 1.0 specifically.

**How to avoid:** For all non-master-volume amp models (US Deluxe Nrm, US Deluxe Vib, US Double Nrm, US Double Vib, US Princess, Essex A30, Essex A15, Matchstick Ch1, WhoWatt 100, Fullerton Nrm), set `paramOverrides: { Master: 1.0 }` (at minimum). Drive overrides are amp-specific.

**Warning signs:** Generated preset with a Fender-style amp sounds quieter or more compressed than expected — Master at 0.95 vs 1.0 is only a 5% difference but adds slightly different response character.

---

### Pitfall 4: Shared Knowledge Layer Regression — 6-Device Test Matrix

**What goes wrong:** `param-engine.ts` is shared across all 6 devices. Adding the Layer 4 loop changes the amp resolution path for every device. If `model?.paramOverrides` access has a bug, it can break amp resolution for all devices simultaneously in production.

**Why it happens:** Developers test the target device (the amp they're tuning) and skip testing Stomp, Pod Go, or Stadium presets with the modified resolver.

**How to avoid:** After adding the Layer 4 loop, run `npx vitest run` (full suite) to confirm all 6 device test paths in `chain-rules.test.ts` and `orchestration.test.ts` still pass. The new loop must be null-safe (`model?.paramOverrides ?? {}` is equivalent to the current pattern).

**Warning signs:** A PR to `param-engine.ts` that only includes `param-engine.test.ts` and no multi-device test coverage.

---

### Pitfall 5: cabAffinity Already Populated — AMP-05 Is Already Done

**What goes wrong:** Developer spends time adding cabAffinity data that already exists, duplicates entries, or changes values that were already correct.

**Why it happens:** The requirement says "cab affinity data enriched on amp model metadata" which sounds like work to do. But direct inspection of `models.ts` confirms all 80 amp model entries already have `cabAffinity` populated with non-empty arrays.

**How to avoid:** Verify before implementing. `grep -c "cabAffinity:" models.ts` returns 80 (matching total amp count). AMP-05 is satisfied by verifying that the 15+ overridden amps all have non-empty `cabAffinity` — no new data needs to be added. The task is verification, not implementation.

**Verification command:**
```bash
# Confirm all target amps have non-empty cabAffinity
node -e "
const m = require('./src/lib/helix/models.ts'); // via ts-node or similar
const targets = ['US Deluxe Nrm','US Deluxe Vib','Essex A30','Essex A15','Matchstick Ch1','WhoWatt 100','Cali Rectifire','Cali IV Lead','PV Panama','Das Benzin Mega','Solo Lead OD','Brit Plexi Nrm','Line 6 2204 Mod','Placater Dirty','Archetype Lead'];
targets.forEach(n => console.log(n, m.AMP_MODELS[n]?.cabAffinity));
"
```

---

## Code Examples

### Layer 4 Addition to resolveAmpParams()

```typescript
// Source: Direct pattern derived from existing resolveAmpParams() in param-engine.ts
// Pattern: identical to Layer 2 loop but applied last (wins over everything)

// Layer 4: per-model overrides — wins over all shared layers (AMP-02)
// null-safe: model may be undefined when amp not found in catalog
if (model?.paramOverrides) {
  for (const [key, value] of Object.entries(model.paramOverrides)) {
    params[key] = value;
  }
}
```

### Model Entry with ampFamily and paramOverrides

```typescript
// Example: US Deluxe Nrm with Phase 56 additions
"US Deluxe Nrm": {
  id: "HD2_AmpUSDeluxeNrm",
  name: "US Deluxe Nrm",
  basedOn: "Fender Deluxe Reverb (Normal)",
  category: "clean",
  ampCategory: "clean" as const,
  topology: "plate_fed" as const,
  ampFamily: "Fender",                         // AMP-01
  cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
  paramOverrides: { Drive: 0.60, Master: 1.0 }, // AMP-02, AMP-04
  blockType: BLOCK_TYPES.AMP,
  defaultParams: { Drive: 0.45, Bass: 0.35, Mid: 0.60, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.7, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.5 },
},
```

---

## Verified Override Values (from PITFALLS.md + SUMMARY.md)

These values have MEDIUM confidence — sourced from community preset analysis (HelixHelp, Tonevault) and cross-verified in multiple research documents. They should be cited in code comments with source.

| Amp Model Name | ampFamily | paramOverrides | Rationale |
|----------------|-----------|----------------|-----------|
| US Deluxe Nrm | Fender | Drive: 0.60, Master: 1.0 | Non-MV amp; Drive IS volume; Master must be open |
| US Deluxe Vib | Fender | Drive: 0.60, Master: 1.0 | Same family/topology as Nrm channel |
| US Double Nrm | Fender | Drive: 0.55, Master: 1.0 | Twin has more headroom; slightly lower Drive |
| US Double Vib | Fender | Drive: 0.55, Master: 1.0 | Same family/topology as Nrm channel |
| US Princess | Fender | Drive: 0.60, Master: 1.0 | Princeton — non-MV, same strategy |
| US Small Tweed | Fender | Drive: 0.60, Master: 1.0 | Champ — single-ended, non-MV |
| Fullerton Nrm | Fender | Drive: 0.55, Master: 1.0 | Bassman has more headroom |
| Essex A30 | Vox | Drive: 0.60, Master: 1.0 | Non-MV AC30; Cut knob handles treble |
| Essex A15 | Vox | Drive: 0.60, Master: 1.0 | Same family as A30 |
| Matchstick Ch1 | Matchless | Drive: 0.55, Master: 1.0 | Matchless DC-30 — Class A non-MV |
| WhoWatt 100 | Hiwatt | Drive: 0.40, Master: 1.0 | Hiwatt has extreme headroom; lower Drive |
| Cali Rectifire | Mesa | Drive: 0.40, Presence: 0.30 | Rectifier — high Drive causes mud; Presence anti-correlated with Drive (Tonevault analysis) |
| Cali IV Lead | Mesa | Drive: 0.50, Presence: 0.35 | Mark IV has tighter EQ than Rectifier |
| Placater Dirty | Friedman | Drive: 0.35, Presence: 0.50 | BE-100 tight; lower Drive than category default |
| Das Benzin Mega | Diezel | Drive: 0.45, Presence: 0.45 | VH4 Mega channel — slightly tighter than category |
| Brit Plexi Nrm | Marshall | Drive: 0.55, Master: 1.0 | Plexi — early Marshall, non-MV topology; Master open |
| Brit Plexi Brt | Marshall | Drive: 0.60, Master: 1.0 | Bright channel needs more input |
| Solo Lead OD | Soldano | Drive: 0.50, Presence: 0.30 | SLO Overdrive — tight; low Presence avoids harshness |

**Note:** The category default for `AMP_DEFAULTS.clean.Drive` is `0.25`. The non-MV amps above need `Drive: 0.55-0.60` because Drive IS their volume knob (no separate Master volume circuit). Setting Drive at 0.25 makes them nearly silent. This is the core "AMP-04: non-master-volume amps get correct Drive=Volume, Master=1.0 strategy" insight.

---

## Current State of models.ts (What Already Exists)

Direct codebase inspection results (2026-03-05):

| Field | Status |
|-------|--------|
| `HelixModel.ampCategory` | EXISTS — all 80 HD2 amps have it populated |
| `HelixModel.topology` | EXISTS — all 80 HD2 amps have it populated |
| `HelixModel.cabAffinity` | EXISTS — all 80 HD2 amps have non-empty arrays |
| `HelixModel.stadiumOnly` | EXISTS — used on Agoura amps |
| `HelixModel.ampFamily` | MISSING — needs to be added (AMP-01) |
| `HelixModel.paramOverrides` | MISSING — needs to be added (AMP-02) |

**AMP-05 is effectively satisfied**: All 80 amps have `cabAffinity` already populated. The phase just needs to verify 15+ of the overridden amps have it (they all do). No new `cabAffinity` data needs to be written.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All model overrides in `defaultParams` | Overrides in `defaultParams` are CLOBBERED by Layer 2 | Identified v4.0 research (2026-03-05) | Any per-model tuning silently discarded |
| 3-layer resolution (default, category, topology) | 4-layer resolution (+ paramOverrides) | Phase 56 (this phase) | Per-model overrides now survive and win |
| No family classification | `ampFamily` field on HelixModel | Phase 56 (this phase) | Planner/prompt enrichment can use family for intelligent guidance |

**No deprecated items** — the existing 3-layer approach is preserved; Layer 4 is purely additive.

---

## Open Questions

1. **Should `ampFamily` go in `types.ts` or inline as a string type in `models.ts`?**
   - What we know: `AmpCategory` and `TopologyTag` are in `types.ts` with JSDoc comments explaining their purpose.
   - What's unclear: AmpFamily may not need to be exported beyond `models.ts` for this phase (it's metadata not used in logic).
   - Recommendation: Add `AmpFamily` type to `types.ts` following the existing pattern for `AmpCategory` and `TopologyTag`. Consistent with project conventions.

2. **Which clean amps in the existing Test 1 replacement are safe (no planned overrides)?**
   - What we know: US Deluxe Nrm gets Drive 0.60 override.
   - What's unclear: Does "US Double Nrm" also get overrides in this phase? (Research says Drive: 0.55, Master: 1.0 — yes, it does.)
   - Recommendation: Use "Grammatico Nrm" (crunch) or "Solo Lead Clean" (clean Soldano) as the Test 1 replacement for testing category-default behavior. "Solo Lead Clean" is clean category and does not appear in the 18-amp override list above. Confirm this choice before implementing.

3. **Do paramOverrides apply to Stadium amps in this phase?**
   - What we know: `resolveAmpParams()` fetches `STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName]`. The Layer 4 loop uses `model?.paramOverrides` — it will apply to Stadium amps if present.
   - What's unclear: Should any Agoura Stadium amps receive paramOverrides in this phase?
   - Recommendation: No — leave STADIUM_AMPS entries without paramOverrides for Phase 56. The Stadium amp parameter work is part of Phase 52/53, not Phase 56. The Layer 4 mechanism should work for both, but no Stadium-specific overrides should be added here.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/helix/param-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AMP-01 | `ampFamily` field present and non-empty on overridden amps | unit (type check) | TypeScript compile: `npx tsc --noEmit` | Existing — passes after interface change |
| AMP-02 | Layer 4 `paramOverrides` applied after category defaults | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Existing file — NEW test to be added in Wave 1 |
| AMP-03 | 15+ amps have override values producing correct Drive/Master | unit (per amp) | `npx vitest run src/lib/helix/param-engine.test.ts` | Existing file — NEW tests to be added in Wave 2 |
| AMP-04 | Non-MV amps get Drive 0.55-0.60, Master 1.0 | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Covered by AMP-02 tests for US Deluxe, AC30 |
| AMP-05 | 15+ overridden amps have non-empty `cabAffinity` | unit (data verification) | `npx vitest run src/lib/helix/param-engine.test.ts` | No test exists — optional smoke check (data already present) |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/helix/param-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before marking phase complete

### Wave 0 Gaps

- [ ] `src/lib/helix/param-engine.test.ts` — add Layer 4 survival test (AMP-02 coverage)
- [ ] `src/lib/helix/param-engine.test.ts` — update Test 1 to use non-overridden amp (avoids conflict with US Deluxe Nrm override)

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/lib/helix/param-engine.ts` — 3-layer resolution strategy, exact code locations, variable names (2026-03-05)
- Direct codebase inspection: `src/lib/helix/models.ts` — `HelixModel` interface, all 80 amp entries, `cabAffinity` coverage verification (2026-03-05)
- Direct codebase inspection: `src/lib/helix/param-engine.test.ts` — all 16 existing tests, Test 1 conflict identification (2026-03-05)
- `.planning/research/PITFALLS.md` — Pitfall 4 (override silently discarded), Pitfall 7 (shared layer regression), Integration Gotcha (paramOverrides in model.defaultParams) — HIGH confidence, sourced from direct param-engine.ts inspection (2026-03-05)
- `.planning/research/SUMMARY.md` — Architecture section: "Layer 4 model.paramOverrides field applied after category defaults"; Key Finding: "AMP-03 sparse override table for top 15+ amps requires Layer 4 first" (2026-03-05)
- `.planning/ROADMAP.md` Phase 56 — Success Criteria with exact numeric values (Drive 0.60, Master 1.0 for US Deluxe; Drive 0.60 Master 1.0 for AC30; Drive 0.40 Presence 0.30 for Rectifier) (2026-03-05)
- `.planning/STATE.md` — Blocker: "Layer 4 paramOverrides mechanism must be established with unit test BEFORE individual model values are added" (2026-03-05)
- `npx vitest run` output — all 16 existing tests pass; confirmed Test 1 uses Drive range 0.20-0.30 for US Deluxe Nrm which will conflict post-override (2026-03-05)

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` Sources section: [HelixHelp Common Amp Settings](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — per-model Drive/Master guidance
- `.planning/research/SUMMARY.md` Sources section: [Tonevault 250-preset analysis](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Drive/Presence anti-correlation for Rectifier-style amps; data-driven
- `.planning/research/SUMMARY.md` Sources section: [Line 6 Community — Gain Staging, Master Volume, Channel Volume](https://line6.com/support/topic/32285-controlling-gain-master-volume-and-channel-volume/) — amp parameter semantics

### Tertiary (LOW confidence)

- Per-amp Drive/Master numeric values for non-master-volume amps listed in the override table above — derived from community preset analysis and HelixHelp; flagged in original SUMMARY.md as requiring hardware validation before encoding

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — direct file inspection of param-engine.ts, models.ts, vitest.config.ts; no new packages
- Architecture: HIGH — exact code locations identified; Layer 4 pattern is direct extension of existing Layer 2 pattern in the same function
- Pitfalls: HIGH — Test 1 conflict confirmed by running tests; Layer 4 discard bug confirmed by reading Layer 2 code; null-safe access requirement confirmed from model lookup code
- Override values: MEDIUM — sourced from prior research documents which cite community analysis; numeric values are well-documented but flag for hardware validation post-implementation

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable TypeScript codebase; no external API dependencies)
