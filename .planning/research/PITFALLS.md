# Pitfalls Research

**Domain:** Adding Line 6 Pod Go preset generation to existing HelixAI system
**Researched:** 2026-03-02
**Confidence:** HIGH for format/routing/model differences (community + Line 6 official sources); MEDIUM for exact .pgp JSON field names (no official Line 6 schema documentation; empirical inspection required)

> This document supersedes the v1.1 pitfalls document. The focus here is the risks of adding Pod Go support to a system that already generates Helix LT/Floor presets — specifically what breaks silently, what causes "target is incompatible" errors on import, and what assumptions the existing Helix codebase makes that are invalid for Pod Go.

---

## Critical Pitfalls

These cause silent failures, wrong hardware behavior, "target is incompatible" import errors with no useful diagnostic, or corrupted Helix presets from code path contamination.

---

### Pitfall 1: Assuming Pod Go Uses the Same .hlx File Format

**What goes wrong:** The builder emits a `.hlx` file for Pod Go using `buildHlxFile()` with `device: DEVICE_IDS["pod_go"]`. The file downloads successfully. When the user imports it into Pod Go Edit, they get "target is incompatible" with no further detail. The preset never loads. Users on Helix LT continue getting correct `.hlx` files, so the bug appears Pod Go-specific but the root cause is the wrong file format entirely.

**Why it happens:** The existing `types.ts` defines `DeviceTarget = "helix_lt" | "helix_floor"` and `DEVICE_IDS` maps to integer values (`helix_lt: 2162692`, `helix_floor: 2162688`). The natural implementation of Pod Go support is to add `"pod_go"` to this union and a new device ID integer, then pass it through `buildHlxFile()`. This produces a file with `schema: "L6Preset"` — which is the Helix schema identifier. Pod Go uses a different schema identifier in its `.pgp` files. Pod Go Edit validates the `schema` field and rejects files with the wrong identifier.

**How to avoid:**
- Pod Go presets use a `.pgp` extension and a different JSON schema identifier from `.hlx` files. Do not route Pod Go through `buildHlxFile()` — build a separate `buildPgpFile()` function.
- Before writing any code, obtain a real `.pgp` file exported from Pod Go Edit and inspect its top-level fields (`schema`, `version`, `data.device`, `data.device_version`) to establish the correct values. The Helix uses `schema: "L6Preset"` and `version: 6`; Pod Go likely uses different values for both.
- The file extension must also be `.pgp`, not `.hlx`. The download handler in `page.tsx` and `generate/route.ts` must emit the correct extension per device.
- Confirm the Pod Go device integer ID by inspecting a real `.pgp` file. The community notes that Pod Go and Pod Go Wireless have different device IDs, so the single integer assumption from the Helix model does not hold.

