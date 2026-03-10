# Project: helixtones.com

## Description
An AI-powered preset builder for Line 6 products. Supports Helix Floor/Rack/LT/Native, Stadium and Stadium XL, HX Stomp and Stomp XL, and Pod Go. It understands each device family's hardware specs, limitations, and capabilities, then builds professional-quality presets with appropriate snapshots, stomps, and signal chains. Uses AI to interview users about their existing guitar/bass rig and desired tone, then generates downloadable presets that compete with professional presets for sale.

## Core Value
Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.

## Requirements

### Validated
- ✓ Correct signal chain ordering (Horizon Gate post-cab) — Phase 2
- ✓ Correct gain staging defaults (Scream 808, non-MV amps, high-gain Drive) — Phase 2
- ✓ Correct volume balancing (ambient ChVol, reverb floor) — Phase 2
- ✓ Safe lead snapshot volume levels (2.0 dB gain boost) — Phase 3
- ✓ Pod Go block key mapping verified correct — Phase 3
- ✓ DSP ordering validation (advisory warnings) — Phase 3
- ✓ AI platform benchmarked (6 providers x 6 scenarios) — Phase 4
- ✓ Gemini 3 Flash selected as planner (100% schema, 86% quality, $0.006/gen) — Phase 4
- ✓ Helix Native fully supported as device target — Phase 5
- ✓ Full pipeline test coverage for all 10 device targets — Phase 6
- ✓ Quality validation baseline: no critical issues across all 4 device families — Phase 6
- ✓ Build stability restored (3 Vercel build failures fixed) — v1.1 Phase 1
- ✓ Data integrity: 7 invalid AI prompt amp names corrected + tests added — v1.1 Phase 1
- ✓ Planner migrated to Gemini 3 Flash (Claude Sonnet removed from planner) — v1.1 Phase 1
- ✓ Vision migrated from Claude to Gemini — zero Anthropic dependencies remain — v2.0 Phase 1
- ✓ Standard model tier upgraded to gemini-3-flash-preview — v2.0 Phase 1
- ✓ Per-family effect intelligence: Helix (dual-DSP layering), Stomp (priority-based), Pod Go (4-slot templates), Stadium (arena/FOH) — v2.0 Phase 2
- ✓ AI chat conciseness: structured summaries, bolded key info, 2-3 exchange interviews — v2.0 Phase 3
- ✓ UI/UX redesign: component extraction, chat typography/responsive, PresetCard visual polish — v2.0 Phase 4
- ✓ WCAG 2.1 AA accessibility: aria-live chat, labeled controls, color contrast compliance — v2.0 Phase 5
- ✓ Test infrastructure: vitest jsdom default, npm test scripts, 1201 tests passing — v2.0 Phase 5
- ✓ Helix DSP structure matches real HX Edit exports: inputB/outputB/split/join on both DSPs, correct routing models — v4.0 Phase 1
- ✓ Footswitch assignments: all toggleable effects assigned to FS1-FS10 — v4.0 Phase 1
- ✓ Delay tempo sync: TempoSync1/SyncSelect1 parameters on all delay blocks, correct Time formula (60/BPM) — v4.0 Phase 1
- ✓ Per-snapshot amp Drive control: clean=0.30, crunch=0.50, lead=0.60, ambient=0.35 — v4.0 Phase 1
- ✓ Ambient snapshot sound design: boosted delay/reverb mix, longer decay for atmospheric sound — v4.0 Phase 1
- ✓ Pod Go snapshot controller = 11 (not 4), footswitch indices 1-6 (not 0-5) — v4.0 Phase 2
- ✓ Pod Go DSP always 10 blocks (block0-block9), padded with disabled empty blocks — v4.0 Phase 2
- ✓ Pod Go snapshots include all blocks including cabs, empty snapshots have full structure — v4.0 Phase 2
- ✓ HX Stomp structure matches real .hlx exports: inputB/outputB, split/join, correct I/O models — v4.0 Phase 3
- ✓ HX Stomp snapshot controller = 9 (distinct from Helix 19 and Pod Go 11) — v4.0 Phase 3
- ✓ HX Stomp footswitch indices 1-based (1-3 for Stomp, 1-5 for XL) — v4.0 Phase 3
- ✓ HX Stomp @pedalstate always 0 (not bitmask), empty snapshots have blocks structure — v4.0 Phase 3
- ✓ HX Stomp XL verified identical structure to Stomp — no XL-specific code paths needed — v4.0 Phase 4
- ✓ Stadium dual cab slots, sources bypass field, effect block footswitch controllers — v4.0 Phase 5
- ✓ Stadium device_version updated to 302056738 matching latest firmware references — v4.0 Phase 5
- ✓ Bass amp/cab models (19 amps, 8 cabs) with instrument tagging — v4.0 Phase 7
- ✓ ToneIntent instrument field ("guitar" | "bass") backward-compatible — v4.0 Phase 7
- ✓ Bass-aware chat prompts: instrument screening across all 4 device families — v4.0 Phase 7
- ✓ Bass-aware planner prompts: amp-cab pairings, gain staging, effect intelligence — v4.0 Phase 7
- ✓ Mock chat harness: 25 scenarios (5 families × 5 styles) exercising full pipeline without AI calls — v5.0 Phase 8
- ✓ Structural diff engine: deterministic deep JSON comparison across all 4 preset formats with categorized severity reports — v5.0 Phase 9
- ✓ Intent fidelity: instrument type check (bass amp + compression verification) — v5.0 Phase 10
- ✓ Musical intelligence: 5-rule genre/instrument validation engine (genre-effect, bass compression, gain staging, snapshot roles, effect count) — v5.0 Phase 10
- ✓ Reference corpus loader: reads .hlx/.pgp/.hsp preset files, detects device family, groups by family — v5.0 Phase 11
- ✓ Per-family gold standard schema extractor: analyzes structural consensus across reference presets (required/common/rare key classification) — v5.0 Phase 11
- ✓ Full audit orchestrator: runAudit() connects harness → diff → validation → per-family compliance reports — v5.0 Phase 12
- ✓ Structured audit reports: markdown + JSON formatters with deviation summaries, top issues, pass/fail per family — v5.0 Phase 12
- ✓ Stomp emits only device-max snapshots (3 for Stomp, 4 for XL) — no padding to 8 — v5.0 Phase 13
- ✓ Helix empty snapshots @valid:true matching real HX Edit exports — v5.0 Phase 13
- ✓ Non-MV amp Drive threshold 0.80 eliminates false positives in musical validation — v5.0 Phase 13
- ✓ Stadium diff compares inner {meta, preset} JSON, not HspFile wrapper — v5.0 Phase 13
- ✓ Regression suite: full audit pipeline (25 scenarios × 4 families) runs on every npm test — v5.0 Phase 14
- ✓ Pod Go default template blocks (Volume Pedal, Wah, FX Loop) always present matching Pod Go Edit — v5.0 Phase 15
- ✓ Pod Go output gain snapshot controller (@controller:11) for snapshot recall — v5.0 Phase 15
- ✓ Homescreen layout fix: logo visible, no right-column gap, footer cleared — v6.0 Phase 16
- ✓ Device picker visual polish: amber selected state, hover shadows — v6.0 Phase 16
- ✓ Planner prompt intelligence: effect combination rules, role assignment guide, snapshot role behavior, amp gain categorization — all 4 families — v6.0 Phase 17
- ✓ Per-role snapshot effect overrides: reverb Mix/DecayTime and delay Mix distinct per snapshot role (clean/crunch/lead/ambient) — v6.0 Phase 18
- ✓ Genre-modulated snapshot tuning: metal=tight, ambient/worship=lush, blues/jazz=warm — v6.0 Phase 18
- ✓ COMBO-05 drive+reverb combination adjustment: reduces reverb Mix by 0.03 when user drive present — v6.0 Phase 18
- ✓ Chat history windowing: planner bounded to 10 messages (first preserved), chat route to 20 — v6.0 Phase 19
- ✓ maxOutputTokens reduced 4096→2048 (ToneIntent JSON ~300-500 tokens, 4x safety margin) — v6.0 Phase 19
- ✓ Cost analysis tooling: scripts/analyze-usage.ts reads usage.jsonl with per-endpoint/device/cache breakdowns — v6.0 Phase 19

