"""Turn a tone spec into a preset file for the Helix LT (.hlx) or POD Go (.pgp).

Everything about the file format here was checked against real files: Line 6's
factory presets for the Helix side and a library of real POD Go presets (including POD Go
Edit's own blank preset) for the POD Go side. tests/ rebuilds the factory presets
from their own settings and compares the blocks, so a format mistake shows up
there before it reaches a device.

Out of scope for now, and refused rather than guessed: impulse-response blocks,
send/return blocks on the Helix, command switches, more than one split per
processor, and paths with their own inputs or outputs.
"""
from __future__ import annotations

import copy
import time
from dataclasses import dataclass, field

from . import catalog as catmod
from .catalog import Catalog, CatalogError
from .spec import SpecError, check_shape


class BuildError(ValueError):
    def __init__(self, problems: list[str]):
        self.problems = problems
        super().__init__("\n".join(f"- {p}" for p in problems))


@dataclass
class Device:
    key: str
    label: str
    device_id: int
    firmware: int            # packed version, 0x03800000 is 3.80
    application: str
    extension: str
    snapshots: int
    snapshot_controller: int
    switches: tuple
    toe_index: int
    dsp_limit: float = 100.0


DEVICES = {
    "helix_lt": Device("helix_lt", "Helix LT", 2162692, 0x03800000, "HX Edit", ".hlx", 8, 19,
                       (1, 2, 3, 4, 5, 7, 8, 9, 10, 11), 13),
    "pod_go": Device("pod_go", "POD Go", 2162695, 0x02500000, "POD Go Edit", ".pgp", 4, 11,
                     (1, 2, 3, 4, 5, 6), 9),
}

HELIX_BLOCKS_PER_DSP = 8
PODGO_SLOTS = 10
PODGO_FREE = 4
SNAPSHOT_NAME_MAX = 10
EXP_SOURCES = {"exp1": 1, "exp2": 2}
COLOURS = ["auto", "white", "red", "dark orange", "light orange", "yellow", "green",
           "turquoise", "blue", "violet", "pink", "off"]

PODGO_BUILTIN_DEFAULTS = {
    "volume": ("HD2_VolPanVolStereo", True),
    "wah": ("HD2_WahFasselStereo", False),
    "fxloop": ("HD2_FXLoopMono1", False),
    "eq": ("HD2_EQ_STATIC_ParametricStereo", False),
}


@dataclass
class Block:
    id: str
    model: str
    info: dict
    enabled: bool
    params: dict
    stereo: bool | None = None
    trails: bool | None = None
    assigns: list = field(default_factory=list)   # (control, source, lo, hi)
    footswitch: int | None = None
    dsp: int = 0
    position: int = 0
    forced_dsp: int | None = None
    auto: bool = False
    path: int = 0                 # 0 is path A, 1 is path B inside a split
    momentary: bool = False
    dual: dict | None = None      # second cab of a dual cab: {"model", "info", "params"}

    @property
    def key(self) -> str:
        return f"block{self.slot}"

    slot: int = 0

    @property
    def category(self) -> str:
        return self.info["category"]


@dataclass
class Result:
    device: Device
    name: str
    preset: dict
    blocks: list
    loads: dict
    warnings: list
    snapshots: list

    @property
    def filename(self) -> str:
        safe = "".join(c if c.isalnum() or c in " -_" else "_" for c in self.name).strip()
        return safe + self.device.extension


def _is_wah(b: Block) -> bool:
    return b.category == "wah"


def _is_volume_pedal(b: Block) -> bool:
    return b.model.startswith("HD2_VolPanVol")


def _podgo_role(b: Block) -> str | None:
    return b.info.get("role")


# ------------------------------------------------------------------ resolve

SPLIT_MODELS = {"y": "HD2_AppDSPFlowSplitY", "ab": "HD2_AppDSPFlowSplitAB", "crossover": "HD2_AppDSPFlowSplitXOver"}
JOIN_MODEL = "HD2_AppDSPFlowJoin"


