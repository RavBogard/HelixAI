"""Measure audio: how loud, how bright, how compressed, and how close to a target.

These numbers are what lets the tool adjust a preset without someone listening
to every step. They describe a sound's level and spectral balance; they do not
say whether it is good. Needs numpy.
"""
from __future__ import annotations

import math
import struct
import wave

import numpy as np

SR = 48000

# third-octave band centres, 50 Hz .. 16 kHz
BANDS = [50 * 2 ** (i / 3) for i in range(26)]
REGIONS = {"low": (20, 120), "low_mid": (120, 400), "mid": (400, 1600),
           "high_mid": (1600, 5000), "high": (5000, 12000), "air": (12000, 24000)}


# ------------------------------------------------------------------ files

def read_wav(path: str) -> tuple[np.ndarray, int]:
    """Return (samples as float in -1..1, shape (frames, channels), sample rate). PCM 16/24/32-bit."""
    with wave.open(path, "rb") as w:
        n, ch, width, sr = w.getnframes(), w.getnchannels(), w.getsampwidth(), w.getframerate()
        raw = w.readframes(n)
    if width == 2:
        data = np.frombuffer(raw, "<i2").astype(np.float64) / 32768.0
    elif width == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        data = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / float(1 << 23)
    elif width == 4:
        data = np.frombuffer(raw, "<i4").astype(np.float64) / float(1 << 31)
    else:
        raise ValueError(f"{path}: {8 * width}-bit WAV is not supported (use 16, 24 or 32-bit PCM)")
    return data.reshape(-1, ch), sr


