# Architecture Research

**Domain:** AI-powered Helix preset generation engine
**Researched:** 2026-03-01
**Confidence:** HIGH (based on codebase analysis + verified Helix community sources + LLM architecture research)

---

## Standard Architecture

### System Overview

```
USER INPUT (chat)
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  INTERVIEW PHASE  (existing — keep)                         │
│  Gemini chat, streaming SSE, READY_TO_GENERATE signal       │
└─────────────────────────────────────────────────────────────┘
      │  conversation history
      ▼
┌─────────────────────────────────────────────────────────────┐
│  PLANNER  (AI layer — new)                                  │
│  Narrow creative decisions only:                            │
│    - Which amp model? (name from database)                  │
│    - Which cab? (name from database)                        │
│    - Which effects? (names from database)                   │
│    - Tone intent per snapshot (clean/crunch/lead/ambient)   │
│    - Guitar type context (single-coil vs humbucker)         │
│  Output: ToneIntent JSON (small, constrained schema)        │
└─────────────────────────────────────────────────────────────┘
      │  ToneIntent
      ▼
┌─────────────────────────────────────────────────────────────┐
│  KNOWLEDGE LAYER  (deterministic — new, the core rebuild)   │
│                                                             │
│  ┌─────────────────┐   ┌──────────────────────────────┐    │
│  │  Block Database │   │  Signal Chain Rules Engine   │    │
│  │  (models.ts)    │   │  (chain-rules.ts)            │    │
│  │                 │   │                              │    │
│  │  Per model:     │   │  Enforces:                   │    │
│  │  - ID           │   │  - DSP0: wah→comp→drive→amp  │    │
│  │  - Category     │   │  - DSP1: eq→mod→delay→reverb │    │
│  │  - Expert       │   │  - Amp always has cab        │    │
│  │    defaults     │   │  - Trails on delay/reverb    │    │
│  │  - Cab affinity │   │  - Always-on Klon/boost      │    │
│  │  - Tuning hints │   │  - Post-cab Parametric EQ    │    │
│  └─────────────────┘   └──────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Parameter Engine  (param-engine.ts)                │    │
│  │                                                     │    │
│  │  Given: amp category + guitar type + tone intent    │    │
│  │  Returns: expert parameter values (normalized 0-1)  │    │
│  │                                                     │    │
│  │  Amp category rules:                                │    │
│  │    clean:     Master=1.0, Bass=0.30-0.50, ...       │    │
│  │    crunch:    Master=0.85-1.0, Bass=0.20-0.35, ...  │    │
│  │    high_gain: Master=0.40-0.55, Bass=0.25-0.50, ... │    │
│  │                                                     │    │
│  │  Cab rules:                                         │    │
│  │    LowCut=0.15-0.25 (NEVER 0)                       │    │
│  │    HighCut=0.70-0.85 (NEVER 1.0)                    │    │
│  │    Angle=0.0-0.20 (NEVER > 0.30)                    │    │
│  │    Mic: integer index per genre                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Snapshot Engine  (snapshot-engine.ts)              │    │
│  │                                                     │    │
│  │  Input: snapshot intent (clean/crunch/lead/ambient) │    │
│  │  Output: blockStates + parameterOverrides           │    │
│  │                                                     │    │
│  │  Rules:                                             │    │
│  │    Volume balance via ChVol ONLY (never Master)     │    │
│  │    Clean:  ChVol 0.65-0.75, drive off               │    │
│  │    Lead:   ChVol 0.80-0.90, drive on                │    │
│  │    Ambient: delay/reverb Mix boosted                │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
      │  PresetSpec (complete, expert-validated)
      ▼
┌─────────────────────────────────────────────────────────────┐
│  TEMPLATE ENGINE  (existing — heavy refactor)               │
│  preset-builder.ts                                          │
│  Converts PresetSpec → .hlx JSON                            │
│  Pure structural translation, no logic                      │
└─────────────────────────────────────────────────────────────┘
      │  HlxFile JSON
      ▼
┌─────────────────────────────────────────────────────────────┐
│  VALIDATOR  (existing — extend)                             │
│  validate.ts                                                │
│  Schema + hardware constraint checks                        │
│  Fail fast on structural errors, no silent auto-correct     │
└─────────────────────────────────────────────────────────────┘
      │  validated HlxFile
      ▼
   .hlx download
```

