// podgo-catalog.ts — Per-family catalog for Pod Go / Pod Go XL devices.
// Pod Go uses the HD2 amp set but excludes 3 effects that are too DSP-heavy
// or not ported. The Mono/Stereo suffix mapping is self-contained here.

import {
  AMP_MODELS,
  CAB_MODELS,
  DISTORTION_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
  DYNAMICS_MODELS,
  POD_GO_EXCLUDED_MODELS,
} from "../models";

/** Pod Go HD2 amp names — no amp exclusions, no Agoura amps. */
export const PODGO_AMP_NAMES = Object.keys(AMP_MODELS) as [string, ...string[]];

/** Pod Go cab names — full HD2 cab catalog. */
export const PODGO_CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];

/**
 * Pod Go effect names — user-selectable effect categories only.
 * Excludes EQ, WAH, VOLUME (Knowledge Layer handles those silently).
 * Also excludes Pod Go excluded models (Tone Sovereign, Clawthorn Drive, Cosmos Echo).
 */
export const PODGO_EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
].filter((name) => !POD_GO_EXCLUDED_MODELS.has(name)) as [string, ...string[]];

/**
 * Pod Go effect model ID suffix mapping by block type category.
 * Pod Go effect IDs append Mono or Stereo suffix; Helix IDs have no suffix (PGMOD-01).
 *
 * Mono-in effects: distortion, dynamics, pitch, EQ
 * Stereo-capable effects: delay, reverb, modulation, wah, volume
 *
 * Source: Direct inspection of 18 real .pgp files (confirmed patterns)
 */
export const PODGO_EFFECT_SUFFIX: Record<string, "Mono" | "Stereo"> = {
  distortion: "Mono",
  dynamics: "Mono",
  eq: "Mono",
  pitch: "Mono",
  delay: "Stereo",
  reverb: "Stereo",
  modulation: "Stereo",
  wah: "Stereo",
  volume: "Stereo",
};
