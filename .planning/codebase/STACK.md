# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- TypeScript 5.x - Full codebase (frontend and backend)
- JavaScript - Configuration files (ESLint, PostCSS)

**Secondary:**
- JSX/TSX - React components in `src/app/` and `src/lib/`

## Runtime

**Environment:**
- Node.js (inferred from Next.js 16.1.6 requirements - LTS 20.x or 22.x)

**Package Manager:**
- npm (inferred from `package.json` and `package-lock.json`)
- Lockfile: Present (`package-lock.json`)

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router
- React 19.2.3 - UI component library
- React DOM 19.2.3 - DOM rendering for React

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind
- PostCSS 4.x - CSS processing (configured in `postcss.config.mjs`)

**Testing:**
- Vitest 4.0.18 - Unit test runner
- Node test environment (configured in `vitest.config.ts`)

**Build/Dev:**
- TypeScript 5.x - Type checking and transpilation
- ESLint 9.x - Code linting (configured in `eslint.config.mjs`)
- eslint-config-next 16.1.6 - Next.js ESLint rules
- Babel (transitive) - Code transformation (via @babel/* packages)

## Key Dependencies

**Critical:**
- @anthropic-ai/sdk ^0.78.0 - Anthropic Claude API client (used for chat, planner, and vision routes)
- @google/genai ^1.42.0 - Google Gemini API client (used for chat route)

**UI/Rendering:**
- react-markdown ^10.1.0 - Markdown rendering for chat responses

**Data Validation:**
- zod ^4.3.6 - TypeScript-first schema validation (used for structured output and type safety)

**Image Processing:**
- browser-image-compression ^2.0.2 - Client-side image compression (used before vision API calls)

**Fonts:**
- next/font - Next.js built-in Google Fonts optimization (Barlow Condensed, Barlow, JetBrains Mono imported in `src/app/layout.tsx`)

## Configuration

**Environment:**
- `.env.local` required (generated from `.env.local.example`)
- Environment variables:
  - `GEMINI_API_KEY` - Google Gemini API authentication
  - `CLAUDE_API_KEY` - Anthropic Claude API authentication
  - `PREMIUM_SECRET` - Server-side secret for premium tier verification

**Build:**
- `tsconfig.json` - TypeScript compiler configuration (strict mode enabled, ES2017 target, path alias `@/*` → `./src/*`)
- `next.config.ts` - Next.js configuration (minimal, allows for custom config)
- `vitest.config.ts` - Test runner configuration with Node environment and `@/` path alias

## Platform Requirements

**Development:**
- Node.js 20.x or 22.x (LTS) recommended
- npm 10.x or later
- TypeScript 5.x knowledge required

**Production:**
- Deployment target: Vercel (inferred from README and `.vercel` in `.gitignore`)
- Next.js 16.1.6 compatible hosting (Node.js 20.x+)
- Fluid Compute for Vercel required for long-running functions (configured in `src/app/api/vision/route.ts` with `maxDuration: 60`)

---

*Stack analysis: 2026-03-02*
