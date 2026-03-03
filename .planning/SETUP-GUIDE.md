# v2.0 Setup Guide — Manual Steps

Everything Claude **cannot** do for you, organized by phase.

---

## Phase 24: Supabase Foundation

### 1. Create a Supabase Project

- Go to [supabase.com/dashboard](https://supabase.com/dashboard)
- Click **New Project** — pick a name (e.g., `helixai`) and region
- Wait ~2 minutes for provisioning

### 2. Run the Schema SQL

- Go to **SQL Editor > New query** in the Supabase Dashboard
- Paste the entire contents of `supabase/schema.sql` (created by Phase 24 execution)
- Click **Run** — verify no errors

### 3. Set Environment Variables (Local)

Copy `.env.local.example` to `.env.local` and fill in:

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard > Project Settings > API > **Project URL** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard > Project Settings > API > Project API keys > **anon / public** |
| `CRON_SECRET` | Generate yourself: `openssl rand -hex 16` |

### 4. Set Environment Variables (Vercel)

- Go to **Vercel Dashboard > Your Project > Settings > Environment Variables**
- Add the same 3 variables above for **Preview** and **Production** environments

### 5. Verify Locally

```bash
npm run dev
# Visit http://localhost:3000/api/test-session
# Expected: {"user":null,"error":"..."} — no crash = success
```

---

## Phase 25: Auth Flow

### 6. Enable Anonymous Sign-In

- Supabase Dashboard > **Authentication > Providers**
- Scroll to **Anonymous Sign-Ins** — toggle **ON**

### 7. Enable Manual Linking

- Supabase Dashboard > **Authentication > Providers**
- Toggle **"Enable Manual Linking"** to **ON**
- This is required for `linkIdentity()` to upgrade anonymous users

### 8. Configure Google OAuth in Supabase

- Supabase Dashboard > **Authentication > Providers > Google**
- Toggle **ON**
- You'll see fields for **Client ID** and **Client Secret** — fill these in step 9
- Copy the **Callback URL** shown (e.g., `https://<project>.supabase.co/auth/v1/callback`)

### 9. Create Google OAuth App

- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a project (or use an existing one)
- Go to **APIs & Services > Credentials > Create Credentials > OAuth Client ID**
- Application type: **Web application**
- Authorized redirect URIs: paste the **Callback URL** from step 8
- Copy the **Client ID** and **Client Secret**
- Paste them into the Supabase Google provider settings from step 8

### 10. Set Supabase Site URL

- Supabase Dashboard > **Authentication > URL Configuration**
- Set **Site URL** to your production URL (e.g., `https://helixai.vercel.app`)
- Add `http://localhost:3000` to **Redirect URLs** (for local dev)
- Add your Vercel preview URL pattern (e.g., `https://*-your-vercel-team.vercel.app`) to **Redirect URLs**

### 11. Add Google OAuth Env Vars to Vercel (if needed)

No additional env vars needed — Google OAuth is configured entirely in Supabase Dashboard.

---

## Phases 26-27: No Manual Steps

These phases are code-only. No accounts, dashboards, or env vars needed.

---

## Phase 28: No Manual Steps

Pure UI code. The human-verify checkpoint will ask you to manually test the full flow.

---

## Summary Checklist

| Step | Phase | What | Done? |
|------|-------|------|-------|
| 1 | 24 | Create Supabase project | |
| 2 | 24 | Run `supabase/schema.sql` in SQL Editor | |
| 3 | 24 | Set env vars in `.env.local` | |
| 4 | 24 | Set env vars in Vercel Dashboard | |
| 5 | 24 | Verify locally (`/api/test-session`) | |
| 6 | 25 | Enable Anonymous Sign-Ins in Supabase | |
| 7 | 25 | Enable Manual Linking in Supabase | |
| 8 | 25 | Configure Google OAuth provider in Supabase | |
| 9 | 25 | Create Google OAuth app in Google Cloud Console | |
| 10 | 25 | Set Site URL + Redirect URLs in Supabase | |

**Total manual steps: 10** (all in Phases 24-25; Phases 26-28 are fully automated)
