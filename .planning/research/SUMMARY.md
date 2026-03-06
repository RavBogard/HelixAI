# Project Research Summary

**Project:** HelixTones v5.0 — Device-First Architecture Rework
**Domain:** AI-powered guitar preset generator for Line 6 Helix-family hardware
**Researched:** 2026-03-05
**Confidence:** HIGH overall — all findings grounded in direct codebase inspection, real firmware corpus analysis, and verified against official documentation

---

## Executive Summary

HelixTones v5.0 is a targeted architectural rework of an existing, fully-shipped AI guitar preset generator. The app supports six Line 6 hardware devices and uses a Planner-Executor pipeline (Claude Sonnet 4.6 for structured preset planning, Gemini 2.5 Flash for conversational interview) deployed on Vercel/Next.js with Supabase. Two confirmed post-v4.0 production bugs are driving this milestone: Agoura amp names leaking into non-Stadium device presets (causing invalid model selections), and Stadium presets emitting only 12 of 27 required firmware parameters per amp block (causing unpredictable "param bleed" from previously loaded presets on hardware). Both bugs share the same root cause: device identity enters the pipeline too late and the shared model catalog is structurally unsound.

The recommended approach is a sequential architectural migration: establish a `DeviceFamily` routing layer, extract per-family amp catalogs (eliminating the merged `AMP_NAMES` enum), create per-family Zod schemas for constrained AI output, migrate Knowledge Layer guard sites to a `DeviceCapabilities` object, complete Stadium firmware params from real .hsp corpus, isolate per-family prompts, and finally relocate the device picker to conversation start. No new npm packages are required. The entire rework is TypeScript source reorganization within the existing stack. The critical path is catalog isolation before schema isolation before guard removal — doing these out of order breaks all six devices simultaneously.

The primary risks are cache economics during planner prompt splitting (Stadium and Pod Go have low enough request volume that separate cache buckets may never warm), database migration for resumed legacy conversations (existing rows lack a `device` column), and partial guard removal leaving the codebase in a hybrid state that is harder to maintain than either the old or new pattern. All three risks have clear avoidance strategies documented in PITFALLS.md and must be explicitly in-scope — not deferred — during each phase.

---

## Key Findings

### Recommended Stack

No new dependencies are required for v5.0. The existing stack handles every technical requirement for this rework.

**Core technologies:**
- **TypeScript ^5:** Discriminated union `DeviceFamily` type with `assertNever()` exhaustiveness checking — new devices produce compile errors immediately when not handled; `z.discriminatedUnion()` confirmed working in installed Zod 4.3.6
- **Zod ^4.3.6:** Per-family `ToneIntentSchema` built via factory function `buildToneIntentSchema(family)` — each schema's `ampName` enum is scoped to only the valid models for that family; this is the structural fix to constrained-decoding escape
- **`@anthropic-ai/sdk` ^0.78.0:** `zodOutputFormat()` accepts any Zod object schema, so per-family schemas slot in identically to the current global schema
- **Vitest ^4.0.18:** File-per-device test organization using existing `describe()` nesting — no new test configuration needed
- **Node.js `Buffer` + `JSON.parse()`:** .hsp format is 8-byte ASCII magic header + JSON text; `data.slice(8)` is sufficient — no binary parser library needed for corpus extraction

See [STACK.md](.planning/research/STACK.md) for version compatibility table and full pattern documentation.

### Expected Features

**Must have (table stakes — required to close v5.0 architectural gaps):**
- Device picker relocated to before the first chat message — P0 architectural prerequisite; all other features depend on device context being established at session start
- Device-specific planner prompts with isolated model catalogs — each of the four device families gets its own prompt builder importing only its own amp catalog; eliminates Agoura leak by construction
- Stadium firmware parameter completeness — emit all 27+ params per amp block from real .hsp corpus extraction; fixes param bleed (critical quality failure, not cosmetic)
- Device-specific Gemini chat system prompts — Stomp constraint interview arc, Pod Go budget framing, Stadium Agoura-first arc, Helix dual-amp arc; each injected from device context at session start

**Should have (competitive differentiators, same milestone):**
- Device-specific chain validation modules — migrate per-device validation from 17+ guard sites to `DeviceChainRules` implementations; Stomp dual-amp rejection, Pod Go 4-effect enforcement, Stadium HD2 amp rejection
- Device family UI grouping — four family cards (Stadium / Helix / Stomp / Pod Go) with variant picker inside; reduces cognitive load and matches user mental model

