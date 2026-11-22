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
    """Blocks in signal order as (dsp key, block key, block). Parallel paths are flattened by position."""
    out = []
    for dsp in ("dsp0", "dsp1"):
        blks = [(k, b) for k, b in (tone.get(dsp) or {}).items()
                if k.startswith("block") and isinstance(b, dict) and "@model" in b]
        blks.sort(key=lambda kb: (kb[1].get("@position", 0), kb[1].get("@path", 0)))
        out += [(dsp, k, b) for k, b in blks]
    return out


def is_single_path(tone: dict) -> bool:
    g = tone.get("global", {})
    if g.get("@topology0", "A") != "A" or g.get("@topology1", "A") != "A":
        return False
    return not any(k.startswith("cab") for d in ("dsp0", "dsp1") for k in (tone.get(d) or {}))


def to_spec(preset: dict, device: str | None = None) -> dict:
    """Best-effort spec for a preset: blocks, non-default settings, pedal and switch assignments.

    Snapshots come back as on/off lists. Snapshot-controlled values and anything on a
    second path are not carried, so treat the result as a starting point to edit.
    """
    tone = preset["tone"]
    source = DEVICE_BY_ID.get(preset["device"], "helix_lt")
    device = device or source
    cat = catmod.get(device)
    source_toe = 9 if source == "pod_go" else 13
    spec_chain, ids, keymap = [], {}, {}
    for dsp, key, blk in chain(tone):
        mid = blk["@model"]
        try:
            if mid not in cat.blocks or not cat.selectable(mid):
                mid = cat.resolve(mid)
        except catmod.CatalogError:
            # keep it in the chain so the build names it, rather than dropping it quietly
            spec_chain.append({"model": blk["@model"], "note": f"no such model on {device}; pick a replacement"})
            continue
        info = cat.blocks[mid]
        base = info["category"]
        ids[base] = ids.get(base, 0) + 1
        bid = base if ids[base] == 1 else f"{base}{ids[base]}"
        keymap[(dsp, key)] = bid
        defaults = cat.defaults(mid)
        params = {k: v for k, v in blk.items()
                  if (not k.startswith("@") or k == "@mic") and k in defaults and v != defaults[k]}
        entry = {"id": bid, "model": info["name"] if len(cat._by_name.get(catmod._norm(info["name"]), [])) == 1 else mid}
        if not blk.get("@enabled", True):
            entry["enabled"] = False
        if params:
            entry["params"] = params
        if "@stereo" in blk and cat.has_width_choice(mid):
            entry["stereo"] = blk["@stereo"]
        if blk.get("@trails"):
            entry["trails"] = True
        for ctl, c in ((tone.get("controller") or {}).get(dsp, {}).get(key, {})).items():
            if c.get("@controller") in (1, 2) and ctl in info["params"]:
                entry["pedal"] = {"control": ctl, "source": f"exp{c['@controller']}", "min": c["@min"], "max": c["@max"]}
        fs = (tone.get("footswitch") or {}).get(dsp, {}).get(key)
        if fs:
            if fs.get("@fs_index") == source_toe:
                entry["footswitch"] = "toe"
            elif device == source:
                entry["footswitch"] = fs.get("@fs_index")
            else:
                entry["note"] = f"was on footswitch {fs.get('@fs_index')} on the source device; assign one here"
        spec_chain.append(entry)

    snaps = []
    n = 0
    while f"snapshot{n}" in tone:
        s = tone[f"snapshot{n}"]
        n += 1
        if not s.get("@valid") or "blocks" not in s:
            continue
        on, off = [], []
        for (dsp, key), bid in keymap.items():
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
    return "\n".join(lines)


def _fmt(v):
    if isinstance(v, float):
        return f"{v:.3g}"
    return str(v)
