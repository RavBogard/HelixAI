# Architecture

**Analysis Date:** 2026-03-18

## Pattern Overview

**Overall:** Three-tier Multi-Agent Streaming Architecture with Deterministic Knowledge Layer

**Key Characteristics:**
- **Tier 1: AI Planning Layer** - Gemini planner generates creative tone intent (amp, cab, effects, snapshots)
- **Tier 2: Knowledge Layer** - Deterministic signal chain assembly + expert parameter resolution (no AI)
- **Tier 3: Audio Engineering Layer** - Tone Critic agent performs acoustic optimization on final preset
- **Device-Agnostic Design** - Core preset logic supports Helix, Pod Go, Stadium, and Stomp families with adapters
- **Real-time Streaming** - All API responses use Server-Sent Events (SSE) or NDJSON for progressive UI feedback
- **Authenticated Persistence** - Supabase for conversation history, preset storage, and usage tracking

## Layers

**Presentation Layer:**
- Purpose: React UI components for chat interface, signal chain visualizer, and device picker
- Location: `src/components/`, `src/app/page.tsx`, `src/app/visualizer/page.tsx`
- Contains: Chat components, sidebar, preset cards, visualizer components (SignalChainCanvas, BlockTile, ParameterEditorPane)
- Depends on: Zustand store (`src/lib/visualizer/store.ts`), API routes
- Used by: Browser client, next/link routing

**API Layer (Server-Rendered Routes):**
- Purpose: Next.js API routes handling streaming responses and business logic orchestration
- Location: `src/app/api/` (chat, generate, conversations, download, vision, preview, etc.)
- Contains: Request validation (Zod schemas), rate limiting, streaming response control, Supabase persistence
- Depends on: Gemini client, Knowledge Layer, Supabase server client
- Used by: Frontend fetch calls, external webhooks (cron/keep-alive)

**Prompt Router (Family Dispatcher):**
- Purpose: Routes device targets to device-family-specific prompt templates
- Location: `src/lib/prompt-router.ts`
- Pattern: Exhaustive switch on `DeviceFamily` type (helix, stomp, podgo, stadium) — compile-time check for missing families
- Responsible for: System prompts for chat, planner prompt templates with family-specific model lists
- Depends on: `src/lib/families/` subdirectories

**Gemini Integration Layer:**
- Purpose: Encapsulates Google Gemini API client creation and model selection
- Location: `src/lib/gemini.ts`
- Exports: `createGeminiClient()`, `getModelId(isPremium)`, `isPremiumKey()`
- Features: Premium tier detection, model downgrade fallback, rate limiting with Upstash Redis

**Knowledge Layer (Deterministic Pipeline):**
- Purpose: Transforms ToneIntent → PresetSpec → device-specific file format
- Location: `src/lib/helix/` (chain-rules.ts, param-engine.ts, snapshot-engine.ts, builders)
- Pipeline stages:
  1. `assembleSignalChain()` - Transforms ToneIntent into ordered BlockSpec[] with mandatory blocks inserted, parameters empty
  2. `resolveParameters()` - Fills every block parameter using expert-consensus lookup tables (derived from 250+ professional presets, no AI)
  3. `buildSnapshots()` - Creates snapshot configurations with parameter overrides based on tone roles
  4. Builders (`buildHlxFile`, `buildPgpFile`, `buildHspFile`, `buildStompFile`) - Encode PresetSpec into device-specific binary format
- No AI involvement — all numeric values deterministic and validated

**Device Family Abstraction:**
- Purpose: Encapsulate device-specific capabilities and constraints
- Location: `src/lib/helix/device-family.ts`
- Exports: `resolveFamily(DeviceTarget)`, `getCapabilities(DeviceTarget)` → DeviceCapabilities
- DeviceCapabilities includes: maxSnapshots, maxBlocks, ampCatalogEra, blockSlotLimits per DSP
- Used by: Knowledge Layer functions, planner (for model list filtering)

**Tone Intent Schema:**
- Purpose: Validates creative choices from planner (amp, cab, effects, snapshots)
- Location: `src/lib/helix/tone-intent.ts`
- Exports: `getToneIntentSchema()` - Zod schema for structured output validation
- Contains: ToneIntent interface (ampName, cabName, effects[], snapshots[], tempoHint, etc.)

**Validation Pipeline:**
- Purpose: Multi-stage preset quality assurance
- Location: `src/lib/helix/validate.ts`, `quality-validate.ts`, `intent-validate.ts`
- Stages:
  1. Structural validation: `validatePresetSpec()` - Checks DSP limits, block counts, signal flow
  2. Quality validation: `validatePresetQuality()` - Advisory warnings (not blocking)
  3. Intent fidelity audit: `auditIntentFidelity()` - Traces ToneIntent → PresetSpec mapping
