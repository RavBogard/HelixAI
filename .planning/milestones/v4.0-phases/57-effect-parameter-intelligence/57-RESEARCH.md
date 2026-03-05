# Phase 57: Effect Parameter Intelligence - Research

**Researched:** 2026-03-05
**Domain:** TypeScript Knowledge Layer — `param-engine.ts`, `snapshot-engine.ts` — wiring ToneIntent fields into deterministic parameter resolution
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FX-01 | Guitar-type EQ shaping uses guitarType from ToneIntent to adjust post-cab EQ curves | `guitarType` exists in `ToneIntent` (single_coil/humbucker/p90); `EQ_PARAMS` in `param-engine.ts` currently keyed only by `AmpCategory`; needs a second dimension added |
| FX-02 | Reverb PreDelay set per genre category (20-60ms range) to preserve note attack | `PreDelay` already exists as a key in all reverb model `defaultParams` (values 0.01-0.05); `GENRE_EFFECT_DEFAULTS` reverb entries lack `PreDelay`; adding it is a single table extension |
| FX-03 | Delay time calculated from tempoHint in ToneIntent (60000/BPM formula) | `tempoHint` exists in `ToneIntent` (int, 60-200 BPM optional); `resolveDefaultParams()` in `param-engine.ts` currently ignores `intent`; needs `intent` passed through to apply tempo override on delay blocks |
| FX-04 | Snapshot ChVol deltas per toneRole — leads louder than cleans by default | `ROLE_CHVOL` already exists in `snapshot-engine.ts` with lead=0.80, clean=0.68; **FX-04 is already implemented**; Phase 56 dependency is for the `paramOverrides` mechanism in `param-engine.ts`, not in `snapshot-engine.ts`; the success criterion (lead ChVol > clean) is already satisfied |
</phase_requirements>

---

## Summary

Phase 57 wires three underused ToneIntent fields — `guitarType`, `tempoHint`, and (implicitly) `toneRole` — into the Knowledge Layer. All four requirements touch only `param-engine.ts` and `snapshot-engine.ts`, with no schema changes, no new dependencies, and no builder changes. The work is entirely additive — new lookup tables, a new dimension on an existing table, and a conditional override path in `resolveDefaultParams()`.

The critical discovery from codebase inspection: **FX-04 is already implemented**. `snapshot-engine.ts` already has `ROLE_CHVOL` with `lead: 0.80` and `clean: 0.68`, satisfying the success criterion ("Lead snapshot has ChVol higher than Clean"). The Phase 56 dependency documented in the roadmap refers to `paramOverrides` in `param-engine.ts` for amp overrides — it has no functional dependency on `snapshot-engine.ts` volume balancing. Phase 57 can implement FX-01, FX-02, and FX-03 without waiting for Phase 56. FX-04 requires only verification of existing behavior, not new code.

The three remaining requirements (FX-01, FX-02, FX-03) are all small, isolated, additive changes. FX-02 is the simplest: add `PreDelay` to each of the 9 `GENRE_EFFECT_DEFAULTS` reverb entries — `PreDelay` is already a confirmed valid key (all reverb models in `models.ts` have it in `defaultParams`). FX-03 requires passing `intent` down through `resolveBlockParams()` to `resolveDefaultParams()` for delay blocks, then computing `60000 / bpm / 2000` when `tempoHint` is present. FX-01 requires extending `EQ_PARAMS` with a `guitarType` dimension and routing through `resolveEqParams()`.

**Primary recommendation:** Implement FX-02 (PreDelay) and FX-03 (tempo delay) together in Wave 1 (both touch `param-engine.ts`), then FX-01 (guitar EQ) in Wave 2 (also `param-engine.ts`), then FX-04 verification in Wave 3 (snapshot test). No file other than `param-engine.ts`, `param-engine.test.ts`, and `snapshot-engine.test.ts` needs to change.

---

## Standard Stack

### Core

No new packages required. All work is TypeScript modifications to existing files.

