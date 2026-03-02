# Phase 5: Frontend Polish - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Update the frontend (page.tsx) to work with the new single-preset generation pipeline. Add a device selector (Helix LT vs Floor). Remove multi-provider comparison UI. Preserve the Warm Analog Studio aesthetic. Ensure the Gemini chat interview flow works end-to-end from conversation to preset download.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 5 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Device selector UI** -- Add a simple LT/Floor toggle before generation. Pass selected device to the generate route. Default to Helix LT.
- **Single preset download** -- Replace the multi-provider comparison grid with a single preset card. One download button, one .hlx file.
- **Multi-provider removal** -- Remove ProviderInfo, ProviderResult, provider selector, provider toggle, comparison grid, /api/providers fetch. The generate route now returns flat `{ preset, summary, spec, toneIntent }`.
- **Aesthetic preservation** -- Keep the Warm Analog Studio design system (hlx-* CSS classes, tube glow, LED indicators, rack line, amber accents). No visual regressions.
- **Footer text update** -- Update "Powered by Gemini - Claude - GPT - Line 6 Helix LT" to reflect the actual architecture (Gemini chat + Claude generation + Helix LT/Floor).
- **Chat flow preservation** -- The Gemini streaming chat, [READY_TO_GENERATE] detection, and message flow must work unchanged.

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- follow the existing design system in `src/app/globals.css` and the existing page.tsx patterns.

</specifics>

<code_context>
## Existing Code Insights

### Current Frontend (to modify)
- `src/app/page.tsx`: 558-line React component with multi-provider UI
  - Lines 6-29: ProviderInfo, ProviderResult, GeneratedResults interfaces (REMOVE)
  - Lines 40-62: Provider fetch on mount, selectedProviders state (REMOVE)
  - Lines 90-102: toggleProvider function (REMOVE)
  - Lines 194-239: generatePreset function (SIMPLIFY to single preset)
  - Lines 241-253: downloadPreset function (SIMPLIFY)
  - Lines 381-444: Provider selector + generate button (REPLACE with device selector + generate)
  - Lines 446-513: Comparison results grid (REPLACE with single preset card)
  - Line 553: Footer text (UPDATE)

### Backend (already done, Phase 3-4)
- `POST /api/generate`: Accepts `{ messages, device? }`, returns `{ preset, summary, spec, toneIntent }`
- `POST /api/chat`: Gemini streaming chat with Google Search grounding (unchanged)
- DeviceTarget: `"helix_lt" | "helix_floor"` (Phase 4)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 05-frontend-polish*
*Context gathered: 2026-03-02*
