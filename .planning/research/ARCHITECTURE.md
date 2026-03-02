# Architecture Research

**Domain:** AI-powered Helix preset generation — v1.1 feature integration
**Researched:** 2026-03-02
**Confidence:** HIGH (direct codebase inspection + official Claude API docs)

---

## Context: What This Document Covers

This document addresses v1.1 specifically: how six new features integrate with the existing Planner-Executor architecture. The v1.0 architecture (already implemented and working) is documented in `.planning/codebase/ARCHITECTURE.md`. This document focuses on integration points, new components, data flow changes, and build order for v1.1.

---

## Existing Architecture (Stable, Do Not Change)

```
User Chat (Gemini SSE)
        |
        | conversation history
        v
[callClaudePlanner()]           planner.ts
        |
        | ToneIntent (~15 fields)
        v
[assembleSignalChain()]         chain-rules.ts
[resolveParameters()]           param-engine.ts
[buildSnapshots()]              snapshot-engine.ts
        |
        | PresetSpec
        v
[validatePresetSpec()]          validate.ts
[buildHlxFile()]                preset-builder.ts
        |
        | HlxFile JSON + summary + spec + toneIntent
        v
POST /api/generate response     api/generate/route.ts
        |
        v
page.tsx preset card            (summary as ReactMarkdown)
```

The Knowledge Layer (chain-rules, param-engine, snapshot-engine) is deterministic. The Planner (Claude with structured output) is the only AI call in the generation path. This separation is intentional and must be preserved.

---

## Standard Architecture (v1.1 Additions)

### System Overview

```
User Chat (Gemini SSE)
        |
        | conversation history
        v
[callClaudePlanner()]           planner.ts  <-- ADD: cache_control on system prompt
        |
        | ToneIntent
        v
[assembleSignalChain()]         chain-rules.ts  (unchanged)
[resolveParameters()]           param-engine.ts  <-- ADD: genre-aware effect param tables
[buildSnapshots()]              snapshot-engine.ts  <-- MODIFY: smarter toggle logic
        |
        | PresetSpec
        v
[validatePresetSpec()]          validate.ts  (unchanged)
[buildHlxFile()]                preset-builder.ts  <-- FIX: @fs_enabled + @pedalstate bugs
        |
        | HlxFile JSON + summary + spec + toneIntent
        v
POST /api/generate response     <-- ADD: signalChainViz[] to response
        |
        v
page.tsx preset card            <-- ADD: ToneDescriptionCard + SignalChainViz components
```

---

## Component Responsibilities (v1.1 delta)

| Component | v1.0 State | v1.1 Change |
|-----------|------------|-------------|
| `planner.ts` | Calls Claude without caching | Add `cache_control: { type: "ephemeral" }` to `client.messages.create()` — caches the system prompt (model list + instructions) on first call; each subsequent call reads from cache at 0.10x token cost |
| `param-engine.ts` | Uses model `defaultParams` for delay/reverb/modulation | Add genre-aware lookup tables for effect parameters keyed on `ToneIntent.genreHint` |
| `snapshot-engine.ts` | `getBlockEnabled()` uses fixed rules for delay (lead+ambient), modulation (ambient only) | Extend rules: ambient snapshot enables reverb+delay at higher mix; clean snapshot disables all drive blocks; crunch enables boost but disables delay |
| `preset-builder.ts` | `@fs_enabled: false` hardcoded; `@pedalstate: 2` hardcoded | Fix `@fs_enabled` to `true`; compute `@pedalstate` per-snapshot from active stomp assignments |
| `api/generate/route.ts` | Returns `{ preset, summary, spec, toneIntent, device }` | Add `signalChainViz` to response: derives from `presetSpec.signalChain`, no new computation needed |
| `page.tsx` | Renders summary as ReactMarkdown in preset card | Add `ToneDescriptionCard` component (structured summary); add `SignalChainViz` component (block diagram) |

---

## Recommended Project Structure (v1.1 additions)

