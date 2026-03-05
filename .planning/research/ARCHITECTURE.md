# Architecture Research

**Domain:** Preset quality improvement and Stadium rebuild for HelixTones v4.0
**Researched:** 2026-03-05
**Confidence:** HIGH — all integration points verified from direct code inspection and analysis of 10 real .hsp files from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/

---

## Context: What This Document Covers

This is an integration architecture document for v4.0. It answers:

- How the Stadium .hsp rebuild integrates with the existing builder infrastructure
- What is structurally wrong with the current stadium-builder.ts (verified against real files)
- How the quality improvement features (planner enrichment, per-model amp params, effect combinations, cost routing) integrate with the Planner-Executor pipeline
- Which components are NEW vs MODIFIED vs UNCHANGED
- The build order with dependency rationale

The existing v3.2 architecture (Supabase auth, all 6 devices, Planner-Executor pipeline, Variax support, usage logging) is stable and NOT re-researched. Focus is on integration points only.

---

## System Overview — Current v3.2 State

```
+------------------------------------------------------------------+
|                       Frontend (Next.js)                          |
|  Chat UI | Device Picker | Signal Chain Viz | Preset Card         |
+------------------------------------------------------------------+
                |                        |
         SSE stream (Gemini)      POST /api/generate
                |                        |
+---------------+------------------------+-------------------------+
|                      API Layer (Vercel Serverless)               |
|                                                                   |
|   /api/chat                        /api/generate                 |
|   Gemini 2.5 Flash (standard)      Claude Sonnet 4.6 (Planner)   |
|   Gemini 3.1 Pro (premium)         + Knowledge Layer pipeline     |
|   + Google Search grounding        Prompt cache: ephemeral        |
|                                    structured output (Zod)        |
+------------------------------------------------------------------+
                                        |
                                        | ToneIntent (~15 fields)
                                        v
+------------------------------------------------------------------+
|                  Knowledge Layer (Deterministic)                  |
|                                                                   |
|  chain-rules.ts      param-engine.ts        snapshot-engine.ts   |
|  Block ordering      5 resolution layers    Volume balancing      |
|  DSP assignment      model defaults         Block state tables    |
|  Mandatory inserts   category overrides     intentRole toggling   |
|  Device limits       topology mid adj.      ambient mix boost     |
|                      genre defaults                               |
|                                                                   |
|  Device Builders:                                                 |
|    preset-builder.ts   (LT/Floor — .hlx)                         |
|    podgo-builder.ts    (Pod Go — .pgp)                            |
|    stadium-builder.ts  (Stadium — .hsp) [CURRENTLY BROKEN]       |
|    stomp-builder.ts    (Stomp/StompXL — .hlx)                     |
+------------------------------------------------------------------+
                |
    Models, Catalogs, Types
                |
+------------------------------------------------------------------+
|  models.ts   param-registry.ts   types.ts   config.ts            |
|  AMP_MODELS  PARAM_TYPE_REGISTRY DeviceTarget FIRMWARE_CONFIG    |
|  STADIUM_AMPS                    BlockSpec   STADIUM_CONFIG       |
|  EFFECT catalogs                 PresetSpec  STOMP_CONFIG         |
+------------------------------------------------------------------+
```

---

## Stadium .hsp Builder: What Is Broken

This is the primary blocker for v4.0. Direct inspection of 10 real .hsp files from
C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/ reveals 5 critical bugs in
the current stadium-builder.ts.

### Bug 1: Parameter Encoding (CRITICAL — will reject on device)

```
Current builder:   { "ParamKey": { "access": "enabled", "value": 0.5 } }
Real .hsp format:  { "ParamKey": { "value": 0.5 } }
```

The `access` field does not exist in any real .hsp file across all 10 presets inspected.
Every single parameter on every block uses `{ "value": X }` only. The current builder
generates a format that will likely be rejected or silently broken by Stadium firmware.

**Fix target:** `buildFlowBlock()` in `stadium-builder.ts` — the `slotParams` construction loop.

### Bug 2: Block Key Numbering (CRITICAL — wrong flow structure)

```
Current builder:  b00=input, b01=fx, b02=fx, b03=amp, b04=cab, b05=output (sequential)
Real .hsp format: b00=input, b01=fx, b02=fx, b05=amp, b06=cab, b09=fx, b13=output
```

