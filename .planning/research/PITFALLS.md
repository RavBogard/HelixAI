# Pitfalls Research

**Domain:** AI-powered Helix preset generation — v1.1 feature additions
**Researched:** 2026-03-02
**Confidence:** HIGH (Anthropic official docs, direct codebase inspection, Line 6 community, verified against @anthropic-ai/sdk 0.78.0)

> This document covers pitfalls for adding v1.1 features to the existing HelixAI system. The prior research in this file (v1.0) focused on preset tone quality. This update focuses on integration pitfalls for the six new features: prompt caching, genre-aware effect defaults, smarter snapshot toggling, .hlx format audit, signal chain visualization, and tone description card.

---

## Critical Pitfalls

These cause silent failures, wrong hardware behavior, or wasted API spend with no visible error.

---

### Pitfall 1: Dynamic Content in System Prompt Invalidating Every Cache Entry

**What goes wrong:** The system prompt for Claude's Planner (in `/api/generate`) includes a date stamp, session context, or any other per-request dynamic string. Every request hits the cache but fails to match because the system prompt bytes differ from the prior write. Anthropic's cache requires exact byte-for-byte identity up to and including the cached block. The generation route shows `cache_read_input_tokens: 0` on every call, meaning 100% cache misses with 25% write overhead on every request — costs go up, not down.

**Why it happens:** The current system prompt in `providers.ts` injects a date at generation time: `src/lib/gemini.ts` line 98 does date injection at chat-prompt build time. Developers typically add similar context markers to the generation prompt "for freshness." Any part of the system prompt that changes between calls — even a single character — breaks the cache prefix.

**How to avoid:**
- Audit every string that ends up in the system prompt before marking it cacheable. Run two consecutive generations and compare the raw `system` field byte-for-byte.
- Move the model ID list (the static knowledge: all amp names, effect names, schema description) before the cache breakpoint. Move any per-request context (user tone summary, conversation excerpt) after the cache breakpoint.
- Use `cache_control: { type: "ephemeral" }` only on the static prefix block. The user's conversation history must be in a separate content block with no cache marker.
- Log `usage.cache_creation_input_tokens` and `usage.cache_read_input_tokens` from every API response during development. If `cache_read_input_tokens` is 0 after the first call with identical prompts, the prefix is not byte-identical.

**Warning signs:**
- `usage.cache_read_input_tokens` is consistently 0 across multiple generations with the same prompt
- `usage.cache_creation_input_tokens` matches the full system prompt token count on every call (not just the first)
- Total API costs increase after adding cache_control (writes cost 1.25x, reads cost 0.1x — if all writes and no reads, cost goes up)

**Phase to address:** Prompt Caching phase. Verify cache hit metrics before considering the feature complete.

---

### Pitfall 2: Prompt Too Short to Cache — Silent Non-Caching

**What goes wrong:** The static system prompt content placed before the cache breakpoint is fewer than 1,024 tokens. The API call succeeds, the preset generates correctly, but `cache_creation_input_tokens` is 0. No error is thrown. The feature appears to work but caching never activates. This is the most common reported failure mode from the Vercel AI SDK issue tracker.

**Why it happens:** The current Planner prompt in `providers.ts` may not reach 1,024 tokens if it only contains the structured output schema and basic instructions. The model ID enumeration (all valid amp names, cab names, effect names) needs to be included in the cached prefix to push it over the threshold — which is also the correct architecture (model list is the heaviest static content).

**How to avoid:**
- Measure the token count of the intended cache prefix before implementing. Use the Anthropic tokenizer or approximate at 4 characters per token. The full model ID list from `models.ts` (AMP_NAMES, CAB_NAMES, EFFECT_NAMES as enumerated strings) is roughly 800-1,200 tokens alone.
- The schema description, all parameter guidance text, and the complete model enumeration together should comfortably exceed 1,024 tokens. If the prefix is short, the model enumeration is likely missing from the prompt.
- Confirm by checking `usage.cache_creation_input_tokens > 0` on the first request after implementation.

