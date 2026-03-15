# Conventions

## Code Style
- Written in strict TypeScript. Interfaces are heavily preferred over `any` or `Record<string, unknown>`.
- **Pure Functions**: The vast majority of the logic in `src/lib/helix/` consists of pure functions taking a `PresetSpec` and returning either modified states or binary strings. This makes the logic highly testable.
- State is managed via Zustand in the frontend, preventing deep prop drilling.

## Naming
- Files: kebab-case (`stadium-builder.ts`, `prompt-router.ts`).
- Types: PascalCase (`PresetSpec`, `BlockSpec`).
- Device IDs: snake_case for constants (`helix_stadium`, `pod_go`), mapped tightly to the UI.

## File Design
- Extensive in-line documentation. Builders (like `stadium-builder.ts`) feature massive block comments explaining the reversed-engineered format constraints, often referencing the exact "STAD-" bug ticket or Phase that solved them.

## Error Handling
- Validation functions throw specific errors or return `Warning[]` arrays, allowing the LLM pipeline to catch mistakes and theoretically attempt a retry or surface a warning to the user regarding DSP limits.
