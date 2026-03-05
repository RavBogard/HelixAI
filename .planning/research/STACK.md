# Stack Research

**Domain:** HelixTones v4.0 — Stadium Rebuild + Preset Quality Leap
**Researched:** 2026-03-05
**Confidence:** HIGH overall — AI model specs from official Anthropic docs, .hsp format from direct codebase inspection + community sources, quality findings from Tonevault 250-preset analysis

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

v4.0 has three tracks:

1. **Stadium rebuild** — reverse-engineer real .hsp presets and rebuild the builder from ground truth
2. **Preset quality leap** — gain-staging intelligence, per-model amp params, effect combinations
3. **Cost-aware model routing** — evidence-based Haiku evaluation, architecture review

---

## The Single Most Important Finding

**No new npm packages are needed for v4.0.**

All six work areas — Stadium .hsp format reverse-engineering, planner prompt enrichment,
per-model amp parameter tables, effect combination logic, cost-aware routing evaluation,
and architecture review — are accomplished by modifying TypeScript source files in
`src/lib/helix/` and `src/lib/planner.ts`.

The existing stack already has every tool required. Zero new dependencies means zero
integration risk and no compatibility testing against Next.js 16 / Tailwind 4.

---

## Recommended Stack

### Core Technologies — No Changes

| Technology | Version | Purpose | v4.0 Impact |
|------------|---------|---------|-------------|
| Next.js | 16.1.6 (existing) | App framework | No changes |
| TypeScript | ^5 (existing) | Type safety | New types in `tone-intent.ts`, `types.ts` for gain-staging fields |
| `@anthropic-ai/sdk` | ^0.78.0 (existing) | Claude Sonnet 4.6 planner | Model stays `claude-sonnet-4-6`; `zodOutputFormat` already works for structured output |
| `@google/genai` | ^1.42.0 (existing) | Gemini 2.5 Flash chat interview | No changes — correct model for the job |
| Zod | ^4.3.6 (existing) | ToneIntent schema validation | No new fields needed — gain-staging is a prompt+param change, not a schema change |
| Supabase | existing | Auth + DB + Storage | No changes |

### Supporting Libraries — No New Additions

| Library | Current Version | v4.0 Use |
|---------|----------------|---------|
| `@anthropic-ai/sdk` | ^0.78.0 | `response.usage` already logged in `usage-logger.ts`; `zodOutputFormat` in `helpers/zod` already used by planner |

No new libraries. All v4.0 work is internal TypeScript.

---

## Feature Area 1: Stadium .hsp Reverse Engineering

### Current State

The Stadium builder (`src/lib/helix/stadium-builder.ts`) was implemented in v3.0 and verified
against two real .hsp files (Cranked_2203.hsp and Rev_120_Purple_Recto.hsp). However, the
builder was temporarily blocked (Stadium selection returns 400) pending a broader verification
against more real presets.

### What Needs to Happen

Reverse-engineer 11 real .hsp preset files to verify:
1. The `flow` block format (slot-based with `params: { K: { access, value } }`)
2. The `sources` footswitch section (24 entries, hex-keyed)
3. Per-snapshot block bypass states (`@enabled.snapshots[]`)
4. Amp/cab `linkedblock` wiring
5. Stadium-specific amp parameter keys (do Agoura amps have `Presence`? `Sag`? `Bias`?)

### Implementation Approach

