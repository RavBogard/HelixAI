// src/lib/rig-mapping.ts
// Deterministic pedal-to-Helix substitution mapping layer (Phase 18).
//
// Converts physical pedal names from a user's rig (PhysicalPedal.fullName) into
// Helix model substitutions with three confidence tiers:
//   "direct"      — exact match found in PEDAL_HELIX_MAP
//   "close"       — category recognized, best category fallback used
//   "approximate" — category unknown, safest global fallback used
//
// Lookup key: pedal.fullName.toLowerCase().trim()
// Secondary:  pedal.model.toLowerCase().trim() (short name, e.g. "ts9")
//
// IMPORTANT: blockType in PedalMapEntry is a lowercase string ("distortion",
// "dynamics", "delay", "reverb", "modulation") — NOT a BLOCK_TYPES number.
// getModelIdForDevice() uses these strings as keys in POD_GO_EFFECT_SUFFIX.

import {
  getModelIdForDevice,
  isModelAvailableForDevice,
} from "@/lib/helix";
import type { RigIntent, SubstitutionEntry, SubstitutionMap, DeviceTarget } from "@/lib/helix";
import type { HelixModel } from "@/lib/helix/models";
import {
  DISTORTION_MODELS,
  DYNAMICS_MODELS,
  DELAY_MODELS,
  REVERB_MODELS,
  MODULATION_MODELS,
} from "@/lib/helix/models";

// ---------------------------------------------------------------------------
// Internal map entry type
// ---------------------------------------------------------------------------

