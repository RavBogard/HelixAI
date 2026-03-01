# Pitfalls Research

**Domain:** AI-powered Helix preset generation
**Researched:** 2026-03-01
**Confidence:** HIGH (multiple verified sources: Line 6 official community, Sweetwater, Tonevault analysis of 250 real presets, Fractal AI experiment, current codebase audit)

---

## Critical Pitfalls

These cause presets that sound bad, won't load, or silently corrupt data.

---

### Pitfall 1: Missing Cab Low-Cut and High-Cut (The #1 Muddiness Cause)

**What goes wrong:** Generated presets omit `LowCut` and `HighCut` parameters on cab blocks, or set them to their passthrough defaults (0Hz / 20kHz). The cab IR reproduces close-mic'd speaker frequencies that would never be audible at normal listening distance — including deep low rumble below 80Hz and harsh fizz above 5–8kHz.

**Why it happens:** AI models treat cab parameters as optional decoration. The Helix cab block `LowCut` and `HighCut` fields are technically optional in the JSON, so the AI omits them. The current codebase's `HlxCab` type marks them as optional (`LowCut?: number; HighCut?: number`), giving the AI no pressure to include them.

**Consequences:** Every generated preset sounds muddy, boomy, and harsh simultaneously. This is the single largest contributor to the "muddy + lacks sparkle" failure pattern in the current app. Without these cuts, a real guitar cab (which rolls off naturally below ~80Hz and above ~5kHz) is replaced with a full-spectrum close-mic response that sounds like you're pressing your ear to the speaker cone.

**Prevention strategy:**
- Make `LowCut` and `HighCut` REQUIRED fields on every cab block in the `HlxCab` type and `BlockSpec` — remove the `?` optional markers
- Enforce at construction time in `preset-builder.ts`: if a cab block does not include these values, inject hardcoded safe defaults before building
- Default values: `LowCut: 80` (Hz), `HighCut: 6500` (Hz) for standard guitar tones; `LowCut: 100, HighCut: 5000` for high-gain and metal
- The generation prompt must explicitly list these as required fields with example values
- Validate in `validate.ts` that no cab block has LowCut below 60Hz or HighCut above 10000Hz (values outside this range are almost always wrong for guitar)

**Warning signs:**
- Any preset where the cab block parameters section is empty or only contains `Mic`
- Presets described as "muddy" or "boomy" on first use
- The AI produces a cab `parameters: {}` — zero parameters for a cab is guaranteed mud

**Phase to address:** Preset Engine Core (Phase 1 of rebuild). This is non-negotiable pre-launch quality gate.

---

### Pitfall 2: Wrong Block Type Mapping in BLOCK_TYPES Constant

**What goes wrong:** The current `models.ts` has this in `BLOCK_TYPES`:
```typescript
DISTORTION: 0,
DYNAMICS: 0,
EQ: 0,
WAH: 0,
PITCH: 0,
VOLUME: 0,
DELAY: 7,
REVERB: 7,
```
Multiple unrelated block categories share the numeric `@type` value `0`. The `DELAY` and `REVERB` share value `7`. If the Helix firmware uses these `@type` values to determine routing, signal processing order, or DSP chip assignment, sharing types across categories (e.g., EQ and distortion both being type 0) may cause incorrect behavior.

**Why it happens:** The `@type` field's semantics were reverse-engineered without official documentation. Line 6 does not publish the .hlx schema. The mapping was set up as a best-guess and never validated against real hardware behavior.

**Consequences:** Preset may load but blocks may behave incorrectly. Reordering blocks in HX Edit after loading may snap to wrong positions. DSP allocation may be calculated incorrectly by firmware. This is a silent corruption — the preset appears valid but may not execute as intended.

**Prevention strategy:**
- Before rebuild: capture 5–10 representative .hlx files exported from HX Edit and verify the `@type` values for each block category by inspection
- Map each type to a unique numeric constant verified from real exports, not assumed
- Add a comment in `models.ts` documenting the source of each value
- For blocks sharing `@type: 0`, verify this is correct in real exports — if they are genuinely 0 across categories, document the evidence

**Warning signs:**
- Effects blocks appearing at wrong positions in HX Edit after loading
- Helix displaying unexpected routing after import
- Any `@type` constant that looks suspicious (two very different categories sharing a value)

**Phase to address:** Preset Engine Core (Phase 1). Verify before any other work.

---

### Pitfall 3: AI Hallucinating Invalid Model IDs

