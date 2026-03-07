// src/lib/helix/quality-logger.ts
// Quality warning logger — writes JSON-lines when LOG_QUALITY=true.
// Follows src/lib/usage-logger.ts pattern exactly.
//
// Phase 74, Plan 01 (QUAL-02).

import * as fs from "fs";
import * as path from "path";
import type { QualityWarning } from "./quality-validate";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QualityLogRecord {
  timestamp: string;
  device: string;
  presetName: string;
  warningCount: number;
  warnings: QualityWarning[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log quality warnings to console and optionally to a JSON-lines file.
 *
 * Always calls console.warn when warnings.length > 0.
 * JSON-lines file logging gated by process.env.LOG_QUALITY === "true".
 * Uses fs.appendFileSync to ensure records are never overwritten.
 *
 * @param warnings - Array of quality warnings from validatePresetQuality()
 * @param context - Device and preset name for the log record
 * @param logPath - Override log file path (default: quality.jsonl in process.cwd())
 */
export function logQualityWarnings(
  warnings: QualityWarning[],
  context: { device: string; presetName: string },
  logPath?: string,
): void {
  // Always console.warn when there are warnings (regardless of LOG_QUALITY env)
  if (warnings.length > 0) {
    const codes = warnings.map((w) => w.code).join(", ");
    console.warn(
      `[quality] ${context.device}/${context.presetName}: ${warnings.length} warning(s): ${codes}`,
    );
  }

  // File logging gated by LOG_QUALITY env var
  if (process.env.LOG_QUALITY !== "true") return;

  const record: QualityLogRecord = {
    timestamp: new Date().toISOString(),
    device: context.device,
    presetName: context.presetName,
    warningCount: warnings.length,
    warnings,
  };

  const filePath = logPath ?? path.resolve(process.cwd(), "quality.jsonl");
  fs.appendFileSync(filePath, JSON.stringify(record) + "\n", "utf-8");
}
