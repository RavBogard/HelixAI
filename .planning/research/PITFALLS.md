# Pitfalls Research

**Domain:** HelixTones — Adding Expression Pedal Assignment, Per-Model Effect Intelligence, Effect Combination Logic, and Per-Device Preset Craft to an Existing Multi-Device Preset Generator
**Researched:** 2026-03-06
**Confidence:** HIGH — based on direct codebase inspection of `preset-builder.ts`, `podgo-builder.ts`, `param-engine.ts`, `chain-rules.ts`, `validate.ts`, `tone-intent.ts`, `models.ts`, `types.ts`, `device-family.ts`, `planner.ts`, `snapshot-engine.ts`, `param-registry.ts`, and `config.ts`. All pitfalls grounded in actual code patterns already in the codebase, not hypotheticals.

> This document covers pitfalls specific to adding expression pedal controller assignment, per-model effect intelligence, effect combination logic, and per-device preset craft to the existing HelixTones system. The existing architecture (Planner-Executor pattern, per-device capabilities, per-family schemas) is the foundation. Every pitfall here describes a way the new features interact badly with that existing foundation.

---

## Critical Pitfalls

### Pitfall 1: Expression Pedal Controller Assignments Collide With Existing Snapshot Controllers

**What goes wrong:**
The existing `buildControllerSection()` in `preset-builder.ts` (line 418) already emits controller entries for any parameter that varies across snapshots, using `@controller: 19` (Snapshot). When expression pedal assignment is added, it will also write to the same `controller` object structure (same `dsp0` / `dsp1` nesting, same `blockN` → `paramName` path). If a parameter is simultaneously registered as both a snapshot controller (`@controller: 19`) and an expression pedal controller (`@controller: 1` or `@controller: 2`), the `.hlx` file will have two controller entries for the same `blockN.paramName` key — one will silently overwrite the other, depending on which write happens last. The Helix firmware silently uses whatever is in the file; it does not error on duplicate controller entries. The user sees a mix parameter that responds to snapshots but not the pedal, or responds to the pedal but not snapshots, with no warning.

**Why it happens:**
The snapshot controller scan (lines 428-466 in `preset-builder.ts`) is a completely separate code path from any future expression pedal assignment code. Both paths write to the same `controller` map keyed by `dspN.blockN.paramName`. There is no uniqueness check. The parameter `Mix` on a reverb block might need to vary by snapshot (clean=0.20, ambient=0.50) AND be assigned to EXP2. Two controller entries for `dsp1.block1.Mix` with different `@controller` values cannot both exist in a valid `.hlx` controller section.

**How to avoid:**
Before writing any EXP pedal controller entry, check whether the target `blockN.paramName` is already registered as a snapshot controller. If the parameter varies across snapshots, it cannot also be EXP-assigned in the same preset — the firmware resolves the last written value but the interaction is undefined. The correct approach: assign EXP pedal to parameters that are static across all snapshots but should respond to the pedal in real time (wah position, volume level, reverb decay). Never assign EXP to a parameter that already has a snapshot override. Enforce this constraint with a guard in the expression pedal assignment code: `if (snapshotControlledParams.has(blockParamKey)) { skip EXP assignment }`.

**Warning signs:**
- Helix hardware loads the preset but the assigned expression pedal parameter does not move when the pedal is swept
- A test that generates a preset with both snapshot-varying Mix and EXP2-assigned Mix shows one controller entry in the output, not two
- The `controller` object for a block has the same parameter key appearing twice when serialized

**Phase to address:**
Expression pedal assignment phase — before writing the first EXP controller entry, implement and test the snapshot-parameter exclusion guard.

---

### Pitfall 2: Expression Pedal Controller IDs Are Device-Specific — Pod Go Uses ID=4 for Snapshots, Not ID=19

**What goes wrong:**
`CONTROLLERS` in `models.ts` (line 52) defines: `EXP_PEDAL_1: 1`, `EXP_PEDAL_2: 2`, `SNAPSHOT: 19`. These constants are correct for Helix LT/Floor/Stomp. Pod Go uses `@controller: 4` for snapshot recall (not 19) — this is already documented in `podgo-builder.ts` (line 7) and hard-coded in `buildPgpControllerSection()` (line 383: `@controller: POD_GO_SNAPSHOT_CONTROLLER` which equals 4). If expression pedal assignment code uses the `CONTROLLERS.EXP_PEDAL_1` constant (value: 1) for Pod Go without verification, it may be assigning the correct controller ID — but the Pod Go's EXP pedal controller protocol may differ from Helix. Additionally, Pod Go has only 1 expression pedal input (`expressionPedalCount: 1` in `device-family.ts` line 171), while Helix has 3 and Stomp has 2. Generating an EXP_PEDAL_2 assignment for a Pod Go preset creates an assignment to a controller that does not physically exist on the device. The firmware may ignore it silently or exhibit undefined behavior.

**Why it happens:**
The `CONTROLLERS` constant is defined in `models.ts` without device qualification. The constants look global and reusable. The developer adds EXP pedal assignment code, imports `CONTROLLERS.EXP_PEDAL_2`, and applies it to all devices without checking `caps.expressionPedalCount`. Pod Go's `expressionPedalCount: 1` is in `device-family.ts` but there is no connection between that field and any validation that prevents `CONTROLLERS.EXP_PEDAL_2` from being emitted for Pod Go presets.