def _resolve_block(raw: dict, where: str, cat: Catalog, dev: Device, used_ids: dict,
                   problems: list[str], warnings: list[str]) -> Block | None:
    try:
        mid = cat.resolve(raw["model"])
    except CatalogError as exc:
        problems.append(f"{where}: {exc}")
        return None
    info = cat.blocks[mid]
    if mid.startswith("HD2_ImpulseResponse"):
        problems.append(f"{where}: impulse-response blocks are not supported yet (they need the IR's id from your device)")
        return None
    if dev.key == "helix_lt" and info["family"] == "sendreturn":
        problems.append(f"{where}: {info['family']} blocks are not supported yet")
        return None

    dual = None
    if "dual" in raw:
        second = raw["dual"] if isinstance(raw["dual"], dict) else {"model": raw["dual"]}
        if dev.key != "helix_lt" or info["category"] != "cab":
            problems.append(f"{where}: 'dual' is for cab blocks on the Helix")
            return None
        try:
            mid2 = cat.resolve(second["model"], "cab")
        except CatalogError as exc:
            problems.append(f"{where}: second cab: {exc}")
            return None
        if cat.blocks[mid2]["family"] != info["family"]:
            problems.append(f"{where}: both cabs of a dual cab must be the same kind (both current, or both legacy)")
            return None
        if info["family"] == "cabmicirs":
            # the two halves of a dual cab use the WithPan ids, which add Pan and Delay
            mid, mid2 = mid + "WithPan", mid2 + "WithPan"
            if mid not in cat.blocks or mid2 not in cat.blocks:
                problems.append(f"{where}: no dual version of that cab in the catalog")
                return None
            info = cat.blocks[mid]
        params2 = cat.defaults(mid2)
        for key, value in (second.get("params") or {}).items():
            try:
                params2[key] = cat.check_param(mid2, key, value)
            except CatalogError as exc:
                problems.append(f"{where}: second cab: {exc}")
        dual = {"model": mid2, "info": cat.blocks[mid2], "params": params2}

    params = cat.defaults(mid)
    for key, value in raw.get("params", {}).items():
        try:
            params[key] = cat.check_param(mid, key, value)
        except CatalogError as exc:
            problems.append(f"{where}: {exc}")
    base = raw.get("id") or info["category"]
    if "id" in raw and base in used_ids:
        problems.append(f"{where}: id {base!r} is used twice")
    used_ids[base] = used_ids.get(base, 0) + 1
    bid = base if used_ids[base] == 1 else f"{base}{used_ids[base]}"
    blk = Block(id=bid, model=mid, info=info, enabled=bool(raw.get("enabled", True)), params=params, dual=dual)

    if "stereo" in raw:
        if cat.has_width_choice(mid):
            blk.stereo = bool(raw["stereo"])
        elif dev.key == "pod_go":
            problems.append(f"{where}: on the POD Go a model's width is fixed, drop 'stereo'")
        else:
            problems.append(f"{where}: {info['name']} comes in one width only, drop 'stereo'")
    if "trails" in raw:
        if info["category"] in ("delay", "reverb"):
            blk.trails = bool(raw["trails"])
        else:
            problems.append(f"{where}: 'trails' only applies to delays and reverbs")
    if "dsp" in raw:
        if dev.key != "helix_lt" or raw["dsp"] not in (0, 1):
            problems.append(f"{where}: 'dsp' is 0 or 1 and Helix only")
        else:
            blk.forced_dsp = raw["dsp"]

    pedals = raw.get("pedal")
    for pedal in ([] if pedals is None else pedals if isinstance(pedals, list) else [pedals]):
        assign = {"control": "Pedal", "source": pedal} if isinstance(pedal, str) else dict(pedal)
        ctl, src = assign.get("control", "Pedal"), assign.get("source")
        if src not in EXP_SOURCES:
            problems.append(f"{where}: pedal source must be exp1 or exp2, got {src!r}")
        elif ctl not in info["params"]:
            problems.append(f"{where}: no control {ctl!r} to put on the pedal. Controls: {', '.join(info['params'])}")
        elif info["params"][ctl]["type"] not in ("float", "int"):
            problems.append(f"{where}: {ctl} is not a continuous control")
        elif any(a[0] == ctl for a in blk.assigns):
            problems.append(f"{where}: {ctl} is put on the pedal twice")
        else:
            p = info["params"][ctl]
            try:
                lo = cat.check_param(mid, ctl, assign.get("min", p["min"]))
                hi = cat.check_param(mid, ctl, assign.get("max", p["max"]))
                blk.assigns.append((ctl, src, lo, hi))
            except CatalogError as exc:
                problems.append(f"{where}: pedal range: {exc}")

    fs = raw.get("footswitch")
    if isinstance(fs, dict):
        blk.momentary = bool(fs.get("momentary", False))
        fs = fs.get("switch")
        if fs is None:
            problems.append(f"{where}: footswitch needs a 'switch'")
    if fs is not None:
        if fs == "toe":
            blk.footswitch = dev.toe_index
        elif isinstance(fs, int) and not isinstance(fs, bool) and fs in dev.switches:
            blk.footswitch = fs
            if dev.key == "helix_lt" and fs in (1, 7):
                warnings.append(f"{blk.id}: footswitch {fs} is a stomp switch only in 10-switch mode")
        else:
            problems.append(f"{where}: footswitch must be one of {list(dev.switches)} or \"toe\", got {fs!r}")
    return blk


