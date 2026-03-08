# AI Platform Evaluation Report

**Phase 4, Plan 04-01**
**Date:** 2026-03-08
**Benchmark:** 6 scenarios x 6 providers = 36 total generations

---

## Executive Summary

**Recommendation: Switch planner to Gemini 2.5 Flash. Keep Gemini for chat.**

Gemini 2.5 Flash delivers the best overall quality (87%), perfect schema compliance (100%), and is 13x cheaper than Claude Sonnet ($0.004 vs $0.046/generation). All four Gemini models achieve 100% schema compliance across all 6 scenarios — including the Pod Go scenario that both Claude models fail. The quality gap favors Gemini, not Claude.

Key findings:
- **Gemini 2.5 Flash: 87% overall, 100% schema, $0.004/gen, 9.1s** — best value
- **Gemini 2.5 Pro: 86% overall, 100% schema, $0.015/gen, 20.6s** — best worship amp picks
- **Claude Sonnet 4.6: 82% overall, 83% schema, $0.046/gen, 9.2s** — most expensive, fails Pod Go
- **Claude Haiku 4.5: 77% overall, 83% schema, $0.012/gen, 4.8s** — fastest but lowest quality
- Gemini 3 Flash and 3.1 Pro perform comparably to their 2.5 counterparts but at higher cost/latency

---

## Benchmark Results

### Provider Comparison (across 6 scenarios)

| Provider | Schema | Model Validity | Appropriateness | Diversity | Overall | Avg Cost | Avg Latency |
|----------|:------:|:-:|:-:|:-:|:------:|:--------:|:-----------:|
| **Gemini 2.5 Flash** | **100%** | 100% | 60% | 92% | **87%** | **$0.0035** | 9.1s |
| Gemini 3 Flash | 100% | 100% | 60% | 86% | 86% | $0.0055 | 11.1s |
| Gemini 2.5 Pro | 100% | 100% | 58% | 87% | 86% | $0.0150 | 20.6s |
| Gemini 3.1 Pro | 100% | 100% | 56% | 90% | 86% | $0.0221 | 20.8s |
| Claude Sonnet 4.6 | 83% | 94% | 67% | 95% | 82% | $0.0455 | 9.2s |
| Claude Haiku 4.5 | 83% | 94% | 51% | 90% | 77% | $0.0120 | 4.8s |

### Key Insight: Schema Compliance is the Differentiator

Claude Sonnet scores higher on appropriateness (67% vs 60%), but this is more than offset by its 83% schema compliance — failing the Pod Go scenario entirely. Since a schema failure means **no preset is generated at all**, schema compliance is the most critical metric. All Gemini models achieve 100%.

### Per-Scenario Breakdown

| Scenario | Device | Sonnet | Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro | Winner |
|----------|--------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 0: Clean Country | Helix LT | 91% | 84% | 84% | 84% | 91% | 84% | Sonnet/G3F |
| 1: High-Gain Metal | Helix Floor | 91% | 91% | 91% | 89% | 90% | 91% | Tie |
| 2: Ambient Worship | HX Stomp | 93% | 84% | 91% | **93%** | 84% | **93%** | Sonnet/G2.5P/G3.1P |
| 3: Blues Rock | Pod Go | 43% | 32% | **79%** | **79%** | **77%** | **79%** | **All Gemini** |
| 4: Modern Prog | Helix LT | 85% | 84% | 85% | **88%** | 85% | 83% | G2.5 Pro |
| 5: Classic Rock | Stadium | 88% | 84% | **91%** | 84% | **91%** | 84% | G2.5F/G3F |

### Quality Analysis

**Why Gemini wins overall despite lower appropriateness:**
1. **100% schema compliance** — every scenario produces a valid preset. Claude fails Pod Go (drops overall by 17 points).
2. **Pod Go is critical** — it's the #2 selling device. A planner that can't generate Pod Go presets is a non-starter.
3. **Appropriateness gap is narrow** — 60% vs 67% means Gemini occasionally picks a "close enough" amp (e.g., US Deluxe Nrm for worship instead of Litigator). This is tunable via prompt engineering.

