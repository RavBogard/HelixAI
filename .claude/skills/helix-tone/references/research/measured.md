# Measured: what the claims come to in Helix Native

Rendered with Helix Native on the built-in test signal by `tools/check_claims.py`. Levels in dB. "Balance change" is `audio.distance` between two renders: 0 is the same balance and dynamics, level ignored.

## 1. Channel Volume: level only, or tone too?

| amp | Ch Vol | loudness vs 0.9 | crest | balance change vs 0.9 |
|---|---|---|---|---|
| US Deluxe Nrm | 0.9 | 0.0 | 15.5 | 0.0 |
| US Deluxe Nrm | 0.7 | -4.8 | 15.5 | 0.0 |
| US Deluxe Nrm | 0.5 | -9.6 | 15.5 | 0.0 |
| US Deluxe Nrm | 0.3 | -19.2 | 15.5 | 0.0 |
| Brit Plexi Brt | 0.9 | 0.0 | 11.7 | 0.0 |
| Brit Plexi Brt | 0.7 | -2.9 | 11.7 | 0.0 |
| Brit Plexi Brt | 0.5 | -11.7 | 11.7 | 0.0 |
| Brit Plexi Brt | 0.3 | -26.9 | 11.7 | 0.0 |

## 2. Drive at a fixed Channel Volume

| amp | Drive | loudness vs Drive 0.2 | crest | centroid Hz |
|---|---|---|---|---|
| US Deluxe Nrm | 0.2 | 0.0 | 24.2 | 3249.5 |
| US Deluxe Nrm | 0.4 | 17.5 | 17.1 | 3021.8 |
| US Deluxe Nrm | 0.6 | 22.9 | 13.8 | 2702.1 |
| US Deluxe Nrm | 0.8 | 24.9 | 12.2 | 2485.4 |
| Brit Plexi Brt | 0.2 | 0.0 | 14.3 | 2657.0 |
| Brit Plexi Brt | 0.4 | 3.4 | 12.2 | 2274.2 |
| Brit Plexi Brt | 0.6 | 3.7 | 11.8 | 2181.7 |
| Brit Plexi Brt | 0.8 | 3.9 | 11.6 | 2153.6 |

## 3. Cab high cut: what each setting removes

Cab alone on the dry signal, 57 Dynamic, relative to the cut fully open (20.1 kHz).

| High Cut Hz | 2k | 3.15k | 4k | 5k | 6.3k | 8k | 10k |
|---|---|---|---|---|---|---|---|
| 12000 | -0.0 | -0.0 | -0.0 | -0.1 | -0.1 | -0.5 | -1.1 |
| 8000 | -0.0 | -0.1 | -0.2 | -0.5 | -0.9 | -2.9 | -5.5 |
| 6500 | -0.0 | -0.2 | -0.5 | -1.3 | -2.1 | -5.4 | -8.8 |
| 5000 | -0.1 | -0.6 | -1.3 | -3.1 | -4.7 | -9.3 | -13.4 |
| 3500 | -0.5 | -2.1 | -4.1 | -7.5 | -9.9 | -15.4 | -19.7 |
| 3000 | -0.9 | -3.4 | -6.0 | -9.9 | -12.4 | -18.1 | -22.5 |

Through an amp (Brit Plexi Brt, defaults), same cab:

| High Cut Hz | loudness change | centroid Hz | 1.6-5 kHz share | 5-12 kHz share |
|---|---|---|---|---|
| 20100 | 0.0 | 2158.3 | -2.3 | -16.2 |
| 12000 | -0.0 | 2154.6 | -2.3 | -16.4 |
| 8000 | -0.1 | 2130.5 | -2.3 | -17.0 |
| 6500 | -0.2 | 2096.8 | -2.3 | -17.9 |
| 5000 | -0.4 | 2018.1 | -2.4 | -20.1 |
| 3000 | -1.8 | 1705.5 | -3.3 | -26.3 |

## 4. Is the cab block's cut gentler than an EQ block's?

| high cut | at 5k | at 6.3k | at 8k | at 10k (one octave up) |
|---|---|---|---|---|
| cab block High Cut 5 kHz | -3.1 | -4.7 | -9.3 | -13.4 |
| Low and High Cut block at 5 kHz after the cab | -9.3 | -12.0 | -19.5 | -25.9 |

| low cut | at 100 | at 80 | at 63 | at 50 Hz (one octave down) |
|---|---|---|---|---|
| cab block Low Cut 100 Hz | -2.3 | -5.0 | -7.9 | -11.9 |
| Low and High Cut block at 100 Hz after the cab | -2.0 | -5.3 | -9.0 | -14.2 |

## 5. Cab low cut

| Low Cut Hz | 50 | 80 | 100 | 125 | 160 |
|---|---|---|---|---|---|
| 80 | -8.3 | -2.7 | -1.1 | -0.7 | -0.2 |
| 100 | -11.9 | -5.0 | -2.3 | -1.6 | -0.5 |
| 120 | -14.8 | -7.4 | -3.8 | -2.8 | -1.1 |

