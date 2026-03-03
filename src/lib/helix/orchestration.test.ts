// src/lib/helix/orchestration.test.ts
// End-to-end orchestration pipeline tests covering HLX-01 through HLX-04.
// Tests the full pipeline: Knowledge Layer -> validatePresetSpec -> buildHlxFile
// with device target support and snapshot block key rebuilding.

import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";
import { resolveParameters } from "./param-engine";
import { buildSnapshots } from "./snapshot-engine";
import { buildHlxFile } from "./preset-builder";
import { validatePresetSpec } from "./validate";
import { DEVICE_IDS } from "./types";
import type { PresetSpec, BlockSpec, DeviceTarget, HlxFile } from "./types";
import type { ToneIntent, SnapshotIntent } from "./tone-intent";

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

  it("buildHlxFile with device='helix_floor' produces .hlx with device=2162691", () => {
    const spec = buildPresetSpec(cleanIntent());
    validatePresetSpec(spec);
    const hlx = buildHlxFile(spec, "helix_floor");

    expect(hlx.data.device).toBe(DEVICE_IDS.helix_floor);
    expect(hlx.data.device).toBe(2162691);
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
