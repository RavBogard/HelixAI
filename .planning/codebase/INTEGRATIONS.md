# External Integrations

## AI Providers
- **Google DeepMind / Gemini API**: Powered by `@google/genai`. Used for two primary functions:
  1. Text-to-Preset: Translating natural language descriptions of tone into structured JSON representations (`PresetSpec`).
  2. Vision API (`rig-vision.ts`): Parsing uploaded images (e.g. photos of pedalboards) into rig parameters and signal chains.

## Database and Backend-as-a-Service
- **Supabase**: Handles user authentication, session management, and likely preset saving/sharing. Managed via `@supabase/ssr` for Next.js App Router compatibility.

## Deployment & Hosting
- **Vercel**: Indicated by `vercel.json` and standard Next.js deployment patterns.

## External Libraries 
- **Browser Image Compression**: Used client-side to minimize payload sizes before sending images to the Gemini Vision API.
