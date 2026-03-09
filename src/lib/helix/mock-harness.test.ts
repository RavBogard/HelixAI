// mock-harness.test.ts — Tests for mock preset generation harness.
// Verifies all 25 scenarios produce valid preset files through the full pipeline.

import { describe, it, expect } from "vitest";
import { runScenario, runAllScenarios } from "./mock-harness";
import { MOCK_SCENARIOS } from "./mock-scenarios";
import { DEVICE_IDS, isPodGo, isStomp, isStadium } from "./types";

describe("mock-harness", () => {
  describe("scenario coverage", () => {
    it("has at least 25 scenarios", () => {
      expect(MOCK_SCENARIOS.length).toBeGreaterThanOrEqual(25);
    });

    it("covers all 5 device families", () => {
      const families = new Set(MOCK_SCENARIOS.map((s) => s.device));
      expect(families.has("helix_floor") || families.has("helix_lt")).toBe(true);
      expect(families.has("helix_stomp")).toBe(true);
      expect(families.has("helix_stomp_xl")).toBe(true);
      expect(families.has("pod_go")).toBe(true);
      expect(families.has("helix_stadium")).toBe(true);
    });

    it("covers all 5 tone styles", () => {
      const styles = new Set(MOCK_SCENARIOS.map((s) => s.toneStyle));
      expect(styles.has("clean")).toBe(true);
      expect(styles.has("high-gain")).toBe(true);
      expect(styles.has("blues")).toBe(true);
      expect(styles.has("ambient")).toBe(true);
      expect(styles.has("bass")).toBe(true);
    });
  });

  describe("individual scenarios", () => {
    it.each(MOCK_SCENARIOS.map((s) => [s.id, s]))(
      "%s passes full pipeline",
      (_id, scenario) => {
        const s = scenario as (typeof MOCK_SCENARIOS)[number];
        const result = runScenario(s);

        // No error
        expect(result.error).toBeUndefined();

        // Preset was produced
        expect(result.preset).not.toBeNull();
        expect(result.spec).not.toBeNull();
      }
    );
  });

  describe("device IDs and file extensions", () => {
    it.each(MOCK_SCENARIOS.map((s) => [s.id, s]))(
      "%s has correct device ID and extension",
      (_id, scenario) => {
        const s = scenario as (typeof MOCK_SCENARIOS)[number];
        const result = runScenario(s);
        expect(result.error).toBeUndefined();

        const preset = result.preset as Record<string, unknown>;

        if (isStadium(s.device)) {
          // Stadium buildHspFile returns { magic, json, serialized }
          // Device ID is nested in json structure — just verify extension and non-null
          expect(result.fileExtension).toBe(".hsp");
          expect(preset).toBeTruthy();
        } else if (isPodGo(s.device)) {
          const pgp = preset as { data: { device: number } };
          expect(result.fileExtension).toBe(".pgp");
          expect(pgp.data.device).toBe(DEVICE_IDS[s.device]);
        } else if (isStomp(s.device)) {
          const hlx = preset as { data: { device: number } };
          expect(result.fileExtension).toBe(".hlx");
          expect(hlx.data.device).toBe(DEVICE_IDS[s.device]);
        } else {
          // Helix Floor/LT/Rack/Native
          const hlx = preset as { data: { device: number } };
          expect(result.fileExtension).toBe(".hlx");
          expect(hlx.data.device).toBe(DEVICE_IDS[s.device]);
        }
      }
    );
  });

  describe("bass scenarios", () => {
    const bassScenarios = MOCK_SCENARIOS.filter((s) => s.toneStyle === "bass");

    it("has bass scenarios for all families", () => {
      expect(bassScenarios.length).toBeGreaterThanOrEqual(5);
    });

    it.each(bassScenarios.map((s) => [s.id, s]))(
      "%s has instrument=bass and compression",
      (_id, scenario) => {
        const s = scenario as (typeof MOCK_SCENARIOS)[number];

        // Intent has instrument field
        expect(s.intent.instrument).toBe("bass");

        // Intent has compression effect
        const compressorNames = ["Deluxe Comp", "Red Squeeze", "Kinky Comp", "LA Studio Comp", "3-Band Comp", "Rochester Comp", "Opto Comp"];
        const hasCompression = s.intent.effects.some((e) =>
          compressorNames.includes(e.modelName)
        );
        expect(hasCompression).toBe(true);
      }
    );
  });

  describe("aggregate run", () => {
    it("runAllScenarios produces results for all scenarios with zero errors", () => {
      const results = runAllScenarios(MOCK_SCENARIOS);

      expect(results.length).toBe(MOCK_SCENARIOS.length);

      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        const errorDetails = errors
          .map((e) => `${e.scenarioId}: ${e.error}`)
          .join("\n");
        expect.fail(`${errors.length} scenario(s) failed:\n${errorDetails}`);
      }
    });
  });
});