---

### Component Responsibilities

| Component | Responsibility | Implementation Approach |
|-----------|---------------|------------------------|
| **Interview (chat)** | Gather tone intent from user via conversation | Keep existing Gemini streaming chat — works well |
| **Planner (AI)** | Select amp/cab/effect model names, snapshot intents | LLM with constrained schema — ToneIntent type, NOT full PresetSpec |
| **Block Database** | Store all HD2_* model IDs, categories, expert defaults, cab affinities | Expanded `models.ts` with category-aware defaults |
| **Signal Chain Rules** | Enforce professional block ordering and required blocks | Deterministic rule engine, no AI involvement |
| **Parameter Engine** | Convert tone category + guitar type into expert parameter values | Pure function lookup tables + category-specific formulas |
| **Snapshot Engine** | Generate volume-balanced snapshot scenes | Deterministic rules for ChVol, block states, and parameter overrides |
| **Template Engine** | Translate complete PresetSpec to .hlx JSON | Pure structural translation — `buildHlxFile()` — no decisions |
| **Validator** | Verify .hlx JSON is structurally valid before delivery | Fail-fast with explicit errors, not silent corrections |

---

## Recommended Project Structure

```
src/lib/helix/
  index.ts                    — public exports (unchanged)
  types.ts                    — HlxFile, PresetSpec, ToneIntent (new type added)
  models.ts                   — Block database (expand with category data)
  preset-builder.ts           — HlxFile assembler (keep, refine)
  validate.ts                 — Structural validator (extend, harden)

  // NEW: The Knowledge Layer
  chain-rules.ts              — Signal chain ordering and required-block rules
  param-engine.ts             — Expert parameter values by amp category + guitar type
  snapshot-engine.ts          — Snapshot scene generator

  // NEW: The Planner interface
  tone-intent.ts              — ToneIntent type + schema definition

src/lib/
  gemini.ts                   — Interview chat prompt (keep)
  providers.ts                — AI provider abstraction (keep, simplify)

  // REPLACE: generation-prompt.ts
  planner-prompt.ts           — Narrow AI prompt: model selection + intent only

src/app/api/
  chat/route.ts               — Interview (keep)
  generate/route.ts           — Orchestrates: Planner → Knowledge Layer → Builder
  providers/route.ts          — Provider list (keep)
```

---

## Architectural Patterns

### Pattern 1: Planner-Executor Separation

**What:** Split what the AI decides (Planner) from what expert rules determine (Executor).

**Why:** The current system asks AI to generate complete PresetSpec JSON including all parameter values. This is the root cause of mediocre quality — LLMs are poor at numeric parameter optimization for domain-specific hardware. The AI excels at identifying "this should sound like a Friedman BE-100 with some Tube Screamer tightening" but cannot reliably produce `Drive: 0.47, Bass: 0.30, Mid: 0.65`.

**Boundary:** AI generates `ToneIntent`. Expert knowledge layer generates `PresetSpec`.

```typescript
// AI generates this (narrow, constrained)
interface ToneIntent {
  ampName: string;           // "Placater Dirty" — from approved list
  cabName: string;           // "2x12 Greenback 25s" — from approved list
  guitarType: "single_coil" | "humbucker" | "p90";
  effects: EffectIntent[];   // effect name + role (always_on | toggleable | ambient)
  snapshots: SnapshotIntent[]; // name + role (clean | crunch | lead | ambient)
  tempoHint?: number;
}

// Knowledge layer generates this (complete, expert-validated)
interface PresetSpec { ... } // unchanged type
```

**Build order dependency:** ToneIntent type must be defined before both the Planner prompt and the Knowledge Layer.

