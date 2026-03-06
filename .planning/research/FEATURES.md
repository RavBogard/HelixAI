# Feature Research

**Domain:** AI-powered guitar preset generator — HelixTones preset quality deep dive
**Researched:** 2026-03-06
**Confidence:** HIGH (codebase direct inspection + Line 6 official community sources + Helix Help + professional preset pack analysis)

---

## Context: What This Milestone Adds

v5.0 delivers device-first architecture, isolated model catalogs, and Stadium firmware completeness. This research covers the **next quality leap**: expression pedal controller assignment, per-model effect intelligence (which delay/reverb model for which genre), effect combination patterns (canonical signal chain interactions), and per-device preset craft differences (what makes a great Stomp preset different from a great Floor preset).

**What already exists (do not re-research):**
- `CONTROLLERS.EXP_PEDAL_1 = 1`, `CONTROLLERS.EXP_PEDAL_2 = 2` defined in `models.ts` but NEVER USED in any builder
- 9 WAH_MODELS with `Position` param, 2 VOLUME_MODELS with `Position`/`Gain` params
- 21 DELAY_MODELS, 17 REVERB_MODELS, 19 MODULATION_MODELS — all with `defaultParams`
- Genre-aware effect parameter defaults (delay Time/Mix, reverb Mix/DecayTime/PreDelay) by 9 genres
- Chain ordering: wah > compressor > boost > amp > cab > eq > delay/reverb/mod
- Snapshot engine: 4 volume-balanced scenes (Clean/Rhythm/Lead/Ambient)
- `@controller: 19` (Snapshot) used everywhere; `@controller: 1` and `@controller: 2` exist as constants but no assignment code

**The gaps this milestone closes:**
1. Wah and Volume blocks have no `@controller` assignment — they're dead blocks in the file
2. Effect model selection is currently unguided (AI picks any model from the catalog)
3. Effect combinations have no interaction logic (comp gain level when after wah, reverb time when after specific delay)
4. Stomp vs Floor vs Pod Go preset craft differences are not encoded anywhere

---

## Research Findings: The Four Feature Areas

### Finding 1: Expression Pedal Controller Assignment

**Official behavior (Line 6 Community + Helix Help — HIGH confidence):**

Adding a Wah or Pitch Wham block in HX Edit **automatically assigns `@controller: 1` (EXP Pedal 1) to the `Position` parameter**. Adding a Volume Pedal or Pan block **automatically assigns `@controller: 2` (EXP Pedal 2) to the `Position` parameter**. This is the canonical, hardware-default assignment pattern.

The codebase already has `CONTROLLERS.EXP_PEDAL_1 = 1` and `CONTROLLERS.EXP_PEDAL_2 = 2` in `models.ts` (line 53-54). The `HlxControllerAssignment` type (types.ts line 137) confirms `2 = EXP Pedal 2`. These constants have never been applied to any block output.

**Parameter assignment details (from community inspection of .hlx exports):**

For a WAH block the controller section entry looks like:
```json
"dsp0": {
  "block0": {
    "Position": {
      "@min": 0.0,
      "@max": 1.0,
      "@controller": 1
    }
  }
}
```

For a VOLUME (Volume Pedal) block:
```json
"block1": {
  "Position": {
    "@min": 0.0,
    "@max": 1.0,
    "@controller": 2
  }
}
```

**Min/Max semantics:** `@min` = heel-down value, `@max` = toe-down value. For standard wah and volume, this is always 0.0 → 1.0.

**Toe-switch behavior:** On Helix Floor/LT, the built-in expression pedal physically toggles between EXP1 and EXP2 using a toe switch. Wah assigned to EXP1, volume to EXP2 — this is the universal hardware convention. Users press toe-down to toggle between wah and volume control modes.

**Device-specific expression pedal counts (already in DeviceCapabilities):**

| Device | expressionPedalCount |
|--------|----------------------|
| Helix Floor | 3 (built-in + 2 external) |
| Helix LT | 3 |
| HX Stomp | 2 |
| HX Stomp XL | 2 |
| Pod Go | 1 |
| Stadium | 0 (external only) |

**Pod Go single-pedal convention:** Pod Go has one expression pedal. When both wah and volume are present, the standard practice is: wah assigned to EXP1 (the onboard pedal), volume at unity gain (no controller assignment needed — stays at fixed position). The built-in EXP pedal handles wah; volume is always-on at full.

**Stadium (0 built-in):** Stadium users attach external expression pedals. Assignment follows the same EXP1=wah, EXP2=volume convention when pedals are connected. Presets should still emit the controller assignments — the pedal simply has no effect if no external pedal is connected.

**@snapshot_disable field:** For expression pedal assignments, `@snapshot_disable` should NOT be included or should be `false`. Expression pedals are real-time controllers — snapshot-scoped position would break the physical experience of sweeping the pedal.

**Source confidence:** HIGH — codebase confirms constants exist and are never applied; Line 6 Community confirms EXP1=wah/EXP2=volume as hardware default behavior; community confirmed the `@controller` integer mapping (1=EXP1, 2=EXP2) through preset inspection.

---

### Finding 2: Per-Model Effect Selection Intelligence

#### Delay Models (21 models — which to use when)

Community consensus + Fluid Solo preset analysis (MEDIUM-HIGH confidence):

