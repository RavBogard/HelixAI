import { describe, it, expect } from "vitest";
import { diffPresets, type DiffReport, type Deviation } from "./structural-diff";
import { runScenario } from "./mock-harness";
import { MOCK_SCENARIOS } from "./mock-scenarios";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function findScenario(id: string) {
  const s = MOCK_SCENARIOS.find((s) => s.id === id);
  if (!s) throw new Error(`Scenario not found: ${id}`);
  return s;
}

function generatePreset(id: string) {
  const result = runScenario(findScenario(id));
  expect(result.error).toBeUndefined();
  return result.preset;
}

function setNested(obj: unknown, path: string, value: unknown) {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (key.includes("[")) {
      const [arrKey, idxStr] = key.split("[");
      const idx = parseInt(idxStr.replace("]", ""));
      current = (current[arrKey] as unknown[])[idx] as Record<string, unknown>;
    } else {
      current = current[key] as Record<string, unknown>;
    }
  }
  current[parts[parts.length - 1]] = value;
}

function getNested(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (const part of parts) {
    if (part.includes("[")) {
      const [arrKey, idxStr] = part.split("[");
      const idx = parseInt(idxStr.replace("]", ""));
      current = (current[arrKey] as unknown[])[idx] as Record<string, unknown>;
    } else {
      current = current[part] as Record<string, unknown>;
    }
  }
  return current;
}

