# Phase 65: Device-Specific Prompts - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Each device family (helix, stomp, podgo, stadium) gets its own planner prompt and chat system prompt, containing only that family's model catalog and the conversation arc appropriate to its constraints. Prompt isolation is complete — no cross-family model names appear in any single prompt file.

Depends on Phase 62 (per-family catalogs must exist to source model lists).

</domain>

<decisions>
## Implementation Decisions

### Chat Conversation Arc
- Dream-then-trim flow for constrained devices: let the user describe their ideal tone first, then surface block-budget limits organically when the plan exceeds what's available
- Helix Floor/LT chat does NOT proactively suggest dual-amp — only offers it when the user explicitly asks for two amps. However, when dual-amp IS requested, the planner prompt must include explicit, correct dual-DSP routing instructions (split → amp2 + cab2 → join, DSP0↔DSP1 connection). The old version had a bug where dual-DSP paths wouldn't connect properly, making dual-amp presets useless
- Pod Go chat uses upfront transparency about constraints: "Pod Go gives you 4 effect slots — let's make every one count"
- Stadium chat has a distinct arena-grade personality: references live sound, FOH mixing, stage volume — different demographic (pro touring) from the home/gigging Helix user
- Stomp/PodGo chat surfaces explicit trade-off questions when the user's described tone exceeds the slot budget: "That's 8 blocks but HX Stomp allows 6. Which matters more: the boost or the chorus?"

### Tone Vocabulary & Naming
- Chat prompts use device-native model names (e.g., "Placater Dirty" for Helix, "Agoura_Princeton" for Stadium) so users learn their device's actual model names
- Chat keeps both real-world amp references AND device model names: "the Placater Dirty (Friedman BE-100 style)" — bridges the gap for users who know real amps but not Helix model names
- Each family's planner prompt gets its own amp-to-cab pairing table with only that family's models — Stadium gets Agoura amp → Stadium cab pairings, Helix gets HD2 pairings
- Genre-specific effect guidelines are device-adjusted: Stomp metal gets "max 2 effects" (not 3) because of 6-slot limit; PodGo ambient gets "delay + reverb mandatory, but only 2 remaining slots"

### Constraint Surfacing & Effect Priority
- When over budget on constrained devices, planner uses genre-based priority hierarchy: Metal priority = drive > delay > mod; Ambient priority = reverb > delay > mod > drive
- Pod Go hard-enforces 4-effect limit — no exceptions, no "stretch" configurations
- Helix Floor/LT DSP routing is a flexible guideline: "Prefer pre-effects on DSP0, post-effects on DSP1, but balance DSP load if needed" — not a hard rule

### Prompt Architecture
- Per-family prompt files at `families/{family}/prompt.ts` — each exports `getSystemPrompt(device)` and `buildPlannerPrompt(device, modelList)`
- Composable prompt sections: small reusable modules (gain-staging.ts, tone-intent-fields.ts, dual-amp-rules.ts, etc.) that families import and compose like building blocks
- API route resolves DeviceFamily from DeviceTarget using `resolveFamily()` from Phase 61, then calls the family's prompt functions — backend owns the device→family mapping
- Preserve current Claude planner caching strategy: per-family system prompts each get their own cache entry (cache_control: ephemeral, ttl: 1h), user message varies — same mechanism, different cache keys per family

### Claude's Discretion
- Exact prompt section composition order within each family
- How to structure the composable prompt section files (which sections to factor out vs. keep inline)
- Stadium amp-to-cab pairing table content (depends on Phase 62/63 Agoura catalog)
- Exact wording of device constraint framing in chat prompts

</decisions>

<specifics>
## Specific Ideas

- Stadium chat personality should feel "arena-grade" — references to FOH (Front of House), stage volume, monitor mixes, live sound engineering vocabulary
- Stomp trade-off conversations should feel like a knowledgeable friend helping prioritize, not a system rejecting requests
- Pod Go transparency should be empowering ("4 slots is plenty for a killer tone") not limiting
- Helix dual-amp routing must be bulletproof when requested — the planner prompt needs explicit split/join topology instructions so DSP0 and DSP1 actually connect (old version failed here)
- Each family's planner prompt imports ONLY its own catalog module — a grep for cross-family model names in any single prompt file must return zero results (success criterion from roadmap)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `planner.ts:buildPlannerPrompt()` — current monolithic prompt function with device branching; source for all planner prompt content to be refactored into composable sections
- `gemini.ts:getSystemPrompt()` — current monolithic chat prompt with no device parameter; source for chat prompt content to be split per family
- `helix/models.ts` — current unified model catalog (AMP_MODELS, CAB_MODELS, etc.) being split per family in Phase 62
- `helix/types.ts` — DeviceTarget type, `isPodGo()`, `isStadium()`, `isStomp()` helpers; `resolveFamily()` being added in Phase 61
- `helix/config.ts` — STOMP_CONFIG with snapshot counts and block limits per device

### Established Patterns
- Prompt caching: system prompt uses `cache_control: { type: "ephemeral", ttl: "1h" }` — per-family prompts should preserve this
- `getModelListForPrompt(device)` filters model catalogs per device — this function should be replaced by per-family catalog imports
- `zodOutputFormat(ToneIntentSchema)` for structured output — per-family ToneIntent schemas from Phase 62 (CAT-04)
- Chat uses Gemini (`@google/genai`), Planner uses Claude (`@anthropic-ai/sdk`) — different providers for chat vs. planning

### Integration Points
- `src/app/api/chat/route.ts` calls `getSystemPrompt()` with no device parameter — needs to accept DeviceTarget, resolve family, call per-family prompt
- `src/app/api/generate/route.ts` calls `callClaudePlanner()` which calls `buildPlannerPrompt()` — needs to route to per-family planner prompt
- Phase 61 `resolveFamily()` — the device→family mapping function this phase depends on
- Phase 62 per-family catalogs — the model lists these prompts will import

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 65-device-specific-prompts*
*Context gathered: 2026-03-06*
