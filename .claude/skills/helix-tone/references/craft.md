# Tone craft for the Helix LT and POD Go

How to turn "sounds like X" into a chain. Three kinds of statement are kept
apart here, and marked:

- **Measured**: rendered through Helix Native and measured
  (`research/measured.md`, rebuilt by `tools/check_claims.py`). These are
  facts about the models, on a synthetic test signal.
- **Practice**: what named players and Line 6's factory presets do
  (`research/*.md`, each claim with its source). Evidence of habit, not proof
  of better.
- **Disputed**: where good players do opposite things. Pick by the tone and
  the player; do not average them.

`rig/rig.md` says who plays what and how they use a preset. `rig/taste.md`,
once a player has said what they like, overrides anything here.

## Order of work

Practice (Sadites; Worship Tutorials; Sterlacci): amp, then cab, then mic and
its placement, then the amp's tone controls, then a small EQ, then effects,
then levels. Most of a tone is decided by the first three; an EQ is for the
last decibel or two, not for rescuing a wrong cab or mic.

1. **Amp family.** `helixtone search <maker or amp> -c amp`; the "based on"
   line is the map. `helixtone atlas gain` ranks every amp from cleanest to
   most saturated as measured, so "how much gain is this amp at this setting"
   is looked up, not guessed.
   - Fender clean (Deluxe, Twin, Princeton): scooped mids, bright, headroom.
   - Vox (AC30, AC15): chime, upper-mid bite, early sweet breakup.
   - Marshall (Plexi, JTM45, 2203): mid-forward crunch that cleans up with the
     guitar's volume.
   - Modern high gain (Rectifier, 5150, Revv): tight low end, saturated.
   - Boutique clean and overdrive (Dumble-style, Matchless, Two-Rock).
