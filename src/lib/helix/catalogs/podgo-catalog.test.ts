import { describe, it, expect } from "vitest";
import {
  PODGO_AMP_NAMES,
  PODGO_CAB_NAMES,
  PODGO_EFFECT_NAMES,
  PODGO_EFFECT_SUFFIX,
} from "./podgo-catalog";
import { EQ_MODELS, WAH_MODELS, VOLUME_MODELS } from "../models";

describe("podgo-catalog", () => {
  describe("PODGO_AMP_NAMES", () => {
    it("is non-empty", () => {
      expect(PODGO_AMP_NAMES.length).toBeGreaterThan(0);
    });

    it("contains no Agoura (Stadium) amp names", () => {
      const agouraNames = PODGO_AMP_NAMES.filter((name) =>
        /^Agoura /.test(name),
      );
      expect(agouraNames).toEqual([]);
    });
  });

  describe("PODGO_CAB_NAMES", () => {
    it("is non-empty", () => {
      expect(PODGO_CAB_NAMES.length).toBeGreaterThan(0);
    });
  });

  describe("PODGO_EFFECT_NAMES", () => {
    it("is non-empty", () => {
      expect(PODGO_EFFECT_NAMES.length).toBeGreaterThan(0);
    });

    it("does not contain Tone Sovereign", () => {
      expect(PODGO_EFFECT_NAMES).not.toContain("Tone Sovereign");
    });

    it("does not contain Clawthorn Drive", () => {
      expect(PODGO_EFFECT_NAMES).not.toContain("Clawthorn Drive");
    });

    it("does not contain Cosmos Echo", () => {
      expect(PODGO_EFFECT_NAMES).not.toContain("Cosmos Echo");
    });

    it("has no overlap with EQ_MODELS keys", () => {
      const eqKeys = Object.keys(EQ_MODELS);
      const overlap = PODGO_EFFECT_NAMES.filter((name) =>
        eqKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });

    it("has no overlap with WAH_MODELS keys", () => {
      const wahKeys = Object.keys(WAH_MODELS);
      const overlap = PODGO_EFFECT_NAMES.filter((name) =>
        wahKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });

    it("has no overlap with VOLUME_MODELS keys", () => {
      const volumeKeys = Object.keys(VOLUME_MODELS);
      const overlap = PODGO_EFFECT_NAMES.filter((name) =>
        volumeKeys.includes(name),
      );
      expect(overlap).toEqual([]);
    });
  });

  describe("PODGO_EFFECT_SUFFIX", () => {
    it("has expected keys", () => {
      const expectedKeys = [
        "distortion",
        "dynamics",
        "eq",
        "pitch",
        "delay",
        "reverb",
        "modulation",
        "wah",
        "volume",
      ];
      expect(Object.keys(PODGO_EFFECT_SUFFIX).sort()).toEqual(
        expectedKeys.sort(),
      );
    });

    it("maps mono-in effects to Mono", () => {
      expect(PODGO_EFFECT_SUFFIX.distortion).toBe("Mono");
      expect(PODGO_EFFECT_SUFFIX.dynamics).toBe("Mono");
      expect(PODGO_EFFECT_SUFFIX.eq).toBe("Mono");
      expect(PODGO_EFFECT_SUFFIX.pitch).toBe("Mono");
    });

    it("maps stereo-capable effects to Stereo", () => {
      expect(PODGO_EFFECT_SUFFIX.delay).toBe("Stereo");
      expect(PODGO_EFFECT_SUFFIX.reverb).toBe("Stereo");
      expect(PODGO_EFFECT_SUFFIX.modulation).toBe("Stereo");
      expect(PODGO_EFFECT_SUFFIX.wah).toBe("Stereo");
      expect(PODGO_EFFECT_SUFFIX.volume).toBe("Stereo");
    });
  });
});
