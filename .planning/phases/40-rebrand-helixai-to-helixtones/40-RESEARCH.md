# Phase 40: Rebrand HelixAI to HelixTones - Research

**Researched:** 2026-03-04
**Domain:** Codebase text search and surgical string replacement — no new libraries
**Confidence:** HIGH

## Summary

This phase is a surgical find-and-replace across user-visible display strings. It requires no new dependencies, no architectural changes, and no library upgrades. The entire task is identifying which occurrences of "HelixAI" are user-facing (rename them) versus which are internal identifiers (leave them alone or decide deliberately).

The codebase has been exhaustively searched. There are two clearly different categories of hits:
1. **User-visible display strings** — these MUST be updated to "HelixTones" or "helixtones.com"
2. **Internal code identifiers** — custom DOM event names (`helixai:before-signin`, etc.), `sessionStorage` keys, and downloaded filename defaults. These are cross-file contracts and must be renamed consistently AS A UNIT if renamed at all.

The `package.json` `"name"` field (`"helix-ai"`) is an npm package name, not user-visible. It should be updated to `"helixtones"` for consistency but has zero user-visible impact. The `supabase/schema.sql` comment is a comment only — low priority. Environment variable names (`NEXT_PUBLIC_SUPABASE_URL`, etc.) must NOT be renamed.

**Primary recommendation:** Update every user-visible display string from "HelixAI" to "HelixTones", update the page `<title>` and `<meta>` description, update `alt` text on logo images, update AI system prompt persona names, update downloaded filename prefixes. Rename internal `helixai:*` event names and `helixai_pre_oauth_state` sessionStorage key as a coordinated rename across all 4 files that reference them.

---

## Complete Inventory of All Occurrences

This is the authoritative hit list produced by exhaustive `grep` across all source files (excluding `node_modules`, `.git`, `.next`, `.planning`).

### Category A: User-Visible Display Strings — MUST RENAME

| File | Line | Current Value | Proposed Value |
|------|------|---------------|----------------|
| `src/app/layout.tsx` | 24 | `title: "HelixAI — Helix Preset Builder"` | `title: "HelixTones — Helix Preset Builder"` |
| `src/app/layout.tsx` | 25 | `description: "AI-powered tone consultant and preset generator for Line 6 Helix"` | `description: "AI-powered tone consultant and preset generator for Line 6 Helix"` (no change needed — already brand-neutral) |
| `src/app/page.tsx` | 1019 | `alt="HelixAI"` (logo image in chat header) | `alt="HelixTones"` |
| `src/app/page.tsx` | 1085 | `alt="HelixAI"` (hero logo image on empty state) | `alt="HelixTones"` |
| `src/app/page.tsx` | 1424 | `"HelixAI Preset"` (preset card fallback name) | `"HelixTones Preset"` |
| `src/app/page.tsx` | 760 | `"HelixAI_Preset"` (download filename base — inline generation) | `"HelixTones_Preset"` |
| `src/app/page.tsx` | 806 | `` `HelixAI_Preset${deviceSuffix}${ext}` `` (download filename — stored preset) | `` `HelixTones_Preset${deviceSuffix}${ext}` `` |

**Note on description:** The current `<meta description>` is already brand-neutral ("AI-powered tone consultant..."). No change needed unless desired.

### Category B: AI Persona Names in System Prompts — RENAME

These are strings sent to the AI APIs. They are not literally rendered to the user in the UI, but if the AI refers to itself by name in responses, the user will see "HelixAI". These should be updated.

| File | Line | Current Value | Proposed Value |
|------|------|---------------|----------------|
| `src/lib/gemini.ts` | 34 | `"You are HelixAI, an expert guitar tone consultant..."` | `"You are HelixTones, an expert guitar tone consultant..."` |
| `src/lib/planner.ts` | 27 | `"You are HelixAI's Planner..."` | `"You are HelixTones' Planner..."` |

### Category C: Internal Cross-File Contracts — RENAME AS A COORDINATED UNIT

These are DOM custom event names and a sessionStorage key. They are not user-visible but must be renamed consistently across all files that use them or the events will break silently.

**Custom DOM events (4 files must update together):**

| Event Name | Files That Use It |
|------------|------------------|
| `helixai:before-signin` | `src/app/page.tsx` (lines 467, 468, 1488), `src/components/auth/AuthButton.tsx` (line 58) |
| `helixai:new-chat` | `src/app/page.tsx` (lines 489, 490), `src/components/sidebar/ChatSidebar.tsx` (line 67) |
| `helixai:conversation-created` | `src/app/page.tsx` (lines 632, 637, 724, 728), `src/components/sidebar/ChatSidebar.tsx` (lines 43, 44) |

**Proposed rename:** `helixai:` prefix → `helixtones:` prefix

**sessionStorage key (1 file):**

| Key | File | Lines |
|-----|------|-------|
| `helixai_pre_oauth_state` | `src/app/page.tsx` | 390, 400, 456 |

