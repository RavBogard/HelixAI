# Phase 67: Stadium Integration Quality - Research

**Researched:** 2026-03-06
**Domain:** TypeScript catalog/schema alignment, prompt content quality, integration testing
**Confidence:** HIGH — all findings verified directly from source files in the working tree

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| STADQ-01 | WAH/VOLUME models in Stadium catalog + schema — Claude can generate Stadium presets with wah and volume pedals | `STADIUM_EFFECT_NAMES` construction in `stadium-catalog.ts`, `WAH_MODELS`/`VOLUME_MODELS` exports in `models.ts`, `getToneIntentSchema("stadium")` factory in `tone-intent.ts` |
| STADQ-02 | Dual-amp capability alignment — Stadium `dualAmpSupported` matches prompt and chain-rules behavior | `STADIUM_CAPABILITIES` in `device-family.ts` (currently `true`), prompt uses `includeSecondAmp: false`, chain-rules uses `AMP_MODELS` lookup (HD2 only) |
| STADQ-03 | Agoura amp-cab pairing in prompt — no TODO placeholder reaches Claude | `cabAffinity` arrays exist on all 18 STADIUM_AMPS entries in `models.ts`; prompt's TODO block is static string in `stadium/prompt.ts` |
| STADQ-04 | Schema/prompt integration tests verifying every prompt model name is a valid schema enum member | No such test exists; `getModelListForPrompt()` and `getToneIntentSchema()` are both importable; vitest infrastructure already present |
</phase_requirements>

---

## Summary

Phase 67 addresses four integration bugs discovered after merging the parallel v5.0 branches (Phases 61-65). These are precision fixes, not architectural changes. Every fix touches a small, well-bounded surface: one catalog file, one capabilities constant, one prompt string, and one new integration test file.

The four bugs form two categories. The first category is data correctness bugs: (1) `STADIUM_EFFECT_NAMES` omits WAH and VOLUME model names so the Zod schema rejects them even though the prompt exposes them, and (2) `STADIUM_CAPABILITIES.dualAmpSupported` is `true` but the Stadium prompt and chain-rules only support single-amp — a crash path exists if the field ever triggers. The second category is content quality bugs: (3) a `// TODO(Phase62)` comment block is sent verbatim to Claude as instruction content, but the Agoura `cabAffinity` pairing data already lives in `STADIUM_AMPS`, ready to use. The fourth bug is a test coverage gap: no test verifies prompt model names are a valid subset of the family's Zod schema enum.

**Primary recommendation:** Fix each bug at its exact root cause: add WAH/VOLUME to `STADIUM_EFFECT_NAMES`, set `dualAmpSupported: false` in `STADIUM_CAPABILITIES`, generate the amp-cab table from `STADIUM_AMPS[*].cabAffinity` in the prompt, and write one new integration test file that loops all families checking prompt-names ⊆ schema-enum.

---

## Standard Stack

No new libraries needed. This phase uses the project's existing stack exclusively.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | existing | Per-family ToneIntent schema factory | All constrained decoding goes through `getToneIntentSchema()` |
| vitest | ^4.0.18 | Test runner | Already configured in `vitest.config.ts` |
| TypeScript | existing | Compile-time correctness | `as const` tuples, exhaustive switches |

### No new installations needed
All required modules (`WAH_MODELS`, `VOLUME_MODELS`, `STADIUM_AMPS`, `getToneIntentSchema`, `getModelListForPrompt`, `getCapabilities`) are already exported and importable.

---

## Architecture Patterns

### Pattern 1: Adding to STADIUM_EFFECT_NAMES (STADQ-01)

**What:** `STADIUM_EFFECT_NAMES` is an `as const` tuple built by spreading Object.keys() from several model record objects. Adding WAH and VOLUME means spreading `WAH_MODELS` and `VOLUME_MODELS` keys into the same tuple.

**Current state in `src/lib/helix/catalogs/stadium-catalog.ts`:**
```typescript
// Lines 27-34 — current implementation
export const STADIUM_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
  ...Object.keys(STADIUM_EQ_MODELS),
] as [string, ...string[]];
```

