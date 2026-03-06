import { describe, it, expect } from "vitest";
import {
  STADIUM_AMP_NAMES,
  STADIUM_CAB_NAMES,
  STADIUM_EFFECT_NAMES,
} from "./stadium-catalog";
import { HELIX_AMP_NAMES } from "./helix-catalog";
import { WAH_MODELS, VOLUME_MODELS } from "../models";
import { getToneIntentSchema } from "../tone-intent";

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

    it("contains all WAH_MODELS keys", () => {
      for (const key of Object.keys(WAH_MODELS)) {
        expect(STADIUM_EFFECT_NAMES).toContain(key);
      }
    });

    it("contains all VOLUME_MODELS keys", () => {
      for (const key of Object.keys(VOLUME_MODELS)) {
        expect(STADIUM_EFFECT_NAMES).toContain(key);
      }
    });
  });

  describe("getToneIntentSchema('stadium') accepts WAH and VOLUME effect names", () => {
    const schema = getToneIntentSchema("stadium");
    const wahKey = Object.keys(WAH_MODELS)[0];
    const volumeKey = Object.keys(VOLUME_MODELS)[0];

    it("accepts a wah model name as effectName", () => {
      const result = schema.safeParse({
        ampName: STADIUM_AMP_NAMES[0],
        cabName: STADIUM_CAB_NAMES[0],
        guitarType: "humbucker",
        effects: [{ modelName: wahKey, role: "toggleable" }],
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts a volume model name as effectName", () => {
      const result = schema.safeParse({
        ampName: STADIUM_AMP_NAMES[0],
        cabName: STADIUM_CAB_NAMES[0],
        guitarType: "humbucker",
        effects: [{ modelName: volumeKey, role: "always_on" }],
        snapshots: [
          { name: "Clean", toneRole: "clean" },
          { name: "Crunch", toneRole: "crunch" },
          { name: "Lead", toneRole: "lead" },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
