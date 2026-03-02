# Architecture

**Analysis Date:** 2026-03-02

## Pattern Overview

**Overall:** Layered three-stage pipeline with strict separation between creative AI decision-making (Planner), deterministic signal chain assembly (Knowledge Layer), and binary file generation (Builders).

**Key Characteristics:**
- **Two AI models operating at different abstraction levels**: Gemini (chat/conversation), Claude (structured creative decisions only)
- **Zero numeric parameters from AI**: All parameter values come from expert-consensus lookup tables
- **Device target polymorphism**: Single codebase generates both Helix (.hlx) and Pod Go (.pgp) presets via conditional logic
- **Deterministic pipeline with no randomness**: Every operation is traceable and repeatable
- **Vision-based rig emulation layer**: Analyzes physical pedal boards and maps hardware pedals to Helix/Pod Go equivalents

## Layers

**Presentation Layer (React/Next.js Frontend):**
- Purpose: Tone interview UI, preset playback visualization, rig image upload
- Location: `src/app/page.tsx`, `src/app/layout.tsx`, styles in `src/app/globals.css`
- Contains: React client components with real-time chat interface, signal chain visualization, and download handlers
- Depends on: API routes for chat, generation, vision, and map endpoints
- Used by: End users interviewing tone and downloading presets

**Streaming Chat API:**
- Purpose: Real-time Gemini-powered conversation for tone interview
- Location: `src/app/api/chat/route.ts`
- Contains: POST endpoint that streams SSE responses from Gemini with Google Search tool enabled
- Depends on: `@/lib/gemini` for client initialization and system prompts
- Used by: Frontend to conduct tone interview conversation

**Planner (AI Creative Layer):**
- Purpose: Single point of AI decision-making — translates tone interview into structured ToneIntent
- Location: `src/lib/planner.ts`
- Contains: Claude prompt builder and structured output handler using Zod validation
- Depends on: `@anthropic-ai/sdk`, `zodOutputFormat`, model name lists from `@/lib/helix/models`
- Used by: `/api/generate` route to bootstrap the pipeline
- Guarantees: Only creative choices (amp, cab, effects, snapshots) — zero numeric parameters

**Knowledge Layer (Deterministic Transformation):**
- Purpose: Convert creative choices into full preset specification with all parameters
- Location: `src/lib/helix/` (multiple modules)
- Contains:
  - `chain-rules.ts`: Assembles signal chain blocks in canonical order with DSP assignment
  - `param-engine.ts`: Fills all numeric parameters via expert-consensus lookup tables
  - `snapshot-engine.ts`: Generates 4 snapshots with role-aware block states and volume balancing
  - `validate.ts`: Structural validation of PresetSpec against device constraints
- Depends on: Model catalogs from `models.ts`, device constants from `types.ts`
- Used by: `/api/generate` to transform ToneIntent into PresetSpec
- No AI involved: All operations are table lookups and deterministic transformations

**Rig Emulation Layer:**
- Purpose: Map physical pedal boards to Helix/Pod Go substitutions
- Location: `src/lib/rig-vision.ts`, `src/lib/rig-mapping.ts`, `src/app/api/vision/route.ts`
- Contains:
  - Vision route: Validates and routes base64 images to Claude for rig analysis
  - Rig vision planner: Claude extracts pedal list and creates RigIntent via Zod
  - Rig mapping: Lookup tables that map physical pedal names to Helix models with confidence tiers
- Depends on: Anthropic SDK, vision model, pedal database
- Used by: `/api/generate` when user provides rig context (either via vision or text description)
- Integration point: Builds toneContext string passed to Planner to prioritize matched models

**Builders (Binary File Generation):**
- Purpose: Convert PresetSpec into device-specific binary format (.hlx or .pgp)
- Location: `src/lib/helix/preset-builder.ts`, `src/lib/helix/podgo-builder.ts`
- Contains:
  - `buildHlxFile()`: Constructs HlxFile JSON/binary with all DSP blocks, snapshots, and controllers
  - `buildPgpFile()`: Pod Go variant with fixed block layout and 4-snapshot constraint
  - `summarizePreset()`: Human-readable preset description for UI display
- Depends on: PresetSpec, device constants, firmware config
- Used by: `/api/generate` to finalize output
- Device-aware: Pod Go path uses simplified cabinet model, 10 fixed blocks, 4 snapshots only

**API Generate Route (Orchestrator):**
- Purpose: Coordinates entire pipeline from message history to downloadable preset
- Location: `src/app/api/generate/route.ts`
- Contains: POST handler that chains: Planner → Chain Rules → Param Engine → Snapshots → Validation → Builder
- Depends on: All helix lib modules, planner, rig-mapping
- Used by: Frontend after user confirms tone intent
- Control flow:
  1. Extract device target (helix_lt/helix_floor/pod_go)
  2. Build rig context if substitutionMap present (via vision or text)
  3. Call Claude Planner with toneContext
  4. Run Knowledge Layer pipeline (chain → params → snapshots)
  5. Validate PresetSpec
  6. Build file format (HLX or PGP)
  7. Return JSON with preset, summary, and metadata

