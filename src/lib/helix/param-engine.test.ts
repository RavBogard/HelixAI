// src/lib/helix/param-engine.test.ts
// TDD RED: Failing tests for param-engine.ts resolveParameters()

import { describe, it, expect } from "vitest";
import { resolveParameters } from "./param-engine";
import { assembleSignalChain } from "./chain-rules";
import { getCapabilities } from "./device-family";
import type { BlockSpec } from "./types";
import type { ToneIntent } from "./tone-intent";

const defaultCaps = getCapabilities("helix_floor");

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
  // Test 1: Clean amp parameters (Solo Lead Clean — Soldano SLO-100 clean; no paramOverrides planned)
  it("sets clean amp Drive 0.20-0.30, Master 0.90-1.00, SAG 0.50-0.70, ChVol 0.70", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpSoloLeadClean", modelName: "Solo Lead Clean" }),
    ];
    const intent = makeIntent({ ampName: "Solo Lead Clean" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const amp = result[0];

    expect(amp.parameters.Drive).toBeGreaterThanOrEqual(0.20);
    expect(amp.parameters.Drive).toBeLessThanOrEqual(0.30);
    expect(amp.parameters.Master).toBeGreaterThanOrEqual(0.90);
    expect(amp.parameters.Master).toBeLessThanOrEqual(1.00);
    expect(amp.parameters.Sag).toBeGreaterThanOrEqual(0.50);
    expect(amp.parameters.Sag).toBeLessThanOrEqual(0.70);
    expect(amp.parameters.ChVol).toBe(0.70);
  });

  // Test 2: Crunch amp parameters — Grammatico Nrm has paramOverrides (Drive:0.40, Master:0.90)
  it("sets crunch amp with paramOverrides to expert-tuned values", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpGrammaticoNrm", modelName: "Grammatico Nrm" }),
    ];
    const intent = makeIntent({ ampName: "Grammatico Nrm" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const amp = result[0];

    expect(amp.parameters.Drive).toBe(0.40);    // Layer 4 override from paramOverrides
    expect(amp.parameters.Master).toBe(0.90);   // Layer 4 override — LaGrange MV dimed for power-section compression
    expect(amp.parameters.Sag).toBeGreaterThanOrEqual(0.40);
    expect(amp.parameters.Sag).toBeLessThanOrEqual(0.50);
  });

  // Test 3: High-gain amp parameters
  it("sets high-gain amp Drive 0.30-0.50, Master 0.30-0.60, SAG 0.20-0.30", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpCaliRectifire", modelName: "Cali Rectifire" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" });
    const result = resolveParameters(chain, intent, defaultCaps);
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
    const pfResult = resolveParameters(pfChain, pfIntent, defaultCaps);
    expect(pfResult[0].parameters.Mid).toBeGreaterThanOrEqual(0.55);
    expect(pfResult[0].parameters.Mid).toBeLessThanOrEqual(0.65);

    // PV Panama is also high_gain + plate_fed -- verify consistency
    const pvChain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpPVPanama", modelName: "PV Panama" }),
    ];
    const pvIntent = makeIntent({ ampName: "PV Panama" });
    const pvResult = resolveParameters(pvChain, pvIntent, defaultCaps);
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
    const result = resolveParameters(chain, intent, defaultCaps);
    // Clean amp Mid should be ~0.50 (from clean category defaults), NOT 0.40-0.50 cathode_follower override
    expect(result[0].parameters.Mid).toBe(0.50);
  });

  // Test 5: Cab block gets Hz-encoded LowCut/HighCut and integer Mic index
  it("sets cab LowCut in Hz (80-100), HighCut in Hz (5000-8000), Mic as integer", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent, defaultCaps);
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
    const cleanResult = resolveParameters(cleanChain, cleanIntent, defaultCaps);
    expect(cleanResult[0].parameters.Mic).toBe(6);

    const hgChain: BlockSpec[] = [
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_4x12CaliV30", modelName: "4x12 Cali V30" }),
    ];
    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters(hgChain, hgIntent, defaultCaps);
    expect(hgResult[0].parameters.Mic).toBe(0);
  });

  // Test 7: Parametric EQ block gets appropriate LowGain (cut or unity) and HighGain > 0.50.
  // Tests use baseline category EQ without guitarType to isolate amp-category behavior.
  // For crunch/high-gain, LowGain < 0.50 = cut (anti-mud). Clean baseline = 0.50 (unity).
  it("sets Parametric EQ with LowGain <= 0.50 (cut or unity) and HighGain > 0.50 (boost)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "eq", modelId: "HD2_EQParametric", modelName: "Parametric EQ" }),
    ];

    // Use intents without guitarType to test pure AmpCategory baseline EQ
    // (guitarType adjustments are covered by FX-01 tests)
    const baseCleanIntent = {
      ampName: "US Deluxe Nrm",
      cabName: "1x12 US Deluxe",
      effects: [],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Rhythm", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
        { name: "Ambient", toneRole: "ambient" },
      ],
    } as unknown as ToneIntent;

    // Clean baseline: LowGain at unity (0.50), HighGain boost > 0.50
    const cleanResult = resolveParameters(chain, baseCleanIntent, defaultCaps);
    expect(cleanResult[0].parameters.LowGain).toBeLessThanOrEqual(0.50);
    expect(cleanResult[0].parameters.HighGain).toBeGreaterThan(0.50);

    // Crunch: LowGain < 0.50 (actual mud cut), HighGain boost > 0.50
    const crunchIntent = makeIntent({ ampName: "Grammatico Nrm" });
    const crunchResult = resolveParameters(chain, crunchIntent, defaultCaps);
    // crunch single_coil: LowGain = 0.45 + 0.03 = 0.48 — still < 0.50
    expect(crunchResult[0].parameters.LowGain).toBeLessThan(0.50);
    expect(crunchResult[0].parameters.HighGain).toBeGreaterThan(0.50);

    // High-gain: LowGain < 0.50 (aggressive mud cut), HighGain boost > 0.50
    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters(chain, hgIntent, defaultCaps);
    // high_gain single_coil: LowGain = 0.42 + 0.03 = 0.45 — still < 0.50
    expect(hgResult[0].parameters.LowGain).toBeLessThan(0.50);
    expect(hgResult[0].parameters.HighGain).toBeGreaterThan(0.50);
  });

  // Test 8: Minotaur uses Gain/Treble/Output parameter names, NOT Drive/Tone/Output
  it("uses Gain/Treble/Output param names for Minotaur (not Drive/Tone)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent, defaultCaps);
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
    const cleanResult = resolveParameters(chain, cleanIntent, defaultCaps);
    expect(cleanResult[0].parameters.Gain).toBe(0.00);

    const crunchIntent = makeIntent({ ampName: "Grammatico Nrm" }); // crunch amp
    const crunchResult = resolveParameters(chain, crunchIntent, defaultCaps);
    expect(crunchResult[0].parameters.Gain).toBeGreaterThanOrEqual(0.20);
    expect(crunchResult[0].parameters.Gain).toBeLessThanOrEqual(0.30);
  });

  // Test 10: Scream 808 boost parameters (firmware uses Gain, not Drive)
  it("sets Scream 808 with Gain 0.10-0.20, Tone 0.50, Level 0.50-0.70", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "distortion", modelId: "HD2_DistScream808", modelName: "Scream 808" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" }); // high-gain
    const result = resolveParameters(chain, intent, defaultCaps);
    const boost = result[0];

    expect(boost.parameters.Gain).toBeGreaterThanOrEqual(0.10);
    expect(boost.parameters.Gain).toBeLessThanOrEqual(0.20);
    expect(boost.parameters.Tone).toBe(0.50);
    expect(boost.parameters.Level).toBeGreaterThanOrEqual(0.50);
    expect(boost.parameters.Level).toBeLessThanOrEqual(0.70);
  });

  // Test 11: Horizon Gate parameters (firmware uses Gate Range/Level/Mode/Sensitivity)
  it("sets Horizon Gate with correct firmware params", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "dynamics", modelId: "HD2_GateHorizonGate", modelName: "Horizon Gate" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const gate = result[0];

    expect(gate.parameters["Gate Range"]).toBe(false);
    expect(gate.parameters.Level).toBe(0.0);
    expect(gate.parameters.Mode).toBe(1);
    expect(gate.parameters.Sensitivity).toBe(0.1);
  });

  // Test 12: Gain Block gets Gain 0.0 dB (NOT normalized)
  it("sets Gain Block Gain to 0.0 dB", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "volume", modelId: "HD2_VolPanGain", modelName: "Gain Block" }),
    ];
    const intent = makeIntent();
    const result = resolveParameters(chain, intent, defaultCaps);
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
    const result = resolveParameters(chain, intent, defaultCaps);

    // Simple Delay should have its defaults
    expect(result[0].parameters.Time).toBe(0.375);
    expect(result[0].parameters.Feedback).toBe(0.35);
    expect(result[0].parameters.Mix).toBe(0.3);

    // Plate reverb: defaultParams Mix=0.25, reduced to 0.20 by COMBO-04 (delay present in chain)
    expect(result[1].parameters.DecayTime).toBe(0.5);
    expect(result[1].parameters.Mix).toBe(0.20);

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
    const result = resolveParameters(original, intent, defaultCaps);

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
    const cleanResult = resolveParameters([{ ...eqBlock, parameters: {} }], cleanIntent, defaultCaps);

    const hgIntent = makeIntent({ ampName: "Cali Rectifire" });
    const hgResult = resolveParameters([{ ...eqBlock, parameters: {} }], hgIntent, defaultCaps);

    // High-gain should have lower LowGain (more cut) than clean
    expect(hgResult[0].parameters.LowGain).toBeLessThan(cleanResult[0].parameters.LowGain as number);
  });

  // Test: Layer 4 paramOverrides mechanism (AMP-02)
  it("paramOverrides survive category defaults (Layer 4 wins over Layer 2)", () => {
    // US Deluxe Nrm has paramOverrides: { Drive: 0.60, Master: 1.0 }
    // AMP_DEFAULTS.clean.Drive = 0.25 — would win if there were no Layer 4
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent, defaultCaps);
    // Layer 4 override must win over AMP_DEFAULTS.clean.Drive (0.25)
    expect(result[0].parameters.Drive).toBe(0.60);
    // Layer 4: paramOverrides.Master = 1.0 wins over AMP_DEFAULTS.clean.Master (0.95)
    expect(result[0].parameters.Master).toBe(1.0);
  });

  // AMP-03: Per-model override verification (representative amps)
  it("US Deluxe Nrm paramOverrides: Drive 0.60, Master 1.0 (non-MV Fender)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
    ];
    const intent = makeIntent({ ampName: "US Deluxe Nrm" });
    const result = resolveParameters(chain, intent, defaultCaps);
    expect(result[0].parameters.Drive).toBe(0.60);
    expect(result[0].parameters.Master).toBe(1.0);
  });

  it("Essex A30 paramOverrides: Drive 0.60, Master 1.0 (non-MV Vox)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpEssexA30", modelName: "Essex A30" }),
    ];
    const intent = makeIntent({ ampName: "Essex A30" });
    const result = resolveParameters(chain, intent, defaultCaps);
    expect(result[0].parameters.Drive).toBe(0.60);
    expect(result[0].parameters.Master).toBe(1.0);
  });

  it("Cali Rectifire paramOverrides: Drive 0.40, Presence 0.30 (high-gain Mesa)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpCaliRectifire", modelName: "Cali Rectifire" }),
    ];
    const intent = makeIntent({ ampName: "Cali Rectifire" });
    const result = resolveParameters(chain, intent, defaultCaps);
    expect(result[0].parameters.Drive).toBe(0.40);
    expect(result[0].parameters.Presence).toBe(0.30);
  });

  it("amps without paramOverrides still use category defaults (no regression)", () => {
    // Line 6 2204 Mod is crunch, has no paramOverrides
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpLine62204Mod", modelName: "Line 6 2204 Mod" }),
    ];
    const intent = makeIntent({ ampName: "Line 6 2204 Mod" });
    const result = resolveParameters(chain, intent, defaultCaps);
    // AMP_DEFAULTS.crunch.Drive = 0.50 — no override, category default wins
    expect(result[0].parameters.Drive).toBe(0.50);
  });
});

