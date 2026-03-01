# Architecture

**Analysis Date:** 2026-03-01

## Pattern Overview

**Overall:** Layered web application with **Two-Phase AI Workflow** (Interview → Generation) and **Multi-Provider Abstraction**.

**Key Characteristics:**
- Client-server architecture using Next.js 16 with App Router
- Streaming chat phase (interview) followed by parallel generation phase
- Provider abstraction layer allowing side-by-side preset comparison across Gemini, Claude, and OpenAI
- Domain-specific generation: Helix LT preset builder with full .hlx file format support
- Real-time user feedback via Server-Sent Events (SSE) streaming

## Layers

**Presentation Layer (Client-Side UI):**
- Purpose: Real-time chat interface, provider selection, preset comparison, and download
- Location: `src/app/page.tsx` and global styling
- Contains: React component with message state, streaming handlers, provider toggles, preset comparison grid
- Depends on: `/api/chat`, `/api/generate`, `/api/providers` routes
- Used by: End users via browser

**API Layer (Next.js Route Handlers):**
- Purpose: Orchestrate AI operations and provider routing
- Location: `src/app/api/` (three route handlers)
- Contains:
  - `chat/route.ts`: Streaming interview chat (SSE-based)
  - `generate/route.ts`: Parallel preset generation across providers
  - `providers/route.ts`: List available providers (with availability status)
- Depends on: Provider clients, Helix preset builders
- Used by: Client-side fetch calls

**Provider Abstraction Layer:**
- Purpose: Unified interface to multiple AI models (Gemini, Claude, OpenAI)
- Location: `src/lib/providers.ts`
- Contains: Provider config registry, model endpoint wrappers, provider-specific API calls
- Depends on: SDK clients (@anthropic-ai/sdk, @google/genai, openai)
- Used by: `/api/generate` and `/api/chat` routes

**Chat System (Interview Phase):**
- Purpose: Guide user through tone preferences via conversation
- Location: `src/lib/gemini.ts`
- Contains: System prompts for chat phase (no model IDs), premium key validation, Gemini client creation
- Depends on: GoogleGenAI SDK
- Used by: `/api/chat` route to stream responses

**Preset Specification Generation:**
- Purpose: Transform conversation into validated Helix LT preset specification (JSON)
- Location: `src/lib/providers.ts` (generation functions)
- Contains: System prompt with full model ID list, provider-specific generation logic
- Depends on: Validation and builder modules
- Used by: `/api/generate` route for multi-provider parallel generation

**Helix Domain Module:**
- Purpose: Helix LT specific logic: model registry, validation, file building
- Location: `src/lib/helix/` (types, models, validation, preset-builder)
- Contains:
  - `types.ts`: PresetSpec, HlxFile, BlockSpec, SnapshotSpec interfaces
  - `models.ts`: Amp, cab, effect model registry with default parameters
  - `validate.ts`: Spec validation, auto-correction of invalid model IDs
  - `preset-builder.ts`: Convert PresetSpec to binary .hlx format
- Depends on: Internal type system only
- Used by: `/api/generate` for final preset output

## Data Flow

**Interview Phase (Chat):**

1. User submits tone description → `/api/chat` POST
2. API creates Gemini chat session with system prompt (interview-focused)
3. Gemini streams response via Server-Sent Events (SSE)
4. Client parses SSE chunks, updates UI in real-time
5. When AI decides it has enough info, response includes `[READY_TO_GENERATE]` marker
6. UI shows "Generate Preset" button

**Generation Phase (Parallel):**

1. User clicks "Generate" with provider selection → `/api/generate` POST
2. API validates requested providers have API keys
3. For each provider, fires parallel async requests:
   - Concatenate conversation history into context
   - Call provider-specific `generateWithProvider()` with system prompt (generation-focused)
   - Provider returns raw JSON text (may be wrapped in markdown fences)
4. Parse JSON → PresetSpec
5. Validate and auto-correct via `validateAndFixPresetSpec()`
6. Append provider name to preset name (32-char limit)
7. Build .hlx file via `buildHlxFile()`
8. Generate summary via `summarizePreset()`
9. Return all results in parallel response
10. Client displays side-by-side comparison grid or individual cards

**State Management:**

**Client-side:**
- React hooks: `messages[]`, `generatedResults`, `selectedProviders`, `isStreaming`, `isGenerating`
- Controlled via event handlers: `sendMessage()`, `generatePreset()`, `downloadPreset()`

**Server-side:**
- Stateless: Each request is independent
- Premium tier detection via URL parameter `?pro=<secret>` (client-side storage, passed to API)
- API key availability checked at generation time (not persisted)

