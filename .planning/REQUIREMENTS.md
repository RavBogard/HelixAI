# Requirements: HelixTones

**Defined:** 2026-03-05
**Core Value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent

## v4.0 Requirements

Requirements for v4.0 Stadium Rebuild + Preset Quality Leap. Each maps to roadmap phases.

### Stadium Rebuild

- [ ] **STAD-01**: Agoura amp catalog expanded with 6 missing amp IDs extracted from real .hsp files, with verified defaultParams
- [ ] **STAD-02**: Stadium device version updated to 301990015 and HX2_*/VIC_* model IDs added to validate.ts
- [ ] **STAD-03**: Stadium builder param encoding fixed to `{ value: X }` format (no `access` field)
- [ ] **STAD-04**: Stadium builder block keys use slot-grid allocation (b00=input, b05=amp, b06=cab, b13=output) instead of sequential numbering
- [ ] **STAD-05**: Stadium builder effect blocks use `type: "fx"` for all effect categories
- [ ] **STAD-06**: Stadium cab blocks emit all 10 parameters (adding Delay, IrData, Level, Pan, Position)
- [ ] **STAD-07**: Generated .hsp file loads in HX Edit without errors — verified against real .hsp reference
- [ ] **STAD-08**: Stadium device selection unblocked in UI after hardware verification passes

### Planner Prompt Enrichment

- [ ] **PROMPT-01**: Planner prompt includes gain-staging intelligence section (Drive/Master/ChVol relationships per amp type)
- [ ] **PROMPT-02**: Planner prompt includes amp-to-cab pairing guidance table
- [ ] **PROMPT-03**: Planner prompt includes genre-appropriate effect discipline (counts and types)
- [ ] **PROMPT-04**: Planner regression test baseline confirms no quality degradation from prompt changes

### Amp Parameters

- [ ] **AMP-01**: Amps classified by family (Fender, Marshall, Vox, Mesa, etc.) in model metadata
- [ ] **AMP-02**: Layer 4 `paramOverrides` mechanism established in resolveAmpParams() — applied after category defaults
- [ ] **AMP-03**: Per-model parameter overrides for 15+ amps with verified values
- [ ] **AMP-04**: Non-master-volume amps get correct Drive=Volume, Master=1.0 strategy
- [ ] **AMP-05**: Cab affinity data enriched on amp model metadata

### Effect Intelligence

- [ ] **FX-01**: Guitar-type EQ shaping uses guitarType from ToneIntent to adjust post-cab EQ curves
- [ ] **FX-02**: Reverb PreDelay set per genre category (20-60ms range) to preserve note attack
- [ ] **FX-03**: Delay time calculated from tempoHint in ToneIntent (60000/BPM formula)
- [ ] **FX-04**: Snapshot ChVol deltas per toneRole — leads louder than cleans by default

### Architecture

- [ ] **ARCH-01**: Device/model abstraction audit completed with documented findings and recommendations

## v4.1 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Effect Combinations

- **COMBO-01**: Effect interaction parameters (comp-to-drive, modulation-to-reverb, delay-to-reverb adjustments)
- **COMBO-02**: Genre block substitution table (jazz/ambient get compressor instead of 808 boost)
- **COMBO-03**: Cross-device validation for effect combinations

### Cost Optimization

- **COST-01**: Evidence-based model routing (Haiku 4.5 for chat, Sonnet for generation) after 30-day baseline and A/B quality comparison

## Out of Scope

| Feature | Reason |
|---------|--------|
| Device abstraction rewrite | Evolutionary approach — audit only in v4.0, refactor only if Stadium rebuild reveals structural problems |
| Haiku 4.5 for ToneIntent generation | Core quality lever — must not switch without A/B validation with 20+ diverse tone goals |
| AI-generated numeric parameter values | Violates Planner-Executor architecture invariant — AI selects names, code generates numbers |
| Effect combination context passing | Requires architectural decision on param-engine isolation; deferred to v4.1 |
| Genre-specific mandatory block substitution | Jazz/ambient compressor-instead-of-808 deferred to v4.1 with effect combos |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAD-01 | — | Pending |
| STAD-02 | — | Pending |
| STAD-03 | — | Pending |
| STAD-04 | — | Pending |
| STAD-05 | — | Pending |
| STAD-06 | — | Pending |
| STAD-07 | — | Pending |
| STAD-08 | — | Pending |
| PROMPT-01 | — | Pending |
| PROMPT-02 | — | Pending |
| PROMPT-03 | — | Pending |
| PROMPT-04 | — | Pending |
| AMP-01 | — | Pending |
| AMP-02 | — | Pending |
| AMP-03 | — | Pending |
| AMP-04 | — | Pending |
| AMP-05 | — | Pending |
| FX-01 | — | Pending |
| FX-02 | — | Pending |
| FX-03 | — | Pending |
| FX-04 | — | Pending |
| ARCH-01 | — | Pending |

**Coverage:**
- v4.0 requirements: 22 total
- Mapped to phases: 0
- Unmapped: 22

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after initial definition*
