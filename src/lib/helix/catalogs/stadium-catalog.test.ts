import { describe, it, expect } from "vitest";
import {
  STADIUM_AMP_NAMES,
  STADIUM_CAB_NAMES,
  STADIUM_EFFECT_NAMES,
} from "./stadium-catalog";
import { HELIX_AMP_NAMES } from "./helix-catalog";
import { WAH_MODELS, VOLUME_MODELS } from "../models";

describe("stadium-catalog", () => {
  describe("STADIUM_AMP_NAMES", () => {
    it("is non-empty", () => {
      expect(STADIUM_AMP_NAMES.length).toBeGreaterThan(0);
    });

    it("every name matches /^Agoura /", () => {
      for (const name of STADIUM_AMP_NAMES) {
        expect(name).toMatch(/^Agoura /);
      }
    });

    it("has zero overlap with HELIX_AMP_NAMES", () => {
      const helixSet = new Set(HELIX_AMP_NAMES);
      const overlap = STADIUM_AMP_NAMES.filter((name) => helixSet.has(name));
      expect(overlap).toEqual([]);
    });
  });

  describe("STADIUM_CAB_NAMES", () => {
    it("is non-empty", () => {
      expect(STADIUM_CAB_NAMES.length).toBeGreaterThan(0);
    });
  });

  describe("STADIUM_EFFECT_NAMES", () => {
    it("is non-empty", () => {
      expect(STADIUM_EFFECT_NAMES.length).toBeGreaterThan(0);
    });

    it("contains Stadium Parametric EQ (from STADIUM_EQ_MODELS)", () => {
      expect(STADIUM_EFFECT_NAMES).toContain("Stadium Parametric EQ");
    });

    it("contains 10 Band Graphic (from STADIUM_EQ_MODELS)", () => {
      expect(STADIUM_EFFECT_NAMES).toContain("10 Band Graphic");
    });

    it("has no overlap with WAH_MODELS keys", () => {
      const wahKeys = Object.keys(WAH_MODELS);
      const overlap = STADIUM_EFFECT_NAMES.filter((name) =>
        wahKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });

    it("has no overlap with VOLUME_MODELS keys", () => {
      const volumeKeys = Object.keys(VOLUME_MODELS);
      const overlap = STADIUM_EFFECT_NAMES.filter((name) =>
        volumeKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });
  });
});
