// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ModelBrowserDropdown } from "./ModelBrowserDropdown";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModelBrowserDropdown", () => {
  const defaultProps = {
    targetDsp: 0 as const,
    targetPosition: 3,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  it("renders category headings for all 7 effect types", () => {
    render(<ModelBrowserDropdown {...defaultProps} />);

    expect(screen.getByText("Distortion")).toBeTruthy();
    expect(screen.getByText("Delay")).toBeTruthy();
    expect(screen.getByText("Reverb")).toBeTruthy();
    expect(screen.getByText("Modulation")).toBeTruthy();
    expect(screen.getByText("Dynamics")).toBeTruthy();
    expect(screen.getByText("EQ")).toBeTruthy();
    expect(screen.getByText("Wah")).toBeTruthy();
  });

  it("clicking a category toggles its expanded state", () => {
    render(<ModelBrowserDropdown {...defaultProps} />);

    // Click Delay category to expand
    fireEvent.click(screen.getByText("Delay"));

    // Model names should now be visible
    expect(screen.getByText("Simple Delay")).toBeTruthy();

    // Click again to collapse
    fireEvent.click(screen.getByText("Delay"));

    // Model names should be hidden
    expect(screen.queryByText("Simple Delay")).toBeNull();
  });

  it("clicking a model name calls onSelect with correct (type, modelId, modelName)", () => {
    const onSelect = vi.fn();
    render(<ModelBrowserDropdown {...defaultProps} onSelect={onSelect} />);

    // Expand Distortion category
    fireEvent.click(screen.getByText("Distortion"));

    // Click "Scream 808"
    fireEvent.click(screen.getByText("Scream 808"));

    expect(onSelect).toHaveBeenCalledWith("distortion", "HD2_DistScream808", "Scream 808");
  });

  it("dropdown closes after selection (onClose called)", () => {
    const onClose = vi.fn();
    render(<ModelBrowserDropdown {...defaultProps} onClose={onClose} />);

    // Expand and select
    fireEvent.click(screen.getByText("Delay"));
    fireEvent.click(screen.getByText("Simple Delay"));

    expect(onClose).toHaveBeenCalled();
  });

  it("disabled state renders reason text and prevents interaction", () => {
    const onSelect = vi.fn();
    render(
      <ModelBrowserDropdown
        {...defaultProps}
        onSelect={onSelect}
        disabled={true}
        disabledReason="Block limit reached (8/8)"
      />,
    );

    // Should show disabled reason text
    expect(screen.getByText("Block limit reached (8/8)")).toBeTruthy();

    // Should have disabled visual state
    const container = screen.getByTestId("model-browser-dropdown");
    expect(container.className).toContain("opacity-50");
  });
});
