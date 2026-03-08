---
phase: 02-device-specific-preset-intelligence
plan: 01
subsystem: ai-prompts
tags: [effect-intelligence, device-family, prompt-engineering, line6]

# Dependency graph
requires:
  - phase: 01-gemini-unification-architecture
    provides: Gemini-based planner with per-family prompt routing
provides:
  - Per-family effect model intelligence (genreEffectModelSection parameterized by DeviceFamily)
  - Helix dual-DSP layering guidance
  - Stomp priority-based effect selection
  - Pod Go 4-slot templates
  - Stadium arena/FOH effect context
affects: [phase-03 chat intelligence, future amp-cab per-family work]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-family prompt parameterization via DeviceFamily switch]

key-files:
  modified:
    - src/lib/families/shared/effect-model-intelligence.ts
    - src/lib/families/shared/effect-model-intelligence.test.ts
    - src/lib/families/helix/prompt.ts
    - src/lib/families/helix/prompt.test.ts
    - src/lib/families/stomp/prompt.ts
    - src/lib/families/stomp/prompt.test.ts
    - src/lib/families/podgo/prompt.ts
    - src/lib/families/podgo/prompt.test.ts
    - src/lib/families/stadium/prompt.ts
    - src/lib/families/stadium/prompt.test.ts

key-decisions:
  - "Keep backward-compatible default parameter (family='helix') so missed callers still work"
  - "Stomp uses priority column instead of Avoid column — every unused effect is implicitly avoided"
  - "Pod Go uses template-based format (4-slot grids) instead of recommendation tables"
  - "Stadium replaces Avoid column with Arena Caution for FOH-specific warnings"

patterns-established:
  - "Per-family prompt parameterization via switch on DeviceFamily type"
  - "Each family variant contains same core model names but different structure/context"

# Metrics
duration: ~45min
completed: 2026-03-08
---

# Phase 2 Plan 01: Per-Family Effect Model Intelligence Summary

**Replaced generic shared effect intelligence with four device-specific variants — Helix (dual-DSP layering), Stomp (priority-based budgeting), Pod Go (4-slot templates), Stadium (arena/FOH context).**

## Performance

| Metric | Value |
|--------|-------|
| Completed | 2026-03-08 |
| Tasks | 3 completed (2 auto + 1 human-verify checkpoint) |
| Files modified | 10 |
| Lines changed | +396 / -36 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Family-Parameterized Effect Intelligence | Pass | `genreEffectModelSection(family)` accepts DeviceFamily, returns distinct content per family |
| AC-2: Helix Exploits Dual-DSP | Pass | Contains "dual-DSP", "DSP1", "Layering Opportunities" section |
| AC-3: Stomp Respects 4-Effect Budget | Pass | Priority column, budget guidance, drop order |
| AC-4: Pod Go Fills All 4 Slots | Pass | 4-Slot Templates table, "Choose ALL 4" enforcement |
| AC-5: Stadium Uses Arena Context | Pass | "Arena Caution" column, FOH translation tips, headroom mentions |
| AC-6: All Callers Updated and Tests Pass | Pass | All 4 prompt files pass family param; 124 tests pass; tsc clean |

## Accomplishments

- `genreEffectModelSection()` expanded from 56 lines (shared) to ~240 lines across 4 family-specific variants
- Each family gets structurally different guidance: Helix has Avoid+Layering, Stomp has Priority, Pod Go has slot templates, Stadium has Arena Caution
- All 4 prompt files updated to pass their family identifier
- 124 tests pass across 5 test files with new per-family variant tests

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/families/shared/effect-model-intelligence.ts` | Modified | Added 4 family-specific functions behind DeviceFamily switch |
| `src/lib/families/shared/effect-model-intelligence.test.ts` | Modified | Added per-family variant tests (distinct output, family-specific content) |
| `src/lib/families/helix/prompt.ts` | Modified | Pass `"helix"` to genreEffectModelSection |
| `src/lib/families/helix/prompt.test.ts` | Modified | Verify dual-DSP and layering content |
| `src/lib/families/stomp/prompt.ts` | Modified | Pass `"stomp"` to genreEffectModelSection |
| `src/lib/families/stomp/prompt.test.ts` | Modified | Verify priority column and budget guidance |
| `src/lib/families/podgo/prompt.ts` | Modified | Pass `"podgo"` to genreEffectModelSection |
| `src/lib/families/podgo/prompt.test.ts` | Modified | Verify 4-slot templates |
| `src/lib/families/stadium/prompt.ts` | Modified | Pass `"stadium"` to genreEffectModelSection |
| `src/lib/families/stadium/prompt.test.ts` | Modified | Verify arena/FOH context |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Default param `"helix"` for backward compat | Any callers not yet updated still get helix variant | Safe migration path |
| Stomp drops "Avoid" column | With 3-4 slots, everything not chosen is implicitly avoided | Cleaner, more actionable guidance |
| Pod Go uses grid templates | Exactly 4 effects per genre fits the device's mental model | Users see exactly what to configure |
| Stadium uses "Arena Caution" instead of "Avoid" | FOH-specific warnings more useful than generic avoids | Better arena preset quality |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Skill Audit

No required skills applicable — this phase is backend prompt engineering with no UI changes. `/ui-ux-pro-max` not required.

## Next Phase Readiness

**Ready:**
- Per-family effect intelligence complete and tested
- Pattern established for future per-family prompt parameterization
- All families produce distinct, device-appropriate guidance

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 02-device-specific-preset-intelligence, Plan: 01*
*Completed: 2026-03-08*