**What goes wrong:** LLMs generate plausible-sounding model IDs that do not exist in the Helix model database. Example: AI generates `HD2_AmpBritVintage1959` instead of the actual `HD2_AmpBritPlexiNrm`. The Helix firmware silently skips or corrupts blocks with unknown model IDs.

**Why it happens:** AI models pattern-match on the `HD2_*` naming convention and extrapolate names that sound correct but were never defined. The training data has forum posts mentioning amp names but not exact model IDs. This is a well-documented failure mode: the Fractal Audio community confirmed ChatGPT "makes stuff up" about gear model IDs, and the Line 6 community AI builder acknowledged "sometimes it makes stuff up."

**Consequences:** The current `validate.ts` auto-corrects by finding the closest model ID by trigram similarity — but "closest match" can be wrong. `HD2_AmpBritVintage1959` → `HD2_AmpBritPlexiNrm` is a reasonable guess, but the AI may have intended something else entirely. Silent auto-correction hides the root problem: the AI does not reliably know valid IDs.

**Prevention strategy:**
- The generation prompt must include the COMPLETE list of valid model IDs as an enumeration — not descriptions, the actual IDs
- Use JSON Schema with an `enum` constraint on the `modelId` field so the AI's response is validated against the exact list before any downstream processing
- If the provider supports structured output with schema enforcement (e.g., Anthropic tool use, OpenAI function calling with JSON Schema), use it — this reduces hallucinated IDs by ~70% based on RAG/constrained generation research
- Keep the model database as the single source of truth; never allow the AI to invent IDs
- Log every auto-correction with full context; if more than 2 corrections happen per preset, fail the generation rather than masking the problem

**Warning signs:**
- Validation log shows `auto-corrected to` messages on every generation
- The AI consistently uses IDs not in the database for a particular amp category
- Two similar amp names (e.g., "Cali Rectifire" vs "Cali Recto") mapping to the same corrected ID

**Phase to address:** Prompt Engineering (Phase 2). The prompt must enumerate valid IDs. Test coverage: write tests for all high-risk amp categories.

---

### Pitfall 4: Uniform Drive Settings Across Amp Categories

**What goes wrong:** AI generates the same Drive (gain) parameter value regardless of amp category. Typically this manifests as a mid-range default (0.5–0.6) for clean, crunch, and high-gain amps alike. A clean amp (Fender Deluxe Reverb) at Drive 0.55 breaks up aggressively; a high-gain amp (Mesa Dual Rectifier) at Drive 0.55 with an 808 in front sounds compressed and lifeless.

**Why it happens:** AI training data treats amp parameters as generic knobs. Without explicit category-specific guidance, the AI defaults to "middle of the range" values that are defensible but wrong in practice. The current `models.ts` defaults show the correct approach (clean amps: Drive 0.35–0.50, high-gain: Drive 0.25–0.40 with external boost), but when the AI overrides these defaults, it ignores the category distinction.

**Consequences:** Clean tones break up when strumming hard. High-gain tones are over-compressed and lack articulation. The presets fail the "cleans up with volume knob" requirement entirely because the amp is already pushed too hard.

**What the data shows (Tonevault analysis of 250 real presets):**
- Panama (5150-style): Drive stays below 4/10 in more than half of top presets. 71% use a Scream 808 to push the front end instead
- Clean Fender types: Drive 2–3/10, Master at 9–10/10 (maxed to engage full power amp character)
- Marshall types: Master 3–6/10, NOT 9–10 (high Master on these adds harsh negative feedback)
- Mesa Rectifier-style: Drive moderate, low Master for tight preamp distortion

**Prevention strategy:**
- Encode amp-category-specific parameter ranges in the generation prompt as a reference table, not prose
- The models database already has category fields (`clean`, `crunch`, `high_gain`); use these to inject category-specific parameter guidance into the prompt
- For high-gain amps, specify that Drive should be set lower than intuitive (0.25–0.40) when a boost pedal precedes the amp
- Master volume rules by category must be explicit: non-master-volume Fender types get Master 1.0; Marshall types get Master 0.3–0.6; high-gain modern amps get Master 0.3–0.5
- Add post-generation parameter range validation per amp category: clean amp + Drive > 0.55 = flag as suspect

**Warning signs:**
- All generated amps regardless of type have Drive in the 0.45–0.55 range
- No 808/Minotaur or pre-amp boost block preceding a high-gain amp
- Fender-style amp with Master set below 0.7

**Phase to address:** Models Database (Phase 1) + Prompt Engineering (Phase 2).

