// src/lib/helix/snapshot-engine.ts
// Snapshot generation module -- produces 4 volume-balanced snapshots from
// a parameterized signal chain. Block states are deterministic lookup tables
// derived from expert preset analysis. No AI-generated state values.
//
// Public API: buildSnapshots(chain, intents) -> SnapshotSpec[]

import type { BlockSpec, SnapshotSpec, AmpCategory } from "./types";
import type { SnapshotIntent } from "./tone-intent";
import { AMP_MODELS, STADIUM_AMPS, LED_COLORS, DYNAMICS_MODELS } from "./models";

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
// ---------------------------------------------------------------------------
// Volume balancing: Inverse Drive/ChVol Correlation (Phase 12 / SNAP-09)
// As snapshot Drive increases, physical output level (ChVol) must artificially
// decrease to maintain unity RMS gain, preventing the +3dB stacking effect from
// the virtual power amp. All explicit physical pushes are handled by Gain Block.
// ---------------------------------------------------------------------------

const BASE_DRIVE = 0.30;
const BASE_CHVOL = 0.70;
const CHVOL_COMPENSATION_COEFFICIENT = -0.35; 

function calculateCompensatedChVol(newDrive: number): number {
  const deltaDrive = newDrive - BASE_DRIVE;
  const compensated = BASE_CHVOL + (deltaDrive * CHVOL_COMPENSATION_COEFFICIENT);
  return Math.max(0.40, Math.min(1.0, compensated)); // Clamp
}

// ---------------------------------------------------------------------------
// Amp Drive per role (SNAP-06)
// Per-snapshot amp Drive control so clean snapshots actually sound clean.
// Without this, a single amp Drive value applies to all snapshots, making
// "clean" sound crunchy when the planner chose a crunch/high-gain amp.
// Values are target Drive levels per role — applied as snapshot overrides.
// Reference: Strab ORNG RV SC.hlx uses Drive min=0.350, max=0.550 as controller.
// ---------------------------------------------------------------------------

const ROLE_DRIVE: Record<string, number> = {
  clean: 0.30,   // Glassy clean, minimal breakup
  crunch: 0.50,  // Moderate grit, matches AMP_DEFAULTS.crunch
  lead: 0.60,    // Singing sustain
  ambient: 0.35, // Warm clean with slight shimmer
};

// ---------------------------------------------------------------------------
// Gain Block dB per role (SNAP-03)
// Values are RAW dB applied to the Gain Block (Volume/FX Return block).
// NOT normalized 0-1 — these are actual dB values written to the preset.
// The Gain Block's "Gain" parameter accepts dB directly:
//   0.0 = unity gain, 2.0 = +2dB boost, -3.0 = -3dB cut.
// Lead gets a boost to cut through the mix; other roles stay at unity.
// MED-08: Lead reduced from 2.5→2.0 to prevent clipping with ChVol 0.80.
// ---------------------------------------------------------------------------

const ROLE_GAIN_DB: Record<string, number> = {
  clean: 0.0,
  crunch: 0.0,
  lead: 2.0,
  ambient: 0.0,
};

// ---------------------------------------------------------------------------
// Snapshot descriptions by role
// ---------------------------------------------------------------------------

