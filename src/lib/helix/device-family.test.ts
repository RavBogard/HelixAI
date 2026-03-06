// device-family.test.ts — Unit tests for DeviceFamily resolution and DeviceCapabilities
// TDD RED phase: Tests define expected behavior before implementation

import { describe, it, expect } from "vitest";
import type { DeviceTarget } from "./types";
import { resolveFamily, getCapabilities } from "./device-family";

// All 9 DeviceTarget values
const ALL_DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "helix_rack",
  "helix_stomp",
  "helix_stomp_xl",
  "pod_go",
  "pod_go_xl",
  "helix_stadium",
  "helix_stadium_xl",
];

describe("resolveFamily", () => {
  describe("helix family", () => {
    it('resolveFamily("helix_lt") === "helix"', () => {
      expect(resolveFamily("helix_lt")).toBe("helix");
    });

    it('resolveFamily("helix_floor") === "helix"', () => {
      expect(resolveFamily("helix_floor")).toBe("helix");
    });

    it('resolveFamily("helix_rack") === "helix"', () => {
      expect(resolveFamily("helix_rack")).toBe("helix");
    });
  });

  describe("stomp family", () => {
    it('resolveFamily("helix_stomp") === "stomp"', () => {
      expect(resolveFamily("helix_stomp")).toBe("stomp");
    });

    it('resolveFamily("helix_stomp_xl") === "stomp"', () => {
      expect(resolveFamily("helix_stomp_xl")).toBe("stomp");
    });
  });

  describe("podgo family", () => {
    it('resolveFamily("pod_go") === "podgo"', () => {
      expect(resolveFamily("pod_go")).toBe("podgo");
    });

    it('resolveFamily("pod_go_xl") === "podgo"', () => {
      expect(resolveFamily("pod_go_xl")).toBe("podgo");
    });
  });

  describe("stadium family", () => {
    it('resolveFamily("helix_stadium") === "stadium"', () => {
      expect(resolveFamily("helix_stadium")).toBe("stadium");
    });

    it('resolveFamily("helix_stadium_xl") === "stadium"', () => {
      expect(resolveFamily("helix_stadium_xl")).toBe("stadium");
    });
  });
});

