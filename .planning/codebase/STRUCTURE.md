# Codebase Structure

**Analysis Date:** 2026-03-01

## Directory Layout

```
/c/Users/dsbog/HelixAI/
├── .next/                      # Next.js build output (generated)
├── .planning/                  # GSD planning documents
├── node_modules/               # Dependencies
├── public/                      # Static assets
├── src/
│   ├── app/
│   │   ├── api/                # Next.js API route handlers
│   │   │   ├── chat/           # Interview phase streaming endpoint
│   │   │   ├── generate/       # Parallel preset generation endpoint
│   │   │   └── providers/      # Provider availability endpoint
│   │   ├── layout.tsx          # Root HTML layout with fonts
│   │   ├── page.tsx            # Main UI component
│   │   └── globals.css         # Global styling (Tailwind + custom)
│   └── lib/
│       ├── gemini.ts           # Chat prompts and Gemini client
│       ├── providers.ts        # Multi-provider abstraction
│       └── helix/              # Helix LT domain logic
│           ├── index.ts        # Barrel export
│           ├── types.ts        # Preset/HLX type definitions
│           ├── models.ts       # Amp/cab/effect model registry
│           ├── validate.ts     # Spec validation & auto-fix
│           └── preset-builder.ts  # PresetSpec → .hlx binary
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js build configuration
├── postcss.config.mjs          # Tailwind PostCSS setup
├── tsconfig.json               # TypeScript compiler options
├── package.json                # Dependencies and scripts
└── README.md                   # Project overview
```

## Directory Purposes

**`src/app/`:**
- Purpose: Next.js App Router pages and API routes
- Contains: UI component and route handlers
- Key files: `page.tsx` (main UI), `layout.tsx` (root template)

**`src/app/api/`:**
- Purpose: Next.js route handlers (equivalent to `pages/api/` in Pages Router)
- Contains: Three endpoints for chat, generation, and provider info
- Key files: `chat/route.ts`, `generate/route.ts`, `providers/route.ts`

**`src/lib/`:**
- Purpose: Shared business logic and domain-specific modules
- Contains: AI provider abstraction, Helix domain logic, system prompts
- Key files: `providers.ts` (provider abstraction), `gemini.ts` (chat system)

**`src/lib/helix/`:**
- Purpose: Helix LT preset format handling and generation
- Contains: Type definitions, model registry, validation, binary file building
- Key files: All files critical to preset generation pipeline
- Organization: `types.ts` (data structures) → `models.ts` (registry) → `validate.ts` (corrections) → `preset-builder.ts` (binary output)

## Key File Locations

**Entry Points:**

- `src/app/page.tsx`: Main UI entry point (client component)
- `src/app/layout.tsx`: Root HTML template with font loading
- `src/app/api/chat/route.ts`: Chat streaming endpoint
- `src/app/api/generate/route.ts`: Parallel preset generation endpoint

**Configuration:**

- `tsconfig.json`: TypeScript compiler, path aliases (`@/*` → `src/*`)
- `next.config.ts`: Next.js build config
- `eslint.config.mjs`: ESLint rules
- `postcss.config.mjs`: Tailwind CSS setup

**Core Logic:**

- `src/lib/providers.ts`: Provider registry, unified API for Gemini/Claude/OpenAI
- `src/lib/gemini.ts`: Chat system prompts, model selection, premium key validation
- `src/lib/helix/types.ts`: PresetSpec, HlxFile, BlockSpec type definitions
- `src/lib/helix/models.ts`: Comprehensive Helix amp/cab/effect model database
- `src/lib/helix/validate.ts`: Spec validation, auto-correction logic
- `src/lib/helix/preset-builder.ts`: Convert PresetSpec → binary .hlx file

**Styling:**

- `src/app/globals.css`: Tailwind directives + custom CSS variables (hlx-* theme colors/components)

## Naming Conventions

**Files:**

- API routes: `route.ts` (Next.js convention)
- Feature modules: `[feature].ts` (camelCase, descriptive)
- Type files: `types.ts` (collocated with implementation)
- Index files: `index.ts` (barrel exports)
- Examples:
  - `src/lib/helix/preset-builder.ts` (kebab-case for multi-word)
  - `src/lib/gemini.ts` (lowercase provider name)

**Directories:**

- Feature folders: lowercase, plural when appropriate (`api`, `lib`, `helix`)
- API routes: match endpoint path (`chat`, `generate`, `providers`)
- Example: `src/app/api/chat/route.ts` → `POST /api/chat`

