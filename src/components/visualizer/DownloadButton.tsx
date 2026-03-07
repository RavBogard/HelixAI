"use client";

// DownloadButton — Phase 83, Plan 02
// Downloads the current visualizer state as a device-correct preset file.
// Uses calculateStateDiff to gate the API call: no changes = no round-trip.

import { useState } from "react";
import { useVisualizerStore } from "@/lib/visualizer/store";
import { calculateStateDiff } from "@/lib/visualizer/state-diff";

/**
 * Parse filename from Content-Disposition header.
 * Falls back to `${presetName}.hlx` if header is missing or unparseable.
 */
function parseFilename(
  contentDisposition: string | null,
  fallbackName: string,
): string {
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
    if (match?.[1]) return match[1];
  }
  return `${fallbackName}.hlx`;
}

export function DownloadButton() {
  const baseBlocks = useVisualizerStore((s) => s.baseBlocks);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noChanges, setNoChanges] = useState(false);

  const isEmpty = baseBlocks.length === 0;

  async function handleDownload() {
    setError(null);
    setNoChanges(false);

    // Read full state at click time (non-reactive — no re-render subscriptions)
    const state = useVisualizerStore.getState();
    const {
      device,
      baseBlocks: currentBlocks,
      snapshots: currentSnapshots,
      presetName,
      description,
      tempo,
      originalBaseBlocks,
      originalSnapshots,
    } = state;

    // Gate via state diff — skip API call if nothing changed
    const diff = calculateStateDiff(
      originalBaseBlocks,
      originalSnapshots,
      currentBlocks,
      currentSnapshots,
    );

    if (!diff.hasChanges) {
      setNoChanges(true);
      return;
    }

    // POST diff-optimized payload — only builder-required fields.
    // Explicitly excludes: activeSnapshotIndex, selectedBlockId,
    // controllerAssignments, footswitchAssignments, originalBaseBlocks,
    // originalSnapshots.
    setIsDownloading(true);

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device,
          baseBlocks: currentBlocks,
          snapshots: currentSnapshots,
          presetName,
          description,
          tempo,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Download failed (${response.status})`);
      }

      // Trigger browser file download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const filename = parseFilename(
        response.headers.get("content-disposition"),
        presetName || "preset",
      );

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Download failed";
      setError(message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        data-testid="download-btn"
        disabled={isEmpty || isDownloading}
        onClick={handleDownload}
        className={`
          px-4 py-2 rounded-md text-sm font-medium transition-colors
          ${
            isEmpty || isDownloading
              ? "bg-gray-700 text-gray-400 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white cursor-pointer"
          }
        `}
      >
        {isDownloading ? (
          <span data-testid="download-loading" className="flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Downloading...
          </span>
        ) : (
          "Download"
        )}
      </button>

      {noChanges && (
        <p
          data-testid="download-no-changes"
          className="text-xs text-gray-400"
        >
          No changes made — use the original file
        </p>
      )}

      {error && (
        <p data-testid="download-error" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
