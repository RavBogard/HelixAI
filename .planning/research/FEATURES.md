# Feature Research

**Domain:** AI-powered guitar preset generator — HelixTones v5.0 Device-First Architecture
**Researched:** 2026-03-05
**Confidence:** HIGH (codebase analysis is direct inspection; device constraint patterns from Line 6 Community + Sweetwater + official manuals; UX patterns from BIAS X, Quad Cortex, and conversational AI research)

---

## Context: What This Milestone Adds

v4.0 is fully shipped. All 6 devices generate presets. The current architecture routes every device through the same system prompt, the same planner prompt, and the same guard-based branching (17+ `if (isPodGo(...))` / `if (isStadium(...))` / `if (isStomp(...))` sites). Two post-v4.0 bugs revealed the architectural limits of this approach: (1) Agoura amp names leak to non-Stadium devices because `AMP_NAMES` is a single global list, and (2) Stadium presets only emit 12 of 27 firmware params per amp, causing param bleed from previously loaded presets. Both bugs are symptoms of the same root cause: device identity enters the pipeline too late.

**What v5.0 changes:**
- Device picker moves from mid-conversation to the very first screen (before any text is typed)
- Each device family gets its own isolated planner prompt, model catalog, chain rules, and conversation arc
- Stadium amp blocks emit all 27+ firmware params by extracting the complete set from the real .hsp corpus
- Device selection is a routing decision at pipeline entry, not a guard flag inside every function

**What already exists (do not re-research):**
- 6 device builders (preset-builder, podgo-builder, stadium-builder, stomp-builder)
- ToneIntent schema + Planner structured output
- Knowledge Layer (chain-rules, param-engine, snapshot-engine)
- Device guards: `isPodGo()`, `isStadium()`, `isStomp()`, `isHelix()` in types.ts
- Per-model amp overrides (Layer 4), ampFamily classification, cabAffinity — all shipped in v4.0
- Gemini 2.5 Flash chat interview + Google Search grounding for artist rig research

---

## Research Findings: The Five Feature Areas

### Finding 1: Device-First UX Flow

**How the current flow works (late device selection):**

The device selector currently appears in the UI after the AI emits `[READY_TO_GENERATE]`. The chat runs for 3-6 exchanges, THEN the user picks their device, THEN generation fires. This means:
- The chat AI says "Since you're on HX Stomp, we'll keep the chain lean" — but device selection hasn't happened yet. The system prompt warns about this but cannot enforce it.
- The planner prompt receives the device only at generation time, after the interview has already set expectations the device cannot fulfill (e.g., 6-effect conversation with a Stomp user)
- All prompt text, model catalogs, and chain rules exist in a single file with device-specific sections guarded by conditionals

**Industry pattern — device selection before configuration:**

Research across competing hardware tools (Kemper, Quad Cortex, BIAS X) reveals a universal pattern: device or hardware context is established first, then the configuration UI adapts.

- Quad Cortex: New preset creation begins with selecting a template that encodes the device's path topology (mono serial, stereo, parallel, multi-input). All subsequent block placement respects that template's constraints. The template IS the device context.
- BIAS X (Positive Grid, 2025): The AI tone platform launches with a device/format selection — plugin format (VST3/AU/AAX) or standalone — before any tone creation begins. The AI's amp and effect catalog is scoped to the selected format. Text-to-Tone uses the already-established device context to constrain its suggestions.
- Kemper: "Performance" vs "Studio" mode is chosen before any sound creation. Performance mode constrains to 5 slots with footswitch-compatible topology; Studio mode is unconstrained.

**The "device-first as routing decision" pattern:**

The correct mental model for v5.0 is not "add a device picker step" but "route to a device-specific pipeline from the first moment." The device selection IS the entry point. Everything downstream — system prompt, model catalog, conversation beats, chain rules, validation — is device-specific. This is the Quad Cortex template pattern applied to a conversational pipeline.

**Device family grouping rationale:**

Users do not think in terms of "helix_lt" vs "helix_floor" — they think "I have a Helix." The v5.0 device families match natural user mental models:

