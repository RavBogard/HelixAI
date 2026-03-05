# Roadmap: HelixAI

## Milestones

- [x] **v1.0 Full Rebuild** - Phases 1-6 (shipped 2026-03-02)
- [x] **v1.1 Polish & Precision** - Phases 7-11 (shipped 2026-03-02)
- [x] **v1.2 Pod Go Support** - Phases 12-16 (shipped 2026-03-02)
- [x] **v1.3 Rig Emulation** - Phases 17-21 (shipped 2026-03-02)
- [x] **v2.0 Persistent Chat Platform** - Phases 24-30 (shipped 2026-03-04)
- [x] **v3.0 Helix Stadium Support** - Phases 31-38 (shipped 2026-03-04)
- [ ] **v4.0 Preset Quality Leap** - Phases 42-51

## Phases

<details>
<summary>v1.0 Full Rebuild (Phases 1-6) — SHIPPED 2026-03-02</summary>

### Phase 1: Foundation
**Goal**: Every downstream component has verified, trustworthy contracts to build against
**Depends on**: Nothing (first phase)
**Requirements**: FNDN-01, FNDN-02, FNDN-03, FNDN-04, FNDN-05
**Success Criteria** (what must be TRUE):
  1. The expanded model database contains amp category metadata (clean/crunch/high-gain), cab affinities, and topology tags for all amps in the approved ID list
  2. The ToneIntent type compiles and constrains AI output to ~15 fields — no free-form parameter values
  3. Every @type block constant in BLOCK_TYPES has been verified against a real HX Edit .hlx export and any wrong values corrected
  4. LowCut and HighCut are required fields on the cab type — the TypeScript compiler rejects cab blocks missing these values
  5. The parameter type registry distinguishes Hz-valued fields (LowCut/HighCut), integer index fields (Mic), and normalized float fields (Drive/Master)
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — HlxCab required LowCut/HighCut + topology types in types.ts; ToneIntent Zod schema in tone-intent.ts (FNDN-02, FNDN-05)
- [x] 01-02-PLAN.md — param-registry.ts creation; models.ts BLOCK_TYPES fix + Hz cab defaults + amp topology/affinity metadata (FNDN-01, FNDN-03, FNDN-04)
- [x] 01-03-PLAN.md — index.ts barrel exports; validate.ts Mic range + Hz range fixes; full Phase 1 verification (FNDN-01–05)

### Phase 2: Knowledge Layer
**Goal**: Deterministic code encodes expert Helix knowledge — signal chain order, amp parameters, snapshot design — that AI cannot override
**Depends on**: Phase 1
**Requirements**: CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, CHAIN-05, CHAIN-06, TONE-01, TONE-02, TONE-03, TONE-04, TONE-05, TONE-06, SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05, DYN-01, DYN-02, DYN-03
**Success Criteria** (what must be TRUE):
  1. A generated PresetSpec always contains blocks in the correct order (Gate > Boost > Amp > Cab > EQ > Mod > Delay > Reverb) regardless of what the AI requested
  2. Every generated cab block has LowCut between 80-100 Hz and HighCut between 5-8 kHz — no cab block passes validation without these
  3. Every preset includes an always-on boost block (Minotaur for clean/crunch, Scream 808 for high-gain) that the engine inserts without AI involvement
  4. A preset loaded in the validator shows 4 snapshots (Clean, Rhythm, Lead, Ambient) with volume-balanced ChVol overrides — the lead snapshot is audibly +2-3 dB louder than clean
  5. Amp parameter defaults by category are deterministic: clean amps receive Master 9-10/Drive 2-3/SAG 5-7, high-gain amps receive Drive 3-5/Master 3-6/SAG 2-3
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — chain-rules.ts: signal chain assembly, mandatory block insertion, DSP assignment (CHAIN-01, CHAIN-02, CHAIN-03, CHAIN-04, CHAIN-05, CHAIN-06)
- [x] 02-02-PLAN.md — param-engine.ts: category-specific amp/cab/effect parameter resolution, topology-aware mid EQ (TONE-01, TONE-02, TONE-03, TONE-04, TONE-05, TONE-06, DYN-01, DYN-02, DYN-03)
- [x] 02-03-PLAN.md — snapshot-engine.ts: 4-snapshot generation, volume balancing, block state tables, barrel exports (SNAP-01, SNAP-02, SNAP-03, SNAP-04, SNAP-05)

### Phase 3: AI Integration
**Goal**: Claude Sonnet 4.6 generates creative model choices constrained to valid IDs — never numeric parameter values
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05
**Success Criteria** (what must be TRUE):
  1. The ToneIntent Zod schema exports a JSON Schema via z.toJSONSchema() that Claude's output_config uses — type definitions and AI schema share a single source of truth
  2. Claude generates a ToneIntent with a valid amp model ID from the enumerated list — an invalid ID causes a schema-level rejection, not a downstream auto-correction
  3. The Gemini chat interview phase is unchanged — Google Search grounding still fires for artist/rig research queries
  4. The Planner prompt asks for ~15 creative fields only; no prompt language asks Claude to supply Drive, Master, EQ, or other numeric parameter values
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Enum-constrained ToneIntentSchema (z.enum for model IDs) + Claude Planner module with structured output (AI-01, AI-02, AI-03, AI-05)
- [x] 03-02-PLAN.md — Generate route refactor to Planner -> Knowledge Layer pipeline; remove old multi-provider generation code; preserve Gemini chat (AI-04, AI-05)

### Phase 4: Orchestration
**Goal**: The full generation pipeline runs end-to-end and produces a downloadable .hlx file that loads on Helix hardware
**Depends on**: Phase 3
**Requirements**: HLX-01, HLX-02, HLX-03, HLX-04
**Success Criteria** (what must be TRUE):
  1. Submitting a tone request through the UI produces a downloadable .hlx file that loads on a Helix LT without errors
  2. Selecting Helix Floor in the device selector produces a .hlx file that loads on Helix Floor without errors
  3. A structural error in the preset spec (missing required field, out-of-range parameter) causes the generation route to return a clear error — not a silently auto-corrected file
  4. Snapshot block state keys in the downloaded .hlx are rebuilt programmatically from the final signal chain — not copied from AI output
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Device target support (LT/Floor) in buildHlxFile + strict validatePresetSpec + generate route wiring (HLX-01, HLX-02, HLX-03)
- [x] 04-02-PLAN.md — End-to-end orchestration tests: device IDs, strict validation, snapshot key rebuilding (HLX-01, HLX-02, HLX-03, HLX-04)

