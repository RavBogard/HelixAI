# Phase 71: Per-Model Effect Intelligence - Research

**Researched:** 2026-03-06
**Domain:** LLM prompt engineering for genre-informed effect model selection + parameter override architecture
**Confidence:** HIGH

## Summary

This phase adds genre-informed effect model selection guidance to the planner system prompt and introduces per-model parameter overrides for effect models with problematic defaults. The codebase already has a well-established pattern for both: amp-to-cab pairing tables in the prompt, and `paramOverrides` on `HelixModel` for amps. This phase extends both patterns to delay, reverb, and wah models.

The key architectural insight is that genre-model recommendations must live in the **static system prompt** (the `buildPlannerPrompt()` return value) rather than the dynamic user message, because the system prompt is cached via `cache_control: { type: "ephemeral", ttl: "1h" }`. The existing `GENRE_EFFECT_DEFAULTS` in `param-engine.ts` handles parameter values (Mix, Feedback, Time) per genre, but does NOT guide model selection -- the AI currently picks any model in the category. This phase closes that gap.

**Primary recommendation:** Create a new shared prompt module `src/lib/families/shared/effect-model-intelligence.ts` that exports a `genreEffectModelSection()` function (following the exact pattern of `gainStagingSection()` and `ampCabPairingSection()`). Add `paramOverrides` to specific `HelixModel` entries in `DELAY_MODELS`, `REVERB_MODELS`, and `WAH_MODELS` in `models.ts`, then add a `paramOverrides` application step in `resolveDefaultParams()` in `param-engine.ts`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INTEL-01 | Delay model selection is genre-informed | Full delay model catalog with 23 models mapped to real-world equivalents and genres; genre-delay mapping table ready for prompt injection |
| INTEL-02 | Reverb model selection is genre-informed | Full reverb model catalog with 18 models mapped to categories and genres; genre-reverb mapping table ready for prompt injection |
| INTEL-03 | Wah model selection is genre-informed | Full wah model catalog with 9 models mapped to real-world equivalents and genres; genre-wah mapping table ready for prompt injection |
| INTEL-04 | Effect model guidance in static system prompt | Confirmed prompt architecture: `buildPlannerPrompt()` return value is the cached system prompt; shared modules pattern exists (`gainStagingSection()`, `ampCabPairingSection()`); new shared module follows same pattern |
| INTEL-05 | Per-model parameter overrides for bad defaults | `paramOverrides` field exists on `HelixModel` interface; amp resolver already uses it; `resolveDefaultParams()` needs a 4-line addition to apply it for effects |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | existing | All source files | Project standard |
| Zod | existing | ToneIntent schema validation | Already used for structured output |

### Supporting
No new libraries needed. This phase is pure prompt engineering + data table additions to existing files.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static prompt section | Dynamic user message injection | Would break prompt caching -- rejected by INTEL-04 |
| New config file for genre mappings | Inline in prompt module | Config file adds unnecessary indirection for static prompt text |
| Separate paramOverrides table | Per-model field on HelixModel | HelixModel.paramOverrides already exists and is the established pattern |

## Architecture Patterns

### Recommended Project Structure

No new files needed beyond one new shared module:

```
src/
  lib/
    families/
      shared/
        effect-model-intelligence.ts   # NEW — genreEffectModelSection()
        gain-staging.ts                # Existing pattern to follow
        amp-cab-pairing.ts             # Existing pattern to follow
        tone-intent-fields.ts          # Existing — no changes
      helix/prompt.ts                  # Add genreEffectModelSection() call
      stomp/prompt.ts                  # Add genreEffectModelSection() call
      stadium/prompt.ts                # Add genreEffectModelSection() call
      podgo/prompt.ts                  # Add genreEffectModelSection() call
    helix/
      models.ts                        # Add paramOverrides to specific effect models
      param-engine.ts                  # Add paramOverrides application in resolveDefaultParams()
```

### Pattern 1: Shared Prompt Section Module

