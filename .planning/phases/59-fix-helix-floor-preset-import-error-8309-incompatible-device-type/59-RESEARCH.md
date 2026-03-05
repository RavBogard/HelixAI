# Phase 59: Fix Helix Floor Preset Import Error 8309 — Research

**Researched:** 2026-03-05
**Domain:** Helix .hlx file format — device ID constants, regression history, hardware verification
**Confidence:** HIGH (bug mechanics + regression history); MEDIUM (correct Floor ID hypothesis — needs one user verification step)

---

## Summary

Two users — Paul Morgan and Tal Solomon Vardy — report HX Edit error -8309 "Incompatible target device type" when importing HelixTones-generated `.hlx` presets on Helix Floor hardware. This is the THIRD time this exact error has been investigated for Helix Floor:

- **Phase 23 (2026-03-02):** Original report from John Rattinger. Fixed `helix_floor` from `2162688` → `2162691` in commit `3ba0768`.
- **Phase 31 (2026-03-04):** Regression detected — commit `68ad895` had reset `helix_floor` back to `2162692`. Fixed again in commit `68de815`.
- **Phase 59 (now):** Paul Morgan and Tal Solomon Vardy STILL get -8309. Current code has `helix_floor = 2162691`. Both fixes were applied. Users still fail.

**Root cause hypothesis (MEDIUM confidence):** The value `2162691` (0x210003) obtained in Phase 23 from John Rattinger may have been from a Helix Rack or other Helix variant — not a Helix Floor. Analysis of 39 real `.hlx` reference files shows 15 files with device=`2162689` (0x210001) using standard HD2_ Helix models spanning firmware v1.02 through v3.80. Zero reference files in the collection have device=`2162691`. The `0x210001` ID aligns with the original Helix / Helix Floor product (the first device in the lineup, released 2015), while `0x210004` is Helix LT and `0x210002` is likely Helix Rack.

**Primary recommendation:** The plan must include a user checkpoint asking Paul Morgan (or any Helix Floor user) to export one preset from their device via HX Edit and read the `data.device` field from the resulting `.hlx` JSON. This single number definitively resolves the correct Floor ID. If it reads `2162689`, update the constant and both test assertions. If it reads `2162691`, the device ID is correct and the bug has a different cause — investigate `device_version` or routing.

---

## Bug Anatomy

### How the -8309 Error is Generated

The `.hlx` file format is plain JSON. HX Edit reads `data.device` from the imported file and compares it to the device ID reported by the connected hardware:

```json
{
  "version": 6,
  "data": {
    "device": 2162691,        ← this integer must match the connected hardware
    "device_version": 58720256,
    "meta": { "appversion": 58720256, ... },
    "tone": { ... }
  },
  "schema": "L6Preset"
}
```

If `data.device` does not match the hardware ID → error -8309: Incompatible target device type. Hard rejection — the preset will not load.

**This is not a firmware version error.** `device_version` does not trigger -8309. The error fires on `data.device` mismatch only.

### Current Code State

```typescript
// src/lib/helix/types.ts
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,        // 0x210004 — confirmed from real Helix LT .hlx exports (Phase 1, FNDN-03)
  helix_floor: 2162691,     // 0x210003 — confirmed from real Helix Floor .hlx export (Phase 23, commit 3ba0768); regression in commit 68ad895 set this back to 2162692 — now restored
  pod_go: 2162695,          // 0x210007 — confirmed from 18 real .pgp files (Phase 12)
  helix_stadium: 2490368,
  helix_stomp: 2162694,
  helix_stomp_xl: 2162699,
} as const;
```

**Tests pass (all 170 green).** The Helix Floor test at `orchestration.test.ts:96` asserts `2162691` and passes because the constant matches. But Paul Morgan still gets -8309 when importing on real Helix Floor hardware.

### How the File Is Built

`src/lib/helix/preset-builder.ts` — `buildHlxFile(spec, device)`:

```typescript
const result: HlxFile = {
  version: FIRMWARE_CONFIG.HLX_VERSION,
  data: {
    device: DEVICE_IDS[device],           // ← this is what users get in their .hlx file
    device_version: FIRMWARE_CONFIG.HLX_APP_VERSION,
    meta: {
      name: spec.name.substring(0, 32),
      application: "HX Edit",
      build_sha: FIRMWARE_CONFIG.HLX_BUILD_SHA,
      modifieddate: Math.floor(Date.now() / 1000),
      appversion: FIRMWARE_CONFIG.HLX_APP_VERSION,
    },
    tone,
  },
  ...
};
```

The `device_version` (`58720256` = v3.80) is IDENTICAL for Helix LT and Helix Floor. No device-specific `device_version` value exists. This is confirmed correct — HX Edit accepts presets with `device_version` from v3.50+ regardless of the hardware firmware version. `device_version` is not the cause of -8309.

---

## Reference File Analysis

### 39 Real .hlx Files in C:/Users/dsbog/Downloads/

Inspected with Python (json.load + data.device extraction):

| device (decimal) | device (hex) | Count | Notes |
|-----------------|--------------|-------|-------|
| `2162689` | `0x210001` | 15 | HD2_ models, firmware v1.02–v3.80, application "Helix"/"HX Edit", multiple independent users |
| `2162690` | `0x210002` | 2 | HD2_ models, firmware v3.70–v3.71 |
| `2162691` | `0x210003` | **0** | **Not present in reference collection** |
| `2162692` | `0x210004` | 19 | Confirmed Helix LT (developer's device + AI-generated test files) |
| `2162694` | `0x210006` | 1 | Confirmed HX Stomp (Swell_Delay.hlx, HelixStomp_ I/O models) |
| `2162699` | `0x21000B` | 1 | Confirmed HX Stomp XL (The_Kids_Are_D.hlx, HelixStomp_ I/O models) |
| `2162944` | `0x210100` | 1 | Unknown device |

### Device 2162689 (0x210001) — Key Evidence

All 15 files using this ID share these characteristics:

- All use `HD2_AppDSPFlow1Input` for `dsp0.inputA.@model` (standard Helix family I/O model)
- All use `HD2_Amp*` and `HD2_*` model IDs (standard Helix family models)
- Span firmware `v1.02` (file: Vox Liverpool — `application: "Helix"` from 2015–2016) through `v3.80` (current)
- Multiple independent build SHAs (`3259f21`, `a7e2585`, `7d01f5e`) — not all from the same user
- None are AI-generated (no `application: "HelixAI"` tag)
- The oldest file (`Vox Liverpool`) uses `application: "Helix"` — the original Helix desktop app before it was rebranded to "HX Edit" in 2018 when the Helix LT launched

### Device 2162692 (0x210004) — Confirmed Helix LT

19 files. Mix of real hardware exports (HX Edit app, real git SHAs) and AI-generated presets (HelixAI app, `build_sha: "v3.70"/"v3.80"`). The developer has a Helix LT — all AI-generated test files use `device: 2162692` from the `helix_lt` constant.

### Device 2162690 (0x210002)

2 files (Hendrix GPT Blue). HD2_ models, firmware v3.70/v3.71. Likely Helix Rack (second product in the Helix lineup).

---

## Device ID Hypothesis

Based on the reference file analysis and the Helix product release timeline:

| ID | Hex | Product | Evidence |
|----|-----|---------|---------|
| `2162689` | `0x210001` | Helix / Helix Floor (original) | 15 reference files spanning v1.02–v3.80; oldest file uses "Helix" app predating HX Edit rename; first product in lineup gets lowest ID |
| `2162690` | `0x210002` | Helix Rack | 2 reference files, HD2_ models |
| `2162691` | `0x210003` | Unknown — possibly Helix Control or a regional variant | 0 reference files; source was ONE user (John Rattinger, Phase 23) |
| `2162692` | `0x210004` | Helix LT | 19 reference files; confirmed working for users |

**The critical observation:** John Rattinger (Phase 23 reporter) may have exported a file from a Helix Rack or Helix Control rather than a Helix Floor. The `0x210003` value has no corroborating reference files in the collection. If Rattinger actually had a Helix Floor, the fix from Phase 23 would have resolved -8309 for ALL Floor users — but Paul Morgan still gets the error.

**Note on user question ("Do Floor and LT need to be differentiated?"):** YES. They have different device IDs (`0x210001` ≠ `0x210004`). They cannot share a preset without triggering -8309. However, the current "differentiation" may be using the wrong Floor ID.

---

## Regression History

This bug has been through two prior fix cycles, both ultimately ineffective:

```
Phase 1 (FNDN-03):   helix_floor = 2162688  (guessed/unverified — LT value)
Phase 23 Plan 02:    helix_floor = 2162691  (from John Rattinger's hardware, commit 3ba0768)
Commit 68ad895:      helix_floor = 2162692  (REGRESSION — reset to LT value in docs commit)
Phase 31 Plan 01:    helix_floor = 2162691  (restored, commit 68de815)
Phase 59 (now):      helix_floor = 2162691  (unchanged — Paul Morgan STILL gets -8309)
```

The Phase 23 fix was obtained from a single user. The value `2162691` may have been correct for Rattinger's specific hardware but incorrect for Helix Floor hardware in general. Phase 59 must not repeat this mistake — the plan must get verification from Paul Morgan (the current reporter) directly.

---

## Affected Files

| File | What Changes | Scope |
|------|--------------|-------|
| `src/lib/helix/types.ts` | Update `DEVICE_IDS.helix_floor` (1 line + comment) | Depends on confirmed ID |
| `src/lib/helix/orchestration.test.ts` | Update test description and literal assertion at lines 90–96 | Must match new constant |
| No other files | `preset-builder.ts` and `stomp-builder.ts` use `DEVICE_IDS[device]` — already correct architecture | None |

### Test Requiring Update

```typescript
// orchestration.test.ts lines 90-96 — CURRENT
it("buildHlxFile with device='helix_floor' produces .hlx with device=2162691", () => {
  const spec = buildPresetSpec(cleanIntent());
  validatePresetSpec(spec);
  const hlx = buildHlxFile(spec, "helix_floor");

  expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor);  // line 95 — references constant (ok)
  expect(hlx.data.device).toBe(2162691);                  // line 96 — literal, MUST be updated
});
```

**Both the test description AND line 96 literal must change** if the constant changes. This is the dual-assertion pattern established in Phase 31 to catch silent regressions. Do not change line 95 — it should always reference the constant.

---

## Architecture

### Device ID Flow Through the System

```
User selects "Helix Floor" in UI
  ↓
/api/generate/route.ts: deviceTarget = "helix_floor"
  ↓
preset-builder.ts: buildHlxFile(spec, "helix_floor")
  uses: DEVICE_IDS["helix_floor"]  →  written to data.device
  ↓
User downloads .hlx file with data.device = 2162691 (current)
  ↓
HX Edit checks data.device against hardware ID
  if 2162691 ≠ hardware_id → -8309
```

### How to Obtain the Correct Floor ID

The ONLY reliable source is a real `.hlx` file exported from a Helix Floor via HX Edit. Method:

1. User opens HX Edit with Helix Floor connected
2. Exports any preset (File > Export or drag from list)
3. Opens the `.hlx` file in a text editor (it is plain JSON)
4. Finds `data.device` near the top
5. Reports the integer value

Shell command to extract it:
```bash
python3 -c "import json; d=json.load(open('file.hlx')); print('data.device:', d['data']['device'])"
```

**Expected values and their meaning:**
- `2162689` (0x210001) → confirms hypothesis; update constant and test
- `2162691` (0x210003) → constant is correct; bug has a different cause (escalate)
- Anything else → document the new value and update

The plan MUST include a blocking human-action checkpoint for this verification step. Do not proceed to code changes without a confirmed value from the current reporter.

---

## Plan Recommendations

### Plan 01 — Get Confirmed Floor Device ID (human checkpoint)

**Wave 1 — blocking task:**

Ask Paul Morgan (or any Helix Floor user) to:
1. Export any preset from their Helix Floor using HX Edit (File > Export Preset)
2. Open the `.hlx` file in a text editor
3. Report the `data.device` number from the JSON (it appears near the top of the file)

Document the result in the phase directory with source (filename, user, date).

### Plan 02 — Apply the Fix

**Wave 1 — fully autonomous after Plan 01 provides the verified ID:**

1. Update `DEVICE_IDS.helix_floor` in `src/lib/helix/types.ts` to the confirmed integer
   - Update the comment to cite: "confirmed from real Helix Floor .hlx export (Phase 59, YYYY-MM-DD)"
   - Remove the prior regression history note (clean slate for Phase 59)
2. Update `src/lib/helix/orchestration.test.ts`:
   - Line 90: change test description to reflect new device ID
   - Line 96: change literal assertion `.toBe(2162691)` → `.toBe(<new_id>)`
3. Run full test suite (`npx vitest run`) — confirm all tests pass
4. Verify `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt` assertion still green
5. Commit with message referencing Phase 59 and the source file for provenance

---

## Pitfalls

### Pitfall 1: Trusting One User's Hardware Again

**What goes wrong:** Developer applies the value from Paul Morgan without verifying whether the same value loads for Tal Solomon Vardy (the second reporter).

**Why it matters:** Phase 23 trusted one user (Rattinger) and got a value that now fails for a different user (Morgan). Two reporters are better than one.

**How to avoid:** If possible, get Paul Morgan's export AND one other Helix Floor user's export. If they match, the value is confirmed. If they differ, there are multiple Floor variants in the wild.

### Pitfall 2: Assuming 2162689 Without User Verification

**What goes wrong:** Developer sees the reference file analysis (15 files, v1.02–v3.80, compelling evidence) and directly applies `2162689` without asking Paul Morgan to verify.

**Why it's dangerous:** The reference collection may not include a file from a Helix Floor. We have 15 files with `0x210001` but we don't know with certainty which hardware exported them.

**How to avoid:** The human checkpoint is mandatory. Use the reference file analysis to inform the checkpoint question, but do not skip the confirmation step.

### Pitfall 3: Not Updating the Test Literal

**What goes wrong:** Developer updates `DEVICE_IDS.helix_floor` in `types.ts` but forgets to update the hardcoded literal on line 96 of `orchestration.test.ts`.

**Why it happens:** Line 95 (`expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor)`) passes immediately — the developer sees green and misses that line 96 now has the wrong literal.

**Warning sign:** Test result shows 171/171 pass but the literal on line 96 is stale. This breaks regression detection — a future silent constant change won't be caught.

### Pitfall 4: Treating This as a Firmware Version Problem

The `-8309` error is caused by `data.device` mismatch. `data.device_version` (currently `58720256` = v3.80) does not trigger -8309. HX Edit accepts presets stamped v3.50+ on current hardware. Do not change `config.ts` firmware constants as part of this fix — they are already correct from Phase 23.

### Pitfall 5: Introducing a Third Regression

Commits `68ad895` and the prior bugs all shared the same failure mode: a value was set without a meaningful source comment. After the fix:
- The `types.ts` comment MUST cite the specific `.hlx` file, the user who provided it, and the date
- The commit message MUST reference Phase 59 and the hardware verification step
- Format: `helix_floor: 2162689,  // 0x210001 — confirmed from <filename>.hlx, Helix Floor, Paul Morgan, 2026-03-XX (Phase 59)`

---

## Open Questions

1. **What is Paul Morgan's actual `data.device` value?**
   - Best estimate: `2162689` (0x210001) based on reference file analysis
   - Confidence: MEDIUM — 15 reference files support this, zero files support the current `2162691`
   - Resolution: Blocking human-action checkpoint in Plan 01

2. **What device does Tal Solomon Vardy have?**
   - Unknown — may be Helix Floor, or may be a different device
   - If Paul Morgan provides `2162689` and Vardy's device is also Helix Floor, the same fix resolves both
   - If Vardy has a different device (e.g., Helix Rack with `2162690`), HelixTones may need to support it too

3. **Is `2162691` (0x210003) anyone's correct device?**
   - John Rattinger from Phase 23 reported this as his Helix Floor export
   - Possible explanations: Helix Control (the foot controller paired with Helix Rack), a specific regional variant, a beta firmware device, or Rattinger misidentified his hardware
   - This value needs to be either confirmed for a real product or retired from the codebase

4. **Do Floor and LT need to be differentiated?**
   - YES — they have different device IDs and HX Edit enforces them as distinct targets
   - The current code already differentiates them (separate `DeviceTarget` values, separate DEVICE_IDS entries)
   - The only problem is the Floor ID constant may be wrong

---

## Validation Architecture

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config | `vitest.config.ts` |
| Quick run | `npx vitest run src/lib/helix/orchestration.test.ts` |
| Full suite | `npx vitest run` |
| Current tests | 170 passing, 0 failing |

### Phase Requirements → Test Map

| Req | Behavior | Test | File | Status |
|-----|----------|------|------|--------|
| Phase 59 | `helix_floor` device ID matches Paul Morgan's hardware | `orchestration.test.ts` lines 90–96 | EXISTS | Passes with 2162691 — will need literal update |
| Phase 59 | `helix_floor !== helix_lt` | `orchestration.test.ts` line 302 | EXISTS | Passes |

No new test files needed — existing tests cover the requirement once the literal is updated.

---

## Sources

### Primary (HIGH confidence)

- **Direct codebase inspection** — `src/lib/helix/types.ts` (current: `helix_floor: 2162691`); `src/lib/helix/preset-builder.ts` (device ID flow to `data.device`); `src/lib/helix/orchestration.test.ts` (test at lines 90–96 with literal `2162691`)
- **39 real .hlx files in `C:/Users/dsbog/Downloads/`** — Python json.load analysis confirms device=2162689 in 15 files spanning firmware v1.02–v3.80, device=2162691 in ZERO files
- **`.planning/phases/23-fix-incompatible-target-device-type-error-8309/23-02-SUMMARY.md`** — confirms `2162691` was applied in commit `3ba0768` from John Rattinger's hardware export; no source file is preserved
- **`.planning/phases/31-device-id-research-floor-fix/31-RESEARCH.md`** — confirms regression in commit `68ad895`, fix in commit `68de815`; confirms `2162691` was restored from Phase 23 provenance

### Secondary (MEDIUM confidence)

- **Helix product release timeline** — Helix Floor (2015) → Helix Rack (2016) → Helix LT (2018); ascending device IDs `0x210001`, `0x210002`, `0x210004` are consistent with release order
- **Application name evidence** — `Vox Liverpool.hlx` (device=2162689) uses `application: "Helix"` (pre-2018 app name), confirming the file predates HX Edit rebrand and was exported from original Helix hardware
- **`STATE.md` user reports** — Paul Morgan (Helix Floor, confirmed) and Tal Solomon Vardy (device unknown) both report -8309

### Tertiary (LOW confidence)

- **Hypothesis that `2162691` is Helix Control or Helix Rack variant** — inferred from the absence of reference files and the product lineup gap; not confirmed by any direct source
- **John Rattinger had a non-Floor device** — plausible given the evidence, but speculative without his device model information

---

## Metadata

**Confidence breakdown:**
- Bug root cause (wrong device ID): HIGH — current `2162691` fails for Paul Morgan; same pattern as Phase 23 original bug
- Correct replacement value (`2162689`): MEDIUM — 15 reference files support this; no reference files support `2162691`; user checkpoint mandatory before applying
- Fix mechanics (constant + test update): HIGH — identical pattern to Phase 23 Plan 02; simple, tested, well-understood
- No other files need changing: HIGH — `preset-builder.ts` architecture is correct

**Research date:** 2026-03-05
**Valid until:** 2026-09-05 (device IDs do not change with firmware updates; only changes if Line 6 releases new hardware)
