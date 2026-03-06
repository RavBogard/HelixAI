# Architecture Research

**Domain:** Device-first conversation and generation pipeline — HelixTones v5.0
**Researched:** 2026-03-05
**Confidence:** HIGH — all integration points verified from direct code inspection of current v4.0 codebase

---

## Context: What This Document Covers

This is the integration architecture document for v5.0. It answers:

- How device-first routing integrates with the existing Planner-Executor architecture
- What the device-family module pattern looks like (new modules vs modified files)
- How model catalogs get isolated per family to eliminate cross-contamination
- Which components are NEW vs MODIFIED vs UNCHANGED
- The build order with dependency rationale (what must exist before what)

The existing v4.0 architecture (all 6 devices, Planner-Executor pipeline, Supabase auth, prompt caching, per-model amp overrides, effect combination logic) is stable and NOT re-researched. Focus is on v5.0 integration points only.

---

## System Overview — Current v4.0 State (the starting point)

```
+------------------------------------------------------------------+
|                       Frontend (Next.js)                          |
|  Chat UI | Device Picker (LATE — after [READY_TO_GENERATE])       |
+------------------------------------------------------------------+
                |                        |
         SSE stream (Gemini)      POST /api/generate
                |                        |
+---------------+------------------------+-------------------------+
|                      API Layer (Vercel Serverless)               |
|                                                                   |
|   /api/chat                        /api/generate                 |
|   Gemini 2.5 Flash / 3.1 Pro       Claude Sonnet 4.6 (Planner)   |
|   getSystemPrompt()                buildPlannerPrompt(device)     |
|   [ONE shared prompt, all devices] [ONE prompt w/ conditionals]   |
+------------------------------------------------------------------+
                                        |
                                        | ToneIntent (~15 fields)
                                        | AMP_NAMES = HD2 + Agoura merged
                                        v
+------------------------------------------------------------------+
|                  Knowledge Layer (Deterministic)                  |
|                                                                   |
|  chain-rules.ts: assembleSignalChain(intent, device?)            |
|    ~17 guard sites: isPodGo/isStadium/isStomp/else               |
|                                                                   |
|  param-engine.ts: resolveParameters(chain, intent, device?)      |
|    AMP fallback: tries STADIUM_AMPS ?? AMP_MODELS                |
|                                                                   |
|  snapshot-engine.ts: buildSnapshots(parameterized, snapshots)    |
|    No device awareness (all devices share same logic)            |
|                                                                   |
|  validate.ts: validatePresetSpec(spec, device?)                  |
|    ~4 device-conditional branches                                 |
|                                                                   |
|  Device Builders (separate, clean):                              |
|    preset-builder.ts   (LT/Floor/Rack — .hlx)                    |
|    podgo-builder.ts    (Pod Go — .pgp)                            |
|    stadium-builder.ts  (Stadium — .hsp)                          |
|    stomp-builder.ts    (Stomp/StompXL — .hlx)                    |
+------------------------------------------------------------------+
                |
    models.ts: AMP_NAMES = [...HD2_amps, ...Agoura_amps]  <-- LEAK
+------------------------------------------------------------------+
|  models.ts   param-registry.ts   types.ts   config.ts            |
|  AMP_MODELS  PARAM_TYPE_REGISTRY DeviceTarget FIRMWARE_CONFIG    |
|  STADIUM_AMPS (merged into AMP_NAMES — root cause of Agoura leak)|
+------------------------------------------------------------------+
```

### Current Architecture Problems Being Solved

**Problem 1: Agoura Amp Leak.**
`AMP_NAMES` merges `AMP_MODELS` keys and `STADIUM_AMPS` keys into a single `z.enum()`. The planner schema accepts any name from either catalog regardless of device. The prompt filters the MODEL LIST shown to Claude, but constrained decoding still validates against the full merged enum. Claude can pick Agoura amps for Helix LT. The chain-rules fallback catches this at generation time but it's a bailout, not a prevention.

**Problem 2: Stadium Param Completeness.**
Stadium .hsp presets have ~27 firmware params per amp/effect block. Current param-engine produces ~12. When a preset loads, the firmware fills missing params from whatever was last in memory — "param bleed" from previously loaded presets. This causes unpredictable tone changes.

**Problem 3: 17+ Guard Sites.**
`assembleSignalChain()`, `resolveParameters()`, and `validatePresetSpec()` all pattern-match on device using boolean guards (`isPodGo`, `isStadium`, `isStomp`, else-Helix). Each new device requires a manual search of all 17+ sites. No TypeScript exhaustiveness. Manageable at 6 devices; becomes a maintenance liability if device count grows.

**Problem 4: Late Device Selection.**
Device is selected after `[READY_TO_GENERATE]`. The chat AI uses a single shared prompt with device constraint descriptions embedded as text. Constraints for all 6 devices coexist in one prompt, increasing token usage and reducing prompt caching effectiveness (device-specific sections vary per call).

---

## Target v5.0 System Overview

