# Feature Research

**Domain:** Preset quality leap + API cost optimization — HelixTones v4.0
**Researched:** 2026-03-04
**Confidence:** HIGH for quality patterns (multiple professional sources, community consensus, Tonevault 250-preset data); HIGH for API cost optimization (official Anthropic/Google pricing docs, multiple corroborating industry sources); MEDIUM for model-specific parameter targets (community-derived, not from Line 6 engineering)

---

## Context: What Already Exists vs. What This Milestone Adds

HelixTones v3.1 has a fully working planner-executor architecture. The Planner (Claude Sonnet 4.6) selects amp/cab/effects. The Knowledge Layer deterministically assigns all numeric parameters. The chat interview uses Gemini 2.5 Flash (not Claude) for cost reasons, with Google Search grounding for artist research.

**What already works well:**
- Category-level amp defaults (clean/crunch/high_gain) with Sag, Bias, Master, Drive, EQ
- Topology-aware mid adjustment (cathode_follower vs plate_fed)
- Cab LowCut/HighCut filtering per category
- Post-cab Parametric EQ per category
- Genre-aware effect defaults for delay/reverb/modulation (9 genres)
- Snapshot design with 4 toneRoles (clean/crunch/lead/ambient)
- Always-on mandatory blocks: Minotaur/Scream 808 boost, Horizon Gate, post-cab Parametric EQ
- Dual-amp AB topology (split/join) for Helix LT/Floor/Stadium
- Prompt caching on the planner call (~50% cost reduction already achieved)
- Chat uses Gemini 2.5 Flash with Google Search grounding (not Claude)
- Planner uses Claude Sonnet 4.6 with structured output (Zod schema enforcement)

**The quality gap this milestone closes:**
Premium commercial presets (Alex Price, M. Britt, Tone Junkie, komposition101) differ from HelixTones-generated presets in three measurable ways:
1. **Effect selection intelligence** — Pro presets pick effect combinations that interact musically, not just "add delay + reverb." They use parallel compression, stacked modulation, specific delay subdivision pairings, and pre-amp EQ shaping tailored to specific amp inputs.
2. **Parameter precision** — Pro presets set amp-specific parameter values based on per-model circuit behavior (not just category-level averages). SAG, Bias, Master interact differently across amp models — a flat category default misses model-specific sweet spots.
3. **Signal routing creativity** — Pro presets use parallel paths (frequency splits, dual-mic cab blends, parallel compression) rather than purely serial chains.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that define the quality floor for an AI preset generator competing with paid commercial presets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Amp-model-specific parameter tuning** | Category defaults (clean/crunch/high_gain) are correct on average but wrong for specific models. The Tonevault 250-preset analysis shows Panama presets run flat EQ with 808-only gain shaping, while Rectifire presets scoop mids inversely correlated with Drive. A premium generator must know the model, not just the category. | MEDIUM | Extend param-engine.ts to include per-model override tables layered on top of category defaults. Start with the 10-15 most-requested amp models (Panama, Placater, WhoWatt, Litigator, Mandarin, Essex, etc.). Not all 80+ models need overrides — target the popular ones. |
| **Correct Master Volume strategy per amp type** | 94% of Fender/Vox-style clean presets in Tonevault data max the Master (9-10). Marshall-types sit 3-6. Setting Master to a flat 0.60 for crunch regardless of amp type is wrong. The power amp character of non-master-volume amps (Fender, Vox AC30, Hiwatt) only engages when Master is fully open. | LOW | Add ampFamily categorization (fender_style, marshall_style, boutique_clean, high_gain_modern) to the model catalog. Master default table indexed by ampFamily, not just category. |
| **Pre-amp EQ shaping for specific amp inputs** | Professional presets routinely add an EQ block before the amp to shape how the signal hits the input — not to make huge changes, but to tighten bass mud before distortion or open highs before a dark-voiced amp. This is documented in the Tonevault Panama analysis (808 provides input shaping, not pre-amp EQ). For darker amps (Bogner Shiva / German Mahadeva) a pre-amp hi-cut adds clarity. | MEDIUM | Add optional pre-amp EQ block insertion logic to chain-rules.ts. Condition: if amp model is in a "dark-voiced" or "bass-heavy" category AND the user's genreHint suggests clarity is needed. Should be opt-in via the Knowledge Layer, not AI-decided. |
| **Context-sensitive delay parameters (tempo sync + subdivision)** | A quarter-note delay at 120 BPM is 500ms. A dotted-eighth at 120 BPM is 562.5ms. Professional presets match delay timing to musical context. Ambience/worship genres use longer subdivisions with higher feedback; metal uses short tight slap with low mix (12%). Current genre defaults use a single static Time value per genre — no musical subdivision logic. | MEDIUM | Extend GENRE_EFFECT_DEFAULTS to include subdivision type + tempo-scaled time calculation when tempoHint is present. When BPM is provided, convert to note-value-based timing: quarter = 60/BPM, dotted-eighth = (60/BPM)*0.75, etc. |
| **Reverb pre-delay for note definition** | Professional reverb settings always include pre-delay (20-80ms) to keep the initial note articulate before the reverb tail blooms. Absent pre-delay, reverb immediately smears the attack. Current param-engine sets generic reverb Mix only; PreDelay is not set. | LOW | Add PreDelay to GENRE_EFFECT_DEFAULTS reverb entries. Jazz/clean: 30ms. Rock/crunch: 20ms. Ambient: 50ms. Metal: 10ms (short, tight). This is a single additional parameter field per genre entry. |
| **End-of-chain compression option** | Professional studio engineers place an LA Studio Comp after amp+cab — exactly like inserting an LA-2A on a guitar bus. This "bus compression" warmer tone and more consistent dynamics across playing dynamics. Current mandatory blocks do not include an optional end-chain compressor. | LOW | Allow intentRole "always_on" on a compressor effect to resolve to end-of-chain placement in chain-rules.ts. The Planner already supports intentRole — the chain rules just need to place dynamics blocks appropriately when role indicates post-cab positioning. |

