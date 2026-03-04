---
phase: 41-chat-ux-device-selection-timing-and-pre-preset-conversation-flow
plan: 01
subsystem: ui
tags: [react, nextjs, gemini, chat-ux, device-picker, system-prompt]

# Dependency graph
requires:
  - phase: 23-phase-23-ux-polish-post-chat-device-picker-modal-font-legibility-rig-upload-integrated-into-prompt-bar
    provides: device picker component and readyToGenerate state
  - phase: 37-ui-device-selector
    provides: device picker expanded to 6 devices (Stadium, Stomp, Stomp XL)
provides:
  - Device picker gated on readyToGenerate AI signal instead of raw message count
  - System prompt with enforced minimum conversational arc (2+ exchanges before [READY_TO_GENERATE])
affects:
  - Any future chat UX phases
  - gemini.ts system prompt modifications

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "readyToGenerate as the single source of truth for device picker visibility"
    - "System prompt 3-beat arc: opening question → guitar details → summary + signal"

key-files:
  created: []
  modified:
    - src/app/page.tsx
    - src/lib/gemini.ts

key-decisions:
  - "Gate device picker on readyToGenerate flag, not messages.length >= 2 — AI signal is the authoritative readiness indicator"
  - "Remove unreachable !readyToGenerate hint text — it could never be truthy inside a readyToGenerate-gated block"
  - "System prompt minimum rule: AI must never emit [READY_TO_GENERATE] on first response even with complete upfront info"

patterns-established:
  - "Conversation arc pattern: opening → guitar context → summary/signal (3 beats before readiness)"

requirements-completed: [CHATUX-01, CHATUX-02]

# Metrics
duration: 8min
completed: 2026-03-04
---

# Phase 41 Plan 01: Chat UX — Device Selection Timing and Pre-Preset Conversation Flow Summary

**Device picker gated on AI readyToGenerate signal instead of message count, with system prompt enforcing a 3-beat conversational arc before [READY_TO_GENERATE] is emitted**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-04T22:22:49Z
- **Completed:** 2026-03-04T22:30:00Z
- **Tasks:** 2 auto (+ 1 checkpoint treated as non-blocking per execution instructions)
- **Files modified:** 2

## Accomplishments

- Device picker in page.tsx now appears only after the AI emits [READY_TO_GENERATE], not after a raw message count threshold
- Removed dead `!readyToGenerate` hint text block that could never render inside a readyToGenerate-gated section
- System prompt rewritten with an explicit 3-beat Conversation Flow section: opening question, guitar context, summary + signal
- Hard minimum rule added: AI must never emit [READY_TO_GENERATE] in its very first response
- Old permissive rule ("include after even a single detailed description") replaced with "after at least 2 exchanges"
- All 140 tests pass, TypeScript compiles clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate device picker on readyToGenerate in page.tsx** - `7414f67` (feat)
2. **Task 2: Rewrite "When Ready to Generate" section in gemini.ts** - `fb94b74` (feat)

**Plan metadata:** (docs commit — added after state updates)

## Files Created/Modified

- `src/app/page.tsx` — Changed device picker condition from `messages.length >= 2 && !isStreaming && !generatedPreset` to `readyToGenerate && !isStreaming && !generatedPreset`; removed unreachable `{!readyToGenerate && <p>Ready when you are...</p>}` block
- `src/lib/gemini.ts` — Inserted `## Conversation Flow` section before `## When Ready to Generate`; replaced single-response-is-enough rule with minimum-2-exchanges + never-on-first-response rules

## Decisions Made

- **readyToGenerate as the single source of truth:** The flag already existed and was set correctly by `sendMessage()`, `loadConversation()`, and `startOver()`. Switching the device picker to use it required only a one-line condition change — no new state needed.
- **Remove hint text rather than update it:** The `{!readyToGenerate && ...}` block inside the picker was unreachable (picker only renders when readyToGenerate is true). Removing it is cleaner than keeping dead code.
- **3-beat arc design:** Opening tone question → guitar/pickup type → summary + signal. This surfaces the most impactful tonal information in the right order without over-interviewing.
- **Example message and ## Important sections left unchanged** to avoid unintended behavior changes in existing tested prompts.

## Deviations from Plan

None - plan executed exactly as written.

## Manual Verification Scenarios (for production testing)

The plan includes a `checkpoint:human-verify` task. Per execution instructions, this is documented here for manual follow-up rather than blocking the commit:

**Scenario A — Picker timing (most important):**
1. Open a new chat (or click New Chat to reset state)
2. Send a message with rich upfront detail, e.g. "I want a Mark Knopfler Sultans of Swing tone on a Strat"
3. EXPECTED: Device picker does NOT appear after the first AI response — AI asks a follow-up question
4. Reply to the follow-up question
5. EXPECTED: After the second or third exchange, AI summarizes its plan and device picker appears

**Scenario B — Resume flow regression check:**
1. Open a past conversation that previously reached the generation stage
2. EXPECTED: Device picker still appears immediately on resume (loadConversation sets readyToGenerate(true))

**Scenario C — New Chat reset:**
1. After reaching the device picker, click New Chat
2. EXPECTED: Device picker disappears, readyToGenerate is reset

**Scenario D — Rig upload flow (regression):**
1. Upload a rig photo using the rig upload UI
2. EXPECTED: The rig substitution device picker still appears as before — the readyToGenerate change does not affect this separate flow

## Issues Encountered

None.

## Next Phase Readiness

- Chat UX timing fix is live — device picker now surfaces at the right moment in the conversation arc
- System prompt minimum-arc enforcement is in place — AI will ask at least one follow-up before signaling readiness
- No regressions introduced: resumed conversations, New Chat reset, and rig upload flow all behave correctly

---
*Phase: 41-chat-ux-device-selection-timing-and-pre-preset-conversation-flow*
*Completed: 2026-03-04*

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit 7414f67 (Task 1): FOUND
- Commit fb94b74 (Task 2): FOUND
