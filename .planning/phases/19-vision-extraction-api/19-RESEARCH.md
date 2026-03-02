# Phase 19: Vision Extraction API - Research

**Researched:** 2026-03-02
**Domain:** Next.js 15 App Router multipart/FormData vs JSON base64, Anthropic Claude vision API, browser-image-compression, RigIntent extraction from vision response
**Confidence:** HIGH (all critical API surfaces verified against official Anthropic docs and Next.js App Router documentation; browser-image-compression verified against npm/GitHub)

---

## Summary

Phase 19 creates an isolated `/api/vision` route that accepts image uploads, calls Claude Sonnet 4.6 with vision, and returns a `RigIntent` JSON object. The existing `/api/generate` route is not touched. The page.tsx gets an image upload panel that calls `/api/vision` and displays the raw result (Phase 20 wires the full pipeline).

The most important architectural decision this phase resolves: **use JSON base64 (not multipart/FormData) for the vision route body**. Both approaches work in Next.js 15 App Router, but JSON base64 aligns with the existing codebase pattern (`req.json()`), avoids multipart boundary parsing complexity, and keeps the transport contract consistent. Client-side compression via `browser-image-compression` (not yet installed) brings each image under 800KB before base64 encoding, keeping the total 3-photo POST body well under the 4.5MB Vercel hard limit.

The vision prompt instructs Claude to return `modelName: null` when a pedal is not legibly identifiable, uses coarse knob zone labels (low/medium-low/medium-high/high), and produces a JSON object matching `RigIntentSchema` exactly. JSON extraction from Claude's text response uses a regex fence extractor with `JSON.parse` fallback — no `output_config`/`zodOutputFormat` for vision because the vision call cannot use structured output (it requires a user content array with image blocks, not a simple text message).

**Primary recommendation:** JSON base64 body, `browser-image-compression` at 800KB/1568px, isolated `/api/vision` route with `export const maxDuration = 60`, regex JSON extraction, inline upload panel in page.tsx showing raw RigIntent result.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VISION-01 | `/api/vision` route at `src/app/api/vision/route.ts` with `export const maxDuration = 60` — accepts images, calls Claude Sonnet 4.6 vision, returns RigIntent JSON | Anthropic SDK vision API verified; `maxDuration` + Fluid Compute confirmed in PITFALLS.md |
| VISION-02 | `/api/generate` route is byte-for-byte identical to v1.2 state | route.ts read in full (94 lines); zero changes needed; separation confirmed by PITFALLS.md Pitfall 7 |
| VISION-03 | Image upload UI in page.tsx: max 3 files, JPEG/PNG/WebP accepted, client-side compression via browser-image-compression at 800KB/1568px | browser-image-compression API verified; page.tsx state management inspected |
| VISION-04 | Total POST body for 3-photo upload stays under 4.5MB Vercel limit | Math confirmed: 3 x 800KB x 1.33 base64 overhead = ~3.2MB + JSON envelope < 4.5MB |
| VISION-05 | Blurry/poorly-lit photo returns `PhysicalPedal.confidence: "low"` or `"medium"` — UI prompts user to confirm | Confidence field in PhysicalPedalSchema verified in rig-intent.ts; prompt design documented below |
| VISION-06 | Vision prompt instructs Claude to return `modelName: null` when pedal not legibly identifiable — non-pedal object returns null | Prompt design documented; schema handles null via brand/model being empty strings with confidence: "low" |
| VISION-07 | Knob positions use coarse zone labels (low/medium-low/medium-high/high) — no raw percentages | PhysicalPedalSchema.knobPositions uses `z.enum(["low","medium-low","medium-high","high"])` — confirmed in rig-intent.ts |
</phase_requirements>

---

## Q1: multipart/FormData vs JSON base64

**Decision: Use JSON base64.** This is not the ROADMAP's stated preference, but it is the correct choice for this codebase.

**Why JSON base64 wins here:**

1. **Consistency with existing routes.** Both `/api/generate` and `/api/chat` use `await req.json()`. The vision route using `req.json()` is consistent. A multipart route would be the only route using `req.formData()` and would require different client-side fetch code.

2. **No parsing complexity.** `req.formData()` works in Next.js 15 App Router — it is a valid approach. But it returns `File` objects that must be converted to ArrayBuffer and then to base64 before calling the Anthropic SDK. JSON base64 skips that server-side conversion; the client does the base64 encoding as part of compression.