---

### Differentiators (Competitive Advantage)

Features that lift HelixTones above what any existing AI generator does, and closer to what premium hand-crafted presets achieve.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Parallel frequency split routing** | Professional presets split the signal at a crossover frequency (typically 190-500Hz for guitar) and process high and low bands separately — giving each band its own amp voicing, compression, or distortion character. This is how Craig Anderton's multiband presets achieve "bigger, more articulated" high-gain tones. No AI preset generator currently does this. | HIGH | Add a "parallel_split" topologyHint to ToneIntent. The chain-rules assembler inserts a Split block (crossover mode) and assigns upper/lower path effects. Knowledge Layer pre-sets the crossover frequency by genre (high-gain: 200Hz, ambient: 300Hz). Only available on Helix LT/Floor/Stadium (not Pod Go/Stomp — they lack dual-path). |
| **Dual-cab mic blend (parallel IR paths)** | Pro preset makers load two cab blocks on parallel paths with different mic choices — emulating the classic Fredman dual-mic technique (57 Dynamic on axis + 121 Ribbon off-axis). This gives complex, studio-grade cab texture. Current presets run a single cab block per amp. | MEDIUM | When a second cab block is used (already supported in dual-amp topology), assign distinct Mic values per path (e.g., Mic=0 for 57 Dynamic, Mic=6 for 121 Ribbon). Add mic combination presets to the Knowledge Layer's cab param tables indexed by ampCategory + dualMic flag. |
| **Pickup-specific EQ variants in snapshots** | Alex Price's 2024 library update adds a separate preset variant for single coil vs. humbucker guitars — the difference being small EQ tweaks in post-amp parametric EQ. ToneIntent already captures guitarType (single_coil / humbucker / p90). The Knowledge Layer can vary the post-cab EQ parameters based on guitarType. This closes the "sounds great with humbuckers but too bright with singles" complaint. | LOW | Add guitarType dimension to EQ_PARAMS table in param-engine.ts. single_coil: slightly higher HighGain (presence boost) + lower MidGain. humbucker: slightly lower HighGain (tame high-end) + higher LowGain (tighten warmth). p90: midpoint. Already have guitarType in ToneIntent. |
| **Snapshot-aware volume compensation** | Professional presets use Channel Volume differences between snapshots to volume-balance clean vs. lead tones — louder snapshots for leads that need to cut through a mix. Current preset engine sets Channel Volume identically across all snapshots. Snapshot-aware ChVol differentiation per toneRole is documented practice in the professional community. | MEDIUM | Extend snapshot-engine.ts to apply ChVol adjustments per toneRole. Proposed deltas: clean = base ChVol (0.70), crunch = +0.05, lead = +0.10, ambient = -0.05. These deltas are applied as snapshot parameter overrides, which the Helix snapshot system supports natively. |
| **Richer ToneIntent creative prompting** | The Planner prompt currently gives general creative guidelines. Premium preset creators make specific, intentional choices: "Panama at Drive 4.0 with an 808 for input shaping" vs. "add a distortion block." The Planner prompt should prime Claude with the same mental model professional preset makers use — teaching it to think in terms of amp input shaping, gain staging, and interaction between effects. | MEDIUM | Rewrite the Planner's Creative Guidelines section with model-specific guidance derived from the Tonevault analysis and professional community patterns. Add a "Gain Staging" section: what level of drive to set on high-gain amps (moderate, let the amp's preamp do the work + boost at input), what drives are "tone shapers" vs. "distortion adds." This is a prompt-only change — no schema changes required. |
| **Genre-specific mandatory block substitution** | The current mandatory-block rules always insert both Minotaur and Horizon Gate. For ambient/worship genres, a compressor (Red Squeeze or LA Studio) is more valuable at the front of chain than an 808 boost. For jazz, neither a boost nor a hard gate is appropriate — a light LA Studio Comp as a "polishing compressor" is the right always-on block. | MEDIUM | Add genreHint-aware mandatory block selection to chain-rules.ts. Resolve mandatory boost: if high_gain → Scream 808, if crunch → Minotaur, if jazz/ambient → skip boost entirely. Resolve mandatory gate: if metal → Horizon Gate, else → lighter gate or omit. Already have genreHint available at chain assembly time. |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AI-generated numeric parameter values** | "Let Claude set the exact Drive and Master values for each amp" | Every experiment with AI-generated numbers has produced worse results than deterministic tables. AI is not calibrated against actual hardware output levels, Helix's normalized float encoding, or the interaction between Sag/Bias/Master in specific amp models. The Tonevault data shows professional presets cluster around specific values that cannot be reliably reproduced by language model generation. The Planner-Executor separation exists precisely because this was already tried and failed. | Extend the Knowledge Layer's deterministic tables (per-model overrides) rather than giving Claude numeric output fields. |
| **Third-party impulse response (IR) loading** | Users request IRs for better cab sounds; professional presets often use them | Already explicitly out of scope in PROJECT.md. IRs require file loading infrastructure, IR hosting, and purchasing/licensing third-party captures. The stock cab models are sufficient for a competitive product when mic and EQ parameters are correctly set. Pursuing IRs would delay quality improvements that are achievable now through better parameter tuning. | Better mic choice selection and dual-cab blending achieves much of the IR benefit within stock cabs. |
| **Fully open-ended parallel routing** | "Let Claude design any signal topology it wants" | The Helix's parallel routing is powerful but the DSP budget constraints are precise and model-dependent. Unconstrained AI topology selection will produce DSP overflows, split/join block count violations, and broken presets that don't load. Routing must be handled by the Knowledge Layer with specific topologies as selectable patterns. | Expose 2-3 named routing topologies (serial, dual_amp_AB, frequency_split) that the Planner can select from. Each topology has a pre-validated block budget and assembly rule. |
| **Per-note or dynamic parameter automation** | "Change Drive automatically based on playing dynamics" | The Helix supports controller assignment and expression pedal mapping, but this is MIDI controller territory (already out of scope in PROJECT.md). Generating MIDI CC assignments requires a separate UI, user hardware mapping knowledge, and significantly more preset file complexity. | Snapshot-based volume compensation (the differentiator above) achieves dynamic response without controller complexity. |
| **Haiku for preset generation to save costs** | "Use Claude Haiku for the Planner call — it's 3x cheaper" | The Planner call is where quality lives. Claude's model selection for a "Soldano SLO-100 for a singing lead tone" is the creative decision that determines the entire preset. Haiku 4.5 achieves 90% of Sonnet 4.5's benchmark performance — but preset quality is not a benchmark. It requires deep knowledge of guitar gear, amp behavior, and musical context. The Planner call is called once per preset generation (not per chat turn) — its cost is negligible relative to the chat cost. Saving 3x on a call that represents ~5% of total costs is not worth quality risk. | Optimize the chat tier (Gemini 2.5 Flash is already in use). Leave Sonnet 4.6 on the Planner. |
| **Embedding-based context retrieval for presets** | "Use RAG to retrieve relevant presets as context" | HelixTones does not have a preset corpus to embed. The Knowledge Layer is code, not documents. RAG adds infrastructure complexity (vector store, embedding API calls, retrieval logic) for a use case that does not exist in the current architecture. The Planner prompt already provides the complete model list as context. | Improve the Planner prompt's creative guidance directly (richer ToneIntent prompting differentiator). |

