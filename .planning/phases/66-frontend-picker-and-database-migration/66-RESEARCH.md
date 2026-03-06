# Phase 66: Frontend Picker and Database Migration - Research

**Researched:** 2026-03-06
**Domain:** React state management, Supabase SQL migration, Next.js API routes, DeviceTarget propagation
**Confidence:** HIGH (all findings from direct codebase inspection — no external library uncertainty)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FRONT-01 | Device family picker appears at the start of conversation (before first user message) | Picker must relocate from post-READY_TO_GENERATE position into the pre-chat welcome screen; chat input disabled until device selected |
| FRONT-02 | Selected device family persists through the entire conversation and generation pipeline | Device locked at conversation start; `selectedDevice` frozen after first message; `/api/chat` must receive device; conversation row stores device |
| FRONT-03 | Supabase conversations table has a device column storing the selected device | Column already exists with `NOT NULL` constraint; migration needed only if legacy rows lack value — backfill from preset_url heuristic |
| FRONT-04 | Legacy conversations without device show the device picker on resume (no silent default) | `loadConversation()` must detect null/empty device from DB and set `needsDevicePicker: true` instead of defaulting |
</phase_requirements>

---

## Summary

Phase 66 is a product-behavior change that reorders when device selection happens. Currently, device selection is a "mid-conversation" step — it appears after the AI signals `[READY_TO_GENERATE]`, and clicking a device button simultaneously selects the device AND triggers `generatePreset()`. The new requirement is that device selection must happen at conversation START, before the user types their first message.

The Supabase schema already has a `device TEXT NOT NULL` column on the conversations table (confirmed in `supabase/schema.sql` and seen in all API route `.select()` calls). The migration concern is not structural: it is about legacy rows that were created before the column was enforced, or rows where the device value may be empty/NULL due to bugs. The backfill strategy uses a preset_url heuristic (if a `.hsp` file exists in the preset_url column, device was Stadium; `.pgp` means Pod Go; `.hlx` with no further context defaults to `helix_lt`).

The frontend change has three interconnected concerns: (1) showing the picker on the welcome screen before any chat, (2) locking the device once a conversation starts, and (3) showing the picker again on resume when the DB row has a null/empty device value. The `/api/chat` route already accepts a `device` parameter but the frontend currently does NOT send `device` in the chat POST body — only `/api/generate` sends device. This is a gap that must be closed.

**Primary recommendation:** Move the device picker to the welcome screen as a mandatory gate (input disabled until device selected), lock `selectedDevice` after first message, send device on every `/api/chat` POST, and handle null-device resume by showing the picker inline in the resumed chat rather than crashing or defaulting silently.

---

## Standard Stack

### Core (already in project — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React `useState` | 19.2.3 (Next.js 16.1.6) | `selectedDevice`, `deviceLocked`, `needsDevicePicker` state | Already wired throughout page.tsx |
| Supabase JS | `@supabase/supabase-js` ^2.98.0 | Conversation reads/writes with device column | Already handles device column in all API routes |
| `@supabase/ssr` | ^0.9.0 | Server-side Supabase client for Next.js API routes | Used in all existing route.ts files |
| TypeScript `DeviceTarget` | from `@/lib/helix/types` | Type safety for device values | Already imported in chat route and page.tsx |
| Vitest | ^4.0.18 | Test runner | Config at `vitest.config.ts`, node environment |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline picker on welcome screen | Separate route/page for device selection | Separate route requires router changes, breaks back-navigation; inline picker is same file, less disruption |
| Lock device via React state freeze | URL param or localStorage | State freeze is simpler; URL param persists across refreshes (overkill); localStorage adds persistence complexity |
| Backfill migration SQL | No backfill, null-safe reads only | Backfill gives deterministic state; null-safe reads only means picker re-appears for resumed conversations forever — acceptable per FRONT-04 but messy for real users who had devices |

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. Changes are concentrated in:

```
src/
├── app/
│   ├── page.tsx                    # Welcome screen picker gate, device lock, chat POST body fix, resume picker
│   └── api/
│       └── chat/
│           └── route.ts            # Already reads device from body; ensure it's always sent
└── supabase/
    └── schema.sql                  # Add backfill migration comment (actual migration runs in Supabase Dashboard)
```

### Pattern 1: Pre-Chat Device Gate

**What:** On the welcome screen (when `messages.length === 0`), render a device picker BEFORE the chat input form. The text input's `disabled` state is `!selectedDevice || deviceLocked === false`. Once a device is selected, the disabled state lifts and the welcome screen input becomes active.

**Current state (Phase 41 result):** The device picker only appears AFTER `readyToGenerate === true`, which happens mid-conversation. The welcome screen input is always enabled.

**New state:** The device picker appears on the welcome screen. Chat input is `disabled` until a device is selected. Once selected, device is visually locked (no picker shown during active chat).

**When to use:** `messages.length === 0 && !conversationId` (fresh conversation) OR `messages.length > 0 && needsDevicePicker` (resumed legacy conversation with null device).

**Key implementation points from codebase:**

```tsx
// src/app/page.tsx — current selectedDevice state (line 311)
const [selectedDevice, setSelectedDevice] = useState<
  "helix_lt" | "helix_floor" | "pod_go" | "helix_stadium" | "helix_stomp" | "helix_stomp_xl"
>("helix_lt");

// NEW: add deviceLocked state — true once conversation starts
const [deviceLocked, setDeviceLocked] = useState(false);
// NEW: add needsDevicePicker — true when resume finds null device
const [needsDevicePicker, setNeedsDevicePicker] = useState(false);
```

```tsx
// Welcome screen device picker — show BEFORE the chat form
{messages.length === 0 && (
  <div className="flex flex-col items-center gap-3">
    <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
      Which device are you building for?
    </p>
    <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
      {DEVICE_OPTIONS.map(({ id, label, desc }) => (
        <button
          key={id}
          onClick={() => setSelectedDevice(id)}
          className={/* amber border when selectedDevice === id, else default */}
        >
          {label}
          <span>{desc}</span>
        </button>
      ))}
    </div>
  </div>
)}

// Chat input — disabled until device selected
<textarea
  disabled={isStreaming || !selectedDevice || messages.length === 0 && !/* has device */true}
  ...
/>
```

**The tricky part:** The welcome screen currently has TWO separate layout modes — the form at the top and the suggestion cards below. The device picker must insert between the wordmark/subtitle block and the chat form. The chat form's submit button must be disabled or the device selection label must make it visually clear the user must pick first.

### Pattern 2: Device Lock After First Message

**What:** Once `sendMessage()` is called for the first time, `setDeviceLocked(true)` prevents the device from changing. The mid-conversation device picker (currently gated on `readyToGenerate`) must be replaced with a passive device badge showing the locked device.

**When to use:** After `sendMessage()` is called (when `isFirstMessageRef.current` transitions from `true` to used).

```tsx
// In sendMessage(), after building userMessage:
if (isFirstMessageRef.current) {
  setDeviceLocked(true);  // Lock device immediately
}
```

```tsx
// Replace the post-readyToGenerate picker with a locked badge:
{readyToGenerate && !isStreaming && !generatedPreset && (
  <div className="flex flex-col items-center gap-4 py-6">
    {/* Show locked device badge instead of picker */}
    <p className="text-[11px] text-[var(--hlx-text-muted)]">
      Generating for {DEVICE_LABELS[selectedDevice]}
    </p>
    <button onClick={() => generatePreset()}>
      Generate Preset
    </button>
  </div>
)}
```

**Critical:** The generate button must still exist at the `readyToGenerate` point. The behavior changes from "click device to both select AND generate" to "click Generate to use the already-selected device."

### Pattern 3: Send Device on Every /api/chat POST