describe("getCapabilities", () => {
  describe("returns valid DeviceCapabilities for all 9 devices", () => {
    it("getCapabilities returns a non-null object for every DeviceTarget", () => {
      for (const device of ALL_DEVICES) {
        const caps = getCapabilities(device);
        expect(caps, `getCapabilities("${device}") should return an object`).toBeTruthy();
        expect(typeof caps).toBe("object");
      }
    });
  });

  describe("family field consistency — caps.family matches resolveFamily", () => {
    it("caps.family matches resolveFamily for all 9 devices", () => {
      for (const device of ALL_DEVICES) {
        const caps = getCapabilities(device);
        const family = resolveFamily(device);
        expect(caps.family, `"${device}".family should match resolveFamily`).toBe(family);
      }
    });
  });

  describe("helix_floor capabilities", () => {
    it("dspCount === 2", () => {
      expect(getCapabilities("helix_floor").dspCount).toBe(2);
    });

    it("dualAmpSupported === true", () => {
      expect(getCapabilities("helix_floor").dualAmpSupported).toBe(true);
    });

    it('fileFormat === "hlx"', () => {
      expect(getCapabilities("helix_floor").fileFormat).toBe("hlx");
    });

    it('ampCatalogEra === "hd2"', () => {
      expect(getCapabilities("helix_floor").ampCatalogEra).toBe("hd2");
    });

    it("maxSnapshots === 8", () => {
      expect(getCapabilities("helix_floor").maxSnapshots).toBe(8);
    });
  });

  describe("helix_stomp capabilities", () => {
    it("maxBlocksTotal === 6", () => {
      expect(getCapabilities("helix_stomp").maxBlocksTotal).toBe(6);
    });

    it("maxSnapshots === 3", () => {
      expect(getCapabilities("helix_stomp").maxSnapshots).toBe(3);
    });

    it("dualAmpSupported === false", () => {
      expect(getCapabilities("helix_stomp").dualAmpSupported).toBe(false);
    });
  });

  describe("helix_stomp_xl capabilities", () => {
    it("maxBlocksTotal === 9", () => {
      expect(getCapabilities("helix_stomp_xl").maxBlocksTotal).toBe(9);
    });

    it("maxSnapshots === 4", () => {
      expect(getCapabilities("helix_stomp_xl").maxSnapshots).toBe(4);
    });
  });

  describe("pod_go capabilities", () => {
    it('fileFormat === "pgp"', () => {
      expect(getCapabilities("pod_go").fileFormat).toBe("pgp");
    });

    it("dualAmpSupported === false", () => {
      expect(getCapabilities("pod_go").dualAmpSupported).toBe(false);
    });

    it("maxBlocksPerDsp === 4", () => {
      expect(getCapabilities("pod_go").maxBlocksPerDsp).toBe(4);
    });
  });

  describe("pod_go_xl capabilities (placeholder — same as pod_go)", () => {
    it('fileFormat === "pgp"', () => {
      expect(getCapabilities("pod_go_xl").fileFormat).toBe("pgp");
    });

    it("dualAmpSupported === false", () => {
      expect(getCapabilities("pod_go_xl").dualAmpSupported).toBe(false);
    });

    it("maxBlocksPerDsp === 4", () => {
      expect(getCapabilities("pod_go_xl").maxBlocksPerDsp).toBe(4);
    });
  });

  describe("helix_stadium capabilities", () => {
    it('fileFormat === "hsp"', () => {
      expect(getCapabilities("helix_stadium").fileFormat).toBe("hsp");
    });

    it('ampCatalogEra === "agoura"', () => {
      expect(getCapabilities("helix_stadium").ampCatalogEra).toBe("agoura");
    });

    it("dualAmpSupported === true", () => {
      expect(getCapabilities("helix_stadium").dualAmpSupported).toBe(true);
    });

    it("maxSnapshots === 8", () => {
      expect(getCapabilities("helix_stadium").maxSnapshots).toBe(8);
    });
  });

  describe("helix_stadium_xl capabilities (same as helix_stadium)", () => {
    it('ampCatalogEra === "agoura"', () => {
      expect(getCapabilities("helix_stadium_xl").ampCatalogEra).toBe("agoura");
    });

    it('fileFormat === "hsp"', () => {
      expect(getCapabilities("helix_stadium_xl").fileFormat).toBe("hsp");
    });
  });

  describe("helix_rack capabilities (identical to helix_floor)", () => {
    it("dspCount === 2", () => {
      expect(getCapabilities("helix_rack").dspCount).toBe(2);
    });

    it("dualAmpSupported === true", () => {
      expect(getCapabilities("helix_rack").dualAmpSupported).toBe(true);
    });

    it('fileFormat === "hlx"', () => {
      expect(getCapabilities("helix_rack").fileFormat).toBe("hlx");
    });

    it('ampCatalogEra === "hd2"', () => {
      expect(getCapabilities("helix_rack").ampCatalogEra).toBe("hd2");
    });

    it("maxSnapshots === 8", () => {
      expect(getCapabilities("helix_rack").maxSnapshots).toBe(8);
    });
  });

  describe("availableBlockTypes", () => {
    it("helix devices have all 12 block types", () => {
      const caps = getCapabilities("helix_floor");
      expect(caps.availableBlockTypes.length).toBe(12);
    });

    it("pod_go excludes pitch and send_return", () => {
      const caps = getCapabilities("pod_go");
      expect(caps.availableBlockTypes).not.toContain("pitch");
      expect(caps.availableBlockTypes).not.toContain("send_return");
    });
  });
});
