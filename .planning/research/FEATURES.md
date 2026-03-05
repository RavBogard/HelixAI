# Feature Research

**Domain:** AI-powered guitar preset generator — HelixTones v4.0 Stadium rebuild + preset quality leap
**Researched:** 2026-03-05
**Confidence:** HIGH (Anthropic pricing from official docs; amp parameter guidance from Line 6 Community + HelixHelp; signal chain order from Strymon/BOSS/Reverb consensus; cab pairings from community analysis; AI routing from official pricing page verified 2026-03-05)

---

## Context: What Already Exists vs. What This Milestone Adds

HelixTones v3.2 has a fully working planner-executor architecture. The Planner (Claude Sonnet 4.6) selects amp/cab/effects via structured output. The Knowledge Layer deterministically assigns all numeric parameters. All six devices are supported in code; Stadium is temporarily blocked in the UI pending builder rebuild.

**What already works well:**
- Category-level amp defaults (clean/crunch/high_gain) with Drive/Master/ChVol/Sag/Bias in param-engine.ts
- Topology-aware mid adjustment (cathode_follower vs plate_fed) — 3-layer resolution already in place
- Cab LowCut/HighCut filtering per category; post-cab Parametric EQ per category
- Genre-aware effect defaults for delay/reverb/modulation (9 genres)
- Snapshot design with 4 toneRoles (clean/crunch/lead/ambient)
- Always-on mandatory blocks: Minotaur/Scream 808 boost, Horizon Gate (high-gain), post-cab Parametric EQ, Gain Block
- Signal chain slot ordering: wah > compressor > boost > amp > cab > gate > eq > mod > delay > reverb
- guitarType in ToneIntent (single_coil/humbucker/p90) — captured but not yet used to differentiate params
- cabAffinity field on HelixModel — populated but not yet enforced at runtime
- tempoHint in ToneIntent — captured but not wired to Knowledge Layer delay calculation
- Token usage logging with baseline generator (v3.2)
- Chat uses Claude Sonnet 4.6; all API calls use Sonnet regardless of task complexity

**The quality gap this milestone closes:**
The six features under research address the specific ways generated presets fall short of professional preset builders: gain-staging is category-level (not per-model), cab pairing is AI-chosen (not expert-validated), effects ignore interaction parameters, amp tuning ignores per-model circuit behavior, all API calls use the most expensive model, and the six-device codebase has no unified abstraction layer.

---

## Research Findings: The Six Feature Areas

### Finding 1: Gain-Staging Intelligence

**What professional Helix preset builders do:**

Drive, Master, and Channel Volume serve completely different roles — a fact not fully reflected in the current AMP_DEFAULTS category tables:

- **Drive**: Maps to the Volume knob on non-master-volume amps (Fender Deluxe, Vox AC30, Hiwatt). On these amps, Drive at 0.25 produces almost no character — it should be 0.55-0.70 to get edge-of-breakup. On master-volume amps (Marshall JCM, Mesa), Drive maps to the Gain/Drive input and determines preamp saturation.
- **Master**: On non-master-volume amps, Helix "invents" a master volume equivalent. Run it at 1.0 (fully open) to let the power amp character engage. On master-volume amps, lower Master = tighter feel. Professional presets for high-gain Marshall/Mesa run Master 0.40-0.55. Master above 0.65 with high Drive produces mushiness.
- **Channel Volume (ChVol)**: Pure level control — no tonal effect. Used exclusively for balancing preset output level across snapshots and presets. Pro standard: 0.70 base, then +0.05 for crunch, +0.10 for lead, -0.05 for ambient.

**Current state gap:** The AMP_DEFAULTS table sets high_gain Master at 0.45, clean Master at 0.95 — these are reasonable category-level defaults but wrong for specific models. The US Deluxe Nrm's Drive should be 0.55-0.65 (Volume knob), not 0.25. The Vox AC-30 should run Master 1.0, not 0.95 (minor but meaningful). High-gain amps need per-model Drive values because Drive 0.40 on a Mesa Rectifier sounds completely different from Drive 0.40 on a Bogner Uberschall.

**Recommended implementation:** Sparse per-model override table applied as layer 4 (highest priority) in resolveAmpParams(). Most amps can continue using category defaults. Priority overrides for: US Deluxe/Vib/Double (Drive up), AC-15/AC-30 (Drive up, Master to 1.0), Matchless DC-30 (Master 1.0), Essex/WhoWatt (Master 1.0), non-master-volume amps generally.

