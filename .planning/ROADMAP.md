# Roadmap: HelixTones

## Milestones

- ✅ **v1.0 Full Rebuild** — Phases 1-6 (shipped 2026-03-02)
- ✅ **v1.1 Polish & Precision** — Phases 7-11 (shipped 2026-03-02)
- ✅ **v1.2 Pod Go Support** — Phases 12-16 (shipped 2026-03-02)
- ✅ **v1.3 Rig Emulation** — Phases 17-21 (shipped 2026-03-02)
- ✅ **v2.0 Persistent Chat Platform** — Phases 24-30 (shipped 2026-03-04)
- ✅ **v3.0 Helix Stadium Support** — Phases 31-38 (shipped 2026-03-04)
- ✅ **v3.2 Infrastructure, Features & Audit Tooling** — Phases 42, 48-51 (shipped 2026-03-05)
- ✅ **v4.0 Stadium Rebuild + Preset Quality Leap** — Phases 52-60 (shipped 2026-03-05)
- ✅ **v5.0 Device-First Architecture** — Phases 61-69 (shipped 2026-03-06)
- 🚧 **v6.0 Preset Craft Mastery** — Phases 70-74 (in progress)

## Phases

<details>
<summary>✅ v1.0 Full Rebuild (Phases 1-6) — SHIPPED 2026-03-02</summary>

- [x] Phase 1: Foundation (3/3 plans)
- [x] Phase 2: Knowledge Layer (3/3 plans)
- [x] Phase 3: AI Integration (2/2 plans)
- [x] Phase 4: Orchestration (2/2 plans)
- [x] Phase 5: Frontend Polish (2/2 plans)
- [x] Phase 6: Hardening (2/2 plans)

</details>

<details>
<summary>✅ v1.1 Polish & Precision (Phases 7-11) — SHIPPED 2026-03-02</summary>

- [x] Phase 7: Hardware Bug Fixes and .hlx Audit
- [x] Phase 8: Prompt Caching
- [x] Phase 9: Genre-Aware Effect Defaults
- [x] Phase 10: Smarter Snapshot Effect Toggling
- [x] Phase 11: Frontend Transparency

</details>

<details>
<summary>✅ v1.2 Pod Go Support (Phases 12-16) — SHIPPED 2026-03-02</summary>

- [x] Phase 12: Format Foundation and Types
- [x] Phase 13: Pod Go Model Catalog
- [x] Phase 14: Chain Rules, Validation, and Planner
- [x] Phase 15: Pod Go Preset Builder
- [x] Phase 16: Integration, UI, and Testing

</details>

<details>
<summary>✅ v1.3 Rig Emulation (Phases 17-21) — SHIPPED 2026-03-02</summary>

- [x] Phase 17: Schemas & Types Foundation (1/1 plan)
- [x] Phase 18: Pedal Mapping Engine (1/1 plan)
- [x] Phase 19: Vision Extraction API (1/1 plan)
- [x] Phase 20: Planner Integration & Route Orchestration (1/1 plan)
- [x] Phase 21: Substitution Card & End-to-End Polish (1/1 plan)

</details>

<details>
<summary>✅ v2.0 Persistent Chat Platform (Phases 24-30) — SHIPPED 2026-03-04</summary>

- [x] Phase 24: Supabase Foundation (3/3 plans)
- [x] Phase 25: Auth Flow (2/2 plans)
- [x] Phase 26: Conversation CRUD API (2/2 plans)
- [x] Phase 27: Persistence Wiring (2/2 plans)
- [x] Phase 28: Chat Sidebar UI/UX Polish (3/3 plans)
- [x] Phase 29: Dual-Amp Preset Generation Fix (3/3 plans)
- [x] Phase 30: Chat Auto-Save on First AI Response (1/1 plan)

</details>

<details>
<summary>✅ v3.0 Helix Stadium Support (Phases 31-41) — SHIPPED 2026-03-04</summary>

- [x] Phase 31: Device ID Research + Helix Floor Regression Fix (1/1 plan)
- [x] Phase 32: Type System Foundation (1/1 plan)
- [x] Phase 33: Stadium Model Catalog (1/1 plan)
- [x] Phase 34: Stadium Chain Rules + Validation (1/1 plan)
- [x] Phase 35: Stadium Builder (1/1 plan)
- [x] Phase 36: Planner + API Route Integration (1/1 plan)
- [x] Phase 37: UI — Device Selector + Download (1/1 plan)
- [x] Phase 38: Rig Emulation for Stadium (1/1 plan)
- [x] Phase 39: HX Stomp & HX Stomp XL Support (3/3 plans)
- [x] Phase 40: Rebrand HelixAI to HelixTones (1/1 plan)
- [x] Phase 41: Chat UX — device selection timing (1/1 plan)

