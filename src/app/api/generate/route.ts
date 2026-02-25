import { NextRequest, NextResponse } from "next/server";
import { createGeminiClient, getPresetGenerationPrompt, getModelId, isPremiumKey } from "@/lib/gemini";
import { buildHlxFile, summarizePreset, validateAndFixPresetSpec } from "@/lib/helix";
import type { PresetSpec } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const { messages, premiumKey } = await req.json();
    const premium = isPremiumKey(premiumKey);

    const ai = createGeminiClient();
    const modelId = getModelId(premium);

    // Build the full conversation context for the generation call
    const conversationContext = messages
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Based on the following conversation, generate the Helix LT preset specification:\n\n${conversationContext}`,
      config: {
        systemInstruction: getPresetGenerationPrompt(),
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    });

    const jsonText = response.text;
    if (!jsonText) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse the preset spec
    let presetSpec: PresetSpec;
    try {
      presetSpec = JSON.parse(jsonText);
    } catch {
      // Sometimes the model wraps JSON in markdown code blocks
      const cleaned = jsonText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      presetSpec = JSON.parse(cleaned);
    }

    // Validate and fix the AI's output — catches hallucinated model IDs and wrong block references
    const validation = validateAndFixPresetSpec(presetSpec);
    if (validation.errors.length > 0) {
      console.warn("Preset validation issues:", validation.errors);
    }
    const finalSpec = validation.fixedSpec || presetSpec;

    // Build the .hlx file
    const hlxFile = buildHlxFile(finalSpec);

    // Generate summary
    const summary = summarizePreset(finalSpec);

    // Include validation warnings in the response
    const warnings = validation.errors.length > 0
      ? `\n\n**Auto-corrections applied:**\n${validation.errors.map(e => `- ${e}`).join("\n")}`
      : "";

    return NextResponse.json({
      preset: hlxFile,
      summary: summary + warnings,
      spec: finalSpec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
