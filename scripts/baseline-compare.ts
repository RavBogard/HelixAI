// scripts/baseline-compare.ts
// Compare two quality baseline JSON files and report regressions.
// Exit code 0 if total warnings decreased or stayed same, exit code 1 if increased.
//
// Usage:
//   npx tsx scripts/baseline-compare.ts baseline-before.json baseline-after.json
//
// Phase 74, Plan 02 (QUAL-03).

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types (mirrors baseline-generator.ts output)
// ---------------------------------------------------------------------------

interface BaselineResult {
  device: string;
  genre: string;
  warningCount: number;
  warningCodes: string[];
}

interface BaselineOutput {
  generatedAt: string;
  totalPresets: number;
  totalWarnings: number;
  results: BaselineResult[];
  summary: {
    byDevice: Record<string, { presets: number; warnings: number }>;
    byGenre: Record<string, { presets: number; warnings: number }>;
    byCode: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Comparison logic
// ---------------------------------------------------------------------------

function loadBaseline(filePath: string): BaselineOutput {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(2);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf-8")) as BaselineOutput;
}

function compareBaselines(before: BaselineOutput, after: BaselineOutput): boolean {
  const totalDelta = after.totalWarnings - before.totalWarnings;
  const deltaSign = totalDelta > 0 ? "+" : "";

  console.log("=== Quality Baseline Comparison ===\n");
  console.log(`Before: ${before.generatedAt} (${before.totalPresets} presets, ${before.totalWarnings} warnings)`);
  console.log(`After:  ${after.generatedAt} (${after.totalPresets} presets, ${after.totalWarnings} warnings)`);
  console.log(`Delta:  ${deltaSign}${totalDelta} warnings\n`);

  // Per-device comparison
  console.log("=== Per-Device Delta ===");
  console.log("Device".padEnd(20) + "Before".padEnd(10) + "After".padEnd(10) + "Delta".padEnd(10) + "Status");
  console.log("-".repeat(60));

  const allDevices = new Set([
    ...Object.keys(before.summary.byDevice),
    ...Object.keys(after.summary.byDevice),
  ]);

  for (const device of allDevices) {
    const bw = before.summary.byDevice[device]?.warnings ?? 0;
    const aw = after.summary.byDevice[device]?.warnings ?? 0;
    const delta = aw - bw;
    const sign = delta > 0 ? "+" : "";
    const status = delta < 0 ? "IMPROVED" : delta > 0 ? "REGRESSED" : "unchanged";
    console.log(
      device.padEnd(20) +
      String(bw).padEnd(10) +
      String(aw).padEnd(10) +
      `${sign}${delta}`.padEnd(10) +
      status,
    );
  }

  // Per-genre comparison
  console.log("\n=== Per-Genre Delta ===");
  console.log("Genre".padEnd(20) + "Before".padEnd(10) + "After".padEnd(10) + "Delta".padEnd(10) + "Status");
  console.log("-".repeat(60));

  const allGenres = new Set([
    ...Object.keys(before.summary.byGenre),
    ...Object.keys(after.summary.byGenre),
  ]);

  for (const genre of allGenres) {
    const bw = before.summary.byGenre[genre]?.warnings ?? 0;
    const aw = after.summary.byGenre[genre]?.warnings ?? 0;
    const delta = aw - bw;
    const sign = delta > 0 ? "+" : "";
    const status = delta < 0 ? "IMPROVED" : delta > 0 ? "REGRESSED" : "unchanged";
    console.log(
      genre.padEnd(20) +
      String(bw).padEnd(10) +
      String(aw).padEnd(10) +
      `${sign}${delta}`.padEnd(10) +
      status,
    );
  }

  // Warning code changes
  const beforeCodes = new Set(Object.keys(before.summary.byCode));
  const afterCodes = new Set(Object.keys(after.summary.byCode));

  const newCodes = [...afterCodes].filter((c) => !beforeCodes.has(c));
  const removedCodes = [...beforeCodes].filter((c) => !afterCodes.has(c));

  if (newCodes.length > 0) {
    console.log("\n=== NEW Warning Codes ===");
    for (const code of newCodes) {
      console.log(`  + ${code} (${after.summary.byCode[code]} occurrences)`);
    }
  }

  if (removedCodes.length > 0) {
    console.log("\n=== REMOVED Warning Codes ===");
    for (const code of removedCodes) {
      console.log(`  - ${code} (was ${before.summary.byCode[code]} occurrences)`);
    }
  }

  // Per-combo detail (only show changes)
  const beforeMap = new Map(before.results.map((r) => [`${r.device}/${r.genre}`, r]));
  const afterMap = new Map(after.results.map((r) => [`${r.device}/${r.genre}`, r]));
  const changedCombos: string[] = [];

  for (const key of afterMap.keys()) {
    const bResult = beforeMap.get(key);
    const aResult = afterMap.get(key)!;
    if (!bResult || bResult.warningCount !== aResult.warningCount) {
      changedCombos.push(key);
    }
  }

  if (changedCombos.length > 0) {
    console.log("\n=== Changed Combinations ===");
    for (const key of changedCombos) {
      const bCount = beforeMap.get(key)?.warningCount ?? 0;
      const aCount = afterMap.get(key)!.warningCount;
      const delta = aCount - bCount;
      const sign = delta > 0 ? "+" : "";
      console.log(`  ${key}: ${bCount} -> ${aCount} (${sign}${delta})`);
    }
  }

  // Final verdict
  console.log(`\n=== RESULT: ${totalDelta > 0 ? "REGRESSION DETECTED" : totalDelta < 0 ? "IMPROVEMENT" : "NO CHANGE"} ===`);

  // Return true if regression (exit code 1)
  return totalDelta > 0;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1]?.includes("baseline-compare")) {
  const beforePath = process.argv[2];
  const afterPath = process.argv[3];

  if (!beforePath || !afterPath) {
    console.error("Usage: npx tsx scripts/baseline-compare.ts <before.json> <after.json>");
    process.exit(2);
  }

  const before = loadBaseline(beforePath);
  const after = loadBaseline(afterPath);
  const isRegression = compareBaselines(before, after);

  process.exit(isRegression ? 1 : 0);
}

export { compareBaselines, loadBaseline };