</details>

<details>
<summary>✅ v3.2 Infrastructure, Features & Audit Tooling (Phases 42, 48-51) — SHIPPED 2026-03-05</summary>

- [x] Phase 42: Token Cost Audit + Quality Baseline (2/2 plans)
- [x] Phase 48: Footer Restoration (1/1 plan)
- [x] Phase 50: Donation Support (1/1 plan)

</details>

<details>
<summary>✅ v4.0 Stadium Rebuild + Preset Quality Leap (Phases 52-60) — SHIPPED 2026-03-05</summary>

- [x] Phase 52: Stadium Amp Catalog + Device Constants (1/1 plan)
- [x] Phase 53: Stadium Builder Rebuild (2/2 plans)
- [x] Phase 54: Stadium Device Unblock (1/1 plan)
- [x] Phase 55: Planner Prompt Enrichment (2/2 plans)
- [x] Phase 56: Per-Model Amp Parameter Overrides (2/2 plans)
- [x] Phase 57: Effect Parameter Intelligence (2/2 plans)
- [x] Phase 58: Architecture Audit (1/1 plan)
- [x] Phase 59: Fix Helix Floor Error 8309 (bug fix)
- [x] Phase 60: Tech Debt Cleanup (2/2 plans)

</details>

### v5.0 Device-First Architecture (In Progress)

**Milestone Goal:** Rearchitect the pipeline so device identity is resolved at conversation start, every device family follows a fully isolated path (prompts, catalogs, schemas, chain rules), Stadium presets emit all 27 firmware params per amp block, and the frontend picker is the first thing a user sees.

#### Phase Summary

- [x] **Phase 61: Family Router and Capabilities** — Define DeviceFamily type, resolveFamily(), and DeviceCapabilities — the type-system foundation all other phases depend on
- [x] **Phase 62: Catalog Isolation** — Extract per-family amp and effect catalogs, eliminate merged AMP_NAMES, close the Agoura leak at the structural level
- [x] **Phase 63: Stadium Firmware Parameter Completeness** — Extract all 27+ firmware params from real .hsp corpus and emit them on every Stadium amp block
- [x] **Phase 64: Knowledge Layer Guard Removal** — Replace 17+ boolean guard sites in chain-rules.ts, param-engine.ts, and validate.ts with DeviceCapabilities-driven dispatch
- [x] **Phase 65: Device-Specific Prompts** — Create per-family planner and chat prompt templates with only family-appropriate model catalogs and conversation arcs
- [x] **Phase 66: Frontend Picker and Database Migration** — Move device picker to conversation start, add device column to Supabase conversations table, handle legacy rows
- [x] **Phase 67: Stadium Integration Quality** — Fix WAH/VOLUME catalog gap, dual-amp capability mismatch, TODO(Phase62) placeholder in prompt, and add schema/prompt integration tests (completed 2026-03-06)
- [x] **Phase 68: Token Control and Prompt Caching** — Reduce API costs without degrading preset quality: optimize token budgets, maximize prompt caching, audit system prompt sizes (completed 2026-03-06)
- [x] **Phase 69: Audit Gap Closure** — Fix Stomp maxFx budget mismatch, create retroactive verification documents for phases 62-65, update requirements traceability table (completed 2026-03-06)

## Phase Details

### Phase 61: Family Router and Capabilities
**Goal**: The type system knows what family every device belongs to, and the application resolves family at pipeline entry — before any chat or generation begins
**Depends on**: Phase 60 (v4.0 complete)
**Requirements**: ROUTE-01, ROUTE-02, ROUTE-03, ROUTE-04
**Success Criteria** (what must be TRUE):
  1. TypeScript compiler rejects any code that handles a DeviceFamily without covering all four variants (helix, stomp, podgo, stadium)
  2. Calling resolveFamily() with any valid DeviceTarget returns the correct DeviceFamily without a runtime error
  3. getCapabilities() returns a DeviceCapabilities object that encodes correct block limits, DSP count, dual-amp support, and available block types for each family
  4. Device family is resolved once at the pipeline entry point and passed forward — no downstream code calls resolveFamily() a second time
**Plans**: TBD

Plans:
- [x] 61-01: DeviceFamily type, resolveFamily(), getCapabilities(), DeviceCapabilities interface, pipeline wiring, tests

