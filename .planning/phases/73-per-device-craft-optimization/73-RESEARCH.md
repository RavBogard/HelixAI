# Phase 73: Per-Device Craft Optimization - Research

**Researched:** 2026-03-06
**Domain:** Per-device planner prompt tuning and chain-rules enforcement for Stomp, Pod Go, Helix, and Stadium
**Confidence:** HIGH

## Summary

Phase 73 addresses a gap between what the planner prompts *tell* the AI to do and what the code *enforces*. The current codebase has strong per-device prompts (each family has its own `prompt.ts` with genre-based effect discipline and budget guidance) and robust code enforcement (COMBO-02 compressor omission, COMBO-03 priority truncation from Phase 72, per-device `maxEffectsPerDsp` caps). However, several mismatches exist between prompt guidance and code behavior, and several craft optimizations are missing entirely.

The key gaps are: (1) The Stomp prompt tells the AI "4 effects maximum" via `maxEffects = 4` but the CRAFT-01 requirement says presets should "optimize for 6-block budget" with "4-6 effects that maximize tonal variety" -- the prompt is underselling the available budget since Stomp has 8 total slots (amp+cab+boost = 3 mandatory, leaving up to 5 user effects), (2) Pod Go's priority truncation from COMBO-03 uses a generic priority scoring that does not incorporate genre context -- an ambient preset should prioritize reverb > delay but the generic scoring prioritizes wah > compressor > drive > delay > reverb, (3) Helix Floor/LT prompts say "2-4 is typical, 8 is the maximum" but never encourage the AI to use its dual-DSP advantage for richer chains, and (4) there is no code-side enforcement ensuring genre-appropriate effect types survive truncation -- that logic only lives in prompts.

All four CRAFT requirements can be addressed through targeted changes to the existing prompt files and the `getEffectPriority()` function in `chain-rules.ts`, with no new modules or architectural changes needed.

**Primary recommendation:** Enhance per-device prompts with explicit minimum effect counts by genre, add genre-aware priority scoring to `getEffectPriority()` in chain-rules.ts, and add Helix-specific prompt guidance encouraging richer effect chains that leverage dual-DSP.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CRAFT-01 | Stomp/Stomp XL presets optimize for 6-block budget with 4-6 effects maximizing tonal variety | Stomp prompt currently says `maxEffects = 4` but device has 8 block slots. After amp+cab+boost = 3 mandatory slots, up to 5 user effects can fit. Prompt needs minimum effect counts per genre and encouragement to fill available slots. Code-side `maxEffectsPerDsp = 4` in device-family.ts caps user effects. |
| CRAFT-02 | Pod Go presets respect 4-effect budget with genre-based intelligent prioritization | Pod Go prompt already has genre-based slot priority guidance. Code-side COMBO-03 truncation uses generic `getEffectPriority()` that does not account for genre. Need genre-aware priority scoring so ambient presets keep reverb+delay, metal keeps drive+delay. |
| CRAFT-03 | Helix Floor/LT presets leverage dual-DSP with richer chains and creative routing | Helix prompt says "2-4 is typical" which caps AI ambition. Need to raise minimum effect guidance for Helix to 4-6 typical, encourage DSP1 post-effects, and mention creative possibilities. Code-side: Helix has `maxEffectsPerDsp = Infinity` so no code changes needed for block limits. |
| CRAFT-04 | Per-device craft encoded in both planner prompts AND chain-rules code | Prompt changes cover CRAFT-01/02/03 creative direction. Code changes: genre-aware `getEffectPriority()` ensures truncation respects genre intent (currently only uses intentRole + slot type). This is the "both prompts and code" requirement. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (existing) | Type safety | Existing strict mode, all modified files are `.ts` |
| vitest | (existing) | Test framework | 771 tests already passing |

### Supporting
No new libraries needed. All changes are to existing prompt text and chain-rules scoring logic.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Prompt + code dual approach | Prompt-only guidance | Prompt guidance is not deterministic -- AI may ignore it. Code enforcement guarantees behavior. |
| Genre-aware priority in chain-rules | Separate genre-truncation module | Unnecessary complexity -- `getEffectPriority()` already exists and just needs a genreHint parameter |

