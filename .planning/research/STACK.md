# Stack Research

**Domain:** Persistent chat platform — Google auth, Postgres database, file storage on Next.js + Vercel
**Researched:** 2026-03-03
**Confidence:** HIGH — key claims verified against official Supabase docs, Firebase pricing pages, and multiple independent sources

---

## Scope

This file covers ONLY the NEW stack additions for v2.0 Persistent Chat Platform. The existing
validated stack (Next.js 14+, TypeScript, Tailwind CSS, Claude Sonnet 4.6 via `@anthropic-ai/sdk`,
Zod, Vercel, `browser-image-compression`) is NOT re-researched here.

New capabilities required:
1. Google OAuth authentication with anonymous-first flow
2. Persistent chat storage — full conversation history per user in cloud database
3. Last-preset file storage — most recent .hlx/.pgp binary per conversation
4. Chat sidebar UI — pull-out panel listing past chats, resuming conversations

---

## Recommendation Summary

**Auth + Database + Storage: Use Supabase (Auth + Postgres + Storage)**

Supabase wins decisively for this project over Firebase and all other options. The full rationale
is in the Comparison section below.

**Core new packages:**
- `@supabase/supabase-js@2.80.0` — main client SDK
- `@supabase/ssr@0.8.0` — SSR-safe cookie handling for Next.js App Router
- No auth library separate from Supabase — Supabase Auth handles Google OAuth natively

**Do NOT add:** NextAuth/Auth.js, Clerk, Firebase, Prisma, any separate ORM.

---

## Core Technologies (NEW additions only)

### Authentication, Database, and Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@supabase/supabase-js` | 2.80.0 | Main client — auth, database queries, storage uploads | Isomorphic SDK; identical API in Client Components, Server Components, Server Actions, and Route Handlers. No dual SDK split like Firebase. |
| `@supabase/ssr` | 0.8.0 | SSR-safe Supabase client factory for Next.js App Router | Required for correct cookie-based session persistence across server/client boundary in App Router. Replaces the deprecated `@supabase/auth-helpers-nextjs`. |

No other packages are required for auth, database, or storage. Supabase provides all three
through the same SDK.

---

## Installation

```bash
# Core additions for v2.0
npm install @supabase/supabase-js @supabase/ssr
```

### Environment variables to add

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
# No secret key needed client-side — RLS policies enforce access control
```

---

## Supabase Integration Architecture for Next.js App Router

### Two client types required

```typescript
// utils/supabase/browser.ts — for Client Components
import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// utils/supabase/server.ts — for Server Components, Server Actions, Route Handlers
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}  // Ignored in Server Components — middleware handles refresh
        },
      },
    }
  );
}
```

### Middleware (mandatory for session refresh)

```typescript
// middleware.ts — project root
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: call getUser() not getSession() — verifies token with auth server
  await supabase.auth.getUser();
  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

Middleware is not optional. Without it, JWT tokens expire and sessions break on SSR page loads.

### Google OAuth flow

```typescript
// Server Action — triggers OAuth redirect
"use server";
import { createClient } from '@/utils/supabase/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get('origin');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (data.url) redirect(data.url);
}

// app/auth/callback/route.ts — handles OAuth code exchange
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}/`);
}
```

---

## Database Schema (Postgres)

Supabase is Postgres. Use a relational schema with foreign keys and Row Level Security (RLS).

```sql
-- Conversations table
CREATE TABLE conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'New Chat',
  device      TEXT NOT NULL,                    -- 'helixLT' | 'helixFloor' | 'podGo'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Messages table (full conversation history)
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Presets table (last .hlx/.pgp file per conversation)
-- Store file reference path in Supabase Storage, not raw bytes in Postgres
CREATE TABLE presets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,                -- 'presets/{user_id}/{conversation_id}.hlx'
  filename        TEXT NOT NULL,               -- original download filename
  device          TEXT NOT NULL,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)                      -- enforce one preset per conversation
);

-- Row Level Security policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users own their messages"
  ON messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "Users own their presets"
  ON presets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = presets.conversation_id AND c.user_id = auth.uid()
  ));
```

### Why store `storage_path` in Postgres, not the file bytes

Storing binary .hlx/.pgp files (typically 10–50KB each) as bytea in Postgres is possible but
anti-pattern. Supabase Storage is an S3-compatible object store integrated with the same auth
and RLS system. Store the path reference in Postgres, the file in Storage. This keeps the
database row compact and downloads go directly from the storage CDN.

---

## Storage (File Upload/Download)

```typescript
// Save preset file to Supabase Storage
async function savePreset(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  fileBuffer: ArrayBuffer,
  filename: string,
  device: string
) {
  const path = `presets/${userId}/${conversationId}/${filename}`;

  // upload() upserts by default — replaces existing file at same path
  const { error } = await supabase.storage
    .from('presets')
    .upload(path, fileBuffer, {
      upsert: true,
      contentType: 'application/octet-stream',
    });

  if (error) throw error;

  // Update or insert the presets table row
  await supabase.from('presets').upsert({
    conversation_id: conversationId,
    storage_path: path,
    filename,
    device,
    updated_at: new Date().toISOString(),
  });
}

