# Phase 29: Dual-Amp Preset Generation Fix - Research

**Researched:** 2026-03-03
**Domain:** Preset generation pipeline — AI contract, schema design, signal chain assembly, Helix hardware topology
**Confidence:** HIGH — bug is definitively located through direct code inspection; no external library research needed

---

## Summary

The dual-amp bug is a schema-level architectural limitation, not a parsing or file-generation defect. The `ToneIntentSchema` defines exactly one `ampName` (a `z.enum`) and one `cabName` (a `z.enum`). The Claude Planner is constrained by structured output (`zodOutputFormat`) to produce only a single amp name and single cab name. There is no channel in the AI contract for a second amp or second cab.

When a user asks the Gemini interview for two different amps, Gemini's system prompt acknowledges the technique ("Snapshots CANNOT change amp models — to switch amps, load both and toggle bypass") but the downstream Claude Planner receives a schema that can only express a single amp. The Planner is forced to pick one amp and discard the other — which it does without error, and the Knowledge Layer faithfully builds a single-amp preset.

The fix is therefore a schema extension: `ToneIntentSchema` must grow an optional `secondAmpName` and `secondCabName` field, and the signal chain assembler (`chain-rules.ts`), parameter engine (`param-engine.ts`), snapshot engine (`snapshot-engine.ts`), and preset builder (`preset-builder.ts`) must all handle the case where a second amp+cab pair is present on DSP0 in a bypass-toggle pattern that lets snapshots switch between them.

This is a well-scoped, self-contained bug fix. The Helix `.hlx` format already supports the pattern (split/join blocks, parallel paths). No new dependencies are required. Pod Go is single-DSP and series-only — dual-amp is impossible there; the fix must exclude Pod Go explicitly. The out-of-scope entry in REQUIREMENTS.md ("Parallel dual-amp paths as default") must be interpreted carefully: the prohibition is on making dual-amp the *default* behavior, not on supporting it when the user explicitly requests it.

**Primary recommendation:** Extend `ToneIntentSchema` with optional `secondAmpName`/`secondCabName`, add a `dualAmp` assembly path in `chain-rules.ts` that places both amps on DSP0 in separate paths, and update the Planner prompt to declare this capability clearly so the model knows to use it when the user asks for two amps. Gemini system prompt needs a matching update to stop promising a capability the planner cannot deliver.

---

## Bug Root Cause Analysis

### Layer 1: Gemini Chat (interview phase)

**File:** `src/lib/gemini.ts`

The Gemini system prompt says:

```
- Snapshots CANNOT change amp models — to switch amps, load both and toggle bypass
```

This correctly describes the Helix technique. Gemini will tell users "I'll load both amps and use snapshots to switch between them." The user hears a promise.

### Layer 2: Claude Planner (ToneIntent generation)

**File:** `src/lib/helix/tone-intent.ts`

```typescript
export const ToneIntentSchema = z.object({
  ampName: z.enum(AMP_NAMES),   // SINGLE amp — no second amp field
  cabName: z.enum(CAB_NAMES),   // SINGLE cab — no second cab field
  // ...
});
```

The schema has no field for a second amp. The Planner receives `zodOutputFormat(ToneIntentSchema)` as constrained decoding — it is structurally prevented from outputting two amps. It silently picks one and ignores the second.

**File:** `src/lib/planner.ts`

The Planner system prompt says:

```
- **ampName**: Exact name from the AMPS list above
- **cabName**: Exact name from the CABS list above
```

No mention of dual-amp capability exists in the prompt. The model has no instruction or schema field to use for dual-amp.

### Layer 3: Signal Chain Assembly

**File:** `src/lib/helix/chain-rules.ts`