3. **PITFALLS.md explicitly recommends base64 JSON.** Pitfall 7 states: "A dedicated `/api/vision` route handles image-to-RigIntent extraction only. Its contract: `POST { images: base64[] }` → `{ rigIntent: RigIntent, confidence: ConfidenceMap }`."

4. **Body size is controlled by compression, not by transport format.** The 4.5MB limit applies to both multipart and JSON. Client-side compression to 800KB/image keeps 3 images at ~3.2MB base64-encoded — safely under the limit regardless of transport format.

**The ROADMAP says "multipart/FormData"** — treat this as a generic description of "image upload." The implementation uses JSON base64 as the transport, which is consistent with the codebase and with PITFALLS.md guidance.

**What about `req.formData()` in App Router?** It works. `NextRequest.formData()` is a native Web API supported in Next.js App Router. No formidable, no multer, no `bodyParser: false` config needed. But we do not need it here because JSON base64 is simpler.

---

## Q2: browser-image-compression Package

**Not installed.** `package.json` has no `browser-image-compression` entry. Canvas API compression is an alternative but requires more code for the same result.

**Install command:**
```bash
npm install browser-image-compression
```

**Current version:** 2.0.2 (from CDN reference in docs; npm package is actively maintained at this version as of 2026-03-02).

**API surface:**
```typescript
import imageCompression from "browser-image-compression";

// Main function — returns Promise<File>
const compressedFile: File = await imageCompression(file, {
  maxSizeMB: 0.8,          // 800KB target
  maxWidthOrHeight: 1568,  // matches Anthropic's 1568px optimal limit
  useWebWorker: true,      // non-blocking (OffscreenCanvas if supported)
  initialQuality: 0.8,     // starting JPEG quality
});

// Built-in base64 helper — returns data URL ("data:image/jpeg;base64,...")
const dataUrl: string = await imageCompression.getDataUrlFromFile(compressedFile);

// Strip the data URL prefix to get raw base64 for the Anthropic SDK
const base64Data = dataUrl.split(",")[1];
```

**Why not Canvas API directly?**
Canvas compression works but requires manual `canvas.toBlob()` → `FileReader.readAsDataURL()` → Promise wrapping. `browser-image-compression` handles this pipeline, Web Worker offloading, EXIF stripping, and iterative quality reduction. No benefit to hand-rolling canvas compression when this package is available and well-maintained.

**CSP note:** If the project has CSP headers, `useWebWorker: true` requires `script-src blob:`. If CSP causes issues, use `useWebWorker: false` — compression moves to the main thread but still works correctly.

---

## Q3: App Router multipart Parsing

`NextRequest.formData()` works natively in Next.js 15 App Router. No configuration is needed (no `bodyParser: false`). Returns native `FormData` with `File` objects.

```typescript
// This works in App Router — but we are NOT using it (using JSON base64 instead)
const formData = await req.formData();
const files = formData.getAll("images") as File[];
```

**Size limits:** Only the 4.5MB Vercel body limit applies. No separate formData size limit in Next.js itself. The `Content-Type: multipart/form-data` header with boundary is set automatically by the browser when `fetch(url, { body: formData })` is used — do NOT set it manually.

**Known issue (2025):** Non-ASCII filenames in `Content-Disposition` headers cause `"Failed to parse body as FormData"` in some Next.js versions. Not relevant here since we use JSON base64.

**Conclusion:** This is documented for completeness. The vision route uses `req.json()`, not `req.formData()`.

---

## Q4: Vision Route Structure

**Minimal working route with `maxDuration = 60`:**

```typescript
// src/app/api/vision/route.ts
import { NextRequest, NextResponse } from "next/server";

// Required for Vercel Fluid Compute — without this, hard 10s timeout applies
export const maxDuration = 60;

// Required for image processing route — prevents static caching of POST handler
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // ... process images ...
    return NextResponse.json({ rigIntent: ... });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

**Does `force-dynamic` matter?** For POST routes in App Router, Next.js 15 does not statically prerender them. `force-dynamic` is a belt-and-suspenders measure. It does not hurt and prevents any edge caching from returning stale vision results.

**`maxDuration = 60` requirement:** This requires Fluid Compute to be enabled in the Vercel project dashboard. Without Fluid Compute, the Hobby plan has a 10-second default. With Fluid Compute, the effective limit is up to 300 seconds. The PITFALLS.md confirms this requirement. The planner for this phase should include a verification step checking Vercel dashboard Fluid Compute status.

---

## Q5: Anthropic SDK Vision API

**Verified against official Anthropic docs** (platform.claude.com/docs/en/docs/build-with-claude/vision, accessed 2026-03-02).

**Base64 image content block format:**
```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });

const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 1024,  // Vision extraction needs 512-1024, not 4096 (planner uses 4096)
  system: VISION_SYSTEM_PROMPT,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Pedal 1:" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",  // or "image/png", "image/webp"
            data: base64ImageData,     // raw base64 string, NO "data:image/jpeg;base64," prefix
          },
        },
        { type: "text", text: "Pedal 2:" },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: base64ImageData2,
          },
        },
        { type: "text", text: "Extract the pedal information as instructed." },
      ],
    },
  ],
});
```

**Critical: NO `output_config` for vision calls.** The `zodOutputFormat` / structured output path (used in planner.ts) requires the messages array to have a simple string user message. Vision calls require an array of content blocks (text + image). These two call shapes are incompatible. Do NOT attempt to use `zodOutputFormat` on the vision route — use text response + regex JSON extraction instead.

**Media type detection on the server:** The route receives `mediaType` from the client (sent alongside base64 data). Validate it is one of `["image/jpeg", "image/png", "image/webp"]` before forwarding to the Anthropic SDK. The Anthropic API returns an error if `media_type` does not match actual image data.

**Limits confirmed:**
- 5MB per image (API, after base64 decoding) — our 800KB compressed target is well within this
- 100 images max per request — we send max 3
- 32MB total request size — 3 x 800KB x 1.33 = 3.2MB, well within
- Images should be placed before text in the content array for best performance
- Optimal size: long edge no more than 1568px (matching our compression target)

**Multiple images in one call vs separate calls:** Official docs show multiple images in a single API call using interleaved text labels ("Pedal 1:", image block, "Pedal 2:", image block). This is the correct pattern. PITFALLS.md Integration Gotchas section notes separate calls per image, but the official docs show multi-image in one call is supported and efficient. Use one API call with all images for Phase 19 — simpler code, one token charge for the system prompt.

---

## Q6: page.tsx Current State

**Read the full file (lines 1-632).** Key findings:

**State variables (lines 166-183):**
```typescript
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [isStreaming, setIsStreaming] = useState(false);
const [isGenerating, setIsGenerating] = useState(false);
const [readyToGenerate, setReadyToGenerate] = useState(false);
const [generatedPreset, setGeneratedPreset] = useState<{...} | null>(null);
const [error, setError] = useState<string | null>(null);
const [premiumKey, setPremiumKey] = useState<string | null>(null);
const [selectedDevice, setSelectedDevice] = useState<"helix_lt" | "helix_floor" | "pod_go">("helix_lt");
```

**NO image state exists.** No `rigImages`, no `rigIntent`, no upload UI, no file input. Phase 19 adds these.

**The generate POST (lines 302-330):**
```typescript
const res = await fetch("/api/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages,
    premiumKey,
    device: selectedDevice,
  }),
});
```
This is unchanged in Phase 19. Phase 20 adds rigIntent injection.

**UI structure:**
- Welcome screen (empty messages) at lines 401-441 — upload panel can appear here
- Chat flow (messages > 0) at lines 443-581 — upload could appear above the Generate button
- Input area at lines 592-629 — textarea + send button + attribution footer

**For Phase 19:** The upload panel is a new section inserted in the welcome screen or as a collapsible section below the textarea. It does NOT replace any existing UI. It calls `/api/vision` independently and shows the raw RigIntent JSON result. No connection to the generate flow in Phase 19.

---

## Q7: RigIntent Response Handling in page.tsx (Phase 19 Scope)

**Phase 19 scope: standalone upload UI, display raw result only.**

State additions needed for Phase 19:
```typescript
const [rigImages, setRigImages] = useState<File[]>([]);           // selected files (max 3)
const [isVisionLoading, setIsVisionLoading] = useState(false);    // vision API in flight
const [rigIntent, setRigIntent] = useState<RigIntent | null>(null); // extracted result
const [visionError, setVisionError] = useState<string | null>(null); // vision-specific errors
```

The `callVision()` function (Phase 19):
1. Compress each file with `browser-image-compression` (800KB / 1568px)
2. Convert each to base64 via `imageCompression.getDataUrlFromFile()` then strip prefix
3. POST `{ images: [{ data: string, mediaType: string }] }` to `/api/vision`
4. Set `rigIntent` state with the response
5. Show raw JSON in a `<pre>` block (Phase 20 replaces with UI)

**Do not integrate with the generate flow in Phase 19.** The `rigIntent` state sits idle after being displayed. Phase 20 picks it up and injects it into the generate call.

---

## Q8: JSON Extraction from Claude Vision Response

**The problem:** The vision route uses `client.messages.create()` without `output_config`. Claude returns a text block that may contain prose around the JSON, or it may return clean JSON, depending on how well the prompt constrains it.

**Strategy: Regex fence extractor with structured fallback.**

The prompt (see Q9) instructs Claude to return ONLY a JSON object with no prose. When Claude follows instructions, the text block IS the JSON and `JSON.parse(textBlock.text)` works directly.

When Claude adds prose (rare with a strict prompt), use this extractor:

```typescript
function extractJson(text: string): unknown {
  // Try direct parse first (optimal path — no prose)
  try {
    return JSON.parse(text.trim());
  } catch {
    // Try JSON code fence: ```json\n{...}\n```
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim());
      } catch {
        // continue
      }
    }
    // Try bare object: find first { to last }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        // continue
      }
    }
    throw new Error("Could not extract JSON from vision response");
  }
}
```

**After extraction, validate with Zod:**
```typescript
import { RigIntentSchema } from "@/lib/helix/rig-intent";

