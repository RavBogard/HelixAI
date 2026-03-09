// intent-validate.test.ts — Tests for auditIntentFidelity()
// Phase 6, Plan 01: Intent fidelity validation

import { describe, it, expect } from "vitest";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";
import type { ToneIntent } from "./tone-intent";
import { auditIntentFidelity } from "./intent-validate";
import type { IntentAudit } from "./intent-validate";

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
      makeBlock({ type: "amp", modelName: "US Double Nrm" }),
      makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1, parameters: { LowCut: 80.0, HighCut: 7000.0 } }),
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
    effects: [],
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
// Amp fidelity (AC-1)
// ---------------------------------------------------------------------------

describe("auditIntentFidelity", () => {
  describe("amp check", () => {
    it("matches when amp modelName equals intent ampName", () => {
      const intent = makeIntent({ ampName: "US Double Nrm" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.amp.matched).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("Amp"))).toHaveLength(0);
    });

    it("warns on amp mismatch", () => {
      const intent = makeIntent({ ampName: "US Double Nrm" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "Brit P-75 Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.amp.matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Amp mismatch"))).toBe(true);
      expect(audit.warnings.some((w) => w.includes("US Double Nrm"))).toBe(true);
    });

    it("uses case-insensitive comparison", () => {
      const intent = makeIntent({ ampName: "us double nrm" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.amp.matched).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Cab fidelity (AC-1)
  // ---------------------------------------------------------------------------

  describe("cab check", () => {
    it("matches when cab modelName equals intent cabName", () => {
      const intent = makeIntent({ cabName: "4x12 Greenback25" });
      const preset = makePreset();
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.cab.matched).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("Cab"))).toHaveLength(0);
    });

    it("warns on cab mismatch", () => {
      const intent = makeIntent({ cabName: "4x12 Greenback25" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "2x12 Blue Bell", position: 1 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.cab.matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Cab mismatch"))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Effects fidelity (AC-2)
  // ---------------------------------------------------------------------------

  describe("effects check", () => {
    it("matches when all requested effects are present", () => {
      const intent = makeIntent({
        effects: [
          { modelName: "Glitz", role: "ambient" },
          { modelName: "Scream 808", role: "always_on" },
        ],
      });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "reverb", modelName: "Glitz", position: 2 }),
          makeBlock({ type: "distortion", modelName: "Scream 808", position: 3 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.effects).toHaveLength(2);
      expect(audit.effects.every((e) => e.matched)).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("Missing effect"))).toHaveLength(0);
    });

    it("warns when an effect is missing", () => {
      const intent = makeIntent({
        effects: [
          { modelName: "Glitz", role: "ambient" },
          { modelName: "Scream 808", role: "always_on" },
        ],
      });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "reverb", modelName: "Glitz", position: 2 }),
          // No Scream 808
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.effects).toHaveLength(2);
      expect(audit.effects[0].matched).toBe(true);
      expect(audit.effects[1].matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Scream 808"))).toBe(true);
    });

    it("uses case-insensitive comparison for effects", () => {
      const intent = makeIntent({
        effects: [{ modelName: "glitz", role: "ambient" }],
      });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "reverb", modelName: "Glitz", position: 2 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.effects[0].matched).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Tempo fidelity (AC-3)
  // ---------------------------------------------------------------------------

  describe("tempo check", () => {
    it("matches when tempo is within ±1 BPM", () => {
      const intent = makeIntent({ tempoHint: 140 });
      const preset = makePreset({ tempo: 140 });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.tempo.matched).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("Tempo"))).toHaveLength(0);
    });

    it("matches within 1 BPM tolerance", () => {
      const intent = makeIntent({ tempoHint: 140 });
      const preset = makePreset({ tempo: 141 });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.tempo.matched).toBe(true);
    });

    it("warns when tempo differs by >1 BPM", () => {
      const intent = makeIntent({ tempoHint: 140 });
      const preset = makePreset({ tempo: 120 });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.tempo.matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Tempo mismatch"))).toBe(true);
    });

    it("defaults to 120 BPM when tempoHint is undefined", () => {
      const intent = makeIntent({ tempoHint: undefined });
      const preset = makePreset({ tempo: 120 });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.tempo.requested).toBe(120);
      expect(audit.tempo.matched).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Delay subdivision fidelity (AC-3)
  // ---------------------------------------------------------------------------

  describe("delay subdivision check", () => {
    it("reports applied when delay has TempoSync1", () => {
      const intent = makeIntent({ delaySubdivision: "dotted_eighth" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "delay", modelName: "Simple Delay", position: 2, parameters: { TempoSync1: true } }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.delaySubdivision.applied).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("subdivision"))).toHaveLength(0);
    });

    it("warns when delay subdivision requested but no TempoSync1", () => {
      const intent = makeIntent({ delaySubdivision: "dotted_eighth" });
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "delay", modelName: "Simple Delay", position: 2, parameters: { TempoSync1: false } }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.delaySubdivision.applied).toBe(false);
      expect(audit.warnings.some((w) => w.includes("TempoSync1"))).toBe(true);
    });

    it("no warning when no delay subdivision requested", () => {
      const intent = makeIntent({ delaySubdivision: undefined });
      const preset = makePreset();
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.delaySubdivision.requested).toBeNull();
      expect(audit.warnings.filter((w) => w.includes("subdivision"))).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Snapshot count fidelity (AC-4)
  // ---------------------------------------------------------------------------

  describe("snapshot count check", () => {
    it("matches when actual >= requested", () => {
      const intent = makeIntent({
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
          { name: "Ambient", toneRole: "ambient" },
        ],
      });
      const preset = makePreset({
        snapshots: [
          makeSnapshot({ name: "Clean" }),
          makeSnapshot({ name: "Crunch" }),
          makeSnapshot({ name: "Lead" }),
          makeSnapshot({ name: "Ambient" }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.snapshots.matched).toBe(true);
    });

    it("warns when actual < requested", () => {
      const intent = makeIntent({
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
          { name: "Ambient", toneRole: "ambient" },
        ],
      });
      const preset = makePreset({
        snapshots: [
          makeSnapshot({ name: "Clean" }),
          makeSnapshot({ name: "Crunch" }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.snapshots.matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Snapshot count"))).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Full audit shape (AC-5)
  // ---------------------------------------------------------------------------

  describe("full audit shape", () => {
    it("returns correct IntentAudit structure", () => {
      const intent = makeIntent({
        effects: [{ modelName: "Glitz", role: "ambient" }],
        tempoHint: 140,
        delaySubdivision: "dotted_eighth",
      });
      const preset = makePreset({
        tempo: 140,
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "reverb", modelName: "Glitz", position: 2 }),
          makeBlock({ type: "delay", modelName: "Simple Delay", position: 3, parameters: { TempoSync1: true } }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);

      // Shape checks
      expect(audit).toHaveProperty("amp");
      expect(audit).toHaveProperty("cab");
      expect(audit).toHaveProperty("effects");
      expect(audit).toHaveProperty("tempo");
      expect(audit).toHaveProperty("delaySubdivision");
      expect(audit).toHaveProperty("snapshots");
      expect(audit).toHaveProperty("instrument");
      expect(audit).toHaveProperty("warnings");
      expect(Array.isArray(audit.effects)).toBe(true);
      expect(Array.isArray(audit.warnings)).toBe(true);

      // All matched — no warnings
      expect(audit.amp.matched).toBe(true);
      expect(audit.cab.matched).toBe(true);
      expect(audit.tempo.matched).toBe(true);
      expect(audit.delaySubdivision.applied).toBe(true);
      expect(audit.snapshots.matched).toBe(true);
      expect(audit.warnings).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Instrument type fidelity (AC-1 Phase 10)
  // ---------------------------------------------------------------------------

  describe("instrument type check", () => {
    it("matches when bass intent has bass amp", () => {
      const intent = makeIntent({
        instrument: "bass",
        ampName: "SV Beast Nrm",
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "SV Beast Nrm" }),
          makeBlock({ type: "cab", modelName: "8x10 SVT AV", position: 1 }),
          makeBlock({ type: "dynamics", modelName: "Deluxe Comp", position: 2 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.instrument.requested).toBe("bass");
      expect(audit.instrument.matched).toBe(true);
      expect(audit.warnings.filter((w) => w.includes("Instrument"))).toHaveLength(0);
    });

    it("warns when bass intent but guitar amp", () => {
      const intent = makeIntent({
        instrument: "bass",
        ampName: "US Double Nrm",
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "US Double Nrm" }),
          makeBlock({ type: "cab", modelName: "4x12 Greenback25", position: 1 }),
          makeBlock({ type: "dynamics", modelName: "Deluxe Comp", position: 2 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.instrument.matched).toBe(false);
      expect(audit.warnings.some((w) => w.includes("Instrument mismatch"))).toBe(true);
    });

    it("warns when bass intent but no compression", () => {
      const intent = makeIntent({
        instrument: "bass",
        ampName: "SV Beast Nrm",
      } as Partial<ToneIntent>);
      const preset = makePreset({
        signalChain: [
          makeBlock({ type: "amp", modelName: "SV Beast Nrm" }),
          makeBlock({ type: "cab", modelName: "8x10 SVT AV", position: 1 }),
        ],
      });
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.warnings.some((w) => w.includes("compression"))).toBe(true);
    });

    it("always matched for guitar/undefined instrument", () => {
      const intent = makeIntent();
      const preset = makePreset();
      const audit = auditIntentFidelity(intent, preset);
      expect(audit.instrument.requested).toBeUndefined();
      expect(audit.instrument.matched).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-throwing guarantee
  // ---------------------------------------------------------------------------

  describe("non-throwing guarantee", () => {
    it("never throws for any input", () => {
      expect(() =>
        auditIntentFidelity({} as ToneIntent, {} as PresetSpec),
      ).not.toThrow();
    });

    it("returns valid audit for empty inputs", () => {
      const audit = auditIntentFidelity({} as ToneIntent, {} as PresetSpec);
      expect(audit).toHaveProperty("warnings");
      expect(Array.isArray(audit.warnings)).toBe(true);
    });
  });
});
