# Phase 61: Family Router and Capabilities - Research

**Researched:** 2026-03-05
**Domain:** TypeScript discriminated unions, device capability modeling, pipeline entry-point resolution
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Family Grouping
- 4 families: helix, stomp, podgo, stadium
- helix: Floor, LT, Rack (all identical for preset generation)
- stomp: Stomp, Stomp XL
- podgo: Pod Go, Pod Go XL
- stadium: Stadium, Stadium XL
- 3 new DeviceTarget entries added in this phase: helix_rack, pod_go_xl, helix_stadium_xl
- New devices share sibling capabilities until real hardware data validates them

#### Within-Family Device Differences
- Stomp vs Stomp XL capability differences: researcher must determine (block count, DSP count, etc.)
- Pod Go vs Pod Go XL capability differences: researcher must determine
- Stadium vs Stadium XL capability differences: researcher must determine
- Helix Floor vs LT vs Rack: identical capabilities for preset generation

#### Capabilities Shape
- DeviceCapabilities should encode ALL known hardware-relevant capabilities, not just the 4 in success criteria
- Required fields: block limits (per-DSP AND total), DSP count, dual-amp support, available block types
- Additional fields: snapshot count, path routing options, variax support, send/return loop count, expression pedal count, firmware version range
- Researcher should determine exact values per device from Line 6 documentation

### Claude's Discretion
- Whether getCapabilities() takes DeviceFamily or DeviceTarget (depends on how within-family differences shake out after research)
- Whether to include file format (hlx/pgp/hsp) in DeviceCapabilities or handle separately
- Whether to include amp catalog era (hd2/agoura) in DeviceCapabilities or leave for Phase 62
- How to handle new device functionality — fully functional with sibling data vs gated with warning
- Module file structure (new file vs extending types.ts)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | System defines DeviceFamily discriminated union (helix, stomp, podgo, stadium) with exhaustive TypeScript switch | TypeScript `strict: true` + `never` exhaustiveness guard pattern; discriminated unions already used in codebase (BlockType, AmpCategory, TopologyTag) |
| ROUTE-02 | System maps all DeviceTarget values to their DeviceFamily via resolveFamily() with compile-time exhaustiveness | Switch on DeviceTarget with `never` guard; adding new DeviceTarget values breaks compile until case is added |
| ROUTE-03 | System defines DeviceCapabilities per family (block limits, DSP count, dual-amp support, available block types) | Exact hardware specs researched and documented below; getCapabilities() signature determined to use DeviceTarget due to within-family snapshot differences (Stomp: 3, Stomp XL: 4) |
| ROUTE-04 | Device family is resolved at the earliest pipeline entry point (before chat or generation begins) | Both pipeline entry points identified: `src/app/api/generate/route.ts` (lines 31-43) and `src/app/api/chat/route.ts`; generate route resolves DeviceTarget from JSON body; chat route does not currently receive device at all |

</phase_requirements>

## Summary

Phase 61 is a pure-addition TypeScript type system phase. The work is: define a `DeviceFamily` discriminated union, write `resolveFamily(device: DeviceTarget): DeviceFamily`, write `getCapabilities(device: DeviceTarget): DeviceCapabilities`, and call `resolveFamily()` once at each pipeline entry point. No existing functionality changes. No downstream callers need to be updated in this phase — the family type and capabilities object are created and made available; downstream phases (62–65) will consume them.

The research surfaced one significant real-world fact: "Pod Go XL" does not exist as a Line 6 product. The CONTEXT.md explicitly instructs that this device be added to the type system now (with sibling capabilities) ahead of anticipated future hardware, so `pod_go_xl` should be added as a valid `DeviceTarget` with the same capabilities as `pod_go`. This is architecturally sound — the type system will enforce coverage without requiring real hardware data. Stadium XL is a confirmed real product (released June 2025, same DSP/blocks as Stadium, different I/O). Helix Rack is confirmed identical to Floor and LT for preset generation purposes.

The critical design decision for this phase is that `getCapabilities()` should take `DeviceTarget`, not `DeviceFamily`. Within the stomp family, Stomp has 3 snapshots and Stomp XL has 4 — a real capability difference that matters to the pipeline. Using `DeviceTarget` allows per-device precision while `DeviceFamily` would force loss of that distinction. For the helix family, all three members are truly identical.

