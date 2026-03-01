# Project Research Summary

**Project:** HelixAI — AI-powered Helix preset generator
**Domain:** AI-powered Line 6 Helix preset generation
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

HelixAI is an AI-powered tone consultant that interviews guitarists and produces downloadable .hlx preset files for the Line 6 Helix LT and Helix Floor. The current app already loads files correctly on hardware — the problem is tone quality. Research confirms the root cause: the existing system asks AI to generate complete preset specs including all numeric parameter values, which LLMs are fundamentally poor at. Domain experts (professional Helix preset makers) succeed not because they know which amp to pick, but because they encode deep knowledge of cab filtering, gain staging, signal chain ordering, and snapshot design — expertise that must live in deterministic code, not AI prompts.

The recommended approach is a Planner-Executor architecture. The AI (Claude Sonnet 4.6 with constrained structured output via `output_config`) narrows its job to creative selection only: which amp model, which cab, which effects, what tone intent per snapshot. A deterministic Knowledge Layer — `param-engine.ts`, `chain-rules.ts`, and `snapshot-engine.ts` — then converts those creative choices into a complete, expert-validated PresetSpec using research-backed parameter rules. This separates what AI is good at (semantic matching: "this should sound like a Friedman BE-100 with an 808 in front") from what it is bad at (numeric optimization: "Drive should be 0.47 specifically for this amp category"). The resulting preset quality should be predictably high rather than probabilistically decent.

The key risks are: (1) the .hlx format has no official documentation, so `@type` block constants must be verified against real HX Edit exports before any build begins; (2) cab low/high cut filtering is the single largest quality lever and must be enforced as a required field, not an optional one; and (3) snapshot block state keys are fragile across the validation pipeline and must be rebuilt programmatically from the final signal chain rather than trusted from AI output. All three risks are preventable with discipline in Phase 1.

---

## Key Findings

### Recommended Stack

The existing stack — Next.js 16, TypeScript 5, Tailwind CSS 4, Zod 4.3.6 — requires no changes. All three major AI SDKs are already installed. The rebuild is architectural, not dependency-based. No new packages are needed.

**Core technologies:**
- **Claude Sonnet 4.6** via `@anthropic-ai/sdk` 0.78.0 — AI preset generation — lowest hallucination rate (~3%) of tested providers; constrained decoding via `output_config.format.type: "json_schema"` guarantees schema-compliant output at the token level; ~$0.02/generation at this app's scale
- **Gemini 2.5 Pro** via `@google/genai` 1.42.0 — chat interview phase — keep existing; 2M context window and Google Search grounding are ideal for artist/rig research; do NOT use for PresetSpec generation (schema complexity limits cause 400 errors)
- **Zod 4.3.6** — schema validation + JSON Schema generation — use `z.toJSONSchema()` to derive Claude's `output_config` schema from the same Zod definition used for TypeScript types; single source of truth; 14.71x faster than v3
- **Next.js 16 App Router** — API routes for chat and generation — streaming via `client.messages.stream()` resolves Vercel Hobby plan's 10-second function timeout constraint
- **Vercel (Hobby tier)** — deployment — no change needed; streaming responses make the timeout non-blocking

