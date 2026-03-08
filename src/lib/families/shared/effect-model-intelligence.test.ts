// src/lib/families/shared/effect-model-intelligence.test.ts
// Tests for genre-informed effect model selection prompt section
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

  it("defaults to helix variant (contains Avoid column)", () => {
    expect(section).toContain("Avoid");
  });
});

// ============================================================
// Per-family variants produce distinct content
// ============================================================

describe("genreEffectModelSection per-family variants", () => {
  const helix = genreEffectModelSection("helix");
  const stomp = genreEffectModelSection("stomp");
  const podgo = genreEffectModelSection("podgo");
  const stadium = genreEffectModelSection("stadium");

  it("all four families produce different output", () => {
    expect(helix).not.toBe(stomp);
    expect(stomp).not.toBe(podgo);
    expect(podgo).not.toBe(stadium);
    expect(helix).not.toBe(stadium);
  });

  // Helix: dual-DSP layering
  it("helix variant mentions dual-DSP and layering", () => {
    expect(helix).toContain("dual-DSP");
    expect(helix).toContain("DSP1");
    expect(helix).toContain("Layering Opportunities");
  });

  it("helix variant contains Avoid column", () => {
    expect(helix).toContain("Avoid");
  });

  // Stomp: priority-based
  it("stomp variant contains Priority column", () => {
    expect(stomp).toContain("Priority");
    expect(stomp).toContain("Priority 1");
  });

  it("stomp variant contains budget guidance", () => {
    expect(stomp).toContain("Budget Guidance");
    expect(stomp).toContain("Drop order");
  });

  // Pod Go: 4-slot templates
  it("podgo variant contains 4-slot templates", () => {
    expect(podgo).toContain("4-Slot");
    expect(podgo).toContain("Slot 1");
    expect(podgo).toContain("Swap Option");
  });

  it("podgo variant enforces filling all slots", () => {
    expect(podgo).toContain("Choose ALL 4");
    expect(podgo).toContain("unused slot");
  });

  // Stadium: arena/FOH context
  it("stadium variant contains arena and FOH context", () => {
    expect(stadium).toContain("arena");
    expect(stadium).toContain("FOH");
    expect(stadium).toContain("Arena Caution");
  });

  it("stadium variant mentions headroom", () => {
    expect(stadium).toContain("headroom");
  });

  // All families contain core model names
  it.each(["helix", "stomp", "podgo", "stadium"] as const)(
    "%s variant contains Transistor Tape, Plate, and Fassel",
    (family) => {
      const section = genreEffectModelSection(family);
      expect(section).toContain("Transistor Tape");
      expect(section).toContain("Plate");
      expect(section).toContain("Fassel");
    },
  );
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