## Data Flow

**Tone Interview Flow:**

1. User opens app, sees chat interface
2. Frontend calls `/api/chat` with message history
3. Route creates Gemini chat session with system prompt, sends message stream
4. Frontend displays Gemini response in real-time via SSE
5. User responds, cycle repeats (multi-turn conversation)

**Preset Generation Flow (Standard):**

1. User clicks "Generate Preset" button with message history
2. Frontend calls `/api/generate` with: `messages`, `device` (optional), empty `rigIntent`/`rigText`
3. Route resolves device target (defaults to helix_lt)
4. Route calls `callClaudePlanner()` with system prompt + model list + message history
5. Claude returns structured ToneIntent (Zod-validated)
6. Route calls `assembleSignalChain(toneIntent, device)`:
   - Resolves each effect model name against catalogs
   - Classifies effects into chain slots (wah, compressor, boost, amp, cab, modulation, delay, reverb, gate, EQ)
   - Orders blocks according to canonical signal path: DSP0 (pre-amp → post-cab) or DSP1 (FX)
   - Assigns DSP indices (0 or 1) respecting capacity limits and topology rules
   - Returns BlockSpec[] with empty parameters
7. Route calls `resolveParameters(chain, toneIntent)`:
   - For each block, looks up its category/topology
   - Applies category defaults (clean/crunch/high_gain) from AMP_DEFAULTS table
   - Applies model-specific overrides from model definitions
   - Fills all numeric fields (Drive, Master, LowCut, etc.)
8. Route calls `buildSnapshots(parameterized, snapshots)`:
   - For each snapshot intent (clean/crunch/lead/ambient):
   - Determines which blocks enabled/disabled per role
   - Applies role-specific volume adjustments (ChVol, Gain dB)
   - Overrides Mix parameters for ambient effects in ambient snapshot
   - Assigns LED colors by role
9. Route creates PresetSpec and calls `validatePresetSpec(spec, device)`:
   - Checks block count per DSP (≤8 for Helix, ≤10 total for Pod Go)
   - Validates snapshot count (4 for Pod Go, 8 for Helix)
   - Confirms all model IDs available for device
10. Route calls builder:
    - For Pod Go: `buildPgpFile()` → .pgp JSON structure
    - For Helix: `buildHlxFile()` → .hlx JSON structure
11. Route returns JSON with: preset (file content), summary (text), spec, toneIntent, device, fileExtension

**Rig Emulation Flow (Vision Path):**

1. User uploads image of pedal board via upload widget
2. Frontend compresses image to ~800 KB, base64 encodes, calls `/api/vision`
3. Vision route validates base64 length, media type, count (max 3 images)
4. Route calls `callRigVisionPlanner(images)`:
   - Sends images to Claude with system prompt for rig analysis
   - Claude identifies pedals and returns RigIntent (Zod-validated)
5. Frontend stores rigIntent in client state
6. When user clicks "Generate Preset", rigIntent is sent to `/api/generate`
7. Generate route calls `mapRigToSubstitutions(rigIntent, device)`:
   - For each PhysicalPedal in rigIntent:
   - Normalizes pedal.fullName (lowercase, trim)
   - Looks up in PEDAL_HELIX_MAP (53 entries across 7 pedal categories)
   - Returns SubstitutionEntry with: physicalPedal, helixModelDisplayName, confidence (direct/close/approximate), substitutionReason
8. Generate route builds toneContext string from substitutionMap
9. toneContext appended to user message (preserves system prompt for caching)
10. Planner sees substitutions and prioritizes those models in ToneIntent
11. Knowledge Layer builds preset using AI-selected amp/cab/effects, but with user's physical rigs considered

**Rig Emulation Flow (Text Path):**

1. User types rig description in text box (e.g., "I have a Tube Screamer and a Boss Reverb")
2. Frontend stores text in `rigText` state
3. When user clicks "Generate Preset", rigText sent to `/api/generate`
4. Generate route calls `parseRigText(rigText)`:
   - Splits on conjunctions (and/or), commas, newlines
   - Creates synthetic PhysicalPedal entries with confidence "low"
5. Remainder of flow identical to vision path (mapRigToSubstitutions → toneContext → Planner → etc.)

## State Management

**Client State (React):**
- `messages`: Array<{role, content}> — conversation history
- `rigIntent`: RigIntent | null — structured rig from vision or text
- `rigText`: string — user's text rig description
- `device`: DeviceTarget — helix_lt | helix_floor | pod_go
- No persistent storage; state lost on page refresh

**Server State:**
- Environment variables: `CLAUDE_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`
- No database; each request is stateless

## Key Abstractions

**ToneIntent:**
- Purpose: Narrow contract between Planner and Knowledge Layer
- Location: `src/lib/helix/tone-intent.ts`
- Contains: ampName, cabName, guitarType, effects[], snapshots[], tempoHint, presetName, description, guitarNotes
- Enforces: Zero numeric parameters; all enums validated against model names
- Pattern: Zod schema + TypeScript inference (single source of truth)

