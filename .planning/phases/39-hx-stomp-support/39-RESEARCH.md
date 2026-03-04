# Phase 39: HX Stomp & HX Stomp XL Support - Research

**Researched:** 2026-03-04
**Domain:** Line 6 HX Stomp / HX Stomp XL preset generation — .hlx file format with Stomp-specific I/O models, block limits, and snapshot counts
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

Proposed requirement IDs (TBD at planning time — proposed here for planner use):

| ID | Description | Research Support |
|----|-------------|-----------------|
| STOMP-01 | `DeviceTarget` union includes `"helix_stomp"` and `"helix_stomp_xl"`; `DEVICE_IDS.helix_stomp === 2162694` and `DEVICE_IDS.helix_stomp_xl === 2162699` with source comments | stomp-device-ids.md confirms both IDs from real hardware exports |
| STOMP-02 | `config.ts` exports `STOMP_CONFIG` with block limits, snapshot counts, and I/O model constants | stomp-device-ids.md defines exact constants; Stadium precedent confirms pattern |
| STOMP-03 | `stomp-builder.ts` exports `buildStompFile(spec, device)` that produces a valid `.hlx` file using `HelixStomp_*` I/O models, correct block cap, and correct snapshot count per device | Both Stomp variants use standard .hlx JSON — builder mirrors preset-builder.ts with Stomp I/O substitution |
| STOMP-04 | `chain-rules.ts` enforces Stomp-specific block limits: 6 for Stomp, 9 for Stomp XL | chain-rules.ts already handles Stadium and Pod Go device branches — same pattern |
| STOMP-05 | `validate.ts` enforces Stomp block limits and single-DSP constraint | validate.ts already has Stadium/Pod Go branches — add Stomp branch |
| STOMP-06 | `/api/generate` routes `"helix_stomp"` and `"helix_stomp_xl"` to `buildStompFile()`, returns `fileExtension: ".hlx"`, stores `latest.hlx` in Supabase | route.ts pattern established by Stadium and Pod Go — Stomp is simpler (same ext as LT/Floor) |
| STOMP-07 | `page.tsx` shows "STOMP" and "STOMP XL" device options; downloads named `_Stomp.hlx` and `_StompXL.hlx`; "Generate for other device" chip handles 6 devices | Both device arrays at lines ~1282 and ~1373 currently use grid-cols-4; will need grid-cols-6 or separate row |
| STOMP-08 | `rig-mapping.ts` `mapRigToSubstitutions()` accepts `"helix_stomp"` and `"helix_stomp_xl"` without throwing | Same pattern as Stadium STAD-08 — Stomp uses HD2_* models, no special prefix exclusions |
| STOMP-09 | Generated `.hlx` files import into HX Edit without errors for both Stomp variants | Hardware validation before UI appears — same gate as Stadium v3.0 |
| STOMP-10 | All existing 115 tests pass; Helix LT, Floor, Pod Go, Stadium generation unaffected | Regression protection — exhaustiveness must cover new DeviceTarget members |
</phase_requirements>

---

## Summary

Phase 39 adds HX Stomp (`helix_stomp`) and HX Stomp XL (`helix_stomp_xl`) as preset generation targets. Both devices use the **standard `.hlx` JSON format** — identical top-level structure to Helix LT/Floor — making this the simplest new-device addition in the project's history. The only differences from LT/Floor are: (1) `HelixStomp_*` I/O block model prefix instead of `HD2_App*`, (2) single DSP only (dsp1 always empty), (3) tighter block limits (6 for Stomp, 9 for XL), and (4) fewer snapshots (3 for Stomp, 4 for XL). Effect models use the same `HD2_*` and `VIC_*` prefixes as LT/Floor — no Stomp-exclusive model prefix exists.

