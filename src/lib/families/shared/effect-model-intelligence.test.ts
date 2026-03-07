// src/lib/families/shared/effect-model-intelligence.test.ts
// TDD RED: Tests for genre-informed effect model selection prompt section
// and per-model paramOverrides on effect models (INTEL-01 through INTEL-05)

import { describe, it, expect } from "vitest";
import { genreEffectModelSection } from "./effect-model-intelligence";
import { DELAY_MODELS, REVERB_MODELS } from "../../helix/models";

// ============================================================
// INTEL-01/02/03/04: Shared prompt section content
// ============================================================

describe("genreEffectModelSection (INTEL-01/02/03/04)", () => {
  const section = genreEffectModelSection();

  it("returns a string containing the section heading", () => {
    expect(section).toContain("## Genre-Informed Effect Model Selection");
  });

  it("contains delay genre table with Transistor Tape for Blues", () => {
    expect(section).toContain("Transistor Tape");
    expect(section).toContain("Blues");
  });

  it("contains reverb genre table with '63 Spring for Country", () => {
    expect(section).toContain("'63 Spring");
    expect(section).toContain("Country");
  });

  it("contains wah genre table with Fassel for Funk", () => {
    expect(section).toContain("Fassel");
    expect(section).toContain("Funk");
  });

  it("contains Avoid column entries (e.g., Heliosphere avoided for Blues delay)", () => {
    expect(section).toContain("Heliosphere");
    // The table should have an Avoid column with entries
    expect(section).toContain("Avoid");
  });
});

// ============================================================
// INTEL-05: paramOverrides on effect models
// ============================================================

describe("INTEL-05: effect model paramOverrides", () => {
  // Reverb models — Mix overrides
  it("Ganymede has paramOverrides.Mix === 0.25", () => {
    expect(REVERB_MODELS["Ganymede"].paramOverrides).toBeDefined();
    expect(REVERB_MODELS["Ganymede"].paramOverrides!.Mix).toBe(0.25);
  });

  it("Glitz has paramOverrides.Mix === 0.22", () => {
    expect(REVERB_MODELS["Glitz"].paramOverrides).toBeDefined();
    expect(REVERB_MODELS["Glitz"].paramOverrides!.Mix).toBe(0.22);
  });

  it("Octo has paramOverrides.Mix === 0.22", () => {
    expect(REVERB_MODELS["Octo"].paramOverrides).toBeDefined();
    expect(REVERB_MODELS["Octo"].paramOverrides!.Mix).toBe(0.22);
  });

  it("Plateaux has paramOverrides.Mix === 0.22", () => {
    expect(REVERB_MODELS["Plateaux"].paramOverrides).toBeDefined();
    expect(REVERB_MODELS["Plateaux"].paramOverrides!.Mix).toBe(0.22);
  });

  // Delay models — Feedback overrides
  it("Heliosphere has paramOverrides.Feedback === 0.28", () => {
    expect(DELAY_MODELS["Heliosphere"].paramOverrides).toBeDefined();
    expect(DELAY_MODELS["Heliosphere"].paramOverrides!.Feedback).toBe(0.28);
  });

  it("Cosmos Echo has paramOverrides.Feedback === 0.28", () => {
    expect(DELAY_MODELS["Cosmos Echo"].paramOverrides).toBeDefined();
    expect(DELAY_MODELS["Cosmos Echo"].paramOverrides!.Feedback).toBe(0.28);
  });

  it("Adriatic Swell has paramOverrides.Feedback === 0.28", () => {
    expect(DELAY_MODELS["Adriatic Swell"].paramOverrides).toBeDefined();
    expect(DELAY_MODELS["Adriatic Swell"].paramOverrides!.Feedback).toBe(0.28);
  });
});
