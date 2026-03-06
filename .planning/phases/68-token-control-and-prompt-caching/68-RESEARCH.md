# Phase 68: Token Control and Prompt Caching - Research

**Researched:** 2026-03-06
**Domain:** Anthropic prompt caching, token budgeting, per-family prompt economics
**Confidence:** HIGH

## Summary

Phase 68 has two distinct tracks that are independent and can be planned in separate plans. The first track is **measurement and diagnosis**: extend the existing cache-hit-report infrastructure to report per-device cache stats, fix a confirmed pricing bug in `usage-logger.ts` (it prices 1h writes at $3.75/MTok instead of the correct $6.00/MTok), and add a `client.messages.countTokens()` call to measure actual prompt token sizes per family. The second track is **structural optimization**: based on measurements, determine whether Stadium and Pod Go need a shared "constrained-device" prompt bucket to sustain cache hits, and audit whether the model catalog embedded in `modelList` can be trimmed for low-volume families.

The system already has prompt caching wired correctly: `planner.ts` passes `cache_control: { type: "ephemeral", ttl: "1h" }` on the system prompt block, and `usage-logger.ts` records `cache_read_input_tokens` per call with a `device` field. The 1h TTL is the right choice for a web app where the same family's prompt may be reused across user sessions hours apart. The only structural gap is that `helix_stomp` and `helix_stomp_xl` currently produce **different** planner system prompts (because `buildPlannerPrompt` interpolates `deviceName`, `maxBlocks`, and `maxSnapshots` directly into the prompt body), giving each its own cache entry. This halves cache hit rate for the Stomp family and doubles cold-write cost.

**Primary recommendation:** Fix the pricing bug first (one-liner). Add per-device token counting to measure actual system prompt sizes. Restructure Stomp's `buildPlannerPrompt` to produce identical text for both Stomp variants (move device-specific restriction to user message), matching the existing Helix pattern (helix_lt and helix_floor already share a single cache entry). Defer any prompt-trimming work until measurements confirm which families have bloated catalogs.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | `^0.78.0` (installed) | `client.messages.countTokens()` for prompt size measurement; `cache_control` for caching; `response.usage` for hit tracking | Already the planner's API client; all caching APIs are part of this SDK |
| `vitest` | `^4.0.18` (installed) | Unit tests for updated cache analysis functions | Already configured in `vitest.config.ts` |
| Node `fs` (built-in) | N/A | `usage.jsonl` appending for usage-logger; reading in analysis scripts | Already used in `usage-logger.ts` and scripts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `npx tsx` | (via node_modules) | Running TypeScript scripts directly | For `scripts/summarize-usage.ts`, `cache-hit-report.ts` |
| `process.env.LOG_USAGE` | N/A | Guards all file I/O in usage-logger | Set `LOG_USAGE=true` locally; never in Vercel prod |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fix pricing in `usage-logger.ts` | Leave it wrong | Wrong numbers mislead cost analysis — must fix |
| `client.messages.countTokens()` | Manual character-based estimation | SDK call is exact; estimation is error-prone and model-specific |
| Per-device cache via shared bucket for Stomp | Keep separate caches | 2 separate cache entries at 2x write cost vs 1 shared entry |

**Installation:** No new packages required.

## Architecture Patterns

### Current State: What Exists

```
src/lib/
├── usage-logger.ts           # PlannerUsageRecord, logUsage(), estimateClaudeCost()
│                             # BUG: cache_write_per_mtok = 3.75 (should be 6.00 for 1h TTL)
├── planner.ts                # cache_control: { type: "ephemeral", ttl: "1h" } — correct
├── prompt-router.ts          # getFamilyPlannerPrompt(), getFamilyChatPrompt()
└── families/
    ├── helix/prompt.ts       # helix_lt + helix_floor → IDENTICAL text → 1 cache entry ✓
    ├── stomp/prompt.ts       # helix_stomp vs helix_stomp_xl → DIFFERENT text → 2 entries ✗
    ├── podgo/prompt.ts       # pod_go only → 1 cache entry ✓
    └── stadium/prompt.ts     # helix_stadium only → 1 cache entry ✓

scripts/
├── cache-hit-report.ts       # parseCacheReport(), formatReport() — aggregates all devices
├── summarize-usage.ts        # per-endpoint summary — does not break down by device
└── generate-baseline.ts      # deterministic Knowledge Layer pipeline tests
```

### Pattern 1: Pricing Bug Fix (usage-logger.ts)

