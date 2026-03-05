# Phase 55: Planner Prompt Enrichment — Research

**Researched:** 2026-03-05
**Domain:** Prompt engineering for AI-guided guitar preset generation — `buildPlannerPrompt()` in `src/lib/planner.ts`
**Confidence:** HIGH

---

## Summary

Phase 55 is a pure prompt engineering phase. The target is a single function: `buildPlannerPrompt()` in `src/lib/planner.ts`. No schema changes, no Knowledge Layer changes, no new dependencies. The function returns a template-literal string that becomes the `cache_control: ephemeral` system prompt passed to Claude Sonnet 4.6 via `callClaudePlanner()`.

The three enrichments address three confirmed gaps: (1) the AI currently has no guidance on which boost pedal to pair with which gain level (Michael Weaver's ambient preset had Kinky Comp + Minotaur instead of reverb/delay — zero time-based effects); (2) the AI chooses cabs without reference to the historically correct amp-to-cab pairings that `cabAffinity` already encodes on models; (3) there is no genre-effect-count discipline, so ambient requests receive the same number of effects as metal requests by default, and wrong effect types are included.

The critical architectural constraint is cache integrity: the prompt is delivered with a single `cache_control: ephemeral` block, and that block covers the entire system prompt as a unit. Any conditional insertion inside `buildPlannerPrompt()` based on `device` (which already happens for Pod Go, Stadium, Stomp at the very end of the function) creates a separate cache bucket per device variant. **All three enrichment sections must live in the shared static prefix — the device-conditional blocks at the bottom of the prompt must remain untouched.** The existing `usage-logger.ts` and `cache-hit-report.ts` infrastructure provides the measurement tooling to verify cache hit rate before and after.

**Primary recommendation:** Add three new sections to the shared static prefix of `buildPlannerPrompt()` before the device-conditional `${podGo ? ...}` fragments. Sections: `## Gain-Staging Intelligence`, `## Amp-to-Cab Pairing`, and `## Effect Discipline by Genre`. Each section must contain factual, device-agnostic guidance. Measure cache hit rate before and after using `LOG_USAGE=true` + `npx tsx scripts/cache-hit-report.ts`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROMPT-01 | Planner prompt includes gain-staging intelligence section (Drive/Master/ChVol relationships per amp type) | FEATURES.md Finding 1: non-master-volume amps need Drive 0.55-0.70 and Master 1.0 explained to AI; current prompt says only "match amp to genre" with no boost-choice guidance |
| PROMPT-02 | Planner prompt includes amp-to-cab pairing guidance table | FEATURES.md Finding 2: full amp-family-to-cab table documented; cabAffinity field already exists on HelixModel but AI has no table to reference |
| PROMPT-03 | Planner prompt includes genre-appropriate effect discipline (counts and types) | FEATURES.md Finding 3: effect ordering already correct in chain-rules.ts; the gap is effect COUNT and TYPE guidance by genre; confirmed by Michael Weaver feedback (ambient with zero reverb/delay) |
| PROMPT-04 | Planner regression test baseline confirms no quality degradation from prompt changes | generate-baseline.ts + generate-baseline.test.ts already exist; cache-hit-report.ts already exists; need a planner.test.ts for `buildPlannerPrompt()` unit tests plus a pre/post baseline diff |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 | Already used for `callClaudePlanner()` | No change needed — prompt is a string parameter |
| TypeScript | ^5 | Source language | All edits are in `.ts` files |
| Vitest | ^4.0.18 | Test runner | Already used for all module tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `scripts/generate-baseline.ts` | project script | Deterministic 36-preset Knowledge Layer exercise | Run before prompt change as pre-baseline, after as post-baseline; diff for regressions |
| `scripts/cache-hit-report.ts` | project script | Parse `usage.jsonl` for cache hit statistics | Run after 10+ generation calls with `LOG_USAGE=true` to verify hit rate |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static text sections in shared prefix | Conditional per-device insertions | Conditional insertions fragment cache into 6 device buckets — each bucket gets lower hit frequency; static shared prefix is the only correct approach |
| Full amp pairing table in prompt | Runtime enforcement in chain-rules.ts | Option 2 (runtime enforcement) is a future Quality Gate (v4.1+); for v4.0 prompt enrichment is lower risk and sufficient |
| Single combined enrichment section | Three separate named sections | Named sections with `##` headings are easier for the model to reference and for developers to maintain independently |

**Installation:** No new packages required.

---

## Architecture Patterns

### How `buildPlannerPrompt()` Currently Structures the Prompt

```
[Line 38] return `You are HelixTones' Planner...
  ## Your Role            ← SHARED STATIC PREFIX begins here
  ## Valid Model Names    ← SHARED STATIC (but dynamic: ${modelList} is device-filtered)
  ## ToneIntent Fields    ← SHARED STATIC
  ## What You Do NOT Generate  ← SHARED STATIC
  ## Creative Guidelines  ← SHARED STATIC
  ## Dual-Amp Rules       ← SHARED STATIC
  ${podGo ? ... }         ← DEVICE-CONDITIONAL (cache bucket 1)
  ${stadium ? ... }       ← DEVICE-CONDITIONAL (cache bucket 2)
  ${stomp ? ... }         ← DEVICE-CONDITIONAL (cache bucket 3)
Based on the conversation...`  ← SUFFIX
```

The `${modelList}` interpolation already varies by device — but this is computed at the top of `buildPlannerPrompt()` via `getModelListForPrompt(device)`. Each unique `(modelList, device)` combination is its own cache bucket already. The device-conditional `${podGo ? ...}` appends additional text for specific devices — these are fine because they are at the end and only affect ~3 of the 6 device buckets.

**The enrichment must be inserted as static text in the "SHARED STATIC PREFIX" zone** — after `## Dual-Amp Rules` and before `${podGo ? ...}`. It must contain no template literal interpolations that vary by device.

### Pattern: Static Enrichment in Shared Prefix

**What:** Add three `##`-headed sections to the static prefix of the template literal.
**When to use:** Any guidance that applies equally to Helix LT, Floor, Pod Go, Stadium, Stomp — i.e., any amp-to-cab, gain-staging, or effect discipline guidance that is device-agnostic.

```typescript
// Source: src/lib/planner.ts — insert before ${podGo ? ...} conditional blocks
// CORRECT: Static text, no device interpolation
`## Gain-Staging Intelligence

Three parameters serve different roles — do not confuse them:

- **Drive**: On non-master-volume amps (Fender Deluxe, Vox AC30, Hiwatt), Drive IS the Volume
  knob — set it to 0.55-0.70 for edge-of-breakup character, not the Knowledge Layer default.
  On master-volume amps (Marshall JCM, Mesa Rectifier), Drive controls preamp saturation.
- **Boost pedal selection**: Use Minotaur (transparent boost) for clean and crunch tones.
  Use Scream 808 (TS-style) for high-gain tones. Do not pair Minotaur with high-gain amps
  or Scream 808 with clean amps — the character clash undermines the tone.
- **Channel Volume**: Pure level — no tonal effect. The Knowledge Layer handles this.
  Do not add it to your output.

## Amp-to-Cab Pairing

Pair amps with historically correct cabs. Match the amp's era and voicing:

| Amp Family | Recommended Cabs |
|------------|-----------------|
| Fender Deluxe / Vibrolux / Twin | 1x12 US Deluxe, 2x12 Double C12N |
| Fender Bassman / Tweed | 4x10 Tweed P10R |
| Vox AC30 / AC15 | 2x12 Blue Bell |
| Marshall Plexi (low-power) | 4x12 Greenback25, 4x12 Greenback20 |
| Marshall JCM800 / JVM (modern) | 4x12 1960 T75, 4x12 Brit V30 |
| Mesa Boogie Mk I-IV | 4x12 Cali V30, 1x12 Cali IV |
| Mesa Rectifier | 4x12 Cali V30, 4x12 XXL V30 |
| Orange (Rockerverb / TH30) | 2x12 Mandarin 30 |
| Matchless DC-30 / Two-Rock | 2x12 Match H30, 2x12 Match G25 |
| Bogner / Friedman / Diezel / 5150 | 4x12 XXL V30, 4x12 Uber V30 |

If the user's requested tone doesn't fit a row above, choose a cab with matching era and speaker voicing.

## Effect Discipline by Genre

Choose effects that serve the tone goal — do not fill slots for the sake of variety:

- **Metal / hard rock**: Maximum 3 effects. Include: noise gate (auto-inserted), optional delay
  at low mix (12%). Do NOT include reverb or modulation on metal tones.
- **Blues / classic rock / country**: 2-3 effects. Delay and reverb are typical; modulation
  is optional (vibrato or light chorus only).
- **Jazz / fusion**: 1-2 effects maximum. Light reverb only; no delay unless requested.
- **Ambient / worship**: 4-5 effects expected. MUST include at least one reverb AND one delay.
  Modulation (shimmer, chorus, vibrato) is appropriate. Avoid drive-heavy distortions.
- **Pop / funk**: 2-3 effects. Chorus or phaser is appropriate; keep delay mix low.

For ambient and worship tones: if no reverb or delay is in the effects list, the preset will
fail its tone goal — always include time-based effects for these genres.
`
```

### Anti-Patterns to Avoid

- **Device-conditional enrichment:** `${stadium ? "## Gain-Staging..." : ""}` — this creates a new cache bucket for Stadium vs non-Stadium, fragmenting hit rate.
- **Numeric parameter guidance in prompt:** Do not add Drive/Master value suggestions to the prompt — these belong in the Knowledge Layer (Phase 56), not the AI planner prompt. The prompt says "do not generate numeric values."
- **Overly long enrichment:** The combined three sections should stay under 400 tokens (~1500 characters). Exceeding 2000 tokens of new content risks pushing total prompt past a cache-efficient boundary.
- **Duplicating existing Creative Guidelines:** The "## Creative Guidelines" section already says "Choose a cab that pairs naturally with the amp" — the new section should be additive, not a rewrite.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cache hit rate measurement | Custom logging | `scripts/cache-hit-report.ts` + `usage-logger.ts` | Already exists; parses `usage.jsonl` into hit rate, avg cost cold vs cached |
| Regression baseline | New fixture system | `scripts/generate-baseline.ts` + `scripts/generate-baseline.test.ts` | Already generates 36 presets across all 6 devices — run before/after to detect quality regressions |
| `buildPlannerPrompt` unit test | Ad hoc test | `src/lib/planner.test.ts` (new file, project pattern) | Follows existing `[module].test.ts` co-location pattern; vitest already configured |

**Key insight:** The test and measurement infrastructure already exists. PROMPT-04 (regression test baseline) requires creating only one new test file (`src/lib/planner.test.ts`) plus a procedure for running the deterministic baseline before and after the prompt change. No new infrastructure needed.

---

## Common Pitfalls

### Pitfall 1: Enrichment Inside Device-Conditional Blocks
**What goes wrong:** Developer adds gain-staging guidance inside `${stadium ? "..." : ""}` or `${podGo ? "..." : ""}` because it "feels more precise." Cache splits into 6 buckets. Cold-start cost increases. Hit rate drops.
**Why it happens:** The conditional blocks at the end of `buildPlannerPrompt()` look like the natural extension point.
**How to avoid:** Insert all three enrichment sections as static text before the first `${podGo ? ...}` conditional. Confirm with `grep -n '\${podGo\|${stadium\|${stomp'` in planner.ts to find the exact insertion line.
**Warning signs:** `usage.jsonl` shows hit rate drop after the change; `cache-hit-report.ts` shows increased cold-start count.

### Pitfall 2: Prompt Token Budget Overflow
**What goes wrong:** Three sections total >2000 tokens of new text. Cache efficiency degrades, generation latency increases.
**Why it happens:** Research-quality pairing tables with 20+ rows, verbose gain-staging explanations.
**How to avoid:** Aim for ~300-400 tokens per section (roughly 200-300 words). The cab pairing table in the example above is ~80 words. Test with `npx tsx -e "console.log(text.split(' ').length)"`.
**Warning signs:** `cache_creation_input_tokens` jumps dramatically in `usage.jsonl`.

### Pitfall 3: Boost Guidance Conflicts With chain-rules.ts Mandatory Block Logic
**What goes wrong:** Prompt tells the AI "use Scream 808 for high-gain" but chain-rules.ts ALSO auto-inserts the appropriate boost via mandatory block logic. The AI may select Scream 808 in the `effects` array AND chain-rules.ts inserts it again, creating a duplicate boost.
**Why it happens:** `chain-rules.ts` has logic to auto-insert `Minotaur` (clean/crunch) and `Scream 808` (high-gain) as always-on mandatory blocks, regardless of what the AI selects. If the AI also puts a boost in its `effects` list, the dedup logic in chain-rules.ts handles it — but the prompt guidance must still be accurate about WHICH boost to bias toward, not WHETHER to add one.
**How to avoid:** Review `assembleSignalChain()` in `chain-rules.ts` to understand exactly when boost blocks are auto-inserted vs. passed through from the AI's `effects` list. The prompt should guide the AI on boost CHARACTER (Minotaur vs Scream 808) for cases where the AI manually selects a boost in its effects list, not instruct the AI to add a boost (which chain-rules.ts handles automatically).
**Warning signs:** Generated presets contain two boost blocks (e.g., two Minotaur entries in the signal chain).

### Pitfall 4: Pairing Table Uses Non-Canonical Model Names
**What goes wrong:** The cab pairing table in the prompt uses informal names like "Fender Twin Cab" — but the schema validates against exact `cabName` strings like "2x12 Double C12N". The AI follows the guidance but produces invalid cabName values.
**Why it happens:** Research-level names differ from the exact model catalog names.
**How to avoid:** Every cab name in the enrichment table must be an exact string from the CABS section of `getModelListForPrompt()` output. Verify by running: `npx tsx -e "import { getModelListForPrompt } from './src/lib/helix'; console.log(getModelListForPrompt())" | grep -A50 "CABS"`.
**Warning signs:** Schema validation errors on `cabName` after prompt change; Zod parse failures in `callClaudePlanner()`.

### Pitfall 5: PROMPT-04 Regression Baseline Is Misinterpreted
**What goes wrong:** The `generate-baseline.test.ts` only tests structural validity (36 files, valid JSON, correct schema). It does NOT test tone quality. A developer runs the baseline, sees 36/36 tests pass, and declares "no quality regression" — but the AI output is not tested.
**Why it happens:** The baseline generator is a Knowledge Layer exercise with hardcoded ToneIntent fixtures — no AI involved, so prompt changes have zero effect on it.
**How to avoid:** PROMPT-04 requires TWO things: (1) unit tests for `buildPlannerPrompt()` itself (that the three new sections are present and contain the correct guidance keywords); and (2) a cache hit rate check using `cache-hit-report.ts` confirming hit rate is not degraded. The Knowledge Layer baseline (`generate-baseline.test.ts`) should still pass — but its passing is a pre-condition, not sufficient evidence of PROMPT-04 compliance.
**Warning signs:** PROMPT-04 marked complete with only generate-baseline.test.ts passing — the actual cache hit rate measurement step was skipped.

---

## Code Examples

### Pattern 1: Inserting Static Sections Before Device-Conditional Blocks

Current insertion point in `src/lib/planner.ts` (line ~93 area):

```typescript
// Source: src/lib/planner.ts lines 88-95
## Dual-Amp Rules

- Dual-amp uses split/join topology — consumes 4 extra DSP0 slots (split + amp2 + cab2 + join)
- For dual-amp presets, limit pre-amp effects to 2 maximum (DSP budget is tighter)
- ampName handles clean/crunch snapshots; secondAmpName handles lead/ambient snapshots
- NEVER use secondAmpName for Pod Go — Pod Go is single-DSP, series-only hardware
- NEVER use secondAmpName for HX Stomp or HX Stomp XL — they are single-DSP, series-only devices
${podGo ? "\n**DEVICE RESTRICTION..." : ""}${stadium ? ... }${stomp ? ... }

Based on the conversation below, generate a ToneIntent:`;
```

Insert the three new sections BETWEEN `## Dual-Amp Rules` content and `${podGo ? ...}`:

```typescript
// After dual-amp rules content, before device-conditional blocks
## Gain-Staging Intelligence

[content here — no ${device} interpolation]

## Amp-to-Cab Pairing

[content here — no ${device} interpolation]

## Effect Discipline by Genre

[content here — no ${device} interpolation]

${podGo ? "\n**DEVICE RESTRICTION..." : ""}
```

### Pattern 2: `buildPlannerPrompt` Unit Test Structure

```typescript
// Source: src/lib/planner.test.ts (NEW FILE — project pattern: [module].test.ts co-located)
// PROMPT-04 test coverage for buildPlannerPrompt() enrichment sections

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt } from "./planner";
import { getModelListForPrompt } from "@/lib/helix";

describe("buildPlannerPrompt", () => {
  const modelList = getModelListForPrompt();
  const prompt = buildPlannerPrompt(modelList);

  // PROMPT-01: Gain-staging intelligence
  it("Test 1: contains gain-staging intelligence section", () => {
    expect(prompt).toContain("## Gain-Staging Intelligence");
    expect(prompt).toContain("Minotaur");
    expect(prompt).toContain("Scream 808");
  });

  it("Test 2: gain-staging guidance distinguishes non-master-volume amps", () => {
    expect(prompt).toContain("non-master-volume");
  });

  // PROMPT-02: Amp-to-cab pairing
  it("Test 3: contains amp-to-cab pairing section", () => {
    expect(prompt).toContain("## Amp-to-Cab Pairing");
    expect(prompt).toContain("2x12 Blue Bell");  // Vox
    expect(prompt).toContain("4x12 Cali V30");   // Mesa
  });

  // PROMPT-03: Effect discipline
  it("Test 4: contains effect discipline section", () => {
    expect(prompt).toContain("## Effect Discipline by Genre");
    expect(prompt).toContain("ambient");
    expect(prompt).toContain("reverb");
    expect(prompt).toContain("delay");
  });

  it("Test 5: ambient guidance explicitly requires reverb AND delay", () => {
    expect(prompt.toLowerCase()).toMatch(/ambient.*reverb.*delay|ambient.*delay.*reverb/);
  });

  it("Test 6: metal guidance constrains effect count", () => {
    const metalSection = prompt.toLowerCase();
    expect(metalSection).toContain("metal");
    // Should mention max effects for metal
    expect(metalSection).toMatch(/metal.*\d\s*effect|metal.*maximum/);
  });

  // PROMPT-04: Shared prefix — no cache fragmentation
  it("Test 7: enrichment sections appear before device-conditional blocks", () => {
    const gainIdx = prompt.indexOf("## Gain-Staging");
    const podGoIdx = prompt.indexOf("DEVICE RESTRICTION");
    expect(gainIdx).toBeGreaterThan(0);
    // Enrichment must precede the device-conditional text
    expect(gainIdx).toBeLessThan(podGoIdx === -1 ? Infinity : podGoIdx);
  });

  it("Test 8: Pod Go prompt contains the enrichment sections (same shared prefix)", () => {
    const podGoModelList = getModelListForPrompt("pod_go");
    const podGoPrompt = buildPlannerPrompt(podGoModelList, "pod_go");
    expect(podGoPrompt).toContain("## Gain-Staging Intelligence");
    expect(podGoPrompt).toContain("## Amp-to-Cab Pairing");
    expect(podGoPrompt).toContain("## Effect Discipline by Genre");
  });
});
```

### Pattern 3: Cache Hit Rate Measurement Procedure (PROMPT-04)

```bash
# Step 1: Enable usage logging
export LOG_USAGE=true

# Step 2: Run 10+ generation calls in the app (or via integration test) to populate usage.jsonl
# This must be done with REAL Claude API calls — the baseline script does not call the API

# Step 3: Read the cache hit report BEFORE adding enrichment
npx tsx scripts/cache-hit-report.ts  # Record baseline hit rate (e.g., 72%)

# Step 4: Add enrichment sections to buildPlannerPrompt()

# Step 5: Run another 10+ generation calls

# Step 6: Read the cache hit report AFTER adding enrichment
npx tsx scripts/cache-hit-report.ts  # Should be similar or better hit rate
# If hit rate drops significantly (>10 percentage points), investigate
# whether the enrichment inadvertently includes device-conditional content
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Generic "pick good effects" guidance | Genre-specific effect discipline table | Phase 55 (this phase) | AI will include time-based effects for ambient; avoid reverb/mod on metal |
| No boost-selection guidance | Explicit Minotaur-for-clean / Scream-808-for-high-gain rule | Phase 55 (this phase) | Prevents Michael Weaver class bug: ambient with Kinky Comp + Minotaur, no reverb/delay |
| No cab pairing table | Explicit amp-family-to-cab mapping | Phase 55 (this phase) | Vox-style amps pair with Blue Bell cabs in generated output |
| AI guesses cab from "pair naturally" guideline | Explicit named pairing table | Phase 55 (this phase) | Removes cab selection randomness for well-known amp families |

**What is NOT changing:**
- `callClaudePlanner()` signature and behavior — unchanged
- `cache_control: ephemeral` block structure — unchanged; enrichment stays inside the same single text block
- `ToneIntentSchema` — no new fields; prompt enrichment is AI guidance, not schema change
- `param-engine.ts` — no change; gain-staging numbers are the Knowledge Layer's job (Phase 56)
- `chain-rules.ts` — no change; mandatory block insertion logic is already correct

---

## Open Questions

1. **Duplicate boost risk from chain-rules.ts auto-insertion**
   - What we know: `assembleSignalChain()` in `chain-rules.ts` auto-inserts Minotaur (clean/crunch) and Scream 808 (high-gain) as mandatory always-on blocks. This happens independently of what the AI puts in its `effects` list.
   - What's unclear: Does the current dedup logic in chain-rules.ts correctly handle the case where the AI's `effects` list already contains Minotaur/Scream 808 AND chain-rules.ts tries to insert it again?
   - Recommendation: Before writing the prompt guidance on boost selection, read `assembleSignalChain()` to trace the dedup path. If the AI is NOT supposed to ever include a boost in its `effects` list (because chain-rules.ts inserts it deterministically), then the prompt guidance should say "the Knowledge Layer inserts your boost automatically — do NOT add boost pedals to your effects list." If the AI IS supposed to pick the boost, the guidance should clarify which one to pick.

2. **Exact cab model names to use in the pairing table**
   - What we know: The pairing table in FEATURES.md uses community-validated names. The CABS model list in `getModelListForPrompt()` output has the canonical names.
   - What's unclear: The exact string representation for each cab (e.g., is it "4x12 Cali V30" or "Cali IV V30"?).
   - Recommendation: Run `npx tsx -e "const { getModelListForPrompt } = require('./src/lib/helix'); console.log(getModelListForPrompt())"` and copy cab names directly into the pairing table during implementation. Do not use informal names.

3. **Optimal insertion point relative to existing Creative Guidelines**
   - What we know: The existing `## Creative Guidelines` section already says "choose a cab that pairs naturally with the amp." Adding `## Amp-to-Cab Pairing` is additive.
   - What's unclear: Whether consolidating into `## Creative Guidelines` (extending that section rather than creating new sections) would be cleaner for the AI to process.
   - Recommendation: Keep separate named sections. Three distinct `##` headings let the AI mentally segment the guidance domains. Do not fold into Creative Guidelines.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `src/lib/planner.ts` — `buildPlannerPrompt()` full source, `callClaudePlanner()` full source, `cache_control: ephemeral` block placement, device-conditional fragment positions
- Direct codebase inspection: `src/lib/usage-logger.ts` — `logUsage()`, `PlannerUsageRecord`, `cache_hit` field
- Direct codebase inspection: `scripts/cache-hit-report.ts` — `parseCacheReport()` function, `CacheReportStats` interface
- Direct codebase inspection: `scripts/generate-baseline.ts` — 36-preset deterministic pipeline; confirms baseline does NOT call AI and therefore is unaffected by prompt changes
- Direct codebase inspection: `scripts/generate-baseline.test.ts` — structural tests; confirms PROMPT-04 needs additional planner unit tests beyond baseline
- `.planning/research/FEATURES.md` Finding 1 (gain-staging), Finding 2 (cab pairings), Finding 3 (effect interactions) — HIGH confidence for domain content
- `.planning/STATE.md` Blockers section: "Enrichment MUST go in the shared static prefix of buildPlannerPrompt() — conditional insertions fragment the cache into 6 device buckets"
- `.planning/research/SUMMARY.md` Phase 46 section (the prior research name for Phase 55): full implementation spec including cache pitfall

### Secondary (MEDIUM confidence)
- `.planning/codebase/TESTING.md` — vitest patterns, test file naming, co-location convention, factory helper pattern
- `.planning/research/FEATURES.md` community-validated cab pairing table — MEDIUM confidence (community consensus, not official Line 6 specs)
- User feedback from STATE.md: Michael Weaver (ambient with no reverb/delay, Kinky Comp + Minotaur), Glenn Sully (output level, verbosity) — MEDIUM confidence (single user reports, not systematic testing)

### Tertiary (LOW confidence)
- None — all findings are from direct codebase inspection or the already-validated project research files.

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — no new dependencies; all tooling confirmed present in codebase
- Architecture (cache constraint): HIGH — confirmed from direct inspection of `buildPlannerPrompt()` template literal structure; `cache_control: ephemeral` block confirmed in `callClaudePlanner()`
- Domain content (gain-staging, cab pairings, effect discipline): MEDIUM-HIGH — FEATURES.md research is HIGH on gain-staging semantics from Line 6 official docs; MEDIUM on specific cab pairing community data; HIGH on effect discipline logic from Michael Weaver feedback confirmation
- Pitfalls: HIGH — pitfalls 1-3 (cache fragmentation, token budget, boost dedup) are from direct code analysis; pitfalls 4-5 (model name validation, PROMPT-04 misinterpretation) are from test infrastructure analysis
- Testing approach: HIGH — vitest already running; co-location pattern confirmed; test structure for `buildPlannerPrompt()` is straightforward string-content assertions

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain — no library upgrades needed; only risk is if `planner.ts` is refactored before this phase runs)