**Source confidence:** HIGH — Line 6 Community official documentation on parameter semantics, HelixHelp Common Amp Settings, Sweetwater Understanding Helix Amp Parameters editorial.

---

### Finding 2: Cab Pairing Guidance

**Community-validated amp-to-cab pairing table:**

| Amp Family (real-world origin) | Recommended Helix Cab(s) | Rationale |
|-------------------------------|--------------------------|-----------|
| Fender Deluxe/Vibrolux/Super | 1x12 US Deluxe, 2x12 Double C12N | Same C12N speaker as original combos |
| Fender Twin Reverb | 2x12 Double C12N | Original Twin C12N speaker in 2x12 format |
| Fender Bassman / Tweed | 4x10 Tweed P10R | Jensen P10R speakers — Bassman original config |
| Vox AC30 (normal/top boost) | 2x12 Blue Bell | Alnico Blue — the AC30 sound |
| Vox AC15 | 2x12 Blue Bell, 1x12 Blue Bell | Same Alnico Blue, smaller format |
| Marshall Plexi (low-power) | 4x12 Greenback25, 4x12 Greenback20 | Historical G12M Greenback pairing |
| Marshall JCM800/JVM (modern) | 4x12 1960 T75, 4x12 Brit V30 | T75 for tight British; V30 for singing mids |
| Mesa Boogie Mk I/II/III/IV | 4x12 Cali V30, 1x12 Cali IV | Mesa's own V30 cabs |
| Mesa Rectifier (Dual/Triple) | 4x12 Cali V30, 4x12 XXL V30 | Rectifier always pairs with V30 in studio and live |
| Orange (Rockerverb/TH30) | 2x12 Mandarin 30 | Orange PPC212 with V30 — canonical Orange cab |
| Matchless DC-30 / Two-Rock | 2x12 Match H30, 2x12 Match G25 | Celestion H30/G25 Matchless originals |
| Bogner Uberschall/Ecstasy | 4x12 Uber V30, 4x12 Uber T75 | Bogner's own Uberkab |
| High-gain modern (Friedman/Diezel/5150) | 4x12 XXL V30, 4x12 Cali V30 | V30s for sustain and mid-forward character |
| Silverface Fender (clean headroom) | 2x12 Double C12N | Same Fender family; classic clean tone |

**Implementation approach:** The cabAffinity field on HelixModel already contains these pairings (added in an earlier build). The gap is enforcement — the AI (Planner) chooses the cab, but there is no validation that the chosen cab is in the amp's affinity list. Two options:
1. Enrich the planner prompt with an explicit pairing table (low code risk, leverages AI selection)
2. Add a fallback in chain-rules.ts: if chosen cabName is not in amp's cabAffinity list, substitute the first affinity option (more deterministic, but overrides user intent)

Recommended: Option 1 (prompt enrichment) for v4.0. Option 2 as a future Quality Gate.

**Source confidence:** MEDIUM — community consensus from Line 6 forums and Helix Cabinet Model documentation. No official Line 6 pairing guide exists; these are historically-accurate amp-cab pairings mapped to the Helix model catalog.

---

### Finding 3: Effect Interaction Parameters

**Industry-standard signal chain order (already implemented — chain-rules.ts slot ordering is correct):**

The standard order from Strymon, BOSS, and Reverb News is universally:
```
Guitar -> Tuner -> Wah -> Compressor -> Drive/Overdrive -> Amp -> Cab -> Gate -> EQ -> Modulation -> Delay -> Reverb
```

This is exactly what chain-rules.ts already produces. The v4.0 improvement is not about ordering — it is about interaction-aware parameter values.

**Effect interaction rules that matter for parameter quality:**

| Interaction | Parameter to Adjust | Rule | Why |
|-------------|---------------------|------|-----|
| Compressor + mandatory boost | Compressor Threshold lower | -0.05 relative to default when boost is also always_on | Boost drives amp harder; compressor should not double-compress the clean signal |
| High-gain amp + gate | Horizon Gate Threshold higher | 0.55 instead of 0.50 | High-gain amps amplify the noise floor significantly more than clean amps |
| Modulation + Reverb together | Reverb Mix lower | -0.08 relative to genre default when a modulation block is also present | Lush modulation + full reverb mix = muddy wash; reduce reverb when modulation is active |
| Delay + Reverb (standard) | Delay before Reverb | Already correct — slot order enforces this | Echoes should decay into reverb space naturally |
| Tempo-synced delay | Delay Time = 60000/BPM * note_factor | Quarter note factor = 1.0, dotted-eighth = 0.75 (the "Edge" style), eighth = 0.5 | Delay aligned to BPM creates musical rhythmic echoes; arbitrary ms is unprofessional |
| Reverb PreDelay by category | PreDelay by amp category | Clean: 40-60ms, Crunch: 20-40ms, High-gain: 10-20ms | High-gain needs tight attack before reverb tail; ambient/clean benefits from longer pre-delay separation |

