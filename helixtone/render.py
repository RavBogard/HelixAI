"""Turn a preset into audio, so it can be measured.

Everything that tunes a preset by measurement goes through one call:

    renderer.render(preset, di, sr) -> audio

`preset` is the preset document the builder produces. Three renderers:

  NativeRenderer   Helix Native, hosted from Python. The real thing for Helix
                   presets. The plugin's own importer turns each new preset
                   into a plugin state (helixtone/native_host.py); rendering
                   then needs no window. Refuses if the plugin is signed out.
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
            elif blk["@model"] == "HD2_VolPanGain":
                x = x * 10 ** (blk.get("Gain", 0.0) / 20)
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


def same_tone(sent: dict, got: dict, path: str = "") -> str | None:
    """None if two preset documents hold the same sound, else where they first differ.

    Compares the name and everything under `tone`. The device and application
    fields are left out: Helix Native rewrites those as its own.
    """
    if path == "":
        if sent["data"]["meta"].get("name") != got["data"]["meta"].get("name"):
            return "meta/name"
        return same_tone(sent["data"]["tone"], got["data"]["tone"], "tone")
    if isinstance(sent, dict) and isinstance(got, dict):
        for k in sorted(set(sent) | set(got)):
            if k not in sent or k not in got:
                return f"{path}/{k}"
            where = same_tone(sent[k], got[k], f"{path}/{k}")
            if where:
                return where
        return None
    if isinstance(sent, list) and isinstance(got, list):
        if len(sent) != len(got):
            return path
        for i, (x, y) in enumerate(zip(sent, got)):
            where = same_tone(x, y, f"{path}/{i}")
            if where:
                return where
        return None
    numbers = (int, float)
    if isinstance(sent, numbers) and isinstance(got, numbers) and not isinstance(sent, bool) and not isinstance(got, bool):
        return None if abs(sent - got) <= 1e-4 * max(1.0, abs(sent)) else path
    return None if sent == got else path


_JUCE64 = ".ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+"
_JUCE64_VALUE = {ch: i for i, ch in enumerate(_JUCE64)}


def preset_chunk(state: bytes) -> bytes:
    """The preset as Helix Native holds it, cut out of a plugin state.

    The state is JUCE's wrapper around XML whose <IComponent> is JUCE's own
    base64 ("<length>.<data>", six bits a character, low bit first) of a chunk
    file: "CMXH", a length, then chunks of tag, version, size, a fourth word
    and data. The preset is the chunk tagged PCPD (stored reversed). It is not
    readable; this is only good for telling two presets apart.
    """
    import re
    import struct
    found = re.search(rb"<IComponent>([^<]*)</IComponent>", state)
    if not found:
        raise RendererUnavailable("the Helix Native state is not in the form this code knows")
    size, _, text = found.group(1).decode("ascii").partition(".")
    six = [_JUCE64_VALUE[ch] for ch in text] + [0, 0, 0]
    data = bytearray()
    for i in range(0, len(six) - 3, 4):       # four characters are three bytes
        data += (six[i] | six[i + 1] << 6 | six[i + 2] << 12 | six[i + 3] << 18).to_bytes(3, "little")
    data = bytes(data[:int(size)])
    at = 8
    while at + 16 <= len(data):
        length, = struct.unpack("<I", data[at + 8:at + 12])
        if data[at:at + 4] == b"DPCP":
            return data[at + 16:at + 16 + length]
        at += 16 + length
    raise RendererUnavailable("the Helix Native state holds no preset chunk")


class NativeRenderer:
    """Helix Native hosted with pedalboard (pip install pedalboard pywin32). Windows.

    Helix Native keeps its preset inside its saved state, in a form only the
    plugin itself can write. So a preset gets in by a detour, once per
    distinct preset: a helper process (helixtone/native_host.py) has the
    plugin import the .hlx through its own window, kept off screen, and hands
    back the state the plugin then holds. Before that state is trusted, the
    preset the plugin exports again is compared with the one sent. States are
    kept on disk, so a preset already seen costs nothing.

    Rendering itself needs no window: the state is set on a plugin held in
    this process.
    """
    name = "Helix Native"
    is_real = True

    PATHS = [
        r"C:\Program Files\Common Files\VST3\Line 6\Helix Native (x64).vst3",
        r"C:\Program Files\Common Files\VST3\Helix Native.vst3",
        r"C:\Program Files\Common Files\VST3\Line 6\Helix Native.vst3",
    ]

    def __init__(self, vst: str | None = None, cache: str | None = None, show: bool = False):
        try:
            from pedalboard import load_plugin
        except ImportError as exc:
            raise RendererUnavailable("Helix Native rendering needs: pip install pedalboard pywin32") from exc
        path = vst or os.environ.get("HELIX_NATIVE_VST") or next((p for p in self.PATHS if os.path.exists(p)), None)
        if not path or not os.path.exists(path):
            raise RendererUnavailable("Helix Native .vst3 not found; set HELIX_NATIVE_VST to its path")
        self.path, self.show, self.host = path, show, None
        stamp = os.stat(path)
        self.cache = os.path.join(cache or os.path.join(os.path.expanduser("~"), ".helixtone", "native-states"),
                                  f"{int(stamp.st_mtime)}-{stamp.st_size}")
        os.makedirs(self.cache, exist_ok=True)
        self.plugin = load_plugin(path)
        self.loads = 0            # presets put through the plugin's importer by this object
        self.sr = None
        self.blank = self.plugin.raw_state      # the empty preset a fresh plugin holds
        self._check_processing()

    def _check_processing(self) -> None:
        """A signed-out or unauthorised Helix Native passes audio through untouched and ignores its own level
        controls. Measuring that would be measuring the DI, so refuse."""
        sr = 48000
        tone = (0.1 * np.sin(2 * np.pi * 220 * np.arange(sr // 2) / sr)).astype(np.float32)
        x = np.stack([tone, tone])
        self.plugin.master_output_level_db = 0.0
        a = float(np.sqrt(np.mean(self.plugin(x, sr) ** 2)))
        self.plugin.master_output_level_db = -12.0
        b = float(np.sqrt(np.mean(self.plugin(x, sr) ** 2)))
        self.plugin.master_output_level_db = 0.0
        if a <= 0 or not (0.15 < b / a < 0.40):
            raise RendererUnavailable(
                "Helix Native loads but is not processing audio (its output level control does nothing). "
                "It is signed out or this computer is not authorised: open it once, sign in, and if it stays on "
                "its splash screen sign in through HX Edit and remove old computer authorisations on the Line 6 account.")

    # -- the helper process ------------------------------------------------
    def _start_host(self) -> None:
        import atexit
        import subprocess
        import sys
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        cmd = [sys.executable, "-m", "helixtone.native_host", self.path] + (["--show"] if self.show else [])
        self.host = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, cwd=root)
        first = self._read()
        if not first.get("ok"):
            self.close()
            raise RendererUnavailable(first.get("error", "the Helix Native helper did not start"))
        atexit.register(self.close)

    def _read(self) -> dict:
        line = self.host.stdout.readline()
        if not line:
            return {"ok": False, "error": "the Helix Native helper stopped"}
        return json.loads(line)

    def close(self) -> None:
        host, self.host = self.host, None
        if host and host.poll() is None:
            try:
                host.stdin.write('{"cmd": "quit"}\n')
                host.stdin.flush()
                host.wait(20)
            except Exception:
                host.kill()
        if host:
            for pipe in (host.stdin, host.stdout):
                try:
                    pipe.close()
                except Exception:
                    pass

    # -- presets -------------------------------------------------------------
    def state_for(self, preset: dict) -> bytes:
        import hashlib
        text = json.dumps(preset, sort_keys=True)
        key = hashlib.sha1(text.encode("utf-8")).hexdigest()
        path = os.path.join(self.cache, key + ".state")
        if os.path.exists(path):
            with open(path, "rb") as fh:
                return fh.read()
        if preset["data"]["device"] in (2162695, 2162696):
            raise RendererUnavailable("a POD Go preset cannot be loaded in Helix Native: retarget the spec to helix_lt to measure it")
        stem = os.path.join(self.cache, key)
        with open(stem + ".hlx", "w", encoding="utf-8") as fh:
            fh.write(text)
        for attempt in (1, 2):
            if self.host is None or self.host.poll() is not None:
                self._start_host()
            self.host.stdin.write(json.dumps({"cmd": "load", "hlx": stem + ".hlx", "state": stem + ".tmp",
                                              "export": stem + ".export.hlx"}) + "\n")
            self.host.stdin.flush()
            answer = self._read()
            if answer.get("ok"):
                break
            self.close()
            if attempt == 2:
                raise RendererUnavailable(f"Helix Native did not load the preset: {answer.get('error')}")
        with open(stem + ".export.hlx", encoding="utf-8") as fh:
            where = same_tone(preset, json.load(fh))
        if where:
            os.remove(stem + ".tmp")
            raise RendererUnavailable(
                f"Helix Native did not take the preset as sent: it differs at {where}. "
                f"Compare {stem}.hlx with {stem}.export.hlx; the renderer will not measure a preset it cannot confirm.")
        os.replace(stem + ".tmp", path)
        for ext in (".hlx", ".export.hlx"):
            os.remove(stem + ext)
        self.loads += 1
        with open(path, "rb") as fh:
            return fh.read()

    def load_preset(self, preset: dict, sr: int = 48000) -> None:
        """Put the plugin in the same condition every time, with this preset loaded.

        pedalboard's own reset between calls costs about five seconds with this
        plugin, so it is used only when the sample rate changes. Instead: load
        the empty preset the plugin starts with, run half a second of silence,
        load the wanted preset, run half a second of silence. Renders made
        this way are identical sample for sample whatever was rendered before
        (checked in tests/test_native.py); without the empty preset first, a
        modulation's phase depended on the previous render.
        """
        state = self.state_for(preset)
        quiet = np.zeros((2, sr // 2), dtype=np.float32)
        if sr != self.sr:
            self.plugin(quiet, sr)
            self.sr = sr
        self.plugin.raw_state = self.blank
        self.plugin(quiet, sr, reset=False)
        self.plugin.raw_state = state
        if preset_chunk(self.plugin.raw_state) != preset_chunk(state):
            raise RendererUnavailable("Helix Native did not keep the saved state for this preset")
        self.plugin(quiet, sr, reset=False)

    def render(self, preset: dict, di: np.ndarray, sr: int) -> np.ndarray:
        self.load_preset(preset, sr)
        x = np.asarray(di, dtype=np.float32)
        out = self.plugin(np.stack([x, x]), sr, reset=False)
        return np.asarray(out, dtype=np.float64).mean(axis=0)


def get(name: str, folder: str | None = None):
    if name == "sim":
        return SimRenderer()
    if name == "native":
        return NativeRenderer()
    if name == "folder":
        return FolderRenderer(folder or "render")
    raise RendererUnavailable(f"unknown renderer {name!r}: use native, folder or sim")
