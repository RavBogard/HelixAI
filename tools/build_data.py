"""Rebuild helixtone/data/ from upstream sources.

The data files are committed, so this only needs re-running when a source
changes (new firmware, new editor release). Sources are checkouts of public
repositories; pass the directory that holds them:

    python tools/build_data.py /path/to/sources

Expected under that directory:

    toneharness/        github.com/retr0h/toneharness        (MIT)
        model catalog extracted from HX Edit 3.82, one file per device
    pod-go-presets/     github.com/fargraph/pod-go-presets   (MIT)
        model catalog extracted from POD Go Edit 2.50, real .pgp presets
    HelixNativePresets/ github.com/GhostNote17/HelixNativePresets (MIT)
        Line 6 factory setlists as exported by Helix Native (.hls)
    open-podgoedit/     github.com/Ultchad/open-podgoedit    (MIT)  [optional]
    POD_GO-Helix_converter/                                  [optional]
        a few more real .pgp files, used only to observe block types

What is derived, and what is not copied:
  * catalogs: model ids, names, parameter ranges and defaults, DSP load.
  * observed attributes: which "@type" each model carries in real files.
  * exemplars: parameter settings of individual blocks in factory presets,
    so a tone can start from how Line 6 dialled a model. Whole presets are
    not stored.
  * skeletons: the blank "New Preset" structure for each device.
"""
from __future__ import annotations

import base64
import collections
import glob
import gzip
import json
import os
import re
import sys
import zlib

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "helixtone", "data")


def dump(name, obj):
    path = os.path.join(OUT, name)
    raw = json.dumps(obj, sort_keys=True, separators=(",", ":")).encode()
    with open(path, "wb") as fh:
        # mtime=0 keeps the output byte-identical between runs
        with gzip.GzipFile(fileobj=fh, mode="wb", mtime=0) as gz:
            gz.write(raw)
    print(f"wrote {name}: {len(raw):,} bytes raw, {os.path.getsize(path):,} gz")


def load_json_lenient(path):
    text = open(path, encoding="utf-8").read()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # a few community files carry trailing commas
        return json.loads(re.sub(r",(\s*[}\]])", r"\1", text))


def load_hls(path):
    outer = json.load(open(path, encoding="utf-8"))
    inner = json.loads(zlib.decompress(base64.b64decode(outer["encoded_data"])))
    return inner["presets"]


def blocks_of(tone):
    for dsp in ("dsp0", "dsp1"):
        for key, blk in (tone.get(dsp) or {}).items():
            if key.startswith("block") and isinstance(blk, dict) and "@model" in blk:
                yield dsp, key, blk


def norm_param(key, label, typ, lo, hi, default, unit):
    return {"label": label, "type": typ, "min": lo, "max": hi, "default": default, "unit": unit}


# ---------------------------------------------------------------- Helix LT

HELIX_TYPE_RULE = {"amp": 1, "delay": 7, "reverb": 7}


