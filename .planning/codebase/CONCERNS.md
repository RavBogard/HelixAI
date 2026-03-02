# Codebase Concerns

**Analysis Date:** 2026-03-02

## Tech Debt

**Large Monolithic Files:**
- Issue: `src/lib/helix/models.ts` (1210 lines) and `src/app/page.tsx` (1131 lines) are significantly oversized. Models.ts contains 600+ model definitions in a single file with no modularization. Page.tsx combines UI logic, state management, API calls, and streaming handlers.
- Files: `src/lib/helix/models.ts`, `src/app/page.tsx`
- Impact: Difficult to navigate and maintain. Changes to one model affect the entire file. React component testing is complicated by entangled concerns.
- Fix approach: Split models.ts by category (amps.ts, cabs.ts, effects.ts). Extract page.tsx features into smaller components (ChatInput, PresetDisplay, VizPanel).

**Magic Numeric Constants Scattered Throughout Code:**
- Issue: Parameter defaults are hardcoded as numeric arrays in multiple files without sufficient context. Example: LowCut values (80.0 Hz) and HighCut values (7000.0 Hz) appear in `src/lib/helix/param-engine.ts` with brief comments referencing "TONE-02, TONE-04".
- Files: `src/lib/helix/param-engine.ts`, `src/lib/helix/podgo-builder.ts`
- Impact: Hard to trace where values come from or why they were chosen. Future maintainers cannot easily justify tweaks without archaeological effort.
- Fix approach: Create a `src/lib/helix/constants.ts` file documenting all tuning values with sources (e.g., "Tonevault 250-preset analysis median"). Add JSDoc comments with reasoning.

**Implicit Type Coercion in Validation:**
- Issue: `src/lib/helix/validate.ts` conditionally fixes known parameter bugs (e.g., normalizing LowCut/HighCut floats). Uses `console.warn()` to signal corrections but does not propagate this information back to caller or create structured fix records.
- Files: `src/lib/helix/validate.ts`
- Impact: Silent corrections hide potential upstream bugs. If a corrected value reaches a user, there's no audit trail of what was wrong and why it was fixed.
- Fix approach: Add an optional `fixes` array to the `ValidationResult` interface documenting each correction (parameter name, original value, corrected value, reason). Expose this to the caller.

## Known Bugs

**Snapshot Name Truncation Without Feedback:**
- Symptoms: In `src/lib/planner.ts`, snapshot names longer than 10 characters are silently truncated using `.slice(0, 10)`. Users receive no indication that their requested name "CLEAN CHIME" was shortened to "CLEAN CHI".
- Files: `src/lib/planner.ts` (lines 141-144), `src/lib/helix/types.ts` (snapshot name schema)
- Trigger: Call Claude Planner with a snapshot name > 10 characters; the response will be silently truncated before Zod validation.
- Workaround: None. The truncation happens post-parse, so validation cannot catch oversized names.

**Incomplete Error Context in Vision Route:**
- Symptoms: If `src/app/api/vision/route.ts` fails to parse JSON body (line 44), the error message is suppressed and reported as "Vision extraction failed". Users cannot diagnose if the issue was invalid base64, corrupt image data, or API timeout.
- Files: `src/app/api/vision/route.ts` (line 107)
- Trigger: Send malformed JSON in the POST body; the error instanceof check swallows the real error message.
- Workaround: Check browser console for detailed error, but this is not user-friendly.

**Pod Go Model List Generation Not Tested:**
- Symptoms: Pod Go models are filtered from the global model list using `getModelListForPrompt(device)` in `src/lib/planner.ts`, but there are NO tests confirming that Pod Go devices receive only compatible models.
- Files: `src/lib/planner.ts` (lines 97), `src/lib/helix/types.ts` (model filtering logic)
- Trigger: Create a Pod Go preset using a Helix-only amp (e.g., "Litigator"); the planner may suggest it if the model list filtering is broken.
- Workaround: Manual testing of Pod Go model list output.

## Security Considerations

**Environment Variable Exposure Risk:**
- Risk: `src/lib/planner.ts` reads `CLAUDE_API_KEY` from `process.env` at runtime (line 93). If an unhandled error occurs before the API call, the error stack trace sent to the client could inadvertently include the env var name or reference.
- Files: `src/lib/planner.ts`
- Current mitigation: Basic error handling in `src/app/api/generate/route.ts` catches and sanitizes errors before returning.
- Recommendations: Add explicit env var validation at server startup (before routes are registered). Use a utility to sanitize error messages of env var references.

**Base64 Image Size Validation:**
- Risk: `src/app/api/vision/route.ts` limits base64 images to 1,200,000 characters (≈900 KB). However, the client-side compression in `browser-image-compression` is NOT enforced; a user could bypass it by manually crafting a POST request with larger images.
- Files: `src/app/api/vision/route.ts` (line 36), client-side compression not enforced
- Current mitigation: Server-side size limit; Anthropic API also enforces 5 MB per-image limit.
- Recommendations: Document the 900 KB guideline in client-side warnings. Consider adding rate limiting or user quotas.

