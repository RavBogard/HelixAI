# Project Research Summary

**Project:** HelixAI v1.2 — Pod Go Device Support
**Domain:** Line 6 Pod Go preset generation (.pgp files) added to existing Helix preset generator
**Researched:** 2026-03-02
**Confidence:** MEDIUM-HIGH (hardware constraints HIGH; .pgp file format confirmed via 18 real file inspections; effect model catalog partially confirmed)

## Executive Summary

HelixAI v1.2 adds Pod Go as a third device target alongside Helix LT and Helix Floor. Pod Go is a simpler device — single DSP chip, serial-only signal chain, 10 blocks (6 fixed + 4 user-assignable), 4 snapshots, and a `.pgp` file format that is structurally similar to `.hlx` but differs in dozens of specific field values. The Feature research inspected 18 real `.pgp` files and identified critical differences: effect model IDs require Mono/Stereo suffixes (`HD2_DistScream808Mono` not `HD2_DistScream808`), block `@type` values are completely remapped (delay=5 not 7, modulation=0 not 4), input/output keys are `input`/`output` not `inputA`/`outputA`, the snapshot controller number is 4 not 19, and the device ID is 2162695. These are not optional tweaks — getting any one wrong produces a file that Pod Go Edit silently rejects.

The recommended approach is to extend the existing Planner-Executor architecture by keeping the AI layer (planner.ts, ToneIntent) and middle Knowledge Layer (param-engine.ts, snapshot-engine.ts) shared, while creating a new `podgo-builder.ts` for file generation and adapting `chain-rules.ts` with device-aware constraints. No new npm packages are needed. The entire milestone is pure TypeScript data transformation within `src/lib/helix/`. The Architecture research recommends sharing chain-rules with a `deviceTarget` parameter (minimizes duplication), while Pitfalls research warns against contaminating Helix code paths. The resolution: share chain-rules.ts with a `deviceTarget` parameter for constraint checks, keep the builder and validator as separate functions, and run the existing 50-test Helix suite after every change.

The single highest risk is "silent success" — a preset that generates without errors, downloads successfully, but cannot be imported into Pod Go Edit. Every format pitfall (wrong device ID, wrong @type values, wrong model IDs, wrong snapshot count) produces this exact failure mode with no useful diagnostic. The mitigation is strong: the Feature researcher inspected 18 real `.pgp` files and documented exact field values. The remaining risk is in the completeness of the Pod Go effect model catalog — only ~30 of 206+ effects have confirmed Mono/Stereo suffixed IDs from real files.

## Key Findings

### Recommended Stack

No new dependencies. Pod Go support is implemented entirely with the existing stack (TypeScript, Zod, Vitest, Next.js). All changes are pure TypeScript in `src/lib/helix/` plus a new `podgo-builder.ts`. The only external tool needed is POD Go Edit 2.50 (free download from Line 6) for validating generated `.pgp` files.

**Core technologies (all existing):**
- **TypeScript 5.x**: Pod Go model registry, chain rules, preset builder — pure data transformation
- **Zod 4.x**: Add `"pod_go"` to `DeviceTarget` enum in ToneIntentSchema
- **Vitest 3.x**: Unit tests for Pod Go chain-rules and preset-builder (same patterns as Helix tests)

### Expected Features

**Must have (table stakes — file will not load without these):**
- Valid `.pgp` file with device ID 2162695, correct `device_version`, `P34_AppDSPFlow*` I/O models
- Effect model IDs with Mono/Stereo suffixes (cannot reuse Helix effect IDs directly)
- Correct `@type` values for all block categories (complete remap from Helix values)
- Series-only signal chain — all blocks on dsp0, `dsp1: {}` always empty
- Exactly 4 snapshots (snapshot0-snapshot3) with `@controller: 4` for snapshot recall
- `input`/`output` keys (not `inputA`/`outputA`), no `@path` or `@stereo` on blocks
- No `@topology` fields in global section; `@model: "@global_params"` present
- Cab placed as a numbered block in the chain (not as separate `cab0` key like Helix)
- Footswitch section with `@fs_*` metadata per block
- `.pgp` file extension on download

**Should have (differentiators):**
- Pod Go-specific model catalog with all 86 amps and 206+ effects at correct suffixed IDs
- DSP-awareness heuristics in chain-rules (avoid heavy effect combos)
- Pod Go context in UI (device label on tone card, 4-snapshot display, firmware version note)