def build_helix(src):
    cat = json.load(gzip.open(os.path.join(src, "toneharness/pkg/sdk/catalog/data/helix-lt.json.gz")))
    presets = []
    for f in sorted(glob.glob(os.path.join(src, "HelixNativePresets/*.hls"))):
        presets += load_hls(f)
    real = [p for p in presets if any(True for _ in blocks_of(p["tone"]))]
    blank = next(p for p in presets if not any(True for _ in blocks_of(p["tone"])))

    seen_type = collections.defaultdict(collections.Counter)
    seen_attrs = collections.defaultdict(collections.Counter)
    exemplars = collections.defaultdict(list)
    fs_colour = collections.defaultdict(collections.Counter)
    for p in real:
        tone = p["tone"]
        for dsp, key, blk in blocks_of(tone):
            m = blk["@model"]
            seen_type[m][blk.get("@type")] += 1
            for a in blk:
                if a.startswith("@"):
                    seen_attrs[m][a] += 1
            params = {k: v for k, v in blk.items() if not k.startswith("@") or k == "@mic"}
            ex = {"preset": p["meta"]["name"], "enabled": blk.get("@enabled", True), "params": params}
            if ex["params"] not in [e["params"] for e in exemplars[m]]:
                exemplars[m].append(ex)
            fs = (tone.get("footswitch") or {}).get(dsp, {}).get(key)
            if fs and m in cat["blocks"] and fs.get("@fs_ledcolor") is not None:
                fs_colour[cat["blocks"][m]["category"]][fs["@fs_ledcolor"]] += 1

    blocks = {}
    for mid, b in cat["blocks"].items():
        cat_name, fam = b["category"], b.get("family")
        if cat_name == "cab":
            # a single cab block is type 2 whichever engine it uses; type 4 is
            # the first half of a dual cab, which we do not build
            typ, typ_src = 2, "observed"
        elif seen_type.get(mid):
            # an amp shows type 3 when a cab is linked to it; we always write
            # the cab as its own block, so the amp is type 1
            types = [t for t, _ in seen_type[mid].most_common() if not (cat_name == "amp" and t == 3)]
            typ = types[0] if types else 1
            typ_src = "observed"
        else:
            typ = HELIX_TYPE_RULE.get(cat_name, 0)
            typ_src = "rule"
        params = {
            k: norm_param(k, v.get("label", k), v["type"], v.get("min"), v.get("max"), v.get("default"), v.get("unit"))
            for k, v in b["params"].items()
        }
        if fam == "cab" and "@mic" not in params:
            # legacy cabs carry the microphone as a block attribute; HX Edit's
            # catalog leaves it out, real presets always have it (0..15)
            params["@mic"] = norm_param("@mic", "Mic", "int", 0, 15, 0, "mic")
        blocks[mid] = {
            "name": b["name"],
            "category": cat_name,
            "family": fam,
            "subcategory": b.get("subcategory"),
            "based_on": b.get("based_on"),
            "cablink": b.get("cablink"),
            "dsp": {"mono": b["dsp"]["mono"], "stereo": b["dsp"]["stereo"]},
            "type": typ,
            "type_source": typ_src,
            "params": params,
        }

    tone = blank["tone"]
    skeleton = {k: v for k, v in tone.items() if not k.startswith("snapshot")}
    skeleton["snapshot"] = tone["snapshot0"]
    dump("helix_lt.json.gz", {
        "device": "helix_lt",
        "source": cat["source"],
        "sources": cat["sources"],
        "destinations": cat["destinations"],
        "blocks": blocks,
        "fs_colour": {c: n.most_common(1)[0][0] for c, n in fs_colour.items()},
        "skeleton": skeleton,
    })
    dump("exemplars.json.gz", {m: v[:6] for m, v in sorted(exemplars.items())})
    return len(real)


# ------------------------------------------------------------------ POD Go

PODGO_CATEGORY = {
    "distortion": "drive", "modulation": "mod", "compressor": "comp", "gate": "gate",
    "delay": "delay", "reverb": "reverb", "pitch-synth": "pitch", "filter": "filter",
    "wah": "wah", "eq": "eq", "amp": "amp", "preamp": "amp", "cab": "cab",
    "cabmicirs": "cab", "volumepan": "utility", "sendreturn": "utility",
}
VALUE_TYPE = {0: "int", 1: "float", 2: "bool", 3: "string"}


def podgo_role(mid):
    for prefix, role in (("HD2_VolPan", "volume"), ("HD2_Wah", "wah"), ("HD2_FXLoop", "fxloop"),
                         ("HD2_EQ", "eq"), ("HD2_Looper", "looper"), ("HD2_Amp", "amp"),
                         ("HD2_Preamp", "amp"), ("HD2_Cab", "cab"), ("HD2_ImpulseResponse", "cab")):
        if mid.startswith(prefix):
            return role
    return None