// Generate a signed URL for download (private bucket, time-limited)
async function getPresetDownloadUrl(supabase: SupabaseClient, storagePath: string) {
  const { data, error } = await supabase.storage
    .from('presets')
    .createSignedUrl(storagePath, 60 * 60); // 1 hour expiry
  if (error) throw error;
  return data.signedUrl;
}
```

### Storage bucket RLS

```sql
-- Storage RLS: users can only access their own preset files
CREATE POLICY "Users can upload their own presets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'presets' AND (storage.foldername(name))[2] = auth.uid()::text);

CREATE POLICY "Users can read their own presets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'presets' AND (storage.foldername(name))[2] = auth.uid()::text);
```

---

## Free Tier Assessment

### Supabase free tier (as of 2026-03-03)

| Resource | Free Limit | HelixAI Usage Estimate | Headroom |
|----------|------------|----------------------|---------|
| Projects | 2 | 1 | OK |
| Database storage | 500 MB | <10 MB (text only) | OK |
| File storage | 1 GB | ~5 KB per preset × N users | OK for thousands of users |
| Auth MAUs | 50,000 | Early stage: <100 | OK |
| Storage egress | 2 GB/month | Minimal (small binary files) | OK |
| DB egress | 2 GB/month | Minimal (text rows) | OK |
| Inactivity pause | After 7 days | RISK — pauses if app inactive | See warning below |

**Critical free tier caveat:** Supabase pauses free projects after 7 days of inactivity (no
database activity). For a live app deployed to Vercel, this is not a concern as long as there
is some user activity each week. However, during development gaps the project may pause. Add a
simple health-check ping or upgrade to Pro ($25/month) at launch to eliminate this risk.

**Storage egress note:** .hlx and .pgp preset files are typically 10–50KB each. Even with 1,000
users each downloading their preset monthly, total egress is under 50MB — well within limits.

### Firebase free tier comparison (relevant changes)

Firebase Cloud Storage now requires the **Blaze (pay-as-you-go) plan** as of February 3, 2026.
A credit card is mandatory even if usage stays within free-tier limits. Firestore remains free
on Spark plan (50K reads/day, 20K writes/day), but Firebase Cloud Functions require Blaze plan.
This makes Firebase's "free tier" materially less free than Supabase's for new projects in 2026.

---

## Comparison: Firebase vs Supabase vs Other Options

### Firebase (Auth + Firestore + Cloud Storage)

**Decision: Do not use Firebase for this project.**

| Criterion | Firebase | Impact on HelixAI |
|-----------|----------|-------------------|
| Next.js App Router | Split SDK (client vs admin) — different code paths for SSR | Friction. Every server-side data access requires firebase-admin, adding 2.8MB to serverless cold starts. |
| TypeScript | Manual type casting — no auto-generated types | More boilerplate throughout |
| Edge runtime | Not supported — Node.js/browser only | Cannot use Vercel Edge Runtime in future |
| Storage free tier | Requires Blaze (credit card) as of Feb 3, 2026 | Not truly free |
| Cloud Functions | Require Blaze plan | Not truly free |
| Database model | NoSQL document store | Poor fit for relational conversation/message/preset structure |
| Vendor lock-in | No self-hosting, proprietary format | Data migration is a rewrite |
| bundle size (admin SDK) | firebase-admin adds ~2.8MB minified to serverless bundle | Cold start penalty on every AI API call |
| Google strategy clarity | Firebase Studio + Genkit pivot signals uncertainty about long-term direction | Strategic risk |

Firebase's split SDK architecture is the decisive disqualifier for a Next.js App Router project.
You would need firebase-admin in every server component and the client SDK in every client
component, with no shared utility pattern. The admin SDK adds ~2.8MB to the serverless bundle,
increasing cold start times on the same routes that make Claude API calls. This is unacceptable.

### Supabase (Auth + Postgres + Storage)

**Decision: Use Supabase.**

| Criterion | Supabase | Impact on HelixAI |
|-----------|----------|-------------------|
| Next.js App Router | Isomorphic SDK — same createClient pattern everywhere | Single utility pattern for server and client |
| TypeScript | Auto-generated types from schema via `supabase gen types` | Full type safety with zero manual casting |
| Edge runtime | HTTP-based SDK — works in Edge Runtime, Cloudflare, Deno | Future-compatible |
| Storage free tier | 1 GB storage, no credit card required | Truly free for early stage |
| Database model | Postgres (relational) | Correct fit: conversations, messages, presets are naturally relational |
| RLS | Row Level Security enforced at database level | Auth and data access in one place, not two |
| Google OAuth | Native provider in Supabase Auth — dashboard toggle, no library | Simple setup |
| bundle size | @supabase/supabase-js is HTTP-based, tree-shakeable | Lean serverless footprint |
| Open source | Self-hostable — data is standard Postgres | No lock-in; `pg_dump` and migrate anytime |
| Inactivity pause | Free projects pause after 7 days | Only concern — manageable |

### NextAuth/Auth.js v5 (standalone)

**Decision: Do not use — redundant with Supabase Auth.**

NextAuth v5 is the correct choice when you want auth only and handle database/storage separately.
For this project, Supabase provides auth, database, and storage through one SDK. Adding NextAuth
would mean managing two separate auth systems (NextAuth sessions + Supabase JWTs), two separate
session stores, and two separate Google OAuth configurations. The complexity cost is pure overhead
with no benefit.

### Clerk (standalone auth)

**Decision: Do not use — wrong tool for this scope.**

Clerk is an auth-only SaaS with excellent pre-built UI components (sign-in modal, user profile
widget). It charges per MAU after the free tier (10K–50K depending on tier). For HelixAI's
anonymous-first model where users may never create accounts, Clerk's MAU billing penalizes
anonymous session counts. More importantly, Clerk does not provide database or file storage —
you would still need Supabase or another backend for persistence. Two vendors, two SDKs, two
billing relationships, for functionality Supabase provides in one package.

### Prisma (ORM)

**Decision: Do not add Prisma.**

Prisma is the standard ORM for Next.js + Postgres when you control your own Postgres server.
With Supabase, you query directly via `@supabase/supabase-js` using the PostgREST auto-generated
API. Prisma adds a dependency, schema management overhead, and a separate migration system that
conflicts with Supabase's built-in migration tooling. Use Supabase's typed client directly — it
generates TypeScript types from your schema via `supabase gen types typescript --local > types/supabase.ts`.

---

## Anonymous-First Auth Model

HelixAI's requirement: anonymous usage fully functional, login unlocks persistence.

**Implementation pattern:**

```typescript
// Check session in Server Component
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

