# Project Research Summary

**Project:** HelixTones v4.0 — Preset Quality Leap + API Cost Optimization
**Domain:** AI-driven guitar preset generation for Line 6 Helix hardware
**Researched:** 2026-03-04
**Confidence:** HIGH overall

## Executive Summary

HelixTones v4.0 is a targeted quality and efficiency improvement on top of an already-working Planner-Executor architecture. The app generates Helix guitar presets by having Claude Sonnet 4.6 select creative intent (amp, cab, effects) and a deterministic Knowledge Layer assign all numeric parameters. Research confirms this architectural boundary is correct and must not be eroded — every attempt to let AI set numeric values degrades preset quality. The quality gap between HelixTones-generated presets and premium hand-crafted commercial presets (M. Britt, Alex Price, Tone Junkie) comes entirely from imprecision in the Knowledge Layer, not from the AI model selection. The Tonevault analysis of 250 professional presets provides data-driven evidence that parameter tuning must be per-amp-model rather than per-category, and that the delta from current defaults is measurable and encodable without any new packages.

The recommended approach is a strict implementation sequence: instrument first (token cost audit and quality baseline), improve what is already there before adding complexity (planner prompt quality, per-model param tables, pickup EQ, reverb pre-delay, snapshot volume compensation), then add the most impactful structural changes (effect combination intelligence, parallel wet/dry routing). The current model split is already correct — Gemini 2.5 Flash for chat, Claude Sonnet 4.6 for generation — and no model changes should be made without A/B quality validation and measured cache hit data. Zero new npm packages are required for the entire v4.0 scope.

The primary risk category is over-engineering in the wrong direction: bloating the planner prompt degrades structured output compliance, replacing category defaults with community-derived values introduces output-level artifacts, and enabling parallel routing without phase-aware chain rules ships audibly broken presets. Every quality change must be tested on actual hardware before encoding into the Knowledge Layer. Research flags two phases that require extra care: prompt quality improvements (incremental changes with baseline testing before and after each addition) and parallel routing (phase cancellation and DSP budget validation across all 6 devices).

## Key Findings

### Recommended Stack

No new packages are needed. All v4.0 work is TypeScript source changes to `src/lib/helix/` and `src/lib/planner.ts`. The existing split — `@anthropic-ai/sdk` ^0.78.0 for structured Claude generation, `@google/genai` ^1.42.0 for Gemini chat with Google Search grounding — is already optimal. Prompt caching is live on the planner call and must be preserved; system prompt changes should only ship at milestone boundaries to avoid cache invalidation cost. See `.planning/research/STACK.md` for the full stack analysis.

**Core technologies:**
- `@anthropic-ai/sdk` ^0.78.0 + Claude Sonnet 4.6: Planner structured output — only model with reliable zodOutputFormat + prompt caching at this task complexity
- `@google/genai` ^1.42.0 + Gemini 2.5 Flash: Chat interview — Google Search grounding for artist rig research is architecturally essential and not replicable with Claude models
- Zod ^4.3.6: ToneIntent schema enforcement — add optional `routingMode` field for parallel path support; backward-compatible via `z.optional()`
- Vercel console.log: Token cost audit — structured JSON logging sufficient at current traffic volume, no external APM needed

**Key decision:** Claude Haiku 4.5 is a viable planner candidate at 3x lower cost ($1/$5 vs $3/$15 per MTok) but only after a 20+ preset A/B quality validation with a defined evaluation rubric. Gemini Flash-Lite ($0.10/$0.40) is viable for non-research chat turns but requires turn-type detection logic and quality monitoring before it is safe to deploy. Neither switch should happen in v4.0 without Phase 1 audit data.

### Expected Features

Research identifies a clear priority ordering based on effort-to-quality ratio. See `.planning/research/FEATURES.md` for the full feature dependency graph and prioritization matrix.

