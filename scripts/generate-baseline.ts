// scripts/generate-baseline.ts
// 36-preset deterministic baseline generator.
// Drives the Knowledge Layer pipeline (assembleSignalChain -> resolveParameters ->
// buildSnapshots -> validatePresetSpec) with hardcoded ToneIntent fixtures.
// NO AI, NO API calls — fully deterministic.
//
// Usage:
//   npx tsx scripts/generate-baseline.ts          # outputs to scripts/baseline/
//   import { generateBaseline } from "./generate-baseline"  # programmatic

import * as fs from "fs";
import * as path from "path";
import { getToneIntentSchema } from "@/lib/helix/tone-intent";
import type { ToneIntent, SnapshotIntent } from "@/lib/helix/tone-intent";
import type { DeviceTarget, PresetSpec } from "@/lib/helix/types";
import { resolveFamily, getCapabilities } from "@/lib/helix/device-family";
import { assembleSignalChain } from "@/lib/helix/chain-rules";
import { resolveParameters } from "@/lib/helix/param-engine";
import { buildSnapshots } from "@/lib/helix/snapshot-engine";
import { validatePresetSpec } from "@/lib/helix/validate";

// ---------------------------------------------------------------------------
// Snapshot intent presets
// ---------------------------------------------------------------------------

const SNAPSHOTS_4: SnapshotIntent[] = [
  { name: "CLEAN", toneRole: "clean" },
  { name: "RHYTHM", toneRole: "crunch" },
  { name: "LEAD", toneRole: "lead" },
  { name: "AMBIENT", toneRole: "ambient" },
];

const SNAPSHOTS_3: SnapshotIntent[] = [
  { name: "CLEAN", toneRole: "clean" },
  { name: "RHYTHM", toneRole: "crunch" },
  { name: "LEAD", toneRole: "lead" },
];

// ---------------------------------------------------------------------------
// Cached per-family schemas (avoids rebuilding on every parse call)
// ---------------------------------------------------------------------------

const HelixSchema = getToneIntentSchema("helix");
const StadiumSchema = getToneIntentSchema("stadium");

// ---------------------------------------------------------------------------
// Standard (non-Stadium) tone scenario fixtures
// ---------------------------------------------------------------------------

type ToneScenarioKey = "clean" | "crunch" | "high_gain" | "ambient" | "edge_of_breakup" | "dual_amp";

