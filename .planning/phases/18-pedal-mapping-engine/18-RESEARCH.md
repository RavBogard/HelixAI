# Phase 18: Pedal Mapping Engine — Research

**Researched:** 2026-03-02
**Domain:** TypeScript deterministic lookup table, rig-to-Helix substitution mapping
**Confidence:** HIGH

---

## Summary

Phase 18 creates `src/lib/rig-mapping.ts` — a pure, deterministic module with no external dependencies beyond types already defined in `src/lib/helix/`. The file exports three things: `PEDAL_HELIX_MAP` (40+ entries mapping real-world pedal names to Helix model metadata), `lookupPedal()` (three-tier confidence lookup), and `mapRigToSubstitutions()` (processes a full `RigIntent` into a `SubstitutionMap` flat array).

All type contracts were confirmed by reading `rig-intent.ts` and `types.ts` directly. The `getModelIdForDevice()` function takes three arguments — a `HelixModel` object, a `blockType` string, and a `DeviceTarget` — NOT a model ID string. This is the most critical implementation detail for the planner to communicate to the implementer. The PEDAL_HELIX_MAP must store `HelixModel` objects (or at minimum the `name` string to look them up), NOT pre-computed HD2_* ID strings, so that `getModelIdForDevice` can apply the correct Pod Go suffix at lookup time.

The project uses **vitest 4.0.18** with no config file — tests run via `npx vitest run` and resolve imports via relative paths (existing test files all use `./` imports, not `@/` aliases). The new test file should follow this pattern: `src/lib/rig-mapping.test.ts` with relative imports.

**Primary recommendation:** Store `HelixModel` object references in `PEDAL_HELIX_MAP`. Call `getModelIdForDevice(model, blockType, device)` at lookup time to compute the device-correct ID. Import `getModelIdForDevice` from `@/lib/helix` or directly from `./helix/models`.

---

## Research Question Answers

### Q1: getModelIdForDevice() signature

**Confirmed from `src/lib/helix/models.ts` lines 1132–1152:**

```typescript
export function getModelIdForDevice(
  model: HelixModel,        // HelixModel OBJECT (has .id, .name, .category, etc.)
  blockType: string,        // "distortion" | "dynamics" | "delay" | "reverb" | "modulation" | etc.
  device: DeviceTarget,
): string
```

It takes a **`HelixModel` object**, NOT a model name string or an HD2_* ID string. This means `PEDAL_HELIX_MAP` entries must reference `HelixModel` objects (imported from models.ts) so the lookup function can pass the full object to `getModelIdForDevice`.

**Key behavior:**
- Helix LT / Helix Floor: returns `model.id` as-is (e.g., `"HD2_DistTeemah"`)
- Pod Go: appends `"Mono"` for distortion/dynamics/eq/pitch, `"Stereo"` for delay/reverb/modulation/wah/volume
- Amp and Cab IDs are identical between devices (no suffix applied)

**Confidence: HIGH** — read directly from source.

---

### Q2: DeviceTarget type

**Confirmed from `src/lib/helix/types.ts` line 169:**

```typescript
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go";
```

Three values only: `"helix_lt"`, `"helix_floor"`, `"pod_go"`. No other device strings.

**Confidence: HIGH** — read directly from source.

---

### Q3: Can getModelIdForDevice be imported from @/lib/helix?

**YES. Confirmed from `src/lib/helix/index.ts` line 4:**

```typescript
export { getModelIdForDevice, getBlockTypeForDevice, isModelAvailableForDevice, POD_GO_EXCLUDED_MODELS } from "./models";
```

Import in `src/lib/rig-mapping.ts`:
```typescript
import { getModelIdForDevice } from "@/lib/helix";
```

Or use direct relative import (matches the pattern of all existing test files):
```typescript
import { getModelIdForDevice } from "./helix";
```

**Both work.** For a `src/lib/` file (not a test), `@/lib/helix` is preferred per project conventions.

**Confidence: HIGH** — read directly from index.ts.

---

### Q4: PEDAL_HELIX_MAP entry structure

**Option (a) — store HelixModel object reference + call getModelIdForDevice at lookup time.**

