// stadium-catalog.ts — Per-family catalog for Helix Stadium / Stadium XL devices.
// Stadium uses Agoura-era amps (not HD2) and includes STADIUM_EQ_MODELS as
// user-selectable effects (unlike HD2 EQ which is handled by Knowledge Layer).

import {
  STADIUM_AMPS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  STADIUM_EQ_MODELS,
} from "../models";

/** Stadium amp names — Agoura-era amps only (no HD2 amps). */
export const STADIUM_AMP_NAMES = Object.keys(STADIUM_AMPS) as [string, ...string[]];

/** Stadium cab names — full HD2 cab catalog (shared across families). */
export const STADIUM_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

/**
 * Stadium effect names — user-selectable effect categories.
 * Includes STADIUM_EQ_MODELS (Stadium 7-band EQ is user-selectable, unlike HD2 EQ).
 * Excludes regular EQ_MODELS, WAH_MODELS, VOLUME_MODELS (Knowledge Layer handles those).
 */
export const STADIUM_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
  ...Object.keys(STADIUM_EQ_MODELS),
] as [string, ...string[]];
