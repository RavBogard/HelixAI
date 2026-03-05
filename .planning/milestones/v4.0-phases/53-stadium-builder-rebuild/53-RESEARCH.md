# Phase 53: Stadium Builder Rebuild - Research

**Researched:** 2026-03-05
**Domain:** TypeScript serializer rewrite — .hsp binary-JSON format, slot-grid block positioning, parameter encoding
**Confidence:** HIGH — all 5 bugs verified by direct inspection of 11 real .hsp files from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STAD-03 | Stadium builder param encoding fixed to `{ value: X }` format (no `access` field) | Confirmed: zero real files contain `access` field anywhere — all harness params and slot params use `{ "value": X }` only. Fix is a one-line change in `buildFlowBlock()` and `buildHarness()`. |
| STAD-04 | Stadium builder block keys use slot-grid allocation (b00=input, b05=amp, b06=cab, b13=output) instead of sequential numbering | Confirmed: real files use position-based keys. Key formula: path-0 blocks use `b{position:02d}`, path-1 blocks use `b{14+position:02d}`. Minimum observed amp position is 4 — current sequential approach risks amp at b03. Canonical SLOT_ALLOCATION approach fixes this. |
| STAD-05 | Stadium builder effect blocks use `type: "fx"` for all effect categories | Confirmed: every block in real files that is not amp/cab/input/output/split/join/looper uses `type: "fx"`. Current code passes `block.type` directly, producing "distortion", "delay", "reverb" etc. |
| STAD-06 | Stadium cab blocks emit all 10 parameters (adding Delay, IrData, Level, Pan, Position) | Confirmed: all 11 real .hsp files use exactly 10 cab params: Angle, Delay, Distance, HighCut, IrData, Level, LowCut, Mic, Pan, Position. Current `resolveCabParams()` emits only 5 (LowCut, HighCut, Mic, Distance, Angle). Five are missing. |
| STAD-07 | Generated .hsp file loads in HX Edit without errors — verified against real .hsp reference | Requires end-to-end test: generate a preset, compare structure to Agoura_Bassman.hsp field-by-field, open in HX Edit. TypeScript compilation is NOT sufficient verification. |
</phase_requirements>

---

## Summary

Phase 53 is a targeted rewrite of `stadium-builder.ts` to fix five confirmed format bugs. All bugs are deterministic and localized to a single file. The reference corpus (11 real .hsp files in C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/) is the ground truth — every fix can be directly validated against these files without any external research.

The most critical bugs are parameter encoding (STAD-03) and the missing cab parameters (STAD-06). The access field bug means every single parameter in every generated preset is in the wrong format — firmware will likely reject or silently misread these values. The cab parameters bug means generated cabs are structurally incomplete, missing five parameters that are present in every real file including the key fields IrData, Level, Pan, and Position.

The slot-grid block key bug (STAD-04) is nuanced: the current sequential approach is not completely wrong, but it can produce amp at position 3 (key b03) when real files never have amp at a position lower than 4. The canonical SLOT_ALLOCATION approach from ARCHITECTURE.md eliminates this risk and matches the reference corpus pattern. A `cursor` field is also missing from the preset JSON — every real file includes it and the builder omits it entirely.

**Primary recommendation:** Fix all 5 bugs in `stadium-builder.ts` and `param-engine.ts` (for missing cab params), then perform a field-by-field JSON comparison against `Agoura_Bassman.hsp` before marking the phase complete. HX Edit import verification is the hard acceptance gate.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.x (project-wide) | Type-safe serializer implementation | Already in use; no new dependency |
| Vitest | ^4.0.18 | Unit tests for builder output validation | Already configured in vitest.config.ts |

### Supporting

