// src/lib/usage-logger.test.ts
// Unit tests for usage-logger utility (AUDIT-01)

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  logUsage,
  estimateClaudeCost,
  estimateGeminiCost,
  CLAUDE_SONNET_PRICE,
  type PlannerUsageRecord,
} from "@/lib/usage-logger";

// Helpers
function makeTempLogPath(): string {
  return path.join(os.tmpdir(), `usage-logger-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

describe("logUsage", () => {
  let originalLogUsage: string | undefined;

  beforeEach(() => {
    originalLogUsage = process.env.LOG_USAGE;
  });

  afterEach(() => {
    if (originalLogUsage === undefined) {
      delete process.env.LOG_USAGE;
    } else {
      process.env.LOG_USAGE = originalLogUsage;
    }
  });

  it("Test 1: does not write any file when LOG_USAGE is unset", () => {
    delete process.env.LOG_USAGE;
    const logPath = makeTempLogPath();

    const record: PlannerUsageRecord = {
      timestamp: new Date().toISOString(),
      endpoint: "generate",
      model: "claude-sonnet-4-6",
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      total_tokens: 150,
      cost_usd: 0.001,
      cache_hit: false,
    };

    logUsage(record, logPath);

    expect(fs.existsSync(logPath)).toBe(false);
  });

  it("Test 1b: does not write any file when LOG_USAGE is not 'true'", () => {
    process.env.LOG_USAGE = "false";
    const logPath = makeTempLogPath();

    const record: PlannerUsageRecord = {
      timestamp: new Date().toISOString(),
      endpoint: "chat",
      model: "gemini-2.5-flash",
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      total_tokens: 150,
      cost_usd: 0.001,
      cache_hit: false,
    };

    logUsage(record, logPath);

    expect(fs.existsSync(logPath)).toBe(false);
  });

  it("Test 2: appends one valid JSON line to usage.jsonl when LOG_USAGE=true", () => {
    process.env.LOG_USAGE = "true";
    const logPath = makeTempLogPath();

    const record: PlannerUsageRecord = {
      timestamp: "2026-03-05T00:00:00.000Z",
      endpoint: "generate",
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 200,
      cache_read_input_tokens: null,
      total_tokens: 1500,
      cost_usd: 0.01,
      cache_hit: false,
    };

    logUsage(record, logPath);

    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    expect(lines).toHaveLength(1);

    // Cleanup
    fs.unlinkSync(logPath);
  });

  it("Test 3: appends two lines when called twice (file grows, no overwrite)", () => {
    process.env.LOG_USAGE = "true";
    const logPath = makeTempLogPath();

    const record1: PlannerUsageRecord = {
      timestamp: "2026-03-05T00:00:00.000Z",
      endpoint: "generate",
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      total_tokens: 1500,
      cost_usd: 0.01,
      cache_hit: false,
    };

    const record2: PlannerUsageRecord = {
      timestamp: "2026-03-05T00:01:00.000Z",
      endpoint: "chat",
      model: "gemini-2.5-flash",
      input_tokens: 200,
      output_tokens: 100,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: 50,
      total_tokens: 300,
      cost_usd: 0.0001,
      cache_hit: true,
    };

    logUsage(record1, logPath);
    logUsage(record2, logPath);

    const content = fs.readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n").filter(Boolean);
    expect(lines).toHaveLength(2);

    // Cleanup
    fs.unlinkSync(logPath);
  });

  it("Test 6: each JSON line deserializes to a valid PlannerUsageRecord with all required fields", () => {
    process.env.LOG_USAGE = "true";
    const logPath = makeTempLogPath();

    const record: PlannerUsageRecord = {
      timestamp: "2026-03-05T00:00:00.000Z",
      endpoint: "generate",
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 100,
      cache_read_input_tokens: 50,
      total_tokens: 1500,
      cost_usd: 0.012,
      cache_hit: true,
    };

    logUsage(record, logPath);

    const content = fs.readFileSync(logPath, "utf-8");
    const parsed = JSON.parse(content.trim()) as PlannerUsageRecord;

    expect(parsed.timestamp).toBe("2026-03-05T00:00:00.000Z");
    expect(parsed.endpoint).toBe("generate");
    expect(parsed.model).toBe("claude-sonnet-4-6");
    expect(parsed.input_tokens).toBe(1000);
    expect(parsed.output_tokens).toBe(500);
    expect(parsed.cache_creation_input_tokens).toBe(100);
    expect(parsed.cache_read_input_tokens).toBe(50);
    expect(parsed.total_tokens).toBe(1500);
    expect(typeof parsed.cost_usd).toBe("number");
    expect(typeof parsed.cache_hit).toBe("boolean");

    // Cleanup
    fs.unlinkSync(logPath);
  });
});

describe("estimateClaudeCost", () => {
  it("CLAUDE_SONNET_PRICE.cache_write_per_mtok is 6.0 (1h TTL)", () => {
    // Regression guard: ensures pricing constant stays at 6.0 for 1h ephemeral cache
    expect(CLAUDE_SONNET_PRICE.cache_write_per_mtok).toBe(6.0);
  });

  it("Test 4: returns correct USD value for known inputs", () => {
    // 1000 input + 500 output + 500 cache_write + 200 cache_read
    // input:       1000 / 1_000_000 * 3.00     = 0.003
    // output:       500 / 1_000_000 * 15.00    = 0.0075
    // cache_write:  500 / 1_000_000 * 6.00     = 0.003
    // cache_read:   200 / 1_000_000 * 0.30     = 0.00006
    // total = 0.003 + 0.0075 + 0.003 + 0.00006 = 0.013560
    const cost = estimateClaudeCost({
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: 500,
      cache_read_input_tokens: 200,
    });

    expect(cost).toBeCloseTo(0.013560, 6);
  });

  it("returns zero cost for zero tokens", () => {
    const cost = estimateClaudeCost({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    expect(cost).toBe(0);
  });

  it("handles null cache fields", () => {
    const cost = estimateClaudeCost({
      input_tokens: 1000,
      output_tokens: 500,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    });

    // input:  1000 / 1_000_000 * 3.00  = 0.003
    // output:  500 / 1_000_000 * 15.00 = 0.0075
    // total = 0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
  });
});

describe("estimateGeminiCost", () => {
  it("Test 5: returns correct USD value for known inputs", () => {
    // 1000 input + 500 output + 200 cachedContent
    // input:  1000 / 1_000_000 * 0.30 = 0.0003
    // output:  500 / 1_000_000 * 2.50 = 0.00125
    // cache_read: 200 / 1_000_000 * 0.03 = 0.000006
    // total = 0.0003 + 0.00125 + 0.000006 = 0.001556
    const cost = estimateGeminiCost(
      {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        cachedContentTokenCount: 200,
        totalTokenCount: 1500,
      },
      "gemini-2.5-flash",
    );

    expect(cost).toBeCloseTo(0.001556, 6);
  });

  it("returns zero cost for zero tokens", () => {
    const cost = estimateGeminiCost(
      {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        cachedContentTokenCount: 0,
        totalTokenCount: 0,
      },
      "gemini-2.5-flash",
    );
    expect(cost).toBe(0);
  });

  it("handles undefined usage fields gracefully", () => {
    const cost = estimateGeminiCost({}, "gemini-2.5-flash");
    expect(cost).toBe(0);
  });
});
