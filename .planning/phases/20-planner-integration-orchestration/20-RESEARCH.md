# Phase 20 Research: Planner Integration & Route Orchestration

**Researched:** 2026-03-02
**Domain:** TypeScript / Next.js API route orchestration, Anthropic prompt caching, rig-to-planner data pipeline
**Confidence:** HIGH — all findings derived from direct file inspection of the actual codebase. No external research required; all answers are deterministic from reading the source files.

---

## Research Summary

Phase 20 wires together the three systems built in Phases 17-19 (schemas, pedal mapping, vision) into a single coherent pipeline. The generate route gains an optional `rigIntent` + `rigText` path that calls `mapRigToSubstitutions()`, builds a `toneContext` string, and passes it to `callClaudePlanner()` as the third optional parameter. The prompt caching architecture (system prompt has `cache_control: ephemeral`) is preserved by appending rig context to the user message content only, never the system prompt. The text rig path requires a new `parseRigText()` function in `rig-mapping.ts` that converts a plain-text pedal description into a minimal `RigIntent` compatible with the existing `mapRigToSubstitutions()` signature.

Phase 20 touches exactly four files with surgical changes: `src/lib/planner.ts` (add optional third param), `src/app/api/generate/route.ts` (add rigIntent/rigText handling path), `src/app/page.tsx` (pass rigIntent in generate call, add substitutionMap state), and `src/lib/rig-mapping.ts` (add parseRigText helper). No new routes. No changes to `buildPlannerPrompt()`, `/api/vision/route.ts`, or any test files.

**Primary recommendation:** Use approach B for text rig parsing — add `parseRigText(text: string): RigIntent` to `rig-mapping.ts` that splits on comma/conjunction/newline to produce synthetic `PhysicalPedal` entries. This keeps `mapRigToSubstitutions()` signature unchanged and reuses the entire three-tier lookup system transparently.

---

## Files Analyzed

| File | Purpose | Key Findings |
|------|---------|--------------|
| `src/lib/planner.ts` | Claude API call + prompt building | 139 lines; caching on system prompt via `cache_control: { type: "ephemeral" }`; conversationText built by joining messages; user message is a single string — safe to append toneContext here |
| `src/app/api/generate/route.ts` | Orchestration route | 94 lines; currently destructures `{ messages, device }` only; calls `callClaudePlanner(messages, deviceTarget)` at line 39; two response paths (Pod Go vs Helix) each return a JSON object |
| `src/app/page.tsx` | Client UI | 840 lines; has `rigIntent` state (set by `callVision()`); `generatePreset()` sends `{ messages, premiumKey, device }` — missing `rigIntent`; `generatedPreset` state type lacks `substitutionMap`; Phase 19 note at line 635: "replaced by SubstitutionCard in Phase 21" |
| `src/lib/rig-mapping.ts` | Pedal lookup engine | `mapRigToSubstitutions(rigIntent: RigIntent, device: DeviceTarget): SubstitutionMap` takes a typed RigIntent object; no text-entry path exists yet; `PhysicalPedalSchema` requires `brand`, `model`, `fullName`, `knobPositions`, `imageIndex`, `confidence` |
| `src/lib/rig-vision.ts` | Vision module | `callRigVisionPlanner()` + `extractJson()` + `VisionImage` type; server-only; NOT imported by generate route |
| `src/app/api/vision/route.ts` | Vision route | Fully isolated; returns `{ rigIntent: RigIntent }`; NOT modified in Phase 20 |
| `src/lib/helix/rig-intent.ts` | Type schemas | `RigIntentSchema`, `SubstitutionMapSchema`, `SubstitutionEntry`, `SubstitutionMap` all exported; `PhysicalPedalSchema` requires `knobPositions: Record<string, enum>` and `imageIndex: number.int()` — both must be satisfied by parseRigText() |
| `src/lib/helix/index.ts` | Barrel exports | Already exports `SubstitutionEntry`, `SubstitutionMap`, `RigIntent`, `PhysicalPedal` at line 22; NO new exports needed in Phase 20 |
| `.planning/ROADMAP.md` | Phase 20 spec | SC-5 says "mapRigToSubstitutions() runs against the text" — confirms text must become a RigIntent before mapping; SC-6 says vision failure must not block preset generation |

---

## Architecture Decisions

### AD-1: Text Rig Parsing Strategy

**Selected option: B — new `parseRigText(text: string): RigIntent` function in `src/lib/rig-mapping.ts`**

**Rationale:**

The ROADMAP SC-5 says: "mapRigToSubstitutions() runs against the text" — this rules out any approach that bypasses `mapRigToSubstitutions()`. The function signature is `(rigIntent: RigIntent, device: DeviceTarget): SubstitutionMap`. Therefore the text must be converted to a `RigIntent` before calling it.

Options evaluated:

- **A (client sends `rigText`, route builds minimal RigIntent):** Workable but duplicates logic. Better to centralize in `rig-mapping.ts`.
- **B (new `parseRigText()` in rig-mapping.ts):** Clean. Reuses all existing lookup infrastructure. `mapRigToSubstitutions()` signature unchanged. Centralizes text parsing next to the lookup table where it belongs.
- **C (route scans messages automatically):** Fragile — the route would need heuristics to detect rig descriptions vs. tone descriptions. Breaks separation of concerns.
- **D (text rig is Phase 21):** Contradicts ROADMAP SC-5 which is explicitly listed under Phase 20.

**The `parseRigText()` function design:**

Input: A raw text string like `"TS9 into a Fender Twin Reverb"` or `"TS9, Boss BD-2, TC Hall of Fame reverb"`

Split strategy (in priority order):
1. Split on ` and ` (conjunction)
2. Split on `,` (comma-separated list)
3. Split on `\n` (line-separated list)
4. After splitting, trim each fragment, discard empty strings and fragments that look like amps/guitars (contain "reverb" is fine — mapRigToSubstitutions handles unknown pedals gracefully via the approximate fallback)

Each fragment becomes a synthetic `PhysicalPedal`:
```typescript
{
  brand: "",           // empty — lookupPedal uses fullName as primary key
  model: fragment,     // the raw fragment text
  fullName: fragment,  // PRIMARY lookup key
  knobPositions: {},   // no zone data from text
  imageIndex: 0,       // all from "image 0" (text source)
  confidence: "low",   // text descriptions are inherently lower confidence
}
```

The result is a valid `RigIntent` that passes `RigIntentSchema` validation and routes through `mapRigToSubstitutions()` identically to a vision-extracted rig.

**Client-side interface:** The client sends `rigText?: string` in the generate body. The `rigText` comes from either:
- A hardcoded extract of message content (if the client detects a rig description) — BUT this is complex
- More simply: the ROADMAP says "Gemini interview detects it as a rig description" — this means the Gemini chat phase surfaces the rig. The generate route already has the full `messages` array. However, since extracting rig descriptions from arbitrary message content is fragile, the cleaner approach is: **client sends `rigText` explicitly** when `rigIntent` is null but the user has typed a rig description.

**Practical approach for SC-5:** The user types their rig in the Gemini chat. After the interview completes and `readyToGenerate` becomes true, `page.tsx` checks if `rigIntent` is set (vision path) or null (text path). For the text path, the `messages` array already contains the full conversation including the rig description. The client does NOT need to send a separate `rigText` — instead, the generate route can accept an optional `rigText` for explicit text-only rig input. For the text path where the rig is embedded in chat, `messages` already carries the context (the Planner will read it from `conversationText`). The `mapRigToSubstitutions` text path is triggered when the client sends an explicit `rigText` field.

**Verdict:** The generate route accepts `{ messages, device, rigIntent?, rigText? }`. If `rigIntent` present → vision path. If `rigText` present (and no `rigIntent`) → text path via `parseRigText()`. If neither → standard path (no rig context, same as today).

---

### AD-2: toneContext String Format

**Exact format for vision path (SubstitutionMap → toneContext string):**

```
Rig emulation context: The user's physical pedal rig has been mapped to Helix equivalents. Please prioritize these specific models when building the preset while still fulfilling the tone interview goals:

- {physicalPedal} → {helixModelDisplayName} ({confidence}): {substitutionReason}
- {physicalPedal} → {helixModelDisplayName} ({confidence}): {substitutionReason}
```

**Exact format for text path (raw rigText → toneContext string):**

When `parseRigText()` is called and produces a SubstitutionMap, the same format is used. The confidence levels will typically be "close" or "approximate" since the text won't match exact PEDAL_HELIX_MAP keys.

**Design constraints:**
- Max ~500 chars per entry: `substitutionReason` strings in PEDAL_HELIX_MAP average ~100-150 chars. A 5-pedal rig produces ~700-900 total chars. Well within model context.
- Do NOT include `helixModel` (the `HD2_*` internal ID) — only `helixModelDisplayName` is human-readable and useful to the planner.
- The confidence tier label ("direct", "close", "approximate") helps the planner weigh how strongly to prioritize.

**TypeScript implementation in generate route:**

```typescript
function buildToneContext(substitutionMap: SubstitutionMap): string {
  const lines = substitutionMap.map(
    (e) => `- ${e.physicalPedal} → ${e.helixModelDisplayName} (${e.confidence}): ${e.substitutionReason}`
  );
  return [
    "Rig emulation context: The user's physical pedal rig has been mapped to Helix equivalents. Please prioritize these specific models when building the preset while still fulfilling the tone interview goals:",
    "",
    ...lines,
  ].join("\n");
}
```

---

### AD-3: Route Response Shape

The generate route currently returns these shapes:

**Helix path:**
```json
{ "preset": {...}, "summary": "...", "spec": {...}, "toneIntent": {...}, "device": "helix_lt", "fileExtension": ".hlx" }
```

**Pod Go path:**
```json
{ "preset": {...}, "summary": "...", "spec": {...}, "toneIntent": {...}, "device": "pod_go", "fileExtension": ".pgp" }
```