### Phase 62: Catalog Isolation
**Goal**: Each device family has its own amp and effect catalog module containing only the models valid for that family — the global merged AMP_NAMES enum that allows cross-family model selection is eliminated
**Depends on**: Phase 61
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05
**Success Criteria** (what must be TRUE):
  1. Generating a preset for a non-Stadium device cannot produce an Agoura amp name — it is not in any enum or schema that non-Stadium paths can reach
  2. Generating a Stadium preset cannot produce an HD2 amp name — it is not in any enum or schema that Stadium paths can reach
  3. The global AMP_NAMES constant (or equivalent merged enum) no longer exists in the codebase
  4. Per-family ToneIntent Zod schemas have ampName enums sourced from their respective family catalog — Claude's constrained decoding structurally cannot output a cross-family amp
  5. Full 6-device generation test suite passes with no model-not-found errors
**Plans**: TBD

Plans:
- [x] 62-01: Per-family catalog modules (stadium/catalog.ts, helix/catalog.ts, stomp/catalog.ts, podgo/catalog.ts)
- [x] 62-02: Per-family ToneIntent schemas and getToneIntentSchema() factory, eliminate global AMP_NAMES

### Phase 63: Stadium Firmware Parameter Completeness
**Goal**: Every Stadium preset emits all 27+ firmware parameters per amp block, sourced from real .hsp corpus extraction — param bleed from previously loaded presets on hardware is eliminated
**Depends on**: Phase 62 (for amp model IDs as source of truth)
**Requirements**: STADPARAM-01, STADPARAM-02, STADPARAM-03, STADPARAM-04
**Success Criteria** (what must be TRUE):
  1. Loading a newly generated Stadium preset in HX Edit shows the correct amp model with all visible knobs set to expected values — no parameters carry over from the last preset loaded
  2. A generated Stadium preset file contains all 27+ firmware param keys on every amp block (verified by inspecting raw .hsp JSON)
  3. Hidden params (AmpCabPeak*, AmpCabShelf*, AmpCabZFir, Aggression, Bright, Contour, Depth, Fat, Hype) appear in every generated amp block with corpus-derived defaults
  4. Stadium effect blocks also contain complete firmware param sets, not only amp blocks
**Plans**: TBD

Plans:
- [x] 63-01: Widen param types to Record<string, number | boolean>, expand 18 STADIUM_AMPS to full firmware param tables (19-28 keys each)
- [x] 63-02: Stadium guard in resolveAmpParams(), STADPARAM-03/04 tests, validate.ts Stadium exemption

### Phase 64: Knowledge Layer Guard Removal
**Goal**: The shared Knowledge Layer (chain-rules.ts, param-engine.ts, validate.ts) accepts DeviceCapabilities instead of a device string — the 17+ boolean guard sites (isPodGo, isStadium, isStomp) are replaced with capability field access
**Depends on**: Phase 61 (DeviceCapabilities must exist before guards can be replaced)
**Requirements**: KLAYER-01, KLAYER-02, KLAYER-03, KLAYER-04
**Success Criteria** (what must be TRUE):
  1. The strings "isPodGo", "isStadium", "isStomp" (and equivalent boolean device checks) no longer appear in chain-rules.ts, param-engine.ts, or validate.ts
  2. Adding a hypothetical 7th device to an existing family requires changes only in the family module — no edits to chain-rules.ts, param-engine.ts, or validate.ts
  3. Full 6-device generation test suite passes with no regressions after guard removal
  4. Any remaining guard sites in shared code are documented in STATE.md with an explicit justification for why they remain
**Plans**: TBD

Plans:
- [x] 64-01: Refactor chain-rules.ts to accept DeviceCapabilities, remove guard sites
- [x] 64-02: Refactor param-engine.ts and validate.ts to accept DeviceCapabilities, remove guard sites, full regression test

### Phase 65: Device-Specific Prompts
**Goal**: Each device family gets its own planner prompt and chat system prompt, containing only that family's model catalog and the conversation arc appropriate to its constraints — prompt isolation is complete
**Depends on**: Phase 62 (per-family catalogs must exist to source model lists)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06
**Success Criteria** (what must be TRUE):
  1. The Stomp chat prompt surfaces block-budget constraint framing — the user is asked what to prioritize or cut before the preset is generated
  2. The Pod Go chat prompt surfaces slot priority and chain order framing appropriate to its 4-effect budget
  3. The Stadium chat prompt uses Agoura-native tone vocabulary and mentions Stadium-specific capabilities (7-band Parametric EQ, dual-DSP routing)
  4. The Helix prompt surfaces dual-DSP and dual-amp routing as available options during the interview
  5. Each device family's planner prompt imports only its own catalog module — a grep for cross-family model names in any single prompt file returns zero results
