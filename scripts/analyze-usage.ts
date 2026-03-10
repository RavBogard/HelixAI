// scripts/analyze-usage.ts
// Cost analysis script — reads usage.jsonl and reports per-endpoint/per-device/cache breakdowns.
// Run: npx tsx scripts/analyze-usage.ts

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

interface UsageRecord {
  timestamp: string;
  endpoint: "generate" | "chat";
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  total_tokens: number;
  cost_usd: number;
  cache_hit: boolean;
  device?: string;
}

const GEMINI_FLASH_INPUT_PER_MTOK = 0.3;
const GEMINI_FLASH_CACHE_READ_PER_MTOK = 0.03;

async function main() {
  const filePath = path.resolve(process.cwd(), "usage.jsonl");

  if (!fs.existsSync(filePath)) {
    console.log("No usage.jsonl found. Set LOG_USAGE=true to start logging.");
    return;
  }

  const records: UsageRecord[] = [];

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, "utf-8"),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed) as UsageRecord);
    } catch {
      // skip malformed lines
    }
  }

  if (records.length === 0) {
    console.log("usage.jsonl is empty — no records to analyze.");
    return;
  }

  // --- Overall summary ---
  const totalCost = records.reduce((sum, r) => sum + r.cost_usd, 0);
  const avgCost = totalCost / records.length;

  console.log("════════════════════════════════════════");
  console.log("  USAGE ANALYSIS");
  console.log("════════════════════════════════════════");
  console.log(`  Total calls:      ${records.length}`);
  console.log(`  Total cost:       $${totalCost.toFixed(4)}`);
  console.log(`  Avg cost/call:    $${avgCost.toFixed(6)}`);
  console.log();

  // --- Per-endpoint breakdown ---
  const byEndpoint = new Map<string, { count: number; cost: number }>();
  for (const r of records) {
    const entry = byEndpoint.get(r.endpoint) ?? { count: 0, cost: 0 };
    entry.count++;
    entry.cost += r.cost_usd;
    byEndpoint.set(r.endpoint, entry);
  }

  console.log("── By Endpoint ─────────────────────────");
  for (const [endpoint, data] of byEndpoint) {
    console.log(`  ${endpoint.padEnd(12)} ${String(data.count).padStart(6)} calls  $${data.cost.toFixed(4).padStart(10)}  avg $${(data.cost / data.count).toFixed(6)}`);
  }
  console.log();

  // --- Per-device breakdown ---
  const byDevice = new Map<string, { count: number; cost: number }>();
  for (const r of records) {
    const device = r.device ?? "unknown";
    const entry = byDevice.get(device) ?? { count: 0, cost: 0 };
    entry.count++;
    entry.cost += r.cost_usd;
    byDevice.set(device, entry);
  }

  console.log("── By Device ───────────────────────────");
  for (const [device, data] of byDevice) {
    console.log(`  ${device.padEnd(20)} ${String(data.count).padStart(6)} calls  $${data.cost.toFixed(4).padStart(10)}`);
  }
  console.log();

  // --- Cache statistics ---
  const cacheHits = records.filter((r) => r.cache_hit).length;
  const cacheMisses = records.length - cacheHits;
  const hitRate = (cacheHits / records.length) * 100;

  const totalCachedTokens = records.reduce(
    (sum, r) => sum + (r.cache_read_input_tokens ?? 0),
    0,
  );
  // Savings = what those cached tokens would have cost at full input price vs cache read price
  const MTok = 1_000_000;
  const fullInputCost = (totalCachedTokens / MTok) * GEMINI_FLASH_INPUT_PER_MTOK;
  const cacheReadCost = (totalCachedTokens / MTok) * GEMINI_FLASH_CACHE_READ_PER_MTOK;
  const cacheSavings = fullInputCost - cacheReadCost;

  console.log("── Cache Statistics ─────────────────────");
  console.log(`  Cache hits:       ${cacheHits}`);
  console.log(`  Cache misses:     ${cacheMisses}`);
  console.log(`  Hit rate:         ${hitRate.toFixed(1)}%`);
  console.log(`  Cached tokens:    ${totalCachedTokens.toLocaleString()}`);
  console.log(`  Cache savings:    $${cacheSavings.toFixed(4)}`);
  console.log("════════════════════════════════════════");
}

main().catch(console.error);