**Fix:**
```typescript
import {
  STADIUM_AMPS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  STADIUM_EQ_MODELS,
  WAH_MODELS,    // ADD
  VOLUME_MODELS, // ADD
} from "../models";

export const STADIUM_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
  ...Object.keys(STADIUM_EQ_MODELS),
  ...Object.keys(WAH_MODELS),    // ADD
  ...Object.keys(VOLUME_MODELS), // ADD
] as [string, ...string[]];
```

**Test update required:** `stadium-catalog.test.ts` currently has two tests asserting NO overlap with WAH_MODELS and VOLUME_MODELS keys. These tests must be inverted to assert CONTAINS (or replaced with coverage-of-WAH/VOLUME tests). The existing tests enforce the old decision [62-01] that is now being superseded for Stadium.

Decision [62-01] stated "EQ, WAH, VOLUME block types excluded from all EFFECT_NAMES tuples — handled silently by Knowledge Layer chain-rules." This decision is being overridden for Stadium only by STADQ-01. The other families (helix, stomp, podgo) should keep WAH/VOLUME excluded per [62-01] unless explicitly changed.

**Why chain-rules already handles this correctly:** `resolveEffectModel()` in `chain-rules.ts` already searches `WAH_MODELS` and `VOLUME_MODELS` for all devices (lines 83-84). The gap is only in the Zod schema enum (which derives from `STADIUM_EFFECT_NAMES`). Once WAH/VOLUME names are in the enum, chain-rules can resolve them.

### Pattern 2: Fixing dualAmpSupported (STADQ-02)

**What:** `STADIUM_CAPABILITIES` at line 189 in `device-family.ts` has `dualAmpSupported: true`. This contradicts all three downstream consumers:
- Stadium prompt: `includeSecondAmp: false` (line 32 in `stadium/prompt.ts`)
- Chain-rules: the dual-amp code path at line 353 does `AMP_MODELS[intent.secondAmpName!]` — HD2 lookup only; an Agoura amp name would throw "Unknown second amp model"
- Stadium builder: single-path builder, no dual-amp wiring

**Fix:** Set `dualAmpSupported: false` in `STADIUM_CAPABILITIES`:
```typescript
const STADIUM_CAPABILITIES: DeviceCapabilities = {
  family: "stadium",
  dspCount: 1,
  maxBlocksPerDsp: 48,
  maxBlocksTotal: 48,
  maxSnapshots: STADIUM_CONFIG.STADIUM_MAX_SNAPSHOTS,
  dualAmpSupported: false,  // CHANGE from true — Stadium is single-amp; prompt uses includeSecondAmp: false
  pathCount: 4,
  // ... rest unchanged
```

**Also fix misleading comment in chain-rules.ts:** Line 352 says "Dual-amp is only for Helix LT/Floor (isDualAmp guard excludes Stadium/Stomp/PodGo)". This comment becomes accurate once `dualAmpSupported: false` is set — because `isDualAmp = !!(intent.secondAmpName && intent.secondCabName && caps.dualAmpSupported)` will evaluate to false for Stadium.

**Test update:** No test currently asserts `STADIUM_CAPABILITIES.dualAmpSupported === false`. The `device-family.test.ts` should gain a test asserting this after the fix.

### Pattern 3: Replace TODO with Real Amp-Cab Pairing Table (STADQ-03)

**What:** `stadium/prompt.ts` contains this literal text at line 52-55 that is sent to Claude verbatim:

```typescript
// TODO(Phase62): populate Agoura amp-to-cab pairing table from per-family catalog.
// Stadium uses Agoura_* amps with Stadium-specific cab models.
// Pairing data will be added when the Phase 62 Agoura catalog is finalized.

For now: choose a cab with matching era and speaker voicing for the selected amp.
```

