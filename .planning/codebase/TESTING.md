# Testing

## Framework
- **Vitest**: Fast test runner using Vite.
- Tests are collocated with their implementations (`filename.test.ts`).

## Coverage and Approach
- Excellent coverage in the core preset builders. For instance, `rig-mapping.test.ts` (15KB), `quality-validate.test.ts` (23KB), `stadium-builder.test.ts` (39KB), and `param-engine.test.ts` (56KB) are extremely deep.
- Testing philosophy heavily revolves around building mock `PresetSpec` objects and firing them against the validation or builder engines to ensure the JSON structural output is byte-for-byte accurate to what Line 6 expects.

## Gaps
- While the math and JSON schema outputs are heavily tested, the system relies on the assumption that the "source of truth" (`models.ts`) is accurate. If a parameter default is wrong in `models.ts`, the tests will still pass, but the preset will sound bad.
- The interactive Visualizer frontend likely lacks end-to-end (Playwright/Cypress) coverage for drag-and-drop operations, relying instead on unit testing the pure `dnd-constraints.ts` logic.