### Phase 5: Frontend Polish
**Goal**: The UI is polished, device-aware, and presents a single world-class preset download experience
**Depends on**: Phase 4
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Before generating, the user selects Helix LT or Helix Floor — the selected device ID is passed to the generation route
  2. The Warm Analog Studio aesthetic is intact and the UI presents no visual regressions from the current design
  3. The chat interview flow using Gemini with Google Search grounding works end-to-end from conversation to preset download
  4. The generation screen presents a single download button for one world-class preset — no multi-provider comparison UI is visible
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — Refactor page.tsx: remove multi-provider UI, add device selector, single preset card, update footer/branding (UX-01, UX-02, UX-03, UX-04)
- [x] 05-02-PLAN.md — Delete dead provider code (providers.ts, /api/providers route), clean orphaned CSS, visual verification checkpoint (UX-02, UX-04)

### Phase 6: Hardening
**Goal**: The system is verified against real hardware and the known "looks done but isn't" failure modes are closed before launch
**Depends on**: Phase 5
**Requirements**: (No v1 requirements — see note below)
**Success Criteria** (what must be TRUE):
  1. A preset generated for Helix LT loads and plays on real Helix LT hardware with audibly professional tone — not muddy, not thin, mix-ready
  2. Generation fails with a clear error rather than producing a broken preset when a DSP block limit (8 non-cab blocks per DSP) would be exceeded
  3. The firmware version is read from a config value — changing it does not require a code change
  4. The openai package has been removed from package.json and no generation code references it
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md — Firmware version parameterization to config.ts + openai package removal (SC-3, SC-4)
- [x] 06-02-PLAN.md — DSP block limit error path test + hardware verification checkpoint on real Helix LT (SC-1, SC-2)

**Phase 6 Note:** All v1 requirements are fully covered in Phases 1-5 (36/36). Phase 6 addresses launch readiness concerns surfaced by research (hardware verification, firmware parameterization, DSP limit enforcement, openai cleanup) that are prerequisites for a production-quality launch but were categorized as v2 infrastructure in REQUIREMENTS.md. These are elevated for this milestone because they gate the core value: presets that actually sound good on real hardware.

</details>

<details>
<summary>v1.1 Polish & Precision (Phases 7-11) — SHIPPED 2026-03-02</summary>

#### Phase 7: Hardware Bug Fixes and .hlx Audit
**Goal**: Presets respond correctly to hardware on first press and the .hlx format is verified against real HX Edit exports
**Depends on**: Phase 6
**Requirements**: HW-01, HW-02, HW-03
**Success Criteria** (what must be TRUE):
  1. A stomp assigned to a footswitch activates on the first press — no double-press required on Helix LT hardware
  2. Pedal LEDs on each snapshot reflect the active stomp states for that snapshot — the Clean snapshot shows clean LEDs and the Lead snapshot shows appropriate drive LEDs
  3. A systematic diff of generated .hlx output against real HX Edit exports has been completed and any field mismatches in the generated file have been corrected or documented as known limitations
  4. The `@pedalstate` bitmask computation is either derived from empirically verified HX Edit exports or explicitly documented as a known limitation with the hardcoded value retained
**Plans**: 2 plans

Plans:
- [x] 07-01-PLAN.md — .hlx audit: export real HX Edit presets, diff against generated output, document field mismatches; fix @fs_enabled in buildFootswitchSection() (HW-01, HW-03)
- [x] 07-02-PLAN.md — @pedalstate bitmask: empirically map bit positions from HX Edit exports, implement computeFootswitchAssignments(), or document hardcode limitation (HW-02)

#### Phase 8: Prompt Caching
**Goal**: API input token costs are reduced ~50% via system prompt caching with no effect on preset output quality
**Depends on**: Phase 7
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. On the second identical generation request in a session, `usage.cache_read_input_tokens` is greater than zero in the API response — confirming cache hits are occurring
  2. The first generation request shows `cache_creation_input_tokens > 1024` — confirming the system prompt meets the minimum cacheable size
  3. Preset output is identical before and after caching is added — no degradation in generated ToneIntent quality
**Plans**: 1 plan

Plans:
- [x] 08-01-PLAN.md — Add cache_control: { type: "ephemeral" } to system prompt in callClaudePlanner(); audit system prompt for dynamic content that would bust cache; verify cache metrics (PERF-01)

#### Phase 9: Genre-Aware Effect Defaults
**Goal**: Delay time, reverb mix, and modulation rate in generated presets are tuned to the detected genre rather than applying identical defaults to every request
**Depends on**: Phase 8
**Requirements**: INTL-01
**Success Criteria** (what must be TRUE):
  1. A blues/rock preset has a slapback-style delay (short time, low mix) and a metal preset has minimal delay mix — the difference is audible and intentional, not accidental
  2. An ambient preset has reverb mix in the 40-60% range — noticeably wetter than a clean jazz preset which stays under 25%
  3. Genre string matching uses substring lookup with an explicit fallback to model defaults — an unrecognized genre hint does not cause an error or silent parameter corruption
  4. Genre defaults are applied as the outermost resolution layer — they override model defaults and category defaults, never the other way around
**Plans**: 1 plan

Plans:
- [x] 09-01-PLAN.md — Inspect models.ts delay/reverb/modulation defaultParams encoding; build GENRE_EFFECT_DEFAULTS lookup table; wire into param-engine.ts as outermost resolution layer (INTL-01)

#### Phase 10: Smarter Snapshot Effect Toggling
**Goal**: Snapshot block states reflect musical intent — the ambient snapshot enables time-based effects at boosted mix and the clean snapshot disables drive blocks
**Depends on**: Phase 9
**Requirements**: INTL-02
**Success Criteria** (what must be TRUE):
  1. The Ambient snapshot has reverb and delay enabled with Mix values elevated above the base genre default — the snapshot sounds noticeably wetter than Rhythm
  2. The Clean snapshot has all drive-type effect blocks disabled — no overdrive or distortion pedal is active in the clean snapshot
  3. All snapshot toggling logic lives in getBlockEnabled() and buildSnapshots() in snapshot-engine.ts — SnapshotIntentSchema has gained zero new AI output fields
  4. Existing snapshot-engine unit tests pass without modification after the changes are applied
**Plans**: 1 plan

Plans:
- [x] 10-01-PLAN.md — Extend getBlockEnabled() with intentRole-based toggling; add ambient Mix overrides in buildSnapshots(); integration-test genre defaults + snapshot toggling in combination (INTL-02)

