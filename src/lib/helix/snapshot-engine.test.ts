// src/lib/helix/snapshot-engine.test.ts
// TDD RED: Tests for snapshot-engine.ts buildSnapshots()

import { describe, it, expect } from "vitest";
import { buildSnapshots } from "./snapshot-engine";
import { assembleSignalChain } from "./chain-rules";
import { resolveParameters } from "./param-engine";
import { getCapabilities } from "./device-family";
import type { BlockSpec, SnapshotSpec } from "./types";
import type { ToneIntent, SnapshotIntent } from "./tone-intent";

const defaultCaps = getCapabilities("helix_floor");

// Helper: create a minimal clean ToneIntent
function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

// Helper: create a high-gain ToneIntent
function highGainIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "Placater Dirty",
    cabName: "4x12 Cali V30",
    guitarType: "humbucker",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

// Helper: build a fully parameterized chain from an intent
function buildChain(intent: ToneIntent): BlockSpec[] {
  const chain = assembleSignalChain(intent, defaultCaps);
  return resolveParameters(chain, intent, defaultCaps);
}

// Helper: get the standard 4 snapshot intents
function standardSnapshots(): SnapshotIntent[] {
  return [
    { name: "Clean", toneRole: "clean" },
    { name: "Rhythm", toneRole: "crunch" },
    { name: "Lead", toneRole: "lead" },
    { name: "Ambient", toneRole: "ambient" },
  ];
}