**Defer (v5.1+ — architecture hygiene, not features):**
- Full guard removal from chain-rules.ts and param-engine.ts — only after device modules are stable and tested; guards become dead code once routing is in place, but removal is zero user-facing impact
- New device variant support (Stadium XL, Helix Rack, Pod Go XL) — each requires corpus inspection of real exports before any code; do not add to `DeviceTarget` union until device IDs confirmed from real files

See [FEATURES.md](.planning/research/FEATURES.md) for prioritization matrix, device constraint conversation patterns, and anti-feature analysis.

### Architecture Approach

The v5.0 architecture replaces 17+ boolean guard sites (`isPodGo`, `isStadium`, `isStomp`) scattered across shared files with a single `resolveFamily(device)` router and a `DeviceCapabilities` object that carries all device constraints. Per-family amp catalog modules (`families/stadium/catalog.ts`, `families/helix/catalog.ts`, etc.) eliminate the merged `AMP_NAMES` enum that allows cross-device model contamination. The Knowledge Layer (`chain-rules.ts`, `param-engine.ts`, `validate.ts`) accepts `DeviceCapabilities` instead of `device?: DeviceTarget`, removing guard sites while preserving the existing Planner-Executor architecture without any API route changes.

**Major components and their responsibilities:**
1. **`families/index.ts` (new):** `resolveFamily()` exhaustive switch, `getCapabilities()` factory, `DeviceFamily` type — the single registration point for device-to-family mapping
2. **`families/{family}/catalog.ts` (4 new files):** Per-family amp catalogs — Stadium gets Agoura amps only, Helix/Stomp/PodGo get HD2 amps; structural fix to the cross-contamination root cause
3. **`families/{family}/prompt.ts` (4 new files):** Per-family chat and planner prompt sections — injected by `getSystemPrompt(family)` and `buildPlannerPrompt(family, device)`
4. **`families/stadium/params.ts` (new):** 27-param firmware completeness table extracted from real .hsp corpus — merged into `stadium-builder.ts` output to eliminate param bleed
5. **Modified Knowledge Layer:** `chain-rules.ts`, `param-engine.ts`, `validate.ts` accept `DeviceCapabilities` — same logic, guard pattern replaced by capability field access

**Build order (critical):** Phase 1 (family router + capabilities) → Phase 2 (catalog extraction) → Phase 3 (per-family ToneIntent schemas) → Phase 4 (Knowledge Layer guard removal) | Phase 5 (Stadium firmware params, parallel) → Phase 6 (prompt isolation) → Phase 7 (frontend picker relocation).

See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full data flow diagrams, component integration map, and build order dependency graph.

### Critical Pitfalls

1. **Splitting the planner prompt destroys the shared cache** — Each new unique system prompt creates a separate cache bucket. Stadium and Pod Go have far fewer daily users than Helix LT, so their separate buckets may never warm. Prevention: model per-device request volume before splitting; if low-volume devices cannot sustain cache hits, group them into shared "constrained-device" prompt buckets.

2. **Per-family prompts without per-family Zod schemas leaves contamination open** — Even with device-specific planner prompts, the current combined `AMP_NAMES` enum allows constrained decoding to select Agoura amps for non-Stadium requests. Schema isolation (Phase 3) must ship in the same milestone as prompt isolation (Phase 6) — not deferred.

3. **Moving device selection to conversation start breaks resumed legacy conversations** — The `conversations` table has no `device` column. Prevention: `ALTER TABLE conversations ADD COLUMN device TEXT DEFAULT NULL`, backfill from `preset_url` extension heuristic, null-check in all code paths that read `conversation.device`.

4. **Partial guard removal leaves the codebase in a hybrid state** — Converting chain-rules guards but leaving validate.ts guards creates hidden couplings invisible from device modules. Prevention: define end state before writing any code; document remaining guard sites in STATE.md if not fully converted.

5. **Firmware param extraction from a single .hsp file produces biased defaults** — Single-reference extraction biases all generated Stadium presets toward that reference's tone character. Prevention: extract median from 5+ real .hsp files per amp model; validate unit types against Line 6 documentation.

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 10 pitfalls with phase-to-pitfall mapping, recovery strategies, and the "Looks Done But Isn't" verification checklist.

---