def resolve_chain(spec: dict, cat: Catalog, dev: Device, problems: list[str], warnings: list[str]):
    """Return (blocks in signal order, chain items). An item is a Block or a split section dict."""
    blocks: list[Block] = []
    items: list = []
    explicit: dict = {}
    used_ids: dict[str, int] = {}

    def one(raw, where, path=0):
        blk = _resolve_block(raw, where, cat, dev, used_ids, problems, warnings)
        if blk:
            blk.path = path
            blocks.append(blk)
            explicit[blk.id] = raw
        return blk

    for i, raw in enumerate(spec["chain"]):
        if "split" not in raw:
            blk = one(raw, f"chain[{i}] ({raw['model']})")
            if blk:
                items.append(blk)
            continue
        where = f"chain[{i}] (split)"
        if dev.key != "helix_lt":
            problems.append(f"{where}: the POD Go has a single path, no splits")
            continue
        kind = str(raw["split"]).lower()
        if kind not in SPLIT_MODELS:
            problems.append(f"{where}: split must be one of {sorted(SPLIT_MODELS)}, got {raw['split']!r}")
            continue
        section = {"model": SPLIT_MODELS[kind], "params": cat.defaults(SPLIT_MODELS[kind]),
                   "join": cat.defaults(JOIN_MODEL), "a": [], "b": []}
        for target, model, given in (("params", SPLIT_MODELS[kind], raw.get("params") or {}),
                                     ("join", JOIN_MODEL, raw.get("join") or {})):
            for key, value in given.items():
                try:
                    section[target][key] = cat.check_param(model, key, value)
                except CatalogError as exc:
                    problems.append(f"{where}: {exc}")
        for lane, path in (("a", 0), ("b", 1)):
            for j, sub in enumerate(raw.get(lane) or []):
                blk = one(sub, f"chain[{i}].{lane}[{j}] ({sub['model']})", path)
                if blk:
                    section[lane].append(blk)
        if not section["b"]:
            problems.append(f"{where}: path 'b' is empty; a split needs at least one block on the second path")
        items.append(section)
    return blocks, items, explicit


def _default_pedals(blocks: list[Block], dev: Device, explicit: dict) -> None:
    """Wah on EXP1 and volume on EXP2, both on the toe switch, as Line 6's own presets do."""
    for b in blocks:
        raw = explicit.get(b.id, {})
        if "Pedal" not in b.info["params"]:
            continue
        if _is_wah(b) or _is_volume_pedal(b):
            p = b.info["params"]["Pedal"]
            if "pedal" not in raw and not b.assigns:
                b.assigns.append(("Pedal", "exp1" if _is_wah(b) else "exp2", p["min"], p["max"]))
            if "footswitch" not in raw and b.footswitch is None:
                b.footswitch = dev.toe_index


def _default_widths(blocks: list[Block], cat: Catalog) -> None:
    last_amp_or_cab = max((i for i, b in enumerate(blocks) if b.category in ("amp", "cab")), default=-1)
    for i, b in enumerate(blocks):
        if cat.has_width_choice(b.model) and b.stereo is None:
            b.stereo = i > last_amp_or_cab


# ---------------------------------------------------------------- placement

def _cost(b: Block, cat: Catalog) -> float:
    cost = cat.load(b.model, bool(b.stereo))
    if b.dual:
        cost += cat.load(b.dual["model"])
    return cost


