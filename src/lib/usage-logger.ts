// src/lib/usage-logger.ts
// Token usage logging utility (AUDIT-01)
//
// Writes JSON-lines records to usage.jsonl when LOG_USAGE=true.
// No-op (zero I/O) when LOG_USAGE is unset or not "true".

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlannerUsageRecord {
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
  /** Device target for per-family cache economics analysis. Uses string (not DeviceTarget) to keep logger dependency-free. */
  device?: string;
}

// ---------------------------------------------------------------------------
// Pricing constants (per 1M tokens, USD)
// ---------------------------------------------------------------------------

/**
 * Claude Sonnet 4 pricing (5-minute ephemeral cache).
 * Prices: https://www.anthropic.com/pricing
 */
export const CLAUDE_SONNET_PRICE = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_write_per_mtok: 3.75, // 1.25x input for 5-min ephemeral
  cache_read_per_mtok: 0.3,   // 0.1x input
} as const;

/**
 * Gemini 2.5 Flash pricing.
 * Prices: https://cloud.google.com/vertex-ai/generative-ai/pricing
 */
export const GEMINI_FLASH_PRICE = {
  input_per_mtok: 0.3,
  output_per_mtok: 2.5,
  cache_read_per_mtok: 0.03, // 0.1x input
} as const;

// ---------------------------------------------------------------------------
// Cost estimation — pure functions, no I/O
// ---------------------------------------------------------------------------

/**
 * Estimate the USD cost of a Claude API call.
 *
 * @param usage - Token counts from the Anthropic API response.usage object.
 * @returns Cost in USD.
 */
export function estimateClaudeCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null | undefined;
  cache_read_input_tokens: number | null | undefined;
}): number {
  const MTok = 1_000_000;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;

  return (
    (usage.input_tokens / MTok) * CLAUDE_SONNET_PRICE.input_per_mtok +
    (usage.output_tokens / MTok) * CLAUDE_SONNET_PRICE.output_per_mtok +
    (cacheWrite / MTok) * CLAUDE_SONNET_PRICE.cache_write_per_mtok +
    (cacheRead / MTok) * CLAUDE_SONNET_PRICE.cache_read_per_mtok
  );
}

/**
 * Estimate the USD cost of a Gemini API call.
 *
 * @param usage - Usage metadata from the Gemini stream (last chunk).
 * @param model - Model ID string (unused currently, reserved for multi-model support).
 * @returns Cost in USD.
 */
export function estimateGeminiCost(
  usage: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    cachedContentTokenCount?: number;
    totalTokenCount?: number;
  },
  _model: string,
): number {
  const MTok = 1_000_000;
  const input = usage.promptTokenCount ?? 0;
  const output = usage.candidatesTokenCount ?? 0;
  const cached = usage.cachedContentTokenCount ?? 0;

  return (
    (input / MTok) * GEMINI_FLASH_PRICE.input_per_mtok +
    (output / MTok) * GEMINI_FLASH_PRICE.output_per_mtok +
    (cached / MTok) * GEMINI_FLASH_PRICE.cache_read_per_mtok
  );
}

// ---------------------------------------------------------------------------
// Usage logging
// ---------------------------------------------------------------------------

/**
 * Append a PlannerUsageRecord to usage.jsonl.
 *
 * Guard: returns immediately (no-op) if LOG_USAGE !== "true".
 * Uses appendFileSync to ensure records are never overwritten.
 *
 * @param record - The usage record to append.
 * @param logPath - Override log file path (default: usage.jsonl in process.cwd()).
 */
export function logUsage(
  record: PlannerUsageRecord,
  logPath?: string,
): void {
  if (process.env.LOG_USAGE !== "true") return;

  const filePath = logPath ?? path.resolve(process.cwd(), "usage.jsonl");
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
}