---

### Pitfall 5: Silent Snapshot Block State Loss

**What goes wrong:** The AI generates snapshot `blockStates` using block keys that don't survive the validation pipeline. When `resolveBlockKey()` in `validate.ts` can't map a key to a real block, it silently drops the entry. The snapshot then has no bypass control over that block — meaning a toggle that the user expects (e.g., "delay off in Clean snapshot") simply doesn't exist in the exported preset.

**Why it happens:** The `resolveBlockKey()` function has ambiguous logic for "global numbering" vs "per-DSP numbering." When the AI uses global sequential numbering (`block0` through `blockN` across both DSPs), the function remaps DSP1 blocks by subtracting the DSP0 count. But if the AI's count doesn't match the actual signal chain (due to removed blocks), the remapping produces wrong keys that fail the range check and return `null`.

**Consequences:** Snapshots that appear valid in the generation summary are functionally broken — effects that should toggle don't. User loads preset, switches to Lead snapshot expecting the chorus to turn off, nothing happens. This is a "looks done but isn't" bug.

**Prevention strategy:**
- After validation and auto-correction, programmatically rebuild all snapshot `blockStates` from the final signal chain — do not trust AI-generated block keys at all
- The final signal chain (post-validation) is authoritative; regenerate all block keys from it before building the .hlx file
- Emit a warning (and ideally fail) if the AI-generated blockStates reference more blocks than exist in the final signal chain
- Add tests covering: AI uses global numbering with mixed DSP blocks, AI has one block removed by validation, AI uses out-of-range block index

**Warning signs:**
- Validation log shows block key corrections but generation succeeds without error
- Snapshot `blockStates` in the final spec has fewer entries than there are non-cab blocks in the signal chain
- Preset loads but all snapshots behave identically (no toggling)

**Phase to address:** Validation Pipeline (Phase 1 infrastructure). Block state regeneration must be programmatic, not AI-driven.

---

### Pitfall 6: No Dynamic Responsiveness (Volume Knob Doesn't Clean Up)

**What goes wrong:** The AI sets amp parameters (particularly Drive, Bias, Sag) to values that produce a fixed saturation state regardless of input level. Rolling back the guitar volume knob has no effect on the tone character — the amp stays in the same compressed breakup state at both 10 and 3 on the volume knob.

**Why it happens:** Dynamic responsiveness is not a single parameter — it's the interaction of Drive (low), Sag (moderate-high), Bias (cold for clean headroom), and BiasX (moderate). AI models don't understand this interaction. They treat each parameter independently.

**What actually creates dynamic response:**
- Drive kept low (0.25–0.45 for crunch amps)
- Sag moderately high (0.55–0.75) — allows power supply "sag" to compress rather than the preamp
- Bias cold (0.3–0.5) — increases headroom before breakup
- No always-on OD pedal swamping the amp input at high gain

**Consequences:** Presets feel "locked in" to one saturation state. They fail the professional quality bar — pro presets clean up naturally because that's how real tube amps work. This is a key differentiator between mediocre and world-class presets.

**Prevention strategy:**
- For clean and crunch categories: explicitly encode target parameter ranges for Sag, Bias, BiasX in the prompt as non-negotiable ranges, not suggestions
- For clean amps intended to clean up: require Drive <= 0.45 and Bias <= 0.55
- For crunch amps intended to respond to picking dynamics: require Sag >= 0.55
- Add a Guitar In Pad note to the preset description so users know to enable it for high-output pickups (affects apparent Drive)
- Do not place always-on OD pedals before amps in clean-to-crunch preset designs

**Warning signs:**
- All presets use Bias values clustered around 0.5 (exactly mid-range — a sign of AI averaging)
- Sag is consistently 0.5 across all amp types (should vary significantly by amp character)
- A high-gain amp has Drive above 0.5 AND an OD pedal also enabled — double gain stacking eliminates dynamics

**Phase to address:** Prompt Engineering (Phase 2) + Models Database amp category rules (Phase 1).

---

### Pitfall 7: Physically Impossible or Out-of-Range Parameter Values

**What goes wrong:** AI generates parameter values outside valid ranges for specific parameters. The current `validate.ts` clamps all values to 0–1 as a generic fix, but some parameters have non-standard ranges. The `Mic` parameter on cab blocks is an integer index 0–7, not a normalized float. Other parameters (like specific delay time values) may expect different encodings.