---

### Pattern 2: Block Database with Expert Defaults

**What:** The block database (`models.ts`) stores not just model IDs but category-aware expert defaults — research-validated parameter ranges for each amp category.

**Current problem:** The database has reasonable defaults, but they're not category-differentiated at the code level. The AI prompt documents the rules as text, which the AI often ignores for numeric specifics.

**Solution:** Encode the rules in the parameter engine as pure TypeScript functions. The AI cannot override them.

```typescript
// param-engine.ts
function getAmpParams(
  modelId: string,
  category: AmpCategory,
  guitarType: GuitarType,
  toneRole: "clean" | "crunch" | "high_gain"
): Record<string, number> {
  const base = AMP_MODELS[modelId]?.defaultParams ?? {};
  const categoryOverrides = CATEGORY_PARAM_RULES[category][toneRole];
  const guitarAdjust = GUITAR_TYPE_ADJUSTMENTS[guitarType][category];
  return { ...base, ...categoryOverrides, ...guitarAdjust };
}
```

**Confidence source:** The top 250 Helix presets analysis (Tonevault) confirms: clean amps run Master at 1.0 on 94% of presets, high-gain amps run moderate Drive (not maxed), Marshall/crunch styles use very low Bass (0.20-0.30) to avoid mud. These are firm, verifiable patterns that belong in code, not prompts.

---

### Pattern 3: Signal Chain Rules Engine

**What:** A deterministic engine that takes the effect list from ToneIntent and assembles the correct signal chain with proper DSP assignment, block ordering, and mandatory utility blocks.

**Required blocks every preset always gets (never left to AI):**
- Post-cab Parametric EQ on DSP1 position 0
- Noise gate on DSP0 input
- Amp always paired with appropriate cab

**Ordering rules (hard-coded, not AI decisions):**
```
DSP0: [Noise Gate Input] → [Wah?] → [Compressor?] → [Drive(s)] → [Amp] → [Cab]
DSP1: [Parametric EQ] → [Modulation?] → [Delay?] → [Reverb?]
```

**Always-on Klon rule:** For clean/crunch presets, `chain-rules.ts` inserts a Minotaur block before the amp if not already present in the effect list. For high-gain presets, it inserts a Scream 808 as a boost (toggled, not always on).

**Why deterministic:** Signal chain order is not a creative decision — it is an engineering constraint. Professional Helix builders do not experiment with putting reverb before the amp. This knowledge is certain and should be encoded as code.

---

### Pattern 4: Expert Cab Configuration

**What:** Cab parameters are computed deterministically by `param-engine.ts` based on amp category and genre, not generated by AI.

**The numbers that matter (HIGH confidence — confirmed by Helix community):**

| Parameter | Range | Rule |
|-----------|-------|------|
| LowCut | 0.15–0.25 | NEVER leave at 0. 0.15 = ~80 Hz, 0.25 = ~130 Hz |
| HighCut | 0.70–0.85 | NEVER leave at 1.0. Removes digital fizz |
| Angle | 0.0–0.20 | NEVER above 0.30 — causes muffled, buried tone |
| Distance | 0.75–1.0 | Lower proximity boost for clean, neutral for gain |
| Mic | Integer 0–6 | 0=SM57 (rock/gain), 2=67 Condenser (clean), 5=121 Ribbon (dark) |

**Implementation:** `getCabParams(cabModelId, ampCategory, genre)` returns a validated parameter object. AI never touches cab parameters.

---

### Pattern 5: Snapshot Volume Balancing

**What:** The snapshot engine generates volume-balanced scenes using ChVol adjustments derived from the snapshot role.

**Rule source (HIGH confidence — confirmed by Line 6 documentation and Helix community):**
- ChVol is a flat post-amp level fader with no tonal effect — the correct lever for snapshot balancing
- Master should NEVER vary between snapshots — it changes power amp character, not volume

