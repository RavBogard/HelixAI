import { describe, it, expect } from "vitest";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  parsePresetFile,
  detectDeviceId,
  detectFamily,
  detectFormat,
  loadCorpus,
  type CorpusConfig,
} from "./reference-corpus";

// ---------------------------------------------------------------------------
// Reference file paths (real presets on disk)
// ---------------------------------------------------------------------------

const HELIX_REF = "C:\\Users\\dsbog\\OneDrive\\Desktop\\Strab ORNG RV SC.hlx";
const PODGO_REF = "C:\\Users\\dsbog\\Downloads\\ROCK CRUNCH.pgp";
const STADIUM_REF =
  "C:\\Users\\dsbog\\Downloads\\NH_STADIUM_AURA_REFLECTIONS\\NH_BoomAuRang.hsp";
const STOMP_REF = "C:\\Users\\dsbog\\Downloads\\CATS NO OTO4.hlx";
const STOMP_XL_REF = "C:\\Users\\dsbog\\Downloads\\Fillmore Beast.hlx";

// ---------------------------------------------------------------------------
// Format detection
// ---------------------------------------------------------------------------

describe("detectFormat", () => {
  it("detects .hlx as hlx", () => {
    expect(detectFormat("foo/bar.hlx")).toBe("hlx");
  });

  it("detects .pgp as pgp", () => {
    expect(detectFormat("foo/bar.pgp")).toBe("pgp");
  });

  it("detects .hsp as hsp", () => {
    expect(detectFormat("foo/bar.hsp")).toBe("hsp");
  });

  it("throws on unknown extension", () => {
    expect(() => detectFormat("foo/bar.txt")).toThrow("Unknown preset file extension");
  });
});

// ---------------------------------------------------------------------------
// parsePresetFile — real preset files
// ---------------------------------------------------------------------------

describe("parsePresetFile", () => {
  it("parses a real .hlx file", () => {
    if (!existsSync(HELIX_REF)) return; // skip if file not available
    const result = parsePresetFile(HELIX_REF);
    expect(result.format).toBe("hlx");
    expect(result.content).toBeDefined();
    const c = result.content as Record<string, unknown>;
    expect(c.data).toBeDefined();
    expect(c.schema).toBe("L6Preset");
  });

  it("parses a real .pgp file", () => {
    if (!existsSync(PODGO_REF)) return;
    const result = parsePresetFile(PODGO_REF);
    expect(result.format).toBe("pgp");
    expect(result.content).toBeDefined();
    const c = result.content as Record<string, unknown>;
    expect(c.data).toBeDefined();
    expect(c.schema).toBe("L6Preset");
  });

  it("parses a real .hsp file (strips magic header)", () => {
    if (!existsSync(STADIUM_REF)) return;
    const result = parsePresetFile(STADIUM_REF);
    expect(result.format).toBe("hsp");
    expect(result.content).toBeDefined();
    const c = result.content as Record<string, unknown>;
    expect(c.meta).toBeDefined();
    const meta = c.meta as Record<string, unknown>;
    expect(typeof meta.device_id).toBe("number");
  });
});

// ---------------------------------------------------------------------------
// detectDeviceId
// ---------------------------------------------------------------------------

describe("detectDeviceId", () => {
  it("extracts device ID from HLX content", () => {
    const content = { data: { device: 2162692 }, schema: "L6Preset" };
    expect(detectDeviceId(content, "hlx")).toBe(2162692);
  });

  it("extracts device ID from PGP content", () => {
    const content = { data: { device: 2162695 }, schema: "L6Preset" };
    expect(detectDeviceId(content, "pgp")).toBe(2162695);
  });

  it("extracts device ID from HSP content", () => {
    const content = { meta: { device_id: 2490368 } };
    expect(detectDeviceId(content, "hsp")).toBe(2490368);
  });

  it("throws if HLX missing data.device", () => {
    expect(() => detectDeviceId({ data: {} }, "hlx")).toThrow("missing data.device");
  });

  it("throws if HSP missing meta.device_id", () => {
    expect(() => detectDeviceId({ meta: {} }, "hsp")).toThrow("missing meta.device_id");
  });
});

