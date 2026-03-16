// src/lib/families/helix/prompt.test.ts
// Helix family prompt isolation and content tests.
// Verifies dual-DSP routing, cross-family isolation, and cache identity.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt, HELIX_AMP_CAB_PAIRINGS } from "./prompt";
import { AMP_MODELS } from "@/lib/helix/models";

const sampleModelList = "## AMPS\n- TestAmp1\n- TestAmp2\n## CABS\n- TestCab1\n## EFFECTS\n- TestEffect1";

describe("helix/buildPlannerPrompt", () => {
  const prompt = buildPlannerPrompt("helix_lt", sampleModelList);

  it("contains dual-DSP routing section with DSP0 and DSP1", () => {
    expect(prompt).toContain("DSP0");
    expect(prompt).toContain("DSP1");
  });

  it("contains split block and join block routing instructions", () => {
    expect(prompt.toLowerCase()).toContain("split block");
    expect(prompt.toLowerCase()).toContain("join block");
  });

  it("contains numbered routing steps", () => {
    // The DSP routing section uses numbered steps (1., 2., 3.)
    expect(prompt).toMatch(/1\.\s+\*\*DSP0/);
    expect(prompt).toMatch(/2\.\s+\*\*DSP1/);
  });

  it("does not suggest dual-amp proactively", () => {
    expect(prompt).toContain("ONLY when user explicitly requests");
  });

  it("does NOT contain Agoura_ amp names (cross-family isolation)", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("contains the injected model list", () => {
    expect(prompt).toContain("TestAmp1");
    expect(prompt).toContain("TestCab1");
  });

  it("contains gain-staging intelligence section", () => {
    expect(prompt).toContain("## Gain-Staging Intelligence");
  });

  it("contains amp-to-cab pairing section", () => {
    expect(prompt).toContain("## Amp-to-Cab Pairing");
  });

  it("contains effect discipline by genre section", () => {
    expect(prompt).toContain("## Effect Discipline by Genre");
  });

  it("contains ToneIntent fields with 8 snapshots and secondAmpName", () => {
    expect(prompt).toContain("Exactly 8 snapshots");
    expect(prompt).toContain("secondAmpName");
  });

  it("contains genre-informed effect model selection section", () => {
    expect(prompt).toContain("## Genre-Informed Effect Model Selection");
  });

  it("genre-effect section appears before 'Based on the conversation'", () => {
    const sectionIdx = prompt.indexOf("## Genre-Informed Effect Model Selection");
    const endIdx = prompt.indexOf("Based on the conversation");
    expect(sectionIdx).toBeGreaterThan(-1);
    expect(sectionIdx).toBeLessThan(endIdx);
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

  it("contains Helix-specific dual-DSP layering in effect section", () => {
    expect(prompt).toContain("Layering Opportunities");
    expect(prompt).toContain("dual-DSP");
  });

  it("helix_lt and helix_floor return identical prompt text (single cache entry)", () => {
    const ltPrompt = buildPlannerPrompt("helix_lt", sampleModelList);
    const floorPrompt = buildPlannerPrompt("helix_floor", sampleModelList);
    expect(ltPrompt).toBe(floorPrompt);
  });
});

describe("CRAFT-03: dual-DSP richness", () => {
  const prompt = buildPlannerPrompt("helix_lt", sampleModelList);

  it("Helix prompt encourages 4-6 effects typical (not 2-4)", () => {
    expect(prompt).toContain("4-6");
    expect(prompt).not.toContain("2-4 is typical");
  });

  it("Helix prompt encourages dual-DSP advantage", () => {
    expect(prompt).toMatch(/dual-DSP advantage|Leverage both DSPs/);
  });

  it("Helix prompt says presets should have more effects than constrained devices", () => {
    expect(prompt).toContain("MORE effects than Stomp or Pod Go");
  });
});

describe("helix/getSystemPrompt", () => {
  const prompt = getSystemPrompt("helix_lt");

  it("does NOT contain Agoura_ amp names", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("contains device is already selected instruction", () => {
    expect(prompt).toContain("device is already selected");
  });

  it("does not proactively suggest dual-amp", () => {
    expect(prompt).toContain("Do NOT proactively suggest dual-amp");
  });

  it("contains Helix-specific dual-DSP information", () => {
    expect(prompt).toContain("Dual DSP");
    expect(prompt).toContain("8 snapshots");
  });

  it("contains conciseness directives", () => {
    expect(prompt).toContain("Be concise");
    expect(prompt).toContain("Bold key info");
    expect(prompt).toContain("One question per response");
  });

  it("contains structured READY_TO_GENERATE format", () => {
    expect(prompt).toContain("**Amp Style:**");
    expect(prompt).toContain("**Effects Approach:**");
    expect(prompt).toContain("**Snapshots:**");
  });

  it("helix_lt and helix_floor return identical chat prompt (single cache entry)", () => {
    const ltPrompt = getSystemPrompt("helix_lt");
    const floorPrompt = getSystemPrompt("helix_floor");
    expect(ltPrompt).toBe(floorPrompt);
  });
});

describe("helix/prompt data integrity", () => {
  it("all amp names in HELIX_AMP_CAB_PAIRINGS exist in the model catalog", () => {
    const catalogAmpNames = new Set(Object.keys(AMP_MODELS));
    for (const pairing of HELIX_AMP_CAB_PAIRINGS) {
      for (const amp of pairing.amps) {
        expect(catalogAmpNames.has(amp), `"${amp}" not found in AMP_MODELS catalog`).toBe(true);
      }
    }
  });
});
