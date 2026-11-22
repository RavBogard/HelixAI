"""Check what preset makers say about the Helix by rendering it and measuring.

    python tools/check_claims.py [output.md]

The claims are collected in .claude/skills/helix-tone/references/research/.
This renders the ones a measurement can settle and writes the numbers, by
default to that folder's measured.md. It needs the Helix Native renderer and
takes about ten minutes the first time (each new preset goes through the
plugin once; after that the states are cached).

Filters (cabs, EQ) are measured on the dry test signal with no amp, so a
difference between two settings is the filter's own effect. Things that
depend on distortion are measured through an amp.
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from helixtone import audio, render          # noqa: E402
from helixtone.builder import build          # noqa: E402

CAB = "HD2_CabMicIr_4x12Greenback25"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".claude", "skills", "helix-tone",
                   "references", "research", "measured.md")
lines: list[str] = []


def say(text=""):
    print(text)
    lines.append(text)


def spec(chain):
    return {"name": "Claim", "device": "helix_lt", "chain": chain, "snapshots": [{"name": "One"}]}


def band_db(x, lo, hi, sr=audio.SR):
    """Absolute level of x between lo and hi Hz, in dB."""
    p = np.abs(np.fft.rfft(x)) ** 2
    f = np.fft.rfftfreq(len(x), 1 / sr)
    return 10 * np.log10(p[(f >= lo) & (f < hi)].sum() / len(x) ** 2 + 1e-20)


def third(x, centre):
    return band_db(x, centre / 2 ** (1 / 6), centre * 2 ** (1 / 6))


class Bench:
    def __init__(self):
        self.r = render.get("native")
        self.di = audio.test_signal()

    def out(self, chain):
        return self.r.render(build(spec(chain)).preset, self.di, audio.SR)

    def feats(self, chain):
        return audio.features(self.out(chain))


def amp(model, **params):
    return {"id": "amp", "model": model, "params": params}


def cab(**params):
    return {"id": "cab", "model": CAB, "params": params}


def table(header, rows):
    say("| " + " | ".join(header) + " |")
    say("|" + "---|" * len(header))
    for row in rows:
        say("| " + " | ".join(f"{v:.1f}" if isinstance(v, float) else str(v) for v in row) + " |")
    say()


def main():
    b = Bench()
    say("# Measured: what the claims come to in Helix Native")
    say()
    say(f"Rendered with {b.r.name} on the built-in test signal by `tools/check_claims.py`. Levels in dB. "
        "\"Balance change\" is `audio.distance` between two renders: 0 is the same balance and dynamics, level ignored.")
    say()

    say("## 1. Channel Volume: level only, or tone too?")
    say()
    rows = []
    for model in ("US Deluxe Nrm", "Brit Plexi Brt"):
        ref = b.feats([amp(model, ChVol=0.9), cab()])
        for v in (0.9, 0.7, 0.5, 0.3):
            f = b.feats([amp(model, ChVol=v), cab()])
            rows.append([model, v, f["loudness_db"] - ref["loudness_db"], f["crest_db"], audio.distance(f, ref)])
    table(["amp", "Ch Vol", "loudness vs 0.9", "crest", "balance change vs 0.9"], rows)

    say("## 2. Drive at a fixed Channel Volume")
    say()
    rows = []
    for model in ("US Deluxe Nrm", "Brit Plexi Brt"):
        ref = None
        for v in (0.2, 0.4, 0.6, 0.8):
            f = b.feats([amp(model, Drive=v), cab()])
            ref = ref or f
            rows.append([model, v, f["loudness_db"] - ref["loudness_db"], f["crest_db"], float(f["centroid_hz"])])
    table(["amp", "Drive", "loudness vs Drive 0.2", "crest", "centroid Hz"], rows)

    say("## 3. Cab high cut: what each setting removes")
    say()
    say("Cab alone on the dry signal, 57 Dynamic, relative to the cut fully open (20.1 kHz).")
    say()
    open_ = b.out([cab()])
    rows = []
    for hc in (12000.0, 8000.0, 6500.0, 5000.0, 3500.0, 3000.0):
        x = b.out([cab(HighCut=hc)])
        rows.append([int(hc)] + [third(x, c) - third(open_, c) for c in (2000, 3150, 4000, 5000, 6300, 8000, 10000)])
    table(["High Cut Hz", "2k", "3.15k", "4k", "5k", "6.3k", "8k", "10k"], rows)
    say("Through an amp (Brit Plexi Brt, defaults), same cab:")
    say()
    ref = b.feats([amp("Brit Plexi Brt"), cab()])
    rows = []
    for hc in (20100.0, 12000.0, 8000.0, 6500.0, 5000.0, 3000.0):
        f = b.feats([amp("Brit Plexi Brt"), cab(HighCut=hc)])
        rows.append([int(hc), f["loudness_db"] - ref["loudness_db"], float(f["centroid_hz"]), f["regions"]["high_mid"], f["regions"]["high"]])
    table(["High Cut Hz", "loudness change", "centroid Hz", "1.6-5 kHz share", "5-12 kHz share"], rows)

    say("## 4. Is the cab block's cut gentler than an EQ block's?")
    say()
    flat = b.out([cab()])
    rows = []
    for label, chain in (("cab block High Cut 5 kHz", [cab(HighCut=5000.0)]),
                         ("Low and High Cut block at 5 kHz after the cab", [cab(), {"id": "eq", "model": "Low and High Cut", "params": {"HighCut": 5000.0}}])):
        x = b.out(chain)
        rows.append([label] + [third(x, c) - third(flat, c) for c in (5000, 6300, 8000, 10000)])
    table(["high cut", "at 5k", "at 6.3k", "at 8k", "at 10k (one octave up)"], rows)
    rows = []
    for label, chain in (("cab block Low Cut 100 Hz", [cab(LowCut=100.0)]),
                         ("Low and High Cut block at 100 Hz after the cab", [cab(), {"id": "eq", "model": "Low and High Cut", "params": {"LowCut": 100.0}}])):
        x = b.out(chain)
        rows.append([label] + [third(x, c) - third(flat, c) for c in (100, 80, 63, 50)])
    table(["low cut", "at 100", "at 80", "at 63", "at 50 Hz (one octave down)"], rows)

    say("## 5. Cab low cut")
    say()
    rows = []
    for lc in (80.0, 100.0, 120.0):
        x = b.out([cab(LowCut=lc)])
        rows.append([int(lc)] + [third(x, c) - third(flat, c) for c in (50, 80, 100, 125, 160)])
    table(["Low Cut Hz", "50", "80", "100", "125", "160"], rows)

    say("## 6. Microphones, distance and position")
    say()
    say("Cab alone, relative to the 57 Dynamic at the cab's defaults (distance 1 in, position 0.24).")
    say()
    bands = (("80-300", 80, 300), ("300-1k", 300, 1000), ("1-2k", 1000, 2000), ("2-6k", 2000, 6000), ("6-12k", 6000, 12000))

    def rel(x):
        return [band_db(x, lo, hi) - band_db(flat, lo, hi) for _n, lo, hi in bands]
    rows = [[m] + rel(b.out([cab(Mic=m)])) for m in ("121 Ribbon", "160 Ribbon", "4038 Ribbon", "421 Dynamic", "67 Cond")]
    table(["mic"] + [n for n, _l, _h in bands], rows)
    rows = [[f"121 Ribbon at {d} in"] + rel(b.out([cab(Mic="121 Ribbon", Distance=d)])) for d in (1.0, 3.0, 6.5, 12.0)]
    rows += [[f"57 Dynamic at {d} in"] + rel(b.out([cab(Distance=d)])) for d in (3.0, 6.5)]
    table(["distance"] + [n for n, _l, _h in bands], rows)
    rows = [[f"57 Dynamic, position {p}"] + rel(b.out([cab(Position=p)])) for p in (0.0, 0.5, 1.0)]
    table(["position (0 to 1)"] + [n for n, _l, _h in bands], rows)

    say("## 7. One cab against a dynamic and ribbon pair")
    say()
    pair = b.out([{"id": "cab", "model": CAB, "dual": {"model": CAB, "params": {"Mic": "121 Ribbon"}}}])
    table(["cab"] + [n for n, _l, _h in bands] + ["loudness change"],
          [["57 + 121 Ribbon, dual"] + rel(pair) + [audio.features(pair)["loudness_db"] - audio.features(flat)["loudness_db"]]])

    say("## 8. Sag and Bias: do they matter at low Master?")
    say()
    rows = []
    for master in (0.3, 1.0):
        base = b.feats([amp("Brit Plexi Brt", Master=master), cab()])
        for ctl in ("Sag", "Bias", "BiasX"):
            lo, hi = (b.feats([amp("Brit Plexi Brt", Master=master, **{ctl: v}), cab()]) for v in (0.0, 1.0))
            rows.append([master, ctl, hi["loudness_db"] - lo["loudness_db"], hi["crest_db"] - lo["crest_db"], audio.distance(lo, hi)])
        rows.append([master, "(level at defaults)", base["loudness_db"], base["crest_db"], 0.0])
    table(["Master", "control 0 to 10", "loudness change", "crest change", "balance change"], rows)

    say("## 9. Hum and Ripple")
    say()
    rows = []
    for hum, ripple in ((0.5, 0.5), (0.0, 0.0), (1.0, 1.0)):
        x = b.out([amp("Brit Plexi Brt", Hum=hum, Ripple=ripple), cab()])
        f = audio.features(x)
        rows.append([hum, ripple, f["loudness_db"], band_db(x, 40, 70), band_db(x, 100, 130)])
    table(["Hum", "Ripple", "loudness", "40-70 Hz", "100-130 Hz"], rows)

    say("## 10. A Tube Screamer in front of an amp")
    say()
    rows = []
    base = None
    for label, chain in (("amp alone (Brit Plexi Brt, Drive 0.5)", []),
                         ("Scream 808 as a boost: Gain 0.15, Level 0.8", [{"id": "ts", "model": "Scream 808", "params": {"Gain": 0.15, "Level": 0.8}}]),
                         ("Scream 808 as Line 6 sets it: Gain 0.5, Level 0.67, Tone 0.65", [{"id": "ts", "model": "Scream 808", "params": {"Gain": 0.5, "Level": 0.67, "Tone": 0.65}}])):
        x = b.out(chain + [amp("Brit Plexi Brt", Drive=0.5), cab()])
        f = audio.features(x)
        base = base or (f, x)
        rows.append([label, f["loudness_db"] - base[0]["loudness_db"], f["crest_db"], band_db(x, 60, 150) - band_db(base[1], 60, 150),
                     band_db(x, 600, 1200) - band_db(base[1], 600, 1200), float(f["centroid_hz"])])
    table(["chain", "loudness change", "crest", "60-150 Hz change", "600-1200 Hz change", "centroid Hz"], rows)

    say("## 11. Clean against driven at the same loudness")
    say()
    clean = b.feats([amp("US Deluxe Nrm", Drive=0.3), cab()])
    lead = b.feats([amp("German Mahadeva", Drive=0.8), cab()])
    comp = b.feats([{"id": "comp", "model": "Deluxe Comp", "params": {"Ratio": "4:1", "Threshold": -38.0, "Mix": 0.8}},
                    amp("US Deluxe Nrm", Drive=0.3), cab()])
    table(["sound", "loudness", "peak", "crest", "peak when brought to the lead's loudness"],
          [[n, f["loudness_db"], f["peak_db"], f["crest_db"], f["peak_db"] + (lead["loudness_db"] - f["loudness_db"])]
           for n, f in (("clean (US Deluxe Nrm, Drive 0.3)", clean), ("the same with Deluxe Comp 4:1 in front", comp),
                        ("lead (German Mahadeva, Drive 0.8)", lead))])
    b.r.close()
    path = sys.argv[1] if len(sys.argv) > 1 else OUT
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("wrote", path)


if __name__ == "__main__":
    main()
