# Architecture Audit v4.0

**Auditor:** Phase 58 executor (Claude Sonnet 4.6)
**Date:** 2026-03-05
**Phases completed before this audit:** 52, 53, 54, 55, 56, 57

---

## 1. Audit Scope

### Devices Audited (6)

| Device | File Format | Builder File |
|--------|-------------|--------------|
| Helix LT | .hlx | `preset-builder.ts` |
| Helix Floor | .hlx | `preset-builder.ts` (shared with LT) |
| Pod Go | .pgp | `podgo-builder.ts` |
| Helix Stadium | .hsp | `stadium-builder.ts` |
| HX Stomp | .hlx | `stomp-builder.ts` |
| HX Stomp XL | .hlx | `stomp-builder.ts` (shared with Stomp) |

### Shared Knowledge Layer Files

| File | Purpose |
|------|---------|
| `chain-rules.ts` | Signal chain assembly — DSP assignment, block ordering, mandatory block insertion |
| `param-engine.ts` | Parameter resolution — 4-layer amp strategy, category defaults, model lookups |
| `snapshot-engine.ts` | Snapshot generation — per-block bypass states, volume controller assignments |
| `validate.ts` | PresetSpec validation — model ID whitelist, device-specific block limits |

### Supporting Infrastructure

| File | Purpose |
|------|---------|
| `types.ts` | `DeviceTarget` union, guard functions, `BlockSpec`/`PresetSpec` interfaces, `AmpFamily`/`AmpCategory` types |
| `config.ts` | Device constants: `FIRMWARE_CONFIG`, `POD_GO_FIRMWARE_CONFIG`, `STADIUM_CONFIG`, `STOMP_CONFIG` |
| `models.ts` | `HelixModel` interface; catalogs: `AMP_MODELS`, `STADIUM_AMPS`, `CAB_MODELS`, effect catalogs, `STADIUM_EQ_MODELS` |
| `index.ts` | Barrel exports — public surface of the `helix` subsystem |

---

## 2. What Works Well

### Strength 1: DeviceTarget union + TypeScript exhaustiveness on switch statements

`types.ts` line 188 defines the complete device union:
```typescript
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium" | "helix_stomp" | "helix_stomp_xl";
```

Any switch statement on `DeviceTarget` that lacks a default case will produce a TypeScript compiler error if a new device value is added to the union. The `DEVICE_IDS` constant (`types.ts` lines 192-199) uses `Record<DeviceTarget, number>` — adding a 7th device to the union immediately surfaces an unhandled key here as a compiler error. This was the Phase 32 strategy and it works.

### Strength 2: Self-contained builder files

`stadium-builder.ts`, `podgo-builder.ts`, and `stomp-builder.ts` do not import from each other and do not import from `preset-builder.ts`. Each builder owns its file format independently. The imports in `stadium-builder.ts` (lines 15-17) touch only `types.ts` and `config.ts` — no cross-builder dependencies. This containment means a Stadium format bug cannot silently regress Helix LT/Floor output, and vice versa. Phase 53's 5 bug fixes confirm this: all changes were localized to `stadium-builder.ts` and `param-engine.ts` (device-guarded addition only).

### Strength 3: Strict device-aware catalog lookup — no cross-device fallback

`chain-rules.ts` lines 267-273:
```typescript
const ampModel = stadium
  ? STADIUM_AMPS[intent.ampName]
  : AMP_MODELS[intent.ampName];
if (!ampModel) {
  throw new Error(
    `Unknown amp model: "${intent.ampName}". Model name must exactly match a key in ${stadium ? "STADIUM_AMPS" : "AMP_MODELS"}.`
  );
}
```

Stadium amps (Agoura_* IDs) and non-Stadium amps (HD2_* IDs) live in completely separate catalogs. An Agoura_ model name passed to a Helix LT builder will throw at the `AMP_MODELS[intent.ampName]` lookup — it will never silently pass an Agoura model ID into an .hlx file. This is the correct anti-cross-device-fallback pattern.

