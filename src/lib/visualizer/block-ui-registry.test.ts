import { describe, it, expect } from "vitest";
import {
  BLOCK_UI_REGISTRY,
  BLOCK_TYPES,
  FALLBACK_CONFIG,
  getBlockUIConfig,
} from "./block-ui-registry";

// All 12 BlockSpec.type values from types.ts
const BLOCK_SPEC_TYPES = [
  "amp",
  "cab",
  "distortion",
  "delay",
  "reverb",
  "modulation",
  "dynamics",
  "eq",
  "wah",
  "pitch",
  "volume",
  "send_return",
] as const;

describe("BLOCK_UI_REGISTRY", () => {
  it("has exactly 14 entries", () => {
    expect(Object.keys(BLOCK_UI_REGISTRY)).toHaveLength(14);
  });

  it("covers all 12 BlockSpec.type union members", () => {
    for (const type of BLOCK_SPEC_TYPES) {
      expect(BLOCK_UI_REGISTRY[type]).toBeDefined();
    }
  });

  it("includes 'empty' placeholder type", () => {
    expect(BLOCK_UI_REGISTRY.empty).toBeDefined();
  });

  it("includes 'looper' block type", () => {
    expect(BLOCK_UI_REGISTRY.looper).toBeDefined();
  });

  it("every entry has colorHex, iconName, and widthMode", () => {
    for (const [type, config] of Object.entries(BLOCK_UI_REGISTRY)) {
      expect(config.colorHex, `${type} missing colorHex`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(config.iconName, `${type} missing iconName`).toBeTruthy();
      expect(["standard", "wide", "narrow"], `${type} invalid widthMode`).toContain(
        config.widthMode,
      );
    }
  });
});

describe("BLOCK_TYPES", () => {
  it("has 14 entries matching registry keys", () => {
    expect(BLOCK_TYPES).toHaveLength(14);
    for (const type of BLOCK_TYPES) {
      expect(BLOCK_UI_REGISTRY[type]).toBeDefined();
    }
  });
});

describe("getBlockUIConfig", () => {
  it("returns correct config for amp (wide, amber)", () => {
    const config = getBlockUIConfig("amp");
    expect(config.colorHex).toBe("#C36952");
    expect(config.iconName).toBe("amp");
    expect(config.widthMode).toBe("wide");
  });

  it("returns correct config for cab (wide, darker amber)", () => {
    const config = getBlockUIConfig("cab");
    expect(config.colorHex).toBe("#b5b5b5");
    expect(config.widthMode).toBe("wide");
  });

  it("returns correct config for delay (emerald)", () => {
    const config = getBlockUIConfig("delay");
    expect(config.colorHex).toBe("#71A657");
    expect(config.iconName).toBe("delay");
    expect(config.widthMode).toBe("standard");
  });

  it("returns correct config for reverb (orange)", () => {
    const config = getBlockUIConfig("reverb");
    expect(config.colorHex).toBe("#D56637");
    expect(config.iconName).toBe("reverb");
    expect(config.widthMode).toBe("standard");
  });

  it("amp and cab have widthMode 'wide'", () => {
    expect(getBlockUIConfig("amp").widthMode).toBe("wide");
    expect(getBlockUIConfig("cab").widthMode).toBe("wide");
  });

  it("volume and send_return have widthMode 'narrow'", () => {
    expect(getBlockUIConfig("volume").widthMode).toBe("narrow");
    expect(getBlockUIConfig("send_return").widthMode).toBe("narrow");
  });

  it("empty returns dark gray placeholder config", () => {
    const config = getBlockUIConfig("empty");
    expect(config.colorHex).toBe("#222222");
    expect(config.iconName).toBe("empty");
    expect(config.widthMode).toBe("standard");
  });

  it("looper returns light purple config", () => {
    const config = getBlockUIConfig("looper");
    expect(config.colorHex).toBe("#2e2e2e");
    expect(config.iconName).toBe("looper");
    expect(config.widthMode).toBe("standard");
  });

  it("returns FALLBACK_CONFIG for unknown type", () => {
    const config = getBlockUIConfig("unknown_type");
    expect(config).toEqual(FALLBACK_CONFIG);
    expect(config.colorHex).toBe("#4B5563");
    expect(config.iconName).toBe("block");
    expect(config.widthMode).toBe("standard");
  });

  it("each of the 14 types returns a unique colorHex", () => {
    const colors = BLOCK_TYPES.map((t) => getBlockUIConfig(t).colorHex);
    expect(new Set(colors).size).toBe(14);
  });
});
