# Feature Research

**Domain:** AI-powered Pod Go preset generation — v1.2 Pod Go Device Support
**Researched:** 2026-03-02
**Confidence:** HIGH (18 real .pgp preset files inspected directly; compared against 12 real .hlx Helix files; Line 6 community forums and official product pages verified; all file format findings are empirical from actual device files)

---

## Context: What Already Exists vs. What This Milestone Adds

The existing HelixAI codebase generates `.hlx` preset files for Helix LT and Helix Floor. The generation pipeline is:

```
Chat interview → ToneIntent (AI) → chain-rules.ts → param-engine.ts → snapshot-engine.ts → preset-builder.ts → .hlx file
```

This milestone adds Pod Go as a third device target. The AI interview and ToneIntent remain unchanged. The Knowledge Layer needs Pod Go-aware variants that emit `.pgp` files instead of `.hlx` files.

---

## Pod Go Hardware Capabilities: What It Can and Cannot Do

This section is the foundation for all feature decisions. Sourced from direct inspection of 18 real `.pgp` files and Line 6 community documentation.

### Block Architecture

**Total blocks: exactly 10 (block0 through block9).** Every Pod Go preset has exactly 10 blocks — confirmed across all 18 inspected presets.

**Fixed blocks (always present, always at specific types, user can move order):**
| Role | Typical position | @type |
|------|-----------------|-------|
| Volume/Wah expression (one of each) | block0–block1 | 0 |
| FX Loop send/return | varies | 5 |
| Amp | varies | 1 |
| Cab or IR | immediately after amp | 0 (CabMicIr) or 2 (simple cab) |
| EQ | varies | 0 or 6 |

**Flexible blocks (4 slots for any effects):** Users fill these with distortion, delay, reverb, modulation, compression, pitch, wah, gate, etc. from the Pod Go model library.

**Result:** In practice, a Pod Go preset has: 1 wah + 1 volume + 1 amp + 1 cab/IR + 1 EQ + 1 FX loop = 6 fixed-role blocks + 4 user-chosen effects = 10 total blocks.

**DSP constraint:** Not all 4 flexible slots can be filled with heavy effects simultaneously. Ganymede/Searchlight reverbs (~33% DSP each) or Benzin amp (~33%) leave little room. DSP is consumed at runtime — Pod Go Edit shows a DSP usage bar. The app cannot predict this statically without a DSP cost table.

### Routing

**Series only. No parallel paths.** Pod Go has a single signal path. There is no `@topology` field in the `.pgp` global section (Helix has `@topology0` / `@topology1`). `dsp1` is always `{}` (empty).

**Mono/stereo signal collapse behavior:** Distortion, Dynamics, and Pitch/Synth blocks are all mono. Placing a distortion block after a stereo delay/reverb collapses the signal to mono at that point.

**Pod Go vs Helix routing summary:**
| Capability | Pod Go | Helix LT/Floor |
|-----------|--------|----------------|
| Signal paths | 1 (series) | Up to 4 (series + parallel) |
| DSP chips | 1 | 2 (dual DSP) |
| Parallel routing | No | Yes (split + join) |
| Max blocks | 10 | 32+ (up to 8 per DSP × 2 DSPs + paths) |

### Snapshots

**Pod Go: exactly 4 snapshots (snapshot0–snapshot3).** Helix has 8 (snapshot0–snapshot7).

Snapshot structure is **identical to Helix** at the JSON schema level:
- `@name`, `@valid`, `@ledcolor`, `@tempo`, `@pedalstate` — same fields
- `blocks.dsp0.blockN: true/false` — same format (block on/off)
- `controllers.dsp0.blockN.paramName.@value` — same format (parameter values per snapshot)

**What snapshots control:**
- Block bypass state (on/off) for all 10 blocks
- Parameter values for any controller-assigned parameters (up to 64 per preset)
- Tempo (if set to "Per Snapshot" in global settings)

**What snapshots cannot control:**
- Amp model (cannot switch between different amp models across snapshots)
- Cab model (cannot switch cabs, though can switch IRs)
- Block count/positions (chain is fixed per preset)

### Footswitch / Stomp Mode

**6 built-in footswitches (FS1–FS6), expandable to 8 with external TRS switches (FS7–FS8).**

In Stomp mode: up to 6 built-in stomps assignable to blocks. Each block's footswitch is tracked in the `footswitch` section of the `.pgp` file:

```json
"footswitch": {
  "dsp0": {
    "block3": {
      "@fs_index": 5,
      "@fs_primary": true,
      "@fs_enabled": true,
      "@fs_ledcolor": 525824,
      "@fs_momentary": false,
      "@fs_label": "Compulsive Drive"
    }
  }
}
```

**Key difference from Helix:** Pod Go footswitch metadata lives in the `footswitch` section AND in the `controller` section (as `@fs_*` fields on controller assignments). Helix footswitch section is often empty — footswitch assignments are done differently in Helix via the controller section with `@fs_enabled`. Pod Go unifies footswitch metadata into both sections.

**`@fs_index` values 0–5** correspond to physical footswitch positions A, B, C, D, Up, Down. `@fs_index: 9` = not assigned to a switch.

### Model Library

**86 amp models, 206+ effect models** (as of firmware 2.50, January 2025). Roughly a subset of the Helix library, but not a strict subset — a few models are Pod Go-only.

**Critical insight from file inspection: Pod Go effect model IDs append `Mono` or `Stereo` suffix; Helix model IDs do not.**

| Category | Pod Go model ID | Helix model ID |
|---------|----------------|----------------|
| Distortion | `HD2_DistScream808Mono` | `HD2_DistScream808` |
| Distortion | `HD2_DistKinkyBoostMono` | `HD2_DistKinkyBoost` |
| Wah | `HD2_WahFasselStereo` | `HD2_WahFassel` |
| Delay | `HD2_DelayTransistorTapeStereo` | `HD2_DelayTransistorTape` |
| Reverb | `HD2_ReverbHallStereo` | `HD2_ReverbHall` |
| Comp | `HD2_CompressorDeluxeCompMono` | `HD2_CompressorDeluxeComp` |
| Modulation | `HD2_ChorusStereo` | `HD2_Chorus` |
| Tremolo | `HD2_TremoloTremoloStereo` | `HD2_TremoloTremolo` |

**Amp model IDs are IDENTICAL between Pod Go and Helix.** All 13 amp models confirmed in real Pod Go presets (`HD2_AmpUSDeluxeNrm`, `HD2_AmpPlacaterDirty`, etc.) are already in `models.ts` and use the same ID strings.

**Cab model IDs: mostly shared, partially different.** `HD2_CabMicIr_*` models share naming. Simple `HD2_Cab*` models are largely shared. However Pod Go has a different set of available cabs vs. Helix (different speaker cab models were ported).

**Models exclusive to Pod Go (not in Helix, from firmware 2.50):**
- `Line 6 Clarity`, `Line 6 Aristocrat`, `Line 6 Carillon`, `Line 6 Voltage`, `Line 6 Kinetic`, `Line 6 Oblivion` — six Catalyst Series Original Amp Designs
- These use `HD2_AmpLine6*` prefix (e.g., `HD2_AmpLine6Clarity`)

**Models in Helix NOT in Pod Go (DSP-heavy, omitted from Pod Go):**
- `Tone Sovereign`, `Clawthorn Drive`, `Cosmos Echo` — confirmed omissions per Line 6 FAQ
- Poly Pitch, Space Echo — too DSP-intensive for single-chip Pod Go
- Advanced reverbs (Ganymede, Searchlight) — present but limited availability due to DSP cost

### File Format

**Pod Go uses `.pgp` files (plain JSON).** Inspecting real files confirms:

```
schema: "L6Preset"    ← SAME as Helix .hlx
version: 6            ← SAME as Helix .hlx
device: 2162695       ← DIFFERENT (Helix LT=2162692, Helix Floor=2162688)
```

**`device_version` field:** Present in Pod Go `.pgp` files (e.g., `33619968` for firmware 2.00). NOT present in Helix `.hlx` files. This field must be included in generated Pod Go files.

**Meta section differences:**
- Pod Go meta includes: `tnid`, `song`, `author`, `band` (extra community fields)
- Helix meta does NOT include these
- `application` field = `"POD Go Edit"` for Pod Go (vs `"HX Edit"` for Helix)

---

## Helix vs Pod Go: Full Feature Comparison Table