Real Stadium presets use a SLOT-GRID numbering system, not sequential keys. Blocks occupy
fixed absolute positions in a 14-slot grid (positions 0-13 for the primary path). The
block key `bNN` always equals the block's `position` field. Unused slots simply have no
key in the flow object.

Real patterns observed:
- Input: always b00 (position 0)
- Output: always b13 (position 13)
- Amp: typically b04-b07 (positions 4-7)
- Cab: amp position + 1
- Pre-amp effects: positions 1-3
- Post-amp effects: positions 8-12

Correct allocation for a simple preset (amp at b05, cab at b06):
```
b00: input
b01: gate (HX2_GateHorizonGateMono)
b02: boost (HD2_DistScream808Mono)
b05: amp (Agoura_AmpXxx)
b06: cab (HD2_CabMicIr_...)
b09: delay
b10: reverb
b13: output
```

**Fix target:** `buildStadiumFlow()` in `stadium-builder.ts` — replace sequential `flowPos`
counter with a slot-grid allocator that respects canonical positions.

### Bug 3: FX Block Type Field (MEDIUM — may confuse firmware)

```
Current builder:  block.type passed directly (e.g., "distortion", "delay", "reverb", "eq")
Real .hsp format: ALL effect blocks use type="fx" regardless of effect category
```

Only amp, cab, split, join, input, output, and looper use their own specific type strings.
Every other block — distortion, delay, reverb, modulation, dynamics, EQ, wah, pitch,
volume — uses `type: "fx"` in real files.

**Fix target:** `buildFlowBlock()` in `stadium-builder.ts` — map `BlockSpec.type` to Stadium
type string using a lookup table.

### Bug 4: Missing Amp IDs in STADIUM_AMPS Catalog (MEDIUM — limits preset quality)

Real .hsp files use these Agoura amp IDs that are NOT in the current STADIUM_AMPS catalog:

| Missing ID | Real-world equivalent |
|------------|-----------------------|
| `Agoura_AmpRevvCh3Purple` | Revv Generator Channel 3 (high-gain) |
| `Agoura_AmpSolid100` | Solid State amp (JC-120 style) |
| `Agoura_AmpUSDoubleBlack` | Fender Twin Reverb (blackface) |
| `Agoura_AmpUSLuxeBlack` | Fender Deluxe Reverb (blackface) |
| `Agoura_AmpUSPrincess76` | Fender Princeton Reverb '76 |
| `Agoura_AmpUSTweedman` | Fender Tweed Bassman |

These 6 amps cover critical clean/crunch/high-gain categories that current Stadium presets
cannot access. This means the planner is choosing from an incomplete list.

**Fix target:** Add 6 entries to `STADIUM_AMPS` in `models.ts`. Model IDs confirmed from real
files. `defaultParams` and `ampCategory` need to be researched/set correctly (similar to
existing Agoura entries).

### Bug 5: Device Version Mismatch (LOW — cosmetic but worth correcting)

```
Current config: STADIUM_DEVICE_VERSION = 285213946  (set from 2 presets in v3.0)
Real files:     301990015, 301991171, 302056738      (3 different values observed)
```

The device version encodes firmware version. Using a different value from the file's firmware
may cause HX Edit to warn about version mismatch. The most common value observed (301990015
appears in 2 files) should be used, or the config should document all observed values.

**Fix target:** `STADIUM_CONFIG.STADIUM_DEVICE_VERSION` in `config.ts`.

---

## Component Integration Map for v4.0

### Component Status Table

