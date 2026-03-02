# Project Research Summary

**Project:** HelixAI v1.1 — Polish & Precision
**Domain:** AI-powered guitar preset generation for Line 6 Helix hardware
**Researched:** 2026-03-02
**Confidence:** HIGH

## Executive Summary

HelixAI v1.1 is a targeted precision release on top of a fully functional v1.0 Planner-Executor architecture. The six new features divide cleanly into two categories: backend correctness work (hardware bug fixes, genre-aware effect defaults, smarter snapshot toggling, prompt caching) and frontend visibility work (signal chain visualization, tone description card). Research confirms that all six features integrate through additive changes — no architectural rewrites, no new API routes, and only one new production dependency (`@xyflow/react` 12.10.1 for signal chain visualization). The most important finding across all four research domains is that the Planner-Executor boundary must remain inviolate: genre defaults, snapshot toggling, and all hardware output must continue to be determined by the deterministic Knowledge Layer, not by AI output fields.

The recommended build order is dictated by dependencies: fix hardware bugs first (they affect ground truth for all other features), then prompt caching (isolated, verifiable immediately), then genre defaults and snapshot toggling (backend quality improvements that are independently unit-testable), and finally the two UI features (pure frontend, depend on stable backend data). This sequence allows hardware verification at Phase 1 before any risk of destabilizing preset output, and delivers measurable API cost savings at Phase 2 before the heavier Knowledge Layer work begins. The two UX features are independent of each other and can be built last without blocking anything.

The dominant risk across all six features is silent failure: cache misses that appear to succeed, genre defaults silently overwritten by model defaults, and `@pedalstate` bitmask guesses that produce worse LED behavior than the current hardcoded value. Every feature in v1.1 requires explicit verification criteria, not just "it builds and runs." The PITFALLS research identifies eleven specific failure modes, each with a concrete "looks done but isn't" check that must be part of each phase's definition of done.

---

## Key Findings

### Recommended Stack

The v1.0 stack (Next.js 16, TypeScript 5, Tailwind CSS 4, Claude Sonnet 4.6 with `zodOutputFormat`, `@anthropic-ai/sdk` 0.78.0, Zod 4.3.6, vitest, Gemini for chat) is unchanged. v1.1 adds exactly one new production dependency.

**Core technologies:**
- `@anthropic-ai/sdk` 0.78.0 (already installed): Prompt caching via top-level `cache_control: { type: "ephemeral" }` — this version added automatic caching support on 2026-02-19; no upgrade needed; no beta header required
- `@xyflow/react` 12.10.1 (new, install required): Signal chain visualization — purpose-built for directed node graphs; ~50 lines of component code vs. 200+ of custom SVG; must be lazy-loaded with `next/dynamic({ ssr: false })` to avoid SSR issues; MIT license; React 19 compatible
- All other v1.1 features are pure TypeScript changes to existing modules: `param-engine.ts`, `snapshot-engine.ts`, `preset-builder.ts`, `planner.ts`, plus one new pure utility module `viz.ts`

See `.planning/research/STACK.md` for full version compatibility matrix and installation command.

### Expected Features

**Must have (table stakes — hardware reliability):**
- Fix `@fs_enabled` hardcoded to `false` in `buildFootswitchSection()` — stomps currently require double-press to activate on hardware
- Fix `@pedalstate: 2` hardcoded in all snapshots — pedal LEDs do not reflect active stomp states per snapshot
- `.hlx format audit` — systematic comparison of builder output vs. real HX Edit exports; findings feed `validate.ts` assertions and targeted `preset-builder.ts` fixes

**Must have (table stakes — tone quality):**
- Genre-aware effect defaults for delay time, reverb mix, and modulation rate — blues and metal currently receive identical delay defaults despite requiring opposite approaches
- Signal chain visualization — horizontal read-only block flow in UI before download; users see what they're downloading without inspecting JSON
- Tone description card — structured summary (preset name, amp/cab, 4 snapshot pills with LED colors, guitar tips) using data already in the API response

**Should have (quality and cost improvement):**
- Smarter snapshot effect toggling — wire `EffectIntent.role` ("always_on", "toggleable", "ambient") into `snapshot-engine.ts` block state decisions
- Prompt caching — `cache_control: { type: "ephemeral" }` on system prompt in `callClaudePlanner()`; ~50-60% savings on input token costs per multi-generation session; LOW implementation complexity

**Defer to v1.2+:**
- Pickup-aware tone calibration (single-coil vs. humbucker EQ)
- Dual cab/dual mic blending
- Snapshots 5-8 with genre-specific variations
- Stomp mode footswitch layout (Command Center assignments)

