// Comprehensive database of Helix LT amp, cab, and effect models
// Model IDs match the HD2_* naming convention used in .hlx files

export interface HelixModel {
  id: string;
  name: string;
  basedOn: string;
  category: string;
  defaultParams: Record<string, number>;
  blockType: number; // @type value in .hlx
}

// Block type constants
export const BLOCK_TYPES = {
  DISTORTION: 0,
  AMP: 1,
  CAB: 2,
  MODULATION: 4,
  DELAY: 7,
  REVERB: 7,
  DYNAMICS: 0,
  EQ: 0,
  WAH: 0,
  PITCH: 0,
  VOLUME: 0,
  SEND_RETURN: 9,
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
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 1.0, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "US Deluxe Vib": {
    id: "HD2_AmpUSDeluxeVib",
    name: "US Deluxe Vib",
    basedOn: "Fender Deluxe Reverb (Vibrato)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 1.0, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "US Double Nrm": {
    id: "HD2_AmpUSDoubleNrm",
    name: "US Double Nrm",
    basedOn: "Fender Twin Reverb (Normal)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 1.0, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "US Small Tweed": {
    id: "HD2_AmpUSSmallTweed",
    name: "US Small Tweed",
    basedOn: "Fender Champ",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 1.0, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Essex A30": {
    id: "HD2_AmpEssexA30",
    name: "Essex A30",
    basedOn: "Vox AC30 (Top Boost)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Cut: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Essex A15": {
    id: "HD2_AmpEssexA15",
    name: "Essex A15",
    basedOn: "Vox AC15",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Cut: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Matchstick Ch1": {
    id: "HD2_AmpMatchstickCh1",
    name: "Matchstick Ch1",
    basedOn: "Matchless DC-30 (Ch1)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "WhoWatt 100": {
    id: "HD2_AmpWhoWatt100",
    name: "WhoWatt 100",
    basedOn: "Hiwatt DR103",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Grammatico Nrm": {
    id: "HD2_AmpGrammaticoNrm",
    name: "Grammatico Nrm",
    basedOn: "Grammatico LaGrange (Normal)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Fullerton Nrm": {
    id: "HD2_AmpFullertonNrm",
    name: "Fullerton Nrm",
    basedOn: "Fender Bassman (Normal)",
    category: "clean",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 1.0, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },

  // --- Crunch / Classic Rock ---
  "Brit Plexi Nrm": {
    id: "HD2_AmpBritPlexiNrm",
    name: "Brit Plexi Nrm",
    basedOn: "Marshall Super Lead 100 (Normal)",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Brit Plexi Brt": {
    id: "HD2_AmpBritPlexiBrt",
    name: "Brit Plexi Brt",
    basedOn: "Marshall Super Lead 100 (Bright)",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Brit Plexi Jump": {
    id: "HD2_AmpBritPlexiJump",
    name: "Brit Plexi Jump",
    basedOn: "Marshall Super Lead 100 (Jumped)",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Brit 2204": {
    id: "HD2_AmpBrit2204",
    name: "Brit 2204",
    basedOn: "Marshall JCM-800",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Derailed Ingrid": {
    id: "HD2_AmpDerailedIngrid",
    name: "Derailed Ingrid",
    basedOn: "Hiwatt DR103 (Cranked)",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Placater Clean": {
    id: "HD2_AmpPlacaterClean",
    name: "Placater Clean",
    basedOn: "Friedman BE-100 (Clean)",
    category: "crunch",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.5, Bass: 0.5, Mid: 0.5, Treble: 0.5, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Placater Dirty": {
    id: "HD2_AmpPlacaterDirty",
    name: "Placater Dirty",
    basedOn: "Friedman BE-100 (BE/HBE)",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.63, Bass: 0.5, Mid: 0.5, Treble: 0.62, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },

  // --- High Gain ---
  "Cali Rectifire": {
    id: "HD2_AmpCaliRectiworthy",
    name: "Cali Rectifire",
    basedOn: "Mesa/Boogie Dual Rectifier",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.5, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Cali IV Lead": {
    id: "HD2_AmpCaliIVLead",
    name: "Cali IV Lead",
    basedOn: "Mesa/Boogie Mark IV (Lead)",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.6, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "PV Panama": {
    id: "HD2_AmpPVPanama",
    name: "PV Panama",
    basedOn: "EVH 5150III",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.5, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Resonance: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Archetype Lead": {
    id: "HD2_AmpArchetypeLead",
    name: "Archetype Lead",
    basedOn: "PRS Archon (Lead)",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.6, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Das Benzin Mega": {
    id: "HD2_AmpGermanMahadeva",
    name: "Das Benzin Mega",
    basedOn: "Diezel VH4 (Ch3)",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.5, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Deep: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
  "Revv Gen Purple": {
    id: "HD2_AmpRevvPurple",
    name: "Revv Gen Purple",
    basedOn: "Revv Generator 120 (Purple/Ch3)",
    category: "high_gain",
    blockType: BLOCK_TYPES.AMP,
    defaultParams: { Drive: 0.6, Bass: 0.5, Mid: 0.5, Treble: 0.6, ChVol: 0.7, Master: 0.5, Presence: 0.5, Sag: 0.5, Hum: 0.5, Ripple: 0.5, Bias: 0.5, BiasX: 0.5 },
  },
};

// ============================================================
// CAB MODELS
// ============================================================
export const CAB_MODELS: Record<string, HelixModel> = {
  "1x8 Small Tweed": { id: "HD2_Cab1x8SmallTweed", name: "1x8 Small Tweed", basedOn: "Fender Champ 1x8", category: "small", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "1x12 US Deluxe": { id: "HD2_Cab1x12USDeluxe", name: "1x12 US Deluxe", basedOn: "Fender Deluxe Reverb 1x12", category: "small", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "1x12 Celest 12H": { id: "HD2_Cab1x12Celest12H", name: "1x12 Celest 12H", basedOn: "1x12 Celestion G12H", category: "small", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "2x12 Blue Bell": { id: "HD2_Cab2x12BlueBell", name: "2x12 Blue Bell", basedOn: "Vox AC30 2x12 Blue", category: "medium", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "2x12 Double C12N": { id: "HD2_Cab2x12DoubleC12N", name: "2x12 Double C12N", basedOn: "Fender Twin 2x12", category: "medium", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "2x12 Interstate": { id: "HD2_Cab2x12Interstate", name: "2x12 Interstate", basedOn: "Dr. Z 2x12", category: "medium", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "4x12 Greenback25": { id: "HD2_Cab4x12Greenback25", name: "4x12 Greenback25", basedOn: "Marshall 4x12 Greenback 25W", category: "large", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "4x12 Greenback20": { id: "HD2_Cab4x12Greenback20", name: "4x12 Greenback20", basedOn: "Marshall 4x12 Greenback 20W", category: "large", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "4x12 Cali V30": { id: "HD2_Cab4x12CaliV30", name: "4x12 Cali V30", basedOn: "Mesa 4x12 Vintage 30", category: "large", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "4x12 Uber V30": { id: "HD2_Cab4x12UberV30", name: "4x12 Uber V30", basedOn: "Bogner 4x12 V30", category: "large", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
  "4x12 XXL V30": { id: "HD2_Cab4x12XXLV30", name: "4x12 XXL V30", basedOn: "Engl 4x12 V30", category: "large", blockType: BLOCK_TYPES.CAB, defaultParams: { Distance: 1.0, Level: 0.0, LowCut: 80.0, HighCut: 12000.0 } },
};

// ============================================================
// DISTORTION / OVERDRIVE MODELS
// ============================================================
export const DISTORTION_MODELS: Record<string, HelixModel> = {
  "Scream 808": { id: "HD2_DistScream808", name: "Scream 808", basedOn: "Ibanez TS808 Tube Screamer", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Level: 0.5 } },
  "Minotaur": { id: "HD2_DistMinotaur", name: "Minotaur", basedOn: "Klon Centaur", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Gain: 0.5, Treble: 0.5, Output: 0.5 } },
  "Teemah!": { id: "HD2_DistTeemah", name: "Teemah!", basedOn: "Paul Cochrane Timmy", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Gain: 0.5, Bass: 0.5, Treble: 0.5, Volume: 0.5 } },
  "Kinky Boost": { id: "HD2_DistKinkyBoost", name: "Kinky Boost", basedOn: "Xotic EP Booster", category: "boost", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Boost: 0.5 } },
  "Compulsive Drive": { id: "HD2_DistCompulsiveDrive", name: "Compulsive Drive", basedOn: "Fulltone OCD", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Heir Apparent": { id: "HD2_DistHeirApparent", name: "Heir Apparent", basedOn: "Analogman Prince of Tone", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
  "Hedgehog D9": { id: "HD2_DistHedgehogD9", name: "Hedgehog D9", basedOn: "MXR Distortion+", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Distortion: 0.5, Output: 0.5 } },
  "Vermin Dist": { id: "HD2_DistVerminDist", name: "Vermin Dist", basedOn: "Pro Co RAT", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Distortion: 0.5, Filter: 0.5, Volume: 0.5 } },
  "Arbitrator Fuzz": { id: "HD2_DistArbitratorFuzz", name: "Arbitrator Fuzz", basedOn: "Arbiter Fuzz Face", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Fuzz: 0.7, Volume: 0.5 } },
  "Triangle Fuzz": { id: "HD2_DistTriangleFuzz", name: "Triangle Fuzz", basedOn: "EHX Big Muff (Triangle)", category: "fuzz", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Sustain: 0.6, Tone: 0.5, Level: 0.5 } },
  "Dhyana Drive": { id: "HD2_DistDhyanaDrive", name: "Dhyana Drive", basedOn: "Hermida Zendrive", category: "overdrive", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Voice: 0.5, Volume: 0.5 } },
  "KWB": { id: "HD2_DistKWB", name: "KWB", basedOn: "Benadrian Kowloon Walled Bunny", category: "distortion", blockType: BLOCK_TYPES.DISTORTION, defaultParams: { Drive: 0.5, Tone: 0.5, Volume: 0.5 } },
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
  "Cosmos Echo": { id: "HD2_DelayCosmos", name: "Cosmos Echo", basedOn: "Roland RE-201 Space Echo", category: "tape", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Wow: 0.3, Flutter: 0.3, Level: 0.0 } },
  "Multi Pass": { id: "HD2_DelayMultiPass", name: "Multi Pass", basedOn: "Line 6 Original (Multi-Tap)", category: "digital", blockType: BLOCK_TYPES.DELAY, defaultParams: { Time: 0.375, Feedback: 0.35, Mix: 0.3, Taps: 4, Level: 0.0 } },
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
  "Particle Verb": { id: "HD2_ReverbParticleVerb", name: "Particle Verb", basedOn: "Line 6 Original Granular", category: "special", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.7, Mix: 0.3, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 10000 } },
  "Dynamic Hall": { id: "HD2_ReverbDynamicHall", name: "Dynamic Hall", basedOn: "Line 6 Original Dynamic", category: "hall", blockType: BLOCK_TYPES.REVERB, defaultParams: { DecayTime: 0.6, Mix: 0.25, PreDelay: 0.03, Level: 0.0, LowCut: 100, HighCut: 8000 } },
};

// ============================================================
// MODULATION MODELS
// ============================================================
export const MODULATION_MODELS: Record<string, HelixModel> = {
  "Chorus": { id: "HD2_ChorusPlainJane", name: "70s Chorus", basedOn: "Line 6 Original Analog Chorus", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "Trinity Chorus": { id: "HD2_ChorusTrinityChorus", name: "Trinity Chorus", basedOn: "Dytronics Tri-Stereo Chorus", category: "chorus", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Tone: 0.5, Mix: 0.5, SpreadLR: 0.5, Level: 0.0 } },
  "Courtesan Flange": { id: "HD2_FlangerCourtesanFlange", name: "Courtesan Flange", basedOn: "MXR Flanger", category: "flanger", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Depth: 0.5, Manual: 0.5, Feedback: 0.5, Mix: 0.5, Level: 0.0 } },
  "Script Mod Phase": { id: "HD2_PhaserScriptModPhase", name: "Script Mod Phase", basedOn: "MXR Phase 90 (Script Logo)", category: "phaser", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Mix: 0.5, Level: 0.0 } },
  "Ubiquitous Vibe": { id: "HD2_RotaryUbiVibe", name: "Ubiquitous Vibe", basedOn: "Shin-ei Uni-Vibe", category: "vibe", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.4, Intensity: 0.5, Mix: 0.5, Level: 0.0 } },
  "Optical Trem": { id: "HD2_TremoloOpticalTrem", name: "Optical Trem", basedOn: "Fender Optical Tremolo", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Level: 0.0 } },
  "Harmonic Tremolo": { id: "HD2_TremoloHarmonicTrem", name: "Harmonic Tremolo", basedOn: "Line 6 Original Harmonic Trem", category: "tremolo", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0.5, Intensity: 0.5, Tone: 0.5, Mix: 0.5, Level: 0.0 } },
  "145 Rotary": { id: "HD2_Rotary145", name: "145 Rotary", basedOn: "Leslie 145", category: "rotary", blockType: BLOCK_TYPES.MODULATION, defaultParams: { Speed: 0, HornLevel: 0.5, DrumLevel: 0.5, Mix: 0.5, Level: 0.0 } },
};

