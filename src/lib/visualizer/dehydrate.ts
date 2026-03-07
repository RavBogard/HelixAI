// dehydrateToPresetSpec — Phase 83, Plan 01
// Reverse of hydrateVisualizerState: converts the visualizer store shape
// (baseBlocks + snapshots + meta) back into a PresetSpec for device builders.
//
// This is a pure identity-style transform: the builders expect signalChain
// (parameterized blocks) and separate snapshots with overrides — which is
// exactly how the store holds the data.

import type { BlockSpec, SnapshotSpec, PresetSpec } from "@/lib/helix/types";

/**
 * Convert visualizer state (baseBlocks + snapshots + metadata) back into
 * a PresetSpec that device builders (buildHlxFile, buildPgpFile, etc.)
 * can consume.
 *
 * - signalChain = baseBlocks (identity — the blocks ARE the signal chain)
 * - snapshots = snapshots array (pass through — builders handle the format)
 * - name, description, tempo from metadata
 */
export function dehydrateToPresetSpec(
  baseBlocks: BlockSpec[],
  snapshots: SnapshotSpec[],
  meta: { presetName: string; description: string; tempo: number },
): PresetSpec {
  return {
    name: meta.presetName,
    description: meta.description,
    tempo: meta.tempo,
    signalChain: baseBlocks,
    snapshots,
  };
}