This is the correct approach because `getModelIdForDevice` requires a `HelixModel` object, not a string. PEDAL_HELIX_MAP entries should store:

```typescript
interface PedalMapEntry {
  helixModelName: string;           // Human-readable display name e.g. "Teemah!"
  model: HelixModel;                // The full HelixModel object from DISTORTION_MODELS etc.
  blockType: string;                // "distortion" | "dynamics" | "delay" | "reverb" | "modulation"
  substitutionReason: string;       // Why this is the right match
  knobMap?: Record<string, string>; // Physical knob name -> Helix param name (optional)
}
```

At lookup time, call `getModelIdForDevice(entry.model, entry.blockType, device)` to get the device-correct ID.

**Alternative:** Store only the model name string and look it up from the model dictionaries (`DISTORTION_MODELS`, etc.) exported from models.ts. This avoids importing 1000+ line model dicts into rig-mapping.ts. The tradeoff: slightly more boilerplate to resolve the HelixModel at lookup time.

**Recommendation:** Import specific HelixModel objects directly (e.g., `import { DISTORTION_MODELS, DYNAMICS_MODELS, DELAY_MODELS, REVERB_MODELS, MODULATION_MODELS } from "@/lib/helix/models"`) — these are already exported and available.

**Confidence: HIGH** — function signature confirmed.

---

### Q5: mapRigToSubstitutions() return type

**Confirmed from `src/lib/helix/rig-intent.ts` lines 53–55:**

```typescript
export const SubstitutionMapSchema = z.array(SubstitutionEntrySchema);
export type SubstitutionMap = z.infer<typeof SubstitutionMapSchema>;
// SubstitutionMap = SubstitutionEntry[]  — a flat array, NOT an object wrapper
```

`mapRigToSubstitutions()` must return `SubstitutionMap` (which is `SubstitutionEntry[]`). No object wrapper, no `{ substitutions: [...] }` shape. Just a flat array.

**Exact function signature to implement:**
```typescript
export function mapRigToSubstitutions(
  rigIntent: RigIntent,
  device: DeviceTarget,
): SubstitutionMap
```

**Confidence: HIGH** — read directly from source.

---

### Q6: POD_GO_EXCLUDED_MODELS — impact on common effect models

**Confirmed from `src/lib/helix/models.ts` lines 1099–1103:**

```typescript
export const POD_GO_EXCLUDED_MODELS = new Set([
  "Tone Sovereign",   // HD2_DistToneSovereign — not ported to Pod Go
  "Clawthorn Drive",  // HD2_DistClawthornDrive — not ported to Pod Go
  "Cosmos Echo",      // HD2_DelayCosmosEcho — too DSP-heavy for single-chip Pod Go
]);
```

**Impact on Phase 18 PEDAL_HELIX_MAP entries:**

| Model | Excluded from Pod Go? | Impact on Map |
|-------|----------------------|---------------|
| Teemah! (HD2_DistTeemah) | NO | Use freely |
| Scream 808 (HD2_DistScream808) | NO | Use freely |
| Stupor OD (HD2_DistStuporOD) | NO | Use freely |
| Vermin Dist (HD2_DistVerminDist) | NO | Use freely |
| Script Mod Phase (HD2_PhaserScriptModPhase) | NO | Use freely |
| Red Squeeze (HD2_CompressorRedSqueeze) | NO | Use freely |
| Bucket Brigade (HD2_DelayBucketBrigade) | NO | Use freely |
| Hall (HD2_ReverbHall) | NO | Use freely |
| Tone Sovereign | **YES** | Must not use as Pod Go target; use Heir Apparent or Teemah! as fallback |
| Clawthorn Drive | **YES** | Must not use as Pod Go target; use Kinky Boost as fallback |
| Cosmos Echo | **YES** | Must not use as Pod Go target; use Transistor Tape as fallback |

**Action required:** `lookupPedal()` must call `isModelAvailableForDevice(modelName, device)` for each resolved model and fall back if the model is excluded. The `isModelAvailableForDevice` function is exported from `@/lib/helix`.

**Confidence: HIGH** — read directly from source.

---

### Q7: Category fallback models