### Strength 4: HelixModel interface as shared schema across all device catalogs

`models.ts` lines 7-19 define `HelixModel` — the single interface for all model metadata, used by `AMP_MODELS`, `STADIUM_AMPS`, `CAB_MODELS`, and all effect catalogs. Behavioral differences between devices live in builder files, not in model metadata. The `stadiumOnly?: boolean` field (`models.ts` line 19) marks Agoura_* models as Stadium-exclusive without duplicating the schema. This is the correct abstraction level.

### Strength 5: Config constants grouped by device

`config.ts` defines four separate named config objects:
- `FIRMWARE_CONFIG` (lines 6-13) — Helix LT/Floor firmware version constants
- `POD_GO_FIRMWARE_CONFIG` (lines 20-31) — Pod Go firmware version constants
- `STADIUM_CONFIG` (lines 42-53) — Stadium device version, block limits, max snapshots, magic header
- `STOMP_CONFIG` (lines 61-78) — Stomp/StompXL block limits, snapshot counts, I/O model constants

Changing a Stadium constant cannot accidentally affect Helix LT/Floor constants. Adding a 7th device requires adding a new config object — it is additive, not invasive.

### Strength 6: STOMP I/O model IDs already promoted to config constants

`config.ts` lines 71-76 show that HX Stomp I/O model IDs are already named constants in `STOMP_CONFIG`:
```typescript
STOMP_INPUT_MODEL: "HelixStomp_AppDSPFlowInput",
STOMP_OUTPUT_MAIN_MODEL: "HelixStomp_AppDSPFlowOutputMain",
STOMP_OUTPUT_SEND_MODEL: "HelixStomp_AppDSPFlowOutputSend",
```

This is the correct pattern. The equivalent improvement for Stadium is pending (see Fragility 2 and Improvement A).

---

## 3. Fragility Points

### Fragility 1: Guard-based branching — no exhaustiveness on device parameters

In `assembleSignalChain(intent, device?)` (`chain-rules.ts` lines 259-565) and `resolveParameters(chain, intent, device?)` (`param-engine.ts` lines 275-317), the `device` parameter is optional and branching uses boolean guards, not a switch.

Pattern (`chain-rules.ts` lines 260-262):
```typescript
const podGo = device ? isPodGo(device) : false;
const stadium = device ? isStadium(device) : false;
const stomp = device ? isStomp(device) : false;
```

This guard pattern appears at approximately 10 branch sites in `chain-rules.ts` (lines 167-171, 287-288, 327-336, 338-346, 395-405, 407-417, 480-535) and at ~2-3 sites in `param-engine.ts` (lines 281-283, 426). When a 7th device is added:

- TypeScript will **not** produce a compiler error pointing to these functions
- The developer must manually search every `isPodGo()`, `isStadium()`, `isStomp()` call and determine whether a new branch is needed
- There is no single registration point and no type-level enforcement of completeness

This is manageable at 6 devices. It becomes a maintenance liability at 8+ devices.

**Branch sites in validate.ts**: Lines 70-72 (guard variables), lines 139-196 (4 device-conditional branches). Total guard sites across Knowledge Layer: ~17.

### Fragility 2: Stadium I/O model IDs are hardcoded string literals in stadium-builder.ts

`stadium-builder.ts` lines 23-25:
```typescript
const STADIUM_INPUT_MODEL = "P35_InputInst1";
const STADIUM_INPUT_NONE_MODEL = "P35_InputNone";
const STADIUM_OUTPUT_MODEL = "P35_OutputMatrix";
```

These three constants are module-private — they are not imported from `config.ts` (where the analogous `STOMP_INPUT_MODEL` etc. already live). The same IDs also appear as hardcoded string literals in `validate.ts` lines 23-25:
```typescript
ids.add("P35_InputInst1");
ids.add("P35_InputNone");
ids.add("P35_OutputMatrix");
```

