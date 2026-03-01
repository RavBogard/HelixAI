# Feature Research

**Domain:** AI-powered Helix preset generation
**Researched:** 2026-03-01
**Confidence:** HIGH (core preset quality features verified via Line 6 official sources, community consensus, and multiple independent sources)

---

## Feature Landscape

### Table Stakes (Users Expect These — Missing = Presets Sound Bad)

These are not optional enhancements. A preset without these features will sound mediocre, muddy, or lifeless regardless of how good the amp model selection is.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Cab block low cut (80–100 Hz)** | Removes sub-rumble that makes tone boom and mud in a mix | Low | 6 dB/oct slope at cab block; the cab block slope is gentler than an EQ block so frequency must be set higher to achieve same cut |
| **Cab block high cut (5–8 kHz)** | Removes digital fizz above what a real guitar cab can reproduce; real cabs rarely exceed 5 kHz meaningfully | Low | Critical — this is the #1 cause of "digital-sounding" presets; the Sweetwater/Line 6 official recommendation is to always set this |
| **Post-amp/cab EQ block** | Cab block EQ is only 6 dB/oct and cannot surgically remove mud or harshness; a dedicated EQ block after the cab provides 12 dB/oct slopes and precise frequency control | Medium | Place a Parametric EQ or 10-band EQ as the last block before time-based effects |
| **Anti-mud EQ cut (~300–500 Hz)** | The 300–500 Hz range accumulates boxiness and muddiness from gain stages; a -3 to -5 dB cut here opens the midrange | Low | This is a post-cab EQ move, not an amp EQ move |
| **Noise gate (always-on)** | High-gain presets produce hum and hiss; gate prevents dead-air noise between notes | Low | Use input block's built-in gate first (saves a block); add Horizon Gate after amp for hiss |
| **Proper amp category defaults** | Clean, crunch, and high-gain amps require different power-amp parameter starting points; using one-size-fits-all defaults sounds wrong | High | See Amp Parameter Defaults section below |
| **Correct amp+cab pairing** | Amp models are voiced expecting specific cab types; mismatching (e.g., a Fender-voiced amp with a Marshall 4x12) produces tonally incoherent results | Medium | Use amp-matched cab defaults unless genre/style specifically justifies departure |
| **Mic selection per tone category** | Dynamic mics (57 Dynamic) cut through better for distorted tones; ribbon mics (121 Ribbon) are smoother for cleans; wrong mic makes a great cab model sound wrong | Medium | SM57 equivalent as primary for crunch/high-gain; 121 Ribbon for clean and jazz tones |
| **Level-balanced signal chain** | Blocks that add gain (overdrives, compressors) must not create volume discontinuities; Channel Volume on amp is primary leveling tool | Medium | Channel Volume is a flat-response post-amp fader — use this, not Drive, for volume matching |
| **Correctly ordered blocks** | Time-based effects (delay, reverb) must come after the amp+cab; modulation after amp; boost/overdrive before amp — misordering creates phase issues and wrong sonic character | Low | Standard order: input → boost → amp+cab → gate → modulation → delay → reverb → EQ → output |
| **Downloadable .hlx file** | The entire value proposition — must produce a file the Helix LT/Floor accepts without errors | High | File must exactly match HX Edit export format (JSON structure, block types, parameter names) |

---

### Differentiators (Competitive Advantage — What Makes Presets World-Class)

