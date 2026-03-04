# Requirements: HelixAI v3.0 Helix Stadium Support

**Milestone:** v3.0
**Scope:** Add Helix Stadium as a supported preset generation target; fix Helix Floor device ID regression
**Date:** 2026-03-04

---

## Functional Requirements

### STAD-01: Helix Stadium Preset File Format

The app must generate `.hsp` preset files for Helix Stadium. The `.hsp` format is distinct from `.hlx` (Helix LT/Floor) and `.pgp` (Pod Go). The exact internal structure must be determined by inspecting a real `.hsp` file before any builder code is written. The format is believed to be JSON (community file size: 15-47 KB) but must be confirmed by opening a real file. If msgpack encoding is confirmed, add `@msgpack/msgpack`.

**Acceptance:** A generated `.hsp` file imports successfully into the Helix Stadium app without errors.

---

### STAD-02: Stadium Device ID

The `DEVICE_IDS.helix_stadium` constant must be set to the integer read from a real `.hsp` file's `data.device` field. Never guess this value. Include a source comment citing the real file inspection.

**Acceptance:** Preset with `device: "helix_stadium"` loads on Helix Stadium hardware without `-8309 Incompatible target device type`. Test asserts both the constant reference and the same literal integer.

---

### STAD-03: Stadium Model Catalog

Add a Stadium-specific model catalog covering:
- Agoura amp models (`Agoura_*` prefix) — ~50 channels as of FW 1.2.1
- Legacy HX effects available on Stadium (verify prefix — may be `HX2_*` not `HD2_*`)
- Stadium 7-band Parametric EQ (Stadium-exclusive replacement EQ)
- Exclusions: Simple EQ, Low/High Cut EQ, Low/High Shelf EQ, Parametric 5-band — NOT present in Stadium

Agoura models must not appear in Helix LT/Floor/Pod Go planner prompts.

**Acceptance:** Generated Stadium presets reference only Stadium-available model IDs. At least one amp uses `Agoura_*` prefix. LT/Floor planner catalog contains no `Agoura_*` entries.

---

### STAD-04: Stadium Chain Rules

Signal chain assembly must support Helix Stadium:
- 4 stereo paths (Path 1A, 1B, 2A, 2B) — verify DSP key names from `.hsp` inspection
- 12 blocks per path maximum (vs 8/DSP for Helix LT/Floor)
- 8 snapshots per preset (verify from `.hsp`)
- Mandatory blocks use Stadium-compatible model IDs (verified EQ, correct boost/gate names)
- Start with conservative 8-block limit; increase after hardware testing confirms DSP headroom

v3.0 targets single-path generation (Path 1A only). Multi-path is out of scope.

**Acceptance:** `assembleSignalChain(intent, "helix_stadium")` returns valid chain with Stadium model IDs. `chain-rules.ts` uses `STADIUM_MAX_BLOCKS_PER_PATH` constant — not `MAX_BLOCKS_PER_DSP`.

---

### STAD-05: Stadium Builder

Create `stadium-builder.ts` following the `podgo-builder.ts` pattern:
- Accepts `PresetSpec` (device-agnostic intermediate — no change to existing types)
- Builds `.hsp` JSON/binary structure using constants from real `.hsp` inspection
- Exports `buildHspFile(spec: PresetSpec): HspFile` and `summarizeStadiumPreset()`
- Exported from `index.ts`

`preset-builder.ts` and `podgo-builder.ts` must not be modified.

**Acceptance:** `buildHspFile()` produces a file loadable in the Helix Stadium app. Test verifies `data.device === DEVICE_IDS.helix_stadium` and the same literal integer.

---

### STAD-06: Generate API Route

`/api/generate` must:
- Accept `device: "helix_stadium"` and set `deviceTarget = "helix_stadium"`
- Call `buildHspFile()` for Stadium requests
- Return `fileExtension: ".hsp"` in response
- Use `latest.hsp` as Supabase storage filename for Stadium presets

**Acceptance:** POST `/api/generate` with `{ device: "helix_stadium" }` returns valid `.hsp` payload. Storage key uses `.hsp` extension.

---

### STAD-07: Device Selector UI

Add Stadium to `page.tsx` device selector:
- Both device arrays updated with `{ id: "helix_stadium", label: "STADIUM", desc: "Helix Stadium" }`
- `selectedDevice` state type extended
- `downloadPreset()` uses `"_Stadium"` suffix and `.hsp` extension
- Device badge shows `"STADIUM"`
- `downloadStoredPreset()` handles `.hsp` for Stadium
- "Generate for other device" toggle handles 4 devices correctly

Stadium only appears in UI after hardware validation confirms presets load.

**Acceptance:** User selects STADIUM, downloads `HelixAI_[Name]_Stadium.hsp`, imports into Helix Stadium app successfully.

---

### STAD-08: Rig Emulation for Stadium

Rig emulation (pedal photo + text) must support `device: "helix_stadium"`:
- `mapRigToSubstitutions(rigIntent, "helix_stadium")` does not throw
- `/api/map` accepts `"helix_stadium"` as valid device
- Substitution card shows Stadium-compatible model names

**Acceptance:** Pedal photo upload with Stadium selected produces substitution card with valid Stadium model names.

---

### FIX-01: Helix Floor Device ID Regression

Current state: `DEVICE_IDS.helix_floor = 2162692` (same as LT) but `orchestration.test.ts:93` expects `2162691`. This is a live regression — Floor users receive presets with wrong device ID.

Fix by:
1. Confirming correct Floor device ID from a real Helix Floor `.hlx` export OR from Phase 23 research (which concluded `2162691`)
2. Updating `DEVICE_IDS.helix_floor` in `types.ts` to confirmed value with source comment
3. Updating `orchestration.test.ts:93` literal to match

**Acceptance:** `DEVICE_IDS.helix_floor !== DEVICE_IDS.helix_lt`. Test at line 93 passes. Constant includes source comment.

---

## Non-Functional Requirements

### NFR-01: Tone Quality
Stadium presets must meet the same professional tone standard — mix-ready, dynamically responsive, signal-chain intelligent.

### NFR-02: No Regression
Helix LT, Helix Floor, Pod Go generation must work identically after Stadium code is added. Anonymous flow must not regress.

### NFR-03: Hardware Validation
Stadium presets verified on actual hardware (or Stadium app import) before Stadium appears in UI.

### NFR-04: TypeScript Exhaustiveness
Adding `"helix_stadium"` to `DeviceTarget` must surface all unhandled cases via compiler errors — these become the integration checklist.

---

## Out of Scope (v3.0)

- Multi-path/dual-amp Stadium presets — defer; single Path 1A only for launch
- HX Stomp — remains out of scope
- Conversation search or sidebar enhancements — already shipped in v2.0

---

## Dependencies

| Requirement | Depends On |
|------------|-----------|
| STAD-02 | Real `.hsp` file inspection |
| STAD-03 | Real `.hsp` or Stadium app model defs |
| STAD-04 | STAD-03 (Stadium EQ model name needed) |
| STAD-05 | STAD-02, STAD-03 |
| STAD-06 | STAD-05 |
| STAD-07 | STAD-06 |
| STAD-08 | STAD-07 |
| FIX-01 | Real Floor `.hlx` or Phase 23 confirmed value |

---

*v3.0 — Helix Stadium Support*
*Written: 2026-03-04*
