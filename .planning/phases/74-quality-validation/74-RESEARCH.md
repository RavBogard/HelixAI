# Phase 74: Quality Validation - Research

**Researched:** 2026-03-06
**Domain:** Non-throwing preset quality validation, parameter advisory warnings, per-device baseline regression testing
**Confidence:** HIGH

## Summary

Phase 74 introduces a quality validation layer that runs after structural validation (`validatePresetSpec`) but operates in advisory mode -- returning warnings rather than throwing errors. The existing `validate.ts` catches structural problems (missing amp, invalid model IDs, out-of-range parameters). Quality validation catches *musical* problems: parameter choices that are technically valid but suboptimal (reverb Mix too high, cab filtering missing, snapshot level imbalance across roles). These warnings are logged for analysis but never block preset delivery to the user.

The codebase is well-structured for this addition. The generation pipeline in `src/app/api/generate/route.ts` has a clear insertion point: after `validatePresetSpec(presetSpec, caps)` (Step 4) and before building the device-specific file (Step 5). The existing `usage-logger.ts` provides the logging pattern -- JSON-lines appending gated by an environment variable. Quality warnings should follow the same pattern.

**Primary recommendation:** Create `src/lib/helix/quality-validate.ts` as a pure function `validatePresetQuality(spec: PresetSpec, caps: DeviceCapabilities): QualityWarning[]` that returns an array of advisory warnings. Integrate into the generate pipeline after structural validation. Log warnings via a lightweight quality logger. Build a baseline generator script for per-device regression tracking.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Non-throwing preset quality validation function returns warnings (not errors) for suboptimal parameter choices -- over-wet reverb, missing cab filtering, snapshot level imbalance | All parameter thresholds derived from existing expert tables in param-engine.ts. QualityWarning type with severity/message/blockRef fields. Function signature and check catalog documented below. |
| QUAL-02 | Quality validation runs on every generated preset and warnings are logged for analysis | Pipeline insertion point identified at generate/route.ts Step 4.5. Logging follows usage-logger.ts pattern with quality.jsonl output. |
| QUAL-03 | Per-device baseline comparison validates that quality changes improve (not regress) preset output across all 6 device families | 36-preset baseline = 6 devices x 6 genres. Script generates presets deterministically, records warning counts per device/genre. Before/after comparison detects regressions. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | existing | Type-safe quality warning types | Already used throughout codebase |
| Vitest | ^4.0.18 | Unit testing quality checks | Existing test framework |
| Node.js fs | built-in | JSON-lines warning log output | Same pattern as usage-logger.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | Pure functions, no new dependencies |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON-lines logging | Structured logging library (pino, winston) | Overkill -- usage-logger.ts pattern works, zero new dependencies |
| Threshold config file | Hard-coded constants | Constants in code match param-engine.ts pattern; config file adds unnecessary indirection |

## Architecture Patterns

### Recommended Project Structure
```
src/lib/helix/
  quality-validate.ts          # validatePresetQuality() + QualityWarning types
  quality-validate.test.ts     # TDD tests for each quality check
  quality-logger.ts            # logQualityWarnings() -- JSON-lines gated by env var
scripts/
  baseline-generator.ts        # 36-preset baseline generation for QUAL-03
  baseline-compare.ts          # Compare two baseline runs for regression detection
```

### Pattern 1: Advisory Validation (Non-Throwing)
**What:** A validation function that returns warning objects instead of throwing errors.
**When to use:** When you want to surface problems without blocking the user.
**Example:**
```typescript
// Contrasts with existing validate.ts which THROWS:
//   export function validatePresetSpec(spec: PresetSpec, caps: DeviceCapabilities): void { throw ... }

export interface QualityWarning {
  code: string;           // Machine-readable: "REVERB_MIX_HIGH", "CAB_NO_LOWCUT", etc.
  severity: "warn" | "info";
  message: string;        // Human-readable explanation
  blockRef?: string;      // Which block triggered it (e.g., "Glitz", "4x12 Cali V30")
  actual?: number;        // The actual parameter value
  threshold?: number;     // The threshold that was exceeded
}

export function validatePresetQuality(
  spec: PresetSpec,
  caps: DeviceCapabilities,
): QualityWarning[] {
  const warnings: QualityWarning[] = [];
  // Run each check, pushing to warnings array
  checkReverbMix(spec, warnings);
  checkCabFiltering(spec, warnings);
  checkSnapshotLevelBalance(spec, warnings);
  // ... more checks
  return warnings; // NEVER throws
}
```

