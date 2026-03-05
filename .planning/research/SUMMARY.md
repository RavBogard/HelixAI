# Project Research Summary

**Project:** HelixTones v4.0 — Stadium Rebuild + Preset Quality Leap
**Domain:** AI-powered guitar preset generator (Planner-Executor architecture, multi-device)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

HelixTones v4.0 is a focused quality and device-completion milestone on top of a stable v3.2 platform. The architecture is sound: a two-model AI pipeline (Gemini 2.5 Flash for conversational tone interview, Claude Sonnet 4.6 for structured ToneIntent generation) feeds a deterministic Knowledge Layer that converts AI selections into instrument-accurate preset files for 6 Line 6 devices. The single most important finding from all four research streams is that no new npm packages, infrastructure changes, or architectural rewrites are needed — every v4.0 improvement is accomplished by modifying TypeScript source files in `src/lib/helix/` and `src/lib/planner.ts`.

The primary blocker is the Helix Stadium device, which has been disabled in the UI since v3.2 due to an unverified builder. Direct inspection of 10 real .hsp files confirms 5 concrete bugs in `stadium-builder.ts`: the `access` field in parameter encoding does not exist in real files, block keys use sequential numbering instead of Stadium's 14-slot grid positions, all effect blocks must use `type: "fx"` regardless of category, 6 Agoura amp IDs are missing from the catalog entirely, and the device version constant is wrong. These are all deterministic, fixable bugs — not fundamental design issues. The Stadium rebuild must complete before the device is unblocked, and it must be verified by loading generated .hsp files in HX Edit, not just by passing TypeScript compilation.

The preset quality improvements (gain-staging intelligence, per-model amp parameter overrides, effect combination logic, planner prompt enrichment) are all independent of the Stadium track and can proceed in parallel. The key risk across all quality work is that the existing 3-layer amp parameter resolution silently discards per-model overrides — a Layer 4 `paramOverrides` mechanism must be established before individual model tuning values are added, or every override will be clobbered by category defaults without any TypeScript error. Cost-aware model routing (Haiku for chat) is operationally independent but requires a deliberate quality gate before shipping: the interview quality degradation is real but invisible to cost metrics alone.

## Key Findings

### Recommended Stack

No new dependencies are required for v4.0. The existing stack — Next.js 16.1.6, TypeScript 5, `@anthropic-ai/sdk` ^0.78.0, `@google/genai` ^1.42.0, Zod ^4.3.6, Supabase — covers every feature area. All v4.0 work is TypeScript source modifications in `src/lib/helix/` and `src/lib/planner.ts`. Zero new dependencies means zero integration risk and no compatibility testing against Next.js 16 or Tailwind 4.

Model routing is resolved: Gemini 2.5 Flash stays for chat because Google Search grounding is architecturally required for artist rig research and cannot be replicated with Claude Haiku 4.5 without a separate search API. Claude Sonnet 4.6 stays for ToneIntent generation until an A/B quality test with 20+ diverse tone goals passes. Claude Haiku 3.5 and Haiku 3 are retired/deprecated and must not be used. The current fast-tier option if the A/B test passes is `claude-haiku-4-5-20251001`.

**Core technologies:**
- Claude Sonnet 4.6 (`claude-sonnet-4-6`): ToneIntent structured generation — deepest gear knowledge required; keep until A/B validated
- Gemini 2.5 Flash: Chat tone interview — Google Search grounding for artist rig lookup is the decisive reason to keep this model; Haiku 4.5 at $1/$5 per MTok is more expensive AND loses this capability
- `@anthropic-ai/sdk` ^0.78.0: `zodOutputFormat` from `helpers/zod` works on both Sonnet 4.6 and Haiku 4.5; prompt caching via `cache_control: ephemeral` already live; `response.usage` already logged in `usage-logger.ts`
- Zod ^4.3.6: ToneIntent schema validation — no new fields needed; gain-staging is a prompt and param change, not a schema change
- Supabase: Auth, DB, Storage — `.hsp` file storage already implemented; no changes

