// mock-harness.ts — Automated preset generation harness for v5.0 gold standard compliance.
// Runs ToneIntent fixtures through the full Knowledge Layer pipeline without AI calls.
// Produces real preset file objects for structural comparison against references.

import { assembleSignalChain } from "./chain-rules";
import { resolveParameters } from "./param-engine";
import { buildSnapshots } from "./snapshot-engine";
import { buildHlxFile } from "./preset-builder";
import { buildStompFile } from "./stomp-builder";
import { buildPgpFile } from "./podgo-builder";
import { buildHspFile } from "./stadium-builder";
import { validatePresetSpec } from "./validate";
import { validatePresetQuality } from "./quality-validate";
import { auditIntentFidelity } from "./intent-validate";
import { validateMusicalIntelligence } from "./musical-validate";
import { getCapabilities } from "./device-family";
import { isStomp, isStadium, isPodGo } from "./types";
import type { PresetSpec, DeviceTarget } from "./types";
import type { MockScenario } from "./mock-scenarios";
import type { IntentAudit } from "./intent-validate";
import type { MusicalAudit } from "./musical-validate";

export interface HarnessResult {
  scenarioId: string;
  device: DeviceTarget;
  toneStyle: string;
  preset: unknown;
  spec: PresetSpec;
  fileExtension: ".hlx" | ".pgp" | ".hsp";
  qualityWarnings: string[];
  intentAudit: IntentAudit;
  musicalAudit: MusicalAudit;
  error?: string;
}

/**
 * Run a single mock scenario through the full pipeline.
 * Mirrors the generate route without auth/Supabase/AI.
 */
export function runScenario(scenario: MockScenario): HarnessResult {
  const { id, device, toneStyle, intent } = scenario;

  try {
    const caps = getCapabilities(device);

    // Knowledge Layer pipeline (deterministic)
    const chain = assembleSignalChain(intent, caps);
    const parameterized = resolveParameters(chain, intent, caps);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);

    const presetSpec: PresetSpec = {
      name: intent.presetName || `${intent.ampName} ${intent.genreHint || "Preset"}`.slice(0, 32),
      description: intent.description || `${intent.genreHint || ""} preset using ${intent.ampName}`.trim(),
      tempo: intent.tempoHint ?? 120,
      guitarNotes: intent.guitarNotes,
      ...(intent.variaxModel ? { variaxModel: intent.variaxModel } : {}),
      signalChain: parameterized,
      snapshots,
    };

    // Strict validation
    validatePresetSpec(presetSpec, caps);

    // Quality validation (advisory)
    const qualityResult = validatePresetQuality(presetSpec, caps);
    const qualityWarnings = qualityResult.map((w: { message: string }) => w.message);

    // Intent fidelity audit
    const intentAudit = auditIntentFidelity(intent, presetSpec);

    // Musical intelligence validation
    const musicalAudit = validateMusicalIntelligence(intent, presetSpec);

    // Build device-specific preset file
    let preset: unknown;
    let fileExtension: ".hlx" | ".pgp" | ".hsp";

    if (isStomp(device)) {
      preset = buildStompFile(presetSpec, device as "helix_stomp" | "helix_stomp_xl");
      fileExtension = ".hlx";
    } else if (isStadium(device)) {
      preset = buildHspFile(presetSpec);
      fileExtension = ".hsp";
    } else if (isPodGo(device)) {
      preset = buildPgpFile(presetSpec);
      fileExtension = ".pgp";
    } else {
      preset = buildHlxFile(presetSpec, device);
      fileExtension = ".hlx";
    }

    return {
      scenarioId: id,
      device,
      toneStyle,
      preset,
      spec: presetSpec,
      fileExtension,
      qualityWarnings,
      intentAudit,
      musicalAudit,
    };
  } catch (err) {
    return {
      scenarioId: id,
      device,
      toneStyle,
      preset: null,
      spec: null as unknown as PresetSpec,
      fileExtension: ".hlx",
      qualityWarnings: [],
      intentAudit: {
        amp: { requested: "", matched: false },
        cab: { requested: "", matched: false },
        effects: [],
        tempo: { requested: 0, actual: 0, matched: false },
        delaySubdivision: { requested: null, applied: false },
        snapshots: { requested: 0, actual: 0, matched: false },
        instrument: { requested: undefined, matched: false },
        warnings: [],
      },
      musicalAudit: { warnings: [], passed: false },
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Run all provided scenarios and return results.
 */
export function runAllScenarios(scenarios: MockScenario[]): HarnessResult[] {
  return scenarios.map(runScenario);
}
