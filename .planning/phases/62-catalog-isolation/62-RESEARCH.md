# Phase 62: Catalog Isolation - Research

**Researched:** 2026-03-05
**Domain:** TypeScript module architecture, Zod schema factories, internal refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**All Four Families Get Fully Independent Catalogs**
- Every family (helix, stomp, podgo, stadium) gets its own complete catalog for ALL model categories: amps, effects, cabs, EQ
- No shared base catalog — each family owns its complete model set
- No exclusion lists — instead of "all models minus 3", Pod Go catalog simply doesn't contain the 3 excluded models
- Rationale: Stadium is the actively-developed product. It will receive new Agoura amps, effects, and potentially new cabs in future firmware updates. HD2 families (Helix, Stomp, Pod Go) are effectively frozen products that won't get new models.
- Duplication of HD2 data across helix/stomp/podgo catalogs is acceptable

**Effect Catalog Scoping**
- Each family gets its own independent effect catalog (distortion, delay, reverb, modulation, dynamics, wah, volume, EQ)
- Pod Go effects: HD2 models minus 3 excluded, with Mono/Stereo ID suffix mapping built into its catalog
- Stadium effects: HD2-compatible effects plus Stadium-specific EQ models, minus 3 removed EQs
- Helix effects: Full HD2 set
- Stomp effects: Full HD2 set (same as Helix — stomp limit is on block count, not available models)
- Per-family EFFECT_NAMES arrays for Zod schema validation

**Cab Catalog Scoping**
- Each family gets its own cab catalog (even though all currently use the same HD2 cabs)
- Future-proofs for Stadium getting Agoura-native cabs
- Per-family CAB_NAMES arrays for Zod schema validation

### Claude's Discretion

**Catalog Module Structure (Claude decides)**
- Claude picks the file/directory structure for per-family catalogs
- Claude decides whether data moves to family files or stays in models.ts with filtered re-exports
- Claude decides what happens to getModelListForPrompt() (move to family catalogs or leave for Phase 65)
- Claude decides getAllModels() strategy (union or per-family)
- Constraints: Must follow existing project conventions (lowercase-with-hyphens filenames, co-located tests, @/ imports)

**ToneIntent Schema Factory (Claude decides)**
- Claude picks whether getToneIntentSchema() takes DeviceFamily or DeviceTarget
- Claude picks whether families produce distinct TypeScript types or one generic ToneIntent
- Claude decides whether to delete the global ToneIntentSchema export immediately or keep it temporarily
- Claude picks where the factory function lives
- Constraint: Claude's constrained decoding must structurally prevent cross-family amp selection (CAT-04)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAT-01 | Stadium family has its own amp catalog module containing only Agoura amps — no HD2 amps visible | Per-family catalog files; STADIUM_AMPS already exists in models.ts — move to stadium catalog |
| CAT-02 | Helix/Stomp/PodGo families have their own amp catalog modules containing only HD2 amps — no Agoura amps visible | AMP_MODELS already contains only HD2 amps — copy into three HD2-family catalog files |
| CAT-03 | Global merged AMP_NAMES is eliminated — no single enum contains both HD2 and Agoura amp names | Delete AMP_NAMES from models.ts; replace with per-family AMP_NAMES derivations in family catalog files |
| CAT-04 | Per-family ToneIntent Zod schema constrains ampName to only that family's catalog | getToneIntentSchema(family) factory returns z.object() with family-specific z.enum(AMP_NAMES) |
| CAT-05 | Effect catalogs are scoped per family (Pod Go Mono/Stereo suffixes, Stomp subset, Stadium extended set) | Per-family EFFECT_NAMES arrays; Pod Go suffix mapping baked into podgo catalog |
</phase_requirements>

---

## Summary

Phase 62 is a pure internal refactor with zero external API changes and zero new features. The goal is structural: prevent Claude's constrained decoding from selecting cross-family amp models by making the schema itself contain only valid model names for the active device family. Currently, `AMP_NAMES` merges all HD2 and Agoura amp names into a single global array used by `ToneIntentSchema` — a Helix Floor could theoretically receive an Agoura amp name through constrained decoding because the schema allows it.

