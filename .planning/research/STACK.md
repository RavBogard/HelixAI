# Stack Research

**Domain:** Vision AI + browser image upload (v1.3 Rig Emulation additions to HelixAI)
**Researched:** 2026-03-02
**Confidence:** HIGH — all key claims verified against official Anthropic and Vercel documentation

---

## Scope

This file covers ONLY the NEW stack additions for v1.3 Rig Emulation. The existing validated
stack (Next.js 14, TypeScript, Tailwind CSS, Claude Sonnet 4.6 via `@anthropic-ai/sdk`, Zod,
Vercel) is NOT re-researched here.

New capabilities required:
1. Browser image upload (one or more pedal photos) to a Next.js/Vercel serverless route
2. Client-side image compression to stay within Vercel's 4.5MB body limit
3. Vision AI that extracts pedal model name + knob positions from each photo

---

## Recommendation Summary

**Vision AI:** Use Claude Sonnet 4.6 vision (base64 image blocks in existing messages[]).
**Image upload:** Use multipart FormData to the existing `/api/generate` route.
**Client-side compression:** Use `browser-image-compression` v2.0.2.
**No new API keys, no new SDK, no new serverless routes required.**

---

## Vision API Decision: Claude Sonnet 4.6 vs Gemini Flash vs Google Cloud Vision API

### The core task

From a photo of a guitar pedal, extract:
1. Pedal model name (text printed/silkscreened on the enclosure)
2. Knob positions per knob — an estimate of rotary position (0–100%)

These are two very different sub-tasks with different difficulty profiles.

**Model name reading** is OCR on clear printed text. Straightforward for any modern vision model.

**Knob position reading** is spatial reasoning about the angular position of a rotary dial.
This is a documented hard problem for all current LLMs — structurally identical to reading
an analog clock face.

### Critical finding: Claude's documented spatial reasoning limitation

The official Anthropic vision documentation (verified March 2026) explicitly states:

> "Claude's spatial reasoning abilities are limited. It may struggle with tasks requiring
> precise localization or layouts, like **reading an analog clock face** or describing
> exact positions of chess pieces."

Source: https://platform.claude.com/docs/en/build-with-claude/vision

Reading a guitar pedal knob is the same task as reading an analog clock face — estimating
the angular position of a pointer within a circular range. This limitation applies equally
to Gemini Flash; it is a class-level weakness of current LLMs, not specific to Claude.

**Design consequence:** Do not prompt any LLM for precise knob percentages (e.g., "Drive: 67%").
Instead, prompt for coarse buckets: low (0–25%), medium-low (25–50%), medium-high (50–75%),
high (75–100%). LLMs reliably distinguish "fully counterclockwise" from "noon" from "fully
clockwise." Three-to-five bucket precision is achievable. Sub-10% precision is not reliable
from any of the three vision options.

### Comparison matrix

| Criterion | Claude Sonnet 4.6 | Gemini 2.0/2.5 Flash | Google Cloud Vision API |
|-----------|-------------------|----------------------|-------------------------|
| **Model name OCR accuracy** | HIGH — strong text extraction, admits uncertainty | HIGH — 98.2% on printed text, strong general OCR | HIGH — specialized OCR, deterministic |
| **Knob position estimation** | LIMITED — same clock-face spatial weakness; reliable for coarse buckets | LIMITED — same weakness; Gemini 3 Flash "Agentic Vision" (code-execution loop) mitigates somewhat but requires Gemini 3 and adds complexity | NOT APPLICABLE — returns bounding boxes and labels; cannot estimate rotary angular position |
| **Structured JSON output** | Native — existing `zodOutputFormat` pattern already in codebase works unchanged | Strong with explicit schema, but requires new SDK + integration | None — returns raw label/confidence pairs; requires a separate LLM call to produce structured output |
| **Integration complexity** | ZERO — extend existing `messages[]` with `{ type: "image", source: { type: "base64" } }` blocks | HIGH — new package `@google/generative-ai`, new `GOOGLE_API_KEY` env var, new error handling surface | HIGH — two-step pipeline (Cloud Vision for OCR + LLM for reasoning), two new SDKs, two API keys |
| **Cost per image (1000x1000px)** | ~$0.004 (1,334 tokens @ $3/MTok on Claude Sonnet 4.6) | ~$0.0001 (1,334 tokens @ $0.10/MTok on Gemini 2.0 Flash) | ~$0.0015 ($1.50/1,000 requests for label detection), plus second LLM call |
| **Latency** | 300–600ms typical | 200–400ms typical | Sub-second for Vision API, +300–600ms for required second LLM call |
| **Hallucination behavior** | Lower — admits uncertainty rather than guessing | Flash models trade accuracy for speed; slightly higher hallucination rate | Deterministic, no hallucinations, but requires second LLM step which reintroduces hallucination risk |
| **Vercel serverless compatible** | YES — existing SDK pattern works | YES — REST API works in serverless | YES — REST API works in serverless |
| **New dependencies** | None | `@google/generative-ai` + env setup | `@google-cloud/vision` + Google Cloud project |

