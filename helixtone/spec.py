"""The tone spec: the one hand-written (or Claude-written) description of a preset.

A spec says which blocks, in what order, with which controls moved off their
defaults, and what each snapshot changes. It never contains file-format detail;
the builders derive that from the catalog.

    {
      "name": "Edge Wah",                 # 16 characters at most
      "device": "helix_lt",               # or "pod_go"
      "tempo": 120,
      "notes": "free text, kept with the spec only",
      "chain": [
        {"id": "wah", "model": "Fassel", "enabled": false,
         "params": {"FcHigh": 2200}, "pedal": "exp1", "footswitch": "toe"},
        {"id": "amp", "model": "Essex A30", "params": {"Drive": 0.45}},
        {"id": "cab", "model": "2x12 Blue Bell"},
        {"id": "dly", "model": "Simple Delay", "stereo": true, "footswitch": 3}
      ],
      "snapshots": [
        {"name": "Clean", "off": ["dly"]},
        {"name": "Lead", "on": ["dly"], "set": {"amp": {"Drive": 0.6}}}
      ]
    }

Block fields:
  id          short handle used by snapshots; defaults to the model's category
  model       display name or model id, resolved against the device catalog
  enabled     state when the preset loads (default true)
  params      controls to move off the model's default, in the file's raw units
  stereo      Helix only, for models that come in both widths; default is mono
              before the amp and stereo after the cab
  trails      delays and reverbs: let the tail ring out when bypassed
  pedal       "exp1" or "exp2": the expression pedal sweeps this block's
              Pedal control (wah, volume). {"control": "Mix", "source": "exp1",
              "min": 0, "max": 0.6} assigns any other control; a list of those
              puts several controls on the pedal.
  footswitch  a stomp switch number, or "toe" for the expression pedal's toe switch;
              {"switch": 9, "momentary": true} for a switch that is on only while held
  stays       Helix only: snapshots leave this block's on/off state alone, so a
              stomp the player switched stays that way when the snapshot changes
  dual        Helix cab blocks only: a second cab mixed with this one,
              {"model": "4x12 Greenback 25", "params": {"Mic": "121 Ribbon", "Pan": 0.7}}
  dsp         Helix only: force the block onto processor 0 or 1

Controls with named choices take the name or the number:
  "SyncSelect1": "1/8 Dotted", "Mic": "57 Dynamic". For a delay that follows tap
  tempo set "TempoSync1": true and "SyncSelect1" to the note value.

Parallel paths (Helix only). In place of a block, a chain entry can be a split:

    {"split": "y",                       # "y", "ab" or "crossover"
     "params": {"BalanceA": 0.5},        # the split's own controls
     "a": [ ...blocks on path A... ],
     "b": [ ...blocks on path B... ],
     "join": {"B Level": -3, "A Pan": 0.3, "B Pan": 0.7}}

The paths join again before the next chain entry. One split fits on each
processor. Typical uses: two amps, two cabs, or a dry path beside a wet one.
"""
from __future__ import annotations

import json

DEVICES = ("helix_lt", "pod_go")
NAME_MAX = 16

BLOCK_KEYS = {"id", "model", "enabled", "params", "stereo", "trails", "pedal", "footswitch", "dsp", "dual", "note", "stays"}
SPLIT_KEYS = {"split", "params", "join", "a", "b", "note"}
SNAP_KEYS = {"name", "on", "off", "set", "colour", "note"}
TOP_KEYS = {"name", "device", "tempo", "notes", "chain", "snapshots", "firmware", "variant"}


class SpecError(ValueError):
    pass


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        try:
            spec = json.load(fh)
        except json.JSONDecodeError as exc:
            raise SpecError(f"{path}: not valid JSON ({exc})") from exc
    check_shape(spec)
    return spec


def check_shape(spec: dict) -> None:
    """Structural checks that need no catalog. Raises SpecError on the first problem."""
    if not isinstance(spec, dict):
        raise SpecError("a spec is a JSON object")
    extra = set(spec) - TOP_KEYS
    if extra:
        raise SpecError(f"unknown top-level field(s): {sorted(extra)}. Allowed: {sorted(TOP_KEYS)}")
    for req in ("name", "device", "chain"):
        if req not in spec:
            raise SpecError(f"missing required field {req!r}")
    if spec["device"] not in DEVICES:
        raise SpecError(f"device must be one of {DEVICES}, got {spec['device']!r}")
    name = spec["name"]
    if not isinstance(name, str) or not name.strip():
        raise SpecError("name must be a non-empty string")
    if len(name) > NAME_MAX:
        raise SpecError(f"name {name!r} is {len(name)} characters; the device shows {NAME_MAX}")
    if not isinstance(spec["chain"], list) or not spec["chain"]:
        raise SpecError("chain must be a non-empty list of blocks")
    def check_block(blk, where):
        if not isinstance(blk, dict) or "model" not in blk:
            raise SpecError(f"{where} must be an object with a 'model'")
        extra = set(blk) - BLOCK_KEYS
        if extra:
            raise SpecError(f"{where} ({blk['model']}): unknown field(s) {sorted(extra)}")
        if not isinstance(blk.get("params", {}), dict):
            raise SpecError(f"{where} ({blk['model']}): params must be an object")

    for i, blk in enumerate(spec["chain"]):
        if isinstance(blk, dict) and "split" in blk:
            extra = set(blk) - SPLIT_KEYS
            if extra:
                raise SpecError(f"chain[{i}] (split): unknown field(s) {sorted(extra)}")
            for lane in ("a", "b"):
                if not isinstance(blk.get(lane, []), list):
                    raise SpecError(f"chain[{i}] (split): '{lane}' must be a list of blocks")
                for j, sub in enumerate(blk.get(lane, [])):
                    check_block(sub, f"chain[{i}].{lane}[{j}]")
        else:
            check_block(blk, f"chain[{i}]")
    snaps = spec.get("snapshots", [])
    if not isinstance(snaps, list):
        raise SpecError("snapshots must be a list")
    for i, s in enumerate(snaps):
        if not isinstance(s, dict) or "name" not in s:
            raise SpecError(f"snapshots[{i}] must be an object with a 'name'")
        extra = set(s) - SNAP_KEYS
        if extra:
            raise SpecError(f"snapshots[{i}] ({s['name']}): unknown field(s) {sorted(extra)}")
    tempo = spec.get("tempo", 120)
    if isinstance(tempo, bool) or not isinstance(tempo, (int, float)) or not 20 <= tempo <= 240:
        raise SpecError(f"tempo must be 20..240, got {tempo!r}")