No new dependencies are needed. This phase modifies two existing files: `stadium-builder.ts` (serializer logic) and `param-engine.ts` (cab parameter completeness). Zero new npm packages.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canonical SLOT_ALLOCATION map | Sequential flowPos counter (current approach) | Sequential approach risks amp at b03 (minimum observed in real files is b04); slot allocation eliminates the risk with negligible complexity cost |
| Extending `resolveCabParams()` for Stadium | Adding Delay/IrData/Level/Pan/Position directly in builder | param-engine is the correct layer for all parameter resolution; builder should not hard-code parameter values |

**Installation:** No new packages.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes. All work is in:

```
src/lib/helix/
├── stadium-builder.ts    # REWRITE: fix param encoding, block keys, type field, cursor, harness
└── param-engine.ts       # MODIFY: add Delay, IrData, Level, Pan, Position to resolveCabParams()
```

### Pattern 1: Slot-Grid Block Key Allocation

**What:** Real .hsp block keys are `bNN` where NN is the physical slot position, not a sequential counter. For path 0, `key = 'b' + String(position).padStart(2, '0')`. For path 1 (dual-amp), `key = 'b' + String(14 + position).padStart(2, '0')`.

**Ground truth verified from real files:**
```
Agoura_Bassman.hsp:   b00=input, b01=gate, b02=boost, b05=amp, b06=cab, b09=delay, b10=reverb, b13=output
Agoura_Hiwatt.hsp:    b00=input, b01=gate, b02=boost, b05=amp, b06=cab, b09=delay, b10=reverb, b13=output
Stadium_Billie_Joe:   b00=input, b01=fx, b02=fx, b03=fx, b04=amp, b05=cab, b10=fx, b12=fx, b13=output
Stadium_Metal_Rhythm: b00=input, b01=gate, b02=boost, b04=split, b06=amp(path0), b07=cab(path0), b08=join, b13=output, b19=amp(path1), b20=cab(path1)
```

**Amp position range across all 11 real files:** minimum 4 (never 1, 2, or 3). The canonical approach guarantees amp at position 5 for simple presets (2 pre-effects) by assigning fixed logical slots:

```typescript
// stadium-builder.ts — new slot allocation (replaces sequential flowPos counter)
// Source: ARCHITECTURE.md Pattern 1, verified against real .hsp corpus
const STADIUM_SLOT_ALLOCATION: Record<string, number> = {
  input:         0,   // b00 — always fixed
  pre_gate:      1,   // b01
  pre_boost:     2,   // b02
  pre_effect_1:  3,   // b03
  pre_effect_2:  4,   // b04
  amp:           5,   // b05
  cab:           6,   // b06
  post_gate:     7,   // b07
  post_eq:       8,   // b08
  post_effect_1: 9,   // b09
  post_effect_2: 10,  // b10
  post_effect_3: 11,  // b11
  post_gain:     12,  // b12
  output:        13,  // b13 — always fixed
};

function makeBlockKey(slotPosition: number): string {
  return `b${String(slotPosition).padStart(2, "0")}`;
}
```

**Block key assignment logic:**
- input block: always `b00`
- output block: always `b13`
- gate/comp (pre-amp): `b01` role
- boost (distortion, pre-amp): `b02` role
- amp: `b05` (canonical position, matches Agoura_Bassman reference)
- cab: `b06` (amp + 1, always follows amp)
- post-amp effects: fill `b09`, `b10`, `b11`, `b12` in order
- path-1 blocks (dual-amp): `b{14 + position}`

**The `position` field inside the block JSON must equal the slot number used for its key.** This is the invariant: if a block is at key `b05`, its `"position": 5` field must match.

### Pattern 2: Parameter Encoding (No access field)

**What:** All block parameters in .hsp format use `{ "value": X }` objects. No `access` field. This applies to both slot params AND harness params. Confirmed across all 11 real files — zero instances of the `access` field anywhere.

```typescript
// CORRECT:
for (const [key, value] of Object.entries(block.parameters)) {
  slotParams[key] = { value };
}

// WRONG (current code — produces format no real file uses):
for (const [key, value] of Object.entries(block.parameters)) {
  slotParams[key] = { access: "enabled", value };
}
```