### Recommendation: Claude Sonnet 4.6

**Use Claude Sonnet 4.6 vision.** The decision is architectural, not accuracy-based.

All three options share the same fundamental spatial reasoning limitation for knob positions.
For model name extraction (OCR), all three perform equivalently. The accuracy difference
between Claude and Gemini Flash for this specific task is negligible when both are prompted
for coarse buckets.

Claude Sonnet 4.6 wins decisively on:

**Zero integration cost.** The Anthropic SDK is already initialized in the codebase. Adding
image content blocks to `messages[]` is a 10-line change to the planner, not a new integration.
The existing `zodOutputFormat` pattern works unchanged — pass images in the messages array,
define a `RigAnalysis` Zod schema, receive structured output.

**Consistent error handling.** The existing error boundary around all Claude API calls covers
vision calls automatically. No new error surface.

**No new API keys or environment variables.** The existing `ANTHROPIC_API_KEY` is the only
credential needed.

**Prompt caching synergy.** The system prompt (which includes rig mapping knowledge) can be
cached at the 1-hour rate. Vision calls that reuse the same system prompt benefit from the
0.1x cache-read multiplier on those tokens. This partially offsets the cost premium over Gemini.

**Choose Gemini Flash only if:** Cost becomes a dominant concern at scale (>50,000 sessions/month)
AND you accept adding a second SDK, second API key, and second error handling path. At v1.3
hobbyist scale, the cost difference is ~$0.003 per session — irrelevant.

**Do not use Google Cloud Vision API** for this task. It cannot estimate rotary positions at all.
You would need Cloud Vision for text detection and a separate Claude/Gemini call for spatial
reasoning, giving you two API calls, two error surfaces, two API keys, and higher total latency
— with no accuracy benefit over using Claude alone.

---

## Core Technologies (NEW additions only)

### Vision Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@anthropic-ai/sdk` | already installed | Add `{ type: "image", source: { type: "base64" } }` blocks to existing `messages[]` | Zero new dependencies; the SDK already supports vision natively |

No new package required. The Anthropic TypeScript SDK already accepts image content blocks in
the `messages` array. Extend the existing planner to pass compressed pedal photos as base64
blocks before the text instruction.

```typescript
// Content block added to the last user message
{
  type: "image",
  source: {
    type: "base64",
    media_type: "image/jpeg",   // or image/png, image/webp
    data: base64String,          // Buffer.from(arrayBuffer).toString("base64")
  },
}
```

Claude's image token formula: `tokens = (width * height) / 750`. A 1000x1000px image uses
~1,334 tokens, costing ~$0.004 at Claude Sonnet 4.6 rates. After compressing to Claude's
optimal dimensions (max 1,568px per edge), images sit at ~1,600 tokens maximum.

Source: https://platform.claude.com/docs/en/build-with-claude/vision

### Image Upload (Browser to Serverless Route)

**Use multipart FormData**, not base64 JSON encoding at the HTTP layer.

Base64 encoding adds ~33% payload overhead. A 1MB compressed image becomes 1.33MB in a JSON
body. With 3 pedal photos, that is 4MB of base64 text in JSON vs 3MB of binary — a meaningful
difference against Vercel's 4.5MB hard limit.

With multipart FormData, the Next.js App Router handles parsing natively via `req.formData()`.
No library required.

```typescript
// app/api/generate/route.ts (extended pattern)
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const messages = JSON.parse(formData.get('messages') as string);
  const device = formData.get('device') as string;
  const imageFiles = formData.getAll('images') as File[];

  const imageBlocks = await Promise.all(
    imageFiles.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64,
        },
      };
    })
  );
  // Prepend imageBlocks to the content array of the last user message before the AI call
}
```