def build_podgo(src):
    base = os.path.join(src, "pod-go-presets")
    cat = json.load(open(os.path.join(base, "registry/model-catalog/podgo-edit-2.50.json")))
    files = glob.glob(os.path.join(base, "**/*.pgp"), recursive=True)
    for extra in ("open-podgoedit/fixtures", "POD_GO-Helix_converter/sampleFiles"):
        files += glob.glob(os.path.join(src, extra, "*.pgp"))

    seen_type = collections.defaultdict(collections.Counter)
    fs_colour = collections.defaultdict(collections.Counter)
    n = 0
    for f in sorted(files):
        try:
            tone = load_json_lenient(f)["data"]["tone"]
        except Exception as exc:  # a handful of files in the library are deliberately broken
            print("skip", os.path.basename(f), exc)
            continue
        n += 1
        for dsp, key, blk in blocks_of(tone):
            m = blk["@model"]
            seen_type[m][blk.get("@type")] += 1
            fs = (tone.get("footswitch") or {}).get(dsp, {}).get(key)
            c = PODGO_CATEGORY.get((cat["models"].get(m) or {}).get("category"))
            if fs and c and fs.get("@fs_ledcolor") is not None:
                fs_colour[c][fs["@fs_ledcolor"]] += 1

    blocks = {}
    for mid, b in cat["models"].items():
        raw_cat = b["category"]
        if raw_cat not in PODGO_CATEGORY:
            continue  # fixed / io entries are structure, not blocks
        c = PODGO_CATEGORY[raw_cat]
        if seen_type.get(mid):
            typ, typ_src = seen_type[mid].most_common(1)[0][0], "observed"
        else:
            if c == "amp":
                typ = 1
            elif raw_cat == "cab":
                typ = 2
            elif c in ("delay", "reverb") or raw_cat == "sendreturn":
                typ = 5
            else:
                typ = 0
            typ_src = "rule"
        params = {}
        for p in b["params"]:
            key = p["symbolicID"]
            if key.startswith("@") and key != "@mic":
                continue    # block attributes (@enabled, @trails, @bypassvolume), written by the builder
            params[key] = norm_param(key, p["name"], VALUE_TYPE.get(p["valueType"], "float"),
                                     p["min"], p["max"], p["default"], p.get("displayType"))
        blocks[mid] = {
            "name": b["name"],
            "category": c,
            "family": raw_cat,
            "subcategory": None,
            "based_on": None,
            "cablink": b.get("cablink"),
            "dsp": {"mono": b.get("dsp_load") or 0, "stereo": 0},
            "type": typ,
            "type_source": typ_src,
            "role": podgo_role(mid),
            "pickable": bool(b.get("in_fx_picker")) or c in ("amp", "cab"),
            "params": params,
        }

    blank = load_json_lenient(os.path.join(base, "original/New-Preset-2_50_0.pgp"))["data"]["tone"]
    skeleton = {k: v for k, v in blank.items() if not k.startswith("snapshot")}
    skeleton["snapshot"] = blank["snapshot0"]
    dump("pod_go.json.gz", {
        "device": "pod_go",
        "source": "POD Go Edit 2.50",
        "blocks": blocks,
        "fs_colour": {c: n_.most_common(1)[0][0] for c, n_ in fs_colour.items()},
        "skeleton": skeleton,
    })
    return n


def backfill_based_on():
    """POD Go Edit's catalog has no 'based on' text; borrow it from the Helix one."""
    def rd(n):
        return json.load(gzip.open(os.path.join(OUT, n)))
    helix, podgo = rd("helix_lt.json.gz"), rd("pod_go.json.gz")
    hb = helix["blocks"]
    for mid, b in podgo["blocks"].items():
        twin = hb.get(mid) or hb.get(re.sub(r"(Mono|Stereo)$", "", mid))
        if twin:
            b["based_on"] = twin["based_on"]
            b["subcategory"] = twin["subcategory"]
            b["helix_id"] = mid if mid in hb else re.sub(r"(Mono|Stereo)$", "", mid)
    dump("pod_go.json.gz", podgo)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    os.makedirs(OUT, exist_ok=True)
    print("helix factory presets read:", build_helix(sys.argv[1]))
    print("pod go presets read:", build_podgo(sys.argv[1]))
    backfill_based_on()
