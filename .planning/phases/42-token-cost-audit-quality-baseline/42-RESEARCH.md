# Phase 42: Token Cost Audit + Quality Baseline — Research

**Researched:** 2026-03-04
**Domain:** API token instrumentation, test fixture generation, prompt cache measurement
**Confidence:** HIGH

---

## Summary

Phase 42 establishes the measurement infrastructure that all subsequent v4.0 quality work depends on. It has three distinct deliverables: (1) per-request token logging behind an env flag for both API endpoints, (2) a 36-file deterministic baseline corpus (6 tones × 6 devices) whose ToneIntent snapshots can be diffed against future changes, and (3) a cache hit rate report that tells the team whether the current prompt caching strategy is effective.

The Anthropic SDK already exposes all token counts needed on every `response.usage` object — `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, and `cache_read_input_tokens`. These are available on the `Message` object returned by `client.messages.create()` in `planner.ts`. The Gemini SDK exposes matching data via `chunk.usageMetadata` on the final chunk of a `sendMessageStream()` call — fields `promptTokenCount`, `candidatesTokenCount`, `cachedContentTokenCount`, and `totalTokenCount`. No additional SDK dependencies are required for token logging.

The quality baseline (AUDIT-02) does not call the live AI — it drives the Knowledge Layer pipeline directly using deterministic ToneIntent fixtures for each scenario. This means the baseline is fast, free, and fully reproducible without API keys. The baseline script can be run with `vitest --reporter=verbose` or as a standalone Node script that writes files to disk. The cache hit rate report (AUDIT-03) requires 20+ live planner calls; it is a separate script that makes real API calls and reads `cache_read_input_tokens > 0` as the cache-hit signal.

**Primary recommendation:** Implement token logging as a thin wrapper in `planner.ts` (and a parallel wrapper in the chat route) that writes a JSON-lines log file when `LOG_USAGE=true`. The baseline suite is a standalone vitest integration test file. The cache report is a small Node script that runs the planner 20+ times and aggregates usage.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUDIT-01 | Per-request token logging on `/api/chat` (Gemini) and `/api/generate` (Claude) — prompt tokens, completion tokens, total tokens, cached tokens, cost estimate. Summary script over 10 runs. | Anthropic SDK `response.usage` object provides all fields. Gemini last-chunk `usageMetadata` provides matching data. LOG_USAGE env flag gates the behavior. |
| AUDIT-02 | 36-preset baseline corpus (6 tones × 6 devices) with deterministic ToneIntent snapshots. Diffable against future changes. | All 6 device types in `DeviceTarget`. 6 tone scenarios map to ToneIntentSchema fixtures. Knowledge Layer pipeline (`assembleSignalChain` + `resolveParameters` + `buildSnapshots`) is fully deterministic without AI. Output to `scripts/baseline/` as JSON files. |
| AUDIT-03 | Cache hit rate report across 20+ generations. Shows % of planner calls hitting prompt cache vs cold starts. Specific recommendations if below 50%. | `cache_read_input_tokens > 0` = cache hit in Anthropic SDK. The planner already uses `cache_control: { type: "ephemeral" }` on the system prompt block. Need to measure actual hit rate in practice. |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.78.0` (already installed) | Token usage data from Claude planner calls | `response.usage` has all AUDIT-01 fields natively |
| `@google/genai` | `^1.42.0` (already installed) | Token usage data from Gemini chat calls | `chunk.usageMetadata` on final stream chunk |
| `vitest` | `^4.0.18` (already installed) | Baseline test suite and unit tests | Already configured with vitest.config.ts |
| Node `fs` (built-in) | N/A | Write JSON-lines log and 36-file baseline to disk | No additional dependency needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `process.env.LOG_USAGE` | N/A | Feature flag to gate logging | Check `process.env.LOG_USAGE === "true"` before any logging I/O |
| `JSON.stringify` with newline | N/A | JSON-lines format for log file | One JSON object per line, easily parsed by `jq` or Node |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JSON-lines flat file | Supabase table for usage logs | File is simpler, no DB dependency for dev tooling; Supabase appropriate only if prod monitoring needed |
| `process.env.LOG_USAGE` env flag | Separate config file | Env flag is the standard Next.js pattern and matches existing `CLAUDE_API_KEY` / `GEMINI_API_KEY` pattern |
| Vitest integration test for baseline | Standalone `tsx` script | Vitest gives structured output, `describe/it` grouping, and existing infra; standalone script is simpler for CI |

