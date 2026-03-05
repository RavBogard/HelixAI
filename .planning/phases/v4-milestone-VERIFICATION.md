---
milestone: v4.0-preset-quality-leap
verified: 2026-03-05T22:00:00Z
status: gaps_found
score: 5/10 phases completed, 22/32 requirements addressable
completed_phases: [42, 48, 49, 50, 51]
not_started_phases: [43, 44, 45, 46, 47]
gaps:
  - truth: "Phases 43-47 (core quality improvements) are not started"
    status: failed
    reason: "The five phases that directly improve preset quality (Planner Prompt, Amp Parameters, Effects/EQ/Snapshots, Effect Combinations, Model Routing) have zero implementation. These are the core of the milestone goal."
    artifacts: []
    missing:
      - "Phase 43: Planner prompt improvements for gain staging, cab pairing, effect discipline (PROMPT-01 through PROMPT-04)"
      - "Phase 44: Per-model amp parameter resolution with ampFamily classification (AMP-01 through AMP-04)"
      - "Phase 45: Context-sensitive EQ, reverb PreDelay scaling, tempo-synced delay, snapshot volume balancing (FX-01 through FX-04)"
      - "Phase 46: Effect interaction parameters, genre block substitution, cross-device validation (COMBO-01 through COMBO-03)"
      - "Phase 47: Evidence-based model routing decision document (COST-01)"
  - truth: "VARIAX-03 research document does not exist"
    status: partial
    reason: "Phase 49 Success Criteria #3 requires a research document describing exact Variax block JSON structure from real .hlx exports with at least 2 real-world examples. No such document exists. However, the implementation itself works correctly — Variax is implemented as an input configuration change (@input:3) rather than a separate block, which is the correct approach based on actual Helix hardware behavior."
    artifacts:
      - path: ".planning/phases/ (no Phase 49 directory)"
        issue: "No Phase 49 planning directory exists at all — no plan, no summary, no research document"
    missing:
      - "Research document per VARIAX-03 requirement (formal documentation of the @input:3 approach)"
  - truth: "Stadium device selection is temporarily blocked in UI"
    status: partial
    reason: "Phase 51 fixed the Stadium amp lookup in chain-rules, but the UI still shows 'Stadium support temporarily unavailable' and prevents users from selecting Stadium as a device. The backend fix exists but the UI guard was not removed."
    artifacts:
      - path: "src/app/page.tsx"
        issue: "Lines 1338 and 1433 display 'Stadium support temporarily unavailable' message and the Stadium option is not selectable"
    missing:
      - "Remove the Stadium device selection block in page.tsx to expose the fixed Stadium pipeline to users"
  - truth: "REQUIREMENTS.md status tracking not updated for completed phases"
    status: partial
    reason: "All VARIAX, DONATE, FOOTER, and AUDIT requirements still show 'Pending' in REQUIREMENTS.md despite having implementation evidence"
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "Lines 294-322 show all v4.0 requirements as Pending even though phases 42, 48, 49, 50, 51 are complete"
    missing:
      - "Update REQUIREMENTS.md status for AUDIT-01/02/03, FOOTER-01, VARIAX-01/02/04/05, DONATE-01/02/03/04 to Complete"
---

# v4.0 Preset Quality Leap -- Milestone Verification Report

**Milestone Goal:** Close the gap between HelixTones-generated presets and the best custom/commercial presets
**Verified:** 2026-03-05
**Status:** gaps_found (core quality phases not started)
**Overall:** 5/10 phases completed; 5 phases not started

## Executive Summary

The v4.0 milestone has completed its infrastructure and peripheral phases (token audit, footer, Variax, donation, Stadium fix) but has **not started the five core quality improvement phases** (43-47) that directly address the milestone goal. The completed phases provide tooling, UI polish, and feature additions -- important work but not the preset quality improvements that define this milestone.

The milestone goal of "closing the gap between HelixTones-generated presets and the best custom/commercial presets" requires Phases 43-47, which cover smarter planner prompts, per-model amp parameters, context-sensitive effects, effect interaction intelligence, and model routing optimization. **None of these have begun.**

---

## Phase-by-Phase Verification

### Phase 42: Token Cost Audit + Quality Baseline -- VERIFIED