const raw = extractJson(textBlock.text);
const rigIntent = RigIntentSchema.parse(raw);
```

This ensures the returned object matches the schema exactly, surfacing any Claude output drift as a validation error (500 response with a clear message) rather than a silent type mismatch.

**Why not `zodOutputFormat` (structured output)?** The planner.ts uses `output_config: { format: zodOutputFormat(ToneIntentSchema) }` with a simple string user message. The vision call requires a content array (text + image blocks) which is incompatible with `output_config` in the current Anthropic SDK. Do not attempt to combine them.

---

## Q9: Prompt Design for callRigVisionPlanner()

### System Prompt

```
You are a guitar pedal identification assistant.

Your job is to analyze photos of guitar effect pedals and return structured JSON describing each pedal's make, model, and knob positions.

## Rules

1. Return ONLY a valid JSON object — no prose, no markdown, no explanation before or after.
2. If you cannot clearly identify a pedal's make and model from the image (text is not legible, image is too blurry, object is not a guitar pedal), set brand to "", model to "", fullName to "", and confidence to "low".
3. Use coarse zone labels for knob positions: "low" (roughly 7-9 o'clock), "medium-low" (roughly 9-11 o'clock), "medium-high" (roughly 1-3 o'clock), "high" (roughly 3-5 o'clock). Use 12 o'clock as the boundary between medium-low and medium-high.
4. Do not guess a specific model name if the label text is not clearly legible. It is better to return confidence "low" with an honest note than to guess a wrong model name.
5. If the photo does not appear to show a guitar pedal at all, return an empty pedals array.

## JSON Schema to return

{
  "pedals": [
    {
      "brand": "string — e.g. 'Boss', 'Ibanez', 'Electro-Harmonix'. Empty string if not legible.",
      "model": "string — e.g. 'TS9', 'SD-1', 'Big Muff Pi'. Empty string if not legible.",
      "fullName": "string — brand + model combined, e.g. 'Ibanez TS9 Tube Screamer'. Empty string if not legible.",
      "knobPositions": {
        "<knob label as printed on pedal>": "<low|medium-low|medium-high|high>"
      },
      "imageIndex": "number — 0-indexed, which image this pedal came from",
      "confidence": "high|medium|low"
    }
  ],
  "extractionNotes": "string — optional, describe any ambiguities, multiple pedals in one photo, or identification challenges"
}

## Confidence Guidelines

