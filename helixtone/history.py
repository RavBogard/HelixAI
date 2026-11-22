"""What was tried and what the player said: one history file beside each spec.

`tones/<player>/<name>.history.json` is a list of entries, oldest first. Each
holds the spec as it was, a verdict and a note, so a later session can see what
was rejected and why, and can go back to a version that was liked.
"""
from __future__ import annotations

import datetime
import glob
import json
import os
import statistics

from . import catalog as catmod
from . import reader

VERDICTS = ("keep", "change", "reject", "loaded", "failed", "tuned")


def path_for(spec_path: str) -> str:
    return os.path.splitext(spec_path)[0] + ".history.json"


def load(spec_path: str) -> list[dict]:
    p = path_for(spec_path)
    if not os.path.exists(p):
        return []
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def record(spec_path: str, spec: dict, verdict: str, note: str = "", who: str = "") -> dict:
    if verdict not in VERDICTS:
        raise ValueError(f"verdict must be one of {VERDICTS}")
    entries = load(spec_path)
    entry = {"when": datetime.datetime.now().isoformat(timespec="seconds"), "verdict": verdict,
             "note": note, "who": who, "spec": spec}
    entries.append(entry)
    with open(path_for(spec_path), "w", encoding="utf-8") as fh:
        json.dump(entries, fh, indent=1)
    return entry


def recent(root: str, limit: int = 30) -> list[tuple[str, dict]]:
    rows = []
    for p in glob.glob(os.path.join(root, "**", "*.history.json"), recursive=True):
        with open(p, encoding="utf-8") as fh:
            for e in json.load(fh):
                rows.append((os.path.relpath(p[: -len(".history.json")], root), e))
    rows.sort(key=lambda r: r[1]["when"], reverse=True)
    return rows[:limit]


def habits(files: list[str]) -> dict:
    """What a set of presets has in common: favoured models and where their controls sit."""
    use: dict = {}
    settings: dict = {}
    sizes = []
    for f in files:
        try:
            presets = reader.load(f)
        except Exception:
            continue
        for p in presets:
            blocks = reader.chain(p["tone"])
            if not blocks:
                continue
            device = reader.DEVICE_BY_ID.get(p["device"], "helix_lt")
            cat = catmod.get(device)
            sizes.append(len(blocks))
            for dsp, _key, blk in blocks:
                both = [blk] + ([reader.linked_cab(p["tone"], dsp, blk)] if blk.get("@cab") else [])
                for b in both:
                    info = cat.blocks.get((b or {}).get("@model"))
                    if not info:
                        continue
                    name = info["name"]
                    use.setdefault(info["category"], {}).setdefault(name, 0)
                    use[info["category"]][name] += 1
                    for k, v in b.items():
                        if k in info["params"] and isinstance(v, (int, float)) and not isinstance(v, bool):
                            settings.setdefault((info["category"], name), {}).setdefault(k, []).append(v)
    out = {"presets": len(sizes), "median_blocks": statistics.median(sizes) if sizes else 0, "models": {}, "settings": {}}
    for c, names in use.items():
        out["models"][c] = sorted(names.items(), key=lambda kv: -kv[1])[:8]
    for (c, name), ctl in settings.items():
        if c in ("amp", "cab") and use[c][name] >= 2:
            out["settings"][name] = {k: round(statistics.median(v), 3) for k, v in ctl.items()}
    return out