### Must Have
- [To be defined during planning]

### Should Have
- [To be defined during planning]

### Nice to Have
- [To be defined during planning]

## Key Decisions

| Decision | Phase | Rationale |
|----------|-------|-----------|
| Pre-cab blocks on DSP0, post-cab on DSP1 | Phase 2 | Proper dual-DSP routing for Helix devices |
| COMBO-01 compressor keys correct as-is | Phase 2 | Threshold/Sensitivity/PeakReduction match actual models |
| Ambient mix boost is layered design, not double-apply | Phase 2 | param-engine base + snapshot-engine boost = correct |
| CRIT-15 Pod Go block key mapping is correct | Phase 3 | dspIdx counts cabs, snapshotIdx skips — intentional offset |
| Lead gain 2.5→2.0 dB | Phase 3 | Prevent clipping with ChVol 0.80 |
| Switch planner to Gemini 3 Flash | Phase 4 | 100% schema compliance, 86% quality, 8x cheaper than Claude Sonnet. Newer gen for longevity. |
| Consolidate to single Gemini SDK | Phase 4 | Chat already Gemini; planner switching too. Claude retained only for vision. |
| Remove @anthropic-ai/sdk entirely | v2.0 Phase 1 | Vision migrated to Gemini; single SDK, single API key (GEMINI_API_KEY) |
| Upgrade MODEL_STANDARD to gemini-3-flash-preview | v2.0 Phase 1 | User-directed; affects all callers (planner, vision, chat) globally |
| Manual JSON schema for Gemini planner | v1.1 Phase 1 | Used buildGeminiJsonSchema() instead of zod-to-json-schema — avoids dependency and Gemini $ref incompatibility |
| Per-family effect prompt parameterization via DeviceFamily switch | v2.0 Phase 2 | Each family gets structurally different effect guidance matching hardware constraints |
| Keep two-context chat→planner architecture | v2.0 Phase 3 | Chat uses Google Search (incompatible with structured output), separation of concerns works well, full conversation history passed to planner (not lossy), unified would bloat system prompt |
| Helix Native device ID 2162690 UNVERIFIED | Phase 5 | Estimated from Line 6 sequence — confirm from real .hlx export |
| Native maps to helix family, no Variax | Phase 5 | Same DSP/catalog as Floor; no VDI jack (DAW plugin) |
| v1.0 quality gate: all 10 targets pipeline-tested | Phase 6 | Pod Go, Stadium, Native, Rack — all pass full pipeline + quality validation |
| --hlx-text-muted lightened #524840 → #8a7b6e | v2.0 Phase 5 | WCAG AA contrast compliance (~4.5:1 on --hlx-surface) |
| DevicePicker uses radiogroup/radio semantics | v2.0 Phase 5 | Single-choice selection, not tabs — aria-checked for state |
| "Golden preset" methodology: reverse-engineer from real exports | v4.0 Phase 1 | Match exact structural patterns from HX Edit, not approximate |
| Split/join always present on both DSPs regardless of dual-amp | v4.0 Phase 1 | Real exports always include split/join — consistency |
| TempoSync1=true when BPM present, false otherwise | v4.0 Phase 1 | Matches real preset behavior — hardware handles sync when tempo known |
| Amp Drive as snapshot controller (@controller=19) | v4.0 Phase 1 | HX Edit convention for snapshot-controlled amp parameters |
| Pod Go snapshot controller = 11 | v4.0 Phase 2 | Confirmed from all 5 reference .pgp presets |
| Pod Go @pedalstate always 2 | v4.0 Phase 2 | All reference presets use 2 regardless of block states |
| Pod Go FS indices 1-6 | v4.0 Phase 2 | Real .pgp exports use @fs_index 1-6 (not 0-5) |
| HX Stomp snapshot controller = 9 | v4.0 Phase 3 | Confirmed from CATS NO OTO4.hlx reference — distinct from Helix (19) and Pod Go (11) |
| HX Stomp @pedalstate always 0 | v4.0 Phase 3 | All 5 reference presets show 0 for every snapshot |
| HX Stomp uses shared getBlockTypeForDevice | v4.0 Phase 3 | Consistent block type resolution, fixes modulation @type (0→4) |
| Stadium cab blocks always 2 slots (cab + NoCab) | v4.0 Phase 5 | All 4 reference .hsp presets show dual cab slots |
| Stadium sources include bypass: false field | v4.0 Phase 5 | All reference presets have this on every source entry |
| Stadium fx blocks get @enabled.controller (targetbypass) | v4.0 Phase 5 | Footswitch controller on effects, not on amp/cab |
| Stadium device_version → 302056738 | v4.0 Phase 5 | NH reference presets show newer firmware version |
| ToneIntent instrument .optional() not .default("guitar") | v4.0 Phase 7 | Zod .default() output type is required, breaking test fixtures |
| Stadium bass: no bass-specific amps (Agoura catalog) | v4.0 Phase 7 | Bass players advised to use Helix/Stomp for dedicated bass amps |
| Compression non-negotiable for bass | v4.0 Phase 7 | Priority 1 in all family bass effect tables |
| HarnessResult.intentAudit uses IntentAudit type directly | v5.0 Phase 8 | Matches auditIntentFidelity return type — not simplified shape |
| Bass amp detection via AMP_MODELS.instrument field | v5.0 Phase 10 | Authoritative source, not name heuristics |
| Genre categorization via explicit keyword lookup | v5.0 Phase 10 | Deterministic, unknown genres skip genre rules safely |
| Supplementary device ID map for corpus (2162944 Native, 2162696 Pod Go Wireless) | v5.0 Phase 11 | DEVICE_IDS has unverified entries; real presets use confirmed IDs |
| Key frequency consensus: required=100%, common=>50%, rare=<=50% | v5.0 Phase 11 | Standard consensus — "required" means present in every correct preset |
| Path generalization (dsp0→dsp*, block3→block*) for schema extraction | v5.0 Phase 11 | Different presets have different block counts — generalizing allows structural consensus |
| Pod Go template blocks at builder level only (not chain-rules) | v5.0 Phase 15 | Template blocks are Pod Go Edit defaults, not part of tone intent |
| Pod Go user blocks fill positions [2,3,5,6,7,8,9] | v5.0 Phase 15 | Positions [0,1,4] reserved for Volume Pedal, Wah, FX Loop |
| Container max-w-5xl→max-w-4xl for welcome+chat | v6.0 Phase 16 | Eliminates right-column gap on wide screens |
| Logo 280→240px | v6.0 Phase 16 | Fits viewport without crop while remaining prominent |
| Skip local-verify checkpoints (user doesn't run dev) | v6.0 Phase 16 | Trust build+tests; verify on deploy |
| Effect combination rules are advisory prompt text, not code-enforced | v6.0 Phase 17 | Prompt guidance steers planner; builder doesn't validate combinations |
| Snapshot role table identical across families | v6.0 Phase 17 | Knowledge Layer behavior is shared; planner just picks the right toneRole |
| Stadium amp gain categorization uses Agoura model names | v6.0 Phase 17 | Stadium has its own amp catalog, not HD2 |
| Role delta tables replace hardcoded AMBIENT_* constants | v6.0 Phase 18 | Unified per-role overrides; ambient values preserved exactly |
| Genre modifier uses substring matching | v6.0 Phase 18 | Handles compound genres like "heavy metal", "ambient electronic" |
| COMBO-05 excludes mandatory boost slot | v6.0 Phase 18 | Only user-selected drives trigger reverb reduction |
| MAX_PLANNER_MESSAGES=10, first message preserved | v6.0 Phase 19 | Initial user request captures tone intent — dropping it loses context |
| maxOutputTokens 4096→2048 | v6.0 Phase 19 | ToneIntent JSON ~300-500 tokens; 2048 gives 4x safety margin |
| MAX_CHAT_HISTORY=20, system prompt unaffected | v6.0 Phase 19 | Bounds input tokens on long chat sessions |

## Constraints
- [To be identified during planning]

## Success Criteria
- Professional-quality presets tailored to user rig and tone preferences
- [To be refined during planning]

## Specialized Flows

See: .paul/SPECIAL-FLOWS.md

Quick Reference:
- /ui-ux-pro-max → Frontend / UI / UX (required)

---
*Last updated: 2026-03-09 after v6.0 Phase 19*
