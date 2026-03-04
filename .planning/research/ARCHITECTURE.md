# Architecture Research

**Domain:** Helix Stadium device extension — v3.0 addition to existing HelixAI preset generator
**Researched:** 2026-03-04
**Confidence:** HIGH for existing codebase analysis; MEDIUM for Stadium .hsp format (not publicly documented); HIGH for DSP/routing constraints (official Line 6 manuals)

---

## Context: What This Document Covers

This document covers the v3.0 Helix Stadium milestone only. It answers:

- Whether Helix Stadium reuses `preset-builder.ts` or needs a new `stadium-builder.ts`
- Exactly which files change versus which stay the same
- The suggested build order with dependency rationale
- How `page.tsx` device selector expands
- Key unknowns that must be resolved before writing the builder

The existing v2.0 architecture (Supabase auth, persistence, sidebar) is NOT re-researched here.

---

## Critical Decision: New Builder vs. Extend Existing

**Recommendation: New `stadium-builder.ts`. Do NOT extend `preset-builder.ts`.**

Evidence:

1. **Different file format.** Helix Stadium uses `.hsp` (Helix Stadium Preset). `preset-builder.ts` emits `.hlx` (Helix LT/Floor format) with `schema: "L6Preset"`. These are distinct formats confirmed by Line 6's own documentation: "Helix Stadium and the Helix Stadium application save and export all presets in a new (.hsp) preset file format." Source: https://manuals.line6.com/en/helix-stadium/live/presets

2. **Not back-compatible.** "Any imported Helix/HX/Helix Native preset (.hlx) and Favorite (.fav) files are no longer back-compatible with the original device or software once exported from Helix Stadium." This means the internal structure has diverged enough that the format is a one-way street. Sharing builder logic assumes structural similarity that Line 6 has explicitly not guaranteed.

3. **Different model IDs.** Stadium uses Agoura models with new integer IDs (e.g., `Agoura_AmpWhoWatt103`) distinct from the HX model IDs used in `.hlx` presets. The `.hsp` format encodes these differently.

4. **Established precedent: Pod Go.** When Pod Go was added (v1.2), a separate `podgo-builder.ts` was created precisely because the `.pgp` format differed from `.hlx` in keys, DSP count, snapshot count, controller ID, and block encoding. The same logic applies here.

5. **Zero regression risk.** A new file means `preset-builder.ts` is never touched. Helix LT/Floor generation cannot regress. This is the safest pattern for a format that requires real-device inspection to fully understand.

---

## System Overview