**Must have (table stakes for v4.0):**
- Richer ToneIntent creative prompting — prompt-only, zero risk, highest ROI — ships first
- ampFamily classification + per-model parameter overrides — closes the "flat Fender Master" problem for 10-15 popular amps using Tonevault 250-preset data
- Correct Master Volume strategy per amp type — Fender/Vox max Master; Marshall/Mesa conservative; indexed by ampFamily
- Pickup-specific EQ variants — guitarType dimension in EQ_PARAMS for single_coil vs humbucker vs p90
- Reverb pre-delay — PreDelay field in GENRE_EFFECT_DEFAULTS; professional preset standard; single parameter addition
- Context-sensitive delay timing — tempo-scaled note-value calculations (quarter, dotted-eighth) when tempoHint is present
- Snapshot-aware volume compensation — per-toneRole ChVol deltas; lead snapshots louder than clean
- Token usage audit — LOG_USAGE env flag for both API routes; required before any cost optimization decisions

**Should have (competitive differentiators, v4.x):**
- Genre-specific mandatory block substitution — jazz gets compressor not 808; ambient omits gate
- Effect combination intelligence — Layer 5 in param-engine.ts for compressor-to-drive, chorus-to-reverb, delay-to-reverb interactions
- Dual-cab mic blend — Fredman dual-mic technique via distinct Mic indices on parallel cab blocks
- Chat context window management — rolling 10-turn window + summary; JetBrains NeurIPS 2025 pattern

**Defer (v4.x to v5+):**
- Parallel frequency split routing — high quality impact but high DSP complexity; requires phase-safe chain rules and 6-device testing; its own planning cycle
- Gemini Flash-Lite model routing — meaningful cost savings but requires turn-classification logic and A/B validation framework
- Artist-specific parameter profiles — high research cost, low engineering risk; defer until base param quality is proven

### Architecture Approach

The Planner-Executor boundary is the central architectural invariant: AI outputs only named selections (ampName, cabName, effects[], routingMode), never numbers. The Knowledge Layer deterministically assigns all numeric parameters through a 4-layer resolution: model defaults, category overrides, topology override, genre effect defaults. v4.0 adds a Layer 1.5 of per-model overrides and a 5th resolution layer (effect combination adjustments), plus an optional `routingMode` field to ToneIntent for parallel wet/dry topology. The parallel wet/dry routing reuses existing HlxDsp `split?` and `join?` keys already present in types.ts — no file format changes are needed, only chain-rules assembly logic and preset-builder serialization. See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and the Phase A-E build order.

**Major components and v4.0 changes:**
1. `planner.ts` / `buildPlannerPrompt()` — MODIFY: add effect combination guidance, amp+cab pairing rules, routing mode decision logic (all one batched deployment)
2. `tone-intent.ts` — MODIFY: add optional `routingMode?: z.enum(["series","parallel_wetdry"])`
3. `param-engine.ts` — MODIFY: add per-model override table (Layer 1.5), EFFECT_COMBO_PARAMS (Layer 5), audit model-specific defaultParams for Vox Cut / Diezel Deep / JC-120 BrightSwitch
4. `models.ts` — MODIFY: add ampFamily classification, populate cabAffinity[], update defaultParams for 10-15 popular amps with Tonevault-derived values
5. `chain-rules.ts` — MODIFY: parallel_wetdry routing branch with DSP budget enforcement per device; genre-aware mandatory block substitution
6. `snapshot-engine.ts` — NO CHANGE: toneRole-indexed ChVol deltas fit within existing buildSnapshots() call pattern
7. `/api/generate/route.ts` and `/api/chat/route.ts` — MINOR: structured token usage logging behind LOG_USAGE env flag

### Critical Pitfalls

Research identified 6 critical pitfalls, all specific to this milestone's quality improvement approach. Full details, warning signs, and recovery strategies in `.planning/research/PITFALLS.md`.

1. **Planner prompt bloat degrades structured output quality** — Adding 500+ tokens of creative guidelines without testing can cause ToneIntent schema validation failures and creative diversity collapse ("lost in the middle" effect, documented in arxiv 2025 research). Avoid by: establishing a 20-generation baseline before any prompt change; adding one guidance section at a time with retesting; keeping prompt under 2,000 tokens total; placing new guidance before schema definitions.

2. **Parallel routing creates phase cancellation on dual-amp presets** — When two amp blocks are summed at a merge block, comb filtering produces a "hollow" or "thin" tone. Documented by the Line 6 community as a recurring hardware artifact. Avoid by: implementing wet/dry split only (dry amp on Path A, delay/reverb at 100% wet on Path B) — this sidesteps dual-amp phase conflict entirely. Never generate two amp blocks on parallel paths without explicit phase inversion logic.