| Feature | Helix LT/Floor | Pod Go | HelixAI Impact |
|---------|----------------|--------|----------------|
| File format | `.hlx` (JSON) | `.pgp` (JSON) | New file extension + device ID |
| Schema | `L6Preset` v6 | `L6Preset` v6 | Same schema wrapper |
| Device ID | 2162692 / 2162688 | 2162695 | Add to `DEVICE_IDS` in types.ts |
| `device_version` field | Absent | Present | Add to pod-go builder |
| DSP chips | 2 (dsp0 + dsp1) | 1 (dsp0 only, dsp1={}) | Remove dsp1 logic for Pod Go |
| Block slots | 32+ across 2 DSPs | 10 (block0–block9) | Simpler chain assembly |
| Signal routing | Series + Parallel | Series only | No split/join needed |
| Snapshots | 8 | 4 | Fewer snapshots to generate |
| Amp model IDs | `HD2_Amp*` (no suffix) | `HD2_Amp*` (no suffix) | ALL SAME — reuse existing |
| Effect model IDs | `HD2_DistX` (no suffix) | `HD2_DistXMono` (Mono/Stereo suffix) | Need Pod Go model catalog |
| Cab model IDs | `HD2_Cab*` / `HD2_CabMicIr_*` | Slightly different set | Pod Go cab catalog needed |
| @topology | `@topology0`/`@topology1` in global | ABSENT | Don't emit for Pod Go |
| @cursor_dsp/path/position | Present in global | ABSENT | Don't emit for Pod Go |
| @model in global | Absent | `"@global_params"` | Emit for Pod Go |
| inputA / outputA keys | `inputA`, `outputA` | `input`, `output` | Different DSP I/O key names |
| Input @model | `HD2_AppDSPFlow1Input` | `P34_AppDSPFlowInput` | Different input model string |
| Output @model | `HD2_AppDSPFlowOutput` | `P34_AppDSPFlowOutput` | Different output model string |
| @path on blocks | Present (0 or 1) | ABSENT | Don't emit `@path` for Pod Go |
| @stereo on blocks | Present | ABSENT | Don't emit `@stereo` for Pod Go |
| Delay @type | 7 | 5 | Different @type encoding |
| Reverb @type | 7 | 5 | Different @type encoding |
| FX Loop @type | 9 | 5 | Different @type encoding |
| Modulation @type | 4 | 0 | Different @type encoding |
| EQ_STATIC @type | 0 | 6 | Different @type encoding |
| Simple cab @type | 4 (CAB_IN_SLOT) | 2 | Different @type encoding |
| CabMicIr @type | 4 (CAB_IN_SLOT) | 0 | Different @type encoding |
| cab0 key | Present (separate cab entry) | ABSENT (cab is a block) | No cab0 for Pod Go |
| Snapshot controller # | 19 | 4 | Different snapshot controller ID |
| Controller @fs_* fields | ABSENT | Present (rich footswitch metadata) | New footswitch section pattern |
| Snapshot count | 8 | 4 | Generate only 4 snapshots |
| Max amp models | ~120+ | 86 | Smaller model catalog |

---

## Feature Landscape