**What:** The `/api/chat` route already reads `device` from the request body (`const device: DeviceTarget = body.device ?? "helix_lt"`). But `sendMessage()` in page.tsx does NOT send device in the POST body — only `messages`, `premiumKey`, and optionally `conversationId` are sent.

**Current gap (verified from page.tsx line 567-574):**
```typescript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: newMessages,
    premiumKey,
    ...(convId ? { conversationId: convId } : {}),
    // MISSING: device not sent!
  }),
});
```

**Fix:**
```typescript
body: JSON.stringify({
  messages: newMessages,
  premiumKey,
  device: selectedDevice,           // ADD THIS
  ...(convId ? { conversationId: convId } : {}),
}),
```

This ensures the per-family chat prompt is selected correctly for every message. Currently the route falls back to `"helix_lt"` silently — a bug that Phase 65's per-family prompts make consequential.

### Pattern 4: Resume with Null Device

**What:** When `loadConversation()` fetches a conversation that has a null or empty device column, instead of defaulting to `helix_lt`, set `needsDevicePicker: true`. The chat flow then shows a device picker inline before enabling the generate button.

**Current `loadConversation()` behavior (page.tsx lines 876-878):**
```typescript
// Restore device
if (data.device) {
  setSelectedDevice(data.device as ...);
}
// MISSING: what happens when data.device is null/empty? → selectedDevice stays at "helix_lt" default
```

**Fix:**
```typescript
if (data.device) {
  setSelectedDevice(data.device as DeviceTarget);
  setNeedsPicker(false);
} else {
  // Legacy row — show picker instead of silently defaulting
  setNeedsPicker(true);
}
```

The resumed chat must then show the device picker if `needsDevicePicker === true`, and disable the generate button until a device is explicitly chosen.

### Pattern 5: Supabase Migration (Backfill + Null-Safe Reads)

**What:** The schema already has `device TEXT NOT NULL`. The concern is EXISTING rows created before the column existed, or rows where device was inserted as an empty string. The migration has two parts:

1. **SQL backfill (run in Supabase Dashboard SQL Editor):**
```sql
-- Step 1: Make column nullable temporarily to allow reads on legacy rows
ALTER TABLE conversations ALTER COLUMN device DROP NOT NULL;

-- Step 2: Backfill based on preset_url extension heuristic
UPDATE conversations
SET device = CASE
  WHEN preset_url LIKE '%.hsp' THEN 'helix_stadium'
  WHEN preset_url LIKE '%.pgp' THEN 'pod_go'
  ELSE 'helix_lt'  -- conservative default for .hlx and NULL preset_url
END
WHERE device IS NULL OR device = '';

-- Step 3: Re-add NOT NULL (all rows now have a value)
ALTER TABLE conversations ALTER COLUMN device SET NOT NULL;
```

2. **Null-safe code paths:** Even after backfill, code that reads `conversations.device` must handle `null` gracefully (TypeScript `string | null` type for API responses, optional chaining in `loadConversation()`).

**CRITICAL STATE.md decision (confirmed):** "Frontend picker + DB migration ship atomically (Phase 66) — deploying picker without migration causes legacy conversation crashes."

The crash path: if old rows have `device = NULL` and API routes do `SELECT device` then pass it to `getFamilyChatPrompt(device)`, TypeScript will have typed it as `DeviceTarget` but the value is null — causing `resolveFamily(null)` to hit the `assertNever` guard and crash.

### Pattern 6: Extract DEVICE_OPTIONS Constant

**What:** The device picker list is currently duplicated THREE times in page.tsx (welcome screen rig picker lines ~1308-1316, chat-flow picker lines ~1401-1409, and the post-resume continuation chips). Extract to a shared constant.

