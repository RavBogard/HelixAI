# Stack Research

**Domain:** AI-powered Helix preset generation — v1.1 feature additions
**Researched:** 2026-03-02
**Confidence:** HIGH

---

## Scope: v1.1 Only

This document covers stack additions and changes needed for the six new v1.1 features only. The validated v1.0 stack (Next.js 16, TypeScript 5, Tailwind CSS 4, Claude Sonnet 4.6 with `zodOutputFormat`, `@anthropic-ai/sdk` 0.78.0, Zod 4.3.6, vitest, Gemini for chat) is NOT re-researched here — it stands unchanged.

**New features requiring stack investigation:**
1. Prompt caching for API cost reduction
2. Genre-aware effect parameter defaults
3. Smarter snapshot effect toggling
4. .hlx format audit
5. Signal chain visualization in UI
6. Tone description card

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@anthropic-ai/sdk` | 0.78.0 (current, no upgrade needed) | Prompt caching via top-level `cache_control` field | v0.78.0 is the version that ADDED automatic top-level `cache_control` (released 2026-02-19). No upgrade needed — it is already installed at this exact version |
| `@xyflow/react` | 12.10.1 | Signal chain visualization — interactive node/edge flow diagram | The renamed successor to `reactflow`; v12 adds SSR support, TypeScript-first, Tailwind-compatible custom nodes. Linear signal chain maps directly to input→block→output node graph. No alternative comes close for this shape of problem |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@xyflow/react` | `^12.10.1` | Signal chain visualization component | Only for the new `SignalChainView` UI component. Do NOT use for anything outside the visualization panel |

### Development Tools

No new development tools needed. vitest, ESLint 9.x, and TypeScript strict mode cover all new code.

---

## Feature-by-Feature Stack Analysis

### 1. Prompt Caching

**What's needed:** A change to how `callClaudePlanner()` calls the Claude API in `src/lib/planner.ts`.

**Mechanism:** Add `cache_control: { type: "ephemeral" }` at the top level of the `client.messages.create()` call. This is the "automatic caching" mode added in `@anthropic-ai/sdk` 0.78.0. The SDK automatically marks the last cacheable block in the conversation, and subsequent requests with the same prefix read from cache at 10% of the normal input token cost.

**Why automatic caching over explicit cache breakpoints:**
- The Planner system prompt (`buildPlannerPrompt()`) is the large static block — it contains the full model list (~3K-5K tokens) plus instructions.
- The conversation history changes on every call (different users, different messages).
- Automatic caching handles this split correctly: it caches system prompt + early conversation turns and moves the breakpoint forward as conversations grow.
- Explicit breakpoints would require manually placing `cache_control` inside the system content array, which is more fragile and provides no additional benefit here.

**Minimum token threshold for Claude Sonnet 4.6:**
The official Anthropic docs specify **2048 tokens** as the minimum cacheable prompt length for Claude Sonnet 4.6 (source: official prompt caching docs, verified 2026-03-02). The Planner system prompt alone is ~3K-5K tokens (it contains the full model list from `getModelListForPrompt()`), so the minimum is easily met on every call.

**Cost impact:** Cache write tokens cost 1.25x base input price. Cache read tokens cost 0.10x base input price. After the first generation (cache miss), every subsequent generation within 5 minutes that shares the same system prompt pays 10% for those tokens. For a system prompt that is ~4K tokens at $3/MTok input price, each cache hit saves approximately $0.0011 per call. With tens of calls per session this compounds meaningfully.

**SDK usage (TypeScript):**
```typescript
// In src/lib/planner.ts — callClaudePlanner()
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  cache_control: { type: "ephemeral" },   // <-- add this line only
  system: systemPrompt,
  messages: [{ role: "user", content: conversationText }],
  output_config: {
    format: zodOutputFormat(ToneIntentSchema),
  },
});
```

**No SDK upgrade needed.** `@anthropic-ai/sdk` 0.78.0 introduced `cache_control` at the top level. The TypeScript types for this field are included in 0.78.0.

**No beta header needed.** Prompt caching is now a core feature, not a beta. The old `anthropic-beta: prompt-caching-2024-07-31` header is no longer required.

**Cache monitoring:** The response `usage` object returns `cache_creation_input_tokens` and `cache_read_input_tokens` fields. Log these in development to verify caching is working. No additional tooling needed.

---

### 2. Genre-Aware Effect Parameter Defaults

**What's needed:** Additions to the Knowledge Layer only — pure TypeScript data and logic changes. No new packages.

**Affected files:**
- `src/lib/helix/param-engine.ts` — Add genre-aware lookup tables for delay times, reverb mix, modulation rates
- `src/lib/helix/tone-intent.ts` — `genreHint` is already optional string on ToneIntent; no schema change needed

**Implementation pattern:** Extend the existing `AMP_DEFAULTS` / category lookup table pattern in `param-engine.ts` with a new `GENRE_EFFECT_PARAMS` table keyed by genre prefix. The `resolveParameters()` function already receives `ToneIntent`, so `intent.genreHint` is available to conditionally override defaults.

