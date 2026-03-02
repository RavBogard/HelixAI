# External Integrations

**Analysis Date:** 2026-03-02

## APIs & External Services

**AI Models:**
- Google Gemini API - Chat endpoint for conversational tone consultation
  - SDK/Client: @google/genai ^1.42.0
  - Auth: `GEMINI_API_KEY` environment variable
  - Route: `src/app/api/chat/route.ts`
  - Models: `gemini-2.5-flash` (standard), `gemini-3.1-pro-preview` (premium)
  - Tools: Google Search integrated into Gemini for artist rig research

- Anthropic Claude API - Three separate use cases:
  - **Claude Planner** (ToneIntent generation):
    - SDK/Client: @anthropic-ai/sdk ^0.78.0
    - Auth: `CLAUDE_API_KEY` environment variable
    - Route: `src/lib/planner.ts` (called by `src/app/api/generate/route.ts`)
    - Model: claude-sonnet-4-6
    - Features: Structured output with Zod schema validation
    - Prompt caching enabled for system prompts

  - **Vision Extraction** (pedal identification):
    - SDK/Client: @anthropic-ai/sdk ^0.78.0
    - Auth: `CLAUDE_API_KEY` environment variable
    - Route: `src/app/api/vision/route.ts`
    - Accepts: Base64-encoded images (JPEG, PNG, WebP) up to 900 KB per image
    - Output: JSON with pedal brand, model, knob positions, and confidence levels
    - Max: 3 images per request

  - **Rig Vision Planner** (rig context integration):
    - SDK/Client: @anthropic-ai/sdk ^0.78.0
    - Auth: `CLAUDE_API_KEY` environment variable
    - Module: `src/lib/rig-vision.ts` (called by `/api/vision`)
    - Used to extract structured pedal data from photographs

## Data Storage

**Databases:**
- None detected - stateless application
- All preset data is generated dynamically and downloaded as files

**File Storage:**
- Local filesystem only - Preset files (.hlx, .pgp) generated and downloaded client-side
- No cloud storage or CDN integrations detected

**Caching:**
- Vercel's Prompt Caching (Claude API feature)
  - Configured in `src/lib/planner.ts` with `cache_control: { type: "ephemeral" }`
  - Caches system prompts for Planner to reduce latency and token usage

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no third-party auth service)
- Premium tier verification:
  - Client: URL parameter `?premiumKey=...` checked by `src/app/page.tsx`
  - Server: Verified against `PREMIUM_SECRET` in `src/lib/gemini.ts` via `isPremiumKey()`
  - Used to select between standard (Gemini 2.5 Flash) and premium (Gemini 3.1 Pro) models

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Console logging only
  - `console.error()` in API routes for error reporting
  - Used in `src/app/api/chat/route.ts`, `src/app/api/generate/route.ts`, `src/app/api/vision/route.ts`, `src/app/api/map/route.ts`
  - No persistent logging service

## CI/CD & Deployment

**Hosting:**
- Vercel (inferred from README and `.gitignore`)
- Next.js deployment optimized for Vercel Edge Runtime

**CI Pipeline:**
- None detected in repository

**Build Commands:**
```bash
npm run dev      # Development server on localhost:3000
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint check
```

**Environment Setup:**
- `.env.local` file required with three variables:
  - `GEMINI_API_KEY` - Get from https://aistudio.google.com/apikey
  - `CLAUDE_API_KEY` - Get from Anthropic console
  - `PREMIUM_SECRET` - Internal use for premium tier (optional, used if set)

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- Google Search tool (integrated into Gemini chat)
  - Used when Gemini route receives requests with `tools: [{ googleSearch: {} }]`
  - Called by Gemini during chat conversations for artist rig research

## Function Configuration

**Long-running Operations:**
- Vision extraction (`src/app/api/vision/route.ts`):
  - Vercel Fluid Compute: `maxDuration = 60` seconds (required for >10s operations)
  - Must be enabled in Vercel project settings
  - Configured for image processing and Claude vision analysis

## Image Processing

**Client-side Compression:**
- browser-image-compression ^2.0.2
- Used in `src/app/page.tsx` before uploading images to vision API
- Target compression: ~800 KB for 3 images combined
- Max per-image base64: 1,200,000 characters (~900 KB raw)

---

*Integration audit: 2026-03-02*