**Goal:** Measurable cost data and reproducible quality baseline for all subsequent v4.0 phases.

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Summary script reports average tokens and cost per endpoint | VERIFIED | `scripts/summarize-usage.ts` (129 lines) reads `usage.jsonl` and reports avg prompt/completion/cached/total tokens plus cost per endpoint |
| 2 | Baseline suite produces 36 presets (6 tones x 6 devices) | VERIFIED | `scripts/generate-baseline.ts` (399 lines) with 6 tone scenarios x 6 devices, deterministic pipeline (no AI), validated by `generate-baseline.test.ts` with 7 integration tests |
| 3 | Cache hit rate report with optimization recommendations | VERIFIED | `scripts/cache-hit-report.ts` (185 lines) with `parseCacheReport()`, `getRecommendation()`, and `formatReport()`. Tested by `cache-hit-report.test.ts` (168 lines) |
| 4 | Token logging behind LOG_USAGE env flag, no-op when disabled | VERIFIED | `src/lib/usage-logger.ts` line 125: `if (process.env.LOG_USAGE !== "true") return;` -- tested by unit tests confirming no file write when flag is unset |

**Wiring verification:**
- `usage-logger.ts` imported and called in `src/lib/planner.ts` (line 11, called line 153) -- Claude/generate endpoint
- `usage-logger.ts` imported and called in `src/app/api/chat/route.ts` (line 4, called line 105) -- Gemini/chat endpoint
- Both endpoints log full token breakdown including cache hit detection

**Requirements:** AUDIT-01, AUDIT-02, AUDIT-03 -- all SATISFIED

---

### Phase 48: Footer Restoration & Fixed Positioning -- VERIFIED

**Goal:** Footer always visible, pinned to viewport bottom, with "Daniel Bogard" link.

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Footer visible at viewport bottom on welcome screen | VERIFIED (human needed) | `src/components/Footer.tsx` uses `className="fixed bottom-0 left-0 right-0 z-40"` -- CSS ensures fixed positioning |
| 2 | Footer stays at bottom after 20+ messages | VERIFIED (human needed) | `position: fixed` in CSS -- does not participate in document flow, stays at viewport bottom regardless of content length |
| 3 | Footer visible after preset generation | VERIFIED (human needed) | Same fixed positioning applies across all UI states |
| 4 | "Daniel Bogard" links to DanielBogard.com in new tab | VERIFIED | Line 33: `href="https://danielbogard.com"` with `target="_blank" rel="noopener noreferrer"` |
| 5 | 11px mono styling with amber hover | VERIFIED | Line 22: `text-[11px]` with `font-family: var(--font-mono)` (line 16), hover class `hover:text-[var(--hlx-amber)]` (line 37) |

**Wiring verification:**
- `Footer` imported in `src/app/page.tsx` (line 8) and rendered at line 1689
- `FOOTER_HEIGHT` exported for layout spacing

**Requirements:** FOOTER-01 -- SATISFIED

---

### Phase 49: Variax Guitar Support -- MOSTLY VERIFIED (research doc gap)

**Goal:** Capture Variax guitar model when user mentions it; embed VDI input configuration in .hlx presets.

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Mentioning Variax triggers follow-up; AI never asks unprompted | VERIFIED | `src/lib/gemini.ts` lines 82-88: "Variax Guitar Awareness" section with `CRITICAL: NEVER ask about Variax unprompted` |
| 2 | ToneIntentSchema accepts optional variaxModel | VERIFIED | `src/lib/helix/tone-intent.ts` line 37: `variaxModel: z.enum(VARIAX_MODEL_NAMES).optional()` |
| 3 | Research document with Variax block JSON structure | FAILED | No research document exists. No Phase 49 planning directory exists. Implementation used @input:3 approach (correct for VDI) but undocumented |
| 4 | Helix LT preset with variaxModel has Variax block | VERIFIED | `src/lib/helix/preset-builder.ts` line 78: `useVariaxInput = !!(spec.variaxModel && isVariaxSupported(device))`, line 135: `"@input": 3` (Multi/VDI) |
| 5 | Pod Go/Stadium with variaxModel produces valid file, no Variax | VERIFIED | `src/lib/helix/types.ts` line 203: `isVariaxSupported()` returns false for Pod Go and Stadium |
| 6 | HX Stomp/XL include Variax blocks | VERIFIED | `src/lib/helix/stomp-builder.ts` lines 302-306: same `isVariaxSupported()` + `@input:3` logic for Stomp devices |