These features separate an AI preset tool from a mediocre one. ToneBuilder.ai (the primary competitor) explicitly does NOT support parallel paths, snapshots, or Agoura amps — this is the gap to exploit.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Always-on transparent boost block** | Minotaur (Klon) or Scream 808 placed always-on before the amp adds compression, mid push, and amp-front saturation — mirrors what pro players run permanently on their boards; 71% of professional high-gain presets use an 808 boost | Medium | This is a professional secret encoded as a structural rule, not just an option |
| **Amp-category-specific parameter tuning** | AI must set SAG, Bias, Master Volume, and Drive differently for clean vs. crunch vs. high-gain — wrong defaults for the category are the #1 cause of mediocre AI-generated presets | High | See detailed Amp Parameter Defaults section |
| **Snapshot-based scene design** | 8 snapshots (Clean/Crunch/Lead/Ambient minimum) with per-snapshot block states, volume-balanced via Channel Volume — users get a performance-ready rig, not a single tone | High | ToneBuilder.ai has no snapshot support; this is a major gap in the competitor |
| **Volume-balanced snapshots** | Each snapshot must play at equivalent perceived loudness; lead snapshot gets +2–3 dB boost via Volume block assigned to snapshot; clean snapshot Channel Volume adjusted to reference loudness | High | Without this, switching snapshots causes jarring volume jumps that ruin live use |
| **Delay trails enabled per snapshot** | Reverb and delay tails continue to sound when switching snapshots; this requires Trails mode on delay/reverb blocks — without it, switching causes abrupt cutoffs | Low | A structural decision that must be encoded into the preset builder |
| **Post-cab presence recovery** | Cab high cut reduces fizz but also removes air and sparkle; a Simple EQ after the cab with +0.5–1.5 dB of High Gain restores brightness without restoring fizz | Low | This is the technique used by Jason Sadites and other professional template builders |
| **Artist/song rig research grounding** | AI should identify the actual gear an artist used (amp model, pedal chain, cab) and map it to Helix model equivalents — not just pick a vaguely genre-appropriate amp | High | The existing Google Search grounding capability supports this; the generation prompt must know how to use the research |
| **Pickup-aware tone calibration** | Single-coil pickups are brighter and thinner than humbuckers; the preset should apply different EQ defaults depending on pickup type declared in the interview | Medium | Many professional preset libraries (Alex Price, Jason Sadites) ship separate versions for single-coil vs. humbucker |
| **Genre-specific signal chain intelligence** | Metal presets use 808 + tight-SAG amp + post-cab presence cut; clean/jazz presets use ribbon mic + high SAG + minimal gate; ambient presets use high-mix reverb + shimmer + long delay trails — these are different structural templates, not parameter tweaks | High | The generation system must select from intelligent templates, not generate from scratch each time |
| **Dual cab / dual mic blending** | Professional studio tone blends an SM57 (attack/cut) with a 121 Ribbon (body/warmth) on the same cab — the Helix supports this in a single Cab > Dual block; this alone transforms the cab sound from good to great | Medium | Start with 60-70% SM57, 30-40% 121; adjust Mic Distance parameter per cab model |
| **Stomp mode footswitch layout** | Beyond snapshots, the preset should include logical footswitch assignments (boost on, delay on/off, reverb on/off) so the preset is immediately usable without manual HX Edit setup | Medium | This exists in the .hlx format's controller assignments section |
| **Interview depth — specific tone descriptors** | Collect: artist, song, genre, pickup type, guitar type, use case (live/studio/bedroom), tone adjectives (bright, warm, gainy, scooped, mid-forward) — each answer constrains the template selection and parameter decisions | Medium | Existing app collects some of this; the generation must actually use all of it |

---

### Anti-Features (Commonly Requested, Often Problematic — Do NOT Build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Impulse Response (IR) loading** | IRs require user to manage IR files, load them into the Helix, and match slot numbers — this breaks the "download and play" experience; stock Helix cabs are genuinely excellent when properly filtered | Use stock Helix cab models with proper low/high cut settings and dual-mic blending |
| **Maximum gain / extreme saturation by default** | More gain does not equal better tone; high gain reduces dynamics, buries pick attack, and increases noise; the professional approach uses conservative drive (3–5) and boosts with a tubescreamer-style pedal | Cap drive recommendations at 6; note this explicitly in generation prompt guidance |
| **Too many effects blocks** | DSP limits (32 blocks max, split across two DSPs) mean complex presets run out of headroom; more importantly, cluttered presets are harder to play and modify | Encode a "minimum effective preset" philosophy: amp+cab+gate+boost+EQ+1-2 time effects is enough |
| **Parallel dual-amp paths as default** | Dual-amp paths consume nearly double the DSP; parallel paths only add value when used for specific purposes (A/B clean+dirty blend, multiband split); wrong as a default template | Use serial single-path as default; offer dual-path only for specific genre/style patterns that justify it |
| **Global EQ as a substitute for preset EQ** | Global EQ affects all presets and is designed for room compensation, not tone shaping; using it to fix a preset's tone means every other preset sounds wrong | Apply all tone shaping in the preset itself via cab block EQ and post-cab EQ block |
| **User accounts and preset saving** | Adds authentication complexity, backend infrastructure, and scope creep; the core value is generation quality, not a library manager | Keep it stateless: generate, download, done |
| **Preset rating/feedback loop** | AI quality improvement via user ratings requires significant infrastructure (data pipeline, retraining) that is out of scope for this rebuild | Focus on getting the generation right from research/expertise, not from user data |
| **HX Stomp / POD Go support** | Different hardware has different DSP constraints, block limits, and .hlx sub-formats; supporting them dilutes focus and increases QA surface area massively | Explicitly support Helix LT and Helix Floor only; these share the same .hlx format |
| **Multi-provider comparison UI** | Showing three different AI-generated presets side-by-side dilutes focus; the goal is one world-class preset per request, not three mediocre options | Pick the best single AI provider and generate one excellent preset |
| **MIDI configuration blocks** | MIDI routing is hardware-specific, use-case specific, and technically complex; getting it wrong silently breaks live rigs | Exclude Command Center MIDI assignments from generation scope |

