"""The measuring and tuning code, exercised on the stand-in renderer. Needs numpy."""
import copy
import json
import os
import tempfile
import unittest

try:
    import numpy as np
    from helixtone import audio, history, render, tune
except ImportError:           # numpy is optional for building presets
    np = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


@unittest.skipIf(np is None, "numpy not installed")
class Audio(unittest.TestCase):
    def test_wav_round_trip(self):
        x = audio.test_signal(seconds=1.0)
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x.wav")
            audio.write_wav(p, x)
            y, sr = audio.read_wav(p)
        self.assertEqual(sr, audio.SR)
        self.assertLess(float(np.max(np.abs(audio.mono(y) - x))), 1e-6)

    def test_features_follow_the_sound(self):
        sr = audio.SR
        t = np.arange(sr * 2) / sr
        low, high = 0.25 * np.sin(2 * np.pi * 110 * t), 0.25 * np.sin(2 * np.pi * 4000 * t)
        fl, fh = audio.features(low, sr), audio.features(high, sr)
        self.assertAlmostEqual(fl["level_db"], -15.05, delta=0.1)
        self.assertAlmostEqual(fl["crest_db"], 3.01, delta=0.1)          # a sine
        self.assertLess(fl["centroid_hz"], 200)
        self.assertGreater(fh["centroid_hz"], 3500)
        self.assertGreater(fh["loudness_db"], fl["loudness_db"])         # same RMS, the ear hears 4 kHz louder
        self.assertEqual(audio.distance(fl, fl), 0.0)
        self.assertGreater(audio.distance(fl, fh), 10)
        # 6 dB more level changes loudness by 6 and nothing about the balance
        f2 = audio.features(low * 2, sr)
        self.assertAlmostEqual(f2["loudness_db"] - fl["loudness_db"], 6.02, delta=0.05)
        self.assertLess(audio.distance(fl, f2), 0.01)

    def test_signal_is_repeatable(self):
        self.assertTrue(np.array_equal(audio.test_signal(seconds=2.0), audio.test_signal(seconds=2.0)))


@unittest.skipIf(np is None, "numpy not installed")
class Tuning(unittest.TestCase):
    def setUp(self):
        with open(os.path.join(ROOT, "tones", "daniel-lt", "hendrix.json"), encoding="utf-8") as fh:
            self.spec = json.load(fh)
        self.di = audio.test_signal(seconds=4.0)
        self.r = render.SimRenderer()

    def test_a_pod_go_tone_is_measured_as_its_helix_twin(self):
        with open(os.path.join(ROOT, "tones", "david-podgo", "jm-funk.json"), encoding="utf-8") as fh:
            pod = json.load(fh)
        twin = tune.helix_twin(tune.with_ids(pod))
        self.assertEqual(twin["device"], "helix_lt")
        self.assertEqual(tune.snapshot_preset(tune.with_ids(pod), 0)["data"]["device"], 2162692)
        feats = tune.measure(pod, self.r, self.di, audio.SR)
        self.assertEqual(len(feats), len(pod["snapshots"]))

    def test_level_match_reaches_targets(self):
        new, report = tune.level_match(self.spec, self.r, self.di, offsets={"Ambient": 2.0})
        self.assertTrue(all(row["reached"] for row in report))
        feats = tune.measure(new, self.r, self.di, audio.SR)
        base = feats[0]["loudness_db"]
        self.assertAlmostEqual(feats[2]["loudness_db"], base, delta=0.35)
        self.assertAlmostEqual(feats[3]["loudness_db"], base + 2.0, delta=0.35)
        # only the level control moved, and the result still builds
        was, now = self.spec["snapshots"][2]["set"]["amp"], new["snapshots"][2]["set"]["amp"]
        self.assertEqual({k for k in now if now[k] != was.get(k)} - {"ChVol"}, set())

    def test_match_moves_toward_a_known_target(self):
        target_spec = copy.deepcopy(self.spec)
        for b in target_spec["chain"]:
            if b.get("id") == "amp":
                b["params"].update({"BrtDrive": 0.3, "Treble": 0.35, "Bass": 0.7})
        want = audio.features(self.r.render(tune.snapshot_preset(tune.with_ids(target_spec), 1), self.di, audio.SR))
        new, report = tune.match(self.spec, self.r, self.di, want, snapshot=1)
        self.assertLess(report["distance_after"], report["distance_before"] * 0.5)
        amp = tune.blocks_of(new)["amp"]["params"]
        self.assertLess(amp["Treble"], 0.65)
        self.assertGreater(amp["Bass"], 0.5)

    def test_unknown_knob_is_named(self):
        with self.assertRaises(ValueError) as ctx:
            tune.match(self.spec, self.r, self.di, audio.features(self.di), knobs=["amp.Sparkle"])
        self.assertIn("amp.Sparkle", str(ctx.exception))


@unittest.skipIf(np is None, "numpy not installed")
class History(unittest.TestCase):
    def test_record_and_read_back(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "t.json")
            history.record(p, {"name": "T"}, "change", "too bright")
            history.record(p, {"name": "T"}, "keep", "better")
            self.assertEqual([e["verdict"] for e in history.load(p)], ["change", "keep"])
            self.assertEqual(len(history.recent(d)), 2)
            with self.assertRaises(ValueError):
                history.record(p, {}, "meh")

    def test_habits_from_presets(self):
        files = [os.path.join(ROOT, "tones", "daniel-lt", f) for f in ("edge-wah.hlx", "hendrix.hlx")]
        h = history.habits(files)
        self.assertEqual(h["presets"], 2)
        self.assertIn("Essex A30", dict(h["models"]["amp"]))


if __name__ == "__main__":
    unittest.main()
