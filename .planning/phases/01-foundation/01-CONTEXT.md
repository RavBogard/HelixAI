# Phase 1: Foundation - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the type contracts, verified @type block constants, expanded model database with amp category metadata, and parameter type registry that all downstream components (Knowledge Layer, AI Integration, Orchestration) depend on.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 1 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **@type verification approach** — Use community .hlx exports, GitHub repos (AntonyCorbett/HelixBackupFiles), and reverse-engineering references to verify block type constants. If discrepancies found, correct them.
- **Amp model coverage** — Start with the most-used 20-30 amps across clean/crunch/high-gain, then expand. Use FW 3.70 as baseline (current codebase already targets this). Add amp category metadata, cab affinities, and topology tags to each model.
- **Amp category design** — Use clean/crunch/high-gain as primary categories. Edge cases (AC30, Soldano) get categorized by their most common use case. Add topology tag (cathode-follower vs plate-fed) as a secondary attribute for EQ strategy decisions.
- **ToneIntent shape** — Keep it narrow (~15 fields). AI chooses: amp model name, cab model name, effects list (name + role), snapshot intents (name + tone role), guitar type, genre hint. Knowledge Layer handles all numeric parameters.
- **Parameter type registry** — Implement a type-safe registry distinguishing Hz values (LowCut/HighCut), integer indices (Mic), and normalized floats (Drive/Master/etc). Make LowCut and HighCut required on cab types.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User wants world-class preset quality and trusts the research-backed approach documented in `.planning/research/`.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/helix/types.ts`: Existing HlxFile, PresetSpec, BlockSpec, SnapshotSpec types — will be expanded, not replaced
- `src/lib/helix/models.ts`: 842-line model database with HelixModel interface, AMP_MODELS, CAB_MODELS, EFFECT_MODELS — will be expanded with category metadata
- `src/lib/helix/validate.ts`: Validation pipeline with auto-correction — will be hardened in Phase 4
- `src/lib/helix/index.ts`: Barrel exports — will export new types and utilities

### Established Patterns
- HelixModel interface: `{ id, name, basedOn, category, defaultParams, blockType }` — extend with topology, cabAffinity fields
- BLOCK_TYPES constant: `{ DISTORTION: 0, AMP: 1, CAB: 2, ... }` — verify and potentially fix values
- UPPER_SNAKE_CASE for constants, PascalCase for interfaces, camelCase for properties
- `@/*` path aliases for imports

### Integration Points
- `models.ts` exports feed into `validate.ts` (VALID_IDS set) and will feed into new `param-engine.ts` (Phase 2)
- `types.ts` PresetSpec/BlockSpec define the contract between AI output and preset builder — ToneIntent will be a new, narrower type alongside these
- `HlxCab` interface has optional LowCut/HighCut — these become required fields

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-01*
