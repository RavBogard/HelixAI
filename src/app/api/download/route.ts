// /api/download — POST endpoint for the download step of the two-step API flow.
//
// Receives the current visualizer state (device, baseBlocks, snapshots, meta),
// dehydrates it back into a PresetSpec, validates, builds the device-specific
// file, and returns it as a binary download.
//
// Stateless: frontend sends state, backend compiles file, returns binary.
// No persistence — the /api/generate route handles Supabase storage.
//
// Step 2 of two-step API: preview (Phase 77) + download (this).

import { NextRequest, NextResponse } from "next/server";
import {
  buildHlxFile,
  buildPgpFile,
  buildHspFile,
  buildStompFile,
  validatePresetSpec,
  getCapabilities,
  isPodGo,
  isStadium,
  isStomp,
} from "@/lib/helix";
import type { DeviceTarget, BlockSpec, SnapshotSpec } from "@/lib/helix/types";
import { dehydrateToPresetSpec } from "@/lib/visualizer/dehydrate";

interface DownloadRequestBody {
  device: DeviceTarget;
  baseBlocks: BlockSpec[];
  snapshots: SnapshotSpec[];
  presetName: string;
  description: string;
  tempo: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: DownloadRequestBody = await req.json();
    const { device, baseBlocks, snapshots, presetName, description, tempo } = body;

    // --- Validate required fields ---
    if (!device) {
      return NextResponse.json(
        { success: false, error: "device is required" },
        { status: 400 },
      );
    }
    if (!baseBlocks || !Array.isArray(baseBlocks)) {
      return NextResponse.json(
        { success: false, error: "baseBlocks is required and must be an array" },
        { status: 400 },
      );
    }
    if (!snapshots || !Array.isArray(snapshots)) {
      return NextResponse.json(
        { success: false, error: "snapshots is required and must be an array" },
        { status: 400 },
      );
    }
    if (!presetName) {
      return NextResponse.json(
        { success: false, error: "presetName is required" },
        { status: 400 },
      );
    }

    // --- Dehydrate to PresetSpec ---
    const presetSpec = dehydrateToPresetSpec(baseBlocks, snapshots, {
      presetName,
      description: description ?? "",
      tempo: tempo ?? 120,
    });

    // --- Validate preset ---
    const caps = getCapabilities(device);
    validatePresetSpec(presetSpec, caps);

    // --- Build device file ---
    let fileBuffer: Buffer;
    let fileExtension: string;

    if (isStomp(device)) {
      const hlxFile = buildStompFile(presetSpec, device as "helix_stomp" | "helix_stomp_xl");
      fileBuffer = Buffer.from(JSON.stringify(hlxFile, null, 2));
      fileExtension = "hlx";
    } else if (isStadium(device)) {
      const hspFile = buildHspFile(presetSpec);
      fileBuffer = Buffer.from(hspFile.serialized);
      fileExtension = "hsp";
    } else if (isPodGo(device)) {
      const pgpFile = buildPgpFile(presetSpec);
      fileBuffer = Buffer.from(JSON.stringify(pgpFile, null, 2));
      fileExtension = "pgp";
    } else {
      // Helix (LT, Floor, Rack)
      const hlxFile = buildHlxFile(presetSpec, device);
      fileBuffer = Buffer.from(JSON.stringify(hlxFile, null, 2));
      fileExtension = "hlx";
    }

    // --- Return binary response ---
    const sanitizedName = presetName.replace(/[^a-zA-Z0-9_\- ]/g, "_");

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${sanitizedName}.${fileExtension}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Download error:", message);

    // Validation errors from validatePresetSpec get 400
    if (message.startsWith("PresetSpec")) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