All device IDs are confirmed from real hardware exports: HX Stomp = 2162694, HX Stomp XL = 2162699, both with `device_version: 58720256` (same as LT/Floor's `FIRMWARE_CONFIG.HLX_APP_VERSION`). The codebase already has a complete, working pattern for adding new devices (Stadium, Pod Go) through TypeScript exhaustiveness-driven integration. Phase 39 follows that exact same pattern: (1) extend `DeviceTarget`, (2) add constants to `config.ts`, (3) create `stomp-builder.ts`, (4) wire device-specific branches throughout, (5) add UI options.

The most significant architectural decision is that both Stomp variants can share a single `stomp-builder.ts` parameterized by `deviceTarget`. This mirrors how `buildHlxFile(spec, device)` works for LT/Floor — just one builder function with a device parameter rather than two separate builders. The Stomp builder is essentially a thin wrapper around the LT/Floor `.hlx` JSON structure that substitutes `HelixStomp_*` I/O models and caps snapshots/blocks per device.

**Primary recommendation:** Follow the Stadium/Pod Go integration playbook exactly. Add `"helix_stomp" | "helix_stomp_xl"` to `DeviceTarget`, let TypeScript exhaustiveness errors identify every file needing a Stomp branch, implement `stomp-builder.ts` as a parameterized variant of `preset-builder.ts`, add both devices to the UI picker, and gate on `.hlx` import verification before shipping.

---

## Standard Stack

No new npm packages required. Phase 39 is pure TypeScript within the existing codebase.

### Core
| Component | Version/Location | Purpose | Why Standard |
|-----------|-----------------|---------|--------------|
| TypeScript DeviceTarget union | `src/lib/helix/types.ts` | Add `"helix_stomp" \| "helix_stomp_xl"` | Exhaustiveness errors become the integration checklist |
| STOMP_CONFIG constant | `src/lib/helix/config.ts` | Block limits, snapshot counts, I/O model strings | Follows FIRMWARE_CONFIG / STADIUM_CONFIG pattern |
| stomp-builder.ts | `src/lib/helix/stomp-builder.ts` | Build .hlx with Stomp-specific I/O + limits | Isolated per-device builder — no changes to preset-builder.ts |
| Vitest | `^4.0.18` (already installed) | Test framework — all new tests go here | Project standard — 115 tests currently green |

### Supporting
| Component | Purpose | When to Use |
|-----------|---------|-------------|
| `isHelix()` / `isPodGo()` / `isStadium()` pattern | Device detection helpers in `types.ts` | Add `isStomp(device)` returning `device === "helix_stomp" \|\| device === "helix_stomp_xl"` |
| `buildHlxFile` (existing) | LT/Floor builder for reference | stomp-builder.ts should reference this as its structural template |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `stomp-builder.ts` (new file) | Extend `preset-builder.ts` with Stomp branches | New file preferred — cleaner isolation, no risk of regressions in LT/Floor builder |
| Single `isStomp()` helper | Two separate `isHelixStomp()` / `isHelixStompXL()` helpers | Single helper is simpler; use it for "is any Stomp variant" and compare deviceTarget directly for XL-specific logic |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/helix/
├── types.ts           # ADD "helix_stomp" | "helix_stomp_xl" to DeviceTarget, DEVICE_IDS, isStomp()
├── config.ts          # ADD STOMP_CONFIG constant block
├── stomp-builder.ts   # NEW — buildStompFile(spec, device), summarizeStompPreset(spec, device)
├── chain-rules.ts     # ADD isStomp() branch: single DSP, per-device block limit
├── validate.ts        # ADD isStomp() branch: single DSP, per-device block/snapshot limits
├── snapshot-engine.ts # VERIFY: no device-specific branches that need Stomp coverage
├── models.ts          # VERIFY: getModelsForDevice / getModelListForPrompt exhaustiveness
├── rig-mapping.ts     # ADD isStomp() handling (uses same HD2_* models as LT/Floor)
└── index.ts           # ADD barrel exports for stomp-builder.ts

src/app/api/generate/route.ts   # ADD isStomp() branch routing to buildStompFile()
src/app/page.tsx                # ADD both Stomp devices to both device picker arrays
```

### Pattern 1: TypeScript Exhaustiveness-Driven Integration

**What:** Add Stomp to `DeviceTarget` first. TypeScript compiler surfaces every unhandled case as a compile error. Fix each error with the correct Stomp implementation.

**When to use:** Always — this is the project standard established in Phase 32 for Stadium.

**Example:**
```typescript
// src/lib/helix/types.ts
export type DeviceTarget =
  | "helix_lt"
  | "helix_floor"
  | "pod_go"
  | "helix_stadium"
  | "helix_stomp"        // Phase 39
  | "helix_stomp_xl";    // Phase 39

export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: 2162691,
  pod_go: 2162695,
  helix_stadium: 2490368,
  helix_stomp: 2162694,    // Confirmed from Swell_Delay.hlx (HX Stomp hardware export, 2026-03-04)
  helix_stomp_xl: 2162699, // Confirmed from The_Kids_Are_D.hlx (HX Stomp XL hardware export, 2026-03-04)
} as const;