| File | Change Type | Purpose |
|------|-------------|---------|
| `src/lib/helix/param-engine.ts` | MODIFY | FX-01: add guitarType dimension to EQ_PARAMS; FX-02: add PreDelay to GENRE_EFFECT_DEFAULTS reverb entries; FX-03: pass intent through resolveBlockParams() to resolveDefaultParams() for tempo override |
| `src/lib/helix/param-engine.test.ts` | MODIFY | Add tests for FX-01, FX-02, FX-03 behaviors |
| `src/lib/helix/snapshot-engine.test.ts` | MODIFY | Add FX-04 test verifying lead ChVol > clean ChVol (already implemented, just needs a test to lock the behavior) |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| vitest | ^4.0.18 | Test runner | Per-task: `npx vitest run src/lib/helix/param-engine.test.ts` |

**Test commands:**
```bash
# Per-task (quick)
npx vitest run src/lib/helix/param-engine.test.ts
npx vitest run src/lib/helix/snapshot-engine.test.ts

# Per-wave (full suite)
npx vitest run
```

---

## Architecture Patterns

### Recommended File Structure (no changes)

```
src/lib/helix/
├── param-engine.ts          # MODIFY: EQ_PARAMS dimensions, GENRE_EFFECT_DEFAULTS PreDelay, intent threading
├── param-engine.test.ts     # MODIFY: new tests for FX-01, FX-02, FX-03
└── snapshot-engine.test.ts  # MODIFY: new test for FX-04 (verifies existing ROLE_CHVOL behavior)
```

### Pattern 1: FX-01 — Guitar-Type EQ Dimension on EQ_PARAMS

**What:** The `EQ_PARAMS` table in `param-engine.ts` is currently indexed only by `AmpCategory`. Adding a `guitarType` dimension produces different EQ curves for single-coil vs humbucker guitars after the amp's post-cab parametric EQ block.

**When to use:** Whenever `intent.guitarType` is present and the block is a parametric EQ.

**Key insight from codebase:** `resolveEqParams()` already receives `ampCategory` and dispatches on `modelId`. The `guitarType` value must be passed to this function. The simplest approach is to add `guitarType` as an optional parameter to `resolveBlockParams()` and thread it from `resolveParameters()`.

**Physical justification:**
- Single-coil pickups have stronger high frequencies and weaker low-mids; need a slight high-mid cut and low-end emphasis
- Humbuckers have stronger low-mids and can be muddier; need a low-mid cut and presence boost
- P90s are between the two — mid-forward with some single-coil brightness

**Recommended EQ delta values (additive to AmpCategory baseline):**

```typescript
// Source: FEATURES.md Finding 1 (MEDIUM confidence — community analysis)
// Applied on top of EQ_PARAMS[ampCategory] baseline
const EQ_GUITAR_TYPE_ADJUST: Record<string, Partial<Record<string, number>>> = {
  single_coil: {
    // Slight brightness cut (single coils can be sharp), low-mid fill
    LowGain: +0.03,    // Slight low-end fill for thin single coils
    MidGain: +0.02,    // Slight mid fill
    HighGain: -0.02,   // Tame harshness
  },
  humbucker: {
    // Low-mid cut (humbuckers are thick), presence recovery
    LowGain: -0.03,    // Cut low-mud from thick humbuckers
    MidGain: -0.03,    // Cut low-mid mud
    HighGain: +0.03,   // Recover presence lost to humbucker warmth
  },
  p90: {
    // Minimal adjustment — p90 is balanced between the two
    MidGain: -0.01,    // Very slight mid tuck
    HighGain: +0.01,   // Slight brightness
  },
};
```

**Implementation approach in `resolveEqParams()`:**

```typescript
// Source: direct codebase analysis of param-engine.ts
function resolveEqParams(
  block: BlockSpec,
  ampCategory: AmpCategory,
  guitarType?: string,  // NEW parameter
): Record<string, number> {
  if (block.modelId === "HD2_EQParametric") {
    const base = { ...EQ_PARAMS[ampCategory] };
    if (guitarType && EQ_GUITAR_TYPE_ADJUST[guitarType]) {
      const adj = EQ_GUITAR_TYPE_ADJUST[guitarType];
      for (const [key, delta] of Object.entries(adj)) {
        if (key in base) {
          base[key] = Math.max(0, Math.min(1, base[key] + delta));
        }
      }
    }
    return base;
  }
  return resolveDefaultParams(block);
}
```

