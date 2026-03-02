# Testing Patterns

**Analysis Date:** 2026-03-02

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`
- Environment: Node.js

**Assertion Library:**
- Vitest built-in (uses expect from vitest)

**Run Commands:**
```bash
npm test                 # Not shown in package.json; vitest assumed as test script
npm run vitest          # Not exposed; project uses vitest directly
vitest                  # Run all tests (via npx vitest or package.json alias)
vitest --watch          # Watch mode
vitest --coverage       # Coverage report
```

## Test File Organization

**Location:**
- Co-located with source files using `.test.ts` suffix
- Examples: `src/lib/helix/chain-rules.test.ts` alongside `src/lib/helix/chain-rules.ts`
- Tests in parallel directory structure

**Naming:**
- Strict pattern: `[module].test.ts` where module name matches source file exactly
- Examples: `chain-rules.test.ts`, `param-engine.test.ts`, `snapshot-engine.test.ts`, `rig-mapping.test.ts`

**Structure:**
```
src/lib/helix/
├── chain-rules.ts
├── chain-rules.test.ts
├── param-engine.ts
├── param-engine.test.ts
├── snapshot-engine.ts
├── snapshot-engine.test.ts
└── orchestration.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// File header: describes module purpose
// TDD RED phase: These tests define the expected behavior of assembleSignalChain()

import { describe, it, expect } from "vitest";
import { assembleSignalChain } from "./chain-rules";
import type { ToneIntent } from "./tone-intent";

// Helper section: Factory functions for creating test fixtures
function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      // ...
    ],
    ...overrides,
  };
}

// Main describe block with consistent naming
describe("assembleSignalChain", () => {
  it("returns blocks in order: boost > amp > cab > EQ > gain block", () => {
    const chain = assembleSignalChain(cleanIntent());
    const names = chain.map((b) => b.modelName);
    expect(names).toEqual(["Minotaur", "US Deluxe Nrm", ...]);
  });
});
```

**Patterns:**
- Setup: Test fixtures created via helper functions that accept partial overrides
- Teardown: None required; tests are stateless
- Assertion: Direct use of vitest `expect()` API with chainable matchers
- Describe blocks use function name being tested: `describe("assembleSignalChain", ...)`
- Test names are full sentences describing the assertion: `"returns blocks in order: boost > amp > cab > EQ > gain block"`

## Mocking

**Framework:** None detected in project

**Patterns:**
- No mocking used in helix tests; all tests use real data and fixtures
- Fixtures created via factory functions: `cleanIntent()`, `highGainIntent()`, `makeBlock()`
- Tests are pure unit tests with no external dependencies

**What to Mock:**
- Not applicable; project uses deterministic fixtures instead

**What NOT to Mock:**
- All functions are tested with real data structures
- Test data uses actual model names from the catalog

## Fixtures and Factories

**Test Data:**
```typescript
// Helper: minimal clean ToneIntent
function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent {
  return {
    ampName: "US Deluxe Nrm",
    cabName: "1x12 US Deluxe",
    guitarType: "single_coil",
    effects: [],
    snapshots: [
      { name: "Clean", toneRole: "clean" },
      { name: "Rhythm", toneRole: "crunch" },
      { name: "Lead", toneRole: "lead" },
      { name: "Ambient", toneRole: "ambient" },
    ],
    ...overrides,
  };
}

// Helper: create a minimal BlockSpec
function makeBlock(overrides: Partial<BlockSpec>): BlockSpec {
  return {
    type: "amp",
    modelId: "HD2_AmpUSDeluxeNrm",
    modelName: "US Deluxe Nrm",
    dsp: 0,
    position: 0,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,
  };
}
```

**Location:**
- Defined at top of each test file, immediately after imports
- Named with domain prefix: `cleanIntent()`, `highGainIntent()`, `crunchIntent()`, `makeBlock()`, `makeIntent()`
- Factory pattern: Functions return complete objects with sensible defaults, allow selective override

## Coverage

**Requirements:** None enforced in package.json

**View Coverage:**
```bash
vitest --coverage
```

Coverage not mentioned in project—no thresholds or CI gates detected.

## Test Types

**Unit Tests:**
- **Scope:** Single function behavior in isolation
- **Approach:** Use factory functions to create inputs, call function, assert output properties
- **Example:** `chain-rules.test.ts` tests `assembleSignalChain()` with various amp categories and effect combinations
- **Pattern:** Test single responsibility; one logical assertion per test
- Examples:
  - `"returns blocks in order: boost > amp > cab > EQ > gain block for clean amp with no effects"`
  - `"throws error for unknown amp name"`
  - `"does not duplicate Minotaur if already in effects list"`

**Integration Tests:**
- **Scope:** Multiple modules working together through the pipeline
- **Approach:** `orchestration.test.ts` tests full pipeline: `assembleSignalChain` → `resolveParameters` → `buildSnapshots` → `buildHlxFile` → `validatePresetSpec`
- **Pattern:** Build complete intent → run through full stack → validate output structure
- Example: `"full pipeline produces valid .hlx JSON structure with correct top-level fields"`

**E2E Tests:**
- **Framework:** Not used
- **Approach:** Not applicable; project focuses on unit and integration tests
- **Note:** Orchestration tests serve as integration tests covering end-to-end pipeline

## Common Patterns

**Async Testing:**
```typescript
// No async patterns detected in test files
// All functions are synchronous
// async/await not used in vitest suites
```

**Error Testing:**
```typescript
// Pattern 1: Throw with specific message
it("throws error for unknown amp name", () => {
  expect(() =>
    assembleSignalChain(cleanIntent({ ampName: "NonExistent Amp" }))
  ).toThrow(/unknown amp model/i);
});

