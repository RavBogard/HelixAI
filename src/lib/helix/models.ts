// Comprehensive database of Helix LT amp, cab, and effect models
// Model IDs match the HD2_* naming convention used in .hlx files

import type { AmpCategory, TopologyTag, DeviceTarget } from "./types";
import { BLOCK_TYPES_PODGO, isPodGo, isStadium } from "./types";

export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;           // existing — keep as generic string for all model types
  ampCategory?: AmpCategory;  // "clean" | "crunch" | "high_gain" — amp models only
  topology?: TopologyTag;     // cathode_follower | plate_fed | solid_state | not_applicable — amp models only
  cabAffinity?: string[];     // preferred cab names (keys in CAB_MODELS) — amp models only
  defaultParams: Record<string, number>;
  blockType: number; // @type value in .hlx
  stadiumOnly?: boolean;      // true for Agoura_* models — excluded from Helix LT/Floor/Pod Go catalogs (STAD-03)
}

// Block type constants
// Source: Direct inspection of 15 real HX Edit .hlx exports (2026-03-01)
// Files inspected: Sultans_of_Swing_Alchemy.hlx, NashvilleVoxDC30.hlx, TWEEDBLUES.hlx,
//   GRAMMY.hlx, Placater 9.8.hlx, DeluxeRvbSNP.hlx, LiveStream.hlx, and 8 others
export const BLOCK_TYPES = {
  // Generic effects — ALL share @type=0 in real HX Edit exports
  DISTORTION: 0,    // HD2_Dist* models
  DYNAMICS: 0,      // HD2_Compressor* models
  EQ: 0,            // HD2_EQ*, HD2_CaliQ
  WAH: 0,           // HD2_Wah*, HD2_FM4* filter models
  PITCH: 0,         // HD2_Pitch* models
  VOLUME: 0,        // HD2_VolPan* models
  // Modulation — primarily @type=4; some models use 0 (e.g., HD2_ChorusAmpegLiquifier)
  MODULATION: 4,    // HD2_Chorus*, HD2_Flanger*, HD2_Phaser*, HD2_Tremolo*, HD2_Rotary*
  // Amp — @type depends on whether amp block has a @cab reference
  AMP: 1,           // Amp block WITHOUT @cab field (amp-only mode, no cab)
  AMP_WITH_CAB: 3,  // Amp block WITH @cab field pointing to cab0 (standard preset pattern used by this app)
  // Cab — storage format determines @type
  CAB_IN_SLOT: 4,   // Cab in block position (HD2_CabMicIr_*WithPan models)
  // Note: Cabs stored as the cab0 key have NO @type field at all in real exports
  // Special
  IMPULSE_RESPONSE: 5, // HD2_ImpulseResponse1024
  LOOPER: 6,           // HD2_Looper
  DELAY: 7,            // HD2_Delay* models — confirmed in 15 exports
  REVERB: 7,           // HD2_Reverb*, VIC_Reverb* models — confirmed; DELAY and REVERB share @type=7
  SEND_RETURN: 9,      // Send/return blocks
} as const;

// Controller constants
export const CONTROLLERS = {
  EXP_PEDAL_1: 1,
  EXP_PEDAL_2: 2,
  MIDI_CC: 18,
  SNAPSHOT: 19,
} as const;

// LED color constants for snapshots
export const LED_COLORS = {
  RED: 1,
  ORANGE: 2,
  YELLOW: 3,
  GREEN: 4,
  TURQUOISE: 5,
  BLUE: 6,
  PURPLE: 7,
  WHITE: 8,
  OFF: 0,
} as const;