| Family Name | Devices Included | Why Grouped |
|-------------|-----------------|-------------|
| Stadium | Helix Stadium | Unique architecture: Agoura amps, dual-flow DSP, .hsp format, 12 blocks/path |
| Helix | Helix Floor, Helix LT | Same .hlx format, dual DSP, identical generation path — differ only in footswitch count (invisible to preset generation) |
| Stomp | HX Stomp, HX Stomp XL | Same .hlx format, single DSP, differ only in block count (6 vs 9) and snapshot count (3 vs 4) |
| Pod Go | Pod Go, Pod Go XL | Same .pgp format, single DSP, 4-effect limit |

**Source confidence:** HIGH — direct codebase analysis + industry observation from Quad Cortex, BIAS X, Kemper behavior.

---

### Finding 2: Device-Specific Conversation Arcs

**The core insight: constraint-first conversation beats**

For constrained devices (Stomp, Pod Go), the conversation arc must surface the hardware budget EARLY so the user can make informed choices before the AI generates a plan they cannot execute. The anti-pattern: building a detailed 6-effect plan, then saying "oh, but you only have 4 blocks." The correct pattern: establish constraints in the opening, then design WITHIN them.

**Stomp conversation arc ("what will you cut?"):**

HX Stomp users come with one of two mental models:
1. "I want to add Helix-quality amp modelling to my existing pedalboard" — they care about minimal block count, may have external drives/modulation
2. "I want to replace my entire pedalboard" — they need a complete signal chain in 6 blocks

The interview must distinguish these in the first exchange. If the user has external drives, the Stomp conversation arc is: amp + cab + 2 post-effects + maybe gate = 5 blocks. If they need full signal chain, the constraint question is explicit: "With 6 blocks total (including amp and cab), which 4 effects matter most to you?"

Community research (Line 6 Community, Sweetwater InSync "Get More Out of HX Stomp") confirms that experienced Stomp users approach preset design with explicit budget thinking:
- They evaluate using a preamp block instead of full amp+cab (saves 1 block of DSP budget)
- They know that the mixer level parameter can replace a volume/gain block
- They prioritize effects by tonal role: amp is fixed, cab is fixed, leaving 4 "real" blocks

The conversation arc question is: "Are you using this with an existing pedalboard, or as your complete signal chain?" This one question bifurcates the rest of the conversation.

**Pod Go conversation arc ("tight budget"):**

Pod Go users are budget-constrained but typically have full-signal-chain intent (the Pod Go is an all-in-one). The 4-effect limit (after amp and cab are allocated) means:
- Standard chain: Gate + Boost + Delay + Reverb = 4 effects exactly
- Any modulation replaces one of these four
- No room for compressor + drive + mod + delay + reverb (5 effects)

The interview question is: "You've got 4 effect slots to work with. What are the 2-3 effects you absolutely need for this tone?" This is not apologetic about the constraint — it focuses creative decision-making.

**Helix conversation arc (dual-DSP capability):**

Helix users have 16 blocks across 2 DSPs. The interview does NOT need to ask about budget. Instead, the conversation beats are:
1. Tone goal (artist, genre, vibe)
2. Guitar (pickup type)
3. Dual-amp question: "Are you after one amp sound or a split between a clean and a driven amp?" — This distinguishes single-amp from AB topology, which is a real decision (AB topology uses 4 extra blocks for split/join)
4. Ready to generate

The Helix arc is the most expansive — the AI can propose a full-featured chain and the user's main constraint is musical (tone goal) rather than hardware (block count).

**Stadium conversation arc (dual-DSP routing, use-case oriented):**