#### Phase 11: Frontend Transparency
**Goal**: Users can see the signal chain and read a plain-language description of their preset before downloading
**Depends on**: Phase 10
**Requirements**: FXUI-01, FXUI-02, BRAND-01
**Success Criteria** (what must be TRUE):
  1. After generation and before download, a horizontal read-only signal chain visualization shows each block (amp, cab, effects) in order with their enabled states visible
  2. A tone description card displays the preset name, amp/cab pair, all four snapshot names with distinguishable colors, and guitar-specific playing notes
  3. A "Project of Daniel Bogard" footer with a working link to danielbogard.com appears on all pages
  4. The signal chain visualization loads without SSR errors and does not block page render if the visualization data is unavailable
**Plans**: 2 plans

Plans:
- [x] 11-01-PLAN.md — Install @xyflow/react 12.10.1; build viz.ts pure function; add signalChainViz to API response; build SignalChainViz React component with next/dynamic SSR guard (FXUI-01)
- [x] 11-02-PLAN.md — Build ToneDescriptionCard component from existing API response data; add danielbogard.com footer to all pages (FXUI-02, BRAND-01)

</details>

<details>
<summary>v1.2 Pod Go Support (Phases 12-16) — SHIPPED 2026-03-02</summary>

### Phase 12: Format Foundation and Types
**Goal**: Every downstream Pod Go component has verified type contracts and format constants to build against — no guesswork on device IDs, block types, or file structure
**Depends on**: Phase 11
**Requirements**: PGP-01, PGP-02, PGP-03, PGP-04, PGP-05

### Phase 13: Pod Go Model Catalog
**Goal**: The model registry knows which amps and effects are available on Pod Go, with correct Mono/Stereo suffixed IDs, so the AI planner never offers an unavailable model
**Depends on**: Phase 12
**Requirements**: PGMOD-01, PGMOD-02, PGMOD-03, PGMOD-04

### Phase 14: Chain Rules, Validation, and Planner
**Goal**: Signal chain assembly enforces Pod Go's single-DSP, 4-effect-block constraint, the validator catches Pod Go-specific errors, and the AI planner generates Pod Go-appropriate creative choices
**Depends on**: Phase 13
**Requirements**: PGCHAIN-01, PGCHAIN-02, PGCHAIN-03

### Phase 15: Pod Go Preset Builder
**Goal**: The builder produces a valid .pgp file that loads in Pod Go Edit without errors, with 4 volume-balanced snapshots and the same professional tone quality as Helix presets
**Depends on**: Phase 14
**Requirements**: PGSNAP-01, PGSNAP-02, PGQUAL-01, PGQUAL-02

### Phase 16: Integration, UI, and Testing
**Goal**: Pod Go is fully wired into the application — selectable in the UI, generating downloadable .pgp files, and verified end-to-end with no Helix regressions
**Depends on**: Phase 15
**Requirements**: PGUX-01, PGUX-02, PGUX-03

</details>

<details>
<summary>v1.3 Rig Emulation (Phases 17-21) — SHIPPED 2026-03-02</summary>

### Phase 17: Schemas & Types Foundation
**Goal**: All new type contracts for v1.3 are defined and exported — downstream phases build on verified, compiled schemas with no guesswork on data shapes
**Depends on**: Phase 16
**Requirements**: RIG-06
**Success Criteria** (what must be TRUE):
  1. `PhysicalPedalSchema` compiles with Zod and includes: `brand`, `model`, `fullName`, `knobPositions` (as a `Record<string, "low" | "medium-low" | "medium-high" | "high">` or clock-position description), `imageIndex`, and `confidence: "high" | "medium" | "low"`
  2. `RigIntentSchema` compiles and wraps an array of `PhysicalPedal` entries plus optional `rigDescription` (plain text) and `extractionNotes` fields — the schema can represent both photo-extracted and text-described rigs
  3. `SubstitutionEntrySchema` compiles with: `physicalPedal` (string), `helixModel` (internal ID), `helixModelDisplayName` (human-readable name from models.ts), `substitutionReason` (plain English rationale), `parameterMapping` (optional knob zone overrides), and `confidence: "direct" | "close" | "approximate"`
  4. `SubstitutionMapSchema` compiles as a wrapper around an array of `SubstitutionEntry` entries — represents the full pedal → Helix mapping result for a rig
  5. All new schemas are exported from `src/lib/helix/index.ts` — downstream phases import types from the existing barrel without new import paths
  6. TypeScript compiler produces zero errors after schema additions — no conflicts with existing ToneIntent, PresetSpec, or DeviceTarget types
**Plans**: 1 plan

Plans:
- [x] 17-01-PLAN.md — rig-intent.ts: PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema + barrel exports in index.ts (RIG-06)

### Phase 18: Pedal Mapping Engine
**Goal**: The deterministic rig mapping layer converts physical pedal names to Helix equivalents with three match tiers and coarse knob zone translation — no AI guessing in the mapping logic
**Depends on**: Phase 17
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Success Criteria** (what must be TRUE):
  1. `PEDAL_HELIX_MAP` in `src/lib/rig-mapping.ts` contains at least 40 entries covering the most common pedal categories
  2. `lookupPedal(pedalName: string, device: DeviceTarget)` returns a `SubstitutionEntry` with the correct `confidence` tier
  3. For an unknown boutique pedal not in the table, `lookupPedal()` returns `confidence: "approximate"` — never `confidence: "direct"` for a pedal that required fuzzy/category fallback
  4. The mapping table stores both `helixModel` (internal ID) and `helixModelDisplayName` (human-readable name) — no internal IDs leak to the display layer
  5. `mapRigToSubstitutions(rigIntent, device)` returns a `SubstitutionMap` with device-appropriate model IDs
  6. Unit tests confirm exact-table-match pedals return `"direct"` and unknown pedals do not
**Plans**: 1 plan

Plans:
- [x] 18-01-PLAN.md — rig-mapping.ts: PEDAL_HELIX_MAP (53 entries), lookupPedal() three-tier logic, mapRigToSubstitutions(); rig-mapping.test.ts (MAP-01, MAP-02, MAP-03, MAP-04, MAP-05)

### Phase 19: Vision Extraction API
**Goal**: Claude Vision extracts pedal identifications and coarse knob zones from user-uploaded photos via an isolated `/api/vision` route — client-side compression keeps all uploads within Vercel's 4.5MB limit and the existing generation pipeline is completely unaffected
**Depends on**: Phase 17
**Requirements**: RIG-01, RIG-02, RIG-03, VIS-01, VIS-02, VIS-03, VIS-04, API-01
**Plans**: 1 plan

Plans:
- [x] 19-01-PLAN.md — /api/vision route: image upload, Claude Vision extraction, RigIntent response; client-side compression; upload UI in page.tsx (RIG-01, RIG-02, RIG-03, VIS-01, VIS-02, VIS-03, VIS-04, API-01)