## Architecture Patterns

### Current Architecture (What Exists)

```
src/lib/families/
  helix/prompt.ts          # Helix planner + chat prompts
  stomp/prompt.ts          # Stomp planner + chat prompts
  podgo/prompt.ts          # Pod Go planner + chat prompts
  stadium/prompt.ts        # Stadium planner + chat prompts
  shared/
    tone-intent-fields.ts  # Shared ToneIntent field descriptions
    effect-model-intelligence.ts  # Genre-informed effect model selection
    gain-staging.ts        # Shared gain-staging intelligence

src/lib/helix/
  chain-rules.ts           # Signal chain assembly + COMBO-02/03 truncation
  device-family.ts         # DeviceCapabilities per device target
  param-engine.ts          # Parameter resolution + COMBO-01/04 adjustments
```

### Pattern 1: Per-Genre Minimum Effect Counts in Prompts (CRAFT-01, CRAFT-03)

**What:** Add explicit minimum effect counts per genre to each device family's planner prompt, replacing "2-4 is typical" with device-specific ranges.

**When to use:** All four prompt files need genre-specific minimum/maximum effect guidance calibrated to the device.

**Current Stomp prompt (line 108-128):**
```typescript
// Currently says: "Maximum 2 effects" for metal, "2-3 effects" for blues
// But Stomp has 8 block slots total. Amp + cab + boost = 3 mandatory.
// That leaves 5 slots for user effects. The prompt tells AI to use only 2-3.
```

**Proposed Stomp prompt change:**
```
## Effect Discipline by Genre (HX Stomp family -- 8 block slots)

HX Stomp has 8 block slots total (including amp + cab + mandatory boost).
With amp, cab, and boost taking 3 slots, you have UP TO 5 remaining slots for effects.
Use them wisely -- every slot should earn its place, but do NOT leave slots empty when
the genre benefits from more effects:

- **Metal / hard rock**: 2-3 effects. Drive is mandatory; delay at low mix; optional gate.
  Priority: drive > delay > gate
- **Blues / classic rock / country**: 3-4 effects. Delay AND reverb are both standard;
  add a drive or compressor to complete the board.
  Priority: delay > reverb > drive > compressor
- **Jazz / fusion**: 2-3 effects. Reverb is essential; add a compressor for dynamics
  control and optionally a subtle chorus.
- **Ambient / worship**: 4-5 effects. MUST include reverb AND delay. Add modulation
  AND a second time-based effect for lush textures.
  Priority: reverb > delay > mod > second delay/reverb
- **Pop / funk**: 3-4 effects. Chorus or phaser plus delay; add compressor for
  consistent dynamics.
```

**Proposed Helix prompt change (line 104-117):**
```
## Effect Discipline by Genre (Helix -- Dual DSP, 16 block budget)

Helix has two DSPs with up to 8 blocks each. Pre-effects (comp, drive, EQ) go on
DSP0 before the amp; post-effects (mod, delay, reverb) go on DSP1 after the cab.
Take advantage of both DSPs -- Helix presets should be RICHER than Stomp or Pod Go:

- **Metal / hard rock**: 3-4 effects. Drive + gate on DSP0; delay (low mix) + optional
  modulation on DSP1. The dual DSP means you CAN include post-effects without
  compromising the pre-amp chain.
- **Blues / classic rock / country**: 4-5 effects. Drive + compressor on DSP0; delay +
  reverb + optional tremolo/chorus on DSP1.
- **Jazz / fusion**: 2-3 effects. Compressor on DSP0; reverb + optional chorus on DSP1.
- **Ambient / worship**: 5-7 effects. Drive or compressor on DSP0; modulation + delay +
  reverb + second delay or shimmer reverb on DSP1. Use the extra DSP1 headroom for
  layered time-based effects that smaller devices can't fit.
- **Pop / funk**: 3-5 effects. Compressor + drive on DSP0; chorus/phaser + delay +
  reverb on DSP1.

IMPORTANT: Helix presets should typically have MORE effects than Stomp or Pod Go for
the same genre. Use the dual-DSP advantage.
```

