# Architecture Research

**Domain:** Preset quality improvement and API cost optimization for HelixTones v4.0
**Researched:** 2026-03-04
**Confidence:** HIGH for integration patterns (code read directly); MEDIUM for model routing cost data (official pricing docs verified); MEDIUM for parallel path file format encoding (Helix internals partially specified)

---

## Context: What This Document Covers

This document covers the v4.0 Preset Quality Leap milestone. It answers:

- How preset quality improvements (smarter effect combos, nuanced params, parallel routing) integrate with the existing Planner-Executor architecture
- Which components change vs. which stay the same
- What new components are needed (if any)
- The build order with dependency rationale
- Architecture patterns for multi-model LLM cost optimization

The existing v3.1 architecture (Supabase auth, persistence, all 6 devices, planner-executor pipeline) is NOT re-researched. The focus is on integration points for quality and cost improvements only.

---

## System Overview — Current State (v3.1 Baseline)

```
+------------------------------------------------------------------+
|                       Frontend (Next.js)                          |
|  Chat UI | Device Picker | Signal Chain Viz | Preset Card         |
+------------------------------------------------------------------+
                |                        |
         SSE stream                POST /api/generate
                |                        |
+---------------+------------------------+-------------------------+
|                      API Layer (Vercel Serverless)               |
|                                                                   |
|   /api/chat                        /api/generate                 |
|   Gemini 2.5 Flash                 Claude Sonnet 4.6 (Planner)   |
|   + Google Search grounding        + Knowledge Layer pipeline     |
|   Standard tier: Flash             Prompt cache: ephemeral        |
|   Premium tier: Gemini 3.1 Pro     structured output (Zod)        |
+------------------------------------------------------------------+
                                        |
                                        | ToneIntent
                                        v
+------------------------------------------------------------------+
|                  Knowledge Layer (Deterministic)                  |
|                                                                   |
|  chain-rules.ts         param-engine.ts       snapshot-engine.ts  |
|  Block ordering         4-layer resolution    Volume balancing    |
|  DSP assignment         model defaults        Block state tables  |
|  Mandatory inserts      category overrides    intentRole toggling |
|  Device limits          topology mid adj.                         |
|                         genre effect defaults                     |
|                                                                   |
|  Device Builders: preset-builder | podgo-builder |                |
|                   stadium-builder | stomp-builder                 |
+------------------------------------------------------------------+
```

### Planner-Executor Data Flow (Current)

```
Conversation messages
        |
        v
  callClaudePlanner(messages, device, toneContext?)
  |  Claude Sonnet 4.6 — structured output via zodOutputFormat
  |  System prompt: cache_control: ephemeral (prompt cache hit ~90%)
  |  User message: conversation + optional toneContext (rig emulation)
        |
        v ToneIntent (~15 creative fields, zero numeric params)
        |
        v
  assembleSignalChain(intent, device)
  |  Resolves amp/cab/effect model names
  |  Classifies effects into ChainSlots (wah, compressor, extra_drive,
  |    boost, amp, cab, horizon_gate, eq, modulation, delay, reverb, gain_block)
  |  Inserts mandatory blocks (boost, gate, EQ, gain)
  |  Validates DSP block limits per device
  |  Returns BlockSpec[] with empty parameters
        |
        v
  resolveParameters(chain, intent)
  |  Layer 1: model.defaultParams (from models.ts)
  |  Layer 2: AMP_DEFAULTS[ampCategory]
  |  Layer 3: TOPOLOGY_MID[topology]  (high-gain only)
  |  Layer 4: GENRE_EFFECT_DEFAULTS[genreHint]  (outermost layer)
  |  Returns BlockSpec[] with all parameters filled
        |
        v
  buildSnapshots(parameterized, intents)
  |  ROLE_CHVOL volume balancing per snapshot
  |  ROLE_GAIN_DB lead boost (+2.5 dB)
  |  AMBIENT_MIX_BOOST delay/reverb mix in ambient snapshot
  |  intentRole-aware block toggling
        |
        v
  Device Builder -> .hlx / .pgp / .hsp + JSON response
```

### ToneIntent Contract — Current 15 Fields

The AI output is intentionally narrow. All numeric parameters are forbidden:
- `ampName`, `cabName`, `secondAmpName?`, `secondCabName?` — model selections
- `guitarType` — single_coil | humbucker | p90 (influences param defaults)
- `genreHint?` — string, drives GENRE_EFFECT_DEFAULTS lookup
- `effects[]` — up to 6 entries: `{modelName, role: "always_on"|"toggleable"|"ambient"}`
- `snapshots[]` — exactly 4: `{name, toneRole: "clean"|"crunch"|"lead"|"ambient"}`
- `tempoHint?`, `presetName?`, `description?`, `guitarNotes?` — metadata

---

## Component Responsibilities

