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


class PodGoBuild(unittest.TestCase):
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
        specs = sorted(glob.glob(os.path.join(ROOT, "tones", "**", "*.json"), recursive=True))
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
