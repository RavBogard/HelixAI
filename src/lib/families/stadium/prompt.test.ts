// src/lib/families/stadium/prompt.test.ts
// Stadium family prompt isolation and content tests.
// Verifies FOH/arena vocabulary, cross-family isolation (no HD2 names).

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";
import { STADIUM_AMPS, CAB_MODELS } from "../../../lib/helix/models";

const sampleModelList = "## AMPS\n- Agoura_TestAmp1\n## CABS\n- Stadium_TestCab1\n## EFFECTS\n- TestEffect1";

describe("stadium/buildPlannerPrompt", () => {
  const prompt = buildPlannerPrompt("helix_stadium", sampleModelList);

  it("does NOT contain Placater (HD2 amp name — cross-family isolation)", () => {
    expect(prompt).not.toContain("Placater");
  });

  it("does NOT contain Derailed (HD2 amp name — cross-family isolation)", () => {
    expect(prompt).not.toContain("Derailed");
  });

  it("does NOT contain Litigator (HD2 amp name — cross-family isolation)", () => {
    expect(prompt).not.toContain("Litigator");
  });

  it("does NOT contain TODO(Phase62) placeholder", () => {
    expect(prompt).not.toContain("TODO(Phase62)");
  });

  it("contains real amp-cab pairing content", () => {
    expect(prompt).toContain("Agoura Brit Plexi");
    expect(prompt).toContain("4x12 Greenback25");
  });

  it("contains Amp-to-Cab Pairing section heading", () => {
    expect(prompt).toContain("Amp-to-Cab Pairing");
  });

  it("contains Stadium-specific features section", () => {
    expect(prompt).toContain("7-band Parametric EQ");
  });

  it("specifies 8 snapshots", () => {
    expect(prompt).toContain("Exactly 8 snapshots");
  });

  it("contains the injected model list", () => {
    expect(prompt).toContain("Agoura_TestAmp1");
  });

  it("contains gain-staging section", () => {
    expect(prompt).toContain("## Gain-Staging Intelligence");
  });

  it("contains genre-informed effect model selection section", () => {
    expect(prompt).toContain("## Genre-Informed Effect Model Selection");
  });

  it("contains delay genre table with Transistor Tape", () => {
    expect(prompt).toContain("Transistor Tape");
  });

  it("contains reverb genre table with '63 Spring", () => {
    expect(prompt).toContain("'63 Spring");
  });

  it("contains wah genre table with Fassel", () => {
    expect(prompt).toContain("Fassel");
  });

  it("contains Stadium-specific arena/FOH context in effect section", () => {
    expect(prompt).toContain("Arena Caution");
    expect(prompt).toContain("headroom");
  });

  it("contains FOH translation tips", () => {
    expect(prompt).toContain("FOH Translation Tips");
  });
});

describe("stadium/buildPlannerPrompt - cabAffinity data integrity", () => {
  it("every cabAffinity entry in STADIUM_AMPS is a valid key in CAB_MODELS", () => {
    for (const [ampName, model] of Object.entries(STADIUM_AMPS)) {
      if (model.cabAffinity && model.cabAffinity.length > 0) {
        for (const cabName of model.cabAffinity) {
          expect(
            cabName in CAB_MODELS,
            `Amp "${ampName}" references cab "${cabName}" which is not a key in CAB_MODELS`
          ).toBe(true);
        }
      }
    }
  });
});

describe("stadium/getSystemPrompt", () => {
  const prompt = getSystemPrompt("helix_stadium");

  it("contains FOH or Front of House vocabulary", () => {
    expect(prompt).toMatch(/FOH|Front of House/);
  });

  it("contains arena or live sound vocabulary", () => {
    expect(prompt).toMatch(/arena|live sound|stage volume/i);
  });

  it("contains monitor mix references", () => {
    expect(prompt).toMatch(/monitor/i);
  });

  it("does NOT contain Placater (HD2 amp name)", () => {
    expect(prompt).not.toContain("Placater");
  });

  it("does NOT contain Derailed (HD2 amp name)", () => {
    expect(prompt).not.toContain("Derailed");
  });

  it("does NOT contain Litigator (HD2 amp name)", () => {
    expect(prompt).not.toContain("Litigator");
  });

  it("contains device is already selected instruction", () => {
    expect(prompt).toContain("device is already selected");
  });

  it("references Stadium-specific features", () => {
    expect(prompt).toContain("7-band Parametric EQ");
  });
});