The implementation decomposes `models.ts` (1600+ lines) into per-family catalog files (`helix-catalog.ts`, `stomp-catalog.ts`, `podgo-catalog.ts`, `stadium-catalog.ts`) that each export their own `AMP_NAMES`, `CAB_NAMES`, and `EFFECT_NAMES` arrays. A `getToneIntentSchema(family: DeviceFamily)` factory replaces the global `ToneIntentSchema` export, dispatching to the correct per-family name arrays. The planner and generate route consume the factory by passing the `DeviceFamily` resolved at pipeline entry (already done in Phase 61).

The STATE.md explicitly labels this the "highest-risk phase" because `AMP_MODELS` is imported by `chain-rules.ts`, `param-engine.ts`, and `validate.ts`. All import sites must update atomically — partial migration leaves the codebase in an inconsistent state. The safe approach is: create family catalog files first (additive, no breakage), wire the schema factory, then delete the global merged exports last.

**Primary recommendation:** Create four family catalog files under `src/lib/helix/catalogs/` that re-export model data from `models.ts` initially, then migrate data progressively. The schema factory lives in `tone-intent.ts`. Delete global `AMP_NAMES` only after all consumers are updated.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^3.x (already in project) | Per-family ToneIntent schema validation | Already used for ToneIntentSchema; z.enum() is the constraint mechanism |
| TypeScript | ^5.x (already in project) | Type-safe family dispatch, DeviceFamily literal type | assertNever pattern already established in device-family.ts |
| Vitest | ^4.0.18 (already in project) | Test runner for co-located .test.ts files | Already running 271 tests; `npx vitest run` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | — | — | — |

No new dependencies required. This is a pure refactor using existing tools.

**Installation:** No new packages.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/helix/
├── catalogs/                      # NEW: per-family catalog modules
│   ├── helix-catalog.ts           # HD2 amps + full effects + cabs
│   ├── helix-catalog.test.ts      # co-located tests (CAT-01, CAT-02, CAT-05)
│   ├── stomp-catalog.ts           # HD2 amps + full effects + cabs (same as helix)
│   ├── stomp-catalog.test.ts
│   ├── podgo-catalog.ts           # HD2 amps minus 3 exclusions + suffixed effects + cabs
│   ├── podgo-catalog.test.ts
│   ├── stadium-catalog.ts         # Agoura amps + HD2 effects + Stadium EQ + cabs
│   └── stadium-catalog.test.ts
├── models.ts                      # SHRINKS: remove AMP_NAMES, CAB_NAMES, EFFECT_NAMES
│                                  # Keep: HelixModel, BLOCK_TYPES, AMP_MODELS, CAB_MODELS,
│                                  # DISTORTION_MODELS, DELAY_MODELS, REVERB_MODELS,
│                                  # MODULATION_MODELS, DYNAMICS_MODELS, EQ_MODELS,
│                                  # WAH_MODELS, VOLUME_MODELS, STADIUM_AMPS, STADIUM_EQ_MODELS,
│                                  # getAllModels, getModelListForPrompt, POD_GO_EXCLUDED_MODELS,
│                                  # POD_GO_EFFECT_SUFFIX, getModelIdForDevice,
│                                  # getBlockTypeForDevice, isModelAvailableForDevice
├── tone-intent.ts                 # CHANGES: add getToneIntentSchema(family) factory;
│                                  # keep ToneIntentSchema temporarily for backwards compat
├── device-family.ts               # UNCHANGED (Phase 61 output)
├── index.ts                       # CHANGES: re-export getToneIntentSchema, family catalogs
└── [all other files]              # UNCHANGED
```

**Decision rationale for `catalogs/` subdirectory:** Keeps the flat `src/lib/helix/` directory from accumulating 4 more top-level files. All four catalog files are cohesive — grouping them in a subdirectory makes the addition self-contained and identifiable. The project uses lowercase-with-hyphens naming (device-family.ts, chain-rules.ts), so `catalogs/helix-catalog.ts` follows convention.

### Pattern 1: Family Catalog Module

Each catalog exports its own AMP_NAMES, CAB_NAMES, EFFECT_NAMES derived from the master model objects in models.ts. No data duplication of the full HelixModel objects — just filtered key arrays.

**What:** Catalog files re-export model objects from models.ts and derive name tuples from them.
**When to use:** Additive approach — no data moves, just new filtered views.

```typescript
// src/lib/helix/catalogs/helix-catalog.ts
import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
} from "../models";

