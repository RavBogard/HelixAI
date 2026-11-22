"""Mine presets for their makers' habits. python tools/mine_presets.py <file or folder>...
Reads .hls setlists and .hlx files (read only). Tables cover presets that have a guitar amp."""
from __future__ import annotations

import hashlib
import json
import os
import statistics as st
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from helixtone import catalog, reader  # noqa: E402

CONTROLS = ["Drive", "Bass", "Mid", "Treble", "Presence", "ChVol", "Master", "Sag", "Bias", "BiasX", "Hum", "Ripple"]
TOP = 12


def qs(v):
    if not v:
        return "-"
    q = st.quantiles(v, n=4, method="inclusive") if len(v) > 1 else [v[0]] * 3
    return f"{q[1]:.2f} ({q[0]:.2f}-{q[2]:.2f})"


def pct(a, b):
    return f"{a} ({100 * a / b:.0f}%)" if b else f"{a}"


def show(title, rows, head=None, top=TOP):
    print(f"\n== {title}")
    if head:
        print("  " + " | ".join(head))
    for r in rows[:top]:
        print("  " + " | ".join(str(c) for c in r))


def top(counter, n=TOP, total=None):
    return [(k if isinstance(k, str) else " > ".join(map(str, k)) if isinstance(k, tuple) else k, pct(v, total) if total else v)
            for k, v in counter.most_common(n)]


def paths(args):
    for a in args:
        if os.path.isdir(a):
            for r, _, fs in os.walk(a):
                for f in sorted(fs):
                    if f.lower().endswith((".hls", ".hlx")):
                        yield os.path.join(r, f)
        else:
            yield a


def is_bass(m, i):
    return i.get("subcategory") == "Bass" or "Bass" in m or "SVT" in m


def label(m, i):
    if "ImpulseResponse" in m:
        return "ir"
    if m.startswith("HD2_VolPanVol"):
        return "volume"
    if m.startswith("HD2_VolPanGain"):
        return "gain"
    return "bass_amp" if i["category"] == "amp" and is_bass(m, i) else i["category"]


def val(cat, m, entry, name):
    return entry.get(name, cat.defaults(m).get(name))


def moved(cat, m, entry, name):
    p = cat.blocks[m]["params"].get(name)
    d = cat.defaults(m).get(name)
    v = entry.get(name, d)
    if not p or d is None or v is None or isinstance(v, bool):
        return False
    return abs(v - d) > 0.005 * ((p.get("max", 1) - p.get("min", 0)) or 1)


