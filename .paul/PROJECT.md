# Project: helixtones.com

## Description
An AI-powered preset builder for Line 6 products. Supports Helix Floor/Rack/LT/Native (Native support TBD), Stadium and Stadium XL, HX Stomp and Stomp XL, and Pod Go. It understands each device family's hardware specs, limitations, and capabilities, then builds professional-quality presets with appropriate snapshots, stomps, and signal chains. Uses AI to interview users about their existing guitar/bass rig and desired tone, then generates downloadable presets that compete with professional presets for sale.

## Core Value
Guitarists and bassists can get professional-quality, device-specific Line 6 presets tailored to their exact rig and tonal preferences — without deep technical knowledge of their hardware.

## Requirements

### Validated
- ✓ Correct signal chain ordering (Horizon Gate post-cab) — Phase 2
- ✓ Correct gain staging defaults (Scream 808, non-MV amps, high-gain Drive) — Phase 2
- ✓ Correct volume balancing (ambient ChVol, reverb floor) — Phase 2

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
*Last updated: 2026-03-08 after Phase 2*
