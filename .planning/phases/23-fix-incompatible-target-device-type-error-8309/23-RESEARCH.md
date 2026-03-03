# Phase 23: Fix Incompatible Target Device Type Error (-8309) - Research

**Researched:** 2026-03-02
**Domain:** Helix .hlx file format — device ID constants and firmware version encoding
**Confidence:** HIGH (codebase analysis) / MEDIUM (device ID root cause hypothesis — needs hardware verification)

---

## Summary

User John Rattinger reported error `-8309 Incompatible target device type` when importing a HelixAI-generated `.hlx` preset into HX Edit connected to his Helix Floor (firmware 3.8/3.80, HX Edit 3.82). He selected the FLOOR device in HelixAI, the downloaded file correctly has `_Floor` in the filename — but the import still fails. This rules out the user selecting the wrong device and points to a bug in the generated `.hlx` file itself.

The `-8309` error fires in HX Edit when `data.device` inside the `.hlx` JSON does not match the device ID reported by the connected hardware. The current codebase sets `DEVICE_IDS.helix_floor = 2162688` in `src/lib/helix/types.ts`. This value was established in Phase 1 (FNDN-03) by inspecting real `.hlx` exports, but those exports were from Helix LT hardware — not verified from a Helix Floor export. The Helix Floor device ID may be different from what is currently coded.

A prior "fix" commit (38b86b0) added UX safeguards — device badge on the preset card and `_Floor` suffix in the download filename — but did not touch `DEVICE_IDS.helix_floor`. The Phase 23 UX pass (f0f13be) then moved device selection to a post-interview picker but also did not fix the device ID. The actual `.hlx` binary bug — a wrong `data.device` integer — remains unfixed.

**Primary recommendation:** Obtain a real Helix Floor `.hlx` export, read its `data.device` integer, update `DEVICE_IDS.helix_floor` in `types.ts`, update the hardcoded test assertion in `orchestration.test.ts`, and update firmware constants in `config.ts` to v3.80 for alignment with current hardware.

---

## Bug Anatomy

### How the `-8309` Error is Generated

The `.hlx` file format is plain JSON. The outermost structure is:

```json
{
  "version": 6,
  "data": {
    "device": 2162692,
    "device_version": 57671680,
    "meta": { "application": "HX Edit", "appversion": 57671680, ... },
    "tone": { ... }
  },
  "meta": { "original": 0, "pbn": 0, "premium": 0 },
  "schema": "L6Preset"
}
```

When HX Edit imports a `.hlx` file into a connected Helix device:

1. It reads `data.device` from the JSON
2. It queries the connected hardware for its device ID
3. If they don't match → error `-8309: Incompatible target device type`

This is a hard rejection — not a warning. The preset will not load.

### Current DEVICE_IDS in the Codebase

```typescript
// src/lib/helix/types.ts
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,    // 0x210004 — tested and working
  helix_floor: 2162688, // 0x210000 — unverified, suspected wrong
  pod_go: 2162695,      // 0x210007 — from real .pgp file inspection
};
```