// user === null → anonymous — render chat without sidebar, no save
// user !== null → authenticated — render chat + sidebar, enable persistence
```

When an anonymous user generates a preset, it downloads immediately (current behavior). No
database write. When a logged-in user generates a preset, save to Supabase as a background
operation after the download is triggered. Do not block the download on the storage save.

**Session state flow:**
- Anonymous: no Supabase session, no database writes, full chat/generation functionality
- Post-Google-OAuth: Supabase session cookie set, sidebar fetches conversation list, saves on generate

---

## Chat Sidebar UI

No additional library is required for the sidebar component itself. Use Tailwind CSS with the
existing Warm Analog Studio design system. The sidebar is a standard slide-out panel:

```typescript
// Rough structure — no new UI library needed
<aside className={`fixed left-0 top-0 h-full w-72 bg-[#1a1a18] border-r border-[#2a2a27]
  transform transition-transform duration-300
  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
  {/* Conversation list from Supabase query */}
  {conversations.map(conv => (
    <ConversationItem key={conv.id} conversation={conv} />
  ))}
</aside>
```

Conversations fetched via server component or client-side Supabase query:

```typescript
const { data: conversations } = await supabase
  .from('conversations')
  .select('id, title, device, updated_at')
  .order('updated_at', { ascending: false })
  .limit(50);
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase (all-in-one) | Firebase | If building a mobile-first app with offline sync — Firestore's mobile SDKs and offline persistence are best-in-class; not relevant for a web app |
| Supabase | Clerk + separate DB | If auth complexity dominates (SAML, org management, MFA UX) and you already have a Postgres server |
| Supabase | NextAuth + PlanetScale | If you want zero vendor dependency and control your own auth logic — more setup time, same end result |
| Supabase Auth | Auth0 | For enterprise SAML SSO at scale (>10K+ enterprise users) — Auth0 has better enterprise IdP integrations |
| Direct `supabase-js` queries | Prisma ORM | If you switch away from Supabase to a bare Postgres server — then Prisma is the right ORM |
| Supabase Storage | Vercel Blob | Vercel Blob has no built-in auth integration — you would manage access control manually. Supabase Storage RLS ties directly to user identity. |
| Supabase Storage | AWS S3 | At scale (millions of files), S3 has lower egress costs — premature optimization for this stage |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `firebase-admin` SDK | Adds ~2.8MB (minified) to serverless bundle — increases cold start time on same routes making Claude API calls; split client/server SDK pattern creates friction throughout Next.js App Router | `@supabase/supabase-js` (HTTP-based, isomorphic) |
| `@supabase/auth-helpers-nextjs` | Officially deprecated as of 2024 — no further bug fixes or features | `@supabase/ssr@0.8.0` |
| Firebase Cloud Storage (free tier) | Requires Blaze plan (credit card mandatory) as of February 3, 2026 — not actually free | Supabase Storage (1 GB free, no credit card) |
| Storing .hlx/.pgp bytes in Postgres bytea | Works but anti-pattern — inflates row sizes, no CDN delivery, no streaming | Supabase Storage (object store) with `storage_path` reference in Postgres |
| Prisma ORM | Duplicate schema management system that conflicts with Supabase migrations; `supabase-js` typed client already provides full type safety | `supabase-js` typed client + `supabase gen types` |
| Clerk | Auth-only — still needs separate database/storage; MAU billing is unfavorable for anonymous-first model | Supabase Auth (included in same SDK) |
| NextAuth/Auth.js (alongside Supabase) | Two auth systems means two JWT issuers, two session stores, two Google OAuth configurations — pure overhead | Supabase Auth handles Google OAuth natively |
| Supabase Realtime subscriptions | Not needed for this use case — chat history is loaded on sidebar open, not live-updated across tabs | Standard REST queries via `supabase-js` |

---

## Stack Patterns by Variant

**If user is anonymous (no Google login):**
- No Supabase database writes
- Chat runs entirely client-side state (existing React state)
- Download preset on generate — current behavior unchanged
- Sidebar is hidden or shows "Sign in to save chats"

**If user is authenticated (Google OAuth complete):**
- On new chat: create a `conversations` row, store conversation ID in React state
- On each AI response: append to `messages` table (can batch — write on response complete, not per-token)
- On preset generate + download: trigger `savePreset()` as non-blocking background call after download
- On sidebar open: fetch `conversations` ordered by `updated_at`
- On conversation click: fetch `messages` for that `conversation_id`, restore to chat state

**If user signs in mid-session (was anonymous, clicks Sign In):**
- Complete Google OAuth flow
- Do NOT auto-import the anonymous session's messages — present a clean slate
- Display sidebar immediately after redirect back
- The in-flight anonymous session is discarded (no migration complexity)

**If user has a saved preset to re-download:**
- Fetch signed URL from Supabase Storage (1 hour expiry)
- Trigger browser download via the signed URL
- No server-side proxy needed — user downloads directly from Supabase CDN

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `@supabase/supabase-js` | 2.80.0 | Next.js 14+, TypeScript 5.x, Node.js 20+ | Node.js 18 support dropped at 2.79.0 — Vercel typically runs Node 20 |
| `@supabase/ssr` | 0.8.0 | Next.js 14+ App Router | Requires Next.js App Router — not compatible with Pages Router patterns |
| `@supabase/auth-helpers-nextjs` | DEPRECATED | — | Do not install — use `@supabase/ssr` instead |

---

## Sources

- Supabase SSR official docs — two client types, middleware pattern, cookie setup: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Google OAuth guide — provider setup, Server Action pattern, callback route: https://supabase.com/docs/guides/auth/social-login/auth-google
- Supabase Storage JS reference — upload, upsert, signed URLs: https://supabase.com/docs/reference/javascript/storage-from-upload
- Supabase pricing page (verified 2026-03-03) — 500MB DB, 1GB storage, 50K MAUs, 7-day inactivity pause: https://supabase.com/pricing
- `@supabase/supabase-js` npm — latest version 2.80.0, Node.js 18 dropped at 2.79.0: https://www.npmjs.com/package/@supabase/supabase-js
- `@supabase/ssr` npm — version 0.8.0, replaces deprecated auth-helpers: https://www.npmjs.com/package/@supabase/ssr
- Firebase Cloud Storage pricing change — Blaze plan required as of February 3, 2026: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Firebase Firestore free tier quotas — 50K reads/day, 20K writes/day, 1 GB storage: https://firebase.google.com/docs/firestore/quotas
- Firebase vs Supabase 2026 comparison — PostgreSQL won the BaaS battle, split SDK friction: https://makerkit.dev/blog/saas/supabase-vs-firebase
- Firebase Admin SDK bundle size — 2.8MB minified, 165 additional packages, serverless cold start impact (MEDIUM confidence, multiple sources): https://lightrun.com/answers/firebase-firebase-admin-node-fr-bundle-size
- Supabase Next.js tutorial — official quickstart with App Router: https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs
- `@supabase/auth-helpers-nextjs` deprecation notice — 0.15.0 is final version: https://www.npmjs.com/package/@supabase/auth-helpers-nextjs

---

*Stack research for: HelixAI v2.0 Persistent Chat Platform — auth, database, file storage additions*
*Researched: 2026-03-03*