```
+------------------------------------------------------------------+
|                       Frontend (Next.js)                          |
|  Device Picker (FIRST — before chat starts)                       |
|  Chat UI | Signal Chain Viz | Preset Card                         |
+------------------------------------------------------------------+
         |                              |
  device selected at start       device flows through
  stored in frontend state       all API calls
         |                              |
+---------------+----------------------+---------------------------+
|                      API Layer                                    |
|                                                                   |
|   /api/chat                        /api/generate                 |
|   getSystemPrompt(family)          buildPlannerPrompt(family)     |
|   [PER-FAMILY chat prompt]         [PER-FAMILY planner prompt]    |
+------------------------------------------------------------------+
                                        |
                              DeviceFamily-scoped ToneIntent
                                        |
                                        v
+------------------------------------------------------------------+
|            Device-Family Knowledge Layer (Deterministic)          |
|                                                                   |
|  Family Router (new):                                            |
|    resolveFamily(device) -> "stadium" | "helix" | "stomp" | "podgo"
|                                                                   |
|  Family Modules (new — one per family):                          |
|    families/stadium/  — Agoura catalog, hsp builder, stadium rules|
|    families/helix/    — HD2 catalog, hlx builder, dual-amp rules  |
|    families/stomp/    — HD2 catalog (limited), hlx builder        |
|    families/podgo/    — HD2 catalog (limited), pgp builder        |
|                                                                   |
|  Shared Knowledge Layer (modified — guards removed):             |
|    chain-rules.ts — accepts DeviceCapabilities, no guards        |
|    param-engine.ts — accepts DeviceCapabilities, no guards       |
|    snapshot-engine.ts — unchanged                                |
|    validate.ts — accepts DeviceCapabilities, no guards           |
+------------------------------------------------------------------+
                |
    Per-family catalogs: no cross-contamination
+------------------------------------------------------------------+
|  families/helix/catalog.ts    — HD2 amps only                    |
|  families/stadium/catalog.ts  — Agoura amps only                 |
|  families/stomp/catalog.ts    — HD2 amps (subset)               |
|  families/podgo/catalog.ts    — HD2 amps (subset)               |
|  models.ts — shared effect catalogs, HelixModel interface        |
+------------------------------------------------------------------+
```

---

## Device Family Routing

### Family Definition

Six devices collapse to four families based on shared behavior. Family determines: prompt template, model catalog, chain rules behavior, builder selection.

| Family | Devices | File Format | DSP |
|--------|---------|-------------|-----|
| `helix` | helix_lt, helix_floor | .hlx | dual-DSP, 2 paths |
| `stomp` | helix_stomp, helix_stomp_xl | .hlx | single-DSP, 6/9 blocks |
| `podgo` | pod_go | .pgp | single-DSP, 4 effect limit |
| `stadium` | helix_stadium | .hsp | single-path, slot grid |

LT and Floor are in the same family because they share identical format and Knowledge Layer behavior. The only difference is `DEVICE_IDS` — same chain rules, same builder, same prompt.

### Family Router (new module)

```typescript
// src/lib/helix/families/index.ts

export type DeviceFamily = "helix" | "stomp" | "podgo" | "stadium";

/** Maps any DeviceTarget to its family. Exhaustive — TypeScript errors on missing devices. */
export function resolveFamily(device: DeviceTarget): DeviceFamily {
  switch (device) {
    case "helix_lt":
    case "helix_floor":
      return "helix";
    case "helix_stomp":
    case "helix_stomp_xl":
      return "stomp";
    case "pod_go":
      return "podgo";
    case "helix_stadium":
      return "stadium";
    // TypeScript: no default — if a 7th device is added to DeviceTarget,
    // this function produces a compile error at the unreachable case check.
  }
}
```

The key improvement: `resolveFamily()` is a single exhaustive switch on `DeviceTarget`. Adding a 7th device to the `DeviceTarget` union immediately surfaces as a TypeScript compile error in `resolveFamily()`. This replaces 17+ scattered guard sites with one registration point.

### DeviceCapabilities (replaces guards in Knowledge Layer)

```typescript
// src/lib/helix/families/capabilities.ts

export interface DeviceCapabilities {
  family: DeviceFamily;
  device: DeviceTarget;

  // DSP constraints
  dualDsp: boolean;           // true for helix only
  maxBlocksPerDsp: number;    // 8 for helix, N/A for single-dsp
  maxTotalBlocks: number;     // total block budget

  // Feature flags
  supportsDualAmp: boolean;
  supportsVariax: boolean;
  supportsSnapshots: boolean;
  maxSnapshots: number;

  // Mandatory block insertion flags
  insertParametricEq: boolean;
  insertGainBlock: boolean;

  // Builder identity
  fileExtension: ".hlx" | ".pgp" | ".hsp";
}

/** Build a capabilities object for any device. Single source of truth for device behavior. */
export function getCapabilities(device: DeviceTarget): DeviceCapabilities {
  const family = resolveFamily(device);
  // ... per-family capability definitions
}
```

`chain-rules.ts`, `param-engine.ts`, and `validate.ts` all accept `DeviceCapabilities` instead of `device?: DeviceTarget`. The guard pattern `isPodGo(device) ? ... : isStadium(device) ? ... : ...` becomes `caps.family === "podgo" ? ... : caps.family === "stadium" ? ...` — still branching, but now the branching is on a discriminated union value rather than a set of boolean guards, and adding a new family causes TypeScript to surface it via exhaustiveness checking.

---

## Module Organization Pattern

### File Structure