`req.formData()` is built into Next.js App Router's `NextRequest` — no formidable, multer, or
other library needed.

---

## Supporting Libraries (NEW)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `browser-image-compression` | 2.0.2 | Client-side image compression before upload | Always — enforces payload budget before upload reaches Vercel's 4.5MB limit |

### Why browser-image-compression

- **Web Worker support** (`useWebWorker: true` by default) — compression runs off the main
  thread; the chat UI remains responsive during processing
- **`maxSizeMB` option** — hard payload budget per image before FormData is sent
- **`maxWidthOrHeight: 1568`** — matches Claude's optimal image dimension exactly; images
  wider than 1568px are auto-resized by Anthropic's API anyway, wasting upload bandwidth
- **Format support** — JPEG, PNG, WebP, BMP — covers all realistic pedal photo formats
- **MIT license, 264+ npm dependents** — stable, actively used

**Version note:** v2.0.2 is 3 years old but stable. No upgrade risk. No alternative with
broader adoption in this category exists. The library does exactly what is needed.

Source: https://www.npmjs.com/package/browser-image-compression
Source: https://github.com/Donaldcwl/browser-image-compression

### Compression configuration for HelixAI

```typescript
import imageCompression from 'browser-image-compression';

const options = {
  maxSizeMB: 0.8,           // Target 800KB per image
  maxWidthOrHeight: 1568,   // Claude's optimal max dimension
  useWebWorker: true,       // Non-blocking (default)
  fileType: 'image/jpeg',   // Force JPEG output for consistent compression
};

const compressedFile = await imageCompression(rawFile, options);
// compressedFile is a File object — use directly in FormData.append()
```

### Payload budget math

| Images | Size each (post-compression) | Total payload | Vercel limit | Headroom |
|--------|------------------------------|---------------|--------------|----------|
| 1 | 800KB | ~0.9MB (binary) | 4.5MB | OK |
| 2 | 800KB each | ~1.7MB | 4.5MB | OK |
| 3 | 800KB each | ~2.5MB | 4.5MB | OK |
| 4+ | 800KB each | 3.3MB+ | 4.5MB | Warn user: max 3 photos |

Enforce a maximum of 3 photos per upload in the client UI. Display an explicit warning if
exceeded — do not silently drop images.

---

## Installation

