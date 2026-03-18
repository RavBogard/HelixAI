# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- Source files: `camelCase.ts` for utilities/functions, `PascalCase.tsx` for React components
- Test files: `*.test.ts` or `*.test.tsx` (co-located with source, not separate test directories)
- Configuration: lowercase with dashes (`eslint.config.mjs`, `vitest.config.ts`, `next.config.ts`)

**Functions:**
- camelCase: `hydrateVisualizerState()`, `buildGeminiJsonSchema()`, `extractControllerAssignments()`
- Exported functions use verb-first naming: `buildPlannerPrompt()`, `createGeminiClient()`, `getModelId()`
- Private/helper functions often prefixed with underscore for emphasis: `_normalizeInput()` (though not consistently enforced)
- Factory functions: `makeBlock()`, `makeTestBlocks()`, `makeRig()`, `makeSchema()`

**Variables:**
- camelCase for standard variables: `blockId`, `modelList`, `deviceTarget`, `presetSpec`
- UPPER_SNAKE_CASE for constants: `LOG_QUALITY`, `MAX_RETRIES`, `MODEL_STANDARD`, `FALLBACK_CONFIG`
- Prefixed flags for state: `isSelected`, `isLocked`, `isDragging`, `enabled`
- Plural for collections: `blocks`, `snapshots`, `warnings`, `results`, `families`

**Types:**
- PascalCase for type names: `BlockSpec`, `PresetSpec`, `SnapshotSpec`, `DeviceTarget`, `DeviceFamily`
- Interfaces and types use same naming convention: `interface BlockUIConfig`, `type DeviceFamily`
- Union types use discriminated union pattern: `type ChainChange = { type: "moved"; ... } | { type: "added"; ... }`
- Suffix convention: `*Spec` for data structures, `*Schema` for validation schemas, `*Intent` for user intentions

## Code Style

**Formatting:**
- ESLint + Next.js config (`eslint.config.mjs`): defines code standards
- Uses ESLint flat config (ESLint v9+)
- No Prettier config found; ESLint config enforces style

**Linting:**
- Tool: ESLint v9 with `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Configuration file: `/c/Users/dsbog/helixai/eslint.config.mjs`
- Run command: `npm run lint`

**Indentation and spacing:**
- 2-space indentation (inferred from codebase)
- Consistent spacing around operators and after keywords
- Curly brace style: same line (K&R style)

## Import Organization

**Order:**
1. External packages (React, third-party libraries): `import React from "react"`
2. Internal types/utilities: `import type { BlockSpec } from "@/lib/helix/types"`
3. Internal functions: `import { hydrateVisualizerState } from "./hydrate"`
4. Testing utilities: `import { describe, it, expect, vi } from "vitest"`

**Path Aliases:**
- Primary alias: `@/` points to `./src/` (defined in `tsconfig.json`)
- Absolute imports using `@/` throughout codebase
- Type imports separated: `import type { ... }` from `import { ... }`

**Example from `src/lib/planner.ts`:**
```typescript
import { createGeminiClient, getModelId } from "@/lib/gemini";
import {
  getToneIntentSchema,
  getModelListForPrompt,
  // ... other exports
} from "@/lib/helix";
import type { ToneIntent, DeviceTarget } from "@/lib/helix";
```

## Error Handling

**Patterns:**
- Explicit error throwing with `throw new Error("message")`
- Try-catch blocks for known failure points: JSON parsing, API calls, file operations
- Graceful fallbacks when possible: retries with `MAX_RETRIES` constant
- Error logging via `console.error()` before throwing

**Example from `src/lib/planner.ts`:**
```typescript
try {
  const result = JSON.parse(text);
  return result;
} catch (parseError) {
  console.error("JSON PARSE FAILED. RAW TEXT:", text);
  // ... retry or fallback logic
}
```

**Validation:**
- Zod schemas for request validation: `z.object({ ... }).safeParse(jsonBody)`
- Early return on validation failure with detailed error response
- Schema definitions: `const chatRequestSchema = z.object({ ... })`

## Logging

**Framework:** `console` methods only

**Patterns:**
- `console.log()`: informational messages, data flow tracing
- `console.error()`: error conditions, failures requiring attention
- `console.warn()`: warnings, quality issues, degraded functionality
- Structured logging via dedicated functions: `logUsage()`, `logQualityWarnings()`

**Modules with custom logging:**
- `src/lib/usage-logger.ts`: tracks API costs and token usage
- `src/lib/helix/quality-logger.ts`: logs quality warnings to JSON-lines file
- Pattern: Check environment variable (`LOG_QUALITY`, `LOG_USAGE`) before writing files

**Example from `src/lib/helix/quality-logger.ts`:**
```typescript
if (warnings.length > 0) {
  const codes = warnings.map((w) => w.code).join(", ");
  console.warn(
    `[quality] ${context.device}/${context.presetName}: ${warnings.length} warning(s): ${codes}`
  );
}