See `.planning/research/STACK.md` for full analysis.

### Expected Features

The six v4.0 feature areas split into a Stadium hardware track (sequential dependency chain) and a quality improvement track (fully parallel and device-agnostic).

**Must have (table stakes — P1):**
- Stadium builder rebuild from real .hsp files — device is blocked in production UI; users cannot select Stadium at all
- Tempo-synced delay — `tempoHint` exists in ToneIntent but is unwired to Knowledge Layer delay calculation; formula is `60000/BPM * note_factor / 2000` for normalized Helix value
- Reverb PreDelay per genre — professional presets always set PreDelay; absent pre-delay smears note attack; requires key verification in Helix reverb model format
- Guitar-type EQ shaping — `guitarType` (single_coil/humbucker/p90) is captured in ToneIntent but not yet used in Knowledge Layer
- Planner prompt enrichment — gain-staging guidance, cab pairing table, effect discipline by genre; zero schema risk, high quality impact
- Gain-staging category validation — validate and tighten AMP_DEFAULTS values; non-master-volume amps (Fender, Vox) need Drive 0.55-0.70, not 0.25

**Should have (competitive — P2):**
- Per-model amp parameter overrides — sparse override table for top 15+ amps; requires Layer 4 `paramOverrides` mechanism in `resolveAmpParams()` to be established first or overrides are silently discarded
- Snapshot-aware volume compensation — per-toneRole ChVol delta in `snapshot-engine.ts`; `toneRole` already in SnapshotIntent; leads should be louder than cleans by default
- Cost-aware model routing (Haiku 4.5 for chat) — 73% chat cost reduction; requires 30-day baseline logging and side-by-side quality comparison gate before shipping

**Defer (v4.1+):**
- Effect combination logic — interaction-aware params require architectural decision on context passing; `param-engine.ts` currently processes each block in isolation
- Device/model abstraction layer refactor — user-facing value is zero; only warranted if Stadium rebuild reveals structural multi-file problems
- Genre-specific mandatory block substitution — jazz/ambient get compressor instead of 808 boost

See `.planning/research/FEATURES.md` for full dependency graph and prioritization matrix.

### Architecture Approach

The existing Planner-Executor architecture with its deterministic Knowledge Layer is the correct foundation for v4.0. The architectural invariant must be preserved: AI outputs only named selections (ampName, cabName, effects list), never numbers. The Knowledge Layer deterministically assigns all numeric parameters through a 3-layer resolution today: model defaultParams, category AMP_DEFAULTS, topology mid override. v4.0 adds a 4th layer (per-model `paramOverrides`) and a 5th layer (effect combination adjustments), both in `param-engine.ts`.

The architecture review confirmed an evolutionary approach: no class hierarchy refactor, no plugin system, no new abstraction layer unless Stadium rebuild forces the issue. The existing flat function design with `DeviceTarget` guards is clear, testable, and well-covered by existing test files. The 5 Stadium bugs are all in `stadium-builder.ts` and all correctable without touching the shared Knowledge Layer.

**Major components and v4.0 change status:**
1. `stadium-builder.ts` — REWRITE: fix param encoding (`{ value: X }` only), block key slot-grid allocation (b00=input, b05=amp, b06=cab, b13=output), `type: "fx"` for all effect blocks, harness params, device version
2. `models.ts` — MODIFY: add 6 missing Agoura amp IDs to STADIUM_AMPS with defaultParams from real .hsp files; defaultParams audit for model-specific controls (Vox Cut, JC-120 BrightSwitch, Diezel Deep)
3. `planner.ts` / `buildPlannerPrompt()` — MODIFY: add gain-staging intelligence, amp+cab pairing guidance, effect discipline by genre; enrichment must go in the shared static prefix to avoid cache bucket fragmentation
4. `param-engine.ts` — MODIFY: add Layer 4 `model.paramOverrides` field applied after category defaults; add Layer 5 `EFFECT_COMBO_PARAMS` constant and `applyComboAdjustments()` function
5. `validate.ts` — MODIFY: add HX2_* and VIC_* model IDs for Stadium
6. `config.ts` — MODIFY: update `STADIUM_DEVICE_VERSION` to 301990015 (observed in real files)
7. `/api/generate/route.ts` — MODIFY: remove Stadium 400 guard only after hardware verification
8. `chain-rules.ts`, `snapshot-engine.ts`, `preset-builder.ts`, `stomp-builder.ts`, `podgo-builder.ts`, `tone-intent.ts`, `types.ts` — NO CHANGE

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and build order.