**Warning signs:**
- `usage.cache_creation_input_tokens === 0` and `usage.cache_read_input_tokens === 0` on every call
- System prompt appears to work correctly but cost savings are zero

**Phase to address:** Prompt Caching phase. Check token count before writing the implementation plan.

---

### Pitfall 3: 5-Minute TTL Expiring Between Vercel Serverless Invocations

**What goes wrong:** The default cache TTL is 5 minutes. HelixAI is deployed on Vercel free tier. Users generate presets infrequently — often more than 5 minutes apart. Every generation is a cache miss + cache write (1.25x cost). The cache never actually saves money because no two requests arrive within the TTL window.

**Why it happens:** Anthropic's prompt cache TTL is server-side (not tied to the serverless instance). The TTL resets on each cache hit. If no request hits the cache within 5 minutes, the cached entry expires. On Vercel free tier with infrequent users, this is the default behavior, not an edge case.

**How to avoid:**
- Use the 1-hour TTL option: `cache_control: { type: "ephemeral", ttl: "1h" }`. This costs 2x for cache writes instead of 1.25x, but a single cache hit within the hour pays back the extra write cost. For infrequent-use tools like HelixAI, 1-hour TTL is clearly better.
- Note: The 1-hour TTL requires the `anthropic-beta: extended-cache-ttl-2025-04-11` header. With `@anthropic-ai/sdk` 0.78.0, this is passed via the `headers` option or via the `betas` parameter.
- Model compatibility: Claude Sonnet 4.5 supports 1-hour TTL. Confirm the current model (`claude-sonnet-4-6` based on PROJECT.md) supports this option before depending on it.

**Warning signs:**
- Cache metrics show writes but zero reads across a normal usage session
- API costs remain unchanged after adding caching

**Phase to address:** Prompt Caching phase. Choose TTL strategy as the first decision.

---

### Pitfall 4: Genre String Mismatch Between Prompt and Defaults Table

**What goes wrong:** The `ToneIntent.genreHint` field is `z.string().optional()` — a free-form string like `"blues rock"`, `"shoegaze"`, or `"ambient post-rock"`. The genre-aware defaults table uses a different key set (e.g., `"blues"`, `"ambient"`, `"rock"`). Lookup fails silently: `genreHint` is defined but no entry matches, so the defaults table returns `undefined` and the code falls back to amp-category defaults. The user asked for a shoegaze preset and gets generic clean amp defaults instead of the 500ms modulated delay they expected.

**Why it happens:** The `genreHint` was designed as an informational hint, not a controlled vocabulary term. Its documentation says "e.g., blues rock, metal, jazz — informational only." When genre-aware defaults are added later, a new lookup layer attempts to use this informational field as a lookup key without normalizing it.

**How to avoid:**
- Define a closed genre vocabulary in the defaults table: `blues`, `jazz`, `country`, `classic_rock`, `hard_rock`, `metal`, `shoegaze`, `ambient`, `worship`, `punk`, `funk`, `indie`. Use these as keys.
- Normalize `genreHint` before lookup: lowercase, strip punctuation, try direct match, then try partial match (contains `"metal"` uses `metal` defaults). Log when normalization fails to find a match.
- Alternatively, add a `genreCategory` field to `ToneIntentSchema` with `z.enum(["blues", "jazz", ...])` alongside `genreHint`. The AI selects from the controlled list; the free-form string remains informational.
- Never treat `undefined` genre as an error — it is a valid state. The defaults should gracefully degrade to amp-category defaults when genre is unknown.

**Warning signs:**
- Genre-aware defaults have no observable effect on generated presets despite the user specifying a clear genre
- Delay times and reverb mixes in generated presets are identical regardless of genre input
- `genreHint` is defined in the intent but the genre defaults table lookup always returns `undefined`

**Phase to address:** Genre-Aware Defaults phase. Define the genre vocabulary before writing any lookup code.

---

### Pitfall 5: Overwriting Genre Defaults With Amp-Category Defaults at the Wrong Layer