### Pattern 2: Genre-Aware Priority Truncation in Code (CRAFT-02, CRAFT-04)

**What:** Extend `getEffectPriority()` in chain-rules.ts to accept a `genreHint` parameter and adjust priority scores based on genre context.

**When to use:** During COMBO-03 truncation when `userEffects.length > caps.maxEffectsPerDsp`.

**Current priority scoring (chain-rules.ts:241-261):**
```typescript
function getEffectPriority(pending: PendingBlock): number {
  let score = 0;
  switch (pending.intentRole) {
    case "always_on": score += 100; break;
    case "toggleable": score += 50; break;
    case "ambient": score += 30; break;
    default: score += 40; break;
  }
  switch (pending.slot) {
    case "wah": score += 18; break;
    case "compressor": score += 15; break;
    case "extra_drive": score += 12; break;
    case "delay": score += 10; break;
    case "reverb": score += 8; break;
    case "modulation": score += 5; break;
    default: score += 5; break;
  }
  return score;
}
```

**Problem:** For an ambient preset on Pod Go with 6 effects (reverb, delay, mod, drive, compressor, chorus), truncation to 4 keeps: compressor (65), drive (62), delay (60), reverb (58) -- dropping modulation and chorus. But for ambient, reverb + delay + mod should survive, not compressor + drive.

**Proposed genre-aware priority:**
```typescript
// Genre-specific slot priority overrides
// Higher values = higher survival priority during truncation
const GENRE_SLOT_PRIORITY: Record<string, Partial<Record<ChainSlot, number>>> = {
  metal: {
    extra_drive: 20, // drive is essential for metal
    compressor: 5,   // less important (COMBO-02 removes anyway for high-gain)
    delay: 12,       // tight delay is useful
    reverb: 3,       // minimal reverb for metal
    modulation: 2,   // least important
  },
  ambient: {
    reverb: 20,      // reverb is ESSENTIAL for ambient
    delay: 18,       // delay is ESSENTIAL for ambient
    modulation: 15,  // modulation is important for texture
    extra_drive: 5,  // drive is least important for ambient
    compressor: 8,   // useful but not critical
  },
  worship: {
    reverb: 20,      // same as ambient
    delay: 18,
    modulation: 15,
    extra_drive: 5,
    compressor: 8,
  },
  blues: {
    delay: 18,       // delay defines blues tone
    reverb: 15,      // reverb is standard
    extra_drive: 12, // boost/drive is nice
    compressor: 10,  // dynamics control
    modulation: 5,   // optional
  },
  rock: {
    extra_drive: 18, // drive is core to rock
    delay: 15,       // delay is standard
    reverb: 12,      // reverb is useful
    compressor: 8,   // useful for clean snapshots
    modulation: 5,   // optional
  },
  jazz: {
    reverb: 18,      // reverb defines jazz space
    compressor: 15,  // dynamics control is important
    modulation: 10,  // subtle chorus is nice
    delay: 5,        // rarely needed
    extra_drive: 3,  // rarely needed
  },
};

function getEffectPriority(
  pending: PendingBlock,
  genreHint?: string,
): number {
  let score = 0;

  // intentRole scoring (unchanged -- always_on dominates)
  switch (pending.intentRole) {
    case "always_on": score += 100; break;
    case "toggleable": score += 50; break;
    case "ambient": score += 30; break;
    default: score += 40; break;
  }

  // Genre-aware slot scoring
  const genreKey = matchGenreKey(genreHint);
  const genrePriority = genreKey ? GENRE_SLOT_PRIORITY[genreKey] : undefined;

  if (genrePriority && pending.slot in genrePriority) {
    score += genrePriority[pending.slot]!;
  } else {
    // Fallback to current generic scoring
    switch (pending.slot) {
      case "wah": score += 18; break;
      case "compressor": score += 15; break;
      case "extra_drive": score += 12; break;
      case "delay": score += 10; break;
      case "reverb": score += 8; break;
      case "modulation": score += 5; break;
      default: score += 5; break;
    }
  }

  return score;
}
```

