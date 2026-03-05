# Pitfalls Research

**Domain:** HelixTones v4.0 — Stadium .hsp rebuild, preset quality improvements, per-model param overrides, device abstraction refactor, AI model routing split, shared Knowledge Layer modification
**Researched:** 2026-03-05
**Confidence:** HIGH — based on direct codebase inspection (stadium-builder.ts, param-engine.ts, chain-rules.ts, planner.ts, config.ts, tone-intent.ts, models.ts), real .hsp reference files (Cranked_2203.hsp, Rev_120_Purple_Recto.hsp), existing bug history (dual-DSP key collision, Stadium amp lookup failure documented in PROJECT.md), architectural CONCERNS audit (2026-03-02), and official Anthropic prompt caching documentation.

> This document covers v4.0 pitfalls across two dimensions: (A) codebase-specific pitfalls discovered from direct source inspection and real .hsp file analysis, and (B) architectural pitfalls from prompt engineering research, community analysis, and routing patterns. Both dimensions are required for safe v4.0 execution.

---

## Critical Pitfalls

### Pitfall 1: Stadium Agoura Amps Use Non-Standard Parameter Keys That the Category Overlay Ignores

**What goes wrong:**
The Agoura amp models (Stadium-exclusive) contain parameters absent from all standard Helix amps: `ZPrePost`, `Jack`, `Hype`, `Level`, `AmpCabPeak2Fc`, `AmpCabPeak2G`, `AmpCabPeak2Q`, `AmpCabPeakFc`, `AmpCabPeakG`, `AmpCabPeakQ`, `AmpCabShelfF`, `AmpCabShelfG`, `AmpCabZFir`, `AmpCabZUpdate`. The `AMP_DEFAULTS` category tables in `param-engine.ts` cover only the standard Helix set (Drive, Master, Bass, Mid, Treble, Presence, Sag, Hum, Ripple, BiasX). When `resolveAmpParams()` applies the category overlay to an Agoura amp, those extra parameters receive no category-level value — they rely entirely on `model.defaultParams` in `STADIUM_AMPS`.

Confirmed from `real-cranked-2203-pretty.json`: `Agoura_AmpBrit2203MV` requires `ZPrePost: 0.81`, `Jack: 1` (integer enum, not float), `Hype: 0.26`, `Level: -10.0`, `Sag: 0.0`, `Ripple: 0.0`. The standard high_gain category defaults are `Sag: 0.25`, `Ripple: 0.05`, `Master: 0.45` — all wrong for this amp. If `STADIUM_AMPS` entries were estimated rather than extracted from real .hsp files, every generated Stadium preset has systematically wrong amp parameters on hardware.

**Why it happens:**
`resolveAmpParams()` applies `AMP_DEFAULTS[ampCategory]` unconditionally over model defaults. For Agoura amps, this overwrites the correct Sag/Ripple values with category values that were derived from HD2_* model analysis. There is no guard that says "for Stadium amps, preserve model defaults for keys not in the shared param set."

**How to avoid:**
For every Agoura amp in `STADIUM_AMPS`, extract `defaultParams` directly from real .hsp files — not by estimation. `Level` is in dB (not normalized 0-1). `Jack` is an integer. `AmpCab*` keys are EQ parameters baked into the amp model. Create a separate `STADIUM_AMP_DEFAULTS` table covering only the keys verified to be shared between Agoura and HD2_* amp models, or gate the category overlay with a `model.stadiumOnly` flag check to skip incompatible keys.

**Warning signs:**
- Stadium preset sounds muddy or over-compressed (Level param at 0 instead of -10 dB shifts output level by 10 dB)
- Stadium preset loads but amp sounds thin (AmpCab* EQ params absent, defaulting to firmware zero values)
- `Jack: 0.0` in generated output instead of `Jack: 1` (integer) — firmware may reject non-integer enum

**Phase to address:**
Stadium builder rebuild phase — validate every Agoura amp's `defaultParams` against real .hsp files before any generation attempt.

---

### Pitfall 2: Stadium Cab Params Are a Partial Schema — Missing Delay, IrData, Level, Pan, Position

**What goes wrong:**
Real .hsp inspection of `Cranked_2203.hsp` shows the Stadium cab block (`HD2_CabMicIr_4x121960AT75WithPan`) includes `Delay`, `IrData`, `Level`, `Pan`, `Position` — not present in the current `resolveCabParams()` implementation. The current code only emits `LowCut`, `HighCut`, `Mic`, `Distance`, `Angle`. The builder wraps whatever `resolveCabParams()` returns in the `{ access, value }` slot format, so the generated .hsp cab block will be missing required firmware params.

