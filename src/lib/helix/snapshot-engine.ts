// src/lib/helix/snapshot-engine.ts
// Snapshot generation module -- produces 4 volume-balanced snapshots from
// a parameterized signal chain. Block states are deterministic lookup tables
// derived from expert preset analysis. No AI-generated state values.
//
// Public API: buildSnapshots(chain, intents) -> SnapshotSpec[]

import type { BlockSpec, SnapshotSpec, AmpCategory } from "./types";
import type { SnapshotIntent } from "./tone-intent";
import { AMP_MODELS, STADIUM_AMPS, LED_COLORS } from "./models";

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
// Ambient Mix override amounts (INTL-02)
// When ambient snapshot enables time-based effects, boost their Mix above
// the base genre/model default by this delta (clamped to 0-1).
// ---------------------------------------------------------------------------

const AMBIENT_MIX_BOOST = 0.15; // +15% Mix for delay/reverb in ambient snapshot

// ---------------------------------------------------------------------------
// Block state table by role and block type (SNAP-05, INTL-02)
// Returns whether a block should be enabled (true) or bypassed (false).
// Now uses intentRole when available for smarter toggling.
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
    if (role === "clean") {
      return ampCategory !== "clean";
    }
    return true;
  }

  // --- intentRole-based toggling (INTL-02) ---
  // When intentRole is set (from AI's EffectIntent), use it for smarter decisions.

  const intentRole = block.intentRole;

  // "always_on" effects stay ON in every snapshot
  if (intentRole === "always_on") {
    return true;
  }

  // "ambient" effects: ON for ambient and lead, OFF for clean
  if (intentRole === "ambient") {
    return role === "ambient" || role === "lead";
  }

  // --- Type-based fallback (original logic, used when intentRole is undefined) ---

  // Distortion / drive blocks: OFF for clean snapshot (INTL-02)
  if (block.type === "distortion") {
    if (role === "clean") return false;
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
  // For dual-amp, use the primary amp (path 0) for category detection (DUAL-05)
  const ampBlock = chain.find((b) => b.type === "amp" && b.path === 0)
    || chain.find((b) => b.type === "amp");
  if (!ampBlock) return "clean";

  const model = STADIUM_AMPS[ampBlock.modelName] ?? AMP_MODELS[ampBlock.modelName];
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

  // Identify amp entries for parameter overrides (DUAL-05)
  const ampEntries = blockEntries.filter((e) => e.block.type === "amp");
  const primaryAmpEntry = ampEntries.find((e) => e.block.path === 0);
  const secondaryAmpEntry = ampEntries.find((e) => e.block.path === 1);
  const isDualAmp = ampEntries.length > 1 && !!primaryAmpEntry && !!secondaryAmpEntry;
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

    // DUAL-AMP BYPASS TOGGLE (DUAL-05)
    // Convention: clean/crunch use primary amp, lead/ambient use secondary amp
    // Note: cabs are excluded from blockEntries (handled separately by preset-builder).
    // Amp bypass is sufficient — when an amp is bypassed on its path, the cab on that
    // same path naturally produces no amp signal.
    if (isDualAmp && primaryAmpEntry && secondaryAmpEntry) {
      const usePrimary = role === "clean" || role === "crunch";
      blockStates[primaryAmpEntry.key] = usePrimary;
      blockStates[secondaryAmpEntry.key] = !usePrimary;
    }

    // Build parameter overrides
    const parameterOverrides: Record<string, Record<string, number>> = {};

    // ChVol overrides: dual-amp gets independent overrides on both amps (DUAL-05)
    if (isDualAmp) {
      if (primaryAmpEntry) {
        parameterOverrides[primaryAmpEntry.key] = {
          ChVol: ROLE_CHVOL[role] ?? 0.70,
        };
      }
      if (secondaryAmpEntry) {
        parameterOverrides[secondaryAmpEntry.key] = {
          ChVol: ROLE_CHVOL[role] ?? 0.70,
        };
      }
    } else if (primaryAmpEntry) {
      // Single-amp (existing behavior)
      parameterOverrides[primaryAmpEntry.key] = {
        ChVol: ROLE_CHVOL[role] ?? 0.70,
      };
    }

    if (gainEntry) {
      parameterOverrides[gainEntry.key] = {
        Gain: ROLE_GAIN_DB[role] ?? 0.0,
      };
    }

    // Ambient Mix boost (INTL-02): elevate delay/reverb Mix in ambient snapshot
    if (role === "ambient") {
      for (const entry of blockEntries) {
        if (
          (entry.block.type === "delay" || entry.block.type === "reverb") &&
          blockStates[entry.key] === true
        ) {
          const baseMix = entry.block.parameters?.Mix;
          if (baseMix !== undefined && typeof baseMix === "number") {
            const boostedMix = Math.min(baseMix + AMBIENT_MIX_BOOST, 1.0);
            parameterOverrides[entry.key] = {
              ...(parameterOverrides[entry.key] ?? {}),
              Mix: boostedMix,
            };
          }
        }
      }
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