```
+---------------------------------------------------------------------+
|                        Frontend (page.tsx)                           |
|                                                                      |
|  Device Selector:                                                    |
|    [LT]  [FLOOR]  [POD GO]  [STADIUM]  <-- add Stadium here         |
|                                                                      |
|  selectedDevice: "helix_lt" | "helix_floor" | "pod_go"              |
|                              | "helix_stadium"  <-- add              |
|                                                                      |
|  downloadPreset():                                                   |
|    fileExtension ".hsp", suffix "_Stadium"  <-- add                 |
+------------------------------+--------------------------------------+
                               |
                      POST /api/generate
                      { device: "helix_stadium", ... }
                               |
+------------------------------v--------------------------------------+
|                   API Route (generate/route.ts)                      |
|                                                                      |
|  Resolve deviceTarget:                                               |
|    if device === "helix_stadium" -> "helix_stadium"  <-- add        |
|                                                                      |
|  Pipeline (shared, device-aware):                                   |
|    callClaudePlanner(messages, deviceTarget, toneContext)            |
|    assembleSignalChain(toneIntent, deviceTarget)                     |
|    resolveParameters(chain, toneIntent)                              |
|    buildSnapshots(parameterized, toneIntent.snapshots)               |
|    validatePresetSpec(presetSpec, deviceTarget)                      |
|                                                                      |
|  Branch on deviceTarget:                                             |
|    isPodGo?   -> buildPgpFile()     -> ".pgp"                       |
|    isStadium? -> buildHspFile()     -> ".hsp"  <-- add              |
|    else       -> buildHlxFile()     -> ".hlx"                       |
+------------------------------+--------------------------------------+
                               |
                 PresetSpec (device-agnostic intermediate)
                               |
+------------------------------v--------------------------------------+
|                    Knowledge Layer (deterministic)                   |
|                                                                      |
|  chain-rules.ts    param-engine.ts    snapshot-engine.ts            |
|                                                                      |
|  Stadium changes:                                                    |
|    chain-rules.ts: add isStadium() branch                           |
|      - 12 blocks per path (vs 8 per DSP for Helix LT/Floor)        |
|      - full mandatory blocks (EQ, Gain Block, boost, gate)          |
|      - note: Stadium 7-band Parametric EQ replaces 5-band           |
|                                                                      |
|  param-engine.ts: NO CHANGE (model-level, not device-level)         |
|  snapshot-engine.ts: VERIFY snapshot count (likely 8, same as LT)   |
+------------------------------+--------------------------------------+
                               |
+------------------------------v--------------------------------------+
|                        Builder Layer                                 |
|                                                                      |
|  preset-builder.ts     -> .hlx  (LT, Floor) -- NO CHANGE            |
|  podgo-builder.ts      -> .pgp  (Pod Go)    -- NO CHANGE            |
|  stadium-builder.ts    -> .hsp  (Stadium)   -- NEW FILE              |
+---------------------------------------------------------------------+
```

---

## Component Responsibilities

### Files That Change

| File | Change Type | What Changes |
|------|-------------|--------------|
| `src/lib/helix/types.ts` | Extend | Add `"helix_stadium"` to `DeviceTarget` union; add `isStadium()` predicate; add `DEVICE_IDS.helix_stadium` (value requires .hsp inspection); fix `helix_floor` device ID regression (currently 2162692, test expects 2162691) |
| `src/lib/helix/config.ts` | Extend | Add `STADIUM_FIRMWARE_CONFIG` block with version constants (requires .hsp inspection) |
| `src/lib/helix/models.ts` | Extend | Add Stadium availability flags on existing models; add Agoura model entries (~50 amp channels); Stadium does NOT have: Simple EQ, Low/High Cut, Low/High Shelf, 5-band Parametric EQ |
| `src/lib/helix/chain-rules.ts` | Extend | Add `isStadium()` branch for 12-block/path limit; use Stadium 7-band Parametric EQ model name for mandatory EQ block |
| `src/lib/helix/validate.ts` | Extend | Add Stadium validation rules (block count, snapshot count) |
| `src/lib/helix/index.ts` | Extend | Export `buildHspFile`, `summarizeStadiumPreset`, `isStadium`, Stadium constants |
| `src/lib/planner.ts` | Extend | Add `isStadium` device name label ("Helix Stadium"); add Stadium model filter branch |
| `src/app/api/generate/route.ts` | Extend | Add `"helix_stadium"` device resolution; add `isStadium()` branch calling `buildHspFile()`; Supabase storage path uses `.hsp` for Stadium |
| `src/app/page.tsx` | Extend | Add `"helix_stadium"` to both device selector arrays; update `selectedDevice` state type; update `downloadPreset()` suffix (`"_Stadium"`); update `downloadStoredPreset()` and device badge |

### Files That Are New

| File | Purpose |
|------|---------|
| `src/lib/helix/stadium-builder.ts` | `.hsp` file builder — the primary deliverable of the Stadium milestone |

### Files That Must Not Change

| File | Reason |
|------|--------|
| `src/lib/helix/preset-builder.ts` | Helix LT/Floor .hlx generation — no Stadium code here |
| `src/lib/helix/podgo-builder.ts` | Pod Go .pgp generation — untouched |
| `src/lib/helix/param-engine.ts` | Parameter resolution is model-level, not device-level |
| `src/lib/helix/snapshot-engine.ts` | Unless Stadium snapshot count differs from Helix LT/Floor's 8 |
| `src/lib/helix/tone-intent.ts` | ToneIntent schema is device-agnostic |
| `src/lib/rig-mapping.ts` | Rig emulation mapping is device-agnostic until Phase 8 |

