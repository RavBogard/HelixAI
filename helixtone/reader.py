"""Read existing presets: .hlx, .pgp, and setlists (.hls) exported by the editors."""
from __future__ import annotations

import base64
import json
import re
import zlib

from . import catalog as catmod

DEVICE_BY_ID = {
    2162689: "helix_lt", 2162690: "helix_lt", 2162692: "helix_lt", 2162944: "helix_lt",  # Floor, Rack, LT, Native
    2162695: "pod_go", 2162696: "pod_go",                                                 # POD Go, POD Go Wireless
}
DEVICE_NAMES = {2162689: "Helix Floor", 2162690: "Helix Rack", 2162692: "Helix LT", 2162944: "Helix Native",
                2162694: "HX Stomp", 2162699: "HX Stomp XL", 2162693: "HX Effects",
                2162695: "POD Go", 2162696: "POD Go Wireless"}


def version_text(packed: int) -> str:
    return f"{packed >> 24}.{(packed >> 16) & 0xFF:02x}"


def load(path: str) -> list[dict]:
    """Return the presets in a file as a list of {'name', 'device', 'device_version', 'tone'}."""
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    try:
        doc = json.loads(text)
    except json.JSONDecodeError:
        doc = json.loads(re.sub(r",(\s*[}\]])", r"\1", text))
    if doc.get("schema") == "L6Setlist":
        inner = json.loads(zlib.decompress(base64.b64decode(doc["encoded_data"])))
        return [{"name": p["meta"]["name"], "device": p["device"], "device_version": p.get("device_version", 0),
                 "tone": p["tone"]} for p in inner["presets"] if "tone" in p]
    data = doc["data"]
    return [{"name": data["meta"]["name"], "device": data["device"], "device_version": data.get("device_version", 0),
             "tone": data["tone"]}]


def chain(tone: dict) -> list[tuple[str, str, dict]]:
    """Blocks as (dsp key, block key, block): per processor, path A in order, then path B."""
    out = []
    for dsp in ("dsp0", "dsp1"):
        blks = [(k, b) for k, b in (tone.get(dsp) or {}).items()
                if k.startswith("block") and isinstance(b, dict) and "@model" in b]
        blks.sort(key=lambda kb: (kb[1].get("@path", 0), kb[1].get("@position", 0)))
        out += [(dsp, k, b) for k, b in blks]
    return out


def linked_cab(tone: dict, dsp: str, blk: dict) -> dict | None:
    """The cab entry a block points at: an amp's own cab, or the second half of a dual cab."""
    ref = blk.get("@cab")
    return (tone.get(dsp) or {}).get(ref) if ref else None


def topology(tone: dict, dsp: str) -> str:
    return tone.get("global", {}).get(f"@topology{dsp[-1]}", "A")


def is_single_path(tone: dict) -> bool:
    return topology(tone, "dsp0") == "A" and topology(tone, "dsp1") == "A"


def _settings(blk: dict, defaults: dict) -> dict:
    return {k: v for k, v in blk.items()
            if (not k.startswith("@") or k == "@mic") and k in defaults and v != defaults[k]}


