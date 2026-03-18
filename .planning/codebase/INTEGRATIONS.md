# External Integrations

**Analysis Date:** 2026-03-18

## APIs & External Services

**AI/LLM:**
- Google Generative AI (Gemini)
  - What it's used for: Chat completions, tone adjustments, preset generation, vision analysis
  - SDK/Client: `@google/genai` (direct), `@ai-sdk/google` (Vercel AI SDK wrapper)
  - Auth: `GEMINI_API_KEY` (from `.env.local`)
  - Models:
    - `gemini-3-flash-preview` (standard tier)
    - `gemini-3.1-pro-preview` (premium tier, requires `PREMIUM_SECRET` validation)
    - `gemini-2.5-flash-8b` (for adjustments endpoint)
  - Usage: Streaming via `chat.sendMessageStream()` in `src/app/api/chat/route.ts`, structured output via `generateObject()` in `src/app/api/chat/adjust/route.ts`

**Web Search:**
- Google Search (via Gemini googleSearch tool)
  - What it's used for: Contextual web search during chat responses
  - Enabled: Yes (enabled in chat completion config: `tools: [{ googleSearch: {} }]`)

## Data Storage

**Databases:**
- Supabase (PostgreSQL)
  - Connection: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Client: `@supabase/supabase-js` (v2.98.0)
  - Tables:
    - `conversations` - Chat sessions (user_id, title, device, preset_url, timestamps)
    - `messages` - Chat history (conversation_id, role, content, sequence_number)
  - Schema: `supabase/schema.sql`
  - RLS: Row-level security enabled on both tables (users own their conversations/messages)

**File Storage:**
- Supabase Storage (S3-compatible bucket named "presets")
  - What it stores: Audio presets (JSON files uploaded after generation)
  - Location: `presets/{user_id}/{filename}` (RLS enforces user-scoped access)
  - Access: User-scoped policies (upload, read, update, delete own presets only)

**Caching:**
- Upstash Redis (serverless Redis)
  - Connection: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - Client: `@upstash/redis` (v1.37.0)
  - Purpose: Rate limiting sliding window (20 requests per hour)
  - Fallback: If env vars missing, rate limiting is disabled (graceful degradation)
  - Usage: `src/app/api/chat/route.ts` lines 23-68

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (OAuth + Email/Password)
  - Implementation: Server-side session with JWT in secure cookies
  - Auth flow:
    1. User signs in via Supabase Auth UI (provider choice)
    2. Callback handled by `src/app/auth/callback/route.ts`
    3. Session stored in cookies (managed by `@supabase/ssr`)
    4. Middleware refreshes JWT on every request (`middleware.ts`)
  - Session validation:
    - Server Components: `await createSupabaseServerClient()` then `supabase.auth.getUser()`
    - API Routes: Same pattern as Server Components
  - Protected resources: All conversation/message endpoints require `auth.getUser()` validation
  - Row-level security: RLS policies verify user ownership of conversations/messages

**User identification:**
- User ID: UUID from `auth.users.id` table (Supabase manages)
- Session tokens: Stored in `sb-access-token` and `sb-refresh-token` cookies
- Token refresh: Handled by middleware (`src/lib/supabase/middleware.ts` line 31)

## Monitoring & Observability

**Error Tracking:**
- None detected (console.error used for logging, but no external error tracking service)

**Logs:**
- Approach: Console.error/info + optional file logging
  - Token usage logging: Optional via `LOG_USAGE=true` → writes to `usage.jsonl` (local file, dev only)
  - Usage schema: `src/lib/usage-logger.ts` defines `PlannerUsageRecord` type
  - Cost tracking: Includes USD cost estimates (Gemini pricing: input $0.3/MTok, output $2.5/MTok, cached $0.03/MTok)

## CI/CD & Deployment