---

## Recommended Project Structure (additions only)

```
src/lib/helix/
├── types.ts              # MODIFIED: add "helix_stadium", isStadium(), fix helix_floor ID
├── config.ts             # MODIFIED: add STADIUM_FIRMWARE_CONFIG
├── models.ts             # MODIFIED: add Agoura models, Stadium availability flags
├── chain-rules.ts        # MODIFIED: add isStadium() 12-block/path branch
├── validate.ts           # MODIFIED: add Stadium validation case
├── index.ts              # MODIFIED: export new Stadium symbols
├── stadium-builder.ts    # NEW: .hsp builder
src/lib/
├── planner.ts            # MODIFIED: add "helix_stadium" device label + filter
src/app/
├── page.tsx              # MODIFIED: Stadium in device selector, download handling
└── api/generate/route.ts # MODIFIED: Stadium routing branch
```

---

## Architectural Patterns

### Pattern 1: New Builder per File Format (established by Pod Go)

**What:** Each distinct hardware format family has its own builder module. A shared `PresetSpec` intermediate flows into device-specific serialization.

**When to use:** When the preset file format, JSON schema, or block encoding differs meaningfully between devices.

**Trade-offs:**
- Pro: Zero regression risk to existing devices — each builder is isolated
- Pro: Independently testable
- Pro: Format-specific constants are localized (no conditional explosion in shared code)
- Con: Some structural duplication between builders (footswitch logic, snapshot serialization)

**Why Stadium needs this:** Stadium uses `.hsp` (not `.hlx`), encodes Agoura model IDs differently, and the internal JSON structure is not yet known — building on assumptions about sharing structure with `.hlx` is high risk.

**Example:**
```typescript
// stadium-builder.ts — mirror podgo-builder.ts structure
import { STADIUM_FIRMWARE_CONFIG } from "./config";
import { DEVICE_IDS } from "./types";

export function buildHspFile(spec: PresetSpec): HspFile {
  return {
    version: STADIUM_FIRMWARE_CONFIG.HSP_VERSION,  // from .hsp inspection
    data: {
      device: DEVICE_IDS.helix_stadium,             // from .hsp inspection
      device_version: STADIUM_FIRMWARE_CONFIG.HSP_DEVICE_VERSION,
      meta: { ... },
      tone: buildHspTone(spec),
    },
    meta: { original: 0, pbn: 0, premium: 0 },
    schema: "L6Preset",  // VERIFY: may be different for .hsp
  };
}
```

### Pattern 2: DeviceTarget Union Extension

**What:** Add `"helix_stadium"` to the `DeviceTarget` union and a corresponding `isStadium()` predicate. TypeScript exhaustiveness checks flag all unhandled cases.

**When to use:** Every time a new Line 6 device is added.

**Trade-offs:**
- TypeScript will flag every switch/conditional over `DeviceTarget` that does not handle Stadium — this is the desired behavior
- All existing `isHelix()` and `isPodGo()` callsites remain unchanged

**The Helix Floor Device ID Regression:**

The test at `orchestration.test.ts:87-93` expects `DEVICE_IDS.helix_floor` to be `2162691`, but `types.ts:173` sets it to `2162692` (same as LT, with comment "Floor and LT share the same preset format and device ID"). This is the bug described in PROJECT.md. Resolution requires inspecting a real `.hlx` file exported from a Helix Floor device. If Floor and LT genuinely share ID 2162692, the test is wrong. If the correct Floor ID is 2162691, `types.ts` must be corrected. This MUST be resolved before extending `DeviceTarget` to avoid compounding a known incorrect value.