- Error handling: Validation errors throw immediately (fail-fast), warnings logged asynchronously

**Visualizer Store (Client State):**
- Purpose: Zustand-based state management for signal chain editor
- Location: `src/lib/visualizer/store.ts`
- State: baseBlocks[], snapshots[], activeSnapshotIndex, selectedBlockId, controllerAssignments
- Actions: hydrate, moveBlock, setParameterValue, addBlock, removeBlock, selectBlock
- Diffs: originalBaseBlocks/originalSnapshots capture hydration state for change detection

**Visualizer Compilation:**
- Purpose: Real-time WebWorker-based preset compilation and validation
- Location: `src/lib/visualizer/compile-worker.ts`, `use-compiler-worker.ts`
- Pattern: Web Worker runs knowledge layer functions off main thread
- Prevents: UI blocking during parameter updates, visual feedback delays

**Rig Emulation (Optional):**
- Purpose: Maps user's physical pedalboard to Helix models for accurate emulation
- Location: `src/lib/rig-mapping.ts`, `src/app/api/vision/route.ts`
- Two paths:
  1. Vision path: User uploads photo → Gemini vision API extracts gear → RigIntent (high confidence)
  2. Text path: User describes rig as text → parseRigText() creates synthetic RigIntent (low confidence)
- Output: SubstitutionMap[] passed to planner context for weighted model selection
- Result: Substitution suggestions displayed alongside generated preset

**Conversation Persistence:**
- Purpose: Store chat history and generated presets per user per conversation
- Location: `src/lib/supabase/`
- Schema: conversations (id, user_id, title, preset_url, updated_at), messages (conversation_id, role, content, sequence_number)
- Pattern: Message insertion happens BEFORE streaming (user msg) and AFTER streaming completes (assistant msg)
- Files: `src/app/api/conversations/*` endpoints (CRUD)

**Usage Logging & Analytics:**
- Purpose: Track API token consumption for cost analysis and premium tier accounting
- Location: `src/lib/usage-logger.ts`
- Logged per request: endpoint, model_id, input_tokens, output_tokens, cache stats, cost_usd, device
- Used by: All API routes that invoke Gemini (chat, generate, planner, historian)

## Data Flow

**Chat Generation Flow:**

1. User sends message → POST `/api/chat`
2. Zod validation on request body (messages array, device, conversationId)
3. Rate limiter check (20 requests/hour per IP or conversation ID)
4. If authenticated: save user message to Supabase.messages
5. Gemini createGeminiClient().chats.create() with device-family system prompt
6. Stream response via ReadableStream → text chunks encoded as SSE `data: {text}...`
7. After stream closes: save assistant response to Supabase.messages, log token usage
8. Frontend receives chunks, appends to message list, updates UI

**Preset Generation Flow:**

1. User clicks "Generate" → POST `/api/generate` with messages, device, rigText/rigIntent, conversationId
2. Authentication check (user must be logged in)
3. **Phase 1: Historian** → callGeminiHistorian(messages) → GearBlueprint {recommendedAmp, mandatoryCoreEffects, optionalSweeteners, bpm, delaySubdivision}
4. Emit status: "Tone Historian analyzing..."
5. Build historianPromptInject combining recommended gear with rig substitutions
6. **Phase 2: Planner** → callGeminiPlanner(messages, device, deviceFamily, combinedContext, schemas) → ToneIntent (structured output)
7. Emit status: "Structuring signal chain..."
8. **Phase 3: Knowledge Layer** (deterministic, no AI):
   - assembleSignalChain(toneIntent, caps) → BlockSpec[] with empty parameters
   - resolveParameters(chain, toneIntent, caps) → BlockSpec[] fully parameterized
   - buildSnapshots(parameterized, toneIntent.snapshots, genreHint, snapshotTweaks) → SnapshotSpec[]
9. Emit status: "Resolving parameter engine..."
10. **Phase 4: Validation** (multi-stage):
    - validatePresetSpec(presetSpec, caps) — throws if invalid
    - validatePresetQuality(presetSpec, caps) — advisory warnings only
    - auditIntentFidelity(toneIntent, presetSpec) — trace mapping fidelity
11. Emit status: "Mastering engineer auditing audio..."
12. **Phase 5: Tone Critic** → Gemini secondary agent with MasteringCriticPrompt → parameter patch JSON
    - Parse JSON patches, apply to signalChain (if parameter exists on model)
    - Log applied patches or warnings if parameter not found
