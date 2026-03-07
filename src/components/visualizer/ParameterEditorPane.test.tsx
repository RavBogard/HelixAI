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
// Core rendering tests
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
    expect(screen.getByRole("heading", { name: "US Double Nrm" })).toBeTruthy();
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

// ---------------------------------------------------------------------------
// Parameter rendering tests
// ---------------------------------------------------------------------------

describe("ParameterEditorPane parameter rendering", () => {
  it("renders slider controls for visible parameters", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          parameters: { Drive: 0.5, Mix: 0.3 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByTestId("param-slider-Drive")).toBeTruthy();
    expect(screen.getByTestId("param-slider-Mix")).toBeTruthy();
  });

  it("excludes internal cab IR parameters from rendering", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "amp",
          modelName: "US Deluxe Nrm",
          parameters: {
            Drive: 0.5,
            AmpCabZFir: 0,
            AmpCabPeakFc: 100,
            Bass: 0.6,
          },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "amp0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByTestId("param-slider-Drive")).toBeTruthy();
    expect(screen.getByTestId("param-slider-Bass")).toBeTruthy();
    expect(screen.queryByTestId("param-slider-AmpCabZFir")).toBeNull();
    expect(screen.queryByTestId("param-slider-AmpCabPeakFc")).toBeNull();
  });

  it("shows percentage display value (Drive=0.5 shows 50%)", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({ parameters: { Drive: 0.5 } }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows eq_gain display value (LowGain=0.5 shows 0dB)", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "eq",
          modelId: "HD2_EQParametric",
          modelName: "Parametric EQ",
          parameters: { LowGain: 0.5 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "eq0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("0.0dB")).toBeTruthy();
  });

  it("shows time_ms display value (Time=0.375 shows 750ms)", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({ parameters: { Time: 0.375 } }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("750ms")).toBeTruthy();
  });

  it("renders discrete parameter (Mic) as dropdown", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "cab",
          modelId: "HD2_CabMicIr",
          modelName: "Cab",
          parameters: { Mic: 0 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "cab0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByTestId("param-dropdown-Mic")).toBeTruthy();
    // First option should be SM57
    const dropdown = screen.getByLabelText("Mic dropdown") as HTMLSelectElement;
    expect(dropdown.options[0].text).toBe("SM57");
  });

  it("shows 'No editable parameters' when block has empty params", () => {
    useVisualizerStore.setState({
      baseBlocks: [makeBlock({ parameters: {} })],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByText("No editable parameters")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Phase 81-02: Snapshot reactivity tests
// ---------------------------------------------------------------------------

describe("ParameterEditorPane snapshot reactivity", () => {
  it("shows effective value from active snapshot override", () => {
    const snapshots = makeSnapshots();
    // Snapshot 0 overrides amp0 Drive to 0.3
    snapshots[0].parameterOverrides = { amp0: { Drive: 0.3 } };

    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "amp",
          modelName: "US Double Nrm",
          position: 0,
          parameters: { Drive: 0.5 },
        }),
      ],
      snapshots,
      activeSnapshotIndex: 0,
      selectedBlockId: "amp0",
    });

    render(<ParameterEditorPane />);
    // Display value should show 30% (0.3 override), not 50% (0.5 base)
    expect(screen.getByText("30%")).toBeTruthy();
  });

  it("switching snapshot updates displayed parameter values", async () => {
    const { act } = await import("@testing-library/react");
    const snapshots = makeSnapshots();
    snapshots[0].parameterOverrides = { amp0: { Drive: 0.3 } };
    snapshots[1].parameterOverrides = { amp0: { Drive: 0.7 } };

    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "amp",
          modelName: "US Double Nrm",
          position: 0,
          parameters: { Drive: 0.5 },
        }),
      ],
      snapshots,
      activeSnapshotIndex: 0,
      selectedBlockId: "amp0",
    });

    render(<ParameterEditorPane />);
    // Snap 0: Drive override = 0.3 -> shows 30%
    expect(screen.getByText("30%")).toBeTruthy();

    // Switch to snapshot 1
    act(() => {
      useVisualizerStore.getState().setActiveSnapshot(1);
    });

    // Snap 1: Drive override = 0.7 -> shows 70%
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.queryByText("30%")).toBeNull();
  });

  it("shows base value when active snapshot has no override", () => {
    const snapshots = makeSnapshots();
    // Snapshot 0: empty parameterOverrides

    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "amp",
          modelName: "US Double Nrm",
          position: 0,
          parameters: { Drive: 0.5 },
        }),
      ],
      snapshots,
      activeSnapshotIndex: 0,
      selectedBlockId: "amp0",
    });

    render(<ParameterEditorPane />);
    // Should show base value: 50%
    expect(screen.getByText("50%")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Interaction tests
// ---------------------------------------------------------------------------

describe("ParameterEditorPane interactions", () => {
  it("slider change writes converted raw value to store", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({ parameters: { Drive: 0.5 } }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "delay0",
    });

    render(<ParameterEditorPane />);
    const slider = screen.getByLabelText("Drive slider") as HTMLInputElement;
    // Change to 75% (display) -> 0.75 (raw)
    fireEvent.change(slider, { target: { value: "75" } });

    const state = useVisualizerStore.getState();
    const overrides = state.snapshots[0].parameterOverrides["delay0"];
    expect(overrides).toBeDefined();
    expect(overrides["Drive"]).toBe(0.75);
  });

  it("dropdown change writes selected index to store", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "cab",
          modelId: "HD2_CabMicIr",
          modelName: "Cab",
          parameters: { Mic: 0 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "cab0",
    });

    render(<ParameterEditorPane />);
    const dropdown = screen.getByLabelText("Mic dropdown");
    fireEvent.change(dropdown, { target: { value: "2" } });

    const state = useVisualizerStore.getState();
    const overrides = state.snapshots[0].parameterOverrides["cab0"];
    expect(overrides).toBeDefined();
    expect(overrides["Mic"]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Model swap tests
// ---------------------------------------------------------------------------

describe("ParameterEditorPane model swap", () => {
  it("renders model swap dropdown with same-type models", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "distortion",
          modelId: "HD2_DistScream808",
          modelName: "Scream 808",
          parameters: { Drive: 0.1, Tone: 0.45, Level: 0.65 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "distortion0",
    });

    render(<ParameterEditorPane />);
    expect(screen.getByTestId("model-swap-dropdown")).toBeTruthy();
    // Should contain Minotaur as one of the options
    const dropdown = screen.getByLabelText("Swap model") as HTMLSelectElement;
    const optionTexts = Array.from(dropdown.options).map((o) => o.text);
    expect(optionTexts).toContain("Minotaur");
    expect(optionTexts).toContain("Scream 808");
  });

  it("swapping model calls swapBlockModel and resets params to defaults", () => {
    useVisualizerStore.setState({
      baseBlocks: [
        makeBlock({
          type: "distortion",
          modelId: "HD2_DistScream808",
          modelName: "Scream 808",
          position: 0,
          parameters: { Drive: 0.1, Tone: 0.45, Level: 0.65 },
        }),
      ],
      snapshots: makeSnapshots(),
      selectedBlockId: "distortion0",
    });

    render(<ParameterEditorPane />);
    const dropdown = screen.getByLabelText("Swap model");
    fireEvent.change(dropdown, { target: { value: "HD2_DistMinotaur" } });

    const state = useVisualizerStore.getState();
    const block = state.baseBlocks[0];
    expect(block.modelId).toBe("HD2_DistMinotaur");
    expect(block.modelName).toBe("Minotaur");
    // Minotaur's defaults: Gain: 0.20, Treble: 0.50, Output: 0.60
    expect(block.parameters).toEqual({ Gain: 0.20, Treble: 0.50, Output: 0.60 });
  });
});
