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

- [x] **PGP-01**: Generated .pgp file with device ID 2162695 loads in Pod Go Edit without errors
- [x] **PGP-02**: Block @type values use Pod Go-specific encoding (delay=5, modulation=0, reverb=5, EQ_STATIC=6 — complete remap from Helix values)
- [x] **PGP-03**: I/O uses `input`/`output` keys with `P34_AppDSPFlow*` models — no @path, @stereo, or @topology fields present
- [x] **PGP-04**: Cab placed as numbered block in signal chain (not separate `cab0` key like Helix)
- [x] **PGP-05**: Single-DSP structure — all blocks on dsp0, `dsp1: {}` always empty

### Pod Go Model Catalog

- [x] **PGMOD-01**: Effect model IDs use correct Mono/Stereo suffixes (e.g., `HD2_DistScream808Mono` not `HD2_DistScream808`)
- [x] **PGMOD-02**: Amp model IDs shared directly with Helix — no suffix transformation needed
- [x] **PGMOD-03**: Pod Go-excluded models (Tone Sovereign, Clawthorn Drive, Cosmos Echo, Poly Pitch, Space Echo) never offered by AI planner
- [x] **PGMOD-04**: Device-filtered model list passed to AI planner prompt so Pod Go presets only reference Pod Go-available models

### Pod Go Signal Chain

- [x] **PGCHAIN-01**: Series-only routing with maximum 4 user-assignable effect blocks enforced (10 total: 6 fixed + 4 flexible)
- [x] **PGCHAIN-02**: No auto-inserted Parametric EQ or Gain Block for Pod Go — DSP budget reserved for user-facing effects
- [x] **PGCHAIN-03**: Chain assembly assigns all blocks to dsp:0, never splits across DSPs

### Pod Go Snapshots

- [x] **PGSNAP-01**: Exactly 4 snapshots generated (snapshot0-snapshot3) with `@controller: 4` for snapshot recall
- [x] **PGSNAP-02**: Volume-balanced snapshot design (Clean, Rhythm, Lead, Ambient) matching Helix quality standard with per-snapshot block states

### Pod Go Preset Quality

- [x] **PGQUAL-01**: Shared param-engine resolution — Pod Go presets receive same category/genre/topology-aware parameter defaults as Helix
- [x] **PGQUAL-02**: Mix-ready tone quality — proper cab filtering, dynamic responsiveness, and professional signal chain on Pod Go presets

### Pod Go Frontend & UX

- [x] **PGUX-01**: Pod Go appears as device option in the device selector dropdown
- [x] **PGUX-02**: Pod Go generation produces downloadable .pgp file with correct extension
- [x] **PGUX-03**: Signal chain visualization and tone card display 4 snapshots (not 8) for Pod Go presets

## v1.3 Requirements

Requirements for Rig Emulation milestone. Extend the tone interview to accept physical rig descriptions — text, pedal photos, or both — and generate a Helix/Pod Go preset that emulates the user's actual gear with transparent substitution mapping.

### Image Upload & Rig Input

- [ ] **RIG-01**: User can upload up to 3 pedal photos in the tone interview chat — drag-and-drop or file picker, individual pedal photos only (not full pedalboard)
- [ ] **RIG-02**: Photos are compressed client-side to under 800KB each before upload — smartphone photos never exceed the 4.5MB Vercel body limit; user sees "Compressing…" status, not a silent failure
- [ ] **RIG-03**: File type validation client-side — only image/jpeg, image/png, image/webp accepted; other file types show a clear user-facing error message
- [ ] **RIG-04**: User can describe their rig as plain text ("TS9 → Blues Breaker → Fender Twin Reverb") without any photos — text description is the primary input path; image upload is an enhancement
- [ ] **RIG-05**: Rig emulation integrates into the existing tone interview chat — no separate mode; the Gemini interview naturally accepts rig descriptions and photo attachments
- [ ] **RIG-06**: RigIntentSchema, PhysicalPedalSchema, SubstitutionEntrySchema, and SubstitutionMapSchema defined with Zod — single source of truth for TypeScript types and vision extraction output validation

