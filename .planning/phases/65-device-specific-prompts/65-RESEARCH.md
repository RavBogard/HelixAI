# Phase 65: Device-Specific Prompts - Research

**Researched:** 2026-03-06
**Domain:** TypeScript prompt engineering, LLM system prompt architecture, per-family module decomposition
**Confidence:** HIGH — all findings verified against existing codebase source; no external library research required for core architecture

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Chat Conversation Arc**
- Dream-then-trim flow for constrained devices: let the user describe their ideal tone first, then surface block-budget limits organically when the plan exceeds what's available
- Helix Floor/LT/Rack chat does NOT proactively suggest dual-amp — only offers it when the user explicitly asks for two amps
- Helix family planner prompt must prioritize correct dual-DSP layout for ALL presets (not just dual-amp). The old model frequently failed to connect DSP0 → DSP1 properly, making the second path useless. The planner prompt needs explicit, detailed routing instructions: how blocks flow from Path 1 to Path 2, where the split/join happens, and how effects distribute across both DSPs. This is a top-priority fix for the Helix family prompt
- Pod Go chat uses upfront transparency about constraints: "Pod Go gives you 4 effect slots — let's make every one count"
- Stadium chat has a distinct arena-grade personality: references live sound, FOH mixing, stage volume — different demographic (pro touring) from the home/gigging Helix user
- Stomp/PodGo chat surfaces explicit trade-off questions when the user's described tone exceeds the slot budget: "That's 8 blocks but HX Stomp allows 6. Which matters more: the boost or the chorus?"

**Tone Vocabulary & Naming**
- Chat prompts use device-native model names (e.g., "Placater Dirty" for Helix, "Agoura_Princeton" for Stadium) so users learn their device's actual model names
- Chat keeps both real-world amp references AND device model names: "the Placater Dirty (Friedman BE-100 style)" — bridges the gap for users who know real amps but not Helix model names
- Each family's planner prompt gets its own amp-to-cab pairing table with only that family's models — Stadium gets Agoura amp → Stadium cab pairings, Helix gets HD2 pairings
- Genre-specific effect guidelines are device-adjusted: Stomp metal gets "max 2 effects" (not 3) because of 6-slot limit; PodGo ambient gets "delay + reverb mandatory, but only 2 remaining slots"

**Constraint Surfacing & Effect Priority**
- When over budget on constrained devices, planner uses genre-based priority hierarchy: Metal priority = drive > delay > mod; Ambient priority = reverb > delay > mod > drive
- Pod Go hard-enforces 4-effect limit — no exceptions, no "stretch" configurations
- Helix Floor/LT DSP routing is a flexible guideline: "Prefer pre-effects on DSP0, post-effects on DSP1, but balance DSP load if needed" — not a hard rule

**Prompt Architecture**
- Per-family prompt files at `families/{family}/prompt.ts` — each exports `getSystemPrompt(device)` and `buildPlannerPrompt(device, modelList)`
- Composable prompt sections: small reusable modules (gain-staging.ts, tone-intent-fields.ts, dual-amp-rules.ts, etc.) that families import and compose like building blocks
- API route resolves DeviceFamily from DeviceTarget using `resolveFamily()` from Phase 61, then calls the family's prompt functions — backend owns the device→family mapping
- Preserve current Claude planner caching strategy: per-family system prompts each get their own cache entry (cache_control: ephemeral, ttl: 1h), user message varies — same mechanism, different cache keys per family