**Hosting:**
- Vercel (Next.js serverless platform)
  - Deployment: Connected via GitHub integration (CI/CD pipeline)
  - Environment variables: Set in Vercel dashboard (visible in git as `.vercel/` dir)
  - Serverless timeout: Extended to 60 seconds for streaming chat responses (`src/app/api/chat/route.ts` line 31)

**CI Pipeline:**
- Next.js build verification (implicit on Vercel deployment)
- Linting: `npm run lint` (ESLint)
- Tests: `npm run test` (Vitest)
- No explicit GitHub Actions detected (Vercel handles CI)

**Scheduled Tasks (Cron):**
- Keep-alive endpoint: `src/app/api/cron/keep-alive/route.ts`
  - Purpose: Prevents Vercel hobby tier from being put to sleep
  - Protection: `CRON_SECRET` env var (required in request header)
  - Trigger: Vercel Cron schedule (interval configurable via Vercel dashboard)

## Environment Configuration

**Required env vars:**

| Variable | Purpose | Scope |
|----------|---------|-------|
| `GEMINI_API_KEY` | Google Gemini API authentication | Server-side |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project endpoint | Public (sent to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Public (sent to browser) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis endpoint | Server-side |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token | Server-side |
| `CRON_SECRET` | Vercel Cron protection | Server-side |
| `GOOGLE_API_KEY` | Google API (alternate to GEMINI_API_KEY) | Server-side |
| `PREMIUM_SECRET` | Premium tier validation | Server-side |

**Optional env vars:**
- `LOG_USAGE="true"` - Enable token usage logging to `usage.jsonl`

**Secrets location:**
- `.env.local` - Development (git-ignored)
- `.env.eval` - Evaluation environment
- Vercel dashboard - Production (not stored in repo)

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `src/app/auth/callback/route.ts`
  - Endpoint: `/auth/callback`
  - Triggers: After user authorizes OAuth provider
  - Handles: Code exchange for session via `supabase.auth.exchangeCodeForSession(code)`

**Outgoing:**
- Cron keep-alive: `src/app/api/cron/keep-alive/route.ts` (no external webhook)
- Preset download: `src/app/api/download/route.ts` (serves presently, no outbound call)

## Rate Limiting & Quotas

**Rate Limiting:**
- Endpoint: Chat `/api/chat` (POST)
- Method: Upstash Redis sliding window
- Limit: 20 requests per hour per identifier
- Identifier: Conversation ID (preferred) or IP address (fallback) or "anonymous_session"
- Response: 429 with headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Graceful fallback: If Upstash env vars missing, rate limiting skipped (no error)

**API Quotas:**
- Gemini API: Quotas per Google Cloud project (not enforced in code)
- Supabase: Storage limits per project tier
- Upstash Redis: Command and storage limits per tier

## Data Flow & Integration Points

**Chat Flow:**
1. User sends message via `/api/chat` (POST)
2. Rate limit checked (Upstash Redis)
3. Supabase user authenticated
4. Message persisted to `messages` table (before streaming)
5. Gemini API streamed for response
6. Response streamed to client (Server-Sent Events)
7. Assistant message persisted to `messages` table (after stream closes)

**Preset Generation Flow:**
1. User requests preset via `/api/generate` (POST)
2. Supabase auth verified
3. Gemini API called for structured preset JSON
4. Preset saved to Supabase Storage
5. Conversation.preset_url updated in DB

**Adjustment Flow:**
1. User requests block adjustment via `/api/chat/adjust` (POST)
2. Supabase auth verified
3. Google Generative AI (gemini-2.5-flash-8b) called with block context
4. Structured parameters returned
5. No persistence (ephemeral adjustment)

**Vision/Analysis Flow:**
1. Image uploaded to `/api/vision` (POST)
2. Image compressed client-side, sent as base64
3. Supabase auth verified
4. Gemini API with vision model analyzes image
5. Analysis returned (device detection, settings extraction, etc.)

---

*Integration audit: 2026-03-18*
