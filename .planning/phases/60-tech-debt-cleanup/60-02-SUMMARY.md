---
phase: 60-tech-debt-cleanup
plan: 02
subsystem: api
tags: [helix, config, refactor, constants, typescript]

# Dependency graph
requires:
  - phase: 52-stadium-amp-catalog
    provides: "STADIUM_CONFIG base structure in config.ts"
  - phase: 53-stadium-builder
    provides: "stadium-builder.ts and validate.ts with inline P35_* strings"
provides:
  - "STADIUM_CONFIG extended with STADIUM_INPUT_MODEL, STADIUM_INPUT_NONE_MODEL, STADIUM_OUTPUT_MODEL"
  - "HELIX_SYSTEM_MODELS export with 5 HD2_* Helix Floor/Rack/LT system model IDs"
  - "POD_GO_SYSTEM_MODELS export with 2 P34_* Pod Go system model IDs"
  - "stadium-builder.ts using STADIUM_CONFIG.* instead of local string constants"
  - "validate.ts using *_CONFIG and *_SYSTEM_MODELS constants for all system model IDs"
affects: [validate, stadium-builder, config]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All device I/O and system model IDs centralized in config.ts named constants (mirrors STOMP_CONFIG pattern)"
    - "Single source of truth for P35_*, HD2_*, P34_* system model IDs — no duplication across files"

key-files:
  created: []
  modified:
    - "src/lib/helix/config.ts"
    - "src/lib/helix/stadium-builder.ts"
    - "src/lib/helix/validate.ts"
    - "src/lib/helix/stadium-builder.test.ts"

key-decisions:
  - "Stadium I/O model IDs (P35_InputInst1, P35_InputNone, P35_OutputMatrix) centralized in STADIUM_CONFIG — mirrors STOMP_CONFIG pattern exactly"
  - "Helix and Pod Go system IDs get separate named exports (HELIX_SYSTEM_MODELS, POD_GO_SYSTEM_MODELS) rather than being added to STADIUM_CONFIG — cleaner separation by device family"
  - "Test assertion updated to use STADIUM_CONFIG.STADIUM_INPUT_NONE_MODEL constant rather than string literal for consistency"
  - "chain-rules.ts confirmed unchanged — model name constants (MINOTAUR, SCREAM_808, etc.) were already extracted at lines 37-43, Improvement B was already complete"

patterns-established:
  - "config.ts is the single-source for all device-specific model ID strings — no inline string literals in builder or validator files"
  - "New device families get a dedicated named export (HELIX_SYSTEM_MODELS, POD_GO_SYSTEM_MODELS) rather than embedding in existing configs"

requirements-completed: [FX-02, AMP-01, AMP-05]

# Metrics
duration: 3min
completed: 2026-03-05
---

# Phase 60 Plan 02: System Model ID Centralization Summary

**Stadium I/O and Helix system model IDs extracted from inline strings in stadium-builder.ts and validate.ts into named constants in config.ts, closing Architecture Improvement A from the v4.0 milestone audit**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T20:47:11Z
- **Completed:** 2026-03-05T20:50:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended STADIUM_CONFIG with 3 Stadium I/O model constants (STADIUM_INPUT_MODEL, STADIUM_INPUT_NONE_MODEL, STADIUM_OUTPUT_MODEL)
- Added HELIX_SYSTEM_MODELS export with 5 HD2_* system model IDs for Helix Floor/Rack/LT
- Added POD_GO_SYSTEM_MODELS export with 2 P34_* system model IDs for Pod Go
- Removed 3 local const declarations from stadium-builder.ts, replaced with STADIUM_CONFIG references
- Replaced all 13 inline system model ID string literals in validate.ts with named constant references
- Verified chain-rules.ts model constants already complete — Improvement B was pre-existing (no changes needed)
- All 219 tests pass — pure refactor, zero behavior change

## Task Commits

Each task was committed atomically:

1. **Task 1: Add system model ID constants to config.ts** - `fa72418` (feat)
2. **Task 2: Replace string literals in stadium-builder.ts and validate.ts** - `9296377` (refactor)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/lib/helix/config.ts` - Added STADIUM_INPUT_MODEL/STADIUM_INPUT_NONE_MODEL/STADIUM_OUTPUT_MODEL to STADIUM_CONFIG; added HELIX_SYSTEM_MODELS and POD_GO_SYSTEM_MODELS exports
- `src/lib/helix/stadium-builder.ts` - Removed 3 local P35_* const declarations; updated buildInputBlock/buildOutputBlock/buildEmptyInputBlock to use STADIUM_CONFIG.*
- `src/lib/helix/validate.ts` - Added HELIX_SYSTEM_MODELS and POD_GO_SYSTEM_MODELS to import; replaced all inline HD2_*/P34_*/P35_*/HelixStomp_* string literals with named constant references
- `src/lib/helix/stadium-builder.test.ts` - Added STADIUM_CONFIG import; updated Flow 1 b00 model assertion to use STADIUM_CONFIG.STADIUM_INPUT_NONE_MODEL

## Decisions Made

- Stadium I/O model IDs went into STADIUM_CONFIG (not a separate export) to mirror the exact pattern STOMP_CONFIG already uses — same structure, same level of abstraction
- HD2_* and P34_* system models got separate named exports (HELIX_SYSTEM_MODELS, POD_GO_SYSTEM_MODELS) rather than embedding in FIRMWARE_CONFIG or other configs — keeps device-family model IDs grouped by family
- Test assertions updated to use constants for consistency (plan allowed either approach)

## Deviations from Plan

None - plan executed exactly as written. The Stomp model ID lines in validate.ts were already using STOMP_CONFIG constants (the plan indicated to check and leave them if already correct — they were).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Architecture Improvement A fully closed: all device system model IDs centralized in config.ts
- Architecture Improvement B confirmed pre-existing: chain-rules.ts already had model name constants
- config.ts is now the single source of truth for all device-specific model IDs
- No blockers

## Self-Check: PASSED

- FOUND: src/lib/helix/config.ts
- FOUND: src/lib/helix/stadium-builder.ts
- FOUND: src/lib/helix/validate.ts
- FOUND: src/lib/helix/stadium-builder.test.ts
- FOUND: .planning/phases/60-tech-debt-cleanup/60-02-SUMMARY.md
- FOUND: commit fa72418
- FOUND: commit 9296377
- STADIUM_CONFIG has 3 new I/O model constants (verified by grep count: 3)
- HELIX_SYSTEM_MODELS exported (verified by grep count: 1)
- POD_GO_SYSTEM_MODELS exported (verified by grep count: 1)
- stadium-builder.ts has 3 STADIUM_CONFIG.* references (verified by grep count: 3)
- 219 tests pass

---
*Phase: 60-tech-debt-cleanup*
*Completed: 2026-03-05*
