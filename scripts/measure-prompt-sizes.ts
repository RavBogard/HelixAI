// scripts/measure-prompt-sizes.ts
// Diagnostic script: measures actual token counts for all five device family planner prompts.
//
// This script calls Anthropic's countTokens endpoint (free, no generation charge).
// It is a manual diagnostic tool — do NOT include in automated test suites.
//
// Usage:
//   CLAUDE_API_KEY=sk-ant-xxx npx tsx scripts/measure-prompt-sizes.ts
//
// Purpose:
//   - Confirm all families exceed the 2,048-token caching minimum for Sonnet 4.6
//   - Diagnose whether Stomp variants share identical prompt text (cache unification)
//   - Report character and token counts per family for prompt size auditing

import Anthropic from "@anthropic-ai/sdk";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";
import { getCapabilities, getModelListForPrompt } from "@/lib/helix";
import type { DeviceTarget } from "@/lib/helix";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEVICE_TARGETS: DeviceTarget[] = [
  "helix_lt",
  "helix_stomp",
  "helix_stomp_xl",
  "pod_go",
  "helix_stadium",
];

const MODEL = "claude-sonnet-4-6";

// Claude prompt caching minimum token threshold for Sonnet 4.6
const CACHE_MIN_TOKENS = 2048;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Validate API key before making any calls
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: CLAUDE_API_KEY environment variable is required.\n" +
        "Usage: CLAUDE_API_KEY=sk-ant-xxx npx tsx scripts/measure-prompt-sizes.ts",
    );
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log("Measuring planner prompt token counts via countTokens API...");
  console.log(`Model: ${MODEL}`);
  console.log(`Cache threshold: ${CACHE_MIN_TOKENS} tokens`);
  console.log("");

  // Collect results for summary table
  const results: Array<{
    device: DeviceTarget;
    tokens: number;
    chars: number;
    promptText: string;
    belowThreshold: boolean;
  }> = [];

  for (const device of DEVICE_TARGETS) {
    const caps = getCapabilities(device);
    const modelList = getModelListForPrompt(caps);
    const systemPrompt = getFamilyPlannerPrompt(device, modelList);

    // Call countTokens with cache_control block matching planner.ts setup (ttl: "1h")
    const countResult = await client.messages.countTokens({
      model: MODEL,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [
        {
          role: "user",
          content: "Measure tokens only.",
        },
      ],
    });

    const tokens = countResult.input_tokens;
    const chars = systemPrompt.length;
    const belowThreshold = tokens < CACHE_MIN_TOKENS;

    results.push({ device, tokens, chars, promptText: systemPrompt, belowThreshold });

    const flag = belowThreshold ? " *** BELOW CACHE THRESHOLD ***" : "";
    console.log(`${device}: ${tokens} tokens (${chars} chars)${flag}`);
  }

  // ---------------------------------------------------------------------------
  // Summary table
  // ---------------------------------------------------------------------------
  console.log("\n=== Prompt Token Summary ===");
  console.log(
    `${"Device".padEnd(20)} ${"Tokens".padStart(8)} ${"Chars".padStart(8)} ${"Cacheable?".padStart(12)}`,
  );
  console.log("-".repeat(52));

  for (const { device, tokens, chars, belowThreshold } of results) {
    const cacheStatus = belowThreshold ? "NO (too small)" : "YES";
    console.log(
      `${device.padEnd(20)} ${String(tokens).padStart(8)} ${String(chars).padStart(8)} ${cacheStatus.padStart(12)}`,
    );
  }

  // Flag any device below the cache threshold
  const belowThresholdDevices = results.filter((r) => r.belowThreshold);
  if (belowThresholdDevices.length > 0) {
    console.log(
      "\n*** WARNING: The following devices are below the 2,048-token cache minimum:",
    );
    for (const { device, tokens } of belowThresholdDevices) {
      console.log(
        `  - ${device}: ${tokens} tokens (${CACHE_MIN_TOKENS - tokens} tokens short)`,
      );
    }
    console.log(
      "  These devices will NOT benefit from prompt caching." +
        " Consider adding content or using a shared prompt bucket.",
    );
  } else {
    console.log(
      `\nAll ${results.length} device families exceed the ${CACHE_MIN_TOKENS}-token cache threshold.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Stomp variant unification diagnostic
  // ---------------------------------------------------------------------------
  const stompResult = results.find((r) => r.device === "helix_stomp");
  const stompXlResult = results.find((r) => r.device === "helix_stomp_xl");

  if (stompResult && stompXlResult) {
    const identical = stompResult.promptText === stompXlResult.promptText;
    console.log("\n=== Stomp Variant Cache Unification Diagnostic ===");
    if (identical) {
      console.log("helix_stomp and helix_stomp_xl produce IDENTICAL prompt text.");
      console.log(
        "Both variants share a single cache entry — optimal cache economics.",
      );
    } else {
      console.log("helix_stomp and helix_stomp_xl produce DIFFERENT prompt text.");
      console.log("Each variant has its own cache entry.");
      const a = stompResult.promptText;
      const b = stompXlResult.promptText;
      for (let i = 0; i < Math.min(a.length, b.length); i++) {
        if (a[i] !== b[i]) {
          const ctx = 80;
          console.log(`  First difference at char index ${i}:`);
          console.log(`  stomp:    ...${a.slice(Math.max(0, i - 20), i + ctx)}...`);
          console.log(`  stomp_xl: ...${b.slice(Math.max(0, i - 20), i + ctx)}...`);
          break;
        }
      }
    }
  }
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
