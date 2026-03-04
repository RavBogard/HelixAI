---
phase: 40-rebrand-helixai-to-helixtones
plan: 01
subsystem: ui
tags: [rebrand, branding, events, sessionStorage, package-json]

# Dependency graph
requires:
  - phase: 28-chat-sidebar-ui-ux-polish
    provides: "helixai:* custom DOM events wiring AuthButton, ChatSidebar, page.tsx"
  - phase: 25-auth-flow
    provides: "sessionStorage helixai_pre_oauth_state chat serialization before OAuth"
provides:
  - "All user-visible 'HelixAI' strings replaced with 'HelixTones'"
  - "AI persona prompts say 'You are HelixTones' and 'HelixTones' Planner'"
  - "DOM custom events renamed: helixtones:before-signin, helixtones:new-chat, helixtones:conversation-created"
  - "sessionStorage key renamed: helixtones_pre_oauth_state"
  - "Legacy sessionStorage migration block for live users at deploy time"
  - "package.json name changed to 'helixtones'"
affects: [any future phase touching user-visible strings or cross-component events]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Legacy sessionStorage key migration at app boot: read old key, write new key, delete old"
    - "Atomic cross-file event rename: all files in same task commit to prevent silent breakage"

key-files:
  created: []
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/lib/gemini.ts
    - src/lib/planner.ts
    - src/components/auth/AuthButton.tsx
    - src/components/sidebar/ChatSidebar.tsx
    - package.json
    - supabase/schema.sql

key-decisions:
  - "Legacy sessionStorage migration reads helixai_pre_oauth_state, copies to helixtones_pre_oauth_state, then deletes old key — zero overhead for new users, prevents state loss for users with open tabs at deploy time"
  - "CSS --hlx-* variables and hlx-* class names intentionally NOT renamed — design system tokens, not branding"
  - "TypeScript identifiers (functions, variables) intentionally NOT renamed — only string literals changed"
  - "Supabase env vars and schema table names intentionally NOT renamed — infrastructure, not user-visible branding"

patterns-established:
  - "DOM event names use helixtones: prefix for all cross-component CustomEvent dispatch/listen pairs"
  - "sessionStorage key uses helixtones_ prefix"

requirements-completed: [REBRAND-01, REBRAND-02, REBRAND-03, REBRAND-04]

# Metrics
duration: 5min
completed: 2026-03-04
---

# Phase 40 Plan 01: Rebrand HelixAI to HelixTones Summary

**Complete HelixAI → HelixTones rebrand across 8 source files: page title, AI persona prompts, download filenames, logo alt texts, wordmark, DOM event contracts, sessionStorage key, and package name — zero user-visible HelixAI strings remain.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-04T22:22:35Z
- **Completed:** 2026-03-04T22:27:43Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Renamed all user-visible "HelixAI" strings to "HelixTones" in layout, page, AI prompts, download filenames, logo alt texts, and wordmark span
- Renamed all `helixai:*` DOM custom events to `helixtones:*` across 3 files atomically (page.tsx, AuthButton.tsx, ChatSidebar.tsx) — 13 total occurrences including a missed sign-in banner onClick handler
- Renamed sessionStorage key and added legacy migration block for live users with open tabs at deploy time
- Build clean (exit 0), 140/140 tests pass, zero remaining `HelixAI|helixai:` grep matches in src/

## Task Commits

Each task was committed atomically:

1. **Task 1: Rename user-visible strings and AI persona prompts** - `09bd31f` (chore)
2. **Task 2: Rename cross-file DOM event and sessionStorage contracts atomically** - `d50beca` (chore)

## Files Created/Modified

