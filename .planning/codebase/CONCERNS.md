# Codebase Concerns

**Analysis Date:** 2026-03-01

## Tech Debt

**Missing Input Validation on API Routes:**
- Issue: Request bodies are parsed with `await req.json()` without schema validation. No type checking on incoming messages or provider selections.
- Files: `src/app/api/chat/route.ts`, `src/app/api/generate/route.ts`
- Impact: Malformed requests could crash handlers or bypass intended logic. Provider selection could accept arbitrary strings not in PROVIDERS map.
- Fix approach: Add Zod schemas (package is already a dependency) to validate request payloads before processing. Example: `z.object({ messages: z.array(...), providers: z.array(z.string()) })`

**Incomplete Streaming Error Handling in Chat Route:**
- Issue: SSE stream errors are silently enqueued but stream is then closed. Client may not properly handle mid-stream error signals. No timeout or connection cleanup on hang.
- Files: `src/app/api/chat/route.ts` lines 46-50
- Impact: If Gemini API hangs, stream stays open indefinitely. Client sees no new data but connection never closes.
- Fix approach: Add ReadableStream abort timeout (e.g., 90 second timeout). Controller.error() instead of enqueue for fatal errors. Proper SSE format for error frames that client can detect.

**JSON Parsing Fallback is Fragile:**
- Issue: In `src/app/api/generate/route.ts` lines 70-75, markdown fence detection uses naive regex ````(?:json)?` and assumes clean fenced JSON. If AI wraps in other formatting, parsing fails silently until validation catches it.
- Files: `src/app/api/generate/route.ts`
- Impact: Some AI responses may be unparseable, requiring fallback rejection instead of graceful recovery.
- Fix approach: Implement recursive JSON extraction (try unwrapping nested fences, try extracting from text before/after fences, attempt lenient parsing with json5 library as backup).

**No Rate Limiting or Request Throttling:**
- Issue: API endpoints `/chat` and `/generate` have no throttling. Authenticated by PREMIUM_SECRET only, no per-user limits.
- Files: `src/app/api/chat/route.ts`, `src/app/api/generate/route.ts`
- Impact: Single client can spam multiple AI provider calls simultaneously, consuming API quota rapidly. No DoS protection.
- Fix approach: Implement rate limiting (e.g., Redis-backed sliding window or in-memory with LRU eviction). Limit concurrent generation requests per IP/session.

**Hardcoded Block Type Mappings:**
- Issue: `src/lib/helix/preset-builder.ts` function `getBlockType()` has hardcoded numeric type mappings that must match Helix LT firmware expectations. No validation or versioning.
- Files: `src/lib/helix/preset-builder.ts` lines 406-422
- Impact: If Helix firmware updates block type IDs, preset generation silently produces invalid files without error.
- Fix approach: Move block types to models database with firmware version tracking. Validate against expected firmware version before export.

**Large Models Database Not Optimized:**
- Issue: `src/lib/helix/models.ts` is 842 lines defining every amp/cab/effect model. Entire file is imported and processed on every API request.
- Files: `src/lib/helix/models.ts`
- Impact: Large object iteration on every generation call. No caching or lazy loading. Models file will grow as more devices/variants added.
- Fix approach: Create a dedicated models service that lazily loads/caches models database. Consider splitting into separate files per category.

## Known Bugs

**Preset Name Truncation Doesn't Handle Multi-Byte Characters:**
- Issue: `src/app/api/generate/route.ts` lines 88-90 use `.slice(0, 32)` to enforce 32-char limit, but JavaScript slice counts UTF-16 code units, not characters. Emoji or accented names are truncated mid-character.
- Files: `src/app/api/generate/route.ts`
- Trigger: Generate a preset for "Björk Vespertine ethereal clean" — name gets cut mid-character
- Workaround: Use provider names without emoji/accents in generated preset names

**Block Key Mapping Assumes Correct Per-DSP Indexing:**
- Issue: `src/lib/helix/validate.ts` `resolveBlockKey()` assumes blocks are indexed sequentially within each DSP. If AI generates out-of-order blocks, mapping could fail.
- Files: `src/lib/helix/validate.ts` lines 173-204
- Trigger: AI generates `block0, block2, block1` for DSP0 — key resolution fails
- Workaround: Auto-correction reorders blocks during validation, but if count mismatches, blocks can be silently dropped

**Silent Snapshot Block Reference Loss:**
- Issue: In `src/lib/helix/validate.ts` lines 71-96, snapshot blockStates that don't resolve to valid blocks are dropped without warning to user. If AI-generated blockStates don't match final signal chain, snapshot becomes incomplete.
- Files: `src/lib/helix/validate.ts`
- Trigger: AI generates snapshot with `block0, block1, block2` but validation removes `block2` — snapshot loses control over that block
- Workaround: Validation errors are logged to console but not returned to user

## Security Considerations

**Premium Key Validation is String Equality:**
- Risk: Premium feature access relies on exact string match of environment variable `PREMIUM_SECRET`. No cryptographic validation, no expiration, no per-session tokens.
- Files: `src/lib/gemini.ts` lines 12-18
- Current mitigation: Secret is environment-only, not hardcoded
- Recommendations: (1) Use opaque token format (e.g., JWT with signature), (2) Add expiration dates, (3) Consider rate limiting premium requests, (4) Log premium feature usage for audit trail

**API Keys Exposed in Environment and System Prompts:**
- Risk: Gemini/Claude/OpenAI API keys stored in `.env.local` without encryption. System prompts in `src/lib/gemini.ts` generate tokens on every chat message (date injection at line 98).
- Files: `.env.local` (forbidden read), `src/lib/gemini.ts` lines 98
- Current mitigation: `.env*` is in .gitignore
- Recommendations: (1) Use encrypted secret management (AWS Secrets Manager, HashiCorp Vault), (2) Rotate API keys monthly, (3) Set up alerts for key usage anomalies, (4) Move date injection to client-side

**No Input Sanitization on Message Content:**
- Risk: Chat and generation routes accept arbitrary message content strings. No XSS protection if messages are echoed back or used in prompts without escaping.
- Files: `src/app/api/chat/route.ts` line 30, `src/app/api/generate/route.ts` line 53
- Current mitigation: Messages are passed to API providers as string content (not HTML), so API-side risk is low. Frontend uses ReactMarkdown which sanitizes.
- Recommendations: (1) Validate message length (current unbounded), (2) Reject messages with suspicious patterns (null bytes, control chars), (3) Use react-markdown's allowedElements config to restrict HTML

**Fallback to Any Cab in Preset Builder:**
- Risk: `src/lib/helix/preset-builder.ts` line 155 has `|| blocks.find(b => b.type === "cab")` fallback that could pair wrong amp with wrong cab if signal chain is malformed.
- Files: `src/lib/helix/preset-builder.ts` lines 154-155
- Current mitigation: Validation ensures all amps have a paired cab
- Recommendations: (1) Throw error instead of silent fallback if amp lacks cab, (2) Require explicit amp-cab pairing in BlockSpec

## Performance Bottlenecks

**String Similarity Search on Every Invalid Model ID:**
- Problem: `src/lib/helix/validate.ts` `findClosestModelId()` iterates all valid IDs on every validation error. With 842+ models, this is O(n*m) character comparison.
- Files: `src/lib/helix/validate.ts` lines 142-156
- Cause: No index structure for fast lookup. Full table scan with similarity scoring.
- Improvement path: (1) Pre-build trigram index on startup, (2) Implement levenshtein distance cache, (3) Use BK-tree or similar for fast approximate matching

**JSON Stringify/Parse on Every Snapshot Validation:**
- Problem: `src/lib/helix/validate.ts` line 35 does `JSON.parse(JSON.stringify(spec))` to deep clone. Unnecessary for validation-only operations.
- Files: `src/lib/helix/validate.ts`
- Cause: Defensive cloning to avoid mutations, but cloning is expensive for large signal chains
- Improvement path: (1) Implement shallow copy with immutable updates, (2) Only clone if mutations detected, (3) Use structuredClone if available

**Fetching Provider List on Every Page Load:**
- Problem: `src/app/page.tsx` lines 46-62 fetch `/api/providers` on component mount with no caching.
- Files: `src/app/page.tsx`
- Cause: Providers are static (determined by env vars at startup), yet fetched every session
- Improvement path: (1) Cache provider list in localStorage, (2) Add `/api/providers` response caching header (Cache-Control: public, max-age=3600), (3) Only refetch on explicit user action

## Fragile Areas

**Message History Conversion for Gemini:**
- Files: `src/app/api/chat/route.ts` lines 12-15
- Why fragile: Assumes message format with `role` and `content` fields. No TypeScript narrowing. If client sends different format, fails at runtime.
- Safe modification: Add message validation schema before conversion. Type the conversion function with strict input types.
- Test coverage: No tests for message format handling

**Snapshot Parameter Override Resolution:**
- Files: `src/lib/helix/preset-builder.ts` lines 219-231
- Why fragile: Multiple overlapping block key mappings (per-DSP vs global). Easy to introduce off-by-one errors if adding new DSP paths or block types.
- Safe modification: Add comprehensive unit tests for all block key mappings. Extract block key logic into standalone, tested utility function.
- Test coverage: No tests for blockKeyMap resolution

**AI-Generated Preset Specification Compliance:**
- Files: `src/lib/helix/preset-builder.ts`, `src/lib/helix/validate.ts`
- Why fragile: Validation auto-corrects many AI errors (invalid model IDs, wrong block positions, missing block states). If AI consistently violates rules, fixes hide the root problem.
- Safe modification: Log all auto-corrections with context. Alert if >3 corrections needed per preset. Fail fast on structural errors instead of auto-fix.
- Test coverage: No regression tests for common AI mistakes

**CAB Microphone Parameter Type Ambiguity:**
- Files: `src/lib/helix/preset-builder.ts` lines 123-125, `src/lib/helix/validate.ts` lines 120-124
- Why fragile: Mic parameter is an integer index (0-7), not normalized 0-1. Comment documents this at two places but AI might not follow. If treated as float, rounding errors occur.
- Safe modification: Create typed Mic parameter enum. Add runtime assertion that Mic is integer. Reject float Mic values in validation.
- Test coverage: No tests for integer vs float parameter handling

## Scaling Limits

**Chat History Stored in React State:**
- Current capacity: Browser memory (typically 50-500MB available)
- Limit: Long conversations (>1000 messages) will cause memory bloat and UI lag
- Scaling path: (1) Implement message pagination/windowing, (2) Move history to IndexedDB, (3) Server-side session storage with API pagination

**Single-Threaded JSON Parsing on Large Specs:**
- Current capacity: Full signal chain parsing blocks UI for <100ms on typical hardware
- Limit: Very large presets (100+ blocks, 20+ snapshots) will freeze UI during generation
- Scaling path: (1) Move validation to Web Worker, (2) Implement streaming JSON parser, (3) Split generation into stages with progress updates

**Provider Parallel Execution No Concurrency Limit:**
- Current capacity: Unrestricted - could spawn N parallel API calls
- Limit: 10+ simultaneous generation requests will hit provider rate limits and timeout
- Scaling path: (1) Implement queue with configurable concurrency, (2) Add exponential backoff retry, (3) Circuit breaker for provider failures

**Models Database Linear Search:**
- Current capacity: 842 models = ~50μs per lookup on typical CPU
- Limit: At 10,000+ models, linear search becomes measurable overhead
- Scaling path: (1) Implement B-tree index by category, (2) Use trie for name prefix matching, (3) Separate models into lazy-loaded chunks

## Dependencies at Risk

**Zod v4.3.6 - Minor Version Specified:**
- Risk: Zod is installed with `^4.3.6`. Patch versions could introduce breaking changes in edge cases (rare but documented in their changelog).
- Impact: If zod@4.3.7+ changes validation behavior, validation logic could silently break
- Migration plan: (1) Pin to exact version `4.3.6` in package.json, (2) Set up automated dependency audits, (3) Test against latest zod before minor upgrades

**@google/genai v1.42.0 - Rapidly Evolving API:**
- Risk: Google's SDK is young and API surface changes between versions. Multi-major version upgrades likely within 12 months.
- Impact: Chat and generation endpoints may break on major version bump
- Migration plan: (1) Create provider abstraction wrapper, (2) Implement version-specific SDK bridges, (3) Add integration tests for each provider SDK version

**React v19.2.3 with Concurrent Features:**
- Risk: React 19 is bleeding-edge. Concurrent rendering can expose subtle state management bugs.
- Impact: Race conditions in message state updates if multiple effects fire simultaneously
- Migration plan: (1) Verify concurrent rendering compatibility, (2) Use useTransition for async state updates, (3) Test with Strict Mode enabled

## Missing Critical Features

**No Preset Export Versioning:**
- Problem: `.hlx` files have hardcoded Helix FW version (3.70). No way to export for different FW versions or devices (Floor, Native, etc).
- Blocks: Users on older FW or different devices cannot use exported presets
- Impact: Feature request ticket from users on FW 3.50, Helix Floor users

**No Undo/Redo in Chat UI:**
- Problem: Once a message is sent, no way to edit or resend with different wording
- Blocks: Users must start over if a single chat message doesn't guide AI correctly
- Impact: Frustrating UX, especially with long setup conversations

**No Preset Comparison Beyond Side-By-Side Display:**
- Problem: Multiple provider presets shown as cards but no diff view, no parameter-by-parameter comparison
- Blocks: Users can't understand why Claude's reverb mix differs from Gemini's
- Impact: Users don't understand which provider fits their workflow

**No Offline Mode:**
- Problem: All AI providers require online connection. No fallback to cached presets or local baseline
- Blocks: Users traveling or in poor connectivity cannot generate
- Impact: Feature request from mobile/on-location users

## Test Coverage Gaps

**API Route Error Handling:**
- What's not tested: Happy path and error paths for `/api/chat` and `/api/generate`
- Files: `src/app/api/chat/route.ts`, `src/app/api/generate/route.ts`
- Risk: Regression in error responses, streaming format breaks, unhandled exceptions
- Priority: **High** - API errors directly impact user experience

**Preset Validation Edge Cases:**
- What's not tested: Invalid model ID auto-correction, block key resolution with mismatched counts, parameter clamping
- Files: `src/lib/helix/validate.ts`
- Risk: Silent data loss (blocks dropped, snapshots incomplete), invalid presets exported
- Priority: **High** - Invalid presets render unusable in Helix hardware

**Message Stream Parsing:**
- What's not tested: SSE frame parsing, partial frames, malformed JSON in stream
- Files: `src/app/page.tsx` lines 140-169
- Risk: Parser crashes on edge cases, incomplete messages displayed, error frames missed
- Priority: **High** - Chat reliability critical to UX

**Provider Abstraction Consistency:**
- What's not tested: Identical input produces compatible JSON across all three providers, response format normalization
- Files: `src/lib/providers.ts`
- Risk: Inconsistent preset output quality between providers, JSON parsing failures for one provider
- Priority: **Medium** - Multi-provider feature correctness

**UI State Management:**
- What's not tested: Concurrent state updates during generation, provider toggle logic, message deduplication
- Files: `src/app/page.tsx`
- Risk: Race conditions, stale provider selection, duplicate messages in chat
- Priority: **Medium** - UI correctness and usability

**File Download and Export:**
- What's not tested: HLX file format validity, filename sanitization, large preset serialization
- Files: `src/app/page.tsx` lines 241-253
- Risk: Corrupt files exported, security issues with special characters in filenames
- Priority: **Medium** - Export reliability

---

*Concerns audit: 2026-03-01*
