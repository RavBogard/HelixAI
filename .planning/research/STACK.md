# Stack Research

**Domain:** Pod Go preset generation — adding Line 6 Pod Go (.pgp) support to existing HelixAI app
**Researched:** 2026-03-02
**Confidence:** MEDIUM (Pod Go file format is undocumented officially; findings synthesized from community reverse-engineering, converter source analysis, official firmware release notes, and the existing .hlx codebase)

---

## Scope

This document covers ONLY what is needed to add Pod Go support. The existing validated stack (Next.js, TypeScript, Tailwind CSS, Claude Sonnet 4.6, `@anthropic-ai/sdk`, Zod, Vitest, Vercel) is NOT re-researched here.

---

## Recommended Stack

### Core Technologies

No new npm packages are needed. Pod Go support requires pure TypeScript changes to the existing `src/lib/helix/` module, a new `src/lib/podgo/` module mirroring it, and a new `DeviceTarget` variant.

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript (existing) | 5.x (already installed) | Pod Go model registry, chain rules, preset builder | All logic is pure data transformation — no new runtime dependencies needed |
| Zod (existing) | 4.x (already installed) | `ToneIntentSchema` extension for Pod Go device target | Already used for ToneIntent structured output; add `"pod_go"` to the `DeviceTarget` enum |
| Vitest (existing) | 3.x (already installed) | Unit tests for Pod Go chain-rules and preset-builder | Already covers helix module with same pattern |

### Supporting Libraries

None. This is a pure knowledge-layer expansion, not a new library dependency.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| POD Go Edit 2.50 (offline, free) | Generate real .pgp files for format validation | Download from line6.com; export presets and inspect JSON to verify builder output field-by-field. Same workflow used for .hlx audit |
| VS Code JSON diff (no install) | Compare AI-generated .pgp against POD Go Edit exports | Use VS Code's built-in JSON formatter and diff view on `.pgp` files |

---

## Pod Go File Format

### File Extension and Encoding

Pod Go presets use the `.pgp` extension. The file is **plain JSON text** (not binary, not zlib-compressed at the file level — unlike `.pgb` backup bundles which ARE zlib-compressed). A `.pgp` file can be opened directly in any text editor.

**Confidence: MEDIUM** — Confirmed by multiple community sources reporting Notepad-editable JSON. The internal structure below is synthesized from the forum thread at line6.com/support/topic/63502, the JSON hacking thread at line6.com/support/topic/64399, and the converter project at github.com/Zavsek/POD_GO-Helix_converter. No official Line 6 schema documentation exists.

### Top-Level JSON Structure

The `.pgp` format is structurally very similar to `.hlx`. The community consensus is "nearly the same format with different file extension." The critical structural difference is that `.pgp` uses **only `dsp0`** — there is no `dsp1`.

```json
{
  "version": 6,
  "data": {
    "device": <integer device ID>,
    "device_version": <integer firmware version>,
    "meta": {
      "name": "Preset Name",
      "application": "POD Go Edit",
      "build_sha": "v2.50",
      "modifieddate": <unix timestamp>,
      "appversion": <integer>
    },
    "tone": {
      "dsp0": {
        "inputA": { "@input": 1, "@model": "HD2_AppDSPFlow1Input", ... },
        "outputA": { "@model": "HD2_AppDSPFlowOutput", "@output": 1, ... },
        "block0": { "@model": "HD2_DistKlon", "@position": 0, "@enabled": true, ... },
        "block1": { ... },
        "cab0":   { "@model": "HD2_Cab1x12USDeluxe", "@enabled": true, "@mic": 0, ... }
      },
      "snapshot0": { "@name": "CLEAN", "@tempo": 120, "@valid": true, ... },
      "snapshot1": { "@name": "RHYTHM", ... },
      "snapshot2": { "@name": "LEAD", ... },
      "snapshot3": { "@name": "AMBIENT", ... },
      "controller": { "dsp0": {} },
      "footswitch": { "dsp0": {} },
      "global": { "@model": "@global_params", "@topology0": "A", "@tempo": 120, ... }
    }
  },
  "meta": { "original": 0, "pbn": 0, "premium": 0 },
  "schema": "L6Preset"
}
```

