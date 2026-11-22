"""The atlas and the auto loop, exercised on the stand-in renderer. Needs numpy."""
import os
import tempfile
import unittest

try:
    import numpy as np
    from helixtone import atlas, audio, auto, render
    from helixtone.builder import build
except ImportError:
    np = None


@unittest.skipIf(np is None, "numpy not installed")
class AtlasAndAuto(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = render.SimRenderer()
        cls.path = os.path.join(tempfile.mkdtemp(), "atlas.json")
        jobs = atlas.plan()
        keep = {j["key"] for j in [j for j in jobs if j["kind"] == "amp"][:9] + [j for j in jobs if j["kind"] == "cab"][:4]}
        cls.jobs = [j for j in jobs if j["key"] in keep]
        cls.full_plan = staticmethod(atlas.plan)
        atlas.plan = lambda device="helix_lt": cls.jobs
        cls.data = atlas.measure(cls.r, cls.path, say=lambda *_: None)

    @classmethod
    def tearDownClass(cls):
        atlas.plan = cls.__dict__["full_plan"].__func__

    def test_plan_covers_amps_cabs_and_drives_and_all_build(self):
        jobs = self.full_plan()
        kinds = {j["kind"] for j in jobs}
        self.assertEqual(kinds, {"amp", "cab", "drive"})
        self.assertEqual(len({j["key"] for j in jobs}), len(jobs))
        for j in jobs[::25]:
            build(j["spec"])

    def test_measure_fills_in_and_resumes(self):
        self.assertEqual(len(self.data["entries"]), len(self.jobs))
        self.assertFalse(self.data["failed"])
        calls = []
        again = atlas.measure(self.r, self.path, say=calls.append)
        self.assertEqual(again["entries"], self.data["entries"])
        self.assertEqual(calls, [])          # nothing left to do

    def test_nearest_finds_a_pair_measured_for_real(self):
        amp = next(j for j in self.jobs if j["kind"] == "amp" and j["setting"] == "default")
        cab = next(j for j in self.jobs if j["kind"] == "cab")
        spec = auto._spec("T", "helix_lt", amp["model"], {}, cab["model"])
        target = audio.features(self.r.render(build(spec).preset, audio.test_signal(), audio.SR))
        best = atlas.nearest(self.data, target, count=3)
        self.assertLess(best[0]["distance"], 3.0)
        self.assertEqual(len({(b["amp_model"], b["cab_model"]) for b in best}), 3)

    def test_bench_scores_the_loop_and_tuning_does_not_make_it_worse(self):
        res = auto.bench(self.r, self.data, count=2, seed=3, log=None, shortlist=4, refine=1, rounds=2, say=lambda *_: None)
        self.assertEqual(res["count"], 2)
        for row in res["rows"]:
            self.assertLessEqual(row["distance"], row["first_guess"] + 1e-9)
        self.assertLess(res["mean_distance"], 3.0)


if __name__ == "__main__":
    unittest.main()