**Note on delay timing:** The formula is straightforward: `Time_ms = 60000 / BPM * note_factor`. Helix normalizes delay Time as 0.0-1.0 where the max is typically 2000ms. So normalized value = Time_ms / 2000. For 120 BPM dotted-eighth: 60000/120 * 0.75 = 375ms = 0.1875 normalized. This should be computed in param-engine.ts when `intent.tempoHint` is present for a delay block.

**Reverb PreDelay:** Not currently in any reverb model's defaultParams or genre overrides. Adding it as a new key in GENRE_EFFECT_DEFAULTS reverb entries (e.g., `PreDelay: 0.030` for 30ms) is a single low-risk addition — but must verify that Helix reverb models accept a PreDelay parameter in the .hlx file.

**Source confidence:** HIGH for signal chain ordering (multiple authoritative sources agree universally). HIGH for PreDelay ranges (iZotope professional audio documentation + Music Guy Mixing). MEDIUM for interaction parameter adjustments (derived from professional preset analysis; not official Line 6 specs).

---

### Finding 4: Per-Model Amp Parameter Tables

**How professional Helix preset builders tune parameters per model:**

Professional builders treat each amp model as its own entity with its own circuit behavior. Key differences:

- **Non-master-volume amps (Fender, Vox, Hiwatt, early Marshall):** Drive IS the Volume knob. Setting Drive low produces a quiet, characterless sound. Drive 0.60-0.75 for edge-of-breakup; Master at 1.0 (fully engaged power amp). The current category default (clean: Drive 0.25) is wrong for this class of amp.
- **Master-volume amps (JCM800, JVM, Mesa):** Drive controls preamp gain. Master controls power amp level and feel. Lower Master = tighter response; higher Master = more compressed power amp saturation. Pro presets run Master 0.40-0.55 for modern high-gain tightness.
- **Model-specific unique controls:** Some amps have controls with no category-level equivalent — Bogner Ecstasy Contour, Mesa Mk IV Pull Bright/Pull Deep, WhoWatt Resonance. The current category overlay writes only to Drive/Master/ChVol/Sag/Bias/Bass/Mid/Treble/Presence — model-specific params like Cut, Deep, Resonance, BrightSwitch survive because they are not in the overlay key set. This is already correct behavior.

**Top 15 amps needing per-model Drive/Master overrides (by request frequency):**

| Amp Model (Helix name) | Real-world amp | Key override |
|------------------------|---------------|--------------|
| US Deluxe Nrm / Vib | Fender Deluxe Reverb | Drive: 0.60, Master: 1.0 (no real master) |
| US Double Nrm / Vib | Fender Twin Reverb | Drive: 0.55, Master: 1.0 |
| US Princess | Fender Princeton | Drive: 0.65, Master: 1.0 |
| Voltage Queen | Victoria Victorilux (6V6 Fender-style) | Drive: 0.58, Master: 1.0 |
| Interstate Zed | Dr. Z Z-Wreck | Drive: 0.58, Master: 1.0 |
| Matchstick Ch1/Ch2 | Matchless DC-30 | Drive: 0.55, Master: 1.0 |
| A30 Fawn Nrm / Brt | Vox AC30 Normal/Top Boost | Drive: 0.60, Master: 1.0 |
| Mandarin 80 | Orange OR80 | Drive: 0.52, Master: 0.75 |
| Essex A-15 | Vox AC15 | Drive: 0.60, Master: 1.0 |
| WhoWatt 100 | Hiwatt DR-103 | Drive: 0.50, Master: 0.85 |
| Placater Clean / Dirty | Friedman BE-100 | Clean: Drive: 0.45, Master: 0.75; Dirty: Drive: 0.50, Master: 0.50 |
| Cali IV Rhythm 1/2 | Mesa Mk IV Rhythm | Drive: 0.40, Master: 0.65 |
| Cali IV Lead | Mesa Mk IV Lead | Drive: 0.52, Master: 0.55 |
| Das Benzin Chunk / Lead | Diezel VH4 | Drive: 0.45, Master: 0.48 |
| 2204 Mod | Marshall JCM800 modded | Drive: 0.50, Master: 0.55 |

