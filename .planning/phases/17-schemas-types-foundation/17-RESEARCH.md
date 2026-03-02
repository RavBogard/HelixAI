# Phase 17: Schemas & Types Foundation - Research

**Researched:** 2026-03-02
**Domain:** Zod v4 schema authoring, TypeScript type inference, barrel export patterns
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RIG-06 | RigIntentSchema, PhysicalPedalSchema, SubstitutionEntrySchema, and SubstitutionMapSchema defined with Zod — single source of truth for TypeScript types and vision extraction output validation | Exact Zod v4 API verified at runtime; all four schemas compiled and parsed against test data; export pattern confirmed against existing index.ts barrel |
</phase_requirements>

---

## Summary

Phase 17 is a pure type-and-schema file creation phase. It creates one new file — `src/lib/helix/rig-intent.ts` — and adds four export lines to the existing `src/lib/helix/index.ts` barrel. No logic, no API calls, no UI. Every other v1.3 phase imports from here, so this phase is the dependency root.

The project uses **Zod v4.3.6** (not Zod v3). The Zod v4 API is largely compatible with v3 for the patterns used here (`z.object`, `z.string`, `z.number`, `z.enum`, `z.array`, `z.record`, `.optional()`), with one critical difference: `z.record()` requires **two arguments** in v4 (key type + value type). Attempting `z.record(z.string())` with one argument throws at runtime in v4. All schema shapes were validated against the live Zod v4.3.6 install. TypeScript compiler currently shows zero errors on the codebase — Phase 17 must preserve this.

The success criteria specify `knobPositions` as `Record<string, "low" | "medium-low" | "medium-high" | "high">` (coarse zone enum), not `Record<string, number>`. This is intentional — STACK.md documents that Claude's spatial reasoning cannot reliably estimate precise rotary percentages (documented Anthropic limitation: "like reading an analog clock face"). The coarse-zone enum is the architecturally correct choice for vision extraction reliability. The ARCHITECTURE.md draft uses percentages (`number`), but the success criteria take precedence and align with STACK.md's constraints.

**Primary recommendation:** Create `src/lib/helix/rig-intent.ts` with four Zod schemas, inferred TypeScript types, and four export lines in `src/lib/helix/index.ts`. Estimated scope: ~60 lines. No new dependencies needed.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | 4.3.6 | Runtime schema validation + TypeScript type inference | Already installed; existing `ToneIntentSchema` pattern in `tone-intent.ts` sets the convention for this project |
| `typescript` | ^5.x | Strict type checking | Existing project standard; `strict: true` in tsconfig |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | Phase 17 requires no new packages | All tools already present |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `z.enum(["low","medium-low","medium-high","high"])` for knobPositions | `z.number().min(0).max(100)` | Number would be more flexible but violates the architecture's spatial reasoning constraint — LLMs cannot accurately estimate sub-10% rotary precision; enum zones are the correct contract for vision extraction |

**Installation:**
```bash
# No new packages — all dependencies already present
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/lib/helix/
├── rig-intent.ts       NEW — PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema
├── tone-intent.ts      UNCHANGED — reference pattern for schema style
├── types.ts            UNCHANGED
├── index.ts            MODIFIED — 4 new export lines for rig-intent types
└── [all others]        UNCHANGED
```

### Pattern 1: Zod Schema with Inferred TypeScript Types (Existing Project Convention)

**What:** Define the Zod schema as the source of truth; derive the TypeScript type via `z.infer<typeof Schema>`. Never hand-write a TypeScript interface that duplicates a schema.

**When to use:** Always — this is the established convention in `tone-intent.ts`.

**Example (from `src/lib/helix/tone-intent.ts`):**
```typescript
// Source: existing src/lib/helix/tone-intent.ts
import { z } from "zod";

export const SnapshotIntentSchema = z.object({
  name: z.string().max(10),
  toneRole: z.enum(["clean", "crunch", "lead", "ambient"]),
});

export type SnapshotIntent = z.infer<typeof SnapshotIntentSchema>;
```

### Pattern 2: z.record() in Zod v4 Requires Two Arguments

**What:** In Zod v4, `z.record(keySchema, valueSchema)` requires both arguments. The one-argument form `z.record(valueSchema)` from Zod v3 throws a runtime error in v4.

**When to use:** Any time a dictionary / map type is needed (e.g., `knobPositions`, `parameterMapping`).

