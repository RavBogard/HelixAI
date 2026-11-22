"""Command line for helixtone. Run `python -m helixtone --help`."""
from __future__ import annotations

import argparse
import json
import os
import sys

from . import builder as buildmod
from . import catalog as catmod
from . import reader
from .spec import SpecError, load as load_spec

CATEGORIES = ["amp", "cab", "drive", "comp", "gate", "eq", "mod", "delay", "reverb", "pitch", "filter", "wah", "utility"]


def _show_value(p: dict, v) -> str:
    if p["unit"] == "generic_knob" and isinstance(v, (int, float)) and not isinstance(v, bool):
        return f"{v:g} (knob {v * 10:.1f})"
    if p["unit"] == "percent" and isinstance(v, (int, float)) and not isinstance(v, bool):
        return f"{v:g} ({v * 100:.0f}%)"
    return f"{v:g}" if isinstance(v, float) else str(v)


def _close(a, b) -> bool:
    """Presets hold 32-bit floats: 0.42 reads back as 0.41999998."""
    if isinstance(a, bool) or isinstance(b, bool) or not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return a == b
    return abs(a - b) <= 1e-5 * max(1.0, abs(a), abs(b))


def cmd_search(a) -> int:
    cat = catmod.get(a.device)
    hits = cat.search(" ".join(a.query), a.category)
    if not hits:
        print(f"nothing on {a.device} matches {' '.join(a.query)!r}" + (f" in {a.category}" if a.category else ""))
        return 1
    for mid in hits:
        b = cat.blocks[mid]
        d = b["dsp"]
        cost = f"{d['mono']:g}%" if not d["stereo"] else (f"{d['mono']:g}/{d['stereo']:g}%" if d["mono"] else f"{d['stereo']:g}%")
        print(f"{b['category']:<8} {b['name']:<24} {cost:>12}  {mid}")
        if b.get("based_on"):
            print(f"{'':<8} based on: {b['based_on']}")
    print(f"\n{len(hits)} model(s). DSP cost is percent of one processor (mono/stereo where both exist).")
    return 0


def cmd_show(a) -> int:
    cat = catmod.get(a.device)
    try:
        mid = cat.resolve(" ".join(a.model))
    except catmod.CatalogError as exc:
        print(exc)
        return 1
    b = cat.blocks[mid]
    print(f"{b['name']}  [{mid}]  {b['category']}" + (f" / {b['subcategory']}" if b.get("subcategory") else ""))
    if b.get("based_on"):
        print(f"based on: {b['based_on']}")
    d = b["dsp"]
    print(f"DSP: mono {d['mono']:g}%" + (f", stereo {d['stereo']:g}%" if d["stereo"] else ""))
    if b.get("cablink"):
        print(f"Line 6's default cab for it: {b['cablink']}")
    print("\ncontrols (values are what goes in a spec):")
    for key, p in b["params"].items():
        rng = f"{p['min']}..{p['max']}"
        help_ = catmod.UNIT_HELP.get(p["unit"], p["unit"] or "")
        print(f"  {key:<18} {p['type']:<6} {rng:<18} default {_show_value(p, p['default']):<22} {help_}")
    ex = catmod.exemplars_for(cat, mid)
    if ex:
        print(f"\nhow Line 6 set it in {len(ex)} factory preset(s) (only what differs from default):")
        dflt = cat.defaults(mid)
        for e in ex:
            diff = {k: v for k, v in e["params"].items() if k in dflt and not _close(v, dflt[k])}
            body = ", ".join(f"{k}={v:.3g}" if isinstance(v, float) else f"{k}={v}" for k, v in diff.items()) or "all defaults"
            print(f"  {e['preset']:<18} {body}")
    else:
        print("\nno factory preset uses this model; start from the defaults above.")
    return 0