**The data already exists:** Every entry in `STADIUM_AMPS` has a `cabAffinity: string[]` property listing the preferred cab names. Example:
- `"Agoura US Tweedman"` → `["1x12 Fullerton", "4x10 Tweed P10R"]`
- `"Agoura Brit Plexi"` → `["4x12 Greenback 25"]`
- `"Agoura German Xtra Red"` → `["4x12 Uber V30"]`

**Fix approach — generate the table from STADIUM_AMPS at prompt build time:**

```typescript
// In stadium/prompt.ts, import STADIUM_AMPS from models.ts
import { STADIUM_AMPS } from "@/lib/helix/models";

// Build the pairing table from cabAffinity fields
function buildAmpCabPairingTable(): string {
  const lines = Object.entries(STADIUM_AMPS)
    .filter(([, model]) => model.cabAffinity && model.cabAffinity.length > 0)
    .map(([name, model]) => `- **${name}**: ${model.cabAffinity!.join(", ")}`);
  return lines.join("\n");
}
```

Then replace the TODO block in `buildPlannerPrompt` with:
```typescript
## Amp-to-Cab Pairing

Pair each Agoura amp with its natural cabinet. These pairings match the speaker voicing for which each amp was designed:

${buildAmpCabPairingTable()}

Choosing the recommended cab improves FOH translation and ensures the amp's character is preserved.
```

**All 18 STADIUM_AMPS have cabAffinity data confirmed from reading models.ts.** No external data needed.

**Test update:** `stadium/prompt.test.ts` currently has a test `it("contains TODO(Phase62) placeholder for Agoura cab pairing")` that asserts `expect(prompt).toContain("TODO(Phase62)")`. This test must be replaced with a test asserting the placeholder is GONE and real pairing content is present.

### Pattern 4: Schema/Prompt Integration Test (STADQ-04)

**What:** A new integration test that verifies, for each device family, every model name that appears in the planner prompt's model list is a valid member of that family's Zod schema enum.

**Proposed test location:** `src/lib/helix/schema-prompt-alignment.test.ts` (new file)

**Test strategy — parse prompt sections vs schema:**
```typescript
import { describe, it, expect } from "vitest";
import { getToneIntentSchema } from "./tone-intent";
import { getModelListForPrompt } from "./models";
import { getCapabilities } from "./device-family";
import type { DeviceTarget } from "./types";

// Representative device per family
const FAMILY_DEVICES: DeviceTarget[] = [
  "helix_lt",       // helix
  "helix_stomp",    // stomp
  "pod_go",         // podgo
  "helix_stadium",  // stadium
];

describe("schema/prompt alignment — all families", () => {
  for (const device of FAMILY_DEVICES) {
    describe(`device: ${device}`, () => {
      const caps = getCapabilities(device);
      const modelListText = getModelListForPrompt(caps);
      const schema = getToneIntentSchema(caps.family);

      it("every effect name in prompt is accepted by schema effectName enum", () => {
        // Extract model names from prompt text
        // Lines starting with "  - " in sections that are effects (not amps or cabs)
        const effectNames = extractEffectNamesFromPrompt(modelListText);
        for (const name of effectNames) {
          const result = schema.safeParse({
            ampName: /* valid amp for family */,
            cabName: /* valid cab for family */,
            guitarType: "humbucker",
            effects: [{ modelName: name, role: "always_on" }],
            snapshots: [
              { name: "Clean", toneRole: "clean" },
              { name: "Rhythm", toneRole: "crunch" },
              { name: "Lead", toneRole: "lead" },
            ],
          });
          expect(result.success, `Effect "${name}" rejected by schema`).toBe(true);
        }
      });
    });
  }
});
```

**Implementation detail for `extractEffectNamesFromPrompt`:** The prompt text from `getModelListForPrompt()` formats each model as a line with the model name. The function needs to identify which sections are effect sections (not AMPS or CABS) and extract names from those lines.

**Alternative approach (simpler, lower coupling):** Instead of parsing prompt text, directly test that the sets are consistent: for Stadium, verify `WAH_MODELS` and `VOLUME_MODELS` keys are a subset of `STADIUM_EFFECT_NAMES`. This is narrower but fully deterministic.