def to_spec(preset: dict, device: str | None = None, full: bool = False, trace: list | None = None) -> dict:
    """Best-effort spec for a preset: blocks, settings, splits, dual cabs, pedal and switch assignments.

    Snapshots come back as on/off lists; snapshot-controlled values are not carried,
    and paths with their own inputs or outputs are flattened. Treat the result as a
    starting point to edit. `full` keeps every setting, not only what differs from default.
    `trace`, if given, receives (spec id, dsp key, block key or None, source block) per entry,
    which is how the tests line a rebuild up against its original.
    """
    tone = preset["tone"]
    source = DEVICE_BY_ID.get(preset["device"], "helix_lt")
    device = device or source
    cat = catmod.get(device)
    source_toe = 9 if source == "pod_go" else 13
    ids, keymap = {}, {}

    def new_id(category):
        ids[category] = ids.get(category, 0) + 1
        return category if ids[category] == 1 else f"{category}{ids[category]}"

    def name_of(mid):
        info = cat.blocks[mid]
        return info["name"] if cat.resolve_or_none(info["name"]) == mid else mid

    def entry_for(dsp, key, blk):
        """Return a list of spec entries for one block (an amp with its own cab gives two)."""
        mid = blk["@model"]
        second = linked_cab(tone, dsp, blk)
        is_dual = second is not None and blk.get("@type") == 4
        try:
            if is_dual and device == "helix_lt":
                if mid not in cat.blocks:
                    raise catmod.CatalogError(mid)
            elif mid not in cat.blocks or not cat.selectable(mid):
                mid = cat.resolve(mid)
        except catmod.CatalogError:
            # keep it in the chain so the build names it, rather than dropping it quietly
            return [{"model": blk["@model"], "note": f"no such model on {device}; pick a replacement"}]
        info = cat.blocks[mid]
        bid = new_id(info["category"])
        keymap[(dsp, key)] = bid
        defaults = cat.defaults(mid)
        params = {k: v for k, v in blk.items() if (not k.startswith("@") or k == "@mic") and k in defaults} \
            if full else _settings(blk, defaults)
        model_ref = name_of(mid)
        if is_dual:
            plain = mid[:-7] if mid.endswith("WithPan") else mid
            model_ref = name_of(plain) if plain in cat.blocks else mid
        entry = {"id": bid, "model": model_ref}
        if not blk.get("@enabled", True):
            entry["enabled"] = False
        if params:
            entry["params"] = params
        if "@stereo" in blk and cat.has_width_choice(mid):
            entry["stereo"] = blk["@stereo"]
        if blk.get("@trails"):
            entry["trails"] = True
        if blk.get("@no_snapshot_bypass") and device == "helix_lt":
            entry["stays"] = True
        pedals = [{"control": ctl, "source": f"exp{c['@controller']}", "min": c["@min"], "max": c["@max"]}
                  for ctl, c in ((tone.get("controller") or {}).get(dsp, {}).get(key, {})).items()
                  if c.get("@controller") in (1, 2) and ctl in info["params"]]
        if pedals:
            entry["pedal"] = pedals[0] if len(pedals) == 1 else pedals
        fs = (tone.get("footswitch") or {}).get(dsp, {}).get(key)
        if fs:
            sw = None
            if fs.get("@fs_index") == source_toe:
                sw = "toe"
            elif device == source:
                sw = fs.get("@fs_index")
            else:
                entry["note"] = f"was on footswitch {fs.get('@fs_index')} on the source device; assign one here"
            if sw is not None:
                entry["footswitch"] = {"switch": sw, "momentary": True} if fs.get("@fs_momentary") else sw
        out = [entry]
        if trace is not None:
            trace.append((bid, dsp, key, blk))
        if second is not None and second.get("@model") in cat.blocks:
            m2 = second["@model"]
            d2 = cat.defaults(m2)
            p2 = {k: v for k, v in second.items() if (not k.startswith("@") or k == "@mic") and k in d2} \
                if full else _settings(second, d2)
            if is_dual:
                plain2 = m2[:-7] if m2.endswith("WithPan") else m2
                entry["dual"] = {"model": name_of(plain2) if plain2 in cat.blocks else m2}
                if p2:
                    entry["dual"]["params"] = p2
            else:
                # an amp carrying its own cab: we write the cab as the next block
                cab = {"id": new_id("cab"), "model": name_of(m2)}
                if p2:
                    cab["params"] = p2
                out.append(cab)
                if trace is not None:
                    trace.append((cab["id"], dsp, None, second))
        return out

    spec_chain = []
    for dsp in ("dsp0", "dsp1"):
        blks = [(k, b) for d, k, b in chain(tone) if d == dsp]
        a = [(k, b) for k, b in blks if b.get("@path", 0) == 0]
        b_path = [(k, b) for k, b in blks if b.get("@path", 0) == 1]
        if not b_path or "S" not in topology(tone, dsp) or device != "helix_lt":
            for k, b in a + b_path:
                spec_chain += entry_for(dsp, k, b)
            continue
        sp, jn = tone[dsp]["split"], tone[dsp]["join"]
        kind = {v: k for k, v in SPLIT_KINDS.items()}.get(sp.get("@model"), "y")
        before = [(k, b) for k, b in a if b["@position"] < sp["@position"]]
        inside = [(k, b) for k, b in a if sp["@position"] <= b["@position"] < jn["@position"]]
        after = [(k, b) for k, b in a if b["@position"] >= jn["@position"]]
        for k, b in before:
            spec_chain += entry_for(dsp, k, b)
        section = {"split": kind, "a": [], "b": []}
        sd, jd = cat.defaults(sp["@model"]), cat.defaults("HD2_AppDSPFlowJoin")
        sparams = {k: v for k, v in sp.items() if k in sd and (full or v != sd[k])}
        jparams = {k: v for k, v in jn.items() if k in jd and (full or v != jd[k])}
        if sparams:
            section["params"] = sparams
        if jparams:
            section["join"] = jparams
        for k, b in inside:
            section["a"] += entry_for(dsp, k, b)
        for k, b in b_path:
            section["b"] += entry_for(dsp, k, b)
        spec_chain.append(section)
        for k, b in after:
            spec_chain += entry_for(dsp, k, b)

    snaps = []
    n = 0
    while f"snapshot{n}" in tone:
        s = tone[f"snapshot{n}"]
        n += 1
        if not s.get("@valid") or "blocks" not in s:
            continue
        on, off = [], []
        for (dsp, key), bid in keymap.items():
            if tone[dsp][key].get("@no_snapshot_bypass") and device == "helix_lt":
                continue    # the device ignores the stored state for these
            state = s["blocks"].get(dsp, {}).get(key)
            base = tone[dsp][key].get("@enabled", True)
            if state is True and not base:
                on.append(bid)
            elif state is False and base:
                off.append(bid)
        snap = {"name": s.get("@name", f"SNAPSHOT {n}")[:10]}
        if on:
            snap["on"] = on
        if off:
            snap["off"] = off
        snaps.append(snap)
    spec = {"name": preset["name"][:16], "device": device, "tempo": tone.get("global", {}).get("@tempo", 120),
            "chain": spec_chain}
    if len(snaps) > 1:
        spec["snapshots"] = snaps
    return spec


