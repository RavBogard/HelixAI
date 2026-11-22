"""Turn a preset into audio, so it can be measured.

Everything that tunes a preset by measurement goes through one call:

    renderer.render(preset, di, sr) -> audio

`preset` is the preset document the builder produces. Three renderers:

  NativeRenderer   Helix Native, hosted from Python. The real thing for Helix
                   presets. Hosting and audio are straightforward; getting a
                   preset *into* the plugin from a script is the part that
                   has to be established on a machine that has it
                   (tools/native_probe.py), so until that is done this raises
                   RendererUnavailable with what to do.
  FolderRenderer   No scripting of the plugin at all: writes the preset and the
                   DI to a folder and waits for a bounce to appear. Slow, and
                   it needs a person, but it works with any setup.
  SimRenderer      A crude stand-in, NOT the Helix. It reacts to drive, tone
                   and level controls in roughly the right direction so the
                   tuning code can be developed and tested anywhere. Never
                   judge a tone by it.
"""
from __future__ import annotations

import json
import os
import time

import numpy as np

from . import reader
from . import catalog as catmod


class RendererUnavailable(RuntimeError):
    pass


class SimRenderer:
    name = "sim (not the Helix: for testing the tuning code only)"
    is_real = False

    def render(self, preset: dict, di: np.ndarray, sr: int) -> np.ndarray:
        tone = preset["data"]["tone"]
        device = reader.DEVICE_BY_ID.get(preset["data"]["device"], "helix_lt")
        cat = catmod.get(device)
        x = np.asarray(di, dtype=np.float64).copy()
        for _dsp, _key, blk in reader.chain(tone):
            if not blk.get("@enabled", True) or blk.get("@path") == 1:
                continue
            info = cat.blocks.get(blk["@model"])
            if not info:
                continue
            c = info["category"]
            if c == "drive":
                g = next((blk[k] for k in ("Gain", "Drive", "Fuzz") if k in blk), 0.5)
                x = np.tanh((1 + 12 * g) * x) * (0.3 + 0.9 * blk.get("Level", 0.5) if isinstance(blk.get("Level"), float) and blk.get("Level") <= 1 else 0.8)
            elif c == "amp":
                drive = max(blk.get(k, 0.0) for k in ("Drive", "BrtDrive", "NrmDrive", "Drive1") if k in blk) \
                    if any(k in blk for k in ("Drive", "BrtDrive", "NrmDrive", "Drive1")) else 0.5
                x = np.tanh((1 + 40 * drive ** 2) * x)
                x = self._eq(x, sr, [(110, 24 * (blk.get("Bass", 0.5) - 0.5), "low"),
                                     (700, 16 * (blk.get("Mid", 0.5) - 0.5), "peak"),
                                     (3200, 24 * (blk.get("Treble", 0.5) - 0.5), "high")])
                x = x * max(blk.get("ChVol", 0.7), 0.0) ** 2
            elif c == "cab":
                x = self._eq(x, sr, [(blk.get("LowCut", 20), 0, "lowcut"), (blk.get("HighCut", 20000), 0, "highcut")])
            elif c == "comp":
                env = np.sqrt(np.convolve(x ** 2, np.ones(480) / 480, mode="same")) + 1e-6
                x = x * np.minimum(1.0, (0.1 / env) ** 0.5) * 1.5
        return x

    @staticmethod
    def _eq(x, sr, bands):
        spec = np.fft.rfft(x)
        f = np.maximum(np.fft.rfftfreq(len(x), 1 / sr), 1e-3)
        gain = np.ones_like(f)
        for fc, db, kind in bands:
            if kind == "low":
                gain *= 10 ** (db / 20 / (1 + (f / fc) ** 2))
            elif kind == "high":
                gain *= 10 ** (db / 20 / (1 + (fc / f) ** 2))
            elif kind == "peak":
                gain *= 10 ** (db / 20 * np.exp(-0.5 * (np.log2(f / fc) / 1.0) ** 2))
            elif kind == "lowcut":
                gain *= (f / fc) ** 2 / np.sqrt(1 + (f / fc) ** 4)
            elif kind == "highcut":
                gain *= 1 / np.sqrt(1 + (f / fc) ** 4)
        return np.fft.irfft(spec * gain, len(x))


