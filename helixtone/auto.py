"""Build a tone toward a target sound with nobody listening, and keep score of how well that goes.

`match_recording` is the loop:

  1. measure the target (a recording of the sound wanted)
  2. shortlist amp and cab pairs whose measured character is closest (the atlas)
  3. render the shortlist for real and keep the best few
  4. move the amp and cab controls of each toward the target (tune.match)
  5. return the closest as a spec, with what was tried

`bench` is how the loop is judged without a person: it hides a preset, renders
it, hands the loop only the audio, and scores how close the loop gets. The
score is recorded in atlas/bench.jsonl, so a change to the atlas, the
shortlist or the search can be shown to help or not. What it cannot score is
whether a tone is good to play; that still takes ears.

The measure is balance and dynamics over the test signal. Two sounds can be
close on it and still feel different (pick attack, the way a note blooms), so
a close match is a strong first draft, not a finished tone.
"""
from __future__ import annotations

import copy
import json
import os
import random
import time

import numpy as np

from . import atlas as atlasmod
from . import audio, tune
from . import catalog as catmod
from .builder import build

BENCH_LOG = os.path.join(os.path.dirname(atlasmod.DEFAULT_PATH), "bench.jsonl")


def _spec(name: str, device: str, amp: str, amp_params: dict, cab: str, cab_params: dict | None = None) -> dict:
    return {"name": name[:16], "device": device,
            "chain": [{"id": "amp", "model": amp, "params": dict(amp_params)},
                      {"id": "cab", "model": cab, "params": dict(cab_params or {})}],
            "snapshots": [{"name": "Main"}]}


def _setting_params(cat, amp_model: str, setting: str) -> dict:
    value = {"low": 0.25, "high": 0.75}.get(setting)
    if value is None:
        return {}
    return {c: value for c in atlasmod.DRIVE_CONTROLS if c in cat.blocks[amp_model]["params"]}


def match_recording(target: dict, renderer, atlas: dict, di: np.ndarray | None = None, name: str = "Matched",
                    device: str = "helix_lt", shortlist: int = 8, refine: int = 2, rounds: int = 3, say=print) -> tuple[dict, dict]:
    """Returns (spec, report). `target` is audio.features of the sound wanted."""
    di = audio.test_signal() if di is None else di
    cat = catmod.get(device)
    started, renders = time.time(), 0
    tried = []
    for cand in atlasmod.nearest(atlas, target, count=shortlist):
        spec = _spec(name, device, cand["amp_model"], _setting_params(cat, cand["amp_model"], cand["setting"]), cand["cab_model"])
        got = audio.features(renderer.render(tune.snapshot_preset(tune.with_ids(spec), 0), di, audio.SR))
        renders += 1
        tried.append({"amp": cand["amp"], "cab": cand["cab"], "setting": cand["setting"],
                      "predicted": cand["distance"], "rendered": audio.distance(got, target), "spec": spec})
        say(f"  {cand['amp']} + {cand['cab']} ({cand['setting']}): predicted {cand['distance']:.2f}, rendered {tried[-1]['rendered']:.2f}")
    tried.sort(key=lambda t: t["rendered"])
    best = None
    for cand in tried[:refine]:
        tuned, rep = tune.match(cand["spec"], renderer, di, target, rounds=rounds)
        renders += rep["renders"]
        cand["tuned"] = rep["distance_after"]
        say(f"  tuned {cand['amp']} + {cand['cab']}: {rep['distance_before']:.2f} -> {rep['distance_after']:.2f}")
        if best is None or rep["distance_after"] < best[1]["distance_after"]:
            best = (tuned, rep, cand)
    spec, rep, cand = best
    report = {"distance": rep["distance_after"], "amp": cand["amp"], "cab": cand["cab"], "remaining": rep["remaining"],
              "renders": renders, "seconds": round(time.time() - started, 1),
              "tried": [{k: v for k, v in t.items() if k != "spec"} for t in tried]}
    return spec, report


# ------------------------------------------------------------------ keeping score

def hidden_targets(count: int, seed: int, device: str = "helix_lt", atlas: dict | None = None) -> list[dict]:
    """Presets to hide from the loop: a guitar amp and a cab at settings a player might use."""
    cat = catmod.get(device)
    rng = random.Random(seed)
    amps = sorted({e["model"] for e in (atlas or {}).get("entries", {}).values() if e["kind"] == "amp"}) or \
        sorted(m for m, i in cat.blocks.items() if i["category"] == "amp" and i.get("family") == "amp" and "Preamp" not in m)
    cabs = sorted({e["model"] for e in (atlas or {}).get("entries", {}).values() if e["kind"] == "cab"}) or \
        sorted(m for m, i in cat.blocks.items() if i["category"] == "cab" and cat.selectable(m))
    out = []
    for n in range(count):
        amp, cab = rng.choice(amps), rng.choice(cabs)
        params = {}
        for ctl, p in cat.blocks[amp]["params"].items():
            if ctl in atlasmod.DRIVE_CONTROLS or ctl in ("Bass", "Mid", "Treble", "Presence"):
                params[ctl] = round(rng.uniform(0.2, 0.8), 2)
        out.append(_spec(f"Hidden {n + 1}", device, amp, params, cab))
    return out


def bench(renderer, atlas: dict, count: int = 5, seed: int = 1, label: str = "", log: str | None = BENCH_LOG, say=print, **kw) -> dict:
    """Hide `count` presets, let the loop match each from audio alone, and record how close it got."""
    di = audio.test_signal()
    cat = catmod.get("helix_lt")
    rows = []
    for hidden in hidden_targets(count, seed, atlas=atlas):
        target = audio.features(renderer.render(build(hidden).preset, di, audio.SR))
        amp = cat.blocks[cat.resolve(hidden["chain"][0]["model"])]["name"]
        cab = cat.blocks[cat.resolve(hidden["chain"][1]["model"])]["name"]
        say(f"hidden: {amp} + {cab}")
        _spec_found, rep = match_recording(target, renderer, atlas, di, say=say, **kw)
        rows.append({"hidden_amp": amp, "hidden_cab": cab, "found_amp": rep["amp"], "found_cab": rep["cab"],
                     "distance": rep["distance"], "first_guess": rep["tried"][0]["rendered"] if rep["tried"] else None,
                     "renders": rep["renders"], "seconds": rep["seconds"]})
        say(f"  -> {rep['amp']} + {rep['cab']}, distance {rep['distance']:.2f} in {rep['seconds']:.0f} s")
    result = {"when": time.strftime("%Y-%m-%d %H:%M"), "label": label, "seed": seed, "count": count,
              "mean_distance": round(float(np.mean([r["distance"] for r in rows])), 3),
              "worst_distance": round(float(np.max([r["distance"] for r in rows])), 3),
              "mean_seconds": round(float(np.mean([r["seconds"] for r in rows])), 1),
              "same_amp": sum(r["hidden_amp"] == r["found_amp"] for r in rows), "rows": rows}
    if log:
        with open(log, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(result) + "\n")
    return result