More critically: the real .hsp shows Stadium cabs with `LowCut: 19.9 Hz` (near-zero — cab model handles its own filtering). The current `CAB_PARAMS` table sets `LowCut: 100 Hz` for high_gain cabs. Generated Stadium presets will over-filter low end, causing thin bass response that conflicts with the Stadium hardware's actual behavior.

**Why it happens:**
`resolveCabParams()` was built from Helix LT/Floor format knowledge. Stadium cabs use the same `HD2_CabMicIr_*WithPan` model family but in .hsp slot-based format, and those models have additional params not exposed in the .hlx format. The cab schema difference was not discovered during v3.0 development because only 2 real .hsp files were used for reference, and the param comparison was focused on structure, not completeness.

**How to avoid:**
Read the full param set for a Stadium cab block from a real .hsp file and update `CAB_MODELS` defaultParams for `HD2_CabMicIr_*WithPan` models to include all six params: `LowCut`, `HighCut`, `Mic`, `Distance`, `Angle`, `Delay`, `IrData`, `Level`, `Pan`, `Position`. Add a Stadium-specific cab param resolver path in `resolveCabParams()` gated on `isStadium(device)` if Stadium needs different default LowCut/HighCut values than Helix.

**Warning signs:**
- Generated .hsp cab block has 5 params; reference .hsp has 10 params — field count mismatch visible in diff
- Stadium preset loads but bass sounds filtered or thin relative to factory presets
- Preset validator passes (cab param completeness is not validated) but hardware behavior differs from expected

**Phase to address:**
Stadium builder rebuild phase — do a field-by-field param comparison between generated and reference .hsp for every block type before marking Stadium unblocked.

---

### Pitfall 3: Prompt Enrichment Invalidates the Prompt Cache Token Boundary

**What goes wrong:**
The planner system prompt is cached via `cache_control: { type: "ephemeral" }`. Any character-level change to the system prompt text — including appending gain-staging rules, cab pairing heuristics, or effect discipline guidance — creates a new cache bucket and invalidates the existing one. The first request after a deploy pays full input token cost (`cache_creation_input_tokens`), and the cache only repopulates after sufficient reuse.

The more serious failure mode: enrichment that inserts device-specific text inside the existing `if (stadium)` / `if (podGo)` conditional blocks in `buildPlannerPrompt()` means every device variant now has a larger, different prompt. If the shared static prefix (the first 90% of the prompt that was previously identical across all devices) gains conditionally-inserted content that varies by device, there are now 6 separate cache buckets — each with lower hit frequency — potentially eliminating cache savings entirely.

**Why it happens:**
`buildPlannerPrompt(modelList, device)` builds the prompt string at call time. The cache key is the full content. Developers adding enrichment naturally reach for the section they're modifying (e.g., the stadium block) without modeling the cache fragmentation impact. Prompt caching ROI analysis typically looks at per-call token costs, not at the interaction between content placement and cache bucket multiplicity.

**How to avoid:**
Treat the system prompt like a compiled binary with a stable shared prefix. New enrichment content (gain-staging rules, cab affinity guidance, effect discipline) belongs in the shared static section that is identical across all devices — generic enough to apply everywhere. Device-specific text must remain in the `if (device)` blocks that are already at the end of the prompt. Rule: the first ~70% of the prompt must be character-for-character identical for all 6 device calls.

Before any prompt change: use the existing token usage logger (`usage-logger.ts`) to measure current cache hit rate as baseline. After deploy, verify cache hit rate is within 5% of baseline. Any drop larger than that indicates cache fragmentation.

**Warning signs:**
- `cache_read_input_tokens` drops to zero after a deploy (cache miss)
- `cache_creation_input_tokens` spikes in the usage log after any prompt change
- Cost per generation doubles unexpectedly post-deploy

**Phase to address:**
Planner prompt enrichment phase — restructure `buildPlannerPrompt` so new content can be appended to stable sections before adding any enrichment text.

---

### Pitfall 4: Per-Model Amp Overrides Are Silently Discarded by Category Defaults

**What goes wrong:**
`resolveAmpParams()` applies a 3-layer strategy: (1) model `defaultParams`, (2) `AMP_DEFAULTS[ampCategory]` category overlay, (3) topology mid override. Layer 2 iterates `AMP_DEFAULTS[category]` and unconditionally writes each key into `params`. If a per-model override is added at Layer 1 (model `defaultParams`) for a value that is also in Layer 2 (`AMP_DEFAULTS`), the override is silently discarded — the category default wins.

Example: the Litigator (`HD2_AmpIndyHardCorePre`) is a crunch amp that sounds best with `Drive: 0.35-0.40`. The crunch category default is `Drive: 0.50`. If a per-model override for Drive is added to `defaultParams`, it is overwritten back to 0.50 by Layer 2. The override exists in the code but has no effect on output. Developers investigating why the override doesn't work will waste time before discovering the layer ordering.