// ============================================================
// AMP MODELS
// ============================================================
export const AMP_MODELS: Record<string, HelixModel> = {
  // --- Clean / Chime ---
  "US Deluxe Nrm": {
    id: "HD2_AmpUSDeluxeNrm",
    name: "US Deluxe Nrm",
    basedOn: "Fender Deluxe Reverb (Normal)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.35, Mid: 0.60, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.7, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.5 },
  },
  "US Deluxe Vib": {
    id: "HD2_AmpUSDeluxeVib",
    name: "US Deluxe Vib",
    basedOn: "Fender Deluxe Reverb (Vibrato)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.35, Mid: 0.60, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.7, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.5 },
  },
  "US Double Nrm": {
    id: "HD2_AmpUSDoubleNrm",
    name: "US Double Nrm",
    basedOn: "Fender Twin Reverb (Normal)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.65, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.5 },
  },
  "US Small Tweed": {
    id: "HD2_AmpUSSmallTweed",
    name: "US Small Tweed",
    basedOn: "Fender Champ",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.75, Hum: 0.15, Ripple: 0.15, Bias: 0.70, BiasX: 0.5 },
  },
  "Essex A30": {
    id: "HD2_AmpEssexA30",
    name: "Essex A30",
    basedOn: "Vox AC30 (Top Boost)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Blue Bell","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.0, Cut: 0.50, Sag: 0.65, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.70 },
  },
  "Essex A15": {
    id: "HD2_AmpEssexA15",
    name: "Essex A15",
    basedOn: "Vox AC15",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Blue Bell","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.0, Cut: 0.50, Sag: 0.70, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.70 },
  },
  "Matchstick Ch1": {
    id: "HD2_AmpMatchstickCh1",
    name: "Matchstick Ch1",
    basedOn: "Matchless DC-30 (Ch1)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Match H30","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.90, Sag: 0.65, Hum: 0.1, Ripple: 0.1, Bias: 0.70, BiasX: 0.60 },
  },
  "WhoWatt 100": {
    id: "HD2_AmpWhoWatt100",
    name: "WhoWatt 100",
    basedOn: "Hiwatt DR103",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 WhoWatt 100"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.90, Presence: 0.50, Sag: 0.60, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.50 },
  },
  "Grammatico Nrm": {
    id: "HD2_AmpGrammaticoNrm",
    name: "Grammatico Nrm",
    basedOn: "Grammatico LaGrange (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Grammatico","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.30, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.90, Presence: 0.50, Sag: 0.65, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Fullerton Nrm": {
    id: "HD2_AmpFullertonNrm",
    name: "Fullerton Nrm",
    basedOn: "Fender Bassman (Normal)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.40, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.70, Hum: 0.15, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },

  // --- Crunch / Classic Rock ---
  "Brit Plexi Nrm": {
    id: "HD2_AmpBritPlexiNrm",
    name: "Brit Plexi Nrm",
    basedOn: "Marshall Super Lead 100 (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.20, Mid: 0.80, Treble: 0.75, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit Plexi Brt": {
    id: "HD2_AmpBritPlexiBrt",
    name: "Brit Plexi Brt",
    basedOn: "Marshall Super Lead 100 (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.20, Mid: 0.80, Treble: 0.60, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit Plexi Jump": {
    id: "HD2_AmpBritPlexiJump",
    name: "Brit Plexi Jump",
    basedOn: "Marshall Super Lead 100 (Jumped)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.20, Mid: 0.80, Treble: 0.70, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Line 6 2204 Mod": {
    id: "HD2_AmpLine62204Mod",
    name: "Line 6 2204 Mod",
    basedOn: "Marshall JCM-800 (Modified by Line 6)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.40, Mid: 0.55, Treble: 0.65, ChVol: 0.7, Master: 0.45, Presence: 0.50, Sag: 0.45, Hum: 0.15, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Derailed Ingrid": {
    id: "HD2_AmpDerailedIngrid",
    name: "Derailed Ingrid",
    basedOn: "Hiwatt DR103 (Cranked)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 WhoWatt 100"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.45, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.80, Presence: 0.50, Sag: 0.55, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Placater Clean": {
    id: "HD2_AmpPlacaterClean",
    name: "Placater Clean",
    basedOn: "Friedman BE-100 (Clean)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Brit V30","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.25, Bass: 0.45, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.45, Presence: 0.50, Sag: 0.50, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Placater Dirty": {
    id: "HD2_AmpPlacaterDirty",
    name: "Placater Dirty",
    basedOn: "Friedman BE-100 (BE/HBE)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Brit V30","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.30, Bass: 0.40, Mid: 0.65, Treble: 0.63, ChVol: 0.7, Master: 0.36, Presence: 0.55, Sag: 0.35, Hum: 0.1, Ripple: 0.05, Bias: 0.75, BiasX: 0.50 },
  },

  // --- High Gain ---
  "Cali Rectifire": {
    id: "HD2_AmpCaliRectifire",
    name: "Cali Rectifire",
    basedOn: "Mesa/Boogie Dual Rectifier",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Cali V30","4x12 XXL V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.53, Bass: 0.46, Mid: 0.62, Treble: 0.55, ChVol: 0.7, Master: 0.45, Presence: 0.33, Sag: 0.25, Hum: 0.1, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "Cali IV Lead": {
    id: "HD2_AmpCaliIVLead",
    name: "Cali IV Lead",
    basedOn: "Mesa/Boogie Mark IV (Lead)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Cali V30","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.70, Bass: 0.25, Mid: 0.45, Treble: 0.55, ChVol: 0.7, Master: 0.45, Presence: 0.55, Sag: 0.25, Hum: 0.1, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "PV Panama": {
    id: "HD2_AmpPVPanama",
    name: "PV Panama",
    basedOn: "EVH 5150III",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Uber V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.64, Mid: 0.40, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.55, Resonance: 0.50, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.45 },
  },
  "Archetype Lead": {
    id: "HD2_AmpArchetypeLead",
    name: "Archetype Lead",
    basedOn: "PRS Archon (Lead)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Cali V30","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.45, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.50, Presence: 0.50, Sag: 0.25, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "Das Benzin Mega": {
    id: "HD2_AmpDasBenzinMega",
    name: "Das Benzin Mega",
    basedOn: "Diezel VH4 (Mega Channel)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Uber V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.50, Mid: 0.50, Treble: 0.45, ChVol: 0.7, Master: 0.45, Presence: 0.45, Deep: 0.55, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "Revv Gen Purple": {
    id: "HD2_AmpRevvGenPurple",
    name: "Revv Gen Purple",
    basedOn: "Revv Generator 120 (Purple/Ch3)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Brit V30","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.45, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.55, Presence: 0.55, Sag: 0.25, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Revv Gen Red": {
    id: "HD2_AmpRevvGenRed",
    name: "Revv Gen Red",
    basedOn: "Revv Generator 120 (Red/Ch4)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Brit V30","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.45, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.55, Presence: 0.55, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.65 },
  },
  "Solo Lead Clean": {
    id: "HD2_AmpSoloLeadClean",
    name: "Solo Lead Clean",
    basedOn: "Soldano SLO-100 (Clean)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Solo Lead EM","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.35, Bass: 0.50, Mid: 0.55, Treble: 0.50, ChVol: 0.7, Master: 0.80, Presence: 0.40, Sag: 0.60, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Solo Lead Crunch": {
    id: "HD2_AmpSoloLeadCrunch",
    name: "Solo Lead Crunch",
    basedOn: "Soldano SLO-100 (Crunch)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Solo Lead EM","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.50, Mid: 0.55, Treble: 0.50, ChVol: 0.7, Master: 0.75, Presence: 0.35, Sag: 0.50, Hum: 0.1, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Solo Lead OD": {
    id: "HD2_AmpSoloLeadOD",
    name: "Solo Lead OD",
    basedOn: "Soldano SLO-100 (Overdrive)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Solo Lead EM","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.57, Treble: 0.48, ChVol: 0.7, Master: 0.80, Presence: 0.30, Sag: 0.40, Hum: 0.1, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "German Ubersonic": {
    id: "HD2_AmpGermanUbersonic",
    name: "German Ubersonic",
    basedOn: "Bogner Uberschall",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30","4x12 XXL V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.60, Mid: 0.60, Treble: 0.60, ChVol: 0.7, Master: 0.40, Presence: 0.60, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "Das Benzin Lead": {
    id: "HD2_AmpDasBenzinLead",
    name: "Das Benzin Lead",
    basedOn: "Diezel VH4 (Lead Channel)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Uber V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.65, Bass: 0.50, Mid: 0.50, Treble: 0.45, ChVol: 0.7, Master: 0.45, Presence: 0.45, Deep: 0.55, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.50 },
  },
  "ANGL Meteor": {
    id: "HD2_AmpANGLMeteor",
    name: "ANGL Meteor",
    basedOn: "ENGL Fireball 100",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.48, Mid: 0.38, Treble: 0.65, ChVol: 0.7, Master: 0.50, Presence: 0.50, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },

  // --- Crunch / British ---
  "US Double Vib": {
    id: "HD2_AmpUSDoubleVib",
    name: "US Double Vib",
    basedOn: "Fender Twin Reverb (Vibrato)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.65, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "US Princess": {
    id: "HD2_AmpUSPrincess",
    name: "US Princess",
    basedOn: "Fender Princeton Reverb",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.40, Mid: 0.60, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.75, Hum: 0.10, Ripple: 0.10, Bias: 0.65, BiasX: 0.50 },
  },
  "Brit J45 Brt": {
    id: "HD2_AmpBritJ45Brt",
    name: "Brit J45 Brt",
    basedOn: "Marshall JTM45 (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.25, Mid: 0.75, Treble: 0.65, ChVol: 0.7, Master: 0.95, Presence: 0.40, Sag: 0.65, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit J45 Nrm": {
    id: "HD2_AmpBritJ45Nrm",
    name: "Brit J45 Nrm",
    basedOn: "Marshall JTM45 (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.30, Mid: 0.75, Treble: 0.70, ChVol: 0.7, Master: 0.95, Presence: 0.45, Sag: 0.65, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit P75 Nrm": {
    id: "HD2_AmpBritP75Nrm",
    name: "Brit P75 Nrm",
    basedOn: "Park 75 (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.25, Mid: 0.75, Treble: 0.70, ChVol: 0.7, Master: 0.95, Presence: 0.40, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit Trem Brt": {
    id: "HD2_AmpBritTremBrt",
    name: "Brit Trem Brt",
    basedOn: "Marshall JTM50 (Bright/Tremolo)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.25, Mid: 0.75, Treble: 0.65, ChVol: 0.7, Master: 0.95, Presence: 0.35, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit Trem Nrm": {
    id: "HD2_AmpBritTremNrm",
    name: "Brit Trem Nrm",
    basedOn: "Marshall JTM50 (Normal/Tremolo)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.30, Mid: 0.75, Treble: 0.70, ChVol: 0.7, Master: 0.95, Presence: 0.40, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Brit Trem Jump": {
    id: "HD2_AmpBritTremJump",
    name: "Brit Trem Jump",
    basedOn: "Marshall JTM50 (Jumped/Tremolo)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback25","4x12 Greenback20","4x12 Brit V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.25, Mid: 0.75, Treble: 0.68, ChVol: 0.7, Master: 0.95, Presence: 0.38, Sag: 0.60, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Matchstick Ch2": {
    id: "HD2_AmpMatchstickCh2",
    name: "Matchstick Ch2",
    basedOn: "Matchless DC-30 (Ch2)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Match H30","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.85, Sag: 0.55, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.60 },
  },
  "Matchstick Jump": {
    id: "HD2_AmpMatchstickJump",
    name: "Matchstick Jump",
    basedOn: "Matchless DC-30 (Jumped)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Match H30","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.58, ChVol: 0.7, Master: 0.85, Sag: 0.55, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.60 },
  },
  "A30 Fawn Brt": {
    id: "HD2_AmpA30FawnBrt",
    name: "A30 Fawn Brt",
    basedOn: "Vox AC30 Fawn (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Blue Bell","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Cut: 0.50, Sag: 0.65, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.70 },
  },
  "A30 Fawn Nrm": {
    id: "HD2_AmpA30FawnNrm",
    name: "A30 Fawn Nrm",
    basedOn: "Vox AC30 Fawn (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "cathode_follower" as const,
    cabAffinity: ["2x12 Blue Bell","1x12 Blue Bell"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Cut: 0.50, Sag: 0.65, Hum: 0.15, Ripple: 0.1, Bias: 0.70, BiasX: 0.70 },
  },
  "Fullerton Brt": {
    id: "HD2_AmpFullertonBrt",
    name: "Fullerton Brt",
    basedOn: "Fender Bassman (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.40, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.70, Hum: 0.15, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Fullerton Jump": {
    id: "HD2_AmpFullertonJump",
    name: "Fullerton Jump",
    basedOn: "Fender Bassman (Jumped)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.40, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.70, Hum: 0.15, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Grammatico Brt": {
    id: "HD2_AmpGrammaticoBrt",
    name: "Grammatico Brt",
    basedOn: "Grammatico LaGrange (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Grammatico","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.30, Mid: 0.55, Treble: 0.65, ChVol: 0.7, Master: 0.85, Presence: 0.50, Sag: 0.60, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Grammatico Jump": {
    id: "HD2_AmpGrammaticoJump",
    name: "Grammatico Jump",
    basedOn: "Grammatico LaGrange (Jumped)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Grammatico","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.30, Mid: 0.55, Treble: 0.62, ChVol: 0.7, Master: 0.85, Presence: 0.50, Sag: 0.60, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Tweed Blues Brt": {
    id: "HD2_AmpTweedBluesBrt",
    name: "Tweed Blues Brt",
    basedOn: "Fender Tweed Blues (Bright)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.35, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.75, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Tweed Blues Nrm": {
    id: "HD2_AmpTweedBluesNrm",
    name: "Tweed Blues Nrm",
    basedOn: "Fender Tweed Blues (Normal)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 Fullerton","4x10 Tweed P10R"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.35, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 1.0, Presence: 0.40, Sag: 0.75, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Mail Order Twin": {
    id: "HD2_AmpMailOrderTwin",
    name: "Mail Order Twin",
    basedOn: "Silvertone 1484",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["2x12 Double C12N","1x12 US Deluxe"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Sag: 0.70, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Voltage Queen": {
    id: "HD2_AmpVoltageQueen",
    name: "Voltage Queen",
    basedOn: "Victoria Electro King",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Sag: 0.75, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Soup Pro": {
    id: "HD2_AmpSoupPro",
    name: "Soup Pro",
    basedOn: "Supro S6616",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.50, Treble: 0.55, ChVol: 0.7, Master: 1.0, Sag: 0.75, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.50 },
  },
  "Stone Age 185": {
    id: "HD2_AmpStoneAge185",
    name: "Stone Age 185",
    basedOn: "Gibson EH-185",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Treble: 0.50, ChVol: 0.7, Master: 1.0, Sag: 0.75, Hum: 0.25, Ripple: 0.20, Bias: 0.70, BiasX: 0.50 },
  },
  "EV Panama Blue": {
    id: "HD2_AmpEVPanamaBlue",
    name: "EV Panama Blue",
    basedOn: "EVH 5150III (Blue/Clean)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.35, Bass: 0.50, Mid: 0.50, Treble: 0.55, ChVol: 0.7, Master: 0.50, Presence: 0.50, Resonance: 0.50, Sag: 0.50, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "EV Panama Red": {
    id: "HD2_AmpEVPanamaRed",
    name: "EV Panama Red",
    basedOn: "EVH 5150III (Red/High Gain)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Uber V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.60, Mid: 0.40, Treble: 0.55, ChVol: 0.7, Master: 0.90, Presence: 0.55, Resonance: 0.50, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.45 },
  },
  "Mandarin 80": {
    id: "HD2_AmpMandarin80",
    name: "Mandarin 80",
    basedOn: "Orange OR80",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30","4x12 Greenback20"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.50, Sag: 0.55, Hum: 0.15, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Mandarin Rocker": {
    id: "HD2_AmpMandarinRocker",
    name: "Mandarin Rocker",
    basedOn: "Orange Rockerverb 100 MKIII",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30","4x12 Greenback20"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.50, Sag: 0.30, Hum: 0.1, Ripple: 0.05, Bias: 0.60, BiasX: 0.50 },
  },
  "Cali Texas Ch1": {
    id: "HD2_AmpCaliTexasCh1",
    name: "Cali Texas Ch1",
    basedOn: "Mesa/Boogie Lone Star (Clean)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Cali V30","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.50, Presence: 0.45, Sag: 0.60, Hum: 0.05, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Jazz Rivet 120": {
    id: "HD2_AmpJazzRivet120",
    name: "Jazz Rivet 120",
    basedOn: "Roland JC-120",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "solid_state" as const,
    cabAffinity: ["2x12 Jazz Rivet"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.28, Bass: 0.56, Mid: 0.27, Treble: 0.53, ChVol: 0.7, Master: 1.0, BrightSwitch: 0, Sag: 0.0, Hum: 0.0, Ripple: 0.0, Bias: 0.40, BiasX: 0.50 },
  },
  "Interstate Zed": {
    id: "HD2_AmpInterstateZed",
    name: "Interstate Zed",
    basedOn: "Dr. Z Route 66",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["2x12 Interstate","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.80, Sag: 0.60, Hum: 0.15, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Divided Duo": {
    id: "HD2_AmpDividedDuo",
    name: "Divided Duo",
    basedOn: "Divided by 13 9/15",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["2x12 Interstate","4x12 Greenback25"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.80, Sag: 0.60, Hum: 0.15, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },

  // --- Line 6 Originals ---
  "Litigator": {
    id: "HD2_AmpLine6Litigator",
    name: "Litigator",
    basedOn: "Line 6 Original (Blackface Clean)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.40, Bass: 0.45, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 0.90, Sag: 0.65, Hum: 0.1, Ripple: 0.1, Bias: 0.65, BiasX: 0.50 },
  },
  "Badonk": {
    id: "HD2_AmpLine6Badonk",
    name: "Badonk",
    basedOn: "Line 6 Original (Modern High Gain)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Cali V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.50, Mid: 0.50, Treble: 0.60, ChVol: 0.7, Master: 0.50, Presence: 0.50, Sag: 0.20, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },
  "Doom": {
    id: "HD2_AmpLine6Doom",
    name: "Doom",
    basedOn: "Line 6 Original (Doom Metal)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Cali V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.70, Bass: 0.65, Mid: 0.40, Treble: 0.50, ChVol: 0.7, Master: 0.55, Sag: 0.35, Hum: 0.20, Ripple: 0.15, Bias: 0.70, BiasX: 0.55 },
  },
  "Elektrik": {
    id: "HD2_AmpLine6Elektrik",
    name: "Elektrik",
    basedOn: "Line 6 Original (British High Gain)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Cali V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.45, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.55, Presence: 0.50, Sag: 0.30, Hum: 0.1, Ripple: 0.05, Bias: 0.65, BiasX: 0.50 },
  },
  "Epic": {
    id: "HD2_AmpLine6Epic",
    name: "Epic",
    basedOn: "Line 6 Original (80s Metal)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Cali V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.60, Bass: 0.50, Mid: 0.55, Treble: 0.60, ChVol: 0.7, Master: 0.55, Presence: 0.55, Sag: 0.25, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.45 },
  },

  // Additional useful amps
  "US Super Nrm": {
    id: "HD2_AmpUSSuperNorm",
    name: "US Super Nrm",
    basedOn: "Fender Super Reverb (Normal)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.40, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.70, Hum: 0.10, Ripple: 0.10, Bias: 0.65, BiasX: 0.50 },
  },
  "US Super Vib": {
    id: "HD2_AmpUSSuperVib",
    name: "US Super Vib",
    basedOn: "Fender Super Reverb (Vibrato)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["1x12 US Deluxe","2x12 Double C12N"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.45, Bass: 0.40, Mid: 0.55, Treble: 0.55, ChVol: 0.7, Master: 1.0, Presence: 0.35, Sag: 0.70, Hum: 0.10, Ripple: 0.10, Bias: 0.65, BiasX: 0.50 },
  },
  "Cartographer": {
    id: "HD2_AmpCartographer",
    name: "Cartographer",
    basedOn: "Ben Adrian Cartographer",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 XXL V30","4x12 Cali V30"],
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.55, Bass: 0.50, Mid: 0.55, Treble: 0.58, ChVol: 0.7, Master: 0.50, Presence: 0.50, Sag: 0.30, Hum: 0.05, Ripple: 0.05, Bias: 0.60, BiasX: 0.50 },
  },
};

// ============================================================
// CAB MODELS
// ============================================================
export const CAB_MODELS: Record<string, HelixModel> = {
  "1x8 Small Tweed": { id: "HD2_CabMicIr_1x8SmallTweed", name: "1x8 Small Tweed", basedOn: "Fender Champ 1x8", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "1x12 US Deluxe": { id: "HD2_CabMicIr_1x12USDeluxe", name: "1x12 US Deluxe", basedOn: "Fender Deluxe Reverb 1x12", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "1x12 Blue Bell": { id: "HD2_CabMicIr_1x12BlueBell", name: "1x12 Blue Bell", basedOn: "1x12 Celestion Blue", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "1x12 Fullerton": { id: "HD2_CabMicIr_1x12Fullerton", name: "1x12 Fullerton", basedOn: "Fender Bassman 1x12", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "1x12 Grammatico": { id: "HD2_CabMicIr_1x12Grammatico", name: "1x12 Grammatico", basedOn: "Grammatico LaGrange 1x12", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "2x12 Blue Bell": { id: "HD2_CabMicIr_2x12BlueBell", name: "2x12 Blue Bell", basedOn: "Vox AC30 2x12 Blue", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "2x12 Double C12N": { id: "HD2_CabMicIr_2x12DoubleC12N", name: "2x12 Double C12N", basedOn: "Fender Twin 2x12", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "2x12 Silver Bell": { id: "HD2_CabMicIr_2x12SilverBell", name: "2x12 Silver Bell", basedOn: "Vox 2x12 Silver", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "2x12 Interstate": { id: "HD2_CabMicIr_2x12Interstate", name: "2x12 Interstate", basedOn: "Dr. Z 2x12", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "2x12 Match H30": { id: "HD2_CabMicIr_2x12MatchH30", name: "2x12 Match H30", basedOn: "Matchless 2x12 G12H30", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "2x12 Jazz Rivet": { id: "HD2_CabMicIr_2x12JazzRivet", name: "2x12 Jazz Rivet", basedOn: "Roland JC-120 2x12", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 6, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "4x10 Tweed P10R": { id: "HD2_CabMicIr_4x10TweedP10R", name: "4x10 Tweed P10R", basedOn: "Fender Bassman 4x10", category: "medium", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
  "4x12 Greenback25": { id: "HD2_CabMicIr_4x12Greenback25", name: "4x12 Greenback25", basedOn: "Marshall 4x12 Greenback 25W", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "4x12 Greenback20": { id: "HD2_CabMicIr_4x12Greenback20", name: "4x12 Greenback20", basedOn: "Marshall 4x12 Greenback 20W", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "4x12 Blackback H30": { id: "HD2_CabMicIr_4x12BlackbackH30", name: "4x12 Blackback H30", basedOn: "Marshall 4x12 Blackback H30", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "4x12 Cali V30": { id: "HD2_CabMicIr_4x12CaliV30", name: "4x12 Cali V30", basedOn: "Mesa 4x12 Vintage 30", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 100.0, HighCut: 6500.0, Position: 0.24, Angle: 0 } },
  "4x12 Uber V30": { id: "HD2_CabMicIr_4x12UberV30", name: "4x12 Uber V30", basedOn: "Bogner 4x12 V30", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 100.0, HighCut: 6500.0, Position: 0.24, Angle: 0 } },
  "4x12 XXL V30": { id: "HD2_CabMicIr_4x12XXLV30", name: "4x12 XXL V30", basedOn: "Engl 4x12 V30", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 100.0, HighCut: 6500.0, Position: 0.24, Angle: 0 } },
  "4x12 WhoWatt 100": { id: "HD2_CabMicIr_4x12WhoWatt100", name: "4x12 WhoWatt 100", basedOn: "Hiwatt 4x12 Fane", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 7500.0, Position: 0.24, Angle: 0 } },
  "4x12 Solo Lead EM": { id: "HD2_CabMicIr_4x12SoloLeadEM", name: "4x12 Solo Lead EM", basedOn: "Soldano 4x12 Eminence", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 100.0, HighCut: 6500.0, Position: 0.24, Angle: 0 } },
  "4x12 Brit V30": { id: "HD2_CabMicIr_4x12BritV30", name: "4x12 Brit V30", basedOn: "Marshall 4x12 V30", category: "large", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 100.0, HighCut: 6500.0, Position: 0.24, Angle: 0 } },
  "Soup Pro Ellipse": { id: "HD2_CabMicIr_SoupProEllipse", name: "Soup Pro Ellipse", basedOn: "Supro 1x6/1x8 Elliptical", category: "small", blockType: BLOCK_TYPES.CAB_IN_SLOT, defaultParams: { Mic: 0, Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 8000.0, Position: 0.24, Angle: 0 } },
};

// ============================================================
// DISTORTION / OVERDRIVE MODELS
// ============================================================
export const DISTORTION_MODELS: Record<string, HelixModel> = {
  "Scream 808": { id: "HD2_DistScream808", name: "Scream 808", basedOn: "Ibanez TS808 Tube Screamer", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.10, Tone: 0.45, Level: 0.65 } },
  "Minotaur": { id: "HD2_DistMinotaur", name: "Minotaur", basedOn: "Klon Centaur", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Gain: 0.20, Treble: 0.50, Output: 0.60 } },
  "Teemah!": { id: "HD2_DistTeemah", name: "Teemah!", basedOn: "Paul Cochrane Timmy", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Bass: 0.5, Treble: 0.5, Level: 0.5 } },
  "Kinky Boost": { id: "HD2_DistKinkyBoost", name: "Kinky Boost", basedOn: "Xotic EP Booster", category: "boost", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Boost: 0.5 } },
  "Compulsive Drive": { id: "HD2_DistCompulsiveDrive", name: "Compulsive Drive", basedOn: "Fulltone OCD", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Heir Apparent": { id: "HD2_DistHeirApparent", name: "Heir Apparent", basedOn: "Analogman Prince of Tone", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Hedgehog D9": { id: "HD2_DistHedgehogD9", name: "Hedgehog D9", basedOn: "MXR Distortion+", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Distortion: 0.5, Output: 0.5 } },
  "Vermin Dist": { id: "HD2_DistVerminDist", name: "Vermin Dist", basedOn: "Pro Co RAT", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Distortion: 0.5, Filter: 0.5, Volume: 0.5 } },
  "Arbitrator Fuzz": { id: "HD2_DistArbitratorFuzz", name: "Arbitrator Fuzz", basedOn: "Arbiter Fuzz Face", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Fuzz: 0.7, Volume: 0.5 } },
  "Triangle Fuzz": { id: "HD2_DistTriangleFuzz", name: "Triangle Fuzz", basedOn: "EHX Big Muff (Triangle)", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Sustain: 0.6, Tone: 0.5, Level: 0.5 } },
  "Dhyana Drive": { id: "HD2_DistDhyanaDrive", name: "Dhyana Drive", basedOn: "Hermida Zendrive", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Voice: 0.5, Volume: 0.5 } },
  "KWB": { id: "HD2_DistKWB", name: "KWB", basedOn: "Benadrian Kowloon Walled Bunny", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Stupor OD": { id: "HD2_DistStuporOD", name: "Stupor OD", basedOn: "Boss SD-1 Super Overdrive", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Level: 0.5 } },
  "Deranged Master": { id: "HD2_DistDerangedMaster", name: "Deranged Master", basedOn: "Rangemaster Treble Booster", category: "boost", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Range: 0.5, Level: 0.5 } },
  "Valve Driver": { id: "HD2_DistValveDriver", name: "Valve Driver", basedOn: "Chandler Tube Driver", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Bias: 0.5, Tone: 0.5, Level: 0.5 } },
  "Top Secret OD": { id: "HD2_DistTopSecretOD", name: "Top Secret OD", basedOn: "DOD OD-250", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Level: 0.5 } },
  "Deez One Vintage": { id: "HD2_DistDeezOneVintage", name: "Deez One Vintage", basedOn: "Boss DS-1 (Vintage)", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Tone: 0.5, Distortion: 0.5, Level: 0.5 } },
  "Deez One Mod": { id: "HD2_DistDeezOneMod", name: "Deez One Mod", basedOn: "Boss DS-1 (Modified)", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Tone: 0.5, Distortion: 0.5, Level: 0.5 } },
  "Industrial Fuzz": { id: "HD2_DistIndustrialFuzz", name: "Industrial Fuzz", basedOn: "Z.Vex Fuzz Factory", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Stab: 0.5, Gate: 0.5, Comp: 0.5, Drive: 0.5, Volume: 0.5 } },
  "Tycoctavia Fuzz": { id: "HD2_DistTycoctaviaFuzz", name: "Tycoctavia Fuzz", basedOn: "Tycobrahe Octavia", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Fuzz: 0.7, Volume: 0.5 } },
  "Wringer Fuzz": { id: "HD2_DistWringerFuzz", name: "Wringer Fuzz", basedOn: "Garbage's Wringer Fuzz", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Fuzz: 0.7, Volume: 0.5 } },
  "Thrifter Fuzz": { id: "HD2_DistThrifterFuzz", name: "Thrifter Fuzz", basedOn: "Line 6 Original Fuzz", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Fuzz: 0.7, Volume: 0.5 } },
  "Clawthorn Drive": { id: "HD2_DistClawthornDrive", name: "Clawthorn Drive", basedOn: "EHX Crayon Full-Range Overdrive", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Horizon Drive": { id: "HD2_DistHorizonDrive", name: "Horizon Drive", basedOn: "Horizon Devices Precision Drive", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Attack: 0.5, BrightLvl: 0.5, Gate: 0.5, Level: 0.5 } },
  "Legendary Drive": { id: "HD2_DistLegendaryDrive", name: "Legendary Drive", basedOn: "Carlin Compressor (Lowell George)", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Alpaca Rouge": { id: "HD2_DistAlpacaRouge", name: "Alpaca Rouge", basedOn: "Way Huge Red Llama", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Obsidian 7000": { id: "HD2_DistObsidian7000", name: "Obsidian 7000", basedOn: "Darkglass Microtubes B7K", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Level: 0.5 } },
  "Bitcrusher": { id: "HD2_DistBitcrusher", name: "Bitcrusher", basedOn: "Line 6 Original Bitcrusher", category: "special", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { BitDepth: 0.5, SampleRate: 0.5, Level: 0.5 } },
  "Megaphone": { id: "HD2_DistMegaphone", name: "Megaphone", basedOn: "Line 6 Original Megaphone", category: "special", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Level: 0.5 } },
  "Rams Head": { id: "HD2_DistRamsHead", name: "Rams Head", basedOn: "EHX Big Muff (Ram's Head)", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Sustain: 0.6, Tone: 0.5, Level: 0.5 } },
  "Tone Sovereign": { id: "HD2_DistToneSovereign", name: "Tone Sovereign", basedOn: "Analogman King of Tone", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Prize Drive": { id: "HD2_DistPrizeDrive", name: "Prize Drive", basedOn: "Nobels ODR-1", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Spectrum: 0.5, Level: 0.5 } },
  "Pillars": { id: "HD2_DistPillars", name: "Pillars", basedOn: "Electro-Harmonix Op-Amp Big Muff", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Sustain: 0.6, Tone: 0.5, Level: 0.5 } },
};

// ============================================================
// DELAY MODELS
// ============================================================
export const DELAY_MODELS: Record<string, HelixModel> = {
  "Simple Delay": { id: "HD2_DelaySimpleDelay", name: "Simple Delay", basedOn: "Line 6 Original", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "Mod/Chorus Echo": { id: "HD2_DelayModChorusEcho", name: "Mod/Chorus Echo", basedOn: "Line 6 Original", category: "modulated", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, ModSpeed: 0.3, ModDepth: 0.5, Level: 0.0 } },
  "Dual Delay": { id: "HD2_DelayDualDelay", name: "Dual Delay", basedOn: "Line 6 Original", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { "Left Time": 0.375, "Right Time": 0.25, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "Ping Pong": { id: "HD2_DelayPingPong", name: "Ping Pong", basedOn: "Line 6 Original", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Spread: 1.0, Level: 0.0 } },
  "Transistor Tape": { id: "HD2_DelayTransistorTape", name: "Transistor Tape", basedOn: "Maestro Echoplex EP-3", category: "analog", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Wow: 0.3, Flutter: 0.3, Level: 0.0 } },
  "Adriatic Delay": { id: "HD2_DelayAdriaticDelay", name: "Adriatic Delay", basedOn: "Line 6 Original (BBD)", category: "analog", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, ModSpeed: 0.3, ModDepth: 0.3, Level: 0.0 } },
  "Elephant Man": { id: "HD2_DelayElephantMan", name: "Elephant Man", basedOn: "Electro-Harmonix Deluxe Memory Man", category: "analog", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, ModSpeed: 0.3, ModDepth: 0.3, Level: 0.0 } },
  "Cosmos Echo": { id: "HD2_DelayCosmosEcho", name: "Cosmos Echo", basedOn: "Roland RE-201 Space Echo", category: "tape", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Wow: 0.3, Flutter: 0.3, Level: 0.0 } },
  "Multi Pass": { id: "HD2_DelayMultiPass", name: "Multi Pass", basedOn: "Line 6 Original (Multi-Tap)", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Taps: 4, Level: 0.0 } },
  "Vintage Digital": { id: "HD2_DelayVintageDigitalV2", name: "Vintage Digital", basedOn: "Line 6 Original Vintage Digital", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "Bucket Brigade": { id: "HD2_DelayBucketBrigade", name: "Bucket Brigade", basedOn: "Boss DM-2 Analog Delay", category: "analog", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "Harmony Delay": { id: "HD2_DelayHarmonyDelay", name: "Harmony Delay", basedOn: "Line 6 Original Harmony", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Interval: 0, Key: 0, Level: 0.0 } },
  "Pitch Echo": { id: "HD2_DelayPitch", name: "Pitch Echo", basedOn: "Line 6 Original Pitch Shifting Delay", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, PitchInterval: 0, Level: 0.0 } },
  "Ducked Delay": { id: "HD2_DelayDuckedDelay", name: "Ducked Delay", basedOn: "Line 6 Original Ducked Delay", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, DuckThreshold: 0.5, Level: 0.0 } },
  "Reverse Delay": { id: "HD2_DelayReverseDelay", name: "Reverse Delay", basedOn: "Line 6 Original Reverse", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "Sweep Echo": { id: "HD2_DelaySweepEcho", name: "Sweep Echo", basedOn: "Line 6 Original Sweep Filter Delay", category: "modulated", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, SweepSpeed: 0.3, SweepDepth: 0.5, Level: 0.0 } },
  "Adriatic Swell": { id: "HD2_DelaySwellAdriatic", name: "Adriatic Swell", basedOn: "Line 6 Original (Adriatic with Swell)", category: "ambient", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, RiseTime: 0.3, Level: 0.0 } },
  "Vintage Swell": { id: "HD2_DelaySwellVintageDigital", name: "Vintage Swell", basedOn: "Line 6 Original (Digital with Swell)", category: "ambient", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, RiseTime: 0.3, Level: 0.0 } },
  "Heliosphere": { id: "HD2_DelayHeliosphere", name: "Heliosphere", basedOn: "Line 6 Original Ambient Delay/Reverb", category: "ambient", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
  "ADT": { id: "HD2_DelayADT", name: "ADT", basedOn: "Abbey Road ADT (Automatic Double Tracking)", category: "modulated", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.04, Feedback: 0.0, Mix: 0.5, Level: 0.0 } },
  "Criss Cross": { id: "HD2_DelayCrissCross", name: "Criss Cross", basedOn: "Line 6 Original Criss-Cross Delay", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Level: 0.0 } },
};

// ============================================================
// REVERB MODELS
// ============================================================
export const REVERB_MODELS: Record<string, HelixModel> = {
  "Plate": { id: "HD2_ReverbPlate", name: "Plate", basedOn: "Line 6 Original Plate", category: "plate", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.5, Mix: 0.25, PreDelay: 0.02, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Room": { id: "HD2_ReverbRoom", name: "Room", basedOn: "Line 6 Original Room", category: "room", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.4, Mix: 0.2, PreDelay: 0.01, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Hall": { id: "HD2_ReverbHall", name: "Hall", basedOn: "Line 6 Original Hall", category: "hall", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.6, Mix: 0.25, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Chamber": { id: "HD2_ReverbChamber", name: "Chamber", basedOn: "Line 6 Original Chamber", category: "chamber", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.5, Mix: 0.2, PreDelay: 0.02, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "'63 Spring": { id: "HD2_Reverb63Spring", name: "'63 Spring", basedOn: "Fender '63 Spring Reverb", category: "spring", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.5, Mix: 0.3, Dwell: 0.5, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Glitz": { id: "HD2_ReverbGlitz", name: "Glitz", basedOn: "Line 6 Original Shimmer", category: "shimmer", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.7, Mix: 0.3, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Ganymede": { id: "HD2_ReverbGanymede", name: "Ganymede", basedOn: "Line 6 Original Ambient", category: "ambient", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.8, Mix: 0.35, PreDelay: 0.05, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Searchlights": { id: "HD2_ReverbSearchlights", name: "Searchlights", basedOn: "Line 6 Original Modulated", category: "modulated", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.6, Mix: 0.3, PreDelay: 0.03, ModSpeed: 0.3, ModDepth: 0.3, Level: 0.0 } },
  "Particle Verb": { id: "HD2_ReverbParticle", name: "Particle Verb", basedOn: "Line 6 Original Granular", category: "special", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.7, Mix: 0.3, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Plateaux": { id: "HD2_ReverbPlateaux", name: "Plateaux", basedOn: "Line 6 Original Shimmer Plate", category: "shimmer", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.7, Mix: 0.3, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Double Tank": { id: "HD2_ReverbDoubleTank", name: "Double Tank", basedOn: "Line 6 Original Double Spring", category: "spring", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.5, Mix: 0.3, Dwell: 0.5, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Spring": { id: "HD2_ReverbSpring", name: "Spring", basedOn: "Line 6 Original Spring", category: "spring", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.5, Mix: 0.3, Dwell: 0.5, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Ducking": { id: "HD2_ReverbDucking", name: "Ducking", basedOn: "Line 6 Original Ducking Reverb", category: "hall", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.6, Mix: 0.25, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Octo": { id: "HD2_ReverbOcto", name: "Octo", basedOn: "Line 6 Original Octave Reverb", category: "shimmer", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.7, Mix: 0.3, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Cave": { id: "HD2_ReverbCave", name: "Cave", basedOn: "Line 6 Original Cave", category: "hall", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.8, Mix: 0.3, PreDelay: 0.05, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Tile": { id: "HD2_ReverbTile", name: "Tile", basedOn: "Line 6 Original Tile Room", category: "room", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.4, Mix: 0.2, PreDelay: 0.01, Level: 0.0, LowCut: 100, HighCut: 8000 } },
  "Echo": { id: "HD2_ReverbEcho", name: "Echo", basedOn: "Line 6 Original Reverb Echo", category: "ambient", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.6, Mix: 0.25, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 8000 } },
};

// ============================================================
// MODULATION MODELS
// ============================================================
export const MODULATION_MODELS: Record<string, HelixModel> = {
  "70s Chorus": { id: "HD2_Chorus70sChorus", name: "70s Chorus", basedOn: "Boss CE-1 Chorus Ensemble", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "Chorus": { id: "HD2_Chorus", name: "Chorus", basedOn: "Line 6 Original Chorus", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "PlastiChorus": { id: "HD2_ChorusPlastiChorus", name: "PlastiChorus", basedOn: "TC Electronic SCF Stereo Chorus", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "Trinity Chorus": { id: "HD2_ChorusTrinityChorus", name: "Trinity Chorus", basedOn: "Dytronics Tri-Stereo Chorus", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, SpreadLR: 0.5, Level: 0.0 } },
  "Courtesan Flange": { id: "HD2_FlangerCourtesanFlange", name: "Courtesan Flange", basedOn: "MXR Flanger", category: "flanger", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Manual: 0.5, Feedback: 0.5, Mix: 0.5, Level: 0.0 } },
  "Script Mod Phase": { id: "HD2_PhaserScriptModPhase", name: "Script Mod Phase", basedOn: "MXR Phase 90 (Script Logo)", category: "phaser", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Mix: 0.5, Level: 0.0 } },
  "Ubiquitous Vibe": { id: "HD2_PhaserUbiquitousVibe", name: "Ubiquitous Vibe", basedOn: "Shin-ei Uni-Vibe", category: "vibe", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Intensity: 0.5, Mix: 0.5, Level: 0.0 } },
  "Optical Trem": { id: "HD2_TremoloOpticalTrem", name: "Optical Trem", basedOn: "Fender Optical Tremolo", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Level: 0.0 } },
  "Harmonic Tremolo": { id: "HD2_TremoloHarmonic", name: "Harmonic Tremolo", basedOn: "Line 6 Original Harmonic Trem", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "145 Rotary": { id: "HD2_Rotary145Rotary", name: "145 Rotary", basedOn: "Leslie 145", category: "rotary", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0, HornLevel: 0.5, DrumLevel: 0.5, Mix: 0.5, Level: 0.0 } },
  "Gray Flanger": { id: "HD2_FlangerGrayFlanger", name: "Gray Flanger", basedOn: "MXR M117 Flanger", category: "flanger", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Manual: 0.5, Feedback: 0.5, Mix: 0.5, Level: 0.0 } },
  "Deluxe Phaser": { id: "HD2_PhaserDeluxePhaser", name: "Deluxe Phaser", basedOn: "MXR Phase 100", category: "phaser", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Mix: 0.5, Level: 0.0 } },
  "Tremolo": { id: "HD2_TremoloTremolo", name: "Tremolo", basedOn: "Line 6 Original Tremolo", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Level: 0.0 } },
  "Pattern Tremolo": { id: "HD2_TremoloPattern", name: "Pattern Tremolo", basedOn: "Line 6 Original Pattern Trem", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Level: 0.0 } },
  "Vibe Rotary": { id: "HD2_RotaryVibeRotary", name: "Vibe Rotary", basedOn: "Fender Vibratone", category: "rotary", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0, Mix: 0.5, Level: 0.0 } },
  "122 Rotary": { id: "HD2_Rotary122Rotary", name: "122 Rotary", basedOn: "Leslie 122", category: "rotary", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0, HornLevel: 0.5, DrumLevel: 0.5, Mix: 0.5, Level: 0.0 } },
  "60s Bias Trem": { id: "HD2_Tremolo60sBiasTrem", name: "60s Bias Trem", basedOn: "Vox AC15 Bias Tremolo", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Level: 0.0 } },
  "Harmonic Flanger": { id: "HD2_FlangerHarmonicFlanger", name: "Harmonic Flanger", basedOn: "Line 6 Original Harmonic Flanger", category: "flanger", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Feedback: 0.5, Mix: 0.5, Level: 0.0 } },
  "Bubble Vibrato": { id: "HD2_VibratoBubbleVibrato", name: "Bubble Vibrato", basedOn: "Boss VB-2 Vibrato", category: "vibe", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Rise: 0.5, Level: 0.0 } },
};

// ============================================================
// DYNAMICS / COMPRESSOR MODELS
// ============================================================
export const DYNAMICS_MODELS: Record<string, HelixModel> = {
  "Deluxe Comp": { id: "HD2_CompressorDeluxeComp", name: "Deluxe Comp", basedOn: "Line 6 Original (inspired by UREI 1176)", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Threshold: 0.5, Ratio: 0.4, Attack: 0.3, Release: 0.5, Level: 0.5, Mix: 1.0 } },
  "Red Squeeze": { id: "HD2_CompressorRedSqueeze", name: "Red Squeeze", basedOn: "MXR Dyna Comp", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Sensitivity: 0.5, Level: 0.5 } },
  "Kinky Comp": { id: "HD2_CompressorKinkyComp", name: "Kinky Comp", basedOn: "Xotic SP Compressor", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Sensitivity: 0.5, Level: 0.5, Mix: 1.0 } },
  "LA Studio Comp": { id: "HD2_CompressorLAStudioComp", name: "LA Studio Comp", basedOn: "Teletronix LA-2A", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { PeakReduction: 0.5, Gain: 0.5, Mix: 1.0 } },
  "3-Band Comp": { id: "HD2_Compressor3BandComp", name: "3-Band Comp", basedOn: "Line 6 Original 3-Band Compressor", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { LowThresh: 0.5, MidThresh: 0.5, HighThresh: 0.5, Level: 0.5 } },
  "Rochester Comp": { id: "HD2_CompressorRochesterComp", name: "Rochester Comp", basedOn: "Ashly CLX-52", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Sensitivity: 0.5, Level: 0.5 } },
  "Opto Comp": { id: "HD2_CompressorOptoComp", name: "Opto Comp", basedOn: "Line 6 Original Optical Compressor", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Sensitivity: 0.5, Level: 0.5 } },
  "Noise Gate": { id: "HD2_GateNoiseGate", name: "Noise Gate", basedOn: "Line 6 Original", category: "gate", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Threshold: 0.5, Decay: 0.5 } },
  "Hard Gate": { id: "HD2_GateHardGate", name: "Hard Gate", basedOn: "Line 6 Original (Hard Cut)", category: "gate", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { "Open Threshold": 0.5, "Close Threshold": 0.4, "Hold Time": 0.1, Decay: 0.1 } },
  "Horizon Gate": { id: "HD2_GateHorizonGate", name: "Horizon Gate", basedOn: "Horizon Devices Precision Drive (gate)", category: "gate", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Threshold: 0.5, Decay: 0.5 } },
  "Autoswell": { id: "HD2_CompressorAutoSwell", name: "Autoswell", basedOn: "Line 6 Original Auto Volume Swell", category: "dynamics", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { RiseTime: 0.5, Level: 0.5 } },
};

