// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SnapshotSelectorBar } from "./SnapshotSelectorBar";
import { useVisualizerStore } from "@/lib/visualizer/store";
import type { SnapshotSpec, BlockSpec, DeviceTarget } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  device: "helix_lt" as DeviceTarget,
  baseBlocks: [] as BlockSpec[],
  snapshots: [
    { name: "Snapshot 1", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 2", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 3", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    { name: "Snapshot 4", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
  ] as SnapshotSpec[],
  activeSnapshotIndex: 0,
  selectedBlockId: null as string | null,
};

afterEach(() => {
  cleanup();
  useVisualizerStore.setState({
    ...INITIAL_STATE,
    snapshots: [...INITIAL_STATE.snapshots.map((s) => ({ ...s }))],
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SnapshotSelectorBar", () => {
  it("renders 4 snapshot buttons", () => {
    render(<SnapshotSelectorBar />);

    expect(screen.getByTestId("snapshot-btn-0")).toBeDefined();
    expect(screen.getByTestId("snapshot-btn-1")).toBeDefined();
    expect(screen.getByTestId("snapshot-btn-2")).toBeDefined();
    expect(screen.getByTestId("snapshot-btn-3")).toBeDefined();
  });

  it("highlights active snapshot button with aria-selected", () => {
    useVisualizerStore.setState({ activeSnapshotIndex: 2 });
    render(<SnapshotSelectorBar />);

    expect(screen.getByTestId("snapshot-btn-2").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("snapshot-btn-0").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("snapshot-btn-1").getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("snapshot-btn-3").getAttribute("aria-selected")).toBe("false");
  });

  it("clicking snapshot button calls setActiveSnapshot", () => {
    render(<SnapshotSelectorBar />);

    fireEvent.click(screen.getByTestId("snapshot-btn-1"));
    expect(useVisualizerStore.getState().activeSnapshotIndex).toBe(1);

    fireEvent.click(screen.getByTestId("snapshot-btn-3"));
    expect(useVisualizerStore.getState().activeSnapshotIndex).toBe(3);
  });

  it("displays snapshot names from store", () => {
    const namedSnapshots: SnapshotSpec[] = [
      { name: "Clean", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Crunch", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Lead", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
      { name: "Ambient", description: "", ledColor: 0, blockStates: {}, parameterOverrides: {} },
    ];
    useVisualizerStore.setState({ snapshots: namedSnapshots });
    render(<SnapshotSelectorBar />);

    expect(screen.getByTestId("snapshot-btn-0").textContent).toBe("Clean");
    expect(screen.getByTestId("snapshot-btn-1").textContent).toBe("Crunch");
    expect(screen.getByTestId("snapshot-btn-2").textContent).toBe("Lead");
    expect(screen.getByTestId("snapshot-btn-3").textContent).toBe("Ambient");
  });

  it("uses default labels when snapshot names are generic", () => {
    render(<SnapshotSelectorBar />);

    expect(screen.getByTestId("snapshot-btn-0").textContent).toBe("Snapshot 1");
    expect(screen.getByTestId("snapshot-btn-1").textContent).toBe("Snapshot 2");
    expect(screen.getByTestId("snapshot-btn-2").textContent).toBe("Snapshot 3");
    expect(screen.getByTestId("snapshot-btn-3").textContent).toBe("Snapshot 4");
  });

  it("has data-testid on container", () => {
    render(<SnapshotSelectorBar />);
    expect(screen.getByTestId("snapshot-selector-bar")).toBeDefined();
  });
});