### Vision Extraction Quality

- [ ] **VIS-01**: Vision extraction schema includes a confidence field (high/medium/low) — low-confidence identifications prompt user confirmation before proceeding to mapping
- [ ] **VIS-02**: Knob positions extracted as coarse zones (low/medium-low/medium-high/high, expressed as clock positions) — never raw percentages that misrepresent Claude's spatial reasoning accuracy for rotary dials
- [ ] **VIS-03**: When Claude cannot identify a pedal with confidence, it returns `modelName: null` with a description of what it observed — user is then prompted to type the pedal name; no silent wrong identification
- [ ] **VIS-04**: Vision API route (`/api/vision`) exports `maxDuration = 60` and requires Vercel Fluid Compute — no 504 timeouts for cold-start vision calls in production

### Pedal Mapping Engine

- [ ] **MAP-01**: `PEDAL_HELIX_MAP` static curated lookup table covers 40+ common pedals (Boss DS-1, Boss BD-2, Boss DD-3, Ibanez TS9, TS808, MXR Phase 90, Electro-Harmonix Big Muff Pi, ProCo Rat, etc.) with `helixModel`, `helixModelDisplayName`, `substitutionReason`, and `category`
- [ ] **MAP-02**: Mapping lookup returns three explicit match tiers — `exact` (pedal in table), `category` (pedal type known, best available Helix equivalent), `unknown` (no match possible) — each tier surfaces differently in the UI
- [ ] **MAP-03**: Unknown boutique pedals are presented as "best available match" with explicit uncertainty — never a confident exact-match mapping for a pedal not in the curated table
- [ ] **MAP-04**: Knob zone → Helix parameter value translation included in mapping entries for supported pedals — low/mid/high zones map to appropriate parameter ranges per pedal model's non-linear response
- [ ] **MAP-05**: Mapping layer works identically for Helix LT, Helix Floor, and Pod Go — device-aware model selection applies correct Pod Go suffixes (Mono/Stereo) when target is Pod Go

### Planner Integration

- [ ] **PLAN-01**: `callClaudePlanner()` gains an optional `toneContext` parameter that is appended to the user messages array (never to the system prompt) — existing `cache_control: ephemeral` block is preserved and prompt caching continues to function
- [ ] **PLAN-02**: After v1.3 deployment, `cache_read_input_tokens > 0` is verified in Anthropic API responses for rig emulation generation requests — confirmed via API response inspection
- [ ] **PLAN-03**: Text rig descriptions are parsed and passed through the mapping layer before the Planner call — the Planner receives `toneContext` with mapped Helix/Pod Go equivalents listed, not raw physical gear names

### API Architecture

- [ ] **API-01**: New `/api/vision` route handles image → RigIntent extraction independently — `/api/generate` contract is unchanged; adding images never modifies the existing request/response shape for text-only users
- [ ] **API-02**: Existing text-only generation flow is bit-for-bit identical post-v1.3 deployment — no new API calls, no changed loading states, no response shape changes for users who do not upload images
- [ ] **API-03**: Vision failure does not block preset generation — if `/api/vision` fails or returns low-confidence results, the user can fall back to text description and proceed normally through `/api/generate`

### Substitution Card UI

- [ ] **SUBST-01**: Substitution card appears in the chat flow before the Generate button — each entry shows `[Original Pedal Name] → [Helix Display Name]` with one-sentence plain-English rationale using guitarist vocabulary
- [ ] **SUBST-02**: No internal model IDs (`HD2_*`) appear anywhere in the substitution card or in any user-facing UI element — only human-readable display names (e.g., "Teemah!", "Minotaur", "Glitz Reverb")
- [ ] **SUBST-03**: Visual differentiation between exact matches and approximate/category matches — exact matches show full confident card, approximate matches show "Best available match" label with lower visual emphasis
- [ ] **SUBST-04**: Unknown pedals offer a text description escape hatch — "We don't have [Pedal Name] in our database. You can describe its sound instead, or we'll treat it as a [category] pedal" — user is never stuck

