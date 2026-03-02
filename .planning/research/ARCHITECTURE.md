# Architecture Research

**Domain:** AI-powered rig emulation extension to an existing Planner-Executor guitar preset system
**Researched:** 2026-03-02
**Confidence:** HIGH (existing codebase fully inspected; Claude API vision + structured output docs verified against official sources)

---

## Context: What This Document Covers

This document covers the v1.3 Rig Emulation milestone: how vision-based rig extraction, physical-to-Helix pedal mapping, and substitution display integrate with the existing Planner-Executor architecture. Every decision specifies which files are new, which are modified, and in what order to build.

---

## System Overview

```
+----------------------------------------------------------------------+
|                     BROWSER (Next.js page.tsx)                       |
|                                                                      |
|  +------------------+  +-------------------+  +-------------------+ |
|  | Chat Messages    |  | Image Upload UI   |  | Substitution Card | |
|  | (existing)       |  | (NEW — file input |  | (NEW — TS9 ->     | |
|  |                  |  |  or drag-drop)    |  |  Teemah! display) | |
|  +--------+---------+  +---------+---------+  +---------+---------+ |
|           |                      |                      |           |
|           +----------------------+----------------------+           |
|                                  |                                  |
|      POST /api/generate { messages, device, images[] }              |
+----------------------------------+----------------------------------+
                                   |
+----------------------------------v----------------------------------+
|                  API ROUTE (route.ts — MODIFIED)                    |
|                                                                     |
|  1. Extract images[] from request body                              |
|  2. Call callRigVisionPlanner(images) -> RigIntent    [NEW]         |
|  3. Call mapRigToToneIntent(rigIntent, device)        [NEW]         |
|     -> { substitutions[], toneContext, unmappedPedals[] }           |
|  4. Call callClaudePlanner(messages, device, toneContext)           |
|     -> ToneIntent                              [planner.ts MODIFIED]|
|  5. Knowledge Layer pipeline (existing — unchanged)                 |
|  6. Return { ...existing, substitutions[] }      [response EXTENDED]|
+---------------------------------------------------------------------+
                |                    |                    |
+---------------v------+  +----------v---------+  +------v-----------+
| planner.ts (MODIFIED)|  | rig-vision.ts (NEW)|  | rig-mapping.ts   |
|                      |  |                    |  | (NEW)            |
| Accepts optional     |  | callRigVision-     |  |                  |
| toneContext string   |  | Planner() ->       |  | mapRigToTone-    |
| appended to conv.    |  | RigIntent          |  | Intent() +       |
| before model sends   |  | (one Claude vision |  | substitution     |
|                      |  |  call, all images) |  | map building     |
+----------------------+  +--------------------+  +------------------+
                                                           |
+----------------------------------------------------------v----------+
|                   KNOWLEDGE LAYER (all existing — unchanged)        |
|                                                                     |
|  chain-rules.ts -> param-engine.ts -> snapshot-engine.ts           |
|  preset-builder.ts / podgo-builder.ts                               |
+---------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `src/app/page.tsx` | Image upload UI, substitution card display, include images[] in generate POST | Modified |
| `src/app/api/generate/route.ts` | Orchestrate vision extraction, mapping, planner; add substitutions to response | Modified |
| `src/lib/rig-vision.ts` | Single Claude API call with image content blocks -> RigIntent | NEW |
| `src/lib/rig-mapping.ts` | Static curated lookup table (physical pedal -> Helix model) + knob% -> param translation | NEW |
| `src/lib/helix/rig-intent.ts` | Zod schemas: RigIntentSchema, PhysicalPedalSchema, SubstitutionEntrySchema | NEW |
| `src/lib/planner.ts` | Accept optional toneContext string appended to conversation before Claude call | Modified |
| `src/lib/helix/index.ts` | Export new rig-intent types | Modified |
| All other `src/lib/helix/*` | Unchanged — receives ToneIntent exactly as before | Existing |

---

## The Central Architecture Decision: Two-Step vs Single-Call Vision

This is the most consequential decision for v1.3. The recommendation is definitive.

### Option A: Two-Step Pre-Processing (Recommended)

```
Step 1: callRigVisionPlanner(images[]) -> RigIntent
        [Dedicated Claude call with image blocks — extracts pedal names and knob positions]
        [No structured output constraint — focused extraction prompt only]

Step 2: mapRigToToneIntent(rigIntent, device) -> { substitutions[], toneContext }
        [Deterministic — static PEDAL_HELIX_MAP lookup table, no AI]
        [Translates knob% to Helix 0-1 param values]
        [Builds toneContext summary string]

Step 3: callClaudePlanner(messages, device, toneContext?) -> ToneIntent
        [Existing planner — receives toneContext as appended text hint]
        [Uses zodOutputFormat(ToneIntentSchema) as today, completely unchanged]
```

### Option B: Single Multi-Modal Call

```
Step 1: callClaudeMultiModal(messages, images[], device) -> ToneIntent
        [One API call sees both conversation text and pedal photos]
        [zodOutputFormat still constrains ToneIntent schema]
        [Mapping burden falls entirely on Claude's knowledge and the prompt]
```

### Recommendation: Two-Step (Option A)

**Rationale — five reasons, all strong:**

1. **Matches the existing Planner-Executor philosophy.** The codebase explicitly separates creative AI choices (planner) from deterministic parameter resolution (Knowledge Layer). Vision extraction is a third distinct concern — reading physical hardware — that should not be conflated with creative Helix model selection. Treating it as a separate step preserves the architectural invariant that AI makes creative choices and code handles deterministic translation.

2. **Static mapping table beats prompt-embedded knowledge for reliability.** Claude's gear knowledge is good but not auditable. A static `PEDAL_HELIX_MAP` lookup can be curated, reviewed, and extended without retesting the planner prompt. When a user reports "my Boss SD-1 wasn't mapped correctly," the fix is one line in a data file, not a prompt rewrite. This is explicitly what the PROJECT.md means by "physical pedal -> Helix model mapping must be curated, not guessed."

3. **Zodoutputformat compatibility is preserved without complexity.** The existing planner uses `output_config: { format: zodOutputFormat(ToneIntentSchema) }`. Adding vision images to the existing planner call while keeping structured output works (the Claude API supports combining vision input with structured output in the same call — verified against official docs). However, it creates a large, multi-purpose prompt boundary where failures are harder to isolate. A dedicated vision extraction step can use a simple extraction prompt without structured output, and the planner remains structurally unchanged.

4. **RigIntent and ToneIntent are fundamentally different schemas.** RigIntent contains physical pedal names and knob percentages. ToneIntent contains Helix model names and snapshot structure. Forcing a single call to produce ToneIntent from photos requires the AI to perform the physical-to-Helix mapping inside its reasoning, which is invisible and non-deterministic. The two-step approach makes the mapping explicit and testable.

5. **Failure isolation.** If Claude misreads one pedal photo, the error is contained to Step 1 and can be surfaced as "could not identify Pedal 2." In the single-call approach, a bad image interpretation can corrupt the entire ToneIntent including the amp choice.

**When Option B would be preferable:** If the project had no mapping layer and raw AI gear knowledge was intentionally the mapping mechanism. That is explicitly ruled out by the project constraints.

---

## New Types and Schemas

All schemas live in `src/lib/helix/rig-intent.ts` and are exported from `src/lib/helix/index.ts`.

### PhysicalPedalSchema

Represents one physical pedal extracted from a user's photo.

```typescript
// src/lib/helix/rig-intent.ts
import { z } from "zod";

export const PhysicalPedalSchema = z.object({
  brand: z.string(),           // "Boss", "Ibanez", "Electro-Harmonix"
  model: z.string(),           // "SD-1", "TS9", "Big Muff Pi"
  fullName: z.string(),        // "Boss SD-1 Super OverDrive" — used as lookup key
  knobPositions: z.record(
    z.string(),
    z.number().min(0).max(100)
  ),                           // { "Drive": 70, "Tone": 50, "Level": 60 } — percent
  imageIndex: z.number().int(),// Which image this came from (0-indexed)
  confidence: z.enum(["high", "medium", "low"]), // Vision extraction confidence
});

export type PhysicalPedal = z.infer<typeof PhysicalPedalSchema>;
```

### RigIntentSchema

The full extracted rig from vision analysis — output of `callRigVisionPlanner()`.

```typescript
export const RigIntentSchema = z.object({
  pedals: z.array(PhysicalPedalSchema),
  rigDescription: z.string().optional(),    // Free-text if user also typed a description
  extractionNotes: z.string().optional(),   // Claude's notes on ambiguities
});

export type RigIntent = z.infer<typeof RigIntentSchema>;
```

### SubstitutionEntrySchema

One pedal substitution — what gets shown in the UI substitution card.

```typescript
export const SubstitutionEntrySchema = z.object({
  physicalPedal: z.string(),        // "TS9 Tube Screamer"
  helixModel: z.string(),           // "Teemah!" (exact Helix model name)
  substitutionReason: z.string(),   // "Closest gain structure and mid-hump EQ character"
  parameterMapping: z.record(
    z.string(),                     // Helix param name: "Drive"
    z.number()                      // Translated value: 0.35
  ),
  confidence: z.enum(["direct", "close", "approximate"]),
  // direct = exact model exists in Helix
  // close = functionally equivalent, same circuit topology
  // approximate = closest available, different character
});

export type SubstitutionEntry = z.infer<typeof SubstitutionEntrySchema>;
```

### SubstitutionMapSchema

The full mapping result — what `mapRigToToneIntent()` returns.

```typescript
export const SubstitutionMapSchema = z.object({
  substitutions: z.array(SubstitutionEntrySchema),
  unmappedPedals: z.array(z.string()),  // Physical pedals with no Helix equivalent
  toneContext: z.string(),              // Summary string passed to planner as hint
});

export type SubstitutionMap = z.infer<typeof SubstitutionMapSchema>;
```

---

## Recommended Project Structure

```
src/
+-- app/
|   +-- page.tsx                    MODIFIED: image upload UI, substitution card
|   +-- api/
|       +-- generate/
|           +-- route.ts            MODIFIED: vision + mapping + planner orchestration
+-- lib/
    +-- planner.ts                  MODIFIED: accept optional toneContext string
    +-- rig-vision.ts               NEW: callRigVisionPlanner(images[]) -> RigIntent
    +-- rig-mapping.ts              NEW: PEDAL_HELIX_MAP lookup + mapRigToToneIntent()
    +-- gemini.ts                   UNCHANGED
    +-- helix/
        +-- rig-intent.ts           NEW: all rig-related Zod schemas and types
        +-- tone-intent.ts          UNCHANGED
        +-- chain-rules.ts          UNCHANGED
        +-- param-engine.ts         UNCHANGED
        +-- snapshot-engine.ts      UNCHANGED
        +-- preset-builder.ts       UNCHANGED
        +-- podgo-builder.ts        UNCHANGED
        +-- models.ts               UNCHANGED
        +-- types.ts                UNCHANGED
        +-- index.ts                MODIFIED: export rig-intent types
        +-- validate.ts             UNCHANGED
        +-- config.ts               UNCHANGED
        +-- param-registry.ts       UNCHANGED
```

### Structure Rationale

- **`rig-vision.ts` at `src/lib/` level:** Peers with `planner.ts` — both are AI call modules, not domain types. The `lib/` level owns AI calls; `lib/helix/` owns domain types and the Knowledge Layer.
- **`rig-mapping.ts` at `src/lib/` level:** The mapping layer is a translation concern bridging the physical rig domain and the Helix domain. It logically sits between `rig-vision.ts` (what the user has) and `planner.ts` (what Helix should use).
- **`rig-intent.ts` inside `src/lib/helix/`:** RigIntent and SubstitutionEntry describe Helix-specific substitution concepts. They belong in the helix domain module alongside ToneIntentSchema and are exported through the existing `src/lib/helix/index.ts` barrel.

---

## Architectural Patterns

### Pattern 1: Dedicated Vision Extraction Function

**What:** `callRigVisionPlanner(images: Base64Image[])` is a standalone async function that makes one Claude API call with all images in a single message, using labeled content blocks ("Pedal 1:", "Pedal 2:"), and returns a `RigIntent`.

**When to use:** Every time the generate endpoint receives images[] in the request body.

**Trade-offs:** One additional API call per generation (adds approximately 1-2 seconds latency). Benefit: the vision prompt is narrow and focused — it only asks "what pedals and knob positions do you see?" rather than also asking "what Helix preset should I build?"

**Note on structured output with vision:** The Claude API officially supports combining image content blocks with `output_config.format` (zodOutputFormat) in the same call — this is confirmed in the Anthropic structured outputs documentation. Either approach works for the vision call. Start without zodOutputFormat for simplicity. If extraction reliability is poor in testing, add `output_config` to the vision call with a RigIntentSchema JSON schema.

**Implementation shape:**

```typescript
// src/lib/rig-vision.ts
import Anthropic from "@anthropic-ai/sdk";
import { RigIntentSchema } from "@/lib/helix/rig-intent";
import type { RigIntent } from "@/lib/helix/rig-intent";

export interface Base64Image {
  data: string;      // raw base64 string (strip "data:image/jpeg;base64," prefix)
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}

export async function callRigVisionPlanner(
  images: Base64Image[]
): Promise<RigIntent> {
  const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY! });

  // Official docs: place images before text for best results
  const contentBlocks: Anthropic.MessageParam["content"] = [
    ...images.flatMap((img, i) => [
      { type: "text" as const, text: `Pedal ${i + 1}:` },
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: img.mediaType, data: img.data },
      },
    ]),
    { type: "text" as const, text: buildRigExtractionPrompt() },
  ];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: contentBlocks }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No vision response");
  const raw = JSON.parse(extractJsonFromText(textBlock.text));
  return RigIntentSchema.parse(raw);
}
```

### Pattern 2: Static Lookup Table in rig-mapping.ts

**What:** `PEDAL_HELIX_MAP` is a curated constant — a typed `Record` mapping normalized physical pedal names (lowercase) to their best Helix equivalent with substitution metadata and knob translation functions.

**When to use:** Always for physical-to-Helix mapping. Never let AI decide the mapping at generation time.

**Trade-offs:** Requires up-front curation effort (estimated 40-60 entries to cover most common pedals at launch). Benefit: deterministic, auditable, improvable without model changes. This follows the same philosophy as the existing Knowledge Layer.

**Implementation shape:**

```typescript
// src/lib/rig-mapping.ts

import type { DeviceTarget } from "@/lib/helix";
import type { RigIntent, SubstitutionEntry } from "@/lib/helix/rig-intent";

export interface PedalMapEntry {
  helixModel: string;      // Exact name from EFFECT_NAMES or AMP_NAMES
  helixCategory: "distortion" | "amp" | "modulation" | "delay" | "reverb" | "dynamics";
  reason: string;          // Human-readable substitution rationale
  confidence: "direct" | "close" | "approximate";
  // Optional: knob name -> function converting physical % to Helix 0-1
  knobTranslation?: Record<string, (knobPercent: number) => number>;
}

export const PEDAL_HELIX_MAP: Record<string, PedalMapEntry> = {
  // Tube Screamer variants
  "ibanez ts9":           { helixModel: "Teemah!", helixCategory: "distortion",
                            confidence: "close", reason: "..." },
  "ibanez ts808":         { helixModel: "Teemah!", helixCategory: "distortion",
                            confidence: "direct", reason: "..." },
  // Boss overdrives
  "boss sd-1":            { helixModel: "Minotaur", helixCategory: "distortion",
                            confidence: "close", reason: "..." },
  "boss od-1x":           { helixModel: "Minotaur", helixCategory: "distortion",
                            confidence: "approximate", reason: "..." },
  // ... 40-60 entries at launch covering most common stomp boxes
};

export function mapRigToToneIntent(
  rigIntent: RigIntent,
  device: DeviceTarget,
): { substitutions: SubstitutionEntry[]; toneContext: string; unmappedPedals: string[] } {
  const substitutions: SubstitutionEntry[] = [];
  const unmappedPedals: string[] = [];

  for (const pedal of rigIntent.pedals) {
    const lookupKey = pedal.fullName.toLowerCase();
    const entry = PEDAL_HELIX_MAP[lookupKey];

    if (!entry) {
      // Fuzzy fallback: try brand + model combination
      const fallbackKey = `${pedal.brand.toLowerCase()} ${pedal.model.toLowerCase()}`;
      const fallback = PEDAL_HELIX_MAP[fallbackKey];
      if (!fallback) {
        unmappedPedals.push(pedal.fullName);
        continue;
      }
    }

    const mapEntry = entry ?? PEDAL_HELIX_MAP[`${pedal.brand.toLowerCase()} ${pedal.model.toLowerCase()}`]!;
    const parameterMapping = translateKnobs(pedal.knobPositions, mapEntry);

    substitutions.push({
      physicalPedal: pedal.fullName,
      helixModel: mapEntry.helixModel,
      substitutionReason: mapEntry.reason,
      parameterMapping,
      confidence: mapEntry.confidence,
    });
  }

  const toneContext = buildToneContextString(substitutions, unmappedPedals);
  return { substitutions, toneContext, unmappedPedals };
}
```

### Pattern 3: Planner Hint Injection via toneContext

**What:** The existing `callClaudePlanner` receives an optional `toneContext` string that is appended to the conversation text before the API call. This string summarizes the rig mapping result so Claude selects the already-mapped Helix models.

**When to use:** When `rigIntent` is present (images were provided) or when the API route has a mapping result.

**Trade-offs:** Minimal change to `planner.ts`. The toneContext is appended to the user-facing conversation text block, not embedded in the system prompt. This preserves the existing prompt cache on the system prompt — the cached system prompt is not invalidated by per-request rig context.

**Implementation change to planner.ts:**

```typescript
// MODIFIED signature — toneContext is optional, backwards-compatible
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
  toneContext?: string,   // NEW — rig mapping summary if images were provided
): Promise<ToneIntent> {
  // ... (client setup, modelList, systemPrompt — all unchanged) ...

  let conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Append rig context after conversation — does not invalidate system prompt cache
  if (toneContext) {
    conversationText +=
      `\n\n[RIG CONTEXT]\n${toneContext}\n` +
      `Please base your amp and effect model selections primarily on the ` +
      `mapped Helix equivalents listed above.`;
  }

  // API call — structure unchanged
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: conversationText }],
    output_config: { format: zodOutputFormat(ToneIntentSchema) },
  });
  // ... rest unchanged ...
}
```

---

## Data Flow

### Full Request Flow with Images

```
User attaches pedal photos + clicks "Generate Preset"
    |
    v
page.tsx: FileReader.readAsDataURL -> strip data URL prefix -> base64 strings
          Validate: max 3 images, max 1.5 MB each (before encoding)
          Compress/resize to <= 1 MP using canvas API if needed
    |
    v
POST /api/generate
  body: { messages[], device, images?: [{ data, mediaType }] }
    |
    +-- if images[] present:
    |       |
    |       v
    |   callRigVisionPlanner(images) -> RigIntent
    |       |
    |       v
    |   mapRigToToneIntent(rigIntent, device)
    |       -> { substitutions[], toneContext, unmappedPedals[] }
    |
    +-- callClaudePlanner(messages, device, toneContext?) -> ToneIntent
    |
    +-- assembleSignalChain(toneIntent, device) -> BlockSpec[]   [existing]
    +-- resolveParameters(chain, toneIntent) -> BlockSpec[]      [existing]
    +-- buildSnapshots(chain, toneIntent.snapshots) -> Snapshot[] [existing]
    +-- validatePresetSpec(presetSpec, device)                    [existing]
    +-- buildHlxFile / buildPgpFile                               [existing]
    |
    v
Response: {
  preset,                    // existing
  summary,                   // existing
  spec,                      // existing
  toneIntent,                // existing
  device,                    // existing
  fileExtension,             // existing
  substitutions?: SubstitutionEntry[],   // NEW — only if images provided
  unmappedPedals?: string[],             // NEW
}
    |
    v
page.tsx: render SubstitutionCard if substitutions[] present
```

### Text-Only Rig Description Flow

When the user types "TS9 -> Blues Breaker -> Fender Twin Reverb" without images:

```
POST /api/generate
  body: { messages[], device }  (no images field)
    |
    +-- No vision step (images absent)
    +-- callClaudePlanner(messages, device)  <- unchanged behavior
    |   The planner reads the text description from messages[] and uses
    |   its training knowledge to select appropriate Helix models.
    |
    v
Response: { preset, summary, spec, toneIntent, device, fileExtension }
  (no substitutions field — UI shows nothing extra)
```

Text-only rig descriptions require zero new backend logic. The existing planner handles them without modification because the conversation history already contains the gear description.

### Client-Side Image Handling

```
User selects files via file input or drag-drop
    |
    v
Validate in browser:
  - Accept: image/jpeg, image/png, image/gif, image/webp (Claude API limits)
  - Max 3 images per request (stays under Vercel 4.5 MB body limit)
  - Max 1.5 MB per image before base64 encoding (~2 MB encoded)
    |
    v
Compress/resize if needed:
  - Target: <= 1 megapixel (1000x1000 px equivalent)
  - Target: <= 1568 px on longest edge (Claude docs optimal dimension)
  - Use canvas API: drawImage -> toBlob with JPEG quality 0.85
    |
    v
FileReader.readAsDataURL -> "data:image/jpeg;base64,<data>"
Strip prefix -> raw base64 string
    |
    v
Include in POST body: images: [{ data: "<base64>", mediaType: "image/jpeg" }]
```

---

## Integration Points

### New vs Modified vs Existing Files — Explicit

**New files (create from scratch):**

| File | Exports | Purpose |
|------|---------|---------|
| `src/lib/helix/rig-intent.ts` | `PhysicalPedalSchema`, `RigIntentSchema`, `SubstitutionEntrySchema`, `SubstitutionMapSchema` and inferred types | All Zod schemas for the rig domain |
| `src/lib/rig-vision.ts` | `callRigVisionPlanner(images[])`, `Base64Image` | Claude vision API call |
| `src/lib/rig-mapping.ts` | `PEDAL_HELIX_MAP`, `mapRigToToneIntent()` | Static pedal lookup + translation |

**Modified files (specific changes only):**

| File | Change | Lines affected |
|------|--------|----------------|
| `src/app/page.tsx` | Add file input or drag-drop; add SubstitutionCard component; send images[] in generate POST | New state: `images`, `substitutions`; new UI sections |
| `src/app/api/generate/route.ts` | Parse images from body; call vision + mapping if present; add substitutions to response | ~20 new lines in try block |
| `src/lib/planner.ts` | Add `toneContext?: string` as third parameter to `callClaudePlanner`; append to conversationText if present | ~8 lines |
| `src/lib/helix/index.ts` | Add exports for rig-intent types | ~4 lines |

**Unchanged files (zero modification):**

```
src/lib/helix/tone-intent.ts     ToneIntentSchema is device-agnostic; rig data never enters it
src/lib/helix/chain-rules.ts     Receives ToneIntent as before; no rig awareness needed
src/lib/helix/param-engine.ts    Receives ToneIntent as before
src/lib/helix/snapshot-engine.ts Receives ToneIntent as before
src/lib/helix/preset-builder.ts  Receives PresetSpec as before
src/lib/helix/podgo-builder.ts   Receives PresetSpec as before
src/lib/helix/models.ts          Model catalog unchanged
src/lib/helix/types.ts           Core types unchanged
src/lib/helix/validate.ts        Validation unchanged
src/lib/helix/config.ts          Unchanged
src/lib/helix/param-registry.ts  Unchanged
src/lib/gemini.ts                Unchanged
```

---

## Suggested Build Order for Phases

Dependencies determine order. Each phase must be completable and testable independently before the next begins.

### Phase 1: New Schemas and Types

**Files:** `src/lib/helix/rig-intent.ts`, update `src/lib/helix/index.ts`

**Why first:** Every other new module imports from here. RigIntentSchema, PhysicalPedalSchema, SubstitutionEntrySchema, and SubstitutionMapSchema must exist before any function can reference them. Zero external dependencies — compiles and validates with just Zod.

**Done when:** All types compile, Zod schemas parse correctly against example data, exports visible from `@/lib/helix`.

**Estimated scope:** ~60 lines.

### Phase 2: Pedal Mapping Table

**Files:** `src/lib/rig-mapping.ts`

**Why second:** Pure data plus deterministic transformation logic. No dependency on the Claude API. Can be built and tested without any AI calls. The quality of this table determines substitution quality — it deserves its own phase to be built carefully.

**Target at launch:** 40-60 entries covering:
- All major Boss overdrives, distortions, modulations (SD-1, DS-1, BD-2, OD-3, CE-5, CH-1, BF-3)
- All Ibanez Tube Screamer variants (TS5, TS7, TS9, TS808, TS10)
- ProCo Rat family
- Electro-Harmonix Big Muff variants (NYC, Green Russian, Triangle)
- Fulltone OCD, Full-Drive 2
- MXR Phase 90, Dyna Comp, Carbon Copy
- Common amp names in text descriptions (Fender Twin -> Archon 50 Clean, Marshall JCM800 -> Brit 2204, Mesa Boogie -> Cali IV Rhythm 2)

**Depends on:** Phase 1 types (SubstitutionEntry, SubstitutionMap).

**Done when:** `mapRigToToneIntent()` correctly maps known pedals, handles unknown pedals via `unmappedPedals[]`, and returns a valid toneContext string.

### Phase 3: Vision Extraction

**Files:** `src/lib/rig-vision.ts`

**Why third:** References Phase 1 types. Tested against Phase 2 mapping to verify end-to-end flow. The vision prompt can be tuned independently of any planner changes.

**Depends on:** Phase 1 types. Claude API key in env.

**Done when:** `callRigVisionPlanner([pedal_photo])` returns a `RigIntent` with correct brand, model, and approximate knob positions for a known test pedal photo.

**Testing approach:** Use a high-quality JPEG photo of a Boss SD-1 or Ibanez TS9 as the baseline test case. Both are well-documented pedals Claude will recognize reliably.

### Phase 4: API Route and Planner Integration

**Files:** `src/app/api/generate/route.ts`, `src/lib/planner.ts`

**Why fourth:** Wires the full pipeline together. The route now calls vision -> mapping -> planner in sequence when images are present. The planner receives toneContext. Both new code paths are tested end-to-end.

**Depends on:** Phases 1, 2, 3 complete. All new imports resolvable.

**Done when:** A POST to `/api/generate` with a pedal photo produces a preset that reflects the mapped pedal selections in ToneIntent (planner selected "Teemah!" when user uploaded a TS9 photo), and the response JSON includes `substitutions[]`.

### Phase 5: Browser Image Upload UI and Substitution Card

**Files:** `src/app/page.tsx`

**Why fifth:** UI is the last layer. The backend API contract (what fields go in the request, what comes back in the response) must be stable before building UI against it.

**UI changes:**
- File input or drag-drop area in the chat input section (below the textarea)
- Image thumbnail previews with remove button
- Client-side size validation and compression
- `SubstitutionCard` component rendering `substitutions[]` in the preset result

**Done when:** User attaches 1-3 pedal photos, generates a preset, and sees the substitution card showing "TS9 Tube Screamer -> Teemah! — closest gain structure and mid-hump EQ" in the results view.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | Two sequential Claude calls per generation (vision + planner). Estimated ~$0.008-0.020 per generation with images (vision adds ~1600 tokens per image). Acceptable on free tier. |
| 1k-100k users | Vision call latency dominates if images are large. Enforce aggressive client-side compression (target 500-800px max). Consider `cache_control: ephemeral` on the vision system prompt if using one. |
| 100k+ users | PEDAL_HELIX_MAP maintenance becomes a concern — consider migrating to a JSON data file or database. Consider parallelizing vision + an optimistic planner call (cancel if vision fails). |

### Scaling Priorities

1. **First bottleneck:** Vercel 4.5 MB body limit with multiple large images. Prevention: enforce ≤ 1.5 MB per image and ≤ 3 images client-side before encoding. Target ≤ 1 MB total base64 payload in normal use.

2. **Second bottleneck:** Two sequential API calls increasing latency to 6-10 seconds for image-based generation (vs. 3-5 seconds for text-only). If this is unacceptable, consider streaming a "Analyzing your rig..." progress indicator while the vision call runs.

---

## Anti-Patterns

### Anti-Pattern 1: Let AI Handle the Physical-to-Helix Mapping in the Planner Prompt

**What people do:** Add the pedal photos directly to the existing `callClaudePlanner` call and instruct Claude to "pick the closest Helix equivalent" in the same prompt that generates ToneIntent.

**Why it's wrong:** The mapping result is not auditable. When Claude maps a Big Muff to a high-gain amp model instead of a fuzz distortion block, you cannot fix it without changing the planner prompt and retesting all existing tone generation. The mapping and creative-selection concerns are entangled.

**Do this instead:** Two-step. Extract with `callRigVisionPlanner`, map deterministically with `PEDAL_HELIX_MAP`, pass result as toneContext hint to planner.

### Anti-Pattern 2: Extend ToneIntentSchema with Rig Fields

**What people do:** Add `rigPedals?: PhysicalPedal[]` or `substitutions?: SubstitutionEntry[]` directly to ToneIntentSchema.

**Why it's wrong:** ToneIntent is the AI output contract. It describes which Helix models to use, not what physical gear was mapped. Mixing the two schemas creates a contract that is part-AI-output, part-pre-processed infrastructure data. The Knowledge Layer would receive fields it never uses and the schema becomes harder to reason about.

**Do this instead:** Keep ToneIntent exactly as-is. Substitutions travel alongside ToneIntent in the API response as a parallel field (`substitutions?: SubstitutionEntry[]`), not inside it.

### Anti-Pattern 3: Accept Image Uploads as multipart/form-data in the API Route

**What people do:** Use multipart/form-data file upload in the Next.js App Router API route, decode the uploaded file server-side, then pass to Claude.

**Why it's wrong:** Vercel serverless functions have a 4.5 MB request body limit and the Next.js App Router does not have a built-in multipart streaming parser. Large image uploads will trigger 413 errors before reaching the handler.

**Do this instead:** Encode images in the browser before sending. Use `FileReader.readAsDataURL`, strip the data URL prefix, send the raw base64 string in the existing JSON body alongside messages. Enforce size limits client-side so the request body stays under 3 MB total.

### Anti-Pattern 4: One Claude API Call Per Pedal Photo

**What people do:** Iterate over `images[]` and call `callRigVisionPlanner` once per image.

**Why it's wrong:** The Claude API supports up to 100 images in a single messages call. Calling once per photo multiplies API call count, latency, and cost proportionally with the number of photos. With 3 photos, this triples the cost and adds 3-6 seconds of additional latency.

**Do this instead:** Pass all images in a single call with labeled content blocks ("Pedal 1:", "Pedal 2:") and ask Claude to return a `pedals[]` array with one entry per image. The official Claude vision documentation demonstrates multi-image comparison in a single call.

### Anti-Pattern 5: Store Base64 Images in React State Across Re-renders

**What people do:** Store the full base64 strings in React state so they persist through the chat conversation.

**Why it's wrong:** A 1.5 MB image becomes a 2 MB base64 string. Three images = 6 MB in component state, causing slow re-renders. The images are only needed at the moment "Generate Preset" is clicked.

**Do this instead:** Store `File` objects in React state (or a ref). Convert to base64 only in the `generatePreset()` function immediately before the API call. Release after the call completes.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Anthropic Messages API (vision) | `client.messages.create` with image content blocks in user message | Same SDK instance, same `CLAUDE_API_KEY`. Image content blocks are standard API — no beta header needed. |
| Anthropic Messages API (planner) | Existing — completely unchanged | Prompt caching on system prompt unaffected by toneContext appended to user message |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `route.ts` -> `rig-vision.ts` | Direct function call, `Base64Image[]` in, `RigIntent` out | No shared state; pure async function |
| `rig-vision.ts` -> `rig-mapping.ts` | Direct function call, `RigIntent` in, `{ substitutions[], toneContext }` out | Deterministic; fully testable in isolation with no API dependency |
| `rig-mapping.ts` -> `planner.ts` | `toneContext: string` passed as third argument | Minimal coupling; planner treats it as additional conversation context |
| `route.ts` -> `page.tsx` | JSON response field `substitutions?: SubstitutionEntry[]` | Optional — only present when images were provided; UI checks for existence before rendering |

---

## Sources

- [Anthropic Vision Documentation](https://platform.claude.com/docs/en/build-with-claude/vision) — Image content block format, size limits (5 MB per image, 100 images per request, 32 MB total request), base64 encoding, multi-image best practices, image-before-text placement recommendation. HIGH confidence.
- [Anthropic Structured Outputs Documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `output_config.format` (zodOutputFormat equivalent) is generally available on Claude Sonnet 4.6; compatible with vision image input in the same call. HIGH confidence.
- [Vercel Functions Limitations](https://vercel.com/docs/functions/limitations) — 4.5 MB request body limit confirmed; not configurable; workarounds are streaming or client-side uploads. HIGH confidence.
- Existing codebase inspection — `planner.ts`, `route.ts`, `tone-intent.ts`, `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`, `types.ts`, `index.ts`, `page.tsx` read in full. All integration points verified against actual code.

---

*Architecture research for: HelixAI v1.3 Rig Emulation — vision input extension to the Planner-Executor architecture*
*Researched: 2026-03-02*