**Defer (v2+):**
- Pod Go Wireless as separate device target (same format, display name only)
- Stomp mode footswitch layout optimization (musical logic-based FS assignment)
- Live DSP budget calculation (no official DSP cost table from Line 6)

See `.planning/research/FEATURES.md` for full prioritization matrix, feature dependency graph, and detailed `.pgp` format specification.

### Architecture Approach

The Planner-Executor separation is preserved. ToneIntent remains device-agnostic — the AI selects amps/effects by name, the Knowledge Layer handles device-specific formatting. Device context flows as a `deviceTarget` parameter through `route.ts` into `assembleSignalChain()` and the device-specific builder. The core pipeline is: shared planner (device-filtered model list) -> shared chain-rules (device-aware limits) -> shared param-engine (unchanged) -> shared snapshot-engine (unchanged) -> device-specific validator -> device-specific builder.

**Major components:**
1. **podgo-builder.ts** (NEW) — Emits valid `.pgp` JSON with all Pod Go-specific field values, cab-as-block, 4 snapshots, footswitch section
2. **chain-rules.ts** (MODIFIED) — Accepts `deviceTarget` parameter; Pod Go path forces dsp:0, enforces 4-effect limit, skips Parametric EQ and Gain Block insertion
3. **models.ts** (EXTENDED) — `devices?: DeviceTarget[]` flag per model; `getModelsForDevice()` helper; Pod Go effect IDs with Mono/Stereo suffixes
4. **types.ts** (EXTENDED) — `DeviceTarget` union adds `pod_go`; `PgpFile`, `PodGoTone` interfaces; `DEVICE_IDS` with pod_go: 2162695
5. **validate.ts** (EXTENDED) — New `validatePodGoPresetSpec()` function with Pod Go-specific rules
6. **planner.ts** (MODIFIED) — Passes device-filtered model list to AI prompt; system prompt says "Pod Go preset"

See `.planning/research/ARCHITECTURE.md` for complete data flow diagram, system overview, and build order dependency graph.

### Critical Pitfalls

1. **Wrong file format / device ID** — Using `buildHlxFile()` for Pod Go produces "target is incompatible" errors with no useful diagnostic. Must use a separate `buildPgpFile()` with device=2162695, `.pgp` extension, and Pod Go-specific JSON structure. Every field difference matters.

2. **Helix effect model IDs in Pod Go files** — Pod Go effects require Mono/Stereo suffixes (`HD2_DistScream808Mono` not `HD2_DistScream808`). Using unsuffixed Helix IDs produces "unrecognized model" failures. Amp IDs ARE shared. This is the highest-complexity table-stakes feature.

3. **Wrong @type block encoding** — Pod Go @type values are completely different from Helix (delay=5 not 7, modulation=0 not 4, reverb=5 not 7, EQ_STATIC=6 not 0). Using Helix @type values produces unrecognizable blocks.

4. **Dual-DSP assumption in chain-rules** — Existing chain-rules split across dsp0/dsp1. Pod Go is single-DSP. All blocks must be assigned dsp:0; any dsp:1 blocks are silently lost, producing presets with missing effects.

5. **Helix code path contamination** — Adding `if (device === "pod_go")` branches throughout shared modules risks Helix regressions in the existing 50-test suite. Builder and validator must be separate functions; shared modules accept `deviceTarget` parameter.

See `.planning/research/PITFALLS.md` for all 12 pitfalls with full prevention strategies, phase mapping, and "looks done but isn't" verification checklist.

### Cross-File Conflicts and Resolutions

| Conflict | Resolution |
|----------|------------|
| STACK.md says model IDs are the same HD2_ subset; FEATURES.md says effects need Mono/Stereo suffix | **FEATURES.md is correct** (based on 18 real files). Effect model IDs ARE different. Amp IDs are shared. |
| STACK.md says Pod Go uses `@topology0: "A"`; FEATURES.md says no @topology fields exist at all | **FEATURES.md is correct** (empirical from real files). Omit @topology entirely. |
| STACK.md says device ID needs verification; FEATURES.md says 2162695 | **FEATURES.md is correct**. Device ID is 2162695 (verified from real files). |
| STACK.md recommends mirror `src/lib/podgo/` directory; ARCHITECTURE.md recommends `podgo-builder.ts` in `src/lib/helix/` | **ARCHITECTURE.md approach is better** — single directory avoids import path sprawl; devices share the same HD2 engine and types. |
| ARCHITECTURE.md says snapshot controller is probably `@controller: 19` (same as Helix, unconfirmed); FEATURES.md says `@controller: 4` | **FEATURES.md is correct** (verified from 18 real files). Pod Go snapshot controller is 4, not 19. |