### Critical Pitfalls

Full details, warning signs, and recovery strategies in `.planning/research/PITFALLS.md`.

1. **Per-model overrides silently clobbered by category defaults** — `resolveAmpParams()` Layer 2 (`AMP_DEFAULTS`) unconditionally overwrites Layer 1 model defaults. Any Drive/Master added to `defaultParams` is silently discarded with no TypeScript error. Avoid: establish `model.paramOverrides` field (Layer 4, applied after category defaults) BEFORE adding any individual model values; write a unit test that explicitly confirms an override survives category defaults.

2. **Agoura amps have non-standard parameter keys incompatible with shared AMP_DEFAULTS** — Agoura amps expose `ZPrePost`, `Jack` (integer enum), `Level` (in dB, not normalized 0-1), `Hype`, `AmpCab*` EQ params. Applying the category overlay overwrites correct Agoura values. Avoid: extract every Agoura `defaultParams` from real .hsp files, never estimate; use a `STADIUM_AMP_DEFAULTS` table inside `isStadium()` guard; never add Agoura-specific keys to the shared `AMP_DEFAULTS`.

3. **Prompt enrichment invalidates the prompt cache token boundary** — Any change to `buildPlannerPrompt()` creates a new cache bucket; conditional insertions inside `if (stadium)` or `if (podGo)` blocks fragment into 6 separate cache buckets with lower hit frequency. Avoid: all enrichment content applicable across devices goes in the shared static prefix (first ~70% of prompt); device-specific text stays in terminal `if (device)` blocks; measure cache hit rate via `usage-logger.ts` before and after every prompt change.

4. **Stadium builder produces presets that compile but fail on hardware** — TypeScript compilation passing is not verification. Wrong block slot positions load in code but appear incorrectly in HX Edit's visual flow editor and may cause hardware routing failures. Avoid: field-by-field comparison of generated .hsp against `Agoura_Bassman.hsp` reference before marking builder done; hardware or HX Edit import verification required before removing UI block.

5. **Shared Knowledge Layer changes regress all 6 devices simultaneously** — `chain-rules.ts` and `param-engine.ts` are shared; a new code path with an uncaught exception kills all devices in production. Avoid: any change to shared Knowledge Layer files requires a full 6-device test matrix pass, not just the target device; new code paths must use null-safe access (`model.paramOverrides ?? {}`); never modify the existing path, only add new paths that fall through when not configured.

## Implications for Roadmap

Research confirms a natural two-track phase structure: the Stadium hardware track is a sequential dependency chain (catalog completion → builder rebuild → device unblock), while the quality improvement track is fully parallel. Five phases cover the complete v4.0 scope.

### Phase 43: Stadium Amp Catalog Completion

**Rationale:** The Stadium builder rebuild requires real Agoura amp IDs in the catalog to test against. This is the only pure data phase — no logic changes — and carries the lowest regression risk of any v4.0 work. Starting here unblocks the builder phase without delay and requires no architectural decisions.
**Delivers:** STADIUM_AMPS expanded from 12 to 18 entries; 6 missing Agoura amp IDs (`Agoura_AmpRevvCh3Purple`, `Agoura_AmpSolid100`, `Agoura_AmpUSDoubleBlack`, `Agoura_AmpUSLuxeBlack`, `Agoura_AmpUSPrincess76`, `Agoura_AmpUSTweedman`) with defaultParams extracted from real .hsp files; `STADIUM_DEVICE_VERSION` updated to 301990015; `HX2_*` and `VIC_*` IDs added to `validate.ts`
**Addresses:** Stadium device completeness (FEATURES.md P1); Bug 4 — missing amp IDs (ARCHITECTURE.md)
**Avoids:** Cross-device fallback anti-pattern (PITFALLS.md Pitfall 1); estimated defaultParams must never be committed — only values from real file inspection

