import { describe, it, expect } from "vitest";
import { getToneIntentSchema } from "./tone-intent";
import { STADIUM_AMP_NAMES } from "./catalogs/stadium-catalog";
import { HELIX_AMP_NAMES } from "./catalogs/helix-catalog";
import type { DeviceFamily } from "./device-family";

// Minimal valid payload — shared across tests.
// Only ampName, cabName, effects, and snapshots vary per test.
function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "humbucker",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
    ],
    ...overrides,
  };
}

describe("getToneIntentSchema", () => {
  it("returns a schema for all 4 families without throwing", () => {
    const families: DeviceFamily[] = ["helix", "stomp", "podgo", "stadium"];
    for (const family of families) {
      expect(() => getToneIntentSchema(family)).not.toThrow();
    }
  });

  it("throws on invalid family", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getToneIntentSchema("invalid" as any)).toThrow(
      "Unknown DeviceFamily",
    );
  });

  describe("helix schema", () => {
    const schema = getToneIntentSchema("helix");

    it("accepts HD2 amp name 'US Deluxe Nrm'", () => {
      const result = schema.safeParse(makePayload());
      expect(result.success).toBe(true);
    });

    it("rejects Agoura amp name", () => {
      const agouraAmp = STADIUM_AMP_NAMES[0]; // e.g., "Agoura German Xtra Red"
      const result = schema.safeParse(makePayload({ ampName: agouraAmp }));
      expect(result.success).toBe(false);
    });
  });

  describe("stadium schema", () => {
    const schema = getToneIntentSchema("stadium");
    const stadiumAmp = STADIUM_AMP_NAMES[0];

    it("accepts Agoura amp name", () => {
      const result = schema.safeParse(makePayload({ ampName: stadiumAmp }));
      expect(result.success).toBe(true);
    });

    it("rejects HD2 amp name 'US Deluxe Nrm'", () => {
      const result = schema.safeParse(makePayload({ ampName: "US Deluxe Nrm" }));
      expect(result.success).toBe(false);
    });
  });

  describe("stomp schema", () => {
    const schema = getToneIntentSchema("stomp");

    it("accepts same amp names as helix", () => {
      const result = schema.safeParse(
        makePayload({ ampName: HELIX_AMP_NAMES[0] }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe("podgo schema", () => {
    const schema = getToneIntentSchema("podgo");

    it("rejects excluded effect 'Tone Sovereign'", () => {
      const result = schema.safeParse(
        makePayload({
          effects: [{ modelName: "Tone Sovereign", role: "always_on" }],
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects excluded effect 'Clawthorn Drive'", () => {
      const result = schema.safeParse(
        makePayload({
          effects: [{ modelName: "Clawthorn Drive", role: "always_on" }],
        }),
      );
      expect(result.success).toBe(false);
    });

    it("rejects excluded effect 'Cosmos Echo'", () => {
      const result = schema.safeParse(
        makePayload({
          effects: [{ modelName: "Cosmos Echo", role: "always_on" }],
        }),
      );
      expect(result.success).toBe(false);
    });
  });
});
