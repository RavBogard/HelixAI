"""Rebuild real presets from their own settings and compare with the originals.

This is the check that the file format is right. It needs the source presets,
which are not committed (they are Line 6's and other people's files):

    HELIXTONE_SOURCES=/path/to/sources python -m unittest tests.test_factory -v

See tools/build_data.py for what goes in that directory. Without it the tests skip.
"""
import glob
import os
import unittest

from helixtone import build, reader
from helixtone import catalog as catmod

SRC = os.environ.get("HELIXTONE_SOURCES", "")

ATTRS = ("@model", "@type", "@stereo", "@trails", "@bypassvolume", "@no_snapshot_bypass", "@mic")


def same(a, b):
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b or a == b and isinstance(a, bool) == isinstance(b, bool)
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return abs(a - b) <= 1e-6 * max(1.0, abs(a), abs(b))
    return a == b


def settings(blk):
    return {k: v for k, v in blk.items() if not k.startswith("@")}


def compare(original_tone, device):
    """Return a list of differences between a real preset and our rebuild of it."""
    preset = {"name": "Roundtrip", "device": 2162692 if device == "helix_lt" else 2162695,
              "device_version": 0, "tone": original_tone}
    trace = []
    spec = reader.to_spec(preset, device, full=True, trace=trace)
    spec["name"] = "Roundtrip"
    res = build(spec)
    built = res.preset["data"]["tone"]
    by_id = {b.id: b for b in res.blocks}
    diffs = []
    for bid, odsp, okey, ob in trace:
        if bid not in by_id:
            diffs.append(f"{ob['@model']}: not in the rebuild")
            continue
        nbk = by_id[bid]
        ndsp, nkey = f"dsp{nbk.dsp}", nbk.key
        nb = built[ndsp][nkey]
        cab_of_amp = okey is None          # the original kept this cab inside its amp block
        amp_with_cab = "@cab" in ob and ob.get("@type") == 3
        for a in ATTRS:
            if (cab_of_amp or amp_with_cab) and a in ("@type", "@no_snapshot_bypass"):
                continue
            if (a in ob) != (a in nb):
                diffs.append(f"{ob['@model']}: {a} {'missing' if a in ob else 'added'}")
            elif a in ob and not same(ob[a], nb[a]):
                diffs.append(f"{ob['@model']}: {a} {ob[a]!r} -> {nb[a]!r}")
        for k, v in settings(ob).items():
            if k not in nb:
                diffs.append(f"{ob['@model']}: control {k} dropped")
            elif not same(v, nb[k]):
                diffs.append(f"{ob['@model']}: {k} {v!r} -> {nb[k]!r}")
        if ob.get("@type") == 4 and "@cab" in ob:      # dual cab: the second half
            o2 = original_tone[odsp][ob["@cab"]]
            n2 = built[ndsp].get(nb.get("@cab", ""), {})
            if o2.get("@model") != n2.get("@model"):
                diffs.append(f"dual cab second: {o2.get('@model')} -> {n2.get('@model')}")
            if set(k for k in o2 if k.startswith("@")) != set(k for k in n2 if k.startswith("@")):
                diffs.append(f"dual cab second attrs: {sorted(o2)} -> {sorted(n2)}")
            for k, v in settings(o2).items():
                if not same(v, n2.get(k)):
                    diffs.append(f"dual cab second: {k} {v!r} -> {n2.get(k)!r}")
        if okey is None:
            continue
        # expression pedal assignments and footswitches survive
        oc = (original_tone.get("controller") or {}).get(odsp, {}).get(okey, {})
        nc = (built.get("controller") or {}).get(ndsp, {}).get(nkey, {})
        for ctl, c in oc.items():
            if c.get("@controller") in (1, 2):
                if ctl not in nc:
                    diffs.append(f"{ob['@model']}: pedal on {ctl} dropped")
                elif {k: c[k] for k in c} != {k: nc[ctl].get(k) for k in c}:
                    diffs.append(f"{ob['@model']}: pedal entry {c} -> {nc[ctl]}")
        of = (original_tone.get("footswitch") or {}).get(odsp, {}).get(okey)
        nf = (built.get("footswitch") or {}).get(ndsp, {}).get(nkey)
        if of and not nf:
            diffs.append(f"{ob['@model']}: footswitch dropped")
        elif of and nf:
            for k in ("@fs_index", "@fs_momentary"):
                if of.get(k) != nf.get(k):
                    diffs.append(f"{ob['@model']}: footswitch {k} {of.get(k)!r} -> {nf.get(k)!r}")
            # real files disagree on whether the volume pedal carries @fs_primary
            optional = {"@fs_customlabel", "@fs_customcolor", "@cc", "@fs_primary"}
            if set(of) - optional != set(nf) - optional:
                diffs.append(f"{ob['@model']}: footswitch keys {sorted(of)} -> {sorted(nf)}")
    if len(trace) != len([b for b in res.blocks if not b.auto]):
        diffs.append(f"block count {len(trace)} -> {len(res.blocks)}")

    # splits and joins, in order
    if device == "helix_lt":
        osec = [d for d in ("dsp0", "dsp1") if reader.topology(original_tone, d) == "SABJ"]
        nsec = [d for d in ("dsp0", "dsp1") if reader.topology(built, d) == "SABJ"]
        if len(osec) != len(nsec):
            diffs.append(f"splits {len(osec)} -> {len(nsec)}")
        for od, nd in zip(osec, nsec):
            for part in ("split", "join"):
                o, n = original_tone[od][part], built[nd][part]
                for k, v in o.items():
                    if k != "@position" and not same(v, n.get(k)):
                        diffs.append(f"{part}: {k} {v!r} -> {n.get(k)!r}")
            if not built["snapshot0"]["blocks"][nd].get("split"):
                diffs.append("snapshot does not list the split")
            # every path B block sits between the split and the join
            sp, jn = built[nd]["split"]["@position"], built[nd]["join"]["@position"]
            for k, blk in built[nd].items():
                if k.startswith("block") and blk["@path"] == 1 and not sp <= blk["@position"] < jn:
                    diffs.append(f"path B block at {blk['@position']} outside split {sp}..{jn}")
    return diffs


