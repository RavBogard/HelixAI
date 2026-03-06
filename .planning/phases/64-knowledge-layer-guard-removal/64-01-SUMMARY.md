# 64-01 Execution Summary

## Plan: Refactor chain-rules.ts and models.ts to accept DeviceCapabilities

### What was done

**Task 1: Extend DeviceCapabilities** (commit `dea513a`)
- Added 3 new fields to `DeviceCapabilities` in `device-family.ts`:
  - `maxEffectsPerDsp: number` — per-DSP effect limit (chain-rules needs this)
  - `mandatoryBlockTypes: readonly string[]` — block types that must be present (e.g., "amp", "cab")
  - `modelSuffix: string | null` — Pod Go suffix ("_PG") or null
- Populated all 6 device capability objects with correct values

**Task 2: Refactor chain-rules.ts and models.ts** (commit `cc4f3e0`)
- `assembleSignalChain()`: signature changed from `device?: DeviceTarget` to `caps: DeviceCapabilities`
- Removed all `isPodGo()`, `isStadium()`, `isStomp()` calls from chain-rules.ts
- Guard replacements:
  - `isPodGo(device)` → `caps.fileFormat === "pgp"` or `caps.modelSuffix !== null`
  - `isStadium(device)` → `caps.ampCatalogEra === "agoura"`
  - `isStomp(device)` → `caps.dspCount === 1`
  - `!podGo && !stadium && !stomp` → `caps.dualAmpSupported`
- `models.ts`: `getModelIdForDevice()`, `getBlockTypeForDevice()`, `isModelAvailableForDevice()` all changed from `DeviceTarget` to `DeviceCapabilities`
- Fixed chain-rules.test.ts: corrected Python script artifacts (4 missing caps args, 5 spurious 3rd args)

### Test results
- 27/27 chain-rules tests pass
- Zero TypeScript errors

### Decisions
- `maxEffectsPerDsp` keeps chain-rules device-agnostic — it reads a number, not a device name
- `mandatoryBlockTypes` replaces hardcoded `["amp", "cab"]` checks
- `modelSuffix` replaces `isPodGo()` for suffix-related logic in models.ts
