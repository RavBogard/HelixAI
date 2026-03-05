---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: unknown
last_updated: "2026-03-05T19:07:03.261Z"
progress:
  total_phases: 43
  completed_phases: 28
  total_plans: 63
  completed_plans: 57
---

---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: unknown
last_updated: "2026-03-05T19:04:47.169Z"
progress:
  total_phases: 43
  completed_phases: 28
  total_plans: 63
  completed_plans: 57
---

---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: roadmap
last_updated: "2026-03-05"
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** Phase 56 — next phase in quality track (Phase 55 Plan 01 complete)

## Current Position

Phase: 55 of 59 (Planner Prompt Enrichment — Plan 01 complete)
Plan: 1 of 1 complete
Status: Phase complete
Last activity: 2026-03-05 — Phase 55 Plan 01 complete — buildPlannerPrompt enriched with Gain-Staging Intelligence, Amp-to-Cab Pairing, Effect Discipline by Genre; 10 new tests, 195 total passing

Progress: [████████████████████░░░░░░░░░] ~0% of v4.0 (0/7 phases complete)

## Accumulated Context

### Decisions

- [v3.2]: logUsage() is a no-op (zero I/O) when LOG_USAGE !== true — no production performance impact
- [v3.2]: Variax is NOT a signal chain block — it's an input configuration (@input: 3 = Multi)
- [v3.2]: Stadium dual-amp uses single-amp Agoura US Clean fallback (dual-amp unsupported)
- [v4.0]: Effect combination logic (COMBO-01/02/03) deferred to v4.1 — requires context-passing architectural decision
- [v4.0]: Cost-aware model routing (COST-01) deferred to v4.1 — requires 30-day baseline and A/B quality test with 20+ tone goals
- [v4.0]: Phase ordering: 52, 55, 56 can start in parallel; 53 depends on 52; 54 depends on 53; 57 depends on 56; 58 runs last
- [Phase 52-stadium-amp-catalog]: STADIUM_DEVICE_VERSION set to 301990015 — lowest common denominator from Agoura_Bassman.hsp and Agoura_Hiwatt.hsp; newer .hsp files use higher values but 301990015 is the dedicated single-amp baseline
- [Phase 52-stadium-amp-catalog]: defaultParams keys always use standard names (Drive, Bass, Mid, Treble, Master, ChVol) regardless of actual .hsp param key name — builder handles translation (Treb->Treble, MasterVol->Master)
- [Phase 53-01]: Stadium cab params (Delay, IrData, Level, Pan, Position) added conditionally via device guard in resolveCabParams() — non-Stadium devices unaffected
- [Phase 53-01]: STADIUM_SLOT_ALLOCATION constant replaces sequential flowPos — amp always at b05/pos:5, cab at b06/pos:6, matching Agoura_Bassman.hsp reference corpus
- [Phase 53-02]: 9 structural comparison tests added using same fixture as Plan 01 — strict key-count assertion on flow 1, per-key sources verification, harness access-field absence check
- [Phase 54-stadium-device-unblock]: Stadium format bugs (device version, slot params, grid positions) were already fixed by Phases 52 and 53 — no re-work needed in Phase 54
- [Phase 55-planner-prompt-enrichment]: Enrichment sections are static text in shared prefix (after Dual-Amp Rules, before ${podGo ?}) — no device interpolations that would fragment the prompt cache into per-device buckets
- [Phase 55-planner-prompt-enrichment]: Cab pairing table uses only canonical names from CAB_MODELS; plan's suggestions (4x12 1960 T75, 1x12 Cali IV, 2x12 Mandarin 30) were not in catalog and were corrected/omitted

### Roadmap Evolution

- v3.2 milestone: 5 phases (42, 48-51), 8 plans — all complete
- v4.0 phases 52-58 derived from REQUIREMENTS.md (22 v4.0 requirements, 7 phases)
- Phase 59 added: Fix Helix Floor preset import error 8309 incompatible device type (user report from Paul Morgan)
- Stadium track (52→53→54) is sequential — catalog before builder, builder before unblock
- Quality track (55, 56→57) is parallel with Stadium track
- 11 real Stadium .hsp reference presets available at C:/Users/dsbog/Downloads/NH_STADIUM_AURA_REFLECTIONS/

### User Feedback (v4.0 context)

- **Michael Weaver:** "Signal chain cannot reach the sound promised. How can there be an ambient snapshot without a single reverb or delay in the chain?" — Dual-amp preset generated with no time-based effects. Validates PROMPT-03 (effect discipline) and FX-01/FX-02/FX-03 (effect intelligence). Chain had: 2x12 Blue Bell, 2x12 Double C12N, Kinky Comp, Minotaur, Matchstick Ch1, US Double Nrm, Parametric EQ, Gain Block — zero reverb, zero delay.
- **Glenn Sully:** "Output level too low. First DSP didn't connect to second line DSP. Answers were a bit long winded." — Validates FX-04 (snapshot volume balance), possible dual-DSP routing issue, chat verbosity. Also requested: effect explanations and recording context.
- **Paul Morgan:** "Unfortunately can't get any to load on the Helix Floor. Keep getting this message." — HX Edit error 8309: Incompatible target device type. Generated .hlx presets fail to import on Helix Floor hardware. Critical user-facing bug → Phase 59.
- **Tal Solomon Vardy:** "All my presets don't work yet via HX Edit, waiting for fixing" — Same error 8309: Incompatible target device type. Device unknown. Second report of same bug → confirms Phase 59 priority.

### Pending Todos

None.

### Blockers/Concerns

- **Phase 56 (Per-Model Overrides):** Layer 4 `paramOverrides` mechanism must be established with a unit test BEFORE individual model values are added, or overrides are silently discarded by category defaults.
- **Prompt cache integrity:** Enrichment in Phase 55 must go in the shared static prefix of `buildPlannerPrompt()` — conditional insertions fragment the cache into 6 device buckets.
- **HX Edit verification pending:** Stadium code path is fully unblocked but HX Edit import verification (5-10 test generations with varied tone goals) has not been run — this is the hardware acceptance gate.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 55-01-PLAN.md — buildPlannerPrompt enriched with gain-staging intelligence, amp-to-cab pairing, effect discipline by genre; 10 new tests, 195 total passing
Resume file: None
Next command: `/gsd:execute-phase 56` (Per-Model Param Overrides — Quality track continues)