def supported(tone, device):
    if not reader.chain(tone):
        return False
    cat = catmod.get(device)
    for dsp, _key, blk in reader.chain(tone):
        m = blk["@model"]
        if m.startswith("HD2_ImpulseResponse") or m not in cat.blocks:
            return False
        if cat.blocks[m]["family"] in ("sendreturn", "io", "fixed") and device == "helix_lt":
            return False
    if device == "helix_lt":
        for d in ("dsp0", "dsp1"):
            topo = reader.topology(tone, d)
            has_b = any(b.get("@path") == 1 for k, b in tone[d].items() if k.startswith("block"))
            if topo not in ("A", "SABJ") or (topo == "SABJ") != has_b:
                return False       # paths with their own input or output, or an empty split
        has1 = any(k.startswith("block") for k in tone["dsp1"])
        if has1 and tone["dsp0"]["outputA"]["@output"] != 2:
            return False           # two independent chains, e.g. guitar and vocals
    return True


@unittest.skipUnless(os.path.isdir(os.path.join(SRC, "HelixNativePresets")), "set HELIXTONE_SOURCES")
class HelixFactory(unittest.TestCase):
    def test_rebuild_matches(self):
        checked, failures, no_room, kinds = 0, [], 0, {"split": 0, "dual cab": 0}
        for f in sorted(glob.glob(os.path.join(SRC, "HelixNativePresets", "*.hls"))):
            for p in reader.load(f):
                if not supported(p["tone"], "helix_lt"):
                    continue
                try:
                    d = compare(p["tone"], "helix_lt")
                except Exception as exc:
                    if "footswitch must be one of" in str(exc):
                        continue    # switches outside the LT's own (external or Floor-only), not built
                    if "processor" in str(exc):
                        # we write an amp's cab as its own block, so a full path can come out one too long
                        no_room += 1
                        continue
                    d = [f"build failed: {exc}"]
                checked += 1
                kinds["split"] += any(reader.topology(p["tone"], x) == "SABJ" for x in ("dsp0", "dsp1"))
                kinds["dual cab"] += any(b.get("@type") == 4 and "@cab" in b for _d, _k, b in reader.chain(p["tone"]))
                if d:
                    failures.append((p["name"], d))
        print(f"\nhelix: {checked} factory presets rebuilt ({kinds['split']} with a split, {kinds['dual cab']} with a dual cab), "
              f"{no_room} skipped for room, {len(failures)} differ")
        for name, d in failures[:25]:
            print(" ", name, "|", "; ".join(d[:4]))
        self.assertGreater(checked, 150)
        self.assertGreater(kinds["split"], 20)
        self.assertGreater(kinds["dual cab"], 20)
        self.assertEqual(failures, [])


@unittest.skipUnless(os.path.isdir(os.path.join(SRC, "pod-go-presets")), "set HELIXTONE_SOURCES")
class PodGoLibrary(unittest.TestCase):
    def test_rebuild_matches(self):
        files = glob.glob(os.path.join(SRC, "pod-go-presets", "**", "*.pgp"), recursive=True)
        files += glob.glob(os.path.join(SRC, "open-podgoedit", "fixtures", "*.pgp"))
        checked, failures, skipped = 0, [], 0
        for f in sorted(files):
            if "_bad" in os.path.basename(f):
                continue
            try:
                p = reader.load(f)[0]
            except Exception:
                continue
            if not supported(p["tone"], "pod_go"):
                skipped += 1
                continue
            try:
                d = compare(p["tone"], "pod_go")
            except Exception as exc:
                # the library is mostly presets with built-in blocks removed, which we do not build
                if "POD Go" in str(exc) or "free effect" in str(exc) or "needs exactly one" in str(exc):
                    skipped += 1
                    continue
                d = [f"build failed: {exc}"]
            checked += 1
            if d:
                failures.append((os.path.basename(f), d))
        print(f"\npod go: {checked} presets rebuilt, {skipped} outside what we build, {len(failures)} differ")
        for name, d in failures[:25]:
            print(" ", name, "|", "; ".join(d[:4]))
        self.assertGreater(checked, 3)
        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
