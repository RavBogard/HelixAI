# JM Funk

POD Go preset, file `jm-funk.pgp`.

For David's Jazzmaster: Deluxe Reverb clean, Dyna Comp squeeze, Mu-Tron style envelope filter and Phase 90 on switches, spring reverb, wah on the pedal. Uses all four free blocks. Levels set by measuring the same chain through Helix Native, which shares the POD Go's models but not its input and output stages. Not yet heard on the unit.

## Snapshots

| # | name | switches in | sets | loudness | peak |
|---|---|---|---|---|---|
| 1 | Clean Funk | (the preset loads here) | amp ChVol 0.914 | -21.9 dB | -11.2 dB |
| 2 | Quack | filter | amp ChVol 1 | -28.8 dB | -15.6 dB |
| 3 | Phase | phase | amp ChVol 0.909 | -21.7 dB | -10.2 dB |
| 4 | Wah Solo | wah | amp Drive 0.45, amp ChVol 0.981 | -22.2 dB | -6.9 dB |

## Stomp switches

- switches: **FS1** filter (Mutant Filter, off at load) | **FS2** phase (Script Mod Phase, off at load) | **FS3** spring ('63 Spring, on at load) | FS4 free | FS5 free | FS6 free

## Pedal

- EXP2: volume (Volume) Pedal, switched by the toe switch
- EXP1: wah (Chrome Custom) Pedal, switched by the toe switch

## Signal chain

- **volume**: Volume. defaults. [pedal]
- **wah**: Chrome Custom. defaults. [pedal]
- **comp**: Red Squeeze. Mix 0.8, Sensitivity 0.4. [always on]
- **filter**: Mutant Filter. Gain 0.3, Mix 0.85, Peak 0.6. [stomp]
- **phase**: Script Mod Phase. Rate 0.3. [stomp]
- **fxloop**: FX Loop 1. defaults. [always off]
- **amp**: US Deluxe Vib. Bass 0.45, ChVol 0.85, Drive 0.3, Mid 0.55, Treble 0.55. [always on]
- **cab**: 1x12 US Deluxe. HighCut 8000, LowCut 80. [always on]
- **eq**: Parametric. defaults. [always off]
- **spring**: '63 Spring. Decay 0.5, Mix 0.28. [stomp]

DSP: total 72%

## Measured

Helix Native, built-in test signal, 2026-11-22. Levels are comparable between presets measured the same way; they are not what a meter on the unit reads.

- stepping on filter in Clean Funk: -9.0 dB
- stepping on phase in Clean Funk: +0.2 dB
- stepping on spring in Clean Funk: +0.0 dB

## Checks

- defect: snapshot 'Quack' is -6.9 dB from where it should sit against 'Clean Funk' Fix: helixtone tune level <spec> --write.
- defect: stepping on filter in 'Clean Funk' changes level by -9.0 dB Fix: trim filter's own level or mix.

## Not verified

No measurement here hears the way a person does. Until someone has played it, this preset is measured but unheard.