| Component | Status | What Changes |
|-----------|--------|--------------|
| `stadium-builder.ts` | REWRITE (4 bugs) | Fix param encoding, block key numbering, type field, device version |
| `models.ts` / STADIUM_AMPS | MODIFY | Add 6 missing Agoura amp IDs; add defaultParams for each |
| `models.ts` / AMP_MODELS defaultParams | MODIFY | Per-model amp param audit — Vox Cut, Diezel Deep, JC-120 BrightSwitch |
| `planner.ts` / `buildPlannerPrompt()` | MODIFY | Add gain-staging guidance, cab pairing rules, effect discipline section |
| `param-engine.ts` | MODIFY | Add EFFECT_COMBO_PARAMS table (Layer 5 resolution) |
| `validate.ts` | MODIFY | Add HX2_* model IDs to VALID_IDS (Stadium uses HX2_ prefix for gate/comp) |
| `config.ts` / STADIUM_CONFIG | MODIFY | Update STADIUM_DEVICE_VERSION to match real files |
| `/api/generate/route.ts` | MODIFY | Unblock Stadium device selection after builder is verified |
| `snapshot-engine.ts` | NO CHANGE | Interface is stable; Stadium snapshots already work |
| `chain-rules.ts` | NO CHANGE | Stadium single-path assembly already correct |
| `preset-builder.ts` | NO CHANGE | .hlx format unaffected |
| `podgo-builder.ts` | NO CHANGE | Pod Go unaffected |
| `stomp-builder.ts` | NO CHANGE | Stomp unaffected |
| `tone-intent.ts` | NO CHANGE | ToneIntent schema covers all 6 devices already |
| `types.ts` | NO CHANGE | DeviceTarget, BlockSpec, DeviceIds all correct |
| `param-registry.ts` | NO CHANGE | Encoding types already documented |
| `gemini.ts` | NO CHANGE | Chat model selection already correct |
| `/api/chat/route.ts` | NO CHANGE | Usage logging already complete (v3.2) |

---

## Recommended Project Structure (v4.0 additions)

```
src/lib/helix/
├── chain-rules.ts        # no change
├── config.ts             # MODIFY: STADIUM_DEVICE_VERSION + add HX2_ model constants
├── models.ts             # MODIFY: +6 STADIUM_AMPS; defaultParams audit for HD2_ amps
├── param-engine.ts       # MODIFY: +EFFECT_COMBO_PARAMS table + applyComboAdjustments()
├── param-registry.ts     # no change
├── preset-builder.ts     # no change
├── podgo-builder.ts      # no change
├── snapshot-engine.ts    # no change
├── stadium-builder.ts    # REWRITE: fix params, block keys, type field, version
├── stomp-builder.ts      # no change
├── tone-intent.ts        # no change
├── types.ts              # no change
├── validate.ts           # MODIFY: add HX2_* and VIC_* IDs to VALID_IDS for Stadium
├── config.ts             # MODIFY: STADIUM_DEVICE_VERSION
└── index.ts              # no change

src/lib/
└── planner.ts            # MODIFY: richer system prompt (effect combos, cab pairing, gain-staging)

src/app/api/generate/
└── route.ts              # MODIFY: unblock helix_stadium device (remove 400 response)
```

---

## Architectural Patterns

### Pattern 1: Stadium Block Slot Grid

**What:** The Stadium .hsp flow uses a fixed 14-slot grid (positions 0-13) per path. Block
keys are `bNN` where NN equals the absolute slot position. The builder must allocate blocks
to canonical slots, not generate sequential keys.

**Design decision:** Use a SLOT_ALLOCATION map in the new stadium-builder that assigns
canonical positions based on block role:

```typescript
// stadium-builder.ts — new slot allocation (replaces sequential flowPos counter)
const STADIUM_SLOT_ALLOCATION: Record<string, number> = {
  input: 0,         // b00 — always
  pre_gate: 1,      // b01
  pre_boost: 2,     // b02
  pre_effect_1: 3,  // b03
  pre_effect_2: 4,  // b04
  amp: 5,           // b05
  cab: 6,           // b06
  post_gate: 7,     // b07 (if high-gain noise gate)
  post_eq: 8,       // b08
  post_effect_1: 9, // b09
  post_effect_2: 10,// b10
  post_effect_3: 11,// b11
  post_gain: 12,    // b12
  output: 13,       // b13 — always
};

// Block key generation from slot position
function makeBlockKey(slotPosition: number): string {
  return `b${String(slotPosition).padStart(2, "0")}`;
}
```

**Why this matters:** The firmware expects `bNN` keys to correspond to physical slot positions.
Wrong numbering means blocks appear in wrong positions on the hardware display and may cause
routing failures.

### Pattern 2: Stadium Parameter Encoding

**What:** All block parameters in .hsp format use `{ "value": X }` objects only. No `access`
field.

**Implementation:**

```typescript
// CORRECT:
for (const [key, value] of Object.entries(block.parameters)) {
  slotParams[key] = { value };
}

// WRONG (current code):
for (const [key, value] of Object.entries(block.parameters)) {
  slotParams[key] = { access: "enabled", value };
}
```

**Applies to:** All block types — amp, cab, fx, split, join. The harness params also use
`{ value: X }` without the `access` field (verified from real dual-amp presets).