| Component | Current Role | v4.0 Change |
|-----------|-------------|-------------|
| `planner.ts` / `buildPlannerPrompt()` | Claude API call, system prompt, structured output | MODIFY — richer effect combo guidance, routing mode instructions |
| `tone-intent.ts` / `ToneIntentSchema` | Zod schema for AI output contract | MODIFY — add optional `routingMode` field |
| `chain-rules.ts` / `assembleSignalChain()` | Block ordering, DSP assignment, mandatory blocks | MODIFY — add split/join slot handling for parallel paths |
| `param-engine.ts` / `resolveParameters()` | 4-layer parameter resolution | MODIFY — add Layer 5 effect combination tables; audit/improve defaultParams usage |
| `snapshot-engine.ts` / `buildSnapshots()` | Volume balancing, block state tables | NO CHANGE — interface is stable |
| `models.ts` | Model catalog with defaultParams | MODIFY — audit and improve defaultParams accuracy per model |
| `param-registry.ts` | Parameter encoding types | NO CHANGE — stable |
| `preset-builder.ts` | .hlx file serialization | MODIFY — add split/join block encoding for parallel_wetdry topology |
| `podgo-builder.ts`, `stadium-builder.ts`, `stomp-builder.ts` | Device-specific builders | NO CHANGE — parallel routing is Helix LT/Floor only |
| `types.ts` | BlockSpec, DeviceTarget, HlxDsp types | MINOR — add "split" and "join" to BlockSpec.type union if needed |
| `/api/chat/route.ts` | Gemini chat streaming | MINOR — add token usage logging |
| `/api/generate/route.ts` | Orchestration pipeline | MINOR — add token usage logging |
| `gemini.ts` | Gemini client and system prompt | NO CHANGE to model selection (already correct) |

---

## Recommended Project Structure (v4.0 additions)

```
src/lib/helix/
├── chain-rules.ts        # MODIFY — add parallel path slot + split/join insertion
├── param-engine.ts       # MODIFY — add EFFECT_COMBO_PARAMS table + Layer 5
├── param-registry.ts     # no change
├── snapshot-engine.ts    # no change
├── tone-intent.ts        # MODIFY — add routingMode optional field
├── models.ts             # MODIFY — audit/improve defaultParams per model
├── preset-builder.ts     # MODIFY — split/join block serialization into HlxDsp
├── podgo-builder.ts      # no change
├── stadium-builder.ts    # no change
├── stomp-builder.ts      # no change
├── types.ts              # MINOR — add split/join to BlockSpec.type if needed
├── config.ts             # no change
└── index.ts              # MINOR — re-export any new types

src/lib/
├── planner.ts            # MODIFY — richer system prompt (effect combos, routing)
└── gemini.ts             # no change

src/app/api/
├── chat/route.ts         # MINOR — token usage logging (LOG_USAGE env flag)
└── generate/route.ts     # MINOR — token usage logging (LOG_USAGE env flag)
```

---

## Architectural Patterns

### Pattern 1: ToneIntent Field Extension for Parallel Routing Mode

**What:** Extend ToneIntent with an optional `routingMode` field to let the AI signal when parallel signal path topology adds tonal value. Chain-rules reads this field to insert split/join blocks. AI still makes only a named topology choice — no numeric routing values.

**When to use:** Wet/dry splits (clean dry tone + wet delay/reverb on parallel path). Not for dual-amp (already implemented), not for Pod Go, Stomp, or Stadium (single-path devices).

**Trade-offs:**
- Keeps AI-deterministic boundary clean — AI chooses "parallel_wetdry", Knowledge Layer handles all block insertion and parameter values
- Backward-compatible: field is optional, existing presets use default "series" behavior
- New complexity in chain-rules, but isolated in a new conditional branch

**Example:**

```typescript
// tone-intent.ts addition
export const ToneIntentSchema = z.object({
  // ... existing fields ...
  routingMode: z.enum(["series", "parallel_wetdry"]).optional(),
  // series (default): all blocks on single path
  // parallel_wetdry: dry signal on path A, delay+reverb on path B
  // Note: "parallel_dualamp" is the existing secondAmpName pattern — not new
});
```

```typescript
// chain-rules.ts — parallel_wetdry handling (new branch)
if (routingMode === "parallel_wetdry") {
  // Split Y block inserted at end of amp/cab chain (after horizon_gate slot)
  // Path A: amp, cab, gate, boost, EQ, gain block (dry chain)
  // Path B: delay, reverb at configured mix (wet chain)
  // Merge block at end of path B
  // Effect: user gets pristine dry tone + lush ambient blend
}
```

```typescript
// types.ts — add to BlockSpec.type union if not already present
type BlockSpec = {
  type: "amp" | "cab" | "distortion" | "delay" | "reverb" | "modulation"
      | "dynamics" | "eq" | "wah" | "pitch" | "volume" | "send_return"
      | "split" | "join";  // NEW for parallel path topology
  // ...
}
```

Note: The HlxDsp type in `types.ts` already has `split?` and `join?` optional keys, confirming the .hlx format supports parallel path serialization. The existing dual-amp implementation uses `split` and `join` for AB topology — the parallel_wetdry path can reuse this infrastructure.

### Pattern 2: Effect Combination Tables (5th Resolution Layer)

**What:** Add `EFFECT_COMBO_PARAMS` tables in `param-engine.ts` that produce context-aware parameter adjustments when specific effect type combinations appear together in a chain. Applied as a fifth deterministic resolution layer after genre defaults.

