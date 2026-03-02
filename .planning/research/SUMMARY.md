# Research Summary — HelixAI v1.3 Rig Emulation

**Project:** HelixAI v1.3 Rig Emulation
**Domain:** Vision AI + physical pedal mapping integrated into an existing Planner-Executor guitar preset system
**Researched:** 2026-03-02
**Confidence:** HIGH (all claims verified against official Anthropic, Vercel, and Line 6 documentation; codebase inspected directly)

> **Note on FEATURES.md:** The existing FEATURES.md contains v1.2 Pod Go research and was intentionally excluded from this synthesis. Feature scope for v1.3 is derived from ARCHITECTURE.md and PITFALLS.md.

---

## Executive Summary

HelixAI v1.3 adds the ability to photograph a physical guitar pedal board and receive a Helix preset that emulates that specific rig. This is a two-part problem: vision AI reads pedal labels and knob positions from photos, then a deterministic mapping layer translates physical pedals to their closest Helix equivalents. The critical design insight from research is that these are two separate concerns — vision extraction is noisy and AI-driven, while pedal-to-Helix mapping must be a curated static lookup table, never delegated to the AI's general gear knowledge. Conflating them into a single Claude call is the primary architectural trap to avoid.

The vision API decision is settled: use Claude Sonnet 4.6 (already in the codebase) with base64 image content blocks. All three evaluated options — Claude Sonnet 4.6, Gemini Flash, and Google Cloud Vision — share the same fundamental spatial reasoning limitation for reading rotary knob positions. The accuracy difference between Claude and Gemini is negligible for this task. Claude wins decisively on zero integration cost: no new SDK, no new API key, no new error surface. The only new dependency is `browser-image-compression` (v2.0.2) for client-side payload reduction before upload. This is architecturally a clean extension of what already exists.

The dominant production risk is not accuracy — it is silent wrong answers. A pedal photographed in poor lighting may be confidently misidentified. A boutique pedal not in the mapping table may be fuzzy-matched to the wrong Helix equivalent. Knob positions extracted as precise percentages will be systematically unreliable. Every one of these failure modes looks like a success — no error message, plausible output. The mitigation is a consistent uncertainty representation throughout the pipeline: vision extraction returns a `confidence` field, mapping returns a `matchTier` (direct/close/approximate/unknown), and knob positions are coarse zones (low/mid/high), never false-precision percentages.

---

## Key Findings

### 1. Vision API Decision

**Use Claude Sonnet 4.6.** The decision is architectural, not accuracy-based.

| Option | Knob Reading | Integration Cost | Decision |
|--------|-------------|-----------------|----------|
| Claude Sonnet 4.6 | LIMITED — clock-face spatial reasoning problem | ZERO — existing SDK | **Use this** |
| Gemini 2.0/2.5 Flash | LIMITED — same weakness | HIGH — new SDK, new API key | Only at >50k sessions/month |
| Google Cloud Vision API | NOT APPLICABLE — no rotary reasoning | HIGH — two API calls, two keys | Never for this task |

The official Anthropic docs explicitly state Claude "may struggle with tasks requiring precise localization, like reading an analog clock face." Reading a knob is the same task. This limitation applies equally to Gemini. **Design consequence:** prompt for coarse zones (low / medium-low / medium-high / high), not precise percentages. LLMs reliably distinguish "fully counterclockwise" from "noon" from "fully clockwise." Sub-10% precision is not achievable from any current vision LLM.