**What:** Pure function that returns prompt text, imported by all 4 family prompt files.
**When to use:** For prompt content that is identical across all families.
**Example:**

```typescript
// src/lib/families/shared/effect-model-intelligence.ts
// Following exact pattern of gain-staging.ts

/**
 * Returns the genre-informed effect model selection section for planner prompts.
 * Pure function — no side effects, no device-specific content.
 * Included in the STATIC system prompt to preserve cache hit rates (INTEL-04).
 */
export function genreEffectModelSection(): string {
  return `## Genre-Informed Effect Model Selection

When choosing delay, reverb, and wah models, match the model character to the genre:

### Delay Models by Genre

| Genre | Primary Recommendation | Alternative | Avoid |
|-------|----------------------|-------------|-------|
| Blues / Classic Rock | Transistor Tape (EP-3 warmth) | Bucket Brigade (DM-2 grit) | Heliosphere, Ping Pong |
| Country | Bucket Brigade (clean repeats) | Simple Delay | Cosmos Echo, Reverse Delay |
| Rock / Hard Rock | Simple Delay (clean, clear) | Dual Delay (stereo spread) | Adriatic Swell, Vintage Swell |
| Metal | Simple Delay (tight, low mix) | Ducked Delay (stays out of riffs) | All ambient/swell delays |
| Jazz | Adriatic Delay (warm BBD tone) | Simple Delay | Multi Pass, Sweep Echo |
| Ambient / Post-Rock | Heliosphere (ambient delay/reverb) | Adriatic Swell, Vintage Swell | Bucket Brigade, Simple Delay |
| Worship | Ducked Delay (clears during playing) | Heliosphere | Bucket Brigade |
| Psychedelic | Cosmos Echo (Space Echo tape) | Sweep Echo (filter sweep) | Simple Delay |
| Pop | Ping Pong (stereo width) | Simple Delay | Cosmos Echo, Reverse Delay |
| Funk | Simple Delay (tight, rhythmic) | ADT (thickening) | All long-tail delays |

### Reverb Models by Genre

| Genre | Primary Recommendation | Alternative | Avoid |
|-------|----------------------|-------------|-------|
| Blues / Classic Rock | Plate (universal warmth) | '63 Spring (authentic drip) | Ganymede, Particle Verb |
| Country | '63 Spring (essential twang verb) | Double Tank (fuller spring) | Glitz, Ganymede, Octo |
| Rock / Hard Rock | Plate (tight, controlled) | Room (natural ambience) | Ganymede, Searchlights |
| Metal | Room (minimal, tight) | — | All shimmer/ambient reverbs |
| Jazz | Chamber (warm, natural) | Hall (larger space) | Spring, Glitz, Particle Verb |
| Ambient / Post-Rock | Ganymede (lush ambient) | Glitz (shimmer), Searchlights (modulated) | Room, Tile |
| Worship | Ganymede (atmospheric pad) | Plateaux (shimmer plate) | Room, Tile, Cave |
| Psychedelic | Searchlights (modulated) | Cave (massive space) | Tile, Room |
| Pop | Hall (polished, commercial) | Plate | Cave, Particle Verb |
| Funk | Plate (tight, dry-ish) | Room | All long-decay reverbs |

### Wah Models by Genre

| Genre | Primary Recommendation | Alternative | Why |
|-------|----------------------|-------------|-----|
| Rock / Classic Rock | Teardrop 310 (Cry Baby sweep) | UK Wah 846 (Vox) | Classic rock wah character |
| Funk | Fassel (vocal sweep, RMC) | Weeper (Mu-Tron envelope) | Funky, expressive sweep |
| Blues | Chrome Custom (smooth, modified Vox) | UK Wah 846 | Warm, less aggressive |
| Metal | Teardrop 310 (aggressive sweep) | Throaty (dark, growling) | Cuts through high gain |
| Default (any genre) | Chrome Custom (versatile) | — | Safest all-rounder |`;
}
```