```typescript
export function assembleSignalChain(intent: ToneIntent, device?: DeviceTarget): BlockSpec[] {
  const ampModel = AMP_MODELS[intent.ampName];  // reads ONE amp
  const cabModel = CAB_MODELS[intent.cabName];  // reads ONE cab
  // ...
  allBlocks.push({ model: ampModel, blockType: "amp", slot: "amp", dsp: 0 });
  allBlocks.push({ model: cabModel, blockType: "cab", slot: "cab", dsp: 0 });
```

The chain assembler only reads `intent.ampName` — a second amp would require `intent.secondAmpName` and handling for a parallel path structure.

### Layer 4: Preset Builder

**File:** `src/lib/helix/preset-builder.ts`

```typescript
global: {
  "@topology0": "A",  // Always series — never AB (split/join) or SABJ
  "@topology1": "A",
```

The topology is hardcoded to `"A"` (series). Dual-amp on Helix requires `"AB"` topology (split A/B paths) with a `split` and `join` block on DSP0. These are never created.

### Layer 5: Snapshot Engine

**File:** `src/lib/helix/snapshot-engine.ts`

```typescript
function detectAmpCategory(chain: BlockSpec[]): AmpCategory {
  const ampBlock = chain.find((b) => b.type === "amp");  // finds FIRST amp only
  if (!ampBlock) return "clean";
```

The snapshot engine uses `chain.find()` to detect one amp. If a second amp were in the chain, it would be ignored for category detection and ChVol parameter overrides. Only the first amp would get per-snapshot ChVol control.

### Layer 6: Parameter Engine

**File:** `src/lib/helix/param-engine.ts`

```typescript
const ampModel = AMP_MODELS[intent.ampName];  // ONE amp name
const ampCategory: AmpCategory = ampModel.ampCategory ?? "clean";
const topology: TopologyTag = ampModel.topology ?? "not_applicable";
```

The param engine reads `intent.ampName` once. The category and topology defaults for the entire preset flow from the single amp. A second amp with different category (e.g., clean + high-gain dual-amp) would have its parameters resolved with the wrong category context.

---

## Hardware Architecture: Dual-Amp on Helix LT and Helix Floor

**Confidence:** HIGH — derived from reading actual .hlx files and the Helix architecture

### How Helix Dual-Amp Actually Works

The Helix LT and Helix Floor both support a Split A/B topology on DSP0:

- `@topology0: "AB"` — activates parallel paths on DSP0
- A `split` block (model `HD2_SplitAB`) divides the signal into Path A and Path B
- Amp 1 + Cab 1 go on Path A (path 0)
- Amp 2 + Cab 2 go on Path B (path 1)
- A `join` block (model `HD2_MergerMixer`) recombines the paths
- Each amp has its own `@path` value: 0 for Path A, 1 for Path B
- Snapshots toggle one amp ON and the other OFF to "switch" between them

The `HlxDsp` type already has optional `split` and `join` fields:

```typescript
export interface HlxDsp {
  // ...
  split?: HlxSplit;
  join?: HlxJoin;
}
```

And the `HlxGlobal` type already supports `"AB"` topology:

```typescript
"@topology0": "A" | "AB" | "SABJ";
```

Both types are already defined. The infrastructure exists. The builder just never uses them.

### DSP Budget for Dual Amp on Helix

DSP0 with dual amps:
- Split block: 1
- Amp A + Cab A: 2 blocks (amp in slot + cab as cab0 key)
- Amp B + Cab B: 2 blocks (amp in slot + cab as cab1 key)
- Join block: 1
- Pre-amp effects (boost, gate, wah, comp): shared pre-split

This is tight but feasible. The existing 8-block-per-DSP limit applies to non-cab blocks. With split + 2 amps + join = 4 non-cab DSP0 blocks consumed for the dual-amp structure. That leaves 4 pre-amp effect slots on DSP0. DSP1 is untouched (EQ, mod, delay, reverb).

### Pod Go: Dual-Amp is Not Supported

