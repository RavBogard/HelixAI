# Coding Conventions

**Analysis Date:** 2026-03-01

## Naming Patterns

**Files:**
- Lowercase with dashes for multi-word names: `preset-builder.ts`, `route.ts`
- API route files use `route.ts` convention (Next.js standard): `src/app/api/chat/route.ts`, `src/app/api/generate/route.ts`
- Index files as barrel exports: `src/lib/helix/index.ts`

**Functions:**
- camelCase for all functions and async handlers
- Descriptive verb-noun pairs: `buildHlxFile()`, `validateAndFixPresetSpec()`, `summarizePreset()`, `generateWithProvider()`
- Private/internal functions prefixed with underscore rarely used; instead use nested functions or grouping with comments

**Variables:**
- camelCase for all variables and parameters
- Boolean variables prefixed with is/has: `isStreaming`, `isGenerating`, `readyToGenerate`, `premiumKey`
- State hook variables use clear names: `messages`, `input`, `selectedProviders`, `generatedResults`

**Types and Interfaces:**
- PascalCase for all interfaces and types: `ProviderConfig`, `HlxFile`, `PresetSpec`, `BlockSpec`
- Interface properties use camelCase
- Const objects for enums/mappings use UPPER_SNAKE_CASE: `PROVIDERS`, `BLOCK_TYPES`, `CONTROLLERS`, `LED_COLORS`, `STOMP_BLOCK_TYPES`

**Constants:**
- UPPER_SNAKE_CASE for constants and readonly config: `HLX_VERSION`, `HELIX_LT_DEVICE_ID`, `MODEL_STANDARD`, `MODEL_PREMIUM`
- Model IDs use HD2_ prefix per Line 6 convention: `HD2_AmpUSDeluxeNrm`, `HD2_AppDSPFlow1Input`

## Code Style

**Formatting:**
- ESLint configured via `eslint.config.mjs` extending Next.js core-web-vitals and TypeScript rules
- Run with: `npm run lint`
- Strict TypeScript enabled in `tsconfig.json`
- No explicit Prettier config; relies on ESLint defaults

**Linting:**
- ESLint 9 with `eslint-config-next` for Next.js conventions
- Enforces best practices for React (via `eslint-config-next/typescript`)
- Strict type checking: `noEmit: true`, `isolatedModules: true`

## Import Organization

**Order:**
1. External dependencies (React, Next.js, third-party libraries)
2. Internal path alias imports (`@/lib/...`, `@/app/...`)
3. Type imports using `type` keyword for types-only imports

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Always use `@/lib/...` for library files
- Always use `@/app/...` for app layer files

**Example from codebase:**
```typescript
// src/app/api/chat/route.ts
import { NextRequest } from "next/server";
import { createGeminiClient, getSystemPrompt, getModelId, isPremiumKey } from "@/lib/gemini";
```

```typescript
// src/app/page.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
```

**Barrel Exports:**
- Use barrel files (`index.ts`) to export public APIs: `src/lib/helix/index.ts` exports all Helix utilities
- Separate type exports from function exports with `export type { ... }`

## Error Handling

**Patterns:**
- Use `try/catch` for async operations and JSON parsing
- Always check error type: `error instanceof Error ? error.message : "Unknown error"`
- API routes return `NextResponse.json()` with appropriate status codes
- Client-side: catch errors in async functions and set error state for UI display
- Fallback behavior when APIs fail gracefully (e.g., default to fallback provider)

**Examples:**
```typescript
// API error handling
try {
  const res = await fetch("/api/chat", { ... });
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  // ... process response
} catch (err) {
  const message = err instanceof Error ? err.message : "Something went wrong";
  setError(message);
}
```

```typescript
// JSON parsing with fallback
try {
  presetSpec = JSON.parse(jsonText);
} catch {
  // Handle markdown code fences from some providers
  const fenceMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : jsonText.trim();
  presetSpec = JSON.parse(cleaned);
}
```

