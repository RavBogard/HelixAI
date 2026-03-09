# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-03-09)

**Core value:** Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.
**Current focus:** v6.0 — Preset Intelligence & UX Polish

## Current Position

Milestone: v6.0 — Preset Intelligence & UX Polish
Phase: 17 of 19 (Planner Prompt Intelligence)
Plan: Not started
Status: Ready to plan
Last activity: 2026-03-09 — Phase 16 complete, transitioned to Phase 17

Progress:
- v1.0 Production Release: [██████████] 100% ✓
- v1.1 Post-Release Stabilization: [██████████] 100% ✓
- v2.0 Device Intelligence & UX Overhaul: [██████████] 100% ✓
- v3.0 Preset Format Correctness & Quality: [██████████] 100% ✓
- v4.0 Preset Quality & Reliability: [██████████] 100% ✓
- v5.0 Automated Gold Standard Compliance: [██████████] 100% ✓
- v6.0 Preset Intelligence & UX Polish: [██░░░░░░░░] 25%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Ready for Phase 17 PLAN]
```

## Accumulated Context

### Decisions
- Helix Native device ID 2162690 UNVERIFIED — estimated from Line 6 sequence.
- Manual JSON schema for Gemini planner (buildGeminiJsonSchema) — v1.1 Phase 1
- Removed @anthropic-ai/sdk entirely; vision migrated to Gemini — v2.0 Phase 1
- MODEL_STANDARD upgraded to gemini-3-flash-preview globally — v2.0 Phase 1
- Per-family effect intelligence via DeviceFamily switch — v2.0 Phase 2
- Keep two-context chat→planner architecture (decided, not a debt) — v2.0 Phase 3
- "Golden preset" methodology: reverse-engineer from real exports, match exactly — v4.0 Phase 1
- Split/join always present on both DSPs regardless of dual-amp — v4.0 Phase 1
- TempoSync1=true when BPM present, false otherwise — v4.0 Phase 1
- Amp Drive as snapshot controller (@controller=19) with ROLE_DRIVE table — v4.0 Phase 1
- Reordered v4.0: golden-preset rewrites (2-5) before validation (6), dropped "Stadium & Pod Go Fixes" (superseded by full rewrites) — v4.0
- Pod Go snapshot controller = 11 (not 4), FS indices 1-6 (not 0-5) — v4.0 Phase 2
- Pod Go @pedalstate always 2 (snapshot mode indicator) — v4.0 Phase 2
- Pod Go invalid snapshots have full blocks/controllers structure — v4.0 Phase 2
- HX Stomp snapshot controller = 9 (distinct from Helix 19, Pod Go 11) — v4.0 Phase 3
- HX Stomp @pedalstate always 0 (not bitmask) — v4.0 Phase 3
- HX Stomp empty snapshots have blocks/controllers structure — v4.0 Phase 3
- HX Stomp uses shared getBlockTypeForDevice (fixes modulation @type 0→4) — v4.0 Phase 3
- Stomp XL structurally identical to Stomp — no XL-specific code paths — v4.0 Phase 4
- Stadium cab blocks always 2 slots (cab + NoCab) — v4.0 Phase 5
- Stadium sources include bypass: false field — v4.0 Phase 5
- Stadium fx blocks get @enabled.controller (targetbypass), amp/cab do not — v4.0 Phase 5
- Stadium device_version → 302056738 (NH references) — v4.0 Phase 5
- ToneIntent instrument .optional() not .default("guitar") — v4.0 Phase 7
- Stadium bass: no bass-specific amps (Agoura catalog) — v4.0 Phase 7
- Compression non-negotiable for bass across all families — v4.0 Phase 7
- Helix Native identical to Floor/Rack/LT — no separate treatment — v5.0
- HarnessResult.intentAudit typed as IntentAudit (not simplified shape) — v5.0 Phase 8
- DeviceFamily is lowercase only: "helix" | "stomp" | "podgo" | "stadium" — v5.0 Phase 9
- Stomp XL resolves to "stomp" family, no separate treatment — v5.0 Phase 9
- Bass amp detection via AMP_MODELS.instrument field, not name heuristics — v5.0 Phase 10
- Genre categorization via explicit keyword lookup (unknown genres skip rules) — v5.0 Phase 10
- Supplementary device ID map for corpus (2162944 Native, 2162696 Pod Go Wireless) — v5.0 Phase 11
- Key frequency consensus: required=100%, common=>50%, rare=<=50% — v5.0 Phase 11
- Path generalization (dsp→dsp*, block→block*) for schema cross-preset comparison — v5.0 Phase 11
- Diff against first reference per family (not all) — avoids combinatorial explosion — v5.0 Phase 12
- Intent pass = amp + cab + snapshots matched (no error) — v5.0 Phase 12
- overallPassed = zero critical + zero intent fail + zero musical fail — v5.0 Phase 12
- Non-MV amp Drive threshold 0.80 (not skip) — still catches extreme values — v5.0 Phase 13
- Stomp emits device-max snapshots only (3 or 4), no padding to 8 — v5.0 Phase 13
- Stadium diff compares inner JSON, not HspFile wrapper — v5.0 Phase 13
- Pod Go template blocks at builder level only (not chain-rules) — v5.0 Phase 15
- Pod Go user blocks fill positions [2,3,5,6,7,8,9] around templates [0,1,4] — v5.0 Phase 15

- Container max-w-5xl→max-w-4xl for welcome+chat — v6.0 Phase 16
- Logo 280→240px to fit viewport without crop — v6.0 Phase 16
- Skip local-verify checkpoints (user doesn't run local dev) — v6.0 Phase 16

### Known Issues
- Bass amp HD2 model IDs UNVERIFIED — need confirmation from real .hlx bass preset exports
- HD2_AppDSPFlowBlock padding model name unverified against Pod Go Edit (minor)
- **CRITICAL:** Helix Native device ID is 2162944 (confirmed from JS-EVPanRed.hlx + JS-GermXRed.hlx) — NOT 2162690 as estimated in v1.0 Phase 5
- Stadium device_version varies across presets (285213946, 301991188, 302056726) — we hardcoded 302056738
- Pod Go Wireless device ID may be 2162696 (vs 2162695 for standard Pod Go) — confirmed from The Hell Song.pgp
- Pod Go template blocks at builder level only (not chain-rules) — v5.0 Phase 15
- Pod Go user blocks fill positions [2,3,5,6,7,8,9] around templates [0,1,4] — v5.0 Phase 15

### Reference Files

**Helix Floor/LT/Rack:**
- `C:\Users\dsbog\OneDrive\Desktop\Strab ORNG RV SC.hlx` — dual-path DSP0 with IRs
- `C:\Users\dsbog\OneDrive\Desktop\TONEAGE 185.hlx` — standard dual-DSP
- `C:\Users\dsbog\OneDrive\Desktop\Vox Liverpool.hlx` — effects DSP0, amp+cab DSP1
- `C:\Users\dsbog\Downloads\Alchemy Sultan 2.hlx` — user-fixed reference
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JSDualChmpMan.hlx` — dual-path split AB, SABJ topology

