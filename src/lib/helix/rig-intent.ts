// src/lib/helix/rig-intent.ts
// Zod schemas for v1.3 Rig Emulation data contracts.
// These are the type sources for PhysicalPedal extraction, RigIntent assembly,
// SubstitutionEntry mapping, and SubstitutionMap results.
//
// Source: Phase 17 RESEARCH.md — all schemas validated against Zod 4.3.6 at runtime.

import { z } from "zod";

// One physical pedal extracted from a user's photo or text description
export const PhysicalPedalSchema = z.object({
  brand: z.string(),           // "Boss", "Ibanez", "Electro-Harmonix"
  model: z.string(),           // "SD-1", "TS9", "Big Muff Pi"
  fullName: z.string(),        // "Boss SD-1 Super OverDrive" — primary mapping lookup key
  knobPositions: z.record(
    z.string(),
    z.enum(["low", "medium-low", "medium-high", "high"])
  ),                           // { "Drive": "medium-high", "Tone": "medium-low" }
  imageIndex: z.number().int(), // Which uploaded image this came from (0-indexed)
  confidence: z.enum(["high", "medium", "low"]),
});

export type PhysicalPedal = z.infer<typeof PhysicalPedalSchema>;

// Full extracted rig — output of the vision extraction route (/api/vision)
export const RigIntentSchema = z.object({
  pedals: z.array(PhysicalPedalSchema),
  rigDescription: z.string().optional(),   // User's free-text rig description (text path)
  extractionNotes: z.string().optional(),  // Claude's notes on ambiguous identifications
});

export type RigIntent = z.infer<typeof RigIntentSchema>;

// One pedal substitution entry — rendered in the substitution card UI (Phase 21)
export const SubstitutionEntrySchema = z.object({
  physicalPedal: z.string(),           // "TS9 Tube Screamer" — original pedal name
  helixModel: z.string(),              // Internal model ID: "HD2_DistTeemah"
  helixModelDisplayName: z.string(),   // Human-readable name: "Teemah!" (from PEDAL_HELIX_MAP)
  substitutionReason: z.string(),      // "Closest gain structure and mid-hump EQ character"
  parameterMapping: z.record(
    z.string(),
    z.number()
  ).optional(),                        // Helix param name -> translated 0-1 value; absent if no translation
  confidence: z.enum(["direct", "close", "approximate"]),
  // direct     = exact model exists in Helix (pedal in PEDAL_HELIX_MAP table)
  // close      = functionally equivalent, same circuit topology, different model
  // approximate = closest available, different character, category-based match
});

export type SubstitutionEntry = z.infer<typeof SubstitutionEntrySchema>;

// Full substitution result — flat array of all pedal mappings for a rig
export const SubstitutionMapSchema = z.array(SubstitutionEntrySchema);

export type SubstitutionMap = z.infer<typeof SubstitutionMapSchema>;
