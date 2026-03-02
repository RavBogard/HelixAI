# Roadmap: HelixAI

## Milestones

- [x] **v1.0 Full Rebuild** - Phases 1-6 (shipped 2026-03-02)
- [x] **v1.1 Polish & Precision** - Phases 7-11 (shipped 2026-03-02)
- [ ] **v1.2 Pod Go Support** - Phases 12-16 (in progress)

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

### v1.2 Pod Go Support (In Progress)

**Milestone Goal:** Extend HelixAI to generate presets for Line 6 Pod Go — a single-DSP device with different block limits, file format, and model catalog. Pod Go presets must match the same professional tone quality standard as Helix presets.

- [ ] **Phase 12: Format Foundation and Types** - Pod Go type definitions, device constants, and block type encoding
- [ ] **Phase 13: Pod Go Model Catalog** - Effect model IDs with Mono/Stereo suffixes, device-filtered model list
- [ ] **Phase 14: Chain Rules, Validation, and Planner** - Device-aware signal chain assembly, Pod Go validation, planner prompt filtering
- [ ] **Phase 15: Pod Go Preset Builder** - .pgp file generation with correct format, snapshots, and tone quality
- [ ] **Phase 16: Integration, UI, and Testing** - Pod Go in device selector, .pgp download, end-to-end verification

## Phase Details

### Phase 12: Format Foundation and Types
**Goal**: Every downstream Pod Go component has verified type contracts and format constants to build against — no guesswork on device IDs, block types, or file structure
**Depends on**: Phase 11
**Requirements**: PGP-01, PGP-02, PGP-03, PGP-04, PGP-05
**Success Criteria** (what must be TRUE):
  1. A `DeviceTarget` union type includes `"pod_go"` alongside `"helix_lt"` and `"helix_floor"` — TypeScript rejects any code passing an unrecognized device string
  2. `BLOCK_TYPES_PODGO` constant map contains verified Pod Go @type values (delay=5, modulation=0, reverb=5, EQ_STATIC=6) that differ from Helix values — using Helix @type values for a Pod Go preset is a compile-time or test-time error
  3. `PgpFile` and `PodGoTone` interfaces exist with `input`/`output` keys (not `inputA`/`outputA`), no `@path`, `@stereo`, or `@topology` fields, and `P34_AppDSPFlow*` I/O model references
  4. `DEVICE_IDS` includes `pod_go: 2162695` and Pod Go firmware constants (`device_version`, `appversion`, `build_sha`) are defined and ready for the builder
  5. The type system enforces that Pod Go cab blocks are numbered chain blocks (not a separate `cab0` key) and that `dsp1` is always empty
**Plans**: TBD

### Phase 13: Pod Go Model Catalog
**Goal**: The model registry knows which amps and effects are available on Pod Go, with correct Mono/Stereo suffixed IDs, so the AI planner never offers an unavailable model
**Depends on**: Phase 12
**Requirements**: PGMOD-01, PGMOD-02, PGMOD-03, PGMOD-04
**Success Criteria** (what must be TRUE):
  1. Effect model entries in the registry include Pod Go-specific IDs with Mono/Stereo suffixes (e.g., `HD2_DistScream808Mono` not `HD2_DistScream808`) — a test verifies every Pod Go effect ID ends in `Mono` or `Stereo`
  2. Amp model entries are correctly shared between Helix and Pod Go without suffix transformation — the same amp ID works for both devices
  3. `getModelsForDevice("pod_go")` excludes Tone Sovereign, Clawthorn Drive, Cosmos Echo, Poly Pitch, and Space Echo — these models never appear in a Pod Go-targeted generation
  4. `getModelListForPrompt("pod_go")` returns a device-filtered model list that the AI planner prompt consumes — the prompt contains only Pod Go-available model IDs
**Plans**: TBD

