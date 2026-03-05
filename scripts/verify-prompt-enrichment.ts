// scripts/verify-prompt-enrichment.ts
// Cross-device enrichment verification script.
// Confirms all three enrichment sections are present in every device variant
// of the planner prompt, and verifies shared-prefix ordering (enrichment before
// DEVICE RESTRICTION text).
//
// Usage:
//   npx tsx scripts/verify-prompt-enrichment.ts
//
// Exit codes:
//   0  — all checks pass
//   1  — one or more checks failed
//
// PROMPT-04 Cache Hit Rate Measurement Procedure:
// 1. Set LOG_USAGE=true in environment
// 2. Run 10+ preset generations via the app UI or integration test
// 3. Run: npx tsx scripts/cache-hit-report.ts
// 4. Record baseline hit rate
// 5. After prompt changes, repeat steps 2-3
// 6. If hit rate drops >10 percentage points, investigate device-conditional content
//    in buildPlannerPrompt() — any ${device ? ...} interpolation in the shared prefix
//    fragments the cache into per-device buckets.

import { buildPlannerPrompt } from "../src/lib/planner";
import { getModelListForPrompt } from "@/lib/helix";
import type { DeviceTarget } from "@/lib/helix";

// ---------------------------------------------------------------------------
// All 6 device targets
// ---------------------------------------------------------------------------

const DEVICES: DeviceTarget[] = [
  "helix_lt",
  "helix_floor",
  "pod_go",
  "helix_stadium",
  "helix_stomp",
  "helix_stomp_xl",
];

// ---------------------------------------------------------------------------
// Enrichment section headings to verify
// ---------------------------------------------------------------------------

const ENRICHMENT_SECTIONS = [
  "## Gain-Staging Intelligence",
  "## Amp-to-Cab Pairing",
  "## Effect Discipline by Genre",
] as const;

// Short column labels for the results table
const SECTION_LABELS = ["Gain-Staging", "Cab Pairing", "Effect Disc."];

// ---------------------------------------------------------------------------
// Result tracking
// ---------------------------------------------------------------------------

interface DeviceCheckResult {
  device: DeviceTarget;
  sectionPresent: [boolean, boolean, boolean];
  prefixOrder: boolean;
  charCount: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Check a single device variant
// ---------------------------------------------------------------------------

function checkDevice(device: DeviceTarget): DeviceCheckResult {
  const modelList = getModelListForPrompt(device);
  const prompt = buildPlannerPrompt(modelList, device);

  const sectionPresent: [boolean, boolean, boolean] = [
    prompt.includes(ENRICHMENT_SECTIONS[0]),
    prompt.includes(ENRICHMENT_SECTIONS[1]),
    prompt.includes(ENRICHMENT_SECTIONS[2]),
  ];

  // Verify shared-prefix ordering: all enrichment sections must appear
  // before the DEVICE RESTRICTION block (when present).
  // For devices without a restriction block, verify sections appear after
  // ## Dual-Amp Rules and before "Based on the conversation".
  const deviceRestrictionIdx = prompt.indexOf("DEVICE RESTRICTION");
  const basedOnConversationIdx = prompt.indexOf("Based on the conversation");

  let prefixOrder = true;

  if (deviceRestrictionIdx !== -1) {
    // Device has a restriction block — enrichment must precede it
    for (const section of ENRICHMENT_SECTIONS) {
      const sectionIdx = prompt.indexOf(section);
      if (sectionIdx === -1 || sectionIdx >= deviceRestrictionIdx) {
        prefixOrder = false;
        break;
      }
    }
  } else {
    // No device restriction block — enrichment must appear before the suffix
    if (basedOnConversationIdx !== -1) {
      for (const section of ENRICHMENT_SECTIONS) {
        const sectionIdx = prompt.indexOf(section);
        if (sectionIdx === -1 || sectionIdx >= basedOnConversationIdx) {
          prefixOrder = false;
          break;
        }
      }
    }
  }

  return {
    device,
    sectionPresent,
    prefixOrder,
    charCount: prompt.length,
  };
}

// ---------------------------------------------------------------------------
// Format table
// ---------------------------------------------------------------------------

function padEnd(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function formatTable(results: DeviceCheckResult[]): string {
  const col1 = 20;
  const col2 = 13;
  const col3 = 12;
  const col4 = 13;
  const col5 = 13;

  const header =
    padEnd("Device", col1) + "| " +
    padEnd(SECTION_LABELS[0], col2) + "| " +
    padEnd(SECTION_LABELS[1], col3) + "| " +
    padEnd(SECTION_LABELS[2], col4) + "| " +
    padEnd("Prefix Order", col5) + "| " +
    "Chars";

  const separator = "-".repeat(col1) + "|-" +
    "-".repeat(col2) + "|-" +
    "-".repeat(col3) + "|-" +
    "-".repeat(col4) + "|-" +
    "-".repeat(col5) + "|-" +
    "-------";

  const rows = results.map((r) => {
    const s = r.sectionPresent;
    return (
      padEnd(r.device, col1) + "| " +
      padEnd(s[0] ? "OK" : "FAIL", col2) + "| " +
      padEnd(s[1] ? "OK" : "FAIL", col3) + "| " +
      padEnd(s[2] ? "OK" : "FAIL", col4) + "| " +
      padEnd(r.prefixOrder ? "OK" : "FAIL", col5) + "| " +
      r.charCount.toLocaleString()
    );
  });

  return [header, separator, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("\nHelixTones Prompt Enrichment Verification (PROMPT-04)");
  console.log("=".repeat(55));
  console.log(`Checking ${DEVICES.length} device variants for all 3 enrichment sections...\n`);

  const results: DeviceCheckResult[] = [];
  let allPassed = true;

  for (const device of DEVICES) {
    const result = checkDevice(device);
    results.push(result);

    const failed =
      result.sectionPresent.some((ok) => !ok) || !result.prefixOrder;
    if (failed) {
      allPassed = false;
    }
  }

  // Print results table
  console.log(formatTable(results));
  console.log();

  // Print character count delta relative to helix_lt (baseline)
  const baseline = results.find((r) => r.device === "helix_lt");
  if (baseline) {
    console.log("Prompt character counts (delta vs helix_lt):");
    for (const r of results) {
      const delta = r.charCount - baseline.charCount;
      const sign = delta >= 0 ? "+" : "";
      console.log(`  ${padEnd(r.device, 20)} ${r.charCount.toLocaleString()} chars  (${sign}${delta})`);
    }
    console.log();
  }

  // Print failures detail
  const failures: string[] = [];
  for (const r of results) {
    r.sectionPresent.forEach((ok, i) => {
      if (!ok) {
        failures.push(`  FAIL: ${r.device} — missing "${ENRICHMENT_SECTIONS[i]}"`);
      }
    });
    if (!r.prefixOrder) {
      failures.push(`  FAIL: ${r.device} — enrichment sections NOT in shared prefix (ordering violation)`);
    }
  }

  if (failures.length > 0) {
    console.log("Failures:");
    failures.forEach((f) => console.log(f));
    console.log();
    console.log("RESULT: FAILED — cache fragmentation or missing enrichment detected.");
    console.log("        Check buildPlannerPrompt() in src/lib/planner.ts.");
    console.log("        Enrichment must be static text before ${podGo ? ...} blocks.");
    process.exit(1);
  }

  console.log("RESULT: PASSED — all 6 device variants contain all 3 enrichment sections");
  console.log("        in the shared static prefix (no cache fragmentation).");
  process.exit(0);
}

main();
