# Phase 37 Summary — UI Device Selector + Download

**Phase:** 37
**Plan:** 01
**Status:** Complete
**Date:** 2026-03-04

## Requirements Satisfied

- STAD-07: UI surfaces Helix Stadium as a fourth device option in both device pickers, with correct filename suffix (`_Stadium`), device badge (`STADIUM`), and `.hsp` download support

## Changes Made

### src/app/page.tsx

1. **`selectedDevice` type** (line 309): extended union to `"helix_lt" | "helix_floor" | "pod_go" | "helix_stadium"`
2. **`generatePreset()` signature** (line 652): same type extension on `overrideDevice?` parameter
3. **`handleRigGenerate()` signature** (line 744): same type extension
4. **`setSelectedDevice()` in `loadConversation()`** (line 842): type cast extended to include `"helix_stadium"`
5. **`downloadPreset()` deviceSuffix** (lines 764-767): added `helix_stadium → "_Stadium"` case
6. **`downloadStoredPreset()`** (lines 796-801):
   - `ext`: added `.hsp` detection — `storedPresetPath.endsWith(".hsp") ? ".hsp" : storedPresetPath.endsWith(".pgp") ? ".pgp" : ".hlx"`
   - `deviceSuffix`: added `helix_stadium → "_Stadium"` case
7. **Device array #1** (rig generate welcome screen): `grid-cols-3` → `grid-cols-4`; added `{ id: "helix_stadium", label: "STADIUM", desc: "Helix Stadium" }`
8. **Device array #2** (post-interview picker): `grid-cols-3` → `grid-cols-4`; added `{ id: "helix_stadium", label: "STADIUM", desc: "Helix Stadium" }`
9. **Device badge**: added `helix_stadium → "STADIUM"` ternary case
10. **"Generate for other device" chip**:
    - `otherDevice` logic: `pod_go → helix_lt`, `helix_stadium → helix_lt`, `helix_lt → helix_floor`, else `helix_lt`
    - Label: `pod_go || helix_stadium → "Helix LT"`, `helix_lt → "Helix Floor"`, else `"Helix LT"`

## Verification

- `npx vitest run`: 108/108 passing
- `npm run build`: Clean
- Helix LT, Helix Floor, and Pod Go paths: unmodified
