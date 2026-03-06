# Phase 64: Knowledge Layer Guard Removal - Research

**Researched:** 2026-03-06
**Domain:** TypeScript refactor — replace boolean device guard functions with DeviceCapabilities field access across 4 modules
**Confidence:** HIGH — all source files read directly, no third-party libraries involved

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**1. Capability Field Gaps — extend DeviceCapabilities with 3 new fields:**
- `maxEffectsPerDsp: number` — effect block limits (Stomp=2-5, Stadium=4, Pod Go=4, Helix=unlimited)
- `mandatoryBlockTypes: ReadonlyArray<BlockType>` — block types auto-inserted during chain assembly (Helix: ['eq','gain'], Pod Go/Stomp: [])
- `modelSuffix: string | null` — model name suffix for catalog lookup (Pod Go: '_PodGo', others: null)

**2. models.ts Guard Scope — include models.ts in Phase 64:**
Total scope is chain-rules.ts + param-engine.ts + validate.ts + models.ts.
`isPodGo()`, `isStadium()`, `isStomp()` helper functions in types.ts: remove if zero remaining callers after refactoring.

**3. STADIUM_AMPS Lookup Pattern — implementation choice for Claude:**
Phase 63's `STADIUM_AMPS[block.modelName]` lookups are model-based (not device-based). Options: leave as-is, replace with `caps.ampCatalogEra === 'agoura'`, or abstract to model metadata. Claude picks cleanest approach.

**4. Function Signature Strategy:**
- Functions receive full `DeviceCapabilities` object (e.g., `assembleSignalChain(intent, caps)`)
- Callers resolve capabilities once via `getCapabilities(resolveFamily(device))` and pass through
- Required vs. optional, resolution in caller vs. callee: implementation choice for Claude

### Claude's Discretion

- Whether `caps` is required or optional in function signatures
- Where `getCapabilities()` is called (caller or callee)
- STADIUM_AMPS lookup pattern (see decision 3)

### Deferred Ideas (OUT OF SCOPE)

(none captured)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KLAYER-01 | chain-rules.ts guard sites replaced with DeviceCapabilities-driven dispatch | All 6+ guard sites in chain-rules.ts catalogued below; caps field mappings identified |
| KLAYER-02 | param-engine.ts device guards replaced with DeviceCapabilities-driven dispatch | 3 guard sites in param-engine.ts catalogued; STADIUM_AMPS model-based lookup vs device-based distinction clarified |
| KLAYER-03 | validate.ts device guards replaced with DeviceCapabilities-driven dispatch | 5+ guard sites in validate.ts catalogued; Stomp XL sub-device pattern documented |
| KLAYER-04 | Adding a new device requires no changes to shared code — only family module update | New fields on DeviceCapabilities encode all device-specific behavior; callers resolved once at pipeline entry |
</phase_requirements>

---

## Summary

Phase 64 is a pure TypeScript refactor with no new external dependencies. The goal is mechanical: every call to `isPodGo(device)`, `isStadium(device)`, and `isStomp(device)` inside the four Knowledge Layer files (chain-rules.ts, param-engine.ts, validate.ts, models.ts) is replaced by a field access on a `DeviceCapabilities` object. The `DeviceCapabilities` interface lives in `device-family.ts` (Phase 61) and currently has 13 fields. Three new fields must be added before the refactor can begin.

The current call chain in `route.ts` is: `assembleSignalChain(intent, deviceTarget)` → internal `isPodGo(device)` etc. After Phase 64 the call chain will be: caller resolves `const caps = getCapabilities(deviceTarget)` once, then passes `caps` through. The four Knowledge Layer functions no longer receive `DeviceTarget` at all — they receive `DeviceCapabilities`. This makes the Knowledge Layer family-agnostic: adding a 7th device (e.g., `helix_rack_v2`) requires only updating `device-family.ts`; the four core modules compile and run correctly without any edits.

The most complex guard site is the Stomp sub-device pattern in validate.ts and chain-rules.ts where `device === "helix_stomp_xl"` is used to select different block limits and snapshot limits for Stomp vs Stomp XL. This is already handled by the existing Phase 61 split: `STOMP_CAPABILITIES` (6 blocks) and `STOMP_XL_CAPABILITIES` (12 blocks) are separate objects, so `caps.maxBlocksTotal` resolves to the correct value without any sub-device check.

**Primary recommendation:** Add 3 fields to DeviceCapabilities in device-family.ts first (Wave 0 task), then refactor each file separately with tests passing between each file. The STADIUM_AMPS lookup pattern (`STADIUM_AMPS[block.modelName]`) should be replaced with `caps.ampCatalogEra === 'agoura'` — this is the cleanest mapping because `ampCatalogEra` was added to DeviceCapabilities precisely to encode the catalog selection decision.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ~5.x (via Next.js 16.1.6) | All edits are TypeScript | Already in use; no install needed |
| Vitest | ^4.0.18 | Test runner — `npx vitest run` | Already in use; 327 tests pass |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | No new packages needed | Pure refactor of existing TypeScript |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `caps.ampCatalogEra === 'agoura'` | Keep `STADIUM_AMPS[block.modelName]` | `STADIUM_AMPS` lookup is model-based not device-based — correct but slightly different semantic. `ampCatalogEra` is the intended device-capability encoding. Either works; `ampCatalogEra` is preferred. |
| Required `caps` parameter | Optional `caps?` with internal fallback | Optional creates a footgun where tests can accidentally omit caps and fall through to Helix defaults silently. Required parameter makes the contract explicit. |

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new files need to be created. All changes are within:

```
src/lib/helix/
├── device-family.ts     # ADD 3 new fields to DeviceCapabilities + update STOMP_XL_CAPABILITIES, etc.
├── chain-rules.ts       # REFACTOR: DeviceTarget → DeviceCapabilities, remove guard calls
├── param-engine.ts      # REFACTOR: DeviceTarget → DeviceCapabilities, remove guard calls
├── validate.ts          # REFACTOR: DeviceTarget → DeviceCapabilities, remove guard calls
├── models.ts            # REFACTOR: DeviceTarget → DeviceCapabilities in affected functions
└── types.ts             # REMOVE isPodGo/isStadium/isStomp if no remaining callers outside KLayer
```

The route.ts caller (`src/app/api/generate/route.ts`) must be updated to call `getCapabilities()` before passing to the Knowledge Layer functions.

### Pattern 1: Capability Field Access Replaces Boolean Guard

**What:** Instead of calling `isPodGo(device)` inside a shared module, the module receives `DeviceCapabilities` and reads `caps.family === 'podgo'` or a semantic field like `caps.dspCount === 1`.

**When to use:** Every current guard site in the four files.

**Example — current (chain-rules.ts line 167-171):**
```typescript
function getDspForSlot(slot: ChainSlot, device?: DeviceTarget): 0 | 1 {
  if (device && isPodGo(device)) return 0;
  if (device && isStadium(device)) return 0;
  if (device && isStomp(device)) return 0;
  // ...
}
```

**Example — after refactor:**
```typescript
function getDspForSlot(slot: ChainSlot, caps: DeviceCapabilities): 0 | 1 {
  if (caps.dspCount === 1) return 0;  // single-DSP devices: all blocks on dsp0
  // ...
}
```

### Pattern 2: New Capability Fields Replace Inline Magic Values

**What:** Instead of hardcoded limits like `userEffects.length = 4` inside `if (stadium)`, the cap field `caps.maxEffectsPerDsp` provides the value.

**When to use:** Effect count limits in chain-rules.ts.

**Example — current (chain-rules.ts lines 403-417):**
```typescript
if (stadium && userEffects.length > 4) {
  userEffects.length = 4;
}
if (stomp) {
  const stompMaxUserEffects = device === "helix_stomp_xl" ? 5 : 2;
  if (userEffects.length > stompMaxUserEffects) {
    userEffects.length = stompMaxUserEffects;
  }
}
```

**Example — after refactor (with `maxEffectsPerDsp` field on caps):**
```typescript
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
  userEffects.length = caps.maxEffectsPerDsp;
}
```

### Pattern 3: ampCatalogEra Replaces STADIUM_AMPS Model-Based Lookup for Device Checks

**What:** Distinguishing Stadium from HD2 amp catalog selection. `caps.ampCatalogEra === 'agoura'` is the correct device-capability check; `STADIUM_AMPS[block.modelName]` is a model-data check (stays in param-engine.ts where it guards per-model behavior, not device identity).

**When to use:** Amp catalog routing in chain-rules.ts assembleSignalChain and param-engine.ts resolveParameters.

**Example — current (chain-rules.ts line 269-271):**
```typescript
const stadium = device ? isStadium(device) : false;
let ampModel: HelixModel | undefined = stadium
  ? STADIUM_AMPS[intent.ampName]
  : AMP_MODELS[intent.ampName];
```

**Example — after refactor:**
```typescript
const isAgouraEra = caps.ampCatalogEra === 'agoura';
let ampModel: HelixModel | undefined = isAgouraEra
  ? STADIUM_AMPS[intent.ampName]
  : AMP_MODELS[intent.ampName];
```

**Note for param-engine.ts resolveAmpParams:** The guard `if (!stadiumModel)` at line 408 uses `STADIUM_AMPS[block.modelName]` to decide whether to apply HD2 category/topology layers. This is correctly model-based (checking if the specific block is a Stadium amp model), not device-based. This guard should remain as-is — it is answering "is this block from the Agoura catalog?" not "is this device a Stadium?" KLAYER-02 requires removing device guards, but `STADIUM_AMPS[block.modelName]` is not a device guard.

### Pattern 4: mandatory Block Types via Cap Field

**What:** `caps.mandatoryBlockTypes` replaces `if (!podGo && !stomp)` guards around the EQ and Gain Block insertion in chain-rules.ts.

**When to use:** Steps 5c and 5d of assembleSignalChain.

**Example — current (chain-rules.ts lines 465-488):**
```typescript
if (!podGo && !stomp) {
  // insert Parametric EQ
}
if (!podGo && !stomp) {
  // insert Gain Block
}
```

