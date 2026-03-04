---
phase: 39
plan: 01
subsystem: helix-preset-generation
tags: [helix, stomp, device-target, type-system, builder, chain-rules, validate]
one_liner: "HX Stomp/XL type system + stomp-builder.ts with HelixStomp_* I/O models, single-DSP chain rules, device-specific limits"

dependency_graph:
  requires:
    - "src/lib/helix/types.ts (DeviceTarget, DEVICE_IDS, isStadium pattern)"
    - "src/lib/helix/config.ts (STADIUM_CONFIG pattern)"
    - "src/lib/helix/preset-builder.ts (structural reference for HlxTone)"
  provides:
    - "DeviceTarget union extended with helix_stomp | helix_stomp_xl"
    - "DEVICE_IDS.helix_stomp === 2162694, DEVICE_IDS.helix_stomp_xl === 2162699"
    - "isStomp() helper exported from types.ts and index.ts"
    - "STOMP_CONFIG with block limits, snapshot counts, I/O model strings"
    - "buildStompFile(spec, device) — builds .hlx with HelixStomp_* I/O, single DSP"
    - "summarizeStompPreset(spec, device) — human-readable Stomp summary"
    - "chain-rules.ts Stomp branches (single DSP, user effect caps, block limits)"
    - "validate.ts Stomp branch (dsp0-only, block/snapshot limits, HelixStomp_* VALID_IDS)"
  affects:
    - "Plans 39-02 (API routing) and 39-03 (UI) depend on these exports"

tech_stack:
  added: []
  patterns:
    - "DeviceTarget exhaustiveness pattern (same as Stadium, Phase 32)"
    - "Isolated per-device builder (stomp-builder.ts, same pattern as stadium-builder.ts)"
    - "isStomp() detection helper after isPodGo/isStadium in types.ts"
    - "STOMP_CONFIG constants block (mirrors STADIUM_CONFIG)"

key_files:
  created:
    - "src/lib/helix/stomp-builder.ts — buildStompFile() and summarizeStompPreset()"
  modified:
    - "src/lib/helix/types.ts — DeviceTarget union extended, DEVICE_IDS entries, isStomp()"
    - "src/lib/helix/config.ts — STOMP_CONFIG added after STADIUM_CONFIG"
    - "src/lib/helix/chain-rules.ts — isStomp branches in getDspForSlot, assembleSignalChain, isDualAmp, mandatory block insertion"
    - "src/lib/helix/validate.ts — isStomp branch in validatePresetSpec, HelixStomp_* in VALID_IDS"
    - "src/lib/helix/index.ts — barrel exports for buildStompFile, summarizeStompPreset, isStomp, STOMP_CONFIG"
    - "src/lib/helix/orchestration.test.ts — 25 new STOMP tests added"

key_decisions:
  - "stomp-builder.ts is isolated (not extending preset-builder.ts) to prevent LT/Floor regression risk"
  - "Parametric EQ and Gain Block skipped for Stomp (same as Pod Go — tight 6-block budget)"
  - "Stomp user effect cap: 2 for Stomp, 5 for Stomp XL (leaves room for mandatory amp+cab+boost blocks)"
  - "All blocks forced to dsp0 by getDspForSlot() via isStomp() check before slot switch"

metrics:
  duration_seconds: 402
  task_count: 3
  files_created: 1
  files_modified: 6
  tests_before: 115
  tests_after: 140
  tests_added: 25
  completed_date: "2026-03-04"
---

# Phase 39 Plan 01: HX Stomp Type System and Builder Summary

HX Stomp/XL type system + stomp-builder.ts with HelixStomp_* I/O models, single-DSP chain rules, device-specific limits.

## What Was Built

### Task 1: types.ts + config.ts (Commit: 4502c3f)

Extended the Helix type system to recognize two new device targets:

- `DeviceTarget` union now has 6 members: `"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium" | "helix_stomp" | "helix_stomp_xl"`
- `DEVICE_IDS.helix_stomp = 2162694` (confirmed from Swell_Delay.hlx hardware export)
- `DEVICE_IDS.helix_stomp_xl = 2162699` (confirmed from The_Kids_Are_D.hlx hardware export)
- `isStomp()` helper added to types.ts (returns true for either Stomp variant)
- `STOMP_CONFIG` constant block added to config.ts with: block limits (6/9), snapshot counts (3/4), I/O model strings (HelixStomp_AppDSPFlowInput, HelixStomp_AppDSPFlowOutputMain, HelixStomp_AppDSPFlowOutputSend), device version (58720256)

TypeScript compiled clean after Task 1.

### Task 2: stomp-builder.ts + chain-rules/validate/index updates (Commit: 97081cb)

