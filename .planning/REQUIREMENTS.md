# Requirements: HelixAI

**Defined:** 2026-03-01
**Core Value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive to playing, and built with signal chain intelligence.

## v1 Requirements

Requirements for the rebuilt preset engine. Each maps to roadmap phases.

### Foundation (Types & Data)

- [x] **FNDN-01**: Expanded model database with amp category metadata (clean/crunch/high-gain), cab affinities, and topology tags (cathode-follower vs. plate-fed)
- [x] **FNDN-02**: ToneIntent type definition — the narrow AI output contract (~15 fields: amp name, cab name, effects, snapshot intents, guitar type)
- [x] **FNDN-03**: Verified @type block constants against real HX Edit .hlx exports (current values are unverified and may be wrong)
- [x] **FNDN-04**: Parameter type registry distinguishing Hz values (LowCut/HighCut), integer indices (Mic), and normalized floats (Drive/Master)
- [x] **FNDN-05**: LowCut and HighCut made required fields on cab type (not optional) with safe defaults per gain category

### Signal Chain Engineering

- [ ] **CHAIN-01**: Deterministic signal chain assembly enforcing correct block order (Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb)
- [ ] **CHAIN-02**: Always-on transparent boost block before amp — Minotaur (Klon) for clean/crunch, Scream 808 for high-gain
- [ ] **CHAIN-03**: Post-cab EQ block on every preset with genre/category-appropriate cuts (mud at 300-500 Hz, harshness at 3-5 kHz)
- [ ] **CHAIN-04**: Noise gate — input block gate always enabled; Horizon Gate post-amp for high-gain presets
- [ ] **CHAIN-05**: DSP path split rules enforcing 8-block-per-DSP limit with amp+cab on DSP0
- [ ] **CHAIN-06**: Mandatory block insertion — the engine inserts required blocks (boost, EQ, gate) without AI involvement

### Amp & Cab Quality

- [ ] **TONE-01**: Amp-category-specific parameter defaults — clean amps get Master 9-10/Drive 2-3/SAG 5-7; high-gain amps get Drive 3-5/Master 3-6/SAG 2-3
- [ ] **TONE-02**: Cab block filtering on every preset — Low Cut 80-100 Hz, High Cut 5-8 kHz (6 dB/oct slope accounted for)
- [ ] **TONE-03**: Post-cab presence recovery — high shelf +0.5-1.5 dB at 6-8 kHz to restore sparkle after high cut
- [ ] **TONE-04**: Mic selection by tone category — 121 Ribbon for clean/jazz, 57 Dynamic for distorted, blend for crunch
- [ ] **TONE-05**: Correct amp+cab pairing — amp models matched with tonally coherent cab models by default
- [ ] **TONE-06**: Amp topology awareness — cathode-follower amps (Cali Rectifire) get different mid EQ treatment than plate-fed amps (PV Panama)

### Snapshot System

- [ ] **SNAP-01**: 4-snapshot minimum per preset (Clean, Rhythm, Lead, Ambient) with per-snapshot block states
- [ ] **SNAP-02**: Volume-balanced snapshots via Channel Volume overrides — each snapshot plays at equivalent perceived loudness
- [ ] **SNAP-03**: Lead snapshot volume boost (+2-3 dB) via Volume block controlled by snapshot
- [ ] **SNAP-04**: Delay and reverb trails enabled by default — no abrupt cutoffs when switching snapshots
- [ ] **SNAP-05**: Programmatic block state generation from final signal chain (never trust AI-generated block keys)

### AI Integration

- [ ] **AI-01**: Claude Sonnet 4.6 as single generation provider with output_config structured output (constrained decoding)
- [ ] **AI-02**: ToneIntent Zod schema with z.toJSONSchema() export — single source of truth for TypeScript types and AI schema
- [ ] **AI-03**: Complete valid model ID enumeration in Planner prompt — prevents hallucination via enum constraint
- [ ] **AI-04**: Gemini chat phase unchanged — keeps Google Search grounding for artist/rig research
- [ ] **AI-05**: Planner prompt generates only creative choices (~15 fields) — Knowledge Layer generates all parameter values

### Dynamic Responsiveness

- [ ] **DYN-01**: Presets clean up naturally when rolling back guitar volume knob (low Drive + high Master ratio)
- [ ] **DYN-02**: SAG parameter set appropriately per category for musical power-amp-style compression
- [ ] **DYN-03**: Boost architecture enables dynamic response — rolling back volume removes boost effect on amp input

### .hlx File Quality

- [ ] **HLX-01**: Generated .hlx files load without errors on Helix LT hardware
- [ ] **HLX-02**: Generated .hlx files load without errors on Helix Floor hardware (same format, different device ID)
- [ ] **HLX-03**: Fail-fast validation — structural errors cause generation failure, not silent auto-correction
- [ ] **HLX-04**: Block state keys rebuilt programmatically after validation (prevents silent snapshot corruption)