**Example — after refactor:**
```typescript
if (caps.mandatoryBlockTypes.includes('eq')) {
  const eqModel = caps.ampCatalogEra === 'agoura'
    ? STADIUM_EQ_MODELS[STADIUM_PARAMETRIC_EQ]!
    : EQ_MODELS[PARAMETRIC_EQ]!;
  // insert
}
if (caps.mandatoryBlockTypes.includes('volume')) {
  // insert Gain Block
}
```

### Anti-Patterns to Avoid

- **Keeping `device?: DeviceTarget` as a parameter alongside `caps`**: Creates an ambiguous API where callers can pass mismatched device/caps. Remove DeviceTarget from all KLayer function signatures — caps is the only parameter needed.
- **Resolving caps inside the KLayer function**: `getCapabilities(device)` should be called once in the caller (route.ts or tests), not inside chain-rules/param-engine/validate. The KLayer should be pure functions of caps, not of device strings.
- **Using `caps.family === 'stadium'` directly inside KLayer**: Prefer semantic fields like `caps.ampCatalogEra === 'agoura'` or `caps.dspCount === 1`. Direct family checks reintroduce device-family awareness into shared code — the point of the refactor is to eliminate that.
- **Partial migration leaving some guards in place**: Each file should be fully migrated. Leaving even one `isPodGo` call means KLAYER-04 is not satisfied.

---

## Exhaustive Guard Site Inventory

This section documents every guard site that must be replaced, organized by file.

### chain-rules.ts (637 lines)

| Line | Current Code | Replacement |
|------|-------------|-------------|
| 10 | `import { isPodGo, isStadium, isStomp, POD_GO_MAX_USER_EFFECTS } from "./types"` | Remove isPodGo/isStadium/isStomp imports; keep POD_GO_MAX_USER_EFFECTS or replace with caps field |
| 77 | `const stadium = device ? isStadium(device) : false;` in `resolveEffectModel` | `caps.ampCatalogEra === 'agoura'` |
| 89 | `...(stadium ? [[STADIUM_EQ_MODELS, "EQ_MODELS"] as [...]] : [])` | `...(caps.ampCatalogEra === 'agoura' ? [...] : [])` |
| 167 | `if (device && isPodGo(device)) return 0;` | `if (caps.dspCount === 1) return 0;` (collapses all 3 guards) |
| 169 | `if (device && isStadium(device)) return 0;` | (collapsed with line 167) |
| 171 | `if (device && isStomp(device)) return 0;` | (collapsed with line 167) |
| 260-262 | `const podGo/stadium/stomp = device ? isPodGo/isStadium/isStomp(device) : false` | Replace with `const isAgouraEra = caps.ampCatalogEra === 'agoura'` and `const isSingleDsp = caps.dspCount === 1` etc. |
| 269-271 | `stadium ? STADIUM_AMPS[intent.ampName] : AMP_MODELS[intent.ampName]` | `caps.ampCatalogEra === 'agoura'` |
| 358 | `!podGo && !stadium && !stomp` (dual-amp guard) | `caps.dualAmpSupported` |
| 399 | `if (podGo && userEffects.length > POD_GO_MAX_USER_EFFECTS)` | `if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp)` |
| 403-406 | `if (stadium && userEffects.length > 4)` | collapsed into caps.maxEffectsPerDsp |
| 409-417 | `if (stomp) { const stompMaxUserEffects = device === "helix_stomp_xl" ? 5 : 2; ... }` | collapsed into caps.maxEffectsPerDsp |
| 466-468 | `if (!podGo && !stomp) { const eqModel = stadium ? STADIUM_EQ_MODELS : EQ_MODELS ... }` | `if (caps.mandatoryBlockTypes.includes('eq'))` + `caps.ampCatalogEra === 'agoura'` for model selection |
| 478-488 | `if (!podGo && !stomp) { gainModel ... }` | `if (caps.mandatoryBlockTypes.includes('volume'))` |
| 551-606 | DSP block limit validation if/else chain (podGo/stadium/stomp/helix branches) | Replace with caps.maxBlocksTotal, caps.dspCount, caps.maxBlocksPerDsp |

**Function signature change:**
- `resolveEffectModel(name: string, device?: DeviceTarget)` → `resolveEffectModel(name: string, caps: DeviceCapabilities)`
- `getDspForSlot(slot: ChainSlot, device?: DeviceTarget)` → `getDspForSlot(slot: ChainSlot, caps: DeviceCapabilities)`
- `assembleSignalChain(intent: ToneIntent, device?: DeviceTarget)` → `assembleSignalChain(intent: ToneIntent, caps: DeviceCapabilities)`

### param-engine.ts (~594 lines)

