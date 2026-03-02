# Phase 3: AI Integration - Research

**Researched:** 2026-03-02
**Domain:** Claude Sonnet 4.6 structured output integration, Planner prompt design, Zod-to-JSON-Schema pipeline
**Confidence:** HIGH

## Summary

Phase 3 wires Claude Sonnet 4.6 as the single AI generation provider using constrained structured output via `output_config` with `type: "json_schema"`. The ToneIntentSchema (already defined in Phase 1 as a Zod schema) becomes the single source of truth: Zod generates TypeScript types AND the JSON Schema that Claude's constrained decoding enforces at the token level. The Planner prompt is a narrow prompt that lists valid model IDs as enums and asks for only creative choices (~15 fields). No prompt language asks Claude to supply Drive, Master, EQ, or other numeric parameter values.

The existing codebase has all the pieces in place: `ToneIntentSchema` in `tone-intent.ts`, `getModelListForPrompt()` in `models.ts`, and the Knowledge Layer modules (`chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`) from Phase 2. The Anthropic SDK (`@anthropic-ai/sdk` 0.78.0) is already installed and supports structured outputs via `output_config.format` (GA, no beta header required). Zod v4 (`zod@4.3.6`) provides `z.toJSONSchema()` natively. No new packages are needed.

**Primary recommendation:** Use the Anthropic SDK's `zodOutputFormat()` helper from `@anthropic-ai/sdk/helpers/zod` to convert the ToneIntentSchema directly into the Claude output_config format. Modify ToneIntentSchema to use `z.enum()` arrays for `ampName`, `cabName`, and `effects[].modelName` instead of `z.string()` so Claude cannot hallucinate model IDs. The existing generate route gets refactored to: call Claude Planner -> parse ToneIntent -> pipe through Knowledge Layer -> build .hlx.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No locked decisions -- all Phase 3 decisions are delegated to Claude's discretion.

### Claude's Discretion
All Phase 3 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Claude Sonnet 4.6 integration** -- Use output_config with type: "json_schema" for constrained decoding. The JSON schema is derived from ToneIntentSchema via z.toJSONSchema(). Single source of truth: Zod schema -> TypeScript types AND Claude schema.
- **Planner prompt design** -- Narrow prompt that lists valid model IDs as enums, asks for ~15 creative fields only. No language about Drive, Master, EQ, or numeric parameters. The prompt must make clear that the Knowledge Layer handles all parameter values.
- **Model ID enumeration in prompt** -- Include full AMP_MODELS, CAB_MODELS, and EFFECT_MODELS name lists in the prompt so Claude can only choose from valid IDs. Invalid IDs cause schema rejection, not auto-correction.
- **Gemini chat preservation** -- The existing Gemini streaming chat with Google Search grounding for artist/rig research is unchanged. Only the generation endpoint changes.
- **Provider simplification** -- Remove multi-provider comparison logic. Single provider (Claude Sonnet 4.6) generates one excellent ToneIntent per request.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AI-01 | Claude Sonnet 4.6 as single generation provider with output_config structured output (constrained decoding) | Anthropic SDK `output_config.format` with `type: "json_schema"` is GA on Sonnet 4.6; `zodOutputFormat()` helper converts Zod schemas directly; constrained decoding enforces schema at token level |
| AI-02 | ToneIntent Zod schema with z.toJSONSchema() export -- single source of truth for TypeScript types and AI schema | Zod v4's `z.toJSONSchema()` is built-in and produces valid JSON Schema; `zodOutputFormat()` from SDK handles the conversion pipeline; Zod schema -> types AND JSON Schema from one definition |
| AI-03 | Complete valid model ID enumeration in Planner prompt -- prevents hallucination via enum constraint | ToneIntentSchema's `ampName`, `cabName`, and `effects[].modelName` should use `z.enum()` with model name arrays extracted from AMP_MODELS/CAB_MODELS/EFFECT_MODELS keys; schema-level rejection of invalid IDs |
| AI-04 | Gemini chat phase unchanged -- keeps Google Search grounding for artist/rig research | `src/app/api/chat/route.ts` and `src/lib/gemini.ts` (chat system prompt + `getSystemPrompt()`) are untouched; only `getPresetGenerationPrompt()` is replaced |
| AI-05 | Planner prompt generates only creative choices (~15 fields) -- Knowledge Layer generates all parameter values | Prompt instructs Claude to pick model names, guitar type, effects, snapshot roles, and optional genre/tempo hints only; explicitly states "Do NOT generate Drive, Master, EQ, or any numeric parameter values" |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.78.0 (installed) | Claude API client with structured outputs support | Already installed; provides `zodOutputFormat()` helper and `client.messages.create()` with `output_config` |
| `zod` | 4.3.6 (installed) | Schema definition, TypeScript type inference, JSON Schema generation | Already installed; Zod v4 has native `z.toJSONSchema()` and `z.enum()` for constrained string lists |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk/helpers/zod` | (part of SDK) | `zodOutputFormat()` helper for converting Zod schemas to Claude's output_config format | Use when building the output_config parameter for Claude API calls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zodOutputFormat()` | Manual `z.toJSONSchema()` + raw `output_config` | zodOutputFormat handles SDK-specific transformations (strips unsupported constraints, adds `additionalProperties: false`); manual approach requires more boilerplate |
| `client.messages.parse()` | `client.messages.create()` + manual JSON.parse | `.parse()` returns typed `parsed_output` directly; `.create()` requires manual parsing of `content[0].text` |

