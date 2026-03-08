// src/lib/families/shared/effect-model-intelligence.ts
// Genre-informed effect model selection prompt section, parameterized by device family.
// Pure function returning prompt text — no side effects.
// Included in the STATIC system prompt to preserve cache hit rates (INTEL-04).

import type { DeviceFamily } from "@/lib/helix";

/**
 * Returns the genre-informed effect model selection section for planner prompts.
 * Each device family gets tailored guidance matching its hardware constraints.
 */
export function genreEffectModelSection(family: DeviceFamily = "helix"): string {
  switch (family) {
    case "helix":
      return helixEffectSection();
    case "stomp":
      return stompEffectSection();
    case "podgo":
      return podgoEffectSection();
    case "stadium":
      return stadiumEffectSection();
  }
}

// ---------------------------------------------------------------------------
// Helix — Dual-DSP, 4-7 effects typical, layering encouraged
// ---------------------------------------------------------------------------

function helixEffectSection(): string {
  return `## Genre-Informed Effect Model Selection

Helix's dual-DSP architecture lets you run more effects simultaneously. Use DSP1 for time-based effects (delays, reverbs) to keep DSP0 clear for amp processing. Target 4-7 effects for most presets.

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

Consider stacking delays across DSPs — e.g., Transistor Tape on DSP0 for slapback + Ducked Delay on DSP1 for ambient repeats.

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

Dual-DSP layering: Route Plate on DSP0 (always-on warmth) + Ganymede on DSP1 (toggled via snapshot) for versatile ambient presets.

### Wah Models by Genre

| Genre | Primary Recommendation | Alternative | Why |
|-------|----------------------|-------------|-----|
| Rock / Classic Rock | Teardrop 310 (Cry Baby sweep) | UK Wah 846 (Vox) | Classic rock wah character |
| Funk | Fassel (vocal sweep, RMC) | Weeper (Mu-Tron envelope) | Funky, expressive sweep |
| Blues | Chrome Custom (smooth, modified Vox) | UK Wah 846 | Warm, less aggressive |
| Metal | Teardrop 310 (aggressive sweep) | Throaty (dark, growling) | Cuts through high gain |
| Default (any genre) | Chrome Custom (versatile) | — | Safest all-rounder |

### Layering Opportunities (Helix Dual-DSP)

Helix can run effect combinations impossible on single-DSP devices:
- **Parallel reverbs:** Plate (DSP0, always-on) + Ganymede/Glitz (DSP1, snapshot-toggled)
- **Stacked delays:** Slapback on DSP0 + long ambient delay on DSP1
- **Dual modulation:** Chorus on DSP0 (subtle) + Tremolo on DSP1 (rhythmic)
- **Wet/dry:** Keep DSP0 completely dry, route all time-based effects to DSP1`;
}

// ---------------------------------------------------------------------------
// Stomp — Single-DSP, 3-4 effects max, priority-based selection
// ---------------------------------------------------------------------------

function stompEffectSection(): string {
  return `## Genre-Informed Effect Model Selection

With 3-4 effect slots available, every choice matters. The Priority column helps you decide: always pick Priority 1 effects first, then fill remaining slots with Priority 2.

### Delay Models by Genre

| Genre | Recommendation | Priority | Alternative |
|-------|---------------|----------|-------------|
| Blues / Classic Rock | Transistor Tape (EP-3 warmth) | 1 | Bucket Brigade (DM-2 grit) |
| Country | Bucket Brigade (clean repeats) | 1 | Simple Delay |
| Rock / Hard Rock | Simple Delay (clean, clear) | 2 | Dual Delay (stereo spread) |
| Metal | Simple Delay (tight, low mix) | 2 | Ducked Delay (stays out of riffs) |
| Jazz | Adriatic Delay (warm BBD tone) | 2 | Simple Delay |
| Ambient / Post-Rock | Heliosphere (ambient delay/reverb) | 1 | Adriatic Swell |
| Worship | Ducked Delay (clears during playing) | 1 | Heliosphere |
| Psychedelic | Cosmos Echo (Space Echo tape) | 1 | Sweep Echo (filter sweep) |
| Pop | Ping Pong (stereo width) | 2 | Simple Delay |
| Funk | Simple Delay (tight, rhythmic) | 2 | — |

### Reverb Models by Genre

| Genre | Recommendation | Priority | Alternative |
|-------|---------------|----------|-------------|
| Blues / Classic Rock | Plate (universal warmth) | 1 | '63 Spring (authentic drip) |
| Country | '63 Spring (essential twang verb) | 1 | Double Tank |
| Rock / Hard Rock | Plate (tight, controlled) | 2 | Room (natural ambience) |
| Metal | Room (minimal, tight) | 2 | — |
| Jazz | Chamber (warm, natural) | 1 | Hall (larger space) |
| Ambient / Post-Rock | Ganymede (lush ambient) | 1 | Glitz (shimmer) |
| Worship | Ganymede (atmospheric pad) | 1 | Plateaux (shimmer plate) |
| Psychedelic | Searchlights (modulated) | 1 | Cave (massive space) |
| Pop | Hall (polished, commercial) | 2 | Plate |
| Funk | Plate (tight, dry-ish) | 2 | Room |

### Wah Models by Genre

| Genre | Recommendation | Priority | Why |
|-------|---------------|----------|-----|
| Rock / Classic Rock | Teardrop 310 (Cry Baby sweep) | 2 | Classic rock wah character |
| Funk | Fassel (vocal sweep, RMC) | 1 | Funky, expressive sweep |
| Blues | Chrome Custom (smooth, modified Vox) | 2 | Warm, less aggressive |
| Metal | Teardrop 310 (aggressive sweep) | 2 | Cuts through high gain |
| Default (any genre) | Chrome Custom (versatile) | 2 | Safest all-rounder |

### Stomp Budget Guidance

With 3-4 effect slots, choose Priority 1 effects first, then fill remaining slots:
- If your tone needs both delay AND reverb, choose models with shorter tails to leave DSP headroom.
- **Drop order when over budget:** Wah → Modulation → Compressor → Reverb → Delay → Drive
- A Stomp preset using only 1-2 effects is underusing the device — aim for 3-4.`;
}

