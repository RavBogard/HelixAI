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
    nodeId: z.string().optional(),
    modelName: z.enum(effectNames),
    role: z.enum(["always_on", "toggleable", "ambient"]),
    assignedDSP: z.enum(["DSP1", "DSP2"]).optional(),
  });

  return z.object({
    // Phase 3: Semantic Anchor Support
    anchorId: z.enum([
      "anchor_american_clean",
      "anchor_edge_of_breakup",
      "anchor_classic_crunch",
      "anchor_modern_metal",
      "anchor_ambient_wash"
    ]).optional(),
    userTweaks: z.object({
      amp: z.record(z.string(), z.number()).optional(),
      cab: z.record(z.string(), z.number()).optional(),
    }).optional(),

    instrument: z.enum(["guitar", "bass"]).optional(),
    ampName: z.enum(ampNames).optional(), // Optional if anchorId handles it
    cabName: z.enum(cabNames).optional(), // Optional if anchorId handles it
    secondAmpName: z.enum(ampNames).optional(),
    secondCabName: z.enum(cabNames).optional(),
    guitarType: z.enum(["single_coil", "humbucker", "p90"]).default("humbucker"),
    genreHint: z.string().optional(),
    feelHint: z.enum([
      "modern_metal",
      "texas_blues",
      "classic_rock",
      "ambient",
      "studio",
    ]).optional(),
    effects: z.array(effectSchema).max(10).default([]),
    snapshots: z.array(SnapshotIntentSchema).min(3).max(8),
    snapshotTweaks: z.record(
      z.string().max(10),
      z.record(z.string(), z.number().int().min(-100).max(100))
    ).optional(),
    tempoHint: z.number().int().min(60).max(200).optional(),
    delaySubdivision: z.enum(["quarter", "dotted_eighth", "eighth", "triplet", "none"]).optional(),
    presetName: z.string().max(32).optional(),
    description: z.string().optional(),
    guitarNotes: z.string().optional(),
    variaxModel: z.enum(VARIAX_MODEL_NAMES).optional(),
  }).refine(
    (data) => !data.secondAmpName || data.secondCabName,
    { message: "secondCabName is required when secondAmpName is provided", path: ["secondCabName"] }
  ).refine(
    (data) => data.anchorId || (data.ampName && data.cabName),
    { message: "Must provide either an anchorId OR explicitly provide ampName and cabName", path: ["anchorId"] }
  );
}

// ---------------------------------------------------------------------------
// Public schemas
// ---------------------------------------------------------------------------

/** An effect block the AI has chosen to include (backwards compat — uses helix effect set). */
export const EffectIntentSchema = z.object({
  nodeId: z.string().describe("A unique 1-2 word identifier for this block (e.g. 'fuzz_face_1' or 'delay_vintage'). Required for Critic patching."),
  modelName: z.enum(HELIX_EFFECT_NAMES),
  role: z.enum(["always_on", "toggleable", "ambient"]),
  assignedDSP: z.enum(["DSP1", "DSP2"]).optional().describe("Helix only. Force block to Path 1 or Path 2."),
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