13. Emit status: "Finalizing preset encoding..."
14. **Phase 6: Builder** (device-specific):
    - If isStomp(device) → buildStompFile() → HlxFile (.hlx)
    - If isStadium(device) → buildHspFile() → HspFile (.hsp)
    - If isPodGo(device) → buildPgpFile() → PgpFile (.pgp)
    - Else (Helix) → buildHlxFile() → HlxFile (.hlx)
15. **Phase 7: Persistence** (non-blocking, fire-and-forget):
    - Upload preset file to Supabase Storage at `{userId}/{conversationId}/latest.{ext}`
    - Update conversations.preset_url and updated_at
16. Emit result: {preset, summary, spec, toneIntent, device, fileExtension, intentAudit, substitutionMap?}
17. Response closes, frontend displays result with download button

**Visualizer Hydration Flow:**

1. User clicks "Edit" on preset → GET visualizer data from preset JSON
2. `hydrate(device, baseBlocks, snapshots, ...)` populates store with preset state
3. `originalBaseBlocks` and `originalSnapshots` saved for diff tracking
4. User edits signal chain (drag blocks, change params, add/remove blocks)
5. Store mutations trigger Zustand state updates
6. `useCompilerWorker` hook spawns Web Worker with current state
7. Worker runs Knowledge Layer validation (assembleSignalChain, etc.) off-thread
8. Returns compilation result: valid/invalid, any errors
9. UI updates parameter pane, warnings display if validation fails
10. User clicks "Save to My Device" → GET `/api/preview` with current blocks JSON
11. Preview endpoint returns downloadable preset file with changes applied

**State Management:**

- **Presentation state** (UI-only): activeSnapshotIndex, selectedBlockId (component local state or Zustand)
- **Preset state** (persisted): baseBlocks[], snapshots[], presetName, tempo, description (Zustand store)
- **Diff baseline** (immutable): originalBaseBlocks, originalSnapshots (captured at hydration, never mutated)
- **Server state** (Supabase): conversations, messages, preset files in Storage
- **Client cache** (browser): usePresetAutoSave hook stores preset to localStorage on every mutation

## Key Abstractions

**PresetSpec:**
- Purpose: Device-agnostic intermediate representation of a preset (bridge between ToneIntent and file formats)
- Location: `src/lib/helix/types.ts`
- Contains: name, description, tempo, signalChain (BlockSpec[]), snapshots (SnapshotSpec[]), ampCategory, guitarNotes, variaxModel
- Pattern: Single source of truth for preset logic — builders consume PresetSpec, don't regenerate from ToneIntent

**BlockSpec:**
- Purpose: Atomic unit of preset signal flow (amp, cab, effect, dynamics, etc.)
- Location: `src/lib/helix/types.ts`
- Contains: type, modelId, modelName, dsp (0 or 1), path (0-9), position (0-3), parameters (Record<string, number|boolean>), enabled
- Invariant: Every parameter in parameters must exist on the model's schema (enforced by param-engine)

**ToneIntent:**
- Purpose: Creative intent from planner — amp, cab, effects, snapshots, tone roles, tempo hint
- Location: `src/lib/helix/tone-intent.ts`
- Immutable input to Knowledge Layer — never mutated after planner returns
- No parameters, no numeric values — planner makes only HIGH-LEVEL choices

**DeviceCapabilities:**
- Purpose: Encapsulates device-specific limits and constraints
- Location: `src/lib/helix/device-family.ts`
- Exports: maxSnapshots, maxBlocks, ampCatalogEra ("original" or "agoura"), blockSlotLimits per type
- Immutable singleton per device — avoids recomputing constraints

**SubstitutionMap:**
- Purpose: Array of pedal-to-Helix mappings with confidence levels
- Location: `src/lib/helix/rig-intent.ts`
- Contains: physicalPedal (string), helixModelDisplayName, confidence ("high"|"medium"|"low"), substitutionReason
- Flow: Vision/text rig parsing → mapRigToSubstitutions() → SubstitutionMap[] → format as planner context

**GearBlueprint:**
- Purpose: Audio engineer's analysis of original recording (from Historian agent)
- Location: `src/lib/families/shared/historian-prompt.ts`
- Contains: recommendedAmp, mandatoryCoreEffects[], optionalSweeteners[], recommendedCab, bpm, delaySubdivision, historianNotes, requiredSchemas
- Result: Injected into planner context to constrain creative choices toward audio-accurate models

## Entry Points

**Web Application:**
- Location: `src/app/page.tsx` (HomeContent component)
- Triggers: User navigates to root URL
- Responsibilities: Manage messages state, chat input/output, device picker, generation flow, preset display
- Pattern: `use client` directive — full client-side rendering with progressive hydration from Supabase auth

