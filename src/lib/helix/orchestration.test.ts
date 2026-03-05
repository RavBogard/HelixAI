// src/lib/helix/orchestration.test.ts
// End-to-end orchestration pipeline tests covering HLX-01 through HLX-04.
// Tests the full pipeline: Knowledge Layer -> validatePresetSpec -> buildHlxFile
// with device target support and snapshot block key rebuilding.

import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";
import { resolveParameters } from "./param-engine";
import { buildSnapshots } from "./snapshot-engine";
import { buildHlxFile } from "./preset-builder";
import { buildStompFile, summarizeStompPreset } from "./stomp-builder";
import { validatePresetSpec } from "./validate";
import { DEVICE_IDS, isStomp } from "./types";
import { STOMP_CONFIG } from "./config";
import type { PresetSpec, BlockSpec, DeviceTarget, HlxFile } from "./types";
import type { ToneIntent, SnapshotIntent } from "./tone-intent";
import { mapRigToSubstitutions } from "../rig-mapping";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal clean ToneIntent */
function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

/** High-gain ToneIntent with effects spanning both DSPs */
function highGainIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "Placater Dirty",
    cabName: "4x12 Cali V30",
    guitarType: "humbucker",
    effects: [
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

/** Build a full PresetSpec from a ToneIntent through the Knowledge Layer pipeline */
function buildPresetSpec(intent: ToneIntent): PresetSpec {
  const chain = assembleSignalChain(intent);
  const parameterized = resolveParameters(chain, intent);
  const snapshots = buildSnapshots(parameterized, intent.snapshots);

  return {
    name: intent.presetName ?? "Test Preset",
    description: intent.description ?? "Test preset for orchestration tests",
    tempo: intent.tempoHint ?? 120,
    guitarNotes: intent.guitarNotes,
    signalChain: parameterized,
    snapshots,
  };
}

// ---------------------------------------------------------------------------
// HLX-01/02: Device target tests
// ---------------------------------------------------------------------------

describe("HLX-01/02: Device target", () => {
  it("buildHlxFile with default device produces .hlx with device=2162692 (Helix LT)", () => {
    const spec = buildPresetSpec(cleanIntent());
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec);

    expect(hlx.data.device).toBe(DEVICE_IDS.helix_lt);
    expect(hlx.data.device).toBe(2162692);
  });

  it("buildHlxFile with device='helix_floor' produces .hlx with device=2162689", () => {
    const spec = buildPresetSpec(cleanIntent());
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec, "helix_floor");

    expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor);
    expect(hlx.data.device).toBe(2162689);
  });

  it("full pipeline produces valid .hlx JSON structure with correct top-level fields", () => {
    const intent = highGainIntent();
    const spec = buildPresetSpec(intent);
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec);

    // Top-level structure
    expect(hlx.version).toBe(6);
    expect(hlx.schema).toBe("L6Preset");
    expect(hlx.meta).toEqual({ original: 0, pbn: 0, premium: 0 });

    // data.device
    expect(hlx.data.device).toBe(DEVICE_IDS.helix_lt);

    // data.meta
    expect(hlx.data.meta.name).toBeTruthy();
    expect(hlx.data.meta.application).toBe("HX Edit");
    expect(hlx.data.meta.build_sha).toBeTruthy();
    expect(typeof hlx.data.meta.appversion).toBe("number");

    // data.tone
    expect(hlx.data.tone.dsp0).toBeDefined();
    expect(hlx.data.tone.dsp1).toBeDefined();
    expect(hlx.data.tone.global).toBeDefined();
    expect(hlx.data.tone.global["@tempo"]).toBe(spec.tempo);

    // All 8 snapshots exist
    for (let i = 0; i < 8; i++) {
      const snap = hlx.data.tone[`snapshot${i}` as keyof typeof hlx.data.tone];
      expect(snap).toBeDefined();
    }

    // Controller and footswitch sections
    expect(hlx.data.tone.controller).toBeDefined();
    expect(hlx.data.tone.footswitch).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// HLX-03: Strict validation tests
// ---------------------------------------------------------------------------

describe("HLX-03: Strict validation", () => {
  it("validatePresetSpec throws for PresetSpec with empty signalChain", () => {
    const spec = buildPresetSpec(cleanIntent());
    spec.signalChain = [];

    expect(() => validatePresetSpec(spec)).toThrow("empty signal chain");
  });

  it("validatePresetSpec throws for PresetSpec missing amp block", () => {
    const spec = buildPresetSpec(cleanIntent());
    spec.signalChain = spec.signalChain.filter(b => b.type !== "amp");

    expect(() => validatePresetSpec(spec)).toThrow("missing amp block");
  });

  it("validatePresetSpec throws for PresetSpec missing cab block", () => {
    const spec = buildPresetSpec(cleanIntent());
    spec.signalChain = spec.signalChain.filter(b => b.type !== "cab");

    expect(() => validatePresetSpec(spec)).toThrow("missing cab block");
  });

  it("validatePresetSpec throws for PresetSpec with invalid model ID", () => {
    const spec = buildPresetSpec(cleanIntent());
    // Replace the amp block's model ID with a bogus value
    const ampBlock = spec.signalChain.find(b => b.type === "amp");
    expect(ampBlock).toBeDefined();
    ampBlock!.modelId = "HD2_AmpNonExistent_FakeModel";

    expect(() => validatePresetSpec(spec)).toThrow("Invalid model ID");
  });

  it("validatePresetSpec throws for PresetSpec with out-of-range normalized parameter", () => {
    const spec = buildPresetSpec(cleanIntent());
    // Set a normalized parameter to 1.5 (out of range)
    const ampBlock = spec.signalChain.find(b => b.type === "amp");
    expect(ampBlock).toBeDefined();
    ampBlock!.parameters["Drive"] = 1.5;

    expect(() => validatePresetSpec(spec)).toThrow("out of range");
  });

  it("validatePresetSpec passes for a valid Knowledge Layer-produced PresetSpec", () => {
    const spec = buildPresetSpec(highGainIntent());

    // Should not throw
    expect(() => validatePresetSpec(spec)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// HLX-04: Snapshot block key rebuilding tests
// ---------------------------------------------------------------------------

describe("HLX-04: Snapshot key rebuilding", () => {
  it("snapshot block state keys use per-DSP numbering (block0, block1... restart per DSP)", () => {
    // Use high-gain intent with effects to ensure blocks on both DSPs
    const intent = highGainIntent();
    const spec = buildPresetSpec(intent);
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec);

    // Get the first valid snapshot (snapshot0)
    const snap0 = hlx.data.tone.snapshot0;
    expect(snap0["@valid"]).toBe(true);
    expect(snap0.blocks).toBeDefined();

    // Verify DSP0 has blocks starting from block0
    const dsp0Blocks = snap0.blocks?.dsp0;
    expect(dsp0Blocks).toBeDefined();
    const dsp0Keys = Object.keys(dsp0Blocks!);
    expect(dsp0Keys.length).toBeGreaterThan(0);
    // First key should be block0
    expect(dsp0Keys).toContain("block0");

    // Verify DSP1 also starts from block0 (per-DSP numbering, not global)
    const dsp1Blocks = snap0.blocks?.dsp1;
    expect(dsp1Blocks).toBeDefined();
    const dsp1Keys = Object.keys(dsp1Blocks!);
    expect(dsp1Keys.length).toBeGreaterThan(0);
    // DSP1 should restart numbering at block0
    expect(dsp1Keys).toContain("block0");

    // Count non-cab blocks per DSP in the signal chain for verification
    const dsp0NonCabCount = spec.signalChain.filter(b => b.dsp === 0 && b.type !== "cab").length;
    const dsp1NonCabCount = spec.signalChain.filter(b => b.dsp === 1 && b.type !== "cab").length;

    // The number of block keys per DSP should match the non-cab block count
    expect(dsp0Keys.length).toBe(dsp0NonCabCount);
    expect(dsp1Keys.length).toBe(dsp1NonCabCount);
  });

  it("when snapshot blockStates use global keys, .hlx output correctly maps to per-DSP keys", () => {
    // Build a spec where snapshots use global sequential keys (block0, block1, block2...)
    // The snapshot-engine intentionally produces global keys, and preset-builder's
    // buildBlockKeyMap should remap them to per-DSP keys

    const intent = highGainIntent();
    const chain = assembleSignalChain(intent);
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);

    // Verify that the snapshot engine produces global sequential keys
    const snap0 = snapshots[0];
    const allBlockKeys = Object.keys(snap0.blockStates);
    // Global keys should be block0, block1, block2, ..., blockN sequentially
    const nonCabBlocks = parameterized.filter(b => b.type !== "cab");
    expect(allBlockKeys.length).toBe(nonCabBlocks.length);

    // Now build the full preset spec and HLX file
    const spec: PresetSpec = {
      name: "Global Key Test",
      description: "Tests global-to-per-DSP key remapping",
      tempo: 120,
      signalChain: parameterized,
      snapshots,
    };
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec);

    // In the HLX output, snapshot blocks should be per-DSP keyed
    const hlxSnap0 = hlx.data.tone.snapshot0;

    // DSP0 blocks should have per-DSP keys starting at block0
    const hlxDsp0Keys = Object.keys(hlxSnap0.blocks?.dsp0 || {});
    expect(hlxDsp0Keys).toContain("block0");

    // DSP1 blocks should ALSO start at block0 (not continue from DSP0's last index)
    const hlxDsp1Keys = Object.keys(hlxSnap0.blocks?.dsp1 || {});
    expect(hlxDsp1Keys).toContain("block0");

    // Verify that no DSP1 key has an index >= total DSP0 non-cab block count
    // (which would indicate global numbering leaked through)
    const dsp0NonCabCount = parameterized.filter(b => b.dsp === 0 && b.type !== "cab").length;
    for (const key of hlxDsp1Keys) {
      const match = key.match(/^block(\d+)$/);
      if (match) {
        const idx = parseInt(match[1]);
        // Per-DSP numbering means DSP1 block indices should be less than DSP1's block count
        const dsp1NonCabCount = parameterized.filter(b => b.dsp === 1 && b.type !== "cab").length;
        expect(idx).toBeLessThan(dsp1NonCabCount);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// HX Stomp + HX Stomp XL (STOMP-01 through STOMP-05, STOMP-10)
// ---------------------------------------------------------------------------

describe("HX Stomp + HX Stomp XL (STOMP-01 through STOMP-05, STOMP-10)", () => {
  // STOMP-01: Device IDs confirmed from real hardware exports
  it("STOMP-01: helix_stomp device ID is 2162694", () => {
    expect(DEVICE_IDS.helix_stomp).toBe(2162694);
  });
  it("STOMP-01: helix_stomp_xl device ID is 2162699", () => {
    expect(DEVICE_IDS.helix_stomp_xl).toBe(2162699);
  });
  it("STOMP-01: Stomp IDs differ from LT, Floor, Pod Go, and Stadium", () => {
    const ids = Object.values(DEVICE_IDS);
    expect(DEVICE_IDS.helix_stomp).not.toBe(DEVICE_IDS.helix_lt);
    expect(DEVICE_IDS.helix_stomp).not.toBe(DEVICE_IDS.helix_floor);
    expect(DEVICE_IDS.helix_stomp).not.toBe(DEVICE_IDS.pod_go);
    expect(DEVICE_IDS.helix_stomp).not.toBe(DEVICE_IDS.helix_stadium);
    expect(DEVICE_IDS.helix_stomp_xl).not.toBe(DEVICE_IDS.helix_stomp);
    // All IDs must be unique
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("STOMP-01: isStomp() returns true for both Stomp variants", () => {
    expect(isStomp("helix_stomp")).toBe(true);
    expect(isStomp("helix_stomp_xl")).toBe(true);
    expect(isStomp("helix_lt")).toBe(false);
    expect(isStomp("helix_floor")).toBe(false);
    expect(isStomp("pod_go")).toBe(false);
    expect(isStomp("helix_stadium")).toBe(false);
  });

  // STOMP-02: STOMP_CONFIG constants
  it("STOMP-02: STOMP_CONFIG has correct block limits", () => {
    expect(STOMP_CONFIG.STOMP_MAX_BLOCKS).toBe(6);
    expect(STOMP_CONFIG.STOMP_XL_MAX_BLOCKS).toBe(9);
  });
  it("STOMP-02: STOMP_CONFIG has correct snapshot counts", () => {
    expect(STOMP_CONFIG.STOMP_MAX_SNAPSHOTS).toBe(3);
    expect(STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS).toBe(4);
  });
  it("STOMP-02: STOMP_CONFIG has correct I/O model names", () => {
    expect(STOMP_CONFIG.STOMP_INPUT_MODEL).toBe("HelixStomp_AppDSPFlowInput");
    expect(STOMP_CONFIG.STOMP_OUTPUT_MAIN_MODEL).toBe("HelixStomp_AppDSPFlowOutputMain");
    expect(STOMP_CONFIG.STOMP_OUTPUT_SEND_MODEL).toBe("HelixStomp_AppDSPFlowOutputSend");
  });

  // STOMP-03: buildStompFile output structure
  it("STOMP-03: buildStompFile(spec, helix_stomp) has correct device ID", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = {
      name: "Test Stomp",
      description: "Test",
      tempo: 120,
      signalChain: parameterized,
      snapshots: snapshots.slice(0, STOMP_CONFIG.STOMP_MAX_SNAPSHOTS),
    };
    const file = buildStompFile(spec, "helix_stomp");
    expect(file.data.device).toBe(2162694);
    expect(file.data.device).toBe(DEVICE_IDS.helix_stomp);
    expect(file.schema).toBe("L6Preset");
  });
  it("STOMP-03: buildStompFile(spec, helix_stomp_xl) has correct device ID", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp_xl");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = {
      name: "Test Stomp XL",
      description: "Test",
      tempo: 120,
      signalChain: parameterized,
      snapshots: snapshots.slice(0, STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS),
    };
    const file = buildStompFile(spec, "helix_stomp_xl");
    expect(file.data.device).toBe(2162699);
    expect(file.data.device).toBe(DEVICE_IDS.helix_stomp_xl);
  });
  it("STOMP-03: Stomp output uses HelixStomp_* I/O models (not HD2_App*)", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots: snapshots.slice(0, 3) };
    const file = buildStompFile(spec, "helix_stomp");
    const tone = file.data.tone as unknown as Record<string, unknown>;
    const dsp0 = tone.dsp0 as Record<string, unknown>;
    const inputA = dsp0.inputA as Record<string, unknown>;
    const outputA = dsp0.outputA as Record<string, unknown>;
    expect(inputA["@model"]).toBe("HelixStomp_AppDSPFlowInput");
    expect(outputA["@model"]).toBe("HelixStomp_AppDSPFlowOutputMain");
    expect((inputA["@model"] as string).startsWith("HD2_")).toBe(false);
  });
  it("STOMP-03: Stomp dsp1 is empty", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots: snapshots.slice(0, 3) };
    const file = buildStompFile(spec, "helix_stomp");
    const tone = file.data.tone as unknown as Record<string, unknown>;
    expect(tone.dsp1).toEqual({});
  });
  it("STOMP-03: Stomp has 3 valid snapshots (indices 0-2 @valid:true, 3-7 @valid:false)", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots: snapshots.slice(0, 3) };
    const file = buildStompFile(spec, "helix_stomp");
    const tone = file.data.tone as unknown as Record<string, unknown>;
    for (let i = 0; i < 3; i++) {
      const snap = tone[`snapshot${i}`] as Record<string, unknown>;
      expect(snap["@valid"]).toBe(true);
    }
    for (let i = 3; i < 8; i++) {
      const snap = tone[`snapshot${i}`] as Record<string, unknown>;
      expect(snap["@valid"]).toBe(false);
    }
  });
  it("STOMP-03: Stomp XL has 4 valid snapshots (indices 0-3 @valid:true, 4-7 @valid:false)", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp_xl");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots: snapshots.slice(0, 4) };
    const file = buildStompFile(spec, "helix_stomp_xl");
    const tone = file.data.tone as unknown as Record<string, unknown>;
    for (let i = 0; i < 4; i++) {
      const snap = tone[`snapshot${i}`] as Record<string, unknown>;
      expect(snap["@valid"]).toBe(true);
    }
    for (let i = 4; i < 8; i++) {
      const snap = tone[`snapshot${i}`] as Record<string, unknown>;
      expect(snap["@valid"]).toBe(false);
    }
  });

  // STOMP-04: chain-rules enforces single DSP
  it("STOMP-04: assembleSignalChain forces all Stomp blocks to dsp0", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    expect(chain.every(b => b.dsp === 0)).toBe(true);
  });
  it("STOMP-04: assembleSignalChain forces all Stomp XL blocks to dsp0", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp_xl");
    expect(chain.every(b => b.dsp === 0)).toBe(true);
  });

  // STOMP-05: validate.ts enforces limits
  it("STOMP-05: validatePresetSpec accepts valid Stomp preset", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots).slice(0, 3);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots };
    expect(() => validatePresetSpec(spec, "helix_stomp")).not.toThrow();
  });
  it("STOMP-05: validatePresetSpec accepts valid Stomp XL preset", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp_xl");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots).slice(0, 4);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots };
    expect(() => validatePresetSpec(spec, "helix_stomp_xl")).not.toThrow();
  });
  it("STOMP-05: validatePresetSpec rejects Stomp preset with too many snapshots", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots); // 4 snapshots from engine
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots };
    // 4 snapshots exceeds Stomp's max of 3
    expect(() => validatePresetSpec(spec, "helix_stomp")).toThrow(/snapshot limit exceeded/);
  });

  // STOMP-10: Regression — existing devices unaffected
  it("STOMP-10: Helix LT generation still works after Stomp additions", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_lt");
    // LT uses dual DSP — eq and gain block go to dsp1
    expect(chain.some(b => b.dsp === 1)).toBe(true);
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "Test LT", description: "Test", tempo: 120, signalChain: parameterized, snapshots };
    expect(() => validatePresetSpec(spec, "helix_lt")).not.toThrow();
    const file = buildHlxFile(spec, "helix_lt");
    expect(file.data.device).toBe(DEVICE_IDS.helix_lt);
  });
  it("STOMP-10: summarizeStompPreset returns a non-empty string with device info", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snapshots = buildSnapshots(parameterized, intent.snapshots).slice(0, 3);
    const spec: PresetSpec = { name: "Test", description: "Test", tempo: 120, signalChain: parameterized, snapshots };
    const summary = summarizeStompPreset(spec, "helix_stomp");
    expect(summary).toContain("HX Stomp");
    expect(summary).toContain("Test");
  });
});

