# Connecting Helix Native: the job for the first session on Daniel's PC

Everything that tunes a tone by measurement calls one function,
`renderer.render(preset, di, sr)`. The stand-in renderer proves the tuning
code; the real one, `NativeRenderer` in `helixtone/render.py`, hosts Helix
Native but stops at `load_preset`, because how a preset gets into the plugin
was never established: this code was written on a machine without it. Finishing
that one method is what turns the loop on.

Do this once, on the Windows PC that has Helix Native installed and licensed.

## 1. Probe

```
pip install numpy pedalboard
python tools/native_probe.py
```

It reports whether the plugin loads, what parameters it exposes to a host,
whether it exposes a state blob, what that blob looks like, and whether audio
passes. It saves the blob as `native_state.bin`. If the plugin cannot be found,
pass `--vst <path to Helix Native.vst3>`.

## 2. Find out how a preset is stored

Work from evidence, in this order, and stop at the first that works:

1. **The state blob contains the preset.** Look for preset JSON, or a
   compressed or base64 form of it, inside `native_state.bin` (the probe says
   which markers it saw). If so: load a known preset in the plugin by hand once,
   save the state, and work out the wrapping; then `load_preset` builds the
   same wrapping around our preset and assigns `plugin.raw_state`.
2. **A `.vstpreset` file.** If Helix Native loads VST3 preset files, pedalboard
   has `plugin.load_preset(path)`; find out what such a file must contain.
3. **Host parameters only.** If neither works, the plugin cannot be given an
   arbitrary preset from a script. Say so plainly, leave `NativeRenderer`
   refusing, and use the folder renderer (`--renderer folder`) with a DAW
   bounce, or look at driving the hardware instead (the LT is a USB audio
   interface and can re-amp; getting a preset onto it from a script is the
   open part there).

Do not write a `load_preset` that "probably" works. A renderer that silently
plays the wrong preset would make every measurement after it meaningless.

## 3. Prove it before trusting it

`load_preset` is accepted when all of these hold, with Helix Native as the
renderer and the built-in test signal as input:

- Rendering the same preset twice gives the same numbers.
- A clean preset and a high-gain preset give clearly different crest factors
  (the high-gain one lower by several dB).
- Turning a cab's `HighCut` from 20000 down to 3000 lowers the measured top end.
- A preset with every block bypassed measures close to the input.
- A change in one snapshot's `ChVol` moves that snapshot's loudness and not
  the others'.

Add those as a test that runs only when Helix Native is present, then record
in `rig/rig.md` that the Native loop is working and on which version.

## 4. Then, and only then

- `python -m helixtone tune level <spec> --write` on each tone in `tones/`.
- Record a real DI of each player's guitar to `reference/di.wav` (and
  `reference/di-david.wav`); the synthetic test signal is repeatable but is
  not a guitar.
- POD Go presets cannot be rendered in Helix Native directly. Retarget the
  spec to `helix_lt` to measure it (`inspect --spec -d helix_lt`), tune there,
  and carry the settings back; models and controls are shared.
