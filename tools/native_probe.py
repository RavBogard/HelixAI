"""First experiment for the listening loop: can Helix Native be driven from a script?

Run on Daniel's PC on 2026-11-22; what it found is in
.claude/skills/helix-tone/references/native-setup.md. To run it again:

    pip install pedalboard
    python tools/native_probe.py
    python tools/native_probe.py --vst "C:\\Program Files\\Common Files\\VST3\\Helix Native.vst3"

It answers three questions and prints what it finds:
  1. Does the plugin load in a script at all (it may ask for a licence window)?
  2. What does it expose to a host: named parameters, a state blob, both?
  3. Does audio pass through it offline (a short test tone in, level out)?

Loading a .hlx into it from a script is the open question. Helix Native keeps
its preset in the plugin state, so if (2) shows a state blob that contains the
preset, the next step is to write a preset into that blob. If it does not, the
fallback is loading the preset by hand in a DAW and measuring the bounce.
"""
import argparse
import math
import os
import sys

DEFAULT_PATHS = [
    r"C:\Program Files\Common Files\VST3\Line 6\Helix Native (x64).vst3",
    r"C:\Program Files\Common Files\VST3\Helix Native.vst3",
    r"C:\Program Files\Common Files\VST3\Line 6\Helix Native.vst3",
    "/Library/Audio/Plug-Ins/VST3/Helix Native.vst3",
]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vst", help="path to the Helix Native .vst3")
    a = ap.parse_args()
    try:
        import numpy as np
        from pedalboard import load_plugin
    except ImportError:
        print("needs: pip install pedalboard")
        return 2
    path = a.vst or next((p for p in DEFAULT_PATHS if os.path.exists(p)), None)
    if not path:
        print("Helix Native .vst3 not found in the usual places; pass --vst <path>")
        return 2
    print("loading", path)
    try:
        plugin = load_plugin(path)
    except Exception as exc:
        print("1. load: FAILED:", exc)
        return 1
    print("1. load: ok,", getattr(plugin, "name", "?"))

    params = getattr(plugin, "parameters", {})
    print(f"2. host-visible parameters: {len(params)}")
    for name in list(params)[:40]:
        print("     ", name, "=", params[name])
    state = getattr(plugin, "raw_state", None)
    if state is None:
        print("   no state blob exposed")
    else:
        print(f"   state blob: {len(state)} bytes; contains 'HD2_': {b'HD2_' in state}; "
              f"contains 'L6Preset': {b'L6Preset' in state}")
        with open("native_state.bin", "wb") as fh:
            fh.write(state)
        print("   saved to native_state.bin (it shows how a preset is stored)")
        head = state[:64]
        print("   first bytes:", head)
        for marker, meaning in ((b"<?xml", "XML"), (b"VC2!", "JUCE wrapper"), (b"{", "JSON text"),
                                (b"\x78\x9c", "zlib stream"), (b"\x78\xda", "zlib stream"), (b"eJ", "base64 of zlib")):
            at = state.find(marker)
            if at >= 0:
                print(f"   looks like {meaning} at byte {at}")

    sr = 48000
    t = np.arange(sr) / sr
    tone = (0.1 * np.sin(2 * math.pi * 220 * t)).astype("float32")
    stereo = np.stack([tone, tone])
    try:
        out = plugin(stereo, sr)
        rms = float(np.sqrt((out ** 2).mean()))
        print(f"3. audio: ok, output RMS {20 * math.log10(max(rms, 1e-9)):.1f} dBFS "
              f"(input was {20 * math.log10(0.1 / math.sqrt(2)):.1f})")
    except Exception as exc:
        print("3. audio: FAILED:", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
