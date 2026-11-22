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
        dflt = _show_value(p, p["default"])
        if p.get("choices"):
            dflt = f"{p['default']} ({cat.choice_name(mid, key, p['default'])})"
            shown = p["choices"] if len(p["choices"]) <= 20 else p["choices"][:20] + ["..."]
            help_ = "one of: " + ", ".join(shown) + "  (use the name or its number)"
        print(f"  {key:<18} {p['type']:<6} {rng:<18} default {dflt:<22} {help_}")
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
        lane = "B" if b.path else "A"
        where = f"{b.dsp + 1}{lane} col " if res.device.key == "helix_lt" else "slot "
        state = "on " if res.snapshots[0]["state"][b.id] else "off"
        cost = cat.load(b.model, bool(b.stereo))
        if b.dual:
            cost += cat.load(b.dual["model"])
            tags.append(f"dual with {b.dual['info']['name']}")
        if b.momentary:
            tags.append("momentary")
        print(f"  {where}{b.position}  {state} {b.id:<10} {b.info['name']:<22} {cost:5.1f}%  {', '.join(tags)}")
    names = {"dsp0": "processor 1" if res.device.key == "helix_lt" else "total", "dsp1": "processor 2"}
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
            topo = {reader.topology(p["tone"], d) for d in ("dsp0", "dsp1")}
            if topo - {"A", "SABJ"}:
                print("  (has paths with their own input or output; --spec flattens those)")
        print()
    return 0


# ---------------------------------------------------------------- measuring

def _di(a):
    from . import audio
    path = getattr(a, "di", None) or (os.path.join("reference", "di.wav") if os.path.exists(os.path.join("reference", "di.wav")) else None)
    if path:
        x, sr = audio.read_wav(path)
        print(f"  input: {path}")
        return audio.mono(x), sr
    print("  input: built-in test signal (synthetic; put a real DI recording at reference/di.wav to use that)")
    return audio.test_signal(), audio.SR


def _show_features(label, f):
    r = f["regions"]
    print(f"  {label:<14} loudness {f['loudness_db']:6.1f} dB  peak {f['peak_db']:6.1f}  crest {f['crest_db']:5.1f}  "
          f"centroid {f['centroid_hz']:6.0f} Hz  low {r['low']:5.1f}  mid {r['mid']:5.1f}  high {r['high']:5.1f}"
          + ("  CLIPPED" if f["clipped"] else ""))


def cmd_measure(a) -> int:
    from . import audio
    x, sr = audio.read_wav(a.file)
    got = audio.features(x, sr)
    _show_features(os.path.basename(a.file), got)
    if a.against:
        y, sr2 = audio.read_wav(a.against)
        want = audio.features(y, sr2)
        _show_features(os.path.basename(a.against), want)
        print(f"  distance {audio.distance(got, want)} (0 is identical in balance and dynamics; level is ignored)")
        for line in audio.describe_difference(got, want):
            print("   -", line)
    return 0


def cmd_signal(a) -> int:
    from . import audio
    audio.write_wav(a.out, audio.test_signal())
    print(f"wrote {a.out}")
    return 0


def _renderer(a):
    from . import render
    r = render.get(a.renderer, getattr(a, "folder", None))
    print(f"  renderer: {r.name}")
    if not r.is_real:
        print("  NOTE: these numbers are from a stand-in, not the Helix. Use them to test the workflow, not to judge or keep a tone.")
    return r


def _save_tuned(a, path, before, after, what):
    from . import history
    if not a.write:
        print("  (not written; add --write to keep these settings)")
        return
    history.record(path, before, "tuned", what)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(after, fh, indent=2)
        fh.write("\n")
    res = buildmod.build(after)
    out = os.path.splitext(path)[0] + res.device.extension
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(res.preset, fh, indent=1)
    print(f"  wrote {path} and {out}; the previous version is in {os.path.basename(history.path_for(path))}")


def cmd_tune(a) -> int:
    from . import audio, render, tune
    spec = load_spec(a.spec)
    try:
        r = _renderer(a)
        di, sr = _di(a)
        if a.what == "measure":
            ided = tune.with_ids(spec)
            for snap, f in zip(ided["snapshots"], tune.measure(spec, r, di, sr)):
                _show_features(snap["name"], f)
            return 0
        if a.what == "level":
            offsets = {}
            for item in a.offset or []:
                name, _, db = item.rpartition("=")
                offsets[name] = float(db)
            new, report = tune.level_match(spec, r, di, sr, offsets)
            for row in report:
                flag = "" if row["reached"] else "   (did not reach the target)"
                print(f"  {row['snapshot']:<10} {row['before_db']:6.1f} -> {row['after_db']:6.1f} dB (target {row['target_db']:.1f})"
                      f"   {row['control']} {row['from']} -> {row['to']}{flag}")
            _save_tuned(a, a.spec, spec, new, "level-matched snapshots by measurement" + ("" if r.is_real else " (stand-in renderer)"))
            return 0
        if a.what == "match":
            if not a.ref:
                print("match needs --ref <recording.wav> to aim at")
                return 1
            y, rsr = audio.read_wav(a.ref)
            target = audio.features(y, rsr)
            new, report = tune.match(spec, r, di, target, sr, a.knob or None, snapshot=a.snapshot - 1)
            print(f"  distance {report['distance_before']} -> {report['distance_after']} in {report['renders']} renders")
            for k, (was, now) in report["moved"].items():
                print(f"    {k}: {was} -> {now}")
            for line in report["remaining"]:
                print("    still:", line)
            _save_tuned(a, a.spec, spec, new, f"matched to {os.path.basename(a.ref)}: distance {report['distance_before']} -> {report['distance_after']}"
                        + ("" if r.is_real else " (stand-in renderer)"))
            return 0
    except render.RendererUnavailable as exc:
        print(f"cannot render: {exc}")
        return 2
    except (buildmod.BuildError, ValueError) as exc:
        print(f"{a.spec}: {exc}")
        return 1
    return 1