// ============================================================
// FX-02: Reverb PreDelay by genre
// ============================================================
// These tests verify that GENRE_EFFECT_DEFAULTS reverb entries include PreDelay
// values appropriate to each genre's musical context.

describe("FX-02: reverb PreDelay by genre", () => {
  function makeReverbChain(): BlockSpec[] {
    return [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate" }),
    ];
  }

  it("FX-02-1: blues genre reverb block produces PreDelay ~0.025 (25ms)", () => {
    const chain = makeReverbChain();
    const intent = makeIntent({ genreHint: "blues" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.025, 3);
  });

  it("FX-02-2: ambient genre reverb block produces PreDelay ~0.045 (45ms)", () => {
    const chain = makeReverbChain();
    const intent = makeIntent({ genreHint: "ambient" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.045, 3);
  });

  it("FX-02-3: metal genre reverb block produces PreDelay ~0.010 (10ms)", () => {
    const chain = makeReverbChain();
    const intent = makeIntent({ ampName: "Cali Rectifire", genreHint: "metal" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.010, 3);
  });
});

// ============================================================
// INT-02: Spring reverb models receive genre PreDelay
// ============================================================
// Spring reverb models ('63 Spring, Double Tank, Spring) previously lacked
// a PreDelay key in defaultParams, so the `if (key in params)` guard in
// resolveDefaultParams() silently dropped genre-based PreDelay values.
// Fix: Add PreDelay: 0 to spring reverb defaultParams so genre overrides apply.

describe("INT-02: spring reverb models receive genre PreDelay", () => {
  it("INT-02-1: '63 Spring + blues genre produces PreDelay ~0.025 (25ms)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_Reverb63Spring", modelName: "'63 Spring" }),
    ];
    const intent = makeIntent({ genreHint: "blues" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.025, 3);
  });

  it("INT-02-2: Double Tank + rock genre produces PreDelay ~0.020 (20ms)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbDoubleTank", modelName: "Double Tank" }),
    ];
    const intent = makeIntent({ genreHint: "rock" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.020, 3);
  });

  it("INT-02-3: Spring + ambient genre produces PreDelay ~0.045 (45ms)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbSpring", modelName: "Spring" }),
    ];
    const intent = makeIntent({ genreHint: "ambient" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBeCloseTo(0.045, 3);
  });

  it("INT-02-4: '63 Spring without genre hint retains PreDelay: 0 (model default)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_Reverb63Spring", modelName: "'63 Spring" }),
    ];
    const intent = makeIntent({}); // no genreHint
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.PreDelay).toBe(0);
  });
});