**New dependencies (one only):**
- `browser-image-compression@2.0.2` — client-side compression before upload. Targets 800KB/image, max 1568px edge (Claude's optimal dimension), runs in a Web Worker. Install: `npm install browser-image-compression`. Client-side only — import inside `"use client"` components.

No new server-side packages. No new API keys. Existing `@anthropic-ai/sdk` already supports image content blocks.

**Payload budget (Vercel 4.5MB hard limit):**
- 1 image @ 800KB compressed = ~0.9MB binary payload — safe
- 3 images @ 800KB each = ~2.5MB — safe
- 4+ images — enforce client-side rejection with explicit user message; do not silently drop

### 2. Architecture Decision: Two-Step Flow

**Use the two-step pre-processing architecture.** This is the definitive recommendation.

```
Step 1: callRigVisionPlanner(images[]) -> RigIntent          [NEW: rig-vision.ts]
        One Claude call. All images labeled "Pedal 1:", "Pedal 2:", etc.
        Returns: { pedals: [{ brand, model, fullName, knobPositions, confidence }] }

Step 2: mapRigToToneIntent(rigIntent, device) -> SubstitutionMap  [NEW: rig-mapping.ts]
        Deterministic static lookup. No AI involved.
        Returns: { substitutions[], toneContext, unmappedPedals[] }

Step 3: callClaudePlanner(messages, device, toneContext?) -> ToneIntent  [MODIFIED: planner.ts]
        Existing planner, unchanged behavior. toneContext appended to user message array.
        NOT to the system prompt — prompt cache on system prompt is fully preserved.
```

The single-call alternative (pass images directly to the existing planner and let Claude handle mapping) was rejected for five reasons: the mapping is invisible and non-auditable, `ToneIntent` and `RigIntent` are fundamentally different schemas, failures corrupt the entire preset rather than being isolated to the vision step, it violates the existing Planner-Executor architectural invariant, and there is no way to fix a wrong mapping without a prompt rewrite and full regression test.

**New files (3):**
- `src/lib/helix/rig-intent.ts` — Zod schemas: `PhysicalPedalSchema`, `RigIntentSchema`, `SubstitutionEntrySchema`, `SubstitutionMapSchema` (~60 lines, zero external dependencies)
- `src/lib/rig-vision.ts` — `callRigVisionPlanner(images[])` — single Claude call with all images, returns `RigIntent`
- `src/lib/rig-mapping.ts` — `PEDAL_HELIX_MAP` curated lookup table + `mapRigToToneIntent()` — fully deterministic

**Modified files (4):**
- `src/app/page.tsx` — image upload UI, substitution card display, send images in POST
- `src/app/api/generate/route.ts` — orchestrate vision → mapping → planner when images are present
- `src/lib/planner.ts` — add `toneContext?: string` as third param, append to conversation text
- `src/lib/helix/index.ts` — export rig-intent types

**Unchanged (everything in the Knowledge Layer):** `chain-rules.ts`, `param-engine.ts`, `snapshot-engine.ts`, `preset-builder.ts`, `podgo-builder.ts`, `tone-intent.ts`, `models.ts`, `types.ts`, `validate.ts`, `gemini.ts`

**Key schema decisions:**
- `knobPositions` in `PhysicalPedalSchema`: `Record<string, number>` internally (0–100), extracted as coarse zones from vision prompt
- `SubstitutionEntry.confidence`: enum `"direct" | "close" | "approximate"` — used in UI display and decision gating
- `toneContext`: injected into user messages array, never the system prompt (preserves prompt caching)
- `substitutions?: SubstitutionEntry[]`: parallel field on the API response, never inside `ToneIntent`

### 3. Critical Production Risks

**The overarching risk: silent wrong answers.** None of these produce error messages. All look like success.

**Pitfall 1 — Vercel 4.5MB body limit kills image uploads before the handler runs.**
An uncompressed smartphone photo (4–10MB) or a 3.5MB JPEG base64-encoded to JSON (~4.7MB) hits the hard Vercel limit. The 413 error arrives before any handler code executes.
Prevention: `browser-image-compression` targeting 800KB/image, max 3 images. Validate and warn client-side before upload. Enforce the 3-photo limit explicitly in UI.

**Pitfall 2 — Vercel 10-second timeout on the combined vision + planner call.**
Cold start (~1–3s) + vision call (~5–15s) + planner call (~5–8s) = 30+ seconds. Default Hobby plan limit is 10 seconds. Results in 504 errors on cold starts.
Prevention: add `export const maxDuration = 60;` to the vision route. Enable Fluid Compute in the Vercel dashboard (required — this does not work automatically). Consider a dedicated `/api/vision` route separate from `/api/generate` so each call has its own timeout budget and the existing generate flow is not disrupted.

**Pitfall 3 — Confident wrong pedal identification from low-quality photos.**
Claude returns "Ibanez TS9 Tube Screamer" for a TC Electronic MojoMojo photographed in dim light. The mapping table maps the misidentification to the wrong Helix model. The user gets a wrong preset with no indication anything failed.
Prevention: include `confidence: "high" | "medium" | "low"` in `PhysicalPedalSchema`. Instruct Claude explicitly in the extraction prompt: "If you cannot identify the pedal make and model with confidence, return `modelName: null`." Surface low-confidence identifications for user confirmation before mapping.

**Pitfall 5 — RigIntent in the system prompt breaks prompt caching.**
The tempting shortcut is adding rig context to `buildPlannerPrompt()`. This changes the system prompt per request, dropping `cache_read_input_tokens` to 0 and doubling API costs.
Prevention: inject `toneContext` as the final entry in the user messages array, never the system prompt. Verify after implementation: `cache_read_input_tokens > 0` in Anthropic API response.

**Pitfall 7 — Vision integration breaks the existing [READY_TO_GENERATE] signal flow.**
Adding image payloads to the existing `/api/generate` JSON body entangles vision extraction with preset generation. Failures in vision affect text-only users. The route body approaches or exceeds the 4.5MB limit.
Prevention: keep vision extraction in a separate `/api/vision` route. The existing `/api/generate` contract does not change. If no images are provided, the vision route is never called.

**Pitfall 6 — Static mapping table confidently maps boutique pedals to wrong Helix models.**
The table covers common pedals. A Mythos Mjolnir or Walrus Audio Eras has no entry. Fuzzy fallback matching by category produces wrong confident matches that look like successes.
Prevention: build three explicit match tiers — `"direct"` (exact table entry), `"close"` (same circuit topology), `"approximate"` (closest available) — plus `"unknown"` for no match. Surface each tier differently in UI. For `"unknown"`, never guess; show "we don't have this pedal — treating as [category]" with user confirmation.

### 4. Key Implementation Patterns

**Coarse knob zones, not percentages.**
Vision prompt should request clock-face positions ("7 o'clock" through "5 o'clock") or labeled zones ("low / medium-low / medium-high / high"). The mapping layer translates zones to Helix parameter values. Never request precise percentages — the resulting numbers will be unreliable and silently wrong. Sanity check: if all extracted knob values cluster near 50%, Claude could not read individual positions.

**toneContext injected as user message, not system prompt.**
Add optional `toneContext?: string` parameter to `callClaudePlanner`. Append it to `conversationText` after the message join: `conversationText += \`\n\n[RIG CONTEXT]\n${toneContext}\n...\`` . The system prompt block with `cache_control: { type: "ephemeral" }` remains identical across all requests. Prompt caching is preserved.

**Separate `/api/vision` route.**
`/api/generate` currently accepts `{ messages, device }`. Do not add image payloads to this body. A separate `POST /api/vision` handles image-to-RigIntent extraction only. Its response (`RigIntent` + substitutions) feeds into the generate flow via `toneContext`. If vision fails, generation proceeds with the text-only flow. The existing `[READY_TO_GENERATE]` signal path is completely unchanged.

**Match tiers in PEDAL_HELIX_MAP.**
Every entry in `PEDAL_HELIX_MAP` carries `confidence: "direct" | "close" | "approximate"`. Missing entries produce `"unknown"` — never a guessed match. The substitution card UI differentiates visually: direct matches get the full card with rationale; approximate/unknown matches show reduced emphasis with a clear "best available" label.

**Single multi-image Claude call.**
Pass all pedal photos in one `client.messages.create` call with labeled content blocks ("Pedal 1:", "Pedal 2:"). The Claude API supports up to 100 images per request. Calling once per photo multiplies cost and latency proportionally — three photos means 3x cost and 15–30 additional seconds.

**Substitution card display names, not internal IDs.**
`rig-mapping.ts` must store both `helixModelId` (for the preset builder, e.g., `HD2_DistTeemah`) and `helixModelDisplayName` (for the UI, e.g., "Teemah!"). The `models.ts` data model already separates these fields. Never render `HD2_*` strings in the substitution card. Rationale text must use guitarist vocabulary: "mid-hump EQ character," "asymmetric clipping," "transparent boost" — not confidence scores or technical IDs.

---

## Implications for Roadmap

The ARCHITECTURE.md build order maps directly to a 5-phase structure. Each phase is independently testable before the next begins. Dependencies determine order strictly.

### Phase 1: Schemas and Types
**Rationale:** Every other new module imports from here. Nothing else compiles until these exist. Zero external dependencies — testable with Zod alone.
**Delivers:** `src/lib/helix/rig-intent.ts` with `PhysicalPedalSchema`, `RigIntentSchema`, `SubstitutionEntrySchema`, `SubstitutionMapSchema`. Updated `src/lib/helix/index.ts` exports.
**Addresses:** Schema ambiguity that would force retroactive changes if deferred; type safety for all downstream code.
**Avoids:** Pitfall 3 and Pitfall 6 (confidence and matchTier fields designed in from the start, not patched on later).
**Scope:** ~60 lines. Done when all types compile and Zod schemas parse correctly against example JSON.

### Phase 2: Pedal Mapping Table
**Rationale:** Pure data + deterministic logic. No Claude API dependency. Can be built and tested in isolation. Mapping quality determines the quality of the entire feature.
**Delivers:** `src/lib/rig-mapping.ts` — `PEDAL_HELIX_MAP` (40–60 curated entries at launch) with match tiers, `mapRigToToneIntent()`, `unmappedPedals[]` handling, `toneContext` string builder.
**Target coverage at launch:** Boss SD-1/DS-1/BD-2/OD-3/CE-5, Ibanez TS5/TS9/TS808/TS10, ProCo Rat, EHX Big Muff variants (NYC/Green Russian/Triangle), Fulltone OCD, MXR Phase 90/Dyna Comp/Carbon Copy, common amp names in text (Fender Twin, Marshall JCM800, Mesa Boogie Rectifier).
**Addresses:** Pitfall 6 (match tiers prevent confident wrong boutique pedal matches), Pitfall 4 (coarse zone design intent baked into the knob translation interface from the start).
**Research flag:** Knob translation functions (physical % → Helix 0–1 scale) require per-model knowledge that is not documented anywhere. Start with linear identity mapping. Flag for post-launch tuning from user feedback.

### Phase 3: Vision Extraction
**Rationale:** References Phase 1 types. Tested against Phase 2 mapping to verify end-to-end extraction → mapping before touching any route or UI code.
**Delivers:** `src/lib/rig-vision.ts` — `callRigVisionPlanner(images[])` returning validated `RigIntent`. Single multi-image Claude call with labeled content blocks. Coarse zone prompting. Confidence field populated.
**Uses:** Claude Sonnet 4.6 via existing `@anthropic-ai/sdk`. No new dependencies.
**Addresses:** Pitfall 3 (confidence in schema and prompt), Pitfall 4 (clock-face prompting for knob positions).
**Testing baseline:** Use a high-quality JPEG of a Boss SD-1 or Ibanez TS9 — well-documented pedals Claude will recognize reliably. Confirm `RigIntentSchema.parse()` succeeds and `confidence` field is populated.

### Phase 4: API Route and Planner Integration
**Rationale:** Wires the full backend pipeline. Route orchestrates vision → mapping → planner in sequence when images are present. Existing text-only flow is completely untouched.
**Delivers:** Modified (or new `/api/vision`) route handling image upload and extraction. Modified `src/lib/planner.ts` accepting `toneContext?`. Response extended with `substitutions?: SubstitutionEntry[]` and `unmappedPedals?: string[]`.
**Addresses:** Pitfall 5 (toneContext in user message array, not system prompt), Pitfall 2 (`maxDuration` export + Fluid Compute verification), Pitfall 7 (separate route preserves existing generate flow).
**Verification gate (mandatory before Phase 5):**
- Generate a preset WITHOUT images — behavior identical to v1.2, no new loading states, no changed response shape.
- Check Anthropic API response: `cache_read_input_tokens > 0` confirming prompt caching intact.
- Deploy to Vercel and trigger a cold-start vision call — confirm no 504 errors.

### Phase 5: Browser Image Upload UI and Substitution Card
**Rationale:** UI is the last layer. Backend API contract must be stable before building against it.
**Delivers:** File input or drag-drop in the chat input section. Client-side compression via `browser-image-compression`. Image thumbnail previews with remove button. `SubstitutionCard` component showing substitutions in the preset result view.
**Uses:** `browser-image-compression@2.0.2` (`maxSizeMB: 0.8`, `maxWidthOrHeight: 1568`, `useWebWorker: true`).
**Addresses:** Pitfall 1 (compression gate before upload), Pitfall 8 (substitution card shows display names, not `HD2_*` IDs, with guitarist vocabulary rationale).
**Implementation notes:**
- Store `File` objects in React state, convert to base64 only at generate time — prevents 6MB base64 strings in component state causing slow re-renders.
- Max 3 photos enforced with explicit warning, not silent drop.
- Progressive status indicators: "Analyzing pedal photo..." → "Mapping to Helix models..." → "Building preset..." — essential at 15–20 second total latency.
- Differentiate substitution card display by match tier: full confident card for `"direct"`, reduced emphasis with "best available match" label for `"approximate"` and `"unknown"`.

### Phase Ordering Rationale

- Phases 1 → 2 → 3 follow strict import dependencies: schemas must exist before mapping logic, mapping must exist before vision calls reference it.
- Phase 2 before Phase 3 enables isolated testing of the deterministic mapping layer before any Claude API calls are involved — faster iteration and easier debugging.
- Phase 4 before Phase 5 ensures the API response contract is final before the UI is built against it, preventing a UI rewrite if the response shape needs adjustment.
- Backend-complete before UI reduces rework risk across all phases.

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1 (Schemas):** Standard Zod. Schema design is fully specified in ARCHITECTURE.md.
- **Phase 3 (Vision):** Claude vision API patterns are official and verified. Coarse zone prompting approach is clear.
- **Phase 5 (UI):** `browser-image-compression` API is documented and stable.

Phases that need targeted investigation during implementation:
- **Phase 2 (Mapping Table — knob translation):** Per-pedal knob taper curves (linear vs. logarithmic vs. stepped) are not documented publicly. Start with linear identity mapping. Budget time post-launch for a feedback-driven tuning pass. This is inherently empirical, not researchable.
- **Phase 4 (Route — timeout verification):** Must verify that `export const maxDuration = 60;` on the Vercel project's current plan and Fluid Compute configuration produces the expected 60-second budget. Test with a real cold-start deploy, not local dev. If the two-call combined latency still exceeds the budget, the fallback is a two-request client flow (POST `/api/vision` → POST `/api/generate`) — design Phase 4 so this split is possible without UI rewrite.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Vision API choice (Claude Sonnet 4.6) | HIGH | Official Anthropic docs verified; spatial reasoning limitation explicitly documented; cost math from official pricing pages |
| Image upload approach (FormData + compression) | HIGH | Vercel 4.5MB limit from official KB; `browser-image-compression` API verified from npm + GitHub |
| Two-step architecture | HIGH | Based on direct codebase inspection of `planner.ts`, `route.ts`, `page.tsx`; matches existing architectural invariants |
| Schema design | HIGH | Zod schema design derived from explicit data requirements with no ambiguity |
| Vercel production constraints | HIGH | Official Vercel docs; limits are hard and version-independent |
| Vision accuracy limitations | HIGH | Official Claude docs quote the clock-face limitation verbatim; industrial vision research corroborates |
| Mapping table content quality | MEDIUM | Which entries to include and how to translate knob scales per pedal is judgment-based; requires curation and tuning |

**Overall confidence: HIGH.** The three key decisions — vision API provider, two-step architecture, and coarse-zone knob extraction — are all strongly supported by official documentation and direct codebase analysis. The only MEDIUM area is mapping table content, which is a curation problem rather than a research problem.

### Gaps to Address During Implementation

- **Knob translation accuracy per pedal model:** Linear identity mapping is the starting point but is likely wrong for pedals with non-linear tapers (Boss numbered dials 1–10, Fender-style controls). Flag for a post-launch user feedback loop. Do not attempt to solve before launch.
- **PEDAL_HELIX_MAP boutique coverage:** The 40–60 entry launch target covers the most common stomps. Users with boutique boards will hit the `"unknown"` tier frequently in early versions. The match tier system handles this gracefully; coverage expands over time as entries are added.
- **Fluid Compute enablement:** Must be verified in the Vercel project dashboard before Phase 4 is considered complete. Cannot be tested locally — cold-start behavior does not exist in `next dev`.
- **Two-request fallback for timeout budget:** If vision + planner in one function invocation consistently exceeds the timeout budget even with Fluid Compute, the client must orchestrate two sequential requests. Build Phase 4 to make this split possible without requiring UI changes.

---

## Sources

### Primary (HIGH confidence)
- Anthropic Vision Docs (verified 2026-03-02) — image token formula, spatial reasoning limitation ("like reading an analog clock face"), 5MB/image API limit, base64 integration, multi-image support up to 100 images: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic Pricing (verified 2026-03-02) — Claude Sonnet 4.6 at $3/MTok input, prompt caching multipliers: https://platform.claude.com/docs/en/about-claude/pricing
- Anthropic Structured Outputs Docs — `output_config.format` compatible with vision input in same call: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Vercel Functions Limits (official) — 4.5MB body limit hard, Fluid Compute up to 300s on Hobby: https://vercel.com/docs/functions/limitations
- Vercel Body Size KB (official) — client-side upload as recommended mitigation: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
- Direct codebase inspection — `planner.ts`, `route.ts`, `page.tsx`, `models.ts`, `tone-intent.ts`, `helix/index.ts` read in full; integration points verified against actual code

### Secondary (MEDIUM confidence)
- `browser-image-compression` npm/GitHub — v2.0.2, Web Worker support, MIT license: https://www.npmjs.com/package/browser-image-compression
- Google Gemini API Pricing — Gemini 2.0 Flash at $0.10/MTok: https://ai.google.dev/gemini-api/docs/pricing
- Gemini 2.0 Flash OCR accuracy — 98.2% on printed text: https://reducto.ai/blog/lvm-ocr-accuracy-mistral-gemini

### Tertiary (MEDIUM confidence — derived, not guitar-specific)
- Edge Impulse knob monitoring research — confirms accuracy drop with lighting and angle variation: https://docs.edgeimpulse.com/experts/computer-vision-projects/dials-and-knob-monitoring-with-computer-vision-raspberry-pi
- MDPI Sensors academic research — low SNR, angle deformation, inconsistent features as primary failure modes for industrial knob reading: https://www.mdpi.com/1424-8220/22/13/4722

---

*Research completed: 2026-03-02*
*Ready for roadmap: yes*