**Key difference from .hlx:** The `HlxTone` in `.hlx` has `dsp0` + `dsp1` + `snapshot0..7`. The `.pgp` equivalent has `dsp0` ONLY + `snapshot0..3` (4 snapshots, not 8).

### Device ID

The `data.device` integer identifies the hardware. For Helix, `types.ts` already has:
```typescript
export const DEVICE_IDS = {
  helix_lt:    2162692,
  helix_floor: 2162688,
};
```

Pod Go device IDs are **not officially documented**. Based on the sequential numbering pattern in the existing Helix IDs and community-reported structure similarity, the Pod Go device ID is expected to be in the same numeric family. **This must be verified by inspecting an actual `.pgp` file exported from POD Go Edit before shipping.** Until verified, use a placeholder and document it as requiring validation.

**Action item:** Export one preset from POD Go Edit 2.50, open in text editor, read the `data.device` integer value. Update `DEVICE_IDS` in `types.ts` (or a new `pod-go/types.ts`) with the real value.

---

## Pod Go DSP Architecture

### Single DSP, Serial Signal Path

| Constraint | Value | Helix LT Equivalent | Source |
|------------|-------|---------------------|--------|
| DSP count | 1 | 2 | FAQ, community unanimous |
| Parallel routing | No (serial only) | Yes (SABJ topology) | Line 6 FAQ, multiple forum confirmations |
| Split/join blocks | Not available | Available | FAQ |
| Topology options | "A" only | "A", "AB", "SABJ" | Follows from serial-only architecture |

### Block Structure: Fixed + Flexible

The Pod Go has **10 total blocks** per preset, split into fixed and flexible categories:

| Category | Count | Block Types | Notes |
|----------|-------|-------------|-------|
| Fixed (mandatory) | 6 | Wah, Volume/Expression, FX Loop, Amp/Preamp, Cab/IR, Preset EQ | Always present in signal chain; cannot be removed through normal UI. JSON-hacking can remove them but causes display glitches |
| Flexible (user-assignable) | 4 | Any HX effect type: Distortion, Dynamics, EQ, Modulation, Delay, Reverb, Pitch/Synth, Filter, Looper | Freely chosen from the full model library |

**Total non-cab, non-fixed blocks available for effects: 4.** This is the critical constraint vs. Helix LT's 8 blocks per DSP across two DSPs.

**Source confidence: HIGH** — Pod Go FAQ states "Up to 4 additional effects (any HX type)" explicitly. Multiple forum threads confirm 10 total blocks (6 fixed + 4 flexible).

### Signal Chain Order

Pod Go enforces a **semi-fixed serial order** — you choose the model in each position, but the position categories are fixed:

```
[Input/Noise Gate] → [Wah] → [Distortion/Dynamics flex slots] → [Amp] → [Cab/IR] → [EQ flex slots] → [Modulation/Delay/Reverb flex slots] → [Volume] → [FX Loop] → [Output]
```

The flexible blocks slot into specific zones. Unlike Helix, you cannot place a reverb before the amp.

**Implication for chain-rules.ts:** The existing `assembleSignalChain()` function places effects across DSP0 and DSP1. For Pod Go, all blocks go to `dsp: 0`, and the total non-cab non-fixed effect block count must not exceed 4. The mandatory Parametric EQ and Gain Block on DSP1 in the Helix chain do NOT exist as separate blocks on Pod Go (EQ is a fixed built-in position).

### DSP Power Limits

Pod Go's single DSP chip is powerful enough for the standard 4 effects + amp + cab, but DSP-intensive combinations can hit the ceiling. Line 6 prevents overloading by graying out unavailable models at the hardware level — the file format does not encode "DSP usage percentage" explicitly.

