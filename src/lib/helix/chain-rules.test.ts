// chain-rules.test.ts — Signal chain assembly tests
// TDD RED phase: These tests define the expected behavior of assembleSignalChain()

import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";
import type { ToneIntent } from "./tone-intent";
import type { BlockSpec } from "./types";

// Helper: minimal clean ToneIntent
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

// Helper: minimal high-gain ToneIntent
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

// Helper: minimal crunch ToneIntent
function crunchIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "Grammatico Nrm",
    cabName: "4x12 Greenback25",
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

describe("assembleSignalChain", () => {
  // Test 1: Clean amp with no effects returns correct blocks in correct order
  it("returns blocks in order: boost (Minotaur) > amp > cab > EQ > gain block for clean amp with no effects", () => {
    const chain = assembleSignalChain(cleanIntent());

    const names = chain.map((b) => b.modelName);
    expect(names).toEqual([
      "Minotaur",
      "US Deluxe Nrm",
      "1x12 US Deluxe",
      "Parametric EQ",
      "Gain Block",
    ]);

    // DSP0: boost, amp, cab
    const dsp0Blocks = chain.filter((b) => b.dsp === 0);
    expect(dsp0Blocks.map((b) => b.modelName)).toEqual([
      "Minotaur",
      "US Deluxe Nrm",
      "1x12 US Deluxe",
    ]);

    // DSP1: EQ, gain block
    const dsp1Blocks = chain.filter((b) => b.dsp === 1);
    expect(dsp1Blocks.map((b) => b.modelName)).toEqual([
      "Parametric EQ",
      "Gain Block",
    ]);
  });

  // Test 2: High-gain amp returns correct blocks with Scream 808 and Horizon Gate
  it("returns blocks: Scream 808 > amp > cab > Horizon Gate > EQ > gain block for high-gain amp", () => {
    const chain = assembleSignalChain(highGainIntent());

    const names = chain.map((b) => b.modelName);
    expect(names).toEqual([
      "Scream 808",
      "Placater Dirty",
      "4x12 Cali V30",
      "Horizon Gate",
      "Parametric EQ",
      "Gain Block",
    ]);
  });

  // Test 3: Effects (delay, reverb, modulation) placed in correct order on DSP1
  it("places delay, reverb, modulation in correct order on DSP1 after EQ and before gain block", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
          { modelName: "70s Chorus", role: "toggleable" },
        ],
      })
    );

    const dsp1Names = chain
      .filter((b) => b.dsp === 1)
      .map((b) => b.modelName);

    // Order: EQ > modulation > delay > reverb > gain block
    expect(dsp1Names).toEqual([
      "Parametric EQ",
      "70s Chorus",
      "Simple Delay",
      "Hall",
      "Gain Block",
    ]);
  });

  // Test 4: If ToneIntent already includes Minotaur, it is not duplicated
  it("does not duplicate Minotaur if already in effects list", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [{ modelName: "Minotaur", role: "always_on" }],
      })
    );

    const minotaurBlocks = chain.filter((b) => b.modelName === "Minotaur");
    expect(minotaurBlocks).toHaveLength(1);

    // Minotaur should still be in the boost position (before amp)
    const names = chain.map((b) => b.modelName);
    const minotaurIndex = names.indexOf("Minotaur");
    const ampIndex = names.indexOf("US Deluxe Nrm");
    expect(minotaurIndex).toBeLessThan(ampIndex);
  });

  // Test 5: Crunch amp uses Minotaur boost (not Scream 808)
  it("uses Minotaur boost for crunch amp", () => {
    const chain = assembleSignalChain(crunchIntent());

    const boostBlock = chain.find(
      (b) => b.modelName === "Minotaur" || b.modelName === "Scream 808"
    );
    expect(boostBlock).toBeDefined();
    expect(boostBlock!.modelName).toBe("Minotaur");
  });

  // Test 6: DSP0 block count never exceeds 8 non-cab blocks; DSP1 count never exceeds 8
  it("enforces 8-block-per-DSP limit (non-cab blocks)", () => {
    // With max effects, we should not exceed 8 per DSP
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
          { modelName: "70s Chorus", role: "toggleable" },
          { modelName: "Teemah!", role: "toggleable" },
          { modelName: "Deluxe Comp", role: "toggleable" },
          { modelName: "UK Wah 846", role: "toggleable" },
        ],
      })
    );

    const dsp0NonCab = chain.filter(
      (b) => b.dsp === 0 && b.type !== "cab"
    );
    const dsp1NonCab = chain.filter(
      (b) => b.dsp === 1 && b.type !== "cab"
    );

    expect(dsp0NonCab.length).toBeLessThanOrEqual(8);
    expect(dsp1NonCab.length).toBeLessThanOrEqual(8);
  });

  // Test 7: Cab block has type "cab" and is on DSP0
  it("cab block has type 'cab' and is on DSP0", () => {
    const chain = assembleSignalChain(cleanIntent());

    const cabBlock = chain.find((b) => b.type === "cab");
    expect(cabBlock).toBeDefined();
    expect(cabBlock!.dsp).toBe(0);
    expect(cabBlock!.modelName).toBe("1x12 US Deluxe");
  });

  // Test 8: All blocks have path: 0 (serial single-path)
  it("all blocks have path: 0", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
        ],
      })
    );

    for (const block of chain) {
      expect(block.path).toBe(0);
    }
  });

  // Test 9: Parameters object is empty ({}) for all blocks
  it("all blocks have empty parameters object", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
        ],
      })
    );

    for (const block of chain) {
      expect(block.parameters).toEqual({});
    }
  });

  // Test 10: Delay and reverb blocks have trails: true; other blocks have trails: false or undefined
  it("delay and reverb blocks have trails: true; others do not", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
        ],
      })
    );

    for (const block of chain) {
      if (block.type === "delay" || block.type === "reverb") {
        expect(block.trails).toBe(true);
      } else {
        expect(block.trails === false || block.trails === undefined).toBe(
          true
        );
      }
    }
  });

  // Test 11: Unknown amp name throws error
  it("throws error for unknown amp name", () => {
    expect(() =>
      assembleSignalChain(cleanIntent({ ampName: "NonExistent Amp" }))
    ).toThrow(/unknown amp model/i);
  });

  // Test 12: Unknown cab name throws error
  it("throws error for unknown cab name", () => {
    expect(() =>
      assembleSignalChain(cleanIntent({ cabName: "NonExistent Cab" }))
    ).toThrow(/unknown cab model/i);
  });

  // Test 13: Unknown effect name throws error
  it("throws error for unknown effect name", () => {
    expect(() =>
      assembleSignalChain(
        cleanIntent({
          effects: [{ modelName: "NonExistent Effect", role: "toggleable" }],
        })
      )
    ).toThrow(/unknown effect model/i);
  });

  // Test 14: Position numbers are sequential per-DSP, cab excluded
  it("position numbers are sequential per-DSP and cab blocks are excluded from position count", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
          { modelName: "70s Chorus", role: "toggleable" },
        ],
      })
    );

    // DSP0 non-cab blocks should have sequential positions starting at 0
    const dsp0NonCab = chain.filter(
      (b) => b.dsp === 0 && b.type !== "cab"
    );
    for (let i = 0; i < dsp0NonCab.length; i++) {
      expect(dsp0NonCab[i].position).toBe(i);
    }

    // DSP1 blocks should have sequential positions starting at 0
    const dsp1Blocks = chain.filter((b) => b.dsp === 1);
    for (let i = 0; i < dsp1Blocks.length; i++) {
      expect(dsp1Blocks[i].position).toBe(i);
    }

    // Cab block should have position -1 or be excluded from position count
    const cabBlock = chain.find((b) => b.type === "cab");
    expect(cabBlock).toBeDefined();
    // Cab's position field value doesn't matter for block counting,
    // but it should not conflict with other DSP0 positions
  });

  // Additional: high-gain with effects confirms Horizon Gate placement
  it("Horizon Gate is placed after cab and before EQ for high-gain amps", () => {
    const chain = assembleSignalChain(highGainIntent());

    const names = chain.map((b) => b.modelName);
    const cabIndex = names.indexOf("4x12 Cali V30");
    const gateIndex = names.indexOf("Horizon Gate");
    const eqIndex = names.indexOf("Parametric EQ");

    expect(gateIndex).toBeGreaterThan(cabIndex);
    expect(gateIndex).toBeLessThan(eqIndex);
  });

  // Additional: Scream 808 not duplicated if already in effects
  it("does not duplicate Scream 808 if already in high-gain effects list", () => {
    const chain = assembleSignalChain(
      highGainIntent({
        effects: [{ modelName: "Scream 808", role: "always_on" }],
      })
    );

    const screamBlocks = chain.filter((b) => b.modelName === "Scream 808");
    expect(screamBlocks).toHaveLength(1);
  });

  // Additional: enabled is true for all blocks
  it("all blocks have enabled: true", () => {
    const chain = assembleSignalChain(cleanIntent());
    for (const block of chain) {
      expect(block.enabled).toBe(true);
    }
  });

  // Additional: stereo is false for all blocks
  it("all blocks have stereo: false", () => {
    const chain = assembleSignalChain(cleanIntent());
    for (const block of chain) {
      expect(block.stereo).toBe(false);
    }
  });

  // Additional: wah and compressor are placed correctly on DSP0
  it("wah is placed before boost on DSP0, compressor after wah before boost", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [
          { modelName: "UK Wah 846", role: "toggleable" },
          { modelName: "Deluxe Comp", role: "toggleable" },
        ],
      })
    );

    const dsp0Names = chain
      .filter((b) => b.dsp === 0 && b.type !== "cab")
      .map((b) => b.modelName);

    // Order: wah > compressor > boost > amp
    expect(dsp0Names).toEqual([
      "UK Wah 846",
      "Deluxe Comp",
      "Minotaur",
      "US Deluxe Nrm",
    ]);
  });

  // Additional: extra drive effects are placed on DSP0 before boost
  it("extra drive effects are placed on DSP0 before boost", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        effects: [{ modelName: "Teemah!", role: "toggleable" }],
      })
    );

    const dsp0Names = chain
      .filter((b) => b.dsp === 0 && b.type !== "cab")
      .map((b) => b.modelName);

    // Order: extra drive > boost > amp
    expect(dsp0Names).toEqual(["Teemah!", "Minotaur", "US Deluxe Nrm"]);
  });

  // Test: DSP block limit exceeded produces a clear, descriptive error
  it("throws a clear error message when DSP0 block limit would be exceeded", () => {
    // With 8 user effects all routed to DSP0 (wah, compressor, 6 drives)
    // plus mandatory Minotaur (boost) and amp = 10 non-cab blocks on DSP0
    // This must exceed the 8-block limit and throw a descriptive error
    expect(() =>
      assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "toggleable" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Stupor OD", role: "toggleable" },
            { modelName: "Deranged Master", role: "toggleable" },
            { modelName: "Vermin Dist", role: "toggleable" },
            { modelName: "Arbitrator Fuzz", role: "toggleable" },
          ],
        })
      )
    ).toThrow(/DSP0 block limit exceeded.*non-cab blocks.*max 8/);
  });
});