**No new tooling needed.** Real .hsp files are downloadable from:
- [Fluid Solo — Stadium presets](https://www.fluidsolo.com/) — active Stadium preset community
- [Noise Harmony free packs](https://www.noiseharmony.com/post/free-presets-for-line-6-helix-stadium-aura-reflections) — Aura + Reflections packs with free samples
- [Jason Sadites Stadium template 2026](https://www.sadites.com/line-6-presets-free)

Parse these with `JSON.parse()` (after stripping the 8-byte `rpshnosj` magic header). The
format is already confirmed as `magic_header + JSON.stringify({ meta, preset })`. Direct file
inspection in a text editor reveals the full parameter structure.

**Key discovery needed:** What parameter keys do Agoura amps expose? The existing
`STADIUM_AMPS` catalog uses `{ Drive, Bass, Mid, Treble, Master, ChVol }` for all models.
Real preset inspection will confirm whether Presence, Sag, Bias, BiasX are valid for Agoura
amps or if they use different keys.

### Firmware Target

Helix Stadium 1.2.1 (released January 20, 2026) is the current firmware. Community presets
downloaded in 2026 are on this firmware. The builder must produce .hsp files compatible with
firmware 1.2.x.

Source: [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105) — HIGH confidence (official)

---

## Feature Area 2: Planner Prompt Enrichment (Gain-Staging + Cab Pairing)

### What Changes

`buildPlannerPrompt()` in `src/lib/planner.ts` currently gives Claude creative selection
guidance (~800 tokens). The prompt is NOT changing its structure — only adding targeted
expert guidance sections.

### Gain-Staging Intelligence to Add

The existing prompt tells Claude what to pick but not how amp parameters interact. The new
section should encode:

**Amp gain staging rules (add to system prompt — cached):**

| Amp Style | Gain Staging Pattern | What This Means for Claude |
|-----------|---------------------|---------------------------|
| Fender/Vox clean | Master at max, ChVol as level control, Drive very low | When picking a clean amp, always_on boost is volume, not saturation |
| Marshall Plexi | Master at max, Drive at 0.65+, bass pushed, Presence cut | Plexi runs on the edge of breakup — boost adds sustain, not muddiness |
| JCM800 / Crunch | Master at 0.35–0.55, Drive moderate, 808 for tightness | Master is the saturation control; Drive sets texture |
| Rectifier / Mesa | Drive modest (0.35–0.50), 808 for tight punch, EQ cuts low-mid | Rectifiers saturate at front end; excessive Drive causes flub |
| High-gain modern | Drive 0.40–0.55, Noise Gate threshold higher, 808 for definition | Modern amps are already tight — 808 adds pick attack definition |

**Implementation:** Add a `## Gain Staging Guidance` section to `buildPlannerPrompt()`. This
is pure text — no new parameters. Token cost: ~200 tokens, which falls within the cached
system prompt and incurs only cache-write cost on first call.

### Cab Pairing Intelligence to Add

The existing `HelixModel.cabAffinity[]` already stores correct pairings. The prompt addition
tells Claude why to follow affinity:

```
## Cab Pairing Rules
- Match cab era to amp era: Fender-voiced amps → open-back 1x12 or 2x10/2x12 cabs
- Marshall/British amps → closed-back 4x12 with Greenback 25 or T75 speakers
- Mesa/American high-gain → 4x12 Uber V30 or Cali V30 (tight, focused midrange)
- Vox → Blue Bell or equivalent alnico speaker cab (bright, chimey)
- Single-coil guitars: prefer smaller cab configurations (1x12, 2x12) — less low-end buildup
- Humbuckers: closed-back 4x12 handles the extra low-mid content
```

This section is approximately 100 tokens and supplements the amp-specific `cabAffinity[]`
lookups already in the Knowledge Layer.

---

## Feature Area 3: Per-Model Amp Parameter Tables

### Current State

`param-engine.ts` has three category-level tables (`AMP_DEFAULTS` for `clean`/`crunch`/`high_gain`)
applied uniformly across all amps in a category. This is correct but coarse.

### What Needs to Happen

Add per-amp-model parameter overrides on top of category defaults. The `resolveParameters()`
function already resolves the specific model — it just needs a lookup step.

### Implementation Pattern (No New Libraries)

```typescript
// New table in param-engine.ts — keys match AMP_MODELS record keys
const AMP_MODEL_OVERRIDES: Partial<Record<string, Partial<Record<string, number>>>> = {
  // Plexi style: max Master, pushed bass, cut Presence to avoid ice-pick
  "Brit Plexi Jump": { Master: 1.0, Bass: 0.70, Presence: 0.20, Drive: 0.65 },
  "Brit Super": { Master: 1.0, Bass: 0.65, Presence: 0.25, Drive: 0.60 },

  // Rectifier: modest Drive, low Presence (fizz control)
  "Cali Rectifire": { Drive: 0.40, Presence: 0.30, Bass: 0.35 },
  "Cali Texas Ch2": { Drive: 0.42, Presence: 0.32, Bass: 0.38 },

  // JC-120: solid state, no Sag/Bias — different param set
  "Jazz Rivet 120": { Drive: 0.25, Master: 0.70, Bass: 0.50, Presence: 0.55 },

  // 5150-style: tight low end, moderate Drive
  "PV Panama": { Drive: 0.45, Bass: 0.25, Mid: 0.55, Presence: 0.45 },

  // Stadium Agoura amps — same pattern, Agoura prefix
  "Agoura Brit Plexi": { Master: 1.0, Bass: 0.68, Presence: 0.20 },
  "Agoura Tread Plate Red": { Drive: 0.45, Bass: 0.35, Presence: 0.25 },
};
```

This table is applied **after** the category defaults in `resolveAmpParameters()`, overriding
specific keys where needed. The override only touches documented problem areas — all other
parameters retain category defaults.

### Drive/Presence Anti-Correlation

For Rectifier-style amps, top community presets show a strong negative correlation: as Drive
goes up, Presence should go down (Tonevault data: r=−0.64). Implementation:

```typescript
// In resolveAmpParameters(), after applying model overrides:
if (model.ampCategory === "high_gain" && model.topology === "plate_fed") {
  const drive = params.Drive ?? AMP_DEFAULTS.high_gain.Drive;
  // Scale Presence down proportionally for Rectifier-style amps
  // Only apply if the model name contains "Recti" or "Plate" style keywords
  if (isRectifierStyle(model.id)) {
    params.Presence = Math.max(0.20, 0.55 - (drive - 0.35) * 0.8);
  }
}
```

Source: Tonevault 250-preset analysis — HIGH confidence (data-driven primary source)

---

## Feature Area 4: Effect Combination Logic

### Current State

`param-engine.ts` resolves effect parameters independently — each effect gets genre-aware
defaults from the category tables. There is no cross-effect coordination.

### What Needs to Happen

Add interaction-aware parameter adjustments for common effect combinations:

**Interaction rules (pure TypeScript in `param-engine.ts`):**

| Combination | Interaction | Why |
|-------------|-------------|-----|
| Reverb + Delay (both on) | Reduce Reverb Mix by 0.05, Delay Mix by 0.05 | Combined wet signal overwhelms dry; each competes less |
| OD/Dist + Compressor pre-amp | Compressor Ratio up slightly, Threshold lower | Compressor pre-drive adds sustain without squashing attack |
| Chorus + Delay | Delay Feedback down 0.05 | Chorus modulation on delay repeats causes pitch drift pile-up |
| Octave/Pitch + Reverb | Reverb pre-delay higher | Pitch shifting + early reflections creates mud on low notes |

**Guitar-type EQ adjustments (cross-block, affects post-cab EQ):**

| Guitar Type | EQ Tweak | Why |
|-------------|----------|-----|
| single_coil | HighGain +0.03 (more presence) | Singles can be thin through closed cabs |
| humbucker | LowGain -0.02 (tighter low end) | Humbuckers add thickness that can cloud the mix |
| p90 | No change (P90 = mid, applies both) | P90 sits between; category defaults are already optimal |

These are small numeric adjustments in the Knowledge Layer — not AI-generated values.

### Implementation

Add a `resolveEffectInteractions()` function in `param-engine.ts` called after individual
effect parameters are set. It takes the full `BlockSpec[]` and `ToneIntent.guitarType` and
returns adjusted parameters for blocks that need cross-effect coordination.

No new data structures or libraries. Pure TypeScript.

---

## Feature Area 5: Cost-Aware Model Routing

### Verified Model Costs (HIGH confidence — official Anthropic docs)

| Model | API ID | Input per MTok | Output per MTok | Context |
|-------|--------|---------------|-----------------|---------|
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3.00 | $15.00 | 200K |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | $1.00 | $5.00 | 200K |
| Claude Opus 4.6 | `claude-opus-4-6` | $5.00 | $25.00 | 200K |

Source: [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — HIGH confidence (official, verified 2026-03-05)

**IMPORTANT MODEL STATUS:** Claude Haiku 3.5 (`claude-3-5-haiku-20241022`) has been retired
as of early 2026 — all requests return an error. Claude Haiku 3 (`claude-3-haiku-20240307`) is
deprecated and retires April 19, 2026. The current fast tier is Haiku 4.5 only.

### Current Routing

| Role | Model | Cost |
|------|-------|------|
| Chat (tone interview) | Gemini 2.5 Flash | $0.30 / $2.50 per MTok |
| Planner (preset generation) | Claude Sonnet 4.6 | $3.00 / $15.00 per MTok |

This split is already cost-correct: cheap model for chat, expensive model used only once per
preset generation. The question is whether Haiku 4.5 can replace Sonnet 4.6 for the planner.

### Chat Model Decision: KEEP Gemini 2.5 Flash

**Rationale:** The chat model uses `tools: [{ googleSearch: {} }]` for real-time artist rig
research. This Google Search grounding is architecturally essential — it lets the chat AI look
up real-world artist gear ("What amp did Mark Knopfler use on Alchemy?") without hallucinating.

Claude Haiku 4.5 does NOT support Google Search grounding natively. Moving chat to Haiku
would require:
1. Removing artist research capability, OR
2. Integrating a separate search API (Google Custom Search or Brave API) into the chat route

Neither is worth the cost. Gemini 2.5 Flash at $0.30/MTok input is already cheap.

**Decision: No change to chat model.**

| Candidate | Cost | Verdict |
|-----------|------|---------|
| Gemini 2.5 Flash (current) | $0.30 / $2.50 | Correct — Google Search grounding is the deciding factor |
| Claude Haiku 4.5 | $1.00 / $5.00 | 3.3× more expensive AND loses Google Search grounding |
| Gemini 2.5 Flash-Lite | $0.10 / $0.40 | 3× cheaper but 2.5 Flash is already within free tier |

### Planner Model Decision: EVALUATE Haiku 4.5

**The task:** Claude selects ~15 structured fields from a constrained list (exact model names).
This is selection, not creative writing. The ToneIntent schema is small and deterministic.

**Haiku 4.5 capabilities relevant to this task (HIGH confidence, verified):**
- Structured output via `output_config.format` — GA, no beta header required
- `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod` works on both Sonnet 4.6 and Haiku 4.5
- API ID: `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`)
- Same 200K context window as Sonnet 4.6
- Supports prompt caching with same `cache_control: ephemeral` mechanism

**The risk:** Creative model selection (which amp matches "Mark Knopfler Dire Straits tone"?)
requires genuine guitar gear knowledge. Haiku 4.5 is near-frontier but a step below Sonnet 4.6
on creative tasks. If Haiku picks the wrong amp or mismatches cab to amp, preset quality drops
at the single most important step.

**Recommendation: DO NOT switch without A/B quality validation.**

Run 20+ preset generations with both models across diverse tone goals:
- Clear Fender-style clean with single coils
- Marshall crunch for classic rock
- Mesa/Rectifier high gain for modern metal
- Vox jangle for indie/British
- Ambient reverb-forward clean

Compare: amp category correctness, cab pairing accuracy, effect selection appropriateness,
snapshot name quality.

**If A/B test passes:** Change `model: "claude-sonnet-4-6"` → `model: "claude-haiku-4-5-20251001"`
in `src/lib/planner.ts`. Prompt caching stays identical. Expected savings: 3× lower cost per
generation call ($3→$1 input, $15→$5 output).

**If A/B test fails:** Keep Sonnet 4.6. The quality difference is the product's core value.

### Prompt Caching — Already Implemented, Verify It

Prompt caching is live on the planner (`cache_control: { type: "ephemeral" }` on system
prompt). The token usage logger (`usage-logger.ts`) already captures
`cache_read_input_tokens`. Verify hit rate exceeds 80% — if not, investigate whether
`buildPlannerPrompt()` arguments are changing between calls.

| Metric | Source | Expected |
|--------|--------|---------|
| Cache hit rate | `PlannerUsageRecord.cache_hit` | >80% |
| Input token baseline | `usage.input_tokens` | ~800 tokens per call |
| Cache read savings | `cache_read_input_tokens × 0.10x` vs full input | ~90% savings on cached tokens |

Source: [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official)

---

## Feature Area 6: Device/Model Architecture Review

### Current Architecture

The device/model abstraction has 6 devices across 4 builders and 3 file formats:

| Device | Builder | File Format | Key Constraint |
|--------|---------|-------------|---------------|
| Helix LT | `preset-builder.ts` | `.hlx` | 8 blocks/DSP, 8 snapshots, dual-DSP |
| Helix Floor | `preset-builder.ts` | `.hlx` | Same as LT |
| HX Stomp | `stomp-builder.ts` | `.hlx` | 6 blocks total, 3 snapshots |
| HX Stomp XL | `stomp-builder.ts` | `.hlx` | 9 blocks total, 4 snapshots |
| Pod Go | `podgo-builder.ts` | `.pgp` | 4 user effects max, different @type encoding |
| Helix Stadium | `stadium-builder.ts` | `.hsp` | Slot-based format, Agoura amps, 8 snapshots |

**Shared entry points:** `assembleSignalChain()`, `resolveParameters()`, `buildSnapshots()`
in `chain-rules.ts` and `param-engine.ts` — all device-aware via `DeviceTarget` parameter.

**Current device detection pattern:** Each module checks `isPodGo()`, `isStadium()`,
`isStomp()`, `isHelix()` guard functions defined in `types.ts`.

### What the Architecture Review Should Assess

1. **Duplication between builders** — Do `preset-builder.ts`, `stomp-builder.ts`, and
   `podgo-builder.ts` share block-building logic that could be extracted? (Likely yes for
   `@enabled`, controller assignment, snapshot block-state encoding)

2. **Stadium param-engine gaps** — Does `param-engine.ts` correctly apply all Stadium-specific
   params? Currently the Agoura amps only have `{ Drive, Bass, Mid, Treble, Master, ChVol }`.
   Real .hsp inspection may reveal additional keys (Presence? Sag? custom Agoura params).

3. **Model catalog completeness** — `STADIUM_AMPS` has 12 entries. Firmware 1.2 added 7 new
   Agoura amp channels. Are those channels in the catalog?

4. **Chain-rules device branching** — `chain-rules.ts` has multiple `if (stadium)` / `if (stomp)`
   branches. Consider whether a device-specific `ChainConfig` object passed into assembly
   functions would be cleaner than inline guards.

### Architecture Decision: Evolutionary, Not Rewrite

**Do NOT refactor the builder architecture to a class hierarchy or plugin system.** The current
flat function design with `DeviceTarget` guards is clear, testable, and well-covered by
`*.test.ts` files. Any architectural consolidation should be purely additive — extract shared
helpers, do not restructure calling patterns.

**Target refactors that are safe and valuable:**
- Extract a `buildBlockEnabled(block, snapshots, maxSnapshots)` helper used by all builders
  (currently each builder re-implements snapshot state encoding slightly differently)
- Add a `DeviceConfig` interface to `config.ts` capturing per-device constants (max blocks,
  snapshot count, DSP count) instead of having them scattered across builder files

---

## Installation

```bash
# No new packages needed for v4.0
# All changes are TypeScript source modifications in:
#   src/lib/helix/param-engine.ts  — per-model overrides, effect interactions
#   src/lib/helix/models.ts        — Stadium amp param verification
#   src/lib/helix/chain-rules.ts   — effect combination rules
#   src/lib/helix/stadium-builder.ts — .hsp format fixes from real preset inspection
#   src/lib/planner.ts             — gain-staging + cab pairing guidance
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Keep Claude Sonnet 4.6 for planner until validated | Switch to Haiku 4.5 immediately | Only after A/B quality test over 20+ diverse tone goals proves equivalent creative output |
| Keep Gemini 2.5 Flash for chat | Claude Haiku 4.5 for chat | Never — Haiku lacks Google Search grounding; artist rig research would need separate search API integration |
| Parse real .hsp files in text editor for Stadium research | External binary parser tool | Unnecessary — .hsp is magic_header + JSON text, readable in any editor after removing 8-byte header |
| Per-amp model override table in `param-engine.ts` | Let AI set Drive/Presence directly in ToneIntent | Breaks Planner-Executor architecture — AI accuracy on numbers is unreliable |
| Effect interaction rules in Knowledge Layer | Teach Claude about interactions in prompt | Claude applying interaction rules at selection time loses reproducibility; Knowledge Layer is the right place |
| Evolutionary architecture review | Full builder refactor to class hierarchy | Existing flat functions + DeviceTarget guards are clear and testable; refactor risk exceeds benefit |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Claude Haiku 3.5 / Haiku 3 | Retired/deprecated as of early 2026 — requests return errors | Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Claude Haiku 4.5 for chat (replacing Gemini) | Loses Google Search grounding which is architecturally required for artist rig research | Gemini 2.5 Flash with `tools: [{ googleSearch: {} }]` |
| Claude Opus 4.6 for planner | $5/$25 per MTok — 1.67× more expensive than Sonnet 4.6 with no quality benefit for 15-field structured selection task | Claude Sonnet 4.6 |
| External .hsp parser tools | Unnecessary complexity — .hsp is JSON text after 8-byte header strip | `JSON.parse(fileContent.slice(8))` |
| Langfuse / LangSmith at this stage | Overhead exceeds value at current traffic; `usage-logger.ts` already provides structured JSONL logging | Existing `usage-logger.ts` + Vercel log drain |
| Numeric parameters in ToneIntent | Breaks Planner-Executor architecture — the entire quality model rests on AI NOT setting numbers | Knowledge Layer param tables in `param-engine.ts` |
| Parallel wet/dry routing in v4.0 | Blocked as out-of-scope in PROJECT.md; complex Split/Join block logic; DSP budget tight on Stomp devices | Series routing with well-tuned Mix parameters |

---

## Stack Patterns by Variant

**If Haiku 4.5 planner A/B test proves quality equivalent:**
- Change `model: "claude-sonnet-4-6"` → `model: "claude-haiku-4-5-20251001"` in `src/lib/planner.ts`
- `max_tokens: 4096` stays unchanged — output is identical schema
- Update `CLAUDE_SONNET_PRICE` constant references in `usage-logger.ts` to reflect Haiku pricing
- Expect 3× lower cost per generation call
- Cache behavior is identical — `cache_control: ephemeral` works on Haiku 4.5

**If real .hsp inspection reveals Agoura amps have different parameter keys:**
- Update `STADIUM_AMPS` defaultParams in `models.ts` with correct keys
- Update `param-engine.ts` if Agoura amps need different AMP_DEFAULTS table entries
- Do NOT add a new builder — `stadium-builder.ts` handles the slot format correctly

**If firmware 1.2 Agoura amps are missing from `STADIUM_AMPS`:**
- Add 7 new Agoura models to `STADIUM_AMPS` in `models.ts`
- Re-run `getModelListForPrompt()` for Stadium device — confirm planner sees the new models
- Update planner prompt to inform Claude about the expanded amp catalog

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@anthropic-ai/sdk` | ^0.78.0 | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001` | `zodOutputFormat` from `helpers/zod` works on both; `response.usage` present on both; structured output GA on both (no beta header needed) |
| `@anthropic-ai/sdk` | ^0.78.0 | Zod ^4.3.6 | `zodOutputFormat` helper compatible with Zod 4 |
| `@google/genai` | ^1.42.0 | `gemini-2.5-flash` | Streaming + `tools: [{ googleSearch: {} }]` — no changes needed |
| Next.js | 16.1.6 | Vercel serverless | Token logging via `usage-logger.ts` JSONL — compatible with Vercel |
| Zod | ^4.3.6 | TypeScript ^5 | No migration needed; already on Zod 4 |

---

## Sources

- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Haiku 4.5 model ID (`claude-haiku-4-5-20251001`), Sonnet 4.6 pricing, structured output GA status — HIGH confidence (official, verified 2026-03-05)
- [Anthropic Model Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) — Haiku 3.5 retired, Haiku 3 deprecated — HIGH confidence (official)
- [Anthropic Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA support across Haiku 4.5, Sonnet 4.6; `output_config.format`; `zodOutputFormat` helper — HIGH confidence (official)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control: ephemeral` on Haiku 4.5; cache read pricing 0.1× — HIGH confidence (official)
- [Claude Haiku 4.5 Announcement](https://www.anthropic.com/news/claude-haiku-4-5) — Model capabilities, coding parity with Sonnet 4, extended thinking support — HIGH confidence (official)
- [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105) — Firmware version, new Agoura amps in 1.2 — HIGH confidence (official)
- [Fluid Solo — Stadium presets](https://www.fluidsolo.com/) — Community .hsp preset source for reverse engineering — MEDIUM confidence (community, primary source)
- [Gemini vs Haiku 4.5 comparison](https://blog.galaxy.ai/compare/claude-haiku-4-5-vs-gemini-2-5-flash) — Gemini 2.5 Flash vs Haiku 4.5 for conversational quality — MEDIUM confidence (third-party analysis)
- [Tonevault 250-preset analysis](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Per-amp parameter ranges, Drive/Presence correlation, cab affinity data — HIGH confidence (data-driven primary source)
- `src/lib/helix/stadium-builder.ts` — Existing .hsp format implementation as verified baseline — HIGH confidence (codebase, cross-checked against 2 real .hsp files)
- `src/lib/helix/models.ts` — STADIUM_AMPS catalog, Agoura amp param defaults — HIGH confidence (codebase, source of truth for current state)

---

*Stack research for: HelixTones v4.0 — Stadium Rebuild + Preset Quality Leap*
*Researched: 2026-03-05*