**Console Usage:**
- `console.warn()` for validation warnings with context: `console.warn(`[${provider.name}] Validation issues:`, validation.errors)`
- `console.error()` for serious failures with context: `console.error("Preset generation error:", message)`
- Use prefixes like `[ProviderName]` in messages for context

## Logging

**Framework:** Native console (no logging library)

**Patterns:**
- Server-side (Route handlers): Use `console.warn()` and `console.error()`
- Client-side: Use `console.warn()` for non-fatal issues only
- Always include provider/context information in log messages
- Example: `console.warn(`[${provider.name}] Validation issues:`, validation.errors)`

## Comments

**When to Comment:**
- Comment complex algorithms or non-obvious business logic
- Comment workarounds and why they exist (not just what)
- Use inline comments sparingly; code should be self-documenting via clear naming
- Comment tradeoffs and decisions (especially in validation/fixing logic)

**JSDoc/TSDoc:**
- Used for public API functions
- Document parameters and return types in complex cases
- Example from codebase:
```typescript
/**
 * Auto-assign effect blocks to stomp footswitches (FS5-FS8).
 * Amps, cabs, and EQ are typically "always on" so they're skipped.
 * This gives the user a Snap/Stomp layout:
 *   Bottom row: Snapshots 1-4
 *   Top row: Stomp switches for individual effects
 */
function buildFootswitchSection(allBlocks: BlockSpec[]): Record<string, unknown>
```

## Function Design

**Size:**
- Keep functions focused on single responsibility
- Range typically 30-100 lines for complex logic
- Example: `buildHlxFile()` is 33 lines and handles file structure only
- Support functions like `buildDsp()` are 82 lines handling DSP-specific logic

**Parameters:**
- Use typed parameters (no `any`)
- Prefer explicit parameters over large config objects for clarity
- Use function overloading rarely; prefer separate functions

**Return Values:**
- Always type return values explicitly
- Return structured objects with clear properties rather than tuples
- Example: `ValidationResult` interface documents all possible return states
```typescript
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  fixed: boolean;
  fixedSpec?: PresetSpec;
}
```

## Module Design

**Exports:**
- Barrel files export both functions and types
- Types exported with `export type { ... }` syntax
- Functions exported normally with `export function`

**Example from `src/lib/helix/index.ts`:**
```typescript
export { buildHlxFile, summarizePreset } from "./preset-builder";
export { getModelListForPrompt, getAllModels, LED_COLORS } from "./models";
export { validateAndFixPresetSpec } from "./validate";
export type { PresetSpec, BlockSpec, SnapshotSpec, HlxFile } from "./types";
```

**Barrel Files:**
- Used to group related functionality: `src/lib/helix/` exports all Helix utilities
- Simplify imports: `import { buildHlxFile, validateAndFixPresetSpec } from "@/lib/helix"`

## TypeScript Patterns

**Strict Mode:**
- Strict mode enabled: all variables must be explicitly typed
- No implicit any
- Use `Record<string, T>` for dynamic object maps
- Use discriminated unions for complex state (example: `ProviderResult` with optional fields)

**Type Safety:**
- Interfaces for configuration and specification objects: `ProviderConfig`, `PresetSpec`
- Use `readonly` for immutable constants
- Use generic types sparingly; prefer concrete types for clarity

## UI/Component Patterns

**React Hooks:**
- Standard hooks: `useState`, `useRef`, `useEffect`, `useCallback`
- Custom hooks: None detected; logic kept in page component
- Effect cleanup: Not extensively used; focus on side effects only

**State Management:**
- React state for local UI state: messages, input, loading flags
- No external state management library
- Separate state for different concerns: `isStreaming`, `isGenerating`, `error`, `selectedProviders`

**Event Handlers:**
- Named functions for button handlers: `toggleProvider()`, `sendMessage()`, `generatePreset()`, `downloadPreset()`
- Arrow functions for inline callbacks in event bindings
- Keyboard handling for textarea: `handleKeyDown()` with shift+enter support

---

*Convention analysis: 2026-03-01*