```typescript
// snapshot-engine.ts
const CHVOL_BY_ROLE: Record<SnapshotRole, number> = {
  clean:   0.68,
  crunch:  0.75,
  lead:    0.85,
  ambient: 0.65,
};

function buildSnapshotSpec(
  intent: SnapshotIntent,
  blocks: BlockSpec[]
): SnapshotSpec {
  // Deterministic block states by role
  // Deterministic ChVol override
  // Deterministic delay/reverb mix for ambient role
}
```

**LED color convention (encode in rules, not AI):**
- Clean: blue (6)
- Crunch/rhythm: orange (2)
- Lead/solo: red (1)
- Ambient: turquoise (5)

---

## Data Flow

```
Step 1: User chat → conversation history built up over several turns

Step 2: POST /api/generate
  Input: conversation history

Step 3: Planner call (AI)
  Input:  system prompt (model name list + ToneIntent schema)
  Output: ToneIntent JSON (small, ~15 fields)
  Constraint: response_format = JSON, schema enforced

Step 4: Signal Chain Assembly (deterministic)
  Input:  ToneIntent
  Process: chain-rules.ts resolves model IDs, inserts mandatory blocks,
           assigns DSP/position for every block
  Output: BlockSpec[] (signal chain)

Step 5: Parameter Resolution (deterministic)
  Input:  BlockSpec[], guitarType, tone category
  Process: param-engine.ts applies expert defaults per model + category
  Output: BlockSpec[] with complete parameter values

Step 6: Snapshot Generation (deterministic)
  Input:  SnapshotIntent[], BlockSpec[]
  Process: snapshot-engine.ts assigns block states + ChVol overrides
  Output: SnapshotSpec[]

Step 7: PresetSpec Assembly
  Input:  name, BlockSpec[], SnapshotSpec[], tempo
  Output: PresetSpec (complete, validated by construction)

Step 8: .hlx File Build
  Input:  PresetSpec
  Process: buildHlxFile() — pure structural translation
  Output: HlxFile JSON

Step 9: Validation
  Input:  HlxFile
  Process: validateAndFixPresetSpec() — structural check
  On error: fail with explicit error (no silent correction)
  Output: validated HlxFile or error response

Step 10: Download
  Content-Type: application/json
  Filename: {preset-name}.hlx
```

---

## Anti-Patterns

### Anti-Pattern 1: AI Generates Complete PresetSpec

**What goes wrong:** The current system asks AI to generate the full PresetSpec including all numeric parameter values. AI models are trained on text; they have no domain understanding of what `Drive: 0.47` means on a Friedman BE-100 model or why it matters. They produce numbers that look plausible but produce muddy or lifeless results.

**Root cause evidence:** Current codebase generates parameters that sound "mediocre" — exactly the failure mode documented in PROJECT.md. The system prompt tries to correct this with extensive "Professional Parameter Guidance" text, but the AI ignores or misapplies numeric constraints in approximately 20–40% of cases (observed).

**Instead:** AI selects model names only. Parameter values come entirely from the expert knowledge layer.

---

### Anti-Pattern 2: Validation-as-Correction

**What goes wrong:** `validateAndFixPresetSpec()` auto-corrects invalid model IDs via string similarity matching and silently drops invalid snapshot references. This hides AI mistakes rather than fixing root causes. The CONCERNS.md documents multiple cases of silent data loss.

**Instead:** Validation should fail fast with explicit errors. Auto-correction should be limited to cosmetic issues (name truncation). If the Planner generates an invalid model ID, the fix is a better Planner prompt with a valid model ID list — not a fuzzy-match correction that may select the wrong model.

---

### Anti-Pattern 3: Monolithic Generation Prompt

**What goes wrong:** The current generation prompt is 250+ lines of instructions combining: the model ID list, professional parameter guidance, signal chain rules, snapshot rules, and output schema. LLMs have known reliability issues with long, multi-topic prompts. Critical rules buried in a 250-line prompt get lost.

**Instead:** The prompt should be minimal — describe the ToneIntent schema, list approved model IDs, and ask for creative decisions only. All engineering rules live in code.