class FolderRenderer:
    """Hand-off through a folder: we write the preset and DI, something else writes the bounce."""
    name = "folder hand-off"
    is_real = True

    def __init__(self, folder: str, timeout: float = 900.0):
        self.folder, self.timeout, self.count = folder, timeout, 0
        os.makedirs(folder, exist_ok=True)

    def render(self, preset: dict, di: np.ndarray, sr: int) -> np.ndarray:
        from . import audio
        self.count += 1
        ext = ".pgp" if preset["data"]["device"] in (2162695, 2162696) else ".hlx"
        stem = os.path.join(self.folder, f"render_{self.count:03d}")
        with open(stem + ext, "w", encoding="utf-8") as fh:
            json.dump(preset, fh, indent=1)
        audio.write_wav(stem + "_di.wav", di, sr)
        want = stem + "_out.wav"
        print(f"  waiting for {want}\n  (load {os.path.basename(stem) + ext}, play {os.path.basename(stem)}_di.wav through it, save the result there)")
        deadline = time.time() + self.timeout
        while not os.path.exists(want):
            if time.time() > deadline:
                raise RendererUnavailable(f"no bounce appeared at {want}")
            time.sleep(1.0)
        time.sleep(0.5)
        x, got_sr = audio.read_wav(want)
        if got_sr != sr:
            raise RendererUnavailable(f"{want} is {got_sr} Hz, expected {sr}")
        return audio.mono(x)


class NativeRenderer:
    """Helix Native hosted with pedalboard (pip install pedalboard)."""
    name = "Helix Native"
    is_real = True

    PATHS = [
        r"C:\Program Files\Common Files\VST3\Helix Native.vst3",
        r"C:\Program Files\Common Files\VST3\Line 6\Helix Native.vst3",
        "/Library/Audio/Plug-Ins/VST3/Helix Native.vst3",
    ]

    def __init__(self, vst: str | None = None):
        try:
            from pedalboard import load_plugin
        except ImportError as exc:
            raise RendererUnavailable("Helix Native rendering needs: pip install pedalboard") from exc
        path = vst or os.environ.get("HELIX_NATIVE_VST") or next((p for p in self.PATHS if os.path.exists(p)), None)
        if not path:
            raise RendererUnavailable("Helix Native .vst3 not found; set HELIX_NATIVE_VST to its path")
        self.plugin = load_plugin(path)

    def load_preset(self, preset: dict) -> None:
        # Deliberately not guessed. Helix Native keeps its preset inside the plugin
        # state; how a .hlx maps onto that state has to be read off a real state blob.
        raise RendererUnavailable(
            "putting a preset into Helix Native from a script is not worked out yet. "
            "Run `python tools/native_probe.py` on this machine and give Claude its output and "
            "native_state.bin; that shows how the plugin stores a preset. Until then use "
            "`--renderer folder` (manual bounce) or `--renderer sim` (testing only).")

    def render(self, preset: dict, di: np.ndarray, sr: int) -> np.ndarray:
        self.load_preset(preset)
        x = np.asarray(di, dtype=np.float32)
        out = self.plugin(np.stack([x, x]), sr)
        return np.asarray(out, dtype=np.float64).mean(axis=0)


def get(name: str, folder: str | None = None):
    if name == "sim":
        return SimRenderer()
    if name == "native":
        return NativeRenderer()
    if name == "folder":
        return FolderRenderer(folder or "render")
    raise RendererUnavailable(f"unknown renderer {name!r}: use native, folder or sim")