**Primary recommendation:** Define `DeviceFamily` as a string literal union, implement `resolveFamily()` with an exhaustive switch over all 9 `DeviceTarget` values using a `never` guard for compile-time enforcement, implement `getCapabilities(device: DeviceTarget)` returning a `DeviceCapabilities` object, and call `resolveFamily()` at the top of both route handlers. Place everything in a new adjacent file `src/lib/helix/device-family.ts` rather than extending the already-large `types.ts`.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 (project) | Discriminated unions, exhaustive switch, `never` guard | Already in project; `strict: true` in tsconfig.json means exhaustiveness checks work without additional config |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.0.18 (project) | Unit testing resolveFamily() and getCapabilities() | Already installed; existing test files use it; `npx vitest run` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `never` guard in switch | ts-exhaustive library | `never` guard is zero-dependency, idiomatic TypeScript — no library needed |
| New `device-family.ts` file | Extending `types.ts` | `types.ts` is already 302 lines; adding DeviceFamily, DeviceCapabilities, resolveFamily, and getCapabilities would push it to 400+ lines; separation is cleaner |
| `getCapabilities(DeviceFamily)` | `getCapabilities(DeviceTarget)` | DeviceTarget needed because stomp vs stomp_xl differ on snapshot count (3 vs 4), and future devices may differ further |

**Installation:** No new packages needed. This phase uses only TypeScript and the existing project stack.

## Architecture Patterns

### Recommended Project Structure

```
src/lib/helix/
├── types.ts             # Existing — DeviceTarget, DEVICE_IDS, isHelix(), isPodGo(), etc.
├── device-family.ts     # NEW — DeviceFamily, DeviceCapabilities, resolveFamily(), getCapabilities()
├── index.ts             # Existing — re-export new types and functions
src/app/api/
├── generate/route.ts    # Existing — call resolveFamily() here, pass DeviceFamily forward
├── chat/route.ts        # Existing — call resolveFamily() here (requires adding device param)
```

### Pattern 1: Discriminated Union with Exhaustive Switch

**What:** Define a string literal union type and enforce exhaustive handling via a `never` guard.

**When to use:** Anywhere the compiler must reject code that ignores a new variant. This satisfies ROUTE-01 and ROUTE-02.

**Example:**
```typescript
// Source: Standard TypeScript exhaustiveness pattern (TypeScript Handbook)

export type DeviceFamily = "helix" | "stomp" | "podgo" | "stadium";

/** Asserts at compile-time that all DeviceFamily variants are handled */
function assertNever(x: never): never {
  throw new Error(`Unhandled DeviceFamily: ${x}`);
}

export function resolveFamily(device: DeviceTarget): DeviceFamily {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return "helix";
    case "helix_stomp":
    case "helix_stomp_xl":
      return "stomp";
    case "pod_go":
    case "pod_go_xl":
      return "podgo";
    case "helix_stadium":
    case "helix_stadium_xl":
      return "stadium";
    default:
      return assertNever(device);
  }
}
```

When a new `DeviceTarget` value is added without a corresponding case, the TypeScript compiler produces an error: "Argument of type 'string' is not assignable to parameter of type 'never'". This satisfies ROUTE-02 (compile-time exhaustiveness).

### Pattern 2: DeviceCapabilities Object with DeviceTarget Key

**What:** A capabilities lookup function that returns a strongly-typed object per device target.

**When to use:** Whenever downstream code needs to know what a specific device can do. This satisfies ROUTE-03.