describe("buildSnapshots", () => {
  // Test 1: buildSnapshots returns exactly 4 SnapshotSpec objects (SNAP-01)
  it("returns exactly 4 SnapshotSpec objects", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    expect(result).toHaveLength(4);
  });

  // Test 2: Snapshot names match the SnapshotIntent names provided
  it("snapshot names match the SnapshotIntent names", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    expect(result[0].name).toBe("Clean");
    expect(result[1].name).toBe("Rhythm");
    expect(result[2].name).toBe("Lead");
    expect(result[3].name).toBe("Ambient");
  });

  // Test 3: LED colors are correct (SNAP-01)
  it("LED colors: clean=6(blue), crunch=2(orange), lead=1(red), ambient=5(turquoise)", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    expect(result[0].ledColor).toBe(6); // Blue for clean
    expect(result[1].ledColor).toBe(2); // Orange for crunch/rhythm
    expect(result[2].ledColor).toBe(1); // Red for lead
    expect(result[3].ledColor).toBe(5); // Turquoise for ambient
  });

  // Test 4: Each snapshot has blockStates for every non-cab block in the chain (SNAP-05)
  it("each snapshot has blockStates for every non-cab block", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const nonCabBlocks = chain.filter((b) => b.type !== "cab");
    const result = buildSnapshots(chain, standardSnapshots());

    for (const snapshot of result) {
      const stateCount = Object.keys(snapshot.blockStates).length;
      expect(stateCount).toBe(nonCabBlocks.length);
    }
  });

  // Test 5: Clean snapshot has delay OFF, reverb ON, modulation OFF
  it("clean snapshot: delay OFF, reverb ON, modulation OFF", () => {
    const intent = cleanIntent({
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Glitz", role: "always_on" },
        { modelName: "Optical Trem", role: "ambient" },
      ],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    const clean = result[0];

    // Find block keys by type
    const delayBlock = chain.find((b) => b.type === "delay");
    const reverbBlock = chain.find((b) => b.type === "reverb");
    const modBlock = chain.find((b) => b.type === "modulation");

    expect(delayBlock).toBeDefined();
    expect(reverbBlock).toBeDefined();
    expect(modBlock).toBeDefined();

    // Find the block key for each
    const delayKey = findBlockKey(chain, delayBlock!);
    const reverbKey = findBlockKey(chain, reverbBlock!);
    const modKey = findBlockKey(chain, modBlock!);

    expect(clean.blockStates[delayKey]).toBe(false);
    expect(clean.blockStates[reverbKey]).toBe(true);
    expect(clean.blockStates[modKey]).toBe(false);
  });

  // Test 6: Lead snapshot has delay ON, reverb ON, ambient-role modulation ON (INTL-02)
  it("lead snapshot: delay ON, reverb ON, ambient-role modulation ON", () => {
    const intent = cleanIntent({
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Glitz", role: "always_on" },
        { modelName: "Optical Trem", role: "ambient" },
      ],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    const lead = result[2];

    const delayBlock = chain.find((b) => b.type === "delay");
    const reverbBlock = chain.find((b) => b.type === "reverb");
    const modBlock = chain.find((b) => b.type === "modulation");

    const delayKey = findBlockKey(chain, delayBlock!);
    const reverbKey = findBlockKey(chain, reverbBlock!);
    const modKey = findBlockKey(chain, modBlock!);

    expect(lead.blockStates[delayKey]).toBe(true);
    expect(lead.blockStates[reverbKey]).toBe(true);
    // ambient-role modulation is ON for lead per INTL-02
    expect(lead.blockStates[modKey]).toBe(true);
  });

  // Test 7: Ambient snapshot has delay ON, reverb ON, modulation ON
  it("ambient snapshot: delay ON, reverb ON, modulation ON", () => {
    const intent = cleanIntent({
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Glitz", role: "always_on" },
        { modelName: "Optical Trem", role: "ambient" },
      ],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());
    const ambient = result[3];

    const delayBlock = chain.find((b) => b.type === "delay");
    const reverbBlock = chain.find((b) => b.type === "reverb");
    const modBlock = chain.find((b) => b.type === "modulation");

    const delayKey = findBlockKey(chain, delayBlock!);
    const reverbKey = findBlockKey(chain, reverbBlock!);
    const modKey = findBlockKey(chain, modBlock!);

    expect(ambient.blockStates[delayKey]).toBe(true);
    expect(ambient.blockStates[reverbKey]).toBe(true);
    expect(ambient.blockStates[modKey]).toBe(true);
  });

  // Test 8: All snapshots have amp ON, post-cab EQ ON, Gain Block ON
  it("all snapshots have amp ON, EQ ON, Gain Block ON", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const ampBlock = chain.find((b) => b.type === "amp");
    const eqBlock = chain.find((b) => b.type === "eq");
    const gainBlock = chain.find((b) => b.type === "volume");

    expect(ampBlock).toBeDefined();
    expect(eqBlock).toBeDefined();
    expect(gainBlock).toBeDefined();

    const ampKey = findBlockKey(chain, ampBlock!);
    const eqKey = findBlockKey(chain, eqBlock!);
    const gainKey = findBlockKey(chain, gainBlock!);

    for (const snapshot of result) {
      expect(snapshot.blockStates[ampKey]).toBe(true);
      expect(snapshot.blockStates[eqKey]).toBe(true);
      expect(snapshot.blockStates[gainKey]).toBe(true);
    }
  });

  // Test 9: Clean snapshot for clean amp has boost OFF; for high-gain amp has boost ON
  it("clean snapshot: boost OFF for clean amp, ON for high-gain amp", () => {
    // Clean amp
    const cleanI = cleanIntent();
    const cleanChain = buildChain(cleanI);
    const cleanResult = buildSnapshots(cleanChain, standardSnapshots());
    const cleanSnap = cleanResult[0]; // clean snapshot

    const cleanBoost = cleanChain.find(
      (b) => b.type === "distortion" && (b.modelId === "HD2_DistMinotaur" || b.modelId === "HD2_DistScream808")
    );
    expect(cleanBoost).toBeDefined();
    const cleanBoostKey = findBlockKey(cleanChain, cleanBoost!);
    expect(cleanSnap.blockStates[cleanBoostKey]).toBe(false); // OFF for clean amp's clean snapshot

    // High-gain amp
    const hgI = highGainIntent();
    const hgChain = buildChain(hgI);
    const hgResult = buildSnapshots(hgChain, standardSnapshots());
    const hgCleanSnap = hgResult[0]; // clean snapshot of high-gain preset

    const hgBoost = hgChain.find(
      (b) => b.type === "distortion" && (b.modelId === "HD2_DistMinotaur" || b.modelId === "HD2_DistScream808")
    );
    expect(hgBoost).toBeDefined();
    const hgBoostKey = findBlockKey(hgChain, hgBoost!);
    expect(hgCleanSnap.blockStates[hgBoostKey]).toBe(true); // ON for high-gain amp's clean snapshot
  });

  // Test 10: parameterOverrides include amp ChVol: clean=0.68, lead=0.80 (SNAP-02)
  it("parameterOverrides: amp ChVol clean=0.68, lead=0.80", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const ampBlock = chain.find((b) => b.type === "amp");
    const ampKey = findBlockKey(chain, ampBlock!);

    expect(result[0].parameterOverrides[ampKey]).toBeDefined();
    expect(result[0].parameterOverrides[ampKey].ChVol).toBe(0.68); // clean
    expect(result[2].parameterOverrides[ampKey].ChVol).toBe(0.80); // lead
  });

  // Test 11: parameterOverrides include Gain Block: lead=+2.0 dB, others=0.0 dB (SNAP-03, MED-08)
  it("parameterOverrides: Gain Block lead=2.0 dB, others=0.0 dB", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const gainBlock = chain.find((b) => b.type === "volume");
    const gainKey = findBlockKey(chain, gainBlock!);

    expect(result[0].parameterOverrides[gainKey]).toBeDefined();
    expect(result[0].parameterOverrides[gainKey].Gain).toBe(0.0); // clean
    expect(result[1].parameterOverrides[gainKey].Gain).toBe(0.0); // rhythm
    expect(result[2].parameterOverrides[gainKey].Gain).toBe(2.0); // lead (+2.0 dB, MED-08)
    expect(result[3].parameterOverrides[gainKey].Gain).toBe(0.0); // ambient
  });

  // Test 12: Block states use per-DSP position numbering keys (SNAP-05)
  it("block state keys use 'block{N}' per-DSP position format", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    // All keys should match the block{N} pattern
    for (const snapshot of result) {
      for (const key of Object.keys(snapshot.blockStates)) {
        expect(key).toMatch(/^block\d+$/);
      }
    }
  });

  // Test 13: Description field is a meaningful string for each snapshot role
  it("each snapshot has a meaningful description string", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    for (const snapshot of result) {
      expect(snapshot.description).toBeTruthy();
      expect(typeof snapshot.description).toBe("string");
      expect(snapshot.description.length).toBeGreaterThan(5);
    }
  });

  // Test 14: Blocks not in chain produce no phantom block state entries
  it("no phantom block state entries for blocks not in chain", () => {
    const intent = cleanIntent(); // No delay, reverb, or modulation effects
    const chain = buildChain(intent);
    const nonCabBlocks = chain.filter((b) => b.type !== "cab");
    const result = buildSnapshots(chain, standardSnapshots());

    for (const snapshot of result) {
      const stateKeys = Object.keys(snapshot.blockStates);
      // Number of states should exactly match number of non-cab blocks
      expect(stateKeys.length).toBe(nonCabBlocks.length);
    }
  });
});

