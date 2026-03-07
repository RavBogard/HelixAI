// src/lib/helix/quality-validate.ts
// Non-throwing advisory validation — returns QualityWarning[] for suboptimal
// parameter choices. Never throws. Always returns an array.
//
// Phase 74, Plan 01 (QUAL-01): 7 per-block checks + 4 structural checks.

import type { PresetSpec, BlockSpec } from "./types";
import type { DeviceCapabilities } from "./device-family";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QualityWarning {
  code: string;
  severity: "warn" | "info";
  message: string;
  blockRef?: string;
  actual?: number;
  threshold?: number;
}

// ---------------------------------------------------------------------------
// Thresholds (derived from param-engine.ts expert consensus tables)
// ---------------------------------------------------------------------------

const REVERB_MIX_WARN = 0.60;
const DELAY_FEEDBACK_WARN = 0.70;
const DELAY_MIX_WARN = 0.55;
const CAB_LOWCUT_MIN = 30.0;
const CAB_HIGHCUT_MAX = 18000.0;
const DRIVE_EXTREME = 0.90;
const AMP_DRIVE_EXTREME = 0.85;
const SNAPSHOT_CHVOL_MAX_SPREAD = 0.25;

// ---------------------------------------------------------------------------
// Per-block checks (7 checks)
// ---------------------------------------------------------------------------

function checkReverbMix(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "reverb") return;
  const mix = block.parameters?.Mix;
  if (typeof mix === "number" && mix > REVERB_MIX_WARN) {
    warnings.push({
      code: "REVERB_MIX_HIGH",
      severity: "warn",
      message: `Reverb Mix ${mix.toFixed(2)} exceeds ${REVERB_MIX_WARN} — may wash out dry signal`,
      blockRef: block.modelName,
      actual: mix,
      threshold: REVERB_MIX_WARN,
    });
  }
}

function checkDelayFeedback(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "delay") return;
  const fb = block.parameters?.Feedback;
  if (typeof fb === "number" && fb > DELAY_FEEDBACK_WARN) {
    warnings.push({
      code: "DELAY_FEEDBACK_HIGH",
      severity: "warn",
      message: `Delay Feedback ${fb.toFixed(2)} exceeds ${DELAY_FEEDBACK_WARN} — risk of runaway oscillation`,
      blockRef: block.modelName,
      actual: fb,
      threshold: DELAY_FEEDBACK_WARN,
    });
  }
}

function checkDelayMix(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "delay") return;
  const mix = block.parameters?.Mix;
  if (typeof mix === "number" && mix > DELAY_MIX_WARN) {
    warnings.push({
      code: "DELAY_MIX_HIGH",
      severity: "warn",
      message: `Delay Mix ${mix.toFixed(2)} exceeds ${DELAY_MIX_WARN} — wet signal may overpower dry`,
      blockRef: block.modelName,
      actual: mix,
      threshold: DELAY_MIX_WARN,
    });
  }
}

function checkCabFiltering(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "cab") return;
  const lowCut = block.parameters?.LowCut;
  const highCut = block.parameters?.HighCut;

  if (typeof lowCut === "number" && lowCut < CAB_LOWCUT_MIN) {
    warnings.push({
      code: "CAB_NO_LOWCUT",
      severity: "warn",
      message: `Cab LowCut ${lowCut.toFixed(1)} Hz below ${CAB_LOWCUT_MIN} Hz — effectively no low-frequency filtering`,
      blockRef: block.modelName,
      actual: lowCut,
      threshold: CAB_LOWCUT_MIN,
    });
  }

  if (typeof highCut === "number" && highCut > CAB_HIGHCUT_MAX) {
    warnings.push({
      code: "CAB_NO_HIGHCUT",
      severity: "warn",
      message: `Cab HighCut ${highCut.toFixed(1)} Hz above ${CAB_HIGHCUT_MAX} Hz — effectively no high-frequency filtering`,
      blockRef: block.modelName,
      actual: highCut,
      threshold: CAB_HIGHCUT_MAX,
    });
  }
}

function checkDriveLevel(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "distortion") return;
  const drive = block.parameters?.Drive;
  if (typeof drive === "number" && drive > DRIVE_EXTREME) {
    warnings.push({
      code: "DRIVE_EXTREME",
      severity: "warn",
      message: `Distortion Drive ${drive.toFixed(2)} exceeds ${DRIVE_EXTREME} — extreme saturation rarely sounds musical`,
      blockRef: block.modelName,
      actual: drive,
      threshold: DRIVE_EXTREME,
    });
  }
}

function checkAmpDrive(
  block: BlockSpec,
  caps: DeviceCapabilities,
  warnings: QualityWarning[],
): void {
  if (block.type !== "amp") return;
  // Skip for Stadium amps — firmware params use different encoding
  if (caps.ampCatalogEra === "agoura") return;

  const drive = block.parameters?.Drive;
  if (typeof drive === "number" && drive > AMP_DRIVE_EXTREME) {
    warnings.push({
      code: "AMP_DRIVE_EXTREME",
      severity: "warn",
      message: `Amp Drive ${drive.toFixed(2)} exceeds ${AMP_DRIVE_EXTREME} — high-gain amps rarely need Drive above 0.40`,
      blockRef: block.modelName,
      actual: drive,
      threshold: AMP_DRIVE_EXTREME,
    });
  }
}