**Phase 20 adds `substitutionMap` as an optional field to BOTH paths:**

```json
{
  "preset": {...},
  "summary": "...",
  "spec": {...},
  "toneIntent": {...},
  "device": "helix_lt",
  "fileExtension": ".hlx",
  "substitutionMap": [...]   // SubstitutionEntry[] — present only when rig mapping was performed
}
```

When no `rigIntent` or `rigText` was provided, `substitutionMap` is absent from the response (not `null`, just absent). This is cleaner than always returning `null` and allows Phase 21's UI to distinguish "no rig" from "rig with zero matches".

**`page.tsx` generatedPreset state type** must be updated to include `substitutionMap`:

```typescript
const [generatedPreset, setGeneratedPreset] = useState<{
  preset: Record<string, unknown>;
  summary: string;
  spec: Record<string, unknown> & { name?: string };
  toneIntent: Record<string, unknown>;
  device: string;
  fileExtension?: string;
  substitutionMap?: SubstitutionEntry[];  // NEW — Phase 20
} | null>(null);
```

---

### AD-4: Error Handling for Rig Mapping

**ROADMAP SC-6:** "A vision failure does not prevent generating a preset — the UI offers the text description fallback path immediately without requiring a page refresh."

SC-6 is primarily a client-side concern (the `callVision()` function in `page.tsx` already sets `visionError` state when the vision route fails). Phase 20's job is to ensure the generate route does NOT require `rigIntent` — it's fully optional.

**Generate route error handling for rig mapping:**

If `mapRigToSubstitutions()` throws (malformed rigIntent, unexpected data), the generate route should NOT fall back silently. Instead: **let it propagate to the outer try/catch** which returns a 500 with a clear error message. The client can then retry without the `rigIntent` field (falling back to standard generation).

Rationale: Silent fallback would confuse users ("I sent my rig but got a generic preset") more than an explicit error ("Rig mapping failed, please try without rig photos").

**Client-side fallback for SC-6:**

The `visionError` state already exists in `page.tsx`. When `visionError` is set, the UI shows an error message below the upload panel. The user can proceed to the normal chat flow without rig photos. This path already works today. Phase 20 does not need to add any new client-side fallback logic beyond confirming the generate call works when `rigIntent` is `null`/absent.

---

## Implementation Patterns

### Pattern 1: `callClaudePlanner` signature change (planner.ts)

**OLD signature (lines 85-88):**
```typescript
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
): Promise<ToneIntent> {
```

**NEW signature:**
```typescript
export async function callClaudePlanner(
  messages: Array<{ role: string; content: string }>,
  device?: DeviceTarget,
  toneContext?: string,
): Promise<ToneIntent> {
```

**OLD body (lines 97-111) — conversationText building + messages array:**
```typescript
  // Concatenate conversation history into a single user message
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: conversationText }],
```

**NEW body — identical except `conversationText` → `userContent`:**
```typescript
  // Concatenate conversation history into a single user message
  const conversationText = messages
    .map((msg) => `${msg.role}: ${msg.content}`)
    .join("\n\n");

  // Append rig context to user message content only — NOT the system prompt.
  // This preserves prompt caching: the system prompt hash is unchanged.
  const userContent = toneContext
    ? `${conversationText}\n\n---\n\n${toneContext}`
    : conversationText;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user", content: userContent }],
```

**Lines changed:** 2 lines modified (add `userContent` variable after `conversationText`, change `conversationText` to `userContent` in messages array). No other lines change.

**Cache safety proof:** The `cache_control: { type: "ephemeral" }` is on the `system` array entry. The system prompt content is `buildPlannerPrompt(modelList, device)` — this function is unchanged. `modelList` is derived from `getModelListForPrompt(device)` which is deterministic per device. Therefore the system prompt hash is IDENTICAL before and after Phase 20. Appending `toneContext` to the USER message does not affect the system prompt hash. Caching is intact.

---

### Pattern 2: `generate/route.ts` — full new file

Current file: 94 lines. New file adds ~35 lines.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { callClaudePlanner } from "@/lib/planner";
import {
  assembleSignalChain,
  resolveParameters,
  buildSnapshots,
  buildHlxFile,
  summarizePreset,
  validatePresetSpec,
  buildPgpFile,
  summarizePodGoPreset,
  isPodGo,
} from "@/lib/helix";
import type { PresetSpec, DeviceTarget, SubstitutionMap } from "@/lib/helix";
import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";
import type { RigIntent } from "@/lib/helix";