SPLIT_KINDS = {"y": "HD2_AppDSPFlowSplitY", "ab": "HD2_AppDSPFlowSplitAB", "crossover": "HD2_AppDSPFlowSplitXOver"}


def describe(preset: dict) -> str:
    tone = preset["tone"]
    device = DEVICE_BY_ID.get(preset["device"], "helix_lt")
    cat = catmod.get(device)
    lines = [f"{preset['name']}  ({DEVICE_NAMES.get(preset['device'], preset['device'])}, "
             f"firmware {version_text(preset.get('device_version', 0))})"]
    for dsp, key, blk in chain(tone):
        mid = blk["@model"]
        info = cat.blocks.get(mid)
        name = info["name"] if info else mid
        state = "on " if blk.get("@enabled", True) else "off"
        path = ("B" if blk.get("@path") == 1 else "A") if device == "helix_lt" else ""
        where = f"{int(dsp[-1]) + 1}{path} " if device == "helix_lt" else ""
        changed = ""
        if info:
            d = cat.defaults(mid)
            diff = {k: v for k, v in blk.items() if k in d and v != d[k]}
            changed = "  " + ", ".join(f"{k}={_fmt(v)}" for k, v in diff.items())
        lines.append(f"  {where}{state} {name:<22}{changed}")
        second = linked_cab(tone, dsp, blk)
        if second is not None:
            n2 = cat.blocks.get(second.get("@model"), {}).get("name", second.get("@model"))
            kind = "second cab" if blk.get("@type") == 4 else "its cab"
            lines.append(f"  {'':<{len(where)}}    + {kind}: {n2}")
    return "\n".join(lines)


def _fmt(v):
    if isinstance(v, float):
        return f"{v:.3g}"
    return str(v)