**When to use:** When two effects have known interaction characteristics — compressor feeding overdrive, chorus before reverb, delay into reverb. Instead of independent defaults, the combination table adjusts the parameters of both effects to work well together.

**Trade-offs:**
- More lookup tables to maintain (acceptable — small, well-defined set)
- Keeps AI out of numeric decisions entirely (AI selects effects, Knowledge Layer handles interactions)
- Fully unit-testable: input chain → expected adjusted params

**Example:**

```typescript
// param-engine.ts addition — 5th resolution layer

interface EffectComboEntry {
  typeA: string;  // block type appearing earlier in chain
  typeB: string;  // block type appearing later in chain
  adjustA: Partial<Record<string, number>>;  // delta adjustments for block A
  adjustB: Partial<Record<string, number>>;  // delta adjustments for block B
}

const EFFECT_COMBO_PARAMS: EffectComboEntry[] = [
  {
    // Compressor into overdrive/distortion: reduce compressor output
    // so the drive character isn't compressed out of existence
    typeA: "dynamics",
    typeB: "distortion",
    adjustA: { Output: -0.08 },  // slight output reduction on compressor
    adjustB: {},
  },
  {
    // Chorus before reverb: reduce chorus depth to avoid washy interaction
    // at high reverb mix settings
    typeA: "modulation",
    typeB: "reverb",
    adjustA: { Depth: -0.08 },
    adjustB: {},
  },
  {
    // Delay into reverb: lower delay feedback to prevent reverb buildup
    typeA: "delay",
    typeB: "reverb",
    adjustA: { Feedback: -0.05 },
    adjustB: {},
  },
];

/**
 * Apply combination-aware parameter adjustments as the 5th resolution layer.
 * Called after resolveDefaultParams() (which includes genre overrides).
 * Only modifies params that EXIST on the block (no foreign params added).
 */
function applyComboAdjustments(chain: BlockSpec[]): BlockSpec[] {
  // Build type-indexed chain for combo lookup (skip cab, amp)
  const effectBlocks = chain.filter(b =>
    !["amp", "cab"].includes(b.type)
  );

  return chain.map(block => {
    const blockIdx = effectBlocks.indexOf(block);
    if (blockIdx === -1) return block;  // amp/cab passthrough

    const adjustedParams = { ...block.parameters };

    for (const combo of EFFECT_COMBO_PARAMS) {
      // Check if this block is typeA with a typeB later in chain
      if (block.type === combo.typeA) {
        const hasBAfter = effectBlocks.slice(blockIdx + 1).some(b => b.type === combo.typeB);
        if (hasBAfter && Object.keys(combo.adjustA).length > 0) {
          for (const [key, delta] of Object.entries(combo.adjustA)) {
            if (key in adjustedParams) {
              adjustedParams[key] = Math.max(0, Math.min(1, adjustedParams[key] + delta));
            }
          }
        }
      }
      // Check if this block is typeB with a typeA earlier in chain
      if (block.type === combo.typeB) {
        const hasABefore = effectBlocks.slice(0, blockIdx).some(b => b.type === combo.typeA);
        if (hasABefore && Object.keys(combo.adjustB).length > 0) {
          for (const [key, delta] of Object.entries(combo.adjustB)) {
            if (key in adjustedParams) {
              adjustedParams[key] = Math.max(0, Math.min(1, adjustedParams[key] + delta));
            }
          }
        }
      }
    }

    return { ...block, parameters: adjustedParams };
  });
}
```

### Pattern 3: Multi-Model Routing (Chat vs. Generation)

**What:** Route the two distinct AI workloads to different models based on task characteristics. Chat (conversational interview) uses a fast, cheap model with search grounding. Generation (structured ToneIntent) uses a high-quality model with structured output and prompt caching.

**Current state — already correct:**
- `/api/chat` uses Gemini 2.5 Flash ($0.30/M input, $2.50/M output) + Google Search
- `/api/generate` uses Claude Sonnet 4.6 ($3/M input, $15/M output) + prompt caching

The 10x cost difference between these models is justified by task requirements:
- Chat: conversational fluency + real-time web search for artist/gear research. Does NOT need structured JSON output or deep amp modeling knowledge.
- Generation: constrained JSON output (ToneIntentSchema), creative model selection from a curated catalog, structured output with zodOutputFormat. Quality of creative choices directly affects preset quality.

**v4.0 cost audit focus:** Measure token volumes per endpoint and cache hit rate. If cache hit rate drops below 80%, cold-start patterns need fixing. If output token count per generation call is unexpectedly high, investigate whether structured output schema complexity is causing verbose responses.

**Example — token usage audit logging:**