// ============================================================
// FX-03: Tempo-synced delay Time
// ============================================================
// These tests verify that when tempoHint is present in ToneIntent, delay Time
// is calculated as 30/BPM (quarter note at Helix's 2000ms normalization).
// Formula: normalizedTime = 60000 / BPM / 2000 = 30 / BPM

describe("FX-03: tempo-synced delay Time", () => {
  function makeDelayChain(modelName = "Simple Delay", modelId = "HD2_DelaySimpleDelay"): BlockSpec[] {
    return [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "delay", modelId, modelName }),
    ];
  }

  it("FX-03-1: tempoHint=120 produces delay Time=0.25 (quarter note at 120 BPM)", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 120 });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // 30 / 120 = 0.25
    expect(delay.parameters.Time).toBeCloseTo(0.25, 3);
  });

  it("FX-03-2: tempoHint=80 produces delay Time=0.375 (quarter note at 80 BPM)", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 80 });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // 30 / 80 = 0.375
    expect(delay.parameters.Time).toBeCloseTo(0.375, 3);
  });

  it("FX-03-3: tempoHint=120 with Dual Delay produces Left Time=0.25, Right Time=0.1875", () => {
    const chain = makeDelayChain("Dual Delay", "HD2_DelayDualDelay");
    const intent = makeIntent({ tempoHint: 120 });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Left Time = 30/120 = 0.25
    // Right Time = 0.25 * 0.75 = 0.1875 (dotted-eighth offset)
    expect(delay.parameters["Left Time"]).toBeCloseTo(0.25, 3);
    expect(delay.parameters["Right Time"]).toBeCloseTo(0.1875, 3);
  });

  it("FX-03-4: no tempoHint leaves delay Time at genre default (unchanged)", () => {
    const chain = makeDelayChain();
    // blues genre default Time = 0.15
    const intent = makeIntent({ genreHint: "blues" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Without tempoHint, delay Time should be the blues genre default (0.15)
    expect(delay.parameters.Time).toBeCloseTo(0.15, 3);
  });

  it("FX-03-5: tempoHint does NOT affect reverb DecayTime (guard test)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelay", modelName: "Simple Delay" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate" }),
    ];
    // blues genre with tempo — delay should sync, reverb DecayTime should stay at genre default
    const intent = makeIntent({ genreHint: "blues", tempoHint: 120 });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    const reverb = result[2];
    // Delay Time must be tempo-synced to 0.25
    expect(delay.parameters.Time).toBeCloseTo(0.25, 3);
    // Reverb DecayTime must remain at blues genre default (0.4) — NOT affected by tempoHint
    expect(reverb.parameters.DecayTime).toBeCloseTo(0.4, 3);
  });

  it("FX-03-6: delaySubdivision=dotted_eighth at 120 BPM produces Time=0.1875", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 120, delaySubdivision: "dotted_eighth" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // quarter = 30/120 = 0.25, dotted eighth = 0.25 * 0.75 = 0.1875
    expect(delay.parameters.Time).toBeCloseTo(0.1875, 3);
  });

  it("FX-03-7: delaySubdivision=eighth at 120 BPM produces Time=0.125", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 120, delaySubdivision: "eighth" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // quarter = 30/120 = 0.25, eighth = 0.25 * 0.5 = 0.125
    expect(delay.parameters.Time).toBeCloseTo(0.125, 3);
  });

  it("FX-03-8: delaySubdivision=triplet at 120 BPM produces Time≈0.0833", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 120, delaySubdivision: "triplet" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // quarter = 30/120 = 0.25, triplet = 0.25 * (1/3) ≈ 0.0833
    expect(delay.parameters.Time).toBeCloseTo(0.0833, 3);
  });

  it("FX-03-9: delaySubdivision=quarter (explicit) at 120 BPM produces same as no subdivision", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ tempoHint: 120, delaySubdivision: "quarter" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // quarter = 30/120 = 0.25
    expect(delay.parameters.Time).toBeCloseTo(0.25, 3);
  });

  it("FX-03-10: delaySubdivision without tempoHint has no effect", () => {
    const chain = makeDelayChain();
    const intent = makeIntent({ genreHint: "blues", delaySubdivision: "dotted_eighth" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Without tempoHint, subdivision is ignored — genre default blues Time = 0.15
    expect(delay.parameters.Time).toBeCloseTo(0.15, 3);
  });

  it("FX-03-11: dotted_eighth with Dual Delay applies subdivision then dotted-eighth offset", () => {
    const chain = makeDelayChain("Dual Delay", "HD2_DelayDualDelay");
    const intent = makeIntent({ tempoHint: 120, delaySubdivision: "eighth" as const });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Left Time: quarter=0.25 * 0.5(eighth) = 0.125
    // Right Time: quarterNoteTime * 0.75 = 0.25 * 0.75 = 0.1875 (dotted-eighth offset from base quarter note)
    expect(delay.parameters["Left Time"]).toBeCloseTo(0.125, 3);
    expect(delay.parameters["Right Time"]).toBeCloseTo(0.1875, 4);
  });
});

