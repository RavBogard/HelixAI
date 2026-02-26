import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ═══════════════════════════════════════════════════
// AI Provider Abstraction Layer
//
// Each provider takes the same system prompt + conversation
// and returns raw JSON text representing a PresetSpec.
// ═══════════════════════════════════════════════════

export interface ProviderConfig {
  id: string;
  name: string;
  model: string;
  color: string; // CSS color for UI badges/LEDs
  envKey: string; // environment variable name for API key
}

export const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: {
    id: "gemini",
    name: "Gemini",
    model: "gemini-3.1-pro-preview",
    color: "#4285f4",
    envKey: "GEMINI_API_KEY",
  },
  claude: {
    id: "claude",
    name: "Claude",
    model: "claude-opus-4-6",
    color: "#d4a27f",
    envKey: "CLAUDE_API_KEY",
  },
  openai: {
    id: "openai",
    name: "GPT",
    model: "gpt-5.2-pro",
    color: "#10a37f",
    envKey: "OPENAI_API_KEY",
  },
};

/** Check which providers have API keys configured. */
export function getAvailableProviders(): ProviderConfig[] {
  return Object.values(PROVIDERS).filter((p) => !!process.env[p.envKey]);
}

/** Generate preset JSON text using the specified provider. */
export async function generateWithProvider(
  providerId: string,
  conversationText: string,
  systemPrompt: string,
): Promise<string> {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  const apiKey = process.env[provider.envKey];
  if (!apiKey) throw new Error(`${provider.envKey} environment variable is required`);

  switch (providerId) {
    case "gemini":
      return generateGemini(apiKey, provider.model, conversationText, systemPrompt);
    case "claude":
      return generateClaude(apiKey, provider.model, conversationText, systemPrompt);
    case "openai":
      return generateOpenAI(apiKey, provider.model, conversationText, systemPrompt);
    default:
      throw new Error(`No implementation for provider: ${providerId}`);
  }
}

// ─── Gemini ───

async function generateGemini(
  apiKey: string,
  model: string,
  conversationText: string,
  systemPrompt: string,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: `Based on the following conversation, generate the Helix LT preset specification:\n\n${conversationText}`,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      temperature: 0.3,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Gemini");
  return text;
}

// ─── Claude ───

async function generateClaude(
  apiKey: string,
  model: string,
  conversationText: string,
  systemPrompt: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model,
    max_tokens: 16384,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Based on the following conversation, generate the Helix LT preset specification:\n\n${conversationText}`,
      },
    ],
    temperature: 0.3,
  });

  // Extract text from the response content blocks
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from Claude");
  }

  return textBlock.text;
}

// ─── OpenAI ───

async function generateOpenAI(
  apiKey: string,
  model: string,
  conversationText: string,
  systemPrompt: string,
): Promise<string> {
  const client = new OpenAI({ apiKey });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Based on the following conversation, generate the Helix LT preset specification:\n\n${conversationText}`,
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });

  const text = completion.choices[0]?.message?.content;
  if (!text) throw new Error("No response from OpenAI");
  return text;
}