**Recommended approach:** Do BOTH — the narrow direct enum test (simple, fast, zero parsing) plus the prompt-extraction integration test (catches future divergence). The direct enum test covers STADQ-04 mechanically; the integration test provides the cross-family regression guarantee.

### Anti-Patterns to Avoid

- **Don't add WAH/VOLUME to helix/stomp/podgo EFFECT_NAMES tuples.** Decision [62-01] is only being overridden for Stadium. The other families still rely on Knowledge Layer silent insertion for WAH/VOLUME.
- **Don't set `dualAmpSupported: true` for Stadium and try to make chain-rules work with Agoura amps in the second-amp path.** Stadium is single-amp hardware in prompt terms. The correct fix is `false`, not expanding chain-rules.
- **Don't hard-code the amp-cab table as a static string.** Generate it from `STADIUM_AMPS.cabAffinity` at prompt build time — this ensures the table stays in sync if amp entries change.
- **Don't forget to update existing tests that assert the OLD (buggy) behavior.** Three existing tests assert the bugs: two in `stadium-catalog.test.ts` (no WAH/VOLUME overlap), one in `stadium/prompt.test.ts` (TODO placeholder present). These must be updated, not left behind.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Amp-cab pairing data | Static lookup table separate from STADIUM_AMPS | Read `cabAffinity` from existing STADIUM_AMPS entries | Data already exists; avoid duplication |
| Schema enum validation in tests | Manual string comparison | `schema.safeParse()` with `result.success` | Zod handles enum validation correctly |
| Model name extraction from prompt | Complex regex parser | Direct import of WAH_MODELS/VOLUME_MODELS keys | Source of truth is the model record, not the rendered text |

**Key insight:** All the data needed for this phase already exists in the codebase. This is a wiring phase, not a data-gathering phase.

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update stadium-catalog.test.ts
**What goes wrong:** After adding WAH/VOLUME to STADIUM_EFFECT_NAMES, the two existing "no overlap" tests fail (they assert the opposite of the new behavior).
**Why it happens:** The tests were written to enforce decision [62-01] and correctly assert the old state.
**How to avoid:** Update the tests in the same commit as the catalog change — flip from "has no overlap" to "contains WAH model names" and "contains VOLUME model names."
**Warning signs:** CI failure on `stadium-catalog.test.ts` with "expected [] to equal [wah_name]" error.

### Pitfall 2: Forgetting to Update stadium/prompt.test.ts
**What goes wrong:** After replacing the TODO block in `stadium/prompt.ts`, the test `"contains TODO(Phase62) placeholder for Agoura cab pairing"` fails.
**Why it happens:** The test asserts the old (buggy) state.
**How to avoid:** Replace the test with one that asserts (a) the TODO string is absent and (b) a real amp name like "Agoura Brit Plexi" appears in the prompt's pairing section.
**Warning signs:** CI failure on `stadium/prompt.test.ts` with "expected true to be true" (toContain failure).

### Pitfall 3: Chain-Rules Dual-Amp Crash Path Still Present After capability fix
**What goes wrong:** Setting `dualAmpSupported: false` in STADIUM_CAPABILITIES prevents the `isDualAmp` path from triggering, but the comment on line 352 of `chain-rules.ts` still says "only for Helix LT/Floor" — this may mislead future developers into thinking the exclusion is explicit rather than capability-driven.
**Why it happens:** Comment divergence — the guard is dynamic but the comment implies it's static.
**How to avoid:** Update the chain-rules comment to say the guard is capability-driven, not device-name-driven.

### Pitfall 4: Amp-Cab Table Shows Cabs Not in STADIUM_CAB_NAMES
**What goes wrong:** `cabAffinity` arrays contain cab names like "1x12 Fullerton", "4x10 Tweed P10R" etc. These must be verified as keys in `CAB_MODELS` (which is what STADIUM_CAB_NAMES is built from).
**Why it happens:** `cabAffinity` was written during Phase 63 and might reference cab names that are in CAB_MODELS under slightly different keys.
**How to avoid:** Before writing the prompt table, verify that every `cabAffinity` entry for STADIUM_AMPS is a valid key in `CAB_MODELS`. Can be asserted in a test.
**Warning signs:** Claude generates a preset with a cab name from the pairing table that Zod's cabName enum rejects.