/** Returns true if the device target is any HX Stomp variant */
export function isStomp(device: DeviceTarget): boolean {
  return device === "helix_stomp" || device === "helix_stomp_xl";
}
```

### Pattern 2: STOMP_CONFIG Constants Block

**What:** Add Stomp-specific constants to `config.ts` alongside `FIRMWARE_CONFIG`, `POD_GO_FIRMWARE_CONFIG`, and `STADIUM_CONFIG`.

**When to use:** All Stomp magic values live here — no literals scattered in builder/chain/validate files.

**Example:**
```typescript
// src/lib/helix/config.ts — add after STADIUM_CONFIG
/**
 * HX Stomp and HX Stomp XL file format constants.
 * Source: Direct inspection of real .hlx files (2026-03-04)
 *   - Swell_Delay.hlx: HX Stomp hardware export
 *   - The_Kids_Are_D.hlx: HX Stomp XL hardware export
 */
export const STOMP_CONFIG = {
  /** HX Stomp: max user-assignable effect blocks (hardware limit) */
  STOMP_MAX_BLOCKS: 6,
  /** HX Stomp XL: max user-assignable effect blocks (hardware limit) */
  STOMP_XL_MAX_BLOCKS: 9,
  /** HX Stomp: snapshot count */
  STOMP_MAX_SNAPSHOTS: 3,
  /** HX Stomp XL: snapshot count (confirmed from The_Kids_Are_D.hlx) */
  STOMP_XL_MAX_SNAPSHOTS: 4,
  /** I/O input model for both Stomp variants (HelixStomp_ prefix, not HD2_AppDSPFlow*) */
  STOMP_INPUT_MODEL: "HelixStomp_AppDSPFlowInput",
  /** I/O main output model */
  STOMP_OUTPUT_MAIN_MODEL: "HelixStomp_AppDSPFlowOutputMain",
  /** I/O send output model */
  STOMP_OUTPUT_SEND_MODEL: "HelixStomp_AppDSPFlowOutputSend",
  /** Device version — same as LT/Floor (FIRMWARE_CONFIG.HLX_APP_VERSION = 58720256) */
  STOMP_DEVICE_VERSION: 58720256,
} as const;
```

### Pattern 3: stomp-builder.ts — Parameterized .hlx Builder

**What:** A single builder function that accepts `deviceTarget` to select block cap, snapshot count, and always uses `HelixStomp_*` I/O models. Output is a standard `HlxFile` object (same type as LT/Floor).

**When to use:** Whenever `device === "helix_stomp" || device === "helix_stomp_xl"` in the generate route.

**Key structural insight:** The Stomp .hlx is byte-for-byte identical to LT/Floor EXCEPT:
1. `data.device` = 2162694 or 2162699 (not 2162692/2162691)
2. `dsp0.inputA["@model"]` = `"HelixStomp_AppDSPFlowInput"` (not `"HD2_AppDSPFlow1Input"`)
3. `dsp0.outputA["@model"]` = `"HelixStomp_AppDSPFlowOutputMain"` (not `"HD2_AppDSPFlowOutput"`)
4. `dsp1` = `{}` always (single DSP)
5. Only `snapshot0`–`snapshot{N-1}` filled; remaining snapshot slots are empty (`@valid: false`)
6. Block counts capped per device

**Recommended approach:** `stomp-builder.ts` imports `buildHlxFile` from `preset-builder.ts` conceptually, but since the I/O model substitution is deep inside `buildDsp()`, it's cleaner to have `stomp-builder.ts` call a modified version. Two options:

- **Option A (preferred):** `stomp-builder.ts` builds the HlxFile object directly, duplicating only the minimal structure from `preset-builder.ts`, substituting `HelixStomp_*` I/O models inline. ~150 lines.
- **Option B:** Extend `preset-builder.ts` `buildHlxFile()` to accept device and branch on `isStomp()`. Risks regression to LT/Floor.

Option A is preferred — same rationale as Stadium's `stadium-builder.ts` being separate from `preset-builder.ts`.

```typescript
// src/lib/helix/stomp-builder.ts
export function buildStompFile(spec: PresetSpec, device: "helix_stomp" | "helix_stomp_xl"): HlxFile {
  const isXL = device === "helix_stomp_xl";
  const maxSnapshots = isXL ? STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS : STOMP_CONFIG.STOMP_MAX_SNAPSHOTS;

  const tone = buildStompTone(spec, maxSnapshots);

  return {
    version: FIRMWARE_CONFIG.HLX_VERSION,
    data: {
      device: DEVICE_IDS[device],       // 2162694 or 2162699
      device_version: STOMP_CONFIG.STOMP_DEVICE_VERSION,
      meta: {
        name: spec.name.substring(0, 32),
        application: "HX Edit",
        build_sha: FIRMWARE_CONFIG.HLX_BUILD_SHA,
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: FIRMWARE_CONFIG.HLX_APP_VERSION,
      },
      tone,
    },
    meta: { original: 0, pbn: 0, premium: 0 },
    schema: "L6Preset",
  };
}
```

### Pattern 4: chain-rules.ts Stomp Branch

**What:** Add `isStomp()` handling to `assembleSignalChain()` — single DSP (all blocks on dsp0), per-device block cap.

**Key details:**
- Stomp: single DSP, same as Pod Go and Stadium
- Block limit: `STOMP_MAX_BLOCKS` (6) or `STOMP_XL_MAX_BLOCKS` (9) depending on device
- Effect limit: Stomp = 6 - 4 mandatory (amp+cab+boost+eq/gain) = ~2 user effects max; XL = 9 - 4 = ~5 user effects
- Dual-amp: not supported for Stomp (single DSP like Pod Go/Stadium)
- getDspForSlot: Stomp forces all blocks to dsp0 (same as Pod Go)

```typescript
// chain-rules.ts — add to getDspForSlot()
if (device && isStomp(device)) return 0; // Single DSP — all blocks on dsp0