// ---------------------------------------------------------------------------
// detectFamily
// ---------------------------------------------------------------------------

describe("detectFamily", () => {
  it("maps Helix Floor device ID to helix", () => {
    expect(detectFamily(2162689)).toBe("helix");
  });

  it("maps Helix LT device ID to helix", () => {
    expect(detectFamily(2162692)).toBe("helix");
  });

  it("maps Helix Native (confirmed) to helix", () => {
    expect(detectFamily(2162944)).toBe("helix");
  });

  it("maps Pod Go device ID to podgo", () => {
    expect(detectFamily(2162695)).toBe("podgo");
  });

  it("maps Pod Go Wireless to podgo", () => {
    expect(detectFamily(2162696)).toBe("podgo");
  });

  it("maps HX Stomp device ID to stomp", () => {
    expect(detectFamily(2162694)).toBe("stomp");
  });

  it("maps HX Stomp XL device ID to stomp", () => {
    expect(detectFamily(2162699)).toBe("stomp");
  });

  it("maps Stadium device ID to stadium", () => {
    expect(detectFamily(2490368)).toBe("stadium");
  });

  it("throws on unknown device ID", () => {
    expect(() => detectFamily(9999999)).toThrow("Unknown device ID");
  });
});

// ---------------------------------------------------------------------------
// loadCorpus — integration with real files
// ---------------------------------------------------------------------------

describe("loadCorpus", () => {
  it("loads real presets grouped by family", () => {
    // Only run if at least one reference file exists
    const available: Partial<CorpusConfig> = {};
    if (existsSync(HELIX_REF)) available.helix = [HELIX_REF];
    if (existsSync(PODGO_REF)) available.podgo = [PODGO_REF];
    if (existsSync(STADIUM_REF)) available.stadium = [STADIUM_REF];
    if (existsSync(STOMP_REF)) available.stomp = [STOMP_REF];

    if (Object.keys(available).length === 0) return; // skip if no files

    const config: CorpusConfig = {
      helix: available.helix ?? [],
      stomp: available.stomp ?? [],
      podgo: available.podgo ?? [],
      stadium: available.stadium ?? [],
    };

    const result = loadCorpus(config);
    expect(result.errors).toHaveLength(0);
    expect(result.presets.length).toBeGreaterThan(0);

    for (const preset of result.presets) {
      expect(preset.content).toBeDefined();
      expect(preset.fileName).toBeTruthy();
      expect(preset.deviceId).toBeGreaterThan(0);
    }
  });

  it("reports missing files as errors without aborting", () => {
    const config: CorpusConfig = {
      helix: ["/nonexistent/file.hlx"],
      stomp: [],
      podgo: [],
      stadium: [],
    };

    const result = loadCorpus(config);
    expect(result.presets).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe("File not found");
  });

  it("reports family mismatch as error", () => {
    // Pod Go file listed under helix family
    if (!existsSync(PODGO_REF)) return;

    const config: CorpusConfig = {
      helix: [PODGO_REF], // wrong family!
      stomp: [],
      podgo: [],
      stadium: [],
    };

    const result = loadCorpus(config);
    expect(result.presets).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toContain("Family mismatch");
  });

  it("loads multiple presets per family", () => {
    const helixFiles = [
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\Strab ORNG RV SC.hlx",
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\TONEAGE 185.hlx",
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\Vox Liverpool.hlx",
    ].filter(existsSync);

    if (helixFiles.length < 2) return;

    const config: CorpusConfig = {
      helix: helixFiles,
      stomp: [],
      podgo: [],
      stadium: [],
    };

    const result = loadCorpus(config);
    expect(result.errors).toHaveLength(0);
    expect(result.presets.length).toBe(helixFiles.length);
    for (const p of result.presets) {
      expect(p.family).toBe("helix");
    }
  });
});
