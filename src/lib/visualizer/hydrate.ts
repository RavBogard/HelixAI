// hydrateVisualizerState — transforms PresetSpec pipeline output into the shape
// the Zustand store expects. Pure function, no side effects.
//
// This is the bridge between the Knowledge Layer pipeline output and the
// frontend visualizer state.

import type { PresetSpec, BlockSpec, SnapshotSpec, DeviceTarget } from "@/lib/helix/types";
import type { ControllerAssignment, FootswitchAssignment } from "./controller-assignments";

export interface PreviewResult {
  device: DeviceTarget;
  baseBlocks: BlockSpec[];
  snapshots: [SnapshotSpec, SnapshotSpec, SnapshotSpec, SnapshotSpec];
  presetName: string;
  description: string;
  tempo: number;
  controllerAssignments: ControllerAssignment[];
  footswitchAssignments: FootswitchAssignment[];
}

/**
 * Pad/truncate a snapshot array to exactly 4 entries.
 * Helix presets generate 8 snapshots; Pod Go generates 4.
 * The visualizer always works with exactly 4.
 */
function padSnapshots(
  source: SnapshotSpec[],
): [SnapshotSpec, SnapshotSpec, SnapshotSpec, SnapshotSpec] {
  const result: SnapshotSpec[] = [];

  for (let i = 0; i < 4; i++) {
    if (i < source.length) {
      result.push(source[i]);
    } else {
      result.push({
        name: `Snapshot ${i + 1}`,
        description: "",
        ledColor: 0,
        blockStates: {},
        parameterOverrides: {},
      });
    }
  }

  return result as [SnapshotSpec, SnapshotSpec, SnapshotSpec, SnapshotSpec];
}

/**
 * Transform PresetSpec (Knowledge Layer pipeline output) into the shape
 * the Zustand visualizer store expects.
 *
 * - baseBlocks = signalChain (already fully parameterized — identity transform)
 * - snapshots = first 4 from PresetSpec, padded with empties if fewer
 * - device, presetName, description, tempo from PresetSpec metadata
 */
export function hydrateVisualizerState(
  presetSpec: PresetSpec,
  device: DeviceTarget,
  controllerAssignments?: ControllerAssignment[],
  footswitchAssignments?: FootswitchAssignment[],
): PreviewResult {
  return {
    device,
    baseBlocks: presetSpec.signalChain,
    snapshots: padSnapshots(presetSpec.snapshots),
    presetName: presetSpec.name,
    description: presetSpec.description,
    tempo: presetSpec.tempo,
    controllerAssignments: controllerAssignments ?? [],
    footswitchAssignments: footswitchAssignments ?? [],
  };
}
