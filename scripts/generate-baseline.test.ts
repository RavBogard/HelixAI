// scripts/generate-baseline.test.ts
// Integration tests for the 36-preset deterministic baseline generator.
// Verifies file count, JSON structure, stadium amps, device constraints, and determinism.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { generateBaseline } from "./generate-baseline";
import { validatePresetSpec } from "@/lib/helix/validate";
import { getCapabilities } from "@/lib/helix/device-family";
import type { DeviceTarget, PresetSpec } from "@/lib/helix/types";

const DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "pod_go",
  "helix_stadium",
  "helix_stomp",
  "helix_stomp_xl",
];

const TONES = ["clean", "crunch", "high_gain", "ambient", "edge_of_breakup", "dual_amp"];

describe("generate-baseline", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "baseline-test-"));
    generateBaseline(tmpDir);
  });

  afterAll(() => {
    // Clean up temp dir
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("Test 1: produces exactly 36 JSON files", () => {
    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(36);
  });

  it("Test 2: each file is valid JSON with required keys", () => {
    for (const device of DEVICES) {
      for (const tone of TONES) {
        const filePath = path.join(tmpDir, `${tone}-${device}.json`);
        expect(fs.existsSync(filePath), `Missing file: ${tone}-${device}.json`).toBe(true);

        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        expect(content).toHaveProperty("toneIntent");
        expect(content).toHaveProperty("presetSpec");
        expect(content).toHaveProperty("scenario");
        expect(content).toHaveProperty("generatedAt");
      }
    }
  });

  it("Test 3: each presetSpec has non-empty signalChain and 3-8 snapshots", () => {
    for (const device of DEVICES) {
      for (const tone of TONES) {
        const filePath = path.join(tmpDir, `${tone}-${device}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const spec: PresetSpec = content.presetSpec;

        expect(spec.signalChain.length).toBeGreaterThan(0);
        
        if (device === "helix_stadium") {
          expect(spec.snapshots.length).toBe(1);
        } else {
          expect(spec.snapshots.length).toBeGreaterThanOrEqual(3);
          expect(spec.snapshots.length).toBeLessThanOrEqual(8);
        }
      }
    }
  });

  it("Test 4: validatePresetSpec does not throw for any of the 36 presets", () => {
    for (const device of DEVICES) {
      for (const tone of TONES) {
        const filePath = path.join(tmpDir, `${tone}-${device}.json`);
        const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        const spec: PresetSpec = content.presetSpec;

        expect(() => validatePresetSpec(spec, getCapabilities(device))).not.toThrow();
      }
    }
  });

  it("Test 5: Stadium scenarios use Agoura_* amp names", () => {
    for (const tone of TONES) {
      const filePath = path.join(tmpDir, `${tone}-helix_stadium.json`);
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const intent = content.toneIntent;

      expect(
        intent.ampName.startsWith("Agoura"),
        `Stadium ${tone} should use Agoura amp, got: ${intent.ampName}`,
      ).toBe(true);
    }
  });

  it("Test 6: dual_amp scenario for single-DSP devices uses single-amp variant", () => {
    const singleDspDevices: DeviceTarget[] = ["pod_go", "helix_stomp", "helix_stomp_xl"];

    for (const device of singleDspDevices) {
      const filePath = path.join(tmpDir, `dual_amp-${device}.json`);
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      const intent = content.toneIntent;

      expect(
        intent.secondAmpName,
        `dual_amp for ${device} should NOT have secondAmpName`,
      ).toBeUndefined();
    }
  });

  it("Test 7: running twice produces identical output (deterministic)", () => {
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "baseline-test2-"));
    try {
      generateBaseline(tmpDir2);

      for (const device of DEVICES) {
        for (const tone of TONES) {
          const file1 = path.join(tmpDir, `${tone}-${device}.json`);
          const file2 = path.join(tmpDir2, `${tone}-${device}.json`);

          const content1 = JSON.parse(fs.readFileSync(file1, "utf-8"));
          const content2 = JSON.parse(fs.readFileSync(file2, "utf-8"));

          // Compare everything except generatedAt (timestamp will differ)
          delete content1.generatedAt;
          delete content2.generatedAt;

          expect(content1).toEqual(content2);
        }
      }
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});