**Plans**: 2 plans

Plans:
- [x] 65-01-PLAN.md — Shared composable prompt sections, per-family prompt modules (helix/stomp/podgo/stadium), and prompt router
- [x] 65-02-PLAN.md — Wire API routes to per-family prompts, delete monolithic functions, add device to usage logger, per-family prompt tests

### Phase 66: Frontend Picker and Database Migration
**Goal**: The device picker appears before the first chat message, the selected device flows through the entire conversation and generation pipeline, and the Supabase database stores device context per conversation — including null-safe handling for all legacy rows
**Depends on**: Phase 65 (per-family chat prompts must exist before device context activates device-specific interviews)
**Requirements**: FRONT-01, FRONT-02, FRONT-03, FRONT-04
**Success Criteria** (what must be TRUE):
  1. A new user who opens the app sees the device picker before any chat input is available — they cannot start a conversation without selecting a device
  2. The device selected at conversation start is the device used for preset generation — no opportunity for device to change silently mid-conversation
  3. Resuming a legacy conversation (no device column value) shows the device picker rather than defaulting silently to any device
  4. The Supabase conversations table has a device column and all existing rows have been backfilled or are handled with null-safe code paths
**Plans**: 2 plans

Plans:
- [x] 66-01-PLAN.md — State variables (deviceLocked, needsDevicePicker), DEVICE_OPTIONS constant, null-safe loadConversation, startOver reset, backfill migration SQL documentation
- [x] 66-02-PLAN.md — Welcome screen device picker, device lock on first message, device in /api/chat POST body, readyToGenerate Generate button, MAINTENANCE_MODE off, human verification

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 1-6 | v1.0 | 14 | Complete | 2026-03-02 |
| 7-11 | v1.1 | 7 | Complete | 2026-03-02 |
| 12-16 | v1.2 | 5 | Complete | 2026-03-02 |
| 17-21 | v1.3 | 5 | Complete | 2026-03-02 |
| 24-30 | v2.0 | 16 | Complete | 2026-03-04 |
| 31-41 | v3.0 | 12 | Complete | 2026-03-04 |
| 42,48-51 | v3.2 | 8 | Complete | 2026-03-05 |
| 52-60 | v4.0 | 13 | Complete | 2026-03-05 |
| 61. Family Router | v5.0 | 1/1 | Complete | 2026-03-06 |
| 62. Catalog Isolation | v5.0 | 2/2 | Complete | 2026-03-06 |
| 63. Stadium Firmware Params | v5.0 | 2/2 | Complete | 2026-03-06 |
| 64. Knowledge Layer Guards | v5.0 | 2/2 | Complete | 2026-03-06 |
| 65. Device-Specific Prompts | v5.0 | 2/2 | Complete | 2026-03-06 |
| 66. Frontend Picker + DB | v5.0 | 2/2 | Complete | 2026-03-06 |
| 67. Stadium Integration Quality | v5.0 | 2/2 | Complete | 2026-03-06 |
| 68. Token Control + Caching | v5.0 | 2/2 | Complete | 2026-03-06 |
| 69. Audit Gap Closure | v5.0 | 2/2 | Complete | 2026-03-06 |

### Phase 67: Stadium Integration Quality

**Goal:** Fix 3 integration concerns discovered after merging parallel branches (61-64 + 65): resolve WAH/VOLUME catalog gap so Stadium users get volume and wah pedals, fix dual-amp capability/prompt mismatch, replace TODO(Phase62) placeholder with real Agoura amp-cab pairing data, and add integration tests for schema/prompt alignment across all families — Stadium presets must sound fantastic
**Depends on:** Phase 65 (runs before Phase 66)
**Requirements**: STADQ-01 (WAH/VOLUME in Stadium catalog+schema), STADQ-02 (dual-amp capability alignment), STADQ-03 (Agoura amp-cab pairing in prompt), STADQ-04 (schema/prompt integration tests)
**Success Criteria** (what must be TRUE):
  1. `STADIUM_EFFECT_NAMES` includes WAH and VOLUME models, and `getToneIntentSchema("stadium")` accepts them — Claude can generate Stadium presets with wah and volume pedals
  2. Stadium dual-amp capability in `STADIUM_CAPABILITIES` is consistent with Stadium prompt and chain-rules behavior — no crash path exists
  3. Stadium prompt contains real Agoura amp-cab pairing guidance instead of TODO placeholder text — no TODO comments reach Claude
  4. An integration test verifies that every model name in each family's planner prompt is a valid member of that family's Zod schema enum
**Plans**: 2 plans

