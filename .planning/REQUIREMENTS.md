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

- [x] **CHAIN-01**: Deterministic signal chain assembly enforcing correct block order (Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb)
- [x] **CHAIN-02**: Always-on transparent boost block before amp — Minotaur (Klon) for clean/crunch, Scream 808 for high-gain
- [x] **CHAIN-03**: Post-cab EQ block on every preset with genre/category-appropriate cuts (mud at 300-500 Hz, harshness at 3-5 kHz)
- [x] **CHAIN-04**: Noise gate — input block gate always enabled; Horizon Gate post-amp for high-gain presets
- [x] **CHAIN-05**: DSP path split rules enforcing 8-block-per-DSP limit with amp+cab on DSP0
- [x] **CHAIN-06**: Mandatory block insertion — the engine inserts required blocks (boost, EQ, gate) without AI involvement

### Amp & Cab Quality

- [x] **TONE-01**: Amp-category-specific parameter defaults — clean amps get Master 9-10/Drive 2-3/SAG 5-7; high-gain amps get Drive 3-5/Master 3-6/SAG 2-3
- [x] **TONE-02**: Cab block filtering on every preset — Low Cut 80-100 Hz, High Cut 5-8 kHz (6 dB/oct slope accounted for)
- [x] **TONE-03**: Post-cab presence recovery — high shelf +0.5-1.5 dB at 6-8 kHz to restore sparkle after high cut
- [x] **TONE-04**: Mic selection by tone category — 121 Ribbon for clean/jazz, 57 Dynamic for distorted, blend for crunch
- [x] **TONE-05**: Correct amp+cab pairing — amp models matched with tonally coherent cab models by default
- [x] **TONE-06**: Amp topology awareness — cathode-follower amps (Cali Rectifire) get different mid EQ treatment than plate-fed amps (PV Panama)

### Snapshot System

- [x] **SNAP-01**: 4-snapshot minimum per preset (Clean, Rhythm, Lead, Ambient) with per-snapshot block states
- [x] **SNAP-02**: Volume-balanced snapshots via Channel Volume overrides — each snapshot plays at equivalent perceived loudness
- [x] **SNAP-03**: Lead snapshot volume boost (+2-3 dB) via Volume block controlled by snapshot
- [x] **SNAP-04**: Delay and reverb trails enabled by default — no abrupt cutoffs when switching snapshots
- [x] **SNAP-05**: Programmatic block state generation from final signal chain (never trust AI-generated block keys)

### AI Integration

- [x] **AI-01**: Claude Sonnet 4.6 as single generation provider with output_config structured output (constrained decoding)
- [x] **AI-02**: ToneIntent Zod schema with z.toJSONSchema() export — single source of truth for TypeScript types and AI schema
- [x] **AI-03**: Complete valid model ID enumeration in Planner prompt — prevents hallucination via enum constraint
- [x] **AI-04**: Gemini chat phase unchanged — keeps Google Search grounding for artist/rig research
- [x] **AI-05**: Planner prompt generates only creative choices (~15 fields) — Knowledge Layer generates all parameter values

### Dynamic Responsiveness

- [x] **DYN-01**: Presets clean up naturally when rolling back guitar volume knob (low Drive + high Master ratio)
- [x] **DYN-02**: SAG parameter set appropriately per category for musical power-amp-style compression
- [x] **DYN-03**: Boost architecture enables dynamic response — rolling back volume removes boost effect on amp input

### .hlx File Quality

- [x] **HLX-01**: Generated .hlx files load without errors on Helix LT hardware
- [x] **HLX-02**: Generated .hlx files load without errors on Helix Floor hardware (same format, different device ID)
- [x] **HLX-03**: Fail-fast validation — structural errors cause generation failure, not silent auto-correction
- [x] **HLX-04**: Block state keys rebuilt programmatically after validation (prevents silent snapshot corruption)

### Frontend & UX

