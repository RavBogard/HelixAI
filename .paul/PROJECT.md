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
*Last updated: 2026-03-08 after v2.0 Phase 3*