const ROLE_DESCRIPTION: Record<string, string> = {
  clean: "Clean tone with transparent dynamics and natural amp response",
  crunch: "Rhythm crunch with controlled gain and tight low end",
  lead: "Lead tone with +2.0 dB boost for cutting through the mix",
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
// Per-role effect parameter deltas (SNAP-07)
// Each role adjusts delay/reverb Mix and reverb DecayTime relative to the
// base values set by param-engine's genre defaults.
//
// clean:   No effect overrides — genre baseline is sufficient
// crunch:  Slightly reduced reverb to keep rhythm parts tight
// lead:    Boosted reverb+delay for singing sustain and presence
// ambient: Large boost for washy atmospheric sound (legacy INTL-02 values)
// ---------------------------------------------------------------------------

const ROLE_REVERB_MIX_DELTA: Record<string, number> = {
  clean: 0,
  crunch: -0.05,
  lead: 0.10,
  ambient: 0.20,   // matches legacy AMBIENT_REVERB_MIX_BOOST
};

const ROLE_REVERB_DECAY_MULT: Record<string, number> = {
  clean: 1.0,
  crunch: 1.0,
  lead: 1.2,
  ambient: 1.5,    // matches legacy AMBIENT_DECAY_MULTIPLIER
};

const ROLE_DELAY_MIX_DELTA: Record<string, number> = {
  clean: 0,
  crunch: 0,
  lead: 0.08,
  ambient: 0.25,   // matches legacy AMBIENT_DELAY_MIX_BOOST
};

// ---------------------------------------------------------------------------
// Genre-aware snapshot modifiers (SNAP-08)
// Scales the per-role deltas above based on genre. Metal wants tighter
// effects; ambient/worship wants lush washes; others use baseline.
// ---------------------------------------------------------------------------

interface GenreSnapshotModifier {
  reverbMixScale: number;
  delayMixScale: number;
}

const GENRE_SNAPSHOT_MODIFIERS: Record<string, GenreSnapshotModifier> = {
  metal:   { reverbMixScale: 0.5, delayMixScale: 0.5 },
  ambient: { reverbMixScale: 2.0, delayMixScale: 2.0 },
  worship: { reverbMixScale: 2.0, delayMixScale: 2.0 },
  blues:   { reverbMixScale: 1.2, delayMixScale: 1.0 },
  jazz:    { reverbMixScale: 1.2, delayMixScale: 1.0 },
};

const DEFAULT_GENRE_MODIFIER: GenreSnapshotModifier = {
  reverbMixScale: 1.0,
  delayMixScale: 1.0,
};

function matchGenreModifier(genreHint?: string): GenreSnapshotModifier {
  if (!genreHint) return DEFAULT_GENRE_MODIFIER;
  const hint = genreHint.toLowerCase();
  if (GENRE_SNAPSHOT_MODIFIERS[hint]) return GENRE_SNAPSHOT_MODIFIERS[hint];
  for (const [genre, mod] of Object.entries(GENRE_SNAPSHOT_MODIFIERS)) {
    if (hint.includes(genre)) return mod;
  }
  return DEFAULT_GENRE_MODIFIER;
}

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

  // COHERE-04: Dynamics type split — compressor vs gate behavior
  if (block.type === "dynamics") {
    const dynModel = DYNAMICS_MODELS[block.modelName];
    if (dynModel?.category === "compressor") {
      // Compressor: OFF for high-gain lead/crunch (natural tube compression sufficient)
      if (ampCategory === "high_gain" && (role === "lead" || role === "crunch")) {
        return false;
      }
      return true;
    }
    // Gate + Autoswell + unknown dynamics: always ON (existing behavior)
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
 * - Parameter overrides for amp ChVol (volume balancing), Gain Block (lead boost),
 *   and per-role effect Mix/DecayTime (SNAP-07/SNAP-08)
 *
 * Does NOT mutate the input chain.
 *
 * @param chain - Fully parameterized signal chain from resolveParameters()
 * @param intents - SnapshotIntent objects defining the snapshot roles
 * @param genreHint - Optional genre for genre-modulated snapshot tuning (SNAP-08)
 * @returns SnapshotSpec objects ready for PresetSpec
 */
export function buildSnapshots(
  chain: BlockSpec[],
  intents: SnapshotIntent[],
  genreHint?: string,
  snapshotTweaks?: Record<string, Record<string, number>>
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
      // COHERE-03: Use slot field for boost detection, fallback to model ID for backward compat
      const isBoost = entry.block.slot === "boost" ||
        (!entry.block.slot && BOOST_MODEL_IDS.has(entry.block.modelId));
      blockStates[entry.key] = getBlockEnabled(role, {
        block: entry.block,
        isBoost,
        ampCategory,
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // DUAL-AMP BYPASS TOGGLE (DUAL-05)
    // ═══════════════════════════════════════════════════════════════════
    // Primary amp (path=0): Clean/crunch tones — typically a lower-gain amp
    // Secondary amp (path=1): Lead/ambient tones — typically a higher-gain amp
    //
    // The snapshot engine toggles amps per role:
    //   clean/crunch → primary ON, secondary BYPASSED
    //   lead/ambient → primary BYPASSED, secondary ON
    //
    // Both amps receive the same ChVol override per role (ROLE_CHVOL).
    // Amp selection (which model goes on which path) is determined by
    // chain-rules.ts, NOT by snapshot-engine. This engine only toggles.
    //
    // Cabs are excluded from blockEntries (handled separately by
    // preset-builder). Amp bypass is sufficient — when an amp is bypassed
    // on its path, the cab on that same path naturally produces no signal.
    // ═══════════════════════════════════════════════════════════════════
    if (isDualAmp && primaryAmpEntry && secondaryAmpEntry) {
      const usePrimary = role === "clean" || role === "crunch";
      blockStates[primaryAmpEntry.key] = usePrimary;
      blockStates[secondaryAmpEntry.key] = !usePrimary;
    }

    // Build parameter overrides
    const parameterOverrides: Record<string, Record<string, number>> = {};

    // ChVol + Drive overrides: dual-amp gets independent overrides on both amps (DUAL-05, SNAP-06)
    if (isDualAmp) {
      if (primaryAmpEntry) {
        const drive = ROLE_DRIVE[role] ?? 0.50;
        parameterOverrides[primaryAmpEntry.key] = {
          ChVol: calculateCompensatedChVol(drive),
          Drive: drive,
        };
      }
      if (secondaryAmpEntry) {
        const drive = ROLE_DRIVE[role] ?? 0.50;
        parameterOverrides[secondaryAmpEntry.key] = {
          ChVol: calculateCompensatedChVol(drive),
          Drive: drive,
        };
      }
    } else if (primaryAmpEntry) {
      // Single-amp
      const drive = ROLE_DRIVE[role] ?? 0.50;
      parameterOverrides[primaryAmpEntry.key] = {
        ChVol: calculateCompensatedChVol(drive),
        Drive: drive,
      };
    }

    if (gainEntry) {
      parameterOverrides[gainEntry.key] = {
        Gain: ROLE_GAIN_DB[role] ?? 0.0,
      };
    }

    // Per-role effect parameter overrides (SNAP-07/SNAP-08)
    // Adjusts reverb Mix/DecayTime and delay Mix per snapshot role.
    // Genre modifier scales the deltas (metal=tight, ambient/worship=lush).
    // Clean role has zero deltas so no overrides are emitted (preserves base params).
    const genreMod = matchGenreModifier(genreHint);
    const reverbMixDelta = (ROLE_REVERB_MIX_DELTA[role] ?? 0) * genreMod.reverbMixScale;
    const reverbDecayMult = ROLE_REVERB_DECAY_MULT[role] ?? 1.0;
    const delayMixDelta = (ROLE_DELAY_MIX_DELTA[role] ?? 0) * genreMod.delayMixScale;

    for (const entry of blockEntries) {
      // Delay Mix override — only for enabled delay blocks with nonzero delta
      if (entry.block.type === "delay" && blockStates[entry.key] === true && delayMixDelta !== 0) {
        const baseMix = entry.block.parameters?.Mix;
        if (baseMix !== undefined && typeof baseMix === "number") {
          parameterOverrides[entry.key] = {
            ...(parameterOverrides[entry.key] ?? {}),
            Mix: Math.min(Math.max(baseMix + delayMixDelta, 0), 1.0),
          };
        }
      }

      // Reverb Mix + DecayTime override — only for enabled reverb blocks with nonzero delta/mult
      if (entry.block.type === "reverb" && blockStates[entry.key] === true) {
        const baseMix = entry.block.parameters?.Mix;
        const baseDecay = entry.block.parameters?.DecayTime;
        const overrides: Record<string, number> = {
          ...(parameterOverrides[entry.key] ?? {}),
        };
        let hasOverride = false;
        if (baseMix !== undefined && typeof baseMix === "number" && reverbMixDelta !== 0) {
          overrides.Mix = Math.min(Math.max(baseMix + reverbMixDelta, 0.10), 1.0);
          hasOverride = true;
        }
        if (baseDecay !== undefined && typeof baseDecay === "number" && reverbDecayMult !== 1.0) {
          overrides.DecayTime = Math.min(baseDecay * reverbDecayMult, 1.0);
          hasOverride = true;
        }
        if (hasOverride) {
          parameterOverrides[entry.key] = overrides;
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // PHASE 4.1: V3.0 SNAPSHOT TWEAKS (THE PARAMETER FENCE)
    // Map semantic keys like "amp_drive" or "delay_mix" to relative adjustments
    // bounding securely between 0.0 and 1.0 to prevent DSP corruption.
    // ═══════════════════════════════════════════════════════════════════
    const tweaks = snapshotTweaks?.[intent.name.toUpperCase()] ?? snapshotTweaks?.[intent.name];
    if (tweaks) {
      for (const [tweakKey, deltaPercent] of Object.entries(tweaks)) {
        // e.g. "amp_drive" -> type="amp", paramVar="drive"
        const parts = tweakKey.toLowerCase().split("_");
        if (parts.length < 2) continue;
        const targetType = parts[0];
        const targetParamVar = parts[1];

        // Only normalized params mapping
        let paramName = "";
        switch (targetParamVar) {
          case "drive": paramName = "Drive"; break;
          case "chvol": paramName = "ChVol"; break;
          case "mix": paramName = "Mix"; break;
          case "decay": paramName = "DecayTime"; break;
          case "level": paramName = "Level"; break;
          case "feedback": paramName = "Feedback"; break;
          case "depth": paramName = "Depth"; break;
          case "rate": paramName = "Rate"; break;
          case "treble": paramName = "Treble"; break;
          case "mid": paramName = "Mid"; break;
          case "bass": paramName = "Bass"; break;
          case "presence": paramName = "Presence"; break;
          case "master": paramName = "Master"; break;
          default: continue;
        }

        const delta = deltaPercent / 100.0;
        
        for (const entry of blockEntries) {
          if (entry.block.type === targetType && blockStates[entry.key] === true) {
            const baseValue = entry.block.parameters?.[paramName];
            if (baseValue !== undefined && typeof baseValue === "number") {
                // If it already has an override from legacy code, base it off that, else base params
                const currentVal = parameterOverrides[entry.key]?.[paramName] ?? baseValue;
                const newVal = currentVal + delta;
                const clamped = Math.max(0.0, Math.min(1.0, newVal));
                
                parameterOverrides[entry.key] = {
                   ...(parameterOverrides[entry.key] ?? {}),
                   [paramName]: clamped
                };
            }
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
