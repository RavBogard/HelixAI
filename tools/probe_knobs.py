"""Find which controller number in a preset is each of Helix Native's host-automation knobs.

No real preset we hold uses them, so the number cannot be read from a file.
This asks the plugin itself: build a preset whose amp Channel Volume is on
candidate controller N, load it, turn the plugin's automation parameters from
the host and see whether the level moves.

    python tools/probe_knobs.py            list the plugin's host parameters
    python tools/probe_knobs.py 3 60       try controllers 3..60

Used only for measuring (helixtone/render.py); nothing found here is written
into a preset a player loads.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from helixtone import audio, build, render  # noqa: E402


def preset_with(controller: int) -> dict:
    spec = {"name": f"probe {controller}", "device": "helix_lt",
            "chain": [{"id": "amp", "model": "US Deluxe Nrm", "params": {"Drive": 0.5, "ChVol": 0.5}},
                      {"id": "cab", "model": "1x12 US Deluxe"}]}
    p = build(spec).preset
    tone = p["data"]["tone"]
    tone.setdefault("controller", {}).setdefault("dsp0", {})["block0"] = {
        "ChVol": {"@controller": controller, "@min": 0.0, "@max": 1.0, "@snapshot_disable": False}}
    return p


def main(argv):
    r = render.NativeRenderer()
    names = list(r.plugin.parameters)
    if not argv:
        for n in names:
            par = r.plugin.parameters[n]
            print(f"  {n:<32} {getattr(par, 'raw_value', '')!s:<8} {getattr(par, 'name', '')}")
        r.close()
        return
    lo, hi = int(argv[0]), int(argv[1])
    di = audio.test_signal(seconds=2.0)
    hosts = [n for n in names if n not in ("bypass", "master_output_level_db", "master_input_level_db")]
    for c in range(lo, hi + 1):
        try:
            r.load_preset(preset_with(c), audio.SR)
        except Exception as exc:        # the plugin refused the file: that number means nothing to it
            print(f"controller {c}: not loaded ({str(exc)[:80]})", flush=True)
            continue
        x = np.stack([di, di]).astype(np.float32)
        base = audio.features(r.plugin(x, audio.SR, reset=False)[0], audio.SR)["loudness_db"]
        hits = []
        was = {n: r.plugin.parameters[n].raw_value for n in hosts}

        def level_with(values: dict) -> float:
            for n, v in values.items():
                r.plugin.parameters[n].raw_value = v
            r.plugin(x[:, :4800], audio.SR, reset=False)
            return audio.features(r.plugin(x, audio.SR, reset=False)[0], audio.SR)["loudness_db"] - base

        # all of them down, then all up: two renders say whether any of them is this controller
        swing = [level_with({n: v for n in hosts}) for v in (0.0, 1.0)]
        level_with(was)
        if max(abs(d) for d in swing) > 1.0:
            for n in hosts:
                d = [level_with({n: v}) for v in (0.0, 1.0)]
                level_with({n: was[n]})
                if max(abs(v) for v in d) > 1.0:
                    hits.append((n, [round(v, 1) for v in d]))
        print(f"controller {c}: {hits or 'nothing moved'}", flush=True)
    r.close()


if __name__ == "__main__":
    main(sys.argv[1:])
