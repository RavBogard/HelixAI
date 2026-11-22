# Tone craft for the Helix LT and POD Go

Working notes for turning "sounds like X" into a chain. These are starting
points drawn from how the gear is normally used and from Line 6's own factory
settings (`helixtone show <model>`). `rig/taste.md` overrides anything here
once a player has said what they like.

## From a description to a chain

1. Name the amp family first. Almost every guitar sound is one of a few:
   - Fender clean (Deluxe, Twin, Princeton): scooped mids, bright, lots of headroom.
   - Vox (AC30, AC15): chime, upper-mid bite, breaks up early and sweetly.
   - Marshall (Plexi, JTM45, 2203): mid-forward crunch that cleans up with the guitar's volume.
   - Modern high gain (Rectifier, 5150, Revv): tight low end, saturated.
   - Boutique clean/overdrive (Dumble-style, Matchless, Two-Rock).
   `helixtone search <maker or amp> -c amp` finds the model; the "based on" line is the map.
2. Use the cab that amp shipped with unless there is a reason not to
   (`show` prints Line 6's default cab for each amp).
3. Add only the pedals the sound needs, in the order the player used them.
4. Decide what the snapshots are for before setting values: usually a base
   sound, one or two variations, and a lead.

## Signal order

wah → compressor → fuzz/drive/boost → (vintage vibe or phaser) → amp → cab →
modulation → delay → reverb. Volume pedal first for a guitar-volume feel,
after the cab to fade tails.

Exceptions worth knowing: a Fuzz Face behaves best first in line, before the
wah if the two fight; a Uni-Vibe or Phase 90 in front of a cranked amp is the
60s/70s sound, after the cab is the cleaner modern one.

## Gain staging

- Set the amp's drive for the base sound with pedals off. Factory presets are
  a good reference for where a model's drive sits for clean, edge and crunch.
- A boost (Kinky Boost, Minotaur with gain low and level high, Scream 808 with
  drive low) pushes the amp harder without changing its character much.
- `Master` on non-master-volume amps (Plexi, AC30, tweed) is power-amp drive:
  it defaults high on those models for a reason. `ChVol` is the clean level
  trim and the right control for matching snapshot volumes.
- `Sag` up for a spongier, vintage feel; down for tighter attack. `Bias` and
  `BiasX` are fine left alone on a first draft.

## Cab and what it is played through

- Through full-range speakers (PA, studio monitors, a Powercab in flat mode,
  headphones): keep the cab block, high cut 8–10 kHz, low cut 80–100 Hz.
- Into a real guitar cab, or a Powercab using its own speaker models: no cab
  block, or the result is a cab on top of a cab. `rig/rig.md` says which
  applies; if it does not say, ask.
- Mic choice moves the top end more than most EQ: a 57 is bright and forward,
  a 121 ribbon is dark and smooth. `show` lists each cab's microphones by
  name, and a spec can use the name.

## Effects, by job

- **Compressor for clean funk or chime:** Red Squeeze (Dyna Comp) for an
  audible squeeze, Deluxe Comp for transparent levelling. Blend with `Mix`.
- **Envelope filter:** Mutant Filter (Mu-Tron III). `Peak` is how vocal it is,
  `Gain`/sensitivity must suit the guitar's output, so expect to adjust it for
  the player's pickups.
- **Delay:** Simple Delay for a clean repeat, Transistor Tape or Adriatic for
  a darker analog one, Vintage Digital for the 80s rack sound. Mix 0.2–0.35
  for rhythmic delays, lower for a thickener.
- **Reverb:** Plate or Room at mix 0.15–0.25 as glue; '63 Spring for Fender
  sounds; Plateaux or Glitz for shimmer and ambience. The big reverbs cost the
  most DSP, which matters most on the POD Go.

## POD Go specifics

- Ten slots: volume, wah, FX loop, amp, cab and EQ are always there, leaving
  **four** free effects. Choose the four that the sound cannot do without.
- One processor: check the DSP figure the build prints. A big reverb plus a
  heavy amp can use most of it.
- Four snapshots, six stomp switches (1–6), one expression pedal with a toe
  switch that swaps wah and volume.
- Mono up to the cab, stereo after it; each effect has one fixed width.

## Helix LT specifics

- Two processors, eight blocks each on the single path this tool builds. The
  builder moves to the second processor when the first is full.
- Eight snapshots. Stomp switches are numbered as on the unit: 2–5 top row and
  8–11 bottom row in the default layout (1 and 7 only in 10-switch mode).
- One built-in expression pedal with a toe switch (EXP 1 / EXP 2).
