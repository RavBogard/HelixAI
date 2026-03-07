// quality-validate.test.ts — TDD tests for validatePresetQuality() and logQualityWarnings()
// Phase 74, Plan 01: Core quality validation function

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import type { DeviceCapabilities } from "./device-family";
import { getCapabilities } from "./device-family";
import { validatePresetQuality } from "./quality-validate";
import type { QualityWarning } from "./quality-validate";
import { logQualityWarnings } from "./quality-logger";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    type: "amp",
    modelId: "HD2_AmpBritP75Nrm",
    modelName: "Brit P-75 Nrm",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SnapshotSpec> = {}): SnapshotSpec {
  return {
    name: "Clean",
    description: "Clean tone",
    ledColor: 6,
    blockStates: {},
    parameterOverrides: {},
    ...overrides,
  };
}

function makePreset(overrides: Partial<PresetSpec> = {}): PresetSpec {
  return {
    name: "Test Preset",
    description: "Test description",
    tempo: 120,
    signalChain: [
      makeBlock({ type: "amp", modelId: "HD2_AmpBritP75Nrm", modelName: "Brit P-75 Nrm", parameters: { Drive: 0.25, ChVol: 0.70 } }),
      makeBlock({ type: "cab", modelId: "HD2_Cab4x12_Brit75", modelName: "4x12 Brit 75", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0, Mic: 0 } }),
    ],
    snapshots: [
      makeSnapshot({ name: "Clean", parameterOverrides: { block0: { ChVol: 0.68 } } }),
      makeSnapshot({ name: "Crunch", parameterOverrides: { block0: { ChVol: 0.72 } } }),
      makeSnapshot({ name: "Lead", parameterOverrides: { block0: { ChVol: 0.80 } } }),
      makeSnapshot({ name: "Ambient", parameterOverrides: { block0: { ChVol: 0.65 } } }),
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Per-block parameter checks (7 checks)
// ---------------------------------------------------------------------------

describe("validatePresetQuality", () => {
  const helixCaps = getCapabilities("helix_lt");
  const stadiumCaps = getCapabilities("helix_stadium");

  describe("REVERB_MIX_HIGH", () => {
    it("returns warning when reverb Mix > 0.60", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.80 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "REVERB_MIX_HIGH");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
      expect(w!.actual).toBe(0.80);
      expect(w!.threshold).toBe(0.60);
      expect(w!.blockRef).toBeDefined();
    });

    it("returns no warning when reverb Mix <= 0.60", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.20 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.find(w => w.code === "REVERB_MIX_HIGH")).toBeUndefined();
    });
  });

  describe("DELAY_FEEDBACK_HIGH", () => {
    it("returns warning when delay Feedback > 0.70", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "delay", modelId: "HD2_DelaySimple", modelName: "Simple Delay", position: 2, parameters: { Feedback: 0.75, Mix: 0.30 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DELAY_FEEDBACK_HIGH");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });
  });

  describe("DELAY_MIX_HIGH", () => {
    it("returns warning when delay Mix > 0.55", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "delay", modelId: "HD2_DelaySimple", modelName: "Simple Delay", position: 2, parameters: { Feedback: 0.30, Mix: 0.60 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DELAY_MIX_HIGH");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });
  });

  describe("CAB_NO_LOWCUT", () => {
    it("returns warning when cab LowCut < 30.0 Hz", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 20.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "CAB_NO_LOWCUT");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });
  });

  describe("CAB_NO_HIGHCUT", () => {
    it("returns warning when cab HighCut > 18000.0 Hz", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 19000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "CAB_NO_HIGHCUT");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });
  });

  describe("cab with normal filtering", () => {
    it("returns no warnings for LowCut=80 HighCut=7000", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.find(w => w.code === "CAB_NO_LOWCUT")).toBeUndefined();
      expect(warnings.find(w => w.code === "CAB_NO_HIGHCUT")).toBeUndefined();
    });
  });

  describe("DRIVE_EXTREME", () => {
    it("returns warning when distortion Drive > 0.90", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur", position: 2, parameters: { Drive: 0.95 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DRIVE_EXTREME");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });
  });

  describe("AMP_DRIVE_EXTREME", () => {
    it("returns warning when HD2 amp Drive > 0.85", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelId: "HD2_AmpBritP75Nrm", modelName: "Brit P-75 Nrm", parameters: { Drive: 0.90 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "AMP_DRIVE_EXTREME");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
      expect(w!.threshold).toBe(0.85);
    });

    it("skips amp Drive check for Stadium amps (ampCatalogEra=agoura)", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelId: "Agoura_AmpBritP75Nrm", modelName: "Agoura Brit P-75", parameters: { Drive: 0.95 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, stadiumCaps);
      expect(warnings.find(w => w.code === "AMP_DRIVE_EXTREME")).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Preset-level structural checks (4 checks)
  // ---------------------------------------------------------------------------

  describe("SNAPSHOT_LEVEL_IMBALANCE", () => {
    it("returns warning when ChVol spread > 0.25", () => {
      const preset = makePreset({
        snapshots: [
          makeSnapshot({ name: "Clean", parameterOverrides: { block0: { ChVol: 0.50 } } }),
          makeSnapshot({ name: "Crunch", parameterOverrides: { block0: { ChVol: 0.72 } } }),
          makeSnapshot({ name: "Lead", parameterOverrides: { block0: { ChVol: 0.80 } } }),
          makeSnapshot({ name: "Ambient", parameterOverrides: { block0: { ChVol: 0.65 } } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "SNAPSHOT_LEVEL_IMBALANCE");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });

    it("returns no warning when ChVol spread <= 0.25", () => {
      const preset = makePreset({
        snapshots: [
          makeSnapshot({ name: "Clean", parameterOverrides: { block0: { ChVol: 0.68 } } }),
          makeSnapshot({ name: "Crunch", parameterOverrides: { block0: { ChVol: 0.72 } } }),
          makeSnapshot({ name: "Lead", parameterOverrides: { block0: { ChVol: 0.80 } } }),
          makeSnapshot({ name: "Ambient", parameterOverrides: { block0: { ChVol: 0.65 } } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.find(w => w.code === "SNAPSHOT_LEVEL_IMBALANCE")).toBeUndefined();
    });
  });

  describe("NO_TIME_EFFECTS", () => {
    it("returns info when no delay and no reverb in signal chain", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur", position: 2, parameters: { Drive: 0.30 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "NO_TIME_EFFECTS");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("info");
    });
  });

  describe("REVERB_WITHOUT_CAB_FILTERING", () => {
    it("returns info when reverb present but cab HighCut > 18000", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 19000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.30 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "REVERB_WITHOUT_CAB_FILTERING");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("info");
    });
  });

  // ---------------------------------------------------------------------------
  // Non-throwing guarantee
  // ---------------------------------------------------------------------------

  describe("non-throwing guarantee", () => {
    it("never throws for any input — always returns QualityWarning[]", () => {
      // Pass completely invalid inputs
      expect(() => validatePresetQuality({} as PresetSpec, {} as DeviceCapabilities)).not.toThrow();
      expect(validatePresetQuality({} as PresetSpec, {} as DeviceCapabilities)).toEqual([]);
    });

    it("returns empty array for empty signalChain", () => {
      const preset = makePreset({ signalChain: [] });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings).toEqual([]);
    });

    it("skips snapshot checks when snapshots are empty", () => {
      const preset = makePreset({ snapshots: [] });
      expect(() => validatePresetQuality(preset, helixCaps)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Well-formed preset test
  // ---------------------------------------------------------------------------

  describe("well-formed preset", () => {
    it("returns empty array for a well-formed clean preset", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelId: "HD2_AmpBritP75Nrm", modelName: "Brit P-75 Nrm", parameters: { Drive: 0.25, ChVol: 0.70 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.20 } }),
          makeBlock({ type: "delay", modelId: "HD2_DelaySimple", modelName: "Simple Delay", position: 3, parameters: { Feedback: 0.20, Mix: 0.20 } }),
        ],
        snapshots: [
          makeSnapshot({ name: "Clean", parameterOverrides: { block0: { ChVol: 0.68 } } }),
          makeSnapshot({ name: "Crunch", parameterOverrides: { block0: { ChVol: 0.72 } } }),
          makeSnapshot({ name: "Lead", parameterOverrides: { block0: { ChVol: 0.80 } } }),
          makeSnapshot({ name: "Ambient", parameterOverrides: { block0: { ChVol: 0.65 } } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // COHERE-06: Description-effect cross-validation
  // ---------------------------------------------------------------------------

  describe("COHERE-06: description-effect cross-validation", () => {
    it("warns when description mentions reverb but no reverb block", () => {
      const preset = makePreset({
        description: "Lush reverb wash with ambient spaciousness",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          // No reverb block
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DESC_EFFECT_MISSING");
      expect(w).toBeDefined();
      expect(w!.message).toContain("reverb");
      expect(w!.severity).toBe("warn");
    });

    it("warns for both reverb and delay when neither present", () => {
      const preset = makePreset({
        description: "Lush reverb wash with ambient delay",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const descWarnings = warnings.filter(w => w.code === "DESC_EFFECT_MISSING");
      expect(descWarnings.length).toBeGreaterThanOrEqual(2);
      const keywords = descWarnings.map(w => w.message);
      expect(keywords.some(m => m.includes("reverb"))).toBe(true);
      expect(keywords.some(m => m.includes("delay"))).toBe(true);
    });

    it("does NOT warn when description mentions reverb AND reverb block exists", () => {
      const preset = makePreset({
        description: "Lush reverb wash",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.20 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.find(w => w.code === "DESC_EFFECT_MISSING")).toBeUndefined();
    });

    it("warns when description mentions chorus but no modulation block", () => {
      const preset = makePreset({
        description: "Warm chorus shimmer",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DESC_EFFECT_MISSING" && w.message.includes("chorus"));
      expect(w).toBeDefined();
    });

    it("does NOT warn when description is undefined", () => {
      const preset = makePreset({
        description: undefined,
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.filter(w => w.code === "DESC_EFFECT_MISSING")).toHaveLength(0);
    });

    it("does NOT warn when description has no effect keywords", () => {
      const preset = makePreset({
        description: "Clean amp tone with warm low end",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      expect(warnings.filter(w => w.code === "DESC_EFFECT_MISSING")).toHaveLength(0);
    });

    it("DESC_EFFECT_MISSING has severity warn", () => {
      const preset = makePreset({
        description: "Heavy reverb wash",
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings.find(w => w.code === "DESC_EFFECT_MISSING");
      expect(w).toBeDefined();
      expect(w!.severity).toBe("warn");
    });

    it("description cross-validation is non-throwing", () => {
      // Even with bizarre inputs, should never throw
      expect(() => {
        validatePresetQuality(
          { description: "reverb delay chorus", signalChain: [] } as unknown as PresetSpec,
          {} as DeviceCapabilities,
        );
      }).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // QualityWarning structure
  // ---------------------------------------------------------------------------

  describe("QualityWarning structure", () => {
    it("includes code, severity, message, and blockRef", () => {
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
          makeBlock({ type: "reverb", modelId: "HD2_ReverbGanymede", modelName: "Ganymede", position: 2, parameters: { Mix: 0.80 } }),
        ],
      });
      const warnings = validatePresetQuality(preset, helixCaps);
      const w = warnings[0];
      expect(w.code).toBe("REVERB_MIX_HIGH");
      expect(w.severity).toBe("warn");
      expect(typeof w.message).toBe("string");
      expect(w.message.length).toBeGreaterThan(0);
      expect(w.blockRef).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Quality logger tests
// ---------------------------------------------------------------------------

describe("logQualityWarnings", () => {
  const testWarnings: QualityWarning[] = [
    { code: "REVERB_MIX_HIGH", severity: "warn", message: "Reverb Mix is high", blockRef: "Ganymede", actual: 0.80, threshold: 0.60 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes JSON-line to file when LOG_QUALITY=true", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tmpFile = path.join(os.tmpdir(), `quality-test-${Date.now()}.jsonl`);
    const origEnv = process.env.LOG_QUALITY;
    process.env.LOG_QUALITY = "true";
    try {
      logQualityWarnings(testWarnings, { device: "helix_lt", presetName: "Test" }, tmpFile);
      const content = fs.readFileSync(tmpFile, "utf-8");
      const record = JSON.parse(content.trim());
      expect(record.warningCount).toBe(1);
      expect(record.warnings).toHaveLength(1);
      expect(record.device).toBe("helix_lt");
      expect(record.presetName).toBe("Test");
    } finally {
      process.env.LOG_QUALITY = origEnv;
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
  });

  it("does no file I/O when LOG_QUALITY is unset", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tmpFile = path.join(os.tmpdir(), `quality-test-noop-${Date.now()}.jsonl`);
    const origEnv = process.env.LOG_QUALITY;
    delete process.env.LOG_QUALITY;
    try {
      logQualityWarnings(testWarnings, { device: "helix_lt", presetName: "Test" }, tmpFile);
      expect(fs.existsSync(tmpFile)).toBe(false);
    } finally {
      process.env.LOG_QUALITY = origEnv;
    }
  });

  it("always calls console.warn when warnings.length > 0", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const origEnv = process.env.LOG_QUALITY;
    delete process.env.LOG_QUALITY;
    try {
      logQualityWarnings(testWarnings, { device: "helix_lt", presetName: "Test" });
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = warnSpy.mock.calls[0][0] as string;
      expect(msg).toContain("[quality]");
      expect(msg).toContain("helix_lt");
      expect(msg).toContain("REVERB_MIX_HIGH");
    } finally {
      process.env.LOG_QUALITY = origEnv;
    }
  });

  it("does not call console.warn when warnings are empty", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const origEnv = process.env.LOG_QUALITY;
    delete process.env.LOG_QUALITY;
    try {
      logQualityWarnings([], { device: "helix_lt", presetName: "Test" });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      process.env.LOG_QUALITY = origEnv;
    }
  });
});