```
src/lib/helix/
├── families/
│   ├── index.ts              NEW — DeviceFamily type, resolveFamily(), getCapabilities()
│   ├── helix/
│   │   ├── catalog.ts        NEW — HD2 amp catalog (extracted from models.ts)
│   │   ├── prompt.ts         NEW — Helix-specific chat + planner prompt templates
│   │   └── index.ts          NEW — barrel: exports catalog, prompt, family constants
│   ├── stadium/
│   │   ├── catalog.ts        NEW — Agoura amp catalog (extracted from models.ts)
│   │   ├── prompt.ts         NEW — Stadium-specific chat + planner prompt templates
│   │   ├── params.ts         NEW — 27-param firmware completeness table
│   │   └── index.ts          NEW — barrel: exports catalog, prompt, params
│   ├── stomp/
│   │   ├── catalog.ts        NEW — HD2 amp catalog (stomp-compatible subset)
│   │   ├── prompt.ts         NEW — Stomp-specific chat + planner prompt templates
│   │   └── index.ts          NEW — barrel
│   └── podgo/
│       ├── catalog.ts        NEW — HD2 amp catalog (pod go-compatible subset)
│       ├── prompt.ts         NEW — Pod Go-specific chat + planner prompt templates
│       └── index.ts          NEW — barrel
│
├── models.ts                 MODIFY — remove STADIUM_AMPS, remove AMP_NAMES merged enum
│                             Keep: effect catalogs, HelixModel interface, CAB_MODELS
├── tone-intent.ts            MODIFY — AMP_NAMES/EFFECT_NAMES sourced per-family, not merged
├── chain-rules.ts            MODIFY — accept DeviceCapabilities, remove ~10 guard sites
├── param-engine.ts           MODIFY — accept DeviceCapabilities, remove ~3 guard sites
├── validate.ts               MODIFY — accept DeviceCapabilities, remove ~4 guard sites
├── config.ts                 NO CHANGE — config constants stay, consumed by capabilities
├── types.ts                  MODIFY — add DeviceFamily type (or import from families/)
├── param-registry.ts         NO CHANGE
├── preset-builder.ts         NO CHANGE — .hlx format unchanged
├── podgo-builder.ts          NO CHANGE — .pgp format unchanged
├── stadium-builder.ts        MODIFY — add 27-param completeness from stadium/params.ts
├── stomp-builder.ts          NO CHANGE — .hlx format unchanged
├── snapshot-engine.ts        NO CHANGE — no device awareness needed
└── index.ts                  MODIFY — export families/ barrel exports
```

### Per-Family Catalog Pattern

Each family module owns its amp catalog. The catalog exports the amp `Record`, the amp `Names` enum tuple, and the per-model `cabAffinity` data used by the planner prompt.

```typescript
// src/lib/helix/families/stadium/catalog.ts

import { BLOCK_TYPES } from "../../models";
import type { HelixModel } from "../../models";

/** Stadium amp catalog — Agoura_* IDs only. NOT exported from root models.ts. */
export const STADIUM_AMPS: Record<string, HelixModel> = {
  "Agoura German Xtra Red": { ... },
  "Agoura Brit 2203 MV": { ... },
  // ... all 18 Agoura amps
};

/** Valid amp names for Stadium ToneIntent schema — Stadium devices only. */
export const STADIUM_AMP_NAMES = Object.keys(STADIUM_AMPS) as [string, ...string[]];
```

```typescript
// src/lib/helix/families/helix/catalog.ts

import { BLOCK_TYPES } from "../../models";
import type { HelixModel } from "../../models";

/** HD2 amp catalog — for Helix LT, Floor, Stomp, and Pod Go. */
export const HD2_AMPS: Record<string, HelixModel> = {
  "US Deluxe Nrm": { id: "HD2_AmpUSDeluxeNrm", ... },
  // ... all HD2 amps
};

/** Valid amp names for Helix/Stomp/PodGo ToneIntent schema. */
export const HD2_AMP_NAMES = Object.keys(HD2_AMPS) as [string, ...string[]];
```

By splitting catalogs into separate files, the Zod schema for each family's `ToneIntent` sources its `ampName` enum from the family-specific catalog. A Stadium request gets a schema that ONLY allows Agoura names. A Helix request gets a schema that ONLY allows HD2 names. No merged enum, no constrained-decoding escape.

### Per-Family ToneIntent Schema

```typescript
// src/lib/helix/families/stadium/index.ts

import { STADIUM_AMP_NAMES } from "./catalog";
import { CAB_NAMES, EFFECT_NAMES } from "../../models";
import { z } from "zod";

/** ToneIntent schema scoped to Stadium devices. ampName validates against Agoura catalog only. */
export const StadiumToneIntentSchema = z.object({
  ampName: z.enum(STADIUM_AMP_NAMES),
  cabName: z.enum(CAB_NAMES),
  // NO secondAmpName — Stadium is single-path
  guitarType: z.enum(["single_coil", "humbucker", "p90"]),
  effects: z.array(EffectIntentSchema).max(4), // Stadium: tighter budget
  snapshots: z.array(SnapshotIntentSchema).min(3).max(8),
  // ... shared fields
});
```

```typescript
// src/lib/helix/families/helix/index.ts

import { HD2_AMP_NAMES } from "./catalog";

/** ToneIntent schema scoped to Helix LT/Floor devices. Includes dual-amp support. */
export const HelixToneIntentSchema = z.object({
  ampName: z.enum(HD2_AMP_NAMES),
  secondAmpName: z.enum(HD2_AMP_NAMES).optional(),  // dual-amp
  // ...
});
```

This is the structural fix to the Agoura leak. Claude's constrained decoding validates against the family-scoped schema. Agoura names are not valid tokens for non-Stadium requests at the token level.

---

## Chat System Prompt Isolation

### Current State (one shared prompt)

`gemini.ts` exports `getSystemPrompt()` with no parameters. It contains inline text describing all 6 devices with their constraints. Prompt caching is applied globally — the same prompt hash is used for all devices because the prompt content doesn't change per device.

### v5.0 Target (per-family prompt)

```typescript
// gemini.ts (modified)

export function getSystemPrompt(family: DeviceFamily): string {
  const familyPrompt = getFamilyPromptSection(family);
  return `${SHARED_PREAMBLE}