**Models confirmed unavailable on Pod Go due to DSP cost:**
- **Poly Pitch** — too DSP-intensive
- **Space Echo** — too DSP-intensive
- Some newer oversampled amp algorithms added post-Helix 3.5 may not be available

**Confidence: MEDIUM** — Confirmed by community sources; no official exhaustive "not available on Pod Go" list from Line 6.

---

## Snapshot Capabilities

| Feature | Pod Go | Helix LT |
|---------|--------|----------|
| Snapshots per preset | **4** (snapshot0–snapshot3) | 8 (snapshot0–snapshot7) |
| Footswitch mode for snapshots | Snapshot mode: 4 footswitches (A, B, C, D) | Snapshot mode: 8 footswitches |
| Per-snapshot block bypass states | Yes | Yes |
| Per-snapshot parameter overrides | Yes (up to 64 parameters) | Yes |
| Snapshot + stomp hybrid mode | Yes (2 snapshots on A/B + 4 stomps on FS1–FS4) | Yes |
| LED colors | Yes (same `@ledcolor` integer encoding) | Yes |

**Implication for snapshot-engine.ts:** `buildSnapshots()` currently generates 8 snapshots. For Pod Go, generate exactly 4. The `ToneIntentSchema` already enforces `min(4).max(4)` for snapshots — this constraint happens to be correct for Pod Go too. No schema change needed.

**Source confidence: HIGH** — Line 6 FAQ explicitly states 4 snapshots per preset. Owner's Manual v1.10 confirms A/B/C/D footswitch layout for snapshot mode.

---

## Footswitch Layout

Pod Go footswitch layout differs from Helix LT:

| Mode | Pod Go | Helix LT |
|------|--------|----------|
| Stomp mode | FS1–FS6 (6 stomps) | FS5–FS8 (4 stomps) |
| Snapshot mode | A, B, C, D (4 footswitches) | FS1–FS8 (8 footswitches) |
| Hybrid (snap+stomp) | 2 snapshots on A/B, 4 stomps on FS1–FS4 | Various configurations |

**Implication for preset-builder.ts:** The `STOMP_FS_INDICES` constant in `buildFootswitchSection()` is currently `[7, 8, 9, 10]` (FS5–FS8, Helix LT stomp layout). For Pod Go, stomp footswitch indices are 1–6. The footswitch section builder needs a device-specific `STOMP_FS_INDICES` variant.

**Source confidence: MEDIUM** — Footswitch indices within the JSON are reverse-engineered (not officially documented). The `@fs_index` values used in the forum-confirmed JSON structure use integers 1–6 for Pod Go stomps. Verify against a real `.pgp` file export.

---

## Model Availability: Pod Go vs Helix LT

### Shared Models (HIGH confidence)

Pod Go shares the **same HD2_ model ID naming convention** as Helix. Most amp and effect models from the Helix library are available on Pod Go. Both devices run the HX modeling engine.

As of firmware 2.50 (January 2025), Pod Go has:
- 105+ amp models (guitar + bass) — roughly equivalent to Helix LT
- 80+ cab models
- 200+ effects models
- All standard amp models from Helix (Fender, Marshall, Mesa, Vox, etc.)

### Models NOT Available on Pod Go (MEDIUM confidence)

| Model / Category | Reason Unavailable | Helix LT Has It? |
|-----------------|--------------------|------------------|
| Poly Pitch | Too DSP-intensive for single chip | Yes |
| Space Echo (delay) | Too DSP-intensive | Yes |
| Some Line 6 Original amps added post-1.0 | Not all Helix originals ported | Yes |
| 2x oversampling for amp algorithms | Pod Go DSP cannot accommodate oversampling added in Helix FW 3.5 | Yes (post-3.5) |
| Parallel routing blocks (HD2_SplitAB, HD2_MergerMixer) | No parallel path architecture | Yes |
| `HD2_AppDSPFlow2Input` (DSP1 input) | No DSP1 on Pod Go | Yes |