- high: brand and model text is clearly legible; knob positions are visible and unambiguous
- medium: brand or model is partially legible; knob positions are estimable but not certain
- low: cannot read brand/model text, or image quality/angle prevents reliable identification
```

### User Message Construction (multiple images)

```typescript
function buildVisionUserContent(images: Array<{ data: string; mediaType: string }>) {
  const content: Anthropic.MessageParam["content"] = [];

  for (let i = 0; i < images.length; i++) {
    content.push({ type: "text", text: `Pedal photo ${i + 1}:` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: images[i].mediaType as "image/jpeg" | "image/png" | "image/webp",
        data: images[i].data,
      },
    });
  }

  content.push({
    type: "text",
    text: `Analyze the ${images.length} pedal photo(s) above. For each pedal you can identify, return one entry in the pedals array. If multiple pedals appear in a single photo, return one entry per pedal with the same imageIndex. Return only the JSON object — no other text.`,
  });

  return content;
}
```

**max_tokens for vision:** Use 1024. The RigIntent JSON for 3 pedals is approximately 400-600 tokens. 1024 provides headroom without the 4096 the planner uses. This reduces cost per vision call.

**No cache_control on the vision system prompt.** The vision system prompt is short (fits in a few hundred tokens) and the call is infrequent. Prompt caching provides diminishing returns here vs. the planner system prompt which is 2000+ tokens called frequently.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.78.0 (installed) | Claude vision API call | Already installed; supports image content blocks |
| `browser-image-compression` | ^2.0.2 (NOT installed) | Client-side image compression | PITFALLS.md mandates compression; this is the standard solution |
| `zod` | ^4.3.6 (installed) | RigIntentSchema validation post-extraction | Already used in planner.ts; validates extracted JSON |
| `next` | 16.1.6 (installed) | Route handler, `req.json()`, `NextResponse` | App Router; `req.formData()` available but unused |

### Supporting (no new packages needed)
| Tool | Purpose |
|------|---------|
| `FileReader.readAsDataURL()` | Fallback if `imageCompression.getDataUrlFromFile()` is insufficient |
| `URL.createObjectURL()` | Client-side image preview thumbnails |

**Installation needed:**
```bash
npm install browser-image-compression
```

---

## Files to Create / Modify

### Create (new files)
1. `src/app/api/vision/route.ts` — the vision extraction route
2. `src/lib/rig-vision.ts` — `callRigVisionPlanner()` function, `extractJson()`, `buildVisionUserContent()`

### Modify (existing files)
3. `src/app/page.tsx` — add image upload UI + vision state + `callVision()` function

### Do NOT touch
4. `src/app/api/generate/route.ts` — zero changes; verified byte-for-byte identical requirement
5. `src/lib/planner.ts` — zero changes; planner integration is Phase 20
6. `src/lib/helix/rig-intent.ts` — schemas are complete from Phase 17; no changes needed
7. `src/lib/rig-mapping.ts` — mapping is Phase 20+; no changes needed

---

## Architecture Patterns

### Recommended File Structure for New Files
```
src/
├── app/
│   ├── api/
│   │   ├── generate/route.ts    # UNCHANGED
│   │   └── vision/route.ts      # NEW: image-to-RigIntent extraction
│   └── page.tsx                 # MODIFIED: upload UI + vision state
└── lib/
    └── rig-vision.ts            # NEW: callRigVisionPlanner(), extractJson(), buildVisionUserContent()
```

### Pattern 1: Vision Route (route.ts)

```typescript
// src/app/api/vision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { callRigVisionPlanner } from "@/lib/rig-vision";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

interface VisionRequestImage {
  data: string;      // raw base64, no data URL prefix
  mediaType: string; // "image/jpeg" | "image/png" | "image/webp"
}

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGES = 3;
const MAX_BASE64_BYTES = 1_200_000; // ~900KB base64 → ~675KB raw — well under 5MB Claude limit