**Threading genreHint:** The `assembleSignalChain()` function already receives `ToneIntent` which has `genreHint`. The genreHint just needs to be passed through to `getEffectPriority()`.

### Pattern 3: Helix Dual-DSP Encouragement (CRAFT-03)

**What:** Update the Helix planner prompt to explicitly encourage richer effect chains that leverage dual DSP.

**Current issue (helix/prompt.ts line 94):**
```
- Keep effects minimal: 2-4 is typical, 8 is the maximum
```

This guidance actively discourages the AI from using the dual-DSP advantage. Helix Floor/LT should produce richer presets than Stomp or Pod Go.

**Proposed change:**
```
- Leverage both DSPs: 4-6 effects is typical for Helix, 8 is the maximum
- Split effects across DSPs: pre-amp effects on DSP0, post-amp effects on DSP1
- Use the extra headroom for layered post-effects that constrained devices can't fit
```

**Code-side for CRAFT-03:** No code enforcement changes needed. Helix has `maxEffectsPerDsp = Infinity` so there is no truncation. The prompt change alone drives richer presets.

### Pattern 4: Pod Go Genre-Based Effect Selection in Prompts (CRAFT-02)

**What:** Strengthen Pod Go's prompt to explicitly state which 4 effects to choose per genre.

**Current Pod Go prompt (lines 88-108)** already has genre-specific guidance, but it gives ranges ("2 effects maximum" for metal, "4 effects" for ambient). Since Pod Go has a hard 4-effect limit, the prompt should specify EXACTLY which 4 effects for each genre, not leave the AI to decide.

**Proposed change to Pod Go planner prompt:**
```
## Effect Slot Planning by Genre (Pod Go -- exactly 4 effect slots)

Pod Go has exactly 4 user-effect slots. Choose ALL 4 for every genre -- do not
leave slots unused. Here are the ideal 4 effects per genre:

- **Metal / hard rock**: drive + gate + delay (low mix) + [compressor OR wah]
- **Blues / classic rock**: drive + delay + reverb + [compressor OR tremolo]
- **Country**: compressor + delay + reverb + [tremolo OR chorus]
- **Jazz / fusion**: compressor + reverb + [chorus OR EQ] + [delay OR second reverb]
- **Ambient / worship**: delay + reverb + modulation + [second delay OR shimmer reverb]
- **Pop / funk**: compressor + chorus/phaser + delay + reverb
- **Psychedelic**: wah + delay + reverb + modulation

When in doubt, fill all 4 slots. An unused slot is a wasted slot on Pod Go.
```

### Anti-Patterns to Avoid

- **Prompt bloat:** Do NOT add paragraphs of explanation. Per-genre effect guidance should be concise lists, not prose. The prompts are already ~5000 tokens per family.
- **Duplicating prompt logic in code:** Genre-based effect SELECTION belongs in prompts (AI decides). Genre-based effect SURVIVAL belongs in code (truncation decides). Do not conflate the two.
- **Breaking prompt cache:** The Helix and Stomp prompts are carefully structured for Anthropic prompt caching. The system prompt must remain stable per device family. Genre-specific content goes in the STATIC portion of the prompt, not in the user message.
- **Changing maxEffectsPerDsp for Stomp:** CRAFT-01 says "4-6 effects" but `maxEffectsPerDsp = 4` for Stomp. This is correct -- the 4 refers to USER effects after mandatory blocks (amp+cab+boost). The prompt should encourage using all 4 user effect slots, not increase the cap.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Genre matching for priority | Custom string parsing | Existing `matchGenre()` from param-engine.ts | Already handles substring matching, fuzzy genre detection |
| Device-specific prompt routing | Manual if/else chains | Existing `prompt-router.ts` | Already dispatches to family-specific prompt modules |
| Effect budget enforcement | Custom validators | Existing COMBO-03 in chain-rules.ts | Priority truncation already works, just needs genre awareness |
| Per-device capabilities | Hardcoded constants in prompts | `DeviceCapabilities` from device-family.ts | Single source of truth, already imported by prompt modules |

