// src/lib/helix/catalogs/semantic-dictionary.ts
// Semantic mapping from device-agnostic Anchor concepts to hardware-specific model IDs.

export type SemanticAmpId =
  | "us_double"
  | "us_deluxe"
  | "brit_plexi"
  | "brit_j45"
  | "ac30"
  | "rectifier"
  | "solo_lead"
  | "ubersonic";

export type SemanticCabId =
  | "1x12_us_deluxe"
  | "2x12_us_double"
  | "2x12_blue_bell"
  | "4x12_greenback25"
  | "4x12_brit_v30"
  | "4x12_cali_v30"
  | "4x12_uber_v30";

export type SemanticEffectCategory = "distortion" | "delay" | "reverb" | "modulation" | "dynamics" | "eq";

export type SemanticEffectId =
  // Overdrives
  | "tube_screamer"
  | "klon"
  | "timmy"
  // Delays
  | "analog_delay"
  | "tape_delay"
  | "digital_delay"
  // Reverbs
  | "plate_reverb"
  | "hall_reverb"
  | "spring_reverb"
  // Modulation
  | "chorus"
  | "phaser"
  | "flanger"
  // Dynamics
  | "studio_comp"
  | "noise_gate";

export interface SemanticAmpMapping {
  semanticId: SemanticAmpId;
  name: string;
  hd2Key: string;
  stadiumKey: string;
}

export interface SemanticCabMapping {
  semanticId: SemanticCabId;
  name: string;
  hd2Key: string;
  stadiumKey: string;
}

export interface SemanticEffectMapping {
  semanticId: SemanticEffectId;
  category: SemanticEffectCategory;
  name: string;
  hd2Key: string;
  stadiumKey: string;
}

// ---------------------------------------------------------------------------
// AMP MAPPINGS
// ---------------------------------------------------------------------------

export const SEMANTIC_AMPS: Record<SemanticAmpId, SemanticAmpMapping> = {
  "us_double": {
    semanticId: "us_double",
    name: "US Double (Fender Twin)",
    hd2Key: "US Double Nrm",
    stadiumKey: "Agoura US Double Black",
  },
  "us_deluxe": {
    semanticId: "us_deluxe",
    name: "US Deluxe (Fender Deluxe Reverb)",
    hd2Key: "US Deluxe Nrm",
    stadiumKey: "Agoura US Luxe Black",
  },
  "brit_plexi": {
    semanticId: "brit_plexi",
    name: "Brit Plexi (Marshall Super Lead)",
    hd2Key: "Brit Plexi Nrm",
    stadiumKey: "Agoura Brit Plexi",
  },
  "brit_j45": {
    semanticId: "brit_j45",
    name: "Brit J45 (Marshall JTM45)",
    hd2Key: "Brit J45 Nrm",
    stadiumKey: "Agoura Brit J45",
  },
  "ac30": {
    semanticId: "ac30",
    name: "Essex A30 (Vox AC30)",
    hd2Key: "Essex A30",
    stadiumKey: "Agoura Essex A30",
  },
  "rectifier": {
    semanticId: "rectifier",
    name: "Cali Rectifire (Mesa Dual Rectifier)",
    hd2Key: "Cali Rectifire",
    stadiumKey: "Agoura Tread Plate Red",
  },
  "solo_lead": {
    semanticId: "solo_lead",
    name: "Solo Lead (Soldano SLO-100)",
    hd2Key: "Solo Lead OD",
    stadiumKey: "Agoura Solo Lead",
  },
  "ubersonic": {
    semanticId: "ubersonic",
    name: "German Ubersonic (Bogner Uberschall)",
    hd2Key: "German Ubersonic",
    stadiumKey: "Agoura German Xtra Red",
  },
};

// ---------------------------------------------------------------------------
// CAB MAPPINGS
// ---------------------------------------------------------------------------

