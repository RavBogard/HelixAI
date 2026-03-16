import { NextRequest, NextResponse } from "next/server";
import { callGeminiPlanner, callGeminiHistorian } from "@/lib/planner";
import { createGeminiClient, getModelId, isPremiumKey } from "@/lib/gemini";
import { getMasteringCriticPrompt } from "@/lib/prompt-router";
import {
  assembleSignalChain,
  buildSnapshots,
  resolveParameters,
  buildHlxFile,
  summarizePreset,
  validatePresetSpec,
  validatePresetQuality,
  auditIntentFidelity,
  buildPgpFile,
  summarizePodGoPreset,
  buildHspFile,
  summarizeStadiumPreset,
  buildStompFile,
  summarizeStompPreset,
  resolveFamily,
} from "@/lib/helix";
import { getCapabilities } from "@/lib/helix/device-family";
import { isPodGo, isStadium, isStomp } from "@/lib/helix/types";
import { AMP_MODELS, STADIUM_AMPS } from "@/lib/helix/models";
import { logQualityWarnings } from "@/lib/helix/quality-logger";
import type { PresetSpec, DeviceTarget, SubstitutionMap, DeviceFamily } from "@/lib/helix";
import type { RigIntent } from "@/lib/helix";
import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const maxDuration = 60; // Prevent Vercel hobby 15s truncating the Gemini connection mid-stream