### Pattern 2: Pipeline Integration (Non-Blocking)
**What:** Quality validation runs in the pipeline but never prevents preset delivery.
**When to use:** In the generate route, after structural validation succeeds.
**Example:**
```typescript
// In src/app/api/generate/route.ts, between Step 4 and Step 5:

// Step 4: Strict validation -- fail fast on structural errors
validatePresetSpec(presetSpec, caps);

// Step 4.5: Quality validation -- advisory, never blocks
const qualityWarnings = validatePresetQuality(presetSpec, caps);
if (qualityWarnings.length > 0) {
  logQualityWarnings(qualityWarnings, { device: deviceTarget, presetName: presetSpec.name });
}

// Step 5: Build preset file -- ALWAYS proceeds regardless of warnings
```

### Pattern 3: Baseline Generator Script
**What:** A deterministic script that generates presets for every device x genre combination and records quality metrics.
**When to use:** Run before and after code changes to detect quality regressions.
**Example:**
```typescript
// scripts/baseline-generator.ts
const DEVICES: DeviceTarget[] = [
  "helix_lt", "helix_floor", "helix_stomp", "helix_stomp_xl", "pod_go", "helix_stadium"
];
const GENRES = ["blues", "rock", "metal", "jazz", "ambient", "country"];

// For each device x genre, build a deterministic ToneIntent (no AI),
// run through Knowledge Layer pipeline, then run quality validation.
// Output: baseline.json with warning counts per device/genre pair.
```

### Anti-Patterns to Avoid
- **Throwing from quality validation:** The entire point is advisory. If quality validation throws, it blocks the user from getting their preset. Never do this.
- **Making warnings visible to users in v6.0:** Warnings are for developer analysis. Do not surface them in the frontend response. They go to server-side logs only.
- **Coupling quality checks to AI behavior:** Quality checks validate the deterministic Knowledge Layer output, not what the AI chose. The AI picks model names; the Knowledge Layer picks parameters. Quality checks target parameters.
- **False positives on ambient genre:** Ambient presets deliberately use high reverb mix (0.40-0.50) and long decay. Quality checks must be genre-aware or ambient presets will always warn.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Logging infrastructure | Custom log framework | Follow usage-logger.ts pattern (JSON-lines, env var gate) | Consistent with existing codebase, proven pattern |
| Preset generation for baselines | AI-driven preset generation | Deterministic ToneIntent fixtures through Knowledge Layer pipeline | AI is non-deterministic; baselines must be reproducible |
| Parameter threshold tables | Ad-hoc magic numbers | Derive from existing param-engine.ts expert consensus tables | Single source of truth for "what's normal" |

**Key insight:** Every "what's suboptimal" threshold already exists implicitly in param-engine.ts. Reverb Mix ranges from 0.12 (metal) to 0.50 (ambient). A quality check for "over-wet reverb" is simply `Mix > 0.60` -- above even the most wet genre default. The expert consensus tables ARE the quality standard.

## Common Pitfalls

### Pitfall 1: Genre-Blind Thresholds
**What goes wrong:** A quality check flags reverb Mix > 0.30 as "over-wet", but ambient/worship presets intentionally use Mix 0.40-0.50.
**Why it happens:** Thresholds set too low without considering genre context.
**How to avoid:** Either make thresholds genre-aware (pass genreHint into quality checks) or set thresholds at the absolute maximum of any genre profile (e.g., Mix > 0.60 is always suspicious, even for ambient).
**Warning signs:** Ambient presets always producing quality warnings.

