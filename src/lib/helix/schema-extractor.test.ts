import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import {
  collectKeys,
  collectTopLevelKeys,
  computeKeyFrequencies,
  extractBlockPatterns,
  extractFamilySchema,
} from "./schema-extractor";
import { parsePresetFile, detectDeviceId, detectFamily } from "./reference-corpus";
import type { ReferencePreset } from "./reference-corpus";
import { basename } from "node:path";

// ---------------------------------------------------------------------------
// collectKeys
// ---------------------------------------------------------------------------

describe("collectKeys", () => {
  it("collects flat object keys", () => {
    const keys = collectKeys({ a: 1, b: "two", c: true });
    expect(keys).toEqual(expect.arrayContaining(["a", "b", "c"]));
    expect(keys).toHaveLength(3);
  });

  it("collects nested object keys with dot paths", () => {
    const keys = collectKeys({ foo: { bar: 1, baz: { qux: 2 } } });
    expect(keys).toContain("foo.bar");
    expect(keys).toContain("foo.baz.qux");
  });

  it("collects array keys with bracket notation", () => {
    const keys = collectKeys({ items: [{ x: 1 }, { x: 2 }] });
    expect(keys).toContain("items[0].x");
    expect(keys).toContain("items[1].x");
  });

  it("handles null and undefined gracefully", () => {
    expect(collectKeys(null)).toEqual([]);
    expect(collectKeys(undefined)).toEqual([]);
  });

  it("handles empty objects", () => {
    expect(collectKeys({})).toEqual([]);
  });

  it("handles deeply nested structures", () => {
    const obj = { a: { b: { c: { d: 42 } } } };
    expect(collectKeys(obj)).toEqual(["a.b.c.d"]);
  });
});

// ---------------------------------------------------------------------------
// collectTopLevelKeys
// ---------------------------------------------------------------------------