### Claude's Discretion
- Exact prompt section composition order within each family
- How to structure the composable prompt section files (which sections to factor out vs. keep inline)
- Stadium amp-to-cab pairing table content (depends on Phase 62/63 Agoura catalog)
- Exact wording of device constraint framing in chat prompts

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROMPT-01 | Each device family has its own planner prompt template with only its model catalog, constraints, and capabilities | Architecture Pattern 1 below: per-family `buildPlannerPrompt()` imports only its family's catalog. Replaces `getModelListForPrompt()` branching in current `planner.ts`. |
| PROMPT-02 | Each device family has its own chat system prompt with device-appropriate conversation arc | Architecture Pattern 2 below: per-family `getSystemPrompt(device)` replaces the monolithic `gemini.ts:getSystemPrompt()` with no device parameter. |
| PROMPT-03 | Stomp prompt emphasizes block-budget management ("what do you cut?" constraint conversation) | Existing chat prompt already has Stomp constraints; refactoring extracts and deepens them. Stomp family gets genre-adjusted effect limits, trade-off dialogue patterns, and dream-then-trim flow. |
| PROMPT-04 | Pod Go prompt emphasizes slot priority and regimented chain order | Pod Go family prompt gets hard 4-effect limit in planner, upfront transparency in chat ("4 slots — make every one count"), and priority hierarchy for slot overruns. |
| PROMPT-05 | Stadium prompt uses Agoura-native tone vocabulary and references Stadium-specific features (7-band Parametric EQ) | Stadium family chat uses arena-grade personality, FOH references, Agoura_* model names, and Stadium-specific constraints (single-path initially, Agoura amps only). Depends on Phase 62 for Agoura catalog. |
| PROMPT-06 | Helix prompt leverages full dual-DSP capabilities and dual-amp routing options | Helix family planner prompt gets explicit dual-DSP routing instructions (the #1 priority fix) — Path 1 block flow, Path 2 block flow, split/join positioning — and correct dual-amp topology. |
</phase_requirements>

---

## Summary

Phase 65 is a pure prompt engineering and TypeScript module refactor. There are no new libraries to install, no schema migrations, and no external API changes. The work is: (1) extract the monolithic `buildPlannerPrompt()` in `planner.ts` and `getSystemPrompt()` in `gemini.ts` into per-family files, (2) deepen each family's prompt with device-specific conversation arcs, constraint surfacing, and model vocabulary, and (3) update the two API routes to resolve the device family and call the correct per-family prompt.

The current codebase already branches on device type with `isPodGo()`, `isStadium()`, `isStomp()` guards inside a single monolithic prompt function. Phase 65 pulls those branches apart into isolated modules. The refactor is strictly additive in effect — the same information flows through the same API, but it now comes from isolated per-family sources instead of a single branching function.

The biggest implementation risk is the dual-DSP routing instructions for the Helix family planner prompt — the CONTEXT.md calls this the "#1 priority fix" because the old model routinely failed to connect DSP0 to DSP1 properly. This requires crafting precise textual descriptions of block positioning: how Path 1 flows to Path 2, where the split block sits, and how post-effects distribute across DSP1. Getting this language right is the most judgment-intensive part of the phase.

**Primary recommendation:** Create `src/lib/families/{family}/prompt.ts` per family, extract composable sections into `src/lib/families/shared/` modules, update `src/app/api/chat/route.ts` and `src/app/api/generate/route.ts` to call family-dispatched functions after resolving DeviceFamily via Phase 61's `resolveFamily()`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | ^5 (project) | Module authoring, type-safe prompt composition | Already the project language |
| `@anthropic-ai/sdk` | ^0.78.0 (project) | Claude planner API, `cache_control: ephemeral` | Already in use for planner caching |
| `@google/genai` | ^1.42.0 (project) | Gemini chat API, system instruction | Already in use for chat |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | ^4.3.6 (project) | Per-family ToneIntent schemas (CAT-04 from Phase 62) | When Phase 62 ToneIntentSchemas are per-family, Phase 65 planner prompts reference them |
| vitest | ^4.0.18 (project) | Unit tests for prompt content (pattern from `planner.test.ts`) | Testing that each family prompt contains required sections and cross-family model names don't appear |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-family `.ts` files | Template literal strings in a config object | Config objects lose TypeScript function signatures and are harder to test |
| Composable shared modules | Inline repetition per family | Repetition creates drift risk — shared sections (gain-staging, ToneIntent fields) should be factored out |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/
├── families/
│   ├── shared/
│   │   ├── gain-staging.ts          # Shared planner section: gain-staging intelligence text
│   │   ├── tone-intent-fields.ts    # Shared planner section: ToneIntent field descriptions
│   │   └── amp-cab-pairing.ts       # Shared planner section: generic pairing table builder
│   ├── helix/
│   │   └── prompt.ts                # getSystemPrompt(device), buildPlannerPrompt(device, modelList)
│   ├── stomp/
│   │   └── prompt.ts                # getSystemPrompt(device), buildPlannerPrompt(device, modelList)
│   ├── podgo/
│   │   └── prompt.ts                # getSystemPrompt(device), buildPlannerPrompt(device, modelList)
│   └── stadium/
│       └── prompt.ts                # getSystemPrompt(device), buildPlannerPrompt(device, modelList)
└── prompt-router.ts                 # resolveFamily() → dispatch to correct family prompt
```

The composable shared modules export pure functions returning strings — they take no device-specific parameters. Each family's `prompt.ts` imports from `shared/` for common sections and composes them with its own device-specific blocks.

### Pattern 1: Per-Family Planner Prompt

**What:** Each family's `buildPlannerPrompt(device, modelList)` composes shared sections and family-specific sections into a complete system prompt.

**When to use:** Every time `callClaudePlanner()` is invoked — the generate API route resolves family then calls this.

**Example (helix/prompt.ts):**
```typescript
// src/lib/families/helix/prompt.ts
import { gainStagingSection } from "../shared/gain-staging";
import { toneIntentFieldsSection } from "../shared/tone-intent-fields";
import type { DeviceTarget } from "@/lib/helix/types";

export function buildPlannerPrompt(device: DeviceTarget, modelList: string): string {
  const deviceName = device === "helix_floor" ? "Helix Floor" : "Helix LT";
  const isFloor = device === "helix_floor";

  return `You are HelixTones' Planner. You choose creative model selections for ${deviceName} presets.

## Your Role
You translate a tone interview conversation into a ToneIntent — a structured set of creative choices.
You do NOT set any numeric parameter values. The Knowledge Layer handles all parameters.

## Valid Model Names
Use ONLY these exact model names. Any name not in this list will be rejected.

${modelList}

${toneIntentFieldsSection({ maxEffects: 6, snapshots: 8, includeSecondAmp: true })}

${gainStagingSection()}

## Dual-DSP Routing (CRITICAL — read carefully)

${deviceName} has two DSPs. Every preset must correctly connect DSP0 → DSP1 or blocks on DSP1 produce no sound.

**Standard single-amp layout:**
- DSP0 (Path 1): input → [pre-effects: comp, drive] → amp → cab → split block
  - split block routes signal to DSP1
- DSP1 (Path 2): [receives from split] → [post-effects: mod, delay, reverb] → join block → output

**Dual-amp layout** (ONLY when user explicitly requests two different amps):
- DSP0 (Path 1A): input → [pre-effects max 2] → amp1 → cab1
- DSP0 (Path 1B): [receives from split] → amp2 → cab2
- Split block: positioned on Path 1, routes to Path 1B
- Join block: merges Path 1A and 1B before passing to DSP1
- DSP1 (Path 2): [receives from join] → [post-effects: delay, reverb] → output

**Rules:**
- Pre-effects (comp, drive, EQ) go on DSP0 — Path 1
- Post-effects (mod, delay, reverb) go on DSP1 — Path 2
- Balance DSP load if needed — this is a guideline, not a hard rule
- For dual-amp: ampName = clean/crunch snapshots; secondAmpName = lead/ambient snapshots
- Do NOT suggest dual-amp proactively — only use it if the user explicitly requests two amps

## Amp-to-Cab Pairing
[Helix-specific HD2 amp → cab pairing table — populated from per-family catalog in Phase 62]

## Effect Discipline by Genre
- **Metal / hard rock**: Maximum 3 effects. Optional delay at low mix. Do NOT include reverb.
- **Blues / classic rock / country**: 2-3 effects. Delay and reverb typical; optional vibrato.
- **Jazz / fusion**: 1-2 effects maximum. Light reverb only.
- **Ambient / worship**: 4-6 effects expected. MUST include at least one reverb AND one delay.
- **Pop / funk**: 2-3 effects. Chorus or phaser appropriate; keep delay mix low.

Based on the conversation below, generate a ToneIntent:`;
}

export function getSystemPrompt(device: DeviceTarget): string {
  // ... Helix-family chat system prompt with dream-then-trim flow,
  // dual-amp only when explicitly requested, device-native model vocabulary
  return `...`;
}
```

### Pattern 2: Per-Family Chat System Prompt

**What:** Each family's `getSystemPrompt(device)` returns a chat system prompt tailored to the device's constraints and demographic.

**When to use:** Chat API route — after resolving DeviceFamily, call the family's `getSystemPrompt()`.

**Key per-family differentiators:**

| Family | Chat personality | Constraint surfacing | Proactive suggestions |
|--------|-----------------|---------------------|----------------------|
| Helix (Floor/LT) | Expert studio/gigging tone builder | Dual-amp only when asked; DSP routing guidance | Always-on Klon, post-cab EQ, snapshot balancing |
| Stomp/StompXL | Budget-conscious; "make 6 slots count" | Dream-then-trim; explicit trade-off questions when over budget | Prioritize: drive > delay > reverb > mod |
| Pod Go | Empowering; "4 slots is plenty" | Upfront transparency; hard 4-slot limit surfaced early | Slot priority hierarchy surfaced as positive framing |
| Stadium | Arena-grade; FOH/pro touring demographic | Stadium-only constraints; Agoura model vocabulary | Stage volume, monitor mix, FOH-ready tone references |

### Pattern 3: Prompt Router

**What:** A central `promptRouter.ts` resolves DeviceFamily from DeviceTarget (using Phase 61's `resolveFamily()`) and dispatches to the correct family prompt module.

**When to use:** API routes import from the router, not from individual family files.

**Example:**
```typescript
// src/lib/prompt-router.ts
import { resolveFamily } from "@/lib/helix/family-router"; // Phase 61
import type { DeviceTarget, DeviceFamily } from "@/lib/helix/types";
import { buildPlannerPrompt as helixPlannerPrompt, getSystemPrompt as helixChatPrompt } from "./families/helix/prompt";
import { buildPlannerPrompt as stompPlannerPrompt, getSystemPrompt as stompChatPrompt } from "./families/stomp/prompt";
import { buildPlannerPrompt as podgoPlannerPrompt, getSystemPrompt as podgoChatPrompt } from "./families/podgo/prompt";
import { buildPlannerPrompt as stadiumPlannerPrompt, getSystemPrompt as stadiumChatPrompt } from "./families/stadium/prompt";

export function getFamilyPlannerPrompt(device: DeviceTarget, modelList: string): string {
  const family = resolveFamily(device);
  switch (family) {
    case "helix": return helixPlannerPrompt(device, modelList);
    case "stomp": return stompPlannerPrompt(device, modelList);
    case "podgo": return podgoPlannerPrompt(device, modelList);
    case "stadium": return stadiumPlannerPrompt(device, modelList);
  }
}

export function getFamilyChatPrompt(device: DeviceTarget): string {
  const family = resolveFamily(device);
  switch (family) {
    case "helix": return helixChatPrompt(device);
    case "stomp": return stompChatPrompt(device);
    case "podgo": return podgoChatPrompt(device);
    case "stadium": return stadiumChatPrompt(device);
  }
}
```

### Pattern 4: Shared Composable Sections

**What:** Pure functions in `src/lib/families/shared/` that return prompt text strings. Each function has typed parameters for device-varying values.

**When to use:** Any section that appears in multiple family prompts — gain-staging, ToneIntent field descriptions, Variax guidance.

**Example:**
```typescript
// src/lib/families/shared/tone-intent-fields.ts
export interface ToneIntentFieldsOptions {
  maxEffects: number;
  snapshots: number;
  includeSecondAmp: boolean;
}

export function toneIntentFieldsSection(opts: ToneIntentFieldsOptions): string {
  return `## ToneIntent Fields

Generate a JSON object with these fields:

- **ampName**: Exact name from the AMPS list above
- **cabName**: Exact name from the CABS list above
${opts.includeSecondAmp ? `- **secondAmpName** (OPTIONAL): Second amp — ONLY when user explicitly requests two different amps\n- **secondCabName** (OPTIONAL): Required when secondAmpName is set` : ""}
- **guitarType**: "single_coil", "humbucker", or "p90"
- **genreHint**: Optional genre description
- **effects**: Array of up to ${opts.maxEffects} effects, each with modelName and role
- **snapshots**: Exactly ${opts.snapshots} snapshots with name (max 10 chars) and toneRole
- **presetName**: Creative preset name (max 32 characters)
- **description**: Brief tone description
- **guitarNotes**: Tips for the user`;
}
```

### Pattern 5: Cache Control (Preserve Existing Strategy)

**What:** Per-family planner system prompts each get their own `cache_control: { type: "ephemeral", ttl: "1h" }` entry in the Claude API call. The user message varies; the system prompt is static per family per device.

**When to use:** `callClaudePlanner()` already implements this pattern — after Phase 65, the system prompt string comes from the family prompt module instead of the monolithic `buildPlannerPrompt()`, but the cache_control structure is unchanged.

**Cache key implications:** Each unique system prompt string gets its own cache bucket. Four families = up to four distinct cache entries. Low-volume devices (Stadium, Pod Go) may not achieve the ~5-request threshold for warm cache hits. Per STATE.md note, this is a known concern: measure volume before concluding cache is ineffective.

**Existing implementation to preserve:**
```typescript
// src/lib/planner.ts — callClaudePlanner() (existing pattern, preserve as-is)
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 4096,
  system: [
    {
      type: "text" as const,
      text: systemPrompt, // now comes from getFamilyPlannerPrompt(device, modelList)
      cache_control: { type: "ephemeral" as const, ttl: "1h" },
    },
  ],
  messages: [{ role: "user", content: userContent }],
  output_config: { format: zodOutputFormat(ToneIntentSchema) },
});
```

### Anti-Patterns to Avoid

- **Cross-family model name leakage:** Any single per-family prompt file must not contain model names from another family. A grep for `Agoura_` in any non-Stadium prompt file must return zero results. A grep for HD2 amp names (e.g., `Placater`, `Derailed`) in the Stadium prompt must return zero results. This is the explicit success criterion from the roadmap.
- **Re-adding the monolithic `buildPlannerPrompt()` guards:** Do not reach back into the monolithic function during migration. Replace the call sites atomically.
- **Putting device-varying content in the static cache prefix:** Any content that changes per-device must come AFTER the static shared sections. Static sections (gain-staging, ToneIntent field descriptions) form the cache-safe prefix; device-restriction text goes at the end — this pattern already exists in the current `buildPlannerPrompt()` and must be preserved.
- **Calling `getSystemPrompt()` without a device parameter after this phase:** The chat route currently calls `getSystemPrompt()` with no parameters. After Phase 65 it must pass DeviceTarget. Leaving the no-parameter call in place bypasses the per-family routing entirely.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prompt string interpolation | Custom template engine | TypeScript template literals | Already the project pattern; no overhead |
| Cache key management | Manual hash computation | Rely on Anthropic's content-hash caching | Anthropic caches on content hash of the text; unique text = unique cache entry automatically |
| Model catalog filtering per family | Custom filter logic in prompt modules | Import from per-family catalog modules (Phase 62 output) | Phase 62 owns catalog isolation; prompt modules should import, not re-filter |
| DeviceFamily resolution | Inline `if/else` in routes | `resolveFamily()` from Phase 61 | Centralized resolution is a Phase 61 deliverable; Phase 65 consumes it |

**Key insight:** This phase is a composition and content problem, not a library problem. The entire implementation is TypeScript string composition using existing patterns from `planner.ts` and `gemini.ts`.

---

## Common Pitfalls

### Pitfall 1: Dual-DSP Routing Language Ambiguity
**What goes wrong:** The planner prompt describes Path 1 → Path 2 routing in vague terms ("effects go on DSP1") and Claude still places post-effects on DSP0, leaving DSP1 with only an empty path — making the second DSP useless.
**Why it happens:** The existing monolithic prompt has a brief hint about routing but lacks explicit instructions about where the split block goes and how it connects. Claude does not have structural knowledge of the Helix block graph.
**How to avoid:** Write routing instructions as explicit block-ordering descriptions with named positions. Use numbered steps: "1. input, 2. comp/drive blocks, 3. amp+cab, 4. split block → continues to DSP1, 5. (DSP1) post-effects, 6. join, 7. output." Specify that the split block must be positioned after the cab block on Path 1 with `@position` increasing left to right.
**Warning signs:** Integration test outputs with all blocks on `dsp0` and `dsp1` empty, or join block missing from the output.

### Pitfall 2: Stadium Prompt Written Before Phase 62 Agoura Catalog
**What goes wrong:** The Stadium planner prompt references Agoura amp names and Stadium-specific cab pairings, but Phase 62 hasn't shipped yet — the catalog may not match what eventually gets defined.
**Why it happens:** Phase 65 depends on Phase 62. If Stadium prompt content is written with hardcoded Agoura names, and Phase 62 changes those names, the prompt goes stale silently.
**How to avoid:** The Stadium planner prompt's model list is always generated at runtime by calling the family's catalog module (same pattern as current `getModelListForPrompt()`). Only the amp-to-cab pairing table is static text — mark it clearly as "to be populated after Phase 62" and leave a `// TODO(Phase62): populate Stadium amp→cab table` comment as a placeholder. Do not hardcode amp names.
**Warning signs:** Stadium preset generation using amp names not present in the Phase 62 Agoura catalog.

