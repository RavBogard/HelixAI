"use client";

import { useVisualizerStore } from "@/lib/visualizer/store";

export function SnapshotSelectorBar() {
  const snapshots = useVisualizerStore((s) => s.snapshots);
  const activeSnapshotIndex = useVisualizerStore(
    (s) => s.activeSnapshotIndex,
  );
  const setActiveSnapshot = useVisualizerStore((s) => s.setActiveSnapshot);

  return (
    <div
      className="flex gap-2 items-center"
      data-testid="snapshot-selector-bar"
      role="tablist"
      aria-label="Snapshot selector"
    >
      {snapshots.map((snap, index) => {
        const isActive = index === activeSnapshotIndex;
        return (
          <button
            key={index}
            type="button"
            role="tab"
            aria-pressed={isActive}
            aria-selected={isActive}
            className={[
              "px-3 py-1.5 rounded text-sm font-medium transition-colors",
              isActive
                ? "bg-blue-600 text-white ring-2 ring-blue-400"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700",
            ].join(" ")}
            onClick={() => setActiveSnapshot(index)}
            data-testid={`snapshot-btn-${index}`}
          >
            {snap.name || `Snap ${index + 1}`}
          </button>
        );
      })}
    </div>
  );
}
