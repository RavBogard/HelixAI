// src/lib/families/stomp/prompt.test.ts
// Stomp family prompt isolation and content tests.
// Verifies trade-off language, STOMP_CONFIG usage, cross-family isolation.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";
import { buildPlannerPrompt as helixBuildPlannerPrompt } from "../helix/prompt";
import { STOMP_CONFIG } from "@/lib/helix/config";
import { getCapabilities } from "@/lib/helix/device-family";

const sampleModelList = "## AMPS\n- TestAmp1\n- TestAmp2\n## CABS\n- TestCab1\n## EFFECTS\n- TestEffect1";

describe("stomp/buildPlannerPrompt", () => {
  const stompPrompt = buildPlannerPrompt("helix_stomp", sampleModelList);
  const stompXLPrompt = buildPlannerPrompt("helix_stomp_xl", sampleModelList);

  it("helix_stomp and helix_stomp_xl produce identical planner prompt text", () => {
    expect(stompPrompt).toStrictEqual(stompXLPrompt);
  });

  it("contains genre-informed effect model selection section", () => {
    expect(stompPrompt).toContain("## Genre-Informed Effect Model Selection");
  });

  it("contains delay genre table with Transistor Tape", () => {
    expect(stompPrompt).toContain("Transistor Tape");
  });

  it("contains reverb genre table with '63 Spring", () => {
    expect(stompPrompt).toContain("'63 Spring");
  });

  it("contains wah genre table with Fassel", () => {
    expect(stompPrompt).toContain("Fassel");
  });

  it("does NOT contain Agoura_ amp names (cross-family isolation)", () => {
    expect(stompPrompt).not.toMatch(/Agoura_/);
    expect(stompXLPrompt).not.toMatch(/Agoura_/);
  });

  it("unified prompt references STOMP_MAX_SNAPSHOTS (3) in ToneIntent fields", () => {
    expect(stompPrompt).toContain(`Exactly ${STOMP_CONFIG.STOMP_MAX_SNAPSHOTS} snapshots`);
  });

  it("contains priority hierarchy language for genre-based over-budget", () => {
    expect(stompPrompt).toContain("drive > delay > mod");
    expect(stompPrompt).toContain("reverb > delay > mod > drive");
  });

  it("unified prompt references STOMP_MAX_BLOCKS (8) block slots in genre sections", () => {
    expect(stompPrompt).toContain(`${STOMP_CONFIG.STOMP_MAX_BLOCKS} block slots`);
  });

  it("does NOT contain DEVICE RESTRICTION in planner system prompt (moved to user message)", () => {
    expect(stompPrompt).not.toContain("DEVICE RESTRICTION");
    expect(stompXLPrompt).not.toContain("DEVICE RESTRICTION");
  });

  it("ToneIntent fields section does not offer secondAmpName as a field option", () => {
    // The ToneIntent Fields section should not offer secondAmpName as an optional field.
    const toneIntentSection = stompPrompt.split("## ToneIntent Fields")[1]?.split("## ")[0] ?? "";
    expect(toneIntentSection).not.toContain("secondAmpName");
  });
});

describe("stomp/getSystemPrompt", () => {
  const prompt = getSystemPrompt("helix_stomp");

  it("contains trade-off question language", () => {
    expect(prompt).toMatch(/which matters more/i);
  });

  it("contains budget-conscious personality", () => {
    expect(prompt).toMatch(/make every one count|slots count/i);
  });

  it("contains dream-then-trim approach", () => {
    expect(prompt).toContain("Dream First, Then Trim");
  });

  it("does NOT contain Agoura_ amp names", () => {
    expect(prompt).not.toMatch(/Agoura_/);
  });

  it("references device-specific snapshot count", () => {
    expect(prompt).toContain(`${STOMP_CONFIG.STOMP_MAX_SNAPSHOTS} snapshots`);
    const xlPrompt = getSystemPrompt("helix_stomp_xl");
    expect(xlPrompt).toContain(`${STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS} snapshots`);
  });
});

describe("prompt/capability alignment", () => {
  it("Stomp prompt maxEffects (4) does not exceed Stomp maxEffectsPerDsp (4)", () => {
    const stompPrompt = buildPlannerPrompt("helix_stomp", sampleModelList);
    const caps = getCapabilities("helix_stomp");
    // Prompt says "up to 4 effects" via toneIntentFieldsSection
    expect(stompPrompt).toContain("up to 4 effects");
    expect(caps.maxEffectsPerDsp).toBe(4);
  });

  it("Helix prompt maxEffects (8) is finite despite Infinity maxEffectsPerDsp", () => {
    const helixPrompt = helixBuildPlannerPrompt("helix_floor", sampleModelList);
    const caps = getCapabilities("helix_floor");
    // Prompt provides a practical cap of 8, even though chain-rules allows Infinity
    expect(helixPrompt).toContain("up to 8 effects");
    expect(caps.maxEffectsPerDsp).toBe(Infinity);
  });
});
