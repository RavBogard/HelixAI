import { describe, it, expect } from "vitest";
import { HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES } from "./helix-catalog";
import { EQ_MODELS, WAH_MODELS, VOLUME_MODELS } from "../models";

describe("helix-catalog", () => {
  describe("HELIX_AMP_NAMES", () => {
    it("is non-empty", () => {
      expect(HELIX_AMP_NAMES.length).toBeGreaterThan(0);
    });

    it("contains no Agoura (Stadium) amp names", () => {
      const agouraNames = HELIX_AMP_NAMES.filter((name) =>
        /^Agoura /.test(name),
      );
      expect(agouraNames).toEqual([]);
    });

    it("contains known HD2 amp name", () => {
      expect(HELIX_AMP_NAMES).toContain("US Deluxe Nrm");
    });
  });

  describe("HELIX_CAB_NAMES", () => {
    it("is non-empty", () => {
      expect(HELIX_CAB_NAMES.length).toBeGreaterThan(0);
    });
  });

  describe("HELIX_EFFECT_NAMES", () => {
    it("is non-empty", () => {
      expect(HELIX_EFFECT_NAMES.length).toBeGreaterThan(0);
    });

    it("has no overlap with EQ_MODELS keys", () => {
      const eqKeys = Object.keys(EQ_MODELS);
      const overlap = HELIX_EFFECT_NAMES.filter((name) =>
        eqKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });

    it("has no overlap with WAH_MODELS keys", () => {
      const wahKeys = Object.keys(WAH_MODELS);
      const overlap = HELIX_EFFECT_NAMES.filter((name) =>
        wahKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });

    it("has no overlap with VOLUME_MODELS keys", () => {
      const volumeKeys = Object.keys(VOLUME_MODELS);
      const overlap = HELIX_EFFECT_NAMES.filter((name) =>
        volumeKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });
  });
});