```
src/
├── app/
│   ├── api/
│   │   └── generate/
│   │       └── route.ts         MODIFY — add signalChainViz to response shape
│   └── page.tsx                 MODIFY — add two new UI components inline or extracted
│
└── lib/
    ├── planner.ts               MODIFY — add cache_control to client.messages.create()
    └── helix/
        ├── param-engine.ts      MODIFY — add GENRE_EFFECT_DEFAULTS lookup table
        ├── snapshot-engine.ts   MODIFY — extend getBlockEnabled() for ambient/clean rules
        ├── preset-builder.ts    FIX — @fs_enabled + per-snapshot @pedalstate
        ├── viz.ts               NEW — buildSignalChainViz() pure function
        └── index.ts             MODIFY — export buildSignalChainViz
```

No new API routes needed. No new npm packages needed. All six features integrate with existing files or add one new utility module.

---

## Feature Integration Details

### Feature 1: Prompt Caching

**Integration point:** `src/lib/planner.ts`, function `callClaudePlanner()`

**What changes:** One field addition to `client.messages.create()`. The Anthropic SDK v0.78.0 supports top-level `cache_control` on `MessageCreateParamsBase`. This caches everything in the request up to the last cacheable block — in practice, the entire system prompt including the model list (the longest and most stable content).

**Before:**
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: systemPrompt,
  messages: [{ role: "user", content: conversationText }],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});
```

**After:**
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  cache_control: { type: "ephemeral" },  // <-- single line addition
  system: systemPrompt,
  messages: [{ role: "user", content: conversationText }],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});
```

**Cost mechanics:** System prompt + model list is roughly 800-1200 tokens. At Sonnet 4.6 pricing: $3/MTok base, $3.75/MTok write, $0.30/MTok read. First call costs 1.25x, every subsequent call within 5 minutes costs 0.10x. For a session where the user iterates (e.g., generates 3 presets), calls 2 and 3 save ~90% of input token cost on the system prompt portion. Since the system prompt is ~60-70% of total input tokens per generation call, this yields roughly 50-60% overall input token savings per session.

**Constraint:** The 5-minute TTL means caching helps within a session (multiple generates) but not across sessions. This is the expected use case — a user typically generates 1-3 presets in one sitting.

**Compatibility:** `cache_control` at top level is available in Anthropic SDK `^0.78.0` (currently installed). The field coexists with `output_config` — both are independent parameters on `MessageCreateParamsBase`. No incompatibility.

**Confidence:** HIGH — verified in SDK type definitions at `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` line 2643, and cross-referenced with official Anthropic docs.

---

### Feature 2: Genre-Aware Effect Defaults

**Integration point:** `src/lib/helix/param-engine.ts`, function `resolveDefaultParams()`

**Current behavior:** Delay, reverb, and modulation blocks use `model.defaultParams` directly from `models.ts`. The defaults are reasonable but genre-agnostic — a blues delay sounds the same as a metal delay.

**What changes:** Add a `GENRE_EFFECT_DEFAULTS` lookup table in `param-engine.ts`. The `resolveParameters()` function already receives `ToneIntent` as its second argument (for `ampName` lookup). `genreHint` is on `ToneIntent` and available. No signature changes needed.

**New lookup table structure:**
```typescript
// Maps genreHint keywords to parameter overrides by block type
const GENRE_EFFECT_DEFAULTS: Record<string, Partial<Record<BlockSpec["type"], Record<string, number>>>> = {
  blues:      { delay: { Mix: 0.25, Time: 0.45 }, reverb: { Mix: 0.20 } },
  metal:      { delay: { Mix: 0.15, Time: 0.35 }, reverb: { Mix: 0.10 } },
  ambient:    { delay: { Mix: 0.45, Time: 0.60 }, reverb: { Mix: 0.40 } },
  country:    { delay: { Mix: 0.30, Time: 0.40 }, reverb: { Mix: 0.15 } },
  jazz:       { delay: { Mix: 0.20 }, reverb: { Mix: 0.25 }, modulation: { Mix: 0.30 } },
  worship:    { delay: { Mix: 0.40, Time: 0.55 }, reverb: { Mix: 0.35 } },
  rock:       { delay: { Mix: 0.20 }, reverb: { Mix: 0.15 } },
};
```

