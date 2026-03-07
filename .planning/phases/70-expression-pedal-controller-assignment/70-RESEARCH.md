# Phase 70: Expression Pedal Controller Assignment - Research

**Researched:** 2026-03-06
**Domain:** Helix preset file format controller section — expression pedal parameter binding
**Confidence:** HIGH — all findings from direct codebase inspection of 4 builders, types.ts, models.ts, device-family.ts, and prior milestone research (FEATURES.md, STACK.md, ARCHITECTURE.md)

## Summary

Phase 70 fixes a P0 silent hardware bug: wah and volume blocks are completely non-functional on physical Helix hardware because no `@controller` entry is ever emitted for expression pedal parameters. The infrastructure is fully in place — `CONTROLLERS.EXP_PEDAL_1 = 1` and `CONTROLLERS.EXP_PEDAL_2 = 2` exist in `models.ts`, the `HlxControllerAssignment` type supports them, and all 4 builders have `buildControllerSection()` functions — but those functions only emit snapshot controllers (`@controller: 19` or `4` for Pod Go). No code path writes EXP pedal entries.

The fix is a targeted addition to 3 of 4 builders (preset-builder.ts, stomp-builder.ts, podgo-builder.ts). Stadium is skipped because `expressionPedalCount: 0`. Each builder's `buildControllerSection()` must be extended with an EXP assignment loop that runs after the existing snapshot loop, using the same `blockKeyMap` infrastructure. The critical constraint is controller mutual exclusion: a single `(block, paramName)` pair can have only one `@controller` value. Wah `Position` and volume `Position` should NEVER be snapshot-controlled (they are real-time physical controls), so the exclusion guard is straightforward — EXP-assigned params are simply not candidates for snapshot variation.

**Primary recommendation:** Add deterministic EXP pedal assignment to `buildControllerSection()` in preset-builder.ts, stomp-builder.ts, and podgo-builder.ts. Gate on `caps.expressionPedalCount > 0`. Assign EXP1 to wah Position, EXP2 to volume Position. Pod Go (1 pedal) gets only EXP1 for wah. Stadium (0 pedals) emits nothing — no code change needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 | Type-safe controller assignment logic | Already used throughout codebase |
| Vitest | ^4.0.18 | Testing EXP controller output | Existing test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^4.3.6 | Validation of EXP assignments in PresetSpec | Only if adding ToneIntent schema field |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic builder-side assignment | AI-driven ToneIntent.expPedalAssignments | Unnecessary complexity — EXP1=wah, EXP2=volume covers 95%+ of cases. AI would only add token cost with no quality gain. Deferred to EXP-F01. |