// Helix family: full HD2 amps (no Agoura)
export const HELIX_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];
export const HELIX_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];
export const HELIX_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];

// Re-export model objects for consumers that need them
export { AMP_MODELS, CAB_MODELS } from "../models";
```

```typescript
// src/lib/helix/catalogs/stadium-catalog.ts
import {
  STADIUM_AMPS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  STADIUM_EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
} from "../models";

// Stadium family: Agoura amps only (no HD2 amps)
export const STADIUM_AMP_NAMES = Object.keys(STADIUM_AMPS) as [string, ...string[]];
export const STADIUM_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

// Stadium effects: HD2 effects + Stadium EQ, minus 3 removed EQs
// Note: EQ_MODELS excluded entirely; STADIUM_EQ_MODELS is the replacement.
// "Simple EQ", "Low and High Cut", "Tilt EQ" are absent from STADIUM_EQ_MODELS already.
export const STADIUM_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
  ...Object.keys(STADIUM_EQ_MODELS),
] as [string, ...string[]];
```

```typescript
// src/lib/helix/catalogs/podgo-catalog.ts
import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
  POD_GO_EXCLUDED_MODELS,
} from "../models";

// Pod Go: HD2 amps minus nothing (amp exclusions are amp-level, not in POD_GO_EXCLUDED_MODELS)
export const PODGO_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];
export const PODGO_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

// Pod Go effects: HD2 effects minus 3 excluded ("Tone Sovereign", "Clawthorn Drive", "Cosmos Echo")
// EQ_MODELS included: Pod Go supports EQ blocks
const podGoFilterEffects = (models: Record<string, unknown>): string[] =>
  Object.keys(models).filter(name => !POD_GO_EXCLUDED_MODELS.has(name));

export const PODGO_EFFECT_NAMES = [
  ...podGoFilterEffects(DISTORTION_MODELS),
  ...podGoFilterEffects(DELAY_MODELS),
  ...podGoFilterEffects(REVERB_MODELS),
  ...podGoFilterEffects(MODULATION_MODELS),
  ...podGoFilterEffects(DYNAMICS_MODELS),
] as [string, ...string[]];

// Pod Go Mono/Stereo suffix mapping — lives here, not in models.ts
// This makes the podgo catalog self-contained
export const PODGO_EFFECT_SUFFIX: Record<string, "Mono" | "Stereo"> = {
  distortion: "Mono",
  dynamics: "Mono",
  eq: "Mono",
  pitch: "Mono",
  delay: "Stereo",
  reverb: "Stereo",
  modulation: "Stereo",
  wah: "Stereo",
  volume: "Stereo",
};
```

### Pattern 2: getToneIntentSchema Factory

**What:** A function that takes `DeviceFamily` and returns the correct Zod schema with family-specific `z.enum()` for `ampName`, `cabName`, and effects.
**When to use:** Replaces direct import of global `ToneIntentSchema` everywhere.

```typescript
// src/lib/helix/tone-intent.ts (additions)
import { z } from "zod";
import type { DeviceFamily } from "./device-family";
import {
  HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES,
} from "./catalogs/helix-catalog";
import {
  STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES,
} from "./catalogs/stadium-catalog";
import {
  PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES,
} from "./catalogs/podgo-catalog";
import {
  STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES,
} from "./catalogs/stomp-catalog";
import { VARIAX_MODEL_NAMES } from "./models";