**Resolution flow:**
```
resolveDefaultParams(block, ampCategory, genreHint)
  1. Get model.defaultParams (base)
  2. Normalize genreHint to a keyword (lowercase, strip qualifier words)
  3. Look up GENRE_EFFECT_DEFAULTS[keyword]?.[block.type]
  4. Merge: { ...modelDefaults, ...genreOverrides }
  5. Return merged params
```

**Keyword normalization:** `genreHint` from Claude is a free-form string (e.g., "blues rock", "modern metal", "80s new wave"). Need to match against known keywords by substring. Simple approach: iterate known genre keys, check if `genreHint.toLowerCase().includes(key)`. First match wins. If no match, fall through to model defaults unchanged.

**Signature change required:** `resolveDefaultParams` is currently private (not exported). The `resolveParameters()` function passes `intent` down to `resolveBlockParams()` which currently does not accept genreHint. Need to thread `intent.genreHint` through: `resolveParameters() → resolveBlockParams() → resolveDefaultParams()`.

**Scope:** Only delay, reverb, and modulation blocks apply genre overrides. Amp, cab, distortion, dynamics, eq, volume use unchanged resolution paths.

**Confidence:** HIGH — integration path is direct, no new dependencies.

---

### Feature 3: Smarter Snapshot Effect Toggling

**Integration point:** `src/lib/helix/snapshot-engine.ts`, function `getBlockEnabled()`

**Current behavior:** The existing logic (lines 77-126 of snapshot-engine.ts) handles:
- Amp/EQ/volume/dynamics: always ON
- Boost (Minotaur/808): ON except clean snapshot on clean amp
- Distortion: ON for crunch and lead only
- Delay: ON for lead and ambient
- Reverb: always ON
- Modulation: ON for ambient only

**Problems this creates:**
1. Ambient snapshot should have reverb at higher mix, not just "on" — same mix as other snapshots
2. Clean snapshot should disable ALL drive blocks (including user-added distortion)
3. Crunch snapshot should have delay off (delay muddies rhythm playing)

**What changes:** Extend `getBlockEnabled()` with two targeted rule adjustments:

```typescript
// Revised delay rule: off for crunch (currently only lead+ambient get delay)
if (block.type === "delay") {
  return role === "lead" || role === "ambient";  // unchanged — crunch already excluded
}

// Revised distortion rule: ambient also disables drive (ambient is clean + effects)
if (block.type === "distortion") {
  return role === "crunch" || role === "lead";  // unchanged — already correct
}
```

The bigger change is parameter overrides for the ambient snapshot — the ambient snapshot needs Mix parameter boosts on delay and reverb blocks, not just enabled states. This requires extending `buildSnapshots()` to inject `parameterOverrides` for effect blocks in the ambient snapshot.

**Current parameterOverrides:** Only amp ChVol and Gain Block Gain are overridden. Need to add reverb Mix and delay Mix overrides for ambient.

**New ambient overrides table:**
```typescript
const AMBIENT_EFFECT_OVERRIDES: Partial<Record<BlockSpec["type"], Record<string, number>>> = {
  reverb: { Mix: 0.45 },   // boosted from genre default
  delay:  { Mix: 0.40 },   // boosted from genre default
  modulation: { Mix: 0.40, Rate: 0.30 },  // gentle modulation
};
```

**Architecture note:** The snapshot engine already has access to the full `BlockSpec[]` chain and can iterate by `block.type`. Adding Mix overrides for ambient is additive — it extends the existing `parameterOverrides` building loop in `buildSnapshots()`.

**Confidence:** HIGH — change is additive to existing `getBlockEnabled()` and `buildSnapshots()` logic.

---

### Feature 4: .hlx Format Audit (Hardware Bug Fixes)

**Integration point:** `src/lib/helix/preset-builder.ts`

This addresses two confirmed hardware bugs documented in `PROJECT.md`.