**Key insight:** The architecture is already correct. Phase 73 is about tuning existing mechanisms (prompt text + priority scoring), not building new ones.

## Common Pitfalls

### Pitfall 1: Stomp maxEffects Mismatch
**What goes wrong:** CRAFT-01 says "4-6 effects" but `maxEffectsPerDsp = 4` for Stomp. Increasing `maxEffectsPerDsp` to 6 would break block budget enforcement.
**Why it happens:** Confusion between "block slots" and "user effect slots." Stomp has 8 block slots total. Amp(1) + cab(1) + mandatory boost(1) = 3 mandatory. That leaves 5 for user effects. But `maxEffectsPerDsp = 4` because the mandatory boost is NOT counted as a user effect in chain-rules -- it is added in the mandatory block insertion step AFTER truncation.
**How to avoid:** Do NOT change `maxEffectsPerDsp`. Instead, ensure the prompt tells the AI to request 4 user effects (the code adds the mandatory boost on top). 4 user effects + amp + cab + boost = 7 blocks, within the 8-block budget. For high-gain where a gate is also mandatory: 4 user effects + amp + cab + boost + gate = 8 blocks = exactly the budget.
**Warning signs:** If total blocks exceed 8 for Stomp, the existing `maxBlocksTotal` check in chain-rules.ts line 580-585 will throw.

### Pitfall 2: Genre-Aware Priority Breaking Existing Tests
**What goes wrong:** Adding `genreHint` parameter to `getEffectPriority()` changes the function signature. All call sites must be updated.
**Why it happens:** `getEffectPriority()` is called in the COMBO-03 truncation block (chain-rules.ts:435). The `genreHint` must be threaded from the ToneIntent.
**How to avoid:** Make `genreHint` an optional parameter with default `undefined`. When undefined, the function falls back to the current generic scoring. All existing tests pass without changes. New tests exercise genre-aware behavior.
**Warning signs:** Existing COMBO-03 tests start failing because they do not pass `genreHint`.

### Pitfall 3: Prompt Cache Invalidation
**What goes wrong:** Changing prompt text invalidates the Anthropic prompt cache entry. This costs one cold-write (~$0.01) per family the first time after deployment.
**Why it happens:** The system prompt is hashed for caching. Any text change creates a new hash.
**How to avoid:** Accept the one-time cache miss -- it is unavoidable when changing prompts. The important thing is that changes go in the STATIC system prompt (not the user message), so subsequent requests within the same family re-use the new cache entry. Stomp and Stomp XL share one cache entry; Helix Floor/LT/Rack share one cache entry.
**Warning signs:** If changes are accidentally placed in the user message via `stompRestriction` in planner.ts, every request pays the cost.

### Pitfall 4: Helix Prompt Encouraging Too Many Effects
**What goes wrong:** Changing Helix from "2-4 typical" to "4-6 typical" may cause the AI to stuff 7-8 effects into every preset, creating DSP overload warnings.
**Why it happens:** The AI follows prompt guidance literally. "4-6 typical" may be read as "always use at least 4."
**How to avoid:** Include the caveat "do not add effects for the sake of filling slots -- every effect should serve the tone goal." This text already exists in the Helix prompt (line 92). Ensure it remains prominent after changes.
**Warning signs:** Generated presets with many unrelated effects (e.g., wah + phaser + flanger + chorus for a blues tone).

### Pitfall 5: Pod Go Already Has Excellent Prompt Guidance
**What goes wrong:** Over-engineering Pod Go prompt changes when the existing guidance is already good.
**Why it happens:** CRAFT-02 exists as a requirement but the Pod Go prompt (lines 88-108) already has explicit genre-based priorities, hard 4-slot limit language, and the DEVICE RESTRICTION block (line 109).
**How to avoid:** The main gap for Pod Go is code-side: the `getEffectPriority()` function does not use genre. Focus CRAFT-02 effort on code changes (genre-aware truncation) rather than major prompt rewrites. Minor prompt tweaks (filling all 4 slots, explicit per-genre 4-effect lists) are sufficient.