**Example (verified against Zod 4.3.6):**
```typescript
// Source: verified at runtime against Zod 4.3.6 install
import { z } from "zod";

// CORRECT for Zod v4:
const knobPositions = z.record(
  z.string(),
  z.enum(["low", "medium-low", "medium-high", "high"])
);

const parameterMapping = z.record(z.string(), z.number());

// WRONG in Zod v4 (works in v3 only):
// const knobPositions = z.record(z.enum([...]));  // throws TypeError
```

### Pattern 3: Array Wrapper Schema

**What:** `SubstitutionMapSchema` is defined as `z.array(SubstitutionEntrySchema)`, making it a direct array wrapper — not an object with an array field.

**When to use:** When the downstream consumer (Phase 18 mapping layer) returns and validates a flat array of substitutions.

**Example:**
```typescript
// Source: verified against Zod 4.3.6, aligned with ARCHITECTURE.md
export const SubstitutionMapSchema = z.array(SubstitutionEntrySchema);
export type SubstitutionMap = z.infer<typeof SubstitutionMapSchema>;
```

### Pattern 4: Barrel Export Pattern (Existing Convention in index.ts)

**What:** All public types and schemas from `src/lib/helix/` are re-exported through `src/lib/helix/index.ts` using named exports. Both the schema (`export { FooSchema }`) and the type (`export type { Foo }`) are exported explicitly.

**When to use:** Always — maintains the existing convention visible in index.ts lines 10-11:
```typescript
export { ToneIntentSchema, EffectIntentSchema, SnapshotIntentSchema } from "./tone-intent";
export type { ToneIntent, EffectIntent, SnapshotIntent } from "./tone-intent";
```

### Anti-Patterns to Avoid

- **One-argument `z.record()` from Zod v3:** `z.record(z.string())` throws a TypeError in Zod v4. Always use `z.record(z.string(), valueSchema)`.
- **Adding rig fields to ToneIntentSchema:** ToneIntent is the AI output contract for Helix model selection. Rig/substitution data is a parallel concern. Keep them separate (verified in ARCHITECTURE.md Anti-Pattern 2).
- **Writing TypeScript interfaces instead of inferring from schema:** Duplicates the type definition and allows schema/type drift. Use `z.infer<typeof Schema>` exclusively.
- **Using `z.number().min(0).max(100)` for knobPositions:** Implies false precision. The vision extraction contract uses coarse zones — the enum is the correct type.
- **Exporting only the type, not the schema:** The schema is needed at runtime for `.parse()` validation. Export both: `export { Schema }` and `export type { InferredType }`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Runtime type checking of vision extraction output | Custom type guard functions | `RigIntentSchema.parse(raw)` | Zod throws `ZodError` with field-level detail; custom guards miss nested validation |
| TypeScript type from schema | Hand-written interface `PhysicalPedal { brand: string; ... }` | `z.infer<typeof PhysicalPedalSchema>` | Any change to the schema automatically updates the type; no synchronization needed |
| Enum membership checking | `if (['low','medium-low',...].includes(val))` | `z.enum(['low','medium-low','medium-high','high']).parse(val)` | Zod handles coercion, error messages, and TypeScript narrowing in one call |

**Key insight:** Zod schemas serve as both the TypeScript type source and the runtime validator. Building either separately defeats the purpose of using Zod.

---

## Common Pitfalls

### Pitfall 1: Zod v4 — z.record() One-Argument Form

**What goes wrong:** Developer writes `z.record(z.enum(["low","medium-low","medium-high","high"]))` (one argument, Zod v3 style) — TypeScript compiles fine but throws `TypeError: Cannot read properties of undefined (reading '_zod')` at runtime when the schema is evaluated.

**Why it happens:** Zod v4 changed the API. In v4, `z.record(valueSchema)` is not a recognized overload — both arguments are required.

**How to avoid:** Always write `z.record(z.string(), valueSchema)`. Verified correct form in this codebase:
```typescript
knobPositions: z.record(z.string(), z.enum(["low", "medium-low", "medium-high", "high"]))
parameterMapping: z.record(z.string(), z.number()).optional()
```

**Warning signs:** `TypeError` in server logs when any route imports from `rig-intent.ts`, even before any parsing is attempted (schema construction fails at import time).

### Pitfall 2: Missing `helixModelDisplayName` Field