**What:** The `CLAUDE_SONNET_PRICE.cache_write_per_mtok` constant is $3.75 (1.25x input — the 5-minute TTL price). But `planner.ts` uses `ttl: "1h"` which costs $6.00/MTok (2x input). Every cost estimate since Phase 42 has been 37.5% too low for the cache-write component.

**Why it happened:** Phase 42 research used the 5-minute pricing. The upgrade to `ttl: "1h"` happened later (Phase 65 era) and the constant was not updated.

**Fix:**
```typescript
// src/lib/usage-logger.ts — one-line change
export const CLAUDE_SONNET_PRICE = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_write_per_mtok: 6.0,   // 2x input for 1h ephemeral (was 3.75 — wrong)
  cache_read_per_mtok: 0.3,    // 0.1x input — unchanged
} as const;
```

Source: Official Anthropic pricing table (verified 2026-03-06):
- Claude Sonnet 4.6 cache writes (5m): $3.75/MTok (1.25x)
- Claude Sonnet 4.6 cache writes (1h): $6.00/MTok (2x)
- Claude Sonnet 4.6 cache reads: $0.30/MTok (0.1x)

### Pattern 2: Per-Device Cache Statistics

**What:** Extend `scripts/cache-hit-report.ts` to break down cache hit rates by device. The `device` field already exists on every `PlannerUsageRecord` (added in Phase 42, populated in `planner.ts`). The `parseCacheReport()` function currently aggregates all devices together.

**When to use:** After 20+ runs with `LOG_USAGE=true` across multiple device types — measures whether Stadium and Pod Go have a cache hit problem due to low request volume.

**Example extension:**
```typescript
// scripts/cache-hit-report.ts — add per-device breakdown
export interface PerDeviceStats {
  device: string;
  totalCalls: number;
  hitRate: number;
  avgCostCold: number;
  avgCostCached: number;
}

export function parseCacheReportByDevice(records: PlannerUsageRecord[]): PerDeviceStats[] {
  const generateRecords = records.filter(r => r.endpoint === "generate" && r.device);
  const deviceGroups = new Map<string, PlannerUsageRecord[]>();

  for (const record of generateRecords) {
    const device = record.device!;
    if (!deviceGroups.has(device)) deviceGroups.set(device, []);
    deviceGroups.get(device)!.push(record);
  }

  return Array.from(deviceGroups.entries()).map(([device, recs]) => {
    const hits = recs.filter(r => r.cache_hit);
    return {
      device,
      totalCalls: recs.length,
      hitRate: hits.length / recs.length,
      avgCostCold: recs.filter(r => !r.cache_hit).reduce((s,r) => s + r.cost_usd, 0) / (recs.filter(r => !r.cache_hit).length || 1),
      avgCostCached: hits.reduce((s,r) => s + r.cost_usd, 0) / (hits.length || 1),
    };
  });
}
```

### Pattern 3: Prompt Token Measurement

**What:** Call `client.messages.countTokens()` for each family's system prompt and log the result. This tells us the actual prompt sizes driving cache behavior, without making a generation call.

**Why it matters:** Anthropic Sonnet 4.6 requires a minimum of 2,048 tokens before the cache breakpoint for caching to activate. If any family's system prompt is under ~2,048 tokens, caching silently does nothing.

**Example measurement script:**
```typescript
// scripts/measure-prompt-sizes.ts
import Anthropic from "@anthropic-ai/sdk";
import { getFamilyPlannerPrompt } from "@/lib/prompt-router";
import { getModelListForPrompt, getCapabilities } from "@/lib/helix";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY! });

const DEVICES = ["helix_lt", "helix_stomp", "helix_stomp_xl", "pod_go", "helix_stadium"] as const;

for (const device of DEVICES) {
  const caps = getCapabilities(device);
  const modelList = getModelListForPrompt(caps);
  const systemPrompt = getFamilyPlannerPrompt(device, modelList);

  const count = await client.messages.countTokens({
    model: "claude-sonnet-4-6",
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } }],
    messages: [{ role: "user", content: "test" }],
  });

  console.log(`${device}: ${count.input_tokens} tokens (${systemPrompt.length} chars)`);
}
```

### Pattern 4: Stomp Cache Unification (if measurements confirm need)

**What:** `helix_stomp` and `helix_stomp_xl` currently produce different planner system prompts because `buildPlannerPrompt` interpolates `deviceName`, `maxBlocks`, and `maxSnapshots` directly. This creates 2 separate cache entries. The fix is to extract device-specific information into the user message (matching the Helix pattern documented in Phase 65).