**Where each provider excels:**
- **Gemini 2.5 Flash:** Best overall value. Metal (Revv Gen Purple), classic rock (Plexi), Pod Go (Fullerton Nrm) — all excellent picks.
- **Gemini 2.5 Pro:** Best worship (Essex A30 — a Vox-style amp, perfect for worship). Best prog (Placater Clean — modern clean platform).
- **Gemini 3.1 Pro:** Also excellent worship (Matchstick Ch1 — AC30 style). Metal uses Badonk (valid high-gain, less common pick).
- **Claude Sonnet:** Best country (Deluxe Nrm — classic choice). Good worship (Litigator). But fails Pod Go.

**Shared pattern across all providers:**
- Classic rock: Everyone picks Agoura Brit Plexi — unanimous agreement on the Marshall Plexi for classic rock
- Metal: All pick either Revv Gen Purple or Revv Gen Red — correct high-gain choices
- Country: All pick Fender-style clean amps — appropriate

---

## Cost Analysis

### Per-Generation Cost

| Provider | Input Tokens (avg) | Output Tokens (avg) | Total Cost |
|----------|:--:|:--:|:--:|
| Gemini 2.5 Flash | ~14,500 | ~350 | $0.0035 |
| Gemini 3 Flash | ~14,500 | ~350 | $0.0055 |
| Claude Haiku 4.5 | ~14,700 | ~300 | $0.0120 |
| Gemini 2.5 Pro | ~14,500 | ~350 | $0.0150 |
| Gemini 3.1 Pro | ~14,500 | ~350 | $0.0221 |
| Claude Sonnet 4.6 | ~14,700 | ~300 | $0.0455 |

### Monthly Projections

| Provider | 100 gen/mo | 500 gen/mo | 1,000 gen/mo |
|----------|:--:|:--:|:--:|
| Gemini 2.5 Flash | $0.35 | $1.73 | $3.46 |
| Gemini 3 Flash | $0.55 | $2.76 | $5.52 |
| Claude Haiku 4.5 | $1.20 | $6.00 | $12.00 |
| Gemini 2.5 Pro | $1.50 | $7.48 | $14.97 |
| Gemini 3.1 Pro | $2.21 | $11.07 | $22.15 |
| Claude Sonnet 4.6 | $4.55 | $22.74 | $45.48 |

### Cost-Quality Efficiency

| Provider | Overall Quality | Cost/Gen | Quality per Dollar |
|----------|:-:|:-:|:-:|
| **Gemini 2.5 Flash** | 87% | $0.0035 | **24,857%/$** |
| Gemini 3 Flash | 86% | $0.0055 | 15,636%/$ |
| Gemini 2.5 Pro | 86% | $0.0150 | 5,733%/$ |
| Claude Haiku 4.5 | 77% | $0.0120 | 6,417%/$ |
| Gemini 3.1 Pro | 86% | $0.0221 | 3,891%/$ |
| Claude Sonnet 4.6 | 82% | $0.0455 | 1,802%/$ |

---

## Architecture Assessment

### Current Dual-Provider Architecture

```
Chat (Gemini Flash) ──→ Generate (Claude Sonnet) ──→ Knowledge Layer
     $0.001/msg              $0.045/preset              $0.00 (deterministic)
```

### Proposed: Consolidated Gemini Architecture

```
Chat (Gemini Flash) ──→ Generate (Gemini Flash) ──→ Knowledge Layer
     $0.001/msg              $0.004/preset              $0.00 (deterministic)
```

**Advantages of consolidation:**
- **Single SDK** — remove @anthropic-ai/sdk dependency entirely (if vision moves to Gemini too)
- **Single API key, single billing** — operational simplicity
- **11x planner cost reduction** — $0.004 vs $0.045 per preset
- **Higher schema compliance** — 100% vs 83%, eliminates Pod Go failures
- **Same latency** — Gemini 2.5 Flash (9.1s) matches Claude Sonnet (9.2s)

**Trade-offs:**
- Lose Claude's structured output with zodOutputFormat (but Gemini's JSON Schema mode works perfectly)
- Lose Claude prompt caching (but at $0.004/gen, caching barely matters)
- Slightly lower appropriateness on some genres (60% vs 67%) — addressable with prompt tuning

### Vision Endpoint

