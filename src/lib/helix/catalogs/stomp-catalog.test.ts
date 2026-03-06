import { describe, it, expect } from "vitest";
import { STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES } from "./stomp-catalog";
import { HELIX_AMP_NAMES, HELIX_EFFECT_NAMES } from "./helix-catalog";
import { EQ_MODELS, WAH_MODELS, VOLUME_MODELS } from "../models";

describe("stomp-catalog", () => {
  describe("STOMP_AMP_NAMES", () => {
    it("is non-empty", () => {
      expect(STOMP_AMP_NAMES.length).toBeGreaterThan(0);
    });

    it("contains no Agoura (Stadium) amp names", () => {
      const agouraNames = STOMP_AMP_NAMES.filter((name) =>
        /^Agoura /.test(name),
      );
      expect(agouraNames).toEqual([]);
    });

    it("matches Helix amp set (same HD2 catalog)", () => {
      expect([...STOMP_AMP_NAMES].sort()).toEqual([...HELIX_AMP_NAMES].sort());
    });
  });

  describe("STOMP_EFFECT_NAMES", () => {
    it("is non-empty", () => {
      expect(STOMP_EFFECT_NAMES.length).toBeGreaterThan(0);
    });

    it("matches Helix effect set", () => {
      expect([...STOMP_EFFECT_NAMES].sort()).toEqual(
        [...HELIX_EFFECT_NAMES].sort(),
      );
    });

    it("has no overlap with EQ/WAH/VOLUME keys", () => {
      const excludedKeys = [
        ...Object.keys(EQ_MODELS),
        ...Object.keys(WAH_MODELS),
        ...Object.keys(VOLUME_MODELS),
      ];
      const overlap = STOMP_EFFECT_NAMES.filter((name) =>
        excludedKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });
  });

  describe("STOMP_CAB_NAMES", () => {
    it("is non-empty", () => {
      expect(STOMP_CAB_NAMES.length).toBeGreaterThan(0);
    });
  });
});