3. **Category defaults override model-specific nuance** — Adding more aggressive category-level overrides to param-engine.ts stomps on per-model defaults and makes all amps in a category sound the same. The quality gap with commercial presets is in per-model calibration, not category averages. Avoid by: adding a Layer 1.5 of per-model overrides that category defaults cannot overwrite; testing with at least 3 amps per category before any category-level change ships.

4. **Community preset research without hardware validation** — Community preset parameters encode output-level corrections for specific monitoring setups alongside tonal choices. Copying them blindly produces presets that are too loud, too quiet, or incorrectly EQ'd. Avoid by: extracting only mid-chain parameters (amp Drive, Sag, Bias, EQ bands); testing every new default on actual Helix hardware before encoding; never copying post-cab Gain Block values.

5. **Effect combination rules that violate block budget on HX Stomp** — Combination patterns designed for Helix LT (8 non-cab blocks per DSP) silently break on HX Stomp (6-block max), producing presets that cannot load on hardware. Avoid by: classifying every new combination pattern by minimum block budget; testing all new patterns on all 6 device types in chain-rules.test.ts.

6. **Model split (Haiku chat / Sonnet generation) breaks prompt cache architecture** — Routing chat to Haiku may cause Sonnet generation prompt cache to go cold, increasing generation costs rather than reducing them (Anthropic prompt caching is workspace-level, not session-level). Avoid by: measuring Sonnet cache hit rate (`cache_read_input_tokens`) before any model split; implementing model split behind a feature flag; monitoring for 7 days before making default.

## Implications for Roadmap

Research establishes a clear dependency ordering. Instrumentation must come first (cannot make cost decisions without data, cannot validate quality improvements without a before-state baseline). Prompt quality can run in parallel with Knowledge Layer improvements but should ship as a single batched deployment to preserve prompt cache. Parallel routing depends on both stable param-engine and stable planner prompt. Model routing decisions are gated on cost audit data.

### Phase 1: Token Cost Audit + Quality Baseline

**Rationale:** Cannot make any cost optimization decisions without real token data. Cannot make safe prompt changes without a quality baseline to measure regressions against. Both are standalone, zero-risk tasks that unblock all other phases. The quality evaluation rubric defined here also serves as the A/B test framework for any future Haiku planner evaluation.
**Delivers:** LOG_USAGE structured logging in both API routes; 20-generation baseline test suite with schema compliance rate and creative diversity metrics; cache hit rate measurement for Sonnet planner calls; defined evaluation rubric (correct amp category, correct cab pairing, appropriate effect selection, creative diversity score).
**Addresses:** Token usage audit (P1 feature); establishes the "before" state for all quality comparisons.
**Avoids:** Model split without data (Pitfall 6); prompt changes without quality baseline (Pitfall 1).

### Phase 2: Planner Prompt Quality

**Rationale:** Zero-risk, zero-schema-changes, highest ROI quality improvement. Ships before any Knowledge Layer changes so its effects can be isolated in testing. Must be a single batched deployment to avoid repeated prompt cache invalidations — every prompt change invalidates the cache and incurs a one-time re-warm cost.
**Delivers:** Rewritten Creative Guidelines section with gain staging philosophy, amp+cab pairing rules, effect count discipline per genre, routing mode decision guidance; 20-generation retest confirms no schema compliance regression and measurable improvement in creative diversity.
**Addresses:** Richer ToneIntent creative prompting (P1 feature).
**Avoids:** Prompt bloat degrading structured output (Pitfall 1) by shipping all guidance changes in one milestone-level deployment.
**Research flag:** NEEDS CAREFUL TESTING — run 20-generation suite before and after; any increase in schema validation failure rate is a blocker; keep total system prompt under 2,000 tokens.

### Phase 3: Knowledge Layer Quality — Amp Parameters