## Implications for Roadmap

Based on the combined research, seven phases are the correct structure. The architecture research's build order is authoritative — dependency relationships are firm, confirmed by codebase inspection.

### Phase 1: Family Router and Capabilities Foundation
**Rationale:** Pure addition — no existing files modified. Creates the type system foundation that every downstream phase depends on. Zero regression risk. Must ship first.
**Delivers:** `DeviceFamily` type, `resolveFamily()` exhaustive switch, `getCapabilities()` factory, `DeviceCapabilities` interface. All six devices map to four families. TypeScript exhaustiveness enforced from this point forward.
**Addresses:** The architectural prerequisite for all other features — device identity becomes a compile-time-enforced routing decision, not a scattered runtime concern.
**Avoids:** Starting catalog extraction or guard removal before the type system exists (would require retrofit and creates transient broken state).
**Research flag:** Standard TypeScript patterns — no research phase needed; patterns documented in STACK.md with verified code examples.

### Phase 2: Catalog Extraction (Highest Risk Phase)
**Rationale:** The structural fix to the Agoura leak root cause. Must happen before schema isolation and prompt isolation, because both depend on family-scoped catalog modules as their source of truth. Highest regression risk in the milestone because `AMP_MODELS` and `STADIUM_AMPS` are currently imported by chain-rules.ts, param-engine.ts, and validate.ts — all import sites must update atomically.
**Delivers:** `families/stadium/catalog.ts` (Agoura amps only), `families/helix/catalog.ts` (HD2 amps), `families/stomp/catalog.ts`, `families/podgo/catalog.ts`. Merged `AMP_NAMES` enum eliminated from models.ts.
**Avoids:** Pitfall 2 (cross-device contamination persisting after prompt split) — catalog isolation is the structural prerequisite for schema isolation; cannot skip this and rely on prompt filtering.
**Research flag:** No research needed — catalog contents already exist in models.ts; this is extraction and reorganization. Full 6-device test suite must pass before proceeding to Phase 3.

### Phase 3: Per-Family ToneIntent Schemas
**Rationale:** Closes the constrained-decoding escape path. Prompt isolation without schema isolation leaves the Agoura leak exploitable at the token-validation level. This is a non-negotiable companion to prompt work — these two phases must ship in the same milestone.
**Delivers:** `StadiumToneIntentSchema`, `HelixToneIntentSchema`, `StompToneIntentSchema`, `PodGoToneIntentSchema`, and a `getToneIntentSchema(family)` factory. Stadium generation structurally cannot produce an HD2 amp name at the constrained-decoding level.
**Implements:** Per-family catalog modules from Phase 2 as the source of `ampName` enum values.
**Avoids:** Pitfall 2 — incomplete contamination prevention from prompt-only filtering without schema filtering.
**Research flag:** Standard Zod and Anthropic SDK patterns — no research phase needed; confirmed working in installed versions.

### Phase 4: Knowledge Layer Guard Removal
**Rationale:** Replaces 17+ boolean guard sites with capability-driven branching. Zero user-facing impact, but makes adding a 7th device a one-file operation instead of a 17-file search. Can run in parallel with Phase 5.
**Delivers:** `chain-rules.ts`, `param-engine.ts`, `validate.ts` all accept `DeviceCapabilities` instead of `device?: DeviceTarget`. Guard site count in shared files drops to zero (or near-zero with remaining sites documented in STATE.md).
**Avoids:** Pitfall 4 (hybrid guard/module state) — commit to completing the full conversion for all three files in this phase. Requires full 6-device regression test after any shared file change.
**Research flag:** Standard TypeScript refactor — no research phase needed. Risk is regression, not novelty; mitigated by test suite.

### Phase 5: Stadium Firmware Parameter Completeness (Parallel Track)
**Rationale:** Independent of Phases 3 and 4. Can start after Phase 2 (catalog isolation) and run in parallel with guard removal. This is the other P1 correctness bug — param bleed is a critical quality failure that directly affects hardware behavior and user trust.
**Delivers:** `families/stadium/params.ts` with complete 27-param firmware table sourced from real .hsp corpus (median across 5+ files per Agoura amp model). `stadium-builder.ts` extended to merge firmware defaults with param-engine output. Param bleed eliminated. Hardware verification via HX Edit import required before marking complete.
**Avoids:** Pitfall 5 (biased defaults from single reference file). Corpus extraction methodology documented in STACK.md — extraction script at `scripts/extract-stadium-params.ts`, corpus at `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/`.
**Research flag:** NEEDS RESEARCH before implementation — param table must be extracted from real .hsp corpus for each Agoura amp model. Values cannot be inferred; they must be observed. Use `npx tsx scripts/extract-stadium-params.ts` and validate unit types against Line 6 Stadium manual.

