# Roadmap: HelixAI

## Milestones

- [x] **v1.0 Full Rebuild** - Phases 1-6 (shipped 2026-03-02)
- [ ] **v1.1 Polish & Precision** - Phases 7-11 (in progress)

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

### v1.1 Polish & Precision (In Progress)

**Milestone Goal:** Fix hardware-facing bugs, deepen preset intelligence, and give users a window into what they're downloading.

#### Phase 7: Hardware Bug Fixes and .hlx Audit
**Goal**: Presets respond correctly to hardware on first press and the .hlx format is verified against real HX Edit exports
**Depends on**: Phase 6
**Requirements**: HW-01, HW-02, HW-03
**Success Criteria** (what must be TRUE):
  1. A stomp assigned to a footswitch activates on the first press — no double-press required on Helix LT hardware
  2. Pedal LEDs on each snapshot reflect the active stomp states for that snapshot — the Clean snapshot shows clean LEDs and the Lead snapshot shows appropriate drive LEDs
  3. A systematic diff of generated .hlx output against real HX Edit exports has been completed and any field mismatches in the generated file have been corrected or documented as known limitations
  4. The `@pedalstate` bitmask computation is either derived from empirically verified HX Edit exports or explicitly documented as a known limitation with the hardcoded value retained
**Plans**: TBD

Plans:
- [ ] 07-01-PLAN.md — .hlx audit: export real HX Edit presets, diff against generated output, document field mismatches; fix @fs_enabled in buildFootswitchSection() (HW-01, HW-03)
- [ ] 07-02-PLAN.md — @pedalstate bitmask: empirically map bit positions from HX Edit exports, implement computeFootswitchAssignments(), or document hardcode limitation (HW-02)

#### Phase 8: Prompt Caching
**Goal**: API input token costs are reduced ~50% via system prompt caching with no effect on preset output quality
**Depends on**: Phase 7
**Requirements**: PERF-01
**Success Criteria** (what must be TRUE):
  1. On the second identical generation request in a session, `usage.cache_read_input_tokens` is greater than zero in the API response — confirming cache hits are occurring
  2. The first generation request shows `cache_creation_input_tokens > 1024` — confirming the system prompt meets the minimum cacheable size
  3. Preset output is identical before and after caching is added — no degradation in generated ToneIntent quality
**Plans**: TBD

Plans:
- [ ] 08-01-PLAN.md — Add cache_control: { type: "ephemeral" } to system prompt in callClaudePlanner(); audit system prompt for dynamic content that would bust cache; verify cache metrics (PERF-01)

#### Phase 9: Genre-Aware Effect Defaults
**Goal**: Delay time, reverb mix, and modulation rate in generated presets are tuned to the detected genre rather than applying identical defaults to every request
**Depends on**: Phase 8
**Requirements**: INTL-01
**Success Criteria** (what must be TRUE):
  1. A blues/rock preset has a slapback-style delay (short time, low mix) and a metal preset has minimal delay mix — the difference is audible and intentional, not accidental
  2. An ambient preset has reverb mix in the 40-60% range — noticeably wetter than a clean jazz preset which stays under 25%
  3. Genre string matching uses substring lookup with an explicit fallback to model defaults — an unrecognized genre hint does not cause an error or silent parameter corruption
  4. Genre defaults are applied as the outermost resolution layer — they override model defaults and category defaults, never the other way around
**Plans**: TBD

Plans:
- [ ] 09-01-PLAN.md — Inspect models.ts delay/reverb/modulation defaultParams encoding; build GENRE_EFFECT_DEFAULTS lookup table; wire into param-engine.ts as outermost resolution layer (INTL-01)

#### Phase 10: Smarter Snapshot Effect Toggling
**Goal**: Snapshot block states reflect musical intent — the ambient snapshot enables time-based effects at boosted mix and the clean snapshot disables drive blocks
**Depends on**: Phase 9
**Requirements**: INTL-02
**Success Criteria** (what must be TRUE):
  1. The Ambient snapshot has reverb and delay enabled with Mix values elevated above the base genre default — the snapshot sounds noticeably wetter than Rhythm
  2. The Clean snapshot has all drive-type effect blocks disabled — no overdrive or distortion pedal is active in the clean snapshot
  3. All snapshot toggling logic lives in getBlockEnabled() and buildSnapshots() in snapshot-engine.ts — SnapshotIntentSchema has gained zero new AI output fields
  4. Existing snapshot-engine unit tests pass without modification after the changes are applied
**Plans**: TBD

Plans:
- [ ] 10-01-PLAN.md — Extend getBlockEnabled() with intentRole-based toggling; add ambient Mix overrides in buildSnapshots(); integration-test genre defaults + snapshot toggling in combination (INTL-02)

#### Phase 11: Frontend Transparency
**Goal**: Users can see the signal chain and read a plain-language description of their preset before downloading
**Depends on**: Phase 10
**Requirements**: FXUI-01, FXUI-02, BRAND-01
**Success Criteria** (what must be TRUE):
  1. After generation and before download, a horizontal read-only signal chain visualization shows each block (amp, cab, effects) in order with their enabled states visible
  2. A tone description card displays the preset name, amp/cab pair, all four snapshot names with distinguishable colors, and guitar-specific playing notes
  3. A "Project of Daniel Bogard" footer with a working link to danielbogard.com appears on all pages
  4. The signal chain visualization loads without SSR errors and does not block page render if the visualization data is unavailable
**Plans**: TBD

Plans:
- [ ] 11-01-PLAN.md — Install @xyflow/react 12.10.1; build viz.ts pure function; add signalChainViz to API response; build SignalChainViz React component with next/dynamic SSR guard (FXUI-01)
- [ ] 11-02-PLAN.md — Build ToneDescriptionCard component from existing API response data; add danielbogard.com footer to all pages (FXUI-02, BRAND-01)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 > 7 > 8 > 9 > 10 > 11

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Knowledge Layer | v1.0 | 3/3 | Complete | 2026-03-02 |
| 3. AI Integration | v1.0 | 2/2 | Complete | 2026-03-02 |
| 4. Orchestration | v1.0 | 2/2 | Complete | 2026-03-02 |
| 5. Frontend Polish | v1.0 | 2/2 | Complete | 2026-03-02 |
| 6. Hardening | v1.0 | 2/2 | Complete | 2026-03-02 |
| 7. Hardware Bug Fixes and .hlx Audit | v1.1 | 0/2 | Not started | - |
| 8. Prompt Caching | v1.1 | 0/1 | Not started | - |
| 9. Genre-Aware Effect Defaults | v1.1 | 0/1 | Not started | - |
| 10. Smarter Snapshot Effect Toggling | v1.1 | 0/1 | Not started | - |
| 11. Frontend Transparency | v1.1 | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-02 — v1.1 phases 7-11 added (9 requirements, 5 phases)*
