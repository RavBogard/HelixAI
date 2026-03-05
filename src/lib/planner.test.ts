// src/lib/planner.test.ts
// Unit tests for buildPlannerPrompt() enrichment sections.
// PROMPT-01: Gain-Staging Intelligence
// PROMPT-02: Amp-to-Cab Pairing
// PROMPT-03: Effect Discipline by Genre
// PROMPT-04: Shared prefix ordering (cache-safety)

import { describe, it, expect } from "vitest";
import { buildPlannerPrompt } from "./planner";
import { getModelListForPrompt } from "@/lib/helix";

describe("buildPlannerPrompt", () => {
  const modelList = getModelListForPrompt();
  const prompt = buildPlannerPrompt(modelList);

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
      // Canonical names verified against CAB_MODELS in src/lib/helix/models.ts
      expect(prompt).toContain("2x12 Blue Bell");  // Vox AC30 2x12 Blue
      expect(prompt).toContain("4x12 Cali V30");   // Mesa 4x12 Vintage 30
    });

    // PROMPT-03: Effect Discipline by Genre
    it("Test 6: contains effect discipline by genre section heading", () => {
      expect(prompt).toContain("## Effect Discipline by Genre");
    });

    it("Test 7: effect discipline section explicitly requires reverb AND delay for ambient/worship tones", () => {
      // Section must mention ambient and require both reverb and delay
      expect(prompt.toLowerCase()).toContain("ambient");
      expect(prompt.toLowerCase()).toContain("reverb");
      expect(prompt.toLowerCase()).toContain("delay");
      // Confirm ambient section mandates both time-based effects
      const lowerPrompt = prompt.toLowerCase();
      const ambientIdx = lowerPrompt.indexOf("ambient");
      expect(ambientIdx).toBeGreaterThan(-1);
      // After the ambient mention there must be both reverb and delay guidance
      const afterAmbient = lowerPrompt.slice(ambientIdx);
      expect(afterAmbient).toMatch(/reverb/);
      expect(afterAmbient).toMatch(/delay/);
    });

    it("Test 8: metal guidance constrains effect count (mentions a maximum number for metal)", () => {
      const lowerPrompt = prompt.toLowerCase();
      // Must contain metal guidance with either a number + effects mention or maximum keyword
      expect(lowerPrompt).toContain("metal");
      expect(lowerPrompt).toMatch(/metal[^.]*(?:\d\s*effects?|maximum)/i);
    });
  });

  describe("cache safety", () => {
    it("Test 9: all three enrichment sections appear BEFORE device-conditional DEVICE RESTRICTION text", () => {
      const gainIdx = prompt.indexOf("## Gain-Staging Intelligence");
      const cabIdx = prompt.indexOf("## Amp-to-Cab Pairing");
      const effectIdx = prompt.indexOf("## Effect Discipline by Genre");

      // All sections must be present
      expect(gainIdx).toBeGreaterThan(-1);
      expect(cabIdx).toBeGreaterThan(-1);
      expect(effectIdx).toBeGreaterThan(-1);

      // For default (non-device-specific) prompt: DEVICE RESTRICTION may not appear
      // The test verifies that if it does appear, enrichment sections come first
      const deviceIdx = prompt.indexOf("DEVICE RESTRICTION");
      if (deviceIdx !== -1) {
        expect(gainIdx).toBeLessThan(deviceIdx);
        expect(cabIdx).toBeLessThan(deviceIdx);
        expect(effectIdx).toBeLessThan(deviceIdx);
      }
    });

    it("Test 10: Pod Go prompt contains all three enrichment sections (same shared static prefix)", () => {
      const podGoModelList = getModelListForPrompt("pod_go");
      const podGoPrompt = buildPlannerPrompt(podGoModelList, "pod_go");

      expect(podGoPrompt).toContain("## Gain-Staging Intelligence");
      expect(podGoPrompt).toContain("## Amp-to-Cab Pairing");
      expect(podGoPrompt).toContain("## Effect Discipline by Genre");

      // Pod Go prompt must have enrichment sections before the DEVICE RESTRICTION block
      const gainIdx = podGoPrompt.indexOf("## Gain-Staging Intelligence");
      const deviceIdx = podGoPrompt.indexOf("DEVICE RESTRICTION");
      expect(gainIdx).toBeGreaterThan(-1);
      expect(deviceIdx).toBeGreaterThan(-1);
      expect(gainIdx).toBeLessThan(deviceIdx);
    });
  });
});
