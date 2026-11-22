"""One page per preset: what each snapshot and switch does, and what was measured.

Written beside the preset as `<name>.md` by `helixtone check`. Everything on it
comes from the spec and the build; the measured table is there only when a
renderer ran, and says which.
"""
from __future__ import annotations

import datetime
import os

from . import builder as buildmod
from . import catalog as catmod

LT_ROWS = (("top row", (2, 3, 4, 5)), ("bottom row", (8, 9, 10, 11)))
PODGO_ROWS = (("switches", (1, 2, 3, 4, 5, 6)),)


def _val(v) -> str:
    if isinstance(v, bool):
        return "on" if v else "off"
    if isinstance(v, float):
        return f"{v:.3g}"
    return str(v)


def text(spec: dict, feats: list[dict] | None = None, findings: list[dict] | None = None,
         stomp_rows: list[dict] | None = None, renderer_name: str = "", preset_file: str = "") -> str:
    res = buildmod.build(spec)
    dev = res.device
    cat = catmod.get(dev.key)
    by_id = {b.id: b for b in res.blocks}
    out = [f"# {res.name}", "", f"{dev.label} preset" + (f", file `{preset_file}`" if preset_file else "") + ".", ""]
    if spec.get("notes"):
        out += [spec["notes"], ""]

    out += ["## Snapshots", ""]
    head = "| # | name | switches in | sets |" + (" loudness | peak |" if feats else "")
    out += [head, "|---|---|---|---|" + ("---|---|" if feats else "")]
    base = res.snapshots[0]["state"]
    for i, s in enumerate(res.snapshots):
        on = [bid for bid, st in s["state"].items() if st and not base.get(bid)] if i else []
        off = [bid for bid, st in s["state"].items() if not st and base.get(bid)] if i else []
        moves = ", ".join(on + [f"{b} off" for b in off]) or ("(the preset loads here)" if i == 0 else "")
        sets = ", ".join(f"{bid} {ctl} {_val(v)}" for (bid, ctl), v in s["values"].items())
        row = f"| {i + 1} | {s['name']} | {moves} | {sets} |"
        if feats:
            row += f" {feats[i]['loudness_db']:.1f} dB | {feats[i]['peak_db']:.1f} dB |"
        out.append(row)
    out.append("")

    out += ["## Stomp switches", ""]
    stay = [b for b in res.blocks if b.stays and b.footswitch is not None]
    if stay:
        out += ["A stomp keeps the state your foot gave it when you change snapshot.", ""]
    for label, switches in (LT_ROWS if dev.key == "helix_lt" else PODGO_ROWS):
        cells = []
        for sw in switches:
            here = [b for b in res.blocks if b.footswitch == sw]
            if here:
                cells.append(f"**FS{sw}** " + " + ".join(f"{b.id} ({b.info['name']}, {'on' if base[b.id] else 'off'} at load"
                                                            + (", held" if b.momentary else "") + ")" for b in here))
            else:
                cells.append(f"FS{sw} free")
        out.append(f"- {label}: " + " | ".join(cells))
    out.append("")

    pedal = [(b, ctl, src) for b in res.blocks for ctl, src, _lo, _hi in b.assigns]
    if pedal:
        out += ["## Pedal", ""]
        for b, ctl, src in pedal:
            out.append(f"- {src.upper()}: {b.id} ({b.info['name']}) {ctl}" + (", switched by the toe switch" if b.footswitch == dev.toe_index else ""))
        out.append("")

    out += ["## Signal chain", ""]
    for b in res.blocks:
        dflt = cat.defaults(b.model)
        moved = ", ".join(f"{k} {_val(v)}" for k, v in b.params.items()
                          if k in dflt and v != dflt[k] and not (isinstance(v, float) and abs(v - dflt[k]) < 1e-6))
        extra = f" + {b.dual['info']['name']} (" + ", ".join(f"{k} {_val(v)}" for k, v in b.dual["params"].items()
                                                              if v != cat.defaults(b.dual["model"]).get(k)) + ")" if b.dual else ""
        owner = "stomp" if b.footswitch not in (None, dev.toe_index) else "pedal" if b.footswitch == dev.toe_index else \
            "snapshots" if any(s["state"][b.id] != base[b.id] for s in res.snapshots) else "always " + ("on" if base[b.id] else "off")
        out.append(f"- **{b.id}**: {b.info['name']}{extra}. {moved or 'defaults'}. [{owner}]")
    out.append("")
    out.append("DSP: " + ", ".join((f"processor {int(k[-1]) + 1}" if dev.key == "helix_lt" else "total") + f" {v:.0f}%"
                                   for k, v in res.loads.items() if v))
    out.append("")

    if feats or stomp_rows:
        out += ["## Measured", "", f"{renderer_name or 'renderer'}, built-in test signal, {datetime.date.today().isoformat()}. "
                "Levels are comparable between presets measured the same way; they are not what a meter on the unit reads.", ""]
        for row in stomp_rows or []:
            out.append(f"- stepping on {row['block']} in {row['snapshot']}: {row['on_minus_off_db']:+.1f} dB")
        out.append("")
    if findings is not None:
        out += ["## Checks", ""]
        if not findings:
            out.append("Nothing found.")
        for f in findings:
            out.append(f"- {f['kind']}: {f['text']}" + (f" Fix: {f['fix']}." if f["fix"] else ""))
        out.append("")
    state = "measured but unheard" if feats else "an unmeasured draft"
    out += ["## Not verified", "", "No measurement here hears the way a person does. Until someone has played it, "
            f"this preset is {state}.", ""]
    return "\n".join(out)


def write(spec_path: str, spec: dict, **kw) -> str:
    base = os.path.splitext(spec_path)[0]
    ext = buildmod.DEVICES[spec["device"]].extension
    path = base + ".md"
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text(spec, preset_file=os.path.basename(base) + ext, **kw))
    return path