### Pattern 3: Stadium FX Block Type Mapping

**What:** Real Stadium presets use `type: "fx"` for all effect blocks regardless of
what the effect does. Only structural block types get named strings.

```typescript
// stadium-builder.ts — type mapping
function getStadiumBlockType(blockSpecType: BlockSpec["type"]): string {
  switch (blockSpecType) {
    case "amp": return "amp";
    case "cab": return "cab";
    // All effects: use "fx" regardless of category
    case "distortion":
    case "dynamics":
    case "eq":
    case "delay":
    case "reverb":
    case "modulation":
    case "wah":
    case "pitch":
    case "volume":
    case "send_return":
    default:
      return "fx";
  }
}
```

### Pattern 4: Effect Combination Resolution (Layer 5 in param-engine)

**What:** A 5th deterministic resolution layer in `resolveParameters()` that adjusts
parameters when specific block type pairs appear together in a chain. Applied after
genre defaults (Layer 4).

**When to use:** Always — it's an always-on quality improvement. Scans the assembled
chain for known beneficial pairings and applies small adjustments.

```typescript
// param-engine.ts — Layer 5 structure
interface EffectComboEntry {
  typeA: BlockSpec["type"];  // earlier block in chain
  typeB: BlockSpec["type"];  // later block in chain
  // Delta adjustments — only applied if the param exists on the block
  adjustA: Partial<Record<string, number>>;
  adjustB: Partial<Record<string, number>>;
}

const EFFECT_COMBO_PARAMS: EffectComboEntry[] = [
  {
    // Compressor before overdrive: slight compressor output reduction
    typeA: "dynamics", typeB: "distortion",
    adjustA: { Output: -0.08, Level: -0.05 }, adjustB: {},
  },
  {
    // Chorus before reverb: reduce chorus depth to avoid wash
    typeA: "modulation", typeB: "reverb",
    adjustA: { Depth: -0.08 }, adjustB: {},
  },
  {
    // Delay before reverb: lower delay feedback to prevent reverb buildup
    typeA: "delay", typeB: "reverb",
    adjustA: { Feedback: -0.05 }, adjustB: {},
  },
  {
    // Overdrive before delay: reduce delay mix (drive makes delays louder)
    typeA: "distortion", typeB: "delay",
    adjustA: {}, adjustB: { Mix: -0.05 },
  },
];
```

**Trade-offs:** Pure Knowledge Layer addition — AI never makes numeric decisions.
Fully unit-testable. Minimal code surface. Applied via clamped delta arithmetic.

### Pattern 5: Planner Prompt Enrichment (Creative Quality Lever)

**What:** Add curated guidance sections to `buildPlannerPrompt()` in `planner.ts`. Encoded
as AI instructions using existing cabAffinity and ampCategory metadata from models.ts.

**Target additions:**

```
## Gain-Staging Intelligence
- Always-on boost is mandatory: Minotaur for clean/crunch amps, Scream 808 for high-gain
- Never combine both Minotaur AND Scream 808 in one preset
- When including a compressor: assign role "always_on", position it before drive

## Amp + Cab Pairing
- US Deluxe/Double: pair with open-back 1x12 or 2x12 (1x12 US Deluxe, 2x12 Double C12N)
- Brit Plexi/J45/2203: pair with closed-back 4x12 (4x12 Greenback25, 4x12 Brit V30)
- Vox AC30/AC15: pair with open-back 2x12 (2x12 Match G25, 2x12 Blue Bell)
- Mesa/Recto/Tread Plate: pair with closed-back 4x12 (4x12 Uber V30, 4x12 XXL V30)
- Agoura amps (Stadium): use the cab that historically shipped with that amp's real-world counterpart

## Effect Discipline
- Metal/high-gain presets: max 3 effects (boost + gate is mandatory, 1 time-based max)
- Blues/country/jazz: 2-4 effects is optimal (no need to fill every slot)
- Ambient/worship: 4-5 effects appropriate (delay + reverb + modulation + volume)
- Do NOT add effects "to fill slots" — empty slots are fine and preserve DSP headroom
```

**Trade-offs:** Longer system prompt increases cache write cost once, then hits cache on
subsequent calls. The enrichment guides the AI's model/effect selections upstream — better
inputs to the Knowledge Layer produce better presets without touching numeric params.

### Pattern 6: Per-Model Amp Parameter Audit (defaultParams Accuracy)