| Line | Current Code | Replacement |
|------|-------------|-------------|
| 11 | `import { isStadium } from "./types"` | Remove |
| 276-282 | `const stadium = device ? isStadium(device) : false;` + `stadium ? STADIUM_AMPS : AMP_MODELS` | `caps.ampCatalogEra === 'agoura'` |
| 339 | `resolveBlockParams(block, ..., device, ...)` — passes device through | Pass `caps` instead |
| 352-358 | `function resolveBlockParams(..., device?: DeviceTarget, ...)` | `caps: DeviceCapabilities` |
| 365 | `return resolveCabParams(ampCategory, device)` | `return resolveCabParams(ampCategory, caps)` |
| 399 | `const stadiumModel = STADIUM_AMPS[block.modelName]` in resolveAmpParams | **KEEP AS-IS** — this is model-based, not device-based (see Pattern 3 note above) |
| 461 | `if (device && isStadium(device))` in resolveCabParams | `if (caps.ampCatalogEra === 'agoura')` |

**Function signature changes:**
- `resolveParameters(chain, intent, device?: DeviceTarget)` → `resolveParameters(chain, intent, caps: DeviceCapabilities)`
- `resolveBlockParams(..., device?: DeviceTarget, ...)` → `resolveBlockParams(..., caps: DeviceCapabilities, ...)`
- `resolveCabParams(ampCategory, device?: DeviceTarget)` → `resolveCabParams(ampCategory, caps: DeviceCapabilities)`

### validate.ts (414 lines)

| Line | Current Code | Replacement |
|------|-------------|-------------|
| 3 | `import { isPodGo, isStadium, isStomp } from "./types"` | Remove |
| 71-73 | `const podGo/stadium/stomp = device ? isPodGo/isStadium/isStomp(device) : false` | Derive from caps fields |
| 74 | `const validIds = podGo ? VALID_IDS_WITH_SUFFIXES : VALID_IDS` | `const validIds = caps.fileFormat === 'pgp' ? VALID_IDS_WITH_SUFFIXES : VALID_IDS` |
| 134 | `if (block.type === "amp" && STADIUM_AMPS[block.modelName])` | **KEEP AS-IS** — model-based check |
| 146-203 | DSP block limit if/else chain (podGo/stadium/stomp/helix branches) | Replace with caps fields |
| 160 | `if (totalBlocks > STADIUM_CONFIG.STADIUM_MAX_BLOCKS_PER_PATH)` | `if (totalBlocks > caps.maxBlocksTotal)` |
| 180 | `const maxBlocks = device === "helix_stomp_xl" ? STOMP_XL_MAX_BLOCKS : STOMP_MAX_BLOCKS` | `caps.maxBlocksTotal` (already correct per device in getCapabilities) |
| 187 | `const maxSnapshots = device === "helix_stomp_xl" ? ...` | `caps.maxSnapshots` |
| 332 | `if (block.type === "amp" && STADIUM_AMPS[block.modelName])` | **KEEP AS-IS** — model-based |

**Key insight for validate.ts:** The Stomp XL sub-device divergence (`device === "helix_stomp_xl"`) already has its solution in Phase 61. `STOMP_CAPABILITIES.maxBlocksTotal = STOMP_CONFIG.STOMP_MAX_BLOCKS` (6) and `STOMP_XL_CAPABILITIES.maxBlocksTotal = STOMP_CONFIG.STOMP_XL_MAX_BLOCKS` (12). So `caps.maxBlocksTotal` correctly resolves to the right value for each device with no sub-device check needed.

**Function signature change:**
- `validatePresetSpec(spec: PresetSpec, device?: DeviceTarget)` → `validatePresetSpec(spec: PresetSpec, caps: DeviceCapabilities)`

### models.ts Guard Sites

| Line | Function | Current Code | Replacement |
|------|----------|-------------|-------------|
| 1627 | `getModelListForPrompt` | `if (device && isStadium(device))` | `if (caps.ampCatalogEra === 'agoura')` |
| 1655 | `getModelListForPrompt` | `if (device && isPodGo(device) && POD_GO_EXCLUDED_MODELS.has(name))` | `if (caps.fileFormat === 'pgp' && POD_GO_EXCLUDED_MODELS.has(name))` |
| 1732 | `getModelIdForDevice` | `if (!isPodGo(device)) return model.id` | `if (caps.fileFormat !== 'pgp') return model.id` |
| 1757 | `getBlockTypeForDevice` | `if (!isPodGo(device))` | `if (caps.fileFormat !== 'pgp')` |
| 1807 | `isModelAvailableForDevice` | `if (isStadium(device))` | `if (caps.ampCatalogEra === 'agoura')` |
| 1826 | `isModelAvailableForDevice` | `if (!isPodGo(device)) return true` | `if (caps.fileFormat !== 'pgp') return true` |

**Function signature changes:**
- `getModelListForPrompt(device?: DeviceTarget)` → `getModelListForPrompt(caps: DeviceCapabilities)` (or keep device optional for planner.ts compatibility — see Pitfall 2 below)
- `getModelIdForDevice(model, blockType, device: DeviceTarget)` → accept `caps: DeviceCapabilities`
- `getBlockTypeForDevice(blockType, modelId, device: DeviceTarget)` → accept `caps: DeviceCapabilities`
- `isModelAvailableForDevice(modelName, device: DeviceTarget)` → accept `caps: DeviceCapabilities`

---

## New DeviceCapabilities Fields — Values Per Device

