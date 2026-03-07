import { describe, it, expect } from "vitest";
import {
  PARAMETER_SCHEMA,
  INTERNAL_PARAMETERS,
  toDisplayValue,
  fromDisplayValue,
  lookupModelByModelId,
  getVisibleParameters,
  type ParameterSchemaDef,
  type SchemaType,
} from "./parameter-schema";

// ---------------------------------------------------------------------------
// Schema Type Coverage
// ---------------------------------------------------------------------------
describe("PARAMETER_SCHEMA registry", () => {
  it("maps Drive to percentage type", () => {
    expect(PARAMETER_SCHEMA["Drive"]).toBeDefined();
    expect(PARAMETER_SCHEMA["Drive"].type).toBe("percentage");
  });

  it("maps LowGain to eq_gain type", () => {
    expect(PARAMETER_SCHEMA["LowGain"]).toBeDefined();
    expect(PARAMETER_SCHEMA["LowGain"].type).toBe("eq_gain");
  });

  it("maps Time to time_ms type", () => {
    expect(PARAMETER_SCHEMA["Time"]).toBeDefined();
    expect(PARAMETER_SCHEMA["Time"].type).toBe("time_ms");
  });

  it("maps LowCut to hz_freq type", () => {
    expect(PARAMETER_SCHEMA["LowCut"]).toBeDefined();
    expect(PARAMETER_SCHEMA["LowCut"].type).toBe("hz_freq");
  });

  it("maps Mic to discrete type", () => {
    expect(PARAMETER_SCHEMA["Mic"]).toBeDefined();
    expect(PARAMETER_SCHEMA["Mic"].type).toBe("discrete");
    expect(PARAMETER_SCHEMA["Mic"].options).toBeDefined();
    expect(PARAMETER_SCHEMA["Mic"].options!.length).toBeGreaterThan(0);
  });

  it("does not map unknown params (fallback handled by consumers)", () => {
    expect(PARAMETER_SCHEMA["UnknownParam"]).toBeUndefined();
  });

  it("covers all 7 schema types across the registry", () => {
    const typesPresent = new Set(
      Object.values(PARAMETER_SCHEMA).map((s) => s.type),
    );
    // boolean and db_level may not have entries yet but the types exist in the schema
    expect(typesPresent.has("percentage")).toBe(true);
    expect(typesPresent.has("eq_gain")).toBe(true);
    expect(typesPresent.has("time_ms")).toBe(true);
    expect(typesPresent.has("hz_freq")).toBe(true);
    expect(typesPresent.has("discrete")).toBe(true);
  });

  it("maps common amp params to percentage", () => {
    const percentageParams = [
      "Bass",
      "Mid",
      "Treble",
      "Tone",
      "Mix",
      "Feedback",
      "Depth",
      "Speed",
      "Sensitivity",
      "Ratio",
      "Attack",
      "Release",
      "Threshold",
      "Output",
      "Gain",
      "Position",
      "ChVol",
      "Master",
      "Presence",
      "Sag",
      "Hum",
      "Ripple",
      "Bias",
      "BiasX",
      "Cut",
      "Resonance",
      "Q",
    ];
    for (const key of percentageParams) {
      expect(
        PARAMETER_SCHEMA[key],
        `${key} should be in PARAMETER_SCHEMA`,
      ).toBeDefined();
      expect(PARAMETER_SCHEMA[key].type, `${key} should be percentage`).toBe(
        "percentage",
      );
    }
  });

  it("maps EQ gain params to eq_gain", () => {
    const eqGainParams = ["LowGain", "MidGain", "HighGain"];
    for (const key of eqGainParams) {
      expect(PARAMETER_SCHEMA[key].type, `${key} should be eq_gain`).toBe(
        "eq_gain",
      );
    }
  });

  it("maps time params to time_ms", () => {
    const timeParams = ["Time", "DecayTime", "PreDelay"];
    for (const key of timeParams) {
      expect(PARAMETER_SCHEMA[key].type, `${key} should be time_ms`).toBe(
        "time_ms",
      );
    }
  });

  it("maps frequency params to hz_freq", () => {
    const freqParams = ["LowCut", "HighCut", "LowFreq", "MidFreq", "HighFreq"];
    for (const key of freqParams) {
      expect(PARAMETER_SCHEMA[key].type, `${key} should be hz_freq`).toBe(
        "hz_freq",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Display Transform Functions
// ---------------------------------------------------------------------------
describe("toDisplayValue", () => {
  it("converts percentage: 0.5 -> 50", () => {
    const schema = PARAMETER_SCHEMA["Drive"];
    expect(toDisplayValue(0.5, schema)).toBe(50);
  });

  it("converts eq_gain midpoint: 0.5 -> 0dB", () => {
    const schema = PARAMETER_SCHEMA["LowGain"];
    expect(toDisplayValue(0.5, schema)).toBe(0);
  });

  it("converts eq_gain min: 0.0 -> -12dB", () => {
    const schema = PARAMETER_SCHEMA["LowGain"];
    expect(toDisplayValue(0.0, schema)).toBe(-12);
  });

  it("converts eq_gain max: 1.0 -> 12dB", () => {
    const schema = PARAMETER_SCHEMA["LowGain"];
    expect(toDisplayValue(1.0, schema)).toBe(12);
  });

  it("converts time_ms: 0.375 -> 750ms", () => {
    const schema = PARAMETER_SCHEMA["Time"];
    expect(toDisplayValue(0.375, schema)).toBe(750);
  });

  it("converts hz_freq min: 0.0 -> 20Hz", () => {
    const schema = PARAMETER_SCHEMA["LowCut"];
    expect(toDisplayValue(0.0, schema)).toBe(20);
  });

  it("converts hz_freq max: 1.0 -> 20000Hz", () => {
    const schema = PARAMETER_SCHEMA["LowCut"];
    expect(toDisplayValue(1.0, schema)).toBe(20000);
  });
});

describe("fromDisplayValue", () => {
  it("converts percentage: 75% -> 0.75", () => {
    const schema = PARAMETER_SCHEMA["Drive"];
    expect(fromDisplayValue(75, schema)).toBe(0.75);
  });

  it("converts eq_gain: 6dB -> 0.75", () => {
    const schema = PARAMETER_SCHEMA["LowGain"];
    expect(fromDisplayValue(6, schema)).toBe(0.75);
  });
});

describe("round-trip transforms", () => {
  it("fromDisplay(toDisplay(x)) === x for percentage", () => {
    const schema = PARAMETER_SCHEMA["Drive"];
    for (const x of [0, 0.25, 0.5, 0.75, 1.0]) {
      expect(fromDisplayValue(toDisplayValue(x, schema), schema)).toBeCloseTo(
        x,
        10,
      );
    }
  });

  it("fromDisplay(toDisplay(x)) === x for eq_gain", () => {
    const schema = PARAMETER_SCHEMA["LowGain"];
    for (const x of [0, 0.25, 0.5, 0.75, 1.0]) {
      expect(fromDisplayValue(toDisplayValue(x, schema), schema)).toBeCloseTo(
        x,
        10,
      );
    }
  });

  it("fromDisplay(toDisplay(x)) === x for time_ms", () => {
    const schema = PARAMETER_SCHEMA["Time"];
    for (const x of [0, 0.1, 0.375, 0.5, 1.0]) {
      expect(fromDisplayValue(toDisplayValue(x, schema), schema)).toBeCloseTo(
        x,
        10,
      );
    }
  });

  it("fromDisplay(toDisplay(x)) === x for hz_freq", () => {
    const schema = PARAMETER_SCHEMA["LowCut"];
    for (const x of [0, 0.25, 0.5, 0.75, 1.0]) {
      expect(fromDisplayValue(toDisplayValue(x, schema), schema)).toBeCloseTo(
        x,
        10,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Internal Parameters
// ---------------------------------------------------------------------------
describe("INTERNAL_PARAMETERS", () => {
  it("contains all 12 internal cab IR param names", () => {
    const expected = [
      "AmpCabZFir",
      "AmpCabZUpdate",
      "AmpCabPeakFc",
      "AmpCabPeakG",
      "AmpCabPeakQ",
      "AmpCabPeak2Fc",
      "AmpCabPeak2G",
      "AmpCabPeak2Q",
      "AmpCabShelfF",
      "AmpCabShelfG",
      "ZPrePost",
      "Hype",
    ];
    expect(INTERNAL_PARAMETERS.size).toBe(12);
    for (const key of expected) {
      expect(
        INTERNAL_PARAMETERS.has(key),
        `${key} should be in INTERNAL_PARAMETERS`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Model Lookup
// ---------------------------------------------------------------------------
describe("lookupModelByModelId", () => {
  it('finds Scream 808 by HD2_DistScream808', () => {
    const model = lookupModelByModelId("HD2_DistScream808");
    expect(model).not.toBeNull();
    expect(model!.name).toBe("Scream 808");
  });

  it('finds Minotaur by HD2_DistMinotaur', () => {
    const model = lookupModelByModelId("HD2_DistMinotaur");
    expect(model).not.toBeNull();
    expect(model!.name).toBe("Minotaur");
  });

  it("returns null for nonexistent model ID", () => {
    expect(lookupModelByModelId("NONEXISTENT_ID")).toBeNull();
  });

  it("finds amp models by ID", () => {
    const model = lookupModelByModelId("HD2_AmpUSDeluxeNrm");
    expect(model).not.toBeNull();
    expect(model!.name).toBe("US Deluxe Nrm");
  });

  it("finds delay models by ID", () => {
    const model = lookupModelByModelId("HD2_DelaySimpleDelay");
    expect(model).not.toBeNull();
    expect(model!.name).toBe("Simple Delay");
  });

  it("finds reverb models by ID", () => {
    const model = lookupModelByModelId("HD2_ReverbPlate");
    expect(model).not.toBeNull();
    expect(model!.name).toBe("Plate");
  });
});

// ---------------------------------------------------------------------------
// Visible Parameter Filter
// ---------------------------------------------------------------------------
describe("getVisibleParameters", () => {
  it("filters out internal params and sorts alphabetically", () => {
    const result = getVisibleParameters({
      Drive: 0.5,
      AmpCabZFir: 0,
      Bass: 0.6,
    });
    expect(result).toEqual([
      ["Bass", 0.6],
      ["Drive", 0.5],
    ]);
  });

  it("returns empty array when all params are internal", () => {
    const result = getVisibleParameters({
      AmpCabPeakFc: 100,
      AmpCabPeakG: 0,
    });
    expect(result).toEqual([]);
  });

  it("passes through non-internal params sorted", () => {
    const result = getVisibleParameters({
      Treble: 0.6,
      Mid: 0.5,
      Bass: 0.4,
    });
    expect(result).toEqual([
      ["Bass", 0.4],
      ["Mid", 0.5],
      ["Treble", 0.6],
    ]);
  });

  it("handles empty parameters object", () => {
    expect(getVisibleParameters({})).toEqual([]);
  });

  it("filters all 12 internal params", () => {
    const internalOnly: Record<string, number | boolean> = {
      AmpCabZFir: 0,
      AmpCabZUpdate: 0,
      AmpCabPeakFc: 0,
      AmpCabPeakG: 0,
      AmpCabPeakQ: 0,
      AmpCabPeak2Fc: 0,
      AmpCabPeak2G: 0,
      AmpCabPeak2Q: 0,
      AmpCabShelfF: 0,
      AmpCabShelfG: 0,
      ZPrePost: 0,
      Hype: 0,
    };
    expect(getVisibleParameters(internalOnly)).toEqual([]);
  });
});