### Phase 44: Stadium Builder Rebuild

**Rationale:** Fixes the 5 confirmed structural bugs in `stadium-builder.ts` using the real .hsp corpus as ground truth. This is the highest-risk single phase because it is a rewrite of the serializer, but the bugs are deterministic and the reference files are available locally. Phase 43 must complete first so tests can use real amp IDs.
**Delivers:** .hsp files that load correctly in HX Edit; slot-grid block key allocation (b00=input, b01=gate, b02=boost, b05=amp, b06=cab, b09-b12=post-effects, b13=output); `{ value: X }` parameter encoding (no `access` field); `type: "fx"` for all effect blocks; Stadium cab params complete with `Delay`, `IrData`, `Level`, `Pan`, `Position`; `cursor` field added to preset JSON
**Uses:** STADIUM_SLOT_ALLOCATION constant replacing the sequential `flowPos` counter; `getStadiumBlockType()` mapping function for type field normalization
**Avoids:** Sequential flow key anti-pattern, access field anti-pattern, Stadium cab partial schema pitfall (PITFALLS.md Pitfalls 1, 2, Anti-Patterns 2 and 3)

### Phase 45: Stadium Device Unblock and End-to-End Verification

**Rationale:** Only remove the 400 guard after hardware verification — this is a hard requirement from PITFALLS.md, not a soft recommendation. This phase is the acceptance gate for the Stadium track.
**Delivers:** Stadium device selection enabled in production UI; 5-10 real generation requests verified by opening .hsp in HX Edit; amp parameters confirmed musically sensible; snapshot names and block states confirmed correct
**Avoids:** Premature UI unblock pitfall (PITFALLS.md UX Pitfalls — Stadium must pass hardware import AND sound correct, not just compile)

### Phase 46: Planner Prompt Enrichment

**Rationale:** Zero schema changes, zero Knowledge Layer changes, highest ROI quality improvement. The prompt additions improve AI creative choices upstream, producing better ToneIntent inputs to the Knowledge Layer. Fully independent of the Stadium track; can begin immediately alongside Phase 43. Must respect prompt cache architecture throughout.
**Delivers:** `buildPlannerPrompt()` extended with gain-staging intelligence section (Minotaur for clean/crunch, Scream 808 for high-gain, never both), amp+cab pairing guidance (US-type amps to open-back 1x12/2x12; Brit-type to closed-back 4x12 Greenback/V30; Vox to open-back 2x12), effect discipline by genre (metal: max 3 effects; ambient/worship: 4-5 appropriate; blues/country: 2-3); cache hit rate measured before and after via usage-logger.ts
**Implements:** Planner Prompt Enrichment pattern (ARCHITECTURE.md Pattern 5)
**Avoids:** Cache invalidation pitfall (PITFALLS.md Pitfall 3 — enrichment in shared static prefix, not inside device-conditional blocks); prompt bloat compliance pitfall (PITFALLS.md Pitfall 8 — one section at a time, baseline before adding, under 2000 tokens total)

### Phase 47: Per-Model Amp Param Audit and Effect Combination Layer

**Rationale:** Two tightly coupled quality improvements that both modify `param-engine.ts`. The Layer 4 `paramOverrides` mechanism must be established first in this phase before any individual model values are set. Fully independent of Stadium track; can begin alongside Phase 43 and run in parallel with Phase 46.
**Delivers:** `model.paramOverrides` field on `HelixModel` applied as Layer 4 after category defaults; per-model overrides for non-master-volume amps (US Deluxe Drive: 0.60, Master: 1.0; AC30 Drive: 0.60, Master: 1.0; Matchstick Master: 1.0) and high-gain amps (Cali Rectifire Drive: 0.40, Presence: 0.30); defaultParams audit for Vox Cut (~0.25-0.35), JC-120 BrightSwitch (1), Diezel Deep (~0.35-0.40); `EFFECT_COMBO_PARAMS` constant with 4+ entries (comp-to-drive, modulation-to-reverb, delay-to-reverb, distortion-to-delay); `applyComboAdjustments()` as Layer 5 in `resolveParameters()`; unit tests for every combo confirming delta applies and non-matching blocks are unchanged
**Avoids:** Silent override discard pitfall (PITFALLS.md Pitfall 4 — Layer 4 mechanism must be established before individual values are added); shared layer regression pitfall (Pitfall 7 — 6-device test matrix required for any param-engine change); Stadium param pollution pitfall (Pitfall 9 — Agoura-specific keys never added to global AMP_DEFAULTS)

