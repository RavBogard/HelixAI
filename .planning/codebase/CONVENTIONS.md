# Coding Conventions

**Analysis Date:** 2026-03-02

## Naming Patterns

**Files:**
- Lowercase with hyphens for word separation: `chain-rules.ts`, `param-engine.ts`, `rig-mapping.ts`
- Test files use `.test.ts` suffix: `chain-rules.test.ts`, `param-engine.test.ts`
- Module/interface definition files use descriptive singular or plural: `types.ts`, `models.ts`, `tone-intent.ts`

**Functions:**
- camelCase for all functions: `assembleSignalChain()`, `resolveParameters()`, `buildSnapshots()`, `validatePresetSpec()`, `lookupPedal()`
- Action verbs for function prefixes: `assemble`, `resolve`, `build`, `validate`, `create`, `get`
- Helper functions in tests use `make` or `clean`/`highGain` patterns: `cleanIntent()`, `makeBlock()`, `highGainIntent()`, `buildChain()`

**Variables:**
- camelCase for all variables: `blockSpec`, `modelId`, `ampName`, `motorCabName`
- Lowercase constants with underscores for module-level lookup tables: `MINOTAUR`, `SCREAM_808`, `PARAMETRIC_EQ`, `MAX_BLOCKS_PER_DSP`
- UPPERCASE_WITH_UNDERSCORES for semantic constants: `VALID_IDS`, `AMP_DEFAULTS`, `TOPOLOGY_MID`, `CAB_PARAMS`, `EQ_PARAMS`, `PEDAL_HELIX_MAP`

**Types:**
- PascalCase for all types: `BlockSpec`, `ToneIntent`, `PresetSpec`, `HlxFile`, `SnapshotSpec`
- Descriptive suffixes: `Intent` for user input types, `Spec` for intermediate/output specs, `Model` for catalog entries

## Code Style

**Formatting:**
- ESLint with Next.js preset (`eslint-config-next`)
- Configured via `eslint.config.mjs` using flat config format
- Includes core-web-vitals and TypeScript rules

**Linting:**
- Tool: ESLint 9 with Next.js core web vitals configuration
- TypeScript strict mode enabled in `tsconfig.json`
- Key compiler options: `strict: true`, `noEmit: true`, `isolatedModules: true`

## Import Organization

**Order:**
1. Node/external libraries (e.g., `import { defineConfig } from "vitest/config"`)
2. Type imports: `import type { ToneIntent } from "./tone-intent"`
3. Named value imports: `import { assembleSignalChain } from "./chain-rules"`
4. Relative imports (local modules)

**Path Aliases:**
- Single alias used: `@/*` maps to `./src/*` per `tsconfig.json`
- Applied consistently in source code: `import { createGeminiClient } from "@/lib/gemini"`
- **Convention in test files:** Tests use relative imports only, NOT `@/` aliases (noted as "project convention" in `src/lib/rig-mapping.test.ts`)

## Error Handling

**Patterns:**
- Throw descriptive errors with context: `throw new Error("PresetSpec has empty signal chain")`
- Error messages are lowercase sentence fragments: `"unknown amp model"`, `"DSP0 block limit exceeded: ${dsp0Count} non-cab blocks, max 8"`
- Validation functions throw immediately on structural errors rather than auto-correcting: `validatePresetSpec()` enforces strict rules
- Separate functions for strict validation vs. auto-fixing: `validatePresetSpec()` (strict) vs `validateAndFixPresetSpec()` (lenient with fixes)
- Catch blocks convert error to message: `const message = error instanceof Error ? error.message : "Unknown error"`
- Console.warn used for auto-correction notifications: `console.warn(`[validate] Cab block has LowCut=${value}...`)`

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- Use `console.warn()` when auto-correcting values: `console.warn(`[validate] ...`)`
- Prefix warning messages with `[context]` for clarity
- No `console.log()` found in production code—only validation/debug warnings

## Comments

**When to Comment:**
- File headers with module purpose: `// chain-rules.ts — Signal chain assembly module`
- Section headers with dashes: `// ---------------------------------------------------------------------------`
- Semantic explanations of WHY, not WHAT: Comments explain intent, not code behavior
- Inline explanations for lookup tables: `// Amp parameter overrides per category — applied on top of model defaults.`
- Test section separators: `// Test 1: ...`, `// Test 2: ...`

**JSDoc/TSDoc:**
- Used sparingly, primarily for public API functions in `validate.ts`
- Example: `/** Strict validation that throws on structural errors ... */`
- Document parameters and return types: `@param device - Optional device target for device-specific validation rules`

## Function Design

**Size:** Functions range from 5–50 lines; most are 15–25 lines

**Parameters:**
- Named parameters via object destructuring when 2+ parameters: `function validatePresetSpec(spec: PresetSpec, device?: DeviceTarget)`
- Helper functions accept overrides object: `function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent`
- Partial types used for builder/test helpers to allow selective overrides

**Return Values:**
- Explicit types on all functions
- Pure functions preferred (no mutations): `resolveParameters()` returns new BlockSpec[] without mutating input
- Use `ValidationResult` interface for complex return types: `{ valid: boolean; errors: string[]; fixed: boolean; fixedSpec?: PresetSpec }`

## Module Design

**Exports:**
- Named exports for individual functions: `export function validatePresetSpec(...)`
- Default export for configs: `export default defineConfig(...)`
- Re-export convenience: `export * from "./models"` not used; specific imports instead

**Barrel Files:**
- `src/lib/helix/index.ts` imports from other helix modules but not demonstrated in samples
- Main library exports via specific imports

**File Organization Pattern:**
- Module header comments (purpose + public API)
- Constants section with clear spacing
- Helper functions/types section
- Main export function(s)
- Tests in parallel `.test.ts` files

## Type Strictness

**Pattern:**
- No `any` types in samples
- Explicit `type` imports: `import type { BlockSpec }`
- Discriminated unions used: `type BlockType = "amp" | "cab" | "delay" | "reverb" | "modulation" | "dynamics" | "eq" | "distortion" | "wah" | "volume"`
- `Partial<T>` for flexible builder helpers
- `Record<K, V>` for lookup tables: `Record<AmpCategory, Record<string, number>>`

## Array/Object Handling

**Patterns:**
- Immutable operations preferred: `.filter()`, `.map()` rather than mutations
- Spread operator for shallow copies: `{ ...block, parameters: {} }`
- `Object.entries()` for iteration: `for (const [key, value] of Object.entries(block.parameters))`
- `new Set<T>()` for uniqueness: `const ids = new Set<string>()`

---

*Convention analysis: 2026-03-02*