if (process.env.LOG_QUALITY !== "true") return;
// File logging only when enabled
```

## Comments

**When to Comment:**
- File-level comments: describe module purpose and phase/plan reference
- Section headers: dashed lines with comment blocks to separate logical sections
- Complex algorithms: explain the "why" not the "what"
- TODO/FIXME comments mark incomplete work (not systematically tracked)

**JSDoc/TSDoc:**
- Minimal usage; not enforced across codebase
- Used selectively for exported functions with complex signatures
- Example from `src/lib/helix/quality-logger.ts`:
```typescript
/**
 * Log quality warnings to console and optionally to a JSON-lines file.
 *
 * Always calls console.warn when warnings.length > 0.
 * JSON-lines file logging gated by process.env.LOG_QUALITY === "true".
 *
 * @param warnings - Array of quality warnings from validatePresetQuality()
 * @param context - Device and preset name for the log record
 * @param logPath - Override log file path (default: quality.jsonl in process.cwd())
 */
```

**Section Headers:**
```typescript
// ---------------------------------------------------------------------------
// Block ID generation
// ---------------------------------------------------------------------------
```
Used consistently to organize code into logical sections within files.

## Function Design

**Size:** Generally 5-50 lines; complex functions broken into smaller helpers within same file

**Parameters:**
- Destructured object parameters for functions with 3+ arguments
- Type annotations required (strict TypeScript mode)
- Optional parameters using `?` and default values

**Example from `src/lib/visualizer/hydrate.ts`:**
```typescript
export function hydrateVisualizerState(
  presetSpec: PresetSpec,
  device: DeviceTarget,
  controllerAssignments?: ControllerAssignment[],
  footswitchAssignments?: FootswitchAssignment[],
): PreviewResult
```

**Return Values:**
- Always typed explicitly
- Use union types for multiple possible return shapes
- Null used sparingly; prefer empty objects or arrays for optional collections

## Module Design

**Exports:**
- Mix of named exports and default exports
- Prefer named exports for utilities and types
- Barrel files (`index.ts`) used to group related exports

**Example from `src/lib/helix/index.ts`:**
```typescript
export { getToneIntentSchema, getModelListForPrompt } from "./schema-extractor";
export type { DeviceFamily, ToneIntent } from "./types";
```

**Barrel Files:**
- Located at: `src/lib/helix/index.ts`, `src/lib/families/*/index.ts`
- Purpose: Group logical units of functionality
- Not used in `src/lib/visualizer/` — imports are direct

**File Organization:**
- Utilities grouped by domain: `src/lib/helix/`, `src/lib/visualizer/`, `src/lib/families/`
- Related functions kept in same file even if file grows to 500+ lines
- Tests co-located: `*.test.ts` next to source

## TypeScript

**Strict Mode:** Enabled (`"strict": true` in `tsconfig.json`)

**Type Usage:**
- Explicit type annotations on function parameters and returns
- `type` keyword preferred over `interface` for discriminated unions
- Import types with `import type { ... }` syntax
- No `any` type; use generics or union types instead

## React/Component Conventions

**Naming:**
- Component files: `PascalCase.tsx`
- Props interfaces: `{ComponentName}Props`
- Exported as default or named: both patterns used

**Hooks:**
- Zustand stores: `useVisualizerStore()`, `useOtherState()`
- Custom hooks: `useCompilerWorker()`, `useVisualizerStore()`
- Following React convention: `use*` prefix for all hooks

---

*Convention analysis: 2026-03-18*
