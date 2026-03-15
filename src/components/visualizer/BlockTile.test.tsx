// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BlockTile } from "./BlockTile";
import type { BlockSpec } from "@/lib/helix/types";
import type { FootswitchAssignment } from "@/lib/visualizer/controller-assignments";

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    type: "delay",
    modelId: "HD2_DelaySimpleDelay",
    modelName: "Simple Delay",
    dsp: 0,
    position: 2,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BlockTile", () => {
  it("renders the model name text", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("Simple Delay")).toBeTruthy();
  });

  it("applies correct background color from registry for delay type", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.style.backgroundColor).toBe("rgb(113, 166, 87)"); // #71A657
  });

  it("bypassed block (enabled=false) has opacity-40 class", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={false}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).toContain("opacity-40");
  });

  it("active block (enabled=true) does NOT have opacity-40 class", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).not.toContain("opacity-40");
  });

  it("selected block has ring-2 class", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={true}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).toContain("ring-2");
  });

  it("unselected block does NOT have ring-2 class", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).not.toContain("ring-2");
  });

  it("wide block (amp) has w-28 class", () => {
    render(
      <BlockTile
        block={makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0 })}
        blockId="amp0"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-amp0");
    expect(tile.className).toContain("w-28");
  });

  it("narrow block (volume) has w-16 class", () => {
    render(
      <BlockTile
        block={makeBlock({ type: "volume", modelName: "Gain", position: 5 })}
        blockId="volume5"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    const tile = screen.getByTestId("block-tile-volume5");
    expect(tile.className).toContain("w-16");
  });

  it("clicking tile calls onSelect with correct blockId", () => {
    const onSelect = vi.fn();
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("block-tile-delay2"));
    expect(onSelect).toHaveBeenCalledWith("delay2");
  });

  it("renders data-testid attribute", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByTestId("block-tile-delay2")).toBeTruthy();
  });

  it("renders lock indicator when isLocked is true", () => {
    render(
      <BlockTile
        block={makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0 })}
        blockId="amp0"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        isLocked={true}
      />,
    );
    // Lock emoji should be present somewhere in the tile
    const tile = screen.getByTestId("block-tile-amp0");
    expect(tile.textContent).toContain("\uD83D\uDD12");
  });

  // --------------------------------------------------
  // Phase 79-02: onRemove and isDragging props
  // --------------------------------------------------

  it("renders X remove button when onRemove is provided", () => {
    const onRemove = vi.fn();
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        onRemove={onRemove}
      />,
    );
    const removeBtn = screen.getByTestId("remove-btn-delay2");
    expect(removeBtn).toBeTruthy();
  });

  it("does NOT render X remove button when onRemove is not provided", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByTestId("remove-btn-delay2")).toBeNull();
  });

  it("does NOT render X remove button when isLocked is true even if onRemove provided", () => {
    const onRemove = vi.fn();
    render(
      <BlockTile
        block={makeBlock({ type: "amp", modelName: "US Double Nrm", position: 0 })}
        blockId="amp0"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        onRemove={onRemove}
        isLocked={true}
      />,
    );
    expect(screen.queryByTestId("remove-btn-amp0")).toBeNull();
  });

  it("clicking X remove button calls onRemove and does NOT call onSelect", () => {
    const onRemove = vi.fn();
    const onSelect = vi.fn();
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={onSelect}
        onRemove={onRemove}
      />,
    );
    fireEvent.click(screen.getByTestId("remove-btn-delay2"));
    expect(onRemove).toHaveBeenCalledWith("delay2");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("applies isDragging visual state (opacity-50)", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        isDragging={true}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).toContain("opacity-50");
  });

  it("does NOT have isDragging opacity when isDragging is false", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        isDragging={false}
      />,
    );
    const tile = screen.getByTestId("block-tile-delay2");
    expect(tile.className).not.toContain("opacity-50");
  });

  // --------------------------------------------------
  // Phase 82-02: Footswitch badge rendering
  // --------------------------------------------------

  it("renders FS badge with correct text when footswitchAssignment is provided", () => {
    const fsAssignment: FootswitchAssignment = {
      blockId: "delay2",
      fsIndex: 5,
      label: "Simple DLY",
      ledColor: "#00FF00",
    };
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        footswitchAssignment={fsAssignment}
      />,
    );
    const badge = screen.getByTestId("fs-badge-delay2");
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("FS5");
  });

  it("FS badge has correct background color from ledColor", () => {
    const fsAssignment: FootswitchAssignment = {
      blockId: "delay2",
      fsIndex: 6,
      label: "Simple DLY",
      ledColor: "#FF0000",
    };
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
        footswitchAssignment={fsAssignment}
      />,
    );
    const badge = screen.getByTestId("fs-badge-delay2");
    expect(badge.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("does not render FS badge when footswitchAssignment is null/undefined", () => {
    render(
      <BlockTile
        block={makeBlock()}
        blockId="delay2"
        enabled={true}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByTestId("fs-badge-delay2")).toBeNull();
  });
});