Pod Go is single-DSP, series-only routing. There is no split/join capability. The REQUIREMENTS.md entry `PGCHAIN-01: Series-only routing` confirms this. The fix must detect `isPodGo(device)` and refuse dual-amp — if a user on Pod Go asks for two amps, the Gemini interview should clarify the limitation and the planner should pick the best single amp.

### Helix LT vs Helix Floor

Both use the same device ID (2162692) and the same preset format. Dual-amp works identically on both. The `isHelix(device)` function in `types.ts` already groups them correctly.

---

## The Out-of-Scope Entry in REQUIREMENTS.md

The REQUIREMENTS.md has this out-of-scope entry:

```
| Parallel dual-amp paths as default | Serial single-path is correct; dual-amp only for specific genre patterns |
```

This is explicitly NOT a prohibition on dual-amp support. It is a prohibition on making it the *default*. The intent is: single-amp serial chain is the default; dual-amp is an optional feature for when the user explicitly requests it. This phase is implementing exactly that — dual-amp when requested, single-amp otherwise. No conflict with out-of-scope rules.

---

## Architecture Patterns

### Pattern 1: Schema Extension (ToneIntent)

Add optional fields. The existing Zod schema approach is the correct pattern — add nullable/optional fields rather than a separate schema:

```typescript
export const ToneIntentSchema = z.object({
  ampName: z.enum(AMP_NAMES),
  cabName: z.enum(CAB_NAMES),
  // NEW — optional second amp for dual-amp presets
  secondAmpName: z.enum(AMP_NAMES).optional(),
  secondCabName: z.enum(CAB_NAMES).optional(),
  // ...
});
```

The Planner prompt must be updated to describe these new fields and when to use them. The `zodOutputFormat` will include the new fields in the JSON Schema passed to Claude's constrained decoding — they will be optional, so single-amp requests are unaffected.

### Pattern 2: Chain Assembly for Dual-Amp

In `chain-rules.ts`, detect dual-amp intent and assemble the parallel structure:

```typescript
if (intent.secondAmpName && intent.secondCabName && !isPodGo(device)) {
  // Dual-amp path: split > [amp1+cab1 on path0] > join < [amp2+cab2 on path1]
  // ... build parallel BlockSpec array
}
```

The `BlockSpec` type already has a `path` field (number). Path 0 = Path A, Path 1 = Path B. The split and join blocks need to be inserted as special block types. Two new entries need to be added to the `BlockSpec.type` union or handled as special blocks — likely the cleanest approach is to add `"split"` and `"join"` to the type union, or handle them as special non-BlockSpec entries in the DSP structure directly in the builder.

### Pattern 3: Preset Builder Topology

In `preset-builder.ts`, detect dual-amp and set topology accordingly:

```typescript
"@topology0": hasDualAmp ? "AB" : "A",
```

The `split` and `join` blocks must be written into `dsp0.split` and `dsp0.join` using the existing `HlxSplit` and `HlxJoin` interfaces.

### Pattern 4: Snapshot Engine for Dual-Amp Switching

For dual-amp presets, the snapshot engine must assign different amp bypass states per snapshot:

- Clean snapshot: Amp A ON, Amp B OFF
- Crunch/Lead/Ambient: depends on what roles each amp is designated for

The simplest approach: add a `dualAmpRole` concept where `ampName` is designated as the "primary" amp (used for crunch/lead) and `secondAmpName` is the "alternate" (e.g., clean). The Gemini interview and Planner prompt should collect which amp serves which role.

Alternatively, always assign: Amp A = clean role, Amp B = driven role. This avoids needing a third schema field.

### Pattern 5: Gemini System Prompt Update

The Gemini prompt must be updated to:
1. Tell users that dual-amp is supported for Helix LT and Floor
2. Tell users that Pod Go does NOT support dual-amp (series-only hardware)
3. When the user requests two amps, collect which amp is the clean/rhythm amp and which is the lead/gain amp
4. Not over-promise on Pod Go

---

## Common Pitfalls