### Table Stakes (Users Expect These — Missing = Product Feels Broken)

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **Download `.pgp` file** | The only deliverable. A Pod Go user selected Pod Go — they expect a file that loads in Pod Go Edit without error. | MEDIUM | New `preset-builder-podgo.ts` or device-aware path in existing builder. Must emit correct device ID, `device_version`, Pod Go JSON structure. |
| **Correct device ID (2162695)** | Pod Go Edit rejects files with wrong device number with "incompatible device" error. This is the #1 import blocker. | LOW | Add `pod_go: 2162695` to `DEVICE_IDS` in `types.ts`. One-line addition. |
| **Series-only signal chain (no dsp1, no split/join)** | Pod Go has one DSP chip. Emitting `dsp1` blocks or split/join will produce an invalid file or hardware misbehavior. | LOW | Ensure chain builder assigns all blocks to dsp0 only. `dsp1: {}` always. |
| **10-block chain (block0–block9)** | Pod Go has exactly 10 block slots. The physical device displays 10 positions. Fewer blocks = empty slots (valid). More = overflow (invalid). | MEDIUM | Pod Go chain-rules must assemble exactly up to 10 blocks. Current Helix builder uses up to 16 slots across 2 DSPs. |
| **4 snapshots only (snapshot0–snapshot3)** | Pod Go has exactly 4 snapshot slots. Helix generates 8. Emitting snapshot4–snapshot7 would produce an invalid file. | LOW | Pod Go snapshot engine generates 4 snapshots. The existing 4-snapshot role pattern (clean, crunch, lead, ambient) maps 1:1. No new logic needed. |
| **Pod Go effect model IDs with Mono/Stereo suffix** | Pod Go uses `HD2_DistScream808Mono` not `HD2_DistScream808`. Loading a Helix model ID into Pod Go produces "unrecognized model" warnings or silence. | HIGH | New Pod Go model catalog with correct suffixed model IDs. Cannot reuse Helix model IDs for effects. Amp IDs are fine (shared). |
| **Correct @type values for all block types** | Pod Go @type encoding is completely different from Helix. Delay=5 (not 7), Reverb=5 (not 7), Modulation=0 (not 4), EQ_STATIC=6 (not 0). Wrong @type = block not recognized. | HIGH | New `BLOCK_TYPES_PODGO` constant map (or device-aware block type resolution in models). Cannot reuse Helix BLOCK_TYPES constants for Pod Go. |
| **`input`/`output` keys (not `inputA`/`outputA`)** | Pod Go DSP I/O uses `input` and `output` key names. `inputA`/`outputA` = Helix format. Wrong key names = file parse error in Pod Go Edit. | LOW | Builder uses `input`/`output` when generating Pod Go files. |
| **Correct input/output @model strings** | Pod Go input is `P34_AppDSPFlowInput`, Helix is `HD2_AppDSPFlow1Input`. Output: `P34_AppDSPFlowOutput` vs `HD2_AppDSPFlowOutput`. | LOW | Config constant per device. Verified from 18 real Pod Go files. |
| **No `@path` field on blocks** | Helix blocks have `@path: 0` or `@path: 1` (routing path). Pod Go has single-path, no `@path` field. Emitting `@path` may cause Pod Go Edit to misinterpret block routing. | LOW | Omit `@path` when building Pod Go blocks. |
| **Snapshot controller number 4 (not 19)** | Helix uses `@controller: 19` for snapshot assignments. Pod Go uses `@controller: 4`. Wrong controller number = parameter values not recalling per snapshot. | MEDIUM | Pod Go controller section uses `@controller: 4`. Emit `@fs_*` metadata per controller assignment for the footswitch section. |
| **Footswitch section with `@fs_*` metadata** | Pod Go footswitch section has rich metadata (`@fs_index`, `@fs_label`, `@fs_enabled`, `@fs_ledcolor`, `@fs_momentary`, `@fs_primary`) per block. Helix footswitch section is often empty. Pod Go Edit reads this section to display footswitch assignments. Without it, no footswitch assignments are displayed in the editor. | MEDIUM | New `buildFootswitchSection()` for Pod Go using real `.pgp` format as reference. |
| **`device_version` field present** | Pod Go `.pgp` files always have `data.device_version`. Helix `.hlx` files do not. Pod Go Edit likely validates this field. Current firmware 2.50 = `device_version` values in range seen from real files. | LOW | Add `device_version` to the Pod Go `HlxFile` equivalent. Use a sensible firmware version constant (e.g., `33619968` = v2.00). |
| **`@global_params` @model in global section** | Pod Go global section has `"@model": "@global_params"`. Helix global does not have this `@model` field. Whether required is unclear, but all 18 real files include it. | LOW | Emit `"@model": "@global_params"` in Pod Go global section. |
| **No @topology fields in global** | Helix global has `@topology0`/`@topology1`. Pod Go global does not. Emitting these fields may be ignored or cause parsing issues. | LOW | Don't emit `@topology*` fields for Pod Go. |

---

### Differentiators (Competitive Advantage — Beyond Basic Compatibility)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Pod Go-specific model catalog with complete model list** | A correct model catalog with all 86 amps, 206+ effects at their proper Pod Go model IDs means better amp/effect matching in the AI generation. Without it, the app is limited to the ~13 amps confirmed from real files. | HIGH | Requires building a `models-podgo.ts` catalog with Mono/Stereo suffixed effect IDs. Source: Line 6's official models page and firmware 2.50 release notes list all 86 amps. Cross-reference with Helix models.ts for defaultParams. |
| **4-snapshot generation tuned for Pod Go's 4-snapshot limit** | Helix generates 8 snapshots; Pod Go only uses 4. The existing snapshot logic already generates clean/crunch/lead/ambient as the first 4 — this is a perfect fit with no changes needed to the snapshot engine. The differentiator is explicitly documenting and testing this mapping. | LOW | The snapshot engine already generates exactly 4 active snapshots (0–3) and leaves 4–7 empty. Pod Go simply omits the empty ones. No new logic. |
| **Cab-as-block placement (not cab0 key)** | Pod Go places the cab as a regular block (not as a separate `cab0` key like Helix). The cab block is positioned after the amp in the chain with its own position number. This is architecturally different from how the current preset builder works. | MEDIUM | Pod Go builder emits cab as `block5` or `block6` (after amp), not as `cab0`. The `@type` for CabMicIr is 0 (not 4). The block has the same fields as Helix cab (`LowCut`, `HighCut`, `@mic`, `Level`, etc.) — just stored differently. |
| **DSP usage awareness for Pod Go** | Pod Go has ~half the DSP of Helix. A chain-rules module that limits complex effects (no double reverb + reverb, no Ganymede-class reverbs by default) produces files that are guaranteed to load without DSP overflow. | MEDIUM | Pod Go chain-rules should prefer "light" effect models (simple delay, room reverb, basic chorus) over DSP-heavy variants. The DSP budget is not computable without an official DSP cost table, but heuristic rules avoid known heavy combos. |
| **Tone description card shows Pod Go context** | When showing the preset summary card, noting "Pod Go preset" in the UI gives users confirmation they downloaded the right format. A single field change on the existing `ToneDescriptionCard` component. | LOW | Add `device` label to `ToneDescriptionCard`. No backend changes. |

