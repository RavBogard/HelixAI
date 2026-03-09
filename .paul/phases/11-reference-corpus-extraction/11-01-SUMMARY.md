---
phase: 11-reference-corpus-extraction
plan: 01
subsystem: testing
tags: [reference-corpus, schema-extraction, preset-parsing, gold-standard]

requires:
  - phase: 09-structural-diff-engine
    provides: Deviation types, path classification patterns
  - phase: 08-mock-chat-harness
    provides: HarnessResult, pipeline runner
provides:
  - Reference corpus loader (parsePresetFile, loadCorpus)
  - Per-family gold standard schema extractor (extractFamilySchema, FamilySchema)
affects: [12-full-audit-run, 13-fix-deviations, 14-regression-suite-integration]

tech-stack:
  added: []
  patterns: [key-frequency consensus, path generalization for block patterns]

key-files:
  created:
    - src/lib/helix/reference-corpus.ts
    - src/lib/helix/reference-corpus.test.ts
    - src/lib/helix/schema-extractor.ts
    - src/lib/helix/schema-extractor.test.ts

key-decisions:
  - "Device ID reverse lookup from DEVICE_IDS + supplementary IDs (2162944 Native, 2162696 Pod Go Wireless)"
  - "Key frequency consensus: required (100%), common (>50%), rare (<=50%)"
  - "Path generalization replaces block/dsp indices with wildcards for cross-preset comparison"

patterns-established:
  - "Reference corpus files are read-only test tooling using node:fs (not browser code)"
  - "Schema path classification reuses same regex patterns as structural-diff.ts"

duration: ~10min
completed: 2026-03-09
---

# Phase 11 Plan 01: Reference Corpus & Schema Extraction Summary

**Reference corpus loader and per-family gold standard schema extractor — reads real .hlx/.pgp/.hsp presets, extracts structural consensus patterns across multiple presets per device family.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-03-09 |
| Tasks | 2 completed |
| Files created | 4 |
| Tests added | 48 (25 corpus + 23 schema) |
| Total tests | 1406 passing |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Reference Corpus Loader | Pass | Loads .hlx/.pgp/.hsp, returns typed ReferencePreset, graceful error handling |
| AC-2: Device Family Detection | Pass | Extracts device ID per format, maps to family via reverse DEVICE_IDS lookup |
| AC-3: Schema Extraction | Pass | FamilySchema with requiredTopLevelKeys, blockStructure, snapshot/controller/footswitch sections, metadataFields |
| AC-4: Multi-Preset Consensus | Pass | required/common/rare classification, amp-specific params correctly excluded from required |

## Accomplishments

- Reference corpus loader handles all 3 file formats (.hlx = JSON, .pgp = JSON, .hsp = 8-byte magic header + JSON) with family mismatch detection
- Schema extractor produces per-family FamilySchema via key frequency consensus across multiple presets
- Path classification aligned with structural-diff.ts patterns for consistent categorization
- Real presets loaded and analyzed across all 4 device families (helix, stomp, podgo, stadium)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/helix/reference-corpus.ts` | Created | Corpus loader: parsePresetFile, detectDeviceId, detectFamily, loadCorpus |
| `src/lib/helix/reference-corpus.test.ts` | Created | 25 tests: format detection, parsing, device ID extraction, family mapping, corpus loading |
| `src/lib/helix/schema-extractor.ts` | Created | Schema extraction: collectKeys, computeKeyFrequencies, extractBlockPatterns, extractFamilySchema |
| `src/lib/helix/schema-extractor.test.ts` | Created | 23 tests: key collection, frequency computation, block patterns, synthetic + real preset schemas |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Supplementary device ID map (2162944, 2162696) | DEVICE_IDS has unverified/placeholder entries; real presets use confirmed IDs | Corpus can load all known reference presets |
| Key frequency thresholds: required=100%, common=>50%, rare=<=50% | Standard consensus approach — required means "must be present in every correct preset" | Phase 12 audit can flag missing required keys as critical deviations |
| Path generalization (dsp0→dsp*, block3→block*) for cross-preset comparison | Different presets have different block counts — generalizing allows structural consensus | Block patterns represent family-wide expectations, not preset-specific |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Corpus loader can ingest any reference preset collection
- Schema extractor produces gold standard models for diff comparison
- Both modules export clean TypeScript interfaces for Phase 12 integration

**Concerns:**
- HX Stomp has only 2 reference presets (CATS NO OTO4.hlx + Bass Rig.hlx) — may want more for robust schema
- Stadium device_version varies across presets (known issue from STATE.md)

**Blockers:**
- None

---
*Phase: 11-reference-corpus-extraction, Plan: 01*
*Completed: 2026-03-09*