- `src/app/layout.tsx` - Page title metadata: "HelixTones — Helix Preset Builder"
- `src/app/page.tsx` - Alt texts, wordmark span, download filenames, preset card fallback name, all event listeners/dispatchers, sessionStorage key + legacy migration block
- `src/lib/gemini.ts` - AI chat system prompt: "You are HelixTones" (was already renamed in a prior commit, no diff from HEAD)
- `src/lib/planner.ts` - AI planner prompt: "You are HelixTones' Planner"
- `src/components/auth/AuthButton.tsx` - Dispatches `helixtones:before-signin` event
- `src/components/sidebar/ChatSidebar.tsx` - Listens for `helixtones:conversation-created`, dispatches `helixtones:new-chat`
- `package.json` - name field: "helixtones"
- `supabase/schema.sql` - Comment header updated to HelixTones

## Decisions Made

- Legacy sessionStorage migration code reads the old `helixai_pre_oauth_state` key and migrates it to `helixtones_pre_oauth_state` before the existing getItem call — ensures no chat state loss for users with an open tab at deploy time
- CSS `--hlx-*` variables and `hlx-*` class names left unchanged — design system tokens, not branding identifiers
- TypeScript function/variable identifiers left unchanged — only string literals in quotes renamed
- Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, etc.) and schema table names left unchanged — infrastructure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Renamed missed helixai:before-signin in sign-in banner onClick handler**
- **Found during:** Task 2 (cross-file event rename verification)
- **Issue:** Plan's line inventory listed lines 467/468 for helixai:before-signin but missed a third occurrence at line ~1499 — an inline onClick on the sign-in banner button that also dispatches helixai:before-signin. Leaving it would break the chat serialization for users who click the banner Sign In button instead of the header AuthButton.
- **Fix:** Renamed `window.dispatchEvent(new Event('helixai:before-signin'))` to `helixtones:before-signin` at the sign-in banner button
- **Files modified:** src/app/page.tsx
- **Verification:** grep -rn "helixai:" src/app/page.tsx returned zero matches
- **Committed in:** d50beca (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix)
**Impact on plan:** Fix was necessary for correct event contract — the sign-in banner Sign In button would have dispatched the old event name that no longer had a listener, silently breaking chat state serialization before Google OAuth redirect.

## Issues Encountered

None beyond the one auto-fixed deviation above.

## Verification Results

```
$ grep -rn "HelixAI|Helix AI|helix-ai|helix_ai|helixai:" src/ --include="*.ts" --include="*.tsx"
(no output — exit 1)

$ npm run build
✓ Compiled successfully
✓ 12 routes compiled, exit 0

$ npx vitest run
✓ 5 test files | 140 tests passed
```

## Intentionally Unchanged

- `--hlx-*` CSS custom properties (design system tokens, not branding)
- `hlx-*` CSS class names (same)
- TypeScript identifiers: function names, variable names, import paths
- Supabase env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supabase schema table names: `conversations`, `messages`, `presets` storage bucket
- Git remote URL (github.com/...HelixAI...) — infrastructure, no runtime impact
- `package-lock.json` — not manually edited (no runtime impact on Vercel-deployed Next.js)
- Legacy `helixai_pre_oauth_state` key references in migration block — intentional (reads old, writes new, deletes old)

## Next Phase Readiness

- All HelixTones branding in place, codebase build-clean and test-green
- Phase 41 (Chat UX — device selection timing and pre-preset conversation flow) can proceed

---
*Phase: 40-rebrand-helixai-to-helixtones*
*Completed: 2026-03-04*

## Self-Check: PASSED

- FOUND: .planning/phases/40-rebrand-helixai-to-helixtones/40-01-SUMMARY.md
- FOUND: commit 09bd31f (Task 1 — user-visible strings and AI persona prompts)
- FOUND: commit d50beca (Task 2 — cross-file DOM event and sessionStorage contracts)
- FOUND: commit 02c3f41 (docs — metadata commit)
- VERIFIED: grep -rn "HelixAI|helixai:" src/ returns zero matches
- VERIFIED: npm run build exits 0
- VERIFIED: npx vitest run — 140/140 tests pass
