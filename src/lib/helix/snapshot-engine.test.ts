// src/lib/helix/snapshot-engine.test.ts
// TDD RED: Tests for snapshot-engine.ts buildSnapshots()

import { describe, it, expect } from "vitest";
import { buildSnapshots } from "./snapshot-engine";
import { assembleSignalChain } from "./chain-rules";
import { resolveParameters } from "./param-engine";
import type { BlockSpec, SnapshotSpec } from "./types";
import type { ToneIntent, SnapshotIntent } from "./tone-intent";

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
  const chain = assembleSignalChain(intent);
  return resolveParameters(chain, intent);
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

  // Test 11: parameterOverrides include Gain Block: lead=+2.5 dB, others=0.0 dB (SNAP-03)
  it("parameterOverrides: Gain Block lead=2.5 dB, others=0.0 dB", () => {
    const intent = cleanIntent();
    const chain = buildChain(intent);
    const result = buildSnapshots(chain, standardSnapshots());

    const gainBlock = chain.find((b) => b.type === "volume");
    const gainKey = findBlockKey(chain, gainBlock!);

    expect(result[0].parameterOverrides[gainKey]).toBeDefined();
    expect(result[0].parameterOverrides[gainKey].Gain).toBe(0.0); // clean
    expect(result[1].parameterOverrides[gainKey].Gain).toBe(0.0); // rhythm
    expect(result[2].parameterOverrides[gainKey].Gain).toBe(2.5); // lead (+2.5 dB)
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