### Pitfall 3: Cache Fragmentation from Per-Device vs. Per-Family Prompts
**What goes wrong:** If the Helix family generates slightly different prompt text for `helix_lt` vs. `helix_floor` (e.g., different device name in the header), these are two separate cache entries. With low traffic volume, neither warms up reliably.
**Why it happens:** The device name (`"Helix Floor"` vs. `"Helix LT"`) appears in the static prefix. Changing a single character creates a new cache bucket.
**How to avoid:** Factor device-name variation out of the static prefix. Use a generic "Helix" reference in the shared text, and add device-specific details in a section that appears after the static prefix (mimicking the current `DEVICE RESTRICTION` placement at the end of `buildPlannerPrompt()`). Alternatively, use the same system prompt text for LT and Floor (they are functionally identical architecturally) and vary only the user message.
**Warning signs:** Planner logs showing consistent `cache=MISS` for high-traffic devices like Helix LT.

### Pitfall 4: Stomp XL Snapshot Count Mismatch
**What goes wrong:** The Stomp family planner prompt specifies 3 snapshots (Stomp limit), but a Stomp XL request generates a preset with only 3 snapshots when 4 are allowed.
**Why it happens:** Stomp and Stomp XL are in the same family but have different limits (`STOMP_MAX_SNAPSHOTS = 3`, `STOMP_XL_MAX_SNAPSHOTS = 4`). The `getSystemPrompt(device)` function must branch on the exact DeviceTarget, not just the family.
**How to avoid:** The Stomp family `buildPlannerPrompt(device, modelList)` receives the specific DeviceTarget. Use `device === "helix_stomp_xl"` to conditionally specify 4 snapshots vs. 3. The `STOMP_CONFIG` constants in `config.ts` are the source of truth — import and reference them directly rather than hardcoding.
**Warning signs:** Stomp XL presets with only 3 snapshots when the user requested 4 tonal states.

