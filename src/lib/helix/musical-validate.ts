// src/lib/helix/musical-validate.ts
// Rule-based musical intelligence validation — checks that generated presets
// make musical sense given the genre, instrument, and tone style.
// Deterministic, zero AI cost.
//
// Phase 10, Plan 01: 5 rule categories, non-throwing guarantee.

import type { ToneIntent } from "./tone-intent";
import type { PresetSpec } from "./types";
import { AMP_MODELS, STADIUM_AMPS } from "./models";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MusicalWarning {
  code: string;
  severity: "warn" | "info";
  message: string;
  rule: string;
}

export interface MusicalAudit {
  warnings: MusicalWarning[];
  passed: boolean; // true if no "warn" severity warnings
}

// ---------------------------------------------------------------------------
// Genre categorization
// ---------------------------------------------------------------------------

type GenreCategory = "high-gain" | "blues" | "ambient" | "clean" | "bass";

function categorizeGenre(
  genreHint: string | undefined,
  instrument: string | undefined,
): GenreCategory | null {
  if (instrument === "bass") return "bass";
  if (!genreHint) return null;

  const g = genreHint.toLowerCase();

  if (["metal", "djent", "prog metal", "metalcore", "thrash", "death metal", "hardcore"].includes(g)) {
    return "high-gain";
  }
  if (["blues", "classic rock", "blues rock", "southern rock"].includes(g)) {
    return "blues";
  }
  if (["ambient", "post-rock", "shoegaze", "dream pop", "atmospheric"].includes(g)) {
    return "ambient";
  }
  if (["pop", "country", "funk", "jazz", "r&b", "soul", "indie", "folk"].includes(g)) {
    return "clean";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 1: Genre-effect mismatch
// ---------------------------------------------------------------------------

function checkGenreEffectMismatch(
  genre: GenreCategory | null,
  spec: PresetSpec,
  warnings: MusicalWarning[],
): void {
  if (!genre || !spec.signalChain) return;

  const chain = spec.signalChain;
  const hasChorus = chain.some(
    (b) => b.type === "modulation" && /chorus/i.test(b.modelName),
  );
  const hasFlanger = chain.some(
    (b) => b.type === "modulation" && /flanger/i.test(b.modelName),
  );
  const hasDelay = chain.some((b) => b.type === "delay");
  const hasReverb = chain.some((b) => b.type === "reverb");

  if (genre === "high-gain") {
    if (hasChorus) {
      warnings.push({
        code: "GENRE_EFFECT_MISMATCH",
        severity: "warn",
        message: "Chorus is unusual for metal/high-gain — may muddy distorted tones",
        rule: "genre-effect",
      });
    }
    if (hasFlanger) {
      warnings.push({
        code: "GENRE_EFFECT_MISMATCH",
        severity: "info",
        message: "Flanger on high-gain can work but is atypical — verify intent",
        rule: "genre-effect",
      });
    }
  }

  if (genre === "ambient") {
    if (!hasDelay && !hasReverb) {
      warnings.push({
        code: "GENRE_EFFECT_MISMATCH",
        severity: "warn",
        message: "Ambient preset has no delay or reverb — time-based effects are essential for ambient tones",
        rule: "genre-effect",
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rule 2: Bass requires compression
// ---------------------------------------------------------------------------

function checkBassCompression(
  genre: GenreCategory | null,
  spec: PresetSpec,
  warnings: MusicalWarning[],
): void {
  if (genre !== "bass") return;
  if (!spec.signalChain) return;

  const hasDynamics = spec.signalChain.some((b) => b.type === "dynamics");
  if (!hasDynamics) {
    warnings.push({
      code: "BASS_NO_COMPRESSION",
      severity: "warn",
      message: "Bass preset missing compression — compression is non-negotiable for bass tone consistency",
      rule: "bass-compression",
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 3: Gain staging mismatch
// ---------------------------------------------------------------------------

function checkGainStaging(
  genre: GenreCategory | null,
  spec: PresetSpec,
  warnings: MusicalWarning[],
): void {
  if (!spec.signalChain) return;

  const ampBlock = spec.signalChain.find((b) => b.type === "amp");
  if (!ampBlock) return;

  const drive = ampBlock.parameters?.Drive;
  if (typeof drive !== "number") return;

  if (genre === "clean" && drive > 0.50) {
    // Non-master-volume amps (Master: 1.0 in paramOverrides) use Drive as volume control,
    // not gain/distortion. Also skip for Stadium amps which have different Drive semantics.
    const model = AMP_MODELS[ampBlock.modelName];
    const stadiumModel = STADIUM_AMPS[ampBlock.modelName];
    const isNonMV = model?.paramOverrides?.Master === 1.0;
    const isStadium = !!stadiumModel;
    const threshold = (isNonMV || isStadium) ? 0.80 : 0.50;

    if (drive > threshold) {
      warnings.push({
        code: "GAIN_STAGING_MISMATCH",
        severity: "warn",
        message: `Clean tone has amp Drive ${drive.toFixed(2)} — too much drive for a clean sound (threshold: ${threshold.toFixed(2)})`,
        rule: "gain-staging",
      });
    }
  }

  if (genre === "high-gain" && drive < 0.30) {
    warnings.push({
      code: "GAIN_STAGING_MISMATCH",
      severity: "info",
      message: `High-gain tone has amp Drive ${drive.toFixed(2)} — unusually low for heavy tones`,
      rule: "gain-staging",
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 4: Snapshot role coverage
// ---------------------------------------------------------------------------

function checkSnapshotRoleCoverage(
  genre: GenreCategory | null,
  intent: ToneIntent,
  warnings: MusicalWarning[],
): void {
  if (!genre || !intent.snapshots || intent.snapshots.length === 0) return;

  const roles = new Set(intent.snapshots.map((s) => s.toneRole));

  if (genre === "high-gain" && !roles.has("lead")) {
    warnings.push({
      code: "SNAPSHOT_ROLE_MISSING",
      severity: "warn",
      message: "High-gain preset has no lead snapshot — metal/high-gain benefits from a dedicated lead tone",
      rule: "snapshot-coverage",
    });
  }

  if (genre === "ambient" && !roles.has("ambient")) {
    warnings.push({
      code: "SNAPSHOT_ROLE_MISSING",
      severity: "warn",
      message: "Ambient preset has no ambient snapshot — should have a dedicated ambient snapshot",
      rule: "snapshot-coverage",
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 5: Effect count sanity
// ---------------------------------------------------------------------------

function checkEffectCountSanity(
  intent: ToneIntent,
  warnings: MusicalWarning[],
): void {
  const effects = intent.effects ?? [];
  if (effects.length === 0) {
    warnings.push({
      code: "NO_EFFECTS_REQUESTED",
      severity: "info",
      message: "No effects requested — preset will have amp and cab only",
      rule: "effect-count",
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate musical intelligence — checks that the preset makes musical sense
 * given the genre, instrument, and tone style.
 *
 * NON-THROWING GUARANTEE: Always returns a MusicalAudit.
 * An empty warnings array with passed=true means no issues detected.
 */
export function validateMusicalIntelligence(
  intent: ToneIntent,
  spec: PresetSpec,
): MusicalAudit {
  const warnings: MusicalWarning[] = [];

  try {
    const genre = categorizeGenre(intent.genreHint, intent.instrument);

    checkGenreEffectMismatch(genre, spec, warnings);
    checkBassCompression(genre, spec, warnings);
    checkGainStaging(genre, spec, warnings);
    checkSnapshotRoleCoverage(genre, intent, warnings);
    checkEffectCountSanity(intent, warnings);
  } catch {
    // Non-throwing guarantee
  }

  const passed = !warnings.some((w) => w.severity === "warn");
  return { warnings, passed };
}