### Pattern 2: Per-Model paramOverrides for Effects

**What:** Add `paramOverrides` field to specific effect model entries in `models.ts`. Apply in `resolveDefaultParams()`.
**When to use:** When a model's `defaultParams` produce a sound that is wrong for most use cases.
**Example:**

```typescript
// In REVERB_MODELS (models.ts) — Ganymede shimmer reverb default Mix is too wet
"Ganymede": {
  id: "HD2_ReverbGanymede",
  name: "Ganymede",
  basedOn: "Line 6 Original Ambient",
  category: "ambient",
  blockType: BLOCK_TYPES.REVERB,
  defaultParams: { DecayTime: 0.8, Mix: 0.35, PreDelay: 0.05, Level: 0.0, LowCut: 100, HighCut: 10000 },
  paramOverrides: { Mix: 0.25 },  // INTEL-05: Default 0.35 is too wet for most non-ambient uses
},

// In resolveDefaultParams (param-engine.ts) — add after genre overrides, before tempo override
// Layer N+1: per-model paramOverrides — wins over model defaults (INTEL-05)
if (model?.paramOverrides) {
  for (const [key, value] of Object.entries(model.paramOverrides)) {
    params[key] = value;
  }
}
```

### Pattern 3: Prompt Section Integration

**What:** Each family's `buildPlannerPrompt()` calls `genreEffectModelSection()` in the static system prompt.
**When to use:** The section goes AFTER `## Effect Discipline by Genre` and BEFORE device restrictions.
**Example:**

```typescript
// In helix/prompt.ts buildPlannerPrompt()
import { genreEffectModelSection } from "../shared/effect-model-intelligence";

// ... existing prompt sections ...
${gainStagingSection()}
${ampCabPairingSection(HELIX_AMP_CAB_PAIRINGS)}
// ... existing Effect Discipline section ...

${genreEffectModelSection()}

// ... rest of prompt ...
```

### Anti-Patterns to Avoid

- **DO NOT put genre-model guidance in the user message:** This changes per-request and breaks the Anthropic prompt cache. The system prompt with `cache_control: { type: "ephemeral", ttl: "1h" }` is the correct location.
- **DO NOT create per-family genre tables:** All families share the same effect model catalog (DELAY_MODELS, REVERB_MODELS, WAH_MODELS are shared). Only amp models differ by family.
- **DO NOT add a new resolution layer in param-engine before model defaults:** The `paramOverrides` should apply AFTER `defaultParams` AND after genre overrides, following the amp pattern (Layer 4 wins over all shared layers).
- **DO NOT override params that genre profiles already handle:** `paramOverrides` is for model-inherent issues (e.g., Ganymede Mix too high regardless of genre). Genre-specific tuning stays in `GENRE_EFFECT_DEFAULTS`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared prompt sections | Duplicating text in 4 prompt files | `genreEffectModelSection()` shared module | Same pattern as `gainStagingSection()` -- DRY, tested once |
| Per-model param fixes | New override table/config | `HelixModel.paramOverrides` field | Already exists on the interface, already applied for amps |
| Genre effect param tuning | Per-model genre tables | Existing `GENRE_EFFECT_DEFAULTS` in param-engine | Already handles Mix/Feedback/Time per genre -- this phase adds model SELECTION, not param tuning |

**Key insight:** The codebase already has every architectural pattern needed. This phase is extending existing patterns to new domains (effects), not creating new architecture.

## Common Pitfalls

### Pitfall 1: Breaking Prompt Cache
**What goes wrong:** Adding genre-model guidance to the user message instead of the system prompt.
**Why it happens:** The user message is the "easy" place to add dynamic content.
**How to avoid:** All genre-model guidance goes in `buildPlannerPrompt()` return value, which is the system prompt with `cache_control: ephemeral`.
**Warning signs:** If the content references user input or varies per request, it belongs in the user message. Genre-model tables are STATIC and belong in the system prompt.

