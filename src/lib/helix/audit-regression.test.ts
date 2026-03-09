import { describe, it, expect, beforeAll } from "vitest";
import { runAudit } from "./audit-runner";
import { MOCK_SCENARIOS } from "./mock-scenarios";
import type { AuditResult } from "./audit-runner";

describe("audit regression suite", () => {
  let auditResult: AuditResult;

  beforeAll(() => {
    auditResult = runAudit({ scenarios: MOCK_SCENARIOS });
  });

  it("runs all 25 scenarios without errors", () => {
    expect(auditResult.totalScenarios).toBe(25);
    for (const family of auditResult.families) {
      for (const scenario of family.scenarios) {
        expect(scenario.harnessResult.error).toBeUndefined();
      }
    }
  });

  describe.each(["helix", "stomp", "podgo", "stadium"] as const)(
    "family: %s",
    (family) => {
      it("passes intent fidelity", () => {
        const fam = auditResult.families.find((f) => f.family === family);
        expect(fam).toBeDefined();
        expect(fam!.intentSummary.failed).toBe(0);
      });

      it("passes musical intelligence", () => {
        const fam = auditResult.families.find((f) => f.family === family);
        expect(fam).toBeDefined();
        expect(fam!.musicalSummary.failed).toBe(0);
      });

      it("has no pipeline errors", () => {
        const fam = auditResult.families.find((f) => f.family === family);
        expect(fam).toBeDefined();
        for (const scenario of fam!.scenarios) {
          expect(scenario.harnessResult.error).toBeUndefined();
        }
      });

      it("overall passes", () => {
        const fam = auditResult.families.find((f) => f.family === family);
        expect(fam).toBeDefined();
        expect(fam!.overallPassed).toBe(true);
      });
    },
  );
});