### Pitfall 2: Snapshot Level Imbalance False Positives
**What goes wrong:** Quality check flags "snapshot level imbalance" when lead snapshot has higher ChVol than clean.
**Why it happens:** Lead snapshots are DESIGNED to be louder (ChVol 0.80 vs clean 0.68). The imbalance is intentional.
**How to avoid:** Check for EXTREME imbalance only (e.g., ChVol difference > 0.25 between any two snapshots), or check that the lead snapshot is the loudest (not that all are equal).
**Warning signs:** Every well-formed preset producing a "level imbalance" warning.

### Pitfall 3: Stadium/Pod Go Parameter Encoding Differences
**What goes wrong:** Quality checks assume all parameters are 0.0-1.0 normalized, but cab LowCut/HighCut are Hz-encoded (80.0, 7000.0) and Stadium amp params use raw firmware values.
**Why it happens:** validate.ts already handles these special cases; quality-validate.ts must also handle them.
**How to avoid:** Copy the type-aware parameter handling from validate.ts. Check block.type and parameter name before applying thresholds.
**Warning signs:** Every preset flagging cab parameters as "out of range".

### Pitfall 4: Logging in Production Blocking Response
**What goes wrong:** Quality logging uses synchronous file I/O in the request path, adding latency.
**Why it happens:** Naive implementation uses fs.appendFileSync in the hot path.
**How to avoid:** Use the same appendFileSync pattern as usage-logger.ts (which is already in the production pipeline) -- it's fast enough for a single JSON line. Or make logging async fire-and-forget.
**Warning signs:** Increased p95 latency on /api/generate.

### Pitfall 5: Baseline Generator Depending on AI
**What goes wrong:** Baseline script calls callClaudePlanner(), making results non-deterministic and requiring API keys.
**Why it happens:** Trying to test the full pipeline end-to-end.
**How to avoid:** Use fixed ToneIntent fixtures. The quality validation layer validates Knowledge Layer output, not AI output. Deterministic inputs produce deterministic outputs through the pipeline.
**Warning signs:** Baseline results changing between runs with same code.

## Code Examples

### Quality Warning Type and Function Signature
```typescript
// src/lib/helix/quality-validate.ts

import type { PresetSpec, BlockSpec } from "./types";
import type { DeviceCapabilities } from "./device-family";

export interface QualityWarning {
  code: string;
  severity: "warn" | "info";
  message: string;
  blockRef?: string;
  actual?: number;
  threshold?: number;
}

export function validatePresetQuality(
  spec: PresetSpec,
  caps: DeviceCapabilities,
): QualityWarning[] {
  const warnings: QualityWarning[] = [];

  for (const block of spec.signalChain) {
    checkReverbMix(block, warnings);
    checkDelayFeedback(block, warnings);
    checkCabFiltering(block, warnings);
    checkDriveLevel(block, warnings);
  }

  checkSnapshotLevelBalance(spec, warnings);
  checkEffectPresence(spec, caps, warnings);

  return warnings;
}
```

### Individual Quality Check: Over-Wet Reverb
```typescript
// Threshold derived from param-engine.ts genre defaults:
// Highest reverb Mix in any genre = 0.50 (ambient)
// + 0.15 ambient snapshot boost = 0.65 max reasonable
// Threshold: 0.60 (anything above is suspicious even before ambient boost)
const REVERB_MIX_WARN = 0.60;

function checkReverbMix(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "reverb") return;
  const mix = block.parameters.Mix;
  if (typeof mix === "number" && mix > REVERB_MIX_WARN) {
    warnings.push({
      code: "REVERB_MIX_HIGH",
      severity: "warn",
      message: `Reverb "${block.modelName}" has Mix=${mix.toFixed(2)}, above ${REVERB_MIX_WARN} threshold. May sound over-wet.`,
      blockRef: block.modelName,
      actual: mix,
      threshold: REVERB_MIX_WARN,
    });
  }
}
```