${familyPrompt}

${SHARED_CLOSING}`;
}
```

Prompt caching continues to work because `family` is resolved before the first message and stays constant for the session. A Stadium session always hits the Stadium prompt cache. A Helix session always hits the Helix prompt cache. Cache hit rates improve because the family-scoped prompt is shorter and the hash is consistent within a family.

The family prompt sections are stored in `families/{family}/prompt.ts`:

```typescript
// src/lib/helix/families/stadium/prompt.ts

export const STADIUM_CHAT_PROMPT = `
## Your Device: Helix Stadium

The user has a Helix Stadium — Line 6's arena-grade amp modeler. Stadium uses the
Agoura amp library (different from standard Helix). It does NOT support:
- Dual-amp presets (single signal path only)
- Variax VDI input
- More than 4 user effects (DSP budget)

When discussing amp choices, reference Agoura models by their descriptive names:
- Agoura German Xtra Red (Mesa Dual Rectifier character)
- Agoura Brit 2203 MV (Marshall JCM800 character)
- [... per-model descriptions]
`;

export const STADIUM_PLANNER_PROMPT_CONSTRAINTS = `
**DEVICE RESTRICTION — Helix Stadium:**
- Use ONLY amps from the AMPS list above (Agoura_* models)
- Maximum 4 user effects (amp+cab+boost+gate+eq+gain = 6 mandatory slots)
- No secondAmpName / secondCabName — Stadium is series-only
- Generate exactly 4-8 snapshots
`;
```

### Device Propagation Through Chat API

Currently `device` is sent only to `/api/generate`. In v5.0, it is also sent to `/api/chat`:

```typescript
// /api/chat/route.ts (modified)

const { messages, premiumKey, conversationId, device } = await req.json();
const family = device ? resolveFamily(device) : "helix"; // default

const chat = ai.chats.create({
  model: modelId,
  config: {
    systemInstruction: getSystemPrompt(family),  // family-scoped
    tools: [{ googleSearch: {} }],
  },
  history,
});
```

Frontend stores `device` in state from the first user interaction (device picker) and sends it on every chat message. The chat AI receives a focused, device-appropriate system prompt from message one.

---

## Planner Prompt Isolation

### Current State

`buildPlannerPrompt(modelList, device?)` in `planner.ts` handles all 6 devices with conditional string interpolation. Device-specific constraint notes are injected as template literals. Prompt caching works but the prompt is monolithic — one function produces all variants.

### v5.0 Target

`buildPlannerPrompt(family, device)` — `family` drives the structural template, `device` provides sub-variant constants (Stomp vs StompXL max blocks).

```typescript
// src/lib/planner.ts (modified)

export function buildPlannerPrompt(family: DeviceFamily, device: DeviceTarget): string {
  const catalog = getFamilyCatalog(family);     // family-specific catalog
  const modelList = buildModelList(catalog);    // format catalog for prompt
  const constraints = getFamilyConstraints(family, device); // from prompt.ts

  return `${SHARED_PLANNER_PREAMBLE}

## Valid Model Names

${modelList}

${SHARED_CREATIVE_GUIDELINES}

${constraints}

Based on the conversation below, generate a ToneIntent:`;
}
```

The model list section is generated entirely from the family catalog — Stadium sees only Agoura amps, Helix sees only HD2 amps. The constraints section comes from `families/{family}/prompt.ts`. Shared sections (creative guidelines, cab pairing table, effect discipline) remain in the main `planner.ts`.

---

## Stadium Firmware Parameter Completeness

### The 12-vs-27 Problem

Stadium amp blocks in real .hsp files contain 27 parameters per block. The current param-engine produces 12. Missing params (`AmpCabPeak*`, `AmpCabShelf*`, `Aggression`, `Bright`, `Contour`, `Depth`, `Fat`, `Hype`) are filled from the device's previous preset state — this is param bleed.

### Solution: Stadium Firmware Param Table

A new module in `families/stadium/params.ts` provides the complete 27-param set per amp model, sourced from real .hsp file corpus inspection:

```typescript
// src/lib/helix/families/stadium/params.ts

/** Complete 27-param firmware defaults for each Agoura amp model.
 *  Values sourced from real .hsp file corpus (11 presets, 2026-03-05).
 *  These are the FIRMWARE-LEVEL params that must be present in every Stadium preset.
 *  param-engine uses these to supplement the 12-param production values.
 */
export const STADIUM_AMP_FIRMWARE_PARAMS: Record<string, Record<string, number>> = {
  "Agoura_AmpGermanXtraRed": {
    // Standard amp params (already in param-engine output)
    Drive: 0.65, Bass: 0.50, Mid: 0.45, Treble: 0.55, Master: 0.45, ChVol: 0.80,
    // Firmware-required params — currently missing, causing param bleed
    Aggression: 0.50,
    Bright: 0.0,
    Contour: 0.50,
    Depth: 0.50,
    Fat: 0.50,
    Hype: 0.50,
    AmpCabPeakFreq: 0.50,
    AmpCabPeakGain: 0.50,
    AmpCabPeakQ: 0.50,
    AmpCabShelfFreq: 0.50,
    AmpCabShelfGain: 0.50,
    // ... remaining 10 params
  },
  // ... other Agoura amps
};
```

The `stadium-builder.ts` merges the param-engine output with `STADIUM_AMP_FIRMWARE_PARAMS` to ensure all 27 params are present:

```typescript
// stadium-builder.ts (modified)

function buildAmpBlock(block: BlockSpec): StadiumBlock {
  const firmwareDefaults = STADIUM_AMP_FIRMWARE_PARAMS[block.modelId] ?? {};
  const mergedParams = {
    ...firmwareDefaults,          // all 27 params with firmware defaults
    ...block.parameters,          // override with param-engine values (12 params)
  };
  // Encode as { value: X } pairs
}
```

The merge order is intentional: firmware defaults first, param-engine values win on overlap. This guarantees all 27 params are always present while preserving the Knowledge Layer's tuned values for the 12 params it sets.

### Research Required: Complete Param Table

The 27-param firmware table must be built from real .hsp corpus inspection. Phase 1 of Stadium work must extract and document all parameter keys and their default values for each Agoura model. This is the highest-priority research task for Stadium.

---

## Data Flow Changes

### v5.0 Preset Generation Data Flow

```
User selects device in UI (FIRST INTERACTION — before chat)
        |
        | device stored in frontend state
        |
        v
POST /api/chat { messages, device: "helix_stadium", ... }
        |
        | resolveFamily("helix_stadium") -> "stadium"
        | getSystemPrompt("stadium") -> Stadium-scoped chat prompt
        | Gemini 2.5 Flash with Stadium-focused interview constraints
        |
        v (chat continues until [READY_TO_GENERATE])
        |
        v
POST /api/generate { messages, device: "helix_stadium", ... }
        |
        | resolveFamily("helix_stadium") -> "stadium"
        | getFamilyCatalog("stadium") -> STADIUM_AMPS only
        | buildPlannerPrompt("stadium", "helix_stadium")
        |    -> model list: Agoura amps only
        |    -> constraints: Stadium-specific
        |
        v
Claude Sonnet 4.6 structured output
        |
        | StadiumToneIntentSchema (z.enum(STADIUM_AMP_NAMES) — Agoura names only)
        | constrained decoding: "Brit Marshall" resolves to "Agoura Brit 2203 MV"
        |                        NOT to "Brit Silver" (HD2 model name)
        |
        v ToneIntent { ampName: "Agoura Brit 2203 MV", ... }
        |
        v
getCapabilities("helix_stadium") -> caps
assembleSignalChain(intent, caps)   [MODIFIED — caps replaces device guards]
        |
        v
resolveParameters(chain, intent, caps)   [MODIFIED — caps replaces device guards]
        | Stadium path: merge STADIUM_AMP_FIRMWARE_PARAMS (all 27 params)
        |
        v
buildSnapshots(parameterized, intents)   [UNCHANGED]
        |
        v
validatePresetSpec(spec, caps)   [MODIFIED — caps replaces device guards]
        |
        v
buildHspFile(presetSpec)   [MODIFIED — uses firmware param table for completeness]
        |
        v
JSON response { preset: hspFile.json, fileExtension: ".hsp", ... }
```

### Frontend Device Picker Flow Change

```
Current:
  User → chat → AI interview → [READY_TO_GENERATE] → device picker appears → Generate

v5.0:
  User → device picker (first thing) → chat with device-scoped AI → Generate
```

Frontend stores `selectedDevice` in component state from the very first render. The device picker is rendered before the chat input — it is a prerequisite for starting the conversation, not a post-hoc choice.

The chat message `POST /api/chat` must include `device`. This is additive — `device` already goes to `/api/generate`, it simply needs to also go to `/api/chat`.

---

## Component Integration Map for v5.0

### New Components

| Component | File | Purpose |
|-----------|------|---------|
| Family Router | `families/index.ts` | `resolveFamily()`, `getCapabilities()`, `DeviceFamily` type |
| Stadium Catalog | `families/stadium/catalog.ts` | Agoura amps extracted from `models.ts` |
| Stadium Prompt | `families/stadium/prompt.ts` | Stadium chat + planner prompt sections |
| Stadium Firmware Params | `families/stadium/params.ts` | 27-param completeness table (from corpus) |
| Helix Catalog | `families/helix/catalog.ts` | HD2 amps (currently in `models.ts`) |
| Helix Prompt | `families/helix/prompt.ts` | Helix chat + planner prompt sections |
| Stomp Catalog | `families/stomp/catalog.ts` | HD2 amps (stomp-compatible subset) |
| Stomp Prompt | `families/stomp/prompt.ts` | Stomp chat + planner prompt sections |
| Pod Go Catalog | `families/podgo/catalog.ts` | HD2 amps (pod go-compatible subset) |
| Pod Go Prompt | `families/podgo/prompt.ts` | Pod Go chat + planner prompt sections |

### Modified Components

| Component | File | What Changes |
|-----------|------|-------------|
| `models.ts` | `models.ts` | Remove `STADIUM_AMPS`, remove merged `AMP_NAMES` enum. Keep effect catalogs, `HelixModel` interface, `CAB_MODELS`, `BLOCK_TYPES`. |
| `tone-intent.ts` | `tone-intent.ts` | Remove single global `ToneIntentSchema`. Export per-family schemas (or a schema factory). `AMP_NAMES` sourced per-family. |
| `chain-rules.ts` | `chain-rules.ts` | Accept `DeviceCapabilities` instead of `device?: DeviceTarget`. Replace ~10 boolean guard sites with `caps.family` or `caps.supportsDualAmp` etc. |
| `param-engine.ts` | `param-engine.ts` | Accept `DeviceCapabilities`. Remove `MODEL_LOOKUPS` amp entry — family catalogs are the source. Stadium path: merge firmware param table. |
| `validate.ts` | `validate.ts` | Accept `DeviceCapabilities`. Remove ~4 guard-based branches. |
| `stadium-builder.ts` | `stadium-builder.ts` | Import and apply `STADIUM_AMP_FIRMWARE_PARAMS` for 27-param completeness. |
| `planner.ts` | `planner.ts` | `buildPlannerPrompt(family, device)` — family determines catalog and constraints. |
| `gemini.ts` | `gemini.ts` | `getSystemPrompt(family)` — family determines device-specific chat instructions. |
| `/api/chat/route.ts` | `route.ts` | Accept `device` in request body. Pass family to `getSystemPrompt()`. |
| `/api/generate/route.ts` | `route.ts` | Pass family to `buildPlannerPrompt()`. Use family-scoped ToneIntent schema. |
| `index.ts` | `index.ts` | Export families barrel, per-family schemas. Remove merged `AMP_NAMES`. |
| Frontend `page.tsx` / `ChatUI.tsx` | Frontend | Move device picker to first render, before chat. Send `device` on every chat message. |