// ============================================================
// FX-01: Guitar-type EQ shaping
// ============================================================
// These tests verify that the guitarType field in ToneIntent adjusts
// the post-cab parametric EQ (HD2_EQParametric) output relative to the
// AmpCategory baseline. Single-coil and humbucker guitars have fundamentally
// different frequency profiles requiring different EQ compensation.
//
// Baselines from EQ_PARAMS:
//   clean: LowGain=0.50, MidGain=0.48, HighGain=0.55
//   crunch: LowGain=0.45, MidGain=0.45, HighGain=0.56
//   high_gain: LowGain=0.42, MidGain=0.40, HighGain=0.54

describe("FX-01: guitar-type EQ shaping", () => {
  // Standard parametric EQ chain with clean amp
  function makeEqChain(): BlockSpec[] {
    return [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "eq", modelId: "HD2_EQParametric", modelName: "Parametric EQ" }),
    ];
  }

  // FX-01-1: single_coil produces HighGain LOWER than baseline (cut harshness)
  // clean baseline HighGain = 0.55; single_coil delta = -0.02 → expect 0.53
  it("FX-01-1: single_coil guitarType produces HighGain lower than clean baseline (cut harshness)", () => {
    const chain = makeEqChain();
    const intent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "single_coil" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const resolvedEq = result[1];
    // single_coil EQ_GUITAR_TYPE_ADJUST.HighGain = -0.02 → 0.55 - 0.02 = 0.53
    expect(resolvedEq.parameters.HighGain).toBeLessThan(0.55); // below clean baseline
  });

  // FX-01-2: humbucker produces HighGain HIGHER than baseline (recover presence)
  // clean baseline HighGain = 0.55; humbucker delta = +0.03 → expect 0.58
  it("FX-01-2: humbucker guitarType produces HighGain higher than clean baseline (recover presence)", () => {
    const chain = makeEqChain();
    const intent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "humbucker" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const resolvedEq = result[1];
    // humbucker EQ_GUITAR_TYPE_ADJUST.HighGain = +0.03 → 0.55 + 0.03 = 0.58
    expect(resolvedEq.parameters.HighGain).toBeGreaterThan(0.55); // above clean baseline
  });

  // FX-01-3: single_coil and humbucker produce measurably different EQ values
  it("FX-01-3: single_coil and humbucker produce different LowGain, MidGain, HighGain values", () => {
    const chain1 = makeEqChain();
    const chain2 = makeEqChain();
    const singleCoilIntent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "single_coil" });
    const humbuckerIntent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "humbucker" });
    const scResult = resolveParameters(chain1, singleCoilIntent, defaultCaps);
    const hbResult = resolveParameters(chain2, humbuckerIntent, defaultCaps);
    const scEq = scResult[1].parameters;
    const hbEq = hbResult[1].parameters;
    // Single-coil vs humbucker must differ on all three gain parameters
    expect(scEq.HighGain).not.toEqual(hbEq.HighGain);
    expect(scEq.LowGain).not.toEqual(hbEq.LowGain);
    expect(scEq.MidGain).not.toEqual(hbEq.MidGain);
  });

  // FX-01-4: p90 produces HighGain between single_coil and humbucker extremes
  it("FX-01-4: p90 guitarType produces HighGain between single_coil and humbucker", () => {
    const sc = resolveParameters(makeEqChain(), makeIntent({ ampName: "US Deluxe Nrm", guitarType: "single_coil" }), defaultCaps);
    const hb = resolveParameters(makeEqChain(), makeIntent({ ampName: "US Deluxe Nrm", guitarType: "humbucker" }), defaultCaps);
    const p9 = resolveParameters(makeEqChain(), makeIntent({ ampName: "US Deluxe Nrm", guitarType: "p90" }), defaultCaps);
    const scHighGain = sc[1].parameters.HighGain as number;
    const hbHighGain = hb[1].parameters.HighGain as number;
    const p90HighGain = p9[1].parameters.HighGain as number;
    // p90 must be strictly between single_coil (lower) and humbucker (higher)
    expect(p90HighGain).toBeGreaterThan(scHighGain);
    expect(p90HighGain).toBeLessThan(hbHighGain);
  });

  // FX-01-5: no guitarType (undefined) produces exact baseline EQ_PARAMS values (regression)
  // guitarType is required in ToneIntent but resolveEqParams accepts undefined gracefully.
  // Cast to ToneIntent to simulate internal callers that may pass undefined.
  it("FX-01-5: no guitarType produces exact baseline EQ_PARAMS values (zero regression)", () => {
    const chain = makeEqChain();
    // Omit guitarType to test fallback path — cast to satisfy TypeScript
    const intent = {
      ampName: "US Deluxe Nrm",
      cabName: "1x12 US Deluxe",
      effects: [],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Rhythm", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
        { name: "Ambient", toneRole: "ambient" },
      ],
      // guitarType deliberately omitted — should produce exact baseline
    } as unknown as ToneIntent;
    const result = resolveParameters(chain, intent, defaultCaps);
    const resolvedEq = result[1].parameters;
    // clean baseline EQ_PARAMS.clean values
    expect(resolvedEq.LowGain).toBeCloseTo(0.50, 5);
    expect(resolvedEq.MidGain).toBeCloseTo(0.48, 5);
    expect(resolvedEq.HighGain).toBeCloseTo(0.55, 5);
  });

  // FX-01-6: guitarType only affects HD2_EQParametric — non-parametric EQ uses model defaults
  it("FX-01-6: guitarType does NOT affect non-parametric EQ blocks (model defaults unchanged)", () => {
    // Use a non-parametric EQ model — model defaults apply, guitarType has no effect
    const chainSimple: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "eq", modelId: "HD2_EQSimple", modelName: "Simple EQ" }),
    ];
    const scIntent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "single_coil" });
    const hbIntent = makeIntent({ ampName: "US Deluxe Nrm", guitarType: "humbucker" });
    const scResult = resolveParameters(chainSimple, scIntent, defaultCaps);
    const hbResult = resolveParameters(chainSimple, hbIntent, defaultCaps);
    // Non-parametric EQ should produce identical output regardless of guitarType
    expect(scResult[1].parameters).toEqual(hbResult[1].parameters);
  });
});