// Pattern 2: Specific error message matching via regex
it("throws a clear error message when DSP0 block limit would be exceeded", () => {
  expect(() =>
    assembleSignalChain(cleanIntent({ effects: [...] }))
  ).toThrow(/DSP0 block limit exceeded.*non-cab blocks.*max 8/);
});

// Pattern 3: Validate error message content
try {
  assembleSignalChain(intent);
  expect.fail("Should have thrown");
} catch (e) {
  expect(e.message).toContain("unknown");
}
```

**Range Testing:**
```typescript
// Test numeric ranges with toBeGreaterThanOrEqual/toBeLessThanOrEqual
it("sets clean amp Drive 0.20-0.30, Master 0.90-1.00, SAG 0.50-0.70", () => {
  const result = resolveParameters(chain, intent);
  const amp = result[0];

  expect(amp.parameters.Drive).toBeGreaterThanOrEqual(0.20);
  expect(amp.parameters.Drive).toBeLessThanOrEqual(0.30);
  expect(amp.parameters.Master).toBeGreaterThanOrEqual(0.90);
  expect(amp.parameters.Master).toBeLessThanOrEqual(1.00);
});
```

**Array/Collection Testing:**
```typescript
// Pattern: Array length, element order, element properties
it("returns blocks in order: boost > amp > cab > EQ > gain block", () => {
  const chain = assembleSignalChain(cleanIntent());

  // Test array order
  const names = chain.map((b) => b.modelName);
  expect(names).toEqual([
    "Minotaur",
    "US Deluxe Nrm",
    "1x12 US Deluxe",
    "Parametric EQ",
    "Gain Block",
  ]);

  // Test array length
  expect(minotaurBlocks).toHaveLength(1);

  // Test subset filtering
  const dsp0Blocks = chain.filter((b) => b.dsp === 0);
  expect(dsp0Blocks.map((b) => b.modelName)).toEqual([...]);
});
```

**Immutability Testing:**
```typescript
it("returns a new BlockSpec array without mutating the input", () => {
  const original: BlockSpec[] = [makeBlock(...)];
  const originalParams = { ...original[0].parameters };
  const result = resolveParameters(original, intent);

  // Result should be a different array
  expect(result).not.toBe(original);
  // Original block parameters should not be mutated
  expect(original[0].parameters).toEqual(originalParams);
  // Result block should be a different object
  expect(result[0]).not.toBe(original[0]);
});
```

**Property Existence Testing:**
```typescript
it("uses Gain/Treble/Output param names for Minotaur (not Drive/Tone)", () => {
  const result = resolveParameters(chain, intent);
  const boost = result[0];

  expect(boost.parameters).toHaveProperty("Gain");
  expect(boost.parameters).toHaveProperty("Treble");
  expect(boost.parameters).toHaveProperty("Output");
  expect(boost.parameters).not.toHaveProperty("Drive");
  expect(boost.parameters).not.toHaveProperty("Tone");
});
```

**Loop Testing Pattern:**
```typescript
it("all blocks have path: 0", () => {
  const chain = assembleSignalChain(cleanIntent({...}));

  for (const block of chain) {
    expect(block.path).toBe(0);
  }
});
```

## Test Documentation

**Comments in Tests:**
- Section headers with dashes: `// ---------------------------------------------------------------------------`
- Test numbering: `// Test 1:`, `// Test 2:`, etc.
- Purpose statements: `// TDD RED: These tests define the expected behavior...`
- Comment headers: `/** Minimal clean ToneIntent */`

**Test File Headers:**
```typescript
// src/lib/helix/chain-rules.test.ts — Signal chain assembly tests
// TDD RED phase: These tests define the expected behavior of assembleSignalChain()
```

**Helper Documentation:**
```typescript
// Helper: minimal clean ToneIntent
function cleanIntent(overrides: Partial<ToneIntent> = {}): ToneIntent { ... }

// Helper: minimal high-gain ToneIntent
function highGainIntent(overrides: Partial<ToneIntent> = {}): ToneIntent { ... }
```

---

*Testing analysis: 2026-03-02*