Stadium users are arena/professional users who chose the device for its Agoura amp quality and 4-path capability. The conversation should orient around:
1. Which Agoura amp family fits the tone goal (this is why Stadium has a completely separate model catalog)
2. Whether they need multi-path routing (guitar + fx loop + monitor, or guitar only)
3. 8-snapshot layout (Stadium supports 8 vs Helix's 4 usable ones)

Stadium's constraint is not block count but amp catalog: NO HD2 amps are appropriate for a Stadium user. The conversation arc must never mention "Plexi," "Dumble," or any HD2 amp name — only Agoura amp families.

**Source confidence:** MEDIUM-HIGH. Block constraint patterns from Line 6 Community + Sweetwater are verified. Conversation arc design is inferred from hardware constraints + conversational UX principles. No published "HX Stomp interview script" exists.

---

### Finding 3: Device-Specific Planner Prompts (No Cross-Contamination)

**The Agoura leak problem — what it looks like in production:**

`buildPlannerPrompt()` calls `getModelListForPrompt(device)` which filters `AMP_MODELS` by `stadiumOnly`. But `AMP_NAMES` (the string list passed to the prompt) is built from a global concatenation of all amp names with a `stadiumOnly` filter. The filter works for the text list — but the planner system prompt references "Valid Model Names" as a text block. If the filter has any gap (e.g., a new amp added to `STADIUM_AMPS` without setting `stadiumOnly: true`), the name appears in non-Stadium prompts.

The v5.0 fix is structural: each device family has its own model catalog module that exports ONLY the models valid for that family. The planner prompt for that family never imports from other catalogs. Cross-contamination is impossible by construction because the catalogs are never in scope together.

**What each device-specific planner prompt needs:**

| Device Family | Model Catalog Scope | Unique Prompt Instructions |
|---------------|---------------------|---------------------------|
| Stadium | Agoura_* amps only; Stadium Parametric EQ; Stadium cabs | "Use ONLY Agoura_* amp names. HD2 amps are legacy imports — never suggest them unless user requests a specific HD2 sound. Signal path: single flow, 12 blocks/path, 8 snapshots." |
| Helix (LT/Floor) | Full HD2 amp catalog (no Agoura); Helix cabs; full effect library | "Two DSP paths. Dual-amp AB topology is supported and recommended when user wants clean + driven amp. Up to 8 snapshots." |
| Stomp | Same HD2 amps as Helix (same .hlx format); same effect library; no dual-amp | "Single DSP. 6 blocks total (Stomp) or 9 blocks (Stomp XL). NO dual-amp. Snapshot count: 3 (Stomp) or 4 (Stomp XL). Budget effects aggressively." |
| Pod Go | HD2 amps (Pod Go model suffix variants); Pod Go cab list; Pod Go effects | "Single DSP. 4 user-effect limit. NO dual-amp. Stereo and Mono variants for all models — match the suffix convention." |

**Current planner prompt architecture — what changes:**

`buildPlannerPrompt()` in `planner.ts` is currently one function with 4+ conditional branches. The v5.0 target is 4 separate prompt builders:
- `buildHelixPlannerPrompt(device: "helix_lt" | "helix_floor")`
- `buildStompPlannerPrompt(device: "helix_stomp" | "helix_stomp_xl")`
- `buildPodGoPlannerPrompt()`
- `buildStadiumPlannerPrompt()`

Each function imports ONLY the model catalog relevant to it. No function has access to models it should not offer. The factory `buildPlannerPrompt(device)` routes to the correct builder.

This is also a prompt-caching win: Helix and Stomp prompts are currently the same with guards injected at the end. Separate prompts can have `cache_control: ephemeral` independently — Stadium edits don't invalidate Helix cache.

**Source confidence:** HIGH — direct codebase analysis. The model contamination mechanism is confirmed by code inspection of `planner.ts` line 42-48 (AMP_MODELS iteration without strict device isolation).

---

### Finding 4: Stadium Firmware Parameter Completeness

**The 12-vs-27 param problem:**

Post-v4.0 bug triage confirmed: real .hsp files contain 27+ parameters per amp block. The current `stadium-builder.ts` emits only 12. When HX Edit loads a preset, any parameter NOT explicitly set in the file retains the value from the previously loaded preset in that slot. This is "param bleed" — it explains why Stadium presets sometimes sound wrong on hardware despite looking correct in the JSON.

**What the missing parameters are:**

Based on reverse-engineering of the .hsp corpus (Agoura_Bassman.hsp, Agoura_Hiwatt.hsp confirmed in v4.0), and the Helix Stadium manual amp block documentation, the hidden internal parameters include:

| Parameter Key | What It Controls | User-Visible? |
|--------------|-----------------|---------------|
| AmpCabPeak | Cab-amp coupling resonance frequency peak | No — internal |
| AmpCabShelf | Cab-amp coupling high-frequency shelf | No — internal |
| Aggression | Power amp class AB crossover distortion | No — internal (per-model preset) |
| Bright | Bright cap switch (high-freq boost) | Yes — some amps show this |
| Contour | Mid-scoop voicing (e.g., Mesa Rectifier) | Yes — some amps show this |
| Depth | Low-frequency presence boost | Yes — some amps show this |
| Fat | Low-mid richness voicing | Yes — some amps show this |
| Hype | Behind-the-scenes multi-param smoother | Yes — all Agoura amps |
| Ripple | AC ripple power amp interaction | Yes — shown in manual |
| Hum | Power supply hum level | Yes — shown in manual |
| BiasX | Bias excursion (power amp tube voicing) | Yes — shown in manual |

These parameters MUST be emitted with sensible defaults even when the user has no preference — otherwise the hardware reads garbage from the previous preset slot.

**The corpus extraction approach:**

The correct approach (same as v4.0 Stadium builder rebuild) is corpus-driven: extract the complete param key list from 10+ real .hsp files, determine which params are present in every amp block vs which are amp-specific, establish default values from the corpus median, and emit all params unconditionally with per-model defaults where needed.

This is the same methodology that fixed the 5 format bugs in v4.0 Stadium rebuild. The constraint is that some params (Bright, Contour, Depth, Fat) exist only on specific amp models — emitting them on all amps may cause validation errors. The corpus must be used to determine which params are universal vs model-gated.

**Implementation touchpoints:**

- `stadium-builder.ts`: extend `buildAmpParams()` to emit the full parameter set
- `src/lib/helix/models.ts` (STADIUM_AMPS catalog): add `paramOverrides` for model-specific hidden param defaults
- Verification: load generated .hsp in HX Edit and confirm param count matches the reference corpus files

**Source confidence:** MEDIUM — the 27-param count is from post-v4.0 bug triage. The specific param key names (AmpCabPeak etc.) are from code comments in the project; only Bright/Contour/Hype/Depth/Fat are confirmed in public documentation (Helix Stadium manual + community forum). Full param list requires direct .hsp file inspection.

---

### Finding 5: Device-Specific Chain Rules and Validation

**Current state — guard-based branching:**

`chain-rules.ts` contains 17+ guard sites:
```typescript
if (isStadium(device)) { ... }
if (isPodGo(device)) { ... }
if (isStomp(device)) { ... }
const maxBlocks = podGo ? 4 : stomp ? (isStompXL ? 6 : 4) : 6;
```

Each guard is correct at the time it was added. The problem is accumulation: new device constraints get added as new guards, making the code harder to reason about and impossible to unit-test per-device without running the whole function.

**The device-module pattern:**

The v5.0 target architecture is a device module per family:

```typescript
interface DeviceChainRules {
  maxBlocksPerDsp: number;
  maxEffects: number;
  supportsDualAmp: boolean;
  supportsSnapshotCount: number;
  validateChain(blocks: BlockSpec[]): ValidationResult;
  allocateDsp(blocks: BlockSpec[]): DspAllocation;
}
```

Each device family exports a `DeviceChainRules` implementation. `chain-rules.ts` becomes a dispatcher that routes to the correct implementation based on device. No guards needed inside the implementation — each one only knows its own constraints.

**Block budget rules per device (confirmed from codebase + hardware research):**

| Device | Total Blocks | Amp | Cab | Max User Effects | Dual-Amp |
|--------|-------------|-----|-----|-----------------|----------|
| Helix LT | 16 (8/dsp) | 1 per dsp | 1 per dsp | 6 | YES (4 extra blocks) |
| Helix Floor | 16 (8/dsp) | same | same | 6 | YES |
| HX Stomp | 6 total | 1 | 1 | 4 | NO |
| HX Stomp XL | 9 total | 1 | 1 | 6-7 | NO |
| Pod Go | fixed positions | 1 | 1 | 4 | NO |
| Stadium | 12/path | 1 | 1 | up to 10 | via multi-path |

**Validation that belongs in device modules (not guards):**

- Stomp: reject any ToneIntent with `secondAmpName` set — dual-amp is architecturally impossible
- Pod Go: reject effects count > 4; validate all model names carry Mono/Stereo suffix convention
- Stadium: reject any HD2 amp name (non-Agoura); validate param key completeness before file emission
- Helix: validate dual-amp block budget (AB topology consumes 4 extra slots, so max effects drops to 4 when dual-amp)

**Source confidence:** HIGH — all block limits are directly confirmed from hardware inspection and STOMP_CONFIG / STADIUM_CONFIG constants in the codebase.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a "device-first" architecture must deliver to feel complete. Missing these means the architecture rework is not done.

| Feature | Why Expected | Complexity | Dependencies on Existing Code |
|---------|--------------|------------|-------------------------------|
| Device picker at conversation start | Users expect to declare their hardware BEFORE describing tone, not after — all hardware-aware tools (Kemper, Quad Cortex, BIAS X) do this | LOW (UI change) | Move device selector component before chat input; pass device to chat route from first message; chat system prompt receives device at session start |
| Device-specific planner prompts (isolated model catalogs) | Agoura amp names leaking to non-Stadium devices is a correctness bug, not a UX preference — any wrong model name produces a broken preset file | MEDIUM | Refactor `buildPlannerPrompt()` into 4 device-family builders; each imports only its own catalog; factory routes by device family |
| Stadium firmware parameter completeness (27+ params) | Param bleed on hardware is silent data corruption — presets sound different each time depending on what was loaded previously | HIGH | Corpus extraction of full param key list from real .hsp files; extend `buildAmpParams()` in stadium-builder.ts; add model-specific hidden param defaults to STADIUM_AMPS catalog |
| Device-specific conversation arcs | Chat AI that ignores Stomp's 6-block limit during the interview sets up unreachable expectations — user designs a chain that won't fit | MEDIUM | Device passed to chat route at conversation start; Gemini system prompt receives device context; device-specific interview beat instructions per family |
| No cross-device model contamination by design | Guard-based filtering is fragile — new models added without `stadiumOnly: true` silently leak; structural isolation is the correct fix | MEDIUM | Separate catalog modules per device family; no shared `AMP_NAMES` global; each planner prompt builder imports from its own catalog file |

### Differentiators (Competitive Advantage)

Features that go beyond fixing the architecture bugs to create a genuinely better experience.

| Feature | Value Proposition | Complexity | Dependencies on Existing Code |
|---------|-------------------|------------|-------------------------------|
| Stomp constraint interview ("what will you cut?") | Transforms a limitation into a creative decision — users feel the AI understands their hardware, not fighting it | LOW | Stomp-specific conversation beat in chat system prompt; single question distinguishes "add to pedalboard" vs "replace pedalboard" |
| Pod Go budget framing ("4 slots, what matters most?") | Same creative reframe — constraint as focus tool, not apology | LOW | Pod Go-specific conversation beat; rephrase effect selection as explicit priority question |
| Stadium Agoura-first conversation arc | Stadium users paid a premium for Agoura modeling — the interview should talk about Agoura amp families, not "what kind of gain do you want?" | MEDIUM | Stadium-specific system prompt section; Agoura amp family awareness in chat AI |
| Clean device module architecture (no guard sites) | Maintainability: adding a 7th device is one new module file, not touching 17+ guard sites across 5 files | HIGH | DeviceChainRules interface; factory routing; migrate each guard to its device module |
| Device-family grouping in UI (4 families, not 6 devices) | Reduces cognitive load at device selection — users who have a "Helix" don't need to know "LT vs Floor" for preset generation | LOW | UI change to device picker: show 4 family cards, then device variant within family |
| Per-family prompt caching | Separate system prompts per device family cache independently — Stadium updates don't invalidate Helix cache | LOW | Byproduct of device-specific prompt builders; no extra implementation needed |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Universal model catalog (show all amps for all devices, user picks) | "Let me choose any amp from any device" | Stadium with HD2 amps produces broken .hsp files — wrong parameter encoding. Pod Go with Agoura names produces invalid .pgp files. Model selection MUST be device-constrained or file generation fails silently on hardware. | Device-isolated catalogs. Explain in UI why Stadium has different amps ("Stadium uses the Agoura modeling engine — different amp library"). |
| Device selection mid-conversation | "Let me discover my options first, then pick the device" | The interview content (dual-amp conversation, effect budget, snap count) fundamentally changes based on device. A mid-conversation device switch invalidates every exchange that preceded it. This was the v3.x pattern — it caused the Agoura leak and interview expectation mismatch. | Device-first routing. One sentence of explanation in the UI: "Select your device first so we can design within its capabilities." |
| Cross-device preset import in the generator | "I have a Helix preset I love — can you reinterpret it for my Stomp?" | Requires full reverse-engineering of .hlx format, device capability mapping, and effect substitution. This is a separate product feature, not a preset generation concern. Already explicitly out of scope. | Import Line 6's HX Edit for preset conversion. HelixTones focuses on generation, not conversion. |
| Guard removal refactor before device-first routing | "Clean up the guards first, then add device-first routing" | Guards ARE the current device-first mechanism — removing them before the new routing is in place breaks all 6 devices simultaneously. The correct order: add device-first routing → new device modules → guards become dead code → remove guards. | Sequential implementation: routing first, modules second, guard removal last. |
| Single giant device-specific system prompt per device | "Just write 6 different system prompts, one per device" | 6 separate system prompts with full content duplication creates a maintenance burden — guitar interview best practices, pro techniques, conversation style, all duplicated 6 times. A bug fix requires editing 6 files. | Shared interview framework + device-specific sections injected at the device boundary. Common conversation style, device-specific constraint beats and model catalog. |

---

## Feature Dependencies

```
Device picker at conversation start
    └──enables──> Device context at chat route entry
                      └──enables──> Device-specific Gemini system prompt
                                        └──enables──> Stomp constraint interview arc
                                        └──enables──> Pod Go budget interview arc
                                        └──enables──> Stadium Agoura-first arc
                                        └──enables──> Helix dual-amp interview arc

Device-specific planner prompts
    └──requires──> Separate catalog modules per device family
                       └──eliminates──> Agoura amp name leak to non-Stadium devices
                       └──eliminates──> Guard-based model filtering in buildPlannerPrompt()
    └──enables──> Per-family prompt caching (Helix cache != Stadium cache)
    └──independent of──> Conversation arc changes (different pipeline stage)

Stadium firmware parameter completeness
    └──requires──> Corpus extraction of full 27+ param key list from real .hsp files
    └──requires──> Extension of buildAmpParams() in stadium-builder.ts
    └──requires──> Per-model hidden param defaults in STADIUM_AMPS catalog
    └──independent of──> Device-first routing (pure Stadium builder fix)
    └──fixes──> Param bleed on hardware (silent data corruption)

Device-specific chain rules (module pattern)
    └──requires──> DeviceChainRules interface definition
    └──requires──> 4 device-module implementations
    └──enables──> Single-file addition for device 7 (no guard edits needed)
    └──requires (ordering)──> Device-specific routing in place before guard removal
    └──note──> Existing block budget constants (STOMP_CONFIG, STADIUM_CONFIG) migrate to device modules unchanged

Device family UI grouping (4 cards vs 6 selectors)
    └──requires──> Device picker moved to conversation start
    └──enhances──> Device selection UX (Stadium/Helix/Stomp/Pod Go mental model)
    └──independent of──> Backend architecture changes
```

### Dependency Notes

- **Device picker move is the foundation.** Every other feature in this milestone depends on device context being established at conversation start. Without it, device-specific prompts and conversation arcs have no moment to fire. This is P0 — it must ship before anything else.
- **Planner prompt isolation and conversation arc changes are parallel tracks.** Planner prompt isolation fixes a correctness bug (wrong model names in files). Conversation arc changes fix a UX problem (wrong expectations during interview). They touch different pipeline stages and can be implemented in parallel.
- **Stadium param completeness is an independent fix.** It does not require device-first routing to be complete. It is a pure Stadium builder fix that should be implemented in the same milestone because the symptom (param bleed) is the other post-v4.0 bug driving this milestone.
- **Device module architecture is the lowest priority in the group.** It has zero user-facing impact. It is the correct long-term direction but is not required for the other features to ship correctly. Implement last, after the higher-priority fixes are stable.
- **UI family grouping (4 cards) can ship independently.** It is a frontend change with no backend impact. It can be implemented in the same PR as the device picker move.

---

## MVP Definition for v5.0

### Launch With (v5.0 core — required to close the architectural gaps)

- [ ] Device picker at conversation start — move selector to before chat; pass device to Gemini system prompt on first message; this is the architectural prerequisite for everything else
- [ ] Device-specific Gemini system prompt sections — Stomp constraint beat, Pod Go budget beat, Stadium Agoura-first beat, Helix dual-amp beat; each injected based on device family at session start
- [ ] Device-specific planner prompts with isolated model catalogs — 4 separate prompt builder functions; each imports only its own catalog; factory routes by device family; eliminates Agoura leak by construction
- [ ] Stadium firmware parameter completeness — corpus extraction; extend `buildAmpParams()` to emit all 27+ params with sensible defaults; fixes param bleed on hardware

### Add in v5.0 Extended (higher implementation cost, same milestone)

- [ ] Device-specific chain validation modules — move per-device validation from guards to DeviceChainRules implementations; Stomp dual-amp rejection, Pod Go effect count enforcement, Stadium HD2 amp rejection
- [ ] Device family UI grouping — 4 family cards (Stadium / Helix / Stomp / Pod Go) with variant picker inside each card; reduces cognitive load at device selection

### Future Consideration (v5.1+ — architecture hygiene, not features)

- [ ] Full guard removal from chain-rules.ts and param-engine.ts — only after device modules are stable and tested; guards become dead code once routing is in place
- [ ] Device 7 onboarding (single-file pattern) — new device via DeviceChainRules implementation + device-specific catalog module + builder; no guard edits anywhere

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Device picker at conversation start | HIGH (fixes late-device UX mismatch) | LOW (UI + route change) | P0 |
| Device-specific Gemini system prompt sections | HIGH (Stomp/Pod Go constraint awareness) | LOW (prompt additions) | P1 |
| Device-specific planner prompts + catalog isolation | HIGH (fixes Agoura correctness bug) | MEDIUM (refactor prompt builder) | P1 |
| Stadium firmware parameter completeness | HIGH (fixes param bleed on hardware) | HIGH (corpus extraction + builder extension) | P1 |
| Device-specific chain validation modules | LOW user / HIGH maintainability | HIGH (DeviceChainRules interface + 4 impls) | P2 |
| Device family UI grouping (4 cards) | MEDIUM (better mental model for users) | LOW (frontend only) | P2 |
| Full guard removal | ZERO user / HIGH code quality | MEDIUM (cleanup after modules land) | P3 |

**Priority key:**
- P0: Architectural prerequisite — nothing else works without this
- P1: Correctness fixes that directly affect preset quality on hardware
- P2: Architecture and UX improvements; meaningful but not blocking
- P3: Code quality; implement when P1/P2 is stable

---

## Device Constraint Conversation Patterns (Reference)

This section documents the specific conversation beats that work best for each device family. These are reference patterns for the chat system prompt author.

### Stomp (6-block / 9-block hard limit)

**Opening constraint question (ask within first 2 exchanges):**
> "One quick thing before we build — are you using the Stomp with an existing pedalboard (drives, modulation already covered), or is it your complete signal chain? That tells me how many of your 6 blocks we need for effects."

**Budget declaration (include in plan summary):**
> "Here's what fits in your 6 blocks: amp (1) + cab (1) + [3-4 effects]. I'm planning: [list effects]. That leaves [N] blocks used — [M] free if you want to swap anything."

**Constraint reframe (if user wants more effects than budget):**
> "That's 5 effects plus amp and cab — one too many for the Stomp. Which matters more to you: [effect A] or [effect B]? The other can live on a physical pedal if you have one."

**Anti-pattern to avoid:** Apologizing for the Stomp's block count. The constraint is the creative challenge.

---

### Pod Go (4-effect limit)

**Budget declaration (early in conversation):**
> "Pod Go gives us 4 effect slots after amp and cab. For a [genre] tone that's actually perfect — we want [2 core effects] plus room for [2 more]. What are the 2 effects you'd fight to keep if it came to that?"

**When user wants more:**
> "With 4 slots we need to pick: [list requested effects]. For [genre], I'd prioritize [effect A] and [effect B]. Want me to go with that, or swap one out?"

**Anti-pattern to avoid:** Treating Pod Go as a lesser device. It is a budget-constrained all-in-one, and the interview should feel focused, not apologetic.

---

### Helix (16 blocks, dual-DSP)

**Dual-amp question (after tone goal and guitar are established):**
> "Do you want to be able to switch between two different amp characters — like a clean Fender for your rhythm parts and a Marshall for leads — or is one amp sound doing everything?"

**If dual-amp:** "Great — I'll set it up so your clean/crunch snapshots use the [amp A] and lead/ambient snapshots switch to [amp B]. The two amps run in parallel with a split-merge block."

**If single-amp:** Skip dual-amp discussion entirely. Proceed to effect preferences.

**Anti-pattern to avoid:** Asking about dual-amp too early (before tone goal). The answer only makes sense in context.

---

### Stadium (Agoura amp catalog, professional use case)

**Amp family orientation (replace generic "what gain level" question):**
> "Stadium's Agoura engine models the actual circuits — so instead of 'clean vs. heavy,' tell me the amp brand you're after. Fender-voiced clean? Vox chime? Marshall crunch? Mesa rectified lead? I'll match you to the Agoura version."

**Snapshot count awareness:**
> "Stadium supports 8 snapshots — that's more than the Helix's 4. Do you want to use all 8 (great for live sets with distinct sections) or keep it to the standard 4 (cleaner footswitch management)?"

**Multi-path question (optional, for advanced users who bring it up):**
> "Stadium also supports routing a microphone or second instrument on a separate path with its own amp and effects. Are you running just guitar, or do you want to use the multi-path capability?"

**Anti-pattern to avoid:** Mentioning HD2 amp names at all. Stadium users chose the device for Agoura quality — referencing "Placater Dirty" or "Litigator" is a category error.

---

## Competitor Feature Analysis

| Dimension | BIAS X (Positive Grid, 2025) | Quad Cortex (Neural DSP) | HelixTones v5.0 Target |
|-----------|------------------------------|--------------------------|------------------------|
| Device selection timing | Plugin format selected at launch; AI catalog scoped to that format before tone creation | Template (path topology) selected before any block placement | Device family selected before first chat message; all downstream pipeline scoped to that family |
| Constraint communication | AI transparently shows what fits in selected format | Block slots shown visually; DSP meter shows remaining budget | Constraint declared in conversation beat; budget stated explicitly in plan summary |
| Constrained device experience | Not applicable (plugin, not hardware) | Preamp block option to save DSP; visual budget indicator | Stomp: "what will you cut?" arc; Pod Go: 4-slot priority question |
| Model catalog isolation | Catalog is format-specific; no leakage between formats | Models filtered by hardware capability | Device-family catalog modules; no shared global; leakage architecturally impossible |
| Professional device experience | N/A | Full-featured with no apology for constraints | Stadium: Agoura-first conversation; 8-snapshot awareness; multi-path mention for advanced users |

---

## Sources

- [HX Stomp: Are 6 blocks enough? — Line 6 Community](https://line6.com/support/topic/36658-hx-stomp-are-6-blocks-enough-not-really/) — HIGH confidence (community consensus on block budget strategies)
- [Creative Ways to Get Even More out of HX Stomp — Sweetwater InSync](https://www.sweetwater.com/insync/get-much-more-out-of-hx-stomp/) — HIGH confidence (editorial, verified techniques)
- [Signal Path Routing — Helix Stadium Manual](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — HIGH confidence (official documentation)
- [Amp Blocks — Helix Stadium Manual](https://manuals.line6.com/en/helix-stadium/live/amp-blocks) — HIGH confidence (official; documents Hype, Bright, Contour, Aggression, Depth, Fat params)
- [Helix Stadium 1.2.1 Release Notes — Line 6 Community](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105) — HIGH confidence (official firmware notes confirming Agoura amp additions)
- [BIAS X Review — Develop Device](https://developdevice.com/blogs/news/bias-x-review-positive-grids-ai-powered-revolution-in-guitar-tone) — MEDIUM confidence (describes AI-first tone creation flow)
- [Positive Grid BIAS X — Guitar World](https://www.guitarworld.com/gear/plugins-apps/positive-grid-bias-x-launch) — MEDIUM confidence (device-first format selection documented)
- [Quad Cortex vs Helix vs Kemper — Guitar Guitar](https://www.guitarguitar.co.uk/news/141684/) — MEDIUM confidence (confirms Quad Cortex template-first UX pattern)
- [Neural DSP Quad Cortex Review — HoneySonic](https://www.honeysonic.com/blog/neural-dsp-quad-cortex-review) — MEDIUM confidence (confirms preset template as device context in QC)
- [Understanding Helix Amp Parameters — Sweetwater InSync](https://www.sweetwater.com/insync/understanding-helix-amp-parameters/) — HIGH confidence (editorial confirming Drive/Master/ChVol roles)
- [The Blocks — Helix Help](https://helixhelp.com/tips-and-guides/helix/the-blocks) — HIGH confidence (block budget rules and DSP constraints)
- Direct codebase inspection of `planner.ts`, `chain-rules.ts`, `config.ts`, `types.ts`, `models.ts`, `stadium-builder.ts` (2026-03-05) — HIGH confidence

---

*Feature research for: HelixTones v5.0 — Device-First Architecture Rework*
*Researched: 2026-03-05*