**Implementation:** Sparse override table in param-engine.ts applied as Layer 4 (after topology mid override). Keys: only Drive and Master where they significantly deviate from category defaults. ChVol stays at category default (0.70) — it is a level control, not a tone control. Sag/Bias also remain at category level unless specific model requires otherwise.

**Source confidence:** MEDIUM — values derived from community analysis of professional presets, HelixHelp documentation on per-model behavior, and Sweetwater editorial. Not official Line 6 engineering specs.

---

### Finding 5: Cost-Aware AI Model Routing

**Current state:** Every API call uses claude-sonnet-4-6 at $3/$15 per million tokens. The token usage logger was added in v3.2 but the routing decision was deferred pending baseline data.

**Official Anthropic pricing (verified 2026-03-05 from platform.claude.com/docs/en/about-claude/pricing):**

| Model | Input (per MTok) | Output (per MTok) | Cache Read | Cache Write 5min |
|-------|-----------------|-------------------|------------|------------------|
| claude-sonnet-4-6 | $3.00 | $15.00 | $0.30 | $3.75 |
| claude-haiku-3-5 | $0.80 | $4.00 | $0.08 | $1.00 |
| claude-haiku-4-5 | $1.00 | $5.00 | $0.10 | $1.25 |

**Routing analysis:**

Two distinct call types exist in HelixTones:

1. **Chat turns** (`/api/chat` or equivalent): Conversational turns — asking about tone goals, genre, artist references, guitar type. These do NOT require structured output or expert gear knowledge. They require: natural conversation, following up on prior messages, asking clarifying questions, and detecting when enough info exists to signal [READY_TO_GENERATE]. This is within Haiku capability.

2. **ToneIntent generation** (`/api/generate`): The Planner structured output call — selecting specific amp models (e.g., "Placater Dirty" for a Friedman BE-100 lead tone), cab models, effect combinations, snapshot design. This requires deep gear knowledge and schema-constrained output. Must stay on Sonnet.

**Recommendation:** Route chat turns to claude-haiku-3-5. Keep preset generation on claude-sonnet-4-6.

**Cost savings at scale (evidence-based, not guesswork):**

Typical chat conversation: 8-12 turns before [READY_TO_GENERATE]. Average ~1500 tokens input, ~300 tokens output per chat turn (based on system prompt ~500 tokens + conversation history growing).

Per conversation chat cost on Sonnet: 10 turns * (1500 * $3 + 300 * $15) / 1,000,000 = 10 * ($0.0045 + $0.0045) = $0.09 per conversation
Per conversation chat cost on Haiku 3.5: 10 turns * (1500 * $0.80 + 300 * $4) / 1,000,000 = 10 * ($0.0012 + $0.0012) = $0.024 per conversation
**Savings: 73% reduction on chat costs.** At 100 conversations/month: $6.60 savings. At 1000 conversations/month: $66 savings.

**Implementation risk:** Low. Haiku 3.5 chat quality is adequate for conversational turns that do not require complex reasoning or gear knowledge. The only risk is Haiku failing to detect [READY_TO_GENERATE] correctly — mitigated by providing the trigger phrase in the system prompt explicitly.

**Anti-pattern to avoid:** Dynamic escalation ("try Haiku, escalate to Sonnet if response quality is poor") requires quality evaluation which is itself expensive and adds latency. Use static routing: chat = Haiku always, generation = Sonnet always. This is the industry-standard pattern for mixed-complexity workloads.

**Pre-condition:** Run 30 days of token logging baseline first to confirm chat calls dominate cost and that per-turn token counts match the estimates above. The v3.2 token logger makes this straightforward.

**Source confidence:** HIGH for pricing — directly from official Anthropic API pricing page. MEDIUM for Haiku routing recommendation — industry pattern is well-established; specific cost savings depend on actual call volume.

---

### Finding 6: Unified Device Abstraction Layer

**Current state — four separate builders:**

| File | Device(s) | Format | DSP model |
|------|-----------|--------|-----------|
| preset-builder.ts | Helix LT, Helix Floor | .hlx | Dual DSP (dsp0/dsp1), 8 blocks each |
| podgo-builder.ts | Pod Go | .pgp | Single DSP, different @type encoding |
| stadium-builder.ts | Helix Stadium | .hsp | Single path, 12 blocks max |
| stomp-builder.ts | HX Stomp, HX Stomp XL | .hlx | Single DSP, 6 or 9 block limit |

