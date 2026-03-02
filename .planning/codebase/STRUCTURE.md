# Codebase Structure

**Analysis Date:** 2026-03-02

## Directory Layout

```
helixai/
├── src/
│   ├── app/                          # Next.js app directory (React + API routes)
│   │   ├── api/                      # API route handlers
│   │   │   ├── chat/route.ts         # Streaming Gemini chat endpoint
│   │   │   ├── generate/route.ts     # Main preset generation orchestrator
│   │   │   ├── map/route.ts          # Model list debugging endpoint
│   │   │   └── vision/route.ts       # Rig image analysis endpoint
│   │   ├── layout.tsx                # Root layout with metadata and fonts
│   │   ├── page.tsx                  # Main UI (tone interview + visualization)
│   │   ├── globals.css               # Tailwind + custom styles (film grain, ambient glow)
│   │   └── favicon.ico
│   ├── lib/                          # Shared libraries and business logic
│   │   ├── helix/                    # Core tone generation engine
│   │   │   ├── chain-rules.ts        # Signal chain assembly (effects ordering)
│   │   │   ├── chain-rules.test.ts   # Tests for chain ordering
│   │   │   ├── config.ts             # Firmware version constants
│   │   │   ├── index.ts              # Public API exports
│   │   │   ├── models.ts             # Model catalogs (amps, cabs, effects)
│   │   │   ├── orchestration.test.ts # End-to-end pipeline tests
│   │   │   ├── param-engine.ts       # Parameter resolution (lookup tables)
│   │   │   ├── param-engine.test.ts  # Parameter tests
│   │   │   ├── param-registry.ts     # Parameter type definitions
│   │   │   ├── podgo-builder.ts      # Pod Go .pgp file generation
│   │   │   ├── preset-builder.ts     # Helix .hlx file generation
│   │   │   ├── rig-intent.ts         # RigIntent schema (physical rig data)
│   │   │   ├── snapshot-engine.ts    # Snapshot generation (4 tones per preset)
│   │   │   ├── snapshot-engine.test.ts # Snapshot tests
│   │   │   ├── tone-intent.ts        # ToneIntent schema (AI output contract)
│   │   │   ├── types.ts              # HlxFile, BlockSpec, PresetSpec, DeviceTarget
│   │   │   └── validate.ts           # Preset validation
│   │   ├── gemini.ts                 # Google Gemini client initialization
│   │   ├── planner.ts                # Claude Planner (ToneIntent generation)
│   │   ├── rig-mapping.ts            # Physical pedal → Helix substitution lookup tables
│   │   ├── rig-mapping.test.ts       # Rig mapping tests
│   │   ├── rig-vision.ts             # Claude rig extraction from images
│   │   └── gemini.ts                 # Gemini initialization and prompts
│   └── public/                       # Static assets (images, fonts)
│
├── .planning/
│   └── codebase/                     # GSD analysis documents
│
├── .env.local.example                # Example environment variables
├── eslint.config.mjs                 # ESLint rules
├── next.config.ts                    # Next.js configuration (minimal)
├── package.json                      # Dependencies and scripts
├── postcss.config.mjs                # PostCSS/Tailwind configuration
├── tsconfig.json                     # TypeScript compiler options (strict mode)
├── vitest.config.ts                  # Vitest test runner configuration
└── README.md                         # Project documentation
```

## Directory Purposes

**src/app:**
- Purpose: Next.js app directory containing layout, pages, and API routes
- Contains: React components (frontend), Next.js API handlers (backend)
- Key files: `page.tsx` (main UI), `api/generate/route.ts` (orchestrator)

**src/app/api:**
- Purpose: API endpoints for backend services
- Contains: Route handlers that respond to fetch requests from frontend
- Key endpoints:
  - `/chat`: Gemini streaming responses
  - `/generate`: Preset generation pipeline
  - `/vision`: Rig image analysis
  - `/map`: Model list for debugging

**src/lib:**
- Purpose: Shared libraries, utilities, and business logic
- Contains: Reusable functions, type definitions, lookup tables
- Organized by domain: `helix/` (tone engine), `gemini.ts` (chat), `planner.ts` (AI), `rig-*.ts` (rig emulation)

