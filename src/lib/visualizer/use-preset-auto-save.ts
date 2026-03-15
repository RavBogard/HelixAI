"use client";

import { useEffect, useRef } from "react";
import { useVisualizerStore } from "./store";
import { useShallow } from "zustand/react/shallow";
import type { PresetSpec } from "../helix/types";

/**
 * Subscribes to the visualizer store and automatically syncs changes to
 * the database. Uses a 3-second debounce to prevent spamming the API 
 * during rapid slider drag operations.
 */
export function usePresetAutoSave(conversationId: string | null) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to raw changes on the active preset state subset.
  // Using useShallow prevents infinite render loops caused by returning a new object reference.
  const state = useVisualizerStore(
    useShallow((s) => ({
      name: s.presetName,
      description: s.description,
      tempo: s.tempo,
      baseBlocks: s.baseBlocks,
      snapshots: s.snapshots,
    }))
  );

  // To prevent an immediate save on first load (hydration), we track if the
  // data has actually mutated since the hook mounted.
  const isHydratedRef = useRef(false);

  useEffect(() => {
    // Skip the first execution caused by initial render hydration.
    if (!isHydratedRef.current) {
      isHydratedRef.current = true;
      return;
    }

    if (!conversationId) return; // Cannot save if not bound to a DB row

    // Reconstruct the PresetSpec from sliced Zustand state
    const currentSpec: PresetSpec = {
      name: state.name,
      description: state.description,
      tempo: state.tempo,
      signalChain: state.baseBlocks,
      snapshots: state.snapshots,
    };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce 3000ms: wait for the user to finish turning the knob
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/conversations/${conversationId}/preset`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updatedSpec: currentSpec }),
        });
      } catch (err) {
        console.error("Auto-sync failed:", err);
      }
    }, 3000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [state, conversationId]);
}
