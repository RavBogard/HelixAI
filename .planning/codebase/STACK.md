# Tech Stack

## Core Technologies
- **Framework**: Next.js 16.1.6 (App Router)
- **UI Library**: React 19.2.3 & ReactDOM 19.2.3
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand 5.0.11

## Key Libraries & Dependencies
- **AI Integration**: `@google/genai` ^1.42.0 (Gemini API for preset generation and vision parsing)
- **Database & Auth**: `@supabase/ssr` ^0.9.0 & `@supabase/supabase-js` ^2.98.0
- **Drag & Drop**: `@dnd-kit/core`, `sortable`, `utilities` (For interactive visualizer)
- **Validation & Schemas**: `zod` ^4.3.6 (Used for strict schema enforcement, though we need to expand its use for v2.0)
- **Markdown Rendering**: `react-markdown` ^10.1.0
- **Image Processing**: `browser-image-compression` ^2.0.2

## Development & Testing
- **Linter**: ESLint 9 + Next Config
- **Test Runner**: Vitest ^4.0.18
- **UI Testing**: `@testing-library/react` & `jest-dom`
- **Mocking**: `jsdom`