**Installation:**
```bash
# No new packages needed - all dependencies already installed
# @anthropic-ai/sdk@0.78.0 -- Claude API with structured outputs (GA)
# zod@4.3.6 -- Schema + JSON Schema generation
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helix/
  tone-intent.ts         -- ToneIntentSchema with z.enum() model constraints (MODIFY)
  models.ts              -- getModelListForPrompt(), model name arrays (ADD helper exports)
  chain-rules.ts         -- assembleSignalChain() (UNCHANGED)
  param-engine.ts        -- resolveParameters() (UNCHANGED)
  snapshot-engine.ts     -- buildSnapshots() (UNCHANGED)

src/lib/
  planner.ts             -- NEW: Claude Planner module (prompt + API call + schema)
  gemini.ts              -- Chat system prompt (UNCHANGED for chat; remove getPresetGenerationPrompt)
  providers.ts           -- SIMPLIFY: remove multi-provider abstraction

src/app/api/
  chat/route.ts          -- Gemini chat endpoint (UNCHANGED)
  generate/route.ts      -- REFACTOR: Planner -> Knowledge Layer -> .hlx pipeline
```

### Pattern 1: Zod Schema as Single Source of Truth
**What:** The ToneIntentSchema Zod definition generates both TypeScript types (via `z.infer`) and the Claude output JSON Schema (via `zodOutputFormat()`). One schema definition, two outputs.
**When to use:** Always -- this is the core AI-02 requirement.
**Example:**
```typescript
// Source: Anthropic structured outputs docs (GA) + Zod v4 docs
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// The schema IS the source of truth
const ToneIntentSchema = z.object({
  ampName: z.enum(["US Deluxe Nrm", "Placater Dirty", /* ... all names */]),
  cabName: z.enum(["1x12 US Deluxe", "4x12 Cali V30", /* ... all names */]),
  // ... other fields
});

// TypeScript type from schema
type ToneIntent = z.infer<typeof ToneIntentSchema>;

// Claude output_config from schema
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: plannerSystemPrompt,
  messages: [...],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});

// Response text is guaranteed valid JSON matching schema
const intent: ToneIntent = JSON.parse(response.content[0].text);
```

### Pattern 2: Enum Constraint for Model ID Validation (AI-03)
**What:** Instead of `z.string()` for ampName/cabName/modelName, use `z.enum()` with arrays of valid model names extracted from the model database. Claude's constrained decoding then physically cannot output an invalid model ID.
**When to use:** For all model name fields in ToneIntentSchema.
**Critical detail:** Claude's structured outputs support `enum` with string values. An invalid ID causes a schema-level rejection, NOT a downstream auto-correction.
**Example:**
```typescript
// Extract model name arrays from the database
import { AMP_MODELS, CAB_MODELS, DISTORTION_MODELS, DELAY_MODELS,
  REVERB_MODELS, MODULATION_MODELS, DYNAMICS_MODELS } from "./models";

const AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];
const CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];
// Combine all effect model names into one array
const EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];

export const ToneIntentSchema = z.object({
  ampName: z.enum(AMP_NAMES),
  cabName: z.enum(CAB_NAMES),
  effects: z.array(z.object({
    modelName: z.enum(EFFECT_NAMES),
    role: z.enum(["always_on", "toggleable", "ambient"]),
  })).max(6),
  // ... rest unchanged
});
```