- [x] **UX-01**: Device selector — user chooses Helix LT or Helix Floor before generation
- [x] **UX-02**: Warm Analog Studio aesthetic preserved and polished
- [x] **UX-03**: Chat-based tone interview flow using Gemini with Google Search grounding
- [x] **UX-04**: Single preset download — generate one world-class preset per request (remove multi-provider comparison UI)

## v1.1 Requirements

Requirements for Polish & Precision milestone. Bug fixes, preset intelligence, cost optimization, and UI transparency.

### Hardware Correctness

- [x] **HW-01**: Stomp footswitch `@fs_enabled` set to `true` for all stomp-assigned blocks so hardware responds on first press
- [x] **HW-02**: Snapshot `@pedalstate` bitmask computed from each snapshot's block enable/disable states so pedal LEDs reflect active stomps per snapshot
- [x] **HW-03**: Broader .hlx format audit — export real HX Edit presets, diff against generated output, fix any discovered field mismatches

### Preset Intelligence

- [x] **INTL-01**: Genre-aware effect parameter defaults — delay time, reverb mix, and modulation rate tuned to `genreHint` (e.g., slapback for blues, long+wet for ambient, dry for metal)
- [x] **INTL-02**: Smarter snapshot effect toggling — ambient snapshot enables reverb+delay with elevated Mix, clean snapshot disables drive-type effects, based on block `intentRole`

### Cost & Performance

- [x] **PERF-01**: Prompt caching via `cache_control: { type: "ephemeral" }` on system prompt for ~50% API input cost reduction

### Frontend Transparency

- [x] **FXUI-01**: Signal chain visualization — show the amp, effects, and signal flow of the generated preset before download
- [x] **FXUI-02**: Tone description card — human-readable summary showing amp/cab pair, effect list, snapshot names, and guitar notes

### Branding

- [x] **BRAND-01**: "Project of Daniel Bogard" footer with link to danielbogard.com on all pages

## v1.2 Requirements

Requirements for Pod Go Support milestone. Extend HelixAI to generate presets for Line 6 Pod Go — single-DSP device with different file format, block constraints, and model catalog.

### Pod Go File Format

- [ ] **PGP-01**: Generated .pgp file with device ID 2162695 loads in Pod Go Edit without errors
- [ ] **PGP-02**: Block @type values use Pod Go-specific encoding (delay=5, modulation=0, reverb=5, EQ_STATIC=6 — complete remap from Helix values)
- [ ] **PGP-03**: I/O uses `input`/`output` keys with `P34_AppDSPFlow*` models — no @path, @stereo, or @topology fields present
- [ ] **PGP-04**: Cab placed as numbered block in signal chain (not separate `cab0` key like Helix)
- [ ] **PGP-05**: Single-DSP structure — all blocks on dsp0, `dsp1: {}` always empty

### Pod Go Model Catalog

- [ ] **PGMOD-01**: Effect model IDs use correct Mono/Stereo suffixes (e.g., `HD2_DistScream808Mono` not `HD2_DistScream808`)
- [ ] **PGMOD-02**: Amp model IDs shared directly with Helix — no suffix transformation needed
- [ ] **PGMOD-03**: Pod Go-excluded models (Tone Sovereign, Clawthorn Drive, Cosmos Echo, Poly Pitch, Space Echo) never offered by AI planner
- [ ] **PGMOD-04**: Device-filtered model list passed to AI planner prompt so Pod Go presets only reference Pod Go-available models

### Pod Go Signal Chain

- [ ] **PGCHAIN-01**: Series-only routing with maximum 4 user-assignable effect blocks enforced (10 total: 6 fixed + 4 flexible)
- [ ] **PGCHAIN-02**: No auto-inserted Parametric EQ or Gain Block for Pod Go — DSP budget reserved for user-facing effects
- [ ] **PGCHAIN-03**: Chain assembly assigns all blocks to dsp:0, never splits across DSPs

### Pod Go Snapshots

- [ ] **PGSNAP-01**: Exactly 4 snapshots generated (snapshot0-snapshot3) with `@controller: 4` for snapshot recall
- [ ] **PGSNAP-02**: Volume-balanced snapshot design (Clean, Rhythm, Lead, Ambient) matching Helix quality standard with per-snapshot block states