**How to avoid:**
Before emitting any EXP controller assignment, check `caps.expressionPedalCount`. If the device has 0 EXP pedals (Stadium: `expressionPedalCount: 0`), emit no EXP controller assignments. If the device has 1 EXP pedal (Pod Go), only emit `EXP_PEDAL_1` assignments, never `EXP_PEDAL_2`. If the device has 2+ EXP pedals (Stomp, Helix), both are valid. Additionally, verify from a real Pod Go `.pgp` export that controller ID 1 is indeed the EXP pedal in the Pod Go format — the Pod Go format diverges from Helix at multiple points (snapshot controller 4 vs 19, block keys, cab encoding) and the EXP pedal controller ID must be confirmed from a real file, not inferred from the Helix constant.

**Warning signs:**
- A Pod Go preset is generated with an EXP_PEDAL_2 controller assignment in its controller section
- Stadium presets have any EXP controller entries (Stadium has zero pedal inputs)
- Expression pedal works correctly on Helix LT tests but not on Pod Go hardware loads

**Phase to address:**
Expression pedal assignment phase — `caps.expressionPedalCount` guard before any EXP controller write. Verify Pod Go EXP controller ID from a real `.pgp` export before assuming it matches the Helix constant.

---

### Pitfall 3: EXP Pedal Parameter Range @min/@max Must Reflect What the Pedal Should Actually Do, Not the Model's Full Parameter Range

**What goes wrong:**
The existing snapshot controller code (line 458 in `preset-builder.ts`) computes `@min` and `@max` as `Math.min/max` of the values that actually appear across snapshots. This is correct for snapshot control — the range is exactly what the snapshots use. For EXP pedal assignment, the code may naively use the model's full parameter range (0.0 to 1.0) as `@min`/`@max`. This produces useless presets. For example: assigning EXP2 to reverb Mix with `@min: 0.0` and `@max: 1.0` means the pedal sweeps reverb from completely dry to completely wet. In practice, reverb Mix above 0.5 makes the preset unusable for live playing — it becomes dominated by reverb. The "correct" range for a useful EXP-to-reverb-mix assignment is something like `@min: 0.2` and `@max: 0.55`. Similarly, wah-style filters assigned to EXP need a range that matches the frequency sweep the Helix expects (position 0 = heel down = lowest frequency; position 1 = toe down = highest frequency). Wrong min/max makes the EXP pedal feel useless or extreme, even though the assignment itself is technically valid.

**Why it happens:**
Model parameter ranges are expressed as 0.0-1.0 normalized floats. It is tempting to use 0.0 and 1.0 as the default range. The developer does not have a lookup table for musically-useful EXP ranges per parameter type.

**How to avoid:**
Build a small lookup table for EXP pedal `@min/@max` ranges keyed by parameter name and effect type (similar to how `GENRE_EFFECT_DEFAULTS` and `AMP_DEFAULTS` work for other parameters). At minimum cover: wah `Freq` (heel/toe position semantics), volume `Level` (full-off to full-on for volume swells), reverb `Mix` (capped max to avoid unusable wet levels), delay `Mix` (similar cap), modulation `Depth`/`Speed`. Use values derived from professional preset inspection — the same approach used for `GENRE_EFFECT_DEFAULTS` — not arbitrary full-range.

**Warning signs:**
- EXP pedal assigned to reverb Mix with `@min: 0.0` and `@max: 1.0` (full range — sounds extreme)
- Wah block assigned with `@min` and `@max` both close to 0.5 (barely any sweep)
- Volume swell EXP pedal does not reach silence because `@min` is set to 0.2 instead of 0.0

**Phase to address:**
Expression pedal assignment phase — parameter range lookup table must exist before the first EXP assignment is emitted. Do not use raw 0.0/1.0 as defaults.

---

### Pitfall 4: Over-Constraining AI Effect Selection With Too Many Rules Makes Presets Generic

**What goes wrong:**
Adding per-model effect intelligence (rules like "if amp is Fender use spring reverb", "if genre is metal never use chorus", "if genre is country always use compressor") creates a combinatorial web of constraints. If the rules are additive — each rule applied as a hard exclusion — the AI's effective effect choices collapse to a small set of "approved" combinations. The result: every blues preset has the same spring reverb and tape delay; every metal preset has the same studio reverb and tight delay. The presets stop feeling custom because the same 3-4 effects appear regardless of the user's specific description.

The existing system already has genre constraints (via `GENRE_EFFECT_DEFAULTS` in `param-engine.ts`) that set parameter values. Adding effect *selection* constraints on top of parameter constraints compounds the loss of variety. The AI is currently unconstrained in which of the 126+ effects in a category it picks — this is what allows it to produce genuinely different presets for two users who both ask for "blues." Over-constraining removes this advantage.

**Why it happens:**
Adding rules feels like quality improvement. "Fender amps should sound like Fender amps" is a reasonable design goal. The problem is that rules are cumulative — each one individually seems sensible, but together they reduce the solution space dramatically. The developer adds 10 rules and the AI now has 2 allowed delays, 1 allowed reverb, and 0 allowed modulations for metal. No individual rule caused this; the combination did.