**Wiring verification:**
- `variaxModel` flows: ToneIntent schema -> planner.ts prompt (line 70) -> generate route (line 99) -> PresetSpec -> preset-builder.ts / stomp-builder.ts
- `VARIAX_MODEL_NAMES` defined in `models.ts` (9 models: Spank, Lester, T-Model, Special, Jazzbox, Acoustic, Reso, Semi, R-Billy)
- `isVariaxSupported()` in `types.ts` correctly returns true for Helix + Stomp, false for Pod Go + Stadium

**Requirements:**
- VARIAX-01: SATISFIED (chat awareness in gemini.ts)
- VARIAX-02: SATISFIED (optional schema field)
- VARIAX-03: NOT SATISFIED (no research document)
- VARIAX-04: SATISFIED (preset-builder @input:3 logic)
- VARIAX-05: SATISFIED (device guard via isVariaxSupported)

**Note:** The implementation chose `@input: 3` (Multi input = Guitar + VDI) rather than injecting a separate Variax "block" into the signal chain. This is technically correct -- real Helix hardware configures Variax via the input setting, not as a signal chain block. The research document requirement (VARIAX-03) is the only gap, and it is documentation-only.

---

### Phase 50: Donation/Support Integration -- VERIFIED

**Goal:** Post-download donation card with PayPal/Venmo/CashApp; persistent Support link in footer.

| # | Success Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Inline donation card after first download | VERIFIED | `src/app/page.tsx` line 804-807: `if (!donationDismissed) { setShowDonation(true) }` triggered in download handler |
| 2 | Dismissible, does not re-appear after dismissal | VERIFIED | `DonationCard` has `onDismiss` prop; page.tsx line 1686: `setDonationDismissed(true)` on dismiss |
| 3 | PayPal/Venmo/CashApp buttons with correct URLs | VERIFIED | `src/components/DonationCard.tsx` lines 11-14: exact URLs match spec (`paypal.me/dsbogard`, `venmo.com/Daniel-Bogard-1`, `cash.app/$ravbogard`), all with `target="_blank"` |
| 4 | Footer "Support" link re-shows donation card | VERIFIED | `Footer.tsx` line 7: dispatches `helixtones:show-support` event; `page.tsx` line 506: event listener calls `setShowDonation(true)` |
| 5 | Uses --hlx-* CSS custom properties only | VERIFIED | `DonationCard.tsx` uses only `var(--hlx-border-warm)`, `var(--hlx-elevated)`, `var(--hlx-text)`, `var(--hlx-text-sub)`, `var(--hlx-text-muted)`, `var(--hlx-amber)` -- zero brand colors |

**Wiring verification:**
- `DonationCard` imported in `page.tsx` (line 9), rendered at line 1684 with `visible={showDonation}` and `fixed` prop
- `Footer` Support button dispatches custom event, caught by `page.tsx` useEffect
- Download handler at line 804 triggers donation card for first download

**Requirements:** DONATE-01, DONATE-02, DONATE-03, DONATE-04 -- all SATISFIED

---

### Phase 51: Fix Stadium Agoura Amp Lookup -- VERIFIED

**Goal:** Fix `assembleSignalChain` to correctly resolve Stadium amps from `STADIUM_AMPS` catalog.

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Stadium device uses STADIUM_AMPS lookup, not AMP_MODELS | VERIFIED | `chain-rules.ts` lines 267-268: `const ampModel = stadium ? STADIUM_AMPS[intent.ampName] : AMP_MODELS[intent.ampName]` |
| 2 | Error message indicates STADIUM_AMPS for Stadium device | VERIFIED | Line 272: error says `"${stadium ? "STADIUM_AMPS" : "AMP_MODELS"}"` |
| 3 | Test proves Agoura amp produces Agoura_* model ID | VERIFIED | `chain-rules.test.ts` line 415: test `"Stadium preset with valid Agoura amp produces Agoura_* model IDs"` |
| 4 | Test proves HD2-only amp fails on Stadium with clear error | VERIFIED | `chain-rules.test.ts` line 434: test `"Stadium preset with HD2-only amp name throws"` |
| 5 | Baseline generator uses Agoura amps for Stadium | VERIFIED | `generate-baseline.ts` lines 149-247: `STADIUM_FIXTURES` uses `"Agoura US Clean"`, `"Agoura German Crunch"`, `"Agoura German Xtra Red"`, `"Agoura Brit Plexi"` |

