// src/lib/rig-mapping.test.ts
// Unit tests for Phase 18: Pedal Mapping Engine
// Covers all 6 success criteria (SC-01 through SC-06) and critical pitfalls.
//
// IMPORTANT: relative imports only — no @/ aliases in test files (project convention)

import { describe, it, expect } from "vitest";
import { lookupPedal, mapRigToSubstitutions, PEDAL_HELIX_MAP } from "./rig-mapping";
import type { RigIntent } from "./helix/rig-intent";

// ---------------------------------------------------------------------------
// Helper: build a minimal RigIntent for testing mapRigToSubstitutions
// ---------------------------------------------------------------------------
function makeRig(fullName: string, model: string = "TS9", brand: string = "Ibanez"): RigIntent {
  return {
    pedals: [
      {
        brand,
        model,
        fullName,
        knobPositions: {},
        imageIndex: 0,
        confidence: "high",
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// SC-01: PEDAL_HELIX_MAP entry count
// ---------------------------------------------------------------------------
describe("PEDAL_HELIX_MAP", () => {
  it("contains at least 40 entries (SC-01)", () => {
    expect(Object.keys(PEDAL_HELIX_MAP).length).toBeGreaterThanOrEqual(40);
  });

  it("contains at least 53 entries (full spec count)", () => {
    expect(Object.keys(PEDAL_HELIX_MAP).length).toBeGreaterThanOrEqual(53);
  });

  it("has a ts9 tube screamer entry", () => {
    expect(PEDAL_HELIX_MAP["ts9 tube screamer"]).toBeDefined();
  });

  it("has a pro co rat entry", () => {
    expect(PEDAL_HELIX_MAP["pro co rat"]).toBeDefined();
  });

  it("has a boss dm-2 entry", () => {
    expect(PEDAL_HELIX_MAP["boss dm-2"]).toBeDefined();
  });

  it("has a mxr phase 90 entry", () => {
    expect(PEDAL_HELIX_MAP["mxr phase 90"]).toBeDefined();
  });

  it("has an ep booster entry", () => {
    expect(PEDAL_HELIX_MAP["ep booster"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// SC-02: lookupPedal returns correct confidence tiers
// ---------------------------------------------------------------------------
describe("lookupPedal — confidence tiers (SC-02)", () => {
  it("returns 'direct' for TS9 Tube Screamer on helix_lt", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("returns 'direct' for ts9 tube screamer (lowercase) on helix_lt", () => {
    const result = lookupPedal("ts9 tube screamer", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("returns 'direct' for Boss SD-1 on helix_lt", () => {
    const result = lookupPedal("Boss SD-1", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("returns 'direct' for Pro Co RAT on helix_lt", () => {
    const result = lookupPedal("Pro Co RAT", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("returns 'direct' for TC Electronic Hall of Fame on helix_lt", () => {
    const result = lookupPedal("TC Electronic Hall of Fame", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("returns 'close' for an overdrive pedal by keyword (not in table)", () => {
    // "Blues Screamer" contains "blues" keyword -> overdrive category
    const result = lookupPedal("Generic Blues Screamer", "helix_lt");
    expect(result.confidence).toBe("close");
  });

  it("returns 'close' for a delay pedal by keyword (not in table)", () => {
    const result = lookupPedal("Unknown Analog Echo", "helix_lt");
    expect(result.confidence).toBe("close");
  });

  it("returns 'approximate' for a completely unknown pedal name (SC-03)", () => {
    const result = lookupPedal("Boutique Unobtainium Fuzz Pedal", "helix_lt");
    // "fuzz" keyword -> fuzz category -> close OR approximate depending on availability
    // Must not be "direct"
    expect(result.confidence).not.toBe("direct");
  });

  it("returns confidence NOT 'direct' for Lovepedal COT50 (unknown boutique)", () => {
    const result = lookupPedal("Lovepedal COT50", "helix_lt");
    expect(result.confidence).not.toBe("direct");
  });

  it("returns 'approximate' for fully unrecognized pedal with no category keywords", () => {
    const result = lookupPedal("Zeta Quartz Xylophone Module", "helix_lt");
    expect(result.confidence).toBe("approximate");
  });
});

// ---------------------------------------------------------------------------
// SC-03: Unknown boutique pedal NEVER returns 'direct'
// ---------------------------------------------------------------------------
describe("lookupPedal — unknown boutique pedal safety (SC-03, SC-06)", () => {
  const unknownPedals = [
    "Mythos Mjolnir",
    "Walrus Audio Eras",
    "JHS Morning Glory",
    "Earthquaker Devices Plumes",
    "Caroline Guitar Company Shigeharu",
    "Zeta Quartz Xylophone Module",
    "Some Random Pedal XYZ 9000",
  ];

  for (const pedalName of unknownPedals) {
    it(`'${pedalName}' does NOT return confidence 'direct'`, () => {
      const result = lookupPedal(pedalName, "helix_lt");
      expect(result.confidence).not.toBe("direct");
    });
  }
});

// ---------------------------------------------------------------------------
// SC-04: helixModelDisplayName is human-readable, not an HD2_* ID
// ---------------------------------------------------------------------------
describe("lookupPedal — helixModelDisplayName (SC-04)", () => {
  it("TS9 Tube Screamer returns human-readable display name", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.helixModelDisplayName).not.toMatch(/^HD2_/);
    expect(result.helixModelDisplayName).toBeTruthy();
  });

  it("TS9 Tube Screamer display name is 'Scream 808'", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.helixModelDisplayName).toBe("Scream 808");
  });

  it("helix model ID contains HD2_ prefix (internal ID correct)", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.helixModel).toMatch(/^HD2_/);
  });

  it("MXR Phase 90 has human-readable display name 'Script Mod Phase'", () => {
    const result = lookupPedal("MXR Phase 90", "helix_lt");
    expect(result.helixModelDisplayName).toBe("Script Mod Phase");
  });
});

// ---------------------------------------------------------------------------
// SC-05: mapRigToSubstitutions return type and device-correct IDs
// ---------------------------------------------------------------------------
describe("mapRigToSubstitutions — return type (SC-05)", () => {
  it("returns a flat array (not an object wrapper)", () => {
    const rig = makeRig("TS9 Tube Screamer");
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(Array.isArray(result)).toBe(true);
    expect(result).not.toHaveProperty("substitutions");
  });

  it("returns one entry for one pedal", () => {
    const rig = makeRig("TS9 Tube Screamer");
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(result).toHaveLength(1);
  });

  it("returns two entries for two pedals", () => {
    const rig: RigIntent = {
      pedals: [
        { brand: "Ibanez", model: "TS9", fullName: "TS9 Tube Screamer", knobPositions: {}, imageIndex: 0, confidence: "high" },
        { brand: "Boss", model: "DD-3", fullName: "Boss DD-3 Digital Delay", knobPositions: {}, imageIndex: 0, confidence: "high" },
      ],
    };
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(result).toHaveLength(2);
  });
});

describe("mapRigToSubstitutions — Pod Go Mono suffix (SC-05)", () => {
  it("pod_go produces Mono-suffixed ID for TS9 (distortion)", () => {
    const rig = makeRig("TS9 Tube Screamer");
    const result = mapRigToSubstitutions(rig, "pod_go");
    expect(result[0].helixModel).toBe("HD2_DistScream808Mono");
  });

  it("pod_go produces Mono-suffixed ID for Pro Co RAT (distortion)", () => {
    const rig = makeRig("Pro Co RAT", "RAT", "Pro Co");
    const result = mapRigToSubstitutions(rig, "pod_go");
    expect(result[0].helixModel).toMatch(/Mono$/);
  });

  it("pod_go produces Stereo-suffixed ID for Boss DM-2 (delay)", () => {
    const rig = makeRig("Boss DM-2", "DM-2", "Boss");
    const result = mapRigToSubstitutions(rig, "pod_go");
    expect(result[0].helixModel).toMatch(/Stereo$/);
  });

  it("pod_go produces Stereo-suffixed ID for MXR Phase 90 (modulation)", () => {
    const rig = makeRig("MXR Phase 90", "Phase 90", "MXR");
    const result = mapRigToSubstitutions(rig, "pod_go");
    expect(result[0].helixModel).toMatch(/Stereo$/);
  });
});

describe("mapRigToSubstitutions — helix_lt standard IDs (SC-05)", () => {
  it("helix_lt produces standard ID for TS9 (no suffix)", () => {
    const rig = makeRig("TS9 Tube Screamer");
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(result[0].helixModel).toBe("HD2_DistScream808");
    expect(result[0].helixModel).not.toMatch(/Mono$/);
    expect(result[0].helixModel).not.toMatch(/Stereo$/);
  });

  it("helix_lt produces standard ID for Boss DD-3 (no suffix)", () => {
    const rig = makeRig("Boss DD-3 Digital Delay", "DD-3", "Boss");
    const result = mapRigToSubstitutions(rig, "helix_lt");
    expect(result[0].helixModel).not.toMatch(/Mono$/);
    expect(result[0].helixModel).not.toMatch(/Stereo$/);
  });
});

// ---------------------------------------------------------------------------
// SC-06: Explicit unit test — pedal in table returns 'direct',
//        pedal not in table returns NOT 'direct'
// ---------------------------------------------------------------------------
describe("SC-06: direct vs non-direct confidence verification", () => {
  it("ibanez ts9 is in table -> returns confidence 'direct'", () => {
    const result = lookupPedal("ibanez ts9", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("mythos mjolnir is NOT in table -> does NOT return 'direct'", () => {
    const result = lookupPedal("mythos mjolnir", "helix_lt");
    expect(result.confidence).not.toBe("direct");
  });

  it("boss bd-2 is in table -> returns confidence 'direct'", () => {
    const result = lookupPedal("boss bd-2", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("unknown compressor not in table -> does NOT return 'direct'", () => {
    const result = lookupPedal("zendrive clone v2", "helix_lt");
    expect(result.confidence).not.toBe("direct");
  });
});

// ---------------------------------------------------------------------------
// Pitfall 5: Tone Sovereign excluded from Pod Go
// analogman king of tone -> Tone Sovereign -> excluded -> must NOT be "direct" on pod_go
// ---------------------------------------------------------------------------
describe("Pod Go excluded model safety (Pitfall 5)", () => {
  it("analogman king of tone on pod_go does NOT return confidence 'direct' (Tone Sovereign excluded)", () => {
    const result = lookupPedal("analogman king of tone", "pod_go");
    expect(result.confidence).not.toBe("direct");
  });

  it("analogman king of tone on helix_lt returns confidence 'direct' (Tone Sovereign available)", () => {
    const result = lookupPedal("analogman king of tone", "helix_lt");
    expect(result.confidence).toBe("direct");
  });

  it("analogman king of tone on pod_go still returns a valid SubstitutionEntry", () => {
    const result = lookupPedal("analogman king of tone", "pod_go");
    expect(result.physicalPedal).toBe("analogman king of tone");
    expect(result.helixModel).toMatch(/^HD2_/);
    expect(result.helixModelDisplayName).toBeTruthy();
    expect(result.substitutionReason).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// SubstitutionEntry shape validation
// ---------------------------------------------------------------------------
describe("SubstitutionEntry shape", () => {
  it("lookupPedal result has all required fields", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result).toHaveProperty("physicalPedal");
    expect(result).toHaveProperty("helixModel");
    expect(result).toHaveProperty("helixModelDisplayName");
    expect(result).toHaveProperty("substitutionReason");
    expect(result).toHaveProperty("confidence");
  });

  it("physicalPedal preserves original casing", () => {
    const result = lookupPedal("TS9 Tube Screamer", "helix_lt");
    expect(result.physicalPedal).toBe("TS9 Tube Screamer");
  });
});