Claude Sonnet remains the only viable option for vision (pedal photo analysis). If consolidating to Gemini for planner + chat, vision would be the sole Claude dependency. This is acceptable since vision is a low-volume, optional feature.

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Gemini structured output regression | Medium | JSON Schema mode is GA; harness can detect regressions |
| Appropriateness gap widens | Low | Prompt tuning can improve genre-specific amp selection |
| Gemini model deprecation | Low | 4 Gemini models tested — easy to swap between them |
| Claude prompt caching economics lost | None | At $0.004/gen, caching savings are negligible |
| Pod Go Zod schema still fails on Claude | High | Moot if switching to Gemini (100% compliance) |

---

## Detailed Scenario Results

### Scenario 0: Clean Country (Helix LT)
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | US Deluxe Nrm | US Deluxe Nrm | US Double Nrm | US Deluxe Vib | US Deluxe Vib | US Double Nrm |
| Score | 91% | 84% | 84% | 84% | 91% | 84% |

### Scenario 1: High-Gain Metal (Helix Floor)
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | Revv Gen Red | Revv Gen Red | Revv Gen Purple | Revv Gen Purple | Revv Gen Purple | Badonk |
| Score | 91% | 91% | 91% | 89% | 90% | 91% |

### Scenario 2: Ambient Worship (HX Stomp)
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | Litigator | US Deluxe Nrm | US Double Nrm | **Essex A30** | US Deluxe Nrm | **Matchstick Ch1** |
| Score | 93% | 84% | 91% | 93% | 84% | 93% |

### Scenario 3: Blues Rock (Pod Go) — CRITICAL DIFFERENTIATOR
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | Grammatico Nrm | US Deluxe Nrm | Fullerton Nrm | Fullerton Nrm | Fullerton Nrm | US Super Nrm |
| Schema | **FAIL** | **FAIL** | PASS | PASS | PASS | PASS |
| Score | 43% | 32% | 79% | 79% | 77% | 79% |

### Scenario 4: Modern Prog (Helix LT)
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | Cali Texas Ch1 | US Deluxe Nrm | Litigator | **Placater Clean** | US Deluxe Nrm | Jazz Rivet 120 |
| Score | 85% | 84% | 85% | 88% | 85% | 83% |

### Scenario 5: Classic Rock (Stadium)
| | Claude Sonnet | Claude Haiku | G2.5 Flash | G2.5 Pro | G3 Flash | G3.1 Pro |
|--|--|--|--|--|--|--|
| Amp | 2203 MV | Plexi | Plexi | Plexi | Plexi | Plexi |
| Score | 88% | 84% | 91% | 84% | 91% | 84% |

---

## Recommendations

### DECISION (2026-03-08): Switch planner to Gemini 3 Flash

User chose Gemini 3 Flash over 2.5 Flash — newer generation model will improve over time while 2.5 approaches deprecation. Cost difference is marginal ($0.006 vs $0.004/gen).

1. **Replace Claude Sonnet with Gemini 3 Flash for planner** — 100% schema compliance, 86% quality, $0.006/gen
2. **Keep Gemini Flash for chat** — already working, proven
3. **Consolidate to single Gemini SDK** for planner + chat (retain Claude SDK only for vision)
4. **Implementation:** Replace `zodOutputFormat` with `responseJsonSchema` in planner.ts, swap SDK calls

### Fallback Tiers

If Gemini 3 Flash quality regresses or model is deprecated:
- **Tier 2:** Gemini 2.5 Flash (87% quality, $0.004/gen — current best raw score)
- **Tier 3:** Gemini 2.5 Pro (86% quality, best worship/prog amp picks)
- **Tier 4:** Gemini 3.1 Pro (86% quality, best worship amps, highest Gemini cost)

### Not Recommended

- **Claude Sonnet as planner** — 13x more expensive, lower schema compliance, fails Pod Go
- **Claude Haiku as planner** — cheapest Claude option but lowest quality overall, still fails Pod Go
- **All-Claude consolidation** — no advantages over Gemini for either planner or chat role

---

## Appendix: Raw Data

Full benchmark results (36 generations): `scripts/ai-eval-results-full.json`

Harness can be re-run at any time:
```bash
npx tsx scripts/ai-eval-harness.ts --provider=all
npx tsx scripts/ai-eval-harness.ts --provider=gemini-flash --scenario=0
```

---
*Generated: 2026-03-08 — Complete benchmark with all 6 providers*