### Unchanged Components

| Component | File | Why Unchanged |
|-----------|------|--------------|
| `preset-builder.ts` | `preset-builder.ts` | .hlx format unchanged; receives `PresetSpec` same as before |
| `podgo-builder.ts` | `podgo-builder.ts` | .pgp format unchanged; receives `PresetSpec` same as before |
| `stomp-builder.ts` | `stomp-builder.ts` | .hlx format unchanged; receives `PresetSpec` same as before |
| `snapshot-engine.ts` | `snapshot-engine.ts` | No device awareness needed; SnapshotSpec format is device-agnostic |
| `config.ts` | `config.ts` | Constants consumed by capabilities, not modified |
| `param-registry.ts` | `param-registry.ts` | Encoding types are device-agnostic |
| `rig-intent.ts` | `rig-intent.ts` | Rig emulation types are device-agnostic |
| Supabase layer | `supabase/` | Auth, DB, storage — no change |

---

## Build Order

Dependencies flow as: catalog isolation → schema isolation → capability object → Knowledge Layer guard removal → prompts → frontend picker.

The catalog and schema isolation work MUST precede the Knowledge Layer guard removal, because the Knowledge Layer's `resolveFamily()` call requires that family-scoped catalogs exist. Prompt isolation is independent of Knowledge Layer work but depends on catalogs existing for model list generation.

### Phase 1: Family Router + Capability Object

**Goal:** Create the `families/` directory and its core types. No existing files modified yet. Tests can run.

**Files:** `src/lib/helix/families/index.ts` (new)

**Tasks:**
1. Define `DeviceFamily` type
2. Implement `resolveFamily(device)` — exhaustive switch
3. Implement `getCapabilities(device)` — returns `DeviceCapabilities` per device
4. Export from `families/index.ts`

**Depends on:** Nothing — pure addition

**Output:** `resolveFamily()` and `getCapabilities()` are importable. All 6 devices map to 4 families. TypeScript exhaustiveness enforced.

---

### Phase 2: Catalog Extraction

**Goal:** Extract per-family amp catalogs from `models.ts` into `families/{family}/catalog.ts`. Make `models.ts` not export amp catalogs. This is the structural fix to the Agoura leak.

**Files:** `families/stadium/catalog.ts`, `families/helix/catalog.ts`, `families/stomp/catalog.ts`, `families/podgo/catalog.ts` (all new). `models.ts` (modified — remove STADIUM_AMPS, AMP_MODELS).

**Tasks:**
1. Create `families/stadium/catalog.ts` — move `STADIUM_AMPS` from `models.ts`; add `STADIUM_AMP_NAMES`
2. Create `families/helix/catalog.ts` — move `AMP_MODELS` from `models.ts`; add `HD2_AMP_NAMES`
3. Stomp and Pod Go share HD2 amps but with exclusion lists — create filtered re-exports or subsets in their catalog files
4. Remove `STADIUM_AMPS`, `AMP_MODELS`, merged `AMP_NAMES` from `models.ts`
5. Update all import sites that currently reference `models.ts` amp catalogs

**Depends on:** Phase 1 (family types must exist before catalog files can reference them)

**Output:** Each family has its own amp catalog. `models.ts` retains effect catalogs, `CAB_MODELS`, `HelixModel` interface, `BLOCK_TYPES` only. Merged `AMP_NAMES` is gone.

**Risk:** This is the highest-risk phase. `AMP_MODELS` and `STADIUM_AMPS` are imported by `chain-rules.ts`, `param-engine.ts`, and `validate.ts`. All import sites must be updated. Run full test suite before proceeding to Phase 3.

---

### Phase 3: Per-Family ToneIntent Schemas

**Goal:** Replace single global `ToneIntentSchema` with family-scoped schemas. Eliminate the merged `AMP_NAMES` enum from Zod validation.

**Files:** `families/stadium/index.ts`, `families/helix/index.ts`, `families/stomp/index.ts`, `families/podgo/index.ts` (new). `tone-intent.ts` (modified — exports schema factory or per-family schemas).

**Tasks:**
1. Create `StadiumToneIntentSchema` using `STADIUM_AMP_NAMES`
2. Create `HelixToneIntentSchema` using `HD2_AMP_NAMES` — includes `secondAmpName`
3. Create `StompToneIntentSchema` using `HD2_AMP_NAMES` (stomp subset) — no `secondAmpName`
4. Create `PodGoToneIntentSchema` using `HD2_AMP_NAMES` (podgo subset) — no `secondAmpName`
5. Export a `getToneIntentSchema(family)` factory function from `tone-intent.ts`
6. Update `planner.ts` to call `getToneIntentSchema(family)` for structured output

**Depends on:** Phase 2 (family catalogs must exist to source `AMP_NAMES` enums)

