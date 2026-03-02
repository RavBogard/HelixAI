# Pitfalls Research

**Domain:** Adding vision-based rig emulation (image upload + pedal mapping) to existing HelixAI system
**Researched:** 2026-03-02
**Confidence:** HIGH for Vercel/Claude API limits (official docs); HIGH for vision accuracy limitations (official Claude docs + academic industrial vision research); MEDIUM for knob position edge cases (no published benchmarks specific to guitar pedals; derived from Claude's stated spatial reasoning limitations and industrial analog dial research); HIGH for pedal mapping risks (Line 6 official model list + community knowledge); MEDIUM for pipeline integration risks (derived from code inspection of the existing planner.ts/generate/route.ts architecture)

> This document supersedes the v1.2 pitfalls document. The focus here is the risks of adding vision input (image upload) and physical rig mapping to a system that already generates Helix/Pod Go presets via a Planner-Executor architecture. The v1.2 document covered Pod Go format risks; those remain valid and are not repeated here.

---

## Critical Pitfalls

These cause silent failures, wrong mapping results, production errors, or broken existing flows.

---

### Pitfall 1: Vercel 4.5MB Body Limit Rejects Images Before They Reach the Vision API

**What goes wrong:** A user photographs their pedal board — a modern smartphone photo is 4–10MB. They upload it. The Next.js API route (`/api/generate` or a new `/api/vision` endpoint) receives the POST request. Vercel's serverless infrastructure rejects it before the handler code runs and returns `413: FUNCTION_PAYLOAD_TOO_LARGE`. The user sees a generic error. No image processing occurs.

**Why it happens:** Vercel enforces a hard 4.5MB limit on the request body size for all serverless functions on all plans (Hobby and Pro). This limit is not configurable. It applies to the entire POST body — base64-encoded image data in a JSON payload is approximately 33% larger than the raw file, so a 3.2MB JPEG becomes ~4.3MB after base64 encoding. A 3.5MB JPEG hits the limit. An iPhone 15 photo shot at default settings is approximately 5–8MB and will always fail without client-side intervention.

Additionally, the current `generate/route.ts` bundles messages as JSON in `req.json()`. Adding image payloads to this same JSON body is the natural implementation path — and the one that triggers the 413 error.

**How to avoid:**
- Compress images client-side before encoding. Use the browser Canvas API: `canvas.toBlob(callback, 'image/jpeg', 0.75)` reduces most smartphone photos to under 1MB while retaining sufficient resolution for pedal label and knob reading. Target 1000px on the long edge and 0.7–0.8 JPEG quality.
- Validate the file size before upload attempt. Show a user-readable warning ("Photo is too large — compressing…") rather than failing silently after the fact.
- Do not add image payloads to the existing `/api/generate` JSON body. Keep vision extraction as a separate API call so the main generation endpoint is not disrupted by upload failures.
- Keep the encoded image size under 3MB to stay well within the 4.5MB limit after JSON envelope overhead (other message fields, headers).

**Warning signs:**
- User reports "upload failed" or "generation failed" without any visible error message
- Console shows 413 HTTP status from Vercel
- Photos from modern smartphones consistently fail while compressed/resized test images succeed

**Phase to address:** Phase 1 (Image Upload + Vision Extraction). Client-side compression must be built and tested before any end-to-end vision flow can work in production. This is the first implementation gate.

---

### Pitfall 2: Vercel Free Tier 10-Second Timeout Breaks Vision API Calls

**What goes wrong:** The vision extraction call to Claude (`client.messages.create()` with base64 image content) takes 8–25 seconds depending on cold start, image size, and Anthropic API response time. On Vercel's Hobby (free) plan, serverless functions have a 10-second maximum duration (without Fluid Compute). The function times out mid-call. The user gets a 504 error. The existing tone generation works fine (it completes in 4–6 seconds typically) but adding a vision pre-processing step pushes the total time over the limit.

**Why it happens:** Cold starts on Vercel serverless functions add 1–3 seconds before any code runs. Claude API inference for a vision request (image + structured extraction prompt) takes 5–15 seconds. The existing planner call adds another 5–8 seconds. In a two-step flow (vision → planner → build), the combined time reliably exceeds 10 seconds when triggered from a cold function instance.

Vercel updated the Hobby plan defaults: with Fluid Compute enabled, the effective limit is 60 seconds on the Hobby plan for I/O-intensive functions. However, this requires opting into Fluid Compute in the Vercel dashboard and the project must be configured to use it. By default without that configuration, the limit is 10 seconds.

**How to avoid:**
- Add `export const maxDuration = 60;` to any API route that calls the Claude vision API. This requires Fluid Compute to be enabled on the Vercel project (dashboard setting). With Fluid Compute, the Hobby plan allows up to 300 seconds default (documented official limit).
- Separate the vision extraction call from the preset generation call. A dedicated `/api/vision` route handles image-to-RigIntent extraction only. The existing `/api/generate` route handles RigIntent-to-preset. This allows the user to see intermediate results ("Found: TS9 Tube Screamer, Blues Driver") before the full generation runs.
- Use streaming for the vision response so the function begins sending data before the full response is ready, which satisfies Vercel's timeout (the function is "responding" as long as streaming is active).
- Test cold-start behavior explicitly in production before launch: deploy to Vercel and measure actual timeout frequency. Do not test only locally with `next dev` — the cold start behavior does not exist in local development.

**Warning signs:**
- Vision requests work locally but return 504 errors on Vercel
- Vision extraction works when the function is "warm" but fails on first request after idle period
- Timeout errors appear in Vercel function logs at the 10-second mark

**Phase to address:** Phase 1 (Image Upload + Vision Extraction). The `maxDuration` export must be added to the vision route before any production testing. Fluid Compute enablement must be confirmed in the Vercel project dashboard.

---

### Pitfall 3: Claude Vision Returns Confident Wrong Pedal Identifications from Low-Quality Photos

**What goes wrong:** A user photographs their pedal in dim lighting, at a 45-degree angle, with the pedal slightly out of focus. Claude returns a confident identification: "This is an Ibanez TS9 Tube Screamer. Knob positions: Drive 60%, Tone 50%, Level 70%." The actual pedal is a TC Electronic MojoMojo Overdrive. The mapping table maps "TS9 Tube Screamer" → "Teemah!" and generates a Tube Screamer-emulation preset. The user gets a wrong preset with no indication anything went wrong. The rig emulation feature appears to work but produces systematically wrong results.

**Why it happens:** Claude's official documentation explicitly states: "Claude may hallucinate or make mistakes when interpreting low-quality, rotated, or very small images under 200 pixels. Spatial reasoning abilities are limited." Guitar pedal label text is often small, stylized, partially obscured by knobs, and printed on colored/textured enclosures. Many overdrive pedals share similar visual appearance (small rectangular boxes with 3 knobs). In low light, a green pedal and a yellow pedal can look similar. Claude has extensive training on well-lit product photos but user-submitted photos are often none of these.

Additionally, when prompted to identify a pedal, Claude tends toward confident single-answer responses rather than expressing uncertainty — especially with structured output prompts that expect a model name field. A schema that requires a `modelName` string will receive one, whether or not Claude actually identified the pedal correctly.

**How to avoid:**
- Include a `confidence` field in the vision extraction schema: `modelName: string | null`, `confidence: "high" | "medium" | "low"`, `identificationNotes: string`. Low confidence results should surface to the user rather than being silently acted on.
- Explicitly instruct Claude in the vision prompt: "If you cannot identify the pedal make and model with confidence, return `modelName: null` and explain what you could see. Do not guess a model name if the text is not clearly legible."
- When `confidence` is `"low"` or `modelName` is `null`, fall back to asking the user to type the pedal name: "I couldn't make out the pedal model from this photo. Can you type the name for me?"
- Do not pass low-confidence vision results directly into the mapping table. Require user confirmation for any identification where confidence is not `"high"`.

**Warning signs:**
- Users report "it matched the wrong pedal"
- Vision extraction returns identifications for pedals the user clearly does not own (common brands are over-represented in guesses: Boss, Ibanez, MXR)
- Photos shot in normal living-room lighting consistently return medium/low confidence

**Phase to address:** Phase 1 (Image Upload + Vision Extraction). The confidence schema must be defined before writing the extraction prompt. The fallback-to-text flow must be designed as part of the initial implementation, not added later as a patch.

---

### Pitfall 4: Knob Position Extraction Is Fundamentally Unreliable for Many Pedal Types

**What goes wrong:** The vision extraction prompt asks Claude to return knob positions as percentages (0–100). Claude returns `{"Drive": 75, "Tone": 40, "Level": 60}`. These values are used to set corresponding Helix block parameters. In practice:

- For a pedal with a **chicken-head pointer knob** (a pointed indicator that can rotate 300+ degrees), Claude correctly reads the pointer direction. But many chicken-head knobs use "detented" (stepped) positions with no visual scale between steps — the percentage mapping is arbitrary.
- For a pedal with **numbered dials** (e.g., a Boss DD-3 with "1-10" scales), Claude reads the number and reports 40% for "4" and 90% for "9" — but the relationship between scale number and actual dB/ms value is non-linear. "4" on a Boss DD-3 delay time is not 40% of maximum delay time.
- For a pedal with **no markings** (common on boutique and DIY pedals), Claude cannot determine the knob position relative to any reference point. It may estimate based on the knob's rotation relative to what looks like "noon" — but without a reference line on the pot shaft, this is guesswork.
- For a **boost/cut EQ knob** centered at noon (e.g., Tone knob on a Tube Screamer style pedal), Claude tends to under-report positions near center because the visual difference between 48% and 52% is indistinguishable.

**Why it happens:** Claude's official documentation flags: "Spatial reasoning abilities are limited. It may struggle with tasks requiring precise localization or layouts, like reading an analog clock face." A rotary knob position is exactly this problem: angular measurement from a reference point with a small, often ambiguous visual indicator. Industrial computer vision research shows that even purpose-trained knob-reading models achieve only 85–92% accuracy under controlled conditions with high-resolution images — and accuracy drops significantly with angle deviation, lighting variation, and lack of reference markings.

**How to avoid:**
- Treat knob positions as **approximate hints, not precise values**. Map them to coarse ranges: "low" (0–33%), "mid" (34–66%), "high" (67–100%). The Knowledge Layer's param engine already uses lookup tables for parameter values — the knob extraction feeds into a "knob zone" modifier rather than direct parameter assignment.
- For non-linear scales (Boss numbered dials, Fender amp controls), apply a conversion table specific to the pedal model. If the mapping database does not have a conversion table, use mid-range defaults for that parameter.
- Explicitly tell Claude in the extraction prompt: "Express knob positions using clock positions: 7 o'clock (fully counterclockwise) through 5 o'clock (fully clockwise). Use 12 o'clock for center/noon position." Clock positions are less ambiguous to Claude than percentages because they align with natural human descriptions.
- Add a post-extraction sanity check: if multiple knobs are all reported at the same position (e.g., all 50%), it likely indicates Claude could not read individual knob positions and averaged them. Flag this for user review.

**Warning signs:**
- All extracted knob values cluster near 50% regardless of photo content
- Extracted positions match the pedal image but the resulting tone sounds nothing like the pedal set that way
- Users with Boss pedals complain that labeled scale values (1–10) produce wrong Helix parameters

**Phase to address:** Phase 2 (Rig Mapping + Knob Translation). The coarse-zone approach must be the design intent from the start. Building precise knob-to-parameter translation and then patching it to be coarse later is harder than starting with coarse zones.

---

### Pitfall 5: The Planner Receives Vision Context Concatenated Into the Conversation Text, Breaking Prompt Caching

**What goes wrong:** The existing `callClaudePlanner()` in `planner.ts` concatenates the conversation history into a single user message block:
```typescript
const conversationText = messages
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n\n");
```
The system prompt uses `cache_control: { type: "ephemeral" }` to enable prompt caching, providing ~50% API cost reduction. When vision analysis results (RigIntent JSON) are injected into the conversation messages array before calling the planner, the conversation text changes on every request (different pedal names, different knob values). This means the user message content is always unique, which is fine — the system prompt cache still hits on the static `cache_control` block.

However, if the RigIntent data is appended to the **system prompt** rather than the user messages (a tempting implementation shortcut to "give the planner context"), the system prompt content changes per-request and **the cache never hits**. API costs double from what they were before v1.3.

**Why it happens:** The Planner system prompt is long and expensive to process. Prompt caching is effective because the system prompt is identical across all requests — it never changes. The natural way to give the Planner rig emulation context is to add it to the system prompt ("The user has these pedals: [RigIntent JSON]"). But this breaks caching.

**How to avoid:**
- Inject RigIntent data into the **user messages array**, not the system prompt. Add the rig analysis as a synthetic assistant message or as the final user message before the Planner call:
  ```
  messages.push({ role: "user", content: `[RIG ANALYSIS]\n${JSON.stringify(rigIntent)}` })
  ```
- The system prompt must remain identical across all Planner calls to preserve cache hits. Only conversation content (user/assistant turn messages) should vary.
- Add a `rigContext` parameter to `callClaudePlanner()` that is appended to the conversation text, not the system prompt. Never modify `buildPlannerPrompt()` to include per-request data.
- After implementing rig emulation, verify in the Anthropic API response that `cache_read_input_tokens > 0` to confirm caching is still working. If it shows 0, the system prompt is being inadvertently varied.

**Warning signs:**
- Anthropic API response shows `cache_read_input_tokens: 0` on every request after v1.3 goes live
- API costs increase approximately 2x compared to v1.1 baseline despite prompt caching being in place
- `buildPlannerPrompt()` function signature was modified to accept per-request pedal data

**Phase to address:** Phase 3 (Planner Integration). The integration point between RigIntent and the Planner must be designed to inject rig context as user message content, not system prompt content.

---

### Pitfall 6: Static Pedal Mapping Table Confidently Maps Boutique and Regional Pedals to Wrong Helix Models

**What goes wrong:** The mapping table contains entries for common pedals: TS9 → Teemah!, DS-1 → Stupor OD, Blues Driver → Deranged Master. A user uploads a photo of their Mythos Mjolnir (a boutique high-gain overdrive), which Claude identifies by name. The mapping table has no Mjolnir entry. The fallback logic does a fuzzy match and finds "Mythos" in no entries, then matches on "high-gain overdrive" category and returns "Vermin Dist" (a Rat-style distortion). The user gets a preset that sounds nothing like a Mjolnir. The substitution card says "Mythos Mjolnir → Vermin Dist — closest high-gain overdrive character" — stated with the same confidence as a TS9 → Teemah! match.

Compounding this: the same brand often makes pedals across very different categories (Walrus Audio makes both transparent overdrives and lush reverbs), so category-based fuzzy matching produces random wrong answers.

**Why it happens:** The pedal market contains thousands of models from hundreds of boutique manufacturers, with new releases constantly. A static mapping table built at launch will have confident entries for maybe 200–400 mainstream pedals and gaps for thousands of boutique, regional, limited-run, and DIY pedals. The dangerous failure mode is not "we don't know this pedal" (which surfaces as a useful error) — it is "we matched this wrong but confidently" (which surfaces as a broken feature that appears to work).

**How to avoid:**
- Build the mapping table with three explicit match tiers: `exact` (pedal is in the table), `category` (pedal type is known, best-match Helix equivalent for the category), and `unknown` (no match possible). Surface each tier differently in the UI.
- For `unknown` matches, do not guess. Show: "We don't have [Pedal Name] in our mapping database. We'll treat it as an [category] pedal. You can adjust the result." This is more honest and more useful than a wrong confident match.
- Never use brand-name fuzzy matching for mapping. A "Mythos Mjolnir" and a "Mythos Phantasm" (fuzz) are completely different categories. Brand is not a proxy for category.
- Version and revision awareness: "Big Muff Pi" covers 20+ circuit variants that range from woolly fuzz to scooped metal tone. The mapping must handle the ambiguity explicitly: "Big Muff Pi (version unspecified) — mapped as Triangle variant. Different versions may vary significantly."
- Regional/international naming: the "Maxon OD808" and "Ibanez TS808" are the same circuit sold under different names in Japan vs. the US. The mapping table must have aliases for common regional names.

**Warning signs:**
- User reports "it mapped my [boutique pedal] to something completely wrong"
- Substitution card shows a confident mapping for a pedal that is not in the curated table (check table lookup returned `category` or unknown tier, not `exact`)
- Multiple different pedal names all map to the same Helix model (indicates over-eager fuzzy matching)

**Phase to address:** Phase 2 (Rig Mapping + Knob Translation). The match tier design must be built into the mapping table data structure from day one. Adding tiers after the table is built requires reformatting all entries.

---

### Pitfall 7: Vision Extraction Integrated Into the Generate Route Breaks the Existing [READY_TO_GENERATE] Signal Flow

**What goes wrong:** The current flow is: Gemini chat interview → user sees `[READY_TO_GENERATE]` token → UI shows Generate button → user clicks → `/api/generate` called. Adding vision upload into this flow by having the user attach images during the chat phase requires the frontend to (a) hold base64 image data in state, (b) include it in the generate call, and (c) modify `generate/route.ts` to accept and process images.

The most natural breakage: the chat route (`/api/chat`) currently accepts `{ messages, premiumKey }` as JSON. The generate route accepts `{ messages, premiumKey, device }`. If image handling is added as `{ messages, premiumKey, device, images }` to the generate route, the route body grows to potentially 5–8MB (multiple photos). This exceeds the 4.5MB Vercel limit (Pitfall 1) and also changes the generate route's contract, which is currently covered by zero integration tests. The change might silently break Helix LT or Pod Go generation for users who do not upload images.

**Why it happens:** The generate route is the existing integration point that already handles device selection and calls the Claude Planner. Adding image processing here avoids building a new route. But it entangles two separate concerns (vision extraction and preset generation) that have different performance profiles, different failure modes, and different retry semantics.

**How to avoid:**
- Create a separate `/api/vision` route for image extraction. Its contract: `POST { images: base64[] }` → `{ rigIntent: RigIntent, confidence: ConfidenceMap }`. This route can fail without affecting the existing generation flow.
- The generate route's contract does not change. After vision extraction succeeds, the `RigIntent` is passed as part of the messages array to the existing generate flow (as a synthetic message injected into conversation context).
- If no images are uploaded, the vision route is never called. The existing chat → generate flow is completely unchanged.
- After adding vision, run the full existing test suite to confirm zero regressions. The existing 50+ Knowledge Layer tests are pure TypeScript and do not depend on API routes, but any integration tests involving generate/route.ts must pass.

**Warning signs:**
- Users who do NOT upload images report that generation stopped working after v1.3 deployment
- The generate route body size increases (console/network tab shows large POST payloads for text-only users)
- `[READY_TO_GENERATE]` signal detection breaks because the chat route now receives messages with image attachments that the Gemini client cannot handle (Gemini is used for the conversational interview phase, not vision extraction)

**Phase to address:** Phase 1 (Image Upload + Vision Extraction). The route separation architecture must be decided before any code is written. Retrofitting separation after the generate route has been modified is more disruptive.

---

### Pitfall 8: The Substitution Card Shows Helix Internal Model Names Instead of Human-Readable Pedal Names

**What goes wrong:** The substitution card is supposed to show: "TS9 Tube Screamer → Teemah! — closest gain structure and mid-hump EQ character." Instead it shows: "TS9 Tube Screamer → HD2_DistTeemah (Mono) — Match confidence: 0.87." The user has no idea what "HD2_DistTeemah" means. The confidence score means nothing to a guitarist. The feature is confusing rather than illuminating.

**Why it happens:** The mapping layer works with Helix internal model IDs (`HD2_DistTeemah`, `HD2_DelayDigital`, etc.) because these are what the preset builder and validator use. The existing `ToneIntent` and `PresetSpec` types use internal model IDs throughout. When the substitution data flows up to the UI, the internal representation leaks into the display if the UI component does not have a translation layer.

Additionally, "confidence scores" are a technical concept that guitarists do not find useful. "Your TS9 tone character will come through — the mid-hump and gain rolloff are matched" is useful. "0.87 match confidence" is not.

**How to avoid:**
- The mapping table must store both `helixModelId` (for the preset builder) and `helixModelDisplayName` (for the UI). The display name comes from the `name` field in `models.ts` (e.g., "Teemah!" not "HD2_DistTeemah").
- The substitution card should show: `[Original Pedal Name] → [Helix Display Name]` with a one-sentence plain-English rationale. No numeric confidence scores in the UI.
- The rationale text should use guitarist vocabulary: "mid-hump EQ character," "asymmetric clipping," "transparent boost," "tape-style echo." Not "cosine similarity: 0.87" or "category match: overdrive."
- Keep numeric confidence for internal decision-making (whether to surface the result or ask for confirmation) but never render it in the substitution card.

**Warning signs:**
- Substitution card shows `HD2_*` model IDs anywhere
- Substitution card shows numeric scores or percentage matches
- Non-technical beta users report the substitution card is "confusing" or "looks like code"

**Phase to address:** Phase 4 (Substitution Card UI). The data structure must include display names from the beginning — adding them later requires modifying the mapping table schema and all mapping entries.

---

## Technical Debt Patterns

Shortcuts that could be introduced while adding rig emulation to the existing system.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Append RigIntent JSON to the Planner system prompt | No new parameters in callClaudePlanner() | Breaks prompt caching — API cost doubles; cache_read_input_tokens drops to 0 | Never — inject as user message content |
| Add image payload to existing /api/generate body | Single route, simpler frontend | 4.5MB Vercel limit breaks for multi-photo uploads; generate route contract changes; harder to retry vision independently | Never — separate vision into /api/vision route |
| Use numeric confidence scores in the substitution card | Easy to implement from mapping data | Confuses non-technical users; "87% match" is not guitarist vocabulary | Never in the user-facing card; keep as internal decision gate |
| Map unknown boutique pedals via category fuzzy match without surfacing uncertainty | Fewer "we don't know" responses | Confidently wrong substitutions destroy trust faster than honest "unknown" | Only if the match is surfaced as "approximate" with user confirmation, not presented as exact |
| Build knob extraction as precise percentage → parameter translation | Simpler schema | Vision cannot reliably read precise rotary positions; all outputs will be inaccurate; errors accumulate | Never for initial launch — use coarse zone (low/mid/high) approach |
| Skip client-side image compression | Simpler frontend code | All uploads from modern smartphones exceed 4.5MB Vercel limit; 100% failure rate for untouched photos | Never — compression is mandatory for production |
| Add all pedal mapping logic directly to generate/route.ts | No new files | Contaminates the existing generation pipeline; harder to test mapping in isolation; increases route file size significantly | Never — mapping belongs in a separate lib module |

---

## Integration Gotchas

Common mistakes when connecting vision extraction to the existing Planner pipeline.

| Integration Point | Common Mistake | Correct Approach |
|-------------------|----------------|------------------|
| `callClaudePlanner()` rig context injection | Add `rigContext` to system prompt via `buildPlannerPrompt()` | Append `rigContext` as the final entry in the `messages` array passed to the planner; system prompt must remain static |
| Vision API call (`client.messages.create` with image) | Reuse the same `Anthropic` client instance from `planner.ts` for vision extraction | Vision extraction needs its own route and client call with `max_tokens` tuned for JSON extraction (512–1024 tokens), not the 4096 needed for ToneIntent generation |
| Image content in the chat route | Pass base64 images through the Gemini chat route for multi-modal conversation | Gemini handles the conversational interview; Claude handles vision extraction. These are separate API calls to separate services. Do not mix them |
| Frontend image state | Store raw File objects in React state | Convert to base64 immediately on file selection (`FileReader.readAsDataURL`), compress, then store compressed base64. Raw File objects cannot be sent as JSON |
| Multiple image uploads | Process all images in a single Claude vision API call with all images in one `messages` array | Multiple images in one call increase token cost and risk the 32MB request size limit. Process one pedal photo per API call; merge the RigIntent results client-side |
| ToneIntent schema extension for rig emulation | Add `rigIntent` field directly to `ToneIntentSchema` in `tone-intent.ts` | Keep `RigIntentSchema` separate in a new file. Pass rig context as planner conversation input, not as a schema output field — the Planner generates `ToneIntent`, not `RigIntent` |
| Pod Go rig emulation | Assume rig emulation only targets Helix LT | Rig emulation must work for all three devices. The mapping layer selects Helix models; the existing device-aware chain rules then apply those models to the correct device target |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Sending uncompressed smartphone photos as base64 in the API call | Claude API response time increases from 8s to 15–20s; token cost increases 5–8x | Compress to max 1000px/0.75 quality before encoding; reduces tokens from ~5,000 to ~800 per image | Every request with an uncompressed 12MP smartphone photo |
| Processing multiple pedal photos sequentially in a single API route | Route execution time = sum of all individual vision calls (3 pedals × 10s = 30s) | Process images in parallel with `Promise.all()`; total time = slowest single call, not sum | Anytime a user uploads 2+ pedal photos |
| Vision extraction and Planner call in the same serverless function invocation | Combined execution time exceeds Vercel timeout; errors spike at function cold start | Separate into two routes: /api/vision and /api/generate; client orchestrates the sequence | Cold start + 2 pedals + Planner call = 35–45 seconds, well over 10s default limit |
| Sending the entire conversation history as image-augmented messages to the Planner | Token count balloons if conversation references images repeatedly | Vision extraction is a preprocessing step; only the resulting RigIntent text is passed to the Planner, not the images themselves | Any conversation with more than 1 image reference in history |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Accepting any file type as an "image upload" | User uploads a PDF or executable, it gets base64-encoded and sent to Claude API; Claude returns an error or unexpected behavior; the response is then treated as a vision extraction result | Validate MIME type and file signature (magic bytes) client-side before allowing upload; accept only `image/jpeg`, `image/png`, `image/webp` |
| Forwarding raw user-uploaded image bytes to the Claude API without size validation | A 50MB TIFF triggers a 400 error from Claude API (5MB limit); error stack trace may leak internal service details | Enforce client-side: max 5MB raw file size, max 2000px dimension. Enforce server-side: check base64 length before forwarding to Claude |
| Exposing the full RigIntent JSON (including confidence scores and raw vision output) in the API response | No direct security risk, but exposes internal confidence thresholds that users could exploit to craft inputs that always return high-confidence wrong answers | Return only the user-facing fields to the frontend; keep confidence and raw vision output server-side for logging and decision-making |
| Allowing arbitrarily long `modelName` strings from vision extraction to be injected into mapping table lookup queries | If the mapping lookup uses string-based matching without length limits, very long inputs waste compute | Truncate extracted pedal names to 200 characters max before any mapping lookup; validate against expected character set |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing the substitution card only after the preset is generated (at the bottom of the result) | User doesn't understand why their TS9 sounds different from their physical pedal; the reasoning is buried | Show the substitution mapping inline in the chat before the Generate button: "Found: TS9 Tube Screamer → Teemah!. Tap Generate when ready." |
| Saying "no match found" for boutique pedals without a fallback path | User stuck — they can't proceed if their pedal isn't in the database | "We don't have [Pedal Name] in our database. You can describe its sound instead, or we'll treat it as a [category] pedal." Always offer a text description escape hatch |
| Showing the same confident mapping UI for exact matches and fuzzy/category matches | User trusts a Walrus Audio Fathom reverb → "Glitz Reverb" fuzzy match as much as a TS9 → Teemah! exact match | Differentiate visually: exact match gets the full substitution card with rationale; category match shows "Best available match" with lower visual emphasis |
| Requiring image upload to use rig emulation mode | Users without pedal photos, or with hand-drawn rigs, cannot access the feature | Text description entry ("TS9 → Blues Breaker → Fender Twin Reverb") must work as the primary path; image upload is an enhancement |
| Displaying extracted knob positions as percentages in the UI | "Drive: 63%" means nothing to most guitarists | Use descriptive language instead: "Drive at about noon," "Tone slightly bright." If percentages must be shown, add the clock-face equivalent |
| Long loading state with no progress indication during vision extraction + generation | Users think the app has frozen after waiting 15–20 seconds | Show progressive status: "Analyzing pedal photo…" → "Mapping to Helix models…" → "Building preset…" with distinct stages |

---

## "Looks Done But Isn't" Checklist

- [ ] **Client-side compression:** Upload a photo from a modern smartphone (iPhone or Pixel). Confirm the request body reaching the API route is under 4.5MB. If not, compression is not working.
- [ ] **Vision extraction confidence:** Upload a blurry or poorly-lit pedal photo. Confirm the result includes `confidence: "low"` and prompts the user to confirm or type the pedal name — not a silent wrong identification.
- [ ] **Unknown pedal graceful degradation:** Submit a pedal name that is not in the mapping table (try an obscure boutique). Confirm the UI shows "best available match" or "unknown" — not a confident exact-match card.
- [ ] **Prompt caching intact:** After a rig emulation preset generation, check the Anthropic API response object: `cache_read_input_tokens` should be > 0. If 0, rig context was added to the system prompt.
- [ ] **Existing flow unbroken:** Generate a preset for a Helix LT WITHOUT uploading any images. Confirm the flow works identically to v1.1 — no additional loading states, no new API calls, no changed response shape.
- [ ] **Timeout test:** Deploy to Vercel (do not test locally only) and trigger vision extraction from a cold function start. Confirm the response arrives within the configured `maxDuration`. If 504 errors appear, Fluid Compute is not enabled.
- [ ] **Internal model IDs hidden:** Inspect the substitution card in the UI. Confirm no `HD2_*` strings are visible anywhere.
- [ ] **Pod Go rig emulation:** Select Pod Go as the target device and go through the rig emulation flow. Confirm the generated preset uses Pod Go-compatible models and the substitution card reflects Pod Go model names, not Helix-only models.
- [ ] **Multi-pedal upload:** Upload photos of two different pedals. Confirm both appear in the substitution card, both map independently, and the combined preset includes blocks for both.
- [ ] **Text description rig input:** Type "TS9 into a Fender Twin Reverb" without any image upload. Confirm rig emulation mode activates and produces a valid preset.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Vercel 413 errors for image uploads | LOW | Add/fix client-side compression; redeploy; does not require backend changes |
| Vercel 504 timeouts on vision route | LOW | Add `export const maxDuration = 60;` to vision route; enable Fluid Compute in Vercel dashboard; redeploy |
| Prompt caching broken by RigIntent in system prompt | LOW | Move RigIntent injection from `buildPlannerPrompt()` to messages array; redeploy; verify `cache_read_input_tokens > 0` |
| Mapping table produces wrong matches for boutique pedals | MEDIUM | Add unknown/unmatched tier to mapping lookup; add user confirmation step for non-exact matches; rebuilding the table tier logic requires touching mapping data structures |
| Vision returns wrong pedal identification confidently | MEDIUM | Add confidence field to extraction schema; add user confirmation UI for low/medium confidence; this requires schema change + UI change + prompt change |
| Substitution card shows HD2_* internal IDs | LOW | Add display name field to mapping table entries; update substitution card component to use display name; no schema contract changes required |
| Existing preset generation broken by generate route changes | HIGH | Revert generate/route.ts to v1.2 state; move vision integration to dedicated /api/vision route; re-implement as separate route |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: Vercel 4.5MB body limit | Phase 1 — Image Upload + Vision Extraction | Upload smartphone photo; confirm request body under 4.5MB in network tab |
| Pitfall 2: Vercel 10s timeout on vision call | Phase 1 — Image Upload + Vision Extraction | Deploy to Vercel; cold-start vision call; confirm no 504 errors; verify maxDuration config |
| Pitfall 3: Confident wrong pedal identification | Phase 1 — Image Upload + Vision Extraction | Upload blurry photo; confirm low-confidence response + user confirmation prompt |
| Pitfall 4: Unreliable knob position extraction | Phase 2 — Rig Mapping + Knob Translation | Design coarse-zone schema; verify extracted zones match visible knob positions in test photos |
| Pitfall 5: RigIntent in system prompt breaks caching | Phase 3 — Planner Integration | Check API response: cache_read_input_tokens > 0 after v1.3 rig emulation preset generation |
| Pitfall 6: Boutique pedal confident wrong mapping | Phase 2 — Rig Mapping + Knob Translation | Submit obscure boutique pedal name; confirm "best available match" or "unknown" tier response |
| Pitfall 7: Vision integration breaks existing generate flow | Phase 1 — Image Upload + Vision Extraction | Generate text-only preset after adding /api/vision route; confirm identical behavior to v1.2 |
| Pitfall 8: HD2_* IDs in substitution card | Phase 4 — Substitution Card UI | Inspect rendered substitution card; no HD2_ strings visible; rationale uses guitarist vocabulary |

---

## Sources

**Official Documentation (HIGH confidence):**
- [Vercel Functions Limits — Official Docs](https://vercel.com/docs/functions/limitations) — 4.5MB request body limit confirmed; Hobby default 300s with Fluid Compute enabled; max 300s on Hobby, 800s on Pro
- [How to bypass Vercel 4.5MB body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions) — Official Vercel KB; client-side upload to Vercel Blob as the recommended solution
- [Claude Vision Documentation — Official Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/vision) — 5MB per-image limit; 8000px single-image limit; 2000px multi-image limit; spatial reasoning limitations explicitly stated ("may struggle with tasks requiring precise localization, like reading an analog clock face"); 100 images max per API request; 32MB total request size limit
- [Anthropic Claude API known issues — GitHub Issues](https://github.com/anthropics/claude-code/issues/8202) — Image exceeding 5MB breaks entire session, not just one request

**Line 6 Official (HIGH confidence):**
- [Line 6 Helix Effect Models — DShowMusic](https://dshowmusic.com/line-6-helix-effect-models/) — Full effect model list with "based on" real-pedal names; confirms Scream 808 = TS808 Tube Screamer, Teemah! = Ibanez TS-series variant
- [Line 6 Helix Models Official](https://line6.com/helix-models/index.html) — Official model database with trademark disclaimers; basis for the `models.ts` database in this codebase

**Industrial Vision Research (MEDIUM confidence — derived from research, not guitar-specific):**
- [Dials and Knob Monitoring with Computer Vision — Edge Impulse](https://docs.edgeimpulse.com/experts/computer-vision-projects/dials-and-knob-monitoring-with-computer-vision-raspberry-pi) — Confirms knob reading accuracy drops with lighting variation and angle deviation; even purpose-trained models require controlled conditions for reliable extraction
- [Recognition Method of Knob Gear — MDPI Sensors](https://www.mdpi.com/1424-8220/22/13/4722) — Academic research: low SNR from lighting, angle deformation, and inconsistent feature distribution are the three primary failure modes for industrial knob reading with computer vision

**Codebase Inspection (HIGH confidence — direct code analysis):**
- `src/lib/planner.ts` — Existing prompt caching implementation confirmed; system prompt uses `cache_control: { type: "ephemeral" }`; conversation text concatenated into user message, not system prompt
- `src/app/api/generate/route.ts` — Existing route contract: `{ messages, device }`; currently no image handling; Planner called once per generation
- `src/app/page.tsx` — Current frontend state management: `messages` array as `{ role, content: string }`; no image state; send path via `/api/chat` (Gemini SSE) and `/api/generate` (Claude Planner) are separate
- `src/lib/helix/models.ts` — `HelixModel.name` field contains human-readable names (e.g., "Teemah!", "Scream 808"); `HelixModel.id` contains internal `HD2_*` strings — separation already exists in data model

---

## The Core Risk: Silent Wrong Answers

The most dangerous failure mode for rig emulation is not a crash or a visible error — it is a feature that appears to work but produces wrong results. A user photographs their Walrus Audio Eras (five-band EQ) and gets a confident mapping to a distortion block. A user sets their delay to 75% and gets 75% of maximum delay time when they intended 3 repeats at 375ms. A user's boutique overdrive gets fuzzy-matched to the wrong effect category and the Helix preset sounds like a completely different style of gain.

None of these produce error messages. All of them look like success.

**The mitigation strategy:** Design every output surface with an explicit uncertainty representation. Vision extraction returns `confidence`. Mapping returns `matchTier`. Knob extraction returns `zone` (coarse) not `percentage` (false-precision). Whenever `confidence` or `matchTier` is below threshold, surface user confirmation before acting on the result. An honest "we're not sure about this mapping — please confirm" is vastly better than a confident wrong answer.

---

*Pitfalls research for: Adding vision-based rig emulation to HelixAI (v1.3)*
*Researched: 2026-03-02*