// chain-rules.ts — add to assembleSignalChain() user effect limit
const maxUserEffects = device && isStomp(device)
  ? (device === "helix_stomp_xl" ? 5 : 2)
  : (podGo ? POD_GO_MAX_USER_EFFECTS : ...);
```

### Pattern 5: validate.ts Stomp Branch

**What:** Add Stomp validation rules alongside the existing Pod Go and Stadium branches.

```typescript
// validate.ts — add alongside stadium/podGo branches
} else if (isStomp(device)) {
  // Single DSP: all blocks on dsp0
  const nonDsp0 = spec.signalChain.filter(b => b.dsp !== 0);
  if (nonDsp0.length > 0) {
    throw new Error(`Stomp preset has blocks on dsp1 — all blocks must be on dsp0`);
  }
  const maxBlocks = device === "helix_stomp_xl"
    ? STOMP_CONFIG.STOMP_XL_MAX_BLOCKS
    : STOMP_CONFIG.STOMP_MAX_BLOCKS;
  if (spec.signalChain.length > maxBlocks) {
    throw new Error(`Stomp block limit exceeded (${spec.signalChain.length} blocks, max ${maxBlocks})`);
  }
  const maxSnapshots = device === "helix_stomp_xl"
    ? STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS
    : STOMP_CONFIG.STOMP_MAX_SNAPSHOTS;
  if (spec.snapshots.length > maxSnapshots) {
    throw new Error(`Stomp snapshot limit exceeded (${spec.snapshots.length}, max ${maxSnapshots})`);
  }
}
```

### Pattern 6: /api/generate Route Wiring

**What:** Add Stomp device string parsing and route to `buildStompFile()`.

**Key detail:** Stomp outputs `.hlx` — same extension as LT/Floor. Storage key: `latest.hlx`.

```typescript
// route.ts — expand deviceTarget resolution
} else if (device === "helix_stomp") {
  deviceTarget = "helix_stomp";
} else if (device === "helix_stomp_xl") {
  deviceTarget = "helix_stomp_xl";
}