```typescript
// types.ts — after fix and Stadium addition
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium";

export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: 2162691, // FIX if test expectation is correct
  pod_go: 2162695,
  helix_stadium: ???,   // UNKNOWN — requires .hsp file inspection
};

export function isStadium(device: DeviceTarget): boolean {
  return device === "helix_stadium";
}
```

### Pattern 3: Chain Rules Device Branching

**What:** `assembleSignalChain()` already dispatches on `isPodGo(device)`. Stadium requires a parallel branch for its block limits.

**Stadium-specific DSP constraints:**
- 12 blocks per path (Helix LT/Floor: 8 per DSP, Pod Go: 10 total)
- Single-path generation is the v3.0 target (Path 1A only) — dual/quad-path is out of scope for launch
- Full mandatory blocks apply (boost, gate for high-gain, Parametric EQ, Gain Block)
- 7-band Parametric EQ model name required (Stadium removed 5-band) — must match Stadium model catalog key

```typescript
// chain-rules.ts — add alongside isPodGo check
const stadium = device ? isStadium(device) : false;
const MAX_BLOCKS_STADIUM_PATH = 12;

// In DSP limit validation:
if (stadium) {
  const pathBlocks = allBlocks.filter(b => b.dsp === 0 && b.type !== "cab");
  if (pathBlocks.length > MAX_BLOCKS_STADIUM_PATH) {
    throw new Error(`Stadium path block limit exceeded: ${pathBlocks.length} blocks (max ${MAX_BLOCKS_STADIUM_PATH})`);
  }
}
```

### Pattern 4: Model Catalog Device Availability Flags

**What:** Each model entry in `models.ts` carries device availability flags. The planner filters the catalog to only the models available on the target device.

**Stadium catalog facts (HIGH confidence):**
- Stadium includes ALL HX models (the 111 HX amp channels plus effects) — backward compatible
- Stadium adds ~50 Agoura amp channels (22 launched, growing with firmware updates)
- Stadium does NOT have: Simple EQ, Low/High Cut EQ, Low/High Shelf EQ, 5-band Parametric EQ
- Stadium has a new 7-band Parametric EQ that replaces the 5-band version

**Model catalog extension approach:**
```typescript
// models.ts — extend HelixModel interface
export interface HelixModel {
  // ... existing fields ...
  availableOn?: {
    helix_lt?: boolean;
    helix_floor?: boolean;
    pod_go?: boolean;
    helix_stadium?: boolean;
  };
  stadiumOnly?: boolean;  // Agoura models: true
}
```

---

## Data Flow

### Preset Generation Request Flow (Stadium)

```
User selects "STADIUM" in device selector
    |
    v
page.tsx: selectedDevice = "helix_stadium"
    |
    v POST /api/generate { device: "helix_stadium", messages, conversationId, ... }
    |
    v
route.ts: deviceTarget = "helix_stadium"
    |
    v
callClaudePlanner(messages, "helix_stadium", toneContext)
    - planner.ts: deviceName = "Helix Stadium"
    - model list filtered: Stadium models only (Agoura + HX, excluding removed EQs)
    - returns ToneIntent
    |
    v
assembleSignalChain(toneIntent, "helix_stadium")
    - chain-rules.ts: isStadium() branch, 12-block/path limit
    - mandatory blocks: boost + Horizon Gate (high-gain) + Stadium 7-band EQ + Gain Block
    - returns BlockSpec[]
    |
    v
resolveParameters(chain, toneIntent)
    - param-engine.ts: UNCHANGED (model-level, device-agnostic)
    - returns parameterized BlockSpec[]
    |
    v
buildSnapshots(parameterized, toneIntent.snapshots)
    - snapshot-engine.ts: 8 snapshots (VERIFY for Stadium)
    - returns SnapshotSpec[]
    |
    v
validatePresetSpec(presetSpec, "helix_stadium")
    - validate.ts: Stadium-specific block count and snapshot count checks
    |
    v
isStadium(deviceTarget) -> buildHspFile(presetSpec)
    - stadium-builder.ts: .hsp JSON serialization
    - returns HspFile object
    |
    v
Supabase storage: {userId}/{conversationId}/latest.hsp  (if conversationId present)
    |
    v
NextResponse.json({
  preset: hspFile,
  summary,
  spec: presetSpec,
  toneIntent,
  device: "helix_stadium",
  fileExtension: ".hsp",
  ...
})
    |
    v
page.tsx: downloadPreset()
    - ext = ".hsp"
    - suffix = "_Stadium"
    - filename: "HelixAI_[PresetName]_Stadium.hsp"
```

