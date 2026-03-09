import { describe, it, expect } from "vitest";
import { groupByFamily, checkSchemaCompliance, runAudit } from "./audit-runner";
import { MOCK_SCENARIOS as SCENARIOS } from "./mock-scenarios";
import type { HarnessResult } from "./mock-harness";
import type { DeviceFamily } from "./device-family";
import type { FamilySchema } from "./schema-extractor";

// ---------------------------------------------------------------------------
// groupByFamily
// ---------------------------------------------------------------------------

describe("groupByFamily", () => {
  it("groups all 25 scenarios into 4 families", () => {
    // Create minimal harness results matching scenario devices
    const results: HarnessResult[] = SCENARIOS.map((s) => ({
      scenarioId: s.id,
      device: s.device,
      toneStyle: s.toneStyle,
      preset: {},
      spec: {} as HarnessResult["spec"],
      fileExtension: ".hlx" as const,
      qualityWarnings: [],
      intentAudit: {
        amp: { requested: "", matched: true },
        cab: { requested: "", matched: true },
        effects: [],
        tempo: { requested: 120, actual: 120, matched: true },
        delaySubdivision: { requested: null, applied: false },
        snapshots: { requested: 4, actual: 4, matched: true },
        instrument: { requested: undefined, matched: true },
        warnings: [],
      },
      musicalAudit: { warnings: [], passed: true },
    }));

    const grouped = groupByFamily(results);
    const families = [...grouped.keys()].sort();
    expect(families).toEqual(["helix", "podgo", "stadium", "stomp"]);

    // Each family should have 5 scenarios (5 tone styles × 1 device per family)
    // except stomp which has stomp + stomp_xl = 10
    const helixCount = grouped.get("helix")!.length;
    const stompCount = grouped.get("stomp")!.length;
    const podgoCount = grouped.get("podgo")!.length;
    const stadiumCount = grouped.get("stadium")!.length;

    expect(helixCount).toBe(5);
    expect(stompCount).toBe(10); // stomp + stomp_xl
    expect(podgoCount).toBe(5);
    expect(stadiumCount).toBe(5);
    expect(helixCount + stompCount + podgoCount + stadiumCount).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// checkSchemaCompliance
// ---------------------------------------------------------------------------

describe("checkSchemaCompliance", () => {
  const makeSchema = (
    requiredTopLevel: string[],
    metadataFields: FamilySchema["metadataFields"] = [],
  ): FamilySchema => ({
    family: "helix" as DeviceFamily,
    presetCount: 3,
    requiredTopLevelKeys: requiredTopLevel,
    blockStructure: [],
    snapshotStructure: { requiredKeys: [], commonKeys: [] },
    controllerStructure: { requiredKeys: [], commonKeys: [] },
    footswitchStructure: { requiredKeys: [], commonKeys: [] },
    metadataFields,
  });

  it("detects missing required keys", () => {
    const schema = makeSchema(["data", "version", "schema"]);
    const preset = { data: {}, version: 6 };

    const result = checkSchemaCompliance(preset, schema);
    expect(result.missingRequiredKeys).toEqual(["schema"]);
  });

  it("passes when all required keys present", () => {
    const schema = makeSchema(["data", "version"]);
    const preset = { data: {}, version: 6 };

    const result = checkSchemaCompliance(preset, schema);
    expect(result.missingRequiredKeys).toEqual([]);
  });

  it("detects extra keys not in references", () => {
    const schema = makeSchema(["data", "version"]);
    const preset = { data: {}, version: 6, unknown_field: "test" };

    const result = checkSchemaCompliance(preset, schema);
    expect(result.extraKeys).toContain("unknown_field");
  });

  it("handles null preset gracefully", () => {
    const schema = makeSchema(["data", "version"]);
    const result = checkSchemaCompliance(null, schema);
    expect(result.missingRequiredKeys).toEqual(["data", "version"]);
  });
});

// ---------------------------------------------------------------------------
// runAudit (integration-level with real pipeline)
// ---------------------------------------------------------------------------

describe("runAudit", () => {
  it("runs with no corpus config (intent/musical only)", () => {
    // Use just 2 scenarios to keep test fast
    const scenarios = SCENARIOS.slice(0, 2);
    const result = runAudit({ scenarios });

    expect(result.totalScenarios).toBe(2);
    expect(result.families.length).toBeGreaterThan(0);
    expect(result.timestamp).toBeTruthy();

    // Each family result should have scenario data
    for (const family of result.families) {
      expect(family.scenarios.length).toBeGreaterThan(0);
      for (const s of family.scenarios) {
        expect(s.harnessResult).toBeTruthy();
        // No corpus → no diff or schema compliance
        expect(s.diffReport).toBeUndefined();
        expect(s.schemaCompliance).toBeUndefined();
      }
    }
  });

  it("computes overallPassed based on intent and musical results", () => {
    // Run all 25 scenarios through the real pipeline
    const result = runAudit({ scenarios: SCENARIOS });

    expect(result.totalScenarios).toBe(25);
    expect(result.families.length).toBe(4);

    for (const family of result.families) {
      const { intentSummary, musicalSummary, diffSummary, overallPassed } = family;
      const expectedPass =
        diffSummary.critical === 0 &&
        intentSummary.failed === 0 &&
        musicalSummary.failed === 0;
      expect(overallPassed).toBe(expectedPass);
    }
  });

  it("handles missing corpus files gracefully", () => {
    const scenarios = SCENARIOS.slice(0, 2);
    const corpusConfig = {
      helix: ["/nonexistent/file.hlx"],
      stomp: [],
      podgo: [],
      stadium: [],
    };

    // Should not throw — corpus loader reports errors without aborting
    const result = runAudit({ scenarios, corpusConfig });
    expect(result.totalScenarios).toBe(2);
  });
});