Two files own the same knowledge with no shared constant. If a Stadium firmware update changes an I/O model ID, both `stadium-builder.ts` and `validate.ts` must be updated manually — the connection is invisible to TypeScript. The STOMP equivalent has already been fixed (see Strength 6); Stadium has not.

### Fragility 3: MODEL_LOOKUPS in param-engine.ts does not include STADIUM_AMPS

`param-engine.ts` lines 228-241:
```typescript
const MODEL_LOOKUPS: Record<string, Record<string, HelixModel>> = {
  delay: DELAY_MODELS,
  reverb: REVERB_MODELS,
  ...
  amp: AMP_MODELS,    // <-- AMP_MODELS only; STADIUM_AMPS absent
  cab: CAB_MODELS,
};
```

`resolveAmpParams()` (`param-engine.ts` lines 368-369) compensates correctly:
```typescript
const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
```

However, `findModel()` (`param-engine.ts` lines 246-258) — used by `resolveDefaultParams()` for all non-amp/cab block types — does not include STADIUM_AMPS. If a Stadium amp block ever reaches `findModel()` (currently prevented by the routing in `resolveBlockParams()`), it will silently return `undefined` and fall back to `block.parameters` (empty `{}`), producing a block with no parameters. No TypeScript error, no runtime error — silent quality degradation.

The risk is currently harmless because `resolveBlockParams()` routes amp blocks to `resolveAmpParams()` before `findModel()` is called. The gap is invisible and could become active if the routing logic changes.

### Fragility 4: Hardcoded distortion model IDs in param-engine.ts

`param-engine.ts` lines 445 and 452:
```typescript
if (block.modelId === "HD2_DistMinotaur") {
if (block.modelId === "HD2_DistScream808") {
```

These string literals are not imported from `models.ts` constants (e.g., `DISTORTION_MODELS["Minotaur"]!.id`). If the Minotaur or Scream 808 model IDs change across a firmware update, `param-engine.ts` will silently use wrong parameters. The fix is trivial — a one-line import — but the coupling is currently invisible to TypeScript.

A similar pattern appears at `param-engine.ts` line 491 (`"HD2_GateHorizonGate"`) and line 504 (`"HD2_VolPanGain"`). All four are subject to the same fragility.

### Fragility 5: Sequential flowPos counter vs. slot-grid (fixed in Phase 53, but revealing)

The original `stadium-builder.ts` used a sequential `flowPos` counter that incremented for every block — producing keys like b01, b02, b03 regardless of the block's logical role. Real .hsp files require slot-grid allocation: amp always at b05/position:5, cab always at b06/position:6, input fixed at b00, output fixed at b13.

**Phase 53 fixed this** by introducing `STADIUM_SLOT_ALLOCATION` (`stadium-builder.ts` lines 42-57). The fix is complete and verified. However, this fragility is documented because it reveals a systemic issue: the comment block at the top of `stadium-builder.ts` accurately documented the slot-based format, but the implementation used a sequential counter anyway. This is not a code smell — it is evidence that format knowledge cannot be verified by code review alone. The 5 confirmed format bugs were only discovered by comparing generated output against real .hsp files (Phase 52-53 corpus inspection).

**Lesson:** Builder correctness requires hardware verification, not just code review. This holds for all 6 devices.

---

## 4. Concrete Improvements

