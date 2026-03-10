---
phase: 19-token-cost-optimization
plan: 01
subsystem: api
tags: [gemini, token-optimization, cost-analysis, chat-windowing]

requires:
  - phase: 18-builder-logic-enhancement
    provides: stable builder and snapshot logic
provides:
  - Chat history windowing (planner: 10 msgs, chat: 20 msgs)
  - Reduced maxOutputTokens (4096 → 2048)
  - Cost analysis tooling (scripts/analyze-usage.ts)
affects: []

tech-stack:
  added: []
  patterns: [message-windowing]

key-files:
  created: [scripts/analyze-usage.ts]
  modified: [src/lib/planner.ts, src/app/api/chat/route.ts]

key-decisions:
  - "MAX_PLANNER_MESSAGES=10, always preserving first message for tone context"
  - "MAX_CHAT_HISTORY=20, system prompt unaffected"
  - "maxOutputTokens 4096→2048: ToneIntent JSON ~300-500 tokens, 4x safety margin"

patterns-established:
  - "Message windowing: first-message-preserved pattern for planner context"

duration: ~10min
started: 2026-03-09T18:55:00Z
completed: 2026-03-09T19:05:00Z
---

# Phase 19 Plan 01: Token & Cost Optimization Summary

**Bounded conversation history and halved output token budget to reduce Gemini costs without quality regression.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Started | 2026-03-09 |
| Completed | 2026-03-09 |
| Tasks | 3 completed |
| Files modified | 3 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Planner chat history truncation | Pass | Last 10 messages + first message preserved |
| AC-2: maxOutputTokens reduction | Pass | 4096 → 2048 |
| AC-3: Chat route message windowing | Pass | Last 20 messages, system prompt unaffected |
| AC-4: Cost analysis script | Pass | scripts/analyze-usage.ts with full breakdown |
| AC-5: No regression | Pass | 1455/1455 tests pass, build succeeds |

## Accomplishments

- Planner conversation windowed to 10 messages (preserves initial user request for tone context)
- Chat route windowed to 20 messages (system prompt separate, unaffected)
- maxOutputTokens reduced from 4096 to 2048 (ToneIntent JSON never exceeds ~600 tokens)
- Cost analysis script reads usage.jsonl and reports per-endpoint, per-device, cache hit breakdowns

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/planner.ts` | Modified | Added MAX_PLANNER_MESSAGES=10 windowing + maxOutputTokens 4096→2048 |
| `src/app/api/chat/route.ts` | Modified | Added MAX_CHAT_HISTORY=20 windowing |
| `scripts/analyze-usage.ts` | Created | Cost analysis script for usage.jsonl |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Preserve first message in planner window | Initial user request captures tone intent — dropping it loses context | Windowed conversations still produce accurate ToneIntents |
| 2048 maxOutputTokens | ToneIntent JSON is 300-500 tokens; 2048 gives 4x headroom | Reduces Gemini thinking budget waste |
| Task 3 tests already existed | estimateGeminiCost already had cache hit, no cache, and zero token tests | No new test code needed |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | None |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- v6.0 milestone complete — all 4 phases (16-19) delivered
- Token costs bounded for long conversations
- Cost monitoring tooling available

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 19-token-cost-optimization, Plan: 01*
*Completed: 2026-03-09*
