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

- **Structure:** the builder was checked by rebuilding 93 Line 6 factory
  presets and 52 real POD Go presets from their own settings and comparing
  every block. That is strong evidence the files are well-formed. No file from
  this tool has been loaded on a unit yet; the first import is the real test.
- **Sound:** nothing here can listen. A new preset is a first draft from gear
  knowledge and Line 6's factory settings. Expect to adjust by ear and tell
  Claude what you heard.
- **POD Go snapshots that change a control** (not just on/off) rely on one
  value taken from USB captures rather than from a preset file. The build
  prints a note when a preset uses it.

## Not built yet

Parallel paths, dual cabs, impulse responses, Helix send/return blocks,
command and momentary switches, and measuring audio through Helix Native
(`tools/native_probe.py` is the first step).

Data sources and licences are in [NOTICE.md](NOTICE.md).
