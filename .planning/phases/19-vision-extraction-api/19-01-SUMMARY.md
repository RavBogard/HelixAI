---
phase: 19
plan: 01
subsystem: vision-extraction
tags: [vision, anthropic, api-route, rig-intent]
key_files:
  created:
    - src/lib/rig-vision.ts
    - src/app/api/vision/route.ts
  modified:
    - src/app/page.tsx
    - package.json
decisions:
  - None
metrics:
  duration: "~15 minutes"
  completed: "2026-03-02"
  tasks: 4
  files: 4
---

# Phase 19 Plan 01: Vision Extraction API Summary

## What Was Built

An isolated `/api/vision` POST route that accepts up to 3 base64-encoded pedal photos, calls Claude Sonnet 4.6 with vision content blocks, validates the response against `RigIntentSchema`, and returns `{ rigIntent: RigIntent }`. A `src/lib/rig-vision.ts` server-only module encapsulates the Anthropic SDK call, a three-strategy JSON extractor, and the user content builder. The welcome screen in `page.tsx` gains a standalone upload panel with client-side image compression (via dynamic import of `browser-image-compression`), per-pedal confidence badges, and a collapsible raw JSON debug view. The existing `/api/generate` route is byte-for-byte unchanged.

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `src/lib/rig-vision.ts` | Created | Server-side Anthropic vision call + JSON extraction |
| `src/app/api/vision/route.ts` | Created | `/api/vision` POST route with validation + 60s maxDuration |
| `src/app/page.tsx` | Modified | Vision state, callVision(), upload panel UI (4 sub-modifications) |
| `package.json` | Modified | Added `browser-image-compression@^2.0.2` dependency |

## Verification Results

```
npx tsc --noEmit: 0 errors (exit 0)

npm run build:
  ✓ Compiled successfully in 9.8s
  Route (app)
    ○ /
    ○ /_not-found
    ƒ /api/chat
    ƒ /api/generate
    ƒ /api/vision   ← NEW
```

## Notes for Downstream Phases

- **Phase 20 (Planner integration):** `callVision()` in `page.tsx` currently sets `rigIntent` state independently. Phase 20 should pass `rigIntent` into the `/api/generate` body so the planner can use it. The state variable is already available at the component level.
- **Phase 21 (SubstitutionCard):** The raw JSON `<details>` block in the upload panel is marked "Phase 19 only — replaced by SubstitutionCard in Phase 21". Phase 21 should replace that block with a `SubstitutionCard` component that renders the `substitutionMap` once the planner populates it.
- **Vercel Fluid Compute:** `export const maxDuration = 60` is set in `route.ts`. Before deploying, enable Fluid Compute in Vercel Dashboard → Project → Settings → Functions. Without it, the Hobby plan caps at 10 seconds which may not be enough for 3-image vision calls.
- **`RigIntentSchema`:** The vision route validates API responses against `RigIntentSchema` from `@/lib/helix`. If the schema evolves in later phases, the vision response validation will automatically reflect those changes.

## Deviations from Plan

None — plan executed exactly as written. All four tasks completed in order with zero TypeScript errors and a clean production build.

## Self-Check: PASSED

- src/lib/rig-vision.ts: FOUND
- src/app/api/vision/route.ts: FOUND
- src/app/page.tsx: MODIFIED (4 sub-modifications applied)
- package.json: MODIFIED (browser-image-compression@^2.0.2 added)
- npx tsc --noEmit: 0 errors
- npm run build: SUCCESS — /api/vision route registered as dynamic
- git diff src/app/api/generate/route.ts: EMPTY (invariant satisfied)
- git push: PUSHED to origin main (e93a61e)
