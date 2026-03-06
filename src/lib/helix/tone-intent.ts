// src/lib/helix/tone-intent.ts
// The narrow AI output contract — ~10 fields defining creative model choices only.
// The Knowledge Layer (Phase 2) translates ToneIntent into a full PresetSpec with all
// parameter values. If a field is numeric (Drive, Master, LowCut...), it does NOT belong here.
//
// Source: RESEARCH.md Architecture Pattern 1, CONTEXT.md decisions (2026-03-01)
// Phase 62: getToneIntentSchema(family) factory for per-family constrained decoding.

import { z } from "zod";
import { VARIAX_MODEL_NAMES } from "./models";
import { HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES } from "./catalogs/helix-catalog";
import { STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES } from "./catalogs/stomp-catalog";
import { PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES } from "./catalogs/podgo-catalog";
import { STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES } from "./catalogs/stadium-catalog";
import type { DeviceFamily } from "./device-family";

// ---------------------------------------------------------------------------
// buildToneIntentSchema — internal helper
// ---------------------------------------------------------------------------

/**
 * Build a ToneIntent Zod schema constrained to a specific set of model names.
 * The EffectIntentSchema is constructed inline with the provided effectNames.
 */
function buildToneIntentSchema(
  ampNames: [string, ...string[]],
  cabNames: [string, ...string[]],
  effectNames: [string, ...string[]],
) {
  const effectSchema = z.object({
    modelName: z.enum(effectNames),
    role: z.enum(["always_on", "toggleable", "ambient"]),
  });

  return z.object({
    ampName: z.enum(ampNames),
    cabName: z.enum(cabNames),
    secondAmpName: z.enum(ampNames).optional(),
    secondCabName: z.enum(cabNames).optional(),
    guitarType: z.enum(["single_coil", "humbucker", "p90"]),
    genreHint: z.string().optional(),
    effects: z.array(effectSchema).max(6),
    snapshots: z.array(SnapshotIntentSchema).min(3).max(8),
    tempoHint: z.number().int().min(60).max(200).optional(),
    presetName: z.string().max(32).optional(),
    description: z.string().optional(),
    guitarNotes: z.string().optional(),
    variaxModel: z.enum(VARIAX_MODEL_NAMES).optional(),
  }).refine(
    (data) => !data.secondAmpName || data.secondCabName,
    { message: "secondCabName is required when secondAmpName is provided", path: ["secondCabName"] }
  );
}

// ---------------------------------------------------------------------------
// Public schemas
// ---------------------------------------------------------------------------

/** An effect block the AI has chosen to include (backwards compat — uses helix effect set). */
export const EffectIntentSchema = z.object({
  modelName: z.enum(HELIX_EFFECT_NAMES),
  role: z.enum(["always_on", "toggleable", "ambient"]),
});

/** A snapshot the AI wants in the preset. */
export const SnapshotIntentSchema = z.object({
  name: z.string().max(10),
  toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),
});

// ---------------------------------------------------------------------------
// getToneIntentSchema — per-family factory (Phase 62)
// ---------------------------------------------------------------------------

/**
 * Return a Zod ToneIntent schema constrained to the model names valid for the
 * given device family. This is the primary schema source for constrained decoding.
 */
export function getToneIntentSchema(family: DeviceFamily) {
  switch (family) {
    case "helix":
      return buildToneIntentSchema(HELIX_AMP_NAMES, HELIX_CAB_NAMES, HELIX_EFFECT_NAMES);
    case "stomp":
      return buildToneIntentSchema(STOMP_AMP_NAMES, STOMP_CAB_NAMES, STOMP_EFFECT_NAMES);
    case "podgo":
      return buildToneIntentSchema(PODGO_AMP_NAMES, PODGO_CAB_NAMES, PODGO_EFFECT_NAMES);
    case "stadium":
      return buildToneIntentSchema(STADIUM_AMP_NAMES, STADIUM_CAB_NAMES, STADIUM_EFFECT_NAMES);
    default:
      throw new Error(`Unknown DeviceFamily: ${String(family)}`);
  }
}

// ---------------------------------------------------------------------------
// Backwards-compat shim (Phase 62 transitional)
// ---------------------------------------------------------------------------

/**
 * @deprecated Use getToneIntentSchema(family) instead.
 * This shim uses the helix catalog — preserved temporarily for any consumers
 * that haven't been updated to the factory pattern yet.
 */
export const ToneIntentSchema = buildToneIntentSchema(
  HELIX_AMP_NAMES,
  HELIX_CAB_NAMES,
  HELIX_EFFECT_NAMES,
);

// ---------------------------------------------------------------------------
// TypeScript types inferred from schema — single source of truth
// ---------------------------------------------------------------------------

export type ToneIntent = z.infer<ReturnType<typeof getToneIntentSchema>>;
export type EffectIntent = z.infer<typeof EffectIntentSchema>;
export type SnapshotIntent = z.infer<typeof SnapshotIntentSchema>;
