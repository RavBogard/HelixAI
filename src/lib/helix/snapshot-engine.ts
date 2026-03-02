// src/lib/helix/snapshot-engine.ts
// Snapshot generation module -- produces 4 volume-balanced snapshots from
// a parameterized signal chain. Block states are deterministic lookup tables
// derived from expert preset analysis. No AI-generated state values.
//
// Public API: buildSnapshots(chain, intents) -> SnapshotSpec[]

import type { BlockSpec, SnapshotSpec, AmpCategory } from "./types";
import type { SnapshotIntent } from "./tone-intent";
import { AMP_MODELS, LED_COLORS } from "./models";

// ---------------------------------------------------------------------------
// LED color mapping by tone role
// ---------------------------------------------------------------------------

const ROLE_LED: Record<string, number> = {
  clean: LED_COLORS.BLUE,       // 6
  crunch: LED_COLORS.ORANGE,    // 2
  lead: LED_COLORS.RED,         // 1
  ambient: LED_COLORS.TURQUOISE, // 5
};

// ---------------------------------------------------------------------------
// Volume balancing: ChVol per role (SNAP-02)
// ---------------------------------------------------------------------------

const ROLE_CHVOL: Record<string, number> = {
  clean: 0.68,
  crunch: 0.72,
  lead: 0.80,
  ambient: 0.65,
};

// ---------------------------------------------------------------------------
// Gain Block dB per role (SNAP-03)
// Lead gets +2.5 dB for audible presence above other snapshots
// ---------------------------------------------------------------------------

const ROLE_GAIN_DB: Record<string, number> = {
  clean: 0.0,
  crunch: 0.0,
  lead: 2.5,
  ambient: 0.0,
};

// ---------------------------------------------------------------------------
// Snapshot descriptions by role
// ---------------------------------------------------------------------------

const ROLE_DESCRIPTION: Record<string, string> = {
  clean: "Clean tone with transparent dynamics and natural amp response",
  crunch: "Rhythm crunch with controlled gain and tight low end",
  lead: "Lead tone with +2.5 dB boost for cutting through the mix",
  ambient: "Ambient wash with modulation, delay, and reverb fully engaged",
};

// ---------------------------------------------------------------------------
// Known boost model IDs (Minotaur / Scream 808)
// ---------------------------------------------------------------------------

const BOOST_MODEL_IDS = new Set([
  "HD2_DistMinotaur",
  "HD2_DistScream808",
]);

// ---------------------------------------------------------------------------
// Block state table by role and block type (SNAP-05)
// Returns whether a block should be enabled (true) or bypassed (false).
// ---------------------------------------------------------------------------

interface BlockContext {
  block: BlockSpec;
  isBoost: boolean;
  ampCategory: AmpCategory;
}

function getBlockEnabled(
  role: string,
  ctx: BlockContext,
): boolean {
  const { block, isBoost, ampCategory } = ctx;

  // Amp, EQ (post-cab parametric), and Gain Block (volume) are always ON
  if (block.type === "amp" || block.type === "eq" || block.type === "volume") {
    return true;
  }

  // Dynamics (gate) -- always ON when present
  if (block.type === "dynamics") {
    return true;
  }

  // Boost pedal (Minotaur or Scream 808)
  if (isBoost) {
    // Clean snapshot: OFF for clean amps, ON for crunch/high-gain
    if (role === "clean") {
      return ampCategory !== "clean";
    }
    // All other snapshots: boost ON
    return true;
  }

  // Distortion / drive blocks (AI-added, not boost)
  if (block.type === "distortion") {
    // OFF for clean and ambient; ON for crunch and lead
    return role === "crunch" || role === "lead";
  }

  // Delay
  if (block.type === "delay") {
    return role === "lead" || role === "ambient";
  }

  // Reverb -- always ON
  if (block.type === "reverb") {
    return true;
  }

  // Modulation -- only ON for ambient
  if (block.type === "modulation") {
    return role === "ambient";
  }

  // Wah, pitch, send_return -- default ON
  return true;
}

// ---------------------------------------------------------------------------
// Block key generation
// Uses global sequential numbering across both DSPs (block0, block1, ...).
// The preset-builder's buildBlockKeyMap() maps these global keys to the
// correct per-DSP keys, so global keys are safe to use in SnapshotSpec.
// ---------------------------------------------------------------------------

interface BlockKeyEntry {
  key: string;
  block: BlockSpec;
}

function buildBlockKeys(chain: BlockSpec[]): BlockKeyEntry[] {
  const entries: BlockKeyEntry[] = [];
  let globalIdx = 0;

  for (const block of chain) {
    if (block.type === "cab") continue;
    entries.push({ key: `block${globalIdx}`, block });
    globalIdx++;
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Detect amp category from the chain
// ---------------------------------------------------------------------------

function detectAmpCategory(chain: BlockSpec[]): AmpCategory {
  const ampBlock = chain.find((b) => b.type === "amp");
  if (!ampBlock) return "clean";

  const model = AMP_MODELS[ampBlock.modelName];
  return model?.ampCategory ?? "clean";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate volume-balanced snapshots from a parameterized signal chain.
 *
 * Each snapshot has:
 * - LED color mapped from the tone role
 * - Block states for every non-cab block (enabled/bypassed per the state table)
 * - Parameter overrides for amp ChVol (volume balancing) and Gain Block (lead boost)
 *
 * Does NOT mutate the input chain.
 *
 * @param chain - Fully parameterized signal chain from resolveParameters()
 * @param intents - Exactly 4 SnapshotIntent objects defining the snapshot roles
 * @returns 4 SnapshotSpec objects ready for PresetSpec
 */
export function buildSnapshots(
  chain: BlockSpec[],
  intents: SnapshotIntent[],
): SnapshotSpec[] {
  const ampCategory = detectAmpCategory(chain);
  const blockEntries = buildBlockKeys(chain);

  // Identify amp and gain block keys for parameter overrides
  const ampEntry = blockEntries.find((e) => e.block.type === "amp");
  const gainEntry = blockEntries.find((e) => e.block.type === "volume");

  return intents.map((intent) => {
    const role = intent.toneRole;

    // Build block states
    const blockStates: Record<string, boolean> = {};
    for (const entry of blockEntries) {
      const isBoost = BOOST_MODEL_IDS.has(entry.block.modelId);
      blockStates[entry.key] = getBlockEnabled(role, {
        block: entry.block,
        isBoost,
        ampCategory,
      });
    }

    // Build parameter overrides
    const parameterOverrides: Record<string, Record<string, number>> = {};

    if (ampEntry) {
      parameterOverrides[ampEntry.key] = {
        ChVol: ROLE_CHVOL[role] ?? 0.70,
      };
    }

    if (gainEntry) {
      parameterOverrides[gainEntry.key] = {
        Gain: ROLE_GAIN_DB[role] ?? 0.0,
      };
    }

    return {
      name: intent.name,
      description: ROLE_DESCRIPTION[role] ?? `${intent.name} snapshot`,
      ledColor: ROLE_LED[role] ?? LED_COLORS.WHITE,
      blockStates,
      parameterOverrides,
    };
  });
}
