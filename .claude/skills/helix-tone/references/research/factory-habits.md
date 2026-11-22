# What Line 6's factory presets do

Source: the three setlists that ship with Helix Native, read only
(`C:\ProgramData\Line 6\Helix Native\res\factory1.hls`, `factory2.hls`,
`templates.hls`). Tool: `python tools/mine_presets.py <file or folder>...`
(rerun it on any folder of `.hls`/`.hlx`). All figures come from that script's
output; I checked a few against `helixtone inspect` (see the end).

These are evidence of one maker's habits, not a standard. "Line 6's factory
presets do X" never means "X is best".

## What was counted

- `factory1` + `factory2`: 256 slots. 20 were byte-identical duplicates
  (empty or repeated slots) and were dropped. 4 empty slots, 1 effects-only
  preset, 23 bass presets (name starts `BAS:` or contains "Bass", Line 6's own
  labelling) and 4 more with only bass-model amps were skipped.
  **204 presets with a guitar amp** are behind every table below.
- `templates.hls` (routing demos, 128 slots, 87 duplicates, 21 empty, 7
  effects-only) gives only 13 guitar-amp presets. It is kept out of the tables
  and used only for a note in section 8.
- Every preset here was saved by Helix Native 3.79 as a Helix LT-type preset.
- Blocks are counted whether on or off when the preset loads. Many factory
  presets carry blocks that are off at load and are turned on by snapshot or
  footswitch, so "on at load" is shown where it matters.
- Knob values are file values, 0 to 1. A value the file omits is the model's
  default. "Moved" means more than 0.5% of the control's range from the default.

## 1. Amps

Most used amps (presets of 204): Jazz Rivet 120 17, US Double Nrm 13, Revv Gen
Red 11, Brit Plexi Brt 10, US Deluxe Nrm 8, Cali Rectifire 8, US Princess 7,
A30 Fawn Brt 7, Archetype Clean 6, Line 6 Badonk 6, Brit 2204 6. 172 presets
have one amp block, 30 have two, 2 have three. No amp is in more than 8%.

| control | amp blocks | moved off default | all blocks: median (q1-q3) | when moved: median (q1-q3) | when moved: shift from default |
|---|---|---|---|---|---|
| Drive | 210 | 187 (89%) | 0.50 (0.36-0.62) | 0.50 (0.36-0.64) | +0.01 (-0.13 to +0.13) |
| Bass | 227 | 182 (80%) | 0.50 (0.42-0.62) | 0.50 (0.40-0.61) | -0.01 (-0.14 to +0.15) |
| Mid | 197 | 160 (81%) | 0.51 (0.46-0.63) | 0.50 (0.46-0.62) | -0.02 (-0.11 to +0.06) |
| Treble | 227 | 197 (87%) | 0.57 (0.50-0.68) | 0.58 (0.50-0.68) | +0.04 (-0.10 to +0.14) |
| Presence | 227 | 182 (80%) | 0.47 (0.27-0.60) | 0.50 (0.34-0.61) | +0.13 (-0.05 to +0.30) |
| ChVol | 236 | 224 (95%) | 0.77 (0.63-0.90) | 0.76 (0.63-0.90) | +0.03 (-0.10 to +0.13) |
| Master | 235 | 111 (47%) | 0.88 (0.52-1.00) | 0.60 (0.50-0.81) | -0.05 (-0.18 to +0.07) |
| Sag | 216 | 77 (36%) | 0.50 (0.50-0.50) | 0.50 (0.26-0.58) | -0.08 (-0.24 to +0.10) |
| Bias | 214 | 88 (41%) | 0.60 (0.50-0.67) | 0.60 (0.50-0.65) | +0.03 (-0.06 to +0.15) |
| BiasX | 214 | 17 (8%) | 0.50 (0.50-0.50) | 0.52 (0.33-0.60) | +0.02 (-0.17 to +0.10) |
| Hum | 191 | 39 (20%) | 0.50 (0.50-0.50) | 0.34 (0.00-0.50) | -0.11 (-0.50 to +0.26) |
| Ripple | 205 | 22 (11%) | 0.50 (0.50-0.50) | 0.44 (0.04-0.60) | -0.06 (-0.45 to +0.10) |