**What:** The 3-layer amp resolution in `param-engine.ts` Layer 1 starts with `model.defaultParams`.
AMP_DEFAULTS (Layer 2) only overrides specific shared params (Drive, Master, Bass, Mid, Treble,
Presence, Sag, ChVol, Hum, Ripple, Bias, BiasX). Model-specific params like `Cut`, `Deep`,
`BrightSwitch` are preserved from Layer 1 as-is.

**The issue:** Some model-specific params in `models.ts` defaultParams are at their firmware
zero values, not at musically meaningful values.

**Audit targets:**

| Amp Model | Param | Current | Should Be | Why |
|-----------|-------|---------|-----------|-----|
| Vox AC30/AC15 | `Cut` | 0.50 | ~0.25-0.35 | Vox Cut is inverse treble — lower = brighter chime |
| JC-120 | `BrightSwitch` | 0 | 1 | JC-120's signature bright sound requires switch on |
| Placater/Placater Dirty | `Deep` | 0.50 | ~0.40 | Diezel Deep at 0.50 adds too much low-mid mud |
| Archon | `Master` | varies | 0.45-0.55 | PRS Archon's master is sensitive — mid-range is correct |

**Fix target:** Direct `defaultParams` edits in `models.ts`. No structural changes — pure
number updates verified against hardware knowledge and professional preset analysis.

---

## Data Flow

### Preset Generation Data Flow (v4.0 with Stadium unblocked)

```
User clicks "Generate" (Stadium selected)
        |
        v
POST /api/generate { messages, device: "helix_stadium", ... }
        |
        | [CHANGE: remove 400 response for helix_stadium]
        |
        v
callClaudePlanner(messages, "helix_stadium", toneContext?)
  |  buildPlannerPrompt(stadiumModelList, "helix_stadium")
  |  [CHANGE: richer prompt — gain-staging, cab pairing, effect discipline]
  |  stadiumModelList = Agoura_* amps only (already filtered)
  |  Claude Sonnet 4.6 structured output
        |
        v ToneIntent (ampName from STADIUM_AMPS, 0 numeric params)
        |
        v
assembleSignalChain(intent, "helix_stadium")   [NO CHANGE]
  |  Looks up amp in STADIUM_AMPS (strict device-aware lookup)
  |  [CHANGE: STADIUM_AMPS now has +6 missing amp IDs]
  |  Inserts mandatory blocks (boost, 7-band EQ, gain block)
  |  All blocks on dsp0, max 12 blocks (STAD-04)
  |  Returns BlockSpec[] with empty parameters
        |
        v
resolveParameters(chain, intent, "helix_stadium")   [CHANGE: +Layer 5]
  |  Layer 1: STADIUM_AMPS[intent.ampName].defaultParams
  |  Layer 2: AMP_DEFAULTS[ampCategory]
  |  Layer 3: TOPOLOGY_MID[topology]
  |  Layer 4: GENRE_EFFECT_DEFAULTS[genre]
  |  Layer 5 (NEW): EFFECT_COMBO_PARAMS adjustments
        |
        v
buildSnapshots(parameterized, intents)   [NO CHANGE]
  |  8-snapshot support already implemented (Stadium allows up to 8)
        |
        v
validatePresetSpec(presetSpec, "helix_stadium")   [CHANGE: HX2_* IDs]
  |  VALID_IDS now includes HX2_GateHorizonGateMono, HX2_EQParametricStereo, etc.
        |
        v
buildHspFile(presetSpec)   [REWRITE]
  |  FIXED: params use { value: X } not { access: "enabled", value: X }
  |  FIXED: block keys use slot-grid allocation (b05 for amp, b06 for cab)
  |  FIXED: type="fx" for all effect blocks
  |  FIXED: STADIUM_DEVICE_VERSION updated
        |
        v
JSON response { preset: hspFile.json, fileExtension: ".hsp", ... }
```

### Effect Combination Resolution Flow (Layer 5, all devices)

```
resolveParameters(chain, intent, device)
        |
        v [layers 1-4 as before]
        |
        v applyComboAdjustments(resolvedChain)   [NEW — Layer 5]
  |  Filter to effect blocks only (skip amp, cab)
  |  For each block, scan forward for typeB matches → apply adjustA
  |  For each block, scan backward for typeA matches → apply adjustB
  |  Clamp all adjustments to [0.0, 1.0]
  |  Return updated BlockSpec[]
```

