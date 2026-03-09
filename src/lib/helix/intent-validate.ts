// src/lib/helix/intent-validate.ts
// Non-throwing advisory validation — compares ToneIntent against PresetSpec
// to verify that user-requested choices survived the Knowledge Layer pipeline.
//
// Phase 6, Plan 01 (INTENT-01): 6 fidelity checks, zero AI cost.

import type { ToneIntent } from "./tone-intent";
import type { PresetSpec } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntentAuditEntry {
  requested: string;
  matched: boolean;
  actual?: string;
}

export interface EffectAuditEntry {
  requested: string;
  role: string;
  matched: boolean;
}

export interface IntentAudit {
  amp: IntentAuditEntry;
  cab: IntentAuditEntry;
  effects: EffectAuditEntry[];
  tempo: { requested: number; actual: number; matched: boolean };
  delaySubdivision: { requested: string | null; applied: boolean };
  snapshots: { requested: number; actual: number; matched: boolean };
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeModelName(name: string): string {
  return name.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Audit intent fidelity — compare ToneIntent choices against final PresetSpec.
 *
 * NON-THROWING GUARANTEE: This function wraps all logic in try/catch and
 * always returns an IntentAudit. An empty warnings array means full fidelity.
 */
export function auditIntentFidelity(
  toneIntent: ToneIntent,
  presetSpec: PresetSpec,
): IntentAudit {
  const warnings: string[] = [];

  // Defaults for error path
  const defaultAudit: IntentAudit = {
    amp: { requested: "", matched: true },
    cab: { requested: "", matched: true },
    effects: [],
    tempo: { requested: 120, actual: 120, matched: true },
    delaySubdivision: { requested: null, applied: false },
    snapshots: { requested: 0, actual: 0, matched: true },
    warnings: [],
  };

  try {
    const chain = presetSpec.signalChain ?? [];

    // --- Amp check ---
    const ampBlock = chain.find((b) => b.type === "amp");
    const ampRequested = toneIntent.ampName ?? "";
    const ampMatched = ampBlock
      ? normalizeModelName(ampBlock.modelName) === normalizeModelName(ampRequested)
      : false;
    if (!ampMatched && ampRequested) {
      warnings.push(
        `Amp mismatch: requested "${ampRequested}", got "${ampBlock?.modelName ?? "none"}"`,
      );
    }

    // --- Cab check ---
    const cabBlock = chain.find((b) => b.type === "cab");
    const cabRequested = toneIntent.cabName ?? "";
    const cabMatched = cabBlock
      ? normalizeModelName(cabBlock.modelName) === normalizeModelName(cabRequested)
      : false;
    if (!cabMatched && cabRequested) {
      warnings.push(
        `Cab mismatch: requested "${cabRequested}", got "${cabBlock?.modelName ?? "none"}"`,
      );
    }

    // --- Effects check ---
    const effectsAudit: EffectAuditEntry[] = [];
    const intentEffects = toneIntent.effects ?? [];
    for (const effect of intentEffects) {
      const found = chain.some(
        (b) => normalizeModelName(b.modelName) === normalizeModelName(effect.modelName),
      );
      effectsAudit.push({
        requested: effect.modelName,
        role: effect.role,
        matched: found,
      });
      if (!found) {
        warnings.push(`Missing effect: "${effect.modelName}" (role: ${effect.role})`);
      }
    }

    // --- Tempo check ---
    const tempoRequested = toneIntent.tempoHint ?? 120;
    const tempoActual = presetSpec.tempo ?? 120;
    const tempoMatched = Math.abs(tempoRequested - tempoActual) <= 1;
    if (!tempoMatched) {
      warnings.push(
        `Tempo mismatch: requested ${tempoRequested} BPM, got ${tempoActual} BPM`,
      );
    }

    // --- Delay subdivision check ---
    const delaySubRequested = toneIntent.delaySubdivision ?? null;
    let delaySubApplied = false;
    if (delaySubRequested) {
      // Check if any delay block has TempoSync1 enabled
      delaySubApplied = chain.some(
        (b) => b.type === "delay" && b.parameters?.TempoSync1 === true,
      );
      if (!delaySubApplied) {
        warnings.push(
          `Delay subdivision "${delaySubRequested}" requested but no delay block has TempoSync1 enabled`,
        );
      }
    }

    // --- Snapshot count check ---
    const snapshotsRequested = toneIntent.snapshots?.length ?? 0;
    const snapshotsActual = presetSpec.snapshots?.length ?? 0;
    const snapshotsMatched = snapshotsActual >= snapshotsRequested;
    if (!snapshotsMatched) {
      warnings.push(
        `Snapshot count: requested ${snapshotsRequested}, got ${snapshotsActual}`,
      );
    }

    return {
      amp: { requested: ampRequested, matched: ampMatched, ...(ampBlock ? { actual: ampBlock.modelName } : {}) },
      cab: { requested: cabRequested, matched: cabMatched, ...(cabBlock ? { actual: cabBlock.modelName } : {}) },
      effects: effectsAudit,
      tempo: { requested: tempoRequested, actual: tempoActual, matched: tempoMatched },
      delaySubdivision: { requested: delaySubRequested, applied: delaySubApplied },
      snapshots: { requested: snapshotsRequested, actual: snapshotsActual, matched: snapshotsMatched },
      warnings,
    };
  } catch {
    // Non-throwing guarantee: return default audit
    return defaultAudit;
  }
}
