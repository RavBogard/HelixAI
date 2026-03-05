# Phase 58: Architecture Audit — Research

**Researched:** 2026-03-05
**Domain:** Device/model abstraction layer audit across 6 Line 6 devices
**Confidence:** HIGH — all findings from direct codebase inspection of current source files

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ARCH-01 | Device/model abstraction audit completed with documented findings and recommendations | Direct inspection of all 6 device builders, chain-rules.ts, param-engine.ts, validate.ts, types.ts, config.ts, and models.ts — structural patterns, fragility points, and improvement opportunities all identified with exact file and line references |

</phase_requirements>

---

## Summary

Phase 58 is a documentation-only phase. No code changes are required unless the Stadium rebuild (Phases 52-53) reveals critical structural issues that demand immediate correction. The output is a single Markdown document at `.planning/architecture-audit-v4.md` that gives an honest assessment of the device abstraction layer and makes a recorded decision on whether a structural refactor is warranted now or should remain deferred.

The codebase uses a flat-function, guard-based abstraction pattern: a shared `DeviceTarget` union type propagates through `chain-rules.ts`, `param-engine.ts`, and `validate.ts` via `isPodGo()`, `isStadium()`, and `isStomp()` boolean guards. Each device builder (`preset-builder.ts` for LT/Floor, `podgo-builder.ts` for Pod Go, `stadium-builder.ts` for Stadium, `stomp-builder.ts` for Stomp/StompXL) is self-contained. The shared Knowledge Layer (`chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`) is device-aware through guard branching. This design is honest, flat, and testable — its weakness is that adding a 7th device requires edits in 6+ files simultaneously with no compiler enforcement of completeness.

The Stadium rebuild (Phases 52-53) is the most important source of audit evidence. The 5 confirmed format bugs in `stadium-builder.ts` all stemmed from building the Stadium implementation by analogy to the Helix LT builder rather than from real .hsp files. This is the core architectural lesson: device format knowledge lives in builder files that are difficult to verify until a real device accepts or rejects the output. The audit should document this as the primary systemic fragility and evaluate whether any structural change would have prevented it.

**Primary recommendation:** Write the audit document in a single focused session after all Phases 52-57 are complete. Structure the document around 4 audit dimensions: (1) what works well and should be preserved, (2) fragility points that exist today, (3) concrete improvements (file, scope, effort), and (4) the explicit refactor decision with rationale.

---

## Standard Stack

This phase produces a Markdown document, not code. No new libraries are required.

### Core
| Item | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| TypeScript source reading | 5.x (existing) | Understanding current patterns | Already the project language |
| Markdown | — | Audit document format | Already used throughout `.planning/` |

### No New Dependencies
Zero new npm packages. The audit is performed by reading existing source files and writing a Markdown document.

---

## Architecture Patterns

### The Existing Abstraction Model (What to Audit)

The current abstraction follows this structure:

```
DeviceTarget (types.ts)
  — union: "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium" | "helix_stomp" | "helix_stomp_xl"
  — guard functions: isHelix(), isPodGo(), isStadium(), isStomp(), isVariaxSupported()

Device Constants (config.ts)
  — FIRMWARE_CONFIG     : LT/Floor constants
  — POD_GO_FIRMWARE_CONFIG : Pod Go constants
  — STADIUM_CONFIG      : Stadium constants
  — STOMP_CONFIG        : Stomp/StompXL constants

Model Catalogs (models.ts)
  — AMP_MODELS          : All Helix LT/Floor/Stomp/PodGo amps (HD2_*)
  — STADIUM_AMPS        : Stadium-only amps (Agoura_*)
  — CAB_MODELS          : All cabs (shared)
  — EFFECT catalogs     : Shared across non-Stadium devices
  — STADIUM_EQ_MODELS   : Stadium-specific 7-band EQ

Knowledge Layer (chain-rules.ts, param-engine.ts, snapshot-engine.ts)
  — All three are shared and device-aware via guard branching
  — Branching pattern: if (podGo) {...} else if (stadium) {...} else if (stomp) {...} else {...}

Builders (one file per device family)
  — preset-builder.ts   : HlxFile for helix_lt + helix_floor (same .hlx format)
  — podgo-builder.ts    : PgpFile for pod_go
  — stadium-builder.ts  : HspFile for helix_stadium
  — stomp-builder.ts    : HlxFile for helix_stomp + helix_stomp_xl (same .hlx format, different I/O models)

Validation (validate.ts)
  — validatePresetSpec() : Device-aware via guard branching
  — Model ID sets: VALID_IDS (base), VALID_IDS_WITH_SUFFIXES (Pod Go)
  — Stadium/Stomp model IDs hardcoded as string literals in getValidModelIds()
```