---

## Feature Dependencies

```
Amp-model-specific parameter tuning
    └──requires──> Per-model override table in param-engine.ts
                       └──requires──> ampFamily classification in models.ts

Correct Master Volume strategy per amp type
    └──requires──> ampFamily classification in models.ts
    └──enhances──> Amp-model-specific parameter tuning (shares ampFamily field)

Pre-amp EQ shaping
    └──requires──> chain-rules.ts to support optional pre-amp block insertion
    └──requires──> ampFamily OR per-model "dark-voiced" flag in models.ts

Parallel frequency split routing
    └──requires──> topology_hint field added to ToneIntent schema
    └──requires──> chain-rules.ts to implement Split block + parallel path assembly
    └──conflicts with──> Pod Go / HX Stomp (single-path only — guard required)
    └──requires──> frequency_split is tested for DSP budget validity

Dual-cab mic blend
    └──requires──> dual_mic flag or second cab mic choice in param-engine.ts cab tables
    └──enhances──> Parallel frequency split routing (uses second path for second cab)
    └──compatible with──> Existing dual-amp topology (second cab already created)

Pickup-specific EQ variants
    └──requires──> guitarType dimension added to EQ_PARAMS in param-engine.ts
    └──depends on──> guitarType already present in ToneIntent (already shipped)

Snapshot-aware volume compensation
    └──requires──> per-toneRole ChVol delta table in snapshot-engine.ts
    └──depends on──> toneRole already present in SnapshotIntent (already shipped)

Genre-specific mandatory block substitution
    └──requires──> genreHint available at chain assembly time in chain-rules.ts
    └──depends on──> genreHint already in ToneIntent (already shipped)

Richer ToneIntent creative prompting
    └──no code dependencies — prompt-only change to planner.ts
    └──enhances──> All quality features above (better Planner decisions drive better Knowledge Layer inputs)

Context-sensitive delay parameters
    └──requires──> subdivision type + tempo-scaled calculation in GENRE_EFFECT_DEFAULTS
    └──depends on──> tempoHint already in ToneIntent (already shipped)

Reverb pre-delay
    └──requires──> PreDelay added to GENRE_EFFECT_DEFAULTS reverb entries
    └──depends on──> reverb block parameter resolution already in param-engine.ts
```