**What goes wrong:** Genre-aware defaults for delay time, reverb mix, and modulation rate are applied in `param-engine.ts`. The existing `resolveDefaultParams()` function uses model `defaultParams` from the database. If genre defaults are applied first and then the model's `defaultParams` overwrite them, the genre-aware values are lost. This is the three-layer resolution problem: model defaults then category defaults then topology override. Genre defaults need a defined layer position or they will be silently overwritten.

**Why it happens:** The existing `param-engine.ts` `resolveDefaultParams()` does `return { ...model.defaultParams }` — the model database values take full precedence over anything else for non-amp blocks. Genre defaults applied before this call vanish. Genre defaults applied after this call would correctly override, but the layer ordering must be explicit.

**How to avoid:**
- Genre defaults must be the outermost layer (applied last, overriding model defaults). Define the resolution order explicitly in code comments: (1) model defaultParams, (2) category overrides (existing), (3) genre overrides (new). Each later layer wins over earlier layers.
- Scope genre defaults to the correct block types: `delay` (Time, Mix, Feedback), `reverb` (Decay, Mix, Predelay), `modulation` (Speed, Depth, Mix). Do not apply genre defaults to amp or cab blocks — those already have category-specific expert values.
- Use explicit override order: `{ ...modelDefaults, ...categoryDefaults, ...genreDefaults }`. The rightmost object wins.

**Warning signs:**
- Delay Time in generated presets does not match genre expectations (e.g., shoegaze gets short 200ms delay instead of 600ms)
- All effect parameters match model database defaults exactly, regardless of genre

**Phase to address:** Genre-Aware Defaults phase. Map out the resolution layer stack before writing code.

---

### Pitfall 6: Snapshot Effect Toggling Ignoring the Existing `getBlockEnabled()` State Table

**What goes wrong:** The existing `snapshot-engine.ts` `getBlockEnabled()` function has a deterministic state table for every block type and role combination. If smarter snapshot toggling is added by modifying the AI's output (e.g., adding new `toneRole` values or adding scene-purpose fields to `SnapshotIntent`) instead of extending `getBlockEnabled()`, the deterministic table gets bypassed. AI-generated block states re-enter the pipeline and the same non-determinism issues from v1.0 return.

**Why it happens:** The natural implementation of "smarter snapshot toggling" is to add more fields to `SnapshotIntent` so the AI can express what effects should be on per snapshot. This breaks the Planner-Executor boundary — the Knowledge Layer (`snapshot-engine.ts`) is supposed to determine block states, not the AI. The v1.0 research clearly established that AI-generated `blockStates` were the source of the "all snapshots identical" bug.

**How to avoid:**
- Smarter snapshot toggling must be implemented by extending `getBlockEnabled()` in `snapshot-engine.ts`, not by giving the AI more control.
- The new logic should be: for ambient-purposed snapshots, enable reverb and delay even for block roles that normally would not. For clean-purposed snapshots, disable distortion blocks regardless of amp category. These are rule additions to the existing state table.
- Add a `snapshotPurpose` concept (separate from `toneRole`) only if it maps to deterministic rules. If it requires AI judgment, it does not belong in the AI output contract.
- Run the full existing snapshot-engine tests after any change to `getBlockEnabled()` to verify no existing snapshot behavior regresses.

**Warning signs:**
- `SnapshotIntentSchema` gains new fields beyond `name` and `toneRole`
- Block states in snapshots vary in unexpected ways that do not match the state table
- Snapshot engine tests fail after adding new toggling logic

**Phase to address:** Smarter Snapshot Toggling phase. Any change here must preserve the deterministic Knowledge Layer principle.

---

### Pitfall 7: `@fs_enabled: false` Hardcoded in Footswitch Section

**What goes wrong:** The current `buildFootswitchSection()` in `preset-builder.ts` hardcodes `"@fs_enabled": false` for every stomp assignment. This is the known hardware bug in the Active requirements list: footswitches require multiple presses before first activation. Setting `@fs_enabled: true` for stomp-assigned blocks should fix this.