Plans:
- [x] 67-01-PLAN.md — WAH/VOLUME in Stadium catalog + schema, fix dualAmpSupported to false
- [x] 67-02-PLAN.md — Replace TODO placeholder with amp-cab pairing table, cross-family schema/prompt integration tests

### Phase 68: Token Control and Prompt Caching

**Goal:** Reduce API costs without degrading preset quality — optimize token usage across planner prompts (per-family prompt token budgets, trim redundant catalog entries from prompt text), maximize Anthropic prompt caching hit rates (measure per-device cache performance via usage-logger.ts, consider shared prompt buckets for low-volume devices like Stadium and Pod Go), audit system prompt sizes across all families, and implement any structural changes needed to keep cost per preset generation low as the device count grows
**Requirements**: TBD (no formal requirement IDs — cost optimization phase)
**Depends on:** Phase 66 (full pipeline must be wired before measuring token economics)
**Plans:** 2/2 plans complete

Plans:
- [x] 68-01-PLAN.md — Fix cache write pricing bug ($3.75 -> $6.00 for 1h TTL), per-device cache statistics breakdown, prompt token measurement script
- [x] 68-02-PLAN.md — Unify Stomp planner prompt (helix_stomp + helix_stomp_xl share single cache entry), move device restriction to user message

### Phase 69: Audit Gap Closure
**Goal:** Close all gaps identified by the v5.0 milestone audit — fix Stomp maxFx budget values in planner.ts to match DeviceCapabilities, create retroactive VERIFICATION.md for phases 62-65 (code is complete but was executed before formal verifier existed), and update REQUIREMENTS.md traceability table to reflect actual completion status
**Depends on:** Phase 68 (all v5.0 code complete)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06, STADPARAM-01, STADPARAM-02, STADPARAM-03, STADPARAM-04, KLAYER-01, KLAYER-02, KLAYER-03, KLAYER-04
**Gap Closure:** Closes gaps from v5.0-MILESTONE-AUDIT.md
**Success Criteria** (what must be TRUE):
  1. `planner.ts` Stomp maxFx values match DeviceCapabilities (Stomp XL: 5, Stomp: 2)
  2. VERIFICATION.md exists for Phase 62 confirming CAT-01 through CAT-05
  3. VERIFICATION.md exists for Phase 63 confirming STADPARAM-01 through STADPARAM-04
  4. VERIFICATION.md exists for Phase 64 confirming KLAYER-01 through KLAYER-04
  5. VERIFICATION.md exists for Phase 65 confirming PROMPT-01 through PROMPT-06
  6. REQUIREMENTS.md traceability table shows all 27 v5.0 requirements as Complete
**Plans**: 2 plans

Plans:
- [x] 69-01-PLAN.md — Fix Stomp maxFx values in planner.ts (isXL ? 5 : 2), update REQUIREMENTS.md traceability table
- [x] 69-02-PLAN.md — Create retroactive VERIFICATION.md for phases 62, 63, 64, 65

### v6.0 Preset Craft Mastery

**Milestone Goal:** Comprehensive audit and improvement of preset quality across all device families — fix broken expression pedal controllers (wah/volume non-functional), add per-model effect intelligence to AI prompts, implement effect combination logic, optimize per-device preset craft, and deliver significantly better out-of-box tones.

#### Phase Summary

- [x] **Phase 70: Expression Pedal Controller Assignment** — Fix P0 hardware bug: wah and volume blocks get @controller entries so expression pedals actually work on hardware
- [x] **Phase 71: Per-Model Effect Intelligence** — Genre-aware delay/reverb/wah model selection guidance in prompts + effectParamOverrides for models with known bad defaults (completed 2026-03-07)
- [x] **Phase 72: Effect Combination Logic** — Deterministic cross-effect parameter interactions: wah+comp threshold, high-gain gate placement, delay+reverb balance, priority ordering for device budgets (completed 2026-03-07)
- [x] **Phase 73: Per-Device Craft Optimization** — Device-specific tone optimization in both prompts (creative direction) and code (hard limit enforcement) for Stomp, Pod Go, Helix, and Stadium (completed 2026-03-07)
- [x] **Phase 74: Quality Validation** — Non-throwing validatePresetQuality() advisory gate, per-device baseline comparison, regression detection (completed 2026-03-07)
- [x] **Phase 76: Device Block Budget Calibration** — Audit and correct all device block/effect limits to match real hardware; fix Stadium 4→8+ effects, Helix prompt 6→8+ effects, Stomp maxEffectsPerDsp mislabel (completed 2026-03-07)