export async function POST(req: NextRequest) {
  try {
    const authSupabase = await createSupabaseServerClient();
    const { data: { user: authUser } } = await authSupabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const jsonBody = await req.json();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        function emitStatus(msg: string) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "status", message: msg }) + "\n"));
        }
        function emitResult(payload: any) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: "result", payload }) + "\n"));
        }
        function emitError(msg: string) {
          controller.enqueue(encoder.encode(JSON.stringify({ error: msg }) + "\n"));
        }

        try {
          await runGenerationProcess(jsonBody, authUser, emitStatus, emitResult);
          controller.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error("Preset generation error:", message);
          emitError(message);
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: { "Content-Type": "application/x-ndjson" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function runGenerationProcess(
  body: any, 
  authUser: any, 
  emitStatus: (msg: string) => void, 
  emitResult: (payload: any) => void
) {

    const { messages, device, rigIntent, rigText, conversationId, premiumKey, acousticEmpathyEnabled } = body;

    emitStatus("Translating tone intent...");

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
      throw new Error("No conversation provided");
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
    emitStatus("Tone Historian analyzing original recording...");
    const historianBlueprint = await callGeminiHistorian(messages);

    const historianPromptInject = `HISTORIAN RESEARCH OVERRIDE:
The Historian Agent has analyzed the request and determined the following:
Song/Artist: ${historianBlueprint.songTarget}
Amp Era: ${historianBlueprint.ampEra}
Historically Accurate Effects: ${historianBlueprint.keyEffects.join(", ")}
Notes: ${historianBlueprint.historianNotes}

You MUST utilize this historical context. Act as the device-specialized audio engineer: pick the specific Line 6 models that best match this gear, and use your DSP limits to filter the list to only the essentials that fit on the board.`;

    const combinedContext = toneContext 
        ? `${toneContext}\n\n${historianPromptInject}` 
        : historianPromptInject;

    emitStatus("Structuring signal chain...");
    
    // Step 1: Gemini Planner generates ToneIntent (creative choices only)
    // Pass device target so planner filters model list for Pod Go (PGMOD-04)
    // Pass combined context so planner prioritizes rig-matched and historian-matched models
    const toneIntent = await callGeminiPlanner(messages, deviceTarget, deviceFamily, combinedContext);

    // Force injection of Historian tempo data to guarantee zero hallucination
    toneIntent.tempoHint = historianBlueprint.bpm;
    toneIntent.delaySubdivision = historianBlueprint.delaySubdivision;

    emitStatus("Resolving parameter engine...");
    
    // Step 2: Knowledge Layer pipeline (deterministic)
    // Resolve capabilities once, pass to all Knowledge Layer functions (KLAYER-04)
    const caps = getCapabilities(deviceTarget);
    const chain = assembleSignalChain(toneIntent, caps);
    const parameterized = resolveParameters(chain, toneIntent, caps);
    const snapshots = buildSnapshots(parameterized, toneIntent.snapshots, toneIntent.genreHint, toneIntent.snapshotTweaks);

    // Step 3: Build PresetSpec
    const safeAmpName = toneIntent.ampName || "US Double Nrm";
    const ampModel = caps.ampCatalogEra === "agoura" ? STADIUM_AMPS[safeAmpName] : AMP_MODELS[safeAmpName];
    const ampCategory = ampModel?.ampCategory ?? "clean";

    const presetSpec: PresetSpec = {
      name: toneIntent.presetName || `${toneIntent.ampName} ${toneIntent.genreHint || "Preset"}`.slice(0, 32),
      description: toneIntent.description || `${toneIntent.genreHint || ""} preset using ${toneIntent.ampName}`.trim(),
      tempo: toneIntent.tempoHint ?? 120,
      guitarNotes: toneIntent.guitarNotes,
      variaxModel: toneIntent.variaxModel,
      ampCategory,
      signalChain: parameterized,
      snapshots,
    };

    // Step 4: Strict validation — fail fast on structural errors
    validatePresetSpec(presetSpec, caps);

    // Step 4.5: Quality validation — advisory warnings, never blocks
    const qualityWarnings = validatePresetQuality(presetSpec, caps);
    if (qualityWarnings.length > 0) {
      logQualityWarnings(qualityWarnings, {
        device: deviceTarget,
        presetName: presetSpec.name,
      });
    }

    // Step 4.6: Intent fidelity audit — trace ToneIntent → PresetSpec
    const intentAudit = auditIntentFidelity(toneIntent, presetSpec);
    if (intentAudit.warnings.length > 0) {
      console.warn("[intent-audit]", intentAudit.warnings.join("; "));
    }

    emitStatus("Mastering engineer auditing audio...");

    // Step 4.7: Tone Critic (Secondary Agent) -> Mutates presetSpec to fix acoustic flaws.
    const ai = createGeminiClient();
    const modelId = getModelId(isPremiumKey(premiumKey));
    const CRITIC_PROMPT = getMasteringCriticPrompt();
    
    const criticChat = ai.chats.create({
      model: modelId,
      config: {
        systemInstruction: CRITIC_PROMPT,
      }
    });

    const criticResponse = await criticChat.sendMessage({
      message: `User Request: ${messages[messages.length - 1]?.content}\\n\\nInitial Generated PresetSpec JSON:\\n${JSON.stringify(presetSpec, null, 2)}`
    });

    if (criticResponse.text) {
      // Extract the JSON block using a regex in case The LLM wraps it in markdown
      const match = criticResponse.text.match(/```json\\n([\\s\\S]*?)\\n```/);
      const rawJson = match ? match[1] : criticResponse.text.replace(/```.*?\\n/g, "").replace(/```/g, "");
      
      try {
        const masteredSpec = JSON.parse(rawJson);
        // Safely overwrite the signalChain and snapshots
        if (masteredSpec.signalChain) presetSpec.signalChain = masteredSpec.signalChain;
        if (masteredSpec.snapshots) presetSpec.snapshots = masteredSpec.snapshots;
      } catch (err) {
        console.warn("[tone-critic] Failed to parse Mastering Critic JSON, falling back to primary output.", err);
      }
    }

    emitStatus("Finalizing preset encoding...");

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

      emitResult({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx", // Stomp uses .hlx — same as LT/Floor (STOMP-06)
        intentAudit,
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
      return;
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

      emitResult({
        preset: hspFile.json,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hsp",
        intentAudit,
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
      return;
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

      emitResult({
        preset: pgpFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".pgp", // PGUX-02: frontend uses this for download filename
        intentAudit,
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
      return;
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

      emitResult({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx",
        intentAudit,
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
      return;
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
