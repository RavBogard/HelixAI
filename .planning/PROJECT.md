# HelixAI v2.0

## The One Thing
Build a rock-solid, deterministic pipeline that absolutely guarantees that the generated `.hlx` and `.hsp` (Stadium) presets compile and import universally without error.

## The Problem
Currently, the LLM hallucinates parameters, and the builder engines (like `stadium-builder.ts`) rely on brittle heuristics to correct structural issues. This results in Stadium users experiencing silent failures where presets do not load. Furthermore, because the LLM is guessing complex numerical DSP values (like "Drive", "Bias", or "Decay"), the presets often sound unmusical.

## The v2.0 Solution
1. **The Validation Sandwich**: Implement a strict Zod schema *before* and *after* preset compilation. Any hallucinated blocks or parameters must be sanitized dynamically or rejected outright.
2. **Preset Anchoring**: Introduce a static catalog or vector database of known-good tone settings (e.g. "Rectifier High Gain Lead", "Agoura Clean"). The LLM's job shifts from *calculating* mathematical values to *orchestrating* proven blocks.
3. **Firmware Decoupling**: Isolate the Stadium builder logic so it enforces exact key shapes (`cursor`, `params.inst2Z="FirstEnabled"`, slot grid `b00..b13`) tested against known working user files.

## Constraints
- Must maintain compatibility with existing Next.js, Zustand, and Supabase architecture.
- Must remain fast enough to not frustrate the user while waiting for Gemini.

---
*Last updated: 2026-03-15 after v2.0 initialization*