### Phase 70: Expression Pedal Controller Assignment

**Goal:** Fix the P0 silent hardware bug where wah and volume blocks are completely non-functional — pressing the expression pedal does nothing because @controller entries are never emitted. After this phase, wah blocks sweep when EXP pedal is pressed and volume blocks control level.
**Depends on:** Phase 69 (v5.0 complete)
**Requirements:** EXP-01, EXP-02, EXP-03, EXP-04, EXP-05
**Success Criteria** (what must be TRUE):
  1. Loading a generated preset with a wah block on Helix LT and pressing EXP pedal sweeps the wah filter — pedal is not silent
  2. Volume blocks have @controller entries mapping Position/Volume to expression pedal — volume pedal functions on hardware
  3. Pod Go presets emit only EXP1 assignments (1 physical pedal); Stadium presets emit zero EXP entries (0 physical pedals)
  4. No EXP controller assignment conflicts with any snapshot controller assignment — snapshot-exclusion guard prevents collision
  5. EXP @min/@max values are musically appropriate — wah sweep 0.0-1.0, volume heel-down not silent
**Plans:** 2/2 plans executed
**Status:** COMPLETE

Plans:
- [x] 70-01-PLAN.md — EXP pedal assignment in preset-builder.ts (Helix LT/Floor) and stomp-builder.ts (Stomp/XL) with TDD tests
- [x] 70-02-PLAN.md — EXP pedal assignment in podgo-builder.ts (Pod Go, 1 pedal), snapshot-exclusion guard, cross-device integration tests

### Phase 71: Per-Model Effect Intelligence

**Goal:** The AI selects the RIGHT effect model for the genre, not just any model in the category. Delay, reverb, and wah prompts include per-genre model recommendations. Models with known bad defaults get effectParamOverrides. All guidance is in the static system prompt to preserve cache hit rates.
**Depends on:** Phase 70 (expression pedal types may inform which models need guidance)
**Requirements:** INTEL-01, INTEL-02, INTEL-03, INTEL-04, INTEL-05
**Success Criteria** (what must be TRUE):
  1. Blues presets produce Transistor Tape or Bucket Brigade delay in 7+ of 10 runs — not random delay selection
  2. Country presets produce '63 Spring or Spring reverb in 7+ of 10 runs — genre-defining reverb choice
  3. Ambient presets produce Ganymede reverb and Heliosphere/Adriatic delay in 6+ of 10 runs
  4. Effect model guidance is in the static system prompt (cache_control: ephemeral) — not in the dynamic user message
  5. Shimmer reverb (Ganymede) default Mix is corrected via effectParamOverrides — not the raw over-wet default
**Plans:** 2/2 plans complete

Plans:
- [x] 71-01-PLAN.md — Shared effect-model-intelligence module, paramOverrides on 7 effect models, param-engine resolveDefaultParams override step, TDD tests
- [ ] 71-02-PLAN.md — Wire genreEffectModelSection() into all 4 family planner prompts, alignment tests

### Phase 72: Effect Combination Logic

**Goal:** Effects interact intelligently instead of being independent islands. Wah+compressor threshold is reduced, high-gain tones omit compressor and place gate before amp, delay+reverb mix is balanced to prevent wash. All combination rules have priority ordering so Pod Go's 4-effect budget doesn't break musical intent.
**Depends on:** Phase 71 (per-model overrides should be stable before adding cross-effect interactions)
**Requirements:** COMBO-01, COMBO-02, COMBO-03, COMBO-04
**Success Criteria** (what must be TRUE):
  1. Wah + compressor presets have compressor Threshold at least 0.08 lower than same preset without wah — prevents over-compression
  2. High-gain/metal presets place noise gate before amp and omit compressor — no squeezed dynamics
  3. Delay + reverb presets have reverb Mix at least 0.05 lower than reverb-only presets — prevents wash
  4. Pod Go presets with combination rules still fit within 4-effect budget — priority ordering ensures essential effects survive truncation
**Plans:** 2/2 plans complete
Plans:
- [ ] 72-01-PLAN.md — Structural combination rules: COMBO-02 gate placement + compressor omission, COMBO-03 priority truncation
- [ ] 72-02-PLAN.md — Parametric combination rules: COMBO-01 wah+comp threshold reduction, COMBO-04 delay+reverb mix balance

### Phase 73: Per-Device Craft Optimization

