---
phase: 65-device-specific-prompts
verified: 2026-03-06T18:50:00Z
status: passed
score: 5/5 must-haves verified
re_verification: true
---

# Phase 65: Device-Specific Prompts Verification Report

**Phase Goal:** Each device family gets its own planner prompt and chat system prompt, containing only that family's model catalog and the conversation arc appropriate to its constraints -- prompt isolation is complete
**Verified:** 2026-03-06T18:50:00Z
**Status:** passed
**Re-verification:** Yes -- retroactive verification of code completed 2026-03-06. Code was verified functional by v5.0 milestone audit integration checker; this document formalizes the evidence.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | The Stomp chat prompt surfaces block-budget constraint framing -- the user is asked what to prioritize or cut before the preset is generated | VERIFIED | `grep -i "trade-off\|cut\|prioritize\|budget" stomp/prompt.ts` returns 5 hits: trade-off language in genre priority hierarchy ("cut modulation first", "cut drive first"), budget-conscious framing ("Budget is tight"). `stomp/prompt.test.ts` "contains trade-off question language" and "contains budget-conscious personality" both pass. **Note:** The maxFx mismatch (6/4 vs 5/2) in planner.ts DEVICE RESTRICTION string is being fixed by Plan 69-01 (separate plan). The prompt module itself (stomp/prompt.ts) correctly uses STOMP_CONFIG constants for block/snapshot limits. |
| 2 | The Pod Go chat prompt surfaces slot priority and chain order framing appropriate to its 4-effect budget | VERIFIED | `grep -i "4 slot\|4 effect\|4-slot" podgo/prompt.ts` returns 5 hits: "4 effect slots", "4 remaining slots", "4-slot limit is absolute". `podgo/prompt.test.ts` "contains 4 effect slots empowering framing" and "contains empowering language about constraints" both pass. DEVICE RESTRICTION includes "Pod Go has a hard 4 user-effect limit". |
| 3 | The Stadium chat prompt uses Agoura-native tone vocabulary and mentions Stadium-specific capabilities (7-band Parametric EQ, dual-DSP routing) | VERIFIED | `grep -i "FOH\|arena\|live sound\|stage" stadium/prompt.ts` returns 5 hits: "FOH translation", "FOH-ready tone shaping", "arena-grade", "live sound at stage volume", "FOH engineers". `stadium/prompt.test.ts` "contains FOH or Front of House vocabulary", "contains arena or live sound vocabulary", "contains monitor mix references" all pass. 7-band Parametric EQ mentioned in Stadium-specific features section. |
| 4 | The Helix prompt surfaces dual-DSP and dual-amp routing as available options during the interview | VERIFIED | `grep -i "DSP0\|DSP1\|dual-DSP\|split.*join" helix/prompt.ts` returns 5 hits: "DSP0 / Path 1", "DSP1 / Path 2", "Dual-DSP Routing (CRITICAL)", "Split block (position 6)", "Join block". `helix/prompt.test.ts` tests for dual-DSP routing content, split/join blocks, and numbered block ordering all pass. |
| 5 | Each device family's planner prompt imports only its own catalog module -- a grep for cross-family model names in any single prompt file returns zero results | VERIFIED | `grep -i "agoura" helix/prompt.ts` returns only JSDoc comments ("NEVER contain Agoura_*"), zero Agoura amp names in prompt text. `grep -i "agoura" stomp/prompt.ts` same result. `grep -i "agoura" podgo/prompt.ts` same result. `grep "Placater\|Revv Gen\|Cali Texas\|US Double Nrm" stadium/prompt.ts` returns only JSDoc comments ("NEVER contain HD2 amp names"), zero HD2 amp names in prompt text. Cross-family isolation confirmed. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---------|---------|--------|---------|
| `src/lib/families/helix/prompt.ts` | Dual-DSP routing, split/join blocks, numbered block ordering | VERIFIED | 264 lines; exports `buildPlannerPrompt(device, modelList)` and `getSystemPrompt(device)`. Contains DSP0/DSP1 path descriptions, split/join block placement, dual-amp layout. Helix Floor/LT produce byte-identical prompt text. |
| `src/lib/families/stomp/prompt.ts` | Dream-then-trim flow, trade-off questions, STOMP_CONFIG limits | VERIFIED | 225 lines; exports `buildPlannerPrompt(device, modelList)` and `getSystemPrompt(device)`. Genre-based priority hierarchy for over-budget. Uses STOMP_CONFIG constants. |
| `src/lib/families/podgo/prompt.ts` | Hard 4-effect limit, empowering framing, no stretch configurations | VERIFIED | 198 lines; exports `buildPlannerPrompt(device, modelList)` and `getSystemPrompt(device)`. "4 slots is plenty for a killer tone" framing. DEVICE RESTRICTION includes hard 4 user-effect limit. |
| `src/lib/families/stadium/prompt.ts` | Arena-grade personality, FOH vocabulary, Agoura-native naming, amp-cab pairing table | VERIFIED | 175 lines; exports `buildPlannerPrompt(device, modelList)` and `getSystemPrompt(device)`. `buildAmpCabPairingTable()` generates pairing table from STADIUM_AMPS cabAffinity. No TODO placeholders. |
| `src/lib/prompt-router.ts` | Exhaustive switch dispatch to per-family prompts | VERIFIED | 61 lines; exports `getFamilyPlannerPrompt(device, modelList)` and `getFamilyChatPrompt(device)`. Exhaustive switch on DeviceFamily (helix, stomp, podgo, stadium). TypeScript compiler enforces all four families are covered. |
| `src/lib/families/shared/gain-staging.ts` | Shared gain-staging intelligence section | VERIFIED | Composable section reused by all 4 family prompt modules |
| `src/lib/families/shared/tone-intent-fields.ts` | Parameterized ToneIntent field descriptions | VERIFIED | `ToneIntentFieldsOptions` interface with maxEffects, snapshots, includeSecondAmp |
| `src/lib/families/shared/amp-cab-pairing.ts` | Generic amp-to-cab pairing table builder | VERIFIED | Accepts `AmpCabPairing[]`, used by each family with its own pairings data |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `prompt-router.ts` | `helix/prompt.ts` | `import { buildPlannerPrompt, getSystemPrompt } from "@/lib/families/helix/prompt"` | WIRED | Dispatched for "helix" family case |
| `prompt-router.ts` | `stomp/prompt.ts` | `import { buildPlannerPrompt, getSystemPrompt } from "@/lib/families/stomp/prompt"` | WIRED | Dispatched for "stomp" family case |
| `prompt-router.ts` | `podgo/prompt.ts` | `import { buildPlannerPrompt, getSystemPrompt } from "@/lib/families/podgo/prompt"` | WIRED | Dispatched for "podgo" family case |
| `prompt-router.ts` | `stadium/prompt.ts` | `import { buildPlannerPrompt, getSystemPrompt } from "@/lib/families/stadium/prompt"` | WIRED | Dispatched for "stadium" family case |
| `planner.ts` | `prompt-router.ts` | `getFamilyPlannerPrompt(effectiveDevice, modelList)` at line 39 | WIRED | planner.ts imports from prompt-router and calls it with device and model list |
| `chat/route.ts` | `prompt-router.ts` | `getFamilyChatPrompt(device)` at line 78 | WIRED | Chat route imports from prompt-router (line 3) and passes to Gemini systemInstruction |
| `planner.ts` | monolithic deleted | `buildPlannerPrompt` grep returns 0 results | CONFIRMED | Monolithic function completely removed |
| `gemini.ts` | monolithic deleted | `getSystemPrompt` grep returns 0 results | CONFIRMED | Monolithic function completely removed, only getModelId/isPremiumKey/createGeminiClient remain |