### page.tsx Device Selector Expansion

The device selector currently renders two separate arrays of device options — one in the substitution card CTA (line 1275-1277) and one in the post-interview generate CTA (line 1365-1367). Both must be updated identically:

```typescript
// CURRENT (page.tsx lines 1275-1277 and 1365-1367)
{ id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
{ id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
{ id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },

// AFTER STADIUM ADDITION
{ id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
{ id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
{ id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },
{ id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" },
```

Additional `page.tsx` changes required:
- `useState<"helix_lt" | "helix_floor" | "pod_go">` → add `| "helix_stadium"`
- `generatePreset(overrideDevice?)` signature type — add `"helix_stadium"`
- `handleRigGenerate(overrideDevice?)` signature type — add `"helix_stadium"`
- `downloadPreset()`: add `generatedPreset.device === "helix_stadium" ? "_Stadium"` case
- `downloadStoredPreset()`: add Stadium suffix and `.hsp` extension detection
- Device badge display: add `"helix_stadium"` → `"STADIUM"` case
- `setSelectedDevice` cast on conversation load: add `"helix_stadium"` to type assertion
- The "Generate for other device" button (line 1538-1548): update tertiary toggle logic

---

## Critical Unknown: .hsp Internal Structure

**This is the single highest-risk unknown in the entire Stadium milestone.**

The `.hsp` file format is not publicly documented as of 2026-03-04. No community reverse-engineering of the JSON structure (schema keys, device integer ID, DSP key names, block encoding, snapshot controller ID) has been published in indexed sources. The reverse-engineering article from December 2025 (ilikekillnerds.com) covers only the WiFi editor protocol (OSC/ZMTP), not file content.

**What must be determined before writing stadium-builder.ts:**

| Question | Why It Matters | How to Get Answer |
|----------|----------------|-------------------|
| Is .hsp plain JSON like .hlx? | Determines if text-editor inspection works | Open a .hsp file in any text editor |
| Does it use `schema: "L6Preset"`? | Top-level schema key in HlxFile interface | Inspect .hsp JSON |
| What is the `device` integer for Stadium? | `DEVICE_IDS.helix_stadium` constant | Inspect .hsp JSON `data.device` field |
| Are DSP keys `dsp0`/`dsp1` or different? | Core DSP structure of HspTone | Inspect .hsp tone section |
| Are block keys `block0`/`block1` format? | Block serialization in buildHspDsp | Inspect .hsp dsp0 section |
| What is snapshot controller ID? | Helix=19, PodGo=4, Stadium=? | Inspect .hsp controller section |
| Are input/output keys `inputA`/`outputA`? | DSP I/O model names | Inspect .hsp dsp0.inputA |
| How many snapshots? | snapshot-engine.ts count | Inspect .hsp snapshot count |
| What are footswitch indices? | Helix=7-10, PodGo=0-5, Stadium=? | Inspect .hsp footswitch section |
| What firmware version constants? | STADIUM_FIRMWARE_CONFIG | Inspect .hsp meta section |

**How to obtain a .hsp file:** Install the "Helix Stadium" editing application (free download from line6.com/software) and either connect to a Stadium device or use the standalone editor to create and export a preset. The file format is accessible once you have a single real .hsp file.

---

## Suggested Build Order

Dependencies flow strictly from type system → constants → catalog → rules → builder → API → UI.