def main(args):
    seen, skipped, unknown = set(), Counter(), Counter()
    cats = {}
    n_total = n_dupe = 0
    A = defaultdict(list)       # lists of values
    C = defaultdict(Counter)    # counters
    n = 0
    for f in paths(args):
        try:
            presets = reader.load(f)
        except Exception as e:
            print(f"cannot read {f}: {e}")
            continue
        for p in presets:
            n_total += 1
            h = hashlib.md5(json.dumps(p["tone"], sort_keys=True).encode()).hexdigest()
            if h in seen:
                n_dupe += 1
                continue
            seen.add(h)
            tone = p["tone"]
            dev = reader.DEVICE_BY_ID.get(p["device"], "helix_lt")
            cat = cats.setdefault(dev, catalog.get(dev))
            bl = []
            for d, k, b in reader.chain(tone):
                m = b["@model"]
                i = cat.blocks.get(m)
                if not i:
                    unknown[m] += 1
                    continue
                bl.append(dict(d=d, k=k, b=b, m=m, i=i, c=label(m, i), on=b.get("@enabled", True),
                               path=b.get("@path", 0), cat=cat))
            amps = [x for x in bl if x["c"] == "amp"]
            if not bl:
                skipped["empty slot (no blocks)"] += 1
                continue
            if "BASS" in p["name"].upper() or p["name"].upper().startswith("BAS:"):
                skipped["bass (name has BAS: or Bass)"] += 1
                continue
            if not amps:
                skipped["bass amp only" if any(x["c"] == "bass_amp" for x in bl) else "no amp block (effects only)"] += 1
                continue
            n += 1
            idx = {(x["d"], x["k"]): x for x in bl}
            A["nblocks"].append(len(bl))
            prim = next((x for x in amps if x["on"] and x["path"] == 0), amps[0])
            seq = [x for x in bl if x["path"] == prim["path"] and x["d"] >= "dsp0"]
            ai = seq.index(prim)
            # 1 amps
            for a in {x["i"]["name"] for x in amps}:
                C["amp"][a] += 1
            C["amp_n"][len(amps)] += 1
            for x in amps:
                C["amp_on"][x["on"]] += 1
                for c in CONTROLS:
                    if c in x["i"]["params"]:
                        A["ctl", c].append(val(cat, x["m"], x["b"], c))
                        if moved(cat, x["m"], x["b"], c):
                            A["mv", c].append(val(cat, x["m"], x["b"], c))
                            A["shift", c].append(val(cat, x["m"], x["b"], c) - cat.defaults(x["m"])[c])
            # 2 cabs
            cabs = [x for x in seq[ai + 1:] if x["c"] in ("cab", "ir")]
            own = reader.linked_cab(tone, prim["d"], prim["b"]) if prim["b"].get("@cab") else None
            entries = []
            for x in [x for x in bl if x["c"] in ("cab", "ir")]:
                C["cabkind"]["IR block" if x["c"] == "ir" else "newer (CabMicIr)" if "CabMicIr" in x["m"] else "legacy cab"] += 1
                second = reader.linked_cab(tone, x["d"], x["b"])
                if x["b"].get("@cab"):
                    C["dual"]["dual cab block"] += 1
                entries += [(x["m"], x["b"])] + ([(second["@model"], second)] if second and second.get("@model") in cat.blocks else [])
            if own is not None and own.get("@model") in cat.blocks:
                entries.append((own["@model"], own))
            C["has_cab"]["separate cab/IR block after the amp" if cabs and own is None else "amp+cab block (type 3)" if own is not None else "no cab"] += 1
            C["ir"]["presets with an IR block"] += any(x["c"] == "ir" for x in bl)
            C["dualp"]["presets with a dual cab block"] += any(x["b"].get("@cab") for x in bl if x["c"] == "cab")
            used = own["@model"] if own is not None and own.get("@model") in cat.blocks else cabs[0]["m"] if cabs else None
            if used:
                nm = cat.blocks[used]["name"]
                C["pair"][(prim["i"]["name"], nm)] += 1
                link = prim["i"].get("cablink")
                kind = "amp+cab block: " if own is not None else "separate cab: "
                C["link"][kind + ("uses its linked cab" if link in cat.blocks and cat.blocks[link]["name"] == nm else "other cab" if link in cat.blocks else "amp has no linked cab")] += 1
            for m, e in entries:
                if "ImpulseResponse" in m:
                    continue
                pr = cat.blocks[m]["params"]
                for key in ("Mic", "@mic"):
                    if key in pr:
                        ch = pr[key].get("choices")
                        v = val(cat, m, e, key)
                        C["mic"][ch[v] if ch and isinstance(v, int) and v < len(ch) else f"{key}={v}"] += 1
                for c in ("Distance", "LowCut", "HighCut", "Position"):
                    if c in pr:
                        A["cab", c].append(val(cat, m, e, c))
                        A["cabmv", c].append(moved(cat, m, e, c))
                        if c in ("LowCut", "HighCut"):
                            C["cabval", c][("newer" if "CabMicIr" in m else "legacy", round(val(cat, m, e, c)))] += 1
            # 3 order
            pre = tuple(x["c"] for x in seq[:ai])
            after = seq[ai + 1:]
            ci = next((j for j, x in enumerate(after) if x["c"] in ("cab", "ir")), -1)
            post = tuple(x["c"] for x in after[ci + 1:])
            C["pre"][pre] += 1
            C["post"][post] += 1
            for j, x in enumerate(seq):
                where = "before amp" if j < ai else "between amp and cab" if 0 <= ci and j <= ai + 1 + ci else "after cab/amp+cab"
                if x["c"] not in ("amp", "cab", "ir"):
                    C["where", x["c"]][where] += 1
                    C["whereon", x["c"]][x["on"]] += 1
            for c in {x["c"] for x in seq}:
                C["has"][c] += 1
            C["last"][seq[-1]["c"]] += 1
            # 4 drives
            drives = [x for x in seq[:ai] if x["c"] == "drive"]
            C["ndrive"][len(drives)] += 1
            for x in drives:
                C["dpair"][(prim["i"]["name"], x["i"]["name"])] += 1
                C["dmodel"][x["i"]["name"]] += 1
                C["dmodel_on"][x["i"]["name"]] += x["on"]
                for nm, keys in (("gain", ("Drive", "Gain")), ("level", ("Level",)), ("tone", ("Tone",))):
                    for key in keys:
                        if key in x["i"]["params"]:
                            A["d", x["i"]["name"], nm].append(val(cat, x["m"], x["b"], key))
            # 5 delay and reverb
            for x in bl:
                if x["c"] in ("delay", "reverb"):
                    nm = x["i"]["name"]
                    C[x["c"]][nm] += 1
                    C[x["c"] + "_on"][nm] += x["on"]
                    C[x["c"] + "_st"]["stereo" if x["b"].get("@stereo") else "mono"] += 1
                    C[x["c"] + "_tr"]["trails" if x["b"].get("@trails") else "no trails"] += 1
                    for key in ("Mix", "Feedback", "Decay"):
                        if key in x["i"]["params"] and (key != "Decay" or x["c"] == "reverb") and (key != "Feedback" or x["c"] == "delay"):
                            A[x["c"], key].append(val(cat, x["m"], x["b"], key))
                    if x["b"].get("TempoSync1"):
                        C[x["c"] + "_sync"]["tempo-synced"] += 1
            # 6 snapshots
            snaps = [tone[f"snapshot{j}"] for j in range(8)
                     if tone.get(f"snapshot{j}", {}).get("@valid") and "blocks" in tone[f"snapshot{j}"]]
            C["nsnap"][len(snaps)] += 1
            for s in snaps:
                C["snapname"][s.get("@name", "?").strip()] += 1
            if len(snaps) > 1:
                byp, ctl = set(), defaultdict(list)
                for (d, k), x in idx.items():
                    vs = {s["blocks"].get(d, {}).get(k) for s in snaps} - {None}
                    if len(vs) > 1:
                        byp.add((d, k))
                        C["snapbyp"][x["c"]] += 1
                for s in snaps:
                    for d, ks in s.get("controllers", {}).items():
                        for k, cs in ks.items():
                            for cn, cv in cs.items():
                                ctl[d, k, cn].append(cv.get("@value"))
                varied = set()
                for (d, k, cn), vs in ctl.items():
                    vs = [v for v in vs if isinstance(v, (int, float)) and not isinstance(v, bool)]
                    if vs and max(vs) - min(vs) > 0.005 and (d, k) in idx:
                        varied.add((d, k))
                        C["snapctl"][(idx[d, k]["c"], cn)] += 1
                        A["snaprange", idx[d, k]["c"], cn].append(max(vs) - min(vs))
                C["snapkind"]["bypass states differ" if byp else "no bypass change"] += 1
                C["snapkind2"]["control values differ" if varied else "no control change"] += 1
                tempos = {round(s.get("@tempo", 0), 1) for s in snaps}
                C["snaptempo"]["tempo differs" if len(tempos) > 1 else "same tempo"] += 1
            # 7 switches and pedals
            for d, ks in (tone.get("controller") or {}).items():
                for k, cs in ks.items():
                    for cn, c in cs.items():
                        src = {1: "EXP1", 2: "EXP2", 19: "snapshot"}.get(c.get("@controller"), f"source {c.get('@controller')}")
                        if (d, k) in idx:
                            C["ctrl"][(src, idx[d, k]["c"], cn)] += 1
            for d, ks in (tone.get("footswitch") or {}).items():
                for k, fs in ks.items():
                    if fs.get("@fs_enabled") and (d, k) in idx:
                        x = idx[d, k]
                        C["fs" if fs.get("@fs_index") != 13 else "fstoe"][x["c"]] += 1
                        C["fsidx"][fs.get("@fs_index")] += 1
                        if fs.get("@fs_momentary"):
                            C["fsmom"][x["c"]] += 1
            # 8 parallel
            bx = [x for x in bl if x["path"] == 1]
            tops = [reader.topology(tone, d) for d in ("dsp0", "dsp1")]
            if bx or any("S" in t for t in tops):
                C["par"]["presets with a split / B path"] += 1
                C["topo"][tuple(tops)] += 1
                for d in ("dsp0", "dsp1"):
                    sp = (tone.get(d) or {}).get("split")
                    if sp and "S" in reader.topology(tone, d):
                        C["splitkind"][sp["@model"].replace("HD2_AppDSPFlow", "")] += 1
                bc = {x["c"] for x in bx}
                C["parwhat"]["two amps" if "amp" in bc else "cab on B path" if bc & {"cab", "ir"} else
                             "effects only on B" if bx else "split with empty B"] += 1
                C["parcontent"][tuple(sorted(bc)) or ("empty",)] += 1
            # 9 output
            for d in ("dsp0", "dsp1"):
                o = (tone.get(d) or {}).get("outputA")
                if o:
                    C["outgain", d][round(o.get("gain", 0), 1)] += 1
            for x in bl:
                if x["c"] == "gain":
                    A["gainblk"].append(x["b"].get("Gain", 0))
                    C["gainpos"]["before amp" if x in seq[:ai] else "after amp"] += 1
            ig = (tone.get("dsp0") or {}).get("inputA", {})
            C["gate"]["noise gate on" if ig.get("noiseGate") else "noise gate off"] += 1
            if ig.get("noiseGate"):
                A["gate_thr"].append(ig.get("threshold", 0))
    print(f"{n_total} preset slots read, {n_dupe} identical duplicates dropped, {n} presets with a guitar amp analysed")
    print("skipped:", dict(skipped), "| unknown models:", dict(unknown) or "none")
    print("how told: empty = no blocks; bass = name has BAS: or Bass (Line 6 naming) or only amp blocks whose catalog subcategory is Bass or id has Bass/SVT; effects only = no amp block."
          " Blocks count whether on or off at load; 'on' = enabled at load. Values are file values (0-1 for knobs).")
    print("amp blocks per preset:", dict(sorted(C["amp_n"].items())), "| amp on at load:", dict(C["amp_on"]), "| median blocks:", st.median(A["nblocks"]))
    show("1a. Amps (presets using each)", top(C["amp"], 25, n), ["amp", "presets"], 25)
    rows = [(c, len(A["ctl", c]), pct(len(A["mv", c]), len(A["ctl", c])), qs(A["ctl", c]), qs(A["mv", c]), qs(A["shift", c]))
            for c in CONTROLS if A["ctl", c]]
    show("1b. Amp controls", rows, ["control", "amps", "moved off default", "all: median (q1-q3)", "moved: value", "moved: shift"])
    show("2a. Amp -> its cab (top pairs)", top(C["pair"], 15), ["pair", "presets"], 15)
    for k in ("link", "has_cab", "cabkind", "dual", "dualp", "ir", "mic"):
        show(f"2b. {k}", top(C[k], 14, sum(C[k].values()) if k == "mic" else None), ["", "count"], 14)
    rows = [(c, len(A["cab", c]), pct(sum(A["cabmv", c]), len(A["cab", c])), qs(A["cab", c])) for c in ("Distance", "LowCut", "HighCut", "Position") if A["cab", c]]
    show("2c. Cab controls (every cab entry, dual halves counted)", rows, ["control", "cabs", "moved", "median (q1-q3)"])
    for c in ("LowCut", "HighCut"):
        show(f"2d. {c} values (cab kind, value)", top(C["cabval", c], 8), ["", "cabs"], 8)
    show("3a. Categories before the amp", top(C["pre"], 10, n), ["sequence", "presets"], 10)
    show("3b. Categories after the cab", top(C["post"], 10, n), ["sequence", "presets"], 10)
    rows = [(c, pct(v, n), dict(C["where", c]), "on at load " + pct(C["whereon", c][True], sum(C["whereon", c].values())))
            for c, v in C["has"].most_common() if c not in ("amp", "cab", "ir")]
    show("3c. Where each category sits (blocks)", rows, ["category", "presets", "block positions", "on"], 20)
    show("3d. Last block before the output", top(C["last"], 8, n), ["category", "presets"], 8)
    show("4a. Drives before the amp per preset", top(C["ndrive"], 5, n), ["drives", "presets"], 5)
    show("4b. Amp > drive (top pairs)", top(C["dpair"], 15), ["pair", "presets"], 15)
    rows = [(m, v, C["dmodel_on"][m], qs(A["d", m, "gain"]), qs(A["d", m, "level"]), qs(A["d", m, "tone"])) for m, v in C["dmodel"].most_common(14)]
    show("4c. Drive models (median (q1-q3))", rows, ["drive", "uses", "on at load", "Gain/Drive", "Level", "Tone"], 14)
    for t in ("delay", "reverb"):
        show(f"5. {t} models", [(m, v, C[t + "_on"][m]) for m, v in C[t].most_common(10)], ["model", "blocks", "on at load"], 10)
        print("   ", dict(C[t + "_st"]), dict(C[t + "_tr"]), dict(C[t + "_sync"]))
        for key in ("Mix", "Feedback", "Decay"):
            if A[t, key]:
                print(f"    {t} {key} (n={len(A[t, key])}): {qs(A[t, key])}")
    show("6a. Valid snapshots per preset", sorted(C["nsnap"].items()), ["snapshots", "presets"], 10)
    show("6b. Snapshot names", top(C["snapname"], 15), ["name", "count"], 15)
    print("    among presets with 2+ snapshots:", dict(C["snapkind"]), dict(C["snapkind2"]), dict(C["snaptempo"]))
    show("6c. Categories whose bypass differs between snapshots (blocks)", top(C["snapbyp"], 10), ["category", "blocks"], 10)
    rows = [(f"{c}.{cn}", v, qs(A["snaprange", c, cn])) for (c, cn), v in C["snapctl"].most_common(12)]
    show("6d. Controls whose value differs between snapshots", rows, ["control", "blocks", "range median (q1-q3)"], 12)
    show("7a. Controller assignments", top(C["ctrl"], 18), ["source > category > control", "count"], 18)
    show("7b. Footswitch-enabled blocks by category (stomp switches, index 13 excluded)", top(C["fs"], 12), ["category", "blocks"], 12)
    print("    on index 13 (toe/pedal switch):", dict(C["fstoe"]))
    show("7c. Footswitch index (13 = toe switch on LT)", top(C["fsidx"], 14), ["index", "blocks"], 14)
    for k in ("par", "topo", "splitkind", "parwhat", "parcontent"):
        show(f"8. {k}", top(C[k], 10), ["", "count"], 10)
    for d in ("dsp0", "dsp1"):
        print(f"9. output A gain, {d}:", dict(C["outgain", d]))
    print("9. Gain blocks:", len(A["gainblk"]), qs(A["gainblk"]), dict(C["gainpos"]))
    print("9. Input A noise gate:", dict(C["gate"]), "threshold dB", qs(A["gate_thr"]))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
