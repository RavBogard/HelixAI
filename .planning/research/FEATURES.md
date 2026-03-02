# Feature Research

**Domain:** AI-powered Helix preset generation — v1.1 Polish & Precision
**Researched:** 2026-03-02
**Confidence:** HIGH (existing codebase inspected directly; Anthropic prompt caching docs verified via official source; genre effect parameter conventions verified via multiple community and manufacturer sources; tone description card conventions verified via Line 6 CustomTone and professional preset seller patterns)

---

## Context: What Already Exists

v1.0 shipped a complete Planner-Executor architecture. The AI (Claude Sonnet 4.6) generates a narrow ToneIntent (~15 fields), and the deterministic Knowledge Layer (chain-rules.ts, param-engine.ts, snapshot-engine.ts) generates all parameter values. The app produces downloadable .hlx files for Helix LT and Helix Floor. All table-stakes and differentiator features from the v1.0 feature research are implemented and verified.

v1.1 adds five specific improvements on top of this foundation. The feature research below focuses exclusively on those five areas.

---

## Feature Landscape

### Table Stakes (Users Expect These — Missing = Feature Feels Incomplete)

These are the behaviors users assume will be present in the new features. Missing any of them makes the implementation feel half-done.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Prompt caching on the system prompt** | The Planner system prompt contains ~1,500 tokens of static content (model list, schema instructions). Every generation call re-pays for this. Caching the static portion is the standard practice for apps with stable system prompts. Users paying API costs expect this to be optimized. | LOW | `callClaudePlanner()` in `src/lib/planner.ts`. System prompt text is already in `buildPlannerPrompt()`. Add `cache_control: { type: "ephemeral" }` to the system content block. No architectural change needed. |
| **Genre-aware delay time (tempo-relative)** | Guitarists know that delay timing should match the song's feel. Blues players expect slapback (100-140 ms, 1 repeat). Ambient players expect long, evolving echoes. Metal players expect tight, minimal delay. Currently `resolveDefaultParams()` uses a single model default regardless of `genreHint`. | MEDIUM | `param-engine.ts` `resolveDefaultParams()` for delay blocks. Needs `genreHint` passed from `ToneIntent` into the delay parameter resolver. No new modules — extend existing 3-layer resolution strategy. |
| **Genre-aware reverb mix** | Ambient and post-rock tones require high reverb mix (40-60%). Metal requires near-zero reverb. Blues requires subtle warmth. Using the same reverb defaults across genres produces wrong results for extreme cases. | MEDIUM | Same as delay: `resolveDefaultParams()` for reverb blocks needs `genreHint` context. Same extension point as delay — can be done in a single pass. |
| **Genre-aware modulation rate** | Chorus and vibrato on metal sounds wrong at the slow rates that work for jazz. Tremolo for country needs a specific rate and depth that a generic default will miss. | LOW | `resolveDefaultParams()` for modulation blocks. Lower priority than delay/reverb because modulation is less genre-defining. |
| **Ambient snapshot enables reverb and delay** | In the existing `snapshot-engine.ts`, reverb is always ON and delay is ON for lead and ambient. This is already mostly correct, but the ambient snapshot should also enable modulation (chorus/phaser creates lushness) and should not simply inherit lead's delay state. The expected behavior: ambient = reverb ON + delay ON + modulation ON. Currently modulation is ambient-only which is correct, but the logic needs verification against `EffectIntent.role === "ambient"`. | LOW | `snapshot-engine.ts` `getBlockEnabled()`. Ambient effects with `role === "ambient"` in the ToneIntent should all be enabled in the ambient snapshot. The current code enables modulation only for ambient — verify this correctly handles the `role` field from EffectIntent. |
| **Clean snapshot disables drive blocks** | The existing snapshot engine already handles this: distortion blocks (non-boost) are OFF for clean and ambient. This is table stakes — if it's broken, the clean snapshot sounds wrong. Verify correctness as part of smarter toggling work. | LOW | `snapshot-engine.ts` `getBlockEnabled()`. Already implemented — this is a verification/hardening task, not new code. |
| **Tone description card shows all 4 snapshots** | When users see the preset summary, they expect to see what each snapshot does (which blocks are on, what the tone character is). Currently `summarizePreset()` in `preset-builder.ts` returns a text summary. Users expect snapshot names, roles, and key block states to be visible before downloading. | MEDIUM | `summarizePreset()` in `src/lib/helix/preset-builder.ts` and the `generatedPreset` state in `page.tsx`. The `spec` object is already returned in the API response — the UI component needs to render it. |
| **Signal chain visualization shows block types clearly** | Users need to understand what's in the preset. The expected format mirrors HX Edit's own UI: left-to-right horizontal flow, block icons or labels by type (Drive, Amp, Cab, EQ, Delay, Reverb), enabled/disabled state, DSP boundary visible. This is the standard format every signal chain editor uses. | MEDIUM | Read-only visualization from `presetSpec.signalChain` already returned in API response. Pure frontend work in `page.tsx` — no backend changes. |
| **.hlx audit validates all required keys are present** | Users expect that if the app generates a file, it will load on hardware without error. The audit should check for: `@pedalstate` in snapshots, `@fs_enabled` on controller assignments, correct `@type` values, required cab fields (LowCut, HighCut). The two known v1.0 hardware bugs (`@fs_enabled` hardcoded false, `@pedalstate` hardcoded 2) are symptoms of insufficient audit coverage. | MEDIUM | `preset-builder.ts` and `validate.ts`. The audit is a systematic review of what HX Edit expects vs. what the builder produces. Hardware testing is the ground truth. |
| **`@fs_enabled` bug fixed** | Footswitches require multiple presses due to hardcoded `@fs_enabled: false`. This is a known hardware bug from v1.0. Expected behavior: stomp footswitches are enabled on first press. | LOW | `preset-builder.ts` `buildFootswitchSection()` — find where `@fs_enabled` is set and correct the value. Likely a one-line fix once the correct value is identified. |
| **`@pedalstate` computed per snapshot** | Pedal LEDs don't reflect active stomps per snapshot because `@pedalstate` is hardcoded to `2`. Expected behavior: each snapshot's `@pedalstate` reflects the blocks that are enabled in that snapshot. | MEDIUM | `preset-builder.ts` `buildSnapshot()` — `@pedalstate` needs to be computed from the snapshot's `blockStates` rather than hardcoded. The `@pedalstate` value is a bitmask or index of the active footswitch state. |

