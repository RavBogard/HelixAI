# Phase 22: UI Overhaul - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete visual redesign of homepage, chat flow, and rig upload panel — eliminating redundant elements, fixing readability, and creating a clean, polished interface with strong visual hierarchy.

</domain>

<decisions>
## Implementation Decisions

### Rig upload panel
- Collapsed behind a toggle button by default — not visible on page load
- Toggle: small "Analyze my pedal rig" button with camera icon + chevron, below suggestion chips
- Expanded panel: compact file input row (choose + filename + analyze button all inline, no stacked elements)
- Intro text removed — toggle label is sufficient
- File list removed — inline count next to choose button is enough
- States (loading, pedal results, substitution card, CTA) still render progressively inside the panel

### Device selector
- Moved to header — permanently visible, single source of truth
- Compact mono-font pill buttons (LT / FLOOR / POD GO)
- Removed from both rig panel CTA and chat flow generate section
- The existing useEffect([selectedDevice]) re-map behavior is unaffected — state stays the same

### Two-mode layout
- Chat (describe tone) is the primary mode — input always at bottom, welcome screen centered
- Rig upload is secondary — collapsed section below suggestion chips, opt-in via toggle
- Visual hierarchy: hero mark → headline → suggestions → (collapsed rig toggle)

### Suggestion chips
- Text color upgraded from --hlx-text-muted (#524840) to --hlx-text-sub (#a89880) — readable on dark surfaces
- CSS change in globals.css only

### Button badges
- The "H" text box badge inside generate/analyze buttons replaced with actual WaveformH glyph
- Dark variant (text-[var(--hlx-void)]) on amber button; amber variant on ghost button

### Claude's Discretion
- Exact toggle animation behavior (chevron rotation, no panel slide animation for simplicity)
- Exact header layout proportions
- Spacing values inside compact file row

</decisions>

<specifics>
## Specific Ideas

- User explicitly said: "trust your judgement... redesign the entire thing around beauty and usability"
- Aim for something that feels like a Strymon/high-end pedal UI — functional, precise, nothing decorative that doesn't earn its place
- The rig upload section was specifically called out as "particularly bloated and ugly"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WaveformH`: Brand mark SVG — now used in buttons (replaces H text badge), defined in page.tsx
- `hlx-*` CSS classes: All established and reusable (pedal, generate, msg-ai, msg-user, rack, preset-card, input, send, led, hero-mark)
- `SignalChainViz`, `ToneDescriptionCard`, `SubstitutionCard`: Component logic stays, no structural changes

### Established Patterns
- CSS variable system: --hlx-void/deep/surface/elevated/raised, --hlx-amber, etc.
- Amber (#f0900a) as primary accent, dark surface stack, LED dots, mono font for technical labels
- `useEffect([selectedDevice])` fires `callMap()` on device change — works regardless of selector location

### Integration Points
- `selectedDevice` state: moves its render to header, no other logic changes
- `rigPanelOpen` state: new boolean, controls rig section visibility
- All API calls (callVision, callMap, generatePreset) unchanged

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 22-ui-overhaul*
*Context gathered: 2026-03-02*
