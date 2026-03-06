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

/**
 * Parse usage records and compute per-device cache hit statistics.
 * Groups records by `record.device` (defaults to "unknown" when undefined).
 * Filters to `endpoint === "generate"` records before grouping.
 *
 * @param records - All usage records from usage.jsonl
 * @returns Map of device name -> CacheReportStats for that device
 */
export function parseCacheReportByDevice(
  records: PlannerUsageRecord[],
): Map<string, CacheReportStats> {
  // Filter to generate-only records first
  const generateRecords = records.filter((r) => r.endpoint === "generate");

  // Group by device
  const deviceGroups = new Map<string, PlannerUsageRecord[]>();
  for (const record of generateRecords) {
    const device = record.device ?? "unknown";
    if (!deviceGroups.has(device)) {
      deviceGroups.set(device, []);
    }
    deviceGroups.get(device)!.push(record);
  }

  // Compute per-device stats using existing parseCacheReport
  // Pass records as-is — parseCacheReport filters generate internally,
  // but since we already filtered, all records qualify.
  const result = new Map<string, CacheReportStats>();
  for (const [device, deviceRecords] of deviceGroups) {
    result.set(device, parseCacheReport(deviceRecords));
  }

  return result;
}

/**
 * Format per-device cache statistics into a human-readable string.
 *
 * @param deviceStats - Map returned by parseCacheReportByDevice
 * @returns Formatted string with per-device breakdown
 */
export function formatReportByDevice(
  deviceStats: Map<string, CacheReportStats>,
): string {
  if (deviceStats.size === 0) {
    return "No device data available.";
  }

  const lines: string[] = ["=== Per-Device Cache Statistics ===", ""];

  // Sort entries by device name for consistent output
  const sorted = [...deviceStats.entries()].sort(([a], [b]) => a.localeCompare(b));

  for (const [device, stats] of sorted) {
    const hitPct = (stats.hitRate * 100).toFixed(1);
    const coldPct = ((1 - stats.hitRate) * 100).toFixed(1);
    lines.push(
      `Device: ${device}`,
      `  Total calls:   ${stats.totalCalls}`,
      `  Cache hits:    ${stats.cacheHits} (${hitPct}%)`,
      `  Cold starts:   ${stats.coldStarts} (${coldPct}%)`,
      `  Avg cost cold: $${stats.avgCostCold.toFixed(4)}`,
      `  Avg cost hit:  $${stats.avgCostCached.toFixed(4)}`,
      `  Total cost:    $${stats.totalCost.toFixed(4)}`,
      "",
    );
  }

  return lines.join("\n").trimEnd();
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

  // Per-device breakdown (when data has device fields)
  const deviceStats = parseCacheReportByDevice(records);
  const devicesWithData = [...deviceStats.entries()].filter(
    ([, s]) => s.totalCalls > 0,
  );
  if (devicesWithData.length > 1) {
    console.log("");
    console.log(formatReportByDevice(deviceStats));
  }
}