### Phase 6: Prompt Isolation
**Rationale:** Creates per-family chat and planner prompt templates. Depends on Phase 2 catalogs for model list generation. Can run after Phase 2 and in parallel with Phase 4. Must complete before Phase 7 because the frontend picker only adds value when the chat API uses device context from session start.
**Delivers:** `families/{family}/prompt.ts` for all four families. `getSystemPrompt(family)` in gemini.ts parameterized by family. `buildPlannerPrompt(family, device)` in planner.ts using family constraints and catalog. Per-family prompt caching: Stadium updates don't invalidate Helix cache.
**Avoids:** Pitfall 1 (cache destruction) — model cache economics per device before splitting; if Stadium/Pod Go request volume too low, merge into a shared "constrained-device" prompt bucket. Verify `cache_read_input_tokens` nonzero for all four device paths post-deploy.
**Research flag:** Standard prompt template patterns — no research phase needed. Cache economics validation is a pre-implementation measurement step, not a research problem.

### Phase 7: Frontend Device Picker Relocation and Database Migration
**Rationale:** The final integration step that surfaces all backend work to users. Device picker moves from post-`[READY_TO_GENERATE]` to before the first chat message. Database migration for legacy conversations must ship in the same phase — not after go-live. These two tasks are coupled: deploying the picker without the migration causes resumed legacy conversation crashes.
**Delivers:** Device picker rendered before chat input; `selectedDevice` in frontend state from first render; `device` sent on every `/api/chat` POST; Supabase `conversations.device` column with backfill from preset_url heuristic; null-handling in all code paths that read `conversation.device`; device update path for mid-conversation device switching.
**Avoids:** Pitfall 3 (resumed conversation crashes) — database migration and null-handling are in-scope, not deferred. Pitfall 7 (orphaned conversations on device switch) — `conversations.device` must be updatable, not set-once on creation.
**Research flag:** Standard Next.js + Supabase patterns — no research phase needed. Migration requires staging verification with real legacy conversation data before production apply.

### Phase Ordering Rationale

- Phases 1-3 are a strict sequential dependency chain: family types must exist before catalog modules, catalog modules must exist before schemas source from them.
- Phase 4 depends only on Phase 1 (capabilities object). Phases 2 and 3 can be complete but are not blocking for guard removal — the Knowledge Layer consumes `ToneIntent` (TypeScript type, unchanged by the schema refactor), not the Zod schema itself.
- Phase 5 depends only on Phase 2 (catalog isolation for amp model IDs as the source of truth for the firmware param table). It is the natural parallel track for a developer working on Stadium while another developer works on Phases 3-4.
- Phase 6 depends on Phase 2 (catalogs for model list generation) and is otherwise independent of Phases 3-4.
- Phase 7 depends on Phase 6 (per-family chat prompts must exist before the frontend picker activates device-specific interviews).
- Critical path: 1 → 2 → 3 → 4 → 6 → 7 (sequential). Parallel track: 5 can run after Phase 2, alongside Phases 3 and 4.

### Research Flags

Phases requiring pre-implementation research:
- **Phase 5 (Stadium Firmware Params):** Firmware param table must be extracted from the real .hsp corpus at `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/`. Use `npx tsx scripts/extract-stadium-params.ts`. STACK.md documents the extraction approach in full. This is an execution research step (run the script, validate output) rather than an exploration step (unknown technology).

