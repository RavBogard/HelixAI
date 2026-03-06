---
phase: 68-token-control-and-prompt-caching
verified: 2026-03-06T18:12:41Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 68: Token Control and Prompt Caching Verification Report

**Phase Goal:** Reduce API costs without degrading preset quality — optimize token usage across planner prompts (per-family prompt token budgets, trim redundant catalog entries from prompt text), maximize Anthropic prompt caching hit rates (measure per-device cache performance via usage-logger.ts, consider shared prompt buckets for low-volume devices like Stadium and Pod Go), audit system prompt sizes across all families, and implement any structural changes needed to keep cost per preset generation low as the device count grows
**Verified:** 2026-03-06T18:12:41Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status     | Evidence                                                                                         |
|----|-----------------------------------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| 1  | CLAUDE_SONNET_PRICE.cache_write_per_mtok equals 6.00                                         | VERIFIED   | `src/lib/usage-logger.ts` line 41: `cache_write_per_mtok: 6.0` with JSDoc referencing 1h TTL   |
| 2  | estimateClaudeCost() returns correct USD values using the 1h cache write price               | VERIFIED   | Test "Test 4" passes: 0.013560 expected value using 6.0 price; 26/26 tests pass                 |
| 3  | parseCacheReportByDevice() groups usage records by device and returns per-device hit rates   | VERIFIED   | `scripts/cache-hit-report.ts` lines 162-187; 5 new device tests all pass                       |
| 4  | measure-prompt-sizes.ts reports actual token counts for all five device planner prompts      | VERIFIED   | `scripts/measure-prompt-sizes.ts` exists, all 5 DeviceTargets measured; TypeScript compiles     |
| 5  | buildPlannerPrompt('helix_stomp', ...) === buildPlannerPrompt('helix_stomp_xl', ...) (byte-identical) | VERIFIED | `stomp/prompt.test.ts` line 15-17 identity test: 12/12 stomp tests pass                     |
| 6  | Stomp variant device restrictions appear in user message (planner.ts), not system prompt     | VERIFIED   | `planner.ts` lines 53-67: `stompRestriction` appended to `finalUserContent`; DEVICE RESTRICTION absent from prompt.ts |
| 7  | Zod schema still enforces correct snapshot counts per Stomp variant                         | VERIFIED   | `src/lib/families/stomp/prompt.ts` getSystemPrompt unchanged; `planner.ts` calls `getToneIntentSchema(family ?? "helix")` — Zod validation at line 139 unchanged |
| 8  | All stomp prompt tests pass after restructure                                                | VERIFIED   | 12/12 stomp prompt tests pass; identity test, DEVICE RESTRICTION absence test, and snapshot/block count tests all confirmed |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact                                          | Expected                                              | Status     | Details                                                                                               |
|---------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------------------------------------------------------|
| `src/lib/usage-logger.ts`                        | Corrected 1h cache write pricing constant             | VERIFIED   | Line 41: `cache_write_per_mtok: 6.0` with updated JSDoc "1-hour ephemeral cache"                    |
| `scripts/cache-hit-report.ts`                    | Per-device cache statistics breakdown                 | VERIFIED   | Exports `parseCacheReportByDevice` (line 162) and `formatReportByDevice` (line 195); CLI updated     |
| `scripts/measure-prompt-sizes.ts`                | Token counting script for all device family prompts   | VERIFIED   | 174 lines; all 5 devices measured; API key guard; cache threshold check; Stomp variant diagnostic     |
| `src/lib/families/stomp/prompt.ts`               | Unified Stomp prompt producing identical text         | VERIFIED   | `_device` parameter; uses conservative STOMP_MAX_BLOCKS/SNAPSHOTS; no device interpolation          |
| `src/lib/planner.ts`                             | Stomp variant restriction in user message             | VERIFIED   | Lines 53-67: `stompRestriction` variable; `finalUserContent = userContent + stompRestriction`        |
| `src/lib/families/stomp/prompt.test.ts`          | Test verifying Stomp/StompXL identity                 | VERIFIED   | Line 15-17: strict equality test; 12/12 tests pass                                                   |