**How to avoid:**
Implement effect intelligence as soft preferences (prompt guidance), not hard constraints (schema exclusions or pre-filtering). The planner prompt can say "for blues, prefer spring reverb; tape delay works well with Fender amps" — this biases selection without eliminating alternatives. Hard constraints should be limited to technically-correct combinations (e.g., wah blocks require the EXP pedal to be useful — do not assign wah to a device with `expressionPedalCount: 0`). Reserve hard exclusions for correctness issues, not taste issues.

Measure variety before and after: run the 36-preset deterministic baseline generator (already in the codebase) with the new intelligence rules and manually audit whether presets for the same genre still vary meaningfully. If two different tone descriptions for the same genre produce the same effects list, the rules are too tight.

**Warning signs:**
- Every Fender amp preset uses the same delay model regardless of the user's tone description
- A high-gain preset and a crunch preset for the same genre have identical effect lists
- Running the baseline generator produces 8+ presets with the same modulation effect for the same genre
- Users report "all the presets sound the same structure-wise, just different settings"

**Phase to address:**
Per-model effect intelligence phase — before shipping, run a variety audit using the baseline generator. If less than 50% of presets for the same genre have different effect combinations, the rules are too restrictive.

---

### Pitfall 5: Effect Combination Rules That Break on Pod Go's 4-Effect Budget

**What goes wrong:**
The effect combination logic (e.g., "wah + compressor + overdrive before amp = a classic combination") assumes a budget that exceeds what Pod Go provides. Pod Go has exactly 4 user-assignable effect blocks (`POD_GO_MAX_USER_EFFECTS = 4` in `types.ts`). A combination rule might specify: compressor + boost + wah + drive + modulation = 5 blocks. On Helix, this is fine. On Pod Go, `chain-rules.ts` silently truncates the effects list to 4 (`userEffects.length = caps.maxEffectsPerDsp`). The truncation discards the last effects in the list — which means the "core" combination rule may be broken by losing the most important effect in the combination (whichever happened to appear last in the array).

The problem compounds when combination rules interact with mandatory blocks. On Helix, mandatory blocks (Parametric EQ + Gain Block) are inserted after the user effects, on DSP1. On Pod Go, there are no mandatory block insertions (`mandatoryBlockTypes: []`). But the AI prompt for Pod Go may still produce 4 effects attempting to honor a combination rule, leaving the Pod Go with: boost + wah + drive + modulation = 0 room for reverb or delay. The preset sounds like a pedalboard demo, not a complete tone.

**Why it happens:**
Effect combination logic is designed and tested on Helix (8 blocks per DSP, 4+ user effects). The developer tests the combination with a Helix device, confirms it sounds great, ships it. Pod Go testing happens later (or not at all) and reveals the budget collision.

**How to avoid:**
Express combination rules as priority-ordered lists, not fixed sets. The rule "wah + compressor + overdrive + reverb is a classic blues combination" should be encoded as: **required** (compressor + overdrive/boost), **strongly preferred** (reverb), **optional if budget allows** (wah). When budget is tight (Pod Go: 4 effects; Stomp: 2 effects), only required effects are guaranteed; preferred are included if slots remain. Implement budget-aware combination application: after resolving required effects from the combination rule, fill remaining slots with preferred effects in priority order.

Additionally, add a test for each combination rule that runs it against a Pod Go device spec and asserts the truncated effect list is still a valid, musically complete combination (not broken).

**Warning signs:**
- A combination rule specifies 5+ effects and has no Pod Go test
- Pod Go-generated presets contain only pre-amp effects (wah, compressor, drive) with no delay or reverb because the budget was exhausted
- The combination rule produces different effects on Helix vs Pod Go due to truncation, with no budget-aware prioritization

**Phase to address:**
Effect combination logic phase — all combination rules must specify priority ordering. Phase must include per-device tests that validate the truncated combination is still complete.

---

### Pitfall 6: Per-Model Amp Overrides Already Exist in Layer 4 — Effect Intelligence Layer Risks Creating a Parallel, Conflicting Override System

**What goes wrong:**
The existing `resolveAmpParams()` in `param-engine.ts` implements a 4-layer strategy: model defaults → category defaults → topology override → per-model paramOverrides (Layer 4). Layer 4 is already used for 18 amps with verified values from the Tonevault 250-preset analysis. If per-model effect intelligence introduces another mechanism to alter effect parameters based on the amp model (e.g., "when using Placater Dirty, set reverb Mix to 0.10 instead of the genre default"), this creates a 5th layer that is invisible from the existing `resolveBlockParams()` call chain.

The ordering conflict is: GENRE_EFFECT_DEFAULTS already overrides model defaults for delay/reverb/modulation (see `resolveDefaultParams()`, lines 578-588). An amp-model-driven effect override applied after genre overrides would be a 5th layer in `resolveDefaultParams()`. But if the amp-model override is applied before genre overrides, it gets clobbered by genre defaults. There is no clean insertion point.

