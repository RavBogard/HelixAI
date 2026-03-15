import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || "",
});

const AdjustSchema = z.object({
  parameters: z.record(z.string(), z.union([z.number(), z.boolean()])),
  explanation: z.string().describe("A brief, one sentence explanation of the changes made."),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { prompt, blockData, presetData } = await req.json();

    if (!prompt || !blockData) {
      return NextResponse.json({ error: "Missing prompt or block data" }, { status: 400 });
    }

    // Isolate the block context
    const blockContext = `
      Target Block Model: ${blockData.modelName} (${blockData.type})
      Current Parameters:
      ${JSON.stringify(blockData.parameters, null, 2)}
    `;

    const systemPrompt = `
      You are an expert audio engineer and Line 6 Helix programmer.
      The user wants to adjust a specific block in their signal chain.
      Review their request and provide updated parameter values for the TARGET BLOCK ONLY.
      
      Only return parameters that actually need to change to fulfill the user's request.
      Do not change parameters unless the user requested a change that affects them.
      Return the values in the exact same format (number or boolean) as they appear in the Current Parameters block.
      
      User Request: "${prompt}"
      
      Block Context:
      ${blockContext}
    `;

    const result = await generateObject({
      model: google("gemini-2.5-flash-8b"),
      schema: AdjustSchema,
      prompt: systemPrompt,
      temperature: 0.1, // Keep it deterministic
    });

    return NextResponse.json({
      parameters: result.object.parameters,
      explanation: result.object.explanation,
    });

  } catch (error) {
    console.error("Chat adjustment error:", error);
    return NextResponse.json({ error: "Failed to process adjustment" }, { status: 500 });
  }
}
