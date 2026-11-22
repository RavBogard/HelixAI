"""Check a tone against the rules that can be checked, before a person has to hear it.

Two kinds of finding:

  defect   wrong whoever plays it: clipping, snapshots at different loudness
           for no stated reason, a snapshot that raises drive without touching
           level
  note     departs from the practice recorded in the skill's references/craft.md.
           Often fine on purpose; the point is that it is on purpose.

`static` reads the spec only. `measured` needs a renderer and looks at each
snapshot's level, peaks and balance. Each finding says what it saw and, where
there is one, the command or change that fixes it.
"""
from __future__ import annotations

from . import catalog as catmod
from . import tune

TIME_BASED = ("delay", "reverb")
DRIVE_CONTROLS = ("Drive", "BrtDrive", "NrmDrive", "Drive1", "Drive2", "Gain")


def _finding(kind: str, text: str, fix: str = "") -> dict:
    return {"kind": kind, "text": text, "fix": fix}


def static(spec: dict, full_range: bool = True, max_snapshots: int | None = None, max_stomps: int | None = None,
           layout: dict | None = None) -> list[dict]:
    """What can be said from the spec alone. `full_range`: played through PA, monitors, headphones or a flat Powercab.
    `layout`: the player's entry in rig/players.json."""
    layout = layout or {}
    spec = tune.with_ids(spec)
    cat = catmod.get(spec["device"])
    blocks = tune.blocks_of(spec)
    out = []
    info = {bid: cat.blocks[cat.resolve(b["model"])] for bid, b in blocks.items()}
    cats = {bid: i["category"] for bid, i in info.items()}

    has_amp, has_cab = "amp" in cats.values(), "cab" in cats.values()
    if has_amp and full_range and not has_cab:
        out.append(_finding("defect", "amp with no cab block, for full-range speakers: it will sound harsh and fizzy", "add the amp's own cab"))
    if has_cab and not full_range:
        out.append(_finding("defect", "cab block present but the player uses a real guitar cab or speaker model: a cab on a cab", "remove the cab block"))

    for bid, b in blocks.items():
        p = b.get("params", {})
        if cats[bid] in TIME_BASED and not b.get("trails"):
            out.append(_finding("note", f"{bid}: trails are off, so its tail is cut dead when it is switched off or a snapshot changes",
                                f'set "trails": true on {bid}'))
        if cats[bid] == "cab" and full_range:
            hc = p.get("HighCut", info[bid]["params"].get("HighCut", {}).get("default", 0))
            lc = p.get("LowCut", info[bid]["params"].get("LowCut", {}).get("default", 0))
            if hc and hc > 10000:
                out.append(_finding("note", f"{bid}: high cut is open ({hc:.0f} Hz). Through full-range speakers that leaves the fizz above 8 kHz in",
                                    "HighCut 6500 to 8000, or a darker mic or position if it is still harsh"))
            elif hc and hc < 4000:
                out.append(_finding("note", f"{bid}: high cut at {hc:.0f} Hz is taking 6 dB or more out of the 4 kHz presence region, not just fizz",
                                    "fine for a deliberately dark tone; otherwise raise it and move the mic outward instead"))
            if lc is not None and lc < 60:
                out.append(_finding("note", f"{bid}: low cut is open ({lc:.0f} Hz), leaving sub-bass a sound engineer would cut anyway", "LowCut 80 to 100"))
            elif lc and lc > 130:
                out.append(_finding("note", f"{bid}: low cut at {lc:.0f} Hz is thinning the 100 to 125 Hz body", "LowCut 80 to 100 unless the tone is meant to be thin"))

    snaps = spec.get("snapshots", [])
    for s in snaps:
        for bid, changes in s.get("set", {}).items():
            if cats.get(bid) == "amp" and any(c in changes for c in DRIVE_CONTROLS) and "ChVol" not in changes:
                out.append(_finding("defect", f"snapshot '{s['name']}' changes {bid}'s drive but not its Channel Volume: drive moves level by many dB",
                                    "helixtone tune level <spec> --write"))
    if max_snapshots and len(snaps) > max_snapshots:
        out.append(_finding("note", f"{len(snaps)} snapshots; this player's layout shows {max_snapshots}", f"keep the main sounds to {max_snapshots}"))
    stomps = [bid for bid, b in blocks.items() if b.get("footswitch") not in (None, "toe")]
    if max_stomps and len(stomps) > max_stomps:
        out.append(_finding("note", f"{len(stomps)} blocks on stomp switches ({', '.join(stomps)}); this player's layout shows {max_stomps}",
                            f"choose the {max_stomps} that are switched while playing"))
    for bid, c in cats.items():
        if c in ("drive", "mod", "delay", "reverb", "comp", "filter", "pitch") and blocks[bid].get("footswitch") is None \
                and not any(bid in s.get("on", []) + s.get("off", []) for s in snaps) and blocks[bid].get("enabled", True) is False:
            out.append(_finding("defect", f"{bid} starts switched off and nothing turns it on: no footswitch, no snapshot", f"give {bid} a footswitch or a snapshot, or remove it"))
    out += _layout(spec, blocks, cats, layout)
    return out