---

### Anti-Features (Do NOT Build These)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Parallel signal paths on Pod Go** | Helix supports parallel routing and users may request it | Pod Go hardware has no parallel routing. `dsp1` is always empty. Emitting split/join blocks produces invalid files. The AI prompt must not generate split topology for Pod Go. | Series-only chain. If user describes a wet/dry blend tone, map it to a single-path chain with appropriate delay/reverb mix levels. |
| **8-snapshot generation for Pod Go** | Helix generates 8 snapshots, some users may expect parity | Pod Go has exactly 4 snapshot slots. Emitting `snapshot4`–`snapshot7` produces a file that either fails to load or causes editor confusion. | Generate exactly 4 snapshots. The existing clean/crunch/lead/ambient pattern is the perfect 4-snapshot split. |
| **Helix model IDs in Pod Go files** | Reusing `models.ts` directly would be faster to implement | `HD2_DistScream808` loads as "unrecognized model" on Pod Go. Every effect model needs the Mono/Stereo suffix. Loading wrong model IDs produces silent failure (effect silently replaced or skipped by Pod Go Edit). | New Pod Go model catalog with correct suffixed IDs. Amp IDs are the exception — they ARE shared. |
| **Live DSP budget calculation** | Users want to know if their preset will fit in Pod Go's DSP | No official DSP cost table from Line 6. Any calculation would be guesswork. A wrong "fits!" indication misleads users; a wrong "too heavy!" blocks valid chains. | Heuristic chain-rules that avoid known DSP-heavy combinations (no Ganymede + Searchlight together, no heavy dual reverb). The Pod Go Edit software shows the real DSP bar when the file loads. |
| **Full Helix feature parity on Pod Go** | Users see Helix features and ask why Pod Go doesn't have them | Pod Go is intentionally limited. Dual-amp, dual-cab, MIDI Command Center, VDI — none exist on Pod Go. Attempting to generate these creates files that malfunction on the device. | Scope Pod Go generation to what Pod Go actually does: one amp, one cab, 4 flexible effects, 4 snapshots, series chain. Generate excellent single-path presets within these constraints. |

---

## Feature Dependencies

```
Device Selector adds "Pod Go"
    └──requires──> DEVICE_IDS["pod_go"] = 2162695 in types.ts
                   └──requires──> PodGoDeviceTarget type added to DeviceTarget union

Pod Go .pgp File Generation
    ├──requires──> Pod Go model catalog (podgo-models.ts or models.ts extension)
    │              └──requires──> Effect model IDs with Mono/Stereo suffixes
    │              └──note──> Amp IDs already in models.ts (shared with Helix)
    ├──requires──> Pod Go-specific BLOCK_TYPES constants (different @type values)
    ├──requires──> Pod Go chain-rules variant (single DSP, 10 blocks, series only)
    ├──requires──> Pod Go preset-builder (device ID, no topology, input/output keys, cab as block)
    └──requires──> Pod Go snapshot engine (4 snapshots only, @controller=4 for snapshot)

Pod Go chain-rules
    ├──requires──> Pod Go model catalog (to pick models with correct IDs)
    ├──requires──> NO split/join logic (series only)
    └──enhances──> DSP-awareness heuristics (avoid heavy effect combos)

Pod Go snapshot engine (4 snapshots)
    └──requires──> Existing snapshot engine logic (block on/off, param overrides)
    └──simplification──> Drops snapshot4-7 generation — cleaner, not more complex

Pod Go footswitch section builder
    ├──requires──> Block assignments from chain-rules (which block → which @fs_index)
    └──requires──> @fs_* metadata (label from model name, ledcolor from block type, index from position)

UI device selector adds "Pod Go"
    └──requires──> Pod Go builder in the generate API route
    └──enhances──> ToneDescriptionCard (adds "Pod Go" label)
```