### Key Pattern: Guard-Based Device Branching

The dominant pattern throughout the shared Knowledge Layer:

```typescript
// chain-rules.ts — assembleSignalChain()
const podGo = device ? isPodGo(device) : false;
const stadium = device ? isStadium(device) : false;
const stomp = device ? isStomp(device) : false;

// Then throughout the function:
if (!podGo && !stomp) { /* insert Parametric EQ */ }
if (podGo) { /* enforce 4-effect limit */ }
if (stadium && userEffects.length > 4) { /* enforce 4-effect limit */ }
```

This pattern repeats in `resolveParameters()` (param-engine.ts), `validatePresetSpec()` (validate.ts), and the API route. It works correctly today. Its weakness: adding a 7th device requires finding every guard and inserting a new `else if` branch — there is no single registration point and no TypeScript exhaustiveness check on the `device` parameter in these functions.

### Contrast: Builder Files (Well-Isolated)

Builder files are self-contained and do NOT use guard branching. Each builder owns its format completely. Adding a 7th device requires writing a new builder file, which is clean. The problem is in the shared Knowledge Layer, not the builders.

---

## What to Document in the Audit

### Dimension 1: What Works Well (Preserve)

These patterns should be explicitly called out as strengths:

1. **`DeviceTarget` union + TypeScript exhaustiveness on switch statements.** Adding a new device value to the `DeviceTarget` union immediately surfaces every unhandled case in switch statements as a compiler error. This was the Phase 32 strategy and it worked — the `isHelix()`, `isStadium()`, etc. guard functions are the weaker alternative used in the Knowledge Layer.

2. **Self-contained builders.** `stadium-builder.ts`, `podgo-builder.ts`, and `stomp-builder.ts` do not import from each other and do not import from `preset-builder.ts`. Each builder owns its format independently. This means Stadium bugs are localized to `stadium-builder.ts` and cannot silently affect `preset-builder.ts`.

3. **Strict model catalog separation.** `STADIUM_AMPS` is a completely separate dict from `AMP_MODELS`. `chain-rules.ts` uses strict device-aware lookup with no cross-device fallback (throws if amp not found in the device-appropriate catalog). This is correct and should be preserved.

4. **`HelixModel` interface shared across all devices.** The model metadata schema (`id`, `name`, `defaultParams`, `ampCategory`, `topology`, `cabAffinity`, `stadiumOnly`) is a single shared interface for all device catalogs. This is the right abstraction level — behavioral differences live in builder files, not in model metadata.

5. **Config constants grouped by device.** `FIRMWARE_CONFIG`, `POD_GO_FIRMWARE_CONFIG`, `STADIUM_CONFIG`, `STOMP_CONFIG` are distinct named objects — changing Stadium constants cannot accidentally affect Helix constants.

### Dimension 2: Fragility Points

These are the areas the audit should document honestly:

**Fragility 1: No exhaustiveness on guard-branched device parameters.**

In `assembleSignalChain(intent, device?)` and `resolveParameters(chain, intent, device?)`, the `device` parameter is optional and the branching uses boolean guards, not a switch. When a 7th device is added:
- TypeScript will NOT produce a compiler error pointing to these functions
- The developer must manually search for every `isPodGo()`, `isStadium()`, `isStomp()` call and determine whether a new branch is needed
- File targets: `chain-rules.ts` (~10 guard sites), `param-engine.ts` (~3 guard sites), `validate.ts` (~4 guard sites)

