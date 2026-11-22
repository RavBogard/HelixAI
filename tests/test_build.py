"""Checks that need nothing but the repository."""
import glob
import json
import os
import unittest

from helixtone import BuildError, build, reader
from helixtone import catalog as catmod

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def helix(chain, **kw):
    return {"name": "Test", "device": "helix_lt", "chain": chain, **kw}


def podgo(chain, **kw):
    return {"name": "Test", "device": "pod_go", "chain": chain, **kw}


BASIC = [{"model": "Fassel", "enabled": False}, {"id": "od", "model": "Scream 808", "footswitch": 2},
         {"id": "amp", "model": "US Deluxe Nrm"}, {"id": "cab", "model": "1x12 US Deluxe"},
         {"id": "dly", "model": "Simple Delay"}, {"id": "verb", "model": "Plate"}]


class Catalogs(unittest.TestCase):
    def test_every_default_is_within_its_own_range(self):
        for device in ("helix_lt", "pod_go"):
            cat = catmod.get(device)
            for mid, b in cat.blocks.items():
                for key, p in b["params"].items():
                    if p["type"] in ("float", "int") and isinstance(p["default"], (int, float)):
                        cat.check_param(mid, key, p["default"])

    def test_names_resolve_and_prefer_the_full_amp(self):
        cat = catmod.get("helix_lt")
        self.assertEqual(cat.resolve("US Double Nrm"), "HD2_AmpUSDoubleNrm")
        self.assertEqual(cat.resolve("essex a30"), "HD2_AmpEssexA30")
        self.assertEqual(cat.resolve("2x12 Blue Bell"), "HD2_CabMicIr_2x12BlueBell")
        with self.assertRaises(catmod.CatalogError):
            cat.resolve("Dumble Overdrive Special")

    def test_a_helix_id_finds_its_pod_go_twin(self):
        self.assertEqual(catmod.get("pod_go").resolve("HD2_DistScream808"), "HD2_DistScream808Mono")


class HelixBuild(unittest.TestCase):
    def test_structure(self):
        res = build(helix(BASIC, snapshots=[{"name": "Clean", "off": ["od"]},
                                            {"name": "Lead", "on": ["od"], "set": {"amp": {"Drive": 0.7}}}]))
        doc = res.preset
        self.assertEqual((doc["schema"], doc["version"], doc["data"]["device"]), ("L6Preset", 6, 2162692))
        tone = doc["data"]["tone"]
        blocks = [b for _d, _k, b in reader.chain(tone)]
        self.assertEqual([b["@type"] for b in blocks], [0, 0, 1, 2, 7, 7])
        self.assertEqual([b.get("@stereo") for b in blocks], [False, False, None, None, True, None])
        self.assertTrue(all(b["@path"] == 0 for b in blocks))
        self.assertEqual(tone["global"]["@topology0"], "A")
        # snapshot 1 is what the preset loads in
        self.assertFalse(tone["dsp0"]["block1"]["@enabled"])
        self.assertTrue(tone["snapshot1"]["blocks"]["dsp0"]["block1"])
        self.assertEqual(tone["snapshot1"]["controllers"]["dsp0"]["block2"]["Drive"]["@value"], 0.7)
        self.assertEqual(tone["controller"]["dsp0"]["block2"]["Drive"]["@controller"], 19)
        self.assertFalse(tone["snapshot2"]["@valid"])
        # wah defaults to EXP1 on the toe switch
        self.assertEqual(tone["controller"]["dsp0"]["block0"]["Pedal"]["@controller"], 1)
        self.assertEqual(tone["footswitch"]["dsp0"]["block0"]["@fs_index"], 13)

    def test_heavy_chain_spills_to_the_second_processor(self):
        chain = [{"id": "amp", "model": "US Deluxe Nrm"}, {"id": "cab", "model": "1x12 US Deluxe"}]
        chain += [{"id": f"v{i}", "model": "Glitz"} for i in range(8)]
        res = build(helix(chain))
        tone = res.preset["data"]["tone"]
        self.assertTrue(any(k.startswith("block") for k in tone["dsp1"]))
        self.assertEqual(tone["dsp0"]["outputA"]["@output"], 2)
        self.assertEqual(tone["dsp1"]["inputA"]["@input"], 0)
        self.assertLessEqual(res.loads["dsp0"], 100)

    def test_overload_is_refused_with_the_reason(self):
        chain = [{"id": f"v{i}", "model": "Glitz"} for i in range(16)] + [{"id": f"a{i}", "model": "US Deluxe Nrm"} for i in range(6)]
        with self.assertRaises(BuildError) as ctx:
            build(helix(chain))
        self.assertIn("processor", str(ctx.exception))

    def test_bad_values_are_named(self):
        with self.assertRaises(BuildError) as ctx:
            build(helix([{"model": "US Deluxe Nrm", "params": {"Drive": 7, "Gain": 0.5}}]))
        text = str(ctx.exception)
        self.assertIn("above its maximum", text)
        self.assertIn("no control 'Gain'", text)

    def test_snapshot_naming_an_unknown_block(self):
        with self.assertRaises(BuildError) as ctx:
            build(helix(BASIC, snapshots=[{"name": "A", "on": ["fuzz"]}]))
        self.assertIn("unknown block 'fuzz'", str(ctx.exception))


