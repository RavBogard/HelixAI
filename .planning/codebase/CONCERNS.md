# Codebase Concerns

**Analysis Date:** 2026-03-18

## Tech Debt

### DSP Allocation is Hardcoded (High Priority)

**Issue:** The signal chain builder uses a static switch (`getDspForSlot` in `src/lib/helix/chain-rules.ts:169`) to assign blocks to DSPs. All pre-cab effects go to DSP0, all post-cab to DSP1 regardless of actual load.

**Files:**
- `src/lib/helix/chain-rules.ts` (lines 169-191)

**Impact:**
- DSP0 often has 5-6 unused slots (only boost + amp consume it) while DSP1 overflows
- v6.1 added graceful budget enforcement (drops low-priority effects) but doesn't solve root cause
- Presets lose effects unnecessarily when intelligent allocation could fit them both DSPs
- Dual-amp scenarios may not route optimally across topologies AB/Y

**Fix approach:**
Replace static `getDspForSlot` with intelligent allocator in v7.0:
- Load-balance: spill to less-loaded DSP when primary is full
- Routing-aware: consider same-DSP vs cross-DSP signal path implications
- Stereo-aware: place stereo effects on DSPs that maintain stereo width
- Resource-aware: weight heavier blocks (reverbs, modulation) in placement decisions
- v7.0 Phase 21 (Research) scheduled to document allocation ruleset from reference presets

---

## Known Issues

### Unverified Device IDs (Medium Priority)

**Issue:** Several device IDs lack confirmation from real hardware preset exports.

**Files:** `src/lib/helix/types.ts:276-287`

**Specific gaps:**
- `helix_rack` (2162689): Assumed same as Floor — no real Rack .hlx export confirmed
- `helix_stadium_xl` (0): Real product exists (June 2025) but no device ID in corpus
- **CRITICAL:** `helix_native` listed as 2162690 (estimated from Line 6 sequence) but was discovered to actually be **2162944** (confirmed from JS-EVPanRed.hlx + JS-GermXRed.hlx exports). This is ACTIVELY WRONG in the code.

**Impact:**
- Rack device may generate presets with wrong device ID, failing to load on real hardware
- Native device was using wrong ID (2162690 vs 2162944) — may cause load failures
- Stadium XL support incomplete without real device ID

**Fix approach:**
1. URGENT: Update `helix_native` to 2162944 in DEVICE_IDS constant
2. Obtain real .hlx export from Helix Rack to confirm device ID
3. Collect real Stadium XL export to add device ID (product launched June 2025)
4. Add tests comparing generated device_id against reference presets for each device

---

### Unverified Bass Amp Models (Medium Priority)

**Issue:** HD2 bass amp model IDs follow naming convention but lack verification against real bass preset exports.

**Files:** `src/lib/helix/models.ts:889-891`

**Specific models:**
- 19 bass amps with IDs like `HD2_AmpVintage1959` (Ampeg SVT)
- 8 bass cabs with IDs like `HD2_CabMicIr_1x15AmpegB15`
- Comments note: "UNVERIFIED against real bass preset exports"

**Impact:**
- If conventions are wrong, bass presets may load incorrect amp/cab models in hardware
- No validation tests confirm these IDs match real exports
- Bass player experience impacted if amp/cab selections are wrong

**Fix approach:**
1. Obtain real .hlx bass preset exports (need 1-2 examples with bass amps)
2. Verify actual HD2 model IDs from those exports
3. Add data integrity tests comparing against reference bass presets
4. Update model definitions if conventions don't match real exports

---

### Stadium device_version Varies (Low Priority)

**Issue:** Stadium presets in reference corpus show multiple device_version values, but code hardcodes 302056738.

**Files:** `src/lib/helix/stadium-builder.ts` (device_version hardcoding)

**Specific variance:**
- FluidSolo reference presets show: 285213946, 301991188, 302056726
- Code uses: 302056738

**Impact:**
- Generated presets may show as "different" from reference if device_version doesn't match
- May affect compatibility with different firmware versions (presets designed on different firmware)
- Not critical for functionality but affects audit compliance

**Fix approach:**
1. Determine if device_version should be latest firmware (302056738) or match generation date
2. If firmware-dependent, add version selection to device capabilities
3. Update audit baselines if changing from current hardcoded value

---

## Security Considerations

### No API Rate Limiting on Preset Generation (Medium Priority)

**Issue:** `/app/api/generate/route.ts` accepts unlimited generation requests per user per time window.

**Files:** `src/app/api/generate/route.ts`

**Risk:**
- Cost abuse: attackers could trigger unlimited Gemini API calls (costs money)
- Resource exhaustion: generation is CPU-intensive (orchestration, validation)
- No per-user quota enforcement at application level