// route.ts — add isStomp() branch in Step 5
if (isStomp(deviceTarget)) {
  const hlxFile = buildStompFile(presetSpec, deviceTarget);
  const summary = summarizeStompPreset(presetSpec, deviceTarget);
  // Persistence: storagePath = `${user.id}/${conversationId}/latest.hlx` (same as LT/Floor)
  // fileExtension: ".hlx"
}
```

### Pattern 7: UI Device Picker Update (page.tsx)

**What:** Add STOMP and STOMP XL to both device picker arrays and all device-aware branches.

**Current state:** Both arrays use `grid-cols-4` with 4 devices. Adding 2 more devices requires `grid-cols-6` or a 2-row layout.

**Known locations to update in page.tsx:**
- Line ~309: `selectedDevice` useState type union
- Line ~652: `generatePreset()` function signature type
- Line ~744: `handleRigGenerate()` function signature type
- Line ~767/804: download suffix switch — add `"_Stomp"` and `"_StompXL"` cases
- Line ~846: `data.device` cast type
- Line ~1282: rig device picker array (currently 4 devices, grid-cols-4)
- Line ~1373: main device picker array (currently 4 devices, grid-cols-4)
- Line ~1433: badge label switch — add "STOMP"/"STOMP XL" cases
- Line ~1546/1556: "Generate for other device" chip logic — currently uses 4-device exclusion

**UI device entry format (follows existing pattern):**
```typescript
{ id: "helix_stomp" as const, label: "STOMP", desc: "HX Stomp" },
{ id: "helix_stomp_xl" as const, label: "STOMP XL", desc: "HX Stomp XL" },
```

**Grid layout:** 4 devices currently use `grid-cols-4`. With 6 devices, use `grid-cols-3 grid-rows-2` or `grid-cols-6` (smaller buttons). The planner should decide grid layout — both are valid.

### Anti-Patterns to Avoid

- **Modifying preset-builder.ts for Stomp:** Risks LT/Floor regressions. Always create a new `stomp-builder.ts`.
- **Using `isHelix()` to detect Stomp:** `isHelix()` currently returns `true` only for `helix_lt` and `helix_floor`. Do NOT expand `isHelix()` to include Stomp — Stomp has different I/O models. Add `isStomp()` separately.
- **Hardcoding snapshot counts in stomp-builder:** Use `STOMP_CONFIG.STOMP_MAX_SNAPSHOTS` / `STOMP_XL_MAX_SNAPSHOTS` — never literals.
- **Using `HD2_AppDSPFlow1Input` for Stomp I/O:** Stomp uses `HelixStomp_AppDSPFlowInput`. Wrong I/O prefix causes preset load failure in HX Edit.
- **Dual-amp Stomp:** Stomp is single DSP. `isDualAmp` check in chain-rules.ts must exclude Stomp (same as Pod Go and Stadium).
- **Forgetting validate.ts `VALID_IDS` update:** `HelixStomp_*` I/O models must be added to the `VALID_IDS` set in `validate.ts` (see `getValidModelIds()` function — it already adds P34_*, P35_* system models manually).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HX Edit file format parsing | Custom JSON parser | Use confirmed values from stomp-device-ids.md | File already inspected; all values documented |
| Device ID discovery | Guessing or computing | Use `2162694` / `2162699` directly | Confirmed from real hardware exports (2026-03-04) |
| Snapshot count detection | Runtime file inspection | Use `STOMP_CONFIG` constants | Hardware spec is fixed, not runtime-discoverable |
| Block limit enforcement | DSP budget calculator | `STOMP_MAX_BLOCKS` / `STOMP_XL_MAX_BLOCKS` constants | Hardware limits are fixed per device model |
| I/O model name discovery | HX Edit binary inspection | Use `HelixStomp_AppDSPFlowInput` etc. | Confirmed from real Stomp .hlx exports |

**Key insight:** Every value needed to implement Phase 39 is already confirmed in `stomp-device-ids.md`. This phase requires zero additional hardware research — the investigation work is complete.

---

## Common Pitfalls

### Pitfall 1: Wrong I/O Model Prefix Causes HX Edit Import Failure

**What goes wrong:** Using `HD2_AppDSPFlow1Input` (LT/Floor) instead of `HelixStomp_AppDSPFlowInput` for Stomp presets. The preset file loads in the wrong UI position or fails import entirely.

**Why it happens:** `preset-builder.ts` hardcodes `HD2_AppDSPFlow1Input`. If `stomp-builder.ts` copies this code without substituting the I/O model, wrong prefix slips through.

**How to avoid:** `stomp-builder.ts` must define its own DSP builder that uses `STOMP_CONFIG.STOMP_INPUT_MODEL` and `STOMP_CONFIG.STOMP_OUTPUT_MAIN_MODEL`. Never import the `buildDsp()` private function from `preset-builder.ts`.

**Warning signs:** HX Edit shows an error on import, or preset loads to a different device than intended.

### Pitfall 2: Forgetting `validate.ts` VALID_IDS for Stomp I/O Models

**What goes wrong:** `validatePresetSpec()` calls `getValidModelIds()` which manually adds system model IDs (HD2_AppDSPFlow*, P34_*, P35_*). If `HelixStomp_*` models are not added here, Stomp presets fail validation with "Invalid model ID" errors even though the builder correctly uses them.

**Why it happens:** `stomp-builder.ts` uses `HelixStomp_AppDSPFlowInput` but `VALID_IDS` doesn't include it. Validation runs before the builder in the generate pipeline.

**How to avoid:** In `getValidModelIds()` in `validate.ts`, add:
```typescript
ids.add("HelixStomp_AppDSPFlowInput");
ids.add("HelixStomp_AppDSPFlowOutputMain");
ids.add("HelixStomp_AppDSPFlowOutputSend");
```

**Warning signs:** `validatePresetSpec()` throws "Invalid model ID 'HelixStomp_AppDSPFlowInput'" during test or generation.

### Pitfall 3: Snapshot Count Mismatch Between Engine and Builder

**What goes wrong:** `snapshot-engine.ts` always generates 4 snapshots (hardcoded), but `stomp-builder.ts` expects 3 (Stomp) or 4 (Stomp XL). Stomp presets get an extra empty snapshot in the JSON, or validate fails with "too many snapshots".

**Why it happens:** `buildSnapshots()` in `snapshot-engine.ts` currently generates a fixed set of snapshots based on `ToneIntent.snapshots` (typically 4). The Stomp path needs to either: (a) truncate snapshots in the builder, or (b) have the generate route pass only N snapshot intents.

**How to avoid:** The cleanest approach: in `/api/generate` route's Stomp branch, truncate `spec.snapshots` to `maxSnapshots` before calling `buildStompFile()`. Alternatively, `buildStompFile()` can internally truncate and fill remaining slots with empty snapshots. Document the chosen approach clearly.

**Warning signs:** Stomp preset has 4 snapshots in JSON when hardware only supports 3 — HX Edit may accept it but display incorrectly.

### Pitfall 4: `isStomp()` Missing from `chain-rules.ts` getDspForSlot

**What goes wrong:** `getDspForSlot()` only checks `isPodGo()` before falling through to DSP-1 assignment for post-amp effects. Stomp blocks end up on `dsp1` even though Stomp is single-DSP. Validation then rejects the preset.

**Why it happens:** Adding a new single-DSP device without updating `getDspForSlot()`.

**How to avoid:** Add `isStomp()` check immediately after `isPodGo()` check in `getDspForSlot()`:
```typescript
if (device && isPodGo(device)) return 0;
if (device && isStomp(device)) return 0; // Stomp: single DSP
```

**Warning signs:** `validatePresetSpec(spec, "helix_stomp")` throws "Stomp preset has blocks on dsp1".

### Pitfall 5: page.tsx Type Union Not Updated

**What goes wrong:** `selectedDevice` useState type is `"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium"`. TypeScript will error on `"helix_stomp"` assignment unless the type union is expanded.

**Why it happens:** The type is inlined at the `useState` call, not imported from `DeviceTarget`. Expanding `DeviceTarget` doesn't automatically expand the page.tsx inline union.

**How to avoid:** Change `useState<"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium">` to use the imported `DeviceTarget` type, or add `"helix_stomp" | "helix_stomp_xl"` to all 4+ locations where the inline union appears in page.tsx.

**Warning signs:** TypeScript error in page.tsx "Type 'helix_stomp' is not assignable to type..."

### Pitfall 6: "Generate for Other Device" Chip Logic

**What goes wrong:** The continuation chip "Generate for [other device]" at line ~1546 currently maps Stomp-family or Stadium to "helix_lt" as the alternate. With 6 devices, the exclusion logic needs updating.

**Why it happens:** The chip currently uses a ternary: if pod_go or stadium → LT, else if LT → Floor, else → LT. Adding Stomp requires extending this logic.

**How to avoid:** Update the otherDevice chip mapping explicitly. Recommended: Stomp/StompXL → "helix_lt", Stadium → "helix_lt", Pod Go → "helix_lt", LT → "helix_floor", Floor → "helix_lt". Label shows the appropriate device name.

---

## Code Examples

Verified patterns from project source and stomp-device-ids.md:

### DSP Structure (single DSP, Stomp I/O models)
```typescript
// Source: stomp-device-ids.md (confirmed from real .hlx files, 2026-03-04)
// dsp0: inputA uses HelixStomp_ prefix
dsp0: {
  inputA: {
    "@input": 1,
    "@model": "HelixStomp_AppDSPFlowInput", // NOT HD2_AppDSPFlow1Input
    noiseGate: true,
    decay: 0.5,
    threshold: -48.0,
  },
  outputA: {
    "@model": "HelixStomp_AppDSPFlowOutputMain", // NOT HD2_AppDSPFlowOutput
    "@output": 1,
    pan: 0.5,
    gain: 0.0,
  },
  // block0, block1, ... cab0
},
dsp1: {}, // Always empty on Stomp — single DSP