### Pattern 3: Planner -> Knowledge Layer Pipeline
**What:** The `/api/generate` route orchestrates a linear pipeline: Claude Planner -> `assembleSignalChain()` -> `resolveParameters()` -> `buildSnapshots()` -> `buildHlxFile()`.
**When to use:** Every generation request.
**Example:**
```typescript
// Source: ARCHITECTURE.md data flow pattern
import { assembleSignalChain, resolveParameters, buildSnapshots,
  buildHlxFile, ToneIntentSchema } from "@/lib/helix";

// Step 1: Call Claude Planner (AI decision)
const toneIntent = await callClaudePlanner(conversationHistory);

// Step 2: Validate with Zod (belt-and-suspenders)
const parsed = ToneIntentSchema.parse(toneIntent);

// Step 3: Knowledge Layer (deterministic)
const chain = assembleSignalChain(parsed);
const parameterized = resolveParameters(chain, parsed);
const snapshots = buildSnapshots(parameterized, parsed.snapshots);

// Step 4: Build PresetSpec
const presetSpec = {
  name: generatePresetName(parsed),
  description: generateDescription(parsed),
  tempo: parsed.tempoHint ?? 120,
  signalChain: parameterized,
  snapshots,
};

// Step 5: Build .hlx file
const hlxFile = buildHlxFile(presetSpec);
```

### Pattern 4: Narrow Planner Prompt
**What:** The system prompt for the Planner is short and focused. It describes the ToneIntent fields, lists valid model names, and explicitly states that numeric parameters are NOT generated by the AI.
**When to use:** The system prompt passed to every Claude generation call.
**Key elements:**
1. Role description: "You are a Helix preset Planner. You choose creative model selections only."
2. Valid model names listed (from `getModelListForPrompt()` or similar)
3. Schema description with field meanings
4. Explicit exclusion: "Do NOT generate Drive, Master, EQ, LowCut, HighCut, or any numeric parameter values. The Knowledge Layer handles all parameters."
5. Context: conversation history from Gemini chat interview

### Anti-Patterns to Avoid
- **Do NOT include parameter guidance in the Planner prompt:** The old `getPresetGenerationPrompt()` is 250+ lines of amp settings, cab settings, EQ values. None of this belongs in the Planner prompt. Parameters come from the Knowledge Layer.
- **Do NOT ask Claude to generate PresetSpec:** Claude generates ToneIntent only (~15 fields). The full PresetSpec (~50+ fields with all parameters) is built deterministically.
- **Do NOT auto-correct invalid model IDs:** The schema enum constraint prevents invalid IDs at generation time. If an invalid ID somehow appears, fail fast, do not fuzzy-match.
- **Do NOT use `client.messages.create()` without `output_config`:** Always use structured output. Free-form JSON generation is fragile and the entire point of Phase 3 is constrained decoding.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Zod-to-JSON-Schema conversion | Custom schema walker | `zodOutputFormat()` from `@anthropic-ai/sdk/helpers/zod` | SDK helper handles constraint stripping, `additionalProperties: false` injection, and format compatibility automatically |
| JSON parsing of Claude response | Manual regex/fence stripping | `output_config` structured output | Constrained decoding guarantees valid JSON; no `JSON.parse()` errors, no markdown fence wrapping |
| Model ID validation | Post-hoc string similarity matching | `z.enum()` constraint in schema | Schema-level rejection at token generation time vs. downstream correction |
| TypeScript types for ToneIntent | Separate interface definition | `z.infer<typeof ToneIntentSchema>` | Single source of truth; type and schema always match |
| System prompt transformation | Manual JSON Schema construction | `zodOutputFormat()` | Automatically strips unsupported constraints (min/max/minLength) and adds them to descriptions instead |

**Key insight:** The Anthropic SDK's Zod integration (`zodOutputFormat`) is purpose-built for exactly this use case. It handles the impedance mismatch between Zod's rich validation (min/max/regex) and Claude's JSON Schema subset (no numerical constraints) by stripping unsupported features and moving them to descriptions. Using it avoids a class of subtle bugs.