Reading. In 204 presets Line 6 sets Drive, the three tone controls, Presence
and Channel Volume on 80-95% of amp blocks, so these are always hand-set rather
than left at model defaults. The tone controls cluster around the middle (median
0.50 to 0.57), and the shift from each model's own default is centred on zero
(medians within 0.04, except Presence at +0.13), so the designers move them both
ways per amp; there is no "always cut mids" habit. Drive sits at a median 0.50
(quartiles 0.36-0.62): mid-gain, not high. Channel Volume is the one control
set high (median 0.77, quartiles 0.63-0.90). Master is left at its default in
124 of 235 blocks and, when changed, goes down (median 0.60). The power-amp
character controls (Sag, Bias, BiasX, Hum, Ripple) are mostly left at default:
moved in 36%, 41%, 8%, 20% and 11% of blocks. When Hum is moved it is usually
turned down (median 0.34, quartile 0.00). 5 of 238 amp blocks are off at load.

## 2. Cabs

Cab arrangement (204 presets): 105 have a separate cab block after the amp, 95
use an amp+cab block (type 3, the cab lives inside the amp block), 4 have no
cab. No preset uses an IR block (0). 58 presets (28%) have a dual cab block
(60 blocks). Cab blocks: 79 legacy models, 53 newer (`CabMicIr`) models.

Top amp-to-cab pairs (presets): Jazz Rivet 120 > 2x12 Jazz Rivet 11; Brit Plexi
Brt > 4x12 Greenback 25 8; Cali Rectifire > 4x12 Cali V30 6; US Double Nrm >
2x12 Double C12N 5; Revv Gen Red > 4x12 Cali V30 5; WhoWatt 100 > 4x12 WhoWatt
100 5; A30 Fawn Brt > 2x12 Blue Bell 5; US Deluxe Nrm > 1x12 US Deluxe 4;
Archetype Clean > 4x12 Cali V30 4.