### Progressive UX

- [ ] **PROGUX-01**: Loading shows distinct labeled phases during rig emulation flow — "Analyzing pedal photo…" → "Mapping to Helix models…" → "Building preset…" — no blank spinner during the 15-20 second combined operation
- [ ] **PROGUX-02**: Rig emulation works with all three devices using the existing device selector — Helix LT, Helix Floor, and Pod Go all produce correct device-specific presets from the same rig input

## v2.0 Requirements

Requirements for Persistent Chat Platform milestone. Transform HelixAI from a stateless generate-and-download tool into a persistent platform with Google auth, conversation history, preset file storage, and chat sidebar UI.

### Authentication

- [ ] **AUTH-01**: User can sign in with Google via a "Sign in with Google" button — single OAuth provider, no email/password
- [ ] **AUTH-02**: User session persists across browser refreshes and tab closes — cookie-based token refresh handles expiry transparently
- [ ] **AUTH-03**: Anonymous users can generate and download presets without logging in — the existing anonymous flow is fully functional with zero auth gates
- [ ] **AUTH-04**: Anonymous-to-authenticated transition preserves in-progress chat state — OAuth redirect does not destroy the current conversation; state is serialized to sessionStorage before redirect and restored after callback
- [ ] **AUTH-05**: User can sign out — session is cleared, UI returns to anonymous state, sidebar is hidden

### Infrastructure

- [x] **INFRA-01**: Supabase project with PostgreSQL database, Auth, and Storage configured — `@supabase/supabase-js` and `@supabase/ssr` installed as the only new dependencies
- [x] **INFRA-02**: Row Level Security enabled on all tables at creation time — `conversations` and `messages` tables enforce `user_id = auth.uid()` on all operations; no user can read another user's data
- [x] **INFRA-03**: Middleware at project root refreshes session tokens on every non-static request — without this, JWT tokens expire and sessions break mid-use
- [x] **INFRA-04**: Two Supabase client utilities (browser client + server client) provide isomorphic database access across Client Components, Server Components, and Route Handlers
- [x] **INFRA-05**: Keep-alive mechanism prevents Supabase free-tier 7-day inactivity pause — automated ping every 4 days via cron job or GitHub Action
- [ ] **INFRA-06**: Environment variables configured in Vercel for both preview and production — Supabase URL, anon key, and Google OAuth callback URLs registered in Google Cloud Console

### Conversation Persistence

- [ ] **CONV-01**: User can create a new conversation — a conversation record is created in the database with a unique ID, user ID, device target, and auto-generated title
- [ ] **CONV-02**: Auto-generated conversation title derived from the first user message — no second AI call; client-side text extraction (5-8 words)
- [ ] **CONV-03**: Full message history (user + assistant messages) saved per conversation with server-assigned sequence numbers for correct ordering
- [ ] **CONV-04**: Device target (Helix LT / Helix Floor / Pod Go) stored as conversation metadata — restored when resuming
- [ ] **CONV-05**: User can list all their conversations ordered by most recent activity — API route returns conversation ID, title, device, timestamp
- [ ] **CONV-06**: User can delete a conversation — confirm dialog, messages and stored preset file removed, conversation removed from sidebar

### File Storage

- [ ] **STORE-01**: Most recent generated preset (.hlx or .pgp) stored in Supabase Storage per conversation — deterministic key with upsert overwrites on regeneration (one file per chat, not version history)
- [ ] **STORE-02**: User can re-download the stored preset from a resumed conversation without regenerating — "Download Preset" button fetches from storage
- [ ] **STORE-03**: Preset storage is a background operation — download completes immediately from the builder output; storage upload happens asynchronously and never blocks the user

### Chat Sidebar UI

