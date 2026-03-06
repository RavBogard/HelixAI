# Stack Research

**Domain:** HelixTones v5.0 — Device-First Architecture Rework
**Researched:** 2026-03-05
**Confidence:** HIGH overall — TypeScript patterns verified against official docs and codebase, firmware params extracted from 12 real amp blocks across 11 .hsp files, Zod 4.3.6 discriminatedUnion verified in installed package

---

## Scope

This file covers ONLY what is new or changed for v5.0. The validated existing stack is:

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1.6 |
| Language | TypeScript | ^5 |
| UI | Tailwind CSS | ^4 |
| AI (generation) | Claude Sonnet 4.6 via `@anthropic-ai/sdk` | ^0.78.0 |
| AI (chat) | Gemini 2.5 Flash via `@google/genai` | ^1.42.0 |
| Auth + DB + Storage | Supabase | `@supabase/supabase-js` ^2.98.0, `@supabase/ssr` ^0.9.0 |
| Hosting | Vercel (serverless) | — |
| Schema validation | Zod | ^4.3.6 |
| Testing | Vitest | ^4.0.18 |

v5.0 has four tracks:

1. **Device-first flow** — device picker moves to conversation start, routing all subsequent steps to device-specific paths
2. **Device-family module architecture** — eliminate 17+ guard sites by routing to per-device modules from the beginning
3. **Stadium firmware completeness** — extract all 27+ params from real .hsp corpus, eliminate param bleed
4. **Per-device planner prompts** — each device gets its own prompt with only its model catalog

---

## The Single Most Important Finding

**No new npm packages are needed for v5.0.**

All work is TypeScript source reorganization and new TypeScript patterns. The existing stack
already has every tool required:

- TypeScript discriminated unions handle device-family routing — `z.discriminatedUnion()` verified working in Zod 4.3.6
- Node.js `Buffer` + `JSON.parse()` handles .hsp binary parsing for param extraction (8-byte magic header + JSON)
- Vitest handles per-device test suites via `describe()` nesting and file-per-device organization
- The existing `scripts/` pattern (`npx tsx scripts/extract-params.ts`) handles one-shot extraction tooling

Zero new dependencies means zero integration risk and no compatibility testing.

---

## Recommended Stack

### Core Technologies — No Changes

| Technology | Version | Purpose | v5.0 Impact |
|------------|---------|---------|-------------|
| TypeScript | ^5 | Type safety | New discriminated union types: `DeviceFamily`, per-family `ToneIntent` schema variants; exhaustiveness checking via `never` guard |
| Zod | ^4.3.6 | Runtime schema validation | `z.discriminatedUnion('family', [...])` for device-family routing — verified working in installed version |
| Vitest | ^4.0.18 | Testing | Per-device test files: `helix.test.ts`, `stadium.test.ts`, `stomp.test.ts`, `podgo.test.ts` using existing `describe()` + `it()` pattern |
| Next.js | 16.1.6 | App framework | No changes to API routes — device selection passed as parameter, routing happens in `lib/helix/` |
| `@anthropic-ai/sdk` | ^0.78.0 | Claude Sonnet 4.6 planner | `buildPlannerPrompt()` refactored to `buildPlannerPromptForDevice(family)` — same API, different prompt text and model list per family |

### Supporting Tooling — One-Shot Script Only

| Tool | Version | Purpose | How Used |
|------|---------|---------|----------|
| `tsx` (already in environment) | n/a | Run TypeScript extraction scripts | `npx tsx scripts/extract-stadium-params.ts` — one-shot param extraction, not added to `package.json` |

`tsx` is already available via `npx` with zero install. The extraction script reads real .hsp files
from the local corpus, prints the complete param set per amp model, and terminates. Output is
pasted into `STADIUM_AMPS` defaultParams in `models.ts`. This is a development tool, not a
runtime dependency.

---

## Feature Area 1: TypeScript Patterns for Device-Family Routing

### The Problem

Current code has 17+ guard sites:
```typescript
// Repeated everywhere — chain-rules, param-engine, planner, validate
if (isPodGo(device)) { ... }
if (isStadium(device)) { ... }
if (isStomp(device)) { ... }
```