function buildToneIntentSchema(
  ampNames: [string, ...string[]],
  cabNames: [string, ...string[]],
  effectNames: [string, ...string[]],
) {
  const EffectIntent = z.object({
    modelName: z.enum(effectNames),
    role: z.enum(["always_on", "toggleable", "ambient"]),
  });

  return z.object({
    ampName: z.enum(ampNames),
    cabName: z.enum(cabNames),
    secondAmpName: z.enum(ampNames).optional(),
    secondCabName: z.enum(cabNames).optional(),
    guitarType: z.enum(["single_coil", "humbucker", "p90"]),
    genreHint: z.string().optional(),
    effects: z.array(EffectIntent).max(6),
    snapshots: z.array(SnapshotIntentSchema).min(3).max(8),
    tempoHint: z.number().int().min(60).max(200).optional(),
    presetName: z.string().max(32).optional(),
    description: z.string().optional(),
    guitarNotes: z.string().optional(),
    variaxModel: z.enum(VARIAX_MODEL_NAMES).optional(),
  }).refine(
    (data) => !data.secondAmpName || data.secondCabName,
    { message: "secondCabName is required when secondAmpName is provided", path: ["secondCabName"] }
  );
}

export function getToneIntentSchema(family: DeviceFamily) {
  switch (family) {
    case "helix":
      return buildToneIntentSchema(HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES);
    case "stomp":
      return buildToneIntentSchema(STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES);
    case "podgo":
      return buildToneIntentSchema(PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES);
    case "stadium":
      return buildToneIntentSchema(STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES);
    default:
      // TypeScript exhaustiveness check pattern (from device-family.ts)
      throw new Error(`Unknown DeviceFamily: ${String(family)}`);
  }
}

// TEMPORARY backwards-compat shim — delete after planner.ts and all consumers updated
// @deprecated Use getToneIntentSchema(family) instead
export const ToneIntentSchema = buildToneIntentSchema(
  [...HELIX_AMP_NAMES, ...STADIUM_AMP_NAMES] as [string, ...string[]],
  HELIX_CAB_NAMES,
  HELIX_EFFECT_NAMES,
);
```

### Pattern 3: Planner Integration

The planner must be updated to call `getToneIntentSchema(family)` instead of the global `ToneIntentSchema`. The `DeviceFamily` is already resolved at pipeline entry in `route.ts` (Phase 61).

```typescript
// src/lib/planner.ts — key change
import { getToneIntentSchema } from "@/lib/helix";
import type { DeviceFamily } from "@/lib/helix";

// callClaudePlanner must accept DeviceFamily:
export async function callClaudePlanner(
  messages: ...,
  device: DeviceTarget,
  family: DeviceFamily,  // NEW parameter
  ...
) {
  const schema = getToneIntentSchema(family);
  // zodOutputFormat uses the family-specific schema
  const outputFormat = zodOutputFormat(schema, "toneIntent");
  ...
}
```

### Pattern 4: ToneIntent Type

The Zod infer type from `getToneIntentSchema(family)` will be the same TypeScript shape regardless of family (all fields identical, just enum values differ). Using a single `ToneIntent` type is correct — the runtime constraint is in the schema enum, not in the TypeScript type.

```typescript
// ToneIntent type stays as-is — inferred from ANY family schema since shape is identical
export type ToneIntent = z.infer<ReturnType<typeof getToneIntentSchema>>;
```

### Anti-Patterns to Avoid

- **Migrating data out of models.ts first:** Moving HelixModel objects before the consumer sites are updated will break chain-rules.ts, param-engine.ts, validate.ts. Create catalog files that import from models.ts rather than duplicating data.
- **Deleting global AMP_NAMES before all consumers updated:** tone-intent.ts, index.ts, and planner.ts all import AMP_NAMES. Remove the global after all three are updated in the same commit.
- **Creating distinct TypeScript types per family:** `HelixToneIntent`, `StadiumToneIntent`, etc. would ripple through chain-rules.ts, param-engine.ts, validate.ts, route.ts. One generic `ToneIntent` type works — the schema enum is the safety constraint.
- **Passing DeviceTarget to getToneIntentSchema instead of DeviceFamily:** DeviceFamily is the right abstraction here (4 values, not 9). Family is already resolved at pipeline entry.
- **Making catalogs/` import from `@/lib/helix`:** The barrel imports from index.ts would create circular dependencies. Catalog files must import from `../models` directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enum validation that prevents cross-family names | Custom runtime check in chain-rules | z.enum() in Zod schema | Constrained decoding enforces the enum at the schema level — Claude cannot output an invalid name |
| Type safety for family dispatch in getToneIntentSchema | Manual if/else with type assertions | switch + default throw | Same pattern already in resolveFamily() and getCapabilities() — assertNever pattern ensures exhaustiveness |
| Filtering HD2 models from Stadium catalog | Runtime filter at call time | Static filtered export in catalog file | Static guarantees no cross-family name escapes into prompt or schema |