// ---------------------------------------------------------------------------
// Pod Go — Hard 4-effect limit, fill all slots, template-based
// ---------------------------------------------------------------------------

function podgoEffectSection(): string {
  return `## Genre-Informed Effect Model Selection

Pod Go has exactly 4 user-effect slots — fill all of them. An unused slot is wasted potential. Each genre below provides an optimized 4-effect template plus one swap option.

### 4-Slot Effect Templates by Genre

| Genre | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Swap Option |
|-------|--------|--------|--------|--------|-------------|
| Blues / Classic Rock | Minotaur (drive) | Transistor Tape (delay) | Plate (reverb) | LA Studio Comp (comp) | Swap comp → '63 Spring for twangier verb |
| Country | LA Studio Comp (comp) | Bucket Brigade (delay) | '63 Spring (reverb) | Transistor Tape (tremolo-style slapback) | Swap second delay → Optical Trem |
| Rock / Hard Rock | Scream 808 (drive) | Simple Delay (delay) | Plate (reverb) | Noise Gate (gate) | Swap gate → Chorus for cleaner tones |
| Metal | Scream 808 (drive) | Simple Delay (delay) | Room (reverb) | Noise Gate (gate) | Swap reverb → Ducked Delay for tighter mix |
| Jazz | LA Studio Comp (comp) | Adriatic Delay (delay) | Chamber (reverb) | Chorus (modulation) | Swap chorus → Hall for larger space |
| Ambient / Post-Rock | Heliosphere (delay) | Ganymede (reverb) | Chorus (modulation) | Adriatic Swell (delay) | Swap Adriatic Swell → Glitz for shimmer |
| Worship | Ducked Delay (delay) | Ganymede (reverb) | Minotaur (drive) | Chorus (modulation) | Swap chorus → Plateaux for shimmer verb |
| Psychedelic | Cosmos Echo (delay) | Searchlights (reverb) | Chorus (modulation) | Minotaur (drive) | Swap drive → Sweep Echo for double delay |
| Pop | Ping Pong (delay) | Hall (reverb) | Chorus (modulation) | LA Studio Comp (comp) | Swap chorus → Tremolo for rhythmic feel |
| Funk | Simple Delay (delay) | Plate (reverb) | Fassel (wah) | LA Studio Comp (comp) | Swap delay → Chorus for thickening |

### Pod Go Slot Rules

- **Choose ALL 4 effects for every genre** — do not leave slots unused.
- Use snapshots to bypass effects for variation (e.g., bypass drive for clean snapshot).
- When the user's tone needs 5+ effects, prioritize by impact and suggest snapshot-based toggling for the rest.
- An unused slot is a wasted slot on Pod Go.

### Wah Models by Genre

| Genre | Recommendation | Alternative | Why |
|-------|---------------|-------------|-----|
| Rock / Classic Rock | Teardrop 310 (Cry Baby sweep) | UK Wah 846 (Vox) | Classic rock wah character |
| Funk | Fassel (vocal sweep, RMC) | Weeper (Mu-Tron envelope) | Funky, expressive sweep |
| Blues | Chrome Custom (smooth, modified Vox) | UK Wah 846 | Warm, less aggressive |
| Metal | Teardrop 310 (aggressive sweep) | Throaty (dark, growling) | Cuts through high gain |
| Default (any genre) | Chrome Custom (versatile) | — | Safest all-rounder |`;
}

