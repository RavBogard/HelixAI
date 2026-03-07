import { describe, it, expect } from "vitest";
import type { DeviceTarget } from "@/lib/helix/types";
import {
  getDeviceLayout,
  getPodGoSlotForBlock,
  POD_GO_FIXED_SLOTS,
} from "./device-layout";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Record<string, unknown> = {}) {
  return {
    type: "delay" as const,
    modelId: "HD2_DelaySimpleDelay",
    modelName: "Simple Delay",
    dsp: 0 as const,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getDeviceLayout — all 9 DeviceTarget values
// ---------------------------------------------------------------------------

describe("getDeviceLayout", () => {
  it("helix_floor returns dual-dsp", () => {
    const layout = getDeviceLayout("helix_floor");
    expect(layout.mode).toBe("dual-dsp");
    expect(layout.dspCount).toBe(2);
  });

  it("helix_lt returns dual-dsp", () => {
    const layout = getDeviceLayout("helix_lt");
    expect(layout.mode).toBe("dual-dsp");
    expect(layout.dspCount).toBe(2);
  });

  it("helix_rack returns dual-dsp", () => {
    const layout = getDeviceLayout("helix_rack");
    expect(layout.mode).toBe("dual-dsp");
    expect(layout.dspCount).toBe(2);
  });

  it("helix_stomp returns single-dsp", () => {
    const layout = getDeviceLayout("helix_stomp");
    expect(layout.mode).toBe("single-dsp");
    expect(layout.dspCount).toBe(1);
  });

  it("helix_stomp_xl returns single-dsp", () => {
    const layout = getDeviceLayout("helix_stomp_xl");
    expect(layout.mode).toBe("single-dsp");
    expect(layout.dspCount).toBe(1);
  });

  it("pod_go returns pod-go-fixed with 9 slots", () => {
    const layout = getDeviceLayout("pod_go");
    expect(layout.mode).toBe("pod-go-fixed");
    expect(layout.dspCount).toBe(1);
    if (layout.mode === "pod-go-fixed") {
      expect(layout.slots).toHaveLength(9);
    }
  });

  it("pod_go_xl returns pod-go-fixed with 9 slots", () => {
    const layout = getDeviceLayout("pod_go_xl");
    expect(layout.mode).toBe("pod-go-fixed");
    if (layout.mode === "pod-go-fixed") {
      expect(layout.slots).toHaveLength(9);
    }
  });

  it("helix_stadium returns single-dsp (all blocks on dsp=0)", () => {
    const layout = getDeviceLayout("helix_stadium");
    expect(layout.mode).toBe("single-dsp");
    expect(layout.dspCount).toBe(1);
  });

  it("helix_stadium_xl returns single-dsp", () => {
    const layout = getDeviceLayout("helix_stadium_xl");
    expect(layout.mode).toBe("single-dsp");
    expect(layout.dspCount).toBe(1);
  });

  it("all 9 device targets return a valid layout", () => {
    const devices: DeviceTarget[] = [
      "helix_lt",
      "helix_floor",
      "helix_rack",
      "pod_go",
      "pod_go_xl",
      "helix_stadium",
      "helix_stadium_xl",
      "helix_stomp",
      "helix_stomp_xl",
    ];
    for (const device of devices) {
      const layout = getDeviceLayout(device);
      expect(["dual-dsp", "single-dsp", "pod-go-fixed"]).toContain(layout.mode);
    }
  });
});

// ---------------------------------------------------------------------------
// POD_GO_FIXED_SLOTS
// ---------------------------------------------------------------------------

describe("POD_GO_FIXED_SLOTS", () => {
  it("has exactly 9 entries", () => {
    expect(POD_GO_FIXED_SLOTS).toHaveLength(9);
  });

  it("slot order is Wah-Vol-FX1-Amp-Cab-EQ-FX2-FX3-FX4", () => {
    const labels = POD_GO_FIXED_SLOTS.map((s) => s.label);
    expect(labels).toEqual(["Wah", "Vol", "FX1", "Amp", "Cab", "EQ", "FX2", "FX3", "FX4"]);
  });

  it("Wah, Vol, Amp, Cab, EQ are locked", () => {
    const lockedLabels = POD_GO_FIXED_SLOTS.filter((s) => s.locked).map((s) => s.label);
    expect(lockedLabels).toEqual(["Wah", "Vol", "Amp", "Cab", "EQ"]);
  });

  it("FX1, FX2, FX3, FX4 are not locked (flexible)", () => {
    const flexLabels = POD_GO_FIXED_SLOTS.filter((s) => !s.locked).map((s) => s.label);
    expect(flexLabels).toEqual(["FX1", "FX2", "FX3", "FX4"]);
  });

  it("each slot has a sequential slotIndex 0-8", () => {
    for (let i = 0; i < 9; i++) {
      expect(POD_GO_FIXED_SLOTS[i].slotIndex).toBe(i);
    }
  });
});

// ---------------------------------------------------------------------------
// getPodGoSlotForBlock
// ---------------------------------------------------------------------------

describe("getPodGoSlotForBlock", () => {
  it("returns correct slot for valid index", () => {
    const block = makeBlock();
    const slot = getPodGoSlotForBlock(block, 3);
    expect(slot).not.toBeNull();
    expect(slot!.label).toBe("Amp");
    expect(slot!.locked).toBe(true);
  });

  it("returns null for negative index", () => {
    expect(getPodGoSlotForBlock(makeBlock(), -1)).toBeNull();
  });

  it("returns null for out-of-range index", () => {
    expect(getPodGoSlotForBlock(makeBlock(), 9)).toBeNull();
    expect(getPodGoSlotForBlock(makeBlock(), 100)).toBeNull();
  });
});