The three new fields from the Locked Decisions, with actual values for each capability constant:

### `maxEffectsPerDsp: number`

| Capability Constant | Value | Reasoning |
|---------------------|-------|-----------|
| HELIX_CAPABILITIES | `Infinity` | Helix has 8 slots per DSP but no explicit user-effect cap in chain-rules |
| STOMP_CAPABILITIES | `2` | STOMP_CONFIG.STOMP_MAX_BLOCKS - mandatory blocks leaves 2 user effects |
| STOMP_XL_CAPABILITIES | `5` | Confirmed from chain-rules.ts line 413: `device === "helix_stomp_xl" ? 5 : 2` |
| POD_GO_CAPABILITIES | `4` | POD_GO_MAX_USER_EFFECTS = 4 (confirmed from types.ts) |
| STADIUM_CAPABILITIES | `4` | From chain-rules.ts line 404: `if (stadium && userEffects.length > 4)` |

Note: Using `Infinity` for Helix means `if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp)` skips the truncation for Helix. Alternatively, use a very large sentinel like `99` or omit the check entirely when a max is not needed. The planner should recommend `Infinity` for clean semantics.

### `mandatoryBlockTypes: ReadonlyArray<BlockType>`

| Capability Constant | Value |
|---------------------|-------|
| HELIX_CAPABILITIES | `['eq', 'volume'] as const` |
| STOMP_CAPABILITIES | `[] as const` |
| STOMP_XL_CAPABILITIES | `[] as const` |
| POD_GO_CAPABILITIES | `[] as const` |
| STADIUM_CAPABILITIES | `['eq', 'volume'] as const` — but uses STADIUM_EQ_MODELS, not EQ_MODELS; model selection driven by `ampCatalogEra` |

Note: Stadium does include the mandatory EQ and Gain Block, same as Helix. The cap field drives the whether-to-insert decision; the ampCatalogEra field drives the which-model-to-use decision.

### `modelSuffix: string | null`

| Capability Constant | Value |
|---------------------|-------|
| HELIX_CAPABILITIES | `null` |
| STOMP_CAPABILITIES | `null` |
| STOMP_XL_CAPABILITIES | `null` |
| POD_GO_CAPABILITIES | `null` | (suffix logic is per-block-type, not per-device; handled by `POD_GO_EFFECT_SUFFIX` in models.ts) |
| STADIUM_CAPABILITIES | `null` |

**Important finding:** After reviewing models.ts, `modelSuffix` as a simple string field on DeviceCapabilities does not cleanly encode Pod Go's suffix behavior — Pod Go uses `POD_GO_EFFECT_SUFFIX[blockType]` which returns different suffixes based on the effect category (Mono vs Stereo). The `modelSuffix: string | null` field as specified in the decision captures the intent but will not replace `POD_GO_EFFECT_SUFFIX` logic directly. The `fileFormat === 'pgp'` check identifies Pod Go devices cleanly enough for the routing decisions in models.ts. The planner should note this distinction.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Determine if device is single-DSP | `isPodGo(d) || isStadium(d) || isStomp(d)` | `caps.dspCount === 1` | Already encoded in Phase 61 DeviceCapabilities |
| Determine block limit for device | `device === "helix_stomp_xl" ? 12 : 6` | `caps.maxBlocksTotal` | Already correct per Phase 61 STOMP_XL_CAPABILITIES vs STOMP_CAPABILITIES |
| Determine amp catalog | `isStadium(device)` | `caps.ampCatalogEra === 'agoura'` | Semantic field over identity check; handles future Agoura-era non-Stadium devices |
| Determine snapshot limit | `STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS` or `STOMP_XL_MAX_SNAPSHOTS` | `caps.maxSnapshots` | Already on DeviceCapabilities |
| Determine model ID suffix | Complex if/else | `POD_GO_EFFECT_SUFFIX[blockType]` (keep as-is, guarded by `caps.fileFormat === 'pgp'`) | Per-type suffix mapping is inherently block-type-dependent |

**Key insight:** Phase 61 already encoded the majority of device-specific values into DeviceCapabilities. Phase 64 is primarily about making the Knowledge Layer consume that already-correct data.

---

## Common Pitfalls

### Pitfall 1: Making `caps` Optional With Internal Fallback

**What goes wrong:** Defining `assembleSignalChain(intent, caps?: DeviceCapabilities)` with internal fallback like `caps = caps ?? HELIX_CAPABILITIES` silently makes Helix the default. Tests that omit `caps` would pass, but they wouldn't actually test device-specific behavior.

**Why it happens:** Desire to maintain backwards compatibility with call sites that currently call `assembleSignalChain(intent)` without a device.

**How to avoid:** Make `caps` required. Update all call sites (route.ts, all test files) to pass caps explicitly. There are a small number of call sites — this is not a large change.

**Warning signs:** Tests still pass when you comment out the `caps` argument.

### Pitfall 2: Breaking models.ts Public API

**What goes wrong:** `getModelListForPrompt(caps)`, `getModelIdForDevice(model, blockType, caps)`, and `isModelAvailableForDevice(modelName, caps)` are public exports used by `planner.ts` and `rig-mapping.ts`. Changing their signatures without updating those callers breaks compilation.