**Bug 1: `@fs_enabled: false` hardcoded**

Location: `buildFootswitchSection()`, line 393:
```typescript
"@fs_enabled": false,  // BUG: should be true for stomp to respond on first press
```

Fix: Change to `true`. This is the correct value for stomp switches that should be active and respond on first press. The `false` value causes the hardware to require two presses (toggle off then on) before the stomp engages.

**Bug 2: `@pedalstate: 2` hardcoded in all snapshots**

`@pedalstate` is a bitmask encoding which stomp footswitches are active (LED lit) per snapshot. Hardcoding `2` means stomps always show their default state regardless of what snapshot-level block states say. This causes pedal LEDs to be incorrect.

Location: `buildSnapshot()`, line 239:
```typescript
"@pedalstate": 2,  // BUG: should reflect which stomps are active in this snapshot
```

**Computing correct `@pedalstate`:** The footswitch section assigns specific blocks to specific stomp indices (FS5-FS8, hardware indices 7-10). The snapshot's `blockStates` tells us whether each block is enabled or bypassed in that snapshot. Cross-referencing them computes the bitmask.

```typescript
function computePedalState(
  snapshotBlockStates: Record<string, boolean>,  // blockKey -> enabled
  footswitchAssignments: FootswitchAssignment[],  // { blockKey, fsIndex }
): number {
  let pedalstate = 0;
  for (const assignment of footswitchAssignments) {
    const isEnabled = snapshotBlockStates[assignment.blockKey] ?? false;
    if (isEnabled) {
      pedalstate |= (1 << assignment.fsIndex);
    }
  }
  return pedalstate;
}
```

**Requires:** `buildSnapshot()` needs access to the footswitch assignments built by `buildFootswitchSection()`. Currently these are built independently. The fix requires either:
- Computing footswitch assignments before snapshot building and passing them in (preferred — clean data flow)
- Or computing `@pedalstate` in a post-processing step that has both snapshot block states and footswitch assignments

**Preferred approach:** Extract footswitch assignment computation as a separate pure function `computeFootswitchAssignments(signalChain) → FootswitchAssignment[]`, call it once in `buildTone()`, pass result to both `buildFootswitchSection()` and `buildSnapshot()`.

**Confidence:** HIGH — both bugs are confirmed by hardware testing (documented in PROJECT.md). Fix approach is deterministic.

---

### Feature 5: Signal Chain Visualization

**Integration point:** New file `src/lib/helix/viz.ts` + `api/generate/route.ts` + `page.tsx`

**What this feature delivers:** Before downloading, the user sees a visual representation of the signal chain — which blocks are in the preset, their order, and their DSP path.

**Data already exists:** `presetSpec.signalChain` is a `BlockSpec[]` with all the information needed: `modelName`, `type`, `dsp`, `position`, `enabled`. No new computation in the generation pipeline.

**New function: `buildSignalChainViz(spec: PresetSpec): SignalChainVizData`**

```typescript
// src/lib/helix/viz.ts

export interface VizBlock {
  modelName: string;
  type: BlockSpec["type"];
  dsp: 0 | 1;
  position: number;
  enabled: boolean;
  isBoost: boolean;
  isMandatory: boolean;  // parametric EQ, noise gate, gain block
}

export interface SignalChainVizData {
  dsp0: VizBlock[];   // sorted by position
  dsp1: VizBlock[];   // sorted by position
  snapshotNames: string[];  // names of 4 snapshots
  tempoHint?: number;
}

export function buildSignalChainViz(spec: PresetSpec): SignalChainVizData {
  // Pure transformation — no side effects
}
```

**API route change:** `api/generate/route.ts` adds one line:
```typescript
const signalChainViz = buildSignalChainViz(presetSpec);

return NextResponse.json({
  preset: hlxFile,
  summary,
  spec: presetSpec,
  toneIntent,
  device: deviceTarget,
  signalChainViz,   // <-- added
});
```

