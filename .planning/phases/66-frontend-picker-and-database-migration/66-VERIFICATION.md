---
phase: 66-frontend-picker-and-database-migration
verified: 2026-03-06T18:30:00Z
status: human_needed
score: 7/7 must-haves verified
human_verification:
  - test: "Visit app in browser — verify device picker appears on welcome screen with helix_lt amber-highlighted, above the chat input"
    expected: "Grid of 6 device buttons visible above the chat textarea before any message is sent; helix_lt has amber border"
    why_human: "JSX render order is verified by code inspection but visual layout and amber highlight require browser confirmation"
  - test: "Select a device (e.g., STADIUM), type a message, send it — verify device name appears in chat and cannot be changed mid-conversation"
    expected: "After first message, device is locked; no device picker appears in chat flow; conversation uses Helix Stadium prompts"
    why_human: "Device lock prevents UI picker from reappearing during conversation — requires runtime state verification"
  - test: "When AI signals preset ready (readyToGenerate), verify 'Generating for {Device}' badge and separate Generate Preset button appear — not a device picker"
    expected: "Locked device label badge + Generate Preset button shown; no device grid at the readyToGenerate step (unless legacy null-device resume)"
    why_human: "readyToGenerate conditional rendering requires runtime AI response trigger to test"
  - test: "Click New Session — verify welcome screen reappears with device picker, device from last session pre-selected (not reset to helix_lt if another was chosen)"
    expected: "Device picker appears again; previously selected device is still highlighted (selectedDevice not reset by startOver)"
    why_human: "startOver() is verified to reset deviceLocked/needsDevicePicker but NOT selectedDevice — requires UI confirmation"
---

# Phase 66: Frontend Picker and Database Migration — Verification Report

**Phase Goal:** The device picker appears before the first chat message, the selected device flows through the entire conversation and generation pipeline, and the Supabase database stores device context per conversation — including null-safe handling for all legacy rows.

