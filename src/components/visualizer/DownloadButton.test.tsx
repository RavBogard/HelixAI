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

    const blob = new Blob(["fake binary"], { type: "application/octet-stream" });
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-disposition": 'attachment; filename="My Preset.hlx"' }),
      blob: () => Promise.resolve(blob),
    });

    render(<DownloadButton />);
    const btn = screen.getByTestId("download-btn");

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/download");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    // Must contain builder-required fields
    expect(body).toHaveProperty("device");
    expect(body).toHaveProperty("baseBlocks");
    expect(body).toHaveProperty("snapshots");
    expect(body).toHaveProperty("presetName");
    expect(body).toHaveProperty("description");
    expect(body).toHaveProperty("tempo");
  });

  it("payload does NOT include UI-only store fields", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [],
      modelSwaps: [],
      snapshotChanges: [{ index: 0, blockStates: { amp0: false }, parameterOverrides: {} }],
    });

    const blob = new Blob(["fake binary"], { type: "application/octet-stream" });
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-disposition": 'attachment; filename="My Preset.hlx"' }),
      blob: () => Promise.resolve(blob),
    });

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    // Must NOT contain UI-only fields
    expect(body).not.toHaveProperty("activeSnapshotIndex");
    expect(body).not.toHaveProperty("selectedBlockId");
    expect(body).not.toHaveProperty("controllerAssignments");
    expect(body).not.toHaveProperty("footswitchAssignments");
    // Must NOT contain internal diff baseline fields
    expect(body).not.toHaveProperty("originalBaseBlocks");
    expect(body).not.toHaveProperty("originalSnapshots");
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
    mockFetch.mockReturnValue(pendingPromise);

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    expect(screen.getByTestId("download-loading")).toBeDefined();

    // Clean up
    const blob = new Blob(["data"], { type: "application/octet-stream" });
    await act(async () => {
      resolvePromise!({
        ok: true,
        headers: new Headers({ "content-disposition": 'attachment; filename="test.hlx"' }),
        blob: () => Promise.resolve(blob),
      });
    });
  });

  it("handles API error gracefully", async () => {
    hydrateStore();
    mockCalculateStateDiff.mockReturnValue({
      hasChanges: true,
      chainChanges: [{ type: "added", block: makeTestBlocks()[0] }],
      modelSwaps: [],
      snapshotChanges: [],
    });

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    render(<DownloadButton />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("download-btn"));
    });

    expect(screen.getByTestId("download-error")).toBeDefined();
  });
});