This means every new device adds a guard site in every module. It also means the planner
prompt, model catalog, and chain rules all handle every device with runtime branching.

### The Solution: Discriminated Union with Module-Per-Family

**Step 1: Define device families as a discriminated union in `types.ts`**

```typescript
// Device families — the routing unit for v5.0
// Each family maps to a specific builder, prompt, model catalog, and chain rules
export type DeviceFamily =
  | "helix"   // Helix Floor, Helix LT, Helix Rack — .hlx, dual-DSP, dual-amp
  | "stomp"   // HX Stomp, HX Stomp XL — .hlx, 6-9 block budget
  | "podgo"   // Pod Go, Pod Go XL — .pgp, 4-effect limit
  | "stadium"; // Helix Stadium, Helix Stadium XL — .hsp, Agoura amps, slot-based

// Map device → family (single source of truth)
export const DEVICE_FAMILY: Record<DeviceTarget, DeviceFamily> = {
  helix_lt:       "helix",
  helix_floor:    "helix",
  helix_stomp:    "stomp",
  helix_stomp_xl: "stomp",
  pod_go:         "podgo",
  helix_stadium:  "stadium",
} as const;

// Exhaustiveness checker — if a new family is added, this breaks at compile time
export function assertNever(x: never): never {
  throw new Error(`Unhandled device family: ${x}`);
}
```

**Step 2: Per-family module structure in `src/lib/helix/`**

```
src/lib/helix/
  devices/
    helix/
      chain-rules.ts     — Helix-specific signal chain assembly
      planner-prompt.ts  — Helix-only model catalog + prompt
      models.ts          — HD2 amp/cab/effect catalog (no Agoura)
    stadium/
      chain-rules.ts     — Stadium slot-grid assembly
      planner-prompt.ts  — Stadium-only Agoura catalog + prompt
      models.ts          — Agoura amp catalog + HX2/VIC effects
    stomp/
      chain-rules.ts     — Stomp block budget rules
      planner-prompt.ts  — Stomp-specific prompt (constraint-first)
      models.ts          — re-exports from helix/models (same catalog, different constraints)
    podgo/
      chain-rules.ts     — Pod Go 4-effect limit rules
      planner-prompt.ts  — Pod Go prompt (Mono/Stereo suffix catalog)
      models.ts          — Pod Go model catalog (Mono/Stereo variants)
  router.ts              — getDeviceModule(family: DeviceFamily) → per-family module
  index.ts               — public barrel export (unchanged external API)
```

**Step 3: Router replaces guard-based branching**

```typescript
// src/lib/helix/router.ts
import type { DeviceFamily } from "./types";

// Each family module exports the same interface
export interface DeviceModule {
  assembleSignalChain: (intent: ToneIntent, device: DeviceTarget) => BlockSpec[];
  buildPlannerPrompt: (device: DeviceTarget) => string;
  getModelList: () => string;
}

export function getDeviceModule(family: DeviceFamily): DeviceModule {
  switch (family) {
    case "helix":   return import("./devices/helix");
    case "stomp":   return import("./devices/stomp");
    case "podgo":   return import("./devices/podgo");
    case "stadium": return import("./devices/stadium");
    default:        return assertNever(family);
  }
}
```

The `default: assertNever(family)` makes TypeScript enforce exhaustive coverage at compile
time. Adding a new device family without handling it here is a type error, not a runtime bug.

### Confidence

HIGH — TypeScript discriminated unions are the canonical pattern for this problem. The
`assertNever()` trick is documented in the TypeScript handbook. Module-per-family is standard
at Next.js scale. Zod 4.3.6 `z.discriminatedUnion()` verified working in installed package.

---

## Feature Area 2: Per-Device ToneIntent Schema Variants

### The Problem

Current `ToneIntentSchema` uses global `AMP_NAMES` and `CAB_NAMES` arrays that include ALL
amps from all devices. The planner can pick Agoura amps for Helix LT or HD2 amps for Stadium.

### The Solution: Family-Specific Schema Construction

**Pattern: Factory function, not separate schema files**