**Installation:** No new packages required. All needed libraries are already in `package.json`.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── usage-logger.ts       # Shared token logging utility (LOG_USAGE guard + write logic)
├── app/api/
│   ├── chat/route.ts         # Add: accumulate Gemini usage from final stream chunk
│   └── generate/route.ts     # Add: call logPlannerUsage() after callClaudePlanner()
scripts/
├── baseline/                  # Output: 36 JSON files written by baseline suite
├── generate-baseline.ts       # Standalone script or vitest file for AUDIT-02
└── cache-hit-report.ts        # Standalone script for AUDIT-03 (makes live API calls)
```

### Pattern 1: Token Logging in `planner.ts`

**What:** After `client.messages.create()` returns, read `response.usage` and write to log if `LOG_USAGE=true`.

**When to use:** Every `/api/generate` call that goes through `callClaudePlanner()`.

**Example:**
```typescript
// src/lib/usage-logger.ts
import fs from "fs";
import path from "path";

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
}

// Claude Sonnet 4.6 pricing (as of 2026-03-04)
// Source: https://platform.claude.com/docs/en/about-claude/pricing
const CLAUDE_SONNET_PRICE = {
  input_per_mtok: 3.00,       // $3.00 / 1M input tokens
  output_per_mtok: 15.00,     // $15.00 / 1M output tokens
  cache_write_per_mtok: 3.75, // $3.75 / 1M (1.25x input — 5-minute ephemeral)
  cache_read_per_mtok: 0.30,  // $0.30 / 1M (0.1x input)
};

