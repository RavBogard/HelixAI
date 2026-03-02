# Architecture Research: Pod Go Integration

**Domain:** Line 6 Pod Go preset generation — adding to existing HelixAI architecture
**Researched:** 2026-03-02
**Confidence:** HIGH (direct codebase inspection, community reverse-engineering sources, Line 6 official docs)

---

## Context: What This Document Covers

This document addresses the Pod Go milestone specifically: how Pod Go preset generation integrates with the existing Helix-based architecture. Every decision is component-level: which modules share, which fork, which are new, and in what order to build.

---

## Hardware Differences: Pod Go vs. Helix

Understanding the hardware constraints drives every architectural decision.

| Dimension | Helix LT / Floor | Pod Go |
|-----------|-----------------|--------|
| Signal paths | 2 (dsp0 + dsp1) | 1 (dsp0 only) |
| Total blocks | 16+ (8 per DSP) | 10 total |
| Assignable effect slots | ~8 per DSP | 4 user-assignable |
| Fixed blocks | none (all user-configurable) | Wah, Volume, FX Loop, Amp, Cab, EQ — 6 fixed |
| Snapshots per preset | 8 | 4 |
| Footswitches (stomp) | FS5-FS8 (4 stomps in Snap/Stomp layout) | FS1, FS2, FS4, FS5, FS6 (up to 5) |
| DSP chips | 2 (dual DSP) | 1 (single DSP) |
| Parallel routing | Yes (AB, SABJ topologies) | No |
| File extension | .hlx | .pgp |
| File format | JSON (schema: "L6Preset") | JSON (community-confirmed) |
| Schema name | "L6Preset" | Not publicly documented — needs verification |
| Device ID (data.device) | helix_lt: 2162692, helix_floor: 2162688 | Unknown — requires .pgp file inspection |

**Confidence on hardware facts:** HIGH — Line 6 official FAQ, community forums, multiple sources confirm single DSP, 4 assignable slots, 4 snapshots.

**Confidence on .pgp JSON structure:** MEDIUM — community members confirm it is plain JSON and shares footswitch/snapshot field names with .hlx, but no official schema exists. The device ID value for Pod Go must be determined by inspecting a real .pgp export before building `podgo-builder.ts`.

