# The rigs

Facts about who plays what. Keep this current: the skill reads it before
building anything.

## Daniel

- **Device:** Line 6 Helix LT, stock firmware.
  - Firmware version: **not recorded yet.** Presets are written as 3.80. If
    HX Edit warns about a version mismatch on import, note the unit's version
    here and set `"firmware"` in the spec.
- **Amplification:** Line 6 Powercab 212 Plus, run in **flat / FRFR mode**
  (confirmed by Daniel, 2026-11-22). Presets therefore **keep a cab block**.
  Not recorded: whether it is connected by L6 LINK or analog.
- **Also owns:** Helix Native 3.82, installed and authorised on the Windows PC.
  **The Native measuring loop works** (accepted 2026-11-22 by
  `tests/test_native.py`): `helixtone tune ...` renders through it with no
  window and nobody at the keyboard. How, and what to do when it stops:
  `.claude/skills/helix-tone/references/native-setup.md`.
- **Guitars** (Daniel, 2026-11-22): usually a Strat or a Tele (single
  coils); sometimes an Eastman Romeo or a Reverend with a vintage rail
  pickup. Build for single coils unless he names the guitar.
- **What he wants first** (Daniel, 2026-11-22): ambient / worship / U2,
  classic rock and blues, clean / funk / pop. Not high gain.
- **How he plays a preset** (Daniel, 2026-11-22). The machine-readable copy
  of this is `rig/players.json` (`daniel-lt`); `helixtone check` enforces it.
  - The LT stays in **stomp mode with all eight switches as stomps**; he
    presses MODE to reach snapshots.
  - **Snapshots are whole sounds, the same four in the same order on every
    preset: Clean, Crunch, Lead, Ambient.** More may follow those four.
  - **A stomp stays as his foot left it when the snapshot changes.** So
    every switched block has `"stays": true`, and snapshots change amp
    settings, levels, effect mixes and blocks that are on no switch. A sound
    a snapshot needs (the Ambient reverb, say) is its own unswitched block.
  - **Bottom row, left to right, always: FS8 drive, FS9 modulation (or a
    filter, pitch effect or second drive), FS10 delay, FS11 reverb.** The top
    row (FS2 to FS5) is free for whatever else the preset has.
- **Preset level:** every preset's Clean snapshot is levelled to **-22 dB**
  loudness on the built-in test signal through Helix Native, so presets match
  each other, and **Lead sits 2 dB above** (Daniel, 2026-11-22).
  `helixtone tune level <spec> --write` reads both from `rig/players.json`.
  The -22 was chosen 2026-11-22 as the midpoint of the first two tones;
  provisional until he has heard them at volume.
- **Drive stomps** are set so stepping on one lifts the Crunch sound by about
  1.5 dB (`helixtone tune stomps <spec> --write`). Claude's choice, 2026-11-22,
  not his: change it when he says how he wants a drive to hit.
- **Each preset comes with a one-page sheet** beside it (`<name>.md`),
  written by `helixtone check`. Presets stay in `tones/`.
- **Computer:** Windows.

## David

- **Device:** Line 6 POD Go. Firmware not recorded; presets are written as 2.50.
  If it is the POD Go Wireless, say so here: its device id differs.
- **Guitar:** Fender Jazzmaster.
- **Amplification:** PA, monitors or headphones (per Daniel, 2026-11-22), so
  full-range: presets **keep a cab block**.
- **Measuring:** a POD Go tone is rendered through Helix Native as the same
  chain on a Helix (same models, same ids). That misses the POD Go's own input
  and output stages, so its levels are a starting point. Levelled to -22 dB
  like Daniel's so the two rigs match on a shared stage.