// ============================================================
// INTEL-05: effect paramOverrides in resolveDefaultParams
// ============================================================
// These tests verify that per-model paramOverrides are applied in the
// resolution pipeline: defaultParams -> paramOverrides -> genre overrides -> tempo override.
// paramOverrides fix model-inherent defaults; genre overrides still win (user intent).

describe("effect paramOverrides (INTEL-05)", () => {
  // Test 1: Ganymede reverb WITHOUT genre hint gets paramOverrides Mix=0.25 (not default 0.35)
  it("Ganymede reverb without genre hint gets Mix=0.25 (paramOverrides wins over defaultParams 0.35)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede" }),
    ];
    const intent = makeIntent(); // no genreHint
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    expect(reverb.parameters.Mix).toBe(0.25);
  });

  // Test 2: Heliosphere delay WITHOUT genre hint gets paramOverrides Feedback=0.28 (not default 0.35)
  it("Heliosphere delay without genre hint gets Feedback=0.28 (paramOverrides wins over defaultParams 0.35)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "delay", modelId: "HD2_DelayHeliosphere", modelName: "Heliosphere" }),
    ];
    const intent = makeIntent(); // no genreHint
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    expect(delay.parameters.Feedback).toBe(0.28);
  });

  // Test 3: Ganymede reverb WITH blues genre hint — genre Mix=0.20 wins over paramOverrides Mix=0.25
  it("Ganymede reverb with blues genre hint gets genre Mix (genre overrides win over paramOverrides)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede" }),
    ];
    const intent = makeIntent({ genreHint: "blues" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    // Blues genre reverb Mix=0.20 should win over paramOverrides Mix=0.25
    expect(reverb.parameters.Mix).toBe(0.20);
  });

  // Test 4: Cosmos Echo delay WITH ambient genre hint — genre Feedback=0.50 wins over paramOverrides Feedback=0.28
  it("Cosmos Echo delay with ambient genre hint gets genre Feedback (genre overrides win over paramOverrides)", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "delay", modelId: "HD2_DelayCosmosEcho", modelName: "Cosmos Echo" }),
    ];
    const intent = makeIntent({ genreHint: "ambient" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Ambient genre delay Feedback=0.50 should win over paramOverrides Feedback=0.28
    expect(delay.parameters.Feedback).toBe(0.50);
  });

  // Test 5: Simple Delay (no paramOverrides) with genre hint — genre overrides still apply normally (regression guard)
  it("Simple Delay (no paramOverrides) with blues genre hint still gets genre Feedback=0.20", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelay", modelName: "Simple Delay" }),
    ];
    const intent = makeIntent({ genreHint: "blues" });
    const result = resolveParameters(chain, intent, defaultCaps);
    const delay = result[1];
    // Blues genre delay Feedback=0.20 should override Simple Delay defaultParams Feedback=0.35
    expect(delay.parameters.Feedback).toBe(0.20);
  });

  // Test 6: Plate reverb (no paramOverrides) without genre hint — gets raw defaultParams (regression guard)
  it("Plate reverb (no paramOverrides) without genre hint gets raw defaultParams Mix=0.25", () => {
    const chain: BlockSpec[] = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm" }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate" }),
    ];
    const intent = makeIntent(); // no genreHint
    const result = resolveParameters(chain, intent, defaultCaps);
    const reverb = result[1];
    // Plate has no paramOverrides — raw defaultParams Mix=0.25
    expect(reverb.parameters.Mix).toBe(0.25);
  });
});