---

### Differentiators (Competitive Advantage — Beyond What Competitors Do)

Features that make v1.1 meaningfully better than the v1.0 baseline and better than competing tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Genre-specific delay parameter tables** | Providing slapback (100-140 ms, 1 repeat, high mix) for blues vs. dotted-eighth note sync for rock vs. long atmospheric delays for ambient is the difference between a generic preset and one that sounds right for the style. ToneBuilder.ai has no genre awareness at the parameter level. | MEDIUM | Implement as a `GENRE_EFFECT_PARAMS` lookup table in `param-engine.ts`, keyed by genre keyword patterns extracted from `genreHint`. This is a data problem, not an architecture problem. The lookup is a new 3rd resolution layer on top of model defaults. |
| **Effect role-aware snapshot toggling** | The `EffectIntent.role` field ("always_on", "toggleable", "ambient") already carries the AI's intent for how each effect should behave in snapshots. Currently `snapshot-engine.ts` uses block type (delay, reverb, modulation) as the proxy for on/off decisions — but the role field is more precise. An effect marked "ambient" should only be on in the ambient snapshot. An effect marked "always_on" should be on in all snapshots. Wiring role into block state decisions makes snapshots more musically intelligent. | MEDIUM | `snapshot-engine.ts` needs access to the original `EffectIntent[]` array to look up each block's role. Currently it only receives `BlockSpec[]` which doesn't carry the role. Either extend `BlockSpec` with an optional `role` field, or pass a role lookup map alongside the chain. |
| **Horizontal signal chain visualization** | A read-only left-to-right block flow showing [Input] → [Drive] → [Amp] → [Cab] → [EQ] → [Delay] → [Reverb] → [Volume] → [Output] is instantly scannable and matches how HX Edit displays the signal chain. Users can see what they're downloading without decoding the raw JSON. No competitor AI preset tool shows this. | MEDIUM | Pure React component in `page.tsx`. Read from `presetSpec.signalChain` which is already in the API response. Use `block.type` for icons/labels, `block.enabled` for visual state, `block.dsp` for DSP boundary marker. No new API or backend work. |
| **Tone description card with key specs** | A structured human-readable card showing: preset name, genre/style, amp and cab choice, 4 snapshot names with their tone roles, pickup type hint, and one-line guitarist tip. This is what professional Helix preset sellers include with every product (Alex Price, Glenn DeLaune pattern). Currently the app returns a `summary` string, but users benefit from a structured card. | LOW | `summarizePreset()` in `preset-builder.ts` already generates a text summary. The description card extends this into a structured data object that the UI renders as a card. Alternatively, pass the `toneIntent` and `spec` objects (already returned) to a new `ToneDescriptionCard` React component that renders them directly. No new data needed. |
| **Prompt caching for ~50% API cost reduction on system prompt** | The Planner system prompt is 1,000-2,000 tokens and identical on every call (model list + instructions are static). Cache reads cost 0.1x the normal input token price — that is a 90% reduction on the cached portion. For a 1,500-token system prompt cached on 100 generations per day, this is meaningful cost savings. | LOW | Add `cache_control: { type: "ephemeral" }` to the system field of the `client.messages.create()` call in `callClaudePlanner()`. The Anthropic SDK supports this as of `@anthropic-ai/sdk 0.78.0` which is already installed. The cache lasts 5 minutes by default; sufficient for typical usage patterns. No new dependencies. |
| **Broader .hlx format audit with hardware verification checklist** | Beyond fixing the two known bugs, a systematic review of what HX Edit expects in each JSON section catches silent failures before users hit them on hardware. The audit should cover: all 8 snapshot slots, controller section structure, footswitch section structure, global section fields, DSP topology fields. This prevents the next round of hardware bugs from accumulating. | MEDIUM | Not purely code — involves exporting known-good presets from HX Edit and comparing JSON structure field-by-field against what the builder produces. Findings feed targeted fixes in `preset-builder.ts`. Document expected values as assertions in `validate.ts`. |