// ============================================================
// DYNAMICS / COMPRESSOR MODELS
// ============================================================
export const DYNAMICS_MODELS: Record<string, HelixModel> = {
  "Deluxe Comp": { id: "HD2_CompressorDeluxeComp", name: "Deluxe Comp", basedOn: "Line 6 Original (inspired by UREI 1176)", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Threshold: 0.5, Ratio: 0.4, Attack: 0.3, Release: 0.5, Level: 0.5, Mix: 1.0 } },
  "LA Studio Comp": { id: "HD2_CompressorLAStudioComp", name: "LA Studio Comp", basedOn: "Teletronix LA-2A", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { PeakReduction: 0.5, Gain: 0.5, Mix: 1.0 } },
  "Rochester Comp": { id: "HD2_CompressorRochesterComp", name: "Rochester Comp", basedOn: "Ashly CLX-52 (Dyna-Comp style)", category: "compressor", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Sensitivity: 0.5, Level: 0.5 } },
  "Noise Gate": { id: "HD2_GateNoiseGate", name: "Noise Gate", basedOn: "Line 6 Original", category: "gate", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { Threshold: 0.5, Decay: 0.5 } },
  "Hard Gate": { id: "HD2_GateHardGate", name: "Hard Gate", basedOn: "Line 6 Original (Hard Cut)", category: "gate", blockType: BLOCK_TYPES.DYNAMICS, defaultParams: { "Open Threshold": 0.5, "Close Threshold": 0.4, "Hold Time": 0.1, Decay: 0.1 } },
};

