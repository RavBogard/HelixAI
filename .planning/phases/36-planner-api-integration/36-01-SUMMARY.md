# Phase 36 Summary — Planner + API Route Integration

**Phase:** 36
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-06: End-to-end Stadium generate pipeline — `/api/generate` with `{ device: "helix_stadium" }` returns `.hsp` payload with `fileExtension: ".hsp"`

## Changes Made

### src/app/api/generate/route.ts

1. Added `buildHspFile` and `summarizeStadiumPreset` to imports from `@/lib/helix`
2. Replaced the Stadium 501 stub with the real Stadium path:
   - `buildHspFile(presetSpec)` → `hspFile`
   - `summarizeStadiumPreset(presetSpec)` → `summary`
   - Fire-and-forget Supabase Storage upload: stores `hspFile.serialized` (magic header + JSON) as `application/octet-stream` at `{user_id}/{conversation_id}/latest.hsp`
   - `preset_url` updated to `storagePath` in conversations table
   - Response: `{ preset: hspFile.json, summary, fileExtension: ".hsp", device: "helix_stadium", ... }`

## Storage Decision

- **Supabase**: stores `hspFile.serialized` (`"rpshnosj" + JSON`) as Buffer — downloaded `.hsp` file has correct magic header
- **API response `preset` field**: `hspFile.json` (pure JSON object) — consistent with `.hlx` and `.pgp` response patterns

## Verification

- `npx vitest run`: 108/108 passing
- `npm run build`: Clean
- Helix LT and Pod Go paths: unmodified

## Pipeline Flow (Stadium)

```
POST /api/generate { device: "helix_stadium" }
  → callClaudePlanner (Stadium model list from getModelListForPrompt)
  → assembleSignalChain (STADIUM_AMPS lookup, Stadium EQ, 12-block limit)
  → resolveParameters + buildSnapshots
  → validatePresetSpec (Stadium: dsp0 only, 12 blocks, 8 snapshots)
  → buildHspFile → { magic, json, serialized }
  → Supabase Storage latest.hsp (fire-and-forget)
  → NextResponse.json { preset: hspFile.json, fileExtension: ".hsp" }
```