```typescript
// /api/generate/route.ts — add after client.messages.create()
if (process.env.LOG_USAGE === "true") {
  console.log(JSON.stringify({
    event: "planner_call",
    model: "claude-sonnet-4-6",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
    cache_hit_ratio: (response.usage.cache_read_input_tokens ?? 0) /
      Math.max(1, (response.usage.input_tokens ?? 1)),
  }));
}

// /api/chat/route.ts — add inside the stream end callback
if (process.env.LOG_USAGE === "true") {
  // Gemini SDK exposes usageMetadata on chunk — log it when stream closes
  console.log(JSON.stringify({
    event: "chat_call",
    model: modelId,
    // Gemini: usage accessible via stream completion metadata
  }));
}
```

**Model downgrade evaluation (post-audit only):**

If the audit shows generation costs dominate and quality evaluation shows acceptable ToneIntents from Claude Haiku 4.5, a switch would reduce generation cost from $3/$15 per million tokens to $1/$5 — a 3x reduction. However: Haiku 4.5 must produce comparable creative model selections (amp/cab pairings, effect choices, routing decisions). A structured A/B test is required before committing to any model downgrade on the generation path.

### Pattern 4: Richer Planner System Prompt (Creative Quality Lever)

**What:** Extend `buildPlannerPrompt()` in `planner.ts` with curated guidance on effect combinations, routing suggestions, and model pairing best practices. This is research-derived creative knowledge encoded as AI instructions — the AI's model/effect selections improve without touching the Knowledge Layer.

**When to use:** When the quality bottleneck is the AI's creative choices (which amp, which effects, which combinations) rather than the parameter values. The Knowledge Layer is already strong; the prompt instructs better inputs to it.

**Trade-offs:**
- Longer system prompt increases cache write cost on first cold-start call (one-time cost per deployment)
- Subsequent calls hit prompt cache at 90% discount — net impact is minimal at production volume
- Risk: prompt too prescriptive reduces AI creativity. Balance by framing as "guidelines" not "rules"

**Example additions to buildPlannerPrompt():**

```typescript
const COMBO_GUIDANCE = `
## Effect Combination Intelligence

Apply these curated guidelines when selecting effects:

**Boost selection (amp-category-aware):**
- Clean/crunch amps: include Minotaur (always_on) — adds harmonic richness and body
- High-gain amps: include Scream 808 (always_on) — tightens low end, preserves dynamics
- Never combine both Minotaur and Scream 808 in the same chain

**Compressor placement:**
- When including a compressor, assign it role "always_on" — it goes early in the chain
- Best for clean/crunch presets; avoid with high-gain amps (flattens pick dynamics)

**Effect ordering intent (chain-rules handles actual placement):**
- Modulation (chorus/flanger/phaser) pairs with delay — include both for richness
- Delay before reverb in your mental model: delay repeats feed into ambient space
- Ambient presets: use high Feedback and Mix values in your description, not numbers

**Parallel routing (routingMode field):**
- Use "parallel_wetdry" only when user specifically wants a clean dry tone with wet effects blended in
- Most presets: omit routingMode or use "series" — simpler is better
- NEVER use routingMode: "parallel_wetdry" for Pod Go, HX Stomp, or Stadium (single-path devices)

**Amp + cab pairing:**
- Fender-type amps (US Deluxe, Tweed, Matchstick) pair with open-back 1x12 or 2x12 cabs
- Marshall-type amps pair with closed-back 4x12 cabs
- Vox-type amps pair with open-back 2x12 cabs
- High-gain amps pair with tight, closed-back 4x12 cabs

**Effect count discipline:**
- 2-3 effects is typical for great presets; 5-6 only when the tone genuinely requires it
- Ambient/worship: 4-5 effects is appropriate (delay + reverb + modulation + volume/expression)
- Metal/high-gain: 2-3 effects (boost is mandatory, gate mandatory, 1-2 time effects maximum)
`;
```

### Pattern 5: Model-Specific Parameter Preservation

**What:** Audit `models.ts` defaultParams to ensure model-specific controls (Vox `Cut`, Diezel `Deep`, JC-120 `BrightSwitch`) are set accurately and are preserved correctly through the 3-layer resolution. The current code already only applies AMP_DEFAULTS keys — any key in `defaultParams` NOT in AMP_DEFAULTS is preserved. The improvement is ensuring those model-specific keys have correct values in the first place.

**When to use:** When specific amp models sound wrong because their unique controls (not in the generic AMP_DEFAULTS) are at incorrect values. This requires listening to hardware or referencing professional preset analyses.

**Trade-offs:** Requires per-model knowledge of how Vox Cut, Diezel Deep, etc. behave. The work is research-intensive (curating correct values) but the code change is minimal (updating numbers in models.ts).

**Example — model-specific parameter audit:**

```typescript
// models.ts — Vox-specific Cut control (lower = more treble retained; inverse!)
"Vox AC30 Fawn": {
  // ...
  defaultParams: {
    Drive: 0.30, Master: 0.85, ChVol: 0.70,
    Cut: 0.30,    // Vox Cut: 0.30 retains bright chime character
                  // AMP_DEFAULTS does NOT include Cut — preserved as-is
    Sag: 0.65, Bias: 0.50,
    Bass: 0.50, Mid: 0.55, Treble: 0.60,
    Presence: 0.30, Hum: 0.12, Ripple: 0.10, BiasX: 0.50,
  },
},

// Diezel-type amp with Deep control
"Placater Dirty": {
  // ...
  defaultParams: {
    Drive: 0.45, Master: 0.50, ChVol: 0.70,
    Deep: 0.40,   // Diezel Deep: mid-range adds thickness without mud
                  // Also preserved as-is (not in AMP_DEFAULTS)
    // ...
  },
},
```