**Key insight:** The z.enum() in Zod is what drives Claude's constrained decoding — the model literally cannot output a token that isn't in the enum. Building a runtime check would only catch errors after generation; the enum prevents them structurally.

---

## Common Pitfalls

### Pitfall 1: Circular Import from Barrel File

**What goes wrong:** `catalogs/stadium-catalog.ts` imports from `@/lib/helix` (the barrel `index.ts`). Since `index.ts` exports from `tone-intent.ts`, which will import from catalog files, this creates a cycle.
**Why it happens:** Lazy use of the barrel import alias instead of direct file imports.
**How to avoid:** Catalog files must use relative imports from `../models` directly. Never import from the barrel in files that are re-exported by the barrel.
**Warning signs:** TypeScript "circular reference" errors at compile time, or vitest hanging on import.

### Pitfall 2: Partial Migration Leaves Broken State

**What goes wrong:** Global AMP_NAMES is deleted from models.ts before tone-intent.ts is updated. TypeScript throws immediately — but more subtly, if the barrel's AMP_NAMES export is removed before index.ts is updated, any file that imports from `@/lib/helix` will break.
**Why it happens:** Multi-file refactors have ordering dependencies.
**How to avoid:** Create family catalog files first (no deletions). Update all consumers (tone-intent.ts, planner.ts, index.ts). Only then delete global AMP_NAMES, CAB_NAMES, EFFECT_NAMES. Run `npx vitest run` at each step.
**Warning signs:** TypeScript compile errors on `AMP_NAMES` import not found.

### Pitfall 3: stomp and helix Catalogs Appear Identical

**What goes wrong:** Since stomp uses full HD2 amps and full HD2 effects (same as helix), a reviewer or future contributor wonders why they're separate files.
**Why it happens:** The families are currently identical in data but architecturally separate — stomp will eventually have different constraints (and already has different block limits).
**How to avoid:** Add a comment in stomp-catalog.ts explaining the rationale: stomp and helix share identical model sets today, but stomp independence future-proofs for stomp-specific model additions without touching helix code.
**Warning signs:** Someone DRYs stomp into helix, breaking the independence guarantee.

### Pitfall 4: planner.ts buildPlannerPrompt Still Uses Global AMP_MODELS Directly

**What goes wrong:** `buildPlannerPrompt()` in planner.ts currently accesses `AMP_MODELS` directly to build the `cabAffinityByFamily` section (line 42). After catalog isolation, it should access the family's amp catalog.
**Why it happens:** The cab affinity section is built from all `AMP_MODELS` entries — it doesn't filter by Stadium. This is currently correct because Stadium amps are in `STADIUM_AMPS`, but after isolation the prompt builder should use the correct per-family amp catalog.
**How to avoid:** Update `buildPlannerPrompt()` to accept `DeviceFamily` and use the correct catalog. This is already part of the planner update required for the schema factory.
**Warning signs:** Stadium preset generation prompt lists HD2 amp cab affinities alongside Agoura amp affinities (cross-family data in the prompt).

### Pitfall 5: getAllModels() in validate.ts Sees Cross-Family Models

**What goes wrong:** `validate.ts` calls `getAllModels()` to build `VALID_IDS`. After catalog isolation, this is still correct — `VALID_IDS` should be a union of all valid IDs for ID format validation. This is not a cross-family contamination risk because VALID_IDS validates ID format (model.id), not amp name selection.
**Why it happens:** Confusion between name-level validation (schema enum) and ID-level validation (VALID_IDS in validate.ts).
**How to avoid:** Leave `getAllModels()` and `VALID_IDS` in validate.ts unchanged. The name enum is what prevents cross-family selection. The VALID_IDS set validates that the assembled chain has real hardware IDs — it can legitimately contain all IDs.
**Warning signs:** Treating validate.ts as a catalog-isolation concern (it is not).

