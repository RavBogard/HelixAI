// src/lib/helix/schema-prompt-alignment.test.ts
// Cross-family integration test: verifies every model name in each family's
// catalog is accepted by that family's Zod schema (getToneIntentSchema).
//
// This is a CI-level guard catching future catalog/schema divergence across all families.
// Phase 67 Plan 02 — STADQ-04

import { describe, it, expect } from "vitest";
import { getToneIntentSchema } from "./tone-intent";
import { HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES } from "./catalogs/helix-catalog";
import { STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES } from "./catalogs/stomp-catalog";
import { PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES } from "./catalogs/podgo-catalog";
import { STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES } from "./catalogs/stadium-catalog";
import { WAH_MODELS, VOLUME_MODELS } from "./models";
import type { DeviceFamily } from "./device-family";

// ---------------------------------------------------------------------------
// Family catalog map
// ---------------------------------------------------------------------------

const FAMILY_CATALOGS: Record<DeviceFamily, { amps: string[]; cabs: string[]; effects: string[] }> = {
  helix:   { amps: [...HELIX_AMP_NAMES],   cabs: [...HELIX_CAB_NAMES],   effects: [...HELIX_EFFECT_NAMES] },
  stomp:   { amps: [...STOMP_AMP_NAMES],    cabs: [...STOMP_CAB_NAMES],   effects: [...STOMP_EFFECT_NAMES] },
  podgo:   { amps: [...PODGO_AMP_NAMES],    cabs: [...PODGO_CAB_NAMES],   effects: [...PODGO_EFFECT_NAMES] },
  stadium: { amps: [...STADIUM_AMP_NAMES],  cabs: [...STADIUM_CAB_NAMES], effects: [...STADIUM_EFFECT_NAMES] },
};

// Minimal snapshot array required by schema (min 3)
const MINIMAL_SNAPSHOTS = [
  { name: "Clean", toneRole: "clean" as const },
  { name: "Rhythm", toneRole: "crunch" as const },
  { name: "Lead", toneRole: "lead" as const },
];

// ---------------------------------------------------------------------------
// Cross-family schema/prompt alignment
// ---------------------------------------------------------------------------

describe("schema/prompt alignment - all families", () => {
  for (const [family, catalog] of Object.entries(FAMILY_CATALOGS) as [DeviceFamily, { amps: string[]; cabs: string[]; effects: string[] }][]) {
    const schema = getToneIntentSchema(family);
    const firstAmp = catalog.amps[0];
    const firstCab = catalog.cabs[0];
    const firstEffect = catalog.effects[0];

    describe(family, () => {
      it("every amp name is accepted by schema", () => {
        for (const amp of catalog.amps) {
          const result = schema.safeParse({
            ampName: amp,
            cabName: firstCab,
            guitarType: "humbucker",
            effects: [{ modelName: firstEffect, role: "always_on" }],
            snapshots: MINIMAL_SNAPSHOTS,
          });
          expect(result.success, `Amp "${amp}" rejected by ${family} schema`).toBe(true);
        }
      });

      it("every cab name is accepted by schema", () => {
        for (const cab of catalog.cabs) {
          const result = schema.safeParse({
            ampName: firstAmp,
            cabName: cab,
            guitarType: "humbucker",
            effects: [{ modelName: firstEffect, role: "always_on" }],
            snapshots: MINIMAL_SNAPSHOTS,
          });
          expect(result.success, `Cab "${cab}" rejected by ${family} schema`).toBe(true);
        }
      });

      it("every effect name is accepted by schema", () => {
        for (const effect of catalog.effects) {
          const result = schema.safeParse({
            ampName: firstAmp,
            cabName: firstCab,
            guitarType: "humbucker",
            effects: [{ modelName: effect, role: "always_on" }],
            snapshots: MINIMAL_SNAPSHOTS,
          });
          expect(result.success, `Effect "${effect}" rejected by ${family} schema`).toBe(true);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Stadium WAH/VOLUME catalog membership
// ---------------------------------------------------------------------------

describe("Stadium WAH/VOLUME catalog membership", () => {
  it("STADIUM_EFFECT_NAMES includes all WAH_MODELS keys", () => {
    for (const key of Object.keys(WAH_MODELS)) {
      expect(
        STADIUM_EFFECT_NAMES.includes(key),
        `WAH model "${key}" is not in STADIUM_EFFECT_NAMES`
      ).toBe(true);
    }
  });

  it("STADIUM_EFFECT_NAMES includes all VOLUME_MODELS keys", () => {
    for (const key of Object.keys(VOLUME_MODELS)) {
      expect(
        STADIUM_EFFECT_NAMES.includes(key),
        `VOLUME model "${key}" is not in STADIUM_EFFECT_NAMES`
      ).toBe(true);
    }
  });
});