// HX Stomp top-level structure (standard .hlx):
{
  "version": 6,
  "data": {
    "device": 2162694,        // helix_stomp (XL: 2162699)
    "device_version": 58720256,
    "meta": { "application": "HX Edit", ... },
    "tone": { "dsp0": {...}, "dsp1": {}, "snapshot0": {...}, "snapshot1": {...}, "snapshot2": {...}, ... }
  },
  "meta": { "original": 0, "pbn": 0, "premium": 0 },
  "schema": "L6Preset",
}
```

### Snapshot Count Handling
```typescript
// HX Stomp: snapshot0, snapshot1, snapshot2 filled; snapshot3-7 empty (@valid: false)
// HX Stomp XL: snapshot0-3 filled; snapshot4-7 empty

// In stomp-builder.ts buildTone():
for (let i = 0; i < 8; i++) {
  const snapshotSpec = i < maxSnapshots ? spec.snapshots[i] : undefined;
  snapshots[`snapshot${i}`] = snapshotSpec
    ? buildSnapshot(snapshotSpec, ...)
    : buildEmptySnapshot(i);
}
// Result: only first N slots @valid: true, rest @valid: false
```

### buildStompFile Public API
```typescript
// src/lib/helix/stomp-builder.ts
export function buildStompFile(
  spec: PresetSpec,
  device: "helix_stomp" | "helix_stomp_xl"
): HlxFile

