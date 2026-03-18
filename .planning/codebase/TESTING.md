# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- Vitest v4.0.18 - Fast unit test runner with Jest-compatible API
- Config: `/c/Users/dsbog/helixai/vitest.config.ts`
- Environment: jsdom (browser simulation for DOM and React testing)

**Assertion Library:**
- Vitest built-in `expect()` API (Jest-compatible)
- React Testing Library for component tests

**Run Commands:**
```bash
npm run test              # Run all tests once
npm run test:watch       # Watch mode with hot reload
npm run test:coverage    # Generate coverage report
```

## Test File Organization

**Location:**
- Co-located with source files (next to implementation, not separate `/tests` directory)
- Pattern: `ComponentName.tsx` → `ComponentName.test.tsx` in same directory
- Pattern: `utility.ts` → `utility.test.ts` in same directory

**Naming:**
- `.test.ts` for unit tests of TypeScript files
- `.test.tsx` for React component tests
- No `.spec.ts` pattern found; only `.test.*` convention used

**Test Count:**
- 52 test files found across codebase
- Distributed across: `src/components/visualizer/`, `src/lib/`, `src/lib/helix/`, `src/lib/visualizer/`, `src/lib/families/`
- Example test files:
  - `src/components/visualizer/BlockTile.test.tsx` (6+ test suites)
  - `src/lib/helix/audit-runner.test.ts` (multiple describe blocks)
  - `src/lib/visualizer/store.test.ts` (80+ tests)
  - `src/lib/visualizer/hydrate.test.ts` (comprehensive transformation tests)

## Test Structure

**Suite Organization:**

```typescript
// Standard structure from src/components/visualizer/BlockTile.test.tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Comment block with phase reference
// Phase 79-02: onRemove and isDragging props
// --------------------------------------------------

describe("BlockTile", () => {
  // Nested describes for feature grouping
  describe("blockstates", () => {
    it("bypassed block (enabled=false) has opacity-40 class", () => {
      // test body
    });
  });
});
```

**Patterns:**
- Top-level `describe()` per component/module/function
- Nested `describe()` for feature areas (e.g., "blockstates", "Phase 79-02: onRemove")
- Phase/plan references in comments for traceability
- Helper section at top: `function makeBlock()`, `function makeTestSnapshots()`
- Test body immediately follows `it()` without extra nesting

**Test Body Structure:**
```typescript
it("description of what it tests", () => {
  // Arrange: Set up test data and mocks
  const block = makeBlock();
  const onSelect = vi.fn();

  // Act: Execute the code being tested
  render(
    <BlockTile
      block={block}
      blockId="delay2"
      enabled={true}
      isSelected={false}
      onSelect={onSelect}
    />
  );

  // Assert: Verify results
  expect(onSelect).toHaveBeenCalledWith("delay2");
});
```

## Mocking

**Framework:** Vitest's `vi` object (built-in, no extra package needed)

**Patterns:**

Module mocking with `vi.mock()`:
```typescript
// From src/components/visualizer/DownloadButton.test.tsx
const mockCalculateStateDiff = vi.fn();
vi.mock("@/lib/visualizer/state-diff", () => ({
  calculateStateDiff: mockCalculateStateDiff,
}));

const mockCompilePreset = vi.fn();
vi.mock("@/lib/visualizer/use-compiler-worker", () => ({
  useCompilerWorker: () => ({ compilePreset: mockCompilePreset }),
}));
```

Function mocking with `vi.fn()`:
```typescript
const onSelect = vi.fn();
const onRemove = vi.fn();
render(<BlockTile {...props} onSelect={onSelect} onRemove={onRemove} />);
```

Mock return values:
```typescript
mockCalculateStateDiff.mockReturnValue({
  hasChanges: true,
  chainChanges: [],
  modelSwaps: [],
  snapshotChanges: [],
});

mockCompilePreset.mockResolvedValue("data:audio/wav;base64,...");
```

Mock reset pattern:
```typescript
beforeEach(() => {
  mockCalculateStateDiff.mockReset();
  mockFetch.mockReset();
});
```

**What to Mock:**
- External module dependencies: state-diff, compiler worker, fetch
- Callback functions passed as props: `onSelect`, `onRemove`, callbacks
- File I/O operations: fs.appendFileSync mocked in logger tests
- Global browser APIs: fetch (when needed)

**What NOT to Mock:**
- Pure utility functions used internally
- Data transformation functions (like `hydrateVisualizerState()`)
- Schema definitions and registries
- Internal helper functions within the module under test

## Fixtures and Factories

**Test Data:**