**Why it happens:** Treating models.ts as purely an internal Knowledge Layer module.

**How to avoid:** After updating models.ts signatures, grep all callers. Confirmed callers:
- `planner.ts` calls `getModelListForPrompt(device)` at line 198
- `rig-mapping.ts` calls `getModelIdForDevice` and `isModelAvailableForDevice`
- `podgo-builder.ts` calls `getModelIdForDevice`

All of these callers hold a `DeviceTarget` today. They will need to call `getCapabilities(device)` before calling the updated models.ts functions. Confirm all callers are updated.

**Warning signs:** TypeScript compilation errors after models.ts changes.

### Pitfall 3: Incorrect `mandatoryBlockTypes` Values Cause Missing Blocks

**What goes wrong:** If `STADIUM_CAPABILITIES.mandatoryBlockTypes` is set to `[]` (incorrectly), Stadium presets will stop inserting the 7-band Parametric EQ and Gain Block, causing regressions in Stadium test coverage.

**Why it happens:** Stadium's mandatory blocks are easy to miss because Stadium was added in Phase 33-35 and the mandatory block logic specifically excluded Pod Go and Stomp but included Stadium.

**How to avoid:** From chain-rules.ts lines 465-488: only `!podGo && !stomp` gates the EQ and Gain Block insertion. Stadium (neither podGo nor stomp) DOES receive mandatory EQ and Gain Block. Therefore `STADIUM_CAPABILITIES.mandatoryBlockTypes` must be `['eq', 'volume']`.

**Warning signs:** Stadium generate-baseline tests produce presets without Parametric EQ or Gain Block blocks.

### Pitfall 4: `resolveEffectModel` Receives `caps` But May Be Called Without Device Context

**What goes wrong:** `resolveEffectModel` is currently an internal function. When signature changes to accept `caps`, it must be called with the correct caps throughout `assembleSignalChain`. If any call path omits caps (e.g., during fallback amp lookup), Stadium-specific catalog won't be searched.

**Why it happens:** The function is called in the effects loop at line 386 and could be called in other internal contexts.

**How to avoid:** Trace all call sites of `resolveEffectModel` within chain-rules.ts and ensure caps is always threaded through.

### Pitfall 5: STADIUM_AMPS Model-Based Lookups Must Not Be Converted to Device Checks

**What goes wrong:** Lines 399, 134, 332 in param-engine.ts and validate.ts use `STADIUM_AMPS[block.modelName]` to check whether a specific block is a Stadium amp model. If these are converted to `caps.ampCatalogEra === 'agoura'`, non-amp blocks (cabs, effects) would also be incorrectly treated as Stadium amps.

**Why it happens:** These look like device guards but are actually model-catalog guards. They answer "is this specific block an Agoura amp?" not "is this device a Stadium?"

**How to avoid:** Leave `STADIUM_AMPS[block.modelName]` in resolveAmpParams (param-engine.ts line 399), validatePresetSpec parameter range check (validate.ts line 134), and validateAndFixPresetSpec clamping (validate.ts line 332). Document in STATE.md per KLAYER-04 success criterion 4.

**Warning signs:** Stadium amp blocks have incorrect parameters, or non-amp blocks get exempt from the 0-1 range check.

### Pitfall 6: Stomp XL Snapshot Limit Requires Correct `maxSnapshots` on STOMP_XL_CAPABILITIES

**What goes wrong:** validate.ts currently checks `device === "helix_stomp_xl" ? STOMP_XL_MAX_SNAPSHOTS : STOMP_MAX_SNAPSHOTS`. After refactor, this becomes `caps.maxSnapshots`. This only works if `STOMP_XL_CAPABILITIES.maxSnapshots` is set to `STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS` (which it already is in device-family.ts line 132).

**Why it happens:** Confusion about which constant applies.

**How to avoid:** Verify `STOMP_XL_CAPABILITIES.maxSnapshots === STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS` before completing validate.ts refactor.

---

## Caller Update Required: route.ts

The generate pipeline route at `src/app/api/generate/route.ts` currently passes `deviceTarget` (a `DeviceTarget` string) to all Knowledge Layer functions. After Phase 64, these calls must change.

**Current (route.ts lines 93-110):**
```typescript
const chain = assembleSignalChain(toneIntent, deviceTarget);
const parameterized = resolveParameters(chain, toneIntent, deviceTarget);
// ...
validatePresetSpec(presetSpec, deviceTarget);
```

**After Phase 64:**
```typescript
const caps = getCapabilities(deviceTarget);  // resolve once
const chain = assembleSignalChain(toneIntent, caps);
const parameterized = resolveParameters(chain, toneIntent, caps);
// ...
validatePresetSpec(presetSpec, caps);
```