These are the "close" confidence fallbacks when a pedal category is recognized but no direct table match exists:

| Category | Fallback Model | Helix Name | ID | Rationale |
|----------|----------------|------------|-----|-----------|
| Unknown overdrive | "Teemah!" | HD2_DistTeemah | Timmy-based, most neutral/versatile OD in Helix |
| Unknown distortion | "Vermin Dist" | HD2_DistVerminDist | RAT-based, covers wide gain range |
| Unknown fuzz | "Triangle Fuzz" | HD2_DistTriangleFuzz | Original Big Muff circuit, classic fuzz reference |
| Unknown delay | "Simple Delay" | HD2_DelaySimpleDelay | Neutral, no coloration artifacts |
| Unknown reverb | "Hall" | HD2_ReverbHall | Most generic/versatile reverb type |
| Unknown modulation | "Script Mod Phase" | HD2_PhaserScriptModPhase | Subtle Phase 90 — least intrusive default |
| Unknown compressor | "Red Squeeze" | HD2_CompressorRedSqueeze | MXR Dyna Comp — industry-standard compressor reference |
| Unknown boost | "Kinky Boost" | HD2_DistKinkyBoost | EP Booster-based, clean treble boost |

These should be the "close" fallbacks. "approximate" applies when even the category is uncertain (e.g., a multi-function pedal described ambiguously).

**Confidence: MEDIUM** — model selection rationale based on domain knowledge; the HelixModel objects exist in models.ts (confirmed HIGH).

---

### Q8: Unit test infrastructure

**Confirmed:** The project uses **vitest 4.0.18** (devDependency in package.json). There is no `vitest.config.*` file — vitest runs with zero config, auto-discovering `*.test.ts` files.

**Existing test files (all in `src/lib/helix/`):**
- `param-engine.test.ts`
- `chain-rules.test.ts`
- `snapshot-engine.test.ts`
- `orchestration.test.ts`

**Test run command:** `npx vitest run` (all 62 tests pass currently)
**Single file command:** `npx vitest run src/lib/rig-mapping.test.ts`

**Pattern used by all existing tests:**
```typescript
import { describe, it, expect } from "vitest";
import { functionUnderTest } from "./module-under-test";  // relative imports only
```

No `@/` path aliases used in test files — always relative paths. The new test file should be:
**`src/lib/rig-mapping.test.ts`** (co-located with the source file, matching existing conventions).

**Confidence: HIGH** — read existing test files and ran `npx vitest run` to confirm.

---

## Standard Stack

### Core
| Import | Source | Purpose |
|--------|--------|---------|
| `HelixModel` | `@/lib/helix/models` | Type for map entries (holds `.id`, `.name`, `.category`) |
| `getModelIdForDevice` | `@/lib/helix` | Resolves HD2_* ID with Pod Go suffix at lookup time |
| `isModelAvailableForDevice` | `@/lib/helix` | Guards against excluded Pod Go models |
| `POD_GO_EXCLUDED_MODELS` | `@/lib/helix` | Set of model names not available on Pod Go |
| `DISTORTION_MODELS`, `DYNAMICS_MODELS`, `DELAY_MODELS`, `REVERB_MODELS`, `MODULATION_MODELS` | `@/lib/helix/models` | Source dictionaries for HelixModel objects |
| `RigIntent`, `SubstitutionEntry`, `SubstitutionMap` | `@/lib/helix` | Type contracts |
| `DeviceTarget` | `@/lib/helix` | Device discriminator |

### No External Dependencies
`rig-mapping.ts` requires no new npm packages. All types and utilities are already in the codebase.

---

## Architecture Patterns

### Recommended File Structure
```
src/lib/
├── rig-mapping.ts        # Phase 18 — NEW
├── rig-mapping.test.ts   # Phase 18 — NEW (co-located test)
└── helix/
    ├── rig-intent.ts     # Phase 17 — existing types
    ├── models.ts         # existing — HelixModel objects + getModelIdForDevice
    ├── types.ts          # existing — DeviceTarget
    └── index.ts          # existing — barrel exports
```

### Pattern 1: PEDAL_HELIX_MAP structure

