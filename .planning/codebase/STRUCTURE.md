# Codebase Structure

**Analysis Date:** 2026-03-18

## Directory Layout

```
/c/Users/dsbog/helixai/
├── src/                        # Application source code
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes and handlers
│   │   ├── auth/               # OAuth callback route
│   │   ├── visualizer/         # Signal chain editor page
│   │   ├── page.tsx            # Root chat interface
│   │   ├── layout.tsx          # Root layout with auth check
│   │   └── opengraph-image.tsx # OG preview image
│   ├── components/             # React UI components
│   │   ├── chat/               # Chat-specific components
│   │   ├── sidebar/            # Conversation sidebar
│   │   ├── visualizer/         # Signal chain editor components
│   │   ├── auth/               # Authentication button
│   │   ├── DevicePicker.tsx    # Device selection dropdown
│   │   ├── PresetCard.tsx      # Preset display card
│   │   └── Footer.tsx          # Global footer
│   ├── lib/                    # Core business logic
│   │   ├── helix/              # Preset generation engine
│   │   ├── families/           # Device-family-specific prompts
│   │   ├── visualizer/         # Signal chain editor logic
│   │   ├── supabase/           # Database/auth clients
│   │   ├── gemini.ts           # Gemini API client wrapper
│   │   ├── planner.ts          # Multi-agent orchestration
│   │   ├── prompt-router.ts    # Device family dispatcher
│   │   ├── rig-mapping.ts      # Physical gear emulation
│   │   ├── rig-vision.ts       # Image-based gear detection
│   │   └── usage-logger.ts     # Token consumption tracking
│   └── app/globals.css         # Global tailwind styles
├── public/                     # Static assets (favicons, images)
├── supabase/                   # Database schema and migrations
├── scripts/                    # Build and utility scripts
│   └── baseline/               # Baseline testing suite
├── middleware.ts               # Request routing for auth
├── next.config.ts              # Next.js configuration
├── package.json                # NPM dependencies
├── tsconfig.json               # TypeScript configuration
├── eslint.config.mjs           # Linter configuration
└── .env.local                  # Environment variables (not committed)
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router pages and API routes (v14.0+ directory structure)
- Pattern: File-based routing — `api/chat/route.ts` → POST /api/chat
- Execution context: SSR (server) for layout.tsx and page auth check, API routes with maxDuration override

**src/app/api:**
- Purpose: Streaming API handlers for chat, generation, persistence, downloads
- Key files:
  - `chat/route.ts` — Chat completion streaming via SSE
  - `generate/route.ts` — Preset generation with 3-agent pipeline (Historian, Planner, Critic)
  - `conversations/*` — CRUD endpoints for conversation management
  - `download/route.ts` — Preset file download with MIME type dispatch
  - `vision/route.ts` — Image-based gear extraction via Gemini vision
  - `preview/route.ts` — Real-time preset compilation for visualizer changes
- Pattern: Each route validates input (Zod), performs auth check, streams response

**src/components:**
- Purpose: Reusable React components for UI layout and interaction
- Sub-structure:
  - `chat/` — ChatMessage, ChatInput, SuggestionChips (message display and input)
  - `sidebar/` — ChatSidebar, ConversationList (conversation navigation)
  - `visualizer/` — SignalChainCanvas, BlockTile, ParameterEditorPane, SnapshotSelectorBar (signal chain editor)
  - `auth/` — AuthButton (login/logout UI)
  - Top-level: DevicePicker, PresetCard, WelcomeScreen, DonationCard, Footer

**src/lib/helix:**
- Purpose: Device-agnostic preset generation engine — core business logic
- Sub-modules:
  - **types.ts** — Type definitions (PresetSpec, BlockSpec, SnapshotSpec, HlxFile, DeviceTarget enums)
  - **models.ts** — Master catalog of all amp, cab, effect models with parameters and defaults (generated from line6-models repo)
  - **config.ts** — Device firmware versions and configuration constants
  - **device-family.ts** — Device capability resolution and constraint checking
  - **tone-intent.ts** — ToneIntent schema and Zod validation
  - **chain-rules.ts** — Signal chain assembly (ToneIntent → BlockSpec[] with empty parameters)
  - **param-engine.ts** — Parameter resolution using expert-consensus lookup tables (no AI)
  - **snapshot-engine.ts** — Snapshot creation with parameter overrides per tone role
  - **validate.ts** — Structural validation (DSP limits, topology rules)
  - **quality-validate.ts** — Quality warnings (mastering headroom, parameter ranges)
  - **intent-validate.ts** — Intent fidelity audit (ToneIntent → PresetSpec mapping trace)
  - **preset-builder.ts** — Encodes PresetSpec → HlxFile (Helix/Floor/LT format)
  - **podgo-builder.ts** — Encodes PresetSpec → PgpFile (Pod Go format)
  - **stadium-builder.ts** — Encodes PresetSpec → HspFile (Stadium format)
  - **stomp-builder.ts** — Encodes PresetSpec → HlxFile (Stomp format)
  - **catalogs/** — Per-family model name lists and semantic dictionaries
  - **Test files** — Corresponding `.test.ts` files for all core modules

**src/lib/families:**
- Purpose: Device-family-specific prompt templates and system instructions
- Sub-modules per family (helix, stomp, podgo, stadium):
  - `prompt.ts` — buildPlannerPrompt(device) and getSystemPrompt(device) for chat
  - `prompt.test.ts` — Prompt validation tests
- Shared modules:
  - `shared/historian-prompt.ts` — Audio engineer analysis system prompt (Historian agent)
  - `shared/critic-prompt.ts` — Mastering engineer optimization prompt (Tone Critic agent)
  - `shared/effect-model-intelligence.ts` — Effect category mapping and model selection heuristics
  - `shared/tone-intent-fields.ts` — ToneIntent schema extensions per family

**src/lib/visualizer:**
- Purpose: Signal chain editor logic and real-time compilation
- Key files:
  - **store.ts** — Zustand state management (baseBlocks, snapshots, controller assignments)
  - **hydrate.ts** — Deserialize preset JSON into store state
  - **dehydrate.ts** — Serialize store state to JSON for persistence
  - **compile-worker.ts** — Web Worker entry point for off-thread Knowledge Layer execution
  - **use-compiler-worker.ts** — Hook that spawns/communicates with worker
  - **use-preset-auto-save.ts** — Hook that saves store state to localStorage on every mutation
  - **parameter-schema.ts** — Model parameter catalog with type/range/default lookup
  - **device-layout.ts** — Device-specific block slot limits and routing constraints
  - **dnd-constraints.ts** — Drag-and-drop validation rules
  - **param-dependencies.ts** — Cross-parameter state dependencies (if A changes, B must update)
  - **state-diff.ts** — Compute minimal JSON diff for efficient storage
  - **block-ui-registry.ts** — UI component registry for block types
  - **Test files** — Corresponding `.test.ts` files for core modules

**src/lib/supabase:**
- Purpose: Database and authentication client initialization
- Files:
  - **server.ts** — createSupabaseServerClient() for API routes (uses SUPABASE_SERVICE_ROLE_KEY)
  - **client.ts** — createSupabaseBrowserClient() for client components (public anon key)
  - **middleware.ts** — updateSession() middleware for auth cookie refresh

**src/lib/planner.ts:**
- Purpose: Multi-agent orchestration and Gemini client management
- Exports: callGeminiPlanner(), callGeminiHistorian(), token usage logging
- Pattern: Builds Gemini JSON schema from device-specific catalogs, calls structured output endpoint, repairs JSON if needed

**src/lib/prompt-router.ts:**
- Purpose: Central dispatcher for device-family-specific prompts
- Exports: getFamilyPlannerPrompt(device), getFamilyChatPrompt(device)
- Pattern: Exhaustive switch on resolveFamily(device) — compile-time check for missing families

**src/lib/gemini.ts:**
- Purpose: Gemini API client wrapper with premium tier handling
- Exports: createGeminiClient(), getModelId(isPremium), isPremiumKey()
- Logic: Returns gemini-2.0-flash-exp for premium, falls back to gemini-2.0-flash-001 for free tier

**src/lib/rig-mapping.ts:**
- Purpose: Physical pedal rig → Helix model substitutions
- Exports: mapRigToSubstitutions(), parseRigText()
- Pattern: Three-tier lookup (perfect match → family match → category match) with confidence scores

**src/lib/rig-vision.ts:**
- Purpose: Image-based gear detection via Gemini vision API
- Exports: extractRigFromImage()
- Pattern: Parse vision response JSON, validate with RigIntentSchema

**src/lib/usage-logger.ts:**
- Purpose: Token consumption tracking for cost accounting
- Exports: logUsage(), estimateGeminiCost()
- Logged per request: input_tokens, output_tokens, cache_tokens, total_tokens, cost_usd, endpoint, device
- Used by: All Gemini API calls (chat, generate, planner, historian)

**middleware.ts:**
- Purpose: Request-level auth session update
- Pattern: Called on every request (configurable matcher), refreshes Supabase session cookies
- Uses: updateSession() from src/lib/supabase/middleware

## Key File Locations

**Entry Points:**

- `src/app/page.tsx` — Root chat interface, HomeContent component
- `src/app/layout.tsx` — Global layout with auth check, sidebar conditional render
- `src/app/visualizer/page.tsx` — Signal chain editor page
- `src/app/opengraph-image.tsx` — Social share preview image

**Configuration:**

- `next.config.ts` — Next.js build and runtime configuration
- `tsconfig.json` — TypeScript compiler options (strict mode, path aliases)
- `eslint.config.mjs` — ESLint rules (Next.js plugin, import ordering)
- `package.json` — Dependencies (Next.js, React 19, Zustand, Tailwind, Zod, etc.)
- `src/lib/helix/config.ts` — Device firmware versions, constants (HLX_VERSION, HLX_BUILD_SHA, POD_GO_FIRMWARE_CONFIG)

**Core Logic:**

- `src/lib/helix/chain-rules.ts` — Signal chain assembly
- `src/lib/helix/param-engine.ts` — Parameter resolution with expert lookup tables
- `src/lib/helix/snapshot-engine.ts` — Snapshot creation
- `src/lib/helix/preset-builder.ts` — HlxFile encoding (Helix/LT/Floor)
- `src/lib/helix/podgo-builder.ts` — PgpFile encoding (Pod Go)
- `src/lib/helix/stadium-builder.ts` — HspFile encoding (Stadium)
- `src/lib/helix/stomp-builder.ts` — HlxFile encoding (Stomp)

**Testing:**

- `src/lib/helix/*.test.ts` — Unit tests for all core modules
- `src/components/visualizer/*.test.tsx` — Component unit tests
- `src/lib/visualizer/*.test.ts` — Visualizer logic tests
- `scripts/baseline/` — Regression testing suite for preset generation

## Naming Conventions

**Files:**

- API routes: `src/app/api/[feature]/route.ts` (kebab-case feature, always `route.ts`)
- Components: `src/components/[Feature].tsx` (PascalCase, matches export name)
- Library modules: `src/lib/feature-name.ts` (kebab-case)
- Test files: `*.test.ts` or `*.test.tsx` (Jest convention)
- Types-only files: `types.ts` (single word, grouped type definitions)
- Catalogs: `[device]-catalog.ts` (device-specific model lists)

**Functions:**

- Builders: `build[Format]File()` (buildHlxFile, buildPgpFile, buildHspFile, buildStompFile)
- Validators: `validate[Thing]()` (validatePresetSpec, validatePresetQuality, validateAndFixPresetSpec)
- Resolvers: `resolve[Type]()` (resolveParameters, resolveFamily, resolveEffectModel)
- Auditors: `audit[Aspect]()` (auditIntentFidelity, auditPresetRegression)
- Getters: `get[Data]()` (getCapabilities, getModelListForPrompt, getModelIdForDevice)
- Converters: `[Source]To[Target]()` (mapRigToSubstitutions, hydrate, dehydrate)
- Hooks: `use[Feature]()` (useCompilerWorker, usePresetAutoSave)

**Variables:**

- Device instances: `device`, `deviceTarget`, `deviceFamily` (consistent naming)
- Preset objects: `presetSpec`, `preset` (depends on context — spec for intermediate, preset for final)
- Block arrays: `baseBlocks`, `signalChain` (base = unmodified from generation, chain = ordered blocks)
- Snapshots: `snapshots`, `activeSnapshotIndex` (always plural except for single reference)
- Block references: `blockId`, `block`, `selectedBlockId` (avoid ambiguous "current")

**Types:**

- Interfaces: `[PascalCase]` (PresetSpec, BlockSpec, ToneIntent, DeviceCapabilities)
- Type aliases: `[PascalCase]` (DeviceTarget, AmpCategory, TopologyTag, DeviceFamily)
- Enums: `[PascalCase]` (avoid — use string unions instead for better tree-shaking)
- Generics: `<T>`, `<K, V>` (standard convention)

## Where to Add New Code

**New Feature (e.g., "Add voice control"):**
- Primary code: `src/app/api/voice/route.ts` (API endpoint)
- Components: `src/components/voice/VoiceButton.tsx`, `VoiceInput.tsx`
- Business logic: `src/lib/voice-processor.ts` (processing and Gemini calls)
- Tests: `src/lib/voice-processor.test.ts`

**New Component/Module:**
- React component: `src/components/[Feature].tsx` or `src/components/[category]/[Feature].tsx`
- Business logic backing component: `src/lib/[feature]/` subdirectory with multiple files
- State management: Add to Zustand store via `store.ts` if global state needed
- Tests: Co-located with source files as `*.test.tsx` or `*.test.ts`

**Utilities (shared helpers):**
- General utilities: `src/lib/utils.ts` (if not specific to a domain)
- Domain-specific utilities: `src/lib/[domain]/utils.ts` (e.g., src/lib/helix/utils.ts for helix-specific)
- Format conversions: `src/lib/[format]-converter.ts` (e.g., src/lib/hlx-converter.ts)

**New Device Family (e.g., Helix Rack):**
- Family-specific prompts: `src/lib/families/rack/prompt.ts`
- Catalog exports: `src/lib/helix/catalogs/rack-catalog.ts`
- Builder: `src/lib/helix/rack-builder.ts` (if different file format)
- Add `rack` to exhaustive switch in `src/lib/prompt-router.ts` and `src/lib/helix/device-family.ts`
- Verify: Update `DeviceTarget` type in `src/lib/helix/types.ts`

**New Knowledge Layer Stage:**
- Add function to `src/lib/helix/` with descriptive name (e.g., `optimize-tone.ts`)
- Export from `src/lib/helix/index.ts`
- Integrate into `/api/generate/route.ts` runGenerationProcess pipeline
- Add corresponding `.test.ts` file with comprehensive cases

**Tests:**
- Unit: `src/lib/[module].test.ts` (same directory as source)
- Component: `src/components/[Component].test.tsx` (same directory)
- Integration: `src/lib/helix/orchestration.test.ts` (multi-module flows)
- E2E/Regression: `scripts/baseline/*.mjs` (full preset generation test suite)

## Special Directories

**node_modules:**
- Purpose: NPM dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)
- Install command: `npm install`

**.next:**
- Purpose: Next.js build artifacts and dev server cache
- Generated: Yes (via `npm run build` or `npm run dev`)
- Committed: No (in .gitignore)
- Clean: `rm -rf .next && npm run build`

**public:**
- Purpose: Static assets served at root (favicons, open graph images, etc.)
- Pattern: Files at `public/filename` served at `/filename`
- Committed: Yes

**supabase:**
- Purpose: Database migrations and schema definitions
- Pattern: Migrations auto-created by Supabase CLI or manual SQL files
- Deployed: Via Supabase dashboard or CLI

**.env.local:**
- Purpose: Local environment variables (secrets, API keys, URLs)
- Pattern: `VARIABLE_NAME=value` (one per line)
- Committed: No (in .gitignore, use .env.local.example for template)
- Required variables:
  - `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Public Supabase key
  - `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-only)
  - `GOOGLE_AI_STUDIO_API_KEY` — Gemini API key
  - `UPSTASH_REDIS_REST_URL` — Redis URL (optional, rate limiting)
  - `UPSTASH_REDIS_REST_TOKEN` — Redis auth token (optional)

**.planning/codebase:**
- Purpose: GSD documentation (ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md, STACK.md, INTEGRATIONS.md)
- Generated: Yes (via `/gsd:map-codebase` command)
- Committed: Yes (part of project documentation)

**scripts/baseline:**
- Purpose: Regression test suite for preset generation
- Pattern: `.mjs` files that run Knowledge Layer functions with snapshot comparisons
- Used by: CI/CD for detecting regressions in preset quality
- Run: `node scripts/baseline/[test-name].mjs`

---

*Structure analysis: 2026-03-18*
