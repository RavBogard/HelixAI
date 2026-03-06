// src/lib/families/helix/prompt.test.ts
// Helix family prompt isolation and content tests.
// Verifies dual-DSP routing, cross-family isolation, and cache identity.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";

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

  it("helix_lt and helix_floor return identical prompt text (single cache entry)", () => {
    const ltPrompt = buildPlannerPrompt("helix_lt", sampleModelList);
    const floorPrompt = buildPlannerPrompt("helix_floor", sampleModelList);
    expect(ltPrompt).toBe(floorPrompt);
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

  it("helix_lt and helix_floor return identical chat prompt (single cache entry)", () => {
    const ltPrompt = getSystemPrompt("helix_lt");
    const floorPrompt = getSystemPrompt("helix_floor");
    expect(ltPrompt).toBe(floorPrompt);
  });
});