**Proposed rename:** `helixai_pre_oauth_state` → `helixtones_pre_oauth_state`

**Risk:** If any user has an active session with `helixai_pre_oauth_state` in their browser storage at the time of deployment, the OAuth state preservation will silently fail (they would just lose their unsaved chat state during OAuth redirect — non-critical). Acceptable.

### Category D: Package Name — LOW PRIORITY, UPDATE FOR CONSISTENCY

| File | Field | Current | Proposed |
|------|-------|---------|----------|
| `package.json` | `"name"` | `"helix-ai"` | `"helixtones"` |
| `package-lock.json` | `"name"` (×2) | `"helix-ai"` | `"helixtones"` |

**Note:** `package.json` name is the npm package identifier, not a user-visible string. It does not affect the deployed app. Update for consistency but no functional impact.

### Category E: Comments Only — OPTIONAL

| File | Line | Content | Action |
|------|------|---------|--------|
| `supabase/schema.sql` | 1 | `-- HelixAI v2.0 Database Schema` | Optional rename to `-- HelixTones v2.0 Database Schema` |

### Category F: DO NOT TOUCH — Internal Config / Git Artifacts

| File | Reason to Leave Alone |
|------|----------------------|
| `.claude/settings.local.json` | Stored CLI command history — not user-visible, not deployed |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL — tied to actual project infrastructure |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase credential — tied to actual project |
| GitHub repo remote URL `github.com/RavBogard/HelixAI.git` | This is a git remote — not in-app branding |
| All `hlx-*` CSS variable and class names | These are internal "hlx" prefix design tokens, not "HelixAI" branding |

---

## Architecture Patterns

This phase has no framework or library concerns. The pattern is:

### Pattern 1: Surgical String Replacement with Grep Verification

**What:** Find every instance, categorize it, update string values only — no logic changes.

**When to use:** Anytime a display string changes across multiple files.

**How:**
```typescript
// Before (layout.tsx)
export const metadata: Metadata = {
  title: "HelixAI — Helix Preset Builder",
  description: "AI-powered tone consultant and preset generator for Line 6 Helix",
};

// After
export const metadata: Metadata = {
  title: "HelixTones — Helix Preset Builder",
  description: "AI-powered tone consultant and preset generator for Line 6 Helix",
};
```

```typescript
// Before (gemini.ts)
return `You are HelixAI, an expert guitar tone consultant...`

// After
return `You are HelixTones, an expert guitar tone consultant...`
```

```typescript
// Before (page.tsx — event names)
window.addEventListener('helixai:before-signin', handler)
window.dispatchEvent(new Event('helixai:before-signin'))
sessionStorage.getItem('helixai_pre_oauth_state')

// After
window.addEventListener('helixtones:before-signin', handler)
window.dispatchEvent(new Event('helixtones:before-signin'))
sessionStorage.getItem('helixtones_pre_oauth_state')
```

### Anti-Patterns to Avoid

- **Renaming CSS variable prefixes (`hlx-*`):** These are NOT "HelixAI" branded — `hlx` is a short design-system prefix. Leave all `--hlx-*` variables and `hlx-*` class names untouched.
- **Renaming Supabase env vars:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are tied to the live Supabase project. Do not rename.
- **Partial event name updates:** If renaming `helixai:*` events, ALL 4 files must be updated atomically. A partial rename breaks the app silently.
- **Touching `package-lock.json` manually:** Regenerate via `npm install` if `package.json` `name` is changed, or just leave `package-lock.json` stale (it has no runtime impact on deployed Next.js apps).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding all occurrences | Manual file inspection | `grep -rn` across src/ | Fast, exhaustive, reproducible |
| Verifying no regressions | Visual UI inspection | Post-change `grep` sweep to confirm zero remaining hits | Grep confirms completeness |

**Key insight:** This is 100% a text-editing task. No new tools, libraries, or architectural patterns are required.

---

## Common Pitfalls

### Pitfall 1: Missing the Event Name Cross-File Contract
**What goes wrong:** Developer renames `helixai:before-signin` in `page.tsx` but forgets `AuthButton.tsx`. The `AuthButton` dispatches the old event name; `page.tsx` listens for the new name. Chat state is silently lost on OAuth.
**Why it happens:** The event coupling is invisible — `page.tsx` and `AuthButton.tsx` are not imported from each other.
**How to avoid:** Update all 4 files in the same commit. Run a `grep` after for any remaining `helixai:` strings.
**Warning signs:** Post-rename `grep` still shows `helixai:` in any `.tsx` file.

### Pitfall 2: Renaming Internal CSS Token Prefix
**What goes wrong:** Developer sees `hlx-` prefix and assumes it means "HelixAI" and renames all CSS variables.
**Why it happens:** The visual similarity of `hlx` to `HelixAI` looks like a match.
**How to avoid:** The grep pattern `HelixAI|Helix AI|helix-ai|helix_ai|helixai` does NOT match `hlx`. Keep the search precise — only act on the exact strings in the inventory above.
**Warning signs:** Any attempt to `s/hlx/helixtones/g` — that is incorrect.