def place_helix(items: list, blocks: list[Block], cat: Catalog, dev: Device, problems: list[str], warnings: list[str]):
    """Lay the chain out on the two processors. Returns (loads, {dsp: section})."""
    loads = {0: 0.0, 1: 0.0}
    col = {0: 0, 1: 0}                     # next free column on path A
    sections: dict[int, dict] = {}
    dsp = 0
    for item in items:
        members = [item] if isinstance(item, Block) else item["a"] + item["b"]
        cost = sum(_cost(b, cat) for b in members)
        width = 1 if isinstance(item, Block) else max(len(item["a"]), len(item["b"]))
        forced = [b.forced_dsp for b in members if b.forced_dsp is not None]
        if forced:
            if min(forced) < dsp:
                problems.append(f"{members[0].id}: asked for processor 0 but an earlier block is already on processor 1")
            dsp = max(dsp, max(forced))
        needs_move = col[0] + width > HELIX_BLOCKS_PER_DSP or loads[0] + cost > dev.dsp_limit
        if not isinstance(item, Block) and 0 in sections:
            needs_move = True              # one split per processor
        if dsp == 0 and needs_move:
            dsp = 1
        if isinstance(item, Block):
            item.dsp, item.position = dsp, col[dsp]
        else:
            if dsp in sections:
                problems.append("only one split fits on each processor, and this chain needs a third")
            sections[dsp] = item
            item["dsp"], item["split_pos"], item["join_pos"] = dsp, col[dsp], col[dsp] + width
            for lane in ("a", "b"):
                for i, b in enumerate(item[lane]):
                    b.dsp, b.position = dsp, col[dsp] + i
        col[dsp] += width
        loads[dsp] += cost
    for d in (0, 1):
        on = sorted((b for b in blocks if b.dsp == d), key=lambda b: (b.path, b.position))
        for n, b in enumerate(on):      # path A blocks are numbered first, then path B, as in Line 6's files
            b.slot = n
        if col[d] > HELIX_BLOCKS_PER_DSP:
            problems.append(f"processor {d + 1} needs {col[d]} columns; a path holds {HELIX_BLOCKS_PER_DSP}")
        if loads[d] > dev.dsp_limit:
            heavy = sorted(on, key=lambda b: -_cost(b, cat))[:3]
            listing = ", ".join(f"{b.info['name']} {_cost(b, cat):.0f}%" for b in heavy)
            problems.append(f"processor {d + 1} is at {loads[d]:.0f}% of its DSP. Heaviest: {listing}")
        elif loads[d] > 90:
            warnings.append(f"processor {d + 1} is at {loads[d]:.0f}% DSP: it should load, but there is little room to add anything")
    return {f"dsp{d}": round(loads[d], 2) for d in (0, 1)}, sections


def place_podgo(blocks: list[Block], cat: Catalog, dev: Device, problems: list[str], warnings: list[str]) -> tuple[list[Block], dict]:
    def builtin(role: str) -> Block:
        mid, enabled = PODGO_BUILTIN_DEFAULTS[role]
        return Block(id=role, model=mid, info=cat.blocks[mid], enabled=enabled, params=cat.defaults(mid), auto=True)

    def roles():
        out = {}
        for b in blocks:
            r = _podgo_role(b)
            if r == "eq" and not b.model.startswith("HD2_EQ_STATIC_"):
                r = None  # an EQ from the effects list takes a free block
            out.setdefault(r, []).append(b)
        return out

    have = roles()
    for role in ("amp", "cab"):
        n = len(have.get(role, []))
        if n != 1:
            problems.append(f"a POD Go preset needs exactly one {role} block, this chain has {n}")
    for role in ("volume", "wah", "fxloop"):
        if len(have.get(role, [])) > 1:
            problems.append(f"a POD Go preset holds one {role} block, this chain has {len(have[role])}")
    if len(have.get("eq", [])) > 1:
        problems.append("only one built-in (EQ_STATIC) EQ fits; use an EQ from the effects list for a second")
    if problems:
        return blocks, {}

    ids = {b.id for b in blocks}
    def add(role: str, index: int):
        blk = builtin(role)
        while blk.id in ids:
            blk.id += "_"
        ids.add(blk.id)
        blocks.insert(index, blk)

    if "volume" not in have:
        add("volume", 0)
    if "wah" not in have:
        vol = next(i for i, b in enumerate(blocks) if _podgo_role(b) == "volume")
        add("wah", vol + 1)
    if "fxloop" not in have:
        add("fxloop", next(i for i, b in enumerate(blocks) if _podgo_role(b) == "amp"))
    if "eq" not in have:
        add("eq", next(i for i, b in enumerate(blocks) if _podgo_role(b) == "cab") + 1)

    free = roles().get(None, [])
    if len(free) > PODGO_FREE:
        listing = ", ".join(b.info["name"] for b in free)
        problems.append(f"the POD Go has {PODGO_FREE} free effect blocks and this chain uses {len(free)}: {listing}")
    if len(blocks) > PODGO_SLOTS:
        problems.append(f"{len(blocks)} blocks do not fit the POD Go's {PODGO_SLOTS} slots")
    total = 0.0
    for i, b in enumerate(blocks):
        b.dsp, b.position, b.slot = 0, i, i
        total += cat.load(b.model)
    if total > dev.dsp_limit:
        heavy = sorted(blocks, key=lambda b: -cat.load(b.model))[:3]
        listing = ", ".join(f"{b.info['name']} {cat.load(b.model):.0f}%" for b in heavy)
        problems.append(f"this chain needs {total:.0f}% of the POD Go's DSP. Heaviest: {listing}")
    elif total > 90:
        warnings.append(f"DSP is at {total:.0f}%: it should load, but with no room to spare")
    return blocks, {"dsp0": round(total, 2)}