### Phase Ordering Rationale

- Phases 43 → 44 → 45 are strictly sequential: catalog must be complete before builder tests can use real amp IDs, and builder must be hardware-verified before the UI guard is removed
- Phases 46 and 47 have no dependencies on the Stadium track and can start immediately in parallel with Phase 43
- The natural sprint structure: start Phases 43, 46, and 47 together; Phases 44 and 45 complete after 43 finishes; all five phases are achievable in a single sprint
- Cost-aware model routing (Haiku 4.5 for planner chat) is deferred: the preconditions (30-day token baseline, 20+ preset A/B quality comparison) mean it cannot ship in the same sprint; it should be a separate planning item after v4.0 ships

### Research Flags

Phases with implementation complexity requiring deliberate validation:
- **Phase 44 (Stadium Builder Rebuild):** High-risk rewrite — all 5 bugs are known and localized, but the implementation must be validated field-by-field against a reference .hsp file, not just checked for structural validity. The cab parameter schema completeness (10 params, not 5) is easy to miss in a diff. Recommend a dedicated JSON diff step comparing generated output against `Agoura_Bassman.hsp` before marking the phase complete.
- **Phase 47 (Per-Model Amp Params):** The Layer 4 mechanism is the prerequisite — if it ships without the `paramOverrides` field established first, every subsequent model tuning effort will be silently wasted. This phase needs a unit test that explicitly confirms an override value at Layer 4 survives the category defaults applied at Layer 2.

Phases with well-documented, low-risk patterns:
- **Phase 43 (Catalog Completion):** Pure data entry from real .hsp files — no logic changes; the work is mechanical and the reference corpus is locally available
- **Phase 45 (Unblock):** Single line removal guarded by explicit acceptance criteria; the risk is entirely in Phase 44, not here
- **Phase 46 (Prompt Enrichment):** Standard prompt engineering work; cache fragmentation is the only risk, and the existing usage logger already provides the monitoring needed

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Anthropic docs verified 2026-03-05; model IDs, pricing, and structured output GA status confirmed; no new packages needed eliminates all integration uncertainty |
| Features | HIGH | Six feature areas clearly defined with explicit code file targets; P1/P2/P3 priority established; two anti-features (AI numeric params, Haiku for ToneIntent generation without A/B validation) explicitly ruled out with rationale |
| Architecture | HIGH | 10 real .hsp files inspected from local corpus; 5 bugs confirmed with exact code locations and fix strategies; component status table (REWRITE/MODIFY/NO CHANGE) established for every affected file |
| Pitfalls | HIGH | 10 pitfalls identified from direct codebase inspection, real .hsp file analysis, and official Anthropic caching documentation; each includes warning signs, recovery steps, and specific phase assignment |

**Overall confidence:** HIGH

### Gaps to Address