---

## Preset Quality Deep Dive

This section contains the technical expertise that must be encoded into the preset generation engine. These are not suggestions — they are rules derived from professional Helix preset builder consensus.

### 1. Cab Block Filtering — The Single Biggest Quality Lever

A real guitar cabinet reproduced through a microphone has a natural frequency ceiling. The Shure SM57 on a guitar cab captures aggressively up to about 8–10 kHz but begins rolling off rapidly; ribbon microphones roll off even earlier. A simulated cab without filtering produces all the high-frequency content that a real cab + mic would suppress — this is the primary cause of "digital fizz" and "harsh/brittle" AI presets.

**Required settings per cab block:**

- **Low Cut (High-Pass Filter):** 80–100 Hz at 6 dB/oct. Removes sub-bass rumble that muddies the low end and clashes with bass guitar. For single-coil pickups, 80 Hz is appropriate. For humbuckers playing heavy genres, consider 100–120 Hz.
- **High Cut (Low-Pass Filter):** 5–8 kHz at 6 dB/oct. This is the most critical setting. 5 kHz is conservative and warm (ribbon mic character); 7–8 kHz is neutral and present (SM57 character). Never exceed 10 kHz in the cab block.

**Note on slope difference:** The cab block filters are 6 dB/oct (gentle). An EQ block's cut filters are 12 dB/oct (steeper). A 12 kHz cut on an EQ block sounds like a 5.8–6 kHz cut on the cab block. The generation engine must account for this when calculating equivalent settings across block types.

**After the high cut — presence recovery:**

Pulling down the high cut can make the tone sound dull. The professional fix is a post-cab EQ block with a High Shelf boost of +0.5 to +1.5 dB centered at 6–8 kHz. This restores air and sparkle without restoring the fizz that was cut. This technique is used explicitly in Jason Sadites's professional preset templates.

### 2. Amp Parameter Defaults by Category

The Tonevault.io analysis of 250 professional Helix presets reveals clear consensus on power-amp parameters by amp type and gain category. These are empirically derived defaults, not guesses.

**Clean Tones (Fender-type, Jazz Rivet / Twin Reverb equivalents):**

- Drive: 2–3 (let the amp stay clean; boost is added separately)
- Master Volume: 9–10 (94% of Jazz Rivet presets max master; fully engages power amp warmth and sag)
- SAG: 5–7 (moderate sag gives dynamic bloom on clean chords)
- Bias: 5–6 (warm, Class AB character)
- Bass: 5–6, Mid: 5, Treble: 5–6 (neutral starting point)
- Mic: 121 Ribbon (warm, smooth, body-forward character)
- Cab High Cut: 6–7 kHz (preserve some sparkle for clean tones)

**Crunch Tones (Brit Plexi / Vox-type / Marshall equivalents):**

- Drive: 4–6 (preamp drive is moderate; boost pedal provides saturation on-demand)
- Master Volume: 5–7 (mid-range power amp engagement; balance of clean power-amp dynamics and saturation)
- SAG: 4–5 (moderate; not as tight as metal, not as spongy as vintage clean)
- Bias: 6–7 (hotter bias for more harmonic saturation)
- Bass: 4–5 (slightly leaner to avoid mud with added gain), Mid: 5–6, Treble: 5–6
- Always-on boost: Minotaur (Klon) or Heir Apparent — adds compression and mid push
- Mic: Blend of 57 Dynamic (60%) + 121 Ribbon (40%) — attack with warmth