**What goes wrong:** Developer copies the ARCHITECTURE.md `SubstitutionEntrySchema` draft which has `helixModel` but omits `helixModelDisplayName`. The success criteria explicitly require BOTH: `helixModel` (internal ID like `HD2_DistTeemah`) and `helixModelDisplayName` (human-readable like `Teemah!`). The substitution card UI (Phase 21) needs the display name separately.

**Why it happens:** ARCHITECTURE.md was written before the success criteria were finalized. The success criteria take precedence.

**How to avoid:** Include both fields in `SubstitutionEntrySchema`:
```typescript
helixModel: z.string(),             // Internal ID: "HD2_DistTeemah"
helixModelDisplayName: z.string(),  // Human name: "Teemah!"
```

**Warning signs:** Phase 21 (Substitution Card UI) implementation finds only `helixModel` in the type and has to work around missing display name.

### Pitfall 3: TypeScript Compiler Failure from Incorrect Import Path

**What goes wrong:** The new file imports from `"zod"` but the barrel export in `index.ts` uses a relative path like `"./rig-intent"`. If either uses wrong casing or extension (e.g., `"./rig-intent.ts"` with extension), TypeScript module resolution with `"moduleResolution": "bundler"` may fail.

**Why it happens:** The tsconfig uses `"moduleResolution": "bundler"` — this is Webpack/Vite-style resolution. Paths without extensions are resolved correctly; paths with `.ts` extensions are not standard in import statements.

**How to avoid:** Use extensionless relative paths in imports:
```typescript
// In index.ts — CORRECT
export { PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema } from "./rig-intent";
export type { PhysicalPedal, RigIntent, SubstitutionEntry, SubstitutionMap } from "./rig-intent";

// WRONG
export { ... } from "./rig-intent.ts";  // .ts extension in import is non-standard
```

**Warning signs:** `tsc --noEmit` reports module resolution errors on the new file.

### Pitfall 4: parameterMapping Optionality

**What goes wrong:** Developer marks `parameterMapping` as required. This breaks: (a) entries for pedals with no knob translation table in Phase 18, and (b) entries where the physical pedal is unknown and is being passed to the UI as an "approximate" match without parameter data.

**Why it happens:** The ARCHITECTURE.md schema sketch shows `parameterMapping` as a required field in one version. The success criteria say "optional."

**How to avoid:** Use `.optional()` on `parameterMapping`:
```typescript
parameterMapping: z.record(z.string(), z.number()).optional(),
```

---

## Code Examples

Verified patterns from official sources and live runtime testing:

### Complete rig-intent.ts File

```typescript
// Source: validated against Zod 4.3.6 at runtime; aligned with ARCHITECTURE.md and success criteria
// src/lib/helix/rig-intent.ts

import { z } from "zod";

// One physical pedal extracted from a user's photo
export const PhysicalPedalSchema = z.object({
  brand: z.string(),           // "Boss", "Ibanez", "Electro-Harmonix"
  model: z.string(),           // "SD-1", "TS9", "Big Muff Pi"
  fullName: z.string(),        // "Boss SD-1 Super OverDrive" — used as mapping lookup key
  knobPositions: z.record(
    z.string(),
    z.enum(["low", "medium-low", "medium-high", "high"])
  ),                           // { "Drive": "medium-high", "Tone": "medium-low" }
  imageIndex: z.number().int(), // Which image this came from (0-indexed)
  confidence: z.enum(["high", "medium", "low"]),
});

export type PhysicalPedal = z.infer<typeof PhysicalPedalSchema>;

// Full extracted rig — output of callRigVisionPlanner()
export const RigIntentSchema = z.object({
  pedals: z.array(PhysicalPedalSchema),
  rigDescription: z.string().optional(),   // Free-text rig description if user typed one
  extractionNotes: z.string().optional(),  // Claude's notes on ambiguities
});

export type RigIntent = z.infer<typeof RigIntentSchema>;

// One pedal substitution entry — what appears in the substitution card UI
export const SubstitutionEntrySchema = z.object({
  physicalPedal: z.string(),           // "TS9 Tube Screamer"
  helixModel: z.string(),              // Internal model ID: "HD2_DistTeemah"
  helixModelDisplayName: z.string(),   // Human-readable: "Teemah!"
  substitutionReason: z.string(),      // "Closest gain structure and mid-hump EQ character"
  parameterMapping: z.record(
    z.string(),
    z.number()
  ).optional(),                        // Helix param -> translated 0-1 value; absent if no translation
  confidence: z.enum(["direct", "close", "approximate"]),
  // direct = exact model exists in Helix
  // close = functionally equivalent, same circuit topology
  // approximate = closest available, different character
});

export type SubstitutionEntry = z.infer<typeof SubstitutionEntrySchema>;

// Full substitution result — array wrapper for the complete mapping output
export const SubstitutionMapSchema = z.array(SubstitutionEntrySchema);

export type SubstitutionMap = z.infer<typeof SubstitutionMapSchema>;
```

