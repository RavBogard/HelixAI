# Handoff: Phase 4 AI Platform Evaluation

**Date:** 2026-03-08
**Status:** APPLY in progress — Tasks 1-2 complete, checkpoint pending

## What's Done

### Task 1: Benchmark harness + scenarios (COMPLETE)
- `scripts/ai-eval-scenarios.ts` — 6 test scenarios (country, metal, worship, blues, prog, classic rock)
- `scripts/ai-eval-harness.ts` — Benchmark harness supporting multiple providers
- No external dependencies added — env loading is manual, JSON schema built by hand

### Task 2: Run benchmarks + evaluation report (PARTIAL)
- Claude Sonnet 4.6 and Claude Haiku 4.5 fully benchmarked (all 6 scenarios each)
- Gemini providers failed due to expired API key
- Report written: `.paul/phases/04-ai-platform-evaluation/04-01-EVAL-REPORT.md`
- Raw results: `scripts/ai-eval-results-full.json`

### Results So Far
| Provider | Overall | Cost/Gen | Latency |
|----------|---------|----------|---------|
| Claude Sonnet 4.6 | 82% | $0.045 | 9.2s |
| Claude Haiku 4.5 | 77% | $0.012 | 4.8s |
| Gemini (all) | N/A | N/A | API key expired |

### Task 3: Decision checkpoint (PENDING)
User wants to test Gemini before deciding. Fresh API keys are now in `.env.eval`.

## What's Next

1. **Add Gemini 3 Flash and 3.1 Pro** to the harness provider configs:
   - `gemini-3-flash`: model `gemini-3-flash-preview`, pricing $0.50/$3.00 per MTok
   - `gemini-3.1-pro`: model `gemini-3.1-pro-preview`, pricing $2.00/$12.00 per MTok
   - Keep existing `gemini-flash` (2.5 Flash) and `gemini-pro` (2.5 Pro) — update model IDs if needed

2. **Run full benchmark**: `npx tsx scripts/ai-eval-harness.ts --provider=all`

3. **Update evaluation report** with Gemini results

4. **Present decision checkpoint** with complete data

## Key Files
- `scripts/ai-eval-harness.ts` — Harness (loads `.env.eval` first, then `.env.local`)
- `scripts/ai-eval-scenarios.ts` — 6 test scenarios
- `scripts/ai-eval-results-full.json` — Previous run results (Claude only)
- `.paul/phases/04-ai-platform-evaluation/04-01-EVAL-REPORT.md` — Report (needs update)
- `.paul/phases/04-ai-platform-evaluation/04-01-PLAN.md` — Plan
- `.env.eval` — Fresh API keys (Claude + Gemini)

## Architecture Context
- Two-stage: AI Planner (creative choices) → Knowledge Layer (deterministic params)
- Planner outputs ToneIntent JSON via structured output (zodOutputFormat for Claude, responseJsonSchema for Gemini)
- Chat uses Gemini streaming, Planner uses Claude structured output
- Both Pod Go scenarios fail Zod schema validation on both Claude models — product bug, not provider issue

## Decisions Made
- None yet — waiting for complete Gemini benchmarks before deciding

## Loop Position
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓      (in progress)  ○
```