### Dependency Notes

- **ampFamily is the shared foundation for three quality features.** Amp-model-specific overrides, Master Volume strategy, and pre-amp EQ shaping all benefit from a per-model `ampFamily` classification. This should be implemented once as part of the models.ts extension, then all three features can use it.
- **ToneIntent schema changes must be backward-compatible.** Any new optional fields added (e.g., topologyHint) must have fallback behavior in chain-rules.ts so existing presets generated without the new field continue to work correctly. Use `z.optional()` and default to the current serial topology.
- **Parallel routing is high-complexity and should be gated.** The frequency split topology introduces new chain assembly paths, DSP budget complexity, and device-specific guards. It should be developed after the lower-complexity quality improvements (ampFamily, pickup EQ, reverb pre-delay) are shipped and validated.
- **Prompt improvements are zero-risk and should ship first.** Richer ToneIntent creative prompting requires no schema changes, no Knowledge Layer changes, and no testing beyond end-to-end generation. It is the highest-ROI quality improvement and should be the first thing shipped.

---

## API Cost Optimization

### Current State Analysis

The app uses two AI providers:
- **Gemini 2.5 Flash** — chat interview (tone conversation, artist research via Google Search grounding)
- **Claude Sonnet 4.6** — preset generation (Planner structured output call)

Prompt caching is already implemented on the Planner call, achieving ~50% cost reduction there.

### Optimization Opportunities

