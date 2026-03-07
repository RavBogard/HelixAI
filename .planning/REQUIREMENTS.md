# Requirements: HelixTones

**Defined:** 2026-03-06
**Core Value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent

## v6.0 Requirements

Requirements for Preset Craft Mastery milestone. Each maps to roadmap phases.

### Expression Pedal

- [x] **EXP-01**: Wah blocks are assigned to expression pedal controller with Position parameter mapped — pressing EXP pedal sweeps the wah on hardware
- [x] **EXP-02**: Volume blocks are assigned to expression pedal controller with Position/Volume parameter mapped — pressing EXP pedal controls volume on hardware
- [x] **EXP-03**: Expression pedal assignments respect per-device capability — Helix (3 EXP), Stomp (2 EXP), Pod Go (1 EXP), Stadium (0 EXP, skipped)
- [ ] **EXP-04**: Expression pedal assignments do not conflict with snapshot controller assignments — snapshot-exclusion guard prevents last-write-wins collision
- [x] **EXP-05**: Expression pedal @min/@max values are appropriate per block type — wah sweep 0.0-1.0, volume pedal heel-down not silent

### Effect Intelligence

- [ ] **INTEL-01**: Delay model selection is genre-informed — AI receives per-genre delay model recommendations (e.g., Transistor Tape for blues, Ducked Delay for worship, Cosmos Echo for psychedelic)
- [ ] **INTEL-02**: Reverb model selection is genre-informed — AI receives per-genre reverb model recommendations (e.g., Plate for universal, '63 Spring for country/blues, Ganymede for ambient)
- [ ] **INTEL-03**: Wah model selection is genre-informed — AI receives per-genre wah model recommendations (e.g., Chrome Custom as default, Teardrop 310 for rock, Fassel for funk)
- [ ] **INTEL-04**: Effect model guidance is included in the static system prompt (not dynamic user message) to preserve prompt cache hit rates
- [ ] **INTEL-05**: High-value effect models have per-model parameter overrides where defaults are wrong (e.g., shimmer reverb mix, high-repeat delay feedback)

### Effect Combinations

- [ ] **COMBO-01**: When wah and compressor coexist in chain, compressor threshold is reduced to prevent over-compression of wah sweep
- [ ] **COMBO-02**: For high-gain/metal tones, noise gate is placed before amp and compressor is omitted or minimal — prevents squeezed dynamics
- [ ] **COMBO-03**: Effect combination rules have priority ordering (required/preferred/optional) that survives device block budget truncation — Pod Go's 4-effect limit doesn't break musical intent
- [ ] **COMBO-04**: Reverb and delay interaction — when both present, reverb mix is slightly reduced to prevent wash; delay time accounts for reverb pre-delay

### Per-Device Craft

- [ ] **CRAFT-01**: Stomp/Stomp XL presets optimize for 6-block budget — effect choices prioritize maximum tonal variety within tight constraints
- [ ] **CRAFT-02**: Pod Go presets respect single-DSP, 4-effect budget with intelligent effect prioritization based on genre
- [ ] **CRAFT-03**: Helix Floor/LT presets take full advantage of dual-DSP capacity — richer effect chains, more creative signal routing
- [ ] **CRAFT-04**: Per-device craft guidance is encoded in both planner prompts (creative direction) and code (hard limit enforcement)

### Quality Validation

- [ ] **QUAL-01**: Non-throwing preset quality validation function returns warnings (not errors) for suboptimal parameter choices — over-wet reverb, missing cab filtering, snapshot level imbalance
- [ ] **QUAL-02**: Quality validation runs on every generated preset and warnings are logged for analysis
- [ ] **QUAL-03**: Per-device baseline comparison validates that quality changes improve (not regress) preset output across all 6 device families

### Preset Musical Coherence

- [ ] **COHERE-01**: Chain-rules enforce effect palette balance — max 2 user-selected drives; at least 1 time-based effect (delay or reverb) when preset has clean/ambient snapshots
- [ ] **COHERE-02**: Reverb soft-mandatory insertion — auto-insert genre-appropriate reverb (Plate default) when ToneIntent includes clean/ambient snapshot roles but no reverb effect
- [ ] **COHERE-03**: Boost model disambiguation — snapshot-engine distinguishes mandatory boost (chain-rules inserted, slot="boost") from AI-selected drive (user chose Minotaur/Scream 808 as effect); user-selected boosts follow distortion toggle rules, not always-on
- [ ] **COHERE-04**: Dynamics type split — separate "compressor" and "gate" block types in chain-rules, snapshot-engine, and frontend; compressor toggles OFF for high-gain lead/rhythm snapshots; gate remains always-on
- [ ] **COHERE-05**: Frontend block label accuracy — BLOCK_LABEL map distinguishes compressor ("Comp") from gate ("Gate") instead of blanket "Gate" for all dynamics
- [ ] **COHERE-06**: ToneIntent-description cross-validation — post-planner check warns when description mentions effects (reverb, delay, modulation) not present in ToneIntent.effects; logged as quality warning

### Device Block Budget Calibration

- [ ] **BUDGET-01**: DeviceCapabilities `maxEffectsPerDsp` matches real hardware user-effect slot count for ALL families — verified against Line 6 specs
- [ ] **BUDGET-02**: Prompt-level `maxEffects` guidance matches DeviceCapabilities — no mismatch between what AI is told to generate and what chain-rules allows through
- [ ] **BUDGET-03**: Stadium block budget reflects actual DSP capacity — at least 8 user effects (not capped at 4)
- [ ] **BUDGET-04**: Helix LT/Floor prompt allows 8+ effects per DSP path — reflecting real usage patterns, not arbitrary conservative cap
- [ ] **BUDGET-05**: Chain-rules effect truncation logs a warning when effects are dropped — silent truncation becomes visible during development

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Expression Pedal

- **EXP-F01**: User can specify custom expression pedal assignments in tone interview (e.g., "I want EXP2 on reverb mix")
- **EXP-F02**: Expression pedal assignments for reverb mix, delay mix, and other effect parameters beyond wah/volume

### Advanced Effect Intelligence

- **INTEL-F01**: Drive/distortion model selection is genre-informed (e.g., Tube Screamer for blues, RAT for grunge, Klon for transparent boost)
- **INTEL-F02**: Modulation model selection is genre-informed (e.g., Chorus for 80s clean, Uni-Vibe for classic rock, Tremolo for surf)

### Cost Optimization

- **COST-F01**: Evidence-based Haiku chat vs. Sonnet generation routing (deferred from v4.0)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New effect model additions to catalog | v6.0 uses existing 126+ effects better, not expanding the catalog |
| Stadium expression pedal support | Stadium has `expressionPedalCount: 0` — no physical EXP pedal; deferred until hardware verification |
| Full AI-driven expression pedal assignment | Deterministic wah→EXP1, volume→EXP2 mapping covers 95% of cases; AI-driven custom assignments deferred |
| Per-model amp override expansion | v4.0 already shipped 18 amps with Layer 4 overrides; this milestone focuses on effects |
| Prompt caching architecture changes | v5.0 established per-device cache unification; v6.0 must preserve, not restructure |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXP-01 | Phase 70 | Complete |
| EXP-02 | Phase 70 | Complete |
| EXP-03 | Phase 70 | Complete |
| EXP-04 | Phase 70 | Pending |
| EXP-05 | Phase 70 | Complete |
| INTEL-01 | Phase 71 | Pending |
| INTEL-02 | Phase 71 | Pending |
| INTEL-03 | Phase 71 | Pending |
| INTEL-04 | Phase 71 | Pending |
| INTEL-05 | Phase 71 | Pending |
| COMBO-01 | Phase 72 | Pending |
| COMBO-02 | Phase 72 | Pending |
| COMBO-03 | Phase 72 | Pending |
| COMBO-04 | Phase 72 | Pending |
| CRAFT-01 | Phase 73 | Pending |
| CRAFT-02 | Phase 73 | Pending |
| CRAFT-03 | Phase 73 | Pending |
| CRAFT-04 | Phase 73 | Pending |
| QUAL-01 | Phase 74 | Pending |
| QUAL-02 | Phase 74 | Pending |
| QUAL-03 | Phase 74 | Pending |
| COHERE-01 | Phase 75 | Pending |
| COHERE-02 | Phase 75 | Pending |
| COHERE-03 | Phase 75 | Pending |
| COHERE-04 | Phase 75 | Pending |
| COHERE-05 | Phase 75 | Pending |
| COHERE-06 | Phase 75 | Pending |
| BUDGET-01 | Phase 76 | Pending |
| BUDGET-02 | Phase 76 | Pending |
| BUDGET-03 | Phase 76 | Pending |
| BUDGET-04 | Phase 76 | Pending |
| BUDGET-05 | Phase 76 | Pending |

**Coverage:**
- v6.0 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after Phase 76 addition (device block budget calibration)*