export function estimateClaudeCost(usage: {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
}): number {
  const inputCost = (usage.input_tokens / 1_000_000) * CLAUDE_SONNET_PRICE.input_per_mtok;
  const outputCost = (usage.output_tokens / 1_000_000) * CLAUDE_SONNET_PRICE.output_per_mtok;
  const cacheWriteCost = ((usage.cache_creation_input_tokens ?? 0) / 1_000_000) * CLAUDE_SONNET_PRICE.cache_write_per_mtok;
  const cacheReadCost = ((usage.cache_read_input_tokens ?? 0) / 1_000_000) * CLAUDE_SONNET_PRICE.cache_read_per_mtok;
  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

export function logUsage(record: PlannerUsageRecord): void {
  if (process.env.LOG_USAGE !== "true") return;
  const logPath = path.resolve(process.cwd(), "usage.jsonl");
  const line = JSON.stringify(record) + "\n";
  fs.appendFileSync(logPath, line, "utf8");
}
```

**Hooking into planner.ts** — after `client.messages.create()`:
```typescript
// In callClaudePlanner(), after response is received:
import { logUsage, estimateClaudeCost } from "@/lib/usage-logger";

// response.usage is available on the Message object
const { usage } = response;
logUsage({
  timestamp: new Date().toISOString(),
  endpoint: "generate",
  model: "claude-sonnet-4-6",
  input_tokens: usage.input_tokens,
  output_tokens: usage.output_tokens,
  cache_creation_input_tokens: usage.cache_creation_input_tokens,
  cache_read_input_tokens: usage.cache_read_input_tokens,
  total_tokens: usage.input_tokens + usage.output_tokens,
  cost_usd: estimateClaudeCost(usage),
  cache_hit: (usage.cache_read_input_tokens ?? 0) > 0,
});
```

### Pattern 2: Token Logging in Chat Route (Gemini Streaming)

**What:** Gemini streaming chunks each carry `usageMetadata`. Only the LAST chunk contains the final cumulative counts. Capture the final chunk's data after the stream closes.

**When to use:** Every `/api/chat` call's `chat.sendMessageStream()`.

**Example:**
```typescript
// In /api/chat/route.ts — inside the ReadableStream start() callback
let finalUsage: GenerateContentResponseUsageMetadata | undefined;

for await (const chunk of stream) {
  const text = chunk.text;
  if (text) {
    fullContent += text;
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
  }
  // Capture usage from every chunk — last one wins (final cumulative counts)
  if (chunk.usageMetadata) {
    finalUsage = chunk.usageMetadata;
  }
}

// After stream closes — log usage
if (finalUsage) {
  logUsage({
    timestamp: new Date().toISOString(),
    endpoint: "chat",
    model: modelId,
    input_tokens: finalUsage.promptTokenCount ?? 0,
    output_tokens: finalUsage.candidatesTokenCount ?? 0,
    cache_creation_input_tokens: null, // Gemini uses different caching model
    cache_read_input_tokens: finalUsage.cachedContentTokenCount ?? null,
    total_tokens: finalUsage.totalTokenCount ?? 0,
    cost_usd: estimateGeminiCost(finalUsage, modelId),
    cache_hit: (finalUsage.cachedContentTokenCount ?? 0) > 0,
  });
}
```

### Pattern 3: Deterministic Baseline Suite (AUDIT-02)

**What:** A script that creates hardcoded ToneIntent objects for each of the 6 tone scenarios × 6 devices, runs them through the Knowledge Layer pipeline, and writes the ToneIntent + PresetSpec to disk as JSON files.

**Key insight:** The baseline does NOT call Claude or Gemini. It drives the Knowledge Layer directly. This makes it deterministic, free, and runnable in CI.

**6 tone scenarios (one per category):**
1. `clean` — "edge-of-breakup blues" (clean amp, single coil)
2. `crunch` — "classic rock rhythm" (crunch amp, humbucker)
3. `high_gain` — "modern metal" (high-gain amp, humbucker)
4. `ambient` — "ambient pad" (clean amp with heavy reverb/delay)
5. `edge_of_breakup` — Mapped as `crunch` tone role with clean amp pushed
6. `dual_amp` — Two-amp preset (LT/Floor only; Stadium/Stomp/PodGo use single amp)

**6 devices:** `helix_lt`, `helix_floor`, `pod_go`, `helix_stadium`, `helix_stomp`, `helix_stomp_xl`

**Output:** `scripts/baseline/{tone}-{device}.json` — each file contains:
```json
{
  "scenario": "clean_helix_lt",
  "toneIntent": { ... },
  "presetSpec": { ... },
  "generatedAt": "2026-03-04T..."
}
```

**Example baseline fixture:**
```typescript
// scripts/generate-baseline.ts
import { assembleSignalChain, resolveParameters, buildSnapshots } from "@/lib/helix";
import type { ToneIntent, DeviceTarget } from "@/lib/helix";
import fs from "fs";
import path from "path";

const TONE_SCENARIOS: Array<{ id: string; intent: ToneIntent }> = [
  {
    id: "clean",
    intent: {
      ampName: "US Deluxe Nrm",
      cabName: "1x12 US Deluxe",
      guitarType: "single_coil",
      genreHint: "edge-of-breakup blues",
      effects: [
        { modelName: "Minotaur", role: "always_on" },
        { modelName: "Transistor Tape", role: "toggleable" },
        { modelName: "Glitz", role: "always_on" },
      ],
      snapshots: [
        { name: "CLEAN", toneRole: "clean" },
        { name: "RHYTHM", toneRole: "crunch" },
        { name: "LEAD", toneRole: "lead" },
        { name: "AMBIENT", toneRole: "ambient" },
      ],
    },
  },
  // ... crunch, high_gain, ambient, edge_of_breakup, dual_amp scenarios
];

const DEVICES: DeviceTarget[] = [
  "helix_lt", "helix_floor", "pod_go",
  "helix_stadium", "helix_stomp", "helix_stomp_xl"
];
```

### Pattern 4: Cache Hit Rate Report (AUDIT-03)

**What:** A script that calls `callClaudePlanner()` 20+ times with the 6 baseline scenarios (repeated across devices) while `LOG_USAGE=true`, then reads `usage.jsonl` and reports cache stats.

**Cache hit detection:** `cache_read_input_tokens > 0` means the system prompt was served from cache. `cache_creation_input_tokens > 0` means a cold start that wrote to cache.

**Key insight about how Anthropic prompt caching works (verified from planner.ts):**
The planner already sets `cache_control: { type: "ephemeral" }` on the system prompt block. Ephemeral cache has a 5-minute TTL. Cache hits require identical system prompt content AND the cache not having expired. If the same system prompt is called within 5 minutes, subsequent calls hit the cache.

**Cache hit report output example:**
```
=== Cache Hit Rate Report (20 planner calls) ===
Total calls: 20
Cache hits: 14 (70%)
Cold starts: 6 (30%)
Average input tokens (cold): 3,241
Average input tokens (cached): 412
Average output tokens: 387
Average cost/call (cold): $0.0154
Average cost/call (cached): $0.0033
Estimated savings from caching: $0.142 over 20 calls

RECOMMENDATION: Cache hit rate 70% — above 50% threshold. No action needed.
```

### Anti-Patterns to Avoid

- **Logging inside the streaming ReadableStream callback synchronously with `fs.writeFileSync`:** This blocks the event loop mid-stream. Use `appendFileSync` AFTER the stream closes (after `controller.close()`), or use a fire-and-forget async write.
- **Including LOG_USAGE logic in production hot path unconditionally:** Always guard with `if (process.env.LOG_USAGE !== "true") return;` as the first line of `logUsage()`.
- **Calling the live Claude/Gemini API from the baseline script:** The baseline (AUDIT-02) must be deterministic and free. Use ToneIntent fixtures + Knowledge Layer only.
- **Running the cache hit test with 5+ minute gaps between calls:** Ephemeral cache TTL is 5 minutes. The 20-call test should run in a single script execution to get meaningful cache hit data.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token count access | Custom token counting | `response.usage` (Anthropic) / `chunk.usageMetadata` (Gemini) | SDK already provides exact counts; tokenizers are model-specific and complex |
| Cache hit detection | Heuristic timing analysis | `cache_read_input_tokens > 0` from response | Anthropic explicitly signals cache hits in the usage object |
| Log file format | Binary format, SQLite | JSON-lines (`.jsonl`) | Human-readable, appendable, parseable with `jq`, grep, or a 5-line Node script |
| Baseline file format | Custom binary format | Plain JSON files | Diffable with `git diff`, readable with any tool, matches existing `.hlx`/`.pgp` patterns |
| Cost calculation | Third-party cost estimation API | Inline multiplication using known pricing | Prices are stable constants; no API needed |

**Key insight:** All token data is already in the API response objects. This phase is primarily about surfacing and persisting data that already exists.

---

## Common Pitfalls

### Pitfall 1: Gemini Usage Only in Final Stream Chunk

**What goes wrong:** Reading `chunk.usageMetadata` only from the first chunk yields zeros. Token counts accumulate across chunks and the final totals appear only in the last chunk.

**Why it happens:** Gemini streaming returns partial counts in intermediate chunks; only the final chunk has the complete picture.

**How to avoid:** Track `finalUsage` across the loop — reassign on every chunk, use the value after the loop ends.

**Warning signs:** Seeing `promptTokenCount: 0` or `totalTokenCount: 0` in logs.

---

### Pitfall 2: Anthropic Cache TTL Invalidation During Tests

**What goes wrong:** The cache hit rate test shows 0% cache hits even though `cache_control: ephemeral` is set.

**Why it happens:** Ephemeral cache TTL is 5 minutes. If the test runs slowly or the system prompt content changes between calls (e.g., different `device` parameter causing `buildPlannerPrompt()` to return different content), the cache is invalidated.

**How to avoid:** Run the 20-call cache test within a tight loop (all calls for the same device type), ensuring the system prompt hash is identical across all test calls.

**Warning signs:** `cache_creation_input_tokens > 0` on every call, `cache_read_input_tokens: null` throughout.

---

### Pitfall 3: Dual-Amp Baseline Failing on Single-DSP Devices

**What goes wrong:** The baseline generator crashes or produces invalid presets when running the `dual_amp` scenario against `pod_go`, `helix_stomp`, or `helix_stomp_xl`.

**Why it happens:** `secondAmpName` is forbidden on those devices. The chain-rules layer will throw or produce invalid output.

**How to avoid:** In the baseline generator, skip the dual-amp scenario for `pod_go`, `helix_stomp`, and `helix_stomp_xl`. Use a single-amp variant for those devices instead (replace with the `crunch` scenario). This keeps the 36-file target (6 × 6) by using 5 unique scenarios + 1 device-adapted scenario.

**Warning signs:** `validatePresetSpec()` throwing for Stomp/PodGo dual-amp combinations.

---

### Pitfall 4: Stadium Baseline Using Non-Stadium Models

**What goes wrong:** The baseline generator crashes on `helix_stadium` because the ToneIntent fixtures use standard Helix amp/cab names, but Stadium requires `Agoura_*` models.

**Why it happens:** `getModelListForPrompt("helix_stadium")` returns only Stadium-compatible models. Stadium amp names differ from standard Helix amp names (e.g., "Agoura 45" not "US Deluxe Nrm").

**How to avoid:** Create device-specific ToneIntent fixtures for `helix_stadium` that use valid Stadium amp/cab names. Check `src/lib/helix/models.ts` for `stadiumOnly: true` entries.

**Warning signs:** Zod validation error on `ampName` for Stadium scenarios.

---

### Pitfall 5: `fs.appendFileSync` in Vercel Edge Environment

**What goes wrong:** The logging fails silently or throws in production because Vercel serverless functions run in a read-only filesystem; `fs.appendFileSync` cannot write to disk.

**Why it happens:** Vercel's serverless environment has a read-only filesystem except for `/tmp`.

**How to avoid:** This is a dev/local-only feature gated by `LOG_USAGE=true`. Never set this in production (Vercel) environments. The guard `if (process.env.LOG_USAGE !== "true") return;` prevents any file I/O in production. Document this in the `.env.local.example` file.

**Warning signs:** Silent log writes with no output file, or `EROFS: read-only file system` errors.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Reading Anthropic Usage (existing planner.ts pattern)

```typescript
// Source: @anthropic-ai/sdk types — resources/messages/messages.d.ts
// response.usage shape:
// {
//   input_tokens: number;
//   output_tokens: number;
//   cache_creation_input_tokens: number | null;
//   cache_read_input_tokens: number | null;
// }

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: userContent }],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});