**Why it happens:**
The 4-layer amp param system was designed for amp parameters only (Drive, Master, Sag, etc.). Effect parameters have a separate resolution path through `resolveDefaultParams()` with genre as the outermost layer. Trying to add per-amp-model effect intelligence to this path requires understanding the existing layer ordering — which is not documented in one place.

**How to avoid:**
Document the current resolution order explicitly before adding any new layer. The existing order for effects is: (1) model `defaultParams` → (2) genre override → (3) tempo override (delay only). A new per-model-amp effect preference would logically sit between (1) and (2) — after model defaults, before genre, so that genre can still fine-tune. Implement it at exactly that insertion point in `resolveDefaultParams()`. Do not create a separate post-processing step that runs after all existing layers — this makes the final applied value impossible to reason about without tracing all layers.

**Warning signs:**
- Per-model amp effect intelligence applies after genre overrides, making genre tuning invisible to the user
- Two separate mechanisms both try to set reverb Mix: one from GENRE_EFFECT_DEFAULTS and one from per-amp-model preferences, and it is unclear which wins
- A test shows Fender amp + blues genre produces reverb Mix = 0.20 (genre) instead of the amp-model preference value of 0.30 — but the code intends the amp-model value to win

**Phase to address:**
Per-model effect intelligence phase — document the effect parameter resolution order before adding any new override layer. Implement new layers at the correct ordered insertion point.

---

### Pitfall 7: Prompt Bloat From Per-Model Effect Guidance Destroys Prompt Caching

**What goes wrong:**
The existing planner system prompt is the sole content in the `cache_control: { type: "ephemeral", ttl: "1h" }` annotated block. The system prompt is stable across requests for the same device — that stability is what allows Anthropic's prompt caching to work. If per-model effect guidance is added to the system prompt as a static lookup table ("when using Brit 2204, prefer Spring Reverb and Tape Delay; avoid modulation"), the system prompt grows significantly (potentially 2000-5000 additional tokens for 126+ models × 2-3 rules per model). This is still stable (same text each request), so caching would still work — but the cache creation cost increases with every additional token.

The real cache-killing mistake is making the per-model guidance dynamic. If the guidance section changes based on the amp the AI selected in a previous turn, or if it is injected into the user message (not the system prompt) but varies per-request, cache benefits are lost entirely. The system prompt must be byte-for-byte identical across all requests from the same device family for cache hits to occur.

**Why it happens:**
Developers add per-model guidance to the user message (e.g., "You previously selected Brit 2204. Here is guidance for that amp: prefer Spring Reverb, avoid modulation.") without realizing that this changes the user message content — which is not cached — but the real cost comes from the developer thinking this is "just the user message, not the system prompt, so caching is fine." In reality, what matters for caching is system prompt stability, and injecting per-model guidance into the user message is fine for caching but has no effect on the planner because the planner sees the user message after deciding on the amp, not before.

The other failure mode: adding per-model guidance directly to the system prompt works for caching, but the developer keeps updating the guidance table as new models are validated, changing the system prompt and forcing cache re-creation on every deploy.

**How to avoid:**
Per-model effect guidance belongs in the **system prompt** as a stable static section — not in the user message, not dynamically generated per request. Batch all per-model guidance into one research pass, write it as a static string section in the prompt builder, and treat it like any other static section (it changes rarely and causes a one-time cache re-creation when it does). Measure the token cost of the new section and compare against the cache savings: if the system prompt grows from 2000 to 5000 tokens, the cache creation cost also grows proportionally. Check whether the additional cache creation amortizes across expected daily request volume.

For models with straightforward preferences (most models fall into amp-family patterns), encode guidance at the amp-family level rather than per-model: "Marshall-style amps: prefer tight delays (dotted eighth), avoid spring reverb" covers Brit 2204, Brit Plexi, Brit J-45 with one rule instead of three. This keeps the guidance section small.

**Warning signs:**
- `cache_read_input_tokens` drops after adding per-model guidance (guidance was added to user message, not system prompt)
- System prompt changes on every deploy as per-model guidance is incrementally updated (cache re-created each deploy)
- The guidance section adds 3000+ tokens to the system prompt — more than 50% of the pre-guidance size

**Phase to address:**
Per-model effect intelligence phase — before adding guidance to the system prompt, estimate token cost and cache economics. Prefer amp-family-level guidance over per-model guidance to minimize token growth.

---

### Pitfall 8: Quality "Improvements" That Make Presets Worse — Applying Rules Without a Baseline to Measure Against

**What goes wrong:**
Per-model effect intelligence, combination rules, and per-device preset craft are all improvements on paper. In practice, they can make presets worse if applied without a before/after comparison. Examples from this codebase's history:

1. **Genre PreDelay defaults**: The existing `GENRE_EFFECT_DEFAULTS` sets `reverb.PreDelay` per genre. If a new "improvement" changes the default PreDelay for metal from 10ms to 0ms to make reverb tighter, it removes the slight reverb bloom that prevents direct-signal dryness. This sounds "tighter" in isolation but wrong in a mix.