## Implications for Roadmap

### Phase 1: Format Foundation and Types
**Rationale:** Nothing works without correct types and format constants. Zero-risk, zero-dependency foundation.
**Delivers:** `DeviceTarget` extended with `pod_go`, `PgpFile`/`PodGoTone` interfaces, `DEVICE_IDS` with pod_go: 2162695, Pod Go firmware constants (`device_version`, `appversion`, `build_sha`), `BLOCK_TYPES_PODGO` constant map with all remapped @type values.
**Addresses:** Device ID (table stakes), firmware version constants, type safety for all downstream code.
**Avoids:** Pitfall 1 (wrong file format), Pitfall 7 (wrong firmware constants).

### Phase 2: Pod Go Model Catalog
**Rationale:** The model catalog is the highest-complexity dependency. Chain-rules and builder both need it. Must come before any preset generation logic.
**Delivers:** Pod Go effect model IDs with Mono/Stereo suffixes, `devices` flag on `HelixModel` interface, `getModelsForDevice("pod_go")` helper, Pod Go-excluded model list (Tone Sovereign, Clawthorn Drive, Cosmos Echo, Poly Pitch, Space Echo), device-filtered `getModelListForPrompt()`.
**Addresses:** Effect model ID correctness (table stakes, HIGH complexity), model filtering for AI prompt.
**Avoids:** Pitfall 3 (Helix-only model IDs), Pitfall 11 (AI offered unavailable models).

### Phase 3: Chain Rules, Validation, and Planner Adaptation
**Rationale:** With types and models in place, chain assembly can enforce Pod Go constraints. Planner prompt must be device-aware to avoid generating dsp:1 assignments.
**Delivers:** Device-aware `assembleSignalChain()` (all blocks dsp:0, 4-effect limit, no Parametric EQ or Gain Block insertion for Pod Go), `validatePodGoPresetSpec()`, device-filtered system prompt in `callClaudePlanner()`.
**Addresses:** Series-only chain (table stakes), block limit enforcement, planner prompt filtering.
**Avoids:** Pitfall 2 (dual-DSP assumption), Pitfall 4 (shared validator with Helix rules), Pitfall 8 (free block positioning), Pitfall 10 (AI generates dsp:1).

### Phase 4: Pod Go Preset Builder
**Rationale:** The builder is the final output stage. It depends on types, models, and chain-rules all being correct. This is where format correctness is realized.
**Delivers:** `buildPgpFile()` producing valid `.pgp` JSON — correct device ID, `input`/`output` keys, `P34_AppDSPFlow*` I/O models, cab-as-block placement, 4 snapshots with `@controller: 4`, footswitch section with `@fs_*` metadata, no @topology/@path/@stereo fields, `dsp1: {}` empty.
**Addresses:** All remaining table-stakes features (file generation, snapshot encoding, footswitch section, cab placement).
**Avoids:** Pitfall 1 (wrong format), Pitfall 5 (code contamination — separate function), Pitfall 6 (8 snapshots), Pitfall 9 (snapshot controller encoding).

### Phase 5: Integration, UI, and Testing
**Rationale:** Wiring phase. All Pod Go logic exists; now connect to API route and frontend, then validate end-to-end.
**Delivers:** Device routing in `route.ts`, Pod Go option in device selector, `.pgp` download with correct extension, device-filtered AI prompt in action, Pod Go label on tone card, firmware version note, regression test suite passing, end-to-end validation in Pod Go Edit.
**Addresses:** Device selector UI, `.pgp` download, AI prompt filtering, regression testing, hardware validation.
**Avoids:** UX pitfalls (wrong extension label, missing firmware note, 8-snapshot display for 4-snapshot device).

### Phase Ordering Rationale

