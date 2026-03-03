# Roadmap: HelixAI

## Milestones

- [x] **v1.0 Full Rebuild** - Phases 1-6 (shipped 2026-03-02)
- [x] **v1.1 Polish & Precision** - Phases 7-11 (shipped 2026-03-02)
- [x] **v1.2 Pod Go Support** - Phases 12-16 (shipped 2026-03-02)
- [ ] **v1.3 Rig Emulation** - Phases 17-21 (in progress)

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

### v1.3 Rig Emulation (In Progress)

**Milestone Goal:** Extend the tone interview to accept physical rig descriptions — text, pedal photos, or both — and generate a Helix/Pod Go preset that emulates the user's actual gear, with transparent substitution mapping shown before download.

- [ ] **Phase 17: Schemas & Types Foundation** - Zod schemas for all v1.3 data contracts
- [ ] **Phase 18: Pedal Mapping Engine** - PEDAL_HELIX_MAP curated table + three-tier match logic
- [ ] **Phase 19: Vision Extraction API** - /api/vision route + client-side image upload + compression
- [ ] **Phase 20: Planner Integration & Route Orchestration** - toneContext injection + text rig parsing + pipeline wiring
- [ ] **Phase 21: Substitution Card & End-to-End Polish** - substitution UI + progressive loading + full device verification

## Phase Details

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
- [ ] 17-01-PLAN.md — rig-intent.ts: PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema + barrel exports in index.ts (RIG-06)

### Phase 18: Pedal Mapping Engine
**Goal**: The deterministic rig mapping layer converts physical pedal names to Helix equivalents with three match tiers and coarse knob zone translation — no AI guessing in the mapping logic
**Depends on**: Phase 17
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05
**Success Criteria** (what must be TRUE):
  1. `PEDAL_HELIX_MAP` in `src/lib/rig-mapping.ts` contains at least 40 entries covering the most common pedal categories — overdrives (TS9, TS808, BD-2, SD-1, Klon Centaur, ProCo Rat), distortions (DS-1, Big Muff Pi, MXR Distortion+), delays (DD-3, DM-2, Deluxe Memory Man), reverbs (Hall of Fame, Big Sky), modulation (Phase 90, Small Clone, CE-2), compression (Dyna Comp, Ross Compressor), and boost (EP Booster, Soul Food)
  2. `lookupPedal(pedalName: string, device: DeviceTarget)` returns a `SubstitutionEntry` with the correct `confidence` tier: `"direct"` for exact table match, `"close"` for category best-match, `"approximate"` for speculative match — no silent confident-wrong mapping for boutique pedals not in the table
  3. For an unknown boutique pedal not in the table, `lookupPedal()` returns `confidence: "approximate"` with a category-based best guess — it never returns `confidence: "direct"` for a pedal that required fuzzy/category fallback
  4. The mapping table stores both `helixModel` (internal `HD2_*` ID used by the preset builder) and `helixModelDisplayName` (human-readable name from `models.ts` used by the UI) — no internal IDs leak to the display layer
  5. `mapRigToSubstitutions(rigIntent, device)` returns a `SubstitutionMap` — a unit test confirms that passing `device: "pod_go"` produces Pod Go-suffixed model IDs (`HD2_DistTeemahMono`) while `device: "helix_lt"` produces standard IDs (`HD2_DistTeemah`)
  6. A unit test confirms that a pedal in the table (e.g., "ibanez ts9") returns `confidence: "direct"` and a pedal not in the table (e.g., "mythos mjolnir") does not return `confidence: "direct"`
**Plans**: 1 plan

Plans:
- [ ] 18-01-PLAN.md — rig-mapping.ts: PEDAL_HELIX_MAP (53 entries), lookupPedal() three-tier logic, mapRigToSubstitutions(); rig-mapping.test.ts: vitest unit tests covering SC-01 through SC-06 (MAP-01, MAP-02, MAP-03, MAP-04, MAP-05)

### Phase 19: Vision Extraction API
**Goal**: Claude Vision extracts pedal identifications and coarse knob zones from user-uploaded photos via an isolated `/api/vision` route — client-side compression keeps all uploads within Vercel's 4.5MB limit and the existing generation pipeline is completely unaffected
**Depends on**: Phase 17
**Requirements**: RIG-01, RIG-02, RIG-03, VIS-01, VIS-02, VIS-03, VIS-04, API-01, API-02
**Success Criteria** (what must be TRUE):
  1. The `/api/vision` route exists at `src/app/api/vision/route.ts` with `export const maxDuration = 60` — it accepts `multipart/FormData` with image files, calls Claude Sonnet 4.6 with vision, and returns a `RigIntent` JSON response
  2. The `/api/generate` route is byte-for-byte identical to its v1.2 state — no new parameters, no changed request shape, no new logic paths; a text-only generation request produces exactly the same response as before v1.3
  3. The image upload UI in `page.tsx` enforces: max 3 files, accepted types `image/jpeg image/png image/webp`, client-side compression via `browser-image-compression` targeting 800KB/1568px — uploading a 6MB smartphone photo results in a compressed file under 1MB reaching the server
  4. A network inspection of a 3-photo upload shows total POST body size under 4.5MB — the Vercel hard limit is never hit
  5. Uploading a blurry or poorly-lit photo returns `PhysicalPedal.confidence: "low"` or `"medium"` — the UI prompts the user to confirm or type the pedal name rather than silently proceeding with the extraction result
  6. The vision extraction prompt explicitly instructs Claude to return `modelName: null` when the pedal is not legibly identifiable — a test with a photo of a non-pedal object (e.g., a book cover) returns `modelName: null` rather than a fabricated pedal name
  7. Knob position output uses clock-position descriptions or coarse zone labels — no raw 0-100 percentage values appear in the `PhysicalPedal.knobPositions` schema output
