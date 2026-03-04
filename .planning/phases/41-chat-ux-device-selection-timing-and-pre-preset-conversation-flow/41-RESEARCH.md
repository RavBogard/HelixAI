# Phase 41: Chat UX — Device Selection Timing and Pre-Preset Conversation Flow - Research

**Researched:** 2026-03-04
**Domain:** Conversation UX design — system prompt engineering, React state management, UI conditional rendering
**Confidence:** HIGH (all findings from direct codebase inspection)

---

## Summary

This is a pure product/UX change with no new library dependencies. The entire implementation lives in two files: `src/lib/gemini.ts` (the AI system prompt that drives conversation behavior) and `src/app/page.tsx` (the React UI that renders the device picker and reacts to conversation state).

The core problem is that the device picker renders immediately after `messages.length >= 2 && !isStreaming && !generatedPreset`. This means it appears after just ONE exchange — before the AI has had any real musical conversation. The AI also sends `[READY_TO_GENERATE]` too early per its current prompt instructions: "Once you know the tone goal AND guitar type... you have enough to build a great preset. Do NOT keep asking questions."

The fix has two levers. First, change the system prompt in `gemini.ts` to encourage 2-3 conversational turns about tone before sending `[READY_TO_GENERATE]`. Second, change the `page.tsx` device picker condition so it only renders when `readyToGenerate === true` (which is only set when `[READY_TO_GENERATE]` appears in the AI response), not whenever `messages.length >= 2`.

**Primary recommendation:** Gate the device picker on `readyToGenerate === true`, and rewrite the system prompt's "When Ready to Generate" section to require at least 2 meaningful musical exchanges before emitting the signal.

---

## Current System Architecture (Verified from Codebase)

### Conversation Flow — How It Works Today

**Confidence:** HIGH — inspected `src/app/page.tsx`, `src/lib/gemini.ts`, `src/app/api/chat/route.ts`

```
User types message → sendMessage() → POST /api/chat → Gemini streams response
→ fullContent scanned for "[READY_TO_GENERATE]" → if found: setReadyToGenerate(true)
→ [READY_TO_GENERATE] stripped from displayed message
```

**Device picker render condition (line 1363 in page.tsx):**
```tsx
{messages.length >= 2 && !isStreaming && !generatedPreset && (
  <div className="flex flex-col items-center gap-4 py-6">
    <p>Which device are you building for?</p>
    <div className="grid grid-cols-4 gap-3">
      {/* 4 device buttons */}
    </div>
    {!readyToGenerate && (
      <p>Ready when you are — or keep chatting to refine the tone</p>
    )}
  </div>
)}
```

**Critical observation:** The device picker renders when `messages.length >= 2`. After one user message + one AI response, the picker is already visible. The `readyToGenerate` flag ONLY affects whether the "keep chatting" hint text appears — it does NOT gate the picker itself.

**What `readyToGenerate` actually controls today:**
- Shows/hides one line of hint text below the device grid
- Set to `true` when `[READY_TO_GENERATE]` appears in any AI response
- Set to `true` on conversation resume if last message was from assistant (line 858)
- Never hides the device picker — the picker is independently controlled by `messages.length >= 2`

### AI Prompt — When It Sends READY_TO_GENERATE

**Source:** `src/lib/gemini.ts` `getSystemPrompt()` — lines 86-104

Current prompt instructs:
> "Once you know the tone goal AND guitar type (or have made a reasonable assumption), you have enough to build a great preset. Do NOT keep asking questions — summarize your plan and include the marker."
>
> Rules:
> - "Include it after receiving even a single detailed description — do not keep probing if you already have enough"

This means the AI can (and does) send `[READY_TO_GENERATE]` on its FIRST response if the user's opening message contains enough detail (e.g., "I play a Les Paul and want a Metallica tone").

### Chat API

**Source:** `src/app/api/chat/route.ts`

Uses **Gemini** (not Claude) for chat: `gemini-2.5-flash` (standard) or `gemini-3.1-pro-preview` (premium). The `getSystemPrompt()` from `gemini.ts` is the only AI instruction. No conversation length checks, no turn counting — pure streaming response.

### Generate API

`/api/generate` calls `callClaudePlanner()` (Claude Sonnet 4-6) with the full conversation history. Device selection is passed from `selectedDevice` state. The planner prompt (`buildPlannerPrompt()` in `planner.ts`) is separate from the chat prompt — it only fires when the user clicks a device button.

---

## What Needs to Change

### Change 1: Gate Device Picker on `readyToGenerate`

**File:** `src/app/page.tsx` line 1363