### Key Implication for models.ts

The current `models.ts` is a Helix model registry. For Pod Go, we need a **Pod Go model subset registry** that:
1. Excludes DSP-intensive models unavailable on Pod Go (Poly Pitch, Space Echo)
2. Excludes models that require DSP1 (none in the current small registry)
3. Has the same `HD2_*` model IDs — the IDs are the same hardware, just a subset

**Approach:** Create `src/lib/podgo/models.ts` that re-exports from the Helix models with a `POD_GO_UNAVAILABLE` exclusion set, OR add a `deviceAvailability` field to `HelixModel` in the existing `models.ts`. The latter is cleaner for long-term maintenance.

---

## Code Changes Required

### New Files (Recommended Architecture: Mirror Pattern)

Create a `src/lib/podgo/` module mirroring `src/lib/helix/`:

```
src/lib/podgo/
  types.ts          — PgpFile interface, PodGoDeviceTarget, PodGoTone (4 snapshots, dsp0 only)
  models.ts         — Pod Go model subset (re-export from helix/models.ts with exclusions)
  chain-rules.ts    — Pod Go chain assembly (single DSP, 4 max effects, semi-fixed order)
  preset-builder.ts — buildPgpFile(spec: PresetSpec) → PgpFile
  config.ts         — Pod Go firmware version config (device ID, app version)
  index.ts          — Public API exports
```

### Changes to Existing Files

| File | Change | Rationale |
|------|--------|-----------|
| `src/lib/helix/types.ts` | Add `"pod_go"` and `"pod_go_wireless"` to `DeviceTarget` union | Single source of truth for device targeting |
| `src/lib/helix/types.ts` | Add `deviceAvailability?: DeviceTarget[]` field to `HelixModel` | Tag models as available/unavailable per device |
| `src/lib/helix/models.ts` | Mark DSP-intensive models (Poly Pitch, Space Echo) with `deviceAvailability: ["helix_lt", "helix_floor"]` (not pod_go) | Drives validation in Pod Go chain-rules |
| `src/app/api/generate/route.ts` | Accept `device: "helix_lt" | "helix_floor" | "pod_go"` in request body | Route to correct builder |
| `src/lib/helix/tone-intent.ts` | ToneIntentSchema: snapshots already `min(4).max(4)` — no change needed for Pod Go compatibility | Existing constraint is correct |

### New Types Required

```typescript
// In src/lib/podgo/types.ts

export interface PgpFile {
  version: number;           // Same as HlxFile.version (value: 6)
  data: {
    device: number;          // Pod Go device ID (verify from real .pgp export)
    device_version: number;  // Firmware version integer
    meta: HlxMeta;           // Same structure as Helix
    tone: PodGoTone;         // Simplified tone — dsp0 only, 4 snapshots
  };
  meta: { original: number; pbn: number; premium: number };
  schema: "L6Preset";        // Same schema identifier as Helix
}

export interface PodGoTone {
  dsp0: HlxDsp;              // Re-use HlxDsp — same block structure
  snapshot0: HlxSnapshot;
  snapshot1: HlxSnapshot;
  snapshot2: HlxSnapshot;
  snapshot3: HlxSnapshot;   // 4 snapshots max (vs 8 for Helix)
  controller: HlxControllerSection;
  footswitch: Record<string, unknown>;
  global: PodGoGlobal;
}

export interface PodGoGlobal {
  "@model": "@global_params";
  "@topology0": "A";         // Serial only — no "AB" or "SABJ" options
  "@cursor_dsp": 0;          // Always DSP0
  "@cursor_path": number;
  "@cursor_position": number;
  "@cursor_group": string;
  "@tempo": number;
  "@current_snapshot": number;
  "@pedalstate": number;
}

export type PodGoDeviceTarget = "pod_go" | "pod_go_wireless";
```