The pitfall when fixing it: changing `@fs_enabled` to `true` on all blocks may also affect blocks that legitimately should not respond to footswitch presses (e.g., amp, cab, EQ). The footswitch section only assigns STOMP_BLOCK_TYPES (distortion, delay, reverb, modulation, dynamics, wah, pitch, volume), so the scope is correct — but this must be verified against real .hlx exports where `@fs_enabled: true` is confirmed to be the expected value for stomp-assigned blocks.

**How to avoid:**
- Fix `@fs_enabled: false` to `@fs_enabled: true` only within `buildFootswitchSection()`, not in the controller section (`buildControllerSection()`).
- Verify by exporting a real preset from HX Edit with one stomp assignment and inspecting the `@fs_enabled` value in the footswitch section of the JSON. Confirm it is `true`, not `false`.
- After the fix, test on real hardware: load the preset, verify the effect activates on the first footswitch press.
- Do not change the `@fs_enabled: false` in `buildSnapshot()` controllers section (line 227) — that field controls snapshot parameter controller behavior, not stomp state.

**Warning signs:**
- Footswitch behavior unchanged on hardware after the fix (still requires two presses)
- Multiple places in the codebase have `@fs_enabled` — changing the wrong one

**Phase to address:** Hardware Bug Fixes phase (first priority, it is a confirmed bug).

---

### Pitfall 8: `@pedalstate` Bitmask Computed Incorrectly

**What goes wrong:** Every snapshot in the current output has `@pedalstate: 2` hardcoded in `buildSnapshot()`. The `@pedalstate` field is a bitmask that tells the Helix which stomp footswitches (FS1-FS12) are in their "on" state when that snapshot is entered. With all snapshots at `2` (binary 0000 0010 — only FS2 appears active), the Helix LED state does not reflect the actual block on/off states per snapshot.

The pitfall: `@pedalstate` is undocumented. The value `2` in real HX Edit exports corresponds to a specific bitmask for footswitch assignments. Without reverse-engineering which bit corresponds to which footswitch index, computing the correct value is impossible.

**How to avoid:**
- Export 3-4 presets from HX Edit with varying stomp assignments and inspect the `@pedalstate` values in each snapshot's JSON. Map bit positions to footswitch indices. The STOMP_FS_INDICES in the codebase (`[7, 8, 9, 10]`) correspond to FS5-FS8 on the hardware — these bit positions in the bitmask need to be verified.
- The formula: for each snapshot, compute `@pedalstate` by OR-ing together the bit positions of all blocks that are ENABLED in that snapshot's `blockStates` AND have a footswitch assignment in `buildFootswitchSection()`.
- If reverse-engineering the bitmask is not feasible before the v1.1 deadline, leave `@pedalstate: 2` as-is and document it as a known limitation. A wrong bitmask causes incorrect LED display but does not break audio functionality.
- Do not guess the bitmask formula. An incorrect computed value may produce worse LED behavior than the current hardcoded `2`.

**Warning signs:**
- Footswitch LEDs show all blocks as ON or all as OFF across all snapshots
- Switching snapshots does not change LED states on the hardware

**Phase to address:** Hardware Bug Fixes phase. Research the bitmask before writing code; this requires real hardware inspection.

---

### Pitfall 9: Signal Chain Visualization Showing Data From the Wrong Layer

**What goes wrong:** The signal chain visualization component renders immediately after generation from the `spec.signalChain` data. If the component tries to show "what's in the file you downloaded" rather than "what's in the spec," there is a timing problem: the .hlx file builder applies transformations (cab indexing, block key remapping, footswitch assignments) that are not reflected in the raw `PresetSpec.signalChain`. The visualization shows the spec-level view, which is correct for user understanding, but the "DSP Path 1 / DSP Path 2" split in the spec may not match the physical Helix routing display.

**Why it happens:** The `summarizePreset()` function already does a simple text version of this (DSP0 vs DSP1 blocks). A React visualization component that reuses this same data shape will have the same characteristics and the same limitations. The issue is if visualization scope creep adds "download-level" details the spec does not contain.