### index.ts Export Lines to Add

```typescript
// Source: matches existing export pattern on lines 10-11 of src/lib/helix/index.ts
// Add after the existing ToneIntent exports:

// Rig Emulation schemas (Phase 17)
export { PhysicalPedalSchema, RigIntentSchema, SubstitutionEntrySchema, SubstitutionMapSchema } from "./rig-intent";
export type { PhysicalPedal, RigIntent, SubstitutionEntry, SubstitutionMap } from "./rig-intent";
```

### Verifying TypeScript Compiles with Zero Errors

```bash
# Run from project root — must produce no output (zero errors)
npx tsc --noEmit
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Zod v3 `z.record(valueSchema)` — one argument | Zod v4 `z.record(keySchema, valueSchema)` — two arguments required | Zod v4.0.0 | Must use two-argument form; one-argument throws TypeError |
| Zod v3 `z.toJSON()` / no built-in JSON Schema export | Zod v4 `z.toJSONSchema(schema)` — built-in JSON Schema conversion | Zod v4.0.0 | Available if future phases need JSON Schema for AI structured output |
| TypeScript-first interface definitions | Schema-first with `z.infer` | v1.0 project decision | Enforced by existing `tone-intent.ts` convention |

**Deprecated/outdated:**
- `z.record(valueSchema)` one-argument form: valid in Zod v3, throws in Zod v4 — do not use
- Hand-written TypeScript interfaces alongside Zod schemas: against project convention — use `z.infer<typeof Schema>` only

---

## Open Questions

1. **knobPositions value type: enum vs number**
   - What we know: ARCHITECTURE.md draft used `z.number().min(0).max(100)` (percentage); success criteria specify `"low" | "medium-low" | "medium-high" | "high"`; STACK.md documents the LLM spatial reasoning limitation that motivates coarse zones
   - What's unclear: ARCHITECTURE.md and success criteria conflict on this one field
   - Recommendation: **Use the enum (success criteria take precedence, and the architectural rationale in STACK.md is strong)**. The coarse zone enum is what the vision API will actually return reliably.

2. **helixModelDisplayName: free string vs validated enum**
   - What we know: The success criteria say `helixModelDisplayName` (human-readable); ARCHITECTURE.md draft omits this field entirely
   - What's unclear: Whether to constrain it to a known enum of Helix display names
   - Recommendation: **Use `z.string()` (free string)**. Phase 18 (Pedal Mapping Engine) is the source of truth for valid display names — constraining the schema here would create a maintenance coupling between the type file and the mapping data file. A free string with the display name coming from the curated `PEDAL_HELIX_MAP` table is correct.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/lib/helix/tone-intent.ts` — established Zod schema pattern, `z.infer` usage, barrel export convention
- Existing codebase: `src/lib/helix/index.ts` — exact export pattern to follow for new rig-intent exports
- Existing codebase: `package.json` — confirmed Zod 4.3.6 is installed
- Runtime verification: All four schemas compiled and parsed against test data using `node -e` against the live Zod 4.3.6 install
- Runtime verification: `z.record()` two-argument requirement confirmed in Zod v4
- Runtime verification: `npx tsc --noEmit` confirms zero errors on current codebase

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — schema design decisions; note: `knobPositions` type discrepancy with success criteria resolved in favor of success criteria
- `.planning/research/STACK.md` — LLM spatial reasoning limitation justifying enum over number for knob zones

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Zod version confirmed from package.json; API verified at runtime
- Architecture: HIGH — file locations specified in ARCHITECTURE.md; patterns verified against existing codebase
- Pitfalls: HIGH — Zod v4 record API difference confirmed at runtime (throws TypeError with one arg); other pitfalls derived from success criteria review and ARCHITECTURE.md cross-check

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (Zod v4 API is stable; no fast-moving surface here)