### Pitfall 6: EFFECT_NAMES Scope Confusion for EQ/WAH/VOLUME

**What goes wrong:** The current global `EFFECT_NAMES` excludes EQ, WAH, and VOLUME from the Zod schema (Knowledge Layer inserts them). Per-family `EFFECT_NAMES` arrays must preserve the same exclusion. If EQ/WAH/VOLUME are accidentally included in a family's EFFECT_NAMES, Claude could double-insert them in the effect chain.
**Why it happens:** Comment in models.ts ("exclude EQ, WAH, VOLUME -- Knowledge Layer handles those") is easy to miss when building new catalog files.
**How to avoid:** Do not include `EQ_MODELS`, `WAH_MODELS`, or `VOLUME_MODELS` keys in the `EFFECT_NAMES` tuples in any family catalog. Stadium catalog exception: `STADIUM_EQ_MODELS` IS included in Stadium's EFFECT_NAMES because the Stadium 7-band EQ is a user-selectable block in tone-intent (unlike the HD2 EQ handled silently by the Knowledge Layer).
**Warning signs:** Test output showing double EQ blocks in assembled signal chain.

---

## Code Examples

### Building a Per-Family Name Tuple

```typescript
// z.enum() requires [string, ...string[]] (non-empty tuple), not string[]
// Pattern established in models.ts line 1340
export const HELIX_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];

// For filtered catalogs (Pod Go), use the same cast after filtering
const filtered = Object.keys(DISTORTION_MODELS).filter(
  name => !POD_GO_EXCLUDED_MODELS.has(name)
);
export const PODGO_DISTORTION_NAMES = filtered as [string, ...string[]];
```

### Using the Schema Factory in planner.ts

```typescript
// Before (Phase 61 state):
import { ToneIntentSchema } from "@/lib/helix";
const outputFormat = zodOutputFormat(ToneIntentSchema, "toneIntent");

// After (Phase 62):
import { getToneIntentSchema } from "@/lib/helix";
import type { DeviceFamily } from "@/lib/helix";
const schema = getToneIntentSchema(family);  // family: DeviceFamily from route.ts
const outputFormat = zodOutputFormat(schema, "toneIntent");
```

### Test Pattern for CAT-01 / CAT-02 (Structural Isolation)

Co-located test files follow the existing pattern (device-family.test.ts, chain-rules.test.ts):

```typescript
// src/lib/helix/catalogs/stadium-catalog.test.ts
import { describe, it, expect } from "vitest";
import { STADIUM_AMP_NAMES } from "./stadium-catalog";
import { HELIX_AMP_NAMES } from "./helix-catalog";

describe("CAT-01: Stadium amp catalog isolation", () => {
  it("STADIUM_AMP_NAMES contains only Agoura amps", () => {
    for (const name of STADIUM_AMP_NAMES) {
      expect(name, `"${name}" should start with "Agoura"`).toMatch(/^Agoura /);
    }
  });

  it("STADIUM_AMP_NAMES does not contain any HD2 amp names", () => {
    const stadiumSet = new Set(STADIUM_AMP_NAMES);
    for (const name of HELIX_AMP_NAMES) {
      expect(stadiumSet.has(name), `"${name}" should not be in Stadium catalog`).toBe(false);
    }
  });
});

describe("CAT-02: Helix amp catalog isolation", () => {
  it("HELIX_AMP_NAMES contains no Agoura amps", () => {
    for (const name of HELIX_AMP_NAMES) {
      expect(name, `"${name}" should not start with "Agoura"`).not.toMatch(/^Agoura /);
    }
  });
});
```