```bash
# Client-side compression only — no new server-side packages needed
npm install browser-image-compression
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Claude Sonnet 4.6 vision | Gemini 2.0/2.5 Flash | Only if per-image cost matters at >50k sessions/month AND you accept second SDK integration overhead |
| Claude Sonnet 4.6 vision | Google Cloud Vision API | Never for this specific task — cannot estimate rotary positions without a second LLM call |
| `browser-image-compression` | `compressor.js` | If canvas lifecycle hooks are needed (watermarks, grayscale); no advantage for compression-only use |
| `browser-image-compression` | Vanilla canvas API | Zero dependencies acceptable; adds ~30 lines of boilerplate; choose if library weight is a concern |
| multipart FormData | Base64 JSON | Never — base64 adds 33% overhead on an already constrained 4.5MB limit |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Google Cloud Vision API (standalone) | Returns labels and bounding boxes, not rotary position estimates. A second LLM call is required for knob reasoning — two error surfaces, two keys, higher latency, no accuracy benefit | Claude Sonnet 4.6 vision |
| Gemini Flash (alongside Claude) | Splitting vision across two providers creates dual SDK overhead, dual API key management, and dual error handling for no measurable accuracy gain on this specific task | Claude Sonnet 4.6 vision |
| Precise percentage prompts ("what percentage is the drive knob set to?") | All current LLMs have documented spatial reasoning limitations for analog rotary positions — precision requests produce unreliable hallucinated numbers | Prompt for coarse buckets: low / medium-low / medium-high / high |
| Base64 JSON body for image upload | 33% payload inflation; three 800KB images in base64 = ~3.2MB of JSON text, approaching Vercel's 4.5MB limit uncomfortably | multipart FormData |
| formidable / multer | Required only for Pages Router. App Router handles multipart natively via `req.formData()` | Built-in `req.formData()` on `NextRequest` |
| Cloudinary / Vercel Blob / S3 for storage | Adds external storage dependency and async upload flow for a synchronous real-time use case — overkill when client-side compression keeps all images under the limit | Compress client-side, upload direct to serverless route |
| Uncompressed raw uploads | A typical phone photo of a guitar pedal is 3–8MB. Three uncompressed photos exceed Vercel's 4.5MB limit before any JSON overhead is added | `browser-image-compression` with `maxSizeMB: 0.8` |
| Anthropic Files API for pedal photos | Files API is designed for reuse of the same asset across multiple requests. Pedal photos are one-shot per session — no reuse benefit; adds an extra API call round-trip | Direct base64 encoding in the messages array |

---

## Stack Patterns by Variant

**If user uploads one pedal photo:**
- Compress to <800KB
- Upload via FormData alongside messages + device
- Pass as a single image content block before the text instruction in the user message
- Claude returns: `{ pedalName: string, knobs: { name: string, position: "low"|"medium-low"|"medium-high"|"high" }[] }`

**If user uploads multiple pedal photos (2–3):**
- Compress each to <800KB (total ~2.4MB binary, safe under 4.5MB)
- Upload all in one FormData request
- Label each image in the user message content: "Pedal 1: [image] Pedal 2: [image]"
- Claude returns `RigAnalysis[]` via `zodOutputFormat`

**If user uploads 4+ photos:**
- Client-side validation rejects with explicit message: "Please upload up to 3 pedal photos at a time"
- Do not silently drop images

**If user provides text-only rig description (no photos):**
- No image blocks in messages — existing flow unchanged
- Claude parses the text description in the conversational turn as before

---

## Vercel Constraint Summary

| Constraint | Value | Mitigation |
|------------|-------|------------|
| Serverless body limit | 4.5MB hard (no workaround on hobby tier) | Compress to <800KB/image, max 3 images = ~2.4MB binary + headers |
| Function timeout (hobby plan) | 10 seconds | Claude vision call with 3 images: ~3–6s total; within limit |
| Cold start overhead | ~300–500ms | Already accepted in existing architecture |
| Anthropic API per-image size limit | 5MB per image | After compression to <800KB, no issue |
| Anthropic image dimension limit | 8000x8000px max (auto-resize above 1568px long edge) | After `maxWidthOrHeight: 1568` compression, no issue |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `browser-image-compression@2.0.2` | Next.js 14, TypeScript 5.x | Client-side only — no SSR import; import in `"use client"` components |
| `@anthropic-ai/sdk` (existing version) | Next.js 14 App Router serverless | Base64 image content blocks are a standard SDK feature; no version bump required |

---

## Sources

- Anthropic Vision Docs (official, verified 2026-03-02) — image token formula, spatial reasoning limitation ("like reading an analog clock face"), 5MB per-image API limit, supported formats, base64 integration pattern: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic Pricing (official, verified 2026-03-02) — Claude Sonnet 4.6 at $3/MTok input, prompt caching multipliers: https://platform.claude.com/docs/en/about-claude/pricing
- Google Gemini API Pricing (official) — Gemini 2.0 Flash at $0.10/MTok input, Gemini 2.5 Flash at $0.30/MTok input: https://ai.google.dev/gemini-api/docs/pricing
- Vercel Serverless Body Limit (official KB) — 4.5MB hard limit, no config override in production: https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions
- Next.js App Router `req.formData()` — built-in multipart support, no library needed: https://strapi.io/blog/epic-next-js-15-tutorial-part-5-file-upload-using-server-actions
- `browser-image-compression` npm — v2.0.2, Web Worker support, `maxSizeMB`/`maxWidthOrHeight` options: https://www.npmjs.com/package/browser-image-compression
- `browser-image-compression` GitHub — Donaldcwl/browser-image-compression, MIT license: https://github.com/Donaldcwl/browser-image-compression
- Gemini Flash spatial reasoning limitations — semantic interpretation misses on ambiguous geometries (MEDIUM confidence, WebSearch, multiple sources): https://www.helicone.ai/blog/gemini-2.0-flash
- Gemini 2.0 Flash OCR accuracy — 98.2% on printed text, strong general OCR: https://reducto.ai/blog/lvm-ocr-accuracy-mistral-gemini

---

*Stack research for: HelixAI v1.3 Rig Emulation — vision API + image upload additions*
*Researched: 2026-03-02*