### Dependency Notes

- **Effect model ID mapping is the highest-risk dependency.** Every effect model in the Pod Go builder must use the suffixed form (`HD2_DistScream808Mono`). This requires a complete Pod Go effect model catalog. Amp models are already correct (shared IDs). This is the one area that cannot be shortcutted.

- **`@type` encoding is a complete remap, not an extension.** The existing `BLOCK_TYPES` constants in `models.ts` are wrong for Pod Go (delay=7 in Helix, delay=5 in Pod Go). This requires either a `BLOCK_TYPES_PODGO` constant set, or a device-aware `getBlockType(device, blockCategory)` function.

- **Cab placement architecture differs.** Helix uses a `cab0` key separate from the block chain. Pod Go places the cab as a numbered block in the chain (block6 or block7, after the amp). The preset builder's `buildHlxFile()` currently generates `cab0`. A Pod Go builder needs to omit `cab0` and instead include the cab as a block at the correct position.

- **Snapshots are a simplification, not a complexity.** Going from 8 to 4 snapshots removes work. The existing snapshot-engine generates 4 active snapshots (0–3) and 4 placeholder snapshots (4–7). Pod Go builder just omits the placeholders.

---

## MVP Definition

### Launch With (Pod Go v1.0)

The minimum viable Pod Go support that a Pod Go owner can actually use:

- [ ] **Device selector: add "Pod Go" option** — User can choose Pod Go at the start of the interview. Downstream everything uses the Pod Go path.
- [ ] **Pod Go effect model catalog** — Pod Go-specific model IDs for the 18 presences confirmed in real files + expanded to cover common effect types (dist, delay, reverb, modulation, dynamics, EQ, wah, volume). The Mono/Stereo suffixed IDs are non-negotiable.
- [ ] **Pod Go BLOCK_TYPES constants** — Correct @type values for Pod Go (delay=5, reverb=5, modulation=0, EQ_STATIC=6, simple cab=2, CabMicIr=0).
- [ ] **Pod Go chain-rules** — Single DSP (block0–block9), series only, no split/join, cab as block (not cab0). The structural rules are simpler than Helix — this is a smaller module.
- [ ] **Pod Go preset builder** — Emits valid `.pgp` JSON with correct device=2162695, `device_version`, `input`/`output` keys (not `inputA`/`outputA`), `P34_AppDSPFlow*` input/output models, no `@path` or `@stereo` on blocks, `@model: "@global_params"` in global, no `@topology*`.
- [ ] **Pod Go snapshot engine** — Generates exactly 4 snapshots using existing clean/crunch/lead/ambient logic. Uses `@controller: 4` (not 19) for snapshot assignments.
- [ ] **Pod Go footswitch section** — Emits `footswitch.dsp0.blockN` with `@fs_index` (0–5 for the 4 flexible effects + FX loop + EQ), `@fs_label`, `@fs_enabled: true`, `@fs_ledcolor`, `@fs_momentary: false`, `@fs_primary: true`.
- [ ] **`.pgp` download** — API returns `.pgp` file with correct MIME type (`application/json` or `application/octet-stream` with `.pgp` extension). Currently the download triggers `.hlx`.

### Add After Validation (v1.x)

Features that improve quality but are not required for an MVP Pod Go preset:

- [ ] **Complete Pod Go amp catalog (86 models)** — The MVP can launch with the 13 amps confirmed from real files + any additional ones from the Helix models.ts that share IDs. The full 86-model catalog (including the Catalyst Series amp designs) adds richness.
- [ ] **DSP-aware effect selection** — Heuristic rules in Pod Go chain-rules that avoid heavy DSP combinations (no Ganymede reverb with double-time delay). Valid for v1.x once the basic MVP is validated.
- [ ] **Pod Go-specific tone description card** — Show "Pod Go preset" badge, remove references to Helix-specific features (parallel paths, 8 snapshots) from the UI.

### Future Consideration (v2+)

