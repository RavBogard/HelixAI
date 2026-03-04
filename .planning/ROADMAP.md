# Roadmap: HelixAI

## Milestones

- [x] **v1.0 Full Rebuild** - Phases 1-6 (shipped 2026-03-02)
- [x] **v1.1 Polish & Precision** - Phases 7-11 (shipped 2026-03-02)
- [x] **v1.2 Pod Go Support** - Phases 12-16 (shipped 2026-03-02)
- [x] **v1.3 Rig Emulation** - Phases 17-21 (shipped 2026-03-02)
- [x] **v2.0 Persistent Chat Platform** - Phases 24-30 (shipped 2026-03-04)
- [ ] **v3.0 Helix Stadium Support** - Phases 31-38 (in progress)

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

### v2.0 Persistent Chat Platform (In Progress)

**Milestone Goal:** Transform HelixAI from a stateless generate-and-download tool into a persistent platform where users log in with Google, maintain a sidebar of past conversations, pick up where they left off, and re-download their most recent preset per chat. Anonymous usage remains fully functional; login unlocks history.

- [x] **Phase 24: Supabase Foundation** - Database schema, RLS, client utilities, middleware, keep-alive (3 plans, complete 2026-03-03)
- [x] **Phase 25: Auth Flow** - Anonymous sign-in + Google OAuth + identity linking (completed 2026-03-03)
- [x] **Phase 26: Conversation CRUD API** - Full data API for creating, reading, listing, and title update (1 plan, complete 2026-03-03)
- [x] **Phase 27: Persistence Wiring** - Modify chat/generate routes to persist messages and preset files (completed 2026-03-03)
- [x] **Phase 28: Chat Sidebar UI + UX Polish** - Sidebar panel, resume flow, new chat, sign-in prompt (completed 2026-03-03)

## Phase Details

### Phase 24: Supabase Foundation
**Goal**: The persistence infrastructure exists and is secured — database schema with RLS, storage bucket, isomorphic client utilities, session-refreshing middleware, and keep-alive — so every subsequent phase builds on a verified, safe foundation
**Depends on**: Phase 21
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06
**Success Criteria** (what must be TRUE):
  1. `createSupabaseServerClient()` and `createSupabaseBrowserClient()` run without error in a Next.js App Router context — a server component and a client component can each call Supabase without configuration friction
  2. A direct REST call to `/rest/v1/conversations` with the public anon key returns an empty array — not a 403, and not rows belonging to other users — confirming RLS is active and filtering correctly
  3. Middleware at project root calls `updateSession()` on every non-static request — a session cookie set in one request is still valid two requests later without any manual token refresh
  4. The Supabase Storage `presets` bucket exists with RLS on `storage.objects` — a direct upload attempt without a valid session token is rejected
  5. A keep-alive mechanism is deployed and verified — the Supabase project does not pause after 7 days of zero application activity
**Plans**: 3

### Phase 25: Auth Flow
**Goal**: Every visitor gets an anonymous user ID on first load, and authenticated users can sign in with Google without losing their current session state — the anonymous generate-and-download flow is fully preserved with zero new auth gates
**Depends on**: Phase 24
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A first-time visitor has an anonymous session visible in the Supabase Auth dashboard — `is_anonymous: true`, with a real UUID that is the root foreign key for any data they create
  2. Clicking "Sign in with Google" completes OAuth and returns the user to the app with the same UUID as before — `is_anonymous` is now false, and no data from the pre-login session is lost
  3. Hard-refreshing the page after signing in shows the logged-in UI state immediately with no visible flash of the logged-out state
  4. An anonymous user who starts a chat and clicks "Sign in with Google" mid-session returns after the OAuth redirect with their in-progress chat state intact — the conversation they were in is still present
  5. Clicking "Sign out" clears the session, the UI returns to anonymous state, and the sidebar (when it exists) is hidden — no logged-in UI elements remain visible
  6. An anonymous user can generate and download a preset with zero new UI elements, loading states, or performance overhead compared to v1.3
**Plans**: TBD

