import { NextRequest, NextResponse } from "next/server";
import { callClaudePlanner } from "@/lib/planner";
import {
  assembleSignalChain,
  resolveParameters,
  buildSnapshots,
  buildHlxFile,
  summarizePreset,
} from "@/lib/helix";
import type { PresetSpec } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation provided" },
        { status: 400 }
      );
    }

    // Step 1: Claude Planner generates ToneIntent (creative choices only)
    const toneIntent = await callClaudePlanner(messages);

    // Step 2: Knowledge Layer pipeline (deterministic)
    const chain = assembleSignalChain(toneIntent);
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

    // Step 4: Build .hlx file
    const hlxFile = buildHlxFile(presetSpec);
    const summary = summarizePreset(presetSpec);

    // Return single result (not multi-provider array)
    return NextResponse.json({
      preset: hlxFile,
      summary,
      spec: presetSpec,
      toneIntent, // Include for debugging/transparency
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