### Chain Rules Differences (src/lib/podgo/chain-rules.ts)

The Helix chain-rules.ts splits effects across DSP0 and DSP1 with `MAX_BLOCKS_PER_DSP = 8`. The Pod Go chain-rules must:

1. **All blocks on DSP0** — no DSP1 assignment
2. **MAX_FLEXIBLE_BLOCKS = 4** — at most 4 non-fixed effects (no separate EQ slot, no Gain Block at end)
3. **No Parametric EQ mandatory insert** — Pod Go has a built-in fixed EQ block; do not insert an extra one
4. **No Gain Block mandatory insert** — Volume is a fixed block on Pod Go
5. **Boost (Minotaur/Scream 808) still valid** — counts as one of the 4 flexible effect slots
6. **No Horizon Gate for high-gain by default** — only 4 slots; let the AI choose whether to use one
7. **Semi-fixed slot order** — enforce signal chain ordering: drives → amp → cab → modulation → delay → reverb

```typescript
// In src/lib/podgo/chain-rules.ts
const MAX_FLEXIBLE_EFFECTS = 4;  // Hard limit enforced by Pod Go hardware

// DSP assignment: everything goes to dsp0
function getDspForBlock(): 0 { return 0; }

// No DSP1 mandatory blocks (no Parametric EQ, no Gain Block)
// Boost is still inserted but counts toward the 4-block limit
```

### Preset Builder Differences (src/lib/podgo/preset-builder.ts)

```typescript
// Key differences from src/lib/helix/preset-builder.ts:

// 1. Output type: PgpFile instead of HlxFile
export function buildPgpFile(spec: PresetSpec, device: PodGoDeviceTarget = "pod_go"): PgpFile

// 2. Tone structure: 4 snapshots (snapshot0–snapshot3) not 8
// 3. No dsp1 — only dsp0 built
// 4. Footswitch indices: Pod Go uses @fs_index 1–6 (not 7–10 like Helix LT)
const POD_GO_STOMP_FS_INDICES = [1, 2, 3, 4];  // FS1–FS4 (4 stomps in hybrid mode)

// 5. Global topology: "@topology0": "A" only (hardcoded, not configurable)
// 6. File extension for download: ".pgp" not ".hlx"
```

---

## Libraries and Tools for Pod Go Preset Manipulation

### Existing Tools (External)

| Tool | URL | Status | Usefulness |
|------|-----|--------|------------|
| POD Go Edit 2.50 (Line 6 official) | line6.com/software | Active, free | CRITICAL for validating generated .pgp files |
| Zavsek/POD_GO-Helix_converter | github.com/Zavsek/POD_GO-Helix_converter | Electron app, "simple mockup", outdated | LOW — source code reveals format clues but converter is not production-ready |
| sj-williams/pod-go-patches | github.com/sj-williams/pod-go-patches | Small collection of .pgp patches | MEDIUM — actual .pgp files to inspect JSON structure |
| dbagchee/helix-preset-viewer | github.com/dbagchee/helix-preset-viewer | Browser-based .hlx viewer | LOW — .hlx only, but reveals .hlx JSON structure useful for comparison |
| benvesco.com/store/helix-dsp-allocations | benvesco.com/store/helix-dsp-allocations | Third-party, community-maintained | MEDIUM — Pod Go DSP cost percentages per model |

### No npm Package Exists

There is no published npm library for Pod Go preset manipulation. The format is undocumented by Line 6 and the community has only produced a few one-off converters/editors. HelixAI will implement the format directly, as it did for `.hlx`.

---

## Installation