- [ ] **SIDE-01**: Pull-out sidebar panel on the left side showing past conversations — collapsible on mobile, mounted in layout.tsx so it persists without re-mounting
- [ ] **SIDE-02**: Sidebar shows conversation title, device type, and relative timestamp for each chat — sorted by most recent activity
- [ ] **SIDE-03**: "New Chat" button in sidebar header clears the current session and starts a fresh conversation
- [ ] **SIDE-04**: Clicking a conversation in the sidebar resumes it — full message history loaded into the chat UI, device selector restored, "Download Preset" button available if a preset was previously generated
- [ ] **SIDE-05**: Sidebar is visible only when the user is authenticated — anonymous users see the standard full-width chat interface with no sidebar
- [ ] **SIDE-06**: Sidebar interactions (create, delete) use optimistic UI updates — sidebar responds instantly, rolls back on server error

### UX Polish

- [ ] **UXP-01**: Contextual sign-in prompt appears as a non-blocking banner after an anonymous user's first successful preset download — "Sign in to save this chat and come back to refine it later"
- [ ] **UXP-02**: Loading states during conversation resume show distinct phases — "Loading conversation..." with smooth transition to populated chat
- [ ] **UXP-03**: Continuation suggestion chips shown when resuming a past conversation — "Refine this tone", "Try a different amp", "Generate for [other device]" — static suggestions based on chat state, no AI call
- [ ] **UXP-04**: Existing text-only generation flow (no auth, no persistence) produces identical output and performance to v1.3 — no new API calls, no changed loading states, no response shape changes for anonymous users

## Future Requirements

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

### Extended Rig Emulation

- **RIG-V2-01**: Full pedalboard OCR from a single board photo — detect and identify all pedals automatically (deferred — too error-prone at v1.3 launch)
- **RIG-V2-02**: Rig emulation memory — save a rig description and regenerate for different devices without re-uploading
- **RIG-V2-03**: Expanded mapping table beyond 40 entries — community-sourced additions, boutique manufacturer coverage

### Extended Chat Platform