// ============================================================
// EQ MODELS
// ============================================================
export const EQ_MODELS: Record<string, HelixModel> = {
  "Parametric EQ": { id: "HD2_EQParametric", name: "Parametric EQ", basedOn: "Line 6 Original", category: "parametric", blockType: BLOCK_TYPES.EQ, defaultParams: { LowFreq: 200, LowGain: 0.0, MidFreq: 1000, MidGain: 0.0, MidQ: 0.5, HighFreq: 4000, HighGain: 0.0, Level: 0.0 } },
  "Cali Q Graphic": { id: "HD2_EQCaliQ", name: "Cali Q Graphic", basedOn: "Mesa/Boogie 5-Band Graphic", category: "graphic", blockType: BLOCK_TYPES.EQ, defaultParams: { "80Hz": 0.0, "240Hz": 0.0, "750Hz": 0.0, "2200Hz": 0.0, "6600Hz": 0.0, Level: 0.0 } },
  "Low/High Cut": { id: "HD2_EQLowHighCut", name: "Low/High Cut", basedOn: "Line 6 Original", category: "cut", blockType: BLOCK_TYPES.EQ, defaultParams: { LowCut: 80, HighCut: 12000, Level: 0.0 } },
  "Tilt EQ": { id: "HD2_EQTilt", name: "Tilt EQ", basedOn: "Line 6 Original Tilt", category: "tilt", blockType: BLOCK_TYPES.EQ, defaultParams: { CenterFreq: 2000, Tilt: 0.0, Level: 0.0 } },
};