### Pod Go Preset Quality

- [ ] **PGQUAL-01**: Shared param-engine resolution — Pod Go presets receive same category/genre/topology-aware parameter defaults as Helix
- [ ] **PGQUAL-02**: Mix-ready tone quality — proper cab filtering, dynamic responsiveness, and professional signal chain on Pod Go presets

### Pod Go Frontend & UX

- [ ] **PGUX-01**: Pod Go appears as device option in the device selector dropdown
- [ ] **PGUX-02**: Pod Go generation produces downloadable .pgp file with correct extension
- [ ] **PGUX-03**: Signal chain visualization and tone card display 4 snapshots (not 8) for Pod Go presets

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

### Extended Pod Go

- **PG-V2-01**: Pod Go Wireless as separate device target (same .pgp format, different display name — needs device ID verification)
- **PG-V2-02**: Live DSP budget calculation with per-effect DSP cost estimates
- **PG-V2-03**: Stomp mode footswitch layout optimization for Pod Go (musical logic-based FS assignment)

### Infrastructure

- **INFRA-V2-02**: Telemetry for AI correction rate — log and alert if >2 corrections per generation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Impulse Response (IR) loading | Breaks "download and play" experience; stock Helix cabs are excellent when properly filtered |
| HX Stomp support | Different hardware constraints, different DSP limits — defer to future milestone |
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
| CHAIN-01 | Phase 2 | Complete |
| CHAIN-02 | Phase 2 | Complete |
| CHAIN-03 | Phase 2 | Complete |
| CHAIN-04 | Phase 2 | Complete |
| CHAIN-05 | Phase 2 | Complete |
| CHAIN-06 | Phase 2 | Complete |
| TONE-01 | Phase 2 | Complete |
| TONE-02 | Phase 2 | Complete |
| TONE-03 | Phase 2 | Complete |
| TONE-04 | Phase 2 | Complete |
| TONE-05 | Phase 2 | Complete |
| TONE-06 | Phase 2 | Complete |
| SNAP-01 | Phase 2 | Complete |
| SNAP-02 | Phase 2 | Complete |
| SNAP-03 | Phase 2 | Complete |
| SNAP-04 | Phase 2 | Complete |
| SNAP-05 | Phase 2 | Complete |
| DYN-01 | Phase 2 | Complete |
| DYN-02 | Phase 2 | Complete |
| DYN-03 | Phase 2 | Complete |
| AI-01 | Phase 3 | Complete |
| AI-02 | Phase 3 | Complete |
| AI-03 | Phase 3 | Complete |
| AI-04 | Phase 3 | Complete |
| AI-05 | Phase 3 | Complete |
| HLX-01 | Phase 4 | Complete |
| HLX-02 | Phase 4 | Complete |
| HLX-03 | Phase 4 | Complete |
| HLX-04 | Phase 4 | Complete |
| UX-01 | Phase 5 | Complete |
| UX-02 | Phase 5 | Complete |
| UX-03 | Phase 5 | Complete |
| UX-04 | Phase 5 | Complete |
| HW-01 | Phase 7 | Complete |
| HW-02 | Phase 7 | Complete |
| HW-03 | Phase 7 | Complete |
| PERF-01 | Phase 8 | Complete |
| INTL-01 | Phase 9 | Complete |
| INTL-02 | Phase 10 | Complete |
| FXUI-01 | Phase 11 | Complete |
| FXUI-02 | Phase 11 | Complete |
| BRAND-01 | Phase 11 | Complete |

**Coverage:**
- v1 requirements: 36 total (all complete)
- v1.1 requirements: 9 total (all complete)
- v1.2 requirements: 17 total (pending)
- Mapped to phases: 36 (v1 Phases 1-6) + 9 (v1.1 Phases 7-11) + 17 (v1.2 TBD)
- Unmapped: 17 (awaiting roadmap)

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-02 — v1.2 requirements defined (17 Pod Go requirements)*