**Applies to:** All block types — slot params AND harness params. Current harness builder has:
```typescript
// CURRENT (wrong):
EvtIdx: { access: "enabled", value: -1 },
bypass: { access: "enabled", value: false },

// FIXED:
EvtIdx: { value: -1 },
bypass: { value: false },
```

### Pattern 3: FX Block Type Mapping

**What:** All effect blocks use `type: "fx"` in real files regardless of effect category. Only structural blocks get named type strings.

```typescript
// stadium-builder.ts — type mapping
// Source: verified against all 11 real .hsp files
function getStadiumBlockType(blockSpecType: BlockSpec["type"]): string {
  switch (blockSpecType) {
    case "amp":    return "amp";
    case "cab":    return "cab";
    case "input":  return "input";
    case "output": return "output";
    case "split":  return "split";
    case "join":   return "join";
    case "looper": return "looper";
    // All effects map to "fx"
    case "distortion":
    case "dynamics":
    case "eq":
    case "delay":
    case "reverb":
    case "modulation":
    case "wah":
    case "pitch":
    case "volume":
    case "send_return":
    default:
      return "fx";
  }
}
```

**Evidence:** Stadium_Metal_Rhythm gate block: `"type": "fx"`, model `HX2_GateHorizonGateMono`. Stadium Rock Rig looper block: `"type": "looper"`, model `P35_LooperHelixStereo`. The looper is a structural block type, not "fx".

### Pattern 4: Cab Parameter Completeness (10 params)

**What:** Every cab block in every real .hsp file has exactly 10 parameters:

```
Angle, Delay, Distance, HighCut, IrData, Level, LowCut, Mic, Pan, Position
```

Current `resolveCabParams()` returns only 5: `LowCut, HighCut, Mic, Distance, Angle`. Five are missing.

**Default values from Agoura_Bassman reference:**
```typescript
// param-engine.ts — updated resolveCabParams() for Stadium
// Source: Agoura_Bassman.hsp cab block inspection
function resolveCabParams(ampCategory: AmpCategory): Record<string, number> {
  const cabDefaults = CAB_PARAMS[ampCategory];
  return {
    LowCut:   cabDefaults.LowCut,    // Hz, already present
    HighCut:  cabDefaults.HighCut,   // Hz, already present
    Mic:      cabDefaults.Mic,       // integer index, already present
    Distance: cabDefaults.Distance,  // already present
    Angle:    cabDefaults.Angle,     // already present
    // Missing params — add with safe defaults:
    Delay:    0.0,    // ms, 0 = no cabinet delay
    IrData:   0,      // IR data index (0 = default)
    Level:    0.0,    // dB, 0 = unity
    Pan:      0.5,    // 0.5 = center
    Position: 0.25,   // mic position (0.0-1.0), 0.25 is standard near-mic
  };
}
```

**Note on device-specificity:** The current `resolveCabParams()` is shared across devices. The 5 missing params (Delay, IrData, Level, Pan, Position) appear in Stadium .hsp cab blocks. Verifying whether they also appear in .hlx cab blocks before unconditionally adding them to the shared function is prudent — if they are Stadium-specific, they should be added in a Stadium-conditional block or a separate `resolveStadiumCabParams()` function.

### Pattern 5: Cursor Field

**What:** Every real .hsp file includes a `cursor` field in the preset object at the same level as `flow`, `params`, `snapshots`, etc. The current builder omits this field entirely.

```typescript
// From Agoura_Bassman.hsp:
"cursor": { "flow": 0, "path": 0, "position": 2 }

// From Agoura_Hiwatt.hsp:
"cursor": { "flow": 0, "path": 0, "position": 9 }
```

