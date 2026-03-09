// musical-validate.test.ts — Tests for musical intelligence validation.
// Phase 10, Plan 01: rule-based genre/instrument musical sense checks.

import { describe, it, expect } from "vitest";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import type { ToneIntent } from "./tone-intent";
import { validateMusicalIntelligence } from "./musical-validate";

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
      makeBlock({ type: "amp", modelName: "US Double Nrm", parameters: { Drive: 0.35 } }),
      makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
    ],
    snapshots: [
      makeSnapshot({ name: "Clean" }),
      makeSnapshot({ name: "Crunch" }),
      makeSnapshot({ name: "Lead" }),
      makeSnapshot({ name: "Ambient" }),
    ],
    ...overrides,
  };
}

function makeIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "US Double Nrm",
    cabName: "4x12 Greenback25",
    guitarType: "humbucker",
    effects: [
      { modelName: "Simple Delay", role: "toggleable" },
      { modelName: "Plate", role: "always_on" },
    ],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Crunch", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  } as ToneIntent;
}

// ---------------------------------------------------------------------------
// Rule 1: Genre-effect mismatch
// ---------------------------------------------------------------------------

describe("validateMusicalIntelligence", () => {
  describe("genre-effect rules", () => {
    it("warns on chorus with metal genre", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Placater Dirty", parameters: { Drive: 0.55 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
          makeBlock({ type: "modulation", modelName: "70s Chorus", position: 2 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "GENRE_EFFECT_MISMATCH" && w.message.includes("Chorus"))).toBe(true);
      expect(audit.passed).toBe(false);
    });

    it("no warning for delay/reverb with metal genre", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Placater Dirty", parameters: { Drive: 0.55 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
          makeBlock({ type: "delay", modelName: "Simple Delay", position: 2 }),
          makeBlock({ type: "reverb", modelName: "Room", position: 3 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "GENRE_EFFECT_MISMATCH")).toHaveLength(0);
    });

    it("warns on ambient preset without time effects", () => {
      const intent = makeIntent({
        genreHint: "ambient",
        effects: [],
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Ambient", toneRole: "ambient" },
        ],
      });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", modelName: "1x12 US Deluxe", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "GENRE_EFFECT_MISMATCH" && w.message.includes("time-based"))).toBe(true);
    });

    it("no warning for ambient preset with delay and reverb", () => {
      const intent = makeIntent({ genreHint: "ambient" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm", parameters: { Drive: 0.25 } }),
          makeBlock({ type: "cab", modelName: "1x12 US Deluxe", position: 1 }),
          makeBlock({ type: "delay", modelName: "Elephant Man", position: 2 }),
          makeBlock({ type: "reverb", modelName: "Ganymede", position: 3 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "GENRE_EFFECT_MISMATCH")).toHaveLength(0);
    });

    it("info warning for flanger with high-gain", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Placater Dirty", parameters: { Drive: 0.55 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
          makeBlock({ type: "modulation", modelName: "Courtesan Flanger", position: 2 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      const flangerWarning = audit.warnings.find((w) => w.message.includes("Flanger"));
      expect(flangerWarning).toBeDefined();
      expect(flangerWarning!.severity).toBe("info");
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 2: Bass compression
  // ---------------------------------------------------------------------------

  describe("bass compression", () => {
    it("warns when bass preset has no dynamics block", () => {
      const intent = makeIntent({
        instrument: "bass",
        effects: [],
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "SV Beast Nrm", parameters: { Drive: 0.35 } }),
          makeBlock({ type: "cab", modelName: "8x10 SVT AV", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "BASS_NO_COMPRESSION")).toBe(true);
      expect(audit.passed).toBe(false);
    });

    it("no warning when bass preset has dynamics block", () => {
      const intent = makeIntent({
        instrument: "bass",
        effects: [{ modelName: "Deluxe Comp", role: "always_on" }],
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "SV Beast Nrm", parameters: { Drive: 0.35 } }),
          makeBlock({ type: "cab", modelName: "8x10 SVT AV", position: 1 }),
          makeBlock({ type: "dynamics", modelName: "Deluxe Comp", position: 2 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "BASS_NO_COMPRESSION")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 3: Gain staging
  // ---------------------------------------------------------------------------

  describe("gain staging", () => {
    it("warns when clean tone has high drive (standard MV amp)", () => {
      const intent = makeIntent({ genreHint: "pop" });
      const preset = makePreset({
        signalChain: [
          // Placater Clean is a master-volume amp — Drive controls gain, threshold 0.50
          makeBlock({ type: "amp", modelName: "Placater Clean", parameters: { Drive: 0.65 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "GAIN_STAGING_MISMATCH" && w.severity === "warn")).toBe(true);
    });

    it("no warning for non-MV amp with moderate drive (Drive=volume control)", () => {
      const intent = makeIntent({ genreHint: "pop" });
      const preset = makePreset({
        signalChain: [
          // US Deluxe Nrm is non-MV — Master always 1.0, Drive controls volume not gain
          makeBlock({ type: "amp", modelName: "US Deluxe Nrm", parameters: { Drive: 0.60 } }),
          makeBlock({ type: "cab", modelName: "1x12 US Deluxe", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "GAIN_STAGING_MISMATCH")).toHaveLength(0);
    });

    it("no warning when clean tone has low drive", () => {
      const intent = makeIntent({ genreHint: "pop" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm", parameters: { Drive: 0.30 } }),
          makeBlock({ type: "cab", modelName: "1x12 US Deluxe", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "GAIN_STAGING_MISMATCH")).toHaveLength(0);
    });

    it("info when high-gain has very low drive", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Placater Dirty", parameters: { Drive: 0.20 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      const gainWarning = audit.warnings.find((w) => w.code === "GAIN_STAGING_MISMATCH");
      expect(gainWarning).toBeDefined();
      expect(gainWarning!.severity).toBe("info");
    });

    it("no warning for high-gain with normal drive", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Placater Dirty", parameters: { Drive: 0.55 } }),
          makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 1 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "GAIN_STAGING_MISMATCH")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 4: Snapshot role coverage
  // ---------------------------------------------------------------------------

  describe("snapshot role coverage", () => {
    it("warns when high-gain preset has no lead snapshot", () => {
      const intent = makeIntent({
        genreHint: "metal",
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Ambient", toneRole: "ambient" },
        ],
      });
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "SNAPSHOT_ROLE_MISSING" && w.message.includes("lead"))).toBe(true);
    });

    it("no warning when high-gain preset has lead snapshot", () => {
      const intent = makeIntent({ genreHint: "metal" });
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "SNAPSHOT_ROLE_MISSING")).toHaveLength(0);
    });

    it("warns when ambient preset has no ambient snapshot", () => {
      const intent = makeIntent({
        genreHint: "ambient",
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
        ],
      });
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "SNAPSHOT_ROLE_MISSING" && w.message.includes("ambient"))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Rule 5: Effect count sanity
  // ---------------------------------------------------------------------------

  describe("effect count sanity", () => {
    it("info when no effects requested", () => {
      const intent = makeIntent({ effects: [] });
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.some((w) => w.code === "NO_EFFECTS_REQUESTED")).toBe(true);
      expect(audit.warnings.find((w) => w.code === "NO_EFFECTS_REQUESTED")!.severity).toBe("info");
    });

    it("no warning when effects present", () => {
      const intent = makeIntent();
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.warnings.filter((w) => w.code === "NO_EFFECTS_REQUESTED")).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // passed flag
  // ---------------------------------------------------------------------------

  describe("passed flag", () => {
    it("passed=true when only info warnings", () => {
      const intent = makeIntent({ effects: [] }); // triggers NO_EFFECTS_REQUESTED (info)
      const preset = makePreset();
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.passed).toBe(true); // info doesn't fail
    });

    it("passed=false when warn-level warnings exist", () => {
      const intent = makeIntent({
        instrument: "bass",
        effects: [],
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "SV Beast Nrm", parameters: { Drive: 0.35 } }),
          makeBlock({ type: "cab", modelName: "8x10 SVT AV", position: 1 }),
          // No dynamics — triggers BASS_NO_COMPRESSION warn
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      expect(audit.passed).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-throwing guarantee
  // ---------------------------------------------------------------------------

  describe("non-throwing guarantee", () => {
    it("never throws for any input", () => {
      expect(() =>
        validateMusicalIntelligence({} as ToneIntent, {} as PresetSpec),
      ).not.toThrow();
    });

    it("returns valid audit for empty inputs", () => {
      const audit = validateMusicalIntelligence({} as ToneIntent, {} as PresetSpec);
      expect(audit).toHaveProperty("warnings");
      expect(audit).toHaveProperty("passed");
      expect(Array.isArray(audit.warnings)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Unknown genre skips genre rules
  // ---------------------------------------------------------------------------

  describe("unknown genre", () => {
    it("skips genre rules when genreHint is unknown", () => {
      const intent = makeIntent({ genreHint: "experimental" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm", parameters: { Drive: 0.80 } }),
          makeBlock({ type: "cab", modelName: "1x12 US Deluxe", position: 1 }),
          makeBlock({ type: "modulation", modelName: "70s Chorus", position: 2 }),
        ],
      });
      const audit = validateMusicalIntelligence(intent, preset);
      // No genre-specific warnings for unknown genre
      expect(audit.warnings.filter((w) => w.code === "GENRE_EFFECT_MISMATCH")).toHaveLength(0);
      expect(audit.warnings.filter((w) => w.code === "GAIN_STAGING_MISMATCH")).toHaveLength(0);
    });
  });
});
