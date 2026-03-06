# Project Research Summary

**Project:** HelixTones — Preset Quality Deep Dive
**Domain:** AI-powered guitar preset generator (expression pedal assignment, per-model effect intelligence, effect combination logic, per-device craft, quality validation)
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This milestone closes four concrete quality gaps in an already-working Planner-Executor preset generation pipeline. The system already generates structurally valid .hlx/.pgp/.hsp files for six Helix-family devices; what it lacks is musicality intelligence: wah and volume blocks are inert on hardware because no EXP controller assignment is ever emitted, the AI picks any delay or reverb model from the catalog without genre guidance, effects have no interaction logic (compressor threshold is not reduced when a wah is present; reverb mix is not tightened when delay is also in the chain), and per-device craft differences (Stomp = 6 blocks; Floor = 16 blocks) are not reflected in effect selection strategy. These are all silent quality failures — the preset loads and plays, but pressing the expression pedal does nothing, or a worship preset gets the same effects as a jazz preset.

The recommended approach is purely TypeScript data-and-logic changes across the existing Knowledge Layer — no new npm packages, no new API surfaces, no architectural upheaval. EXP pedal assignment belongs in the Builder Layer (gated by `caps.expressionPedalCount`), not in the AI. Per-model effect guidance belongs in the system prompt as a static cached section (300–500 tokens, amp-family-level grouping). Effect combination adjustments are deterministic Layer 7 deltas in `param-engine.ts`, computed from an `EffectCombinationContext` built in `chain-rules.ts`. Per-device craft is already partially encoded via `DeviceCapabilities`; the remaining gaps are Pod Go EXP2 exclusion and Stomp EQ/Gain block verification.

The primary risk is correctness, not complexity. The two highest-severity pitfalls — (1) EXP and snapshot controller assignments colliding on the same `dsp0.blockN.paramName` key and (2) expression pedal assignments emitted for devices that lack the physical hardware — are both simple guards that must be implemented before any EXP code ships. Quality regression is the secondary risk: every per-model override and combination rule applied without a before/after baseline comparison has historically introduced regressions. The 36-preset deterministic baseline generator already exists for exactly this purpose and must be run before every merge.

## Key Findings

### Recommended Stack

No new npm packages are required. All five feature areas are TypeScript data and logic changes within the existing stack: Next.js 16.1.6, TypeScript 5, Vitest 4.0.18, Zod 4.3.6, `@anthropic-ai/sdk` 0.78.0, and Supabase 2.98.0. The existing `paramOverrides` mechanism on amp models (Layer 4 in `param-engine.ts`) provides the exact pattern to reuse for per-effect model overrides. The existing `buildControllerSection()` in all four builders provides the integration point for EXP assignment. The existing `GENRE_EFFECT_DEFAULTS` structure in `param-engine.ts` provides the pattern for a new `COMBINATION_RULES` table.

**Core technologies:**
- TypeScript: new fields (`effectParamOverrides`, `expParam`, `bestWith`) on `HelixModel`; new `QualityWarning` type; new `CombinationRule` interface — no version change needed
- Vitest: new `quality-validation.test.ts`; extended `model-defaults-validation.test.ts` — no version change needed
- `@anthropic-ai/sdk`: planner prompt enriched with effect guidance table (static string in system prompt; fully cache-amortized after first request within TTL window)

See [STACK.md](.planning/research/STACK.md) for full file-by-file change inventory.

### Expected Features

**Must have (table stakes — presets are broken without these):**
- Wah block EXP1 controller assignment — wah block without `@controller: 1` on `Position` is a dead block on hardware; pedal does nothing
- Volume block EXP2 controller assignment on devices with two or more expression pedals — same failure mode
- Genre-aware delay model selection — Transistor Tape for blues vs Simple Delay is audibly different; the AI currently picks arbitrarily
- Genre-aware reverb model selection — Spring reverb for country/blues/surf; Plate for rock/pop; Ganymede for ambient/worship
- Genre-aware wah model selection — Chrome Custom for blues/classic rock; Teardrop 310 for hard rock/metal; Fassel for funk

