---
phase: 67-stadium-integration-quality
plan: 02
subsystem: stadium-prompt-and-schema-quality
tags: [stadium, prompt, schema, tdd, bug-fix, integration-test]
dependency-graph:
  requires: [STADQ-01, STADQ-02]
  provides: [STADQ-03, STADQ-04]
  affects: [stadium-prompt, models-cabaff inity, schema-prompt-alignment]
tech-stack:
  added: []
  patterns: [tdd-red-green, data-integrity-guard, cross-family-integration-test]
key-files:
  created:
    - src/lib/helix/schema-prompt-alignment.test.ts
  modified:
    - src/lib/families/stadium/prompt.ts
    - src/lib/families/stadium/prompt.test.ts
    - src/lib/helix/models.ts
decisions:
  - "[67-02]: buildAmpCabPairingTable() generates the amp-cab pairing section from STADIUM_AMPS cabAffinity at prompt build time — no hardcoded text, content stays in sync with catalog automatically"
  - "[67-02]: STADIUM_AMPS cabAffinity bugs fixed: '4x12 Greenback 25' -> '4x12 Greenback25' (4 entries) and '4x12 Brit T75' -> '4x12 Brit V30' (2 entries) — T75 variant not in CAB_MODELS"
  - "[67-02]: DeviceFamily imported from device-family.ts in integration test — plan referenced ./types but type lives in ./device-family"
metrics:
  duration: ~3 minutes
  completed: 2026-03-06
  tasks-completed: 2
  files-modified: 3
  files-created: 1
  tests-added: 17
  tests-total-passing: 418
---

# Phase 67 Plan 02: Stadium Prompt Pairing Table and Schema Integration Test Summary

Generated amp-cab pairing table from STADIUM_AMPS cabAffinity data replaces TODO(Phase62) placeholder; cross-family integration test covers all 4 families with 14 tests; 5 cabAffinity data bugs fixed in models.ts.

## Tasks Completed

| Task | Name | Commits | Status |
|------|------|---------|--------|
| 1 | Replace TODO placeholder with generated amp-cab pairing table | 2767c25 (RED), fa3eeae (GREEN) | Complete |
| 2 | Create cross-family schema/prompt integration test | 0f49039 | Complete |

## What Was Built

### Task 1: Generated Amp-Cab Pairing Table (STADQ-03)

**Problem:** `buildPlannerPrompt` in `stadium/prompt.ts` contained a `// TODO(Phase62)` block instructing Claude to "choose a cab with matching era and speaker voicing" with no specific pairing guidance. Claude received no actionable cab selection information for Agoura amps.

**Fix in `src/lib/families/stadium/prompt.ts`:**
- Added import: `import { STADIUM_AMPS } from "@/lib/helix/models"`
- Added `buildAmpCabPairingTable(): string` helper that iterates `Object.entries(STADIUM_AMPS)`, filters to entries with cabAffinity, and maps each to `- **${name}**: ${cabs.join(", ")}`
- Replaced the TODO block with a generated `## Amp-to-Cab Pairing` section with descriptive framing text

**Bug fixes (Rule 1 - data integrity) in `src/lib/helix/models.ts`:**
- `"Agoura WhoWatt 103"`: `"4x12 Greenback 25"` -> `"4x12 Greenback25"` (CAB_MODELS key has no space)
- `"Agoura Brit Plexi"`: `"4x12 Greenback 25"` -> `"4x12 Greenback25"`
- `"Agoura Brit 2203 MV"`: `"4x12 Greenback 25"` -> `"4x12 Greenback25"`
- `"Agoura Revv Ch3 Purple"`: `"4x12 Brit T75"` -> `"4x12 Brit V30"` (T75 not a CAB_MODELS key)
- `"Agoura Brit 800"`: both `"4x12 Greenback 25"` -> `"4x12 Greenback25"` and `"4x12 Brit T75"` -> `"4x12 Brit V30"`

**Tests updated in `src/lib/families/stadium/prompt.test.ts`:**
- Replaced `"contains TODO(Phase62) placeholder"` with `"does NOT contain TODO(Phase62) placeholder"`
- Added `"contains real amp-cab pairing content"` — asserts `Agoura Brit Plexi` and `4x12 Greenback25` present
- Added `"contains Amp-to-Cab Pairing section heading"` test
- Added data integrity test: loops all `STADIUM_AMPS` cabAffinity entries, asserts each is a key in `CAB_MODELS`

### Task 2: Cross-Family Schema/Prompt Integration Test (STADQ-04)

**Purpose:** Catch future catalog/schema divergence at CI level before it reaches production.

**Created `src/lib/helix/schema-prompt-alignment.test.ts`:**
- Maps all 4 families to their catalog tuples via `FAMILY_CATALOGS`
- For each family: tests every amp, cab, and effect name via `getToneIntentSchema(family).safeParse()`
- Separate describe block: WAH/VOLUME model membership in `STADIUM_EFFECT_NAMES`
- 14 total tests, all pass immediately (Plan 01 fixes were correct)

## Success Criteria Check

1. Stadium planner prompt contains generated amp-cab pairing table (not TODO text) — CONFIRMED
2. Every cabAffinity entry is a valid CAB_MODELS key (no orphan cab references) — CONFIRMED (5 bugs fixed)
3. Cross-family integration test passes: all amp, cab, and effect names accepted by family's Zod schema — CONFIRMED (14/14 pass)
4. WAH/VOLUME model names confirmed in STADIUM_EFFECT_NAMES by direct enum test — CONFIRMED
5. Full test suite passes with no regressions — CONFIRMED (418/418 pass)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed 5 invalid cabAffinity entries in STADIUM_AMPS**
- **Found during:** Task 1 RED test execution (data integrity test caught the bugs)
- **Issue:** 4 STADIUM_AMPS entries used `"4x12 Greenback 25"` (with space) but CAB_MODELS key is `"4x12 Greenback25"` (no space). 2 entries used `"4x12 Brit T75"` which has no key in CAB_MODELS.
- **Fix:** Corrected all 5 cabAffinity strings to valid CAB_MODELS keys. `"4x12 Brit T75"` mapped to `"4x12 Brit V30"` (nearest Marshall 4x12 available).
- **Files modified:** `src/lib/helix/models.ts`
- **Commits:** fa3eeae (included in GREEN commit)

**2. [Rule 3 - Blocking] DeviceFamily import path corrected**
- **Found during:** Task 2 implementation
- **Issue:** Plan specified `import type { DeviceFamily } from "./types"` but `DeviceFamily` is not exported from `types.ts` — it lives in `device-family.ts`.
- **Fix:** Used `import type { DeviceFamily } from "./device-family"` in the test file.
- **Files modified:** `src/lib/helix/schema-prompt-alignment.test.ts`

## Self-Check: PASSED

Files verified:
- `src/lib/families/stadium/prompt.ts` — contains `buildAmpCabPairingTable`, no TODO text
- `src/lib/families/stadium/prompt.test.ts` — contains `not.toContain("TODO(Phase62)")` and data integrity test
- `src/lib/helix/schema-prompt-alignment.test.ts` — contains cross-family tests for all 4 families
- `src/lib/helix/models.ts` — contains corrected cabAffinity entries (no "Greenback 25" with space, no "Brit T75")

Commits verified:
- 2767c25 — Task 1 RED tests
- fa3eeae — Task 1 GREEN implementation + bug fixes
- 0f49039 — Task 2 integration test

All 418 tests pass with no regressions (was 401 after Plan 01, +17 net new tests).