---

### Anti-Pattern 4: AI Decides Cab Parameters

**What goes wrong:** Cab settings (LowCut, HighCut, Angle, Mic) are among the most impactful tone parameters. Bad defaults are a primary source of muddy, fizzy, and muffled tones. Current system asks AI to choose these. Community research confirms that professional cab settings are not creative choices — they follow firm rules based on amp category.

**Instead:** Cab parameters are always computed by `param-engine.ts`. AI has zero input on cab configuration.

---

### Anti-Pattern 5: All Effects on One DSP

**What goes wrong:** Placing all blocks on DSP0 (the current default) wastes DSP1's processing budget and leaves no room for post-cab effects. This is a well-documented Helix architecture mistake; community consensus is that the DSP split is essential for complex presets.

**Instead:** `chain-rules.ts` enforces the split: pre-amp effects and amp+cab on DSP0; post-amp EQ, mod, delay, reverb on DSP1.

---

### Anti-Pattern 6: Snapshot Block States Without Volume Balancing

**What goes wrong:** Current system generates blockStates (on/off) per snapshot but snapshot volume balancing is unreliable because it depends on AI correctly generating ChVol parameterOverrides. When AI omits or guesses ChVol, lead snapshots are same volume as clean snapshots — a hallmark of amateur presets.

**Instead:** `snapshot-engine.ts` always computes and injects ChVol overrides based on snapshot role. This is non-negotiable.

---

## Key Architectural Decisions

### Decision 1: Narrow ToneIntent vs. Full PresetSpec from AI

The AI generates a `ToneIntent` (model names + intents, ~15 fields) rather than a full `PresetSpec` (~50+ fields with all numeric values).

**Rationale:**
- LLMs are good at semantic decisions: "this should be a Friedman BE-100 with a 4x12 V30 cab"
- LLMs are poor at numeric optimization: "Drive should be 0.47 specifically for this amp category and guitar type"
- Separation produces predictably better results than asking AI to do both

**Tradeoff:** Less AI "creativity" on parameters. Acceptable because parameter creativity in Helix presets mostly produces mistakes, not improvements. Expert rules produce better results than AI guessing.

---

### Decision 2: Hardcode Signal Chain Ordering

Signal chain ordering (wah before comp before drive before amp, etc.) is encoded in `chain-rules.ts` as non-negotiable rules. The AI cannot override block ordering.

**Rationale:** This ordering is not a creative decision. Professional Helix builders do not try different amp orderings. The community consensus (verified via Sweetwater, Helix Help, and tonevault analysis) is consistent on this. Letting AI decide order introduces errors without upside.

---

### Decision 3: Required Blocks Always Present

`chain-rules.ts` inserts these blocks if the ToneIntent does not include them:
- Post-cab Parametric EQ on DSP1 (always)
- Appropriate drive pedal before amp (Klon for clean/crunch, 808 boost for high-gain)

**Rationale:** Professional presets consistently include these. They are "table stakes" for pro-quality tone per community analysis of the top 250 presets.

---

### Decision 4: Fail-Fast Validation

Validator should throw on structural errors rather than auto-correcting. If the Planner generates an invalid model ID, it is a Planner bug, not a validator concern.

**Exception:** Parameter clamping (0–1 range, Mic integer) remains as silent correction because these are easy-to-violate format constraints, not logic errors.

---

## Build Order (Dependency Graph)

```
Phase 1 (Foundation — no dependencies):
  types.ts          — Add ToneIntent interface
  models.ts         — Expand with category data, cab affinities

Phase 2 (Knowledge Layer — depends on Phase 1):
  param-engine.ts   — Depends on models.ts types
  chain-rules.ts    — Depends on models.ts + types.ts
  snapshot-engine.ts — Depends on types.ts + param-engine.ts

Phase 3 (AI Layer — depends on Phase 1):
  tone-intent.ts    — ToneIntent schema for Zod validation
  planner-prompt.ts — Narrow AI prompt (depends on models.ts for ID list)

Phase 4 (Orchestration — depends on all above):
  generate/route.ts — Wires together: Planner → chain-rules → param-engine → snapshot-engine → buildHlxFile

Phase 5 (Testing + Hardening):
  validate.ts       — Extend with fail-fast mode
  Unit tests for chain-rules, param-engine, snapshot-engine
```

