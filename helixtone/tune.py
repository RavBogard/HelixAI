"""Adjust a tone by measurement instead of by ear.

Two jobs, both working on the spec so the result stays readable and editable:

  level_match   make every snapshot as loud as intended, by moving one level
                control per snapshot (the amp's channel volume by default)
  match         move chosen controls until the rendered sound is as close as
                it can get to a target recording's spectral balance and dynamics

Both need a renderer (helixtone/render.py). What they optimise is a measurement:
a closer number is not a promise of a better sound, so they report what moved
and by how much, and the player still gets the last word.
"""
from __future__ import annotations

import copy

import numpy as np

from . import audio
from . import catalog as catmod
from .builder import build

LEVEL_CONTROLS = ("ChVol", "Level", "Output")
DEFAULT_KNOBS = ("Drive", "BrtDrive", "NrmDrive", "Bass", "Mid", "Treble", "Presence", "Cut")
CAB_KNOBS = ("HighCut", "LowCut")


def with_ids(spec: dict) -> dict:
    """A copy of the spec in which every block carries the id the builder would give it."""
    res = build(spec)
    out = copy.deepcopy(spec)
    ids = iter([b.id for b in res.blocks if not b.auto])

    def walk(entries):
        for e in entries:
            if "split" in e:
                walk(e.get("a", []))
                walk(e.get("b", []))
            else:
                e["id"] = next(ids)
    walk(out["chain"])
    out.setdefault("snapshots", [{"name": "SNAPSHOT 1"}])
    return out


def blocks_of(spec: dict) -> dict:
    found = {}

    def walk(entries):
        for e in entries:
            if "split" in e:
                walk(e.get("a", []))
                walk(e.get("b", []))
            else:
                found[e["id"]] = e
    walk(spec["chain"])
    return found


def snapshot_preset(spec: dict, n: int) -> dict:
    """The preset as it sounds in snapshot n: built with that snapshot first, since a preset loads in snapshot 1."""
    s = copy.deepcopy(spec)
    snaps = s["snapshots"]
    s["snapshots"] = [snaps[n]] + snaps[:n] + snaps[n + 1:]
    return build(s).preset


def measure(spec: dict, renderer, di: np.ndarray, sr: int) -> list[dict]:
    spec = with_ids(spec)
    return [audio.features(renderer.render(snapshot_preset(spec, n), di, sr), sr)
            for n in range(len(spec["snapshots"]))]


def _level_target(spec: dict, cat) -> tuple[str, str]:
    """Which block and control to trim level with: the amp's channel volume if there is one."""
    blocks = blocks_of(spec)
    for want in ("amp", None):
        for bid, e in blocks.items():
            mid = cat.resolve(e["model"])
            info = cat.blocks[mid]
            if want and info["category"] != want:
                continue
            for ctl in LEVEL_CONTROLS:
                p = info["params"].get(ctl)
                if p and p["type"] == "float":
                    return bid, ctl
    raise ValueError("no block with a level control to trim (expected an amp with ChVol)")


def level_match(spec: dict, renderer, di: np.ndarray, sr: int = audio.SR, offsets: dict | None = None,
                tolerance: float = 0.3, max_steps: int = 8) -> tuple[dict, list[dict]]:
    """Trim each snapshot to the same loudness as snapshot 1, plus any offset asked for.

    offsets maps a snapshot name to dB relative to snapshot 1, e.g. {"Lead": 2.0}.
    Returns (new spec, report rows).
    """
    spec = with_ids(spec)
    cat = catmod.get(spec["device"])
    offsets = {k.lower(): v for k, v in (offsets or {}).items()}
    bid, ctl = _level_target(spec, cat)
    blk = blocks_of(spec)[bid]
    mid = cat.resolve(blk["model"])
    p = cat.blocks[mid]["params"][ctl]
    base_value = blk.get("params", {}).get(ctl, p["default"])

    def loudness(n):
        return audio.features(renderer.render(snapshot_preset(spec, n), di, sr), sr)["loudness_db"]

    def current(n):
        return spec["snapshots"][n].get("set", {}).get(bid, {}).get(ctl, base_value)

    def assign(n, value):
        spec["snapshots"][n].setdefault("set", {}).setdefault(bid, {})[ctl] = round(float(value), 4)

    reference = loudness(0)
    report = []
    for n, snap in enumerate(spec["snapshots"]):
        target = reference + offsets.get(snap["name"].lower(), 0.0)
        before = got = reference if n == 0 else loudness(n)
        start = value = current(n)
        steps = 0
        lo, hi = p["min"], p["max"]
        while abs(got - target) > tolerance and steps < max_steps and n > 0:
            steps += 1
            # bracket and bisect: the control is monotonic, its law is not known
            if got < target:
                lo = value
            else:
                hi = value
            # first step: guess from a 40 dB-per-unit law, then fall back to bisection
            guess = value + (target - got) / 40.0 if steps == 1 else (lo + hi) / 2
            value = min(max(guess, lo + 1e-4), hi - 1e-4) if lo < hi else value
            assign(n, value)
            got = loudness(n)
        report.append({"snapshot": snap["name"], "before_db": round(before, 2), "after_db": round(got, 2),
                       "target_db": round(target, 2), "control": f"{bid}.{ctl}",
                       "from": round(float(start), 3), "to": round(float(current(n)), 3),
                       "reached": abs(got - target) <= tolerance})
    return spec, report


