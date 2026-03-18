# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.x - All source code (`src/` directory), API routes, components
- JavaScript (Node.js) - Configuration files (next.config.ts, postcss.config.mjs, eslint.config.mjs)
- JSX/TSX - React components and pages (`src/components/`, `src/app/`)

**Secondary:**
- SQL - Supabase database schema and migrations (`supabase/schema.sql`)

## Runtime

**Environment:**
- Node.js 20+ (via Next.js 16.1.6 requirements)

**Package Manager:**
- npm (uses package-lock.json for dependency locking)
- Lockfile: `package-lock.json` (present and committed)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack framework with App Router
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering

**AI/ML:**
- ai 6.0.116 - Vercel AI SDK for LLM streaming and object generation
- @ai-sdk/google 3.0.43 - Google Generative AI provider for ai SDK
- @google/genai 1.42.0 - Google GenAI client (low-level API access for streaming)

**Database & Auth:**
- @supabase/supabase-js 2.98.0 - Supabase client (data, auth, storage)
- @supabase/ssr 0.9.0 - Supabase SSR utilities for Server Components and middleware

**Rate Limiting & Caching:**
- @upstash/redis 1.37.0 - Redis client for rate limiting
- @upstash/ratelimit 2.0.8 - Rate limiting library (sliding window: 20 req/hour)

**UI Components & Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- @tailwindcss/postcss 4.x - Tailwind PostCSS plugin
- sonner 2.0.7 - Toast notifications library
- react-markdown 10.1.0 - Markdown rendering in React

**Drag & Drop:**
- @dnd-kit/core 6.3.1 - Headless drag-and-drop library
- @dnd-kit/sortable 10.0.0 - Sortable preset functionality
- @dnd-kit/utilities 3.2.2 - Utility functions for dnd-kit

**State Management:**
- zustand 5.0.11 - Lightweight state management (React store)

**Validation & Schemas:**
- zod 4.3.6 - TypeScript-first schema validation and parsing

**Image Processing:**
- browser-image-compression 2.0.2 - Client-side image compression utility

## Build & Dev Tools

**Build:**
- Next.js built-in build system (via `npm run build`)

**Linting & Code Quality:**
- ESLint 9.x - JavaScript/TypeScript linter
- eslint-config-next 16.1.6 - Next.js-specific ESLint rules and config

**Testing:**
- Vitest 4.0.18 - Unit and integration test runner
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - DOM matchers for assertions
- jsdom 28.1.0 - Simulated DOM environment for tests

**Type Checking:**
- TypeScript 5.x - Static type checking

**CSS Processing:**
- PostCSS (integrated with Tailwind) - CSS transformations

## Configuration Files

**TypeScript:**
- `tsconfig.json` - Compiler options: ES2017 target, strict mode, JSX support, path alias `@/*` → `./src/*`

**Next.js:**
- `next.config.ts - Minimal configuration (currently empty, uses defaults)

**CSS:**
- `postcss.config.mjs` - PostCSS config with Tailwind plugin

**Linting:**
- `eslint.config.mjs` - ESLint with Next.js core web vitals and TypeScript support

**Middleware:**
- `middleware.ts` - Next.js middleware for Supabase session management (invoked on every request)

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` - Google Gemini API key (for LLM calls)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (public, used in browser)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (public, used in browser)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis endpoint (optional; rate limiting disabled if missing)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token (optional)
- `CRON_SECRET` - Vercel Cron protection secret (for keep-alive route)
- `GOOGLE_API_KEY` - Google API key for adjust endpoint (alternative or supplementary to GEMINI_API_KEY)
- `PREMIUM_SECRET` - Server-side secret for validating premium API keys

**Optional env vars:**
- `LOG_USAGE` - Set to "true" to log token usage to `usage.jsonl`

**Secrets location:**
- `.env.local` - Local development secrets (git-ignored)
- Vercel environment variables - Production secrets set in Vercel dashboard

## Platform Requirements

**Development:**
- Node.js 20+
- npm or yarn package manager
- TypeScript 5.x compiler
- Modern browser (Chrome, Edge, Safari) for frontend testing

**Production:**
- Deployment target: Vercel (serverless Next.js)
- Supports streaming responses with long timeouts (maxDuration: 60 seconds for chat endpoint)
- Cookie-based session management for Supabase auth tokens

## Key Integrations (see INTEGRATIONS.md for details)

**LLM Provider:** Google Generative AI (Gemini Flash, Gemini Pro models)
**Database:** Supabase (PostgreSQL + Auth + Storage)
**Rate Limiting:** Upstash Redis
**Deployment:** Vercel
**Authentication:** Supabase Auth (OAuth-based)

---

*Stack analysis: 2026-03-18*