### Phase 14: Chain Rules, Validation, and Planner
**Goal**: Signal chain assembly enforces Pod Go's single-DSP, 4-effect-block constraint, the validator catches Pod Go-specific errors, and the AI planner generates Pod Go-appropriate creative choices
**Depends on**: Phase 13
**Requirements**: PGCHAIN-01, PGCHAIN-02, PGCHAIN-03
**Success Criteria** (what must be TRUE):
  1. `assembleSignalChain()` with `deviceTarget: "pod_go"` assigns all blocks to dsp:0 and enforces a maximum of 4 user-assignable effect blocks — a 5th effect block causes a validation error, not silent truncation
  2. Pod Go chain assembly does not insert Parametric EQ or Gain Block — the DSP budget is fully reserved for user-facing effects (amp, cab, and up to 4 effects)
  3. The AI planner system prompt for Pod Go says "Pod Go preset" and passes only Pod Go-available model IDs — a generation request for Pod Go never produces a ToneIntent referencing Helix-only models or dsp:1 assignments
  4. `validatePodGoPresetSpec()` exists as a separate validation function that catches Pod Go-specific errors (dsp1 blocks, >4 effects, excluded models) without modifying Helix validation logic
**Plans**: TBD

### Phase 15: Pod Go Preset Builder
**Goal**: The builder produces a valid .pgp file that loads in Pod Go Edit without errors, with 4 volume-balanced snapshots and the same professional tone quality as Helix presets
**Depends on**: Phase 14
**Requirements**: PGSNAP-01, PGSNAP-02, PGQUAL-01, PGQUAL-02
**Success Criteria** (what must be TRUE):
  1. `buildPgpFile()` produces a .pgp JSON file with exactly 4 snapshots (snapshot0-snapshot3) using `@controller: 4` for snapshot recall — Pod Go Edit imports the file without errors
  2. The 4 snapshots (Clean, Rhythm, Lead, Ambient) are volume-balanced with per-snapshot block states and a Lead boost of +2-3 dB — matching the Helix quality standard for snapshot design
  3. Pod Go presets receive the same category/genre/topology-aware parameter defaults from param-engine as Helix presets — a clean Pod Go preset has the same Master/Drive/SAG values as a clean Helix preset
  4. Pod Go presets have proper cab filtering (LowCut 80-100 Hz, HighCut 5-8 kHz), dynamic responsiveness (volume knob cleanup), and a professional signal chain — the tone quality is mix-ready, not a degraded subset of Helix
**Plans**: TBD

### Phase 16: Integration, UI, and Testing
**Goal**: Pod Go is fully wired into the application — selectable in the UI, generating downloadable .pgp files, and verified end-to-end with no Helix regressions
**Depends on**: Phase 15
**Requirements**: PGUX-01, PGUX-02, PGUX-03
**Success Criteria** (what must be TRUE):
  1. The device selector dropdown includes "Pod Go" as an option alongside Helix LT and Helix Floor — selecting Pod Go routes the generation request through the Pod Go pipeline
  2. Completing a Pod Go tone generation produces a downloadable file with `.pgp` extension (not `.hlx`) — the browser download dialog shows the correct file name and extension
  3. The signal chain visualization and tone description card display 4 snapshots (not 8) when viewing a Pod Go preset — the UI reflects Pod Go's actual hardware capability
  4. All existing Helix test suites pass without modification after Pod Go code is added — no Helix regression from the Pod Go integration
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8 > 9 > 10 > 11 > 12 > 13 > 14 > 15 > 16

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
| 12. Format Foundation and Types | v1.2 | 0/TBD | Not started | - |
| 13. Pod Go Model Catalog | v1.2 | 0/TBD | Not started | - |
| 14. Chain Rules, Validation, and Planner | v1.2 | 0/TBD | Not started | - |
| 15. Pod Go Preset Builder | v1.2 | 0/TBD | Not started | - |
| 16. Integration, UI, and Testing | v1.2 | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-02 — v1.2 Pod Go Support phases 12-16 added*