Linked cab (the cab the catalog lists as the amp's own): used in 122 of 200
presets with a cab (61%). Split by arrangement: amp+cab block 82 of 95 (86%);
separate cab block 40 of 105 (38%). Where a separate cab is chosen, it is a
different one in 65 of 105 presets; 4x12 Cali V30 and Greenback cabs recur
behind several amps.

Cab entries (a dual block counts both halves): Distance median 1.75 (quartiles
1.00-3.00), moved off default in 136 of 287 (47%). Position median 0.24
(0.20-0.29), moved in 65 of 95 (68%).

| mic (n about 290 cab entries) | | mic | |
|---|---|---|---|
| 57 Dynamic | 76 (26%) | 906 Dynamic | 18 (6%) |
| 160 Ribbon | 33 (11%) | 67 Cond | 18 (6%) |
| 421 Dynamic | 33 (11%) | 414 Cond | 16 (6%) |
| 121 Ribbon | 30 (10%) | 47 Cond FET | 13 (5%) |

| cut | legacy cabs (default is 80 / 8000) | newer cabs |
|---|---|---|
| LowCut | 156 at 80 Hz, 19 at 20, 4 at 100 | 55 at 20 Hz (minimum), 14 at 80, 8 at 60, 5 at 40, 3 at 90 |
| HighCut | 141 at 8000 Hz, 17 at 20100 (off), 2 each at 7000, 9000, 10000 | 59 at 12000, 28 at 20100 (off), 3 at 5000 |

Reading. In 204 presets the cab choice follows the amp's own cab link more than
half the time, overwhelmingly when the cab is built into the amp block. Line 6
reaches for the 57 dynamic on a quarter of cab entries and splits the rest among
ribbons, other dynamics and condensers, with no one mic dominant. Distance is
left at the model default about half the time. On the 79 legacy cabs the
filters are almost always the default (80 Hz / 8 kHz), so those are not
deliberate choices. On the newer cabs the designers do choose: the low cut is
moved to its minimum in 55 entries and the high cut to 12 kHz in 59 or off in
28. Dual cab blocks are common (58 of 204) and no IR is used in any of them.

## 3. Block order

Before the amp (presets): volume > drive 16; drive 10; volume 9; wah > volume >
drive 7; nothing 7; wah > drive 6; volume > comp 6; wah > volume > drive > mod 4;
comp 4; comp > drive 4. After the cab: delay > reverb 31 (15%); reverb 25 (12%);
mod > delay > reverb 19 (9%); nothing 17 (8%); eq > delay > reverb 4; delay >
comp 4; reverb > delay 4. The last block before the output is reverb in 118
presets (58%), delay in 20, comp in 15.

| category | presets with one | blocks before amp / between amp and cab / after | on at load |
|---|---|---|---|
| reverb | 164 (80%) | 6 / 9 / 169 | 78% |
| volume | 161 (79%) | 128 / 15 / 26 | 96% |
| delay | 158 (77%) | 35 / 14 / 148 | 54% |
| drive | 150 (74%) | 178 / 3 / 9 | 49% |
| mod | 113 (55%) | 45 / 17 / 76 | 35% |
| comp | 95 (47%) | 65 / 2 / 36 | 82% |
| eq | 62 (30%) | 21 / 10 / 41 | 86% |
| wah | 58 (28%) | 57 / 0 / 1 | 7% |
| pitch | 36 (18%) | 26 / 3 / 14 | 44% |
| gate | 25 (12%) | 20 / 1 / 4 | 72% |

(between amp and cab only exists where a separate cab block follows the amp;
for amp+cab blocks everything after the amp counts as "after".)

Reading. Across 204 presets Line 6's usual chain is: [wah] > [volume] > [drive]
> [comp] > amp > cab > [mod] > delay > reverb, with the volume pedal almost
always first of the gain stages (128 of 161). Drive pedals sit before the amp
in 178 of 190 blocks. Compressors split: 65 in front of the amp, 36 after.
EQs are mostly after the cab (41 of 72 blocks). Modulation goes mainly after the
cab (76 of 138). Delay before reverb, reverb last. Wah appears in 58 presets (28%) and is off at load in all but 4. Median preset
has 8 blocks.

## 4. Drives in front of amps

Per preset: one drive before the amp in 125 (61%), none in 57 (28%), two in 17,
three or four in 4. Drive on at load in 49% of drive blocks.

| drive | uses | on at load | Drive/Gain | Level | Tone |
|---|---|---|---|---|---|
| Scream 808 | 35 | 18 | 0.50 (0.14-0.52) | 0.67 (0.61-0.77) | 0.65 (0.51-0.65) |
| Minotaur | 32 | 21 | 0.37 (0.21-0.42) | 0.60 (0.58-0.60) | 0.53 (0.49-0.53) |
| Kinky Boost | 12 | 7 | 0.51 (0.36-0.55) | - | - |
| Horizon Drive | 12 | 9 | 0.04 (0.00-0.20) | 0.64 (0.52-0.85) | - |
| Teemah! | 8 | 4 | 0.39 (0.33-0.52) | 0.62 (0.54-0.62) | - |
| Heir Apparent | 7 | 0 | 0.50 (0.50-0.56) | 0.62 (0.58-0.69) | 0.50 (0.50-0.50) |
| Bighorn Fuzz | 7 | 4 | - | 0.54 (0.50-0.62) | 0.61 (0.50-0.63) |
| Top Secret OD | 6 | 4 | 0.65 (0.49-0.78) | 0.83 (0.83-0.84) | - |

Pairs (presets): Brit Plexi Brt + Scream 808 6; Revv Gen Red + Scream 808 4;
Revv Gen Red + Horizon Drive 3; Placater Clean + Bighorn Fuzz 3; then pairs of 2
(US Deluxe Nrm + Kinky Boost, Placater Clean + Minotaur, Matchstick Ch1 +
Kinky Boost, Mandarin 80 + Top Secret OD and others).

Reading. In 204 presets, one drive pedal ahead of the amp is the norm, and two
models, Scream 808 and Minotaur, are 67 of the 190 drive blocks. They are
used as boosts: low drive (medians 0.50 and 0.37, quartiles reaching down to
0.14 and 0.21) with Level at 0.60-0.67. Pairings are too thin (no pair above 6
presets) to call a rule. Settings include off-at-load blocks.

## 5. Delay and reverb

| | blocks | models (blocks) | mono / stereo | trails | Mix median (q1-q3) | other |
|---|---|---|---|---|---|---|
| delay | 233 (106 on at load) | Simple Delay 49, Transistor Tape 37, Adriatic 22, Ping Pong 17, Vintage Digital 15, Elephant Man 15 | 140 / 93 | 78 (33%) | 0.37 (0.25-0.45), n=226 | Feedback 0.38 (0.24-0.50); tempo-synced 130 (56%) |
| reverb | 223 (78% on at load) | Plate 26, Room 26, Dynamic Ambience 22, '63 Spring 14, Chamber 14, Hall 14 | 147 / 76 | 32 (14%) | 0.35 (0.26-0.46), n=223 | Decay 0.56 (0.40-0.73), n=196 |

"Stereo" is the block's saved `@stereo` flag; its meaning for every model is
not checked here.

Reading. In 204 presets Line 6 puts delay Mix around 0.37 and Feedback around
0.38, with more than half synced to tempo. Reverb Mix is about 0.35 and Decay
about 0.56. Trails are turned on for about a third of delays but only 14% of
reverbs. Delays are on at load in about half the blocks (the rest are
snapshot/footswitch options), reverbs in about four out of five. The models used
are spread widely; the simple, tape and digital delays and the plate, room and
ambience reverbs are the most common.

## 6. Snapshots

Valid snapshots per preset: 1 in 120 presets (no snapshot use), 4 in 12, 6 in 1,
8 in 71. So 84 of 204 (41%) use snapshots. Names are the default `SNAPSHOT 1`-
`SNAPSHOT 8` everywhere except a handful (Intro 3, Solo 3, Clean 2, Lead 2,
INTRO 2, `-1-` 2).

Among the 84: bypass states differ between snapshots in 56, not in 28; saved
control values differ in 27; tempo differs in 7. Bypass changes by category
(blocks): delay 48, drive 42, mod 29, reverb 23, comp 18, wah 13, pitch 10, eq 6,
amp 5, volume 4. Controls that change value between snapshots (blocks, median
range of the 0-1 value): amp Drive 14 (0.18), wah Pedal 7 (1.00), reverb Mix 7
(0.10), volume Pedal 7 (0.86), delay Feedback 7 (0.27), delay Mix 6 (0.15), amp
Treble 5 (0.11), amp ChVol 3 (0.07), reverb Decay 3 (0.05), eq Level 3 (1.5 dB).

Reading. In Line 6's presets with snapshots (84), snapshots mostly switch
effects (delay, drive, mod, reverb, comp) rather than reshape the amp. Where a
control moves, amp Drive is the most common (14 blocks, typically a 0.18 swing)
and level compensation (ChVol) appears in only 3. Snapshots are rarely named.

## 7. Footswitch and expression pedals

Controller assignments (blocks): EXP2 > volume Pedal 166; EXP1 > wah Pedal 55;
EXP1 > pitch Pedal 4; EXP1 > volume Pedal 4. Snapshot-controlled: amp Drive 16,
delay Feedback 8, delay Mix 7, amp ChVol 6, reverb Mix 6, amp Master 5, amp
Treble 5, delay Level 4, eq Level 3, reverb Decay 3, amp Presence 3, amp Sag 3.

Footswitch-enabled stomp assignments (`@fs_enabled` true, index other than 13):
reverb 158, delay 130, drive 92, comp 61, mod 53, eq 24, pitch 19, gate 11,
filter 9, amp 4, cab 3, wah 3. On index 13: volume 162, plus a few eq, amp,
gain, pitch, wah. By index (blocks): 13: 175, 11: 137, 10: 108, 9: 101, 8: 101,
2: 41, 3: 35, 4: 28, 5: 18. I read `@fs_enabled` true as "assigned to a
switch" and index 13 as the toe/pedal switch (as `reader.py` does); the mapping
of the other indexes to physical switches was not checked.

Reading. Across 204 presets Line 6 puts a volume pedal on EXP2 (166) and a wah
on EXP1 (55) as the standard pedal pair. The stomp switches go on reverb,
delay and drive first, then comp and mod; amp-level assignments are rare (4
blocks).

## 8. Parallel paths

73 of 204 presets (36%) have a split/join or a B path. Topology strings
(DSP0 > DSP1, S = split, J = join): SABJ > A 29; SAB > ABJ 14; SABJ > SABJ 9;
A > SABJ 8; others 13. Split types (blocks): Y 66, A/B 10, crossover 4. What is
on the B path (73 presets): effects only 37; a second amp 24; a cab and no amp
12. Most frequent B-path contents: reverb alone 10; delay > reverb 6; delay alone
6; cab alone 5; amp alone 4; amp > cab > delay > reverb 3; gain alone 3.

Reading. In 204 presets, parallel use is about equally an effects path (37 of
73, mostly delay and/or reverb alone, which fits a wet path) and a second amp
(24 of 73). Wet/dry versus other uses cannot be told apart from block lists
alone. `templates.hls` has 13 guitar-amp presets that are routing demos, 10 of
them with splits (6 with a second amp); these are teaching examples and were not
counted above.

## 9. Output and level

Output A gain (DSP0): 0 dB in 177 of 204 presets (87%); non-zero in 27, of which
24 are cuts (-18 dB 2, -12 dB 6, -6 dB 5, -3 dB 3, -4.5 dB 2, others) and 3 are
boosts (+2, +4.3, +8). Gain blocks: 20 blocks in 12 presets, median 0.55 dB
(0.00-3.77), 15 after the amp and 5 before, on at load in only 2 of the 12.
Input noise gate on in 126 of 204 presets (62%), threshold median -50 dB
(quartiles -70 to -48).

Reading. In Line 6's 204 factory presets output level is left alone (0 dB in
87%); balance is done at the amp (Channel Volume median 0.77) and by the blocks'
own Level controls. Final gain blocks are rare (12 presets) and mostly off. The
input noise gate is on in most (62%).

