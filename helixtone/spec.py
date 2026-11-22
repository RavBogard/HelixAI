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
              "min": 0, "max": 0.6} assigns any other control.
  footswitch  a stomp switch number, or "toe" for the expression pedal's toe switch
  dsp         Helix only: force the block onto processor 0 or 1
"""
from __future__ import annotations

import json

DEVICES = ("helix_lt", "pod_go")
NAME_MAX = 16

BLOCK_KEYS = {"id", "model", "enabled", "params", "stereo", "trails", "pedal", "footswitch", "dsp", "note"}
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
    for i, blk in enumerate(spec["chain"]):
        if not isinstance(blk, dict) or "model" not in blk:
            raise SpecError(f"chain[{i}] must be an object with a 'model'")
        extra = set(blk) - BLOCK_KEYS
        if extra:
            raise SpecError(f"chain[{i}] ({blk['model']}): unknown field(s) {sorted(extra)}")
        if not isinstance(blk.get("params", {}), dict):
            raise SpecError(f"chain[{i}] ({blk['model']}): params must be an object")
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