**What is already unified (good):**
- `chain-rules.ts` handles all 6 devices with device-aware branching — single function
- `param-engine.ts` handles all devices with device-aware amp lookup at top
- `ToneIntent` is the shared contract — all devices go through the same Planner output
- `DeviceTarget` type is the shared discriminant

**What is fragmented (gaps):**
- 4 separate serializer files with no shared interface — adding device 7 requires creating a 5th file
- Block type encoding: `BLOCK_TYPES` (Helix/Stadium) vs `BLOCK_TYPES_PODGO` — separate maps
- STADIUM_AMPS in models.ts is a separate table from AMP_MODELS, but uses the same HelixModel type
- No `DeviceBuilder` factory pattern — callers need to know which specific builder to import
- Stomp builder code is nearly identical to LT/Floor builder but with different DEVICE_IDS and block limits

**What a unified abstraction would look like:**

```typescript
// A shared interface (Ports and Adapters pattern)
interface DeviceBuilder {
  buildPreset(spec: PresetSpec, intent: ToneIntent): unknown;
  getFileExtension(): ".hlx" | ".pgp" | ".hsp";
  getDeviceId(): number;
}

// Factory function — single import point for callers
function createBuilder(device: DeviceTarget): DeviceBuilder;
```

Internal logic of each builder stays unchanged. The interface enforces a consistent public API.

**Cost-benefit assessment for refactor:**

- Cost: HIGH — touching 4+ files with risk of regression; needs full test suite run
- User-facing benefit: ZERO — users see no difference
- Maintainability benefit: HIGH for future device additions; MEDIUM for current maintenance
- Recommendation: **Do the audit in v4.0 to document what is shared vs. diverged. Only refactor if the Stadium builder rebuild reveals that the current 4-builder structure makes Stadium fixes require touching 3+ files simultaneously.**

**What makes a device abstraction layer work well (from software architecture research):**

The Ports and Adapters (Hexagonal Architecture) pattern is the strongest match:
- Core preset engine (ToneIntent -> PresetSpec) is the "domain core" — stays device-agnostic
- Each builder is a "port adapter" that translates PresetSpec to device-specific file format
- chain-rules.ts and param-engine.ts are "domain services" — they already handle device branching internally

The existing architecture already approximates this pattern. The main gap is the missing `DeviceBuilder` interface and factory function. This is a low-risk refactor (adding an interface + factory, not rewriting the builders themselves).

**Source confidence:** HIGH for current state assessment — direct code analysis. MEDIUM for abstraction recommendation — standard software engineering patterns; no Helix-specific architecture guidance exists.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that define quality for a preset generator competing with paid commercial presets.

