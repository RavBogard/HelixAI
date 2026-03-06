// src/lib/families/stadium/prompt.test.ts
// Stadium family prompt isolation and content tests.
// Verifies FOH/arena vocabulary, cross-family isolation (no HD2 names).

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";

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

  it("contains TODO(Phase62) placeholder for Agoura cab pairing", () => {
    expect(prompt).toContain("TODO(Phase62)");
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
