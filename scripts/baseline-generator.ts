// scripts/baseline-generator.ts
// 36-preset deterministic quality baseline generator (6 devices x 6 genres).
// Runs the Knowledge Layer pipeline with fixed ToneIntent fixtures and collects
// quality validation warnings for each combination.
// NO AI, NO API calls -- fully deterministic.
//
// Usage:
//   npx tsx scripts/baseline-generator.ts                    # outputs baseline.json
//   npx tsx scripts/baseline-generator.ts output-path.json   # custom output path
//
// Phase 74, Plan 02 (QUAL-03).

import * as fs from "fs";
import * as path from "path";
import { getToneIntentSchema } from "../src/lib/helix/tone-intent";
import type { ToneIntent, SnapshotIntent } from "../src/lib/helix/tone-intent";
import type { DeviceTarget, PresetSpec } from "../src/lib/helix/types";
import { getCapabilities } from "../src/lib/helix/device-family";
import type { DeviceCapabilities } from "../src/lib/helix/device-family";
import { assembleSignalChain } from "../src/lib/helix/chain-rules";
import { resolveParameters } from "../src/lib/helix/param-engine";
import { buildSnapshots } from "../src/lib/helix/snapshot-engine";
import { validatePresetQuality } from "../src/lib/helix/quality-validate";
import type { QualityWarning } from "../src/lib/helix/quality-validate";

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

interface BaselineResult {
  device: string;
  genre: string;
  warningCount: number;
  warningCodes: string[];
  warnings: QualityWarning[];
}

interface BaselineSummary {
  byDevice: Record<string, { presets: number; warnings: number }>;
  byGenre: Record<string, { presets: number; warnings: number }>;
  byCode: Record<string, number>;
}

interface BaselineOutput {
  generatedAt: string;
  totalPresets: number;
  totalWarnings: number;
  results: BaselineResult[];
  summary: BaselineSummary;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "helix_stomp",
  "helix_stomp_xl",
  "pod_go",
  "helix_stadium",
];

type Genre = "blues" | "rock" | "metal" | "jazz" | "ambient" | "country";
const ALL_GENRES: Genre[] = ["blues", "rock", "metal", "jazz", "ambient", "country"];

const SNAPSHOTS_4: SnapshotIntent[] = [
  { name: "CLEAN", toneRole: "clean" },
  { name: "CRUNCH", toneRole: "crunch" },
  { name: "LEAD", toneRole: "lead" },
  { name: "AMBIENT", toneRole: "ambient" },
];

const SNAPSHOTS_3: SnapshotIntent[] = [
  { name: "CLEAN", toneRole: "clean" },
  { name: "CRUNCH", toneRole: "crunch" },
  { name: "LEAD", toneRole: "lead" },
];

// Cached schemas
const HelixSchema = getToneIntentSchema("helix");
const StadiumSchema = getToneIntentSchema("stadium");

// ---------------------------------------------------------------------------
// Genre intent builders -- standard (HD2) amps
// ---------------------------------------------------------------------------

