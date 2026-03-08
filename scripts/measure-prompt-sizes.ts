// scripts/measure-prompt-sizes.ts
// Diagnostic script: measures estimated token counts for all device family planner prompts.
//
// Uses character-based estimation (~4 chars per token) since this is a diagnostic tool.
// It is a manual diagnostic tool — do NOT include in automated test suites.
//
// Usage:
//   npx tsx scripts/measure-prompt-sizes.ts

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

// Gemini prompt caching minimum token threshold
const CACHE_MIN_TOKENS = 2048;

// Rough token estimation: ~4 characters per token (standard approximation)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Measuring planner prompt token counts (character-based estimation)...");
  console.log(`Cache threshold: ${CACHE_MIN_TOKENS} tokens`);
  console.log("");

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

    const chars = systemPrompt.length;
    const tokens = estimateTokens(systemPrompt);
    const belowThreshold = tokens < CACHE_MIN_TOKENS;

    results.push({ device, tokens, chars, promptText: systemPrompt, belowThreshold });

    const flag = belowThreshold ? " *** BELOW CACHE THRESHOLD ***" : "";
    console.log(`${device}: ~${tokens} tokens (${chars} chars)${flag}`);
  }

  // ---------------------------------------------------------------------------
  // Summary table
  // ---------------------------------------------------------------------------
  console.log("\n=== Prompt Token Summary (estimated) ===");
  console.log(
    `${"Device".padEnd(20)} ${"~Tokens".padStart(8)} ${"Chars".padStart(8)} ${"Cacheable?".padStart(12)}`,
  );
  console.log("-".repeat(52));

  for (const { device, tokens, chars, belowThreshold } of results) {
    const cacheStatus = belowThreshold ? "NO (too small)" : "YES";
    console.log(
      `${device.padEnd(20)} ${String(tokens).padStart(8)} ${String(chars).padStart(8)} ${cacheStatus.padStart(12)}`,
    );
  }

  const belowThresholdDevices = results.filter((r) => r.belowThreshold);
  if (belowThresholdDevices.length > 0) {
    console.log(
      "\n*** WARNING: The following devices are below the estimated cache minimum:",
    );
    for (const { device, tokens } of belowThresholdDevices) {
      console.log(
        `  - ${device}: ~${tokens} tokens (${CACHE_MIN_TOKENS - tokens} tokens short)`,
      );
    }
  } else {
    console.log(
      `\nAll ${results.length} device families exceed the ${CACHE_MIN_TOKENS}-token cache threshold (estimated).`,
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