**Why it happens:** The AI has no concept of the difference between normalized 0–1 float parameters (most Helix parameters) and integer index parameters (Mic) or special-range parameters. It pattern-matches on "looks like a number" and may generate `Mic: 0.5` (invalid) or `LowCut: 0.1` (treating it as a 0–1 range when it's actually an Hz value requiring special encoding).

**Current state:** The `validate.ts` comment explicitly documents: "Cab Mic is an integer mic index (0-7), not normalized 0-1." But it only handles Mic. Other parameters with non-standard semantics may be silently wrong.

**Consequences:** Cab mic selection is wrong or defaults to SM57 regardless of intent. EQ frequency parameters may be miscalculated. The clamping fix hides the problem rather than solving it.

**Prevention strategy:**
- Audit the models database and document every parameter that is NOT normalized 0–1 (Hz values, integer indices, dB values)
- Create a parameter type registry that maps parameter names to their expected type: `float_01`, `integer_index_0_7`, `hz_value`, etc.
- Apply type-specific validation and conversion in `validate.ts` rather than generic 0–1 clamping
- The generation prompt must specify the encoding of non-standard parameters explicitly: "Mic is an integer 0–7 where 0=SM57, 1=SM57 close, 2=121, etc."
- For cab parameters `LowCut` and `HighCut`: specify in Hz in the prompt (e.g., "LowCut: 80 means 80Hz"), not normalized

**Warning signs:**
- Cab `Mic` parameter is 0.0–1.0 range (should be 0–7 integer)
- Validation log shows `clamped` messages on parameters that should not need clamping
- EQ blocks with all parameters at exactly 0 or 1 (both extremes are usually wrong)

**Phase to address:** Parameter Type System (Phase 1 infrastructure).

---

### Pitfall 8: Wrong Signal Chain Block Order

**What goes wrong:** AI places blocks in an incorrect or suboptimal order. Common mistakes:
- Reverb before delay (causes washed-out, muddy trails that compound into noise)
- Noise gate after reverb/delay (chops off the tails)
- OD/distortion after the amp (creates harsh digital clipping rather than tube saturation)
- EQ placed before the amp instead of after (correct for some uses, wrong for post-amp shaping)
- Modulation blocks placed before the amp (works but sounds thin compared to post-amp)

**Why it happens:** AI models understand the conventional signal chain as a prose description but don't enforce it structurally. When tasked with creative freedom, they place blocks "where they fit" rather than following signal chain physics.

**Consensus correct order (verified from Line 6 official community and Sweetwater):**
```
Noise Gate → Wah/Filter → Compression → OD/Distortion → Amp → Cab → EQ → Modulation → Delay → Reverb
```

**Consequences:** Noisy presets (gate after reverb), washy tones (reverb before delay), harsh digital saturation (distortion after amp), lifeless modulation (pre-amp chorus instead of post-amp).

**Prevention strategy:**
- The generation prompt must specify block ordering rules as constraints, not preferences
- `validate.ts` should check for rule violations and either auto-reorder or flag as error:
  - Reverb before delay → swap
  - Noise gate after reverb or delay → move before reverb chain
  - Distortion after amp block → flag as error (cannot auto-fix)
- Provide signal chain templates in the prompt for common preset types (clean, crunch, high-gain, ambient) that the AI fills in rather than invents from scratch

**Warning signs:**
- Any preset where `reverb` appears before `delay` in `signalChain` array
- Any `dynamics` block at position > the highest reverb position
- Any `distortion` block at a position after an `amp` block in the same DSP

**Phase to address:** Prompt Engineering (Phase 2) + Validation (Phase 1).

---

### Pitfall 9: No Volume Balancing Across Snapshots

**What goes wrong:** The AI generates 4 snapshots (Clean, Crunch, Lead, Ambient) without accounting for volume differences between amp states. The Lead snapshot (with an OD pedal engaged) is typically 4–8dB louder than Clean due to pedal output level. The Ambient snapshot with reverb fully wet is often quieter. The result: switching snapshots in performance causes jarring volume jumps.

**Why it happens:** AI models don't simulate the cumulative effect of gain staging changes across snapshot states. They set bypass states and parameter overrides without calculating the resulting output level change.

**What professional presets do:** Use `ChVol` (Channel Volume) parameter overrides per snapshot to compensate for gain changes. Lead snapshot: OD on + ChVol reduced 2–3dB to match clean volume. This requires knowing the approximate level impact of each block combination.

**Consequences:** Preset sounds good in isolation but is unusable live. Clean → Lead snapshot causes the user to blow the FOH mix. This is a professional-quality failure that would never pass through a paid preset maker.

**Prevention strategy:**
- Establish a volume calibration rule in the prompt: every snapshot that engages additional gain must compensate with reduced ChVol
- Provide target relative levels: Clean = baseline, Crunch = +1dB (slightly louder is acceptable), Lead = +2dB maximum (solo boost), Ambient = -2dB (reverb wash should sit back)
- After generation, programmatically check if any snapshot enables a gain pedal without a corresponding ChVol reduction; flag as a likely volume imbalance
- Add a volume calibration phase to the generation pipeline: after building the preset spec, pass it through a "level check" function that estimates output level per snapshot and adds compensating ChVol overrides

**Warning signs:**
- Snapshot `parameterOverrides` are empty on the Lead snapshot when an OD pedal is engaged in `blockStates`
- All snapshots have identical `parameterOverrides` (means no volume compensation was applied)
- Any snapshot that toggles 2+ gain blocks without any level compensation

**Phase to address:** Snapshot Design System (Phase 3).

---

### Pitfall 10: Generic "Noon" EQ Values Across All Amps

**What goes wrong:** AI generates Bass=0.5, Mid=0.5, Treble=0.5 (noon position) on every amp block regardless of the amp's character. This is the "safe default" that ignores each amp model's specific tonal character and the tonal goals of the preset.

**Why it happens:** Mid-range safe defaults are statistically common in training data (forum advice says "start at noon"), so the AI uses them everywhere. But noon is only a starting point — professional presets adjust from noon based on the amp model's known tone stack behavior.

**What the data shows (Tonevault analysis):**
- Marshall Plexi types: Mid 0.75–0.85 (these amps are known for pushed mids), Bass 0.15–0.25 (kept tight)
- Mesa Rectifier types: Mid can be scooped 0.3–0.5, Bass moderate 0.35–0.55
- Fender clean types: Bass 0.35, Mid 0.55–0.65, Treble 0.55 (balanced with slight mid presence)

**Consequences:** All presets sound the same regardless of amp choice. The entire point of different amp models is their distinct frequency response — generic noon settings defeat this.

**Prevention strategy:**
- The models database already stores amp-category-specific defaults for each model — the generation prompt should reference these explicitly
- The prompt should state: "Use the provided `defaultParams` as your starting point. Adjust from there based on the requested tone, never use 0.5 noon for all EQ knobs"
- Add Bass/Mid/Treble range validation per amp category: if a Marshall-type amp has Mid below 0.55, flag as suspect

**Warning signs:**
- Three or more consecutive amp entries in generated presets all have Bass=0.5, Mid=0.5, Treble=0.5
- Identical EQ values across presets for very different amp models

**Phase to address:** Prompt Engineering (Phase 2) + Models Database (Phase 1).

---

## Technical Debt Patterns

Shortcuts in the current codebase that will create long-term problems if carried into the rebuild.

---

### Debt 1: Auto-Correction Hiding Root AI Failures

**Pattern:** `validateAndFixPresetSpec()` silently corrects invalid model IDs, wrong block positions, missing snapshot states, and out-of-range parameters. Warnings go to `console.warn`. No user-visible signal.

**Long-term problem:** If the prompt is broken, auto-correction masks it. Each generation produces "corrected" output, but the underlying prompt keeps generating wrong data. You can't improve what you can't see.

**Correct approach:**
- Log all corrections to a structured telemetry store, not just console
- If corrections exceed a threshold (>2 per generation), surface this to the developer as a prompt quality signal
- Distinguish between "safe corrections" (block position resequencing) and "risky corrections" (model ID substitution) — risky corrections should fail loudly, not silently succeed

---

### Debt 2: Hardcoded Firmware Version

**Pattern:** `preset-builder.ts` hardcodes `HLX_APP_VERSION = 57671680` (FW 3.70) and `HLX_BUILD_SHA = "v3.70"`. The current latest firmware is 3.80 (released November 2024), which added 6 new amps and 4 new cabs.

**Long-term problem:** Models added in 3.71–3.80 cannot be referenced because the .hlx file claims to be from 3.70 firmware. If users are on 3.80, loading a "3.70" preset may silently omit newer models. The models database will grow stale without a firmware version tracking mechanism.

**Correct approach:**
- Parameterize firmware version as a config value, not a constant
- Track which firmware version introduced each model in the database
- When generating presets, only include models available up to the target firmware version

---

### Debt 3: No Preset Quality Testing

**Pattern:** There are zero automated tests for preset tone quality, parameter range validity by amp category, signal chain correctness, or snapshot volume balance. The only testing is structural (does it load?) not sonic (does it sound good?).

**Long-term problem:** Every rebuild iteration has no regression safety net. A change to the prompt can degrade tone quality with no automated detection.

**Correct approach:**
- Create a test suite of "known good" preset specs (manually validated on hardware)
- Assert that regenerated presets for the same inputs stay within acceptable parameter ranges
- Test that specific amp categories produce parameter ranges consistent with category-specific rules
- Test that every cab block has LowCut >= 60 and HighCut <= 10000

---

### Debt 4: Block Type Constants Not Verified

**Pattern:** `BLOCK_TYPES` in `models.ts` assigns numeric `@type` values that were likely reverse-engineered. `DISTORTION`, `DYNAMICS`, `EQ`, `WAH`, `PITCH`, and `VOLUME` all share `@type: 0`. `DELAY` and `REVERB` both use `@type: 7`. This was never verified against real .hlx exports.

**Long-term problem:** Wrong `@type` values may cause firmware to misinterpret block functions, affect DSP routing, or cause subtle audio routing bugs that are impossible to diagnose without hardware testing.

**Correct approach:** Before any rebuild work, export 5 presets from HX Edit covering all block types and inspect the `@type` values in the JSON. Use verified values as the foundation.

---

## Integration Gotchas

Problems specific to the AI provider and .hlx format integration layers.

---

### Gotcha 1: AI Returns JSON Wrapped in Unexpected Formatting

**What happens:** LLMs may return valid JSON wrapped in markdown triple-backtick fences, with prose explanation before/after, or in a `{"preset": {...}}` wrapper. The current naive regex `\`\`\`(?:json)?` in `generate/route.ts` fails on edge cases.

**Prevention:** Use recursive JSON extraction: try direct parse → try extract from fences → try extract from key → use json5 as fallback. If all fail, retry the generation once before failing. Document in code what formats have been observed from each provider.

---

### Gotcha 2: Provider Response Length Limits Truncating JSON

**What happens:** Large preset specs (8 snapshots, 10+ blocks, parameter overrides) can exceed the output token limit of some models. The JSON is truncated mid-object, causing a parse failure. This is silent — the user sees a generic "generation failed" message.

**Prevention:** Estimate expected token count from the prompt before sending. For complex presets, consider a two-phase generation: generate signal chain first, then generate snapshots in a second call with the signal chain as context.

---

### Gotcha 3: Helix LT vs. Helix Floor Device ID

**What happens:** `preset-builder.ts` hardcodes `HELIX_LT_DEVICE_ID = 2162692`. The Helix Floor has a different device ID. Presets exported with the wrong device ID may not load, or may load but behave unexpectedly on the wrong device. Both devices share the same .hlx format but different device IDs.

**Prevention:** Add a `targetDevice` parameter to the generation and build pipeline. Maintain device ID constants for both LT and Floor. The PROJECT.md states "Helix LT + Helix Floor support" as a target — this needs a device selector in the UI.

---

### Gotcha 4: DSP Block Count Limits Are Not Enforced

**What happens:** Helix LT/Floor has two DSP chips, each supporting a maximum of 8 non-cab blocks (16 total). Poly Pitch-type effects can consume 50%+ of one DSP chip alone, reducing the practical limit further. If the AI generates a 10-block single-DSP chain, the preset will fail with "DSP block constraint exceeded" error 8701 on the hardware.

**Prevention:**
- Enforce per-DSP block count limit of 8 in the generation prompt
- Add validation in `validate.ts` that counts non-cab blocks per DSP and fails if >8
- For presets using expensive blocks (poly effects, complex reverbs), apply a lower effective limit warning
- The generation prompt should distribute blocks across DSP0 and DSP1 intelligently: pre-amp effects on DSP0, post-amp effects (modulation, delay, reverb) on DSP1

---

### Gotcha 5: Snapshot Parameter Override Key Conflicts

**What happens:** The `blockKeyMap` in `preset-builder.ts` maps per-DSP block keys. But when blocks are removed by validation (invalid model ID found, no match), the per-DSP indexes shift. Snapshot parameter overrides that reference the old keys now point to the wrong blocks. A ChVol override intended for the amp (originally `block2`) now targets the delay (new `block2` after block removal).

**Prevention:**
- Rebuild snapshot parameter overrides from scratch using the validated signal chain, not the AI-generated keys
- Assign stable human-readable block names in the spec (e.g., `amp_main`, `delay_main`) and map these to final block keys after validation
- Never trust AI-generated block keys in parameter overrides — always resolve them against the final signal chain

---

## "Looks Done But Isn't" Checklist

These issues make a preset appear functional but actually broken or subprofessional.

| Symptom | Root Cause | Test |
|---------|-----------|------|
| Preset loads on Helix but sounds muddy | Missing LowCut/HighCut on cab blocks | Check cab `LowCut >= 60` and `HighCut <= 10000` |
| All snapshots sound identical | blockStates not resolving — all corrections dropped | Verify blockStates count equals non-cab block count |
| Lead snapshot is dramatically louder | No ChVol compensation for engaged OD pedal | Check snapshots with OD on have ChVol override |
| Amp sounds same at volume 10 and 3 | Drive too high + Bias too warm for dynamics | Verify Drive <= 0.45 for clean/crunch and Bias <= 0.55 for clean |
| Noisy between notes even with gate | Noise gate placed after reverb/delay blocks | Check noise gate position in signal chain |
| Preset hangs or refuses to load on Helix | DSP block count exceeded (>8 per DSP) | Count non-cab blocks per DSP — must be <= 8 |
| EQ after amp does nothing | EQ block placed before the amp (position ordering wrong) | Verify EQ position > amp position in the chain |
| Chorus sounds thin and digital | Modulation block placed before amp instead of after | Check modulation position > amp position |
| Reverb washes out the tone | Reverb before delay in chain | Verify delay position < reverb position |
| Drive on amp sounds compressed, no sparkle | Missing 808/Minotaur with high-gain amp setup | Check high-gain amps have a pre-amp boost block |
| Cab mic is always SM57 regardless of intent | AI generating Mic as float 0.5 instead of integer 0–7 | Check Mic value is integer and in range 0–7 |
| Preset file won't load at all | Invalid block @type values or malformed JSON structure | Validate all @type constants against real HX Edit exports |
| Preset sounds fine in preview but bad on hardware | Using wrong device ID (LT vs Floor) | Confirm targetDevice matches user's hardware |

---

## Pitfall-to-Phase Mapping

How the rebuild roadmap phases should address each pitfall.

| Phase | Pitfall Addressed | How |
|-------|-----------------|-----|
| Phase 1: Engine Core | Pitfall 1: Missing cab filtering | Make LowCut/HighCut required; inject safe defaults |
| Phase 1: Engine Core | Pitfall 2: Wrong block @type values | Verify constants against real .hlx exports before coding |
| Phase 1: Engine Core | Pitfall 5: Silent snapshot block state loss | Regenerate blockStates programmatically post-validation |
| Phase 1: Engine Core | Pitfall 7: Out-of-range parameters | Build parameter type registry; type-specific validation |
| Phase 1: Engine Core | Debt 4: Unverified block type constants | Export + inspect real HX Edit presets before any build |
| Phase 1: Engine Core | Gotcha 4: DSP block limit | Enforce 8-block-per-DSP limit in validation |
| Phase 1: Engine Core | Gotcha 5: Snapshot key conflicts post-validation | Programmatic key resolution from final chain |
| Phase 2: Prompt Engineering | Pitfall 3: Hallucinated model IDs | Enumerate all valid IDs in prompt; use schema constraints |
| Phase 2: Prompt Engineering | Pitfall 4: Uniform drive settings | Amp-category-specific parameter tables in prompt |
| Phase 2: Prompt Engineering | Pitfall 6: No dynamic responsiveness | Category-specific Sag/Bias/Drive ranges in prompt |
| Phase 2: Prompt Engineering | Pitfall 8: Wrong signal chain order | Ordering constraints and templates in prompt |
| Phase 2: Prompt Engineering | Pitfall 10: Generic noon EQ | Per-amp reference to defaultParams in prompt |
| Phase 3: Snapshot Design | Pitfall 9: No volume balancing | Volume calibration function post-generation |
| Phase 3: Snapshot Design | Debt 1: Auto-correction hiding failures | Telemetry for corrections; fail on risky corrections |
| All Phases | Debt 3: No quality testing | Test suite for parameter ranges per amp category |
| Infrastructure | Debt 2: Hardcoded firmware version | Parameterize firmware; track model availability by version |
| Infrastructure | Gotcha 3: LT vs. Floor device ID | Device selector; separate device ID constants |
| Infrastructure | Gotcha 1: JSON parsing fragility | Recursive extraction; retry on parse failure |
| Infrastructure | Gotcha 2: Response truncation | Token estimation; two-phase generation for complex presets |

---

## Sources

**Official Line 6 Community (verified community knowledge, HIGH confidence):**
- [Why do Helix Cabs and IRs Need Low and Hi Cuts?](https://line6.com/support/topic/30066-why-do-helix-cabs-and-irs-need-low-and-hi-cuts/) — Confirms cab filtering is required, explains the physics
- [Help me understand low/high cut on cabs/IRs](https://line6.com/support/topic/65836-help-me-understand-lowhigh-cut-on-cabsirs/) — Community consensus on LowCut 80–100Hz, HighCut 5–8kHz
- [I built an AI (Chat GPT) powered helper to help build Helix guitar tones](https://line6.com/support/topic/67397-i-built-an-ai-chat-gpt-powered-helper-to-help-build-helix-guitar-tones/) — Direct evidence AI "makes stuff up" with Helix model IDs
- [Helix/HX 3.70/3.71 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix/helixhx-370371-release-notes-r1052/) — Firmware version reference
- [HX Stomp DSP block constraint exceeded error](https://line6.com/support/topic/57689-hx-stomp-%E2%80%9C-8701-preset-translation-not-supported-dsp-block-constraint-exceeded%E2%80%9D/) — Documents the error 8701 and DSP limits

**Helix Help (community documentation, HIGH confidence):**
- [Common Amp Settings](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — Parameter guidance including Sag, Bias, Master interactions
- [Snapshots Guide](https://helixhelp.com/tips-and-guides/helix/snapshots) — Snapshot design best practices
- [The Blocks](https://helixhelp.com/tips-and-guides/helix/the-blocks) — Signal chain ordering guidelines

**Tonevault (empirical data from 250 real top presets, HIGH confidence):**
- [Dialing in your Helix amps: what the top 250 presets teach us](https://www.tonevault.io/blog/250-helix-amps-analyzed) — Verified amp parameter ranges from analysis of real professional presets

**Sweetwater (professional source, HIGH confidence):**
- [Double Down for the Best Line 6 Helix Tone](https://www.sweetwater.com/insync/double-best-line-6-helix-tone/) — Signal chain best practices
- [3 Helix Effects Secrets](https://www.sweetwater.com/insync/3-helix-effects-secrets/) — Effects ordering confirmation

**Fractal Audio Forum (comparable hardware, AI experiment, MEDIUM confidence):**
- [Can ChatGPT make a good preset that emulates a known tone?](https://forum.fractalaudio.com/threads/can-chatgpt-make-a-good-preset-that-emulates-a-known-tone-spoiler-no.192542/) — Documented AI failures: reversed EQ strategy, wrong parameter values, "thin and lifeless" output

**Komposition101 (practitioner knowledge, MEDIUM confidence):**
- [Mastering Amp Parameters on Line6 Helix](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — Parameter ranges by amp type
- [Volume Matching Presets on Line6 Helix](https://www.komposition101.com/blog/volume-matching-presets-on-line6-helix) — Snapshot volume balancing techniques

**BenVesco (DSP allocation data, MEDIUM confidence):**
- [Helix DSP Allocations](https://benvesco.com/store/helix-dsp-allocations/) — Block-level DSP costs for Helix FW 3.80, confirms poly effects consume 50%+ of one DSP chip

**LLM Hallucination Research (academic, HIGH confidence for method):**
- [Reducing hallucination in structured outputs via RAG](https://arxiv.org/html/2404.08189v1) — Confirms 21% hallucination rate without RAG, under 7.5% with RAG
- [Constrained Decoding for Structured LLM Output](https://mbrenndoerfer.com/writing/constrained-decoding-structured-llm-output) — Schema-constrained generation reduces invalid JSON/model IDs

**Internal codebase (direct inspection, HIGH confidence):**
- `src/lib/helix/validate.ts` — Documents block key resolution bugs and parameter clamping logic
- `src/lib/helix/models.ts` — Confirms BLOCK_TYPES sharing issue (DISTORTION, EQ, WAH all = 0)
- `src/lib/helix/preset-builder.ts` — Documents hardcoded firmware version and fallback cab association
- `.planning/codebase/CONCERNS.md` — CAB Microphone Parameter Type Ambiguity, Silent Snapshot Block Reference Loss, Hardcoded Block Type Mappings