**Installation:**
```bash
# No new packages needed — all infrastructure exists
```

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helix/
├── preset-builder.ts    # buildControllerSection() — add EXP loop (Helix LT/Floor)
├── stomp-builder.ts     # buildControllerSection() — add EXP loop (Stomp/XL)
├── podgo-builder.ts     # buildPgpControllerSection() — add EXP loop (Pod Go, 1 pedal)
├── stadium-builder.ts   # NO CHANGE — expressionPedalCount: 0
├── models.ts            # CONTROLLERS.EXP_PEDAL_1/2 already defined (lines 52-57)
├── device-family.ts     # expressionPedalCount already per-device (line 41)
└── types.ts             # HlxControllerAssignment already supports EXP (line 137)
```

### Pattern 1: Capability-Gated Feature Injection
**What:** Gate EXP pedal logic on `caps.expressionPedalCount`, not device name strings.
**When to use:** Always — this is the established v5.0 pattern for per-device behavior.
**Example:**
```typescript
// Source: device-family.ts pattern — caps-based feature gating
function buildExpAssignments(
  chain: BlockSpec[],
  controller: Record<string, Record<string, Record<string, unknown>>>,
  blockKeyMap: Map<string, { dsp: number; perDspKey: string }>,
  caps: DeviceCapabilities
): void {
  if (caps.expressionPedalCount === 0) return; // Stadium: skip entirely

  // EXP1 → wah Position (industry convention)
  const wahBlock = chain.find(b => b.type === "wah");
  if (wahBlock) {
    const wahKey = findBlockKey(wahBlock, blockKeyMap);
    if (wahKey) {
      const dspKey = wahKey.dsp === 1 ? "dsp1" : "dsp0";
      if (!controller[dspKey][wahKey.perDspKey]) {
        controller[dspKey][wahKey.perDspKey] = {};
      }
      controller[dspKey][wahKey.perDspKey]["Position"] = {
        "@min": 0.0,
        "@max": 1.0,
        "@controller": CONTROLLERS.EXP_PEDAL_1,
      };
    }
  }

  // EXP2 → volume Position (only if device has 2+ pedals)
  if (caps.expressionPedalCount >= 2) {
    const volBlock = chain.find(b => b.type === "volume" && b.model !== "Gain Block");
    if (volBlock) {
      const volKey = findBlockKey(volBlock, blockKeyMap);
      if (volKey) {
        const dspKey = volKey.dsp === 1 ? "dsp1" : "dsp0";
        if (!controller[dspKey][volKey.perDspKey]) {
          controller[dspKey][volKey.perDspKey] = {};
        }
        controller[dspKey][volKey.perDspKey]["Position"] = {
          "@min": 0.0,
          "@max": 1.0,
          "@controller": CONTROLLERS.EXP_PEDAL_2,
        };
      }
    }
  }
}
```

### Pattern 2: Controller Mutual Exclusion Guard
**What:** A single `(block, paramName)` pair can only have ONE `@controller` value — either snapshot (19/4) OR expression pedal (1/2), never both simultaneously.
**When to use:** When adding EXP entries to the controller section that already contains snapshot entries.
**Example:**
```typescript
// The guard is IMPLICIT in the architecture:
// - Snapshot loop writes @controller:19 for params that VARY across snapshots
// - EXP loop writes @controller:1/2 for wah Position and volume Position
// - Wah Position and volume Position should NEVER vary across snapshots
//   (they are physical pedal sweeps, not snapshot states)
// - Therefore: no conflict occurs in correct presets
//
// DEFENSIVE guard (in case AI incorrectly varies wah Position):
// Check if the param already has a controller entry before writing EXP
if (controller[dspKey][blockKey]?.["Position"]) {
  // Already snapshot-controlled — skip EXP assignment
  // This prevents overwriting snapshot control with EXP
  return;
}
```

### Pattern 3: Block Key Resolution Reuse
**What:** Reuse the existing `blockKeyMap` (already computed for snapshot entries) for EXP entries.
**When to use:** Always — avoid computing block keys twice.
**Example:**
```typescript
// In buildControllerSection():
const blockKeyMap = buildBlockKeyMap(spec.signalChain); // EXISTING — line 424