### Phase 1: Device ID Research + Helix Floor Regression Fix

**Goal:** Ground-truth constants before anything else is written.

**Tasks:**
- Obtain and inspect a real `.hsp` file from Helix Stadium Edit app
- Document: device integer ID, schema string, version constants, DSP keys, snapshot controller ID, footswitch indices
- Determine correct Helix Floor device ID (inspect a real `.hlx` from a Floor unit)
- Fix `helix_floor: 2162692` → correct value in `types.ts` (one-line change)
- Run existing test suite to verify regression fix passes

**Files:** `src/lib/helix/types.ts` (Floor ID fix only)
**Dependency:** None — this is the prerequisite for everything
**Confidence gate:** Do NOT proceed past this phase until .hsp structure is documented

---

### Phase 2: Type System Foundation

**Goal:** Establish the type foundation that TypeScript exhaustiveness will use to flag all remaining integration points.

**Tasks:**
- Add `"helix_stadium"` to `DeviceTarget` union in `types.ts`
- Add `isStadium()` predicate function
- Add `DEVICE_IDS.helix_stadium` (from Phase 1)
- Add Stadium-specific constants to `types.ts` if needed (e.g., `STADIUM_MAX_BLOCKS_PER_PATH = 12`)
- Add `STADIUM_FIRMWARE_CONFIG` to `config.ts` (version constants from Phase 1)
- Run TypeScript compiler — all type errors in other files are the integration checklist

**Files:** `src/lib/helix/types.ts`, `src/lib/helix/config.ts`
**Dependency:** Phase 1 (need device ID and version constants)

---

### Phase 3: Model Catalog

**Goal:** Correct model set available for Stadium presets.

**Tasks:**
- Add `stadiumOnly?: boolean` flag to `HelixModel` interface (or extend existing device availability field)
- Add Agoura amp model entries with `stadiumOnly: true` (sourced from line6.com/helix-stadium-models/)
- Flag removed Stadium models (Simple EQ, 5-band Parametric EQ, etc.) as `!availableOn.helix_stadium`
- Add Stadium 7-band Parametric EQ model entry (new model, Stadium-exclusive)
- Verify `getModelListForPrompt()` and `isModelAvailableForDevice()` respect Stadium filtering

**Files:** `src/lib/helix/models.ts`
**Dependency:** Phase 2 (DeviceTarget extended)

---

### Phase 4: Chain Rules + Validation

**Goal:** Stadium-aware signal chain assembly and validation.

**Tasks:**
- Add `isStadium()` branch in `assembleSignalChain()` for 12-block/path limit
- Update mandatory block insertion: use Stadium 7-band Parametric EQ model name (not 5-band)
- Add `STADIUM` case to `getDspForSlot()` (Stadium uses dual DSP like Helix, not single DSP like Pod Go)
- Add Stadium validation in `validate.ts` (max blocks per path, snapshot count)
- Update chain-rules tests to cover Stadium path

**Files:** `src/lib/helix/chain-rules.ts`, `src/lib/helix/validate.ts`
**Dependency:** Phase 3 (Stadium EQ model name must exist in catalog)

---

### Phase 5: Stadium Builder

**Goal:** `buildHspFile()` emits a valid .hsp file that loads on Helix Stadium hardware.

**Tasks:**
- Create `src/lib/helix/stadium-builder.ts` modeled on `podgo-builder.ts` structure
- Implement `buildHspDsp()` using .hsp key structure from Phase 1
- Implement `buildHspSnapshot()` with correct controller ID from Phase 1
- Implement `buildHspFootswitchSection()` with Stadium footswitch indices from Phase 1
- Implement `buildHspControllerSection()` with Stadium controller ID
- Export `buildHspFile()` and `summarizeStadiumPreset()`
- Export from `index.ts`
- Test: generate a preset, write to .hsp file, load into Helix Stadium Edit app to verify