| Feature | Why Expected | Complexity | Dependencies on Existing Code |
|---------|--------------|------------|-------------------------------|
| Stadium rebuild from real .hsp files | Stadium is blocked in the UI — users literally cannot select it | HIGH | Reverse-engineer 11 real .hsp files; extend stadium-builder.ts from ground truth |
| Tempo-synced delay | Users who provide BPM expect delay to lock to tempo; dotted-eighth delay is ubiquitous in worship/rock | LOW | tempoHint already in ToneIntent; add BPM formula to param-engine.ts delay resolution |
| Reverb PreDelay (20-60ms) | Professional presets always set PreDelay — absent pre-delay smears note attack | LOW | Add PreDelay key to GENRE_EFFECT_DEFAULTS reverb entries; verify reverb models accept it |
| Guitar-type EQ shaping | Single coil vs humbucker presets should differ — same tone settings are wrong for both | LOW | guitarType in ToneIntent; extend EQ_PARAMS or AMP_DEFAULTS with guitarType dimension |
| Cab pairing enforcement/guidance | Random cab selection sounds amateur — Fender Deluxe should pair with Fender-style 1x12, not 4x12 Greenback | LOW | cabAffinity populated on HelixModel; enrich planner prompt with pairing table |
| Gain-staging refinement per amp category | Category defaults are already reasonable; per-amp Master/Drive is the next quality level | MEDIUM | Extend 3-layer resolution in param-engine.ts with layer 4 per-model overrides |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Dependencies on Existing Code |
|---------|-------------------|------------|-------------------------------|
| Per-model amp parameter overrides | Instead of all high-gain amps getting the same Drive, each amp model gets expert-tuned values | HIGH | New sparse override table in param-engine.ts; ampFamily classification in models.ts |
| Effect combination logic (interaction-aware params) | Reverb Mix lower when modulation is active; Gate Threshold higher for high-gain; compressor adjusted when boost is always-on | MEDIUM | Extend resolveDefaultParams() and resolveDynamicsParams() with interaction-aware logic |
| Cost-aware model routing (Haiku for chat) | 73% chat cost reduction; Sonnet reserved for structured ToneIntent generation only | MEDIUM | New routing logic in chat API endpoint; change model string for chat calls only |
| Genre-aware cab selection in planner prompt | Metal presets bias to V30/Greenback; jazz to small 1x12/2x12 | LOW | Planner prompt enrichment only; no Knowledge Layer changes |
| Snapshot-aware volume compensation (ChVol per toneRole) | Lead snapshots +10% ChVol vs clean — makes snapshots volume-balanced by default | LOW | Extend snapshot-engine.ts with per-toneRole ChVol delta table |
| Device/model abstraction layer (DeviceBuilder interface) | Reduces duplication; makes adding device 7 a single file rather than touching chain-rules + param-engine + builder | HIGH | New interface + factory; internal builder logic unchanged |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI-generated numeric amp parameters | "Let Claude pick Drive and Master values per amp model" | AI numbers are inconsistent and not calibrated to Helix's float encoding. Planner-Executor split exists because AI-generated params were tried and produced worse results. | Curated per-model override tables — deterministic, testable, improvable over time |
| Haiku for ToneIntent generation | "The Planner call is expensive — use Haiku to save 73%" | ToneIntent generation is where all preset quality lives. Model selection (choosing "Placater Dirty" vs "Solo Lead 100") requires deep gear knowledge. Haiku 3.5 achieves ~90% benchmark performance but gear knowledge is not a benchmark. | Route chat to Haiku; keep Sonnet for generation. The Planner call is ~1 per preset vs. 10 chat turns — its cost is already 10x smaller. |
| Real-time dynamic escalation (Haiku -> Sonnet) | "Try Haiku, escalate if poor quality" | Quality evaluation requires AI evaluation — creates cost loops and latency. | Static routing: Haiku for chat always, Sonnet for generation always. |
| IRs (impulse responses) in generated presets | "IRs sound better than stock cabs" | IRs require file loading infrastructure, per-user IR libraries, and break preset portability. Already explicitly out of scope in PROJECT.md. | Better mic choice selection and cab parameter tuning achieves competitive results within stock cabs. |
| Full parallel routing by AI | "Let Claude design any signal topology" | Unconstrained AI topology selection produces DSP overflows and broken presets. Routing must be the Knowledge Layer's responsibility with named topologies. | Offer 2-3 named topologies (serial, dual_amp_AB) that the Planner can select; each has pre-validated block budgets. |
| Device abstraction refactor before Stadium rebuild | "Refactor first, then rebuild Stadium on the clean architecture" | Refactoring all 4 builders before the Stadium rebuild is confirmed working adds regression risk. Stadium rebuild is the unblock. | Do Stadium rebuild first. Audit the abstraction gaps in parallel. Only refactor if the rebuild reveals structural problems. |

---

## Feature Dependencies

```
Stadium rebuild from real .hsp files
    └──required by──> Unblock Stadium in UI (blocked since v3.2)
                           └──required by──> Stadium users can generate presets
    └──informs──> Device abstraction layer audit (may reveal structural issues)

Tempo-synced delay
    └──requires──> tempoHint in ToneIntent [EXISTS]
    └──requires──> Delay Time override formula in param-engine.ts resolveDefaultParams()

Reverb PreDelay
    └──requires──> PreDelay key added to GENRE_EFFECT_DEFAULTS reverb sections
    └──requires──> Verification that Helix reverb model .hlx format accepts PreDelay param

Guitar-type EQ shaping
    └──requires──> guitarType in ToneIntent [EXISTS: single_coil/humbucker/p90]
    └──requires──> New EQ_PARAMS dimension (currently indexed by ampCategory only)
    └──enhances──> Pickup-specific EQ — first use of the guitarType field in Knowledge Layer

Gain-staging refinement + Per-model amp overrides
    └──requires──> ampFamily classification on HelixModel in models.ts
    └──requires──> Layer 4 override table in param-engine.ts resolveAmpParams()
    └──conflicts with (ordering)──> Must be applied AFTER category + topology layers
    └──note──> ampFamily is shared infrastructure for both Master strategy and Drive overrides

Cab pairing guidance
    └──requires──> cabAffinity on HelixModel [EXISTS, populated on most amps]
    └──requires──> Planner prompt enrichment with pairing table text
    └──optional──> Runtime validation in chain-rules.ts (future Quality Gate)

Effect combination logic
    └──requires──> Access to full effect list in resolveBlockParams()
    └──requires──> Interaction detection: does a compressor block appear alongside a boost?
    └──note──> Current architecture passes each block individually — may need refactor to pass context

Snapshot-aware volume compensation
    └──requires──> Per-toneRole ChVol delta table in snapshot-engine.ts
    └──requires──> toneRole in SnapshotIntent [EXISTS]
    └──note──> ChVol changes must be applied as snapshot parameter overrides, not base params

Cost-aware model routing
    └──requires──> Anthropic SDK model string change in chat endpoint
    └──requires──> 30-day token logging baseline to confirm savings match estimates
    └──independent of──> all tone quality features

Device abstraction layer
    └──requires──> Audit of 4 builder files + chain-rules + param-engine
    └──informs──> whether DeviceBuilder interface + factory is worth the refactor cost
    └──independent of──> all tone quality features
    └──blocked by (recommended)──> Stadium rebuild should complete first
```