### Phase 20: Planner Integration & Route Orchestration
**Goal**: The Planner accepts rig context through the user messages array without breaking prompt caching, the generate route orchestrates vision → mapping → planner cleanly, and text rig descriptions work end-to-end without any image upload
**Depends on**: Phase 18, Phase 19
**Requirements**: RIG-04, RIG-05, PLAN-01, PLAN-02, PLAN-03, API-02, API-03
**Plans**: 1 plan

Plans:
- [x] 20-01-PLAN.md — callClaudePlanner() optional toneContext param; /api/generate rig orchestration path; text rig parsing; vision failure fallback (RIG-04, RIG-05, PLAN-01, PLAN-02, PLAN-03, API-02, API-03)

### Phase 21: Substitution Card & End-to-End Polish
**Goal**: The substitution mapping is visible and readable before preset generation, progressive loading states guide users through the multi-step flow, all three devices work end-to-end with rig emulation, and no regressions exist in the existing non-rig generation path
**Depends on**: Phase 20
**Requirements**: SUBST-01, SUBST-02, SUBST-03, SUBST-04, PROGUX-01, PROGUX-02
**Plans**: 1 plan

Plans:
- [x] 21-01-PLAN.md — SubstitutionCard component; progressive loading states; Pod Go device verification; regression test text-only flow (SUBST-01, SUBST-02, SUBST-03, SUBST-04, PROGUX-01, PROGUX-02)

</details>

<details>
<summary>v2.0 Persistent Chat Platform (Phases 24-30) — SHIPPED 2026-03-04</summary>

- [x] Phase 24: Supabase Foundation — DB schema, RLS, client utilities, middleware, keep-alive (3 plans, complete 2026-03-03)
- [x] Phase 25: Auth Flow — Anonymous sign-in + Google OAuth + identity linking (2 plans, complete 2026-03-03)
- [x] Phase 26: Conversation CRUD API — Full data API for conversations + messages (2 plans, complete 2026-03-03)
- [x] Phase 27: Persistence Wiring — chat/generate routes persist messages and preset files (2 plans, complete 2026-03-03)
- [x] Phase 28: Chat Sidebar UI + UX Polish — Sidebar panel, resume flow, new chat, sign-in prompt (3 plans, complete 2026-03-03)
- [x] Phase 29: Dual-Amp Preset Generation Fix — AB topology, split/join blocks, independent params (3 plans, complete 2026-03-04)
- [x] Phase 30: Chat Auto-Save on First AI Response — auto-save on first AI response, deferred sidebar refresh (1 plan, complete 2026-03-04)

Full archive: `.planning/milestones/v2.0-ROADMAP.md`

</details>

## Phase Details

> v2.0 phase details (Phases 24-30) archived to `.planning/milestones/v2.0-ROADMAP.md`

<details>
<summary>v3.0 Helix Stadium Support (Phases 31-38) — SHIPPED 2026-03-04</summary>

### Phase 31: Device ID Research + Helix Floor Regression Fix
**Goal**: Ground all Stadium implementation in verified hardware data, and fix the live Helix Floor device ID regression before adding a third device
**Depends on**: Phase 30 (v2.0 complete)
**Requirements**: FIX-01, STAD-02 (partial — device ID verification protocol)
**Success Criteria** (what must be TRUE):
  1. A real `.hsp` file has been opened and its `data.device` integer is documented in a source comment in `types.ts` — no guessing
  2. `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt` — the regression is fixed; the constant includes a source comment
  3. The test at `orchestration.test.ts:93` passes with the corrected Floor device ID
  4. `xxd file.hsp | head -20` result is documented — confirms JSON vs msgpack encoding decision
**Plans**: 2 plans

Plans:
- [ ] 31-01-PLAN.md — Restore helix_floor device ID to 2162691 with source comment; full test suite green (FIX-01)
- [ ] 31-02-PLAN.md — Inspect real .hsp file; document data.device integer and .hsp version constants for Phase 32 (STAD-02)

### Phase 32: Type System Foundation
**Goal**: The TypeScript type system knows about Stadium — `DeviceTarget`, `DEVICE_IDS`, config constants, and file extension handling all cover Stadium; compiler exhaustiveness errors surface every unimplemented handler
**Depends on**: Phase 31 (device ID confirmed)
**Requirements**: STAD-02, NFR-04
**Success Criteria** (what must be TRUE):
  1. `DeviceTarget` union includes `"helix_stadium"` — adding it causes TypeScript exhaustiveness errors in every switch/if-else that doesn't handle Stadium; these errors become the Phase 32-38 integration checklist
  2. `DEVICE_IDS.helix_stadium` is set to the confirmed integer from Phase 31 with source comment
  3. `config.ts` has `STADIUM_MAX_BLOCKS_PER_PATH = 12` and `STADIUM_MAX_SNAPSHOTS = 8` constants
  4. `npm run build` passes with no type errors after type system changes
**Plans**: 1 plan
- [x] 32-01-PLAN.md — DeviceTarget + DEVICE_IDS + STADIUM_CONFIG + isStadium() + 501 stub in /api/generate (STAD-02, NFR-04)

### Phase 33: Stadium Model Catalog
**Goal**: The planner has a curated, Stadium-specific model catalog — Agoura amps, Stadium-compatible effects, and Stadium EQ — and Stadium models are excluded from LT/Floor/Pod Go planner prompts
**Depends on**: Phase 31 (`.hsp` inspection confirms model ID prefixes)
**Requirements**: STAD-03
**Success Criteria** (what must be TRUE):
  1. `STADIUM_AMPS` in `models.ts` contains at least 10 `Agoura_*` entries verified against the Stadium firmware model list
  2. `STADIUM_EFFECTS` includes the 7-band Parametric EQ model ID; Simple EQ, Low/High Cut, Low/High Shelf, and Parametric 5-band are NOT in the Stadium catalog
  3. `getModelsForDevice("helix_stadium")` returns Stadium-only models; `getModelsForDevice("helix_lt")` returns no `Agoura_*` entries
  4. Planner prompt for Stadium references only Stadium model IDs — no cross-contamination with HD2/P34 models
**Plans**: 1 plan
- [x] 33-01-PLAN.md — STADIUM_AMPS (12 Agoura entries), STADIUM_EQ_MODELS, stadiumOnly flag, getModelListForPrompt() Stadium path, isModelAvailableForDevice() Stadium logic (STAD-03)

