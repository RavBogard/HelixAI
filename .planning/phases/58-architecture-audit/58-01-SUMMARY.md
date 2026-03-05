---
phase: 58-architecture-audit
plan: "01"
subsystem: planning-docs
tags: [architecture, audit, documentation, device-abstraction, refactor-decision]

# Dependency graph
requires:
  - phase: 52-stadium-amp-catalog
    provides: STADIUM_AMPS catalog verified from real .hsp files
  - phase: 53-stadium-builder-rebuild
    provides: 5 format bugs fixed — Stadium rebuild discoveries documented in audit
  - phase: 54-stadium-device-unblock
  - phase: 55-planner-prompt-enrichment
  - phase: 56-per-model-amp-overrides
  - phase: 57-effect-parameter-intelligence
provides:
  - architecture-audit-v4.md: Complete device/model abstraction audit for v4.0 covering all 6 devices
  - PROJECT.md Key Decisions: Architecture refactor DEFERRED decision with rationale
affects:
  - Future maintenance phases: Improvements A/B (Stadium I/O constants, hardcoded model IDs)
  - Future device phases: Improvement D (capability registry) when 7th device is planned

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Architecture audit pattern: direct source inspection -> 6-section Markdown document with file/line citations"

key-files:
  created:
    - .planning/architecture-audit-v4.md
  modified:
    - .planning/PROJECT.md

key-decisions:
  - "[v4.0] Architecture refactor DEFERRED — guard-based branching functional at 6 devices; low-effort improvements A/B deferred to maintenance phase; capability registry (Improvement D) deferred until 7th device is planned"
  - "Improvement A (HIGH priority): Move Stadium I/O model IDs from string literals to STADIUM_CONFIG constants — ~30min, zero risk"
  - "Improvement B (MEDIUM priority): Replace hardcoded distortion model IDs in param-engine.ts with constant references — ~15min, zero risk"

requirements-completed: [ARCH-01]

# Metrics
duration: 3min
completed: 2026-03-05
tasks_completed: 2
files_modified: 2
---

# Phase 58 Plan 01: Architecture Audit v4.0 Summary

**One-liner:** Complete v4.0 device/model abstraction audit documenting 6 architectural strengths, 5 fragility points with exact file/line citations, Phase 52-53 Stadium rebuild discoveries, a concrete improvements table, and an explicit DEFER decision for structural refactor.

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-05T20:12:30Z
- **Completed:** 2026-03-05T20:15:36Z
- **Tasks:** 2
- **Files created/modified:** 2

## Accomplishments

- Created `.planning/architecture-audit-v4.md` — 269-line audit document with all 6 required sections based on direct inspection of 12 source files (`types.ts`, `config.ts`, `chain-rules.ts`, `param-engine.ts`, `validate.ts`, `models.ts`, `stadium-builder.ts`, `stomp-builder.ts`, `preset-builder.ts`, `podgo-builder.ts`, `snapshot-engine.ts`, `index.ts`) and Phase 52-53 Summary files
- Documented 6 strengths (DeviceTarget union, self-contained builders, strict catalog lookup, HelixModel interface, config grouping, STOMP I/O constants already promoted)
- Documented 5 fragility points with exact file/line references — confirmed current state of each (Phase 53 flowPos fix noted; Stomp I/O constants already in STOMP_CONFIG; Stadium I/O still hardcoded)
- Concrete improvements table: 4 entries (A: Stadium I/O constants, B: hardcoded model IDs, C: STADIUM_AMPS to MODEL_LOOKUPS, D: capability registry — deferred)
- Documented Phase 52-53 Stadium Rebuild Discoveries: 5 confirmed format bugs, all fixed; root cause analysis (implementation-by-analogy rather than corpus inspection); HX Edit verification checkpoint pending as of audit date
- Explicit refactor decision: DEFER — with 5-point rationale
- Updated `.planning/PROJECT.md`: added [v4.0] Architecture refactor: DEFERRED row to Key Decisions table; marked architecture review requirement `[x]` complete

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the architecture audit document** - `d570290` (docs)
2. **Task 2: Record refactor decision in PROJECT.md Key Decisions** - `5e4a3b2` (docs)

## Files Created/Modified

- `.planning/architecture-audit-v4.md` — CREATED (269 lines, 7 sections including open questions)
- `.planning/PROJECT.md` — MODIFIED: architecture review checkbox `[ ]` → `[x]`; new row added to Key Decisions table; updated footer timestamp

## Decisions Made

1. **Architecture refactor DEFERRED:** Guard-based branching is transparent, searchable, and well-tested at 6 devices. No production bugs have been traced to missed guard sites. The Stadium rebuild (Phases 52-53) required device-guarded additions to the Knowledge Layer — a structural refactor during functional work multiplies regression risk. User-visible value is zero. Revisit when 7th device is planned or when developer velocity on Knowledge Layer changes degrades.

2. **Key Decisions format preserved as table:** PROJECT.md uses a 3-column table (`Decision | Rationale | Outcome`) for Key Decisions. The new entry was added as a table row matching the existing format, rather than using a separate `### Key Decisions` heading with bullets as the plan template suggested. Existing document structure takes precedence.

3. **Strength 6 added (STOMP I/O constants already promoted):** During source inspection, `config.ts` lines 71-76 show `STOMP_INPUT_MODEL`, `STOMP_OUTPUT_MAIN_MODEL`, `STOMP_OUTPUT_SEND_MODEL` are already named constants in `STOMP_CONFIG`. This was not in the research document. Documenting this as an additional strength (#6) strengthens the audit by confirming the correct pattern already exists for one device family — it sharpens the case for Improvement A (Stadium should match Stomp's approach).

## Deviations from Plan

### Auto-fixed Issues

None.

### Additional Work

**[Added Strength 6]** During direct source inspection of `config.ts`, discovered that HX Stomp I/O model IDs are already promoted to named constants (`STOMP_INPUT_MODEL`, `STOMP_OUTPUT_MAIN_MODEL`, `STOMP_OUTPUT_SEND_MODEL` in `STOMP_CONFIG`, lines 71-76). The research document did not call this out explicitly as a strength. Added it as Strength 6 because it directly strengthens the case for Improvement A (Stadium should follow the same pattern) and demonstrates the architecture already has the right pattern for one device family.

## Self-Check: PASSED

- FOUND: `.planning/architecture-audit-v4.md`
- FOUND: `.planning/PROJECT.md` (modified)
- FOUND: commit d570290 (docs(58-01): write v4.0 architecture audit document)
- FOUND: commit 5e4a3b2 (docs(58-01): record architecture refactor decision in PROJECT.md)
- FOUND: "Architecture refactor: DEFERRED" in PROJECT.md
- FOUND: "architecture-audit-v4.md" in PROJECT.md
- FOUND: "[x] Architecture review" in PROJECT.md
- FOUND: All 6 sections (Audit Scope, What Works Well, Fragility Points, Concrete Improvements, Stadium Rebuild Discoveries, Refactor Decision) in architecture-audit-v4.md
- VERIFIED: Section keyword count = 13 (requirement: ≥5)
