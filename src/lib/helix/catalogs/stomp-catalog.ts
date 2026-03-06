// stomp-catalog.ts — Per-family catalog for HX Stomp / HX Stomp XL devices.
// Stomp uses full HD2 model set (same as Helix). Stomp independence future-proofs
// for stomp-specific model additions without touching helix code.

import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
} from "../models";

/** Stomp HD2 amp names — no Agoura (Stadium) amps. */
export const STOMP_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];

/** Stomp cab names — full HD2 cab catalog. */
export const STOMP_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

/**
 * Stomp effect names — user-selectable effect categories only.
 * Excludes EQ, WAH, VOLUME (Knowledge Layer handles those silently).
 */
export const STOMP_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];
