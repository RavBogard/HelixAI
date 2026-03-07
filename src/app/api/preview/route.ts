// /api/preview — POST endpoint for the two-step preview flow (Phase 77).
//
// Runs the SAME pipeline as /api/generate (Planner -> Knowledge Layer) but
// returns structured VisualizerState-shaped JSON instead of a device file.
// The frontend Zustand store hydrates from this response.
//
// Step 1 of two-step API: preview (this) + download (Phase 83).

import { NextRequest, NextResponse } from "next/server";
import { callClaudePlanner } from "@/lib/planner";
import {
  assembleSignalChain,
  resolveParameters,
  buildSnapshots,
  validatePresetSpec,
  validatePresetQuality,
  resolveFamily,
  getCapabilities,
} from "@/lib/helix";
import { logQualityWarnings } from "@/lib/helix/quality-logger";
import type { PresetSpec, DeviceTarget, SubstitutionMap, DeviceFamily } from "@/lib/helix";
import type { RigIntent } from "@/lib/helix";
import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";
import { hydrateVisualizerState } from "@/lib/visualizer/hydrate";

export async function POST(req: NextRequest) {
  try {
    const { messages, device, rigIntent, rigText, conversationId } = await req.json();

    // --- Validate required fields ---
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "messages is required and must be a non-empty array" },
        { status: 400 },
      );
    }

    // --- Resolve device target ---
    let deviceTarget: DeviceTarget;
    if (device === "helix_floor") {
      deviceTarget = "helix_floor";
    } else if (device === "pod_go") {
      deviceTarget = "pod_go";
    } else if (device === "helix_stadium") {
      deviceTarget = "helix_stadium";
    } else if (device === "helix_stomp") {
      deviceTarget = "helix_stomp";
    } else if (device === "helix_stomp_xl") {
      deviceTarget = "helix_stomp_xl";
    } else {
      deviceTarget = "helix_lt";
    }

    const deviceFamily: DeviceFamily = resolveFamily(deviceTarget);

    // --- Rig emulation context ---
    let substitutionMap: SubstitutionMap | undefined;
    let toneContext: string | undefined;

    if (rigIntent) {
      const typedRigIntent = rigIntent as RigIntent;
      substitutionMap = mapRigToSubstitutions(typedRigIntent, deviceTarget);
    } else if (rigText && typeof rigText === "string" && rigText.trim().length > 0) {
      const parsedRigIntent = parseRigText(rigText.trim());
      substitutionMap = mapRigToSubstitutions(parsedRigIntent, deviceTarget);
    }

    if (substitutionMap && substitutionMap.length > 0) {
      toneContext = buildToneContext(substitutionMap);
    }

    // --- Pipeline: identical to /api/generate Steps 1-4 ---

    // Step 1: Claude Planner generates ToneIntent (creative choices only — AI tokens here)
    const toneIntent = await callClaudePlanner(messages, deviceTarget, deviceFamily, toneContext);

    // Step 2: Knowledge Layer pipeline (deterministic — zero AI tokens)
    const caps = getCapabilities(deviceTarget);
    const chain = assembleSignalChain(toneIntent, caps);
    const parameterized = resolveParameters(chain, toneIntent, caps);
    const snapshots = buildSnapshots(parameterized, toneIntent.snapshots);

    // Step 3: Build PresetSpec
    const presetSpec: PresetSpec = {
      name: toneIntent.presetName || `${toneIntent.ampName} ${toneIntent.genreHint || "Preset"}`.slice(0, 32),
      description: toneIntent.description || `${toneIntent.genreHint || ""} preset using ${toneIntent.ampName}`.trim(),
      tempo: toneIntent.tempoHint ?? 120,
      guitarNotes: toneIntent.guitarNotes,
      ...(toneIntent.variaxModel ? { variaxModel: toneIntent.variaxModel } : {}),
      signalChain: parameterized,
      snapshots,
    };

    // Step 4: Strict validation
    validatePresetSpec(presetSpec, caps);

    // Step 4.5: Quality validation (advisory, never blocks)
    const qualityWarnings = validatePresetQuality(presetSpec, caps);
    if (qualityWarnings.length > 0) {
      logQualityWarnings(qualityWarnings, {
        device: deviceTarget,
        presetName: presetSpec.name,
      });
    }

    // --- Step 5: Transform to preview response (NEW — replaces file builder) ---
    const previewResult = hydrateVisualizerState(presetSpec, deviceTarget);

    return NextResponse.json({
      success: true,
      ...previewResult,
      toneIntent,
      ...(substitutionMap !== undefined ? { substitutionMap } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preview generation error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// buildToneContext — same helper as /api/generate (private, not exported)
// ---------------------------------------------------------------------------

function buildToneContext(substitutionMap: SubstitutionMap): string {
  const lines = substitutionMap.map(
    (e) =>
      `- ${e.physicalPedal} → ${e.helixModelDisplayName} (${e.confidence}): ${e.substitutionReason}`,
  );
  return [
    "Rig emulation context: The user's physical pedal rig has been mapped to Helix equivalents. Please prioritize these specific models when building the preset while still fulfilling the tone interview goals:",
    "",
    ...lines,
  ].join("\n");
}