```bash
# No new packages required for Pod Go support.
# All implementation is pure TypeScript in src/lib/podgo/.
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Mirror pattern (new `src/lib/podgo/` module) | Modify existing `src/lib/helix/` with device flags | Pod Go and Helix differ enough in architecture (single vs dual DSP, 4 vs 8 snapshots, fixed blocks) that a shared module would require pervasive `if (device === "pod_go")` branching. Mirror pattern keeps both modules clean and independently testable |
| Verify device ID from real .pgp export | Hardcode a guessed device ID | Pod Go device ID is unconfirmed. Using a wrong device ID may prevent the file from loading in POD Go Edit. Must be verified empirically |
| 4 flexible effect blocks maximum | Allow 6+ effects matching Helix capacity | Pod Go hardware enforces this limit. Generating more than 4 flexible effects creates a preset that is either invalid or requires DSP headroom that may not exist |
| All blocks on dsp0, serial only | Attempt dual-path routing | Pod Go has no dsp1 and no split/join blocks. Attempting parallel routing in a .pgp file would produce an invalid preset |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Generating dsp1 blocks in .pgp files | Pod Go has no DSP1 — including a dsp1 section in the JSON will likely cause POD Go Edit to reject the file or display incorrectly | Only generate dsp0 |
| More than 4 flexible effect blocks | Pod Go hardware limit: 4 flexible FX slots. Exceeding this causes DSP overload or invalid presets | Enforce `MAX_FLEXIBLE_EFFECTS = 4` in chain-rules |
| Using HlxTone type for Pod Go tone | HlxTone has 8 snapshots (snapshot0–snapshot7) and dsp1 — structurally wrong for Pod Go | Use PodGoTone type with 4 snapshots and dsp0 only |
| Poly Pitch or Space Echo model IDs in Pod Go presets | These models are too DSP-intensive for Pod Go's single chip | Use standard modulation/delay alternatives |
| Assuming "@topology0": "AB" or "SABJ" works on Pod Go | Pod Go is serial-only; only "A" topology is valid | Always write "@topology0": "A" for Pod Go |
| Reusing Helix LT device ID (2162692) for Pod Go | Device IDs are device-specific; POD Go Edit validates the device field | Verify and use the correct Pod Go device ID from a real export |

---

## Stack Patterns by Variant

**If generating a Pod Go preset:**
- Use `src/lib/podgo/chain-rules.ts` — Pod Go-specific block limits and DSP assignment
- Use `src/lib/podgo/preset-builder.ts` to output `.pgp` JSON
- Set download filename to `{presetName}.pgp`
- Cap effects at 4 flexible blocks before the AI prompt even runs (chain-rules enforces this)
- Use only the 4-snapshot ToneIntent output (already enforced by existing schema)

**If generating a Helix preset (existing behavior):**
- Use `src/lib/helix/chain-rules.ts` — unchanged
- Use `src/lib/helix/preset-builder.ts` to output `.hlx` JSON
- Set download filename to `{presetName}.hlx`

**If a model is in the Helix registry but not Pod Go:**
- Tag in `models.ts` with `deviceAvailability` exclusion
- Pod Go chain-rules throws a validation error if that model is selected
- AI prompt for Pod Go should not list unavailable models (provide a Pod Go-specific model list)

---

## Version Compatibility

| Component | Compatibility | Notes |
|-----------|---------------|-------|
| POD Go Edit 2.50 | Target for .pgp validation | Firmware 2.50 (January 2025) is current. Generated .pgp files should target 2.50 schema |
| HX model IDs (HD2_*) | Same naming convention as Helix | Pod Go and Helix share model IDs — HD2_AmpUSDeluxeNrm works on both devices |
| .pgp schema version | Expected: `"version": 6` | Matches .hlx version 6 (Helix FW 3.70). Verify from real .pgp export |
| Snapshot count | 4 for Pod Go | ToneIntentSchema already enforces `min(4).max(4)` — no schema change needed |

---

## Critical Unknowns (Must Verify Before Shipping)

These items cannot be resolved from web research alone and require hands-on verification with POD Go Edit:

1. **Pod Go device ID integer** — Read `data.device` from a real `.pgp` export. Without this, the preset file cannot be created correctly.

2. **Exact `device_version` encoding** — The `HLX_APP_VERSION` for Helix FW 3.70 is `57671680`. Pod Go FW 2.50 uses a different encoding. Read `data.device_version` from a real `.pgp` export.

3. **Footswitch index values** — The `.pgp` `@fs_index` integers for Pod Go stomps (FS1–FS6) need verification. Helix uses 7–10 for FS5–FS8. Pod Go likely uses 1–6 but must be confirmed.

4. **`@topology0` value** — Confirm that Pod Go `.pgp` writes `"A"` only (not a different token).

5. **Snapshot section naming** — Confirm `snapshot0`–`snapshot3` (4 keys) vs. any other convention.

6. **Does `.pgp` include `dsp1` as an empty object or omit it entirely?** — Some formats include empty sections, others omit them. POD Go Edit may be strict about this.

**Recommended first step:** Before writing any new code, export 2–3 presets from POD Go Edit 2.50, open in VS Code, and document the exact JSON structure. This is the fastest path to HIGH confidence on all six unknowns above.

---

## Sources

- [Line 6 Community: File formats, custom tools and API](https://line6.com/support/topic/63502-fileformats-custom-tools-and-api/) — Confirms .pgp is JSON, describes .pgb structure (zlib), dsp0-only (MEDIUM confidence)
- [Line 6 Community: Pod Go FAQ](https://line6.com/support/topic/53806-pod-go-faq/) — Block architecture (6 fixed + 4 flexible), snapshot support, single DSP (HIGH confidence)
- [Line 6 Community: Pod Go Block Restrictions](https://line6.com/support/topic/62007-pod-go-block-restrictions/) — 10 total blocks, 4 user-assignable (HIGH confidence)
- [Line 6 Community: Is JSON hacking safe?](https://line6.com/support/topic/64399-is-json-hacking-safe/) — Confirms JSON editability, footswitch section structure (MEDIUM confidence)
- [Line 6 Community: Hack with no Amp, Cab or EQ](https://line6.com/support/topic/63601-hack-with-no-amp-cab-or-eq/) — Confirms JSON structure can be edited to remove fixed blocks (MEDIUM confidence)
- [Line 6 Pod Go Models Page](https://line6.com/podgo-models/) — 89+ amp models, 80+ cabs, 200+ effects as of 2.50 (HIGH confidence)
- [Line 6 Pod Go 2.50 Release Notes](https://line6.com/support/page/kb/pod/pod-go/pod-go-250-r1085/) — New models list, firmware date (HIGH confidence)
- [Pod Go vs Helix LT community discussion](https://line6.com/support/topic/56025-pod-go-vs-helix-lt/) — No parallel routing, serial only, single DSP (HIGH confidence)
- [Pod Go DSP Allocations (benvesco.com)](https://benvesco.com/store/helix-dsp-allocations/) — DSP cost percentages, fixed block overhead explanation (MEDIUM confidence — third-party)
- [GitHub: Zavsek/POD_GO-Helix_converter](https://github.com/Zavsek/POD_GO-Helix_converter) — Electron app confirming .pgp↔.hlx format similarity and TypeScript-based conversion (MEDIUM confidence)
- [GitHub: sj-williams/pod-go-patches](https://github.com/sj-williams/pod-go-patches) — Real .pgp files available for format inspection (MEDIUM confidence)
- [Line 6 Community: Blocks DSP requirements overview](https://line6.com/support/topic/61457-blocks-dsp-requirements-overview/) — DSP behavior at capacity, effect greying-out mechanism (HIGH confidence)
- Existing `src/lib/helix/` codebase — `types.ts`, `preset-builder.ts`, `chain-rules.ts`, `models.ts` — ground truth for what must be mirrored/adapted (HIGH confidence)

---

*Stack research for: Pod Go preset generation support (HelixAI v2 milestone)*
*Researched: 2026-03-02*