---

## Data Flow

### Request Flow — Preset Generation (v4.0 with deltas marked)

```
User clicks "Generate"
        |
        v
POST /api/generate { messages, device, rigIntent?, rigText?, conversationId? }
        |
        +-- Rig path: mapRigToSubstitutions() -> toneContext string
        |
        v
callClaudePlanner(messages, device, toneContext?)
  |  buildPlannerPrompt(modelList, device)         [MODIFY: richer prompt]
  |  Claude Sonnet 4.6 structured output
  |  cache_control: ephemeral on system prompt
  |  ToneIntentSchema.parse(raw)                   [MODIFY: routingMode field]
        |
        v ToneIntent (15+ fields, zero numeric params)
        |
        v
assembleSignalChain(intent, device)                [MODIFY: split/join slots]
  |  Resolve amp, cab, optional second amp/cab
  |  Classify user effects into ChainSlots
  |  Insert mandatory blocks
  |  [NEW] If routingMode=parallel_wetdry: insert Split Y + Merge blocks
  |         assign wet effects (delay/reverb) to path B
  |  Sort by SLOT_ORDER, validate DSP limits
  |  Return BlockSpec[] with empty parameters
        |
        v
resolveParameters(chain, intent)                   [MODIFY: Layer 5]
  |  Layer 1: model.defaultParams
  |  Layer 2: AMP_DEFAULTS[ampCategory]
  |  Layer 3: TOPOLOGY_MID[topology]
  |  Layer 4: GENRE_EFFECT_DEFAULTS[genre]
  |  [NEW] Layer 5: EFFECT_COMBO_PARAMS[combo]
  |  Return BlockSpec[] with all parameters filled
        |
        v
buildSnapshots(parameterized, intents)             [no change]
        |
        v
Device builder                                     [MODIFY preset-builder.ts only]
  |  preset-builder.ts: [NEW] split/join block encoding in HlxDsp
  |  podgo-builder.ts, stadium-builder.ts, stomp-builder.ts: no change
        |
        v
JSON response -> client + Supabase storage (no change)
```

### Request Flow — Chat (No Changes Needed)

```
User message -> POST /api/chat
        |
        v
Gemini 2.5 Flash + Google Search grounding   [already cost-optimized]
Standard: gemini-2.5-flash
Premium:  gemini-3.1-pro-preview
        |
        v
SSE streaming -> frontend                    [no change]
```

The chat architecture is already correctly designed: Gemini Flash for cheap conversational AI with search, Claude Sonnet for structured preset generation. No changes needed to the routing structure.

### Key Data Flows for v4.0

1. **Parallel routing flow:** `ToneIntent.routingMode = "parallel_wetdry"` → `chain-rules.ts` inserts `BlockSpec` entries of type "split" (at `slot: "split_y"` position after cab) and "join" (at end of chain) → `param-engine.ts` resolves their minimal parameters (split has no params; join has A Level, B Level for dry/wet balance) → `preset-builder.ts` serializes them as `dsp0.split` and `dsp0.join` in the HlxDsp object. The existing `HlxDsp` type already has `split?` and `join?` optional keys.

2. **Effect combo context flow:** `resolveParameters()` calls `applyComboAdjustments(resolvedChain)` as the final step. The function scans the chain for type-pair combinations, applies delta adjustments to normalized params, and clamps to [0, 1]. No AI involvement — purely deterministic.

3. **Cost audit flow:** `LOG_USAGE=true` environment variable activates structured logging in both API routes. Logs output as JSON to Vercel function logs. Cost analysis uses Vercel log drain or manual export. No new infrastructure needed.

---

## Integration Points

### New vs. Modified Components Summary

| Component | Status | Integration Detail |
|-----------|--------|--------------------|
| `tone-intent.ts` | MODIFY | Add `routingMode?: z.enum(["series","parallel_wetdry"])` — optional, backward-compatible |
| `planner.ts` | MODIFY | Extend system prompt: effect combo guidance section, routing mode decision rules |
| `chain-rules.ts` | MODIFY | New ChainSlot values for split/join; new block insertion branch for parallel_wetdry; DSP budget check update when parallel is active (fewer effects allowed) |
| `param-engine.ts` | MODIFY | Add `EFFECT_COMBO_PARAMS` table; add `applyComboAdjustments()` as Layer 5; audit `models.ts` defaultParams values |
| `models.ts` | MODIFY | Audit and improve `defaultParams` accuracy for model-specific controls (Vox Cut, Diezel Deep, JC-120 BrightSwitch, etc.) |
| `preset-builder.ts` | MODIFY | Encode split/join blocks in HlxDsp; set `@topology0` to "SABJ" (split-AB-join) when parallel_wetdry mode; this is the same topology already used for dual-amp |
| `types.ts` | MINOR | Add `"split"` and `"join"` to `BlockSpec.type` union (if not already present) |
| `gemini.ts` | NO CHANGE | Already on correct model tier |
| `/api/chat/route.ts` | MINOR | Add optional token usage logging (behind LOG_USAGE env flag) |
| `/api/generate/route.ts` | MINOR | Add optional token usage logging; usage is already accessible on the response object |
| `snapshot-engine.ts` | NO CHANGE | Block state logic is type-based; split/join blocks will be skipped by cab exclusion logic |
| `podgo-builder.ts` | NO CHANGE | Parallel paths not supported on Pod Go |
| `stadium-builder.ts` | NO CHANGE | Parallel paths not in scope for Stadium (single-path generation) |
| `stomp-builder.ts` | NO CHANGE | Parallel paths not supported on Stomp |