// ---------------------------------------------------------------------------
// Stadium — Arena/FOH context, clarity and headroom focused
// ---------------------------------------------------------------------------

function stadiumEffectSection(): string {
  return `## Genre-Informed Effect Model Selection

Stadium presets are designed for arena clarity and FOH translation. Favor effects that maintain headroom and cut through a PA system. Effects can be run at higher mix levels than bedroom rigs — Stadium's headroom means less muddiness at high mix.

### Delay Models by Genre

| Genre | Primary Recommendation | Alternative | Arena Caution |
|-------|----------------------|-------------|---------------|
| Blues / Classic Rock | Transistor Tape (EP-3 warmth) | Bucket Brigade (DM-2 grit) | Keep delay time under 500ms to avoid clashing with room reflections |
| Country | Bucket Brigade (clean repeats) | Simple Delay | Slapback works well in arenas — keeps rhythm tight |
| Rock / Hard Rock | Simple Delay (clean, clear) | Dual Delay (stereo spread) | Stereo spread may collapse to mono at FOH — test in mono |
| Metal | Simple Delay (tight, low mix) | Ducked Delay (stays out of riffs) | Keep mix under 20% — high-gain delay buildup causes mud through PA |
| Jazz | Adriatic Delay (warm BBD tone) | Simple Delay | Warm delays translate better through PA than digital-bright ones |
| Ambient / Post-Rock | Heliosphere (ambient delay/reverb) | Adriatic Swell | Long tails can wash out in reverberant venues — use ducking |
| Worship | Ducked Delay (clears during playing) | Heliosphere | Ducked delay is essential for worship clarity at volume |
| Psychedelic | Cosmos Echo (Space Echo tape) | Sweep Echo (filter sweep) | Filter sweeps can cause feedback at stage volume — use with care |
| Pop | Ping Pong (stereo width) | Simple Delay | Verify stereo image translates to venue PA |
| Funk | Simple Delay (tight, rhythmic) | ADT (thickening) | Keep delay tight — loose timing muddies groove at volume |

### Reverb Models by Genre

| Genre | Primary Recommendation | Alternative | Arena Caution |
|-------|----------------------|-------------|---------------|
| Blues / Classic Rock | Plate (universal warmth) | '63 Spring (authentic drip) | Plate translates better than spring through PA stacks |
| Country | '63 Spring (essential twang verb) | Double Tank (fuller spring) | Spring can sound harsh at arena volume — tame high end |
| Rock / Hard Rock | Plate (tight, controlled) | Room (natural ambience) | Room is safer than Hall for arena — less venue interaction |
| Metal | Room (minimal, tight) | — | Heavy reverb destroys clarity at stage volume — keep minimal |
| Jazz | Chamber (warm, natural) | Hall (larger space) | Chamber gives intimacy even in large venues |
| Ambient / Post-Rock | Ganymede (lush ambient) | Glitz (shimmer), Searchlights (modulated) | Run shimmer reverbs through a dedicated send to control FOH level |
| Worship | Ganymede (atmospheric pad) | Plateaux (shimmer plate) | Essential for atmosphere — FOH can ride the verb level |
| Psychedelic | Searchlights (modulated) | Cave (massive space) | Heavy modulation can cause phase issues through PA |
| Pop | Hall (polished, commercial) | Plate | Hall works at arena scale — matches the room naturally |
| Funk | Plate (tight, dry-ish) | Room | Keep reverb short and tight — funk needs punch, not wash |

For arena clarity, favor Room and Plate reverbs over Spring — spring can sound harsh at volume. Stadium's headroom means you can run effects at higher mix levels without muddiness.

### Wah Models by Genre

| Genre | Primary Recommendation | Alternative | Why |
|-------|----------------------|-------------|-----|
| Rock / Classic Rock | Teardrop 310 (Cry Baby sweep) | UK Wah 846 (Vox) | Classic rock wah character |
| Funk | Fassel (vocal sweep, RMC) | Weeper (Mu-Tron envelope) | Funky, expressive sweep |
| Blues | Chrome Custom (smooth, modified Vox) | UK Wah 846 | Warm, less aggressive |
| Metal | Teardrop 310 (aggressive sweep) | Throaty (dark, growling) | Cuts through high gain |
| Default (any genre) | Chrome Custom (versatile) | — | Safest all-rounder |

### FOH Translation Tips

- **Monitor compatibility:** Avoid extreme high-frequency effects in in-ear monitor mixes
- **Gain staging for PA:** Effects should sound good at bedroom AND arena levels — test at both
- **Mono collapse:** Always check how stereo effects sound summed to mono (many PA systems are mono)
- **Stage volume:** Room reverb from the actual venue interacts with your preset's reverb — less is more`;
}