---

### Anti-Features (Do NOT Build These)

Features that seem like natural extensions but create problems for v1.1 scope or user experience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Editable signal chain in UI** | Users want to tweak the generated chain before downloading | Turns a download-and-play tool into a full preset editor, which is HX Edit's job. Scope explosion: would need block picker, parameter sliders, drag-to-reorder, validation feedback. Ships nothing while building everything. | Provide the read-only visualization (differentiator above) and download flow. Users can open in HX Edit for tweaks. |
| **Genre selector dropdown in UI** | Users want to pick genre before generating to guide the AI | The chat interview already collects genre through natural language. Adding a dropdown creates a second input channel that can conflict with what the user said in the chat ("I said blues but the dropdown says metal"). Also fragments the prompt engineering. | Keep genre as a natural language field in the interview. The `genreHint` already flows from ToneIntent into param-engine — no UI change needed. |
| **Multiple parameter variation downloads** | Users want to see 2-3 variants of the same tone | Same problem as the v1.0 multi-provider comparison UI: dilutes focus, increases cost, creates choice paralysis. The prompt caching work actually makes generating a single excellent preset cheaper, not a justification for generating more. | Keep single download. The tone description card and signal chain visualization give users enough confidence to download the one generated preset. |
| **Snapshot customization in UI** | Users want to rename snapshots or toggle which effects are on per snapshot | HX Edit already does this better than a web UI ever could. The user has the hardware; they can adjust snapshot states there. Building this in the web app duplicates HX Edit functionality with worse UX. | Generate musically intelligent snapshots using the effect role awareness improvement (differentiator above). The generated presets should be correct enough that users rarely need to adjust. |
| **Live API cost display** | Users want to see how much the generation cost | Exposes API cost mechanics to end users, which creates pricing expectations and invites cost-minimization behavior that degrades quality. Also complex to implement accurately with caching and streaming. | Internal telemetry only. If cost monitoring is needed, use server-side logging in the generate route, not a user-facing display. |
| **Automatic 1-hour cache duration** | The 1-hour cache option costs 2x the write price and lasts longer | For a 5-minute-cycle user interaction (interview → generate → download), the default 5-minute ephemeral cache is sufficient. The 1-hour cache is for batch processing scenarios where many requests hit the same context over hours. Paying 2x to cache for 1 hour when 5 minutes covers the use case wastes money. | Use the default 5-minute ephemeral cache. Revisit if usage patterns show multiple generations per session exceeding 5 minutes apart. |

---

## Feature Dependencies

