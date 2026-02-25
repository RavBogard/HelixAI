import { NextRequest } from "next/server";
import { createGeminiClient, getSystemPrompt, getModelId, isPremiumKey } from "@/lib/gemini";

export async function POST(req: NextRequest) {
  const { messages, premiumKey } = await req.json();
  const premium = isPremiumKey(premiumKey);

  const ai = createGeminiClient();
  const modelId = getModelId(premium);

  // Convert our message format to Gemini's format
  const history = messages.slice(0, -1).map((msg: { role: string; content: string }) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const lastMessage = messages[messages.length - 1];

  const chat = ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: getSystemPrompt(),
      tools: [{ googleSearch: {} }],
    },
    history,
  });

  // Use streaming for the response
  const stream = await chat.sendMessageStream({
    message: lastMessage.content,
  });

  // Create a ReadableStream that sends chunks as SSE
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
