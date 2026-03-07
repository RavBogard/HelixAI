// controller-assignments.ts — Extract expression pedal and footswitch controller
// assignments from built preset data into UI-friendly types.
// Phase 82-01: Pure logic consumed by ParameterEditorPane and BlockTile.

import type { HlxControllerSection, HlxControllerAssignment } from "@/lib/helix/types";
import type { BlockSpec } from "@/lib/helix/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ControllerAssignment {
  blockId: string; // e.g., "wah0", "volume2"
  paramKey: string; // e.g., "Position"
  controller: string; // "EXP1" | "EXP2" | "EXP3"
  min: number; // 0.0
  max: number; // 1.0
}

export interface FootswitchAssignment {
  blockId: string; // e.g., "delay1"
  fsIndex: number; // 5-12 (user-facing: FS5-FS12)
  label: string; // e.g., "Simple DLY"
  ledColor: string; // hex color string, e.g., "#FF0000"
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Map numeric controller IDs to user-facing expression pedal names. */
const EXP_CONTROLLER_MAP: Record<number, string> = {
  1: "EXP1",
  2: "EXP2",
  3: "EXP3", // Stadium
};

/** Map numeric LED color values to hex strings. */
const LED_COLORS: Record<number, string> = {
  0: "#FFFFFF", // white (default)
  65536: "#FFFFFF", // white
  131072: "#FF0000", // red
  196608: "#00FF00", // green
  262144: "#0000FF", // blue
  327680: "#00FFFF", // cyan
  393216: "#FF00FF", // magenta
  458752: "#FFFF00", // yellow
};

// ---------------------------------------------------------------------------
// Block ID Map
// ---------------------------------------------------------------------------

/**
 * Build a map from preset-builder block keys ("dsp0:block0") to visualizer
 * blockIds ("wah0"). Skips cab blocks — same indexing logic as preset-builder.
 */
export function buildBlockIdMap(
  baseBlocks: BlockSpec[],
): Map<string, string> {
  const map = new Map<string, string>();

  // Group blocks by DSP, sorted by position
  const byDsp: Record<number, BlockSpec[]> = {};
  for (const block of baseBlocks) {
    if (block.type === "cab") continue; // Skip cab blocks
    if (!byDsp[block.dsp]) byDsp[block.dsp] = [];
    byDsp[block.dsp].push(block);
  }

  for (const dspKey of Object.keys(byDsp)) {
    const dspNum = Number(dspKey);
    const blocks = byDsp[dspNum].sort((a, b) => a.position - b.position);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const blockId = `${block.type}${block.position}`;
      map.set(`dsp${dspNum}:block${i}`, blockId);
    }
  }

  return map;
}

// ---------------------------------------------------------------------------
// Controller extraction
// ---------------------------------------------------------------------------

/**
 * Extract expression pedal controller assignments from the HlxFile controller
 * section. Returns only EXP pedal assignments (1, 2, 3) — filters out
 * SNAPSHOT (19) and MIDI_CC (18).
 */
export function extractControllerAssignments(
  controllerSection: HlxControllerSection | null | undefined,
  blockIdMap: Map<string, string>,
): ControllerAssignment[] {
  if (!controllerSection) return [];

  const assignments: ControllerAssignment[] = [];

  for (const dspKey of ["dsp0", "dsp1"] as const) {
    const dspBlocks = controllerSection[dspKey];
    if (!dspBlocks) continue;

    for (const [blockKey, params] of Object.entries(dspBlocks)) {
      for (const [paramKey, assignment] of Object.entries(
        params as Record<string, HlxControllerAssignment>,
      )) {
        const controllerNum = assignment["@controller"];
        const expName = EXP_CONTROLLER_MAP[controllerNum];
        if (!expName) continue; // Skip non-EXP controllers

        const blockId = blockIdMap.get(`${dspKey}:${blockKey}`);
        if (!blockId) continue; // Block not in map

        assignments.push({
          blockId,
          paramKey,
          controller: expName,
          min: assignment["@min"],
          max: assignment["@max"],
        });
      }
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Footswitch extraction
// ---------------------------------------------------------------------------

interface FootswitchBlockEntry {
  "@fs_enabled": boolean;
  "@fs_index": number;
  "@fs_label": string;
  "@fs_ledcolor": number;
  "@fs_momentary": boolean;
  "@fs_customlabel": boolean;
}

/**
 * Extract footswitch assignments from the HlxFile footswitch section.
 * Maps @fs_index to user-facing FS numbers (7->FS5, 8->FS6, etc.)
 */
export function extractFootswitchAssignments(
  footswitchSection: Record<string, Record<string, FootswitchBlockEntry>> | null | undefined,
  blockIdMap: Map<string, string>,
): FootswitchAssignment[] {
  if (!footswitchSection) return [];

  const assignments: FootswitchAssignment[] = [];

  for (const dspKey of ["dsp0", "dsp1"]) {
    const dspBlocks = footswitchSection[dspKey];
    if (!dspBlocks) continue;

    for (const [blockKey, entry] of Object.entries(dspBlocks)) {
      if (!entry["@fs_enabled"]) continue;

      const blockId = blockIdMap.get(`${dspKey}:${blockKey}`);
      if (!blockId) continue;

      // Map @fs_index to user-facing FS number: 7->5, 8->6, 9->7, 10->8
      const fsIndex = entry["@fs_index"] - 2;

      // Map LED color to hex string
      const ledColor = LED_COLORS[entry["@fs_ledcolor"]] ?? "#FFFFFF";

      assignments.push({
        blockId,
        fsIndex,
        label: entry["@fs_label"],
        ledColor,
      });
    }
  }

  return assignments;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find the controller assignment for a specific block + parameter. */
export function getControllerForParam(
  assignments: ControllerAssignment[],
  blockId: string,
  paramKey: string,
): ControllerAssignment | null {
  return (
    assignments.find(
      (a) => a.blockId === blockId && a.paramKey === paramKey,
    ) ?? null
  );
}

/** Find the footswitch assignment for a specific block. */
export function getFootswitchForBlock(
  assignments: FootswitchAssignment[],
  blockId: string,
): FootswitchAssignment | null {
  return assignments.find((a) => a.blockId === blockId) ?? null;
}