### Pitfall 6: matchGenre() Location
**What goes wrong:** `matchGenre()` currently lives in param-engine.ts (private function). chain-rules.ts needs it for genre-aware truncation but cannot import it.
**Why it happens:** The function was written for param-engine's genre effect defaults and was never exported.
**How to avoid:** Either: (a) Extract `matchGenre()` to a shared utility and import in both files, or (b) write a simpler genre-matching helper inline in chain-rules.ts. Option (b) is simpler since chain-rules only needs a genre KEY (not a full GenreEffectProfile).

## Code Examples

### Example 1: Genre-Aware getEffectPriority (chain-rules.ts)

```typescript
// Source: chain-rules.ts -- extending existing getEffectPriority

/** Normalize a genreHint to a GENRE_SLOT_PRIORITY key */
function matchGenreKey(genreHint?: string): string | undefined {
  if (!genreHint) return undefined;
  const hint = genreHint.toLowerCase();
  const genres = ["metal", "ambient", "worship", "blues", "rock", "jazz", "country", "funk", "pop"];
  for (const genre of genres) {
    if (hint.includes(genre)) return genre;
  }
  // "hard rock" -> "rock", "classic rock" -> "rock"
  if (hint.includes("rock")) return "rock";
  return undefined;
}

/** Score an effect for truncation priority (COMBO-03 + CRAFT-04).
 * Higher score = more likely to survive budget truncation.
 * genreHint makes truncation genre-aware: ambient keeps reverb+delay,
 * metal keeps drive+delay. */
function getEffectPriority(
  pending: PendingBlock,
  genreHint?: string,
): number {
  let score = 0;

  // intentRole scoring (unchanged)
  switch (pending.intentRole) {
    case "always_on": score += 100; break;
    case "toggleable": score += 50; break;
    case "ambient": score += 30; break;
    default: score += 40; break;
  }

  // Genre-aware slot scoring
  const genreKey = matchGenreKey(genreHint);
  const genrePriority = genreKey
    ? GENRE_SLOT_PRIORITY[genreKey]
    : undefined;

  if (genrePriority && pending.slot in genrePriority) {
    score += genrePriority[pending.slot]!;
  } else {
    // Fallback: generic scoring (current behavior)
    switch (pending.slot) {
      case "wah": score += 18; break;
      case "compressor": score += 15; break;
      case "extra_drive": score += 12; break;
      case "delay": score += 10; break;
      case "reverb": score += 8; break;
      case "modulation": score += 5; break;
      default: score += 5; break;
    }
  }

  return score;
}
```

### Example 2: Stomp Prompt Effect Guidance (stomp/prompt.ts)

```typescript
// Source: stomp/prompt.ts -- replacing current "Effect Discipline by Genre" section

`## Effect Discipline by Genre (HX Stomp family -- ${maxBlocks} block slots)

HX Stomp family has ${maxBlocks} block slots total (including amp + cab + always-on boost).
After amp, cab, and boost, you have UP TO 4 remaining slots for user effects.
Use them -- every slot should earn its place, but do NOT leave slots empty:

- **Metal / hard rock**: 3-4 effects. Drive is mandatory; add delay (low mix) and optional gate or wah.
  Priority: drive > delay > gate > wah
- **Blues / classic rock / country**: 3-4 effects. Delay and reverb are both standard; add drive or compressor.
  Priority: delay > reverb > drive > compressor
- **Jazz / fusion**: 2-3 effects. Reverb is essential; add compressor and optional chorus.
- **Ambient / worship**: 4 effects (use all available slots). MUST include reverb AND delay.
  Add modulation and a second time-based effect.
  Priority: reverb > delay > mod > second delay/reverb
- **Pop / funk**: 3-4 effects. Chorus or phaser plus delay and reverb.

IMPORTANT: A Stomp preset with only 2 effects is underusing the device. Aim for 3-4 effects
for most genres, 4 for ambient/worship.`
```

### Example 3: Threading genreHint to Truncation (chain-rules.ts)