**Warning signs:**
- "Target is incompatible" or "incompatible device" error in Pod Go Edit on import
- User receives a downloaded file but cannot import it
- The `.pgp` file opens in a text editor and shows `schema: "L6Preset"` (which is the Helix schema, not Pod Go's)

**Phase to address:** Phase 1 (Pod Go Format Foundation). This is the first implementation gate — nothing works without the correct file format. Empirical inspection of a real `.pgp` file is mandatory before writing any builder code.

---

### Pitfall 2: Assuming Pod Go Uses Two DSP Paths (dsp0 + dsp1)

**What goes wrong:** The existing Helix builder splits the signal chain across two DSPs: amp + pre-amp effects on DSP0, post-cab effects on DSP1. The `assembleSignalChain()` and `buildDsp()` functions both operate on this two-DSP model. If Pod Go support is built by passing the same `PresetSpec` through an only-slightly-modified `buildHlxFile()`, the generated file contains a populated `dsp1` section. Pod Go has a single-chip DSP and only one signal path — `dsp1` in the `.pgp` format is empty or absent. Pod Go Edit may silently strip the `dsp1` content, or may reject the file entirely. Either way, all post-cab effects (EQ, modulation, delay, reverb, volume block) are lost.

**Why it happens:** The current `types.ts` `HlxTone` interface requires both `dsp0` and `dsp1`. The `buildTone()` function in `preset-builder.ts` always builds both DSPs from the signal chain. The two-DSP split is hardcoded into `assembleSignalChain()` in `chain-rules.ts` (DSP0 for pre-cab, DSP1 for post-cab). There is no single-DSP code path in the existing codebase.

**How to avoid:**
- Pod Go signal chain is a single linear path. All blocks — pre-amp, amp, cab, and all post-cab effects — live on one DSP.
- `chain-rules.ts` must be modified or a Pod Go-specific variant must be created that assigns all blocks `dsp: 0` regardless of block type. The post-cab blocks (EQ, modulation, delay, reverb, volume) must still be inserted but all with `dsp: 0`.
- The block count limit changes: Pod Go supports approximately 6-8 total blocks (including the fixed Amp, Cab, EQ, and Volume blocks) leaving 4 freely assignable effect slots. The Helix 8-blocks-per-DSP-per-path limit does not apply. Pod Go has a single global DSP budget.
- Pod Go Edit enforces that certain block types (Amp, Cab/IR, Wah, EQ, Volume, FX Loop) are always present in specific structural positions. A blank Pod Go preset starts with these fixed blocks already inserted. The `buildPgpFile()` function must account for this structure.
- Inspect a real `.pgp` file to confirm whether `dsp1` key is absent entirely or present but empty, and whether the tone section uses a flat block list or the same `dsp0`/`dsp1` structure as `.hlx`.

**Warning signs:**
- Generated preset loads in Pod Go but only has the amp and cab — all effects are missing
- Pod Go Edit shows fewer blocks than expected in the signal chain
- Console errors during generation about blocks exceeding the DSP limit calculation

**Phase to address:** Phase 1 (Pod Go Format Foundation). The single-DSP architecture requires a new signal chain assembly path. This is a structural change, not a parameter tweak.

---

### Pitfall 3: Using Helix Model IDs for Pod Go (HD2_ Prefix Assumption)

**What goes wrong:** The Helix model database in `models.ts` uses `HD2_` prefixed model IDs (e.g., `HD2_AmpUSDeluxeNrm`, `HD2_DistMinotaur`, `HD2_DelayDigital`). The existing validator uses a `VALID_IDS` set built from these `HD2_` IDs. Pod Go preset files use the same `HD2_` prefix for most models because the devices share the same model engine — but three specific Helix effects do NOT exist on Pod Go: `Tone Sovereign`, `Clawthorn Drive`, and `Cosmos Echo`. If the AI planner generates any of these three model IDs for a Pod Go preset, the validator passes them (they are in the Helix valid set), the builder emits them, and Pod Go Edit throws "unrecognized models" on import.

**Why it happens:** The validation set `VALID_IDS` is derived from `models.ts` which contains the complete Helix model database. No flag distinguishes "Helix only" models from "Helix + Pod Go" models. When `validateAndFixPresetSpec()` runs, it does not know which device the preset targets, so it validates against the full Helix set. The three missing Pod Go models all have valid-looking `HD2_` IDs.

**How to avoid:**
- Create a `POD_GO_EXCLUDED_IDS` constant listing the three unsupported models: `HD2_DistToneSovereign`, `HD2_DistClawthorn`, `HD2_DelayCosmosEcho` (confirm exact IDs by inspecting a Pod Go Edit model list or `.pgp` file).
- Extend `validateAndFixPresetSpec()` to accept a `device: DeviceTarget` parameter. When `device === "pod_go"`, add the excluded IDs to the set of invalid IDs, triggering the closest-match auto-correction to a valid Pod Go equivalent.
- Update the system prompt for Pod Go generation to exclude these three models from the valid model list given to the AI. The AI should never be offered these IDs as options for Pod Go presets.
- The alternative: maintain a separate `POD_GO_VALID_IDS` set that is the Helix valid set minus the excluded models. Pass the correct set to the validator based on device.

**Warning signs:**
- "This preset contains unrecognized models" error in Pod Go Edit
- The generated preset summary mentions Tone Sovereign, Clawthorn Drive, or Cosmos Echo for a Pod Go target
- Validator shows no errors (it passed) but Pod Go Edit rejects the file

**Phase to address:** Phase 1 (Pod Go Format Foundation). The excluded model list must be established before any Pod Go preset can be validated correctly. Confirm exact model IDs by inspecting Pod Go Edit's model list before building the exclusion set.

---

### Pitfall 4: Assuming Shared `validateAndFixPresetSpec()` Logic Is Safe for Both Devices

**What goes wrong:** The existing `validateAndFixPresetSpec()` is called from `generate/route.ts` without device context. Adding Pod Go support by calling the same validator produces a Helix-validated spec that is then passed to `buildPgpFile()`. This introduces two failure modes: (1) Helix-specific auto-corrections (e.g., substituting a Helix-only model for a Pod Go invalid model) produce a spec with Helix-only model IDs that Pod Go cannot load; (2) The block count and DSP assignment validation uses Helix rules (8 blocks per DSP, two DSPs) which are wrong for Pod Go's single-DSP structure.

**Why it happens:** The validator was designed for Helix. It knows nothing about Pod Go constraints. The `generate/route.ts` call `validateAndFixPresetSpec(spec)` has no device parameter. Adding Pod Go to the same route without plumbing device context through the validation layer produces cross-contaminated validation results.

**How to avoid:**
- Pass `device: DeviceTarget` through the full pipeline: `generate/route.ts` → `validateAndFixPresetSpec(spec, device)` → `buildHlxFile(spec, device)` or `buildPgpFile(spec)`.
- The validator must branch on device: different valid ID sets, different block count limits, different DSP assignment rules.
- Alternatively, create `validateAndFixPodGoSpec(spec)` as a separate function that imports only Pod Go-specific rules, to avoid a growing if/else tree in the existing validator.
- After validation, run a device-specific post-validation check: for Pod Go, confirm all block `dsp` values are `0`, confirm no excluded model IDs remain, confirm block count is within Pod Go limits.

**Warning signs:**
- Validator reports `fixed: false` (no corrections needed) for a Pod Go spec but Pod Go Edit still rejects the file
- A Helix preset validation auto-correction triggers and selects a Helix-only replacement model
- `dsp: 1` appears in a Pod Go spec's signal chain blocks after validation

**Phase to address:** Phase 1 (Pod Go Format Foundation). The device parameter must be threaded through the pipeline before either builder can be called correctly.

---

### Pitfall 5: Contaminating Helix Code Paths When Adding Pod Go

**What goes wrong:** Pod Go support is added by extending the existing `buildHlxFile()`, `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`, and `validate.ts` with Pod Go branches (if/else on device). Over time, the Helix code paths accumulate conditionals that check `device === "pod_go"` and skip or modify behavior. This produces a fragile codebase where a Pod Go bug fix unintentionally changes Helix behavior, or vice versa. The existing 50-test Knowledge Layer suite was written against Helix behavior — any shared-code change that alters default behavior will cause test failures that look like Pod Go regressions but actually indicate Helix regressions.

**Why it happens:** The path of least resistance is to add `if (device === "pod_go")` guards throughout the existing modules. This avoids file proliferation and seems cleaner short-term. But `chain-rules.ts` alone would need at least 5 Pod Go-specific branches (single DSP, fixed block positions, different mandatory blocks, different block count limits, different topology).

**How to avoid:**
- Create a `src/lib/pod-go/` directory parallel to `src/lib/helix/` with Pod Go-specific implementations:
  - `pod-go/chain-rules.ts` — single-DSP signal chain assembly
  - `pod-go/validate.ts` — Pod Go-specific validation rules
  - `pod-go/preset-builder.ts` — `.pgp` file generation
  - `pod-go/config.ts` — Pod Go firmware version constants
- Share only the pure data types (`PresetSpec`, `BlockSpec`, `SnapshotSpec`) and the model database (`models.ts`) between the two device implementations. These are device-agnostic.
- The shared system prompt for the AI planner can be parameterized (model list, device name, block count limits) rather than having separate prompts for each device — but the Knowledge Layer implementations must be separate.
- Run the existing 50-test Helix suite after every Pod Go change to verify zero Helix regressions.

**Warning signs:**
- `chain-rules.ts`, `param-engine.ts`, or `snapshot-engine.ts` accumulate `device === "pod_go"` conditionals
- The existing Helix Knowledge Layer test suite fails after a Pod Go change
- A Pod Go bug fix is found to also affect Helix preset output

**Phase to address:** Phase 1 (Pod Go Format Foundation). The architectural decision (separate module vs. shared with conditionals) must be made before writing any Pod Go-specific code. Separate modules prevent contamination by design.

---

### Pitfall 6: Assuming Pod Go Has 8 Snapshots

**What goes wrong:** The existing `buildTone()` function in `preset-builder.ts` generates exactly 8 snapshots (`snapshot0` through `snapshot7`) because Helix LT supports 8. The `HlxTone` interface requires all 8. If `buildPgpFile()` is written by copying `buildTone()` and emitting 8 snapshots, Pod Go Edit either rejects the file or silently truncates to 4 snapshots (the Pod Go maximum), causing the user's carefully named snapshot 5-8 to disappear. If truncation is silent, the user gets a partial preset with no error message.

**Why it happens:** The `SnapshotSpec[]` array in `PresetSpec` can hold up to 8 entries. The Helix planner generates 4 snapshots but could generate up to 8. If the same planner output is passed to a Pod Go builder without checking the snapshot count, the builder might attempt to emit more snapshots than Pod Go supports.

**How to avoid:**
- Pod Go supports exactly 4 snapshots. `buildPgpFile()` must assert `spec.snapshots.length <= 4` and throw if more are present.
- The system prompt for Pod Go generation must specify the 4-snapshot maximum. The existing planner generates 4 (Clean, Rhythm, Lead, Ambient) by default, which happens to match the Pod Go limit — but this should be an enforced constraint, not an accidental match.
- If the planner is ever extended to generate more than 4 snapshots for Helix devices, the Pod Go path must filter to the first 4.
- Verify the exact snapshot format in `.pgp` files: Pod Go snapshots may use a different key format (`snapshot0`-`snapshot3` only, no `snapshot4`-`snapshot7` keys at all), which would cause Pod Go Edit to reject any file with keys outside the valid range.

**Warning signs:**
- Pod Go preset loads but snapshots 5-8 are missing without any error
- Pod Go Edit shows only 4 snapshots even though the generated file had 8 entries
- Pod Go Edit rejects the file when snapshot keys beyond `snapshot3` are present

**Phase to address:** Phase 1 (Pod Go Format Foundation). Validate this against a real `.pgp` file to confirm the snapshot key range and count limit before writing `buildPgpFile()`.

---

### Pitfall 7: Wrong Pod Go Firmware Version Constants Causing Import Rejection

**What goes wrong:** The existing `config.ts` contains `FIRMWARE_CONFIG` with `HLX_VERSION: 6`, `HLX_APP_VERSION: 57671680` (encoding firmware 3.70), and `HLX_BUILD_SHA: "v3.70"`. These are Helix-specific constants. If `buildPgpFile()` reuses these constants or copies them without change, the generated `.pgp` file claims to be from Helix firmware 3.70. Pod Go Edit validates the firmware version field against what it expects for Pod Go (currently at firmware 2.x). The version mismatch causes "incompatible" rejection or the file loads into the wrong firmware slot with incorrect behavior.

**Why it happens:** Pod Go firmware is on a separate versioning track from Helix firmware. Helix reached firmware 3.70; Pod Go 2.0 is the current major version. The integer encoding of the firmware version in the file header differs between device families. Copying `FIRMWARE_CONFIG` constants to `pod-go/config.ts` without updating them to Pod Go 2.x values produces a file that claims impossible provenance.

**How to avoid:**
- Create `src/lib/pod-go/config.ts` with Pod Go-specific firmware constants. Do not import or reference `src/lib/helix/config.ts` from the Pod Go builder.
- Establish the correct values by inspecting a `.pgp` file exported from Pod Go Edit 2.0: check the `version` integer, `data.device_version`, `meta.build_sha`, and `meta.appversion` fields.
- Pod Go firmware 2.0 was released November 7, 2023. The `appversion` integer encoding for Pod Go 2.0 must be confirmed empirically — it will not be the same integer as Helix 3.70 (57671680).
- Add a Pod Go-specific firmware version validation check: if the constants in `pod-go/config.ts` look like Helix values (e.g., `HLX_APP_VERSION` starting with "576"), it is the wrong value.

**Warning signs:**
- "Incompatible device" or version mismatch errors in Pod Go Edit on import
- The `.pgp` file opens in a text editor and shows `build_sha: "v3.70"` (which is a Helix firmware string)
- Pod Go Edit accepts the file but reports firmware mismatch warnings

**Phase to address:** Phase 1 (Pod Go Format Foundation). Empirical inspection of a real Pod Go 2.0 `.pgp` export is required to determine the correct constants. This is a mandatory pre-coding step, not optional.

---

### Pitfall 8: Assuming Pod Go Block Routing Is Freely Configurable Like Helix

**What goes wrong:** The `chain-rules.ts` module places blocks in any position within DSP0 or DSP1 based on signal chain ordering rules. For Helix, blocks can go in any position in any order. For Pod Go, the signal chain has structural constraints: Amp and Cab/IR blocks occupy fixed conceptual positions (not arbitrary positions), and certain block types are always present (Wah, Volume, FX Loop, EQ). If the Pod Go chain-rules module applies the same free-positioning logic, the resulting `.pgp` file may have blocks in positions that Pod Go Edit considers invalid, producing import errors or unexpected routing on hardware.

**Why it happens:** Pod Go's fixed block structure means that a blank Pod Go preset already contains Wah, Volume, FX Loop, Amp, Cab, and EQ blocks. Users can change the type within each slot but cannot replace, for example, the Wah slot with a Delay. The `buildPgpFile()` function must map the AI-requested signal chain into this fixed structural template rather than placing blocks freely.

**How to avoid:**
- Study the fixed block slot structure of the Pod Go by examining 3-4 real `.pgp` files exported from Pod Go Edit. Map each JSON block key to its fixed structural role.
- The Pod Go signal chain has approximately this structure: [Input] → [Wah] → [Volume] → [Drive] → [Amp] → [Cab/IR] → [EQ] → [Mod] → [Delay] → [Reverb] → [FX Loop] → [Output]. Not all slots are always populated, but their positions are constrained.
- The `assembleSignalChain()` equivalent for Pod Go must place AI-requested effects into the correct fixed slots based on block type, rather than assigning sequential positions freely.
- If the AI requests an effect type that cannot occupy the requested position (e.g., a Delay in the pre-amp position), the chain-rules module must either reorder it or reject it.

**Warning signs:**
- Pod Go Edit accepts the file but the signal chain display shows blocks in wrong positions
- Expected effects are missing from the hardware output despite appearing in the `.pgp` JSON
- Pod Go Edit shows routing errors when the preset is loaded

**Phase to address:** Phase 1 (Pod Go Format Foundation). Must be verified from real `.pgp` files before writing the Pod Go chain-rules module.

---

### Pitfall 9: Assuming Pod Go Snapshot Behavior Matches Helix (All Parameters Snap)

**What goes wrong:** The existing `snapshot-engine.ts` generates snapshots that include `parameterOverrides` for ChVol (amp channel volume) and Gain (volume block dB) to achieve volume balancing across snapshots. These parameter overrides work on Helix because any parameter can be assigned to a snapshot controller. On Pod Go, snapshot-controlled parameters require explicit assignment to a "Snapshots" controller — the behavior is identical in principle but the JSON representation of this controller assignment may differ from the Helix `@controller: 19` pattern. If `buildPgpFile()` copies the Helix controller section structure verbatim, Pod Go may not recognize the snapshot parameter assignments, and all snapshots will have identical ChVol and Gain values regardless of the override data.

**Why it happens:** Helix and Pod Go use the same user-facing concept (snapshot = preset within preset), and both claim to support "up to 64 parameter values per snapshot." But the internal JSON encoding of which parameters are snapshot-controlled, and how their min/max ranges are registered, may differ between the two formats. The `buildControllerSection()` function in the Helix builder generates Helix-specific controller JSON.

**How to avoid:**
- Inspect a real `.pgp` file that uses snapshot parameter overrides (a preset with different amp volumes per snapshot) and compare its controller section JSON to the equivalent Helix `.hlx` file.
- If the controller JSON structure is identical (same field names, same `@controller: 19` value), the existing logic can be reused. If it differs, write a `buildPodGoControllerSection()` that produces the correct structure.
- Test by loading the generated preset on real Pod Go hardware and switching between the Clean and Lead snapshots — the volume difference should be audible if snapshot parameter overrides are working.

**Warning signs:**
- All 4 Pod Go snapshots sound identical in volume despite different ChVol overrides in the spec
- The Lead snapshot does not have the expected +2.5 dB boost compared to Clean
- Pod Go Edit's controller assignment view shows no parameters assigned to snapshots

**Phase to address:** Phase 2 (Pod Go Knowledge Layer). Validate with real hardware before marking the snapshot engine complete.

---

### Pitfall 10: The AI Planner Generating Dual-DSP Signal Chains for Pod Go

**What goes wrong:** The existing system prompt for Claude's planner (`callClaudePlanner()`) includes instructions to split the signal chain across DSP0 and DSP1: "amp and cab on DSP0, post-cab effects on DSP1." If the same system prompt is used for Pod Go generation, the AI assigns some blocks `dsp: 1`. The Pod Go chain-rules module then encounters blocks with `dsp: 1` and either ignores them (losing post-cab effects) or errors. The Knowledge Layer correctly handles the single-DSP constraint, but only if the AI's output does not specify DSP assignments at all — or if the AI is explicitly told "all blocks must be on DSP0."

**Why it happens:** The planner system prompt for Helix is hardcoded with dual-DSP instructions. If Pod Go generation reuses the same prompt path without modification, the AI generates a Helix-style dual-DSP spec. The `ToneIntentSchema` contains `dsp: z.union([z.literal(0), z.literal(1)])` on each block, allowing the AI to output either value.

**How to avoid:**
- Create a Pod Go-specific system prompt (or a parameterized prompt that takes `device`) that explicitly states: "All blocks must be assigned to dsp 0. Do not use dsp 1 — Pod Go has a single signal path."
- Alternatively, have the `chain-rules.ts` equivalent for Pod Go ignore the `dsp` field in the AI's output entirely and assign all blocks `dsp: 0` by rule.
- The second approach (ignore AI's DSP assignment) is more robust: the Knowledge Layer should own the DSP assignment for Pod Go, just as it owns block ordering and mandatory block insertion.

**Warning signs:**
- The `assembleSignalChain()` output for a Pod Go generation contains blocks with `dsp: 1`
- Post-cab effects (delay, reverb, modulation) are missing from the generated Pod Go preset
- The AI-generated spec has a valid-looking dual-DSP split that the Pod Go builder silently discards

**Phase to address:** Phase 1 (Pod Go Format Foundation) for the system prompt constraint; Phase 2 (Pod Go Knowledge Layer) for the chain-rules enforcement.

---

### Pitfall 11: Shared AI Planner Model List Including Pod Go-Unavailable Models

**What goes wrong:** The current system prompt given to Claude during the generation phase includes the full model list from `models.ts` — including `HD2_DistToneSovereign`, `HD2_DistClawthorn`, and `HD2_DelayCosmosEcho`. For Helix generation, this is correct. For Pod Go generation using the same prompt, Claude may select one of these three models. The validator passes it (VALID_IDS set includes it). The builder emits it. Pod Go Edit throws "unrecognized models" on import. The user sees a valid-looking file that silently fails.

**Why it happens:** The model list in the system prompt is built from `getModelListForPrompt()` which iterates all models in the database without device filtering. Adding Pod Go support without also filtering the model list given to the AI creates a prompt that offers unavailable models as valid choices.

**How to avoid:**
- `getModelListForPrompt()` must accept a `device: DeviceTarget` parameter and filter out Pod Go-excluded models when `device === "pod_go"`.
- The three excluded model IDs must be identified by their exact `HD2_` strings. Confirm these by checking the Pod Go FAQ and cross-referencing with `models.ts`. Current best candidates based on Line 6 official FAQ: Tone Sovereign, Clawthorn Drive, and Cosmos Echo. Exact `HD2_` strings must be verified in `models.ts`.
- Additionally, Pod Go has older-generation oversampling algorithms for some models compared to current Helix firmware. While these models technically have the same `HD2_` IDs, they may sound slightly different. This is a tone quality consideration, not a compatibility blocker — document it but do not filter based on it.

**Warning signs:**
- Pod Go preset generation summary mentions Tone Sovereign, Clawthorn Drive, or Cosmos Echo by name
- "Unrecognized models" error in Pod Go Edit
- The `VALID_IDS` set used for Pod Go validation contains models that Pod Go Edit cannot import

**Phase to address:** Phase 1 (Pod Go Format Foundation). Model filtering must be in place before any Pod Go prompt is sent to the AI.

---

### Pitfall 12: Pod Go Firmware Version Differences Invalidating Presets Across Firmware Versions

**What goes wrong:** Pod Go received a major firmware update (2.0, November 2023) that added a new cab engine with 33 new cabs, 6 new amps, and 7 new effects, plus introduced a "Legacy" cab indicator for older cabs. Presets targeting Pod Go firmware 2.0 (with new model IDs for the new cabs and amps) cannot be imported on Pod Go devices still running firmware 1.40 or earlier. Users on older firmware get "unrecognized models" errors. The existing Helix implementation has the same firmware coupling concern (hardcoded to FW 3.70 in `config.ts`), but the Pod Go community is likely to have users on both 1.x and 2.x firmware given the 2.0 update was only in late 2023.

**Why it happens:** Line 6 does not publish a model compatibility matrix by firmware version. The `.pgp` file's `device_version` field encodes the target firmware version, and Pod Go Edit validates that the device's current firmware is compatible. If a user generates a Pod Go 2.0 preset on HelixAI and imports it on a device running 1.40, the new models are unrecognized.

**How to avoid:**
- Target Pod Go 2.0 (the current firmware) for all generated presets — this is the correct baseline for new development.
- Document in the UI that generated presets require Pod Go firmware 2.0+. Add a visible note to the preset download or description.
- Do not use any of the new Pod Go 2.0 cab engine models (the 33 new cabs) in the default cab database unless you are certain they exist across all firmware versions a user might have. The safe default: use cabs that existed before the 2.0 update.
- In the Pod Go config file, store the firmware version as an explicit constant with a comment explaining the targeting rationale, following the pattern of `FIRMWARE_CONFIG` in `helix/config.ts`.

**Warning signs:**
- Users with "older" Pod Go units report "unrecognized models" for presets that work on other units
- Pod Go Edit version mismatch warnings appearing for some users
- Community reports that a specific cab model doesn't work on their device

**Phase to address:** Phase 1 (Pod Go Format Foundation). The firmware target decision must be made before any cab or amp model database entries are created for Pod Go.

---

## Technical Debt Patterns

Shortcuts that could be introduced while adding Pod Go to the existing system.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Add Pod Go branches directly into existing `chain-rules.ts`, `validate.ts`, `preset-builder.ts` | Avoid new files | Helix code paths accumulate Pod Go conditionals; existing 50-test suite becomes fragile; a Pod Go fix silently breaks Helix | Never — create `src/lib/pod-go/` directory |
| Reuse `buildHlxFile()` with a new Pod Go device ID | Ships faster | Pod Go Edit rejects `.hlx` files with `schema: "L6Preset"` on import | Never — must write `buildPgpFile()` |
| Use same system prompt for both Helix and Pod Go generation | No prompt duplication | AI generates DSP1 assignments and Pod Go-unavailable model IDs; validator catches some but not all | Only if prompt is parameterized (model list, device name, DSP constraint) and Pod Go-specific overrides are applied |
| Skip empirical `.pgp` format inspection and guess field names from `.hlx` | Faster initial implementation | "Target incompatible" errors on every import; zero preset imports succeed | Never — inspect 2-3 real `.pgp` files before writing any builder code |
| Share the VALID_IDS set between Helix and Pod Go validation | Simpler code | Pod Go-unavailable models pass validation and cause Pod Go Edit import failures | Never — maintain `POD_GO_EXCLUDED_IDS` set |
| Target Pod Go 1.x firmware instead of 2.0 to maximize compatibility | Avoids firmware edge cases | Many users expect 2.0 models; new cab engine models unavailable; device looks outdated | Only if empirical testing shows 2.0-exclusive models are genuinely problematic |

---

## Integration Gotchas

Common mistakes when integrating Pod Go into the existing Helix generation pipeline.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `generate/route.ts` device routing | Using the same `buildHlxFile()` call for both devices with a different device ID | Route on `device`: call `buildHlxFile(spec, device)` for Helix targets, `buildPgpFile(spec)` for Pod Go; emit `.pgp` extension for Pod Go downloads |
| `validateAndFixPresetSpec()` | Calling with Helix validation rules for Pod Go specs | Pass `device` parameter; use Pod Go-specific VALID_IDS set minus excluded models |
| System prompt model list | Using `getModelListForPrompt()` without device filtering | Add device parameter; filter out `POD_GO_EXCLUDED_IDS` when device is Pod Go |
| Signal chain assembly | Running `assembleSignalChain()` which assigns `dsp: 1` to post-cab blocks | Run Pod Go chain assembly that assigns all blocks `dsp: 0` and enforces Pod Go fixed-slot structure |
| Snapshot count | Passing a spec with 8 snapshots to `buildPgpFile()` | Assert `spec.snapshots.length <= 4` before building; planner prompt must specify 4-snapshot limit |
| Firmware constants | Copying `FIRMWARE_CONFIG` from `helix/config.ts` to `pod-go/config.ts` | Establish Pod Go 2.0 constants empirically from a real `.pgp` export; never copy Helix values |
| File download extension | Using `.hlx` extension for all downloads regardless of device | Use `.pgp` for Pod Go, `.hlx` for Helix LT/Floor; the `Content-Disposition` header filename must match |
| UI device selector | Showing same UI for all devices without Pod Go-specific notes | Add note in UI that Pod Go presets require firmware 2.0+; Pod Go shows 4 snapshots not 8 |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Two separate model validation sets requiring duplication of VALID_IDS computation | Slower validation, memory bloat | Maintain one base Helix set; compute Pod Go set as `helixSet - excludedIds` at module init | Not a real concern at current scale — preset generation is infrequent |
| Parallel generation with both Helix LT and Pod Go providers selected | API call fails for one target, succeeds for other, results look mismatched | Expected — all parallel providers succeed independently; Pod Go format difference is handled by routing, not by parallel execution | No scale threshold; routing must be correct from day one |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Emitting `.hlx` files with Pod Go device ID instead of a separate `.pgp` file | User with Helix LT tries to load a "Helix" file that contains Pod Go routing (single DSP, fixed blocks) — tone sounds completely wrong even though it loads | Enforce strict file type per device: never emit `.hlx` with a non-Helix device ID |
| Trusting AI-generated `dsp` field values for Pod Go | AI outputs `dsp: 1` which bypasses the single-DSP constraint; Knowledge Layer never gets a chance to correct it | Knowledge Layer must re-assign all Pod Go blocks to `dsp: 0` regardless of AI output |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Download button says "Download .hlx" for Pod Go | User confused about what file type they received; Helix LT users who also have a Pod Go try to load it on the wrong device | Show device name on download button: "Download for Pod Go (.pgp)" vs "Download for Helix LT (.hlx)" |
| No firmware version warning for Pod Go | User on Pod Go firmware 1.40 gets "unrecognized models" with no explanation | Show "Requires Pod Go firmware 2.0+" note near Pod Go download button or in the preset description card |
| Showing 8 snapshot pills in the tone description card for a Pod Go preset | Pod Go only has 4 — user confused why 4 are missing on their device | Cap snapshot display to 4 for Pod Go presets; add note "Pod Go: 4 snapshots" |
| Generating a Pod Go preset that references Tone Sovereign in the human-readable summary | User specifically asked for that effect; it appears in the description but doesn't load on their device | Filter Tone Sovereign, Clawthorn Drive, and Cosmos Echo from both the generated preset AND the summary text for Pod Go targets |

---

## "Looks Done But Isn't" Checklist

- [ ] **Pod Go format:** Import a generated `.pgp` file into Pod Go Edit — if "target is incompatible" appears, the schema or device ID field is wrong
- [ ] **Pod Go format:** The downloaded file has `.pgp` extension, not `.hlx`
- [ ] **Single DSP:** Open the generated `.pgp` in a text editor — confirm no blocks have `dsp: 1` or equivalent in the JSON
- [ ] **Model validation:** Generate a Pod Go preset and confirm the summary never mentions Tone Sovereign, Clawthorn Drive, or Cosmos Echo
- [ ] **Snapshot count:** Generate a Pod Go preset and confirm exactly 4 snapshots appear in Pod Go Edit, not 8
- [ ] **Volume balancing:** Switch between Clean and Lead snapshots on Pod Go hardware — the Lead snapshot must be audibly louder, confirming snapshot parameter overrides work
- [ ] **Firmware constants:** Open the generated `.pgp` in a text editor — the `build_sha` field must not say "v3.70" (Helix firmware string)
- [ ] **Helix regression:** Run the full 50-test Knowledge Layer suite after every Pod Go code change — zero Helix test failures
- [ ] **Block routing:** Load the Pod Go preset on real hardware and confirm all effects (delay, reverb, modulation) are present and active, not just amp and cab
- [ ] **File type routing:** Generate a Helix LT preset after adding Pod Go support — confirm it still downloads as `.hlx` with correct Helix device ID

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong schema/device ID causes all Pod Go imports to fail | LOW | Correct the `schema` and `data.device` fields in `buildPgpFile()` from empirical inspection; redeploy |
| Pod Go-unavailable model ID passes validation and causes "unrecognized models" | LOW | Add model ID to `POD_GO_EXCLUDED_IDS`; update system prompt model list; redeploy |
| DSP1 blocks appear in Pod Go presets | LOW | Add `dsp: 0` assertion to Pod Go chain-rules; re-assign all blocks before building |
| 8 snapshots emitted for Pod Go (should be 4) | LOW | Add `assert(spec.snapshots.length <= 4)` to `buildPgpFile()`; trim planner output at generation time |
| Pod Go code path changes break Helix output | MEDIUM | Revert the shared module change; move the Pod Go logic to a separate `src/lib/pod-go/` file; verify Helix tests pass |
| Wrong firmware constants cause Pod Go Edit version mismatch | LOW | Inspect real `.pgp` export for correct `device_version` and `appversion` values; update `pod-go/config.ts` |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: Wrong file format (.hlx instead of .pgp) | Phase 1 — Pod Go Format Foundation | Import generated `.pgp` into Pod Go Edit; no "target incompatible" error |
| Pitfall 2: Two DSP paths in Pod Go preset | Phase 1 — Pod Go Format Foundation | Inspect generated JSON: all blocks have `dsp: 0`; post-cab effects present |
| Pitfall 3: Helix-only model IDs in Pod Go spec | Phase 1 — Pod Go Format Foundation | Validate with `POD_GO_EXCLUDED_IDS` set; confirm no Tone Sovereign/Clawthorn/Cosmos Echo in output |
| Pitfall 4: Shared validator applies Helix rules to Pod Go | Phase 1 — Pod Go Format Foundation | Pass `device` through pipeline; Pod Go-specific block count and ID rules enforced |
| Pitfall 5: Helix code path contamination | Phase 1 — Pod Go Format Foundation | `src/lib/pod-go/` directory exists; zero `device === "pod_go"` checks in `src/lib/helix/` files |
| Pitfall 6: 8 snapshots for a 4-snapshot device | Phase 1 — Pod Go Format Foundation | Pod Go Edit shows exactly 4 snapshots; `buildPgpFile()` asserts `<= 4` |
| Pitfall 7: Wrong firmware version constants | Phase 1 — Pod Go Format Foundation | `.pgp` `build_sha` does not say "v3.70"; matches Pod Go 2.0 values from real export |
| Pitfall 8: Free block positioning in fixed-slot device | Phase 2 — Pod Go Knowledge Layer | Load preset on hardware; all effects appear in correct signal chain positions |
| Pitfall 9: Snapshot parameter overrides not recognized | Phase 2 — Pod Go Knowledge Layer | Hardware test: Clean vs Lead snapshots have audibly different volumes |
| Pitfall 10: AI generates DSP1 assignments for Pod Go | Phase 1 (system prompt) + Phase 2 (chain-rules enforcement) | Generated spec has zero `dsp: 1` block assignments |
| Pitfall 11: AI model list includes Pod Go-unavailable models | Phase 1 — Pod Go Format Foundation | System prompt model list for Pod Go excludes the 3 unavailable models |
| Pitfall 12: Firmware version targeting | Phase 1 — Pod Go Format Foundation | UI displays "Requires Pod Go firmware 2.0+" note; config targets FW 2.0 constants |

---

## Sources

**Line 6 Official Documentation (HIGH confidence):**
- [Line 6 POD Go FAQ — Official KB](https://kb.line6.com/kb/live/pod-go-faq) — Confirms exactly 3 unsupported models (Tone Sovereign, Clawthorn Drive, Cosmos Echo) omitted due to DSP size
- [POD Go 2.0 Release Notes](https://line6.com/support/page/kb/pod/pod-go/pod-go-20-r1058/) — 33 new cabs, 6 new amps, 7 new effects added in November 2023; mandatory factory reset after update
- [Line 6 POD Go Product Page](https://line6.com/podgo/) — Single DSP, single signal path confirmed

**Line 6 Community Forums (MEDIUM confidence — community-verified behavior):**
- [How to load a Helix Preset into PodGo?](https://line6.com/support/topic/55303-how-to-load-a-helix-preset-into-podgo/) — Confirms format incompatibility, "incompatible device error," parameter encoding differences (fractions vs percentages)
- [Convert PodGo Patches to Helix? (.pgp to .hlx)](https://line6.com/support/topic/63937-convert-podgo-patches-to-helix-pgp-to-hlx/) — Manual recreation required; no automatic converter available
- [Pod Go / Helix Converter thread](https://line6.com/support/topic/64226-pod-gohelix-converter/) — Confirms architectural format differences; "tons of issues to solve"; format document exists in community but not public
- [File formats, custom tools and API](https://line6.com/support/topic/63502-fileformats-custom-tools-and-api/) — `.pgp` is "simple JSON"; `@fs_enabled`, `@fs_index`, `@ledcolor` fields confirmed present; **single-path (dsp0 only) confirmed explicitly** — "The POD Go variant differs because it features only one signal path (dsp0), whereas Helix supports dual paths (dsp0 and dsp1)"
- [POD Go Block Restrictions](https://line6.com/support/topic/62007-pod-go-block-restrictions/) — 6 fixed blocks (Volume, Wah, Amp, Cab/IR, FX Loop, EQ) + 4 freely configurable slots confirmed
- [AI generation of presets](https://line6.com/support/topic/70120-ai-generation-of-presets/) — ChatGPT-generated `.pgp` files receive "target is incompatible" error; "format is inaccurate and incomplete"

**Multi-Source Hardware Comparison (HIGH confidence — consistent across sources):**
- Pod Go has single DSP, single path — confirmed by Line 6 official, community forums, hardware reviews
- Pod Go has 4 snapshots (not 8 like Helix) — confirmed by official owner's manual and community
- Pod Go only allows one amp block and one cab/IR per preset — confirmed by multiple community sources
- Three models missing from Pod Go vs Helix HX: Tone Sovereign, Clawthorn Drive, Cosmos Echo — confirmed by official Line 6 FAQ

**Empirical Research Required (NOT resolvable from web sources):**
- Exact `.pgp` JSON field names (`schema` value, `version` integer, `data.device` integer for Pod Go vs Pod Go Wireless)
- Pod Go firmware 2.0 `appversion` and `device_version` integer constants
- Exact snapshot key format in `.pgp` files (`snapshot0`-`snapshot3` only, or different naming)
- Whether Pod Go controller section JSON uses same `@controller: 19` pattern as Helix for snapshot parameter overrides
- Pod Go block slot JSON key names and their fixed positions in the single DSP path
- Exact `HD2_` model IDs for the three excluded models (Tone Sovereign, Clawthorn Drive, Cosmos Echo) — must match the strings in `models.ts`

---

## The Core Risk: Silent Success

The most dangerous failure mode for Pod Go support is not a crash or a visible error — it is a preset that generates without errors, downloads successfully, but cannot be imported into Pod Go Edit. The user sees a working UI and a downloaded file, but the file is unusable. Every one of the format pitfalls above (wrong schema, wrong device ID, wrong firmware constants, wrong DSP structure, wrong snapshot count) produces this exact failure mode.

**The mitigation strategy:** Before writing any Pod Go builder code, export 2-3 presets from Pod Go Edit, inspect their JSON structure, and confirm the values for `schema`, `version`, `data.device`, `data.device_version`, `meta.build_sha`, and `meta.appversion`. This empirical inspection is the single most important pre-coding step for Pod Go support — without it, every line of `buildPgpFile()` is a guess that will fail silently on import.

---

*Pitfalls research for: Adding Line 6 Pod Go preset generation to HelixAI*
*Researched: 2026-03-02*