```typescript
// CAT-04: Schema factory test
import { getToneIntentSchema } from "../tone-intent";

describe("CAT-04: Schema factory prevents cross-family selection", () => {
  it("Stadium schema only accepts Agoura amp names", () => {
    const schema = getToneIntentSchema("stadium");
    // Parsing an HD2 amp name into Stadium schema should fail
    const result = schema.safeParse({
      ampName: "US Deluxe Nrm",  // HD2 amp — not valid for stadium
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Rhythm", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("Helix schema rejects Agoura amp names", () => {
    const schema = getToneIntentSchema("helix");
    const result = schema.safeParse({
      ampName: "Agoura US Clean",  // Stadium amp — not valid for helix
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Rhythm", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
    });
    expect(result.success).toBe(false);
  });
});
```

### Counting Models (Know What You're Working With)

From code analysis of models.ts:
- `AMP_MODELS`: ~80 HD2 amp entries (lines 79–887)
- `STADIUM_AMPS`: 18 Agoura amp entries (lines 1085–1306)
- `CAB_MODELS`: present at line 888
- `DISTORTION_MODELS`: ~39 entries (lines 916–954)
- `DELAY_MODELS`: ~27 entries (lines 955–981)
- `REVERB_MODELS`: ~23 entries (lines 982–1004)
- `MODULATION_MODELS`: ~25 entries (lines 1005–1029)
- `DYNAMICS_MODELS`: ~17 entries (lines 1030–1046)
- `EQ_MODELS`: present at lines 1047–1058 (HD2 EQ — excluded from EFFECT_NAMES in schema)
- `WAH_MODELS`: present at lines 1059–1073
- `VOLUME_MODELS`: present at lines 1074–1081
- `STADIUM_EQ_MODELS`: 2 entries ("Stadium Parametric EQ" + "10 Band Graphic", lines 1314–1333)
- `POD_GO_EXCLUDED_MODELS`: 3 models ("Tone Sovereign", "Clawthorn Drive", "Cosmos Echo")

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global AMP_NAMES with both HD2 and Agoura | Per-family AMP_NAMES tuples | Phase 62 | Zod schema enum becomes the structural isolation |
| Single ToneIntentSchema for all devices | getToneIntentSchema(family) factory | Phase 62 | Constrained decoding becomes family-aware |
| stadiumOnly: boolean flag as runtime filter | Structural absence from catalog | Phase 62 | stadiumOnly field becomes unnecessary (can be removed from HelixModel interface if desired) |
| Device-specific filtering in getModelListForPrompt | Stays in models.ts for now | Phase 65 | Prompt templates per device handled later |