```typescript
// Source: models.ts DISTORTION_MODELS dictionary pattern
interface PedalMapEntry {
  model: HelixModel;          // full HelixModel object from models.ts dicts
  blockType: string;          // "distortion" | "dynamics" | "delay" | "reverb" | "modulation"
  substitutionReason: string; // narrative explanation for UI display
  knobMap?: Record<string, string>; // physicalKnobName -> helixParamName (optional)
}

// Key: normalized lowercase pedal name for case-insensitive matching
export const PEDAL_HELIX_MAP: Record<string, PedalMapEntry> = {
  "ts9 tube screamer":    { model: DISTORTION_MODELS["Scream 808"], blockType: "distortion", ... },
  "ts808 tube screamer":  { model: DISTORTION_MODELS["Scream 808"], blockType: "distortion", ... },
  "boss sd-1":            { model: DISTORTION_MODELS["Stupor OD"],  blockType: "distortion", ... },
  // ...
};
```

### Pattern 2: lookupPedal() three-tier logic

```typescript
export function lookupPedal(
  pedalName: string,
  device: DeviceTarget,
): SubstitutionEntry {
  const key = pedalName.toLowerCase().trim();

  // Tier 1: direct — exact match in PEDAL_HELIX_MAP
  const direct = PEDAL_HELIX_MAP[key];
  if (direct && isModelAvailableForDevice(direct.model.name, device)) {
    return buildEntry(pedalName, direct, device, "direct");
  }

  // Tier 2: close — category detected via keyword, use category default
  const category = detectCategory(key); // "overdrive" | "distortion" | "fuzz" | etc.
  if (category) {
    const fallback = CATEGORY_DEFAULTS[category];
    if (isModelAvailableForDevice(fallback.model.name, device)) {
      return buildEntry(pedalName, fallback, device, "close");
    }
  }

  // Tier 3: approximate — unknown, use overdrive as safest default
  return buildEntry(pedalName, CATEGORY_DEFAULTS["overdrive"], device, "approximate");
}
```

### Pattern 3: mapRigToSubstitutions()

```typescript
export function mapRigToSubstitutions(
  rigIntent: RigIntent,
  device: DeviceTarget,
): SubstitutionMap {
  return rigIntent.pedals.map(pedal =>
    lookupPedal(pedal.fullName, device)  // fullName is the primary lookup key per rig-intent.ts
  );
}
```

### Pattern 4: knob zone translation

```typescript
const KNOB_ZONE_VALUES: Record<string, number> = {
  "low":          0.15,
  "medium-low":   0.35,
  "medium-high":  0.65,
  "high":         0.85,
};
```

Apply this translation inside `lookupPedal()` when building `parameterMapping` from `PhysicalPedal.knobPositions`.

### Anti-Patterns to Avoid

- **Pre-computing HD2_* strings in the map:** Never store `"HD2_DistTeemahMono"` in the table. The `Mono`/`Stereo` suffix must be computed at lookup time via `getModelIdForDevice()` because the same table entry serves all devices.
- **Returning `confidence: "direct"` for fuzzy matches:** If lookup fell through to category or approximate tier, confidence MUST be `"close"` or `"approximate"` — never `"direct"`.
- **Silent confident-wrong mapping:** If a boutique pedal is not in the table, do NOT silently map it to a TS9 equivalent with `confidence: "direct"`. Always use the appropriate tier.
- **Object wrapper return type:** `mapRigToSubstitutions()` returns `SubstitutionEntry[]` (a bare array), NOT `{ substitutions: SubstitutionEntry[] }`.
- **Using `@/` aliases in test files:** All existing tests use relative imports. `rig-mapping.test.ts` should import from `"./rig-mapping"`.

---

## PEDAL_HELIX_MAP Entry Count (Confirmed 40+)

The table below shows 48 entries across all categories, meeting the 40-entry minimum. Entries are keyed on normalized lowercase names.