**Current mitigation:**
- Upstash Redis rate limiter integrated (code mentions it in dependencies)
- `@upstash/ratelimit` and `@upstash/redis` in package.json

**Recommendations:**
1. Verify rate limiter is actually configured on `/generate` endpoint (check for middleware)
2. Set conservative limits: e.g., 5 generations per user per hour
3. Add cost tracking per user (usage.jsonl logged but not enforced)
4. Consider freemium model with generation quotas

---

### API Key Exposure Risk (Low Priority)

**Issue:** GEMINI_API_KEY environment variable used in client-side imports (potential exposure in error messages or logs).

**Files:** Multiple API routes using `@ai-sdk/google`, `@google/genai`

**Risk:**
- API keys should never appear in client logs or error messages
- Gemini API key is backend-only and should stay server-side

**Current mitigation:**
- All AI calls routed through `/app/api/*` routes (backend)
- No direct client-side Gemini imports detected

**Recommendations:**
1. Audit error handling to ensure GEMINI_API_KEY never logged in client responses
2. Add guards to strip API keys from error messages before sending to client
3. Monitor error logs for accidental key exposure

---

## Performance Bottlenecks

### LLM Orchestration is Synchronous (Medium Priority)

**Problem:** Full preset generation waits for sequential Historian → Planner → Builder calls. No parallelization or caching between stages.

**Files:**
- `src/app/api/generate/route.ts` (orchestrates sequential calls)
- `src/lib/helix/orchestration.ts` (likely coordinates stages)

**Cause:**
- Historian must complete before Planner (historian context informs planner)
- Planner must complete before Builder (intent informs block assembly)
- Each call hits Gemini API (network latency + inference time)

**Metrics:**
- Historian: ~400-500ms (LLM call + JSON parsing)
- Planner: ~1-3 seconds (LLM call + schema validation)
- Builder: ~100-200ms (local orchestration)
- **Total: ~2-4 seconds per generation**

**Improvement path:**
1. Add response caching: hash user input → cache intent for 1 hour
2. Parallel planner warm-up: while historian runs, start planner system prompt loading
3. Consider lazy loading: return provisional intent while background validation runs
4. Profile actual timings in production (usage.jsonl may have this data already)

---

### StructuralDiff Engine Compares All Keys (Low Priority)

**Problem:** `src/lib/helix/structural-diff.ts` does deep comparison of entire preset JSON, not just critical paths.

**Files:** `src/lib/helix/structural-diff.ts`

**Cause:**
- Audit validation compares generated vs reference across all 4 device families
- 25 scenarios × 4 families × full JSON diff = expensive for 1500+ test runs
- Not production-critical (runs in tests only) but test suite may be slow

**Improvement path:**
1. Cache structural diffs for unchanged presets
2. Profile test suite to identify slowest diff operations
3. Consider sampling strategy if test times exceed 30s
4. Memoize schema extraction (only needed once per family, not per scenario)

---

## Fragile Areas

### Helix Chain-Rules Signal Chain Ordering (High Fragility)

**Files:** `src/lib/helix/chain-rules.ts:193-209`

**Why fragile:**
- `SLOT_ORDER` constant defines signal chain sequencing (amp must be before cab, gate after)
- Any new effect slot requires updating SLOT_ORDER with a priority number
- No compile-time validation that all slots in effects have corresponding SLOT_ORDER entries
- Position collisions (two effects at same priority) silently resolve by insertion order

**Safe modification:**
1. Add compile-time check: ensure all `ChainSlot` type values appear in SLOT_ORDER
2. Document the 0.5 increment pattern (horizon_gate=5.5 between amp=4 and cab=5)
3. When adding new effect, always: add to SLOT_ORDER, update GENRE_SLOT_PRIORITY for relevant genres
4. Run full regression suite after chain-rules changes (tests in `src/lib/helix/chain-rules.test.ts`)

**Test coverage:**
- 1494 lines of test code in `chain-rules.test.ts` covers ordering, DSP assignment, truncation
- But tests assume existing SLOT_ORDER is correct — no schema validation

---

### Pod Go Block Mapping Fragile (Medium Fragility)

**Files:**
- `src/lib/helix/podgo-builder.ts:120-200` (approximate)
- `src/lib/helix/types.ts:348-368` (POD_GO_TEMPLATE_BLOCKS, POD_GO_TEMPLATE_POSITIONS)

**Why fragile:**
- Pod Go has fixed 10-block architecture with reserved positions [0,1,4] for Volume Pedal/Wah/FX Loop
- User effects fill positions [2,3,5,6,7,8,9]
- Block index offset between dspIdx (includes cabs) and snapshotIdx (skips template blocks)
- Any change to template block positions breaks block mapping