| Model | Based On | Best Genre(s) | Character | When to Use |
|-------|----------|--------------|-----------|-------------|
| Transistor Tape | Echoplex EP-3 | Blues, Classic Rock, Country, Americana | Warm, organic, slightly dark repeats with Wow/Flutter | Any tone that needs vintage character; Hendrix, SRV, vintage country |
| Cosmos Echo | Roland RE-201 Space Echo | Psychedelic Rock, Pink Floyd, Surf, Reggae | Warm, tape-head switching with multiple echo modes | Pink Floyd-style runs, surf guitar, reggae slapback |
| Bucket Brigade | Boss DM-2 | Blues, Lo-fi, Indie Rock | Analog warmth, slightly degraded repeats | When digital clarity would feel clinical |
| Elephant Man | EHX Deluxe Memory Man | Blues, Rock, Indie | Analog with chorus modulation | Expressive lead lines needing "movement" in the repeats |
| Adriatic Delay | Boss DM-2 (Modded) | Rock, Blues | Modulated analog BBD | Similar to Elephant Man but with different mod character |
| Simple Delay | Line 6 Original | Rock, Pop, Studio, Double-Tracking | Clean digital; repeats are slightly low-pass filtered | When clarity is more important than character; 80ms ADT |
| Ducked Delay | TC Electronic 2290 | Worship, Pop, Country | Level ducks while playing, blooms in gaps | "Never gets in the way" technique; always-on workhorse |
| Ping Pong | Line 6 Original | Pop, Ambient, Studio | True stereo left-right alternation | Stereo mixes; wide spatial effect |
| Heliosphere | Line 6 Original | Ambient, Post-Rock | Delay+Reverb hybrid | Ambient pads; when delay and reverb are one texture |
| Adriatic Swell | Line 6 Original | Ambient, Worship, Shoegaze | Volume swell on each repeat | Self-bowing effect; Mogwai/My Bloody Valentine territory |
| Vintage Swell | Line 6 Original | Ambient, Post-Rock | Digital with swell | Same as Adriatic Swell with brighter character |
| Multi Pass | Line 6 Original | Ambient, Experimental | Multi-tap up to 4 heads | Rhythmically complex patterns; not for standard delay |
| Reverse Delay | Line 6 Original | Psychedelic, Experimental | Reversed echo | Effects track, not a utility delay |
| ADT | Abbey Road ADT | Rock, Country, Pop | 15-40ms double-track | Radio-production shimmer; vocal doubling effect on guitar |
| Harmony Delay | Line 6 Original | Rock, Country, Pop | Pitched repeats (interval selectable) | Countrified "thirds in the delay" trick |
| Pitch Echo | Line 6 Original | Ambient, Shoegaze | Pitch-shifted repeats | The Edge-style octave delay |
| Sweep Echo | Line 6 Original | Psychedelic, Experimental | Filter-swept repeats | Not a production utility delay |
| Mod/Chorus Echo | Line 6 Original | 80s Rock, New Wave | Chorus-modulated repeats | Period-appropriate 80s shimmer |

**Default recommendation by genre (for planner model selection):**

| Genre | Primary Delay | Secondary/Alternative |
|-------|--------------|----------------------|
| Blues | Transistor Tape | Bucket Brigade |
| Rock | Simple Delay | Transistor Tape |
| Country | Transistor Tape | Ducked Delay |
| Metal | Simple Delay | Ducked Delay (low mix) |
| Jazz | Simple Delay | Bucket Brigade |
| Worship | Ducked Delay | Transistor Tape |
| Ambient | Heliosphere | Adriatic Swell |
| Pop | Ducked Delay | Simple Delay |
| Funk | Simple Delay | (often no delay) |
| Psychedelic/Surf | Cosmos Echo | Reverse Delay |

#### Reverb Models (17 models — which to use when)

Community consensus + Helix forum research (MEDIUM-HIGH confidence):

| Model | Based On | Best Genre(s) | Character | When to Use |
|-------|----------|--------------|-----------|-------------|
| Plate | Studio Plate | Rock, Pop, Country, Blues, Jazz | Metallic-smooth studio character | Go-to for "add pro sheen without taking over" — the default workhorse |
| Room | Line 6 Original | Blues, Jazz, Country, Rock | Small-medium natural room | When you want presence, not reverb — "I'm in a room" not "I'm in a hall" |
| Hall | Line 6 Original | Worship, Ambient, Classical | Large, full concert hall | Live worship pads, orchestral textures, big spatial placement |
| Chamber | Line 6 Original | Blues, Jazz, Studio Pop | Small studio echo chamber | Between Room and Hall; natural without being large |
| '63 Spring | Fender '63 Spring Unit | Blues, Country, Surf, Rockabilly | Drip, splash, characteristic spring "boing" | When spring reverb is part of the tone identity, not just ambience |
| Double Tank | Line 6 Original | Blues, Country, Surf | Double spring simulation | Bigger, more dramatic spring than '63 Spring |
| Spring | Line 6 Original | Blues, Country, Rockabilly | Cleaner spring simulation | General-purpose spring; less character than '63 Spring |
| Ganymede | Line 6 Original Ambient | Ambient, Post-Rock, Worship | Large atmospheric reverb | Mix at 13-23%; modulation off for more natural feel; popular for always-on ambient wash |
| Glitz | Line 6 Original Shimmer | Ambient, Post-Rock, Worship | Shimmer (pitch-shifted voices) | The Edge shimmer, post-rock swells — not subtle |
| Plateaux | Shimmer Plate | Ambient, Post-Rock | Shimmer + plate character | Slightly different shimmer voicing from Glitz |
| Octo | Octave Reverb | Ambient, Experimental | Octave-pitch-shifted tails | More experimental than Glitz; strong harmonic character |
| Searchlights | Modulated | Ambient, Worship, Jazz | Modulated reverb with movement | When plate/hall feel static; chorus-in-the-reverb-tail feel |
| Particle Verb | Granular | Experimental, Ambient | Granular processing | Stutter/freeze effects; not a production workhorse |
| Ducking | Ducking Reverb | Worship, Pop, Country | Level ducks while playing | Same utility as Ducked Delay — clear attack, ambient tail |
| Cave | Line 6 Original | Ambient, Cinematic | Very large natural cave | For dramatic spatial placement when Hall isn't big enough |
| Tile | Tile Room | Jazz, Blues, Lofi | Small bright room | Tight reverb that doesn't overwhelm; coffee-shop intimacy |
| Echo | Reverb Echo | Ambient, Experimental | Reverb + echo hybrid | Similar to Heliosphere but in reverb category |