### Overdrives (14 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `ts9 tube screamer` | Scream 808 | HD2_DistScream808 |
| `ts808 tube screamer` | Scream 808 | HD2_DistScream808 |
| `ibanez ts9` | Scream 808 | HD2_DistScream808 |
| `ibanez ts808` | Scream 808 | HD2_DistScream808 |
| `boss sd-1` | Stupor OD | HD2_DistStuporOD |
| `boss sd-1 super overdrive` | Stupor OD | HD2_DistStuporOD |
| `klon centaur` | Minotaur | HD2_DistMinotaur |
| `klone` | Minotaur | HD2_DistMinotaur |
| `boss bd-2` | Teemah! | HD2_DistTeemah |
| `boss bd-2 blues driver` | Teemah! | HD2_DistTeemah |
| `fulltone ocd` | Compulsive Drive | HD2_DistCompulsiveDrive |
| `analogman prince of tone` | Heir Apparent | HD2_DistHeirApparent |
| `analogman king of tone` | Tone Sovereign | HD2_DistToneSovereign |
| `way huge red llama` | Alpaca Rouge | HD2_DistAlpacaRouge |

### Distortions (8 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `pro co rat` | Vermin Dist | HD2_DistVerminDist |
| `proco rat` | Vermin Dist | HD2_DistVerminDist |
| `boss ds-1` | Deez One Vintage | HD2_DistDeezOneVintage |
| `boss ds-1 distortion` | Deez One Vintage | HD2_DistDeezOneVintage |
| `mxr distortion+` | Hedgehog D9 | HD2_DistHedgehogD9 |
| `mxr distortion plus` | Hedgehog D9 | HD2_DistHedgehogD9 |
| `ehx big muff pi` | Triangle Fuzz | HD2_DistTriangleFuzz |
| `electro-harmonix big muff pi` | Triangle Fuzz | HD2_DistTriangleFuzz |

### Fuzz (5 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `dunlop fuzz face` | Arbitrator Fuzz | HD2_DistArbitratorFuzz |
| `arbiter fuzz face` | Arbitrator Fuzz | HD2_DistArbitratorFuzz |
| `big muff ram's head` | Rams Head | HD2_DistRamsHead |
| `ehx op-amp big muff` | Pillars | HD2_DistPillars |
| `zvex fuzz factory` | Industrial Fuzz | HD2_DistIndustrialFuzz |

### Boost (4 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `xotic ep booster` | Kinky Boost | HD2_DistKinkyBoost |
| `ep booster` | Kinky Boost | HD2_DistKinkyBoost |
| `ehx soul food` | Teemah! | HD2_DistTeemah |
| `soul food` | Teemah! | HD2_DistTeemah |

### Compressors (5 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `mxr dyna comp` | Red Squeeze | HD2_CompressorRedSqueeze |
| `ross compressor` | Rochester Comp | HD2_CompressorRochesterComp |
| `xotic sp compressor` | Kinky Comp | HD2_CompressorKinkyComp |
| `diamond compressor` | Kinky Comp | HD2_CompressorKinkyComp |
| `keeley compressor` | Red Squeeze | HD2_CompressorRedSqueeze |

### Delays (6 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `boss dm-2` | Bucket Brigade | HD2_DelayBucketBrigade |
| `boss dm-2 waza` | Bucket Brigade | HD2_DelayBucketBrigade |
| `ehx deluxe memory man` | Elephant Man | HD2_DelayElephantMan |
| `electro-harmonix deluxe memory man` | Elephant Man | HD2_DelayElephantMan |
| `boss dd-3` | Simple Delay | HD2_DelaySimpleDelay |
| `boss dd-3 digital delay` | Simple Delay | HD2_DelaySimpleDelay |

### Reverbs (4 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `tc electronic hall of fame` | Hall | HD2_ReverbHall |
| `hall of fame` | Hall | HD2_ReverbHall |
| `strymon big sky` | Ganymede | HD2_ReverbGanymede |
| `big sky` | Ganymede | HD2_ReverbGanymede |

### Modulation (7 entries)
| Physical Pedal Key | Helix Model | Helix ID |
|-------------------|-------------|---------|
| `mxr phase 90` | Script Mod Phase | HD2_PhaserScriptModPhase |
| `ehx small clone` | PlastiChorus | HD2_ChorusPlastiChorus |
| `electro-harmonix small clone` | PlastiChorus | HD2_ChorusPlastiChorus |
| `boss ce-2` | 70s Chorus | HD2_Chorus70sChorus |
| `boss ce-2 chorus` | 70s Chorus | HD2_Chorus70sChorus |
| `mxr phase 100` | Deluxe Phaser | HD2_PhaserDeluxePhaser |
| `uni-vibe` | Ubiquitous Vibe | HD2_PhaserUbiquitousVibe |