def _print_result(res: buildmod.Result) -> None:
    cat = catmod.get(res.device.key)
    print(f"{res.name}  ->  {res.device.label}")
    for b in res.blocks:
        tags = []
        if b.stereo is not None:
            tags.append("stereo" if b.stereo else "mono")
        if b.footswitch is not None:
            tags.append("toe switch" if b.footswitch == res.device.toe_index else f"FS{b.footswitch}")
        for ctl, src, lo, hi in b.assigns:
            tags.append(f"{ctl} on {src.upper()}")
        if b.auto:
            tags.append("built-in, added")
        where = f"path {b.dsp + 1}, slot " if res.device.key == "helix_lt" else "slot "
        state = "on " if res.snapshots[0]["state"][b.id] else "off"
        cost = cat.load(b.model, bool(b.stereo))
        print(f"  {where}{b.position}  {state} {b.id:<10} {b.info['name']:<22} {cost:5.1f}%  {', '.join(tags)}")
    names = {"dsp0": "path 1" if res.device.key == "helix_lt" else "total", "dsp1": "path 2"}
    print("  DSP: " + ", ".join(f"{names[k]} {v:.0f}%" for k, v in res.loads.items() if v))
    if len(res.snapshots) > 1:
        for i, s in enumerate(res.snapshots):
            on = [bid for bid, st in s["state"].items() if st]
            sets = ", ".join(f"{bid}.{ctl}={v:g}" if isinstance(v, float) else f"{bid}.{ctl}={v}"
                             for (bid, ctl), v in s["values"].items())
            print(f"  snapshot {i + 1} {s['name']:<10} on: {', '.join(on)}" + (f"   set: {sets}" if sets else ""))
    for w in res.warnings:
        print(f"  note: {w}")


def cmd_build(a) -> int:
    status = 0
    for path in a.spec:
        try:
            spec = load_spec(path)
            res = buildmod.build(spec)
        except SpecError as exc:
            print(f"{path}: {exc}")
            status = 1
            continue
        except buildmod.BuildError as exc:
            print(f"{path}: not built, {len(exc.problems)} problem(s):\n{exc}")
            status = 1
            continue
        _print_result(res)
        if a.check:
            print("  (checked only, nothing written)\n")
            continue
        out_dir = a.out or os.path.dirname(os.path.abspath(path))
        os.makedirs(out_dir, exist_ok=True)
        out = os.path.join(out_dir, os.path.splitext(os.path.basename(path))[0] + res.device.extension)
        with open(out, "w", encoding="utf-8") as fh:
            json.dump(res.preset, fh, indent=1)
        print(f"  wrote {out}\n")
    return status


def cmd_inspect(a) -> int:
    presets = reader.load(a.file)
    if a.name:
        presets = [p for p in presets if a.name.lower() in p["name"].lower()]
    if not presets:
        print("no preset matched")
        return 1
    if a.list:
        for p in presets:
            n = len(reader.chain(p["tone"]))
            if n:
                print(f"{p['name']:<18} {n} blocks")
        return 0
    for p in presets:
        if not reader.chain(p["tone"]):
            continue
        if a.spec:
            print(json.dumps(reader.to_spec(p, a.device), indent=2))
        else:
            print(reader.describe(p))
            if not reader.is_single_path(p["tone"]):
                print("  (uses a second path or a linked cab; shown flattened)")
        print()
    return 0


def cmd_mics(a) -> int:
    print("legacy cab microphones (the '@mic' control), in the order the Helix manual lists them:")
    for i, m in enumerate(catmod.LEGACY_MICS):
        print(f"  {i:>2}  {m}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="helixtone", description="Build Helix LT and POD Go presets from tone specs.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("search", help="find models by name, the gear they are based on, or category")
    s.add_argument("query", nargs="*")
    s.add_argument("-d", "--device", default="helix_lt", choices=sorted(catmod.DEVICE_FILES))
    s.add_argument("-c", "--category", choices=CATEGORIES)
    s.set_defaults(fn=cmd_search)

    s = sub.add_parser("show", help="a model's controls, ranges, defaults and factory settings")
    s.add_argument("model", nargs="+")
    s.add_argument("-d", "--device", default="helix_lt", choices=sorted(catmod.DEVICE_FILES))
    s.set_defaults(fn=cmd_show)

    s = sub.add_parser("build", help="build preset file(s) from spec(s)")
    s.add_argument("spec", nargs="+")
    s.add_argument("-o", "--out", help="output directory (default: next to the spec)")
    s.add_argument("--check", action="store_true", help="validate and report without writing")
    s.set_defaults(fn=cmd_build)

    s = sub.add_parser("inspect", help="read a .hlx, .pgp or .hls and show what is in it")
    s.add_argument("file")
    s.add_argument("-n", "--name", help="only presets whose name contains this")
    s.add_argument("-l", "--list", action="store_true", help="list preset names only")
    s.add_argument("--spec", action="store_true", help="print as a tone spec to edit")
    s.add_argument("-d", "--device", choices=sorted(catmod.DEVICE_FILES), help="target device for --spec")
    s.set_defaults(fn=cmd_inspect)

    s = sub.add_parser("mics", help="list legacy cab microphone numbers")
    s.set_defaults(fn=cmd_mics)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