### Pitfall 5: API Routes Importing Old Monolithic Functions After Refactor
**What goes wrong:** The chat route still calls `getSystemPrompt()` from `@/lib/gemini` (no device parameter) after Phase 65. Behavior appears correct for Helix users but all Stomp/Pod Go/Stadium users get the generic Helix chat prompt.
**Why it happens:** The import in `src/app/api/chat/route.ts` is not updated atomically with the new family prompt modules.
**How to avoid:** Update both route files in the same task as creating the family prompt modules. After creating the family modules, immediately update the routes to call `getFamilyChatPrompt(device)` and `getFamilyPlannerPrompt(device, modelList)` from the prompt router. The old `buildPlannerPrompt()` in `planner.ts` and `getSystemPrompt()` in `gemini.ts` should be deleted (not deprecated) to prevent silent fallback.
**Warning signs:** Stomp users receiving "I see you're on Helix LT" conversation framing after the phase ships.

---

## Code Examples

Verified patterns from the existing codebase:

### Current Monolithic Pattern (source to refactor)
```typescript
// src/lib/planner.ts — buildPlannerPrompt() (existing, to be replaced)
export function buildPlannerPrompt(modelList: string, device?: DeviceTarget): string {
  const podGo = device ? isPodGo(device) : false;
  const stadium = device ? isStadium(device) : false;
  const stomp = device ? isStomp(device) : false;
  // ... all families in one function with inline guards
  return `...${podGo ? "\n**DEVICE RESTRICTION...**" : ""}...`;
}
```

