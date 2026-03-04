# Stack Research

**Domain:** HelixTones v4.0 — Preset Quality Leap + API Cost Optimization
**Researched:** 2026-03-04
**Confidence:** HIGH overall — AI pricing from official docs, Helix routing patterns from community + official manuals, param data from Tonevault's 250-preset analysis

---

## Scope

This file covers ONLY what is new or changed for v4.0. The validated existing stack is NOT
re-researched. The existing stack is:

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | ^5 |
| UI | Tailwind CSS | ^4 |
| AI (generation) | Claude Sonnet 4.6 via `@anthropic-ai/sdk` | ^0.78.0 |
| AI (chat) | Gemini 2.5 Flash via `@google/genai` | ^1.42.0 |
| Auth + DB + Storage | Supabase | `@supabase/supabase-js` ^2.98.0, `@supabase/ssr` ^0.9.0 |
| Hosting | Vercel (serverless) | — |
| Schema validation | Zod | ^4.3.6 |
| Image compression | browser-image-compression | ^2.0.2 |
| Testing | Vitest | ^4.0.18 |

v4.0 has two work tracks:

1. **Preset quality leap** — smarter effect combos, nuanced params, advanced routing
2. **API cost optimization** — token analysis, model split evaluation, prompt engineering

Neither track requires new npm packages. All changes are in TypeScript source files.

---

## The Single Most Important Finding

**No new npm packages are needed for v4.0.**

The entire v4.0 scope — richer param tables, community-derived parameter values, parallel routing topology support, and model cost optimization — is accomplished by modifying TypeScript files in `src/lib/helix/` and `src/lib/planner.ts`. The existing stack already has every tool required.

This is good news: zero new dependencies means zero integration risk, no bundle size increase, and no compatibility testing against Next.js 16 / Tailwind 4.

---

## Recommended Stack

### Core Technologies — No Changes

| Technology | Version | Purpose | v4.0 Impact |
|------------|---------|---------|-------------|
| Next.js | 16.1.6 (existing) | App framework | No changes |
| TypeScript | ^5 (existing) | Type safety | New types in `tone-intent.ts`, `types.ts` |
| `@anthropic-ai/sdk` | ^0.78.0 (existing) | Claude Sonnet 4.6 planner | Model ID stays `claude-sonnet-4-6`; monitor `usage` field |
| `@google/genai` | ^1.42.0 (existing) | Gemini 2.5 Flash chat | Stays as chat model — see model decision below |
| Zod | ^4.3.6 (existing) | ToneIntent schema validation | New optional fields for parallel routing |
| Supabase | existing | Auth + DB + Storage | No changes |

