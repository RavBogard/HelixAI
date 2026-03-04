# Pitfalls Research

**Domain:** Adding preset quality leap and API cost optimization to existing HelixTones planner-executor app
**Researched:** 2026-03-04
**Confidence:** HIGH for prompt engineering pitfalls (multiple studies, Anthropic docs); HIGH for parallel routing pitfalls (official Line 6 community + Helix manuals); MEDIUM for model-split routing risks (community reports, pricing docs, no HelixTones-specific data); HIGH for param engine over-engineering patterns (codebase analysis + software engineering research)

> This document supersedes the v3.0 pitfalls document (Stadium device addition). The focus here is the risks of improving preset quality and optimizing API costs in an app that already has a working Planner-Executor architecture. Previous pitfalls (device ID, file format, model catalog naming) are not repeated.

---

## Critical Pitfalls

These cause silent quality regressions, broken generation, or increased cost without benefit.

---

### Pitfall 1: Planner Prompt Bloat Degrades Structured Output Quality

**What goes wrong:**

The quality improvement goal involves enriching the ToneIntent prompting — adding richer creative guidelines, signal chain intelligence rules, effect interaction patterns, and advanced routing instructions to the planner system prompt. The trap is that adding more instructions to the planner prompt can degrade structured output compliance, not improve it.

Research from 2025/2026 (arxiv.org) shows that a "generic improved" prompt can cause extraction pass rate to drop from 100% to 90% and RAG compliance from 93.3% to 80% for structured output tasks. This is the "lost in the middle" effect: LLMs give less weight to information in the middle of long contexts compared to beginning and end. A planner prompt that was tuned to produce reliable ToneIntent JSON may start producing schema validation failures or low-quality creative selections when bloated with additional guidance.

The current planner prompt already works well. Adding 500+ tokens of additional creative guidelines without testing is gambling with structured output reliability.

**Why it happens:**

The instinct is "more context = better output." This is usually correct for conversational tasks but frequently wrong for structured output tasks where the model must adhere to a narrow schema. Instruction competition degrades compliance with format rules.

**How to avoid:**

- Benchmark the current planner prompt's quality baseline before changing anything (number of valid ToneIntent outputs, schema compliance rate, creative diversity across 10-20 test conversations)
- When adding new guidance, add one section at a time and retest — never batch multiple prompt changes
- Keep the prompt under 2,000 tokens total; if it exceeds this, prune lower-value sections
- If adding creative guidelines, put them BEFORE the schema field definitions, not after — the model weights instructions near the beginning more heavily
- Use the Anthropic structured output (`zodOutputFormat`) that already constrains decoding — this mitigates but does not eliminate the degradation risk

**Warning signs:**