## Common Pitfalls

### Pitfall 1: Unsupported JSON Schema Constraints
**What goes wrong:** Zod's `.min()`, `.max()`, `.int()` generate `minimum`, `maximum`, `multipleOf` in JSON Schema. Claude's structured outputs do NOT support these constraints and return a 400 error.
**Why it happens:** Zod v4's `z.toJSONSchema()` faithfully converts all Zod validations to JSON Schema, including ones Claude rejects.
**How to avoid:** Use `zodOutputFormat()` from the Anthropic SDK instead of raw `z.toJSONSchema()`. The SDK helper automatically strips unsupported constraints and adds them to field descriptions instead. The SDK then validates the response against the original Zod schema (with all constraints) after parsing.
**Warning signs:** 400 errors from Claude API with messages about unsupported schema features.
**Specific fields affected in ToneIntentSchema:**
- `z.array(SnapshotIntentSchema).min(4).max(4)` -- `.min(4)` becomes `minItems: 4` which is unsupported (only 0 and 1 supported). `zodOutputFormat` handles this.
- `z.number().int().min(60).max(200)` for tempoHint -- `.int()`, `.min()`, `.max()` all unsupported. `zodOutputFormat` handles this.
- `z.string().max(10)` for snapshot name -- `.max(10)` unsupported. `zodOutputFormat` handles this.

### Pitfall 2: Large Enum Arrays in Schema
**What goes wrong:** The combined model name list across all categories is 100+ entries. A `z.enum()` with 100+ string values creates a large JSON Schema that increases API latency on the first call (schema compilation) and token count.
**Why it happens:** Claude compiles the schema into a token grammar; larger schemas take longer to compile but are cached for 24 hours.
**How to avoid:** Accept the first-call latency hit (it is a one-time cost per schema change). The enum constraint is essential for AI-03. Alternatively, keep `ampName` and `cabName` as `z.enum()` (critical for correctness) and consider keeping `effects[].modelName` as `z.enum()` of the combined effect list. The token overhead is acceptable given the reliability gain.
**Warning signs:** First generation request takes 3-5 seconds longer than subsequent ones (schema compilation). This is expected and not a bug.

### Pitfall 3: Forgetting to Remove Old Multi-Provider Logic
**What goes wrong:** The existing `providers.ts` has Gemini/OpenAI/Claude provider abstraction and the generate route fires all providers in parallel. If this is left in place, the route still tries to call Gemini and OpenAI for generation.
**Why it happens:** Phase 3 simplifies to single-provider, but the old code remains.
**How to avoid:** Replace `providers.ts` with a focused Claude-only module. Refactor `generate/route.ts` to use the new Planner module directly. Remove the `openai` package dependency if desired.
**Warning signs:** Generation route still imports from `providers.ts`.

### Pitfall 4: Prompt Leaking Numeric Parameter Instructions
**What goes wrong:** If the Planner prompt includes ANY numeric parameter guidance (even as context), Claude may try to include those values in its output, fighting the schema constraints. This wastes tokens and degrades output quality.
**Why it happens:** Copy-paste from the old monolithic `getPresetGenerationPrompt()`.
**How to avoid:** The Planner prompt must NOT contain: amp parameter ranges, cab settings, EQ values, boost parameters, snapshot ChVol values, or any text like "Master: 0.4-0.55". Audit the prompt to ensure zero numeric parameter language.
**Warning signs:** Planner prompt exceeds 100 lines or contains any `0.xx` numeric values.

### Pitfall 5: Not Using `client.messages.parse()` for Type Safety
**What goes wrong:** Using `client.messages.create()` returns raw text in `content[0].text`. You must manually `JSON.parse()` and cast the result. This loses type safety.
**Why it happens:** `create()` is the more familiar API method.
**How to avoid:** Use `client.messages.parse()` with `zodOutputFormat()` which returns `response.parsed_output` as a fully typed object matching the Zod schema. Alternatively, use `create()` + `JSON.parse()` + `ToneIntentSchema.parse()` for explicit Zod validation as a belt-and-suspenders approach.
**Warning signs:** Casting `as ToneIntent` without runtime validation.