### Pitfall 1: Partial Schema Update

**What goes wrong:** Adding `secondAmpName` to `ToneIntentSchema` but not updating the Planner prompt to mention the new fields. Claude's constrained decoding will never output them because the model doesn't know they exist.

**How to avoid:** Always update both the schema AND the Planner prompt text together. The prompt is the model's only instruction source; the schema alone is not self-describing from the model's perspective.

### Pitfall 2: Pod Go Dual-Amp

**What goes wrong:** Not guarding dual-amp assembly behind `!isPodGo(device)`, resulting in a broken .pgp file with split/join blocks that Pod Go doesn't support.

**How to avoid:** Add explicit `isPodGo` guard in `chain-rules.ts` dual-amp path. If `secondAmpName` is set but device is Pod Go, log a warning and fall back to single-amp with the primary `ampName`. The Gemini prompt should warn users that Pod Go is single-amp only.

### Pitfall 3: DSP Block Limit with Dual Amp

**What goes wrong:** Dual-amp uses 4+ extra DSP0 blocks (split, amp2, join, plus cab2 as a key). If the user also requested many pre-amp effects, DSP0 may exceed 8 blocks.

**How to avoid:** In `chain-rules.ts`, enforce that dual-amp presets are limited to fewer pre-amp effects. The DSP0 budget with dual amps: split(1) + amp1(1) + amp2(1) + join(1) = 4 mandatory slots, leaving 4 for effects (boost + gate + 2 pre-amp effects max).

### Pitfall 4: Parameter Engine Uses Single AmpCategory for Both Amps

**What goes wrong:** The param engine derives category from `intent.ampName` only. If amp1 is clean and amp2 is high-gain, amp2's parameters will be computed with clean category defaults.

**How to avoid:** In `resolveParameters()`, detect dual-amp intent. For blocks belonging to the second amp path, look up `intent.secondAmpName` to get its model and category. Apply category-appropriate defaults per amp independently.

### Pitfall 5: Snapshot ChVol Override Hits Only First Amp

**What goes wrong:** `buildSnapshots()` uses `blockEntries.find((e) => e.block.type === "amp")` — finds only the first amp. The second amp gets no per-snapshot ChVol control.

**How to avoid:** After adding dual-amp to the chain, update `buildSnapshots()` to find both amp entries. Add ChVol overrides for both, and control bypass state per snapshot (one amp ON, one OFF per snapshot).

### Pitfall 6: Cab Association in Preset Builder

**What goes wrong:** The preset builder associates each amp with the first cab after it in block order. In a dual-amp layout, both amps must point to their own respective cab keys (`@cab: "cab0"` for amp1, `@cab: "cab1"` for amp2).

**How to avoid:** The existing `cabIndexMap` in `buildDsp()` already tracks which cab index corresponds to which BlockSpec. The amp-to-cab association logic (`blocks.slice(ampIdx + 1).find(b => b.type === "cab")`) must be verified to correctly handle two amp+cab pairs in parallel paths.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dual-amp .hlx structure | Custom JSON serializer | Extend existing `buildDsp()` | `HlxSplit`, `HlxJoin`, `HlxDsp.split/join` are already defined |
| Second amp schema field | Separate DualAmpIntentSchema | Optional fields on ToneIntentSchema | Planner already uses `zodOutputFormat(ToneIntentSchema)` — extending in place preserves all existing wiring |
| Pod Go dual-amp error | Runtime error from invalid preset | `isPodGo()` guard + graceful fallback | Keep single-amp for Pod Go, never send broken topology to builder |
| Amp category per dual-amp | New category resolution system | Extend `resolveParameters()` with secondAmp detection | Same 3-layer resolution pattern, just run it twice |

---

## Code Examples

### Verified Pattern: How the Existing Split/Join Types Look in types.ts