### Current API Route Call Sites (to update)
```typescript
// src/app/api/generate/route.ts — line 82 (existing)
const toneIntent = await callClaudePlanner(messages, deviceTarget, toneContext);

// src/app/api/chat/route.ts — line 74 (existing)
const chat = ai.chats.create({
  model: modelId,
  config: {
    systemInstruction: getSystemPrompt(), // ← no device parameter — must add
    tools: [{ googleSearch: {} }],
  },
  history,
});
```

### Cache Control Pattern (preserve unchanged)
```typescript
// src/lib/planner.ts — callClaudePlanner() — cache_control structure to preserve
system: [
  {
    type: "text" as const,
    text: systemPrompt,
    cache_control: { type: "ephemeral" as const, ttl: "1h" },
  },
],
```

### STOMP_CONFIG Reference (use these constants, not hardcoded numbers)
```typescript
// src/lib/helix/config.ts (existing)
export const STOMP_CONFIG = {
  STOMP_MAX_BLOCKS: 6,
  STOMP_XL_MAX_BLOCKS: 9,
  STOMP_MAX_SNAPSHOTS: 3,
  STOMP_XL_MAX_SNAPSHOTS: 4,
} as const;
```

### Vitest Test Pattern for Prompt Sections (from planner.test.ts — follow this pattern)
```typescript
// Pattern from src/lib/planner.test.ts — replicate per-family
import { describe, it, expect } from "vitest";
import { buildPlannerPrompt } from "@/lib/families/helix/prompt";
import { getModelListForPrompt } from "@/lib/helix"; // Phase 62 will provide per-family version

describe("helix/buildPlannerPrompt", () => {
  const modelList = getModelListForPrompt("helix_lt");
  const prompt = buildPlannerPrompt("helix_lt", modelList);

  it("contains dual-DSP routing section", () => {
    expect(prompt).toContain("DSP0");
    expect(prompt).toContain("DSP1");
    expect(prompt).toContain("split block");
  });

  it("does not contain Agoura amp names (cross-family isolation)", () => {
    expect(prompt).not.toContain("Agoura_");
  });

  it("does not suggest dual-amp proactively", () => {
    // Dual-amp section must be conditional, not a suggestion
    expect(prompt).toContain("ONLY when user explicitly requests");
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single monolithic `buildPlannerPrompt()` with inline device guards | Per-family `buildPlannerPrompt(device, modelList)` modules | Phase 65 (this phase) | Prompt isolation complete — cross-family model names impossible in a single file |
| `getSystemPrompt()` with no device parameter | `getSystemPrompt(device)` dispatched per family | Phase 65 (this phase) | Each device family gets a conversation arc appropriate to its constraints |
| Stadium chat uses same generic prompt as Helix | Stadium chat has arena-grade personality, FOH references | Phase 65 (this phase) | Stadium users (pro touring demographic) get relevant vocabulary and framing |

**Deprecated after this phase:**
- `buildPlannerPrompt(modelList, device?)` in `src/lib/planner.ts`: replaced by per-family prompt modules via prompt router. Delete after Phase 65 lands.
- `getSystemPrompt()` in `src/lib/gemini.ts`: replaced by per-family chat prompts via prompt router. Delete after Phase 65 lands.

---

## Open Questions

1. **Stadium amp-to-cab pairing table content**
   - What we know: Stadium uses Agoura_* amps; cab pairing follows same principle as HD2 (match era/speaker voicing)
   - What's unclear: Exact Agoura amp → Stadium cab mapping depends on the Phase 62 Agoura catalog output; that catalog is not yet defined
   - Recommendation: Write the Stadium planner prompt with a `// TODO(Phase62): populate Agoura amp→cab table` placeholder. Implement the table in a separate Stadium-specific step that runs after Phase 62 ships.