**Rationale:** ampFamily classification is the shared foundation for three quality features (per-model overrides, Master Volume strategy, pre-amp EQ). It must be built once and shared. Per-model param overrides deliver the largest perceptible quality improvement for guitarist users — this is where the gap with commercial presets is most audible. Phase 2 must be stable first so improved Planner decisions feed into better Knowledge Layer inputs.
**Delivers:** ampFamily field in models.ts; cabAffinity[] populated for 10-15 popular amps (Panama, Placater, WhoWatt, Litigator, Mandarin, Essex); Layer 1.5 per-model override table in param-engine.ts; Fender/Vox Master maxed, Marshall/Mesa conservative; Tonevault-derived Drive/Presence correlation for Rectifier-style amps; hardware validation on Helix LT before shipping.
**Addresses:** ampFamily + per-model param overrides (P1); Correct Master Volume per amp type (P1).
**Avoids:** Category defaults overriding model-specific nuance (Pitfall 3) by implementing Layer 1.5 that category overrides cannot stomp; community preset research without hardware validation (Pitfall 4) by requiring hardware test before encoding.

### Phase 4: Knowledge Layer Quality — Effects, EQ, and Snapshots

**Rationale:** These improvements are independent of ampFamily and parallel routing. All are additive table extensions to existing data structures — no new interfaces, no schema changes. Best shipped together with Phase 3 to minimize cache invalidation events. Can be developed in parallel with Phase 3.
**Delivers:** guitarType-indexed EQ variants (single_coil/humbucker/p90) in EQ_PARAMS; PreDelay added to GENRE_EFFECT_DEFAULTS reverb entries (jazz: 30ms, rock: 20ms, ambient: 50ms, metal: 10ms); tempo-scaled delay calculations when tempoHint is present; per-toneRole ChVol delta table in snapshot-engine.ts.
**Addresses:** Pickup-specific EQ variants (P1); Reverb pre-delay (P1); Context-sensitive delay timing (P1); Snapshot-aware volume compensation (P1).
**Avoids:** No critical pitfalls directly — these are low-risk additive table changes, fully unit-testable.

### Phase 5: Effect Combination Intelligence (Layer 5)

**Rationale:** Depends on stable param-engine from Phases 3-4 so Layer 5 adjustments apply on top of correct base parameter values. The EFFECT_COMBO_PARAMS table and applyComboAdjustments() function are fully deterministic and unit-testable. Genre-specific mandatory block substitution belongs here because it requires the same genreHint-aware chain-rules logic.
**Delivers:** EFFECT_COMBO_PARAMS constant in param-engine.ts with compressor-to-drive, chorus-to-reverb, and delay-to-reverb adjustment pairs; applyComboAdjustments() as the final (5th) resolution step; unit tests for each combo pair; genre-specific mandatory block substitution in chain-rules.ts (jazz gets compressor, not 808; metal keeps Horizon Gate; ambient omits boost).
**Addresses:** Effect combination intelligence (P2); Genre-specific mandatory block substitution (P2).
**Avoids:** Effect combination rules conflicting with block budget (Pitfall 5) by classifying each rule by minimum block budget and adding device type checks in chain-rules.

### Phase 6: Parallel Wet/Dry Routing

**Rationale:** Highest complexity, highest risk. Depends on Phases 3-5 (stable param-engine must handle split/join blocks; planner prompt must include routing mode guidance from Phase 2). Gated to Helix LT and Helix Floor only — Pod Go, HX Stomp, and Stadium are single-path. Implements wet/dry split (dry on Path A, delay/reverb at 100% wet on Path B) rather than dual-amp parallel to avoid phase cancellation.
**Delivers:** `routingMode?: z.enum(["series","parallel_wetdry"])` in ToneIntentSchema; "split" and "join" added to BlockSpec.type union in types.ts; chain-rules parallel_wetdry assembly branch with tighter effect count enforcement (max 2 time effects) and device guard; preset-builder.ts split/join serialization with `@topology0: "SABJ"`; hardware import test into HX Edit on Helix LT before ship.
**Addresses:** Parallel wet/dry routing topology (P3 feature from FEATURES.md).
**Avoids:** Phase cancellation (Pitfall 2) by wet/dry split only with no dual-amp parallel; block budget overflow (Pitfall 5) by enforcing tighter effect count; parallel routing on single-DSP devices (architecture anti-pattern 3) by device guard in chain-rules.
**Research flag:** NEEDS HARDWARE VALIDATION — import generated parallel preset into HX Edit and confirm signal path display and correct audio behavior before marking phase complete.

