import { NextRequest, NextResponse } from "next/server";
import { getPresetGenerationPrompt } from "@/lib/gemini";
import { generateWithProvider, getAvailableProviders, PROVIDERS } from "@/lib/providers";
import { buildHlxFile, summarizePreset, validateAndFixPresetSpec } from "@/lib/helix";
import type { PresetSpec, HlxFile } from "@/lib/helix";

interface ProviderResult {
  providerId: string;
  providerName: string;
  preset?: HlxFile;
  summary?: string;
  spec?: PresetSpec;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, providers: requestedProviders } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "No conversation provided" }, { status: 400 });
    }

    // Default to gemini if no providers specified (backwards compat)
    const providerIds: string[] =
      requestedProviders && requestedProviders.length > 0
        ? requestedProviders
        : ["gemini"];

    // Validate all requested providers exist and have API keys
    const available = getAvailableProviders().map((p) => p.id);
    const invalid = providerIds.filter((id: string) => !PROVIDERS[id]);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Unknown providers: ${invalid.join(", ")}` },
        { status: 400 },
      );
    }
    const unavailable = providerIds.filter(
      (id: string) => PROVIDERS[id] && !available.includes(id),
    );
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: `Missing API keys for: ${unavailable.map((id: string) => PROVIDERS[id].name).join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Build conversation context and system prompt
    const conversationText = messages
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n\n");
    const systemPrompt = getPresetGenerationPrompt();

    // Fire all providers in parallel
    const settled = await Promise.allSettled(
      providerIds.map(async (providerId: string): Promise<ProviderResult> => {
        const provider = PROVIDERS[providerId];
        const jsonText = await generateWithProvider(
          providerId,
          conversationText,
          systemPrompt,
        );

        // Parse the JSON — handle providers that wrap in markdown code fences
        let presetSpec: PresetSpec;
        try {
          presetSpec = JSON.parse(jsonText);
        } catch {
          const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
          const cleaned = fenceMatch ? fenceMatch[1].trim() : jsonText.trim();
          presetSpec = JSON.parse(cleaned);
        }

        // Validate and fix
        const validation = validateAndFixPresetSpec(presetSpec);
        if (validation.errors.length > 0) {
          console.warn(`[${provider.name}] Validation issues:`, validation.errors);
        }
        const finalSpec = validation.fixedSpec || presetSpec;

        // Append provider name to preset name for identification
        if (finalSpec.name) {
          finalSpec.name = `${finalSpec.name} (${provider.name})`;
          // Enforce 32 char limit
          if (finalSpec.name.length > 32) {
            finalSpec.name = finalSpec.name.slice(0, 32);
          }
        }

        // Build the .hlx file
        const hlxFile = buildHlxFile(finalSpec);
        const summary = summarizePreset(finalSpec);

        const warnings =
          validation.errors.length > 0
            ? `\n\n**Auto-corrections applied:**\n${validation.errors.map((e) => `- ${e}`).join("\n")}`
            : "";

        return {
          providerId,
          providerName: provider.name,
          preset: hlxFile,
          summary: summary + warnings,
          spec: finalSpec,
        };
      }),
    );

    // Collect results
    const results: ProviderResult[] = settled.map((result, i) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      const providerId = providerIds[i];
      const provider = PROVIDERS[providerId];
      const errorMsg =
        result.reason instanceof Error ? result.reason.message : "Unknown error";
      console.error(`[${provider.name}] Generation failed:`, errorMsg);
      return {
        providerId,
        providerName: provider.name,
        error: errorMsg,
      };
    });

    // Backwards compatibility: if single provider, also return flat fields
    if (providerIds.length === 1 && results[0] && !results[0].error) {
      return NextResponse.json({
        ...results[0],
        results,
      });
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
