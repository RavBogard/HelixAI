# Phase 4: Orchestration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the full generation pipeline end-to-end so that a tone request produces a downloadable .hlx file. Harden the validator to fail fast on structural errors instead of silently auto-correcting. Ensure snapshot block state keys are rebuilt programmatically from the final signal chain. Support both Helix LT and Helix Floor device targets.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 4 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **End-to-end pipeline wiring** -- The generate route already calls Planner -> Knowledge Layer (Phase 3). Phase 4 ensures the output is a properly downloadable .hlx file with correct headers/structure. The existing `buildHlxFile()` from Phase 1 should handle most of this, but verify it produces hardware-loadable output.
- **Device ID handling** -- Helix LT and Helix Floor use the same .hlx format but different device IDs. Add device target support so the correct ID is embedded in the output file.
- **Fail-fast validation** -- Replace silent auto-correction with clear error responses. If a PresetSpec has a structural error (missing required field, out-of-range parameter), the generation route should return an error, not a silently corrected file.
- **Snapshot block state key rebuilding** -- Block state keys in snapshots must be rebuilt programmatically from the final signal chain after validation. Never trust AI-generated or stale block keys.
- **Validator hardening** -- The existing `validateAndFixPresetSpec()` was removed in Phase 3. Phase 4 should add strict validation that throws on errors rather than fixing them.

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- follow the architecture documented in `.planning/research/ARCHITECTURE.md` and build on the existing Phase 1-3 code.

</specifics>

<code_context>
## Existing Code Insights

### Phase 1-3 Foundation (completed)
- `src/lib/helix/preset-builder.ts`: `buildHlxFile(spec: PresetSpec)` -> HlxFile JSON
- `src/lib/helix/validate.ts`: `validateAndFixPresetSpec()` -- currently auto-corrects, needs hardening
- `src/lib/helix/types.ts`: PresetSpec, BlockSpec, SnapshotSpec, HlxFile types
- `src/app/api/generate/route.ts`: Planner -> Knowledge Layer pipeline (Phase 3)
- `src/lib/planner.ts`: `callClaudePlanner()` with structured output

### Integration Points
- Generate route returns `{ preset, summary, spec, toneIntent }` -- preset is the HlxFile object
- Frontend needs to download the preset as a .hlx file (deferred details to Phase 5)
- Device ID needs to be passed from frontend to generate route

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 04-orchestration*
*Context gathered: 2026-03-02*