**Current behavior:** `helix_stomp` → "HX Stomp", 6 blocks, 3 snapshots / `helix_stomp_xl` → "HX Stomp XL", 9 blocks, 4 snapshots — separate caches, each requiring a cold write.

**Approach:** Make `buildPlannerPrompt` for the Stomp family emit identical text regardless of variant (e.g., use the more constrained values or abstract wording). Append the variant restriction to the user message content in `planner.ts` the same way `toneContext` is appended today.

**Constraint check:** The Anthropic cache key is a hash of system prompt text. If the text is byte-for-byte identical, the same cache entry is reused — no other configuration needed.

**Alternative:** A single "stomp" planner system prompt covering both variants (stomp/stomp_xl use the same HD2 catalog, same effect types, same schema structure — they differ only in block limits and snapshot count). The DEVICE RESTRICTION line at the bottom can reference ranges ("6-9 blocks, 3-4 snapshots") or be removed entirely and moved to the user message.

### Pattern 5: Shared "Constrained Device" Prompt Bucket (if Stadium/Pod Go volume is too low)

**What:** If per-device cache stats show Stadium and Pod Go have < 50% cache hit rate due to low request volume (the 1h TTL can expire between users), merge their planner prompts into a single shared "constrained-device" system prompt that works for both. Stadium and Pod Go are both single-DSP, no dual-amp, single-path devices — they differ primarily in model catalog and slot counts.

**When to implement:** Only if measurements confirm the problem. This is structurally more complex than the Stomp fix and changes the prompt content visible to Claude. Should not be implemented speculatively.

**Simpler alternative first:** Reduce the 1h TTL to a different option if low-volume devices rarely hit cache even within 1h windows. (Note: 1h is already the longest TTL available — no longer option exists as of 2026-03-06.)

### Anti-Patterns to Avoid

- **Premature prompt trimming:** Do not remove model catalog entries from `modelList` until token counts confirm they are bloated. The catalog is the ground truth Claude uses for valid names — trimming it increases hallucination risk.
- **Moving device restrictions into user message without testing:** The planner must still enforce device constraints. Test that removing the DEVICE RESTRICTION from the system prompt does not cause Claude to generate 8 snapshots for a 3-snapshot Stomp preset.
- **Restructuring prompts that already have high cache hit rates:** Helix (helix_lt / helix_floor) and Pod Go already have a single cache entry each. Don't change what works.
- **Using `cache_control` on multiple system prompt blocks:** Anthropic caches up to the last `cache_control` breakpoint. Adding multiple breakpoints in the same system prompt is valid but only the portion up to the last breakpoint is cached. Keep a single breakpoint on the entire system prompt text block.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Manual char/4 heuristic | `client.messages.countTokens()` | Model-specific tokenization; heuristic is ±20% error |
| Cache hit detection | Timing-based heuristic | `cache_read_input_tokens > 0` | Anthropic explicitly signals cache hits in the SDK response |
| Cost calculation | Third-party cost API | Inline multiplication with known pricing | Stable constants; no API needed; already in `estimateClaudeCost()` |
| Per-device statistics | New logging framework | Extend existing `parseCacheReport()` with device grouping | Device field already on every `PlannerUsageRecord` |

**Key insight:** All the data infrastructure exists. Phase 68 is primarily about: (1) fixing one wrong constant, (2) extending existing scripts with device-level grouping, (3) adding one measurement script, and (4) making one structural prompt change (Stomp cache unification) if measurements confirm it is worthwhile.

## Common Pitfalls

### Pitfall 1: Confusing 5m vs 1h Cache Write Pricing

**What goes wrong:** Cost estimates are too low by 37.5% on cache-write calls. This is already the case in the codebase — `usage-logger.ts` has `cache_write_per_mtok: 3.75` (5m price) but `planner.ts` uses `ttl: "1h"` (2x price = $6.00).

**Why it happens:** The 1h TTL was added to `planner.ts` after Phase 42 established the pricing constant. The constant was never updated.

**How to avoid:** Fix the constant in `usage-logger.ts` as the first task. Add a comment referencing the TTL setting in `planner.ts`.

**Warning signs:** `cache_creation_input_tokens` is non-null on cold starts and the cost appears lower than expected for a Sonnet call.

### Pitfall 2: Stomp Prompt Unification Breaking Schema Compliance

**What goes wrong:** After unifying Stomp prompts, Claude starts generating 4 snapshots for helix_stomp (which only supports 3) because the system prompt no longer specifies "exactly 3 snapshots."

