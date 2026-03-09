// mock-scenarios.ts — Mock ToneIntent fixtures for automated preset generation.
// 25 scenarios: 5 device families × 5 tone styles (clean, high-gain, blues, ambient, bass).
// All amp/cab/effect names are from valid family catalogs.
// Used by mock-harness.ts for v5.0 gold standard compliance testing.

import type { ToneIntent } from "./tone-intent";
import type { DeviceTarget } from "./types";

export interface MockScenario {
  id: string;
  device: DeviceTarget;
  toneStyle: "clean" | "high-gain" | "blues" | "ambient" | "bass";
  intent: ToneIntent;
}

// ---------------------------------------------------------------------------
// Shared snapshot templates
// ---------------------------------------------------------------------------

const STANDARD_SNAPSHOTS: ToneIntent["snapshots"] = [
  { name: "Clean", toneRole: "clean" },
  { name: "Crunch", toneRole: "crunch" },
  { name: "Lead", toneRole: "lead" },
  { name: "Ambient", toneRole: "ambient" },
];

// ---------------------------------------------------------------------------
// Helix (Floor/LT/Rack/Native) — uses AMP_MODELS, full effect set
// ---------------------------------------------------------------------------

const HELIX_SCENARIOS: MockScenario[] = [
  {
    id: "helix-clean",
    device: "helix_floor",
    toneStyle: "clean",
    intent: {
      ampName: "US Deluxe Nrm",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "70s Chorus", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Helix Clean",
      genreHint: "pop",
      tempoHint: 120,
    },
  },
  {
    id: "helix-highgain",
    device: "helix_lt",
    toneStyle: "high-gain",
    intent: {
      ampName: "Placater Dirty",
      cabName: "4x12 Cali V30",
      guitarType: "humbucker",
      effects: [
        { modelName: "Horizon Drive", role: "always_on" },
        { modelName: "Transistor Tape", role: "toggleable" },
        { modelName: "Glitz", role: "ambient" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Helix High Gain",
      genreHint: "metal",
      tempoHint: 140,
    },
  },
  {
    id: "helix-blues",
    device: "helix_floor",
    toneStyle: "blues",
    intent: {
      ampName: "Brit Plexi Nrm",
      cabName: "4x12 Greenback25",
      guitarType: "humbucker",
      effects: [
        { modelName: "Minotaur", role: "toggleable" },
        { modelName: "'63 Spring", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Helix Blues",
      genreHint: "blues",
      tempoHint: 110,
    },
  },
  {
    id: "helix-ambient",
    device: "helix_lt",
    toneStyle: "ambient",
    intent: {
      ampName: "US Double Nrm",
      cabName: "2x12 Double C12N",
      guitarType: "single_coil",
      effects: [
        { modelName: "Elephant Man", role: "always_on" },
        { modelName: "Ganymede", role: "always_on" },
        { modelName: "Script Mod Phase", role: "toggleable" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Helix Ambient",
      genreHint: "ambient",
      tempoHint: 90,
    },
  },
  {
    id: "helix-bass",
    device: "helix_floor",
    toneStyle: "bass",
    intent: {
      instrument: "bass",
      ampName: "SV Beast Nrm",
      cabName: "8x10 SVT AV",
      guitarType: "humbucker",
      effects: [
        { modelName: "Deluxe Comp", role: "always_on" },
        { modelName: "Simple Delay", role: "toggleable" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Helix Bass",
      genreHint: "rock",
      tempoHint: 120,
    },
  },
];

// ---------------------------------------------------------------------------
// HX Stomp — same catalogs as Helix, limited blocks
// ---------------------------------------------------------------------------

const STOMP_SCENARIOS: MockScenario[] = [
  {
    id: "stomp-clean",
    device: "helix_stomp",
    toneStyle: "clean",
    intent: {
      ampName: "US Deluxe Vib",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "PlastiChorus", role: "toggleable" },
        { modelName: "Room", role: "always_on" },
      ],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Crunch", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
      presetName: "Stomp Clean",
      genreHint: "pop",
      tempoHint: 120,
    },
  },
  {
    id: "stomp-highgain",
    device: "helix_stomp",
    toneStyle: "high-gain",
    intent: {
      ampName: "Cali Rectifire",
      cabName: "4x12 Cali V30",
      guitarType: "humbucker",
      effects: [
        { modelName: "Scream 808", role: "always_on" },
        { modelName: "Hall", role: "toggleable" },
      ],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Crunch", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
      presetName: "Stomp High Gain",
      genreHint: "metal",
      tempoHint: 160,
    },
  },
  {
    id: "stomp-blues",
    device: "helix_stomp",
    toneStyle: "blues",
    intent: {
      ampName: "Grammatico Nrm",
      cabName: "2x12 Double C12N",
      guitarType: "single_coil",
      effects: [
        { modelName: "Teemah!", role: "toggleable" },
        { modelName: "Spring", role: "always_on" },
      ],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Crunch", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
      presetName: "Stomp Blues",
      genreHint: "blues",
      tempoHint: 100,
    },
  },
  {
    id: "stomp-ambient",
    device: "helix_stomp",
    toneStyle: "ambient",
    intent: {
      ampName: "US Double Nrm",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "Adriatic Delay", role: "always_on" },
        { modelName: "Searchlights", role: "always_on" },
      ],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Crunch", toneRole: "crunch" },
        { name: "Ambient", toneRole: "ambient" },
      ],
      presetName: "Stomp Ambient",
      genreHint: "ambient",
      tempoHint: 85,
    },
  },
  {
    id: "stomp-bass",
    device: "helix_stomp",
    toneStyle: "bass",
    intent: {
      instrument: "bass",
      ampName: "Cali Bass",
      cabName: "6x10 Cali Power",
      guitarType: "humbucker",
      effects: [
        { modelName: "Red Squeeze", role: "always_on" },
      ],
      snapshots: [
        { name: "Clean", toneRole: "clean" },
        { name: "Crunch", toneRole: "crunch" },
        { name: "Lead", toneRole: "lead" },
      ],
      presetName: "Stomp Bass",
      genreHint: "rock",
      tempoHint: 120,
    },
  },
];

// ---------------------------------------------------------------------------
// HX Stomp XL — same catalogs, 4 snapshots
// ---------------------------------------------------------------------------

const STOMP_XL_SCENARIOS: MockScenario[] = [
  {
    id: "stompxl-clean",
    device: "helix_stomp_xl",
    toneStyle: "clean",
    intent: {
      ampName: "US Small Tweed",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "Chorus", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stomp XL Clean",
      genreHint: "country",
      tempoHint: 130,
    },
  },
  {
    id: "stompxl-highgain",
    device: "helix_stomp_xl",
    toneStyle: "high-gain",
    intent: {
      ampName: "Placater Dirty",
      cabName: "4x12 Cali V30",
      guitarType: "humbucker",
      effects: [
        { modelName: "Kinky Boost", role: "always_on" },
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Room", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "XL High Gain",
      genreHint: "metal",
      tempoHint: 150,
    },
  },
  {
    id: "stompxl-blues",
    device: "helix_stomp_xl",
    toneStyle: "blues",
    intent: {
      ampName: "Brit Plexi Nrm",
      cabName: "4x12 Greenback25",
      guitarType: "humbucker",
      effects: [
        { modelName: "Compulsive Drive", role: "toggleable" },
        { modelName: "'63 Spring", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "XL Blues",
      genreHint: "blues",
      tempoHint: 105,
    },
  },
  {
    id: "stompxl-ambient",
    device: "helix_stomp_xl",
    toneStyle: "ambient",
    intent: {
      ampName: "US Deluxe Nrm",
      cabName: "2x12 Double C12N",
      guitarType: "single_coil",
      effects: [
        { modelName: "Bucket Brigade", role: "always_on" },
        { modelName: "Ganymede", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "XL Ambient",
      genreHint: "ambient",
      tempoHint: 80,
    },
  },
  {
    id: "stompxl-bass",
    device: "helix_stomp_xl",
    toneStyle: "bass",
    intent: {
      instrument: "bass",
      ampName: "G Cougar 800",
      cabName: "4x10 Garden",
      guitarType: "humbucker",
      effects: [
        { modelName: "Deluxe Comp", role: "always_on" },
        { modelName: "Simple Delay", role: "toggleable" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "XL Bass",
      genreHint: "funk",
      tempoHint: 100,
    },
  },
];

// ---------------------------------------------------------------------------
// Pod Go — HD2 amps, filtered effects (no Cosmos Echo, etc.)
// ---------------------------------------------------------------------------

const PODGO_SCENARIOS: MockScenario[] = [
  {
    id: "podgo-clean",
    device: "pod_go",
    toneStyle: "clean",
    intent: {
      ampName: "US Double Nrm",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "70s Chorus", role: "toggleable" },
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "PodGo Clean",
      genreHint: "pop",
      tempoHint: 120,
    },
  },
  {
    id: "podgo-highgain",
    device: "pod_go",
    toneStyle: "high-gain",
    intent: {
      ampName: "Placater Dirty",
      cabName: "4x12 Cali V30",
      guitarType: "humbucker",
      effects: [
        { modelName: "Scream 808", role: "always_on" },
        { modelName: "Ping Pong", role: "toggleable" },
        { modelName: "Room", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "PodGo Metal",
      genreHint: "metal",
      tempoHint: 140,
    },
  },
  {
    id: "podgo-blues",
    device: "pod_go",
    toneStyle: "blues",
    intent: {
      ampName: "Brit Plexi Nrm",
      cabName: "4x12 Greenback25",
      guitarType: "single_coil",
      effects: [
        { modelName: "Minotaur", role: "toggleable" },
        { modelName: "'63 Spring", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "PodGo Blues",
      genreHint: "blues",
      tempoHint: 110,
    },
  },
  {
    id: "podgo-ambient",
    device: "pod_go",
    toneStyle: "ambient",
    intent: {
      ampName: "US Deluxe Vib",
      cabName: "2x12 Double C12N",
      guitarType: "single_coil",
      effects: [
        { modelName: "Elephant Man", role: "always_on" },
        { modelName: "Ganymede", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "PodGo Ambient",
      genreHint: "ambient",
      tempoHint: 85,
    },
  },
  {
    id: "podgo-bass",
    device: "pod_go",
    toneStyle: "bass",
    intent: {
      instrument: "bass",
      ampName: "SV Beast Brt",
      cabName: "8x10 SVT AV",
      guitarType: "humbucker",
      effects: [
        { modelName: "Red Squeeze", role: "always_on" },
        { modelName: "Simple Delay", role: "toggleable" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "PodGo Bass",
      genreHint: "rock",
      tempoHint: 120,
    },
  },
];

// ---------------------------------------------------------------------------
// Stadium — Agoura-era amps only
// No bass amps in Stadium (per v4.0 Phase 7 decision), so bass scenario
// uses a clean Agoura amp with compression.
// ---------------------------------------------------------------------------

const STADIUM_SCENARIOS: MockScenario[] = [
  {
    id: "stadium-clean",
    device: "helix_stadium",
    toneStyle: "clean",
    intent: {
      ampName: "Agoura US Luxe Black",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      effects: [
        { modelName: "70s Chorus", role: "toggleable" },
        { modelName: "Plate", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stadium Clean",
      genreHint: "pop",
      tempoHint: 120,
    },
  },
  {
    id: "stadium-highgain",
    device: "helix_stadium",
    toneStyle: "high-gain",
    intent: {
      ampName: "Agoura Revv Ch3 Purple",
      cabName: "4x12 Cali V30",
      guitarType: "humbucker",
      effects: [
        { modelName: "Horizon Drive", role: "always_on" },
        { modelName: "Simple Delay", role: "toggleable" },
        { modelName: "Hall", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stadium Metal",
      genreHint: "metal",
      tempoHint: 150,
    },
  },
  {
    id: "stadium-blues",
    device: "helix_stadium",
    toneStyle: "blues",
    intent: {
      ampName: "Agoura Brit Plexi",
      cabName: "4x12 Greenback25",
      guitarType: "humbucker",
      effects: [
        { modelName: "Minotaur", role: "toggleable" },
        { modelName: "'63 Spring", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stadium Blues",
      genreHint: "blues",
      tempoHint: 105,
    },
  },
  {
    id: "stadium-ambient",
    device: "helix_stadium",
    toneStyle: "ambient",
    intent: {
      ampName: "Agoura US Double Black",
      cabName: "2x12 Double C12N",
      guitarType: "single_coil",
      effects: [
        { modelName: "Transistor Tape", role: "always_on" },
        { modelName: "Ganymede", role: "always_on" },
        { modelName: "Script Mod Phase", role: "toggleable" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stadium Ambient",
      genreHint: "ambient",
      tempoHint: 90,
    },
  },
  {
    id: "stadium-bass",
    device: "helix_stadium",
    toneStyle: "bass",
    intent: {
      instrument: "bass",
      ampName: "Agoura US Clean",
      cabName: "4x10 Ampeg Pro",
      guitarType: "humbucker",
      effects: [
        { modelName: "Deluxe Comp", role: "always_on" },
        { modelName: "Room", role: "always_on" },
      ],
      snapshots: STANDARD_SNAPSHOTS,
      presetName: "Stadium Bass",
      genreHint: "rock",
      tempoHint: 110,
    },
  },
];

// ---------------------------------------------------------------------------
// All scenarios combined
// ---------------------------------------------------------------------------

export const MOCK_SCENARIOS: MockScenario[] = [
  ...HELIX_SCENARIOS,
  ...STOMP_SCENARIOS,
  ...STOMP_XL_SCENARIOS,
  ...PODGO_SCENARIOS,
  ...STADIUM_SCENARIOS,
];
