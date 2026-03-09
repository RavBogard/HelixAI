---
phase: 07-bass-support
plan: 02
subsystem: api
tags: [bass, prompts, chat, planner, gain-staging, effect-intelligence]

requires:
  - phase: 07-bass-support-plan-01
    provides: 19 bass amps + 8 bass cabs + ToneIntent instrument field
provides:
  - Bass-aware chat interview flow across all 4 device families
  - Bass amp-cab pairing guidance in all 4 planner prompts
  - Bass-specific gain staging intelligence
  - Bass effect recommendations per device family and genre
affects: [v4.0-milestone-completion]

tech-stack:
  added: []
  patterns: [instrument-aware-prompts, bass-effect-priority-tables, bass-amp-cab-pairings]

key-files:
  created: []
  modified:
    - src/lib/families/helix/prompt.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/stadium/prompt.ts
    - src/lib/families/shared/gain-staging.ts
    - src/lib/families/shared/effect-model-intelligence.ts

key-decisions:
  - "Stadium bass: no bass-specific amps (Agoura catalog), recommend cleanest amp + advise user"
  - "Bass pairings exported as constants (HELIX_BASS_AMP_CAB_PAIRINGS etc.) matching guitar pattern"
  - "Compression is non-negotiable for bass across all families — prioritized over all other effects"

patterns-established:
  - "Instrument-aware prompt sections: 'When instrument is bass' conditional guidance blocks"
  - "Bass genre tables: Rock, Metal, Funk/Slap, Jazz/R&B, Worship — 5 bass-specific genres"

duration: ~8min
started: 2026-03-09T14:49:00Z
completed: 2026-03-09T14:57:00Z
---

# Phase 7 Plan 02: Bass Prompt Intelligence Summary

**All 4 device families now bass-aware: chat prompts screen for instrument, planner prompts include bass amp-cab pairings and effect guidance, gain staging uses bass-specific logic, and effect intelligence recommends compression-first bass chains.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~8min |
| Started | 2026-03-09T14:49:00Z |
| Completed | 2026-03-09T14:57:00Z |
| Tasks | 3 completed |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Chat Prompts Ask About Instrument | Pass | All 4 families updated: "Instrument + Tone + Guitar" interview step, J-style/P-style pickup framing |
| AC-2: Planner Prompts Include Bass Amp-Cab Pairings | Pass | Helix/Stomp/Pod Go have BASS_AMP_CAB_PAIRINGS constants; Stadium has advisory note (no bass amps) |
| AC-3: Bass Gain Staging | Pass | Bass section added: Drive 0.2-0.4, LA Studio Comp over Klon/TS, rarely want distortion |
| AC-4: Bass Effect Intelligence | Pass | Bass subsections in all 4 family functions with priority tables and genre guides |
| AC-5: Existing Tests Pass | Pass | 1248/1248 tests, tsc clean |

## Accomplishments

- All 4 chat prompts screen for guitar vs bass early in interview with bass-specific pickup framing
- Bass amp-cab pairing constants added to Helix (7 families), Pod Go (5), and Stomp (5)
- Bass gain staging section: less drive, compression over boost pedals, no high-gain saturation
- Bass effect intelligence with priority tables and genre guides for all 4 device families
- Stadium bass routing advises users that amp catalog is guitar-focused

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/families/helix/prompt.ts` | Modified | Bass interview flow, dual-amp/Variax bass notes, HELIX_BASS_AMP_CAB_PAIRINGS, bass routing instruction |
| `src/lib/families/podgo/prompt.ts` | Modified | Bass interview flow, bass slot trade-offs, PODGO_BASS_AMP_CAB_PAIRINGS, bass routing instruction |
| `src/lib/families/stomp/prompt.ts` | Modified | Bass interview flow, bass trim guidance, STOMP_BASS_AMP_CAB_PAIRINGS, bass routing instruction |
| `src/lib/families/stadium/prompt.ts` | Modified | Bass interview flow + DI/PA question, bass routing advisory (no Agoura bass amps) |
| `src/lib/families/shared/gain-staging.ts` | Modified | Bass Gain Staging subsection (Drive, Boost, ChVol for bass) |
| `src/lib/families/shared/effect-model-intelligence.ts` | Modified | Bass Effect Recommendations subsection in all 4 family functions |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Stadium gets advisory, not bass amp pairings | Agoura catalog has no HD2 bass amps | Bass players on Stadium advised to use Helix/Stomp instead |
| Pod Go bass pairings: 5 families (not 7) | Fewer amps relevant for 4-slot constraint | Simpler, focused selection |
| Compression non-negotiable for bass | Bass dynamics need controlling in every genre | Compression is Priority 1 in all family bass tables |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Plan executed exactly as written

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Phase 7 (Bass Support) is now complete — both plans executed
- All prompt, data, and intelligence layers are bass-aware
- v4.0 milestone ready for completion

**Concerns:**
- Bass amp HD2 model IDs remain UNVERIFIED (from Plan 01)
- Stadium bass support limited to cabs and advisory (no Agoura bass amps)

**Blockers:**
- None

---
*Phase: 07-bass-support, Plan: 02*
*Completed: 2026-03-09*