---

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| PROMPT-01 | Per-family planner prompts exist and are dispatched by prompt-router | SATISFIED | `prompt-router.ts` exhaustive switch dispatches to 4 family `buildPlannerPrompt()` functions. `planner.ts` line 39 calls `getFamilyPlannerPrompt(effectiveDevice, modelList)`. `prompt-router.test.ts` "returns non-empty string" for all 6 devices passes. |
| PROMPT-02 | Per-family chat prompts exist and are dispatched by prompt-router | SATISFIED | `prompt-router.ts` exhaustive switch dispatches to 4 family `getSystemPrompt()` functions. `chat/route.ts` line 78 calls `getFamilyChatPrompt(device)`. `prompt-router.test.ts` "different families return different chat prompt text" passes. |
| PROMPT-03 | Stomp prompt surfaces block-budget constraint framing | SATISFIED | `stomp/prompt.ts` contains dream-then-trim flow, genre-based priority hierarchy for over-budget, trade-off language. Uses STOMP_CONFIG constants for block/snapshot limits. Tests confirm trade-off language and budget-conscious personality. **Note:** The maxFx mismatch (6/4 vs 5/2) in planner.ts DEVICE RESTRICTION string is being fixed by Plan 69-01 (separate plan running in parallel). The prompt module itself correctly references STOMP_CONFIG. |
| PROMPT-04 | Pod Go prompt surfaces slot priority and chain order framing | SATISFIED | `podgo/prompt.ts` contains hard 4-effect limit with empowering framing, genre-based priority when over 4 effects, DEVICE RESTRICTION with "hard 4 user-effect limit". Tests confirm 4-slot framing and empowering language. |
| PROMPT-05 | Stadium prompt uses Agoura-native vocabulary | SATISFIED | `stadium/prompt.ts` contains FOH/arena/live-sound vocabulary, 7-band Parametric EQ mention, `buildAmpCabPairingTable()` generating real amp-cab pairing from STADIUM_AMPS cabAffinity. No TODO placeholders. Tests confirm FOH vocabulary, arena language, and monitor mix references. |
| PROMPT-06 | Helix prompt surfaces dual-DSP and dual-amp routing options | SATISFIED | `helix/prompt.ts` contains detailed DSP0/DSP1 routing section ("Dual-DSP Routing (CRITICAL)"), split/join block placement, dual-amp layout with explicit numbered steps. Tests confirm DSP0/DSP1 content, split/join blocks, and dual-amp routing. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