**Output:** Claude's constrained decoding validates against family-specific amp names. Agoura-to-Helix bleed is structurally impossible. The `ToneIntent` type continues to be the shared TypeScript interface consumed by the Knowledge Layer.

**Note on backward compatibility:** The `ToneIntent` TypeScript type (the inferred type from the schema) remains the same interface used by `chain-rules.ts`, `param-engine.ts`, etc. Only the Zod schema (validation) changes. Knowledge Layer code does not need to change to handle the schema refactor.

---

### Phase 4: Knowledge Layer Guard Removal

**Goal:** Replace all 17+ guard sites in `chain-rules.ts`, `param-engine.ts`, and `validate.ts` with `DeviceCapabilities` lookups.

**Files:** `chain-rules.ts` (modified), `param-engine.ts` (modified), `validate.ts` (modified)

**Tasks:**
1. Change `assembleSignalChain(intent, device?)` to `assembleSignalChain(intent, caps: DeviceCapabilities)`
2. Replace ~10 boolean guard sites in `assembleSignalChain()` with capability fields
3. Change `resolveParameters(chain, intent, device?)` to accept `caps: DeviceCapabilities`
4. Replace ~3 guard sites in `resolveParameters()` with capability fields
5. Change `validatePresetSpec(spec, device?)` to accept `caps: DeviceCapabilities`
6. Replace ~4 guard sites in `validatePresetSpec()` with capability fields
7. Update `generate/route.ts` to call `getCapabilities(device)` and pass `caps` through pipeline

**Depends on:** Phase 1 (capabilities object must exist). Phases 2 and 3 can be complete but are not required — the Knowledge Layer consumes `ToneIntent` (unchanged type), not the Zod schema.

**Output:** No boolean guard sites in Knowledge Layer. Adding a 7th device requires only (a) adding it to `DeviceTarget` union, (b) handling it in `resolveFamily()`, (c) defining its capabilities. No Knowledge Layer searches.

---

### Phase 5: Stadium Firmware Parameter Completeness

**Goal:** Build the 27-param firmware table from real .hsp corpus. Apply it in `stadium-builder.ts`.

**Files:** `families/stadium/params.ts` (new — requires corpus research), `stadium-builder.ts` (modified)

**Tasks:**
1. Extract all parameter keys and default values from real Stadium .hsp files for each Agoura amp model
2. Build `STADIUM_AMP_FIRMWARE_PARAMS` table in `params.ts`
3. Import and apply in `stadium-builder.ts` — merge firmware defaults with param-engine output
4. Test: generate Stadium presets, verify all 27 params present in .hsp output
5. Hardware verification: load generated .hsp on Stadium hardware or in HX Edit, confirm no param bleed

**Depends on:** Phase 2 (catalog isolation must be complete first — Stadium catalog is the source of amp model IDs for the table). Does NOT depend on Phases 3 or 4.

**Output:** Stadium presets include all 27 firmware params. Param bleed eliminated.

**Note:** This phase requires corpus research — inspecting real .hsp files for each Agoura amp. The param table cannot be inferred; it must be observed. Flag this phase for deep research before implementation.

---

### Phase 6: Prompt Isolation

**Goal:** Create per-family prompt templates. Wire `getSystemPrompt(family)` and `buildPlannerPrompt(family, device)`.

**Files:** `families/{family}/prompt.ts` (4 new files), `gemini.ts` (modified), `planner.ts` (modified)

**Tasks:**
1. Write Stadium chat prompt section — Agoura amp descriptions, single-path constraint, 8-snapshot capability
2. Write Helix chat prompt section — dual-amp capability, DSP split, LT vs Floor distinction
3. Write Stomp chat prompt section — block budget, 3/4 snapshots, series-only
4. Write Pod Go chat prompt section — 4-effect limit, series-only, .pgp format
5. Modify `getSystemPrompt(family)` in `gemini.ts` to use family sections
6. Modify `buildPlannerPrompt(family, device)` in `planner.ts` to use family constraints
7. Verify prompt caching: same family = same prompt hash = cache hit

**Depends on:** Phase 2 (catalogs must exist for model list generation in planner prompt). Phases 3 and 4 not required.

**Can run in parallel with:** Phase 5 (firmware params)

**Output:** Each device family gets a focused prompt containing only its device constraints and model catalog. Prompt token count per call is reduced. Cache hit rate improves within each family.

---

### Phase 7: Frontend Device Picker Relocation

**Goal:** Move device picker to the start of conversation. Send `device` on every `/api/chat` call.

**Files:** Frontend component files (page.tsx, ChatUI.tsx, or equivalent)

**Tasks:**
1. Render device picker as the first UI element — block chat input until device is selected
2. Store `selectedDevice` in component state from first render
3. Include `device` in every `/api/chat` POST body
4. Modify `/api/chat/route.ts` to accept `device`, call `resolveFamily()`, pass to `getSystemPrompt()`
5. Remove the "device picker appears after [READY_TO_GENERATE]" logic from chat UI

**Depends on:** Phase 6 (family-scoped chat prompts must exist before `/api/chat` can use family routing)

**Output:** User picks device first. Chat AI knows device constraints from message one. No late-binding device selection.

---

### Dependency Graph

```
Phase 1: Family Router + Capabilities
    |
    v
Phase 2: Catalog Extraction  ——————————————+
    |                                       |
    v                                       |
Phase 3: Per-Family ToneIntent Schemas      |
    |                                       |
    v                                       v
Phase 4: Knowledge Layer Guard Removal   Phase 5: Stadium Firmware Params
                                            |
                                         (hardware verification)
                                            |
Phase 6: Prompt Isolation  ←—————————————  |
    |    [depends on Phase 2 catalogs]       |
    v                                       |
Phase 7: Frontend Picker Relocation

All Phases → Full v5.0 System
```