**Verified:** 2026-03-06T18:30:00Z
**Status:** human_needed (all automated checks pass; 4 runtime behaviors require browser confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `loadConversation()` detects null/empty device from DB and sets `needsDevicePicker` state instead of silently defaulting to helix_lt | VERIFIED | `page.tsx` lines 904-913: `if (data.device)` branch sets `deviceLocked(true)`; else branch sets `setNeedsDevicePicker(true)` and `setDeviceLocked(false)` |
| 2 | `supabase/schema.sql` documents the backfill migration SQL for the conversations.device column | VERIFIED | PART 3 section exists (lines 95-119); "backfill" appears twice; commented SQL covers all 4 steps (DROP NOT NULL, UPDATE, SET NOT NULL, verify) |
| 3 | `startOver()` resets `deviceLocked` and `needsDevicePicker` state to prevent stale lock state on new chat | VERIFIED | `page.tsx` lines 972-975: `setDeviceLocked(false)` and `setNeedsDevicePicker(false)` called; `selectedDevice` deliberately NOT reset (per plan) |
| 4 | A new user sees the device picker on the welcome screen before any chat input is available | VERIFIED (code) | `page.tsx` lines 1188-1210: picker div with "Which device are you building for?" appears at line 1188; chat `<form>` starts at line 1213 (after picker in DOM) |
| 5 | The device selected at conversation start is used for all chat messages and preset generation | VERIFIED | `page.tsx` line 601: `device: selectedDevice` in `/api/chat` POST body; `api/chat/route.ts` line 78: `getFamilyChatPrompt(device)` uses it; line 11: `body.device ?? "helix_lt"` reads it |
| 6 | Resuming a legacy conversation with null device shows an inline device picker in the chat flow | VERIFIED | `page.tsx` lines 1452-1511: `{needsDevicePicker ? <picker> : <badge+button>}` conditional; picker in null-device branch calls `generatePreset(undefined, id)` on click |
| 7 | Every `/api/chat` POST includes the selected device in the request body | VERIFIED | `page.tsx` line 601: `device: selectedDevice` explicitly added in `sendMessage()` fetch body; matches Phase 61 deferral fix |

**Score:** 7/7 truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/page.tsx` | DEVICE_OPTIONS/DEVICE_LABELS constants, deviceLocked/needsDevicePicker state, null-safe loadConversation, updated startOver, welcome screen picker, device in chat POST, MAINTENANCE_MODE=false, Generate Preset button | VERIFIED | All items present; TypeScript compiles with 0 errors |
| `supabase/schema.sql` | Documented backfill migration SQL for conversations.device column | VERIFIED | PART 3 section added; 2 instances of "backfill"; commented SQL with 4 migration steps |
| `src/app/api/chat/route.ts` | Reads body.device and passes to getFamilyChatPrompt | VERIFIED | Line 11: `body.device ?? "helix_lt"`; line 78: `getFamilyChatPrompt(device)` |
| `src/app/api/conversations/route.ts` | Stores device in DB on conversation creation | VERIFIED | Line 26: `.insert({ user_id: user.id, device, title: 'New Chat' })` — device column written |
| `src/app/api/conversations/[id]/route.ts` | Returns device field for loadConversation() null check | VERIFIED | Line 24: selects `id, title, device, preset_url, ...` — device column returned |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `page.tsx (loadConversation)` | `/api/conversations/[id]` | `fetch + data.device null check -> setNeedsDevicePicker(true)` | WIRED | Pattern `setNeedsDevicePicker(true)` confirmed at line 911; triggered by `if (!data.device)` at line 909 |
| `page.tsx (startOver)` | `deviceLocked state` | `setDeviceLocked(false)` | WIRED | Pattern `setDeviceLocked(false)` confirmed at line 973 inside `startOver()` |
| `page.tsx (welcome screen)` | `selectedDevice state` | `DEVICE_OPTIONS.map -> onClick -> setSelectedDevice` | WIRED | Pattern `DEVICE_OPTIONS.map` at line 1194; onClick sets `setSelectedDevice(id)` at line 1198 |
| `page.tsx (sendMessage)` | `/api/chat` | `device: selectedDevice in fetch body` | WIRED | Pattern `device: selectedDevice` at line 601 inside `sendMessage()` fetch |
| `page.tsx (sendMessage)` | `deviceLocked state` | `setDeviceLocked(true) on first message` | WIRED | Pattern `setDeviceLocked(true)` at line 587 inside `if (!deviceLocked)` guard |
| `page.tsx (readyToGenerate section)` | `generatePreset()` | `Generate Preset button onClick` | WIRED | "Generate Preset" text at line 1507; `onClick={() => generatePreset()}` at line 1494 |
| `page.tsx` | `MAINTENANCE_MODE = false` | Constant assignment | VERIFIED | Line 1770: `const MAINTENANCE_MODE = false;` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FRONT-01 | 66-02 | Device family picker appears at the start of conversation (before first user message) | SATISFIED | Welcome screen picker div (lines 1188-1210) rendered before chat form (line 1213); helix_lt pre-selected as default; `selectedDevice` always has a value before first send |
| FRONT-02 | 66-02 | Selected device family persists through the entire conversation and generation pipeline | SATISFIED | `device: selectedDevice` in chat POST (line 601); `deviceLocked` prevents mid-conversation device change (line 586-588); `/api/chat` uses device for `getFamilyChatPrompt` (line 78) and `logUsage` (line 120) |
| FRONT-03 | 66-01 | Supabase conversations table has a device column storing the selected device | SATISFIED | Schema defines `device TEXT NOT NULL` (schema.sql line 14); conversations POST inserts device (route.ts line 26); conversations GET selects device (route.ts line 47) |
| FRONT-04 | 66-01 | Legacy conversations without device show the device picker on resume (no silent default) | SATISFIED | `loadConversation()` null-safe branch at lines 909-913 sets `setNeedsDevicePicker(true)` when `data.device` is falsy; inline picker rendered at lines 1454-1485 when `needsDevicePicker` is true |

All 4 FRONT requirements satisfied. No orphaned requirements found for Phase 66 in REQUIREMENTS.md traceability table.

**Note on FRONT-01 implementation vs. must-have wording:** The Plan 66-02 `must_haves.truths` states "chat textarea is disabled until a device is explicitly clicked." The actual implementation does NOT disable the textarea — instead, helix_lt is pre-selected by default so `selectedDevice` always has a value. The plan text explicitly acknowledges this design choice: "The chat input should NOT be disabled — the pre-selected default satisfies FRONT-01's spirit." The REQUIREMENTS.md definition of FRONT-01 is "Device family picker appears at the start of conversation (before first user message)" — the picker does appear before the form, satisfying the requirement. This is an intentional, documented deviation that does not block the goal.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | No TODOs, FIXMEs, empty handlers, placeholder returns, or console-only implementations found in modified files | — | — |

The only `placeholder` text found in page.tsx is two textarea `placeholder="Describe the tone you're after..."` attributes — these are legitimate HTML input placeholder attributes, not code stubs.

### Human Verification Required

#### 1. Welcome Screen Device Picker Visual Layout

**Test:** Run `npm run dev`, visit the app in a browser (not maintenance page). Verify the 6-button device grid ("Which device are you building for?") appears ABOVE the chat input textarea on the welcome screen. Verify helix_lt has the amber border highlight.

**Expected:** Device picker grid visible before the chat form; LT button has amber border and amber shadow glow; other buttons have neutral border.

**Why human:** JSX source order confirms the picker div precedes the form (lines 1188 vs 1213), but CSS layout (flex-col, absolute positioning) could theoretically reorder visual render. Amber conditional className logic requires runtime verification.

#### 2. Device Lock After First Message

**Test:** Select STADIUM device, type a message, send it. After the AI responds, verify no device picker reappears in the chat flow. Verify the device cannot be changed until New Session.

**Expected:** After first message is sent, `deviceLocked` becomes `true`; no device picker buttons appear in subsequent chat turns; device badge shows "Helix Stadium" at readyToGenerate.

**Why human:** `setDeviceLocked(true)` fires in `sendMessage()` but the UI impact (no picker in chat) depends on runtime React state that can only be confirmed in browser.

#### 3. Generate Preset Button at readyToGenerate

**Test:** Complete a chat conversation with FLOOR selected until the AI signals it has enough information. Verify the readyToGenerate section shows "Generating for Helix Floor" badge and a "Generate Preset" button — not a device picker grid.

**Expected:** Locked badge text "Generating for Helix Floor" appears; single "Generate Preset" button below it; no device grid (that only appears for null-device legacy resume).

**Why human:** The `readyToGenerate` conditional requires the AI to signal intent — this state change cannot be triggered via static code analysis.

#### 4. New Session Resets Picker (Device Pre-Selected from Last Session)

**Test:** After a conversation with POD GO selected, click New Session (startOver). Verify the welcome screen shows the device picker again with POD GO still highlighted (not reset to helix_lt).

**Expected:** `startOver()` resets `deviceLocked` and `needsDevicePicker` to false but does NOT reset `selectedDevice` — the last-used device stays highlighted for UX convenience.

**Why human:** `selectedDevice` retention in startOver is verified in code (line 975 comment + no `setSelectedDevice` call) but requires browser confirmation that the highlight persists correctly.

### Gaps Summary

No blocking gaps found. All 7 automated must-have truths verified. All 4 FRONT requirements satisfied. TypeScript compiles with zero errors. No anti-patterns detected.

Phase goal is achieved at the code level: the device picker appears before first message (welcome screen, lines 1188-1210), the selected device flows through the entire pipeline (sendMessage -> /api/chat -> getFamilyChatPrompt), the Supabase database stores device per conversation (conversations route + schema.sql device column), and null-safe handling is in place for legacy rows (loadConversation null check -> setNeedsDevicePicker).

4 runtime behaviors require human browser verification before the phase can be declared fully complete.

---

_Verified: 2026-03-06T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