// ============================================================
// COMBO-01: Wah + compressor threshold reduction
// ============================================================
// When a wah coexists with a compressor in the same chain, the compressor's
// threshold-like parameter must be reduced to prevent over-compressing the
// wah sweep's frequency peaks. Single-value threshold params get -0.10,
// multi-band threshold params (3-Band Comp) get -0.08.

describe("COMBO-01: wah + compressor threshold reduction", () => {
  // Helper: build a clean-amp intent with specific effects
  function comboIntent(effects: Array<{ modelName: string; role: "always_on" | "toggleable" | "ambient" }>): ToneIntent {
    return makeIntent({
      ampName: "US Deluxe Nrm",
      effects,
    });
  }

  // COMBO-01-1: Wah + Deluxe Comp — Threshold reduced by at least 0.08
  it("COMBO-01-1: chain with wah + Deluxe Comp has Threshold at least 0.08 lower than without wah", () => {
    // WITHOUT wah (baseline)
    const intentNoWah = comboIntent([
      { modelName: "Deluxe Comp", role: "toggleable" },
    ]);
    const chainNoWah = assembleSignalChain(intentNoWah, defaultCaps);
    const resolvedNoWah = resolveParameters(chainNoWah, intentNoWah, defaultCaps);
    const compNoWah = resolvedNoWah.find(b => b.modelName === "Deluxe Comp")!;

    // WITH wah
    const intentWithWah = comboIntent([
      { modelName: "UK Wah 846", role: "toggleable" },
      { modelName: "Deluxe Comp", role: "toggleable" },
    ]);
    const chainWithWah = assembleSignalChain(intentWithWah, defaultCaps);
    const resolvedWithWah = resolveParameters(chainWithWah, intentWithWah, defaultCaps);
    const compWithWah = resolvedWithWah.find(b => b.modelName === "Deluxe Comp")!;

    const delta = (compNoWah.parameters.Threshold as number) - (compWithWah.parameters.Threshold as number);
    expect(delta).toBeGreaterThanOrEqual(0.08);
  });

  // COMBO-01-2: Wah + Red Squeeze — Sensitivity reduced by at least 0.08
  it("COMBO-01-2: chain with wah + Red Squeeze has Sensitivity at least 0.08 lower than without wah", () => {
    const intentNoWah = comboIntent([
      { modelName: "Red Squeeze", role: "toggleable" },
    ]);
    const chainNoWah = assembleSignalChain(intentNoWah, defaultCaps);
    const resolvedNoWah = resolveParameters(chainNoWah, intentNoWah, defaultCaps);
    const compNoWah = resolvedNoWah.find(b => b.modelName === "Red Squeeze")!;

    const intentWithWah = comboIntent([
      { modelName: "UK Wah 846", role: "toggleable" },
      { modelName: "Red Squeeze", role: "toggleable" },
    ]);
    const chainWithWah = assembleSignalChain(intentWithWah, defaultCaps);
    const resolvedWithWah = resolveParameters(chainWithWah, intentWithWah, defaultCaps);
    const compWithWah = resolvedWithWah.find(b => b.modelName === "Red Squeeze")!;

    const delta = (compNoWah.parameters.Sensitivity as number) - (compWithWah.parameters.Sensitivity as number);
    expect(delta).toBeGreaterThanOrEqual(0.08);
  });

  // COMBO-01-3: Wah + LA Studio Comp — PeakReduction reduced by at least 0.08
  it("COMBO-01-3: chain with wah + LA Studio Comp has PeakReduction at least 0.08 lower than without wah", () => {
    const intentNoWah = comboIntent([
      { modelName: "LA Studio Comp", role: "toggleable" },
    ]);
    const chainNoWah = assembleSignalChain(intentNoWah, defaultCaps);
    const resolvedNoWah = resolveParameters(chainNoWah, intentNoWah, defaultCaps);
    const compNoWah = resolvedNoWah.find(b => b.modelName === "LA Studio Comp")!;

    const intentWithWah = comboIntent([
      { modelName: "UK Wah 846", role: "toggleable" },
      { modelName: "LA Studio Comp", role: "toggleable" },
    ]);
    const chainWithWah = assembleSignalChain(intentWithWah, defaultCaps);
    const resolvedWithWah = resolveParameters(chainWithWah, intentWithWah, defaultCaps);
    const compWithWah = resolvedWithWah.find(b => b.modelName === "LA Studio Comp")!;

    const delta = (compNoWah.parameters.PeakReduction as number) - (compWithWah.parameters.PeakReduction as number);
    expect(delta).toBeGreaterThanOrEqual(0.08);
  });

  // COMBO-01-4: Wah + 3-Band Comp — LowThresh, MidThresh, HighThresh each reduced by at least 0.08
  it("COMBO-01-4: chain with wah + 3-Band Comp has all thresholds at least 0.08 lower than without wah", () => {
    const intentNoWah = comboIntent([
      { modelName: "3-Band Comp", role: "toggleable" },
    ]);
    const chainNoWah = assembleSignalChain(intentNoWah, defaultCaps);
    const resolvedNoWah = resolveParameters(chainNoWah, intentNoWah, defaultCaps);
    const compNoWah = resolvedNoWah.find(b => b.modelName === "3-Band Comp")!;

    const intentWithWah = comboIntent([
      { modelName: "UK Wah 846", role: "toggleable" },
      { modelName: "3-Band Comp", role: "toggleable" },
    ]);
    const chainWithWah = assembleSignalChain(intentWithWah, defaultCaps);
    const resolvedWithWah = resolveParameters(chainWithWah, intentWithWah, defaultCaps);
    const compWithWah = resolvedWithWah.find(b => b.modelName === "3-Band Comp")!;

    const deltaLow = (compNoWah.parameters.LowThresh as number) - (compWithWah.parameters.LowThresh as number);
    const deltaMid = (compNoWah.parameters.MidThresh as number) - (compWithWah.parameters.MidThresh as number);
    const deltaHigh = (compNoWah.parameters.HighThresh as number) - (compWithWah.parameters.HighThresh as number);
    expect(deltaLow).toBeGreaterThanOrEqual(0.08);
    expect(deltaMid).toBeGreaterThanOrEqual(0.08);
    expect(deltaHigh).toBeGreaterThanOrEqual(0.08);
  });

  // COMBO-01-5: Guard — chain WITHOUT wah leaves Deluxe Comp Threshold at model default (0.50)
  it("COMBO-01-5: chain without wah leaves Deluxe Comp Threshold unchanged at 0.50", () => {
    const intent = comboIntent([
      { modelName: "Deluxe Comp", role: "toggleable" },
    ]);
    const chain = assembleSignalChain(intent, defaultCaps);
    const resolved = resolveParameters(chain, intent, defaultCaps);
    const comp = resolved.find(b => b.modelName === "Deluxe Comp")!;
    expect(comp.parameters.Threshold).toBe(0.50);
  });
});