---

## Scaling Considerations

Not applicable at current scale (Vercel free tier, single-user serverless). No new
infrastructure added in v4.0. The Stadium .hsp rebuild is additive — it enables an
existing device without adding any new API calls, database operations, or compute paths.

---

## Anti-Patterns

### Anti-Pattern 1: Cross-Device Fallback in Model Resolution

**What people do:** When a model isn't found in STADIUM_AMPS, fall back to AMP_MODELS.

**Why it's wrong:** Stadium amps use `Agoura_*` model IDs; Helix LT amps use `HD2_*`
model IDs. The firmware won't accept a non-Agoura amp model in a Stadium preset. If the
planner selects an amp name that resolves only in AMP_MODELS (because STADIUM_AMPS is
incomplete), the generated preset will fail on device.

**Do this instead:** Throw clearly if the amp isn't found in the device-appropriate catalog.
The fix is completing the STADIUM_AMPS catalog, not adding fallback logic.

Current code in `chain-rules.ts` already does this correctly:
```typescript
const ampModel = stadium
  ? STADIUM_AMPS[intent.ampName]  // strict Stadium lookup
  : AMP_MODELS[intent.ampName];   // strict Helix lookup
if (!ampModel) {
  throw new Error(`Unknown amp model: "${intent.ampName}"`);
}
```

### Anti-Pattern 2: Sequential Flow Keys in Stadium Builder

**What people do (current bug):** Assign `b01`, `b02`, `b03`... as sequential keys
regardless of block role.

**Why it's wrong:** Stadium firmware uses slot-based layout. The block key IS the slot
position. A gate at `b01` and an amp at `b03` with nothing at `b02` is fine — but an amp
at `b03` when it should be at `b05` will appear in the wrong position in HX Edit's
visual flow editor and may behave incorrectly.

**Do this instead:** Use canonical slot positions that match how real presets are built.
Gate at b01, boost at b02, amp at b05, cab at b06.

### Anti-Pattern 3: Copying Helix LT Param Format to Stadium

**What people do (current bug):** The original Stadium builder was written by analogy
to the preset-builder.ts that handles .hlx files. The .hlx format uses `{ "@model": "...",
"ParamKey": value }` flat style. The builder then used `{ access: "enabled", value: X }`
which appeared in some documentation examples.