Sources:
- [POD Go Block Restrictions](https://line6.com/support/topic/62007-pod-go-block-restrictions/)
- [POD Go FAQ](https://kb.line6.com/kb/live/pod-go-faq)
- [Fileformats, custom tools and API thread](https://line6.com/support/topic/63502-fileformats-custom-tools-and-api/)
- [Zavsek POD_GO-Helix_converter](https://github.com/Zavsek/POD_GO-Helix_converter)

---

## Existing Architecture (Stable Reference)

```
User Chat (Gemini SSE)
        |
        | conversation history
        v
[callClaudePlanner()]           planner.ts
        |
        | ToneIntent (~15 fields)
        v
[assembleSignalChain()]         chain-rules.ts
[resolveParameters()]           param-engine.ts
[buildSnapshots()]              snapshot-engine.ts
        |
        | PresetSpec
        v
[validatePresetSpec()]          validate.ts
[buildHlxFile()]                preset-builder.ts
        |
        | HlxFile JSON
        v
POST /api/generate response
```

---

## Integration Strategy: What Changes and What Does Not

### Decision Principle

The Planner-Executor separation is the core design invariant. ToneIntent is the contract between AI and Knowledge Layer. The only reason to touch ToneIntent is if Pod Go genuinely needs information the AI must provide that the Knowledge Layer cannot derive. Everything else adapts below ToneIntent.

---

## Component-by-Component Decisions

### ToneIntent — Extend, Do Not Fork

**Decision: Add one optional field. No forking.**

ToneIntent is device-agnostic today. The AI selects amps, cabs, and effects by name. These names are strings, and the same HD2 model names exist in both Helix and Pod Go (Pod Go is a subset of the Helix model library, confirmed by Line 6). The AI does not need to know which device it is generating for — that is a Knowledge Layer and builder concern.

The only change needed: the amp/cab/effect enum validation currently points to the full Helix model list. Pod Go has a subset. The planner prompt must be told which device it is generating for so it receives the correct allowed model list.

```typescript
// tone-intent.ts — no schema change needed
// The device-specific model list is passed to buildPlannerPrompt() at call time
// ToneIntentSchema stays identical
```

The route.ts passes `deviceTarget` to `buildPlannerPrompt()`, which already accepts a `modelList` string. The model list for Pod Go omits models unavailable on Pod Go.

**What changes in planner.ts:**
- `buildPlannerPrompt(modelList)` signature stays the same
- `callClaudePlanner(messages, deviceTarget)` receives device target
- It calls `getModelListForPrompt(deviceTarget)` to get the device-filtered list
- System prompt says "Helix LT preset" or "Pod Go preset" based on deviceTarget

**Confidence:** HIGH — the model list is already a parameter; this is a 3-line change.

---

### models.ts — Shared Database with Device Flags

**Decision: Single database, add `devices` flag per model. Do not fork.**

Forking models.ts into `helix-models.ts` and `podgo-models.ts` creates permanent duplication. Every new model added to one must be manually synced to the other. This is a maintenance anti-pattern.

Instead, add a `devices` field to `HelixModel`:

```typescript
export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  ampCategory?: AmpCategory;
  topology?: TopologyTag;
  cabAffinity?: string[];
  defaultParams: Record<string, number>;
  blockType: number;
  devices?: DeviceTarget[];  // NEW: which devices support this model
                             // undefined = all devices (backwards compatible)
}
```

`devices: undefined` means available everywhere (backwards-compatible, no existing entries break). Pod Go-only or Helix-only models can be flagged explicitly.

A new helper function `getModelsForDevice(deviceTarget)` returns the filtered subset. `getModelListForPrompt(deviceTarget?)` uses this to build the prompt's allowed model list.

**Pod Go model subset reality:** Pod Go firmware 2.50 has 50+ guitar amp models. Most names match Helix exactly (same HD2_ IDs). Three effects are absent: Tone Sovereign, Clawthorn Drive, Cosmos Echo. All distortions/dynamics/pitch are mono only. Bass amps are present but not relevant to this app. The specific list of omitted models requires a Pod Go Edit export to confirm exhaustively — flag this as needing verification during implementation.

**Confidence:** HIGH for the architecture. MEDIUM for the exact list of excluded models.

---

### chain-rules.ts — Shared, Add Pod Go Path Guard

**Decision: Shared module, add device-aware block limit validation.**

`assembleSignalChain()` is device-agnostic in its model resolution logic. The signal chain slot ordering (wah > drive > boost > amp > cab > gate > eq > mod > delay > reverb > gain) applies to Pod Go too.

What changes: the block limit check.

Currently:
```typescript
const MAX_BLOCKS_PER_DSP = 8;
// validates dsp0 and dsp1 separately
```

Pod Go needs:
- Only dsp0 (no dsp1 blocks)
- Maximum 4 assignable effect slots (the 6 fixed blocks don't count against BlockSpec limits because they are implicit in the device — they don't appear in the .pgp's user block list the same way)

**Recommended approach:** Pass `deviceTarget` into `assembleSignalChain(intent, deviceTarget)`. Add a Pod Go path that:
1. Forces all blocks to `dsp: 0` (no dsp1 assignment)
2. Validates against a 4-effect-block limit (amp, cab, eq, wah, volume, gate are fixed/free — only the 4 user effects count toward the assignable limit)
3. Still inserts mandatory blocks (boost, Parametric EQ, Gain Block) but treats them as fixed-position Pod Go blocks

**Critical nuance on Pod Go fixed blocks:** Pod Go's fixed EQ block is already present on the device. If the Knowledge Layer inserts a Parametric EQ into the chain, it occupies one of the 4 assignable slots on Pod Go (because it is placed as a user block, not the device's built-in EQ). This means the 4-slot budget is tighter than it looks. Consider whether Pod Go presets should use the built-in EQ slot (by not inserting a separate EQ BlockSpec) or insert it anyway and accept it consumes one assignable slot.

**Recommended:** For Pod Go, skip inserting a separate Parametric EQ BlockSpec. The device's built-in EQ position is always present and can be configured via the fixed block mechanism in the .pgp builder. This preserves all 4 assignable slots for user effects.

Similarly, the Gain Block (volume pedal) is a fixed Pod Go block — do not insert it as a user BlockSpec for Pod Go presets.

**Confidence:** HIGH for the architecture approach. MEDIUM for the exact fixed-block mechanics until a real .pgp file is inspected.

---

### param-engine.ts — Shared, No Changes Required

**Decision: Fully shared, no modification needed.**

`resolveParameters()` operates on BlockSpec arrays. It does not care about device target. The 3-layer resolution (model defaults → category overrides → genre overrides) produces correct numeric values for any Helix-family device. The underlying parameter encoding (normalized 0-1 floats, Hz-encoded LowCut/HighCut, integer Mic index) is identical between Helix and Pod Go — they share the same HX modeling engine.

No changes to param-engine.ts.

**Confidence:** HIGH.

---

### snapshot-engine.ts — Shared, Snapshot Count Adaptation

**Decision: Shared module, caller passes correct intent count.**

`buildSnapshots(chain, intents)` accepts any array of `SnapshotIntent` objects. It does not hardcode 8 snapshots — it maps over whatever the caller provides. The existing 4-snapshot output for Helix is already the correct count for Pod Go.

The Helix preset-builder generates 8 snapshot slots (snapshot0-snapshot7), marking slots 4-7 as `@valid: false`. The Pod Go preset-builder will only need to write snapshot0-snapshot3.

No changes to snapshot-engine.ts. The route.ts already passes exactly 4 SnapshotIntents (enforced by ToneIntent schema `min(4).max(4)`).

**Confidence:** HIGH.

---

### validate.ts — Fork (Add Pod Go Validator)

**Decision: New function `validatePodGoPresetSpec()`, keep existing `validatePresetSpec()` for Helix.**

The Pod Go validation rules differ:
- No dsp1 blocks allowed
- Max 4 user-effect blocks (amp, cab, and fixed-position blocks don't count)
- Model IDs must be in the Pod Go subset

```typescript
// validate.ts additions
export function validatePodGoPresetSpec(spec: PresetSpec): void {
  // 1. No dsp1 blocks
  const dsp1Blocks = spec.signalChain.filter(b => b.dsp === 1);
  if (dsp1Blocks.length > 0) {
    throw new Error(`Pod Go preset has dsp1 blocks — Pod Go is single-path only`);
  }

  // 2. User effect slot limit (4 assignable)
  const userEffectTypes = new Set(["distortion", "delay", "reverb", "modulation", "wah", "pitch", "dynamics"]);
  const userEffectCount = spec.signalChain.filter(b => userEffectTypes.has(b.type)).length;
  if (userEffectCount > 4) {
    throw new Error(`Pod Go preset has ${userEffectCount} user effects — max 4 assignable slots`);
  }

  // 3. Model IDs valid for Pod Go
  // (use getModelsForDevice("pod_go") set)
  ...
}
```

**Confidence:** HIGH for the approach. Implementation details depend on .pgp inspection.

---

### preset-builder.ts — Fork (New podgo-builder.ts)

**Decision: New file `podgo-builder.ts`. Do not modify Helix's `preset-builder.ts`.**

This is the highest-impact change. The .pgp file format differs from .hlx in ways that are not parameterizable:

1. **File extension and schema name:** `.pgp` vs `.hlx`, likely different schema field
2. **Device ID:** Different numeric device identifier (must be verified from a real .pgp export)
3. **Single DSP only:** No dsp1 section in the tone object
4. **Snapshot count:** Only snapshot0-snapshot3 (4 slots)
5. **Fixed block handling:** Amp, cab, wah, volume, FX loop, EQ have special positions in Pod Go's JSON that differ from Helix's block0/block1 pattern
6. **Footswitch layout:** Pod Go uses FS1, FS2, FS4, FS5, FS6 (not Helix's FS5-FS8 layout)
7. **Topology fields:** No @topology1 (single path); @topology0 behavior may differ
8. **Firmware version fields:** Different device_version, build_sha values

The new file:
```typescript
// src/lib/helix/podgo-builder.ts
export function buildPgpFile(spec: PresetSpec, device: "pod_go" | "pod_go_wireless"): PgpFile {
  // ...
}
```

**PgpFile type:** Needs its own interface. Until a real .pgp is inspected, define it as a type alias or extend HlxFile with overrides. Post-inspection, create proper `PgpFile` and `PgpTone` interfaces alongside the existing types.

**Critical first step:** Before writing podgo-builder.ts, open a real .pgp file from POD Go Edit in a text editor and capture the exact JSON structure. This is a 5-minute task that unlocks all builder decisions. Without this, any builder is guesswork.

**Where to put it:** `src/lib/helix/podgo-builder.ts` — same directory as `preset-builder.ts`. The `helix/` directory is already established as the Knowledge Layer directory. Renaming it to `device/` would be premature — both devices share the same HD2 engine.

**Confidence:** HIGH that a separate builder is needed. LOW on specific .pgp field names until a real file is inspected.

---

### types.ts — Extend DeviceTarget, Add PgpFile Types

**Decision: Add `pod_go` and `pod_go_wireless` to DeviceTarget. Add PgpFile interfaces.**

```typescript
// Current:
export type DeviceTarget = "helix_lt" | "helix_floor";

// New:
export type DeviceTarget = "helix_lt" | "helix_floor" | "pod_go" | "pod_go_wireless";

export const DEVICE_IDS: Record<DeviceTarget, number> = {
  helix_lt: 2162692,
  helix_floor: 2162688,
  pod_go: 0,           // PLACEHOLDER — verify from real .pgp export
  pod_go_wireless: 0,  // PLACEHOLDER — verify from real .pgp export
};
```

New PgpFile interfaces live in types.ts alongside HlxFile. They share the snapshot-related types (HlxSnapshot, HlxControllerSection) where field names overlap.

**Confidence:** HIGH for the approach. Specific device IDs are PLACEHOLDER until verified.

---

### route.ts — Route Branching by Device

**Decision: Single route, device-conditional builder call.**

```typescript
// api/generate/route.ts
const deviceTarget: DeviceTarget = parseDeviceTarget(device);
const isHelixDevice = deviceTarget === "helix_lt" || deviceTarget === "helix_floor";
const isPodGoDevice = deviceTarget === "pod_go" || deviceTarget === "pod_go_wireless";

// Steps 1-3 are shared (chain, params, snapshots)
const chain = assembleSignalChain(toneIntent, deviceTarget);
const parameterized = resolveParameters(chain, toneIntent);
const snapshots = buildSnapshots(parameterized, toneIntent.snapshots);

// Step 4: Device-specific build
let presetFile: HlxFile | PgpFile;
if (isHelixDevice) {
  validatePresetSpec(presetSpec);
  presetFile = buildHlxFile(presetSpec, deviceTarget);
} else if (isPodGoDevice) {
  validatePodGoPresetSpec(presetSpec);
  presetFile = buildPgpFile(presetSpec, deviceTarget);
}
```

The response JSON changes: instead of always returning a `.hlx` file, it returns `.pgp` or `.hlx` based on device. The frontend download link must use the correct extension.

**Confidence:** HIGH.

---

### Frontend (page.tsx) — Add Pod Go to Device Selector

**Decision: Extend existing device selector array.**

```typescript
// Current:
const [selectedDevice, setSelectedDevice] = useState<"helix_lt" | "helix_floor">("helix_lt");

// New:
const [selectedDevice, setSelectedDevice] = useState<DeviceTarget>("helix_lt");

// Device selector buttons:
{(["helix_lt", "helix_floor", "pod_go", "pod_go_wireless"] as const).map((device) => (
  // display names: "Helix LT", "Helix Floor", "Pod Go", "Pod Go Wireless"
))}
```

The download button must use `.pgp` extension for Pod Go devices and `.hlx` for Helix devices.

The signal chain visualization (VizBlock, dsp labels) currently shows "Path 1 (DSP 1)" and "Path 2 (DSP 2)". For Pod Go, only Path 1 exists. The visualization conditionally hides DSP 2.

**Confidence:** HIGH.

---

## Complete Data Flow: Pod Go Path

```
User Chat
        |
        | conversation + deviceTarget="pod_go"
        v
callClaudePlanner(messages, deviceTarget)
        |
        | uses getModelListForPrompt("pod_go") — Pod Go model subset
        | ToneIntent (same 15 fields, Pod Go-valid model names only)
        v
assembleSignalChain(intent, deviceTarget)
        |
        | Pod Go mode: all blocks → dsp0, no dsp1
        | No Parametric EQ BlockSpec (fixed device block)
        | No Gain Block BlockSpec (fixed device block)
        | Max 4 user-effect blocks validated
        | BlockSpec[] (all dsp:0, max 4 user effects + amp + cab + boost + gate)
        v
resolveParameters(chain, intent)           ← UNCHANGED
        |
        | BlockSpec[] with all parameters filled
        v
buildSnapshots(parameterized, intents)     ← UNCHANGED
        |
        | SnapshotSpec[] (4 snapshots only, snapshot0-snapshot3)
        v
validatePodGoPresetSpec(presetSpec)        ← NEW
        |
        v
buildPgpFile(presetSpec, deviceTarget)     ← NEW
        |
        | PgpFile JSON
        v
POST /api/generate response
        |
        | preset (PgpFile), summary, spec, toneIntent, device
        v
page.tsx: download as .pgp
```

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (page.tsx)                     │
│  Device Selector: [Helix LT] [Helix Floor] [Pod Go] [Pod Go W]│
└─────────────────────┬───────────────────────────────────────┘
                      │ POST /api/generate { messages, device }
┌─────────────────────▼───────────────────────────────────────┐
│              API Route (route.ts) — branching point          │
│  callClaudePlanner(messages, deviceTarget)                   │
│  assembleSignalChain ← SHARED (device-aware limits)         │
│  resolveParameters  ← SHARED (unchanged)                    │
│  buildSnapshots     ← SHARED (unchanged)                    │
│                                                              │
│  if helix:   validatePresetSpec → buildHlxFile → .hlx       │
│  if pod_go:  validatePodGoPresetSpec → buildPgpFile → .pgp  │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              Knowledge Layer (src/lib/helix/)                │
│                                                              │
│  SHARED (no/minor changes):                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐    │
│  │ chain-rules │  │ param-engine │  │ snapshot-engine │    │
│  └─────────────┘  └──────────────┘  └─────────────────┘    │
│                                                              │
│  EXTENDED:                                                   │
│  ┌──────────┐  ┌─────────────────────────────────────────┐  │
│  │ models   │  │ types (DeviceTarget + PgpFile ifaces)   │  │
│  │ +devices │  └─────────────────────────────────────────┘  │
│  │  flag   │                                                 │
│  └──────────┘                                                │
│                                                              │
│  NEW:                                                        │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ podgo-builder.ts │  │ validate (+ Pod Go validator fn) │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│                                                              │
│  UNCHANGED:                                                  │
│  ┌───────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ preset-builder│  │  config    │  │  param-registry    │  │
│  └───────────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 Model Database (models.ts)                    │
│  HD2_Amp* / HD2_Cab* / HD2_Dist* / HD2_Delay* / ...         │
│  HelixModel.devices?: DeviceTarget[]                         │
│  getModelsForDevice(target) → filtered subset               │
└─────────────────────────────────────────────────────────────┘
```

---

## Recommended Project Structure (After Pod Go Milestone)

```
src/lib/helix/
├── types.ts              EXTENDED — DeviceTarget, DEVICE_IDS, PgpFile interfaces
├── models.ts             EXTENDED — HelixModel.devices field, getModelsForDevice()
├── tone-intent.ts        UNCHANGED — ToneIntentSchema is device-agnostic
├── chain-rules.ts        MODIFIED — device-aware block limit, dsp assignment
├── param-engine.ts       UNCHANGED
├── snapshot-engine.ts    UNCHANGED
├── preset-builder.ts     UNCHANGED — Helix-specific .hlx builder
├── podgo-builder.ts      NEW — Pod Go-specific .pgp builder
├── validate.ts           MODIFIED — adds validatePodGoPresetSpec()
├── config.ts             MODIFIED — adds Pod Go firmware version constants
├── planner.ts            MODIFIED — passes deviceTarget, device-filtered model list
├── param-registry.ts     UNCHANGED
└── index.ts              MODIFIED — exports new Pod Go symbols
```

---

## Architectural Patterns

### Pattern 1: Device-Conditional at the Edges, Shared in the Middle

**What:** Route.ts branches by device at call-in and call-out. The Knowledge Layer pipeline (chain-rules, param-engine, snapshot-engine) stays device-agnostic. Device-specific logic lives only in the builder and validator.

**When to use:** When the core computation is identical and only the output format and input constraints differ.

**Trade-offs:** Adds a small device context threading requirement (DeviceTarget flows into assembleSignalChain and planner) but avoids duplicating the entire pipeline.

**Example:**
```typescript
// route.ts — branch only at builder stage
const chain = assembleSignalChain(toneIntent, deviceTarget);  // context-aware limits
const parameterized = resolveParameters(chain, toneIntent);   // identical
const snapshots = buildSnapshots(parameterized, toneIntent.snapshots); // identical

// Branch at builder
const file = isHelixDevice
  ? buildHlxFile(presetSpec, deviceTarget)
  : buildPgpFile(presetSpec, deviceTarget);
```

### Pattern 2: Shared Model Database with Device Flags

**What:** Single `models.ts` with per-model `devices?: DeviceTarget[]` property. `undefined` means all devices.

**When to use:** When model data is mostly shared and per-device differences are sparse exceptions.

**Trade-offs:** Slightly more complex filtering logic but eliminates sync problems between two separate databases.

**Example:**
```typescript
// Models available everywhere (devices undefined = all)
"US Deluxe Nrm": { id: "HD2_AmpUSDeluxeNrm", ..., devices: undefined }

// Model exclusive to Helix (not on Pod Go)
"Tone Sovereign": { id: "HD2_DistToneSovereign", ..., devices: ["helix_lt", "helix_floor"] }

// Hypothetical Pod Go-only model
"PG Exclusive": { id: "HD2_PGExclusive", ..., devices: ["pod_go", "pod_go_wireless"] }
```

### Pattern 3: File Format Discovery Before Builder Implementation

**What:** Before writing `podgo-builder.ts`, export one preset from Pod Go Edit and inspect the raw JSON to capture exact field names, nesting structure, and device ID.

**When to use:** Always, when the output format is reverse-engineered rather than officially documented.

**Trade-offs:** 5-minute task that prevents weeks of debugging incorrect .pgp structure.

**Example discovery checklist:**
- What is `data.device` numeric value for pod_go vs pod_go_wireless?
- Is the schema still `"L6Preset"` or something else?
- Is there a `dsp1` key present (even empty) or entirely absent?
- How are the 6 fixed blocks (wah, volume, FX loop, amp, cab, EQ) represented?
- Are snapshot keys snapshot0-snapshot3 or snapshot1-snapshot4?
- What firmware version fields (device_version, appversion, build_sha) should be used?

---

## Anti-Patterns

### Anti-Pattern 1: Forking chain-rules.ts and param-engine.ts

**What people do:** Copy chain-rules.ts to podgo-chain-rules.ts and param-engine.ts to podgo-param-engine.ts to handle Pod Go differences.

**Why it's wrong:** These modules are the most complex and well-tested in the codebase. Forking them doubles the surface area for bugs and means every future improvement (new genre profiles, new topology handling) must be applied twice. Pod Go's differences are primarily output-format constraints (single DSP, fewer blocks) not algorithmic differences.

**Do this instead:** Pass `deviceTarget` as a parameter and add a small device-conditional block at the constraint-check point. The core logic is shared.

### Anti-Pattern 2: Writing podgo-builder.ts Without Inspecting a Real .pgp File

**What people do:** Look at the .hlx format, assume .pgp is structurally similar, and write the builder based on that assumption.

**Why it's wrong:** Community sources confirm .pgp is JSON and shares some field names with .hlx, but the device ID, topology fields, fixed block representation, and snapshot count all differ. Building without verification risks producing files that import as "incompatible device."

**Do this instead:** Export one preset from Pod Go Edit, open it in a text editor, and verify the structure before writing a single line of `podgo-builder.ts`. This is the single highest-value step in the entire milestone.

### Anti-Pattern 3: Adding Pod Go Logic to ToneIntentSchema

**What people do:** Add a `deviceTarget` field to ToneIntent, then use it inside chain-rules and param-engine to branch behavior.

**Why it's wrong:** ToneIntent is the AI output contract. Polluting it with infrastructure concerns (which device the user selected) conflates creative intent with execution context. The device selection is a UI concern that flows through route.ts, not through Claude's output.

**Do this instead:** Thread `deviceTarget` as a separate function parameter through the Knowledge Layer functions that need it. Keep ToneIntentSchema clean.

### Anti-Pattern 4: Single models.ts Split Into Two Files

**What people do:** Create `helix-models.ts` and `podgo-models.ts`.

**Why it's wrong:** Synchronization hell. Pod Go uses ~95% of the same models as Helix. Maintaining two files that are mostly identical creates guaranteed drift.

**Do this instead:** Single models.ts with `devices` flag. Pod Go gets a filtered view via `getModelsForDevice("pod_go")`.

---

## Build Order

The build order is constrained by dependencies. Each step can only proceed after its prerequisites are done.

### Phase 1: Foundation (No Risk, No Unknown)

**Step 1.1: Inspect a real .pgp file**
Before any code. Open Pod Go Edit, create a minimal preset (one amp, one reverb, 4 snapshots), export it, open the .pgp in a text editor. Document: device ID, schema name, exact field structure, snapshot key naming, fixed block representation.

This step has zero code risk and eliminates all LOW-confidence assumptions about the file format.

**Step 1.2: Extend types.ts**
- Add `pod_go` and `pod_go_wireless` to DeviceTarget
- Add PgpFile interface (from .pgp inspection)
- Add DEVICE_IDS for Pod Go (from .pgp inspection)
- Create PgpTone, PgpDsp interfaces

**Step 1.3: Extend models.ts**
- Add `devices?: DeviceTarget[]` to HelixModel interface
- Add `getModelsForDevice(target)` helper
- Mark Pod Go-excluded models (Tone Sovereign, Clawthorn Drive, Cosmos Echo) with `devices: ["helix_lt", "helix_floor"]`
- Update `getModelListForPrompt(deviceTarget?)` to use device filtering

No tests break. No existing behavior changes (undefined = all devices).

### Phase 2: Knowledge Layer Adaptation (Low Risk)

**Step 2.1: Modify chain-rules.ts**
- Add `deviceTarget` parameter to `assembleSignalChain(intent, deviceTarget)`
- Pod Go path: all blocks forced to dsp:0; no dsp1
- Pod Go path: skip Parametric EQ BlockSpec (use fixed device EQ)
- Pod Go path: skip Gain Block BlockSpec (use fixed device volume)
- Pod Go path: validate max 4 user effect blocks
- Update chain-rules.test.ts with Pod Go test cases

**Step 2.2: Modify planner.ts**
- Add `deviceTarget` parameter to `callClaudePlanner(messages, deviceTarget)`
- Pass deviceTarget to `getModelListForPrompt(deviceTarget)`
- Update system prompt to say "Pod Go preset" vs "Helix LT preset"

### Phase 3: New Components (Medium Risk — File Format Uncertainty)

**Step 3.1: Write podgo-builder.ts**
- Uses findings from Step 1.1 (real .pgp inspection)
- `buildPgpFile(spec, device)` → PgpFile
- Single DSP section only
- 4 snapshots only (snapshot0-snapshot3)
- Pod Go footswitch layout (FS1, FS2, FS4, FS5, FS6)
- Correct device ID and firmware version fields

**Step 3.2: Add validatePodGoPresetSpec() to validate.ts**
- No dsp1 blocks
- Max 4 user effects
- Model IDs valid for Pod Go

### Phase 4: Integration and Wiring

**Step 4.1: Modify route.ts**
- Parse `pod_go` and `pod_go_wireless` device values
- Branch at builder stage
- Return correct file extension in response

**Step 4.2: Modify page.tsx**
- Add Pod Go options to device selector
- Use `.pgp` extension for Pod Go downloads
- Conditionally hide DSP 2 row in signal chain visualization

**Step 4.3: Update index.ts**
- Export new Pod Go symbols
- Export PgpFile type, buildPgpFile, validatePodGoPresetSpec

### Phase 5: Testing

**Step 5.1: Integration test**
- Generate a Pod Go preset end-to-end
- Import the .pgp file into POD Go Edit on hardware
- Verify it loads without "incompatible device" error
- Verify signal chain, snapshots, and block assignments are correct

**Step 5.2: Regression test**
- Verify existing Helix LT and Helix Floor generation still works unchanged
- Run existing test suite

---

## Integration Points

### External Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Claude API ↔ planner.ts | Structured output (zodOutputFormat) | ToneIntentSchema unchanged; only model list changes |
| route.ts ↔ chain-rules | Function call with new deviceTarget param | Backwards-compatible if deviceTarget defaults to "helix_lt" |
| route.ts ↔ podgo-builder | Direct function call | New dependency |
| page.tsx ↔ /api/generate | POST body adds no new fields; response same shape | file content and extension differ per device |

### Internal Boundaries

| Module A | Module B | Change | Notes |
|----------|----------|--------|-------|
| route.ts | planner.ts | Modified | deviceTarget threads through |
| route.ts | chain-rules | Modified | deviceTarget parameter added |
| route.ts | podgo-builder | New | new import |
| route.ts | validate.ts | Modified | calls validatePodGoPresetSpec |
| models.ts | tone-intent.ts | Modified | getModelListForPrompt(deviceTarget?) |
| param-engine.ts | models.ts | Unchanged | no interface changes affect param-engine |
| snapshot-engine.ts | — | Unchanged | fully device-agnostic |

---

## Scaling Considerations

| Scale | Architecture Adjustment |
|-------|------------------------|
| 2 devices (now) | Single builder per device, shared Knowledge Layer |
| 3-4 devices (HX Stomp, Helix Native) | Same pattern — new *-builder.ts per device, shared core |
| 5+ devices | Consider a builder registry pattern: `BUILDERS: Record<DeviceTarget, BuilderFn>` |

The current architecture supports 3-4 devices without structural changes. A builder registry only becomes valuable when the number of devices makes the if/else chain in route.ts unwieldy.

---

## Gaps and Open Questions

| Question | Impact | Resolution |
|----------|--------|------------|
| Exact .pgp device ID for pod_go and pod_go_wireless | Blocks podgo-builder.ts | Step 1.1: inspect real .pgp file |
| Exact .pgp JSON schema name (is it "L6Preset"?) | Blocks PgpFile type | Step 1.1 |
| How Pod Go's fixed blocks appear in .pgp JSON | Blocks podgo-builder.ts | Step 1.1 |
| Complete list of models absent from Pod Go | Affects model flag completeness | Inspect Pod Go Edit's model browser or a full Pod Go preset |
| Pod Go firmware version constants (device_version, build_sha) | Blocks config.ts for Pod Go | Step 1.1 |
| Are Pod Go snapshot keys 0-indexed (snapshot0) or 1-indexed? | Affects podgo-builder.ts | Step 1.1 |

All gaps resolve from a single 5-minute action: exporting and inspecting one real .pgp file. This is the critical path blocker for the entire milestone.

---

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Pod Go hardware constraints (single DSP, 4 slots, 4 snapshots) | HIGH | Line 6 official FAQ + multiple community sources confirm |
| .pgp is JSON format | HIGH | Community members confirmed, converter tools exist |
| Model names/IDs are same HD2_ namespace | HIGH | Line 6 states same HX engine; Pod Go is subset |
| ToneIntent unchanged | HIGH | Design invariant — device is execution context, not intent |
| param-engine, snapshot-engine fully shared | HIGH | No device-specific logic exists in these modules |
| Specific .pgp field names and device ID | LOW | No official docs; requires real file inspection |
| Exact Pod Go model exclusion list | MEDIUM | Known exclusions documented; exhaustive list needs verification |
| Fixed block representation in .pgp | LOW | Inferred from architecture; requires real file inspection |

---

## Sources

- [POD Go Block Restrictions — Line 6 Community](https://line6.com/support/topic/62007-pod-go-block-restrictions/)
- [POD Go FAQ — Line 6 Knowledge Base](https://kb.line6.com/kb/live/pod-go-faq)
- [POD Go vs. Helix HX — Line 6 Community](https://line6.com/support/topic/58152-pod-go-vs-helix-hx/)
- [POD Go Signal Flow Logic — Line 6 Community](https://line6.com/support/topic/56557-signal-flow-logic/)
- [Fileformats, Custom Tools and API — Line 6 Community](https://line6.com/support/topic/63502-fileformats-custom-tools-and-api/)
- [POD Go / Helix Converter — Line 6 Community](https://line6.com/support/topic/64226-pod-gohelix-converter/)
- [Zavsek POD_GO-Helix_converter — GitHub](https://github.com/Zavsek/POD_GO-Helix_converter)
- [POD Go Models Page — Line 6](https://line6.com/podgo-models/)
- [POD Go FAQ Page 4 — Line 6 Community](https://line6.com/support/topic/53806-pod-go-faq/page/4/)
- [Pod Go DSP Use of Every Block — Ivan Pesut](https://buymeacoffee.com/ivanpe/line-6-pod-go-dsp-use-of-every-block)
- Direct codebase inspection: src/lib/helix/* (2026-03-02)

---

*Architecture research for: HelixAI — Pod Go integration milestone*
*Researched: 2026-03-02*