**RigIntent Validation Missing Post-Vision:**
- Risk: `src/app/api/vision/route.ts` returns a RigIntent from the vision planner but does NOT validate the returned object against RigIntent schema. The intent is assumed to be valid and stored in client state.
- Files: `src/app/api/vision/route.ts` (line 102)
- Current mitigation: The vision planner is called with structured output, but there's no runtime validation of the response.
- Recommendations: Add Zod validation in the vision route before returning: `RigIntentSchema.parse(rigIntent)`.

## Performance Bottlenecks

**Synchronous Model Lookup on Every Request:**
- Problem: `src/lib/helix/validate.ts` calls `getValidModelIds()` at module load time, building a Set of 600+ model IDs (lines 6-24). This is done synchronously before the first request. For a Pod Go preset, a second lookup builds suffixes dynamically (lines 27-40).
- Files: `src/lib/helix/validate.ts`, `src/lib/helix/models.ts`
- Cause: Model ID validation must happen in the hot path (/api/generate), so lookups are cached at module load. The suffixed model ID set is rebuilt per-request for Pod Go.
- Improvement path: Precompute the Pod Go suffixed ID set at module load (similar to VALID_IDS). Use a flag in the device target to pick the correct set.

**models.ts Parsing Time:**
- Problem: `src/lib/helix/models.ts` is a 1210-line file with 1000+ lines of hard-coded model definitions. On first module load, this entire file must be parsed and all 600+ HelixModel objects instantiated.
- Files: `src/lib/helix/models.ts`
- Cause: All models are exported as immutable objects, so TypeScript and Node.js must parse and instantiate them on import.
- Improvement path: Consider lazy-loading models by category (dynamic import) or moving model definitions to a JSON file loaded at runtime. Profile startup time before optimizing.

**Snapshot Engine Parameter Calculations:**
- Problem: `src/lib/helix/snapshot-engine.ts` iterates over the entire signal chain and parameters for each of the 8 snapshots (for Helix) or 4 snapshots (for Pod Go). For a chain with 12 blocks × 8 snapshots × 10 parameters, this is ~960 parameter assignments.
- Files: `src/lib/helix/snapshot-engine.ts`
- Cause: Parameter resolution for each snapshot is currently not memoized or optimized.
- Improvement path: Profile the actual impact; this is likely negligible for typical presets but could be optimized with caching of unchanged parameters across snapshots.

## Fragile Areas

**Type-Unsafe Cast in Generate Route:**
- Files: `src/app/api/generate/route.ts` (line 49)
- Why fragile: The code casts `rigIntent` to `RigIntent` type without runtime validation: `const typedRigIntent = rigIntent as RigIntent`. The comment claims "the data was already Zod-validated at the vision route," but the vision route does NOT validate (see Security Considerations). If a malformed object reaches this point, the cast hides the error and can cause runtime crashes downstream.
- Safe modification: Add Zod validation in the vision route (see Security Considerations). Alternatively, validate again here before the cast.
- Test coverage: No tests confirm that invalid rigIntent objects are rejected.

**Rig Mapping Fallback Behavior Not Tested:**
- Files: `src/lib/rig-mapping.ts` (lines 340–449)
- Why fragile: The three-tier substitution fallback logic ("direct" > "close" > "approximate") is complex and handles edge cases (unknown category, no fallback available). The `mapRigToSubstitutions()` function can return an empty array if all pedals fall through to `null` returns, but there are NO tests confirming this behavior.
- Safe modification: Add tests for each fallback tier (e.g., missing category returns "close" with category fallback, not "approximate"). Document the expected behavior in comments.
- Test coverage: 5 test files exist, but `rig-mapping.test.ts` does not cover the fallback cascade.

**PresetSpec Validation Happens Too Late:**
- Files: `src/app/api/generate/route.ts` (line 89)
- Why fragile: Validation in `validatePresetSpec()` is called AFTER the Knowledge Layer pipeline completes but BEFORE file generation. If validation fails, the entire preset is discarded. However, there is no clear contract about what the Knowledge Layer should guarantee—are invalid specs possible?
- Safe modification: Add a JSDoc comment to `validatePresetSpec()` explaining when failures occur and why (e.g., "Only fails if Knowledge Layer or device constraints are violated"). Consider adding earlier validation in `assembleSignalChain()`.
- Test coverage: Integration tests should confirm that valid ToneIntents always produce valid PresetSpecs.

## Scaling Limits

**Pod Go Effect Count Hard Limit:**
- Current capacity: 4 user effects (POD_GO_MAX_USER_EFFECTS = 4)
- Limit: Line 283 in `src/lib/helix/chain-rules.ts` truncates effects to 4 without warning. If a user's tone interview suggests 5 effects, the 5th is silently dropped.
- Scaling path: If Pod Go firmware is updated to support more effects, update POD_GO_MAX_USER_EFFECTS and retest chain assembly.

**Block Limit Per DSP:**
- Current capacity: 8 non-cab blocks per DSP (Helix LT/Floor)
- Limit: Validation in `src/lib/helix/validate.ts` (lines 132–140) rejects presets with >8 blocks per DSP. A user requesting 9 effects + amp + cab would exceed this limit.
- Scaling path: Helix firmware updates could increase the slot count. Monitor Helix firmware release notes and update MAX_BLOCKS_PER_DSP if capacity increases.