export const SEMANTIC_CABS: Record<SemanticCabId, SemanticCabMapping> = {
  "1x12_us_deluxe": {
    semanticId: "1x12_us_deluxe",
    name: "1x12 US Deluxe",
    hd2Key: "1x12 US Deluxe",
    stadiumKey: "1x12 US Deluxe",
  },
  "2x12_us_double": {
    semanticId: "2x12_us_double",
    name: "2x12 Double C12N",
    hd2Key: "2x12 Double C12N",
    stadiumKey: "2x12 Double C12N",
  },
  "2x12_blue_bell": {
    semanticId: "2x12_blue_bell",
    name: "2x12 Blue Bell",
    hd2Key: "2x12 Blue Bell",
    stadiumKey: "2x12 Blue Bell",
  },
  "4x12_greenback25": {
    semanticId: "4x12_greenback25",
    name: "4x12 Greenback25",
    hd2Key: "4x12 Greenback25",
    stadiumKey: "4x12 Greenback25",
  },
  "4x12_brit_v30": {
    semanticId: "4x12_brit_v30",
    name: "4x12 Brit V30",
    hd2Key: "4x12 Brit V30",
    stadiumKey: "4x12 Brit V30",
  },
  "4x12_cali_v30": {
    semanticId: "4x12_cali_v30",
    name: "4x12 Cali V30",
    hd2Key: "4x12 Cali V30",
    stadiumKey: "4x12 Cali V30",
  },
  "4x12_uber_v30": {
    semanticId: "4x12_uber_v30",
    name: "4x12 Uber V30",
    hd2Key: "4x12 Uber V30",
    stadiumKey: "4x12 Uber V30",
  },
};

// ---------------------------------------------------------------------------
// EFFECT MAPPINGS
// ---------------------------------------------------------------------------

export const SEMANTIC_EFFECTS: Record<SemanticEffectId, SemanticEffectMapping> = {
  "tube_screamer": { semanticId: "tube_screamer", category: "distortion", name: "Scream 808", hd2Key: "Scream 808", stadiumKey: "Scream 808" },
  "klon": { semanticId: "klon", category: "distortion", name: "Minotaur", hd2Key: "Minotaur", stadiumKey: "Minotaur" },
  "timmy": { semanticId: "timmy", category: "distortion", name: "Teemah!", hd2Key: "Teemah!", stadiumKey: "Teemah!" },
  
  "analog_delay": { semanticId: "analog_delay", category: "delay", name: "Adriatic Delay", hd2Key: "Adriatic Delay", stadiumKey: "Adriatic Delay" },
  "tape_delay": { semanticId: "tape_delay", category: "delay", name: "Transistor Tape", hd2Key: "Transistor Tape", stadiumKey: "Transistor Tape" },
  "digital_delay": { semanticId: "digital_delay", category: "delay", name: "Simple Delay", hd2Key: "Simple Delay", stadiumKey: "Simple Delay" },
  
  "plate_reverb": { semanticId: "plate_reverb", category: "reverb", name: "Dynamic Plate", hd2Key: "Dynamic Plate", stadiumKey: "Dynamic Plate" },
  "hall_reverb": { semanticId: "hall_reverb", category: "reverb", name: "Dynamic Hall", hd2Key: "Dynamic Hall", stadiumKey: "Dynamic Hall" },
  "spring_reverb": { semanticId: "spring_reverb", category: "reverb", name: "Hot Springs", hd2Key: "Hot Springs", stadiumKey: "Hot Springs" },
  
  "chorus": { semanticId: "chorus", category: "modulation", name: "Chorus", hd2Key: "Chorus", stadiumKey: "Chorus" },
  "phaser": { semanticId: "phaser", category: "modulation", name: "Script Mod Phase", hd2Key: "Script Mod Phase", stadiumKey: "Script Mod Phase" },
  "flanger": { semanticId: "flanger", category: "modulation", name: "Grey Flanger", hd2Key: "Grey Flanger", stadiumKey: "Grey Flanger" },

  "studio_comp": { semanticId: "studio_comp", category: "dynamics", name: "Studio Comp", hd2Key: "Studio Comp", stadiumKey: "Studio Comp" },
  "noise_gate": { semanticId: "noise_gate", category: "dynamics", name: "Horizon Gate", hd2Key: "Horizon Gate", stadiumKey: "Horizon Gate" },
};
