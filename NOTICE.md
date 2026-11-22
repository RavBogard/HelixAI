# Where the data comes from

`helixtone/data/` is derived from these sources by `tools/build_data.py`.
Nothing from Line 6's software is redistributed as a file; the data is model
names, ids, control ranges, defaults and DSP costs, plus settings of individual
blocks observed in presets.

| Data | Source | Licence |
| --- | --- | --- |
| Helix LT model catalog (HX Edit 3.82) | [retr0h/toneharness](https://github.com/retr0h/toneharness) | MIT |
| POD Go model catalog (POD Go Edit 2.50), blank POD Go preset, real `.pgp` files used to observe block types | [fargraph/pod-go-presets](https://github.com/fargraph/pod-go-presets) | MIT |
| Line 6 factory setlists as exported by Helix Native, used for block types, the blank Helix preset and per-block factory settings | [GhostNote17/HelixNativePresets](https://github.com/GhostNote17/HelixNativePresets) | MIT (the presets themselves are Line 6's) |
| Extra `.pgp` files used only to observe block types | [Ultchad/open-podgoedit](https://github.com/Ultchad/open-podgoedit), [Zavsek/POD_GO-Helix_converter](https://github.com/Zavsek/POD_GO-Helix_converter) | MIT / none stated |

POD Go format notes were cross-checked against the documentation in
fargraph/pod-go-presets, john-baxter-dev/fretwire and Ultchad/open-podgoedit.

Line 6, Helix, HX and POD Go are trademarks of Yamaha Guitar Group. This
project is not affiliated with or endorsed by them.