### Phase 26: Conversation CRUD API
**Goal**: A stable, independently-testable data API exists for conversations and messages — all four CRUD operations work correctly against the database, RLS is verified by cross-user isolation tests, and sequence numbers enforce correct message ordering
**Depends on**: Phase 24
**Requirements**: CONV-01, CONV-02, CONV-03, CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. `POST /api/conversations` creates a conversation row with `id`, `user_id`, `device`, and `title` — the returned `conversationId` can be used immediately in subsequent requests
  2. `GET /api/conversations` returns conversations for the authenticated user only, ordered by `updated_at` desc — a request authenticated as a different user returns zero rows for the first user's conversations, confirming RLS isolation
  3. `GET /api/conversations/[id]` returns the full conversation with messages ordered by `sequence_number` ascending — two messages inserted out of wall-clock order appear in insertion-sequence order, not timestamp order
  4. `PATCH /api/conversations/[id]/title` updates the conversation title — a 5-8 word title derived client-side from the first user message is stored and returned correctly
  5. `DELETE /api/conversations/[id]` removes the conversation and all its messages — the conversation no longer appears in the list and the storage preset file is removed
  6. All four route handlers independently verify the session — a request with a crafted middleware-bypass header is rejected at the route handler level, not just at middleware
**Plans**: TBD

### Phase 27: Persistence Wiring
**Goal**: Authenticated conversations persist their full message history and most recent preset file — the existing anonymous generate-and-download flow is byte-for-byte identical to v1.3 when no conversationId is provided
**Depends on**: Phase 25, Phase 26
**Requirements**: STORE-01, STORE-02, STORE-03, UXP-04
**Success Criteria** (what must be TRUE):
  1. Sending a message in an authenticated conversation with a `conversationId` — the user message appears in the Supabase `messages` table with the correct `sequence_number` before the AI response completes, and the assistant message appears with the next `sequence_number` after the stream finishes
  2. Generating a preset in an authenticated conversation — exactly one file exists in Supabase Storage at the deterministic key `presets/{user_id}/{conversation_id}/latest.hlx` (or `.pgp`); regenerating overwrites the file, not creates a new one
  3. A "Download Preset" action in a resumed conversation fetches the stored file from Supabase Storage without regenerating — the download completes without triggering any AI call
  4. Posting to `/api/chat` and `/api/generate` WITHOUT a `conversationId` produces responses identical in shape, timing (within 5%), and content to v1.3 — no new database calls, no new loading states, no changed response fields for anonymous users
**Plans**: TBD

### Phase 28: Chat Sidebar UI + UX Polish
**Goal**: Authenticated users see a pull-out sidebar showing their past conversations and can resume, delete, or start new chats — the full persistence layer is surfaced in a polished UI, and contextual sign-in prompts encourage anonymous users to log in after their first preset
**Depends on**: Phase 27
**Requirements**: SIDE-01, SIDE-02, SIDE-03, SIDE-04, SIDE-05, SIDE-06, UXP-01, UXP-02, UXP-03
**Success Criteria** (what must be TRUE):
  1. An authenticated user opens the sidebar and sees their past conversations with title, device type, and relative timestamp — sorted by most recent activity; clicking any entry loads the full message history into the chat area with the device selector restored
  2. Clicking "New Chat" clears the current session, resets the device selector to default, and assigns a new `conversationId` on the first message send — no stale state from the previous conversation is visible
  3. Deleting a conversation from the sidebar removes it from the list immediately (optimistic update) and the deletion is confirmed in the database within 2 seconds — if the delete fails, the conversation reappears in the sidebar
  4. Resuming a past conversation that had a preset generated shows a "Download Preset" button — clicking it downloads the stored file without regenerating; the loading state shows "Loading conversation..." before the messages appear
  5. The sidebar is absent for anonymous users — they see the standard full-width chat interface with no sidebar toggle, no sidebar shell, and no visual remnants of the sidebar layout
  6. After an anonymous user successfully downloads their first preset, a non-blocking banner appears: "Sign in to save this chat and come back to refine it later" — it is dismissible and does not interrupt the download or any subsequent action
  7. When resuming a past conversation, three static suggestion chips are visible — "Refine this tone", "Try a different amp", "Generate for [other device]" — clicking one populates the chat input with a starter message
**Plans**: 3/3 complete

### Phase 29: Dual-Amp Preset Generation Fix