2. **Per-model EQ deltas**: The existing `EQ_GUITAR_TYPE_ADJUST` applies small ±0.02-0.03 deltas to EQ params based on guitar type. If a new per-amp-model rule applies a larger delta (±0.10), it overrides category-level decisions in ways that violate the expert-calibrated baseline.

3. **Mandatory effect for genre**: Adding "always include compressor for country" as a mandatory combination rule removes AI creativity in country presets. Country without a compressor can still be correct (e.g., high-gain country tones, slide guitar country). The rule applies a creative preference as a technical constraint.

**Why it happens:**
The developer has strong opinions about what sounds good for a specific amp or genre, implements them as hard rules, and tests only with their reference tone. The rules pass testing (the reference case sounds good) but fail for adjacent cases the developer did not test.

**How to avoid:**
Before shipping any preset quality change, run the full 36-preset deterministic baseline generator and do a side-by-side comparison of generated presets before and after the change. For any preset that changes, manually audit whether the change is an improvement, a regression, or neutral. A quality improvement should improve or neutralize at least 80% of presets — if it improves 20% and regresses 30%, it is a net loss despite the improved reference case. Document the before/after comparison in the phase retrospective.

Additionally, keep parameter adjustments small and directional rather than large and prescriptive. The existing EQ guitar type deltas are ±0.02-0.03 by design — they nudge, not prescribe. New per-model adjustments should be similarly small.

**Warning signs:**
- A new rule changes the generated output for 10+ presets without any before/after audit
- The 36-preset baseline generator is not run before merging the change
- A rule that "improves" one reference case causes a regression in a different genre/amp combination that was not tested
- The rule is a hard constraint ("always X for Y") rather than a soft preference ("prefer X for Y")

**Phase to address:**
Quality validation phase — every preset quality change must run the baseline generator before/after and document regressions. Ship only if regression rate is under 10%.

---

### Pitfall 9: Per-Model Effect Overrides in Param-Engine Will Conflict With Stadium Amp's Firmware Parameter Guard

**What goes wrong:**
`resolveAmpParams()` in `param-engine.ts` (line 410) has an explicit guard: `if (!stadiumModel) { apply category/topology layers }`. Stadium amps skip HD2 category defaults and topology overrides because they have different firmware parameter schemas (Agoura-era, raw Hz/dB values). If per-model effect intelligence adds a similar guard pattern elsewhere — for example, in `resolveDefaultParams()` checking for Stadium amps — it risks duplicating the same guard-based branching pattern that v5.0's device-first architecture is trying to eliminate.

The specific risk: adding `if (caps.ampCatalogEra === "agoura") { apply different reverb defaults }` in `resolveDefaultParams()` creates another Stadium-specific branch in a shared file. This is exactly the architecture problem documented in `architecture-audit-v4.md` (17 guard sites that v5.0 is designed to eliminate). Every new feature that adds a guard site makes the v5.0 device-first refactor harder.

**Why it happens:**
Effect defaults genuinely differ between Stadium and HD2 devices — Stadium effects have different model names, different parameter semantics, and different interaction patterns. The temptation to add an `ampCatalogEra` check is real and locally correct. But it creates a new guard site in exactly the files that v5.0 is supposed to eliminate guards from.

**How to avoid:**
If per-model effect intelligence requires different behavior for Stadium effects, implement it at the device-module level (as a Stadium-specific implementation in the Stadium family module) rather than as a guard in shared `param-engine.ts`. The v5.0 device-first architecture provides the correct location: device-specific logic goes in `src/lib/families/stadium/`, not in shared files. For effect intelligence changes that apply to all devices equally, implement them in shared code without any device guards.

If the device-first refactor is not yet complete when this milestone starts, document the new guard site explicitly as technical debt and include it in the v5.0 guard-site elimination scope.

**Warning signs:**
- New `if (caps.ampCatalogEra === "agoura")` block appears in `param-engine.ts` or `chain-rules.ts`
- New effect intelligence code adds an `isStadium()` or `isStomp()` guard in a shared file
- v5.0 architecture refactor must now also convert guard sites added by this milestone

**Phase to address:**
Per-model effect intelligence phase — route Stadium-specific effect behavior through the Stadium family module, not shared files. Coordinate with v5.0 scope to avoid creating guard debt.

---

### Pitfall 10: Wah Block EXP Assignment Conflicts With Wah As Always-On vs Toggle

**What goes wrong:**
The existing `intentRole` system (`"always_on" | "toggleable" | "ambient"`) determines whether a block is bypassed in different snapshots (see `snapshot-engine.ts`, lines 86-102). Wah blocks are typically toggleable or always-on. When expression pedal assignment is added, wah blocks should be assigned to EXP1 (the standard wah configuration). But if a wah block has `intentRole: "always_on"`, it is never bypassed in any snapshot — meaning the wah filter is always active in the signal chain. An always-on wah with EXP1 assigned to its Freq parameter is a valid wah configuration (the filter is always in the circuit, and the pedal sweeps the frequency). But an always-on wah without EXP assigned acts as a fixed filter (parked at one frequency), which is a valid creative choice but sounds like a broken wah to most users.

