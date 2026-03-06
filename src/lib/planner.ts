// src/lib/planner.ts
// Claude Planner module — generates ToneIntents via structured output.
// The Planner makes creative choices only (amp, cab, effects, snapshots).
// All numeric parameters are handled by the Knowledge Layer (Phase 2).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getToneIntentSchema, getModelListForPrompt, VARIAX_MODEL_NAMES, getCapabilities } from "@/lib/helix";
import type { ToneIntent, DeviceTarget, DeviceFamily } from "@/lib/helix";
import { logUsage, estimateClaudeCost } from "@/lib/usage-logger";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";

/**
 * Call Claude Planner to generate a ToneIntent from conversation history.
 *
 * Uses structured output (output_config with zodOutputFormat) so Claude's
 * constrained decoding guarantees valid JSON matching the family-specific ToneIntent schema.
 * Belt-and-suspenders: Zod validates the response after parsing to catch
 * any constraints that JSON Schema cannot express (min/max/minItems).
 *
 * @param device - Optional device target for device-specific model filtering (PGMOD-04)
 * @param toneContext - Optional rig emulation context string appended to user message only.
 *   Appended to the USER message (not the system prompt) to preserve prompt caching.
 *   The system prompt hash is unchanged; cache_control: ephemeral remains effective.
 */
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
  family?: DeviceFamily,
  toneContext?: string,
): Promise<ToneIntent> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY environment variable is required");

  const client = new Anthropic({ apiKey });
  const effectiveDevice = device ?? "helix_lt";
  const caps = getCapabilities(effectiveDevice);
  const modelList = getModelListForPrompt(caps);
  const systemPrompt = getFamilyPlannerPrompt(effectiveDevice, modelList);

  // Concatenate conversation history into a single user message
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Append rig context to user message content only — NOT the system prompt.
  // This preserves prompt caching: the system prompt hash is unchanged because
  // getFamilyPlannerPrompt() is called with the same arguments regardless of toneContext.
  const userContent = toneContext
    ? `${conversationText}\n\n---\n\n${toneContext}`
    : conversationText;

  // Stomp cache unification: device-specific restriction goes in user message
  // so helix_stomp and helix_stomp_xl share a single system prompt cache entry.
  // The system prompt uses conservative values (6 blocks, 3 snapshots) as reference;
  // this restriction overrides with exact per-device values.
  const resolvedFamily = family ?? "helix";
  let stompRestriction = "";
  if (resolvedFamily === "stomp") {
    const isXL = effectiveDevice === "helix_stomp_xl";
    const deviceLabel = isXL ? "HX Stomp XL" : "HX Stomp";
    const blocks = isXL ? 9 : 6;
    const snaps = isXL ? 4 : 3;
    const maxFx = isXL ? 6 : 4;
    stompRestriction = `\n\nDEVICE RESTRICTION: This is an ${deviceLabel} preset. ${deviceLabel} is a single-DSP, series-only device. Do NOT populate secondAmpName or secondCabName. Generate exactly ${snaps} snapshots (not ${snaps === 3 ? "4" : "3"}, not 8). Keep effects to ${maxFx} maximum — ${deviceLabel} has ${blocks} block slots total (including amp + cab).`;
  }
  const finalUserContent = userContent + stompRestriction;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const, ttl: "1h" },
      },
    ],
    messages: [{ role: "user", content: finalUserContent }],
    output_config: {
      format: zodOutputFormat(getToneIntentSchema(family ?? "helix")),
    },
  });

  // Token usage logging (AUDIT-01)
  const { usage } = response;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd = estimateClaudeCost(usage);
  const cacheHit = cacheRead > 0;

  // Always log to console — Vercel captures this in function logs
  console.log(
    `[planner] tokens=${usage.input_tokens}in/${usage.output_tokens}out` +
    ` cache=${cacheHit ? "HIT" : "MISS"}(read=${cacheRead},write=${cacheWrite})` +
    ` cost=$${costUsd.toFixed(4)} device=${effectiveDevice}`
  );

  logUsage({
    timestamp: new Date().toISOString(),
    endpoint: "generate",
    model: "claude-sonnet-4-6",
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    cache_creation_input_tokens: cacheWrite || null,
    cache_read_input_tokens: cacheRead || null,
    total_tokens: usage.input_tokens + usage.output_tokens,
    cost_usd: costUsd,
    cache_hit: cacheHit,
    device: effectiveDevice,
  });

  // Extract text from response content
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }

  // Sanitize before Zod validation.
  // zodOutputFormat strips min/max constraints from JSON Schema, so Claude's
  // constrained decoding does NOT enforce string length limits. We truncate
  // snapshot names here to avoid Zod rejecting valid-intent-but-too-long names
  // (e.g., "CLEAN CHIME" → "CLEAN CHIM", "AMBIENT PAD" → "AMBIENT PA").
  const raw = JSON.parse(textBlock.text);
  if (Array.isArray(raw.snapshots)) {
    raw.snapshots = raw.snapshots.map((s: { name?: string; toneRole?: string }) => ({
      ...s,
      name: typeof s.name === "string" ? s.name.slice(0, 10) : s.name,
    }));
  }

  // Strip invalid variaxModel before Zod validation — Claude occasionally
  // hallucinates model names (e.g., "Strat" instead of "Spank")
  if (raw.variaxModel && !VARIAX_MODEL_NAMES.includes(raw.variaxModel)) {
    delete raw.variaxModel;
  }

  // Belt-and-suspenders: Zod validates all remaining constraints
  return getToneIntentSchema(family ?? "helix").parse(raw);
}
