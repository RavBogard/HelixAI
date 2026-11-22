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


def compare(original_tone, device):
    """Return a list of differences between a real preset and our rebuild of it."""
    preset = {"name": "Roundtrip", "device": 2162692 if device == "helix_lt" else 2162695,
              "device_version": 0, "tone": original_tone}
    spec = reader.to_spec(preset, device)
    spec["name"] = "Roundtrip"
    # carry every setting, not only the ones that differ from today's defaults
    cat = catmod.get(device)
    originals = reader.chain(original_tone)
    for entry, (_dsp, _key, blk) in zip(spec["chain"], originals):
        entry["params"] = {k: v for k, v in blk.items()
                           if (not k.startswith("@") or k == "@mic") and k in cat.blocks[cat.resolve(blk["@model"])]["params"]}
    built = build(spec).preset["data"]["tone"]
    rebuilt = [b for b in reader.chain(built)]
    if device == "pod_go":
        # built-ins we add when the original left them out are not part of the comparison
        have = {b["@model"] for _d, _k, b in originals}
        rebuilt = [x for x in rebuilt if x[2]["@model"] in have]
    diffs = []
    if len(rebuilt) != len(originals):
        return [f"block count {len(originals)} -> {len(rebuilt)}"]
    for (odsp, okey, ob), (ndsp, nkey, nb) in zip(originals, rebuilt):
        linked = "@cab" in ob      # amp with a cab linked to it: type 3 there, 1 as its own block
        for a in ATTRS:
            if linked and a == "@type":
                continue
            if (a in ob) != (a in nb):
                diffs.append(f"{ob['@model']}: {a} {'missing' if a in ob else 'added'}")
            elif a in ob and not same(ob[a], nb[a]):
                diffs.append(f"{ob['@model']}: {a} {ob[a]!r} -> {nb[a]!r}")
        for k, v in ob.items():
            if k.startswith("@"):
                continue
            if k not in nb:
                diffs.append(f"{ob['@model']}: control {k} dropped")
            elif not same(v, nb[k]):
                diffs.append(f"{ob['@model']}: {k} {v!r} -> {nb[k]!r}")
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
            for k in ("@fs_index",):
                if of.get(k) != nf.get(k):
                    diffs.append(f"{ob['@model']}: footswitch {k} {of.get(k)!r} -> {nf.get(k)!r}")
            # real files disagree on whether the volume pedal carries @fs_primary
            optional = {"@fs_customlabel", "@fs_customcolor", "@cc", "@fs_primary"}
            if set(of) - optional != set(nf) - optional:
                diffs.append(f"{ob['@model']}: footswitch keys {sorted(of)} -> {sorted(nf)}")
    return diffs


def supported(tone, device):
    if not reader.chain(tone):
        return False
    g = tone.get("global", {})
    if device == "helix_lt" and (g.get("@topology0") != "A" or g.get("@topology1") != "A"):
        return False
    cat = catmod.get(device)
    for dsp, _key, blk in reader.chain(tone):
        m = blk["@model"]
        if m.startswith("HD2_ImpulseResponse") or m not in cat.blocks:
            return False
        if cat.blocks[m]["family"] in ("sendreturn", "io", "fixed") and device == "helix_lt":
            return False
        if blk.get("@path") == 1 or (blk.get("@type") == 4 and "@cab" in blk):
            return False   # second path, or a dual cab
    if device == "helix_lt":
        if any(len([k for k in (tone.get(d) or {}) if k.startswith("block")]) > 8 for d in ("dsp0", "dsp1")):
            return False
        o = tone["dsp0"]["outputA"]["@output"]
        has1 = any(k.startswith("block") for k in tone["dsp1"])
        if has1 and o != 2:
            return False   # two independent chains, e.g. guitar and vocals
    return True


@unittest.skipUnless(os.path.isdir(os.path.join(SRC, "HelixNativePresets")), "set HELIXTONE_SOURCES")
class HelixFactory(unittest.TestCase):
    def test_rebuild_matches(self):
        checked, failures = 0, []
        for f in sorted(glob.glob(os.path.join(SRC, "HelixNativePresets", "*.hls"))):
            for p in reader.load(f):
                if not supported(p["tone"], "helix_lt"):
                    continue
                checked += 1
                try:
                    d = compare(p["tone"], "helix_lt")
                except Exception as exc:
                    d = [f"build failed: {exc}"]
                if d:
                    failures.append((p["name"], d))
        print(f"\nhelix: {checked} factory presets rebuilt, {len(failures)} differ")
        for name, d in failures[:25]:
            print(" ", name, "|", "; ".join(d[:4]))
        self.assertGreater(checked, 80)
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
