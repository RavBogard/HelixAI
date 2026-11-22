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
- **Computer:** Windows.

## David

- **Device:** Line 6 POD Go. Firmware not recorded; presets are written as 2.50.
  If it is the POD Go Wireless, say so here: its device id differs.
- **Guitar:** Fender Jazzmaster.
- **Amplification:** PA, monitors or headphones (per Daniel, 2026-11-22), so
  full-range: presets **keep a cab block**.