interface PedalMapEntry {
  /** Full HelixModel object from the models.ts dictionaries. */
  model: HelixModel;
  /**
   * Lowercase category string used as key in POD_GO_EFFECT_SUFFIX.
   * Must be one of: "distortion" | "dynamics" | "delay" | "reverb" | "modulation"
   * Do NOT use BLOCK_TYPES numeric constants here.
   */
  blockType: string;
  /** Why this Helix model is the right substitution for the physical pedal. */
  substitutionReason: string;
  /** Physical knob name -> Helix parameter name mapping (optional). */
  knobMap?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Knob zone translation
// Maps coarse zone labels (PhysicalPedal.knobPositions values) to 0-1 floats.
// Zone centers: low=15%, medium-low=35%, medium-high=65%, high=85%
// ---------------------------------------------------------------------------

const KNOB_ZONE_VALUES: Record<string, number> = {
  "low": 0.15,
  "medium-low": 0.35,
  "medium-high": 0.65,
  "high": 0.85,
};

// ---------------------------------------------------------------------------
// PEDAL_HELIX_MAP — 53 entries across 7 categories
// Keys are normalized: lowercase, trimmed. These match PhysicalPedal.fullName
// after .toLowerCase().trim().
// ---------------------------------------------------------------------------

export const PEDAL_HELIX_MAP: Record<string, PedalMapEntry> = {

  // -------------------------------------------------------------------------
  // OVERDRIVES (14 entries)
  // -------------------------------------------------------------------------
  "ts9 tube screamer": {
    model: DISTORTION_MODELS["Scream 808"],
    blockType: "distortion",
    substitutionReason: "Scream 808 is a direct TS808/TS9 circuit model — same asymmetric soft-clipping and mid-hump EQ character",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "ts808 tube screamer": {
    model: DISTORTION_MODELS["Scream 808"],
    blockType: "distortion",
    substitutionReason: "Scream 808 is based on the Ibanez TS808 — direct circuit model with identical gain structure",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "ibanez ts9": {
    model: DISTORTION_MODELS["Scream 808"],
    blockType: "distortion",
    substitutionReason: "Scream 808 covers both TS9 and TS808 voicings — functionally identical circuit topology",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "ibanez ts808": {
    model: DISTORTION_MODELS["Scream 808"],
    blockType: "distortion",
    substitutionReason: "Direct TS808 circuit model — Scream 808 captures the warm, compressed mid-hump character",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "boss sd-1": {
    model: DISTORTION_MODELS["Stupor OD"],
    blockType: "distortion",
    substitutionReason: "Stupor OD is based on the Boss SD-1 Super Overdrive — identical asymmetric clipping circuit",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "boss sd-1 super overdrive": {
    model: DISTORTION_MODELS["Stupor OD"],
    blockType: "distortion",
    substitutionReason: "Direct Boss SD-1 circuit model — same asymmetric FET clipping and tonal character",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Level": "Level" },
  },
  "klon centaur": {
    model: DISTORTION_MODELS["Minotaur"],
    blockType: "distortion",
    substitutionReason: "Minotaur is a direct Klon Centaur model — same charge-pump circuit, treble-boost, and clean blend",
    knobMap: { "Gain": "Gain", "Treble": "Treble", "Output": "Output" },
  },
  "klone": {
    model: DISTORTION_MODELS["Minotaur"],
    blockType: "distortion",
    substitutionReason: "Klone pedals are Klon Centaur clones — Minotaur captures the original circuit's character",
    knobMap: { "Gain": "Gain", "Treble": "Treble", "Output": "Output" },
  },
  "boss bd-2": {
    model: DISTORTION_MODELS["Teemah!"],
    blockType: "distortion",
    substitutionReason: "Teemah! (Timmy) shares the BD-2's low-gain, touch-sensitive, treble-forward overdrive character",
    knobMap: { "Gain": "Drive", "Tone": "Treble", "Level": "Level" },
  },
  "boss bd-2 blues driver": {
    model: DISTORTION_MODELS["Teemah!"],
    blockType: "distortion",
    substitutionReason: "Blues Driver and Timmy share transparent, amp-like low-gain overdrive character — closest Helix equivalent",
    knobMap: { "Gain": "Drive", "Tone": "Treble", "Level": "Level" },
  },
  "fulltone ocd": {
    model: DISTORTION_MODELS["Compulsive Drive"],
    blockType: "distortion",
    substitutionReason: "Compulsive Drive is based on the Fulltone OCD — same JFET input stage and wide gain range",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Volume": "Volume" },
  },
  "analogman prince of tone": {
    model: DISTORTION_MODELS["Heir Apparent"],
    blockType: "distortion",
    substitutionReason: "Heir Apparent is a direct Prince of Tone model — half of the King of Tone circuit",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Volume": "Volume" },
  },
  "analogman king of tone": {
    model: DISTORTION_MODELS["Tone Sovereign"],
    blockType: "distortion",
    substitutionReason: "Tone Sovereign is based on the Analogman King of Tone — dual-channel TS-derivative with expanded headroom",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Volume": "Volume" },
  },
  "way huge red llama": {
    model: DISTORTION_MODELS["Alpaca Rouge"],
    blockType: "distortion",
    substitutionReason: "Alpaca Rouge is a direct Way Huge Red Llama model — same LM386-based fuzz-overdrive circuit",
    knobMap: { "Drive": "Drive", "Tone": "Tone", "Volume": "Volume" },
  },

  // -------------------------------------------------------------------------
  // DISTORTIONS (8 entries)
  // -------------------------------------------------------------------------
  "pro co rat": {
    model: DISTORTION_MODELS["Vermin Dist"],
    blockType: "distortion",
    substitutionReason: "Vermin Dist is a direct Pro Co RAT model — same LM308 op-amp, filter control, and clipping character",
    knobMap: { "Distortion": "Distortion", "Filter": "Filter", "Volume": "Volume" },
  },
  "proco rat": {
    model: DISTORTION_MODELS["Vermin Dist"],
    blockType: "distortion",
    substitutionReason: "Direct Pro Co RAT circuit model — captures the RAT's aggressive, compressed distortion voicing",
    knobMap: { "Distortion": "Distortion", "Filter": "Filter", "Volume": "Volume" },
  },
  "boss ds-1": {
    model: DISTORTION_MODELS["Deez One Vintage"],
    blockType: "distortion",
    substitutionReason: "Deez One Vintage is a direct Boss DS-1 (vintage) model — same transistor clipping and hard distortion character",
    knobMap: { "Tone": "Tone", "Distortion": "Distortion", "Level": "Level" },
  },
  "boss ds-1 distortion": {
    model: DISTORTION_MODELS["Deez One Vintage"],
    blockType: "distortion",
    substitutionReason: "Direct Boss DS-1 circuit model — vintage transistor distortion with characteristic mid-scoop",
    knobMap: { "Tone": "Tone", "Distortion": "Distortion", "Level": "Level" },
  },
  "mxr distortion+": {
    model: DISTORTION_MODELS["Hedgehog D9"],
    blockType: "distortion",
    substitutionReason: "Hedgehog D9 is a direct MXR Distortion+ model — same op-amp Germanium clipping circuit",
    knobMap: { "Distortion": "Distortion", "Output": "Output" },
  },
  "mxr distortion plus": {
    model: DISTORTION_MODELS["Hedgehog D9"],
    blockType: "distortion",
    substitutionReason: "Direct MXR Distortion+ model — captures the warm, compressed Germanium diode clipping character",
    knobMap: { "Distortion": "Distortion", "Output": "Output" },
  },
  "ehx big muff pi": {
    model: DISTORTION_MODELS["Triangle Fuzz"],
    blockType: "distortion",
    substitutionReason: "Triangle Fuzz models the original EHX Big Muff Triangle circuit — most faithful to classic Big Muff character",
    knobMap: { "Sustain": "Sustain", "Tone": "Tone", "Level": "Level" },
  },
  "electro-harmonix big muff pi": {
    model: DISTORTION_MODELS["Triangle Fuzz"],
    blockType: "distortion",
    substitutionReason: "Triangle Fuzz is a direct Big Muff (Triangle) model — classic two-stage silicon fuzz clipping",
    knobMap: { "Sustain": "Sustain", "Tone": "Tone", "Level": "Level" },
  },

  // -------------------------------------------------------------------------
  // FUZZ (5 entries)
  // -------------------------------------------------------------------------
  "dunlop fuzz face": {
    model: DISTORTION_MODELS["Arbitrator Fuzz"],
    blockType: "distortion",
    substitutionReason: "Arbitrator Fuzz is based on the Arbiter Fuzz Face — same Germanium transistor circuit and voltage sag character",
    knobMap: { "Fuzz": "Fuzz", "Volume": "Volume" },
  },
  "arbiter fuzz face": {
    model: DISTORTION_MODELS["Arbitrator Fuzz"],
    blockType: "distortion",
    substitutionReason: "Direct Arbiter Fuzz Face model — classic two-transistor Germanium fuzz topology",
    knobMap: { "Fuzz": "Fuzz", "Volume": "Volume" },
  },
  "big muff ram's head": {
    model: DISTORTION_MODELS["Rams Head"],
    blockType: "distortion",
    substitutionReason: "Rams Head is a direct EHX Big Muff Ram's Head model — the scooped, searing mid-60s/70s fuzz voicing",
    knobMap: { "Sustain": "Sustain", "Tone": "Tone", "Level": "Level" },
  },
  "ehx op-amp big muff": {
    model: DISTORTION_MODELS["Pillars"],
    blockType: "distortion",
    substitutionReason: "Pillars models the Op-Amp Big Muff — aggressive, transistor-like fuzz with tighter low end than Triangle version",
    knobMap: { "Sustain": "Sustain", "Tone": "Tone", "Level": "Level" },
  },
  "zvex fuzz factory": {
    model: DISTORTION_MODELS["Industrial Fuzz"],
    blockType: "distortion",
    substitutionReason: "Industrial Fuzz is a direct Z.Vex Fuzz Factory model — same chaotic, voltage-starved Germanium fuzz character",
    knobMap: { "Stab": "Stab", "Gate": "Gate", "Comp": "Comp", "Drive": "Drive", "Volume": "Volume" },
  },

  // -------------------------------------------------------------------------
  // BOOST (4 entries)
  // -------------------------------------------------------------------------
  "xotic ep booster": {
    model: DISTORTION_MODELS["Kinky Boost"],
    blockType: "distortion",
    substitutionReason: "Kinky Boost is a direct Xotic EP Booster model — same Echoplex preamp-based treble booster circuit",
  },
  "ep booster": {
    model: DISTORTION_MODELS["Kinky Boost"],
    blockType: "distortion",
    substitutionReason: "EP Booster is the Xotic EP Booster — Kinky Boost captures the Echoplex preamp shimmer and top-end boost",
  },
  "ehx soul food": {
    model: DISTORTION_MODELS["Teemah!"],
    blockType: "distortion",
    substitutionReason: "Soul Food is an EHX Klon-variant; Teemah! (Timmy) is the closest Helix match — clean treble boost with minimal coloration",
    knobMap: { "Drive": "Drive", "Volume": "Level", "Treble": "Treble" },
  },
  "soul food": {
    model: DISTORTION_MODELS["Teemah!"],
    blockType: "distortion",
    substitutionReason: "EHX Soul Food uses Klon-inspired topology; Teemah! matches its transparent low-gain overdrive character",
    knobMap: { "Drive": "Drive", "Volume": "Level", "Treble": "Treble" },
  },

  // -------------------------------------------------------------------------
  // COMPRESSORS (5 entries)
  // -------------------------------------------------------------------------
  "mxr dyna comp": {
    model: DYNAMICS_MODELS["Red Squeeze"],
    blockType: "dynamics",
    substitutionReason: "Red Squeeze is a direct MXR Dyna Comp model — same CA3080 OTA-based gain reduction and attack character",
    knobMap: { "Sensitivity": "Sensitivity", "Level": "Level" },
  },
  "ross compressor": {
    model: DYNAMICS_MODELS["Rochester Comp"],
    blockType: "dynamics",
    substitutionReason: "Rochester Comp captures the Ross Compressor's OTA-based transparency — same CA3080 topology as the Dyna Comp variant",
    knobMap: { "Sensitivity": "Sensitivity", "Level": "Level" },
  },
  "xotic sp compressor": {
    model: DYNAMICS_MODELS["Kinky Comp"],
    blockType: "dynamics",
    substitutionReason: "Kinky Comp is a direct Xotic SP Compressor model — same studio-grade OTA compression with blend control",
    knobMap: { "Sensitivity": "Sensitivity", "Level": "Level" },
  },
  "diamond compressor": {
    model: DYNAMICS_MODELS["Kinky Comp"],
    blockType: "dynamics",
    substitutionReason: "Kinky Comp is the closest match to Diamond's optical-style compression with clean EQ and blend — similar studio transparency",
    knobMap: { "Sensitivity": "Sensitivity", "Level": "Level" },
  },
  "keeley compressor": {
    model: DYNAMICS_MODELS["Red Squeeze"],
    blockType: "dynamics",
    substitutionReason: "Keeley Compressor is a modified Dyna Comp; Red Squeeze captures the same OTA compression character with extended controls",
    knobMap: { "Sensitivity": "Sensitivity", "Level": "Level" },
  },

  // -------------------------------------------------------------------------
  // DELAYS (6 entries)
  // -------------------------------------------------------------------------
  "boss dm-2": {
    model: DELAY_MODELS["Bucket Brigade"],
    blockType: "delay",
    substitutionReason: "Bucket Brigade is a direct Boss DM-2 analog delay model — same BBD chip warmth and self-oscillation character",
    knobMap: { "Repeat Rate": "Time", "Intensity": "Feedback", "Echo Level": "Mix" },
  },
  "boss dm-2 waza": {
    model: DELAY_MODELS["Bucket Brigade"],
    blockType: "delay",
    substitutionReason: "DM-2 Waza Craft uses the same MN3205 BBD chip circuit — Bucket Brigade captures identical warm analog delay character",
    knobMap: { "Repeat Rate": "Time", "Intensity": "Feedback", "Echo Level": "Mix" },
  },
  "ehx deluxe memory man": {
    model: DELAY_MODELS["Elephant Man"],
    blockType: "delay",
    substitutionReason: "Elephant Man is a direct Electro-Harmonix Deluxe Memory Man model — same BBD chip with modulation and warm analog character",
    knobMap: { "Delay": "Time", "Feedback": "Feedback", "Blend": "Mix" },
  },
  "electro-harmonix deluxe memory man": {
    model: DELAY_MODELS["Elephant Man"],
    blockType: "delay",
    substitutionReason: "Direct Deluxe Memory Man circuit model — captures the iconic 3205 BBD warmth and chorus/vibrato modulation",
    knobMap: { "Delay": "Time", "Feedback": "Feedback", "Blend": "Mix" },
  },
  "boss dd-3": {
    model: DELAY_MODELS["Simple Delay"],
    blockType: "delay",
    substitutionReason: "Simple Delay is a clean digital delay that matches the DD-3's transparent, artifact-free digital character",
    knobMap: { "Delay Time": "Time", "Feedback": "Feedback", "Effect Level": "Mix" },
  },
  "boss dd-3 digital delay": {
    model: DELAY_MODELS["Simple Delay"],
    blockType: "delay",
    substitutionReason: "Direct digital delay match — Simple Delay replicates the DD-3's clean, studio-quality digital repeats",
    knobMap: { "Delay Time": "Time", "Feedback": "Feedback", "Effect Level": "Mix" },
  },

  // -------------------------------------------------------------------------
  // REVERBS (4 entries)
  // -------------------------------------------------------------------------
  "tc electronic hall of fame": {
    model: REVERB_MODELS["Hall"],
    blockType: "reverb",
    substitutionReason: "Hall reverb matches the Hall of Fame's most-used TonePrint preset — natural hall decay with wide stereo image",
    knobMap: { "Decay": "DecayTime", "Mix": "Mix" },
  },
  "hall of fame": {
    model: REVERB_MODELS["Hall"],
    blockType: "reverb",
    substitutionReason: "Hall reverb is the natural match for the TC Hall of Fame — same classic, non-colored reverb tail",
    knobMap: { "Decay": "DecayTime", "Mix": "Mix" },
  },
  "strymon big sky": {
    model: REVERB_MODELS["Ganymede"],
    blockType: "reverb",
    substitutionReason: "Ganymede captures the Big Sky's signature lush, ambient reverb character — same large, natural space with smooth decay",
    knobMap: { "Decay": "DecayTime", "Mix": "Mix", "Pre Delay": "PreDelay" },
  },
  "big sky": {
    model: REVERB_MODELS["Ganymede"],
    blockType: "reverb",
    substitutionReason: "Ganymede is the best Helix match for the Big Sky's ambient reverb modes — wide, transparent, and musical",
    knobMap: { "Decay": "DecayTime", "Mix": "Mix", "Pre Delay": "PreDelay" },
  },

  // -------------------------------------------------------------------------
  // MODULATION (7 entries)
  // -------------------------------------------------------------------------
  "mxr phase 90": {
    model: MODULATION_MODELS["Script Mod Phase"],
    blockType: "modulation",
    substitutionReason: "Script Mod Phase is a direct MXR Phase 90 (Script Logo) model — same four-stage phaser with smooth, musical sweep",
    knobMap: { "Speed": "Speed" },
  },
  "ehx small clone": {
    model: MODULATION_MODELS["PlastiChorus"],
    blockType: "modulation",
    substitutionReason: "PlastiChorus is based on the TC Electronic SCF Chorus which shares the Small Clone's warm, analog chorus character",
    knobMap: { "Rate": "Speed", "Depth": "Depth" },
  },
  "electro-harmonix small clone": {
    model: MODULATION_MODELS["PlastiChorus"],
    blockType: "modulation",
    substitutionReason: "Small Clone's bucket-brigade chorus is closely matched by PlastiChorus — same warm, lush modulation character",
    knobMap: { "Rate": "Speed", "Depth": "Depth" },
  },
  "boss ce-2": {
    model: MODULATION_MODELS["70s Chorus"],
    blockType: "modulation",
    substitutionReason: "70s Chorus is based on the Boss CE-1 Chorus Ensemble — the CE-2 uses the same MN3007 BBD chip topology",
    knobMap: { "Rate": "Speed", "Depth": "Depth" },
  },
  "boss ce-2 chorus": {
    model: MODULATION_MODELS["70s Chorus"],
    blockType: "modulation",
    substitutionReason: "Direct CE-2 analog chorus match — 70s Chorus captures the same warm, slow-sweep MN3007 BBD modulation",
    knobMap: { "Rate": "Speed", "Depth": "Depth" },
  },
  "mxr phase 100": {
    model: MODULATION_MODELS["Deluxe Phaser"],
    blockType: "modulation",
    substitutionReason: "Deluxe Phaser is a direct MXR Phase 100 model — same 12-stage phaser with broader, more dramatic sweep than Phase 90",
    knobMap: { "Speed": "Speed" },
  },
  "uni-vibe": {
    model: MODULATION_MODELS["Ubiquitous Vibe"],
    blockType: "modulation",
    substitutionReason: "Ubiquitous Vibe is a direct Shin-ei Uni-Vibe model — same photocell-based phase modulation with rotary speaker illusion",
    knobMap: { "Speed": "Speed", "Intensity": "Intensity" },
  },
};

// ---------------------------------------------------------------------------
// Category detection — used for "close" confidence tier fallbacks
// Returns the category string for keyword-matched pedal names,
// or null if no category keyword matches.
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "overdrive": ["overdrive", "od", "drive", "screamer", "blues", "klon", "klone"],
  "distortion": ["distortion", "dist", "rat", "muff", "big muff"],
  "fuzz": ["fuzz", "face", "octavia", "octave fuzz"],
  "delay": ["delay", "echo", "tape delay", "memory"],
  "reverb": ["reverb", "hall", "room", "spring reverb"],
  "modulation": ["chorus", "flanger", "phaser", "tremolo", "vibe", "vibrato", "uni-vibe", "phase", "small clone"],
  "compressor": ["compressor", "comp", "squeeze", "sustain"],
  "boost": ["boost", "booster", "clean boost"],
};

function detectCategory(normalizedKey: string): string | null {
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      // Use word-boundary matching to avoid "od" matching "module", etc.
      // Build a regex that matches the keyword as a whole word (surrounded by
      // word boundaries or start/end of string).
      const re = new RegExp(`(?:^|\\s|-)${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|-|$)`);
      if (re.test(normalizedKey)) {
        return category;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Category fallback entries — used for "close" confidence tier.
// Each is a PedalMapEntry representing the most neutral/versatile Helix model
// in that category. These are not in PEDAL_HELIX_MAP (they are fallbacks only).
// ---------------------------------------------------------------------------

const CATEGORY_DEFAULTS: Record<string, PedalMapEntry> = {
  "overdrive": {
    model: DISTORTION_MODELS["Teemah!"],
    blockType: "distortion",
    substitutionReason: "Teemah! (Timmy-based) is the most neutral, transparent overdrive in Helix — best general-purpose OD fallback",
  },
  "distortion": {
    model: DISTORTION_MODELS["Vermin Dist"],
    blockType: "distortion",
    substitutionReason: "Vermin Dist (RAT-based) covers the widest gain range of any Helix distortion — best general-purpose distortion fallback",
  },
  "fuzz": {
    model: DISTORTION_MODELS["Triangle Fuzz"],
    blockType: "distortion",
    substitutionReason: "Triangle Fuzz (Big Muff Triangle) is the most neutral fuzz in Helix — classic two-stage silicon fuzz fallback",
  },
  "delay": {
    model: DELAY_MODELS["Simple Delay"],
    blockType: "delay",
    substitutionReason: "Simple Delay has no coloration artifacts — best neutral fallback for any analog or digital delay pedal",
  },
  "reverb": {
    model: REVERB_MODELS["Hall"],
    blockType: "reverb",
    substitutionReason: "Hall reverb is the most generic and versatile reverb type — best fallback for any reverb pedal",
  },
  "modulation": {
    model: MODULATION_MODELS["Script Mod Phase"],
    blockType: "modulation",
    substitutionReason: "Script Mod Phase (Phase 90) is the most subtle modulation in Helix — least intrusive general-purpose fallback",
  },
  "compressor": {
    model: DYNAMICS_MODELS["Red Squeeze"],
    blockType: "dynamics",
    substitutionReason: "Red Squeeze (Dyna Comp) is the industry-standard compressor reference — best general-purpose compressor fallback",
  },
  "boost": {
    model: DISTORTION_MODELS["Kinky Boost"],
    blockType: "distortion",
    substitutionReason: "Kinky Boost (EP Booster) is a clean treble boost — most neutral boost character in Helix",
  },
};

// Fallback when even category is unknown — safest global default
const APPROXIMATE_FALLBACK: PedalMapEntry = CATEGORY_DEFAULTS["overdrive"];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function translateKnobs(
  knobPositions: Record<string, "low" | "medium-low" | "medium-high" | "high">,
  knobMap: Record<string, string>,
): Record<string, number> | undefined {
  const result: Record<string, number> = {};
  let hasAny = false;
  for (const [physicalKnob, zone] of Object.entries(knobPositions)) {
    const helixParam = knobMap[physicalKnob] ?? physicalKnob;
    const value = KNOB_ZONE_VALUES[zone];
    if (value !== undefined) {
      result[helixParam] = value;
      hasAny = true;
    }
  }
  return hasAny ? result : undefined;
}

function buildEntry(
  physicalPedalName: string,
  entry: PedalMapEntry,
  device: DeviceTarget,
  confidence: "direct" | "close" | "approximate",
  knobPositions?: Record<string, "low" | "medium-low" | "medium-high" | "high">,
): SubstitutionEntry {
  const helixModelId = getModelIdForDevice(entry.model, entry.blockType, device);
  const parameterMapping =
    knobPositions && Object.keys(knobPositions).length > 0 && entry.knobMap
      ? translateKnobs(knobPositions, entry.knobMap)
      : undefined;

  return {
    physicalPedal: physicalPedalName,
    helixModel: helixModelId,
    helixModelDisplayName: entry.model.name,
    substitutionReason: entry.substitutionReason,
    confidence,
    ...(parameterMapping !== undefined ? { parameterMapping } : {}),
  };
}

// ---------------------------------------------------------------------------
// lookupPedal — three-tier confidence lookup
//
// Tier 1 (direct):      exact key match in PEDAL_HELIX_MAP + model available for device
// Tier 2 (close):       category detected via keywords, use category default model
// Tier 3 (approximate): category unknown, use APPROXIMATE_FALLBACK (Teemah!)
//
// Pod Go exclusion: Tone Sovereign, Clawthorn Drive, Cosmos Echo are excluded from Pod Go.
// If a direct-match entry's model is excluded, fall through to "close" tier.
// ---------------------------------------------------------------------------

export function lookupPedal(
  pedalName: string,
  device: DeviceTarget,
  knobPositions?: Record<string, "low" | "medium-low" | "medium-high" | "high">,
): SubstitutionEntry {
  const key = pedalName.toLowerCase().trim();
  // Normalize: strip hyphens in lookup for secondary match, keep original key for primary
  const keyNoHyphen = key.replace(/-/g, " ").replace(/\s+/g, " ").trim();

  // Tier 1: direct match — check original key, then hyphen-normalized key
  const directEntry = PEDAL_HELIX_MAP[key] ?? PEDAL_HELIX_MAP[keyNoHyphen];
  if (directEntry && isModelAvailableForDevice(directEntry.model.name, device)) {
    return buildEntry(pedalName, directEntry, device, "direct", knobPositions);
  }

  // Tier 2: category fallback — keyword detection
  const category = detectCategory(key) ?? detectCategory(keyNoHyphen);
  if (category && CATEGORY_DEFAULTS[category]) {
    const fallback = CATEGORY_DEFAULTS[category];
    if (isModelAvailableForDevice(fallback.model.name, device)) {
      return buildEntry(pedalName, fallback, device, "close", knobPositions);
    }
    // Category fallback model is also excluded — fall through to approximate
  }

  // Tier 3: approximate — unknown pedal or all fallbacks excluded
  return buildEntry(pedalName, APPROXIMATE_FALLBACK, device, "approximate", knobPositions);
}

// ---------------------------------------------------------------------------
// mapRigToSubstitutions — convert a full RigIntent to a flat SubstitutionMap
//
// Returns SubstitutionEntry[] — a flat array (SubstitutionMap).
// Never returns an object wrapper like { substitutions: [...] }.
// Primary lookup key: pedal.fullName (per PhysicalPedalSchema comment)
// ---------------------------------------------------------------------------

export function mapRigToSubstitutions(
  rigIntent: RigIntent,
  device: DeviceTarget,
): SubstitutionMap {
  return rigIntent.pedals.map((pedal) =>
    lookupPedal(pedal.fullName, device, pedal.knobPositions)
  );
}

// ---------------------------------------------------------------------------
// parseRigText — convert a plain-text rig description to a synthetic RigIntent
//
// Splits on conjunctions (" and "), commas, and newlines to extract individual
// pedal name fragments. Each fragment becomes a PhysicalPedal with:
//   - fullName = the fragment (primary lookup key for lookupPedal)
//   - confidence = "low" (text descriptions lack visual confirmation)
//   - knobPositions = {} (no zone data from text)
//   - imageIndex = fragment array index (aids debugging)
//
// The resulting RigIntent is passed to mapRigToSubstitutions() which applies
// the same three-tier lookup (direct / close / approximate) as the vision path.
//
// NOTE: "confidence: low" on the input PhysicalPedal does not determine the
// SubstitutionEntry confidence — lookupPedal() assigns its own output confidence
// based on the lookup tier result. The input value only describes the source quality.
// ---------------------------------------------------------------------------

export function parseRigText(text: string): RigIntent {
  // Split on " and " (conjunction), "," (comma list), "\n" (line list)
  const fragments = text
    .split(/\s+and\s+|,|\n/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const pedals = fragments.map((fragment, index) => ({
    brand: "",
    model: fragment,
    fullName: fragment,
    knobPositions: {} as Record<string, "low" | "medium-low" | "medium-high" | "high">,
    imageIndex: index,
    confidence: "low" as const,
  }));

  return { pedals };
}
