# Stack Research

**Domain:** AI-powered Helix preset generation (.hlx file production)
**Researched:** 2026-03-01
**Overall Confidence:** HIGH

---

## Context Summary

The existing app already runs on Next.js 16, TypeScript 5, Tailwind CSS 4, and has SDKs for all three major AI providers installed (`@anthropic-ai/sdk` 0.78.0, `@google/genai` 1.42.0, `openai` 6.25.0). The rebuild task is narrowly scoped: select the single best AI provider, harden the JSON schema pipeline, and rebuild the preset engine logic. No framework changes are needed.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 (existing) | Full-stack framework, API routes | Already in use, no reason to change; App Router + serverless functions are the right primitives |
| TypeScript | 5.x (existing) | Type safety across preset builder and AI output pipeline | Strict mode already enabled; PresetSpec/HlxFile types are the backbone of correctness |
| Anthropic Claude (Sonnet 4.6) | API via `@anthropic-ai/sdk` 0.78.0 | Single AI provider for preset spec generation | See AI Provider Comparison below — wins on structured output precision and lowest hallucination rate |
| Zod | 4.3.6 (existing) | Schema definition and validation for PresetSpec | Already in codebase; Zod v4 is 14.71x faster than v3; generates JSON Schema for Claude's `output_config`; source of truth for types |
| Vercel | Free/Hobby tier | Deployment | Already in use; with streaming responses, 10-second function limit is not a blocker for generation |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | 0.78.0 (existing, current as of 2026-03-01) | Claude API client with TypeScript types, streaming, structured outputs | Use for all AI calls; supports `output_config.format.type: "json_schema"` natively |
| `zod` | 4.3.6 (existing, latest stable) | Define PresetSpec schema; generates JSON Schema for `output_config`; validates AI response at runtime | Use `z.toJSONSchema()` to derive the Claude output schema from the same Zod definition used for TypeScript types — single source of truth |
| `zod-to-json-schema` (optional) | — | Only needed if Zod v4's built-in `z.toJSONSchema()` output doesn't match Claude's exact schema dialect | Evaluate need at implementation time; Zod v4 now includes `z.fromJSONSchema()` and `z.toJSONSchema()` natively |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9.x (existing) | Code linting | No change needed |
| TypeScript strict mode (existing) | Catch type errors in preset builder | Already enabled; critical for PresetSpec correctness |
| Node.js 18+ (existing) | Runtime | No change needed |

---

## AI Provider Comparison

The question is: which single provider produces the most accurate, schema-compliant PresetSpec JSON for Helix preset generation?

### Evaluation Criteria for This Use Case

1. **Structured output reliability** — Does the model guarantee schema-compliant JSON, not just "usually" produce it?
2. **Hallucination rate on domain-specific parameters** — Will it invent fake model IDs like `HD2_AmpFakeModel` or get real ones right?
3. **Reasoning quality for complex specs** — Can it design a coherent signal chain (right block order, right EQ values, realistic gain staging) not just fill in fields?
4. **Vercel/serverless compatibility** — Does the API pattern work within Vercel's streaming constraints?
5. **Cost** — Sustainable on a free-tier Vercel app with per-request AI calls.

---

### Provider Deep Dive

#### Anthropic Claude (Sonnet 4.6)

**Structured Output Mechanism:** Constrained decoding via `output_config.format`. As of November 2025 (GA), the API compiles your Zod-derived JSON schema into a token grammar and constrains generation — the model literally cannot produce tokens that violate the schema. This is not prompt engineering; it is enforced at the inference level.