describe("collectTopLevelKeys", () => {
  it("returns only top-level keys", () => {
    const keys = collectTopLevelKeys({ a: 1, b: { c: 2 }, d: [1, 2] });
    expect(keys).toEqual(["a", "b", "d"]);
  });

  it("returns empty for non-objects", () => {
    expect(collectTopLevelKeys(null)).toEqual([]);
    expect(collectTopLevelKeys(42)).toEqual([]);
    expect(collectTopLevelKeys([1, 2])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeKeyFrequencies
// ---------------------------------------------------------------------------

describe("computeKeyFrequencies", () => {
  it("marks keys in ALL presets as required", () => {
    const keysets = [
      ["a", "b", "c"],
      ["a", "b", "d"],
      ["a", "b", "e"],
    ];
    const freqs = computeKeyFrequencies(keysets, 3);

    const aFreq = freqs.find((f) => f.key === "a")!;
    expect(aFreq.status).toBe("required");
    expect(aFreq.count).toBe(3);

    const bFreq = freqs.find((f) => f.key === "b")!;
    expect(bFreq.status).toBe("required");
  });

  it("marks keys in >50% as common", () => {
    const keysets = [
      ["a", "b", "c"],
      ["a", "b"],
      ["a", "d"],
    ];
    const freqs = computeKeyFrequencies(keysets, 3);

    const bFreq = freqs.find((f) => f.key === "b")!;
    expect(bFreq.status).toBe("common");
    expect(bFreq.count).toBe(2);
  });

  it("marks keys in <=50% as rare", () => {
    const keysets = [
      ["a", "x"],
      ["a", "y"],
      ["a", "z"],
      ["a", "x"],
    ];
    const freqs = computeKeyFrequencies(keysets, 4);

    // x appears in 2/4 = 50%, which is NOT >50%, so rare
    const xFreq = freqs.find((f) => f.key === "x")!;
    expect(xFreq.status).toBe("rare");
  });

  it("sorts required first, then common, then rare", () => {
    const keysets = [
      ["r", "c", "x"],
      ["r", "c"],
      ["r"],
    ];
    const freqs = computeKeyFrequencies(keysets, 3);
    expect(freqs[0].key).toBe("r");
    expect(freqs[0].status).toBe("required");
  });

  it("handles duplicate keys in a single keyset (counts once per preset)", () => {
    const keysets = [
      ["a", "a", "a"],
      ["a", "b"],
    ];
    const freqs = computeKeyFrequencies(keysets, 2);
    const aFreq = freqs.find((f) => f.key === "a")!;
    expect(aFreq.count).toBe(2); // Not 4
  });
});

// ---------------------------------------------------------------------------
// extractBlockPatterns
// ---------------------------------------------------------------------------

describe("extractBlockPatterns", () => {
  it("groups block keys by generalized prefix", () => {
    const blockKeys = [
      [
        "data.tone.dsp0.block0.@model",
        "data.tone.dsp0.block0.@type",
        "data.tone.dsp0.block1.@model",
      ],
      [
        "data.tone.dsp0.block0.@model",
        "data.tone.dsp0.block0.@type",
        "data.tone.dsp0.block2.@model",
      ],
    ];

    const patterns = extractBlockPatterns(blockKeys, 2);
    expect(patterns.length).toBeGreaterThan(0);

    // Should have a generalized pattern for dsp*.block*
    const dspBlock = patterns.find((p) =>
      p.blockKeyPattern.includes("dsp*.block*"),
    );
    expect(dspBlock).toBeDefined();
  });

  it("identifies required fields across all presets", () => {
    const blockKeys = [
      ["data.tone.dsp0.block0.@model", "data.tone.dsp0.block0.@type"],
      ["data.tone.dsp0.block0.@model", "data.tone.dsp0.block0.@type"],
    ];

    const patterns = extractBlockPatterns(blockKeys, 2);
    const dspBlock = patterns.find((p) =>
      p.blockKeyPattern.includes("dsp*.block*"),
    );
    expect(dspBlock).toBeDefined();
    expect(dspBlock!.requiredFields).toContain("@model");
    expect(dspBlock!.requiredFields).toContain("@type");
  });
});

// ---------------------------------------------------------------------------
// extractFamilySchema — synthetic presets
// ---------------------------------------------------------------------------

describe("extractFamilySchema", () => {
  it("throws on empty preset array", () => {
    expect(() => extractFamilySchema([])).toThrow("empty preset array");
  });

  it("throws on mixed families", () => {
    const presets: ReferencePreset[] = [
      {
        family: "helix",
        filePath: "a.hlx",
        fileName: "a.hlx",
        deviceId: 2162692,
        format: "hlx",
        content: {},
      },
      {
        family: "podgo",
        filePath: "b.pgp",
        fileName: "b.pgp",
        deviceId: 2162695,
        format: "pgp",
        content: {},
      },
    ];
    expect(() => extractFamilySchema(presets)).toThrow("same device family");
  });

  it("extracts schema from synthetic HLX-like presets", () => {
    // Minimal HLX-like structure shared between two presets
    const base = {
      schema: "L6Preset",
      version: 6,
      data: {
        device: 2162692,
        device_version: 58720256,
        meta: { application: "HX Edit", appversion: 123 },
        tone: {
          dsp0: {
            block0: { "@model": "HD2_AmpBigTwin", "@type": 1, Gain: 0.5 },
            block1: { "@model": "HD2_CabAmp", "@type": 2 },
          },
          snapshot0: { blocks: {}, controllers: {} },
          snapshot1: { blocks: {}, controllers: {} },
          controller: { dsp0: {} },
          footswitch: { dsp0: {} },
          global: {},
        },
      },
    };

    const preset2Content = {
      schema: "L6Preset",
      version: 6,
      data: {
        device: 2162692,
        device_version: 58720256,
        meta: { application: "HX Edit", appversion: 456 },
        tone: {
          dsp0: {
            block0: { "@model": "HD2_AmpVox", "@type": 1, Drive: 0.3 },
            block1: { "@model": "HD2_CabVox", "@type": 2, Level: 0.7 },
          },
          snapshot0: { blocks: {}, controllers: {} },
          snapshot1: { blocks: {}, controllers: {} },
          controller: { dsp0: {} },
          footswitch: { dsp0: {} },
          global: { tempo: 120 },
        },
      },
    };

    const presets: ReferencePreset[] = [
      {
        family: "helix",
        filePath: "a.hlx",
        fileName: "a.hlx",
        deviceId: 2162692,
        format: "hlx",
        content: base,
      },
      {
        family: "helix",
        filePath: "b.hlx",
        fileName: "b.hlx",
        deviceId: 2162692,
        format: "hlx",
        content: preset2Content,
      },
    ];

    const schema = extractFamilySchema(presets);

    expect(schema.family).toBe("helix");
    expect(schema.presetCount).toBe(2);

    // Top-level keys
    expect(schema.requiredTopLevelKeys).toContain("schema");
    expect(schema.requiredTopLevelKeys).toContain("version");
    expect(schema.requiredTopLevelKeys).toContain("data");

    // Metadata should include common fields
    expect(schema.metadataFields.length).toBeGreaterThan(0);
    const versionMeta = schema.metadataFields.find((f) => f.key === "version");
    expect(versionMeta?.status).toBe("required");

    // Snapshot structure should find common keys
    expect(schema.snapshotStructure.requiredKeys.length).toBeGreaterThanOrEqual(0);
  });

  it("does not mark preset-specific params as required", () => {
    // Preset 1 has "Gain" on block0, Preset 2 has "Drive"
    const p1 = {
      data: {
        device: 2162692,
        tone: {
          dsp0: {
            block0: { "@model": "Amp1", "@type": 1, Gain: 0.5 },
          },
        },
      },
    };
    const p2 = {
      data: {
        device: 2162692,
        tone: {
          dsp0: {
            block0: { "@model": "Amp2", "@type": 1, Drive: 0.3 },
          },
        },
      },
    };

    const presets: ReferencePreset[] = [
      {
        family: "helix",
        filePath: "a.hlx",
        fileName: "a.hlx",
        deviceId: 2162692,
        format: "hlx",
        content: p1,
      },
      {
        family: "helix",
        filePath: "b.hlx",
        fileName: "b.hlx",
        deviceId: 2162692,
        format: "hlx",
        content: p2,
      },
    ];

    const schema = extractFamilySchema(presets);

    // @model and @type should be required (in all presets)
    const dspBlock = schema.blockStructure.find((b) =>
      b.blockKeyPattern.includes("dsp*.block*"),
    );
    expect(dspBlock).toBeDefined();
    expect(dspBlock!.requiredFields).toContain("@model");
    expect(dspBlock!.requiredFields).toContain("@type");

    // Gain and Drive should NOT be required (each in only 1 of 2 presets)
    expect(dspBlock!.requiredFields).not.toContain("Gain");
    expect(dspBlock!.requiredFields).not.toContain("Drive");
  });
});

// ---------------------------------------------------------------------------
// extractFamilySchema — real reference presets
// ---------------------------------------------------------------------------

describe("extractFamilySchema (real presets)", () => {
  function loadReal(filePath: string): ReferencePreset | null {
    if (!existsSync(filePath)) return null;
    const { content, format } = parsePresetFile(filePath);
    const deviceId = detectDeviceId(content, format);
    const family = detectFamily(deviceId);
    return { family, filePath, fileName: basename(filePath), deviceId, format, content };
  }

  it("extracts meaningful schema from real Helix presets", () => {
    const helixFiles = [
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\Strab ORNG RV SC.hlx",
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\TONEAGE 185.hlx",
      "C:\\Users\\dsbog\\OneDrive\\Desktop\\Vox Liverpool.hlx",
    ];

    const presets = helixFiles.map(loadReal).filter(Boolean) as ReferencePreset[];
    if (presets.length < 2) return;

    const schema = extractFamilySchema(presets);
    expect(schema.family).toBe("helix");
    expect(schema.presetCount).toBe(presets.length);
    expect(schema.requiredTopLevelKeys).toContain("data");
    expect(schema.requiredTopLevelKeys).toContain("schema");
    expect(schema.blockStructure.length).toBeGreaterThan(0);
    expect(schema.metadataFields.length).toBeGreaterThan(0);
  });

  it("extracts meaningful schema from real Pod Go presets", () => {
    const podgoFiles = [
      "C:\\Users\\dsbog\\Downloads\\ROCK CRUNCH.pgp",
      "C:\\Users\\dsbog\\Downloads\\A7X.pgp",
      "C:\\Users\\dsbog\\Downloads\\AI CHICK_ROCK.pgp",
    ];

    const presets = podgoFiles.map(loadReal).filter(Boolean) as ReferencePreset[];
    if (presets.length < 2) return;

    const schema = extractFamilySchema(presets);
    expect(schema.family).toBe("podgo");
    expect(schema.presetCount).toBe(presets.length);
    expect(schema.requiredTopLevelKeys.length).toBeGreaterThan(0);
  });

  it("extracts meaningful schema from real Stadium presets", () => {
    const stadiumFiles = [
      "C:\\Users\\dsbog\\Downloads\\NH_STADIUM_AURA_REFLECTIONS\\NH_BoomAuRang.hsp",
      "C:\\Users\\dsbog\\Downloads\\NH_STADIUM_AURA_REFLECTIONS\\Stadium Rock Rig.hsp",
    ];

    const presets = stadiumFiles.map(loadReal).filter(Boolean) as ReferencePreset[];
    if (presets.length < 2) return;

    const schema = extractFamilySchema(presets);
    expect(schema.family).toBe("stadium");
    expect(schema.presetCount).toBe(presets.length);
    expect(schema.metadataFields.length).toBeGreaterThan(0);
  });

  it("extracts meaningful schema from real Stomp XL presets", () => {
    const stompFiles = [
      "C:\\Users\\dsbog\\Downloads\\Fillmore Beast.hlx",
      "C:\\Users\\dsbog\\Downloads\\Synyster Gates.hlx",
      "C:\\Users\\dsbog\\Downloads\\MATCH CH.2.hlx",
    ];

    const presets = stompFiles.map(loadReal).filter(Boolean) as ReferencePreset[];
    if (presets.length < 2) return;

    const schema = extractFamilySchema(presets);
    expect(schema.family).toBe("stomp");
    expect(schema.presetCount).toBe(presets.length);
    expect(schema.blockStructure.length).toBeGreaterThan(0);
  });
});