**Why it happens:**
The 3-layer resolution strategy was designed to enable category consistency, not per-model precision. Developers adding per-model quality improvements naturally reach for `model.defaultParams`, not realizing that Layer 2 clobbers any key present in both. There is no TypeScript error, no warning, no unit test failure — the override silently loses.

**How to avoid:**
Introduce a fourth layer: `model.paramOverrides` field on `HelixModel`, applied AFTER category defaults. Resolution order: (1) model defaultParams, (2) category defaults, (3) topology mid, (4) model paramOverrides. Layer 4 wins over all shared layers. This makes the override mechanism explicit and visible in the model definition.

Alternatively, add a `lockedParams` set to each model listing param keys that the category overlay must not touch. But the separate `paramOverrides` field is cleaner.

**Warning signs:**
- A `HelixModel.defaultParams` entry has a Drive/Master/Bias value that differs from the category default, but resolved presets always show the category default value
- Unit test for a per-model override passes in isolation (calling model lookup directly) but the integration output shows the category value
- Reviewing the generated preset file shows the amp block using category default values despite model-specific intent

**Phase to address:**
Per-model amp parameter overrides phase — establish the 4-layer override mechanism BEFORE adding individual model-specific values, to prevent silent-discard bugs.

---

### Pitfall 5: Device Abstraction Refactor Breaks Exclusion Guards Via Silent Capability Gaps

**What goes wrong:**
The codebase has 14+ explicit `isStadium(device)`, `isStomp(device)`, `isPodGo(device)` guards in `chain-rules.ts`, `param-engine.ts`, `planner.ts`, and the generate route. A device abstraction refactor that introduces a capability object or strategy pattern risks breaking these guards if: (a) the capability object is opt-in (new capabilities default to `true`) rather than explicit (each device declares every capability), or (b) the refactor converts some guards to capability checks but leaves others as `is*()` calls, creating inconsistency.

The failure mode is silent: TypeScript does not complain if a capability flag is missing from a new device's config — it just returns `undefined` (falsy), which could accidentally allow or block the wrong behavior. For example, if `capabilities.postCabEq` is missing from a device config, `if (capabilities.postCabEq)` evaluates false, silently skipping the mandatory Parametric EQ insertion for that device.

**Why it happens:**
Refactors that convert boolean-function guards to object properties often use "present = enabled" semantics. If a device config object is created by adding known capabilities, any capability not explicitly set is implicitly absent (disabled). For capabilities that should be ENABLED by default (e.g., all Helix devices support dsp1), this "false by default" inversion causes bugs that only manifest when generating presets for specific devices.

**How to avoid:**
Define `DeviceCapabilities` as a fully required interface — no optional fields. Every device must declare every capability explicitly. TypeScript enforces completeness: adding a new capability to the interface makes every device config a compile error until updated. Use an "opt-in" pattern: all capabilities are `false` unless explicitly set `true`. Only devices that have been verified to support a capability get it enabled.

Do this refactor in a dedicated architecture phase, not combined with any feature work. The refactor must not change behavior — only the mechanism for expressing it.

**Warning signs:**
- A new device passes all existing tests but generates presets that fail hardware import
- `chain-rules.ts` or `param-engine.ts` tests pass for 5 devices but the 6th device was not added to the test matrix
- Stomp preset generates 7 blocks (one over the 6-block limit) without a validation error

**Phase to address:**
Architecture review / device abstraction phase — must be a standalone phase before any feature changes to chain rules or param engine.

---

### Pitfall 6: AI Chat Model Split Degrades Tone Interview Quality Without Measurable Warning

**What goes wrong:**
Routing chat to Haiku (cheaper/faster) and generation to Sonnet splits the conversation pipeline. The risk is that Haiku gathers less specific tone information during the interview — shorter follow-up questions, less artist/rig detail, more generic responses — and the Planner receives a lower-quality conversation to translate into ToneIntent. Users experience this as "the AI understood me less" even though the generation step itself is unchanged.

The quality degradation is not immediately measurable: it shows up as slightly more generic `ampName` choices, vaguer `genreHint` strings, or less useful `guitarNotes`. These metrics require deliberate benchmarking to detect — a simple cost measurement will show savings without revealing the quality cost.

Additionally: the Sonnet planner prompt cache is warm when Sonnet handles both chat and generation (prior conversation calls prime the context). With Haiku handling chat, the first Sonnet generation call in each session starts cold, potentially increasing `cache_creation_input_tokens` per generation.