// ============================================================
// FX-04: Snapshot ChVol balance regression lock
// ============================================================
// This test explicitly names the FX-04 requirement to provide an audit trail
// and regression protection for the already-implemented ROLE_CHVOL behavior
// in snapshot-engine.ts. Lead snapshots must always be louder than clean
// snapshots by default (FX-04 success criterion).

describe("FX-04: snapshot ChVol balance", () => {
  it("FX-04: lead snapshot ChVol is higher than clean snapshot ChVol by default", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    const ampKey = findBlockKey(chain, ampBlock!);

    const leadChVol = result[2].parameterOverrides[ampKey].ChVol as number;  // lead
    const cleanChVol = result[0].parameterOverrides[ampKey].ChVol as number; // clean

    // FX-04 core assertion: lead must be louder than clean
    expect(leadChVol).toBeGreaterThan(cleanChVol);
    // FX-04 exact values from ROLE_CHVOL table: lead=0.80, clean=0.68
    expect(leadChVol).toBeCloseTo(0.80, 5);
    expect(cleanChVol).toBeCloseTo(0.68, 5);
  });
});

// ============================================================
// COHERE-03: boost model disambiguation (slot field)
// ============================================================

describe("COHERE-03: boost model disambiguation", () => {
  // COHERE-03-1: Mandatory Minotaur (slot="boost") stays ON in crunch/lead/ambient for clean amp
  it("mandatory Minotaur (slot=boost) stays ON in crunch/lead/ambient snapshots", () => {
    const intent = cleanIntent(); // clean amp -> mandatory Minotaur with slot="boost"
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const boostBlock = chain.find(
      (b) => b.modelName === "Minotaur" && b.slot === "boost"
    );
    expect(boostBlock).toBeDefined();
    const boostKey = findBlockKey(chain, boostBlock!);

    // Mandatory boost: OFF only in clean snapshot for clean amps
    expect(result[0].blockStates[boostKey]).toBe(false);  // clean
    expect(result[1].blockStates[boostKey]).toBe(true);   // crunch
    expect(result[2].blockStates[boostKey]).toBe(true);   // lead
    expect(result[3].blockStates[boostKey]).toBe(true);   // ambient
  });

  // COHERE-03-2: User-selected Minotaur (no slot="boost") follows distortion toggle rules
  it("user-selected Minotaur (no slot=boost) follows distortion toggle rules — OFF in clean", () => {
    const intent = cleanIntent({
      effects: [{ modelName: "Minotaur", role: "toggleable" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    // User Minotaur should NOT have slot="boost"
    const userMinotaur = chain.find(
      (b) => b.modelName === "Minotaur"
    );
    expect(userMinotaur).toBeDefined();
    expect(userMinotaur!.slot).not.toBe("boost");

    const minotaurKey = findBlockKey(chain, userMinotaur!);

    // Distortion toggle rules: OFF in clean, ON in crunch/lead
    expect(result[0].blockStates[minotaurKey]).toBe(false); // clean — OFF (distortion rule)
    expect(result[1].blockStates[minotaurKey]).toBe(true);  // crunch — ON
    expect(result[2].blockStates[minotaurKey]).toBe(true);  // lead — ON
  });

  // COHERE-03-3: Backward compat — BlockSpec without slot field treated as boost via fallback
  it("backward compat: BlockSpec without slot field but with Minotaur modelId treated as boost", () => {
    // Manually construct a chain with Minotaur that has NO slot field (old preset format)
    const ampBlock: BlockSpec = {
      type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm",
      dsp: 0, position: 1, path: 0, enabled: true, stereo: false, parameters: {},
    };
    const minotaurBlock: BlockSpec = {
      type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur",
      dsp: 0, position: 0, path: 0, enabled: true, stereo: false, parameters: {},
      // NO slot field — simulating old preset format
    };

    const chain = [minotaurBlock, ampBlock];
    const result = buildSnapshots(chain, standardSnapshots());

    // Without slot field, fallback to BOOST_MODEL_IDS — treated as boost
    // Boost on clean amp: OFF in clean snapshot
    expect(result[0].blockStates["block0"]).toBe(false); // clean — OFF (boost behavior)
    expect(result[1].blockStates["block0"]).toBe(true);  // crunch — ON (boost behavior)
    expect(result[2].blockStates["block0"]).toBe(true);  // lead — ON (boost behavior)
  });
});

// ============================================================
// COHERE-04: dynamics type split (compressor vs gate)
// ============================================================

describe("COHERE-04: dynamics type split", () => {
  // COHERE-04-1: High-gain chain with Deluxe Comp — compressor OFF in lead snapshot
  it("high-gain chain: Deluxe Comp (compressor) OFF in lead snapshot", () => {
    const intent = highGainIntent({
      effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const compBlock = chain.find((b) => b.modelName === "Deluxe Comp");
    expect(compBlock).toBeDefined();
    const compKey = findBlockKey(chain, compBlock!);

    expect(result[2].blockStates[compKey]).toBe(false); // lead — OFF
  });

  // COHERE-04-2: High-gain chain with Deluxe Comp — compressor OFF in crunch snapshot
  it("high-gain chain: Deluxe Comp (compressor) OFF in crunch snapshot", () => {
    const intent = highGainIntent({
      effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const compBlock = chain.find((b) => b.modelName === "Deluxe Comp");
    expect(compBlock).toBeDefined();
    const compKey = findBlockKey(chain, compBlock!);

    expect(result[1].blockStates[compKey]).toBe(false); // crunch — OFF
  });

  // COHERE-04-3: High-gain chain with Deluxe Comp — compressor ON in clean snapshot
  it("high-gain chain: Deluxe Comp (compressor) ON in clean snapshot", () => {
    const intent = highGainIntent({
      effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const compBlock = chain.find((b) => b.modelName === "Deluxe Comp");
    expect(compBlock).toBeDefined();
    const compKey = findBlockKey(chain, compBlock!);

    expect(result[0].blockStates[compKey]).toBe(true); // clean — ON
  });

  // COHERE-04-4: High-gain chain with Deluxe Comp — compressor ON in ambient snapshot
  it("high-gain chain: Deluxe Comp (compressor) ON in ambient snapshot", () => {
    const intent = highGainIntent({
      effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const compBlock = chain.find((b) => b.modelName === "Deluxe Comp");
    expect(compBlock).toBeDefined();
    const compKey = findBlockKey(chain, compBlock!);

    expect(result[3].blockStates[compKey]).toBe(true); // ambient — ON
  });

  // COHERE-04-5: Clean amp chain with Deluxe Comp — compressor ON in ALL snapshots
  it("clean amp chain: Deluxe Comp (compressor) ON in all snapshots", () => {
    const intent = cleanIntent({
      effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const compBlock = chain.find((b) => b.modelName === "Deluxe Comp");
    expect(compBlock).toBeDefined();
    const compKey = findBlockKey(chain, compBlock!);

    for (const snapshot of result) {
      expect(snapshot.blockStates[compKey]).toBe(true);
    }
  });

  // COHERE-04-6: High-gain chain with Horizon Gate — gate ON in ALL snapshots
  it("high-gain chain: Horizon Gate (gate) ON in all snapshots", () => {
    const intent = highGainIntent(); // Horizon Gate is mandatory for high-gain
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const gateBlock = chain.find((b) => b.modelName === "Horizon Gate");
    expect(gateBlock).toBeDefined();
    const gateKey = findBlockKey(chain, gateBlock!);

    for (const snapshot of result) {
      expect(snapshot.blockStates[gateKey]).toBe(true);
    }
  });

  // COHERE-04-7: Autoswell (category=dynamics) ON in all snapshots
  it("Autoswell (dynamics, neither compressor nor gate) ON in all snapshots", () => {
    const intent = cleanIntent({
      effects: [{ modelName: "Autoswell", role: "always_on" }],
    });
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const autoswellBlock = chain.find((b) => b.modelName === "Autoswell");
    expect(autoswellBlock).toBeDefined();
    const autoswellKey = findBlockKey(chain, autoswellBlock!);

    for (const snapshot of result) {
      expect(snapshot.blockStates[autoswellKey]).toBe(true);
    }
  });
});

// ============================================================
// SNAP-07: Per-role effect parameter overrides
// ============================================================

describe("SNAP-07: per-role effect parameter overrides", () => {
  function intentWithEffects(): ToneIntent {
    return cleanIntent({
      genreHint: "rock",
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
    });
  }

  it("lead snapshot applies reverb Mix boost above base", () => {
    const intent = intentWithEffects();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots(), intent.genreHint);
    const lead = result[2]; // lead
    const reverbBlock = chain.find(b => b.type === "reverb")!;
    const reverbKey = findBlockKey(chain, reverbBlock);
    const baseMix = reverbBlock.parameters.Mix as number;
    expect(lead.parameterOverrides[reverbKey]?.Mix).toBeGreaterThan(baseMix);
  });

  it("crunch snapshot reduces reverb Mix below base", () => {
    const intent = intentWithEffects();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots(), intent.genreHint);
    const crunch = result[1]; // crunch
    const reverbBlock = chain.find(b => b.type === "reverb")!;
    const reverbKey = findBlockKey(chain, reverbBlock);
    const baseMix = reverbBlock.parameters.Mix as number;
    expect(crunch.parameterOverrides[reverbKey]?.Mix).toBeLessThan(baseMix);
  });

  it("ambient snapshot reverb boost matches legacy values", () => {
    const intent = intentWithEffects();
    const chain = buildChain(intent);
    // No genreHint → default modifier (scale 1.0)
    const result = buildSnapshots(chain, standardSnapshots());
    const ambient = result[3];
    const reverbBlock = chain.find(b => b.type === "reverb")!;
    const reverbKey = findBlockKey(chain, reverbBlock);
    const baseMix = reverbBlock.parameters.Mix as number;
    // Legacy: baseMix + 0.20
    expect(ambient.parameterOverrides[reverbKey]?.Mix).toBeCloseTo(
      Math.min(baseMix + 0.20, 1.0), 5
    );
  });

  it("lead snapshot applies delay Mix boost", () => {
    const intent = intentWithEffects();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots(), intent.genreHint);
    const lead = result[2];
    const delayBlock = chain.find(b => b.type === "delay")!;
    const delayKey = findBlockKey(chain, delayBlock);
    const baseMix = delayBlock.parameters.Mix as number;
    expect(lead.parameterOverrides[delayKey]?.Mix).toBeGreaterThan(baseMix);
  });
});

// ============================================================
// SNAP-08: Genre-modulated snapshot tuning
// ============================================================

describe("SNAP-08: genre-modulated snapshot tuning", () => {
  function intentWithGenre(genre: string): ToneIntent {
    return cleanIntent({
      genreHint: genre,
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
    });
  }

  it("metal genre halves lead reverb Mix boost", () => {
    const metalIntent = intentWithGenre("metal");
    const rockIntent = intentWithGenre("rock");
    const metalChain = buildChain(metalIntent);
    const rockChain = buildChain(rockIntent);
    const metalSnaps = buildSnapshots(metalChain, standardSnapshots(), "metal");
    const rockSnaps = buildSnapshots(rockChain, standardSnapshots(), "rock");

    const metalReverb = metalChain.find(b => b.type === "reverb")!;
    const rockReverb = rockChain.find(b => b.type === "reverb")!;
    const metalKey = findBlockKey(metalChain, metalReverb);
    const rockKey = findBlockKey(rockChain, rockReverb);

    const metalLeadMix = metalSnaps[2].parameterOverrides[metalKey]?.Mix;
    const rockLeadMix = rockSnaps[2].parameterOverrides[rockKey]?.Mix;

    // Metal lead boost should be smaller than rock lead boost
    const metalBase = metalReverb.parameters.Mix as number;
    const rockBase = rockReverb.parameters.Mix as number;
    const metalDelta = ((metalLeadMix ?? metalBase) as number) - metalBase;
    const rockDelta = ((rockLeadMix ?? rockBase) as number) - rockBase;
    expect(metalDelta).toBeLessThan(rockDelta);
  });

  it("worship genre doubles lead reverb Mix boost", () => {
    const worshipIntent = intentWithGenre("worship");
    const rockIntent = intentWithGenre("rock");
    const worshipChain = buildChain(worshipIntent);
    const rockChain = buildChain(rockIntent);
    const worshipSnaps = buildSnapshots(worshipChain, standardSnapshots(), "worship");
    const rockSnaps = buildSnapshots(rockChain, standardSnapshots(), "rock");

    const worshipReverb = worshipChain.find(b => b.type === "reverb")!;
    const rockReverb = rockChain.find(b => b.type === "reverb")!;
    const worshipKey = findBlockKey(worshipChain, worshipReverb);
    const rockKey = findBlockKey(rockChain, rockReverb);

    const worshipLeadMix = worshipSnaps[2].parameterOverrides[worshipKey]?.Mix;
    const rockLeadMix = rockSnaps[2].parameterOverrides[rockKey]?.Mix;

    const worshipBase = worshipReverb.parameters.Mix as number;
    const rockBase = rockReverb.parameters.Mix as number;
    const worshipDelta = ((worshipLeadMix ?? worshipBase) as number) - worshipBase;
    const rockDelta = ((rockLeadMix ?? rockBase) as number) - rockBase;
    expect(worshipDelta).toBeGreaterThan(rockDelta);
  });
});

// Helper: compute the block key for a given block in the chain,
// using global sequential numbering (excluding cabs).
// Matches the snapshot-engine's buildBlockKeys() which uses global indices.
function findBlockKey(chain: BlockSpec[], target: BlockSpec): string {
  let globalIdx = 0;

  for (const block of chain) {
    if (block.type === "cab") continue;
    if (block === target) {
      return `block${globalIdx}`;
    }
    globalIdx++;
  }
  throw new Error(`Block not found in chain: ${target.modelName}`);
}