**src/lib/helix:**
- Purpose: Deterministic tone generation engine (zero AI)
- Contains: Model catalogs, signal chain assembly, parameter resolution, file builders
- Key concepts:
  - `tone-intent.ts`: Input contract (what Planner generates)
  - `chain-rules.ts`: Slot assignment and DSP distribution
  - `param-engine.ts`: Expert-consensus parameter tables
  - `snapshot-engine.ts`: Multi-snapshot generation
  - `preset-builder.ts` / `podgo-builder.ts`: Binary file generation

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root layout, global metadata and styles
- `src/app/page.tsx`: Main page (chat UI, visualization, rig upload)
- `src/app/api/chat/route.ts`: Chat streaming endpoint
- `src/app/api/generate/route.ts`: Preset generation pipeline
- `src/app/api/vision/route.ts`: Rig image analysis

**Configuration:**
- `tsconfig.json`: TypeScript config (paths alias `@/*` → `src/*`, strict mode)
- `next.config.ts`: Minimal Next.js config (no custom webpack)
- `.env.local.example`: Template for required environment variables

**Core Logic:**
- `src/lib/helix/index.ts`: Public API exports (all public types and functions)
- `src/lib/helix/tone-intent.ts`: Zod schema for AI output
- `src/lib/helix/types.ts`: HlxFile, BlockSpec, PresetSpec, DeviceTarget types
- `src/lib/helix/models.ts`: Model catalogs (AMP_MODELS, CAB_MODELS, DISTORTION_MODELS, etc.)
- `src/lib/helix/param-engine.ts`: Lookup tables for parameter defaults
- `src/lib/helix/chain-rules.ts`: Signal chain assembly rules
- `src/lib/helix/preset-builder.ts`: .hlx file generation
- `src/lib/helix/podgo-builder.ts`: .pgp file generation

**Rig Emulation:**
- `src/lib/rig-vision.ts`: Claude vision analysis for rig extraction
- `src/lib/rig-mapping.ts`: PEDAL_HELIX_MAP (53 physical pedal entries)

**Testing:**
- `src/lib/helix/chain-rules.test.ts`: Signal chain assembly tests
- `src/lib/helix/param-engine.test.ts`: Parameter resolution tests
- `src/lib/helix/snapshot-engine.test.ts`: Snapshot generation tests
- `src/lib/helix/orchestration.test.ts`: End-to-end integration tests
- `src/lib/rig-mapping.test.ts`: Rig mapping tests

## Naming Conventions

**Files:**
- Lowercase with hyphens: `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`
- Test files: `*.test.ts` (co-located with source, not separate `__tests__` directory)
- API routes: `route.ts` (Next.js convention)

**Directories:**
- Lowercase: `api/`, `lib/`, `helix/`
- Group by domain: `api/chat/`, `api/vision/`, etc.

**Functions:**
- camelCase for public exports: `assembleSignalChain()`, `resolveParameters()`, `buildHlxFile()`
- camelCase for internal helpers: `buildTone()`, `buildDsp()`, `classifyEffectSlot()`

**Types:**
- PascalCase: `HlxFile`, `BlockSpec`, `PresetSpec`, `ToneIntent`
- Enum-like constants: UPPERCASE: `DEVICE_IDS`, `FIRMWARE_CONFIG`, `ROLE_LED`
- Model names: PascalCase: `AMP_MODELS`, `CAB_MODELS`, `DISTORTION_MODELS`

**Variables:**
- Config tables: UPPERCASE: `AMP_DEFAULTS`, `CAB_PARAMS`, `EQ_PARAMS`, `MINOTAUR_PARAMS`
- Set/Map: lowercase: `BOOST_MODEL_IDS`, `PEDAL_HELIX_MAP`

## Where to Add New Code

**New Feature (Tone Interview Variant):**
- API route: `src/app/api/[feature]/route.ts`
- Planner system prompt: Update `buildPlannerPrompt()` in `src/lib/planner.ts`
- Tests: `src/lib/helix/orchestration.test.ts` (integration tests)

