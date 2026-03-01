# External Integrations

**Analysis Date:** 2026-03-01

## APIs & External Services

**AI Model Providers (Preset Generation):**
- **Google Gemini** - Generates Helix LT preset specifications in JSON format
  - SDK: `@google/genai` 1.42.0
  - Auth: `GEMINI_API_KEY` environment variable
  - Models used:
    - `gemini-2.5-flash` (standard tier, chat interviews)
    - `gemini-3.1-pro-preview` (premium tier, preset generation)
  - Request format: JSON with system instruction and prompt
  - Response format: JSON preset specification (via `responseMimeType: "application/json"`)
  - Streaming: Supported for chat via `sendMessageStream()`

- **OpenAI GPT** - Generates Helix LT preset specifications in JSON format
  - SDK: `openai` 6.25.0
  - Auth: `OPENAI_API_KEY` environment variable
  - Model used: `gpt-5.2-pro`
  - Request format: Messages array with system + user roles
  - Response format: JSON preset specification (via `response_format: { type: "json_object" }`)
  - Features: Streaming capable via chat completions API

- **Anthropic Claude** - Generates Helix LT preset specifications in JSON format
  - SDK: `@anthropic-ai/sdk` 0.78.0
  - Auth: `CLAUDE_API_KEY` environment variable
  - Model used: `claude-opus-4-6`
  - Request format: System prompt + messages array
  - Response format: JSON preset specification (text extraction from content blocks)
  - Max tokens: 16384
  - Features: Native system prompt support

**Google Fonts (UI Typography):**
- Fraunces (serif) - Decorative display font
- DM Sans (sans-serif) - UI body text
- JetBrains Mono (monospace) - Code/technical display
- Loaded via `next/font/google` with display=swap for font-display strategy
- Location: `src/app/layout.tsx`

## Data Storage

**Databases:**
- Not detected - Application is stateless

**File Storage:**
- No cloud file storage integration detected
- Presets are generated as `.hlx` files (binary format) and delivered to client via HTTP response
- No server-side persistence of user presets

**Caching:**
- HTTP caching headers set on streaming responses:
  - `Cache-Control: no-cache` (SSE streams)
  - `Connection: keep-alive` (for streaming)
- No application-level caching detected (Redis, Memcached, etc.)

## Authentication & Identity

**Auth Provider:**
- Custom - No third-party auth service
- Premium tier detection via server-side secret
  - File: `src/lib/gemini.ts`
  - Method: `isPremiumKey(premiumKey)` compares client-provided key against `PREMIUM_SECRET` env var
  - Used to determine which Gemini model tier to use (flash vs pro-preview)
- No user accounts, login system, or session management

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Rollbar, or similar error tracking service

**Logs:**
- Console logging only
- Server-side logging via `console.warn()` and `console.error()`
  - Validation warnings logged: `console.warn(\`[${provider.name}] Validation issues:\`, validation.errors)`
  - Generation errors logged: `console.error(\`[${provider.name}] Generation failed:\`, errorMsg)`
  - Preset generation errors: `console.error("Preset generation error:", message)`
- No structured logging, log aggregation, or log persistence detected
- Location: `src/app/api/generate/route.ts`, `src/app/api/chat/route.ts`

## CI/CD & Deployment

**Hosting:**
- Vercel recommended (see `README.md` - "The easiest way to deploy is on the Vercel Platform")
- Works on any Node.js-compatible server
- Next.js native support for serverless functions (AWS Lambda, Google Cloud Functions, etc.)

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar workflow automation

## Environment Configuration

**Required env vars:**
- `GEMINI_API_KEY` - Google Gemini API key (required if using Gemini models)
- `CLAUDE_API_KEY` - Anthropic Claude API key (required if using Claude models)
- `OPENAI_API_KEY` - OpenAI API key (required if using OpenAI models)
- `PREMIUM_SECRET` - Server-side secret for premium tier detection

**Optional env vars:**
- At least one AI provider API key must be set; application checks availability at startup
- If no API keys are configured, the `/api/providers` endpoint will return empty provider list
- Application gracefully handles missing API keys with error messages

**Secrets location:**
- `.env.local` - Contains all API keys and secrets (Git-ignored via `.gitignore`)
- `.env.local.example` - Template file with dummy values for reference

## Webhooks & Callbacks

**Incoming:**
- Not detected - No webhook endpoints that receive external data

**Outgoing:**
- Not detected - No callbacks to external services after preset generation
- Generated presets are delivered directly to client via HTTP response

## Request/Response Patterns

**Chat Interview Endpoint (`POST /api/chat`):**
- Input: `{ messages: Array<{role, content}>, premiumKey?: string }`
- Output: Server-Sent Events (SSE) stream
  - Format: `data: {JSON}\n\n` for each chunk
  - Special close message: `data: [DONE]\n\n`
- Provider: Gemini (hardcoded, no provider selection)
- Streaming: Yes, chunks streamed as they arrive

**Preset Generation Endpoint (`POST /api/generate`):**
- Input: `{ messages: Array<{role, content}>, providers?: string[] }`
- Output: JSON with preset specification for each requested provider
- Providers: All three (Gemini, Claude, OpenAI) can be requested simultaneously
- Processing: Parallel execution via `Promise.allSettled()`
- Response schema: `{ results: Array<ProviderResult> }`
  - Each result: `{ providerId, providerName, preset (HlxFile), summary, spec (PresetSpec), error? }`
- Backwards compatibility: Single provider request also returns flat fields

**Provider List Endpoint (`GET /api/providers`):**
- Output: `{ providers: Array<{id, name, color, available}> }`
- Filters: Only includes providers with API keys configured

## Model/Temperature Settings

**Chat (Interview) Phase:**
- Provider: Gemini only
- Temperature: Not explicitly set (uses Gemini defaults)
- System instruction: Detailed tone consultation guidance, tool access to Google Search
- Purpose: Natural conversation to gather tone requirements

**Preset Generation Phase:**
- Providers: Gemini, Claude, OpenAI
- Temperature: 0.3 (all providers) - Low temperature for deterministic JSON output
- Output format: JSON (enforced via provider-specific mechanisms)
- System prompt: Detailed preset specification schema with parameter guidance
- Purpose: Generate studio-quality Helix LT preset JSON with exact model IDs

---

*Integration audit: 2026-03-01*