### Pitfall 3: Stale sessionStorage Key in Live Users' Browsers
**What goes wrong:** User has `helixai_pre_oauth_state` in their browser sessionStorage at deploy time. After deploy, the app looks for `helixtones_pre_oauth_state` — doesn't find it — loses pre-auth chat state.
**Why it happens:** sessionStorage persists across page loads within a tab.
**How to avoid:** This is acceptable (non-critical UX degradation). Add a one-time migration at app boot: check for old key and migrate to new key if found. Optional but nice.
**Warning signs:** Users report losing chat after signing in (rare).

### Pitfall 4: Forgetting the AI Prompt Persona
**What goes wrong:** Page title says "HelixTones" but the AI introduces itself as "HelixAI" in chat responses.
**Why it happens:** `src/lib/gemini.ts` system prompt is easy to overlook since it's not UI code.
**How to avoid:** Always update both `gemini.ts` and `planner.ts` together with UI changes.
**Warning signs:** AI response contains "I'm HelixAI, your guitar tone consultant".

---

## Code Examples

### Next.js Metadata (layout.tsx)
```typescript
// Source: direct codebase inspection
export const metadata: Metadata = {
  title: "HelixTones — Helix Preset Builder",
  description: "AI-powered tone consultant and preset generator for Line 6 Helix",
};
```

### Coordinated Event Rename Pattern
```typescript
// In page.tsx, AuthButton.tsx, ChatSidebar.tsx — rename ALL simultaneously
// Old: 'helixai:before-signin'  -> New: 'helixtones:before-signin'
// Old: 'helixai:new-chat'       -> New: 'helixtones:new-chat'
// Old: 'helixai:conversation-created' -> New: 'helixtones:conversation-created'
// Old: 'helixai_pre_oauth_state' -> New: 'helixtones_pre_oauth_state'
```

### Verification Grep After Changes
```bash
# Should return ZERO results after all changes are applied
grep -rn "HelixAI\|Helix AI\|helix-ai\|helix_ai\|helixai:" \
  src/ \
  --include="*.ts" --include="*.tsx"

# Expected: no output
```

---

## No OpenGraph / Twitter Cards Currently

The current `layout.tsx` uses only `title` and `description` in the `Metadata` object. There are no `openGraph`, `twitter`, or `canonical` fields defined. The existing `description` is already brand-neutral and does not need to change. If the planner wants to add OpenGraph metadata, that is an enhancement beyond the scope of this rebrand.

## No PWA Manifest File

There is no `public/manifest.json` or `public/site.webmanifest`. Nothing in `public/` contains brand strings. The only files in `public/` are SVGs and `logo.jpg` (image file — no text content).

---

## Open Questions

1. **Should the sessionStorage key be migrated for live users?**
   - What we know: renaming the key causes silent loss of pre-auth chat state for users with an active session at deploy time
   - What's unclear: whether there are significant numbers of users in this state
   - Recommendation: add a one-line migration at app boot: `if (sessionStorage.getItem('helixai_pre_oauth_state')) { sessionStorage.setItem('helixtones_pre_oauth_state', sessionStorage.getItem('helixai_pre_oauth_state')!); sessionStorage.removeItem('helixai_pre_oauth_state') }` — optional but zero cost

2. **Should `package.json` `"name"` be updated?**
   - What we know: it is not user-visible and has no runtime impact
   - What's unclear: whether any CI/CD scripts key on the package name
   - Recommendation: update it for consistency (`"helixtones"`), but treat as lowest priority

3. **Is there a favicon or logo image to update?**
   - What we know: `public/logo.jpg` is referenced in `page.tsx` for the logo display; no text content in the image was scanned
   - What's unclear: whether `logo.jpg` contains "HelixAI" text embedded in the image itself
   - Recommendation: visually inspect `public/logo.jpg` before closing this phase — if it has "HelixAI" text burned into the image, it needs a new image asset

---

## Sources

### Primary (HIGH confidence)
- Direct codebase grep — exhaustive search across `src/`, `public/`, `supabase/`, `package.json`, `next.config.ts`, `vercel.json` using patterns: `HelixAI`, `Helix AI`, `helix-ai`, `helix_ai`, `helixai`
- Direct file reads: `src/app/layout.tsx`, `src/app/page.tsx`, `src/lib/gemini.ts`, `src/lib/planner.ts`, `src/components/auth/AuthButton.tsx`, `src/components/sidebar/ChatSidebar.tsx`, `package.json`

### Secondary (MEDIUM confidence)
- N/A — no external library research needed for this phase

### Tertiary (LOW confidence)
- N/A

---

## Metadata

**Confidence breakdown:**
- Inventory completeness: HIGH — exhaustive grep with 5 pattern variants across all source directories
- Rename safety: HIGH — all files read, cross-file contracts identified and documented
- Risk assessment: HIGH — no database migrations, no API changes, no dependency changes required

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (codebase-based — stable until files change)