**New Block Type / Effect:**
- Model definition: Add entry to appropriate catalog in `src/lib/helix/models.ts` (e.g., DISTORTION_MODELS)
- Type definition: Update `BlockSpec["type"]` union if new category
- Chain slot: Add case to `classifyEffectSlot()` in `src/lib/helix/chain-rules.ts`
- Parameters: Add defaults to appropriate table in `src/lib/helix/param-engine.ts`
- Snapshot logic: Add to `getBlockEnabled()` in `src/lib/helix/snapshot-engine.ts` if special rules
- Tests: Add test in `src/lib/helix/chain-rules.test.ts` and `param-engine.test.ts`

**New Device Target (e.g., Pod Stomp):**
- Device constant: Add to `DEVICE_IDS` and add helper like `isPodStomp()` in `src/lib/helix/types.ts`
- Block constants: Add pod stomp block types (e.g., `BLOCK_TYPES_PODSTOMP`) in `types.ts`
- Builder: Create `src/lib/helix/podstomp-builder.ts` with device-specific file format
- API route: Update `/api/generate` to handle new device case
- Planner: Update `buildPlannerPrompt()` to filter models for new device
- Tests: Add device-specific tests in orchestration.test.ts

**New Rig Pedal Mapping:**
- Pedal entry: Add to `PEDAL_HELIX_MAP` in `src/lib/rig-mapping.ts` with fullName key, model ref, blockType, and reason
- Category fallback: Ensure category is covered in `CATEGORY_FALLBACKS` map
- Tests: Add to `src/lib/rig-mapping.test.ts`

**New Parameter Type:**
- Schema definition: Add to `PARAM_TYPE_REGISTRY` in `src/lib/helix/param-registry.ts`
- Parameter lookup: Add to appropriate defaults table in `src/lib/helix/param-engine.ts`
- Model usage: Reference in model.params in `src/lib/helix/models.ts`

**Utilities:**
- Shared helpers: `src/lib/` root (e.g., `src/lib/gemini.ts`, `src/lib/planner.ts`)
- Domain-specific: `src/lib/helix/validate.ts`, `src/lib/rig-mapping.ts`

## Special Directories

**src/app/api/[endpoint]:**
- Purpose: API route handlers (one per endpoint)
- Pattern: Single `route.ts` file per directory
- Pattern: POST handler exported as `export async function POST(req: NextRequest)`
- Generated: No, committed to git

**src/lib/helix:**
- Purpose: Tone generation engine (isolated, testable)
- Pattern: Exported via `src/lib/helix/index.ts` for public API
- Pattern: Internal modules import from each other directly (no circular deps)
- Generated: No, committed to git

**.planning/codebase:**
- Purpose: GSD analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Pattern: Markdown files written by mapping agents
- Generated: Yes, generated during `/gsd:map-codebase` phase
- Committed: Yes, tracked in git for continuity across sessions

**node_modules:**
- Purpose: Installed dependencies
- Generated: Yes, via `npm install`
- Committed: No (in .gitignore)

**.next:**
- Purpose: Next.js build output and type cache
- Generated: Yes, during `npm run build`
- Committed: No (in .gitignore)

## File Organization Rules

**Co-location:**
- Test files live next to source files: `chain-rules.ts` and `chain-rules.test.ts` in same directory
- No separate `__tests__` directories; simpler to find related tests

**API Routes:**
- One `route.ts` per feature endpoint: `api/chat/route.ts`, `api/vision/route.ts`
- All validation and error handling in the route handler
- Dependency injection via imports (no middleware)

**Exports:**
- Public API in `src/lib/helix/index.ts`: Re-exports types and functions consumers need
- Internal modules: Import from each other directly (e.g., `chain-rules.ts` imports from `models.ts`)
- Private helpers: Not exported; only used within their module

**Imports:**
- Path alias: Use `@/` for src imports: `@/lib/helix`, `@/app/api`
- Never relative paths: No `../../../lib`; always use `@/`
- Type imports: Use `import type` when possible to keep types out of runtime bundles

---

*Structure analysis: 2026-03-02*