def _layout(spec: dict, blocks: dict, cats: dict, layout: dict) -> list[dict]:
    """Does the preset put things where this player's feet expect them?"""
    out = []
    snaps = spec.get("snapshots", [])
    roles = layout.get("snapshots") or []
    names = [s["name"] for s in snaps]
    if roles and [n.lower() for n in names[:len(roles)]] != [r.lower() for r in roles]:
        out.append(_finding("defect", f"snapshots are {', '.join(names) or 'missing'}; this player's presets all start {', '.join(roles)}, in that order",
                            "name and order the snapshots that way; further snapshots can follow"))
    switched = {bid: b["footswitch"] for bid, b in blocks.items() if b.get("footswitch") is not None}
    if layout.get("stomps_stay"):
        loose = [bid for bid in switched if not blocks[bid].get("stays")]
        if loose:
            out.append(_finding("defect", f"{', '.join(loose)}: on a switch but without \"stays\", so a snapshot change resets what the player switched",
                                'set "stays": true on each, and let snapshots change controls and unswitched blocks only'))
    row = {int(k): v for k, v in (layout.get("stomp_row") or {}).items()}
    extra = set(layout.get("extra_switches") or [])
    by_switch: dict = {}
    for bid, fs in switched.items():
        sw = fs.get("switch") if isinstance(fs, dict) else fs
        if sw == "toe":
            continue
        by_switch.setdefault(sw, []).append(bid)
        if row and sw in row and cats[bid] not in row[sw]:
            out.append(_finding("defect", f"{bid} ({cats[bid]}) is on switch {sw}, which is this player's {row[sw][0]} switch",
                                "move it to its own kind's switch, or to one of the free switches " + ", ".join(map(str, sorted(extra)))))
        elif row and sw not in row and sw not in extra:
            out.append(_finding("note", f"{bid} is on switch {sw}, outside this player's stomp switches", ""))
    for sw, kinds in row.items():
        if sw not in by_switch and kinds[0] in cats.values():
            have = [bid for bid, c in cats.items() if c == kinds[0] and bid not in switched]
            if have:
                out.append(_finding("note", f"switch {sw} ({kinds[0]}) is empty although the preset has {', '.join(have)} with no switch",
                                    f"put it on switch {sw} unless snapshots are meant to own it"))
    return out


def measured(spec: dict, renderer, di, sr: int, offsets: dict | None = None, target_loudness: float | None = None,
             stomps: bool = True) -> tuple[list[dict], list[dict]]:
    """Render every snapshot, and each stomp on and off, and judge levels and peaks.

    Returns (findings, per-snapshot features). The stomp rows are left in `measured.stomp_rows`."""
    ided = tune.with_ids(spec)
    feats = tune.measure(spec, renderer, di, sr)
    names = [s["name"] for s in ided["snapshots"]]
    offsets = offsets or {}
    out = []
    base = feats[0]["loudness_db"]
    for name, f in zip(names, feats):
        want = base + offsets.get(name, 0.0)
        if f["clipped"] or f["peak_db"] > -0.5:
            out.append(_finding("defect", f"snapshot '{name}' clips (peak {f['peak_db']:.1f} dB)", "lower Channel Volume, then level again"))
        elif f["peak_db"] > -3.0:
            out.append(_finding("note", f"snapshot '{name}' peaks at {f['peak_db']:.1f} dB on the test signal: little room for a hard-hit chord", "lower every snapshot's Channel Volume by the same amount"))
        if abs(f["loudness_db"] - want) > 1.0:
            out.append(_finding("defect", f"snapshot '{name}' is {f['loudness_db'] - want:+.1f} dB from where it should sit against '{names[0]}'",
                                "helixtone tune level <spec> --write"))
    by_role = {n.lower(): f["crest_db"] for n, f in zip(names, feats)}
    # crest (peak over loudness) falls as an amp saturates: it is how clean a snapshot measures
    for cleaner, dirtier, least in (("clean", "crunch", 1.5), ("crunch", "lead", 0.0), ("clean", "lead", 3.0)):
        if cleaner in by_role and dirtier in by_role and by_role[cleaner] - by_role[dirtier] < least:
            out.append(_finding("defect", f"'{cleaner.title()}' measures about as driven as '{dirtier.title()}' "
                                f"(crest {by_role[cleaner]:.1f} against {by_role[dirtier]:.1f} dB): the names promise a difference the amp settings do not make",
                                f"lower the amp's drive in '{cleaner.title()}' or raise it in '{dirtier.title()}', then level again"))
    crest = [f["crest_db"] for f in feats]
    if max(crest) - min(crest) > 8.0:
        loud = names[crest.index(max(crest))]
        out.append(_finding("note", f"snapshot '{loud}' has peaks {max(crest) - min(crest):.0f} dB taller than the most driven snapshot at the same loudness: "
                            "it will feel spikier and can clip a mixer that the others do not",
                            f"light compression before the amp, on in '{loud}' only (Deluxe Comp 4:1), then level again"))
    stomp_rows = tune.stomp_steps(spec, renderer, di, sr) if stomps else []
    for row in stomp_rows:
        d = row["on_minus_off_db"]
        if abs(d) > 4.0:
            out.append(_finding("defect", f"stepping on {row['block']} in '{row['snapshot']}' changes level by {d:+.1f} dB",
                                "helixtone tune stomps <spec> --write" if row["category"] == "drive" else f"trim {row['block']}'s own level or mix"))
        elif abs(d) > 2.5:
            out.append(_finding("note", f"stepping on {row['block']} in '{row['snapshot']}' changes level by {d:+.1f} dB", ""))
    if target_loudness is not None and abs(base - target_loudness) > 1.5:
        out.append(_finding("note", f"this preset sits at {base:.1f} dB; the others are levelled to {target_loudness:.1f}",
                            "move every snapshot's Channel Volume together until the first snapshot matches"))
    measured.stomp_rows = stomp_rows
    return out, feats


def describe(findings: list[dict]) -> list[str]:
    lines = []
    for kind in ("defect", "note"):
        for f in findings:
            if f["kind"] == kind:
                lines.append(f"  {kind.upper():6} {f['text']}" + (f"\n         fix: {f['fix']}" if f["fix"] else ""))
    return lines or ["  nothing found"]