**Frontend change:** `page.tsx` state type gains `signalChainViz` field. New `SignalChainViz` component renders DSP0 and DSP1 as horizontal block chains. Component is purely presentational — receives `SignalChainVizData` props, renders block badges by type with color coding matching the Warm Analog Studio design system (`hlx-*` CSS classes).

**Rendering approach:** No SVG/canvas needed. Use CSS flexbox with block type badges. Two rows: DSP1 (top, pre-amp) and DSP2 (bottom, post-amp). Arrow separators between blocks. Cab block shown as a branch below the amp block.

**Confidence:** HIGH — feature is pure data transformation from existing `PresetSpec`. No new dependencies or APIs.

---

### Feature 6: Tone Description Card

**Integration point:** `page.tsx` (frontend only), possibly `preset-builder.ts` for structured data

**Current state:** `summarizePreset()` in `preset-builder.ts` generates a Markdown string that is rendered via ReactMarkdown in the preset card. The data is correct but the rendering is generic prose.

**What changes:** The Tone Description Card is a structured UI component that replaces or supplements the ReactMarkdown summary. It surfaces:
- Amp + Cab pair (most important spec — what the tone is built on)
- Snapshot lineup (4 snapshots with their roles and LED colors)
- Stomp switch assignments (what FS5-FS8 do)
- Guitar notes (pickup/tone knob suggestions)
- Tempo if set

**Two implementation paths:**

**Path A — Frontend-only (use existing `spec` response):** The `spec` field in the API response is already a full `PresetSpec` object, returned as `spec: presetSpec` in the route. The frontend can derive all card content from `spec.signalChain`, `spec.snapshots`, `spec.guitarNotes`, and `spec.tempo`. No backend changes needed.

```typescript
// page.tsx — ToneDescriptionCard receives spec prop
interface ToneDescriptionCardProps {
  spec: PresetSpec;
  toneIntent: ToneIntent;
}
```

**Path B — Add structured summary to API response:** Extend the response with a `toneCard` field that is a pre-computed structured object. Slightly more work but keeps computation server-side.

**Recommendation: Path A.** The `spec` object is already in the response. The card is a pure UI component. Adding a `toneCard` field would duplicate data already available in `spec`. Frontend extracts what it needs.

**LED color mapping for display:** The `ledColor` integer in `SnapshotSpec` needs to be mapped to a display color. `LED_COLORS` constants are in `models.ts` and already exported. Add a reverse mapping in `viz.ts` or the component itself:
```typescript
const LED_COLOR_HEX: Record<number, string> = {
  1: "#ef4444",  // RED — lead
  2: "#f97316",  // ORANGE — crunch
  5: "#14b8a6",  // TURQUOISE — ambient
  6: "#3b82f6",  // BLUE — clean
};
```

**Confidence:** HIGH — frontend-only change using data already in the response. No new API surface needed.

---

## Data Flow (v1.1 complete picture)

```
Step 1: User chat (unchanged)
  Gemini SSE chat → conversation history

Step 2: POST /api/generate (minor addition)
  Input: { messages, device }

Step 3: callClaudePlanner() (caching added)
  cache_control: { type: "ephemeral" } → system prompt cached after first call
  Output: ToneIntent (unchanged shape)

Step 4: assembleSignalChain() (unchanged)

Step 5: resolveParameters() (genre defaults added)
  Reads toneIntent.genreHint → applies GENRE_EFFECT_DEFAULTS to effect blocks
  Output: BlockSpec[] with genre-tuned effect parameters

Step 6: buildSnapshots() (smarter toggling added)
  Ambient snapshot: reverb+delay enabled at boosted Mix values
  Clean snapshot: all drive blocks disabled
  Output: SnapshotSpec[] with correct effect states

Step 7: validatePresetSpec() (unchanged)

Step 8: buildHlxFile() (bug fixes applied)
  @fs_enabled: true (fixed)
  @pedalstate: computed from block states × stomp assignments (fixed)
  Output: HlxFile

Step 9: buildSignalChainViz() (NEW)
  Input: PresetSpec
  Output: SignalChainVizData (pure transformation)

Step 10: Response assembly
  {
    preset: HlxFile,
    summary: string,
    spec: PresetSpec,
    toneIntent: ToneIntent,
    device: DeviceTarget,
    signalChainViz: SignalChainVizData,   // NEW
  }

Step 11: Frontend render
  ToneDescriptionCard (reads from spec + toneIntent)   // NEW component
  SignalChainViz (reads from signalChainViz)           // NEW component
  Download button (unchanged)
```