**Threading:** `guitarType` must be extracted from `intent` in `resolveParameters()` and passed through `resolveBlockParams()` to `resolveEqParams()`. The existing `resolveBlockParams()` signature already receives everything it needs structurally; this adds one more optional parameter.

### Pattern 2: FX-02 — PreDelay Addition to GENRE_EFFECT_DEFAULTS

**What:** Add `PreDelay` to each of the 9 reverb entries in `GENRE_EFFECT_DEFAULTS`. Values are in the same normalized range as other reverb model `defaultParams` (0.0-1.0, where the confirmed values in `models.ts` range from 0.01 to 0.05 for real reverb presets). The success criteria specify ms ranges; the model encoding is normalized seconds.

**Confirmed fact from codebase:** `PreDelay` is a valid key in ALL reverb model `defaultParams` in `models.ts`. Plate=0.02, Room=0.01, Hall=0.03, Chamber=0.02, Glitz=0.03, Ganymede=0.05, Particle Verb=0.03, Ducking=0.03. The key is confirmed real — no verification step needed.

**Normalization:** PreDelay in Helix uses raw seconds (not normalized 0-1). 0.02 = 20ms, 0.05 = 50ms. This is consistent with the model database values already in place.

**The existing `resolveDefaultParams()` already applies genre overrides to PreDelay if it's a key in the model's params.** Since all reverb models have PreDelay in defaultParams, adding PreDelay to GENRE_EFFECT_DEFAULTS reverb entries will automatically work through the existing override pipeline — zero logic changes required.

**Recommended values by genre:**

```typescript
// Source: FEATURES.md Finding 3 (HIGH confidence — iZotope professional audio documentation)
// Values match success criteria: blues 20-30ms, ambient 40-60ms
const GENRE_EFFECT_DEFAULTS additions (reverb.PreDelay):
  blues:   0.025  // 25ms — preserves pick attack on clean/crunch; natural note separation
  rock:    0.020  // 20ms — tight, punchy; reverb adds air without smearing
  metal:   0.010  // 10ms — very tight; reverb as ambience only, not bloom
  jazz:    0.030  // 30ms — room character with clear note definition
  country: 0.020  // 20ms — tight spring-style; clear twang attack
  ambient: 0.045  // 45ms — long pre-delay separates guitar from reverb tail dramatically
  worship: 0.035  // 35ms — "swells into" the reverb tail; worship standard
  funk:    0.015  // 15ms — tight; clean articulation required for choppiness
  pop:     0.025  // 25ms — commercial radio standard; articulate with depth
```

**Implementation:** Single table modification — no logic changes. The existing `resolveDefaultParams()` already applies genre reverb overrides to PreDelay via the `if (key in params)` guard.

### Pattern 3: FX-03 — Tempo-Synced Delay via tempoHint

**What:** When `intent.tempoHint` is present (a BPM integer), compute the delay `Time` value from the BPM formula instead of using the model default or genre default. The formula is: `Time = 60000 / BPM / 2000` for a quarter note at Helix's max 2000ms range. For dotted-eighth (the worship/rock standard): `Time = 60000 / BPM * 0.75 / 2000`.