- **Agoura amp defaultParams for the 6 missing catalog entries:** Phase 43 must extract exact numeric values from real .hsp files for `Agoura_AmpRevvCh3Purple`, `Agoura_AmpSolid100`, `Agoura_AmpUSDoubleBlack`, `Agoura_AmpUSLuxeBlack`, `Agoura_AmpUSPrincess76`, and `Agoura_AmpUSTweedman`. The architecture file specifies amp categories by real-world analogy but the exact `defaultParams` numeric values need ground-truth extraction, not estimation.
- **Reverb PreDelay parameter key verification:** FEATURES.md flags that `PreDelay` must be confirmed as an accepted parameter key in Helix reverb model `.hlx` format before adding it to `GENRE_EFFECT_DEFAULTS`. This is a quick file inspection task needed at the start of Phase 46.
- **Haiku 4.5 A/B quality test for planner routing:** The cost savings case is clear (3x lower cost per generation call) but the quality gate has not been run. This test requires 20+ diverse tone goals with both models and a defined evaluation rubric. Treat as a separate planning item for after v4.0 ships.
- **Effect combination logic context-passing architecture:** FEATURES.md flags that `param-engine.ts` currently processes each block in isolation — interaction-aware params require either passing the full chain as context to `resolveDefaultParams()` or a second post-resolution pass. This architectural decision is deferred to v4.1 but should be tracked as a known design constraint.

## Sources

### Primary (HIGH confidence)
- [Anthropic Models Overview](https://platform.claude.com/docs/en/about-claude/models/overview) — Haiku 4.5 model ID (`claude-haiku-4-5-20251001`), Sonnet 4.6 pricing, structured output GA status (verified 2026-03-05)
- [Anthropic Prompt Caching Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control: ephemeral`, cache read pricing 0.1x, cache bucket behavior
- [Anthropic Model Deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations) — Haiku 3.5 retired, Haiku 3 deprecated April 2026
- [Anthropic Structured Outputs Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — `zodOutputFormat`, GA status on Haiku 4.5 and Sonnet 4.6
- [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105) — Current firmware version, new Agoura amps in 1.2
- Real .hsp file corpus: 10 presets from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/ — block structure, param encoding, slot positions confirmed by direct inspection
- `tmp-stadium-research/real-cranked-2203-pretty.json` — Agoura amp params, cab params, reference for all 5 format bugs
- [Tonevault 250-preset analysis](https://www.tonevault.io/blog/250-helix-amps-analyzed) — per-amp parameter ranges, Drive/Presence anti-correlation for Rectifier-style amps (data-driven primary source)
- Direct codebase inspection: `stadium-builder.ts`, `param-engine.ts`, `chain-rules.ts`, `planner.ts`, `models.ts`, `tone-intent.ts`, `validate.ts`, `config.ts`, `generate/route.ts` — ground truth for all integration points

### Secondary (MEDIUM confidence)
- [Line 6 Community — Gain Staging, Master Volume, Channel Volume](https://line6.com/support/topic/32285-controlling-gain-master-volume-and-channel-volume/) — amp parameter semantics
- [HelixHelp Common Amp Settings](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — per-model Drive/Master guidance
- [Strymon Signal Chain Guide](https://www.strymon.net/setting-up-your-effect-signal-chain/) — effect ordering (confirmed with BOSS and Reverb News)
- [Sweetwater BPM to Delay Times Cheat Sheet](https://www.sweetwater.com/insync/bpm-delay-times-cheat-sheet/) — tempo-synced delay formulas
- [iZotope Reverb Pre-Delay](https://www.izotope.com/en/learn/reverb-pre-delay) — pre-delay ranges by application
- [Fluid Solo — Stadium presets](https://www.fluidsolo.com/) — community .hsp preset source for reverse engineering
- [Gemini vs Haiku 4.5 comparison](https://blog.galaxy.ai/compare/claude-haiku-4-5-vs-gemini-2-5-flash) — model quality tradeoffs
- "When Better Prompts Hurt" (arxiv 2025, https://arxiv.org/html/2601.22025v1) — structured output regression from prompt changes; extraction pass rate drop documented empirically

### Tertiary (LOW confidence)
- Per-amp Drive/Master numeric values for non-master-volume amps (US Deluxe, AC30, Hiwatt, Matchless) — derived from community preset analysis and HelixHelp; requires hardware validation before encoding in param tables
- [Noise Harmony free Stadium preset packs](https://www.noiseharmony.com/post/free-presets-for-line-6-helix-stadium-aura-reflections) — additional .hsp corpus source if more Agoura amp examples are needed

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
