# Requirements

## Validated

- ✓ [Next.js App Router Architecture] — existing
- ✓ [Gemini API Orchestration (`@google/genai`)] — existing
- ✓ [Device Builder Engines (Helix LT, Pod Go, HX Stomp)] — existing but needs hardening
- ✓ [Visualizer UI (Drag & Drop)] — existing

## Active

- [ ] **Validation Sandwich**: Re-architect the `PresetSpec` validation to use strict `zod` schemas that strictly enforce DSP limits and required parameters before continuing to the builder.
- [ ] **Preset Anchor System**: Implement a JSON catalog of expert-verified block parameters (e.g., standard amp EQ settings). The LLM will reference these rather than hallucinating raw numbers.
- [ ] **Stadium Builder Hardening**: Diff a working Stadium preset against a failed one. Ensure `stadium-builder.ts` injects all required metadata (e.g., proper slot allocation, `Mono`/`Stereo` suffixes, proper `cursor` and `harness` formats).
- [ ] **A/B Unit Test Coverage**: Build a test suite that directly diffs the builder output against a verified, working binary/JSON file.

## Out of Scope

- [Full UI Overhaul] — The focus is on the backend pipeline stability and tone quality, not re-designing the entire frontend.