The `helix_lt` ID (2162692) is confirmed working — users successfully import Helix LT presets. The `helix_floor` ID (2162688) is **unverified against real Helix Floor hardware**. Phase 1 (FNDN-03) verified constants from 15 `.hlx` files, but those were from Helix LT and Helix Native (the developer's devices), not a Helix Floor.

### Firmware Version Encoding (BCD)

The app version integers use BCD encoding (hex digit pairs = decimal version components):

| Firmware | Hex (BCD) | Decimal |
|----------|-----------|---------|
| v3.50 | `0x03500000` | 55574528 |
| v3.70 | `0x03700000` | 57671680 (current in config.ts) |
| v3.80 | `0x03800000` | 58720256 |
| v3.82 | `0x03820000` | 58851328 |

The current `FIRMWARE_CONFIG.HLX_APP_VERSION` is `57671680` (v3.70). The user's device is on v3.80 with HX Edit 3.82. Research shows HX Edit accepts presets stamped v3.50 or newer, so v3.70 files are compatible with v3.80 hardware. The firmware version stamp is **not** the root cause of -8309.

However, updating `config.ts` to v3.80 is good practice to keep the metadata aligned with current hardware expectations.

### The Prior "Fix" — What It Did and Didn't Do

**Commit 38b86b0** ("Fix -8309: add device badge and device suffix"): Added UI safeguards to make the target device visible before downloading. Did NOT change `DEVICE_IDS.helix_floor`.

**Commit f0f13be** ("Phase 23: post-interview device picker"): Moved device selection to a post-interview card UI, eliminating most user-selection errors. Did NOT change `DEVICE_IDS.helix_floor`.

John Rattinger's bug persists because the `data.device` integer in generated Floor presets is still 2162688, which may not match what Helix Floor hardware reports.

---

## Standard Stack

### Core (no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x | Type corrections in types.ts | Already in use; this is a constant change |
| Vitest | 4.0.18 | Test assertion updates in orchestration.test.ts | Already in use |

No new packages needed. This is a constant fix in two files (`types.ts`, `config.ts`) with a corresponding test update.

**Installation:**
```bash
# No new packages
```

---

## Architecture Patterns

### Where Device ID Flows Through the Codebase

```
DEVICE_IDS constant (types.ts)
  ↓
preset-builder.ts: buildHlxFile(spec, device)
  uses: DEVICE_IDS[device] → written into data.device field
  ↓
generate/route.ts: calls buildHlxFile(presetSpec, deviceTarget)
  ↓
Frontend: downloads JSON file with embedded device integer
  ↓
HX Edit: reads data.device, rejects if ≠ connected hardware ID
```

### Affected Files

| File | Change Required | Scope |
|------|-----------------|-------|
| `src/lib/helix/types.ts` | Update `DEVICE_IDS.helix_floor` to correct value | 1 line |
| `src/lib/helix/config.ts` | Update `HLX_APP_VERSION` and `HLX_BUILD_SHA` to v3.80 | 2 lines |
| `src/lib/helix/orchestration.test.ts` | Update hardcoded `2162688` assertion to match new ID | 2 lines |

No logic changes needed. No new functions. No API surface changes. Pure constant corrections.

### How to Obtain the Correct Helix Floor Device ID

The correct Helix Floor device ID must come from a real `.hlx` file exported by HX Edit with a Helix Floor connected. The `data.device` field in that JSON is the authoritative value.

**Method A — Request from user:** Ask John Rattinger (the reporter) to export any preset from his Helix Floor using HX Edit and share the `.hlx` file. Read `data.device` from the JSON.

**Method B — Line6 CustomTone:** Download a preset explicitly tagged for "Helix" (Full) from line6.com/customtone, open the `.hlx` in a text editor, read `data.device`.

**Method C — Community forums:** Line 6 community forum members frequently share `.hlx` files; Helix Floor-specific presets can be found and inspected.

The planner should include a task for this investigation step — it must be done before writing the constant fix, as the correct value is not verifiable without hardware access or a real export.

### Anti-Patterns to Avoid

- **Guessing the device ID:** Do not increment/decrement `2162688` by trial and error. The correct ID must come from a real Helix Floor `.hlx` export. Wrong guesses would produce different import errors.
- **Assuming LT and Floor share IDs:** Line 6 assigns distinct device IDs per hardware model. `2162692` (LT) and `2162688` (Floor) are different values and HX Edit enforces this distinction.
- **Changing only types.ts without updating the test:** The `orchestration.test.ts` line 93 hardcodes `expect(hlx.data.device).toBe(2162688)`. If `DEVICE_IDS.helix_floor` changes, this assertion fails and blocks CI.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Device type lookup | Custom switch/if chain | `DEVICE_IDS[deviceTarget]` (existing) | Already implemented correctly in preset-builder.ts |
| Firmware version encoding | Custom encoder | BCD literal constants in config.ts | Simple lookup; already the pattern |
| `.hlx` format validation | Custom parser | Inspect real `.hlx` JSON files directly | The format is plain JSON; no tooling needed |

**Key insight:** This is a data correction fix, not a logic fix. The code structure is correct. Only the constant values are wrong.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update the Test

**What goes wrong:** Developer updates `DEVICE_IDS.helix_floor` in `types.ts` but doesn't update `orchestration.test.ts`. Tests pass on `helix_lt` path, fail on `helix_floor` path. The test at line 93 hardcodes the numeric value `2162688` and will fail.

**Why it happens:** The test was written to document the expected value, not to compute it from the constant. If the constant changes, the test must follow.

**How to avoid:** Update both in the same commit. The test should ideally reference `DEVICE_IDS.helix_floor` rather than a literal, but since we're changing the value, both the constant AND the literal assertion need updating.

**Warning signs:** Test failure message: `Expected 2162688, received [new value]`.

### Pitfall 2: Updating config.ts Firmware Version Without Understanding Impact

**What goes wrong:** Changing `HLX_APP_VERSION` changes what `data.device_version` and `data.meta.appversion` contain in all generated `.hlx` files. Helix hardware accepts presets from older firmware versions (v3.50+), so this is safe — but the `build_sha` must also be updated to match.

**How to avoid:** Update both `HLX_APP_VERSION` and `HLX_BUILD_SHA` together. For v3.80: `HLX_APP_VERSION = 58720256` and `HLX_BUILD_SHA = "v3.80"`.

### Pitfall 3: Treating -8309 as a Firmware Version Error

**What goes wrong:** Believing the fix is to change `HLX_APP_VERSION` from v3.70 to v3.82. This does NOT fix -8309, which is caused by `data.device` mismatch, not firmware version.

**Why it happens:** The issue report mentions user is on FW 3.8 / HX Edit 3.82, making it natural to assume version mismatch.

**How to avoid:** HX Edit research confirms presets from v3.50+ are accepted on v3.80 hardware. The firmware version stamp in the file does not need to match the hardware firmware version. Fix `data.device`, not `data.device_version`.

### Pitfall 4: The User Could Still Select Wrong Device

**What goes wrong:** Even with a corrected Helix Floor device ID, a user who selects "LT" and gets a preset with `data.device = 2162692` will get -8309 when importing on a Floor.

**Why this is acceptable:** The Phase 22/23 UI already prevents this — the device picker is shown post-interview (Phase 23 commit f0f13be) and the device badge + filename suffix (commit 38b86b0) make the target device visible. These UX safeguards remain.

**What remains:** After fixing the device ID, a user who correctly selects FLOOR should get a Floor preset that imports without error. That's the bug report.

---

## Code Examples

### Current Constants (need correction)

```typescript
// src/lib/helix/types.ts — CURRENT
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,    // confirmed working
  helix_floor: 2162688, // SUSPECTED WRONG — verify from real Floor .hlx export
  pod_go: 2162695,      // confirmed from real .pgp exports
} as const;
```

```typescript
// src/lib/helix/config.ts — CURRENT (needs update for alignment)
export const FIRMWARE_CONFIG = {
  HLX_VERSION: 6,
  HLX_APP_VERSION: 57671680,  // v3.70 BCD = 0x03700000
  HLX_BUILD_SHA: "v3.70",
} as const;
```

### Target Constants After Fix

```typescript
// src/lib/helix/types.ts — AFTER FIX
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: [CORRECT_VALUE_FROM_REAL_FLOOR_EXPORT],  // replace 2162688
  pod_go: 2162695,
} as const;
```

```typescript
// src/lib/helix/config.ts — AFTER UPDATE
export const FIRMWARE_CONFIG = {
  HLX_VERSION: 6,
  HLX_APP_VERSION: 58720256,  // v3.80 BCD = 0x03800000
  HLX_BUILD_SHA: "v3.80",
} as const;
```

### Test That Must Also Be Updated

```typescript
// src/lib/helix/orchestration.test.ts — line 87-94 — CURRENT
it("buildHlxFile with device='helix_floor' produces .hlx with device=2162688", () => {
  const spec = buildPresetSpec(cleanIntent());
  validatePresetSpec(spec);
  const hlx = buildHlxFile(spec, "helix_floor");

  expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor);
  expect(hlx.data.device).toBe(2162688);  // ← this literal must be updated
});
```

After the fix, the test description and the hardcoded `2162688` literal both need to reflect the new correct device ID.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No device selection | Device selector (LT/FLOOR/POD GO) | Phase 5, Phase 22 | User must choose before generating |
| No filename device suffix | `_LT`, `_Floor`, `_PodGo` suffix | Commit 38b86b0 | Visible sanity check before import |
| No post-interview device picker | Card picker appears after interview | Phase 23 (f0f13be) | Cannot generate without choosing device |
| Wrong Helix Floor device ID in generated file | To be fixed in this phase | Phase 23 | Eliminates -8309 when correct device chosen |

**Deprecated/outdated:**
- Header-level device pills (Phase 22 style) — replaced by post-interview picker in Phase 23
- The partial "fix" of 38b86b0 — addressed UX, not root cause

---

## Open Questions

1. **What is the correct Helix Floor `data.device` integer?**
   - What we know: Current value `2162688` causes -8309 on at least one user's hardware
   - What's unclear: The correct replacement value (needs a real Floor .hlx export to verify)
   - Recommendation: The plan MUST include a task to obtain and inspect a real Helix Floor `.hlx` export before writing the constant fix. Without this, the planner cannot specify the correct value.

2. **Is `device_version` also device-specific for Helix Floor?**
   - What we know: `device_version` uses the same value as `appversion` in `config.ts` (both = `HLX_APP_VERSION`)
   - What's unclear: Whether real Helix Floor exports use a different `device_version` value than LT exports
   - Recommendation: Inspect the `data.device_version` field in the real Floor export alongside `data.device` and update if different from LT value.

3. **Does HX Edit check `data.device_version` in addition to `data.device`?**
   - What we know: Research indicates `-8309` is a device type check, not firmware version check
   - What's unclear: Whether `device_version` ever triggers -8309 independently
   - Recommendation: LOW priority — fix `data.device` first. If -8309 persists, investigate `device_version`.

---

## Sources

### Primary (HIGH confidence)
- **Direct codebase inspection** — `src/lib/helix/types.ts`, `src/lib/helix/config.ts`, `src/lib/helix/preset-builder.ts`, `src/lib/helix/orchestration.test.ts`, `src/app/api/generate/route.ts` — device ID flow and encoding confirmed
- **Git log analysis** — commits 38b86b0 and f0f13be confirm prior attempts addressed only UX, not device ID
- **Phase 1 research (01-RESEARCH.md)** — confirms FNDN-03 verified against "15 real HX Edit exports" from HX Edit v3.70-v3.80+, but device sources were Helix LT and Helix Native (not Floor hardware)

### Secondary (MEDIUM confidence)
- **WebSearch — Line 6 community forums** — confirmed -8309 fires on `data.device` mismatch between file and connected hardware; firmware version is not the primary cause
- **WebSearch — Firmware 3.80/3.82 release notes** — v3.82 is a graphics/polish update with no format changes; v3.80 added new models but no format breaking changes
- **BCD encoding analysis** — firmware version encoding as `0x0XYZW000` (BCD) confirmed by decoding existing `57671680` = `0x03700000` = v3.70

### Tertiary (LOW confidence)
- **Device ID pattern** — hex pattern `0x210000` (Floor) vs `0x210004` (LT) vs `0x210007` (Pod Go) suggests a variant byte in the last nibble, but exact Floor value unconfirmed without real hardware export

---

## Metadata

**Confidence breakdown:**
- Bug root cause (wrong device ID): HIGH — behavior is consistent with known -8309 trigger; prior fixes didn't touch device ID; Phase 1 verification was LT-only
- Correct replacement value: LOW — must be obtained from real Helix Floor hardware; cannot be derived from code alone
- Firmware version update (config.ts): HIGH — encoding is confirmed; change is safe; HX Edit accepts v3.50+ presets on current hardware
- Test update requirement: HIGH — orchestration.test.ts line 93 hardcodes 2162688; must be updated alongside constant

**Research date:** 2026-03-02
**Valid until:** 2026-09-02 (stable — device IDs do not change between firmware versions; only changes if Line 6 releases new hardware variant)
