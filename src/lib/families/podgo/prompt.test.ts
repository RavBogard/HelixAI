// src/lib/families/podgo/prompt.test.ts
// Pod Go family prompt isolation and content tests.
// Verifies 4-slot empowering framing, hard limit enforcement, cross-family isolation.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";

const sampleModelList = "## AMPS\n- TestAmp1\n- TestAmp2\n## CABS\n- TestCab1\n## EFFECTS\n- TestEffect1";

describe("podgo/buildPlannerPrompt", () => {
  const prompt = buildPlannerPrompt("pod_go", sampleModelList);

  it("does NOT contain Agoura_ amp names (cross-family isolation)", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("specifies maxEffects of 4 in ToneIntent fields", () => {
    expect(prompt).toContain("up to 4 effects");
  });

  it("hard-enforces 4-effect limit in device restriction", () => {
    expect(prompt).toContain("hard 4 user-effect limit");
  });

  it("reinforces that 4-slot limit is non-negotiable (no exceptions)", () => {
    // The prompt may use the word "stretch" in a "no stretch configurations" context
    // which is actually reinforcing the hard limit. Verify the constraint is stated clearly.
    expect(prompt).toContain("no exceptions");
    expect(prompt).toContain("hard 4 user-effect limit");
  });

  it("ToneIntent fields section does not offer secondAmpName as a field option", () => {
    // The ToneIntent Fields section should not offer secondAmpName as an optional field.
    // The DEVICE RESTRICTION section may mention it in a "Do NOT populate" context — that's fine.
    const toneIntentSection = prompt.split("## ToneIntent Fields")[1]?.split("## ")[0] ?? "";
    expect(toneIntentSection).not.toContain("secondAmpName");
  });

  it("specifies exactly 4 snapshots", () => {
    expect(prompt).toContain("Exactly 4 snapshots");
  });

  it("contains gain-staging section", () => {
    expect(prompt).toContain("## Gain-Staging Intelligence");
  });

  it("contains amp-to-cab pairing section", () => {
    expect(prompt).toContain("## Amp-to-Cab Pairing");
  });

  it("contains DEVICE RESTRICTION text", () => {
    expect(prompt).toContain("DEVICE RESTRICTION");
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
});

describe("CRAFT-02: genre-intelligent slot planning", () => {
  const prompt = buildPlannerPrompt("pod_go", sampleModelList);

  it("Pod Go prompt specifies exact 4-effect templates per genre", () => {
    expect(prompt).toContain("Choose ALL 4");
    expect(prompt).toContain("exactly 4 effect slots");
  });

  it("Pod Go prompt encourages filling all slots", () => {
    expect(prompt).toContain("unused slot is a wasted slot");
  });

  it("Pod Go prompt still maintains hard 4-effect limit language", () => {
    expect(prompt).toContain("hard 4 user-effect limit");
  });
});

describe("podgo/getSystemPrompt", () => {
  const prompt = getSystemPrompt("pod_go");

  it("contains 4 effect slots empowering framing", () => {
    expect(prompt).toMatch(/4 effect slots|4 slots/);
  });

  it("contains empowering language about constraints", () => {
    expect(prompt).toMatch(/plenty|make every one count|quality over quantity/i);
  });

  it("does NOT contain Agoura_ amp names", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("contains device is already selected instruction", () => {
    expect(prompt).toContain("device is already selected");
  });

  it("does not mention dual-amp support (Pod Go has none)", () => {
    expect(prompt).toContain("NO dual-amp");
  });
});