export function summarizeStompPreset(
  spec: PresetSpec,
  device: "helix_stomp" | "helix_stomp_xl"
): string
```

### route.ts Stomp Branch Pattern
```typescript
// Follows the Stadium/Pod Go pattern exactly
if (isStomp(deviceTarget)) {
  const hlxFile = buildStompFile(presetSpec, deviceTarget as "helix_stomp" | "helix_stomp_xl");
  const summary = summarizeStompPreset(presetSpec, deviceTarget as "helix_stomp" | "helix_stomp_xl");

  if (conversationId) {
    // Same as LT/Floor: storagePath uses latest.hlx
    const storagePath = `${user.id}/${conversationId}/latest.hlx`;
    const fileBuffer = Buffer.from(JSON.stringify(hlxFile));
    // fire-and-forget upload pattern (same as LT/Floor branch)
  }

  return NextResponse.json({
    preset: hlxFile,
    summary,
    spec: presetSpec,
    toneIntent,
    device: deviceTarget,
    fileExtension: ".hlx", // Same as LT/Floor — Stomp uses .hlx
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on Phase 39 |
|--------------|------------------|--------------|---------------------|
| Single device (LT only) | DeviceTarget union — compiler-driven exhaustiveness | Phase 32 (Stadium) | Phase 39 follows same exhaustiveness pattern |
| Stadium: new file format (.hsp, magic header) | Stomp: standard .hlx (no format work needed) | Phase 39 first .hlx device addition since LT/Floor | Stomp is simpler than Stadium — no new format |
| Pod Go: custom builder pattern | Stomp: parameterized HlxFile builder | Phase 15, extended Phase 39 | stomp-builder.ts is the simplest new builder in the project |

**Deprecated/outdated:**
- Nothing deprecated in Phase 39 — purely additive.

---

## Open Questions

1. **Snapshot count: truncate in route or builder?**
   - What we know: `buildSnapshots()` generates 4 snapshots for most devices; Stomp needs 3.
   - What's unclear: Best place to truncate — before calling `buildStompFile()` (in route.ts) or inside the builder.
   - Recommendation: Truncate in the generate route before validation AND in `buildStompFile()` as a safety net. Route passes only N snapshot intents to `buildSnapshots()` call if possible, or truncates the spec. The validator also enforces the limit.

2. **User effect count for Stomp (6-block limit)**
   - What we know: Stomp max 6 blocks total; mandatory blocks are: amp(1) + cab(1) + boost(1) + eq(1) + gain_block(1) = 5. That leaves 1 user effect slot.
   - What's unclear: Should we allow 0-2 user effects (leaving gain block out for tighter presets), or keep mandatory blocks and aggressively cap?
   - Recommendation: Cap at 2 user effects for Stomp (allows omitting gain block when budget is tight), 5 for Stomp XL. Chain-rules enforcement should gracefully truncate rather than throw.

3. **Device picker grid layout**
   - What we know: Currently `grid-cols-4` (4 devices). Adding 2 more → 6 devices.
   - What's unclear: `grid-cols-6` (6 small buttons) vs `grid-cols-3 grid-rows-2` (two rows of 3).
   - Recommendation: `grid-cols-3` with 2 rows (grouping: row 1 = LT/Floor/Stadium, row 2 = Pod Go/Stomp/Stomp XL). Planner decides — either approach is implementable.

4. **`models.ts` getModelsForDevice() / getModelListForPrompt() exhaustiveness**
   - What we know: These functions have branches per DeviceTarget. Stadium added stubs (Phase 32) then real catalog (Phase 33).
   - What's unclear: Stomp uses the same HD2_* model catalog as LT/Floor — no separate Stomp model catalog. `getModelsForDevice("helix_stomp")` should return the same models as `getModelsForDevice("helix_lt")`.
   - Recommendation: Add `isStomp()` branches that return the same HD2_* model list as `isHelix()` branches. No new model catalog needed.

---

## Validation Architecture

> `workflow.nyquist_validation` is false in `.planning/config.json` — this section is skipped per instructions.

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/39-hx-stomp-support/stomp-device-ids.md` — All device IDs, I/O model prefixes, block limits, snapshot counts confirmed from two real .hlx files (HX Stomp + HX Stomp XL), 2026-03-04
- `src/lib/helix/types.ts` — Current DeviceTarget union (4 values), DEVICE_IDS, isHelix/isPodGo/isStadium helpers
- `src/lib/helix/config.ts` — FIRMWARE_CONFIG, POD_GO_FIRMWARE_CONFIG, STADIUM_CONFIG — exact pattern for STOMP_CONFIG
- `src/lib/helix/preset-builder.ts` — Full LT/Floor builder — structural template for stomp-builder.ts
- `src/lib/helix/podgo-builder.ts` — Pod Go single-DSP builder pattern (Stomp most closely mirrors this)
- `src/lib/helix/stadium-builder.ts` — Stadium builder — Phase 39 integration follows same new-builder pattern
- `src/lib/helix/chain-rules.ts` — Complete — shows isPodGo/isStadium device branches to replicate for isStomp
- `src/lib/helix/validate.ts` — Complete — shows podGo/stadium validation branches to extend for Stomp
- `src/app/api/generate/route.ts` — Complete — shows Stadium/Pod Go routing; Stomp adds a third branch
- `src/app/page.tsx` — Device picker arrays at lines 1282 and 1373; all device-type locations enumerated

### Secondary (MEDIUM confidence)
- `.planning/phases/32-type-system-foundation/32-01-PLAN.md` — Full playbook for DeviceTarget exhaustiveness integration
- `.planning/phases/31-device-id-research-floor-fix/stadium-device-id.md` — Stadium reference: similar new-device integration pattern
- `src/lib/helix/index.ts` — Current barrel exports; stomp-builder.ts exports will follow the same convention

### Tertiary (LOW confidence)
- None — all findings from direct project source code + confirmed hardware-exported file data.

---

## Metadata

**Confidence breakdown:**
- Device IDs and file format: HIGH — confirmed from real .hlx hardware exports (stomp-device-ids.md, 2026-03-04)
- Architecture patterns: HIGH — directly mirrored from Pod Go (single-DSP) + Stadium (new device integration)
- Implementation plan: HIGH — TypeScript exhaustiveness approach proved by Phases 32-38
- UI changes: HIGH — exact line numbers identified in page.tsx, grid layout is the only design decision left open
- Pitfalls: HIGH — derived from examining existing code paths and comparing Stomp vs LT/Floor differences

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable domain — hardware specs don't change)
