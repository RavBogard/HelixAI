---
phase: 68-token-control-and-prompt-caching
plan: "01"
subsystem: api
tags: [anthropic, prompt-caching, cost-estimation, usage-logging, diagnostics]

# Dependency graph
requires:
  - phase: 65-device-specific-prompts
    provides: getFamilyPlannerPrompt() per-device prompt routing used by measure-prompt-sizes.ts
  - phase: 61-family-router-and-capabilities
    provides: getCapabilities() and resolveFamily() used for per-device stats grouping

provides:
  - Corrected 1h cache write pricing constant (6.0/MTok) in usage-logger.ts
  - parseCacheReportByDevice() function for per-device cache economics analysis
  - formatReportByDevice() function for human-readable per-device breakdown
  - measure-prompt-sizes.ts diagnostic script for token count auditing

affects:
  - cost estimates from estimateClaudeCost() (now 37.5% higher on cache-write component)
  - cache-hit-report CLI output (now includes per-device breakdown)
  - future cache economics analysis (Stadium, Pod Go volume assessment)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-device grouping via record.device ?? 'unknown' fallback"
    - "parseCacheReportByDevice composes existing parseCacheReport per group"
    - "Diagnostic scripts use countTokens API (free) for offline token measurement"

key-files:
  created:
    - scripts/measure-prompt-sizes.ts
  modified:
    - src/lib/usage-logger.ts
    - src/lib/usage-logger.test.ts
    - scripts/cache-hit-report.ts
    - scripts/cache-hit-report.test.ts

key-decisions:
  - "cache_write_per_mtok corrected from 3.75 to 6.0 — 1h TTL uses 2x input price, not 1.25x (5-min price)"
  - "parseCacheReportByDevice() composes existing parseCacheReport() per device group — no new computation logic"
  - "measure-prompt-sizes.ts is a manual diagnostic only — excluded from automated test suite per plan spec"

patterns-established:
  - "Regression guard test: assert CLAUDE_SONNET_PRICE.cache_write_per_mtok === 6.0 directly to prevent silent price drift"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-06
---

# Phase 68 Plan 01: Token Control and Prompt Caching Summary

**Fixed 37.5%-underestimated cache write pricing ($3.75 -> $6.00/MTok for 1h TTL), added per-device cache breakdown to cache-hit-report.ts, and created measure-prompt-sizes.ts diagnostic for token count auditing across all five device families.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-06T12:04:19Z
- **Completed:** 2026-03-06T12:08:19Z
- **Tasks:** 2
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments

- Fixed pricing bug: `CLAUDE_SONNET_PRICE.cache_write_per_mtok` corrected from `3.75` to `6.0` — cost estimates had been 37.5% too low on cache-write component since Phase 42
- Added `parseCacheReportByDevice()` and `formatReportByDevice()` to cache-hit-report.ts with 5 new tests covering 3-device grouping, unknown fallback, and per-device correctness
- Created `scripts/measure-prompt-sizes.ts` diagnostic script — measures token counts for all 5 device families, flags families below 2,048-token cache threshold, diagnoses Stomp variant prompt identity

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix cache write pricing and extend per-device cache reporting** - `53f01c7` (feat)
2. **Task 2: Create prompt token measurement script** - `da90329` (feat)

**Plan metadata:** (docs commit — see below)

_Note: Task 1 used TDD (red tests added, then green via implementation)_

## Files Created/Modified

- `src/lib/usage-logger.ts` - Fixed `cache_write_per_mtok: 3.75 -> 6.0`, updated JSDoc to reference 1h ephemeral cache
- `src/lib/usage-logger.test.ts` - Updated Test 4 expected value (0.012435 -> 0.013560), added regression guard test for pricing constant, imported `CLAUDE_SONNET_PRICE`
- `scripts/cache-hit-report.ts` - Added `parseCacheReportByDevice()`, `formatReportByDevice()`, updated CLI to print per-device breakdown when >1 device present
- `scripts/cache-hit-report.test.ts` - Added 5 new tests: 3-device grouping, unknown fallback, single-device match, per-device stats correctness, formatReportByDevice output
- `scripts/measure-prompt-sizes.ts` - New diagnostic script: token counting for all 5 device targets via countTokens API (free), threshold flagging, Stomp variant unification check

## Decisions Made

- `cache_write_per_mtok` corrected from 3.75 to 6.0: The 5-minute ephemeral cache price is $3.75/MTok (1.25x input), but planner.ts uses `ttl: "1h"` which costs $6.00/MTok (2x input). The constant has been wrong since the logger was introduced.
- `parseCacheReportByDevice()` composes existing `parseCacheReport()` per device group rather than reimplementing aggregation logic — keeps computation DRY.
- `measure-prompt-sizes.ts` is excluded from automated test suites per plan spec — it makes live API calls and is intended as a manual diagnostic tool.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Initial TDD test used `require("@/lib/usage-logger")` for regression guard but vitest runs in ESM context. Fixed by importing `CLAUDE_SONNET_PRICE` directly in the import block (Rule 1 auto-fix, resolved immediately).

## User Setup Required

None - no external service configuration required. `measure-prompt-sizes.ts` needs `CLAUDE_API_KEY` to run but it is a manual diagnostic tool, not required infrastructure.

## Next Phase Readiness

- Phase 68 Plan 01 complete — pricing bug fixed, per-device analysis tooling in place
- `measure-prompt-sizes.ts` is ready to run with a valid API key for token count auditing
- Per-device cache stats available for assessing whether Stadium/Pod Go need structural prompt changes

## Self-Check: PASSED

- FOUND: src/lib/usage-logger.ts
- FOUND: scripts/cache-hit-report.ts
- FOUND: scripts/measure-prompt-sizes.ts
- FOUND: 68-01-SUMMARY.md
- FOUND: commit 53f01c7 (Task 1)
- FOUND: commit da90329 (Task 2)
- FOUND: cache_write_per_mtok: 6.0

---
*Phase: 68-token-control-and-prompt-caching*
*Completed: 2026-03-06*
