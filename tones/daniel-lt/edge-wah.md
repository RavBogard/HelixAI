# Edge-ish + Wah

Helix LT preset, file `edge-wah.hlx`.

U2-style chime: AC30 top boost, compressor, dotted-eighth delay that follows tap tempo, wah and volume on the pedal (toe switch swaps them). Snapshots are the four standing sounds (Clean, Crunch, Lead, Ambient) and change the amp, levels and effect mixes only; every stomp stays as the foot left it. Ambient switches in the shimmer reverb. Cab is a 57 with a 121 ribbon beside it for body. Built for the Powercab in flat mode. Not yet heard on the unit.

## Snapshots

| # | name | switches in | sets | loudness | peak |
|---|---|---|---|---|---|
| 1 | Clean | (the preset loads here) | amp Drive 0.18, amp ChVol 0.969 | -22.2 dB | -8.5 dB |
| 2 | Crunch |  | amp Drive 0.45, amp ChVol 0.694 | -21.9 dB | -10.5 dB |
| 3 | Lead |  | amp Drive 0.8, amp ChVol 0.7, dly Mix 0.22 | -20.1 dB | -10.8 dB |
| 4 | Ambient | shimmer | amp Drive 0.18, amp ChVol 0.964, dly Mix 0.38 | -22.1 dB | -8.8 dB |

## Stomp switches

A stomp keeps the state your foot gave it when you change snapshot.

- top row: **FS2** comp (Deluxe Comp, on at load) | FS3 free | FS4 free | FS5 free
- bottom row: **FS8** push (Minotaur, off at load) | **FS9** chorus (Chorus, off at load) | **FS10** dly (Vintage Digital, on at load) | **FS11** verb (Plate, on at load)

## Pedal

- EXP1: wah (Fassel) Pedal, switched by the toe switch
- EXP2: vol (Volume) Pedal, switched by the toe switch

## Signal chain

- **wah**: Fassel. defaults. [pedal]
- **vol**: Volume. defaults. [pedal]
- **comp**: Deluxe Comp. Level 3, Mix 0.75, Ratio 2, Threshold -30. [stomp]
- **push**: Minotaur. Gain 0.25, Level 0.68, Tone 0.5. [stomp]
- **amp**: Essex A30. Bass 0.4, ChVol 0.8, Cut 0.56, Drive 0.45, Treble 0.6. [always on]
- **cab**: 2x12 Blue Bell + 2x12 Blue Bell (HighCut 7500, Mic 5). HighCut 7500. [always on]
- **chorus**: Chorus. Depth 0.6, Mix 0.33. [stomp]
- **dly**: Vintage Digital. Feedback 0.35, Mix 0.3, SyncSelect1 8, TempoSync1 on. [stomp]
- **verb**: Plate. Decay 0.4, Mix 0.15. [stomp]
- **shimmer**: Plateaux. Decay 0.55, Mix 0.25, Pitch1 12, Pitch2 12, PitchMix 0.3, Tone 0.6. [snapshots]

DSP: processor 1 52%, processor 2 20%

## Measured

Helix Native, built-in test signal, 2026-11-22. Levels are comparable between presets measured the same way; they are not what a meter on the unit reads.

- stepping on comp in Crunch: +1.0 dB
- stepping on push in Crunch: +1.7 dB
- stepping on chorus in Crunch: +0.3 dB
- stepping on dly in Crunch: +0.1 dB
- stepping on verb in Crunch: -0.0 dB

## Checks

Nothing found.

## Not verified

No measurement here hears the way a person does. Until someone has played it, this preset is measured but unheard.