### Frontend & UX

- [ ] **UX-01**: Device selector — user chooses Helix LT or Helix Floor before generation
- [ ] **UX-02**: Warm Analog Studio aesthetic preserved and polished
- [ ] **UX-03**: Chat-based tone interview flow using Gemini with Google Search grounding
- [ ] **UX-04**: Single preset download — generate one world-class preset per request (remove multi-provider comparison UI)

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Extended Preset Quality

- **TONE-V2-01**: Pickup-aware tone calibration — single-coil vs. humbucker EQ differences applied during generation
- **TONE-V2-02**: Dual cab / dual mic blending — SM57 60-70% + 121 Ribbon 30-40% in Cab > Dual block
- **TONE-V2-03**: Genre-specific signal chain templates — structurally different chains for metal vs. clean jazz vs. ambient
- **TONE-V2-04**: Full amp topology database — cathode-follower vs. plate-fed tagging for all 100+ Helix amp models

### Extended Snapshots

- **SNAP-V2-01**: Snapshots 5-8 with genre-specific variations (heavy rhythm, clean+delay, octave lead, full wet)
- **SNAP-V2-02**: Stomp mode footswitch layout — logical footswitch assignments for live use

### Infrastructure

- **INFRA-V2-01**: Firmware version parameterization — support FW 3.71-3.80 model additions
- **INFRA-V2-02**: Telemetry for AI correction rate — log and alert if >2 corrections per generation
- **INFRA-V2-03**: Test suite for Knowledge Layer — assert parameter ranges per amp category, DSP limits, cab filter presence

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Impulse Response (IR) loading | Breaks "download and play" experience; stock Helix cabs are excellent when properly filtered |
| HX Stomp / POD Go support | Different hardware constraints, different DSP limits, different .hlx sub-formats |
| User accounts / preset saving | Keep stateless: generate, download, done — focus on quality not infrastructure |
| MIDI / Command Center configuration | Hardware-specific, use-case-specific, technically complex — focus on tone |
| Multi-provider comparison UI | Going single provider for quality focus; one excellent preset > three mediocre options |
| Preset rating / feedback loop | Requires data pipeline and retraining infrastructure; out of scope for this rebuild |
| Maximum gain / extreme saturation defaults | Cap drive at 6; use 808 boost for saturation — prevents muddy, compressed presets |
| Parallel dual-amp paths as default | Serial single-path is correct; dual-path only for specific genre patterns |
| Global EQ as tone fix | Apply all tone shaping in the preset itself via cab block and post-cab EQ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDN-01 | Phase 1 | Complete |
| FNDN-02 | Phase 1 | Complete |
| FNDN-03 | Phase 1 | Complete |
| FNDN-04 | Phase 1 | Complete |
| FNDN-05 | Phase 1 | Complete |
| CHAIN-01 | Phase 2 | Pending |
| CHAIN-02 | Phase 2 | Pending |
| CHAIN-03 | Phase 2 | Pending |
| CHAIN-04 | Phase 2 | Pending |
| CHAIN-05 | Phase 2 | Pending |
| CHAIN-06 | Phase 2 | Pending |
| TONE-01 | Phase 2 | Pending |
| TONE-02 | Phase 2 | Pending |
| TONE-03 | Phase 2 | Pending |
| TONE-04 | Phase 2 | Pending |
| TONE-05 | Phase 2 | Pending |
| TONE-06 | Phase 2 | Pending |
| SNAP-01 | Phase 2 | Pending |
| SNAP-02 | Phase 2 | Pending |
| SNAP-03 | Phase 2 | Pending |
| SNAP-04 | Phase 2 | Pending |
| SNAP-05 | Phase 2 | Pending |
| DYN-01 | Phase 2 | Pending |
| DYN-02 | Phase 2 | Pending |
| DYN-03 | Phase 2 | Pending |
| AI-01 | Phase 3 | Pending |
| AI-02 | Phase 3 | Pending |
| AI-03 | Phase 3 | Pending |
| AI-04 | Phase 3 | Pending |
| AI-05 | Phase 3 | Pending |
| HLX-01 | Phase 4 | Pending |
| HLX-02 | Phase 4 | Pending |
| HLX-03 | Phase 4 | Pending |
| HLX-04 | Phase 4 | Pending |
| UX-01 | Phase 5 | Pending |
| UX-02 | Phase 5 | Pending |
| UX-03 | Phase 5 | Pending |
| UX-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36 (Phases 1-5)
- Unmapped: 0
- Phase 6 (Hardening): addresses launch-readiness concerns from research — no v1 requirements assigned; see ROADMAP.md Phase 6 note

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after roadmap creation (traceability confirmed 36/36)*