### Supporting Libraries — No New Additions

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@anthropic-ai/sdk` | ^0.78.0 (existing) | Access `response.usage` for token logging | Every planner call — log `input_tokens`, `output_tokens`, `cache_read_input_tokens` |

No new libraries. All work is internal TypeScript.

### Development Tools — No Changes

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest | Unit tests for `param-engine.ts`, `chain-rules.ts` | Extend existing `*.test.ts` files with new param table coverage |

---

## AI Model Decision (HIGH confidence, verified against official docs)

### Current Split

| Role | Current Model | Cost (input/output per 1M tokens) |
|------|-----------|---------------------------------|
| Chat (tone interview) | Gemini 2.5 Flash | $0.30 / $2.50 |
| Planner (preset generation) | Claude Sonnet 4.6 | $3.00 / $15.00 |

This split is already correct. The chat model is cheap (Gemini 2.5 Flash); the expensive model is used only once per preset generation.

### Model Upgrade Decision: Chat Model

The chat is already on Gemini 2.5 Flash. The alternative models are:

| Candidate | Cost | Tradeoff |
|-----------|------|----------|
| Gemini 2.5 Flash (current) | $0.30 / $2.50 | Guitar knowledge, Google Search grounding built-in — correct choice |
| Claude Haiku 4.5 | $1.00 / $5.00 | 3.3× more expensive for chat; no Google Search grounding |
| Gemini 2.5 Flash-Lite | $0.10 / $0.40 | 3× cheaper but 2.5 Flash is already within the free tier for current usage |

**Recommendation: Keep Gemini 2.5 Flash for chat.** The Google Search grounding feature is architecturally essential — it allows the chat to look up artist rigs in real-time ("What gear did Mark Knopfler use on Alchemy?"). Haiku 4.5 lacks this native grounding capability. No model change.

### Model Upgrade Decision: Planner Model

| Candidate | Cost | Verdict |
|-----------|------|---------|
| Claude Sonnet 4.6 (current) | $3.00 / $15.00 | Correct model for structured output with complex ToneIntent schema |
| Claude Haiku 4.5 | $1.00 / $5.00 | 3× cheaper input; supports structured output and extended thinking |
| Claude Opus 4.6 | $5.00 / $25.00 | Overkill for ToneIntent (~15 fields); no quality benefit over Sonnet 4.6 |

**Recommendation: Evaluate Haiku 4.5 for the planner via A/B quality test, but do NOT switch without validation.** The planner task is small-context and structured (select one amp name from a list, select 4 effects) — Haiku 4.5's capabilities may be sufficient. The savings are real ($3→$1 input, $15→$5 output). However, creative decisions (which amp matches a tone) are what determine preset quality — the core value proposition. This trade is not worth making unless quality is proven equivalent.

**Implementation note if testing Haiku 4.5 for planner:**
- Haiku 4.5 API ID: `claude-haiku-4-5-20251001` (or alias `claude-haiku-4-5`)
- Haiku 4.5 supports Zod structured output via `zodOutputFormat` — same SDK call
- Run 20+ preset generations side-by-side and evaluate: correct amp category, correct cab pairing, appropriate effect selection

### Prompt Caching — Already Implemented, Tune It

Prompt caching is live on the planner (`cache_control: { type: "ephemeral" }` on system prompt). Verify savings are hitting expected levels:

| Metric | How to Check | Expected |
|--------|-------------|---------|
| Cache hit rate | `response.usage.cache_read_input_tokens > 0` | Should be >80% of calls |
| Input token baseline | `response.usage.input_tokens` | System prompt is ~800 tokens |
| Cache read savings | `response.usage.cache_read_input_tokens × 0.10` cost vs. full input | ~90% savings on cached tokens |

The system prompt (`buildPlannerPrompt`) includes a ~3,000-token model list. This list changes only when `getModelListForPrompt()` arguments change (i.e., per device type). Cache hit rate should be very high because the model list is stable across generations for the same device.

Source: [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official)

---

## Preset Quality Leap — Implementation Approach (HIGH confidence)

### What Community Research Found

The Tonevault analysis of 250 top CustomTone presets found specific patterns that the current param tables do not fully capture. These are pure TypeScript changes to `param-engine.ts` — no new libraries.

**Finding 1: Amp-specific Master Volume strategy**

The current `AMP_DEFAULTS` table uses a single Master value per amp category. Top community presets differentiate by amp lineage:

| Amp Style | Community Pattern | Current HelixTones Behavior |
|-----------|-------------------|----------------------------|
| Fender/AC30 (clean) | Master at 0.90–1.0, Channel Volume as level control | Master: 0.95 — correct |
| Marshall JCM800 (crunch) | Master at 0.30–0.60, Presence cut to 0.20–0.40 | Master: 0.60, Presence: 0.45 — marginal |
| 5150/Mesa (high gain) | Master at 0.40–0.55, Drive at 0.30–0.53 (low — amp is tight) | Master: 0.45, Drive: 0.40 — reasonable |
| Plexi-style | Master at 1.0, Drive at 0.60–0.75, Bass high (0.70+), Presence CUT | Not modeled separately |

**Implementation:** Add per-amp-model parameter overrides on top of the existing per-category defaults. The `findModel()` function already looks up the model — add a `modelSpecificOverrides` lookup table keyed by `ampName`.

Source: [Tonevault 250-preset analysis](https://www.tonevault.io/blog/250-helix-amps-analyzed) — HIGH confidence (data-driven, primary source)

**Finding 2: Scream 808 usage pattern is about level boost, not gain**

The existing `SCREAM_808_PARAMS` has `Drive: 0.15, Level: 0.60`. The Tonevault data confirms: in 71% of high-gain presets, the 808 Drive is very low (0.10–0.20) and Level is the primary control. Current values are correct. No change needed.

**Finding 3: Cab-amp affinity patterns**

The `models.ts` `HelixModel` interface already has `cabAffinity?: string[]`. The community data confirms specific pairings:

| Amp | Primary Cab | Secondary Cab |
|-----|------------|---------------|
| PV Panama (5150) | 4x12 Uber V30 (47% of presets) | 4x12 Cali V30 |
| Jazz Rivet 120 (JC-120) | 2x12 Jazz Rivet (59%) | 1x12 Celest 12-65 |
| Cali Rectifire (Dual Rectifier) | 4x12 Cali V30 (53%) | 4x12 Uber V30 |
| Brit 2204 (JCM800) | 4x12 Greenback 25 | 4x12 Uber V30 |

**Implementation:** Populate `cabAffinity[]` on high-use amp models in `models.ts`. The planner already uses cab selection — this teaches it correct pairings.

**Finding 4: Drive/Presence correlation patterns**

For Rectifier-style amps: as Drive increases, Presence should decrease (correlation r=−0.64 per Tonevault data). This prevents fizz. The current param engine sets Drive and Presence independently.

**Implementation:** Add a `correlatedParams` object to the amp model spec, or handle in the param engine's `resolveAmpParameters()` function with conditional adjustments.

Source: Tonevault blog — HIGH confidence

### Advanced Signal Routing (Parallel Paths)

**Current state:** HelixTones generates series-only presets (all blocks in series on dsp0 + dsp1). The `chain-rules.ts` "dual-amp" mode uses dsp0 and dsp1 but both are still in the primary serial path.

**What top presets do differently:** True parallel routing for wet/dry separation. Community pattern: dry signal (amp + core effects) on Path A, 100% wet reverb/delay on Path B, merged at the end.

The benefit is audible: the dry transient stays clean through the mix while reverb/delay swells sit in a separate bucket with their Mix at 100% (so no doubled dry signal).

**Implementation approach for v4.0:**

1. Add `parallelRouting?: "wet_dry" | "series"` to `ToneIntent` (optional field, defaults to "series")
2. In `chain-rules.ts`, when `parallelRouting === "wet_dry"`: insert a Split block on dsp0 after cab, route delay/reverb blocks to dsp1 with their Mix at 1.0, close with a Merge/Mixer block
3. The planner prompt instructs Claude to request `"wet_dry"` only for ambient/worship presets or when user explicitly wants lush reverb/delay separation

**Device constraints:**
- Helix LT/Floor: supported — 2 DSP paths available
- Pod Go: NOT supported — single DSP, series-only
- Helix Stadium: supported — 4 paths available
- HX Stomp/StompXL: supported BUT tight block budget (6 blocks total, Split + Merge consume 2)

No new npm packages. This is purely TypeScript chain-rules logic.

Source: [Line 6 Helix Signal Path Routing manual](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — HIGH confidence (official); Sweetwater WDW guide — MEDIUM confidence

### Richer ToneIntent Prompting

**Current planner prompt scope:** ~800 tokens of guidance, model list, device rules. Claude selects ~15 fields.

**What to add for v4.0:**
- Guitar-specific amp guidance: single-coil guitars benefit from slightly lower Presence on Marshall-style amps (prevents ice-pick highs); humbuckers can run Treble higher
- Amp category tone shaping: Plexi-style amps want Master maxed + bass high; Rectifier-style want Drive modest + Scream 808 boosting
- Parallel routing trigger: instruct Claude to set `parallelRouting: "wet_dry"` when building ambient, worship, or post-rock presets

These additions go into `buildPlannerPrompt()` in `src/lib/planner.ts`. Token cost is negligible (adds ~200 tokens to system prompt, which is cached).

---

## API Cost Audit — Implementation Approach

### Token Usage Logging

**Current state:** No token logging. The codebase does not capture `response.usage` from Claude API calls.

**What to add:** Log token usage after each Anthropic API call. The `response.usage` object from `@anthropic-ai/sdk` contains:

```typescript
// Available on every response from @anthropic-ai/sdk ^0.78.0
response.usage = {
  input_tokens: number,          // uncached input tokens
  output_tokens: number,         // generated tokens
  cache_creation_input_tokens: number,  // tokens written to cache (first call)
  cache_read_input_tokens: number,      // tokens served from cache (subsequent calls)
}
```

**Where to log:** After `client.messages.create()` in `src/lib/planner.ts`. Use `console.log` in a structured format for Vercel log aggregation. No external observability tool needed at this traffic level.

```typescript
// Minimal viable cost logging — zero new dependencies
console.log(JSON.stringify({
  event: "planner_call",
  model: "claude-sonnet-4-6",
  device,
  input_tokens: response.usage.input_tokens,
  output_tokens: response.usage.output_tokens,
  cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
  cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
  estimated_cost_usd: (
    (response.usage.input_tokens * 3.00 / 1_000_000) +
    (response.usage.output_tokens * 15.00 / 1_000_000) +
    ((response.usage.cache_read_input_tokens ?? 0) * 0.30 / 1_000_000)
  ).toFixed(6),
}));
```

Vercel log streaming makes these accessible in the Vercel dashboard without a third-party APM tool. This is appropriate for current traffic volume. If traffic grows to thousands of daily presets, adding Langfuse (open-source, self-hostable) becomes worthwhile.

Source: [Anthropic SDK usage documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official)

### Gemini Chat Token Logging

The Gemini `@google/genai` streaming chat API exposes usage metadata differently. For the streaming path in `src/app/api/chat/route.ts`, access usage from the final chunk:

```typescript
// After stream completes, the usageMetadata is on the last chunk
// @google/genai SDK exposes it on the resolved stream result
const result = await stream;
console.log(JSON.stringify({
  event: "chat_call",
  model: modelId,
  prompt_token_count: result.usageMetadata?.promptTokenCount ?? 0,
  candidates_token_count: result.usageMetadata?.candidatesTokenCount ?? 0,
}));
```

This is informational only — Gemini 2.5 Flash is cheap enough ($0.30/M input) that chat cost is not a meaningful optimization target compared to the Sonnet 4.6 generation cost.

### Model List Token Audit

The `getModelListForPrompt()` function generates a string injected into the planner system prompt. Check how large this string is:

```typescript
// Add to planner.ts for one-time audit:
const modelList = getModelListForPrompt(device);
console.log("Model list token estimate:", Math.round(modelList.length / 4), "tokens");
```

If the model list exceeds 2,000 tokens, consider filtering it more aggressively (e.g., include only amps with `ampCategory` matching the apparent genre, not the entire catalog). This reduces cache write cost on first call and shrinks the uncached prompt on cache miss.

---

## Installation

```bash
# No new packages needed for v4.0
# All changes are TypeScript source modifications
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Keep Claude Sonnet 4.6 for planner | Switch to Claude Haiku 4.5 | Only after A/B quality validation over 20+ presets proves equivalent creative output |
| Keep Gemini 2.5 Flash for chat | Switch to Claude Haiku 4.5 for chat | Never — Haiku lacks Google Search grounding, which is required for artist rig research |
| console.log token logging | Langfuse or LangSmith | When daily preset volume exceeds ~500 — full observability platforms become worth the setup cost |
| Per-amp model overrides in param-engine | Let AI set Drive/Presence values directly | Not viable — the whole architecture is deterministic Knowledge Layer; AI setting numbers removes reproducibility |
| Parallel routing as new ToneIntent field | Parallel routing as chain-rule heuristic (auto-detect from effects) | Heuristic approach is fragile (what if reverb is always-on but user wants series?); explicit intent field is cleaner |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Langfuse / LangSmith / Datadog at this stage | Overhead exceeds value at current traffic; adds external dependency and data egress | Structured `console.log` to Vercel logs — zero cost, already available |
| Claude Haiku 4.5 for chat (instead of Gemini 2.5 Flash) | Haiku lacks native Google Search grounding; artist rig research would require separate search API integration; more expensive and worse outcome | Gemini 2.5 Flash with `tools: [{ googleSearch: {} }]` |
| Claude Opus 4.6 for planner | $5/$25 per MTok — 1.67× more expensive than Sonnet 4.6 with no quality benefit for a 15-field structured output task | Claude Sonnet 4.6 |
| Vercel AI SDK (`ai` package) | Adds an abstraction layer over the Anthropic and Google SDKs that are already used directly; no benefit for a non-streaming planner call | Direct `@anthropic-ai/sdk` and `@google/genai` calls |
| Numeric parameters in ToneIntent | The Planner-Executor architecture relies on AI NOT setting numbers; adding numeric fields breaks determinism and reproducibility | Knowledge Layer param tables in `param-engine.ts` |
| Auto-caching (Anthropic API Feb 2026) | Auto-caching is enabled by default for new workspaces but may cache at different boundaries than the manual `cache_control: ephemeral` markers already placed | Keep explicit `cache_control` markers on system prompt blocks |