- Schema validation failures start appearing in logs after a prompt update
- Generated ToneIntent objects are syntactically valid but creatively flat (same amp choices, same 3 effects every time)
- Effect role distribution skews — everything becomes "always_on", no "toggleable" or "ambient" choices
- `ampName` selections become repetitive (model falls back to "safe" choices it's seen often)

**Phase to address:** Quality research phase — establish a quality baseline and a prompt change protocol before any planner prompt modifications

---

### Pitfall 2: Parallel Path Generation Without Phase-Awareness Creates Unusable Presets

**What goes wrong:**

Advanced signal routing is one of the three quality dimensions for v4.0 — the goal is adding parallel paths and creative splits where appropriate. The trap is generating parallel path presets without encoding phase awareness into the chain rules. Helix parallel paths are notorious in the community for phase cancellation: when two amp paths are summed at the merge block, comb filtering and phase-induced frequency cancellations cause the combined tone to sound "hollow", "thin", or "back of the throat."

This happens systematically, not as a rare edge case. The Line 6 community (line6.com support forum) documents this as a recurring problem in dual-amp setups. When Path A has one amp and Path B has another, summing them at a merge block creates a phase conflict because the two amp models process the signal differently in time. The merged result sounds worse than either path alone.

The current chain rules generate clean series-path presets that work. Adding parallel paths without a phase inversion strategy ships broken presets.

**Why it happens:**

Parallel routing looks straightforward in the Helix block diagram — split, process, join. The phase behavior is invisible at the chain-rules level because it is a firmware/hardware artifact of how the DSP sums the two paths. The Knowledge Layer currently has no concept of phase.

**How to avoid:**

- Any parallel path in generated presets must include a Poly Capo or 6-tap Trem block set to 0 shift (used as a phase inverter), OR the chain rules must use the Split block's `Pan` parameter to offset the two paths and rely on user adjustment
- The safest approach is a wet/dry split pattern where Path B carries effects-only (delay, reverb, modulation at 100% wet mix) and Path A carries the dry amp signal — this avoids the dual-amp phase problem entirely
- Do NOT generate dual-amp parallel paths (two amp blocks, one per path) without explicit phase inversion logic in the chain rules
- For dual-amp presets (already supported in v2.0), verify that the existing split/join implementation does not produce phase cancellation before extending it to new routing patterns

**Warning signs:**

- Generated presets with two amp blocks on parallel paths and no explicit phase correction block
- Any `Split` block followed by two `amp` blocks (one each on Path A and B) without a `Phase Inverter` or equivalent in the chain spec
- Community reports that AI-generated parallel presets sound thin or hollow compared to the single-amp version of the same preset

**Phase to address:** Advanced routing phase — before implementing any parallel path generation, the chain rules must encode a phase-safe parallel routing pattern

---

### Pitfall 3: Model Split (Haiku Chat / Sonnet Generation) Breaks Prompt Cache Architecture

**What goes wrong:**

The cost optimization plan includes routing chat responses to Claude Haiku (cheap) and reserving Sonnet only for preset generation (expensive). This creates a subtle architectural problem: the current app uses prompt caching on the planner system prompt (buildPlannerPrompt) to achieve ~50% cost reduction. Introducing Haiku for chat means two separate API clients, two separate cache namespaces, and two separate billing streams — and the cached tokens for Sonnet generation no longer benefit from the conversational warm-up that was previously part of a single Sonnet session.

More critically: Anthropic changed prompt caching to workspace-level isolation (February 5, 2026). If the chat (Haiku) and generation (Sonnet) calls are made under different conditions, the Sonnet generation call may not benefit from a warm cache on the planner prompt the way it did when all calls used the same model.

The practical result: model split could increase Sonnet generation costs rather than reduce them, because the prompt cache hit rate for generation drops when chat no longer "primes" the same model's context.

**Why it happens:**

The prompt caching analysis typically looks at per-call token costs but doesn't model the interaction between cache warm-up patterns and model routing. When chat and generation both used Sonnet, the planner prompt cache was reliably warm by the time generation was called. With Haiku handling chat, the Sonnet planner prompt may start cold for every generation call.

**How to avoid:**

- Before implementing model split, run a cost audit that separates chat token costs from generation token costs — the audit may show that chat is already cheap enough that the savings from Haiku routing don't justify the complexity
- Measure actual Sonnet planner prompt cache hit rate using `cache_read_input_tokens` in the API response — if it is already >80%, the cache is working well and splitting to Haiku does not improve it
- If model split is implemented: verify the planner system prompt cache warms correctly on the first Sonnet call each session regardless of how many Haiku chat calls preceded it
- Introduce model split behind a feature flag that defaults to OFF — measure quality and cost impact for 7 days before making it the default

**Warning signs:**

- Chat response quality degrades (Haiku is noticeably less nuanced in tone interview questions)
- `cache_read_input_tokens` in Sonnet generation responses drops after the model split is deployed
- API cost per generation increases rather than decreases after model split (indicates cache miss rate increased)
- Errors in model selection logic cause Sonnet to be called for chat or Haiku to be called for generation

**Phase to address:** API cost audit phase (assess before implementing) and model split implementation phase (validate with live metrics after)

---

### Pitfall 4: Param Engine Category Defaults Override Model-Specific Nuance

**What goes wrong:**

The param engine uses a 3-layer strategy: model defaults → category overrides → topology override. The quality improvement goal includes more nuanced parameter resolution — "surgical knob values" that reflect what specific amps actually need. The trap is adding more aggressive category overrides that stomp on model-specific defaults, producing presets that are technically correct for the category but not voiced correctly for the specific amp.

For example: the current `high_gain` category default sets `Drive: 0.40`. A Mesa Mark IV (Placater Dirty) runs best at `Drive: 0.55-0.65` — the lower drive loses the characteristic chewy midrange. If the category override applies `0.40` unconditionally, every high-gain amp sounds under-driven regardless of its actual character.

The current Layer 2 comment says "Only override keys that exist in category defaults / preserves model-specific params like Cut, Deep, Resonance, BrightSwitch" — but it still overwrites Drive, Master, ChVol, Sag, Bias for every amp in the category. Any quality improvement that adds more category-level overrides deepens this problem.

**Why it happens:**

Category defaults are easy to tune in aggregate (tune once, apply to all). Per-model defaults require per-model knowledge. The quality gap between HelixTones presets and professional presets is not primarily in the category layer — it is in the model-specific calibration that professional preset makers apply per-amp. Improving the category layer is faster but does not close the gap.

**How to avoid:**

- Add a Layer 1.5: per-model overrides that sit between model defaults and category defaults, containing amp-specific calibrations that the category should not overwrite (e.g., `Drive` and `Sag` per-amp, not per-category)
- Research the Tonevault 250-preset analysis and identify which amp-specific param ranges deviate from the current category defaults — these deviations ARE the quality improvement
- Never change a category default without checking how many amp models the change affects and whether each amp benefits from the change
- Test with at least 3 amps per category (clean/crunch/high_gain) when changing any category-level parameter

**Warning signs:**

- All amps in a category produce similar Drive/Sag settings regardless of the amp model's character
- High-gain amps that naturally want more Drive (Rectifier, Mark series) are being under-driven by the category default
- Clean amps that want high Master (Fender Blackface) are being pushed to moderate Master by category override

**Phase to address:** Param engine improvement phase — per-model calibration research should precede any param engine changes

---

### Pitfall 5: Community Preset Reverse-Engineering Without Hardware Validation

**What goes wrong:**

The quality research plan involves studying top community presets to reverse-engineer what premium preset makers do differently. The trap is extracting patterns from community preset files, encoding them into the Knowledge Layer, and deploying without hardware validation. Community presets (from CustomTone, ToneFactor, etc.) are optimized for specific output scenarios: studio monitors (FRFR), headphones, or live PA. Parameters that make a preset sound great through FRFR often sound terrible through a regular guitar cab, and vice versa.

Additionally, community presets frequently include output-level calibration (Gain Block, post-EQ) specific to the preset creator's monitoring setup. Copying these levels without testing on representative outputs produces presets that are too loud, too quiet, or incorrectly EQ'd for the user's context.

**Why it happens:**

Pattern extraction from data (preset files) is seductive because it looks scientific. But the preset parameters encode not just tonal intention but also the output chain correction for a specific monitoring setup. The "pattern" mixes tonal choice with output compensation in a way that is not visible from the file alone.

**How to avoid:**

- When extracting patterns from community presets, focus on mid-chain parameters (amp Drive, Sag, Bias, eq bands) and ignore post-cab parameters (Gain Block level, master output) unless there is a consistent pattern with a clear tonal rationale
- Any pattern extracted from community presets must be validated on hardware (Helix LT or Pod Go) before encoding into the Knowledge Layer — not just confirmed in the code
- Specifically test: does the extracted pattern produce better results than the current defaults when played through FRFR, when going direct to DAW, and when used with headphones?
- Mark extracted patterns with their source confidence: "pattern from 50+ presets" vs "pattern from 3 presets" — only encode the former into defaults

**Warning signs:**

- Post-cab Gain Block levels imported from community presets without normalization
- CAB_PARAMS LowCut/HighCut values that deviate significantly from the current 80-100Hz / 5-8kHz range without a tested rationale
- Output levels in generated presets that require significant adjustment before the preset is usable
- No hardware testing step in the quality improvement plan before shipping

**Phase to address:** Quality research phase — establish validation protocol before extracting patterns from community presets

---

### Pitfall 6: Effect Combination Rules That Conflict With Block Budget

**What goes wrong:**

The quality improvement goal includes "smarter effect combinations and interactions" — effects that work together tonally rather than just being individually good. A risk is encoding effect combination rules (e.g., "always pair pitch shift with reverb for shimmer", "use compressor before delay for tighter echoes") that exceed the block budget on constrained devices.

HX Stomp/XL has a 6-block limit. If the chain rules generate a "quality" effect combination pattern that uses 5 blocks, there is no room left for the amp, cab, or other mandatory blocks. The chain rules currently enforce block limits per device, but effect combination rules that assume a generous block budget (Helix LT/Floor) will silently produce valid-looking chains that overflow on Stomp/XL.

The mandatory blocks already consume 3-4 slots (amp, cab, gate, boost, EQ). On HX Stomp/XL that leaves 2-3 user effect slots. Any "smarter effect combination" pattern that assumes 4+ user effect slots is Stomp-incompatible.

**Why it happens:**

Quality research focuses on what sounds best without always modeling device constraints. A "shimmer reverb + pitch + delay + modulation" combination that sounds great on Helix LT (plenty of blocks) breaks on HX Stomp (block budget exhausted).

**How to avoid:**

- All new effect combination patterns must be classified by minimum block budget required
- Chain rules must check device block budget BEFORE inserting optional combination patterns — if the combination won't fit, fall back to the simpler single-effect choice
- Test every new effect combination pattern on all 6 supported devices (Helix LT, Helix Floor, Pod Go, Helix Stadium, HX Stomp, HX Stomp XL) in a single validation pass
- Encode effect combination patterns as optional suggestions, not mandatory insertions — mandatory insertions cannot be suppressed when block budget is tight

**Warning signs:**

- Generated HX Stomp presets with more than 6 blocks total (impossible to load on hardware)
- Chain rules that reference maximum block counts from Helix LT constants when building Stomp presets
- Effect combination patterns that include 3+ user effects without a device-specific block budget check

**Phase to address:** Chain rules improvement phase — block budget checks must be in place before new combination patterns are added

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add all creative guidelines to the planner prompt in one update | Faster iteration | Structured output compliance degrades unpredictably; hard to isolate which change caused regression | Never — one change at a time, with testing |
| Copy community preset param values directly into `AMP_DEFAULTS` without per-amp research | Quick quality improvements | Category defaults override model-specific nuance; all amps in category drift to copied values | Never — research per-amp calibration, not category averages |
| Route chat to Haiku without measuring Sonnet planner cache hit rate first | Immediate cost reduction | Sonnet generation cache goes cold; generation cost increases; net cost may increase | Never without pre-measuring cache hit rate |
| Implement parallel routing for all applicable presets simultaneously | Comprehensive routing improvement | Phase cancellation on dual-amp presets; no easy rollback path | Never — implement one routing pattern at a time, with hardware test |
| Add effect combination rules only for Helix LT (has generous block budget) | Simple to implement | Combination rules silently break Stomp presets; generates presets that can't load | Never — all combination rules must be device-aware |
| Use the same genreHint parsing for advanced routing decisions | Reuses existing infrastructure | Genre hint is a freeform string with no guaranteed tokens; routing decisions need more structured input | Acceptable for simple routing guidance; not acceptable for block count decisions |

---

## Integration Gotchas

Common mistakes when modifying the existing planner-executor integration.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Prompt caching (planner system prompt) | Adding a rig context string to the system prompt breaks caching | Rig context already appended to user message only (not system prompt) — maintain this pattern for any new dynamic content |
| Haiku model routing | Using different model for chat and generation with a single API client instance | Two separate client instances or a routing wrapper that selects model per call type; verify cache hit metrics after deployment |
| ToneIntent schema expansion | Adding new optional fields to ToneIntentSchema invalidates prompt caching if the schema enum appears in the system prompt model list | The planner prompt includes `getModelListForPrompt()` output — any change to model list breaks the cache; benchmark cache hit rate before and after |
| Effect combination rules in chain-rules.ts | Combination rules that call `isStadium()` for Stadium-specific patterns but forget to also check `isStomp()` | All device predicates must be checked when adding device-specific logic — add `isStomp()` alongside `isStadium()` checks |
| Per-model param calibration in param-engine.ts | New per-model overrides in `resolveAmpParams()` that use model name strings instead of model IDs | The function currently dispatches on `block.modelId` for distortion and dynamics; amp resolution uses `AMP_MODELS[intent.ampName]` — use the same consistent key strategy |
| Haiku for chat quality check | Assuming Haiku will produce the same tone interview quality as Sonnet without testing | Run 10-20 full tone interview conversations using Haiku before committing to the split; check for follow-up question quality, contextual awareness, and rig description handling |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Planner prompt exceeds cache prefix size | Cache hit rate drops; token costs rise; `cache_read_input_tokens` goes to 0 | Keep static planner system prompt under 2,000 tokens; move dynamic content to user message | When prompt grows past ~4,096 tokens (rough threshold for cache prefix efficiency) |
| Effect combination research causes param-engine.ts to grow unbounded | Resolving parameters takes longer; file becomes hard to maintain | Separate combination research findings into a dedicated `effect-combinations.ts` module; keep param-engine.ts focused on parameter values only | As soon as combination logic and parameter logic share one file — maintenance cost compounds |
| Community preset analysis adds too many model-specific overrides | `AMP_DEFAULTS` table becomes unmaintainable; edge cases conflict | Limit per-model overrides to amps that appear in >5% of community presets; ignore outliers | When the override table exceeds 20-30 entries without a clear ownership/testing protocol |
| Model split creates two billing streams with no unified cost monitoring | Can't tell if the split is saving or costing money | Add per-call logging of `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` for both Haiku and Sonnet calls | Immediately after model split is deployed — without logging, ROI is unknown |

---

## Security Mistakes

Domain-specific security issues for this milestone.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sending model name as a user-controlled parameter for model split | User crafts a request that forces Sonnet for all chat calls, eliminating the cost benefit | Model selection must be server-side only, not derived from any request parameter |
| Logging full ToneIntent responses for quality analysis | Logs contain user conversation content (rig descriptions, tone preferences); privacy risk | Log ToneIntent schema compliance and metadata (ampName, effect count, snapshot count) but not the full conversation content |

---

## UX Pitfalls

Common user experience mistakes specific to quality improvement and cost optimization.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Quality improvement makes presets more complex but less playable | Presets with parallel paths, more effects, and advanced routing are harder to understand and tweak | Every quality improvement must maintain or improve the "first-sound experience" — the preset must sound good the moment it loads, without any user adjustment |
| Haiku chat asks fewer clarifying questions than Sonnet | Users get less personalized presets because the tone interview is shorter/shallower | If Haiku is adopted for chat, extend the system prompt to compensate for the quality delta; add explicit instructions about follow-up question depth |
| Preset names become generic after quality improvements | When focusing on signal chain quality, preset naming creativity often degrades | Preset name is a ToneIntent field — include it in quality benchmarking alongside signal chain metrics |
| Advanced routing presets confuse users who want simple patches | A parallel-path dual-amp preset with 12 blocks is intimidating to a player who just wants "classic rock tone" | Gate advanced routing behind explicit user signals (user asks for "complex tone" or "studio sound") — do not add routing complexity unless the conversation warrants it |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Quality improvement shipped:** Verify it was tested on actual hardware (Helix LT or Pod Go), not just confirmed that the JSON file structure looks correct
- [ ] **Planner prompt changes:** Verify the planner prompt change did not increase schema validation failure rate — run 20 test generations and count failures
- [ ] **Parallel routing:** Verify no generated preset has two amp blocks on parallel paths without a phase-aware merge pattern — run chain-rules.test.ts
- [ ] **Model split deployed:** Verify `cache_read_input_tokens` in Sonnet generation calls is non-zero — if it's zero, the cache is cold and costs are rising
- [ ] **Block budget on Stomp:** Verify any new effect combination pattern passes block budget validation for HX Stomp (6 blocks max) and HX Stomp XL — not just for Helix LT
- [ ] **Per-model param calibration:** Verify at least 3 amps per category (clean, crunch, high_gain) were tested with the new defaults before shipping
- [ ] **Cost audit complete:** Verify the audit distinguishes chat token costs from generation token costs — a blended average obscures where the money actually goes
- [ ] **Community preset research:** Verify extracted patterns were tested on hardware before being encoded into the Knowledge Layer

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Planner prompt bloat causes schema validation failures | LOW | Roll back the prompt to the last working version; add guidance incrementally with testing |
| Parallel routing causes phase cancellation in shipped presets | MEDIUM | Add a phase-invert block to the affected routing patterns; redeploy; existing broken presets cannot be auto-corrected but new generations will be correct |
| Model split increases Sonnet generation costs | LOW | Disable model split; return to all-Sonnet; analyze cache hit rate data to understand why |
| Category defaults override model-specific nuance across many amps | MEDIUM | Add per-model override layer to param-engine.ts; requires per-amp research; no quick fix |
| Effect combination rules overflow block budget on Stomp | LOW | Make combination rule optional and add device check; generated Stomp presets fall back to simpler chain automatically |
| Community preset params produce output-level mismatches for users | MEDIUM | Normalize post-cab Gain Block values to 0.0dB (unity); ship EQ params only; never include preset-specific level corrections |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Planner prompt bloat degrades structured output | Quality research / baseline establishment phase | 20-generation test suite run before and after any prompt change; schema failure rate must not increase |
| Parallel routing creates phase cancellation | Advanced routing design phase | chain-rules.test.ts includes test for dual-path parallel preset: assert no dual-amp parallel without phase correction |
| Model split breaks prompt cache architecture | API cost audit phase (analyze before implementing) | `cache_read_input_tokens` logged and non-zero for Sonnet generation calls post-split |
| Category defaults override model-specific nuance | Param engine calibration phase | 3 amps per category tested on hardware before param change ships |
| Community preset research without hardware validation | Quality research protocol phase | Validation step required for each new default: "tested on Helix LT on DATE" comment in param-engine.ts |
| Effect combinations overflow block budget on Stomp | Chain rules improvement phase | New combination patterns tested against all 6 device types in chain-rules.test.ts |
| Haiku chat quality degradation | Model split evaluation phase | 10-conversation blind quality comparison between Haiku and Sonnet chat before committing to split |

---

## The Quality Research Protocol

The community preset reverse-engineering goal requires a disciplined research process to avoid encoding bad data.

### Step 1: Identify Source Presets
Use presets that are explicitly marked as professional/commercial (ToneFactor, Glenn DeLaune, M. Britt, Alex Price) — not arbitrary community uploads. These represent deliberate quality engineering, not casual experiments.

### Step 2: Extract Mid-Chain Parameters Only
From each preset, extract amp Drive, Sag, Bias, Bass, Mid, Treble, Presence, Master, and cab LowCut/HighCut. Do NOT extract Gain Block levels, output levels, or global EQ — these are output-chain corrections, not tonal choices.

### Step 3: Group by Amp Model
Group extracted parameters by the exact amp model name. Patterns that only appear for one amp model may be idiosyncratic to that preset maker's setup, not a universal quality insight.

### Step 4: Calculate the Deviation From Current Defaults
For each parameter, calculate: `actual_value - current_AMP_DEFAULT[category][param]`. A deviation larger than 0.15 (on the 0-1 scale) represents a meaningful pattern worth investigating.

### Step 5: Hardware Validate Before Encoding
Before adding any extracted value to `AMP_DEFAULTS` or a new per-model override, play the modified preset through Helix LT and confirm the change sounds better. Do not ship any param change that was only verified in code review.

### Step 6: Comment the Source in Code

```typescript
// CORRECT — cite source
high_gain: {
  Drive: 0.52, // Range 0.40-0.65 from ToneFactor/M.Britt analysis (35 presets); tested LT 2026-03-XX
  ...
}

// WRONG — cite nothing
high_gain: {
  Drive: 0.52, // feels better
}
```

---

## Sources

### HIGH confidence (official documentation)
- Anthropic prompt caching docs (2026): https://platform.claude.com/docs/en/build-with-claude/prompt-caching — cache structure, workspace isolation, pricing multipliers
- Anthropic token-saving updates: https://claude.com/blog/token-saving-updates — batch API, prompt caching mechanics
- Line 6 Helix Parallel Split/Summing issues (community support forum): https://line6.com/support/topic/56905-parallel-splitsumming-wetdry-issues/ — phase cancellation documented
- Line 6 Phase issue with two amp blocks: https://line6.com/support/topic/58405-phase-issue-with-two-amp-blocks-one-path-each/ — dual-amp phase conflict

### HIGH confidence (research/empirical studies)
- "When Better Prompts Hurt: Evaluation-Driven Iteration" (arxiv 2025): https://arxiv.org/html/2601.22025v1 — structured output regression from prompt changes
- MLOps Community — Prompt Bloat impact on LLM output quality: https://mlops.community/the-impact-of-prompt-bloat-on-llm-output-quality/ — "lost in the middle" effect

### MEDIUM confidence (community analysis, verified against multiple sources)
- Tonevault "Dialing in your Helix amps: what the top 250 presets teach us": https://www.tonevault.io/blog/250-helix-amps-analyzed — Scream 808 in 71% of presets, amp param ranges
- Sweetwater "Creating Studio-quality Guitar Modeler Patches": https://www.sweetwater.com/insync/creating-studio-quality-guitar-modeler-patches-and-presets/ — signal chain design principles
- Claude API pricing guide (2026): https://devtk.ai/en/blog/claude-api-pricing-guide-2026/ — Haiku vs Sonnet pricing, quality tradeoffs
- Claude Haiku 4.5 vs Sonnet 4.5 comparison: https://chatlyai.app/blog/claude-haiku-4-5-vs-claude-sonnet-4-5 — performance within 5 percentage points on many benchmarks
- Parallel routing (cosmicloopfx.com): https://www.cosmicloopfx.com/post/unlocking-new-sounds-creative-ways-to-use-parallel-routing — practical parallel routing patterns
- Helix wet/dry/wet setup guide: https://l6c-acdn2.line6.net/data/6/0a020a3e512958ffc36d4aa36/application/pdf/helix-blog-wet-dry-wet.pdf — official Line 6 parallel path design

### LOW confidence (single source, unverified)
- LLM2Fx framework for audio effect parameter prediction from natural language (arxiv 2025): https://arxiv.org/html/2505.20770v1 — research on LLMs predicting audio effect params; not directly applicable but confirms the problem space is active

---

*Pitfalls research for: HelixTones v4.0 — Preset Quality Leap and API Cost Optimization*
*Researched: 2026-03-04*