**Example shape:**
```typescript
// In param-engine.ts
const GENRE_DELAY_PARAMS: Record<string, Partial<Record<string, number>>> = {
  country:    { Time: 375, Feedback: 0.30, Mix: 0.22 },  // dotted-eighth slap
  blues:      { Time: 420, Feedback: 0.25, Mix: 0.20 },  // trailing repeats
  metal:      { Time: 0,   Feedback: 0.0,  Mix: 0.0  },  // off in rhythm
  ambient:    { Time: 800, Feedback: 0.55, Mix: 0.45 },  // wash
  // ...
};
```

No new library. This is data, not a dependency.

---

### 3. Smarter Snapshot Effect Toggling

**What's needed:** Logic changes to `src/lib/helix/snapshot-engine.ts` — pure TypeScript. No new packages.

**Current behavior:** `getBlockEnabled()` uses a fixed lookup table (reverb always ON, delay ON for lead/ambient, modulation ON for ambient only). The v1.1 goal is to make toggling sensitive to the effect's `role` field on the `EffectIntent` (`always_on`, `toggleable`, `ambient`).

**Implementation path:** The `buildSnapshots()` function receives the signal chain (`BlockSpec[]`) and `SnapshotIntent[]`. The `EffectIntent.role` from `ToneIntent` needs to be threaded into the snapshot engine so block-level decisions can use it. The cleanest approach: enrich each `BlockSpec` with the originating `EffectIntent.role` when `assembleSignalChain()` builds the chain in `chain-rules.ts`, making it available downstream without passing `ToneIntent` through multiple layers.

No new library. This is pure logic refactoring.

---

### 4. .hlx Format Audit

**What's needed:** Research and validation work against HX Edit's actual export format. No new runtime packages.

**Approach:** Collect real .hlx exports from HX Edit and diff them against HelixAI's outputs. This is a data audit + schema correction task.

**Optional dev tooling:** A simple Node.js comparison script in `scripts/` to diff two .hlx JSON files field-by-field. No package needed; `JSON.parse` + `fs.readFileSync` is sufficient.

No new production package. The fix is in `src/lib/helix/preset-builder.ts` and `src/lib/helix/types.ts`.

---

### 5. Signal Chain Visualization

**What's needed:** `@xyflow/react` 12.x for the flow diagram component.

**Why @xyflow/react over alternatives:**

| Option | Assessment |
|--------|------------|
| `@xyflow/react` v12 | PURPOSE-BUILT for this exact problem shape: directed graph with custom node types, edges between nodes, readonly display mode. TypeScript-first. SSR support. Tailwind-compatible custom nodes. Actively maintained (12.10.1 released ~10 days ago). MIT license |
| Custom SVG in JSX | Viable — this is a simple linear chain, not a complex graph. However, implementing edge routing, node layout, and responsive sizing from scratch takes 1-2 days. @xyflow/react does this in 20 lines |
| D3.js / visx | Low-level — overkill for a linear chain display. Would require building all abstractions that @xyflow provides |
| react-flow-chart (`@mrblenny/react-flow-chart`) | Unmaintained — last published 6 years ago. Reject |

**Decision: @xyflow/react.** The signal chain is literally a node graph (DSP0 blocks → DSP1 blocks with split/join). React Flow was built for this. For a read-only visualization of 8-15 blocks connected in series/parallel, this is ~50 lines of component code rather than ~200+ of custom SVG.

**Size consideration:** @xyflow/react adds to bundle size. Since the visualization is only shown after preset generation (not on initial page load), it should be lazy-loaded with `next/dynamic`:
```typescript
const SignalChainView = dynamic(
  () => import("@/components/SignalChainView"),
  { ssr: false, loading: () => <p>Loading visualization...</p> }
);
```
This keeps the initial page load unaffected.

**Usage pattern:** The existing `generatedPreset.spec.signalChain` (`BlockSpec[]`) from the generate API response is the data source. Map each `BlockSpec` to a React Flow node (custom styled card per block type). Edges connect sequential blocks. Split/join blocks trigger branching edges.

**TypeScript types for nodes:**
```typescript
import { Node, Edge } from "@xyflow/react";

type BlockNode = Node<{ block: BlockSpec }, "block">;
```

**Styling:** Use Tailwind CSS for custom node components. @xyflow/react renders custom nodes as standard React components — Tailwind classes work without any configuration changes.

---

### 6. Tone Description Card

**What's needed:** Pure React/TypeScript — no new library.

**Data source:** The existing `generatedPreset.summary` string (from `summarizePreset()` in `src/lib/helix/index.ts`) plus `generatedPreset.toneIntent` (already returned in the API response at `toneIntent` field).

**Implementation:** A new React component in `src/components/ToneDescriptionCard.tsx` that renders `toneIntent.description`, `toneIntent.guitarNotes`, amp/cab names, snapshot names, and effect list in a styled card. `ReactMarkdown` (already installed) can render the description field if it contains markdown.

No new package needed.

---

## Installation