| ID | Improvement | File(s) | Scope | Effort | Priority | Timing |
|----|-------------|---------|-------|--------|----------|--------|
| A | Move Stadium I/O model IDs from `stadium-builder.ts` + `validate.ts` string literals to named constants in `STADIUM_CONFIG` | `config.ts`, `stadium-builder.ts`, `validate.ts` | Add 3 constants to `STADIUM_CONFIG`; replace 6 string literals | ~30 min | **High** | Future maintenance phase |
| B | Replace hardcoded distortion/gate/volume model IDs in `param-engine.ts` with constant references from `models.ts` | `param-engine.ts` | Replace 4 string literals with `DISTORTION_MODELS["Minotaur"]!.id` etc. | ~15 min | **Medium** | Future maintenance phase |
| C | Add `STADIUM_AMPS` to `MODEL_LOOKUPS` in `param-engine.ts` with device-aware routing in `findModel()` | `param-engine.ts` | Extend `MODEL_LOOKUPS`; thread `device` to `findModel()` or add Stadium-conditional path | ~1 hr | **Low** | Future maintenance phase (closes invisible gap) |
| D | Replace guard-based branching with a `DeviceCapabilities` registry | `chain-rules.ts`, `param-engine.ts`, `validate.ts` | Define capability interface; replace ~17 guard sites with lookup | 3-4 hrs + regression test | **Defer** | When 7th device is planned |

**Improvements A and B are zero-risk:** they replace string literals with typed constant references, with zero functional change. A directly addresses Fragility 2; B directly addresses Fragility 4.

**Improvement C closes the invisible gap** documented in Fragility 3. It requires threading a device parameter into `findModel()` or adding a Stadium-conditional lookup path — a small structural change to `param-engine.ts` that warrants a 6-device regression test run.

**Improvement D (capability registry) is deliberately deferred** until a 7th device is planned. See Section 6.

---

## 5. Stadium Rebuild Discoveries

Phases 52 and 53 were completed before this audit. Both Summary documents exist and were read during audit preparation.

### What Phase 52 Revealed (Stadium Amp Catalog)

Phase 52 corrected `STADIUM_DEVICE_VERSION` from 285213946 (wrong — from an earlier manual approximation) to 301990015 (confirmed from Agoura_Bassman.hsp and Agoura_Hiwatt.hsp real .hsp files). This is a correctness error: a wrong `device_version` value in the .hsp meta block would cause HX Edit to reject the import.

**Implication for architecture:** The `STADIUM_DEVICE_VERSION` field is a constant that must be sourced from real device files — it cannot be inferred from other constants. There is no structural mechanism that would have caught this error before Phase 52 ran corpus inspection. This is acceptable — the config constant pattern (`STADIUM_CONFIG`) puts this value in the right place; it just needed correction. The pattern is sound; the value was wrong.

### What Phase 53 Revealed (Stadium Builder Format Bugs)

Phase 53 identified and fixed 5 confirmed format bugs in `stadium-builder.ts`. All 5 were discovered by field-by-field comparison against real .hsp files, not by code review:

1. **Param encoding bug (STAD-03):** Slot params used `{ "access": "enabled", "value": X }` — real .hsp files use `{ "value": X }` only. Zero occurrences of "access" in any real .hsp file. This was an invisible API assumption error — the `access` field format was plausible but wrong.

2. **Sequential flowPos counter (STAD-04):** The original builder assigned block positions sequentially (b01, b02, b03...) rather than using the firmware-required slot grid (amp at b05, cab at b06, input at b00, output at b13). Fixed by introducing `STADIUM_SLOT_ALLOCATION` constant.

3. **Effect type mapping (STAD-05):** All effect blocks must use `type: "fx"` in real .hsp files. The original builder mapped block types from `BlockSpec.type` directly (e.g., "distortion", "delay"). Fixed by introducing `getStadiumBlockType()` exhaustive switch.

4. **Cab parameter completeness (STAD-06):** Stadium .hsp cab blocks require 10 parameters (5 from `.hlx` + 5 Stadium-specific: Delay, IrData, Level, Pan, Position). The original builder only set 5. Fixed by adding Stadium-conditional extension in `resolveCabParams()` in `param-engine.ts`.

5. **Missing cursor field (STAD-07 precursor):** Real .hsp files always include a `cursor: { flow, path, position }` field at the preset level. The original builder omitted it. Fixed by adding cursor to `StadiumPreset` interface and `buildStadiumPreset()`.

