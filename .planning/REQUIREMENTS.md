# Requirements: HelixTones v4.0 Preset Quality Leap

**Milestone:** v4.0
**Scope:** Close the gap between HelixTones-generated presets and the best custom/commercial presets; audit and optimize API costs
**Date:** 2026-03-04

---

## Quality Track: Preset Intelligence

### AUDIT-01: Token Usage Logging

Add per-request token logging to `/api/chat` and `/api/generate` endpoints. Log prompt tokens, completion tokens, total tokens, cached tokens, and cost estimate per call. Store in structured format (JSON lines or Supabase table) for analysis.

**Acceptance:** After 10 test generations, a summary script can report average tokens per chat turn, per planner call, and per generation. Cache hit rate is visible.

---

### AUDIT-02: Quality Baseline

Create a reproducible test suite of 6 tone scenarios (one per category: clean, crunch, high-gain, ambient, edge-of-breakup, dual-amp) across all 6 devices. Generate presets for each, capture the full ToneIntent and PresetSpec. This becomes the regression baseline for all v4.0 changes.

**Acceptance:** Running the baseline produces 36 preset files (6 tones x 6 devices) with deterministic ToneIntent snapshots. Any v4.0 change can be diffed against this baseline.

---

### AUDIT-03: Cache Hit Rate Measurement

Measure prompt caching effectiveness. Determine what percentage of planner calls hit the cache vs. cold starts. Identify if system prompt structure can be optimized to increase cache hits.

**Acceptance:** Report showing cache hit rate across 20+ generations. If below 50%, identify specific optimizations.

---

### PROMPT-01: Gain-Staging Intelligence

Enhance the planner prompt with gain-staging rules: how amp Drive, boost pedal level, and guitar volume interact. The planner must understand that a Klon-style boost into a clean amp at Drive 0.3 behaves differently than into a cranked amp at Drive 0.7. Encode these interactions so ToneIntent choices reflect real gain-staging knowledge.

**Acceptance:** A "edge-of-breakup blues" preset uses appropriate boost level relative to amp drive setting. A "modern high-gain" preset does not stack unnecessary gain stages.

---

### PROMPT-02: Cab Pairing Guidance

Add cab selection guidance to the planner prompt based on amp type. Fender-style amps pair with 1x12/2x12 open-back cabs; Marshall-style with 4x12 closed-back; Mesa with oversized 4x12. The planner should select cab models that match the amp's real-world pairing conventions.

**Acceptance:** Generated presets consistently pair amp and cab models following real-world conventions. No Fender amp paired with a Mesa Rectifier cab unless explicitly requested.

---

### PROMPT-03: Effect Discipline

Add effect selection discipline to the planner prompt. Rules: never stack two effects of the same category without explicit intent (no two delays unless "dual delay" is requested). Reverb before delay is wrong for 95% of use cases. Modulation amount should scale inversely with gain level. Encode these as planner-level constraints.

**Acceptance:** No generated preset contains two delays or two reverbs unless the tone description explicitly calls for it. Reverb is always after delay in the chain.

---

### PROMPT-04: Planner Regression Test

Create a test that runs the planner prompt against the 6 baseline scenarios and validates ToneIntent output against expected patterns (e.g., clean tone should not select high-gain amp, ambient should include delay+reverb, high-gain should have noise gate).

**Acceptance:** Test suite catches obvious planner mistakes (wrong amp category, missing expected effects, illogical combinations) with >90% accuracy.

---

### AMP-01: Amp Family Classification

Add `ampFamily` field to models.ts amp entries: `fender`, `vox`, `marshall`, `mesa`, `modern_high_gain`, `boutique_clean`, `boutique_drive`. Each family gets a parameter strategy object defining typical Drive range, Master range, Presence/Treble relationship, and Sag behavior.

**Acceptance:** Every amp model in models.ts has an `ampFamily` value. `getAmpFamilyDefaults(family)` returns a parameter strategy object.

---

### AMP-02: Per-Model Parameter Overrides

Add Layer 1.5 to the parameter resolution stack: per-model overrides that sit between model defaults and category overrides. Sourced from Tonevault 250-preset analysis data. Example: Fender Deluxe Master should default to 0.90-1.0 (not generic 0.5), Rectifier Drive and Presence should be inversely correlated.

**Acceptance:** `resolveAmpParams("US DLX Nrm", "clean")` returns Master >= 0.85. `resolveAmpParams("Revv Gen Red", "high_gain")` returns Drive and Presence values that show inverse correlation.

---

### AMP-03: Master Volume Strategy

Implement amp-family-aware Master Volume logic. Fender-style amps: Master near max (0.85-1.0) for authentic tone. British-style: Master at 0.5-0.7 for power-tube saturation. High-gain: Master at 0.4-0.6 to control volume. Channel Volume handles level-matching across snapshots.

**Acceptance:** Clean Fender preset has Master > 0.8. High-gain Mesa preset has Master < 0.6. All snapshots are volume-balanced within 3dB.

---

### AMP-04: Cab Affinity Data

Add `cabAffinity` to amp model entries: an ordered list of preferred cab model IDs for each amp. Used by PROMPT-02 cab pairing and as fallback if the planner selects an incompatible cab.

**Acceptance:** `getPreferredCabs("US DLX Nrm")` returns cab models appropriate for Fender amps. Test verifies at least 10 amp models have cabAffinity data.

---

