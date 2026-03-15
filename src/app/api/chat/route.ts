import { NextRequest } from "next/server";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createGeminiClient, getModelId, isPremiumKey } from "@/lib/gemini";
import { getFamilyChatPrompt } from "@/lib/prompt-router";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logUsage, estimateGeminiCost } from "@/lib/usage-logger";
import type { DeviceTarget } from "@/lib/helix";

// Phase 5: EDOS Prevention & Validation
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().max(3000, "Message content exceeds maximum allowed length of 3000 characters")
  })).min(1, "At least one message is required").max(30, "Maximum of 30 messages allowed in context window"),
  device: z.string().optional(),
  premiumKey: z.string().optional(),
  conversationId: z.string().optional()
});

// Configure Rate Limiter (Gracefully falls back if no Upstash credentials exist)
const ratelimit = (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, "1 h"), // 20 req max per hour per IP/User
      analytics: true,
    })
  : null;

export async function POST(req: NextRequest) {
  try {
    const jsonBody = await req.json();

    // strict payload validation
    const parsedBody = chatRequestSchema.safeParse(jsonBody);
    if (!parsedBody.success) {
      return new Response(JSON.stringify({ error: "Invalid payload", details: parsedBody.error.format() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = parsedBody.data;
    const { messages, premiumKey, conversationId } = body;

    // Rate Limiting execution
    if (ratelimit) {
      const identifier = conversationId ?? req.headers.get("x-forwarded-for") ?? "anonymous_session";
      const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
      
      if (!success) {
        return new Response(JSON.stringify({ 
          error: "Rate limit exceeded. Please try again later or upgrade to a premium key.",
          limit, remaining, reset 
        }), {
          status: 429,
          headers: { 
            "Content-Type": "application/json",
            "X-RateLimit-Limit": limit.toString(),
            "X-RateLimit-Remaining": remaining.toString(),
            "X-RateLimit-Reset": reset.toString()
          },
        });
      }
    }

  const device: DeviceTarget = (body.device as DeviceTarget) ?? "helix_lt";
  const premium = isPremiumKey(premiumKey);

  // --- Persistence: save user message BEFORE streaming ---
  let userId: string | null = null;
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>> | null = null;

  if (conversationId) {
    supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "user") {
        // Verify conversation ownership — defense-in-depth (STATE.md locked decision)
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .eq("user_id", userId)
          .single();

        if (conv) {
          // Server-side sequence number assignment (STATE.md locked decision)
          const { data: maxSeq } = await supabase
            .from("messages")
            .select("sequence_number")
            .eq("conversation_id", conversationId)
            .order("sequence_number", { ascending: false })
            .limit(1)
            .single();

          const nextSeq = (maxSeq?.sequence_number ?? 0) + 1;

          await supabase.from("messages").insert({
            conversation_id: conversationId,
            role: "user",
            content: lastMsg.content,
            sequence_number: nextSeq,
          });

          // Update conversations.updated_at for correct list ordering
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
            .eq("user_id", userId);
        }
      }
    }
  }
  // --- End persistence pre-stream ---

  const ai = createGeminiClient();
  const modelId = getModelId(premium);

  // Window chat history to bound input tokens on long sessions.
  const MAX_CHAT_HISTORY = 20;
  const trimmedMessages =
    messages.length > MAX_CHAT_HISTORY + 1
      ? messages.slice(-(MAX_CHAT_HISTORY + 1))
      : messages;

  // Convert our message format to Gemini's format
  const history = trimmedMessages.slice(0, -1).map((msg: { role: string; content: string }) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const lastMessage = trimmedMessages[trimmedMessages.length - 1];

  const chat = ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: getFamilyChatPrompt(device),
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
      let fullContent = "";
      let finalUsage: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number; totalTokenCount?: number } | undefined;
      try {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            fullContent += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          if (chunk.usageMetadata) { finalUsage = chunk.usageMetadata; }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        // Token usage logging (AUDIT-01)
        if (finalUsage) {
          logUsage({
            timestamp: new Date().toISOString(),
            endpoint: "chat",
            model: modelId,
            input_tokens: finalUsage.promptTokenCount ?? 0,
            output_tokens: finalUsage.candidatesTokenCount ?? 0,
            cache_creation_input_tokens: null,
            cache_read_input_tokens: finalUsage.cachedContentTokenCount ?? null,
            total_tokens: finalUsage.totalTokenCount ?? 0,
            cost_usd: estimateGeminiCost(finalUsage, modelId),
            cache_hit: (finalUsage.cachedContentTokenCount ?? 0) > 0,
            device,
          });
        }

        // --- Persistence: save assistant message AFTER stream closes ---
        if (conversationId && userId && supabase && fullContent) {
          const { data: maxSeq } = await supabase
            .from("messages")
            .select("sequence_number")
            .eq("conversation_id", conversationId)
            .order("sequence_number", { ascending: false })
            .limit(1)
            .single();

          supabase
            .from("messages")
            .insert({
              conversation_id: conversationId,
              role: "assistant",
              content: fullContent,
              sequence_number: (maxSeq?.sequence_number ?? 0) + 1,
            })
            .then(({ error }) => {
              if (error) console.error("Failed to save assistant message:", error.message);
            });
        }
        // --- End persistence post-stream ---

      } catch (error) {
        console.error("Stream processing error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "An unexpected error occurred during chat processing." })}\n\n`));
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
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