**Why it's wrong:** The .hsp format uses `{ "slot": [{ "model": "...", "params": {
"ParamKey": { "value": X } } }] }`. The `access` field is NOT part of any real preset.

**Do this instead:** Always verify format against real device-generated files. The
reference corpus (10 real .hsp presets) is the ground truth.

---

## Integration Points

### New vs. Modified Components

| Component | Status | Integration Detail |
|-----------|--------|--------------------|
| `stadium-builder.ts` | REWRITE | 4 structural bugs corrected; existing `HspFile` type interface preserved |
| `models.ts` / `STADIUM_AMPS` | MODIFY | +6 Agoura amp entries; `AMP_NAMES` enum auto-updates since it's derived |
| `models.ts` / `AMP_MODELS` | MODIFY | defaultParams audit for model-specific controls (Cut, Deep, BrightSwitch) |
| `planner.ts` | MODIFY | Extend `buildPlannerPrompt()` with 3 new guidance sections; no schema change |
| `param-engine.ts` | MODIFY | Add `EFFECT_COMBO_PARAMS` constant + `applyComboAdjustments()` as Layer 5 |
| `validate.ts` | MODIFY | Add `HX2_*` and `VIC_*` model IDs to `getValidModelIds()` for Stadium |
| `config.ts` | MODIFY | `STADIUM_DEVICE_VERSION` updated from observed real file values |
| `/api/generate/route.ts` | MODIFY | Remove `helix_stadium` 400 guard after builder is verified end-to-end |

### External Service Boundaries (No Changes)

| Service | Integration | v4.0 Change |
|---------|-------------|-------------|
| Claude API | HTTPS via Anthropic SDK, structured output, prompt caching | NO CHANGE — model stays claude-sonnet-4-6 |
| Gemini API | HTTPS via Google AI SDK, SSE streaming, Google Search | NO CHANGE — already on Flash/Pro tiers |
| Supabase | Auth, Postgres, Storage | NO CHANGE — Stadium preset storage (.hsp) already implemented |
| Vercel | Serverless functions, static Next.js | NO CHANGE — no new routes or functions |

### Internal Module Boundaries

| Boundary | Communication | v4.0 Impact |
|----------|---------------|-------------|
| `planner.ts` → Knowledge Layer | `ToneIntent` struct | NO CHANGE — richer prompt produces better intents, same schema |
| `chain-rules.ts` → `param-engine.ts` | `BlockSpec[]` with empty params | NO CHANGE — same interface |
| `param-engine.ts` → `snapshot-engine.ts` | `BlockSpec[]` with filled params | NO CHANGE — Layer 5 runs inside param-engine before handoff |
| `snapshot-engine.ts` → `stadium-builder.ts` | `SnapshotSpec[]` | NO CHANGE — snapshot format unchanged |
| `models.ts` → `chain-rules.ts` | `STADIUM_AMPS` lookup | ADDITIVE — 6 more amp models available |
| `models.ts` → `tone-intent.ts` | `AMP_NAMES` enum | ADDITIVE — 6 new names added to valid choices |
| `validate.ts` → `generate/route.ts` | `validatePresetSpec()` throws | ADDITIVE — HX2_* IDs now pass validation |

---

## Build Order for v4.0 (with dependency rationale)

Dependencies flow as: Stadium catalog completeness → Stadium builder → Stadium unblock.
The quality improvements are independent of Stadium and can run in parallel.

### Phase 43 — Stadium Amp Catalog Completion (models.ts)

**Goal:** Add the 6 missing Agoura amp IDs. Unblocks Stadium from using amps that real
presets are built with.

**Files:** `src/lib/helix/models.ts` (STADIUM_AMPS section)

**Tasks:**
1. Add entries for: `Agoura_AmpRevvCh3Purple`, `Agoura_AmpSolid100`, `Agoura_AmpUSDoubleBlack`,
   `Agoura_AmpUSLuxeBlack`, `Agoura_AmpUSPrincess76`, `Agoura_AmpUSTweedman`
2. Assign `ampCategory`, `topology`, `cabAffinity`, and `defaultParams` by analogy to
   the real-world amp each model is based on (Revv Gen Ch3 = high_gain, Fender Twin = clean, etc.)
3. Update `STADIUM_DEVICE_VERSION` in `config.ts` to `301990015` (most common in real files)
4. Add `HX2_*` and `VIC_*` model IDs to `getValidModelIds()` in `validate.ts`

**Depends on:** Nothing — pure data additions

**Output:** `STADIUM_AMPS` has 18 amps; `AMP_NAMES` enum updates automatically; Stadium
presets can now use the full Agoura catalog.

---

### Phase 44 — Stadium Builder Rebuild (stadium-builder.ts)

**Goal:** Fix all 5 bugs. Generate .hsp files that load correctly on Stadium hardware.

**Files:** `src/lib/helix/stadium-builder.ts`

**Tasks:**
1. Fix param encoding: `{ value: X }` not `{ access: "enabled", value: X }` — every block
2. Fix block key numbering: implement slot-grid allocator using canonical positions
   (gate→b01, boost→b02, amp→b05, cab→b06, post-effects→b08-b12, output→b13)
3. Fix block type field: map `BlockSpec.type` to `"fx"` for all effect blocks; keep
   `"amp"`, `"cab"`, `"split"`, `"join"`, `"input"`, `"output"` as-is
4. Fix harness params: remove `access` field from harness `params` entries
5. Verify `buildStadiumSnapshots()` — snapshot format looked correct from real files
6. Add `cursor` field to preset JSON (real files always have this)
7. Validate against reference presets: build a known-good chain, compare JSON output
   against `Agoura_Bassman.hsp` structure

**Depends on:** Phase 43 (catalog complete so test presets use real amp IDs)

**Output:** Stadium presets load in HX Edit without errors; block positions match visual
expectation.

---

### Phase 45 — Stadium Device Unblock + End-to-End Test

**Goal:** Remove the 400 guard in `/api/generate/route.ts` and run full end-to-end tests.

**Files:** `src/app/api/generate/route.ts`

**Tasks:**
1. Remove the `helix_stadium` early-return 400 block (lines 36-39 in current code)
2. Run 5-10 real generation requests with Stadium device
3. Download each .hsp file and open in HX Edit — verify signal chain appears correctly
4. Verify snapshots load with correct names and block states
5. Verify amp parameters look musically sensible (not all zeros)

**Depends on:** Phase 44 (builder must be working before unblocking the UI)

**Output:** Stadium device is fully functional in production.

---

### Phase 46 — Planner Prompt Enrichment (planner.ts)

**Goal:** Improve AI creative choices through gain-staging, cab pairing, and effect discipline
guidance. Independent of Stadium work.

**Files:** `src/lib/planner.ts`

**Tasks:**
1. Add gain-staging intelligence section to `buildPlannerPrompt()`:
   - Minotaur for clean/crunch, Scream 808 for high-gain, never both
   - Compressor placement (always_on, early in chain, avoid high-gain)
2. Add amp+cab pairing guidance using `cabAffinity[]` data from models.ts:
   - US-type amps → open-back 1x12/2x12
   - Brit-type amps → closed-back 4x12 Greenback/V30
   - Vox-type → open-back 2x12
3. Add effect discipline by genre:
   - Metal: 2-3 effects maximum
   - Ambient/worship: 4-5 effects appropriate
   - Blues/country: 2-3 effects typical
4. Add cab affinity suggestion (AI should use cabAffinity model names when available)
5. Test: 5-8 representative tone requests; verify improved cab selections and effect counts

**Depends on:** Nothing — prompt-only change, no schema changes

**Can run in parallel with:** Phases 43-45

---

### Phase 47 — Per-Model Amp Param Audit + Effect Combo Layer (models.ts, param-engine.ts)

**Goal:** Fix model-specific parameter defaults; add Layer 5 effect combination intelligence.

**Files:** `src/lib/helix/models.ts`, `src/lib/helix/param-engine.ts`

**Tasks — models.ts:**
1. Audit `Cut` param on all Vox-type amps (AC30/AC15/Matchstick) — set to ~0.25-0.35
2. Audit `BrightSwitch` on JC-120 — set to 1 (on) for characteristic bright sound
3. Audit `Deep` on Diezel-type amps (Placater, Placater Dirty) — set to ~0.35-0.40
4. Audit `Master` on Archon/PRS amps — verify not over-compressing the output stage

**Tasks — param-engine.ts:**
1. Add `EFFECT_COMBO_PARAMS` constant array (4+ entries: comp→drive, mod→reverb,
   delay→reverb, drive→delay)
2. Implement `applyComboAdjustments(chain: BlockSpec[]): BlockSpec[]` function
3. Call `applyComboAdjustments()` at the end of `resolveParameters()` as Layer 5
4. Write unit tests for each combo: verify delta adjustments are applied correctly,
   non-matching blocks are unchanged, params are clamped to [0.0, 1.0]

**Depends on:** Nothing — pure Knowledge Layer, no interface changes

**Can run in parallel with:** Phases 43-45

---

### Dependency Graph

```
Phase 43 (Catalog)
    |
    v