### Individual Quality Check: Missing Cab Filtering
```typescript
// Cab blocks should have LowCut and HighCut filtering to prevent mud and harshness.
// param-engine.ts sets LowCut 80-100 Hz and HighCut 5500-7500 Hz.
// A cab with no filtering (LowCut at minimum 19.9 or HighCut at maximum 20100) is suspicious.

function checkCabFiltering(block: BlockSpec, warnings: QualityWarning[]): void {
  if (block.type !== "cab") return;

  const lowCut = block.parameters.LowCut;
  if (typeof lowCut === "number" && lowCut < 30.0) {
    warnings.push({
      code: "CAB_NO_LOWCUT",
      severity: "warn",
      message: `Cab "${block.modelName}" has LowCut=${lowCut.toFixed(1)} Hz -- no low-end filtering. Typical: 80-100 Hz.`,
      blockRef: block.modelName,
      actual: lowCut,
      threshold: 30.0,
    });
  }

  const highCut = block.parameters.HighCut;
  if (typeof highCut === "number" && highCut > 18000.0) {
    warnings.push({
      code: "CAB_NO_HIGHCUT",
      severity: "warn",
      message: `Cab "${block.modelName}" has HighCut=${highCut.toFixed(0)} Hz -- no high-end filtering. Typical: 5500-8000 Hz.`,
      blockRef: block.modelName,
      actual: highCut,
      threshold: 18000.0,
    });
  }
}
```

### Individual Quality Check: Snapshot Level Balance
```typescript
// Snapshot ChVol values from snapshot-engine.ts:
//   clean: 0.68, crunch: 0.72, lead: 0.80, ambient: 0.65
// Max spread = 0.15 (lead - ambient). Warning if spread > 0.25.

function checkSnapshotLevelBalance(spec: PresetSpec, warnings: QualityWarning[]): void {
  const chVols: number[] = [];

  for (const snapshot of spec.snapshots) {
    for (const overrides of Object.values(snapshot.parameterOverrides)) {
      if (typeof overrides === "object" && "ChVol" in overrides) {
        const chVol = overrides.ChVol;
        if (typeof chVol === "number") chVols.push(chVol);
      }
    }
  }

  if (chVols.length < 2) return;

  const maxVol = Math.max(...chVols);
  const minVol = Math.min(...chVols);
  const spread = maxVol - minVol;

  if (spread > 0.25) {
    warnings.push({
      code: "SNAPSHOT_LEVEL_IMBALANCE",
      severity: "warn",
      message: `Snapshot ChVol spread is ${spread.toFixed(2)} (max=${maxVol.toFixed(2)}, min=${minVol.toFixed(2)}). May cause volume jumps between snapshots.`,
      actual: spread,
      threshold: 0.25,
    });
  }
}
```

### Quality Logger
```typescript
// src/lib/helix/quality-logger.ts
// Follows usage-logger.ts pattern: JSON-lines, env-var gated

import * as fs from "fs";
import * as path from "path";
import type { QualityWarning } from "./quality-validate";

export interface QualityLogRecord {
  timestamp: string;
  device: string;
  presetName: string;
  warningCount: number;
  warnings: QualityWarning[];
}

export function logQualityWarnings(
  warnings: QualityWarning[],
  context: { device: string; presetName: string },
  logPath?: string,
): void {
  // Always log to console.warn for server-side visibility
  if (warnings.length > 0) {
    console.warn(
      `[quality] ${context.device}/${context.presetName}: ${warnings.length} warning(s): ` +
      warnings.map(w => w.code).join(", ")
    );
  }

  // JSON-lines file logging gated by LOG_QUALITY env var
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
```

### Pipeline Integration
```typescript
// In src/app/api/generate/route.ts -- add between Step 4 and Step 5:
import { validatePresetQuality } from "@/lib/helix/quality-validate";
import { logQualityWarnings } from "@/lib/helix/quality-logger";

// ... existing code ...

// Step 4: Strict validation -- fail fast on structural errors
validatePresetSpec(presetSpec, caps);

// Step 4.5: Quality validation -- advisory warnings, never blocks
const qualityWarnings = validatePresetQuality(presetSpec, caps);
if (qualityWarnings.length > 0) {
  logQualityWarnings(qualityWarnings, {
    device: deviceTarget,
    presetName: presetSpec.name,
  });
}

// Step 5: Build preset file (ALWAYS proceeds)
```