**Should have (competitive differentiators):**
- Wah-to-compressor threshold interaction — when wah is in chain, lower comp `Threshold` by 0.10 to prevent over-compression of filter sweep peaks
- Metal/high-gain compressor exclusion — compressor in a metal preset is a mark of non-expertise; omit when `ampCategory === "high_gain"`
- Noise gate before amp for high-gain — gate must be placed before the amp block on high-gain tones to suppress input noise, not after
- Ducked Delay auto-selection for worship/country — the professional "never gets in the way" workhorse
- Pod Go EXP2 exclusion — Pod Go has one expression pedal; assigning volume to EXP2 creates a dead controller assignment
- `validatePresetQuality()` non-throwing quality gate — returns `QualityWarning[]` for issues like reverb Mix above 0.65 or cab LowCut below 60Hz

**Defer (v2+):**
- Per-genre modulation model selection — current defaults are already reasonable; low incremental value
- Effect preset "templates" per genre — pre-packaged effect combinations as planner starting points
- Reverb-before-delay as ambient-specific option — specialty technique; niche audience
- Per-device quality thresholds in `DeviceCapabilities` — device-aware severity calibration for quality warnings

See [FEATURES.md](.planning/research/FEATURES.md) for the full prioritization matrix and anti-feature analysis.

### Architecture Approach

The Planner-Executor architecture is unchanged. All four new feature areas integrate as extensions of existing pipeline stages. Expression pedal assignment integrates at the Builder Layer (after block keys are finalized) gated by `caps.expressionPedalCount`. Effect combination context is built at the end of `chain-rules.ts` as `EffectCombinationContext` and applied in `param-engine.ts` as Layer 7 (after genre defaults, before return). Per-model effect guidance enters the system prompt as a single new shared section (`families/shared/effect-guidance.ts`) — static, cacheable, 300–500 tokens. Per-device craft is enforced in code via `DeviceCapabilities` fields and guided creatively in per-family prompts.

**Major components and their integration points:**
1. `families/shared/effect-guidance.ts` (NEW) — compact per-model effect pairing table; pure function; injected into all four family prompts; cached with system prompt
2. `chain-rules.ts` (MODIFIED) — add `buildEffectCombinationContext()` after effect slot classification; thread `EffectCombinationContext` to `resolveParameters()`
3. `param-engine.ts` (MODIFIED) — add Layer 7 `applyEffectCombinationAdjustments(block, params, context, ampCategory)` after genre profile layer
4. All four builders (MODIFIED) — extend `buildControllerSection()` with EXP pedal loop gated on `caps.expressionPedalCount`
5. `validate.ts` (MODIFIED) — add `validatePresetQuality(spec, caps): QualityWarning[]` (non-throwing) alongside existing `validatePresetSpec()`

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full data flow diagrams, build order dependency graph, and anti-pattern analysis.

### Critical Pitfalls

1. **EXP and snapshot controllers collide on the same `dsp0.blockN.paramName` key** — before writing any EXP controller entry, check whether the target key is already in the snapshot-controlled params set. If a parameter varies across snapshots it cannot also be EXP-assigned. Pre-compute `snapshotControlledParams: Set<string>` in `buildControllerSection()` and guard every EXP write against it.

2. **EXP_PEDAL_2 emitted for Pod Go (1 pedal) or any EXP entry emitted for Stadium (0 pedals)** — gate every EXP assignment on `caps.expressionPedalCount`. Pod Go: only `@controller: 1` (EXP1) is valid. Stadium: no EXP entries at all. Also verify Pod Go EXP controller ID from a real `.pgp` export — Pod Go already uses a non-standard snapshot controller ID (4 vs 19) and the EXP ID must be confirmed, not assumed.

3. **EXP `@min/@max` default to 0.0/1.0 — produces musically unusable sweeps** — reverb Mix swept from 0% to 100% is unplayable; wah assigned with min/max close to each other has no sweep. Build a lookup table for EXP ranges keyed by effect type and parameter name before writing the first EXP entry.

4. **Over-constraining AI effect selection collapses variety** — effect intelligence must be soft preferences in the prompt ("for blues, prefer Plate or Spring reverb"), not hard schema exclusions. Hard constraints are reserved for correctness failures only. After adding any intelligence rules, run the 36-preset deterministic baseline generator: if fewer than 50% of presets for the same genre have different effect combinations, rules are too tight.