```
Prompt Caching
    └── no dependencies — isolated to callClaudePlanner() in planner.ts
    └── depends on: @anthropic-ai/sdk 0.78.0 (already installed, cache_control supported)

Genre-Aware Effect Parameters
    ├── requires: ToneIntent.genreHint flows into resolveParameters() in param-engine.ts
    │   └── currently: genreHint is in ToneIntent but NOT passed to resolveParameters()
    │   └── fix: add genreHint as parameter to resolveParameters() and resolveDefaultParams()
    └── requires: GENRE_EFFECT_PARAMS lookup table (new data, same param-engine.ts file)

Smarter Snapshot Toggling (Effect Role Awareness)
    ├── requires: EffectIntent.role accessible at snapshot-engine.ts evaluation time
    │   └── currently: buildSnapshots() receives BlockSpec[] only (role field not present)
    │   └── fix option A: add optional role field to BlockSpec (set in chain-rules.ts)
    │   └── fix option B: pass ToneIntent.effects[] as a parallel lookup map to buildSnapshots()
    ├── enhances: Genre-Aware Effect Parameters (both improve effect intelligence)
    └── depends on: chain-rules.ts correctly propagating EffectIntent.role into the chain

.hlx Format Audit
    ├── requires: hardware testing on real Helix LT (ground truth for expected values)
    ├── fixes: @fs_enabled bug → preset-builder.ts buildFootswitchSection()
    ├── fixes: @pedalstate bug → preset-builder.ts buildSnapshot()
    └── outputs: assertions added to validate.ts for audited fields

Signal Chain Visualization
    ├── requires: presetSpec.signalChain in API response (already present in spec field)
    ├── requires: no backend changes — pure frontend React component
    └── enhances: Tone Description Card (both surface preset internals to the user)

Tone Description Card
    ├── requires: toneIntent and spec objects in API response (already present)
    ├── requires: no backend changes — React component reads existing response data
    └── enhances: Signal Chain Visualization (together they form the preset preview)

Hardware Bug Fixes (@fs_enabled, @pedalstate)
    ├── requires: .hlx Format Audit (audit identifies the correct values)
    └── requires: inspection of real HX Edit .hlx exports to determine expected values
```

### Dependency Notes

- **Genre-aware params require genreHint threading**: `genreHint` is in `ToneIntent` but `resolveParameters()` currently only receives `(chain, intent)`. The `intent` is already passed, so `genreHint` is accessible as `intent.genreHint` — the fix is to use it in `resolveDefaultParams()`. No signature change needed.

- **Effect role awareness requires a design decision**: `BlockSpec` does not carry `EffectIntent.role`. The cleanest fix is to extend `BlockSpec` with an optional `intentRole?: "always_on" | "toggleable" | "ambient"` field, set in `chain-rules.ts` when the block comes from an `EffectIntent`. This avoids passing the full ToneIntent down to the snapshot engine.

- **Visualization and description card share no dependencies on each other**: they can be developed and shipped independently. Both are read-only UI work consuming already-returned API data.

- **Hardware bug fixes unblock signal chain visualization**: the visualization shows `block.enabled` states which reflect snapshot-engine decisions. If `@pedalstate` and `@fs_enabled` are incorrect on hardware, visualization accuracy is a secondary concern until hardware behavior is correct.

---

## MVP Definition

### Ship in v1.1 (All Active Requirements)

These are the items explicitly listed as active in PROJECT.md. Every one of them is in scope.