**Goal:** Users who request presets with two different amps receive a valid dual-amp preset with split/join AB topology, per-snapshot amp switching, and independent parameter resolution — single-amp presets are completely unaffected; Pod Go gracefully falls back to single-amp.
**Requirements**: DUAL-01, DUAL-02, DUAL-03, DUAL-04, DUAL-05, DUAL-06, DUAL-07, DUAL-08, DUAL-09
**Depends on:** Phase 28
**Plans:** 3/3 plans complete

Plans:
- [x] 29-01: Schema Extension + AI Prompt Updates (DUAL-01, DUAL-02, DUAL-07, DUAL-08)
- [x] 29-02: Knowledge Layer — Chain + Params + Snapshots (DUAL-03, DUAL-04, DUAL-05)
- [x] 29-03: Preset Builder Topology + Validation (DUAL-06, DUAL-09)

### Phase 30: Chat Auto-Save on First AI Response

**Goal:** Authenticated users' conversations are automatically created and persisted after the first AI response — no user action required. Opening a new session shows all previous chats in the sidebar, just like any standard AI chat interface. Conversations should NOT be created for anonymous users (they can't retrieve them anyway).
**Requirements**: SAVE-01, SAVE-02, SAVE-03, SAVE-04
**Depends on:** Phase 28
**Plans:** 1/1 plans complete

Plans:
- [x] 30-01-PLAN.md — Sidebar refresh after auto-title + generate-flow message persistence (SAVE-01, SAVE-02, SAVE-03, SAVE-04)

---

## v3.0 Helix Stadium Support (Phases 31-38)

<details>
<summary>v3.0 Helix Stadium Support (Phases 31-38) — IN PROGRESS</summary>

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
**Plans**: TBD

</details>

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20 → 21 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38

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
| 31. Device ID Research + Floor Fix | v3.0 | 0/2 | Not started | — |
| 32. Type System Foundation | v3.0 | TBD | Not started | — |
| 33. Stadium Model Catalog | v3.0 | TBD | Not started | — |
| 34. Stadium Chain Rules + Validation | v3.0 | TBD | Not started | — |
| 35. Stadium Builder | v3.0 | TBD | Not started | — |
| 36. Planner + API Route Integration | v3.0 | TBD | Not started | — |
| 37. UI — Device Selector + Download | v3.0 | TBD | Not started | — |
| 38. Rig Emulation for Stadium | v3.0 | TBD | Not started | — |

### Phase 39: HX Stomp & HX Stomp XL Support

**Goal:** Users can generate presets for HX Stomp (`helix_stomp`, 2162694) and HX Stomp XL (`helix_stomp_xl`, 2162699) — both output standard `.hlx` files using the same `data.*` structure as LT/Floor but with Stomp-specific I/O models, block limits, and snapshot counts; existing devices unaffected
**Depends on:** Phase 38
**Requirements**: TBD (to be written when Phase 38 ships)
**Success Criteria** (what must be TRUE):
  1. `DEVICE_IDS.helix_stomp === 2162694` and `DEVICE_IDS.helix_stomp_xl === 2162699` — both confirmed from real hardware exports; both differ from each other and from LT/Floor/Pod Go/Stadium
  2. `buildStompFile(spec, "helix_stomp")` produces a `.hlx` file capped at 6 blocks, 3 snapshots, using `HelixStomp_AppDSPFlowInput` and `HelixStomp_AppDSPFlowOutputMain` I/O models
  3. `buildStompFile(spec, "helix_stomp_xl")` produces a `.hlx` file capped at 9 blocks, 4 snapshots, with the same I/O model prefix
  4. Generated `.hlx` files import into HX Edit without errors — hardware device ID validated
  5. UI shows "STOMP" and "STOMP XL" device options; downloads named `HelixAI_[Name]_Stomp.hlx` and `HelixAI_[Name]_StompXL.hlx` respectively
  6. Helix LT, Helix Floor, Pod Go, and Helix Stadium generation are completely unaffected
**Plans:** TBD

Plans:
- [ ] TBD (run /gsd:plan-phase 39 to break down)

---
*Roadmap created: 2026-03-01*
*Last updated: 2026-03-04 — Phase 39 expanded to HX Stomp & HX Stomp XL (both device IDs confirmed from real .hlx exports)*