**Why it happens:** The DEVICE RESTRICTION block in `stomp/prompt.ts` currently enforces snapshot count. If that text is removed or generalized, Claude no longer has a hard instruction.

**How to avoid:** Move the snapshot count restriction to the user message (appended alongside toneContext in `planner.ts`). Test with helix_stomp specifically before merging. The Zod schema enforces snapshot count at validation time — schema validation will catch failures.

**Warning signs:** Zod parse errors on `snapshots` field for helix_stomp presets after the change.

### Pitfall 3: Prompt Minimum Token Threshold for Caching

**What goes wrong:** A family's system prompt is under 2,048 tokens (Claude Sonnet 4.6 minimum), so `cache_control: ephemeral` is silently ignored — no caching occurs at all.

**Why it happens:** Anthropic requires a minimum cacheable prefix length before activating caching. Prompts shorter than the threshold are processed without caching even when `cache_control` is set.

**How to avoid:** Run `measure-prompt-sizes.ts` (Pattern 3) to verify all families exceed 2,048 tokens. Based on file sizes (~9-13KB each family prompt file), all four families are almost certainly well above this threshold, but confirm with actual token counts.

**Warning signs:** `cache_creation_input_tokens: null` on every call for a given device (not just on hits — on cold starts too).

### Pitfall 4: Cache Key Instability from modelList

**What goes wrong:** Cache misses despite identical device selection because `modelList` varies between calls for the same device.

**Why it happens:** `getModelListForPrompt(caps)` is deterministic for a given `caps` value — it iterates over `AMP_MODELS`, `CAB_MODELS`, etc. in object key order. As long as model definitions are not reordered between deployments, the output is stable. A deployment that changes model definitions will naturally invalidate all caches (expected behavior, not a bug).

**How to avoid:** Never sort or shuffle model catalog entries dynamically. Keep model additions append-only to preserve key order. Document that model catalog changes trigger cache invalidation as a known side effect.

**Warning signs:** 0% cache hit rate immediately following a deployment that changed model definitions.

### Pitfall 5: Per-Device Analysis Requires Sufficient Sample Size

**What goes wrong:** Stadium shows 0% cache hit rate in the report because only 2 Stadium presets were ever generated (both cold starts; neither subsequent call came within the 1h window).

**Why it happens:** Low-volume devices with 1h TTL need at least 2 calls within 60 minutes to measure hit rate. With few Stadium users, the data sample is too small to be meaningful.

**How to avoid:** Run the cache-hit-report test manually with `LOG_USAGE=true` and deliberate repeated calls for each device within the 1h window. Label this as "synthetic measurement" to distinguish from organic traffic stats.

**Warning signs:** Per-device report shows 1-2 total calls for Stadium or Pod Go — not enough data.

## Code Examples

Verified patterns from official sources and existing codebase:

### Pricing Fix (one-liner)

```typescript
// src/lib/usage-logger.ts — fix cache_write_per_mtok
// Source: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching (2026-03-06)
export const CLAUDE_SONNET_PRICE = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_write_per_mtok: 6.0,   // 2x input — for ttl:"1h" (planner.ts uses 1h)
  cache_read_per_mtok: 0.3,    // 0.1x input — same for both TTL options
} as const;
```

### Token Counting (Anthropic SDK — verified from local types)

```typescript
// Source: node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts
// client.messages.countTokens() returns { input_tokens: number }
const count = await client.messages.countTokens({
  model: "claude-sonnet-4-6",
  system: [
    {
      type: "text",
      text: systemPrompt,
      cache_control: { type: "ephemeral", ttl: "1h" },
    },
  ],
  messages: [{ role: "user", content: "measure" }],
});
console.log(`System prompt: ${count.input_tokens} tokens`);
```

### Cache Hit Detection (existing pattern — already correct)

```typescript
// Source: src/lib/planner.ts (current codebase)
const cacheRead = usage.cache_read_input_tokens ?? 0;
const cacheWrite = usage.cache_creation_input_tokens ?? 0;
const cacheHit = cacheRead > 0;
// Note: usage.cache_creation returns { ephemeral_1h_input_tokens, ephemeral_5m_input_tokens }
// for granular TTL breakdown — available in SDK ^0.78.0
```

### Per-Device Cache Stats Extension