def cmd_note(a) -> int:
    from . import history
    spec = load_spec(a.spec)
    history.record(a.spec, spec, a.verdict, " ".join(a.text), a.who or "")
    print(f"recorded '{a.verdict}' for {a.spec} ({len(history.load(a.spec))} entries)")
    return 0


def cmd_history(a) -> int:
    from . import history
    rows = history.recent(a.root)
    if not rows:
        print("no history yet: record what you hear with `helixtone note <spec> --verdict ... <text>`")
        return 0
    for name, e in rows:
        print(f"{e['when'][:16]}  {e['verdict']:<7} {name:<32} {e['note']}")
    return 0


def cmd_learn(a) -> int:
    import glob
    from . import history
    files = [f for ext in ("hlx", "pgp", "hls") for f in glob.glob(os.path.join(a.dir, "**", f"*.{ext}"), recursive=True)]
    h = history.habits(files)
    if not h["presets"]:
        print(f"no presets found in {a.dir}: export some you like from HX Edit or POD Go Edit and put them there")
        return 1
    print(f"{h['presets']} preset(s), typically {h['median_blocks']:g} blocks")
    for c in ("amp", "cab", "drive", "comp", "mod", "delay", "reverb", "wah", "filter"):
        if h["models"].get(c):
            print(f"  {c:<7} " + ", ".join(f"{n} x{k}" for n, k in h["models"][c]))
    if h["settings"]:
        print("  where the controls usually sit (median) on models used more than once:")
        for name, ctl in h["settings"].items():
            print(f"    {name}: " + ", ".join(f"{k}={v:g}" for k, v in ctl.items()))
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

    s = sub.add_parser("measure", help="measure a recording, optionally against a target recording")
    s.add_argument("file")
    s.add_argument("--against", help="a target .wav to compare with")
    s.set_defaults(fn=cmd_measure)

    s = sub.add_parser("signal", help="write the built-in test signal to a .wav")
    s.add_argument("out")
    s.set_defaults(fn=cmd_signal)

    s = sub.add_parser("tune", help="adjust a tone by measurement (needs a renderer)")
    s.add_argument("what", choices=["measure", "level", "match"],
                   help="measure: show each snapshot's numbers; level: equalise snapshot loudness; "
                        "match: move controls toward a reference recording")
    s.add_argument("spec")
    s.add_argument("-r", "--renderer", default="native", choices=["native", "folder", "sim"])
    s.add_argument("--folder", help="hand-off folder for the folder renderer")
    s.add_argument("--di", help="dry guitar recording to play through the preset (default reference/di.wav, else a test signal)")
    s.add_argument("--offset", action="append", metavar="NAME=DB", help="level: make a snapshot this much louder than snapshot 1, e.g. Lead=2")
    s.add_argument("--ref", help="match: the recording to aim at")
    s.add_argument("--knob", action="append", metavar="BLOCK.CONTROL", help="match: a control to move (repeatable; default amp drive and tone, cab cuts)")
    s.add_argument("--snapshot", type=int, default=1, help="match: which snapshot to tune (1-based)")
    s.add_argument("--write", action="store_true", help="save the tuned spec and rebuild the preset")
    s.set_defaults(fn=cmd_tune)

    s = sub.add_parser("note", help="record what was heard about a tone")
    s.add_argument("spec")
    s.add_argument("text", nargs="*")
    s.add_argument("--verdict", required=True, choices=["keep", "change", "reject", "loaded", "failed"])
    s.add_argument("--who")
    s.set_defaults(fn=cmd_note)

    s = sub.add_parser("history", help="recent verdicts across all tones")
    s.add_argument("root", nargs="?", default="tones")
    s.set_defaults(fn=cmd_history)

    s = sub.add_parser("learn", help="summarise the presets in a folder: favoured models and settings")
    s.add_argument("dir", nargs="?", default="reference")
    s.set_defaults(fn=cmd_learn)

    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