// Token data is always present on the response
const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = response.usage;
const cacheHit = (cache_read_input_tokens ?? 0) > 0;
```

### Reading Gemini Usage from Streaming Response

```typescript
// Source: @google/genai types — GenerateContentResponseUsageMetadata
// chunk.usageMetadata fields:
// {
//   promptTokenCount?: number;
//   candidatesTokenCount?: number;
//   cachedContentTokenCount?: number;
//   totalTokenCount?: number;
// }

let finalUsage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number; cachedContentTokenCount?: number } | undefined;

for await (const chunk of stream) {
  const text = chunk.text;
  if (text) fullContent += text;
  if (chunk.usageMetadata) finalUsage = chunk.usageMetadata;
}

// After loop: finalUsage has final cumulative counts
if (finalUsage) {
  const promptTokens = finalUsage.promptTokenCount ?? 0;
  const completionTokens = finalUsage.candidatesTokenCount ?? 0;
  const cachedTokens = finalUsage.cachedContentTokenCount ?? 0;
}
```

### JSON-Lines Log Format

```typescript
// usage.jsonl (one record per line)
{"timestamp":"2026-03-04T10:00:00Z","endpoint":"generate","model":"claude-sonnet-4-6","input_tokens":3241,"output_tokens":387,"cache_creation_input_tokens":3100,"cache_read_input_tokens":null,"total_tokens":3628,"cost_usd":0.01543,"cache_hit":false}
{"timestamp":"2026-03-04T10:00:05Z","endpoint":"generate","model":"claude-sonnet-4-6","input_tokens":141,"output_tokens":390,"cache_creation_input_tokens":null,"cache_read_input_tokens":3100,"total_tokens":531,"cost_usd":0.00682,"cache_hit":true}
```

### Summary Script (AUDIT-01 acceptance)

```typescript
// scripts/summarize-usage.ts
import fs from "fs";

