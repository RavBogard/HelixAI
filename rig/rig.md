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
- **How he plays a preset** (Daniel, 2026-11-22): snapshots for a few
  different main sounds, and each stomp switchable on and off while playing.
  On the LT that is the Snap/Stomp layout (Global Settings > Footswitches >
  Preset Mode Switches: four snapshots on one row, four stomps on the other).
  So every preset for him gets at most four snapshots that are whole sounds,
  and its effects on stomp switches. Not recorded yet: whether his unit is
  set to Snap/Stomp or Stomp/Snap, and whether a stomp he turns on should
  stay on when he changes snapshot.
- **Preset level:** every preset's first snapshot is levelled to **-22 dB**
  loudness on the built-in test signal through Helix Native
  (`helixtone tune level <spec> --level -22 --write`), so presets match each
  other. Chosen 2026-11-22 as the midpoint of the first two tones; provisional
  until Daniel has heard them at volume. Leads are level with the rest until
  he says how much louder he wants them.
- **Computer:** Windows.

## David

- **Device:** Line 6 POD Go. Firmware not recorded; presets are written as 2.50.
  If it is the POD Go Wireless, say so here: its device id differs.
- **Guitar:** Fender Jazzmaster.
- **Amplification:** PA, monitors or headphones (per Daniel, 2026-11-22), so
  full-range: presets **keep a cab block**.