| Opportunity | Estimated Saving | Complexity | Risk |
|-------------|-----------------|------------|------|
| **Context window management for chat** | HIGH — conversations with long history send the entire conversation as context on every turn, including the Gemini system prompt (~3000 tokens) and all prior messages. At 20 turns, this is 20K+ tokens per request. | MEDIUM | LOW — Gemini's multi-turn Chat API handles history natively; implementing rolling summarization or keeping only last 10 turns needs careful testing to ensure [READY_TO_GENERATE] detection and signal chain visualization context are preserved. |
| **Gemini 2.5 Flash-Lite for standard chat turns** | HIGH — Gemini 2.5 Flash-Lite is $0.10/$0.40 per million tokens vs. $0.30/$2.50 for Flash. For conversational turns that don't require Google Search grounding (most turns), Flash-Lite may be adequate. | LOW | MEDIUM — Flash-Lite may miss artist research quality. Only safe for non-research turns (turns without artist/rig lookups). Need A/B testing to validate quality preservation. |
| **Cache the Planner system prompt (already done)** | Already implemented. Prompt caching on the ~3K-token model list provides ~50% reduction on Planner input. | N/A | N/A |
| **Structured output schema size reduction** | MEDIUM — The ToneIntent Zod schema generates a JSON Schema that is included as tokens on every Planner call. Reducing enum sizes (fewer models exposed to the Planner) or flattening the schema slightly reduces schema token overhead. | LOW | LOW — Must not reduce the model list to the point where the Planner lacks options. Evaluate actual schema token count first before optimizing. |
| **Lazy Gemini system prompt (already done)** | Already implemented per gemini.ts comment: system prompt intentionally excludes the HD2 model ID list (~3K tokens saved per chat turn). | N/A | N/A |
| **Batch Planner calls for future bulk operations** | LOW — Anthropic Batch API offers 50% discount. Relevant if HelixTones ever offers preset bundles or batch generation. Not relevant for single real-time preset generation. | HIGH | MEDIUM | Not applicable to current single-preset generation flow. |

### Recommended Cost Optimization Approach

**Phase A (immediate, low risk):** Token audit — instrument the generate and chat routes to log actual token counts per call (input, output, cache hits). Without data, cost optimization is guesswork. This is a one-hour engineering task that unblocks all further optimization decisions.

**Phase B (medium term):** Chat context management — implement rolling context window for the Gemini chat. Keep the last 10 turns verbatim (preserves recent conversational context for [READY_TO_GENERATE] detection) and summarize older turns into a brief "conversation so far" paragraph prepended to the history. This matches the JetBrains NeurIPS 2025 finding: "last 10 turns verbatim + summary of earlier content" gave the best balance of performance and token efficiency.

**Phase C (evaluate carefully):** Gemini Flash-Lite for non-research turns — route turns that don't need Google Search grounding to Flash-Lite. Requires detecting whether the current turn involves artist/gear research. The safest heuristic: if the user's message contains a band name, artist name, or specific gear model, use Flash (with Search); otherwise use Flash-Lite. Flash-Lite is $3x cheaper on output tokens.

---

## MVP Definition

### Launch With (v4.0 — Preset Quality Leap)

Minimum set of quality improvements that makes a measurable, perceptible difference in generated preset quality:

- [ ] **Richer ToneIntent creative prompting** — Rewrite Planner Creative Guidelines with gain staging philosophy, model-specific guidance, and effect interaction patterns. Zero code risk. Ships first.
- [ ] **ampFamily classification + per-model parameter overrides** — Add ampFamily to models.ts, extend param-engine.ts with per-model overlay table for the 10-15 most popular amps. Closes the "flat Fender with wrong Master" problem.
- [ ] **Correct Master Volume strategy per amp type** — Fender/Vox styles max Master; Marshall/Mesa types use conservative Master. Uses the ampFamily classification above.
- [ ] **Pickup-specific EQ variants (guitarType dimension)** — Extend EQ_PARAMS table with humbucker/single_coil/p90 variants. One table change, high quality impact for hum vs. single users.
- [ ] **Reverb pre-delay** — Add PreDelay to GENRE_EFFECT_DEFAULTS for all genres. Single parameter addition, professional-grade improvement.
- [ ] **Context-sensitive delay timing** — Tempo-scaled delay calculations when tempoHint is provided. Quarter and dotted-eighth note targets by genre.
- [ ] **Snapshot-aware volume compensation (ChVol per toneRole)** — Lead snapshots are louder than clean. One delta table in snapshot-engine.ts.
- [ ] **Token usage audit** — Log actual token counts per API route. Required before any cost optimization decisions.

### Add After Validation (v4.x)