# ---------------------------------------------------------------- snapshots

def plan_snapshots(spec: dict, blocks: list[Block], cat: Catalog, dev: Device, problems: list[str], warnings: list[str]):
    """Return (per-snapshot plans, {(block id, control): range}) for snapshot-controlled controls."""
    by_id = {b.id: b for b in blocks}
    snaps = spec.get("snapshots") or [{"name": "SNAPSHOT 1"}]
    if len(snaps) > dev.snapshots:
        problems.append(f"{dev.label} has {dev.snapshots} snapshots, the spec has {len(snaps)}")
        snaps = snaps[: dev.snapshots]
    controlled: dict[tuple, tuple] = {}
    plans = []
    for i, s in enumerate(snaps):
        where = f"snapshot {i + 1} ({s['name']})"
        if len(s["name"]) > SNAPSHOT_NAME_MAX:
            problems.append(f"{where}: name is {len(s['name'])} characters, the device shows {SNAPSHOT_NAME_MAX}")
        state = {b.id: b.enabled for b in blocks}
        for flag, value in (("on", True), ("off", False)):
            for bid in s.get(flag, []):
                if bid not in by_id:
                    problems.append(f"{where}: '{flag}' names unknown block {bid!r}. Blocks: {', '.join(by_id)}")
                else:
                    state[bid] = value
        both = set(s.get("on", [])) & set(s.get("off", []))
        if both:
            problems.append(f"{where}: {sorted(both)} listed as both on and off")
        values = {}
        for bid, changes in (s.get("set") or {}).items():
            if bid not in by_id:
                problems.append(f"{where}: 'set' names unknown block {bid!r}. Blocks: {', '.join(by_id)}")
                continue
            b = by_id[bid]
            for ctl, value in changes.items():
                try:
                    v = cat.check_param(b.model, ctl, value)
                except CatalogError as exc:
                    problems.append(f"{where}: {exc}")
                    continue
                if any(a[0] == ctl for a in b.assigns):
                    problems.append(f"{where}: {bid}.{ctl} is on the expression pedal, a snapshot cannot also set it")
                    continue
                p = b.info["params"][ctl]
                if p["type"] == "string":
                    problems.append(f"{where}: {bid}.{ctl} cannot be changed by a snapshot")
                    continue
                controlled[(bid, ctl)] = (False, True) if p["type"] == "bool" else (p["min"], p["max"])
                values[(bid, ctl)] = v
        colour = s.get("colour", 0)
        if isinstance(colour, str):
            if colour.lower() not in COLOURS:
                problems.append(f"{where}: colour must be one of {COLOURS}")
                colour = 0
            else:
                colour = COLOURS.index(colour.lower())
        plans.append({"name": s["name"], "state": state, "values": values, "colour": colour})
    if controlled and dev.key == "pod_go":
        warnings.append("snapshot control changes on the POD Go use controller 11, known from USB captures "
                        "but not yet seen in a .pgp file: check each snapshot on the device")
    return plans, controlled


# ----------------------------------------------------------------- assembly