```typescript
// Already defined in src/lib/helix/types.ts
export interface HlxSplit {
  "@model": string;       // "HD2_SplitAB"
  "@enabled": boolean;
  "@position": number;
  RouteTo?: number;
  bypass?: boolean;
}

export interface HlxJoin {
  "@model": string;       // "HD2_MergerMixer"
  "@position": number;
  "A Level"?: number;
  "B Level"?: number;
  "A Pan"?: number;
  "B Pan"?: number;
}

export interface HlxDsp {
  // ...
  split?: HlxSplit;   // already optional — just needs to be set
  join?: HlxJoin;     // already optional — just needs to be set
}

export interface HlxGlobal {
  "@topology0": "A" | "AB" | "SABJ";  // "AB" enables dual-path
  // ...
}
```

### Verified Pattern: Chain Assembly Single-Amp (existing)

```typescript
// From chain-rules.ts — current single-amp path
allBlocks.push({
  model: ampModel,
  blockType: "amp",
  slot: "amp",
  dsp: 0,
});
allBlocks.push({
  model: cabModel,
  blockType: "cab",
  slot: "cab",
  dsp: 0,
});
```

For dual-amp, the second amp needs `path: 1` on the BlockSpec:

```typescript
// Second amp on Path B (path 1)
result.push({
  type: "amp",
  modelId: secondAmpModel.id,
  modelName: secondAmpModel.name,
  dsp: 0,
  position: /* after split */,
  path: 1,   // Path B
  enabled: true,
  stereo: false,
  parameters: {},
});
```

### Verified Pattern: Zod Optional Extension

```typescript
// Minimal change to ToneIntentSchema in tone-intent.ts
export const ToneIntentSchema = z.object({
  ampName: z.enum(AMP_NAMES),
  cabName: z.enum(CAB_NAMES),
  secondAmpName: z.enum(AMP_NAMES).optional(),   // NEW
  secondCabName: z.enum(CAB_NAMES).optional(),   // NEW
  // ... all existing fields unchanged
});
```

---

## Affected Files Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/helix/tone-intent.ts` | Schema extension | Add `secondAmpName`, `secondCabName` optional fields |
| `src/lib/planner.ts` | Prompt update | Add dual-amp instructions and field documentation |
| `src/lib/gemini.ts` | Prompt update | Clarify dual-amp capability + Pod Go limitation |
| `src/lib/helix/chain-rules.ts` | Logic extension | Add dual-amp assembly path with split/join blocks |
| `src/lib/helix/param-engine.ts` | Logic extension | Resolve second amp params with correct category |
| `src/lib/helix/snapshot-engine.ts` | Logic extension | Handle two amp entries for bypass + ChVol overrides |
| `src/lib/helix/preset-builder.ts` | Logic extension | Set `@topology0: "AB"`, write `split` and `join` to dsp0 |

---

## Open Questions

1. **Which amp should be "clean" vs "lead" in the snapshot toggle pattern?**
   - What we know: Gemini tells users to describe two amps; the interview collects tone goals
   - What's unclear: Should the planner be told to assign roles, or should the engine assume amp1=clean, amp2=driven?
   - Recommendation: Add a simple convention: `ampName` = the amp that handles the lower-gain snapshots (clean/crunch), `secondAmpName` = the amp that handles higher-gain snapshots (lead/ambient). Document this in the Planner prompt. Avoid adding a third schema field for role assignment.

2. **Does the second amp need its own snapshot intent fields?**
   - What we know: ToneIntentSchema has 4 SnapshotIntents, each with `toneRole`. The snapshot engine maps toneRole to block states.
   - What's unclear: If a snapshot role needs amp1 active and amp2 bypassed, is `toneRole` enough to determine this, or does the planner need to specify per-snapshot which amp is active?
   - Recommendation: Use a fixed convention based on `toneRole`: clean/crunch snapshots activate `ampName`, lead/ambient snapshots activate `secondAmpName`. This is predictable and requires no new schema fields.