**Example:**
```typescript
// Source: Project pattern — DEVICE_IDS uses identical Record<DeviceTarget, T> shape

export interface DeviceCapabilities {
  family: DeviceFamily;
  dspCount: number;              // Number of DSP chips (helix: 2, others: 1)
  maxBlocksPerDsp: number;       // Max effect blocks per DSP chip
  maxBlocksTotal: number;        // Total blocks (dspCount × maxBlocksPerDsp for helix, else same as perDsp)
  maxSnapshots: number;          // Snapshot count limit per preset
  dualAmpSupported: boolean;     // Can the device run two amp blocks?
  pathCount: number;             // Number of stereo signal paths
  variaxSupported: boolean;      // VDI input present (Helix Floor, LT, Rack, Stomp, Stomp XL)
  sendReturnCount: number;       // Hardware FX loop count
  expressionPedalCount: number;  // Built-in + external expression pedal inputs
  fileFormat: "hlx" | "pgp" | "hsp";  // Preset file extension
  ampCatalogEra: "hd2" | "agoura";    // Which amp model era this family uses
  availableBlockTypes: ReadonlyArray<BlockSpec["type"]>;  // Block types valid for this device
}

export function getCapabilities(device: DeviceTarget): DeviceCapabilities {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return HELIX_CAPABILITIES;
    case "helix_stomp":
      return STOMP_CAPABILITIES;
    case "helix_stomp_xl":
      return STOMP_XL_CAPABILITIES;
    case "pod_go":
    case "pod_go_xl":
      return POD_GO_CAPABILITIES;   // pod_go_xl shares pod_go caps until hardware data available
    case "helix_stadium":
    case "helix_stadium_xl":
      return STADIUM_CAPABILITIES;  // stadium_xl shares stadium caps until hardware data available
    default:
      return assertNever(device);
  }
}
```

### Pattern 3: Pipeline Entry Resolution (ROUTE-04)

**What:** Call `resolveFamily()` once at the top of each API route handler and pass the result forward.

**When to use:** Both pipeline entry points — `/api/generate` and `/api/chat`.

**Current situation at generate route (lines 31-43):**
```typescript
// CURRENT: manual if-else chain resolves DeviceTarget
if (device === "helix_floor") { deviceTarget = "helix_floor"; }
// ...else if chain for all 6 variants...
else { deviceTarget = "helix_lt"; }

// AFTER Phase 61: add resolveFamily call immediately after
const deviceTarget: DeviceTarget = resolveDeviceTarget(device);  // keep existing resolution
const deviceFamily: DeviceFamily = resolveFamily(deviceTarget);  // Phase 61 addition
```

**Current situation at chat route:** The chat route (`src/app/api/chat/route.ts`) does not currently accept a `device` parameter — it only receives `messages`, `premiumKey`, and `conversationId`. ROUTE-04 requires family resolution before chat begins. Either:
- The frontend must pass `device` to `/api/chat`, or
- resolveFamily() is only called in the generate route for now, with ROUTE-04 interpreted as "at minimum the generation pipeline entry"

This is a key open question for the planner to decide.

### Anti-Patterns to Avoid

- **Family switch in downstream code:** `resolveFamily()` must be called once. Downstream modules (chain-rules, param-engine, validate) should receive `DeviceFamily` as a parameter — not call `resolveFamily()` themselves.
- **Extending DEVICE_IDS for new devices before verifying IDs:** The 3 new `DeviceTarget` entries (helix_rack, pod_go_xl, helix_stadium_xl) need placeholder device IDs in `DEVICE_IDS`. Use real data where available (Helix Rack: look up from real .hlx export), or mark clearly as "unverified pending hardware corpus".
- **Putting DeviceCapabilities data in types.ts:** types.ts is already 302 lines. Device-family logic belongs in a new file.
- **Using if-else instead of switch for resolveFamily:** The `switch` + `default: assertNever(x)` pattern is the one the TypeScript compiler understands for exhaustiveness. If-else chains do not trigger the same compile error.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Exhaustive union checking | Custom validation utility | `switch` + `assertNever(x: never)` | TypeScript's type narrowing handles this natively with `strict: true`; the pattern is zero-dependency and compiler-enforced |
| Capability lookup validation | Runtime validation library | TypeScript interface + compile-time types | All device capability lookups are static constants; runtime validation adds complexity for no benefit |

**Key insight:** TypeScript's `never` type is the correct tool. The compiler error when a case is unhandled is "Argument of type '...' is not assignable to parameter of type 'never'" — this is the compiler rejection required by ROUTE-01 success criterion 1.

## Common Pitfalls

### Pitfall 1: DeviceFamily Switch on Wrong Type

