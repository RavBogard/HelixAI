# Requirements: HelixTones

**Defined:** 2026-03-05
**Core Value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive to playing, and built with the same signal chain intelligence as paid professional presets.

## v5.0 Requirements

Requirements for v5.0 Device-First Architecture. Each maps to roadmap phases.

### Device Routing

- [x] **ROUTE-01**: System defines DeviceFamily discriminated union (helix, stomp, podgo, stadium) with exhaustive TypeScript switch
- [x] **ROUTE-02**: System maps all DeviceTarget values to their DeviceFamily via resolveFamily() with compile-time exhaustiveness
- [x] **ROUTE-03**: System defines DeviceCapabilities per family (block limits, DSP count, dual-amp support, available block types)
- [x] **ROUTE-04**: Device family is resolved at the earliest pipeline entry point (before chat or generation begins)

### Model Catalog Isolation

- [ ] **CAT-01**: Stadium family has its own amp catalog module containing only Agoura amps — no HD2 amps visible
- [ ] **CAT-02**: Helix/Stomp/PodGo families have their own amp catalog modules containing only HD2 amps — no Agoura amps visible
- [ ] **CAT-03**: Global merged AMP_NAMES is eliminated — no single enum contains both HD2 and Agoura amp names
- [ ] **CAT-04**: Per-family ToneIntent Zod schema constrains ampName to only that family's catalog — Claude's constrained decoding cannot output cross-family amps
- [ ] **CAT-05**: Effect catalogs are scoped per family (Pod Go Mono/Stereo suffixes, Stomp subset, Stadium extended set)

### Device-Specific Prompts

- [x] **PROMPT-01**: Each device family has its own planner prompt template with only its model catalog, constraints, and capabilities
- [x] **PROMPT-02**: Each device family has its own chat system prompt with device-appropriate conversation arc
- [x] **PROMPT-03**: Stomp prompt emphasizes block-budget management ("what do you cut?" constraint conversation)
- [x] **PROMPT-04**: Pod Go prompt emphasizes slot priority and regimented chain order
- [x] **PROMPT-05**: Stadium prompt uses Agoura-native tone vocabulary and references Stadium-specific features (7-band Parametric EQ)
- [x] **PROMPT-06**: Helix prompt leverages full dual-DSP capabilities and dual-amp routing options

### Stadium Firmware Params

- [ ] **STADPARAM-01**: All 27+ firmware params per Agoura amp model are extracted from real .hsp corpus
- [ ] **STADPARAM-02**: Hidden params (AmpCabPeak*, AmpCabShelf*, AmpCabZFir, Aggression, Bright, Contour, Depth, Fat, Hype) have correct default values in model definitions
- [ ] **STADPARAM-03**: Generated Stadium presets emit all firmware params on every amp block — no param bleed from previously loaded presets
- [ ] **STADPARAM-04**: Stadium effect blocks also emit complete firmware param sets (not just amp blocks)

### Knowledge Layer Refactor

- [ ] **KLAYER-01**: chain-rules.ts guard sites replaced with family-dispatched module functions
- [ ] **KLAYER-02**: param-engine.ts device guards replaced with per-family parameter resolution
- [ ] **KLAYER-03**: validate.ts device guards replaced with per-family validation modules
- [ ] **KLAYER-04**: Adding a new device to an existing family requires no changes to shared code — only family module update

### Frontend + Persistence

- [x] **FRONT-01**: Device family picker appears at the start of conversation (before first user message)
- [x] **FRONT-02**: Selected device family persists through the entire conversation and generation pipeline
- [x] **FRONT-03**: Supabase conversations table has a device column storing the selected device
- [x] **FRONT-04**: Legacy conversations without device show the device picker on resume (no silent default)

## Future Requirements

Deferred to v5.1 or later. Tracked but not in current roadmap.

### New Device Variants

- **NEWDEV-01**: Helix Rack support (same .hlx format as Floor/LT — verify device ID and I/O model IDs from real hardware export)
- **NEWDEV-02**: Stadium XL support (verify topology matches Stadium — single-path or dual-path)
- **NEWDEV-03**: Pod Go XL support (verify block limits match Pod Go or are extended)

### Deferred from v4.0

- **COMBO-01**: Effect combination logic (comp→drive, mod→reverb interaction params)
- **COST-01**: Cost-aware model routing (evidence-based Haiku chat vs. Sonnet generation)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New device variants (Rack, Stadium XL, Pod Go XL) | Requires real hardware exports for corpus-driven development — deferred to v5.1 after architecture ships |
| MIDI configuration | Focus on tone, not hardware routing |
| IR (impulse response) loading | Stick with stock cabs |
| Full pedalboard OCR | Too unreliable, per-pedal photos are the baseline |
| Multi-provider comparison UI | Single provider for quality focus |
| Effect combination logic | Requires context-passing architectural decision — deferred from v4.0 |
| Cost-aware model routing | Requires 30-day baseline and A/B quality comparison — deferred from v4.0 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROUTE-01 | Phase 61 | Complete |
| ROUTE-02 | Phase 61 | Complete |
| ROUTE-03 | Phase 61 | Complete |
| ROUTE-04 | Phase 61 | Complete |
| CAT-01 | Phase 62 | Pending |
| CAT-02 | Phase 62 | Pending |
| CAT-03 | Phase 62 | Pending |
| CAT-04 | Phase 62 | Pending |
| CAT-05 | Phase 62 | Pending |
| PROMPT-01 | Phase 65 | Complete |
| PROMPT-02 | Phase 65 | Complete |
| PROMPT-03 | Phase 65 | Complete |
| PROMPT-04 | Phase 65 | Complete |
| PROMPT-05 | Phase 65 | Complete |
| PROMPT-06 | Phase 65 | Complete |
| STADPARAM-01 | Phase 63 | Pending |
| STADPARAM-02 | Phase 63 | Pending |
| STADPARAM-03 | Phase 63 | Pending |
| STADPARAM-04 | Phase 63 | Pending |
| KLAYER-01 | Phase 64 | Pending |
| KLAYER-02 | Phase 64 | Pending |
| KLAYER-03 | Phase 64 | Pending |
| KLAYER-04 | Phase 64 | Pending |
| FRONT-01 | Phase 66 | Pending |
| FRONT-02 | Phase 66 | Pending |
| FRONT-03 | Phase 66 | Complete (66-01) |
| FRONT-04 | Phase 66 | Complete (66-01) |

**Coverage:**
- v5.0 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-06 after Phase 65 completion — PROMPT-01 through PROMPT-06 complete*
