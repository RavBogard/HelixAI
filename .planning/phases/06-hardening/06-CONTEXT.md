# Phase 6: Hardening - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Address launch-readiness concerns: firmware version parameterization (read from config, not hardcoded), DSP block limit enforcement at generation time (fail before producing broken .hlx), openai package removal from dependencies, and any remaining code hygiene. This phase has no v1 requirement IDs -- it addresses infrastructure concerns surfaced by research that gate production quality.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All Phase 6 decisions are delegated to Claude. The user trusts the builder's judgment on:

- **Firmware version parameterization** -- Move the firmware version constant to a config value (env var or config file) so updating firmware doesn't require a code change.
- **DSP block limit enforcement** -- Ensure generation fails clearly if a DSP block limit (8 non-cab blocks per DSP) would be exceeded, rather than producing a broken preset. This may already be covered by validatePresetSpec from Phase 4 -- verify and harden if needed.
- **openai package removal** -- Remove the openai package from package.json since we no longer use OpenAI for generation. Clean up any remaining references.
- **Code hygiene** -- Remove any dead imports, unused variables, or stale comments left over from the multi-provider era.

</decisions>

<specifics>
## Specific Ideas

No specific requirements -- follow the existing codebase patterns and ensure all hardening items are addressed.

</specifics>

<deferred>
## Deferred Ideas

None -- this is the final phase.

</deferred>

---

*Phase: 06-hardening*
*Context gathered: 2026-03-02*