**Default recommendation by genre:**

| Genre | Primary Reverb | Secondary/Alternative |
|-------|---------------|----------------------|
| Blues | Plate | Room or '63 Spring |
| Rock | Plate | Room |
| Country | '63 Spring | Plate |
| Metal | Room | Plate (very low mix) |
| Jazz | Room | Plate |
| Worship | Hall | Ganymede |
| Ambient | Ganymede | Glitz |
| Pop | Plate | Hall |
| Funk | Room | (often no reverb or very low mix) |
| Surf/Rockabilly | '63 Spring | Double Tank |

#### Wah Models (9 models — which to use when)

Community consensus from Helix community + Helix Help (HIGH confidence):

| Model | Based On | Genre/Character | When to Use |
|-------|----------|----------------|-------------|
| Chrome Custom | Modded Vox V847 | Blues, Classic Rock, Americana — smooth, vocal, musical | Community's most-cited "most musical" wah; go-to for blues/classic rock |
| Teardrop 310 | Dunlop Cry Baby Fasel | Rock, Hard Rock — wider aggressive sweep | Cry Baby character with Fasel inductor; more cut than Chrome Custom |
| UK Wah 846 | Vox V846 | Blues, Classic Rock — vintage Vox | Earlier Vox circuit; slightly different character from Chrome Custom |
| Fassel | RMC Real McCoy 1 | Funk, Blues — smooth sweep with defined peak | Custom-wound inductor character; vocal and defined |
| Weeper | Musitronics Mu-Tron III | Funk — envelope-like sweep | Auto-wah character; works as both pedal and envelope filter |
| Throaty | Line 6 Original | Jazz, Experimental — deep resonant sweep | Lower-frequency emphasis; more unusual character |
| Conductor | Maestro Boomerang | Vintage, Country — vintage character | Maestro-inspired; unusual vintage sound |
| Colorful | Colorsound Wah | Experimental, Classic Rock — unique flavor | Colorsound circuit has distinct character different from Vox/Dunlop |
| Chrome | Vox V847 | Blues, Classic Rock | Standard Vox V847 without Custom mod; slightly less refined than Chrome Custom |

**Default recommendation by genre/use case:**

| Use Case | Recommended Wah |
|----------|----------------|
| Blues / Classic Rock (general) | Chrome Custom |
| Hendrix / Cream / Clapton | Chrome Custom or UK Wah 846 |
| Funk (Shaft, James Brown style) | Fassel or Weeper |
| Hard Rock / Joe Satriani / Kirk Hammett | Teardrop 310 |
| Envelope-filter funk | Weeper |
| Experimental / unusual character | Colorful or Throaty |

#### Modulation Models (19 models — key selections)

For planner AI guidance on primary modulation choice by genre:

| Genre | Primary Modulation | Secondary |
|-------|-------------------|-----------|
| Blues | Ubiquitous Vibe (Uni-Vibe) | Optical Trem |
| Classic Rock | 70s Chorus (CE-1) | Script Mod Phase |
| Country | Optical Trem | 60s Bias Trem |
| Metal | (none or very subtle) | Pattern Tremolo |
| Jazz | 145 Rotary or Script Mod Phase | (subtle chorus) |
| Worship | PlastiChorus or Trinity Chorus | Ubiquitous Vibe |
| Ambient | Bubble Vibrato or Trinity Chorus | (slow chorus) |
| 80s Rock/Pop | Mod/Chorus Echo (delay) or PlastiChorus | Gray Flanger |

---

### Finding 3: Effect Combination Patterns

#### Canonical Signal Chain Order (confirmed from multiple sources — HIGH confidence)

Standard Helix chain order used in professional presets:

```
Wah → Compressor → Drive/Boost → Amp → Cab → [Gate] → Modulation → Delay → Reverb
```

**Placement rationale (actionable for code):**

