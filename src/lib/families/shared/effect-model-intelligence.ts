// src/lib/families/shared/effect-model-intelligence.ts
// Shared genre-informed effect model selection prompt section.
// Pure function returning prompt text — no side effects, no device-specific content.
// Included in the STATIC system prompt to preserve cache hit rates (INTEL-04).

/**
 * Returns the genre-informed effect model selection section for planner prompts.
 * This section educates the LLM about which delay, reverb, and wah models
 * best match each genre's sonic character. Same text for all device families.
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
