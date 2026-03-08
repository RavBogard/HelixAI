import { GoogleGenAI } from "@google/genai";

// Model tiers
const MODEL_STANDARD = "gemini-3-flash-preview";
const MODEL_PREMIUM = "gemini-3.1-pro-preview";

export function getModelId(premium: boolean): string {
  return premium ? MODEL_PREMIUM : MODEL_STANDARD;
}

/** Verify the premium key against the server-side secret. */
export function isPremiumKey(key: string | undefined | null): boolean {
  if (!key) return false;
  const secret = process.env.PREMIUM_SECRET;
  if (!secret) return false;
  return key === secret;
}

export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({ apiKey });
}