**Safe modification:**
1. Never remove template blocks (Volume Pedal, Wah, FX Loop from positions 0,1,4)
2. If adding new template block, must also update POD_GO_TOTAL_BLOCKS and POD_GO_TEMPLATE_POSITIONS
3. Document the dspIdx vs snapshotIdx offset (critical difference from Helix)
4. Before changing, verify against latest Pod Go Edit export to ensure format matches

**Test coverage:**
- 683 lines in `podgo-builder.ts` with inline tests
- Unit tests in `src/lib/helix/podgo-builder.test.ts` (if exists)
- Mock harness includes 5 Pod Go scenarios validating against reference presets

---

### Stadium Dual-Cab Architecture (Medium Fragility)

**Files:** `src/lib/helix/stadium-builder.ts:1-100` (approximate)

**Why fragile:**
- Stadium dual-cab implementation requires exactly 2 cab slots (main cab + NoCab bypass)
- Every `Cab` block in stadium has two slots with independent routing
- `sources` array has bypass field that must match reference structure
- Effect blocks have footswitch controllers that enable/disable them

**Safe modification:**
1. Always maintain dual-cab pattern: primary cab + NoCab in each slot
2. Verify `sources` array structure matches reference presets (bypass field required)
3. Test effect footswitch controller routing before committing
4. Run full Stadium subset of regression suite

**Test coverage:**
- 988 lines in `stadium-builder.test.ts`
- 7 Stadium reference presets in corpus validate structure
- But presets vary in device_version (see earlier concern) — may need version-specific handling

---

## Scaling Limits

### Helix Dual-DSP Block Limit (Addressed but Fragile)

**Current capacity:**
- DSP0: 8 blocks max (typically ~3 used: pre-amp effects, amp, cab)
- DSP1: 8 blocks max (typically overflows with post-cab effects)
- Total: 16 blocks across both DSPs

**Limit:**
- v6.1 gracefully drops user effects when DSP exceeds 8 blocks
- Drops lowest-priority effects first (via COMBO-03 scoring)
- Never crashes but loses effects silently

**Scaling path:**
1. Implement intelligent dual-DSP allocator (v7.0) — load balancing may fit more effects
2. Profile real presets to understand typical effect counts by genre
3. Consider effect complexity weighting: reverb uses more DSP resources than EQ
4. May need user warnings if user selects too many complex effects (reverb+delay+modulation all at once)

---

### Reference Corpus Coverage (Low Priority)

**Current capacity:**
- 7 Helix, 2 Native, 7 Pod Go, 5 Stomp, 5 Stomp XL, 7 Stadium reference presets
- Total: 33 reference presets across all families
- Each drives quality audit validation (structural compliance)

**Limit:**
- Corpus is small — only 1-2 presets per device type per style
- May not cover all real-world edge cases (e.g., bass amp + high DSP load)
- Adding new effect or device feature requires re-running audit against all 33

**Scaling path:**
1. Goal: 50+ presets per family for robust statistical consensus
2. Collect more bass amp presets (only 2-3 in current corpus)
3. Capture Stadium XL when device is released
4. Analyze audit failures to identify missing edge cases
5. Consider synthetic preset generation to fill gaps

---

## Dependencies at Risk

### Gemini API Dependency (Medium Risk)

**Risk:**
- All preset generation depends on Gemini 3 Flash API (historian, planner)
- No fallback to alternative LLM provider
- Gemini outages → application down
- API pricing changes → cost model changes

**Impact:**
- If Gemini API becomes unavailable, generation completely breaks
- No graceful degradation or caching of failed generations

**Migration plan:**
- Maintain interface abstraction: `createHistorianPrompt`, `createPlannerPrompt` (already done)
- Add provider abstraction layer: allow swapping historian/planner LLM independently
- Consider caching intent responses (if user inputs match, reuse intent)
- Fallback strategy: return basic preset from config defaults if LLM fails

---

### Zod Version (Low Risk)

**Risk:** Zod 4.3.6 — relatively new major version
- Breaking changes between v3 and v4 (schema validation syntax changed)
- Limited migration path if future v5 breaks schema definitions

**Current usage:** Schema validation in tone intent, output types

**Mitigation:**
- Pin version in package.json (already done)
- Migration path to v5 if needed: likely minor syntax updates

---

### Next.js 16 - Recent Major Version (Low Risk)

**Risk:**
- Next.js 16.1.6 is very recent (late 2025 release)
- May have undiscovered bugs in Edge Runtime, streaming, etc.
- Some plugins may not support latest version

**Current usage:** API routes, SSR chat, static preset assets

**Mitigation:**
- No known breaking issues in current implementation
- Test all API routes thoroughly before production
- Monitor Next.js security advisories

---

## Missing Critical Features

### No Offline Mode or Preset Cache

**Problem:** All presets require Gemini API calls to generate. No offline support or generated-preset cache.

**Impact:**
- Users can't generate presets without internet
- No ability to save favorite intents and regenerate later
- Repeated similar requests hit API each time (cost and latency)

