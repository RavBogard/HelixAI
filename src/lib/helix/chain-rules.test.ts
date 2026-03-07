// chain-rules.test.ts — Signal chain assembly tests
// TDD RED phase: These tests define the expected behavior of assembleSignalChain()

import { describe, it, expect, vi, afterEach } from "vitest";
import { assembleSignalChain } from "./chain-rules";
import { getCapabilities } from "./device-family";
import { getToneIntentSchema } from "./tone-intent";
import type { ToneIntent } from "./tone-intent";
import type { BlockSpec } from "./types";

// Default capabilities (Helix Floor) for tests that don't specify a device
const HELIX_CAPS = getCapabilities("helix_floor");

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
  // COHERE-02: Plate reverb auto-inserted for clean/ambient snapshots
  it("returns blocks in order: boost (Minotaur) > amp > cab > EQ > Plate > gain block for clean amp with no effects", () => {
    const chain = assembleSignalChain(cleanIntent(), HELIX_CAPS);

    const names = chain.map((b) => b.modelName);
    expect(names).toEqual([
      "Minotaur",
      "US Deluxe Nrm",
      "1x12 US Deluxe",
      "Parametric EQ",
      "Plate",
      "Gain Block",
    ]);

    // DSP0: boost, amp, cab
    const dsp0Blocks = chain.filter((b) => b.dsp === 0);
    expect(dsp0Blocks.map((b) => b.modelName)).toEqual([
      "Minotaur",
      "US Deluxe Nrm",
      "1x12 US Deluxe",
    ]);

    // DSP1: EQ, Plate, gain block
    const dsp1Blocks = chain.filter((b) => b.dsp === 1);
    expect(dsp1Blocks.map((b) => b.modelName)).toEqual([
      "Parametric EQ",
      "Plate",
      "Gain Block",
    ]);
  });

  // Test 2: High-gain amp returns correct blocks with Scream 808 and Horizon Gate
  // COMBO-02: Horizon Gate now placed before amp (pre-amp position) for high-gain
  // COHERE-02: Plate reverb auto-inserted (default high-gain helper has clean+ambient snapshots)
  it("returns blocks: Horizon Gate > Scream 808 > amp > cab > EQ > Plate > gain block for high-gain amp", () => {
    const chain = assembleSignalChain(highGainIntent(), HELIX_CAPS);

    const names = chain.map((b) => b.modelName);
    expect(names).toEqual([
      "Horizon Gate",
      "Scream 808",
      "Placater Dirty",
      "4x12 Cali V30",
      "Parametric EQ",
      "Plate",
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
      }),
      HELIX_CAPS
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
      }),
      HELIX_CAPS
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
    const chain = assembleSignalChain(crunchIntent(), HELIX_CAPS);

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
      }),
      HELIX_CAPS
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
    const chain = assembleSignalChain(cleanIntent(), HELIX_CAPS);

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
      }),
      HELIX_CAPS
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
      }),
      HELIX_CAPS
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
      }),
      HELIX_CAPS
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
      assembleSignalChain(cleanIntent({ ampName: "NonExistent Amp" }), HELIX_CAPS)
    ).toThrow(/unknown amp model/i);
  });

  // Test 12: Unknown cab name throws error
  it("throws error for unknown cab name", () => {
    expect(() =>
      assembleSignalChain(cleanIntent({ cabName: "NonExistent Cab" }), HELIX_CAPS)
    ).toThrow(/unknown cab model/i);
  });

  // Test 13: Unknown effect name throws error
  it("throws error for unknown effect name", () => {
    expect(() =>
      assembleSignalChain(
        cleanIntent({
          effects: [{ modelName: "NonExistent Effect", role: "toggleable" }],
        }),
        HELIX_CAPS
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
      }),
      HELIX_CAPS
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
  // COMBO-02: Horizon Gate is now placed before amp (pre-amp position) for high-gain
  it("Horizon Gate is placed before amp for high-gain amps", () => {
    const chain = assembleSignalChain(highGainIntent(), HELIX_CAPS);

    const names = chain.map((b) => b.modelName);
    const ampIndex = names.indexOf("Placater Dirty");
    const gateIndex = names.indexOf("Horizon Gate");

    expect(gateIndex).toBeLessThan(ampIndex);
  });

  // Additional: Scream 808 not duplicated if already in effects
  it("does not duplicate Scream 808 if already in high-gain effects list", () => {
    const chain = assembleSignalChain(
      highGainIntent({
        effects: [{ modelName: "Scream 808", role: "always_on" }],
      }),
      HELIX_CAPS
    );

    const screamBlocks = chain.filter((b) => b.modelName === "Scream 808");
    expect(screamBlocks).toHaveLength(1);
  });

  // Additional: enabled is true for all blocks
  it("all blocks have enabled: true", () => {
    const chain = assembleSignalChain(cleanIntent(), HELIX_CAPS);
    for (const block of chain) {
      expect(block.enabled).toBe(true);
    }
  });

  // Additional: stereo is false for all blocks
  it("all blocks have stereo: false", () => {
    const chain = assembleSignalChain(cleanIntent(), HELIX_CAPS);
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
      }),
      HELIX_CAPS
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
      }),
      HELIX_CAPS
    );

    const dsp0Names = chain
      .filter((b) => b.dsp === 0 && b.type !== "cab")
      .map((b) => b.modelName);

    // Order: extra drive > boost > amp
    expect(dsp0Names).toEqual(["Teemah!", "Minotaur", "US Deluxe Nrm"]);
  });

  // Test: COHERE-01 prevents DSP0 overflow by capping drives to 2
  // Previously 8 user effects (wah, comp, 6 drives) + boost + amp = 10 DSP0 blocks → overflow
  // Now COHERE-01 caps drives to 2, so DSP0 = wah + comp + 2 drives + boost + amp = 6 → no overflow
  it("COHERE-01 drive cap prevents DSP0 overflow from excess user drives", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const chain = assembleSignalChain(
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
      }),
      HELIX_CAPS
    );

    const dsp0NonCab = chain.filter(
      (b) => b.dsp === 0 && b.type !== "cab"
    );
    // wah + comp + 2 drives (COHERE-01) + boost + amp = 6
    expect(dsp0NonCab.length).toBeLessThanOrEqual(8);
    // Verify drives were capped
    const userDrives = chain.filter(
      (b) => b.type === "distortion" && b.modelName !== "Minotaur" && b.modelName !== "Scream 808"
    );
    expect(userDrives).toHaveLength(2);
  });

  // --- Cross-device model contamination tests ---

  it("Stadium preset with valid Agoura amp produces Agoura_* model IDs", () => {
    const chain = assembleSignalChain(
      cleanIntent({
        ampName: "Agoura German Xtra Red",
        cabName: "4x12 Cali V30",
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Rhythm", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
          { name: "Ambient", toneRole: "ambient" },
        ],
      }),
      getCapabilities("helix_stadium")
    );
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toMatch(/^Agoura_/);
  });

  it("Stadium preset with HD2-only amp name falls back to Agoura equivalent", () => {
    // "US Double Nrm" is an HD2 clean amp — should fallback to an Agoura clean amp
    const chain = assembleSignalChain(
      cleanIntent({ ampName: "US Double Nrm" }),
      getCapabilities("helix_stadium")
    );
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toMatch(/^Agoura_/); // Mapped to an Agoura amp
  });

  it("Stadium preset with HD2 Plexi falls back to Agoura Brit Plexi (basedOn match)", () => {
    const chain = assembleSignalChain(
      cleanIntent({ ampName: "Brit Plexi Jump" }),
      getCapabilities("helix_stadium")
    );
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toBe("Agoura_AmpBritPlexi");
  });

  it("Helix LT preset with valid HD2 amp produces HD2_* model IDs", () => {
    const chain = assembleSignalChain(cleanIntent(), getCapabilities("helix_lt"));
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toMatch(/^HD2_/);
  });

  it("Non-Stadium device with Agoura amp name falls back to HD2 equivalent", () => {
    // "Agoura Brit Plexi" is Stadium-only — should fallback to closest HD2 amp for Stomp XL
    const chain = assembleSignalChain(
      cleanIntent({ ampName: "Agoura Brit Plexi" }),
      getCapabilities("helix_stomp_xl")
    );
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toMatch(/^HD2_/); // Must be HD2, not Agoura
    expect(ampBlock!.modelName).not.toMatch(/^Agoura/);
  });

  it("Helix Floor with Agoura amp name falls back to HD2 equivalent", () => {
    // "Agoura US Clean" is Stadium-only — should map to a Fender clean HD2 amp
    const chain = assembleSignalChain(
      cleanIntent({ ampName: "Agoura US Clean" }),
      getCapabilities("helix_floor")
    );
    const ampBlock = chain.find((b) => b.type === "amp");
    expect(ampBlock).toBeDefined();
    expect(ampBlock!.modelId).toMatch(/^HD2_/);
  });

  // --- Effect budget truncation warning tests (BUDGET-05) ---

  describe("effect budget truncation warning (BUDGET-05)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs console.warn when effects exceed maxEffectsPerDsp for Stadium", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const stadiumCaps = getCapabilities("helix_stadium");

      // 10 non-drive effects to exceed Stadium maxEffectsPerDsp=8 even after COHERE-01
      // COHERE-01 only caps drives to 2; non-drive effects are unaffected
      // COHERE-02 won't add Plate since Hall is already a reverb
      assembleSignalChain(
        cleanIntent({
          ampName: "Agoura German Xtra Red",
          cabName: "4x12 Cali V30",
          effects: [
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Adriatic Delay", role: "toggleable" },
            { modelName: "Ganymede", role: "toggleable" },
            { modelName: "Cosmos Echo", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Glitz", role: "toggleable" },
          ],
        }),
        stadiumCaps
      );

      const budgetWarn = warnSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("Effect budget exceeded")
      );
      expect(budgetWarn).toBeDefined();
    });

    it("does NOT warn when effects fit within budget", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const stadiumCaps = getCapabilities("helix_stadium");

      assembleSignalChain(
        cleanIntent({
          ampName: "Agoura German Xtra Red",
          cabName: "4x12 Cali V30",
          effects: [
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
          ],
        }),
        stadiumCaps
      );

      const budgetWarn = warnSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("Effect budget exceeded")
      );
      expect(budgetWarn).toBeUndefined();
    });

    it("Stadium with 8 user effects (max 2 drives) produces all 8 in output", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const stadiumCaps = getCapabilities("helix_stadium");

      // COMBO-02: Use UK Wah 846 instead of Deluxe Comp — toggleable compressors
      // are omitted from high-gain chains (Agoura German Xtra Red is high_gain)
      // COHERE-01: Max 2 drives — replaced 3rd drive (Vermin Dist) with Adriatic Delay
      // COHERE-02: Hall reverb present, so no auto Plate insertion
      const chain = assembleSignalChain(
        cleanIntent({
          ampName: "Agoura German Xtra Red",
          cabName: "4x12 Cali V30",
          effects: [
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "UK Wah 846", role: "toggleable" },
            { modelName: "Stupor OD", role: "toggleable" },
            { modelName: "Adriatic Delay", role: "toggleable" },
            { modelName: "Ganymede", role: "toggleable" },
          ],
        }),
        stadiumCaps
      );

      // Count user effect blocks (exclude amp, cab, and all mandatory blocks)
      const mandatoryNames = new Set([
        "Minotaur", "Scream 808", "Stadium Parametric EQ",
        "Parametric EQ", "Gain Block", "Horizon Gate",
      ]);
      const userEffects = chain.filter(
        (b) =>
          b.type !== "amp" &&
          b.type !== "cab" &&
          !mandatoryNames.has(b.modelName)
      );
      expect(userEffects).toHaveLength(8);
    });
  });

  // --- COMBO-02: high-gain gate placement and compressor omission ---

  describe("COMBO-02: high-gain gate placement and compressor omission", () => {
    // COMBO-02-1: High-gain chain places Horizon Gate BEFORE amp
    it("high-gain chain places Horizon Gate before amp (pre-amp position)", () => {
      const chain = assembleSignalChain(highGainIntent(), HELIX_CAPS);
      const names = chain.map((b) => b.modelName);
      const gateIndex = names.indexOf("Horizon Gate");
      const ampIndex = names.indexOf("Placater Dirty");

      expect(gateIndex).toBeGreaterThanOrEqual(0);
      expect(ampIndex).toBeGreaterThanOrEqual(0);
      expect(gateIndex).toBeLessThan(ampIndex);
    });

    // COMBO-02-2: High-gain chain with toggleable compressor omits it
    it("high-gain chain with toggleable compressor omits compressor from output", () => {
      const chain = assembleSignalChain(
        highGainIntent({
          effects: [{ modelName: "Deluxe Comp", role: "toggleable" }],
        }),
        HELIX_CAPS
      );
      const names = chain.map((b) => b.modelName);
      expect(names).not.toContain("Deluxe Comp");
    });

    // COMBO-02-3: High-gain chain with always_on compressor KEEPS it
    it("high-gain chain with always_on compressor keeps compressor in output", () => {
      const chain = assembleSignalChain(
        highGainIntent({
          effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
        }),
        HELIX_CAPS
      );
      const names = chain.map((b) => b.modelName);
      expect(names).toContain("Deluxe Comp");
    });

    // COMBO-02-4: Clean chain with compressor still includes it
    it("clean chain with toggleable compressor still includes compressor", () => {
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [{ modelName: "Deluxe Comp", role: "toggleable" }],
        }),
        HELIX_CAPS
      );
      const names = chain.map((b) => b.modelName);
      expect(names).toContain("Deluxe Comp");
    });

    // COMBO-02-5: High-gain chain gate is between extra_drive and boost
    it("high-gain Horizon Gate is placed between extra_drive and boost", () => {
      const chain = assembleSignalChain(
        highGainIntent({
          effects: [{ modelName: "Teemah!", role: "toggleable" }],
        }),
        HELIX_CAPS
      );
      const names = chain.map((b) => b.modelName);
      const teemahIndex = names.indexOf("Teemah!");
      const gateIndex = names.indexOf("Horizon Gate");
      const boostIndex = names.indexOf("Scream 808");

      expect(teemahIndex).toBeGreaterThanOrEqual(0);
      expect(gateIndex).toBeGreaterThanOrEqual(0);
      expect(boostIndex).toBeGreaterThanOrEqual(0);
      // Gate should be after extra_drive (Teemah!) and before boost (Scream 808)
      expect(gateIndex).toBeGreaterThan(teemahIndex);
      expect(gateIndex).toBeLessThan(boostIndex);
    });
  });

  // --- COMBO-03: priority-based effect truncation ---

  describe("COMBO-03: priority-based effect truncation", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // COMBO-03-1: Pod Go with 5 effects drops modulation (lowest priority)
    it("Pod Go with 5 effects drops modulation (lowest priority) and keeps other 4", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // 70s Chorus (modulation, score ~55) should be dropped
      expect(names).not.toContain("70s Chorus");
      // These 4 should survive
      expect(names).toContain("UK Wah 846");
      expect(names).toContain("Deluxe Comp");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("Hall");
    });

    // COMBO-03-2: always_on wah survives truncation
    it("Pod Go with always_on wah and 4 toggleable effects keeps wah", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      expect(names).toContain("UK Wah 846");
    });

    // COMBO-03-3: After truncation, remaining effects are in SLOT_ORDER
    it("after priority truncation, remaining effects are in correct SLOT_ORDER", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      // Pod Go is single-DSP, all on dsp0 — filter out amp and cab
      const effectNames = chain
        .filter((b) => b.type !== "amp" && b.type !== "cab")
        .map((b) => b.modelName);

      // Wah (0) < Compressor (1) < Delay (9) < Reverb (10)
      const wahIdx = effectNames.indexOf("UK Wah 846");
      const compIdx = effectNames.indexOf("Deluxe Comp");
      const delayIdx = effectNames.indexOf("Simple Delay");
      const reverbIdx = effectNames.indexOf("Hall");

      if (wahIdx >= 0 && compIdx >= 0) expect(wahIdx).toBeLessThan(compIdx);
      if (compIdx >= 0 && delayIdx >= 0) expect(compIdx).toBeLessThan(delayIdx);
      if (delayIdx >= 0 && reverbIdx >= 0) expect(delayIdx).toBeLessThan(reverbIdx);
    });

    // COMBO-03-4: Helix with same 5 effects does NOT truncate
    it("Helix (maxEffectsPerDsp=Infinity) with 5 effects does NOT truncate", () => {
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const names = chain.map((b) => b.modelName);
      // All 5 should be present — no truncation for Helix
      expect(names).toContain("UK Wah 846");
      expect(names).toContain("Deluxe Comp");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("Hall");
      expect(names).toContain("70s Chorus");
    });

    // COMBO-03-5: console.warn is logged with dropped effect names
    it("logs console.warn with dropped effect names when truncation occurs", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const comboWarn = warnSpy.mock.calls.find(
        (call) => typeof call[0] === "string" && call[0].includes("COMBO-03")
      );
      expect(comboWarn).toBeDefined();
      // Should mention the dropped effect name
      expect(comboWarn![0]).toContain("70s Chorus");
    });
  });

  // --- Zod schema max effects tests ---

  describe("Zod schema max effects", () => {
    it("schema accepts 8 effects without error", () => {
      const schema = getToneIntentSchema("helix");
      const valid = {
        ampName: "US Deluxe Nrm",
        cabName: "1x12 US Deluxe",
        guitarType: "single_coil",
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
          { modelName: "70s Chorus", role: "toggleable" },
          { modelName: "Teemah!", role: "toggleable" },
          { modelName: "Deluxe Comp", role: "toggleable" },
          { modelName: "Stupor OD", role: "toggleable" },
          { modelName: "Heir Apparent", role: "toggleable" },
          { modelName: "Vermin Dist", role: "toggleable" },
        ],
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Rhythm", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
        ],
      };
      expect(() => schema.parse(valid)).not.toThrow();
    });

    it("schema rejects 11 effects", () => {
      const schema = getToneIntentSchema("helix");
      const tooMany = {
        ampName: "US Deluxe Nrm",
        cabName: "1x12 US Deluxe",
        guitarType: "single_coil",
        effects: [
          { modelName: "Simple Delay", role: "toggleable" },
          { modelName: "Hall", role: "toggleable" },
          { modelName: "70s Chorus", role: "toggleable" },
          { modelName: "Teemah!", role: "toggleable" },
          { modelName: "Deluxe Comp", role: "toggleable" },
          { modelName: "Stupor OD", role: "toggleable" },
          { modelName: "Heir Apparent", role: "toggleable" },
          { modelName: "Vermin Dist", role: "toggleable" },
          { modelName: "Deranged Master", role: "toggleable" },
          { modelName: "Arbitrator Fuzz", role: "toggleable" },
          { modelName: "UK Wah 846", role: "toggleable" },
        ],
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Rhythm", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
        ],
      };
      expect(() => schema.parse(tooMany)).toThrow();
    });
  });

  // --- CRAFT-04: genre-aware priority truncation ---

  describe("CRAFT-04: genre-aware priority truncation", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // CRAFT-04-1: Pod Go ambient with 6 effects keeps reverb + delay + mod, drops drive + compressor
    it("Pod Go ambient keeps reverb + delay + mod, drops drive + compressor", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "ambient",
          effects: [
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Adriatic Delay", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Ambient priorities: reverb(20) > delay(18) > modulation(15) > compressor(8) > drive(5)
      // Survivors (top 4): Hall(reverb), Simple Delay(delay), Adriatic Delay(delay), 70s Chorus(mod)
      expect(names).toContain("Hall");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("70s Chorus");
      expect(names).toContain("Adriatic Delay");
      // Dropped: Teemah! (drive=5) and Deluxe Comp (compressor=8)
      expect(names).not.toContain("Teemah!");
      expect(names).not.toContain("Deluxe Comp");
    });

    // CRAFT-04-2: Pod Go metal with 5 effects keeps drive + delay, drops reverb + modulation
    it("Pod Go metal keeps drive + delay, drops modulation", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        highGainIntent({
          genreHint: "metal",
          effects: [
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Stupor OD", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Metal priorities: extra_drive(20) > delay(12) > wah(10) > compressor(5) > reverb(3) > modulation(2)
      // COMBO-02 doesn't apply here (no compressor)
      // 5 effects, budget=4 => drop 1
      // Scores: Teemah!(50+20=70), Stupor OD(50+20=70), Simple Delay(50+12=62), Hall(50+3=53), 70s Chorus(50+2=52)
      // Drop 70s Chorus (lowest)
      expect(names).toContain("Teemah!");
      expect(names).toContain("Stupor OD");
      expect(names).toContain("Simple Delay");
      expect(names).not.toContain("70s Chorus");
    });

    // CRAFT-04-3: Pod Go blues with 5 effects keeps delay + reverb + drive, drops modulation
    it("Pod Go blues keeps delay + reverb + drive, drops modulation", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "blues",
          effects: [
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Blues priorities: delay(18) > reverb(15) > extra_drive(12) > compressor(10) > modulation(5)
      // Scores: Simple Delay(50+18=68), Hall(50+15=65), Teemah!(50+12=62), Deluxe Comp(50+10=60), 70s Chorus(50+5=55)
      // Drop 70s Chorus (lowest)
      expect(names).toContain("Simple Delay");
      expect(names).toContain("Hall");
      expect(names).toContain("Teemah!");
      expect(names).toContain("Deluxe Comp");
      expect(names).not.toContain("70s Chorus");
    });

    // CRAFT-04-4: Pod Go jazz with 5 effects keeps reverb + compressor, drops drive
    it("Pod Go jazz keeps reverb + compressor + modulation, drops drive", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "jazz",
          effects: [
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Jazz priorities: reverb(18) > compressor(15) > modulation(10) > delay(5) > extra_drive(3)
      // Scores: Hall(50+18=68), Deluxe Comp(50+15=65), 70s Chorus(50+10=60), Simple Delay(50+5=55), Teemah!(50+3=53)
      // Drop Teemah! (lowest)
      expect(names).toContain("Hall");
      expect(names).toContain("Deluxe Comp");
      expect(names).toContain("70s Chorus");
      expect(names).toContain("Simple Delay");
      expect(names).not.toContain("Teemah!");
    });

    // CRAFT-04-5: No genreHint falls back to generic scoring (backward compat)
    it("no genreHint falls back to generic scoring (70s Chorus dropped)", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "UK Wah 846", role: "always_on" },
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Generic priorities: wah(18) > compressor(15) > delay(10) > reverb(8) > modulation(5)
      // UK Wah 846 is always_on (100+18=118), others toggleable (50+slot)
      // 70s Chorus (50+5=55) is lowest — same as COMBO-03-1
      expect(names).not.toContain("70s Chorus");
      expect(names).toContain("UK Wah 846");
      expect(names).toContain("Deluxe Comp");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("Hall");
    });

    // CRAFT-04-6: Stomp with genreHint "worship" keeps reverb + delay + mod
    it("Stomp worship keeps reverb + delay + mod, drops drive", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const stompCaps = getCapabilities("helix_stomp");

      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "worship",
          effects: [
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
          ],
        }),
        stompCaps
      );

      const names = chain.map((b) => b.modelName);
      // Worship = same as ambient: reverb(20) > delay(18) > modulation(15) > compressor(8) > drive(5)
      // Scores: Hall(50+20=70), Simple Delay(50+18=68), 70s Chorus(50+15=65), Deluxe Comp(50+8=58), Teemah!(50+5=55)
      // Drop Teemah! (lowest)
      expect(names).toContain("Hall");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("70s Chorus");
      expect(names).toContain("Deluxe Comp");
      expect(names).not.toContain("Teemah!");
    });

    // CRAFT-04-7: Helix with genreHint does NOT truncate (Infinity cap)
    it("Helix with genreHint ambient does NOT truncate (all 6 survive)", () => {
      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "ambient",
          effects: [
            { modelName: "Deluxe Comp", role: "toggleable" },
            { modelName: "Teemah!", role: "toggleable" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Adriatic Delay", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const names = chain.map((b) => b.modelName);
      // Helix maxEffectsPerDsp = Infinity — no truncation
      expect(names).toContain("Deluxe Comp");
      expect(names).toContain("Teemah!");
      expect(names).toContain("Simple Delay");
      expect(names).toContain("Hall");
      expect(names).toContain("70s Chorus");
      expect(names).toContain("Adriatic Delay");
    });

    // CRAFT-04-8: always_on intentRole overrides genre priority
    it("always_on drive survives ambient truncation despite lowest genre priority", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const podGoCaps = getCapabilities("pod_go");

      const chain = assembleSignalChain(
        cleanIntent({
          genreHint: "ambient",
          effects: [
            { modelName: "Teemah!", role: "always_on" },
            { modelName: "Simple Delay", role: "toggleable" },
            { modelName: "Hall", role: "toggleable" },
            { modelName: "70s Chorus", role: "toggleable" },
            { modelName: "Adriatic Delay", role: "toggleable" },
          ],
        }),
        podGoCaps
      );

      const names = chain.map((b) => b.modelName);
      // Teemah! always_on (100+5=105) survives despite drive=5 for ambient
      // Toggleable scores: Hall(50+20=70), Simple Delay(50+18=68), Adriatic Delay(50+18=68), 70s Chorus(50+15=65)
      // Drop 1: 70s Chorus (65) is lowest among toggleable
      expect(names).toContain("Teemah!");
      // 4 total survive: Teemah! + 3 of the time-based effects
    });
  });

  // --- COHERE-01: effect palette balance (max 2 user drives) ---

  describe("COHERE-01: effect palette balance", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // COHERE-01-1: Intent with 3 user drives drops lowest-priority drive
    it("intent with 3 user drives produces chain with max 2 drives (lowest-priority dropped)", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "Compulsive Drive", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Stupor OD", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      // Count user drives (slot === "extra_drive") — exclude mandatory Minotaur (slot === "boost")
      const userDrives = chain.filter(
        (b) => b.type === "distortion" && b.modelName !== "Minotaur" && b.modelName !== "Scream 808"
      );
      expect(userDrives).toHaveLength(2);
    });

    // COHERE-01-2: Intent with 2 user drives keeps both
    it("intent with 2 user drives keeps both — no truncation", () => {
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "Compulsive Drive", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const userDrives = chain.filter(
        (b) => b.type === "distortion" && b.modelName !== "Minotaur" && b.modelName !== "Scream 808"
      );
      expect(userDrives).toHaveLength(2);
    });

    // COHERE-01-3: Mandatory Minotaur boost NOT counted toward 2-drive limit
    it("mandatory Minotaur boost is NOT counted toward the 2-drive limit", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "Compulsive Drive", role: "toggleable" },
            // Minotaur is auto-inserted as mandatory boost (slot=boost, not extra_drive)
          ],
        }),
        HELIX_CAPS
      );

      const names = chain.map((b) => b.modelName);
      // Both the user drive AND the mandatory Minotaur should be present
      expect(names).toContain("Compulsive Drive");
      expect(names).toContain("Minotaur");

      // Total distortion blocks = 2 (Minotaur boost + 1 user drive) — boost doesn't count
      const distortionBlocks = chain.filter((b) => b.type === "distortion");
      expect(distortionBlocks).toHaveLength(2);
    });

    // COHERE-01-4: 3 drives with metal genreHint keeps 2 highest-priority per genre scoring
    it("3 drives with metal genreHint keeps 2 highest-priority drives per genre scoring", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        highGainIntent({
          genreHint: "metal",
          effects: [
            { modelName: "Compulsive Drive", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Stupor OD", role: "ambient" },
          ],
        }),
        HELIX_CAPS
      );

      // The "ambient" role drive (Stupor OD, score=30+20=50) should be dropped
      // "toggleable" role drives (score=50+20=70) should survive
      const userDrives = chain.filter(
        (b) => b.type === "distortion" && b.modelName !== "Minotaur" && b.modelName !== "Scream 808"
      );
      expect(userDrives).toHaveLength(2);
      const driveNames = userDrives.map((b) => b.modelName);
      expect(driveNames).not.toContain("Stupor OD");
    });
  });

  // --- COHERE-02: reverb soft-mandatory insertion ---

  describe("COHERE-02: reverb soft-mandatory insertion", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    // COHERE-02-1: Clean amp intent with no reverb auto-inserts Plate reverb
    it("clean amp intent with no reverb in effects auto-inserts Plate reverb", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "Simple Delay", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const reverbBlocks = chain.filter((b) => b.type === "reverb");
      expect(reverbBlocks).toHaveLength(1);
      expect(reverbBlocks[0].modelName).toBe("Plate");
    });

    // COHERE-02-2: Clean amp intent WITH user-specified reverb does NOT insert a second reverb
    it("clean amp intent with user-specified reverb does NOT insert Plate", () => {
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [
            { modelName: "Ganymede", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const reverbBlocks = chain.filter((b) => b.type === "reverb");
      expect(reverbBlocks).toHaveLength(1);
      expect(reverbBlocks[0].modelName).toBe("Ganymede");
    });

    // COHERE-02-3: High-gain-only intent (no clean/ambient snapshots) does NOT auto-insert reverb
    it("high-gain-only intent with no clean/ambient snapshots does NOT auto-insert reverb", () => {
      const chain = assembleSignalChain(
        highGainIntent({
          snapshots: [
            { name: "Rhythm", toneRole: "crunch" },
            { name: "Crunch 2", toneRole: "crunch" },
            { name: "Lead", toneRole: "lead" },
            { name: "Lead 2", toneRole: "lead" },
          ],
          effects: [
            { modelName: "Simple Delay", role: "toggleable" },
          ],
        }),
        HELIX_CAPS
      );

      const reverbBlocks = chain.filter((b) => b.type === "reverb");
      expect(reverbBlocks).toHaveLength(0);
    });

    // COHERE-02-4: Intent with ambient snapshot role and no reverb auto-inserts Plate
    it("intent with ambient snapshot and no reverb auto-inserts Plate", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        cleanIntent({
          snapshots: [
            { name: "Rhythm", toneRole: "crunch" },
            { name: "Lead", toneRole: "lead" },
            { name: "Ambient", toneRole: "ambient" },
            { name: "Lead 2", toneRole: "lead" },
          ],
          effects: [],
        }),
        HELIX_CAPS
      );

      const reverbBlocks = chain.filter((b) => b.type === "reverb");
      expect(reverbBlocks).toHaveLength(1);
      expect(reverbBlocks[0].modelName).toBe("Plate");
    });

    // COHERE-02-5: Auto-inserted Plate reverb has intentRole "toggleable" and correct slot
    it("auto-inserted Plate has intentRole 'toggleable' and trails: true", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const chain = assembleSignalChain(
        cleanIntent({
          effects: [],
        }),
        HELIX_CAPS
      );

      const plateBlock = chain.find((b) => b.modelName === "Plate");
      expect(plateBlock).toBeDefined();
      expect(plateBlock!.intentRole).toBe("toggleable");
      expect(plateBlock!.trails).toBe(true);
    });
  });
});