class HelixRicher(unittest.TestCase):
    def test_named_choices(self):
        res = build(helix([{"id": "amp", "model": "US Deluxe Nrm"},
                           {"id": "cab", "model": "1x12 US Deluxe", "params": {"Mic": "121 Ribbon"}},
                           {"id": "dly", "model": "Simple Delay",
                            "params": {"TempoSync1": True, "SyncSelect1": "1/8 dotted"}}]))
        dsp = res.preset["data"]["tone"]["dsp0"]
        self.assertEqual(dsp["block1"]["Mic"], 5)
        self.assertEqual((dsp["block2"]["TempoSync1"], dsp["block2"]["SyncSelect1"]), (True, 8))
        with self.assertRaises(BuildError) as ctx:
            build(helix([{"model": "Simple Delay", "params": {"SyncSelect1": "1/5"}}]))
        self.assertIn("1/8 Dotted", str(ctx.exception))

    def test_split_two_amps(self):
        res = build(helix([
            {"id": "od", "model": "Minotaur"},
            {"split": "y", "join": {"A Pan": 0.3, "B Pan": 0.7},
             "a": [{"id": "amp_a", "model": "US Deluxe Nrm"}, {"id": "cab_a", "model": "1x12 US Deluxe"}],
             "b": [{"id": "amp_b", "model": "Essex A30"}]},
            {"id": "verb", "model": "Plate"}],
            snapshots=[{"name": "Both"}, {"name": "Vox only", "off": ["amp_a", "cab_a"]}]))
        tone = res.preset["data"]["tone"]
        d = tone["dsp0"]
        self.assertEqual(tone["global"]["@topology0"], "SABJ")
        self.assertEqual((d["split"]["@position"], d["join"]["@position"]), (1, 3))
        self.assertEqual(d["join"]["A Pan"], 0.3)
        layout = {k: (b["@model"], b["@path"], b["@position"]) for k, b in d.items() if k.startswith("block")}
        self.assertEqual(layout["block3"], ("HD2_ReverbPlate", 0, 3))          # after the join
        self.assertEqual(layout["block4"], ("HD2_AmpEssexA30", 1, 1))          # path B is numbered last
        self.assertTrue(tone["snapshot0"]["blocks"]["dsp0"]["split"])
        self.assertFalse(tone["snapshot1"]["blocks"]["dsp0"]["block1"])

    def test_dual_cab(self):
        res = build(helix([{"id": "amp", "model": "Brit Plexi Jump"},
                           {"id": "cab", "model": "4x12 Greenback 25", "params": {"Mic": "57 Dynamic", "Pan": 0.3},
                            "dual": {"model": "4x12 Greenback 20", "params": {"Mic": "121 Ribbon", "Pan": 0.7}}}]))
        d = res.preset["data"]["tone"]["dsp0"]
        cab = d["block1"]
        self.assertEqual((cab["@type"], cab["@cab"], cab["@model"]), (4, "cab0", "HD2_CabMicIr_4x12Greenback25WithPan"))
        self.assertEqual((d["cab0"]["@model"], d["cab0"]["Mic"], d["cab0"]["Pan"]),
                         ("HD2_CabMicIr_4x12Greenback20WithPan", 5, 0.7))
        self.assertEqual(sorted(k for k in d["cab0"] if k.startswith("@")), ["@enabled", "@model"])

    def test_momentary_switch_and_two_pedal_controls(self):
        res = build(helix([{"id": "dly", "model": "Simple Delay", "footswitch": {"switch": 9, "momentary": True},
                            "pedal": [{"control": "Mix", "source": "exp2", "min": 0, "max": 0.5},
                                      {"control": "Feedback", "source": "exp2"}]}]))
        tone = res.preset["data"]["tone"]
        self.assertTrue(tone["footswitch"]["dsp0"]["block0"]["@fs_momentary"])
        self.assertEqual(sorted(tone["controller"]["dsp0"]["block0"]), ["Feedback", "Mix"])
        self.assertEqual(tone["controller"]["dsp0"]["block0"]["Mix"]["@max"], 0.5)

    def test_a_stomp_that_stays_ignores_snapshots(self):
        chain = [dict(b) for b in BASIC]
        chain[1]["stays"] = True
        res = build(helix(chain, snapshots=[{"name": "A"}, {"name": "B", "set": {"amp": {"Drive": 0.7}}}]))
        tone = res.preset["data"]["tone"]
        flags = {b["@model"]: b["@no_snapshot_bypass"] for d in ("dsp0", "dsp1") for k, b in tone[d].items() if k.startswith("block")}
        self.assertEqual([m for m, f in flags.items() if f], ["HD2_DistScream808"])
        # and it reads back as the same spec field
        back = reader.to_spec({"name": "T", "device": 2162692, "device_version": 0, "tone": tone}, "helix_lt")
        self.assertEqual([b["id"] for b in back["chain"] if b.get("stays")], ["drive"])
        with self.assertRaises(BuildError) as cm:
            build(helix(chain, snapshots=[{"name": "A"}, {"name": "B", "off": ["od"]}]))
        self.assertIn("stays", str(cm.exception))

    def test_third_split_is_refused(self):
        sec = lambda n: {"split": "y", "a": [{"id": f"a{n}", "model": "Plate"}], "b": [{"id": f"b{n}", "model": "Plate"}]}
        with self.assertRaises(BuildError) as ctx:
            build(helix([sec(1), sec(2), sec(3)]))
        self.assertIn("one split fits on each processor", str(ctx.exception))