**Total confirmed entries: 53** — exceeds the 40-entry minimum.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pod Go model ID suffix | Custom string manipulation | `getModelIdForDevice(model, blockType, device)` | Handles all categories, already tested |
| Pod Go exclusion guard | Custom exclusion set | `isModelAvailableForDevice(name, device)` | Source of truth in POD_GO_EXCLUDED_MODELS |
| DeviceTarget string union | Re-declare the type | Import `DeviceTarget` from `@/lib/helix` | Already defined with all 3 device values |
| SubstitutionMap type | Re-define array type | Import `SubstitutionMap` from `@/lib/helix` | Exact shape: `SubstitutionEntry[]` flat array |
| Model lookups | Write custom model dicts | Import from `@/lib/helix/models` dictionaries | Already comprehensive, 50+ distortion models |

---

## Common Pitfalls

### Pitfall 1: Wrong getModelIdForDevice signature
**What goes wrong:** Calling `getModelIdForDevice("HD2_DistTeemah", "distortion", device)` — passing a string ID instead of a HelixModel object.
**Why it happens:** The function name implies "get model ID" — easy to assume it takes an ID as input.
**How to avoid:** The first argument must be a `HelixModel` object with a `.id` property. Fetch the object from `DISTORTION_MODELS["Teemah!"]` etc.
**Warning signs:** TypeScript error on first argument type.

### Pitfall 2: Storing pre-computed Pod Go suffixed IDs
**What goes wrong:** `PEDAL_HELIX_MAP` stores `helixModel: "HD2_DistTeemahMono"` for all devices.
**Why it happens:** Testing only on Pod Go, forgetting Helix LT produces `"HD2_DistTeemah"`.
**How to avoid:** Store `HelixModel` objects; always call `getModelIdForDevice` at lookup time.
**Warning signs:** Helix LT presets fail to load (invalid model ID with Mono suffix).

### Pitfall 3: confidence: "direct" for fuzzy fallback
**What goes wrong:** `lookupPedal("Lovepedal COT50", device)` returns `confidence: "direct"`.
**Why it happens:** Copy-paste error in the fallback branch.
**How to avoid:** Only the PEDAL_HELIX_MAP exact-match branch may return `"direct"`. Fallback branches must return `"close"` or `"approximate"`.
**Warning signs:** Unit test SC-06 fails.

### Pitfall 4: Using PhysicalPedal.model instead of PhysicalPedal.fullName as lookup key
**What goes wrong:** Lookup by `pedal.model` ("TS9") misses entries keyed on `"ts9 tube screamer"`.
**Why it happens:** `PhysicalPedal.model` is the short name; `fullName` is the full canonical name.
**How to avoid:** Per `rig-intent.ts` line 14: `fullName` is the "primary mapping lookup key". Use `pedal.fullName.toLowerCase().trim()` for lookup, with secondary fallback on `pedal.model`.
**Warning signs:** Direct-match pedals return "close" confidence in tests.

### Pitfall 5: Tone Sovereign / Clawthorn Drive on Pod Go
**What goes wrong:** mapRigToSubstitutions returns entries with `helixModel: "HD2_DistToneSovereignMono"` for pod_go — this model does not exist on Pod Go firmware.
**Why it happens:** Tone Sovereign is in POD_GO_EXCLUDED_MODELS but could still be stored in PEDAL_HELIX_MAP.
**How to avoid:** Call `isModelAvailableForDevice(entry.model.name, device)` before returning a direct match. Fall to "close" tier with an available substitute if excluded.
**Warning signs:** Pod Go preset builder fails or loads with empty block.