```typescript
// src/lib/helix/tone-intent.ts

// Per-family schema factory — called once per device request
export function buildToneIntentSchema(family: DeviceFamily) {
  const { ampNames, cabNames } = getModelNamesForFamily(family);

  return z.object({
    ampName: z.enum(ampNames as [string, ...string[]]),
    cabName: z.enum(cabNames as [string, ...string[]]),
    // ... rest of schema — effects, snapshots, etc.
    // Stadium-specific: allow secondAmpName for dual-DSP flow
    ...(family === "helix" ? {
      secondAmpName: z.enum(ampNames as [string, ...string[]]).optional(),
      secondCabName: z.enum(cabNames as [string, ...string[]]).optional(),
    } : {}),
  });
}
```

This approach builds the schema at request time from the family's model catalog. The Zod
schema and its `z.enum()` validators are constructed from the correct per-family model list.
Claude's structured output sees only the valid options for the requested device family.

**Why not separate schema files per family:**
The schema shape is 95% identical across families. Only `ampName` and `cabName` enums differ.
A factory function avoids duplication while maintaining type safety.

### Integration with Claude Structured Output

```typescript
// In planner.ts — family-aware call
const schema = buildToneIntentSchema(family);
const response = await claude.messages.create({
  ...
  tools: [zodOutputFormat(schema, "tone_intent")],
});
```

The `zodOutputFormat` helper from `@anthropic-ai/sdk/helpers/zod` accepts any Zod object
schema. Passing the family-specific schema constrains Claude's output to only the valid model
names for that device. No post-validation filtering needed.

### Confidence

HIGH — `zodOutputFormat` accepts any Zod schema; confirmed working in v4.0. Factory pattern
is standard TypeScript. Zod `z.enum()` from a string array is documented.

---

## Feature Area 3: Stadium Firmware Parameter Extraction

### Ground Truth from Real .hsp Files

Direct extraction from 11 .hsp files in the local corpus (12 amp blocks total, 10 unique Agoura
amp models) reveals the complete firmware parameter set:

**Parameters present in EVERY Agoura amp block (15 params — mandatory, must be emitted):**

| Parameter | Present | Example Value | Notes |
|-----------|---------|---------------|-------|
| `AmpCabPeak2Fc` | 12/12 | 1000 | Hidden EQ: 2nd peak center freq |
| `AmpCabPeak2G` | 12/12 | 0 | Hidden EQ: 2nd peak gain |
| `AmpCabPeak2Q` | 12/12 | 0.707 | Hidden EQ: 2nd peak Q |
| `AmpCabPeakFc` | 12/12 | 100 | Hidden EQ: 1st peak center freq |
| `AmpCabPeakG` | 12/12 | 0 | Hidden EQ: 1st peak gain |
| `AmpCabPeakQ` | 12/12 | 0.707 | Hidden EQ: 1st peak Q |
| `AmpCabShelfF` | 12/12 | 1000 | Hidden EQ: shelf frequency |
| `AmpCabShelfG` | 12/12 | 0 | Hidden EQ: shelf gain |
| `AmpCabZFir` | 12/12 | 0 | Cabinet impulse response index |
| `AmpCabZUpdate` | 12/12 | 0 | Cabinet update flag |
| `Bass` | 12/12 | 0.64 | Standard tone stack |
| `Hype` | 12/12 | 0 | Presence-like boost circuit |
| `Ripple` | 12/12 | 0 | Power supply ripple |
| `Sag` | 12/12 | 0 | Power amp sag |
| `ZPrePost` | 12/12 | 0.3 | Pre/post EQ blend |

**Parameters present in MOST amp blocks (amp-specific — include if model has them):**

| Parameter | Present | Notes |
|-----------|---------|-------|
| `Level` | 11/12 | Output level |
| `Treble` | 11/12 | Tone stack treble |
| `Master` | 10/12 | Master volume |
| `Mid` | 10/12 | Tone stack mid |
| `Channel` | 8/12 | Channel selector (multi-channel amps) |
| `Presence` | 8/12 | Presence control |
| `Drive` | 8/12 | Primary gain (varies: "Drive", "NormalDrive", "BrightDrive") |