- [ ] **Pod Go Wireless support** — Pod Go Wireless uses the same device ID and .pgp format as Pod Go. Would require only a display name change, not a format change. Defer until confirmed.
- [ ] **Pod Go stomp mode layout optimization** — Assigning blocks to specific `@fs_index` positions based on musical logic (e.g., drive on FS3, delay toggle on FS4). Current MVP just assigns sequentially.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Device selector + Pod Go device ID | HIGH (prerequisite) | LOW | P1 |
| Pod Go effect model catalog | HIGH (correctness) | MEDIUM | P1 |
| Pod Go BLOCK_TYPES constants | HIGH (correctness) | LOW | P1 |
| Pod Go chain-rules (series, 10 blocks, cab as block) | HIGH (prerequisite) | MEDIUM | P1 |
| Pod Go preset builder (.pgp format) | HIGH (prerequisite) | MEDIUM | P1 |
| Pod Go snapshot engine (4 snapshots, @controller=4) | HIGH (correctness) | LOW | P1 |
| Pod Go footswitch section | MEDIUM (usability) | MEDIUM | P1 |
| `.pgp` download endpoint | HIGH (prerequisite) | LOW | P1 |
| Complete 86-amp catalog | MEDIUM (quality) | MEDIUM | P2 |
| DSP-aware effect selection | MEDIUM (quality) | MEDIUM | P2 |
| Pod Go device label in tone card | LOW (polish) | LOW | P2 |

**Priority key:**
- P1: Must ship for any Pod Go preset to be loadable on hardware
- P2: Improves quality/completeness after basic functionality works
- P3: Defer (not needed for initial Pod Go support)

---

## Pod Go vs Helix: Code Reuse Assessment

The following existing modules translate **directly** to Pod Go with no or minimal changes:

| Module | Reuse Level | What Changes |
|--------|-------------|-------------|
| `tone-intent.ts` (ToneIntent schema) | 100% reuse | Nothing — ToneIntent is device-agnostic |
| `planner.ts` (AI generation) | 100% reuse | Nothing — AI generates ToneIntent, not device files |
| `param-engine.ts` (parameter resolution) | ~90% reuse | May need to add amp model lookup for Pod Go-exclusive amps |
| `snapshot-engine.ts` (snapshot logic) | ~80% reuse | Pass `maxSnapshots: 4` (not 8). Change snapshot controller from 19 to 4 |
| `chain-rules.ts` (chain assembly) | ~40% reuse | New Pod Go variant: single DSP, 10 blocks, no split/join, different model catalog |
| `preset-builder.ts` (file generation) | ~30% reuse | New Pod Go builder: different device ID, different I/O keys, cab as block, no cab0, no @path/@stereo |
| `validate.ts` (file validation) | ~50% reuse | New validation rules for Pod Go format constraints |
| `models.ts` (model catalog) | ~70% reuse | Amp IDs reused entirely; effect IDs need new suffixed catalog |

The modules that need the most new work are: Pod Go model catalog, Pod Go preset builder, and Pod Go chain-rules. The AI layer (planner) and tone modeling layer (param-engine, snapshot-engine) are largely reusable because they operate on `ToneIntent` and `PresetSpec`, not on device-specific file formats.

---

## Technical Reference: Pod Go File Format Spec

Sourced from direct inspection of 18 real `.pgp` files (firmware v1.00 through v2.00, downloaded from Line 6 CustomTone). All values are HIGH confidence — observed in actual device files.

### Top-Level Structure
```json
{
  "version": 6,
  "schema": "L6Preset",
  "meta": { "pbn": 0, "premium": 0, "original": 0 },
  "data": {
    "device": 2162695,
    "device_version": 33619968,
    "meta": {
      "appversion": 33554432,
      "name": "Preset Name",
      "application": "POD Go Edit",
      "build_sha": "v2.00-5-g665e64e",
      "modifieddate": 1734146822
    },
    "tone": { ... }
  }
}
```

### Tone Structure
```
tone:
  dsp0:         ← all 10 blocks, input, output
  dsp1: {}      ← always empty
  snapshot0..3  ← exactly 4 snapshots
  controller    ← parameter controller assignments
  footswitch    ← footswitch assignments per block
  global        ← tempo, cursor, @model: "@global_params"
```