**Current condition:**
```tsx
{messages.length >= 2 && !isStreaming && !generatedPreset && (
```

**New condition:**
```tsx
{readyToGenerate && !isStreaming && !generatedPreset && (
```

This is a one-word change. When `readyToGenerate` is `false`, the picker is hidden. The AI controls exactly when it appears by controlling when it emits `[READY_TO_GENERATE]`.

**Impact on `!readyToGenerate` hint text:**
The hint text at line 1397 (`{!readyToGenerate && <p>Ready when you are...</p>}`) becomes unreachable — remove it, since the picker only shows when `readyToGenerate` is already `true`.

**Impact on resume flow:**
Line 858 in `loadConversation()` already sets `readyToGenerate(true)` when loading a conversation with prior assistant messages, so resumed conversations continue to show the picker. No regression.

### Change 2: Rewrite System Prompt "When Ready to Generate" Section

**File:** `src/lib/gemini.ts` — `getSystemPrompt()` lines 86-113

The current prompt rewards speed over depth. The new prompt must enforce a minimum conversational arc: establish tone → learn guitar → confirm context → summarize and offer.

**Required behavior:**
1. Turn 1: AI asks about tone goal (artist reference, genre, vibe, specific song)
2. Turn 2: AI asks about guitar (pickup type — single coil vs humbucker vs P90)
3. Turn 3 (optional but ideal): AI asks or confirms use case OR mentions technique details (Klon, post-cab EQ, etc.) and signals readiness
4. THEN: emit `[READY_TO_GENERATE]`

**What to preserve from current prompt:**
- All guitar expertise and Helix knowledge sections (unchanged)
- Pro technique suggestions (Klon, Tube Screamer boost, post-cab EQ)
- The `[READY_TO_GENERATE]` marker mechanism itself (do not change the signal string)
- Conversation style section (enthusiasm, "ask one or two questions at a time")

**What changes:**
- Replace "do not keep probing if you already have enough" with a required minimum exchange count
- Replace "after receiving even a single detailed description" with "after at least 2-3 meaningful exchanges"
- Add guidance: first question should be about tone/artist/vibe; second about guitar type
- The AI should NOT emit `[READY_TO_GENERATE]` on its opening response

### Change 3 (Optional — Nice to Have): Pre-Chat Prompt Suggestions

When `messages.length === 0`, the UI shows a welcome/empty state. Adding 3-4 conversation starter chips could guide users into richer initial descriptions, reducing how much the AI needs to probe.

**Example chips:**
- "I want a Mark Knopfler clean tone"
- "Heavy modern metal — think Periphery"
- "Blues rock, Strat player"
- "Ambient/post-rock textures"

**This is optional** and decoupled from changes 1 and 2.

---

## Standard Stack

No new dependencies. This phase uses only existing project stack.

### Core (Unchanged)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@google/genai` | existing | Gemini chat API | `gemini-2.5-flash` drives the chat interview |
| React `useState` | Next.js 15 | `readyToGenerate`, `messages` state | Already wired |
| Tailwind CSS | existing | Device picker styling | No changes needed |

### No New Installation Required

```bash
# Nothing to install
```

---

## Architecture Patterns

### Recommended Structure of the Fix

```
src/
├── lib/
│   └── gemini.ts          # Change: rewrite getSystemPrompt() "When Ready" section
└── app/
    └── page.tsx            # Change: device picker condition + optional starter chips
```

### Pattern 1: Signal-Driven UI Gating

**What:** UI components that should only appear when the AI has explicitly signaled readiness should be gated on an AI-controlled flag, not on message count.

**Why message count fails:** `messages.length >= 2` is a proxy for "conversation happened" but not "conversation is meaningful enough." The AI may have asked a clarifying question and the user hasn't answered the musical intent questions yet.

**What to use instead:** `readyToGenerate` — set only when `[READY_TO_GENERATE]` appears in an AI response. The AI prompt determines quality and timing; the UI enforces it.

```tsx
// BEFORE (line 1363 of page.tsx):
{messages.length >= 2 && !isStreaming && !generatedPreset && (
  <DevicePicker />
)}

// AFTER:
{readyToGenerate && !isStreaming && !generatedPreset && (
  <DevicePicker />
)}
```

**Source:** Direct codebase inspection — lines 289, 608-618, 1363, 1397 of `src/app/page.tsx`

### Pattern 2: Minimum Turn Count in System Prompt

**What:** System prompt instructs the AI to complete N conversational beats before signaling readiness.