**v4.0 was emitting only 12 params per amp. The 10 hidden params that were missing and
causing param state bleed between presets:**

```
AmpCabPeak2Fc, AmpCabPeak2G, AmpCabPeak2Q,
AmpCabPeakFc, AmpCabPeakG, AmpCabPeakQ,
AmpCabShelfF, AmpCabShelfG,
AmpCabZFir, AmpCabZUpdate
```

(Plus `Hype`, `Ripple`, `Sag`, `ZPrePost` — these were in some models but not all.)

### Extraction Approach

The extraction script is a one-shot Node.js script using only the standard library:

```typescript
// scripts/extract-stadium-params.ts
import * as fs from "fs";

const HSP_DIR = "C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/";
const files = fs.readdirSync(HSP_DIR).filter(f => f.endsWith(".hsp"));

for (const file of files) {
  const data = fs.readFileSync(HSP_DIR + file);
  const j = JSON.parse(data.slice(8).toString("utf8")); // strip 8-byte magic header
  const flow = j.preset.flow;
  for (const [, block] of Object.entries(flow)) {
    for (const [, slot] of Object.entries(block as Record<string, unknown>)) {
      if (slot && typeof slot === "object" && (slot as Record<string, unknown>).type === "amp") {
        const ampBlock = slot as { slot: Array<{ model: string; params: Record<string, { value: unknown }> }> };
        const { model, params } = ampBlock.slot[0];
        console.log(`${file} | ${model} | ${JSON.stringify(params)}`);
      }
    }
  }
}
```

Run with: `npx tsx scripts/extract-stadium-params.ts`

Output goes directly into `STADIUM_AMPS` defaultParams in `models.ts`. No binary parser library
needed — the .hsp format is 8-byte ASCII magic + JSON text. `data.slice(8)` strips the header.

### Why No Binary Parser Library

The .hsp format is confirmed as: `"rpshnosj"` (8 ASCII bytes) + `JSON.stringify({ meta, preset })`.
After `data.slice(8)`, it is plain JSON. `JSON.parse()` handles everything. `binary-parser`,
`binparse`, or any other library would add a dependency for zero benefit here.

Source: Direct codebase inspection of `stadium-builder.ts` + verification against 11 real .hsp files.
Confidence: HIGH (corpus-driven, ground truth).

---

## Feature Area 4: Barrel Export Strategy for Device Modules

### The Problem

The existing `src/lib/helix/index.ts` barrel exports everything from a flat module directory.
Adding per-device subdirectories risks making the barrel unwieldy or leaking internal module
details to consumers.

### The Solution: Two-Layer Barrel Pattern

**Layer 1: Per-family internal barrel**
Each family directory gets its own `index.ts` that exports only what the router needs:

```typescript
// src/lib/helix/devices/stadium/index.ts
export { assembleSignalChain } from "./chain-rules";
export { buildPlannerPrompt, getModelList } from "./planner-prompt";
export { STADIUM_AMPS, STADIUM_EQ_MODELS } from "./models";
```

**Layer 2: Root barrel — unchanged external API**
`src/lib/helix/index.ts` continues to export the same public surface. Internal reorganization
is invisible to API routes and test files that import from `@/lib/helix`.

```typescript
// src/lib/helix/index.ts — ADD these, keep everything else
export { getDeviceModule, DEVICE_FAMILY } from "./router";
export type { DeviceFamily, DeviceModule } from "./router";
```

### Next.js `optimizePackageImports` Consideration

Next.js 16 supports `optimizePackageImports` to avoid loading barrel files that import
everything. For internal `@/lib/helix` barrels this is irrelevant — tree-shaking handles
server-side modules correctly and none of these ship to the browser bundle.

The barrel pattern is appropriate here because `src/lib/helix/` is server-side only (used in
`/api/generate/route.ts`) and the total module count is small (under 20 files).

**Avoid:** Using `export * from "./devices/stadium"` from the root barrel — explicit named
exports keep the public API surface intentional and prevent accidental leakage.

### Confidence

MEDIUM — barrel export patterns are well-established in TypeScript/Next.js. The two-layer
approach is the standard for internal module reorganizations that must preserve external API
compatibility.