**How to avoid:**
- The visualization should render from `PresetSpec.signalChain` directly. This is the canonical data shape the entire codebase uses.
- Scope the component to: block type icons, block names, DSP assignment (dsp 0/1), enabled state, position order. These are all available in `BlockSpec`.
- Do not attempt to show footswitch assignments, controller bindings, or snapshot states in the visualization component — those require data from the built `HlxFile`, not the `PresetSpec`.
- Keep the component stateless (pure render from props). Accept `signalChain: BlockSpec[]` as the only prop.

**Warning signs:**
- Component imports `buildHlxFile` or `buildFootswitchSection` to compute display data
- Component has async data fetching or derives visualization from the download step
- Component props include `HlxFile` instead of `PresetSpec`

**Phase to address:** Signal Chain Visualization phase.

---

### Pitfall 10: Tone Description Card Duplicating the Existing `summarizePreset()` Function

**What goes wrong:** The `summarizePreset()` function in `preset-builder.ts` already generates a human-readable summary (markdown format). If the tone description card is implemented as a separate function that re-derives the same information from `spec`, the two summaries will diverge over time as one is updated and the other is not. Users see different information in the UI card vs. what is in the download.

**Why it happens:** The new UI card is typically built by a developer who reaches for `spec` to generate the display text, unaware that `summarizePreset()` already exists and is authoritative. The result: two independent summary implementations of the same data.

**How to avoid:**
- The tone description card should consume the output of `summarizePreset(spec)` rather than derive its own summary.
- If the card needs structured data (not markdown), extract the summarization logic into a `buildPresetSummaryData(spec)` function that returns a typed object, and have `summarizePreset()` call it. This makes both the UI card and the markdown export use the same data source.
- If the card needs richer information (e.g., snapshot LED colors, effect role descriptions), extend `summarizePreset()` or add a `buildToneCard(spec)` function that calls the same underlying data extraction.

**Warning signs:**
- A new function with similar output to `summarizePreset()` appears in `page.tsx` or a new utility file
- The UI description card shows different block names or snapshot counts than the markdown summary

**Phase to address:** Tone Description Card phase.

---

### Pitfall 11: Genre Defaults for Delay Time Using Raw Milliseconds Instead of Normalized Float

**What goes wrong:** Helix delay time is encoded as a normalized float (0.0-1.0) in the `defaultParams` for most delay models, NOT as a raw milliseconds value. If genre defaults are specified as milliseconds (e.g., `Time: 500` for a 500ms shoegaze delay), the Helix will interpret `500` as a value far beyond the 0-1 range, producing an extreme delay time or no delay at all. This is the same parameter encoding trap documented in the v1.0 research for `LowCut`/`HighCut`.

**How to avoid:**
- Before writing genre defaults, inspect actual `defaultParams` values for delay models in `models.ts`. If `Time: 0.45` represents 400ms on a Digital Delay, the genre defaults must use the same normalized encoding.
- The `param-registry.ts` currently classifies `Gain` as `db_value` and `LowCut`/`HighCut` as `hz_value`. Delay `Time` and reverb `Decay` are currently classified as `normalized_float`. Genre defaults must respect this.
- If tempo-sync delay is used (note values like quarter note, dotted eighth), the encoding is different again — these are integer indices in the note value list, not normalized floats.
- Document the expected encoding for each genre default parameter before coding: `Time: 0.45` (normalized, approximately 400ms) not `Time: 400` (ms).

**Warning signs:**
- Generated presets with genre defaults have delay time at extreme positions (barely audible or infinitely repeating)
- Genre default Time values are integers above 1.0

**Phase to address:** Genre-Aware Defaults phase. Audit `models.ts` delay model defaultParams before writing the defaults table.

---

## Technical Debt Patterns

