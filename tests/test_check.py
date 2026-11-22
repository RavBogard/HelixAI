"""The checks on a tone: what the spec alone shows, and what a render shows (stand-in renderer)."""
import copy
import json
import os
import unittest

try:
    import numpy as np
    from helixtone import audio, check, render, tune
except ImportError:
    np = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def texts(findings, kind=None):
    return " | ".join(f["text"] for f in findings if kind is None or f["kind"] == kind)


@unittest.skipIf(np is None, "numpy not installed")
class Check(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(ROOT, "tones", "daniel-lt", "hendrix.json"), encoding="utf-8") as fh:
            self.spec = json.load(fh)

    def test_shipped_tones_have_no_defects_in_the_spec(self):
        for name in ("hendrix", "edge-wah"):
            with open(os.path.join(ROOT, "tones", "daniel-lt", name + ".json"), encoding="utf-8") as fh:
                found = check.static(json.load(fh), max_snapshots=4, max_stomps=4)
            self.assertEqual(texts(found, "defect"), "", name)

    def test_spec_rules(self):
        s = copy.deepcopy(self.spec)
        for b in s["chain"]:
            if b.get("id") == "verb":
                b.pop("trails", None)
            if b.get("id") == "cab":
                b["params"].update({"HighCut": 20000.0, "LowCut": 20.0})
        s["snapshots"][1].setdefault("set", {})["amp"] = {"BrtDrive": 0.9}
        found = texts(check.static(s, max_snapshots=2, max_stomps=1))
        for expected in ("trails are off", "high cut is open", "low cut is open", "drive but not its Channel Volume",
                         "4 snapshots", "stomp switches"):
            self.assertIn(expected, found)
        self.assertIn("cab on a cab", texts(check.static(self.spec, full_range=False)))
        no_cab = copy.deepcopy(self.spec)
        no_cab["chain"] = [b for b in no_cab["chain"] if b.get("id") != "cab"]
        self.assertIn("no cab block", texts(check.static(no_cab)))

    def test_measured_flags_a_snapshot_left_loud(self):
        r, di = render.SimRenderer(), audio.test_signal(seconds=4.0)
        level, _ = tune.level_match(self.spec, r, di)
        self.assertNotIn("from where it should sit", texts(check.measured(level, r, di, audio.SR)[0]))
        loud = copy.deepcopy(level)
        loud["snapshots"][2]["set"]["amp"]["ChVol"] = 1.0
        self.assertIn("'Lead' is +", texts(check.measured(loud, r, di, audio.SR)[0], "defect"))

    def test_level_brings_presets_to_a_shared_loudness(self):
        r, di = render.SimRenderer(), audio.test_signal(seconds=4.0)
        new, report = tune.level_match(self.spec, r, di, level=-20.0)
        self.assertTrue(all(row["reached"] for row in report))
        self.assertAlmostEqual(tune.measure(new, r, di, audio.SR)[0]["loudness_db"], -20.0, delta=0.35)


if __name__ == "__main__":
    unittest.main()

    def test_layout_is_enforced(self):
        layout = {"snapshots": ["Clean", "Crunch", "Lead", "Ambient"], "stomps_stay": True,
                  "stomp_row": {"8": ["drive"], "9": ["mod"], "10": ["delay"], "11": ["reverb"]}, "extra_switches": [2, 3, 4, 5]}
        self.assertEqual(texts(check.static(self.spec, layout=layout), "defect"), "")
        s = copy.deepcopy(self.spec)
        s["snapshots"][0]["name"] = "Little Wng"
        fuzz = next(b for b in s["chain"] if b.get("id") == "fuzz")
        fuzz.pop("stays")
        fuzz["footswitch"] = 10
        found = texts(check.static(s, layout=layout), "defect")
        for expected in ("all start Clean, Crunch, Lead, Ambient", 'without "stays"', "this player's delay switch"):
            self.assertIn(expected, found)

    def test_stomp_step_is_measured_and_trimmed(self):
        r, di = render.SimRenderer(), audio.test_signal(seconds=4.0)
        new, report = tune.level_stomps(self.spec, r, di, step=1.5)
        self.assertTrue(report and all(row["reached"] for row in report if row["control"]))
        for row in tune.stomp_steps(new, r, di):
            if row["category"] == "drive":
                self.assertAlmostEqual(row["on_minus_off_db"], 1.5, delta=0.5)