### Pitfall 6: Object wrapper return type from mapRigToSubstitutions
**What goes wrong:** Function returns `{ substitutions: entries, count: entries.length }`.
**Why it happens:** Looks more descriptive, but SubstitutionMapSchema is defined as `z.array(...)`.
**How to avoid:** `SubstitutionMap = SubstitutionEntry[]`. Return the bare array.
**Warning signs:** Zod parse of function output fails at runtime.

---

## Code Examples

### Building a SubstitutionEntry from a map entry
```typescript
// Source: rig-intent.ts lines 35-48 (SubstitutionEntrySchema fields)
function buildEntry(
  physicalPedalName: string,
  entry: PedalMapEntry,
  device: DeviceTarget,
  confidence: "direct" | "close" | "approximate",
  knobPositions?: Record<string, "low" | "medium-low" | "medium-high" | "high">,
): SubstitutionEntry {
  const helixModelId = getModelIdForDevice(entry.model, entry.blockType, device);

  const parameterMapping: Record<string, number> | undefined = knobPositions
    ? translateKnobs(knobPositions, entry.knobMap ?? {})
    : undefined;

  return {
    physicalPedal: physicalPedalName,
    helixModel: helixModelId,                   // device-correct HD2_* ID
    helixModelDisplayName: entry.model.name,    // e.g. "Teemah!" from HelixModel.name
    substitutionReason: entry.substitutionReason,
    parameterMapping,
    confidence,
  };
}
```

### Knob zone translation
```typescript
// Source: Phase 18 spec — zones map to center of each zone range
const KNOB_ZONE_VALUES: Record<string, number> = {
  "low":         0.15,
  "medium-low":  0.35,
  "medium-high": 0.65,
  "high":        0.85,
};

function translateKnobs(
  knobPositions: Record<string, "low" | "medium-low" | "medium-high" | "high">,
  knobMap: Record<string, string>,  // physicalKnobName -> helixParamName
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [physicalKnob, zone] of Object.entries(knobPositions)) {
    const helixParam = knobMap[physicalKnob] ?? physicalKnob; // fallback: use same name
    result[helixParam] = KNOB_ZONE_VALUES[zone];
  }
  return result;
}
```

### Test file pattern (matches existing conventions)
```typescript
// src/lib/rig-mapping.test.ts
import { describe, it, expect } from "vitest";
import { lookupPedal, mapRigToSubstitutions, PEDAL_HELIX_MAP } from "./rig-mapping";
import type { RigIntent } from "./helix/rig-intent";  // relative import

describe("PEDAL_HELIX_MAP", () => {
  it("contains at least 40 entries", () => {
    expect(Object.keys(PEDAL_HELIX_MAP).length).toBeGreaterThanOrEqual(40);
  });
});

describe("lookupPedal", () => {
  it("returns confidence 'direct' for TS9 Tube Screamer", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.confidence).toBe("direct");
    expect(result.helixModel).toBe("HD2_DistScream808");
  });

  it("returns confidence 'direct' with Pod Go suffix for TS9", () => {
    const result = lookupPedal("TS9 Tube Screamer", "pod_go");
    expect(result.confidence).toBe("direct");
    expect(result.helixModel).toBe("HD2_DistScream808Mono");
  });

  it("returns confidence NOT 'direct' for unknown boutique pedal", () => {
    const result = lookupPedal("Lovepedal COT50", "helix_lt");
    expect(result.confidence).not.toBe("direct");
  });

  it("returns confidence 'approximate' for unknown pedal", () => {
    const result = lookupPedal("Boutique Unobtainium Fuzz", "helix_lt");
    expect(result.confidence).toBe("approximate");
  });
});

describe("mapRigToSubstitutions", () => {
  it("returns flat SubstitutionEntry array (not an object wrapper)", () => {
    const rig: RigIntent = {
      pedals: [{ brand: "Ibanez", model: "TS9", fullName: "TS9 Tube Screamer",
                 knobPositions: {}, imageIndex: 0, confidence: "high" }],
    };
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("pod_go produces Mono-suffixed distortion IDs", () => {
    const rig: RigIntent = {
      pedals: [{ brand: "Ibanez", model: "TS9", fullName: "TS9 Tube Screamer",
                 knobPositions: {}, imageIndex: 0, confidence: "high" }],
    };
    const result = mapRigToSubstitutions(rig, "pod_go");
    expect(result[0].helixModel).toMatch(/Mono$/);
  });

  it("helix_lt produces standard IDs (no suffix)", () => {
    const rig: RigIntent = {
      pedals: [{ brand: "Ibanez", model: "TS9", fullName: "TS9 Tube Screamer",
                 knobPositions: {}, imageIndex: 0, confidence: "high" }],
    };
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(result[0].helixModel).not.toMatch(/Mono$/);
    expect(result[0].helixModel).not.toMatch(/Stereo$/);
  });
});
```