- [ ] **Genre-specific mandatory block substitution** — Swap Minotaur/808 based on genre. Jazz gets compressor; ambient omits boost. Medium-complexity change to chain-rules.ts.
- [ ] **Dual-cab mic blend** — Second cab block gets a different Mic index for dual-mic emulation. Layered on top of existing dual-amp or frequency-split routing.
- [ ] **Chat context window management** — Rolling 10-turn window + summary. Implement after token audit confirms chat is the cost driver.
- [ ] **Pre-amp EQ shaping for dark-voiced amps** — Optional pre-amp EQ block for German Mahadeva, Essex, and other dark-voiced models. Low priority unless user feedback surfaces this specifically.

### Future Consideration (v5+)

- [ ] **Parallel frequency split routing** — Full crossover topology with dual-path processing. High complexity, high payoff. Requires thorough DSP budget validation across all 6 devices.
- [ ] **Gemini Flash-Lite for non-research chat turns** — Model routing based on turn complexity. Requires A/B testing framework and quality monitoring before production rollout.
- [ ] **Artist-specific parameter profiles** — Dedicated parameter overrides derived from known artist rig analysis (Fender Strat + AB763 + Klon = specific parameter constellation). High quality, high research cost.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Richer ToneIntent creative prompting | HIGH | LOW (prompt only) | P1 |
| ampFamily + per-model param overrides | HIGH | MEDIUM | P1 |
| Correct Master Volume per amp type | HIGH | LOW (uses ampFamily) | P1 |
| Pickup-specific EQ variants (guitarType) | HIGH | LOW | P1 |
| Reverb pre-delay | MEDIUM | LOW | P1 |
| Context-sensitive delay timing (tempo sync) | MEDIUM | MEDIUM | P1 |
| Snapshot-aware volume compensation | HIGH | LOW | P1 |
| Token usage audit (instrumentation) | HIGH (enabler) | LOW | P1 |
| Genre-specific mandatory block substitution | MEDIUM | MEDIUM | P2 |
| Dual-cab mic blend | MEDIUM | MEDIUM | P2 |
| Chat context window management | HIGH (cost) | MEDIUM | P2 |
| Pre-amp EQ shaping (dark-voiced amps) | LOW | MEDIUM | P2 |
| Parallel frequency split routing | HIGH | HIGH | P3 |
| Flash-Lite model routing | MEDIUM (cost) | MEDIUM | P3 |

**Priority key:**
- P1: Delivers the most quality-per-effort in v4.0. No architecture changes, no schema changes, or small additive changes only.
- P2: Meaningful quality/cost improvements that require more careful design and testing.
- P3: High-impact but high-complexity features that need their own planning cycle.

---

## Competitor Feature Analysis

How premium human-crafted preset packs approach the quality dimensions this milestone targets:

| Dimension | M. Britt / Alex Price / Tone Junkie (human-crafted) | HelixTones v3.1 (AI-generated) | HelixTones v4.0 Target |
|-----------|------------------------------------------------------|-------------------------------|------------------------|
| Amp-specific tuning | Per-model hand-tuned parameters based on circuit knowledge and ears | Category-level defaults (clean/crunch/high_gain) | Per-model overlay tables derived from community analysis |
| Master Volume strategy | Maxed for Fender/Vox (power amp fully engaged); conservative for Marshall/Mesa | Flat 0.60 per category | ampFamily-indexed Master defaults |
| Pickup optimization | Separate single coil vs. humbucker versions of each preset | Single EQ table per category | guitarType-indexed EQ variants |
| Delay interaction | Tempo-synced dotted-eighth and quarter combos; genre-matched subdivisions | Static time values per genre | Tempo-scaled note-value calculations + genre subdivision targets |
| Reverb definition | Pre-delay 20-60ms to preserve note attack before tail | No pre-delay set | Genre-indexed PreDelay values |
| Dynamic response | Snapshot ChVol balancing; lead +3-5dB over clean | Uniform ChVol across snapshots | toneRole-indexed ChVol deltas |
| Signal routing | Parallel paths, dual-mic cabs, frequency splits in flagship presets | Serial chain (dual-amp AB topology exists but no frequency splits) | Frequency split and dual-mic blend added as explicit topologies |
| Effect stacking intelligence | Effects chosen for specific genre+amp interaction (808 for input shaping vs. saturation) | Generic effect slot filling | Planner prompt restructured with gain staging mental model |