## Checkable claims

- Newer cabs with LowCut at 20 Hz (55 entries) versus the legacy default of 80 Hz: with the same amp and mic, the 20 Hz cut should show more energy below 80 Hz; measure level in 30-80 Hz.
- HighCut 12 kHz (59 newer-cab entries) versus 8 kHz (141 legacy entries): at the same settings, the 12 kHz cab should have a higher spectral centroid; measure brightness.
- Mic choice: 57 Dynamic (26% of entries) versus 160 Ribbon or 121 Ribbon: on the same cab, ribbons should render darker (lower centroid) than the 57; measure brightness difference.
- Drives as boosts: Scream 808 at Drive 0.50, Level 0.67, Tone 0.65 and Minotaur at Gain 0.37, Level 0.60, Tone 0.53 in front of a mid-gain amp: switching on should raise output level by a few dB and brighten slightly; measure on versus off level and centroid.
- Level matching within snapshots: amp Drive moves about 0.18 between snapshots while ChVol moves only about 0.07 in 3 blocks; measure whether the loud snapshot is louder than the rhythm one by more than 3 dB.
- Output level spread: with output gain 0 dB in 87% of presets and ChVol median 0.77, the integrated level across the 204 factory presets should land in a narrow band; measure the spread (this shows how well matched they really are).
- Delay Mix 0.37, Feedback 0.38 and reverb Mix 0.35, Decay 0.56 as typical: an impulse or note through them should give a clearly audible tail; measure wet-to-dry level ratio and decay time (to -40 dB) and compare with the model defaults.
- Channel Volume 0.77 versus Master left at default in 124 of 235 blocks: raising Master from 0.60 to 1.00 on an amp with ChVol 0.77 should change gain structure and level; measure level and a distortion measure at both settings.

## Checks done by hand

Against `python -m helixtone inspect` over factory1 and factory2: presets
containing Jazz Rivet 120 (17), US Double Nrm (13) and Brit Plexi Brt (10) match
the script's counts of presets using each amp. Jazz Rivet 120 has 20 amp blocks;
`inspect` lists `Master=` on 4 of them and the script's "Master moved" count
for that amp is also 4. Raw counts of Simple Delay (50), Plate (27) and Scream
808 (41) in `inspect` are slightly higher than the tables (49, 26, 35) because
`inspect` covers the 27 bass, empty and effects-only presets that the tables
skip, and the drive table counts only drives placed before the amp.
