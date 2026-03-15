// src/lib/helix/catalogs/anchors.ts
// The Master Index of expertly tuned "Semantic Anchors".

import type { SemanticAmpId, SemanticCabId, SemanticEffectId } from "./semantic-dictionary";

export type AnchorId = 
  | "anchor_american_clean"
  | "anchor_edge_of_breakup"
  | "anchor_classic_crunch"
  | "anchor_modern_metal"
  | "anchor_ambient_wash";

export interface AnchorEffect {
  semanticId: SemanticEffectId;
  params: Record<string, number | boolean>;
}

export interface PresetAnchor {
  id: AnchorId;
  name: string;
  description: string;
  
  // 1. Foundation Models
  coreAmp: SemanticAmpId;
  coreCab: SemanticCabId;
  
  // 2. Fundamental Parameter Tuning
  ampParams: Record<string, number | boolean>;
  cabParams: Record<string, number>;
  
  // 3. Signature Effects (Budget-dependent)
  mandatoryEffects: AnchorEffect[];    // Will consume DSP slots aggressively
  enhancementEffects: AnchorEffect[];  // Safe to drop on Stomp/PodGo
}

export const ANCHORS: Record<AnchorId, PresetAnchor> = {
  "anchor_american_clean": {
    id: "anchor_american_clean",
    name: "American Clean",
    description: "Pristine, high headroom Fender-style clean tone with subtle analog delay and spring reverb.",
    coreAmp: "us_double",
    coreCab: "2x12_us_double",
    ampParams: { Drive: 0.35, Master: 1.0, Bass: 0.50, Mid: 0.50, Treble: 0.60, Presence: 0.55 },
    cabParams: { LowCut: 80, HighCut: 6500, Distance: 1.0, Mic: 6 },
    mandatoryEffects: [
      { semanticId: "spring_reverb", params: { Mix: 0.25, Dwell: 0.50 } }
    ],
    enhancementEffects: [
      { semanticId: "studio_comp", params: { PeakReduction: 0.45, Gain: 0.60 } },
      { semanticId: "analog_delay", params: { Time: 0.35, Feedback: 0.25, Mix: 0.20 } }
    ]
  },
  
  "anchor_edge_of_breakup": {
    id: "anchor_edge_of_breakup",
    name: "Edge of Breakup",
    description: "Dynamic Class A amplifier that breaks up naturally when dug into, pushed further by a Klon.",
    coreAmp: "ac30",
    coreCab: "2x12_blue_bell",
    ampParams: { Drive: 0.60, Master: 1.0, Bass: 0.45, Mid: 0.55, Treble: 0.50, Cut: 0.45 },
    cabParams: { LowCut: 90, HighCut: 7000, Distance: 2.0, Mic: 0 },
    mandatoryEffects: [
      { semanticId: "klon", params: { Gain: 0.25, Treble: 0.60, Output: 0.70 } }
    ],
    enhancementEffects: [
      { semanticId: "tape_delay", params: { Time: 0.28, Feedback: 0.20, Mix: 0.25 } },
      { semanticId: "plate_reverb", params: { Mix: 0.20, Decay: 0.40 } }
    ]
  },
  
  "anchor_classic_crunch": {
    id: "anchor_classic_crunch",
    name: "Classic Crunch",
    description: "Mid-heavy British stack driven by a tube screamer for aggressive, articulate rhythm playing.",
    coreAmp: "brit_plexi",
    coreCab: "4x12_greenback25",
    ampParams: { Drive: 0.65, Master: 1.0, Bass: 0.40, Mid: 0.75, Treble: 0.65, Presence: 0.50 },
    cabParams: { LowCut: 100, HighCut: 5500, Distance: 1.5, Mic: 0 },
    mandatoryEffects: [
      { semanticId: "tube_screamer", params: { Gain: 0.15, Tone: 0.65, Level: 0.70 } }
    ],
    enhancementEffects: [
      { semanticId: "phaser", params: { Speed: 0.25, Mix: 0.35 } },
      { semanticId: "hall_reverb", params: { Mix: 0.15, Decay: 0.35 } }
    ]
  },
  
  "anchor_modern_metal": {
    id: "anchor_modern_metal",
    name: "Modern Metal",
    description: "Bone-crushing, high-gain rhythm tone. Ultra tight low-end, scooped mids, and zero spatial effects to keep it totally dry.",
    coreAmp: "ubersonic",
    coreCab: "4x12_uber_v30",
    ampParams: { Drive: 0.60, Master: 0.45, Bass: 0.70, Mid: 0.40, Treble: 0.65, Presence: 0.70 },
    cabParams: { LowCut: 110, HighCut: 5000, Distance: 1.0, Mic: 0 },
    mandatoryEffects: [
      { semanticId: "noise_gate", params: { Threshold: -45.0, Decay: 0.10 } },
      { semanticId: "tube_screamer", params: { Gain: 0.0, Tone: 0.70, Level: 1.0 } }
    ],
    enhancementEffects: [] // Metal rhythm must be dry
  },
  
  "anchor_ambient_wash": {
    id: "anchor_ambient_wash",
    name: "Ambient Wash",
    description: "Massive, ethereal clean tone heavily processed with dual delays and a vast plate reverb tail.",
    coreAmp: "us_deluxe",
    coreCab: "1x12_us_deluxe",
    ampParams: { Drive: 0.25, Master: 1.0, Bass: 0.40, Mid: 0.50, Treble: 0.50, Presence: 0.40 },
    cabParams: { LowCut: 100, HighCut: 6000, Distance: 1.0, Mic: 6 },
    mandatoryEffects: [
      { semanticId: "digital_delay", params: { Time: 0.50, Feedback: 0.65, Mix: 0.40 } },
      { semanticId: "plate_reverb", params: { Mix: 0.55, Decay: 0.85 } }
    ],
    enhancementEffects: [
      { semanticId: "studio_comp", params: { PeakReduction: 0.60, Gain: 0.50 } },
      { semanticId: "chorus", params: { Speed: 0.15, Depth: 0.40, Mix: 0.50 } },
      { semanticId: "tape_delay", params: { Time: 0.375, Feedback: 0.40, Mix: 0.25 } }
    ]
  }
};