### Phase 34: Stadium Chain Rules + Validation
**Goal**: Signal chain assembly and validation work correctly for Stadium — path structure, block limits, and mandatory blocks all use Stadium-specific constants and model IDs
**Depends on**: Phase 32, Phase 33
**Requirements**: STAD-04
**Success Criteria** (what must be TRUE):
  1. `assembleSignalChain(intent, "helix_stadium")` returns a chain with Stadium-compatible mandatory block model IDs (noise gate, boost, EQ using Stadium variants)
  2. Block count is capped at `STADIUM_MAX_BLOCKS_PER_PATH` (not `MAX_BLOCKS_PER_DSP`) — the constant name is different in code
  3. `validatePresetSpec(spec, "helix_stadium")` rejects any block using a non-Stadium model ID with a descriptive error
  4. Single-path (Path 1A) generation is the only supported topology for Stadium in v3.0 — multi-path validation not required
**Plans**: 1 plan
- [x] 34-01-PLAN.md — Stadium chain rules (Agoura amp lookup, Stadium 7-band EQ mandatory, 12-block limit), validate.ts Stadium branch, getAllModels() includes Stadium catalogs (STAD-04)

### Phase 35: Stadium Builder
**Goal**: `stadium-builder.ts` produces valid `.hsp` files using the structure confirmed from Phase 31 inspection — `preset-builder.ts` and `podgo-builder.ts` are untouched
**Depends on**: Phase 32, Phase 34
**Requirements**: STAD-05
**Success Criteria** (what must be TRUE):
  1. `buildHspFile(spec)` returns an object with `data.device === DEVICE_IDS.helix_stadium` and the same literal integer value in the test assertion
  2. The generated `.hsp` file imports into the Helix Stadium app (or Stadium native app) without errors — confirmed with one real import test
  3. `summarizeStadiumPreset(spec)` returns a human-readable description of the tone
  4. `stadium-builder.ts` is exported from `index.ts` barrel; `preset-builder.ts` and `podgo-builder.ts` are unmodified (git diff shows no changes to those files)
**Plans**: 1 plan
- [x] 35-01-PLAN.md — stadium-builder.ts: buildHspFile() (rpshnosj header, meta+preset, b00..bNN blocks, P35_* I/O, 8 snapshots), summarizeStadiumPreset(), index.ts barrel exports (STAD-05)

### Phase 36: Planner + API Route Integration
**Goal**: The full generate pipeline works end-to-end for Stadium — planner selects Stadium models, `/api/generate` routes to `buildHspFile`, response includes `.hsp` payload and extension, Supabase storage uses `latest.hsp`
**Depends on**: Phase 33, Phase 35
**Requirements**: STAD-06
**Success Criteria** (what must be TRUE):
  1. POST `/api/generate` with `{ device: "helix_stadium" }` returns `{ fileExtension: ".hsp", ... }` with a valid `.hsp` payload — no 500 errors, no fallback to `.hlx`
  2. The planner prompt sent to Claude contains only Stadium-compatible model IDs when `device === "helix_stadium"`
  3. Supabase Storage receives the file at `presets/{user_id}/{conversation_id}/latest.hsp` (not `.hlx`)
  4. Helix LT and Pod Go generation are completely unaffected — existing integration tests pass without modification
**Plans**: 1 plan
- [x] 36-01-PLAN.md — /api/generate Stadium path: buildHspFile(), Supabase latest.hsp upload, fileExtension=".hsp" response (STAD-06)

### Phase 37: UI — Device Selector + Download
**Goal**: Users can select Helix Stadium in the device picker and download the generated `.hsp` file — both device selector arrays in `page.tsx` are updated; download and badge show "STADIUM"
**Depends on**: Phase 36 (hardware validation confirmed)
**Requirements**: STAD-07
**Success Criteria** (what must be TRUE):
  1. The device selector shows "STADIUM" as a fourth option — selecting it sets `selectedDevice = "helix_stadium"` and the badge shows "STADIUM"
  2. Clicking "Download Preset" after Stadium generation downloads `HelixAI_[Name]_Stadium.hsp`
  3. Resuming a Stadium conversation downloads the stored `.hsp` from Supabase without regenerating
  4. "Generate for other device" chip correctly excludes Stadium as the alternate when Stadium is selected, and includes Stadium as an option when other devices are selected
  5. Both device arrays in `page.tsx` (~line 1275-1277 and ~line 1365-1367) are updated — neither is missed
**Plans**: 1 plan
- [x] 37-01-PLAN.md — page.tsx: both device arrays grid-cols-4 + Stadium entry, badge STADIUM case, download suffix _Stadium/.hsp, otherDevice chip logic (STAD-07)

### Phase 38: Rig Emulation for Stadium
**Goal**: Rig emulation (pedal photo + text description) works with Stadium selected — `mapRigToSubstitutions` accepts `"helix_stadium"`, `/api/map` routes correctly, and the substitution card shows Stadium-compatible model names
**Depends on**: Phase 37
**Requirements**: STAD-08
**Success Criteria** (what must be TRUE):
  1. Uploading a pedal photo with Stadium selected returns a substitution card with Stadium-compatible Helix model names (no HD2-only models)
  2. `/api/map` returns 200 (not 400/500) when `device: "helix_stadium"` is passed
  3. `mapRigToSubstitutions(rigIntent, "helix_stadium")` does not throw — Stadium substitutions prefer Agoura amps where applicable
  4. Rig emulation for Helix LT, Helix Floor, and Pod Go is completely unaffected — all three existing rig flows pass verification
**Plans**: 1 plan
- [x] 38-01-PLAN.md — rig-mapping.test.ts STAD-08 tests: helix_stadium does not throw, HD2_ IDs, direct confidence, no Agoura in effects, regression for LT/Floor/PodGo (STAD-08)

</details>

<details>
<summary>Phases 39-41 (HX Stomp, Rebrand, Chat UX) — SHIPPED 2026-03-04</summary>

### Phase 39: HX Stomp & HX Stomp XL Support

**Goal:** Users can generate presets for HX Stomp (`helix_stomp`, 2162694) and HX Stomp XL (`helix_stomp_xl`, 2162699) — both output standard `.hlx` files using the same `data.*` structure as LT/Floor but with Stomp-specific I/O models, block limits, and snapshot counts; existing devices unaffected
**Depends on:** Phase 38
**Requirements**: STOMP-01, STOMP-02, STOMP-03, STOMP-04, STOMP-05, STOMP-06, STOMP-07, STOMP-08, STOMP-09, STOMP-10
**Success Criteria** (what must be TRUE):
  1. `DEVICE_IDS.helix_stomp === 2162694` and `DEVICE_IDS.helix_stomp_xl === 2162699` — both confirmed from real hardware exports; both differ from each other and from LT/Floor/Pod Go/Stadium
  2. `buildStompFile(spec, "helix_stomp")` produces a `.hlx` file capped at 6 blocks, 3 snapshots, using `HelixStomp_AppDSPFlowInput` and `HelixStomp_AppDSPFlowOutputMain` I/O models
  3. `buildStompFile(spec, "helix_stomp_xl")` produces a `.hlx` file capped at 9 blocks, 4 snapshots, with the same I/O model prefix
  4. Generated `.hlx` files import into HX Edit without errors — hardware device ID validated
  5. UI shows "STOMP" and "STOMP XL" device options; downloads named `HelixAI_[Name]_Stomp.hlx` and `HelixAI_[Name]_StompXL.hlx` respectively
  6. Helix LT, Helix Floor, Pod Go, and Helix Stadium generation are completely unaffected