---

## Architectural Patterns

### Pattern 1: Non-Breaking Additions to Existing Functions

All Knowledge Layer changes (genre defaults, snapshot toggling) are additive: new lookup tables layered on top of existing resolution logic. The existing `resolveDefaultParams()` and `getBlockEnabled()` functions continue to work correctly when no genre hint is present or when block types have no genre overrides. This preserves the deterministic quality of v1.0 while extending it.

**When to use:** Feature adds specialization to existing behavior without changing the default path.

**Example:**
```typescript
// New genre-aware resolveDefaultParams — non-breaking
function resolveDefaultParams(
  block: BlockSpec,
  genreHint?: string,  // new optional param — undefined = no change to existing behavior
): Record<string, number> {
  const model = findModel(block.modelName, block.type);
  const base = model ? { ...model.defaultParams } : { ...block.parameters };

  // Genre overlay: only applies when hint present and block type has genre defaults
  if (genreHint && GENRE_EFFECT_TYPES.has(block.type)) {
    const genreKey = matchGenreKey(genreHint);
    const genreOverrides = genreKey ? GENRE_EFFECT_DEFAULTS[genreKey]?.[block.type] : undefined;
    if (genreOverrides) return { ...base, ...genreOverrides };
  }

  return base;
}
```

### Pattern 2: Pure Data Transformation for Visualization

`buildSignalChainViz()` follows the same pattern as `buildHlxFile()` and `summarizePreset()` — it is a pure function that takes a `PresetSpec` and returns a new data structure. No side effects, no state, no API calls.

**When to use:** New UI data derived from existing domain data. Keeps computation server-side where all knowledge layer context is available.

### Pattern 3: Top-Level Cache Control

Adding `cache_control: { type: "ephemeral" }` at the `client.messages.create()` call level (not on individual content blocks) uses the SDK's automatic caching mode. The system automatically caches everything up to the last cacheable block. For the planner call, this means the system prompt + model list is cached.

**When to use:** Single-turn generation calls where the system prompt is large, stable, and reused frequently within a session.

### Pattern 4: Bitmask State from Block State Map

`@pedalstate` is computed by cross-referencing snapshot block states against footswitch assignments. The core insight: footswitch assignments map blocks to hardware indices; snapshot block states record per-block enabled/disabled. The intersection is the pedalstate bitmask.

**When to use:** Hardware state that must reflect logical state — where a UI/hardware indicator should match the current functional state of assigned blocks.

---

## Component Boundaries

```
planner.ts
  └── reads: helix/models.ts (for getModelListForPrompt)
  └── calls: Anthropic SDK client.messages.create() WITH cache_control

param-engine.ts (MODIFIED)
  └── new: GENRE_EFFECT_DEFAULTS lookup table
  └── resolveParameters() threads genreHint down to resolveDefaultParams()
  └── no new imports

snapshot-engine.ts (MODIFIED)
  └── extended getBlockEnabled() — ambient disables non-ambient effects more aggressively
  └── extended buildSnapshots() — ambient snapshot adds Mix overrides for reverb/delay

preset-builder.ts (FIXED)
  └── new: computeFootswitchAssignments() pure function (extracted)
  └── buildFootswitchSection() uses extracted function
  └── buildSnapshot() receives footswitch assignments, computes @pedalstate
  └── @fs_enabled fixed to true

viz.ts (NEW)
  └── reads: types.ts (PresetSpec, BlockSpec, SnapshotSpec)
  └── reads: models.ts (BOOST_MODEL_IDS or equivalent for isBoost flag)
  └── no AI calls, no external dependencies
  └── exports: buildSignalChainViz, SignalChainVizData, VizBlock

api/generate/route.ts (MINOR)
  └── imports: buildSignalChainViz from @/lib/helix
  └── adds signalChainViz to response

page.tsx (UI)
  └── state gains signalChainViz field
  └── new ToneDescriptionCard component (inline or extracted)
  └── new SignalChainViz component (inline or extracted)
```