### Baseline Generator (Deterministic)
```typescript
// scripts/baseline-generator.ts
import { assembleSignalChain } from "../src/lib/helix/chain-rules";
import { resolveParameters } from "../src/lib/helix/param-engine";
import { buildSnapshots } from "../src/lib/helix/snapshot-engine";
import { validatePresetQuality } from "../src/lib/helix/quality-validate";
import { getCapabilities } from "../src/lib/helix/device-family";
import type { DeviceTarget } from "../src/lib/helix/types";
import type { ToneIntent } from "../src/lib/helix/tone-intent";

const DEVICES: DeviceTarget[] = [
  "helix_lt", "helix_floor", "helix_stomp", "helix_stomp_xl", "pod_go", "helix_stadium"
];
const GENRES = ["blues", "rock", "metal", "jazz", "ambient", "country"];

// Fixed ToneIntent per genre -- deterministic, no AI needed
const GENRE_INTENTS: Record<string, Partial<ToneIntent>> = {
  blues: {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    genreHint: "blues",
    effects: [
      { modelName: "Transistor Tape", role: "toggleable" },
      { modelName: "Plate", role: "always_on" },
    ],
  },
  // ... similar for each genre
};

interface BaselineResult {
  device: string;
  genre: string;
  warningCount: number;
  warningCodes: string[];
}

// Generate 36 presets (6 devices x 6 genres), collect warnings
const results: BaselineResult[] = [];
for (const device of DEVICES) {
  const caps = getCapabilities(device);
  for (const genre of GENRES) {
    // Build deterministic ToneIntent with device-appropriate model names
    const intent = buildGenreIntent(genre, caps);
    const chain = assembleSignalChain(intent, caps);
    const parameterized = resolveParameters(chain, intent, caps);
    const snapshots = buildSnapshots(parameterized, intent.snapshots);
    const spec = { name: `${genre}-${device}`, description: "", tempo: 120, signalChain: parameterized, snapshots };
    const warnings = validatePresetQuality(spec, caps);
    results.push({
      device, genre,
      warningCount: warnings.length,
      warningCodes: warnings.map(w => w.code),
    });
  }
}
// Write results to baseline.json
```

## Quality Check Catalog

Complete list of quality checks to implement, with thresholds derived from param-engine.ts expert consensus tables.

### Parameter Checks (per-block)

| Code | Block Type | Check | Threshold | Basis |
|------|-----------|-------|-----------|-------|
| `REVERB_MIX_HIGH` | reverb | Mix > threshold | 0.60 | Max genre default 0.50 (ambient) + margin |
| `DELAY_FEEDBACK_HIGH` | delay | Feedback > threshold | 0.70 | Max genre default 0.50 (ambient) + margin |
| `DELAY_MIX_HIGH` | delay | Mix > threshold | 0.55 | Max genre default 0.40 (ambient) + margin |
| `CAB_NO_LOWCUT` | cab | LowCut < threshold | 30.0 Hz | Min useful filtering 80 Hz; < 30 = effectively none |
| `CAB_NO_HIGHCUT` | cab | HighCut > threshold | 18000.0 Hz | Max useful filtering ~8000 Hz; > 18000 = effectively none |
| `DRIVE_EXTREME` | distortion | Drive/Gain > threshold | 0.90 | Expert consensus rarely exceeds 0.50 for boost |
| `AMP_DRIVE_EXTREME` | amp | Drive > threshold | 0.85 | Expert consensus: clean 0.25, crunch 0.50, high_gain 0.40 |

### Structural Checks (preset-level)