### Phase 7: Model Routing Decision (Cost Optimization)

**Rationale:** Final phase because it requires Phase 1 cost audit data. This decision may be "no changes needed" — the current architecture may already be efficient at current traffic volume. Only act on the evidence.
**Delivers:** An evidence-based documented decision: either keep current model split with rationale, or a validated Haiku 4.5 planner switch (A/B quality data from 20+ presets using Phase 1 rubric), or Gemini Flash-Lite for non-research chat turns with quality monitoring in place. Zero-change is an acceptable outcome.
**Addresses:** API cost optimization beyond the already-implemented prompt caching.
**Avoids:** Model split breaking prompt cache (Pitfall 6) by measuring cache hit rate first and implementing behind a feature flag with 7-day monitoring period.
**Research flag:** DECISION-GATED — do not plan implementation details until Phase 1 data is reviewed; this entire phase may be a no-op.

### Phase Ordering Rationale

- Phase 1 is mandatory first because all cost decisions require data and all quality changes require a before-state baseline to measure regression or improvement.
- Phase 2 before Phases 3-5 because prompt quality is upstream of Knowledge Layer quality — better Planner decisions provide better inputs to the param engine.
- Phases 3 and 4 can be developed in parallel (ampFamily work is independent of EQ/reverb/snapshot table extensions) but should deploy together to minimize prompt cache invalidation events.
- Phase 5 after 3-4 because Layer 5 combo adjustments must sit on top of correct base parameter values, not on top of broken category defaults.
- Phase 6 last among quality phases because it introduces the most new code surface (new ToneIntent field, new chain-rules branch, new preset-builder serialization) and requires hardware validation — shipping after all other quality improvements are stable reduces regression risk.
- Phase 7 last because it is data-gated on Phase 1 and must not skip past quality stability.

### Research Flags

Phases needing deeper care during execution:

- **Phase 2 (Planner Prompt):** Run 20-generation test suite before and after each prompt section addition. Schema compliance failure rate is the acceptance criterion — any increase is a blocker. Keep total system prompt under 2,000 tokens. Batch all changes into one deployment to avoid repeated cache invalidations.
- **Phase 6 (Parallel Routing):** Requires hardware import test into HX Edit before shipping. chain-rules.test.ts must include an assertion that no dual-amp parallel preset is generated without phase correction. DSP block budget must be recalculated for all 6 device types with split/join blocks consuming 2 of the available slots.
- **Phase 7 (Model Routing):** No implementation plan until Phase 1 data review. If Sonnet generation cache hit rate is already greater than 80% and costs are acceptable at current traffic, this phase is a documented no-op.

Phases with standard, well-documented patterns (lower execution risk):

- **Phase 1 (Token Audit):** Structured console.log behind an env flag — a one-hour engineering task with no architectural risk.
- **Phase 4 (EQ / Reverb / Snapshots):** All additive table extensions to existing data structures. Fully unit-testable. No schema changes.
- **Phase 5 (Effect Combinations):** Deterministic, fully unit-testable table plus function. No AI changes. No schema changes.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Anthropic and Google pricing docs verified; existing stack confirmed against live codebase; no new packages means zero integration uncertainty |
| Features | HIGH | Tonevault 250-preset data-driven analysis (primary source); multiple commercial preset maker methodologies cross-verified; JetBrains NeurIPS 2025 research for context management patterns |
| Architecture | HIGH | Existing architecture read directly from source code (ground truth); parallel routing patterns from official Line 6 manuals; HlxDsp split/join fields verified in types.ts |
| Pitfalls | HIGH | Phase cancellation from official Line 6 support forums (documented real-world hardware issue); prompt bloat from arxiv 2025/2026 research (empirical study); param override risk from direct code analysis |

**Overall confidence:** HIGH

### Gaps to Address