---

## Stack Patterns by Variant

**If Haiku 4.5 planner A/B test proves quality equivalent:**
- Change `model: "claude-sonnet-4-6"` → `model: "claude-haiku-4-5-20251001"` in `planner.ts`
- `max_tokens: 4096` stays unchanged — output is identical schema
- Expect 3× lower cost per generation call
- Re-validate prompt caching: cache write tokens cost 1.25× base, cache reads 0.10× — still worthwhile

**If parallel routing causes DSP budget issues on Stomp/StompXL:**
- Disable `parallelRouting: "wet_dry"` for `isStomp(device)` devices in chain-rules.ts
- Stomp has 6 total blocks — Split + Merge + Amp + Cab + 1 effect leaves no room for the second path's effects
- Instead, set delay/reverb Mix to 0.30 (wet enough without full separation)

**If model list token count exceeds 2,000 tokens:**
- Filter `getModelListForPrompt()` by predicted genre category before planner call
- Requires inferring genre from conversation in the generate route — low-confidence genre matching from keywords
- Only implement if audit confirms the model list is meaningfully large (likely 2,500–4,000 tokens for all devices)

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@anthropic-ai/sdk` ^0.78.0 | `claude-sonnet-4-6`, `claude-haiku-4-5` | `zodOutputFormat` works on both models; `response.usage` present on both |
| `@anthropic-ai/sdk` ^0.78.0 | Zod ^4.3.6 | `zodOutputFormat` helper compatible with Zod 4 |
| `@google/genai` ^1.42.0 | `gemini-2.5-flash` | Streaming API + `tools: [{ googleSearch: {} }]` — no changes needed |
| Next.js 16.1.6 | Vercel serverless | Token logging via console.log goes to Vercel log drain — compatible |

---

## Sources

- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Model IDs, pricing, capabilities — HIGH confidence (official)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — $3/$15 Sonnet 4.6, $1/$5 Haiku 4.5 — HIGH confidence (official)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — Cache token metrics, `response.usage` fields — HIGH confidence (official)
- [Anthropic Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `zodOutputFormat`, schema caching, beta header — HIGH confidence (official)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Flash $0.30/$2.50 per MTok — HIGH confidence (official)
- [Tonevault — Dialing in your Helix amps: what the top 250 presets teach us](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Amp parameter ranges by model, correlation data, cab pairings — HIGH confidence (data-driven community analysis, primary source)
- [Line 6 Signal Path Routing Manual](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — Parallel path architecture, Split/Merge blocks — HIGH confidence (official)
- [Sweetwater — Multiband Processing with Helix](https://www.sweetwater.com/insync/multiband-processing-technique-effects/) — Wet/dry path techniques — MEDIUM confidence (editorial)
- [Anthropic Claude Haiku 4.5 Introduction](https://www.anthropic.com/news/claude-haiku-4-5) — Capabilities, structured output support — HIGH confidence (official)

---

*Stack research for: HelixTones v4.0 — Preset Quality Leap + API Cost Optimization*
*Researched: 2026-03-04*