**Structure:**
```
Interview Process:
1. Ask about tone goal (turn 1)
2. Ask about guitar type (turn 2)
3. After 2+ meaningful exchanges: summarize and include [READY_TO_GENERATE]

Do NOT emit [READY_TO_GENERATE] before asking both the tone goal AND guitar type questions.
```

**Why:** The AI is instruction-following. Making the minimum beat count explicit (rather than implied by "gather these things") prevents the AI from optimizing for brevity over quality.

### Pattern 3: Conversation Starter Chips (Optional)

**What:** Pre-filled input chips in the empty state to guide first messages toward richer descriptions.

```tsx
// Only shown when messages.length === 0 and !isStreaming
{messages.length === 0 && !isStreaming && (
  <div className="flex flex-wrap gap-2 mt-4">
    {starterChips.map((text) => (
      <button key={text} onClick={() => setInput(text)}>
        {text}
      </button>
    ))}
  </div>
)}
```

**Source:** Pattern used in similar chat apps — not currently in this codebase.

### Anti-Patterns to Avoid

- **Anti-pattern: Counting turns in UI code.** Don't add `messages.filter(m => m.role === 'user').length >= 2` to the picker condition. The AI controls readiness; the UI just respects it.
- **Anti-pattern: Removing `[READY_TO_GENERATE]` signal mechanism.** This is clean and works. The problem is the timing (prompt says emit early), not the mechanism.
- **Anti-pattern: Adding a delay or timer.** Don't add `setTimeout` or turn count threshold in the UI. Instrument the AI, not the UI.
- **Anti-pattern: Changing the generate API or planner.** This phase is conversation-layer only. `planner.ts`, `/api/generate`, and the Knowledge Layer are untouched.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Conversation turn counting | Custom counter in React state | Rely on `[READY_TO_GENERATE]` flag already wired | Signal mechanism is already in place and works |
| "Musical richness" scoring | NLP analysis of user messages | Prompt the AI to self-assess before signaling | AI has context; UI code does not |
| Multi-step wizard UI | Separate wizard component/pages | Single chat flow with deferred picker | Wizard breaks the conversational feel |

**Key insight:** The `[READY_TO_GENERATE]` mechanism is the right abstraction. The AI knows when it has enough information; the UI just needs to respect that signal by gating on it rather than on an indirect proxy like message count.

---

## Common Pitfalls

### Pitfall 1: Device Picker Disappears on Conversation Resume

**What goes wrong:** If the device picker is gated purely on `readyToGenerate`, and `readyToGenerate` is not restored on resume, users can't generate from a resumed conversation.

**Why it happens:** `loadConversation()` must set `readyToGenerate(true)` for resumed conversations with existing messages.

**How to avoid:** Line 858-860 in `page.tsx` already handles this:
```typescript
const lastMsg = data.messages?.[data.messages.length - 1];
if (lastMsg?.content?.includes("[READY_TO_GENERATE]") || lastMsg?.role === "assistant") {
  setReadyToGenerate(true);
}
```
The condition `lastMsg?.role === "assistant"` means any resumed conversation with AI messages shows the picker. This is correct — if a conversation existed, the AI already did its part.

**Warning signs:** Device picker missing after clicking a sidebar conversation item.

### Pitfall 2: AI Still Emits [READY_TO_GENERATE] Too Early Despite Prompt Changes

**What goes wrong:** A user sends "I want a Hendrix tone on a Strat" — this contains both tone goal AND guitar type in one message. Even with a 2-turn minimum instruction, a compliant AI might argue it has enough and emit the signal on turn 1.

**Why it happens:** LLMs optimize for task completion. "After 2 meaningful exchanges" is ambiguous when one message contains multiple data points.

**How to avoid:** Phrase the prompt rule as: "Do not emit [READY_TO_GENERATE] in the same response as your FIRST question. Always ask at least one follow-up before signaling ready." This forces at least 2 AI responses before the signal, regardless of user input density.

**Warning signs:** Device picker appearing after first AI response in testing.

### Pitfall 3: Picker Visibility Regression for Rig Upload Flow

**What goes wrong:** The rig upload path (vision extraction → substitution card) has its OWN device picker at lines 1269-1310, rendered when `substitutionMap && !isMappingLoading`. This picker is SEPARATE from the chat flow picker. Both pickers should be unaffected by the `readyToGenerate` gate change — only the chat flow picker at line 1363 needs to change.

**Why it happens:** Two picker instances exist for two different flows. Changing only the chat flow picker condition (line 1363) is correct and does not affect the rig upload picker.

**How to avoid:** Edit only the picker at line 1363. Leave the picker at line 1269-1310 (inside `{!messages.length > 0 ? ...rig...}`) unchanged.

