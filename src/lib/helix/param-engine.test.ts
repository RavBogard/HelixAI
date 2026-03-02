// src/lib/helix/param-engine.test.ts
// TDD RED: Failing tests for param-engine.ts resolveParameters()

import { describe, it, expect } from "vitest";
import { resolveParameters } from "./param-engine";
import type { BlockSpec } from "./types";
import type { ToneIntent } from "./tone-intent";

// Helper: create a minimal ToneIntent
function makeIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
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

// Helper: create a minimal BlockSpec
function makeBlock(overrides: Partial<BlockSpec>): BlockSpec {
  return {
    type: "amp",
    modelId: "HD2_AmpUSDeluxeNrm",
    modelName: "US Deluxe Nrm",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

describe("resolveParameters", () => {
  // Test 1: Clean amp parameters
  it("sets clean amp Drive 0.20-0.30, Master 0.90-1.00, SAG 0.50-0.70, ChVol 0.70", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent);
    const amp = result[0];

    expect(amp.parameters.Drive).toBeGreaterThanOrEqual(0.20);
    expect(amp.parameters.Drive).toBeLessThanOrEqual(0.30);
    expect(amp.parameters.Master).toBeGreaterThanOrEqual(0.90);
    expect(amp.parameters.Master).toBeLessThanOrEqual(1.00);
    expect(amp.parameters.Sag).toBeGreaterThanOrEqual(0.50);
    expect(amp.parameters.Sag).toBeLessThanOrEqual(0.70);
    expect(amp.parameters.ChVol).toBe(0.70);
  });

  // Test 2: Crunch amp parameters
  it("sets crunch amp Drive 0.40-0.60, Master 0.50-0.70, SAG 0.40-0.50", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpGrammaticoNrm", modelName: "Grammatico Nrm" }),
    ];
    const intent = makeIntent({ ampName: "Grammatico Nrm" });
    const result = resolveParameters(chain, intent);
    const amp = result[0];

    expect(amp.parameters.Drive).toBeGreaterThanOrEqual(0.40);
    expect(amp.parameters.Drive).toBeLessThanOrEqual(0.60);
    expect(amp.parameters.Master).toBeGreaterThanOrEqual(0.50);
    expect(amp.parameters.Master).toBeLessThanOrEqual(0.70);
    expect(amp.parameters.Sag).toBeGreaterThanOrEqual(0.40);
    expect(amp.parameters.Sag).toBeLessThanOrEqual(0.50);
  });

  // Test 3: High-gain amp parameters
  it("sets high-gain amp Drive 0.30-0.50, Master 0.30-0.60, SAG 0.20-0.30", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpCaliRectifire", modelName: "Cali Rectifire" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" });
    const result = resolveParameters(chain, intent);
    const amp = result[0];

    expect(amp.parameters.Drive).toBeGreaterThanOrEqual(0.30);
    expect(amp.parameters.Drive).toBeLessThanOrEqual(0.50);
    expect(amp.parameters.Master).toBeGreaterThanOrEqual(0.30);
    expect(amp.parameters.Master).toBeLessThanOrEqual(0.60);
    expect(amp.parameters.Sag).toBeGreaterThanOrEqual(0.20);
    expect(amp.parameters.Sag).toBeLessThanOrEqual(0.30);
  });

  // Test 4: Topology-aware mid adjustment for high-gain
  it("sets plate_fed high-gain Mid 0.55-0.65 (topology override)", () => {
    // Cali Rectifire is high_gain + plate_fed
    const pfChain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpCaliRectifire", modelName: "Cali Rectifire" }),
    ];
    const pfIntent = makeIntent({ ampName: "Cali Rectifire" });
    const pfResult = resolveParameters(pfChain, pfIntent);
    expect(pfResult[0].parameters.Mid).toBeGreaterThanOrEqual(0.55);
    expect(pfResult[0].parameters.Mid).toBeLessThanOrEqual(0.65);

    // PV Panama is also high_gain + plate_fed -- verify consistency
    const pvChain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpPVPanama", modelName: "PV Panama" }),
    ];
    const pvIntent = makeIntent({ ampName: "PV Panama" });
    const pvResult = resolveParameters(pvChain, pvIntent);
    expect(pvResult[0].parameters.Mid).toBeGreaterThanOrEqual(0.55);
    expect(pvResult[0].parameters.Mid).toBeLessThanOrEqual(0.65);
  });

  // Test 4b: Clean cathode_follower amps do NOT get topology mid override (only high-gain does)
  it("does not apply topology mid override for clean cathode_follower amps", () => {
    // Essex A30 is clean + cathode_follower
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpEssexA30", modelName: "Essex A30" }),
    ];
    const intent = makeIntent({ ampName: "Essex A30" });
    const result = resolveParameters(chain, intent);
    // Clean amp Mid should be ~0.50 (from clean category defaults), NOT 0.40-0.50 cathode_follower override
    expect(result[0].parameters.Mid).toBe(0.50);
  });

  // Test 5: Cab block gets Hz-encoded LowCut/HighCut and integer Mic index
  it("sets cab LowCut in Hz (80-100), HighCut in Hz (5000-8000), Mic as integer", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent);
    const cab = result[0];

    expect(cab.parameters.LowCut).toBeGreaterThanOrEqual(80);
    expect(cab.parameters.LowCut).toBeLessThanOrEqual(100);
    expect(cab.parameters.HighCut).toBeGreaterThanOrEqual(5000);
    expect(cab.parameters.HighCut).toBeLessThanOrEqual(8000);
    expect(Number.isInteger(cab.parameters.Mic)).toBe(true);
  });

  // Test 6: Clean cab gets Mic index 6 (121 Ribbon); high-gain cab gets Mic index 0 (57 Dynamic)
  it("selects Mic 6 for clean cab and Mic 0 for high-gain cab", () => {
    const cleanChain: BlockSpec[] = [
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe" }),
    ];
    const cleanIntent = makeIntent({ ampName: "US Deluxe Nrm" });
    const cleanResult = resolveParameters(cleanChain, cleanIntent);
    expect(cleanResult[0].parameters.Mic).toBe(6);

    const hgChain: BlockSpec[] = [
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_4x12CaliV30", modelName: "4x12 Cali V30" }),
    ];
    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters(hgChain, hgIntent);
    expect(hgResult[0].parameters.Mic).toBe(0);
  });

  // Test 7: Parametric EQ block gets LowGain < 0.50 and HighGain > 0.50
  // For crunch/high-gain, LowGain < 0.50 = cut (anti-mud). Clean = 0.50 (unity, no cut needed).
  it("sets Parametric EQ with LowGain <= 0.50 (cut or unity) and HighGain > 0.50 (boost)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "eq", modelId: "HD2_EQParametric", modelName: "Parametric EQ" }),
    ];

    // Clean: LowGain at unity (0.50), HighGain boost > 0.50
    const cleanIntent = makeIntent({ ampName: "US Deluxe Nrm" });
    const cleanResult = resolveParameters(chain, cleanIntent);
    expect(cleanResult[0].parameters.LowGain).toBeLessThanOrEqual(0.50);
    expect(cleanResult[0].parameters.HighGain).toBeGreaterThan(0.50);

    // Crunch: LowGain < 0.50 (actual mud cut), HighGain boost > 0.50
    const crunchIntent = makeIntent({ ampName: "Grammatico Nrm" });
    const crunchResult = resolveParameters(chain, crunchIntent);
    expect(crunchResult[0].parameters.LowGain).toBeLessThan(0.50);
    expect(crunchResult[0].parameters.HighGain).toBeGreaterThan(0.50);

    // High-gain: LowGain < 0.50 (aggressive mud cut), HighGain boost > 0.50
    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters(chain, hgIntent);
    expect(hgResult[0].parameters.LowGain).toBeLessThan(0.50);
    expect(hgResult[0].parameters.HighGain).toBeGreaterThan(0.50);
  });

  // Test 8: Minotaur uses Gain/Treble/Output parameter names, NOT Drive/Tone/Output
  it("uses Gain/Treble/Output param names for Minotaur (not Drive/Tone)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent);
    const boost = result[0];

    expect(boost.parameters).toHaveProperty("Gain");
    expect(boost.parameters).toHaveProperty("Treble");
    expect(boost.parameters).toHaveProperty("Output");
    expect(boost.parameters).not.toHaveProperty("Drive");
    expect(boost.parameters).not.toHaveProperty("Tone");
  });

  // Test 9: Clean Minotaur gets Gain 0.00; crunch Minotaur gets Gain 0.20-0.30
  it("sets Minotaur Gain=0.00 for clean and 0.20-0.30 for crunch", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur" }),
    ];

    const cleanIntent = makeIntent({ ampName: "US Deluxe Nrm" }); // clean amp
    const cleanResult = resolveParameters(chain, cleanIntent);
    expect(cleanResult[0].parameters.Gain).toBe(0.00);

    const crunchIntent = makeIntent({ ampName: "Grammatico Nrm" }); // crunch amp
    const crunchResult = resolveParameters(chain, crunchIntent);
    expect(crunchResult[0].parameters.Gain).toBeGreaterThanOrEqual(0.20);
    expect(crunchResult[0].parameters.Gain).toBeLessThanOrEqual(0.30);
  });

  // Test 10: Scream 808 boost parameters
  it("sets Scream 808 with Drive 0.10-0.20, Tone 0.50, Level 0.50-0.70", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "distortion", modelId: "HD2_DistScream808", modelName: "Scream 808" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" }); // high-gain
    const result = resolveParameters(chain, intent);
    const boost = result[0];

    expect(boost.parameters.Drive).toBeGreaterThanOrEqual(0.10);
    expect(boost.parameters.Drive).toBeLessThanOrEqual(0.20);
    expect(boost.parameters.Tone).toBe(0.50);
    expect(boost.parameters.Level).toBeGreaterThanOrEqual(0.50);
    expect(boost.parameters.Level).toBeLessThanOrEqual(0.70);
  });

  // Test 11: Horizon Gate parameters
  it("sets Horizon Gate Threshold 0.50 and Decay 0.40", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "dynamics", modelId: "HD2_GateHorizonGate", modelName: "Horizon Gate" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" });
    const result = resolveParameters(chain, intent);
    const gate = result[0];

    expect(gate.parameters.Threshold).toBe(0.50);
    expect(gate.parameters.Decay).toBe(0.40);
  });

  // Test 12: Gain Block gets Gain 0.0 dB (NOT normalized)
  it("sets Gain Block Gain to 0.0 dB", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "volume", modelId: "HD2_VolPanGain", modelName: "Gain Block" }),
    ];
    const intent = makeIntent();
    const result = resolveParameters(chain, intent);
    const vol = result[0];

    expect(vol.parameters.Gain).toBe(0.0);
  });

  // Test 13: AI-added effects get their model's defaultParams from the database
  it("uses model defaultParams for delay, reverb, and modulation effects", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelay", modelName: "Simple Delay" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate" }),
      makeBlock({ type: "modulation", modelId: "HD2_Chorus70sChorus", modelName: "70s Chorus" }),
    ];
    const intent = makeIntent();
    const result = resolveParameters(chain, intent);

    // Simple Delay should have its defaults
    expect(result[0].parameters.Time).toBe(0.375);
    expect(result[0].parameters.Feedback).toBe(0.35);
    expect(result[0].parameters.Mix).toBe(0.3);

    // Plate reverb should have its defaults
    expect(result[1].parameters.DecayTime).toBe(0.5);
    expect(result[1].parameters.Mix).toBe(0.25);

    // 70s Chorus should have its defaults
    expect(result[2].parameters.Speed).toBe(0.4);
    expect(result[2].parameters.Depth).toBe(0.5);
  });

  // Test 14: Input chain does not mutate
  it("returns a new BlockSpec array without mutating the input", () => {
    const original: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
    ];
    const originalParams = { ...original[0].parameters };
    const intent = makeIntent();
    const result = resolveParameters(original, intent);

    // Result should be a different array
    expect(result).not.toBe(original);
    // Original block parameters should not be mutated
    expect(original[0].parameters).toEqual(originalParams);
    // Result block should be a different object
    expect(result[0]).not.toBe(original[0]);
  });

  // Test 15: High-gain EQ gets more aggressive mud cut than clean EQ
  it("applies more aggressive LowGain cut for high-gain EQ than clean EQ", () => {
    const eqBlock = makeBlock({ type: "eq", modelId: "HD2_EQParametric", modelName: "Parametric EQ" });

    const cleanIntent = makeIntent({ ampName: "US Deluxe Nrm" });
    const cleanResult = resolveParameters([{ ...eqBlock, parameters: {} }], cleanIntent);

    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters([{ ...eqBlock, parameters: {} }], hgIntent);

    // High-gain should have lower LowGain (more cut) than clean
    expect(hgResult[0].parameters.LowGain).toBeLessThan(cleanResult[0].parameters.LowGain);
  });
});