### Block @type Values (Pod Go vs Helix)
| Block Category | Pod Go @type | Helix @type |
|----------------|-------------|------------|
| Distortion, Dynamics, Wah, Vol, Pitch | 0 | 0 |
| `HD2_CabMicIr_*` (mic'd IR cab) | 0 | 4 |
| Modulation (chorus, flanger, phaser, tremolo, rotary) | 0 | 4 |
| Amp (without cab0) | 1 | 1 |
| `HD2_Cab*` (simple cab) | 2 | 4 |
| Delay, Reverb, FX Loop | 5 | 7, 9 |
| `HD2_EQ_STATIC_*` | 6 | 0 |
| `HD2_ImpulseResponse1024Mono` (user IR) | 2 | 5 |
| Looper | 4 | 6 |

### Input/Output Models
| Field | Pod Go | Helix |
|-------|--------|-------|
| dsp0 input key | `input` | `inputA` |
| dsp0 output key | `output` | `outputA` |
| input `@model` | `P34_AppDSPFlowInput` | `HD2_AppDSPFlow1Input` |
| output `@model` | `P34_AppDSPFlowOutput` | `HD2_AppDSPFlowOutput` |

### Global Section
```json
"global": {
  "@model": "@global_params",
  "@current_snapshot": 0,
  "@cursor_group": "block5",
  "@pedalstate": 2,
  "@tempo": 120
}
```
Note: No `@topology0`/`@topology1`. No `@cursor_dsp`/`@cursor_path`/`@cursor_position`.

### Snapshot Controller Number
- Pod Go: `@controller: 4` (snapshot recall)
- Helix: `@controller: 19` (snapshot recall)
- EXP Pedal 1: `@controller: 1` (same on both)
- EXP Pedal 2: `@controller: 2` (same on both)

---

## Sources

- **Direct inspection of 18 real Pod Go `.pgp` preset files** (firmware v1.00–v2.00, downloaded from Line 6 CustomTone) — HIGH confidence. All file format findings verified empirically. Files located at `C:/Users/dsbog/Downloads/*.pgp`.
- **Direct inspection of 12 real Helix `.hlx` preset files** (firmware v3.70) — HIGH confidence. Comparison baseline for structural differences. Files located at `C:/Users/dsbog/Downloads/*.hlx`.
- **Direct inspection of `src/lib/helix/models.ts`** — HIGH confidence. Confirmed all 13 Pod Go amp model IDs already exist in models.ts with matching ID strings.
- [Line 6 POD Go FAQ](https://line6.com/support/topic/53806-pod-go-faq/) — HIGH confidence (official Line 6 support). Confirms block structure, fixed vs. flexible blocks, 3 omitted models (Tone Sovereign, Clawthorn Drive, Cosmos Echo).
- [POD Go Block Restrictions — Line 6 Community](https://line6.com/support/topic/62007-pod-go-block-restrictions/) — MEDIUM confidence (community forum). Confirms 4 flexible blocks, DSP constraints, practical workarounds.
- [POD Go 2.50 — Line 6 Community](https://line6.com/support/page/kb/pod/pod-go/pod-go-250-r1085/) — HIGH confidence (official Line 6 KB). Confirms firmware 2.50 adds 11 guitar amps, 2 bass amps, 11 guitar cabs, 2 bass cabs, 2 effects (Jan 2025).
- [Line 6 POD Go Models Page](https://line6.com/podgo-models/) — HIGH confidence (official Line 6 product page). Lists 86 amp models by name; no internal HD2_ IDs shown.
- [File Formats, Custom Tools and API — Line 6 Community](https://line6.com/support/topic/63502-fileformats-custom-tools-and-api/) — MEDIUM confidence (community reverse engineering). Confirms `.pgp` is plain JSON. Community notes `dsp0`-only structure.
- [AI Generation of Presets — Line 6 Community](https://line6.com/support/topic/70120-ai-generation-of-presets/) — MEDIUM confidence (community). Confirms file format is text-based JSON; AI-generated files fail due to structural inaccuracies (not model inaccuracies).
- [Pod Go vs Helix LT — Line 6 Community](https://line6.com/support/topic/56025-pod-go-vs-helix-lt/) — MEDIUM confidence (community). Confirms series-only routing, single DSP, 4 snapshots vs 8.
- [POD Go 2.50 Firmware Update Overview](https://www.noiseharmony.com/post/line-6-pod-go-2-50-firmware-update-what-s-new) — MEDIUM confidence (editorial). Lists Catalyst Series amp designs added in 2.50 (Line 6 Clarity, Aristocrat, Carillon, Voltage, Kinetic, Oblivion).

---

*Feature research for: HelixAI Pod Go Support Milestone*
*Researched: 2026-03-02*
