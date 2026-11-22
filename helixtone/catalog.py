"""Model catalogs for each device: what blocks exist and what their controls accept.

The data comes from the editors' own model databases (see tools/build_data.py),
so a model id or parameter key that is not in here does not exist on the device.
"""
from __future__ import annotations

import difflib
import functools
import gzip
import json
import os
import re

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

DEVICE_FILES = {"helix_lt": "helix_lt.json.gz", "pod_go": "pod_go.json.gz"}

# What the raw numbers in a preset mean, by the catalog's unit name.
UNIT_HELP = {
    "generic_knob": "0..1 shown as 0.0..10.0 on the device",
    "percent": "0..1 shown as 0..100%",
    "volume": "dB",
    "volume_eq": "dB",
    "frequency": "Hz",
    "cab_low_cut": "Hz",
    "cab_high_cut": "Hz",
    "eq_low_cut": "Hz",
    "eq_high_cut": "Hz",
    "mod_low_cut": "Hz",
    "mod_high_cut": "Hz",
    "time_ms": "seconds (0.35 = 350 ms)",
    "time_ms_reverb": "seconds",
    "off_on": "false/true",
    "pan": "0..1, 0.5 is centre",
    "sync_note": "note-division index, used when TempoSync1 is true",
    "cab_mic_distance": "inches",
    "mic": "microphone index, see `helixtone mics`",
    "percent_braced": "0..1 shown as 0..100%",
}

LEGACY_MICS = [
    "57 Dynamic", "409 Dynamic", "421 Dynamic", "30 Dynamic", "20 Dynamic", "121 Ribbon",
    "160 Ribbon", "4038 Ribbon", "414 Cond", "84 Cond", "67 Cond", "87 Cond", "47 Cond",
    "112 Dynamic", "12 Dynamic", "7 Dynamic",
]


class CatalogError(ValueError):
    pass


def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _strip_width(mid: str) -> str:
    return re.sub(r"(Mono|Stereo|WithPan)(?=(V\d+)?$)", "", mid)


