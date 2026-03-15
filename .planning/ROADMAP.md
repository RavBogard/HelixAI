# Roadmap

## Phase 1: The Validation Sandwich
**Goal**: Catch LLM hallucinations strictly before they touch the builder logic.
- Implement Zod schema for final JSON structural verification.
- Write sanitization pipeline to correct obvious LLM mistakes (like placing a stereo effect before mono).

## Phase 2: Stadium Builder Fixes
**Goal**: Guarantee 100% compatibility for Helix Native/Stadium users.
- Obtain an actual failing Stadium preset and a working Stadium preset.
- Identify the exact missing keys or malformed structures.
- Patch `stadium-builder.ts`.
- Write the exact A/B Diff Unit Test.

## Phase 3: The Preset Anchor System (Quality)
**Goal**: Make the presets sound vastly better by eliminating mathematical guessing.
- Create a `anchors.ts` catalog of known good configurations.
- Update the Prompt Router to feed these anchors to Gemini.
- Modify `validate.ts` to prefer anchor values over generated values where applicable.