**Files:** `src/lib/helix/stadium-builder.ts` (new), `src/lib/helix/index.ts`
**Dependency:** Phase 1 (format), Phase 2 (constants), Phase 3 (model IDs)

---

### Phase 6: Planner + API Route Integration

**Goal:** Wire Stadium through the full generation pipeline.

**Tasks:**
- Update `planner.ts`: add `isStadium(device)` → `deviceName = "Helix Stadium"` label
- Update `generate/route.ts`: add `else if (device === "helix_stadium")` → `deviceTarget = "helix_stadium"`
- Add `isStadium(deviceTarget)` branch in route calling `buildHspFile()` and `summarizeStadiumPreset()`
- Update Supabase storage path: `latest.hsp` for Stadium presets
- Import `buildHspFile`, `summarizeStadiumPreset`, `isStadium` into route

**Files:** `src/lib/planner.ts`, `src/app/api/generate/route.ts`
**Dependency:** Phase 5 (builder must exist)

---

### Phase 7: UI — Device Selector + Download

**Goal:** Stadium option visible and functional for users.

**Tasks:**
- Add `{ id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" }` to both device arrays
- Update `selectedDevice` state type to include `"helix_stadium"`
- Update all function signatures that type the device parameter explicitly
- Update `downloadPreset()`: add `"helix_stadium" ? "_Stadium"` suffix case
- Update `downloadStoredPreset()`: add Stadium case (`.hsp` extension)
- Update device badge: `"helix_stadium"` → `"STADIUM"`
- Update `setSelectedDevice` cast on conversation load
- Update the "Generate for other device" toggle button logic
- Verify rig emulation device picker in substitution card CTA includes Stadium

**Files:** `src/app/page.tsx`
**Dependency:** Phase 6 (API accepts Stadium requests)

---

### Phase 8: Rig Emulation for Stadium

**Goal:** Pedal photo + text rig description works for Stadium.

**Tasks:**
- Verify `mapRigToSubstitutions(rigIntent, deviceTarget)` in `rig-mapping.ts` handles `"helix_stadium"` — the current Pod Go path uses device-specific model names; Stadium uses the same model name format as Helix LT/Floor (no Mono/Stereo suffix), so the Helix branch likely applies
- Update `api/map/route.ts` to accept `"helix_stadium"` as a valid device
- Test: upload a pedal photo, select Stadium, verify substitution card shows Stadium-appropriate model names

**Files:** `src/lib/rig-mapping.ts` (verify/minor extend), `src/app/api/map/route.ts`
**Dependency:** Phase 7 (Stadium in UI)

---

## Anti-Patterns

### Anti-Pattern 1: Extending preset-builder.ts for Stadium

**What people do:** Add `if (isStadium(device)) { ... } else { /* existing hlx logic */ }` inside `buildHlxFile()`.

**Why it's wrong:** `.hsp` and `.hlx` have different JSON schemas, different model ID encoding (Agoura vs HX integer IDs), potentially different DSP key names, different footswitch indices, and different snapshot controller IDs. Mixing two format families in one function creates dual-responsibility code that breaks when either format updates, and risks silently emitting invalid files for Helix LT/Floor users.

**Do this instead:** `stadium-builder.ts` is the correct answer, following the `podgo-builder.ts` precedent.

---

### Anti-Pattern 2: Assuming .hsp is "basically .hlx with a different extension"

**What people do:** Copy `preset-builder.ts`, rename to `stadium-builder.ts`, change the extension constant from `.hlx` to `.hsp`.

**Why it's wrong:** Line 6 created a new format for Stadium. The `.hsp` format carries Agoura model IDs, a potentially different schema string, an unknown device integer, and possibly different DSP/snapshot structures. Copying without inspecting a real file produces a builder that generates syntactically plausible but semantically wrong preset data that won't load on hardware.

**Do this instead:** Phase 1 requires inspection of a real `.hsp` file before any code is written. No assumptions.

---