3. **How many pre-amp effects can a dual-amp preset have?**
   - What we know: DSP0 budget with dual amps consumes at minimum 4 slots (split + amp1 + amp2 + join). 4 remain.
   - What's unclear: Should the Planner prompt reduce the `maxEffects` for dual-amp, or should chain-rules silently trim?
   - Recommendation: Update the Planner prompt to say "For dual-amp presets, limit pre-amp effects to 2 maximum — DSP budget is tighter." Chain-rules should also enforce this as a hard limit.

4. **Does DSP1 need any changes for dual-amp?**
   - What we know: DSP1 handles post-amp effects (EQ, mod, delay, reverb). These are downstream of the join block and are agnostic to how many amps are on DSP0.
   - Recommendation: No changes needed to DSP1 handling.

---

## New Requirements (to be defined in phase plan)

These requirement IDs should be created and tracked:

| Proposed ID | Description |
|-------------|-------------|
| DUAL-01 | ToneIntentSchema adds optional `secondAmpName` and `secondCabName` fields with Zod validation |
| DUAL-02 | Planner prompt updated to document dual-amp fields and when to use them |
| DUAL-03 | Chain assembler builds split/join topology when `secondAmpName` is present and device is Helix |
| DUAL-04 | Param engine resolves second amp parameters using second amp's model category independently |
| DUAL-05 | Snapshot engine applies per-snapshot bypass toggle: clean/crunch activates `ampName`, lead/ambient activates `secondAmpName` |
| DUAL-06 | Preset builder sets `@topology0: "AB"` and writes `split`/`join` blocks to dsp0 for dual-amp presets |
| DUAL-07 | Pod Go guard: `secondAmpName` is silently ignored when device is Pod Go; planner prompt warns of this limitation |
| DUAL-08 | Gemini system prompt updated to accurately describe dual-amp capability (Helix only) and Pod Go limitation |
| DUAL-09 | Generated dual-amp `.hlx` file loads in HX Edit without errors and both amps are visible in the signal chain |

---

## Sources

### Primary (HIGH confidence)
- Direct inspection of `src/lib/helix/tone-intent.ts` — confirmed single-amp schema
- Direct inspection of `src/lib/planner.ts` — confirmed no dual-amp prompt instructions
- Direct inspection of `src/lib/helix/chain-rules.ts` — confirmed single-amp assembly path
- Direct inspection of `src/lib/helix/preset-builder.ts` — confirmed `@topology0: "A"` hardcoded
- Direct inspection of `src/lib/helix/snapshot-engine.ts` — confirmed `chain.find()` single-amp detection
- Direct inspection of `src/lib/helix/param-engine.ts` — confirmed single `intent.ampName` lookup
- Direct inspection of `src/lib/helix/types.ts` — confirmed `HlxSplit`, `HlxJoin`, `HlxDsp.split/join` already defined
- Direct inspection of `src/lib/gemini.ts` — confirmed Gemini promises dual-amp capability to users
- Direct inspection of `.planning/REQUIREMENTS.md` — confirmed out-of-scope entry is "as default" not "ever"

### Secondary (MEDIUM confidence)
- `src/lib/helix/validate.ts` — `HD2_SplitAB` and `HD2_MergerMixer` are in the valid model ID set, confirming these exist in the codebase model database

---

## Metadata

**Confidence breakdown:**
- Bug location: HIGH — definitively confirmed at schema level through code inspection
- Fix approach: HIGH — pattern is clear; extend schema, update prompts, add assembly path
- Hardware topology: HIGH — types already defined, pattern clear from existing interfaces
- Snapshot toggle convention: MEDIUM — the clean=amp1/lead=amp2 convention is a design choice; reasonable but could be refined
- DSP budget with dual-amp: MEDIUM — the 4+4 slot split is derived from reading the code; should be verified against a real dual-amp .hlx export

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable codebase; no fast-moving external dependencies)