Shortcuts that could be introduced while implementing v1.1 features.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode `cache_control` on entire system prompt without splitting static/dynamic | Fast to implement | Every dynamic token in the system prompt causes 100% cache miss rate | Never — static/dynamic split is required for caching to work |
| Genre defaults as a flat key-value object with string genre keys | Easy to extend | Genre strings from AI are inconsistent; lookups silently fail for any unrecognized genre | Only if combined with normalization and fallback |
| Add new `SnapshotIntent` fields for smarter toggling instead of extending `getBlockEnabled()` | Flexible AI expression | Reintroduces AI-generated block states — defeats the deterministic Knowledge Layer | Never |
| Build visualization component from `HlxFile` output instead of `PresetSpec` | Shows final file data | Couples visualization to file format internals; breaks if format changes | Never |
| Compute `@pedalstate` bitmask by guessing bit positions | Eliminates hardcoded `2` | May produce worse LED behavior than current hardcode if bitmask formula is wrong | Skip the computation if bitmask cannot be verified from real exports |
| Apply genre defaults to ALL block types including amp and cab | Simpler code path | Overwrites carefully tuned amp-category and cab parameters with generic genre values | Never — genre defaults must be scoped to time-based effects only |

---

## Integration Gotchas

Common mistakes when connecting the new features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Anthropic prompt caching | Placing `cache_control` on a message content block that includes per-request data | Split system prompt into static prefix (schema + model list) and dynamic suffix (user context); place `cache_control` only on the static prefix block |
| Anthropic prompt caching | Using the `/v1/chat/completions` OpenAI-compatible endpoint | Prompt caching is only available at `/v1/messages`; the `@anthropic-ai/sdk` native client uses `/v1/messages` by default |
| Anthropic prompt caching | Not checking `usage.cache_read_input_tokens` in API response | Add logging of both `cache_creation_input_tokens` and `cache_read_input_tokens` to verify the feature is working |
| Genre defaults | Treating `genreHint` as a reliable lookup key | Normalize genre strings before lookup; always have a fallback to amp-category defaults |
| Genre defaults | Applying defaults to delay/reverb without checking whether delay model uses tempo-sync | Tempo-sync delay uses integer note-value indices, not normalized Time floats; check model defaultParams first |
| Snapshot toggling | Modifying `buildSnapshot()` to read from a new AI field | Extend `getBlockEnabled()` in `snapshot-engine.ts` — the snapshot builder must not read AI state data |
| `@fs_enabled` bug fix | Changing `@fs_enabled` in both footswitch and controller sections | The fix belongs only in `buildFootswitchSection()` — the controller section uses a different semantics for this field |
| Signal chain visualization | Importing helix domain modules into a React component file for data transformation | Extract data transformation to a utility function; keep the React component as a pure display layer |
| Tone description card | Calling `summarizePreset()` with the full markdown output and parsing it back into structured data | Add a `buildToneCardData(spec)` function that returns typed data; have both the card and `summarizePreset()` use it |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Genre defaults table evaluated on every `resolveDefaultParams()` call | Slight latency increase on generation | Build genre defaults as a static const object, not computed dynamically per request | Not a real concern at current scale — preset generation is one call per user. Do not over-engineer. |
| Signal chain visualization re-rendering on every parent state update | Flickering or lag in UI during generation | Wrap the visualization component in `React.memo()` and pass stable `signalChain` prop reference | When the parent component is large (page.tsx is already substantial); extract visualization into its own file |
| Prompt caching adding 25% overhead on first request | First-generation response noticeably slower | Expected — write cost is 1.25x. Inform users this is normal if they report it. | Always happens on first request or after TTL expiry; not a bug |

---

## Security Mistakes

