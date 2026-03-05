---
phase: 42-token-cost-audit-quality-baseline
plan: "01"
subsystem: token-logging
tags: [audit, token-logging, cost-estimation, usage-analytics]
dependency_graph:
  requires: []
  provides: [AUDIT-01, usage-logger-utility, usage-jsonl-format]
  affects: [src/lib/planner.ts, src/app/api/chat/route.ts]
tech_stack:
  added: [usage-logger, json-lines format]
  patterns: [env-flag guard, appendFileSync, TDD red-green]
key_files:
  created:
    - src/lib/usage-logger.ts
    - src/lib/usage-logger.test.ts
    - scripts/summarize-usage.ts
  modified:
    - src/lib/planner.ts
    - src/app/api/chat/route.ts
    - .env.local.example
    - .gitignore
decisions:
  - "logUsage() is a no-op when LOG_USAGE !== 'true' — zero I/O impact in production"
  - "Cache write priced at 3.75/MTok (1.25x input) for 5-min ephemeral cache"
  - "Gemini cache_read_per_mtok set at 0.03 (0.1x input price of 0.30)"
  - "finalUsage captured on every stream chunk — last chunk wins (cumulative totals)"
metrics:
  duration: "7m 22s"
  completed: "2026-03-05"
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  tests_written: 11
  tests_passed: 11
---

# Phase 42 Plan 01: Token Usage Logging Infrastructure Summary

**One-liner:** JSON-lines token logging behind LOG_USAGE=true flag with Claude/Gemini cost estimation and a dev-side summarize script.

## What Was Built

### Task 1: usage-logger utility (TDD)

`src/lib/usage-logger.ts` — Core logging utility:

- `PlannerUsageRecord` interface covering both Claude (generate) and Gemini (chat) endpoints
- `CLAUDE_SONNET_PRICE` constants: input $3.00/MTok, output $15.00/MTok, cache_write $3.75/MTok, cache_read $0.30/MTok
- `GEMINI_FLASH_PRICE` constants: input $0.30/MTok, output $2.50/MTok, cache_read $0.03/MTok
- `estimateClaudeCost(usage)` — pure function, handles null cache fields
- `estimateGeminiCost(usage, model)` — pure function, handles undefined usage fields
- `logUsage(record, logPath?)` — guard is the FIRST line (`if (process.env.LOG_USAGE !== "true") return`), uses `appendFileSync` for JSON-lines

`src/lib/usage-logger.test.ts` — 11 tests covering:
- No-op behavior when LOG_USAGE is unset or "false"
- Single-record JSON-lines append when LOG_USAGE=true
- Double-append growing file (no overwrite)
- Cost calculation accuracy for known Claude inputs
- Cost calculation accuracy for known Gemini inputs
- Field deserialization correctness

### Task 2: Integrations and supporting files

**`src/lib/planner.ts`** — After `client.messages.create()` returns, extracts `response.usage` and calls `logUsage()` with all Claude usage fields including cache_creation and cache_read tokens.

**`src/app/api/chat/route.ts`** — Declares `finalUsage` before the stream loop, captures `chunk.usageMetadata` on every iteration (last chunk wins), calls `logUsage()` after `controller.close()` but before the persistence block.

**`.env.local.example`** — Documents `# LOG_USAGE=true` with comment explaining it's dev-only.

**`.gitignore`** — Adds `usage.jsonl` under the `# misc` section.

**`scripts/summarize-usage.ts`** — Reads `usage.jsonl` from cwd, groups by endpoint, reports:
- Call count per endpoint
- Average input/output/cached/total tokens
- Average cost per call
- Cache hit rate percentage
- Total cost across all logged calls

## Verification Results

```
npx vitest run src/lib/usage-logger.test.ts
Test Files  1 passed (1)
Tests       11 passed (11)
```

All plan verification checks passed:
- `grep -n "logUsage" src/lib/planner.ts` — line 152 (after messages.create)
- `grep -n "logUsage" src/app/api/chat/route.ts` — line 105 (after stream closes)
- `grep "usage.jsonl" .gitignore` — confirmed
- `grep "LOG_USAGE" .env.local.example` — confirmed
- `ls scripts/summarize-usage.ts` — confirmed

## Commits

| Hash | Message |
|------|---------|
| 6fd5265 | test(42-01): add failing tests for usage-logger utility |
| 8a65130 | feat(42-01): implement usage-logger utility with cost estimation |
| 40aff4b | feat(42-01): integrate token logging into planner.ts and chat route |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All created files confirmed on disk. All 3 task commits confirmed in git log.