**Anti-features — do not build:**
- Editable signal chain in UI (HX Edit's job; scope explosion)
- Genre selector dropdown (conflicts with chat interview; creates two competing input channels)
- Multiple parameter variation downloads (choice paralysis; defeats the caching benefit)
- Live API cost display (exposes pricing mechanics to users; complex to implement accurately with caching)

See `.planning/research/FEATURES.md` for full prioritization matrix and dependency graph.

### Architecture Approach

All six v1.1 features integrate via additive changes to the existing Planner-Executor pipeline. The data flow is unchanged: Gemini chat → `callClaudePlanner()` → Knowledge Layer (chain-rules, param-engine, snapshot-engine) → `validatePresetSpec()` → `buildHlxFile()` → API response → frontend. Three Knowledge Layer modules receive targeted additions. One new pure utility module (`viz.ts`) derives visualization data from the existing `PresetSpec`. The API route adds `signalChainViz` to the existing response payload. Two new React components render in `page.tsx` using data already returned.

**Major components and v1.1 deltas:**
1. `planner.ts` — Add `cache_control: { type: "ephemeral" }` to `client.messages.create()`; one-line change; verify via `usage.cache_read_input_tokens`
2. `param-engine.ts` — Add `GENRE_EFFECT_DEFAULTS` lookup table keyed by genre keyword; resolution order: model defaults → category overrides → genre overrides (genre wins as outermost layer)
3. `snapshot-engine.ts` — Extend `getBlockEnabled()` and `buildSnapshots()` with ambient Mix overrides; never add new AI fields to `SnapshotIntentSchema`
4. `preset-builder.ts` — Fix `@fs_enabled` to `true` in footswitch section only; extract `computeFootswitchAssignments()` as a pure function; compute `@pedalstate` per snapshot from block states crossed against stomp assignments
5. `viz.ts` (NEW) — `buildSignalChainViz(spec: PresetSpec): SignalChainVizData` pure function; no AI calls, no external deps
6. `api/generate/route.ts` — Add `signalChainViz` to response (additive, one new field)
7. `page.tsx` — Add `ToneDescriptionCard` and `SignalChainViz` components reading from existing response data

**Invariant to preserve:** Knowledge Layer (chain-rules, param-engine, snapshot-engine) never imports from the AI layer. Data flows one way. No v1.1 change breaks this.

See `.planning/research/ARCHITECTURE.md` for complete data flow diagram and build order dependency graph.

### Critical Pitfalls

1. **Dynamic content in system prompt invalidates every cache entry** — Any per-request dynamic content (dates, session context) in the cached prefix causes 100% cache misses with 1.25x write overhead on every request, increasing costs rather than reducing them. Audit all strings in the system prompt before marking cacheable. Verify via `usage.cache_read_input_tokens > 0` on the second identical generation.

2. **Genre string mismatch causes silent fallthrough to model defaults** — `ToneIntent.genreHint` is a free-form string ("blues rock", "shoegaze"); the defaults table uses keyword keys ("blues", "ambient"). Lookup fails silently and genre-aware values are never applied. Use lowercase substring matching with explicit fallback to model defaults.

3. **Genre defaults overwritten by model defaults due to wrong resolution layer order** — If genre overrides are applied before `model.defaultParams`, they are silently overwritten. Genre defaults must be the outermost layer: `{ ...modelDefaults, ...categoryDefaults, ...genreDefaults }`.

4. **`@pedalstate` bitmask computed incorrectly produces worse behavior than the hardcoded `2`** — The bitmask encoding is undocumented. Guessing wrong bit positions causes LED behavior worse than the current hardcode. Export real HX Edit presets and inspect `@pedalstate` values before writing any computation code. If the bitmask cannot be verified empirically, leave the hardcode as a documented limitation.

5. **Smarter snapshot toggling implemented by adding AI fields to `SnapshotIntentSchema`** — Adding new fields to the AI output contract reintroduces non-determinism and defeats the Knowledge Layer principle. All toggling logic must live in `getBlockEnabled()` in `snapshot-engine.ts`. Run existing snapshot-engine tests after any change.

6. **Genre defaults for delay Time in milliseconds instead of normalized float** — Helix delay Time is a normalized 0-1 float in `defaultParams`, not milliseconds. `Time: 500` will produce extreme behavior. Inspect `models.ts` delay `defaultParams` and `param-registry.ts` encoding types before writing any genre defaults values.

See `.planning/research/PITFALLS.md` for all 11 pitfalls with full prevention strategies and the complete "looks done but isn't" verification checklist.

---

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md, the following phase structure is recommended. The build sequence respects hardware truth (fix before build), cost efficiency (verify savings before heavier work), and Knowledge Layer stability (backend stable before UI reflects it).

### Phase 1: Hardware Bug Fixes and .hlx Audit
**Rationale:** Hardware correctness is the foundation for all subsequent features. The `@fs_enabled` and `@pedalstate` bugs are confirmed by hardware testing and documented in PROJECT.md. The `.hlx audit` must precede the fixes because it provides the ground truth values (correct `@fs_enabled` value, `@pedalstate` bitmask mapping) needed to fix the bugs correctly. Building genre defaults or snapshot toggling on top of incorrect hardware output would require later rework.
**Delivers:** Presets that load and respond correctly on Helix hardware on first press; audit checklist preventing future hardware bugs from accumulating undetected
**Addresses:** `@fs_enabled` fix (P1), `@pedalstate` computation (P1), `.hlx format audit` (P1)
**Avoids:** Pitfall 7 (`@fs_enabled` fix applied to wrong section), Pitfall 8 (`@pedalstate` bitmask guessing before real-export inspection)
**Research flag:** Requires hardware inspection during implementation — export 3-4 presets from HX Edit, inspect `@fs_enabled` value in footswitch section, map `@pedalstate` bit positions to footswitch indices. This is empirical, not resolvable from documentation. Plan for 2-3 hours of export inspection before writing `computeFootswitchAssignments()`.

### Phase 2: Prompt Caching
**Rationale:** Isolated, one-line change to `planner.ts` with no downstream effects on preset output. Ships measurable cost savings and can be verified with cache hit metrics before any other changes risk complicating the picture. LOW complexity, independently verifiable.
**Delivers:** ~50-60% reduction in input token costs per multi-generation session; observable via `usage.cache_read_input_tokens` in API response
**Addresses:** Prompt caching (P2)
**Avoids:** Pitfall 1 (dynamic content in cached prefix), Pitfall 2 (prompt too short to cache — verify `cache_creation_input_tokens > 1024`), Pitfall 3 (TTL expiry for infrequent use — consider 1-hour TTL option)
**Research flag:** No additional research needed — standard pattern with official docs. Verify cache metrics before marking done: `cache_creation_input_tokens > 1024` on first call, `cache_read_input_tokens > 0` on second identical call. Check whether `claude-sonnet-4-6` supports the 1-hour TTL beta at implementation time.

### Phase 3: Genre-Aware Effect Defaults
**Rationale:** Backend quality improvement independently testable via unit tests. Must come before snapshot toggling because the ambient snapshot's boosted Mix overrides (Phase 4) interact with genre defaults — the two features should be integration-tested together, but genre defaults must be stable first. The mandatory pre-coding step (inspecting `models.ts` delay `defaultParams` encoding) must happen before any lookup table values are written.
**Delivers:** Delay time, reverb mix, and modulation rate calibrated to detected genre — blues gets slapback; ambient gets long wash; metal gets minimal time-based effects
**Addresses:** Genre-aware effect defaults (P1)
**Avoids:** Pitfall 4 (genre string mismatch — use substring matching with fallback), Pitfall 5 (genre defaults overwritten — apply as outermost resolution layer), Pitfall 11 (delay Time in milliseconds — inspect `param-registry.ts` encoding first)
**Research flag:** Inspect `models.ts` delay/reverb/modulation `defaultParams` and `param-registry.ts` encoding types before writing any genre defaults values. One hour of codebase audit before committing lookup table numbers. Wrong encoding produces broken presets with no visible error.

### Phase 4: Smarter Snapshot Effect Toggling
**Rationale:** Builds on stable genre defaults (Phase 3). Ambient Mix overrides in `buildSnapshots()` interact with genre-tuned effect parameters — verify combined output with integration tests. All toggling logic stays in `getBlockEnabled()` and `buildSnapshots()`; `SnapshotIntentSchema` gains no new fields.
**Delivers:** Musically intelligent snapshot states: ambient snapshot enables reverb + delay + modulation at boosted Mix; clean snapshot disables all drive blocks; crunch snapshot disables delay
**Addresses:** Smarter snapshot effect toggling (P2)
**Avoids:** Pitfall 6 (toggling logic bypassing Knowledge Layer — `SnapshotIntentSchema` must gain zero new fields)
**Research flag:** Standard pattern — extend existing `getBlockEnabled()` deterministic state table. Run full snapshot-engine test suite after any change. No additional research needed.

### Phase 5: Signal Chain Visualization
**Rationale:** Backend must be fully stable before building UI that reflects it. `viz.ts` derives data from `PresetSpec` which is shaped by the Knowledge Layer — genre defaults (Phase 3) and snapshot toggling (Phase 4) should be complete so the visualization reflects final block configuration. The API route change is additive (one new field). The React component is pure display.
**Delivers:** Read-only horizontal block flow visualization in the UI before download; users see amp, effects, DSP path split, and enabled states without decoding JSON
**Addresses:** Signal chain visualization (P1)
**Uses:** `@xyflow/react` 12.10.1 (install at phase start); existing `PresetSpec.signalChain`
**Avoids:** Pitfall 9 (visualization from wrong data layer — component accepts only `signalChain: BlockSpec[]`, never `HlxFile` props)
**Research flag:** Standard pattern. Confirm lazy-load approach (`next/dynamic({ ssr: false })`) prevents SSR breakage before writing the component. `@xyflow/react` docs are thorough.

### Phase 6: Tone Description Card
**Rationale:** Pure frontend, reads from data already in the API response (`spec` and `toneIntent`). Can technically be built at any time after Phase 1, but building it last ensures the snapshot names, block counts, and effect lists it displays reflect finalized backend behavior from all prior phases. No new API surface or backend changes needed.
**Delivers:** Structured human-readable card showing preset name, amp/cab pair, 4 snapshot pills with LED colors, guitar notes, and tempo if set
**Addresses:** Tone description card (P1)
**Avoids:** Pitfall 10 (duplicating `summarizePreset()` with an independent implementation — extract `buildToneCardData(spec)` as the shared source of truth for both the card and the markdown summary)
**Research flag:** No research needed. Data is already in the response; component is pure display. One design decision: whether to extract `buildToneCardData()` as a shared function or read `spec` directly in the component (extract is recommended to prevent divergence).

### Phase Ordering Rationale

- **Hardware first** because the `.hlx audit` and bug fixes are ground truth for everything else. Building UI features that display "what's in the preset" before the preset output is correct produces misleading UI that must be revisited.
- **Caching second** because it is isolated and provides immediate, measurable benefit with no downstream effect on preset quality. Verifying it before adding more complexity makes debugging straightforward.
- **Genre defaults before snapshot toggling** because the ambient snapshot's Mix overrides in Phase 4 build on top of genre-tuned base parameters. The two features need integration testing in combination, but genre defaults must be the stable foundation.
- **Visualization before description card** because visualization requires the new `viz.ts` module and a minor API route change; description card requires only frontend work. The route change is slightly more complex and belongs with backend-focused work.
- **Both UI features last** because they display outputs of the backend work — they will show wrong data if built before that work is complete and stable.

### Research Flags

Phases requiring implementation-time empirical research (not resolvable from documentation):
- **Phase 1:** Requires real HX Edit hardware exports to determine `@pedalstate` bitmask encoding and confirm correct `@fs_enabled` value in the footswitch section JSON. The `.hlx` format is undocumented. Plan for 2-3 hours of export inspection before writing `computeFootswitchAssignments()`. If the bitmask cannot be verified, document `@pedalstate: 2` as a known limitation rather than guess.
- **Phase 3:** Requires inspection of `models.ts` delay/reverb/modulation `defaultParams` and `param-registry.ts` encoding types before writing genre defaults. One hour of codebase audit before any lookup table values are committed. This is mandatory — wrong encoding produces silently broken presets.

Phases with standard, well-documented patterns (skip additional research):
- **Phase 2:** Anthropic prompt caching is officially documented with TypeScript examples; `@anthropic-ai/sdk` 0.78.0 types are verified. Standard implementation.
- **Phase 4:** Extending an existing deterministic state table. No new patterns; existing tests cover regressions.
- **Phase 5:** `@xyflow/react` is well-documented; `next/dynamic({ ssr: false })` is a standard Next.js pattern.
- **Phase 6:** Pure React component; no new patterns; all data is already returned in the API response.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | One new dependency (`@xyflow/react` 12.10.1) verified on npm; `@anthropic-ai/sdk` 0.78.0 `cache_control` confirmed in SDK source at `node_modules/.../messages.ts:2643`; React 19 compatibility confirmed in React Flow v12 migration guide |
| Features | HIGH | Existing codebase inspected directly for all dependency analysis; Anthropic prompt caching pricing verified from official docs 2026-03-02; genre effect conventions confirmed across BOSS editorial, iZotope, Premier Guitar, and professional preset seller patterns |
| Architecture | HIGH | All integration points verified against actual TypeScript source files in the codebase; build order derived from direct dependency inspection; `@pedalstate` and `@fs_enabled` bug locations confirmed in `preset-builder.ts` |
| Pitfalls | HIGH | 7 of 11 pitfalls verified from official Anthropic docs or direct codebase inspection; 4 from Vercel AI SDK issue tracker (confirmed real reported failures); `.hlx` undocumented format confirmed by Line 6 community |

**Overall confidence:** HIGH

### Gaps to Address

- **`@pedalstate` bitmask encoding:** Line 6 provides no documentation on which bit positions correspond to which footswitch indices. This is the only gap with meaningful implementation risk — must be resolved empirically via real HX Edit export inspection in Phase 1. If the mapping cannot be determined confidently, leave `@pedalstate: 2` as a documented limitation.

- **1-hour TTL support for `claude-sonnet-4-6`:** PITFALLS.md flags that the 1-hour TTL option (`anthropic-beta: extended-cache-ttl-2025-04-11`) significantly improves caching effectiveness for infrequent-use patterns like HelixAI, but requires confirming support for the specific model version. Verify at Phase 2 implementation time; fall back to the 5-minute default TTL if unsupported.

- **Genre defaults normalized encoding:** Until `models.ts` delay/reverb `defaultParams` are inspected in Phase 3, the correct numeric values for the `GENRE_EFFECT_DEFAULTS` table are not confirmed. This is a mandatory pre-coding step scheduled as Phase 3's first action — not a true research gap, but a verification that must happen before writing values.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Prompt Caching Official Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — `cache_control` API shape, minimum token threshold (2048 for Sonnet 4.6), pricing table, TTL options (verified 2026-03-02)
- [Anthropic Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — Claude Sonnet 4.6: $3/MTok input, $3.75/MTok cache write, $0.30/MTok cache read
- `@anthropic-ai/sdk` CHANGELOG — v0.78.0 (2026-02-19) added top-level `cache_control`; confirmed in `node_modules/@anthropic-ai/sdk/src/resources/messages/messages.ts:2643`
- [React Flow v12 Migration Guide](https://reactflow.dev/learn/troubleshooting/migrate-to-v12) — Package rename from `reactflow` to `@xyflow/react`, SSR support, React 19 compatibility
- Direct codebase inspection — `src/lib/helix/param-engine.ts`, `snapshot-engine.ts`, `preset-builder.ts`, `planner.ts`, `param-registry.ts`, `tone-intent.ts` (all feature dependency analysis)
- `.planning/PROJECT.md` — Hardware bugs (`@fs_enabled`, `@pedalstate`) confirmed by hardware testing

### Secondary (MEDIUM confidence)
- [@xyflow/react npm](https://www.npmjs.com/package/@xyflow/react) — 12.10.1 latest, 407 dependents, actively maintained
- [BOSS Articles — Using Delay for Specific Genres](https://articles.boss.info/using-delay-for-specific-genres/) — Genre-specific delay time conventions (blues slapback 100-140ms, ambient long delay)
- [iZotope — 6 Tips for Using Reverb in Different Genres](https://www.izotope.com/en/learn/6-tips-for-using-reverb-in-different-genres-of-music.html) — Genre reverb mix guidance
- [Premier Guitar — Beginner's Guide to Ambient Guitar](https://www.premierguitar.com/lessons/beginner/beginners-guide-to-ambient-guitar) — High reverb mix 40-60% for ambient confirmed
- [Alex Price Musician — Helix Preset Library](https://www.alexpricemusician.com/helix) — Tone description card conventions from professional preset sellers
- [Glenn DeLaune — Helix Presets](https://glenndelaune.com/helix-patches.htm) — Tone description card patterns (name, amp/cab, snapshot map, pickup notes)
- [Vercel AI SDK issues #7612 and #4362](https://github.com/vercel/ai/issues/7612) — Confirmed `cache_read_input_tokens: 0` failure pattern; grounds Pitfalls 1 and 2 in real reported bugs

### Tertiary (informational, community-sourced)
- [Line 6 Community — .hlx JSON format documentation](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — Confirms no official Line 6 schema documentation; `@fs_enabled` and `@pedalstate` semantics must be empirically determined
- [Line 6 CustomTone preset library](https://line6.com/customtone/browse/helix/) — Tone description card format conventions

---

*Research completed: 2026-03-02*
*Ready for roadmap: yes*