5. **Quality changes deployed without before/after baseline** — per-model overrides, combination rules, and craft rules have historically caused regressions. The 36-preset generator must run before and after every rule change; merge only if regression rate is below 10%.

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 10 pitfalls with recovery strategies and the "Looks Done But Isn't" verification checklist.

## Implications for Roadmap

Based on the architecture research build-order analysis and the feature dependency graph in FEATURES.md, the natural execution order is five phases:

### Phase A: Foundation and Types
**Rationale:** `ExpPedalAssignment` type and the new shared effect guidance section have zero dependencies and unblock every other phase. Types must exist before builders, prompt sections, or validation can reference them.
**Delivers:** `types.ts` additions (`ExpPedalAssignment` interface, `expPedalAssignments` on `PresetSpec`); `tone-intent.ts` optional `expPedalAssignments` field; `families/shared/effect-guidance.ts` new file; `families/shared/tone-intent-fields.ts` update
**Addresses:** Foundation for all five feature areas
**Avoids:** Dependency failures from starting builder or validation work before types stabilize
**Research flag:** Standard TypeScript patterns — no research phase needed. All patterns directly mirror existing code.

### Phase B: Expression Pedal Controller Assignment
**Rationale:** P0 priority — wah and volume blocks are currently inert on hardware. This is the highest-urgency fix and has the clearest, most bounded scope. The snapshot-exclusion guard and `caps.expressionPedalCount` guard must be in-scope from day one — not retrofitted.
**Delivers:** EXP1 (wah) and EXP2 (volume) controller assignments in all four builders; correct device gating (Pod Go: EXP1 only; Stadium: none); EXP range lookup table for musically useful `@min`/`@max` values; intentRole decision matrix (always-on wah → EXP1; toggleable wah → no EXP); Vitest tests covering all device/role combinations
**Addresses:** Top two table-stakes features (wah EXP1, volume EXP2); Pod Go single-pedal craft difference; wah always-on vs toggleable distinction
**Avoids:** Pitfall 1 (EXP/snapshot collision), Pitfall 2 (wrong device EXP IDs), Pitfall 3 (full-range `@min`/`@max`), Pitfall 10 (wah intentRole matrix)
**Research flag:** Verify Pod Go EXP controller ID from a real `.pgp` export before shipping — MEDIUM confidence gap. All other patterns are HIGH confidence from direct codebase inspection.

### Phase C: Per-Model Effect Intelligence
**Rationale:** Can run in parallel with Phase B after types are defined. Splits into two independent sub-tracks: (C1) static system prompt guidance (effect pairing table, genre-aware model selection guidance for delay/reverb/wah) and (C2) `effectParamOverrides` sparse field on `HelixModel` for models with known bad defaults (Ganymede shimmer reverb over-wet, Cosmos Echo runaway feedback, Retro Reel excessive Wow/Flutter). Both sub-tracks are additive and cannot regress existing behavior.
**Delivers:** `families/shared/effect-guidance.ts` populated and injected into all four family prompts; genre-preferred delay/reverb/wah model guidance in planner prompts; `effectParamOverrides` on targeted effect models; Layer 3 insertion in `resolveDefaultParams()` (after model defaults, before genre, so genre can still fine-tune)
**Addresses:** Genre-aware delay/reverb/wah model selection; Ducked Delay auto-selection for worship/country; wah model variety by use case; per-model effect quirk correction
**Avoids:** Pitfall 4 (over-constraining AI selection — guidance is soft preferences, not hard exclusions), Pitfall 6 (parallel override system — new Layer 3 is inserted at the correct position in the documented resolution order), Pitfall 7 (prompt bloat — amp-family-level grouping keeps guidance under 500 tokens), Pitfall 9 (no new Stadium guard sites in shared files)
**Research flag:** No deeper research needed — patterns directly mirror existing `paramOverrides` and `GENRE_EFFECT_DEFAULTS`.

