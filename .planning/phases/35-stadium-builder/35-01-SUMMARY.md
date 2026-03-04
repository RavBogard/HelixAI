# Phase 35 Summary — Stadium Builder

**Phase:** 35
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-05: `stadium-builder.ts` produces valid `.hsp` files; `preset-builder.ts` and `podgo-builder.ts` unmodified

## Changes Made

### src/lib/helix/stadium-builder.ts (NEW FILE)

Created the Helix Stadium preset builder with full .hsp format support:

**Public API:**
- `buildHspFile(spec: PresetSpec): HspFile` — returns `{ magic, json, serialized }` where `serialized = "rpshnosj" + JSON.stringify(json)` — write `serialized` to disk as the `.hsp` file
- `summarizeStadiumPreset(spec: PresetSpec): string` — human-readable tone description

**Internal functions:**
- `buildStadiumMeta(spec)` — `{ color: "auto", device_id: 2490368, device_version: 301990022, info: "", name: ... }`
- `buildStadiumPreset(spec)` — `{ clip, cursor, flow, params, snapshots, sources, xyctrl }`
- `buildStadiumFlow(spec)` — `preset.flow` array (single-path v3.0): input block + b00..bNN non-cab blocks + cab0 + output block
- `buildStadiumSnapshots(spec)` — 8-slot array format; filled slots get `valid: true`, empty slots get `valid: false, expsw: -1`

**Key format details implemented:**
- Magic header: `rpshnosj` prepended (from `STADIUM_CONFIG.STADIUM_MAGIC_HEADER`)
- Block keys: `b00`, `b01`, ... (padded 2 digits) — not `block0`, `block1`
- I/O models: `P35_InputInst1`, `P35_OutputMatrix` (P35_ prefix, not P34_ or HD2_)
- `meta.device_id = 2490368` (from `DEVICE_IDS.helix_stadium`)
- `meta.device_version = 301990022` (from `STADIUM_CONFIG.STADIUM_DEVICE_VERSION`)
- Snapshots: array format (not keyed like .hlx) with `{ color, expsw, name, source, tempo, valid }`

### src/lib/helix/index.ts

Added exports:
```typescript
// Stadium builder (Phase 35)
export { buildHspFile, summarizeStadiumPreset } from "./stadium-builder";
export type { HspFile } from "./stadium-builder";
```

## Verification

- `npx vitest run`: 108/108 passing
- `npm run build`: Clean (TypeScript strict mode, Turbopack)
- `preset-builder.ts`: unmodified (git diff confirms)
- `podgo-builder.ts`: unmodified (git diff confirms)

## Design Decisions

- **`serialized` field on HspFile**: The generate route will write `serialized` to the response/storage — avoids the caller needing to know about the magic header
- **Single flow entry (v3.0)**: `preset.flow` is an array with one path object; multi-path deferred to future
- **8 snapshot slots always generated**: Matches the real .hsp format which always has exactly 8 entries; unfilled slots use `valid: false`
- **No snapshot block bypass state**: Real .hsp format inspection showed snapshots are simple metadata entries (name, tempo, valid) — block bypass state is tracked per-block in the flow, not in snapshots array. This differs from .hlx where snapshot.blockStates drive bypass.