**Helix Native:**
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS-EVPanRed.hlx` — device 2162944, single DSP
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS-GermXRed.hlx` — device 2162944, single DSP

**Pod Go:**
- `C:\Users\dsbog\Downloads\ROCK CRUNCH.pgp` — Pod Go reference (10 blocks, @controller:11)
- `C:\Users\dsbog\Downloads\A7X.pgp` — Pod Go reference (preamp model, minimal controllers)
- `C:\Users\dsbog\Downloads\AI CHICK_ROCK.pgp` — US Double Nrm amp, 4 snapshots, @controller:8 gain
- `C:\Users\dsbog\Downloads\AI SANTANA DRG.pgp` — Cali Texas Ch1 amp, Transistor Tape delay
- `C:\Users\dsbog\Downloads\MUNTAZIR SOLO.pgp` — Brit Trem Brt amp, @controller:6 footswitch toggle, Parametric EQ
- `C:\Users\dsbog\Downloads\GrindZilla .pgp` — PV Panama amp, IR block with irUuidTable
- `C:\Users\dsbog\Downloads\The Hell Song.pgp` — device 2162696 (Pod Go Wireless?), Brit Plexi Brt, empty block8/9

**HX Stomp:**
- `C:\Users\dsbog\Downloads\CATS NO OTO4.hlx` — HX Stomp reference (@controller:9, custom snapshot names)
- `C:\Users\dsbog\Downloads\Bass Rig.hlx` — HX Stomp reference (8 blocks, split/join, variax)

**HX Stomp XL:**
- `C:\Users\dsbog\Downloads\Fillmore Beast.hlx` — device 2162699, Mandarin Rocker amp, SABJ topology, dual cab path
- `C:\Users\dsbog\Downloads\Parallel X.hlx` — device 2162699, SVT4Pro bass amp, @type:3 amp+cab combo, crossover split, commandFS
- `C:\Users\dsbog\Downloads\Throne of Grass.hlx` — device 2162699, Who Watt 100 amp, dual cab blocks (@type:4), topology "A"
- `C:\Users\dsbog\Downloads\MATCH CH.2.hlx` — device 2162699, Matchstick Ch2 amp, @fs_customlabel/@fs_customcolor, @controller:5
- `C:\Users\dsbog\Downloads\Synyster Gates.hlx` — device 2162699, EV Panama Blue amp, VIC_DynPlate legacy reverb, custom snapshot names

**Stadium:**
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\NH_BoomAuRang.hsp` — Stadium reference (dual cab, stereo delays)
- `C:\Users\dsbog\Downloads\NH_STADIUM_AURA_REFLECTIONS\Stadium Rock Rig.hsp` — Stadium reference (rock preset)
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS USSperBlck Vib.hsp` — US Super amp
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS EV Panama Blue.hsp` — EV Panama amp
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS Solid 100.hsp` — Solid 100 amp
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS German Xtra Blue.hsp` — German Xtra, older FW (285213946)
- `C:\Users\dsbog\Downloads\new presets\JS - Dual ChampMan\JS Brit JuJube.hsp` — Brit JuJube amp

### Blockers/Concerns
- None active

### Git State
Last commit: 611a16b
Branch: main
Feature branches merged: none

## Session Continuity

Last session: 2026-03-09
Stopped at: Phase 16 complete, ready to plan Phase 17
Next action: /paul:plan for Phase 17
Resume file: .paul/ROADMAP.md

---
*STATE.md — Updated after every significant action*
