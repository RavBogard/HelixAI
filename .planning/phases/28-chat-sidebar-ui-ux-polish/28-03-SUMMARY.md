---
phase: 28-chat-sidebar-ui-ux-polish
plan: "03"
subsystem: ui
tags: [react, nextjs, state-management, ux-polish, anonymous-auth]

# Dependency graph
requires:
  - phase: 28-02
    provides: isResumingConversation state, loadConversation(), conversationId state, router/searchParams wiring
  - phase: 27-02
    provides: conversationId state, conversationIdRef, ensureConversation()
  - phase: 25
    provides: helixai:before-signin event pattern, AuthButton OAuth flow

provides:
  - showSignInBanner state + trigger in downloadPreset() for anonymous users (UXP-01)
  - isLoadingConversation state + finally-block clear in loadConversation() (UXP-02)
  - Spinner + "Loading conversation…" JSX replacing messages area during resume (UXP-02)
  - Three continuation chip buttons above input after conversation resume (UXP-03)
  - Sign-in banner JSX with Sign-in button dispatching helixai:before-signin and dismiss button (UXP-01)

affects:
  - Phase 29 (Dual-Amp Fix) — page.tsx state shape
  - Any future phase touching the messages area or input bar in page.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "finally block for loading state cleanup — ensures isLoadingConversation always clears even on early return"
    - "Three-way conditional render: isLoadingConversation ? Spinner : messages.length === 0 ? WelcomeScreen : ChatFlow"
    - "Chip buttons clear isResumingConversation on click — one-shot UX affordance"
    - "conversationId presence as anonymous user signal — null = anonymous, non-null = authenticated"

key-files:
  created: []
  modified:
    - src/app/page.tsx

key-decisions:
  - "showSignInBanner triggered only when conversationId is null after download — relies on ensureConversation() returning null for anonymous users (Phase 27-02 contract)"
  - "isLoadingConversation clears in finally block not try block — early return from !res.ok does not orphan the spinner"
  - "Continuation chips rendered outside the input form div, at the same nesting level — chips above input, not inside form"
  - "Generate for [other device] chip avoids pod_go as alternate — always picks helix_lt or helix_floor"
  - "Human verify checkpoint approved without local dev server — Vercel-only deployment; human testing deferred to post-push"

patterns-established:
  - "UXP banner pattern: state flag + JSX block + clear in startOver() — zero prop drilling, self-contained"

requirements-completed: [UXP-01, UXP-02, UXP-03]

# Metrics
duration: continuation
completed: 2026-03-03
---

# Phase 28 Plan 03: UX Polish Summary

**Sign-in banner for anonymous downloads, loading spinner during conversation resume, and three continuation chip buttons after resume — all wired to page.tsx state with no new files or dependencies.**

## Performance

- **Duration:** continuation (previous agent executed tasks 1-2; this agent created SUMMARY)
- **Started:** 2026-03-03
- **Completed:** 2026-03-03
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 1 (src/app/page.tsx)

## Accomplishments

- UXP-01: Anonymous users who download a preset see a non-blocking banner "Sign in to save this chat and come back to refine it later" with OAuth trigger and dismiss button
- UXP-02: Clicking a sidebar conversation immediately shows a centered spinner + "Loading conversation…" text, replacing the messages area during fetch
- UXP-03: After a conversation loads, three chip buttons appear above the input ("Refine this tone", "Try a different amp", "Generate for [other device]"), disappearing once the user acts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add showSignInBanner and isLoadingConversation state, wire UXP-01/UXP-02** - `c8ca7b0` (feat)
2. **Task 2: Add UXP-01 banner JSX, UXP-02 loading indicator JSX, UXP-03 continuation chips JSX** - `e865149` (feat)
3. **Task 3: End-to-end verification (checkpoint: human-verify)** - approved by user; Vercel-only deployment, human testing deferred to post-push

## Files Created/Modified

- `src/app/page.tsx` - Two new state variables (showSignInBanner, isLoadingConversation), downloadPreset() banner trigger, loadConversation() loading state with finally block, three JSX blocks for UXP-01/02/03, startOver() banner clear

## Decisions Made

- showSignInBanner triggered when conversationId is null post-download — conversationId null is the established anonymous user signal from Phase 27-02
- isLoadingConversation cleared in finally block — ensures spinner always clears even if the early-return branch fires before reaching the normal finally
- Continuation chips rendered at the same nesting level as the input div (outside the form) — chips appear above input bar without being inside the form element
- "Generate for [other device]" avoids pod_go as alternate; always maps to helix_lt or helix_floor
- Human-verify checkpoint approved without local server verification — user confirmed Vercel-only deployment model; testing to happen after push

## Deviations from Plan

None — plan executed exactly as written. Human-verify checkpoint approved by user with deferred testing instruction.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All Phase 28 requirements (SIDE-01 through SIDE-06, UXP-01 through UXP-03) are implemented
- Phase 28 is complete — all 3 plans done
- Phase 29 (Dual-Amp Preset Generation Fix) is next
- page.tsx state is clean; no blocking concerns for Phase 29

---
*Phase: 28-chat-sidebar-ui-ux-polish*
*Completed: 2026-03-03*