const STANDARD_FIXTURES: Record<ToneScenarioKey, ToneIntent> = {
  clean: HelixSchema.parse({
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "edge-of-breakup blues",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "Clean Blues",
    description: "Clean blues tone with edge-of-breakup character",
  }),

  crunch: HelixSchema.parse({
    ampName: "Placater Clean",
    cabName: "4x12 Greenback25",
    guitarType: "humbucker",
    genreHint: "classic rock rhythm",
    effects: [
      { modelName: "Scream 808", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 130,
    presetName: "Rock Crunch",
    description: "Classic rock rhythm crunch with Placater",
  }),

  high_gain: HelixSchema.parse({
    ampName: "Revv Gen Red",
    cabName: "4x12 Uber V30",
    guitarType: "humbucker",
    genreHint: "modern metal",
    effects: [
      { modelName: "Kinky Boost", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Searchlights", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 160,
    presetName: "Metal Revv",
    description: "Modern metal high-gain with Revv Gen Red",
  }),

  ambient: HelixSchema.parse({
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "ambient pad",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "ambient" },
      { modelName: "Searchlights", role: "ambient" },
      { modelName: "Glitz", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 90,
    presetName: "Ambient Pad",
    description: "Ambient wash with stacked delay and reverb",
  }),

  edge_of_breakup: HelixSchema.parse({
    ampName: "Placater Clean",
    cabName: "2x12 Blue Bell",
    guitarType: "single_coil",
    genreHint: "edge-of-breakup jazz",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 100,
    presetName: "Jazz Breakup",
    description: "Edge-of-breakup jazz with warm spring reverb",
  }),

  dual_amp: HelixSchema.parse({
    ampName: "US Deluxe Nrm",
    secondAmpName: "Placater Clean",
    cabName: "1x12 US Deluxe",
    secondCabName: "4x12 Greenback25",
    guitarType: "humbucker",
    genreHint: "dual-amp rock",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "Dual Amp Rock",
    description: "Dual-amp rock with US Deluxe and Placater",
  }),
};

// ---------------------------------------------------------------------------
// Stadium-specific tone scenario fixtures (Agoura_* amp names)
// ---------------------------------------------------------------------------

const STADIUM_FIXTURES: Record<ToneScenarioKey, ToneIntent> = {
  clean: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "edge-of-breakup blues",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "Stadium Clean",
    description: "Stadium clean tone with Agoura US Clean",
  }),

  crunch: StadiumSchema.parse({
    ampName: "Agoura German Crunch",
    cabName: "4x12 Greenback25",
    guitarType: "humbucker",
    genreHint: "classic rock rhythm",
    effects: [
      { modelName: "Scream 808", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 130,
    presetName: "Stadium Crunch",
    description: "Stadium crunch with Agoura German Crunch",
  }),

  high_gain: StadiumSchema.parse({
    ampName: "Agoura German Xtra Red",
    cabName: "4x12 Uber V30",
    guitarType: "humbucker",
    genreHint: "modern metal",
    effects: [
      { modelName: "Kinky Boost", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Searchlights", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 160,
    presetName: "Stadium Metal",
    description: "Stadium high-gain with Agoura German Xtra Red",
  }),

  ambient: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "ambient pad",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "ambient" },
      { modelName: "Searchlights", role: "ambient" },
      { modelName: "Glitz", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 90,
    presetName: "Stadium Ambient",
    description: "Stadium ambient wash with Agoura US Clean",
  }),

  edge_of_breakup: StadiumSchema.parse({
    ampName: "Agoura Brit Plexi",
    cabName: "2x12 Blue Bell",
    guitarType: "single_coil",
    genreHint: "edge-of-breakup jazz",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 100,
    presetName: "Stadium Jazz",
    description: "Stadium edge-of-breakup with Agoura Brit Plexi",
  }),

  // Stadium does NOT support dual-amp; use single-amp variant
  dual_amp: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "humbucker",
    genreHint: "dual-amp rock",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "Stadium Dual Sub",
    description: "Stadium single-amp substitute for dual-amp scenario",
  }),
};

// ---------------------------------------------------------------------------
// Single-amp fallback for dual_amp on single-DSP devices
// (pod_go, helix_stomp, helix_stomp_xl cannot do secondAmpName)
// ---------------------------------------------------------------------------

const SINGLE_DSP_DUAL_AMP_FALLBACK: ToneIntent = HelixSchema.parse({
  ampName: "Placater Clean",
  cabName: "4x12 Greenback25",
  guitarType: "humbucker",
  genreHint: "classic rock rhythm",
  effects: [
    { modelName: "Scream 808", role: "always_on" },
    { modelName: "Elephant Man", role: "toggleable" },
    { modelName: "'63 Spring", role: "always_on" },
  ],
  snapshots: SNAPSHOTS_4,
  tempoHint: 130,
  presetName: "Crunch Fallback",
  description: "Single-amp crunch fallback for dual-amp scenario",
});

// ---------------------------------------------------------------------------
// Devices and their constraints
// ---------------------------------------------------------------------------

const ALL_DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "pod_go",
  "helix_stadium",
  "helix_stomp",
  "helix_stomp_xl",
];

const SINGLE_DSP_DEVICES = new Set<DeviceTarget>(["pod_go", "helix_stomp", "helix_stomp_xl"]);

// Devices that need reduced snapshots
const MAX_SNAPSHOTS: Partial<Record<DeviceTarget, number>> = {
  helix_stomp: 3,
  helix_stomp_xl: 4,
  pod_go: 4,
};

// ---------------------------------------------------------------------------
// Intent adaptation for device constraints
// ---------------------------------------------------------------------------

function adaptIntentForDevice(
  baseIntent: ToneIntent,
  device: DeviceTarget,
): ToneIntent {
  const maxSnaps = MAX_SNAPSHOTS[device];
  if (maxSnaps && baseIntent.snapshots.length > maxSnaps) {
    // Truncate snapshots to device limit
    const adapted = { ...baseIntent, snapshots: baseIntent.snapshots.slice(0, maxSnaps) };
    // Re-validate after modification using the correct family schema
    const family = resolveFamily(device);
    return getToneIntentSchema(family).parse(adapted);
  }
  return baseIntent;
}

// ---------------------------------------------------------------------------
// Get the intent for a given tone+device combination
// ---------------------------------------------------------------------------

function getIntent(tone: ToneScenarioKey, device: DeviceTarget): ToneIntent {
  // Stadium uses Agoura_* amps
  if (device === "helix_stadium") {
    return adaptIntentForDevice(STADIUM_FIXTURES[tone], device);
  }

  // Single-DSP devices: replace dual_amp with single-amp fallback
  if (tone === "dual_amp" && SINGLE_DSP_DEVICES.has(device)) {
    return adaptIntentForDevice(SINGLE_DSP_DUAL_AMP_FALLBACK, device);
  }

  return adaptIntentForDevice(STANDARD_FIXTURES[tone], device);
}

// ---------------------------------------------------------------------------
// Pipeline: ToneIntent -> PresetSpec (no AI)
// ---------------------------------------------------------------------------

function buildPreset(intent: ToneIntent, device: DeviceTarget): PresetSpec {
  const caps = getCapabilities(device);
  const chain = assembleSignalChain(intent, caps);
  const parameterized = resolveParameters(chain, intent, caps);
  const snapshots = buildSnapshots(parameterized, intent.snapshots);

  const presetSpec: PresetSpec = {
    name: intent.presetName || `${intent.ampName} Baseline`,
    description: intent.description || `Baseline: ${intent.genreHint}`,
    tempo: intent.tempoHint ?? 120,
    guitarNotes: intent.guitarNotes,
    signalChain: parameterized,
    snapshots,
  };

  validatePresetSpec(presetSpec, caps);

  return presetSpec;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate all 36 baseline presets (6 tones x 6 devices) and write them as JSON files.
 *
 * @param outputDir - Directory to write JSON files to (created if it doesn't exist).
 */
export function generateBaseline(outputDir: string): void {
  fs.mkdirSync(outputDir, { recursive: true });

  const tones: ToneScenarioKey[] = [
    "clean",
    "crunch",
    "high_gain",
    "ambient",
    "edge_of_breakup",
    "dual_amp",
  ];

  for (const device of ALL_DEVICES) {
    for (const tone of tones) {
      const intent = getIntent(tone, device);
      const presetSpec = buildPreset(intent, device);

      const result = {
        scenario: `${tone}_${device}`,
        toneIntent: intent,
        presetSpec,
        generatedAt: new Date().toISOString(),
      };

      const filePath = path.join(outputDir, `${tone}-${device}.json`);
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2), "utf-8");
    }
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1]?.includes("generate-baseline")) {
  const outDir = path.resolve(__dirname, "baseline");
  console.log(`Generating 36 baseline presets to ${outDir}...`);
  generateBaseline(outDir);
  console.log("Done. 36 baseline presets generated.");
}