### Key Link Verification

| From                              | To                             | Via                                               | Status  | Details                                                                                                     |
|-----------------------------------|--------------------------------|---------------------------------------------------|---------|-------------------------------------------------------------------------------------------------------------|
| `src/lib/usage-logger.ts`        | `src/lib/planner.ts`          | CLAUDE_SONNET_PRICE used in estimateClaudeCost()  | WIRED   | `planner.ts` imports `estimateClaudeCost` from usage-logger (line 10); called at line 89 with `usage`       |
| `scripts/cache-hit-report.ts`    | `src/lib/usage-logger.ts`     | PlannerUsageRecord.device for grouping            | WIRED   | Import at line 11; grouping via `record.device ?? "unknown"` at line 171                                    |
| `src/lib/families/stomp/prompt.ts` | `src/lib/prompt-router.ts`  | buildPlannerPrompt export consumed by getFamilyPlannerPrompt | WIRED | `prompt-router.ts` imports as `stompPlannerPrompt` (line 13); called at line 37 in `getFamilyPlannerPrompt` |
| `src/lib/planner.ts`             | `src/lib/families/stomp/prompt.ts` | System prompt device-agnostic; stompRestriction in user message | WIRED | `planner.ts` line 65: `stompRestriction` constructed; line 67: appended to finalUserContent; line 79: `finalUserContent` in messages array |

### Requirements Coverage

No formal requirement IDs were assigned to this phase (cost optimization phase). All plan `requirements` fields are empty arrays (`[]`). No REQUIREMENTS.md entries to cross-reference.

### Anti-Patterns Found

None. All five modified/created files were scanned for:
- TODO/FIXME/XXX/HACK/PLACEHOLDER comments
- Empty implementations (return null, return {}, return [], => {})
- Stub patterns

No issues found.

### Human Verification Required

One item warrants human verification when an API key is available, though it does not block the phase goal:

**1. measure-prompt-sizes.ts live token count run**

**Test:** Run `CLAUDE_API_KEY=sk-ant-xxx npx tsx scripts/measure-prompt-sizes.ts`
**Expected:** All 5 device families print token counts above 2,048; helix_stomp and helix_stomp_xl report "IDENTICAL prompt text"; no devices flagged as below cache threshold
**Why human:** Requires a live Anthropic API key; countTokens endpoint is free but cannot be called in CI or automated checks

### Gaps Summary

No gaps found. All phase must-haves are verified against the actual codebase.

**Plan 01 — Pricing Fix and Per-Device Stats:**
- `CLAUDE_SONNET_PRICE.cache_write_per_mtok` is substantively 6.0 in source, tested by regression guard, and used in the live cost estimation path in `planner.ts`.
- `parseCacheReportByDevice` and `formatReportByDevice` are exported, tested with 5 dedicated tests (3-device grouping, unknown fallback, single-device match, per-device correctness, human-readable output), and wired into the CLI entry point.
- `measure-prompt-sizes.ts` compiles without TypeScript errors, covers all 5 device targets, validates against the 2,048-token threshold, and includes the Stomp variant identity diagnostic.

**Plan 02 — Stomp Cache Unification:**
- `buildPlannerPrompt` for stomp family uses `_device` (intentionally unused), produces zero device-specific interpolation, and the identity test confirms strict byte equality.
- DEVICE RESTRICTION paragraph is absent from the system prompt (grep confirmed no match).
- `stompRestriction` is appended to `finalUserContent` in planner.ts and that value is used in the `messages` array sent to Claude.
- `getSystemPrompt` (chat prompt) is unchanged — no regression.
- All 12 stomp prompt tests pass including the new identity and DEVICE RESTRICTION absence tests.

---

_Verified: 2026-03-06T18:12:41Z_
_Verifier: Claude (gsd-verifier)_