**What goes wrong:** Writing `switch (family)` in a function that receives `DeviceFamily`, then accidentally adding a case for a `DeviceTarget` value — or vice versa. The two types are different: `DeviceTarget` has 9 values, `DeviceFamily` has 4.

**Why it happens:** Confusing the two types during implementation.

**How to avoid:** `resolveFamily()` switches on `DeviceTarget` (9 cases). Any function that dispatches on family switches on `DeviceFamily` (4 cases). Never mix the two in the same switch statement.

**Warning signs:** TypeScript error "case clause can never be executed" — means a DeviceTarget literal was used in a DeviceFamily switch.

### Pitfall 2: Forgetting to Export New DeviceTarget Values from types.ts AND Update DEVICE_IDS

**What goes wrong:** Adding `helix_rack | pod_go_xl | helix_stadium_xl` to the `DeviceTarget` type union but not adding corresponding entries to `DEVICE_IDS: Record<DeviceTarget, number>`. Since `DEVICE_IDS` is typed as `Record<DeviceTarget, number>`, TypeScript will immediately error with "Property 'helix_rack' is missing in type".

**Why it happens:** The `DEVICE_IDS` type constraint propagates automatically.

**How to avoid:** Update `DeviceTarget` and `DEVICE_IDS` in the same edit. For device IDs not yet verified from real hardware:
- `helix_rack`: Research suggests same engine as Floor/LT — likely shares device ID 2162689 or has own unique ID. **Must verify from a real Helix Rack .hlx export before committing.**
- `pod_go_xl`: Does not exist as real hardware yet — use pod_go's ID (2162695) as placeholder, clearly commented.
- `helix_stadium_xl`: Real product (released June 2025) — **must find device ID from a real .hsp export**.

**Warning signs:** `Record<DeviceTarget, number>` compile error immediately after changing the union.

### Pitfall 3: Chat Route Does Not Receive Device

**What goes wrong:** ROUTE-04 says "family is resolved at the earliest pipeline entry point (before chat or generation begins)." The generate route already receives `device` in the JSON body. The chat route (`src/app/api/chat/route.ts`) does NOT currently receive a `device` parameter — it only receives `messages`, `premiumKey`, and `conversationId`.

**Why it happens:** Chat was implemented before device-first architecture was planned.

**How to avoid:** Two options:
1. Frontend passes `device` to `/api/chat` in Phase 61 (adds `device` to the request body)
2. Treat ROUTE-04 as satisfied by generate route only for Phase 61; defer chat to Phase 66 when the full frontend device picker lands

The planner must decide this. Option 2 is lower risk for this phase since it's pure-addition and the chat route doesn't need family info today.

### Pitfall 4: Capability Data Mismatch Between Research and Config

**What goes wrong:** `STOMP_CONFIG.STOMP_MAX_BLOCKS = 6` and `STOMP_CONFIG.STOMP_XL_MAX_BLOCKS = 9` are in `config.ts`. Research confirms HX Stomp and Stomp XL both have the same single SHARC DSP and can run up to 8 blocks DSP-permitting. The config's 6 and 9 values appear to be conservative application-level limits, not hardware limits.

**Why it happens:** The config encodes a design choice (block budget for AI generation), not the raw hardware limit.

**How to avoid:** In `DeviceCapabilities`, use the application-level limits from `STOMP_CONFIG` (6 for Stomp, 9 for Stomp XL) — NOT the raw hardware spec of 8. These are the limits the preset engine actually enforces. Document this distinction clearly in a comment.

### Pitfall 5: Stomp XL Snapshot Count Inconsistency

**What goes wrong:** `STOMP_CONFIG.STOMP_MAX_SNAPSHOTS = 3` and `STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS = 4`. The `ToneIntentSchema` comment says "Stomp=3, StompXL/LT/Floor=4". However, the Helix Floor and LT actually have 8 snapshots. The existing schema comment is wrong for LT/Floor.

**Why it happens:** Phase 39 (Stomp) set these limits for generation purposes, and the comment was imprecise.