### Phase D: Effect Combination Logic
**Rationale:** Depends on the full block set being correctly emitted (Phase B) so that combination context is accurate. A new `combination-rules.ts` module with 10–20 curated rules keeps combination logic isolated from param-engine's existing layer stack. All rules must specify priority ordering (required / strongly preferred / optional) for budget-constrained devices.
**Delivers:** `combination-rules.ts` with `COMBINATION_RULES[]` and `applyCombinationRules()`; Layer 7 `applyEffectCombinationAdjustments()` in `param-engine.ts`; `buildEffectCombinationContext()` in `chain-rules.ts`; wah-to-comp threshold reduction; metal gate-before-amp chain ordering; metal compressor exclusion; 36-preset baseline run before/after merge
**Addresses:** Cross-effect parameter interactions (reverb+delay, high-gain+reverb, modulation+delay); metal gate placement; compressor exclusion for high-gain
**Avoids:** Pitfall 5 (combination rules breaking Pod Go 4-effect budget — priority ordering is mandatory for every rule), Pitfall 8 (baseline generator run before/after every rule addition)
**Research flag:** 10–20 rules is the correct ceiling. Do not attempt to model frequency masking, phase interactions, or non-linear saturation cascades — those require audio analysis beyond scope.

### Phase E: Quality Validation
**Rationale:** Validation is always last in the pipeline — it confirms the outputs of all previous phases meet quality standards. `validatePresetQuality()` is non-throwing (returns `QualityWarning[]`) and surfaces to the frontend as advisory notes, preserving user ability to download the preset while informing them of potential issues.
**Delivers:** `validatePresetQuality(spec, caps): QualityWarning[]` in `validate.ts`; `quality-validation.test.ts` with factory-function test pattern; quality checks for reverb over-wet (Mix > 0.65), cab LowCut below 60Hz, ChVol outside 0.60–0.85, snapshot level imbalance, device-specific EXP guard; integration into `/api/generate` orchestration to surface warnings
**Addresses:** Preset quality gate; device-specific EXP validation (no EXP assignments on Stadium); reverb/delay parameter sanity; effect ordering validation
**Avoids:** Pitfall 8 (quality improvements without baseline — the validation function itself enforces what "acceptable" means); misuse of throwing errors for quality issues (quality issues warn, structural bugs throw)
**Research flag:** Warning-vs-throw distinction is critical design decision. Quality issues (reverb too wet) must warn, not throw. Structural bugs (invalid model IDs) must throw. Do not conflate.

### Phase Ordering Rationale

- Phase A is strictly first: type system foundation unblocks all downstream phases.
- Phases B, C, and D can overlap after Phase A, with the caveat that Phase D should start after Phase B is stable (so combination context reflects the correct block set).
- Phase E is strictly last: validates the complete output of all prior phases.
- The architecture research explicitly documents the build order (Phase A → B foundation; C and D parallel after A; E always last) with rationale derived from code import dependencies, not assumptions.

### Research Flags

Phases needing deeper research during planning:
- **Phase B (Expression Pedal):** Pod Go EXP controller ID requires corpus verification from a real `.pgp` export. The Pod Go builder already diverges from Helix (uses `@controller: 4` for snapshots instead of 19). EXP pedal controller ID must be confirmed before writing the first Pod Go EXP entry. MEDIUM confidence gap — one targeted inspection step, not an exploration problem.

Phases with standard patterns (skip research-phase):
- **Phase A (Foundation/Types):** Completely additive extension of existing type patterns. No unknowns.
- **Phase C (Per-Model Intelligence):** Reuses the existing `paramOverrides` and `GENRE_EFFECT_DEFAULTS` patterns directly. No new mechanisms.
- **Phase D (Combination Logic):** Well-documented expert knowledge encoded as a deterministic table. Follows the exact same pattern as `GENRE_EFFECT_DEFAULTS`.
- **Phase E (Quality Validation):** Extends the existing `validatePresetSpec()` function. Test pattern mirrors `model-defaults-validation.test.ts` which already exists and is well-understood.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection confirms all five feature areas require zero new npm packages. All integration points identified. Version requirements unchanged. |
| Features | HIGH | P0 features (EXP assignment) confirmed from codebase inspection (constants exist but are never applied) and Line 6 Community sources. Genre model selection from community consensus and Helix Help. Device craft from direct `DeviceCapabilities` field inspection. |
| Architecture | HIGH | Based on direct codebase analysis of all affected files. Integration points are unambiguous. Build order dependency graph derived from code imports, not assumptions. |
| Pitfalls | HIGH | All 10 pitfalls derived from actual code patterns in the codebase, not hypotheticals. Controller collision verified from reading `buildControllerSection()` directly. Budget truncation confirmed from `chain-rules.ts` lines 388-397. |