const lines = fs.readFileSync("usage.jsonl", "utf8").trim().split("\n");
const records = lines.map(l => JSON.parse(l));
const generateCalls = records.filter(r => r.endpoint === "generate");
const chatCalls = records.filter(r => r.endpoint === "chat");

function avg(arr: number[]) { return arr.reduce((a, b) => a + b, 0) / arr.length; }

console.log("=== /api/generate (Claude planner) ===");
console.log(`Calls: ${generateCalls.length}`);
console.log(`Avg input tokens: ${avg(generateCalls.map(r => r.input_tokens)).toFixed(0)}`);
console.log(`Avg output tokens: ${avg(generateCalls.map(r => r.output_tokens)).toFixed(0)}`);
console.log(`Avg total tokens: ${avg(generateCalls.map(r => r.total_tokens)).toFixed(0)}`);
console.log(`Avg cached tokens: ${avg(generateCalls.map(r => r.cache_read_input_tokens ?? 0)).toFixed(0)}`);
console.log(`Avg cost/call: $${avg(generateCalls.map(r => r.cost_usd)).toFixed(5)}`);

// Repeat for chatCalls...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No token visibility | `response.usage` on every API response | Anthropic SDK has always provided this | Zero cost to access; just needs to be logged |
| Manual prompt cache verification | `cache_read_input_tokens > 0` signal | Anthropic added explicit cache signals in 2024 | Deterministic cache hit detection, no heuristics |
| Fixed-seed generation for baselines | Knowledge Layer is deterministic by design | Phase 2 (planner architecture) | Baseline generation requires no seeding hack |