### Pitfall 2: paramOverrides vs GENRE_EFFECT_DEFAULTS Collision
**What goes wrong:** `paramOverrides` and genre defaults fight over the same parameter (e.g., both trying to set Mix).
**Why it happens:** Unclear resolution order.
**How to avoid:** Define explicit resolution order: `model.defaultParams` -> `GENRE_EFFECT_DEFAULTS` (genre layer) -> `model.paramOverrides` (model fix layer) -> tempo override (delay only). The genre layer sets the genre-appropriate value; paramOverrides corrects model-specific issues that persist regardless of genre.
**Warning signs:** If a paramOverride value would be wrong for ambient genre (e.g., overriding Mix to 0.25 when ambient wants 0.50), the override is fighting the genre layer. Solution: only use paramOverrides for values that are wrong ACROSS ALL GENRES, or make them conditional.

**IMPORTANT DECISION:** After further analysis, `paramOverrides` should apply BEFORE genre overrides, not after. Rationale:
- `paramOverrides` fixes model-inherent issues (like Ganymede's Mix being too wet as a default starting point)
- Genre overrides should be the outermost layer because they represent user intent
- If a user asks for ambient, genre should be able to set Mix: 0.50 regardless of paramOverrides
- Resolution order: `defaultParams` -> `paramOverrides` -> `GENRE_EFFECT_DEFAULTS` -> tempo override

### Pitfall 3: Prompt Length Budget
**What goes wrong:** Genre-model tables make the system prompt too large, hitting token limits or increasing cache write costs.
**Why it happens:** Three full genre-model tables (delay, reverb, wah) add ~1500 tokens.
**How to avoid:** Keep tables concise -- one line per genre with primary + alternative recommendations. No verbose descriptions. The existing prompt is already substantial; be efficient.
**Warning signs:** System prompt exceeding ~8000 tokens total.

### Pitfall 4: Stadium Effect Models
**What goes wrong:** Assuming Stadium uses different effect models than HD2 devices.
**Why it happens:** Stadium uses different AMP models (Agoura_*) so developers might assume effects differ too.
**How to avoid:** Verify: Stadium shares the SAME `DELAY_MODELS`, `REVERB_MODELS`, and `WAH_MODELS` as all other families. Only amps and EQ models differ (STADIUM_AMPS, STADIUM_EQ_MODELS). The genre-model recommendation table is shared across all 4 families.
**Warning signs:** Creating separate genre-model tables for Stadium.

### Pitfall 5: Wah Always-On vs Expression Pedal
**What goes wrong:** Recommending wah models without considering that wah requires an expression pedal.
**Why it happens:** Treating wah like delay/reverb in the recommendation.
**How to avoid:** Wah recommendations should note that wah is typically expression-pedal controlled. The AI should only add wah when the user specifically requests it, not proactively.
**Warning signs:** AI adding wah to every funk/rock preset without the user asking.

## Code Examples

### Complete resolveDefaultParams with paramOverrides (INTEL-05)

```typescript
// param-engine.ts — modified resolveDefaultParams
function resolveDefaultParams(
  block: BlockSpec,
  genreProfile?: GenreEffectProfile,
  tempoHint?: number,
  delaySubdivision?: string,
): Record<string, number | boolean> {
  const model = findModel(block.modelName, block.type);
  const params = model ? { ...model.defaultParams } : { ...block.parameters };

  // NEW: Apply per-model paramOverrides (INTEL-05)
  // Fixes model-inherent defaults that are wrong regardless of genre.
  // Applied BEFORE genre overrides so genre intent can still win.
  if (model?.paramOverrides) {
    for (const [key, value] of Object.entries(model.paramOverrides)) {
      params[key] = value;
    }
  }

  // Apply genre overrides as outermost layer (existing)
  if (genreProfile) {
    const genreOverrides = genreProfile[block.type as keyof GenreEffectProfile];
    if (genreOverrides) {
      for (const [key, value] of Object.entries(genreOverrides)) {
        if (key in params) {
          params[key] = value;
        }
      }
    }
  }

  // Apply tempo-synced delay override (existing)
  if (tempoHint && block.type === "delay") {
    // ... existing tempo logic unchanged ...
  }

  return params;
}
```

### Effect Models Needing paramOverrides (INTEL-05)

```typescript
// models.ts — REVERB_MODELS additions
"Ganymede": {
  // ... existing fields ...
  paramOverrides: { Mix: 0.25 },  // Default 0.35 is too wet for non-ambient use
},
"Glitz": {
  // ... existing fields ...
  paramOverrides: { Mix: 0.20 },  // Shimmer effect compounds — lower mix prevents wash
},
"Octo": {
  // ... existing fields ...
  paramOverrides: { Mix: 0.20 },  // Octave reverb is very prominent — dial back
},

// models.ts — DELAY_MODELS additions
"Heliosphere": {
  // ... existing fields ...
  paramOverrides: { Feedback: 0.25 },  // Ambient delay self-oscillates at default 0.35
},
"Cosmos Echo": {
  // ... existing fields ...
  paramOverrides: { Feedback: 0.25 },  // Space Echo high feedback causes runaway
},
```

### Shared Module Import Pattern

```typescript
// Each family prompt.ts adds this import and call:
import { genreEffectModelSection } from "../shared/effect-model-intelligence";

// In buildPlannerPrompt():
${genreEffectModelSection()}
```

## Complete Effect Model Catalogs

### All Delay Models (23 models)

| Model Name | Model ID | Based On | Category | Best For Genres |
|------------|----------|----------|----------|-----------------|
| Simple Delay | HD2_DelaySimpleDelay | Line 6 Original | digital | Rock, Metal, Pop, Funk, Country |
| Mod/Chorus Echo | HD2_DelayModChorusEcho | Line 6 Original | modulated | Pop, Rock, Ambient |
| Dual Delay | HD2_DelayDualDelay | Line 6 Original | digital | Rock, Pop (stereo) |
| Ping Pong | HD2_DelayPingPong | Line 6 Original | digital | Pop, Ambient |
| Transistor Tape | HD2_DelayTransistorTape | Maestro Echoplex EP-3 | analog | Blues, Classic Rock, Country |
| Adriatic Delay | HD2_DelayAdriaticDelay | Line 6 Original (BBD) | analog | Jazz, Blues, Indie |
| Elephant Man | HD2_DelayElephantMan | EHX Deluxe Memory Man | analog | Blues, Indie, Psychedelic |
| Cosmos Echo | HD2_DelayCosmosEcho | Roland RE-201 Space Echo | tape | Psychedelic, Ambient, Worship |
| Multi Pass | HD2_DelayMultiPass | Line 6 Original (Multi-Tap) | digital | Ambient, Post-Rock |
| Vintage Digital | HD2_DelayVintageDigitalV2 | Line 6 Original Vintage Digital | digital | 80s Rock, Pop |
| Bucket Brigade | HD2_DelayBucketBrigade | Boss DM-2 | analog | Blues, Country, Classic Rock |
| Harmony Delay | HD2_DelayHarmonyDelay | Line 6 Original Harmony | digital | Country, Pop |
| Pitch Echo | HD2_DelayPitch | Line 6 Original Pitch Shifting | digital | Ambient, Experimental |
| Ducked Delay | HD2_DelayDuckedDelay | Line 6 Original Ducked | digital | Worship, Live Performance |
| Reverse Delay | HD2_DelayReverseDelay | Line 6 Original Reverse | digital | Ambient, Psychedelic |
| Sweep Echo | HD2_DelaySweepEcho | Line 6 Original Sweep Filter | modulated | Psychedelic, Ambient |
| Adriatic Swell | HD2_DelaySwellAdriatic | Line 6 Original (Adriatic+Swell) | ambient | Ambient, Worship |
| Vintage Swell | HD2_DelaySwellVintageDigital | Line 6 Original (Digital+Swell) | ambient | Ambient, Worship |
| Heliosphere | HD2_DelayHeliosphere | Line 6 Original Ambient Delay/Reverb | ambient | Ambient, Worship, Post-Rock |
| ADT | HD2_DelayADT | Abbey Road ADT | modulated | Pop, Rock (thickening) |
| Criss Cross | HD2_DelayCrissCross | Line 6 Original Criss-Cross | digital | Ambient, Experimental |

### All Reverb Models (18 models)

| Model Name | Model ID | Based On | Category | Best For Genres |
|------------|----------|----------|----------|-----------------|
| Plate | HD2_ReverbPlate | Line 6 Original Plate | plate | Universal -- Blues, Rock, Pop, Country |
| Room | HD2_ReverbRoom | Line 6 Original Room | room | Rock, Metal, Jazz |
| Hall | HD2_ReverbHall | Line 6 Original Hall | hall | Pop, Jazz, Classical |
| Chamber | HD2_ReverbChamber | Line 6 Original Chamber | chamber | Jazz, Classical |
| '63 Spring | HD2_Reverb63Spring | Fender '63 Spring Reverb | spring | Country, Blues, Surf, Rockabilly |
| Glitz | HD2_ReverbGlitz | Line 6 Original Shimmer | shimmer | Ambient, Worship |
| Ganymede | HD2_ReverbGanymede | Line 6 Original Ambient | ambient | Ambient, Worship, Post-Rock |
| Searchlights | HD2_ReverbSearchlights | Line 6 Original Modulated | modulated | Psychedelic, Ambient |
| Particle Verb | HD2_ReverbParticle | Line 6 Original Granular | special | Experimental, Ambient |
| Plateaux | HD2_ReverbPlateaux | Line 6 Original Shimmer Plate | shimmer | Worship, Ambient |
| Double Tank | HD2_ReverbDoubleTank | Line 6 Original Double Spring | spring | Country, Surf |
| Spring | HD2_ReverbSpring | Line 6 Original Spring | spring | Country, Blues |
| Ducking | HD2_ReverbDucking | Line 6 Original Ducking | hall | Live Performance, Worship |
| Octo | HD2_ReverbOcto | Line 6 Original Octave Reverb | shimmer | Worship, Ambient |
| Cave | HD2_ReverbCave | Line 6 Original Cave | hall | Psychedelic, Post-Rock |
| Tile | HD2_ReverbTile | Line 6 Original Tile Room | room | Jazz, Acoustic |
| Echo | HD2_ReverbEcho | Line 6 Original Reverb Echo | ambient | Ambient, Experimental |

### All Wah Models (9 models)

| Model Name | Model ID | Based On | Category | Best For Genres |
|------------|----------|----------|----------|-----------------|
| UK Wah 846 | HD2_WahUKWah846 | Vox V846 | wah | Classic Rock, Blues |
| Teardrop 310 | HD2_WahTeardrop310 | Dunlop Cry Baby | wah | Rock, Metal, Classic Rock |
| Fassel | HD2_WahFassel | RMC Real McCoy 1 | wah | Funk, R&B, Jazz-Funk |
| Weeper | HD2_WahWeeper | Musitronics Mu-Tron III | wah | Funk, Psychedelic |
| Chrome | HD2_WahChrome | Vox Chrome Custom | wah | Pop, Rock |
| Chrome Custom | HD2_WahChromeCustom | Vox Chrome Custom (Modified) | wah | All-rounder default |
| Throaty | HD2_WahThroaty | Line 6 Original Throaty | wah | Metal, Hard Rock |
| Conductor | HD2_WahConductor | Line 6 Original Conductor | wah | Pop, Light Rock |
| Colorful | HD2_WahColorful | Colorsound Wah | wah | Psychedelic, Classic Rock |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AI picks any delay model | Genre-informed selection (this phase) | Phase 71 | Blues gets Transistor Tape, not Heliosphere |
| AI picks any reverb model | Genre-informed selection (this phase) | Phase 71 | Country gets '63 Spring, not Ganymede |
| No effect paramOverrides | Per-model fixes via existing field | Phase 71 | Ganymede Mix corrected from 0.35 to 0.25 |
| Genre only affects params | Genre affects both model selection AND params | Phase 71 | Complete genre-aware effect chain |

**Current state of GENRE_EFFECT_DEFAULTS (already exists):** Handles parameter VALUES (Time, Feedback, Mix, DecayTime, PreDelay, Speed, Depth) per genre for delay/reverb/modulation. Does NOT guide MODEL selection.

**Current state of paramOverrides:** Defined on `HelixModel` interface, implemented only in `resolveAmpParams()`. NOT applied in `resolveDefaultParams()` which handles all effects. Adding support is a 4-line change.

## Prompt Architecture Analysis

### Where Genre-Model Guidance Goes

The system prompt is built by `buildPlannerPrompt()` in each family's `prompt.ts`:

```
System prompt structure (cached):
1. Role description
2. Valid Model Names (${modelList})              <-- runtime injected, same per device family
3. ToneIntent Fields (${toneIntentFieldsSection})
4. "What You Do NOT Generate"
5. Creative Guidelines
6. Gain Staging (${gainStagingSection()})
7. Amp-Cab Pairing (${ampCabPairingSection()})
8. Effect Discipline by Genre                    <-- EXISTS: genre-to-effect-count rules
9. >>> NEW: Genre-Informed Effect Model Selection (${genreEffectModelSection()}) <<<
10. Device-specific sections (routing, restrictions)
```

The new section goes at position 9, AFTER effect discipline (which tells the AI HOW MANY effects per genre) and BEFORE device-specific content (which varies per family but is still static).

### Cache Impact Analysis

- The system prompt with `cache_control: ephemeral` is hashed by Anthropic.
- Adding a new static section changes the hash, triggering one cold cache write per family.
- After the first call with the new prompt, all subsequent calls within the TTL hit the cache.
- Since the new section is identical across all 4 families, it does not affect per-family cache isolation.
- Helix LT and Floor share one cache entry (CONFIRMED: `buildPlannerPrompt` produces identical text for both).
- Stomp and Stomp XL share one cache entry (CONFIRMED: device restriction goes in user message).

### Per-Family Differences

**All 4 families share the same effect models.** The difference is only in:
- Amp models (Stadium uses Agoura_*, others use HD2)
- EQ models (Stadium has 7-band, others have 5-band)
- Block/slot limits (Pod Go: 4 effects, Stomp: 4-6, Helix: 8, Stadium: 8)

Genre-model recommendations are IDENTICAL across families because DELAY_MODELS, REVERB_MODELS, and WAH_MODELS are shared. Use a single shared module.

## Models with Bad Defaults (INTEL-05 Analysis)

### Reverb Models

| Model | Parameter | Default | Problem | Recommended Override |
|-------|-----------|---------|---------|---------------------|
| Ganymede | Mix | 0.35 | Too wet for non-ambient use; when AI picks Ganymede for a rock preset, 35% mix overwhelms | 0.25 |
| Glitz | Mix | 0.30 | Shimmer effect compounds with decay; 30% becomes overpowering | 0.22 |
| Octo | Mix | 0.30 | Octave reverb is very prominent even at low mix | 0.22 |
| Plateaux | Mix | 0.30 | Shimmer plate same issue as Glitz | 0.22 |

### Delay Models

| Model | Parameter | Default | Problem | Recommended Override |
|-------|-----------|---------|---------|---------------------|
| Heliosphere | Feedback | 0.35 | Ambient delay can self-oscillate; lower feedback prevents runaway | 0.28 |
| Cosmos Echo | Feedback | 0.35 | Space Echo tape saturation builds with feedback; 0.35 can run away | 0.28 |
| Adriatic Swell | Feedback | 0.35 | Swell effect compounds with feedback; lower prevents wash | 0.28 |

### Wah Models

No wah models have problematic defaults. All default to Position: 0.5, Mix: 1.0, Level: 0.0 which is correct.

**Note:** Genre overrides in `GENRE_EFFECT_DEFAULTS` already handle genre-appropriate Mix/Feedback values. The `paramOverrides` here fix the MODEL DEFAULT starting point, which matters when:
1. No genre is specified (genreHint is undefined)
2. The genre profile doesn't override the specific parameter
3. The model is used in a genre that doesn't have a profile entry

## Open Questions

1. **paramOverrides resolution order for effects**
   - What we know: For amps, paramOverrides is Layer 4 (wins over everything). For effects, genre overrides are currently the outermost layer.
   - What's unclear: Should effect paramOverrides apply before or after genre overrides?
   - Recommendation: Apply BEFORE genre overrides. paramOverrides fixes the model's inherent issues; genre overrides represent user intent and should win. This means: `defaultParams` -> `paramOverrides` -> `genre overrides` -> `tempo override`.

2. **Prompt token budget**
   - What we know: Three genre-model tables add ~1200-1500 tokens to the system prompt.
   - What's unclear: Exact current prompt size and whether adding 1500 tokens affects Anthropic cache behavior.
   - Recommendation: Keep tables concise. The current prompt is already substantial (~3000-4000 tokens for Helix). Adding 1500 tokens is ~37% increase but still well within Anthropic's cache limits.

3. **Wah recommendations scope**
   - What we know: Wah is expression-pedal controlled and only added when users request it.
   - What's unclear: Whether the AI needs genre-wah guidance as strongly as delay/reverb.
   - Recommendation: Include wah table but keep it brief. The AI already only adds wah when requested; the table just ensures it picks the RIGHT wah model.

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/models.ts` — Complete model catalogs (DELAY_MODELS lines 956-978, REVERB_MODELS lines 983-1001, WAH_MODELS lines 1060-1070)
- `src/lib/helix/param-engine.ts` — Full parameter resolution pipeline, GENRE_EFFECT_DEFAULTS (lines 148-222), resolveDefaultParams (lines 559-609)
- `src/lib/families/helix/prompt.ts` — Prompt structure and cache strategy (lines 66-159)
- `src/lib/families/stomp/prompt.ts` — Stomp prompt structure confirming shared pattern
- `src/lib/families/stadium/prompt.ts` — Stadium prompt confirming shared effect models
- `src/lib/families/podgo/prompt.ts` — Pod Go prompt confirming shared effect models
- `src/lib/families/shared/gain-staging.ts` — Shared module pattern to follow
- `src/lib/families/shared/amp-cab-pairing.ts` — Shared module pattern to follow
- `src/lib/planner.ts` — System prompt cache_control strategy (line 74-77)
- `src/lib/prompt-router.ts` — Routing confirms all families use same buildPlannerPrompt signature

### Secondary (MEDIUM confidence)
- Genre-to-model mappings — Based on widely accepted guitar effect conventions (Echoplex for blues, Spring for country, etc.) and Line 6 model naming/categorization. The `basedOn` field in each model confirms the real-world equivalent.

### Tertiary (LOW confidence)
- Specific paramOverride values (e.g., Ganymede Mix 0.25 vs 0.22) — These are reasonable starting points based on the model categories and intended use, but may need tuning after testing with real preset generation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, extending existing patterns
- Architecture: HIGH - Direct inspection of all source files, clear patterns established
- Model catalogs: HIGH - Complete enumeration from models.ts source
- Genre mappings: MEDIUM - Based on real-world pedal knowledge and model `basedOn` fields
- paramOverride values: LOW-MEDIUM - Reasonable estimates, need validation through preset generation testing
- Pitfalls: HIGH - Identified from direct code analysis

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain -- effect models and prompt architecture change infrequently)