### Dependency Notes

- **Stadium rebuild is the only P1 unblock for a device.** Without it, Stadium users are blocked. All other features improve quality for the 5 working devices.
- **ampFamily classification enables three quality features.** Gain-staging, per-model overrides, and Master Volume strategy all share the ampFamily infrastructure. Implement once in models.ts.
- **Effect combination logic requires architectural consideration.** The current param-engine.ts processes each block in isolation via resolveBlockParams(). Interaction-aware params require knowing what other blocks are present. The cleanest approach: pass the full resolved chain as context to resolveDefaultParams(), or do a second pass over the chain after initial resolution.
- **Guitar-type EQ is the easiest P1 feature.** guitarType is already in ToneIntent; adding a dimension to EQ_PARAMS is a small table change with immediate quality impact for all users.
- **Cost routing is independent of quality features.** It can be implemented in parallel with any tone quality work.

---

## MVP Definition for v4.0

### Launch With (v4.0 — highest value-to-effort ratio)

- [ ] Stadium rebuild from real .hsp files — **required to unblock Stadium device selection**
- [ ] Tempo-synced delay — wire tempoHint to 60000/BPM formula in param-engine.ts
- [ ] Reverb PreDelay per genre — add PreDelay key to GENRE_EFFECT_DEFAULTS reverb entries
- [ ] Guitar-type EQ shaping — extend EQ_PARAMS with humbucker/single_coil/p90 dimension
- [ ] Planner prompt enrichment — gain-staging guidance, cab pairing table, effect discipline rules
- [ ] Gain-staging category refinement — validate and tighten existing AMP_DEFAULTS values

### Add in v4.0 Extended (medium complexity)

- [ ] Per-model amp parameter overrides — sparse override table for top 15 amps; requires ampFamily classification
- [ ] Snapshot-aware volume compensation — per-toneRole ChVol delta in snapshot-engine.ts
- [ ] Cost-aware model routing — Haiku for chat after 30-day baseline confirms cost structure

### Future Consideration (v4.1+)

- [ ] Effect combination logic — interaction-aware params; requires architectural decision on context passing
- [ ] Device/model abstraction layer refactor — only if Stadium rebuild reveals structural issues
- [ ] Genre-specific mandatory block substitution — jazz/ambient get compressor instead of boost

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Stadium rebuild from real .hsp files | HIGH (unblocks entire device) | HIGH | P1 |
| Tempo-synced delay | HIGH (audible, immediate) | LOW | P1 |
| Reverb PreDelay | HIGH (audible, immediate) | LOW | P1 |
| Guitar-type EQ shaping | HIGH (affects every preset) | LOW | P1 |
| Planner prompt enrichment | HIGH (zero code risk) | LOW | P1 |
| Gain-staging category validation | MEDIUM | LOW | P1 |
| Per-model amp overrides | HIGH (quality leap) | HIGH | P2 |
| Snapshot ChVol compensation | HIGH (pro feel) | LOW | P2 |
| Cost-aware model routing | LOW user / HIGH operational | MEDIUM | P2 |
| Effect combination logic | MEDIUM | MEDIUM-HIGH | P2 |
| Device abstraction layer | LOW user / HIGH maintainability | HIGH | P3 |

**Priority key:**
- P1: Ship in v4.0 core — direct quality impact, low or manageable implementation cost
- P2: Ship in v4.0 extended — meaningful improvement requiring more design
- P3: Evaluate after P1/P2 are complete — architectural or future-facing

---

## Competitor Feature Analysis