This is the primary structural weakness. It is manageable at 6 devices but will become a maintenance liability at 8+ devices.

**Fragility 2: Stadium model IDs hardcoded in `getValidModelIds()` as string literals.**

```typescript
// validate.ts lines 22-30
ids.add("P35_InputInst1");
ids.add("P35_InputNone");
ids.add("P35_OutputMatrix");
ids.add("HelixStomp_AppDSPFlowInput");
// ...
```

These I/O model IDs are not in any model catalog — they live only as string literals in `validate.ts`. There is no single source of truth for Stadium system model IDs. If a Stadium firmware update changes an I/O model ID, the developer must know to update `validate.ts` as well as `stadium-builder.ts`. The connection is invisible to TypeScript.

Fix target: Move I/O model IDs to `config.ts` as named constants (alongside `STADIUM_CONFIG`), then reference them in both `validate.ts` and `stadium-builder.ts`.

**Fragility 3: `param-engine.ts` MODEL_LOOKUPS does not include STADIUM_AMPS.**

```typescript
// param-engine.ts lines 208-222
const MODEL_LOOKUPS: Record<string, Record<string, HelixModel>> = {
  // ...
  amp: AMP_MODELS,
  // STADIUM_AMPS is absent
};
```

`resolveAmpParams()` handles this correctly via a direct fallback:
```typescript
const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
```

But `findModel()` — used by `resolveDefaultParams()` for all non-amp/cab blocks — does not include STADIUM_AMPS. This is harmless today because Stadium amps are resolved via `resolveAmpParams()` before `findModel()` is called. However, it creates an invisible coupling: a future developer calling `findModel()` for a Stadium amp model name will silently get `undefined` and fall back to `block.parameters` (empty `{}`), producing a block with no parameters. No TypeScript error, no runtime error, silent quality degradation.

**Fragility 4: Stadium builder uses sequential `flowPos` counter instead of slot-grid allocation.**

This is already documented as Bug 2 in ARCHITECTURE.md. The broader point for the audit: the `stadium-builder.ts` comment block at the top accurately documents the slot-based format, but the implementation uses a sequential counter `flowPos` that increments for every block. The comment and implementation are inconsistent. This inconsistency was not caught until real .hsp files were inspected in Phase 52 research. The audit should document this as evidence that comment-level documentation is insufficient — structural enforcement (a typed slot allocator) would have caught this at compile time.

**Fragility 5: `param-engine.ts` distortion resolution uses hardcoded model IDs.**

```typescript
// param-engine.ts line 382
if (block.modelId === "HD2_DistMinotaur") { ... }
if (block.modelId === "HD2_DistScream808") { ... }
```

These hardcoded IDs are not imported from `models.ts` constants. If the Minotaur or Scream 808 model IDs change (unlikely but not impossible across firmware versions), `param-engine.ts` will silently use wrong parameters without any TypeScript error. The fix is a one-line import: `const MINOTAUR_ID = DISTORTION_MODELS["Minotaur"]!.id`.

### Dimension 3: Concrete Structural Improvements

At least one concrete improvement is required by the success criteria. Here are the candidates, ordered by impact vs. effort:

**Improvement A (HIGH value, LOW effort): Move Stadium/Stomp I/O model IDs to config constants.**

File: `config.ts` and `validate.ts`
Scope: Add 3-4 named constants to `STADIUM_CONFIG` and `STOMP_CONFIG`; replace string literals in `validate.ts` with constant references.
Effort: ~30 minutes, zero functional change, eliminates invisible coupling.

```typescript
// config.ts addition
export const STADIUM_CONFIG = {
  // ... existing ...
  STADIUM_INPUT_MODEL: "P35_InputInst1",
  STADIUM_INPUT_NONE_MODEL: "P35_InputNone",
  STADIUM_OUTPUT_MODEL: "P35_OutputMatrix",
} as const;
```

This is the single most defensible improvement: low effort, zero regression risk, directly addresses Fragility 2.

**Improvement B (MEDIUM value, LOW effort): Replace hardcoded model IDs in param-engine with constant references.**