**API surface (TypeScript):**
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 8192,
  messages: [...],
  output_config: {
    format: {
      type: "json_schema",
      schema: zodToJsonSchema(PresetSpecSchema)
    }
  }
});
```

**Models supported for structured outputs:** Claude Opus 4.6, Claude Sonnet 4.6, Claude Sonnet 4.5, Claude Opus 4.5, Claude Haiku 4.5. Sonnet 4.6 is generally available on the Claude API and Amazon Bedrock. (Source: official Anthropic structured outputs docs, verified 2026-03-01.)

**Hallucination rate:** ~3% — the lowest of the three providers tested in 2026 comparisons. For domain-specific tasks where wrong values cause hardware failures (wrong model IDs break preset loading), this is the critical metric.

**Structured output quality for complex JSON:** Sonnet 4.6 ranks #1 globally in office productivity and large-scale tool-calling benchmarks. On SWE-bench Verified it scores 79.6% vs Opus 4.6's 80.8% — a 1.2% gap at one-fifth the cost. For a PresetSpec (a structured object with 20-40 fields, arrays of blocks, and nested snapshots), Sonnet 4.6 is the correct tier — not Haiku (insufficient reasoning depth) and not Opus (unnecessary and expensive).

**Vercel compatibility:** The Claude API is a standard HTTPS endpoint with streaming support. On Vercel's Hobby plan (10-second hard limit for non-streaming functions), generation must stream. Claude's SDK provides `client.messages.stream()` which works as a streaming response from a Next.js Route Handler.

**Cost:** $3/MTok input, $15/MTok output. A typical preset generation request uses ~2K input tokens and ~1K output tokens. Cost per generation: ~$0.021. Negligible for a free-tier app.

**Prompt caching advantage:** Claude supports prompt caching for system prompts. The Helix model database + generation system prompt is ~3K-5K tokens. With caching enabled, repeated generations cache the system prompt at $0.30/MTok reads (10x cheaper). This is directly applicable: the system prompt with full model IDs, parameter ranges, and signal chain rules is constant across all generations.

**Rating for this use case: STRONGLY RECOMMENDED**

---

#### OpenAI GPT-4o

**Structured Output Mechanism:** `response_format: { type: "json_schema", json_schema: { strict: true, schema: ... } }`. Claims 100% schema compliance on controlled benchmarks. In real-world community usage, intermittent failures with newer models (gpt-4.1, o4-mini) and `gpt-4o-mini` are reported. The `strict: true` flag is required for guarantees and not consistently supported across all current model snapshots.

**Hallucination rate:** ~6% — double Claude's rate. For a task where hallucinated model IDs (e.g., `HD2_AmpMarshallPlexiThatDoesNotExist`) break .hlx files on real hardware, this matters.

**Cost:** $2.50/MTok input, $10/MTok output — cheaper than Claude. However, the lower accuracy requires more aggressive validation and fallback logic, negating cost savings.

**Vercel compatibility:** Standard HTTPS, compatible.

**Key concern:** Community-reported intermittent structured output failures on GPT-4.1 and newer model snapshots. The model support matrix for `json_schema` structured outputs is inconsistent across the API version landscape as of early 2026. Requires testing on each new model snapshot.

**Rating for this use case: VIABLE FALLBACK, not primary choice**

---

#### Google Gemini (2.5 Pro)

**Structured Output Mechanism:** JSON Schema via `generationConfig.responseSchema`. Moved from OpenAPI 3.0 subset to full JSON Schema support (preview) in 2025. Complex schemas still produce `400 InvalidArgument` errors — Google advises shortening property names, flattening arrays, and reducing optional fields. The Helix PresetSpec has nested objects, union types, and arrays of blocks, which is exactly the schema shape that triggers Gemini's complexity limits.

**Current app context:** Gemini is already used for the chat/interview phase (`/api/chat`). This is the right use for it — Gemini 2.5 Pro's 2M context window and conversational quality are excellent for the interview. Google Search grounding (already integrated) adds real value for artist/rig research during the chat phase.

**Structured output for PresetSpec generation:** The Vercel AI SDK has an open GitHub issue specifically requesting full JSON Schema support for Gemini 2.5 structured outputs (as of 2026), indicating the integration is not yet as mature as OpenAI's or Claude's. Gemini's schema complexity limitations are a real risk for a PresetSpec with 8 snapshots, 15+ blocks, and nested parameter overrides.

**Cost:** $1.25-$2.50/MTok input — cheapest of the three.

**Rating for this use case: KEEP for chat interview phase only; DO NOT use for preset generation**

---

### Provider Recommendation Summary

| Criterion | Claude Sonnet 4.6 | GPT-4o | Gemini 2.5 Pro |
|-----------|:-----------------:|:------:|:--------------:|
| Schema guarantee mechanism | Constrained decoding (enforced) | Constrained decoding (enforced, strict: true) | Schema-guided generation (not full constrained decoding) |
| Hallucination rate | ~3% (lowest) | ~6% | ~6% |
| Complex nested JSON reliability | HIGH | MEDIUM (intermittent reports) | MEDIUM (schema complexity limits) |
| Prompt caching for large system prompts | YES (10x cheaper reads) | YES (but less favorable) | YES |
| Vercel streaming compatibility | YES | YES | YES |
| Cost per generation (~3K in, ~1K out) | ~$0.024 | ~$0.018 | ~$0.006 |
| Risk of schema complexity errors | LOW | LOW-MEDIUM | MEDIUM-HIGH |
| Recommended for PresetSpec generation | **YES** | Fallback | No |
| Recommended for chat interview | YES | No | **YES (already in use)** |

**Decision: Claude Sonnet 4.6 for preset generation. Gemini 2.5 Pro for chat interview (keep existing).**

Rationale: The primary failure mode of the current app is incorrect parameter values and hallucinated model IDs. Claude's lowest hallucination rate combined with constrained decoding (schema guaranteed at the token level) is the correct solution. The 40% higher cost vs GPT-4o is trivially small at this app's scale and is outweighed by the reliability advantage. Gemini keeps its role in the interview phase where it performs well and already works.

---

## Schema Validation Architecture

The rebuild should use a three-layer validation approach:

**Layer 1 — Schema enforcement at generation (Claude `output_config`):**
The Zod `PresetSpecSchema` is compiled to JSON Schema via `z.toJSONSchema()` and passed directly to Claude's `output_config.format.schema`. Claude cannot return a response that violates the schema structure. This eliminates JSON parse errors and missing required fields.

**Layer 2 — Business logic validation (existing `validateAndFixPresetSpec`):**
Schema compliance does not guarantee business correctness. After Claude returns a schema-valid PresetSpec, the existing validator handles: model ID existence checks against the Helix model database, block position normalization within each DSP, snapshot block reference resolution, and parameter range clamping. This layer is already implemented and should be retained and extended.

**Layer 3 — Domain knowledge defaults (models.ts database):**
The model database provides authoritative default parameters per amp/cab/effect model. AI-generated parameter values should be treated as overrides on top of database defaults, not freestanding values. This hybrid approach (template defaults + AI creative choices) is the correct architecture for world-class preset quality.

**Implementation note on Zod + Claude schema generation:**
```typescript
import { z } from "zod";
// Zod v4 built-in — no external package needed
const jsonSchema = z.toJSONSchema(PresetSpecSchema);
// Pass to Claude:
output_config: { format: { type: "json_schema", schema: jsonSchema } }
```
Zod v4's `z.toJSONSchema()` is the built-in method (verified current). The `additionalProperties: false` constraint should be set on all object nodes to prevent Claude from appending extraneous fields.

---

## Template Hybrid Approach

The current app generates presets from scratch via AI. The rebuild should use a template+AI hybrid:

**What templates provide (deterministic):**
- Signal chain topology (block ordering rules: dynamics before amp, modulation after amp, reverb last)
- Per-amp-category baseline parameters (clean/crunch/high-gain profiles from models.ts)
- Mandatory always-on blocks (noise gate, post-cab EQ)
- Cab selection logic (match cab to amp family)

**What AI provides (creative):**
- Amp model selection based on artist/genre research
- EQ sculpting values to match target tone
- Snapshot design (which blocks on/off per scene, volume balance)
- Effect choice and placement beyond mandatory blocks

This hybrid approach encodes the expert knowledge that professional Helix preset makers use, while letting the AI handle the creative matching. The AI should be told what building blocks exist and given the defaults — it should override defaults only where the target tone requires it.

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Multi-provider parallel generation for .hlx output | Architecture produces inconsistent results across providers; tone quality is not comparable across schemas; creates maintenance burden for three code paths | Single provider (Claude Sonnet 4.6) for generation |
| Gemini for PresetSpec generation | Schema complexity limits risk 400 errors on nested PresetSpec; existing schema violations reported in community | Claude Sonnet 4.6 for generation; keep Gemini for chat |
| Zod v3 | Exists in repo as a dependency but v4 is current default at `npm i zod`; v3 is 14.71x slower and has >25,000 TypeScript instantiations vs ~175 in v4 | Zod v4 (already installed at 4.3.6) |
| AJV as primary validator | Better raw performance, but TypeScript DX is worse (no native type inference); Zod v4 is fast enough for this use case (preset generation is not high-throughput) and provides the JSON Schema export needed for Claude's `output_config` | Zod v4 |
| Raw prompt engineering for JSON (no schema enforcement) | Current approach — fragile, requires defensive parsing, produces hallucinated IDs | Claude `output_config` with Zod-derived schema |
| Edge Functions for generation route | Strict first-byte timeout limits; generation requires reasoning time before first token; streaming helps but Edge adds fragility | Node.js serverless functions (existing `/api/generate` route) |
| `claude-opus-4-6` as default generation model | 5x more expensive than Sonnet 4.6 for 1.2% quality difference on structured tasks; output ceiling advantage (128K vs 64K) irrelevant for preset generation (output is ~1K tokens) | `claude-sonnet-4-6` as default; Opus as premium tier |
| `claude-haiku-4-5` for generation | Insufficient reasoning depth for complex signal chain design and EQ parameter judgment | `claude-sonnet-4-6` |
| Audio DSP libraries (Web Audio API, essentia.js, libfaust) | This app does NOT process audio — it generates configuration JSON describing a DSP device (the Helix). No audio signal processing happens server-side | None needed; this is a JSON generation problem, not an audio processing problem |
| LangChain or similar orchestration frameworks | Adds abstraction and dependency overhead for a simple two-phase workflow (chat + generation); direct SDK calls are cleaner and already implemented | Direct `@anthropic-ai/sdk` and `@google/genai` SDK calls |
| Outlines/XGrammar/Microsoft Guidance | Open-source constrained decoding frameworks for self-hosted models; not applicable when using hosted APIs with native structured output support | Claude `output_config` |

---

## Installation

No new packages are required for the core rebuild. All dependencies are already installed. The changes are architectural, not dependency-based.

```bash
# Current dependencies already cover all needs:
# @anthropic-ai/sdk@0.78.0  — Claude API with structured outputs support
# @google/genai@1.42.0      — Gemini for chat (keep)
# zod@4.3.6                 — Schema validation + JSON Schema generation for output_config
# openai@6.25.0             — Can be removed after single-provider migration