// ============================================================
// EQ MODELS
// ============================================================
export const EQ_MODELS: Record<string, HelixModel> = {
  "Parametric EQ": { id: "HD2_EQParametric", name: "Parametric EQ", basedOn: "Line 6 Original", category: "parametric", blockType: BLOCK_TYPES.EQ, defaultParams: { LowFreq: 0.18, LowGain: 0.50, MidFreq: 0.40, MidGain: 0.50, Q: 0.50, HighFreq: 0.75, HighGain: 0.50, Level: 0.0 } },
  "Simple EQ": { id: "HD2_EQSimple3Band", name: "Simple EQ", basedOn: "Line 6 Original 3-Band", category: "simple", blockType: BLOCK_TYPES.EQ, defaultParams: { Bass: 0.50, Mid: 0.50, Treble: 0.50, Level: 0.0 } },
  "Cali Q Graphic": { id: "HD2_CaliQ", name: "Cali Q Graphic", basedOn: "Mesa/Boogie 5-Band Graphic", category: "graphic", blockType: BLOCK_TYPES.EQ, defaultParams: { "80Hz": 0.50, "240Hz": 0.50, "750Hz": 0.50, "2200Hz": 0.50, "6600Hz": 0.50, Level: 0.0 } },
  "10 Band Graphic": { id: "HD2_EQGraphic10Band", name: "10 Band Graphic", basedOn: "MXR 10-Band Graphic EQ", category: "graphic", blockType: BLOCK_TYPES.EQ, defaultParams: { Level: 0.0 } },
  "Low and High Cut": { id: "HD2_EQLowCutHighCut", name: "Low and High Cut", basedOn: "Line 6 Original", category: "cut", blockType: BLOCK_TYPES.EQ, defaultParams: { LowCut: 0.10, HighCut: 0.85, Level: 0.0 } },
  "Tilt EQ": { id: "HD2_EQSimpleTilt", name: "Tilt EQ", basedOn: "Line 6 Original Tilt", category: "tilt", blockType: BLOCK_TYPES.EQ, defaultParams: { CenterFreq: 0.50, Tilt: 0.50, Level: 0.0 } },
};

