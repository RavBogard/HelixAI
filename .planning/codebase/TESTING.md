# Testing Patterns

**Analysis Date:** 2026-03-01

## Test Framework

**Status:** No test framework currently configured

**Finding:** The codebase contains NO test files (no `*.test.*` or `*.spec.*` files detected). Testing infrastructure is absent.

**Recommended Setup:**
- Jest or Vitest would be appropriate for this Next.js codebase
- TypeScript support built-in to modern test runners
- No existing test configuration files found

## Test File Organization

**Current State:** Not applicable — no tests present

**Recommended Approach if Added:**
- **Location:** Co-locate tests with source files or separate `__tests__` directories
- **Pattern:** Either `src/lib/helix/__tests__/preset-builder.test.ts` or `src/lib/helix/preset-builder.test.ts`
- **Naming Convention:** `[module].test.ts` or `[module].spec.ts`

## Test Structure (If Tests Were Present)

Based on codebase patterns, tests would likely follow this structure:

```typescript
// Example pattern for validation tests
describe("validateAndFixPresetSpec", () => {
  it("should validate correct preset spec", () => {
    const spec = createTestPreset();
    const result = validateAndFixPresetSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fix invalid model IDs", () => {
    const spec = createTestPreset({ modelId: "INVALID_ID" });
    const result = validateAndFixPresetSpec(spec);
    expect(result.fixed).toBe(true);
    expect(result.fixedSpec?.signalChain[0].modelId).not.toBe("INVALID_ID");
  });
});
```

## Mocking Recommendations

**Framework:** Would use Jest/Vitest mocking utilities

**What to Mock:**
- External API calls (`fetch`, AI provider SDKs)
- Environment variables for sensitive keys
- File system operations (if any added)
- Google GenAI, OpenAI, Anthropic SDK calls
- `next/server` utilities in route handlers

**What NOT to Mock:**
- Internal business logic functions like `validateAndFixPresetSpec()`, `buildHlxFile()`
- Type definitions and interfaces
- Constants and configuration objects

**Example Mock Pattern for Provider Tests:**
```typescript
// Would mock provider SDK calls
jest.mock("@google/genai");
jest.mock("openai");
jest.mock("@anthropic-ai/sdk");

// Mock environment variables
process.env.GEMINI_API_KEY = "test-key";
process.env.OPENAI_API_KEY = "test-key";
process.env.CLAUDE_API_KEY = "test-key";

// Mock individual function
const mockGenerateContent = jest.fn();
GoogleGenAI.mockImplementation(() => ({
  models: { generateContent: mockGenerateContent }
}));
```

## Fixtures and Factories

**Recommended Approach:**

Create test fixtures in `__tests__/fixtures/` or co-located in test files:

```typescript
// Preset spec fixture factory
function createTestPreset(overrides: Partial<PresetSpec> = {}): PresetSpec {
  return {
    name: "Test Preset",
    description: "A test preset",
    tempo: 120,
    guitarNotes: "Test notes",
    signalChain: [
      {
        type: "amp",
        modelId: "HD2_AmpUSDeluxeNrm",
        modelName: "US Deluxe Nrm",
        dsp: 0,
        position: 0,
        path: 0,
        enabled: true,
        stereo: false,
        parameters: { Drive: 0.45, Bass: 0.35, Master: 1.0 }
      }
    ],
    snapshots: [
      {
        name: "CLEAN",
        description: "Clean snapshot",
        ledColor: 8,
        blockStates: { block0: true },
        parameterOverrides: {}
      }
    ],
    ...overrides
  };
}

// Provider response fixture
function createTestProviderResult(overrides = {}): ProviderResult {
  return {
    providerId: "gemini",
    providerName: "Gemini",
    preset: createTestHlxFile(),
    summary: "Test summary",
    spec: createTestPreset(),
    ...overrides
  };
}

// HLX file fixture
function createTestHlxFile(): HlxFile {
  return {
    version: 6,
    data: {
      device: 2162692,
      device_version: 57671680,
      meta: {
        name: "Test",
        application: "HX Edit",
        build_sha: "v3.70",
        modifieddate: Math.floor(Date.now() / 1000),
        appversion: 57671680
      },
      tone: createTestTone()
    },
    meta: { original: 0, pbn: 0, premium: 0 },
    schema: "L6Preset"
  };
}
```

**Location:** `src/lib/helix/__tests__/fixtures.ts` or similar

## Coverage

**Status:** Not enforced

**Recommendation:** If tests added, enforce minimum coverage:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**View Coverage Command (if Jest configured):**
```bash
npm test -- --coverage
npm test -- --coverage --watch
```

## Test Types (Recommended Structure)

### Unit Tests

**Scope:** Individual functions with pure logic

**Examples to Test:**
- `buildHlxFile()` - core preset building logic
- `validateAndFixPresetSpec()` - validation and fixing logic
- `summarizePreset()` - formatting logic
- `similarity()` and `findClosestModelId()` - string matching logic
- `buildBlockKeyMap()`, `resolveBlockKey()` - block mapping logic

**Approach:** Test with various inputs including edge cases