def match(spec: dict, renderer, di: np.ndarray, target: dict, sr: int = audio.SR, knobs: list | None = None,
          rounds: int = 4, snapshot: int = 0) -> tuple[dict, dict]:
    """Move controls to bring the rendered sound closer to `target` (features of a reference recording).

    knobs is a list of "block.Control"; by default the amp's drive and tone controls and
    the cab's cuts. Coordinate search with a shrinking step: slow but dependable, and
    every evaluation is one render. Returns (new spec, report).
    """
    spec = with_ids(spec)
    cat = catmod.get(spec["device"])
    blocks = blocks_of(spec)
    if knobs is None:
        knobs = []
        for bid, e in blocks.items():
            info = cat.blocks[cat.resolve(e["model"])]
            names = DEFAULT_KNOBS if info["category"] == "amp" else CAB_KNOBS if info["category"] == "cab" else ()
            knobs += [f"{bid}.{k}" for k in names if k in info["params"]]
    plan = []
    for knob in knobs:
        bid, ctl = knob.split(".", 1)
        if bid not in blocks:
            raise ValueError(f"no block {bid!r}; blocks: {', '.join(blocks)}")
        mid = cat.resolve(blocks[bid]["model"])
        p = cat.blocks[mid]["params"].get(ctl)
        if not p or p["type"] != "float":
            raise ValueError(f"{knob} is not a continuous control")
        plan.append((bid, ctl, p))
    if not plan:
        raise ValueError("nothing to adjust: no amp or cab controls found, pass knobs explicitly")

    def get(bid, ctl, p):
        return blocks[bid].get("params", {}).get(ctl, p["default"])

    def put(bid, ctl, value):
        blocks[bid].setdefault("params", {})[ctl] = value

    evaluations = 0

    def score():
        nonlocal evaluations
        evaluations += 1
        return audio.distance(audio.features(renderer.render(snapshot_preset(spec, snapshot), di, sr), sr), target)

    start = {f"{b}.{c}": get(b, c, p) for b, c, p in plan}
    best = first = score()
    step = 0.2
    for _ in range(rounds):
        improved = False
        for bid, ctl, p in plan:
            span = p["max"] - p["min"]
            # frequencies are searched in octaves, everything else linearly
            log = p["min"] > 0 and p["max"] / p["min"] > 20
            here = get(bid, ctl, p)
            for direction in (+1, -1):
                trial = here * 2 ** (direction * step * 3) if log else here + direction * step * span
                trial = float(min(max(trial, p["min"]), p["max"]))
                if abs(trial - here) < 1e-9:
                    continue
                put(bid, ctl, round(trial, 4))
                got = score()
                if got < best - 0.02:
                    best, here, improved = got, trial, True
                else:
                    put(bid, ctl, here)
        if not improved:
            step /= 2
            if step < 0.02:
                break
    end = {f"{b}.{c}": get(b, c, p) for b, c, p in plan}
    final = audio.features(renderer.render(snapshot_preset(spec, snapshot), di, sr), sr)
    return spec, {"distance_before": first, "distance_after": best, "renders": evaluations,
                  "moved": {k: (round(start[k], 3), round(end[k], 3)) for k in end if abs(end[k] - start[k]) > 1e-6},
                  "remaining": audio.describe_difference(final, target)}