2. **Cab.** Start with the cab the amp shipped with (`show` prints it; Line
   6's factory presets use it 61% of the time). If there is a recording to aim
   at, `helixtone atlas nearest <wav>` ranks pairs by measurement.
3. **Mic and placement**, below.
4. Only the pedals the sound needs, in the order the player used them.
5. Snapshots and switches as the player uses them (see "Layout").

## Amp controls

- **Channel Volume is level and nothing else.** Measured: across 0.3 to 0.9
  on a clean and a driven amp the balance and crest factor did not change at
  all. It is the control for matching levels. It is not linear in dB and the
  curve differs per amp (0.9 to 0.7 was 4.8 dB on US Deluxe Nrm, 2.9 dB on
  Brit Plexi Brt), so set it by measuring, never by arithmetic.
- **Drive changes level as well as gain, hugely on a clean amp.** Measured:
  US Deluxe Nrm went up 17.5 dB from Drive 0.2 to 0.4 and another 7 dB by 0.8;
  an already saturated Brit Plexi Brt moved 3.4 dB and then stopped. So any
  snapshot that raises Drive must lower Channel Volume, and by an amount that
  has to be measured. Practice: Sterlacci calls raising gain without lowering
  Channel Volume the commonest mistake; Line 6's factory snapshots move Drive
  far more than Channel Volume and are not level-matched.
- **Master** on non-master-volume amps (Plexi, AC30, tweed) is power-amp
  drive and defaults high on those models. Practice: factory presets leave it
  at the model's default more often than not.
- **Sag, Bias, Bias X** matter most when the power amp is working. Measured on
  Brit Plexi Brt: sweeping each from 0 to 10 changed the balance by 1.7 to 2.5
  at Master 10 and by 0.5 to 1.0 at Master 3: less, not nothing. Practice:
  Sadites suggests Sag 7 to 8 and Bias 6 to 7 for real tones; most factory
  presets leave them alone. Fine at default on a first draft.
- **Hum and Ripple.** Measured: 0 and the default 0.5 render identically;
  only at 10 does a low hum line appear (about 15 dB up at 40 to 70 Hz).
  Leave them alone.

## Cab, mic and cuts

What the player listens through decides whether there is a cab block at all:
full-range speakers (PA, monitors, headphones, a Powercab in flat mode) need
one; a real guitar cab, or a Powercab using its own speaker models, must not
have one, or it is a cab on a cab. `rig/rig.md` says which; if it does not,
ask.

**Microphone** (measured on 4x12 Greenback 25, against the 57 Dynamic):

| mic | 300 Hz to 1 kHz | 1 to 2 kHz | 2 to 6 kHz | 6 to 12 kHz |
|---|---|---|---|---|
| 421 Dynamic | -1 dB | -1 | 0 | -1 |
| 67 Cond | 0 | -1 | -2 | -5 |
| 160 Ribbon | -1.5 | -3 | -4 | -6 |
| 121 Ribbon | -2 | -6 | -7 | -8 |
| 4038 Ribbon | -4 | -7 | -9 | -12 |

A ribbon is a much bigger darkening than any sensible high cut, and it takes
upper mids with it. Practice: Sadites prefers a ribbon (121 or 160); Cordy,
Sterlacci and Worship Tutorials pair a dynamic with a ribbon.

**Position** (measured, 57): 0 is the bright centre (+2.4 dB at 2 to 6 kHz
against the default 0.24); 0.5 is -3.5 dB there and -6 dB above 6 kHz; 1.0 is
-4 and -11. Moving the mic outward is the first cure for harshness, before
any cut. Practice: all of the players above keep the mic off the centre.

**Distance** (measured): pulling a 121 Ribbon back from 1 in to 6.5 in barely
changes the lows but brings 1 to 6 kHz up by about 4 dB, which is why Sadites
hears it as less muddy. A 57 gets about 1 dB brighter with distance.

**A dynamic and ribbon pair** (measured, 57 with a 121 on the same cab, as a
dual cab): about 2 dB more below 1 kHz with the top unchanged, and 1 dB
louder. It adds body without dulling. Disputed: Cordy, Sterlacci and Worship
Tutorials use the pair; Sadites has gone back to one cab with a shelf EQ. A
dual cab costs DSP the POD Go may not have.

**High cut.** The number means different things in different blocks.
Measured, both set to 5 kHz: the cab block is 3 dB down at 5 kHz and 13 dB
down an octave up; the Low and High Cut EQ block is 9 dB down at 5 kHz and 26
dB down an octave up. So forum advice of "3.5 to 5 kHz" (given for the cab
block) and Sadites's "8 to 12 kHz" (given for an EQ block) are closer than
they look. What each cab-block setting removes:

| cab High Cut | at 4 kHz | at 6.3 kHz | at 10 kHz | cost in loudness through an amp |
|---|---|---|---|---|
| 12 kHz | 0 dB | 0 | -1 | none |
| 8 kHz | 0 | -1 | -5.5 | none |
| 6.5 kHz | -0.5 | -2 | -9 | 0.2 dB |
| 5 kHz | -1 | -5 | -13 | 0.4 dB |
| 3 kHz | -6 | -12 | -22 | 1.8 dB |

Down to 5 kHz a cab-block cut removes fizz and leaves the presence region
alone. At 3 kHz it is cutting presence, not fizz: a deliberate dark tone
(Sterlacci uses it live to tame a bright guitar), not a default. Disputed:
Line 6's factory presets leave newer cabs open at 12 kHz or off; Worship
Tutorials cut at 5 to 6.5 kHz; forum consensus is 3.5 to 5 kHz.
**Default here: cab-block High Cut 6.5 to 8 kHz for full-range speakers,
lower only for a reason, and change mic and position before cutting further.**

**Low cut** (measured, cab block): 80 Hz is 3 dB down at 80; 100 Hz is 5 dB
down at 80 and 2 dB at 100; 120 Hz starts to thin the 100 to 125 Hz body by 3
to 4 dB. The cab block and the EQ block behave about the same here.
Practice: 80 to 100 Hz (Sadites), 80 to 120 Hz on every preset for live
(forum). **Default here: 80 to 100 Hz.**

## Drives and boosts

- A Tube Screamer in front of an amp tightens and pushes the mids. Measured
  into Brit Plexi Brt: 2 dB less at 60 to 150 Hz, 3 dB more at 600 to 1200 Hz,
  under 1 dB louder. On an amp that is already saturated, "boost" settings
  (Gain 0.15, Level 0.8) and Line 6's usual ones (Gain 0.5, Level 0.67)
  measured almost the same; the settings matter more on a cleaner amp.
- Practice: one drive ahead of the amp is the norm in Line 6's factory presets
  (61%), mostly Scream 808 or Minotaur. Low drive and high level is the usual
  advice for a boost.
- A Fuzz Face behaves best first in line; a Uni-Vibe or phaser in front of a
  cranked amp is the 60s and 70s sound, after the cab the cleaner modern one.

## Order of blocks

Practice (Line 6's factory presets, 204 of them): [wah] > [volume] > [drive] >
[compressor] > amp > cab > [modulation] > delay > reverb, with reverb last in
58%. Disputed: where delay and reverb go. Inline after the cab (Worship
Tutorials, factory presets), between amp and cab (Cordy), or on a parallel
path so the dry attack is untouched (Sterlacci). Inline after the cab is the
default here; the others are deliberate choices.

## Effects

- **Compressor.** Disputed: none (Sterlacci), light and optional (Cordy),
  always on at 4:1 and about 80% mix (Worship Tutorials); Sadites puts an LA
  Studio Comp last as glue and a front compressor on cleans only. See "Levels"
  for the one case where measurement argues for it.
- **Delay.** Practice: mix 20 to 25% live (Sadites: more stops the tone
  cutting through); Line 6's factory median is higher, 37%. Simple Delay for
  a clean repeat, Transistor Tape or Adriatic for a darker one, Vintage
  Digital for the 80s rack sound.
- **Reverb.** Practice: mix 25 to 30% at most live, and 5 to 15 ms of
  pre-delay helps notes stay in front (Sadites). Plate or Room as glue; '63
  Spring for Fender sounds; Plateaux or Glitz for ambience. The big reverbs
  cost the most DSP, which matters most on the POD Go.
- **Trails on** for every delay and reverb, so tails carry across a snapshot
  change (Line 6 manuals).
- **Shelf EQ after the cab.** Practice (Sadites, on nearly every preset):
  Low/High Shelf with both corners at 650 Hz, low shelf -1 to -3 dB, high
  shelf about +1 dB.
- **Envelope filter:** Mutant Filter. `Gain` must suit the guitar's output, so
  expect to adjust it for the player's pickups.

## Levels

- Match snapshots with Channel Volume, by measurement:
  `helixtone tune level <spec> --write`. Practice: every source that
  describes a method does this (Sadites to within 0.5 dB of loudness;
  Sterlacci to about -12 dB on a peak meter). Never with Drive or Master.
- **A clean snapshot matched in loudness to a driven one has far taller
  peaks.** Measured: a clean US Deluxe Nrm has a crest factor of 23 dB against
  11.5 dB for a high-gain lead; brought to the same loudness its peaks are 10
  dB higher. A Deluxe Comp at 4:1 in front took 3.4 dB off that. So after
  levelling, check the clean snapshots' peaks: if they are near clipping or
  far above the driven ones, add light compression on the cleans only
  (Sadites's method), then level again.
- A lead is usually 2 to 4 dB above rhythm (most sources; one calls 6 too
  much). `--offset "<name>=3"`. The player decides; `rig/rig.md` records it.
- Presets should also match each other, so nothing jumps between songs. Level
  each one's first snapshot to the same loudness.

## Layout

`rig/rig.md` records how each player uses a preset; follow it. In general:

- Snapshots are whole sounds (clean, crunch, drive, lead); stomps are single
  effects to switch while playing. Keep the same order and the same switch
  for the same job in every preset, so feet do not have to learn each one.
- By default a snapshot recalls every block's on or off state, so a stomp the
  player switched by hand is overridden on the next snapshot change.
- Wah on EXP 1 and volume on EXP 2 with the toe switch swapping them, as
  Line 6's factory presets do.

## POD Go specifics

- Ten slots: volume, wah, FX loop, amp, cab and EQ are always there, leaving
  **four** free effects. Choose the four the sound cannot do without.
- One processor: check the DSP figure the build prints. A big reverb plus a
  heavy amp can use most of it; a dual cab may not fit.
- Four snapshots, six stomp switches (1 to 6), one expression pedal with a
  toe switch that swaps wah and volume.
- Mono up to the cab, stereo after it; each effect has one fixed width.

## Helix LT specifics

- Two processors, eight blocks each on the single path this tool builds. The
  builder moves to the second processor when the first is full.
- Eight snapshots. Stomp switches are numbered as on the unit: 2 to 5 top row
  and 8 to 11 bottom row in the default layout (1 and 7 only in 10-switch
  mode).
- One built-in expression pedal with a toe switch (EXP 1 / EXP 2).

## What none of this covers

Everything measured here is balance, dynamics and level on a synthetic
signal through Helix Native. It says nothing about feel under the fingers,
how an amp cleans up with the guitar's volume, or how a tone sits at stage
volume through the Powercab. Tones dialled quietly are reported by every
source to sound harsh and boomy loud; that needs the player's ears.