The conflict: if the EXP assignment logic always assigns wah blocks to EXP1, it creates an unintentional constraint — the user cannot have a wah that is switched in/out via footswitch (toggle mode). If EXP assignment is only added to wah blocks with `intentRole: "always_on"`, toggleable wahs have no EXP assignment and behave as a simple tone filter on/off switch rather than a responsive pedal effect.

**Why it happens:**
Wah assignment seems simple — wah blocks always use EXP. But the existing role system complicates this: a wah block can be used as a synth-style filter (always-on, fixed frequency) or as a traditional wah pedal (always-on, EXP-assigned) or as a switched filter (toggleable, no EXP). The developer assumes "wah always means EXP pedal" without checking the intentRole.

**How to avoid:**
When the AI selects a wah effect with `role: "always_on"`, assume EXP assignment is desired (standard wah). When the AI selects a wah with `role: "toggleable"`, do not force EXP assignment — the user may want a fixed-frequency filter that toggles on/off. If adding an EXP field to ToneIntent's effect schema, let the AI specify whether EXP is desired per-effect, rather than auto-assigning it based on block type alone. Fallback rule: wah always-on → assign EXP1; wah toggleable → no EXP unless explicitly requested.

For devices with `expressionPedalCount: 0` (Stadium), never generate wah blocks — there is no pedal to control the frequency sweep. The existing `chain-rules.ts` does not currently enforce this but should.

**Warning signs:**
- All generated presets with wah blocks have EXP1 assigned regardless of whether the wah is always-on or toggleable
- Stadium presets include wah blocks (no pedal exists to control them)
- A toggleable wah block is assigned to EXP1, meaning the user must simultaneously bypass the block AND sweep the pedal during live playing

**Phase to address:**
Expression pedal assignment phase — define the intentRole → EXP assignment decision matrix before writing any assignment code. Test all three role configurations against all device types.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| EXP controller assignment without snapshot exclusion guard | Fast to implement | Preset has conflicting controller entries (EXP + snapshot on same param); hardware silently uses one | Never — the guard is a single `Set.has()` check |
| Use 0.0/1.0 as EXP @min/@max for all parameters | No lookup table needed | Wah sweeps are museless; reverb goes to 100% wet; presets sound extreme | Never — EXP ranges must be musically useful, not technically maximal |
| Per-model effect guidance added to user message for "flexibility" | Guidance can be personalized per-request | User message is not cached; cache hit rate drops; every request pays full input token cost | Never for guidance that is static per device/amp family |
| Effect combination rules implemented as hard inclusions without budget priority | Rules are always complete | Pod Go and Stomp presets have truncated combinations that break the musical intent of the rule | Never without priority ordering — required vs. preferred vs. optional |
| Per-model amp effect overrides added as new guard sites in shared files | Quick implementation | Increases guard site count that v5.0 architecture is designed to eliminate | Acceptable only if v5.0 refactor is also in scope and the new guard site is included in the conversion |
| Quality changes deployed without running baseline generator before/after | Faster iteration | Regressions invisible until user reports; the baseline generator exists specifically to prevent this | Never — the 36-preset baseline generator exists for exactly this purpose |
| Combination rules tested only on Helix, not on Pod Go or Stomp | Test coverage sufficient for 4 of 6 devices | Pod Go budget collisions discovered in production by users | Never — all combination rules must be tested against all device budgets |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `buildControllerSection()` — EXP + snapshot on same parameter | Both controller types write to same `dsp0.blockN.paramName` key; last write wins | Check whether param is already in snapshot `paramVariations` before emitting EXP assignment |
| Pod Go EXP controller ID | Assuming Pod Go EXP pedal uses `CONTROLLERS.EXP_PEDAL_1 = 1` without verification | Confirm EXP controller ID from a real Pod Go `.pgp` file export; Pod Go already uses non-standard snapshot ID (4 vs 19) |
| Stadium `expressionPedalCount: 0` | Assigning EXP to Stadium presets (device has no pedal input) | Guard every EXP assignment with `if (caps.expressionPedalCount > 0)` |
| `GENRE_EFFECT_DEFAULTS` — PreDelay values | Treating PreDelay (already 10-45ms in the table) as "normalized 0-1" when adding a new entry | PreDelay in GENRE_EFFECT_DEFAULTS is in SECONDS (0.010 = 10ms), verified from `validate.ts` — new entries must match this encoding |
| `EQ_GUITAR_TYPE_ADJUST` deltas — size matters | Adding large deltas (±0.10+) for per-amp EQ preferences | Existing deltas are ±0.02-0.03 intentionally; large deltas violate the expert-calibrated baseline |
| `resolveDefaultParams()` — genre override exclusion | Genre override is only applied when the param `key in params` (line 583) — a new param name not in model `defaultParams` will never get genre override applied | If adding a new effect model with new param names, ensure genre profile keys match the actual model param names |
| Prompt caching — effect guidance section | Adding per-model guidance as dynamic strings that change per-request | All planner system prompt content must be byte-for-byte stable across requests for the same device to sustain cache hits |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Wah EXP conflicts with snapshot control: conflict detection loop | Iterating over all snapshot parameterOverrides for every EXP candidate parameter at generation time | Pre-compute a `snapshotControlledParams: Set<string>` (keyed by `dspN.blockN.paramName`) once in `buildControllerSection()` and pass it to EXP assignment; do not re-scan all snapshots per-parameter | Not a scale issue — correctness issue visible in every single affected preset |
| Effect combination rules evaluated as O(N²) over effect catalog | Slow preset generation visible in Vercel function logs (>2s for planner phase) | Pre-compute combination rules as a lookup structure keyed by amp family or genre; do not scan all 126+ effects per-combination at runtime | At any usage volume — even 1 generation request will be slow if rules are O(N²) |
| Prompt length growth from per-model guidance | Cache creation token cost increases; Vercel function execution time increases | Prefer amp-family-level guidance (covers 3-6 amps per rule) over per-model guidance (1 amp per rule) | Immediately if guidance adds >3000 tokens to system prompt |
| Baseline generator runs on every test suite invocation | Test suite becomes slow if 36-preset generation is always included | Gate baseline generator behind a `--run-baseline` flag or a separate test suite; run on demand, not on every `pnpm test` | From the first time it is accidentally included in the default test run |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| EXP `@min/@max` values injected from user input | User provides `@min: -999`, `@max: 999` — firmware behavior undefined | EXP @min/@max are always computed from the lookup table, never from user input; the user specifies tone goal, not parameter ranges |
| Effect combination rules stored as user-editable config | User modifies combination rules to include invalid model IDs or device-breaking combinations | Combination rules are static code-level constants, not database configuration; changes require code review and deployment |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| EXP pedal assignment shown in UI as "Pedal 1" but device has no physical EXP input | User assigns EXP to a parameter, downloads preset, hardware shows no controller | Suppress EXP assignment UI/mentions for Stadium (expressionPedalCount: 0); describe as "Volume Pedal" for Pod Go (1 pedal) vs "Expression Pedal 1/2" for Helix |
| Generic preset quality "improvements" applied silently without communicating what changed | User regenerates, preset sounds different but they do not know why | Log which per-model and per-device rules were applied in the preset description or tone card UI — transparency builds trust |
| Over-constrained effect rules produce safe, boring presets | User asks for a unique ambient tone and receives the same delay+reverb combination every time | When combination rules produce the same effects for 3+ different tone descriptions, audit and loosen the rules |
| Expression pedal assignment for parameters users cannot hear immediately | User downloads preset, does not know to sweep the pedal to hear the effect | Include EXP pedal parameter name and range in the "guitarist tips" guitarNotes field; make the assignment discoverable |

