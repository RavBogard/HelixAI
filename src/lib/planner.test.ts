// src/lib/planner.test.ts
// Unit tests for per-family planner prompt enrichment sections.
// Updated for Phase 65: tests now use getFamilyPlannerPrompt() from the prompt router
// instead of the deleted monolithic buildPlannerPrompt().
//
// PROMPT-01: Gain-Staging Intelligence
// PROMPT-02: Amp-to-Cab Pairing
// PROMPT-03: Effect Discipline by Genre
// PROMPT-04: Shared prefix ordering (cache-safety)

import { describe, it, expect } from "vitest";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";
import { getModelListForPrompt } from "@/lib/helix";
import { getCapabilities } from "@/lib/helix";

describe("getFamilyPlannerPrompt (helix)", () => {
  const modelList = getModelListForPrompt(getCapabilities("helix_lt"));
  const prompt = getFamilyPlannerPrompt("helix_lt", modelList);

  describe("enrichment sections", () => {
    // PROMPT-01: Gain-Staging Intelligence
    it("Test 1: contains gain-staging intelligence section heading", () => {
      expect(prompt).toContain("## Gain-Staging Intelligence");
    });

    it("Test 2: gain-staging section mentions both Minotaur and Scream 808 boost pedals", () => {
      expect(prompt).toContain("Minotaur");
      expect(prompt).toContain("Scream 808");
    });

    it("Test 3: gain-staging section distinguishes non-master-volume amps", () => {
      expect(prompt).toContain("non-master-volume");
    });

    // PROMPT-02: Amp-to-Cab Pairing
    it("Test 4: contains amp-to-cab pairing section heading", () => {
      expect(prompt).toContain("## Amp-to-Cab Pairing");
    });

    it("Test 5: cab pairing section contains canonical cab names — 2x12 Blue Bell (Vox) and 4x12 Cali V30 (Mesa)", () => {
      expect(prompt).toContain("2x12 Blue Bell");
      expect(prompt).toContain("4x12 Cali V30");
    });

    // PROMPT-03: Effect Discipline by Genre
    it("Test 6: contains effect discipline by genre section heading", () => {
      expect(prompt).toContain("## Effect Discipline by Genre");
    });

    it("Test 7: effect discipline section explicitly requires reverb AND delay for ambient/worship tones", () => {
      const lowerPrompt = prompt.toLowerCase();
      expect(lowerPrompt).toContain("ambient");
      expect(lowerPrompt).toContain("reverb");
      expect(lowerPrompt).toContain("delay");
      const ambientIdx = lowerPrompt.indexOf("ambient");
      expect(ambientIdx).toBeGreaterThan(-1);
      const afterAmbient = lowerPrompt.slice(ambientIdx);
      expect(afterAmbient).toMatch(/reverb/);
      expect(afterAmbient).toMatch(/delay/);
    });

    it("Test 8: metal guidance constrains effect count", () => {
      const lowerPrompt = prompt.toLowerCase();
      expect(lowerPrompt).toContain("metal");
      expect(lowerPrompt).toMatch(/metal[^.]*(?:\d\s*effects?|maximum)/i);
    });
  });

  describe("cache safety", () => {
    it("Test 9: enrichment sections appear BEFORE 'Based on the conversation'", () => {
      const gainIdx = prompt.indexOf("## Gain-Staging Intelligence");
      const cabIdx = prompt.indexOf("## Amp-to-Cab Pairing");
      const effectIdx = prompt.indexOf("## Effect Discipline by Genre");
      const basedOnIdx = prompt.indexOf("Based on the conversation");

      expect(gainIdx).toBeGreaterThan(-1);
      expect(cabIdx).toBeGreaterThan(-1);
      expect(effectIdx).toBeGreaterThan(-1);
      expect(basedOnIdx).toBeGreaterThan(-1);

      expect(gainIdx).toBeLessThan(basedOnIdx);
      expect(cabIdx).toBeLessThan(basedOnIdx);
      expect(effectIdx).toBeLessThan(basedOnIdx);
    });

    it("Test 10: Pod Go prompt contains enrichment sections before DEVICE RESTRICTION", () => {
      const podGoModelList = getModelListForPrompt(getCapabilities("pod_go"));
      const podGoPrompt = getFamilyPlannerPrompt("pod_go", podGoModelList);

      expect(podGoPrompt).toContain("## Gain-Staging Intelligence");
      expect(podGoPrompt).toContain("## Amp-to-Cab Pairing");
      expect(podGoPrompt).toContain("## Effect Discipline by Genre");

      const gainIdx = podGoPrompt.indexOf("## Gain-Staging Intelligence");
      const deviceIdx = podGoPrompt.indexOf("DEVICE RESTRICTION");
      expect(gainIdx).toBeGreaterThan(-1);
      expect(deviceIdx).toBeGreaterThan(-1);
      expect(gainIdx).toBeLessThan(deviceIdx);
    });
  });
});
