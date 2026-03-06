# Phase 62: Catalog Isolation - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Each device family has its own amp and effect catalog module containing only the models valid for that family. The global merged AMP_NAMES enum that allows cross-family model selection is eliminated. Per-family ToneIntent Zod schemas constrain Claude's constrained decoding to only family-appropriate models.

</domain>

<decisions>
## Implementation Decisions

### Catalog Module Structure (Claude decides)
- Claude picks the file/directory structure for per-family catalogs
- Claude decides whether data moves to family files or stays in models.ts with filtered re-exports
- Claude decides what happens to getModelListForPrompt() (move to family catalogs or leave for Phase 65)
- Claude decides getAllModels() strategy (union or per-family)
- Constraints: Must follow existing project conventions (lowercase-with-hyphens filenames, co-located tests, @/ imports)

### All Four Families Get Fully Independent Catalogs
- Every family (helix, stomp, podgo, stadium) gets its own complete catalog for ALL model categories: amps, effects, cabs, EQ
- No shared base catalog — each family owns its complete model set
- No exclusion lists — instead of "all models minus 3", Pod Go catalog simply doesn't contain the 3 excluded models
- Rationale: Stadium is the actively-developed product. It will receive new Agoura amps, effects, and potentially new cabs in future firmware updates. HD2 families (Helix, Stomp, Pod Go) are effectively frozen products that won't get new models. Full independence means Stadium catalogs grow without touching HD2 code.
- Duplication of HD2 data across helix/stomp/podgo catalogs is acceptable — it doesn't affect token usage (planner prompt already filters by device, Zod enum doesn't go in prompt)

### Effect Catalog Scoping
- Each family gets its own independent effect catalog (distortion, delay, reverb, modulation, dynamics, wah, volume, EQ)
- Pod Go effects: HD2 models minus 3 excluded, with Mono/Stereo ID suffix mapping built into its catalog
- Stadium effects: HD2-compatible effects plus Stadium-specific EQ models, minus 3 removed EQs
- Helix effects: Full HD2 set
- Stomp effects: Full HD2 set (same as Helix — stomp limit is on block count, not available models)
- Per-family EFFECT_NAMES arrays for Zod schema validation

### Cab Catalog Scoping
- Each family gets its own cab catalog (even though all currently use the same HD2 cabs)
- Future-proofs for Stadium getting Agoura-native cabs in firmware updates
- Per-family CAB_NAMES arrays for Zod schema validation

### ToneIntent Schema Factory (Claude decides)
- Claude picks whether getToneIntentSchema() takes DeviceFamily or DeviceTarget
- Claude picks whether families produce distinct TypeScript types or one generic ToneIntent
- Claude decides whether to delete the global ToneIntentSchema export immediately or keep it temporarily
- Claude picks where the factory function lives
- Constraint: Claude's constrained decoding must structurally prevent cross-family amp selection (CAT-04)

</decisions>

<specifics>
## Specific Ideas

- Stadium is the living product line — its catalogs will grow with firmware updates. HD2 families are frozen.
- The Pod Go Mono/Stereo suffix mapping (POD_GO_EFFECT_SUFFIX) should be encoded in the Pod Go catalog itself, not as an external transform
- getModelIdForDevice() and getBlockTypeForDevice() currently live in models.ts with isPodGo() branching — these become per-family concerns
- models.ts is 1600+ lines. After catalog extraction, it should shrink dramatically — residual code is shared types and constants only

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AMP_MODELS` (models.ts): ~80 HD2 amp entries — these become the helix/stomp/podgo amp catalogs
- `STADIUM_AMPS` (models.ts): ~20 Agoura amp entries — these become the stadium amp catalog
- `DISTORTION_MODELS`, `DELAY_MODELS`, `REVERB_MODELS`, `MODULATION_MODELS`, `DYNAMICS_MODELS` (models.ts): HD2 effect catalogs — duplicated into each family
- `EQ_MODELS` (models.ts): HD2 EQ set — helix/stomp get full set, podgo gets full set, stadium gets STADIUM_EQ_MODELS
- `WAH_MODELS`, `VOLUME_MODELS` (models.ts): shared across all families
- `CAB_MODELS` (models.ts): shared HD2 cabs — duplicated into each family
- `POD_GO_EXCLUDED_MODELS` (models.ts): 3 models excluded from Pod Go — pod go catalog simply omits them
- `POD_GO_EFFECT_SUFFIX` (models.ts): Mono/Stereo suffix mapping — moves into podgo catalog
- `getModelListForPrompt()` (models.ts): Device-filtered prompt builder — may move or stay per Claude's decision
- `getModelIdForDevice()`, `getBlockTypeForDevice()` (models.ts): Pod Go ID transforms — becomes podgo catalog concern
- `isModelAvailableForDevice()` (models.ts): Runtime availability check — replaced by structural isolation
- `DeviceCapabilities.ampCatalogEra` (device-family.ts): "hd2" | "agoura" — already in type system from Phase 61

### Established Patterns
- `Record<string, HelixModel>` for amp/effect catalogs — all family catalogs follow this shape
- `as [string, ...string[]]` tuple casts for z.enum() — per-family name arrays follow this pattern
- `HelixModel` interface with `stadiumOnly?: boolean` flag — this field becomes unnecessary after isolation (Stadium models live in stadium catalog, period)
- Barrel file exports via `src/lib/helix/index.ts` — new family catalogs need re-export wiring

### Integration Points
- `src/lib/helix/tone-intent.ts`: Imports AMP_NAMES, CAB_NAMES, EFFECT_NAMES — must import from family catalogs instead
- `src/lib/planner.ts`: Imports ToneIntentSchema, getModelListForPrompt — must use getToneIntentSchema(family)
- `src/lib/helix/index.ts`: Exports AMP_NAMES, CAB_NAMES, EFFECT_NAMES — re-export strategy changes
- `src/lib/helix/validate.ts`: Uses getAllModels() for VALID_IDS — needs per-family or union approach
- `src/lib/helix/param-engine.ts`: Imports AMP_MODELS for parameter lookups — may need per-family catalog access
- `src/lib/helix/chain-rules.ts`: Imports model catalogs for block type classification
- `src/app/api/generate/route.ts`: Pipeline entry — already calls resolveFamily(), must pass family to schema factory
- `scripts/verify-prompt-enrichment.ts`: Uses getModelListForPrompt — update if signature changes

### Consumers of AMP_NAMES / EFFECT_NAMES / CAB_NAMES (must be updated)
- `src/lib/helix/tone-intent.ts` (lines 9, 25, 27)
- `src/lib/helix/index.ts` (line 3)
- `src/lib/planner.ts` (line 8)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 62-catalog-isolation*
*Context gathered: 2026-03-05*