**How to avoid:** Use the correct hardware snapshot counts from research:
- `helix_stomp`: 3 snapshots (from STOMP_CONFIG.STOMP_MAX_SNAPSHOTS, verified from hardware)
- `helix_stomp_xl`: 4 snapshots (from STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS, verified from hardware)
- `helix_lt`, `helix_floor`, `helix_rack`: 8 snapshots (confirmed: "8 per preset")
- `pod_go`: 4 snapshots (from existing POD_GO_TOTAL_BLOCKS data, to confirm)
- `pod_go_xl`: same as pod_go (placeholder)
- `helix_stadium`, `helix_stadium_xl`: 8 snapshots (from STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS)

## Code Examples

### DeviceTarget Extension (types.ts)

```typescript
// Source: Project pattern from existing types.ts — extend the union and DEVICE_IDS

// Before (6 values):
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium" | "helix_stomp" | "helix_stomp_xl";

// After (9 values):
export type DeviceTarget = "helix_lt" | "helix_floor" | "helix_rack" | "pod_go" | "pod_go_xl" | "helix_stadium" | "helix_stadium_xl" | "helix_stomp" | "helix_stomp_xl";

// DEVICE_IDS must also be extended:
export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: 2162689,
  helix_rack: 2162689,        // UNVERIFIED: assumed same as Floor — must confirm from real .hlx export
  pod_go: 2162695,
  pod_go_xl: 2162695,         // PLACEHOLDER: pod_go_xl not yet released — uses pod_go ID
  helix_stadium: 2490368,
  helix_stadium_xl: 0,        // UNVERIFIED: real product but device ID not in corpus yet
  helix_stomp: 2162694,
  helix_stomp_xl: 2162699,
} as const;
```

### DeviceFamily and Capabilities (device-family.ts)