**Goal:** Each device family's presets are optimized for its specific capabilities and constraints. Stomp presets maximize variety in 6 blocks, Pod Go presets intelligently prioritize in 4 effects, Helix presets leverage dual-DSP capacity, and craft guidance is encoded in both prompts and code.
**Depends on:** Phase 72 (combination rules should be stable before per-device tuning)
**Requirements:** CRAFT-01, CRAFT-02, CRAFT-03, CRAFT-04
**Success Criteria** (what must be TRUE):
  1. Stomp presets consistently produce 4-6 effects that maximize tonal variety within budget — not 2 effects leaving blocks unused
  2. Pod Go presets intelligently prioritize effects based on genre — delay and reverb both present for ambient, drive prioritized for rock
  3. Helix Floor/LT presets use richer effect chains than constrained devices — more creative routing, more effects
  4. Per-device craft is encoded in both planner prompts (creative direction) and chain-rules code (hard limit enforcement) — no prompt-only guidelines that can be violated
**Plans:** 2/2 plans complete

Plans:
- [ ] 73-01-PLAN.md — Genre-aware effect priority truncation in chain-rules.ts (CRAFT-02, CRAFT-04 code side)
- [ ] 73-02-PLAN.md — Per-device prompt craft optimization for Stomp, Pod Go, Helix (CRAFT-01, CRAFT-02, CRAFT-03, CRAFT-04 prompt side)

### Phase 74: Quality Validation

**Goal:** Every generated preset passes through a non-throwing quality validation gate that catches suboptimal parameter choices (over-wet reverb, missing cab filtering, snapshot level imbalance) and logs warnings for analysis. Per-device baselines ensure changes improve — not regress — preset quality.
**Depends on:** Phase 73 (validates complete output of all prior phases)
**Requirements:** QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. validatePresetQuality() with reverb Mix 0.80 returns non-empty QualityWarning[] without throwing — advisory, not blocking
  2. validatePresetQuality() with a well-formed clean preset returns empty array — no false positives
  3. Presets with quality warnings still download successfully — warnings are logged, never block the user
  4. Running 36-preset baseline generator before and after v6.0 shows measurable improvement in quality metrics
**Plans:** 2/2 plans complete

Plans:
- [ ] 75-01-PLAN.md — Chain-rules structural: COHERE-01 (drive palette balance), COHERE-02 (reverb auto-insert)
- [ ] 75-02-PLAN.md — Snapshot + types: COHERE-03 (boost slot disambiguation), COHERE-04 (dynamics compressor/gate split)
- [ ] 75-03-PLAN.md — Frontend + quality: COHERE-05 (block label accuracy), COHERE-06 (description cross-validation)

## Progress (v6.0)

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 70. Expression Pedal | 1/2 | In Progress|  | — |
| 71. Effect Intelligence | 2/2 | Complete   | 2026-03-07 | — |
| 72. Effect Combinations | 2/2 | Complete   | 2026-03-07 | — |
| 73. Per-Device Craft | 2/2 | Complete   | 2026-03-07 | — |
| 74. Quality Validation | 2/2 | Complete   | 2026-03-07 | — |
| 75. Preset Musical Coherence | 3/3 | Complete   | 2026-03-07 | — |
| 76. Block Budget Calibration | 2/2 | Complete   | 2026-03-07 | — |

### Phase 75: Preset Musical Coherence

**Goal:** Close the fidelity gap between AI creative descriptions and actual builder output. Presets must be musically coherent — effect palette balanced, snapshot tonal range wide, reverb present when described, boost/compressor behavior context-aware.

**Depends on:** Phase 72 (Effect Combinations), Phase 74 (Quality Validation)

**Root cause (Blackbird Arena analysis):** AI described "hall reverb throughout" and "pristine cleans" but .hsp had zero reverb blocks and 2 boost-classified drives permanently ON for CLEAN snapshot. 6 systemic issues: effect balance blindness, description-ToneIntent disconnection, boost always-on for user drives, comp/gate dynamics conflation, no reverb safety net, snapshot tonal range collapse.

**Requirements:**
- [ ] **COHERE-01**: Chain-rules enforce effect palette balance — max 2 user-selected drives; at least 1 time-based effect (delay or reverb) when preset has clean/ambient snapshots
- [ ] **COHERE-02**: Reverb soft-mandatory insertion — auto-insert genre-appropriate reverb (Plate default) when ToneIntent includes clean/ambient snapshot roles but no reverb effect
- [ ] **COHERE-03**: Boost model disambiguation — snapshot-engine distinguishes mandatory boost (chain-rules inserted, slot="boost") from AI-selected drive (user chose Minotaur/Scream 808 as effect); user-selected boosts follow distortion toggle rules, not always-on
- [ ] **COHERE-04**: Dynamics type split — separate "compressor" and "gate" block types in chain-rules, snapshot-engine, and frontend; compressor toggles OFF for high-gain lead/rhythm snapshots; gate remains always-on
- [ ] **COHERE-05**: Frontend block label accuracy — BLOCK_LABEL map distinguishes compressor ("Comp") from gate ("Gate") instead of blanket "Gate" for all dynamics
- [ ] **COHERE-06**: ToneIntent-description cross-validation — post-planner check warns when description mentions effects not present in ToneIntent.effects; logged as quality warning

