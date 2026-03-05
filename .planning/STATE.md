---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: unknown
last_updated: "2026-03-05T19:43:38.772Z"
progress:
  total_phases: 43
  completed_phases: 30
  total_plans: 63
  completed_plans: 62
---

---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Stadium Rebuild + Preset Quality Leap
status: executing
last_updated: "2026-03-05"
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 12
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Generated presets must sound professional enough to compete with custom presets that people pay experts for — mix-ready out of the box, dynamically responsive, signal-chain intelligent
**Current focus:** Phase 56 complete — both plans done; next is Phase 57

## Current Position

Phase: 57 of 59 (Effect Parameter Intelligence — Plan 01 complete)
Plan: 1 of 3 complete
Status: In Progress (Phase 57 Plan 01 done; Phase 57 Plan 02 next)
Last activity: 2026-03-05 — Phase 57 Plan 01 complete — PreDelay added to all 9 genre reverb entries; tempoHint tempo-synced delay (30/BPM); 208/208 tests green; FX-02/FX-03 satisfied

Progress: [████████████████████░░░░░░░░░] ~67% of v4.0 (5/8 phases complete, 57 in progress)

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
- [Phase 56-per-model-amp-overrides]: Canary value Drive:0.99 on US Deluxe Nrm proves Layer 4 mechanism; Plan 02 replaces with Drive:0.60, Master:1.0
- [Phase 56-per-model-amp-overrides]: Test 1 replaced US Deluxe Nrm with Solo Lead Clean (Soldano SLO-100 clean) to avoid override conflict; AmpFamily added to types.ts per AmpCategory/TopologyTag convention
- [Phase 55-planner-prompt-enrichment]: verify-prompt-enrichment.ts checks all 6 device variants for enrichment presence and shared-prefix ordering; exits 0/1 for CI use
- [Phase 56-per-model-amp-overrides-plan02]: 18 amp entries updated with real paramOverrides values; US Deluxe Nrm canary Drive:0.99 replaced with Drive:0.60, Master:1.0; 11 non-MV amps get Master:1.0; 5 high-gain amps get Drive/Presence anti-correlation; AMP-05 verified by count and spot check
- [Phase 57-01]: PreDelay values in normalized seconds (0.025 = 25ms) matching models.ts encoding
- [Phase 57-01]: tempoHint passed as scalar not full ToneIntent to keep resolveDefaultParams signatures narrow
- [Phase 57-01]: Override order: model defaults -> genre -> tempo (outermost, most intent-specific)

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

- **HX Edit verification pending:** Stadium code path is fully unblocked but HX Edit import verification (5-10 test generations with varied tone goals) has not been run — this is the hardware acceptance gate.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 57-01-PLAN.md — PreDelay in 9 genre reverb entries; tempoHint tempo-synced delay (30/BPM formula); 208/208 tests green; FX-02/FX-03 satisfied
Resume file: None
Next command: Continue Phase 57 — run Plan 02 (guitar-type EQ, FX-01)
