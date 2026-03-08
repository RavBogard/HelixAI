---
phase: 03-ai-conciseness-overhaul
plan: 01
subsystem: ai-prompts
tags: [conciseness, chat-prompts, scannability, response-style]

requires:
  - phase: 02-device-specific-preset-intelligence
    provides: Per-family effect intelligence already parameterized
provides:
  - Concise chat prompts with bolded key info and structured summaries
  - 2-3 exchange interview flow (down from 4-5)
  - Structured [READY_TO_GENERATE] format (Amp/Cab/Effects/Snapshots)
affects: [phase-04 UI/UX redesign, future chat improvements]

tech-stack:
  added: []
  patterns: [Response Style section in all chat prompts, structured generate summary format]

key-files:
  modified:
    - src/lib/families/helix/prompt.ts
    - src/lib/families/helix/prompt.test.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/stomp/prompt.test.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/podgo/prompt.test.ts
    - src/lib/families/stadium/prompt.ts
    - src/lib/families/stadium/prompt.test.ts

key-decisions:
  - "Keep two-context chat→planner architecture (decided, not a debt)"
  - "Removed Pro Techniques and Expertise sections — let knowledge emerge from recommendations"
  - "Tightened interview from 5-step to 3-step flow"

patterns-established:
  - "Response Style section with conciseness directives in all chat prompts"
  - "Structured [READY_TO_GENERATE] format: Amp/Cab/Effects/Snapshots/Notes"

duration: ~20min
completed: 2026-03-08
---

# Phase 3 Plan 01: AI Conciseness Overhaul Summary

**Rewrote all 4 family chat prompts for brevity — added conciseness directives, structured generate summaries, and tightened interview from 5 steps to 3.**

## Performance

| Metric | Value |
|--------|-------|
| Completed | 2026-03-08 |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files modified | 8 |
| Tests | 132 family tests pass, 1201 total |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Conciseness Directives | Pass | All 4 prompts contain "Be concise", "Bold key info", "No filler" |
| AC-2: Response Length Guidance | Pass | "2-4 sentences per response", "Lead with the answer" |
| AC-3: Key Info Formatting | Pass | Bold directives, bullet list instructions, structured summary format |
| AC-4: Interview Flow Tightened | Pass | 3-step flow, "One question per response", 2-3 exchange target |
| AC-5: Cache Identity Preserved | Pass | helix_lt === helix_floor verified |
| AC-6: All Tests Pass | Pass | 132 family tests, 1201 total, zero failures |

## Accomplishments

- All 4 `getSystemPrompt()` functions rewritten with "Response Style" section enforcing conciseness
- Interview flow reduced from 5 steps to 3 (Tone+Guitar → Confirm → Generate)
- Structured [READY_TO_GENERATE] format replaces prose summaries (Amp/Cab/Effects/Snapshots/Notes)
- Removed redundant sections: "Your Expertise", "Pro Techniques", verbose "Conversation Flow"
- Architecture decision recorded: keep two-context chat→planner (not a debt)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/families/helix/prompt.ts` | Modified | Rewrote getSystemPrompt with conciseness directives |
| `src/lib/families/stomp/prompt.ts` | Modified | Rewrote getSystemPrompt with conciseness directives |
| `src/lib/families/podgo/prompt.ts` | Modified | Rewrote getSystemPrompt with conciseness directives |
| `src/lib/families/stadium/prompt.ts` | Modified | Rewrote getSystemPrompt with conciseness directives |
| `src/lib/families/helix/prompt.test.ts` | Modified | Added conciseness + structured format tests |
| `src/lib/families/stomp/prompt.test.ts` | Modified | Added conciseness tests, updated budget personality regex |
| `src/lib/families/podgo/prompt.test.ts` | Modified | Added conciseness tests, updated empowering/dual-amp regex |
| `src/lib/families/stadium/prompt.test.ts` | Modified | Added conciseness + structured format tests |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep two-context architecture | Chat uses Google Search, planner needs structured output — incompatible in unified | Closes known issue, no architecture debt |
| Remove Pro Techniques section | Let knowledge emerge from recommendations, not instructions | Shorter prompts, less instruction overhead |
| 3-step interview flow | Users want presets fast, not lengthy interviews | Faster time-to-generate |

## Deviations from Plan

None — plan executed as written.

## Next Phase Readiness

**Ready:**
- Chat prompts optimized for conciseness and scannability
- Foundation set for Phase 4 UI/UX redesign

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 03-ai-conciseness-overhaul, Plan: 01*
*Completed: 2026-03-08*