// ============================================================
// WAH MODELS
// ============================================================
export const WAH_MODELS: Record<string, HelixModel> = {
  "UK Wah 846": { id: "HD2_WahUK846", name: "UK Wah 846", basedOn: "Vox V846", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Teardrop 310": { id: "HD2_WahTeardrop310", name: "Teardrop 310", basedOn: "Dunlop Cry Baby", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Fassel": { id: "HD2_WahFassel", name: "Fassel", basedOn: "RMC Real McCoy 1", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
  "Chrome": { id: "HD2_WahChrome", name: "Chrome", basedOn: "Vox Chrome Custom", category: "wah", blockType: BLOCK_TYPES.WAH, defaultParams: { Position: 0.5, Mix: 1.0, Level: 0.0 } },
};

// ============================================================
// VOLUME / PAN MODELS
// ============================================================
export const VOLUME_MODELS: Record<string, HelixModel> = {
  "Volume Pedal": { id: "HD2_VolPanVol", name: "Volume Pedal", basedOn: "Volume Pedal", category: "volume", blockType: BLOCK_TYPES.VOLUME, defaultParams: { Position: 1.0 } },
  "Gain Block": { id: "HD2_VolPanGain", name: "Gain Block", basedOn: "Line 6 Original Gain", category: "gain", blockType: BLOCK_TYPES.VOLUME, defaultParams: { Gain: 0.0 } },
};

// Convenience lookup: all models by ID
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
  };
}

// Build a condensed model list string for the system prompt
export function getModelListForPrompt(): string {
  const sections = [
    { title: "AMPS", models: AMP_MODELS },
    { title: "CABS", models: CAB_MODELS },
    { title: "DISTORTION/OVERDRIVE", models: DISTORTION_MODELS },
    { title: "DELAY", models: DELAY_MODELS },
    { title: "REVERB", models: REVERB_MODELS },
    { title: "MODULATION", models: MODULATION_MODELS },
    { title: "DYNAMICS", models: DYNAMICS_MODELS },
    { title: "EQ", models: EQ_MODELS },
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