**Warning signs:** Rig upload flow stops showing device buttons.

### Pitfall 4: `readyToGenerate` Not Reset on startOver

**What goes wrong:** User finishes a conversation, gets a preset, clicks New Chat, then the device picker immediately appears (because `readyToGenerate` is still `true` from the previous conversation).

**Why it happens:** `startOver()` at line 882 does reset `readyToGenerate`:
```typescript
setReadyToGenerate(false); // line 885
```
This is already handled correctly. No action needed.

**Warning signs:** Device picker visible immediately on new chat with zero messages.

### Pitfall 5: Premium vs Standard Gemini Model Behavior Differences

**What goes wrong:** `gemini-2.5-flash` (standard) may follow prompt instructions more loosely than `gemini-3.1-pro-preview` (premium). Prompt changes that work on premium may not hold on standard.

**Why it happens:** Flash models prioritize speed; Pro models prioritize instruction following.

**How to avoid:** Test the prompt changes with the standard model (`gemini-2.5-flash`) as the baseline. Both models share the same system prompt from `getSystemPrompt()`.

---

## Code Examples

### Current Device Picker Render Condition (page.tsx line 1363)

```tsx
// Source: src/app/page.tsx lines 1363-1403
{messages.length >= 2 && !isStreaming && !generatedPreset && (
  <div className="flex flex-col items-center gap-4 py-6">
    <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
      Which device are you building for?
    </p>
    <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
      {/* device buttons */}
    </div>
    {!readyToGenerate && (
      <p className="text-[11px] text-[var(--hlx-text-muted)] text-center">
        Ready when you are &mdash; or keep chatting to refine the tone
      </p>
    )}
  </div>
)}
```

### Target Device Picker Render Condition

```tsx
// AFTER: page.tsx line 1363 — gate on readyToGenerate, remove unreachable hint text
{readyToGenerate && !isStreaming && !generatedPreset && (
  <div className="flex flex-col items-center gap-4 py-6">
    <p className="text-[11px] text-[var(--hlx-text-muted)] uppercase tracking-widest font-semibold">
      Which device are you building for?
    </p>
    <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
      {/* device buttons — unchanged */}
    </div>
    {/* Remove the !readyToGenerate hint — picker only shows when readyToGenerate is true */}
  </div>
)}
```

### Current System Prompt "When Ready" Section (gemini.ts lines 86-104)

```typescript
// Source: src/lib/gemini.ts — getSystemPrompt()
## When Ready to Generate

Once you know the tone goal AND guitar type (or have made a reasonable assumption), you have enough to build a great preset. Do NOT keep asking questions — summarize your plan and include the marker.

**CRITICAL — you MUST include [READY_TO_GENERATE] in your response text when you are ready.**

Rules for including [READY_TO_GENERATE]:
- Include it in the SAME response where you summarize your build plan
- Include it even if you are asking one final optional question
- Include it after receiving even a single detailed description — do not keep probing if you already have enough
- Place it anywhere in the message — beginning, middle, or end
```

### Target System Prompt "When Ready" Section

```typescript
// AFTER: src/lib/gemini.ts — getSystemPrompt() "When Ready" section
## Conversation Flow

Guide the conversation through these beats BEFORE offering to generate:

1. **Opening** — Greet and ask the one most important question: what tone/artist/genre/vibe are they after? Ask about a specific reference if they gave a general answer.

2. **Guitar** — Ask what guitar they play (pickup type is critical: single coil vs humbucker vs P90). If they mentioned a specific guitar model in their opening, you can skip this question and confirm your assumption in your summary.

3. **Summary and offer** — After the above two beats, summarize your plan (amp choice, key effects, snapshot layout) and include [READY_TO_GENERATE].

**Minimum rule: Do NOT emit [READY_TO_GENERATE] in your first response.** Always ask at least one follow-up question first, even if the opening message contains enough detail for a complete preset. The follow-up keeps the conversation feel alive and often surfaces useful refinements.

## When Ready to Generate

**CRITICAL — you MUST include [READY_TO_GENERATE] in your response text when you are ready.**

Rules for including [READY_TO_GENERATE]:
- Include it in the SAME response where you summarize your build plan
- Include it after at least 2 exchanges (your opening question + at least one follow-up or clarification)
- NEVER include it in your very first response — always ask at least one follow-up first
- Place it anywhere in the message — beginning, middle, or end

In that same message, summarize what you will build:
- Amp choice and why
- Key effects in the chain
- Snapshot plan (names and what each does)
- Any guitar-specific notes
```