**Invariant preserved:** Knowledge Layer (chain-rules, param-engine, snapshot-engine) never imports from the AI layer. Data flows one way. This invariant is not broken by any v1.1 change.

---

## Build Order (Dependency Graph)

The six features have natural dependencies that determine safe build order:

```
Level 0 — No dependencies (build first):
  Feature 4: .hlx format audit (preset-builder.ts bug fixes)
    - Self-contained. Fixes @fs_enabled and @pedalstate.
    - Does not affect any other v1.1 feature.
    - Can be tested independently on hardware.

Level 1 — Depends on stable Knowledge Layer:
  Feature 1: Prompt caching (planner.ts)
    - One-line change. No downstream dependencies.
    - Verify via usage.cache_read_input_tokens in response.

  Feature 2: Genre-aware effect defaults (param-engine.ts)
    - Additive tables. Does not affect snapshot engine.
    - Can be tested with unit tests against genreHint values.

Level 2 — Depends on Feature 2 being stable (or independent):
  Feature 3: Smarter snapshot toggling (snapshot-engine.ts)
    - Depends on param-engine being stable (snapshot reads block params).
    - Ambient Mix overrides interact with genre defaults — test together.

Level 3 — Depends on all backend features being complete:
  Feature 5: Signal chain visualization (viz.ts + route + page.tsx)
    - viz.ts depends on PresetSpec shape (stable after L0-L2).
    - route.ts change is additive.
    - page.tsx SignalChainViz component is UI-only.

  Feature 6: Tone description card (page.tsx)
    - Pure frontend. Reads from existing spec/toneIntent in response.
    - No backend dependencies.
    - Can be built at any point (uses data already in response).
```

**Recommended build sequence:**
1. Feature 4 (.hlx audit) — fix hardware bugs, verify on device
2. Feature 1 (prompt caching) — one-line, verify savings
3. Feature 2 (genre defaults) — lookup tables, unit test
4. Feature 3 (snapshot toggling) — test with Feature 2's genre hints
5. Feature 5 (signal chain viz) — backend + frontend together
6. Feature 6 (tone description card) — pure frontend polish

This order allows hardware testing at step 1 (before other changes risk destabilizing preset output), cost savings immediately at step 2, and UI features last when all backend data is confirmed stable.

---

## Anti-Patterns

### Anti-Pattern 1: Putting Genre Logic in the Planner Prompt

**What people do:** Add genre-specific parameter guidance to the Claude system prompt to make the Planner suggest better effect settings.

**Why it's wrong:** The Planner-Executor architecture exists precisely to keep AI out of parameter decisions. Adding numeric parameter guidance to the prompt reverts to the v1.0 pattern that produced "decent starting points" instead of "world-class presets." The AI will ignore or misapply specific values.

**Do this instead:** Genre-aware defaults belong in `param-engine.ts` as deterministic lookup tables. The Planner's `genreHint` field (already in `ToneIntent`) provides the genre context needed by the Knowledge Layer. No prompt changes required.

---

### Anti-Pattern 2: Computing `@pedalstate` in the Frontend

**What people do:** Try to compute the bitmask in `page.tsx` from the `signalChainViz` data to avoid changing `preset-builder.ts`.

**Why it's wrong:** `@pedalstate` is a field in the `.hlx` file that ships to the hardware. It must be computed server-side before `buildHlxFile()` runs. Frontend cannot retroactively fix a field baked into the HlxFile JSON.

**Do this instead:** Fix `@pedalstate` in `buildSnapshot()` where it is written, using the footswitch assignment map built earlier in `buildTone()`. This is the only place where both the snapshot block states and the footswitch index assignments are available.

---

### Anti-Pattern 3: A New API Route for Visualization

