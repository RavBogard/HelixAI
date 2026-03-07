"use client";

import {
  useVisualizerStore,
  getEffectiveBlockState,
} from "@/lib/visualizer/store";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ParameterEditorPane renders a side panel when a block is selected.
 * Shows model name, type, and a "coming soon" placeholder for parameter editing.
 * Full parameter editing UI is Phase 80's scope.
 */
export function ParameterEditorPane() {
  const selectedBlockId = useVisualizerStore((s) => s.selectedBlockId);
  const selectBlock = useVisualizerStore((s) => s.selectBlock);

  if (selectedBlockId === null) {
    return null;
  }

  // Get the effective block state (snapshot-aware)
  const state = useVisualizerStore.getState();
  const block = getEffectiveBlockState(state, selectedBlockId);

  if (!block) {
    return null;
  }

  return (
    <div
      className="w-80 bg-gray-900 border-l border-gray-700 p-4 flex flex-col gap-4"
      data-testid="parameter-editor-pane"
    >
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-white">{block.modelName}</h2>
        <button
          onClick={() => selectBlock(null)}
          className="text-gray-400 hover:text-white"
          aria-label="Close parameter editor"
          data-testid="close-editor-btn"
        >
          X
        </button>
      </div>
      <span className="text-xs text-gray-400 uppercase">{block.type}</span>
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
        Parameter editing coming soon
      </div>
    </div>
  );
}
