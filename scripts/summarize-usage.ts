// scripts/summarize-usage.ts
// Reads usage.jsonl from cwd and prints a summary report of token usage and costs.
//
// Run with: npx tsx scripts/summarize-usage.ts
//
// No external dependencies — uses only Node.js built-ins.

import * as fs from "fs";
import * as path from "path";

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
}

interface EndpointStats {
  count: number;
  input_tokens_sum: number;
  output_tokens_sum: number;
  cached_tokens_sum: number;
  total_tokens_sum: number;
  cost_sum: number;
  cache_hits: number;
}

function createStats(): EndpointStats {
  return {
    count: 0,
    input_tokens_sum: 0,
    output_tokens_sum: 0,
    cached_tokens_sum: 0,
    total_tokens_sum: 0,
    cost_sum: 0,
    cache_hits: 0,
  };
}

function avg(sum: number, count: number): number {
  return count === 0 ? 0 : sum / count;
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function main(): void {
  const logPath = path.resolve(process.cwd(), "usage.jsonl");

  if (!fs.existsSync(logPath)) {
    console.log("No usage.jsonl found in current directory.");
    console.log("Set LOG_USAGE=true and make some API calls to generate data.");
    process.exit(0);
  }

  const content = fs.readFileSync(logPath, "utf-8");
  const lines = content.trim().split("\n").filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    console.log("usage.jsonl exists but contains no records.");
    process.exit(0);
  }

  const statsByEndpoint: Record<string, EndpointStats> = {};
  let parseErrors = 0;

  for (const line of lines) {
    try {
      const record = JSON.parse(line) as UsageRecord;
      const key = record.endpoint ?? "unknown";
      if (!statsByEndpoint[key]) {
        statsByEndpoint[key] = createStats();
      }
      const s = statsByEndpoint[key];
      s.count += 1;
      s.input_tokens_sum += record.input_tokens ?? 0;
      s.output_tokens_sum += record.output_tokens ?? 0;
      s.cached_tokens_sum += record.cache_read_input_tokens ?? 0;
      s.total_tokens_sum += record.total_tokens ?? 0;
      s.cost_sum += record.cost_usd ?? 0;
      if (record.cache_hit) s.cache_hits += 1;
    } catch {
      parseErrors += 1;
    }
  }

  const totalRecords = lines.length - parseErrors;
  const totalCost = Object.values(statsByEndpoint).reduce((sum, s) => sum + s.cost_sum, 0);

  console.log("=".repeat(60));
  console.log("  HelixAI Token Usage Summary");
  console.log("=".repeat(60));
  console.log(`  Log file: ${logPath}`);
  console.log(`  Total records: ${totalRecords}${parseErrors > 0 ? ` (${parseErrors} parse errors)` : ""}`);
  console.log();

  const endpoints = Object.keys(statsByEndpoint).sort();

  for (const endpoint of endpoints) {
    const s = statsByEndpoint[endpoint];
    const hitRate = s.count === 0 ? 0 : (s.cache_hits / s.count) * 100;

    console.log(`  Endpoint: ${endpoint}`);
    console.log(`  ${"─".repeat(50)}`);
    console.log(`  Calls:                  ${s.count}`);
    console.log(`  Avg input tokens:       ${fmt(avg(s.input_tokens_sum, s.count), 1)}`);
    console.log(`  Avg output tokens:      ${fmt(avg(s.output_tokens_sum, s.count), 1)}`);
    console.log(`  Avg cached tokens:      ${fmt(avg(s.cached_tokens_sum, s.count), 1)}`);
    console.log(`  Avg total tokens:       ${fmt(avg(s.total_tokens_sum, s.count), 1)}`);
    console.log(`  Avg cost per call:      $${fmt(avg(s.cost_sum, s.count), 6)}`);
    console.log(`  Cache hit rate:         ${fmt(hitRate, 1)}%`);
    console.log(`  Total cost:             $${fmt(s.cost_sum, 6)}`);
    console.log();
  }

  console.log("=".repeat(60));
  console.log(`  TOTAL COST (all calls):  $${fmt(totalCost, 6)}`);
  console.log("=".repeat(60));
}

main();