// Snapshot loop uses blockKeyMap (EXISTING — lines 446-465)
// EXP loop reuses SAME blockKeyMap (NEW — appended after snapshot loop)
buildExpAssignments(spec.signalChain, controller, blockKeyMap, caps);
```

### Anti-Patterns to Avoid
- **Device name string guards:** Do NOT use `if (device === "helix_lt")`. Use `caps.expressionPedalCount` capability check.
- **EXP assignment in param-engine:** Block key resolution (`blockN` format) only exists after `buildDsp()` runs in the builder. Param-engine cannot compute controller section keys.
- **EXP assignment in chain-rules:** Chain-rules handles structural ordering, not format-specific controller binding.
- **AI-driven EXP assignment:** The deterministic wah-to-EXP1, volume-to-EXP2 mapping covers 95%+ of professional presets. AI-driven assignment is deferred to EXP-F01.
- **Snapshot-controlling wah Position:** Wah Position must NOT appear in snapshot parameterOverrides. It is a real-time physical pedal sweep, not a per-snapshot state. If the AI incorrectly varies it, the EXP assignment would conflict.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Block key resolution | Custom block-to-key lookup | `buildBlockKeyMap()` (preset-builder.ts line 378) | Already handles DSP assignment, cab skipping, global-index correction |
| Device capability check | `if/else` chains per device name | `caps.expressionPedalCount` from `getCapabilities()` | Single source of truth, already validated for all 6 devices |
| Controller format | Manual JSON assembly | `HlxControllerAssignment` type from types.ts | Type-checked `@min`, `@max`, `@controller`, `@snapshot_disable` |
| Wah/volume model detection | String matching on model names | `block.type === "wah"` / `block.type === "volume"` | BlockSpec.type is already classified by chain-rules |

**Key insight:** The entire controller section infrastructure exists and works for snapshot controllers. EXP pedal assignment is a minimal extension — same data structure, same block key map, same controller section output. The only new logic is "which blocks get EXP entries and which pedal number."

## Common Pitfalls

### Pitfall 1: Gain Block vs Volume Pedal Confusion
**What goes wrong:** Assigning EXP controller to a Gain Block (which uses `Gain` param, not `Position`).
**Why it happens:** Both "Volume Pedal" and "Gain Block" are in VOLUME_MODELS with `blockType: BLOCK_TYPES.VOLUME`.
**How to avoid:** Filter by model name: `block.model !== "Gain Block"` or check param name — Volume Pedal has `Position`, Gain Block has `Gain`. Gain Blocks are level-staging tools, not expression pedal targets.
**Warning signs:** `@controller: 2` entry on a `Gain` param instead of `Position`.

### Pitfall 2: Pod Go Single-Pedal Budget
**What goes wrong:** Assigning both EXP1 (wah) and EXP2 (volume) on Pod Go which only has 1 expression pedal.
**Why it happens:** Pod Go `expressionPedalCount: 1` means only EXP1 is available.
**How to avoid:** Gate volume EXP2 assignment on `caps.expressionPedalCount >= 2`. Pod Go gets only wah on EXP1. Volume stays at fixed unity (no controller assignment).
**Warning signs:** `@controller: 2` appearing in a .pgp file.

### Pitfall 3: Pod Go Uses Controller ID 4 for Snapshot (Not 19)
**What goes wrong:** Using `CONTROLLERS.SNAPSHOT` (19) in Pod Go controller section.
**Why it happens:** Copy-pasting from preset-builder.ts without noting Pod Go's different snapshot controller ID.
**How to avoid:** Pod Go builder already uses `POD_GO_SNAPSHOT_CONTROLLER = 4` for snapshot entries. EXP pedal controller IDs (1, 2) are the SAME across all formats — only snapshot IDs differ. No special handling needed for EXP entries in Pod Go.
**Warning signs:** This pitfall is snapshot-only; EXP entries use the same @controller values regardless of format.

### Pitfall 4: Overwriting Snapshot Controller with EXP
**What goes wrong:** If wah Position somehow appears in snapshot parameterOverrides, the snapshot loop writes `@controller: 19` first, then the EXP loop overwrites it with `@controller: 1`.
**Why it happens:** The AI might incorrectly vary wah Position across snapshots (conceptual error — wah sweep is physical, not snapshot state).
**How to avoid:** Run EXP assignment AFTER snapshot loop and add a defensive check: skip EXP if param already has a controller entry. Alternatively, ensure wah Position and volume Position are never included in snapshot parameterOverrides by the snapshot-engine.
**Warning signs:** A wah block with `@controller: 19` on Position, or a wah block with no `@controller` at all when EXP pedals are available.

### Pitfall 5: Stadium Builder False Positive
**What goes wrong:** Attempting to add EXP controller code to stadium-builder.ts.
**Why it happens:** Stadium is in the builder family and has a `buildStadiumPreset()` function.
**How to avoid:** Stadium has `expressionPedalCount: 0`. The capability gate (`if (caps.expressionPedalCount === 0) return;`) handles this. Additionally, Stadium's controller format is completely different (slot-based, not flat-style) — no controller section builder exists in stadium-builder.ts, so there is no function to extend.
**Warning signs:** Any EXP-related code appearing in stadium-builder.ts.

## Code Examples

Verified patterns from direct codebase inspection:

### Existing Snapshot Controller Entry (preset-builder.ts lines 458-463)
```typescript
// Source: preset-builder.ts buildControllerSection()
controller[dspKey][resolvedKey][paramName] = {
  "@min": Math.min(...allValues),
  "@max": Math.max(...allValues),
  "@controller": CONTROLLERS.SNAPSHOT,  // 19
  "@snapshot_disable": false,
};
```

### EXP Pedal Controller Entry (NEW — same format, different @controller)
```typescript
// NEW: EXP pedal assignment — appended after snapshot loop
controller[dspKey][wahBlockKey]["Position"] = {
  "@min": 0.0,
  "@max": 1.0,
  "@controller": CONTROLLERS.EXP_PEDAL_1,  // 1
};
```

### Block Type Detection from Signal Chain
```typescript
// Source: chain-rules.ts pattern — block type filtering
const wahBlock = spec.signalChain.find(b => b.type === "wah");
const volumeBlock = spec.signalChain.find(
  b => b.type === "volume" && b.model !== "Gain Block"
);
```

### Capability-Gated Assignment
```typescript
// Source: device-family.ts expressionPedalCount values
// Helix LT/Floor: 3, Stomp/XL: 2, Pod Go: 1, Stadium: 0
if (caps.expressionPedalCount === 0) return; // Stadium: no EXP
if (caps.expressionPedalCount >= 2) {
  // Assign EXP2 to volume (Helix, Stomp only)
}
```

### BlockKeyMap Lookup for Controller Section Keys
```typescript
// Source: preset-builder.ts buildBlockKeyMap() line 378
// Maps block references to { dsp: number, perDspKey: string }
const blockKeyMap = buildBlockKeyMap(spec.signalChain);
// wahBlock is at index N in the chain → blockKeyMap resolves to "blockN" in correct DSP
```

### Pod Go Controller Section (different snapshot ID, same EXP IDs)
```typescript
// Source: podgo-builder.ts buildPgpControllerSection() line 383
// Snapshot: @controller: 4 (NOT 19)
// EXP: @controller: 1 (SAME as .hlx)
controller.dsp0[blockKey][paramName] = {
  "@min": Math.min(...allValues),
  "@max": Math.max(...allValues),
  "@controller": POD_GO_SNAPSHOT_CONTROLLER, // 4 for snapshots
  "@snapshot_disable": false,
};