// ---------------------------------------------------------------------------
// Preset-level structural checks (4 checks)
// ---------------------------------------------------------------------------

function checkSnapshotLevelBalance(
  spec: PresetSpec,
  warnings: QualityWarning[],
): void {
  if (!spec.snapshots || spec.snapshots.length === 0) return;

  // Collect all ChVol values from snapshot parameterOverrides
  const chVolValues: number[] = [];
  for (const snap of spec.snapshots) {
    if (!snap.parameterOverrides) continue;
    for (const blockOverrides of Object.values(snap.parameterOverrides)) {
      const chVol = blockOverrides?.ChVol;
      if (typeof chVol === "number") {
        chVolValues.push(chVol);
      }
    }
  }

  if (chVolValues.length < 2) return;

  const spread = Math.max(...chVolValues) - Math.min(...chVolValues);
  if (spread > SNAPSHOT_CHVOL_MAX_SPREAD) {
    warnings.push({
      code: "SNAPSHOT_LEVEL_IMBALANCE",
      severity: "warn",
      message: `Snapshot ChVol spread ${spread.toFixed(2)} exceeds ${SNAPSHOT_CHVOL_MAX_SPREAD} — risk of volume jumps between snapshots`,
      actual: spread,
      threshold: SNAPSHOT_CHVOL_MAX_SPREAD,
    });
  }
}

function checkEffectPresence(
  spec: PresetSpec,
  warnings: QualityWarning[],
): void {
  if (!spec.signalChain || spec.signalChain.length === 0) return;

  const hasDelay = spec.signalChain.some((b) => b.type === "delay");
  const hasReverb = spec.signalChain.some((b) => b.type === "reverb");

  if (!hasDelay && !hasReverb) {
    warnings.push({
      code: "NO_TIME_EFFECTS",
      severity: "info",
      message: "No delay or reverb in signal chain — preset may sound dry and lack spatial depth",
    });
  }
}

function checkReverbWithoutCabFiltering(
  spec: PresetSpec,
  warnings: QualityWarning[],
): void {
  if (!spec.signalChain || spec.signalChain.length === 0) return;

  const hasReverb = spec.signalChain.some((b) => b.type === "reverb");
  if (!hasReverb) return;

  const cabWithHighHC = spec.signalChain.find(
    (b) =>
      b.type === "cab" &&
      typeof b.parameters?.HighCut === "number" &&
      (b.parameters.HighCut as number) > CAB_HIGHCUT_MAX,
  );

  if (cabWithHighHC) {
    warnings.push({
      code: "REVERB_WITHOUT_CAB_FILTERING",
      severity: "info",
      message: "Reverb present but cab HighCut is above 18000 Hz — reverb tail may sound harsh without high-frequency filtering",
    });
  }
}

// ---------------------------------------------------------------------------
// COHERE-06: Description-effect cross-validation
// ---------------------------------------------------------------------------

/**
 * Warn when description mentions effects not present in signal chain.
 * Advisory only — never throws.
 */
function checkDescriptionEffectCoherence(
  spec: PresetSpec,
  warnings: QualityWarning[],
): void {
  if (!spec.description) return;
  if (!spec.signalChain || !Array.isArray(spec.signalChain)) return;
  const desc = spec.description.toLowerCase();

  const effectKeywords: Array<[string, BlockSpec["type"]]> = [
    ["reverb", "reverb"],
    ["delay", "delay"],
    ["chorus", "modulation"],
    ["tremolo", "modulation"],
    ["flanger", "modulation"],
    ["phaser", "modulation"],
    ["modulation", "modulation"],
  ];

  for (const [keyword, blockType] of effectKeywords) {
    if (desc.includes(keyword)) {
      const hasEffect = spec.signalChain.some(b => b.type === blockType);
      if (!hasEffect) {
        warnings.push({
          code: "DESC_EFFECT_MISSING",
          severity: "warn",
          message: `Description mentions "${keyword}" but no ${blockType} block in signal chain`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate preset quality — returns advisory warnings for suboptimal parameter choices.
 *
 * NON-THROWING GUARANTEE: This function wraps all logic in try/catch and
 * always returns QualityWarning[]. An empty array means no issues detected.
 *
 * @param spec - The preset specification to validate
 * @param caps - Device capabilities for device-specific exemptions
 * @returns Array of quality warnings (empty = no issues)
 */
export function validatePresetQuality(
  spec: PresetSpec,
  caps: DeviceCapabilities,
): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  try {
    // Per-block checks (7 checks)
    if (spec.signalChain && Array.isArray(spec.signalChain)) {
      for (const block of spec.signalChain) {
        checkReverbMix(block, warnings);
        checkDelayFeedback(block, warnings);
        checkDelayMix(block, warnings);
        checkCabFiltering(block, warnings);
        checkDriveLevel(block, warnings);
        checkAmpDrive(block, caps, warnings);
      }
    }

    // Preset-level structural checks (4 checks)
    checkSnapshotLevelBalance(spec, warnings);
    checkEffectPresence(spec, warnings);
    checkReverbWithoutCabFiltering(spec, warnings);

    // COHERE-06: Description-effect cross-validation
    checkDescriptionEffectCoherence(spec, warnings);
  } catch {
    // Non-throwing guarantee: return whatever warnings were accumulated
  }
  return warnings;
}
