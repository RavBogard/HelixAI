# Architecture

## Design Patterns & Approach
HelixAI uses a modular, domain-driven architecture focused on processing and transforming tone configurations into Line 6 device-specific preset formats.

1. **LLM Orchestration Layer (`src/lib/helix/`)**:
   - The user inputs natural language, which is parsed by Gemini.
   - The "Prompt Router" (`prompt-router.ts`) identifies the target device (Helix LT, Pod Go, HX Stomp, or Stadium) and loads the specific `planner.ts` and prompt constraints for that device family.
   
2. **Preset Generation Pipeline**:
   - **Validation Phase**: The raw LLM JSON output is strictly validated against domain rules (e.g., DSP limits, signal chain rules, parameter bounds) in `validate.ts`, `intent-validate.ts`, and `musical-validate.ts`.
   - **Device Builders**: Device-specific builder engines (`stomp-builder.ts`, `podgo-builder.ts`, `stadium-builder.ts`, `preset-builder.ts`) take the validated `PresetSpec` and compile it into the exact binary/JSON `.hlx` or `.hsp` formats required by the hardware.
   - **Snapshot Engine**: Manages the complex state overrides (which blocks are bypassed, parameter changes per snapshot).

3. **Data Models (`src/lib/models.ts` & `types.ts`)**:
   - Extensive catalog of every known Line 6 effect, amp, and cabinet, categorized by era (Agoura, HD, Legacy). Holds min/max values and default settings. 

4. **Visualizer State Management (`src/lib/visualizer/`)**:
   - An interactive UI that reflects the `PresetSpec` array. Uses `hydrate.ts` to convert a raw preset into the UI state, and custom Drag & Drop constraints (`dnd-constraints.ts`) to prevent illegal block movements.

## Data Flow
User Input → Next.js API Route → `getFamilyPlannerPrompt()` → Gemini LLM → Raw JSON string → `infer-schema.js` / JSON.parse → `PresetSpec` Validation → `XXX-builder.ts` → `.hlx` / `.hsp` download.