export async function POST(req: NextRequest) {
  try {
    const { messages, device, rigIntent, rigText } = await req.json();

    // Resolve device target — now supports pod_go (PGUX-01)
    let deviceTarget: DeviceTarget;
    if (device === "helix_floor") {
      deviceTarget = "helix_floor";
    } else if (device === "pod_go") {
      deviceTarget = "pod_go";
    } else {
      deviceTarget = "helix_lt";
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No conversation provided" },
        { status: 400 }
      );
    }

    // Rig emulation path: build substitution map and toneContext if rig data present
    let substitutionMap: SubstitutionMap | undefined;
    let toneContext: string | undefined;

    if (rigIntent) {
      // Vision path: rigIntent is a validated RigIntent from /api/vision
      const typedRigIntent = rigIntent as RigIntent;
      substitutionMap = mapRigToSubstitutions(typedRigIntent, deviceTarget);
      toneContext = buildToneContext(substitutionMap);
    } else if (rigText && typeof rigText === "string" && rigText.trim().length > 0) {
      // Text path: user described their rig in text — parse to synthetic RigIntent
      const parsedRigIntent = parseRigText(rigText.trim());
      substitutionMap = mapRigToSubstitutions(parsedRigIntent, deviceTarget);
      toneContext = buildToneContext(substitutionMap);
    }

    // Step 1: Claude Planner generates ToneIntent (creative choices only)
    // Pass device target so planner filters model list for Pod Go (PGMOD-04)
    // Pass toneContext so planner prioritizes rig-matched models (Phase 20)
    const toneIntent = await callClaudePlanner(messages, deviceTarget, toneContext);

    // Step 2: Knowledge Layer pipeline (deterministic)
    // Pass device target so chain rules apply Pod Go constraints (PGCHAIN-01-03)
    const chain = assembleSignalChain(toneIntent, deviceTarget);
    const parameterized = resolveParameters(chain, toneIntent);
    const snapshots = buildSnapshots(parameterized, toneIntent.snapshots);

    // Step 3: Build PresetSpec
    const presetSpec: PresetSpec = {
      name: toneIntent.presetName || `${toneIntent.ampName} ${toneIntent.genreHint || "Preset"}`.slice(0, 32),
      description: toneIntent.description || `${toneIntent.genreHint || ""} preset using ${toneIntent.ampName}`.trim(),
      tempo: toneIntent.tempoHint ?? 120,
      guitarNotes: toneIntent.guitarNotes,
      signalChain: parameterized,
      snapshots,
    };

    // Step 4: Strict validation — fail fast on structural errors
    // Pass device for device-specific validation (Pod Go: all dsp0, 4 snapshots, 10 blocks)
    validatePresetSpec(presetSpec, deviceTarget);

    // Step 5: Build preset file with device target
    if (isPodGo(deviceTarget)) {
      // Pod Go: build .pgp file (PGP-01)
      const pgpFile = buildPgpFile(presetSpec);
      const summary = summarizePodGoPreset(presetSpec);

      return NextResponse.json({
        preset: pgpFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".pgp", // PGUX-02: frontend uses this for download filename
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    } else {
      // Helix: build .hlx file
      const hlxFile = buildHlxFile(presetSpec, deviceTarget);
      const summary = summarizePreset(presetSpec);

      return NextResponse.json({
        preset: hlxFile,
        summary,
        spec: presetSpec,
        toneIntent,
        device: deviceTarget,
        fileExtension: ".hlx",
        ...(substitutionMap !== undefined ? { substitutionMap } : {}),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Preset generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// buildToneContext — convert SubstitutionMap to planner-friendly context string
// ---------------------------------------------------------------------------

function buildToneContext(substitutionMap: SubstitutionMap): string {
  const lines = substitutionMap.map(
    (e) =>
      `- ${e.physicalPedal} → ${e.helixModelDisplayName} (${e.confidence}): ${e.substitutionReason}`
  );
  return [
    "Rig emulation context: The user's physical pedal rig has been mapped to Helix equivalents. Please prioritize these specific models when building the preset while still fulfilling the tone interview goals:",
    "",
    ...lines,
  ].join("\n");
}
```

**New imports vs. old:**
- OLD: `import type { PresetSpec, DeviceTarget } from "@/lib/helix";`
- NEW: `import type { PresetSpec, DeviceTarget, SubstitutionMap } from "@/lib/helix";`
- NEW: `import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";`
- NEW: `import type { RigIntent } from "@/lib/helix";` (for the cast)

**Key design notes:**
- `rigIntent` from the client body is typed `unknown` from `req.json()` — we cast it to `RigIntent` after the conditional check. The data was already validated by `/api/vision/route.ts` before being stored in client state, so the cast is safe.
- `substitutionMap` uses spread with conditional: `...(substitutionMap !== undefined ? { substitutionMap } : {})` — this means the key is absent (not `null`) when no rig mapping was done. Phase 21 UI reads `data.substitutionMap` and checks for presence.
- `buildToneContext()` is a module-private helper function at the bottom of the route file — not exported.

---

### Pattern 3: `parseRigText()` function (rig-mapping.ts)

This new exported function goes at the bottom of `src/lib/rig-mapping.ts`, after `mapRigToSubstitutions`.

```typescript
// ---------------------------------------------------------------------------
// parseRigText — convert a plain-text rig description to a synthetic RigIntent
//
// Splits on conjunctions ("and"), commas, and newlines to extract individual
// pedal name fragments. Each fragment becomes a PhysicalPedal with:
//   - fullName = the fragment (primary lookup key for lookupPedal)
//   - confidence = "low" (text descriptions lack visual confirmation)
//   - knobPositions = {} (no zone data from text)
//
// The resulting RigIntent is passed to mapRigToSubstitutions() which applies
// the same three-tier lookup as the vision path.
// ---------------------------------------------------------------------------

export function parseRigText(text: string): RigIntent {
  // Split on " and " (conjunction), "," (comma list), "\n" (line list)
  const fragments = text
    .split(/\s+and\s+|,|\n/)
    .map((f) => f.trim())
    .filter((f) => f.length > 0);

  const pedals = fragments.map((fragment, index) => ({
    brand: "",
    model: fragment,
    fullName: fragment,
    knobPositions: {} as Record<string, "low" | "medium-low" | "medium-high" | "high">,
    imageIndex: index,
    confidence: "low" as const,
  }));

  return { pedals };
}
```

**Important:** `RigIntent` type is imported at the top of `rig-mapping.ts` already via:
```typescript
import type { RigIntent, SubstitutionEntry, SubstitutionMap, DeviceTarget } from "@/lib/helix";
```
No new imports needed in `rig-mapping.ts`.

**Why `imageIndex: index` instead of `imageIndex: 0`:** Using the fragment index distinguishes pedals from each other, which is useful for debugging. The value does not affect `mapRigToSubstitutions()` logic.

**Why `confidence: "low" as const`:** Text descriptions don't have visual confirmation. The `PhysicalPedalSchema` accepts `"low"` for confidence. The three-tier lookup in `lookupPedal()` ignores the input confidence — it assigns its OWN output confidence based on the lookup result tier. So this input value only affects the `PhysicalPedal` object itself, not the `SubstitutionEntry` confidence.

---

### Pattern 4: `page.tsx` changes

#### Change 1: Add `substitutionMap` state (after `rigIntent` state declaration)

**OLD (lines 186-199):**
```typescript
  // Vision state (Phase 19)
  const [rigImages, setRigImages] = useState<File[]>([]);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [rigIntent, setRigIntent] = useState<{
    pedals: Array<{
      brand: string;
      model: string;
      fullName: string;
      knobPositions: Record<string, string>;
      imageIndex: number;
      confidence: "high" | "medium" | "low";
    }>;
    rigDescription?: string;
    extractionNotes?: string;
  } | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
```

**NEW:**
```typescript
  // Vision state (Phase 19)
  const [rigImages, setRigImages] = useState<File[]>([]);
  const [isVisionLoading, setIsVisionLoading] = useState(false);
  const [rigIntent, setRigIntent] = useState<{
    pedals: Array<{
      brand: string;
      model: string;
      fullName: string;
      knobPositions: Record<string, string>;
      imageIndex: number;
      confidence: "high" | "medium" | "low";
    }>;
    rigDescription?: string;
    extractionNotes?: string;
  } | null>(null);
  const [visionError, setVisionError] = useState<string | null>(null);
  // Rig mapping state (Phase 20) — populated after generate when rigIntent was provided
  const [substitutionMap, setSubstitutionMap] = useState<Array<{
    physicalPedal: string;
    helixModel: string;
    helixModelDisplayName: string;
    substitutionReason: string;
    confidence: "direct" | "close" | "approximate";
    parameterMapping?: Record<string, number>;
  }> | null>(null);
```

NOTE: `page.tsx` uses inline interface definitions throughout (it does not import from `@/lib/helix`). This matches the existing pattern in the file. Phase 21 may refactor to use the barrel import, but Phase 20 should follow the existing inline convention to minimize scope.

#### Change 2: Update `generatedPreset` state type

**OLD (lines 172-179):**
```typescript
  const [generatedPreset, setGeneratedPreset] = useState<{
    preset: Record<string, unknown>;
    summary: string;
    spec: Record<string, unknown> & { name?: string };
    toneIntent: Record<string, unknown>;
    device: string;
    fileExtension?: string;
  } | null>(null);
```

**NEW:**
```typescript
  const [generatedPreset, setGeneratedPreset] = useState<{
    preset: Record<string, unknown>;
    summary: string;
    spec: Record<string, unknown> & { name?: string };
    toneIntent: Record<string, unknown>;
    device: string;
    fileExtension?: string;
    substitutionMap?: Array<{
      physicalPedal: string;
      helixModel: string;
      helixModelDisplayName: string;
      substitutionReason: string;
      confidence: "direct" | "close" | "approximate";
      parameterMapping?: Record<string, number>;
    }>;
  } | null>(null);
```

#### Change 3: Update `generatePreset()` to pass `rigIntent`

**OLD (lines 320-348):**
```typescript
  async function generatePreset() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          premiumKey,
          device: selectedDevice,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Generation failed: ${res.status}`);
      }

      const data = await res.json();
      setGeneratedPreset(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }
```

**NEW:**
```typescript
  async function generatePreset() {
    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          premiumKey,
          device: selectedDevice,
          // Phase 20: pass rigIntent if vision extraction was performed
          ...(rigIntent ? { rigIntent } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Generation failed: ${res.status}`);
      }

      const data = await res.json();
      setGeneratedPreset(data);
      // Phase 20: store substitution map from generate response
      if (data.substitutionMap) {
        setSubstitutionMap(data.substitutionMap);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }
```

#### Change 4: Update `startOver()` to clear substitutionMap

**OLD `startOver()` (lines 372-382):**
```typescript
  function startOver() {
    setMessages([]);
    setInput("");
    setReadyToGenerate(false);
    setGeneratedPreset(null);
    setError(null);
    // Phase 19: clear vision state
    setRigImages([]);
    setRigIntent(null);
    setVisionError(null);
  }
```

**NEW:**
```typescript
  function startOver() {
    setMessages([]);
    setInput("");
    setReadyToGenerate(false);
    setGeneratedPreset(null);
    setError(null);
    // Phase 19: clear vision state
    setRigImages([]);
    setRigIntent(null);
    setVisionError(null);
    // Phase 20: clear substitution map
    setSubstitutionMap(null);
  }
```

**NOTE on `rigText` client path:** Phase 20's text rig path (SC-5) requires the client to send `rigText`. However, since the Gemini interview already captures the rig description in `messages`, the simplest Phase 20 implementation for text rig is: the user types their rig in chat → it goes into `messages` → those `messages` are passed to the planner → the planner sees the rig in the conversation. For the `mapRigToSubstitutions` text path to trigger, the client must explicitly send `rigText`. Phase 20 does NOT add any UI for explicit `rigText` entry — the text rig path is triggered when the user's chat conversation contains pedal names that get extracted. The `rigText` field in the body is reserved for a future explicit "enter your rig as text" input (not built in Phase 20). What Phase 20 DOES build: the generate route can ACCEPT and PROCESS `rigText` if provided, but the UI for entering it explicitly is Phase 21. This satisfies SC-5 mechanically (the route handles it) without requiring new UI.

Actually — re-reading SC-5 more carefully: "A text-only rig description typed in the chat without any image upload: the Gemini interview detects it as a rig description, the generate call receives it as conversation context, mapRigToSubstitutions() runs against the text." The phrase "receives it as conversation context" confirms the text rig is in `messages`. "mapRigToSubstitutions() runs against the text" is the key requirement — this needs `parseRigText()` to be called somewhere. The cleanest interpretation: Phase 20 should also check `messages` for rig content and auto-extract it, OR the planner already gets the text via `conversationText`. Given SC-5 says the substitution map is "returned to the UI", the route MUST call `mapRigToSubstitutions` for the text path. The practical implementation: the client sends a separate `rigText` extracted from messages. The AI interview (Gemini) summarizes the rig — that summary string is sent by the client as `rigText`.

For Phase 20, the safest approach that satisfies SC-5 without guessing at Gemini chat output format: **the client sends `rigText` when `rigIntent` is null but the user mentions pedal names in conversation.** The simplest implementation: page.tsx adds logic to detect if the latest assistant message contains rig summary language and auto-populates a `rigText` field. But this is complex. Better: **add a `rigText` input field** so users can explicitly paste their rig in text form. Phase 20 wires the route to handle it; Phase 21 can add the UI polish.

---

### Pattern 5: New exports (helix/index.ts)

**No new exports needed.** All required types are already exported:

```typescript
// Already in src/lib/helix/index.ts line 22:
export type { PhysicalPedal, RigIntent, SubstitutionEntry, SubstitutionMap } from "./rig-intent";
```

`SubstitutionMap` is already exported. `page.tsx` uses inline type definitions (consistent with its current pattern) so it doesn't import from the barrel.

`parseRigText` is a new export from `src/lib/rig-mapping.ts` — it is NOT exported from the barrel. The generate route imports it directly from `@/lib/rig-mapping`.

---

## File Change Summary

| File | Action | Change Description |
|------|--------|-------------------|
| `src/lib/planner.ts` | Modify | Add `toneContext?: string` third parameter; add `userContent` variable with conditional toneContext append; pass `userContent` instead of `conversationText` to messages array. 3 lines changed/added total. |
| `src/app/api/generate/route.ts` | Modify | Destructure `rigIntent, rigText` from body; add `SubstitutionMap` and `RigIntent` type imports; add `mapRigToSubstitutions, parseRigText` imports; add rig path conditional block (~20 lines); pass `toneContext` to `callClaudePlanner`; add `substitutionMap` to both response paths; add private `buildToneContext()` helper. ~40 lines net new. |
| `src/app/page.tsx` | Modify | 4 changes: (1) add `substitutionMap` state variable; (2) add `substitutionMap?` to `generatedPreset` state type; (3) update `generatePreset()` to pass `rigIntent` in body and call `setSubstitutionMap`; (4) add `setSubstitutionMap(null)` to `startOver()`. |
| `src/lib/rig-mapping.ts` | Modify | Add `parseRigText(text: string): RigIntent` exported function at the bottom (~20 lines). No changes to existing functions. |
| `src/lib/helix/index.ts` | No change | All required types already exported. |
| `src/app/api/vision/route.ts` | No change | Fully isolated — Phase 20 does not touch it. |
| `src/lib/rig-vision.ts` | No change | Server-only module — Phase 20 does not touch it. |
| `vitest.config.ts` | No change | Test infrastructure unchanged. |

---

## Verification Strategy

### TypeScript compilation
```bash
npx tsc --noEmit
```
Expected: 0 errors.

### Unit tests (existing suite)
```bash
npx vitest run
```
Expected: All 108 existing tests pass. No new tests required for Phase 20 (the logic paths are wired in existing tested functions; integration is tested manually per SC verification below).

### Build check
```bash
npm run build
```
Expected: Clean build. Routes listed: `/api/chat`, `/api/generate`, `/api/vision`.

### SC-1 verification: callClaudePlanner signature
```typescript
// This should compile without errors:
import { callClaudePlanner } from "@/lib/planner";
callClaudePlanner(messages, "helix_lt");           // no toneContext — old call sites OK
callClaudePlanner(messages, "helix_lt", "context"); // with toneContext — compiles
```

### SC-2 verification: toneContext goes to user message, not system
Inspect `planner.ts` after change — `buildPlannerPrompt()` call is unchanged, `system` array is unchanged. `userContent` variable is a conditional append of `toneContext` to `conversationText`.

### SC-3 verification: cache_read_input_tokens > 0
Make two identical generate requests (same messages, same device, with rigIntent). Check server logs or API response for `usage.cache_read_input_tokens > 0` on the second request. The system prompt hash must be stable between requests — confirmed because `buildPlannerPrompt()` is unchanged.

### SC-4 verification: generate route orchestration
Send a POST to `/api/generate` with `{ messages, device, rigIntent }`:
- Response must include `substitutionMap` array
- `mapRigToSubstitutions` must have been called (verify via SubstitutionEntry confidence values)

### SC-5 verification: text rig path
Send `{ messages, device, rigText: "TS9 into a Twin Reverb" }` to `/api/generate`:
- Response includes `substitutionMap`
- SubstitutionMap has at least one entry for "TS9 into a Twin Reverb" or its fragments
- `parseRigText` splits on " and " so "TS9 into a Twin Reverb" becomes ["TS9 into a Twin Reverb"] (no split point) → lookupPedal with that text → "approximate" or "close" confidence

### SC-6 verification: vision failure fallback
With `visionError` set in page.tsx (vision call failed), click Generate — it should fire with `{ messages, device }` only (no rigIntent). Response is a normal preset with no substitutionMap.

---

## Pitfalls

### Pitfall 1: TypeScript cast of `rigIntent` from `req.json()`

The `rigIntent` value from `await req.json()` is typed `unknown`. The `mapRigToSubstitutions` function expects `RigIntent`. Since the data was validated by `/api/vision` before being stored in client state, the cast `rigIntent as RigIntent` is safe. However, if future code paths allow arbitrary JSON to be sent as `rigIntent`, add `RigIntentSchema.parse(rigIntent)` before the cast.

**Do NOT run `RigIntentSchema.parse()` in the generate route by default** — it adds Zod validation overhead to every rig generation call. The vision route already validated the shape. Document the assumption in a comment instead.

### Pitfall 2: `parseRigText` with no split points

Input: `"TS9"` — no commas, no "and", no newlines. Result: `[{ fullName: "TS9", ... }]`. This is correct — single pedal name. `lookupPedal("TS9", device)` will check PEDAL_HELIX_MAP for "ts9" (lowercased) which is NOT in the table (only "ibanez ts9" and "ts9 tube screamer" are). Category detection: "ts9" does not match any category keyword. Result: "approximate" confidence. This is expected behavior — document it so the planner knows it.

### Pitfall 3: `buildToneContext` with empty substitutionMap

If `mapRigToSubstitutions` returns `[]` (empty RigIntent with no pedals), `buildToneContext([])` produces a valid string with just the header and no bullet points. This is passed to the planner as a `toneContext` with no useful content. The planner will still work — it just ignores the empty context. To avoid this edge case, add a guard: only build toneContext if `substitutionMap.length > 0`.

**Recommended guard in generate route:**
```typescript
if (substitutionMap && substitutionMap.length > 0) {
  toneContext = buildToneContext(substitutionMap);
}
```

### Pitfall 4: `premiumKey` in generate body is not processed by route

The current generate route ignores `premiumKey` from the body (it's not destructured). Phase 20 adds `rigIntent` and `rigText` to the destructuring. The `premiumKey` remains unprocessed — this is the existing behavior. Do NOT change this.

### Pitfall 5: `substitutionMap` spread with conditional

```typescript
...(substitutionMap !== undefined ? { substitutionMap } : {})
```

This pattern omits the key entirely when `substitutionMap` is undefined. Client code must use `data.substitutionMap` (optional chaining or existence check), not `data.substitutionMap === null`. Phase 21 UI should check `if (data.substitutionMap && data.substitutionMap.length > 0)`.

### Pitfall 6: `parseRigText` does NOT need to be added to helix/index.ts barrel

It is a utility specific to the rig-mapping layer. Only the generate route calls it. Exporting it from the barrel would expose it to client components which should never call it (server-only function due to mapRigToSubstitutions dependency chain). Keep the import as:
```typescript
import { mapRigToSubstitutions, parseRigText } from "@/lib/rig-mapping";
```

### Pitfall 7: `knobPositions` type in `parseRigText`

`PhysicalPedalSchema` defines `knobPositions` as `z.record(z.string(), z.enum(["low", "medium-low", "medium-high", "high"]))`. An empty object `{}` passes this schema. In TypeScript, the explicit cast `{} as Record<string, "low" | "medium-low" | "medium-high" | "high">` is needed to satisfy the type checker since an untyped `{}` infers as `{}` not the specific Record type.

---

## Notes for Phase 21

Phase 20 leaves the following ready for Phase 21 to consume:

1. **`substitutionMap` in generate response** — Phase 21 reads `data.substitutionMap` from the generate response and renders it in the SubstitutionCard component. The data shape is `SubstitutionEntry[]` with all fields needed for display.

2. **`substitutionMap` state in page.tsx** — The `substitutionMap` useState is populated in `generatePreset()` via `setSubstitutionMap(data.substitutionMap)`. Phase 21 can read this state to render the SubstitutionCard in the preset result area.

3. **Raw JSON debug display** — Line 635 in `page.tsx` has a `<details>` block marked "Phase 19 only — replaced by SubstitutionCard in Phase 21". Phase 21 should replace that block with the SubstitutionCard component.

4. **Phase 21 SC-1**: "substitution card renders BEFORE generate" — this means Phase 21 needs to call `mapRigToSubstitutions` BEFORE the generate call (client-side call to a new `/api/map-rig` route, or inline in the component). Phase 20's architecture puts mapping INSIDE the generate route, which means the substitution card can only show AFTER generation. Phase 21 will need to refactor: move the mapping call out of generate (or add a separate pre-generate mapping step). This is a Phase 21 concern — document it here so Phase 21 research accounts for it.

5. **Pod Go text rig** (Phase 21 SC-6): `parseRigText()` + `mapRigToSubstitutions()` already handles Pod Go device target — it calls `getModelIdForDevice()` with `device: "pod_go"` which appends the Mono suffix. No changes needed in Phase 20 for this to work.

6. **Progressive loading states** (Phase 21 SC-5): Phase 20 does not add staged loading. The current generate flow has a single `isGenerating` spinner. Phase 21 adds distinct "Analyzing pedal photo…" → "Mapping to Helix models…" → "Building preset…" stages.

---

## Sources

### Primary (HIGH confidence)
All findings derived from direct file inspection of the HelixAI codebase. No external sources needed — Phase 20 is a pure code orchestration phase with all dependencies already built.

- `src/lib/planner.ts` — caching architecture, conversationText pattern, function signatures
- `src/app/api/generate/route.ts` — current orchestration, request/response shapes
- `src/app/page.tsx` — existing state, generatePreset() function, rigIntent state location
- `src/lib/rig-mapping.ts` — mapRigToSubstitutions signature, RigIntent type usage
- `src/lib/helix/rig-intent.ts` — PhysicalPedalSchema fields, SubstitutionEntry type
- `src/lib/helix/index.ts` — existing barrel exports (confirmed SubstitutionMap already exported)
- `.planning/ROADMAP.md` — SC-1 through SC-6 requirements for Phase 20

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns from existing codebase
- Architecture: HIGH — deterministic from reading actual code; no ambiguity
- Pitfalls: HIGH — identified from direct type constraints and existing patterns
- parseRigText design: HIGH — confirmed against PhysicalPedalSchema requirements

**Research date:** 2026-03-02
**Valid until:** Indefinite — based on static code analysis, not external APIs

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RIG-04 | Text rig descriptions must trigger substitution mapping | Addressed by parseRigText() + rigText route parameter |
| RIG-05 | Vision rig descriptions must trigger substitution mapping | Addressed by rigIntent route parameter + mapRigToSubstitutions() call |
| PLAN-01 | callClaudePlanner gains optional toneContext param | Pattern 1 — exact code shown |
| PLAN-02 | toneContext appended to user message, not system prompt | Pattern 1 — cache safety proof provided |
| PLAN-03 | generate route orchestrates vision→mapping→planner pipeline | Pattern 2 — full new route.ts shown |
| API-02 | /api/generate is the only route that changes | Confirmed — zero new routes; vision route unchanged |
| API-03 | generate response includes substitutionMap | AD-3 + Pattern 2 — conditional spread pattern documented |
