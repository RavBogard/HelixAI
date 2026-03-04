# Helix Stadium Device ID & .hsp Format Research

**Source:** Real `.hsp` file — `Stadium_Metal_Rhythm.hsp` downloaded from FluidSolo.com (2026-03-04)
**Status:** CONFIRMED — all values read directly from hardware-exported file

---

## Device ID

```
meta.device_id = 2490368
```

**Critical:** The field is named `device_id` (not `device`) and lives inside `meta` (not `data`).
This differs from `.hlx` format (`data.device`) and must be handled in the builder accordingly.

---

## File Format

### Magic Header
The file begins with an 8-byte ASCII prefix `rpshnosj` immediately followed by `{`:
```
rpshnosj{ "meta": { ... }, "preset": { ... } }
```
The builder **must prepend `rpshnosj`** when writing `.hsp` files. Without it the app will likely reject the file.

### Encoding
**Plain UTF-8 JSON** — confirmed. No msgpack, no binary encoding beyond the 8-byte prefix.
`@msgpack/msgpack` is NOT needed.

### Top-Level Structure
```json
{
  "meta": {
    "color": "auto",
    "device_id": 2490368,
    "device_version": 301990022,
    "info": "...",
    "name": "Preset Name"
  },
  "preset": {
    "clip": { ... },
    "cursor": { ... },
    "flow": [ /* array of path objects */ ],
    "params": {
      "activeexpsw": 1,
      "activesnapshot": 0,
      "inst1Z": "FirstEnabled",
      "inst2Z": "FirstEnabled",
      "tempo": 120.0
    },
    "snapshots": [ /* 8 entries */ ],
    "sources": { ... },
    "xyctrl": { ... }
  }
}
```

**Key difference from `.hlx`:** `.hlx` uses `{ "data": { ... } }`. Stadium uses `{ "meta": { ... }, "preset": { ... } }`.

---

## Path / Flow Structure

Paths are entries in `preset.flow[]` (an array). Each flow entry is an object where each key is a block ID (`b00`, `b01`, `b02`, etc.):

```json
"flow": [
  { /* Path 1A */ "b00": {...}, "b01": {...}, ... },
  { /* Path 1B */ "b00": {...}, ... }
]
```

Blocks have a `"path": <int>` field (0 or 1 in this preset) and `"position": <int>`.

---

## Confirmed Model Prefixes

| Prefix | Category | Example |
|--------|----------|---------|
| `Agoura_*` | New Stadium amps | `Agoura_AmpGermanXtraRed`, `Agoura_AmpBrit2203MV` |
| `HD2_*` | Legacy HX effects + cabs | `HD2_DistScream808Mono`, `HD2_CabMicIr_4x12UberV30WithPan` |
| `HX2_*` | HX2 dynamics/gates | `HX2_GateHorizonGateMono`, `HX2_GateNoiseGateStereo` |
| `P35_*` | Stadium I/O + routing | `P35_InputInst1`, `P35_AppDSPSplitY`, `P35_AppDSPJoin`, `P35_OutputMatrix` |
| `VIC_*` | New reverb models | `VIC_ReverbDynAmbienceStereo` |
| `HD2_CabMicIr_*` | Cabs (same as LT/Floor) | `HD2_CabMicIr_4x12UberV30WithPan` |

**I/O prefix is `P35_` NOT `P34_`** — Pod Go uses `P34_`; Stadium uses `P35_`.

---

## Snapshots

8 snapshot slots confirmed:
```json
"snapshots": [
  { "color": "auto", "expsw": 1, "name": "SNAPSHOT 1", "source": 0, "tempo": 120.0, "valid": true },
  { "expsw": -1, "name": "SNAPSHOT 2", "source": 0, "tempo": 120.0, "valid": false },
  /* ... slots 3-8, all valid: false */
]
```
Only slot 0 (SNAPSHOT 1) is `valid: true` in this single-snapshot preset.

---

## Key Constants for Phase 32+

```typescript
// src/lib/helix/types.ts
helix_stadium: 2490368  // Source: FluidSolo Stadium_Metal_Rhythm.hsp, meta.device_id, 2026-03-04

// src/lib/helix/config.ts
STADIUM_MAGIC_HEADER = 'rpshnosj'        // 8-byte prefix prepended to all .hsp files
STADIUM_MAX_BLOCKS_PER_PATH = 12         // confirmed by 12 block positions (b00-b13 minus routing)
STADIUM_MAX_SNAPSHOTS = 8                // confirmed by snapshots array length
STADIUM_MAX_PATHS = 4                    // spec: 1A, 1B, 2A, 2B (2 flows × 2 paths each)
```

---

## Builder Notes for Phase 35

1. **Output format:** `rpshnosj` + JSON.stringify(obj) — NOT a pure JSON file
2. **No `data` wrapper** — use `meta` + `preset` at top level
3. **Device ID field:** `meta.device_id` (integer `2490368`) — not `data.device`
4. **Path structure:** `preset.flow` is an array (not an object keyed by path name)
5. **I/O model prefix:** Use `P35_Input*`, `P35_Output*`, `P35_AppDSP*` — not `P34_`

---

*Researched: 2026-03-04*
*Source file: Stadium_Metal_Rhythm.hsp (FluidSolo.com)*
