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
  buildHspFile,
  summarizeStadiumPreset,
  buildStompFile,
  summarizeStompPreset,
  isPodGo,
  isStadium,
  isStomp,
  resolveFamily,
} from "@/lib/helix";
import type { PresetSpec, DeviceTarget, SubstitutionMap, DeviceFamily } from "@/lib/helix";
import type { RigIntent } from "@/lib/helix";
import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, device, rigIntent, rigText, conversationId } = await req.json();

    // Resolve device target — supports helix_lt, helix_floor, pod_go, helix_stadium, helix_stomp, helix_stomp_xl
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

    // Resolve device family at pipeline entry (Phase 61).
    // deviceFamily is ready for downstream phases (62-65) to consume.
    // Note: helix_rack, pod_go_xl, helix_stadium_xl fall through to defaults above — acceptable
    // because their builders don't ship until v5.1.
    const deviceFamily: DeviceFamily = resolveFamily(deviceTarget);

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation provided" },
        { status: 400 }
      );
    }

    // Rig emulation path: build substitution map and toneContext if rig data present.
    // rigIntent takes precedence over rigText (vision path is higher confidence).
    // If neither is present, substitutionMap and toneContext remain undefined —
    // the route falls through to standard generation (identical to pre-Phase-20 behavior).
    let substitutionMap: SubstitutionMap | undefined;
    let toneContext: string | undefined;

    if (rigIntent) {
      // Vision path: rigIntent was validated by /api/vision before being stored in client state.
      // Cast is safe — the data was already Zod-validated at the vision route.
      const typedRigIntent = rigIntent as RigIntent;
      substitutionMap = mapRigToSubstitutions(typedRigIntent, deviceTarget);
    } else if (rigText && typeof rigText === "string" && rigText.trim().length > 0) {
      // Text path: user described their rig as text — parse to synthetic RigIntent.
      // parseRigText() splits on conjunctions/commas/newlines and creates PhysicalPedal entries
      // with confidence "low". mapRigToSubstitutions() applies the same three-tier lookup.
      const parsedRigIntent = parseRigText(rigText.trim());
      substitutionMap = mapRigToSubstitutions(parsedRigIntent, deviceTarget);
    }

    // Build toneContext string only when substitutionMap has entries.
    // An empty substitutionMap produces a context string with no bullet points —
    // avoid sending that to the planner as it adds noise without information.
    if (substitutionMap && substitutionMap.length > 0) {
      toneContext = buildToneContext(substitutionMap);
    }

    // Step 1: Claude Planner generates ToneIntent (creative choices only)
    // Pass device target so planner filters model list for Pod Go (PGMOD-04)
    // Pass toneContext so planner prioritizes rig-matched models (Phase 20)
    const toneIntent = await callClaudePlanner(messages, deviceTarget, toneContext);

    // Step 2: Knowledge Layer pipeline (deterministic)
    // Pass device target so chain rules apply Pod Go constraints (PGCHAIN-01-03)
    const chain = assembleSignalChain(toneIntent, deviceTarget);
    const parameterized = resolveParameters(chain, toneIntent, deviceTarget);
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

    // Step 4: Strict validation — fail fast on structural errors
    // Pass device for device-specific validation (Pod Go: all dsp0, 4 snapshots, 10 blocks)
    validatePresetSpec(presetSpec, deviceTarget);

    // Step 5: Build preset file with device target
    if (isStomp(deviceTarget)) {
      // Step 5b: Stomp — build .hlx file with Stomp-specific I/O models (STOMP-06)
      const hlxFile = buildStompFile(presetSpec, deviceTarget as "helix_stomp" | "helix_stomp_xl");
      const summary = summarizeStompPreset(presetSpec, deviceTarget as "helix_stomp" | "helix_stomp_xl");

      // --- Persistence: fire-and-forget upload + preset_url update ---
      if (conversationId) {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const storagePath = `${user.id}/${conversationId}/latest.hlx`; // Same extension as LT/Floor (STOMP-06)
          const fileBuffer = Buffer.from(JSON.stringify(hlxFile));

          // Non-blocking — do NOT await before return
          supabase.storage
            .from("presets")
            .upload(storagePath, fileBuffer, {
              contentType: "application/json",
              upsert: true,
            })
            .then(({ error: uploadError }) => {
              if (!uploadError) {
                return supabase
                  .from("conversations")
                  .update({ preset_url: storagePath, updated_at: new Date().toISOString() })
                  .eq("id", conversationId)
                  .eq("user_id", user.id)
                  .then(({ error: dbErr }) => {
                    if (dbErr) console.error("Preset URL update failed (non-fatal):", dbErr.message);
                  });
              }
              console.error("Preset storage upload failed (non-fatal):", uploadError.message);
            })
            .catch((err) => console.error("Preset persistence error (non-fatal):", err));
        }
      }
      // --- End persistence ---

      return NextResponse.json({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx", // Stomp uses .hlx — same as LT/Floor (STOMP-06)
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    }

    if (isStadium(deviceTarget)) {
      // Stadium: build .hsp file (STAD-06)
      const hspFile = buildHspFile(presetSpec);
      const summary = summarizeStadiumPreset(presetSpec);

      // --- Persistence: fire-and-forget upload + preset_url update (STORE-01, STORE-03) ---
      if (conversationId) {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Store full serialized .hsp (magic header + JSON) so download has correct format
          const storagePath = `${user.id}/${conversationId}/latest.hsp`;
          const fileBuffer = Buffer.from(hspFile.serialized);

          // Non-blocking — do NOT await before return
          supabase.storage
            .from("presets")
            .upload(storagePath, fileBuffer, {
              contentType: "application/octet-stream",
              upsert: true,
            })
            .then(({ error: uploadError }) => {
              if (!uploadError) {
                return supabase
                  .from("conversations")
                  .update({ preset_url: storagePath, updated_at: new Date().toISOString() })
                  .eq("id", conversationId)
                  .eq("user_id", user.id)
                  .then(({ error: dbErr }) => {
                    if (dbErr) console.error("Preset URL update failed (non-fatal):", dbErr.message);
                  });
              }
              console.error("Preset storage upload failed (non-fatal):", uploadError.message);
            })
            .catch((err) => console.error("Preset persistence error (non-fatal):", err));
        }
      }
      // --- End persistence ---

      return NextResponse.json({
        preset: hspFile.json,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hsp",
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    }

    if (isPodGo(deviceTarget)) {
      // Pod Go: build .pgp file (PGP-01)
      const pgpFile = buildPgpFile(presetSpec);
      const summary = summarizePodGoPreset(presetSpec);

      // --- Persistence: fire-and-forget upload + preset_url update (STORE-01, STORE-03) ---
      if (conversationId) {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const storagePath = `${user.id}/${conversationId}/latest.pgp`;
          const fileBuffer = Buffer.from(JSON.stringify(pgpFile));

          // Non-blocking — do NOT await before return
          supabase.storage
            .from("presets")
            .upload(storagePath, fileBuffer, {
              contentType: "application/json",
              upsert: true,
            })
            .then(({ error: uploadError }) => {
              if (!uploadError) {
                return supabase
                  .from("conversations")
                  .update({ preset_url: storagePath, updated_at: new Date().toISOString() })
                  .eq("id", conversationId)
                  .eq("user_id", user.id)
                  .then(({ error: dbErr }) => {
                    if (dbErr) console.error("Preset URL update failed (non-fatal):", dbErr.message);
                  });
              }
              console.error("Preset storage upload failed (non-fatal):", uploadError.message);
            })
            .catch((err) => console.error("Preset persistence error (non-fatal):", err));
        }
      }
      // --- End persistence ---

      return NextResponse.json({
        preset: pgpFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".pgp", // PGUX-02: frontend uses this for download filename
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    } else {
      // Helix: build .hlx file
      const hlxFile = buildHlxFile(presetSpec, deviceTarget);
      const summary = summarizePreset(presetSpec);

      // --- Persistence: fire-and-forget upload + preset_url update (STORE-01, STORE-03) ---
      if (conversationId) {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const storagePath = `${user.id}/${conversationId}/latest.hlx`;
          const fileBuffer = Buffer.from(JSON.stringify(hlxFile));

          // Non-blocking — do NOT await before return
          supabase.storage
            .from("presets")
            .upload(storagePath, fileBuffer, {
              contentType: "application/json",
              upsert: true,
            })
            .then(({ error: uploadError }) => {
              if (!uploadError) {
                return supabase
                  .from("conversations")
                  .update({ preset_url: storagePath, updated_at: new Date().toISOString() })
                  .eq("id", conversationId)
                  .eq("user_id", user.id)
                  .then(({ error: dbErr }) => {
                    if (dbErr) console.error("Preset URL update failed (non-fatal):", dbErr.message);
                  });
              }
              console.error("Preset storage upload failed (non-fatal):", uploadError.message);
            })
            .catch((err) => console.error("Preset persistence error (non-fatal):", err));
        }
      }
      // --- End persistence ---

      return NextResponse.json({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx",
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// buildToneContext — convert SubstitutionMap to planner-friendly context string
//
// Private helper — NOT exported. Called only from the POST handler above.
// Formats substitution entries as a bullet list under a context header.
// Only called when substitutionMap.length > 0 (guard in POST handler).
// ---------------------------------------------------------------------------

function buildToneContext(substitutionMap: SubstitutionMap): string {
  const lines = substitutionMap.map(
    (e) =>
      `- ${e.physicalPedal} → ${e.helixModelDisplayName} (${e.confidence}): ${e.substitutionReason}`
  );
  return [
    "Rig emulation context: The user's physical pedal rig has been mapped to Helix equivalents. Please prioritize these specific models when building the preset while still fulfilling the tone interview goals:",
    "",
    ...lines,
  ].join("\n");
}