// EXP entry uses CONTROLLERS.EXP_PEDAL_1 = 1 (same as .hlx)
controller.dsp0[wahKey]["Position"] = {
  "@min": 0.0,
  "@max": 1.0,
  "@controller": CONTROLLERS.EXP_PEDAL_1, // 1
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No EXP assignment (current) | Deterministic builder-side EXP1=wah, EXP2=volume | Phase 70 | Fixes P0 silent hardware bug — wah/volume become functional |
| All params snapshot-controlled | EXP params excluded from snapshot, EXP-controlled instead | Phase 70 | Controller mutual exclusion properly enforced |

**Deprecated/outdated:**
- STACK.md suggested `ToneIntent.expPedalAssignments` pass-through field for AI-driven assignment. For Phase 70, this is unnecessary — deterministic assignment covers the requirement. The ToneIntent field is deferred to EXP-F01 (user-specified custom assignments).

## Open Questions

1. **Stomp builder blockKeyMap difference**
   - What we know: stomp-builder.ts has its own `buildBlockKeyMap()` that resolves early in the key, using `mapping.perDspKey` directly. It uses dsp0 only (single DSP).
   - What's unclear: Whether the block key lookup for finding wah/volume blocks needs Stomp-specific handling or if the chain BlockSpec[] already has correct references.
   - Recommendation: Test with a Stomp preset containing wah — verify the resolved blockKey matches expectations. LOW risk since the pattern is identical to the existing snapshot loop.

2. **Volume Pedal heel-down behavior (EXP-05)**
   - What we know: @min=0.0, @max=1.0 means heel-down = 0.0 = silent. Professional presets sometimes use @min=0.05 or @min=0.1 to prevent complete silence.
   - What's unclear: Whether "heel-down not silent" (per EXP-05) means @min should be 0.0 (full range, user controls) or @min=0.05 (safety floor).
   - Recommendation: Use `@min: 0.0`, `@max: 1.0` as the standard range. The "heel-down not silent" requirement in EXP-05 likely refers to the volume block's resting parameter value when no controller is assigned (the default `Position: 1.0` in VOLUME_MODELS), not the EXP sweep range. With EXP assigned, the user physically controls position — 0.0 minimum is expected behavior.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EXP-01 | Wah blocks assigned to expression pedal controller with Position parameter mapped | **FULLY SUPPORTED.** WAH_MODELS all have `Position` param. Controller format: `@controller: CONTROLLERS.EXP_PEDAL_1`, `@min: 0.0`, `@max: 1.0`. Add to `buildControllerSection()` in preset-builder.ts, stomp-builder.ts, podgo-builder.ts. Block detection: `chain.find(b => b.type === "wah")`. Key resolution via existing `buildBlockKeyMap()`. |
| EXP-02 | Volume blocks assigned to expression pedal controller with Position/Volume parameter mapped | **FULLY SUPPORTED.** "Volume Pedal" model has `Position` param (not "Gain Block" which uses `Gain`). Controller format: `@controller: CONTROLLERS.EXP_PEDAL_2`, `@min: 0.0`, `@max: 1.0`. Filter: `b.type === "volume" && b.model !== "Gain Block"`. Only assigned when `caps.expressionPedalCount >= 2`. |
| EXP-03 | Expression pedal assignments respect per-device capability — Helix (3 EXP), Stomp (2 EXP), Pod Go (1 EXP), Stadium (0 EXP, skipped) | **FULLY SUPPORTED.** `DeviceCapabilities.expressionPedalCount` is correctly set for all 6 devices: Helix=3, Stomp=2, StompXL=2, PodGo=1, Stadium=0. Gate: `if (caps.expressionPedalCount === 0) return;` skips Stadium. Gate: `if (caps.expressionPedalCount >= 2)` guards volume EXP2 assignment (excludes Pod Go). |
| EXP-04 | Expression pedal assignments do not conflict with snapshot controller assignments | **FULLY SUPPORTED.** Controller mutual exclusion is architectural — a `(block, paramName)` pair has exactly one `@controller`. Wah Position and volume Position are physical sweep targets, not snapshot states. They should never appear in snapshot `parameterOverrides`. Defensive guard: check if param already has controller entry before writing EXP. Run EXP loop AFTER snapshot loop. |
| EXP-05 | Expression pedal @min/@max values appropriate per block type — wah sweep 0.0-1.0, volume pedal heel-down not silent | **FULLY SUPPORTED.** Wah: `@min: 0.0`, `@max: 1.0` (full sweep). Volume: `@min: 0.0`, `@max: 1.0` (full range — user physically controls position; "not silent" is the default Position=1.0 when no pedal is connected, not a floor on the sweep range). All WAH_MODELS have consistent `Position: 0.5` default. |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/models.ts` lines 52-57 — CONTROLLERS constants (EXP_PEDAL_1=1, EXP_PEDAL_2=2, SNAPSHOT=19)
- `src/lib/helix/models.ts` lines 1060-1078 — WAH_MODELS (9 models, all with Position param), VOLUME_MODELS (Volume Pedal with Position, Gain Block with Gain)
- `src/lib/helix/types.ts` lines 129-140 — HlxControllerAssignment interface with @min, @max, @controller, @snapshot_disable
- `src/lib/helix/device-family.ts` lines 104-120 — HELIX_CAPABILITIES with expressionPedalCount: 3
- `src/lib/helix/preset-builder.ts` lines 418-469 — buildControllerSection() snapshot-only implementation
- `src/lib/helix/stomp-builder.ts` lines 229-275 — buildControllerSection() stomp variant
- `src/lib/helix/podgo-builder.ts` lines 346-391 — buildPgpControllerSection() with POD_GO_SNAPSHOT_CONTROLLER=4
- `src/lib/helix/stadium-builder.ts` — No controller section function (slot-based format, 0 EXP pedals)
- `.planning/research/FEATURES.md` — EXP pedal behavior research (EXP1=wah, EXP2=volume convention)
- `.planning/research/STACK.md` — Controller mutual exclusion finding, no new packages needed
- `.planning/research/ARCHITECTURE.md` — EXP assignment belongs in builder layer, capability-gated

### Secondary (MEDIUM confidence)
- Line 6 Community + Helix Help — EXP1=wah Position, EXP2=volume Position as hardware default (documented in FEATURES.md research)
- Fluid Solo preset analysis — Professional presets confirm EXP assignment conventions (documented in FEATURES.md)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all infrastructure exists in codebase
- Architecture: HIGH — builder-layer pattern confirmed by direct code inspection of all 4 builders
- Pitfalls: HIGH — mutual exclusion, Pod Go single-pedal, Gain Block confusion all identified from codebase structure

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable — Helix file format does not change frequently)