### External Service Boundaries

| Service | Integration | v4.0 Change |
|---------|-------------|-------------|
| Claude API (generation) | HTTPS via `@anthropic-ai/sdk`, structured output, prompt caching | NO CHANGE — model stays claude-sonnet-4-6; monitor cache hit rate in audit |
| Gemini API (chat) | HTTPS via `@google/genai`, streaming, Google Search | NO CHANGE — already on Flash tier |
| Helix hardware (.hlx format) | JSON file serialization | MINOR — parallel_wetdry adds split/join keys to existing HlxDsp structure |

### Internal Module Boundaries

| Boundary | Communication | v4.0 Compatibility |
|----------|---------------|-------------------|
| `planner.ts` → `chain-rules.ts` | `ToneIntent` struct | Adding `routingMode` is backward-compatible (optional field) |
| `chain-rules.ts` → `param-engine.ts` | `BlockSpec[]` with empty `parameters` | New split/join blocks added; param-engine must handle them without error (resolve to empty params) |
| `param-engine.ts` → `snapshot-engine.ts` | `BlockSpec[]` with filled `parameters` | No interface change; split/join blocks will have empty parameters (they have no controllable params) |
| `snapshot-engine.ts` → device builders | `SnapshotSpec[]` | No interface change |

---

## Build Order for v4.0

Dependencies drive this order. Each phase can start only after its prerequisite interfaces are stable. Phases A and B can run in parallel.

### Phase A — Token Usage Audit (standalone, no interface changes)

**Goal:** Establish baseline cost data before any optimization decisions.

**Tasks:**
1. Add `LOG_USAGE` env variable check in `/api/generate/route.ts` after the Claude API call
2. Log structured JSON: model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens
3. Add similar logging to `/api/chat/route.ts` for Gemini usage metadata
4. Enable logging in staging for 48-72 hours with representative usage
5. Analyze: which endpoint costs more per request, what cache hit rate is, whether output token count is reasonable

**Files:** `/api/generate/route.ts`, `/api/chat/route.ts` (logging only)
**Depends on:** Nothing — standalone instrumentation
**Informs:** Phase E (model routing decision) and whether prompt prompt length needs trimming

---

### Phase B — Knowledge Layer Quality (modifies param-engine.ts and models.ts)

**Goal:** Improve preset parameter accuracy through better combo intelligence and model-specific defaults.

**Tasks:**
1. Audit `models.ts` defaultParams for 5-10 key amp models against known hardware behavior
2. Verify model-specific params (Cut, Deep, BrightSwitch) have realistic values in defaultParams
3. Add `EFFECT_COMBO_PARAMS` constant array in `param-engine.ts`
4. Implement `applyComboAdjustments()` function
5. Call `applyComboAdjustments()` at the end of `resolveParameters()` as Layer 5
6. Write unit tests in `param-engine.test.ts` for each combo case

**Files:** `src/lib/helix/param-engine.ts`, `src/lib/helix/models.ts`
**Depends on:** Nothing — pure Knowledge Layer, no ToneIntent changes
**Must complete before:** Phase D (parallel paths need param-engine to handle split/join blocks gracefully)

---

### Phase C — Planner Prompt Quality (modifies planner.ts only)

**Goal:** Improve AI creative decisions through richer system prompt guidance.

**Tasks:**
1. Add effect combination intelligence section to `buildPlannerPrompt()`
2. Add amp+cab pairing guidance leveraging the existing `cabAffinity[]` field
3. Add routing mode decision rules (`routingMode` field — but only instruct it, schema change is Phase D)
4. Add effect count discipline guidelines per genre/use-case
5. Test with 5-10 representative tone requests to validate improved effect selections

**Files:** `src/lib/planner.ts`
**Depends on:** Nothing — system prompt only, no schema changes needed
**Can run in parallel with:** Phase B

---

### Phase D — ToneIntent + Parallel Path Infrastructure

**Goal:** Enable parallel_wetdry routing as an AI-selectable topology.

**Tasks:**
1. Add `routingMode?: z.enum(["series","parallel_wetdry"])` to `ToneIntentSchema` in `tone-intent.ts`
2. Add `"split"` and `"join"` to `BlockSpec.type` union in `types.ts`
3. Add `split_y` and `merge` entries to `SLOT_ORDER` and `ChainSlot` in `chain-rules.ts`
4. Implement parallel path block insertion branch in `assembleSignalChain()`:
   - When `routingMode === "parallel_wetdry"`: add Split Y block after cab, assign delay/reverb blocks to path=1, add Merge block at end
   - Enforce tighter effect count (max 2 time effects in parallel mode due to DSP budget)