// ============================================================
// COMBO-04: Delay + reverb mix balancing
// ============================================================
// When delay and reverb coexist, reverb Mix is reduced by 0.05 to prevent
// wash. The reduction has a floor of 0.15 to keep reverb audible.

describe("COMBO-04: delay + reverb mix balancing", () => {
  // Helper: build intent with genre and specific effects
  function comboIntent(
    genreHint: string | undefined,
    effects: Array<{ modelName: string; role: "always_on" | "toggleable" | "ambient" }>,
  ): ToneIntent {
    return makeIntent({
      ampName: "US Deluxe Nrm",
      genreHint,
      effects,
    });
  }

  // COMBO-04-1: Blues genre — reverb Mix reduced from 0.20 to at most 0.15
  it("COMBO-04-1: blues genre chain with delay+reverb has reverb Mix at least 0.05 lower than reverb-only", () => {
    // Reverb only
    const reverbOnlyIntent = comboIntent("blues", [
      { modelName: "Plate", role: "ambient" },
    ]);
    const reverbOnlyChain = assembleSignalChain(reverbOnlyIntent, defaultCaps);
    const reverbOnlyResolved = resolveParameters(reverbOnlyChain, reverbOnlyIntent, defaultCaps);
    const reverbOnly = reverbOnlyResolved.find(b => b.type === "reverb")!;

    // Delay + reverb
    const delayReverbIntent = comboIntent("blues", [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "ambient" },
    ]);
    const delayReverbChain = assembleSignalChain(delayReverbIntent, defaultCaps);
    const delayReverbResolved = resolveParameters(delayReverbChain, delayReverbIntent, defaultCaps);
    const reverbWithDelay = delayReverbResolved.find(b => b.type === "reverb")!;

    // Delta comparison uses toBeCloseTo to avoid IEEE 754 floating-point precision issues
    const delta = (reverbOnly.parameters.Mix as number) - (reverbWithDelay.parameters.Mix as number);
    expect(delta).toBeCloseTo(0.05, 10);
    expect(reverbWithDelay.parameters.Mix).toBeCloseTo(0.15, 3);
  });

  // COMBO-04-2: Metal genre — reverb Mix floored at 0.15 (0.12 - 0.05 = 0.07, but floor applies)
  it("COMBO-04-2: metal genre chain with delay+reverb has reverb Mix floored at 0.15", () => {
    const intent = comboIntent("metal", [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "ambient" },
    ]);
    // Metal uses high-gain amp so compressor will be omitted (COMBO-02), use high-gain amp
    const metalIntent = makeIntent({
      ampName: "Cali Rectifire",
      genreHint: "metal",
      effects: [
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Plate", role: "ambient" },
      ],
    });
    const chain = assembleSignalChain(metalIntent, defaultCaps);
    const resolved = resolveParameters(chain, metalIntent, defaultCaps);
    const reverb = resolved.find(b => b.type === "reverb")!;
    // Metal reverb Mix baseline = 0.12, reduced by 0.05 = 0.07, but floor of 0.15 applies
    expect(reverb.parameters.Mix).toBe(0.15);
  });

  // COMBO-04-3: Ambient genre — reverb Mix reduced from 0.50 to 0.45
  it("COMBO-04-3: ambient genre chain with delay+reverb has reverb Mix at least 0.05 lower", () => {
    const intent = comboIntent("ambient", [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "ambient" },
    ]);
    const chain = assembleSignalChain(intent, defaultCaps);
    const resolved = resolveParameters(chain, intent, defaultCaps);
    const reverb = resolved.find(b => b.type === "reverb")!;
    expect(reverb.parameters.Mix).toBeCloseTo(0.45, 3);
  });

  // COMBO-04-4: Guard — reverb-only chain has no reduction (reverb Mix at genre baseline)
  it("COMBO-04-4: chain with reverb only (no delay) has reverb Mix at genre baseline", () => {
    const intent = comboIntent("blues", [
      { modelName: "Plate", role: "ambient" },
    ]);
    const chain = assembleSignalChain(intent, defaultCaps);
    const resolved = resolveParameters(chain, intent, defaultCaps);
    const reverb = resolved.find(b => b.type === "reverb")!;
    // Blues reverb Mix baseline = 0.20 — no reduction without delay
    expect(reverb.parameters.Mix).toBe(0.20);
  });

  // COMBO-04-5: Guard — delay parameters NOT affected by reverb presence
  it("COMBO-04-5: delay parameters are NOT affected by reverb presence", () => {
    // Delay only
    const delayOnlyIntent = comboIntent("blues", [
      { modelName: "Simple Delay", role: "toggleable" },
    ]);
    const delayOnlyChain = assembleSignalChain(delayOnlyIntent, defaultCaps);
    const delayOnlyResolved = resolveParameters(delayOnlyChain, delayOnlyIntent, defaultCaps);
    const delayAlone = delayOnlyResolved.find(b => b.type === "delay")!;

    // Delay + reverb
    const delayReverbIntent = comboIntent("blues", [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "ambient" },
    ]);
    const delayReverbChain = assembleSignalChain(delayReverbIntent, defaultCaps);
    const delayReverbResolved = resolveParameters(delayReverbChain, delayReverbIntent, defaultCaps);
    const delayWithReverb = delayReverbResolved.find(b => b.type === "delay")!;

    // Delay Time, Feedback, Mix must be identical
    expect(delayWithReverb.parameters.Time).toBe(delayAlone.parameters.Time);
    expect(delayWithReverb.parameters.Feedback).toBe(delayAlone.parameters.Feedback);
    expect(delayWithReverb.parameters.Mix).toBe(delayAlone.parameters.Mix);
  });

  // COMBO-04-6: Immutability guard — combination adjustments do not mutate input chain
  it("COMBO-04-6: combination adjustments do not mutate the input chain", () => {
    const intent = comboIntent("blues", [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "ambient" },
    ]);
    const chain = assembleSignalChain(intent, defaultCaps);
    const resolved = resolveParameters(chain, intent, defaultCaps);

    // The original chain blocks should still have empty parameters
    for (const block of chain) {
      expect(block.parameters).toEqual({});
    }

    // The resolved chain should be a different array
    expect(resolved).not.toBe(chain);
  });
});