- **CHAT-V2-01**: Conversation search — full-text search on titles and first messages once users have 10+ chats
- **CHAT-V2-02**: Additional auth providers (GitHub, Apple) — only if Google OAuth proves to be a meaningful barrier
- **CHAT-V2-03**: Conversation export as JSON — GDPR-relevant at scale
- **CHAT-V2-04**: Preset metadata in sidebar — show device type icon alongside conversation title

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
| Full pedalboard OCR (single photo) | Too error-prone at launch — per-pedal photos are the reliable baseline (v1.3 scope) |
| Gemini/Google Vision for pedal extraction | Zero accuracy advantage over Claude for rotary knob reading; adds SDK complexity and API key management |
| Real-time cross-tab sync | WebSocket complexity not justified for a single-user sequential tool — simple refresh-on-focus is sufficient |
| Conversation folders/projects | Premature before search is needed — auto-chronological grouping is sufficient |
| All preset versions per chat | Storage costs grow unboundedly — store only the most recent preset per conversation |
| Email/password auth | Adds password reset flows and security surface with no v2.0 benefit — Google OAuth only |
| Chat sharing/permalinks | Exposes prompt engineering — the preset file is the shareable artifact |
| Cross-conversation memory | Changes the AI interaction model entirely — per-conversation context is sufficient |
| Offline mode | Service worker + IndexedDB complexity for a server-dependent AI app — the AI calls require internet anyway |

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
| PGP-01 | Phase 12 | Complete |
| PGP-02 | Phase 12 | Complete |
| PGP-03 | Phase 12 | Complete |
| PGP-04 | Phase 12 | Complete |
| PGP-05 | Phase 12 | Complete |
| PGMOD-01 | Phase 13 | Complete |
| PGMOD-02 | Phase 13 | Complete |
| PGMOD-03 | Phase 13 | Complete |
| PGMOD-04 | Phase 13 | Complete |
| PGCHAIN-01 | Phase 14 | Complete |
| PGCHAIN-02 | Phase 14 | Complete |
| PGCHAIN-03 | Phase 14 | Complete |
| PGSNAP-01 | Phase 15 | Complete |
| PGSNAP-02 | Phase 15 | Complete |
| PGQUAL-01 | Phase 15 | Complete |
| PGQUAL-02 | Phase 15 | Complete |
| PGUX-01 | Phase 16 | Complete |
| PGUX-02 | Phase 16 | Complete |
| PGUX-03 | Phase 16 | Complete |
| RIG-01 | Phase 19 | Complete |
| RIG-02 | Phase 19 | Complete |
| RIG-03 | Phase 19 | Complete |
| RIG-04 | Phase 20 | Complete |
| RIG-05 | Phase 20 | Complete |
| RIG-06 | Phase 17 | Complete |
| VIS-01 | Phase 19 | Complete |
| VIS-02 | Phase 19 | Complete |
| VIS-03 | Phase 19 | Complete |
| VIS-04 | Phase 19 | Complete |
| MAP-01 | Phase 18 | Complete |
| MAP-02 | Phase 18 | Complete |
| MAP-03 | Phase 18 | Complete |
| MAP-04 | Phase 18 | Complete |
| MAP-05 | Phase 18 | Complete |
| PLAN-01 | Phase 20 | Complete |
| PLAN-02 | Phase 20 | Complete |
| PLAN-03 | Phase 20 | Complete |
| API-01 | Phase 19 | Complete |
| API-02 | Phase 20 | Complete |
| API-03 | Phase 20 | Complete |
| SUBST-01 | Phase 21 | Complete |
| SUBST-02 | Phase 21 | Complete |
| SUBST-03 | Phase 21 | Complete |
| SUBST-04 | Phase 21 | Complete |
| PROGUX-01 | Phase 21 | Complete |
| PROGUX-02 | Phase 21 | Complete |
| INFRA-01 | Phase 24 | Complete |
| INFRA-02 | Phase 24 | Complete |
| INFRA-03 | Phase 24 | Complete |
| INFRA-04 | Phase 24 | Complete |
| INFRA-05 | Phase 24 | Complete |
| INFRA-06 | Phase 24 | Pending |
| AUTH-01 | Phase 25 | Pending |
| AUTH-02 | Phase 25 | Pending |
| AUTH-03 | Phase 25 | Pending |
| AUTH-04 | Phase 25 | Pending |
| AUTH-05 | Phase 25 | Pending |
| CONV-01 | Phase 26 | Pending |
| CONV-02 | Phase 26 | Pending |
| CONV-03 | Phase 26 | Pending |
| CONV-04 | Phase 26 | Pending |
| CONV-05 | Phase 26 | Pending |
| CONV-06 | Phase 26 | Pending |
| STORE-01 | Phase 27 | Pending |
| STORE-02 | Phase 27 | Pending |
| STORE-03 | Phase 27 | Pending |
| UXP-04 | Phase 27 | Pending |
| SIDE-01 | Phase 28 | Pending |
| SIDE-02 | Phase 28 | Pending |
| SIDE-03 | Phase 28 | Pending |
| SIDE-04 | Phase 28 | Pending |
| SIDE-05 | Phase 28 | Pending |
| SIDE-06 | Phase 28 | Pending |
| UXP-01 | Phase 28 | Pending |
| UXP-02 | Phase 28 | Pending |
| UXP-03 | Phase 28 | Pending |

**Coverage:**
- v1 requirements: 36 total (all complete)
- v1.1 requirements: 9 total (all complete)
- v1.2 requirements: 19 total (all complete)
- v1.3 requirements: 26 total (all complete, phases 17-21)
- v2.0 requirements: 24 total (all mapped, phases 24-28)
- Total mapped: 114/114

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-03 — v2.0 Persistent Chat Platform requirements mapped to phases 24-28; 100% coverage achieved*
