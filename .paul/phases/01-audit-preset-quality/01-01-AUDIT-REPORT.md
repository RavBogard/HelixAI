# Preset Quality Audit Report

**Date:** 2026-03-08
**Scope:** All 4 device families (Helix, Stomp, Pod Go, Stadium)
**Method:** Test suite analysis, code review of all core modules, AI prompt audit

---

## Executive Summary

- **Test baseline:** 2087 passed, 1 failed, 12 errors (jsdom missing for component tests)
- **Total issues found:** 38
- **Critical:** 16 | **High:** 6 | **Medium:** 12 | **Low:** 4
- **Worst-affected area:** AI prompts (12 invalid model names causing generation failures)
- **Second worst:** Stadium builder (structural format mismatches with real .hsp files)

---

## Issues by Severity

### CRITICAL (16 issues) — Presets won't load or generation fails

#### CRIT-01 to CRIT-12: Invalid Amp Names in AI Prompts (12 issues)

**Module:** `src/lib/families/{helix,podgo,stomp}/prompt.ts`
**Impact:** Claude generates invalid amp names → Zod validation rejects entire ToneIntent → preset generation fails silently
**Affected devices:** Helix, Pod Go, Stomp (all HD2-era devices)

| # | Prompt File | Invalid Name | Correct Name | Notes |
|---|-------------|-------------|--------------|-------|
| 1 | helix/prompt.ts:38 | "Brit 2204" | "Line 6 2204 Mod" | Marshall JCM800 |
| 2 | helix/prompt.ts:38 | "Brit J-45 Nrm" | "Brit J45 Nrm" | Hyphen error |
| 3 | helix/prompt.ts:38 | "Brit J-45 Brt" | "Brit J45 Brt" | Hyphen error |
| 4 | helix/prompt.ts:43 | "Cali IV Rhythm 1" | (doesn't exist) | No Mesa Rhythm model |
| 5 | helix/prompt.ts:43 | "Cali IV Rhythm 2" | (doesn't exist) | No Mesa Rhythm model |
| 6 | helix/prompt.ts:48 | "PV 5150" | (doesn't exist) | No 5150 model at all |
| 7 | helix/prompt.ts:28 | "A30 Fawn Nrm" | "Essex A30" | Wrong name format |
| 8 | helix/prompt.ts:28 | "A30 Fawn Brt" | (doesn't exist) | No Brt variant |
| 9 | podgo/prompt.ts:33 | "Brit 2204" | "Line 6 2204 Mod" | Same as #1 |
| 10 | podgo/prompt.ts:43 | "PV 5150" | (doesn't exist) | Same as #6 |
| 11 | stomp/prompt.ts:34 | "Brit 2204" | "Line 6 2204 Mod" | Same as #1 |
| 12 | stomp/prompt.ts:44 | "PV 5150" | (doesn't exist) | Same as #6 |

**Root cause:** Prompt amp-cab pairing tables were hand-written and never validated against catalogs.
**Fix approach:** Cross-reference all prompt model names against catalog exports; add data integrity tests (Helix prompt already has one; Pod Go and Stomp do not).

**Mitigation gap:** `planner.ts` has variaxModel sanitization but NO equivalent for ampName/cabName. Invalid amp names cause full ToneIntent rejection.

---

#### CRIT-13: Scream 808 Default Parameters Wrong

**Module:** `src/lib/helix/models.ts:918`
**Impact:** Scream 808 (auto-inserted boost for high-gain) has wrong defaults
**Affected devices:** All

| Parameter | Current | Should Be | Problem |
|-----------|---------|-----------|---------|
| Gain | 0.0 | ~0.5 | No drive at all |
| Tone | 0.0 | ~0.5 | Maximum darkness |
| Level | 1.0 | 0.0 | Max output instead of unity |

**Root cause:** Likely copy-paste error. All other distortions use Level: 0.5 or omit it.
**Fix approach:** Set Gain: 0.5, Tone: 0.5, Level: 0.0 (standard Tube Screamer settings).

---

#### CRIT-14: Stadium Deep-Compare Test Failure — Format Mismatch

**Module:** `src/lib/helix/stadium-builder.ts`
**Impact:** Generated .hsp files have structural differences from real Stadium Edit output
**Affected devices:** Stadium, Stadium XL

**Key differences found in test:**
- Wrong block ordering (effects in wrong slots: b07-b11 misaligned)
- Missing parameters on delay/reverb blocks (Time, Feedback, Mix, Wow, Flutter, Level missing)
- Extra parameters present that shouldn't be (PreDelay, LowCut, HighCut on reverb)
- Missing harness Trails parameter on delay block
- Wrong Mono/Stereo model ID suffixes (e.g., "HD2_DistScream808Mono" vs "HD2_DistScream808")
- Wrong block positions (EQ at b07 instead of b09, modulation at b08 instead of b10)
- Value differences in 21 fields (model IDs, snapshot enabled states, param values)

**Root cause:** Stadium slot allocation and Mono/Stereo suffix logic doesn't match real firmware behavior.
**Fix approach:** Compare against multiple real .hsp reference files; fix slot allocation table and suffix rules.

---

#### CRIT-15: Pod Go Block Key Mismatch — Snapshots May Toggle Wrong Blocks

**Module:** `src/lib/helix/podgo-builder.ts:300-315, 395-410`
**Impact:** Snapshot bypass states may reference wrong blocks
**Affected devices:** Pod Go

**Problem:** `buildPgpBlockKeyMap()` uses two separate indices (snapshotIdx for non-cab, dspIdx for all), but `buildPgpControllerSection()` uses `indexOf()` on the full signal chain to find the wah block — wrong index type.

**Fix approach:** Use consistent indexing (snapshot-aware index) throughout Pod Go builder.

---

#### CRIT-16: Stadium EQ Model ID Uses Wrong Prefix

**Module:** `src/lib/helix/models.ts:1568`
**Impact:** Stadium Parametric EQ uses `HX2_EQParametric` prefix instead of `HD2_EQParametric` or `Stadium_EQParametric`
**Affected devices:** Stadium

**Fix approach:** Verify correct model ID from real .hsp files and update.

---

### HIGH (6 issues) — Presets load but sound wrong

#### HIGH-01: Horizon Gate Positioned Pre-Boost Instead of Post-Cab

**Module:** `src/lib/helix/chain-rules.ts:561-570`
**Impact:** Noise gate fires before the amp (gates clean signal, not amp noise)
**Affected devices:** All devices with high-gain presets

**Current order:** `extra_drive → horizon_gate(2.5) → boost(3) → amp → cab`
**Correct order:** `extra_drive → boost → amp → cab → horizon_gate`

**Root cause:** SLOT_ORDER assigns horizon_gate = 2.5, placing it between drives and boost. A noise gate should be post-cab to gate amp noise/hiss.
**Fix approach:** Move horizon_gate to post-cab slot (e.g., 5.5 or after cab).

---

#### HIGH-02: Non-MV Amp Master Volume Conflicts

**Module:** `src/lib/helix/models.ts:169-184`
**Impact:** Matchstick Ch1 and WhoWatt 100 have Master=0.90 in defaultParams but Master=1.0 in paramOverrides — inconsistent
**Affected devices:** All

| Amp | defaultParams.Master | paramOverrides.Master | Problem |
|-----|---------------------|----------------------|---------|
| Matchstick Ch1 | 0.90 | 1.0 | Conflict (non-MV should be 1.0 everywhere) |
| WhoWatt 100 | 0.90 | 1.0 | Conflict (non-MV should be 1.0 everywhere) |

**Fix approach:** Set defaultParams.Master = 1.0 for both non-MV amps.

---

#### HIGH-03: High-Gain AMP_DEFAULTS Drive Lower Than Crunch

**Module:** `src/lib/helix/param-engine.ts:46`
**Impact:** High-gain preset Drive=0.40 < Crunch Drive=0.50 — counterintuitive
**Affected devices:** All

**Root cause:** May be intentional (high-gain amps saturate harder per unit of drive), but risks under-driven high-gain presets.
**Fix approach:** Verify against real-world amp behavior; may need per-amp-model drive curves instead of category defaults.

---

#### HIGH-04: Ambient Snapshot Volume Too Low

**Module:** `src/lib/helix/snapshot-engine.ts:27-32`
**Impact:** Ambient snapshot ChVol=0.65 is the lowest of all roles — ambient effects (reverb/delay wash) may be inaudible
**Affected devices:** All

| Role | ChVol | Expected |
|------|-------|----------|
| Clean | 0.68 | OK |
| Crunch | 0.72 | OK |
| Lead | 0.80 | OK |
| Ambient | 0.65 | Too low — should be >= clean |

**Fix approach:** Raise ambient ChVol to at least 0.70 (delay/reverb add perceived loudness but need headroom).

---

#### HIGH-05: Compressor Sensitivity Key Name Mismatch

**Module:** `src/lib/helix/param-engine.ts:630`
**Impact:** COMBO-01 (wah + compressor threshold reduction) checks for "Sensitivity" key, but Helix compressors use "Threshold" — reduction never applies
**Affected devices:** All presets with wah + compressor

**Fix approach:** Verify actual parameter key names per compressor model; fix COMBO-01 key list.

---

#### HIGH-06: Ambient Mix Double-Application

**Module:** `src/lib/helix/snapshot-engine.ts:72,287-304` + `param-engine.ts`
**Impact:** Ambient intent applied twice — once via genre layer in param-engine, again via +0.15 boost in snapshot-engine. Reverb Mix could reach 0.65+ (0.50 genre + 0.15 boost), approaching the quality-validate warning threshold of 0.60.
**Affected devices:** All

**Fix approach:** Decide on single source of truth for ambient mix levels.

---

### MEDIUM (12 issues) — Suboptimal but functional

| # | Module | Issue | Fix Approach |
|---|--------|-------|-------------|
| MED-01 | validate.ts | Pod Go requires exactly 4 snapshots; builder allows fewer → false rejections | Change to `<=` check |
| MED-02 | validate.ts | Missing DSP position ordering check for Helix dual-DSP | Add ordering validation |
| MED-03 | validate.ts | Stadium amp parameters clamped to 0-1 range; some use raw Hz/dB values | Expand Stadium param validation |
| MED-04 | chain-rules.ts | Stadium mandatory blocks behavior undocumented | Verify device-family.ts mandatoryBlockTypes for Stadium |
| MED-05 | chain-rules.ts | COHERE-02 reverb auto-insertion fires before COMBO-03 truncation | Document or reorder |
| MED-06 | param-engine.ts | Stadium amps: paramOverrides guard bypassed at line 430 | Add explicit Stadium guard on paramOverrides |
| MED-07 | param-engine.ts | Reverb Mix floor 0.08 in COMBO-04 too aggressive | Raise to 0.15-0.20 |
| MED-08 | snapshot-engine.ts | Lead snapshot has compounded boosts (ChVol 0.80 + 2.5dB Gain) — may clip | Verify combined output level |
| MED-09 | snapshot-engine.ts | Gain Block dB encoding unclear (raw dB vs normalized) | Document and verify |
| MED-10 | snapshot-engine.ts | Dual-amp path convention undocumented | Document primary=clean, secondary=lead convention |
| MED-11 | stadium-builder.ts | Only 2 model base overrides; VIC_* prefix models may need overrides | Verify VIC_ models |
| MED-12 | stomp-builder.ts | No explicit validation that all blocks are dsp=0 | Add dsp check |

---

### LOW (4 issues) — Cosmetic or minor

| # | Module | Issue |
|---|--------|-------|
| LOW-01 | param-engine.ts | Guitar-type EQ adjustments very subtle (±0.01-0.03) — may be inaudible |
| LOW-02 | param-engine.ts | Dual Delay key names ("Left Time"/"Right Time") may silently fail for some models |
| LOW-03 | preset-builder.ts | Pedalstate recomputation per snapshot (inefficient but correct) |
| LOW-04 | snapshot-engine.ts | Cab toggling deferred to preset-builder — not clearly documented |

---

## Test Coverage Gaps

| Module | Gap |
|--------|-----|
| Pod Go builder | No block key mapping edge case tests |
| Pod Go prompt | No data integrity test for amp/cab names (Helix has one) |
| Stomp prompt | No data integrity test for amp/cab names |
| Cross-builder | No consistency test (same preset across Helix vs Stomp vs Pod Go) |
| Helix dual-DSP | No signal chain ordering regression test |
| Validation | No test for out-of-order DSP positions |

---

## Module Health Summary

| Module | Health | Critical Issues | Notes |
|--------|--------|-----------------|-------|
| **AI Prompts** | RED | 12 invalid model names | Highest priority fix |
| **Stadium Builder** | RED | Format mismatch with real files | Deep structural issues |
| **Pod Go Builder** | ORANGE | Block key mismatch | Snapshots may be broken |
| **Models Database** | ORANGE | Scream 808 params, 2 non-MV conflicts | Mostly solid otherwise |
| **Chain Rules** | ORANGE | Horizon Gate position | Otherwise well-structured |
| **Param Engine** | YELLOW | Drive inversion, COMBO key bug | Values mostly reasonable |
| **Snapshot Engine** | YELLOW | Ambient volume, mix double-apply | Logic mostly correct |
| **Helix Builder** | GREEN | Minor efficiency issue | Well-tested |
| **Stomp Builder** | GREEN | Missing dsp check | Minor |
| **Validation** | YELLOW | Pod Go strictness, Stadium params | Covers basics |
| **Quality Validate** | GREEN | No issues | Thresholds reasonable |
| **Device Family** | GREEN | No issues | Capabilities correct |
| **Config** | GREEN | No issues | Firmware constants verified |

---

## Recommended Fix Priorities for Phases 2-4

### Phase 2: Fix Signal Chain / Gain Staging
1. Fix Horizon Gate position (HIGH-01)
2. Fix Scream 808 defaults (CRIT-13)
3. Fix non-MV amp Master conflicts (HIGH-02)
4. Review high-gain Drive defaults (HIGH-03)
5. Fix ambient ChVol (HIGH-04)
6. Fix compressor Sensitivity key (HIGH-05)
7. Fix ambient mix double-application (HIGH-06)
8. Fix COMBO-04 reverb floor (MED-07)

### Phase 3: Snapshot / Stomp Correctness
1. Fix Pod Go block key mismatch (CRIT-15)
2. Fix lead snapshot clipping risk (MED-08)
3. Clarify Gain Block dB encoding (MED-09)
4. Document dual-amp convention (MED-10)
5. Fix Pod Go snapshot validation (MED-01)
6. Add missing dsp validation (MED-02, MED-12)

### Phase 4: AI Platform Evaluation
1. Fix all 12 invalid prompt model names (CRIT-01 to CRIT-12)
2. Add ampName/cabName sanitization in planner.ts
3. Add data integrity tests for Pod Go and Stomp prompts
4. Fix Stadium EQ model ID prefix (CRIT-16)
5. Fix Stadium builder format (CRIT-14)
6. Address remaining medium/low issues

---

*Report generated: 2026-03-08*
*Audited by: Claude Opus 4.6 via PAUL Phase 1*