**Why it happens:**
Model routing decisions are made on latency and cost metrics, both of which improve with Haiku. Quality metrics (interview specificity, ToneIntent diversity) require subjective evaluation and deliberate A/B testing — work that is easy to skip when cost savings are obvious and immediate.

**How to avoid:**
Before deploying Haiku for chat, run 15 parallel tone interviews with identical conversation starters using both Haiku and the current model. Evaluate the ToneIntents produced: are `ampName` choices as specific? Are `guitarNotes` as useful? Are `genreHint` values as concrete? Only ship if ToneIntent quality is within acceptable thresholds. Use the existing 36-preset deterministic baseline generator (v3.2) as a quality floor.

Separately: measure current Sonnet `cache_read_input_tokens` hit rate before any model split. If hit rate drops after splitting, route only initial greeting turns to Haiku and hand off to Sonnet when the conversation becomes gear-specific.

**Warning signs:**
- ToneIntent `ampName` selections cluster toward 3-4 common amps in Haiku-interviewed sessions but show wider distribution in Sonnet sessions
- `guitarNotes` field is often empty or formulaic ("Use neck pickup for warm tone")
- `cache_read_input_tokens` in Sonnet generation responses drops to zero after model split
- Session-level API cost increases (Sonnet generation cache misses offset Haiku chat savings)

**Phase to address:**
Cost-aware model routing phase — requires a side-by-side quality comparison gate before shipping; cost measurement alone is insufficient.

---

### Pitfall 7: Shared Knowledge Layer Changes Regress Working Devices

**What goes wrong:**
`chain-rules.ts` and `param-engine.ts` are shared across all 6 devices. Any change to these files — adding a new chain slot, changing a category default, modifying a DSP assignment — affects all devices simultaneously. A change that improves Stadium preset quality can silently regress Helix LT presets if the change touches code paths exercised by both.

The specific risk for v4.0: adding per-model param overrides to `param-engine.ts` changes the resolution path for `resolveAmpParams()`. A bug in the new override logic (e.g., it looks up by `block.modelName` but the amp block has `modelId` not `modelName`) will cause every amp's parameter resolution to throw, breaking all 6 devices simultaneously on production.