**Architectural lesson from Phase 53:** All 5 bugs stemmed from implementing `stadium-builder.ts` by analogy to `preset-builder.ts` rather than from direct inspection of real .hsp files. The architecture correctly isolates Stadium to `stadium-builder.ts` — the bugs were contained there and could not affect LT/Floor output. The abstraction model worked. The failure was in the implementation method, not the architecture.

**No shared Knowledge Layer issues were revealed.** The `chain-rules.ts` and `param-engine.ts` changes required by Phase 53 were additive and device-guarded (cab param extension via `isStadium()` check). No existing multi-device logic was altered.

### HX Edit Import Verification Status

Phase 53 Plan 02 completed automated structural tests (185/185 green) and reached a checkpoint for hardware HX Edit import verification. As of audit date (2026-03-05), the human verification checkpoint status is pending — the `53-02-SUMMARY.md` notes this task was "at checkpoint awaiting human confirmation." The automated structural tests against the Agoura_Bassman.hsp reference pass, providing high confidence in format correctness.

---

## 6. Refactor Decision

**Decision: DEFER structural refactor. Implement Improvements A and B only in a future maintenance phase.**

### Rationale

1. **Guard-based branching is transparent and well-tested at 6 devices.** The ~17 guard sites in `chain-rules.ts`, `param-engine.ts`, and `validate.ts` are searchable by any editor. The `isPodGo()`, `isStadium()`, `isStomp()` functions are named, single-purpose, and present in the codebase since Phase 32. The test suite covers all 6 devices. This pattern has not caused a production bug.

2. **Phase 53 touched chain-rules.ts and param-engine.ts for functional changes.** Doing a structural refactor simultaneously with Stadium format correctness work multiplies regression risk. The Stadium track (Phases 52-53-54) required carefully guarded additions to the Knowledge Layer. A capability registry refactor during this period would have made bug attribution impossible.

3. **User-visible value of the refactor is zero.** The capability registry (Improvement D) is a maintenance investment — it does not change what presets are generated or improve tone quality. The correct time to make this investment is when the maintenance cost of the current pattern is actively felt, not as preemptive architecture.

4. **A 7th device is not yet planned.** The primary motivation for Improvement D is to make adding the Nth device to the Knowledge Layer require a single registration rather than a search of 17 guard sites. This is a real benefit at N=7 and essential at N=8. Neither is currently planned in the roadmap.

5. **Improvements A and B are low-effort, zero-risk, and immediately available.** They replace string literals with typed constant references. They can be implemented in ~45 minutes in a future maintenance phase with zero regression risk. There is no reason to bundle them into a larger structural refactor.

### When to Revisit

Revisit Improvement D when:
- A 7th device is added to the roadmap, OR
- A production bug is traced back to a missed guard site, OR
- Developer velocity on Knowledge Layer changes degrades noticeably due to guard complexity

**Recorded in:** `.planning/PROJECT.md` Key Decisions (Phase 58, 2026-03-05)

---

## 7. Open Questions for Future Devices

1. **At what device count does the capability registry (Improvement D) become justified?** Guard complexity at 6 devices is ~17 sites. At 8-10 devices with meaningful behavioral differences, a capability registry would clearly pay for itself. At 7 devices with a single new guard type, it is marginal.

2. **Should snapshot-engine.ts receive a device parameter?** `snapshot-engine.ts` currently generates snapshots without device awareness — it uses `spec.snapshots.length` and produces output compatible with all devices. Phase 57 (FX-04, snapshot ChVol delta logic) did not require a device parameter. This remains an open question for future phases involving device-specific snapshot behavior.

3. **Helix Floor vs. LT: verified identical treatment.** Both use `preset-builder.ts` and the same .hlx format. `DEVICE_IDS` distinguishes them; `isHelix()` returns true for both. `types.ts` lines 202-204 confirm `isHelix()` treats both identically. No Knowledge Layer behavior differs between LT and Floor — they share all chain rules, params, and validation. This is correct.
