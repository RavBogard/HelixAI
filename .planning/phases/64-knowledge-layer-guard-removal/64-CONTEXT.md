# Phase 64 Context: Knowledge Layer Guard Removal

## Decisions

### 1. Capability Field Gaps

**Decision:** Extend DeviceCapabilities to be the single source of truth for ALL device behavior.

New fields to add:
- `maxEffectsPerDsp: number` — effect block limits (Stomp=2-5, Stadium=4, Pod Go=4, Helix=unlimited)
- `mandatoryBlockTypes: ReadonlyArray<BlockType>` — block types auto-inserted during chain assembly (Helix: ['eq','gain'], Pod Go/Stomp: [])
- `modelSuffix: string | null` — model name suffix for catalog lookup (Pod Go: '_PodGo', others: null)

These replace the `isPodGo`/`isStadium`/`isStomp` checks that currently encode these behaviors as boolean device identity tests.

### 2. models.ts Guard Scope

**Decision:** Include models.ts guard sites in Phase 64 scope.

models.ts has 6 guard sites (isPodGo/isStadium) for model lookup, suffix handling, and model validation. Same refactoring pattern as the 3 named files. Total scope: chain-rules.ts + param-engine.ts + validate.ts + models.ts.

- `isPodGo()`, `isStadium()`, `isStomp()` helper functions in types.ts: remove if zero remaining callers after refactoring. If still used outside Knowledge Layer, keep.

### 3. STADIUM_AMPS Lookup Pattern

**Decision:** Implementation choice — Claude decides during planning.

Phase 63's `STADIUM_AMPS[block.modelName]` lookups are model-based, not device-based. They answer "does this amp model have firmware params?" — conceptually different from device identity checks. Options: leave as-is, replace with `caps.ampCatalogEra === 'agoura'`, or abstract to model metadata. Claude picks the cleanest approach.

### 4. Function Signature Strategy

**Decision:** Knowledge Layer functions accept `DeviceCapabilities` as a parameter.

- Functions receive the full `DeviceCapabilities` object (e.g., `assembleSignalChain(intent, caps)`)
- Callers resolve capabilities once via `getCapabilities(resolveFamily(device))` and pass through
- Required vs. optional, and whether resolution happens in caller or callee: implementation choice for Claude

## Code Context

### Guard site inventory (from codebase scout)

**chain-rules.ts (637 lines):**
- Line 77: `isStadium(device)` in resolveEffectModel — STADIUM_EQ_MODELS inclusion
- Lines 167-171: `isPodGo`/`isStadium`/`isStomp` in getDspForSlot — single DSP return
- Lines 260-262: `isPodGo`/`isStadium`/`isStomp` flags in assembleSignalChain
- Guards control: amp catalog selection, effect count limits, mandatory block skipping, DSP assignment, block limit validation, dual-amp exclusion

**param-engine.ts (~200 lines of guard-affected code):**
- Line 282: `isStadium(device)` in resolveParameters — amp catalog selection
- Line 399: `STADIUM_AMPS[block.modelName]` in resolveAmpParams (Phase 63 — model-based)
- Line 461: `isStadium(device)` in resolveCabParams — Stadium 10-param cab blocks

**validate.ts (414 lines):**
- Lines 71-73: `isPodGo`/`isStadium`/`isStomp` flags in validatePresetSpec
- Line 134: `STADIUM_AMPS[block.modelName]` — param range skip (Phase 63)
- Lines 146-203: Device-specific DSP block limit validation
- Line 332: `STADIUM_AMPS[block.modelName]` — value clamping skip (Phase 63)

**models.ts (6 guard sites):**
- Line 1627: `isStadium(device)` in findModel
- Line 1655: `isPodGo(device)` for POD_GO_EXCLUDED_MODELS
- Lines 1732, 1757: `isPodGo(device)` for suffix handling
- Line 1807: `isStadium(device)` for Stadium model lookup
- Line 1826: `isPodGo(device)` for model validation

### Existing DeviceCapabilities interface (device-family.ts)

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

### Requirements (from REQUIREMENTS.md)

- KLAYER-01: chain-rules.ts guard sites replaced with DeviceCapabilities-driven dispatch
- KLAYER-02: param-engine.ts device guards replaced with DeviceCapabilities-driven dispatch
- KLAYER-03: validate.ts device guards replaced with DeviceCapabilities-driven dispatch
- KLAYER-04: Adding a new device to an existing family requires changes only in the family module

## Deferred Ideas

(none captured)