---

## Sources

- [Dialing in Your Helix Amps: What the Top 250 Presets Teach Us — Tonevault Blog](https://www.tonevault.io/blog/250-helix-amps-analyzed) — HIGH confidence (data-driven analysis of 250 real professional presets; specific amp parameter correlations)
- [Understanding Helix Amp Parameters — Sweetwater InSync](https://www.sweetwater.com/insync/understanding-helix-amp-parameters/) — HIGH confidence (official Sweetwater editorial, corroborated by Line 6 manuals)
- [Common Amp Settings — Helix Help](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — MEDIUM confidence (community reference, widely cited)
- [Mastering Amp Parameters in Line 6 Products — Komposition101](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — MEDIUM confidence (commercial preset maker analysis)
- [Double Down for the Best Line 6 Helix Tone — Sweetwater InSync](https://www.sweetwater.com/insync/double-best-line-6-helix-tone/) — HIGH confidence (Sweetwater editorial)
- [Multiband Processing — Sweetwater InSync](https://www.sweetwater.com/insync/multiband-processing-technique-effects/) — HIGH confidence (Sweetwater editorial, Craig Anderton technique)
- [Multiband Processing on Guitars — Reverb News](https://reverb.com/news/why-use-multiband-processing-on-guitars) — MEDIUM confidence (editorial, single source)
- [Signal Path Routing — Line 6 Stadium Manuals](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — HIGH confidence (official Line 6 documentation)
- [Common Signal Flow Traits on the Helix — Line 6 KB](https://line6.com/support/page/kb/effects-controllers/helix/common-signal-flow-traits-on-the-helix-r880/) — HIGH confidence (official Line 6 knowledge base)
- [8 Tips for Using Reverbs and Delays on Guitars — iZotope](https://www.izotope.com/en/learn/8-tips-for-using-reverbs-and-delays-on-guitars.html) — HIGH confidence (iZotope professional audio reference)
- [Reverb and Delay Pedal Placement Guide — Pro Sound HQ](https://prosoundhq.com/reverb-and-delay-pedal-placement-guide-best-chain-order/) — MEDIUM confidence (single editorial source, broadly consistent with professional practice)
- [Alex Price Musician — Complete Preset Library](https://www.alexpricemusician.com/helix) — MEDIUM confidence (commercial preset maker methodology, single source)
- [Tone Factor — Preset Architecture Description](https://www.tonefactor.co/helix) — MEDIUM confidence (commercial preset maker, detailed signal chain description)
- [Premium Line 6 Helix Presets — M. Britt](https://mbritt.com/product/m-britt-helix-preset-pack-1/) — MEDIUM confidence (commercial preset library, methodology inferred from descriptions)
- [LLM Token Optimization: Cut Costs & Latency — Redis](https://redis.io/blog/llm-token-optimization-speed-up-apps/) — HIGH confidence (Redis official blog, corroborated by multiple industry sources)
- [LLM Cost Optimization Complete Guide — Koombea AI](https://ai.koombea.com/blog/llm-cost-optimization) — MEDIUM confidence (industry guide, corroborated by official pricing docs)
- [Prompt Caching — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official Anthropic documentation)
- [Claude Models Overview + Pricing — Anthropic](https://docs.anthropic.com/en/docs/about-claude/pricing) — HIGH confidence (official Anthropic pricing)
- [Claude Haiku 4.5 Deep Dive — Caylent](https://caylent.com/blog/claude-haiku-4-5-deep-dive-cost-capabilities-and-the-multi-agent-opportunity) — MEDIUM confidence (editorial, pricing corroborated by official Anthropic docs)
- [Gemini API Pricing 2026 — MetaCTO](https://www.metacto.com/blogs/the-true-cost-of-google-gemini-a-guide-to-api-pricing-and-integration) — MEDIUM confidence (editorial, corroborated by Google pricing pages)
- [LLM Chat History Summarization Guide — Mem0](https://mem0.ai/blog/llm-chat-history-summarization-guide-2025) — MEDIUM confidence (vendor blog, corroborated by JetBrains research citation)
- [Efficient Context Management — JetBrains Research Blog](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) — HIGH confidence (published research, NeurIPS 2025 workshop)

---

*Feature research for: HelixTones v4.0 Preset Quality Leap + API Cost Optimization*
*Researched: 2026-03-04*