## 6. Microphones, distance and position

Cab alone, relative to the 57 Dynamic at the cab's defaults (distance 1 in, position 0.24).

| mic | 80-300 | 300-1k | 1-2k | 2-6k | 6-12k |
|---|---|---|---|---|---|
| 121 Ribbon | -0.4 | -2.3 | -5.8 | -6.8 | -8.1 |
| 160 Ribbon | -0.4 | -1.5 | -2.8 | -4.0 | -6.0 |
| 4038 Ribbon | -1.0 | -3.8 | -7.0 | -9.4 | -12.4 |
| 421 Dynamic | -0.3 | -1.1 | -1.1 | 0.2 | -0.7 |
| 67 Cond | -0.2 | 0.2 | -1.1 | -1.9 | -4.9 |

| distance | 80-300 | 300-1k | 1-2k | 2-6k | 6-12k |
|---|---|---|---|---|---|
| 121 Ribbon at 1.0 in | -0.4 | -2.3 | -5.8 | -6.8 | -8.1 |
| 121 Ribbon at 3.0 in | -0.2 | -0.9 | -3.9 | -4.7 | -8.0 |
| 121 Ribbon at 6.5 in | 0.3 | -0.4 | -1.8 | -2.3 | -7.2 |
| 121 Ribbon at 12.0 in | 0.3 | 1.1 | -2.6 | -2.5 | -6.4 |
| 57 Dynamic at 3.0 in | -0.0 | -0.1 | 0.8 | 0.9 | 1.4 |
| 57 Dynamic at 6.5 in | -0.1 | -0.2 | 1.1 | 1.5 | 1.0 |

| position (0 to 1) | 80-300 | 300-1k | 1-2k | 2-6k | 6-12k |
|---|---|---|---|---|---|
| 57 Dynamic, position 0.0 | 0.1 | 0.0 | 0.7 | 2.4 | 1.1 |
| 57 Dynamic, position 0.5 | -0.1 | -0.1 | -1.9 | -3.5 | -5.8 |
| 57 Dynamic, position 1.0 | -0.2 | -0.9 | -3.4 | -4.0 | -11.2 |

## 7. One cab against a dynamic and ribbon pair

| cab | 80-300 | 300-1k | 1-2k | 2-6k | 6-12k | loudness change |
|---|---|---|---|---|---|---|
| 57 + 121 Ribbon, dual | 2.2 | 1.6 | 0.5 | 0.2 | -0.3 | 0.9 |

## 8. Sag and Bias: do they matter at low Master?

| Master | control 0 to 10 | loudness change | crest change | balance change |
|---|---|---|---|---|
| 0.3 | Sag | -2.4 | 0.9 | 1.0 |
| 0.3 | Bias | -1.8 | 0.2 | 0.7 |
| 0.3 | BiasX | -0.3 | -0.3 | 0.5 |
| 0.3 | (level at defaults) | -30.5 | 13.2 | 0.0 |
| 1.0 | Sag | -4.9 | 1.9 | 2.5 |
| 1.0 | Bias | 4.4 | -0.2 | 2.2 |
| 1.0 | BiasX | -4.2 | 0.5 | 1.7 |
| 1.0 | (level at defaults) | -26.6 | 11.7 | 0.0 |

## 9. Hum and Ripple

| Hum | Ripple | loudness | 40-70 Hz | 100-130 Hz |
|---|---|---|---|---|
| 0.5 | 0.5 | -26.6 | -79.6 | -54.7 |
| 0.0 | 0.0 | -26.6 | -79.6 | -54.7 |
| 1.0 | 1.0 | -26.7 | -64.8 | -54.6 |

## 10. A Tube Screamer in front of an amp

| chain | loudness change | crest | 60-150 Hz change | 600-1200 Hz change | centroid Hz |
|---|---|---|---|---|---|
| amp alone (Brit Plexi Brt, Drive 0.5) | 0.0 | 12.0 | 0.0 | 0.0 | 2210.8 |
| Scream 808 as a boost: Gain 0.15, Level 0.8 | 0.6 | 11.4 | -2.1 | 3.1 | 1950.8 |
| Scream 808 as Line 6 sets it: Gain 0.5, Level 0.67, Tone 0.65 | 0.8 | 11.1 | -2.3 | 3.3 | 1960.9 |

## 11. Clean against driven at the same loudness

| sound | loudness | peak | crest | peak when brought to the lead's loudness |
|---|---|---|---|---|
| clean (US Deluxe Nrm, Drive 0.3) | -33.3 | -13.3 | 23.1 | -3.2 |
| the same with Deluxe Comp 4:1 in front | -30.5 | -13.9 | 19.7 | -6.5 |
| lead (German Mahadeva, Drive 0.8) | -23.2 | -13.5 | 11.5 | -13.5 |