No TODO, FIXME, placeholder, or stub patterns found in any prompt module or prompt-router. The TODO(Phase62) placeholder that existed in stadium/prompt.ts was resolved by Phase 67-02 which replaced it with `buildAmpCabPairingTable()` generating real data from STADIUM_AMPS cabAffinity.

---

### Test Execution Results

```
Test Files: 5 passed (5)
      Tests: 77 passed (77)
   Duration: 449ms

Breakdown:
- helix/prompt.test.ts: 16 tests (dual-DSP routing, split/join blocks, cross-family isolation, LT=Floor cache identity)
- stomp/prompt.test.ts: 13 tests (trade-off language, STOMP_CONFIG limits, genre priority, unified Stomp/Stomp XL prompt)
- podgo/prompt.test.ts: 14 tests (4-slot empowering framing, hard limit, no stretch configs, no Agoura names)
- stadium/prompt.test.ts: 18 tests (FOH vocabulary, no HD2 names, amp-cab pairing content, cabAffinity data integrity)
- prompt-router.test.ts: 16 tests (all 6 devices dispatch, families differ, LT=Floor identity)
```

---

### Gaps Summary

No gaps. All 5 observable truths are verified, all 8 artifacts are substantive and wired, all 8 key links are confirmed wired, all 6 requirements (PROMPT-01 through PROMPT-06) are satisfied, and no anti-patterns were found.

**Note on PROMPT-03:** The Stomp prompt module itself (`stomp/prompt.ts`) correctly uses `STOMP_CONFIG` constants for block limits. The maxFx mismatch (6/4 vs 5/2) discovered by the v5.0 audit exists in the `stompRestriction` string in `planner.ts`, which is being fixed by Plan 69-01 (separate plan in this phase). This does not affect the PROMPT-03 requirement which is about the prompt module's constraint framing.

---

_Verified: 2026-03-06T18:50:00Z_
_Verifier: Claude (gsd-executor, retroactive verification)_
