// src/lib/families/podgo/prompt.test.ts
// Pod Go family prompt isolation and content tests.
// Verifies 4-slot empowering framing, hard limit enforcement, cross-family isolation.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt, PODGO_AMP_CAB_PAIRINGS } from "./prompt";
import { AMP_MODELS } from "@/lib/helix/models";

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

  it("contains Pod Go 4-Slot effect templates", () => {
    expect(prompt).toContain("4-Slot");
    expect(prompt).toContain("Swap Option");
  });

  it("enforces filling all 4 slots", () => {
    expect(prompt).toContain("Choose ALL 4");
    expect(prompt).toContain("unused slot");
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
    expect(prompt).toMatch(/plenty|every effect earns|make every one count|quality over quantity|focused preset/i);
  });

  it("does NOT contain Agoura_ amp names", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("contains device is already selected instruction", () => {
    expect(prompt).toContain("device is already selected");
  });

  it("does not mention dual-amp support (Pod Go has none)", () => {
    expect(prompt).toMatch(/no dual-amp|NO dual-amp|no dual.amp/i);
  });

  it("contains conciseness directives", () => {
    expect(prompt).toContain("Be concise");
    expect(prompt).toContain("Bold key info");
    expect(prompt).toContain("One question per response");
  });

  it("contains structured READY_TO_GENERATE format", () => {
    expect(prompt).toContain("**Amp:**");
    expect(prompt).toContain("**Effects:**");
    expect(prompt).toContain("**Snapshots:**");
  });
});

describe("podgo/prompt data integrity", () => {
  it("all amp names in PODGO_AMP_CAB_PAIRINGS exist in the model catalog", () => {
    const catalogAmpNames = new Set(Object.keys(AMP_MODELS));
    for (const pairing of PODGO_AMP_CAB_PAIRINGS) {
      for (const amp of pairing.amps) {
        expect(catalogAmpNames.has(amp), `"${amp}" not found in AMP_MODELS catalog`).toBe(true);
      }
    }
  });
});