def _block_json(b: Block, dev: Device) -> dict:
    out = {"@model": b.model, "@position": b.position}
    if dev.key == "helix_lt":
        out["@path"] = b.path
    out["@type"] = 4 if b.dual else b.info["type"]
    out["@enabled"] = b.enabled
    out["@no_snapshot_bypass"] = False
    if b.stereo is not None:
        out["@stereo"] = b.stereo
    if b.category in ("delay", "reverb") and b.info["type"] in (5, 7) or (dev.key == "pod_go" and b.info["type"] == 5):
        out["@trails"] = bool(b.trails)
    if b.category == "amp":
        out["@bypassvolume"] = 1
    out.update(b.params)
    return out


def _assemble(spec, blocks, plans, controlled, cat: Catalog, dev: Device, sections: dict | None = None) -> dict:
    sections = sections or {}
    sk = copy.deepcopy(cat.skeleton)
    blank_snapshot = sk.pop("snapshot")
    tone = {k: v for k, v in sk.items() if k not in ("controller", "footswitch")}
    tempo = spec.get("tempo", 120)
    dsps = sorted({b.dsp for b in blocks})

    for d in (0, 1):
        key = f"dsp{d}"
        tone[key] = {k: v for k, v in (sk.get(key) or {}).items() if not k.startswith("block")}
        cabs = 0
        for b in blocks:
            if b.dsp == d:
                tone[key][b.key] = _block_json(b, dev)
                if b.dual:
                    tone[key][b.key]["@cab"] = f"cab{cabs}"
                    tone[key][f"cab{cabs}"] = {"@enabled": True, "@model": b.dual["model"], **b.dual["params"]}
                    cabs += 1
        if d in sections:
            sec = sections[d]
            tone[key]["split"] = {"@enabled": True, "@model": sec["model"], "@position": sec["split_pos"], **sec["params"]}
            tone[key]["join"] = {"@enabled": True, "@model": JOIN_MODEL, "@position": sec["join_pos"], **sec["join"]}
    if dev.key == "pod_go":
        for n in range(PODGO_SLOTS):
            tone["dsp0"].setdefault(f"block{n}", {"@position": n})
        tone["dsp1"] = {}
    elif 1 in dsps:
        tone["dsp0"]["outputA"]["@output"] = 2   # Path 2A
        tone["dsp1"]["inputA"]["@input"] = 0     # fed by path 1

    # controllers: expression pedal assignments, then snapshot-controlled controls
    by_id = {b.id: b for b in blocks}
    controller: dict = {}
    def ctl_slot(b: Block) -> dict:
        return controller.setdefault(f"dsp{b.dsp}", {}).setdefault(b.key, {})
    for b in blocks:
        for ctl, src, lo, hi in b.assigns:
            entry = {"@controller": EXP_SOURCES[src], "@max": hi, "@min": lo}
            if dev.key == "helix_lt":
                entry["@snapshot_disable"] = False
            ctl_slot(b)[ctl] = entry
    for (bid, ctl), (lo, hi) in controlled.items():
        entry = {"@controller": dev.snapshot_controller, "@max": hi, "@min": lo}
        if dev.key == "helix_lt":
            entry["@snapshot_disable"] = False
        ctl_slot(by_id[bid])[ctl] = entry

    footswitch: dict = {}
    for b in blocks:
        if b.footswitch is None:
            continue
        entry = {"@fs_enabled": b.enabled, "@fs_index": b.footswitch, "@fs_label": b.info["name"][:16],
                 "@fs_ledcolor": cat.fs_colour.get(b.category, 65408), "@fs_momentary": b.momentary}
        if dev.key == "pod_go" and not _is_volume_pedal(b):
            entry["@fs_primary"] = True
        footswitch.setdefault(f"dsp{b.dsp}", {})[b.key] = entry

    def snapshot_json(n: int, plan: dict | None) -> dict:
        snap = dict(blank_snapshot)
        snap.pop("blocks", None)
        snap.pop("controllers", None)
        snap["@tempo"] = tempo
        snap["@name"] = plan["name"] if plan else f"SNAPSHOT {n + 1}"
        snap["@ledcolor"] = plan["colour"] if plan else 0
        snap["@valid"] = plan is not None
        source = plan or plans[0]
        if plan is None and dev.key == "helix_lt":
            return snap     # unused Helix snapshots carry no block list
        states: dict = {}
        for b in blocks:
            states.setdefault(f"dsp{b.dsp}", {})[b.key] = source["state"][b.id]
        if dev.key == "pod_go":
            for k in range(PODGO_SLOTS):
                states["dsp0"].setdefault(f"block{k}", True)
        for d in sections:
            states.setdefault(f"dsp{d}", {})["split"] = True
        snap["blocks"] = states
        values: dict = {}
        for b in blocks:
            for ctl, _src, _lo, _hi in b.assigns:
                values.setdefault(f"dsp{b.dsp}", {}).setdefault(b.key, {})[ctl] = {
                    "@fs_enabled": False, "@value": b.params[ctl]}
        for (bid, ctl) in controlled:
            b = by_id[bid]
            v = source["values"].get((bid, ctl), b.params[ctl])
            if dev.key == "pod_go" and isinstance(v, bool):
                v = int(v)
            values.setdefault(f"dsp{b.dsp}", {}).setdefault(b.key, {})[ctl] = {"@fs_enabled": False, "@value": v}
        if values:
            snap["controllers"] = values
        return snap

    for n in range(dev.snapshots):
        tone[f"snapshot{n}"] = snapshot_json(n, plans[n] if n < len(plans) else None)

    # the preset loads in snapshot 1, so the blocks start in that snapshot's state
    first = plans[0]
    for b in blocks:
        tone[f"dsp{b.dsp}"][b.key]["@enabled"] = first["state"][b.id]
        for (bid, ctl) in controlled:
            if bid == b.id and (bid, ctl) in first["values"]:
                tone[f"dsp{b.dsp}"][b.key][ctl] = first["values"][(bid, ctl)]
    for dsp_key, sw in footswitch.items():
        for bkey, entry in sw.items():
            entry["@fs_enabled"] = tone[dsp_key][bkey]["@enabled"]

    if controller:
        tone["controller"] = controller
    if footswitch:
        tone["footswitch"] = footswitch

    g = tone["global"]
    g["@tempo"] = tempo
    g["@current_snapshot"] = 0
    amp = next((b for b in blocks if b.category == "amp"), blocks[0])
    if dev.key == "pod_go":
        g["@cursor_group"] = amp.key
    else:
        g["@topology0"] = "SABJ" if 0 in sections else "A"
        g["@topology1"] = "SABJ" if 1 in sections else "A"
        # presets with blocks carry the cursor as a block key; the blank one uses path/position
        g.pop("@cursor_path", None)
        g.pop("@cursor_position", None)
        g["@cursor_dsp"], g["@cursor_group"] = amp.dsp, amp.key

    firmware = spec.get("firmware", dev.firmware)
    return {
        "version": 6,
        "data": {
            "device": dev.device_id,
            "device_version": firmware,
            "meta": {"application": dev.application, "appversion": firmware, "build_sha": "",
                     "modifieddate": int(time.time()), "name": spec["name"]},
            "tone": tone,
        },
        "meta": {"original": 0, "pbn": 0, "premium": 0},
        "schema": "L6Preset",
    }


