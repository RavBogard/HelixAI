"""The atlas: what every amp, cab and drive measures like, rendered through the real plugin.

A builder that knows only model names has to guess which amp is bright, how
much gain "Drive 0.6" is on this amp against that one, and how loud each comes
out. The atlas replaces the guesses with measurements, taken once per plugin
version and kept in atlas/helix-native.json:

  amps    the amp alone (no cab), at its default settings and with its drive
          controls at 0.25 and 0.75: loudness, crest factor (how squashed, so
          how much gain), and spectrum
  cabs    the cab alone on the dry signal: what it does to the spectrum
  drives  the pedal alone at its defaults

An amp and a cab are measured apart because a cab is close to a fixed filter:
the spectrum of a pair is, near enough, the amp's spectrum plus the cab's
change to it. `predict` does that sum, and `nearest` uses it to rank every
pair against a target sound without rendering each one. The ranking is a
shortlist to render and check, not a result.
"""
from __future__ import annotations

import json
import os
import time

import numpy as np

from . import audio
from . import catalog as catmod
from .builder import BuildError, build

DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "atlas", "helix-native.json")
DRIVE_CONTROLS = ("Drive", "BrtDrive", "NrmDrive", "Drive1", "Drive2", "Gain")
KEEP = ("loudness_db", "peak_db", "crest_db", "centroid_hz", "tilt_db_per_octave", "regions", "ltas", "clipped")


def _slim(f: dict) -> dict:
    return {k: f[k] for k in KEEP}


def plan(device: str = "helix_lt") -> list[dict]:
    """Every measurement the atlas holds, as (key, kind, model id, setting, spec)."""
    cat = catmod.get(device)
    jobs = []
    for mid, info in sorted(cat.blocks.items()):
        if not cat.selectable(mid):
            continue
        kind = info["category"]
        if kind == "amp":
            if "Preamp" in mid or info.get("family") != "amp":
                continue                      # a preamp is its amp without the power section
            drives = [c for c in DRIVE_CONTROLS if c in info["params"]]
            settings = [("default", {})] + ([("low", {c: 0.25 for c in drives}), ("high", {c: 0.75 for c in drives})] if drives else [])
        elif kind in ("cab", "drive"):
            settings = [("default", {})]
        else:
            continue
        for label, params in settings:
            jobs.append({"key": f"{mid}@{label}", "kind": kind, "model": mid, "setting": label,
                         "spec": {"name": "Atlas", "device": device,
                                  "chain": [{"id": "x", "model": mid, "params": params}],
                                  "snapshots": [{"name": "One"}]}})
    return jobs


def load(path: str = DEFAULT_PATH) -> dict:
    if not os.path.exists(path):
        return {"entries": {}, "failed": {}}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def save(atlas: dict, path: str = DEFAULT_PATH) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(atlas, fh, indent=0, sort_keys=True)
    os.replace(tmp, path)


def measure(renderer, path: str = DEFAULT_PATH, device: str = "helix_lt", limit: int | None = None,
            kinds: tuple = ("amp", "cab", "drive"), say=print) -> dict:
    """Fill in whatever the atlas lacks. Safe to stop and run again: it saves as it goes."""
    atlas = load(path)
    di = audio.test_signal()
    atlas.update({"device": device, "renderer": renderer.name, "signal": "built-in test signal",
                  "input": _slim(audio.features(di))})
    cat = catmod.get(device)
    todo = [j for j in plan(device) if j["kind"] in kinds and j["key"] not in atlas["entries"] and j["key"] not in atlas["failed"]]
    if limit:
        todo = todo[:limit]
    started = time.time()
    for n, job in enumerate(todo, 1):
        info = cat.blocks[job["model"]]
        try:
            out = renderer.render(build(job["spec"]).preset, di, audio.SR)
            entry = {"kind": job["kind"], "model": job["model"], "name": info["name"], "setting": job["setting"],
                     "based_on": info.get("based_on"), **_slim(audio.features(out))}
            if job["kind"] == "amp":
                entry["cablink"] = info.get("cablink")
            atlas["entries"][job["key"]] = entry
        except BuildError as exc:
            atlas["failed"][job["key"]] = "build: " + "; ".join(exc.problems if hasattr(exc, "problems") else [str(exc)])
        except Exception as exc:          # the renderer refusing a preset is a finding, not a reason to stop
            atlas["failed"][job["key"]] = str(exc)[:300]
        if n % 5 == 0 or n == len(todo):
            save(atlas, path)
            rate = (time.time() - started) / n
            say(f"  {n}/{len(todo)}  {info['name']} ({job['setting']})  about {rate * (len(todo) - n) / 60:.0f} min left")
    save(atlas, path)
    return atlas


# ------------------------------------------------------------------ using it

def predict(atlas: dict, amp_key: str, cab_key: str) -> dict:
    """The measured amp with the measured cab's change applied: a stand-in for rendering the pair."""
    amp, cab, dry = atlas["entries"][amp_key], atlas["entries"][cab_key], atlas["input"]
    ltas = np.array(amp["ltas"]) + (np.array(cab["ltas"]) - np.array(dry["ltas"]))
    power = 10 ** (ltas / 10)
    ltas = 10 * np.log10(power / power.sum())          # band levels are relative to the total
    return {"ltas": [round(float(v), 2) for v in ltas], "crest_db": amp["crest_db"],
            "loudness_db": round(amp["loudness_db"] + cab["loudness_db"] - dry["loudness_db"], 2)}


def nearest(atlas: dict, target: dict, count: int = 10, amps: list | None = None) -> list[dict]:
    """The amp settings and cabs whose predicted sound is closest to `target` (audio.features of a recording)."""
    entries = atlas["entries"]
    amp_keys = [k for k, e in entries.items() if e["kind"] == "amp" and (amps is None or e["name"] in amps or e["model"] in amps)]
    cab_keys = [k for k, e in entries.items() if e["kind"] == "cab"]
    ranked = []
    for a in amp_keys:
        for c in cab_keys:
            ranked.append((audio.distance(predict(atlas, a, c), target), a, c))
    ranked.sort()
    out, seen = [], set()
    for d, a, c in ranked:
        pair = (entries[a]["model"], entries[c]["model"])
        if pair in seen:
            continue                              # keep the best setting of each pair
        seen.add(pair)
        out.append({"distance": d, "amp": entries[a]["name"], "amp_model": entries[a]["model"], "setting": entries[a]["setting"],
                    "cab": entries[c]["name"], "cab_model": entries[c]["model"]})
        if len(out) >= count:
            break
    return out


def gain_ranking(atlas: dict) -> list[tuple]:
    """Amps from cleanest to most saturated at their default settings, by crest factor."""
    amps = [e for e in atlas["entries"].values() if e["kind"] == "amp" and e["setting"] == "default"]
    return sorted(((e["crest_db"], e["name"]) for e in amps), reverse=True)