Note: `resolveFamily` is already called at line 50 — caps can be resolved at the same time, before the planner call. `getCapabilities(deviceTarget)` is a pure, synchronous, trivially cheap function.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run src/lib/helix/chain-rules.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KLAYER-01 | chain-rules.ts guard sites removed, caps-driven | unit | `npx vitest run src/lib/helix/chain-rules.test.ts` | Yes — chain-rules.test.ts |
| KLAYER-02 | param-engine.ts guards removed, caps-driven | unit | `npx vitest run src/lib/helix/param-engine.test.ts` | Yes — param-engine.test.ts |
| KLAYER-03 | validate.ts guards removed, caps-driven | unit | `npx vitest run` (validate.ts tests in generate-baseline) | Partial — no validate.test.ts |
| KLAYER-04 | 6-device generate-baseline passes, guard strings absent | integration | `npx vitest run scripts/generate-baseline.test.ts` | Yes — generate-baseline.test.ts |

### Additional Tests Needed (Wave 0 Gaps)

KLAYER-04 success criterion 1 requires that "isPodGo", "isStadium", "isStomp" strings no longer appear in chain-rules.ts, param-engine.ts, validate.ts, models.ts. This is a code-content check, not a runtime test. It can be verified with a grep in CI or as a manual verification step. No new test file is needed for this criterion.

KLAYER-03 has no standalone validate.test.ts file. The validate.ts changes are covered by:
1. `generate-baseline.test.ts` Test 4: `validatePresetSpec` does not throw for all 36 presets
2. Existing chain-rules/param-engine tests which call validatePresetSpec implicitly

New tests that would strengthen KLAYER-03 coverage (optional, not blocking):
- Direct validate.test.ts covering DSP limit enforcement per device family
- Snapshot limit enforcement per device family

The planner should weigh whether adding validate.test.ts is worth the effort vs. relying on generate-baseline.test.ts coverage.

### Sampling Rate

- **Per file refactored:** `npx vitest run` — run full 327-test suite after each file
- **Per wave merge:** `npx vitest run` — full suite
- **Phase gate:** Full suite green (327+ tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/lib/helix/device-family.ts` — add 3 new fields before any refactoring begins (these are prerequisites, not Wave 0 test files)
- No missing test framework config — vitest already installed and configured

---

## Open Questions

1. **`maxEffectsPerDsp` type for Helix (unlimited)**
   - What we know: Helix has no explicit user-effect cap in the current code — the DSP block limit check (8 non-cab blocks per DSP) is the actual constraint
   - What's unclear: Should `maxEffectsPerDsp` be `number | typeof Infinity`, `number` with a sentinel like `99`, or restructured so Helix simply omits the truncation path?
   - Recommendation: Use `Infinity` (valid TypeScript `number`). The check `if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp)` cleanly skips Helix.

2. **`modelSuffix` field utility**
   - What we know: Pod Go suffix logic is per-block-type (`POD_GO_EFFECT_SUFFIX[blockType]`), not per-device
   - What's unclear: The locked decision adds `modelSuffix: string | null` but this field may have limited utility given the per-type nature of the suffix mapping
   - Recommendation: Add the field as specified (Pod Go: `null`, others: `null` — the actual suffix routing stays in `POD_GO_EFFECT_SUFFIX`). The `fileFormat === 'pgp'` check is sufficient for routing decisions in models.ts. Document this limitation in the plan.

3. **Whether to remove isPodGo/isStadium/isStomp from types.ts**
   - What we know: These functions are used in `planner.ts` (isStadium, isPodGo, isStomp at line 8) and `route.ts` (isPodGo, isStadium, isStomp at lines 16-18)
   - What's unclear: After Phase 64, will route.ts still need these for non-KLayer decisions (e.g., selecting builder: `if (isStomp(deviceTarget))` at line 113)?
   - Recommendation: Keep isPodGo/isStadium/isStomp in types.ts until their callers outside the KLayer are assessed. Route.ts uses them for builder routing (not KLayer calls). They are not part of the KLayer scope. The CONTEXT.md decision is: remove if zero remaining callers — so check callers after refactoring and remove if eligible.

---

## Code Examples

Verified from source code inspection (HIGH confidence):

### Current DeviceCapabilities Interface (device-family.ts lines 21-48)
```typescript
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
```

### Proposed DeviceCapabilities Extension (add to device-family.ts)
```typescript
export interface DeviceCapabilities {
  // ... existing 13 fields ...

  /** Max user-assignable effect blocks. Use Infinity for devices with no explicit cap (Helix). */
  maxEffectsPerDsp: number;

  /** Block types auto-inserted as mandatory blocks during chain assembly.
   * Helix and Stadium: ['eq', 'volume'] (Parametric EQ + Gain Block)
   * Pod Go, Stomp: [] (block budget too tight for mandatory inserts) */
  mandatoryBlockTypes: ReadonlyArray<"eq" | "volume">;