```typescript
// Source: TypeScript Handbook — Narrowing — Exhaustiveness checking

import type { DeviceTarget, BlockSpec } from "./types";
import { STOMP_CONFIG, STADIUM_CONFIG } from "./config";
import { POD_GO_MAX_USER_EFFECTS } from "./types";

export type DeviceFamily = "helix" | "stomp" | "podgo" | "stadium";

export interface DeviceCapabilities {
  family: DeviceFamily;
  dspCount: number;
  maxBlocksPerDsp: number;
  maxBlocksTotal: number;
  maxSnapshots: number;
  dualAmpSupported: boolean;
  pathCount: number;
  variaxSupported: boolean;
  sendReturnCount: number;
  expressionPedalCount: number;
  fileFormat: "hlx" | "pgp" | "hsp";
  ampCatalogEra: "hd2" | "agoura";
  availableBlockTypes: ReadonlyArray<BlockSpec["type"]>;
}

function assertNever(x: never): never {
  throw new Error(`Unhandled DeviceTarget in family resolution: ${String(x)}`);
}

export function resolveFamily(device: DeviceTarget): DeviceFamily {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return "helix";
    case "helix_stomp":
    case "helix_stomp_xl":
      return "stomp";
    case "pod_go":
    case "pod_go_xl":
      return "podgo";
    case "helix_stadium":
    case "helix_stadium_xl":
      return "stadium";
    default:
      return assertNever(device);
  }
}

const ALL_BLOCK_TYPES: ReadonlyArray<BlockSpec["type"]> = [
  "amp", "cab", "distortion", "delay", "reverb", "modulation",
  "dynamics", "eq", "wah", "pitch", "volume", "send_return",
];

const POD_GO_BLOCK_TYPES: ReadonlyArray<BlockSpec["type"]> = [
  "amp", "cab", "distortion", "delay", "reverb", "modulation",
  "dynamics", "eq", "wah", "volume",
  // No pitch, no send_return (FX loop is fixed, not user-assignable block)
];

const HELIX_CAPABILITIES: DeviceCapabilities = {
  family: "helix",
  dspCount: 2,
  maxBlocksPerDsp: 8,
  maxBlocksTotal: 32,        // 4 paths × 8 blocks = 32 (DSP permitting)
  maxSnapshots: 8,
  dualAmpSupported: true,
  pathCount: 4,
  variaxSupported: true,
  sendReturnCount: 4,        // Floor has 4 send/return loops
  expressionPedalCount: 3,  // 1 built-in + 2 external (Floor)
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
};

const STOMP_CAPABILITIES: DeviceCapabilities = {
  family: "stomp",
  dspCount: 1,
  maxBlocksPerDsp: STOMP_CONFIG.STOMP_MAX_BLOCKS,  // 6 — application budget, not raw hardware max
  maxBlocksTotal: STOMP_CONFIG.STOMP_MAX_BLOCKS,   // 6
  maxSnapshots: STOMP_CONFIG.STOMP_MAX_SNAPSHOTS,  // 3
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: true,
  sendReturnCount: 1,
  expressionPedalCount: 2,
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
};

const STOMP_XL_CAPABILITIES: DeviceCapabilities = {
  family: "stomp",
  dspCount: 1,
  maxBlocksPerDsp: STOMP_CONFIG.STOMP_XL_MAX_BLOCKS,  // 9 — application budget
  maxBlocksTotal: STOMP_CONFIG.STOMP_XL_MAX_BLOCKS,   // 9
  maxSnapshots: STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS,  // 4
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: true,
  sendReturnCount: 1,
  expressionPedalCount: 2,
  fileFormat: "hlx",
  ampCatalogEra: "hd2",
  availableBlockTypes: ALL_BLOCK_TYPES,
};

const POD_GO_CAPABILITIES: DeviceCapabilities = {
  family: "podgo",
  dspCount: 1,
  maxBlocksPerDsp: POD_GO_MAX_USER_EFFECTS,  // 4 user-assignable blocks
  maxBlocksTotal: 10,                         // 10 total incl. fixed wah/vol/amp/cab/eq/fxloop
  maxSnapshots: 4,
  dualAmpSupported: false,
  pathCount: 1,
  variaxSupported: false,
  sendReturnCount: 1,
  expressionPedalCount: 1,
  fileFormat: "pgp",
  ampCatalogEra: "hd2",
  availableBlockTypes: POD_GO_BLOCK_TYPES,
};

// Stadium and Stadium XL: identical DSP, blocks, paths, snapshots
// XL adds built-in expression pedal and 4 FX loops vs Stadium's 2
const STADIUM_CAPABILITIES: DeviceCapabilities = {
  family: "stadium",
  dspCount: 1,          // Single next-gen DSP (GPU + FPGA + ML accelerator — not a SHARC count)
  maxBlocksPerDsp: 48,  // 48 dynamic blocks across 4 paths (12 per path)
  maxBlocksTotal: 48,
  maxSnapshots: STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS,  // 8
  dualAmpSupported: true,  // 4 stereo paths enable multi-amp routing
  pathCount: 4,
  variaxSupported: false,
  sendReturnCount: 2,        // Stadium: 2 FX loops; Stadium XL: 4. Using conservative shared value.
  expressionPedalCount: 0,   // Stadium: external only; Stadium XL: 1 built-in. Conservative shared.
  fileFormat: "hsp",
  ampCatalogEra: "agoura",
  availableBlockTypes: ALL_BLOCK_TYPES,
};

export function getCapabilities(device: DeviceTarget): DeviceCapabilities {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
    case "helix_rack":
      return HELIX_CAPABILITIES;
    case "helix_stomp":
      return STOMP_CAPABILITIES;
    case "helix_stomp_xl":
      return STOMP_XL_CAPABILITIES;
    case "pod_go":
    case "pod_go_xl":
      return POD_GO_CAPABILITIES;
    case "helix_stadium":
    case "helix_stadium_xl":
      return STADIUM_CAPABILITIES;
    default:
      return assertNever(device);
  }
}
```

### Pipeline Entry Point Usage

```typescript
// Source: generate/route.ts — add after existing deviceTarget resolution
import { resolveFamily } from "@/lib/helix";
import type { DeviceFamily } from "@/lib/helix";

// Existing deviceTarget resolution (lines 31-43) — keep as-is
const deviceFamily: DeviceFamily = resolveFamily(deviceTarget);

// Pass deviceFamily forward to downstream functions that need family-level dispatch.
// Do NOT call resolveFamily() again downstream.
```

## Verified Capability Data Per Device

Researched from Line 6 official documentation, community forum hardware specs, and existing project config constants:

| Device | DSP Chips | Max Blocks | Max Snapshots | Dual Amp | Paths | Variax | FX Loops | EXP Inputs | File | Amp Era |
|--------|-----------|------------|--------------|----------|-------|--------|----------|------------|------|---------|
| helix_lt | 2 | 32 total (8/DSP) | 8 | Yes | 4 | Yes | 2 | 2 ext | .hlx | hd2 |
| helix_floor | 2 | 32 total (8/DSP) | 8 | Yes | 4 | Yes | 4 | 2 ext | .hlx | hd2 |
| helix_rack | 2 | 32 total (8/DSP) | 8 | Yes | 4 | Yes | 4 | 3 ext | .hlx | hd2 |
| helix_stomp | 1 | 6 (app budget) | 3 | No | 1 | Yes | 1 | 2 | .hlx | hd2 |
| helix_stomp_xl | 1 | 9 (app budget) | 4 | No | 1 | Yes | 1 | 2 | .hlx | hd2 |
| pod_go | 1 | 4 user + 6 fixed | 4 | No | 1 | No | 1 | 1 built-in | .pgp | hd2 |
| pod_go_xl | 1 | [same as pod_go] | [same] | No | 1 | No | [unknown] | [unknown] | .pgp | hd2 |
| helix_stadium | 1 (next-gen) | 48 (12/path) | 8 | Yes | 4 | No | 2 | ext only | .hsp | agoura |
| helix_stadium_xl | 1 (next-gen) | 48 (12/path) | 8 | Yes | 4 | No | 4 | 1 built-in | .hsp | agoura |

**Key findings from hardware research:**
- HX Stomp and Stomp XL use the same SHARC DSP chip — same raw hardware max 8 blocks, but application limits differ (6 and 9 respectively from `STOMP_CONFIG`). Use application limits.
- Stomp vs Stomp XL: ONLY snapshot count differs (3 vs 4) and block budget (6 vs 9). This is why `getCapabilities()` must take `DeviceTarget`, not `DeviceFamily`.
- Helix Floor, LT, Rack: Identical DSP, blocks, snapshots, amp models. Differ in I/O (more on Floor/Rack) and form factor only. Shared `HELIX_CAPABILITIES` constant is correct.
- Stadium vs Stadium XL: Identical DSP, blocks, paths, snapshots. XL adds built-in expression pedal and 2 more FX loops. For the shared constant, use conservative values.
- "Pod Go XL" does not exist as a Line 6 product (confirmed by exhaustive search, March 2026). Add to type system with pod_go capabilities as placeholder per CONTEXT.md instruction.
- Stadium XL is a real product released June 2025. Device ID not in current corpus (corpus only has Stadium `.hsp` files). Mark helix_stadium_xl device ID as unverified.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean guards (`isHelix()`, `isPodGo()`, `isStomp()`, `isStadium()`) | DeviceFamily discriminated union + resolveFamily() | Phase 61 (this phase) | TypeScript now rejects missing cases at compile time; boolean guards remain for backward compatibility |
| Device resolution via if-else in route.ts | Exhaustive switch in resolveFamily() | Phase 61 | Device resolution is centralized and compile-enforced |
| 6 DeviceTarget values | 9 DeviceTarget values (adds helix_rack, pod_go_xl, helix_stadium_xl) | Phase 61 | Type system now covers anticipated future devices; downstream code must handle all 9 |

**Deprecated/outdated:**
- The `isHelix()` / `isPodGo()` / `isStadium()` / `isStomp()` boolean helpers do NOT need to be updated or removed in this phase. They are used extensively across chain-rules, param-engine, validate, and stomp-builder. They remain valid for their current callers. The new `resolveFamily()` is additive.

## Open Questions

1. **Does `/api/chat` need device param in Phase 61?**
   - What we know: ROUTE-04 says family is resolved before chat begins. Chat route currently receives no device.
   - What's unclear: Is ROUTE-04 satisfied if only the generate route resolves family? Or must chat route also resolve it?
   - Recommendation: Interpret ROUTE-04 conservatively — add `device` to the chat route request body in Phase 61. The frontend already sends `device` to generate; extending to chat is low risk. If that scope is too large, defer to Phase 66 when the full device picker frontend lands.

