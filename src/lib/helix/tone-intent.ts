// src/lib/helix/tone-intent.ts
// The narrow AI output contract — ~15 fields defining creative model choices only.
// The Knowledge Layer (Phase 2) translates ToneIntent into a full PresetSpec with all
// parameter values. If a field is numeric (Drive, Master, LowCut...), it does NOT belong here.
//
// Source: RESEARCH.md Architecture Pattern 1, CONTEXT.md decisions (2026-03-01)

import { z } from "zod";

// An effect block the AI has chosen to include
export const EffectIntentSchema = z.object({
  modelName: z.string(),                                           // Must match a key in EFFECT_MODELS
  role: z.enum(["always_on", "toggleable", "ambient"]),           // How this effect is used in the signal chain
});

// A snapshot the AI wants in the preset
export const SnapshotIntentSchema = z.object({
  name: z.string().max(10),                                        // Snapshot name shown on Helix display (max 10 chars)
  toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),       // What this snapshot represents tonally
});

// The complete AI output — all creative choices, zero numeric parameters
export const ToneIntentSchema = z.object({
  ampName: z.string(),                                             // Must match a key in AMP_MODELS (human-readable name)
  cabName: z.string(),                                             // Must match a key in CAB_MODELS (human-readable name)
  guitarType: z.enum(["single_coil", "humbucker", "p90"]),        // Pickup type influences amp param defaults in Knowledge Layer
  genreHint: z.string().optional(),                                // e.g., "blues rock", "metal", "jazz" — informational only
  effects: z.array(EffectIntentSchema).max(6),                    // Additional effects beyond mandatory boost (Knowledge Layer inserts boost)
  snapshots: z.array(SnapshotIntentSchema).min(4).max(4),         // Exactly 4 snapshots required (Clean, Rhythm, Lead, Ambient pattern)
  tempoHint: z.number().int().min(60).max(200).optional(),        // BPM hint for delay sync — integer only
});

// TypeScript types inferred from schema — single source of truth
export type ToneIntent = z.infer<typeof ToneIntentSchema>;
export type EffectIntent = z.infer<typeof EffectIntentSchema>;
export type SnapshotIntent = z.infer<typeof SnapshotIntentSchema>;