**Model Database Size:**
- Current capacity: 600+ HelixModel definitions in `src/lib/helix/models.ts`
- Limit: The file is now 1210 lines. Adding 100+ more models (e.g., new firmware updates) would make the file unwieldy.
- Scaling path: Modularize models.ts by category before it exceeds 1500 lines. Consider automated model extraction from HX Edit data dumps.

## Dependencies at Risk

**Old Anthropic SDK Version:**
- Risk: `package.json` specifies `@anthropic-ai/sdk@^0.78.0`. The latest version (as of Feb 2025) is much newer. The 0.78.0 line may have missing features or unfixed bugs.
- Impact: Prompt caching, structured output format (zodOutputFormat), and vision API stability depend on SDK version.
- Migration plan: Test with the latest SDK version (e.g., ^1.x). Run full test suite to confirm no breaking changes in the planner and vision routes.

**Zod Version Constraints:**
- Risk: `package.json` specifies `zod@^4.3.6`. While ^4.x is fairly stable, Zod 5.x may introduce schema breaking changes.
- Impact: ToneIntentSchema and RigIntentSchema could require updates if Zod API changes.
- Migration plan: Monitor Zod release notes. When 5.x is stable, test with a minor version bump and review schema compatibility.

**Unvended browser-image-compression:**
- Risk: `package.json` includes `browser-image-compression@^2.0.2`. This is a third-party library with limited maintenance activity.
- Impact: Image compression for vision input depends on this library. If it becomes unmaintained and a security issue is found, there's no upgrade path.
- Migration plan: Review compression code in `src/app/page.tsx` and consider inlining the compression logic using Canvas or a more actively maintained library.

## Missing Critical Features

**No Preset Metadata Auditing:**
- Problem: Presets are generated and served to the user, but there's no way to track which presets were generated from which RigIntents or user sessions.
- Blocks: Users cannot retrieve or rebuild a previously generated preset without re-running the interview.
- Recommended: Add preset versioning and metadata storage (even if just in IndexedDB on the client side).

**No A/B Comparison of Models:**
- Problem: The planner generates a single ToneIntent with fixed model choices. If the user wants to hear what the same preset would sound like with a different amp, they must restart the interview.
- Blocks: Advanced users cannot quickly iterate on model choices.
- Recommended: Allow the planner to generate multiple ToneIntent variants (e.g., "same tone, 3 different amps"). Return all variants and let the user pick.

**No Rig Inventory Persistence:**
- Problem: Vision analysis of a rig produces a RigIntent, but this is not saved. If the user uploads the same rig photo again, it must be re-analyzed.
- Blocks: Users with large rigs must re-upload photos for multiple presets.
- Recommended: Cache RigIntent in localStorage (or a backend service) keyed by image hash, with user controls to invalidate.

## Test Coverage Gaps

**Rig Mapping Fallback Tiers Not Covered:**
- What's not tested: The "close" and "approximate" substitution tiers in `src/lib/rig-mapping.ts` have no dedicated tests. Only the happy path (direct matches) is verified.
- Files: `src/lib/rig-mapping.test.ts`
- Risk: If category fallback logic is accidentally broken, tests will not catch it. Users would receive "approximate" matches instead of "close" matches without knowing.
- Priority: High

**Pod Go Block Limit Enforcement Not Tested:**
- What's not tested: `src/lib/helix/chain-rules.ts` enforces a 10-block limit for Pod Go, but there are no tests confirming that a chain with 11+ blocks is rejected.
- Files: `src/lib/helix/chain-rules.test.ts`
- Risk: A regression could allow invalid Pod Go presets to be generated, causing HX Edit import failures.
- Priority: High

**Vision Route Validation Roundtrip:**
- What's not tested: The vision route (`src/app/api/vision/route.ts`) accepts images and returns a RigIntent, but there are no end-to-end tests confirming that the returned RigIntent is valid and can be passed to `/api/generate` without errors.
- Files: No E2E tests found
- Risk: A bug in the vision planner could return invalid RigIntent, which would crash the generate route.
- Priority: Medium

**Snapshot DSP Assignment Not Covered:**
- What's not tested: `src/lib/helix/snapshot-engine.ts` assigns parameters to blocks across both DSPs, but there are no tests confirming that DSP0/DSP1 parameters are correctly partitioned.
- Files: `src/lib/helix/snapshot-engine.test.ts`
- Risk: A block could be assigned to the wrong DSP, causing audio routing issues in the final preset.
- Priority: Medium

**Empty Substitution Map Handling:**
- What's not tested: In `src/app/api/generate/route.ts`, the code checks `if (substitutionMap && substitutionMap.length > 0)` before building toneContext. But there are no tests confirming that an empty substitution map (all pedals unmapped) is handled gracefully.
- Files: `src/lib/rig-mapping.test.ts`
- Risk: Silent failure or undefined behavior if all user pedals fall through to null.
- Priority: Low

---

*Concerns audit: 2026-03-02*