File: `param-engine.ts`
Scope: Import `DISTORTION_MODELS` (already imported), replace 4 string literals with `DISTORTION_MODELS["Minotaur"]!.id` etc.
Effort: ~15 minutes.

**Improvement C (HIGH value, MEDIUM effort): Add `STADIUM_AMPS` to MODEL_LOOKUPS in param-engine.**

File: `param-engine.ts`
Scope: Extend `MODEL_LOOKUPS` to include `STADIUM_AMPS` under a new key, update `findModel()` to search it for device="helix_stadium".
Effort: ~1 hour, requires device parameter threading to `findModel()` or a separate Stadium-aware lookup path.
Risk: Any change to `param-engine.ts` affects all 6 devices — requires 6-device regression test.

**Improvement D (LOW value for now, HIGH effort): Replace guard-based branching with a device capability registry.**

File: `chain-rules.ts`, `param-engine.ts`, `validate.ts`
Scope: Define a `DeviceCapabilities` interface with fields like `maxEffectBlocks`, `supportsDualAmp`, `requiresParametricEq`, etc. Each device value maps to a capabilities record. Replace guard-based if/else chains with capability lookups.
Effort: 2-4 hours of refactoring + full regression test suite.
Risk: Medium — changes core Knowledge Layer logic that has been stable for multiple milestones.
When warranted: At 7th device, not before. Current guard complexity is still manageable.

### Dimension 4: The Refactor Decision

The audit must record an explicit binary decision: refactor now, or defer.

**Recommendation: Defer structural refactor, implement Improvements A and B only.**

Rationale:
- The guard-based branching is transparent, easy to search, and well-tested at 6 devices
- The Stadium rebuild (Phases 52-53) will touch `chain-rules.ts` and `param-engine.ts` for device-specific behavior — doing a structural refactor simultaneously with functional changes multiplies regression risk
- Improvements A and B can be implemented in the audit phase itself (or deferred to Phase 59) without touching the Knowledge Layer logic
- Improvement D (capability registry) is warranted when a 7th device is planned, not as preemptive architecture
- The user-visible value of a refactor is zero — it is maintenance investment, not a quality or feature improvement

This decision should be recorded in `PROJECT.md` under Key Decisions with the rationale above.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Architecture audit methodology | Custom audit framework | Manual code reading + structured Markdown | The codebase is small (< 5K lines in `src/lib/helix/`), direct reading is faster than tooling |
| Cross-device regression testing | New test harness | Existing `chain-rules.test.ts`, `param-engine.test.ts`, `orchestration.test.ts` | Already covers 6-device scenarios |
| Format verification | Automated diff tooling | Manual inspection of generated vs. real .hsp files | Stadium format bugs require human judgment about intent, not just structural diff |

---

## Common Pitfalls

### Pitfall 1: Audit Scope Creep
**What goes wrong:** The audit expands from "document findings" into "fix everything found."
**Why it happens:** Once structural issues are identified, the reflex is to fix them immediately.
**How to avoid:** The phase goal is documentation only. Improvements are listed with scope estimates, not implemented. The one exception: if Phases 52-53 reveal a critical structural issue that makes the codebase actively unsafe (not just imperfect), that justifies an in-phase fix.
**Warning signs:** Any code change in `chain-rules.ts`, `param-engine.ts`, or `validate.ts` during Phase 58 that isn't directly related to a critical Stadium rebuild discovery.

### Pitfall 2: Recommending the Refactor Without a 7th Device
**What goes wrong:** The capability registry refactor (Improvement D) is recommended as "obviously better" without weighing maintenance cost against zero near-term user value.
**Why it happens:** Architectural elegance is appealing to engineers.
**How to avoid:** The refactor decision must be explicit and recorded. The justification "it's cleaner" is not sufficient — the justification must be "it reduces effort to add the Nth device by X hours" with a specific N in sight.