```typescript
// Add near the top of page.tsx, after LED_CSS and BLOCK_LABEL constants
const DEVICE_OPTIONS = [
  { id: "helix_lt" as const, label: "LT", desc: "Helix LT" },
  { id: "helix_floor" as const, label: "FLOOR", desc: "Helix Floor" },
  { id: "helix_stadium" as const, label: "STADIUM", desc: "Helix Stadium" },
  { id: "pod_go" as const, label: "POD GO", desc: "Pod Go" },
  { id: "helix_stomp" as const, label: "STOMP", desc: "HX Stomp" },
  { id: "helix_stomp_xl" as const, label: "STOMP XL", desc: "HX Stomp XL" },
] as const;

const DEVICE_LABELS: Record<typeof DEVICE_OPTIONS[number]["id"], string> = {
  helix_lt: "Helix LT",
  helix_floor: "Helix Floor",
  helix_stadium: "Helix Stadium",
  pod_go: "Pod Go",
  helix_stomp: "HX Stomp",
  helix_stomp_xl: "HX Stomp XL",
};
```

### Anti-Patterns to Avoid

- **Anti-pattern: Allowing device change mid-conversation.** Once `sendMessage()` is called, `deviceLocked` must be `true`. The rig-photo picker (lines ~1308-1316) immediately calls `handleRigGenerate(id)` on click — it both selects AND generates atomically, so it is exempt from the lock (the conversation hasn't started via chat). The chat-flow path is what needs locking.
- **Anti-pattern: Moving the DB migration to application startup code.** The backfill is a one-time SQL operation. Do NOT attempt it via Supabase JS at runtime in an API route — it would require admin credentials and run on every server start.
- **Anti-pattern: Defaulting null device silently to `helix_lt`.** This is exactly what FRONT-04 prohibits. Show the picker; don't guess.
- **Anti-pattern: Fetching device from the conversation row on every chat message.** The device is locked at conversation start. No need to re-read it from the DB mid-conversation — use React state.
- **Anti-pattern: Sending `device` to `/api/conversations` (create) as the ONLY source of truth.** The create route already stores device. But `selectedDevice` in React state is also the source for the chat route. Both must agree — the React state is set first, then POST to create conversation uses the same value.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Device locking | Custom event system or context | Simple React `useState(deviceLocked)` | State is local to HomeContent, no cross-component need |
| Legacy row detection | Complex DB migration with conditional logic | SQL CASE statement in UPDATE | One-time operation; Supabase SQL Editor runs it directly |
| Type-safe device values | Runtime string validation | Existing `DeviceTarget` type from `@/lib/helix/types` | Already in use everywhere; cast at API boundary |
| Null device fallback | Default constant somewhere in code | Show picker (FRONT-04 requirement) | Any default silently assigns wrong device |

**Key insight:** The device picker already exists in three places in page.tsx. This phase moves one instance (the chat-flow picker) earlier in the UX flow, removes the device-selection-triggers-generation coupling, and adds one new state variable for locking. The Supabase work is one SQL statement plus one null-check in `loadConversation()`.

---

## Common Pitfalls

### Pitfall 1: MAINTENANCE_MODE Blocks Testing

**What goes wrong:** `const MAINTENANCE_MODE = true` at line 1691 of page.tsx means the app renders `<MaintenancePage />` instead of `<HomeContent />`. All manual testing of the new picker flow is blocked.

**Why it happens:** The variable was set during the v5.0 refactor and not yet cleared.

**How to avoid:** The plan for 66-02 must explicitly set `MAINTENANCE_MODE = false` as its first step, then restore it if not yet ready to go live (or leave it false if v5.0 is ready).

**Warning signs:** App shows "We're Making Things Better" page instead of the chat interface.

### Pitfall 2: Device Not Sent on /api/chat Breaks Per-Family Prompts

**What goes wrong:** After Phase 65, `getFamilyChatPrompt(device)` dispatches to different system prompts per device family. If `device` is not in the chat POST body, the route defaults to `body.device ?? "helix_lt"` — so a Stadium conversation uses the Helix chat prompt for ALL subsequent messages.

**Why it happens:** The gap was introduced in Phase 61: "Chat route (/api/chat) defers device wiring to Phase 66 — chat does not currently receive device param" (from STATE.md Accumulated Context).

**How to avoid:** Phase 66-02 must add `device: selectedDevice` to the `sendMessage()` fetch body. This is the explicit Phase 61 deferral being resolved.

**Warning signs:** Stadium conversations showing Helix-style questions about dual DSP, or Stomp conversations not getting block-budget constraints.

### Pitfall 3: The Rig Upload Picker Must Keep Its Generate-on-Click Behavior

**What goes wrong:** The rig upload device picker (lines ~1308-1338) uses `onClick={() => { setSelectedDevice(id); handleRigGenerate(id); }}` — clicking a device both selects it AND immediately generates. If this is refactored to match the new chat-flow pattern (select now, generate later), the rig upload flow breaks.

**Why it happens:** These are two different flows: rig upload has enough data before device selection (the pedal photos), so generate-on-click is correct. Chat flow needs chat first, then generate.

**How to avoid:** Do not modify the rig upload picker. Only modify the chat-flow picker (currently at `readyToGenerate && !isStreaming && !generatedPreset`).

**Warning signs:** Rig upload device selection no longer triggers generation.

### Pitfall 4: resuming to Null Device State If Backfill Didn't Run

**What goes wrong:** If the SQL backfill migration is not run before deploying the code changes, `loadConversation()` gets `data.device = null` from the API, detects it as legacy, sets `needsDevicePicker: true` — which is correct behavior per FRONT-04. But if the migration HAS run, all rows have device values and this code path is dead.

**Why it happens:** Migration order matters. The STATE.md decision says "ship atomically" — run the migration BEFORE or simultaneously with the code deploy.

**How to avoid:** Plan 66-01 runs the Supabase migration. Plan 66-02 deploys the code that handles null-device rows gracefully. The null-safe code handles both the pre-migration state (rows still null) AND the post-migration state (all rows have values).

**Warning signs:** Users of legacy conversations see the device picker every time they resume (expected pre-backfill, should disappear post-backfill).

### Pitfall 5: TypeScript Type Mismatch on Null Device Column

**What goes wrong:** The conversations API GET at `/api/conversations/[id]/route.ts` does `select('id, title, device, ...')` and returns the data directly. If the DB column is now nullable (because we dropped NOT NULL during migration), TypeScript type inference doesn't know — the response type is still typed as `string`. But at runtime, `device` can be `null`.

**Why it happens:** Supabase JS generates types based on the schema, but only if you're using the generated type system. This project uses plain JS types for the API response shape.

**How to avoid:** In `loadConversation()`, treat `data.device` as `string | null | undefined` regardless of what TypeScript infers. The `if (data.device)` falsy check already handles null and empty string correctly — do NOT change it to `if (data.device !== undefined)`.

**Warning signs:** `getFamilyChatPrompt(null)` called at runtime → `resolveFamily(null)` → `assertNever` throws.

### Pitfall 6: startOver() Must Reset deviceLocked and needsDevicePicker

**What goes wrong:** User completes a conversation, clicks "New Session" → `startOver()` runs. If `deviceLocked` is not reset to `false`, the new welcome screen shows no picker (can't change device from the lock state). If `needsDevicePicker` is not reset, the new empty chat shows the resume-picker instead of the welcome picker.

**Why it happens:** `startOver()` resets all conversation state explicitly. New state variables must be added to it.

**How to avoid:** Add to `startOver()`:
```typescript
setDeviceLocked(false);
setNeedsDevicePicker(false);
// Do NOT reset selectedDevice — keep the last-used device pre-selected for UX convenience
```

**Warning signs:** New chat after a completed conversation shows locked device badge instead of device picker on welcome screen.

---

## Code Examples

Verified patterns from existing codebase:

### Current sendMessage() Chat POST Body (Gap to Fix)

```typescript
// Source: src/app/page.tsx lines 567-574 — CURRENT (missing device)
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: newMessages,
    premiumKey,
    ...(convId ? { conversationId: convId } : {}),
    // device: selectedDevice  ← MISSING — must add in Phase 66-02
  }),
});
```

### /api/chat Route Already Reads device (No Change Needed)

```typescript
// Source: src/app/api/chat/route.ts lines 9-11 — already correct
const body = await req.json();
const { messages, premiumKey, conversationId } = body;
const device: DeviceTarget = body.device ?? "helix_lt";  // fallback is now harmless once frontend sends device
```

### loadConversation() Device Restore (Current)

```typescript
// Source: src/app/page.tsx lines 875-878 — CURRENT (no null handling)
// Restore device
if (data.device) {
  setSelectedDevice(data.device as "helix_lt" | "helix_floor" | ...);
}
// Missing: else { setNeedsDevicePicker(true); }
```

### ensureConversation() Already Sends Device to Create Endpoint

```typescript
// Source: src/app/page.tsx lines 526-531 — already correct
const res = await fetch("/api/conversations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ device: selectedDevice }),  // device already sent on create
});
```

### Supabase Backfill Migration SQL

```sql
-- Source: Pattern derived from supabase/schema.sql; run in Supabase Dashboard SQL Editor

-- Step 1: Allow NULL temporarily (in case NOT NULL constraint blocks UPDATE)
ALTER TABLE conversations ALTER COLUMN device DROP NOT NULL;

-- Step 2: Backfill from preset_url extension
-- .hsp → helix_stadium, .pgp → pod_go, everything else → helix_lt
UPDATE conversations
SET device = CASE
  WHEN preset_url LIKE '%.hsp' THEN 'helix_stadium'
  WHEN preset_url LIKE '%.pgp'  THEN 'pod_go'
  ELSE 'helix_lt'
END
WHERE device IS NULL OR device = '';

-- Step 3: Re-enforce NOT NULL
ALTER TABLE conversations ALTER COLUMN device SET NOT NULL;

-- Verify: should return 0 rows
SELECT COUNT(*) FROM conversations WHERE device IS NULL OR device = '';
```

### Device Options Constant (Avoids Triple Duplication)

```typescript
// Source: derived from existing page.tsx lines 1310-1315 and 1403-1408

// DeviceTarget values already used in page.tsx — extract to constant
const DEVICE_OPTIONS = [
  { id: "helix_lt" as const,       label: "LT",       desc: "Helix LT" },
  { id: "helix_floor" as const,    label: "FLOOR",    desc: "Helix Floor" },
  { id: "helix_stadium" as const,  label: "STADIUM",  desc: "Helix Stadium" },
  { id: "pod_go" as const,         label: "POD GO",   desc: "Pod Go" },
  { id: "helix_stomp" as const,    label: "STOMP",    desc: "HX Stomp" },
  { id: "helix_stomp_xl" as const, label: "STOMP XL", desc: "HX Stomp XL" },
] as const satisfies ReadonlyArray<{
  id: typeof DEVICE_OPTIONS[number]["id"];  // TypeScript validates exhaustiveness
  label: string;
  desc: string;
}>;
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Device picker gated on `messages.length >= 2` | Gated on `readyToGenerate` signal | Phase 41 | Picker appears after AI signals readiness |
| `device` not sent on `/api/chat` POST | `device` defaults to `helix_lt` in route | Phase 61 deferral | All chat uses Helix prompt regardless of device — now consequential since Phase 65 added per-family prompts |
| Device selection triggers generation immediately | Picker appears, then separate Generate button click | Phase 41 current pattern | Generate-on-device-click for chat flow |

**After Phase 66:**
- Device picker appears on welcome screen BEFORE first message (blocked input until selected)
- Device locked after first message (no picker during chat; shows locked badge at `readyToGenerate`)
- `/api/chat` receives correct device on every message (per-family prompts fully active)
- Legacy DB rows null-safe (either backfilled or prompt picker on resume)

---

## Open Questions

1. **Should device selection be skippable on the welcome screen?**
   - What we know: FRONT-01 says users "cannot start a conversation without selecting a device." Success criterion #1 is explicit.
   - What's unclear: Whether a pre-selected default (helix_lt highlighted) counts as "selected" or whether the user must make an explicit click.
   - Recommendation: Pre-select `helix_lt` as the default (highlighted state), but enable the chat input immediately. This satisfies the spirit (device is always set before chat starts) without a hard gate that could frustrate users. If the requirement strictly means "must click to select," then disable input until explicit click — but this risks friction for the most common device.

2. **What happens to the rig upload flow's device-select-and-generate button?**
   - What we know: The rig upload picker (lines ~1308-1338) calls `handleRigGenerate(id)` on device click. It sets device AND generates immediately — no separate generate step.
   - What's unclear: Should this flow also require pre-selection before the rig upload, or remain generate-on-click?
   - Recommendation: Leave the rig upload picker behavior unchanged. It operates in the welcome screen (messages.length === 0) context where device is not yet locked, and the immediate generate-on-click behavior is correct UX for that flow.

3. **What if preset_url is NULL for a legacy row during backfill?**
   - What we know: The backfill SQL defaults to `helix_lt` when preset_url is NULL (the ELSE branch). This is a conservative guess.
   - What's unclear: How many such rows exist and whether users care that their resumed conversation now says "Helix LT."
   - Recommendation: Accept the conservative default. FRONT-04 says legacy rows without device should show the picker on resume — but if we backfill them, they'll skip the picker. The backfill improves UX for most users; the picker fallback handles the few where the guess is wrong (they can re-select).

---

## Sources

### Primary (HIGH confidence)
- `src/app/page.tsx` — Direct inspection: device picker JSX (lines ~1308-1338, ~1396-1433), `selectedDevice` state (line 311), `sendMessage()` fetch body (lines 567-574), `loadConversation()` device restore (lines 875-878), `startOver()` (lines 913-937), `ensureConversation()` (lines 512-545), `MAINTENANCE_MODE` constant (line 1691)
- `src/app/api/chat/route.ts` — Direct inspection: device extraction from body (line 11), `getFamilyChatPrompt(device)` call (line 78)
- `src/app/api/conversations/route.ts` — Direct inspection: POST creates conversation with device (lines 20-35), GET returns device in list (line 47)
- `src/app/api/conversations/[id]/route.ts` — Direct inspection: GET returns device (line 22), no null-handling for device
- `src/lib/prompt-router.ts` — Direct inspection: `getFamilyChatPrompt(device)` dispatches per family (lines 49-61)
- `src/lib/helix/device-family.ts` — Direct inspection: `resolveFamily()` exhaustive switch (lines 212-233), `assertNever` guard (line 63)
- `supabase/schema.sql` — Direct inspection: `device TEXT NOT NULL` column definition (line 14)
- `.planning/STATE.md` — Accumulated decisions: Phase 61 chat-route device deferral, Phase 66 atomic ship requirement

### Secondary (MEDIUM confidence)
- `.planning/phases/41-chat-ux-device-selection-timing-and-pre-preset-conversation-flow/41-RESEARCH.md` — Prior art for device picker gating, `readyToGenerate` patterns, pitfalls around picker visibility

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing code verified by inspection
- Architecture: HIGH — all patterns derived from existing code paths; no external API uncertainty
- Pitfalls: HIGH — each pitfall traced to specific file and line number from direct inspection
- Supabase migration: HIGH — schema confirmed, backfill SQL is standard ALTER TABLE + UPDATE pattern
- Open questions: MEDIUM — product decisions (whether pre-selected default counts as "selected") depend on PM intent

**Research date:** 2026-03-06
**Valid until:** 60 days — stable codebase, no external library changes involved