Phases with standard patterns (no research needed):
- **Phase 1:** TypeScript discriminated unions + `assertNever()` — fully documented in STACK.md with verified code patterns.
- **Phase 2:** Catalog extraction — contents already exist in models.ts; mechanical reorganization.
- **Phase 3:** Zod schema factory pattern — confirmed working in installed Zod 4.3.6.
- **Phase 4:** Knowledge Layer refactor — 17 guard sites documented in architecture-audit-v4.md; replacement pattern documented in ARCHITECTURE.md.
- **Phase 6:** Prompt template pattern — already exists in planner.ts; reorganization into per-family modules.
- **Phase 7:** Next.js frontend + Supabase migration — standard patterns, well-documented.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against installed packages and official docs. Zero new dependencies. TypeScript patterns confirmed against TypeScript handbook. Zod 4.3.6 `z.discriminatedUnion()` verified against installed package via Node.js execution. |
| Features | HIGH | Direct codebase inspection confirms bug root causes. Feature priority derived from confirmed production bugs and hardware constraint documentation. Competitive analysis (Quad Cortex, BIAS X, Kemper) confirms device-first as industry standard pattern. |
| Architecture | HIGH | All 17+ guard sites documented in architecture-audit-v4.md. Component integration map verified from direct source inspection of all affected files. Build order dependency relationships derived from code imports, not assumptions. |
| Pitfalls | HIGH | All 10 pitfalls grounded in direct codebase inspection. Cache pitfall confirmed from Anthropic prompt caching docs. Resumed-conversation pitfall confirmed from Supabase schema inspection (no `device` column exists in current conversations table). |

**Overall confidence: HIGH**

### Gaps to Address

- **Stadium firmware param completeness (Phase 5):** The 27-param list must be extracted from the real .hsp corpus before Phase 5 implementation. The corpus at `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` has 11 files covering 10 Agoura amp models. For any Agoura amp model not represented in the corpus, use firmware defaults (values from a factory-reset preset on hardware) rather than inventing values.

- **Cache economics per device family:** Request volume per device is not documented in the research files. Before splitting planner prompts in Phase 6, pull production usage logs via `usage-logger.ts` to determine whether Stadium and Pod Go sustain enough daily requests to warrant separate cache buckets. This is a pre-Phase-6 measurement step, not a design question.

- **New device variants (Stadium XL, Helix Rack, Pod Go XL):** Explicitly deferred to v5.1+. Before any future implementation, real exported preset files must be obtained for each variant to confirm device IDs, block budgets, and I/O model IDs. PITFALLS.md documents the specific verification checklist (Pitfalls 6, 9, 10).

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `src/lib/helix/chain-rules.ts`, `validate.ts`, `param-engine.ts`, `planner.ts`, `models.ts`, `tone-intent.ts`, `types.ts`, `gemini.ts` — guard pattern audit, 17+ guard sites documented (2026-03-05)
- `.planning/architecture-audit-v4.md` — 17 guard sites documented, fragility analysis, refactor decision
- `.planning/PROJECT.md` — Stadium param bleed bug (JC Logan), Agoura amp leak, v5.0 scope
- `.planning/STATE.md` — accumulated decisions, Stadium HX Edit verification pending
- Real .hsp corpus: 11 files in `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` — 12 Agoura amp blocks, 10 unique models, complete param set extracted via Node.js (2026-03-05)
- Node.js verification: `z.discriminatedUnion()` confirmed working in installed Zod 4.3.6

### Secondary (HIGH confidence — official documentation)
- [TypeScript Handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) — exhaustiveness checking with `never`
- [Zod discriminatedUnion docs](https://zod.dev/api) — `z.discriminatedUnion('key', [...])` API
- [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — cache structure, TTL, per-workspace isolation, pricing
- [Signal Path Routing — Helix Stadium Manual](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — official documentation
- [Amp Blocks — Helix Stadium Manual](https://manuals.line6.com/en/helix-stadium/live/amp-blocks) — Hype, Bright, Contour, Aggression, Depth, Fat params documented
- [HX Stomp block budget — Line 6 Community](https://line6.com/support/topic/36658-hx-stomp-are-6-blocks-enough-not-really/) — community consensus on block budget strategies
- [Sweetwater InSync — Get More Out of HX Stomp](https://www.sweetwater.com/insync/get-much-more-out-of-hx-stomp/) — verified block budget techniques

### Tertiary (MEDIUM confidence — competitive analysis)
- [Quad Cortex review — Guitar Guitar](https://www.guitarguitar.co.uk/news/141684/) — confirms Quad Cortex template-first UX pattern (device-first as industry standard)
- [BIAS X — Guitar World](https://www.guitarworld.com/gear/plugins-apps/positive-grid-bias-x-launch) — format selection before AI tone creation documented
- [tsx documentation](https://tsx.is/) — `npx tsx script.ts` for one-shot extraction scripts

---

*Research completed: 2026-03-05*
*Ready for roadmap: yes*