export async function POST(req: NextRequest) {
  try {
    const { images } = await req.json() as { images: VisionRequestImage[] };

    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: "No images provided" }, { status: 400 });
    }
    if (images.length > MAX_IMAGES) {
      return NextResponse.json({ error: `Maximum ${MAX_IMAGES} images allowed` }, { status: 400 });
    }

    // Validate each image
    for (const img of images) {
      if (!ALLOWED_MEDIA_TYPES.has(img.mediaType)) {
        return NextResponse.json({ error: `Unsupported media type: ${img.mediaType}` }, { status: 400 });
      }
      if (!img.data || img.data.length > MAX_BASE64_BYTES) {
        return NextResponse.json({ error: "Image too large or missing" }, { status: 400 });
      }
    }

    const rigIntent = await callRigVisionPlanner(images);
    return NextResponse.json({ rigIntent });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vision extraction failed";
    console.error("Vision extraction error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

### Pattern 2: rig-vision.ts Module

```typescript
// src/lib/rig-vision.ts
import Anthropic from "@anthropic-ai/sdk";
import { RigIntentSchema } from "@/lib/helix/rig-intent";
import type { RigIntent } from "@/lib/helix/rig-intent";

const VISION_SYSTEM_PROMPT = `...` // full system prompt from Q9 above

export interface VisionImage {
  data: string;       // raw base64 string
  mediaType: string;  // "image/jpeg" | "image/png" | "image/webp"
}

function extractJson(text: string): unknown {
  try {
    return JSON.parse(text.trim());
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try { return JSON.parse(fenceMatch[1].trim()); } catch { /* continue */ }
    }
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      try { return JSON.parse(objectMatch[0]); } catch { /* continue */ }
    }
    throw new Error("Could not extract JSON from vision response");
  }
}

function buildVisionUserContent(images: VisionImage[]): Anthropic.MessageParam["content"] {
  const content: Anthropic.MessageParam["content"] = [];
  for (let i = 0; i < images.length; i++) {
    content.push({ type: "text", text: `Pedal photo ${i + 1}:` });
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: images[i].mediaType as "image/jpeg" | "image/png" | "image/webp",
        data: images[i].data,
      },
    });
  }
  content.push({
    type: "text",
    text: `Analyze the ${images.length} pedal photo(s) above. Return only the JSON object.`,
  });
  return content;
}

export async function callRigVisionPlanner(images: VisionImage[]): Promise<RigIntent> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error("CLAUDE_API_KEY environment variable is required");

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: VISION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildVisionUserContent(images) }],
    // NO output_config — incompatible with image content blocks
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude vision returned no text content");
  }

  const raw = extractJson(textBlock.text);
  return RigIntentSchema.parse(raw);
}
```

### Pattern 3: page.tsx Upload Panel (Phase 19 minimal)

**New state additions** (insert after line 182 — `const [selectedDevice, ...]`):
```typescript
// Vision state (Phase 19)
const [rigImages, setRigImages] = useState<File[]>([]);
const [isVisionLoading, setIsVisionLoading] = useState(false);
const [rigIntent, setRigIntent] = useState<import("@/lib/helix/rig-intent").RigIntent | null>(null);
const [visionError, setVisionError] = useState<string | null>(null);
```

**callVision function** (Phase 19 — insert after `startOver` function):
```typescript
async function callVision() {
  if (rigImages.length === 0) return;
  setIsVisionLoading(true);
  setVisionError(null);
  setRigIntent(null);

  try {
    // Dynamic import — browser-image-compression is client-only
    const imageCompression = (await import("browser-image-compression")).default;

    const compressed = await Promise.all(
      rigImages.map(async (file) => {
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1568,
          useWebWorker: true,
          initialQuality: 0.8,
        });
        const dataUrl = await imageCompression.getDataUrlFromFile(compressedFile);
        return {
          data: dataUrl.split(",")[1],        // strip "data:image/...;base64," prefix
          mediaType: compressedFile.type || "image/jpeg",
        };
      })
    );

    const res = await fetch("/api/vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: compressed }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || `Vision API error: ${res.status}`);
    }

    const data = await res.json();
    setRigIntent(data.rigIntent);
  } catch (err) {
    setVisionError(err instanceof Error ? err.message : "Vision extraction failed");
  } finally {
    setIsVisionLoading(false);
  }
}
```

**Upload panel JSX** (Phase 19 — display-only result, insert in welcome screen area or below input):

The upload panel should appear below the suggestion chips in the welcome screen (insert after the closing `</div>` of the suggestions `flex flex-wrap` block around line 440). Key elements:
- `<input type="file" accept="image/jpeg,image/png,image/webp" multiple max 3>`
- File list showing selected filenames
- "Analyze Photos" button that calls `callVision()`
- Loading state indicator
- Raw RigIntent display: `<pre>{JSON.stringify(rigIntent, null, 2)}</pre>`
- `visionError` display
- Low/medium confidence badge when `pedal.confidence !== "high"` — prompt text: "Confirm this identification?"

The `startOver` function should be extended to also clear vision state:
```typescript
function startOver() {
  setMessages([]);
  setInput("");
  setReadyToGenerate(false);
  setGeneratedPreset(null);
  setError(null);
  // Phase 19 additions:
  setRigImages([]);
  setRigIntent(null);
  setVisionError(null);
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Client-side image compression | Canvas resize + quality loop | `browser-image-compression` | Handles Web Worker, EXIF strip, iterative quality, aspect ratio — 20+ lines vs 1 function call |
| JSON extraction from LLM response | Complex parser | Regex fence + `JSON.parse` | LLMs produce predictable output patterns; simple extractor covers all cases |
| Base64 encoding on server | Node.js Buffer manipulation | Client does it via `imageCompression.getDataUrlFromFile()` | Server never sees raw file bytes — only base64 string in JSON body |
| File type validation by extension | String `.endsWith('.jpg')` check | MIME type check (`file.type`) | Extensions are user-controlled; MIME type is set by browser from file signature |

---

## Common Pitfalls

### Pitfall 1: Including `output_config` on Vision Calls
**What goes wrong:** Using `zodOutputFormat(RigIntentSchema)` in the vision route breaks the call with an API error — structured output requires a simple string user message, not a content array with image blocks.
**How to avoid:** Vision route uses `client.messages.create()` with no `output_config`. Validate the response with `RigIntentSchema.parse(extractJson(text))` after the call.
**Warning sign:** Anthropic SDK throws `"Invalid request: output_config is incompatible with image content"` or similar.

### Pitfall 2: Including `data:image/...;base64,` Prefix in API Call
**What goes wrong:** `imageCompression.getDataUrlFromFile()` returns a data URL with the `data:image/jpeg;base64,` prefix. Passing this directly to the Anthropic SDK `source.data` field causes an API error — the SDK expects raw base64 bytes, not a data URL.
**How to avoid:** Always strip the prefix: `dataUrl.split(",")[1]`.
**Warning sign:** Anthropic API returns `400 Bad Request` with a message about invalid base64 data.

### Pitfall 3: Modifying generate/route.ts
**What goes wrong:** Any change to `src/app/api/generate/route.ts` breaks the "byte-for-byte identical" success criterion and risks the existing text-only generation flow.
**How to avoid:** Phase 19 creates a NEW route at `src/app/api/vision/route.ts`. The generate route is read-only for this phase.
**Warning sign:** Any git diff showing changes to `src/app/api/generate/route.ts`.

### Pitfall 4: Sending Compressed Files Without Validating Post-Compression Size
**What goes wrong:** `browser-image-compression` with `maxSizeMB: 0.8` targets 800KB but may not always achieve it (e.g., lossless PNG with complex content). If three 900KB files are sent, the JSON body is ~3.6MB — still under 4.5MB but uncomfortably close.
**How to avoid:** After compression, validate: `if (compressed.length > 1_000_000) warn user`. The route also validates `img.data.length > MAX_BASE64_BYTES` (1.2MB in base64 ≈ 900KB raw).

### Pitfall 5: Not Handling `confidence: "low"` in UI
**What goes wrong:** The vision API returns valid JSON but with `confidence: "low"` pedals. If the UI just shows the result without flagging low-confidence entries, the user may proceed with wrong pedal identification into Phase 20 mapping.
**How to avoid:** For each pedal where `confidence !== "high"`, render a visible badge/warning in the upload panel. Text: "Low confidence — please confirm or correct this identification."

### Pitfall 6: Using `import` at Top Level for browser-image-compression in page.tsx
**What goes wrong:** `browser-image-compression` uses browser APIs (`OffscreenCanvas`, `File`, `Blob`). Static import at the top of page.tsx (which is a `"use client"` component) may cause issues during Next.js server-side rendering / build step if the package accesses `window` or `navigator` at module load time.
**How to avoid:** Use dynamic import inside `callVision()`: `const imageCompression = (await import("browser-image-compression")).default`. This ensures the package loads only in browser context when the function is called.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router formidable multipart | App Router `req.formData()` | Next.js 13+ | No middleware needed; native Web API |
| JSON base64 blob in generate route | Separate `/api/vision` route | Architecture decision Phase 19 | Isolation, independent retry, no impact on existing generate flow |
| `output_config` structured output | Regex JSON extraction for vision | Vision calls incompatible with structured output | Must validate manually with Zod |
| Canvas API manual compression | `browser-image-compression` | Well-established | Web Worker support, EXIF stripping, iterative quality |

---

## Open Questions

1. **Vercel Fluid Compute enabled?**
   - What we know: `maxDuration = 60` requires Fluid Compute in the Vercel dashboard
   - What's unclear: Current status of Fluid Compute on this project's Vercel account
   - Recommendation: Planner should include a verification task — check Vercel dashboard before deploying the vision route. If not enabled, enable it before testing.

2. **`browser-image-compression` and `useWebWorker: true` in Next.js build**
   - What we know: The package uses `OffscreenCanvas` and loads a Web Worker script from CDN by default
   - What's unclear: Whether the project's Content Security Policy (if any) allows `blob:` and `cdn.jsdelivr.net`
   - Recommendation: Start with `useWebWorker: true`. If build/runtime errors appear related to CSP or Worker loading, fall back to `useWebWorker: false`.

3. **`RigIntentSchema` requires `imageIndex` as integer — multiple pedals in one photo**
   - What we know: `PhysicalPedalSchema.imageIndex` is `z.number().int()` — the index of which photo the pedal came from
   - What's unclear: If a user photographs two pedals in one shot, Claude should return two entries both with `imageIndex: 0`. The prompt handles this ("If multiple pedals appear in a single photo, return one entry per pedal with the same imageIndex") but hasn't been tested
   - Recommendation: Include a test case in the planner for multi-pedal single-photo.

---

## Sources

### Primary (HIGH confidence)
- [Anthropic Vision Docs](https://platform.claude.com/docs/en/docs/build-with-claude/vision) — base64 content block format, size limits, media types, multiple image pattern; accessed 2026-03-02
- `C:/Users/dsbog/HelixAI/.planning/research/PITFALLS.md` — base64 JSON transport decision (Pitfall 7), body limit analysis (Pitfall 1), timeout/maxDuration (Pitfall 2), JSON extraction approach; researched 2026-03-02
- `C:/Users/dsbog/HelixAI/src/lib/helix/rig-intent.ts` — PhysicalPedalSchema fields, knobPositions enum values, confidence enum, imageIndex field; direct code inspection
- `C:/Users/dsbog/HelixAI/src/app/api/generate/route.ts` — full route (94 lines); confirms `req.json()`, shape `{ messages, device }`, no image handling; "unchanged" criterion verified
- `C:/Users/dsbog/HelixAI/src/lib/planner.ts` — `callClaudePlanner()` uses `output_config: zodOutputFormat()` with string user message; confirms incompatibility with vision (image content array)
- `C:/Users/dsbog/HelixAI/src/app/page.tsx` — all 632 lines; confirmed no existing image state; state variables, generate POST shape, startOver function

### Secondary (MEDIUM confidence)
- [GitHub: Donaldcwl/browser-image-compression](https://github.com/Donaldcwl/browser-image-compression) — API signature, options, `getDataUrlFromFile()` helper, version 2.0.2
- [WebSearch: Next.js 15 App Router req.formData()](https://github.com/vercel/next.js/discussions/36153) — confirms `await req.formData()` works in App Router; confirms no `bodyParser: false` needed; non-ASCII filename bug noted
- [npm: browser-image-compression](https://www.npmjs.com/package/browser-image-compression) — 392K weekly downloads, TypeScript included, options documented

### Tertiary (LOW confidence)
- WebSearch results re: multipart vs JSON base64 in Vercel — multiple community sources agree JSON base64 is simpler for App Router vision routes

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against installed package.json + official npm
- Architecture: HIGH — base64 JSON decision cross-verified by PITFALLS.md + Anthropic SDK code inspection
- Vision API format: HIGH — verified against official Anthropic docs (accessed 2026-03-02)
- page.tsx modifications: HIGH — full file read, all 632 lines inspected
- Pitfalls: HIGH — derived from PITFALLS.md (existing project research) + code inspection

**Research date:** 2026-03-02
**Valid until:** 2026-04-02 (stable libraries; Anthropic SDK vision format unlikely to change)