```bash
# The only new production dependency for v1.1:
npm install @xyflow/react@^12.10.1

# No other new packages needed.
# @anthropic-ai/sdk is already at 0.78.0 (the version that added cache_control).
# All other v1.1 features are pure TypeScript changes to existing modules.
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `@xyflow/react` for signal chain visualization | Custom SVG in JSX | Viable for a simple linear chain, but @xyflow handles edge routing, zoom, and layout for free. At 50 lines vs 200+, @xyflow wins unless bundle size is a hard constraint |
| `@xyflow/react` for signal chain visualization | D3.js | D3 is imperatively-styled and not idiomatic in a React/Tailwind codebase. @xyflow is React-native and Tailwind-compatible |
| Automatic `cache_control` (top-level) | Explicit `cache_control` on system content array | Explicit is useful when you want to cache specific sections at different frequencies. Automatic is simpler and sufficient here — the entire system prompt is static, the conversation is dynamic. Automatic handles this split correctly without manual management |
| Genre hints as string in ToneIntent | New `genre` enum field on ToneIntent | String is already there (`genreHint: z.string().optional()`). Adding an enum would add schema complexity and require retraining Claude's understanding. Prefix-match on the string is sufficient for the lookup table approach |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `reactflow` (legacy package name) | Renamed to `@xyflow/react` at v12. The old package still exists but is not actively maintained at v12+ | `@xyflow/react` |
| `@mrblenny/react-flow-chart` | Last published 6 years ago, unmaintained | `@xyflow/react` |
| Anthropic beta header `prompt-caching-2024-07-31` | No longer required — prompt caching is now a core Claude API feature, not a beta | Just add `cache_control: { type: "ephemeral" }` to the request |
| `@ai-sdk/anthropic` (Vercel AI SDK wrapper) | Adds abstraction overhead; `@anthropic-ai/sdk` is already installed and directly supports `cache_control`. No reason to add a wrapper | Direct `@anthropic-ai/sdk` calls (already in use) |
| Upgrading `@anthropic-ai/sdk` to a newer version for prompt caching | 0.78.0 IS the version that added automatic `cache_control`. No upgrade needed | Stay at 0.78.0 |
| Audio processing libraries for signal chain visualization | The visualization shows the CONFIGURATION of DSP blocks, not actual audio signal data. No audio processing occurs | `@xyflow/react` for configuration graph display |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@xyflow/react@^12.10.1` | React 19.x | @xyflow/react v12 is tested with React 18 and 19. React 19.2.3 is installed — no conflict |
| `@xyflow/react@^12.10.1` | Next.js 16.x | Must be lazy-loaded with `next/dynamic({ ssr: false })` — React Flow uses browser APIs (DOM measurements) that are not SSR-safe |
| `@xyflow/react@^12.10.1` | Tailwind CSS 4.x | Custom node components use standard React + Tailwind classes. No PostCSS or config changes needed |
| `@anthropic-ai/sdk@0.78.0` | Current | `cache_control` top-level field TypeScript type is included in 0.78.0. No type augmentation needed |

---

## Stack Patterns by Variant

**For the signal chain visualization (read-only display):**
- Use `@xyflow/react` in `fitView` mode with `nodesDraggable: false` and `nodesConnectable: false` — prevents user interaction, pure display
- Lazy-load via `next/dynamic` to avoid SSR issues and keep initial page load fast
- Map `BlockSpec.type` to a color scheme via Tailwind class lookup (e.g., `amp` = amber, `delay` = blue, `reverb` = purple)

**For prompt caching:**
- Always add `cache_control` at request construction time, not conditionally. Even when the system prompt might be short, the overhead of the `cache_control` field itself is zero — if below the 2048-token minimum, caching is silently skipped by the API
- Log `response.usage.cache_read_input_tokens` in development to verify cache hits are occurring

**For genre-aware defaults:**
- Use `genreHint.toLowerCase()` before table lookup, and implement prefix matching (e.g., "modern metal" matches "metal" key) to avoid requiring exact strings from Claude
- Provide fallback defaults for all unrecognized genres — never throw on missing genre key

---

## Sources

- [Anthropic Prompt Caching Official Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control` API shape, minimum token thresholds (2048 for Sonnet 4.6), pricing table, automatic vs explicit caching modes (verified 2026-03-02, HIGH confidence)
- [@anthropic-ai/sdk npm changelog](https://github.com/anthropics/anthropic-sdk-typescript/blob/main/CHANGELOG.md) — v0.78.0 (2026-02-19) added top-level `cache_control` for automatic caching (HIGH confidence)
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) — Latest version 12.10.1, last published ~10 days ago, 407 dependents (MEDIUM confidence — npm registry data)
- [React Flow v12 Migration Guide](https://reactflow.dev/learn/troubleshooting/migrate-to-v12) — Package rename from `reactflow` to `@xyflow/react`, SSR support added, React 19 compatibility (HIGH confidence)
- [React Flow Quick Start](https://reactflow.dev/learn) — Installation, custom node API, `fitView` option (HIGH confidence)
- Anthropic prompt caching pricing table in official docs — Claude Sonnet 4.6 cache writes $3.75/MTok, cache reads $0.30/MTok (verified 2026-03-02, HIGH confidence)

---

*Stack research for: HelixAI v1.1 feature additions*
*Researched: 2026-03-02*
