# Roadmap: HelixAI

## Overview

The rebuild transforms HelixAI from a system that generates structurally correct but tonally mediocre presets into one that produces world-class, mix-ready tones. The path runs through five phases of build work plus one hardening phase: establish the type contracts and verified constants that everything depends on (Phase 1), encode expert Helix knowledge into deterministic code that no AI can corrupt (Phase 2), integrate Claude Sonnet 4.6 with constrained structured output for creative model selection only (Phase 3), wire all components into the generation route and harden the validator (Phase 4), then polish the frontend with the device selector and clean up UX (Phase 5). Phase 6 verifies the system holds up against real hardware and addresses the "looks done but isn't" failure modes before launch.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Type contracts, verified @type constants, expanded model database, parameter type registry
- [x] **Phase 2: Knowledge Layer** - Deterministic chain rules, param engine, snapshot engine — the expert Helix knowledge encoded in code
- [x] **Phase 3: AI Integration** - Claude Sonnet 4.6 with constrained ToneIntent output; Gemini chat unchanged
- [x] **Phase 4: Orchestration** - Wire all components end-to-end; harden validator; generate real downloadable presets
- [x] **Phase 5: Frontend Polish** - Device selector (LT vs. Floor), UX refinements, remove multi-provider UI
- [ ] **Phase 6: Hardening** - Hardware verification on real Helix LT, fail-fast validation, firmware parameterization, openai package removal

## Phase Details

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
- [ ] 05-01-PLAN.md — Refactor page.tsx: remove multi-provider UI, add device selector, single preset card, update footer/branding (UX-01, UX-02, UX-03, UX-04)
- [ ] 05-02-PLAN.md — Delete dead provider code (providers.ts, /api/providers route), clean orphaned CSS, visual verification checkpoint (UX-02, UX-04)

### Phase 6: Hardening
**Goal**: The system is verified against real hardware and the known "looks done but isn't" failure modes are closed before launch
**Depends on**: Phase 5
**Requirements**: (No v1 requirements — see note below)
**Success Criteria** (what must be TRUE):
  1. A preset generated for Helix LT loads and plays on real Helix LT hardware with audibly professional tone — not muddy, not thin, mix-ready
  2. Generation fails with a clear error rather than producing a broken preset when a DSP block limit (8 non-cab blocks per DSP) would be exceeded
  3. The firmware version is read from a config value — changing it does not require a code change
  4. The openai package has been removed from package.json and no generation code references it
**Plans**: TBD

**Phase 6 Note:** All v1 requirements are fully covered in Phases 1-5 (36/36). Phase 6 addresses launch readiness concerns surfaced by research (hardware verification, firmware parameterization, DSP limit enforcement, openai cleanup) that are prerequisites for a production-quality launch but were categorized as v2 infrastructure in REQUIREMENTS.md. These are elevated for this milestone because they gate the core value: presets that actually sound good on real hardware.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-01 |
| 2. Knowledge Layer | 3/3 | Complete | 2026-03-02 |
| 3. AI Integration | 2/2 | Complete | 2026-03-02 |
| 4. Orchestration | 2/2 | Complete | 2026-03-02 |
| 5. Frontend Polish | 2/2 | Complete | 2026-03-02 |
| 6. Hardening | 0/TBD | Not started | - |

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-02 — Phase 5 complete (2/2 plans). Phases 1-5 complete (12/12 plans).*