5. Extend `preset-builder.ts` to serialize split/join blocks:
   - Set `dsp0.split` with `@model: "HD2_AppDSPFlowSplitY"`, `@position`, `@enabled: true`
   - Set `dsp0.join` with `@model: "HD2_AppDSPFlowJoin"`, `@position`, level params
   - Set `@topology0: "SABJ"` in `dsp0` global (same topology used by dual-amp)
6. Update `chain-rules.ts` DSP block limit check to account for split/join blocks
7. Test: generate a parallel_wetdry preset, import into HX Edit, verify signal path display

**Files:** `tone-intent.ts`, `types.ts`, `chain-rules.ts`, `preset-builder.ts`
**Depends on:** Phase B (param-engine must handle split/join block types), Phase C (prompt must instruct routingMode usage)
**Must complete before:** End-to-end parallel path testing

---

### Phase E — Model Routing Decision (informed by Phase A data)

**Goal:** Make an evidence-based decision on whether any model changes reduce cost without quality loss.

**Decision tree based on Phase A findings:**

| Finding | Action |
|---------|--------|
| Generation cache hit rate < 80% | Fix cold-start pattern; investigate if system prompt changes too frequently |
| Chat tokens dominate cost | Evaluate Gemini Flash Lite for standard tier (already cheaper than Flash) |
| Generation output tokens high (> 500 per call) | Investigate why — structured output should be compact (~200 tokens) |
| Generation model produces acceptable quality on Haiku 4.5 | A/B test on 100 representative requests; if quality is maintained, switch |
| All costs reasonable for current scale | No changes needed — proceed to maintenance mode |

**Files:** `planner.ts` (model name change only if downgrade approved), `gemini.ts` (model tier if downgrade)
**Depends on:** Phase A data analysis
**May be:** Zero-change phase if current architecture is already efficient

---

## Anti-Patterns

### Anti-Pattern 1: AI-Generated Numeric Parameters

**What people do:** Extend ToneIntent with Drive, Mix, LowCut, HighCut, or other numeric fields and ask the AI to fill them.

**Why it's wrong:** LLMs hallucinate numeric parameter values. They have no internal model of how `Drive: 0.73` sounds on a specific Helix amp model. This was the root cause of mediocre preset quality before v1.0 rebuilt the system with the Planner-Executor pattern.

**Do this instead:** Keep ToneIntent strictly creative (model names, roles, topology choice). All numeric parameters come from the deterministic Knowledge Layer lookup tables. If a new quality dimension needs improvement, encode the improvement in the Knowledge Layer, not in the AI output.

---

### Anti-Pattern 2: Same Model for Both Chat and Generation

**What people do:** Consolidate to a single AI provider for simplicity — use Claude Sonnet 4.6 for both chat and generation.

**Why it's wrong:** Chat benefits from Gemini's Google Search grounding (artist/rig research) and lower latency at lower cost. Gemini 2.5 Flash costs ~$0.30/M input vs. Claude Sonnet 4.6 at $3/M input — 10x more expensive for conversational tasks that don't require structured JSON output. Additionally, structured output (zodOutputFormat) is specific to the Anthropic SDK — it's not available in Gemini without additional tooling.

**Do this instead:** Keep the existing split. Chat on Gemini Flash for speed/cost/search. Generation on Claude Sonnet for structured output quality and prompt caching.

---

### Anti-Pattern 3: Parallel Paths on Single-DSP Devices

**What people do:** Enable `routingMode: "parallel_wetdry"` for Pod Go, HX Stomp, or Stadium presets.

**Why it's wrong:** Pod Go and HX Stomp are single-DSP devices — they cannot split signal paths within a preset. Stadium is a single-path generation target in the current implementation. Adding split/join blocks to these device presets produces files that either fail to load or silently fall back to a default routing on hardware.

**Do this instead:** Chain-rules must validate that `parallel_wetdry` is only allowed for `helix_lt` and `helix_floor` devices. Reject or downgrade to "series" for all other DeviceTargets. The planner prompt must also include explicit device restriction notes (already established pattern — see Pod Go dual-amp restriction in current prompt).

---

### Anti-Pattern 4: Invalidating Prompt Cache with Incremental Prompt Edits

**What people do:** Tweak the planner system prompt word by word across multiple deployments.

**Why it's wrong:** Claude prompt caching works on exact hash match. Every change to the system prompt text invalidates the cache, causing full cache-write cost on the next N calls until the cache warms. At production volume with a ~3000-token system prompt, repeated cache misses accumulate non-trivial cost.

**Do this instead:** Batch all system prompt improvements into Phase C as a single deployment. Test in staging to confirm quality before deploying. Accept the one-time cache re-warm cost of a single milestone deployment rather than many small invalidations.

---