**Plans**: TBD

### Phase 20: Planner Integration & Route Orchestration
**Goal**: The Planner accepts rig context through the user messages array without breaking prompt caching, the generate route orchestrates vision → mapping → planner cleanly, and text rig descriptions work end-to-end without any image upload
**Depends on**: Phase 18, Phase 19
**Requirements**: RIG-04, RIG-05, PLAN-01, PLAN-02, PLAN-03, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. `callClaudePlanner(messages, device, toneContext?)` compiles — the third parameter is optional; existing call sites without `toneContext` remain unchanged
  2. When `toneContext` is provided, it is appended to the conversation text (user message content) — NOT added to the system prompt; `buildPlannerPrompt()` function signature is unchanged
  3. After a rig emulation generation, the Anthropic API response shows `cache_read_input_tokens > 0` — prompt caching is confirmed intact; the system prompt did not change
  4. The generate route (`/api/generate`) orchestrates: parse body → if `rigIntent` present, call `mapRigToSubstitutions()` → build `toneContext` string → call `callClaudePlanner(messages, device, toneContext)` → Knowledge Layer → file build. Zero new routes involved; only the generate route gains this optional path
  5. A text-only rig description ("TS9 into a Fender Twin Reverb") typed in the chat without any image upload: the Gemini interview detects it as a rig description, the generate call receives it as conversation context, `mapRigToSubstitutions()` runs against the text, and the resulting preset uses Helix equivalents with a substitution map returned to the UI
  6. A vision failure (e.g., `/api/vision` returns an error) does not prevent the user from generating a preset — the UI offers the text description fallback path immediately without requiring a page refresh
**Plans**: TBD

### Phase 21: Substitution Card & End-to-End Polish
**Goal**: The substitution mapping is visible and readable before preset generation, progressive loading states guide users through the multi-step flow, all three devices work end-to-end with rig emulation, and no regressions exist in the existing non-rig generation path
**Depends on**: Phase 20
**Requirements**: SUBST-01, SUBST-02, SUBST-03, SUBST-04, PROGUX-01, PROGUX-02
**Success Criteria** (what must be TRUE):
  1. The substitution card renders in the chat flow immediately after vision extraction and mapping complete — before the user clicks Generate — showing each `[Original Pedal Name] → [Helix Display Name]` entry with a one-sentence plain-English rationale in guitarist vocabulary (e.g., "mid-hump EQ character and asymmetric clipping structure", "tape-style echo warmth")
  2. No `HD2_*` strings appear anywhere in the rendered substitution card or any other user-facing UI element — inspecting the DOM confirms only human-readable display names are rendered
  3. Exact-match entries (confidence: "direct") display with full card emphasis; approximate-match entries (confidence: "close" or "approximate") display with a "Best available match" label and visually reduced emphasis — the visual differentiation is apparent without reading the label
  4. An unknown boutique pedal not in `PEDAL_HELIX_MAP` shows a card entry offering "We don't have [Pedal Name] in our database. You can describe its sound instead, or we'll treat it as a [category] pedal." — the user has a clear text escape hatch and is never stuck
  5. Loading states show distinct labeled stages: "Analyzing pedal photo…" → "Mapping to Helix models…" → "Building preset…" — no blank spinner for the full 15-20 second rig emulation flow; each stage is visible for at least 1 second before the next begins
  6. Selecting Pod Go as the device and uploading a pedal photo produces a valid `.pgp` file — the substitution card shows Pod Go-compatible model names (not Helix-only models) and the downloaded preset loads in Pod Go Edit
  7. Generating a text-only Helix LT preset (no rig input, no images) produces identical output to v1.2 — no new loading states, no new API calls, no changed response shape visible in the network tab
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8 > 9 > 10 > 11 > 12 > 13 > 14 > 15 > 16 > 17 > 18 > 19 > 20 > 21

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
| 17. Schemas & Types Foundation | v1.3 | 0/1 | Not started | - |
| 18. Pedal Mapping Engine | v1.3 | 0/1 | Not started | - |
| 19. Vision Extraction API | v1.3 | 0/TBD | Not started | - |
| 20. Planner Integration & Route Orchestration | v1.3 | 0/TBD | Not started | - |
| 21. Substitution Card & End-to-End Polish | v1.3 | 0/TBD | Not started | - |
| 22. UI Overhaul | v1.3 | 0/TBD | Not started | - |

### Phase 22: UI Overhaul

**Goal:** Complete visual redesign of homepage, chat flow, and rig upload panel — eliminating redundant elements, fixing readability, and creating a clean, polished interface with strong visual hierarchy.
**Requirements**: TBD
**Depends on:** Phase 21
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 22 to break down)

### Phase 23: Fix incompatible target device type error (-8309)

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 22
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 23 to break down)

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-02 — v1.2 phases 12-16 marked complete; v1.3 Rig Emulation phases 17-21 added; Phase 17 plan created; Phase 18 plan 18-01 created*