def write_wav(path: str, x: np.ndarray, sr: int = SR) -> None:
    x = np.atleast_2d(np.asarray(x, dtype=np.float64).T).T
    v = np.clip(np.round(x * (1 << 23)), -(1 << 23), (1 << 23) - 1).astype(np.int32).reshape(-1)
    out = bytearray()
    for s in v.tolist():
        out += struct.pack("<i", s)[:3]
    with wave.open(path, "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(3)
        w.setframerate(sr)
        w.writeframes(bytes(out))


def mono(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float64)
    return x if x.ndim == 1 else x.mean(axis=1)


# ------------------------------------------------------------ test signal

def _pluck(freq: float, seconds: float, sr: int, rng: np.random.Generator, bright: float = 0.5) -> np.ndarray:
    """One plucked string (Karplus-Strong): a decaying tone with a guitar-like spectrum."""
    n = int(seconds * sr)
    period = max(2, int(round(sr / freq)))
    buf = rng.uniform(-1, 1, period)
    out = np.empty(n)
    damp = 0.996 - 0.002 * (1 - bright)
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = damp * 0.5 * (buf[j] + buf[(j + 1) % period])
    return out


def test_signal(sr: int = SR, seconds: float = 8.0) -> np.ndarray:
    """A repeatable stand-in for a dry guitar: open chords, single notes and a held note.

    It is synthetic. Results are comparable between runs and presets, but a real
    DI recording of the player's own guitar is a better input: put one at
    reference/di.wav and the tools use it instead.
    """
    rng = np.random.default_rng(6)
    e2, a2, d3, g3, b3, e4 = 82.41, 110.0, 146.83, 196.0, 246.94, 329.63
    events = [  # (start s, frequencies, length s)
        (0.0, [e2, b3 / 2, e4 / 2, g3 * 1.26, b3, e4], 1.4),          # E major
        (1.5, [a2, e4 / 2, a2 * 2, b3 * 1.122, e4], 1.4),             # A major
        (3.0, [e4], 0.35), (3.4, [g3 * 1.5], 0.35), (3.8, [b3], 0.35), (4.2, [e4 * 1.5], 0.6),
        (5.0, [e2], 0.25), (5.3, [e2], 0.25), (5.6, [e2 * 1.335], 0.25), (5.9, [e2], 0.25),
        (6.4, [d3 * 2], 1.5),                                           # held note
    ]
    out = np.zeros(int(seconds * sr))
    for start, freqs, length in events:
        i0 = int(start * sr)
        for k, f in enumerate(freqs):
            note = _pluck(f, length, sr, rng)
            i = i0 + int(0.012 * k * sr)                                # strum
            seg = note[: max(0, len(out) - i)]
            out[i:i + len(seg)] += seg
    out /= np.max(np.abs(out))
    return out * 10 ** (-12 / 20)     # peaks at -12 dBFS, about where a healthy DI sits


# -------------------------------------------------------------- features

def _db(power: float) -> float:
    return 10 * math.log10(max(power, 1e-20))


def _spectrum(x: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    """Long-term average power spectrum (Welch, Hann, 50% overlap)."""
    n = 8192
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    win = np.hanning(n)
    hop = n // 2
    frames = 1 + (len(x) - n) // hop
    acc = np.zeros(n // 2 + 1)
    for i in range(frames):
        seg = x[i * hop:i * hop + n] * win
        acc += np.abs(np.fft.rfft(seg)) ** 2
    return np.fft.rfftfreq(n, 1 / sr), acc / max(frames, 1)


def _k_weight(freqs: np.ndarray) -> np.ndarray:
    """Power weighting close to the K curve used for loudness: bass rolled off, upper mids lifted."""
    f = np.maximum(freqs, 1e-6)
    highpass = f ** 4 / (f ** 4 + 38.0 ** 4)
    shelf_db = 4.0 / (1 + (1500.0 / f) ** 2)
    return highpass * 10 ** (shelf_db / 10)


def features(x: np.ndarray, sr: int = SR) -> dict:
    """Describe a recording. Levels are in dB relative to full scale."""
    x = mono(x)
    rms = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    freqs, p = _spectrum(x, sr)
    total = float(p.sum()) or 1e-20
    ltas = []
    for c in BANDS:
        lo, hi = c / 2 ** (1 / 6), c * 2 ** (1 / 6)
        ltas.append(_db(float(p[(freqs >= lo) & (freqs < hi)].sum()) / total))
    regions = {name: round(_db(float(p[(freqs >= lo) & (freqs < hi)].sum()) / total), 2)
               for name, (lo, hi) in REGIONS.items()}
    centroid = float((freqs * p).sum() / total)
    use = [(math.log2(c), v) for c, v in zip(BANDS, ltas) if 100 <= c <= 8000 and v > -80]
    tilt = float(np.polyfit([u[0] for u in use], [u[1] for u in use], 1)[0]) if len(use) > 2 else 0.0
    loud = _db(float((p * _k_weight(freqs)).sum()) / float(p.sum() or 1e-20)) + 20 * math.log10(max(rms, 1e-10))
    return {
        "level_db": round(20 * math.log10(max(rms, 1e-10)), 2),
        "loudness_db": round(loud, 2),           # K-weighted, ungated: closer to perceived level than RMS
        "peak_db": round(20 * math.log10(max(peak, 1e-10)), 2),
        "crest_db": round(20 * math.log10(max(peak, 1e-10) / max(rms, 1e-10)), 2),   # lower = more compressed or distorted
        "centroid_hz": round(centroid, 1),       # higher = brighter
        "tilt_db_per_octave": round(tilt, 2),    # more negative = darker
        "regions": regions,
        "ltas": [round(v, 2) for v in ltas],
        "clipped": bool(peak >= 0.999),
    }


def distance(a: dict, b: dict) -> float:
    """How far apart two sounds are in spectral balance and dynamics, in dB-like units. 0 is identical.

    Level is ignored on purpose: it is matched separately and trivially.
    """
    la, lb = np.array(a["ltas"]), np.array(b["ltas"])
    keep = (la > -70) | (lb > -70)
    if not keep.any():
        return 0.0
    la, lb = np.maximum(la[keep], -70), np.maximum(lb[keep], -70)
    shape = float(np.sqrt(np.mean((la - lb) ** 2)))
    return round(shape + 0.5 * abs(a["crest_db"] - b["crest_db"]), 3)


def describe_difference(got: dict, want: dict) -> list[str]:
    """Plain statements of how `got` differs from `want`, largest first."""
    out = []
    for name, label in (("low", "low end"), ("low_mid", "low mids"), ("mid", "mids"),
                        ("high_mid", "upper mids"), ("high", "top end")):
        d = got["regions"][name] - want["regions"][name]
        if abs(d) >= 1.5:
            out.append((abs(d), f"{label} {abs(d):.1f} dB {'higher' if d > 0 else 'lower'} than the target"))
    d = got["crest_db"] - want["crest_db"]
    if abs(d) >= 1.5:
        out.append((abs(d), f"{'more dynamic (less gain or compression)' if d > 0 else 'more compressed (more gain)'} "
                            f"than the target by {abs(d):.1f} dB of crest"))
    return [text for _d, text in sorted(out, reverse=True)]