```typescript
// In assembleSignalChain(), the ToneIntent is available as `intent`
// The genreHint just needs to flow to getEffectPriority:

// COMBO-03: Priority-based effect truncation
if (caps.maxEffectsPerDsp < Infinity && userEffects.length > caps.maxEffectsPerDsp) {
  // Sort by genre-aware priority descending (highest priority = survives)
  userEffects.sort((a, b) =>
    getEffectPriority(b, intent.genreHint) - getEffectPriority(a, intent.genreHint)
  );

  const dropped = userEffects.length - caps.maxEffectsPerDsp;
  const droppedEffects = userEffects.slice(caps.maxEffectsPerDsp);
  console.warn(
    `[chain-rules] COMBO-03: Effect budget exceeded: dropping ${dropped} lowest-priority effect(s): ` +
    droppedEffects.map(e => `${e.model.name}(${e.intentRole ?? 'none'})`).join(', ')
  );
  userEffects.length = caps.maxEffectsPerDsp;

  // Re-sort remaining by SLOT_ORDER for correct signal chain position
  userEffects.sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
}
```

## State of the Art

| Old Approach | Current Approach | Phase 73 Change | Impact |
|--------------|------------------|-----------------|--------|
| Generic "2-4 effects" across all devices | Per-family prompt with genre discipline | Per-device minimum effect counts by genre | Stomp uses 3-4 effects instead of 2, Helix uses 4-6 instead of 2-4 |
| Generic priority truncation | COMBO-03 intentRole + slot scoring | Genre-aware priority scoring | Ambient keeps reverb+delay, metal keeps drive+delay during truncation |
| Helix "keep effects minimal" | Same | "Leverage both DSPs: 4-6 typical" | Helix presets use dual-DSP advantage for richer chains |
| Prompt-only genre guidance | Prompt + COMBO-03 code enforcement | Prompt guidance + genre-aware code enforcement | CRAFT-04 satisfied: both prompts AND code encode per-device craft |

## Implementation Order

The four requirements should be implemented in this order based on scope and dependencies:

1. **CRAFT-04 (code): Genre-aware `getEffectPriority()`** -- This is the core code change. Add `GENRE_SLOT_PRIORITY` table and `matchGenreKey()` helper. Thread `genreHint` from ToneIntent to the truncation call. This enables CRAFT-02 automatically.

2. **CRAFT-01 (prompt): Stomp prompt enhancement** -- Update `stomp/prompt.ts` effect discipline section with higher minimum effect counts per genre. Change "Maximum 2 effects" for metal to "3-4 effects." Change "3-4 effects" for ambient to "4 effects (use all available slots)."

3. **CRAFT-02 (prompt): Pod Go prompt enhancement** -- Minor Pod Go prompt updates: add explicit 4-effect-per-genre templates. Most of CRAFT-02 is handled by the code change in step 1.

4. **CRAFT-03 (prompt): Helix prompt enhancement** -- Update `helix/prompt.ts` effect discipline and creative guidelines. Change "2-4 is typical" to "4-6 is typical." Add dual-DSP encouragement. No code changes needed.

## Key Existing Code Analysis

### assembleSignalChain Signature
```typescript
export function assembleSignalChain(intent: ToneIntent, caps: DeviceCapabilities): BlockSpec[]
```
The `intent` parameter already has `genreHint: string | undefined`. No signature change needed to thread genre information to truncation logic.

### Effect Count Actual vs. Guidance

| Device | maxEffectsPerDsp | Prompt says | Actual after mandatory | CRAFT target |
|--------|------------------|-------------|----------------------|--------------|
| Stomp | 4 | "Maximum 2" (metal), "3-4" (ambient) | 4 user + boost + amp + cab = 7-8 blocks | 3-4 user effects for most genres |
| Pod Go | 4 | "2 maximum" (metal), "4" (ambient) | 4 user + amp + cab = 6 blocks | Fill all 4 slots every genre |
| Helix | Infinity | "2-4 typical, 8 max" | No cap on user effects | 4-6 typical, leverage both DSPs |
| Stadium | 8 | "4-8 maximum" | 8 user + amp + cab + EQ + gain = 12 blocks | Already good, no changes |

### Mandatory Block Behavior (Critical for Stomp CRAFT-01)

