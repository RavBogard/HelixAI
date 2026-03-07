"use client";

import { SignalChainCanvas } from "@/components/visualizer/SignalChainCanvas";
import { ParameterEditorPane } from "@/components/visualizer/ParameterEditorPane";

/**
 * /visualizer page — full-page signal chain visualizer.
 *
 * Renders the SignalChainCanvas (main content area) and ParameterEditorPane
 * (side panel that appears when a block is selected).
 *
 * Currently shows "No preset loaded" since the store starts empty.
 * The chat page will hydrate the store via /api/preview and navigate here
 * (Phase 83 integration scope).
 */
export default function VisualizerPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-semibold mb-6 font-[family-name:var(--font-primary)]">
          Signal Chain Visualizer
        </h1>
        <div className="flex">
          <div className="flex-1">
            <SignalChainCanvas />
          </div>
          <ParameterEditorPane />
        </div>
      </div>
    </div>
  );
}
