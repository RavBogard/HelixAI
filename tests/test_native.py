"""Acceptance checks for the Helix Native renderer. Runs only where Helix Native is
installed, signed in and authorised (see .claude/skills/helix-tone/references/native-setup.md).

A renderer that played the wrong preset would make every measurement after it
meaningless, so these check that what comes out follows what went in.
"""
import copy
import os
import tempfile
import unittest

try:
    import numpy as np
    from helixtone import audio, render, tune
    from helixtone.builder import build
except ImportError:
    np = None

RENDERER = None
WHY = "numpy not installed"
if np is not None:
    try:
        RENDERER = render.NativeRenderer(cache=os.environ.get("HELIXTONE_NATIVE_TEST_CACHE") or tempfile.mkdtemp(prefix="helixtone-native-"))
    except render.RendererUnavailable as exc:
        WHY = str(exc)


def spec(amp="US Deluxe Nrm", amp_params=None, high_cut=20000.0, enabled=True, snapshots=None):
    return {
        "name": "Native check", "device": "helix_lt",
        "chain": [
            {"id": "amp", "model": amp, "enabled": enabled, "params": dict(amp_params or {})},
            {"id": "cab", "model": "1x12 US Deluxe", "enabled": enabled, "params": {"HighCut": high_cut}},
        ],
        "snapshots": snapshots or [{"name": "One"}],
    }


@unittest.skipIf(RENDERER is None, WHY)
class Native(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = RENDERER
        cls.di = audio.test_signal(seconds=4.0)

    @classmethod
    def tearDownClass(cls):
        cls.r.close()

    def feats(self, s, snapshot=0):
        return audio.features(self.r.render(tune.snapshot_preset(tune.with_ids(s), snapshot), self.di, audio.SR))

    def test_same_preset_same_numbers_in_any_order(self):
        clean, other = build(spec()).preset, build(spec(amp="Brit Plexi Brt")).preset
        a = self.r.render(clean, self.di, audio.SR)
        self.r.render(other, self.di, audio.SR)
        b = self.r.render(clean, self.di, audio.SR)
        c = self.r.render(clean, self.di, audio.SR)
        self.assertTrue(np.array_equal(a, b))
        self.assertTrue(np.array_equal(a, c))

    def test_high_gain_is_more_squashed_than_clean(self):
        clean = self.feats(spec(amp_params={"Drive": 0.2}))
        gain = self.feats(spec(amp="German Mahadeva", amp_params={"Drive": 0.9}))
        self.assertLess(gain["crest_db"], clean["crest_db"] - 3.0)

    def test_cab_high_cut_darkens(self):
        bright, dark = self.feats(spec(high_cut=20000.0)), self.feats(spec(high_cut=3000.0))
        self.assertLess(dark["centroid_hz"], bright["centroid_hz"] * 0.9)
        self.assertLess(dark["regions"]["high"], bright["regions"]["high"] - 3.0)

    def test_everything_bypassed_is_close_to_the_input(self):
        out = self.r.render(build(spec(enabled=False)).preset, self.di, audio.SR)
        got, want = audio.features(out), audio.features(self.di)
        self.assertAlmostEqual(got["loudness_db"], want["loudness_db"], delta=1.0)
        self.assertLess(audio.distance(got, want), 1.0)

    def test_snapshot_channel_volume_moves_only_that_snapshot(self):
        def three(ch_vol):
            return spec(amp_params={"ChVol": 0.6}, snapshots=[
                {"name": "One"}, {"name": "Two", "set": {"amp": {"ChVol": ch_vol}}}, {"name": "Three"}])
        before = [self.feats(three(0.6), n)["loudness_db"] for n in range(3)]
        after = [self.feats(three(0.3), n)["loudness_db"] for n in range(3)]
        self.assertAlmostEqual(after[0], before[0], delta=0.05)
        self.assertAlmostEqual(after[2], before[2], delta=0.05)
        self.assertLess(after[1], before[1] - 3.0)

    def test_what_the_plugin_took_is_checked(self):
        sent = build(spec()).preset
        changed = copy.deepcopy(sent)
        block = next(b for b in changed["data"]["tone"]["dsp0"].values() if isinstance(b, dict) and "HighCut" in b)
        block["HighCut"] = 1234.0
        self.assertIsNone(render.same_tone(sent, sent))
        self.assertIn("HighCut", render.same_tone(sent, changed))


if __name__ == "__main__":
    unittest.main()
