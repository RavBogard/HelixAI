// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useVisualizerStore } from "@/lib/visualizer/store";
import { ParameterEditorPane } from "./ParameterEditorPane";
import type { BlockSpec, DeviceTarget, SnapshotSpec } from "@/lib/helix/types";

afterEach(() => {
  cleanup();
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

function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
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

describe("ParameterEditorPane", () => {
  it("renders nothing when selectedBlockId is null", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock()],
      snapshots: makeSnapshots(),
      selectedBlockId: null,
    });

    const { container } = render(<ParameterEditorPane />);
    expect(container.innerHTML).toBe("");
  });

  it("renders panel with block modelName when a block is selected", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0 })],
      snapshots: makeSnapshots(),
      selectedBlockId: "amp0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByTestId("parameter-editor-pane")).toBeTruthy();
    expect(screen.getByText("US Double Nrm")).toBeTruthy();
  });

  it("renders block type label", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock({ type: "reverb", modelName: "Glitz", position: 3 })],
      snapshots: makeSnapshots(),
      selectedBlockId: "reverb3",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("reverb")).toBeTruthy();
  });

  it("renders 'Parameter editing coming soon' placeholder text", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock()],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("Parameter editing coming soon")).toBeTruthy();
  });

  it("clicking close button calls selectBlock(null)", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock()],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);

    fireEvent.click(screen.getByTestId("close-editor-btn"));
    expect(useVisualizerStore.getState().selectedBlockId).toBeNull();
  });

  it("renders nothing when selectedBlockId references a non-existent block", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock()],
      snapshots: makeSnapshots(),
      selectedBlockId: "nonexistent99",
    });

    const { container } = render(<ParameterEditorPane />);
    expect(container.innerHTML).toBe("");
  });
});