**Caveat:** Stadium device selection is blocked in the UI (page.tsx lines 1338, 1433: "Stadium support temporarily unavailable"). The backend fix is complete but users cannot access it.

**Requirements:** No specific requirement IDs assigned to Phase 51 in ROADMAP.md.

---

## Not Started Phases (43-47)

These five phases represent the **core quality improvement work** of the v4.0 milestone.

### Phase 43: Planner Prompt Quality (NOT STARTED)
**Goal:** Smarter creative decisions about gain staging, amp/cab pairing, and effect selection
**Requirements:** PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04
**Impact:** This phase directly improves the AI's tone planning decisions -- the single biggest lever for preset quality

### Phase 44: Knowledge Layer -- Amp Parameters (NOT STARTED)
**Goal:** Per-model amp parameter resolution (Fender Master maxed, Mesa Master conservative) instead of flat category averages
**Requirements:** AMP-01, AMP-02, AMP-03, AMP-04
**Impact:** Currently all amps in a category get identical parameters. Real-world tone quality requires model-specific tuning.

### Phase 45: Knowledge Layer -- Effects, EQ, Snapshots (NOT STARTED)
**Goal:** Context-sensitive effect parameters (EQ adapts to pickup type, reverb PreDelay scales with tempo, musical delay subdivisions)
**Requirements:** FX-01, FX-02, FX-03, FX-04
**Impact:** Current effects use generic defaults regardless of context. This phase makes effects sound intentional.

### Phase 46: Effect Combination Intelligence (NOT STARTED)
**Goal:** Effects adjusted for synergy (compressor + overdrive interaction), genre-appropriate effect choices enforced
**Requirements:** COMBO-01, COMBO-02, COMBO-03
**Impact:** Prevents illogical combinations and ensures effects work together, not just independently

### Phase 47: Model Routing Decision (NOT STARTED)
**Goal:** Evidence-based decision about whether current model split (Gemini Flash chat, Claude Sonnet generation) is optimal
**Requirements:** COST-01
**Impact:** Cost optimization without quality regression -- required Phase 42 audit data as input

---

## Anti-Patterns Scan

No anti-patterns found in completed phase artifacts:
- Zero TODO/FIXME/PLACEHOLDER comments in usage-logger.ts, Footer.tsx, DonationCard.tsx, chain-rules.ts
- No stub implementations (empty returns, console.log-only handlers)
- No orphaned code (all components imported and rendered)

**One notable pattern:**
- Stadium UI block in `page.tsx` (lines 1338, 1433) -- "temporarily unavailable" message was added by Phase 51 fix commit but the fix should have also re-enabled the selector since the backend bug was resolved

---

## Requirements Coverage Summary

| Requirement | Phase | Status | Evidence |
|---|---|---|---|
| AUDIT-01 | 42 | SATISFIED | usage-logger.ts wired into planner.ts and chat/route.ts |
| AUDIT-02 | 42 | SATISFIED | generate-baseline.ts produces 36 deterministic presets |
| AUDIT-03 | 42 | SATISFIED | cache-hit-report.ts with hit rate analysis and recommendations |
| FOOTER-01 | 48 | SATISFIED | Footer.tsx with fixed positioning, correct link, correct styling |
| VARIAX-01 | 49 | SATISFIED | gemini.ts Variax awareness section |
| VARIAX-02 | 49 | SATISFIED | ToneIntentSchema optional variaxModel field |
| VARIAX-03 | 49 | NOT SATISFIED | No research document exists |
| VARIAX-04 | 49 | SATISFIED | preset-builder.ts and stomp-builder.ts @input:3 logic |
| VARIAX-05 | 49 | SATISFIED | isVariaxSupported() device guard |
| DONATE-01 | 50 | SATISFIED | Post-download donation card in page.tsx |
| DONATE-02 | 50 | SATISFIED | PayPal/Venmo/CashApp URLs correct, target="_blank" |
| DONATE-03 | 50 | SATISFIED | Footer Support link with custom event |
| DONATE-04 | 50 | SATISFIED | All --hlx-* CSS custom properties, zero brand colors |
| PROMPT-01 | 43 | NOT STARTED | Phase 43 not begun |
| PROMPT-02 | 43 | NOT STARTED | Phase 43 not begun |
| PROMPT-03 | 43 | NOT STARTED | Phase 43 not begun |
| PROMPT-04 | 43 | NOT STARTED | Phase 43 not begun |
| AMP-01 | 44 | NOT STARTED | Phase 44 not begun |
| AMP-02 | 44 | NOT STARTED | Phase 44 not begun |
| AMP-03 | 44 | NOT STARTED | Phase 44 not begun |
| AMP-04 | 44 | NOT STARTED | Phase 44 not begun |
| FX-01 | 45 | NOT STARTED | Phase 45 not begun |
| FX-02 | 45 | NOT STARTED | Phase 45 not begun |
| FX-03 | 45 | NOT STARTED | Phase 45 not begun |
| FX-04 | 45 | NOT STARTED | Phase 45 not begun |
| COMBO-01 | 46 | NOT STARTED | Phase 46 not begun |
| COMBO-02 | 46 | NOT STARTED | Phase 46 not begun |
| COMBO-03 | 46 | NOT STARTED | Phase 46 not begun |
| COST-01 | 47 | NOT STARTED | Phase 47 not begun |