**Overall confidence:** HIGH

### Gaps to Address

- **Pod Go EXP controller ID (MEDIUM confidence):** The `CONTROLLERS` constant defines `EXP_PEDAL_1 = 1` without device qualification. Pod Go already uses a non-standard snapshot ID (4 vs 19). Before implementing Pod Go EXP assignment in Phase B, inspect a real `.pgp` export from HX Edit to confirm the EXP pedal controller integer. Handle during Phase B implementation, before writing the first Pod Go EXP entry.

- **Stadium EXP controller section format (MEDIUM confidence):** Stadium `.hsp` files have a slot-based format that differs from the flat `.hlx` controller section. The EXP assignment guard (`expressionPedalCount: 0`) means Stadium will never emit EXP entries — this gap only matters if a future Stadium update adds built-in pedal support. Document as a known deferred gap in Phase B.

- **Musical usefulness of EXP `@min/@max` for non-standard parameters:** The lookup table for EXP ranges must cover wah `Position` (0.0→1.0), volume `Position`/`Gain` (0.0→1.0), reverb `Mix` (capped ~0.55 max), delay `Mix` (capped ~0.60 max), and pitch `Pitch` (0.0→1.0). Any effect type not in this table should default to no EXP assignment rather than full 0.0/1.0 range. Handle during Phase B table construction.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `src/lib/helix/preset-builder.ts`, `podgo-builder.ts`, `stomp-builder.ts`, `stadium-builder.ts`, `chain-rules.ts`, `param-engine.ts`, `models.ts`, `types.ts`, `device-family.ts`, `validate.ts`, `snapshot-engine.ts`, `tone-intent.ts` (2026-03-06)
- Direct codebase inspection — `.planning/milestones/v4.0-phases/56-per-model-amp-overrides/` — Layer 4 `paramOverrides` mechanism, validated pattern
- Direct codebase inspection — `.planning/milestones/v4.0-phases/57-effect-parameter-intelligence/57-RESEARCH.md`
- `.planning/codebase/TESTING.md` — Vitest `describe/it/expect` factory-function pattern confirmed
- [Controller Assign — Helix Help](https://helixhelp.com/tips-and-guides/helix/controller-assign) — EXP1=wah, EXP2=volume as hardware default; HIGH confidence
- [Compressor placement — Origin Effects](https://origineffects.com/2021/09/17/tech-tips-compressors-always-first-in-the-chain/) — authoritative compressor placement guide; HIGH confidence
- [Signal Chain Order — Guitar Player](https://www.guitarplayer.com/gear/guide-to-guitar-pedal-order) — canonical wah > comp > drive > amp chain; HIGH confidence
- [Creative Ways to Get More out of HX Stomp — Sweetwater InSync](https://www.sweetwater.com/insync/get-much-more-out-of-hx-stomp/) — Stomp block budget strategies; HIGH confidence

### Secondary (MEDIUM confidence)
- [Delay Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/delay/) — model descriptions and genre use cases
- [Reverb Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/reverb/) — model character descriptions
- [Wah Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/wah/) — model hardware basis
- [Fluid Solo — Transistor Tape community usage](https://www.fluidsolo.com/patchexchange/view-model/Transistor-Tape,338?page=2) — community preset analysis
- [Creating a Helix Electric Guitar Patch — jimamsden.wordpress.com](https://jimamsden.wordpress.com/2017/12/10/creating-a-helix-electric-guitar-patch-newly-updated/) — Chrome Custom cited as most musical wah
- [Reverb and Delay placement — Pro Sound HQ](https://prosoundhq.com/reverb-and-delay-pedal-placement-guide-best-chain-order/) — delay before reverb as standard
- [HX Stomp vs Helix LT — Line 6 Community](https://line6.com/support/topic/63073-helix-vs-hx-stomp/) — DSP and block constraint comparison
- Prompt caching behavior — inferred from existing `cache_control: ephemeral` annotation in `planner.ts`

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