**What people do:** Add a `/api/viz` endpoint to serve signal chain visualization separately from generation.

**Why it's wrong:** The visualization data is derived from the same `PresetSpec` that is already computed and returned by `/api/generate`. Adding a round-trip to fetch viz data after generation adds latency and network overhead for data that costs nothing to compute alongside the preset.

**Do this instead:** Add `signalChainViz` to the existing `/api/generate` response. One request, one payload, all data the UI needs.

---

### Anti-Pattern 4: Replacing `summarizePreset()` Instead of Augmenting

**What people do:** Rewrite `summarizePreset()` to return structured data instead of Markdown, breaking the existing summary display.

**Why it's wrong:** The Markdown summary (`generatedPreset.summary`) is used in the existing ReactMarkdown render. Changing its format breaks the existing display without adding user value.

**Do this instead:** Leave `summarizePreset()` unchanged. The Tone Description Card reads from `spec` and `toneIntent` which are already in the response — it does not need `summarizePreset()` to change. The card can be added alongside the existing Markdown summary or conditionally replace it.

---

## Integration Points

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| planner.ts → Anthropic SDK | `client.messages.create()` with `cache_control` | cache_control is top-level param, coexists with output_config |
| param-engine.ts → ToneIntent | `intent.genreHint` string | Already on ToneIntent, threads through resolveParameters() |
| snapshot-engine.ts → BlockSpec[] | reads `block.type`, `modelId` for isBoost | No shape change needed |
| preset-builder.ts internal | `buildTone()` calls `computeFootswitchAssignments()` first, passes to `buildSnapshot()` | Refactor only, no interface change |
| viz.ts → PresetSpec | pure read of signalChain + snapshots | No mutations |
| route.ts → viz.ts | calls `buildSignalChainViz(presetSpec)` | After validatePresetSpec, before response |
| page.tsx → API response | reads `signalChainViz` from response JSON | Requires state type update |

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic API (Claude Sonnet 4.6) | `cache_control: { type: "ephemeral" }` on messages.create | Supported in SDK 0.78.0, verified in type definitions |
| Gemini API (chat phase) | Unchanged | v1.1 does not touch the interview/chat phase |

---

## Scaling Considerations

| Scale | Architecture Notes |
|-------|--------------------|
| Current (low traffic) | All v1.1 changes are O(1) or O(n) on signal chain length (max ~15 blocks). No scaling concerns. |
| Medium traffic | Prompt caching actively helps — system prompt cached across concurrent users hitting the same model version. TTL resets on each hit. |
| High traffic | No changes needed for v1.1 features. Existing Vercel serverless constraints unchanged. |

---

## Sources

- `C:/Users/dsbog/HelixAI/src/lib/planner.ts` — callClaudePlanner() implementation, cache_control integration point (HIGH confidence — direct inspection)
- `C:/Users/dsbog/HelixAI/src/lib/helix/param-engine.ts` — resolveParameters() and resolveDefaultParams() (HIGH confidence — direct inspection)
- `C:/Users/dsbog/HelixAI/src/lib/helix/snapshot-engine.ts` — getBlockEnabled() and buildSnapshots() (HIGH confidence — direct inspection)
- `C:/Users/dsbog/HelixAI/src/lib/helix/preset-builder.ts` — buildFootswitchSection() and buildSnapshot(), confirmed bug locations (HIGH confidence — direct inspection)
- `C:/Users/dsbog/HelixAI/node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts` — MessageCreateParamsBase.cache_control at line 2643 (HIGH confidence — SDK source)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — top-level cache_control syntax, TypeScript examples, pricing (HIGH confidence — official docs, fetched 2026-03-02)
- `.planning/PROJECT.md` — confirmed hardware bugs: @fs_enabled and @pedalstate (HIGH confidence — project documentation)
- `.planning/codebase/CONCERNS.md` — bug analysis and fragile area documentation (HIGH confidence — codebase audit)

---

*Architecture research for: HelixAI v1.1 feature integration*
*Researched: 2026-03-02*