**Plans:** 3/3 plans complete

Plans:
- [x] 39-01-PLAN.md — Type system + config constants + stomp-builder.ts + chain-rules + validate + models + index barrel + tests (STOMP-01, STOMP-02, STOMP-03, STOMP-04, STOMP-05, STOMP-10)
- [x] 39-02-PLAN.md — /api/generate Stomp routing + rig-mapping Stomp support + end-to-end pipeline tests (STOMP-06, STOMP-08, STOMP-09)
- [x] 39-03-PLAN.md — page.tsx: both device pickers + download suffix + badge + otherDevice chip (STOMP-07)

### Phase 40: Rebrand HelixAI to HelixTones

**Goal:** Rename all user-visible "HelixAI" strings and internal cross-file event/storage contracts to "HelixTones"/"helixtones" — browser title, logo alt text, wordmark, AI persona names, download filenames, DOM custom events, sessionStorage key, and package name
**Requirements**: REBRAND-01, REBRAND-02, REBRAND-03, REBRAND-04
**Depends on:** Phase 39
**Plans:** 1/1 plans complete

Plans:
- [x] 40-01-PLAN.md — All categories A-E: layout.tsx title, page.tsx UI strings + filenames + events + storage key, gemini.ts + planner.ts persona, package.json name, supabase/schema.sql comment (REBRAND-01, REBRAND-02, REBRAND-03, REBRAND-04)

### Phase 41: Chat UX — device selection timing and pre-preset conversation flow

**Goal:** Device picker only appears after AI signals readiness via [READY_TO_GENERATE]; AI requires at least one follow-up exchange before signaling — producing a richer musical conversation before preset generation
**Requirements**: CHATUX-01, CHATUX-02
**Depends on:** Phase 40
**Plans:** 1/1 plans complete

Plans:
- [x] 41-01-PLAN.md — page.tsx picker condition + gemini.ts prompt rewrite (CHATUX-01, CHATUX-02)

</details>

### v4.0 Preset Quality Leap (Phases 42-51)

**Milestone Goal:** Close the gap between HelixTones-generated presets and the best custom/commercial presets; audit and optimize API costs; restore footer, add Variax support, and integrate donation flow.

- [x] **Phase 42: Token Cost Audit + Quality Baseline** - Instrument API usage, establish reproducible 36-preset baseline, measure cache effectiveness (completed 2026-03-05)
- [ ] **Phase 43: Planner Prompt Quality** - Add gain-staging, cab pairing, and effect discipline rules to the planner prompt; regression test against baseline
- [ ] **Phase 44: Knowledge Layer — Amp Parameters** - ampFamily classification, per-model parameter overrides, Master Volume strategy, cab affinity data
- [ ] **Phase 45: Knowledge Layer — Effects, EQ, Snapshots** - Guitar-type EQ, reverb PreDelay scaling, tempo-scaled delay, snapshot volume balancing
- [ ] **Phase 46: Effect Combination Intelligence** - Effect interaction parameter adjustments, genre block substitution table, cross-device validation
- [ ] **Phase 47: Model Routing Decision** - Evidence-based analysis of whether the current model split is optimal; no changes without quality evidence
- [x] **Phase 48: Footer Restoration & Fixed Positioning** - Pin footer to viewport bottom on all screens; "A Project of Daniel Bogard" linking to DanielBogard.com (completed 2026-03-05)
- [x] **Phase 49: Variax Guitar Support** - Reactive Variax detection in chat, ToneIntent schema, .hlx block injection, device guard (completed 2026-03-05)
- [x] **Phase 50: Donation/Support Integration** - Post-download donation card, PayPal/Venmo/CashApp buttons, footer Support link (completed 2026-03-05)
- [x] **Phase 51: Fix Stadium Agoura amp lookup** - assembleSignalChain Stadium amp resolution fix (completed 2026-03-05)

### Phase 42: Token Cost Audit + Quality Baseline
**Goal**: Every subsequent v4.0 phase has measurable cost data and a reproducible quality baseline to validate changes against — no blind optimization, no untested prompt changes
**Depends on**: Phase 41
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. After 10 test generations, a summary script reports average prompt tokens, completion tokens, total tokens, cached tokens, and cost estimate per call for both `/api/chat` and `/api/generate` endpoints
  2. Running the baseline suite produces 36 preset files (6 tones x 6 devices) with deterministic ToneIntent snapshots that can be diffed against future v4.0 changes
  3. A cache hit rate report across 20+ generations shows what percentage of planner calls hit the prompt cache vs. cold starts, with specific optimization recommendations if the rate is below 50%
  4. The token logging is behind a `LOG_USAGE` environment flag and does not affect production performance when disabled
**Plans**: 2 plans

Plans:
- [ ] 42-01-PLAN.md — usage-logger.ts utility + planner.ts/chat route integration + summary script (AUDIT-01)
- [ ] 42-02-PLAN.md — 36-preset deterministic baseline generator + cache hit rate report (AUDIT-02, AUDIT-03)

### Phase 43: Planner Prompt Quality
**Goal**: The planner makes smarter creative decisions about gain staging, amp/cab pairing, and effect selection — without any Knowledge Layer or schema changes
**Depends on**: Phase 42 (baseline required for regression testing)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04
**Success Criteria** (what must be TRUE):
  1. An "edge-of-breakup blues" preset uses appropriate boost level relative to amp drive setting — no unnecessary gain stacking on a clean amp
  2. Generated presets consistently pair amp and cab models following real-world conventions (Fender with open-back 1x12/2x12, Marshall with closed-back 4x12, Mesa with oversized 4x12) unless the user explicitly requests otherwise
  3. No generated preset contains two delays or two reverbs unless the tone description explicitly calls for it, and reverb is always placed after delay in the signal chain
  4. A regression test suite run against the 6 baseline tone scenarios catches obvious planner mistakes (wrong amp category, missing expected effects, illogical combinations) with >90% accuracy
  5. Total planner system prompt token count has not increased by more than 30% compared to the Phase 42 baseline measurement