Domain-specific security issues relevant to v1.1 features.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Caching a system prompt that includes user-derived content | User A's tone preferences could theoretically be visible in User B's cached context if prompts overlap | Ensure only static, non-user-derived content is in the cached prefix. User conversation data must be in the uncached dynamic suffix. |
| Rendering unescaped content in tone description card | XSS if `spec.description` or `spec.guitarNotes` contains user-influenced text | Use React's default JSX rendering (safe) or pass through `react-markdown` with `allowedElements` restriction; never use innerHTML directly |
| Logging `cache_creation_input_tokens` to console in production | API usage patterns visible in Vercel function logs | Acceptable in development; gate behind `process.env.NODE_ENV === 'development'` check for production |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing signal chain visualization before generation completes | Users see empty/loading state or partial chain — confusing | Show visualization only after generation succeeds; use the same loading state gate as the download button |
| Tone description card using technical field names (`modelId`, `ampCategory`) | Guitarists do not understand "HD2_AmpFenderTwin" or "ampCategory: clean" | Map internal names to human-readable labels: "Fender Twin Reverb" not `HD2_AmpFenderTwin`; "Clean amp" not "clean" |
| Genre defaults silently changing the tone without user notification | User asked for "blues" but the delay is now 400ms instead of 250ms — they do not know why | Genre defaults are an accuracy feature, not a user-facing control. No notification needed, but the tone description card should mention the genre influence if one was detected. |
| Signal chain visualization too complex (showing all 12+ blocks) | Overwhelming for non-technical users | Show a simplified view: amp name, cab name, key effects (delay, reverb, modulation). Hide always-on utility blocks (gate, EQ, gain block) from the user-facing visualization. |
| Cache misses causing noticeably longer first-generation times | Users abandon if first response takes 8+ seconds | Expected behavior; prompt caching only helps subsequent requests. The first request after a cache miss is always full-price. No fix needed. |

---

## "Looks Done But Isn't" Checklist

- [ ] **Prompt caching:** `usage.cache_read_input_tokens > 0` on the second identical generation — if zero, caching is silently broken
- [ ] **Prompt caching:** First request has `usage.cache_creation_input_tokens > 1024` — if not, the prefix is too short to cache
- [ ] **Genre defaults:** A "shoegaze" generation has longer delay time than a "blues" generation — if delay times are identical, genre defaults are not being applied
- [ ] **Genre defaults:** Effect parameters respect normalized 0-1 encoding — check that no genre default value is an integer above 1.0 for Time, Mix, or Decay parameters
- [ ] **Snapshot toggling:** The "ambient" snapshot has delay, reverb, AND modulation enabled — all three should be on for ambient, not just reverb
- [ ] **`@fs_enabled` fix:** Load the preset on real hardware and confirm the first press of FS5 activates the assigned effect without a double-press
- [ ] **`@pedalstate` fix (if attempted):** Switch between Clean and Lead snapshots — the footswitch LEDs should change to reflect active/inactive effects per snapshot
- [ ] **Signal chain visualization:** The block order in the visualization matches the `position` ordering of blocks in `spec.signalChain`, not insertion order
- [ ] **Tone description card:** The snapshot names and descriptions in the card match the actual generated snapshot specs — not hardcoded defaults
- [ ] **Tone description card:** Effect names shown are human-readable (`"Minotaur"`) not model IDs (`"HD2_DistMinotaur"`)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Cache permanently misses due to dynamic content | LOW | Remove dynamic content from the cached prefix block; redeploy. No data loss. |
| Genre defaults applied with wrong encoding (ms instead of normalized) | LOW | Correct values in the defaults table; no structural changes needed |
| `@fs_enabled` fix breaks preset loading on hardware | MEDIUM | Revert `@fs_enabled` to `false` in footswitch section; file a bug for targeted investigation |
| Signal chain visualization creates circular imports | LOW | Move visualization to a separate component file; use `@/lib/helix` barrel imports |
| Genre defaults overwrite amp parameters (scope too broad) | LOW | Add `blockType` check to genre defaults application: only apply if `block.type === "delay" || "reverb" || "modulation"` |
| Snapshot toggling logic regression breaks existing snapshot behavior | MEDIUM | The snapshot-engine tests catch this immediately; revert the `getBlockEnabled()` changes and approach incrementally |

---

## Pitfall-to-Phase Mapping

