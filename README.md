# helixtone

Describe a guitar sound, get a preset for a Line 6 **Helix LT** or **POD Go**.

It is built to be driven by Claude: you say what you want ("something U2-like
with a wah", "Fender amp, filters, funky for David's Jazzmaster"), Claude
writes a small tone spec, and `helixtone` turns that into a `.hlx` or `.pgp`
you import with HX Edit or POD Go Edit.

## Use it

Open this folder in Claude Code and ask for a tone. The `helix-tone` skill
does the rest. By hand:

```
python -m helixtone search fender deluxe            # find models by name or the gear they copy
python -m helixtone show "US Deluxe Vib" -d pod_go  # controls, ranges, Line 6's own settings
python -m helixtone build tones/daniel-lt/edge-wah.json
python -m helixtone inspect reference/MyPreset.hlx  # read a preset you already have
```

Needs Python 3.10 or newer and nothing else.

## Tuning by measurement

```
python -m helixtone tune measure tones/daniel-lt/hendrix.json     # loudness and balance of each snapshot
python -m helixtone tune level tones/daniel-lt/hendrix.json --offset "Octave Ld=2" --write
python -m helixtone tune match <spec> --ref target.wav --write    # move amp and cab controls toward a recording
python -m helixtone note <spec> --verdict change "too bright"     # record what you heard
python -m helixtone learn reference                               # what your own presets favour
```

These need `numpy` and a renderer that turns a preset into audio. The Helix
Native renderer is the intended one and is **not finished**: getting a preset
into the plugin from a script has to be worked out on a machine that has it.
`.claude/skills/helix-tone/references/native-setup.md` is that job, written
for a Claude Code session on your PC. Until then `-r sim` runs the same code on
a crude stand-in, for testing only.

## What is in here

| Path | What |
| --- | --- |
| `helixtone/` | the engine: catalogs, spec checks, the builders, a preset reader |
| `tones/` | specs and the presets built from them, one folder per player and device |
| `rig/` | who plays what into what, and what they have said about past tones |
| `reference/` | your own exported presets (not committed) |
| `.claude/skills/helix-tone/` | how Claude goes from a description to a spec |
| `tools/` | rebuilding the data, and the first Helix Native experiment |

## How far to trust a preset

- **Structure:** the builder was checked by rebuilding 185 Line 6 factory
  presets (44 with parallel paths, 57 with dual cabs) and 52 real POD Go
  presets from their own settings and comparing every block. That is strong evidence the files are well-formed. No file from
  this tool has been loaded on a unit yet; the first import is the real test.
- **Sound:** until the Helix Native renderer is finished, a new preset is an
  unmeasured first draft from gear knowledge and Line 6's factory settings.
  Once it is, levels and balance are measured; whether you like it is still
  yours to say.
- **POD Go snapshots that change a control** (not just on/off) rely on one
  value taken from USB captures rather than from a preset file. The build
  prints a note when a preset uses it.

## Not built yet

Impulse responses, Helix send/return blocks, command switches, a second
instrument on its own path, and loading presets into Helix Native from a
script (see above).

Data sources and licences are in [NOTICE.md](NOTICE.md).