| Dimension | Commercial Presets (Alex Price, Glenn DeLaune, M. Britt) | Free Community (Line 6 CustomTone) | HelixTones v4.0 Target |
|-----------|----------------------------------------------------------|-------------------------------------|------------------------|
| Amp parameter tuning | Hand-tuned per model, per circuit knowledge | Inconsistent; often default values | Category defaults + sparse per-model overrides for top 15 amps |
| Cab pairing | Hand-selected for tone character and era match | Random or default | cabAffinity-guided + planner prompt pairing table |
| Delay timing | Tempo-synced (dotted-8th, quarter) per genre | Static ms values | BPM formula when tempoHint provided; genre subdivision targets |
| Reverb definition | Pre-delay 20-60ms on all presets | No pre-delay | Genre-indexed PreDelay values in GENRE_EFFECT_DEFAULTS |
| Guitar-type variants | Separate preset versions (humbucker vs. single coil) | Rare | Single preset with guitarType-indexed EQ branch |
| Device support | One device per pack | Single device | 6 devices from one generation flow |
| Quality consistency | Manually tested on hardware | Variable | Deterministic Knowledge Layer; baseline generator for regression testing |
| Iterative refinement | Purchased once, fixed | Fixed | AI chat iteration; regenerate with tweaks |

---

## Sources

- [Controlling Gain, Master Volume and Channel Volume — Line 6 Community](https://line6.com/support/topic/32285-controlling-gain-master-volume-and-channel-volume/) — HIGH confidence
- [High Gain Staging — Line 6 Community](https://line6.com/support/topic/33117-high-gain-staging/) — HIGH confidence
- [Common Amp Settings — Helix Help](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — HIGH confidence
- [Mastering Amp Parameters on Line 6 Helix — Komposition101](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — MEDIUM confidence
- [Volume Matching Presets on Line 6 Helix — Komposition101](https://www.komposition101.com/blog/volume-matching-presets-on-line6-helix) — MEDIUM confidence
- [Amps and Cabs That Typically Are Paired Together — Line 6 Community](https://line6.com/support/topic/25961-amps-and-cabs-that-typically-are-paired-together/) — MEDIUM confidence (community consensus)
- [Line 6 Helix Cabinet Models — DShowMusic](https://dshowmusic.com/line-6-helix-cabinet-models/) — MEDIUM confidence
- [Helix Cabs — Settings, Tips, Tricks — The Gear Forum](https://thegearforum.com/threads/helix-cabs-share-your-settings-tips-tricks.4944/) — MEDIUM confidence
- [Setting Up Your Effect Signal Chain — Strymon](https://www.strymon.net/setting-up-your-effect-signal-chain/) — HIGH confidence
- [The Ultimate Guide to Guitar Effects Pedal Order — BOSS Articles](https://articles.boss.info/the-ultimate-guide-to-guitar-effects-pedal-order-and-signal-chain/) — HIGH confidence
- [Signal Chain 101 — Reverb News](https://reverb.com/news/signal-chain-101-going-back-to-school-on-pedal-order) — HIGH confidence
- [Guitar Effects Pedal Order 101 — Get My Guitar](https://getmyguitar.com/guitar-effects-pedal-order-101-2025-guide/) — MEDIUM confidence
- [Reverb Pre-Delay Explained — iZotope](https://www.izotope.com/en/learn/reverb-pre-delay) — HIGH confidence
- [What is Pre Delay on Reverb — Music Guy Mixing](https://www.musicguymixing.com/pre-delay/) — MEDIUM confidence
- [BPM to Delay Times Cheat Sheet — Sweetwater InSync](https://www.sweetwater.com/insync/bpm-delay-times-cheat-sheet/) — HIGH confidence
- [Delay Time Calculator — Guitar Gear Finder](https://guitargearfinder.com/guides/delay-time-calculator-instructions/) — MEDIUM confidence
- [Anthropic Claude API Pricing — Official Docs](https://platform.claude.com/docs/en/about-claude/pricing) — HIGH confidence (verified 2026-03-05)
- [LLM API Pricing Comparison — IntuitionLabs](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025) — MEDIUM confidence
- [Smart Model Routing — Clawdbot API Cost Optimization](https://zenvanriel.com/ai-engineer-blog/clawdbot-api-cost-optimization-guide/) — MEDIUM confidence
- [Multiple Layers of Abstraction — Spotify Engineering](https://engineering.atspotify.com/2023/05/multiple-layers-of-abstraction-in-design-systems) — HIGH confidence

---

*Feature research for: HelixTones v4.0 — Stadium rebuild + preset quality leap*
*Researched: 2026-03-05*