The cursor position varies across files (it reflects where the user's cursor was in HX Edit). A safe default is `{ flow: 0, path: 0, position: 0 }`. The field must be present — its absence is a format deviation from real files.

```typescript
// buildStadiumPreset() — add cursor field
return {
  clip: { ... },
  cursor: { flow: 0, path: 0, position: 0 },  // ADD THIS
  flow,
  params: { ... },
  snapshots,
  sources,
  xyctrl: { ... },
};
```

### Anti-Patterns to Avoid

- **Sequential block key counter:** Using `flowPos++` and assigning `b{flowPos:02d}` as block keys produces amp at b03 when only gate+boost precede it. Minimum real-file amp position is b04. Use the canonical SLOT_ALLOCATION map instead.
- **Copying .hlx param format to .hsp:** The .hlx format uses flat-style params (`{ "@model": "...", "ParamKey": value }`). The .hsp format uses nested params (`{ "slot": [{ "model": "...", "params": { "ParamKey": { "value": X } } }] }`). The `access` field appeared in early documentation examples but is NOT present in any real file.
- **Unconditional shared-function modification:** If `resolveCabParams()` is modified to add the 5 missing params, verify those params do not appear in .hlx cab blocks (which would cause a false-positive format deviation). Use a device guard if Stadium-specific.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slot position calculation | Custom position logic scattered in builder | STADIUM_SLOT_ALLOCATION constant + makeBlockKey() | Centralizes all slot positions; easy to audit against real files; one source of truth |
| Block type mapping | Inline conditionals | getStadiumBlockType() lookup function | Exhaustive switch catches future block types; easy to test |
| Cab param defaults | Hard-coded in builder | Extend `resolveCabParams()` in param-engine.ts | Keeps all parameter resolution in param-engine; consistent with existing architecture |

**Key insight:** The existing Knowledge Layer architecture already does the right thing — all parameter resolution belongs in `param-engine.ts`, all serialization belongs in `stadium-builder.ts`. Don't blur those boundaries.

---

## Common Pitfalls

### Pitfall 1: Compiling Without Testing Against Real Files

**What goes wrong:** TypeScript compiles successfully, all existing tests pass, but the generated .hsp is rejected by HX Edit or imports silently broken.

**Why it happens:** TypeScript validates types, not format semantics. The `access` field bug produces valid TypeScript — it's a runtime data structure problem. The block key positions are valid TypeScript — whether position 3 is acceptable to Stadium firmware requires hardware/HX Edit verification.

**How to avoid:** After implementing all 5 fixes, generate a test preset using the full pipeline, then do a field-by-field comparison of the generated JSON against `Agoura_Bassman.hsp`. The comparison should cover: param encoding format (no `access`), block key positions (amp at b05, cab at b06), all block type fields, cab param count (10), cursor field presence.

**Warning signs:** If the comparison shows ANY block with `{ access: "enabled", value: X }` or a `type: "distortion"` field, the fix is incomplete.

### Pitfall 2: Missing Cab Params — Partial Fix

**What goes wrong:** Developer adds IrData and Level but misses Delay, Pan, or Position. The file still imports but cab parameters are wrong.

**Why it happens:** The five missing params are easy to undercount. "Delay" in a cab context is cabinet IR delay (not an effect block), which is unintuitive.

**How to avoid:** The definitive list from real files is exactly: `Angle, Delay, Distance, HighCut, IrData, Level, LowCut, Mic, Pan, Position` — 10 params total. Verify the count after fixing.

**Warning signs:** After fix, `Object.keys(cabBlock.slot[0].params).length` should equal 10.

### Pitfall 3: Harness Params Still Have access Field

**What goes wrong:** Developer fixes `slotParams` in `buildFlowBlock()` but forgets `buildHarness()` also uses `{ access: "enabled", value }`.

**Why it happens:** The access field appears in three places: `buildFlowBlock()` (slot params), `buildHarness()` (amp harness params), and `buildInputBlock()` / `buildEmptyInputBlock()` / `buildOutputBlock()` (built-in block params).

**How to avoid:** Search the entire `stadium-builder.ts` file for the string `access` after fixing. Zero occurrences is the target.

**Warning signs:** `grep -n 'access' src/lib/helix/stadium-builder.ts` returns any results.

### Pitfall 4: block.position Field Not Updated to Match Slot Key

**What goes wrong:** Block keys are updated to use canonical slots (b05 for amp) but the `"position": N` field inside the block JSON still reflects the old sequential value.

**Why it happens:** The slot number is used for two things: the block key AND the position field inside the block. These must be kept in sync. The invariant is: key `bNN` implies `"position": NN`.

**How to avoid:** When building blocks with the slot allocation approach, set the `position` field to the slot number: `position: STADIUM_SLOT_ALLOCATION["amp"]` (= 5), not `position: flowPos` (= 3).

**Warning signs:** In generated output, a block at key `b05` has `"position": 3`.

### Pitfall 5: Shared resolveCabParams Change Regresses Other Devices

**What goes wrong:** Adding Delay/IrData/Level/Pan/Position to the shared `resolveCabParams()` function causes non-Stadium devices (.hlx format) to include these fields in their cab blocks, producing format deviation.

**Why it happens:** `param-engine.ts` is shared across all 6 devices. Any unconditional change affects Helix LT, Floor, Stomp, StompXL, and Pod Go.

**How to avoid:** Two options — (a) make the addition conditional on device type via a guard in `resolveParameters()`, or (b) inspect whether .hlx cab blocks already accept these params (in which case adding them unconditionally is safe). The safest approach is to add a Stadium-specific extension that calls the base function and merges Stadium-only defaults.

**Warning signs:** Existing `orchestration.test.ts` tests for non-Stadium devices fail after the cab param change.

---

## Code Examples

Verified patterns from real .hsp file inspection:

### Complete Amp Block (Agoura_Bassman.hsp, b05)

```json
{
  "@enabled": { "snapshots": [true, null, null, null, null, null, null, null], "value": true },
  "favorite": 0,
  "harness": {
    "@enabled": { "value": true },
    "params": {
      "EvtIdx": { "value": -1 },
      "bypass": { "value": false },
      "upper": { "value": true }
    }
  },
  "linkedblock": { "block": "b06", "flow": 0 },
  "path": 0,
  "position": 5,
  "slot": [{
    "@enabled": { "value": true },
    "model": "Agoura_AmpUSTweedman",
    "params": {
      "Bass": { "value": 0.64 },
      "Master": { "value": 1.0 },
      "Level": { "value": -10.0 },
      "ZPrePost": { "value": 0.3 }
    },
    "version": 0
  }],
  "type": "amp"
}
```

### Complete Cab Block (Agoura_Bassman.hsp, b06) — All 10 params

```json
{
  "@enabled": { "value": true },
  "favorite": 0,
  "harness": {
    "@enabled": { "value": true },
    "params": {
      "EvtIdx": { "value": -1 },
      "bypass": { "value": false },
      "dual": { "value": true },
      "upper": { "value": true }
    }
  },
  "linkedblock": { "block": "b05", "flow": 0 },
  "path": 0,
  "position": 6,
  "slot": [{
    "@enabled": { "value": true },
    "model": "HD2_CabMicIr_4x10TweedP10RWithPan",
    "params": {
      "Angle":    { "value": 0.0 },
      "Delay":    { "value": 0.0 },
      "Distance": { "value": 1.0 },
      "HighCut":  { "value": 20100.0 },
      "IrData":   { "value": 0 },
      "Level":    { "value": 0.0 },
      "LowCut":   { "value": 19.9 },
      "Mic":      { "value": 9 },
      "Pan":      { "value": 0.5 },
      "Position": { "value": 0.25 }
    },
    "version": 0
  }],
  "type": "cab"
}
```

### FX Block (gate at b01 — type is "fx" not "gate")

```json
{
  "@enabled": { "value": true },
  "favorite": 0,
  "harness": {
    "@enabled": { "value": true },
    "params": {
      "ControlSource": { "value": 0 },
      "EvtIdx": { "value": -1 }
    }
  },
  "path": 0,
  "position": 1,
  "slot": [{
    "@enabled": { "value": true },
    "model": "HX2_GateHorizonGateMono",
    "params": {
      "Gate Range": { "value": false },
      "Level": { "value": 0.4 },
      "Mode": { "value": 0 },
      "Sensitivity": { "value": -40.0 }
    },
    "version": 0
  }],
  "type": "fx"
}
```

### Preset-Level cursor Field

```json
{
  "clip": { ... },
  "cursor": { "flow": 0, "path": 0, "position": 2 },
  "flow": [ ... ],
  "params": { ... },
  "snapshots": [ ... ],
  "sources": { ... },
  "xyctrl": { ... }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential flowPos counter for block keys | Canonical SLOT_ALLOCATION map | Phase 53 (this phase) | Amp always at b05, cab at b06 — matches reference corpus |
| `{ access: "enabled", value: X }` param format | `{ value: X }` only | Phase 53 | Matches every real .hsp file; old format was inherited from .hlx assumptions |
| 5 cab params (LowCut, HighCut, Mic, Distance, Angle) | 10 cab params (+ Delay, IrData, Level, Pan, Position) | Phase 53 | Structurally complete cab blocks |
| No cursor field in preset JSON | `cursor: { flow, path, position }` added | Phase 53 | Eliminates format deviation |

**Deprecated/outdated:**
- `{ access: "enabled", value: X }`: Never existed in real .hsp files. Removed in Phase 53.
- Sequential flowPos for block keys: Valid for some layouts but produces amp at b03 in simple presets. Replaced with SLOT_ALLOCATION.

---

## Open Questions

1. **Are Delay, IrData, Level, Pan, Position Stadium-specific cab params or universal?**
   - What we know: These 5 params appear in every Stadium .hsp cab block
   - What's unclear: Whether they also appear in .hlx format cab blocks — if yes, `resolveCabParams()` can be extended unconditionally
   - Recommendation: Run a quick `grep` or inspect one real .hlx export before modifying `resolveCabParams()`. If .hlx cabs don't include these, use a device guard to avoid regressing non-Stadium devices. If they do, add unconditionally.

2. **Do the harness ControlSource and Trails fields need to be added?**
   - What we know: `ControlSource: { "value": 0 }` appears in some fx block harness params (Agoura_Bassman, Agoura_Hiwatt), not others (Stadium Rock Rig). `Trails: { "value": 0 }` appears in some files. Current builder's `buildHarness()` only emits EvtIdx/bypass/upper/dual.
   - What's unclear: Whether these fields are REQUIRED or optional — some real files have them, some don't
   - Recommendation: Mark as LOW priority. Start with the 5 confirmed bugs. If HX Edit import fails after fixing the 5 bugs, investigate these as a secondary cause. Do not block Phase 53 on this.

3. **What harness params does Phase 52's new Agoura amp data require?**
   - What we know: Phase 53 depends on Phase 52 (catalog completion). After Phase 52, STADIUM_AMPS will have 6 new amps with defaultParams from real files.
   - What's unclear: Whether the new amps use the same harness structure as existing amps
   - Recommendation: Verify harness structure for new amps against the real files after Phase 52 completes. The current harness builder should be compatible.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | vitest.config.ts (project root) |
| Quick run command | `npx vitest run src/lib/helix/stadium-builder.test.ts` |
| Full suite command | `npx vitest run` |

**Current test status:** 170 tests across 8 test files, all passing. No stadium-builder-specific test file exists yet — it is a Wave 0 gap.

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAD-03 | Slot params and harness params use `{ value: X }` only — no `access` field in any block | unit | `npx vitest run src/lib/helix/stadium-builder.test.ts` | No — Wave 0 |
| STAD-04 | Amp block appears at key b05 (position 5), cab at b06 (position 6), output at b13 | unit | `npx vitest run src/lib/helix/stadium-builder.test.ts` | No — Wave 0 |
| STAD-05 | Gate/boost/delay/reverb/eq blocks all emit `type: "fx"`, not their semantic type | unit | `npx vitest run src/lib/helix/stadium-builder.test.ts` | No — Wave 0 |
| STAD-06 | Cab block slot params include all 10 keys: Angle, Delay, Distance, HighCut, IrData, Level, LowCut, Mic, Pan, Position | unit | `npx vitest run src/lib/helix/stadium-builder.test.ts` | No — Wave 0 |
| STAD-07 | Generated .hsp opens in HX Edit without errors | manual/smoke | Manual HX Edit import — not automatable | N/A — manual |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/helix/stadium-builder.test.ts`
- **Per wave merge:** `npx vitest run` (full suite — 170+ tests, must stay green)
- **Phase gate:** Full suite green + manual HX Edit import verification before `/gsd:verify-work`

### Wave 0 Gaps

- `src/lib/helix/stadium-builder.test.ts` — covers STAD-03, STAD-04, STAD-05, STAD-06
  - Test: `buildHspFile()` output has no `access` field anywhere (deep-scan JSON)
  - Test: amp block is at key `b05` with `position: 5`; cab at `b06` with `position: 6`
  - Test: gate and boost blocks emit `type: "fx"`
  - Test: cab params object has exactly 10 keys matching the required list
  - Test: preset JSON includes `cursor` field
  - Test: full `npx vitest run` suite stays green (regression guard for non-Stadium devices)

---

## Sources

### Primary (HIGH confidence)

- Real .hsp file corpus: 11 presets from C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/ — all format findings (param encoding, block keys, type fields, cab params, cursor) confirmed by direct Python inspection of binary-JSON content
  - Files inspected: Agoura_Bassman.hsp, Agoura_Hiwatt.hsp, Bigsby_Trem.hsp, NH_BoomAuRang.hsp, NH_Reflections.hsp, Purple Nurple.hsp, Stadium Rock Rig.hsp, Stadium_Billie_Joe.hsp, Stadium_Metal_Rhythm (1).hsp, Stadium_Rock_Rhythm.hsp (Rods Jubilee.hsp had no `flow` key — likely different format version)
- Direct code inspection: `stadium-builder.ts` (current implementation with 5 bugs), `param-engine.ts` (`resolveCabParams()` returns 5 params), `chain-rules.ts` (position assignment logic)
- `.planning/research/ARCHITECTURE.md` — 5 bugs documented with code locations, fix strategies, and canonical SLOT_ALLOCATION pattern
- `.planning/research/SUMMARY.md` — architecture overview confirming stadium-builder.ts as isolated REWRITE target

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — STAD-03 through STAD-07 requirement definitions
- `.planning/STATE.md` — Phase 53 depends on Phase 52; high-risk rewrite warning; HX Edit import verification is hard gate

### Tertiary (LOW confidence)

- Whether `Delay`, `IrData`, `Level`, `Pan`, `Position` cab params exist in .hlx format: not verified from .hlx inspection; using Stadium-conditional guard is safest approach until confirmed

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all 5 bugs confirmed from direct file inspection
- Fix strategies: HIGH — ARCHITECTURE.md provides confirmed patterns; verified against real files
- Implementation approach: HIGH — single-file rewrite with clear reference (Agoura_Bassman.hsp) for field-by-field comparison
- Cab param device-specificity: MEDIUM — 5 missing params confirmed in Stadium files, but .hlx format not re-inspected

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — .hsp format is fixed hardware format)
