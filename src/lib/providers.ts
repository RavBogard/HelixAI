// ═══════════════════════════════════════════════════
// AI Provider Configuration
//
// Provider metadata for UI display and availability checks.
// Generation logic has moved to src/lib/planner.ts (Claude Planner)
// and the Knowledge Layer pipeline (src/lib/helix/).
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
