// src/lib/helix/model-defaults-validation.test.ts
// Regression guard: validates ALL model defaultParams pass through validatePresetSpec
// without throwing. Prevents production 500s from non-normalized parameters
// (e.g., the Taps:4 bug that crashed Multi Pass on first use).

import { describe, it, expect } from "vitest";
import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  EQ_MODELS,
  WAH_MODELS,
  VOLUME_MODELS,
  STADIUM_AMPS,
  STADIUM_EQ_MODELS,
} from "./models";
import { validatePresetSpec } from "./validate";
import { getCapabilities } from "./device-family";
import type { PresetSpec, BlockSpec } from "./types";
import type { HelixModel } from "./models";

const helixCaps = getCapabilities("helix_floor");
const stadiumCaps = getCapabilities("helix_stadium");

// Real amp and cab from catalogs — used as scaffolding for non-amp/non-cab tests
const DUMMY_AMP = AMP_MODELS["US Deluxe Nrm"];
const DUMMY_CAB = CAB_MODELS["4x12 Greenback25"];
// Stadium uses its own amp catalog
const DUMMY_STADIUM_AMP = Object.values(STADIUM_AMPS)[0];

function makeBlock(name: string, model: HelixModel, blockType: BlockSpec["type"]): BlockSpec {
  return {
    type: blockType,
    modelId: model.id,
    modelName: name,
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: { ...model.defaultParams },
  };
}

// Build a minimal valid PresetSpec wrapping a single block + required amp + cab
function buildSpecForBlock(block: BlockSpec, isStadium: boolean): PresetSpec {
  const chain: BlockSpec[] = [];

  // Always need an amp and cab for validatePresetSpec to pass structure checks
  if (block.type !== "amp") {
    const amp = isStadium ? DUMMY_STADIUM_AMP : DUMMY_AMP;
    const ampName = isStadium
      ? Object.keys(STADIUM_AMPS)[0]
      : "US Deluxe Nrm";
    chain.push(makeBlock(ampName, amp, "amp"));
  } else {
    chain.push(block);
  }

  if (block.type !== "cab") {
    chain.push({
      ...makeBlock("4x12 Greenback25", DUMMY_CAB, "cab"),
      position: 1,
    });
  } else {
    chain.push({ ...block, position: 1 });
  }

  // Add the actual block-under-test if it's not amp or cab (already added above)
  if (block.type !== "amp" && block.type !== "cab") {
    chain.push({ ...block, position: chain.length });
  }

  return {
    name: "Validation Test",
    description: "Auto-generated for model defaults validation",
    tempo: 120,
    signalChain: chain,
    snapshots: [
      {
        name: "Snapshot 1",
        description: "",
        ledColor: 0,
        blockStates: {},
        parameterOverrides: {},
      },
    ],
  };
}

// Map each model catalog to its BlockSpec type string
const CATALOG_BLOCK_TYPES: Array<{
  catalog: Record<string, HelixModel>;
  blockType: BlockSpec["type"];
  label: string;
  isStadium: boolean;
  caps: typeof helixCaps;
}> = [
  { catalog: AMP_MODELS, blockType: "amp", label: "AMP_MODELS", isStadium: false, caps: helixCaps },
  { catalog: CAB_MODELS, blockType: "cab", label: "CAB_MODELS", isStadium: false, caps: helixCaps },
  { catalog: DISTORTION_MODELS, blockType: "distortion", label: "DISTORTION_MODELS", isStadium: false, caps: helixCaps },
  { catalog: DELAY_MODELS, blockType: "delay", label: "DELAY_MODELS", isStadium: false, caps: helixCaps },
  { catalog: REVERB_MODELS, blockType: "reverb", label: "REVERB_MODELS", isStadium: false, caps: helixCaps },
  { catalog: MODULATION_MODELS, blockType: "modulation", label: "MODULATION_MODELS", isStadium: false, caps: helixCaps },
  { catalog: DYNAMICS_MODELS, blockType: "dynamics", label: "DYNAMICS_MODELS", isStadium: false, caps: helixCaps },
  { catalog: EQ_MODELS, blockType: "eq", label: "EQ_MODELS", isStadium: false, caps: helixCaps },
  { catalog: WAH_MODELS, blockType: "wah", label: "WAH_MODELS", isStadium: false, caps: helixCaps },
  { catalog: VOLUME_MODELS, blockType: "volume", label: "VOLUME_MODELS", isStadium: false, caps: helixCaps },
  { catalog: STADIUM_AMPS, blockType: "amp", label: "STADIUM_AMPS", isStadium: true, caps: stadiumCaps },
  { catalog: STADIUM_EQ_MODELS, blockType: "eq", label: "STADIUM_EQ_MODELS", isStadium: true, caps: stadiumCaps },
];

describe("Model defaults validation", () => {
  for (const { catalog, blockType, label, isStadium, caps } of CATALOG_BLOCK_TYPES) {
    describe(label, () => {
      const entries = Object.entries(catalog);

      it(`has at least one model`, () => {
        expect(entries.length).toBeGreaterThan(0);
      });

      for (const [name, model] of entries) {
        it(`${name} — defaultParams pass validation`, () => {
          const block = makeBlock(name, model, blockType);
          const spec = buildSpecForBlock(block, isStadium);

          // This should NOT throw — if it does, we have a production 500 waiting to happen
          expect(() => validatePresetSpec(spec, caps)).not.toThrow();
        });
      }
    });
  }
});
