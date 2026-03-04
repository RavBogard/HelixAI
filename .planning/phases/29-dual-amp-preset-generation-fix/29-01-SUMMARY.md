---
phase: 29-dual-amp-preset-generation-fix
plan: 01
subsystem: ai-contract
tags: [zod, schema, claude-planner, gemini, dual-amp]

requires:
  - phase: 28-sidebar-nav-ux
    provides: "Stable UI foundation — no dependencies on AI contract layer"
provides:
  - "ToneIntentSchema with optional secondAmpName/secondCabName fields"
  - "Planner prompt documenting dual-amp fields with DSP budget and Pod Go guard"
  - "Gemini system prompt with accurate dual-amp capability description"
affects: [chain-rules, param-engine, snapshot-engine, preset-builder]

tech-stack:
  added: []
  patterns: ["Zod .refine() for cross-field validation on ToneIntentSchema"]

key-files:
  created: []
  modified:
    - "src/lib/helix/tone-intent.ts"
    - "src/lib/planner.ts"
    - "src/lib/gemini.ts"

key-decisions:
  - "Used Zod .refine() for secondCabName requirement — schema-level enforcement"
  - "Pod Go guard uses template literal conditional in prompt string"
  - "Replaced single Gemini line with two lines for Helix dual-amp and Pod Go limitation"

patterns-established:
  - "Optional dual-amp fields: secondAmpName/secondCabName always paired via refine()"
  - "Device-conditional prompt sections using isPodGo() check"

requirements-completed: [DUAL-01, DUAL-02, DUAL-07, DUAL-08]

duration: 5min
completed: 2026-03-03
---

# Plan 29-01: AI Contract Layer Summary

**Optional secondAmpName/secondCabName fields in ToneIntentSchema with Planner dual-amp docs and Gemini capability description**

## Performance

- **Duration:** 5 min
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- ToneIntentSchema extended with optional secondAmpName and secondCabName fields, validated by Zod refine rule
- Planner prompt documents dual-amp field conventions, DSP budget constraints, and Pod Go device restriction
- Gemini system prompt accurately describes Helix dual-amp support and Pod Go single-amp limitation

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ToneIntentSchema** - `309c14e` (feat)
2. **Task 2: Update Planner prompt** - `89aaa56` (feat)
3. **Task 3: Update Gemini prompt** - `03137d7` (feat)

## Files Created/Modified
- `src/lib/helix/tone-intent.ts` - Added optional secondAmpName/secondCabName with refine validation
- `src/lib/planner.ts` - Added dual-amp field docs, DSP budget rules, Pod Go device restriction
- `src/lib/gemini.ts` - Replaced amp switching line with dual-amp Helix support and Pod Go limitation

## Decisions Made
- Used Zod .refine() rather than .superRefine() for simpler cross-field validation
- Pod Go guard is a template literal conditional rather than a separate function call
- Gemini prompt split into two separate bullet points for clarity

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## Next Phase Readiness
- Schema contract ready for Knowledge Layer consumption in Plan 02
- secondAmpName/secondCabName fields are optional — single-amp presets unaffected

---
*Phase: 29-dual-amp-preset-generation-fix*
*Completed: 2026-03-03*