2. **Cache economics for Stadium and Pod Go**
   - What we know: STATE.md documents this as a known concern. Cache requires multiple requests to the same prompt to warm up. Low-volume device families may never achieve warm cache.
   - What's unclear: Actual traffic volume per device family on production. There are no per-device usage logs yet (current `logUsage()` records endpoint but not device family).
   - Recommendation: Add `device` field to `PlannerUsageRecord` in `usage-logger.ts` as part of Phase 65 so post-ship analysis can measure per-family cache hit rates. Do not pre-optimize to shared buckets without data.

3. **Helix Floor vs. Helix LT prompt identity**
   - What we know: Floor and LT are architecturally identical (same DSP count, same block limits, same snapshot count). The only hardware difference is footswitch count.
   - What's unclear: Should the Helix family use identical prompt text for both (single cache entry) or allow minor differentiation (two entries)?
   - Recommendation: Use identical system prompt text for LT and Floor in the planner prompt. The device name can appear in the user message (which varies anyway) without breaking cache. This gives the Helix family a single warm cache entry instead of two competing cold ones.

---

## Sources

### Primary (HIGH confidence)
- `src/lib/planner.ts` — Full source of current monolithic `buildPlannerPrompt()` and `callClaudePlanner()`; all cache_control patterns, device branching, and model list logic verified directly
- `src/lib/gemini.ts` — Full source of `getSystemPrompt()` with no device parameter; Gemini client creation, system instruction call site
- `src/app/api/chat/route.ts` — API route that calls `getSystemPrompt()` with no device; shows where device parameter must be added
- `src/app/api/generate/route.ts` — API route that calls `callClaudePlanner(messages, deviceTarget, toneContext)`; device is already threaded through
- `src/lib/helix/config.ts` — `STOMP_CONFIG` constants for snapshot/block limits; ground truth for Stomp/StompXL limits
- `src/lib/helix/types.ts` — `DeviceTarget` type, `isPodGo()`, `isStadium()`, `isStomp()`, `isHelix()` helpers
- `src/lib/planner.test.ts` — Existing vitest test pattern for prompt section content; replicate this pattern for per-family tests
- `.planning/phases/65-device-specific-prompts/65-CONTEXT.md` — All locked user decisions

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Cache economics concern documented as known blocker; Phase 65 cache economics note
- `src/lib/usage-logger.ts` — `PlannerUsageRecord` structure; basis for recommendation to add device field

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing project dependencies verified from package.json and source files
- Architecture: HIGH — per-family module pattern directly derived from existing source structure; composable section pattern directly derived from existing `buildPlannerPrompt()` helper pattern
- Pitfalls: HIGH — dual-DSP routing ambiguity and cross-family leakage verified from existing source; cache fragmentation from existing cache pattern analysis; Stomp XL snapshot mismatch from existing `STOMP_CONFIG` constants
- Prompt content decisions (dual-DSP instructions, constraint framing): MEDIUM — verified against CONTEXT.md user decisions; actual prompt wording quality only verifiable through generation testing

**Research date:** 2026-03-06
**Valid until:** 2026-06-06 (stable domain — pure TypeScript, no external dependencies)