**What to remove:** The `openai` package (`openai@6.25.0`) can be uninstalled after single-provider migration. GPT-4o is a viable fallback but has ~6% hallucination rate (double Claude's) and intermittent structured output reliability issues in community reports for newer model snapshots.

### Expected Features

**Must have (table stakes — missing these means presets sound bad):**
- Cab block low cut (80–100 Hz) and high cut (5–8 kHz) on every cab block — the single largest contributor to muddiness and digital fizz; must be required fields, not optional
- Post-cab EQ block (Parametric EQ after cab) with genre/category-appropriate cuts at 300–500 Hz (mud) and 3–5 kHz (harshness)
- Always-on boost block before amp — Minotaur (Klon) for clean/crunch, Scream 808 for high-gain — mirrors professional practice; adds compression, mid push, dynamic response
- Amp-category-specific parameter defaults — clean amps run Master at 1.0 and Drive at 2–3; high-gain amps run Drive at 3–5 (NOT 8–10) with a boost pedal pushing the front end; these must live in code, not prompts
- Correct signal chain block order — enforced structurally, not as a suggestion (Gate → Boost → Amp → Cab → EQ → Mod → Delay → Reverb)
- Noise gate — input block gate always enabled; Horizon Gate post-amp for high-gain
- Mic selection by category — 121 Ribbon for clean/jazz, 57 Dynamic for distorted, blend for crunch
- 4-snapshot minimum (Clean, Rhythm, Lead, Ambient) with volume-balanced Channel Volume per snapshot and Trails enabled on delay/reverb
- Downloadable .hlx file with correct HX Edit-compatible JSON structure

**Should have (competitive differentiators — what ToneBuilder.ai lacks):**
- Snapshot volume balancing via ChVol overrides (lead snapshot +2–3 dB via Volume block; clean as reference)
- Dual cab/dual mic blending (SM57 60-70% + 121 Ribbon 30-40%) — transforms cab sound from good to great
- Post-cab presence recovery (high shelf +0.5–1.5 dB at 6–8 kHz after the high cut)
- Artist/song rig research grounding via Google Search (already integrated)
- Amp topology awareness — cathode-follower amps (Cali Rectifire) need different mid treatment than plate-fed amps (PV Panama)
- Stomp mode footswitch layout for live-ready presets
- Helix Floor device ID support alongside Helix LT (same format, one config value)

**Defer to later milestones:**
- Pickup-aware calibration (single-coil vs. humbucker EQ differences) — medium complexity, add as a v2 interview question
- Extended snapshots 5–8 — get core 4 right first, then add genre-specific variations
- Full amp topology database (cathode-follower vs. plate-fed tagging) — build incrementally starting with the most common amps
- MIDI/Command Center block assignments — complex, focus on tone first

**Anti-features to explicitly avoid:**
- IR loading — breaks the "download and play" experience; stock Helix cabs are excellent when properly filtered
- Maximum gain / extreme saturation by default — caps drive at 6; uses 808 boost instead
- Too many blocks — target 8–12 blocks per single-path preset; leave DSP headroom
- Parallel dual-amp paths as default — serial single-path is correct; dual-path only for specific genre patterns
- User accounts, preset rating, multi-provider comparison UI — keep it stateless and focused

### Architecture Approach

The architecture is a strict Planner-Executor separation: the AI generates a narrow `ToneIntent` (~15 fields: amp name, cab name, guitar type, effect list, snapshot intents), and a deterministic Knowledge Layer converts that into a complete, expert-validated `PresetSpec`. The Knowledge Layer cannot be overridden by AI output. This eliminates the root cause of current quality failures — AI generating wrong numeric parameters — while preserving AI's genuine strength: creative model selection based on artist/genre research.

**Major components:**
1. **Interview** (`/api/chat`, Gemini streaming) — existing, keep; gathers tone intent over multiple turns via conversational chat with Google Search grounding
2. **Planner AI** (`planner-prompt.ts`, Claude Sonnet 4.6 with structured output) — new; receives conversation history, outputs a validated `ToneIntent` JSON (amp name from approved list, cab name from approved list, effects, snapshot intents); the approved model ID list is enumerated in the prompt, preventing hallucination
3. **Knowledge Layer** — the core rebuild:
   - `chain-rules.ts` — deterministic signal chain assembly: enforces DSP0/DSP1 split, block ordering, inserts mandatory blocks (always-on boost, post-cab EQ, noise gate); no AI involvement
   - `param-engine.ts` — pure function lookup tables; given amp category + guitar type + tone role, returns expert parameter values (normalized 0–1); encodes Tonevault consensus findings in code
   - `snapshot-engine.ts` — generates volume-balanced snapshot scenes via ChVol overrides by role; determines block states per snapshot deterministically
4. **Template Engine** (`preset-builder.ts`) — existing, refactored; pure structural translation of `PresetSpec` to `.hlx` JSON; makes no decisions
5. **Validator** (`validate.ts`) — existing, hardened; fail-fast on structural errors (not silent auto-correction); block state keys rebuilt from final signal chain before build

**Data flow:** Interview → POST /api/generate → Planner (AI, ToneIntent out) → chain-rules (BlockSpec[]) → param-engine (parameters resolved) → snapshot-engine (SnapshotSpec[]) → buildHlxFile() → validate → .hlx download

**Invariant:** The Knowledge Layer (`chain-rules`, `param-engine`, `snapshot-engine`) must never call into the AI layer. Data flows one direction: AI → Knowledge Layer → Builder.

### Critical Pitfalls

1. **Missing cab LowCut/HighCut (the #1 muddiness cause)** — Make `LowCut` and `HighCut` required (not optional) on `HlxCab` type; inject safe defaults (80 Hz / 6500 Hz for standard, 100 Hz / 5000 Hz for high-gain) in `preset-builder.ts` if absent; validate in `validate.ts` that no cab has LowCut < 60 or HighCut > 10000. Address in Phase 1.

2. **Unverified `@type` block constants** — `BLOCK_TYPES` in the current `models.ts` assigns `@type: 0` to DISTORTION, DYNAMICS, EQ, WAH, PITCH, and VOLUME — six unrelated categories sharing one value. This was never verified against real HX Edit exports. Before writing a single line of engine code, export 5–10 representative presets from HX Edit and verify every `@type` value by direct inspection. Wrong constants cause silent firmware misinterpretation. Address before Phase 1 starts.

3. **AI hallucinating invalid model IDs** — LLMs pattern-match on `HD2_*` naming and invent IDs. The fix is two-layered: enumerate the complete valid model ID list in the Planner prompt, AND use Claude's `output_config` with a JSON Schema `enum` constraint on `modelId` so invalid IDs are rejected at the token level. The current auto-correction via trigram similarity hides the problem rather than fixing it. Address in Phase 3 (AI layer) after the Knowledge Layer exists.

4. **Silent snapshot block state loss** — The current `resolveBlockKey()` silently drops block references when global vs. per-DSP numbering mismatches. The fix: after validation, rebuild all snapshot `blockStates` programmatically from the final signal chain. Never trust AI-generated block keys. Address in Phase 1 (infrastructure) and Phase 2 (snapshot engine).

5. **No snapshot volume balancing** — AI generates snapshot block states without computing cumulative gain impact. Lead snapshot with OD enabled is typically 4–8 dB louder than clean. The snapshot engine must inject ChVol overrides by role (`clean: 0.68`, `crunch: 0.75`, `lead: 0.85`, `ambient: 0.65`) as a hard rule, not an AI suggestion. Address in Phase 2 (Knowledge Layer).

**Additional critical items:**
- DSP block limit (8 non-cab blocks per DSP) must be validated — error 8701 causes preset to refuse loading on hardware
- Parameter type system — `Mic` on cab is an integer 0–7, not a normalized float; LowCut/HighCut are Hz values; must be type-specific validation, not generic 0–1 clamping
- Hardcoded firmware version (FW 3.70) excludes models added in 3.71–3.80; parameterize before launch

---

## Implications for Roadmap

Based on research, the dependency graph is clear: you cannot build the Planner until the model database exists (it needs the approved ID list for the prompt), you cannot build the Knowledge Layer until types are defined, and you cannot wire the orchestration route until all Knowledge Layer components exist. This dictates a strict build order.

### Phase 1: Foundation
**Rationale:** Everything else depends on these. The type system defines the contract between every component. The model database provides the approved ID list the Planner needs and the expert defaults the param engine uses. The `@type` constant verification is a prerequisite for all .hlx file building — wrong constants silently corrupt output and must be resolved before any other work.
**Delivers:** `ToneIntent` type + schema, expanded `models.ts` with category data and cab affinities, verified `@type` constants, `LowCut`/`HighCut` made required fields on cab types, parameter type registry (which params are Hz, integer index, normalized float)
**Addresses:** Must-have features (correct .hlx structure, cab filtering as required fields)
**Avoids:** Pitfalls 1 (cab filtering), 2 (unverified @type constants), 7 (out-of-range parameters), Debt 4 (unverified block type constants)

### Phase 2: Knowledge Layer
**Rationale:** The deterministic core of the rebuild. These three modules — `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts` — encode all the expert knowledge from the Tonevault analysis, Sweetwater documentation, and Line 6 community consensus. They depend only on Phase 1 types and models, have no AI dependencies, and can be unit-tested in isolation. Getting these right before touching the AI layer means quality is verifiable without AI costs.
**Delivers:** `chain-rules.ts` (DSP split, block ordering, mandatory block insertion), `param-engine.ts` (category-specific amp/cab parameters), `snapshot-engine.ts` (volume-balanced scenes with ChVol overrides by role)
**Addresses:** Must-have features (amp-category defaults, always-on boost, noise gate, signal chain order, snapshot design, volume balancing)
**Avoids:** Pitfalls 4 (uniform drive settings), 5 (snapshot block state loss), 6 (no dynamic responsiveness), 8 (wrong signal chain order), 9 (no volume balancing), 10 (generic noon EQ)

### Phase 3: AI Integration
**Rationale:** The Planner is narrow by design — it generates ~15 fields, not 50+. It can only be built after the Knowledge Layer exists (to know what creative choices to ask for) and after the model database is complete (to enumerate valid IDs in the prompt). The constrained schema via Claude's `output_config` is the primary defense against hallucinated model IDs. This phase is shorter than it sounds because the AI is doing less.
**Delivers:** `tone-intent.ts` (ToneIntent Zod schema + JSON Schema export), `planner-prompt.ts` (narrow creative prompt with full model ID enumeration), Claude Sonnet 4.6 integration with `output_config` structured output, Gemini chat phase unchanged
**Addresses:** Must-have feature (single best AI provider); differentiators (artist/song grounding, correct amp model selection)
**Avoids:** Pitfall 3 (hallucinated model IDs — `enum` constraint in schema + complete ID list in prompt)

### Phase 4: Orchestration
**Rationale:** Wires together all previously built components into the `/api/generate` route. This phase cannot start until Phase 2 (Knowledge Layer) and Phase 3 (AI layer) are both complete. It is primarily integration work — the logic lives in the components, not the route.
**Delivers:** Rebuilt `/api/generate/route.ts` that orchestrates Planner → chain-rules → param-engine → snapshot-engine → buildHlxFile(); end-to-end preset generation with real output; `preset-builder.ts` refactored to pure structural translation; `validate.ts` hardened with fail-fast mode and programmatic block state rebuilding
**Addresses:** All must-have features end-to-end; downloadable .hlx file
**Avoids:** Pitfall 5 (snapshot key conflicts — programmatic rebuild after validation); Gotcha 5 (snapshot parameter override key conflicts)

### Phase 5: Frontend Polish
**Rationale:** The Warm Analog Studio aesthetic is strong and validated. Polish happens after the generation quality is confirmed working end-to-end — no point refining UI against a broken backend. This phase adds the device selector (LT vs. Floor) and any UX improvements surfaced during testing.
**Delivers:** Device selector UI (Helix LT vs. Floor targeting separate device IDs), refined preset generation UX, any loading/error state improvements
**Addresses:** Should-have (Helix Floor device ID support)
**Avoids:** Scope creep — no new features, only polish of what exists

### Phase 6: Hardening
**Rationale:** The "looks done but isn't" checklist from PITFALLS.md identifies 12 distinct failure modes that make presets appear functional but are actually subprofessional. Hardware testing on a real Helix LT is the only truth. This phase also addresses the technical debt items that will compound over time: firmware version parameterization, telemetry for AI correction rate, and the test suite that makes future changes safe.
**Delivers:** Unit test suite for `chain-rules`, `param-engine`, `snapshot-engine` (assert parameter ranges per amp category, DSP block count limits, cab filter presence); firmware version parameterized as config value; telemetry logging for AI corrections (fail if >2 per generation); hardware-verified preset quality; `openai` package removed
**Addresses:** Should-have (dual cab/mic blending, pickup-aware calibration if time allows)
**Avoids:** Debt 1 (auto-correction hiding failures), Debt 2 (hardcoded firmware version), Debt 3 (no quality testing); Gotcha 1 (JSON parsing fragility), Gotcha 2 (response truncation), Gotcha 3 (LT vs. Floor device ID), Gotcha 4 (DSP block limit), Gotcha 4 (block count enforcement)

### Phase Ordering Rationale

- **Foundation first** because `ToneIntent` type and expanded `models.ts` are imported by every downstream component — they define the API contract
- **`@type` verification before any code** because it is a one-time empirical check that invalidates a hard-to-diagnose class of silent hardware bugs; doing it later means potentially rebuilding verified output
- **Knowledge Layer before AI layer** because (a) the Knowledge Layer has no AI dependency and can be unit-tested cheaply, (b) the Planner prompt needs the model ID list from the completed database, and (c) quality can be validated deterministically before spending AI tokens
- **Orchestration after both layers** because it is pure wiring — no logic, just sequencing already-tested components
- **Frontend and hardening last** because they depend on confirmed end-to-end generation; polish on a broken generator wastes time

### Research Flags

**Phases needing deeper research or careful investigation during planning:**
- **Phase 1 (Foundation — `@type` verification):** No official Line 6 .hlx schema documentation exists. The `@type` constant values are community reverse-engineered. Allocate time to export and inspect real HX Edit presets before coding. If the constants are wrong, everything built on them is wrong.
- **Phase 2 (Knowledge Layer — amp topology database):** The cathode-follower vs. plate-fed distinction for mid EQ strategy requires tagging every amp model with its topology type. Research may be needed per model for the less common amps. Start with the 10–15 most common amp models; expand incrementally.
- **Phase 6 (Hardening — firmware 3.80 model additions):** Models added in FW 3.71–3.80 need to be catalogued and added to `models.ts` with their correct `HD2_*` IDs. This requires either community sources or direct export inspection.

**Phases with standard patterns (skip additional research):**
- **Phase 3 (AI Integration):** Claude's `output_config` structured output is well-documented with official Anthropic docs. The ToneIntent schema is small and straightforward. No research needed.
- **Phase 4 (Orchestration):** Pure wiring of already-defined components. Standard Next.js Route Handler patterns.
- **Phase 5 (Frontend Polish):** Existing Warm Analog Studio codebase. Standard React/Tailwind work.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified against official docs as of 2026-03-01. Claude Sonnet 4.6 structured output GA-confirmed. Zod v4 built-in `z.toJSONSchema()` verified. No new packages needed. |
| Features | HIGH | Core cab filtering, amp parameter ranges, and signal chain rules verified across Line 6 official forums (HIGH confidence), Sweetwater editorial (HIGH confidence), and Tonevault empirical analysis of 250 real presets (MEDIUM confidence — community methodology, findings consistent across sources). |
| Architecture | HIGH | Planner-Executor pattern is an established LLM architecture pattern. Component boundaries verified against codebase inspection. Data flow confirmed against existing `/api/generate` route. ChVol snapshot balancing confirmed by Line 6 documentation and Helix Help. |
| Pitfalls | HIGH | Multiple independent sources confirm each pitfall. Cab filtering physics confirmed by Line 6 engineer posts. `@type` sharing issue confirmed by direct codebase inspection. Hallucination risk confirmed by Fractal Audio forum experiment and LLM hallucination research. Block state loss confirmed by codebase audit (`validate.ts` behavior). |

**Overall confidence: HIGH**

### Gaps to Address

- **`@type` constant values for all block categories** — Must be empirically verified against real HX Edit exports before Phase 1 code is written. Current values (DISTORTION, EQ, WAH, DYNAMICS, PITCH, VOLUME all sharing `@type: 0`) are unverified. No mitigation strategy can substitute for direct hardware verification.

- **Parameter encoding for Hz-valued fields** — `LowCut` and `HighCut` on cab blocks: the current codebase is inconsistent about whether these are stored as raw Hz values (80, 6500) or as normalized floats. The prompt currently says "LowCut: 80 means 80Hz" but `validate.ts` applies 0–1 clamping. This must be resolved to a single, correct encoding before the parameter type registry is built. Verify by inspecting a real .hlx export.

- **Helix firmware 3.80 model catalog** — The model database covers FW 3.70 models. Six new amps and four new cabs were added in 3.71–3.80. These are missing from the approved ID list the Planner will use. Resolution: catalog during Phase 1 database expansion using community sources (Helix Help model list, Line 6 release notes).

- **DSP cost per block type** — BenVesco's DSP allocation table (MEDIUM confidence) is the only data for per-block DSP costs. For poly pitch and complex reverbs, the 8-block-per-DSP rule may be insufficient — a single poly block can consume 50%+ of one DSP. The generation rules should warn on high-cost block combinations. Resolution: use BenVesco data as the working reference; treat poly effects as DSP-budget items requiring special handling.

- **Dual cab/mic parameter interaction** — The dual mic blending (SM57 + 121 Ribbon blend) is documented as a differentiating feature but the exact parameter names and valid ranges for the `Cab > Dual` block in the .hlx format are not fully documented. Resolution: export a known-good dual-cab preset from HX Edit and inspect the JSON structure directly during Phase 6.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Structured Outputs — Official Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA status, constrained decoding, `output_config` API surface, supported model list
- [Line 6 Community — Lo Cut & Hi Cut filters in HX Stomp](https://line6.com/support/topic/56578-lo-cut-hi-cut-filters-in-hx-stomp/) — Confirmed 6 dB/oct slope on cab filters with engineer response
- [Line 6 Community — Why do Helix Cabs and IRs Need Low and Hi Cuts?](https://line6.com/support/topic/30066-why-do-helix-cabs-and-irs-need-low-and-hi-cuts/) — Physics of cab filtering requirement
- [Line 6 Blog — Joe Gore: The Secret Power of Helix Snapshots](https://blog.line6.com/2019/12/04/joe-gore-the-secret-power-of-snapshots/) — Official snapshot design guidance
- [Sweetwater InSync — Understanding Helix Amp Parameters](https://www.sweetwater.com/insync/understanding-helix-amp-parameters/) — Amp parameter behavior confirmed
- [Sweetwater InSync — Double Down for the Best Line 6 Helix Tone](https://www.sweetwater.com/insync/double-best-line-6-helix-tone/) — Signal chain best practices
- [Helix Help — The Blocks](https://helixhelp.com/tips-and-guides/helix/the-blocks) — Block types, DSP constraints, signal chain ordering
- [Helix Help — Snapshots](https://helixhelp.com/tips-and-guides/helix/snapshots) — Snapshot parameter mechanics
- [Helix Help — Common Amp Settings](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — Parameter ranges by amp type
- [HX Stomp DSP block constraint exceeded error](https://line6.com/support/topic/57689-hx-stomp-%E2%80%9C-8701-preset-translation-not-supported-dsp-block-constraint-exceeded%E2%80%9D/) — Confirms error 8701 and 8-block-per-DSP limit
- [Zod v4 Release Notes](https://zod.dev/v4) — Built-in `z.toJSONSchema()`, 14.71x speed improvement
- [I built an AI (Chat GPT) powered helper...](https://line6.com/support/topic/67397-i-built-an-ai-chat-gpt-powered-helper-to-help-build-helix-guitar-tones/) — Direct evidence of AI hallucinating Helix model IDs
- Internal codebase (`src/lib/helix/`) — Direct inspection confirming BLOCK_TYPES sharing, parameter clamping logic, silent correction behavior

### Secondary (MEDIUM confidence)
- [Tonevault.io — Dialing in your Helix amps: what the top 250 presets teach us](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Empirical amp parameter ranges from 250 real presets; methodology transparent; findings consistent with official sources
- [BenVesco — Helix DSP Allocations](https://benvesco.com/store/helix-dsp-allocations/) — Per-block DSP costs for FW 3.80
- [Komposition101 — Mastering Amp Parameters on Line6 Helix](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — Parameter ranges by amp type; consistent with official documentation
- [Komposition101 — Volume Matching Presets on Line6 Helix](https://www.komposition101.com/blog/volume-matching-presets-on-line6-helix) — ChVol snapshot balancing techniques
- [ToneBuilder.ai](https://www.tonebuilder.ai/) — Competitor analysis; confirmed no snapshot support, no parallel paths, no Agoura amps
- [Fractal Audio Forum — Can ChatGPT make a good preset...](https://forum.fractalaudio.com/threads/can-chatgpt-make-a-good-preset-that-emulates-a-known-tone-spoiler-no.192542/) — Documented AI failures on comparable hardware generation task
- [Structured Output Comparison across LLM Providers — Medium](https://medium.com/@rosgluk/structured-output-comparison-across-popular-llm-providers-openai-gemini-anthropic-mistral-and-1a5d42fa612a) — Hallucination rate comparison across Claude, GPT-4o, Gemini
- [Reducing hallucination in structured outputs via RAG](https://arxiv.org/html/2404.08189v1) — 21% baseline hallucination vs. <7.5% with RAG; constrained generation further reduces

### Tertiary (contextual)
- [HelixBackupFiles — GitHub (AntonyCorbett)](https://github.com/AntonyCorbett/HelixBackupFiles) — .hlx/.hlb format reverse engineering reference
- [I Like Kill Nerds — Helix Stadium Protocol](https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/) — HD2_* model ID structure (Stadium, not LT, but format is consistent)
- [Line 6 Community — hlx JSON format discussion](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — No official schema; community reverse-engineering reference
- [Gemini 2.5 JSON Schema Vercel AI SDK issue — GitHub](https://github.com/vercel/ai/issues/6494) — Open issue confirming Gemini structured output immaturity

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
