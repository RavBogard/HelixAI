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
  it("returns blocks in order: boost (Minotaur) > amp > cab > EQ > gain block for clean amp with no effects", () => {
    const chain = assembleSignalChain(cleanIntent(), HELIX_CAPS);

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
  // COMBO-02: Horizon Gate now placed before amp (pre-amp position) for high-gain
  it("returns blocks: Horizon Gate > Scream 808 > amp > cab > EQ > gain block for high-gain amp", () => {
    const chain = assembleSignalChain(highGainIntent(), HELIX_CAPS);

    const names = chain.map((b) => b.modelName);
    expect(names).toEqual([
      "Horizon Gate",
      "Scream 808",
      "Placater Dirty",
      "4x12 Cali V30",
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
        }),
        HELIX_CAPS
      )
    ).toThrow(/DSP0 block limit exceeded.*non-cab blocks.*max 8/);
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

      // 10 effects exceeds Stadium maxEffectsPerDsp (should be 8)
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
            { modelName: "Stupor OD", role: "toggleable" },
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Vermin Dist", role: "toggleable" },
            { modelName: "Deranged Master", role: "toggleable" },
            { modelName: "Arbitrator Fuzz", role: "toggleable" },
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

    it("Stadium with 8 user effects produces all 8 in output", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const stadiumCaps = getCapabilities("helix_stadium");

      // COMBO-02: Use UK Wah 846 instead of Deluxe Comp — toggleable compressors
      // are omitted from high-gain chains (Agoura German Xtra Red is high_gain)
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
            { modelName: "Heir Apparent", role: "toggleable" },
            { modelName: "Vermin Dist", role: "toggleable" },
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
});
