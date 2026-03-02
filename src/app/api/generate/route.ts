import { NextRequest, NextResponse } from "next/server";
import { callClaudePlanner } from "@/lib/planner";
import {
  assembleSignalChain,
  resolveParameters,
  buildSnapshots,
  buildHlxFile,
  summarizePreset,
  validatePresetSpec,
  buildPgpFile,
  summarizePodGoPreset,
  isPodGo,
} from "@/lib/helix";
import type { PresetSpec, DeviceTarget } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const { messages, device } = await req.json();

    // Resolve device target — now supports pod_go (PGUX-01)
    let deviceTarget: DeviceTarget;
    if (device === "helix_floor") {
      deviceTarget = "helix_floor";
    } else if (device === "pod_go") {
      deviceTarget = "pod_go";
    } else {
      deviceTarget = "helix_lt";
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation provided" },
        { status: 400 }
      );
    }

    // Step 1: Claude Planner generates ToneIntent (creative choices only)
    // Pass device target so planner filters model list for Pod Go (PGMOD-04)
    const toneIntent = await callClaudePlanner(messages, deviceTarget);

    // Step 2: Knowledge Layer pipeline (deterministic)
    // Pass device target so chain rules apply Pod Go constraints (PGCHAIN-01-03)
    const chain = assembleSignalChain(toneIntent, deviceTarget);
    const parameterized = resolveParameters(chain, toneIntent);
    const snapshots = buildSnapshots(parameterized, toneIntent.snapshots);

    // Step 3: Build PresetSpec
    const presetSpec: PresetSpec = {
      name: toneIntent.presetName || `${toneIntent.ampName} ${toneIntent.genreHint || "Preset"}`.slice(0, 32),
      description: toneIntent.description || `${toneIntent.genreHint || ""} preset using ${toneIntent.ampName}`.trim(),
      tempo: toneIntent.tempoHint ?? 120,
      guitarNotes: toneIntent.guitarNotes,
      signalChain: parameterized,
      snapshots,
    };

    // Step 4: Strict validation — fail fast on structural errors
    // Pass device for device-specific validation (Pod Go: all dsp0, 4 snapshots, 10 blocks)
    validatePresetSpec(presetSpec, deviceTarget);

    // Step 5: Build preset file with device target
    if (isPodGo(deviceTarget)) {
      // Pod Go: build .pgp file (PGP-01)
      const pgpFile = buildPgpFile(presetSpec);
      const summary = summarizePodGoPreset(presetSpec);

      return NextResponse.json({
        preset: pgpFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".pgp", // PGUX-02: frontend uses this for download filename
      });
    } else {
      // Helix: build .hlx file
      const hlxFile = buildHlxFile(presetSpec, deviceTarget);
      const summary = summarizePreset(presetSpec);

      return NextResponse.json({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx",
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
