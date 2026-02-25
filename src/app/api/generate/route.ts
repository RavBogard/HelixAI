import { NextRequest, NextResponse } from "next/server";
import { createGeminiClient, getPresetGenerationPrompt, MODEL_ID } from "@/lib/gemini";
import { buildHlxFile, summarizePreset } from "@/lib/helix";
import type { PresetSpec } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    const ai = createGeminiClient();

    // Build the full conversation context for the generation call
    const conversationContext = messages
      .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const response = await ai.models.generateContent({
      model: MODEL_ID,
      contents: `Based on the following conversation, generate the Helix LT preset specification:\n\n${conversationContext}`,
      config: {
        systemInstruction: getPresetGenerationPrompt(),
        responseMimeType: "application/json",
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

    // Build the .hlx file
    const hlxFile = buildHlxFile(presetSpec);

    // Generate summary
    const summary = summarizePreset(presetSpec);

    return NextResponse.json({
      preset: hlxFile,
      summary,
      spec: presetSpec,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