### Pitfall 3: Treating the Stadium Builder Bugs as Architecture Bugs
**What goes wrong:** The 5 `stadium-builder.ts` format bugs are described as evidence of a broken abstraction layer, leading to a recommendation to redesign the builder architecture.
**Why it happens:** The bugs feel systemic.
**Why that's wrong:** The bugs are in the implementation of one builder file, not in the abstraction model itself. The architecture correctly isolates Stadium to `stadium-builder.ts`. The fact that bugs were contained there is the abstraction working correctly. The lesson is "verify against real device files," not "redesign the builder pattern."

### Pitfall 4: Missing the MODEL_LOOKUPS Gap
**What goes wrong:** The audit praises `param-engine.ts` without noting the silent fallback risk when `findModel()` misses Stadium amps.
**Why it happens:** The risk is invisible — the code runs correctly today because the code paths that would fail haven't been exercised yet.
**How to avoid:** Explicitly trace the `findModel()` call path for a Stadium amp block and document that it currently returns `undefined` and falls back to `block.parameters`.

---

## Code Examples

The following are exact code patterns the audit document should cite. All sourced from direct codebase inspection.

### Guard-Based Branching Pattern (chain-rules.ts)

```typescript
// src/lib/helix/chain-rules.ts — assembleSignalChain()
const podGo = device ? isPodGo(device) : false;
const stadium = device ? isStadium(device) : false;
const stomp = device ? isStomp(device) : false;

// Example branch: Post-cab Parametric EQ insertion
if (!podGo && !stomp) {
  const eqModel = stadium
    ? STADIUM_EQ_MODELS[STADIUM_PARAMETRIC_EQ]!
    : EQ_MODELS[PARAMETRIC_EQ]!;
  // ...
}
```

This pattern appears approximately 10 times in `assembleSignalChain()` alone (lines 165-170, 327-346, 392-404, 407-416, 480-535). Each occurrence is a site that requires a new `else if (newDevice)` branch for a 7th device.

### Strict Device-Aware Catalog Lookup (chain-rules.ts — the correct pattern)

```typescript
// src/lib/helix/chain-rules.ts — line 267
const ampModel = stadium
  ? STADIUM_AMPS[intent.ampName]
  : AMP_MODELS[intent.ampName];
if (!ampModel) {
  throw new Error(
    `Unknown amp model: "${intent.ampName}". Model name must exactly match a key in ${stadium ? "STADIUM_AMPS" : "AMP_MODELS"}.`
  );
}
```

This is the correct anti-cross-device-fallback pattern. The audit should explicitly cite this as the correct approach to preserve.

### Hardcoded I/O Model IDs in validate.ts (the fragility)

```typescript
// src/lib/helix/validate.ts — lines 22-30
ids.add("P35_InputInst1");
ids.add("P35_InputNone");
ids.add("P35_OutputMatrix");
ids.add("HelixStomp_AppDSPFlowInput");
ids.add("HelixStomp_AppDSPFlowOutputMain");
ids.add("HelixStomp_AppDSPFlowOutputSend");
```

These same IDs appear as string literals in `stadium-builder.ts` (lines 23-25) and `stomp-builder.ts`. Three files own the same knowledge with no shared constant — a change to any I/O model ID requires updating all three files manually.

### MODEL_LOOKUPS Missing STADIUM_AMPS (param-engine.ts — the silent gap)

```typescript
// src/lib/helix/param-engine.ts — lines 208-222
const MODEL_LOOKUPS: Record<string, Record<string, HelixModel>> = {
  delay: DELAY_MODELS,
  reverb: REVERB_MODELS,
  // ... all effect types ...
  amp: AMP_MODELS,    // <-- AMP_MODELS only, STADIUM_AMPS absent
  cab: CAB_MODELS,
};
```

And the explicit Stadium fallback that compensates for it:

```typescript
// param-engine.ts — resolveAmpParams() — line 336
const model = STADIUM_AMPS[block.modelName] ?? AMP_MODELS[block.modelName];
```