2. **Helix Rack device ID**
   - What we know: Helix Rack is functionally identical to Helix Floor. It may share device ID 2162689 or have its own (e.g., 2162690 or similar).
   - What's unclear: No Helix Rack `.hlx` file has been imported into the corpus.
   - Recommendation: Use 2162689 (same as Floor) as placeholder with a clear `// UNVERIFIED — confirm from real Helix Rack .hlx export` comment. The planner should add a task to verify before shipping.

3. **Stadium XL device ID**
   - What we know: Stadium XL is a real product released June 2025. Current corpus only has Stadium `.hsp` files.
   - What's unclear: The Stadium XL device ID. It may match Stadium (2490368) or differ.
   - Recommendation: Use 0 as placeholder with `// UNVERIFIED — confirm from real Stadium XL .hsp export`. This will cause preset generation to fail for Stadium XL until verified — acceptable since builders for Stadium XL are not shipped until v5.1.

4. **Stadium shared vs per-device capabilities for FX loops and EXP pedals**
   - What we know: Stadium has 2 FX loops; Stadium XL has 4. Stadium has no built-in EXP; Stadium XL has 1.
   - What's unclear: Whether this matters to any Phase 61 or near-term downstream consumer.
   - Recommendation: Use a single `STADIUM_CAPABILITIES` constant with conservative values (2 FX loops, 0 EXP). If per-device precision is needed, split to `STADIUM_CAPABILITIES` and `STADIUM_XL_CAPABILITIES`. Decision deferred to planner — the type system supports it either way since `getCapabilities()` takes `DeviceTarget`.

## Sources

### Primary (HIGH confidence)

- Existing project files — `src/lib/helix/config.ts` STOMP_CONFIG (STOMP_MAX_BLOCKS: 6, STOMP_XL_MAX_BLOCKS: 9, STOMP_MAX_SNAPSHOTS: 3, STOMP_XL_MAX_SNAPSHOTS: 4), STADIUM_CONFIG (STADIUM_MAX_BLOCKS_PER_PATH: 12, STADIUM_MAX_SNAPSHOTS: 8)
- Existing project files — `src/lib/helix/types.ts` (DEVICE_IDS, DeviceTarget, boolean helpers)
- Existing project files — `tsconfig.json` — `"strict": true` confirmed, enabling `never` exhaustiveness
- TypeScript documentation — discriminated union + `never` guard pattern is standard

### Secondary (MEDIUM confidence)

- Line 6 official processor comparison chart (referenced in multiple search results) — block limits, path counts, snapshot counts for Helix Floor/LT/Rack/Stomp/Stomp XL/Pod Go
- [Line 6 Helix Stadium product page](https://line6.com/helix-stadium/) — Stadium and Stadium XL share DSP/blocks/paths/snapshots; XL adds EXP pedal + more I/O
- [Sweetwater — Stadium XL](https://www.sweetwater.com/store/detail/StadiumXL--line-6-helix-stadium-xl-amp-modeler-and-fx-processor) — 48 dynamic blocks, 4 stereo signal paths
- [Guitar World Stadium XL review](https://www.guitarworld.com/gear/effects-pedals/line-6-helix-stadium-xl) — 12 blocks per path across 4 paths confirmed
- [Line 6 community forum — HX Stomp XL DSP](https://line6.com/support/topic/61259-hx-stomp-xl-dsp-limit/) — confirmed same SHARC DSP as Stomp, 4 snapshots vs 3

### Tertiary (LOW confidence)

- No Pod Go XL search results — absence of results is itself evidence that the product does not exist; capability placeholder uses pod_go values per CONTEXT.md instruction
- Helix Rack device ID assumed same as Floor — no .hlx corpus file available to confirm

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pure TypeScript, project already uses strict mode and discriminated unions
- Architecture: HIGH — DeviceFamily pattern matches existing codebase conventions exactly; file placement and function signatures are clear
- Capability data: HIGH for existing devices (sourced from project config + official documentation); LOW for helix_rack ID, pod_go_xl ID, helix_stadium_xl ID (unverified hardware data)
- Pitfalls: HIGH — directly observed from codebase inspection and hardware research

**Research date:** 2026-03-05
**Valid until:** 2026-09-05 (6 months — hardware specs are stable; TypeScript patterns are stable)
