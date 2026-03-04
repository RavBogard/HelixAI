# Project Research Summary

**Project:** HelixAI v3.0 Helix Stadium Support
**Domain:** Adding Helix Stadium as a supported preset generation target; fixing Helix Floor device ID regression
**Researched:** 2026-03-04

---

## What We Know (High Confidence)

### .hsp File Format
- Helix Stadium uses `.hsp` (not `.hlx`) — confirmed by official Line 6 docs and Helix community
- File size range: 15-47 KB — consistent with JSON encoding
- Format is likely JSON but MUST be confirmed by opening a real `.hsp` export before writing builder code
- If msgpack encoding confirmed: add `@msgpack/msgpack ^3.0.0`; otherwise no new dependencies
- One-way migration: Helix presets can export to Stadium format, but not reverse

### Hardware Specs (FW v1.2.1, released Jan 20, 2026)
- 4 stereo paths: 1A, 1B, 2A, 2B
- 12 blocks per path maximum (vs 8/DSP for Helix LT/Floor)
- 8 snapshots per preset (vs 4 on LT/Floor)
- Agoura engine amps (`Agoura_*` prefix) — ~50 channels
- Legacy HX effects available — verify prefix (`HD2_*` vs `HX2_*`) from real `.hsp`

### Model Catalog Changes
- New: Agoura amp models (`Agoura_*` prefix) — exclusive to Stadium
- Removed from Stadium: Simple EQ, Low/High Cut EQ, Low/High Shelf EQ, Parametric 5-band
- New Stadium EQ: 7-band Parametric EQ (Stadium-exclusive replacement)
- HD2 legacy effects may or may not be available — verify from real export

### Device ID
- `data.device` integer is UNKNOWN — must be extracted from a real `.hsp` file
- Wrong device ID causes `-8309 Incompatible target device type` hardware rejection
- Never guess; never copy from LT/Floor/Pod Go
- Protocol: `xxd file.hsp | head -20` to check encoding; inspect `data.device` field

### Helix Floor Regression (Live Bug)
- `DEVICE_IDS.helix_floor = 2162692` in `types.ts` (same as LT — wrong)
- `orchestration.test.ts:93` expects `2162691` — this is the correct value from Phase 23 research
- Phase 23 fixed Floor from `2162688` → `2162691`; a later change incorrectly set it to `2162692`
- Fix is Phase 31 priority — must be resolved before adding a third device target

---

## Architecture Impact (Medium-High Confidence)

### New File
- `src/lib/helix/stadium-builder.ts` — follows `podgo-builder.ts` pattern exactly
- Accepts `PresetSpec` (device-agnostic, no type changes needed)
- Exports `buildHspFile(spec: PresetSpec): HspFile` + `summarizeStadiumPreset()`

### Files That Change
- `types.ts` — `DeviceTarget` union + `DEVICE_IDS.helix_stadium` + Stadium constants
- `config.ts` — `STADIUM_MAX_BLOCKS_PER_PATH = 12`, `STADIUM_MAX_SNAPSHOTS = 8`
- `models.ts` — Stadium model catalog (Agoura amps, Stadium effects, Stadium EQ)
- `chain-rules.ts` — `assembleSignalChain()` Stadium branch + `STADIUM_MAX_BLOCKS_PER_PATH` constant
- `validate.ts` — Stadium-specific validation logic
- `index.ts` — barrel export for `stadium-builder.ts`
- `planner.ts` — Stadium planner prompt with Stadium-only model IDs
- `generate/route.ts` — `buildHspFile()` routing + `latest.hsp` storage key
- `page.tsx` — device selector (2 arrays), download handler, badge, continuation chips

### Files That Must NOT Change
- `preset-builder.ts` — Helix LT/Floor builder, untouched
- `podgo-builder.ts` — Pod Go builder, untouched
- `param-engine.ts` — device-agnostic, untouched
- `tone-intent.ts` — device-agnostic, untouched

### TypeScript Exhaustiveness Pattern
Adding `"helix_stadium"` to `DeviceTarget` will surface compiler errors at every unhandled switch/if-else — these errors become the Phase 32-38 integration checklist. Do not suppress them; work through them in order.

### Supabase Storage Key
Stadium presets stored at `presets/{user_id}/{conversation_id}/latest.hsp` (not `.hlx`)

---

## Key Pitfalls

1. **Format assumption** — DO NOT assume `.hsp` is JSON. Inspect a real file with `xxd` first.
2. **Device ID -8309** — Hardware rejects presets with wrong `data.device`. Must read from real file.
3. **Helix Floor regression is live** — Fix FIX-01 (Floor ID) before touching Stadium code.
4. **Model prefix verification** — `Agoura_*` for amps confirmed; `HD2_*` vs `HX2_*` for effects unconfirmed.
5. **Different block limit constant** — Use `STADIUM_MAX_BLOCKS_PER_PATH`, not `MAX_BLOCKS_PER_DSP`.
6. **EQ deprecations** — Stadium removed 4 EQ types; mandatory EQ block must use Stadium's 7-band Parametric.
7. **Two device arrays in page.tsx** — Both must be updated (around lines 1275-1277 and 1365-1367).

---

## Build Order (8 Phases)

```
Phase 31: Device ID Research + Floor Fix
  → Inspect real .hsp, document data.device, fix types.ts helix_floor

Phase 32: Type System Foundation
  → DeviceTarget union, DEVICE_IDS.helix_stadium, config constants
  → Compiler exhaustiveness errors surface all unimplemented handlers

Phase 33: Stadium Model Catalog
  → Agoura amps, Stadium effects, Stadium 7-band EQ
  → Device-filtered getModelsForDevice()

Phase 34: Stadium Chain Rules + Validation
  → assembleSignalChain() Stadium branch
  → validatePresetSpec() Stadium checks

Phase 35: Stadium Builder
  → stadium-builder.ts (new file)
  → buildHspFile(), summarizeStadiumPreset()
  → Hardware import test

Phase 36: Planner + API Route Integration
  → planner.ts Stadium prompt
  → /api/generate Stadium routing + latest.hsp storage

Phase 37: UI — Device Selector + Download
  → page.tsx device arrays, download handler, badge

Phase 38: Rig Emulation for Stadium
  → mapRigToSubstitutions() Stadium support
  → /api/map Stadium routing
```

---

## Scope (v3.0)

**In scope:**
- Helix Stadium preset generation (single-path, Path 1A only)
- Helix Stadium model catalog
- Helix Stadium chain rules and validation
- Stadium builder (`stadium-builder.ts`)
- Generate API route Stadium support
- Device selector UI with STADIUM option
- Rig emulation for Stadium
- Helix Floor device ID regression fix

**Out of scope:**
- Multi-path/dual-amp Stadium presets (defer to v3.1+)
- HX Stomp (remains out of scope project-wide)
- Sidebar/conversation enhancements (shipped in v2.0)

---

*Research synthesized: 2026-03-04*
*Sources: STACK.md, ARCHITECTURE.md, PITFALLS.md (all v3.0, written 2026-03-04)*