- **Types before models before chain-rules before builder** — strict dependency chain. Each layer depends on the one below it.
- **Models isolated into Phase 2** — the effect model catalog with Mono/Stereo suffixes is the highest-risk, highest-effort task. Isolating it allows focused testing and validation before chain logic is built on top.
- **Chain-rules and planner together in Phase 3** — the planner must know the device to filter models; chain-rules must know the device to enforce limits. These are coupled and should be tested together.
- **Builder in Phase 4** — independently testable (generate .pgp, inspect in text editor, import into Pod Go Edit) before wiring into the API route.
- **Integration last** — route.ts and page.tsx changes are low-risk plumbing that should not be entangled with format correctness work.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Model Catalog):** Only ~30 of 206+ effect models have confirmed Mono/Stereo suffixed IDs from the 18 inspected files. The remaining models need systematic extraction from Pod Go Edit's model browser. This requires hands-on tool work, not web research. Expect 4-6 hours of catalog building.
- **Phase 4 (Builder):** The footswitch section and controller section encoding need validation against additional real `.pgp` files. Edge cases (expression pedal assignments, all 4 flexible slots filled) should be verified. The `device_version` for firmware 2.50 specifically needs confirmation (inspected files were firmware v1.00-v2.00).

Phases with standard patterns (skip additional research):
- **Phase 1 (Types):** Pure TypeScript interface definitions from empirically verified values. No unknowns.
- **Phase 3 (Chain Rules):** Straightforward adaptation of existing logic with device parameter. Well-understood constraints from hardware docs.
- **Phase 5 (Integration):** Standard Next.js routing and React state. No new patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies. Pure TypeScript. Zero package risk. |
| Features | HIGH | 18 real .pgp files inspected empirically. Device ID, @type values, I/O keys, model suffixes all confirmed from actual device files. |
| Architecture | HIGH | Extend-not-rewrite approach validated by codebase inspection. param-engine and snapshot-engine fully reusable. Builder must be new. |
| Pitfalls | HIGH | 12 specific pitfalls identified with prevention strategies. "Silent success" failure mode well-characterized. |

**Overall confidence:** MEDIUM-HIGH

The format details are well-established from real file inspection. The remaining uncertainty is in the completeness of the Pod Go effect model catalog (only ~30 of 206+ effects confirmed with Mono/Stereo suffixed IDs) and in the `device_version` constant for the latest firmware 2.50.

### Gaps to Address

- **Pod Go effect model catalog completeness:** Only ~30 effect models confirmed with Mono/Stereo suffixed IDs from 18 real files. The remaining ~170 models need systematic extraction. Resolution: during Phase 2, export presets from Pod Go Edit that use each effect category and catalog the IDs. This is the single largest work item in the milestone.

- **`device_version` for firmware 2.50:** The 18 inspected files were from firmware v1.00-v2.00. Firmware 2.50 (January 2025) may have a different `device_version` integer encoding. Resolution: export a preset from Pod Go Edit 2.50 and read the value.

- **Pod Go Wireless device ID:** FEATURES.md states it uses the same device ID and format as Pod Go. Not independently confirmed. Resolution: verify from a real Pod Go Wireless export, or defer Pod Go Wireless to a future release.

- **Footswitch `@fs_index` edge cases:** Basic range confirmed as 0-5 from real files. External FS7-FS8 indices and edge cases (FX Loop on a footswitch) need verification from additional preset files.

## Sources

### Primary (HIGH confidence)
- **18 real Pod Go .pgp preset files** (firmware v1.00-v2.00, Line 6 CustomTone) — All file format findings verified empirically
- **12 real Helix .hlx preset files** (firmware v3.70) — Comparison baseline for structural differences
- **Line 6 POD Go FAQ** (line6.com/support) — Block structure, fixed blocks, excluded models
- **Line 6 POD Go 2.50 Release Notes** — New models, firmware date (January 2025)
- **Line 6 POD Go Models Page** — 86 amp models, 206+ effects
- **Existing src/lib/helix/ codebase** — Ground truth for current architecture and what must be adapted

### Secondary (MEDIUM confidence)
- **Line 6 Community Forums** — .pgp format details, routing constraints, footswitch field names, converter discussions
- **GitHub: Zavsek/POD_GO-Helix_converter** — Format similarity confirmation, TypeScript conversion source
- **GitHub: sj-williams/pod-go-patches** — Additional real .pgp files for format inspection
- **benvesco.com DSP Allocations** — Pod Go DSP cost percentages per effect model

### Tertiary (LOW confidence)
- **Pod Go Wireless device ID** — Assumed same as Pod Go; needs independent verification
- **Full effect model ID list with Mono/Stereo suffixes** — Only ~30 of 206+ confirmed from real files; remainder needs systematic extraction

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