**Deprecated/outdated after Phase 62:**
- `AMP_NAMES` global export: replaced by per-family arrays
- `CAB_NAMES` global export: replaced by per-family arrays
- `EFFECT_NAMES` global export: replaced by per-family arrays
- `ToneIntentSchema` global export: replaced by `getToneIntentSchema(family)` factory
- `stadiumOnly` flag on HelixModel: becomes conceptually unused (Stadium models live in stadium catalog; non-Stadium catalogs simply don't include them). Can be left as-is for now — removing it is a cosmetic change, not required for Phase 62.

---

## Open Questions

1. **Does getToneIntentSchema result in a performance concern?**
   - What we know: The factory creates a new Zod schema object on every call. Zod schema creation is synchronous and fast.
   - What's unclear: Whether zodOutputFormat (Anthropic SDK helper) has any caching assumption about the schema object identity.
   - Recommendation: Memoize by family in the factory using a module-level Map if tests reveal any concern. Most likely not needed — schema is created once per request.

2. **What happens to the stadiumOnly field on HelixModel?**
   - What we know: After Phase 62, no code should need the stadiumOnly flag to filter — Stadium models are in stadium catalog, others aren't.
   - What's unclear: Whether getModelListForPrompt() still uses it (it currently does for the non-Stadium path).
   - Recommendation: Leave stadiumOnly in place until getModelListForPrompt() is refactored (Phase 65). Do not remove the field in Phase 62 — that is Phase 64/65 cleanup.

3. **Does planner.ts buildPlannerPrompt's cabAffinityByFamily need updating?**
   - What we know: Line 42 of planner.ts iterates `AMP_MODELS` (HD2 only) for cab affinity — it misses STADIUM_AMPS. This is currently handled by the `stadium ?` check in the prompt text, which tells Claude to use Agoura-native cabs.
   - What's unclear: Whether Phase 62 should also fix this prompt gap or leave it for Phase 65.
   - Recommendation: Fix this in Phase 62 as part of the planner update — pass the correct per-family amp catalog to buildPlannerPrompt. Stadium cab affinity is in STADIUM_AMPS entries already.

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` — the key is absent. Treating as disabled (default: the project uses plain vitest, not nyquist). Including test mapping here regardless since CAT-01 through CAT-05 all have clear automated coverage paths.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run src/lib/helix/catalogs/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | Stadium catalog contains only Agoura amps | unit | `npx vitest run src/lib/helix/catalogs/stadium-catalog.test.ts` | No — Wave 0 |
| CAT-02 | Helix/Stomp/PodGo catalogs contain only HD2 amps | unit | `npx vitest run src/lib/helix/catalogs/helix-catalog.test.ts` | No — Wave 0 |
| CAT-03 | Global AMP_NAMES eliminated (no export from index.ts) | unit | `npx vitest run` (TS compile fails if AMP_NAMES still exported) | No — Wave 0 |
| CAT-04 | Per-family schema rejects cross-family amp names | unit | `npx vitest run src/lib/helix/tone-intent.test.ts` (new) | No — Wave 0 |
| CAT-05 | Pod Go EFFECT_NAMES excludes 3 removed models | unit | `npx vitest run src/lib/helix/catalogs/podgo-catalog.test.ts` | No — Wave 0 |

**Regression gate:** `npx vitest run` (all 271 existing tests must remain green throughout refactor)

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/helix/catalogs/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `src/lib/helix/catalogs/helix-catalog.test.ts` — covers CAT-02 (helix)
- [ ] `src/lib/helix/catalogs/stomp-catalog.test.ts` — covers CAT-02 (stomp)
- [ ] `src/lib/helix/catalogs/podgo-catalog.test.ts` — covers CAT-02 (podgo), CAT-05
- [ ] `src/lib/helix/catalogs/stadium-catalog.test.ts` — covers CAT-01
- [ ] `src/lib/helix/tone-intent.test.ts` — covers CAT-03, CAT-04

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/lib/helix/models.ts` — verified AMP_MODELS, STADIUM_AMPS, STADIUM_EQ_MODELS, POD_GO_EXCLUDED_MODELS, all effect model exports, AMP_NAMES construction, EFFECT_NAMES construction
- Direct code inspection of `src/lib/helix/tone-intent.ts` — verified ToneIntentSchema structure and z.enum() pattern
- Direct code inspection of `src/lib/helix/device-family.ts` — verified DeviceFamily type, assertNever pattern, exhaustive switch
- Direct code inspection of `src/lib/helix/index.ts` — verified all barrel exports and current import surface
- Direct code inspection of `src/lib/helix/validate.ts` — verified getAllModels() usage and VALID_IDS construction
- Direct code inspection of `src/lib/helix/chain-rules.ts` — verified model catalog imports (AMP_MODELS, STADIUM_AMPS, STADIUM_EQ_MODELS, all effect catalogs)
- Direct code inspection of `src/lib/helix/param-engine.ts` — verified AMP_MODELS and STADIUM_AMPS imports
- Direct code inspection of `src/lib/planner.ts` — verified ToneIntentSchema import, AMP_MODELS direct usage for cab affinity
- Direct code inspection of `src/app/api/generate/route.ts` — verified resolveFamily() call, deviceFamily variable ready for downstream
- Vitest run: 271 tests passing — verified baseline health before refactor

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — "highest-risk phase" designation, atomic import site update requirement
- `.planning/phases/62-catalog-isolation/62-CONTEXT.md` — all locked decisions and discretion areas

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools already in project
- Architecture: HIGH — derived from direct code inspection; catalog file structure matches project conventions
- Pitfalls: HIGH — derived from actual code paths observed in models.ts, chain-rules.ts, param-engine.ts, validate.ts
- Test patterns: HIGH — established vitest patterns from existing test files

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable codebase — no fast-moving dependencies)