// ---------------------------------------------------------------------------
// HX Stomp end-to-end pipeline (STOMP-06 simulation)
// ---------------------------------------------------------------------------

describe("HX Stomp end-to-end pipeline (STOMP-06 simulation)", () => {
  it("STOMP-06: Full Stomp pipeline: chain -> params -> snapshots -> validate -> build", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp");
    const parameterized = resolveParameters(chain, intent);
    const snaps = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = {
      name: "Pipeline Test Stomp",
      description: "Full pipeline test",
      tempo: 120,
      signalChain: parameterized,
      snapshots: snaps.slice(0, STOMP_CONFIG.STOMP_MAX_SNAPSHOTS),
    };

    expect(() => validatePresetSpec(spec, "helix_stomp")).not.toThrow();

    const file = buildStompFile(spec, "helix_stomp");
    expect(file.data.device).toBe(2162694);
    expect(file.schema).toBe("L6Preset");

    expect(chain.every(b => b.dsp === 0)).toBe(true);
  });

  it("STOMP-06: Full Stomp XL pipeline produces valid output with 4 snapshots", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_stomp_xl");
    const parameterized = resolveParameters(chain, intent);
    const snaps = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = {
      name: "Pipeline Test Stomp XL",
      description: "Full pipeline test",
      tempo: 120,
      signalChain: parameterized,
      snapshots: snaps.slice(0, STOMP_CONFIG.STOMP_XL_MAX_SNAPSHOTS),
    };
    expect(() => validatePresetSpec(spec, "helix_stomp_xl")).not.toThrow();
    const file = buildStompFile(spec, "helix_stomp_xl");
    expect(file.data.device).toBe(2162699);
  });

  it("STOMP-10: Regression — Helix LT pipeline unaffected by Stomp additions", () => {
    const intent = cleanIntent();
    const chain = assembleSignalChain(intent, "helix_lt");
    const parameterized = resolveParameters(chain, intent);
    const snaps = buildSnapshots(parameterized, intent.snapshots);
    const spec: PresetSpec = { name: "LT Regression", description: "Test", tempo: 120, signalChain: parameterized, snapshots: snaps };
    expect(() => validatePresetSpec(spec, "helix_lt")).not.toThrow();
    const file = buildHlxFile(spec, "helix_lt");
    expect(file.data.device).toBe(DEVICE_IDS.helix_lt);
  });

  it("STOMP-08: mapRigToSubstitutions does not throw for helix_stomp", () => {
    const mockRigIntent = {
      pedals: [{
        brand: "Boss",
        model: "DS-1",
        fullName: "Boss DS-1",
        knobPositions: {},
        imageIndex: 0,
        confidence: "high" as const,
      }],
    };
    expect(() => mapRigToSubstitutions(mockRigIntent, "helix_stomp")).not.toThrow();
  });

  it("STOMP-08: mapRigToSubstitutions does not throw for helix_stomp_xl", () => {
    const mockRigIntent = {
      pedals: [{
        brand: "Ibanez",
        model: "TS9",
        fullName: "Ibanez TS9",
        knobPositions: {},
        imageIndex: 0,
        confidence: "high" as const,
      }],
    };
    expect(() => mapRigToSubstitutions(mockRigIntent, "helix_stomp_xl")).not.toThrow();
  });
});