**Deprecated/outdated:**
- Guessing cache effectiveness from latency: The Anthropic SDK now explicitly returns `cache_read_input_tokens` and `cache_creation_input_tokens` — there is no need to infer from timing.

---

## Open Questions

1. **Where should `usage.jsonl` be written on disk?**
   - What we know: `process.cwd()` in Next.js dev server points to project root. Vercel is read-only so this is moot for production.
   - What's unclear: Whether project root is the right location vs. a `.logs/` subdirectory.
   - Recommendation: Write to `./usage.jsonl` at project root (same convention as other dev tooling). Add to `.gitignore`.

2. **Should `helix_stadium` dual-amp be explicitly skipped or produce a single-amp variant?**
   - What we know: Stadium supports dual paths but uses `Agoura_*` models only. The current planner route doesn't block dual-amp for Stadium.
   - What's unclear: Whether `secondAmpName` is valid for Stadium presets.
   - Recommendation: Skip dual-amp for Stadium in the baseline; produce a single-amp Stadium scenario instead. Revisit when Stadium support is more mature.

3. **Gemini Flash prompt caching (AUDIT-03 scope)**
   - What we know: Gemini supports context caching via the CachedContent API, but the chat route uses `chat.sendMessageStream()` without explicit `cachedContent`. `cachedContentTokenCount` may be 0 unless context caching is explicitly configured.
   - What's unclear: Whether Google's implicit caching applies to repeated `systemInstruction` content without explicit cache setup.
   - Recommendation: Report `cachedContentTokenCount` from Gemini logs as-is. If it's 0 across all calls, note that Gemini implicit caching differs from Anthropic's — AUDIT-03 scope can focus primarily on Claude planner cache stats where caching is explicitly configured and verified.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/helix/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | `logUsage()` does nothing when `LOG_USAGE` is unset | unit | `npx vitest run src/lib/usage-logger.test.ts` | No — Wave 0 |
