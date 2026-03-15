# Structure

## Directory Layout
- **`src/app/`**: Next.js App Router endpoints, pages, and layouts. The main entry point for the frontend UI.
- **`src/components/`**: Reusable React components, particularly the complex drag-and-drop Visualizer nodes and toolbar elements.
- **`src/lib/`**: The core business logic layer.
  - **`src/lib/helix/`**: The massive logic hub for Line 6 preset manipulation. Contains all validators, builders, and device family logic.
  - **`src/lib/helix/catalogs/`**: JSON catalogs of device capabilities and models.
  - **`src/lib/helix/families/`**: Device-specific planner prompts (e.g., `families/stadium/prompt.ts`).
  - **`src/lib/supabase/`**: Client and server wrapper utilities for Supabase interaction.
  - **`src/lib/visualizer/`**: React state management logic for the interactive signal chain builder.
- **`public/`**: Static assets.

## Key Files
- **`src/lib/types.ts`**: The single source of truth for the cross-device object model (`PresetSpec`, `BlockSpec`, etc.).
- **`src/lib/models.ts`**: The canonical catalog mapping human-readable node names to precise Line 6 internal IDs.
- **`src/lib/helix/XXX-builder.ts`**: The four engines that serialize the `PresetSpec` into actual downloadable preset files.