**Plans**: TBD

### Phase 44: Knowledge Layer — Amp Parameters
**Goal**: The param engine resolves amp parameters per-model rather than per-category — Fender Master is maxed, Mesa Master is conservative, and each popular amp gets Tonevault-derived defaults instead of flat category averages
**Depends on**: Phase 43 (improved planner decisions feed better inputs to the param engine)
**Requirements**: AMP-01, AMP-02, AMP-03, AMP-04
**Success Criteria** (what must be TRUE):
  1. Every amp model in models.ts has an `ampFamily` value (`fender`, `vox`, `marshall`, `mesa`, `modern_high_gain`, `boutique_clean`, `boutique_drive`) and `getAmpFamilyDefaults(family)` returns a parameter strategy object
  2. `resolveAmpParams("US DLX Nrm", "clean")` returns Master >= 0.85, and `resolveAmpParams("Revv Gen Red", "high_gain")` returns Drive and Presence values that show inverse correlation — per-model overrides are not stomped by category defaults
  3. A clean Fender preset has Master > 0.8 and a high-gain Mesa preset has Master < 0.6 — amp-family-aware Master Volume logic is audibly correct
  4. `getPreferredCabs("US DLX Nrm")` returns cab models appropriate for Fender amps, and at least 10 amp models have populated `cabAffinity` data
  5. All 6 devices produce valid presets after amp parameter changes — no device-specific validation errors
**Plans**: TBD

### Phase 45: Knowledge Layer — Effects, EQ, Snapshots
**Goal**: Effect parameters are context-sensitive — EQ adapts to pickup type, reverb PreDelay scales with tempo, delay time uses musical subdivisions, and lead snapshots cut through the mix
**Depends on**: Phase 43 (improved planner decisions feed better inputs to the param engine)
**Requirements**: FX-01, FX-02, FX-03, FX-04
**Success Criteria** (what must be TRUE):
  1. The same tone description with `guitarType: "singlecoil"` vs `"humbucker"` produces measurably different EQ settings — single-coils get less treble cut, humbuckers get tighter low-end
  2. A "fast punk rock" preset has reverb PreDelay < 40ms and a "slow ambient pad" preset has PreDelay > 60ms — PreDelay scales with tempo context
  3. A "country chicken pickin'" preset has delay time corresponding to a musical subdivision of ~120 BPM rather than a generic fixed millisecond value
  4. In a 4-snapshot preset, the Lead snapshot Channel Volume is measurably higher than Rhythm, and Clean is slightly lower — all within musical range (no absurd jumps)
  5. All 6 devices produce valid presets after effect parameter changes — no device-specific validation errors
**Plans**: TBD

**Phases 44 and 45 Note:** These phases can be developed in parallel (ampFamily work in models.ts/param-engine.ts is independent of EQ/reverb/snapshot table extensions) but should deploy together to minimize prompt cache invalidation events. A single batched deployment preserves cache efficiency.

### Phase 46: Effect Combination Intelligence
**Goal**: When multiple effects are present in a preset, their parameters are adjusted for synergy rather than treated independently — and genre-appropriate effect choices are enforced across all 6 devices
**Depends on**: Phase 44, Phase 45 (Layer 5 combo adjustments must sit on top of correct base parameter values)
**Requirements**: COMBO-01, COMBO-02, COMBO-03
**Success Criteria** (what must be TRUE):
  1. A preset with compressor + overdrive has lower compressor output than a preset with compressor alone — at least 3 effect interaction rules fire correctly and are verified by unit tests
  2. A "jazz" tone never includes a distortion pedal unless explicitly requested, and a "metal" tone always includes a noise gate — genre block substitution is enforced
  3. The 36-preset baseline (AUDIT-02) regenerated after all v4.0 changes produces valid presets for all 6 devices with zero validation errors — Pod Go's 4-effect limit and HX Stomp's 6-block budget are respected
  4. Effect combination rules are classified by minimum block budget so they do not generate presets that exceed device constraints
**Plans**: TBD

### Phase 47: Model Routing Decision
**Goal**: An evidence-based decision about whether the current model split (Gemini Flash for chat, Claude Sonnet for generation) is optimal — "no changes needed" is a valid and expected outcome
**Depends on**: Phase 42 (requires token audit data), Phase 46 (all quality changes must be stable before evaluating cost)
**Requirements**: COST-01
**Success Criteria** (what must be TRUE):
  1. A decision document exists with token analysis, cost breakdown per endpoint, cache hit rate data, and quality comparison — the document explicitly recommends either keeping the current split or making a specific change
  2. If a model change is implemented (e.g., Haiku for specific sub-tasks), the PROMPT-04 regression test passes with identical quality scores compared to the Sonnet baseline
  3. If no model change is implemented, the document explains why with data (e.g., "Sonnet cache hit rate is 85%, switching to Haiku would save $X/month but risk Y quality regression")
**Plans**: TBD

### Phase 48: Footer Restoration & Fixed Positioning
**Goal**: Footer always visible and pinned to viewport bottom — on the welcome screen, during chat, and after generation. Displays "A Project of Daniel Bogard" linking to DanielBogard.com. Never floats mid-page during long conversations.
**Depends on**: Phase 47
**Requirements**: FOOTER-01
**Success Criteria** (what must be TRUE):
  1. Footer is visible at the viewport bottom on the welcome screen before any chat interaction
  2. After 20+ chat messages, footer remains at viewport bottom — it does not float mid-conversation
  3. After preset generation and download, footer is still visible at viewport bottom
  4. "Daniel Bogard" links to DanielBogard.com and opens in a new tab
  5. Footer retains 11px mono styling with amber hover effect matching the existing design system
**Plans**: TBD

### Phase 49: Variax Guitar Support
**Goal**: When users proactively mention a Variax guitar, the system captures the guitar model and embeds a Variax block in .hlx presets for compatible devices — no Variax questions unless the user brings it up first
**Depends on**: Phase 47; internal: research (VARIAX-03) blocks builder (VARIAX-04)
**Requirements**: VARIAX-01, VARIAX-02, VARIAX-03, VARIAX-04, VARIAX-05
**Success Criteria** (what must be TRUE):
  1. Mentioning "I play a JTV-69" in chat triggers a Variax follow-up question about guitar model and tuning — the AI never asks about Variax unprompted
  2. ToneIntentSchema accepts `variaxModel: "Spank"` as optional field — existing presets without Variax are unaffected
  3. A research document describes the exact Variax block JSON structure from real .hlx exports, with at least 2 real-world examples
  4. A Helix LT preset generated with `variaxModel: "Spank"` contains a correctly structured Variax block in the .hlx JSON output
  5. A Pod Go preset generated with `variaxModel: "Spank"` produces a valid .pgp with no Variax block and no error — same for Stadium .hsp
  6. HX Stomp and HX Stomp XL presets correctly include Variax blocks (they have VDI input like LT/Floor)
