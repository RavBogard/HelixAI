# Concerns & Technical Debt

## The "Stadium" Preset Failures
- The `stadium-builder.ts` relies on heuristics (e.g., injecting `Mono`/`Stereo` suffixes, stripping `access` keys) calibrated against older user-provided `.hsp` files. If Helix Native / Stadium receives an update, these rigid heuristics fail silently (or result in the software rejecting the import). 
- There is a high risk that the LLM is generating `PresetSpec` configurations that the `stadium-builder` technically serializes properly, but which are mathematically invalid according to the device firmware (e.g., impossible routing, missing required hidden nodes like Input/Output blocks, or invalid slot assignments).

## LLM Hallucinations
- The LLM is tasked with defining raw numerical values for complex variables (e.g., `Drive: 0.72`, `Bias: 0.5`). Without an "anchor" or pre-validated vector database of proven good tones, the resulting presets often sound bad or unmusical, even if they technically compile.

## Validation Gaps
- The `XXX-validate.ts` layer exists, but it checks the *request* (`PresetSpec`), not the *result*. The builder scripts do not dynamically re-verify the final JSON output against an exhaustive Zod schema before downloading. We need a strict "Validation Sandwich" that blocks malformed output from reaching the user.

## Lack of Parameter Catalogs
- We don't have a reliable, static corpus of "proven" tones. It's too expensive and slow to have the LLM try to "think" of the correct DSP values dynamically every single time.