class Catalog:
    def __init__(self, device: str):
        if device not in DEVICE_FILES:
            raise CatalogError(f"unknown device {device!r}; known: {sorted(DEVICE_FILES)}")
        with gzip.open(os.path.join(DATA, DEVICE_FILES[device]), "rt", encoding="utf-8") as fh:
            raw = json.load(fh)
        self.device = device
        self.source = raw["source"]
        self.blocks: dict[str, dict] = raw["blocks"]
        self.fs_colour: dict[str, int] = raw["fs_colour"]
        self.skeleton: dict = raw["skeleton"]
        self._by_name: dict[str, list[str]] = {}
        for mid, b in self.blocks.items():
            self._by_name.setdefault(_norm(b["name"]), []).append(mid)

    # -- lookup -----------------------------------------------------------

    def selectable(self, mid: str) -> bool:
        """False for ids that exist in the catalog but should not be picked directly."""
        b = self.blocks[mid]
        if b["family"] in ("io", "fixed"):
            return False    # inputs, outputs, splits: structure, not blocks
        if b["family"] == "cabmicirswithpan":
            # the halves of a dual cab; a single cab block uses the plain id
            return False
        return True

    def resolve(self, ref: str, category: str | None = None) -> str:
        """Turn a model id or display name into a model id, or explain why not."""
        if ref in self.blocks and self.selectable(ref):
            return ref
        cands = [m for m in self._by_name.get(_norm(ref), []) if self.selectable(m)]
        if not cands:
            # an id from the other device: same model, width written differently
            # (HD2_DelayVintageDigitalV2 on the Helix, ...DigitalStereoV2 on the POD Go)
            stem = _strip_width(ref)
            cands = [m for m in self.blocks if self.selectable(m) and _strip_width(m) == stem]
        if category:
            narrowed = [m for m in cands if self.blocks[m]["category"] == category]
            cands = narrowed or cands
        if len(cands) > 1:
            # one name, two models: the full amp beats its preamp-only version,
            # and the current cab engine beats the legacy cab of the same name
            for preferred in ("amp", "cabmicirs"):
                best = [m for m in cands if self.blocks[m]["family"] == preferred]
                if len(best) == 1:
                    cands = best
                    break
        if len(cands) == 1:
            return cands[0]
        if len(cands) > 1:
            listing = ", ".join(f"{m} ({self.blocks[m]['category']}/{self.blocks[m]['family']})" for m in cands)
            raise CatalogError(f"{ref!r} is ambiguous on {self.device}: {listing}. Use the id.")
        names = sorted({b["name"] for b in self.blocks.values()})
        near = difflib.get_close_matches(ref, names + list(self.blocks), n=5, cutoff=0.5)
        hint = f" Close: {', '.join(near)}." if near else ""
        raise CatalogError(f"no model {ref!r} on {self.device}.{hint} Try `helixtone search`.")

    def search(self, query: str = "", category: str | None = None) -> list[str]:
        words = [w for w in re.split(r"\s+", query.lower().strip()) if w]
        out = []
        for mid, b in self.blocks.items():
            if not self.selectable(mid):
                continue
            if category and b["category"] != category:
                continue
            hay = " ".join(str(x) for x in (mid, b["name"], b.get("based_on") or "",
                                             b.get("subcategory") or "", b["family"] or "")).lower()
            if all(w in hay for w in words):
                out.append(mid)
        return sorted(out, key=lambda m: (self.blocks[m]["category"], self.blocks[m]["name"]))

    # -- facts about a block ---------------------------------------------

    def has_width_choice(self, mid: str) -> bool:
        d = self.blocks[mid]["dsp"]
        return self.device == "helix_lt" and d["mono"] > 0 and d["stereo"] > 0

    def load(self, mid: str, stereo: bool = False) -> float:
        """DSP cost in percent of one processor."""
        d = self.blocks[mid]["dsp"]
        if stereo and d["stereo"] > 0:
            return d["stereo"]
        return d["mono"] if d["mono"] > 0 else d["stereo"]

    def check_param(self, mid: str, key: str, value):
        """Return the value coerced to the catalog's type, or raise CatalogError."""
        params = self.blocks[mid]["params"]
        if key not in params:
            near = difflib.get_close_matches(key, list(params), n=4, cutoff=0.4)
            raise CatalogError(
                f"{self.blocks[mid]['name']} has no control {key!r}. "
                f"Controls: {', '.join(params)}." + (f" Did you mean {near[0]}?" if near else ""))
        p = params[key]
        typ, lo, hi = p["type"], p["min"], p["max"]
        if typ == "bool":
            if not isinstance(value, bool):
                raise CatalogError(f"{mid}.{key} is on/off: use true or false, not {value!r}")
            return value
        if typ == "string":
            return value
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise CatalogError(f"{mid}.{key} is a number, got {value!r}")
        if typ == "int":
            if float(value) != int(value):
                raise CatalogError(f"{mid}.{key} takes whole numbers, got {value!r}")
            value = int(value)
        # presets store 32-bit floats, so 19.9 reads back as 19.899999618...
        slack = 1e-5 * max(1.0, abs(value))
        if isinstance(lo, (int, float)) and not isinstance(lo, bool) and value < lo - slack:
            raise CatalogError(f"{mid}.{key} = {value} is below its minimum {lo} ({p['unit']})")
        if isinstance(hi, (int, float)) and not isinstance(hi, bool) and value > hi + slack:
            raise CatalogError(f"{mid}.{key} = {value} is above its maximum {hi} ({p['unit']})")
        return value

    def defaults(self, mid: str) -> dict:
        return {k: p["default"] for k, p in self.blocks[mid]["params"].items()}


@functools.lru_cache(maxsize=None)
def get(device: str) -> Catalog:
    return Catalog(device)


@functools.lru_cache(maxsize=None)
def exemplars() -> dict:
    """Settings of individual blocks as Line 6 dialled them in factory presets (Helix ids)."""
    with gzip.open(os.path.join(DATA, "exemplars.json.gz"), "rt", encoding="utf-8") as fh:
        return json.load(fh)


def exemplars_for(cat: Catalog, mid: str) -> list[dict]:
    ex = exemplars()
    if mid in ex:
        return ex[mid]
    twin = cat.blocks[mid].get("helix_id") or re.sub(r"(Mono|Stereo)$", "", mid)
    return ex.get(twin, [])