// ============================================================
// WAH MODELS
// ============================================================
export const WAH_MODELS: Record<string, HelixModel> = {
  "UK Wah 846": { id: "HD2_WahUKWah846", name: "UK Wah 846", basedOn: "Vox V846", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Teardrop 310": { id: "HD2_WahTeardrop310", name: "Teardrop 310", basedOn: "Dunlop Cry Baby", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Fassel": { id: "HD2_WahFassel", name: "Fassel", basedOn: "RMC Real McCoy 1", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Weeper": { id: "HD2_WahWeeper", name: "Weeper", basedOn: "Musitronics Mu-Tron III", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Chrome": { id: "HD2_WahChrome", name: "Chrome", basedOn: "Vox Chrome Custom", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Chrome Custom": { id: "HD2_WahChromeCustom", name: "Chrome Custom", basedOn: "Vox Chrome Custom (Modified)", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Throaty": { id: "HD2_WahThroaty", name: "Throaty", basedOn: "Line 6 Original Throaty Wah", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Conductor": { id: "HD2_WahConductor", name: "Conductor", basedOn: "Line 6 Original Conductor Wah", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Colorful": { id: "HD2_WahColorful", name: "Colorful", basedOn: "Colorsound Wah", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
};

// ============================================================
// VOLUME / PAN MODELS
// ============================================================
export const VOLUME_MODELS: Record<string, HelixModel> = {
  "Volume Pedal": { id: "HD2_VolPanVol", name: "Volume Pedal", basedOn: "Volume Pedal", category: "volume", blockType: BLOCK_TYPES.VOLUME, defaultParams: { Position: 1.0 } },
  "Gain Block": { id: "HD2_VolPanGain", name: "Gain Block", basedOn: "Line 6 Original Gain", category: "gain", blockType: BLOCK_TYPES.VOLUME, defaultParams: { Gain: 0.0 } },
};

// ============================================================
// STADIUM AMP MODELS — Agoura_* prefix (STAD-03)
// Source: Phase 31 real .hsp inspection + Line 6 Stadium model documentation
// These models are EXCLUSIVE to Helix Stadium. stadiumOnly: true prevents them
// from appearing in Helix LT/Floor/Pod Go planner prompts.
// ============================================================
export const STADIUM_AMPS: Record<string, HelixModel> = {
  // --- Confirmed from real .hsp file (Phase 31 inspection, 2026-03-04) ---
  "Agoura German Xtra Red": {
    id: "Agoura_AmpGermanXtraRed",
    name: "Agoura German Xtra Red",
    basedOn: "Mesa/Boogie Mark V+ (Extreme Red channel)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30"],
    defaultParams: { Drive: 0.65, Bass: 0.50, Mid: 0.45, Treble: 0.55, Master: 0.45, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura Brit 2203 MV": {
    id: "Agoura_AmpBrit2203MV",
    name: "Agoura Brit 2203 MV",
    basedOn: "Marshall JCM800 2203 Master Volume",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback 25"],
    defaultParams: { Drive: 0.60, Bass: 0.50, Mid: 0.50, Treble: 0.60, Master: 0.45, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  // --- Documented in architecture research (ARCHITECTURE.md, 2026-03-04) ---
  "Agoura WhoWatt 103": {
    id: "Agoura_AmpWhoWatt103",
    name: "Agoura WhoWatt 103",
    basedOn: "Koch Who Watt 103",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback 25", "2x12 Double C12N"],
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.55, Master: 0.50, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  // --- Derived from Line 6 Stadium model naming conventions ---
  "Agoura German Clean": {
    id: "Agoura_AmpGermanClean",
    name: "Agoura German Clean",
    basedOn: "Mesa/Boogie Mark V (Clean channel)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30", "2x12 Double C12N"],
    defaultParams: { Drive: 0.20, Bass: 0.50, Mid: 0.50, Treble: 0.55, Master: 0.55, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura German Crunch": {
    id: "Agoura_AmpGermanCrunch",
    name: "Agoura German Crunch",
    basedOn: "Mesa/Boogie Mark V (Crunch channel)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30"],
    defaultParams: { Drive: 0.45, Bass: 0.50, Mid: 0.48, Treble: 0.55, Master: 0.48, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura German Lead": {
    id: "Agoura_AmpGermanLead",
    name: "Agoura German Lead",
    basedOn: "Mesa/Boogie Mark V (Lead channel)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30"],
    defaultParams: { Drive: 0.58, Bass: 0.45, Mid: 0.42, Treble: 0.55, Master: 0.45, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura Brit 800": {
    id: "Agoura_AmpBrit800",
    name: "Agoura Brit 800",
    basedOn: "Marshall JCM800 2203 (non-MV)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback 25", "4x12 Brit T75"],
    defaultParams: { Drive: 0.55, Bass: 0.50, Mid: 0.50, Treble: 0.60, Master: 0.50, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura Brit Plexi": {
    id: "Agoura_AmpBritPlexi",
    name: "Agoura Brit Plexi",
    basedOn: "Marshall Super Lead Plexi 1959",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Greenback 25"],
    defaultParams: { Drive: 0.50, Bass: 0.50, Mid: 0.55, Treble: 0.60, Master: 0.55, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura US Clean": {
    id: "Agoura_AmpUSClean",
    name: "Agoura US Clean",
    basedOn: "Fender Twin Reverb (Clean)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["2x12 Double C12N", "1x12 US Deluxe"],
    defaultParams: { Drive: 0.18, Bass: 0.50, Mid: 0.50, Treble: 0.55, Master: 0.60, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura US Trem": {
    id: "Agoura_AmpUSTrem",
    name: "Agoura US Trem",
    basedOn: "Fender Vibrolux Reverb (Tremolo channel)",
    category: "clean",
    ampCategory: "clean" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["2x12 Double C12N", "1x12 US Deluxe"],
    defaultParams: { Drive: 0.22, Bass: 0.50, Mid: 0.50, Treble: 0.55, Master: 0.60, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura Tread Plate Red": {
    id: "Agoura_AmpTreadPlateRed",
    name: "Agoura Tread Plate Red",
    basedOn: "Mesa/Boogie Dual Rectifier (Red mode)",
    category: "high_gain",
    ampCategory: "high_gain" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30"],
    defaultParams: { Drive: 0.60, Bass: 0.45, Mid: 0.40, Treble: 0.55, Master: 0.45, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
  "Agoura Tread Plate Orange": {
    id: "Agoura_AmpTreadPlateOrange",
    name: "Agoura Tread Plate Orange",
    basedOn: "Mesa/Boogie Dual Rectifier (Orange mode)",
    category: "crunch",
    ampCategory: "crunch" as const,
    topology: "plate_fed" as const,
    cabAffinity: ["4x12 Uber V30"],
    defaultParams: { Drive: 0.52, Bass: 0.48, Mid: 0.45, Treble: 0.55, Master: 0.48, ChVol: 0.80 },
    blockType: BLOCK_TYPES.AMP_WITH_CAB,
    stadiumOnly: true,
  },
};

// ============================================================
// STADIUM EQ MODELS — Stadium-specific EQ (STAD-03)
// Stadium replaces the 5-band Parametric EQ with a 7-band version.
// Models NOT available on Stadium: Simple EQ, Low and High Cut,
// Tilt EQ, Cali Q Graphic (5-band EQ style removed).
// ============================================================
export const STADIUM_EQ_MODELS: Record<string, HelixModel> = {
  "Stadium Parametric EQ": {
    id: "HD2_EQParametric7Band",
    name: "Stadium Parametric EQ",
    basedOn: "Line 6 Stadium 7-Band Parametric EQ",
    category: "parametric",
    defaultParams: {
      LowFreq: 0.10, LowGain: 0.50,
      LowMidFreq: 0.25, LowMidGain: 0.50, LowMidQ: 0.50,
      MidFreq: 0.45, MidGain: 0.50, MidQ: 0.50,
      HighMidFreq: 0.65, HighMidGain: 0.50, HighMidQ: 0.50,
      HighFreq: 0.80, HighGain: 0.50,
      Level: 0.0,
    },
    blockType: BLOCK_TYPES.EQ,
    stadiumOnly: true,
  },
  // Stadium retains the 10-band graphic EQ
  "10 Band Graphic": { id: "HD2_EQGraphic10Band", name: "10 Band Graphic", basedOn: "MXR 10-Band Graphic EQ", category: "graphic", blockType: BLOCK_TYPES.EQ, defaultParams: { Level: 0.0 } },
};

// Model name tuples for z.enum() constraints in ToneIntentSchema
// z.enum() requires a non-empty tuple: [string, ...string[]]
// AMP_NAMES includes BOTH standard (HD2_*) and Stadium (Agoura_*) amps.
// The planner prompt filters which amps Claude sees per device — the schema just validates
// that the chosen name exists somewhere in the combined catalog.
export const AMP_NAMES = [...Object.keys(AMP_MODELS), ...Object.keys(STADIUM_AMPS)] as [string, ...string[]];
export const CAB_NAMES = Object.keys(CAB_MODELS) as [string, ...string[]];
// Combine user-selectable effect categories (exclude EQ, WAH, VOLUME -- Knowledge Layer handles those)
export const EFFECT_NAMES = [
  ...Object.keys(DISTORTION_MODELS),
  ...Object.keys(DELAY_MODELS),
  ...Object.keys(REVERB_MODELS),
  ...Object.keys(MODULATION_MODELS),
  ...Object.keys(DYNAMICS_MODELS),
] as [string, ...string[]];

// Convenience lookup: all models by ID
// Includes Stadium-specific catalogs so validate.ts VALID_IDS picks up Agoura_ and Stadium EQ IDs (STAD-04)
export function getAllModels(): Record<string, HelixModel> {
  return {
    ...AMP_MODELS,
    ...CAB_MODELS,
    ...DISTORTION_MODELS,
    ...DELAY_MODELS,
    ...REVERB_MODELS,
    ...MODULATION_MODELS,
    ...DYNAMICS_MODELS,
    ...EQ_MODELS,
    ...WAH_MODELS,
    ...VOLUME_MODELS,
    // Stadium-specific catalogs (stadiumOnly: true entries excluded from non-Stadium prompts)
    ...STADIUM_AMPS,
    ...STADIUM_EQ_MODELS,
  };
}

// Build a condensed model list string for the system prompt
// Accepts optional device parameter to filter models for Pod Go or Stadium (STAD-03)
export function getModelListForPrompt(device?: DeviceTarget): string {
  // Stadium path: return Stadium-specific catalog (Agoura amps + HD2 effects + Stadium EQ)
  if (device && isStadium(device)) {
    const sections = [
      { title: "AMPS", models: STADIUM_AMPS },
      { title: "CABS", models: CAB_MODELS },
      { title: "DISTORTION/OVERDRIVE", models: DISTORTION_MODELS },
      { title: "DELAY", models: DELAY_MODELS },
      { title: "REVERB", models: REVERB_MODELS },
      { title: "MODULATION", models: MODULATION_MODELS },
      { title: "DYNAMICS", models: DYNAMICS_MODELS },
      { title: "EQ", models: STADIUM_EQ_MODELS },
      { title: "WAH", models: WAH_MODELS },
      { title: "VOLUME", models: VOLUME_MODELS },
    ];
    return sections.map(s => {
      const entries = Object.entries(s.models)
        .map(([name, m]) => `  - ${name} (${m.id}) — based on ${m.basedOn}`)
        .join("\n");
      return `### ${s.title}\n${entries}`;
    }).join("\n\n");
  }

  // Helix LT/Floor/Pod Go path: exclude stadiumOnly models, apply Pod Go exclusion list
  const filterModels = (models: Record<string, HelixModel>): Record<string, HelixModel> => {
    const filtered: Record<string, HelixModel> = {};
    for (const [name, model] of Object.entries(models)) {
      // Exclude Stadium-only (Agoura) models from non-Stadium devices
      if (model.stadiumOnly) continue;
      // Exclude Pod Go excluded models
      if (device && isPodGo(device) && POD_GO_EXCLUDED_MODELS.has(name)) continue;
      filtered[name] = model;
    }
    return filtered;
  };

  const sections = [
    { title: "AMPS", models: filterModels(AMP_MODELS) },
    { title: "CABS", models: filterModels(CAB_MODELS) },
    { title: "DISTORTION/OVERDRIVE", models: filterModels(DISTORTION_MODELS) },
    { title: "DELAY", models: filterModels(DELAY_MODELS) },
    { title: "REVERB", models: filterModels(REVERB_MODELS) },
    { title: "MODULATION", models: filterModels(MODULATION_MODELS) },
    { title: "DYNAMICS", models: filterModels(DYNAMICS_MODELS) },
    { title: "EQ", models: filterModels(EQ_MODELS) },
    { title: "WAH", models: filterModels(WAH_MODELS) },
    { title: "VOLUME", models: filterModels(VOLUME_MODELS) },
  ];

  return sections.map(s => {
    const entries = Object.entries(s.models)
      .map(([name, m]) => `  - ${name} (${m.id}) — based on ${m.basedOn}`)
      .join("\n");
    return `### ${s.title}\n${entries}`;
  }).join("\n\n");
}

// ============================================================
// POD GO MODEL SUPPORT (PGMOD-01 through PGMOD-04)
// ============================================================

/**
 * Models excluded from Pod Go — too DSP-heavy or not ported.
 * Source: Line 6 Pod Go FAQ + firmware 2.50 notes (PGMOD-03)
 */
export const POD_GO_EXCLUDED_MODELS = new Set([
  "Tone Sovereign",   // HD2_DistToneSovereign — not ported to Pod Go
  "Clawthorn Drive",  // HD2_DistClawthornDrive — not ported to Pod Go
  "Cosmos Echo",      // HD2_DelayCosmosEcho — too DSP-heavy for single-chip Pod Go
]);

/**
 * Pod Go effect model ID suffix mapping by block type category.
 * Pod Go effect IDs append Mono or Stereo suffix; Helix IDs have no suffix (PGMOD-01).
 *
 * Mono-in effects: distortion, dynamics, pitch, EQ → "Mono"
 * Stereo-capable effects: delay, reverb, modulation, wah, volume → "Stereo"
 *
 * Source: Direct inspection of 18 real .pgp files (confirmed patterns)
 */
const POD_GO_EFFECT_SUFFIX: Record<string, "Mono" | "Stereo"> = {
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

/**
 * Get the correct model ID for a given device target (PGMOD-01).
 *
 * Amp and Cab IDs are shared between Helix and Pod Go (PGMOD-02).
 * Effect IDs on Pod Go append Mono/Stereo suffix.
 */
export function getModelIdForDevice(
  model: HelixModel,
  blockType: string,
  device: DeviceTarget,
): string {
  // Helix devices use model IDs as-is
  if (!isPodGo(device)) return model.id;

  // Amp IDs are identical between Pod Go and Helix (PGMOD-02)
  if (model.id.startsWith("HD2_Amp")) return model.id;

  // Cab IDs are shared
  if (model.id.startsWith("HD2_Cab") || model.id.startsWith("HD2_CabMicIr")) return model.id;

  // Effect IDs need Mono/Stereo suffix on Pod Go
  const suffix = POD_GO_EFFECT_SUFFIX[blockType];
  if (suffix) return model.id + suffix;

  // Unknown category — return as-is (shouldn't happen with known block types)
  return model.id;
}

/**
 * Get the correct @type value for a block on a given device.
 * Pod Go has completely different @type encoding from Helix.
 */
export function getBlockTypeForDevice(
  blockType: string,
  modelId: string,
  device: DeviceTarget,
): number {
  if (!isPodGo(device)) {
    // Helix block type mapping (existing logic)
    switch (blockType) {
      case "amp": return 3; // AMP_WITH_CAB for standard presets
      case "cab": return BLOCK_TYPES.CAB_IN_SLOT;
      case "distortion": return BLOCK_TYPES.DISTORTION;
      case "delay": return BLOCK_TYPES.DELAY;
      case "reverb": return BLOCK_TYPES.REVERB;
      case "modulation": return BLOCK_TYPES.MODULATION;
      case "dynamics": return BLOCK_TYPES.DYNAMICS;
      case "eq": return BLOCK_TYPES.EQ;
      case "wah": return BLOCK_TYPES.WAH;
      case "pitch": return BLOCK_TYPES.PITCH;
      case "volume": return BLOCK_TYPES.VOLUME;
      case "send_return": return BLOCK_TYPES.SEND_RETURN;
      default: return 0;
    }
  }

  // Pod Go block type mapping
  switch (blockType) {
    case "amp": return BLOCK_TYPES_PODGO.AMP;
    case "cab":
      // CabMicIr models get @type=0, simple cabs get @type=2
      if (modelId.startsWith("HD2_CabMicIr")) return BLOCK_TYPES_PODGO.GENERIC;
      return BLOCK_TYPES_PODGO.SIMPLE_CAB;
    case "delay": return BLOCK_TYPES_PODGO.DELAY;
    case "reverb": return BLOCK_TYPES_PODGO.REVERB;
    case "eq":
      // Static EQ models get @type=6, others get @type=0
      if (modelId.startsWith("HD2_EQ_STATIC")) return BLOCK_TYPES_PODGO.EQ_STATIC;
      return BLOCK_TYPES_PODGO.GENERIC;
    case "send_return": return BLOCK_TYPES_PODGO.FX_LOOP;
    // Distortion, dynamics, wah, pitch, volume, modulation → all @type=0
    default: return BLOCK_TYPES_PODGO.GENERIC;
  }
}

/**
 * Check if a model is available on a given device (PGMOD-03, PGMOD-04, STAD-03).
 *
 * - Pod Go: excludes models in POD_GO_EXCLUDED_MODELS
 * - Non-Stadium devices: excludes Stadium-only (Agoura_*) models
 * - Stadium: all Stadium models available; HD2_ effects are backward-compatible
 */
export function isModelAvailableForDevice(
  modelName: string,
  device: DeviceTarget,
): boolean {
  // Stadium: check if model is in Stadium catalog (Agoura amps + all HD2_ effects)
  if (isStadium(device)) {
    // Stadium-specific Agoura amps are available
    if (modelName in STADIUM_AMPS) return true;
    // Stadium-specific EQ is available
    if (modelName in STADIUM_EQ_MODELS) return true;
    // Standard effects (delay, reverb, modulation, dynamics, wah, volume, cabs) are backward-compatible
    // Stadium does NOT have: Simple EQ, Low and High Cut, Tilt EQ (HX 5-band removed)
    const STADIUM_UNAVAILABLE = new Set(["Simple EQ", "Low and High Cut", "Tilt EQ"]);
    if (STADIUM_UNAVAILABLE.has(modelName)) return false;
    return true;
  }

  // Non-Stadium: Agoura models are stadium-only
  if (modelName in STADIUM_AMPS || modelName in STADIUM_EQ_MODELS) {
    const allStadium = { ...STADIUM_AMPS, ...STADIUM_EQ_MODELS };
    if (allStadium[modelName]?.stadiumOnly) return false;
  }

  // Pod Go exclusion list
  if (!isPodGo(device)) return true;
  return !POD_GO_EXCLUDED_MODELS.has(modelName);
}