**High-Gain Tones (5150/Rectifier/Soldano-type):**

- Drive: 3–5 on the amp itself (NOT 8–10; overdrive pedal provides the saturation push)
- The Tonevault analysis confirms: "Drive stays below 4 in more than half of Panama [5150] presets"
- Master Volume: 3–6 (tighter, more focused power amp; high master on high-gain amps over-saturates and loses definition)
- SAG: 2–3 (tight, punchy — essential for palm-muted riff clarity and djent-style articulation)
- Bias: 7–8 (hotter bias for full saturation character; also mitigates crossover distortion artifacts)
- Bass: 3–4 (tight low end to prevent mud with high gain), Mid: varies by topology (see below), Treble: 5–6
- Always-on boost: Scream 808 with Drive minimal, Tone 5, Level 5–7 (tightens low-end, pushes mids into amp)
- Mic: 57 Dynamic (primary) — cuts through distorted mix
- Cab High Cut: 5–6 kHz (more aggressive cut needed to tame high-gain fizz)

**Critical insight from Tonevault analysis — amp topology determines EQ strategy:**

The Cali Rectifire (Rectifier) uses a cathode-follower tone stack that scoops mids cleanly at higher gain. The PV Panama (5150) uses a plate-fed tone stack that preserves mids even at high drive. Applying the same mid settings to both produces wrong results — the generation engine must know which topology an amp model uses.

- Cathode-follower amps (Cali Rectifire, Cali IV Lead): At high gain, mids correlate negatively with Drive. Scoop the mids (4–5) and let the topology do the work.
- Plate-fed amps (PV Panama, Line 6 Fatality): At high gain, mids correlate positively with Drive. Keep mids at 5–6 and don't scoop aggressively.

### 3. The Always-On Boost Architecture

Professional Helix presets almost universally include a transparent boost or drive block placed before the amp, set to always-on (no footswitch). This mirrors real-world practice — many professional guitarists run an EP Booster, Klon Centaur, or Tubescreamer permanently in their chain as a "foundation pedal."

The function is not to add distortion — it is to:
1. Compress the signal slightly before the amp input
2. Push the mid frequencies, which makes the amp respond differently
3. Provide a more consistent guitar-level input to the amp across different playing dynamics

**Recommended always-on boost implementations:**

- **For clean tones:** Minotaur with Drive at 0, Tone at 5, Output at 7 (clean boost, adds subtle compression)
- **For crunch tones:** Minotaur with Drive at 2–3, Tone at 5, Output at 6 (mid push + slight saturation)
- **For high-gain tones:** Scream 808 with Drive at 1–2, Tone at 5, Level at 5–7 (low-end tightening + mid cut at amp input = tighter, more defined high gain)

### 4. Post-Cab EQ Sculpting for Mix-Ready Tone

After the cab block (with its filtering), a dedicated EQ block is required for surgical mix-readiness. The recommended EQ placement is immediately after the cab block, before time-based effects.

**Frequency targets by issue:**

| Problem | Frequency Range | Action | Amount |
|---------|----------------|--------|--------|
| Boxy/closed-in | 300–500 Hz | Cut | -3 to -5 dB |
| Muddy low-mid | 200–300 Hz | Cut | -2 to -4 dB |
| Harsh/ice-pick | 3–5 kHz (sweepable) | Narrow cut | -3 to -6 dB |
| Lacks presence | 2–3 kHz | Boost | +2 to +4 dB |
| Too dull after high cut | 6–8 kHz shelf | Boost | +0.5 to +1.5 dB |
| Fizzy despite high cut | 8–10 kHz | Cut | -3 to -5 dB |

The generation engine must make EQ decisions based on: gain category (more cuts needed for high-gain), genre (metal requires more aggressive mud and fizz control), and amp topology (Rectifier-style amps need different mid treatment than Fender-style amps).

### 5. Snapshot Design — Four Core Scenes

Professional preset design uses 8 available snapshots. The standard four-scene template that the generation engine should implement:

| Snapshot | Name | Function | Key Parameter Changes |
|----------|------|----------|----------------------|
| 1 | Clean | Clean tone, rhythm | Base Channel Volume, gate off or low threshold, reverb high mix, delay off |
| 2 | Rhythm | Crunch/drive rhythm | Boost on (always-on), overdrive block on, lower reverb mix, gate medium threshold |
| 3 | Lead | Lead/solo tone | +2 to +3 dB via Volume block, delay on (dotted-eighth or quarter), reverb medium mix, presence boost |
| 4 | Ambient | Swell/ambient texture | High reverb mix (40–60%), shimmer or octave reverb on, delay long with high feedback, volume swell |
| 5–8 | Variations | Extended control | Genre/artist specific — e.g., heavy rhythm, clean+delay, octave lead, full wet |

**Volume-matching rule:** The perceived loudness of Snapshot 1 (Clean) is the reference. All other snapshots must match or intentionally exceed this reference. Channel Volume on the amp block is the primary leveling tool. Snapshot 3 (Lead) intentionally adds +2 to +3 dB for solo presence. Each snapshot's Channel Volume value must be explicitly set during generation.

**Trails rule:** Reverb and Delay blocks should have Trails mode enabled by default. This prevents abrupt audio cutoffs when switching between snapshots mid-song.

### 6. Signal Chain Block Order

Professional chain order (serial/single-path, which should be the default template):

```
Guitar Input (with built-in noise gate enabled)
  → Tuner (always present, mutes signal when active)
  → Compressor (optional, before boost for clean tones)
  → Always-On Boost/Drive (Minotaur or Scream 808)
  → Switchable Overdrive (for gain increase in Rhythm/Lead snapshots)
  → Amp + Cab block (paired correctly; dual-mic configured)
  → Horizon Gate (post-amp, catches amp hiss — especially for high-gain)
  → Modulation (chorus, flanger, vibrato — if applicable)
  → Post-Cab EQ (always present; surgical sculpting)
  → Delay (with Trails enabled)
  → Reverb (with Trails enabled)
  → Volume Block (for lead boost, snapshot-controlled)
  → Output
```

Blocks must be placed in the correct DSP path to avoid DSP ceiling issues. Amp+Cab is the most DSP-intensive block. Keep the total block count to 8–12 for a single-path preset (leaves headroom for complex DSP blocks like pitch shifters or modulation).

### 7. Dynamic Responsiveness — Volume Knob Cleanup

A "dynamic" preset is one where rolling back the guitar's volume knob from 10 to 7 transitions from saturated to clean naturally, the way a real tube amp does. Achieving this in the Helix requires specific parameter choices:

- **Lower amp Drive, higher Master Volume:** Preamp distortion (Drive) does not clean up with volume roll-off; power amp saturation (Master Volume) responds more naturally to input level changes
- **Tubescreamer-style boost at amp input:** An 808 or Heir Apparent before the amp means rolling back guitar volume removes the boost's effect on the amp input, allowing the amp to clean up
- **Avoid compressors with high ratio on clean tones:** Heavy compression reduces the dynamic range that enables volume-knob cleanup; use compressors only when the effect is intentional (country, funk)
- **SAG setting matters:** Higher SAG (6–8) creates more voltage-sag-style compression that feels more dynamic and amp-like; lower SAG (2–3) is tighter but feels less musical in the volume-knob-cleanup context

### 8. Mic Position and Distance

The Helix cab model includes Mic Position and Mic Distance parameters that significantly affect tone. Default positions are not always optimal.

**Mic Position (for SM57 / 57 Dynamic):**
- Cap Edge: brighter, more presence, less bass — good for mix-cutting high-gain tones
- Cap Center: more midrange and low-mid content — good for crunch and classic rock
- Between edge and center is most versatile