**Why it happens:**
Shared code is fast to change but high-impact to break. The 6-device test matrix is large and easy to partially test (developers test the device they're working on and forget to verify the others). Changes that add new code paths feel safe because they don't touch existing paths — but a new code path with an uncaught exception in the shared resolver kills the shared function for all devices.

**How to avoid:**
For any change to `chain-rules.ts` or `param-engine.ts`:
1. Run the full device test matrix (all 6 devices, not just the target device) before merging
2. Any new code path (e.g., `if (model.paramOverrides)`) must be guarded against missing data: `model.paramOverrides ?? {}` not bare access
3. Architectural changes (new layers, new resolution strategies) must be added as NEW code paths that fall through to the existing behavior when not configured — never modify the existing path

When modifying `AMP_DEFAULTS`, verify the change with 3 amps per category (clean/crunch/high_gain) for at least Helix LT and Stomp (the two devices with the most different block budgets).

**Warning signs:**
- A PR to `param-engine.ts` that only includes tests for one device
- An exception thrown in `resolveAmpParams()` for a specific amp that had no previous issues
- `chain-rules.ts` tests pass for Helix LT but no tests cover Pod Go or Stomp
- A new field added to `HelixModel` that is accessed without null checking in the shared resolution path

**Phase to address:**
Every phase that touches `chain-rules.ts` or `param-engine.ts` — establish the 6-device test matrix rule as a hard gate before any shared Knowledge Layer change ships.

---

### Pitfall 8: Planner Prompt Bloat Degrades Structured Output Compliance

**What goes wrong:**
Adding richer creative guidelines, signal chain intelligence rules, and effect interaction patterns to the planner system prompt can degrade structured output compliance, not improve it. Research shows that "generic improved" prompts can cause extraction pass rates to drop from 100% to 90% and RAG compliance from 93.3% to 80% for structured output tasks (arxiv 2025, "When Better Prompts Hurt"). This is the "lost in the middle" effect: LLMs give less weight to information in the middle of long contexts. A planner prompt tuned for reliable ToneIntent JSON may start producing schema validation failures when bloated with additional guidance.

The current `buildPlannerPrompt()` already works well. Adding 500+ tokens of creative guidelines without testing is gambling with structured output reliability on every generation.

**Why it happens:**
The instinct is "more context = better output." This holds for conversational tasks but frequently fails for structured output tasks where the model must adhere to a narrow schema. Instruction competition degrades format compliance.

**How to avoid:**
- Benchmark the current planner prompt's compliance rate before changing anything (run 20 test generations, count schema failures and creative diversity)
- Add one section at a time, retest after each addition — never batch multiple prompt changes
- Keep prompt under 2,000 tokens total; prune lower-value sections if it exceeds this
- Put new creative guidelines BEFORE the schema field definitions, not after — instructions near the beginning receive more weight
- `zodOutputFormat` constrains decoding but does not eliminate compliance degradation — test, don't assume

**Warning signs:**
- Schema validation failures appear in logs after a prompt update
- Generated ToneIntents are valid JSON but creatively flat (same 3 amps, same effects)
- `ampName` selections become repetitive; model reverts to "safe" common choices
- Effect `role` distribution skews — everything becomes `always_on`

**Phase to address:**
Planner prompt enrichment phase — establish a quality baseline and a one-change-at-a-time protocol before any planner prompt modifications.

---

### Pitfall 9: Stadium Agoura Amp Params Added to Global AMP_DEFAULTS Corrupt Non-Stadium Presets

**What goes wrong:**
If Stadium-specific Agoura amp params (`Jack`, `ZPrePost`, `Level`, `Hype`, `AmpCab*`) are added to the global `AMP_DEFAULTS` table to reuse the existing 3-layer strategy, those params get emitted into every non-Stadium preset (Helix LT, Floor, Stomp, Pod Go). HD2_* amp models do not have these params. The .hlx builder will emit them as orphan keys in the amp block's param object — a behavior that may cause HX Edit import warnings or corrupt presets with a future firmware update that validates param schemas strictly.

**Why it happens:**
It is tempting to extend `AMP_DEFAULTS` rather than write a Stadium-specific resolver. The cost (extra keys in non-Stadium presets) seems harmless because Helix firmware currently ignores unknown params. But this is an unverified assumption about firmware tolerance and will fail silently.

**How to avoid:**
Any param added to `AMP_DEFAULTS` requires verification that it exists on HD2_* amp models for ALL 6 supported devices. Stadium-specific params belong in a `STADIUM_AMP_DEFAULTS` table only, applied inside an `isStadium(device)` guard. Never add a param to the shared table without checking it against the non-Stadium model catalog.

**Warning signs:**
- A non-Stadium preset's amp block params include `Jack` or `ZPrePost` keys when inspected
- HX Edit logs an import warning about unexpected parameters
- The shared `AMP_DEFAULTS` table gains a key that does not appear in any HD2_* model's `defaultParams`

**Phase to address:**
Per-model amp parameter overrides phase — define the scope rules for shared vs. device-specific param tables before any Stadium amp param work.

---

### Pitfall 10: Effect Combination Rules Overflow Block Budget on Constrained Devices

**What goes wrong:**
New effect combination logic (e.g., "always pair pitch shift with reverb for shimmer", "compressor before delay for tighter echoes") that was designed and tested on Helix LT (generous block budget) will silently overflow HX Stomp's 6-block limit. Mandatory blocks already consume 3-4 slots (amp, cab, boost, gate). On HX Stomp that leaves 2 user effect slots. Any "quality" effect combination pattern that assumes 4+ user slots is Stomp-incompatible and will generate presets that cannot load on hardware.

**Why it happens:**
Quality research focuses on what sounds best without always modeling device constraints. Helix LT has 16 total block slots; HX Stomp has 6. Combination patterns designed on the generous device silently break the constrained one.

**How to avoid:**
Every new effect combination pattern must declare its minimum block budget requirement. Chain rules must check the device's available user slots BEFORE inserting optional combination patterns — if the combination won't fit, fall back to the simpler single-effect choice. Test every new pattern against all 6 supported devices in a single validation pass.

**Warning signs:**
- Generated HX Stomp presets have 7+ blocks (impossible to load on hardware)
- Chain rules tests pass for Helix LT but no test covers the combination pattern on Stomp
- `userEffects.length` truncation (already in chain-rules.ts) silently drops the secondary effect in the pair

**Phase to address:**
Effect combination / chain rules improvement phase — block budget checks must be in place for all 6 devices before new combination patterns are added.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add Stadium amp params to global `AMP_DEFAULTS` | No new code paths needed | Orphan params in all non-Stadium presets; firmware tolerance is unverified assumption | Never |
| Estimate Agoura `defaultParams` without reading real .hsp files | Faster implementation | Wrong amp character on hardware; silent quality failure impossible to detect in code review | Never |
| Add enrichment content inside existing `if (stadium)` prompt blocks | Stays near existing device code | Fragments cache into 6 buckets; eliminates cache savings | Never for content applicable to all devices |
| Skip `DeviceCapabilities` interface and add more `isPodGo()` guards | Faster than refactoring | Guards accumulate; new devices require grep-scanning all guard sites | Only if deferring refactor to a dedicated architecture phase |
| Use Haiku for chat without quality comparison gate | Immediate cost savings | Lower interview quality → generic presets → user dissatisfaction | Never without evidence-based quality gate first |
| Apply `AMP_DEFAULTS` category overlay to Agoura amps without key compatibility check | Reuse existing layers | Agoura-specific params get wrong values or are overwritten | Never |
| Add per-model overrides to `model.defaultParams` without Layer 4 mechanism | Simple, no new structures | Overrides silently discarded by category defaults; developer time wasted debugging | Never |
| Batch multiple prompt enrichment additions in one PR | Faster iteration | Cannot isolate which change caused compliance regression | Never — one change at a time |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Stadium .hsp builder — amp-cab linking | Wiring `linkedblock` before block positions are finalized, then overwriting when blocks shift | Place all blocks first, then wire `linkedblock` by resolved block key in a post-pass (current stadium-builder.ts does this correctly — do not regress it) |
| Stadium .hsp builder — cab harness `dual` param | Omitting `dual: true` in cab harness params | Real .hsp always has `dual: true` in cab harness; confirmed in Cranked_2203.hsp b07 |
| Stadium .hsp builder — device_id | Using wrong `device_id` (2162696 was the pre-fix value; 2490368 is correct) | config.ts uses 2490368 — this was fixed in v3.2; do not change it |
| Anthropic prompt caching — cache boundary | Adding variable content (device name, model list) to the shared static prefix | Static prefix must be character-for-character identical across all device calls sharing a bucket; variable content goes at end or in user message |
| Zod structured output — `zodOutputFormat` constraint stripping | Assuming `max()` / `min()` schema constraints are enforced during Claude's constrained decoding | `zodOutputFormat` strips min/max from JSON Schema; validate and truncate post-parse (planner.ts snapshot name truncation is the correct pattern) |
| Per-model param overrides — category default conflict | Adding overrides to `model.defaultParams` expecting them to survive the category overlay | Use a separate `model.paramOverrides` field applied after category defaults (Layer 4) |
| Stadium cab params — LowCut/HighCut range | Applying Helix category values (80-100 Hz) to Stadium cabs | Real .hsp Stadium cabs use LowCut: 19.9 Hz; cab model handles its own filtering; do not apply Helix cab filter values to Stadium |
| Haiku model routing — cache warm-up | Assuming Sonnet planner cache remains warm during sessions where Haiku handles chat | Measure Sonnet `cache_read_input_tokens` in the first generation of each session post-split to verify cache is still warm |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Prompt cache invalidation on every deploy | Cost spikes after deploy while cache repopulates across sessions | Measure cache hit rate before and after every `planner.ts` change; require cache hit rate to be within 5% of baseline | Breaks immediately after any deploy touching `buildPlannerPrompt` |
| `buildPlannerPrompt` called fresh per request without memoization | Same prompt rebuilt for every request | Memoize per device target at module init (if prompt is stable during a server lifetime) | Breaks at moderate concurrency — repeated computation, not a correctness issue |
| Large prompt from full model list injection | As model catalog grows (new firmware = 50+ new models), injected model list grows, pushing prompt past cache prefix limit | Prune model list to active/recommended models only; Stadium has fewer amps than Helix LT | Breaks if total prompt exceeds ~32K tokens (Anthropic cache prefix limit) |
| Model split creates two billing streams with no unified cost monitoring | Cannot determine if split is net positive | Add per-call logging of all 4 token fields (`input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`) for both Haiku and Sonnet calls | Immediately after model split — without logging, ROI is unknown |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing model routing config as a user-queryable API param | User forces Sonnet for all calls, eliminating cost savings | Model selection must be server-side only; never derived from request params |
| Logging full ToneIntent for quality analysis | Logs contain user conversation content (rig descriptions, tone preferences) | Log schema compliance metadata only (ampName, effect count, snapshot count) — not conversation content |
| Adding Stadium device_id / device_version to public API response | Reveals firmware version enabling targeted firmware exploits | Keep device config internal; API returns only file content and display strings |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Unblocking Stadium without hardware verification | Users generate Stadium presets that sound wrong or fail to load, eroding trust in all generated presets | Block Stadium in UI until a generated preset passes HX Edit import AND sounds correct on hardware; not just code compilation |
| Overly specific planner prompt guidance ignoring user input | AI always orders delay before reverb even when user requested reverb-heavy ambient tone | Prompt enrichment should add constraints for edge cases (e.g., "do not stack 3 drives") not override natural signal chain ordering; test with 5 diverse tone interviews after each enrichment addition |
| Per-model overrides making presets inconsistent across amp families | User requests "similar tone but different amp" and gets dramatically different results | Apply per-model overrides only for documented sonic character differences; category defaults should remain the stable cross-amp baseline |
| Haiku chat produces shorter follow-up questions | Less personalized presets because tone interview is shallower | If Haiku chat is adopted, compensate in system prompt to maintain follow-up question depth |

---

## "Looks Done But Isn't" Checklist

- [ ] **Stadium builder verified**: Generated .hsp loads in HX Edit without errors AND parameters match reference .hsp field-by-field (not just structurally valid — param values must be correct). TypeScript compilation passing is NOT sufficient.
- [ ] **Agoura amp defaultParams complete**: Every amp in `STADIUM_AMPS` has `defaultParams` sourced from real .hsp files. `Jack` is integer, `Level` is dB, `ZPrePost` present. No estimated values.
- [ ] **Stadium cab defaultParams complete**: `HD2_CabMicIr_*WithPan` entries in `CAB_MODELS` include `Delay`, `IrData`, `Level`, `Pan`, `Position` in addition to the 5 existing params.
- [ ] **Per-model overrides survive category defaults**: Unit test confirms that a model-level paramOverride for Drive is present in the resolved param output — not overwritten by `AMP_DEFAULTS`.
- [ ] **Prompt cache hit rate unchanged after enrichment**: Post-deploy cache hit rate is within 5% of pre-enrichment baseline (verified via `usage-logger.ts` cache report).
- [ ] **Model routing quality gate passed**: Side-by-side ToneIntent comparison shows no statistically significant difference in ampName specificity or genreHint quality between Haiku and current model.
- [ ] **6-device test matrix for Knowledge Layer changes**: Any change to `chain-rules.ts` or `param-engine.ts` includes tests covering all 6 device targets — not just the target device.
- [ ] **Stadium UI unblocked only after hardware verification**: The Stadium `blocked` flag in the device picker is removed only after a generated preset passes hardware import — not just after builder code compiles.
- [ ] **Effect combinations verified on Stomp**: Any new effect combination pattern is tested against HX Stomp (6 blocks max) and confirmed to fall back gracefully when block budget is exceeded.
- [ ] **Non-Stadium presets unaffected by Stadium param changes**: LT/Floor amp block does not contain `Jack`, `ZPrePost`, or any other Agoura-specific key after Stadium param work is merged.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Agoura amp defaultParams are estimated, not from real files | MEDIUM | Re-read all 11 reference .hsp files, extract per-amp param tables, update `STADIUM_AMPS` entries, regenerate baseline presets, re-verify against reference |
| Stadium cab partial param schema | LOW | Add missing 5 params to `CAB_MODELS` defaultParams for `HD2_CabMicIr_*WithPan` from real .hsp reference, add Stadium cab param completeness test |
| Category defaults clobber per-model overrides | LOW | Add `paramOverrides` field to `HelixModel` type, move intended overrides from `defaultParams` to `paramOverrides`, update `resolveAmpParams()` to apply as Layer 4 |
| Prompt enrichment breaks cache | LOW | Revert to previous prompt text, measure baseline cache rate, add enrichment incrementally with cache rate check after each addition |
| Device abstraction refactor breaks Stadium or Stomp exclusion guards | HIGH | Revert refactor entirely, add comprehensive device capability tests first (6 devices x all guarded paths), redo refactor test-first |
| Haiku chat routing degrades preset quality | MEDIUM | Revert to previous model for chat, collect ToneIntent quality samples from both models over 2 weeks, rerun comparison before re-shipping |
| Shared Knowledge Layer change regresses working devices | MEDIUM | Identify which device(s) regressed from test failure, isolate change, add guard condition, run full 6-device test suite before re-merging |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stadium Agoura amp non-standard param keys | Stadium builder rebuild | Field-by-field param comparison of generated .hsp vs real-cranked-2203-pretty.json for every amp block |
| Stadium cab partial param schema | Stadium builder rebuild | Generated cab block has 10 params (not 5); LowCut matches reference value |
| Prompt enrichment breaks cache boundary | Planner prompt enrichment (restructure before adding content) | Cache hit rate post-deploy within 5% of baseline via usage-logger.ts report |
| Per-model overrides clobbered by category defaults | Per-model amp parameter overrides (establish Layer 4 first) | Unit test: model with paramOverride for Drive resolves to override value, not AMP_DEFAULTS value |
| Device abstraction refactor breaks exclusion guards | Architecture review phase (standalone phase, not combined) | 6 devices x all guarded paths test matrix; no device allows disallowed capability |
| AI model routing quality degradation | Cost-aware model routing (quality gate before shipping) | 15 interview pairs; ampName distribution and genreHint specificity not regressed vs. Sonnet baseline |
| Stadium params polluting global AMP_DEFAULTS | Per-model amp parameter overrides (scope rules defined first) | Non-Stadium integration test: LT/Floor amp block contains no Agoura-specific keys |
| Planner prompt bloat degrades compliance | Planner prompt enrichment (baseline first, one change at a time) | Schema failure rate not increased after enrichment; run 20 test generations before/after |
| Shared Knowledge Layer change regresses devices | Every phase touching chain-rules.ts or param-engine.ts | Full 6-device test matrix passes before merge |
| Stadium UI unblocked prematurely | Stadium builder rebuild | Hardware or HX Edit import verification sign-off required before UI `blocked` flag is removed |

---

## The Quality Research Protocol (for Community Preset Pattern Extraction)

Pattern extraction from community preset files requires discipline to avoid encoding output-chain corrections as tonal defaults.

**Step 1 — Source selection:** Use only presets explicitly marked as professional or commercial (ToneFactor, Glenn DeLaune, M. Britt, Alex Price). Arbitrary community uploads mix quality with idiosyncratic output chain corrections.

**Step 2 — Extract mid-chain params only:** From each preset, extract amp Drive, Sag, Bias, Bass, Mid, Treble, Presence, Master, and cab LowCut/HighCut. Do NOT extract Gain Block levels, output levels, or global EQ — these are output-chain corrections, not tonal choices.

**Step 3 — Group by amp model, calculate deviation from current defaults:** `actual_value - AMP_DEFAULTS[category][param]`. A deviation larger than 0.15 represents a meaningful pattern worth investigating.

**Step 4 — Hardware validate before encoding:** Before adding any extracted value to `AMP_DEFAULTS` or a new per-model override, play the modified preset through Helix LT and confirm the change sounds better. Do not ship any param change that was only verified in code review.

**Step 5 — Comment the source in code:**
```typescript
// CORRECT — cite source
high_gain: {
  Drive: 0.52, // Range 0.40-0.65 from ToneFactor/M.Britt analysis (35 presets); tested LT 2026-03-XX
}
// WRONG — no source
high_gain: {
  Drive: 0.52, // feels better
}
```

---

## Sources

### HIGH confidence (direct codebase and reference file inspection)
- `src/lib/helix/stadium-builder.ts` — builder implementation, block format, harness structure (2026-03-05)
- `src/lib/helix/param-engine.ts` — 3-layer resolution strategy, AMP_DEFAULTS table, category overlay logic (2026-03-05)
- `src/lib/helix/chain-rules.ts` — device guards, block budget enforcement, DSP assignment (2026-03-05)
- `src/lib/planner.ts` — prompt caching pattern, buildPlannerPrompt structure, model routing (2026-03-05)
- `tmp-stadium-research/real-cranked-2203-pretty.json` — real .hsp reference: Agoura amp params, cab params, block structure (EOengineer, Dec 2025)
- `tmp-stadium-research/real-recto-pretty.json` — corroborating real .hsp reference (EOengineer, Dec 2025)
- `.planning/PROJECT.md` — known bugs: dual-DSP key collision, Stadium amp lookup failure (v3.2 history)
- `.planning/codebase/CONCERNS.md` — fragile areas, tech debt, test coverage gaps (2026-03-02)
- `.planning/codebase/ARCHITECTURE.md` — layer contracts, device polymorphism (2026-03-02)

### HIGH confidence (official documentation)
- Anthropic prompt caching docs (2026): https://platform.claude.com/docs/en/build-with-claude/prompt-caching — cache structure, workspace isolation, pricing multipliers
- Line 6 Helix Parallel Split/Summing phase cancellation issue: https://line6.com/support/topic/56905-parallel-splitsumming-wetdry-issues/
- Line 6 phase issue with two amp blocks on parallel paths: https://line6.com/support/topic/58405-phase-issue-with-two-amp-blocks-one-path-each/

### MEDIUM confidence (research and community analysis, verified against multiple sources)
- "When Better Prompts Hurt: Evaluation-Driven Iteration" (arxiv 2025): https://arxiv.org/html/2601.22025v1 — structured output regression from prompt changes, lost-in-the-middle effect
- Tonevault "250 Helix amp analysis": https://www.tonevault.io/blog/250-helix-amps-analyzed — Scream 808 prevalence, amp param ranges
- Claude API pricing guide (2026): https://devtk.ai/en/blog/claude-api-pricing-guide-2026/ — Haiku vs Sonnet quality/cost tradeoffs

---

*Pitfalls research for: HelixTones v4.0 — Stadium Rebuild + Preset Quality Leap*
*Researched: 2026-03-05*