**Success Criteria:**
- Blackbird Arena regeneration: reverb present, CLEAN snapshot fully drive-free, compressor shows as "Comp" not "Gate"
- No preset with clean/ambient snapshots ships without at least one reverb block
- AI-selected Minotaur/Scream 808 toggles OFF in clean snapshots (same as other drives)
- 36-preset baseline: zero regressions, measurable improvement in effect variety

**Plans:** 3/3 plans complete

Plans:
- [ ] 75-01-PLAN.md — Chain-rules structural: COHERE-01 (drive palette balance), COHERE-02 (reverb auto-insert)
- [ ] 75-02-PLAN.md — Snapshot + types: COHERE-03 (boost slot disambiguation), COHERE-04 (dynamics compressor/gate split)
- [ ] 75-03-PLAN.md — Frontend + quality: COHERE-05 (block label accuracy), COHERE-06 (description cross-validation)

### Phase 76: Device Block Budget Calibration

**Goal:** Audit and correct all device block/effect limits in DeviceCapabilities, chain-rules, prompts, and validation to match actual Line 6 hardware capabilities. Remove artificially conservative limits that prevent the AI from using available DSP capacity. Stadium should support 8+ user effects (not 4), Helix LT/Floor prompts should allow 8+ effects (not cap at 6), and Stomp maxEffectsPerDsp should reflect real slot availability.

**Depends on:** Phase 70 (basic pipeline must work; expression pedal wiring complete)

**Root cause analysis:**
- Stadium: `maxEffectsPerDsp=4` in DeviceCapabilities but prompt says "up to 6 effects" — chain-rules silently truncates 2 effects when AI follows the prompt. Real Stadium DSP supports far more.
- Helix LT/Floor: prompt tells AI `maxEffects: 6` but hardware supports 8+ effects per DSP path. Real users routinely build presets with 8-10 effects.
- Stomp: `maxEffectsPerDsp=2` in DeviceCapabilities but Stomp has 6 block slots (minus amp + cab = 4 user-effect slots). Planner.ts uses correct values but DeviceCapabilities doesn't match.
- Stomp XL: `maxEffectsPerDsp=5` — may be correct but needs hardware verification against 9-block capacity.
- Silent truncation in chain-rules (line ~390) drops effects with zero user visibility — effects just vanish.

**Requirements:**
- [ ] **BUDGET-01**: DeviceCapabilities `maxEffectsPerDsp` matches real hardware user-effect slot count for ALL families — verified against Line 6 specs
- [ ] **BUDGET-02**: Prompt-level `maxEffects` guidance matches DeviceCapabilities — no mismatch between what AI is told to generate and what chain-rules allows through
- [ ] **BUDGET-03**: Stadium block budget reflects actual DSP capacity — at least 8 user effects (not capped at 4)
- [ ] **BUDGET-04**: Helix LT/Floor prompt allows 8+ effects per DSP path — reflecting real usage patterns, not arbitrary conservative cap
- [ ] **BUDGET-05**: Chain-rules effect truncation logs a warning when effects are dropped — silent truncation becomes visible during development

**Success Criteria** (what must be TRUE):
  1. Generating a Stadium preset requesting 8 effects produces all 8 in the output — no silent truncation
  2. Generating a Helix LT preset requesting 8 effects produces all 8 — maxEffects prompt no longer caps at 6
  3. DeviceCapabilities.maxEffectsPerDsp matches the number of user-effect slots available on each physical device
  4. No mismatch between prompt maxEffects guidance and chain-rules enforcement — both use the same source of truth
  5. Silent truncation in chain-rules produces a logged warning so dropped effects are visible during development
**Plans:** 2/2 plans complete

Plans:
- [ ] 76-01-PLAN.md — Core value corrections (config, DeviceCapabilities, Zod schema, chain-rules warning, planner.ts) + TDD tests
- [ ] 76-02-PLAN.md — Prompt text corrections (Helix, Stadium, Stomp maxEffects) + alignment tests

---
*Last updated: 2026-03-06 after Phase 76 addition (device block budget calibration)*
*Full phase details for completed milestones archived in `.planning/milestones/`*