- [ ] **Fix `@fs_enabled`** — stomp footswitches respond on first press. One-line fix in `preset-builder.ts` once correct value is determined from HX Edit export. LOW complexity, HIGH impact (hardware usability).
- [ ] **Fix `@pedalstate` computation** — pedal LEDs reflect active stomps per snapshot. Requires computing bitmask from snapshot `blockStates` in `buildSnapshot()`. MEDIUM complexity, HIGH impact.
- [ ] **Prompt caching** — `cache_control: { type: "ephemeral" }` on system prompt in `callClaudePlanner()`. ~50% savings on Planner API calls. LOW complexity, MEDIUM impact.
- [ ] **Genre-aware effect defaults** — delay time, reverb mix, modulation rate vary by `genreHint`. MEDIUM complexity, HIGH quality impact (presently blues and metal presets use identical delay defaults).
- [ ] **Smarter snapshot effect toggling** — wire `EffectIntent.role` into `snapshot-engine.ts` block state decisions. MEDIUM complexity, MEDIUM quality impact.
- [ ] **.hlx format audit** — systematic comparison of builder output vs. real HX Edit exports; findings fed into validate.ts assertions and preset-builder.ts fixes. MEDIUM complexity, HIGH reliability impact.
- [ ] **Signal chain visualization** — read-only horizontal block flow in UI before download. MEDIUM frontend complexity, HIGH UX impact (users see what they're downloading).
- [ ] **Tone description card** — structured human-readable summary card (preset name, amp, cab, snapshots, guitar tips). LOW complexity (data already returned in API response), HIGH UX impact.

### Defer to v1.2+ (Not in This Milestone)

- Pickup-aware tone calibration (single-coil vs. humbucker EQ) — TONE-V2-01
- Dual cab/dual mic blending — TONE-V2-02
- Snapshots 5-8 with genre-specific variations — SNAP-V2-01
- Stomp mode footswitch layout (Command Center assignments) — SNAP-V2-02

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fix `@fs_enabled` | HIGH (hardware usability) | LOW | P1 |
| Fix `@pedalstate` | HIGH (hardware usability) | LOW-MEDIUM | P1 |
| .hlx format audit | HIGH (reliability) | MEDIUM | P1 |
| Genre-aware effect defaults | HIGH (tone quality) | MEDIUM | P1 |
| Signal chain visualization | HIGH (UX confidence) | MEDIUM | P1 |
| Tone description card | HIGH (UX clarity) | LOW | P1 |
| Smarter snapshot toggling | MEDIUM (tone quality) | MEDIUM | P2 |
| Prompt caching | MEDIUM (cost reduction) | LOW | P2 |

**Priority key:**
- P1: Must ship in v1.1 (user-facing quality or reliability impact)
- P2: Should ship in v1.1 (cost or secondary quality improvement)
- P3: Defer (not in v1.1 scope)

---

## Technical Notes by Feature

### Prompt Caching Implementation

The Anthropic SDK supports two caching modes. For the Planner use case, explicit cache breakpoints on the system content block are the right approach (as opposed to automatic caching at the request level). The system prompt is static per deployment and benefits most from a stable cache hit.

Implementation in `callClaudePlanner()`:
```typescript
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral" }, // 5-minute cache, 0.1x read price
    }
  ],
  messages: [{ role: "user", content: conversationText }],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});
```

Minimum token threshold: Anthropic requires a minimum of 1,024 tokens for cache eligibility. The Planner system prompt (model list + instructions) is approximately 1,500-2,000 tokens, which clears this threshold. Confidence: HIGH (official Anthropic docs verified).

Cache savings rate: cached tokens cost 0.1x the base input token price. A 1,500-token system prompt costs $0.0045 normally ($3/million), cached it costs $0.00045. At 100 generations per day, this saves ~$0.405/day. Not dramatic at current scale, but meaningful and free to implement.

### Genre-Aware Effect Parameter Defaults

The current `resolveDefaultParams()` in `param-engine.ts` falls through to `model.defaultParams` for delay, reverb, and modulation — a single set of values regardless of genre. The genre-aware extension is a new lookup layer:

Genre keyword patterns to detect (from `genreHint` string, case-insensitive):
- blues / blues-rock / rockabilly / country → slapback delay (120 ms, 1 repeat, 35% mix), warm reverb (15-20% mix)
- metal / djent / thrash / progressive metal → minimal delay (off or 20ms pre-delay), near-zero reverb (5-8% mix)
- ambient / post-rock / shoegaze / atmospheric → long delay (450-700 ms, 35-50% feedback, 50-60% mix), high reverb (40-60% mix)
- jazz / fusion / smooth → room reverb (20-25% mix), no delay or short hall delay
- classic rock / hard rock (default) → quarter-note delay at tempo (40% mix), medium hall reverb (20% mix)

These are normalized 0-1 values derived from community consensus and effect manufacturer documentation (BOSS, Strymon, Line 6). Confidence: MEDIUM (multiple consistent sources, community consensus).

### Smarter Snapshot Toggling: Effect Role Awareness

The cleanest implementation extends `BlockSpec` with an optional `intentRole` field:

```typescript
// In types.ts
export interface BlockSpec {
  // ... existing fields ...
  intentRole?: "always_on" | "toggleable" | "ambient"; // from EffectIntent.role
}
```

`chain-rules.ts` sets this when building from user effects:
```typescript
// In buildBlockSpec(), when originating from EffectIntent:
intentRole: effectIntent.role, // propagated from ToneIntent.effects[].role
```

`snapshot-engine.ts` `getBlockEnabled()` adds a role-aware check before the existing type-based logic:
```typescript
// Check explicit role intent first (overrides type-based defaults)
if (block.intentRole === "always_on") return true;
if (block.intentRole === "ambient") return role === "ambient";
if (block.intentRole === "toggleable") {
  // Use existing type-based logic for toggleable effects
}
```

Mandatory blocks (boost, EQ, gate, volume) do not come from `EffectIntent` and will have `intentRole: undefined`, so existing logic handles them unchanged.

### Signal Chain Visualization

The visualization reads `presetSpec.signalChain` (already in API response as `spec.signalChain`). A horizontal flow component:

Block display format per block:
- Icon or label based on `block.type` (Drive, Amp, Cab, EQ, Delay, Reverb, Mod, Vol)
- Enabled state from `block.enabled` (dimmed if false)
- DSP boundary marker between DSP0 and DSP1 blocks
- Model name in smaller text below the type label

The Warm Analog Studio design language (warm amber tones, tube-glow aesthetics) should be applied. No drag/reorder needed — this is purely read-only. No external library needed; a simple `flex` row of styled div elements is sufficient.

### Tone Description Card

The `generatedPreset` state already contains `toneIntent` and `spec`. A `ToneDescriptionCard` component renders:
1. Preset name + one-line description (from `spec.description`)
2. Amp model and cab model (from `toneIntent.ampName`, `toneIntent.cabName`)
3. Genre/style hint (from `toneIntent.genreHint`)
4. Four snapshot pills: name + toneRole color-coded (clean=blue, crunch=orange, lead=red, ambient=teal)
5. Guitar notes / setup tips (from `spec.guitarNotes`)

This is a pure rendering component — no new API calls, no new state. All data is already in the response.

### .hlx Format Audit Methodology

The audit is an empirical comparison process, not a code-only task:
1. Export 5-8 representative presets from HX Edit (cover: simple clean, high-gain, ambient, with snapshots)
2. Compare JSON field-by-field against what `buildHlxFile()` generates for equivalent inputs
3. Document discrepancies as a findings list
4. Fix discrepancies in `preset-builder.ts` (structural) or `validate.ts` (assertions)
5. Verify fixes on real Helix LT hardware

Known discrepancies to investigate:
- `@fs_enabled` on footswitch controller assignments (currently hardcoded `false`)
- `@pedalstate` on snapshot objects (currently hardcoded `2`, should be computed)
- Whether `@valid` on empty snapshots (5-8) should be `false` vs `true`
- Whether the footswitch section requires specific key names for stomp assignments
- Whether the `global.@pedalstate` differs from snapshot-level `@pedalstate`

---

## Sources

- [Anthropic Prompt Caching Official Documentation](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — HIGH confidence (official, verified 2026-03-02). Confirms 0.1x read price, 1024 token minimum, `cache_control: { type: "ephemeral" }` syntax, 5-minute default TTL.
- [Anthropic Prompt Caching Pricing](https://platform.claude.com/docs/en/about-claude/pricing) — HIGH confidence (official Anthropic pricing page). Claude Sonnet 4.6 at $3/M input, $0.30/M cached reads.
- [BOSS Articles — Using Delay for Specific Genres](https://articles.boss.info/using-delay-for-specific-genres/) — MEDIUM confidence (manufacturer editorial, genre-specific delay conventions). Slapback 100-140 ms for blues, ambient long delay patterns confirmed.
- [Sonicbids — Cheat Sheet for Delay and Reverb Effects](https://blog.sonicbids.com/get-the-guitar-sound-you-want-cheat-sheet-for-delay-and-reverb-effects/) — MEDIUM confidence (community blog, widely cited parameter ranges).
- [Premier Guitar — A Beginner's Guide to Ambient Guitar](https://www.premierguitar.com/lessons/beginner/beginners-guide-to-ambient-guitar) — MEDIUM confidence (industry publication). High reverb mix 40-60% for ambient confirmed.
- [Line 6 CustomTone — Preset Library](https://line6.com/customtone/browse/helix/) — HIGH confidence (official Line 6 preset sharing platform). Tone description card format informed by how professional presets document themselves there.
- [Alex Price Musician — Helix Complete Preset Library](https://www.alexpricemusician.com/helix) — MEDIUM confidence (professional Helix preset seller). Documents tone description card conventions: name, one-liner, amp/cab, snapshot map, pickup notes.
- [Glenn DeLaune — Helix Presets](https://glenndelaune.com/helix-patches.htm) — MEDIUM confidence (leading Helix preset professional). Documents same tone description card patterns.
- [Line 6 Community — Documentation on the .hlx JSON format](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — MEDIUM confidence (official forum, community reverse engineering). Confirms no official schema exists; empirical inspection required.
- Direct codebase inspection (`src/lib/helix/`, `src/lib/planner.ts`, `src/app/api/generate/route.ts`) — HIGH confidence. Feature dependency analysis derived from actual TypeScript source.

---

*Feature research for: HelixAI v1.1 Polish & Precision*
*Researched: 2026-03-02*