**Critical path:** 1 → 2 → 3 → 4 → 6 → 7 (sequential dependency chain)
**Parallel track:** 5 can run after Phase 2, in parallel with 3 and 4.

---

## Anti-Patterns

### Anti-Pattern 1: Merged Amp Enum with Runtime Filtering

**What people do:** Keep `AMP_NAMES = [...HD2_amps, ...Agoura_amps]` as a merged enum and rely on the planner prompt to show only the relevant subset to Claude.

**Why it's wrong:** Claude's constrained decoding validates against the Zod schema, not the prompt content. The prompt says "only use Agoura amps" but the schema allows all names. In practice, Claude respects the prompt most of the time, but constrained decoding can and does select from the full valid token set when the requested token has low probability. The Agoura leak confirmed in v4.0 post-triage is caused exactly by this pattern.

**Do this instead:** Per-family ToneIntent schemas (Phase 3). Agoura names must not be valid tokens in the Helix schema. This is a structural fix, not a prompt fix.

---

### Anti-Pattern 2: Capability Registry as Deep Module

**What people do:** Create a `DeviceCapabilityRegistry` as a full module with registration functions, observers, and dynamic lookup — treating capability detection as a runtime concern.

**Why it's wrong:** Device capabilities in HelixTones are compile-time constants. The set of devices never changes at runtime. A deeply structured registry adds abstraction overhead without benefit. The `getCapabilities(device)` function with a switch statement is the correct level of abstraction — it is type-safe via TypeScript exhaustiveness, zero runtime overhead, and readable.

**Do this instead:** A simple function with a switch statement in `families/index.ts`. Capabilities object is a plain interface. The value is the TypeScript compile-time guarantee, not runtime infrastructure.

---

### Anti-Pattern 3: Migrating Chain Rules Before Catalog Isolation

**What people do:** Try to remove guard sites in `chain-rules.ts` first because it seems like the obvious starting point.

**Why it's wrong:** `chain-rules.ts` currently imports `STADIUM_AMPS` and `AMP_MODELS` directly. Removing guards without first extracting catalogs means the guard removal refactor is tangled with the catalog split. The dependency order exists for a reason: catalog isolation (Phase 2) must precede guard removal (Phase 4).

**Do this instead:** Follow the build order. Phase 2 extracts catalogs so that Phase 4 can import from `families/{family}/catalog.ts` cleanly. The import sites change and the guards change in the same Phase 4 commit — no intermediate broken state.

---

### Anti-Pattern 4: Per-Family ToneIntent Types (not just schemas)

**What people do:** Create separate TypeScript types for each family's ToneIntent (StadiumToneIntent, HelixToneIntent, etc.) and thread these through the Knowledge Layer.

**Why it's wrong:** The Knowledge Layer (chain-rules, param-engine, snapshot-engine) doesn't need to know which family's schema produced the intent. It processes `ampName`, `cabName`, `effects[]`, `snapshots[]` — all of which are present in every family's intent. Creating separate types for the same shape adds generics or union types throughout the Knowledge Layer without benefit.

**Do this instead:** Per-family Zod schemas for validation and constrained decoding. Single shared `ToneIntent` TypeScript type for the Knowledge Layer. The schema validates; the type provides structure. These are separate concerns.

---

## Integration Points

### External Service Boundaries (No Changes)

| Service | Integration | v5.0 Change |
|---------|-------------|-------------|
| Claude API | Anthropic SDK, structured output, prompt caching | Schema becomes family-scoped; caching still works |
| Gemini API | Google AI SDK, SSE streaming, Google Search | System prompt becomes family-scoped; model unchanged |
| Supabase | Auth, Postgres, Storage | No change |
| Vercel | Serverless functions, static Next.js | No new routes |

### Internal Module Boundaries

| Boundary | Communication | v5.0 Impact |
|----------|---------------|-------------|
| Frontend → `/api/chat` | `{ messages, device, ... }` | ADD `device` to every chat request |
| `/api/chat` → `gemini.ts` | `getSystemPrompt(family)` | CHANGE: was no-arg, now family-scoped |
| `/api/generate` → `planner.ts` | `buildPlannerPrompt(family, device)` | CHANGE: was `(modelList, device?)` |
| `planner.ts` → Claude API | family-scoped `ToneIntentSchema` | CHANGE: per-family Zod schema |
| `chain-rules.ts` → `param-engine.ts` | `BlockSpec[]` (unchanged) | NO CHANGE — interface stable |
| `param-engine.ts` → `stadium-builder.ts` | `BlockSpec[]` with 12 params | CHANGE: builder now merges with 27-param table |
| `families/stadium/catalog.ts` → `chain-rules.ts` | Agoura amp catalog | NEW import path (was `models.ts`) |
| `families/helix/catalog.ts` → `chain-rules.ts` | HD2 amp catalog | NEW import path (was `models.ts`) |

---

## Sources

- Direct code inspection: all files in `src/lib/helix/` and `src/lib/` (v4.0, 2026-03-05)
- `.planning/architecture-audit-v4.md` — 17 guard site count, fragility analysis
- `.planning/PROJECT.md` — v5.0 milestone goals, current state description
- Post-v4.0 bug triage findings: Agoura leak root cause, Stadium 12-vs-27 param bleed

---

*Architecture research for: HelixTones v5.0 — Device-First Architecture*
*Researched: 2026-03-05*