### Anti-Pattern 3: Adding Agoura Models to the Universal Catalog Without Device Filtering

**What people do:** Add Agoura models to `models.ts` without a device availability flag, allowing the planner to offer `Agoura_AmpWhoWatt103` to Helix LT/Floor users.

**Why it's wrong:** Helix LT/Floor does not have Agoura models. A preset referencing an Agoura model ID on a Helix LT unit will fail to load or silently produce a default block.

**Do this instead:** Mark Agoura models `stadiumOnly: true`. The existing device filtering mechanism in `getModelListForPrompt()` must exclude them for non-Stadium devices.

---

### Anti-Pattern 4: Skipping Phase 1 and Guessing Format Constants

**What people do:** Implement `stadium-builder.ts` using guessed values for the device ID, schema key, and snapshot controller ID because "it's probably similar to Helix LT."

**Why it's wrong:** The device integer in the preset file is what the hardware uses to verify it can load the preset. A wrong device ID means the preset either fails to import or loads as a corrupt/unknown preset on the Stadium.

**Do this instead:** One real `.hsp` file, opened in a text editor, answers all format questions in 5 minutes. The Helix Stadium Edit application is a free download. This is the cheapest possible research step.

---

### Anti-Pattern 5: Hardcoding Helix LT/Floor Snapshot Count for Stadium

**What people do:** Copy the `buildSnapshots(parameterized, toneIntent.snapshots)` call from the Helix branch without verifying Stadium's snapshot count.

**Why it's wrong:** Pod Go uses 4 snapshots; Helix LT/Floor uses 8. If Stadium uses a different count, `snapshot-engine.ts` and the builder will generate the wrong number of snapshot entries. The Stadium Owner's Manual documents the snapshot count — verify it in Phase 1.

**Do this instead:** Confirm Stadium snapshot count from official documentation or a real .hsp file before hardcoding 8.

---

## Scaling Considerations

Stadium support is additive — no scaling concerns beyond what v2.0 already addressed. The Vercel serverless limit remains the same for all devices. Stadium preset files will be similar in size to Helix LT/Floor `.hlx` files (~10-50KB JSON), well within limits.

| Concern | Impact | Note |
|---------|--------|------|
| Preset file size (.hsp) | Negligible | Same magnitude as .hlx (~10-50KB) |
| Agoura model catalog size | Minimal | ~50 additional catalog entries in models.ts |
| API response payload | Unchanged | Same JSON structure returned to client |
| Supabase Storage paths | Trivial | Add `.hsp` extension case to existing storage path logic |

---

## Sources

- Line 6 Helix Stadium Presets Manual (.hsp format confirmation): https://manuals.line6.com/en/helix-stadium/live/presets
- Helix/HX preset transfers to Helix Stadium (back-compat details): https://line6.com/support/announcement/118-helixhx-preset-transfers-to-helix-stadium/
- Helix Stadium Signal Path Routing (12 blocks/path, 4 paths): https://manuals.line6.com/en/helix-stadium/live/signal-path-routing
- Helix Stadium Models catalog (Agoura + HX model list): https://line6.com/helix-stadium-models/
- Reverse engineering Helix Stadium XL editor protocol (modeldefs msgpack, model ID structure — protocol only, not file format): https://ilikekillnerds.com/2025/12/21/reverse-engineering-the-helix-stadium-xl-editor-protocol/
- Helix Stadium 1.2.1 Release Notes (Jan 2026, 50 Agoura channels as of 1.2): https://line6.com/support/page/kb/effects-controllers/helix_130/helix-stadium-121-release-notes-r1105
- Sweetwater Stadium XL amp/DSP specs: https://www.sweetwater.com/store/detail/StadiumXL--line-6-helix-stadium-xl-amp-modeler-and-fx-processor
- Existing codebase (ground truth for all existing architecture claims): src/lib/helix/

---

*Architecture research for: HelixAI v3.0 — Helix Stadium device support*
*Researched: 2026-03-04*
