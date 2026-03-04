# Stack Research

**Domain:** Helix Stadium preset generation for HelixAI v3.0
**Researched:** 2026-03-04
**Confidence:** MEDIUM overall — file format internals are LOW confidence (no public .hsp spec); device architecture and model catalog are HIGH confidence

---

## Scope

This file covers ONLY what is needed to add Helix Stadium support to HelixAI. The validated
existing stack (Next.js 14+, TypeScript, Tailwind CSS, Claude Sonnet 4.6, Supabase, Vercel,
`@anthropic-ai/sdk`, `@supabase/supabase-js`, `@supabase/ssr`) is NOT re-researched.

Stadium support requires investigation of:
1. Whether Stadium uses `.hlx` or a new format (critical: drives the entire implementation)
2. The Stadium device ID (for the preset file header)
3. Whether `preset-builder.ts` can be reused or a new builder is needed
4. What DSP/path architecture differences affect chain-rules.ts
5. Whether any new npm packages are needed

---

## The Single Most Important Finding

**Helix Stadium uses a new `.hsp` file format. It does NOT use `.hlx`.**

This drives everything:
- `preset-builder.ts` cannot be used for Stadium — it outputs `.hlx` (JSON)
- A new `stadium-builder.ts` is required (same pattern as `podgo-builder.ts`)
- The `.hsp` format's internal structure is NOT publicly documented by Line 6
- The `.hsp` device ID is unknown — must be extracted from a real `.hsp` file
- A mandatory investigation step is needed before coding: download a `.hsp` file from
  [Fluid Solo](https://www.fluidsolo.com/) and inspect its format with a hex editor or
  the `file` command

Sources (HIGH confidence, official):
- [Line 6 Helix/HX preset transfers to Helix Stadium](https://line6.com/support/announcement/118-helixhx-preset-transfers-to-helix-stadium/)
- [Line 6 Manuals — Helix Stadium Presets](https://manuals.line6.com/en/helix-stadium/live/presets)

---

## Recommended Stack

### Core Technologies — No Changes

The existing stack requires zero additions for Stadium support at the framework level.
All new work lives inside `src/lib/helix/`.

| Technology | Version | Purpose | Stadium Impact |
|------------|---------|---------|----------------|
| Next.js | 14.x (existing) | App framework | Device selector UI extension only |
| TypeScript | 5.x (existing) | Type safety | New Stadium types in types.ts |
| Tailwind CSS | 3.x (existing) | UI styling | Device selector radio button addition |
| Supabase | existing | Auth + storage | `.hsp` storage alongside `.hlx`/`.pgp` |
| Claude Sonnet 4.6 | existing | AI planner | No change — ToneIntent is device-agnostic |

### Supporting Libraries — Conditional

| Library | Version | Purpose | When to Add |
|---------|---------|---------|-------------|
| `@msgpack/msgpack` | ^3.0.0 | Encode `.hsp` if it is msgpack binary | ONLY add after inspecting a real .hsp file and confirming binary msgpack encoding |

**WARNING — LOW CONFIDENCE on msgpack:** The msgpack evidence comes from the Helix Stadium
editor app's internal model definition file (`p35md-26002601-1_2_0_0.bin`), which is confirmed
as msgpack format. Whether the `.hsp` preset file itself is also msgpack is INFERRED, not
confirmed. The `.hsp` file must be opened and inspected before `@msgpack/msgpack` is added.

If `.hsp` is plain JSON (plausible — `.hlx` and `.pgp` are both plain JSON), then no new npm
package is needed at all.

Source (MEDIUM confidence): [Reverse engineering the Helix Stadium XL editor protocol](https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/)

---

## Installation

```bash
# CONDITIONAL — only add after confirming .hsp is msgpack binary
# If .hsp is plain JSON: add nothing
npm install @msgpack/msgpack
```

---

## Helix Stadium Architecture (HIGH confidence)

Verified from official Line 6 documentation. These facts shape chain-rules.ts and
stadium-builder.ts regardless of what the file format turns out to be.

| Aspect | Helix LT/Floor | Pod Go | Helix Stadium |
|--------|---------------|--------|---------------|
| DSP paths | 2 (dsp0, dsp1) | 1 (dsp0) | 4 (Path 1A, 1B, 2A, 2B) |
| Max blocks/path | ~8-10 (DSP-limited) | 4 user effects hard limit | 12 per path (48 total) |
| Snapshots per preset | 8 | 4 | 8 |
| File format | `.hlx` (JSON) | `.pgp` (JSON) | `.hsp` (binary, likely msgpack — unconfirmed) |
| Editor connection | USB via HX Edit | USB via POD Go Edit | Wi-Fi via Helix Stadium app |
| Model prefix (new) | N/A | N/A | `Agoura_*` (new Agoura engine models) |
| Model prefix (legacy) | `HD2_*` | `P34_*` (I/O models) | `HD2_*` (legacy HX models still present) |
| Amp engine | HX (component-level) | HX (component-level) | Agoura (sub-component) + HX legacy |
| Footswitch mode | Snap/Stomp layout | FS A–F | Up to 10 stomps (FS1–5, FS7–11) |
| Controller stomp FS indices | 7–10 (FS5–FS8) | 0–5 (FS A–F) | TBD — inspect .hsp |
| Snapshot controller ID | 19 | 4 | TBD — inspect .hsp |

Sources:
- [Line 6 Manuals — Signal Path Routing](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — 4-path × 12-block architecture, HIGH confidence
- [Line 6 Manuals — Snapshots](https://manuals.line6.com/en/helix-stadium/live/snapshots) — 8 snapshots per preset, HIGH confidence
- [Line 6 Manuals — Footswitches](https://manuals.line6.com/en/helix-stadium/rev-a-v1.1.0/top-panel-and-footswitches) — stomp layout, MEDIUM confidence

---

## Builder Architecture Decision (HIGH confidence)

The pattern established by Pod Go (`podgo-builder.ts`) is the correct model. Stadium gets
its own builder file:

```
src/lib/helix/
  preset-builder.ts     # Helix LT + Floor → .hlx (JSON)
  podgo-builder.ts      # Pod Go → .pgp (JSON)
  stadium-builder.ts    # NEW: Helix Stadium → .hsp (binary/JSON — TBD)
```

`stadium-builder.ts` responsibilities:
1. Accept a `PresetSpec` (same interface — device-agnostic planner output)
2. Map Stadium-specific block structure (4 paths, path keys TBD from .hsp inspection)
3. Encode to `.hsp` format (JSON.stringify or msgpack encode, depending on format finding)
4. Export `buildHspFile(spec: PresetSpec): Uint8Array | string`

`preset-builder.ts` must NOT be touched for Stadium. It is Helix LT/Floor only.

---

## types.ts Changes Required

Add `"helix_stadium"` to `DeviceTarget`:

```typescript
// Before
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go";

// After
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium";

export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: 2162692,
  pod_go: 2162695,
  helix_stadium: ???,   // MUST be read from a real .hsp file — do NOT guess
};

export function isHelixStadium(device: DeviceTarget): boolean {
  return device === "helix_stadium";
}
```

### Why the Device ID Cannot Be Guessed

The existing Helix LT/Floor device ID (`2162692` = `0x210004`) and Pod Go ID (`2162695` =
`0x210007`) are in the same `0x21000x` range. Helix Stadium is a completely different hardware
platform (different DSP chipset, GPU, FPGA, 64-bit architecture) and may use a different ID
range entirely. Guessing a plausible value and shipping it risks producing .hsp files that the
Stadium app rejects with a wrong-device error. Extract the correct value from a real .hsp file.

---

## config.ts Changes Required

Add a `STADIUM_FIRMWARE_CONFIG` block:

```typescript
// All ??? values must be read from a real .hsp file
export const STADIUM_FIRMWARE_CONFIG = {
  /** Schema version number in .hsp file */
  HSP_VERSION: ???,
  /** Application version integer (encodes firmware version) */
  HSP_APP_VERSION: ???,
  /** Device version integer */
  HSP_DEVICE_VERSION: ???,
  /** Build SHA string — use current stable firmware */
  HSP_BUILD_SHA: "v1.2.1",    // confirmed from official release notes
  /** Application name in meta */
  HSP_APPLICATION: "Helix Stadium",  // likely value — verify from .hsp
} as const;
```

Current stable firmware is **1.2.1** (released January 20, 2026).
Source: [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105)

---

## Model Catalog (MEDIUM confidence)

### Naming Convention

The Helix Stadium editor app's internal model definitions file (`p35md-26002601-1_2_0_0.bin`)
contains entries keyed by model names. Two naming conventions are confirmed:
- `Agoura_AmpWhoWatt103` — new Agoura engine amps
- `HD2_DistDerangedMasterMono` — legacy HX effects

This means:
- Existing `models.ts` `HD2_*` model IDs remain valid for Stadium presets using legacy models
- New Agoura amp models need a new `STADIUM_AMP_MODELS` catalog (or `AGOURA_AMP_MODELS`) with `Agoura_*` IDs
- The `HD2_*` prefix convention for effect blocks (delay, reverb, distortion, modulation, etc.) carries over to Stadium

### Amp Catalog Size

| Category | Count | Notes |
|----------|-------|-------|
| Agoura guitar amp channels | 43+ | 16 at launch + 7 in FW 1.2 + more planned |
| Agoura bass amp channels | 6+ | 6 at launch |
| HX legacy amp channels | 111 | Same as Helix LT/Floor |
| Total | 161 | As of FW 1.2.1 |

Source: [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105)

### Effect Model Availability

The Helix Stadium effect model list is a superset of Helix LT/Floor:
- All legacy `HD2_*` effects are available (under "Legacy" subcategory)
- New Mono/Stereo versions of effects are added (similar to Pod Go's Mono/Stereo suffix convention)
- Stadium-exclusive EQ: 7-band Parametric EQ replaces Simple EQ, Low/High Cut, Low/High Shelf, and 5-band Parametric
- The four deprecated EQ types must NOT be used in Stadium presets

Source: [Line 6 Helix/HX preset transfers to Helix Stadium](https://line6.com/support/announcement/118-helixhx-preset-transfers-to-helix-stadium/)

---

## chain-rules.ts Changes Required

A new device branch for `"helix_stadium"` with these constraints:

| Rule | Value | Source |
|------|-------|--------|
| Max blocks per path | 12 | Official — Signal Path manual |
| DSP path count | 4 | Official — Signal Path manual |
| Snapshots | 8 | Official — Snapshots manual |
| Dual amp topology | Supported (parallel paths) | Inferred from 4-path architecture |
| Noise gate | TBD | Inspect .hsp |
| Snapshot controller ID | TBD | Inspect .hsp |
| Stomp FS indices | TBD | Inspect .hsp |

For HelixAI's single-path presets (typical use case), Path 1A (dsp0-equivalent) is sufficient.
Start with single-path generation and add multi-path only when needed for dual-amp.

---

## Helix Floor Device ID Fix (Existing Bug)

The `PROJECT.md` notes a regression: `types.ts` has `helix_floor: 2162692` but a test expects
`2162691`. This is a separate issue from Stadium but should be resolved in the same milestone
since both involve `DEVICE_IDS`. The correct value must be verified by inspecting a real Helix
Floor `.hlx` file (look for the `"device"` field in the JSON).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| New `stadium-builder.ts` | Extend `preset-builder.ts` | Never — formats are incompatible. preset-builder.ts outputs .hlx JSON. Stadium requires .hsp (different format entirely). |
| `@msgpack/msgpack` | `msgpackr` | msgpackr is fastest but overkill for preset file generation. @msgpack/msgpack has native TypeScript types. Either works if msgpack is confirmed. |
| `@msgpack/msgpack` | `msgpack-lite` | msgpack-lite is unmaintained and slower — do not use |
| Separate Stadium model catalog | Merge Stadium + Helix into one catalog | Keep separate: Agoura models only work on Stadium, HD2 models work on both. A merged catalog would require device-filtering on every model lookup. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `preset-builder.ts` for Stadium output | Outputs `.hlx` JSON — Stadium requires `.hsp` (different format) | New `stadium-builder.ts` |
| `msgpack-lite` | Unmaintained, no native TypeScript types, slower than alternatives | `@msgpack/msgpack` ^3.0.0 if msgpack is needed |
| Guessed device ID | Wrong device ID causes Stadium app to reject presets | Extract from real .hsp file |
| Deprecated EQ models (Simple EQ, Low/High Cut, Low/High Shelf, 5-band Parametric) in Stadium presets | Not present in Stadium — auto-converted but sound different | 7-band Parametric EQ (`HD2_EQ_Parametric7Band` or equivalent Stadium model ID) |
| Using HD2_ snapshot controller ID (19) for Stadium without verification | Stadium may use a different controller ID — Pod Go changed from 19 to 4 | Inspect real .hsp file for correct ID |

---

## Stack Patterns by Variant

**If `.hsp` is plain JSON (like `.hlx`):**
- No new npm packages
- `stadium-builder.ts` outputs `JSON.stringify(obj)` with `.hsp` extension
- API route returns `application/json` (or `application/octet-stream` — check what Stadium app expects)
- Same download handler pattern as `.hlx`

**If `.hsp` is msgpack binary:**
- Add `@msgpack/msgpack` ^3.0.0
- `stadium-builder.ts` uses `encode(obj)` from `@msgpack/msgpack` to produce `Uint8Array`
- API route returns `application/octet-stream`
- Download handler: `new Blob([uint8array], { type: 'application/octet-stream' })`
- File extension: `.hsp`

**If `.hsp` is a ZIP container (less likely but possible):**
- Add `fflate` or `jszip`
- Unlikely based on community reports — check first

---

## Mandatory Pre-Implementation Checklist

Before writing `stadium-builder.ts`, a developer must:

1. Download a real `.hsp` preset file from [Fluid Solo](https://www.fluidsolo.com/) or the
   Helix Stadium app
2. Open it with `xxd file.hsp | head -20` to check the first bytes:
   - `7b 22` = `{"` = JSON
   - `82`, `83`, `84` etc. = msgpack fixmap header (binary)
   - `50 4b 03 04` = ZIP header
3. If JSON: decode normally, extract `device`, `version`, `data.device_version`, `schema` fields
4. If msgpack: install `@msgpack/msgpack`, run `decode(fs.readFileSync('file.hsp'))`, extract same fields
5. Confirm the `schema` field value (likely `"L6Preset"` but may differ from Stadium)
6. Record the `device` integer — this is `DEVICE_IDS.helix_stadium`
7. Record `version`, `data.device_version`, and `data.meta.appversion`
8. Inspect block structure: confirm path keys (`path1a`? `dsp0`? `path0a`?), input/output model names
9. Inspect snapshot structure: confirm `@controller` value for snapshot recall
10. Inspect footswitch structure: confirm FS index range

This checklist is the critical path for the entire Stadium implementation.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@msgpack/msgpack` ^3.0.0 | Node.js 14+, modern browsers, Vercel serverless | Add only if .hsp confirmed as msgpack |
| Existing `types.ts` | Stadium via union extension | Add `"helix_stadium"` to `DeviceTarget` |
| `models.ts` HD2_ entries | Stadium legacy-model presets | Valid for HX models; Agoura models need new catalog entries |
| `chain-rules.ts` | Stadium via new device branch | Do not modify existing Helix or Pod Go branches |

---

## Sources

- [Line 6 Helix/HX preset transfers to Helix Stadium](https://line6.com/support/announcement/118-helixhx-preset-transfers-to-helix-stadium/) — .hsp format name, one-way conversion, HIGH confidence (official)
- [Line 6 Manuals — Helix Stadium Presets](https://manuals.line6.com/en/helix-stadium/live/presets) — .hsp format, 512 preset locations, HIGH confidence (official)
- [Line 6 Manuals — Signal Path Routing](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — 4-path × 12-block architecture, HIGH confidence (official)
- [Line 6 Manuals — Snapshots](https://manuals.line6.com/en/helix-stadium/live/snapshots) — 8 snapshots per preset, HIGH confidence (official)
- [Helix Stadium 1.2.1 Release Notes](https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105) — firmware v1.2.1 (Jan 20 2026), 161 total amps, HIGH confidence (official)
- [ilikekillnerds.com — Reverse engineering the Helix Stadium XL editor protocol](https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/) — p35 device prefix, Agoura_* model naming, msgpack model defs file, MEDIUM confidence (community reverse engineering)
- [Line 6 Helix Stadium Models](https://line6.com/helix-stadium-models/) — amp/effect model catalog overview, HIGH confidence (official)
- [Fluid Solo — Helix Stadium](https://www.fluidsolo.com/) — community source of real .hsp files for inspection, MEDIUM confidence
- [Sweetwater — Line 6 Helix Stadium Editor/Librarian App Guide](https://www.sweetwater.com/sweetcare/articles/line-6-helix-stadium-editor-librarian-app-guide/) — Wi-Fi connection architecture, MEDIUM confidence
- `@msgpack/msgpack` npm — [npmjs.com](https://www.npmjs.com/package/@msgpack/msgpack) — library details, HIGH confidence

---

*Stack research for: HelixAI v3.0 — Helix Stadium device support*
*Researched: 2026-03-04*