**PresetSpec:**
- Purpose: Intermediate representation before binary encoding
- Location: `src/lib/helix/types.ts`
- Contains: name, description, tempo, signalChain[], snapshots[]
- Pattern: Full numeric specification; every parameter is a number, every block is resolved

**HlxFile / HlxTone:**
- Purpose: Type-safe Helix .hlx binary structure
- Location: `src/lib/helix/types.ts`
- Contains: Nested objects matching Helix file format (dsp0, dsp1, snapshots[], controllers, footswitch, global)
- Pattern: Mirrors actual binary layout; stringified to JSON during download

**BlockSpec:**
- Purpose: Single signal chain block with full parameters
- Location: `src/lib/helix/types.ts`
- Contains: type, modelId, modelName, dsp (0|1), position, path, enabled, stereo, parameters {}
- Pattern: Mutable during Knowledge Layer pipeline (params filled incrementally)

**DeviceTarget:**
- Purpose: Polymorphic enum for Helix variants and Pod Go
- Location: `src/lib/helix/types.ts`
- Values: helix_lt | helix_floor | pod_go
- Used by: Chain rules (Pod Go constraints), builders (device-specific format), Planner (model filtering)

**RigIntent:**
- Purpose: Structured representation of physical pedal board
- Location: `src/lib/helix/rig-intent.ts`
- Contains: Array of PhysicalPedal {fullName, model, category, confidence, knobPositions}
- Source: Claude vision analysis of images
- Pattern: Zod schema + TypeScript type inference

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: Page load
- Responsibilities: Wraps entire app with metadata, fonts, styles, and ambient visual effects

**Root Page:**
- Location: `src/app/page.tsx`
- Triggers: User navigates to /
- Responsibilities: Renders chat interface, tone interview UI, rig upload widget, and preset visualization

**Chat API:**
- Location: `src/app/api/chat/route.ts`
- Triggers: POST from frontend with messages
- Responsibilities: Stream Gemini responses with Google Search enabled

**Vision API:**
- Location: `src/app/api/vision/route.ts`
- Triggers: POST from frontend with base64 images
- Responsibilities: Extract pedal list from images, return RigIntent

**Generate API:**
- Location: `src/app/api/generate/route.ts`
- Triggers: POST from frontend with message history, optional device, optional rig context
- Responsibilities: Orchestrate entire pipeline from ToneIntent to preset file

**Map API:**
- Location: `src/app/api/map/route.ts`
- Triggers: Testing/debugging endpoint for direct model list queries
- Responsibilities: Return available models for a device (used for Planner prompt construction)

## Error Handling

**Strategy:** Try-catch at route handler level with Next.json error responses (500, 400, 413)

**Patterns:**
- Validation errors (400): Invalid image count, invalid media type, missing device
- Client errors (400): No messages provided, no images provided, image too large
- Server errors (500): Catch-all for Zod validation failures, API failures, unknown errors
- Specific error messages returned to client for UI feedback

**Example (Vision Route):**
```typescript
if (images.length > MAX_IMAGES) {
  return NextResponse.json(
    { error: `Maximum ${MAX_IMAGES} images allowed` },
    { status: 400 }
  );
}
// ... validation continues ...
return NextResponse.json({ error: message }, { status: 500 });
```

## Cross-Cutting Concerns

**Logging:**
- Approach: console.error() for failures in route handlers
- Examples: "Preset generation error: {message}", "Vision extraction error: {message}"
- No persistent logs; suitable for Vercel ephemeral functions

**Validation:**
- Device target validation: Enum check (helix_lt/helix_floor/pod_go defaults to helix_lt)
- Image validation: Media type whitelist, base64 length limit (1.2M chars), array bounds (1-3 images)
- PresetSpec validation: `validatePresetSpec()` checks block counts, snapshot counts, model availability per device
- Zod schema validation: ToneIntentSchema, RigIntentSchema, SnapshotIntentSchema ensure correct structure and enum membership

**Authentication:**
- Approach: Environment variables (CLAUDE_API_KEY, GOOGLE_API_KEY, GEMINI_API_KEY)
- No user accounts, no session state
- Premium Gemini access: Checked via premiumKey query parameter (GEMINI_PREMIUM feature flag)

**Device Polymorphism:**
- Constraint enforcement per device:
  - **Helix LT/Floor**: 8 blocks per DSP max, 8 snapshots, both dsp0 and dsp1 available
  - **Pod Go**: 10 total blocks fixed (wah + vol + amp + cab + eq + fxloop + 4 user), 4 snapshots, dsp0 only, special block layout
- Model filtering: `getModelListForPrompt(device)` returns device-compatible models only
- File format: Conditional builder selection in `/api/generate` (HLX vs PGP)
- Chain constraints: Pod Go-specific rules in `assembleSignalChain()` to avoid dsp1 assignment

---

*Architecture analysis: 2026-03-02*