For Stomp devices (`mandatoryBlockTypes: []`), the mandatory boost (Minotaur/Scream 808) IS still auto-inserted by chain-rules.ts lines 460-479. The `mandatoryBlockTypes` array controls EQ and Gain Block insertion only. The boost insertion is unconditional based on amp category.

So for Stomp: 4 user effects + 1 mandatory boost + amp + cab = 7 total blocks (within 8-block budget). For high-gain Stomp: 4 user effects + 1 mandatory boost + 1 mandatory gate + amp + cab = 8 total blocks (exactly at budget).

This means `maxEffectsPerDsp = 4` is correctly calibrated for Stomp. The prompt just needs to encourage the AI to USE all 4 slots.

### genreHint Availability in assembleSignalChain

```typescript
// chain-rules.ts line 279:
export function assembleSignalChain(intent: ToneIntent, caps: DeviceCapabilities): BlockSpec[] {
  // intent.genreHint is available here
  // Currently used nowhere in chain-rules
  // After CRAFT-04: passed to getEffectPriority() in the COMBO-03 block
}
```

## Open Questions

1. **Should Stadium prompt also be updated?**
   - What we know: Stadium already has `maxEffectsPerDsp = 8` and a reasonably good prompt.
   - What's unclear: CRAFT requirements specifically mention Stomp, Pod Go, and Helix. Stadium is not called out.
   - Recommendation: No Stadium changes for Phase 73. Stadium's prompt and code are already well-calibrated.

2. **Should the Zod schema's effects maxItems be updated?**
   - What we know: `z.array(effectSchema).max(10)` allows up to 10 effects. Helix prompt says "8 is the maximum."
   - What's unclear: Should Helix effects.max be raised above 8 since we are encouraging richer chains?
   - Recommendation: No change. 8 effects is still the practical maximum. The schema allows 10 for headroom but the prompt should keep 8 as the stated cap.

3. **Should wah get genre-specific priority?**
   - What we know: Wah currently has the highest generic slot priority (18). In genres like ambient/worship, wah is irrelevant.
   - What's unclear: If a user explicitly requests wah for an ambient preset, should it still survive truncation?
   - Recommendation: In `GENRE_SLOT_PRIORITY`, give wah a LOW priority for ambient/worship/jazz (score 3-5) since it is uncommon. The `intentRole` of `always_on` (score 100) will still protect it if the user explicitly asked for it.

## Sources

### Primary (HIGH confidence)
- `src/lib/families/helix/prompt.ts` -- Full Helix planner prompt with current effect discipline guidance
- `src/lib/families/stomp/prompt.ts` -- Full Stomp planner prompt with maxEffects=4, genre discipline
- `src/lib/families/podgo/prompt.ts` -- Full Pod Go planner prompt with 4-effect hard limit
- `src/lib/families/stadium/prompt.ts` -- Stadium planner prompt (reference, no changes planned)
- `src/lib/helix/chain-rules.ts` -- COMBO-02/03 truncation logic, getEffectPriority() scoring
- `src/lib/helix/device-family.ts` -- DeviceCapabilities with maxEffectsPerDsp per device
- `src/lib/helix/param-engine.ts` -- matchGenre() function (potential extraction target)
- `src/lib/planner.ts` -- How device info and stompRestriction flow to the AI
- `.planning/phases/72-effect-combination-logic/72-01-SUMMARY.md` -- Phase 72 COMBO-02/03 delivery
- `.planning/phases/72-effect-combination-logic/72-02-SUMMARY.md` -- Phase 72 COMBO-01/04 delivery

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- CRAFT-01 through CRAFT-04 definitions and status tracking
- `.planning/ROADMAP.md` -- Phase 73 dependencies and success criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, all existing code
- Architecture: HIGH -- Changes confined to existing prompt files and one function in chain-rules.ts
- Pitfalls: HIGH -- Thorough analysis of maxEffectsPerDsp vs block count, prompt cache impact, test breakage
- Implementation order: HIGH -- Clear dependency chain, code change enables prompt changes

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable codebase, prompt content is project-specific so no external staleness risk)