class PodGoBuild(unittest.TestCase):
    def test_no_splits_or_dual_cabs(self):
        with self.assertRaises(BuildError) as ctx:
            build(podgo([{"id": "amp", "model": "US Deluxe Nrm"}, {"id": "cab", "model": "1x12 US Deluxe"},
                         {"split": "y", "a": [], "b": [{"model": "Plate"}]}]))
        self.assertIn("single path", str(ctx.exception))

    def test_builtins_are_added_and_slots_filled(self):
        res = build(podgo([{"id": "amp", "model": "US Deluxe Nrm"}, {"id": "cab", "model": "1x12 US Deluxe"},
                           {"model": "Simple Delay"}, {"model": "Plate"}]))
        doc = res.preset
        self.assertEqual(doc["data"]["device"], 2162695)
        dsp = doc["data"]["tone"]["dsp0"]
        self.assertEqual(sorted(k for k in dsp if k.startswith("block")), [f"block{i}" for i in range(10)])
        models = [dsp[f"block{i}"].get("@model", "") for i in range(10)]
        for prefix in ("HD2_VolPan", "HD2_Wah", "HD2_FXLoop", "HD2_Amp", "HD2_Cab", "HD2_EQ_STATIC_"):
            self.assertEqual(sum(m.startswith(prefix) for m in models), 1, prefix)
        self.assertEqual(dsp["block9"], {"@position": 9})
        self.assertEqual(doc["data"]["tone"]["dsp1"], {})
        self.assertEqual(dsp["input"]["@model"], "P34_AppDSPFlowInput")
        delay = next(b for b in dsp.values() if b.get("@model", "").startswith("HD2_DelaySimple"))
        self.assertEqual((delay["@type"], delay["@trails"]), (5, False))
        self.assertNotIn("@path", delay)

    def test_a_fifth_free_effect_is_refused(self):
        chain = [{"id": "amp", "model": "US Deluxe Nrm"}, {"id": "cab", "model": "1x12 US Deluxe"}]
        chain += [{"model": m} for m in ("Scream 808", "Simple Delay", "Plate", "70s Chorus", "Minotaur")]
        with self.assertRaises(BuildError) as ctx:
            build(podgo(chain))
        self.assertIn("4 free effect blocks", str(ctx.exception))

    def test_amp_and_cab_are_required(self):
        with self.assertRaises(BuildError):
            build(podgo([{"model": "Plate"}]))


class ShippedTones(unittest.TestCase):
    def test_every_spec_in_tones_builds(self):
        specs = sorted(p for p in glob.glob(os.path.join(ROOT, "tones", "**", "*.json"), recursive=True)
                       if not p.endswith(".history.json"))     # the record tuning keeps beside a spec
        self.assertTrue(specs)
        for path in specs:
            with self.subTest(os.path.basename(path)):
                with open(path, encoding="utf-8") as fh:
                    res = build(json.load(fh))
                # what we wrote reads back as the same chain
                again = reader.to_spec({"name": res.name, "device": res.device.device_id,
                                        "device_version": 0, "tone": res.preset["data"]["tone"]})
                self.assertEqual(len(again["chain"]), len(res.blocks))


if __name__ == "__main__":
    unittest.main()
