// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useVisualizerStore } from "@/lib/visualizer/store";
import { SignalChainCanvas } from "./SignalChainCanvas";
import type { BlockSpec, DeviceTarget, SnapshotSpec } from "@/lib/helix/types";

afterEach(() => {
  cleanup();
  // Reset store to defaults between tests
  useVisualizerStore.setState({
    device: "helix_lt" as DeviceTarget,
    baseBlocks: [],
    snapshots: [
      { name: "Snapshot 1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Snapshot 2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Snapshot 3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Snapshot 4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    ],
    activeSnapshotIndex: 0,
    selectedBlockId: null,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec> & { _id?: string } = {}): BlockSpec {
  return {
    _id: overrides._id || `${overrides.type || "delay"}${overrides.position ?? 0}`,
    type: "delay",
    modelId: "HD2_DelaySimpleDelay",
    modelName: "Simple Delay",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

function makeSnapshots(): SnapshotSpec[] {
  return [
    { name: "Snapshot 1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SignalChainCanvas", () => {
  it("renders empty state message when baseBlocks is empty", () => {
    useVisualizerStore.setState({
      device: "helix_floor" as DeviceTarget,
      baseBlocks: [],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);
    expect(screen.getByTestId("empty-state")).toBeTruthy();
    expect(screen.getByText(/No preset loaded/)).toBeTruthy();
  });

  it("helix_floor renders dual-dsp layout with two DSP row labels", () => {
    useVisualizerStore.setState({
      device: "helix_floor" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0, dsp: 0 }),
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 0, dsp: 1 }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);
    expect(screen.getByTestId("layout-dual-dsp")).toBeTruthy();
    expect(screen.getByText("DSP 0")).toBeTruthy();
    expect(screen.getByText("DSP 1")).toBeTruthy();
  });

  it("helix_stomp renders single-dsp layout without DSP labels", () => {
    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "distortion", modelName: "Teemah!", position: 0 }),
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 1 }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);
    expect(screen.getByTestId("layout-single-dsp")).toBeTruthy();
    expect(screen.getByText("Signal Chain")).toBeTruthy();
    // Should NOT have DSP 0/DSP 1 labels
    expect(screen.queryByText("DSP 0")).toBeNull();
    expect(screen.queryByText("DSP 1")).toBeNull();
  });

  it("pod_go renders 9-slot fixed layout", () => {
    // Pod Go with blocks at positions 0 (wah), 3 (amp), 4 (cab)
    useVisualizerStore.setState({
      device: "pod_go" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "wah", modelName: "Fassel", position: 0 }),
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 3 }),
        makeBlock({ type: "cab", modelName: "4x12 Cali V30", position: 4 }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);
    expect(screen.getByTestId("layout-pod-go-fixed")).toBeTruthy();

    // Filled slots
    expect(screen.getByText("Fassel")).toBeTruthy();
    expect(screen.getByText("US Double Nrm")).toBeTruthy();
    expect(screen.getByText("4x12 Cali V30")).toBeTruthy();

    // Empty slots should show labels
    expect(screen.getByTestId("empty-slot-vol")).toBeTruthy();
    expect(screen.getByTestId("empty-slot-fx1")).toBeTruthy();
    expect(screen.getByTestId("empty-slot-eq")).toBeTruthy();
    expect(screen.getByTestId("empty-slot-fx2")).toBeTruthy();
    expect(screen.getByTestId("empty-slot-fx3")).toBeTruthy();
    expect(screen.getByTestId("empty-slot-fx4")).toBeTruthy();
  });

  it("clicking a BlockTile updates selectedBlockId in store", () => {
    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 0 }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: null,
    });

    render(<SignalChainCanvas />);

    fireEvent.click(screen.getByTestId("block-tile-delay0"));
    expect(useVisualizerStore.getState().selectedBlockId).toBe("delay0");
  });

  it("bypassed block renders as dimmed (via enabled=false from snapshot)", () => {
    const snapshots = makeSnapshots();
    // Set delay0 to bypassed in snapshot 0
    snapshots[0].blockStates["delay0"] = false;

    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 0 }),
      ],
      snapshots,
      activeSnapshotIndex: 0,
    });

    render(<SignalChainCanvas />);

    const tile = screen.getByTestId("block-tile-delay0");
    expect(tile.className).toContain("opacity-40");
  });

  it("Pod Go locked blocks pass isLocked to BlockTile", () => {
    useVisualizerStore.setState({
      device: "pod_go" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 3 }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);

    // Amp is at slot 3 (locked=true), so it should have lock indicator
    const tile = screen.getByTestId("block-tile-amp3");
    // Lock emoji should be in the tile content
    expect(tile.textContent).toContain("\uD83D\uDD12");
  });

  // --------------------------------------------------
  // Phase 79-02: DnD context and remove button wiring
  // --------------------------------------------------

  it("renders DnD context without errors (smoke test)", () => {
    useVisualizerStore.setState({
      device: "helix_floor" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0, dsp: 0 }),
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 1, dsp: 0 }),
      ],
      snapshots: makeSnapshots(),
    });

    const { container } = render(<SignalChainCanvas />);
    // DnD context wraps the layout — layout should still render
    expect(screen.getByTestId("layout-dual-dsp")).toBeTruthy();
    // Blocks should have sortable wrapper data attributes
    expect(container.querySelectorAll("[data-testid^='block-tile-']").length).toBe(2);
  });

  it("blocks have remove buttons that call store.removeBlock", () => {
    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 0 }),
        makeBlock({ type: "reverb", modelName: "Glitz", position: 1, modelId: "HD2_ReverbGlitz" }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);

    // Remove button should exist on non-locked blocks
    const removeBtn = screen.getByTestId("remove-btn-delay0");
    expect(removeBtn).toBeTruthy();

    // Click remove
    fireEvent.click(removeBtn);

    // Block should be removed from store
    const state = useVisualizerStore.getState();
    expect(state.baseBlocks.find((b) => b.type === "delay" && b.position === 0)).toBeUndefined();
  });



  // --------------------------------------------------
  // Phase 81-02: Snapshot reactivity tests
  // --------------------------------------------------

  it("canvas re-renders block bypass state when snapshot changes", async () => {
    const { act } = await import("@testing-library/react");
    const snapshots = makeSnapshots();
    // Snapshot 0: delay2 is bypassed
    snapshots[0].blockStates["delay2"] = false;
    // Snapshot 1: delay2 is enabled (or undefined = base enabled)
    snapshots[1].blockStates["delay2"] = true;

    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0 }),
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 2 }),
      ],
      snapshots,
      activeSnapshotIndex: 0,
    });

    render(<SignalChainCanvas />);

    // delay2 should be dimmed in snapshot 0
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).toContain("opacity-40");

    // Switch to snapshot 1
    act(() => {
      useVisualizerStore.getState().setActiveSnapshot(1);
    });

    // delay2 should no longer be dimmed
    const tileAfter = screen.getByTestId("block-tile-delay2");
    expect(tileAfter.className).not.toContain("opacity-40");
  });

  it("add block button renders for non-full DSP on stomp device", () => {
    useVisualizerStore.setState({
      device: "helix_stomp" as DeviceTarget,
      baseBlocks: [
        makeBlock({ type: "delay", modelName: "Simple Delay", position: 0 }),
      ],
      snapshots: makeSnapshots(),
    });

    render(<SignalChainCanvas />);
    // Add button should be available since stomp can hold up to 8 blocks
    expect(screen.getByTestId("add-block-btn")).toBeTruthy();
  });
});