```typescript
// Extension to scripts/cache-hit-report.ts
// Groups existing PlannerUsageRecord[] by the device field (already present)
export function parseCacheReportByDevice(
  records: PlannerUsageRecord[],
): Map<string, CacheReportStats> {
  const generateRecords = records.filter(r => r.endpoint === "generate");
  const devices = [...new Set(generateRecords.map(r => r.device ?? "unknown"))];
  const result = new Map<string, CacheReportStats>();
  for (const device of devices) {
    const deviceRecords = generateRecords.filter(r => (r.device ?? "unknown") === device);
    result.set(device, parseCacheReport(deviceRecords));
  }
  return result;
}
```

### Stomp Prompt Unification Approach

```typescript
// src/lib/families/stomp/prompt.ts — after unification
// System prompt text is IDENTICAL for helix_stomp and helix_stomp_xl
// Device-specific restriction moved to user message in planner.ts

export function buildPlannerPrompt(_device: DeviceTarget, modelList: string): string {
  // Use Stomp constraints (more conservative — Stomp XL gets the restriction via user message)
  return `You are HelixTones' Planner. You choose creative model selections for HX Stomp presets.
  // ... static content only, no device name interpolation ...
  // DEVICE RESTRICTION: removed from here, appended to user message by planner.ts
  `;
}

// src/lib/planner.ts — append Stomp variant restriction to user message
const stompVariantRestriction = family === "stomp"
  ? `\n\nDEVICE: ${effectiveDevice === "helix_stomp_xl" ? "HX Stomp XL (9 blocks, 4 snapshots)" : "HX Stomp (6 blocks, 3 snapshots)"}`
  : "";
const userContent = toneContext
  ? `${conversationText}\n\n---\n\n${toneContext}${stompVariantRestriction}`
  : `${conversationText}${stompVariantRestriction}`;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 5-minute cache TTL (default) | 1-hour cache TTL explicit | Phase 65 era | Wider cache window for low-volume devices; higher write cost (2x vs 1.25x) |
| No cache pricing awareness | Per-TTL pricing constants in `usage-logger.ts` | Phase 42 | Cost visibility per call; BUG: constant uses 5m price, code uses 1h TTL |
| All devices aggregated in cache report | Per-device `device` field on every log record | Phase 42/65 | Ready for per-device breakdown — just not yet implemented in report script |
| 5-minute ephemeral TTL | Two options: `5m` and `1h` (both available in SDK ^0.78.0) | Anthropic ~2024 | `planner.ts` already uses `1h`; no further upgrade needed |

**Deprecated/outdated:**
- $3.75/MTok cache write constant: Was correct for 5m TTL; must be updated to $6.00/MTok for 1h TTL that `planner.ts` now uses.

## Open Questions

1. **Are Stadium and Pod Go prompts above the 2,048-token minimum?**
   - What we know: Helix family prompt file is 13KB, Stomp is 11KB, PodGo is 9KB, Stadium is 9KB. At ~4 chars/token, these are all well above 2,048 tokens — likely 2,300-3,250 tokens each.
   - What's unclear: Whether the `modelList` parameter (which grows or shrinks by device) pushes any family significantly above or below average. Stadium's model list uses Agoura amps (fewer entries than HD2 catalog) which may reduce token count.
   - Recommendation: Measure with `countTokens()` as first action in Plan 68-01. Confirms or denies the hypothesis quickly.

2. **Should Stomp prompt unification happen at all?**
   - What we know: `helix_stomp` and `helix_stomp_xl` are the same hardware family with different block limits. They share the same HD2 model catalog and same effect schema. The cache unification pattern is proven by helix_lt / helix_floor.
   - What's unclear: Whether real users actually use both Stomp variants frequently enough for this to matter in practice. If 95% of Stomp usage is helix_stomp, the XL cache miss is irrelevant.
   - Recommendation: Implement unification if measurements show both variants get meaningful traffic. Hold if only one variant is used.

3. **Does the Stadium prompt's `buildAmpCabPairingTable()` affect cache stability?**
   - What we know: `buildAmpCabPairingTable()` in `stadium/prompt.ts` generates its content from `STADIUM_AMPS` at prompt-build time. If `STADIUM_AMPS` is constant across requests (it is — it's a module-level `const`), the generated table is identical every call.
   - What's unclear: Whether a future Phase 63 update to `STADIUM_AMPS` would silently invalidate Stadium's cache. (Answer: yes, but that's expected and correct behavior.)
   - Recommendation: Document this in the Stadium prompt module. No code change needed.

4. **What is the correct scope of "trim redundant catalog entries from prompt text"?**
   - What we know: The phase description mentions trimming the catalog in prompt text. The `modelList` passed to each family prompt contains names like `"Cosmos Echo (HD2_DelayCosmosEcho) — based on TC Electronic Cosmos Echo"`. The `basedOn` field adds human-readable context but also token cost.
   - What's unclear: Whether removing the `(ID) — based on real-world` suffix from `modelList` would save meaningful tokens or break Claude's model name recognition.
   - Recommendation: Measure token counts first. Only trim if a family's prompt exceeds ~4,000 tokens (significantly above minimum) AND measurements show the extra tokens are not contributing to quality. Do not trim speculatively.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.0.18 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npx vitest run src/lib/usage-logger.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

Phase 68 has no formal requirement IDs (TBD in phase description). The behaviors to test are:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `CLAUDE_SONNET_PRICE.cache_write_per_mtok` equals 6.00 | unit | `npx vitest run src/lib/usage-logger.test.ts` | Yes (exists, needs new assertion) |
| `estimateClaudeCost()` returns correct cost with 1h pricing | unit | `npx vitest run src/lib/usage-logger.test.ts` | Yes (exists, needs update for new constant) |
| `parseCacheReportByDevice()` groups records by device correctly | unit | `npx vitest run scripts/cache-hit-report.test.ts` | Yes (exists, needs new test case) |
| Stomp `buildPlannerPrompt("helix_stomp", ...)` and `buildPlannerPrompt("helix_stomp_xl", ...)` produce identical text | unit | `npx vitest run src/lib/families/stomp/prompt.test.ts` | No — Wave 0 (if unification done) |
| All family planner prompts exceed 2,048 tokens (minimum cache threshold) | integration | `npx vitest run scripts/measure-prompt-sizes.test.ts` | No — Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/lib/usage-logger.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- `src/lib/families/stomp/prompt.test.ts` — test that helix_stomp and helix_stomp_xl produce identical planner prompt text (if Stomp unification is implemented)
- `scripts/measure-prompt-sizes.test.ts` — verify all families produce prompts above 2,048 tokens

None — if Stomp unification is not implemented, no new test files are needed beyond extending existing ones.

## Sources

### Primary (HIGH confidence)

- `node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts` — `CacheControlEphemeral` interface: `ttl?: '5m' | '1h'`; `CacheCreation` interface: `ephemeral_1h_input_tokens`, `ephemeral_5m_input_tokens`; `Usage` interface: all cache token fields — verified locally
- `platform.claude.com/docs/en/docs/build-with-claude/prompt-caching` (fetched 2026-03-06) — pricing table: Sonnet 4.6 cache write 5m=$3.75/MTok, 1h=$6.00/MTok, cache read=$0.30/MTok; minimum token threshold: 2,048 for Sonnet 4.6
- `src/lib/planner.ts` (project source) — `cache_control: { type: "ephemeral", ttl: "1h" }` confirmed at line 60
- `src/lib/usage-logger.ts` (project source) — `cache_write_per_mtok: 3.75` confirmed pricing bug at line 40
- `src/lib/families/stomp/prompt.ts` (project source) — confirmed `deviceName`/`maxBlocks`/`maxSnapshots` interpolated into system prompt, producing different text per Stomp variant

### Secondary (MEDIUM confidence)

- Phase 42 RESEARCH.md (project docs) — established the baseline infrastructure this phase builds on; confirmed all measurement patterns are already implemented
- Phase 65 decisions in STATE.md — "Helix Floor/LT produce byte-identical prompts (single cache entry) — device name variation goes in user message only" — confirmed the unification pattern that Stomp should follow

### Tertiary (LOW confidence)

- Organic Stadium/Pod Go cache hit rates — unknown without production `usage.jsonl` data; must be measured empirically before deciding whether shared prompt bucket is needed

## Metadata

**Confidence breakdown:**
- Pricing bug identification: HIGH — confirmed by reading both `usage-logger.ts` constant and Anthropic official pricing docs
- Cache minimum threshold (2,048 tokens for Sonnet 4.6): HIGH — from official Anthropic prompt caching docs fetched 2026-03-06
- Stomp cache unification approach: HIGH — pattern proven by Helix family; documented in STATE.md as working solution
- Per-device token counts: LOW until measured — estimated from file sizes but actual tokenization not yet confirmed
- Whether Stadium/Pod Go need shared bucket: LOW — requires empirical data from production usage

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (Anthropic pricing is stable; API shapes are stable for ^0.78.0)
