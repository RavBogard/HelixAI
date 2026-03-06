// helix-catalog.ts — Per-family catalog for Helix LT / Floor / Rack devices.
// Exports family-specific AMP_NAMES, CAB_NAMES, and EFFECT_NAMES tuples for
// z.enum() constrained decoding. Imports from ../models (NEVER from @/lib/helix
// barrel to avoid circular deps).

import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
} from "../models";

/** Helix HD2 amp names — no Agoura (Stadium) amps. */
export const HELIX_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];

/** Helix cab names — full HD2 cab catalog. */
export const HELIX_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

/**
 * Helix effect names — user-selectable effect categories only.
 * Excludes EQ, WAH, VOLUME (Knowledge Layer handles those silently).
 */
export const HELIX_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];