def build(spec: dict) -> Result:
    """Build a preset from a spec. Raises BuildError listing every problem found."""
    try:
        check_shape(spec)
    except SpecError as exc:
        raise BuildError([str(exc)]) from exc
    dev = DEVICES[spec["device"]]
    cat = catmod.get(dev.key)
    problems: list[str] = []
    warnings: list[str] = []

    blocks, items, explicit = resolve_chain(spec, cat, dev, problems, warnings)
    if problems:
        raise BuildError(problems)

    sections: dict = {}
    if dev.key == "pod_go":
        blocks, loads = place_podgo(blocks, cat, dev, problems, warnings)
    else:
        _default_widths(blocks, cat)
        loads, sections = place_helix(items, blocks, cat, dev, problems, warnings)
    if problems:
        raise BuildError(problems)
    _default_pedals(blocks, dev, explicit)

    if not any(b.category == "amp" for b in blocks):
        warnings.append("no amp block in the chain")
    if any(b.category == "amp" for b in blocks) and not any(b.category == "cab" for b in blocks):
        warnings.append("amp without a cab block: fine into a guitar cab or a Powercab speaker model, harsh into a PA or headphones")

    plans, controlled = plan_snapshots(spec, blocks, cat, dev, problems, warnings)
    if problems:
        raise BuildError(problems)
    preset = _assemble(spec, blocks, plans, controlled, cat, dev, sections)
    return Result(device=dev, name=spec["name"], preset=preset, blocks=blocks, loads=loads,
                  warnings=warnings, snapshots=plans)