**Critical path:** `types.ts` and `models.ts` must be complete before anything else can be built. The Knowledge Layer (Phase 2) and AI Layer (Phase 3) can be built in parallel. Orchestration (Phase 4) cannot be built until all Knowledge Layer components exist.

---

## Component Boundaries: What Talks to What

```
generate/route.ts
  └── calls: Planner AI (planner-prompt.ts)
  └── calls: chain-rules.ts (assembleSignalChain)
  └── calls: param-engine.ts (resolveParameters)
  └── calls: snapshot-engine.ts (buildSnapshots)
  └── calls: buildHlxFile() (preset-builder.ts)
  └── calls: validateAndFixPresetSpec() (validate.ts)

chain-rules.ts
  └── reads: models.ts (model lookup, cab affinity)
  └── reads: types.ts (BlockSpec, ToneIntent)
  └── NO AI calls

param-engine.ts
  └── reads: models.ts (defaultParams by model)
  └── reads: types.ts (AmpCategory, GuitarType)
  └── NO AI calls
  └── NO external dependencies

snapshot-engine.ts
  └── reads: types.ts (SnapshotIntent, SnapshotSpec)
  └── calls: param-engine.ts (for ChVol resolution)
  └── NO AI calls

planner-prompt.ts
  └── reads: models.ts (for model ID list in prompt)
  └── NO import of Knowledge Layer (intentional — prevents coupling)
```

**Invariant:** The Knowledge Layer (`chain-rules`, `param-engine`, `snapshot-engine`) must NEVER import from or call into the AI layer. Data flows one way: AI → Knowledge Layer → Builder.

---

## Sources

- [Helix Help — Snapshots](https://helixhelp.com/tips-and-guides/helix/snapshots) — snapshot parameter control mechanics (HIGH confidence)
- [Helix Help — The Blocks](https://helixhelp.com/tips-and-guides/helix/the-blocks) — block types and DSP constraints (HIGH confidence)
- [Tonevault — Top 250 Helix Amps Analyzed](https://www.tonevault.io/blog/250-helix-amps-analyzed) — empirical amp parameter ranges from real presets (MEDIUM confidence — community source)
- [BenVesco — Helix DSP Allocations](https://benvesco.com/store/helix-dsp-allocations/) — DSP cost per block type (MEDIUM confidence — community source)
- [Sweetwater — Line 6 Helix FAQ](https://www.sweetwater.com/sweetcare/articles/line-6-helix-faq-2/) — DSP split and path architecture (HIGH confidence)
- [Line 6 Community — Cab Settings](https://thegearforum.com/threads/helix-cabs-share-your-settings-tips-tricks.4944/) — LowCut/HighCut professional ranges (MEDIUM confidence)
- [Line 6 Community — hlx JSON format](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — no official schema, community reverse-engineered (context)
- [I Like Kill Nerds — Helix Stadium Protocol](https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/) — HD2_* model ID structure and parameter encoding (MEDIUM confidence — Stadium, not LT, but format is consistent)
- [Emergent Mind — Planner-Executor Pattern](https://www.emergentmind.com/topics/planner-executor-agentic-framework) — Planner-Executor agentic architecture (HIGH confidence — established pattern)
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs/) — JSON schema enforcement for AI output (HIGH confidence — official docs)
- [Komposition101 — Volume Matching Presets](https://www.komposition101.com/blog/volume-matching-presets-on-line6-helix) — ChVol for snapshot balancing (MEDIUM confidence — community)
- Current codebase analysis (`src/lib/helix/`) — direct inspection of existing architecture (HIGH confidence)