### Anti-Pattern 5: Adding Effect Combo Logic to the AI Prompt Instead of Knowledge Layer

**What people do:** Add instructions like "when you include chorus and reverb, make sure their interaction sounds good" to the planner system prompt.

**Why it's wrong:** The AI cannot set numeric parameters. It can only choose which effects to include. Prompt instructions about parameter interactions are unactionable because ToneIntent contains zero numeric fields. The AI will select chorus and reverb — it cannot adjust their Depth or Mix to compensate for their interaction.

**Do this instead:** Encode interaction intelligence in `EFFECT_COMBO_PARAMS` in `param-engine.ts`. When the Knowledge Layer detects chorus→reverb in the chain, it automatically adjusts Depth and Mix with deterministic delta values. This is testable, predictable, and independent of AI output quality.

---

### Anti-Pattern 6: Parallel Path Without Accounting for DSP Budget

**What people do:** Add split/join blocks to a preset that already has the maximum effect count.

**Why it's wrong:** Split and Join each consume one block position in DSP0. For Helix LT (max 8 non-cab blocks per DSP), adding parallel path topology reduces the available user effect slots. A preset with boost + amp + gate + EQ + gain + split + join already has 7 DSP0 blocks before any user effects — leaving only 1 user effect slot, less than the current 2-4 that users expect.

**Do this instead:** When `routingMode === "parallel_wetdry"` is detected in chain-rules, enforce a tighter effect count limit (max 2 time-based effects). Move delay and reverb to path B (the wet path). This is the correct parallel path pattern: dry chain on path A, wet effects on path B.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (~hundreds req/day) | Current architecture is correct. Audit baseline costs in Phase A before any changes. |
| 1k-10k req/day | Prompt caching becomes critical — ensure system prompt changes are milestone-level, not per-commit. Add monitoring for cache hit rate. |
| 10k+ req/day | Evaluate Claude Haiku 4.5 for generation (3x cheaper than Sonnet). Requires quality A/B test. Add request queue if Vercel concurrency limits are hit. |

### Scaling Priorities

1. **First bottleneck — API cost:** Prompt cache hit rate below 80% is the primary risk. Each cache miss costs ~$0.01-0.03 in system prompt tokens. At 10k requests/day with 20% miss rate, this is $200-600/day in avoidable cost. Fix: ensure system prompt changes only happen at milestone boundaries.

2. **Second bottleneck — generation latency:** Claude structured output calls take 3-8 seconds. Streaming is unavailable for structured output (single JSON object response). This is a known architectural constraint — not addressable in v4.0 without changing to a generation model that supports streaming JSON schema output (Gemini does, but lacks zodOutputFormat integration).

3. **Third bottleneck (future) — model routing:** If scale justifies it, a lightweight classifier layer (a single Claude Haiku call asking "Is this a simple tone request or a complex research request?") can route complex artist research requests to a larger model while handling simple requests with Haiku for generation. At current scale, this adds unnecessary complexity.

---

## Sources

- Claude Sonnet 4.6 vs Haiku 4.5 pricing: [Claude API Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — HIGH confidence (official)
- Structured Outputs GA (all models including Haiku 4.5): [Claude Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) | [Hands-on guide](https://towardsdatascience.com/hands-on-with-anthropics-new-structured-output-capabilities/) — HIGH confidence
- Prompt caching 90% read discount: [Claude Prompt Caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official)
- Gemini Flash pricing 2026: [Gemini API pricing](https://costgoat.com/pricing/gemini-api) — MEDIUM confidence (third-party; cross-verified against Google's pricing structure)
- Multi-model LLM routing patterns: [AWS Multi-LLM routing](https://aws.amazon.com/blogs/machine-learning/multi-llm-routing-strategies-for-generative-ai-applications-on-aws/) | [Google Cloud model routing guide](https://medium.com/google-cloud/a-developers-guide-to-model-routing-1f21ecc34d60) | [RouteLLM framework](https://github.com/lm-sys/RouteLLM) — HIGH confidence (multiple authoritative sources)
- Helix parallel path routing and split block types: [Line 6 Helix signal path routing](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) | [Sweetwater bi-amp guide](https://www.sweetwater.com/insync/double-best-line-6-helix-tone/) — HIGH confidence
- Helix split/join in HlxDsp: Direct inspection of `types.ts` (`HlxDsp.split?`, `HlxDsp.join?`) and `preset-builder.ts` in this codebase — HIGH confidence (ground truth)
- ToneIntent schema and Knowledge Layer pipeline: Direct inspection of `tone-intent.ts`, `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts` — HIGH confidence (ground truth)
- Gemini structured output JSON Schema support: [Google Gemini structured output docs](https://ai.google.dev/gemini-api/docs/structured-output) — HIGH confidence (official)
- Claude Haiku 4.5 quality comparison: [DevTK pricing guide](https://devtk.ai/en/blog/claude-api-pricing-guide-2026/) | [Anthropic Haiku page](https://www.anthropic.com/claude/haiku) — MEDIUM confidence

---

*Architecture research for: HelixTones v4.0 — Preset Quality Leap + API Cost Optimization*
*Researched: 2026-03-04*
