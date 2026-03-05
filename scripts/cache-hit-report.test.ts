// scripts/cache-hit-report.test.ts
// Unit tests for cache hit rate report pure functions.

import { describe, it, expect } from "vitest";
import type { PlannerUsageRecord } from "@/lib/usage-logger";
import { parseCacheReport, getRecommendation } from "./cache-hit-report";

// ---------------------------------------------------------------------------
// Test data factory
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<PlannerUsageRecord> = {}): PlannerUsageRecord {
  return {
    timestamp: "2026-03-04T12:00:00Z",
    endpoint: "generate",
    model: "claude-sonnet-4-20250514",
    input_tokens: 5000,
    output_tokens: 800,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
    total_tokens: 5800,
    cost_usd: 0.027,
    cache_hit: false,
    ...overrides,
  };
}

function makeColdRecord(inputTokens = 5000, cost = 0.027): PlannerUsageRecord {
  return makeRecord({
    input_tokens: inputTokens,
    output_tokens: 800,
    cache_creation_input_tokens: inputTokens,
    cache_read_input_tokens: 0,
    total_tokens: inputTokens + 800,
    cost_usd: cost,
    cache_hit: false,
  });
}

function makeCachedRecord(inputTokens = 5000, cost = 0.005): PlannerUsageRecord {
  return makeRecord({
    input_tokens: inputTokens,
    output_tokens: 800,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: inputTokens,
    total_tokens: inputTokens + 800,
    cost_usd: cost,
    cache_hit: true,
  });
}

describe("parseCacheReport", () => {
  it("Test 1: correctly computes hit rate from 20 records (14 cached, 6 cold)", () => {
    const records: PlannerUsageRecord[] = [
      ...Array.from({ length: 6 }, () => makeColdRecord()),
      ...Array.from({ length: 14 }, () => makeCachedRecord()),
    ];

    const stats = parseCacheReport(records);

    expect(stats.totalCalls).toBe(20);
    expect(stats.cacheHits).toBe(14);
    expect(stats.coldStarts).toBe(6);
    expect(stats.hitRate).toBeCloseTo(0.70, 2);
  });

  it("Test 2: correct avgInputTokens for cold and cached calls separately", () => {
    const records: PlannerUsageRecord[] = [
      makeColdRecord(4000),
      makeColdRecord(6000),
      makeCachedRecord(3000),
      makeCachedRecord(5000),
      makeCachedRecord(7000),
    ];

    const stats = parseCacheReport(records);

    expect(stats.avgInputTokensCold).toBeCloseTo(5000, 0); // (4000+6000)/2
    expect(stats.avgInputTokensCached).toBeCloseTo(5000, 0); // (3000+5000+7000)/3
  });

  it("Test 3: correct averageCost for cold and cached calls separately", () => {
    const records: PlannerUsageRecord[] = [
      makeColdRecord(5000, 0.030),
      makeColdRecord(5000, 0.020),
      makeCachedRecord(5000, 0.005),
      makeCachedRecord(5000, 0.007),
    ];

    const stats = parseCacheReport(records);

    expect(stats.avgCostCold).toBeCloseTo(0.025, 4); // (0.030+0.020)/2
    expect(stats.avgCostCached).toBeCloseTo(0.006, 4); // (0.005+0.007)/2
  });

  it("Test 4: totalSavings = estimated all-cold cost minus actual cost", () => {
    const coldCost = 0.030;
    const cachedCost = 0.005;
    const records: PlannerUsageRecord[] = [
      makeColdRecord(5000, coldCost),
      makeColdRecord(5000, coldCost),
      makeCachedRecord(5000, cachedCost),
      makeCachedRecord(5000, cachedCost),
    ];

    const stats = parseCacheReport(records);

    // Actual total = 2*0.030 + 2*0.005 = 0.070
    // If all cold: 4 * 0.030 = 0.120
    // Savings = 0.120 - 0.070 = 0.050
    const actualTotal = 2 * coldCost + 2 * cachedCost;
    const allColdEstimate = 4 * coldCost;
    const expectedSavings = allColdEstimate - actualTotal;

    expect(stats.totalCost).toBeCloseTo(actualTotal, 4);
    expect(stats.totalSavings).toBeCloseTo(expectedSavings, 4);
  });

  it("Test 6: empty records array returns zeros without error", () => {
    const stats = parseCacheReport([]);

    expect(stats.totalCalls).toBe(0);
    expect(stats.cacheHits).toBe(0);
    expect(stats.coldStarts).toBe(0);
    expect(stats.hitRate).toBe(0);
    expect(stats.avgInputTokensCold).toBe(0);
    expect(stats.avgInputTokensCached).toBe(0);
    expect(stats.avgOutputTokens).toBe(0);
    expect(stats.avgCostCold).toBe(0);
    expect(stats.avgCostCached).toBe(0);
    expect(stats.totalCost).toBe(0);
    expect(stats.totalSavings).toBe(0);
  });

  it("filters to only 'generate' endpoint records", () => {
    const records: PlannerUsageRecord[] = [
      makeColdRecord(5000, 0.030),
      makeRecord({ endpoint: "chat", cache_hit: false, cost_usd: 0.010 }),
      makeCachedRecord(5000, 0.005),
    ];

    const stats = parseCacheReport(records);

    // Only 2 generate records should be counted
    expect(stats.totalCalls).toBe(2);
  });
});

describe("getRecommendation", () => {
  it("Test 5: returns 'above threshold' text for rate >= 0.50", () => {
    const result = getRecommendation(0.70);
    expect(result).toContain("above");
    expect(result).toContain("50%");
    expect(result).toContain("70");
  });

  it("returns 'above threshold' text for exactly 0.50", () => {
    const result = getRecommendation(0.50);
    expect(result).toContain("above");
  });

  it("Test 5b: returns 'optimization needed' text for rate < 0.50", () => {
    const result = getRecommendation(0.30);
    expect(result).toContain("below");
    expect(result).toContain("50%");
    expect(result).toContain("30");
  });
});