```typescript
describe("buildHlxFile", () => {
  it("should build valid HLX file structure", () => {
    const spec = createTestPreset();
    const hlxFile = buildHlxFile(spec);

    expect(hlxFile.version).toBe(6);
    expect(hlxFile.schema).toBe("L6Preset");
    expect(hlxFile.data.device).toBe(2162692);
  });

  it("should limit preset name to 32 chars", () => {
    const longName = "A".repeat(50);
    const spec = createTestPreset({ name: longName });
    const hlxFile = buildHlxFile(spec);

    expect(hlxFile.data.meta.name.length).toBeLessThanOrEqual(32);
  });
});
```

### Integration Tests

**Scope:** Multiple functions working together

**Examples to Test:**
- Preset generation pipeline: `getSystemPrompt() → AI → JSON.parse() → validateAndFixPresetSpec() → buildHlxFile()`
- API route `/api/generate`: request validation → provider generation → response formatting
- API route `/api/chat`: message formatting → AI streaming → SSE encoding

**Approach:** Test realistic workflows with mocked external dependencies

```typescript
describe("Preset generation pipeline", () => {
  it("should generate valid HLX from AI response", async () => {
    const aiResponse = '{"name":"Test","description":"...","signalChain":[...],"snapshots":[...]}';

    // Simulate AI response
    const presetSpec = JSON.parse(aiResponse);
    const validation = validateAndFixPresetSpec(presetSpec);
    const hlxFile = buildHlxFile(validation.fixedSpec || presetSpec);

    expect(hlxFile).toBeDefined();
    expect(hlxFile.schema).toBe("L6Preset");
  });

  it("should fix invalid model IDs during pipeline", async () => {
    const aiResponse = '{"name":"Test","signalChain":[{"modelId":"INVALID"}],...}';
    const presetSpec = JSON.parse(aiResponse);

    const validation = validateAndFixPresetSpec(presetSpec);
    expect(validation.fixed).toBe(true);

    const hlxFile = buildHlxFile(validation.fixedSpec!);
    expect(hlxFile).toBeDefined();
  });
});
```

### API Route Tests

**Scope:** Next.js route handlers (if test framework added)

**Key Routes to Test:**
- `POST /api/chat` - streaming chat responses
- `POST /api/generate` - multi-provider preset generation
- `GET /api/providers` - provider availability

**Approach:** Mock `NextRequest`/`NextResponse` and SDK calls

```typescript
describe("/api/generate route", () => {
  it("should return results from all requested providers", async () => {
    const request = new NextRequest("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Test" }],
        providers: ["gemini", "claude"]
      })
    });

    // Mock provider implementations
    jest.spyOn(providers, "generateWithProvider")
      .mockResolvedValue('{"name":"Test",...}');

    const response = await POST(request);
    const data = await response.json();

    expect(data.results).toHaveLength(2);
    expect(data.results[0].providerId).toBe("gemini");
  });

  it("should handle provider errors gracefully", async () => {
    // Test error handling with Promise.allSettled
  });
});
```

## Common Testing Patterns

### Async Testing

**Pattern for async functions:**

```typescript
it("should validate async preset generation", async () => {
  const spec = createTestPreset();

  // For async operations
  const result = await generateWithProvider("gemini", "test", "prompt");
  expect(result).toBeDefined();
});

// Using async/await in test
it("should handle streaming responses", async () => {
  const readable = new ReadableStream({ ... });
  const chunks: string[] = [];

  const reader = readable.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }
  } finally {
    reader.releaseLock();
  }

  expect(chunks.length).toBeGreaterThan(0);
});
```

### Error Testing

**Pattern for error cases:**

```typescript
describe("Error handling", () => {
  it("should throw on missing API key", () => {
    delete process.env.GEMINI_API_KEY;

    expect(() => createGeminiClient()).toThrow(
      "GEMINI_API_KEY environment variable is required"
    );
  });

  it("should catch JSON parse errors", async () => {
    const invalidJson = "{ invalid json }";

    expect(() => JSON.parse(invalidJson)).toThrow();
  });

  it("should validate provider existence before generation", () => {
    expect(() => {
      generateWithProvider("invalid-provider", "conv", "prompt");
    }).toThrow("Unknown provider: invalid-provider");
  });
});
```

## Critical Test Gaps

The following areas have NO test coverage and are high-priority for testing:

1. **Validation Logic** (`src/lib/helix/validate.ts`)
   - Model ID validation and fuzzy matching
   - Block position fixing
   - Snapshot reference resolution
   - Parameter clamping
   - Risk: Invalid presets could be generated undetected

2. **Preset Building** (`src/lib/helix/preset-builder.ts`)
   - HLX file structure generation
   - DSP path assignment
   - Cabinet pairing with amps
   - Snapshot building
   - Footswitch auto-assignment
   - Risk: Malformed .hlx files that don't load in Helix LT

3. **Provider Integration** (`src/lib/providers.ts`)
   - API key validation
   - Provider selection and fallback
   - JSON parsing with markdown fence handling
   - Risk: Generation failures, wrong model usage

4. **API Routes** (`src/app/api/*/route.ts`)
   - Request validation
   - Error handling and status codes
   - SSE encoding and streaming
   - Multi-provider parallel generation
   - Risk: Malformed responses, incomplete data

5. **Client-Side Logic** (`src/app/page.tsx`)
   - Message streaming and parsing
   - Provider selection state
   - Download functionality
   - Risk: UI state corruption, unhandled race conditions

---

*Testing analysis: 2026-03-01*
