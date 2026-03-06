// src/lib/families/stomp/prompt.test.ts
// Stomp family prompt isolation and content tests.
// Verifies trade-off language, STOMP_CONFIG usage, cross-family isolation.

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt, getSystemPrompt } from "./prompt";
import { STOMP_CONFIG } from "@/lib/helix/config";

const sampleModelList = "## AMPS\n- TestAmp1\n- TestAmp2\n## CABS\n- TestCab1\n## EFFECTS\n- TestEffect1";

describe("stomp/buildPlannerPrompt", () => {
  const stompPrompt = buildPlannerPrompt("helix_stomp", sampleModelList);
  const stompXLPrompt = buildPlannerPrompt("helix_stomp_xl", sampleModelList);

  it("does NOT contain Agoura_ amp names (cross-family isolation)", () => {
    expect(stompPrompt).not.toMatch(/Agoura_/);
    expect(stompXLPrompt).not.toMatch(/Agoura_/);
  });

  it("HX Stomp prompt references 3 snapshots", () => {
    expect(stompPrompt).toContain(`Exactly ${STOMP_CONFIG.STOMP_MAX_SNAPSHOTS} snapshots`);
  });

  it("HX Stomp XL prompt references 4 snapshots", () => {
    expect(stompXLPrompt).toContain(`Exactly ${STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS} snapshots`);
  });

  it("contains priority hierarchy language for genre-based over-budget", () => {
    expect(stompPrompt).toContain("drive > delay > mod");
    expect(stompPrompt).toContain("reverb > delay > mod > drive");
  });

  it("HX Stomp prompt references 6 block slots", () => {
    expect(stompPrompt).toContain(`${STOMP_CONFIG.STOMP_MAX_BLOCKS} block slots`);
  });

  it("HX Stomp XL prompt references 9 block slots", () => {
    expect(stompXLPrompt).toContain(`${STOMP_CONFIG.STOMP_XL_MAX_BLOCKS} block slots`);
  });

  it("ToneIntent fields section does not offer secondAmpName as a field option", () => {
    // The ToneIntent Fields section should not offer secondAmpName as an optional field.
    // The DEVICE RESTRICTION section may mention it in a "Do NOT populate" context — that's fine.
    const toneIntentSection = stompPrompt.split("## ToneIntent Fields")[1]?.split("## ")[0] ?? "";
    expect(toneIntentSection).not.toContain("secondAmpName");
  });

  it("contains DEVICE RESTRICTION text", () => {
    expect(stompPrompt).toContain("DEVICE RESTRICTION");
    expect(stompXLPrompt).toContain("DEVICE RESTRICTION");
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
