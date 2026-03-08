import { describe, it, expect, vi } from "vitest";
import { validatePresetSpec } from "./validate";
import { getCapabilities } from "./device-family";
import type { PresetSpec, BlockSpec, SnapshotSpec } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec>): BlockSpec {
  return {
    type: "amp",
    modelId: "HD2_AmpUSDeluxeNrm",
    modelName: "US Deluxe Nrm",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<SnapshotSpec> = {}): SnapshotSpec {
  return {
    name: "SNAPSHOT 1",
    description: "Test snapshot",
    ledColor: 0,
    blockStates: {},
    parameterOverrides: {},
    ...overrides,
  };
}

function makeSpec(chain: BlockSpec[], snapshots?: SnapshotSpec[]): PresetSpec {
  return {
    name: "Test Preset",
    description: "Test",
    tempo: 120,
    signalChain: chain,
    snapshots: snapshots ?? [makeSnapshot()],
  };
}

const helixCaps = getCapabilities("helix_floor");
const podGoCaps = getCapabilities("pod_go");

// ---------------------------------------------------------------------------
// DSP ordering validation (MED-02)
// ---------------------------------------------------------------------------

describe("DSP ordering validation", () => {
  it("correctly ordered chain produces no warnings", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const chain = [
      makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur", dsp: 0, position: 0 }),
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm", dsp: 0, position: 1 }),
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe", dsp: 0, position: 2 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelay", modelName: "Simple Delay", dsp: 1, position: 0 }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate", dsp: 1, position: 1 }),
    ];
    validatePresetSpec(makeSpec(chain), helixCaps);
    const orderingWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes("DSP ordering"));
    expect(orderingWarns).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it("out-of-order chain produces warnings but does not throw", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // reverb before delay on DSP1 — out of order
    const chain = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm", dsp: 0, position: 0 }),
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe", dsp: 0, position: 1 }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlate", modelName: "Plate", dsp: 1, position: 0 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelay", modelName: "Simple Delay", dsp: 1, position: 1 }),
    ];
    // Should not throw
    expect(() => validatePresetSpec(makeSpec(chain), helixCaps)).not.toThrow();
    const orderingWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes("DSP ordering"));
    expect(orderingWarns.length).toBeGreaterThan(0);
    warnSpy.mockRestore();
  });

  it("single-DSP device checks ordering on dsp0", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    // amp before distortion — out of order
    const chain = [
      makeBlock({ type: "amp", modelId: "HD2_AmpUSDeluxeNrm", modelName: "US Deluxe Nrm", dsp: 0, position: 0 }),
      makeBlock({ type: "distortion", modelId: "HD2_DistMinotaur", modelName: "Minotaur", dsp: 0, position: 1 }),
      makeBlock({ type: "cab", modelId: "HD2_CabMicIr_1x12USDeluxe", modelName: "1x12 US Deluxe", dsp: 0, position: 2 }),
      makeBlock({ type: "delay", modelId: "HD2_DelaySimpleDelayMono", modelName: "Simple Delay", dsp: 0, position: 3 }),
      makeBlock({ type: "reverb", modelId: "HD2_ReverbPlateMono", modelName: "Plate", dsp: 0, position: 4 }),
    ];
    const pgpSnapshots = [
      makeSnapshot(), makeSnapshot(), makeSnapshot(), makeSnapshot(),
    ];
    expect(() => validatePresetSpec(makeSpec(chain, pgpSnapshots), podGoCaps)).not.toThrow();
    const orderingWarns = warnSpy.mock.calls.filter(c => String(c[0]).includes("DSP ordering"));
    expect(orderingWarns.length).toBeGreaterThan(0);
    warnSpy.mockRestore();
  });
});