The explicit fallback in `resolveAmpParams()` is correct. The problem is that `findModel()` — used by `resolveDefaultParams()` for all effect types — does not have this fallback. A Stadium effect block that passes through `resolveDefaultParams()` will find its model correctly because effects use shared catalogs. Only a Stadium amp block reaching `findModel()` would fail — which doesn't happen today because `resolveBlockParams()` routes amp blocks to `resolveAmpParams()` before `findModel()` is ever called. The gap is currently harmless but invisible.

### The Sequential flowPos Counter vs. Slot Grid (stadium-builder.ts — the format bug)

```typescript
// src/lib/helix/stadium-builder.ts — buildStadiumFlow()
// CURRENT (buggy): sequential counter
let flowPos = 1;
for (const { block, originalIndex } of orderedBlocks) {
  const blockKey = `b${String(flowPos).padStart(2, "0")}`;
  // ...
  flowPos++;
}

// REQUIRED (per real .hsp files): slot-grid allocation
// b00=input, b05=amp, b06=cab, b13=output
// Block keys must equal absolute slot positions, not sequential indices
```

This is Bug 2 from ARCHITECTURE.md. The audit should document it as an example of where a typed slot allocator constant (like `STADIUM_SLOT_ALLOCATION` proposed in ARCHITECTURE.md Pattern 1) would have made the correct format impossible to violate at the type level.

---

## Audit Document Structure Recommendation

The output document `.planning/architecture-audit-v4.md` should follow this structure:

```
# Architecture Audit v4.0

## Audit Scope
- 6 devices, all builders, shared Knowledge Layer
- Conducted after: [list completed phases 52-57]
- Auditor: [phase executor]

## What Works Well
- DeviceTarget union + TypeScript exhaustiveness
- Self-contained builder files
- Strict model catalog separation (no cross-device fallback)
- HelixModel interface as shared schema
- Config constants grouped by device

## Fragility Points
1. Guard-based branching — no exhaustiveness enforcement
   - Files: chain-rules.ts (~10 sites), param-engine.ts (~3), validate.ts (~4)
2. I/O model IDs as string literals in 3 files
   - Files: validate.ts L22-30, stadium-builder.ts L23-25, stomp-builder.ts
3. MODEL_LOOKUPS missing STADIUM_AMPS in param-engine.ts
   - File: param-engine.ts L208-222
4. Hardcoded model IDs in distortion resolution
   - File: param-engine.ts L382-388
5. Stadium rebuild discoveries [populate after Phases 52-53]
   - Files: [exact files and line numbers from actual rebuild work]

## Concrete Improvements
| ID | Improvement | File | Scope | Effort | Priority |
|----|-------------|------|-------|--------|----------|
| A | I/O model IDs → config constants | config.ts, validate.ts | ~5 lines | 30 min | High |
| B | Hardcoded model IDs → constant refs | param-engine.ts | ~4 lines | 15 min | Medium |
| C | Add STADIUM_AMPS to MODEL_LOOKUPS | param-engine.ts | ~10 lines | 1 hr | Low |
| D | Capability registry refactor | chain-rules, param-engine, validate | 200+ lines | 4 hr | Defer |

## Refactor Decision
**Decision: Defer structural refactor (Improvement D). Implement A and B only.**
**Rationale:** [paste from research]
**Recorded in:** PROJECT.md Key Decisions [date]

## Stadium Rebuild Discoveries
[Populate after Phases 52-53 complete — exact files and line numbers]

## Open Questions for Future Devices
- At what device count does the capability registry become justified?
- Should snapshot-engine.ts receive a device parameter for device-aware snapshot counts?
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No device abstraction (single device) | DeviceTarget union + 4 guard functions | Phase 32 (v3.0) | Compiler catches new device additions in switch statements |
| Cross-device fallback in amp lookup | Strict device-aware lookup that throws | Phase 34 (v3.0) | Stadium bugs are localized; no silent fallback to wrong catalog |
| Shared builder file (preset-builder.ts) | Separate builder per device family | Phase 35, 39 (v3.0, v3.1) | Stadium/Stomp format changes cannot regress LT/Floor |
| No config grouping | Config constants grouped by device object | Phase 32+ | Adding device constants is additive, not invasive |

---

## Open Questions

1. **Stadium Rebuild Discoveries (Phase 52-53 dependency)**
   - What we know: 5 format bugs identified in `stadium-builder.ts` before rebuild
   - What's unclear: Whether the rebuild reveals additional shared Knowledge Layer issues
   - Recommendation: Leave a placeholder section in the audit document; populate after Phases 52-53 complete

2. **snapshot-engine.ts device awareness**
   - What we know: `snapshot-engine.ts` does not receive a `device` parameter; it uses snapshot count from `spec.snapshots.length`
   - What's unclear: Whether Stadium's 8-snapshot support is fully exercised in practice; whether snapshot ChVol delta logic (Phase 57, FX-04) will require a device parameter
   - Recommendation: Investigate during audit whether snapshot-engine.ts needs device awareness after Phase 57 changes are in place

3. **Helix Floor vs. LT — any remaining divergence?**
   - What we know: Both use `preset-builder.ts` and the same .hlx format; `DEVICE_IDS` distinguishes them; `isHelix()` returns true for both
   - What's unclear: Whether any Knowledge Layer behavior should differ between LT and Floor
   - Recommendation: Document as "verified identical treatment" in the audit if confirmed

---

## Sources

### Primary (HIGH confidence)
- Direct inspection: `src/lib/helix/types.ts` — DeviceTarget union, DEVICE_IDS, guard functions, BlockSpec/PresetSpec interfaces
- Direct inspection: `src/lib/helix/config.ts` — FIRMWARE_CONFIG, POD_GO_FIRMWARE_CONFIG, STADIUM_CONFIG, STOMP_CONFIG
- Direct inspection: `src/lib/helix/chain-rules.ts` — assembleSignalChain(), guard-based branching pattern, all 10+ guard sites
- Direct inspection: `src/lib/helix/param-engine.ts` — resolveParameters(), MODEL_LOOKUPS gap, hardcoded model IDs, 3-layer amp resolution
- Direct inspection: `src/lib/helix/validate.ts` — validatePresetSpec(), hardcoded I/O model IDs, device-specific validation branches
- Direct inspection: `src/lib/helix/models.ts` — HelixModel interface, AMP_MODELS, STADIUM_AMPS separation
- Direct inspection: `src/lib/helix/stadium-builder.ts` — sequential flowPos bug, access field bug, HspFile type structure
- Direct inspection: `src/lib/helix/stomp-builder.ts` — self-contained pattern, HelixStomp_* I/O models
- Direct inspection: `src/lib/helix/preset-builder.ts` — buildHlxFile(), LT/Floor shared implementation
- Direct inspection: `src/lib/helix/podgo-builder.ts` — self-contained pattern, P34_* I/O models
- Direct inspection: `src/lib/helix/index.ts` — barrel exports, what is exposed to consumers
- `.planning/research/ARCHITECTURE.md` — Stadium bug analysis, 5 confirmed format bugs with fix targets
- `.planning/research/SUMMARY.md` — v4.0 architectural decisions, component status table

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — ARCH-01 requirement, Out of Scope decision on abstraction rewrite
- `.planning/STATE.md` — Accumulated decisions including "Device abstraction rewrite: evolutionary approach — audit only in v4.0"
- `.planning/ROADMAP.md` Phase 58 section — success criteria, exact deliverables

---

## Metadata

**Confidence breakdown:**
- Audit scope and structure: HIGH — derived from direct codebase inspection
- Fragility identification: HIGH — all fragility points confirmed by reading actual source code
- Improvement recommendations: HIGH — scoped to exact files and line ranges
- Refactor decision rationale: HIGH — consistent with REQUIREMENTS.md "Out of Scope" and STATE.md accumulated decisions

**Research date:** 2026-03-05
**Valid until:** Stable — Phase 58 runs after all other v4.0 phases complete; only Stadium rebuild discoveries (Phases 52-53) could alter findings, and placeholder sections accommodate this
**Phase dependency note:** The audit document cannot be fully written until Phases 52-53 complete. The "Stadium Rebuild Discoveries" section is the only variable — all other findings from this research are based on the current stable codebase.