**Confirmed from codebase:** Delay Time in `models.ts` is normalized 0-1 where 1.0 = 2000ms (confirmed from comment in `param-engine.ts` line 131: "Delay Time: 0.0-1.0 (0.375 ≈ 375ms)", and 375/2000 = 0.1875 which does not match... but the models show `Time: 0.375` as the default, and `0.375 * 2000 = 750ms` which is dotted-quarter at ~80BPM — inconsistent. The comment and formula in FEATURES.md suggests dividing by 2000. Verify: 120 BPM quarter note = 500ms; 500/2000 = 0.25. The success criterion says "120 BPM produces delay time approximately 0.25" — this **confirms** the normalization is /2000 and the target subdivision is quarter note.

**Formula for quarter note:** `normalizedTime = 60000 / BPM / 2000 = 30 / BPM`

Examples:
- 120 BPM quarter note: 30/120 = 0.25 (matches success criterion exactly)
- 100 BPM quarter note: 30/100 = 0.30
- 80 BPM quarter note: 30/80 = 0.375 (matches existing default — no-BPM fallback is ~80BPM quarter)
- 120 BPM dotted-eighth: 60000/120 * 0.75 / 2000 = 375/2000 = 0.1875

**Default subdivision:** Use quarter note for the general case. The dotted-eighth is a genre-specific choice — for worship/rock presets the genre hint already suggests it. Keep the formula simple: quarter note by default.

**Threading challenge:** `resolveDefaultParams()` currently receives only `block` and `genreProfile`. It does NOT receive `intent`. To apply tempo override, `intent.tempoHint` must be threaded down. Options:

1. **Add `tempoHint?: number` parameter to `resolveDefaultParams()`** — minimal signature change, clean, testable
2. **Apply tempo override in `resolveParameters()` as a post-processing pass** — avoids modifying `resolveDefaultParams()` but adds a second loop over the chain
3. **Add `intent` to `resolveBlockParams()` signature** — broader change, may be needed for guitarType anyway

**Recommended: Option 1** — add `tempoHint?: number` to `resolveDefaultParams()`. Since FX-01 also requires threading `guitarType` through `resolveBlockParams()`, it is cleaner to pass both as optional parameters to `resolveBlockParams()` and onwards.

**Dual Delay edge case:** `models.ts` shows Dual Delay uses `"Left Time"` and `"Right Time"` keys (with spaces), not `Time`. If `tempoHint` is present and the delay model is Dual Delay, the override should apply to `"Left Time"` (primary channel). Right Time can remain at its offset.

```typescript
// Source: direct codebase inspection of models.ts line 907
// "Dual Delay" defaultParams: { "Left Time": 0.375, "Right Time": 0.25, ... }
// Override strategy: set Left Time to tempo-synced value; Right Time = Left Time * 0.75 (dotted-eighth offset)
```

**Implementation in `resolveDefaultParams()`:**

```typescript
// Source: FEATURES.md Finding 3 formula + success criterion confirmation
function resolveDefaultParams(
  block: BlockSpec,
  genreProfile?: GenreEffectProfile,
  tempoHint?: number,  // NEW: BPM from intent.tempoHint
): Record<string, number> {
  const model = findModel(block.modelName, block.type);
  const params = model ? { ...model.defaultParams } : { ...block.parameters };

  // Apply genre overrides as outermost layer (existing)
  if (genreProfile) {
    const genreOverrides = genreProfile[block.type as keyof GenreEffectProfile];
    if (genreOverrides) {
      for (const [key, value] of Object.entries(genreOverrides)) {
        if (key in params) params[key] = value;
      }
    }
  }

  // Apply tempo-synced delay override (outermost — overrides genre Time)
  if (tempoHint && block.type === "delay") {
    const quarterNoteTime = 30 / tempoHint; // 60000/BPM/2000 simplified
    const clamped = Math.max(0.01, Math.min(1.0, quarterNoteTime));
    if ("Time" in params) {
      params.Time = clamped;
    }
    // Dual Delay special case
    if ("Left Time" in params) {
      params["Left Time"] = clamped;
      params["Right Time"] = Math.min(1.0, clamped * 0.75); // dotted-eighth offset
    }
  }

  return params;
}
```

### Pattern 4: FX-04 — Snapshot ChVol Delta (Already Implemented)

**What:** The success criterion is "Lead snapshot has ChVol higher than Clean snapshot by default." This is already true.

**Confirmed from `snapshot-engine.ts`:**

```typescript
// src/lib/helix/snapshot-engine.ts lines 27-32 — already exists
const ROLE_CHVOL: Record<string, number> = {
  clean: 0.68,
  crunch: 0.72,
  lead: 0.80,    // lead is 0.80 — higher than clean 0.68
  ambient: 0.65,
};
```

The existing `buildSnapshots()` already sets `parameterOverrides[ampKey].ChVol = ROLE_CHVOL[role]` for every snapshot. The existing `snapshot-engine.test.ts` Test 10 already verifies `clean=0.68` and `lead=0.80`.

**FX-04 implementation work = zero new code.** The only Phase 57 task for FX-04 is to add a test that explicitly names "FX-04" in its description to satisfy the success criterion assertion with a clear audit trail. The existing Test 10 already provides behavioral coverage — the new test can be a simple assertion that `lead.ChVol > clean.ChVol`.

**Phase 56 dependency clarification:** The ROADMAP note "Depends on: Phase 56 (needs Layer 4 mechanism established for snapshot ChVol delta application)" is misleading for this requirement. `snapshot-engine.ts` does NOT use `paramOverrides` from `models.ts` — it has its own `ROLE_CHVOL` table. Phase 57 can proceed immediately regardless of Phase 56 status for FX-04.

### Anti-Patterns to Avoid

- **Adding EQ adjustments as absolute values, not deltas:** The success criterion says "measurably different" — using small additive deltas on top of category baseline preserves the category-level tuning and only adds pickup-specific correction. Replacing EQ_PARAMS entries wholesale would lose the per-category tuning.

- **Using ms directly in PreDelay instead of seconds:** All reverb model PreDelay values in `models.ts` are in normalized seconds (0.02 = 20ms). GENRE_EFFECT_DEFAULTS must use the same unit — not raw ms integers. 0.025 = 25ms, 0.045 = 45ms.

- **Ignoring the "Left Time"/"Right Time" key for Dual Delay:** If the delay block is a Dual Delay, the `Time` key does not exist — `"Left Time"` and `"Right Time"` do. A `"Time" in params` guard protects against this.

- **Applying tempo override to genre delay Time override:** The override order must be: model defaults → genre → tempo. Tempo is the outermost override because it is the most intent-specific. The code already applies genre last; tempo must come after genre.

- **Threading `intent` all the way through `resolveBlockParams()` vs. just the needed fields:** Pass only what is needed — `guitarType?: string` and `tempoHint?: number` — not the entire `ToneIntent`. This keeps the function signatures narrow and prevents accidental dependencies on AI-generated fields inside deterministic resolution.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| BPM-to-delay conversion | Custom BPM calculator class | Single formula `30 / BPM` | The formula is 2 operations; a class adds zero value |
| PreDelay unit conversion | Separate ms-to-normalized converter | Direct normalized values in table | All model defaultParams already use normalized seconds; stay consistent |
| Guitar type detection | AI-based pickup detection | `intent.guitarType` (already in ToneIntent) | guitarType is captured from user input in the chat interview; the Knowledge Layer uses it deterministically |

**Key insight:** Every feature in Phase 57 is a table addition plus a conditional branch in an existing function. None require new modules, new classes, or new patterns.

---

## Common Pitfalls

### Pitfall 1: EQ Adjustment Magnitude Too Large
**What goes wrong:** EQ deltas that are too large (e.g., ±0.10 or more) cause audible EQ character to shift dramatically between guitarTypes — the preset sounds EQ'd "wrong" for humbuckers or single-coils rather than optimized.
**Why it happens:** The temptation is to make the difference obvious, but post-cab parametric EQ is already fairly heavy-handed.
**How to avoid:** Keep deltas in the ±0.02 to ±0.04 range. The success criterion only says "measurably different in the .hlx file" — not "audibly dramatic."
**Warning signs:** If the EQ diff between guitarTypes produces more than ±0.05 on any single parameter, reconsider.

### Pitfall 2: PreDelay Applied to Non-Reverb Blocks
**What goes wrong:** The genre profile override logic uses `block.type as keyof GenreEffectProfile`. If `PreDelay` is accidentally placed under `delay` or `modulation` in the genre table, it would try to apply to delay blocks that don't have a PreDelay parameter. The `if (key in params)` guard protects against this, but the table structure must be correct.
**Why it happens:** Easy to accidentally put PreDelay under the wrong key in GENRE_EFFECT_DEFAULTS.
**How to avoid:** PreDelay must go under the `reverb` key in each GENRE_EFFECT_DEFAULTS entry. Verify by inspection.

### Pitfall 3: Tempo Override Fires for All Block Types
**What goes wrong:** If the `tempoHint` override in `resolveDefaultParams()` lacks `block.type === "delay"` guard, it would attempt to set `Time` on reverb blocks (which use `DecayTime`) or modulation blocks (which use `Speed`).
**Why it happens:** Forgetting to gate the override to delay blocks.
**How to avoid:** Explicitly check `block.type === "delay"` before applying the tempo override. Test with a chain that includes both delay AND reverb to confirm reverb DecayTime is unaffected.

### Pitfall 4: Tempo Formula Produces Out-of-Range Values
**What goes wrong:** At 200 BPM quarter note: 30/200 = 0.15 (valid). At 60 BPM: 30/60 = 0.50 (valid). At 60 BPM dotted-eighth: 0.50 * 0.75 = 0.375 (valid). Range check: all quarter-note values fall between 0.15 (200 BPM) and 0.50 (60 BPM) — safely within 0-1. No clamping needed for standard BPM range, but include it defensively.
**Why it happens:** Edge cases at BPM extremes.
**How to avoid:** `Math.max(0.01, Math.min(1.0, 30 / tempoHint))` regardless.

### Pitfall 5: FX-04 "Depends on Phase 56" Creates False Blocker
**What goes wrong:** Treating Phase 56 as a hard prerequisite for all of Phase 57 blocks FX-01, FX-02, and FX-03 unnecessarily. FX-04 is already implemented.
**Why it happens:** The ROADMAP says "Depends on Phase 56" without clarifying which sub-requirement.
**How to avoid:** FX-01, FX-02, FX-03 are fully independent of Phase 56. FX-04 is already done. Phase 57 has zero functional dependency on Phase 56. It can execute independently or in parallel.

### Pitfall 6: Shared Knowledge Layer Regression
**What goes wrong:** A change to `resolveBlockParams()` that adds new parameters to the function signature could break dual-amp handling if the secondary path's `resolveBlockParams()` call is not updated to pass the same parameters.
**Why it happens:** `resolveParameters()` calls `resolveBlockParams()` in a `chain.map()`. Both primary and secondary path blocks use the same call — if `guitarType` and `tempoHint` are added, they must apply to both paths consistently.
**How to avoid:** The added parameters (`guitarType`, `tempoHint`) come from `intent`, not from the path — both amp paths share the same `intent.guitarType` and `intent.tempoHint`. Pass them uniformly; do not branch by path.

---

## Code Examples

### FX-02: Adding PreDelay to GENRE_EFFECT_DEFAULTS

```typescript
// Source: confirmed valid from models.ts line 932 — PreDelay is a real key on all reverb models
// Values in normalized seconds (0.01 = 10ms, 0.05 = 50ms)
const GENRE_EFFECT_DEFAULTS: Record<string, GenreEffectProfile> = {
  blues: {
    delay: { Time: 0.15, Feedback: 0.20, Mix: 0.20 },
    reverb: { Mix: 0.20, DecayTime: 0.4, PreDelay: 0.025 },  // 25ms — ADD
    modulation: { Speed: 0.3, Depth: 0.4 },
  },
  ambient: {
    delay: { Time: 0.50, Feedback: 0.50, Mix: 0.40 },
    reverb: { Mix: 0.50, DecayTime: 0.8, PreDelay: 0.045 },  // 45ms — ADD
    modulation: { Speed: 0.25, Depth: 0.6 },
  },
  // ... all 9 genres get PreDelay values
};
```

### FX-03: Tempo-Synced Delay Formula

```typescript
// Source: SUMMARY.md formula + success criterion verification
// 120 BPM → 30/120 = 0.25 ✓ (matches success criterion "approximately 0.25")
// The formula: normalized_time = 60000 / BPM / 2000 = 30 / BPM

if (tempoHint && block.type === "delay") {
  const quarterNoteTime = 30 / tempoHint;
  const clamped = Math.max(0.01, Math.min(1.0, quarterNoteTime));
  if ("Time" in params) {
    params.Time = clamped;
  }
  // Dual Delay uses "Left Time" / "Right Time" (space in key name)
  if ("Left Time" in params) {
    params["Left Time"] = clamped;
    params["Right Time"] = Math.min(1.0, clamped * 0.75);
  }
}
```

### FX-01: EQ Guitar Type Adjustment

```typescript
// Source: based on FEATURES.md finding 1 (MEDIUM confidence) — small deltas, delta approach
const EQ_GUITAR_TYPE_ADJUST: Record<string, Partial<Record<string, number>>> = {
  single_coil: { LowGain: 0.03, MidGain: 0.02, HighGain: -0.02 },
  humbucker:   { LowGain: -0.03, MidGain: -0.03, HighGain: 0.03 },
  p90:         { MidGain: -0.01, HighGain: 0.01 },
};

// In resolveEqParams() — only for HD2_EQParametric
const base = { ...EQ_PARAMS[ampCategory] };
if (guitarType && EQ_GUITAR_TYPE_ADJUST[guitarType]) {
  for (const [key, delta] of Object.entries(EQ_GUITAR_TYPE_ADJUST[guitarType])) {
    if (key in base) {
      base[key] = Math.max(0, Math.min(1, base[key] + (delta as number)));
    }
  }
}
return base;
```

### FX-04: Verification Test (snapshot-engine.test.ts)

```typescript
// Source: existing ROLE_CHVOL in snapshot-engine.ts lines 27-32 — already implemented
// This test locks the already-correct behavior against regression

it("FX-04: lead snapshot ChVol is higher than clean snapshot ChVol by default", () => {
  const intent = cleanIntent();
  const chain = buildChain(intent);
  const result = buildSnapshots(chain, standardSnapshots());

  const ampBlock = chain.find((b) => b.type === "amp");
  const ampKey = findBlockKey(chain, ampBlock!);

  const leadChVol = result[2].parameterOverrides[ampKey].ChVol;  // lead
  const cleanChVol = result[0].parameterOverrides[ampKey].ChVol; // clean

  expect(leadChVol).toBeGreaterThan(cleanChVol);
  expect(leadChVol).toBeCloseTo(0.80);
  expect(cleanChVol).toBeCloseTo(0.68);
});
```

---

## State of the Art

| Current Behavior | Phase 57 Behavior | What Changes |
|-----------------|-------------------|--------------|
| EQ_PARAMS keyed by AmpCategory only | EQ_PARAMS gets guitarType delta applied on top | Single-coil and humbucker produce measurably different EQ output |
| PreDelay in genre defaults: absent | PreDelay in all 9 GENRE_EFFECT_DEFAULTS reverb entries | Blues gets 25ms, ambient gets 45ms — note attack preserved |
| Delay Time: genre or model default (ignores BPM) | Delay Time: `30/BPM` when tempoHint present (quarter note) | 120 BPM → 0.25; 80 BPM → 0.375 (no change from default) |
| ChVol per toneRole: already implemented since Phase 2 | ChVol per toneRole: verified with FX-04-named test | No code change; regression protection added |
| `resolveDefaultParams()` signature: (block, genreProfile) | `resolveDefaultParams()` signature: (block, genreProfile?, tempoHint?) | Backward-compatible addition |
| `resolveBlockParams()` signature: (block, category, topology, genreProfile) | `resolveBlockParams()` signature: (+guitarType?, +tempoHint?) | Backward-compatible addition |

**Deprecated:** None. This phase adds capabilities without removing any existing behavior.

---

## Open Questions

1. **EQ delta magnitude calibration**
   - What we know: small deltas (±0.02 to ±0.04) are appropriate; absolute EQ values come from community analysis (MEDIUM confidence)
   - What's unclear: whether these specific delta values produce the desired tonal difference on hardware
   - Recommendation: use minimal deltas (±0.02 to ±0.03) that satisfy the success criterion "measurably different in the .hlx file" without overcorrecting; the success criterion does not require hardware validation — only parameter value difference

2. **Default note subdivision for tempo delay**
   - What we know: quarter note produces 0.25 at 120 BPM (matches success criterion); dotted-eighth is 0.1875 at 120 BPM
   - What's unclear: which subdivision is more universally appropriate
   - Recommendation: use quarter note as the default per the success criterion; dotted-eighth can be a future enhancement driven by genre hint (worship/rock = dotted-eighth)

3. **Phase 56 actual completion status**
   - What we know: Phase 56 plans exist (56-01-PLAN.md, 56-02-PLAN.md) but are not complete (0/7 phases complete per STATE.md)
   - What's unclear: whether Phase 56 will be complete before Phase 57 starts
   - Recommendation: FX-01, FX-02, FX-03 are fully independent of Phase 56; proceed without waiting; FX-04 is already implemented

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npx vitest run src/lib/helix/param-engine.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FX-01 | single_coil EQ differs from humbucker EQ in `EQ_PARAMS` output | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Wave 0 gap |
| FX-02 | Blues reverb has PreDelay ~0.025; ambient has PreDelay ~0.045 after genre override | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Wave 0 gap |
| FX-03 | 120 BPM tempoHint produces delay Time ≈ 0.25 | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Wave 0 gap |
| FX-04 | Lead snapshot ChVol (0.80) > Clean snapshot ChVol (0.68) | unit | `npx vitest run src/lib/helix/snapshot-engine.test.ts` | Wave 0 gap (behavior exists, test missing) |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/helix/param-engine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New test in `param-engine.test.ts` — covers FX-01: single_coil vs humbucker EQ diff
- [ ] New test in `param-engine.test.ts` — covers FX-02: blues PreDelay ~0.025, ambient PreDelay ~0.045
- [ ] New test in `param-engine.test.ts` — covers FX-03: 120 BPM → Time ≈ 0.25; no tempoHint → unchanged
- [ ] New test in `snapshot-engine.test.ts` — covers FX-04: lead ChVol > clean ChVol (regression lock)

No new test files needed — all tests go into the two existing test files.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/lib/helix/param-engine.ts` — `EQ_PARAMS`, `GENRE_EFFECT_DEFAULTS`, `resolveBlockParams()`, `resolveDefaultParams()` signatures; current state confirmed
- Direct codebase inspection: `src/lib/helix/snapshot-engine.ts` — `ROLE_CHVOL` table (lead=0.80, clean=0.68); FX-04 confirmed already implemented
- Direct codebase inspection: `src/lib/helix/models.ts` lines 932-944 — `PreDelay` confirmed as valid key in all reverb model `defaultParams` (values 0.01-0.05)
- Direct codebase inspection: `src/lib/helix/tone-intent.ts` — `guitarType` (single_coil/humbucker/p90), `tempoHint` (int 60-200, optional) confirmed fields in `ToneIntent`
- Direct codebase inspection: `src/lib/helix/models.ts` line 907 — Dual Delay confirmed uses `"Left Time"` and `"Right Time"` keys with spaces
- REQUIREMENTS.md — FX-01, FX-02, FX-03, FX-04 confirmed requirements for Phase 57
- ROADMAP.md — Phase 57 success criteria confirmed (120 BPM → 0.25; blues PreDelay 20-30ms; ambient 40-60ms; lead ChVol > clean)
- param-engine.test.ts — existing Test 13 confirms `Simple Delay` default Time=0.375; normalization of 0.375 * 2000 = 750ms = quarter note at ~80 BPM

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` Finding 3 — tempo delay formula (`60000/BPM * note_factor / 2000`); PreDelay ranges by genre; effect interaction rules
- `.planning/research/FEATURES.md` Finding 1 — EQ delta approach for single-coil vs humbucker (derived from community preset analysis)
- `.planning/research/SUMMARY.md` — confirms architecture: Knowledge Layer approach, no new packages, all changes in `src/lib/helix/`
- [iZotope Reverb Pre-Delay](https://www.izotope.com/en/learn/reverb-pre-delay) — verified PreDelay ranges by context (clean 40-60ms, crunch 20-40ms, high-gain 10-20ms)
- [Sweetwater BPM to Delay Times Cheat Sheet](https://www.sweetwater.com/insync/bpm-delay-times-cheat-sheet/) — formula validation

### Tertiary (LOW confidence)

- EQ guitar-type delta values (±0.02 to ±0.03 per parameter) — derived from community analysis in FEATURES.md; no official Line 6 documentation; requires hardware validation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; confirmed from direct codebase inspection
- Architecture: HIGH — all four requirement targets identified in source; FX-04 already implemented confirmed from code
- Pitfalls: HIGH — all pitfalls derived from direct codebase inspection; no external sources needed for primary risks

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable internal codebase; low rate of change)