- **Per-model parameter values for 10-15 popular amps:** The Tonevault data gives ranges and patterns; specific values (e.g., Drive: 0.52 vs 0.55 for a Placater Dirty) need hardware validation before encoding. A hardware test session on Helix LT is a required acceptance criterion for Phase 3 — plan it before Phase 3 begins.
- **Gemini Flash-Lite turn-classification accuracy:** The research proposes keyword matching to detect artist/gear research turns (band names, gear model mentions) but this heuristic needs live accuracy measurement before routing decisions are made in Phase 7. Define the detection approach and its false-positive rate during Phase 7 planning.
- **Parallel routing DSP budget on HX Stomp XL:** The research establishes that 6-block max minus mandatory blocks leaves 2-3 user effect slots, but the exact interaction with split/join block consumption needs to be validated in code before Phase 6 ships. Chain-rules block count logic must be audited for all 6 device types as part of Phase 6 design.
- **Haiku 4.5 planner quality evaluation rubric:** The research recommends A/B testing over 20+ presets, but the quality criteria (correct amp category, correct cab pairing, appropriate effect selection, creative diversity) need concrete scoring definitions. Define this rubric in Phase 1 alongside the quality baseline — it becomes the evaluation framework for Phase 7.

## Sources

### Primary (HIGH confidence)
- [Anthropic Models Overview + Pricing](https://platform.claude.com/docs/en/about-claude/models/overview) — Model IDs, capabilities, $3/$15 Sonnet 4.6, $1/$5 Haiku 4.5
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — Cache token metrics, workspace-level isolation (Feb 2026), response.usage fields
- [Anthropic Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — zodOutputFormat, schema caching, beta header
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Flash $0.30/$2.50 per MTok; Flash-Lite $0.10/$0.40
- [Tonevault — Dialing in your Helix amps: what the top 250 presets teach us](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Amp param ranges by model, correlation data, cab pairings, 808 usage in 71% of high-gain presets
- [Line 6 Signal Path Routing Manual](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — Parallel path architecture, Split/Merge blocks, device constraints
- [Line 6 Parallel Split/Summing issues (support forum)](https://line6.com/support/topic/56905-parallel-splitsumming-wetdry-issues/) — Phase cancellation documented as real-world hardware issue
- [Line 6 Phase issue with two amp blocks (support forum)](https://line6.com/support/topic/58405-phase-issue-with-two-amp-blocks-one-path-each/) — Dual-amp phase conflict specifics
- "When Better Prompts Hurt: Evaluation-Driven Iteration" (arxiv 2025) — Structured output regression from prompt changes; extraction pass rate drop from 100% to 90%
- [JetBrains Research Blog — Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) — NeurIPS 2025: last 10 turns verbatim + summary optimal for token efficiency
- HelixTones codebase direct inspection — `types.ts`, `chain-rules.ts`, `param-engine.ts`, `tone-intent.ts`, `preset-builder.ts` (ground truth for all integration points)

### Secondary (MEDIUM confidence)
- [Sweetwater — Understanding Helix Amp Parameters](https://www.sweetwater.com/insync/understanding-helix-amp-parameters/) — Amp parameter behavior, corroborated by Line 6 manuals
- [Sweetwater — Multiband Processing with Helix](https://www.sweetwater.com/insync/multiband-processing-technique-effects/) — Parallel frequency split techniques (Craig Anderton)
- [Komposition101 — Mastering Amp Parameters on Line 6 Helix](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — Commercial preset maker methodology
- [MLOps Community — Prompt Bloat impact on LLM output quality](https://mlops.community/the-impact-of-prompt-bloat-on-llm-output-quality/) — "Lost in the middle" practical implications
- [Alex Price Musician — Complete Preset Library](https://www.alexpricemusician.com/helix) — Single-coil vs humbucker EQ variant methodology; 2024 library update
- [Mem0 — LLM Chat History Summarization Guide](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — Chat context window rolling patterns
- [iZotope — 8 Tips for Using Reverbs and Delays on Guitars](https://www.izotope.com/en/learn/8-tips-for-using-reverbs-and-delays-on-guitars.html) — Pre-delay for note definition

### Tertiary (LOW confidence)
- LLM2Fx framework (arxiv 2025) — Research on LLMs predicting audio effect parameters from natural language; confirms problem space is active but not directly applicable to HelixTones architecture

---
*Research completed: 2026-03-04*
*Ready for roadmap: yes*