How v1.1 roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: Dynamic content breaks cache | Prompt Caching phase | `usage.cache_read_input_tokens > 0` on second identical generation |
| Pitfall 2: Prompt too short to cache | Prompt Caching phase | `usage.cache_creation_input_tokens > 1024` on first generation |
| Pitfall 3: TTL expires between infrequent calls | Prompt Caching phase | Use 1-hour TTL; verify with cache metrics over a 30-minute gap between generations |
| Pitfall 4: Genre string mismatch | Genre-Aware Defaults phase | Test with "shoegaze", "blues", and "jazz" — each must hit a different defaults bucket |
| Pitfall 5: Genre defaults overwritten by model defaults | Genre-Aware Defaults phase | Log resolved parameters for delay block; confirm genre values appear, not model database values |
| Pitfall 6: Snapshot toggling bypasses Knowledge Layer | Smarter Snapshot Toggling phase | `SnapshotIntentSchema` has no new fields; all toggling changes are in `getBlockEnabled()` |
| Pitfall 7: `@fs_enabled` hardcoded to false | Hardware Bug Fixes phase | Real hardware test: first press activates effect |
| Pitfall 8: `@pedalstate` bitmask wrong | Hardware Bug Fixes phase | Inspect real HX Edit .hlx export before computing; compare LED behavior on hardware |
| Pitfall 9: Visualization shows data from wrong layer | Signal Chain Visualization phase | Component accepts only `signalChain: BlockSpec[]`; no `HlxFile` props |
| Pitfall 10: Tone card duplicates `summarizePreset()` | Tone Description Card phase | `summarizePreset()` is the single source of truth; card calls it or shares an underlying `buildToneCardData()` |
| Pitfall 11: Genre delay time in milliseconds | Genre-Aware Defaults phase | Inspect `models.ts` delay defaultParams first; all defaults use same encoding as model database |

---

## Sources

**Anthropic Official Documentation (HIGH confidence):**
- [Prompt Caching — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — Cache breakpoint requirements, TTL options, min token thresholds, workspace isolation change Feb 2026
- [Anthropic Automatic Prompt Caching Feb 2026](https://medium.com/ai-software-engineer/anthropic-just-fixed-the-biggest-hidden-cost-in-ai-agents-using-automatic-prompt-caching-9d47c95903c5) — Automatic prefix matching, workspace isolation announcement

**Vercel AI SDK Issues (MEDIUM confidence — confirms real bugs):**
- [Vercel AI SDK v5 Anthropic prompt caching broken](https://github.com/vercel/ai/issues/7612) — v5 system prompt caching not working even above 1024 token minimum
- [Claude prompt caching is broken using Vercel AI SDK example code](https://github.com/vercel/ai/issues/4362) — Confirmed `cache_read_input_tokens: 0` failure pattern

**Internal codebase inspection (HIGH confidence — verified from source):**
- `src/lib/helix/snapshot-engine.ts` — `getBlockEnabled()` deterministic state table; confirms where snapshot toggling logic lives
- `src/lib/helix/param-engine.ts` — Three-layer parameter resolution; confirms where genre defaults must be inserted
- `src/lib/helix/param-registry.ts` — Parameter encoding types; delay `Time` is `normalized_float`
- `src/lib/helix/preset-builder.ts` — `@fs_enabled: false` hardcode at `buildFootswitchSection()`; `@pedalstate: 2` hardcode at `buildSnapshot()`; `summarizePreset()` already exists
- `src/lib/helix/tone-intent.ts` — `genreHint: z.string().optional()` — free-form, not controlled vocabulary

**Genre defaults reference (MEDIUM confidence):**
- [Using Delay for Specific Genres — BOSS Articles](https://articles.boss.info/using-delay-for-specific-genres/) — Genre-specific delay time recommendations (blues, classic rock, shoegaze, worship)
- [6 Tips for Using Reverb in Different Genres — iZotope](https://www.izotope.com/en/learn/6-tips-for-using-reverb-in-different-genres-of-music.html) — Genre reverb usage guidance

**Line 6 community (.hlx format, HIGH confidence for "no official docs"):**
- [Documentation on the .hlx JSON format — Line 6 Community](https://line6.com/support/topic/33381-documentation-on-the-hlx-json-format/) — Confirms no official Line 6 documentation for `@fs_enabled` or `@pedalstate` bitmask fields

---
*Pitfalls research for: HelixAI v1.1 feature additions*
*Researched: 2026-03-02*