---

## Feature Area 5: Planner Prompt Templating for Device-Specific Prompts

### The Problem

`buildPlannerPrompt()` in `planner.ts` uses runtime `if (stadium) / if (podGo)` branches to
compose the prompt string. As device count grows, this function becomes unmaintainable.

### The Solution: Prompt Template Objects

**Pattern: Static template object per family, assembled at call time**

```typescript
// src/lib/helix/devices/helix/planner-prompt.ts

// Static sections — eligible for Anthropic prompt caching (content doesn't change per request)
const HELIX_SYSTEM_PROMPT_PREFIX = `
You are an expert Helix signal chain engineer for Helix Floor/LT/Rack.
This device supports dual DSP, dual-amp topologies, and up to 6 effects.
` as const;

// Dynamic section — varies per request (amp catalog is large but stable)
export function buildPlannerPrompt(modelList: string): string {
  return `
${HELIX_SYSTEM_PROMPT_PREFIX}

## Available Amps and Cabs
${modelList}

## Signal Chain Rules
[Helix-specific chain rules...]
`;
}
```

**Why static prefix strings (not template files):**
Prompt caching requires the `cache_control: { type: "ephemeral" }` marker on the system
prompt block. The prefix must be stable between requests for the cache to hit. String
constants in TypeScript are stable — no file I/O, no dynamic interpolation in the cached
portion.

**What stays dynamic (not cached):**
The model list section (`## Available Amps and Cabs`) can vary if the catalog changes per
firmware update, but in practice it is generated once at module load time via
`getModelNamesForFamily()` and is stable within a deployment.

### Cab Affinity Section per Family

The existing per-family cab affinity section (built in `buildPlannerPrompt()`) moves into each
family's prompt builder. Stadium's prompt includes only Agoura amp → cab affinity. Helix's
prompt includes only HD2 amp → cab affinity. This eliminates cross-contamination where the
planner sees Agoura cab affinity while generating a Helix LT preset.

### Confidence

HIGH — prompt template as TypeScript string constant is the existing pattern in `planner.ts`.
The per-family refactor is a reorganization of existing code, not a new pattern.

---

## Feature Area 6: Per-Device Test Infrastructure

### Current State

Tests live alongside source files (`chain-rules.test.ts`, `stadium-builder.test.ts`). Vitest
is configured in `vitest.config.ts` with `environment: "node"` and `@` path alias.

### v5.0 Test Pattern: Device-Scoped Test Files

No new test configuration is needed. The pattern is file-per-device-scenario using existing
`describe()` nesting:

```typescript
// src/lib/helix/devices/helix/chain-rules.test.ts
import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";

describe("Helix chain rules", () => {
  describe("dual-amp topology", () => {
    it("assembles split/join blocks for AB topology", () => { ... });
  });
  describe("single-amp topology", () => {
    it("places boost before amp in DSP0", () => { ... });
  });
});

// src/lib/helix/devices/stadium/chain-rules.test.ts
import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";

describe("Stadium chain rules", () => {
  it("uses slot-grid positions b05/b06 for amp/cab", () => { ... });
  it("includes all 15 mandatory AmpCab* params in output", () => { ... });
  it("does not bleed params from previous preset", () => { ... });
});
```

**Key test for Stadium param completeness:**
```typescript
it("emits all 10 hidden AmpCab params for every Agoura amp", () => {
  const REQUIRED_HIDDEN = [
    "AmpCabPeak2Fc", "AmpCabPeak2G", "AmpCabPeak2Q",
    "AmpCabPeakFc", "AmpCabPeakG", "AmpCabPeakQ",
    "AmpCabShelfF", "AmpCabShelfG",
    "AmpCabZFir", "AmpCabZUpdate",
  ];
  // Build a Stadium preset and verify every Agoura amp block has all hidden params
  const spec = buildTestStadiumSpec();
  const hsp = buildHspFile(spec);
  const ampBlock = findAmpBlock(hsp);
  for (const param of REQUIRED_HIDDEN) {
    expect(ampBlock.params).toHaveProperty(param);
  }
});
```

### Vitest `projects` (not needed at this scale)