# To remove unused providers after migration:
npm uninstall openai
# Keep @google/genai for the chat interview phase
```

---

## Sources

- [Anthropic Structured Outputs — Official Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA on Opus 4.6, Sonnet 4.6, Haiku 4.5; `output_config.format.type: "json_schema"`; constrained decoding mechanism (verified 2026-03-01)
- [Structured Output Comparison across LLM Providers — Medium (Rost Glukhov)](https://medium.com/@rosgluk/structured-output-comparison-across-popular-llm-providers-openai-gemini-anthropic-mistral-and-1a5d42fa612a) — Hands-on comparison of OpenAI, Gemini, Claude, Mistral, Bedrock
- [Claude Sonnet 4.6 vs Opus 4.6 2026 Comparison — DataStudios](https://www.datastudios.org/post/claude-sonnet-4-6-vs-opus-4-6-2026-comparison-capability-split-output-ceilings-long-context-beha) — Benchmark data, output ceilings, cost analysis
- [Anthropic Launches Structured Outputs — TechBytes](https://techbytes.app/posts/claude-structured-outputs-json-schema-api/) — Feature announcement, Zod/Pydantic integration, zero JSON parse errors claim
- [OpenAI Structured Outputs — Official Docs](https://developers.openai.com/api/docs/guides/structured-outputs/) — `response_format json_schema strict: true`, model support matrix
- [Structured Outputs not reliable with GPT-4o — OpenAI Community](https://community.openai.com/t/structured-outputs-not-reliable-with-gpt-4o-mini-and-gpt-4o/918735) — Real-world reliability reports
- [Gemini JSON Schema support — Google AI for Developers](https://ai.google.dev/gemini-api/docs/structured-output) — Schema complexity warnings, 400 errors on complex schemas
- [Gemini 2.5 JSON Schema Vercel AI SDK issue — GitHub](https://github.com/vercel/ai/issues/6494) — Open issue as of 2026 for full JSON Schema support
- [Zod v4 npm](https://www.npmjs.com/package/zod) — Latest version 4.3.6; 86M weekly downloads; z.toJSONSchema() built-in
- [Zod v4 Release Notes](https://zod.dev/v4) — 14.71x faster than v3; native JSON Schema generation/consumption
- [Claude Sonnet 4.6 Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — $3/MTok input, $15/MTok output; 90% caching savings
- [Vercel Function Limits](https://vercel.com/docs/functions/limitations) — Hobby plan 10s default; streaming resolves timeout constraint
- [Line 6 Community — .hlx format discussion](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — Community documentation of hlx JSON structure
- [HelixBackupFiles — GitHub (AntonyCorbett)](https://github.com/AntonyCorbett/HelixBackupFiles) — hlx/hlb format reverse engineering reference
- [AI API Pricing Comparison 2026 — IntuitionLabs](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude) — Cross-provider pricing table
- [GPT-4o vs Claude vs Gemini Technical Comparison 2026 — CosmicJS](https://www.cosmicjs.com/blog/best-ai-for-developers-claude-vs-gpt-vs-gemini-technical-comparison-2026) — Developer-focused comparison