function deleteNested(obj: unknown, path: string) {
  const parts = path.split(".");
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("structural-diff", () => {
  // ---- AC-1: Identical presets produce zero deviations ----

  describe("identical preset comparison", () => {
    it("helix: identical presets produce zero deviations", () => {
      const preset = generatePreset("helix-clean");
      const clone = deepClone(preset);
      const report = diffPresets(preset, clone, "helix");
      expect(report.deviations).toHaveLength(0);
      expect(report.passed).toBe(true);
      expect(report.deviationCount).toEqual({ critical: 0, warning: 0, info: 0 });
    });

    it("podgo: identical presets produce zero deviations", () => {
      const preset = generatePreset("podgo-clean");
      const clone = deepClone(preset);
      const report = diffPresets(preset, clone, "podgo");
      expect(report.deviations).toHaveLength(0);
      expect(report.passed).toBe(true);
    });

    it("stadium: identical presets produce zero deviations", () => {
      const preset = generatePreset("stadium-clean");
      const clone = deepClone(preset);
      const report = diffPresets(preset, clone, "stadium");
      expect(report.deviations).toHaveLength(0);
      expect(report.passed).toBe(true);
    });

    it("stomp: identical presets produce zero deviations", () => {
      const preset = generatePreset("stomp-clean");
      const clone = deepClone(preset);
      const report = diffPresets(preset, clone, "stomp");
      expect(report.deviations).toHaveLength(0);
      expect(report.passed).toBe(true);
    });
  });

  // ---- AC-2: Category-aware comparison ----

  describe("metadata differences", () => {
    it("name change is info severity", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.meta.name", "Modified Name");
      const report = diffPresets(ref, gen, "helix");
      expect(report.deviations.length).toBeGreaterThanOrEqual(1);
      const nameDeviation = report.deviations.find((d) =>
        d.path.includes("meta.name"),
      );
      expect(nameDeviation).toBeDefined();
      expect(nameDeviation!.category).toBe("metadata");
      expect(nameDeviation!.severity).toBe("info");
      expect(report.passed).toBe(true); // info-only → pass
    });

    it("device ID change is critical severity", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.device", 9999999);
      const report = diffPresets(ref, gen, "helix");
      const deviceDeviation = report.deviations.find((d) =>
        d.path === "data.device",
      );
      expect(deviceDeviation).toBeDefined();
      expect(deviceDeviation!.category).toBe("metadata");
      expect(deviceDeviation!.severity).toBe("critical");
      expect(report.passed).toBe(false);
    });
  });

  describe("block differences", () => {
    it("changed amp model is critical", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      // Find an amp block in dsp0
      const dsp0 = (gen as Record<string, unknown>).data as Record<string, unknown>;
      const tone = (dsp0 as Record<string, unknown>).tone as Record<string, unknown>;
      const dsp = tone.dsp0 as Record<string, unknown>;
      const blockKey = Object.keys(dsp).find(
        (k) => k.startsWith("block") && dsp[k] && (dsp[k] as Record<string, unknown>)["@model"]?.toString().includes("Amp"),
      );
      expect(blockKey).toBeDefined();
      const origModel = (dsp[blockKey!] as Record<string, unknown>)["@model"];
      (dsp[blockKey!] as Record<string, unknown>)["@model"] = "HD2_FakeAmp";

      const report = diffPresets(ref, gen, "helix");
      const modelDev = report.deviations.find((d) =>
        d.path.includes(blockKey!) && d.path.endsWith(".@model"),
      );
      expect(modelDev).toBeDefined();
      expect(modelDev!.category).toBe("block");
      expect(modelDev!.severity).toBe("critical");
      expect(modelDev!.expected).toBe(origModel);
      expect(modelDev!.actual).toBe("HD2_FakeAmp");
    });

    it("changed block @enabled is warning", () => {
      const ref = generatePreset("helix-highgain");
      const gen = deepClone(ref);
      const tone = ((gen as Record<string, unknown>).data as Record<string, unknown>).tone as Record<string, unknown>;
      const dsp = tone.dsp0 as Record<string, unknown>;
      // Find a non-amp block with @enabled
      const blockKey = Object.keys(dsp).find(
        (k) =>
          k.startsWith("block") &&
          dsp[k] &&
          (dsp[k] as Record<string, unknown>)["@enabled"] !== undefined &&
          !(dsp[k] as Record<string, unknown>)["@model"]?.toString().includes("Amp"),
      );
      if (blockKey) {
        const block = dsp[blockKey] as Record<string, unknown>;
        const origEnabled = block["@enabled"];
        block["@enabled"] = !origEnabled;

        const report = diffPresets(ref, gen, "helix");
        const enabledDev = report.deviations.find((d) =>
          d.path.includes(blockKey) && d.path.endsWith(".@enabled"),
        );
        expect(enabledDev).toBeDefined();
        expect(enabledDev!.category).toBe("block");
        expect(enabledDev!.severity).toBe("warning");
      }
    });
  });

  describe("parameter differences", () => {
    it("numeric parameter change within tolerance produces no deviation", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      const tone = ((gen as Record<string, unknown>).data as Record<string, unknown>).tone as Record<string, unknown>;
      const dsp = tone.dsp0 as Record<string, unknown>;
      // Find a block with a numeric param
      const blockKey = Object.keys(dsp).find(
        (k) =>
          k.startsWith("block") &&
          dsp[k] &&
          typeof (dsp[k] as Record<string, unknown>)["@model"] === "string",
      );
      if (blockKey) {
        const block = dsp[blockKey] as Record<string, unknown>;
        const paramKey = Object.keys(block).find(
          (k) => !k.startsWith("@") && typeof block[k] === "number",
        );
        if (paramKey) {
          const orig = block[paramKey] as number;
          block[paramKey] = orig + 0.0005; // Within tolerance
          const report = diffPresets(ref, gen, "helix");
          const paramDev = report.deviations.find(
            (d) => d.path.includes(blockKey) && d.path.endsWith(`.${paramKey}`),
          );
          expect(paramDev).toBeUndefined(); // Within tolerance → no deviation
        }
      }
    });

    it("numeric parameter change beyond tolerance produces warning", () => {
      const ref = generatePreset("helix-blues");
      const gen = deepClone(ref);
      const tone = ((gen as Record<string, unknown>).data as Record<string, unknown>).tone as Record<string, unknown>;
      const dsp = tone.dsp0 as Record<string, unknown>;
      const blockKey = Object.keys(dsp).find(
        (k) =>
          k.startsWith("block") &&
          dsp[k] &&
          typeof (dsp[k] as Record<string, unknown>)["@model"] === "string",
      );
      if (blockKey) {
        const block = dsp[blockKey] as Record<string, unknown>;
        const paramKey = Object.keys(block).find(
          (k) => !k.startsWith("@") && typeof block[k] === "number",
        );
        if (paramKey) {
          block[paramKey] = (block[paramKey] as number) + 0.3; // Beyond tolerance
          const report = diffPresets(ref, gen, "helix");
          const paramDev = report.deviations.find(
            (d) => d.path.includes(blockKey) && d.path.endsWith(`.${paramKey}`),
          );
          expect(paramDev).toBeDefined();
          expect(paramDev!.severity).toBe("warning");
        }
      }
    });
  });

  describe("snapshot differences", () => {
    it("changed snapshot name is warning", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.tone.snapshot0.@name", "Modified Snapshot");
      const report = diffPresets(ref, gen, "helix");
      const snapDev = report.deviations.find(
        (d) => d.path.includes("snapshot0") && d.path.includes("@name"),
      );
      expect(snapDev).toBeDefined();
      expect(snapDev!.category).toBe("snapshot");
    });

    it("deleted snapshot is critical", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      deleteNested(gen, "data.tone.snapshot2");
      const report = diffPresets(ref, gen, "helix");
      // Should have deviations for all missing snapshot2 fields
      const snapDevs = report.deviations.filter((d) =>
        d.path.includes("snapshot2"),
      );
      expect(snapDevs.length).toBeGreaterThan(0);
      // The root snapshot2 missing should be critical
      const criticalSnap = snapDevs.find((d) => d.severity === "critical");
      expect(criticalSnap).toBeDefined();
    });
  });

  describe("controller differences", () => {
    it("changed controller value is warning", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      const tone = ((gen as Record<string, unknown>).data as Record<string, unknown>).tone as Record<string, unknown>;
      const ctrl = tone.controller as Record<string, unknown>;
      if (ctrl && ctrl.dsp0) {
        const dsp0Ctrl = ctrl.dsp0 as Record<string, unknown>;
        const ctrlKey = Object.keys(dsp0Ctrl)[0];
        if (ctrlKey) {
          const ctrlBlock = dsp0Ctrl[ctrlKey] as Record<string, unknown>;
          const paramKey = Object.keys(ctrlBlock)[0];
          if (paramKey) {
            // Modify a controller value
            const paramObj = ctrlBlock[paramKey];
            if (typeof paramObj === "object" && paramObj !== null) {
              (paramObj as Record<string, unknown>)["@controller"] = 99;
              const report = diffPresets(ref, gen, "helix");
              const ctrlDev = report.deviations.find(
                (d) => d.category === "controller",
              );
              expect(ctrlDev).toBeDefined();
              expect(ctrlDev!.severity).toBe("warning");
            }
          }
        }
      }
    });
  });

  describe("structure differences", () => {
    it("extra key produces structure deviation", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.tone.extraField", "unexpected");
      const report = diffPresets(ref, gen, "helix");
      const structDev = report.deviations.find((d) =>
        d.path.includes("extraField"),
      );
      expect(structDev).toBeDefined();
      expect(structDev!.category).toBe("structure");
      expect(structDev!.actual).toBe("unexpected");
      expect(structDev!.expected).toBeUndefined();
    });

    it("missing key produces structure deviation", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      deleteNested(gen, "data.tone.global");
      const report = diffPresets(ref, gen, "helix");
      const structDevs = report.deviations.filter((d) =>
        d.path.includes("global"),
      );
      expect(structDevs.length).toBeGreaterThan(0);
    });
  });

  // ---- AC-3: Device-family aware diffing ----

  describe("device-family aware diffing", () => {
    it("Pod Go: detects changes in block0-block9 format", () => {
      const ref = generatePreset("podgo-clean");
      const gen = deepClone(ref);
      // Modify a block in Pod Go's block0-block9 structure
      const tone = ((gen as Record<string, unknown>).data as Record<string, unknown>).tone as Record<string, unknown>;
      const dsp = tone.dsp0 as Record<string, unknown>;
      const blockKey = Object.keys(dsp).find(
        (k) =>
          k.startsWith("block") &&
          dsp[k] &&
          (dsp[k] as Record<string, unknown>)["@model"],
      );
      if (blockKey) {
        (dsp[blockKey] as Record<string, unknown>)["@model"] = "HD2_FakeModel";
        const report = diffPresets(ref, gen, "podgo");
        expect(report.deviceFamily).toBe("podgo");
        const modelDev = report.deviations.find((d) =>
          d.path.endsWith(".@model"),
        );
        expect(modelDev).toBeDefined();
      }
    });

    it("Pod Go: detects snapshot changes (4 snapshots)", () => {
      const ref = generatePreset("podgo-blues");
      const gen = deepClone(ref);
      setNested(gen, "data.tone.snapshot0.@name", "PodGoModified");
      const report = diffPresets(ref, gen, "podgo");
      const snapDev = report.deviations.find((d) =>
        d.path.includes("snapshot0"),
      );
      expect(snapDev).toBeDefined();
      expect(snapDev!.category).toBe("snapshot");
    });

    it("Stadium: detects changes in flow[0] block structure", () => {
      const ref = generatePreset("stadium-clean");
      const gen = deepClone(ref);
      // Stadium structure: preset.flow[0].b05 (amp position) — inner JSON, no .json wrapper
      const presetData = (gen as Record<string, unknown>).preset as Record<string, unknown>;
      const flow = (presetData as Record<string, unknown>).flow as unknown[];
      const flow0 = flow[0] as Record<string, unknown>;
      // Find a block key (b00-b13)
      const blockKey = Object.keys(flow0).find((k) => /^b\d\d$/.test(k));
      if (blockKey) {
        const block = flow0[blockKey] as Record<string, unknown>;
        block.type = "modified_type";
        const report = diffPresets(ref, gen, "stadium");
        expect(report.deviceFamily).toBe("stadium");
        const typeDev = report.deviations.find((d) =>
          d.path.includes(blockKey) && d.path.endsWith(".type"),
        );
        expect(typeDev).toBeDefined();
      }
    });

    it("Stadium: detects snapshot metadata changes", () => {
      const ref = generatePreset("stadium-highgain");
      const gen = deepClone(ref);
      // Inner JSON — .preset is at top level, no .json wrapper
      const presetData = (gen as Record<string, unknown>).preset as Record<string, unknown>;
      const snapshots = presetData.snapshots as unknown[];
      if (snapshots && snapshots.length > 0) {
        (snapshots[0] as Record<string, unknown>).name = "StadiumModified";
        const report = diffPresets(ref, gen, "stadium");
        const snapDev = report.deviations.find((d) =>
          d.path.includes("snapshots") && d.path.includes("name"),
        );
        expect(snapDev).toBeDefined();
      }
    });

    it("Stomp: detects changes correctly", () => {
      const ref = generatePreset("stomp-highgain");
      const gen = deepClone(ref);
      setNested(gen, "data.device", 1111111);
      const report = diffPresets(ref, gen, "stomp");
      expect(report.deviceFamily).toBe("stomp");
      const deviceDev = report.deviations.find((d) => d.path === "data.device");
      expect(deviceDev).toBeDefined();
      expect(deviceDev!.severity).toBe("critical");
    });
  });

  // ---- AC-4: Severity classification ----

  describe("severity classification", () => {
    it("only info deviations → passed = true", () => {
      const ref = generatePreset("helix-ambient");
      const gen = deepClone(ref);
      setNested(gen, "data.meta.name", "Different Name");
      setNested(gen, "data.meta.build_sha", "abc123");
      const report = diffPresets(ref, gen, "helix");
      expect(report.deviationCount.critical).toBe(0);
      expect(report.passed).toBe(true);
    });

    it("critical deviations → passed = false", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.device", 0);
      const report = diffPresets(ref, gen, "helix");
      expect(report.deviationCount.critical).toBeGreaterThan(0);
      expect(report.passed).toBe(false);
    });
  });

  // ---- AC-5: Summary report generation ----

  describe("report summary", () => {
    it("report has correct counts and structure", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);

      // Add multiple types of changes
      setNested(gen, "data.meta.name", "Changed"); // info
      setNested(gen, "data.device", 0); // critical
      setNested(gen, "data.tone.extraKey", true); // structure/warning

      const report = diffPresets(ref, gen, "helix");

      // Verify structure
      expect(report.deviceFamily).toBe("helix");
      expect(typeof report.deviationCount.critical).toBe("number");
      expect(typeof report.deviationCount.warning).toBe("number");
      expect(typeof report.deviationCount.info).toBe("number");
      expect(typeof report.passed).toBe("boolean");
      expect(Array.isArray(report.deviations)).toBe(true);

      // Verify counts match actual deviations
      const critCount = report.deviations.filter(
        (d) => d.severity === "critical",
      ).length;
      const warnCount = report.deviations.filter(
        (d) => d.severity === "warning",
      ).length;
      const infoCount = report.deviations.filter(
        (d) => d.severity === "info",
      ).length;
      expect(report.deviationCount.critical).toBe(critCount);
      expect(report.deviationCount.warning).toBe(warnCount);
      expect(report.deviationCount.info).toBe(infoCount);

      // Verify category counts
      const totalFromCategories = Object.values(report.categoryCount).reduce(
        (a, b) => a + b,
        0,
      );
      expect(totalFromCategories).toBe(report.deviations.length);

      // Verify sorted by severity (critical first)
      if (report.deviations.length > 1) {
        for (let i = 1; i < report.deviations.length; i++) {
          const severityOrder = { critical: 0, warning: 1, info: 2 };
          expect(
            severityOrder[report.deviations[i].severity],
          ).toBeGreaterThanOrEqual(
            severityOrder[report.deviations[i - 1].severity],
          );
        }
      }
    });

    it("each deviation has required fields", () => {
      const ref = generatePreset("helix-clean");
      const gen = deepClone(ref);
      setNested(gen, "data.meta.name", "Test");
      const report = diffPresets(ref, gen, "helix");
      for (const d of report.deviations) {
        expect(d).toHaveProperty("path");
        expect(d).toHaveProperty("category");
        expect(d).toHaveProperty("severity");
        expect(d).toHaveProperty("expected");
        expect(d).toHaveProperty("actual");
        expect(d).toHaveProperty("message");
        expect(typeof d.path).toBe("string");
        expect(typeof d.message).toBe("string");
      }
    });
  });

  // ---- Cross-family aggregate test ----

  describe("cross-family", () => {
    it("all families: identical self-comparison produces zero deviations", () => {
      const families = [
        { id: "helix-clean", family: "helix" as const },
        { id: "stomp-clean", family: "stomp" as const },
        { id: "stompxl-clean", family: "stomp" as const },
        { id: "podgo-clean", family: "podgo" as const },
        { id: "stadium-clean", family: "stadium" as const },
      ];

      for (const { id, family } of families) {
        const preset = generatePreset(id);
        const clone = deepClone(preset);
        const report = diffPresets(preset, clone, family);
        expect(report.deviations).toHaveLength(0);
        expect(report.passed).toBe(true);
        expect(report.deviceFamily).toBe(family);
      }
    });
  });
});