| AUDIT-01 | `logUsage()` appends a valid JSON line when `LOG_USAGE=true` | unit | `npx vitest run src/lib/usage-logger.test.ts` | No — Wave 0 |
| AUDIT-01 | `estimateClaudeCost()` calculates correct cost for known inputs | unit | `npx vitest run src/lib/usage-logger.test.ts` | No — Wave 0 |
| AUDIT-02 | Knowledge Layer pipeline produces valid PresetSpec for all 6 devices × 6 tone scenarios | integration | `npx vitest run scripts/generate-baseline.test.ts` | No — Wave 0 |
| AUDIT-02 | 36 baseline JSON files contain `toneIntent` and `presetSpec` keys | integration | `npx vitest run scripts/generate-baseline.test.ts` | No — Wave 0 |
| AUDIT-03 | Cache hit rate report reads `usage.jsonl` and reports correct percentages | unit | `npx vitest run scripts/cache-hit-report.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/usage-logger.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- `src/lib/usage-logger.test.ts` — covers AUDIT-01 (unit tests for logUsage and cost estimation)
- `scripts/generate-baseline.test.ts` — covers AUDIT-02 (36-file generation and validation)
- `scripts/cache-hit-report.test.ts` — covers AUDIT-03 (report parsing logic)
- No framework install needed — vitest already configured

---

## Sources

### Primary (HIGH confidence)
- `@anthropic-ai/sdk` types — `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` line 541 — Message.usage interface verified locally
- `@google/genai` types — `node_modules/@google/genai/dist/genai.d.ts` line 4375 — GenerateContentResponseUsageMetadata verified locally
- `src/lib/planner.ts` (project source) — existing `cache_control: ephemeral` pattern, response shape
- `src/app/api/chat/route.ts` (project source) — streaming architecture, where usage can be captured
- `src/lib/helix/types.ts` (project source) — DeviceTarget union, all 6 device identifiers

### Secondary (MEDIUM confidence)
- [Anthropic pricing page](https://platform.claude.com/docs/en/about-claude/pricing) — Claude Sonnet 4.6: $3/$15 per MTok input/output; cache read $0.30/MTok; cache write (5-min ephemeral) 1.25x = $3.75/MTok
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) — Gemini 2.5 Flash: $0.30/$2.50 per MTok input/output; cached reads at 10% of input price
- WebSearch result: Anthropic ephemeral cache TTL is 5 minutes (matches `cache_control: { type: "ephemeral" }` in planner.ts)

### Tertiary (LOW confidence)
- Gemini implicit caching behavior for `systemInstruction` without explicit CachedContent API — not verified with official docs. Treat `cachedContentTokenCount` from Gemini as potentially always 0 until tested.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are already installed; API shapes verified from local node_modules type definitions
- Architecture: HIGH — logging pattern is straightforward; baseline generation reuses existing Knowledge Layer pipeline which is already tested
- Pitfalls: HIGH — all pitfalls derived from verified technical constraints (Vercel read-only fs, Anthropic cache TTL, device model constraints)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (pricing data may shift; API shapes are stable)