Vitest 4.x supports `test.projects` for multi-environment configurations. For v5.0, this is
unnecessary — all tests run in `environment: "node"` with the same `@` alias. Per-family test
files are sufficient isolation without a separate project config per family.

The `projects` API would only be valuable if device families needed different environment
configs (e.g., one device family testing browser APIs). That does not apply here.

### Confidence

HIGH — existing Vitest setup is correct for this pattern. File-per-device test organization
is idiomatic for the codebase's existing structure.

---

## Installation

```bash
# No new packages for v5.0
# All changes are TypeScript source reorganization in:

# New directory structure:
#   src/lib/helix/devices/
#     helix/chain-rules.ts, planner-prompt.ts, models.ts
#     stadium/chain-rules.ts, planner-prompt.ts, models.ts
#     stomp/chain-rules.ts, planner-prompt.ts, models.ts
#     podgo/chain-rules.ts, planner-prompt.ts, models.ts
#   src/lib/helix/router.ts    — DeviceFamily → module routing
#   src/lib/helix/tone-intent.ts — buildToneIntentSchema(family) factory

# Modified files:
#   src/lib/helix/types.ts       — DeviceFamily type, DEVICE_FAMILY map, assertNever()
#   src/lib/helix/models.ts      — STADIUM_AMPS defaultParams with 15 mandatory params
#   src/lib/helix/index.ts       — add router exports, keep all existing exports
#   src/lib/planner.ts           — call buildPlannerPrompt from device module via router

# One-shot extraction script (run once, output pasted into models.ts):
npx tsx scripts/extract-stadium-params.ts
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `DeviceFamily` discriminated union + module-per-family | Keep guard functions (`isPodGo`, `isStadium`) | Never for v5.0 — guards don't scale to new devices and don't eliminate cross-contamination |
| Factory function `buildToneIntentSchema(family)` | Separate schema file per device family | Only if schema shapes diverge significantly — at 95% shared shape, a factory is simpler |
| `assertNever(family)` exhaustiveness checker | Manual switch with `default: throw` | Same effect — `assertNever` is type-safe and gives better error messages |
| Node.js `Buffer.slice(8)` + `JSON.parse()` for .hsp extraction | `binary-parser` npm package | Use binary-parser only if the format were non-JSON binary (e.g., raw C structs). .hsp is JSON text |
| File-per-device test files with `describe()` | Vitest `test.projects` per device family | Use projects only if device families need different test environments (JSDOM vs node). All are node here |
| Per-family barrel (`devices/stadium/index.ts`) | Flat re-export from root index.ts | Flat is fine for small module count but creates implicit coupling; family barrels keep boundaries explicit |
| Static TypeScript string constants for prompt templates | File-based prompt templates (`.md` or `.txt` files) | Use files if prompts need non-developer editing or translation. Prompts here contain TypeScript variable interpolation |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `binary-parser`, `binparse`, `bin-grammar` npm packages | The .hsp format is `"rpshnosj"` + plain JSON — `data.slice(8)` and `JSON.parse()` are sufficient. Any binary parser library adds a dependency for zero benefit | Node.js `Buffer` + `JSON.parse()` |
| Class-based device hierarchy (`abstract class Device`) | Adds indirection without type safety benefit over discriminated unions. TypeScript structural typing means interface + function is equivalent without the inheritance chain | `DeviceModule` interface + `getDeviceModule()` function |
| Dynamic `import()` for device modules at request time | Server-side Next.js API routes — all modules load at startup. Dynamic import adds async overhead with no bundle benefit (server side, no browser download) | Static imports in `router.ts` with a `switch` that returns the already-loaded module |
| Separate Zod schemas per device in separate files | 95% of the schema is identical across devices. Per-file schemas mean updating snapshot rules, effect limits, or variax support in 4 places | `buildToneIntentSchema(family)` factory function in `tone-intent.ts` |
| `z.union()` instead of `z.discriminatedUnion()` for device routing | `z.union()` checks every option in order — slower and gives worse error messages when validation fails. `z.discriminatedUnion()` uses the discriminator key for O(1) lookup | `z.discriminatedUnion('family', [...])` — verified working in Zod 4.3.6 |
| Adding numeric params to ToneIntent per device | Breaks the Planner-Executor architecture — AI accuracy on numbers is unreliable. Device-specific numeric params belong in Knowledge Layer defaults per device family | Device-specific default tables in `param-engine.ts` per family |
| Global `AMP_NAMES` in `buildToneIntentSchema` | Allows cross-device model contamination (the Agoura leak) — root cause of the v4.0 bug | `getModelNamesForFamily(family)` returning only the correct catalog for the requested family |

---

## Stack Patterns by Variant

**If a new device is added (e.g., Pod Go XL as its own family):**
- Add `"podgo_xl"` to `DeviceFamily` union — TypeScript immediately flags unhandled case in `router.ts`
- Create `src/lib/helix/devices/podgo-xl/` with same interface shape
- Update `DEVICE_FAMILY` map
- The `assertNever(family)` in `router.ts` catches it at compile time

**If Stadium gets new Agoura amp models in future firmware:**
- Run `npx tsx scripts/extract-stadium-params.ts` against new .hsp files
- Update `STADIUM_AMPS` in `src/lib/helix/devices/stadium/models.ts`
- Re-run `getModelNamesForFamily("stadium")` — planner sees updated catalog automatically

**If a device family needs different snapshot count logic:**
- Add `maxSnapshots` to the `DeviceModule` interface
- Each family's module returns the correct value
- `buildToneIntentSchema(family)` uses `family === "stomp" ? 3 : ...` for `snapshots.max()`

---

## Version Compatibility

| Package | Version | Notes |
|---------|---------|-------|
| `zod` | 4.3.6 | `z.discriminatedUnion()` verified working — tested in installed package. `z.enum()` from `[string, ...string[]]` tuple type works. Zod author plans to replace with `z.switch()` but current API is stable |
| `@anthropic-ai/sdk` | ^0.78.0 | `zodOutputFormat()` accepts any Zod object schema — family-specific schema works identically to global schema |
| `vitest` | ^4.0.18 | File-per-device test files work with existing `vitest.config.ts` — no project config changes needed |
| `typescript` | ^5 | Discriminated union exhaustiveness checking via `assertNever(x: never)` is a TypeScript ^4.1+ feature — supported |
| `next` | 16.1.6 | Static imports in `router.ts` are compatible — no dynamic import overhead for server-side modules |

---

## Sources

- Direct codebase inspection: `src/lib/helix/types.ts` — existing `DeviceTarget`, guard functions, DEVICE_IDS — HIGH confidence
- Direct codebase inspection: `src/lib/helix/tone-intent.ts` — existing ToneIntent schema, AMP_NAMES global — HIGH confidence
- Direct codebase inspection: `src/lib/planner.ts` — existing `buildPlannerPrompt()` guard pattern — HIGH confidence
- Direct corpus analysis: 11 real .hsp files in `C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/` — 12 Agoura amp blocks examined, complete param set extracted — HIGH confidence (ground truth from real firmware files)
- Node.js execution: `node -e "..."` against corpus files — confirmed 15 params present in all 12 amp blocks, 10 hidden params missing from v4.0 builder — HIGH confidence
- Zod package verification: `node -e "require('.../zod')"` — `z.discriminatedUnion()` confirmed working in installed 4.3.6 — HIGH confidence
- [TypeScript Handbook — Discriminated Unions](https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html) — exhaustiveness checking with `never` — HIGH confidence (official docs)
- [Zod discriminatedUnion docs](https://zod.dev/api) — `z.discriminatedUnion('key', [...])` API — HIGH confidence (official)
- [Vitest Test Projects](https://vitest.dev/guide/projects) — per-file isolation, `describe()` organization — HIGH confidence (official)
- [How we optimized package imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js) — barrel file behavior in Next.js 16, server-side tree-shaking — MEDIUM confidence (official Vercel blog)
- [tsx documentation](https://tsx.is/) — `npx tsx script.ts` for one-shot TypeScript scripts — HIGH confidence (official)

---

*Stack research for: HelixTones v5.0 — Device-First Architecture Rework*
*Researched: 2026-03-05*