### Pitfall 6: Modifying the Chat Endpoint
**What goes wrong:** Accidentally changing `gemini.ts` functions used by the chat endpoint while refactoring for the generation endpoint.
**Why it happens:** `gemini.ts` contains both `getSystemPrompt()` (chat) and `getPresetGenerationPrompt()` (generation). Refactoring the generation prompt may accidentally break the chat prompt.
**How to avoid:** Create a new `planner.ts` module for the Planner prompt. Remove `getPresetGenerationPrompt()` from `gemini.ts` but leave `getSystemPrompt()`, `createGeminiClient()`, `getModelId()`, and `isPremiumKey()` completely untouched.
**Warning signs:** Changes to `gemini.ts` that touch functions other than `getPresetGenerationPrompt()`.

## Code Examples

Verified patterns from official sources:

### Claude Structured Output with Zod (TypeScript)
```typescript
// Source: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
// GA on Claude Opus 4.6, Sonnet 4.6, Sonnet 4.5, Opus 4.5, Haiku 4.5
// No beta header required (moved from beta to GA)

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const ToneIntentSchema = z.object({
  ampName: z.enum(["US Deluxe Nrm", "Placater Dirty", /* ... */]),
  cabName: z.enum(["1x12 US Deluxe", "4x12 Cali V30", /* ... */]),
  guitarType: z.enum(["single_coil", "humbucker", "p90"]),
  genreHint: z.string().optional(),
  effects: z.array(z.object({
    modelName: z.enum(["Simple Delay", "Plate", /* ... */]),
    role: z.enum(["always_on", "toggleable", "ambient"]),
  })).max(6),
  snapshots: z.array(z.object({
    name: z.string().max(10),
    toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),
  })).min(4).max(4),
  tempoHint: z.number().int().min(60).max(200).optional(),
});

type ToneIntent = z.infer<typeof ToneIntentSchema>;

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: plannerSystemPrompt,
  messages: [
    { role: "user", content: conversationText },
  ],
  output_config: {
    format: zodOutputFormat(ToneIntentSchema),
  },
});

// Guaranteed valid JSON matching schema
const toneIntent = ToneIntentSchema.parse(
  JSON.parse(response.content[0].text)
);
```

### Extracting Model Name Arrays for Enum Constraints
```typescript
// Source: Existing models.ts + Zod v4 z.enum() docs

import { AMP_MODELS, CAB_MODELS, DISTORTION_MODELS, DELAY_MODELS,
  REVERB_MODELS, MODULATION_MODELS, DYNAMICS_MODELS } from "./models";

// z.enum() requires a tuple with at least one element: [string, ...string[]]
export const AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];
export const CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

// Combine all effect model names (excluding EQ, WAH, VOLUME -- Knowledge Layer handles those)
export const EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];
```

### Planner Prompt Structure (Skeleton)
```typescript
// Source: ARCHITECTURE.md Pattern 1 + CONTEXT.md decisions

export function buildPlannerPrompt(modelList: string): string {
  return `You are HelixAI's Planner. Your job is to translate a tone interview
conversation into a ToneIntent — a set of creative model choices.

## Your Role
You select WHICH amp, cab, and effects to use. You do NOT set any numeric
parameter values. The Knowledge Layer handles all parameters (Drive, Master,
Bass, Mid, Treble, EQ, LowCut, HighCut, etc.) using expert-validated lookup
tables. You only make creative decisions.

## Valid Model Names
Use ONLY these exact model names. Any name not in this list will be rejected.

${modelList}

## What You Generate
A ToneIntent JSON with these fields:
- ampName: exact name from the AMPS list above
- cabName: exact name from the CABS list above
- guitarType: "single_coil", "humbucker", or "p90"
- genreHint: optional genre/style description
- effects: up to 6 effects, each with modelName (from lists above) and role
- snapshots: exactly 4, each with name (max 10 chars) and toneRole
- tempoHint: optional BPM for delay sync

## What You Do NOT Generate
Do NOT include Drive, Master, Bass, Mid, Treble, Presence, Sag, ChVol,
LowCut, HighCut, Mic, Distance, Angle, EQ gains, delay Mix, reverb Mix,
or ANY numeric parameter values. The Knowledge Layer sets all of these.

## Creative Guidelines
- Match amp and cab to the genre/artist the user described
- Choose a cab that pairs well with the amp (check basedOn info)
- Pick effects that serve the described tone goal
- Keep effects minimal (2-4 typical, max 6)
- Name snapshots clearly (CLEAN, RHYTHM, LEAD, AMBIENT pattern)
- Set toneRole to match each snapshot's purpose

