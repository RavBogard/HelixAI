# Hendrix-ish

Helix LT preset, file `hendrix.hlx`.

Hendrix-style rig in his order: Vox wah, Fuzz Face, Octavia, Uni-Vibe, jumped Plexi, greenbacks. Snapshots are the four standing sounds (Clean, Crunch, Lead, Ambient) and change the amp, levels and effect mixes only; every stomp stays as the foot left it. Clean is the Plexi with the drives pulled back, as when the guitar volume comes down. Ambient switches in its own long reverb. Cab is a 57 with a 121 ribbon beside it for body (measured: about 2 dB more below 1 kHz, top unchanged). Bass is pulled well back from the model's default of 9.0. Built for the Powercab in flat mode. Not yet heard on the unit.

## Snapshots

| # | name | switches in | sets | loudness | peak |
|---|---|---|---|---|---|
| 1 | Clean | (the preset loads here) | amp BrtDrive 0.17, amp NrmDrive 0.12, amp ChVol 1, trim Gain 4.52 | -22.0 dB | -8.4 dB |
| 2 | Crunch |  | amp BrtDrive 0.27, amp NrmDrive 0.2, amp ChVol 0.825 | -22.2 dB | -11.6 dB |
| 3 | Lead |  | amp BrtDrive 0.78, amp NrmDrive 0.62, amp ChVol 0.888, echo Mix 0.18 | -20.2 dB | -9.9 dB |
| 4 | Ambient | space | amp BrtDrive 0.17, amp NrmDrive 0.12, amp ChVol 1, echo Mix 0.35, trim Gain 3.6 | -22.0 dB | -9.1 dB |

## Stomp switches

A stomp keeps the state your foot gave it when you change snapshot.

- top row: **FS2** octave (Tycoctavia Fuzz, off at load) | FS3 free | FS4 free | FS5 free
- bottom row: **FS8** fuzz (Arbitrator Fuzz, off at load) | **FS9** vibe (Ubiquitous Vibe, off at load) | **FS10** echo (Transistor Tape, off at load) | **FS11** verb (Plate, on at load)

## Pedal

- EXP1: wah (UK Wah 846) Pedal, switched by the toe switch
- EXP2: vol (Volume) Pedal, switched by the toe switch

## Signal chain

- **wah**: UK Wah 846. defaults. [pedal]
- **fuzz**: Arbitrator Fuzz. Fuzz 0.7, Level 0.45. [stomp]
- **octave**: Tycoctavia Fuzz. Fuzz 0.6, Level 0.5. [stomp]
- **vibe**: Ubiquitous Vibe. Intensity 0.8, Rate 0.33. [stomp]
- **vol**: Volume. defaults. [pedal]
- **amp**: Brit Plexi Jump. Bass 0.5, BrtDrive 0.27, Mid 0.8, NrmDrive 0.2, Presence 0.6, Sag 0.6, Treble 0.65. [always on]
- **cab**: 4x12 Greenback 25 + 4x12 Greenback 25 (HighCut 7500, LowCut 85, Mic 5). HighCut 7500, LowCut 85. [always on]
- **trim**: Gain. defaults. [always on]
- **echo**: Transistor Tape. Feedback 0.3, Mix 0.22, Time 0.36. [stomp]
- **verb**: Plate. Decay 0.35, Mix 0.15. [stomp]
- **space**: Glitz. Decay 0.7, HighCut 6000, Mix 0.3. [snapshots]

DSP: processor 1 52%, processor 2 30%

## Measured

Helix Native, built-in test signal, 2026-11-22. Levels are comparable between presets measured the same way; they are not what a meter on the unit reads.

- stepping on fuzz in Crunch: -1.7 dB
- stepping on octave in Crunch: +1.0 dB
- stepping on vibe in Crunch: +0.3 dB
- stepping on echo in Crunch: -0.1 dB
- stepping on verb in Crunch: -0.0 dB

## Checks

Nothing found.

## Not verified

No measurement here hears the way a person does. Until someone has played it, this preset is measured but unheard.
