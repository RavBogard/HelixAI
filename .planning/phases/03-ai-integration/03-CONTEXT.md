# Phase 3: AI Integration - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire Claude Sonnet 4.6 as the single AI generation provider with constrained structured output. Create the Planner prompt that generates ToneIntent (creative model choices only, zero numeric parameters). Ensure ToneIntent Zod schema is the single source of truth for both TypeScript types and Claude's output_config JSON Schema. Keep Gemini chat interview phase unchanged.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 3 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Claude Sonnet 4.6 integration** — Use output_config with type: "json_schema" for constrained decoding. The JSON schema is derived from ToneIntentSchema via z.toJSONSchema(). Single source of truth: Zod schema → TypeScript types AND Claude schema.
- **Planner prompt design** — Narrow prompt that lists valid model IDs as enums, asks for ~15 creative fields only. No language about Drive, Master, EQ, or numeric parameters. The prompt must make clear that the Knowledge Layer handles all parameter values.
- **Model ID enumeration in prompt** — Include full AMP_MODELS, CAB_MODELS, and EFFECT_MODELS name lists in the prompt so Claude can only choose from valid IDs. Invalid IDs cause schema rejection, not auto-correction.
- **Gemini chat preservation** — The existing Gemini streaming chat with Google Search grounding for artist/rig research is unchanged. Only the generation endpoint changes.
- **Provider simplification** — Remove multi-provider comparison logic. Single provider (Claude Sonnet 4.6) generates one excellent ToneIntent per request.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — follow the architecture documented in `.planning/research/ARCHITECTURE.md` and `.planning/research/STACK.md`. The existing `tone-intent.ts` ToneIntentSchema from Phase 1 defines the exact output contract.

</specifics>

<code_context>
## Existing Code Insights

### Phase 1 & 2 Foundation (completed, available)
- `src/lib/helix/tone-intent.ts`: ToneIntentSchema (Zod) with z.toJSONSchema() export ready
- `src/lib/helix/models.ts`: getModelListForPrompt() already exists for prompt enumeration
- `src/lib/helix/chain-rules.ts`: assembleSignalChain(intent: ToneIntent) → BlockSpec[]
- `src/lib/helix/param-engine.ts`: resolveParameters(chain, intent) → BlockSpec[]
- `src/lib/helix/snapshot-engine.ts`: buildSnapshots(chain, intents) → SnapshotSpec[]

### Existing AI Code (to modify/replace)
- `src/lib/providers.ts`: Multi-provider abstraction — simplify to single Claude provider
- `src/lib/gemini.ts`: Gemini chat prompt — keep unchanged
- `src/app/api/generate/route.ts`: Generation endpoint — refactor to use Planner → Knowledge Layer pipeline
- `src/lib/generation-prompt.ts`: Monolithic 250+ line prompt — replace with narrow Planner prompt

### Integration Points
- POST /api/generate receives conversation history, calls Claude Planner, pipes ToneIntent through Knowledge Layer, returns .hlx file
- Gemini chat (POST /api/chat) is unchanged — continues Google Search grounded interview

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-ai-integration*
*Context gathered: 2026-03-02*
