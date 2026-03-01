# Technology Stack

**Analysis Date:** 2026-03-01

## Languages

**Primary:**
- TypeScript 5.x - Application code, API routes, utilities
- JSX/TSX - React components and Next.js page components

**Secondary:**
- CSS - Styling via Tailwind CSS
- JavaScript - Configuration files (eslint, postcss, next config)

## Runtime

**Environment:**
- Node.js (version unspecified in lockfile, inferred from Next.js 16.x compatibility)

**Package Manager:**
- npm (Node Package Manager)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router, API routes, streaming
- React 19.2.3 - UI component framework
- React DOM 19.2.3 - React rendering

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- @tailwindcss/postcss 4.x - PostCSS integration for Tailwind

**Build/Dev:**
- TypeScript 5.x - Type checking and compilation
- ESLint 9.x - Code linting with Next.js configuration
- PostCSS - CSS transformation pipeline

## Key Dependencies

**Critical:**
- `@anthropic-ai/sdk` 0.78.0 - Anthropic Claude API client for AI preset generation
- `@google/genai` 1.42.0 - Google Gemini API client for AI preset generation
- `openai` 6.25.0 - OpenAI GPT API client for AI preset generation
- `react-markdown` 10.1.0 - Markdown rendering for chat responses and documentation
- `zod` 4.3.6 - TypeScript-first schema validation for API request/response contracts

**Infrastructure:**
- `@types/node` 20.x - Node.js type definitions
- `@types/react` 19.x - React type definitions
- `@types/react-dom` 19.x - React DOM type definitions
- `eslint-config-next` 16.1.6 - Next.js ESLint configuration
- `next-env.d.ts` - Next.js type definitions (generated)

## Configuration

**Environment:**
- `.env.local` - Contains runtime API keys and secrets (file exists, not committed)
- `.env.local.example` - Template showing required environment variables
- Required env vars: `GEMINI_API_KEY`, `CLAUDE_API_KEY`, `OPENAI_API_KEY`, `PREMIUM_SECRET`

**Build:**
- `tsconfig.json` - TypeScript compiler configuration with strict mode enabled
  - Target: ES2017
  - Module resolution: bundler
  - Path alias: `@/*` → `./src/*`
  - JSX: react-jsx
  - Strict mode: enabled
- `next.config.ts` - Next.js configuration (minimal, uses defaults)
- `postcss.config.mjs` - PostCSS configuration for Tailwind CSS
- `eslint.config.mjs` - ESLint configuration using Next.js presets (core-web-vitals, typescript)

## Platform Requirements

**Development:**
- Node.js 18+ (inferred from Next.js 16.x compatibility)
- npm 8+ (or yarn/pnpm)
- TypeScript 5.x
- Modern browser with ES2017+ support

**Production:**
- Deployment target: Vercel (recommended for Next.js, see README)
- Can run on any Node.js-compatible server
- Requires environment variables for all three AI provider APIs (or subset if not using all providers)

## APIs & Services Integration

**AI Providers (Core to Application):**
- Google Gemini API - via `@google/genai` SDK
- OpenAI GPT API - via `openai` SDK
- Anthropic Claude API - via `@anthropic-ai/sdk` SDK
- All three providers are available simultaneously; UI shows which are configured

**Google Fonts:**
- Fraunces (serif font) - from `next/font/google`
- DM Sans (sans-serif font) - from `next/font/google`
- JetBrains Mono (monospace font) - from `next/font/google`

## Notable Architectural Patterns

**Multi-Provider Strategy:**
- Abstraction layer in `src/lib/providers.ts` allows swapping AI providers
- Configuration-driven: each provider has id, name, model, color, and API key env var
- Supports parallel generation from multiple providers simultaneously

**API Routes:**
- `src/app/api/chat/route.ts` - Streaming chat endpoint (Gemini-based interview)
- `src/app/api/generate/route.ts` - Preset JSON generation endpoint (supports all three providers)
- `src/app/api/providers/route.ts` - Lists available providers based on configured API keys

**Data Validation:**
- Zod schemas used for preset specification validation
- Located in `src/lib/helix/validate.ts`
- Auto-correction of invalid presets with detailed error logging

---

*Stack analysis: 2026-03-01*
