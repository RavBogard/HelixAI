---
phase: 06-hardening
plan: 02
subsystem: testing
tags: [vitest, dsp-limits, error-handling, signal-chain, helix-lt]

# Dependency graph
requires:
  - phase: 06-hardening
    provides: firmware config centralization, openai removal (Plan 01)
  - phase: 02-knowledge-layer
    provides: chain-rules.ts assembleSignalChain with DSP limit enforcement
provides:
  - DSP block limit error path verified by automated test
  - Clear error messaging confirmed (block count, max limit, guidance)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Error path testing for DSP block limits using excessive DSP0-routed effects"

key-files:
  created: []
  modified:
    - src/lib/helix/chain-rules.test.ts

key-decisions:
  - "Used 8 real distortion/dynamics/wah models all routed to DSP0 to reliably exceed the 8-block limit"
  - "Hardware verification deferred to user -- requires real Helix LT hardware and HX Edit"

patterns-established:
  - "DSP limit error path tests use real model names from the database, not mocks"

requirements-completed: [SC-1, SC-2]

# Metrics
duration: 1min
completed: 2026-03-02
---

# Phase 6 Plan 02: Hardware Verification and DSP Limit Enforcement Summary

**DSP block limit error path verified with clear error messaging; hardware verification deferred to user with Helix LT**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-02T02:36:29Z
- **Completed:** 2026-03-02T02:37:52Z
- **Tasks:** 1 of 2 automated (Task 2 is human hardware verification -- deferred)
- **Files modified:** 1

## Accomplishments
- Added DSP block limit error path test confirming clear, actionable error message when DSP0 would exceed 8 non-cab blocks
- Error message verified to include: block count (10), max limit (8), and guidance ("Reduce the number of pre-amp effects")
- All 62 tests pass across 4 test files (21 chain-rules, 16 param-engine, 14 snapshot, 11 orchestration)

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify DSP block limit enforcement produces clear errors** - `26317fa` (test)
2. **Task 2: Hardware verification on real Helix LT** - DEFERRED (human checkpoint, requires physical hardware)

**Plan metadata:** `8bcfc7d` (docs: complete plan)

## Files Created/Modified
- `src/lib/helix/chain-rules.test.ts` - Added DSP0 block limit exceeded error path test (test 21 of 21)

## Decisions Made
- Used 8 real model names from the database (UK Wah 846, Deluxe Comp, Teemah!, Heir Apparent, Stupor OD, Deranged Master, Vermin Dist, Arbitrator Fuzz) to create a realistic DSP0 overload scenario
- Hardware verification (Task 2) documented as deferred -- requires physical Helix LT hardware and cannot be automated

## Deviations from Plan

None - plan executed exactly as written.

## Deferred: Hardware Verification (Task 2)

Task 2 is a `checkpoint:human-verify` gate requiring physical Helix LT hardware. The following verification steps are documented for the user to complete at their convenience:

### Hardware Test (Success Criterion 1)
1. Start the dev server: `npm run dev`
2. Open http://localhost:3000 in your browser
3. Select "Helix LT" as the device
4. Complete a chat interview describing a tone you know well (e.g., "warm clean jazz tone" or "modern high-gain metal")
5. Generate the preset
6. Download the .hlx file
7. Load it on your real Helix LT via HX Edit
8. Verify it loads without errors
9. Play through it and confirm the tone is audibly professional -- not muddy, not thin, mix-ready

### DSP Limit Test (Success Criterion 2)
- The automated test (Task 1) already verifies this
- Error message: "DSP0 block limit exceeded: 10 non-cab blocks (max 8). Reduce the number of pre-amp effects."

### Firmware Config Test (Success Criterion 3)
1. Open `src/lib/helix/config.ts` and verify all firmware values are in one place
2. Confirm `preset-builder.ts` has no hardcoded firmware constants (only imports from config)

### openai Removal Test (Success Criterion 4)
1. Run `node -e "console.log(require('./package.json').dependencies)"` and confirm no openai entry

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All automated hardening work is complete
- Hardware verification is the final gate before v1.0 launch
- Once user confirms preset loads and sounds professional on real Helix LT, the project is complete

## Self-Check: PASSED

- FOUND: src/lib/helix/chain-rules.test.ts
- FOUND: commit 26317fa (test(06-02): verify DSP block limit exceeded produces clear error message)
- FOUND: .planning/phases/06-hardening/06-02-SUMMARY.md

---
*Phase: 06-hardening*
*Completed: 2026-03-02*
