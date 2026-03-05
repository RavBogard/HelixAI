---
phase: 52-stadium-amp-catalog
verified: 2026-03-05T18:45:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 52: Stadium Amp Catalog Verification Report

**Phase Goal:** Expand the Stadium amp catalog with 6 missing amp entries from real .hsp files, correct the device version constant, and add 9 Stadium-specific effect model IDs to the validation whitelist.
**Verified:** 2026-03-05T18:45:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | STADIUM_AMPS contains 18 total entries (12 existing + 6 new) — all with verified defaultParams from real .hsp files | VERIFIED | 18 unique "Agoura ..." keys confirmed at lines 1036-1254 of models.ts; 6 new entries at lines 1183-1254 with section comment referencing STAD-01 and 2026-03-05 date |
| 2 | STADIUM_DEVICE_VERSION equals 301990015 — sourced from Agoura_Bassman.hsp | VERIFIED | config.ts line 52: `STADIUM_DEVICE_VERSION: 301990015`; JSDoc line 51 reads "verified from Agoura_Bassman.hsp and Agoura_Hiwatt.hsp (2026-03-05)" |
| 3 | validate.ts accepts all 9 HX2_* and VIC_* model IDs found in real Stadium presets | VERIFIED | All 9 ids.add() calls present at validate.ts lines 31-40, grouped with dated source comments; consumed by VALID_IDS set used in validatePresetSpec() |
| 4 | TypeScript compilation passes with zero errors | VERIFIED | `npx tsc --noEmit` exits 0 with no output |
| 5 | All existing tests pass with no regressions | VERIFIED | `npx vitest run` — 170/170 tests passed across 8 test files |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/helix/models.ts` | 6 new STADIUM_AMPS entries: Agoura US Tweedman, Agoura US Luxe Black, Agoura US Princess 76, Agoura US Double Black, Agoura Revv Ch3 Purple, Agoura Solid 100 | VERIFIED | All 6 entries present at lines 1183-1254; contain key `"Agoura_AmpUSTweedman"` and 5 siblings; 18 total STADIUM_AMPS keys confirmed |
| `src/lib/helix/config.ts` | Corrected STADIUM_DEVICE_VERSION constant | VERIFIED | Line 52: `STADIUM_DEVICE_VERSION: 301990015`; previous wrong value 285213946 removed |
| `src/lib/helix/validate.ts` | 9 Stadium-specific effect model IDs in getValidModelIds() | VERIFIED | Lines 30-40: all 5 HX2_* and 4 VIC_* ids.add() calls present; `HX2_CompressorDeluxeCompMono` confirmed at line 31 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/helix/models.ts` (STADIUM_AMPS) | chain-rules.ts, param-engine.ts, snapshot-engine.ts | `STADIUM_AMPS[intent.ampName]` direct key lookup | WIRED | chain-rules.ts line 268, param-engine.ts line 262, snapshot-engine.ts line 187 all import and use STADIUM_AMPS; getAllModels() spreads STADIUM_AMPS at line 1329 |
| `src/lib/helix/models.ts` (STADIUM_AMPS) | validate.ts VALID_IDS | getAllModels() spread → ids.add() loop | WIRED | validate.ts imports getAllModels (line 1); getAllModels() spreads STADIUM_AMPS (models.ts line 1329); all Agoura_* IDs enter VALID_IDS via the for-loop at validate.ts lines 10-12 |
| `src/lib/helix/config.ts` (STADIUM_DEVICE_VERSION) | stadium-builder.ts | `import { STADIUM_CONFIG } from './config'` | WIRED | stadium-builder.ts line 164: `device_version: STADIUM_CONFIG.STADIUM_DEVICE_VERSION` — confirmed consuming the corrected 301990015 value |
| `src/lib/helix/validate.ts` (HX2_/VIC_ ids) | validatePresetSpec() VALID_IDS check | `getValidModelIds()` → `VALID_IDS` constant → `validIds.has(block.modelId)` | WIRED | validate.ts line 44: `const VALID_IDS = getValidModelIds()` (module-level constant); line 92: `if (!validIds.has(block.modelId))` uses it for all device targets |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STAD-01 | 52-01-PLAN.md | Agoura amp catalog expanded with 6 missing amp IDs extracted from real .hsp files, with verified defaultParams | SATISFIED | 6 new entries in STADIUM_AMPS (18 total); all defaultParams match 52-RESEARCH.md Ground Truth Data section exactly (Drive/Bass/Mid/Treble/Master/ChVol values confirmed field-by-field); all 6 have `stadiumOnly: true`; no estimated values — section comment documents source (.hsp files, 2026-03-05) |
| STAD-02 | 52-01-PLAN.md | Stadium device version updated to 301990015 and HX2_*/VIC_* model IDs added to validate.ts | SATISFIED | STADIUM_DEVICE_VERSION = 301990015 confirmed in config.ts line 52; all 9 IDs (5 HX2_* + 4 VIC_*) confirmed in validate.ts lines 31-40 with dated source comments |

Both requirements for this phase are declared, implemented, and verified. No orphaned requirements found — REQUIREMENTS.md lines 81-82 show both STAD-01 and STAD-02 mapped to Phase 52 with status Complete.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | — |

No TODO, FIXME, placeholder, stub, or empty implementation patterns found in any of the three modified files.

---

### defaultParams Value Verification (STAD-01 Data Provenance)

Cross-referenced each new entry's defaultParams against 52-RESEARCH.md "Ground Truth Data" section:

| Entry | Drive | Bass | Mid | Treble | Master | ChVol | Match |
|-------|-------|------|-----|--------|--------|-------|-------|
| Agoura US Tweedman | 0.60 | 0.64 | 0.65 | 0.55 | 1.0 | 0.80 | EXACT |
| Agoura US Luxe Black | 0.22 | 0.54 | 0.50 | 0.55 | 0.42 | 0.80 | EXACT |
| Agoura US Princess 76 | 0.21 | 0.27 | 0.50 | 0.62 | 0.74 | 0.80 | EXACT |
| Agoura US Double Black | 0.20 | 0.44 | 0.52 | 0.56 | 0.40 | 0.80 | EXACT |
| Agoura Revv Ch3 Purple | 0.65 | 0.35 | 0.55 | 0.65 | 0.50 | 0.80 | EXACT |
| Agoura Solid 100 | 0.22 | 0.50 | 0.50 | 0.80 | 0.33 | 0.80 | EXACT |

Note: Drive values for clean amps (US Luxe Black, Solid 100) are 0.22 — deliberately conservative per established clean amp convention documented in the research and key-decisions. The research explicitly documents this deviation from raw .hsp Drive values (0.79, 0.70) and it is the correct implementation per the pattern.

---

### Human Verification Required

None. All aspects of this phase are programmatically verifiable — it is a pure data-entry phase with no UI, real-time behavior, or external service integration.

---

### Commits Verified

| Hash | Message | Files | Status |
|------|---------|-------|--------|
| `06a2f60` | feat(52-01): add 6 STADIUM_AMPS entries + correct STADIUM_DEVICE_VERSION | models.ts, config.ts | CONFIRMED — exists in git log; +75 lines correct |
| `2c0e97f` | feat(52-01): add HX2_/VIC_ effect model IDs to validate.ts whitelist | validate.ts | CONFIRMED — exists in git log; +11 lines correct |

---

### Gaps Summary

No gaps found. All 5 truths verified, all 3 artifacts substantive and wired, both requirements satisfied, zero anti-patterns, zero TypeScript errors, 170/170 tests pass.

---

_Verified: 2026-03-05T18:45:00Z_
_Verifier: Claude (gsd-verifier)_
