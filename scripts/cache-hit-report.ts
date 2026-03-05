// scripts/cache-hit-report.ts
// Cache hit rate analysis script.
// Reads usage.jsonl, calculates cache hit statistics, and prints a formatted report.
//
// Usage:
//   npx tsx scripts/cache-hit-report.ts          # reads usage.jsonl from cwd
//   import { parseCacheReport, getRecommendation, formatReport } from "./cache-hit-report"

import * as fs from "fs";
import * as path from "path";
import type { PlannerUsageRecord } from "@/lib/usage-logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheReportStats {
  totalCalls: number;
  cacheHits: number;
  coldStarts: number;
  hitRate: number;
  avgInputTokensCold: number;
  avgInputTokensCached: number;
  avgOutputTokens: number;
  avgCostCold: number;
  avgCostCached: number;
  totalCost: number;
  totalSavings: number;
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/**
 * Parse usage records and compute cache hit statistics.
 * Filters for `endpoint === "generate"` records only (cache is on Claude planner).
 * Handles empty input gracefully (returns all zeros).
 */
export function parseCacheReport(records: PlannerUsageRecord[]): CacheReportStats {
  // Filter to generate-only records
  const generateRecords = records.filter((r) => r.endpoint === "generate");

  if (generateRecords.length === 0) {
    return {
      totalCalls: 0,
      cacheHits: 0,
      coldStarts: 0,
      hitRate: 0,
      avgInputTokensCold: 0,
      avgInputTokensCached: 0,
      avgOutputTokens: 0,
      avgCostCold: 0,
      avgCostCached: 0,
      totalCost: 0,
      totalSavings: 0,
    };
  }

  const cached = generateRecords.filter((r) => r.cache_hit);
  const cold = generateRecords.filter((r) => !r.cache_hit);

  const totalCalls = generateRecords.length;
  const cacheHits = cached.length;
  const coldStarts = cold.length;
  const hitRate = totalCalls > 0 ? cacheHits / totalCalls : 0;

  // Average input tokens
  const avgInputTokensCold =
    cold.length > 0
      ? cold.reduce((sum, r) => sum + r.input_tokens, 0) / cold.length
      : 0;
  const avgInputTokensCached =
    cached.length > 0
      ? cached.reduce((sum, r) => sum + r.input_tokens, 0) / cached.length
      : 0;

  // Average output tokens (across all)
  const avgOutputTokens =
    totalCalls > 0
      ? generateRecords.reduce((sum, r) => sum + r.output_tokens, 0) / totalCalls
      : 0;

  // Average cost
  const avgCostCold =
    cold.length > 0
      ? cold.reduce((sum, r) => sum + r.cost_usd, 0) / cold.length
      : 0;
  const avgCostCached =
    cached.length > 0
      ? cached.reduce((sum, r) => sum + r.cost_usd, 0) / cached.length
      : 0;

  // Total cost
  const totalCost = generateRecords.reduce((sum, r) => sum + r.cost_usd, 0);

  // Total savings: what it would have cost if all calls were cold, minus actual cost
  // "All cold" estimate = totalCalls * avgCostCold (uses actual cold call average as baseline)
  const allColdEstimate = cold.length > 0 ? totalCalls * avgCostCold : totalCost;
  const totalSavings = allColdEstimate - totalCost;

  return {
    totalCalls,
    cacheHits,
    coldStarts,
    hitRate,
    avgInputTokensCold,
    avgInputTokensCached,
    avgOutputTokens,
    avgCostCold,
    avgCostCached,
    totalCost,
    totalSavings,
  };
}

/**
 * Get a recommendation string based on cache hit rate.
 * >= 0.50: above threshold, no changes needed.
 * < 0.50: below threshold, investigate prompt variability.
 */
export function getRecommendation(hitRate: number): string {
  const pct = (hitRate * 100).toFixed(0);
  if (hitRate >= 0.50) {
    return `Cache hit rate ${pct}% is above the 50% threshold. No prompt structure changes needed.`;
  }
  return `Cache hit rate ${pct}% is below the 50% threshold. Investigate system prompt variability and consider restructuring prompts to maximize cache-eligible prefix content.`;
}

/**
 * Format cache report statistics into a human-readable string.
 */
export function formatReport(stats: CacheReportStats): string {
  const hitPct = (stats.hitRate * 100).toFixed(1);
  const coldPct = ((1 - stats.hitRate) * 100).toFixed(1);
  const recommendation = getRecommendation(stats.hitRate);

  return [
    `=== Cache Hit Rate Report (${stats.totalCalls} planner calls) ===`,
    `Total calls: ${stats.totalCalls}`,
    `Cache hits: ${stats.cacheHits} (${hitPct}%)`,
    `Cold starts: ${stats.coldStarts} (${coldPct}%)`,
    `Average input tokens (cold): ${Math.round(stats.avgInputTokensCold)}`,
    `Average input tokens (cached): ${Math.round(stats.avgInputTokensCached)}`,
    `Average output tokens: ${Math.round(stats.avgOutputTokens)}`,
    `Average cost/call (cold): $${stats.avgCostCold.toFixed(4)}`,
    `Average cost/call (cached): $${stats.avgCostCached.toFixed(4)}`,
    `Estimated savings from caching: $${stats.totalSavings.toFixed(4)}`,
    ``,
    `RECOMMENDATION: ${recommendation}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1]?.includes("cache-hit-report")) {
  const logPath = path.resolve(process.cwd(), "usage.jsonl");

  if (!fs.existsSync(logPath)) {
    console.log(`No usage.jsonl found at ${logPath}.`);
    console.log("Run some generations with LOG_USAGE=true first, then re-run this script.");
    process.exit(0);
  }

  const lines = fs
    .readFileSync(logPath, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  const records: PlannerUsageRecord[] = lines.map((line) => JSON.parse(line));
  const generateRecords = records.filter((r) => r.endpoint === "generate");

  if (generateRecords.length < 20) {
    console.log(
      `Only ${generateRecords.length} generate records found (need at least 20 for meaningful statistics).`,
    );
    console.log("Continue generating presets with LOG_USAGE=true, then re-run.");
    process.exit(0);
  }

  const stats = parseCacheReport(records);
  console.log(formatReport(stats));
}
