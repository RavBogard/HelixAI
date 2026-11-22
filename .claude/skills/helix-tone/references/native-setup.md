# Helix Native as the renderer

Everything that tunes a tone by measurement calls one function,
`renderer.render(preset, di, sr)`. `NativeRenderer` in `helixtone/render.py`
does it with the real Helix Native. It was connected and accepted on Daniel's
PC on 2026-11-22 (Helix Native 3.82, Windows 11). This file records how it
works, what was established to get there, and what to do when it stops.

## Needs

```
pip install numpy pedalboard pywin32
```

Helix Native installed, signed in and this computer authorised. Windows only:
the preset loader works the plugin's window with Windows messages.

## How a preset gets in

Helix Native does not take a `.hlx` from its host. Established with
`tools/native_probe.py` and follow-up experiments:

- It exposes 167 host parameters, all generic (Knob 01-16, Switch 01-16,
  master levels, bypass, Snapshot Index, CC 0-127). None can carry a preset.
- Its saved state is JUCE's wrapper (`VC2!`, then XML
  `<VST3PluginState><IComponent>`) around JUCE's own base64 of a chunk file:
  `CMXH`, a length, then chunks of 4-byte tag (stored reversed), version,
  size, a fourth word, data. Chunks: `PCHR`, `PCLI`, `PCGV` (master levels),
  `PCTV`, `PCPD` (the preset), `PCDB`, `PCUI`.
- The preset chunk is not `.hlx`. It is 8 bytes then 46,608 bytes that look
  encrypted (entropy 8.0; one changed setting changes every byte from a
  16-byte boundary on). It is deterministic: the same preset always gives the
  same bytes. Nobody here reads or writes that format, and nobody should try.
- The plugin's library files
  (`%APPDATA%\Line 6\Helix Native\#PRESET_LIBRARY\#SETLISTn\#PRESETnnn`)
  have the same size and header, but putting one into the state does **not**
  load it (the plugin falls back to an empty preset).
- What does work: a state captured after the plugin itself loaded a preset
  can be set on any other instance, and plays that preset.

So the only thing that turns a `.hlx` into a loadable state is the plugin's
own importer, and that is reachable only from its window.
`helixtone/native_host.py` is a helper process that does it:

1. Opens the plugin window, cloaked (nothing is drawn on screen) and with the
   keyboard focus handed straight back, so it does not disturb whoever is
   using the computer.
2. Selects a scratch slot (Factory 1, 01A), presses IMPORT, fills in the file
   dialog, answers "overwrite?" with Yes.
3. Presses EXPORT, so the caller can compare what the plugin took with what
   was sent. They match in everything under `tone` and in the name; only the
   device and application fields differ (Native writes its own).
4. Double-clicks the slot to load it and reads the plugin state.
5. On exit, puts the scratch slot's library files back as they were.

`NativeRenderer` keeps each state on disk under
`~/.helixtone/native-states/`, keyed by the preset's content, so a preset
costs the detour once (about 6 s) and nothing after that. A render of the 8 s
test signal takes about 1.5 s.

Things that were tried and do not work, so nobody repeats them:

- Posted clicks do not operate the plugin's popup menus (so "Open From
  Disk..." in the preset menu is out of reach); buttons and list rows work.
  A row needs a real `WM_LBUTTONDBLCLK` to load.
- A desktop of its own (`CreateDesktop`) hides everything, but the plugin's
  file dialogs never open there.
- pedalboard's reset between calls costs about 5 s with this plugin. The
  renderer avoids it: empty preset, half a second of silence, wanted preset,
  half a second of silence, then the audio. That is sample-identical whatever
  was rendered before; skipping the empty preset is not (a modulation's phase
  then depends on the previous render).

## Acceptance checks

`tests/test_native.py` runs only where Helix Native is usable. It holds the
renderer to this:

- The same preset renders to identical samples, whatever came between.
- A high-gain amp has a crest factor several dB below a clean one.
- A cab's `HighCut` at 3000 instead of 20000 lowers the measured top end.
- Every block bypassed measures close to the input.
- One snapshot's `ChVol` moves that snapshot's loudness and not the others'.
- The comparison of sent and exported preset catches a changed value.

Run it after any change to `helixtone/render.py` or
`helixtone/native_host.py`, and after a Helix Native update.

## When it stops working

- **"loads but is not processing audio"**: the plugin is signed out or the
  computer is not authorised. In that condition it passes the input through
  untouched and ignores its own level controls, which the renderer checks for
  at start-up. Open the window to look:
  `python -m helixtone.native_host "<path to .vst3>" --show`.
- **Signed in but stuck on the splash screen** ("Hi, <name>", no Authorize or
  trial panel). A known Helix Native problem. What cleared it here: signing in
  through HX Edit, and removing old computer authorisations on the Line 6
  account.
- **"editor did not open" or a timeout on a dialog** after a Helix Native
  update: the window layout may have moved. The click positions are at the
  top of `native_host.py`; run with `--show` and check them. The state cache
  is keyed by the plugin file, so an update starts a fresh cache.
- **"did not take the preset as sent"**: the plugin changed something on
  import. The two files are left in the cache folder for comparison. This is
  either a builder mistake (a value the plugin clamps or drops) or a model
  this version of Native lacks; fix the cause, do not loosen the check.
- The original library is backed up at
  `~/.helixtone/native-library-backup-2026-11-22`.

## Limits

- POD Go presets cannot be loaded in Helix Native. Retarget the spec to
  `helix_lt` to measure it (`inspect --spec -d helix_lt`), tune there, and
  carry the settings back; models and controls are shared.
- The built-in test signal is repeatable but is not a guitar. A real DI of
  each player's guitar belongs in `reference/di.wav` (and
  `reference/di-david.wav`).
- Native is not the hardware's output stage or the Powercab. Levels and
  balance carry over; how it feels in the room does not.
