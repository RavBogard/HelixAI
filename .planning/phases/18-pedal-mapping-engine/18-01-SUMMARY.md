---
phase: 18-pedal-mapping-engine
plan: "01"
subsystem: rig-emulation
tags: [pedal-mapping, lookup-table, substitution, vitest, phase-18]
dependency_graph:
  requires:
    - src/lib/helix/models.ts (DISTORTION_MODELS, DYNAMICS_MODELS, DELAY_MODELS, REVERB_MODELS, MODULATION_MODELS, getModelIdForDevice, isModelAvailableForDevice)
    - src/lib/helix/rig-intent.ts (RigIntent, SubstitutionEntry, SubstitutionMap)
    - src/lib/helix/index.ts (re-exports of all helix types/functions)
  provides:
    - PEDAL_HELIX_MAP: 53-entry lookup table for pedal-to-Helix model substitution
    - lookupPedal(): three-tier confidence lookup with Pod Go exclusion guard
    - mapRigToSubstitutions(): flat SubstitutionEntry[] from a full RigIntent
  affects:
    - Phase 19 (Vision Extraction API) — will produce RigIntent consumed by mapRigToSubstitutions
    - Phase 21 (Substitution Card UI) — renders SubstitutionEntry[] from mapRigToSubstitutions
tech_stack:
  added:
    - vitest.config.ts with Vite path alias (@/ -> ./src) for test resolution
  patterns:
    - Three-tier confidence: direct (exact match) / close (category keyword) / approximate (global fallback)
    - blockType stored as lowercase string in PedalMapEntry, NOT as BLOCK_TYPES number
    - getModelIdForDevice() called at lookup time, not pre-computed — handles Pod Go Mono/Stereo suffix on demand
    - Word-boundary regex matching in detectCategory() to prevent substring false positives (e.g. "od" in "module")
key_files:
  created:
    - src/lib/rig-mapping.ts
    - src/lib/rig-mapping.test.ts
    - vitest.config.ts
  modified: []
decisions:
  - "blockType in PedalMapEntry is a lowercase string ('distortion', 'dynamics', etc.), never a BLOCK_TYPES number — getModelIdForDevice uses it as a key in POD_GO_EFFECT_SUFFIX"
  - "getModelIdForDevice() called at lookup time inside buildEntry() — not pre-computed — ensures Pod Go Mono/Stereo suffix is device-specific"
  - "Tone Sovereign falls through to 'close' confidence on Pod Go because isModelAvailableForDevice returns false; category keyword 'drive' matches for close fallback"
  - "Added vitest.config.ts (deviation: not in plan) to provide @/ path alias — required because rig-mapping.ts imports @/lib/helix which Vitest cannot resolve without a config"
  - "Word-boundary regex in detectCategory() added (auto-fix Rule 1) — plain includes() caused 'module' to match 'od' keyword, returning 'close' instead of 'approximate'"
metrics:
  duration: "~12 minutes"
  completed_date: "2026-03-02"
  tasks_completed: 2
  files_created: 3
  tests_added: 46
  tests_total: 108
---

# Phase 18 Plan 01: Pedal Mapping Engine Summary

**One-liner:** Deterministic 53-entry PEDAL_HELIX_MAP with three-tier confidence lookup (direct/close/approximate), Pod Go Mono/Stereo suffix handling via getModelIdForDevice(), and word-boundary category detection.

## What Was Built

### src/lib/rig-mapping.ts

- **PEDAL_HELIX_MAP**: 53 entries across 7 categories (14 overdrives, 8 distortions, 5 fuzz, 4 boost, 5 compressors, 6 delays, 4 reverbs, 7 modulation — note: reverb counts as 4 entries here, modulation 7)
- **lookupPedal(pedalName, device, knobPositions?)**: Three-tier confidence lookup:
  - Tier 1 (direct): exact key match + `isModelAvailableForDevice()` guard
  - Tier 2 (close): category detected via word-boundary keyword matching
  - Tier 3 (approximate): global fallback (Teemah! — transparent overdrive)
- **mapRigToSubstitutions(rigIntent, device)**: Maps full RigIntent to flat `SubstitutionEntry[]`
- **translateKnobs()**: Converts zone labels (low/medium-low/medium-high/high) to 0-1 floats

### src/lib/rig-mapping.test.ts

46 tests covering SC-01 through SC-06 and Pitfall 5:
- SC-01: PEDAL_HELIX_MAP has >= 53 entries
- SC-02: Confidence tier assignment (direct/close/approximate)
- SC-03: Unknown boutique pedals never return "direct"
- SC-04: helixModelDisplayName is human-readable (e.g. "Scream 808" not "HD2_DistScream808")
- SC-05: mapRigToSubstitutions returns flat array; Pod Go produces Mono/Stereo suffixes
- SC-06: Explicit direct vs non-direct contrast tests
- Pitfall 5: Tone Sovereign excluded from Pod Go correctly

### vitest.config.ts

Vitest path alias config mapping `@/` to `./src` — required for Vitest to resolve `@/lib/helix` imports in `rig-mapping.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest.config.ts for path alias resolution**
- **Found during:** Task 1 verification
- **Issue:** Vitest could not resolve `@/lib/helix` imports in `rig-mapping.ts` — no vitest config existed with path aliases
- **Fix:** Created `vitest.config.ts` with `resolve.alias: { "@": path.resolve(__dirname, "./src") }`
- **Files modified:** vitest.config.ts (new)
- **Commit:** 30cf458

**2. [Rule 1 - Bug] Word-boundary regex in detectCategory() to prevent "od" matching "module"**
- **Found during:** Task 2 test run
- **Issue:** `"Zeta Quartz Xylophone Module".includes("od")` matched because "module" contains "od" as a substring, causing incorrect "close" confidence instead of "approximate"
- **Fix:** Replaced `normalizedKey.includes(kw)` with a word-boundary regex: `(?:^|\s|-)keyword(?:\s|-|$)` so short keywords like "od" only match as standalone words
- **Files modified:** src/lib/rig-mapping.ts (detectCategory function)
- **Commit:** 30cf458

## Test Results

```
Test Files  5 passed (5)
Tests       108 passed (108)
  - 62 existing tests: all still passing
  - 46 new tests: all passing
```

## Self-Check: PASSED

- `src/lib/rig-mapping.ts`: FOUND
- `src/lib/rig-mapping.test.ts`: FOUND
- `vitest.config.ts`: FOUND
- Commit 30cf458: FOUND
- TypeScript: zero errors (`npx tsc --noEmit` exits 0)
- All 108 tests pass