Phase 44 (Builder Rebuild)
    |
    v
Phase 45 (Unblock + Test)

Phase 46 (Prompt Enrichment)    [parallel — no deps]
Phase 47 (Model Audit + Combo)  [parallel — no deps]
```

All 5 phases can be completed within a single sprint. Phases 43→44→45 are sequential
(each depends on the previous). Phases 46 and 47 are fully independent and can start
immediately alongside Phase 43.

---

## Sources

- Direct code inspection: `stadium-builder.ts`, `models.ts`, `param-engine.ts`, `chain-rules.ts`,
  `tone-intent.ts`, `types.ts`, `validate.ts`, `config.ts`, `planner.ts`, `generate/route.ts`
- Real .hsp file analysis: 10 presets from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/
  (Agoura_Bassman.hsp, Agoura_Hiwatt.hsp, Bigsby_Trem.hsp, NH_BoomAuRang.hsp,
  NH_Reflections.hsp, Purple Nurple.hsp, Stadium Rock Rig.hsp, Stadium_Billie_Joe.hsp,
  Stadium_Metal_Rhythm.hsp, Stadium_Rock_Rhythm.hsp)
- Anthropic Claude API pricing: https://www.anthropic.com/pricing (verified in usage-logger.ts)
- Previous v3.2 architecture research: .planning/research/ (prior ARCHITECTURE.md)

---
*Architecture research for: HelixTones v4.0 Stadium Rebuild + Preset Quality Leap*
*Researched: 2026-03-05*