### [READY_TO_GENERATE] Detection in sendMessage (page.tsx lines 607-618)

```typescript
// Source: src/app/page.tsx — already correct, no change needed
if (fullContent.includes("[READY_TO_GENERATE]")) {
  setReadyToGenerate(true);
  setMessages((prev) => {
    const updated = [...prev];
    updated[updated.length - 1] = {
      role: "assistant",
      content: fullContent.replace("[READY_TO_GENERATE]", "").trim(),
    };
    return updated;
  });
}
```

### Resume Flow readyToGenerate Restoration (page.tsx lines 856-860)

```typescript
// Source: src/app/page.tsx — already correct, no change needed
const lastMsg = data.messages?.[data.messages.length - 1];
if (lastMsg?.content?.includes("[READY_TO_GENERATE]") || lastMsg?.role === "assistant") {
  setReadyToGenerate(true);
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Device picker gated on message count (`>= 2`) | Gate on `readyToGenerate` signal | Picker appears when conversation is actually ready, not just when messages exist |
| AI emits `[READY_TO_GENERATE]` on turn 1 if enough info | AI required to exchange at least 2 turns first | More natural conversation, better musical context before preset generation |
| No conversation starter guidance | Optional starter chips | Users who don't know what to say get a better starting point |

---

## Minimum Viable Change vs Full Redesign

This phase has a clear minimum scope:

**Minimum (2 changes, ~30 lines total):**
1. `page.tsx` line 1363: change `messages.length >= 2` to `readyToGenerate`
2. `gemini.ts` `getSystemPrompt()`: rewrite "When Ready to Generate" section with minimum turn rule

**Extended (optional, additive):**
3. `page.tsx`: Add conversation starter chips in empty state
4. `gemini.ts`: Add more detailed musical conversation guidance (tone adjectives, playing style questions)

The minimum change is enough to address both user complaints. The extended scope improves first-time UX but is not required for the core behavior change.

---

## Open Questions

1. **Should the device picker ALSO appear when the AI explicitly asks "which device?" mid-conversation?**
   - What we know: Currently the AI never asks about device — device selection is entirely a UI concern
   - What's unclear: Should device selection remain UI-only, or should the AI be allowed to trigger it by mentioning device selection?
   - Recommendation: Keep it UI-only, triggered by `[READY_TO_GENERATE]`. Don't add a second signal.

2. **What if the user sends a very long, detailed first message with all required info?**
   - What we know: The new prompt says "never emit `[READY_TO_GENERATE]` on first response." AI must ask a follow-up.
   - What's unclear: Will the follow-up feel forced or artificial if the user gave complete info?
   - Recommendation: Prompt the AI to use the follow-up to confirm/validate rather than probe for new info. "You mentioned X — just to confirm, are you playing a humbucker guitar for this?" feels natural.

3. **Should `readyToGenerate` be renamed to better reflect its new primary function?**
   - What we know: `readyToGenerate` previously only showed/hid hint text. After this change it gates the picker.
   - What's unclear: No technical necessity to rename — it's an internal state variable.
   - Recommendation: Keep the name. It still semantically means "AI has signaled it's ready to generate." The behavior change is in what the UI does with this state, not the state's meaning.

---

## Sources

### Primary (HIGH confidence)
- `src/app/page.tsx` — Direct inspection: device picker condition (line 1363), `readyToGenerate` detection (lines 608-618), resume restoration (lines 856-860), state declarations (lines 289, 309), `startOver()` (lines 882-906)
- `src/lib/gemini.ts` — Direct inspection: `getSystemPrompt()` full text including "When Ready to Generate" section, Gemini model IDs, system prompt delivery
- `src/app/api/chat/route.ts` — Direct inspection: streaming SSE implementation, Gemini client usage, message persistence
- `src/lib/planner.ts` — Direct inspection: Claude planner is separate from chat, only called by `/api/generate`

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Phase 41 context, accumulated decisions about page.tsx architecture
- `.planning/REQUIREMENTS.md` — Confirmed phase 41 is a standalone phase, not part of v3.0 requirements

---

## Metadata

**Confidence breakdown:**
- Current behavior: HIGH — verified by direct code inspection of all relevant files
- Proposed changes: HIGH — straightforward single-lever changes to existing wiring
- Pitfalls: HIGH — each pitfall traced to specific line numbers in existing code
- Prompt engineering outcome: MEDIUM — AI behavior with new prompt instructions cannot be 100% predicted without testing

**Research date:** 2026-03-04
**Valid until:** 60 days — codebase is stable; no external library changes involved