### Pitfall 5: Integration Test Requires a Valid Amp/Cab for Each Family
**What goes wrong:** The integration test (STADQ-04) needs a valid `ampName` and `cabName` for each family to construct a parseable ToneIntent when testing each effect name.
**Why it happens:** The schema requires all fields including `ampName` and `cabName`.
**How to avoid:** Import `STADIUM_AMP_NAMES[0]`, `HELIX_AMP_NAMES[0]`, etc. as the base payload, or use `getModelListForPrompt` to extract a valid amp name from the prompt text.

---

## Code Examples

### STADQ-01: How getToneIntentSchema("stadium") flows through to Zod enum
```typescript
// src/lib/helix/tone-intent.ts (existing code — unchanged)
export function getToneIntentSchema(family: DeviceFamily) {
  switch (family) {
    case "stadium":
      return buildToneIntentSchema(STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES);
    // ...
  }
}

// buildToneIntentSchema creates z.enum(effectNames)
// So STADIUM_EFFECT_NAMES IS the Zod enum source of truth for stadium effects
// Adding WAH_MODELS + VOLUME_MODELS keys to STADIUM_EFFECT_NAMES fixes the schema automatically
```

### STADQ-02: isDualAmp gate in chain-rules
```typescript
// src/lib/helix/chain-rules.ts line 347 (existing — no change needed here)
const isDualAmp = !!(intent.secondAmpName && intent.secondCabName && caps.dualAmpSupported);
// When dualAmpSupported: false, isDualAmp is always false for Stadium
// The AMP_MODELS lookup at line 353 never executes for Stadium — no crash

// Line 353 (existing crash path — safe after capability fix)
secondAmpModel = AMP_MODELS[intent.secondAmpName!]; // HD2 only — would throw on Agoura name
```

### STADQ-03: cabAffinity data already in STADIUM_AMPS
```typescript
// src/lib/helix/models.ts (existing data)
"Agoura Brit Plexi": {
  cabAffinity: ["4x12 Greenback 25"],  // <- this data is what the prompt table needs
  // ...
},
"Agoura German Xtra Red": {
  cabAffinity: ["4x12 Uber V30"],  // <- available for all 18 amp entries
  // ...
},
```