  /** Model ID suffix for this device (reserved for future use — currently null for all devices).
   * Pod Go suffix routing is per-block-type, handled by POD_GO_EFFECT_SUFFIX in models.ts. */
  modelSuffix: string | null;
}
```

### HELIX_CAPABILITIES with new fields
```typescript
const HELIX_CAPABILITIES: DeviceCapabilities = {
  // ... existing fields ...
  maxEffectsPerDsp: Infinity,
  mandatoryBlockTypes: ['eq', 'volume'] as const,
  modelSuffix: null,
} as const;
```

### STOMP_CAPABILITIES with new fields
```typescript
const STOMP_CAPABILITIES: DeviceCapabilities = {
  // ... existing fields ...
  maxEffectsPerDsp: 2,
  mandatoryBlockTypes: [] as const,
  modelSuffix: null,
} as const;
```

### STADIUM_CAPABILITIES with new fields
```typescript
const STADIUM_CAPABILITIES: DeviceCapabilities = {
  // ... existing fields ...
  maxEffectsPerDsp: 4,
  mandatoryBlockTypes: ['eq', 'volume'] as const,
  modelSuffix: null,
} as const;
```

### Chain-Rules getDspForSlot Before/After
```typescript
// BEFORE
function getDspForSlot(slot: ChainSlot, device?: DeviceTarget): 0 | 1 {
  if (device && isPodGo(device)) return 0;
  if (device && isStadium(device)) return 0;
  if (device && isStomp(device)) return 0;
  switch (slot) { /* ... */ }
}

// AFTER
function getDspForSlot(slot: ChainSlot, caps: DeviceCapabilities): 0 | 1 {
  if (caps.dspCount === 1) return 0;  // single-DSP devices: all on dsp0
  switch (slot) { /* ... */ }
}
```

### Validate.ts validatePresetSpec DSP Check Before/After
```typescript
// BEFORE
export function validatePresetSpec(spec: PresetSpec, device?: DeviceTarget): void {
  const podGo = device ? isPodGo(device) : false;
  const stadium = device ? isStadium(device) : false;
  const stomp = device ? isStomp(device) : false;
  // ...
  } else if (stomp) {
    const maxBlocks = device === "helix_stomp_xl"
      ? STOMP_CONFIG.STOMP_XL_MAX_BLOCKS
      : STOMP_CONFIG.STOMP_MAX_BLOCKS;
  }
}

// AFTER
export function validatePresetSpec(spec: PresetSpec, caps: DeviceCapabilities): void {
  // ...
  if (caps.dspCount === 1) {
    const nonDsp0 = spec.signalChain.filter(b => b.dsp !== 0);
    if (nonDsp0.length > 0) {
      throw new Error(`${caps.family} preset has blocks on dsp1 — all blocks must be on dsp0`);
    }
    const totalBlocks = spec.signalChain.length;
    if (totalBlocks > caps.maxBlocksTotal) {
      throw new Error(`${caps.family} exceeds ${caps.maxBlocksTotal}-block limit (${totalBlocks} blocks)`);
    }
    if (spec.snapshots.length > caps.maxSnapshots) {
      throw new Error(`${caps.family} supports at most ${caps.maxSnapshots} snapshots`);
    }
  } else {
    // Helix: dual DSP, max 8 non-cab blocks per DSP
    // ...
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Phase | Impact |
|--------------|------------------|-------|--------|
| No DeviceCapabilities — all device checks inline | Phase 61 added DeviceCapabilities with 13 fields | Phase 61 | Foundation for Phase 64; caps already has dspCount, maxBlocksTotal, maxSnapshots, ampCatalogEra, dualAmpSupported |
| KLayer functions received DeviceTarget string | Phase 64 changes them to receive DeviceCapabilities | Phase 64 | Adding a device requires no KLayer changes |

**Deprecated after Phase 64:**
- `isPodGo(device)`, `isStadium(device)`, `isStomp(device)` imports inside chain-rules.ts, param-engine.ts, validate.ts, models.ts — replaced by caps field access

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection: `src/lib/helix/chain-rules.ts` — all guard sites enumerated line by line
- Direct code inspection: `src/lib/helix/param-engine.ts` — all guard sites enumerated
- Direct code inspection: `src/lib/helix/validate.ts` — all guard sites enumerated
- Direct code inspection: `src/lib/helix/models.ts` lines 1627-1828 — all guard sites enumerated
- Direct code inspection: `src/lib/helix/device-family.ts` — confirmed existing 13 fields and per-device capability constant values
- Direct code inspection: `src/lib/helix/types.ts` — confirmed isPodGo/isStadium/isStomp implementations and POD_GO_MAX_USER_EFFECTS
- Direct code inspection: `src/app/api/generate/route.ts` — confirmed caller pattern and where caps should be resolved
- Direct code inspection: `scripts/generate-baseline.test.ts` — confirmed 6-device test coverage (327 tests currently passing)
- Direct code inspection: `.planning/phases/64-knowledge-layer-guard-removal/64-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)

- Test run output: `npx vitest run` returned 327 passed tests on 2026-03-06 — baseline confirmed

---

## Metadata

**Confidence breakdown:**
- Guard site inventory: HIGH — read every relevant line of all 4 files directly
- New field values: HIGH — derived from existing code (STOMP_MAX_BLOCKS, POD_GO_MAX_USER_EFFECTS, etc.)
- Caller impact: HIGH — traced all callers of public models.ts functions
- Test coverage: HIGH — test infrastructure confirmed, 327 tests verified

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable codebase, no external dependencies involved)