**Functions & Variables:**

- Exported functions: camelCase (e.g., `buildHlxFile`, `generateWithProvider`)
- Internal functions: camelCase with leading underscore if truly private (e.g., `_buildDsp`)
- Constants: UPPER_SNAKE_CASE (e.g., `HELIX_LT_DEVICE_ID`, `BLOCK_TYPES`)
- Type names: PascalCase (e.g., `PresetSpec`, `HlxFile`, `ProviderConfig`)

**React Components:**

- Component files: PascalCase in export (`export default function Home()`)
- Component names: PascalCase (`Home`, `RootLayout`)
- Props interfaces: `[ComponentName]Props` pattern (implicit, not used in this codebase)

## Where to Add New Code

**New Feature/Endpoint:**

1. If it's an API route:
   - Create `src/app/api/[feature]/route.ts`
   - Export `async function POST(req: NextRequest)` or `GET()`
   - Follow the pattern in existing routes (error handling, response format)

2. If it's client-side logic:
   - Add to `src/app/page.tsx` if it's UI-related
   - Extract to `src/lib/[feature].ts` if it's shareable logic
   - Use React hooks for state management (no context API in current codebase)

**New Provider:**

- Add to `PROVIDERS` registry in `src/lib/providers.ts`:
  ```typescript
  newProvider: {
    id: "newProvider",
    name: "New Provider Name",
    model: "model-id",
    color: "#hexcolor",
    envKey: "NEW_PROVIDER_API_KEY",
  }
  ```
- Add corresponding `generateNewProvider()` function following the pattern of `generateGemini`, `generateClaude`, `generateOpenAI`
- Add case in switch statement in `generateWithProvider()`

**New Helix Model:**

- Add to appropriate category object in `src/lib/helix/models.ts` (AMP_MODELS, CAB_MODELS, EFFECT_MODELS)
- Follow existing structure with `id`, `name`, `basedOn`, `category`, `defaultParams`, `blockType`
- Model ID must start with `HD2_` to be valid
- Default parameters should be realistic 0.0-1.0 values matching Helix standards

**New Block Type:**

- Add type string to `BlockSpec.type` union in `src/lib/helix/types.ts`
- Add corresponding block type constant to `BLOCK_TYPES` in `src/lib/helix/models.ts`
- Update validation in `src/lib/helix/validate.ts` if special handling needed
- Update system prompt in `src/lib/gemini.ts` if AI needs guidance on parameter names

**Utility Functions:**

- Shared across components: `src/lib/[domain].ts`
- Domain-specific: `src/lib/helix/[feature].ts`
- Always use TypeScript and strict types
- Export from barrel files for ease of use: `src/lib/helix/index.ts`

## Special Directories

**`.next/`:**
- Purpose: Next.js build artifacts
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)

**`.planning/`:**
- Purpose: GSD mapping and planning documents
- Generated: By GSD tools
- Committed: Yes (version control for plans)

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes (by `npm install`)
- Committed: No (in .gitignore)

**`public/`:**
- Purpose: Static files (images, icons, etc.)
- Generated: No
- Committed: Yes

## Import Path Aliases

**TypeScript Configuration (`tsconfig.json`):**

```
@/* → ./src/*
```

**Usage Pattern:**

- Never use relative imports: ❌ `import { foo } from "../../../lib/helix"`
- Always use alias: ✅ `import { foo } from "@/lib/helix"`

This applies consistently across the entire codebase (see existing imports in `page.tsx`, API routes, lib files).

## API Route Conventions

All API routes follow this structure:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    // Validate input
    // Process
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error context:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Patterns:**
- Always wrap in try-catch
- Validate input before processing
- Use `NextResponse.json()` for responses
- Return status codes (400 for validation, 500 for server errors, 200 for success)
- Log errors with context
- Pass errors to client when appropriate

## Module Export Pattern

**Barrel Files:**

`src/lib/helix/index.ts` re-exports key items for cleaner imports:

```typescript
export { buildHlxFile, summarizePreset } from "./preset-builder";
export { getModelListForPrompt, getAllModels } from "./models";
export { validateAndFixPresetSpec } from "./validate";
export type { PresetSpec, BlockSpec, SnapshotSpec, HlxFile } from "./types";
```

Usage:
```typescript
// Instead of:
import { PresetSpec } from "@/lib/helix/types";

// Use:
import type { PresetSpec } from "@/lib/helix";
```

---

*Structure analysis: 2026-03-01*