### STADQ-04: Verifying prompt names are subset of schema enum
```typescript
// Recommended minimal pattern for integration test
import { getToneIntentSchema } from "./tone-intent";
import { WAH_MODELS, VOLUME_MODELS, DISTORTION_MODELS } from "./models";
import { STADIUM_EFFECT_NAMES } from "./catalogs/stadium-catalog";

it("STADIUM_EFFECT_NAMES includes all WAH_MODELS keys", () => {
  const wahKeys = Object.keys(WAH_MODELS);
  for (const key of wahKeys) {
    expect(STADIUM_EFFECT_NAMES).toContain(key);
  }
});

it("STADIUM_EFFECT_NAMES includes all VOLUME_MODELS keys", () => {
  const volumeKeys = Object.keys(VOLUME_MODELS);
  for (const key of volumeKeys) {
    expect(STADIUM_EFFECT_NAMES).toContain(key);
  }
});

it("getToneIntentSchema('stadium') accepts WAH model names", () => {
  const schema = getToneIntentSchema("stadium");
  for (const wahName of Object.keys(WAH_MODELS)) {
    const result = schema.safeParse({
      ampName: STADIUM_AMP_NAMES[0],
      cabName: STADIUM_CAB_NAMES[0],
      guitarType: "humbucker",
      effects: [{ modelName: wahName, role: "always_on" }],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Rhythm", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
    });
    expect(result.success, `WAH model "${wahName}" should be accepted`).toBe(true);
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| WAH/VOLUME excluded from all EFFECT_NAMES (decision [62-01]) | Stadium overrides this for user-selectable WAH/VOLUME | Phase 67 | Stadium users can specify wah and volume pedals; other families unchanged |
| `dualAmpSupported: true` for Stadium | `dualAmpSupported: false` | Phase 67 | Eliminates crash path; aligns with prompt and builder reality |
| TODO placeholder for amp-cab table | Real pairing table generated from `cabAffinity` | Phase 67 | Claude receives actionable cab selection guidance |
| No cross-family schema/prompt alignment test | Integration test verifying prompt ⊆ schema | Phase 67 | Future catalog changes that break alignment will fail CI |

**Superseded decision:**
- [62-01]: "EQ, WAH, VOLUME block types excluded from all EFFECT_NAMES tuples" — PARTIALLY superseded. Stadium now includes WAH and VOLUME. Helix, Stomp, and Pod Go remain unchanged.

---

## File Change Map

| File | Change | Requirement |
|------|--------|-------------|
| `src/lib/helix/catalogs/stadium-catalog.ts` | Add WAH_MODELS + VOLUME_MODELS to STADIUM_EFFECT_NAMES | STADQ-01 |
| `src/lib/helix/catalogs/stadium-catalog.test.ts` | Replace "no WAH/VOLUME overlap" tests with "contains WAH/VOLUME" tests | STADQ-01 |
| `src/lib/helix/device-family.ts` | Set `dualAmpSupported: false` in STADIUM_CAPABILITIES | STADQ-02 |
| `src/lib/helix/device-family.test.ts` | Add test asserting `getCapabilities("helix_stadium").dualAmpSupported === false` | STADQ-02 |
| `src/lib/helix/chain-rules.ts` | Update comment on line 352 (no logic change) | STADQ-02 |
| `src/lib/families/stadium/prompt.ts` | Replace TODO block with generated amp-cab pairing table from cabAffinity; import STADIUM_AMPS | STADQ-03 |
| `src/lib/families/stadium/prompt.test.ts` | Replace "contains TODO(Phase62)" test with "does NOT contain TODO(Phase62)" + real pairing content test | STADQ-03 |
| `src/lib/helix/schema-prompt-alignment.test.ts` | New file: cross-family integration test verifying prompt names ⊆ schema enum | STADQ-04 |

**No new files needed except the integration test.** 8 file changes total (7 edits + 1 new test file).

---

## Open Questions

1. **Should cabAffinity validity be asserted in a test?**
   - What we know: STADIUM_AMPS entries have `cabAffinity: string[]` arrays with cab names
   - What's unclear: Are all cabAffinity strings valid keys in `CAB_MODELS` (and thus in `STADIUM_CAB_NAMES`)?
   - Recommendation: Add a test to `stadium-catalog.test.ts` that verifies every cabAffinity entry across all STADIUM_AMPS is a key in STADIUM_CAB_NAMES. This is a cheap guard against prompt-table / schema mismatch.

2. **Should the integration test (STADQ-04) use prompt-text parsing or direct enum comparison?**
   - What we know: Both approaches work; direct comparison is simpler and zero-parsing
   - What's unclear: Whether future prompt format changes would break a text-parsing approach
   - Recommendation: Use direct enum comparison (WAH_MODELS keys ⊆ STADIUM_EFFECT_NAMES, etc.) for STADQ-04. The cross-family approach via `getModelListForPrompt` parsing is valuable but more fragile; treat it as a bonus test rather than the primary verification.

3. **Does Stadium actually need dualAmpSupported in the future?**
   - What we know: Stadium hardware has 4 signal paths (`pathCount: 4`) but the prompt and builder are single-amp
   - What's unclear: Whether Stadium hardware physically supports dual amps or just 4 routing paths
   - Recommendation: Set `dualAmpSupported: false` now. If future research confirms Stadium supports dual amps with Agoura models, a future phase can: (a) update chain-rules to handle Agoura second-amp lookup, (b) set `includeSecondAmp: true` in the prompt, (c) re-enable `dualAmpSupported: true`. This is the safe default.

---

## Validation Architecture

No `workflow.nyquist_validation` key found in `.planning/config.json` — standard vitest infrastructure applies.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.18 |
| Config file | `vitest.config.ts` (root — alias `@` to `./src`) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |
| Single file run | `npx vitest run src/lib/helix/catalogs/stadium-catalog.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STADQ-01 | `STADIUM_EFFECT_NAMES` contains WAH model names | unit | `npx vitest run src/lib/helix/catalogs/stadium-catalog.test.ts` | ✅ (needs update) |
| STADQ-01 | `STADIUM_EFFECT_NAMES` contains VOLUME model names | unit | `npx vitest run src/lib/helix/catalogs/stadium-catalog.test.ts` | ✅ (needs update) |
| STADQ-01 | `getToneIntentSchema("stadium")` accepts WAH model names | unit | `npx vitest run src/lib/helix/tone-intent.test.ts` | ✅ (needs new test cases) |
| STADQ-02 | `getCapabilities("helix_stadium").dualAmpSupported === false` | unit | `npx vitest run src/lib/helix/device-family.test.ts` | ✅ (needs new test) |
| STADQ-03 | Stadium planner prompt does NOT contain "TODO(Phase62)" | unit | `npx vitest run src/lib/families/stadium/prompt.test.ts` | ✅ (needs update) |
| STADQ-03 | Stadium planner prompt contains amp-cab pairing content | unit | `npx vitest run src/lib/families/stadium/prompt.test.ts` | ✅ (needs new test) |
| STADQ-04 | Every WAH/VOLUME model name in Stadium prompt passes schema parse | integration | `npx vitest run src/lib/helix/schema-prompt-alignment.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/lib/helix/catalogs/stadium-catalog.test.ts src/lib/families/stadium/prompt.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/lib/helix/schema-prompt-alignment.test.ts` — covers STADQ-04 (new file, create in first task)