---

## "Looks Done But Isn't" Checklist

- [ ] **EXP assignment tested against Stadium**: Stadium presets have zero EXP controller entries in the output. Verified by generating a Stadium preset and asserting `controller` section contains no `@controller: 1` or `@controller: 2` entries.
- [ ] **EXP assignment tested against Pod Go**: Pod Go presets only have EXP_PEDAL_1 assignments, never EXP_PEDAL_2. Verified by generating a Pod Go preset with a wah block and confirming `@controller: 1` (not 2) appears exactly once.
- [ ] **Snapshot/EXP conflict guard active**: A preset with a reverb block that varies across snapshots does NOT also have an EXP2 assignment to the same Mix parameter. Verified by a unit test that generates this scenario.
- [ ] **EXP @min/@max are musically useful**: Reverb Mix EXP range is capped below 0.60. Wah Freq EXP range covers the full sweep (0.0 to 1.0, or documented equivalent). Volume swell EXP @min reaches 0.0 for silence. Verified by inspecting generated controller entries.
- [ ] **Effect combination rules tested on Pod Go budget**: Every combination rule passes a budget test: when applied to Pod Go (4-effect limit), the truncated combination is still musically complete. Documented by a per-rule Pod Go test case.
- [ ] **Variety audit passed**: The 36-preset deterministic baseline generator run with new effect intelligence rules produces at least 50% variety in effect selection for same-genre presets. Fewer than 10% regressions vs. baseline.
- [ ] **No new guard sites in shared files**: `chain-rules.ts`, `param-engine.ts`, `validate.ts` do not contain new `isStadium()` or `isPodGo()` guards introduced by this milestone. Verified by `grep`.
- [ ] **Per-model effect guidance is static in system prompt**: The planner system prompt byte content is identical across all requests for the same device after the guidance section is added. Verified by logging `cache_read_input_tokens` in production: it must be nonzero within one TTL window after deploy.
- [ ] **Wah EXP intentRole matrix is correct**: Always-on wah → EXP1 assigned. Toggleable wah → no EXP assigned. Generated presets reflect this. Verified by generating two presets with different wah roles and inspecting the controller section.
- [ ] **Quality change before/after documented**: For every per-model and per-device rule added, a before/after comparison of at least 5 affected presets is documented in the phase retrospective.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| EXP/snapshot controller conflict causes hardware load failure | LOW | Add snapshot exclusion guard in `buildControllerSection()`; regenerate affected presets |
| Pod Go receives EXP_PEDAL_2 assignment (non-existent pedal) | LOW | Add `caps.expressionPedalCount > 1` guard; redeploy; users must regenerate affected presets |
| Over-constrained effect rules produce monotone preset variety | MEDIUM | Remove hard constraints; convert to prompt-level soft preferences; re-run variety audit before re-deploying |
| Combination rules break Pod Go budget — presets missing reverb/delay | MEDIUM | Add priority ordering to all combination rules; reimplement budget-aware selection; re-run Pod Go test suite |
| EXP @min/@max are too extreme (reverb goes to 100% wet) | LOW | Add EXP range lookup table with capped values; regenerate affected presets |
| Per-model effect guidance added to user message breaks cache | LOW | Move guidance to system prompt as a static section; verify cache warms within one TTL window after deploy |
| Quality "improvement" regresses 30%+ of baseline presets | HIGH | Revert the rule; do before/after audit; reimplement as a softer preference; rebuild variety audit before re-shipping |
| New guard sites added in shared files conflicts with v5.0 refactor | MEDIUM | Include new guard sites in v5.0 conversion scope; coordinate timing so shared files are not modified in parallel |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| EXP/snapshot controller collision | Expression pedal assignment phase | Unit test: parameter with snapshot override cannot also receive EXP controller |
| Wrong EXP controller ID for Pod Go / missing for Stadium | Expression pedal assignment phase | Pod Go: EXP_PEDAL_2 never emitted; Stadium: no EXP entries at all |
| EXP @min/@max full-range extremes | Expression pedal assignment phase | Generated EXP ranges reviewed against musical usefulness lookup table |
| Over-constraining AI effect selection | Per-model effect intelligence phase | Variety audit: 50%+ variety in same-genre presets, <10% regressions |
| Combination rules break Pod Go budget | Effect combination logic phase | Pod Go budget test for every combination rule |
| Per-model override parallel to existing Layer 4 mechanism | Per-model effect intelligence phase | No parallel override system — new layer inserted at documented position in resolveDefaultParams() |
| Prompt bloat from per-model guidance kills cache | Per-model effect intelligence phase | cache_read_input_tokens nonzero in production logs within one TTL window after deploy |
| Quality improvements without baseline | Quality validation phase | 36-preset generator run before/after every change; <10% regression rate |
| New guard sites conflict with v5.0 | Per-model effect intelligence / combination logic phase | grep confirms no new isStadium()/isPodGo() in chain-rules.ts, param-engine.ts, validate.ts |
| Wah EXP conflicts with toggleable role | Expression pedal assignment phase | intentRole matrix test: always-on wah → EXP1; toggleable wah → no EXP |

