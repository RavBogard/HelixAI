---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: unknown
last_updated: "2026-03-05T18:41:34.438Z"
progress:
  total_phases: 43
  completed_phases: 27
  total_plans: 63
  completed_plans: 54
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
**Current focus:** Phase 52 — Stadium Amp Catalog + Device Constants

## Current Position

Phase: 52 of 59 (Stadium Amp Catalog + Device Constants)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-05 — v4.0 roadmap created (phases 52-58)

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

- **Phase 53 (Builder Rebuild):** High-risk rewrite. HX Edit import verification is the acceptance gate — TypeScript compilation alone is not sufficient.
- **Phase 56 (Per-Model Overrides):** Layer 4 `paramOverrides` mechanism must be established with a unit test BEFORE individual model values are added, or overrides are silently discarded by category defaults.
- **Prompt cache integrity:** Enrichment in Phase 55 must go in the shared static prefix of `buildPlannerPrompt()` — conditional insertions fragment the cache into 6 device buckets.

## Session Continuity

Last session: 2026-03-05
Stopped at: v4.0 roadmap created — phases 52-58 written to ROADMAP.md, STATE.md updated, REQUIREMENTS.md traceability updated
Resume file: None
Next command: `/gsd:plan-phase 52`