**Plans**: TBD

### Phase 50: Donation/Support Integration
**Goal**: Tasteful post-download donation card with PayPal, Venmo, and CashApp buttons, plus a persistent "Support" link in the footer — designed to actually get used without being annoying
**Depends on**: Phase 48 (footer must be fixed before adding Support link)
**Requirements**: DONATE-01, DONATE-02, DONATE-03, DONATE-04
**Success Criteria** (what must be TRUE):
  1. After the user's first preset download, an inline donation card appears in the conversation flow — not a modal or popup
  2. The card is dismissible with a button and does not re-appear after dismissal (once per session)
  3. PayPal (`paypal.me/dsbogard`), Venmo (`venmo.com/Daniel-Bogard-1`), and CashApp (`cash.app/$ravbogard`) buttons each open the correct URL in a new tab
  4. A "Support" link in the footer is always visible and re-shows the donation card if it was dismissed
  5. All donation UI uses `--hlx-*` CSS custom properties — no PayPal blue, Venmo teal, or CashApp green brand colors
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41 → 42 → 43 → 44 → 45 → 46 → 47 → 48 → 49 → 50

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Knowledge Layer | v1.0 | 3/3 | Complete | 2026-03-02 |
| 3. AI Integration | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Orchestration | v1.0 | 2/2 | Complete | 2026-03-02 |
| 5. Frontend Polish | v1.0 | 2/2 | Complete | 2026-03-02 |
| 6. Hardening | v1.0 | 2/2 | Complete | 2026-03-02 |
| 7. Hardware Bug Fixes and .hlx Audit | v1.1 | 2/2 | Complete | 2026-03-02 |
| 8. Prompt Caching | v1.1 | 1/1 | Complete | 2026-03-02 |
| 9. Genre-Aware Effect Defaults | v1.1 | 1/1 | Complete | 2026-03-02 |
| 10. Smarter Snapshot Effect Toggling | v1.1 | 1/1 | Complete | 2026-03-02 |
| 11. Frontend Transparency | v1.1 | 2/2 | Complete | 2026-03-02 |
| 12. Format Foundation and Types | v1.2 | 1/1 | Complete | 2026-03-02 |
| 13. Pod Go Model Catalog | v1.2 | 1/1 | Complete | 2026-03-02 |
| 14. Chain Rules, Validation, and Planner | v1.2 | 1/1 | Complete | 2026-03-02 |
| 15. Pod Go Preset Builder | v1.2 | 1/1 | Complete | 2026-03-02 |
| 16. Integration, UI, and Testing | v1.2 | 1/1 | Complete | 2026-03-02 |
| 17. Schemas & Types Foundation | v1.3 | 1/1 | Complete | 2026-03-02 |
| 18. Pedal Mapping Engine | v1.3 | 1/1 | Complete | 2026-03-02 |
| 19. Vision Extraction API | v1.3 | 1/1 | Complete | 2026-03-02 |
| 20. Planner Integration & Orchestration | v1.3 | 1/1 | Complete | 2026-03-02 |
| 21. Substitution Card & End-to-End Polish | v1.3 | 1/1 | Complete | 2026-03-02 |
| 24. Supabase Foundation | v2.0 | 3/3 | Complete | 2026-03-03 |
| 25. Auth Flow | v2.0 | 2/2 | Complete | 2026-03-03 |
| 26. Conversation CRUD API | v2.0 | 2/2 | Complete | 2026-03-03 |
| 27. Persistence Wiring | v2.0 | 2/2 | Complete | 2026-03-03 |
| 28. Chat Sidebar UI + UX Polish | v2.0 | 3/3 | Complete | 2026-03-03 |
| 29. Dual-Amp Preset Generation Fix | v2.0 | 3/3 | Complete | 2026-03-04 |
| 30. Chat Auto-Save on First AI Response | v2.0 | 1/1 | Complete | 2026-03-04 |
| 31. Device ID Research + Floor Fix | v3.0 | 2/2 | Complete | 2026-03-04 |
| 32. Type System Foundation | v3.0 | 1/1 | Complete | 2026-03-04 |
| 33. Stadium Model Catalog | v3.0 | 1/1 | Complete | 2026-03-04 |
| 34. Stadium Chain Rules + Validation | v3.0 | 1/1 | Complete | 2026-03-04 |
| 35. Stadium Builder | v3.0 | 1/1 | Complete | 2026-03-04 |
| 36. Planner + API Route Integration | v3.0 | 1/1 | Complete | 2026-03-04 |
| 37. UI — Device Selector + Download | v3.0 | 1/1 | Complete | 2026-03-04 |
| 38. Rig Emulation for Stadium | v3.0 | 1/1 | Complete | 2026-03-04 |
| 39. HX Stomp & HX Stomp XL Support | — | 3/3 | Complete | 2026-03-04 |
| 40. Rebrand HelixAI to HelixTones | — | 1/1 | Complete | 2026-03-04 |
| 41. Chat UX | — | 1/1 | Complete | 2026-03-04 |
| 42. Token Cost Audit + Quality Baseline | 2/2 | Complete   | 2026-03-05 | - |
| 43. Planner Prompt Quality | v4.0 | 0/TBD | Not started | - |
| 44. Knowledge Layer — Amp Parameters | v4.0 | 0/TBD | Not started | - |
| 45. Knowledge Layer — Effects, EQ, Snapshots | v4.0 | 0/TBD | Not started | - |
| 46. Effect Combination Intelligence | v4.0 | 0/TBD | Not started | - |
| 47. Model Routing Decision | v4.0 | 0/TBD | Not started | - |
| 48. Footer Restoration & Fixed Positioning | v4.0 | 1/1 | Complete | 2026-03-05 |
| 49. Variax Guitar Support | v4.0 | 1/1 | Complete | 2026-03-05 |
| 50. Donation/Support Integration | v4.0 | 1/1 | Complete | 2026-03-05 |
| 51. Fix Stadium Agoura amp lookup | v4.0 | 2/2 | Complete | 2026-03-05 |

### Phase 51: Fix Stadium Agoura amp lookup in chain-rules — assembleSignalChain fails to find Stadium amps for Stadium device

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 50
**Plans:** 2/2 plans complete

Plans:
- [ ] TBD (run /gsd:plan-phase 51 to break down)

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-05 — v4.0 phases 48-51 completed; Phase 52 (Stadium XL) deferred to next milestone*