- **Wah before compressor:** Wah is impedance-sensitive; compressor after wah prevents the compressor from limiting the wah's filter sweep range. Wah placed FIRST in the chain.
- **Compressor before drive:** Compressor evens dynamics so the drive receives a consistent input signal. Placing comp AFTER drive compresses an already-clipped signal, producing a different (usually inferior) result for most genres.
- **Drive before amp:** Pedal drive boosts amp input — this is how real pedalboards work. Helix should mirror this.
- **Noise gate after drive section, before amp:** The gate quiets the drive's noise floor without killing delay/reverb trails. IMPORTANT: Gate placed BEFORE delay/reverb, so trails are not gated.
- **Modulation after amp/cab:** Modulates the fully-shaped tone. Chorus before drive produces washy, unfocused modulation.
- **Delay before reverb:** Delay repeats enter reverb for a natural, wet tail. Reverb before delay creates "wash of sound" that many find muddy — not the standard.

**Exception: Spring reverb before amp (blues/surf context)**

For spring reverb-into-amp tones (surf, rockabilly, authentic Fender spring), the '63 Spring or Double Tank can be placed BEFORE the amp in the chain. This is a specific genre technique. Standard placement is post-amp.

**Compressor interaction with wah (critical for code):**

When a wah block AND compressor are both present, the comp parameters need adjustment: the wah's dynamic filter peaks can trigger over-compression when the comp sits right after an expressive wah sweep. Practical solution: set compressor `Threshold` slightly lower (0.40 vs 0.50 default) when wah is also in the chain. This is a parameter interaction not currently in the codebase.

#### Genre-Specific Effect Combination Patterns

**Worship (most specific combination patterns found in research):**

- Always-on: Minotaur (Klon-style, low gain) → amp → Plate reverb (always-on, low mix)
- Expression pedal: volume swell as primary EXP2 control
- Ducked Delay as workhorse ("never gets in the way")
- Stacking drives: low-gain drive always-on, medium-gain drive toggle, high-gain toggle — each ADDS to the previous rather than being mutually exclusive
- Snapshot approach: each snapshot adjusts drive level AND delay mix AND reverb mix simultaneously, not just individual effects

**Metal (most specific signal chain requirements):**

- Gate BEFORE amp is critical for high-gain — suppresses input noise before the amp gain stage
- Delay mix very low (8-15%); reverb nearly off (5-10% mix) — ambience not space
- No modulation unless flanger used as effect (not ambient)
- Compressor typically absent or used as limiter post-amp
- Boost (Scream 808 / Minotaur) before high-gain amp tightens low end

**Blues (reverb + delay interaction):**

- Transistor Tape delay + Plate reverb = the canonical blues combination
- Delay time: quarter-note or dotted-eighth (already in param-engine with delaySubdivision)
- Reverb mix conservative (15-25%); delay mix conservative (15-25%) — neither dominates
- Compressor always present for clean tone sustain; optional for crunch tones

**Ambient (reverb + delay as primary texture):**

- Ganymede or Glitz shimmer reverb at high mix (40-60%)
- Long delay (Adriatic Swell or Heliosphere) at medium mix (30-40%)
- Modulation (slow chorus or vibe) feeding into delay chain
- Compressor absent or very gentle (auto-swell for volume swells)
- Signal chain: Guitar → Amp (clean) → Chorus → Delay → Reverb

**Jazz (minimal, precise effect use):**

- Reverb (Room or Plate) as subtle ambience only (15-25% mix)
- No delay in most jazz presets — if present, very short (80-120ms, low mix)
- 145 Rotary or Script Phase for Leslie-style movement (jazz organ players especially)
- Compressor always present (jazz requires extremely consistent dynamics)

#### Cross-Effect Parameter Interactions (currently missing from param-engine)

These interactions are not currently encoded but are industry-standard professional techniques:

| Interaction | Rule | Implementation Approach |
|------------|------|------------------------|
| Wah present → Compressor Threshold | Lower comp threshold by 0.10 (e.g., 0.50 → 0.40) when wah in chain | Add wah-presence check in `resolveParameters()` for dynamics blocks |
| Metal genre → Gate position | Gate placed BEFORE amp block (not after) | Chain-rules: for high_gain amps, gate goes at DSP0 position 0-1, before amp |
| Ambient genre → Reverb mix elevated | Ambient reverb mix 0.40-0.60 (vs standard 0.20-0.25) | Already partially handled by GENRE_EFFECT_DEFAULTS; needs reverb model selection to match |
| Worship + Ducked Delay | Ducked Delay model selected automatically for worship genre | Planner recommendation: suggest "Ducked Delay" model name for worship genre |
| High-gain + Delay | Delay mix capped at 15% for metal/high_gain | GENRE_EFFECT_DEFAULTS metal.delay.Mix = 0.12 already set; needs enforcement via model selection |
| Reverb decay × amp category | Clean amp: longer decay OK (0.5-0.8s); high-gain: short decay only (0.3-0.4s) | DecayTime override in GENRE_EFFECT_DEFAULTS; already partially addressed |

---

### Finding 4: Per-Device Preset Craft Differences

#### Helix Floor / LT (dual-DSP, 16 blocks, full capability)

**The "kitchen sink" problem doesn't exist here.** With 16 blocks, the craft challenge is quality of selection, not scarcity. Professional Helix Floor presets exhibit:

- Full signal chain: wah + comp + drive + boost + amp + cab + EQ + mod + delay + reverb = 10 blocks on DSP0, leaving DSP1 for gate + extra effects
- Always-on blocks: boost (Minotaur/Scream 808) and EQ are permanent in chain; snapshots control bypass state of drive/mod/delay
- Dual-amp capability: AB topology for clean+driven — this is a Floor/LT exclusive (never possible on Stomp/Pod Go)
- 8 snapshots: Full 8-snapshot utilization for complex live set designs
- Expression pedal design: Both EXP1 (wah) and EXP2 (volume) are always assigned because hardware has both

**Craft principle:** Helix presets win on texture and detail, not on scarcity management.

#### HX Stomp (6 blocks total, single DSP)

**Every block counts.** The 6-block hard limit means amp+cab = 2 blocks, leaving 4 for everything else. Professional Stomp presets:

- **Never waste a block on EQ** — EQ shaping is done via amp parameters (amp Drive/Presence/Bass/Treble) and cab parameters (LowCut/HighCut), not a dedicated EQ block. The mandatory Parametric EQ from Helix preset templates does NOT belong in a Stomp preset.
- **Compressor optional on crunch/gain tones** — only include if it's essential to the tone identity (blues sustain, country chicken-pick)
- **Single drive block maximum** — no room for boost + drive stacking
- **Delay + Reverb are likely your two post-amp blocks** — this is the archetypal Stomp layout: Amp, Cab, Drive, Dynamics, Delay, Reverb
- **Preamp block trick** (saves 0.5 blocks DSP budget): use a preamp model instead of full amp+cab if DSP budget is exceeded
- **No mandatory Gain Block** — the Gain Block (output volume) in Helix presets is a luxury Stomp can't afford; use output block gain instead

**Expression pedal design (Stomp-specific):** Both EXP1 and EXP2 are available. However, Stomp presets often omit the wah block entirely (not enough blocks for wah + drive + delay + reverb) unless the user specifically requested wah. When wah IS included, the EXP1 assignment is critical — otherwise the wah block does nothing.

**Craft principle:** Stomp presets win by making every block earn its spot. Quality through constraint.

#### HX Stomp XL (9 blocks, single DSP)