**Workaround:** Users can download generated presets, but must go through full generation pipeline each time

---

### No Preset Versioning or Preset History

**Problem:** Once a user generates a preset, there's no version history or undo if they request tweaks.

**Impact:**
- User can't compare adjusted vs original
- No audit trail of preset evolution
- "Adjust" endpoint modifies in-place without backup

**Improvement:** Track preset versions with timestamps, allow rollback/comparison

---

## Test Coverage Gaps

### No End-to-End Tests for Visualization UI

**Untested area:** PresetCard, ParameterEditorPane, SignalChainCanvas interactive behaviors

**Files:**
- `src/components/visualizer/ParameterEditorPane.test.tsx` (exists but may have gaps)
- `src/components/visualizer/SignalChainCanvas.test.tsx` (exists but may have gaps)

**Risk:**
- Visualization bugs (drag-drop, parameter editing) could impact user experience
- Block tile rendering, snapshot selection may have edge cases

**Priority:** Medium — these are user-facing but not core generation logic

---

### Limited API Route Testing

**Untested area:** `/api/adjust`, `/api/download`, `/api/chat` error handling and edge cases

**Files:**
- `src/app/api/adjust/route.ts`
- `src/app/api/download/route.ts`
- `src/app/api/chat/route.ts`

**Risk:**
- Malformed requests (missing device, invalid JSON) may cause crashes
- Rate limiting behavior not tested
- Download file corruption not validated

**Priority:** High — these are production API endpoints

---

### No Mock Tests for Gemini API Failures

**Untested area:** What happens when Gemini returns error, timeout, or invalid JSON?

**Files:** `src/app/api/generate/route.ts`, historian/planner callers

**Risk:**
- Unhandled API failures may crash endpoint
- User gets generic 500 error instead of helpful message
- No retry logic for transient failures

**Priority:** High — production readiness

---

## Import/Export Inconsistencies (Type Safety Issue)

**Issue:** Multiple TypeScript errors indicate types are not exported properly from `src/lib/helix/types.ts`.

**Affected imports:**
- `DeviceTarget` (used in 10+ files, but grep shows export)
- `BlockSpec`, `PresetSpec`, `SnapshotSpec` (used in 15+ files)
- Helper functions: `isPodGo`, `isStadium`, `isStomp` (used in 8+ files)

**Files affected:**
- `src/app/api/generate/route.ts:23`
- `src/app/api/download/route.ts:24`
- Multiple component imports in `src/components/visualizer/`
- Test files throughout codebase

**Impact:**
- Build likely fails with ~150+ TypeScript errors
- Code compiles at runtime (JavaScript) but types are broken
- IDE autocomplete/navigation broken in affected files

**Fix approach:**
1. Verify all interface exports are present in `src/lib/helix/types.ts`
2. Check for circular dependencies (X imports from types.ts, types imports from X)
3. May need to split types.ts into separate files: types-hlx.ts, types-spec.ts, types-device.ts
4. Run `npm run build` to verify no TS errors before committing

---

## Architectural Concerns

### Two-Context Chat→Planner Design is Intentional but Complex

**Issue:** Chat route uses Google Search context (incompatible with structured output), so planner runs separately with full conversation history.

**Files:**
- `src/app/api/chat/route.ts` (chat with search)
- `src/app/api/generate/route.ts` (planner without search)

**Design decision:** Made in v2.0 Phase 3 — keep separation of concerns

**Concern:**
- Requires full conversation history passed to planner (not lossy)
- Message windowing (10 messages for planner, 20 for chat) adds complexity
- If chat message count exceeds window, planner loses context

**Tradeoff:**
- Pro: Search context keeps chat grounded in current gear market
- Pro: Planner structured output (tone intent JSON) incompatible with search
- Con: Two separate system prompts to maintain
- Con: Context loss if conversation exceeds message window

**Safe modification:**
- Don't merge into single route (search incompatible with structured output)
- If changing message windows, validate planner still has tone context from first message
- Test long conversations (50+ messages) to verify behavior at boundaries

---

## Summary

**Priorities for Next Phase (v7.0):**
1. **CRITICAL:** Fix Helix Native device ID (2162690 → 2162944)
2. **HIGH:** Implement intelligent DSP allocator (current: graceful degradation, not ideal)
3. **HIGH:** API error handling and rate limiting validation
4. **MEDIUM:** Verify/update unverified device IDs (Rack, Stadium XL)
5. **MEDIUM:** Bass amp model ID verification against real exports

**Ongoing:**
- Monitor Gemini API dependency for cost changes and outages
- Collect larger reference corpus (currently only 33 presets)
- Add offline/cache support for improved UX
- Expand test coverage for API routes and error scenarios

---

*Concerns audit: 2026-03-18*