*(All other test files exist; only tests within them need updating, not new files except the integration test.)*

---

## Sources

### Primary (HIGH confidence)
- Direct source read: `src/lib/helix/catalogs/stadium-catalog.ts` — confirmed WAH/VOLUME exclusion
- Direct source read: `src/lib/helix/device-family.ts` — confirmed `dualAmpSupported: true` in STADIUM_CAPABILITIES
- Direct source read: `src/lib/families/stadium/prompt.ts` — confirmed TODO block at line 52, `includeSecondAmp: false` at line 32
- Direct source read: `src/lib/helix/models.ts` — confirmed `cabAffinity` arrays on all 18 STADIUM_AMPS entries, WAH_MODELS and VOLUME_MODELS exported
- Direct source read: `src/lib/helix/chain-rules.ts` — confirmed `AMP_MODELS` (HD2-only) lookup at line 353, `resolveEffectModel()` already searches WAH/VOLUME
- Direct source read: `src/lib/helix/tone-intent.ts` — confirmed `getToneIntentSchema("stadium")` uses `STADIUM_EFFECT_NAMES` as the Zod enum
- Direct source read: `src/lib/helix/catalogs/stadium-catalog.test.ts` — confirmed existing tests assert no WAH/VOLUME overlap (must flip)
- Direct source read: `src/lib/families/stadium/prompt.test.ts` — confirmed existing test asserts TODO present (must flip)

### Secondary (MEDIUM confidence)
- Decision log from STATE.md `[62-01]` — EQ/WAH/VOLUME excluded from EFFECT_NAMES; being partially superseded for Stadium only
- Decision log from STATE.md `[v5.0/P65]` — `includeSecondAmp: false` confirmed as an explicit prompt-authoring decision

---

## Metadata

**Confidence breakdown:**
- Bug identification: HIGH — all 4 bugs verified directly in source files
- Fix approach: HIGH — fix locations are precise, pattern is established (same structure as existing catalog entries)
- Test update requirements: HIGH — existing test assertions confirmed to contradict proposed fixes
- cabAffinity data completeness: HIGH — read all 18 STADIUM_AMPS entries, all have cabAffinity arrays

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable internal codebase — no external dependencies)