**Mic Distance:**
- Close (0–2"): Tight, direct, punchy — "proximity effect" adds low-mid
- Far (4–6"): More room character, airier, less midrange emphasis
- Professional presets use close position (1–2") as default for live/direct tones

---

## Feature Dependencies

```
Downloadable .hlx File (core capability)
├── Correct .hlx JSON structure
├── Valid block types and parameter names
└── Proper DSP path routing

Cab Filtering (low cut + high cut)
└── Required before Post-Cab EQ can function correctly

Post-Cab EQ Block
├── Depends on: Cab Filtering (to know what remains to sculpt)
└── Depends on: Amp Category (different EQ targets per category)

Always-On Boost Block
└── Depends on: Amp Category Selection (boost type varies by category)

Amp Parameter Defaults
└── Depends on: Amp Category (clean/crunch/high-gain)
    └── Depends on: Amp Topology (cathode-follower vs. plate-fed)

Snapshot Design
├── Depends on: Volume-Balanced Gain Staging (must set Channel Volume per snapshot)
├── Depends on: Correct Block State per Snapshot (boost on/off, overdrive on/off)
└── Depends on: Trails Mode enabled on Delay and Reverb blocks

Volume-Balanced Snapshots
├── Depends on: Channel Volume as primary tool (not Drive or Output)
└── Depends on: Lead Volume Block (snapshot-controlled +2 to +3 dB)

Dynamic Responsiveness
├── Depends on: Low Drive + High Master Volume ratio
├── Depends on: Always-On Boost Architecture
└── Depends on: SAG parameter (higher SAG = more amp-like cleanup)

Artist/Song Grounding
└── Depends on: Google Search grounding (existing capability)
    └── Feeds into: Amp model selection, boost selection, cab selection

Pickup-Aware Calibration
└── Depends on: Interview collecting pickup type (single-coil vs. humbucker)
    └── Feeds into: Cab Low Cut target, EQ brightness adjustments
```

---

## MVP Definition

### Launch With (Required for "World-Class" Claim)

1. **Cab block filtering** — Low cut 80–100 Hz, High Cut 5–8 kHz with post-cab presence recovery (+0.5–1.5 dB high shelf). This alone removes the "digital/muddy" character from the existing presets. **HIGH impact, LOW complexity.**

2. **Amp-category-specific parameter defaults** — A lookup table / template system for clean, crunch, and high-gain amps with correct Drive, Master, SAG, Bias, and Bias X starting points. Encode the Tonevault consensus findings. **HIGH impact, HIGH complexity.**

3. **Always-on boost architecture** — Minotaur for clean/crunch; Scream 808 for high-gain. Always in the chain, always on, before the amp. **HIGH impact, LOW complexity.**

4. **Post-cab EQ block** — A Parametric EQ block after the cab with genre/category-appropriate cut points (mud at 300–500 Hz, harshness at 3–5 kHz). **HIGH impact, MEDIUM complexity.**

5. **Correct signal chain block order** — Encode the canonical order as a structural rule, not a suggestion. The generation engine should not allow gain stages after amp, time-based effects before amp, etc. **HIGH impact, MEDIUM complexity.**

6. **Noise gate** — Input block gate enabled; Horizon Gate after amp for high-gain. **MEDIUM impact, LOW complexity.**

7. **Mic selection by category** — 121 Ribbon for clean, 57 Dynamic for distorted, blended for crunch. **MEDIUM impact, LOW complexity.**

8. **4-snapshot minimum** — Clean, Rhythm, Lead, Ambient with volume-balanced Channel Volume per snapshot and Trails enabled. **HIGH impact, HIGH complexity.**

### Defer to Later Milestones

- **Pickup-aware calibration** — Requires the interview to ask the question and the generation to use it; medium complexity, medium impact. Can be added as a v2 interview question.

- **Dual cab / dual mic blending** — Cab > Dual block is valuable but requires more precise parameter knowledge. Add after core tone quality is validated on hardware.

- **Stomp mode footswitch layout** — The Command Center assignments are complex .hlx JSON sections. Encode this after snapshot design is validated.

- **Snapshots 5–8 (extended scenes)** — Getting the core 4 snapshots right first. The additional 4 are genre-specific variations that require more template work.

- **Amp topology database** — The cathode-follower vs. plate-fed distinction requires tagging every amp model in the Helix database. Do this incrementally as the most common amps are added first.

- **Genre-specific signal chain templates** — Metal vs. clean jazz vs. ambient have structurally different chain layouts. Build the core template first, then specialize.

---

## Sources

- [Tonevault.io — Dialing in your Helix amps: what the top 250 presets teach us](https://www.tonevault.io/blog/250-helix-amps-analyzed) — MEDIUM confidence (analysis article, not official, but methodology is transparent and findings align with community consensus)
- [Line 6 Community — Lo Cut & Hi Cut filters in HX Stomp](https://line6.com/support/topic/56578-lo-cut-hi-cut-filters-in-hx-stomp/) — HIGH confidence (Line 6 official forum; engineer responses confirming 6 dB/oct slope on cab blocks)
- [Line 6 Community — High and Low Cut, where to adjust it?](https://line6.com/support/topic/61603-high-and-low-cut-where-to-adjust-it/) — HIGH confidence (official forum)
- [Sweetwater InSync — Double Down for the Best Line 6 Helix Tone](https://www.sweetwater.com/insync/double-best-line-6-helix-tone/) — HIGH confidence (Sweetwater editorial, industry-standard retailer)
- [Sweetwater InSync — Understanding Helix Amp Parameters](https://www.sweetwater.com/insync/understanding-helix-amp-parameters/) — HIGH confidence
- [Komposition101 — Volume Matching Presets on Line 6 Helix](https://www.komposition101.com/blog/volume-matching-presets-on-line6-helix) — MEDIUM confidence (independent Helix community resource; findings consistent with Line 6 official documentation)
- [Komposition101 — Mastering Amp Parameters in Line6 Products](https://www.komposition101.com/blog/mastering-amp-parameters-on-line6-helix) — MEDIUM confidence
- [Helix Help — Common Amp Settings](https://helixhelp.com/tips-and-guides/universal/common-amp-settings) — HIGH confidence (community reference guide, widely cited in official Line 6 forums)
- [Line 6 Blog — Joe Gore: The Secret Power of Helix Snapshots](https://blog.line6.com/2019/12/04/joe-gore-the-secret-power-of-snapshots/) — HIGH confidence (official Line 6 blog, authored by professional recording engineer)
- [Helix Help — Snapshots](https://helixhelp.com/tips-and-guides/helix/snapshots) — HIGH confidence
- [Line 6 Community — Gain staging facilitation](https://line6.com/support/topic/60518-gain-staging-facilitation/) — HIGH confidence (official forum)
- [Line 6 Community — High gain staging](https://line6.com/support/topic/33117-high-gain-staging/) — HIGH confidence
- [Line 6 Community — Noise Gate](https://line6.com/support/topic/64496-noise-gate/) — HIGH confidence
- [BenVesco — Line 6 Helix Tips And Tricks-Noise Gate Without A Block](https://www.benvesco.com/blog/line-6-pod/2016/line-6-helix-tips-and-tricks-noise-gate-without-a-block/) — MEDIUM confidence
- [Helix Help — The Blocks](https://helixhelp.com/tips-and-guides/helix/the-blocks) — HIGH confidence
- [ToneBuilder.ai](https://www.tonebuilder.ai/) — Competitor analysis; confirmed lacks snapshots, parallel paths, and Agoura amps — HIGH confidence (direct product inspection)
- [Line 6 Community — Kinky Boost always on?](https://line6.com/support/topic/37754-kinky-boost-always-on/) — MEDIUM confidence (community discussion)
- [DShowMusic — Line 6 Helix Microphone Models](https://dshowmusic.com/line-6-helix-microphone-models/) — HIGH confidence (official model documentation)
- [BenVesco — Helix DSP Allocations](https://benvesco.com/store/helix-dsp-allocations/) — MEDIUM confidence (community reference; consistent with official documentation)
- [Line 6 Community — limits](https://line6.com/support/topic/66543-limits/) — HIGH confidence (official forum)
- [Nail The Mix — EQing Modern Metal Guitars](https://www.nailthemix.com/low-mean-eqing-modern-metal-guitars-for-max-impact) — MEDIUM confidence (professional mixing community)
- [Neural DSP — Electric guitar EQ guide](https://neuraldsp.com/articles/electric-guitar-eq-guide) — MEDIUM confidence (manufacturer editorial; findings broadly consistent)
- [Line 6 Manuals — Signal Path Routing](https://manuals.line6.com/en/helix-stadium/live/signal-path-routing) — HIGH confidence (official Line 6 documentation)
- [The Gear Page — Helix EQ Settings for Guitar to Stand Out](https://line6.com/support/topic/45791-helix-eq-settings-for-guitar-to-stand-out/) — MEDIUM confidence (community forum; multiple experienced users in agreement)