---

## Sources

### HIGH confidence (direct codebase inspection, 2026-03-06)
- `src/lib/helix/preset-builder.ts` — `buildControllerSection()` (lines 418-468), snapshot param variation scan, `CONTROLLERS.SNAPSHOT` usage
- `src/lib/helix/podgo-builder.ts` — `buildPgpControllerSection()` (lines 343-391), `POD_GO_SNAPSHOT_CONTROLLER = 4` documentation, comment "Helix uses 19" at line 7
- `src/lib/helix/models.ts` — `CONTROLLERS` (lines 52-57): EXP_PEDAL_1=1, EXP_PEDAL_2=2, SNAPSHOT=19; `BLOCK_TYPES`; `HelixModel` interface
- `src/lib/helix/param-engine.ts` — `resolveAmpParams()` 4-layer strategy (lines 396-436), Stadium guard, `GENRE_EFFECT_DEFAULTS` (lines 162-208), `resolveDefaultParams()` genre override logic (lines 568-609), `EQ_GUITAR_TYPE_ADJUST` delta sizes (lines 97-112)
- `src/lib/helix/device-family.ts` — `expressionPedalCount` per device: Helix=3, Stomp=2, Pod Go=1, Stadium=0
- `src/lib/helix/chain-rules.ts` — `maxEffectsPerDsp` truncation (lines 388-397), Pod Go budget enforcement, `mandatoryBlockTypes` empty for Stomp/PodGo
- `src/lib/helix/types.ts` — `CONTROLLERS` precedent at line 138 comment (controller 19 = Snapshot, 2 = EXP Pedal 2), `HlxControllerAssignment` interface
- `src/lib/helix/validate.ts` — Stadium amp guard pattern (lines 138-141) as example of per-device branch in shared file
- `src/lib/helix/snapshot-engine.ts` — `intentRole` impact on bypass states (lines 86-102), AMBIENT_MIX_BOOST pattern
- `src/lib/helix/param-registry.ts` — parameter encoding types; PreDelay confirmed as seconds-scale float
- `src/lib/helix/tone-intent.ts` — `EffectIntentSchema` with `role` field; max 6 effects constraint
- `.planning/PROJECT.md` — active milestone context, existing quality features (genre defaults, amp overrides), v5.0 scope

### MEDIUM confidence (engineering pattern reasoning from codebase evidence)
- Prompt caching behavior: inferred from existing `cache_control: ephemeral` annotation in `planner.ts` and documented cache economics in the existing v5.0 PITFALLS.md
- Effect combination budget priority ordering: pattern established by existing `maxEffectsPerDsp` truncation behavior in `chain-rules.ts` lines 388-397

---

*Pitfalls research for: HelixTones — Expression Pedal Assignment, Per-Model Effect Intelligence, Effect Combination Logic, Per-Device Preset Craft*
*Researched: 2026-03-06*