**Visualizer Page:**
- Location: `src/app/visualizer/page.tsx`
- Triggers: User clicks "Edit Preset" from main chat interface
- Responsibilities: Render SignalChainCanvas, ParameterEditorPane, SnapshotSelectorBar with interactive editing
- Pattern: Client component with Zustand store hydration from preset data

**Chat API Streaming:**
- Location: `src/app/api/chat/route.ts`
- Triggers: POST request with {messages, device, conversationId, premiumKey}
- Responsibilities: Validate input, apply rate limit, create Gemini chat session, stream response as SSE
- Streaming pattern: ReadableStream with TextEncoder, `data: {text}...\n\n` format

**Generate API NDJSON Streaming:**
- Location: `src/app/api/generate/route.ts`
- Triggers: POST request with {messages, device, rigIntent, rigText, conversationId, premiumKey, acousticEmpathyEnabled}
- Responsibilities: Orchestrate 3-agent pipeline (Historian → Planner → Critic), emit status updates, return final preset
- Streaming pattern: ReadableStream with NDJSON format `{type, message/payload}` per line

**Auth Callback:**
- Location: `src/app/auth/callback/route.ts`
- Triggers: Supabase OAuth callback (Google, GitHub, etc.)
- Responsibilities: Exchange code for session, set secure cookies, redirect to dashboard

**Vision API:**
- Location: `src/app/api/vision/route.ts`
- Triggers: POST request with image data for rig detection
- Responsibilities: Extract gear from image using Gemini vision, return RigIntent with confidence scores

**Download API:**
- Location: `src/app/api/download/route.ts`
- Triggers: User clicks "Download Preset" button
- Responsibilities: Fetch preset from Supabase Storage, stream file with correct MIME type and attachment header

## Error Handling

**Strategy:** Fail-fast for structural errors, log warnings for quality issues

**Patterns:**

1. **Structural Validation (throws immediately):**
   - validatePresetSpec() in Knowledge Layer — DSP limits, block counts, topology rules
   - Example: "DSP 0 exceeds 64-block limit"
   - Recovery: User sees error message, must modify tone intent and regenerate

2. **Quality Validation (logs, never blocks):**
   - validatePresetQuality() — advisory warnings only
   - Example: "EQ boosts exceed +8dB (mastering headroom risk)"
   - Recovery: Logged to quality-logger for analytics, user sees green checkmark anyway

3. **Intent Fidelity Audit (logs, never blocks):**
   - auditIntentFidelity() — traces ToneIntent → PresetSpec with warnings for mapping gaps
   - Example: "Planner requested reverb 'Large Hall' but device only supports 'Large Room'"
   - Recovery: Logged to console, substitute effect still placed successfully

4. **API Response Errors (JSON error + HTTP status):**
   - 400: Invalid payload (Zod validation failure)
   - 401: Authentication required
   - 429: Rate limit exceeded
   - 500: Server error (Gemini failure, database failure, unexpected exception)

5. **Streaming Error Handling:**
   - Chat: Emit `data: {error}...` on stream exception, close stream gracefully
   - Generate: Emit `{error}...` as final NDJSON line, close stream

## Cross-Cutting Concerns

**Logging:**
- Framework: `console.log` and `console.error` throughout codebase
- Pattern: Inline prefixes for context (`[intent-audit]`, `[tone-critic]`, `[chain-rules]`, `[param-engine]`)
- No centralized logger — each module owns its diagnostics

**Validation:**
- Framework: Zod for runtime schema validation
- Pattern: `safeParse()` on API input, throw on parsing failure, detailed error format in response
- Preset validation: Multi-stage pipeline (structural → quality → intent fidelity)

**Authentication:**
- Provider: Supabase Auth (OAuth + JWT)
- Pattern: `createSupabaseServerClient()` in API routes, `createSupabaseBrowserClient()` in client components
- Session: Secure httpOnly cookie set by middleware (Phase 24)
- Check: `supabase.auth.getUser()` returns authenticated user or throws

**Rate Limiting:**
- Service: Upstash Redis + Ratelimit module
- Pattern: 20 requests/hour per conversation ID (or IP if anonymous)
- Fallback: If UPSTASH_REDIS_REST_URL/TOKEN missing, limiter disabled (local dev)
- Premium: premiumKey bypasses rate limit

**Authorization:**
- Scope: User can only access their own conversations and presets
- Pattern: Verify conversation.user_id === authenticated user.id before returning data
- Enforcement: `src/app/api/conversations/[id]/route.ts` (all CRUD operations)

---

*Architecture analysis: 2026-03-18*