---

## Files to Create in Phase 18

| File | Status | Notes |
|------|--------|-------|
| `src/lib/rig-mapping.ts` | CREATE | Main module — PEDAL_HELIX_MAP, lookupPedal(), mapRigToSubstitutions() |
| `src/lib/rig-mapping.test.ts` | CREATE | Vitest unit tests co-located with source |
| `src/lib/helix/index.ts` | POSSIBLY AMEND | Re-export rig-mapping exports if needed by downstream phases |

No files from Phase 17 are modified. `src/lib/helix/rig-intent.ts` is consumed via import only.

---

## Open Questions

1. **Should rig-mapping.ts be added to `src/lib/helix/index.ts` exports?**
   - What we know: index.ts exports all helix-related types and functions; rig-mapping.ts is in `src/lib/` (one level up), not inside `helix/`.
   - What's unclear: Whether downstream phases (Phase 19+) expect `import { lookupPedal } from "@/lib/helix"` or `import { lookupPedal } from "@/lib/rig-mapping"`.
   - Recommendation: Export directly from `@/lib/rig-mapping` — cleaner separation since rig-mapping is a consumer of helix internals, not a helix internal itself.

2. **Should lookupPedal() attempt partial/fuzzy string matching?**
   - What we know: The spec says "three match tiers." No mention of Levenshtein/fuzzy distance.
   - What's unclear: How to handle "Ibanez TS-9" vs "TS9 Tube Screamer" — dash vs no dash, with/without brand prefix.
   - Recommendation: Normalize keys (lowercase, strip leading brand name if it matches common brands, strip hyphens) before PEDAL_HELIX_MAP lookup. Keep secondary fallback on bare model short names (e.g., `"ts9"` maps to same entry as `"ts9 tube screamer"`).

3. **parameterMapping population: always or only when knobs present?**
   - What we know: `parameterMapping` is optional in SubstitutionEntrySchema. `PhysicalPedal.knobPositions` may be an empty Record.
   - Recommendation: Omit `parameterMapping` (set to `undefined`) when `knobPositions` is empty or when `knobMap` has no matching keys. This matches the Zod schema's `.optional()` — absent is cleaner than `{}`.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json`. Skipping this section per config.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/models.ts` lines 1099–1152 — `getModelIdForDevice`, `POD_GO_EXCLUDED_MODELS`, `POD_GO_EFFECT_SUFFIX`
- `src/lib/helix/rig-intent.ts` lines 1–55 — `SubstitutionEntrySchema`, `SubstitutionMapSchema`, `PhysicalPedalSchema`
- `src/lib/helix/index.ts` lines 1–23 — all barrel exports, confirmed import paths
- `src/lib/helix/types.ts` line 169 — `DeviceTarget` type definition
- `package.json` line 29 — vitest 4.0.18 devDependency
- `src/lib/helix/param-engine.test.ts`, `chain-rules.test.ts` — test pattern (vitest, relative imports)
- `npx vitest run` execution — 62 tests pass, confirms zero-config vitest setup

### Secondary (MEDIUM confidence)
- Category fallback model selection (Q7) — based on domain knowledge of guitar pedal circuit topologies combined with confirmed Helix model basedOn metadata in models.ts

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all imports verified from source files
- Architecture: HIGH — function signatures and type shapes confirmed
- Pitfalls: HIGH for implementation pitfalls (verified from source); MEDIUM for UX pitfalls (knob mapping)
- Entry count: HIGH — 53 entries enumerated above, exceeds 40 minimum

**Research date:** 2026-03-02
**Valid until:** 2026-06-01 (stable — Helix model database rarely changes)