## Key Abstractions

**Message Format:**
- Purpose: Unified interface for chat messages across AI providers
- Files: `src/app/page.tsx` (Message interface), `src/app/api/chat/route.ts`
- Pattern: `{ role: "user" | "assistant", content: string }`
- Implementation: Client stores array, passes to API, API converts to provider-specific format

**ProviderConfig:**
- Purpose: Registry of AI providers with metadata and credentials
- Files: `src/lib/providers.ts`
- Pattern: Record<providerId, { id, name, model, color, envKey }>
- Example: `PROVIDERS.gemini = { id: "gemini", name: "Gemini", model: "gemini-3.1-pro-preview", color: "#4285f4", envKey: "GEMINI_API_KEY" }`

**PresetSpec ↔ HlxFile:**
- Purpose: Intermediate representation (PresetSpec) decoupled from binary format (HlxFile)
- Files: `src/lib/helix/types.ts`, `src/lib/helix/preset-builder.ts`
- Pattern: AI generates PresetSpec JSON → validation → buildHlxFile() → binary output
- Benefit: Easier to inspect, debug, and modify specs vs. direct binary generation

**Block Indexing System:**
- Purpose: Unambiguous block reference in snapshots (per-DSP, excludes cabs)
- Pattern: block0, block1, block2... within each DSP (only non-cab blocks counted)
- Usage: snapshots reference blocks by key to enable/disable and override parameters
- Implementation: `validate.ts` normalizes block keys after position re-sequencing

## Entry Points

**Main UI Page:**
- Location: `src/app/page.tsx`
- Triggers: Browser load (SSR + client hydration)
- Responsibilities:
  - Fetch available providers on mount
  - Handle chat message submission and streaming
  - Show provider selector when ready to generate
  - Display comparison grid after generation
  - Download .hlx file on user request

**Chat API:**
- Location: `src/app/api/chat/route.ts`
- Triggers: POST /api/chat
- Responsibilities:
  - Validate message history
  - Create Gemini chat session
  - Stream response via SSE
  - Convert SSE to chunks and send to client

**Generation API:**
- Location: `src/app/api/generate/route.ts`
- Triggers: POST /api/generate
- Responsibilities:
  - Validate requested providers (existence + availability)
  - Fire parallel generation requests across providers
  - Parse, validate, and fix PresetSpec for each result
  - Build .hlx files and summaries
  - Return results with error handling

**Providers API:**
- Location: `src/app/api/providers/route.ts`
- Triggers: GET /api/providers
- Responsibilities:
  - Return all known providers with availability status
  - Allow client to show disabled state for providers without API keys

## Error Handling

**Strategy:** Pass-through with user-facing feedback

**Patterns:**

1. **Chat API Errors:**
   - SSE chunks include `{ error: "message" }` object
   - Client catches parse errors and logs warnings
   - User sees streamed errors in chat

2. **Generation API Errors:**
   - Provider request fails → captured via Promise.allSettled()
   - Per-provider failure returns `{ providerId, providerName, error: "reason" }`
   - Success results shown in grid, failures shown separately below
   - Original error messages preserved (API-specific)

3. **Validation Errors:**
   - `validateAndFixPresetSpec()` returns `{ valid, errors[], fixedSpec, fixed: boolean }`
   - Auto-correction applied (e.g., invalid model ID → closest match)
   - Warnings appended to summary: "**Auto-corrections applied:**\n- ..."

4. **HTTP Status Codes:**
   - 400: Bad request (missing providers, invalid conversation)
   - 500: Server error (generation failed)
   - 200: Success (with per-provider success/failure details inside response body)

## Cross-Cutting Concerns

**Logging:**
- Approach: console.warn/error for issues, no structured logging framework
- Examples:
  - `console.warn("[ProviderName] Validation issues:", validation.errors)`
  - `console.error("[ProviderName] Generation failed:", errorMsg)`

**Validation:**
- Approach: Layered validation
  1. Model ID validation via VALID_IDS set (from models database)
  2. Block position sequencing within DSP
  3. Snapshot block references (resolveBlockKey resolution)
  4. Mandatory fields in snapshots (block states for all blocks)

**Authentication:**
- Approach: Environment variable based (server-side API keys) + URL parameter (premium tier)
- Premium detection: `isPremiumKey(urlParam === PREMIUM_SECRET)`
- Uses higher-tier model when premium key present

**Type Safety:**
- Approach: TypeScript strict mode with comprehensive interfaces
- Key types: PresetSpec, HlxFile, ProviderConfig, Message, ProviderResult
- No runtime type checking (rely on TypeScript compilation)

---

*Architecture analysis: 2026-03-01*