Based on the conversation below, generate a ToneIntent:`;
}
```

### Generate Route Pipeline (Skeleton)
```typescript
// Source: ARCHITECTURE.md data flow + existing route.ts structure

import { NextRequest, NextResponse } from "next/server";
import { callClaudePlanner } from "@/lib/planner";
import { assembleSignalChain, resolveParameters, buildSnapshots,
  buildHlxFile, ToneIntentSchema } from "@/lib/helix";
import type { PresetSpec } from "@/lib/helix";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "No conversation provided" }, { status: 400 });
  }

  // Step 1: Claude Planner generates ToneIntent
  const toneIntent = await callClaudePlanner(messages);

  // Step 2: Knowledge Layer pipeline (deterministic)
  const chain = assembleSignalChain(toneIntent);
  const parameterized = resolveParameters(chain, toneIntent);
  const snapshots = buildSnapshots(parameterized, toneIntent.snapshots);

  // Step 3: Build PresetSpec
  const presetSpec: PresetSpec = {
    name: /* derive from intent */,
    description: /* derive from intent */,
    tempo: toneIntent.tempoHint ?? 120,
    signalChain: parameterized,
    snapshots,
  };

  // Step 4: Build .hlx
  const hlxFile = buildHlxFile(presetSpec);

  return NextResponse.json({
    preset: hlxFile,
    summary: summarizePreset(presetSpec),
    spec: presetSpec,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `output_format` + beta header | `output_config.format` (no beta header) | Early 2026 GA release | Beta header still works for transition but is unnecessary; use `output_config` |
| Raw JSON Schema in `output_config` | `zodOutputFormat()` SDK helper | Part of SDK 0.78.0 | Handles constraint stripping, `additionalProperties` injection, format compatibility |
| `zod-to-json-schema` package | `z.toJSONSchema()` built into Zod v4 | Zod v4 release (2025) | Third-party package deprecated; native method is the standard |
| Multi-provider generation | Single provider (Claude Sonnet 4.6) | Project decision | Higher quality, simpler code, lower maintenance |
| AI generates full PresetSpec | AI generates ToneIntent only | Project architecture decision | Expert Knowledge Layer produces better parameters than AI guessing |

**Deprecated/outdated:**
- `output_format` parameter: Still works but `output_config.format` is the GA API shape
- `anthropic-beta: structured-outputs-2025-11-13` header: No longer required
- `zod-to-json-schema` package: Deprecated in favor of Zod v4 native `z.toJSONSchema()`
- `getPresetGenerationPrompt()` in `gemini.ts`: Will be replaced by Planner prompt in `planner.ts`

## JSON Schema Limitations (Claude Structured Outputs)

These limitations affect ToneIntentSchema design:

**Supported:**
- All basic types: object, array, string, integer, number, boolean, null
- `enum` (strings, numbers, bools, or nulls only)
- `const`, `anyOf`, `allOf`
- `required` and `additionalProperties: false`
- `$ref` and `$def`
- Array `minItems` (only values 0 and 1)
- String formats: date-time, date, email, uri, uuid

**NOT supported (will cause 400 error if sent raw):**
- Numerical constraints: `minimum`, `maximum`, `multipleOf`
- String constraints: `minLength`, `maxLength`
- Array constraints: `minItems` > 1, `maxItems`
- `additionalProperties` set to anything other than `false`
- Recursive schemas

**How `zodOutputFormat()` handles this:** The SDK helper automatically strips unsupported constraints from the schema sent to Claude and adds them to field `description` strings instead. After Claude responds, the SDK validates the response against the ORIGINAL Zod schema (with all constraints). This means the constraints are still enforced, just not at the token level.

## Existing Code Integration Map

| File | Current State | Phase 3 Action | Details |
|------|--------------|----------------|---------|
| `src/lib/helix/tone-intent.ts` | `z.string()` for ampName/cabName | **MODIFY**: Change to `z.enum()` with model name arrays | Single source of truth for types + Claude schema |
| `src/lib/helix/models.ts` | Has `getModelListForPrompt()` | **ADD**: Export model name arrays (AMP_NAMES, CAB_NAMES, EFFECT_NAMES) | Used by `z.enum()` in tone-intent.ts |
| `src/lib/helix/index.ts` | Exports Phase 1+2 modules | **ADD**: Export new model name arrays | Barrel file update |
| `src/lib/providers.ts` | Multi-provider abstraction | **SIMPLIFY or REMOVE**: Replace with single Claude call in planner.ts | No more Gemini/OpenAI for generation |
| `src/lib/gemini.ts` | Chat prompt + generation prompt | **MODIFY**: Remove `getPresetGenerationPrompt()` only; keep all chat functions | Chat endpoint must not break |
| `src/app/api/generate/route.ts` | Multi-provider parallel generation | **REFACTOR**: Single Planner -> Knowledge Layer pipeline | Core phase deliverable |
| `src/app/api/chat/route.ts` | Gemini streaming chat | **UNCHANGED** | AI-04 requirement |
| `src/lib/helix/chain-rules.ts` | assembleSignalChain() | **UNCHANGED** | Already takes ToneIntent |
| `src/lib/helix/param-engine.ts` | resolveParameters() | **UNCHANGED** | Already takes chain + ToneIntent |
| `src/lib/helix/snapshot-engine.ts` | buildSnapshots() | **UNCHANGED** | Already takes chain + SnapshotIntent[] |

## Open Questions

1. **Preset naming from ToneIntent**
   - What we know: ToneIntent has genreHint, ampName, and guitarType but no explicit preset name field
   - What's unclear: Should the Planner prompt ask Claude to generate a preset name, or should it be derived deterministically from the intent fields?
   - Recommendation: Add an optional `presetName` field to ToneIntentSchema (z.string().max(32).optional()) and let Claude generate a creative name. If omitted, derive from ampName + genreHint. This adds minimal schema complexity and produces better names than algorithmic generation.

2. **Preset description from ToneIntent**
   - What we know: PresetSpec requires a `description` field
   - What's unclear: Same question as naming -- Claude-generated vs. deterministic
   - Recommendation: Add an optional `description` field to ToneIntentSchema for Claude to populate with a brief tone description. Fallback to a generated description from intent fields if omitted.

3. **Guitar notes (tips for the user)**
   - What we know: The current PresetSpec has an optional `guitarNotes` field with tips like "use bridge pickup, tone at 7"
   - What's unclear: Should this come from Claude (creative) or be dropped (simplification)?
   - Recommendation: Add optional `guitarNotes` field to ToneIntentSchema. Claude is good at this kind of contextual advice. Low risk, high user value.

## Sources

### Primary (HIGH confidence)
- [Anthropic Structured Outputs -- Official Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- GA on Sonnet 4.6; `output_config.format` API shape; `zodOutputFormat()` helper; JSON Schema limitations; constrained decoding mechanism
- [Zod v4 JSON Schema Docs](https://zod.dev/json-schema) -- `z.toJSONSchema()` function signature; enum handling; additionalProperties behavior; unrepresentable types
- [Zod v4 API Docs](https://zod.dev/api) -- `z.enum()`, `z.infer`, schema composition
- Existing codebase inspection: `tone-intent.ts`, `models.ts`, `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`, `providers.ts`, `gemini.ts`, `generate/route.ts`, `chat/route.ts` -- all read and analyzed directly

### Secondary (MEDIUM confidence)
- [Anthropic Structured Outputs -- TechBytes](https://techbytes.app/posts/claude-structured-outputs-json-schema-api/) -- Feature overview, Zod integration confirmation
- [Zod v4 Release Notes](https://zod.dev/v4) -- 14.71x faster than v3; native JSON Schema generation
- `.planning/research/ARCHITECTURE.md` -- Planner-Executor architecture pattern, data flow, component boundaries
- `.planning/research/STACK.md` -- AI provider comparison, schema validation architecture, Claude Sonnet 4.6 rationale

### Tertiary (LOW confidence)
- None -- all findings verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed; API shapes verified against official docs
- Architecture: HIGH -- pattern matches existing codebase; Knowledge Layer already built; pipeline is straightforward
- Pitfalls: HIGH -- JSON Schema limitations documented in official Anthropic docs; Zod constraint stripping verified
- Code examples: HIGH -- TypeScript examples from official Anthropic docs; Zod patterns from official docs

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (30 days -- stable APIs, GA features, no fast-moving changes expected)