**Totals:** 14/32 requirements SATISFIED, 1 NOT SATISFIED (VARIAX-03), 17 NOT STARTED

---

## Human Verification Required

### 1. Footer Fixed Positioning Across States

**Test:** Navigate to welcome screen, start a chat with 20+ messages, generate a preset
**Expected:** Footer remains pinned to viewport bottom in all three states
**Why human:** CSS `position: fixed` can be overridden by ancestor transforms, z-index conflicts, or viewport issues that grep cannot detect

### 2. Donation Card Post-Download Flow

**Test:** Generate and download a preset, verify donation card appears inline, dismiss it, download again
**Expected:** Card appears after first download, does not reappear after dismissal, Support link re-shows it
**Why human:** Event timing and state management require live browser interaction

### 3. Stadium Device Selection Block

**Test:** Open device selector in welcome screen and chat flow
**Expected:** Currently blocked -- verify "temporarily unavailable" message is shown. Then verify if the backend actually works by calling the generate API directly with `helix_stadium`
**Why human:** Need to confirm UI state and whether Stadium generation pipeline works end-to-end after the Phase 51 fix

### 4. Variax Chat Detection

**Test:** Start a conversation mentioning "I play a JTV-69", verify follow-up. Start another conversation without mentioning Variax, verify no Variax questions
**Expected:** Reactive Variax detection with no proactive questioning
**Why human:** AI chat behavior is non-deterministic and requires conversational testing

---

## Milestone Goal Assessment

**Milestone Goal:** "Close the gap between HelixTones-generated presets and the best custom/commercial presets"

**Can this goal be achieved with the remaining phases?** Yes, but the critical work is all ahead.

The completed phases (42, 48, 49, 50, 51) provide:
- **Measurement infrastructure** (Phase 42) -- essential for validating quality improvements
- **Feature additions** (Phase 49: Variax) -- extends capability but does not improve base preset quality
- **UI/UX polish** (Phases 48, 50) -- user-facing improvements unrelated to tone quality
- **Bug fix** (Phase 51) -- restores Stadium functionality

The not-started phases (43-47) contain **all the actual quality improvements**:
- Phase 43 (Planner Prompt) -- smarter AI creative decisions
- Phase 44 (Amp Parameters) -- per-model parameter tuning instead of category averages
- Phase 45 (Effects/EQ/Snapshots) -- context-sensitive effects
- Phase 46 (Effect Combinations) -- synergistic effect interactions
- Phase 47 (Model Routing) -- cost optimization

**Assessment:** The milestone is 50% complete by phase count but approximately 20% complete toward its stated goal. The measurement baseline (Phase 42) is a prerequisite that unlocks quality work, but the quality work itself has not begun. Phases 43-46 are where the "preset quality leap" actually happens. Phase 47 is cost optimization that can only be done after quality work stabilizes.

The completed phases form a solid foundation. The remaining work is well-defined with clear requirements and success criteria. The 36-preset baseline from Phase 42 provides a regression testing framework for all subsequent changes.

---

_Verified: 2026-03-05T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Scope: v4.0 Milestone audit (Phases 42-51)_
