"""Each player's layout, as data the checks and the leveller read.

`rig/players.json` is keyed by the folder a tone lives in (`tones/daniel-lt/`
-> "daniel-lt"). `rig/rig.md` says the same things in words and why; when one
changes, change the other.

  level         loudness every preset's first snapshot is brought to
  offsets       snapshots meant to sit above that, by name, in dB
  snapshots     the roles of the first snapshots, in order, on every preset
  stomps_stay   a stomp the player switched keeps its state across snapshots
  stomp_row     switch number -> the kinds of effect that belong on it
  extra_switches  further stomp switches, free for whatever the preset needs
"""
from __future__ import annotations

import json
import os

PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rig", "players.json")


def load(path: str = PATH) -> dict:
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def for_spec(spec_path: str, path: str = PATH) -> dict:
    """The layout for the folder this spec is in, or {} if that folder has none."""
    folder = os.path.basename(os.path.dirname(os.path.abspath(spec_path)))
    return load(path).get(folder, {})