Sits between Stomp and Helix LT. 9 blocks allows:
- Amp + Cab + Drive + Dynamics + Mod + Delay + Reverb = 7 blocks
- Still no room for Parametric EQ as a dedicated block
- Can support wah as an 8th block when requested
- **4 snapshots** (vs Stomp's 3): the extra snapshot matters for live use

**Craft principle:** Stomp XL is Stomp with room for one or two extras. Design as Stomp, then ask "what do you want the extra blocks for?"

#### Pod Go (4 user effect slots, fixed wah/volume/amp/cab/eq/fxloop positions)

The Pod Go's architecture is different from all Helix devices:
- Wah, Volume, Amp, Cab, EQ, and FX Loop are fixed blocks with fixed positions
- Only 4 blocks are "flexible" (user-assignable)
- The fixed EQ block means Pod Go CAN have EQ shaping without spending a user block
- The fixed FX loop block is always present (can't remove it to gain a block)

**Craft principle for Pod Go:** The 4 flexible effects ARE the entire creative decision. Standard loadout: Compressor + Drive + Delay + Reverb = 4 effects, completely fills the budget. Any modulation replaces one of these. Wah is always available (fixed block) but needs EXP1 assignment to be useful.

**Expression pedal design (Pod Go-specific):** Pod Go has 1 expression pedal. Wah is a fixed block and should get EXP1 assignment. Volume is also a fixed block — but with only 1 pedal available, volume control is typically managed via the output block level or amp Channel Volume, NOT via a controller assignment (since the single pedal is already used for wah). The volume block's Position parameter should NOT get `@controller: 2` on Pod Go since there's no second pedal to drive it.

**Helix Stadium (dual-path DSP, Agoura amps, no built-in expression pedal)**

Stadium is a professional installation and live sound device. Its preset craft differs from floor units:
- No built-in expression pedal → no EXP1/EXP2 assignments in generated presets UNLESS the user specifically states they have external pedals
- 8 snapshots available and should be fully utilized in professional Stadium presets
- Block budget is effectively unlimited (48 blocks) — the constraint is sound design quality, not quantity
- Stadium's dual-path capability supports wet/dry routing (guitar on path 1, effects return on path 2) — this is an advanced technique relevant to Stadium-specific conversation arcs
- The mandatory EQ and Gain Block blocks from Helix presets ARE appropriate for Stadium (same as Helix Floor)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any "world-class preset" product must deliver. Missing = preset feels broken on hardware.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Wah block → EXP1 controller assignment | Wah block without `@controller: 1` on `Position` is a dead block on hardware — pedal does nothing | LOW | Add controller section entry for wah block in all builders; `@min: 0.0`, `@max: 1.0`, `@controller: 1` |
| Volume block → EXP2 controller assignment (Helix/Stomp/StompXL) | Same as above — volume block is decorative without controller assignment | LOW | Add controller section entry for volume block; `@controller: 2`; only for devices with expressionPedalCount >= 2 |
| Genre-aware delay model selection | Users expect AI to pick Transistor Tape for blues, not Simple Delay — model selection is part of professional tone knowledge | MEDIUM | Add `preferredDelayModel` and `preferredReverbModel` per genre to GENRE_EFFECT_DEFAULTS; planner prompt guidance to select matching model name |
| Genre-aware reverb model selection | Plate for rock/pop, Spring for country/blues/surf, Ganymede for ambient/worship | MEDIUM | Same mechanism as delay model selection |
| Wah model selection by genre | Chrome Custom for blues, Teardrop 310 for hard rock — currently all wah models have identical defaultParams | LOW | Add wah model recommendations to planner prompt; planner already selects wah model name |
| Canonical signal chain order (wah before comp before drive) | Chain: Wah > Comp > Drive > Amp — is already implemented in chain-rules.ts; verified correct | COMPLETE | No action needed — already built |
| No EQ block in Stomp/Pod Go presets | Professional Stomp presets never waste a block on EQ — that budget is reserved for drive/delay/reverb | LOW | Remove `eq` from Stomp/Pod Go `mandatoryBlockTypes`; already `[]` for Stomp — CONFIRM no EQ block is inserted for these devices |
| Delay before reverb ordering | Already enforced by chain-rules.ts position priorities | COMPLETE | Verified |

### Differentiators (Competitive Advantage)

Features that set HelixTones apart from "AI generates random settings" quality level.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Ducked Delay auto-selection for worship/country | Ducked Delay is the professional workhorse for "never gets in the way" delay — AI knowing to pick it is a mark of expertise | LOW | Add worship → "Ducked Delay", country → "Ducked Delay" to genre-preferred-delay table |
| Wah → Comp threshold interaction | When wah is in chain, comp threshold drops 0.10 to prevent over-compression of wah peaks | LOW | Add wah-presence check in `resolveParameters()` dynamics block section |
| Spring reverb for country/blues/surf (not Plate) | '63 Spring + Transistor Tape = canonical blues/country combination; Plate is the wrong call for this genre | LOW | Add spring reverb preference for blues/country/surf to genre-preferred-reverb table |
| Pod Go: no EXP2 volume assignment | Pod Go has 1 pedal; assigning volume to EXP2 creates a dead controller assignment — AI should know this device constraint | LOW | Check `expressionPedalCount < 2` before adding volume controller assignment |
| Per-genre wah model selection | Chrome Custom for blues, Teardrop 310 for rock — this distinction is invisible to a naive model picker | LOW | Add to planner prompt: wah model recommendations by genre/use case |
| Shoegaze/ambient delay model intelligence | Adriatic Swell and Vintage Swell for self-bowing ambient; Heliosphere for delay-reverb hybrid — these are highly specific but mark expert knowledge | MEDIUM | Add ambient sub-genres to preferred-delay table |
| Metal noise gate placement (before amp) | Gate before amp on high-gain tones is the correct professional technique; gate after amp misses the point | MEDIUM | Add gate-before-amp rule for high_gain ampCategory in chain-rules.ts |
| Comp absent from metal/high-gain presets | Compressors are not standard in metal presets — including one is a mark of non-expertise | LOW | Add metal genre check: if genre is metal and ampCategory is high_gain, skip compressor block |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Assign ALL effects to expression pedals | "Make everything controllable" | Helix supports max 64 controller assignments; more importantly, real pedals only have 1-2 expression inputs. Assigning delay time to expression pedal creates an unplayable preset — player can't control 6 expression params simultaneously | Assign only `Position` (wah) and `Position` (volume) by default — the two hardware-natural assignments |
| Reverb before delay as default | "Some players prefer this for ambient tones" | Reverb → Delay creates muddy wash unless specifically intended (ambient genre). Delay → Reverb is the industry default for clarity | Use standard delay-before-reverb; document the reverb-before-delay technique as a specialty choice for ambient genre only |
| Compressor as always-on for ALL genres | "Compressor improves any tone" | High-gain metal with a compressor sounds wrong — metal relies on amp dynamics, not compressed dynamics. Funk loses the snap. Clean jazz needs it; metal does not. | Use genre-aware compressor inclusion: always-on for blues/jazz/country/clean, optional for rock/crunch, omit for metal/high-gain |
| 9 wah models with identical defaults | "All 9 wah models are equally valid choices" | Chrome Custom is the community's go-to for good reason; offering 9 identical entries in the planner catalog without selection intelligence forces the AI to pick randomly | Add genre-aware wah model recommendation to planner prompt; don't change defaultParams (they're correct), just guide selection |
| Parametric EQ in Stomp preset as mandatory | "EQ block makes presets more professional" | EQ costs 1 of 6 blocks on Stomp — that's 17% of the block budget. Amp + cab parameters handle frequency shaping without spending a block. | Use amp/cab parameter tuning (already done via param-engine); reserve EQ block for Helix/Stadium where blocks are not scarce |

---

## Feature Dependencies

```
Expression pedal assignment (wah/volume)
    └──requires──> Controller section in builder (already has @controller: 19 for snapshots)
    └──requires──> CONTROLLERS.EXP_PEDAL_1 and EXP_PEDAL_2 (already defined, never used)
    └──requires──> Device capability check: expressionPedalCount >= 1 for wah EXP1
    └──requires──> Device capability check: expressionPedalCount >= 2 for volume EXP2
    └──Pod Go exception──> Only EXP1 (wah) gets assigned; EXP2 skipped because expressionPedalCount = 1
    └──Stadium exception──> EXP assignment still written to file (hardware reads it when external pedal connected)

Genre-aware model selection (delay/reverb/wah)
    └──requires──> Per-genre preferred model table (new data structure)
    └──requires──> Planner prompt updated with model selection guidance
    └──OR──> Param-engine secondary selection: if genreHint matches, override modelName for delay/reverb
    └──note──> Planner already selects model names; guidance is the right lever, not post-hoc override
    └──enhances──> Genre-aware effect params (already in GENRE_EFFECT_DEFAULTS) — model AND params now both genre-aware

Effect combination intelligence (cross-effect interactions)
    └──wah → comp threshold reduction
            └──requires──> wah block presence detection in resolveParameters()
            └──requires──> dynamics block processing reads wah-in-chain flag
    └──metal gate placement (before amp)
            └──requires──> chain-rules position priority change for gate when high_gain ampCategory
            └──note──> Currently gate is placed at end (horizon gate position = max); this inverts for metal
    └──compressor omission for metal/high-gain
            └──requires──> intentRole or genre-based suppression of dynamics block insertion
            └──note──> Currently compressor is always included via chain-rules

Per-device preset craft (Stomp vs Floor vs Pod Go)
    └──EQ block exclusion for Stomp/StompXL
            └──ALREADY IMPLEMENTED: mandatoryBlockTypes = [] for Stomp family
            └──VERIFY: no EQ is being inserted in chain-rules for Stomp devices
    └──Gain Block exclusion for Stomp
            └──ALREADY IMPLEMENTED: mandatoryBlockTypes = [] for Stomp family
    └──Volume EXP2 exclusion for Pod Go
            └──NEW: add expressionPedalCount check in pod go builder's buildControllerSection
    └──Stadium EXP assignment style
            └──NEW: emit EXP1/EXP2 assignments in stadium-builder even without built-in pedal
```

### Dependency Notes

- **Expression pedal assignment is P0.** Wah and volume blocks exist in generated presets already. They are currently inert on hardware (no EXP assignment). This is a silent bug — the preset loads, shows the block, but pressing the pedal does nothing. This is the highest-priority fix in this milestone.
- **Genre-aware model selection depends on the planner prompt, not param-engine.** The planner already selects model names; adding genre guidance to the planner prompt is the correct lever. Param-engine post-selection overrides are a code smell here.
- **Effect combination interactions are medium-complexity.** Wah→comp threshold and metal gate placement are independent changes in param-engine and chain-rules respectively. Neither blocks the other.
- **Per-device craft differences are mostly already implemented** (Stomp has mandatoryBlockTypes = []). The main gap is Pod Go EXP2 exclusion and the EQ/Gain block verification for Stomp.

---

## MVP Definition

### Launch With (core quality fixes — these make presets actually work correctly)

- [ ] Wah block EXP1 controller assignment — add controller section entry for `Position` with `@controller: 1` when wah block is in chain; works for all builders (preset-builder, stomp-builder, podgo-builder, stadium-builder)
- [ ] Volume block EXP2 controller assignment — same mechanism for volume block `Position` with `@controller: 2`; skip for Pod Go (expressionPedalCount = 1)
- [ ] Genre-aware delay model selection guidance in planner prompt — table of `genre → preferred delay model name` added to planner instructions; blues → "Transistor Tape", worship → "Ducked Delay", ambient → "Heliosphere", etc.
- [ ] Genre-aware reverb model selection guidance in planner prompt — blues → "Plate" or "'63 Spring", country → "'63 Spring", ambient → "Ganymede", worship → "Hall"
- [ ] Genre-aware wah model selection guidance in planner prompt — blues → "Chrome Custom", hard rock → "Teardrop 310", funk → "Fassel"

### Add After Core Fixes (quality refinements)

- [ ] Wah → Compressor threshold interaction — lower comp `Threshold` by 0.10 when wah is in chain; add to `resolveParameters()` dynamics section
- [ ] Metal/high-gain compressor exclusion — if `ampCategory === "high_gain"` and no explicit user request, omit compressor block from chain-rules assembly
- [ ] Noise gate before amp for high-gain — move gate position to before amp in DSP0 ordering for high_gain ampCategory

### Future Consideration (architecture-level, deferred)

- [ ] Per-genre modulation model selection — similar guidance table for mod models; current defaults are already reasonable
- [ ] Effect preset "template" per genre — pre-packaged effect combinations (e.g., "blues template: Transistor Tape + Plate + Chrome Custom wah") as planner starting points
- [ ] Reverb before delay as ambient option — detect ambient/shoegaze genre and allow reverb-before-delay ordering as explicit option

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Wah EXP1 controller assignment | HIGH — wah block is useless without it | LOW | P0 |
| Volume EXP2 controller assignment | HIGH — volume pedal is useless without it | LOW | P0 |
| Genre delay model selection (planner prompt) | HIGH — Transistor Tape for blues vs Simple Delay is audibly different | LOW (prompt addition) | P1 |
| Genre reverb model selection (planner prompt) | HIGH — Spring for country is a core identity marker | LOW (prompt addition) | P1 |
| Genre wah model selection (planner prompt) | MEDIUM — Chrome Custom vs Teardrop matters for feel, not correctness | LOW (prompt addition) | P1 |
| Wah → comp threshold interaction | MEDIUM — subtle but professional players will notice | LOW (param-engine edit) | P2 |
| Metal compressor exclusion | MEDIUM — compressor in metal preset is a quality marker | LOW (chain-rules edit) | P2 |
| Metal gate before amp | MEDIUM — correct technique; most users won't know they're missing it | MEDIUM (chain-rules reorder) | P2 |

---

## Per-Device Constraint Reference (for Planner Prompt Integration)

### Helix Floor / LT
- 16 blocks across 2 DSPs; dual-amp supported
- Always include: Minotaur/Scream boost, Parametric EQ (post-cab), Gain Block, Horizon Gate
- Expression: EXP1 = wah, EXP2 = volume; both always assigned when those blocks are present
- Delay model selection: full creative freedom

### HX Stomp
- 6 blocks total; NO EQ block; NO Gain Block; NO dual-amp
- Typical layout: Amp + Cab + Drive + Dynamics + Delay + Reverb = 6 (full budget)
- If wah requested: replace Dynamics with Wah, or replace Reverb with Wah (user choice)
- Expression: EXP1 = wah (if present), EXP2 = volume (if present, 2 pedals available)

### HX Stomp XL
- 9 blocks total; NO EQ block as mandatory; NO dual-amp; 4 snapshots
- Layout: Amp + Cab + Drive + Dynamics + Modulation + Delay + Reverb = 7 blocks (2 free)
- Expression: same as Stomp

### Pod Go
- 4 flexible effects; fixed wah, volume, amp, cab, eq, fxloop positions
- Standard flexible layout: Compressor + Drive + Delay + Reverb (exactly 4)
- Expression: EXP1 = wah ONLY; do NOT assign EXP2 (no second pedal)

### Helix Stadium
- Effectively unlimited blocks (48); Agoura amps only
- Always include: EQ (post-cab), Gain Block; 8 snapshots
- Expression: no built-in pedal; still emit controller assignments for connected external pedals

---

## Sources

- [Controller Assign — Helix Help](https://helixhelp.com/tips-and-guides/helix/controller-assign) — HIGH confidence (official Line 6 community reference; confirms EXP1=wah, EXP2=volume as hardware default)
- [EXP1/EXP2 assignment discussion — Line 6 Community](https://line6.com/support/topic/32330-how-to-assign-default-expression-pedal-exp1exp2-on-helix/) — HIGH confidence (community confirms automatic assignment behavior)
- [How to resolve Volume/Wah expression pedal conflict — Line 6 Community](https://line6.com/support/topic/45297-how-to-resolve-volume-and-wah-expression-pedal-conflict/) — HIGH confidence (documents toe-switch toggle behavior)
- [Delay Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/delay/) — MEDIUM confidence (model list and descriptions)
- [Wah Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/wah/) — HIGH confidence (all wah models with base hardware)
- [Reverb Models overview — Helix Help](https://helixhelp.wordpress.com/models/effects/reverb/) — MEDIUM confidence (model descriptions)
- [Creating a Helix Electric Guitar Patch — jimamsden.wordpress.com](https://jimamsden.wordpress.com/2017/12/10/creating-a-helix-electric-guitar-patch-newly-updated/) — MEDIUM confidence (professional preset building walkthrough; Chrome Custom cited as "most musical wah")
- [Signal Chain 101 — Reverb.com](https://reverb.com/news/signal-chain-101-going-back-to-school-on-pedal-order) — HIGH confidence (industry-standard signal chain ordering)
- [Reverb and Delay placement — Pro Sound HQ](https://prosoundhq.com/reverb-and-delay-pedal-placement-guide-best-chain-order/) — MEDIUM confidence (delay before reverb as standard; reverb before delay as exception)
- [Compressor placement — Origin Effects](https://origineffects.com/2021/09/17/tech-tips-compressors-always-first-in-the-chain/) — HIGH confidence (authoritative compressor placement guide)
- [Signal Chain Order — Guitar Player](https://www.guitarplayer.com/gear/guide-to-guitar-pedal-order) — HIGH confidence (industry publication; confirms canonical order)
- [Fluid Solo — Transistor Tape community usage](https://www.fluidsolo.com/patchexchange/view-model/Transistor-Tape,338?page=2) — MEDIUM confidence (community preset analysis)
- [Best Wah Pedal community discussion — The Gear Page](https://www.thegearpage.net/board/index.php?threads/how-do-you-like-the-wah-on-the-line-6-helix-hx-effects.2056883/) — MEDIUM confidence (Chrome Custom vs Teardrop 310 comparison)
- [Creative Ways to Get More out of HX Stomp — Sweetwater InSync](https://www.sweetwater.com/insync/get-much-more-out-of-hx-stomp/) — HIGH confidence (Stomp block budget strategies; preamp trick)
- [HX Stomp vs Helix LT — Line 6 Community](https://line6.com/support/topic/63073-helix-vs-hx-stomp/) — HIGH confidence (DSP and block constraint comparison)
- Direct codebase inspection of `models.ts`, `param-engine.ts`, `chain-rules.ts`, `preset-builder.ts`, `stomp-builder.ts`, `podgo-builder.ts`, `device-family.ts`, `types.ts` (2026-03-06) — HIGH confidence (source of truth for all existing implementation gaps)

---

*Feature research for: HelixTones — Preset Quality Deep Dive (expression pedal, per-model intelligence, effect combinations, per-device craft)*
*Researched: 2026-03-06*