Created `src/lib/helix/stomp-builder.ts` (~290 lines) as a self-contained .hlx builder:
- Uses `HelixStomp_AppDSPFlowInput` / `HelixStomp_AppDSPFlowOutputMain` I/O models (not HD2_App*)
- `dsp1 = {}` always (single DSP hardware)
- Snapshot slots: 0..(maxSnapshots-1) filled with @valid:true, remainder are buildEmptySnapshot() (@valid:false)
- `data.device = DEVICE_IDS[device]` (2162694 or 2162699)
- Public API: `buildStompFile(spec, device)` and `summarizeStompPreset(spec, device)`

Updated `chain-rules.ts`:
- `isStomp` imported from types.ts, `STOMP_CONFIG` from config.ts
- `getDspForSlot()`: `if (device && isStomp(device)) return 0;` after isPodGo check
- `assembleSignalChain()`: `stomp` local variable added; Stomp excluded from isDualAmp; user effect cap (2 Stomp / 5 XL); Parametric EQ and Gain Block skipped for Stomp (same as Pod Go — tight budget); block limit validation branch added

Updated `validate.ts`:
- `isStomp` and `STOMP_CONFIG` imported
- `stomp` local variable in `validatePresetSpec()`
- `HelixStomp_AppDSPFlowInput/Main/Send` added to `getValidModelIds()` set
- Stomp branch in DSP block limits section: dsp0-only check, block limit, snapshot limit

Updated `index.ts`:
- `STOMP_CONFIG` added to config exports
- `isStomp` added to types exports
- `buildStompFile, summarizeStompPreset` exported from stomp-builder

Build and all 115 existing tests passed after Task 2.

### Task 3: Stomp tests (Commit: ed15f8e)

Added 25 new STOMP tests to `orchestration.test.ts`:
- STOMP-01 (4 tests): device IDs, isStomp() helper
- STOMP-02 (3 tests): STOMP_CONFIG constants
- STOMP-03 (6 tests): buildStompFile output structure (device ID, I/O models, dsp1={}, snapshot slots)
- STOMP-04 (2 tests): assembleSignalChain forces all blocks to dsp0
- STOMP-05 (3 tests): validatePresetSpec accepts valid Stomp/XL presets, rejects over-limit snapshots
- STOMP-10 (2 tests): LT regression
- STOMP-06 (2 tests): Full end-to-end pipeline (in second describe block)
- STOMP-08 (2 tests): mapRigToSubstitutions accepts both Stomp device strings
- STOMP-10 regression (1 test): in pipeline describe block

Total: 115 → 140 tests, all passing.

## Deviations from Plan

**1. [Rule 1 - Bug/Gap] Parametric EQ and Gain Block also skipped for Stomp**
- **Found during:** Task 2 implementation of chain-rules.ts
- **Issue:** The plan specified skipping EQ/Gain only for Pod Go. But Stomp has a 6-block hardware limit (amp+cab+boost = 3 mandatory already fills half the budget). Adding Parametric EQ (dsp1) and Gain Block (dsp1) would exceed limits AND the research explicitly noted Stomp uses same budget rationale as Pod Go.
- **Fix:** Added `!stomp` to both the `!podGo` guards for EQ and Gain Block insertion (same pattern as Pod Go's skip). This is required for correctness — without it, the Stomp block budget would be blown on a clean preset with 0 user effects.
- **Files modified:** `src/lib/helix/chain-rules.ts`
- **Commit:** 97081cb

**2. [Rule 2 - Enhancement] Added isStomp() tests in STOMP-01 block**
- **Found during:** Task 3 — the plan mentioned testing device IDs but `isStomp()` itself is a critical exported contract that should be verified.
- **Fix:** Added 1 additional test verifying `isStomp()` returns true/false correctly for all 6 DeviceTarget values.
- **Files modified:** `src/lib/helix/orchestration.test.ts`
- **Commit:** ed15f8e

**3. [Rule 2 - Enhancement] STOMP-05 test includes XL variant and throws test**
- The plan template showed 2 STOMP-05 tests (passes valid Stomp, accepts HelixStomp_* model IDs). The second test as written would not usefully test model ID acceptance. Added: test for Stomp XL acceptance, and a throws-when-too-many-snapshots test instead (more rigorous).

## Build Result

```
npm run build: PASSED (zero TypeScript errors)
npx vitest run: 140/140 tests passed (115 existing + 25 new)
```

## Self-Check: PASSED

- FOUND: src/lib/helix/stomp-builder.ts
- FOUND: src/lib/helix/types.ts (modified)
- FOUND: .planning/phases/39-hx-stomp-support/39-01-SUMMARY.md
- FOUND: commit 4502c3f (Task 1)
- FOUND: commit 97081cb (Task 2)
- FOUND: commit ed15f8e (Task 3)
- Build: PASSED
- Tests: 140/140 PASSED
