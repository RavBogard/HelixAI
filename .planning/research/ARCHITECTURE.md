# Architecture Research

**Domain:** AI-powered guitar preset generator (Planner-Executor pipeline with Knowledge Layer)
**Researched:** 2026-03-06
**Confidence:** HIGH — based on direct codebase analysis of current v4.0/v5.0 codebase, not inference

---

## Context: What This Document Covers

This document answers the four specific integration questions for the new milestone features:
1. Expression pedal controller assignment — where in the pipeline
2. Per-model effect guidance — how to flow into AI prompts without bloating tokens
3. Effect combination logic — where it lives (chain-rules vs param-engine vs prompt)
4. Per-device craft differences — encoding strategy (code vs prompts vs both)

The existing v4.0 Planner-Executor architecture is the foundation. This document maps new features to existing integration points.

---

## System Overview

```
+-------------------------------------------------------------------------+
|                         PLANNER LAYER (AI)                               |
|  +------------------------------------------------------------------+   |
|  |  callClaudePlanner() in planner.ts                               |   |
|  |  - getFamilyPlannerPrompt(device, modelList) via prompt-router   |   |
|  |  - getToneIntentSchema(family) — per-family constrained decoding |   |
|  |  - zodOutputFormat -> structured output, Zod belt-and-suspenders |   |
|  |  Output: ToneIntent (~15 fields: ampName, cabName, effects[],   |   |
|  |          snapshots[], guitarType, genreHint, tempoHint, ...)     |   |
|  +------------------------------------------------------------------+   |
+--------------------------------------+----------------------------------+
                                       | ToneIntent
                                       v
+-------------------------------------------------------------------------+
|                     KNOWLEDGE LAYER (Deterministic)                      |
|                                                                          |
|  +------------------+   +------------------+   +------------------+     |
|  |  chain-rules.ts  |   |  param-engine.ts |   | snapshot-engine  |     |
|  |                  |   |                  |   |     .ts          |     |
|  | assembleSignal   |   | resolveParameters|   | buildSnapshots() |     |
|  | Chain(intent,    +-->| (chain, intent,  +-->|                  |     |
|  | caps)            |   | caps)            |   | block states per |     |
|  |                  |   |                  |   | toneRole, ChVol  |     |
|  | - Block ordering |   | 4-layer param    |   | volume balancing |     |
|  | - DSP assignment |   | resolution:      |   |                  |     |
|  | - Mandatory block|   |  1. defaultParams|   |                  |     |
|  |   insertion      |   |  2. AMP_DEFAULTS |   |                  |     |
|  | - Block limits   |   |  3. Topology mid |   |                  |     |
|  | - Slot ordering  |   |  4. paramOverride|   |                  |     |
|  |                  |   |  5. Genre profile|   |                  |     |
|  |                  |   |  6. Tempo sync   |   |                  |     |
|  +------------------+   +------------------+   +------------------+     |
+------------------------------------------+------------------------------+
                                           | PresetSpec
                                           v
+-------------------------------------------------------------------------+
|                       BUILDER LAYER (Format)                             |
|                                                                          |
|  +--------------+  +--------------+  +--------------+  +------------+   |
|  | preset-      |  | podgo-       |  | stadium-     |  | stomp-     |   |
|  | builder.ts   |  | builder.ts   |  | builder.ts   |  | builder.ts |   |
|  |              |  |              |  |              |  |            |   |
|  | .hlx (JSON)  |  | .pgp (JSON)  |  | .hsp (JSON)  |  | .hlx       |   |
|  | Helix LT/    |  | Pod Go       |  | Stadium      |  | Stomp/XL   |   |
|  | Floor        |  |              |  |              |  |            |   |
|  +--------------+  +--------------+  +--------------+  +------------+   |
|                                                                          |
|  Builder responsibilities:                                               |
|  - DSP block slot grid allocation (sequential blockN keys)               |
|  - Controller section (snapshot @controller:19, EXP @controller:1/2)    |
|  - Footswitch section (@fs_enabled, @pedalstate bitmask)                |
|  - Input/Output system blocks (per-device model IDs)                    |
+-------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| `planner.ts` | AI call, structured output, Zod validation | Claude API, ToneIntent schema |
| `prompt-router.ts` | Device -> family prompt dispatch | families/{helix,stomp,podgo,stadium}/prompt.ts |
| `families/{f}/prompt.ts` | Per-family system prompt (planner + chat) | Shared sections, model list injection |
| `families/shared/*.ts` | gain-staging, tone-intent-fields, amp-cab-pairing sections | Pure text functions, cacheable |
| `chain-rules.ts` | ToneIntent -> ordered BlockSpec[] with DSP assignment | models.ts, device-family.ts |
| `param-engine.ts` | BlockSpec[] -> BlockSpec[] with all params filled | models.ts defaultParams + paramOverrides |
| `snapshot-engine.ts` | ToneIntent snapshots -> SnapshotSpec[] with block states | BlockSpec[], intent.snapshots |
| `validate.ts` | PresetSpec structural validation (strict + auto-fix) | caps, VALID_IDS |
| `preset-builder.ts` | PresetSpec -> .hlx JSON (Helix LT/Floor) | HlxFile type, CONTROLLERS |
| `podgo-builder.ts` | PresetSpec -> .pgp JSON | Pod Go-specific controller/snapshot format |
| `stadium-builder.ts` | PresetSpec -> .hsp JSON | Stadium-specific format |
| `stomp-builder.ts` | PresetSpec -> .hlx JSON (Stomp-specific) | Stomp block limits |
| `device-family.ts` | DeviceTarget -> DeviceCapabilities (single source of truth) | All caps consumers |
| `models.ts` | HelixModel database with defaultParams + paramOverrides + CONTROLLERS | All param resolution |
| `catalogs/{f}-catalog.ts` | Per-family EFFECT_NAMES, AMP_NAMES, CAB_NAMES tuples | ToneIntent schema enum construction |
| `tone-intent.ts` | ToneIntent Zod schema factory (per-family) | catalog tuples, constrained decoding |

---

## Specific Integration Answers

### Q1: Expression Pedal Controller Assignment — Where in the Pipeline?

**Answer: Builder layer (preset-builder.ts + sibling builders), gated by `caps.expressionPedalCount`.**

**Rationale from codebase analysis:**

The .hlx controller section already exists and is built by `buildControllerSection()` in `preset-builder.ts`. It currently writes `@controller: 19` (SNAPSHOT) entries. The `CONTROLLERS.EXP_PEDAL_1 = 1` and `CONTROLLERS.EXP_PEDAL_2 = 2` constants in `models.ts` confirm the infrastructure is ready and waiting.

Block key resolution (the `blockN` format required in the controller section) only exists after `buildDsp()` runs — it is a builder-time concept. Attempting EXP assignment in param-engine or chain-rules would require duplicating the block key computation, violating separation of concerns.

Device capability is already encoded: `DeviceCapabilities.expressionPedalCount` is correctly set for all 6 devices:
- Helix LT/Floor: 3
- Stomp/XL: 2
- Pod Go: 1
- Stadium: 0

**NOT in chain-rules:** Chain-rules handles structural signal chain ordering, not controller binding.
**NOT in param-engine:** Param-engine resolves parameter values, not controller assignments.
**NOT in the AI:** The AI does not understand Helix file format controller sections. The AI should express intent (e.g., "assign wah sweep to EXP1"), and the builder converts that intent to the correct `@controller` entry.

**Data flow for EXP assignment:**
```
ToneIntent.expPedalAssignments?: [{ effectType, paramName, pedal, minValue, maxValue }]
    |
    v (pass-through — chain-rules and param-engine ignore it)
PresetSpec.expPedalAssignments
    |
    v
buildControllerSection() [all 4 builders]
    |-- EXISTING: snapshot loop -> @controller: 19
    +-- NEW: EXP loop -> @controller: 1 or 2
             gated: caps.expressionPedalCount > 0
             mapped: findBlockByType(chain, effectType) -> blockKey
             output: controller[dspKey][blockKey][paramName] = {
               "@min": minValue, "@max": maxValue,
               "@controller": pedal === "exp1" ? 1 : 2
             }
```

**What changes:**
1. `tone-intent.ts`: Add optional `expPedalAssignments` array to ToneIntent schema
2. `types.ts`: Add `expPedalAssignments?: ExpPedalAssignment[]` to `PresetSpec`
3. All 4 builders: Extend `buildControllerSection()` with EXP pedal loop
4. `validate.ts`: Validate EXP assignments reference valid block types and pedal <= expressionPedalCount
5. All 4 family prompts: Add EXP assignment instructions (only when `expressionPedalCount > 0`)

### Q2: Per-Model Effect Guidance — How to Flow Into AI Prompts Without Bloating Tokens?

**Answer: Compact table in a new `families/shared/effect-guidance.ts` section, included in system prompt (cached), not per-request.**

**Rationale from codebase analysis:**

The system prompt is cached with `cache_control: { type: "ephemeral", ttl: "1h" }` in `planner.ts`. Once written, every call within 1 hour reuses the cached entry. Adding 400 tokens to the system prompt costs nothing after the first call — token cost is amortized entirely.

The pattern already exists: `families/shared/gain-staging.ts`, `families/shared/tone-intent-fields.ts`, and `families/shared/amp-cab-pairing.ts` are all pure functions returning strings, called by `buildPlannerPrompt()` in each family prompt file.

**Token budget:** Current prompts cache at approximately 3,000-5,000 tokens (estimated from prompt length). Per-model effect guidance should add no more than 300-500 tokens. Use markdown table format — scannable by the AI, short per entry, easy to maintain.

**What should be in the guidance table:**
- Non-obvious pairings (positive: "Adriatic Delay + subtle reverb = dimensional depth")
- Anti-combinations (negative: "Spring Reverb + heavy low-gain delay = muddy low-end clash")
- Positional requirements (wah pre-amp only, modulation post-cab only)
- Genre-specific model selection hints ("Ganymede Reverb = ambient/worship; avoid for metal")

**What should NOT be in the guidance table:**
- Raw parameter values — the AI doesn't set numeric values; param-engine handles this
- Exhaustive per-model documentation — already in `models.ts` defaultParams
- Hardware file format details — irrelevant to creative selection

**Example implementation:**
```typescript
// families/shared/effect-guidance.ts — NEW FILE
export function effectGuidanceSection(): string {
  return `## Effect Pairing Intelligence

| Effect | Best With | Avoid | Notes |
|--------|-----------|-------|-------|
| Simple Delay | Room/Hall Reverb | Spring Reverb (muddy) | Set reverb after delay in chain |
| Adriatic Delay | Light modulation | Heavy flanger (flutter clash) | Dimensional character |
| Ganymede Reverb | Subtle delay | Any other reverb | Ambient/worship; avoid metal |
| Particle Verb | Single delay line | Flangers/phasers | Shimmer character, needs space |
| Ubiquitous Vibe | Post-cab position | Pre-amp position | Loses character pre-amp |
| Compressor | Pre-amp position | Post-reverb | Kills reverb tail dynamics |
| Wah | Always pre-amp | Post-amp | Tonal character only pre-signal |
`;
}
```

**Injection point:** Inside each family's `buildPlannerPrompt()`, after `ampCabPairingSection()` and before the Effect Discipline by Genre section.

### Q3: Effect Combination Logic — Where Does It Live?

**Answer: Split between chain-rules.ts (context detection) and param-engine.ts (param adjustment). NOT in the AI prompt.**

**Rationale from codebase analysis:**

The existing param-engine already has a strong precedent for this pattern: genre profile is computed by `matchGenre()` and applied as Layer 5 (outermost non-tempo layer) in `resolveDefaultParams()`. Tempo sync is Layer 6. Effect combination adjustments become Layer 7 — a natural extension of this established pattern.

Chain-rules is the natural place to detect effect combinations because it already iterates all user effects to classify slots (the `classifyEffectSlot()` function). Building an `EffectCombinationContext` there adds minimal code without changing the function's contract.

**Why NOT in the AI prompt:** The AI doesn't set numeric parameters. Instructing the AI "when you include delay + reverb, reduce reverb Mix" is wrong — the AI cannot act on this. Prompt guidance for combinations should cover model selection ("avoid Spring Reverb with large delay — muddy interaction"), not parameter values.

**Concrete implementation boundary:**

```typescript
// chain-rules.ts — ADD after classifying user effects
interface EffectCombinationContext {
  hasDelay: boolean;
  hasReverb: boolean;
  hasModulation: boolean;
  hasDistortion: boolean;
  hasCompressor: boolean;
  delayModel?: string;
  reverbModel?: string;
}

function buildEffectCombinationContext(userEffects: PendingBlock[]): EffectCombinationContext {
  return {
    hasDelay: userEffects.some(e => e.blockType === "delay"),
    hasReverb: userEffects.some(e => e.blockType === "reverb"),
    hasModulation: userEffects.some(e => e.blockType === "modulation"),
    hasDistortion: userEffects.some(e => e.blockType === "distortion"),
    hasCompressor: userEffects.some(e => e.blockType === "dynamics"),
    delayModel: userEffects.find(e => e.blockType === "delay")?.model.name,
    reverbModel: userEffects.find(e => e.blockType === "reverb")?.model.name,
  };
}
// Return EffectCombinationContext alongside BlockSpec[] or thread through resolveParameters()

// param-engine.ts — Layer 7 after genre profile
function applyEffectCombinationAdjustments(
  block: BlockSpec,
  params: Record<string, number | boolean>,
  context: EffectCombinationContext,
  ampCategory: AmpCategory,
): void {
  // Delay + Reverb coexistence: prevent reverb wash burying the delay
  if (context.hasDelay && context.hasReverb && block.type === "reverb") {
    if ("Mix" in params && typeof params.Mix === "number") {
      params.Mix = Math.max(0.05, params.Mix - 0.05);
    }
    if ("PreDelay" in params && typeof params.PreDelay === "number") {
      params.PreDelay = Math.max(params.PreDelay, 0.025); // 25ms minimum
    }
  }
  // High-gain + Reverb: tighten reverb for crunch/metal context
  if (ampCategory === "high_gain" && block.type === "reverb") {
    if ("Mix" in params && typeof params.Mix === "number") {
      params.Mix = Math.max(0.05, params.Mix - 0.03);
    }
  }
  // Modulation + Delay: prevent flutter feedback buildup
  if (context.hasModulation && block.type === "delay") {
    if ("Feedback" in params && typeof params.Feedback === "number") {
      params.Feedback = Math.max(0.10, params.Feedback - 0.05);
    }
  }
}
```

**Ordered combination rules by quality impact:**
1. Delay + Reverb: reverb Mix -0.05, reverb PreDelay min 25ms (highest value — most common pairing)
2. High-gain amp + Reverb: reverb Mix -0.03 (very common in metal/hard rock)
3. Modulation + Delay: delay Feedback -0.05 (prevents flutter buildup)
4. High-gain amp + Modulation: modulation Depth -0.05 (tight metal context)
5. Compressor + Drive: optional; covered by prompt guidance (model selection level)

### Q4: Per-Device Craft Differences — Code vs Prompts vs Both?

**Answer: Both — constraints enforced in code via DeviceCapabilities, creative guidance encoded in per-family prompts.**

**In code (DeviceCapabilities — authoritative enforcement, non-negotiable limits):**

`device-family.ts` already captures all hardware constraints correctly:
- `maxBlocksTotal` / `maxBlocksPerDsp` / `maxEffectsPerDsp` — enforced by chain-rules + validate.ts
- `expressionPedalCount` — gates EXP controller injection in builders
- `mandatoryBlockTypes` — determines EQ + Gain Block insertion in chain-rules
- `dualAmpSupported` — gates secondAmpName/secondCabName processing
- `availableBlockTypes` — Pod Go excludes pitch/send_return

No new DeviceCapabilities fields are needed for the new milestone features. The existing fields cover all constraints.

**In prompts (per-family prompt.ts — creative guidance for optimal model selection):**

| Device Family | Craft Differences to Add in Prompt |
|---------------|-------------------------------------|
| Helix LT/Floor | EXP1 available for wah sweep/volume; EXP2 for modulation speed/reverb mix. 3 pedals total. Specific assignment guidance. |
| HX Stomp | No EXP unless external pedal connected — omit expPedalAssignments for safety. 2-5 effects max (already in prompt). |
| Pod Go | One EXP pedal. Most useful: volume block or wah. Avoid assigning EXP to modulation speed (no instant revert). |
| Stadium | No EXP pedal (expressionPedalCount: 0) — never suggest expPedalAssignments in Stadium prompt. |

**Why both code AND prompts are necessary:**
- Code enforces hard limits: even if the AI generates `expPedalAssignments: [{ pedal: "exp2" }]` for a Pod Go (which has 1 EXP), validate.ts catches it and the builder guard skips the invalid entry.
- Prompts enable intelligent selection: "choose 2-3 effects that matter most for Stomp" — the AI makes better selections when it understands the constraint rationale, not just the raw number. A prompt that says "max 2 effects" without rationale produces worse choices than one that explains "Stomp has 6 blocks total including amp+cab, leaving 4 for user effects but 2 is optimal for performance use."
- Prompts without code enforcement = guidelines the AI can violate. Code without prompt guidance = correct structure with suboptimal creative choices.

---

## Recommended Project Structure for New Features

```
src/lib/
├── helix/
│   ├── chain-rules.ts         MODIFIED — buildEffectCombinationContext() added
│   ├── param-engine.ts        MODIFIED — Layer 7 applyEffectCombinationAdjustments()
│   ├── models.ts              UNCHANGED — CONTROLLERS.EXP_PEDAL_1/2 already defined
│   ├── tone-intent.ts         MODIFIED — expPedalAssignments optional field
│   ├── device-family.ts       UNCHANGED — expressionPedalCount already correct
│   ├── validate.ts            MODIFIED — EXP assignment validation rule
│   ├── preset-builder.ts      MODIFIED — EXP pedal loop in buildControllerSection()
│   ├── podgo-builder.ts       MODIFIED — same EXP extension, 1 pedal only
│   ├── stomp-builder.ts       MODIFIED — same EXP extension, 2 pedals
│   ├── stadium-builder.ts     UNCHANGED — expressionPedalCount=0, guard skips
│   ├── snapshot-engine.ts     UNCHANGED — snapshot volume balancing unaffected
│   └── catalogs/
│       └── {family}-catalog.ts  UNCHANGED — effect names stay per-family
├── families/
│   ├── shared/
│   │   ├── gain-staging.ts       UNCHANGED
│   │   ├── amp-cab-pairing.ts    UNCHANGED
│   │   ├── tone-intent-fields.ts MODIFIED — document expPedalAssignments field
│   │   └── effect-guidance.ts    NEW — per-model effect pairing table
│   ├── helix/
│   │   └── prompt.ts             MODIFIED — EXP assignment guidance, effect-guidance section
│   ├── podgo/
│   │   └── prompt.ts             MODIFIED — single EXP pedal guidance, effect-guidance section
│   ├── stomp/
│   │   └── prompt.ts             MODIFIED — EXP availability note, effect-guidance section
│   └── stadium/
│       └── prompt.ts             MODIFIED — effect-guidance section (no EXP guidance)
└── planner.ts                    UNCHANGED — orchestration layer unaffected
```

---

## Data Flow

### Current Pipeline (Full)

```
User message
    |
    v
chat/route.ts (API route)
    |  conversation history
    v
callClaudePlanner(messages, device, family)
    |-- getFamilyPlannerPrompt(device, modelList) -> system prompt (cached ~1hr)
    |-- getToneIntentSchema(family) -> zodOutputFormat (constrained decoding)
    +-- Claude API call -> ToneIntent (JSON, ~15 fields)
         |
         v ToneIntent
assembleSignalChain(intent, caps)       [chain-rules.ts]
    +-- -> BlockSpec[] (type, modelId, modelName, dsp, position, path, params:{})
         |
         v BlockSpec[] (empty params)
resolveParameters(chain, intent, caps)  [param-engine.ts]
    +-- -> BlockSpec[] (all params filled via 6-layer lookup)
         |
         v BlockSpec[] + intent.snapshots
buildSnapshots(chain, intent.snapshots) [snapshot-engine.ts]
    +-- -> SnapshotSpec[] (block states, ChVol, LED colors, parameterOverrides)
         |
         v PresetSpec (signalChain + snapshots + name + tempo)
validatePresetSpec(spec, caps)          [validate.ts]
    +-- -> void (throws on structural error)
         |
         v PresetSpec (validated)
buildHlxFile(spec, device) OR          [builder layer — device-specific]
buildPgpFile(spec) OR
buildHspFile(spec)
    |-- buildDsp() — block grid (blockN keys, sequential per DSP)
    |-- buildControllerSection() — snapshot @controller:19 entries
    |                            + [NEW] EXP @controller:1/2 entries
    |-- buildFootswitchSection() — @fs_enabled, @pedalstate bitmask
    +-- -> HlxFile | PgpFile | HspFile (JSON serializable)
         |
         v JSON
Download response -> .hlx/.pgp/.hsp file
```

### New Feature: Expression Pedal Assignment

```
ToneIntent.expPedalAssignments?: [{
  effectType: "wah" | "volume" | "modulation" | "delay" | "reverb",
  paramName: string,   // e.g., "Mix", "Speed", "Depth"
  pedal: "exp1" | "exp2",
  minValue: number,    // 0.0 to 1.0
  maxValue: number,    // 0.0 to 1.0
}]
    |
    v (pass-through — chain-rules and param-engine ignore expPedalAssignments)
PresetSpec.expPedalAssignments (same structure)
    |
    v
buildControllerSection() in preset-builder.ts / podgo-builder.ts / stomp-builder.ts
    GUARD: if (!caps.expressionPedalCount) return; // Stadium skips entirely
    LOOP: for each expPedalAssignment
      1. Find the block matching effectType in spec.signalChain
      2. Resolve block key (blockN format via buildBlockKeyMap())
      3. Determine controllerNum: exp1 -> 1, exp2 -> 2
      4. Write: controller[dspKey][blockKey][paramName] = {
           "@min": minValue, "@max": maxValue,
           "@controller": controllerNum
         }
```

### New Feature: Effect Combination Logic

```
ToneIntent.effects[] (e.g., [Adriatic Delay, Ganymede Reverb])
    |
    v
chain-rules.ts — assembleSignalChain()
    EXISTING: iterate effects -> classify slots -> resolve DSP -> build PendingBlock[]
    NEW: buildEffectCombinationContext(userEffects)
         -> EffectCombinationContext { hasDelay, hasReverb, hasModulation, ... }
         Passed to resolveParameters() as additional parameter
    |
    v BlockSpec[] + EffectCombinationContext
param-engine.ts — resolveParameters(chain, intent, caps, effectContext)
    EXISTING Layers 1-6: model defaults -> category -> topology -> overrides -> genre -> tempo
    NEW Layer 7: applyEffectCombinationAdjustments(block, params, effectContext, ampCategory)
         Applied after genre (Layer 5) but before return
         Rules: delay+reverb -> reverb Mix-0.05, reverb PreDelay min 25ms
                high_gain+reverb -> reverb Mix-0.03
                modulation+delay -> delay Feedback-0.05
```

### New Feature: Per-Model Effect Guidance in Prompts

```
families/shared/effect-guidance.ts [NEW — pure function]
    effectGuidanceSection() -> compact markdown table string (300-500 tokens)
         |
         v (included once in system prompt — same for all calls, fully cached)
families/{family}/prompt.ts [MODIFIED]
    buildPlannerPrompt(device, modelList):
      + effectGuidanceSection() after ampCabPairingSection()
    Injection position: after amp-cab pairing, before Effect Discipline by Genre
         |
         v (system prompt cached at ~3,000-5,500 tokens total)
Claude Planner reads guidance table
    -> Selects effects that pair well together (evidence-based)
    -> Avoids anti-combinations
    -> Sets expPedalAssignments for wah/volume/modulation when device has pedal
```

---

## Integration Points: New vs Modified Components

### New Components

| Component | Location | Purpose | Dependencies |
|-----------|----------|---------|--------------|
| `effect-guidance.ts` | `src/lib/families/shared/` | Compact per-model effect pairing table. Pure function, no side effects, cacheable in system prompt. | None — pure function |

### Modified Components (in dependency order)

| Component | Change | Downstream Impact |
|-----------|--------|-------------------|
| `types.ts` | Add `ExpPedalAssignment` interface; add optional `expPedalAssignments` to `PresetSpec` | Builders read from PresetSpec — they need this type |
| `tone-intent.ts` | Add optional `expPedalAssignments` Zod array field to ToneIntent schema | Optional field — no breakage. Builders receive it via PresetSpec. |
| `families/shared/tone-intent-fields.ts` | Document `expPedalAssignments` field in prompt text | Prompt text only — no runtime impact |
| `families/shared/effect-guidance.ts` | NEW FILE | Must exist before family prompts include it |
| `families/helix/prompt.ts` | Add `effectGuidanceSection()` call; add EXP pedal guidance (3 pedals) | System prompt token count increases ~400 tokens; fully cached |
| `families/podgo/prompt.ts` | Add `effectGuidanceSection()` call; add EXP1 guidance (1 pedal, volume/wah best) | Same token impact, cached |
| `families/stomp/prompt.ts` | Add `effectGuidanceSection()` call; add EXP availability note | Same token impact, cached |
| `families/stadium/prompt.ts` | Add `effectGuidanceSection()` call; NO EXP guidance | Same token impact, cached |
| `chain-rules.ts` | Add `buildEffectCombinationContext()`. Thread context to return value or new param. | `resolveParameters()` signature gains `effectContext` param |
| `param-engine.ts` | Accept `EffectCombinationContext`; add Layer 7 `applyEffectCombinationAdjustments()` | `resolveParameters()` signature change — all callers must update |
| `preset-builder.ts` | Extend `buildControllerSection()` with EXP pedal loop | .hlx files gain `@controller: 1/2` entries for EXP-assigned blocks |
| `podgo-builder.ts` | Same EXP extension, single pedal only | .pgp files gain EXP entries (expressionPedalCount: 1) |
| `stomp-builder.ts` | Same EXP extension, dual pedal support | .hlx Stomp files gain EXP entries |
| `stadium-builder.ts` | No EXP change needed | expressionPedalCount: 0 — guard skips entirely |
| `validate.ts` | Add EXP assignment validation: effectType in chain, pedal <= expressionPedalCount | New validation rule, non-breaking |

### Unchanged Components

| Component | Reason |
|-----------|--------|
| `device-family.ts` | `expressionPedalCount` already correctly set for all 6 devices |
| `models.ts` | `CONTROLLERS.EXP_PEDAL_1 = 1`, `CONTROLLERS.EXP_PEDAL_2 = 2` already defined |
| `snapshot-engine.ts` | Volume balancing and snapshot structure unaffected |
| `planner.ts` | Orchestration unchanged — ToneIntent schema change is transparent |
| `prompt-router.ts` | Dispatch logic unchanged |
| `catalogs/*.ts` | Effect name tuples unchanged |

---

## Architectural Patterns

### Pattern 1: Capability-Gated Feature Injection

**What:** Every device-specific behavior gates on `DeviceCapabilities` (caps), not on device name strings. `expressionPedalCount` is already defined and correctly populated.

**When to use:** Any behavior that varies by hardware capability. EXP pedal assignment is canonical — Stadium has 0 pedals, PodGo has 1, Helix has 3.

**Trade-offs:** Compile-time exhaustiveness (exhaustive switch + assertNever) forces updates when new devices are added. More explicit than device name string checks.

**Example:**
```typescript
// In buildControllerSection() — capability-gated EXP injection
if (caps.expressionPedalCount > 0) {
  for (const assignment of spec.expPedalAssignments ?? []) {
    const controllerNum = assignment.pedal === "exp1"
      ? CONTROLLERS.EXP_PEDAL_1   // 1
      : CONTROLLERS.EXP_PEDAL_2;  // 2
    // Pod Go only has exp1 — skip exp2 if pedal count is 1
    if (assignment.pedal === "exp2" && caps.expressionPedalCount < 2) continue;
    const blockKey = findBlockByEffectType(spec.signalChain, assignment.effectType);
    if (!blockKey) continue;
    controller[dspKey][blockKey][assignment.paramName] = {
      "@min": assignment.minValue,
      "@max": assignment.maxValue,
      "@controller": controllerNum,
    };
  }
}
```

### Pattern 2: Layered Parameter Resolution (Extend, Don't Replace)

**What:** param-engine.ts resolves parameters in 6 deterministic layers. New intelligence adds as Layer 7 — never replaces existing layers.

**Current layer stack (verified from codebase):**
1. `model.defaultParams` — model-specific baseline
2. `AMP_DEFAULTS[ampCategory]` — category level (HD2 amps only)
3. `TOPOLOGY_MID` — topology-specific mid (HD2 high-gain only)
4. `model.paramOverrides` — per-model wins over all shared layers
5. `GENRE_EFFECT_DEFAULTS[genre]` — genre profile (outermost non-tempo)
6. Tempo sync — delay Time computed from BPM + subdivision

**Layer 7 — Effect combination adjustments (new):**
- Applied after genre profile (Layer 5), before final return
- Adjustments are small deltas (-0.03 to -0.05), never absolute overrides
- Only applies to blocks where the relevant params exist (`"Mix" in params`)

**Trade-offs:** Layer ordering matters — tempo must override genre delay Time. Combination adjustments must not override tempo sync. Document the order explicitly.

### Pattern 3: Shared Prompt Sections (Token Budget Control)

**What:** Device-agnostic knowledge lives in `families/shared/*.ts` as pure functions. All family prompts include these sections. The system prompt cache amortizes token cost — added once per cache TTL (1 hour), not per request.

**Token budget principle:** Keep per-model effect guidance under 500 tokens total. Use markdown tables (scannable, compact) not prose descriptions. Each row: model name, best pairing, what to avoid, one-line note.

**When to NOT add guidance:** Don't add guidance for effects where the optimal choice is obvious from the effect's name and category alone. Focus on non-obvious interactions (spring reverb + delay low-end clash; particle reverb needing space).

### Pattern 4: Builder-Level Controller Sections

**What:** The .hlx controller section maps parameters to hardware controllers (`@controller` value). Both snapshot-controlled (19) and EXP-controlled (1, 2) parameters write into the same section structure. The builder computes this after block positions are finalized.

**Key insight from codebase:** `buildControllerSection()` already uses `buildBlockKeyMap()` to translate block keys from `PresetSpec` references to the final `dspN.blockN` format used in the file. EXP assignment reuses this same mapping mechanism — finding the block by effect type, resolving its final key, then writing the controller entry.

---

## Anti-Patterns

### Anti-Pattern 1: EXP Assignment in param-engine.ts

**What people do:** Encode EXP controller ranges as part of parameter resolution, outputting `@controller` annotations from param-engine.

**Why it's wrong:** param-engine returns `Record<string, number | boolean>` — a flat parameter map. `@controller` is a file-format-level concept that belongs in the controller section structure, built at builder time. param-engine would need to understand builder output format, violating separation of concerns.

**Do this instead:** Pass `expPedalAssignments` from ToneIntent through PresetSpec to the builder. Let the builder write controller entries after block positions are finalized.

### Anti-Pattern 2: Effect Combination Logic as AI Instructions

**What people do:** Write prompt text like "when you include delay and reverb, note that reverb mix should be lower to avoid wash."

**Why it's wrong:** The AI does not set numeric parameters. The prompt correctly states: "Do NOT generate Drive, Master, Bass, Mid... or ANY numeric parameter values." Instructing the AI about numeric adjustments creates prompt-reality mismatch.

**Do this instead:** Put model selection guidance in the prompt ("avoid Spring Reverb with large delay — low-end frequencies clash"). Put numeric adjustments as deterministic Layer 7 in param-engine.

### Anti-Pattern 3: Device Name String Guards

**What people do:** `if (device === "helix_lt" || device === "helix_floor") { /* EXP */ }` — hardcoded device name strings.

**Why it's wrong:** The PROJECT.md identifies 17+ guard sites as technical debt that v5.0 is eliminating. Adding more device name guards is anti-pattern in the v5.0 direction. New guards require updating every time a device is added.

**Do this instead:** `if (caps.expressionPedalCount > 0)` for EXP guards. `if (caps.dualAmpSupported)` for dual-amp guards. `if (caps.mandatoryBlockTypes.includes("eq"))` for EQ insertion guards.

### Anti-Pattern 4: Bloated Per-Model Effect Table

**What people do:** Build a comprehensive per-model table listing all parameters, ranges, and interaction notes for every effect model.

**Why it's wrong:** 50+ effect models at 5 lines each = 1,000+ tokens added to every prompt. Even if cached, this pushes toward context limits on long conversations and increases cache storage cost.

**Do this instead:** Cover only non-obvious pairings (15-20 entries max). Skip models where the optimal behavior is self-evident. Target 300-500 tokens. The AI already understands reverb goes after amp — don't document the obvious.

---

## Build Order (with dependency rationale)

The following order minimizes blocked work and enables independent parallel execution where possible.

**Phase A — Foundation (no dependencies, can start immediately):**
1. `families/shared/effect-guidance.ts` — NEW file, pure function, zero deps
2. `families/shared/tone-intent-fields.ts` — add `expPedalAssignments` field documentation

**Phase B — Type layer (depends on: nothing; blocks: all downstream):**
3. `types.ts` — add `ExpPedalAssignment` interface, `expPedalAssignments` on `PresetSpec`
4. `tone-intent.ts` — add optional `expPedalAssignments` Zod field to ToneIntent schema

**Phase C — Knowledge layer (depends on: Phase B types; parallel with Phase D):**
5. `chain-rules.ts` — add `buildEffectCombinationContext()`, thread to resolveParameters
6. `param-engine.ts` — add `effectContext` parameter, add Layer 7 combination adjustments

**Phase D — Prompt layer (depends on: Phase A; parallel with Phase C):**
7. `families/helix/prompt.ts` — add effectGuidanceSection(), EXP assignment guidance
8. `families/podgo/prompt.ts` — add effectGuidanceSection(), EXP1 guidance (volume/wah)
9. `families/stomp/prompt.ts` — add effectGuidanceSection(), EXP availability note
10. `families/stadium/prompt.ts` — add effectGuidanceSection() only (no EXP)

**Phase E — Builder layer (depends on: Phase B types; parallel with C and D):**
11. `preset-builder.ts` — extend `buildControllerSection()` with EXP pedal loop
12. `podgo-builder.ts` — same EXP extension (single pedal guard)
13. `stomp-builder.ts` — same EXP extension (dual pedal support)
14. `stadium-builder.ts` — no change needed (expressionPedalCount: 0 guard skips)

**Phase F — Validation (depends on: all above; always last):**
15. `validate.ts` — add EXP assignment validation (effectType in chain, pedal count guard)

**Rationale:**
- Phases C and D are independent and can run in parallel after B
- Phase E can start after B (types) without waiting for C or D
- Phase F validates output of all phases — must be last

---

## Sources

- Direct codebase inspection of all files in `src/lib/helix/` and `src/lib/families/` (2026-03-06)
- `device-family.ts`: DeviceCapabilities interface, `expressionPedalCount` per device
- `models.ts`: `CONTROLLERS.EXP_PEDAL_1 = 1`, `CONTROLLERS.EXP_PEDAL_2 = 2` constants confirmed
- `types.ts`: `HlxControllerAssignment` interface (`@controller: number` field)
- `preset-builder.ts`: `buildControllerSection()` pattern, `buildBlockKeyMap()` utility
- `param-engine.ts`: 4-layer resolution + genre profile (Layer 5) + tempo sync (Layer 6) pattern
- `chain-rules.ts`: `classifyEffectSlot()`, `buildEffectCombinationContext()` integration point
- `families/shared/*.ts`: shared prompt section pattern (pure functions, cacheable)
- `planner.ts`: `cache_control: { type: "ephemeral", ttl: "1h" }` system prompt caching
- `.planning/PROJECT.md`: v5.0 goals, deferred effect combination note, 17+ guard site debt

---
*Architecture research for: HelixTones preset quality milestone — expression pedal, per-model effect intelligence, effect combination logic, per-device craft*
*Researched: 2026-03-06*
