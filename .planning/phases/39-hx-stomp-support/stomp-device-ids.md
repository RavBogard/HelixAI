# HX Stomp & HX Stomp XL Device IDs & Format Research

**Source:** Two real `.hlx` files provided by user (2026-03-04):
- `Swell_Delay.hlx` — HX Stomp
- `The_Kids_Are_D.hlx` — HX Stomp XL
**Status:** CONFIRMED — all values read directly from hardware-exported files

---

## Device IDs

| Device | `data.device` | `data.device_version` |
|--------|--------------|----------------------|
| HX Stomp | **2162694** | 58720256 |
| HX Stomp XL | **2162699** | 58720256 |

Source comment for `types.ts`:
```typescript
helix_stomp: 2162694,    // Confirmed from Swell_Delay.hlx (HX Stomp hardware export, 2026-03-04)
helix_stomp_xl: 2162699, // Confirmed from The_Kids_Are_D.hlx (HX Stomp XL hardware export, 2026-03-04)
```

---

## File Format

**Both Stomp variants use standard `.hlx` JSON** — identical top-level structure to Helix LT/Floor:
```json
{
  "data": {
    "device": 2162694,
    "device_version": 58720256,
    "meta": { "application": "HX Edit", "appversion": ..., "name": "..." },
    "tone": { "dsp0": {...}, "dsp1": {}, "global": {...}, "snapshot0-N": {...} }
  },
  "meta": { "original": 0, "pbn": 0, "premium": 0 },
  "schema": "L6Preset",
  "version": 6
}
```

**No magic header prefix** (unlike Stadium's `rpshnosj`). Pure JSON.

---

## Key Structural Differences vs Helix LT/Floor

### 1. I/O Block Model Prefix: `HelixStomp_*` (not `HD2_App*`)

| Block | HX Stomp model | LT/Floor equivalent |
|-------|----------------|---------------------|
| Input | `HelixStomp_AppDSPFlowInput` | `HD2_AppDSPFlowInput` (or similar) |
| Output main | `HelixStomp_AppDSPFlowOutputMain` | `HD2_AppDSPFlowOutputMain` |
| Output send | `HelixStomp_AppDSPFlowOutputSend` | `HD2_AppDSPFlowOutputSend` |
| Split | `HD2_AppDSPFlowSplitY` | `HD2_AppDSPFlowSplitY` (same) |
| Join | `HD2_AppDSPFlowJoin` | `HD2_AppDSPFlowJoin` (same) |

The Stomp uses `HelixStomp_` prefix for input/output nodes but shares `HD2_` for split/join.

### 2. Single DSP Only

Both Stomp variants have `dsp1: {}` (empty). Only `dsp0` is populated.

### 3. Snapshot Count Differs

| Device | Snapshots |
|--------|-----------|
| HX Stomp | 3 (snapshot0, snapshot1, snapshot2) |
| HX Stomp XL | 4 (snapshot0, snapshot1, snapshot2, snapshot3) |

### 4. Block Limits (hardware spec — not from file samples)

| Device | Max blocks | Footswitches |
|--------|-----------|--------------|
| HX Stomp | 6 | 3 |
| HX Stomp XL | 9 | 6 |

The sample presets only use 4 blocks; the builder should cap at the per-device hardware max.

### 5. Effect Models: Same `HD2_*` + `VIC_*` as LT/Floor

Confirmed from files:
- `HD2_GateHorizonGate`, `HD2_AmpUSSuperVib`, `HD2_DelaySwellAdriatic`, `HD2_AmpBrit2203`, `HD2_DelayDoubleDouble`, `HD2_CompressorLAStudioComp`
- `VIC_ReverbDynRoom` (same VIC prefix seen in Stadium too)
- Cabs: `HD2_CabMicIr_*` (same as LT/Floor)

No Stomp-exclusive effect prefix — the Stomp runs the full HX engine, just with fewer blocks.

---

## Constants for Phase 39

```typescript
// src/lib/helix/types.ts — add to DeviceTarget and DEVICE_IDS
helix_stomp: 2162694,    // Confirmed 2026-03-04
helix_stomp_xl: 2162699, // Confirmed 2026-03-04

// src/lib/helix/config.ts
STOMP_MAX_BLOCKS = 6           // HX Stomp hardware limit
STOMP_XL_MAX_BLOCKS = 9        // HX Stomp XL hardware limit
STOMP_MAX_SNAPSHOTS = 3        // HX Stomp
STOMP_XL_MAX_SNAPSHOTS = 4     // HX Stomp XL (confirmed from file)
STOMP_INPUT_MODEL = 'HelixStomp_AppDSPFlowInput'
STOMP_OUTPUT_MAIN_MODEL = 'HelixStomp_AppDSPFlowOutputMain'
STOMP_OUTPUT_SEND_MODEL = 'HelixStomp_AppDSPFlowOutputSend'
```

---

## Builder Strategy

Both Stomp variants can share a single `stomp-builder.ts` that:
1. Accepts `PresetSpec` + `deviceTarget: "helix_stomp" | "helix_stomp_xl"`
2. Uses the same `data.*` JSON structure as `preset-builder.ts` (LT/Floor)
3. Substitutes `HelixStomp_*` for I/O block models
4. Caps blocks at `STOMP_MAX_BLOCKS` (6) or `STOMP_XL_MAX_BLOCKS` (9)
5. Generates 3 snapshots (Stomp) or 4 snapshots (Stomp XL)
6. Sets `data.device` to the correct integer per device

**Does NOT need a separate builder per device** — parameterize by target, same output format.

---

## Relationship to Existing Code

- Same `buildHlxFile`-style output as LT/Floor — could potentially extend `preset-builder.ts`
  but safer to keep as standalone `stomp-builder.ts` for isolation
- No new file format (no `.hsp` equivalent) — output is `.hlx` with different device integer
- `DEVICE_IDS.helix_stomp` and `helix_stomp_xl` must be distinct from `helix_lt` and `helix_floor`

---

## Out of Scope for Phase 39 (v3.0)

- HX Stomp multi-path (Path B) — single path only for launch, same as Stadium v3.0
- Looper block — not relevant for tone presets
- External I/O block configuration — default output routing only

---

*Researched: 2026-03-04*
*Source files: Swell_Delay.hlx (HX Stomp), The_Kids_Are_D.hlx (HX Stomp XL)*