### FX-01: Guitar-Type EQ Adjustment

Add `guitarType` field to ToneIntent (`singlecoil`, `humbucker`, `p90`, `active`). The param engine adjusts post-cab EQ based on pickup type: single-coils get less treble cut, humbuckers get tighter low-end, active pickups get reduced gain staging.

**Acceptance:** Same tone description with `guitarType: "singlecoil"` vs `"humbucker"` produces measurably different EQ settings in the preset.

---

### FX-02: Reverb PreDelay Scaling

Add context-aware reverb PreDelay: fast tempos get shorter PreDelay (20-40ms), slow tempos get longer (60-100ms). Ambient presets get longer PreDelay than tight rhythm presets. This prevents reverb from washing out fast passages.

**Acceptance:** A "fast punk rock" preset has reverb PreDelay < 40ms. A "slow ambient pad" preset has PreDelay > 60ms.

---

### FX-03: Tempo-Scaled Delay

When BPM is known or inferred from genre, set delay time as a musical subdivision (quarter note, dotted eighth, etc.) rather than a fixed ms value. Encode common genre-tempo associations (punk: 160-180 BPM, ballad: 60-80 BPM) as fallbacks.

**Acceptance:** A "country chicken pickin'" preset has delay time corresponding to a musical subdivision of ~120 BPM. Delay time is not a generic 350ms.

---

### FX-04: Snapshot Channel Volume Balancing

Improve snapshot volume balancing. Clean snapshot should be slightly quieter than rhythm. Lead snapshot gets +2-3dB boost via Channel Volume. Ambient matches rhythm level. Currently all snapshots use the same Channel Volume — this makes lead tones not cut through.

**Acceptance:** In a 4-snapshot preset, Lead snapshot Channel Volume is measurably higher than Rhythm. Clean is slightly lower. Values are within musical range (not absurd jumps).

---

### COMBO-01: Effect Interaction Parameters

When certain effect combinations are present, adjust their parameters for synergy. Examples: compressor before overdrive — reduce compressor output to prevent excessive gain stacking. Delay into reverb — reduce reverb mix to prevent wash. Chorus + delay — widen chorus but reduce delay feedback to maintain clarity.

**Acceptance:** A preset with compressor + overdrive has lower compressor output than a preset with compressor alone. Test verifies at least 3 interaction rules fire correctly.

---

### COMBO-02: Genre Block Substitution Table

Create a genre-aware effect substitution table. Blues: prefer Tube Screamer over Metal Zone. Metal: prefer Noise Gate + tight delay over lush reverb. Jazz: prefer chorus + warm reverb, no distortion pedal. Country: prefer compressor + slapback delay. This guides the planner toward genre-appropriate effect choices.

**Acceptance:** A "jazz" tone never includes a distortion pedal unless explicitly requested. A "metal" tone always includes a noise gate.

---

### COMBO-03: Cross-Device Validation

All v4.0 quality improvements must work correctly across all 6 devices. Pod Go's 4-effect limit and HX Stomp's 6-block budget must be respected — quality improvements cannot exceed device constraints.

**Acceptance:** The 36-preset baseline (AUDIT-02) regenerated after all v4.0 changes produces valid presets for all devices with no validation errors.

---

## Cost Track: API Optimization

### COST-01: Evidence-Based Model Routing

After AUDIT-01 data is collected, analyze whether chat turns (currently Gemini Flash) and generation calls (currently Claude Sonnet 4.6) are optimally routed. If data shows Haiku could handle specific sub-tasks (e.g., tone description summarization) without quality loss, implement a targeted split. No changes without A/B quality evidence.

**Acceptance:** Decision document with token analysis, cost breakdown, and quality comparison. If a model split is implemented, regression test (PROMPT-04) passes with identical quality scores.

---

## Non-Functional Requirements

### NFR-01: No Regression
All existing presets must sound at least as good after v4.0 changes. The baseline (AUDIT-02) provides the comparison point.

### NFR-02: Device Parity
Quality improvements apply equally to all 6 devices within their hardware constraints.

### NFR-03: Deterministic Parameters
The Knowledge Layer continues to generate all numeric parameter values deterministically. AI never sets knob values directly.

### NFR-04: Prompt Size Budget
Planner prompt additions (PROMPT-01 through PROMPT-03) must not increase prompt token count by more than 30%. Measure before and after.

---

## Out of Scope (v4.0)

- Parallel wet/dry routing (split/join paths) — deferred to future milestone
- New device support — all 6 devices already supported
- UI changes — this is a backend/engine quality milestone
- IR (impulse response) loading — stick with stock cabs
- Multi-provider comparison — single provider focus

---

## Dependencies

| Requirement | Depends On |
|------------|-----------|
| AUDIT-02 | AUDIT-01 (need token logging for cost data) |
| AUDIT-03 | AUDIT-01 (need token logging for cache measurement) |
| PROMPT-04 | AUDIT-02 (need baseline scenarios) |
| AMP-02 | AMP-01 (need ampFamily classification first) |
| AMP-03 | AMP-01 (need ampFamily for Master Volume strategy) |
| AMP-04 | AMP-01 (need ampFamily for cab affinity grouping) |
| COMBO-03 | All quality requirements (validation after changes) |
| COST-01 | AUDIT-01, AUDIT-03 (need usage data before decisions) |

---

*v4.0 — Preset Quality Leap*
*Written: 2026-03-04*
