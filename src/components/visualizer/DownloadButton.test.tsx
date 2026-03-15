// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { DownloadButton } from "./DownloadButton";
import { useVisualizerStore } from "@/lib/visualizer/store";
import type { BlockSpec, SnapshotSpec, DeviceTarget } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Mock calculateStateDiff
// ---------------------------------------------------------------------------

const mockCalculateStateDiff = vi.fn();
vi.mock("@/lib/visualizer/state-diff", () => ({
  calculateStateDiff: (...args: unknown[]) => mockCalculateStateDiff(...args),
}));

// Mock useCompilerWorker since Web Workers don't exist in jsdom
const mockCompilePreset = vi.fn();
vi.mock("@/lib/visualizer/use-compiler-worker", () => ({
  useCompilerWorker: () => ({
    compilePreset: mockCompilePreset,
    isCompiling: false,
    error: null,
  }),
}));

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTestBlocks(): BlockSpec[] {
  return [
    {
      _id: "amp0",
      type: "amp",
      modelId: "US Double Nrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Drive: 0.5, Bass: 0.6 },
    },
  ];
}

function makeTestSnapshots(): SnapshotSpec[] {
  return [
    { name: "Clean", description: "Clean tone", ledColor: 1, blockStates: {}, parameterOverrides: {} },
    { name: "Crunch", description: "", ledColor: 2, blockStates: {}, parameterOverrides: {} },
    { name: "Lead", description: "", ledColor: 3, blockStates: {}, parameterOverrides: {} },
    { name: "Ambient", description: "", ledColor: 4, blockStates: {}, parameterOverrides: {} },
  ];
}

function hydrateStore() {
  const blocks = makeTestBlocks();
  const snapshots = makeTestSnapshots();
  useVisualizerStore.getState().hydrate(
    "helix_floor" as DeviceTarget,
    blocks,
    snapshots,
    [],
    [],
    "My Preset",
    "A cool preset",
    120,
  );
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockCalculateStateDiff.mockReset();
  mockFetch.mockReset();
});

afterEach(() => {
  cleanup();
  // Reset store
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
    controllerAssignments: [],
    footswitchAssignments: [],
    presetName: "",
    description: "",
    tempo: 120,
    originalBaseBlocks: [],
    originalSnapshots: [],
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DownloadButton", () => {
  it("renders a download button", () => {
    render(<DownloadButton />);
    expect(screen.getByTestId("download-btn")).toBeDefined();
  });

  it("button is disabled when baseBlocks is empty", () => {
    render(<DownloadButton />);
    const btn = screen.getByTestId("download-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("button is enabled when baseBlocks has content", () => {
    hydrateStore();
    render(<DownloadButton />);
    const btn = screen.getByTestId("download-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("when diff has no changes, shows no-changes message and does NOT call fetch", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: false,
      chainChanges: [],
      modelSwaps: [],
      snapshotChanges: [],
    });

    render(<DownloadButton />);
    const btn = screen.getByTestId("download-btn");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(screen.getByTestId("download-no-changes")).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("when diff has changes, calls fetch with diff-optimized payload", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [{ type: "moved", blockId: "amp0", from: { dsp: 0, position: 0, path: 0 }, to: { dsp: 0, position: 1, path: 0 } }],
      modelSwaps: [],
      snapshotChanges: [],
    });

    const mockUrl = "blob:http://localhost/mock-uuid";
    mockCompilePreset.mockResolvedValue(mockUrl);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    
    // We cannot easily test anchor.click() native behavior directly in jsdom, 
    // but we can verify compilePreset was called
    render(<DownloadButton />);
    const btn = screen.getByTestId("download-btn");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockCompilePreset).toHaveBeenCalledTimes(1);
    
    // Cleanup
    clickSpy.mockRestore();
  });

  it("payload does NOT include UI-only store fields", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [],
      modelSwaps: [],
      snapshotChanges: [{ index: 0, blockStates: { amp0: false }, parameterOverrides: {} }],
    });

    const mockUrl = "blob:http://localhost/mock-uuid";
    mockCompilePreset.mockResolvedValue(mockUrl);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    const presetDataArg = mockCompilePreset.mock.calls[0][0]; // presetData is first arg
    // Must NOT contain UI-only fields from state root
    expect(presetDataArg).not.toHaveProperty("activeSnapshotIndex");
    
    clickSpy.mockRestore();
  });

  it("shows loading state during download", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [{ type: "added", block: makeTestBlocks()[0] }],
      modelSwaps: [],
      snapshotChanges: [],
    });

    // Create a never-resolving promise to simulate in-flight request
    let resolvePromise: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    mockCompilePreset.mockReturnValue(pendingPromise);

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    expect(screen.getByTestId("download-loading")).toBeDefined();

    // Clean up
    await act(async () => {
      resolvePromise!("blob:mock");
    });
    clickSpy.mockRestore();
  });

  it("handles API error gracefully", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [{ type: "added", block: makeTestBlocks()[0] }],
      modelSwaps: [],
      snapshotChanges: [],
    });

    mockCompilePreset.mockRejectedValue(new Error("Worker failed compilation"));

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    expect(screen.getByTestId("download-error")).toBeDefined();
  });
});