const STANDARD_GENRE_INTENTS: Record<Genre, ToneIntent> = {
  blues: HelixSchema.parse({
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "blues",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 110,
    presetName: "baseline-blues",
    description: "Blues tone with US Deluxe and light overdrive",
  }),

  rock: HelixSchema.parse({
    ampName: "Brit Plexi Nrm",
    cabName: "4x12 Greenback25",
    guitarType: "humbucker",
    genreHint: "rock",
    effects: [
      { modelName: "Scream 808", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 130,
    presetName: "baseline-rock",
    description: "Rock tone with Brit Plexi Marshall crunch",
  }),

  metal: HelixSchema.parse({
    ampName: "Revv Gen Red",
    cabName: "4x12 Uber V30",
    guitarType: "humbucker",
    genreHint: "metal",
    effects: [
      { modelName: "Kinky Boost", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Searchlights", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 160,
    presetName: "baseline-metal",
    description: "High-gain metal with Revv Gen Red",
  }),

  jazz: HelixSchema.parse({
    ampName: "US Double Nrm",
    cabName: "2x12 Blue Bell",
    guitarType: "single_coil",
    genreHint: "jazz",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 100,
    presetName: "baseline-jazz",
    description: "Jazz tone with US Double Nrm clean warmth",
  }),

  ambient: HelixSchema.parse({
    ampName: "Matchstick Ch1",
    cabName: "1x12 US Deluxe",
    guitarType: "humbucker",
    genreHint: "ambient",
    effects: [
      { modelName: "Adriatic Delay", role: "ambient" },
      { modelName: "Searchlights", role: "ambient" },
      { modelName: "Glitz", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 80,
    presetName: "baseline-ambient",
    description: "Ambient wash with stacked delay and reverb",
  }),

  country: HelixSchema.parse({
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "country",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "baseline-country",
    description: "Country tone with US Deluxe clean and spring reverb",
  }),
};

// ---------------------------------------------------------------------------
// Genre intent builders -- Stadium (Agoura) amps
// ---------------------------------------------------------------------------

const STADIUM_GENRE_INTENTS: Record<Genre, ToneIntent> = {
  blues: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "blues",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 110,
    presetName: "baseline-blues",
    description: "Stadium blues with Agoura US Clean",
  }),

  rock: StadiumSchema.parse({
    ampName: "Agoura German Crunch",
    cabName: "4x12 Greenback25",
    guitarType: "humbucker",
    genreHint: "rock",
    effects: [
      { modelName: "Scream 808", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Glitz", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 130,
    presetName: "baseline-rock",
    description: "Stadium rock with Agoura German Crunch",
  }),

  metal: StadiumSchema.parse({
    ampName: "Agoura German Xtra Red",
    cabName: "4x12 Uber V30",
    guitarType: "humbucker",
    genreHint: "metal",
    effects: [
      { modelName: "Kinky Boost", role: "always_on" },
      { modelName: "Elephant Man", role: "toggleable" },
      { modelName: "Searchlights", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 160,
    presetName: "baseline-metal",
    description: "Stadium high-gain metal with Agoura German Xtra Red",
  }),

  jazz: StadiumSchema.parse({
    ampName: "Agoura Brit Plexi",
    cabName: "2x12 Blue Bell",
    guitarType: "single_coil",
    genreHint: "jazz",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 100,
    presetName: "baseline-jazz",
    description: "Stadium jazz with Agoura Brit Plexi warm cleans",
  }),

  ambient: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "humbucker",
    genreHint: "ambient",
    effects: [
      { modelName: "Adriatic Delay", role: "ambient" },
      { modelName: "Searchlights", role: "ambient" },
      { modelName: "Glitz", role: "ambient" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 80,
    presetName: "baseline-ambient",
    description: "Stadium ambient wash with Agoura US Clean",
  }),

  country: StadiumSchema.parse({
    ampName: "Agoura US Clean",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "country",
    effects: [
      { modelName: "Minotaur", role: "always_on" },
      { modelName: "Adriatic Delay", role: "toggleable" },
      { modelName: "'63 Spring", role: "always_on" },
    ],
    snapshots: SNAPSHOTS_4,
    tempoHint: 120,
    presetName: "baseline-country",
    description: "Stadium country with Agoura US Clean",
  }),
};

// ---------------------------------------------------------------------------
// Intent selection helper
// ---------------------------------------------------------------------------

/**
 * Build the correct ToneIntent for a genre + device combination.
 * Stadium devices use Agoura amp names; all others use HD2 amp names.
 * Devices with limited snapshot counts get truncated snapshots.
 */
function buildGenreIntent(genre: Genre, caps: DeviceCapabilities): ToneIntent {
  const isStadium = caps.ampCatalogEra === "agoura";
  const base = isStadium ? STADIUM_GENRE_INTENTS[genre] : STANDARD_GENRE_INTENTS[genre];

  // Truncate snapshots for devices with lower limits
  if (base.snapshots.length > caps.maxSnapshots) {
    const truncated = {
      ...base,
      snapshots: base.snapshots.slice(0, Math.max(3, caps.maxSnapshots)),
    };
    const schema = isStadium ? StadiumSchema : HelixSchema;
    return schema.parse(truncated);
  }

  return base;
}

// ---------------------------------------------------------------------------
// Pipeline: intent -> preset spec -> quality warnings
// ---------------------------------------------------------------------------

function generateForCombo(
  device: DeviceTarget,
  genre: Genre,
  caps: DeviceCapabilities,
): BaselineResult {
  const intent = buildGenreIntent(genre, caps);
  const chain = assembleSignalChain(intent, caps);
  const parameterized = resolveParameters(chain, intent, caps);
  const snapshots = buildSnapshots(parameterized, intent.snapshots, intent.genreHint);

  const spec: PresetSpec = {
    name: intent.presetName || `baseline-${genre}`,
    description: intent.description || `Baseline ${genre} preset`,
    tempo: intent.tempoHint ?? 120,
    guitarNotes: intent.guitarNotes,
    signalChain: parameterized,
    snapshots,
  };

  const warnings = validatePresetQuality(spec, caps);

  return {
    device,
    genre,
    warningCount: warnings.length,
    warningCodes: warnings.map((w) => w.code),
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Summary builder
// ---------------------------------------------------------------------------

function buildSummary(results: BaselineResult[]): BaselineSummary {
  const byDevice: Record<string, { presets: number; warnings: number }> = {};
  const byGenre: Record<string, { presets: number; warnings: number }> = {};
  const byCode: Record<string, number> = {};

  for (const r of results) {
    // By device
    if (!byDevice[r.device]) byDevice[r.device] = { presets: 0, warnings: 0 };
    byDevice[r.device].presets++;
    byDevice[r.device].warnings += r.warningCount;

    // By genre
    if (!byGenre[r.genre]) byGenre[r.genre] = { presets: 0, warnings: 0 };
    byGenre[r.genre].presets++;
    byGenre[r.genre].warnings += r.warningCount;

    // By warning code
    for (const code of r.warningCodes) {
      byCode[code] = (byCode[code] || 0) + 1;
    }
  }

  return { byDevice, byGenre, byCode };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate baseline quality data for all 36 device x genre combinations.
 * Returns the BaselineOutput object (also writes to file when outputPath given).
 */
export function generateQualityBaseline(outputPath?: string): BaselineOutput {
  const results: BaselineResult[] = [];
  const errors: string[] = [];

  for (const device of ALL_DEVICES) {
    const caps = getCapabilities(device);

    for (const genre of ALL_GENRES) {
      try {
        const result = generateForCombo(device, genre, caps);
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[baseline] FAILED ${device}/${genre}: ${msg}`);
        errors.push(`${device}/${genre}: ${msg}`);
      }
    }
  }

  const output: BaselineOutput = {
    generatedAt: new Date().toISOString(),
    totalPresets: results.length,
    totalWarnings: results.reduce((sum, r) => sum + r.warningCount, 0),
    results,
    summary: buildSummary(results),
  };

  if (outputPath) {
    const resolvedPath = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    fs.writeFileSync(resolvedPath, JSON.stringify(output, null, 2), "utf-8");
  }

  return output;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1]?.includes("baseline-generator")) {
  const outputPath = process.argv[2] || path.resolve(__dirname, "baseline.json");
  console.log("Generating 36-preset quality baseline...\n");

  const output = generateQualityBaseline(outputPath);

  // Print summary table
  console.log("=== Per-Device Summary ===");
  console.log("Device".padEnd(20) + "Presets".padEnd(10) + "Warnings");
  console.log("-".repeat(40));
  for (const [device, stats] of Object.entries(output.summary.byDevice)) {
    console.log(device.padEnd(20) + String(stats.presets).padEnd(10) + String(stats.warnings));
  }

  console.log("\n=== Per-Genre Summary ===");
  console.log("Genre".padEnd(20) + "Presets".padEnd(10) + "Warnings");
  console.log("-".repeat(40));
  for (const [genre, stats] of Object.entries(output.summary.byGenre)) {
    console.log(genre.padEnd(20) + String(stats.presets).padEnd(10) + String(stats.warnings));
  }

  if (Object.keys(output.summary.byCode).length > 0) {
    console.log("\n=== Warning Code Distribution ===");
    for (const [code, count] of Object.entries(output.summary.byCode)) {
      console.log(`  ${code}: ${count}`);
    }
  }

  console.log(`\nTotal: ${output.totalPresets} presets, ${output.totalWarnings} warnings`);
  console.log(`Output: ${path.resolve(outputPath)}`);
}