Factory functions convention:
```typescript
// From src/lib/visualizer/store.test.ts
function makeTestBlocks(): BlockSpec[] {
  return [
    {
      _id: "amp0",
      type: "amp",
      modelId: "US Double Nrm",
      modelName: "US Double Nrm",
      dsp: 0,
      position: 0,
      path: 0,
      enabled: true,
      stereo: false,
      parameters: { Drive: 0.5, Bass: 0.6 },
    },
    // ... additional blocks
  ];
}

function makeTestSnapshots(): SnapshotSpec[] {
  return [
    {
      name: "Clean",
      description: "Clean tone",
      ledColor: 1,
      blockStates: { amp0: true, delay2: false },
      parameterOverrides: { amp0: { Drive: 0.3 } },
    },
    // ... additional snapshots
  ];
}

// Usage with overrides pattern
function makeBlock(overrides: Partial<BlockSpec> = {}): BlockSpec {
  return {
    type: "delay",
    modelId: "HD2_DelaySimpleDelay",
    modelName: "Simple Delay",
    dsp: 0,
    position: 2,
    path: 0,
    enabled: true,
    stereo: false,
    parameters: {},
    ...overrides,  // Allow test-specific customization
  };
}
```

**Location:**
- Defined directly in test files, not separate fixtures directory
- Factory functions at top of test file after imports, before describe blocks
- Multiple maker functions for different entity types: `makeBlock()`, `makeSnapshot()`, `makeSchema()`, `makeRig()`

## Setup and Teardown

**beforeEach Pattern:**
```typescript
// From src/components/visualizer/DownloadButton.test.tsx
beforeEach(() => {
  mockCalculateStateDiff.mockReset();
  mockFetch.mockReset();
  global.fetch = mockFetch;
});
```

**afterEach Pattern:**
```typescript
// From src/components/visualizer/BlockTile.test.tsx
import { cleanup } from "@testing-library/react";
afterEach(cleanup);  // Always clean up DOM after React component tests
```

**beforeAll/afterAll:**
- Not commonly used in codebase
- Prefer beforeEach/afterEach for isolation

## Coverage

**Requirements:** Not enforced; no coverage threshold in vitest config

**View Coverage:**
```bash
npm run test:coverage
```
- Generates coverage report after test run
- Results shown in console and HTML report

## Test Types

**Unit Tests:**
- Scope: Individual functions, pure transformations, pure components
- Approach: No external dependencies (mocked or eliminated)
- Examples: `src/lib/visualizer/state-diff.test.ts`, `src/lib/helix/quality-validate.test.ts`
- Assertion style: Direct value checks, no browser/DOM state

**Integration Tests:**
- Scope: Multiple modules working together, state management
- Approach: Real dependencies combined, logic flow verified
- Examples: `src/lib/visualizer/store.test.ts` (Zustand store + multiple selectors), `src/components/visualizer/DownloadButton.test.tsx` (mocked dependencies but full component flow)
- Assertion style: Check state changes, side effects, callback invocations

**React Component Tests:**
- Scope: Component rendering, user interactions, prop behavior
- Framework: React Testing Library (not shallow rendering)
- Assertion style: Check rendered output, DOM classes, callback calls
- Interactions: `fireEvent.click()`, `screen.getByText()`, `screen.getByTestId()`

**No E2E Tests:**
- No Cypress, Playwright, or other E2E framework configured
- No integration test environment setup

## Common Patterns

**Async Testing:**

Component with async operations:
```typescript
// Pattern from async tests - using await with React Testing Library
it("renders loaded state after fetch completes", async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ preset: { ... } }),
  });

  render(<MyComponent />);

  // Use waitFor for async state updates
  await screen.findByText("Loaded");
  expect(screen.getByText("Loaded")).toBeTruthy();
});
```

**Error Testing:**

From unit test pattern:
```typescript
it("handles null preset gracefully", () => {
  const schema = makeSchema(["data", "version"]);
  const result = checkSchemaCompliance(null, schema);
  expect(result.missingRequiredKeys).toEqual([]);
});

it("throws on invalid JSON", () => {
  expect(() => JSON.parse("{invalid}")).toThrow();
});
```

**State/Store Testing:**

Zustand store testing pattern:
```typescript
// From src/lib/visualizer/store.test.ts
import { useVisualizerStore } from "./store";

describe("useVisualizerStore", () => {
  it("addBlock adds to baseBlocks", () => {
    const store = useVisualizerStore.getState();
    const initialCount = store.baseBlocks.length;

    store.addBlock(testBlock);

    expect(store.baseBlocks.length).toBe(initialCount + 1);
  });
});
```

**DOM Testing:**

React component DOM assertions:
```typescript
// From src/components/visualizer/BlockTile.test.tsx
it("renders data-testid attribute", () => {
  render(<BlockTile {...props} />);
  expect(screen.getByTestId("block-tile-delay2")).toBeTruthy();
});

it("applies correct CSS class based on state", () => {
  render(<BlockTile block={block} enabled={false} {...props} />);
  const tile = screen.getByTestId("block-tile-delay2");
  expect(tile.className).toContain("opacity-40");
});

it("clicking tile calls callback", () => {
  const onSelect = vi.fn();
  render(<BlockTile {...props} onSelect={onSelect} />);
  fireEvent.click(screen.getByTestId("block-tile-delay2"));
  expect(onSelect).toHaveBeenCalledWith("delay2");
});
```

## Snapshot Testing

- Not detected in codebase
- No `.snap` files found
- Tests use explicit assertions instead of snapshots

## Test Documentation

**Phase References:**
- Tests include phase/plan comments for traceability
- Example: `// Phase 79-02: onRemove and isDragging props`
- Helps understand context of when test was added

---

*Testing analysis: 2026-03-18*