| Code | Check | Details |
|------|-------|---------|
| `SNAPSHOT_LEVEL_IMBALANCE` | ChVol spread across snapshots > 0.25 | Normal spread is ~0.15 (0.65-0.80) |
| `SNAPSHOT_GAIN_IMBALANCE` | Gain dB spread across snapshots > 5.0 | Normal: 0.0-2.5 dB range |
| `NO_TIME_EFFECTS` | No delay or reverb in signal chain | Presets without any spatial effect sound dry/amateur |
| `REVERB_WITHOUT_CAB_FILTERING` | Reverb present but cab has no HighCut | Reverb amplifies harshness if cab isn't filtering highs |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Auto-correct silently (validateAndFixPresetSpec) | Throw on structural errors (validatePresetSpec) | Phase 4 | Bugs surface immediately instead of hiding |
| No quality feedback | Console.warn for specific issues (cab LowCut, chain-rules fallbacks) | Phases 52-60 | Ad-hoc warnings, not systematic |
| (NEW) Systematic quality validation | validatePresetQuality() with typed warnings | Phase 74 | Complete quality visibility across all presets |

**Deprecated/outdated:**
- `validateAndFixPresetSpec()`: Still exists in validate.ts but unused in the generate pipeline since Phase 4. The generate route uses `validatePresetSpec()` (throwing variant). Quality validation is a third layer alongside, not replacing, either existing function.

## Open Questions

1. **Should quality warnings be included in the API response?**
   - What we know: Requirements say "logged for analysis" and "never block the user". The API currently returns `{ preset, summary, spec, toneIntent, device }`.
   - What's unclear: Whether frontend should display quality info (even as debug info).
   - Recommendation: Do NOT include in API response for v6.0. Log server-side only. Adding to the response is a future enhancement if needed.

2. **How many genres should the baseline cover?**
   - What we know: param-engine.ts has 9 genre profiles (blues, rock, metal, jazz, country, ambient, worship, funk, pop). There are 6 device families that map to 8+ DeviceTargets.
   - What's unclear: Whether to use all 9 genres x 6 devices (54 presets) or a representative subset.
   - Recommendation: Use 6 representative genres (blues, rock, metal, jazz, ambient, country) x 6 devices = 36 presets. This matches the "36-preset baseline" mentioned in success criteria.

3. **Stadium amp parameter thresholds**
   - What we know: Stadium amps use raw firmware values (not 0.0-1.0 normalized). validate.ts already skips Stadium amp blocks for range checks.
   - What's unclear: What constitutes "suboptimal" for raw firmware parameters.
   - Recommendation: Skip amp-level quality checks for Stadium amps initially. Focus quality checks on effects and cab blocks, which use the same parameter encoding as HD2 devices.

## Sources

### Primary (HIGH confidence)
- `src/lib/helix/validate.ts` -- Existing structural validation patterns, type-aware parameter handling
- `src/lib/helix/param-engine.ts` -- Expert consensus parameter tables, genre effect defaults, combination adjustments
- `src/lib/helix/snapshot-engine.ts` -- ROLE_CHVOL and ROLE_GAIN_DB tables for snapshot balance thresholds
- `src/lib/helix/chain-rules.ts` -- Signal chain assembly, slot ordering, combination rules (COMBO-01 through COMBO-04)
- `src/lib/helix/device-family.ts` -- DeviceCapabilities interface, per-device constants
- `src/app/api/generate/route.ts` -- Pipeline flow, insertion point for quality validation
- `src/lib/usage-logger.ts` -- Logging pattern (JSON-lines, env-var gated, appendFileSync)

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` -- QUAL-01, QUAL-02, QUAL-03 requirement definitions
- `.planning/ROADMAP.md` -- Phase 74 success criteria, dependency chain

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, pure TypeScript functions following existing patterns
- Architecture: HIGH -- Pipeline insertion point is clear, logging pattern is established
- Quality check thresholds: HIGH -- All derived from existing expert consensus tables in param-engine.ts
- Baseline generator: MEDIUM -- Requires careful fixture design for Stadium (Agoura amp names) vs HD2 devices
- Pitfalls: HIGH -- Based on actual code analysis of parameter encoding differences

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- quality checks are deterministic, not dependent on external APIs)
